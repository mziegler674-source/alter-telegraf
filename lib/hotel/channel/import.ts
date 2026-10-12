import "server-only";
import "temporal-polyfill/full/global";

import { Temporal } from "temporal-polyfill";

import { HttpError, nowInstant } from "@/lib/admin-api";
import { bookingNumber } from "@/lib/hotel/booking-number";
import { BOOKING_SOURCES, type BookingSource } from "@/lib/hotel/constants";
import { categoryHasRoom } from "@/lib/hotel/inventory";
import { fromCents, nightsBetween, toCents } from "@/lib/hotel/pricing";
import { db } from "@/prisma/db";

import type { ExternalBooking } from "./provider";
import { enqueueJob } from "./jobs";

import type { Numeric } from "@prisma/orm-postgres/target/codec-types";

const money = (value: string) => value as unknown as Numeric<10, 2>;

// Uebernahme externer Reservierungen.
//
// Zwei Eigenschaften sind hier entscheidend:
//
// 1. IDEMPOTENZ. Die Kennung des Kanals (externalChannel + externalBookingId)
//    ist eindeutig - das stellt bereits das Datenbankschema sicher. Geht
//    dieselbe Reservierung erneut ein, entsteht keine zweite Buchung.
//    Unterschieden wird ausserdem zwischen einem Neueingang und der
//    Aenderung einer bereits bekannten Reservierung.
//
// 2. DER KANAL HAT BEREITS VERKAUFT. Eine externe Reservierung wird deshalb
//    nicht abgewiesen, wenn der Bestand knapp ist - sie wird uebernommen und
//    als Ueberbuchung GEKENNZEICHNET. Sie stillschweigend zu verwerfen waere
//    der schlimmere Fehler: Der Gast steht dann trotzdem vor der Tuer.
//
// Niemals wird eine Reservierung aufgrund aehnlicher Namen zugeordnet. Ohne
// bestaetigte Zuordnung der externen Zimmerart entsteht keine Buchung,
// sondern eine Aufgabe fuer den Betrieb.

export type ImportStatus =
  | "CREATED"
  | "UPDATED"
  | "CANCELLED"
  | "DUPLICATE"
  | "NEEDS_MAPPING"
  | "UNKNOWN_REFERENCE";

export type ImportResult = {
  status: ImportStatus;
  bookingId: number | null;
  bookingNumber: string | null;
  /** Bestand war zu knapp; der Betrieb muss sich kuemmern. */
  overbooked: boolean;
  jobId: number | null;
  message: string | null;
};

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/** Externe Eingaben werden wie Fremdeingaben behandelt und geprueft. */
export function validateExternalBooking(external: ExternalBooking) {
  const probleme: string[] = [];

  if (!external.externalRef?.trim()) probleme.push("Die externe Referenz fehlt.");
  if (!external.externalRoomTypeId?.trim()) probleme.push("Die externe Zimmerart fehlt.");

  if (!DATUM.test(external.checkIn ?? "") || !DATUM.test(external.checkOut ?? "")) {
    probleme.push("Anreise oder Abreise sind kein gültiges Datum.");
  } else {
    let naechte = 0;

    try {
      naechte = nightsBetween(external.checkIn, external.checkOut);
    } catch {
      naechte = 0;
    }

    if (naechte < 1) probleme.push("Die Abreise muss nach der Anreise liegen.");
    if (naechte > 365) probleme.push("Der Aufenthalt ist unplausibel lang.");
  }

  if (!Number.isInteger(external.adults) || external.adults < 1 || external.adults > 20) {
    probleme.push("Die Anzahl der Erwachsenen ist ungültig.");
  }

  const kinder = external.children ?? 0;

  if (!Number.isInteger(kinder) || kinder < 0 || kinder > 20) {
    probleme.push("Die Anzahl der Kinder ist ungültig.");
  }

  if (!external.guest?.lastName?.trim()) probleme.push("Der Gastname fehlt.");

  if (!["NEW", "MODIFIED", "CANCELLED"].includes(external.status)) {
    probleme.push("Der Status der Reservierung ist unbekannt.");
  }

  if (external.totalAmount !== null && external.totalAmount !== undefined) {
    try {
      toCents(external.totalAmount);
    } catch {
      probleme.push("Der Betrag ist keine gültige Zahl.");
    }
  }

  return probleme;
}

/** Betrag gleichmaessig auf die Naechte verteilen, Rest auf die letzte. */
function verteileBetrag(gesamtCents: number, naechte: number) {
  const grundbetrag = Math.floor(gesamtCents / naechte);
  const rest = gesamtCents - grundbetrag * naechte;

  return Array.from({ length: naechte }, (_, index) =>
    index === naechte - 1 ? grundbetrag + rest : grundbetrag
  );
}

async function findeOderLegeGastAn(
  tx: typeof db,
  guest: ExternalBooking["guest"],
  provider: string
) {
  const email = guest.email?.trim().toLowerCase() || null;

  if (email) {
    const vorhanden = await tx.orm.hotel.Guest.where({ email }).first();

    if (vorhanden) return vorhanden;
  }

  return tx.orm.hotel.Guest.create({
    firstName: guest.firstName?.trim() || "Gast",
    lastName: guest.lastName.trim(),
    email,
    phone: guest.phone?.trim() || null,
    countryCode: guest.countryCode?.trim().toUpperCase().slice(0, 2) || null,
    notes: `Angelegt über den Vertriebskanal ${provider}.`,
  });
}

/**
 * Uebernimmt eine externe Reservierung. Legt neu an, aktualisiert oder
 * storniert - je nach Status und bisherigem Kenntnisstand.
 */
export async function importExternalBooking(
  provider: string,
  external: ExternalBooking,
  options: { recordJob?: boolean } = {}
): Promise<ImportResult> {
  // Der Webhook-Endpunkt fuehrt sein eigenes Auftragsprotokoll, damit es je
  // eingegangener Nachricht genau eine Zeile gibt. Dann wird hier keine
  // zweite angelegt.
  const recordJob = options.recordJob ?? true;

  const protokolliere = async (input: Parameters<typeof enqueueJob>[1]) =>
    recordJob ? enqueueJob(provider, input) : null;

  const probleme = validateExternalBooking(external);

  if (probleme.length > 0) {
    const jobId = await protokolliere({
      direction: "INBOUND",
      operation: "BOOKING_IMPORT",
      status: "FAILED",
      externalRef: external.externalRef ?? null,
      messageId: external.messageId ?? null,
      lastError: probleme.join(" "),
    });

    return {
      status: "NEEDS_MAPPING",
      bookingId: null,
      bookingNumber: null,
      overbooked: false,
      jobId,
      message: probleme.join(" "),
    };
  }

  const hotel = await db.orm.hotel.Hotel.orderBy((h) => h.id.asc()).first();

  if (!hotel) throw new HttpError(503, "Es sind keine Hotel-Stammdaten vorhanden.");

  const mapping = await db.orm.hotel.ChannelMapping
    .where({ provider, externalRoomTypeId: external.externalRoomTypeId })
    .first();

  // Ohne bestaetigte Zuordnung wird nichts angelegt - und erst recht nicht
  // geraten, welche Kategorie gemeint sein koennte.
  if (!mapping || mapping.syncStatus !== "CONFIRMED") {
    const grund = mapping
      ? `Die Zuordnung der externen Zimmerart „${external.externalRoomTypeId}“ ist nicht bestätigt.`
      : `Für die externe Zimmerart „${external.externalRoomTypeId}“ ist keine Zuordnung hinterlegt.`;

    const jobId = await protokolliere({
      direction: "INBOUND",
      operation: "BOOKING_IMPORT",
      status: "NEEDS_MAPPING",
      externalRef: external.externalRef,
      messageId: external.messageId ?? null,
      payload: {
        externalRoomTypeId: external.externalRoomTypeId,
        externalRatePlanId: external.externalRatePlanId,
        checkIn: external.checkIn,
        checkOut: external.checkOut,
        adults: external.adults,
        children: external.children ?? 0,
        guestLastName: external.guest.lastName,
      },
      lastError: grund,
    });

    return {
      status: "NEEDS_MAPPING",
      bookingId: null,
      bookingNumber: null,
      overbooked: false,
      jobId,
      message: grund,
    };
  }

  const source: BookingSource = (BOOKING_SOURCES as readonly string[]).includes(
    external.source
  )
    ? (external.source as BookingSource)
    : "OTHER";

  const vorhanden = await db.orm.hotel.Booking
    .where({ externalChannel: provider, externalBookingId: external.externalRef })
    .first();

  // --- Storno -------------------------------------------------------------
  if (external.status === "CANCELLED") {
    if (!vorhanden) {
      const grund = "Storno zu einer Reservierung, die hier nicht bekannt ist.";

      const jobId = await protokolliere({
        direction: "INBOUND",
        operation: "BOOKING_CANCEL",
        status: "ATTENTION",
        externalRef: external.externalRef,
        messageId: external.messageId ?? null,
        lastError: grund,
      });

      return {
        status: "UNKNOWN_REFERENCE",
        bookingId: null,
        bookingNumber: null,
        overbooked: false,
        jobId,
        message: grund,
      };
    }

    if (vorhanden.status !== "CANCELLED") {
      await db.orm.hotel.Booking.where({ id: vorhanden.id }).update({
        status: "CANCELLED",
        cancelledAt: nowInstant(),
        updatedAt: nowInstant(),
      });
    }

    const jobId = await protokolliere({
      direction: "INBOUND",
      operation: "BOOKING_CANCEL",
      status: "DONE",
      bookingId: vorhanden.id,
      externalRef: external.externalRef,
      messageId: external.messageId ?? null,
    });

    return {
      status: "CANCELLED",
      bookingId: vorhanden.id,
      bookingNumber: vorhanden.bookingNumber,
      overbooked: false,
      jobId,
      message: null,
    };
  }

  // --- Erneuter Eingang derselben Reservierung -----------------------------
  if (vorhanden && external.status === "NEW") {
    const jobId = await protokolliere({
      direction: "INBOUND",
      operation: "BOOKING_IMPORT",
      status: "DONE",
      bookingId: vorhanden.id,
      externalRef: external.externalRef,
      messageId: external.messageId ?? null,
      lastError: "Bereits bekannt – es wurde keine zweite Buchung angelegt.",
    });

    return {
      status: "DUPLICATE",
      bookingId: vorhanden.id,
      bookingNumber: vorhanden.bookingNumber,
      overbooked: false,
      jobId,
      message: "Diese Reservierung war bereits bekannt.",
    };
  }

  const naechte = nightsBetween(external.checkIn, external.checkOut);
  const personen = external.adults + (external.children ?? 0);
  const gesamtCents = external.totalAmount ? toCents(external.totalAmount) : 0;

  // Reicht der Bestand? Die Antwort entscheidet NICHT ueber die Uebernahme,
  // sondern nur darueber, ob gewarnt wird.
  const platz = await categoryHasRoom(
    hotel.id,
    mapping.roomTypeId,
    external.checkIn,
    external.checkOut
  );

  const ueberbuchung = !platz.fits;

  const checkIn = Temporal.PlainDate.from(external.checkIn);
  const checkOut = Temporal.PlainDate.from(external.checkOut);

  const ergebnis = await db.transaction(async (tx) => {
    // Zeilensperre: Eine gleichzeitige Direktbuchung kann sich nicht
    // dazwischendraengen.
    await tx.orm.hotel.Hotel.where({ id: hotel.id }).update({ updatedAt: nowInstant() });

    const roomType = await tx.orm.hotel.RoomType.first({ id: mapping.roomTypeId });

    if (!roomType) {
      throw new HttpError(409, "Die zugeordnete Zimmerart existiert nicht mehr.");
    }

    const ratePlan = mapping.ratePlanId
      ? await tx.orm.hotel.RatePlan.first({ id: mapping.ratePlanId })
      : null;

    const gast = await findeOderLegeGastAn(tx as unknown as typeof db, external.guest, provider);

    const hinweis = ueberbuchung
      ? `Überbuchung: Am ${platz.tightestDate} war die Kategorie bereits voll belegt.`
      : null;

    // --- Aenderung einer bekannten Reservierung ---------------------------
    if (vorhanden) {
      await tx.orm.hotel.Booking.where({ id: vorhanden.id }).update({
        status: vorhanden.status === "CANCELLED" ? "CONFIRMED" : vorhanden.status,
        checkIn,
        checkOut,
        adults: external.adults,
        children: external.children ?? 0,
        roomsTotal: money(fromCents(gesamtCents)),
        totalAmount: money(fromCents(gesamtCents)),
        internalNote: hinweis,
        updatedAt: nowInstant(),
      });

      const positionen = await tx.orm.hotel.BookingRoom
        .where({ bookingId: vorhanden.id })
        .select("id", "roomId")
        .all();

      for (const position of positionen) {
        // Eine bestehende Zimmerzuweisung kann durch die neuen Daten
        // unzulaessig geworden sein. Sie wird dann entfernt, statt eine
        // falsche Belegung zu behalten.
        await tx.orm.hotel.BookingRoom.where({ id: position.id }).update({
          roomTypeId: mapping.roomTypeId,
          ratePlanId: mapping.ratePlanId,
          roomId: null,
          checkIn,
          checkOut,
          adults: external.adults,
          children: external.children ?? 0,
          totalAmount: money(fromCents(gesamtCents)),
          guestName: `${external.guest.firstName ?? ""} ${external.guest.lastName}`.trim(),
        });

        for (const nacht of await tx.orm.hotel.BookingRoomNight
          .where({ bookingRoomId: position.id })
          .select("id")
          .all()) {
          await tx.orm.hotel.BookingRoomNight.where({ id: nacht.id }).delete();
        }

        const betraege = verteileBetrag(gesamtCents, naechte);

        for (let index = 0; index < naechte; index++) {
          await tx.orm.hotel.BookingRoomNight.create({
            bookingRoomId: position.id,
            date: checkIn.add({ days: index }),
            amount: money(fromCents(betraege[index])),
            occupancySnapshot: personen,
          });
        }
      }

      return { id: vorhanden.id, nummer: vorhanden.bookingNumber, neu: false };
    }

    // --- Neue Reservierung -----------------------------------------------
    let booking = null as Awaited<ReturnType<typeof tx.orm.hotel.Booking.create>> | null;

    for (let versuch = 0; versuch < 5 && !booking; versuch++) {
      try {
        booking = await tx.orm.hotel.Booking.create({
          hotelId: hotel.id,
          bookingNumber: bookingNumber(),
          guestId: gast.id,
          status: "CONFIRMED",
          source,
          externalChannel: provider,
          externalBookingId: external.externalRef,
          checkIn,
          checkOut,
          adults: external.adults,
          children: external.children ?? 0,
          currency: external.currency?.trim().toUpperCase() || hotel.currency,
          roomsTotal: money(fromCents(gesamtCents)),
          extrasTotal: money("0.00"),
          discountTotal: money("0.00"),
          totalAmount: money(fromCents(gesamtCents)),
          // Die Zahlung regelt der Kanal nach seinen eigenen Bedingungen.
          paymentStatus: "NOT_REQUIRED",
          paymentMethod: "PAY_AT_HOTEL",
          // Die Stornobedingungen des Kanals gelten; unsere eigene
          // Richtlinie wird hier bewusst NICHT eingefroren.
          guestMessage: external.note,
          internalNote: hinweis,
        });
      } catch (error) {
        if (versuch === 4) throw error;
      }
    }

    if (!booking) {
      throw new HttpError(500, "Die externe Reservierung konnte nicht angelegt werden.");
    }

    const bookingRoom = await tx.orm.hotel.BookingRoom.create({
      bookingId: booking.id,
      roomTypeId: mapping.roomTypeId,
      ratePlanId: mapping.ratePlanId,
      bedType: null,
      checkIn,
      checkOut,
      adults: external.adults,
      children: external.children ?? 0,
      pricingModeSnapshot: roomType.pricingMode,
      mealPlanSnapshot: ratePlan?.mealPlan ?? "ROOM_ONLY",
      totalAmount: money(fromCents(gesamtCents)),
      guestName: `${external.guest.firstName ?? ""} ${external.guest.lastName}`.trim(),
      note: `Reservierung ${external.externalRef} aus Kanal ${provider}.`,
    });

    const betraege = verteileBetrag(gesamtCents, naechte);

    for (let index = 0; index < naechte; index++) {
      await tx.orm.hotel.BookingRoomNight.create({
        bookingRoomId: bookingRoom.id,
        date: checkIn.add({ days: index }),
        amount: money(fromCents(betraege[index])),
        occupancySnapshot: personen,
      });
    }

    await tx.orm.hotel.BookingRoomGuest.create({
      bookingRoomId: bookingRoom.id,
      guestId: gast.id,
      isPrimary: true,
    });

    return { id: booking.id, nummer: booking.bookingNumber, neu: true };
  });

  const jobId = await protokolliere({
    direction: "INBOUND",
    operation: ergebnis.neu ? "BOOKING_IMPORT" : "BOOKING_CHANGE",
    status: ueberbuchung ? "ATTENTION" : "DONE",
    bookingId: ergebnis.id,
    externalRef: external.externalRef,
    messageId: external.messageId ?? null,
    lastError: ueberbuchung
      ? `Überbuchung: Am ${platz.tightestDate} war die Kategorie bereits voll belegt. Bitte Zimmer prüfen.`
      : null,
  });

  return {
    status: ergebnis.neu ? "CREATED" : "UPDATED",
    bookingId: ergebnis.id,
    bookingNumber: ergebnis.nummer,
    overbooked: ueberbuchung,
    jobId,
    message: ueberbuchung ? "Die Kategorie war im Zeitraum bereits voll belegt." : null,
  };
}
