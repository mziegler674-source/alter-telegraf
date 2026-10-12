import "server-only";
import "temporal-polyfill/full/global";

import { NextResponse } from "next/server";
import { Temporal } from "temporal-polyfill";

import {
  HttpError,
  handle,
  nowInstant,
  readBody,
  readEnum,
  readId,
  readText,
  requireHotel,
  requireHotelAdmin,
} from "@/lib/hotel/admin-api";
import { overlaps } from "@/lib/hotel/allocation";
import { BED_TYPE_LABELS } from "@/lib/hotel/availability";
import { loadDemands } from "@/lib/hotel/booking-service";
import { BLOCK_REASONS, type BlockReason } from "@/lib/hotel/constants";
import { inventoryForRange } from "@/lib/hotel/inventory";
import { todayInHotelTimezone } from "@/lib/hotel/time";
import { db } from "@/prisma/db";

// Belegungskalender.
//
// Der Kalender fuehrt KEINE eigenen Belegungsdaten. Er liest dieselben
// Quellen wie die Buchungsstrecke: BookingRoom fuer Belegungen, Room fuer den
// Bestand, RoomBlock fuer Sperren. Deshalb kann er nichts anzeigen, was die
// Verfuegbarkeit nicht genauso sieht.
//
// Zwei Dinge bleiben bewusst getrennt:
//   - Buchungen MIT zugewiesenem Zimmer stehen in der Zimmerzeile.
//   - Buchungen OHNE Zuweisung stehen in einer eigenen Zeile je Kategorie.
//     Es wird kein Zimmer erfunden, das das Haus nicht vergeben hat.

const MAX_TAGE = 62;

function tageListe(from: string, days: number) {
  const start = Temporal.PlainDate.from(from);

  return Array.from({ length: days }, (_, index) => String(start.add({ days: index })));
}

export async function GET(request: Request) {
  return handle("Calendar GET", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const url = new URL(request.url);
    const heute = todayInHotelTimezone(hotel.timezone);

    const roh = url.searchParams.get("from") ?? heute;
    const from = /^\d{4}-\d{2}-\d{2}$/.test(roh) ? roh : heute;

    const gewuenscht = Number(url.searchParams.get("days"));
    const days = Number.isInteger(gewuenscht) && gewuenscht >= 1 ? Math.min(gewuenscht, MAX_TAGE) : 14;

    const dates = tageListe(from, days);
    const to = String(Temporal.PlainDate.from(from).add({ days }));

    const [rooms, roomTypes, demands] = await Promise.all([
      db.orm.hotel.Room
        .where({ hotelId: hotel.id })
        .select(
          "id",
          "number",
          "floor",
          "roomTypeId",
          "bedType",
          "maxOccupancy",
          "status",
          "active",
          "notes"
        )
        .all(),
      db.orm.hotel.RoomType
        .where({ hotelId: hotel.id })
        .select("id", "code", "name", "maxOccupancy", "active", "sortOrder")
        .orderBy([(r) => r.sortOrder.asc(), (r) => r.name.asc()])
        .all(),
      // Dieselbe Quelle wie die Buchungsstrecke.
      loadDemands(from, to),
    ]);

    // Die Zusatzangaben zu den Belegungen: Buchungsnummer, Gast, Preis.
    const bookingRoomIds = demands.map((demand) => Number(demand.key));

    const positionen =
      bookingRoomIds.length > 0
        ? await db.orm.hotel.BookingRoom
            .where((r) => r.id.in(bookingRoomIds))
            .select("id", "bookingId", "guestName", "mealPlanSnapshot", "totalAmount")
            .include("booking", (b) =>
              b
                .select(
                  "id",
                  "bookingNumber",
                  "status",
                  "adults",
                  "children",
                  "totalAmount",
                  "currency",
                  "paymentMethod",
                  "paymentStatus"
                )
                .include("guest", (g) => g.select("firstName", "lastName"))
            )
            .all()
        : [];

    const jePosition = new Map(positionen.map((position) => [String(position.id), position]));

    const belegungen = demands.map((demand) => {
      const position = jePosition.get(demand.key);
      const buchung = position?.booking;

      return {
        bookingRoomId: Number(demand.key),
        bookingId: buchung?.id ?? null,
        bookingNumber: buchung?.bookingNumber ?? null,
        status: buchung?.status ?? null,
        guestName:
          position?.guestName ??
          (buchung?.guest ? `${buchung.guest.firstName} ${buchung.guest.lastName}` : null),
        roomId: demand.roomId,
        roomTypeId: demand.roomTypeId,
        checkIn: demand.checkIn,
        checkOut: demand.checkOut,
        persons: demand.persons,
        adults: buchung?.adults ?? null,
        children: buchung?.children ?? null,
        bedType: demand.bedType,
        bedTypeLabel: demand.bedType ? BED_TYPE_LABELS[demand.bedType] : null,
        breakfast: position?.mealPlanSnapshot === "BREAKFAST",
        // Nur Summen und Zahlungsart. Keine Kartendaten, keine Referenzen.
        totalAmount: buchung ? String(buchung.totalAmount) : null,
        currency: buchung?.currency ?? hotel.currency,
        paymentMethod: buchung?.paymentMethod ?? null,
      };
    });

    // Belegung je Kategorie und Tag. Gerechnet wird in lib/hotel/inventory.ts
    // - derselben Quelle, aus der auch die Kanalsynchronisierung ihre
    // Verfuegbarkeit nimmt. Damit kann der Kalender nichts anderes anzeigen
    // als gemeldet wird.
    const snapshot = await inventoryForRange(hotel.id, from, days);

    const categoryDays = snapshot.rows.map((row) => ({
      roomTypeId: row.roomTypeId,
      rooms: row.totalRooms,
      days: row.days,
    }));

    return NextResponse.json({
      range: { from, to, days, dates },
      today: heute,
      rooms: rooms
        .map((room) => ({
          id: room.id,
          number: room.number,
          floor: room.floor,
          roomTypeId: room.roomTypeId,
          roomTypeName: roomTypes.find((typ) => typ.id === room.roomTypeId)?.name ?? "–",
          bedType: room.bedType,
          bedTypeLabel: BED_TYPE_LABELS[room.bedType],
          maxOccupancy: room.maxOccupancy,
          status: room.status,
          active: room.active,
          notes: room.notes,
        }))
        .sort((a, b) => a.number.localeCompare(b.number, "de", { numeric: true })),
      roomTypes: roomTypes.map((roomType) => ({
        id: roomType.id,
        code: roomType.code,
        name: roomType.name,
        maxOccupancy: roomType.maxOccupancy,
        active: roomType.active,
      })),
      bookings: belegungen,
      blocks: await blockListe(from, to),
      categoryDays,
      blockReasons: BLOCK_REASONS,
    });
  });
}

async function blockListe(from: string, to: string) {
  const von = Temporal.PlainDate.from(from);
  const bis = Temporal.PlainDate.from(to);

  const rows = await db.orm.hotel.RoomBlock
    .where((b) => b.startDate.lt(bis))
    .where((b) => b.endDate.gt(von))
    .select("id", "roomId", "startDate", "endDate", "reason", "note", "createdAt")
    .all();

  return rows.map((row) => ({
    id: row.id,
    roomId: row.roomId,
    startDate: String(row.startDate),
    endDate: String(row.endDate),
    reason: row.reason,
    note: row.note,
  }));
}

function readSpanne(body: Record<string, unknown>) {
  const startDate = String(body.startDate ?? "");
  const endDate = String(body.endDate ?? "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new HttpError(400, "Bitte Beginn und Ende der Sperre angeben.");
  }

  if (endDate <= startDate) {
    throw new HttpError(400, "Das Ende der Sperre muss nach dem Beginn liegen.");
  }

  if (Temporal.PlainDate.from(startDate).until(Temporal.PlainDate.from(endDate)).days > 365) {
    throw new HttpError(400, "Eine Sperre darf höchstens 365 Tage umfassen.");
  }

  return { startDate, endDate };
}

/**
 * Sperrt ein Zimmer fuer einen Zeitraum. Die Sperre wirkt tatsaechlich: Die
 * Verfuegbarkeitsrechnung behandelt sie wie eine Belegung.
 */
export async function POST(request: Request) {
  return handle("Calendar POST", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);
    const roomId = readId(body, "roomId");

    const room = await db.orm.hotel.Room.first({ id: roomId, hotelId: hotel.id });

    if (!room) throw new HttpError(404, "Zimmer nicht gefunden.");

    const { startDate, endDate } = readSpanne(body);

    const reason = readEnum(body, "reason", "Grund", BLOCK_REASONS.map((eintrag) => eintrag.code) as BlockReason[]);
    const note = readText(body, "note", "Notiz", { max: 300 });

    // Ein belegtes Zimmer wird nicht gesperrt: Sonst stuende eine Buchung in
    // einem Zimmer, das als nicht verfuegbar gilt.
    const belegungen = await loadDemands(startDate, endDate);

    const kollision = belegungen.find(
      (demand) =>
        demand.roomId === room.id &&
        overlaps(demand.checkIn, demand.checkOut, startDate, endDate)
    );

    if (kollision) {
      const position = await db.orm.hotel.BookingRoom
        .where({ id: Number(kollision.key) })
        .include("booking", (b) => b.select("bookingNumber"))
        .first();

      throw new HttpError(
        409,
        `Zimmer ${room.number} ist in diesem Zeitraum durch Buchung ${
          position?.booking.bookingNumber ?? "?"
        } belegt.`
      );
    }

    const bestehende = await db.orm.hotel.RoomBlock
      .where({ roomId: room.id })
      .select("id", "startDate", "endDate")
      .all();

    if (
      bestehende.some((block) =>
        overlaps(String(block.startDate), String(block.endDate), startDate, endDate)
      )
    ) {
      throw new HttpError(409, `Für Zimmer ${room.number} besteht in diesem Zeitraum schon eine Sperre.`);
    }

    const block = await db.orm.hotel.RoomBlock.create({
      roomId: room.id,
      startDate: Temporal.PlainDate.from(startDate),
      endDate: Temporal.PlainDate.from(endDate),
      reason,
      note,
    });

    return NextResponse.json({ success: true, id: block.id }, { status: 201 });
  });
}

export async function PATCH(request: Request) {
  return handle("Calendar PATCH", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);
    const id = readId(body);

    const block = await db.orm.hotel.RoomBlock
      .where({ id })
      .include("room", (r) => r.select("hotelId", "number"))
      .first();

    if (!block || block.room.hotelId !== hotel.id) {
      throw new HttpError(404, "Sperre nicht gefunden.");
    }

    const note = readText(body, "note", "Notiz", { max: 300 });

    await db.orm.hotel.RoomBlock.where({ id }).update({
      reason: readEnum(body, "reason", "Grund", BLOCK_REASONS.map((eintrag) => eintrag.code) as BlockReason[]),
      note,
      updatedAt: nowInstant(),
    });

    return NextResponse.json({ success: true });
  });
}

export async function DELETE(request: Request) {
  return handle("Calendar DELETE", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);
    const id = readId(body);

    const block = await db.orm.hotel.RoomBlock
      .where({ id })
      .include("room", (r) => r.select("hotelId"))
      .first();

    if (!block || block.room.hotelId !== hotel.id) {
      throw new HttpError(404, "Sperre nicht gefunden.");
    }

    await db.orm.hotel.RoomBlock.where({ id }).delete();

    return NextResponse.json({ success: true });
  });
}
