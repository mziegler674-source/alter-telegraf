import "server-only";

import { NextResponse } from "next/server";

import {
  type Body,
  HttpError,
  getHotel,
  handle,
  readBody,
  readBool,
  readCode,
  readEnum,
  readId,
  readInt,
  readRequiredInt,
  readRequiredText,
  readSlug,
  readText,
  requireAdmin,
  requireHotel,
} from "@/lib/hotel/admin-api";
import { PRICING_MODES } from "@/lib/hotel/constants";
import { db } from "@/prisma/db";

function parseRoomType(body: Body) {
  const standardOccupancy = readRequiredInt(body, "standardOccupancy", "Standardbelegung", { min: 1, max: 20 });
  const maxOccupancy = readRequiredInt(body, "maxOccupancy", "Maximalbelegung", { min: 1, max: 20 });

  if (maxOccupancy < standardOccupancy) {
    throw new HttpError(400, "Maximalbelegung darf nicht kleiner als die Standardbelegung sein.");
  }

  const maxAdults = readInt(body, "maxAdults", "Maximale Erwachsene", { min: 1, max: maxOccupancy });
  const maxChildren = readInt(body, "maxChildren", "Maximale Kinder", { min: 0, max: maxOccupancy });

  return {
    code: readCode(body, "code", "Code"),
    name: readRequiredText(body, "name", "Name", 120),
    slug: readSlug(body, "slug", "Slug"),
    shortDescription: readText(body, "shortDescription", "Kurzbeschreibung", { max: 300 }),
    description: readText(body, "description", "Beschreibung", { max: 5000 }),
    standardOccupancy,
    maxOccupancy,
    maxAdults,
    maxChildren,
    bedConfiguration: readText(body, "bedConfiguration", "Bettenkonfiguration", { max: 160 }),
    sizeSqm: readInt(body, "sizeSqm", "Größe", { min: 1, max: 1000 }),
    pricingMode: readEnum(body, "pricingMode", "Preisart", PRICING_MODES),
    breakfastIncluded: readBool(body, "breakfastIncluded"),
    channelCode: readText(body, "channelCode", "Channel-Code", { max: 60 }),
    sortOrder: readInt(body, "sortOrder", "Sortierung", { min: -9999, max: 9999 }) ?? 0,
    active: readBool(body, "active"),
  };
}

async function findRoomType(hotelId: number, id: number) {
  const roomType = await db.orm.hotel.RoomType.first({ id, hotelId });

  if (!roomType) {
    throw new HttpError(404, "Zimmerart nicht gefunden.");
  }

  return roomType;
}

async function assertUnique(hotelId: number, code: string, slug: string, exceptId?: number) {
  const sameCode = await db.orm.hotel.RoomType.first({ hotelId, code });
  if (sameCode && sameCode.id !== exceptId) {
    throw new HttpError(409, `Der Code „${code}“ wird bereits verwendet.`);
  }

  const sameSlug = await db.orm.hotel.RoomType.first({ hotelId, slug });
  if (sameSlug && sameSlug.id !== exceptId) {
    throw new HttpError(409, `Der Slug „${slug}“ wird bereits verwendet.`);
  }
}

export async function GET() {
  return handle("Room types GET", async () => {
    await requireAdmin();

    const hotel = await getHotel();

    if (!hotel) {
      return NextResponse.json({ hotelReady: false, roomTypes: [] });
    }

    const roomTypes = await db.orm.hotel.RoomType
      .where({ hotelId: hotel.id })
      .orderBy([(r) => r.sortOrder.asc(), (r) => r.name.asc()])
      .include("rooms", (rooms) => rooms.count())
      .all();

    return NextResponse.json({ hotelReady: true, roomTypes });
  });
}

export async function POST(request: Request) {
  return handle("Room types POST", async () => {
    await requireAdmin();
    const hotel = await requireHotel();

    const data = parseRoomType(await readBody(request));
    await assertUnique(hotel.id, data.code, data.slug);

    const roomType = await db.orm.hotel.RoomType.create({ ...data, hotelId: hotel.id });

    return NextResponse.json({ roomType }, { status: 201 });
  });
}

export async function PATCH(request: Request) {
  return handle("Room types PATCH", async () => {
    await requireAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);
    const roomType = await findRoomType(hotel.id, readId(body));

    if (body.action === "setActive") {
      await db.orm.hotel.RoomType
        .where({ id: roomType.id, hotelId: hotel.id })
        .update({ active: readBool(body, "active") });
    } else {
      const data = parseRoomType(body);
      await assertUnique(hotel.id, data.code, data.slug, roomType.id);
      await db.orm.hotel.RoomType
        .where({ id: roomType.id, hotelId: hotel.id })
        .update(data);
    }

    return NextResponse.json({ roomType: await findRoomType(hotel.id, roomType.id) });
  });
}

export async function DELETE(request: Request) {
  return handle("Room types DELETE", async () => {
    await requireAdmin();
    const hotel = await requireHotel();

    const id = readId(await readBody(request));

    const usage = await db.orm.hotel.RoomType
      .where({ id, hotelId: hotel.id })
      .include("rooms", (r) => r.count())
      .include("bookedAs", (b) => b.count())
      .include("inventory", (i) => i.count())
      .include("prices", (p) => p.count())
      .include("images", (i) => i.count())
      .first();

    if (!usage) {
      throw new HttpError(404, "Zimmerart nicht gefunden.");
    }

    const blockers = [
      [usage.rooms, "Zimmer"],
      [usage.bookedAs, "Buchungspositionen"],
      [usage.inventory, "Kontingent-Einträge"],
      [usage.prices, "Preise"],
      [usage.images, "Bilder"],
    ]
      .filter(([count]) => Number(count) > 0)
      .map(([count, label]) => `${count} ${label}`);

    if (blockers.length > 0) {
      throw new HttpError(
        409,
        `Die Zimmerart kann nicht gelöscht werden, da noch abhängige Daten existieren: ${blockers.join(", ")}. Setzen Sie sie stattdessen auf inaktiv.`
      );
    }

    // Ausstattungs-Zuordnungen sind reine Verknüpfungen und werden per Cascade entfernt.
    await db.orm.hotel.RoomType.where({ id, hotelId: hotel.id }).delete();

    return NextResponse.json({ success: true });
  });
}
