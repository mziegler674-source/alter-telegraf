import "server-only";
import "temporal-polyfill/full/global";

import { NextResponse } from "next/server";
import { Temporal } from "temporal-polyfill";

import {
  HttpError,
  handle,
  nowInstant,
  readBody,
  readId,
  requireHotelAdmin,
  requireHotel,
} from "@/lib/hotel/admin-api";
import { BED_TYPE_LABELS } from "@/lib/hotel/availability";
import { BLOCKING_STATUSES, todayInHotelTimezone } from "@/lib/hotel/booking-service";
import { calculateCancellationFee, readPolicySnapshot } from "@/lib/hotel/cancellation";
import { db } from "@/prisma/db";

export async function GET() {
  return handle("Bookings GET", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const heute = todayInHotelTimezone(hotel.timezone);

    const bookings = await db.orm.hotel.Booking
      .where({ hotelId: hotel.id })
      .orderBy([(b) => b.checkIn.desc(), (b) => b.id.desc()])
      .include("guest", (g) => g.select("firstName", "lastName", "email", "phone", "city"))
      .include("rooms", (r) =>
        r.select("id", "roomTypeId", "roomId", "bedType", "adults", "children", "mealPlanSnapshot")
      )
      .all();

    const [roomTypes, rooms] = await Promise.all([
      db.orm.hotel.RoomType
        .where({ hotelId: hotel.id })
        .select("id", "code", "name")
        .all(),
      db.orm.hotel.Room
        .where({ hotelId: hotel.id })
        .select("id", "number", "roomTypeId", "bedType", "maxOccupancy", "active")
        .all(),
    ]);

    return NextResponse.json({
      bookings: bookings.map((booking) => {
        const snapshot = readPolicySnapshot(booking.cancellationPolicySnapshot);

        // Was eine Stornierung heute kosten würde. Grundlage ist
        // ausschließlich der gespeicherte Schnappschuss dieser Buchung.
        const storno = snapshot
          ? calculateCancellationFee({
              policy: snapshot,
              totalAmount: String(booking.totalAmount),
              firstNightAmount: String(booking.totalAmount),
              checkIn: String(booking.checkIn),
              cancelledOn: heute,
            })
          : null;

        return {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        source: booking.source,
        checkIn: String(booking.checkIn),
        checkOut: String(booking.checkOut),
        adults: booking.adults,
        children: booking.children,
        roomsTotal: String(booking.roomsTotal),
        extrasTotal: String(booking.extrasTotal),
        discountTotal: String(booking.discountTotal),
        totalAmount: String(booking.totalAmount),
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus,
        // Nur Referenzen des Anbieters. Kartennummer, Pruefziffer und
        // Ablaufdatum liegen nirgends in dieser Datenbank.
        payment: {
          provider: booking.paymentProvider,
          customerRef: booking.paymentCustomerRef,
          methodRef: booking.paymentMethodRef,
          authorizedAt: booking.paymentAuthorizedAt ? String(booking.paymentAuthorizedAt) : null,
          chargedAt: booking.paymentChargedAt ? String(booking.paymentChargedAt) : null,
          depositDue: booking.depositDue === null ? null : String(booking.depositDue),
          depositPaidAt: booking.depositPaidAt ? String(booking.depositPaidAt) : null,
        },
        guestMessage: booking.guestMessage,
        createdAt: String(booking.createdAt),
        cancellation: snapshot
          ? { name: snapshot.name, text: snapshot.text, freeUntilDate: snapshot.freeUntilDate }
          : null,
        cancellationToday: storno
          ? { free: storno.free, amount: storno.amount, reason: storno.reason }
          : null,
        guest: booking.guest,
        rooms: booking.rooms.map((room) => ({
          id: room.id,
          roomTypeId: room.roomTypeId,
          roomId: room.roomId,
          bedType: room.bedType,
          bedTypeLabel: room.bedType ? BED_TYPE_LABELS[room.bedType] : null,
          adults: room.adults,
          children: room.children,
          mealPlan: room.mealPlanSnapshot,
        })),
        };
      }),
      roomTypes,
      rooms,
    });
  });
}

export async function PATCH(request: Request) {
  return handle("Bookings PATCH", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);
    const id = readId(body);
    const action = String(body.action ?? "");

    const booking = await db.orm.hotel.Booking.first({ id, hotelId: hotel.id });

    if (!booking) {
      throw new HttpError(404, "Buchung nicht gefunden.");
    }

    if (action === "confirm") {
      if (booking.status !== "PENDING") {
        throw new HttpError(409, "Nur offene Buchungen können bestätigt werden.");
      }

      await db.orm.hotel.Booking.where({ id }).update({
        status: "CONFIRMED",
        updatedAt: nowInstant(),
      });
    } else if (action === "cancel") {
      if (booking.status === "CANCELLED") {
        throw new HttpError(409, "Die Buchung ist bereits storniert.");
      }

      await db.orm.hotel.Booking.where({ id }).update({
        status: "CANCELLED",
        cancelledAt: nowInstant(),
        updatedAt: nowInstant(),
      });
    } else if (action === "assignRoom") {
      await assignRoom(hotel.id, booking.id, body);
    } else {
      throw new HttpError(400, "Unbekannte Aktion.");
    }

    return NextResponse.json({ success: true });
  });
}

// Die Zuteilung muss zur gewuenschten Bettart passen, die Personenzahl tragen
// und darf das Zimmer im Zeitraum nicht doppelt belegen.
async function assignRoom(hotelId: number, bookingId: number, body: Record<string, unknown>) {
  const bookingRoomId = readId(body, "bookingRoomId");

  const bookingRoom = await db.orm.hotel.BookingRoom.first({
    id: bookingRoomId,
    bookingId,
  });

  if (!bookingRoom) {
    throw new HttpError(404, "Buchungsposition nicht gefunden.");
  }

  // Zuweisung entfernen
  if (body.roomId === null) {
    await db.orm.hotel.BookingRoom.where({ id: bookingRoom.id }).update({ roomId: null });
    return;
  }

  const roomId = readId(body, "roomId");
  const room = await db.orm.hotel.Room.first({ id: roomId, hotelId });

  if (!room) {
    throw new HttpError(400, "Zimmer nicht gefunden.");
  }

  if (!room.active) {
    throw new HttpError(409, `Zimmer ${room.number} ist nicht aktiv.`);
  }

  if (room.roomTypeId !== bookingRoom.roomTypeId) {
    throw new HttpError(409, `Zimmer ${room.number} gehört zu einer anderen Zimmerart.`);
  }

  const persons = bookingRoom.adults + bookingRoom.children;

  if (room.maxOccupancy < persons) {
    throw new HttpError(
      409,
      `Zimmer ${room.number} ist für höchstens ${room.maxOccupancy} Person(en) geeignet, die Buchung umfasst ${persons}.`
    );
  }

  if (bookingRoom.bedType && room.bedType !== bookingRoom.bedType) {
    throw new HttpError(
      409,
      `Zimmer ${room.number} hat die Bettart „${BED_TYPE_LABELS[room.bedType]}“, gewünscht ist „${BED_TYPE_LABELS[bookingRoom.bedType]}“.`
    );
  }

  const from = Temporal.PlainDate.from(String(bookingRoom.checkIn));
  const to = Temporal.PlainDate.from(String(bookingRoom.checkOut));

  const overlapping = await db.orm.hotel.BookingRoom
    .where({ roomId: room.id })
    .where((r) => r.checkIn.lt(to))
    .where((r) => r.checkOut.gt(from))
    .select("id")
    .include("booking", (b) => b.select("status", "bookingNumber"))
    .all();

  const conflict = overlapping.find(
    (row) =>
      row.id !== bookingRoom.id &&
      (BLOCKING_STATUSES as readonly string[]).includes(String(row.booking.status))
  );

  if (conflict) {
    throw new HttpError(
      409,
      `Zimmer ${room.number} ist in diesem Zeitraum bereits durch Buchung ${conflict.booking.bookingNumber} belegt.`
    );
  }

  await db.orm.hotel.BookingRoom.where({ id: bookingRoom.id }).update({ roomId: room.id });
}
