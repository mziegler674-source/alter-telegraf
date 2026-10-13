import "server-only";
import "temporal-polyfill/full/global";

import { NextResponse } from "next/server";
import { Temporal } from "temporal-polyfill";

import {
  type Body,
  HttpError,
  handle,
  nowInstant,
  readBody,
  readBool,
  readCode,
  readEnum,
  readId,
  readInt,
  readRequiredText,
  readText,
  requireHotel,
  requireHotelAdmin,
} from "@/lib/hotel/admin-api";
import { loadPromotions, loadRatePriceRows, quoteOffer } from "@/lib/hotel/booking-service";
import { resolveNightPrices, stayNights } from "@/lib/hotel/rate-calendar";
import { BREAKFAST_SERVICE_CODE, nightsBetween } from "@/lib/hotel/pricing";
import {
  PROMOTION_CHANNELS,
  PROMOTION_TYPES,
  type PromotionLike,
  describePromotion,
  evaluatePromotions,
  isLongStay,
  validatePromotion,
} from "@/lib/hotel/promotions";
import { todayInHotelTimezone } from "@/lib/hotel/time";
import { db } from "@/prisma/db";

import type { Numeric } from "@prisma/orm-postgres/target/codec-types";

// Rabattaktionen.
//
// Die Rabattlogik selbst steht in lib/hotel/promotions.ts und gilt fuer
// Buchungsstrecke und Vorschau gleichermassen. Dieser Endpunkt pflegt nur
// die Stammdaten und prueft jede Eingabe serverseitig.
//
// Die Langzeitrabatte (Code LONGSTAY_*) werden weiterhin unter „Preise“ als
// Staffel gepflegt. Hier erscheinen sie, lassen sich aber nicht aendern -
// zwei Editoren fuer dieselbe Zeile waeren eine Fehlerquelle.

const percent = (value: string) => value as unknown as Numeric<5, 2>;
const money = (value: string | null) => value as unknown as Numeric<10, 2> | null;

function readDate(body: Body, key: string, label: string) {
  const raw = body[key];

  if (raw === null || raw === undefined || String(raw).trim() === "") return null;

  const value = String(raw).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${label} muss im Format JJJJ-MM-TT angegeben werden.`);
  }

  try {
    return Temporal.PlainDate.from(value);
  } catch {
    throw new HttpError(400, `${label} ist kein gültiges Datum.`);
  }
}

function readNumber(body: Body, key: string, label: string, max: number) {
  const raw = body[key];

  if (raw === null || raw === undefined || String(raw).trim() === "") return null;

  const value = Number(String(raw).replace(",", "."));

  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new HttpError(400, `${label} muss zwischen 0 und ${max} liegen.`);
  }

  return value;
}

/** IDs einer Mehrfachauswahl. */
function readIds(body: Body, key: string, label: string) {
  const raw = body[key];

  if (raw === undefined || raw === null) return [];

  if (!Array.isArray(raw)) {
    throw new HttpError(400, `${label} muss eine Liste sein.`);
  }

  const ids = raw.map((entry) => Number(entry));

  if (ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw new HttpError(400, `${label} enthält eine ungültige ID.`);
  }

  return [...new Set(ids)];
}

type PromotionInput = ReturnType<typeof readPromotionInput>;

function readPromotionInput(body: Body) {
  const type = readEnum(body, "type", "Art", PROMOTION_TYPES);
  const channel = readEnum(body, "channel", "Kanal", PROMOTION_CHANNELS);

  const discountPercent = readNumber(body, "discountPercent", "Prozentsatz", 100) ?? 0;
  const discountAmount = readNumber(body, "discountAmount", "Festbetrag", 100_000);

  const felder = {
    name: readRequiredText(body, "name", "Name", 120),
    description: readText(body, "description", "Beschreibung", { max: 1000 }),
    type,
    channel,
    active: readBool(body, "active"),
    requiresCode: readBool(body, "requiresCode"),
    discountPercent,
    discountAmount,
    bookingFrom: readDate(body, "bookingFrom", "Buchbar ab"),
    bookingTo: readDate(body, "bookingTo", "Buchbar bis"),
    stayFrom: readDate(body, "stayFrom", "Anreise ab"),
    arrivalTo: readDate(body, "arrivalTo", "Anreise bis"),
    departureFrom: readDate(body, "departureFrom", "Abreise ab"),
    stayTo: readDate(body, "stayTo", "Abreise bis"),
    minStayNights: readInt(body, "minStayNights", "Mindestaufenthalt", { min: 1, max: 365 }),
    maxStayNights: readInt(body, "maxStayNights", "Maximalaufenthalt", { min: 1, max: 365 }),
    earlyBookerDays: readInt(body, "earlyBookerDays", "Frühbucher-Vorlauf", { min: 1, max: 730 }),
    lastMinuteDays: readInt(body, "lastMinuteDays", "Last-Minute-Fenster", { min: 1, max: 365 }),
    roomTypeIds: readIds(body, "roomTypeIds", "Zimmerarten"),
    ratePlanIds: readIds(body, "ratePlanIds", "Rate Plans"),
  };

  const probleme = validatePromotion({
    type: felder.type,
    discountPercent: felder.discountPercent,
    discountAmount: felder.discountAmount,
    bookingFrom: felder.bookingFrom ? String(felder.bookingFrom) : null,
    bookingTo: felder.bookingTo ? String(felder.bookingTo) : null,
    stayFrom: felder.stayFrom ? String(felder.stayFrom) : null,
    arrivalTo: felder.arrivalTo ? String(felder.arrivalTo) : null,
    departureFrom: felder.departureFrom ? String(felder.departureFrom) : null,
    stayTo: felder.stayTo ? String(felder.stayTo) : null,
    minStayNights: felder.minStayNights,
    maxStayNights: felder.maxStayNights,
    earlyBookerDays: felder.earlyBookerDays,
    lastMinuteDays: felder.lastMinuteDays,
  });

  if (probleme.length > 0) {
    throw new HttpError(400, probleme.join(" "));
  }

  return felder;
}

/** Zuordnungen pruefen und ersetzen. */
async function setLinks(
  promotionId: number,
  hotelId: number,
  input: Pick<PromotionInput, "roomTypeIds" | "ratePlanIds">
) {
  const [roomTypes, ratePlans] = await Promise.all([
    db.orm.hotel.RoomType.where({ hotelId }).select("id").all(),
    db.orm.hotel.RatePlan.where({ hotelId }).select("id").all(),
  ]);

  const erlaubteTypen = new Set(roomTypes.map((typ) => typ.id));
  const erlaubtePlaene = new Set(ratePlans.map((plan) => plan.id));

  for (const id of input.roomTypeIds) {
    if (!erlaubteTypen.has(id)) throw new HttpError(400, "Unbekannte Zimmerart.");
  }

  for (const id of input.ratePlanIds) {
    if (!erlaubtePlaene.has(id)) throw new HttpError(400, "Unbekannter Rate Plan.");
  }

  // Zeilenweise entfernen: .where(...).delete() loescht in dieser
  // ORM-Fassung nur eine Zeile.
  for (const link of await db.orm.hotel.PromotionRoomType.where({ promotionId }).select("id").all()) {
    await db.orm.hotel.PromotionRoomType.where({ id: link.id }).delete();
  }

  for (const link of await db.orm.hotel.PromotionRatePlan.where({ promotionId }).select("id").all()) {
    await db.orm.hotel.PromotionRatePlan.where({ id: link.id }).delete();
  }

  for (const roomTypeId of input.roomTypeIds) {
    await db.orm.hotel.PromotionRoomType.create({ promotionId, roomTypeId });
  }

  for (const ratePlanId of input.ratePlanIds) {
    await db.orm.hotel.PromotionRatePlan.create({ promotionId, ratePlanId });
  }
}

export async function GET() {
  return handle("Promotions GET", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const [rows, roomTypes, ratePlans] = await Promise.all([
      db.orm.hotel.Promotion
        .where({ hotelId: hotel.id })
        .orderBy([(p) => p.name.asc(), (p) => p.id.asc()])
        .include("roomTypes", (r) => r.select("roomTypeId"))
        .include("ratePlans", (r) => r.select("ratePlanId"))
        .all(),
      db.orm.hotel.RoomType
        .where({ hotelId: hotel.id })
        .select("id", "code", "name", "active")
        .orderBy((r) => r.sortOrder.asc())
        .all(),
      db.orm.hotel.RatePlan.where({ hotelId: hotel.id }).select("id", "code", "name").all(),
    ]);

    const datum = (value: unknown) => (value === null || value === undefined ? null : String(value));

    return NextResponse.json({
      promotions: rows.map((row) => {
        const wie: PromotionLike = {
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
        };

        return {
          ...wie,
          description: row.description,
          createdAt: String(row.createdAt),
          // Langzeitstaffeln werden unter „Preise“ gepflegt.
          managedUnderPricing: isLongStay(row.code),
          conditions: describePromotion(wie),
        };
      }),
      roomTypes,
      ratePlans,
      today: todayInHotelTimezone(hotel.timezone),
    });
  });
}

export async function POST(request: Request) {
  return handle("Promotions POST", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);

    if (body.action === "preview") {
      return NextResponse.json(await preview(hotel.id, hotel.timezone, body));
    }

    const code = readCode(body, "code", "Code");

    if (isLongStay(code)) {
      throw new HttpError(
        400,
        "Codes mit LONGSTAY_ sind für die Staffel unter „Preise“ reserviert."
      );
    }

    if (await db.orm.hotel.Promotion.first({ hotelId: hotel.id, code })) {
      throw new HttpError(409, `Der Code „${code}“ wird bereits verwendet.`);
    }

    const input = readPromotionInput(body);

    const promotion = await db.orm.hotel.Promotion.create({
      hotelId: hotel.id,
      code,
      name: input.name,
      description: input.description,
      type: input.type,
      channel: input.channel,
      active: input.active,
      requiresCode: input.requiresCode,
      discountPercent: percent(input.discountPercent.toFixed(2)),
      discountAmount: money(input.discountAmount === null ? null : input.discountAmount.toFixed(2)),
      bookingFrom: input.bookingFrom,
      bookingTo: input.bookingTo,
      stayFrom: input.stayFrom,
      arrivalTo: input.arrivalTo,
      departureFrom: input.departureFrom,
      stayTo: input.stayTo,
      minStayNights: input.minStayNights,
      maxStayNights: input.maxStayNights,
      earlyBookerDays: input.earlyBookerDays,
      lastMinuteDays: input.lastMinuteDays,
    });

    await setLinks(promotion.id, hotel.id, input);

    return NextResponse.json({ success: true, id: promotion.id }, { status: 201 });
  });
}

export async function PATCH(request: Request) {
  return handle("Promotions PATCH", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);
    const id = readId(body);

    const promotion = await db.orm.hotel.Promotion.first({ id, hotelId: hotel.id });

    if (!promotion) throw new HttpError(404, "Aktion nicht gefunden.");

    // Aktivieren und Deaktivieren ist auch bei den Langzeitstaffeln
    // zulaessig - alles Weitere nicht.
    if (body.action === "toggle") {
      await db.orm.hotel.Promotion.where({ id }).update({
        active: readBool(body, "active"),
        updatedAt: nowInstant(),
      });

      return NextResponse.json({ success: true });
    }

    if (isLongStay(promotion.code)) {
      throw new HttpError(
        409,
        "Langzeitstaffeln werden unter „Preise“ gepflegt. Hier lassen sie sich nur aktivieren oder deaktivieren."
      );
    }

    const input = readPromotionInput(body);

    await db.orm.hotel.Promotion.where({ id }).update({
      name: input.name,
      description: input.description,
      type: input.type,
      channel: input.channel,
      active: input.active,
      requiresCode: input.requiresCode,
      discountPercent: percent(input.discountPercent.toFixed(2)),
      discountAmount: money(input.discountAmount === null ? null : input.discountAmount.toFixed(2)),
      bookingFrom: input.bookingFrom,
      bookingTo: input.bookingTo,
      stayFrom: input.stayFrom,
      arrivalTo: input.arrivalTo,
      departureFrom: input.departureFrom,
      stayTo: input.stayTo,
      minStayNights: input.minStayNights,
      maxStayNights: input.maxStayNights,
      earlyBookerDays: input.earlyBookerDays,
      lastMinuteDays: input.lastMinuteDays,
      updatedAt: nowInstant(),
    });

    await setLinks(id, hotel.id, input);

    return NextResponse.json({ success: true });
  });
}

export async function DELETE(request: Request) {
  return handle("Promotions DELETE", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);
    const id = readId(body);

    const promotion = await db.orm.hotel.Promotion.first({ id, hotelId: hotel.id });

    if (!promotion) throw new HttpError(404, "Aktion nicht gefunden.");

    if (isLongStay(promotion.code)) {
      throw new HttpError(409, "Langzeitstaffeln werden unter „Preise“ entfernt.");
    }

    // Bereits bestaetigte Buchungen tragen ihren Preis fest in sich; das
    // Entfernen einer Aktion aendert daran nichts.
    await db.orm.hotel.Promotion.where({ id }).delete();

    return NextResponse.json({ success: true });
  });
}

/**
 * Vorschau fuer einen Beispielaufenthalt.
 *
 * Gerechnet wird mit quoteOffer - derselben Funktion, die die Buchung
 * verwendet. Zusaetzlich wird jede Aktion einzeln bewertet, damit
 * nachvollziehbar ist, warum eine greift und eine andere nicht.
 */
async function preview(hotelId: number, timezone: string, body: Body) {
  const checkIn = String(body.checkIn ?? "");
  const checkOut = String(body.checkOut ?? "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    throw new HttpError(400, "Bitte Anreise und Abreise angeben.");
  }

  let nights: number;

  try {
    nights = nightsBetween(checkIn, checkOut);
  } catch {
    throw new HttpError(400, "Die Datumsangaben sind ungültig.");
  }

  if (nights < 1) throw new HttpError(400, "Die Abreise muss nach der Anreise liegen.");
  if (nights > 365) throw new HttpError(400, "Bitte höchstens 365 Nächte.");

  const adults = readInt(body, "adults", "Erwachsene", { min: 1, max: 10 }) ?? 2;
  const children = readInt(body, "children", "Kinder", { min: 0, max: 10 }) ?? 0;
  const persons = adults + children;
  const breakfast = body.breakfast === true;

  // Buchungstag: standardmaessig heute, fuer Fruehbucher-Proben frei
  // waehlbar.
  const bookedOn = /^\d{4}-\d{2}-\d{2}$/.test(String(body.bookedOn ?? ""))
    ? String(body.bookedOn)
    : todayInHotelTimezone(timezone);

  // Aktionscode der Probe: So lassen sich auch Aktionen mit Codepflicht
  // vorab prüfen.
  const probeCode = typeof body.promotionCode === "string" ? body.promotionCode : null;

  const ratePlan =
    (await db.orm.hotel.RatePlan.first({ hotelId, code: "STANDARD_OHNE_FRUEHSTUECK" })) ??
    (await db.orm.hotel.RatePlan.where({ hotelId, mealPlan: "ROOM_ONLY" }).first());

  if (!ratePlan) throw new HttpError(409, "Es ist kein Rate Plan hinterlegt.");

  const [priceRows, breakfastItem, promotions, roomTypes] = await Promise.all([
    // Grundpreise UND Tagespreise des Zeitraums - dieselbe Quelle wie die
    // oeffentliche Buchungsstrecke.
    loadRatePriceRows(ratePlan.id, checkIn, checkOut),
    db.orm.hotel.ServiceItem.first({ hotelId, code: BREAKFAST_SERVICE_CODE }),
    loadPromotions(hotelId),
    db.orm.hotel.RoomType
      .where({ hotelId, active: true })
      .select("id", "name")
      .orderBy((r) => r.sortOrder.asc())
      .all(),
  ]);

  const breakfastPrice = breakfastItem ? String(breakfastItem.price) : null;

  const naechte = stayNights(checkIn, checkOut);

  const zeilen = roomTypes
    .map((roomType) => {
      const nightPrices = resolveNightPrices({
        nights: naechte,
        rows: priceRows,
        roomTypeId: roomType.id,
        occupancy: persons,
      });

      if (!nightPrices) return null;

      const angebot = quoteOffer({
        nights,
        nightPrices,
        persons,
        breakfast,
        breakfastPrice,
        promotions,
        roomTypeId: roomType.id,
        ratePlanId: ratePlan.id,
        checkIn,
        checkOut,
        bookedOn,
        promotionCode: probeCode,
      });

      return {
        roomTypeId: roomType.id,
        roomTypeName: roomType.name,
        pricePerNight: nightPrices[0].amount,
        nightPrices,
        totals: angebot.totals,
        promotion: angebot.discount,
        promotionCode: angebot.code,
        evaluations: evaluatePromotions(
          promotions,
          {
            checkIn,
            checkOut,
            nights,
            bookedOn,
            roomTypeId: roomType.id,
            ratePlanId: ratePlan.id,
            channel: "PUBLIC",
          },
          angebot.roomsTotalCents,
          probeCode
        ),
      };
    })
    .filter((zeile): zeile is NonNullable<typeof zeile> => zeile !== null);

  return {
    stay: { checkIn, checkOut, nights, adults, children, persons, breakfast, bookedOn, promotionCode: probeCode },
    ratePlan: { id: ratePlan.id, name: ratePlan.name },
    rows: zeilen,
    note:
      zeilen.length === 0
        ? `Für ${persons} Person(en) ist kein Preis hinterlegt. Preise werden unter „Preise“ gepflegt.`
        : null,
  };
}
