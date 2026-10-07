import "server-only";

import { NextResponse } from "next/server";

import {
  type Body,
  HttpError,
  handle,
  nowInstant,
  readBody,
  requireHotelAdmin,
  requireHotel,
} from "@/lib/hotel/admin-api";
import {
  BREAKFAST_SERVICE_CODE,
  DEFAULT_BREAKFAST_PRICE,
  LONG_STAY_CODE_PREFIX,
} from "@/lib/hotel/pricing";
import { db } from "@/prisma/db";

import type { Numeric } from "@prisma/orm-postgres/target/codec-types";

const money = (value: string) => value as unknown as Numeric<10, 2>;
const percent = (value: string) => value as unknown as Numeric<5, 2>;

function parseAmount(raw: unknown, label: string) {
  const value = String(raw ?? "").trim().replace(",", ".");

  if (!/^\d{1,6}(\.\d{1,2})?$/.test(value)) {
    throw new HttpError(400, `${label}: Bitte einen gültigen Betrag eingeben, z. B. 139,00.`);
  }

  return value;
}

function parseInteger(raw: unknown, label: string, min: number, max: number) {
  const value = Number(raw);

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new HttpError(400, `${label} muss zwischen ${min} und ${max} liegen.`);
  }

  return value;
}

// Der Zimmerpreis haengt am Standard-Rate-Plan. Fruehstueck wird separat
// als Zusatzleistung berechnet, nicht ueber einen eigenen Rate Plan.
async function getStandardRatePlan(hotelId: number) {
  const byCode = await db.orm.hotel.RatePlan.first({
    hotelId,
    code: "STANDARD_OHNE_FRUEHSTUECK",
  });

  if (byCode) return byCode;

  const roomOnly = await db.orm.hotel.RatePlan
    .where({ hotelId, mealPlan: "ROOM_ONLY" })
    .orderBy((p) => p.sortOrder.asc())
    .first();

  if (roomOnly) return roomOnly;

  throw new HttpError(
    409,
    "Es ist kein Rate Plan vorhanden. Bitte zuerst die Hotel-Grunddaten einrichten."
  );
}

export async function GET() {
  return handle("Hotel prices GET", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();
    const ratePlan = await getStandardRatePlan(hotel.id);

    const [roomTypes, prices, breakfast, tiers] = await Promise.all([
      db.orm.hotel.RoomType
        .where({ hotelId: hotel.id, active: true })
        .select("id", "code", "name", "standardOccupancy", "maxOccupancy")
        .orderBy([(r) => r.sortOrder.asc(), (r) => r.name.asc()])
        .all(),
      db.orm.hotel.RatePrice
        .where({ ratePlanId: ratePlan.id })
        .where((p) => p.date.isNull())
        .select("id", "roomTypeId", "occupancy", "amount")
        .all(),
      db.orm.hotel.ServiceItem.first({
        hotelId: hotel.id,
        code: BREAKFAST_SERVICE_CODE,
      }),
      db.orm.hotel.Promotion
        .where({ hotelId: hotel.id, type: "BASIC" })
        .select("id", "code", "name", "minStayNights", "discountPercent", "active")
        .all(),
    ]);

    const longStay = tiers
      .filter((tier) => tier.code.startsWith(LONG_STAY_CODE_PREFIX) && tier.minStayNights)
      .map((tier) => ({
        minNights: tier.minStayNights as number,
        percent: Number(tier.discountPercent),
        active: tier.active,
      }))
      .sort((a, b) => a.minNights - b.minNights);

    return NextResponse.json({
      roomTypes,
      prices: prices.map((price) => ({
        roomTypeId: price.roomTypeId,
        occupancy: price.occupancy,
        amount: String(price.amount),
      })),
      breakfastPrice: breakfast ? String(breakfast.price) : DEFAULT_BREAKFAST_PRICE,
      discountTiers: longStay,
    });
  });
}

export async function PUT(request: Request) {
  return handle("Hotel prices PUT", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();
    const ratePlan = await getStandardRatePlan(hotel.id);

    const body: Body = await readBody(request);

    // --- Zimmerpreise ---
    if (!Array.isArray(body.prices)) {
      throw new HttpError(400, "Ungültige Preisangaben.");
    }

    const roomTypes = await db.orm.hotel.RoomType
      .where({ hotelId: hotel.id })
      .select("id", "name", "maxOccupancy")
      .all();

    const byId = new Map(roomTypes.map((room) => [room.id, room]));

    const prices = body.prices.map((entry) => {
      const row = entry as Body;
      const roomTypeId = parseInteger(row.roomTypeId, "Zimmerart", 1, Number.MAX_SAFE_INTEGER);
      const roomType = byId.get(roomTypeId);

      if (!roomType) {
        throw new HttpError(400, "Unbekannte Zimmerart.");
      }

      return {
        roomTypeId,
        occupancy: parseInteger(row.occupancy, `${roomType.name}: Belegung`, 1, roomType.maxOccupancy),
        amount: parseAmount(row.amount, `${roomType.name}: Preis`),
      };
    });

    const seen = new Set<string>();

    for (const price of prices) {
      const key = `${price.roomTypeId}-${price.occupancy}`;

      if (seen.has(key)) {
        throw new HttpError(400, "Für dieselbe Belegung wurden zwei Preise angegeben.");
      }

      seen.add(key);
    }

    // --- Frühstück ---
    const breakfastPrice = parseAmount(body.breakfastPrice, "Frühstück");

    // --- Langzeitrabatte ---
    if (!Array.isArray(body.discountTiers)) {
      throw new HttpError(400, "Ungültige Rabattangaben.");
    }

    const tiers = body.discountTiers.map((entry) => {
      const row = entry as Body;

      return {
        minNights: parseInteger(row.minNights, "Rabatt: Nächte", 1, 365),
        percent: parseAmount(row.percent, "Rabatt: Prozent"),
      };
    });

    if (tiers.some((tier) => Number(tier.percent) > 100)) {
      throw new HttpError(400, "Ein Rabatt darf nicht über 100 % liegen.");
    }

    if (new Set(tiers.map((tier) => tier.minNights)).size !== tiers.length) {
      throw new HttpError(400, "Für dieselbe Nächtezahl wurden zwei Rabatte angegeben.");
    }

    await db.transaction(async (tx) => {
      // Grundpreise ersetzen. Datierte Saisonpreise bleiben unberührt.
      const existing = await tx.orm.hotel.RatePrice
        .where({ ratePlanId: ratePlan.id })
        .where((p) => p.date.isNull())
        .select("id", "roomTypeId", "occupancy")
        .all();

      const wanted = new Set(prices.map((p) => `${p.roomTypeId}-${p.occupancy}`));

      for (const row of existing) {
        if (!wanted.has(`${row.roomTypeId}-${row.occupancy}`)) {
          await tx.orm.hotel.RatePrice.where({ id: row.id }).delete();
        }
      }

      const existingByKey = new Map(
        existing.map((row) => [`${row.roomTypeId}-${row.occupancy}`, row.id])
      );

      for (const price of prices) {
        const id = existingByKey.get(`${price.roomTypeId}-${price.occupancy}`);

        if (id) {
          await tx.orm.hotel.RatePrice.where({ id }).update({ amount: money(price.amount) });
        } else {
          await tx.orm.hotel.RatePrice.create({
            ratePlanId: ratePlan.id,
            roomTypeId: price.roomTypeId,
            occupancy: price.occupancy,
            amount: money(price.amount),
          });
        }
      }

      // Frühstück als Zusatzleistung pro Person und Nacht.
      const breakfast = await tx.orm.hotel.ServiceItem.first({
        hotelId: hotel.id,
        code: BREAKFAST_SERVICE_CODE,
      });

      if (breakfast) {
        await tx.orm.hotel.ServiceItem.where({ id: breakfast.id }).update({
          price: money(breakfastPrice),
        });
      } else {
        await tx.orm.hotel.ServiceItem.create({
          hotelId: hotel.id,
          code: BREAKFAST_SERVICE_CODE,
          name: "Frühstück",
          description: "Pro Person und Nacht.",
          price: money(breakfastPrice),
          unit: "PER_PERSON_NIGHT",
          active: true,
          sortOrder: 10,
        });
      }

      // Langzeitrabatte ersetzen.
      const current = await tx.orm.hotel.Promotion
        .where({ hotelId: hotel.id, type: "BASIC" })
        .select("id", "code")
        .all();

      const wantedCodes = new Set(tiers.map((tier) => `${LONG_STAY_CODE_PREFIX}${tier.minNights}`));

      for (const promotion of current) {
        if (
          promotion.code.startsWith(LONG_STAY_CODE_PREFIX) &&
          !wantedCodes.has(promotion.code)
        ) {
          await tx.orm.hotel.Promotion.where({ id: promotion.id }).delete();
        }
      }

      const currentByCode = new Map(current.map((promotion) => [promotion.code, promotion.id]));

      for (const tier of tiers) {
        const code = `${LONG_STAY_CODE_PREFIX}${tier.minNights}`;
        const id = currentByCode.get(code);

        const data = {
          name: `Langzeitrabatt ab ${tier.minNights} Nächten`,
          discountPercent: percent(tier.percent),
          minStayNights: tier.minNights,
          active: true,
        };

        if (id) {
          await tx.orm.hotel.Promotion.where({ id }).update({ ...data, updatedAt: nowInstant() });
        } else {
          await tx.orm.hotel.Promotion.create({
            hotelId: hotel.id,
            code,
            type: "BASIC",
            channel: "PUBLIC",
            description: "Automatischer Rabatt ab einer Mindestanzahl an Nächten.",
            ...data,
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  });
}
