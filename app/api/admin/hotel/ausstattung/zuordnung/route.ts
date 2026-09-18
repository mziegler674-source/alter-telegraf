import "server-only";

import { NextResponse } from "next/server";

import {
  HttpError,
  handle,
  readBody,
  readId,
  requireAdmin,
  requireHotel,
} from "@/lib/hotel/admin-api";
import { db } from "@/prisma/db";

export async function PUT(request: Request) {
  return handle("Amenity assignment PUT", async () => {
    await requireAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);
    const roomTypeId = readId(body, "roomTypeId");

    if (!Array.isArray(body.amenityIds)) {
      throw new HttpError(400, "Ungültige Ausstattungsauswahl.");
    }

    const amenityIds = [...new Set(body.amenityIds.map(Number))];

    if (amenityIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new HttpError(400, "Ungültige Ausstattungsauswahl.");
    }

    if (!(await db.orm.hotel.RoomType.first({ id: roomTypeId, hotelId: hotel.id }))) {
      throw new HttpError(404, "Zimmerart nicht gefunden.");
    }

    if (amenityIds.length > 0) {
      const found = await db.orm.hotel.Amenity
        .where({ hotelId: hotel.id })
        .where((a) => a.id.in(amenityIds))
        .select("id")
        .all();

      if (found.length !== amenityIds.length) {
        throw new HttpError(400, "Mindestens eine Ausstattung gehört nicht zu diesem Hotel.");
      }
    }

    await db.transaction(async (tx) => {
      await tx.orm.hotel.RoomTypeAmenity.where({ roomTypeId }).delete();

      for (const amenityId of amenityIds) {
        await tx.orm.hotel.RoomTypeAmenity.create({ roomTypeId, amenityId });
      }
    });

    return NextResponse.json({ roomTypeId, amenityIds });
  });
}
