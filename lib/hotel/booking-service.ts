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
  type AllocBlock,
  type AllocDemand,
  type AllocRoom,
  availableForRequest,
} from "@/lib/hotel/allocation";
import {
  BREAKFAST_SERVICE_CODE,
  calculateStay,
  nightsBetween,
  toCents,
} from "@/lib/hotel/pricing";
import {
  type CodeResult,
  type PromotionLike,
  normalizeCode,
  resolveDiscountWithCode,
} from "@/lib/hotel/promotions";
import {
  guaranteeRequirement,
  paymentProviderName,
  verifyCardSetup,
} from "@/lib/hotel/payment/guarantee";
import { bookingNumber } from "@/lib/hotel/booking-number";
import { enqueueAvailabilityForBooking } from "@/lib/hotel/channel/sync";
import { todayInHotelTimezone } from "@/lib/hotel/time";
import { sendHotelBookingConfirmation } from "@/lib/mail/notifications";
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
  /** Vom Gast eingegebener Aktionscode, oder null. */
  promotionCode: string | null;
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

  const promotionCode = normalizeCode(
    typeof raw.promotionCode === "string" ? raw.promotionCode : null
  );

  if (promotionCode.length > 40) {
    throw new HttpError(400, "Der Aktionscode ist zu lang.");
  }

  return {
    checkIn,
    checkOut,
    adults,
    children,
    breakfast: raw.breakfast === true,
    promotionCode: promotionCode || null,
  };
}

async function requireHotelRow() {
  const hotel = await db.orm.hotel.Hotel.orderBy((h) => h.id.asc()).first();

  if (!hotel) {
    throw new HttpError(503, "Die Online-Buchung ist derzeit nicht verfügbar.");
  }

  return hotel;
}

/** Datumsspalte als YYYY-MM-DD oder null. */
const datum = (value: unknown) => (value === null || value === undefined ? null : String(value));

/**
 * Alle Rabattaktionen samt Zuordnungen. Die Langzeitrabatte sind darunter -
 * sie sind gewoehnliche Aktionen und werden unter „Preise“ gepflegt. Eine
 * zweite Rabattquelle gibt es nicht.
 *
 * Geladen werden auch INAKTIVE Aktionen. Ob eine Aktion greift, entscheidet
 * ausschliesslich checkPromotion, und dort wird der Aktivstatus geprueft.
 * Der Grund fuer das Mitladen: Gibt ein Gast den Code einer abgeschalteten
 * Aktion ein, soll er erfahren, dass sie nicht mehr aktiv ist - und nicht,
 * dass es den Code nicht gibt.
 */
export async function loadPromotions(hotelId: number): Promise<PromotionLike[]> {
  const rows = await db.orm.hotel.Promotion
    .where({ hotelId })
    .select(
      "id",
      "code",
      "name",
      "type",
      "channel",
      "active",
      "discountPercent",
      "discountAmount",
      "bookingFrom",
      "bookingTo",
      "stayFrom",
      "stayTo",
      "arrivalTo",
      "departureFrom",
      "minStayNights",
      "maxStayNights",
      "earlyBookerDays",
      "lastMinuteDays",
      "requiresCode"
    )
    .include("roomTypes", (r) => r.select("roomTypeId"))
    .include("ratePlans", (r) => r.select("ratePlanId"))
    .all();

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    channel: row.channel,
    active: row.active,
    discountPercent: String(row.discountPercent),
    discountAmount: row.discountAmount === null ? null : String(row.discountAmount),
    bookingFrom: datum(row.bookingFrom),
    bookingTo: datum(row.bookingTo),
    stayFrom: datum(row.stayFrom),
    arrivalTo: datum(row.arrivalTo),
    departureFrom: datum(row.departureFrom),
    stayTo: datum(row.stayTo),
    minStayNights: row.minStayNights,
    maxStayNights: row.maxStayNights,
    earlyBookerDays: row.earlyBookerDays,
    lastMinuteDays: row.lastMinuteDays,
    requiresCode: row.requiresCode,
    roomTypeIds: row.roomTypes.map((link) => link.roomTypeId),
    ratePlanIds: row.ratePlans.map((link) => link.ratePlanId),
  }));
}

export async function loadPricingContext(hotelId: number) {
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
    loadPromotions(hotelId),
    loadCancellationPolicy(ratePlan.id),
  ]);

  return {
    ratePlan,
    cancellationPolicy,
    prices: prices.map((p) => ({
      roomTypeId: p.roomTypeId,
      occupancy: p.occupancy,
      amount: String(p.amount),
    })),
    breakfast,
    promotions,
  };
}

/**
 * Bestehende Belegungen im Zeitraum, auf Ebene der einzelnen Buchungszimmer.
 * Grundlage ist ausschliesslich BookingRoom - es wird kein zusaetzlicher
 * Zaehler gefuehrt, der auseinanderlaufen koennte.
 */
export async function loadDemands(checkIn: string, checkOut: string): Promise<AllocDemand[]> {
  const from = Temporal.PlainDate.from(checkIn);
  const to = Temporal.PlainDate.from(checkOut);

  const overlapping = await db.orm.hotel.BookingRoom
    .where((r) => r.checkIn.lt(to))
    .where((r) => r.checkOut.gt(from))
    .select("id", "roomTypeId", "roomId", "bedType", "adults", "children", "checkIn", "checkOut")
    .include("booking", (b) => b.select("status"))
    .all();

  return overlapping
    .filter((row) =>
      (BLOCKING_STATUSES as readonly string[]).includes(String(row.booking.status))
    )
    .map((row) => ({
      key: String(row.id),
      roomTypeId: row.roomTypeId,
      persons: row.adults + row.children,
      bedType: row.bedType,
      roomId: row.roomId,
      checkIn: String(row.checkIn),
      checkOut: String(row.checkOut),
    }));
}

/** Zeitraumbezogene Zimmersperren, die den Zeitraum beruehren. */
export async function loadBlocks(checkIn: string, checkOut: string): Promise<AllocBlock[]> {
  const from = Temporal.PlainDate.from(checkIn);
  const to = Temporal.PlainDate.from(checkOut);

  const rows = await db.orm.hotel.RoomBlock
    .where((b) => b.startDate.lt(to))
    .where((b) => b.endDate.gt(from))
    .select("roomId", "startDate", "endDate")
    .all();

  return rows.map((row) => ({
    roomId: row.roomId,
    startDate: String(row.startDate),
    endDate: String(row.endDate),
  }));
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
  /** Welche Aktion wirkt und woher sie kommt. */
  promotion: {
    code: string;
    name: string;
    percent: number;
    source: "AUTOMATIC" | "CODE";
  } | null;
  /** Urteil über den eingegebenen Aktionscode für diese Zimmerart. */
  promotionCode: CodeResult;
};

export type QuoteInput = {
  nights: number;
  pricePerNight: string;
  persons: number;
  breakfast: boolean;
  /** Preis je Person und Nacht, oder null wenn nicht angeboten. */
  breakfastPrice: string | null;
  promotions: PromotionLike[];
  roomTypeId: number;
  ratePlanId: number;
  checkIn: string;
  checkOut: string;
  /** Buchungstag in der Zeitzone des Hotels. */
  bookedOn: string;
  /** Vom Gast eingegebener Aktionscode, oder null. */
  promotionCode?: string | null;
};

/**
 * Preis eines Angebots - Zimmer, Rabatt, Fruehstueck.
 *
 * Diese Funktion ist die einzige Stelle, an der ein Aufenthaltspreis
 * entsteht. Buchungsstrecke und Admin-Vorschau rufen sie gleichermassen auf;
 * eine Vorschau kann deshalb nicht von der tatsaechlichen Buchung abweichen.
 */
export function quoteOffer(input: QuoteInput) {
  const roomsTotalCents = toCents(input.pricePerNight) * input.nights;

  const { discount, code } = resolveDiscountWithCode(
    input.promotions,
    {
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights: input.nights,
      bookedOn: input.bookedOn,
      roomTypeId: input.roomTypeId,
      ratePlanId: input.ratePlanId,
      channel: "PUBLIC",
    },
    roomsTotalCents,
    input.promotionCode ?? null
  );

  const totals = calculateStay({
    nights: input.nights,
    pricePerNight: input.pricePerNight,
    breakfastPersons: input.breakfast && input.breakfastPrice ? input.persons : 0,
    breakfastPricePerPersonNight: input.breakfastPrice ?? "0",
    discount: discount
      ? { percent: discount.percent, cents: discount.cents, name: discount.name }
      : null,
  });

  return { discount, code, totals, roomsTotalCents };
}

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
      .select("id", "number", "roomTypeId", "bedType", "maxOccupancy", "active", "status")
      .all(),
  ]);

  // Verfuegbarkeit auf Ebene der physischen Zimmer: Es wird geprueft, ob sich
  // bestehende Belegungen und die Anfrage tatsaechlich auf verschiedene
  // geeignete Zimmer verteilen lassen.
  const [demands, blocks] = await Promise.all([
    loadDemands(query.checkIn, query.checkOut),
    loadBlocks(query.checkIn, query.checkOut),
  ]);

  const allocRooms: AllocRoom[] = rooms;
  const heute = todayInHotelTimezone(hotel.timezone);

  // Redaktionelle Daten fuer die Zimmerkarten. Sie beeinflussen Verfuegbarkeit
  // und Preis nicht, sondern ergaenzen nur die Darstellung.
  const presentations = await loadRoomPresentations(hotel.id);

  const breakfastPrice = context.breakfast ? String(context.breakfast.price) : null;

  const offers: StayOffer[] = [];

  for (const base of offersForOccupancy(roomTypes, rooms, context.prices, persons)) {
    const roomsAvailable = availableForRequest({
      rooms: allocRooms,
      demands,
      blocks,
      request: {
        roomTypeId: base.roomTypeId,
        persons,
        bedType: null,
        checkIn: query.checkIn,
        checkOut: query.checkOut,
      },
    });

    if (roomsAvailable < 1) continue;

    const bedTypes = base.bedTypes
      .map((option) => ({
        bedType: option.bedType,
        label: option.label,
        roomsAvailable: availableForRequest({
          rooms: allocRooms,
          demands,
          blocks,
          request: {
            roomTypeId: base.roomTypeId,
            persons,
            bedType: option.bedType,
            checkIn: query.checkIn,
            checkOut: query.checkOut,
          },
        }),
      }))
      .filter((option) => option.roomsAvailable > 0);

    if (bedTypes.length === 0) continue;

    // Rabatt je Kategorie: Aktionen koennen auf Zimmerarten eingeschraenkt
    // sein, deshalb wird hier und nicht einmal pauschal entschieden.
    const angebot = quoteOffer({
      nights,
      pricePerNight: base.pricePerNight,
      persons,
      breakfast: query.breakfast,
      breakfastPrice: breakfastPrice,
      promotions: context.promotions,
      roomTypeId: base.roomTypeId,
      ratePlanId: context.ratePlan.id,
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      bookedOn: heute,
      promotionCode: query.promotionCode,
    });

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
      totals: angebot.totals,
      promotion: angebot.discount
        ? {
            code: angebot.discount.code,
            name: angebot.discount.name,
            percent: angebot.discount.percent,
            source: angebot.discount.source,
          }
        : null,
      promotionCode: angebot.code,
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
    // Urteil über den Aktionscode. Gilt er für mindestens eine Zimmerart,
    // zählt das als angewendet; sonst gewinnt die erste Begründung.
    promotionCode: codeStatus(query.promotionCode, offers),
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

/**
 * Zusammenfassung über alle Angebote. Ein Code kann für eine Zimmerart
 * gelten und für eine andere nicht - der Gast sieht dann den Stand seiner
 * Auswahl, und ohne Auswahl diese Zusammenfassung.
 */
function codeStatus(code: string | null, offers: StayOffer[]): CodeResult {
  if (!code) return { code: null, status: "NONE", reason: null };

  const angewendet = offers.find((offer) => offer.promotionCode.status === "APPLIED");

  if (angewendet) return angewendet.promotionCode;

  const uebertroffen = offers.find((offer) => offer.promotionCode.status === "OUTPERFORMED");

  if (uebertroffen) return uebertroffen.promotionCode;

  return (
    offers[0]?.promotionCode ?? {
      code,
      status: "NOT_APPLICABLE",
      reason: "Für diesen Zeitraum ist kein passendes Zimmer verfügbar.",
    }
  );
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
  // Die interne ID bleibt im Service; nach aussen ist die Buchungsnummer die
  // Kennung, die der Gast nennt.
  const { bookingId, ...buchung } = await speichereBuchung(input);

  // Reihenfolge ist entscheidend: Die Buchung ist zu diesem Zeitpunkt
  // festgeschrieben. Der Mailversand laeuft danach und kann sie nicht mehr
  // gefaehrden - scheitert er, bleibt die Buchung bestaetigt und der Versuch
  // ist protokolliert. Die Verwaltung kann die Bestaetigung erneut senden.
  let bestaetigungsmail: string | null = null;

  try {
    const mail = await sendHotelBookingConfirmation(bookingId);

    bestaetigungsmail = mail?.status ?? null;
  } catch (error) {
    console.error("Booking confirmation mail error:", error);
  }

  // Die Buchung ist gespeichert und bestaetigt. Ob ein Vertriebskanal davon
  // erfaehrt, ist eine getrennte Frage: Sie wird als Auftrag festgehalten
  // und kann hier nichts mehr gefaehrden.
  await enqueueAvailabilityForBooking(bookingId);

  return { ...buchung, confirmationMail: bestaetigungsmail };
}

async function speichereBuchung(input: CreateBookingInput) {
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
          // Verfuegbarkeit, Bettart und Preis sind serverseitig geprueft, es
          // bleibt kein Schritt fuer den Betrieb offen. Die Buchung ist
          // damit verbindlich und wird sofort bestaetigt.
          status: "CONFIRMED",
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
      bookingId: booking.id,
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
