import "server-only";
import "temporal-polyfill/full/global";

import { HttpError, nowInstant } from "@/lib/admin-api";
import { todayInHotelTimezone } from "@/lib/hotel/time";
import {
  applicableRule,
  calculateCancellationFee,
  readPolicySnapshot,
} from "@/lib/hotel/cancellation";
import { daysBetween } from "@/lib/hotel/cancellation";
import { fromCents, toCents } from "@/lib/hotel/pricing";
import { db } from "@/prisma/db";

import { getPaymentProvider } from "./index";
import { PaymentError, type StoredCard } from "./provider";

// Die Karten-Garantie. Zwei Regeln bestimmen alles Weitere:
//
//   1. Ob eine Karte verlangt wird, entscheidet der Rate Plan
//      (cardGuaranteeRequired) - nicht der Browser.
//   2. Wie viel belastet werden darf, entscheidet ausschliesslich der bei
//      der Buchung eingefrorene Stornoschnappschuss. Im Code stehen dazu
//      keine Fristen und keine Prozentsaetze.

export type GuaranteeRequirement = {
  required: boolean;
  /** True, wenn ein Anbieter eingerichtet ist. */
  available: boolean;
};

/** Kennzeichen des eingerichteten Anbieters, oder null. */
export function paymentProviderName(): string | null {
  return getPaymentProvider()?.name ?? null;
}

/** Verlangt der Rate Plan eine Kartengarantie? */
export async function guaranteeRequirement(ratePlanId: number): Promise<GuaranteeRequirement> {
  const plan = await db.orm.hotel.RatePlan
    .where({ id: ratePlanId })
    .select("cardGuaranteeRequired")
    .first();

  return {
    required: Boolean(plan?.cardGuaranteeRequired),
    available: getPaymentProvider() !== null,
  };
}

/**
 * Prüft beim Anbieter, ob die Karte wirklich hinterlegt wurde. Die Angabe
 * des Browsers allein genügt nicht - gefragt wird der Anbieter.
 */
export async function verifyCardSetup(
  setupRef: string,
  /**
   * Der Gast, zu dem die Hinterlegung gehoeren muss. Ohne diese Pruefung
   * liesse sich eine fremde Referenz an eine eigene Buchung binden.
   */
  expected: { email: string }
): Promise<StoredCard> {
  const provider = getPaymentProvider();

  if (!provider) {
    throw new HttpError(503, "Die Kartenhinterlegung ist derzeit nicht verfügbar.");
  }

  if (!setupRef || typeof setupRef !== "string") {
    throw new HttpError(400, "Bitte hinterlegen Sie eine Kreditkarte.");
  }

  let card: StoredCard | null;

  try {
    card = await provider.confirmCardSetup(setupRef);
  } catch (error) {
    throw new HttpError(
      502,
      error instanceof PaymentError
        ? "Die Karte konnte nicht geprüft werden. Bitte versuchen Sie es erneut."
        : "Die Kartenprüfung ist fehlgeschlagen."
    );
  }

  if (!card) {
    throw new HttpError(
      400,
      "Die Karte wurde nicht bestätigt. Bitte wiederholen Sie die Eingabe oder verwenden Sie eine andere Karte."
    );
  }

  // Die Hinterlegung muss zu diesem Gast gehoeren. Verglichen wird mit der
  // Adresse, die der ANBIETER am Kunden fuehrt - nicht mit einer Angabe aus
  // dem Browser.
  const beimAnbieter = (card.customerEmail ?? "").trim().toLowerCase();
  const inDerBuchung = expected.email.trim().toLowerCase();

  if (!beimAnbieter) {
    // Ohne Adresse beim Anbieter ist die Zuordnung nicht pruefbar. Dann
    // wird die Karte nicht uebernommen, statt sie ungeprueft zu glauben.
    throw new HttpError(
      409,
      "Die hinterlegte Karte lässt sich dieser Buchung nicht zuordnen. Bitte hinterlegen Sie die Karte erneut."
    );
  }

  if (beimAnbieter !== inDerBuchung) {
    throw new HttpError(
      409,
      "Die hinterlegte Karte gehört zu einer anderen E-Mail-Adresse. Bitte hinterlegen Sie die Karte mit den Daten dieser Buchung erneut."
    );
  }

  return card;
}

/**
 * Weist eine Zahlungsmethode ab, die schon an einer anderen wirksamen
 * Buchung haengt.
 *
 * Grund: Die Freigabe loest die Methode beim Anbieter vollstaendig. Haengt
 * sie an zwei Buchungen, verliert die zweite unbemerkt ihre Garantie.
 *
 * `allowBookingId` laesst eine bestehende Buchung ausdruecklich zu - damit
 * ein zweites Absenden derselben Buchung weiterhin durchgeht.
 */
export type ReuseOptions = {
  blockingStatuses: readonly string[];
  /** Diese Buchung gilt nicht als Fremdbelegung. */
  allowBookingId?: number | null;
};

/**
 * Die Entscheidung, getrennt von der Abfrage: Haengt die Methode an einer
 * anderen wirksamen Buchung? Rein, damit die Regel ohne Datenbank pruefbar
 * ist.
 */
export function cardIsReused(
  rows: readonly { id: number; status: unknown }[],
  options: ReuseOptions
): boolean {
  return rows.some(
    (buchung) =>
      buchung.id !== options.allowBookingId &&
      options.blockingStatuses.includes(String(buchung.status))
  );
}

export async function assertCardNotReused(
  methodRef: string,
  options: ReuseOptions = { blockingStatuses: [] }
) {
  const treffer = await db.orm.hotel.Booking
    .where({ paymentMethodRef: methodRef })
    .select("id", "status")
    .all();

  if (cardIsReused(treffer, options)) {
    throw new HttpError(
      409,
      "Diese Karte ist bereits für eine andere Buchung hinterlegt. Bitte verwenden Sie eine andere Karte."
    );
  }
}

/**
 * Preis der ersten Uebernachtung einer Buchung, aus den eingefrorenen
 * Nachtpreisen. Null, wenn keine gespeichert sind - dann darf keine Regel
 * auf dieser Grundlage abgerechnet werden.
 */
export async function firstNightAmountOf(bookingId: number): Promise<string | null> {
  const zimmer = await db.orm.hotel.BookingRoom
    .where({ bookingId })
    .select("id")
    .all();

  if (zimmer.length === 0) return null;

  let frueheste: { date: string; amount: string } | null = null;

  for (const raum of zimmer) {
    const naechte = await db.orm.hotel.BookingRoomNight
      .where({ bookingRoomId: raum.id })
      .select("date", "amount")
      .all();

    for (const nacht of naechte) {
      const datum = String(nacht.date);

      // Die frueheste Nacht ueber alle Zimmer der Buchung. Bei gleichem
      // Datum gewinnt der hoehere Betrag nicht - es wird summiert, denn
      // mehrere Zimmer sind mehrere erste Naechte.
      if (!frueheste || datum < frueheste.date) {
        frueheste = { date: datum, amount: String(nacht.amount) };
      } else if (datum === frueheste.date) {
        frueheste = {
          date: datum,
          amount: fromCents(toCents(frueheste.amount) + toCents(String(nacht.amount))),
        };
      }
    }
  }

  return frueheste?.amount ?? null;
}

export type ChargeDecision = {
  allowed: boolean;
  amount: string;
  reason: string;
};

/**
 * Was bei dieser Buchung heute belastet werden dürfte. Grundlage ist allein
 * der Schnappschuss der Buchung: Eine spätere Änderung der Hotelrichtlinie
 * verändert bestehende Buchungen nicht.
 */
export async function chargeDecision(
  bookingId: number,
  options: { noShow?: boolean; on?: string } = {}
): Promise<ChargeDecision> {
  const booking = await db.orm.hotel.Booking
    .where({ id: bookingId })
    .select("checkIn", "totalAmount", "cancellationPolicySnapshot")
    .include("hotel", (h) => h.select("timezone"))
    .first();

  if (!booking) {
    throw new HttpError(404, "Buchung nicht gefunden.");
  }

  const snapshot = readPolicySnapshot(booking.cancellationPolicySnapshot);

  if (!snapshot) {
    return {
      allowed: false,
      amount: "0.00",
      reason: "Für diese Buchung sind keine Stornobedingungen gespeichert.",
    };
  }

  const stichtag = options.on ?? todayInHotelTimezone(booking.hotel.timezone);

  // Der Preis der ersten Nacht wird nur geholt, wenn eine Regel ihn
  // braucht. Frueher stand hier der GESAMTBETRAG - eine FIRST_NIGHT-Regel
  // haette damit den ganzen Aufenthalt verrechnet.
  const regel = options.noShow
    ? null
    : applicableRule(snapshot.rules, daysBetween(stichtag, String(booking.checkIn)));

  const ersteNacht =
    regel?.basis === "FIRST_NIGHT" ? await firstNightAmountOf(bookingId) : null;

  if (regel?.basis === "FIRST_NIGHT" && ersteNacht === null) {
    return {
      allowed: false,
      amount: "0.00",
      reason:
        "Für diese Buchung sind keine Nachtpreise gespeichert; die erste Nacht lässt sich nicht abrechnen.",
    };
  }

  const ergebnis = calculateCancellationFee({
    policy: snapshot,
    totalAmount: String(booking.totalAmount),
    firstNightAmount: ersteNacht ?? "0.00",
    checkIn: String(booking.checkIn),
    cancelledOn: stichtag,
    noShow: options.noShow,
  });

  return {
    allowed: !ergebnis.free && toCents(ergebnis.amount) > 0,
    amount: ergebnis.amount,
    reason: ergebnis.reason,
  };
}

/**
 * Belastet die hinterlegte Karte mit der Stornogebühr. Der Betrag kommt
 * ausschließlich aus `chargeDecision`, nie von außen.
 */
export async function chargeCancellation(
  bookingId: number,
  options: { noShow?: boolean } = {}
) {
  const provider = getPaymentProvider();

  if (!provider) {
    throw new HttpError(503, "Es ist kein Zahlungsanbieter eingerichtet.");
  }

  const booking = await db.orm.hotel.Booking
    .where({ id: bookingId })
    .select(
      "id",
      "bookingNumber",
      "currency",
      "paymentProvider",
      "paymentCustomerRef",
      "paymentMethodRef",
      "paymentStatus",
      "paymentChargedAt"
    )
    .first();

  if (!booking) {
    throw new HttpError(404, "Buchung nicht gefunden.");
  }

  // Schutz gegen Doppelbelastung auf unserer Seite. Zusaetzlich traegt der
  // Aufruf beim Anbieter einen Idempotenzschluessel.
  if (booking.paymentChargedAt) {
    throw new HttpError(409, "Diese Buchung wurde bereits belastet.");
  }

  if (!booking.paymentCustomerRef || !booking.paymentMethodRef) {
    throw new HttpError(409, "Für diese Buchung ist keine Karte hinterlegt.");
  }

  const entscheidung = await chargeDecision(bookingId, options);

  if (!entscheidung.allowed) {
    throw new HttpError(409, `Eine Belastung ist nicht zulässig: ${entscheidung.reason}`);
  }

  const ergebnis = await provider.chargeStoredCard({
    card: {
      customerRef: booking.paymentCustomerRef,
      methodRef: booking.paymentMethodRef,
    },
    amountInCents: toCents(entscheidung.amount),
    currency: booking.currency,
    description: `Stornogebühr Buchung ${booking.bookingNumber}`,
    idempotencyKey: `cancel-${booking.bookingNumber}`,
  });

  await db.orm.hotel.Booking.where({ id: bookingId }).update({
    paymentStatus: ergebnis.succeeded ? "CHARGED" : "FAILED",
    paymentChargedAt: ergebnis.succeeded ? nowInstant() : null,
    cancellationFee: ergebnis.succeeded
      ? (entscheidung.amount as unknown as Parameters<
          typeof db.orm.hotel.Booking.create
        >[0]["cancellationFee"])
      : null,
    updatedAt: nowInstant(),
  });

  return { ...ergebnis, amount: entscheidung.amount, reason: entscheidung.reason };
}

/** Hebt die Hinterlegung auf, etwa nach fristgerechter Stornierung. */
export async function releaseGuarantee(bookingId: number) {
  const provider = getPaymentProvider();

  const booking = await db.orm.hotel.Booking
    .where({ id: bookingId })
    .select("paymentCustomerRef", "paymentMethodRef", "paymentStatus")
    .first();

  if (!booking?.paymentCustomerRef || !booking.paymentMethodRef) return false;

  if (provider) {
    try {
      await provider.releaseStoredCard({
        customerRef: booking.paymentCustomerRef,
        methodRef: booking.paymentMethodRef,
      });
    } catch {
      // Die Freigabe beim Anbieter darf die Stornierung nicht blockieren.
      // Der Status wird trotzdem gesetzt, der Rest ist Aufräumarbeit.
    }
  }

  await db.orm.hotel.Booking.where({ id: bookingId }).update({
    paymentStatus: "CANCELLED",
    updatedAt: nowInstant(),
  });

  return true;
}
