import "server-only";
import "temporal-polyfill/full/global";

import { NextResponse } from "next/server";

import {
  HttpError,
  handle,
  nowInstant,
  readBody,
  readId,
  requireHotelAdmin,
  requireHotel,
} from "@/lib/hotel/admin-api";
import {
  type AllocDemand,
  type AllocRoom,
  assignableRooms,
  assignmentProblem,
} from "@/lib/hotel/allocation";
import { BED_TYPE_LABELS } from "@/lib/hotel/availability";
import {
  BLOCKING_STATUSES,
  loadBlocks,
  loadDemands,
  todayInHotelTimezone,
} from "@/lib/hotel/booking-service";
import { calculateCancellationFee, readPolicySnapshot } from "@/lib/hotel/cancellation";
import { enqueueAvailabilityForBooking } from "@/lib/hotel/channel/sync";
import { BOOKING_SOURCE_LABELS, type BookingSource, OPERATOR_SOURCES } from "@/lib/hotel/constants";
import { createOperatorBooking, parseOperatorBooking } from "@/lib/hotel/operator-booking";
import { sendHotelBookingConfirmation } from "@/lib/mail/notifications";
import { MAIL_SUBJECTS, latestMailStatus } from "@/lib/mail/service";
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
        .select("id", "number", "roomTypeId", "bedType", "maxOccupancy", "active", "status")
        .all(),
    ]);

    // Welche physischen Zimmer sind für welche Buchungsposition im GANZEN
    // Aufenthaltszeitraum frei und geeignet? Entschieden wird serverseitig
    // mit derselben Allokationslogik wie in der Buchungsstrecke; die
    // Oberfläche zeigt nur noch an, was hier herauskommt.
    //
    // Belegungen und Sperren werden einmal für den gesamten Zeitraum aller
    // Buchungen geladen, nicht je Zeile - sonst entstünden N+1-Abfragen.
    const spanne = bookings.reduce(
      (bisher, booking) => ({
        von: bisher.von && bisher.von <= String(booking.checkIn) ? bisher.von : String(booking.checkIn),
        bis: bisher.bis && bisher.bis >= String(booking.checkOut) ? bisher.bis : String(booking.checkOut),
      }),
      { von: "", bis: "" }
    );

    const [demands, blocks] = spanne.von
      ? await Promise.all([loadDemands(spanne.von, spanne.bis), loadBlocks(spanne.von, spanne.bis)])
      : [[] as AllocDemand[], []];

    const allocRooms: AllocRoom[] = rooms;

    const zulaessig = (booking: (typeof bookings)[number], room: (typeof booking.rooms)[number]) => {
      // Für storniert oder nicht erschienen wird nichts mehr zugewiesen.
      if (!(BLOCKING_STATUSES as readonly string[]).includes(String(booking.status))) {
        return [];
      }

      const demand: AllocDemand = {
        key: String(room.id),
        roomTypeId: room.roomTypeId,
        persons: room.adults + room.children,
        bedType: room.bedType,
        roomId: room.roomId,
        checkIn: String(booking.checkIn),
        checkOut: String(booking.checkOut),
      };

      return assignableRooms(allocRooms, demand, demands, blocks).map((frei) => frei.id);
    };

    // Letzter Versandversuch je Buchung. So sieht der Betrieb, ob die
    // Bestätigung beim Gast angekommen ist.
    const mails = await latestMailStatus(
      MAIL_SUBJECTS.HOTEL_BOOKING,
      bookings.map((booking) => booking.id)
    );

    // Offener Stand der Kanalsynchronisierung je Buchung. Eine lokal
    // gespeicherte Buchung und eine bestätigte Übertragung sind zwei
    // verschiedene Dinge; hier wird nur der tatsächliche Stand gemeldet.
    const syncJobs = await db.orm.hotel.SyncJob
      .orderBy((job) => job.id.desc())
      .select("id", "bookingId", "status", "operation", "lastError")
      .all();

    const syncJeBuchung = new Map<number, { status: string; operation: string; error: string | null }>();

    for (const job of syncJobs) {
      if (job.bookingId === null) continue;
      if (syncJeBuchung.has(job.bookingId)) continue;

      syncJeBuchung.set(job.bookingId, {
        status: job.status,
        operation: job.operation,
        error: job.lastError,
      });
    }

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
        internalNote: booking.internalNote,
        sourceLabel: BOOKING_SOURCE_LABELS[booking.source as BookingSource] ?? booking.source,
        externalChannel: booking.externalChannel,
        externalRef: booking.externalBookingId,
        createdAt: String(booking.createdAt),
        confirmationMail: mails.get(booking.id) ?? null,
        channelSync: syncJeBuchung.get(booking.id) ?? null,
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
          // Ausschließlich diese Zimmer dürfen gewählt werden. Die gleiche
          // Prüfung läuft beim Speichern erneut.
          assignableRoomIds: zulaessig(booking, room),
        })),
        };
      }),
      roomTypes,
      rooms,
    });
  });
}

/**
 * Erfasst eine Buchung, die nicht über die Website kam: Telefon, E-Mail,
 * spontan vor Ort oder eine Reservierung, die ein Portal per Mail gemeldet
 * hat.
 *
 * Geprüft wird mit derselben Verfügbarkeitslogik wie in der öffentlichen
 * Buchungsstrecke und unter derselben Zeilensperre.
 */
export async function POST(request: Request) {
  return handle("Bookings POST", async () => {
    await requireHotelAdmin();
    await requireHotel();

    const body = await readBody(request);

    if (String(body.action ?? "") !== "create") {
      throw new HttpError(400, "Unbekannte Aktion.");
    }

    const input = parseOperatorBooking(body);
    const ergebnis = await createOperatorBooking(input);

    return NextResponse.json({ success: true, booking: ergebnis }, { status: 201 });
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

    // Antwortet mit dem Ergebnis des Mailversands, falls einer stattfand.
    let mail: Awaited<ReturnType<typeof sendHotelBookingConfirmation>> = null;

    if (action === "confirm") {
      if (booking.status !== "PENDING") {
        throw new HttpError(409, "Nur offene Buchungen können bestätigt werden.");
      }

      await db.orm.hotel.Booking.where({ id }).update({
        status: "CONFIRMED",
        updatedAt: nowInstant(),
      });

      // Der Status steht in der Datenbank; der Versand kann daran nichts
      // mehr ändern.
      mail = await sendHotelBookingConfirmation(booking.id);

      // Die Belegung gilt jetzt - der Kanal braucht die Verfügbarkeit.
      await enqueueAvailabilityForBooking(booking.id);
    } else if (action === "resendConfirmation") {
      mail = await sendHotelBookingConfirmation(booking.id);

      if (!mail) {
        throw new HttpError(404, "Zu dieser Buchung lassen sich keine Daten laden.");
      }
    } else if (action === "cancel") {
      if (booking.status === "CANCELLED") {
        throw new HttpError(409, "Die Buchung ist bereits storniert.");
      }

      await db.orm.hotel.Booking.where({ id }).update({
        status: "CANCELLED",
        cancelledAt: nowInstant(),
        updatedAt: nowInstant(),
      });

      // Die Nächte sind wieder frei; das muss hinaus.
      await enqueueAvailabilityForBooking(booking.id);
    } else if (action === "assignRoom") {
      await assignRoom(hotel.id, booking.id, body);
    } else {
      throw new HttpError(400, "Unbekannte Aktion.");
    }

    return NextResponse.json({
      success: true,
      mail: mail ? { status: mail.status, error: mail.error, attempt: mail.attempt } : null,
      sources: OPERATOR_SOURCES,
    });
  });
}

/**
 * Weist ein physisches Zimmer zu.
 *
 * Geprueft wird serverseitig und unter einer Zeilensperre: Eine im Browser
 * versteckte oder nachtraeglich eingeschmuggelte Option wird hier
 * abgewiesen. Zwei gleichzeitige Zuweisungen auf dasselbe Zimmer koennen
 * sich nicht ueberholen - die zweite sieht die erste und scheitert mit einer
 * verstaendlichen Meldung.
 */
async function assignRoom(hotelId: number, bookingId: number, body: Record<string, unknown>) {
  const bookingRoomId = readId(body, "bookingRoomId");

  const vorhanden = await db.orm.hotel.BookingRoom.first({
    id: bookingRoomId,
    bookingId,
  });

  if (!vorhanden) {
    throw new HttpError(404, "Buchungsposition nicht gefunden.");
  }

  // Zuweisung entfernen
  if (body.roomId === null) {
    await db.orm.hotel.BookingRoom.where({ id: vorhanden.id }).update({ roomId: null });
    return;
  }

  const roomId = readId(body, "roomId");

  return db.transaction(async (tx) => {
    // Schreibzugriff auf die Hotelzeile: haelt eine exklusive Zeilensperre
    // bis zum Commit und serialisiert damit gleichzeitige Zuweisungen.
    await tx.orm.hotel.Hotel.where({ id: hotelId }).update({ updatedAt: nowInstant() });

    // Unter der Sperre frisch lesen - der Zustand kann sich seit dem Laden
    // der Oberflaeche geaendert haben.
    const bookingRoom = await db.orm.hotel.BookingRoom
      .where({ id: bookingRoomId, bookingId })
      .include("booking", (b) => b.select("status"))
      .first();

    if (!bookingRoom) {
      throw new HttpError(404, "Buchungsposition nicht gefunden.");
    }

    if (!(BLOCKING_STATUSES as readonly string[]).includes(String(bookingRoom.booking.status))) {
      throw new HttpError(409, "Für diese Buchung wird kein Zimmer mehr zugewiesen.");
    }

    const room = await db.orm.hotel.Room.first({ id: roomId, hotelId });

    if (!room) {
      throw new HttpError(400, "Zimmer nicht gefunden.");
    }

    const checkIn = String(bookingRoom.checkIn);
    const checkOut = String(bookingRoom.checkOut);

    const [demands, blocks] = await Promise.all([
      loadDemands(checkIn, checkOut),
      loadBlocks(checkIn, checkOut),
    ]);

    const demand: AllocDemand = {
      key: String(bookingRoom.id),
      roomTypeId: bookingRoom.roomTypeId,
      persons: bookingRoom.adults + bookingRoom.children,
      bedType: bookingRoom.bedType,
      roomId: bookingRoom.roomId,
      checkIn,
      checkOut,
    };

    const problem = assignmentProblem(room as AllocRoom, demand, demands, blocks);

    if (problem) {
      throw new HttpError(409, await erklaereProblem(room.number, problem));
    }

    await tx.orm.hotel.BookingRoom.where({ id: bookingRoom.id }).update({ roomId: room.id });
  });
}

/** Aus dem Prüfergebnis einen Satz für den Betrieb machen. */
async function erklaereProblem(
  nummer: string,
  problem: NonNullable<ReturnType<typeof assignmentProblem>>
): Promise<string> {
  switch (problem.kind) {
    case "INACTIVE":
      return `Zimmer ${nummer} ist nicht aktiv.`;
    case "OUT_OF_SERVICE":
      return `Zimmer ${nummer} ist außer Betrieb.`;
    case "WRONG_TYPE":
      return `Zimmer ${nummer} gehört zu einer anderen Zimmerart.`;
    case "CAPACITY":
      return `Zimmer ${nummer} ist für höchstens ${problem.maxOccupancy} Person(en) geeignet, die Buchung umfasst ${problem.persons}.`;
    case "BED_TYPE":
      return `Zimmer ${nummer} hat die Bettart „${BED_TYPE_LABELS[problem.roomBedType]}“, gewünscht ist „${BED_TYPE_LABELS[problem.wanted]}“.`;
    case "BLOCKED":
      return `Zimmer ${nummer} ist von ${problem.startDate} bis ${problem.endDate} gesperrt.`;
    case "OCCUPIED": {
      const konflikt = await db.orm.hotel.BookingRoom
        .where({ id: Number(problem.conflictKey) })
        .include("booking", (b) => b.select("bookingNumber"))
        .first();

      return `Zimmer ${nummer} ist in diesem Zeitraum bereits durch Buchung ${
        konflikt?.booking.bookingNumber ?? "?"
      } belegt.`;
    }
  }
}
