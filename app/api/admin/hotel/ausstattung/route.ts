import "server-only";

import { NextResponse } from "next/server";

import {
  type Body,
  HttpError,
  getHotel,
  handle,
  readBody,
  readCode,
  readId,
  readInt,
  readRequiredText,
  readText,
  requireAdmin,
  requireHotel,
} from "@/lib/hotel/admin-api";
import { EXAMPLE_AMENITIES } from "@/lib/hotel/constants";
import { db } from "@/prisma/db";

function parseAmenity(body: Body) {
  return {
    code: readCode(body, "code", "Code"),
    name: readRequiredText(body, "name", "Name", 80),
    icon: readText(body, "icon", "Icon", { max: 40 }),
    sortOrder: readInt(body, "sortOrder", "Sortierung", { min: -9999, max: 9999 }) ?? 0,
  };
}

async function assertCodeFree(hotelId: number, code: string, exceptId?: number) {
  const existing = await db.orm.hotel.Amenity.first({ hotelId, code });

  if (existing && existing.id !== exceptId) {
    throw new HttpError(409, `Der Code „${code}“ wird bereits verwendet.`);
  }
}

export async function GET() {
  return handle("Amenities GET", async () => {
    await requireAdmin();

    const hotel = await getHotel();

    if (!hotel) {
      return NextResponse.json({ hotelReady: false, amenities: [], roomTypes: [] });
    }

    const [amenities, roomTypes] = await Promise.all([
      db.orm.hotel.Amenity
        .where({ hotelId: hotel.id })
        .orderBy([(a) => a.sortOrder.asc(), (a) => a.name.asc()])
        .all(),
      db.orm.hotel.RoomType
        .where({ hotelId: hotel.id })
        .select("id", "code", "name", "active")
        .orderBy([(r) => r.sortOrder.asc(), (r) => r.name.asc()])
        .include("amenities", (links) => links.select("amenityId"))
        .all(),
    ]);

    return NextResponse.json({
      hotelReady: true,
      amenities,
      roomTypes: roomTypes.map(({ amenities: links, ...roomType }) => ({
        ...roomType,
        amenityIds: links.map((link) => link.amenityId),
      })),
    });
  });
}

export async function POST(request: Request) {
  return handle("Amenities POST", async () => {
    await requireAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);

    if (body.action === "createExamples") {
      const existing = await db.orm.hotel.Amenity
        .where({ hotelId: hotel.id })
        .select("code")
        .all();
      const existingCodes = new Set(existing.map((a) => a.code));
      const missing = EXAMPLE_AMENITIES.filter((a) => !existingCodes.has(a.code));

      await db.transaction(async (tx) => {
        for (const amenity of missing) {
          await tx.orm.hotel.Amenity.create({ ...amenity, hotelId: hotel.id });
        }
      });

      return NextResponse.json({ created: missing.length }, { status: 201 });
    }

    const data = parseAmenity(body);
    await assertCodeFree(hotel.id, data.code);

    const amenity = await db.orm.hotel.Amenity.create({ ...data, hotelId: hotel.id });

    return NextResponse.json({ amenity }, { status: 201 });
  });
}

export async function PATCH(request: Request) {
  return handle("Amenities PATCH", async () => {
    await requireAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);
    const id = readId(body);

    if (!(await db.orm.hotel.Amenity.first({ id, hotelId: hotel.id }))) {
      throw new HttpError(404, "Ausstattung nicht gefunden.");
    }

    const data = parseAmenity(body);
    await assertCodeFree(hotel.id, data.code, id);
    await db.orm.hotel.Amenity.where({ id, hotelId: hotel.id }).update(data);

    return NextResponse.json({
      amenity: await db.orm.hotel.Amenity.first({ id, hotelId: hotel.id }),
    });
  });
}

export async function DELETE(request: Request) {
  return handle("Amenities DELETE", async () => {
    await requireAdmin();
    const hotel = await requireHotel();

    const id = readId(await readBody(request));

    const usage = await db.orm.hotel.Amenity
      .where({ id, hotelId: hotel.id })
      .include("roomTypes", (links) => links.count())
      .first();

    if (!usage) {
      throw new HttpError(404, "Ausstattung nicht gefunden.");
    }

    if (Number(usage.roomTypes) > 0) {
      throw new HttpError(
        409,
        `Die Ausstattung ist noch ${usage.roomTypes} Zimmerart(en) zugeordnet. Bitte zuerst die Zuordnungen entfernen.`
      );
    }

    await db.orm.hotel.Amenity.where({ id, hotelId: hotel.id }).delete();

    return NextResponse.json({ success: true });
  });
}
