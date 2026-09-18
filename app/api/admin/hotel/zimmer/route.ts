import "server-only";

import { NextResponse } from "next/server";

import {
  type Body,
  HttpError,
  getHotel,
  handle,
  readBody,
  readBool,
  readEnum,
  readId,
  readInt,
  readRequiredText,
  readText,
  requireAdmin,
  requireHotel,
} from "@/lib/hotel/admin-api";
import { ROOM_STATUSES } from "@/lib/hotel/constants";
import { db } from "@/prisma/db";

async function parseRoom(hotelId: number, body: Body) {
  const roomTypeId = readId(body, "roomTypeId");
  const roomType = await db.orm.hotel.RoomType.first({ id: roomTypeId, hotelId });

  if (!roomType) {
    throw new HttpError(400, "Bitte eine gültige Zimmerart wählen.");
  }

  return {
    number: readRequiredText(body, "number", "Zimmernummer", 20),
    roomTypeId,
    floor: readInt(body, "floor", "Etage", { min: -10, max: 200 }),
    status: readEnum(body, "status", "Status", ROOM_STATUSES),
    notes: readText(body, "notes", "Notizen", { max: 1000 }),
    active: readBool(body, "active"),
  };
}

async function findRoom(hotelId: number, id: number) {
  const room = await db.orm.hotel.Room.first({ id, hotelId });

  if (!room) {
    throw new HttpError(404, "Zimmer nicht gefunden.");
  }

  return room;
}

async function assertNumberFree(hotelId: number, number: string, exceptId?: number) {
  const existing = await db.orm.hotel.Room.first({ hotelId, number });

  if (existing && existing.id !== exceptId) {
    throw new HttpError(409, `Die Zimmernummer „${number}“ ist in diesem Hotel bereits vergeben.`);
  }
}

export async function GET() {
  return handle("Rooms GET", async () => {
    await requireAdmin();

    const hotel = await getHotel();

    if (!hotel) {
      return NextResponse.json({ hotelReady: false, rooms: [], roomTypes: [] });
    }

    const [rooms, roomTypes] = await Promise.all([
      db.orm.hotel.Room.where({ hotelId: hotel.id }).all(),
      db.orm.hotel.RoomType
        .where({ hotelId: hotel.id })
        .select("id", "code", "name", "active")
        .orderBy([(r) => r.sortOrder.asc(), (r) => r.name.asc()])
        .all(),
    ]);

    rooms.sort((a, b) =>
      a.number.localeCompare(b.number, "de", { numeric: true })
    );

    return NextResponse.json({ hotelReady: true, rooms, roomTypes });
  });
}

export async function POST(request: Request) {
  return handle("Rooms POST", async () => {
    await requireAdmin();
    const hotel = await requireHotel();

    const data = await parseRoom(hotel.id, await readBody(request));
    await assertNumberFree(hotel.id, data.number);

    const room = await db.orm.hotel.Room.create({ ...data, hotelId: hotel.id });

    return NextResponse.json({ room }, { status: 201 });
  });
}

export async function PATCH(request: Request) {
  return handle("Rooms PATCH", async () => {
    await requireAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);
    const room = await findRoom(hotel.id, readId(body));
    const scope = db.orm.hotel.Room.where({ id: room.id, hotelId: hotel.id });

    if (body.action === "setStatus") {
      await scope.update({ status: readEnum(body, "status", "Status", ROOM_STATUSES) });
    } else if (body.action === "setActive") {
      await scope.update({ active: readBool(body, "active") });
    } else {
      const data = await parseRoom(hotel.id, body);
      await assertNumberFree(hotel.id, data.number, room.id);
      await scope.update(data);
    }

    return NextResponse.json({ room: await findRoom(hotel.id, room.id) });
  });
}

export async function DELETE(request: Request) {
  return handle("Rooms DELETE", async () => {
    await requireAdmin();
    const hotel = await requireHotel();

    const id = readId(await readBody(request));

    const usage = await db.orm.hotel.Room
      .where({ id, hotelId: hotel.id })
      .include("bookingRooms", (b) => b.count())
      .first();

    if (!usage) {
      throw new HttpError(404, "Zimmer nicht gefunden.");
    }

    if (Number(usage.bookingRooms) > 0) {
      throw new HttpError(
        409,
        `Das Zimmer ist ${usage.bookingRooms} Buchungsposition(en) zugeordnet und kann nicht gelöscht werden. Setzen Sie es stattdessen auf inaktiv.`
      );
    }

    await db.orm.hotel.Room.where({ id, hotelId: hotel.id }).delete();

    return NextResponse.json({ success: true });
  });
}
