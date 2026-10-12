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
  readRequiredText,
  readText,
  requireHotel,
  requireHotelAdmin,
} from "@/lib/hotel/admin-api";
import { channelConfig, missingChannelSettings } from "@/lib/hotel/channel";
import {
  MAPPING_STATUSES,
  type MappingStatus,
  SYNC_STATUS_LABELS,
} from "@/lib/hotel/channel/provider";
import {
  MANUAL_PROVIDER,
  completeManualTask,
  enqueueBookingPull,
  retryJob,
  runDueJobs,
} from "@/lib/hotel/channel/sync";
import { BOOKING_SOURCE_LABELS, type BookingSource } from "@/lib/hotel/constants";
import { inventoryForRange } from "@/lib/hotel/inventory";
import { todayInHotelTimezone } from "@/lib/hotel/time";
import { db } from "@/prisma/db";

// Verwaltung der Vertriebskanäle.
//
// Diese Seite sagt die Wahrheit über den Zustand: Ein grüner Status entsteht
// nur, wenn ein Kanal eingerichtet ist, eine bestätigte Zuordnung besteht und
// keine offenen oder fehlgeschlagenen Aufträge vorliegen. Sonst nicht.

const JOB_LIMIT = 60;

export async function GET() {
  return handle("Channels GET", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const config = channelConfig();
    const fehlend = missingChannelSettings();

    const [jobs, mappings, roomTypes, ratePlans, bookings] = await Promise.all([
      db.orm.hotel.SyncJob
        .orderBy((job) => job.id.desc())
        .include("booking", (b) => b.select("bookingNumber", "status"))
        .all(),
      db.orm.hotel.ChannelMapping
        .where({ hotelId: hotel.id })
        .orderBy((m) => m.id.asc())
        .all(),
      db.orm.hotel.RoomType
        .where({ hotelId: hotel.id })
        .select("id", "code", "name", "active", "channelCode")
        .orderBy((r) => r.sortOrder.asc())
        .all(),
      db.orm.hotel.RatePlan
        .where({ hotelId: hotel.id })
        .select("id", "code", "name", "channelCode")
        .all(),
      db.orm.hotel.Booking
        .where({ hotelId: hotel.id })
        .select("id", "bookingNumber", "source", "externalChannel", "externalBookingId", "status", "checkIn", "checkOut", "internalNote")
        .orderBy((b) => b.id.desc())
        .all(),
    ]);

    // Aufgaben des manuellen Abgleichs stehen getrennt von echten
    // Übertragungsaufträgen: Sie behaupten keine Synchronisierung.
    const manuelleAufgaben = jobs.filter(
      (job) => job.provider === MANUAL_PROVIDER && job.status === "PENDING"
    );

    const echteJobs = jobs.filter((job) => job.provider !== MANUAL_PROVIDER);

    const zaehle = (status: string) => echteJobs.filter((job) => job.status === status).length;

    const erfolgreiche = echteJobs
      .filter((job) => job.status === "DONE" && job.completedAt)
      .map((job) => String(job.completedAt))
      .sort();

    // Zu jeder offenen Aufgabe die Zahlen, die im Portal einzutragen sind.
    // Berechnet aus derselben Quelle wie der Belegungskalender.
    const heute = todayInHotelTimezone(hotel.timezone);

    const grenzen = manuelleAufgaben.reduce(
      (bisher, job) => {
        const von = job.dateFrom ? String(job.dateFrom) : heute;
        const bis = job.dateTo ? String(job.dateTo) : heute;

        return {
          von: !bisher.von || von < bisher.von ? von : bisher.von,
          bis: !bisher.bis || bis > bisher.bis ? bis : bisher.bis,
        };
      },
      { von: "", bis: "" }
    );

    const tageSpanne = grenzen.von
      ? Math.min(
          93,
          Math.max(
            1,
            Temporal.PlainDate.from(grenzen.von).until(Temporal.PlainDate.from(grenzen.bis)).days
          )
        )
      : 0;

    const bestand = tageSpanne > 0 ? await inventoryForRange(hotel.id, grenzen.von, tageSpanne) : null;

    const aufgaben = manuelleAufgaben.map((job) => {
      const von = job.dateFrom ? String(job.dateFrom) : heute;
      const bis = job.dateTo ? String(job.dateTo) : heute;

      const zeile = bestand?.rows.find((eintrag) => eintrag.roomTypeId === job.roomTypeId);

      const tage = (zeile?.days ?? []).filter((tag) => tag.date >= von && tag.date < bis);

      return {
        id: job.id,
        roomTypeId: job.roomTypeId,
        roomTypeName:
          roomTypes.find((typ) => typ.id === job.roomTypeId)?.name ?? "–",
        bookingNumber: job.booking?.bookingNumber ?? null,
        dateFrom: von,
        dateTo: bis,
        createdAt: String(job.createdAt),
        totalRooms: zeile?.totalRooms ?? 0,
        // Genau diese Zahlen gehören ins Extranet.
        days: tage.map((tag) => ({ date: tag.date, free: tag.free })),
        // Mindestens ein Tag ohne freies Zimmer: Dort muss im Portal
        // geschlossen werden.
        needsClosing: tage.some((tag) => tag.free === 0),
      };
    });

    // Externe Buchungen und manuell erfasste Buchungen trennen.
    const extern = bookings.filter((booking) => booking.externalChannel !== null);
    const manuell = bookings.filter(
      (booking) => booking.source !== "WEBSITE" && booking.externalChannel === null
    );

    // Welche Buchungen warten noch auf eine bestätigte Übertragung?
    const offeneJeBuchung = new Map<number, string>();

    for (const job of jobs) {
      if (job.bookingId === null) continue;
      if (job.status === "DONE" || job.status === "SKIPPED") continue;

      if (!offeneJeBuchung.has(job.bookingId)) {
        offeneJeBuchung.set(job.bookingId, job.status);
      }
    }

    const bestaetigteZuordnungen = mappings.filter(
      (mapping) => mapping.syncStatus === "CONFIRMED"
    ).length;

    const offen = zaehle("PENDING") + zaehle("IN_PROGRESS");
    const probleme = zaehle("FAILED") + zaehle("NEEDS_MAPPING") + zaehle("ATTENTION");

    // Gesamtzustand. Bewusst streng.
    const zustand = !config
      ? "NOT_CONFIGURED"
      : bestaetigteZuordnungen === 0
        ? "NO_MAPPING"
        : probleme > 0
          ? "ERROR"
          : offen > 0
            ? "PENDING"
            : "OK";

    return NextResponse.json({
      status: {
        state: zustand,
        provider: config?.provider ?? null,
        missing: fehlend,
        confirmedMappings: bestaetigteZuordnungen,
        lastSuccessAt: erfolgreiche.length > 0 ? erfolgreiche[erfolgreiche.length - 1] : null,
        counts: {
          pending: zaehle("PENDING"),
          inProgress: zaehle("IN_PROGRESS"),
          done: zaehle("DONE"),
          failed: zaehle("FAILED"),
          needsMapping: zaehle("NEEDS_MAPPING"),
          attention: zaehle("ATTENTION"),
          skipped: zaehle("SKIPPED"),
        },
      },
      manualTasks: aufgaben,
      jobs: echteJobs.slice(0, JOB_LIMIT).map((job) => ({
        id: job.id,
        provider: job.provider,
        direction: job.direction,
        operation: job.operation,
        status: job.status,
        statusLabel: SYNC_STATUS_LABELS[job.status as keyof typeof SYNC_STATUS_LABELS] ?? job.status,
        bookingId: job.bookingId,
        bookingNumber: job.booking?.bookingNumber ?? null,
        roomTypeId: job.roomTypeId,
        dateFrom: job.dateFrom ? String(job.dateFrom) : null,
        dateTo: job.dateTo ? String(job.dateTo) : null,
        externalRef: job.externalRef,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        nextAttemptAt: job.nextAttemptAt ? String(job.nextAttemptAt) : null,
        lastError: job.lastError,
        createdAt: String(job.createdAt),
        completedAt: job.completedAt ? String(job.completedAt) : null,
      })),
      mappings: mappings.map((mapping) => ({
        id: mapping.id,
        provider: mapping.provider,
        roomTypeId: mapping.roomTypeId,
        roomTypeName: roomTypes.find((typ) => typ.id === mapping.roomTypeId)?.name ?? "–",
        ratePlanId: mapping.ratePlanId,
        ratePlanName: mapping.ratePlanId
          ? (ratePlans.find((plan) => plan.id === mapping.ratePlanId)?.name ?? "–")
          : null,
        externalPropertyId: mapping.externalPropertyId,
        externalRoomTypeId: mapping.externalRoomTypeId,
        externalRatePlanId: mapping.externalRatePlanId,
        syncStatus: mapping.syncStatus,
        note: mapping.note,
      })),
      roomTypes,
      ratePlans,
      externalBookings: extern.slice(0, 40).map((booking) => ({
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        source: booking.source,
        sourceLabel: BOOKING_SOURCE_LABELS[booking.source as BookingSource] ?? booking.source,
        externalChannel: booking.externalChannel,
        externalRef: booking.externalBookingId,
        status: booking.status,
        checkIn: String(booking.checkIn),
        checkOut: String(booking.checkOut),
        note: booking.internalNote,
        syncState: offeneJeBuchung.get(booking.id) ?? "DONE",
      })),
      manualBookings: manuell.slice(0, 40).map((booking) => ({
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        source: booking.source,
        sourceLabel: BOOKING_SOURCE_LABELS[booking.source as BookingSource] ?? booking.source,
        status: booking.status,
        checkIn: String(booking.checkIn),
        checkOut: String(booking.checkOut),
        note: booking.internalNote,
        syncState: offeneJeBuchung.get(booking.id) ?? "DONE",
      })),
      counts: {
        externalBookings: extern.length,
        manualBookings: manuell.length,
        unsyncedBookings: offeneJeBuchung.size,
      },
    });
  });
}

export async function POST(request: Request) {
  return handle("Channels POST", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);
    const action = String(body.action ?? "");

    if (action === "completeManualTask") {
      const id = readId(body, "jobId");

      if (!(await completeManualTask(id))) {
        throw new HttpError(404, "Aufgabe nicht gefunden.");
      }

      return NextResponse.json({ success: true });
    }

    if (action === "runJobs") {
      const ergebnis = await runDueJobs(20);

      return NextResponse.json({ success: true, run: ergebnis });
    }

    if (action === "pullBookings") {
      const id = await enqueueBookingPull();

      if (id === null) {
        throw new HttpError(409, "Es ist kein Vertriebskanal eingerichtet.");
      }

      const ergebnis = await runDueJobs(5);

      return NextResponse.json({ success: true, jobId: id, run: ergebnis });
    }

    if (action === "retryJob") {
      const id = readId(body, "jobId");

      if (!(await retryJob(id))) {
        throw new HttpError(404, "Auftrag nicht gefunden.");
      }

      const ergebnis = await runDueJobs(5);

      return NextResponse.json({ success: true, run: ergebnis });
    }

    if (action === "saveMapping") {
      const roomTypeId = readId(body, "roomTypeId");

      if (!(await db.orm.hotel.RoomType.first({ id: roomTypeId, hotelId: hotel.id }))) {
        throw new HttpError(400, "Unbekannte Zimmerart.");
      }

      const ratePlanIdRaw = body.ratePlanId;
      const ratePlanId =
        ratePlanIdRaw === null || ratePlanIdRaw === undefined || ratePlanIdRaw === ""
          ? null
          : Number(ratePlanIdRaw);

      if (ratePlanId !== null) {
        if (!(await db.orm.hotel.RatePlan.first({ id: ratePlanId, hotelId: hotel.id }))) {
          throw new HttpError(400, "Unbekannter Rate Plan.");
        }
      }

      const provider = readRequiredText(body, "provider", "Anbieter", 40).toLowerCase();
      const externalRoomTypeId = readRequiredText(body, "externalRoomTypeId", "Externe Zimmerart", 80);

      const vorhanden = await db.orm.hotel.ChannelMapping
        .where({ provider, externalRoomTypeId })
        .first();

      const daten = {
        externalPropertyId: readRequiredText(body, "externalPropertyId", "Externe Unterkunft", 80),
        externalRoomTypeId,
        externalRatePlanId: readText(body, "externalRatePlanId", "Externer Tarifplan", { max: 80 }),
        roomTypeId,
        ratePlanId,
        syncStatus: readEnum(
          body,
          "syncStatus",
          "Status",
          MAPPING_STATUSES as readonly MappingStatus[]
        ),
        note: readText(body, "note", "Notiz", { max: 300 }),
      };

      if (vorhanden) {
        await db.orm.hotel.ChannelMapping.where({ id: vorhanden.id }).update({
          ...daten,
          updatedAt: nowInstant(),
        });

        return NextResponse.json({ success: true, id: vorhanden.id });
      }

      const neu = await db.orm.hotel.ChannelMapping.create({
        hotelId: hotel.id,
        provider,
        ...daten,
      });

      return NextResponse.json({ success: true, id: neu.id }, { status: 201 });
    }

    if (action === "deleteMapping") {
      const id = readId(body, "mappingId");

      const mapping = await db.orm.hotel.ChannelMapping
        .where({ id, hotelId: hotel.id })
        .first();

      if (!mapping) throw new HttpError(404, "Zuordnung nicht gefunden.");

      await db.orm.hotel.ChannelMapping.where({ id }).delete();

      return NextResponse.json({ success: true });
    }

    if (action === "cleanupJobs") {
      // Abgeschlossene Aufträge älter als 90 Tage entfernen. Betrifft keine
      // Buchungsdaten.
      const grenze = Temporal.Now.instant().subtract({ hours: 24 * 90 });

      const alte = await db.orm.hotel.SyncJob
        .where({ status: "DONE" })
        .where((job) => job.createdAt.lt(grenze))
        .select("id")
        .all();

      for (const job of alte) {
        await db.orm.hotel.SyncJob.where({ id: job.id }).delete();
      }

      return NextResponse.json({ success: true, removed: alte.length });
    }

    throw new HttpError(400, "Unbekannte Aktion.");
  });
}
