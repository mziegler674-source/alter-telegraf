import "server-only";
import "temporal-polyfill/full/global";

import { Temporal } from "temporal-polyfill";

import { HttpError, nowInstant } from "@/lib/admin-api";
import {
  type BedType,
  BED_TYPES,
  BED_TYPE_LABELS,
  offersForOccupancy,
} from "@/lib/hotel/availability";
import {
  type PolicyLike,
  type PolicySnapshot,
  buildPolicySnapshot,
  describePolicy,
} from "@/lib/hotel/cancellation";
import {
  type RoomAmenity,
  type RoomImage,
  loadRoomPresentations,
} from "@/lib/hotel/rooms";
import {
  BREAKFAST_SERVICE_CODE,
  type DiscountTier,
  LONG_STAY_CODE_PREFIX,
  calculateStay,
  nightsBetween,
  toCents,
} from "@/lib/hotel/pricing";
import {
  guaranteeRequirement,
  paymentProviderName,
  verifyCardSetup,
} from "@/lib/hotel/payment/guarantee";
import { todayInHotelTimezone } from "@/lib/hotel/time";
import { db } from "@/prisma/db";

export { todayInHotelTimezone };

import type { Numeric } from "@prisma/orm-postgres/target/codec-types";

const money = (value: string) => value as unknown as Numeric<10, 2>;

// Diese Status belegen ein Zimmer. Storniert und No-Show nicht.
export const BLOCKING_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Die hinterlegte Stornierungsrichtlinie des Rate Plans, oder null. */
async function loadCancellationPolicy(ratePlanId: number): Promise<PolicyLike | null> {
  const plan = await db.orm.hotel.RatePlan
    .where({ id: ratePlanId })
    .select("cancellationPolicyId")
    .first();

  if (!plan?.cancellationPolicyId) return null;

  const policy = await db.orm.hotel.CancellationPolicy
    .where({ id: plan.cancellationPolicyId, active: true })
    .select("code", "name", "description", "noShowFeePercent")
    .include("rules", (r) =>
      r.select("appliesFromDaysBefore", "basis", "feePercent", "feeAmount")
    )
    .first();

  if (!policy) return null;

  return {
    code: policy.code,
    name: policy.name,
    description: policy.description,
    noShowFeePercent: policy.noShowFeePercent === null ? null : String(policy.noShowFeePercent),
    rules: policy.rules
      .map((rule) => ({
        appliesFromDaysBefore: rule.appliesFromDaysBefore,
        basis: rule.basis,
        feePercent: rule.feePercent === null ? null : String(rule.feePercent),
        feeAmount: rule.feeAmount === null ? null : String(rule.feeAmount),
      }))
      .sort((a, b) => a.appliesFromDaysBefore - b.appliesFromDaysBefore),
  };
}

export type StayQuery = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  breakfast: boolean;
};

export function parseStayQuery(raw: Record<string, unknown>): StayQuery {
  const checkIn = String(raw.checkIn ?? "");
  const checkOut = String(raw.checkOut ?? "");

  if (!DATE_PATTERN.test(checkIn) || !DATE_PATTERN.test(checkOut)) {
    throw new HttpError(400, "Bitte Anreise und Abreise angeben.");
  }

  let nights: number;

  try {
    nights = nightsBetween(checkIn, checkOut);
  } catch {
    throw new HttpError(400, "Die Datumsangaben sind ungültig.");
  }

  if (nights < 1) {
    throw new HttpError(400, "Die Abreise muss nach der Anreise liegen.");
  }

  if (nights > 60) {
    throw new HttpError(400, "Bitte wählen Sie höchstens 60 Nächte.");
  }

  const adults = Number(raw.adults);
  const children = Number(raw.children ?? 0);

  if (!Number.isInteger(adults) || adults < 1) {
    throw new HttpError(400, "Es muss mindestens eine erwachsene Person reisen.");
  }

  if (!Number.isInteger(children) || children < 0 || children > 6) {
    throw new HttpError(400, "Die Anzahl der Kinder ist ungültig.");
  }

  return { checkIn, checkOut, adults, children, breakfast: raw.breakfast === true };
}

async function requireHotelRow() {
  const hotel = await db.orm.hotel.Hotel.orderBy((h) => h.id.asc()).first();

  if (!hotel) {
    throw new HttpError(503, "Die Online-Buchung ist derzeit nicht verfügbar.");
  }

  return hotel;
}

async function loadPricingContext(hotelId: number) {
  const ratePlan =
    (await db.orm.hotel.RatePlan.first({ hotelId, code: "STANDARD_OHNE_FRUEHSTUECK" })) ??
    (await db.orm.hotel.RatePlan.where({ hotelId, mealPlan: "ROOM_ONLY" }).first());

  if (!ratePlan) {
    throw new HttpError(503, "Die Online-Buchung ist derzeit nicht verfügbar.");
  }

  const [prices, breakfast, promotions, cancellationPolicy] = await Promise.all([
    db.orm.hotel.RatePrice
      .where({ ratePlanId: ratePlan.id })
      .where((p) => p.date.isNull())
      .select("roomTypeId", "occupancy", "amount")
      .all(),
    db.orm.hotel.ServiceItem.first({ hotelId, code: BREAKFAST_SERVICE_CODE }),
    db.orm.hotel.Promotion
      .where({ hotelId, type: "BASIC", active: true })
      .select("code", "minStayNights", "discountPercent")
      .all(),
    loadCancellationPolicy(ratePlan.id),
  ]);

  const discountTiers: DiscountTier[] = promotions
    .filter((p) => p.code.startsWith(LONG_STAY_CODE_PREFIX) && p.minStayNights)
    .map((p) => ({ minNights: p.minStayNights as number, percent: Number(p.discountPercent) }));

  return {
    ratePlan,
    cancellationPolicy,
    prices: prices.map((p) => ({
      roomTypeId: p.roomTypeId,
      occupancy: p.occupancy,
      amount: String(p.amount),
    })),
    breakfast,
    discountTiers,
  };
}

// Belegte Zimmerplaetze im Zeitraum, aufgeschluesselt nach Kategorie und
// gewuenschter Bettart. Grundlage ist ausschliesslich BookingRoom - es wird
// kein zusaetzlicher Zaehler gefuehrt, der auseinanderlaufen koennte.
async function loadOccupied(checkIn: string, checkOut: string) {
  const from = Temporal.PlainDate.from(checkIn);
  const to = Temporal.PlainDate.from(checkOut);

  const overlapping = await db.orm.hotel.BookingRoom
    .where((r) => r.checkIn.lt(to))
    .where((r) => r.checkOut.gt(from))
    .select("id", "roomTypeId", "bedType")
    .include("booking", (b) => b.select("status"))
    .all();

  const blocking = overlapping.filter((row) =>
    (BLOCKING_STATUSES as readonly string[]).includes(String(row.booking.status))
  );

  const perCategory = new Map<number, number>();
  const perBedType = new Map<string, number>();

  for (const row of blocking) {
    perCategory.set(row.roomTypeId, (perCategory.get(row.roomTypeId) ?? 0) + 1);

    if (row.bedType) {
      const key = `${row.roomTypeId}-${row.bedType}`;
      perBedType.set(key, (perBedType.get(key) ?? 0) + 1);
    }
  }

  return { perCategory, perBedType, total: blocking.length };
}

export type StayOffer = {
  roomTypeId: number;
  code: string;
  name: string;
  slug: string;
  /** Kurztext fuer die Zimmerkarte. */
  description: string | null;
  /** Ausfuehrlicher Text fuer die Detailansicht. */
  longDescription: string | null;
  persons: number;
  maxOccupancy: number;
  sizeSqm: number | null;
  images: RoomImage[];
  amenities: RoomAmenity[];
  pricePerNight: string;
  roomsAvailable: number;
  bedTypes: { bedType: BedType; label: string; roomsAvailable: number }[];
  totals: ReturnType<typeof calculateStay>;
};

/**
 * Ein Aufenthalt darf nicht in der Vergangenheit beginnen. Geprueft wird in
 * der Zeitzone des Hotels: Was dort noch heute ist, bleibt buchbar. Diese
 * Pruefung gehoert auf den Server - das Feld im Browser traegt nur das
 * Mindestdatum und laesst sich umgehen.
 */
function assertNotInPast(checkIn: string, timezone: string) {
  const heute = todayInHotelTimezone(timezone);

  if (checkIn < heute) {
    throw new HttpError(400, "Die Anreise kann nicht in der Vergangenheit liegen.");
  }
}

export async function searchStay(query: StayQuery) {
  const hotel = await requireHotelRow();

  assertNotInPast(query.checkIn, hotel.timezone);

  const nights = nightsBetween(query.checkIn, query.checkOut);
  const persons = query.adults + query.children;

  const context = await loadPricingContext(hotel.id);

  const [roomTypes, rooms] = await Promise.all([
    db.orm.hotel.RoomType
      .where({ hotelId: hotel.id, active: true })
      .select("id", "code", "name", "description", "shortDescription", "active", "maxOccupancy", "pricingMode")
      .orderBy([(r) => r.sortOrder.asc(), (r) => r.name.asc()])
      .all(),
    db.orm.hotel.Room
      .where({ hotelId: hotel.id, active: true })
      .select("id", "number", "roomTypeId", "bedType", "maxOccupancy", "active")
      .all(),
  ]);

  const occupied = await loadOccupied(query.checkIn, query.checkOut);

  // Redaktionelle Daten fuer die Zimmerkarten. Sie beeinflussen Verfuegbarkeit
  // und Preis nicht, sondern ergaenzen nur die Darstellung.
  const presentations = await loadRoomPresentations(hotel.id);

  const breakfastPrice = context.breakfast ? String(context.breakfast.price) : null;

  const offers: StayOffer[] = [];

  for (const base of offersForOccupancy(roomTypes, rooms, context.prices, persons)) {
    const used = occupied.perCategory.get(base.roomTypeId) ?? 0;
    const roomsAvailable = base.rooms - used;

    if (roomsAvailable < 1) continue;

    const bedTypes = base.bedTypes
      .map((option) => ({
        bedType: option.bedType,
        label: option.label,
        roomsAvailable:
          option.rooms - (occupied.perBedType.get(`${base.roomTypeId}-${option.bedType}`) ?? 0),
      }))
      .filter((option) => option.roomsAvailable > 0);

    if (bedTypes.length === 0) continue;

    const roomType = roomTypes.find((r) => r.id === base.roomTypeId);
    const presentation = presentations.find((p) => p.roomTypeId === base.roomTypeId);

    offers.push({
      roomTypeId: base.roomTypeId,
      code: base.code,
      name: base.name,
      slug: presentation?.slug ?? base.code.toLowerCase(),
      description: roomType?.shortDescription ?? roomType?.description ?? null,
      longDescription: roomType?.description ?? null,
      persons,
      maxOccupancy: roomType?.maxOccupancy ?? persons,
      sizeSqm: presentation?.sizeSqm ?? null,
      images: presentation?.images ?? [],
      amenities: presentation?.amenities ?? [],
      pricePerNight: base.pricePerNight,
      roomsAvailable,
      bedTypes,
      totals: calculateStay({
        nights,
        pricePerNight: base.pricePerNight,
        breakfastPersons: query.breakfast && breakfastPrice ? persons : 0,
        breakfastPricePerPersonNight: breakfastPrice ?? "0",
        discountTiers: context.discountTiers,
      }),
    });
  }

  return {
    checkIn: query.checkIn,
    checkOut: query.checkOut,
    nights,
    adults: query.adults,
    children: query.children,
    persons,
    breakfast: query.breakfast,
    breakfastPricePerPersonNight: breakfastPrice,
    discountTiers: context.discountTiers,
    // Die Stornobedingungen stammen aus der aktiven Richtlinie. Ändert der
    // Betrieb sie, ändert sich dieser Text ohne Codeänderung mit.
    cancellation: context.cancellationPolicy
      ? {
          name: context.cancellationPolicy.name,
          text: describePolicy(context.cancellationPolicy),
        }
      : null,
    // Verlangt der Rate Plan eine Kartengarantie? Die Buchungsstrecke
    // blendet danach die Kartenerfassung ein.
    guarantee: await guaranteeRequirement(context.ratePlan.id),
    offers,
  };
}

export type GuestInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  countryCode: string;
  message: string | null;
};

function readText(raw: Record<string, unknown>, key: string, label: string, max: number, required = true) {
  const value = String(raw[key] ?? "").trim();

  if (!value) {
    if (required) throw new HttpError(400, `${label} ist erforderlich.`);
    return null;
  }

  if (value.length > max) {
    throw new HttpError(400, `${label} darf höchstens ${max} Zeichen haben.`);
  }

  return value;
}

export function parseGuest(raw: Record<string, unknown>): GuestInput {
  const email = readText(raw, "email", "E-Mail", 160) as string;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new HttpError(400, "Bitte eine gültige E-Mail-Adresse angeben.");
  }

  const phone = readText(raw, "phone", "Telefon", 40) as string;

  if (!/^\+?[0-9\s\-()/]{6,}$/.test(phone)) {
    throw new HttpError(400, "Bitte eine gültige Telefonnummer angeben.");
  }

  const countryCode = (readText(raw, "countryCode", "Land", 2) as string).toUpperCase();

  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw new HttpError(400, "Land muss ein zweistelliger Ländercode sein, z. B. AT.");
  }

  return {
    firstName: readText(raw, "firstName", "Vorname", 80) as string,
    lastName: readText(raw, "lastName", "Nachname", 80) as string,
    email,
    phone,
    street: readText(raw, "street", "Straße", 160) as string,
    postalCode: readText(raw, "postalCode", "PLZ", 12) as string,
    city: readText(raw, "city", "Ort", 80) as string,
    countryCode,
    message: readText(raw, "message", "Bemerkung", 1000, false),
  };
}

function bookingNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");

  return `AT-${year}-${random}`;
}

export type CreateBookingInput = {
  stay: StayQuery;
  roomTypeId: number;
  bedType: BedType;
  guest: GuestInput;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  /**
   * Referenz der Kartenhinterlegung beim Zahlungsanbieter. Wird nur
   * ausgewertet, wenn der Rate Plan eine Garantie verlangt. Der Server
   * prueft sie beim Anbieter nach, bevor eine Buchung entsteht.
   */
  cardSetupRef?: string | null;
};

export async function createBooking(input: CreateBookingInput) {
  if (!input.acceptedTerms || !input.acceptedPrivacy) {
    throw new HttpError(
      400,
      "Bitte bestätigen Sie die Buchungsbedingungen und die Datenschutzerklärung."
    );
  }

  if (!(BED_TYPES as readonly string[]).includes(input.bedType)) {
    throw new HttpError(400, "Bitte eine gültige Bettart wählen.");
  }

  const hotel = await requireHotelRow();

  assertNotInPast(input.stay.checkIn, hotel.timezone);

  const nights = nightsBetween(input.stay.checkIn, input.stay.checkOut);
  const persons = input.stay.adults + input.stay.children;
  const context = await loadPricingContext(hotel.id);

  // Ob eine Karte verlangt wird, entscheidet der Rate Plan - nicht der
  // Browser. Die Karte wird VOR dem Anlegen der Buchung geprueft: Schlaegt
  // die Pruefung fehl, entsteht gar keine Buchung.
  const garantie = await guaranteeRequirement(context.ratePlan.id);
  const karte = garantie.required ? await verifyCardSetup(input.cardSetupRef ?? "") : null;

  return db.transaction(async (tx) => {
    // Schreibzugriff auf die Hotelzeile: haelt eine exklusive Zeilensperre bis
    // zum Commit und serialisiert damit gleichzeitige Buchungsversuche.
    // Ohne das koennten zwei Anfragen dieselbe letzte Kapazitaet sehen.
    await tx.orm.hotel.Hotel.where({ id: hotel.id }).update({ updatedAt: nowInstant() });

    // Verfuegbarkeit unter der Sperre erneut pruefen - der Zustand kann sich
    // zwischen Suche und Absenden geaendert haben.
    //
    // Die Pruefung liest ueber `db`, also ausserhalb dieser Transaktion. Das
    // ist hier korrekt: Dank der Sperre ist jeder konkurrierende Versuch
    // entweder schon vor uns festgeschrieben und damit sichtbar, oder er
    // wartet noch und schreibt erst nach unserem Commit.
    const fresh = await searchStay(input.stay);
    const offer = fresh.offers.find((o) => o.roomTypeId === input.roomTypeId);

    if (!offer) {
      throw new HttpError(409, "Diese Zimmerart ist für den gewählten Zeitraum nicht mehr verfügbar.");
    }

    const bedOption = offer.bedTypes.find((b) => b.bedType === input.bedType);

    if (!bedOption) {
      throw new HttpError(409, "Diese Bettart ist für den gewählten Zeitraum nicht mehr verfügbar.");
    }

    // Preis ausschliesslich aus der Serverberechnung, nie aus dem Frontend.
    const totals = offer.totals;

    const existingGuest = await tx.orm.hotel.Guest
      .where({ email: input.guest.email })
      .first();

    const guest =
      existingGuest ??
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

    const roomType = await tx.orm.hotel.RoomType.first({ id: input.roomTypeId, hotelId: hotel.id });

    if (!roomType) {
      throw new HttpError(400, "Unbekannte Zimmerart.");
    }

    const checkIn = Temporal.PlainDate.from(input.stay.checkIn);
    const checkOut = Temporal.PlainDate.from(input.stay.checkOut);
    const mealPlan = input.stay.breakfast ? "BREAKFAST" : "ROOM_ONLY";

    // Die zum Buchungszeitpunkt gültige Stornierungsbedingung wird
    // eingefroren. Ändert der Betrieb die Richtlinie später, gilt für diese
    // Buchung weiterhin der hier gespeicherte Stand.
    const snapshot: PolicySnapshot | null = context.cancellationPolicy
      ? buildPolicySnapshot(context.cancellationPolicy, {
          checkIn: input.stay.checkIn,
          frozenAt: new Date().toISOString(),
        })
      : null;

    let booking = null as Awaited<ReturnType<typeof tx.orm.hotel.Booking.create>> | null;

    // Die Buchungsnummer ist eindeutig; bei einer Kollision neu versuchen.
    for (let attempt = 0; attempt < 5 && !booking; attempt++) {
      try {
        booking = await tx.orm.hotel.Booking.create({
          hotelId: hotel.id,
          bookingNumber: bookingNumber(),
          guestId: guest.id,
          status: "PENDING",
          source: "WEBSITE",
          checkIn,
          checkOut,
          adults: input.stay.adults,
          children: input.stay.children,
          currency: hotel.currency,
          roomsTotal: money(totals.roomsTotal),
          extrasTotal: money(totals.breakfastTotal),
          discountTotal: money(totals.discountTotal),
          totalAmount: money(totals.total),
          // Es werden ausschliesslich Referenzen des Anbieters gespeichert.
          // Kartennummer, Pruefziffer und Ablaufdatum erreichen diesen
          // Server nie.
          paymentStatus: karte ? "VERIFIED" : "NOT_REQUIRED",
          paymentMethod: karte ? "CARD_GUARANTEE" : "PAY_AT_HOTEL",
          paymentProvider: karte ? paymentProviderName() : null,
          paymentCustomerRef: karte?.customerRef ?? null,
          paymentMethodRef: karte?.methodRef ?? null,
          paymentAuthorizedAt: karte ? nowInstant() : null,
          cancellationPolicySnapshot: snapshot,
          guestMessage: input.guest.message,
        });
      } catch (error) {
        if (attempt === 4) throw error;
      }
    }

    if (!booking) {
      throw new HttpError(500, "Die Buchung konnte nicht angelegt werden.");
    }

    const bookingRoom = await tx.orm.hotel.BookingRoom.create({
      bookingId: booking.id,
      roomTypeId: roomType.id,
      ratePlanId: context.ratePlan.id,
      bedType: input.bedType,
      checkIn,
      checkOut,
      adults: input.stay.adults,
      children: input.stay.children,
      pricingModeSnapshot: roomType.pricingMode,
      mealPlanSnapshot: mealPlan,
      totalAmount: money(totals.roomsTotal),
      guestName: `${input.guest.firstName} ${input.guest.lastName}`,
    });

    // Preis je Nacht einfrieren.
    for (let index = 0; index < nights; index++) {
      await tx.orm.hotel.BookingRoomNight.create({
        bookingRoomId: bookingRoom.id,
        date: checkIn.add({ days: index }),
        amount: money(offer.pricePerNight),
        occupancySnapshot: persons,
      });
    }

    await tx.orm.hotel.BookingRoomGuest.create({
      bookingRoomId: bookingRoom.id,
      guestId: guest.id,
      isPrimary: true,
    });

    if (input.stay.breakfast && context.breakfast && toCents(totals.breakfastTotal) > 0) {
      await tx.orm.hotel.BookingExtra.create({
        bookingId: booking.id,
        bookingRoomId: bookingRoom.id,
        serviceItemId: context.breakfast.id,
        quantity: persons * nights,
        unitPrice: money(String(context.breakfast.price)),
        unitSnapshot: context.breakfast.unit,
        totalAmount: money(totals.breakfastTotal),
      });
    }

    return {
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      checkIn: input.stay.checkIn,
      checkOut: input.stay.checkOut,
      nights,
      adults: input.stay.adults,
      children: input.stay.children,
      roomTypeName: roomType.name,
      bedTypeLabel: BED_TYPE_LABELS[input.bedType],
      breakfast: input.stay.breakfast,
      totals,
      cancellation: snapshot ? { name: snapshot.name, text: snapshot.text } : null,
      currency: hotel.currency,
      paymentMethod: karte ? ("CARD_GUARANTEE" as const) : ("PAY_AT_HOTEL" as const),
      cardGuarantee: Boolean(karte),
      guest: {
        firstName: input.guest.firstName,
        lastName: input.guest.lastName,
        email: input.guest.email,
      },
    };
  });
}
