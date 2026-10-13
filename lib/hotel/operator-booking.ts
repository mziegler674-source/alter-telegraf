import "server-only";
import "temporal-polyfill/full/global";

import { Temporal } from "temporal-polyfill";

import { HttpError, nowInstant } from "@/lib/admin-api";
import {
  type AllocDemand,
  type AllocRoom,
  assignmentProblem,
  availableForRequest,
} from "@/lib/hotel/allocation";
import { type BedType, BED_TYPES } from "@/lib/hotel/availability";
import { bookingNumber } from "@/lib/hotel/booking-number";
import {
  loadBlocks,
  loadDemands,
  loadPricingContext,
  loadRatePriceRows,
  quoteOffer,
  todayInHotelTimezone,
} from "@/lib/hotel/booking-service";
import { enqueueAvailabilityForBooking } from "@/lib/hotel/channel/sync";
import {
  type BookingSource,
  EXTERNAL_SOURCES,
  OPERATOR_SOURCES,
} from "@/lib/hotel/constants";
import {
  GUEST_REQUIRED_OPERATOR,
  cleanGuest,
  firstError,
  validateGuest,
} from "@/lib/hotel/guest-validation";
import { categoryHasRoom } from "@/lib/hotel/inventory";
import { fromCents, nightsBetween, toCents } from "@/lib/hotel/pricing";
import {
  type NightPrice,
  resolveNightPrices,
  stayNights,
} from "@/lib/hotel/rate-calendar";
import { db } from "@/prisma/db";

import type { Numeric } from "@prisma/orm-postgres/target/codec-types";

const money = (value: string) => value as unknown as Numeric<10, 2>;

// Buchungen, die der Betrieb selbst erfasst: Telefon, E-Mail, spontan vor
// Ort - und Reservierungen, die per Mail von einem Portal kommen, solange
// keine automatische Anbindung freigegeben ist.
//
// Diese Erfassung verwendet DIESELBE Verfuegbarkeitsrechnung wie die
// oeffentliche Buchungsstrecke und laeuft unter derselben Zeilensperre. Es
// gibt keinen zweiten Weg, der am Bestand vorbei bucht.
//
// Ein bewusster Unterschied: Der Betrieb darf eine Ueberbuchung erzwingen
// (allowOverbooking). Wer am Telefon eine Zusage gegeben hat, muss sie
// erfassen koennen. Sie wird dann als solche gekennzeichnet, nicht
// verschwiegen.

export type OperatorGuest = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
};

export type OperatorBookingInput = {
  source: BookingSource;
  /** Reservierungsnummer des Portals, falls vorhanden. */
  externalRef: string | null;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  breakfast: boolean;
  roomTypeId: number;
  /** Gewuenschte Bettart, oder null wenn gleichgueltig. */
  bedType: BedType | null;
  /** Direkt zuzuweisendes Zimmer, oder null. */
  roomId: number | null;
  guest: OperatorGuest;
  /** Gesamtbetrag als Dezimaltext. Leer bedeutet: aus den Preisen rechnen. */
  totalAmount: string | null;
  note: string | null;
  allowOverbooking: boolean;
};

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

export function parseOperatorBooking(raw: Record<string, unknown>): OperatorBookingInput {
  const source = String(raw.source ?? "");

  if (!(OPERATOR_SOURCES as readonly string[]).includes(source)) {
    throw new HttpError(400, "Bitte eine gültige Buchungsquelle wählen.");
  }

  const checkIn = String(raw.checkIn ?? "");
  const checkOut = String(raw.checkOut ?? "");

  if (!DATUM.test(checkIn) || !DATUM.test(checkOut)) {
    throw new HttpError(400, "Bitte Anreise und Abreise angeben.");
  }

  let naechte: number;

  try {
    naechte = nightsBetween(checkIn, checkOut);
  } catch {
    throw new HttpError(400, "Die Datumsangaben sind ungültig.");
  }

  if (naechte < 1) throw new HttpError(400, "Die Abreise muss nach der Anreise liegen.");
  if (naechte > 365) throw new HttpError(400, "Bitte höchstens 365 Nächte erfassen.");

  const adults = Number(raw.adults);
  const children = Number(raw.children ?? 0);

  if (!Number.isInteger(adults) || adults < 1 || adults > 20) {
    throw new HttpError(400, "Die Anzahl der Erwachsenen ist ungültig.");
  }

  if (!Number.isInteger(children) || children < 0 || children > 20) {
    throw new HttpError(400, "Die Anzahl der Kinder ist ungültig.");
  }

  const roomTypeId = Number(raw.roomTypeId);

  if (!Number.isInteger(roomTypeId) || roomTypeId < 1) {
    throw new HttpError(400, "Bitte eine Zimmerart wählen.");
  }

  const bedTypeRaw = String(raw.bedType ?? "").trim();

  if (bedTypeRaw && !(BED_TYPES as readonly string[]).includes(bedTypeRaw)) {
    throw new HttpError(400, "Die Bettart ist ungültig.");
  }

  const roomIdRaw = raw.roomId;
  const roomId =
    roomIdRaw === null || roomIdRaw === undefined || roomIdRaw === "" ? null : Number(roomIdRaw);

  if (roomId !== null && (!Number.isInteger(roomId) || roomId < 1)) {
    throw new HttpError(400, "Das Zimmer ist ungültig.");
  }

  // Gastangaben mit derselben Pruefung wie die oeffentliche Strecke, nur mit
  // weniger Pflichtfeldern: Am Telefon liegt oft nur der Name vor.
  const gast = (raw.guest ?? {}) as Record<string, unknown>;

  const gastEingabe = {
    firstName: typeof gast.firstName === "string" ? gast.firstName : null,
    lastName: typeof gast.lastName === "string" ? gast.lastName : null,
    email: typeof gast.email === "string" ? gast.email : null,
    phone: typeof gast.phone === "string" ? gast.phone : null,
    street: typeof gast.street === "string" ? gast.street : null,
    postalCode: typeof gast.postalCode === "string" ? gast.postalCode : null,
    city: typeof gast.city === "string" ? gast.city : null,
    countryCode: typeof gast.countryCode === "string" ? gast.countryCode : null,
  };

  const gastFehler = validateGuest(gastEingabe, GUEST_REQUIRED_OPERATOR);
  const ersterFehler = firstError(gastFehler);

  if (ersterFehler) {
    throw new HttpError(400, ersterFehler.message, {
      fieldErrors: gastFehler,
      field: ersterFehler.field,
    });
  }

  const sauberer = cleanGuest(gastEingabe);

  const betragRaw = String(raw.totalAmount ?? "").trim();

  if (betragRaw) {
    try {
      toCents(betragRaw.replace(",", "."));
    } catch {
      throw new HttpError(400, "Der Betrag ist keine gültige Zahl.");
    }
  }

  const externalRef = String(raw.externalRef ?? "").trim();

  if (externalRef.length > 80) {
    throw new HttpError(400, "Die externe Referenz ist zu lang.");
  }

  return {
    source: source as BookingSource,
    externalRef: externalRef || null,
    checkIn,
    checkOut,
    adults,
    children,
    breakfast: raw.breakfast === true,
    roomTypeId,
    bedType: (bedTypeRaw || null) as BedType | null,
    roomId,
    guest: {
      firstName: sauberer.firstName,
      lastName: sauberer.lastName,
      email: sauberer.email || null,
      phone: sauberer.phone || null,
      street: sauberer.street || null,
      postalCode: sauberer.postalCode || null,
      city: sauberer.city || null,
      countryCode: sauberer.countryCode || null,
    },
    totalAmount: betragRaw ? betragRaw.replace(",", ".") : null,
    note: String(raw.note ?? "").trim() || null,
    allowOverbooking: raw.allowOverbooking === true,
  };
}

export type OperatorBookingResult = {
  bookingId: number;
  bookingNumber: string;
  totalAmount: string;
  overbooked: boolean;
  assignedRoomNumber: string | null;
  warning: string | null;
};

export async function createOperatorBooking(
  input: OperatorBookingInput
): Promise<OperatorBookingResult> {
  const hotel = await db.orm.hotel.Hotel.orderBy((h) => h.id.asc()).first();

  if (!hotel) throw new HttpError(409, "Bitte zuerst die Hotel-Stammdaten speichern.");

  const naechte = nightsBetween(input.checkIn, input.checkOut);
  const personen = input.adults + input.children;

  const roomType = await db.orm.hotel.RoomType.first({
    id: input.roomTypeId,
    hotelId: hotel.id,
  });

  if (!roomType) throw new HttpError(400, "Unbekannte Zimmerart.");

  if (roomType.maxOccupancy < personen) {
    throw new HttpError(
      400,
      `${roomType.name} ist für höchstens ${roomType.maxOccupancy} Person(en) ausgelegt.`
    );
  }

  // Eine externe Referenz darf nur einmal vorkommen - dieselbe Idempotenz
  // wie bei der automatischen Uebernahme.
  const externalChannel =
    input.externalRef && (EXTERNAL_SOURCES as readonly string[]).includes(input.source)
      ? input.source
      : null;

  if (externalChannel && input.externalRef) {
    const doppelt = await db.orm.hotel.Booking
      .where({ externalChannel, externalBookingId: input.externalRef })
      .select("bookingNumber")
      .first();

    if (doppelt) {
      throw new HttpError(
        409,
        `Diese externe Referenz ist bereits als Buchung ${doppelt.bookingNumber} erfasst.`
      );
    }
  }

  // Preis: entweder vorgegeben oder aus den hinterlegten Preisen gerechnet -
  // mit derselben Funktion und denselben Tagespreisen wie die oeffentliche
  // Buchungsstrecke.
  const context = await loadPricingContext(hotel.id);

  const priceRows = await loadRatePriceRows(
    context.ratePlan.id,
    input.checkIn,
    input.checkOut
  );

  const nightPrices = resolveNightPrices({
    nights: stayNights(input.checkIn, input.checkOut),
    rows: priceRows,
    roomTypeId: input.roomTypeId,
    occupancy: personen,
  });

  let gesamt: string;
  let zimmerAnteil: string;
  let fruehstueckAnteil = "0.00";
  let rabatt = "0.00";
  // Preis je Nacht fuer die Buchungszeilen. Bei manuell vorgegebenem
  // Gesamtbetrag gibt es keine Tagespreise - dann wird gleichmaessig
  // verteilt und die Buchung als manuell gekennzeichnet.
  let naechtePreise: NightPrice[] | null = nightPrices;

  if (input.totalAmount) {
    gesamt = fromCents(toCents(input.totalAmount));
    zimmerAnteil = gesamt;
    naechtePreise = null;
  } else {
    if (!nightPrices) {
      throw new HttpError(
        400,
        `Für ${roomType.name} und ${personen} Person(en) ist für diesen Zeitraum kein Preis hinterlegt. Bitte einen Betrag angeben.`
      );
    }

    const angebot = quoteOffer({
      nights: naechte,
      nightPrices,
      persons: personen,
      breakfast: input.breakfast,
      breakfastPrice: context.breakfast ? String(context.breakfast.price) : null,
      promotions: context.promotions,
      roomTypeId: input.roomTypeId,
      ratePlanId: context.ratePlan.id,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      bookedOn: todayInHotelTimezone(hotel.timezone),
    });

    gesamt = angebot.totals.total;
    zimmerAnteil = angebot.totals.roomsTotal;
    fruehstueckAnteil = angebot.totals.breakfastTotal;
    rabatt = angebot.totals.discountTotal;
  }

  const platz = await categoryHasRoom(
    hotel.id,
    input.roomTypeId,
    input.checkIn,
    input.checkOut
  );

  if (!platz.fits && !input.allowOverbooking) {
    throw new HttpError(
      409,
      `${roomType.name} ist am ${platz.tightestDate} ausgebucht. Erfassung nur mit ausdrücklicher Überbuchung möglich.`
    );
  }

  const checkIn = Temporal.PlainDate.from(input.checkIn);
  const checkOut = Temporal.PlainDate.from(input.checkOut);

  const ergebnis = await db.transaction(async (tx) => {
    // Dieselbe Zeilensperre wie in der oeffentlichen Buchungsstrecke: Eine
    // gleichzeitige Direktbuchung und diese Erfassung koennen nicht beide
    // dasselbe letzte Zimmer bekommen.
    await tx.orm.hotel.Hotel.where({ id: hotel.id }).update({ updatedAt: nowInstant() });

    const [rooms, demands, blocks] = await Promise.all([
      db.orm.hotel.Room
        .where({ hotelId: hotel.id })
        .select("id", "number", "roomTypeId", "bedType", "maxOccupancy", "active", "status")
        .all(),
      loadDemands(input.checkIn, input.checkOut),
      loadBlocks(input.checkIn, input.checkOut),
    ]);

    const allocRooms: AllocRoom[] = rooms;

    // Erneute Pruefung unter der Sperre.
    if (!input.allowOverbooking) {
      const frei = availableForRequest({
        rooms: allocRooms,
        demands,
        blocks,
        request: {
          roomTypeId: input.roomTypeId,
          persons: personen,
          bedType: input.bedType,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
        },
      });

      if (frei < 1) {
        throw new HttpError(
          409,
          `${roomType.name} ist im gewählten Zeitraum nicht mehr verfügbar.`
        );
      }
    }

    const bestehenderGast = input.guest.email
      ? await tx.orm.hotel.Guest.where({ email: input.guest.email }).first()
      : null;

    const gast =
      bestehenderGast ??
      (await tx.orm.hotel.Guest.create({
        firstName: input.guest.firstName,
        lastName: input.guest.lastName,
        email: input.guest.email,
        phone: input.guest.phone,
        street: input.guest.street,
        postalCode: input.guest.postalCode,
        city: input.guest.city,
        countryCode: input.guest.countryCode,
      }));

    const hinweise: string[] = [];

    // Ein von Hand gesetzter Gesamtbetrag ist nicht aus den Preisen
    // gerechnet. Das muss an der Buchung erkennbar sein.
    if (input.totalAmount) {
      hinweise.push(`Manuell vorgegebener Gesamtbetrag: ${gesamt}.`);
    }

    if (!platz.fits) {
      hinweise.push(
        `Bewusste Überbuchung: Am ${platz.tightestDate} war die Kategorie bereits voll belegt.`
      );
    }

    if (input.note) hinweise.push(input.note);

    let booking = null as Awaited<ReturnType<typeof tx.orm.hotel.Booking.create>> | null;

    for (let versuch = 0; versuch < 5 && !booking; versuch++) {
      try {
        booking = await tx.orm.hotel.Booking.create({
          hotelId: hotel.id,
          bookingNumber: bookingNumber(),
          guestId: gast.id,
          status: "CONFIRMED",
          source: input.source,
          externalChannel,
          externalBookingId: externalChannel ? input.externalRef : null,
          checkIn,
          checkOut,
          adults: input.adults,
          children: input.children,
          currency: hotel.currency,
          roomsTotal: money(zimmerAnteil),
          extrasTotal: money(fruehstueckAnteil),
          discountTotal: money(rabatt),
          totalAmount: money(gesamt),
          paymentStatus: "NOT_REQUIRED",
          paymentMethod: "PAY_AT_HOTEL",
          internalNote: hinweise.length > 0 ? hinweise.join(" ") : null,
        });
      } catch (error) {
        if (versuch === 4) throw error;
      }
    }

    if (!booking) throw new HttpError(500, "Die Buchung konnte nicht angelegt werden.");

    const bookingRoom = await tx.orm.hotel.BookingRoom.create({
      bookingId: booking.id,
      roomTypeId: roomType.id,
      ratePlanId: context.ratePlan.id,
      bedType: input.bedType,
      checkIn,
      checkOut,
      adults: input.adults,
      children: input.children,
      pricingModeSnapshot: roomType.pricingMode,
      mealPlanSnapshot: input.breakfast ? "BREAKFAST" : "ROOM_ONLY",
      totalAmount: money(zimmerAnteil),
      guestName: `${input.guest.firstName} ${input.guest.lastName}`,
    });

    // Preis je Nacht einfrieren: entweder der fuer die Nacht gueltige
    // Tagespreis oder, bei manuellem Gesamtbetrag, der gleichmaessig
    // verteilte Anteil (Rest auf die letzte Nacht).
    const proNacht = toCents(zimmerAnteil);
    const grund = Math.floor(proNacht / naechte);
    const rest = proNacht - grund * naechte;

    for (let index = 0; index < naechte; index++) {
      const tagespreis = naechtePreise?.[index]?.amount;

      await tx.orm.hotel.BookingRoomNight.create({
        bookingRoomId: bookingRoom.id,
        date: checkIn.add({ days: index }),
        amount: money(
          tagespreis ?? fromCents(index === naechte - 1 ? grund + rest : grund)
        ),
        occupancySnapshot: personen,
      });
    }

    await tx.orm.hotel.BookingRoomGuest.create({
      bookingRoomId: bookingRoom.id,
      guestId: gast.id,
      isPrimary: true,
    });

    // Optionale Zimmerzuweisung, mit derselben Pruefung wie im
    // Buchungsdetail.
    let zimmerNummer: string | null = null;

    if (input.roomId !== null) {
      const zimmer = allocRooms.find((raum) => raum.id === input.roomId);

      if (!zimmer) throw new HttpError(400, "Das gewählte Zimmer existiert nicht.");

      const demand: AllocDemand = {
        key: String(bookingRoom.id),
        roomTypeId: roomType.id,
        persons: personen,
        bedType: input.bedType,
        roomId: null,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
      };

      const problem = assignmentProblem(zimmer, demand, demands, blocks);

      if (problem) {
        throw new HttpError(
          409,
          `Zimmer ${zimmer.number} lässt sich dieser Buchung nicht zuweisen (${problem.kind}).`
        );
      }

      await tx.orm.hotel.BookingRoom.where({ id: bookingRoom.id }).update({
        roomId: zimmer.id,
      });

      zimmerNummer = zimmer.number;
    }

    return {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      zimmerNummer,
    };
  });

  // Erst nach dem Festschreiben: Der Kanal wird informiert, falls einer
  // eingerichtet ist. Ein Fehler dabei aendert an der Buchung nichts.
  await enqueueAvailabilityForBooking(ergebnis.bookingId);

  return {
    bookingId: ergebnis.bookingId,
    bookingNumber: ergebnis.bookingNumber,
    totalAmount: gesamt,
    overbooked: !platz.fits,
    assignedRoomNumber: ergebnis.zimmerNummer,
    warning: !platz.fits
      ? `Diese Buchung ist eine Überbuchung: Am ${platz.tightestDate} war die Kategorie voll belegt.`
      : null,
  };
}
