import "server-only";
import "temporal-polyfill/full/global";

import { HttpError, nowInstant } from "@/lib/admin-api";
import { todayInHotelTimezone } from "@/lib/hotel/time";
import { calculateCancellationFee, readPolicySnapshot } from "@/lib/hotel/cancellation";
import { toCents } from "@/lib/hotel/pricing";
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
export async function verifyCardSetup(setupRef: string): Promise<StoredCard> {
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

  return card;
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

  const ergebnis = calculateCancellationFee({
    policy: snapshot,
    totalAmount: String(booking.totalAmount),
    firstNightAmount: String(booking.totalAmount),
    checkIn: String(booking.checkIn),
    cancelledOn: options.on ?? todayInHotelTimezone(booking.hotel.timezone),
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
