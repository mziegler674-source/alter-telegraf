import "server-only";
import "temporal-polyfill/full/global";

import { Temporal } from "temporal-polyfill";

import { nowInstant } from "@/lib/admin-api";
import { inventoryForRange } from "@/lib/hotel/inventory";
import { db } from "@/prisma/db";

import {
  type AvailabilityPush,
  ChannelError,
  type SyncStatus,
  backoffMinutes,
} from "./provider";
import { channelConfig, getChannelProvider, redactChannelSecrets } from "./index";
import { importExternalBooking } from "./import";
import { type EnqueueInput, enqueueJob } from "./jobs";

// Auftragsverwaltung der Kanalsynchronisierung.
//
// Grundgedanke: Eine Buchung wird LOKAL gespeichert und gilt damit als
// angenommen. Ob der Kanal davon weiss, ist eine zweite, getrennte Frage -
// sie wird als Auftrag in syncJob festgehalten. Erst der Status DONE belegt
// eine bestaetigte Uebertragung.
//
// Deshalb gilt in dieser Datei durchgehend: Kein Auftrag darf den
// Buchungsvorgang zum Scheitern bringen. Alle Einstiegspunkte fangen Fehler
// ab und schreiben sie in den Auftrag.

const MAX_FEHLERTEXT = 500;

function fehlertext(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);

  return redactChannelSecrets(text).slice(0, MAX_FEHLERTEXT);
}

/**
 * Kennung fuer Aufgaben des manuellen Betriebs.
 *
 * Solange keine automatische Anbindung freigegeben ist, pflegt der Betrieb
 * die Verfuegbarkeit im Extranet des Portals von Hand. Damit das nicht dem
 * Gedaechtnis ueberlassen bleibt, entsteht je Aenderung eine Aufgabe unter
 * diesem Anbieternamen. Sie wird im Admin abgehakt - uebertragen wird nichts.
 */
export const MANUAL_PROVIDER = "manual";

/**
 * Meldet die Verfuegbarkeit der betroffenen Kategorien nach einer Aenderung
 * an einer Buchung.
 *
 * Verhalten, bewusst so gewaehlt:
 *   - Kein Kanal eingerichtet: Es entsteht eine AUFGABE fuer den manuellen
 *     Abgleich (Anbieter „manual“). Sie behauptet keine Uebertragung,
 *     sondern haelt fest, welcher Zeitraum im Portal nachgezogen werden
 *     muss.
 *   - Kanal eingerichtet, aber die Zimmerart ist nicht bestaetigt zugeordnet:
 *     Auftrag mit NEEDS_MAPPING. Das ist eine echte Aufgabe fuer den Betrieb.
 *   - Alles vorhanden: Auftrag mit PENDING.
 *
 * Wirft nie.
 */
export async function enqueueAvailabilityForBooking(bookingId: number) {
  try {
    const config = channelConfig();

    if (!config) return enqueueManualTask(bookingId);

    const booking = await db.orm.hotel.Booking
      .where({ id: bookingId })
      .select("id", "hotelId", "checkIn", "checkOut")
      .include("rooms", (r) => r.select("roomTypeId"))
      .first();

    if (!booking) return { enqueued: 0, skipped: true };

    const kategorien = [...new Set(booking.rooms.map((room) => room.roomTypeId))];
    const von = String(booking.checkIn);
    const bis = String(booking.checkOut);

    const mappings = await db.orm.hotel.ChannelMapping
      .where({ provider: config.provider })
      .select("roomTypeId", "syncStatus")
      .all();

    let angelegt = 0;

    for (const roomTypeId of kategorien) {
      const mapping = mappings.find((eintrag) => eintrag.roomTypeId === roomTypeId);

      if (!mapping || mapping.syncStatus !== "CONFIRMED") {
        await enqueueJob(config.provider, {
          operation: "AVAILABILITY_PUSH",
          status: "NEEDS_MAPPING",
          bookingId: booking.id,
          roomTypeId,
          dateFrom: von,
          dateTo: bis,
          lastError: mapping
            ? "Die Zuordnung dieser Zimmerart ist nicht bestätigt."
            : "Für diese Zimmerart ist keine externe Zuordnung hinterlegt.",
        });

        angelegt++;
        continue;
      }

      // Kein zweiter offener Auftrag fuer denselben Zeitraum.
      const offene = await db.orm.hotel.SyncJob
        .where({
          provider: config.provider,
          operation: "AVAILABILITY_PUSH",
          status: "PENDING",
          roomTypeId,
        })
        .select("id", "dateFrom", "dateTo")
        .all();

      if (offene.some((job) => String(job.dateFrom) === von && String(job.dateTo) === bis)) {
        continue;
      }

      await enqueueJob(config.provider, {
        operation: "AVAILABILITY_PUSH",
        bookingId: booking.id,
        roomTypeId,
        dateFrom: von,
        dateTo: bis,
      });

      angelegt++;
    }

    return { enqueued: angelegt, skipped: false };
  } catch (error) {
    // Die Buchung ist gespeichert; ein Fehler hier darf sie nicht gefaehrden.
    console.error("Channel enqueue error:", fehlertext(error));

    return { enqueued: 0, skipped: true };
  }
}

/**
 * Legt Aufgaben fuer den manuellen Abgleich an - eine je betroffener
 * Zimmerart und Zeitraum. Doppelte offene Aufgaben entstehen nicht.
 *
 * Wirft nie.
 */
export async function enqueueManualTask(bookingId: number) {
  try {
    const booking = await db.orm.hotel.Booking
      .where({ id: bookingId })
      .select("id", "checkIn", "checkOut")
      .include("rooms", (r) => r.select("roomTypeId"))
      .first();

    if (!booking) return { enqueued: 0, skipped: true };

    const von = String(booking.checkIn);
    const bis = String(booking.checkOut);
    const kategorien = [...new Set(booking.rooms.map((room) => room.roomTypeId))];

    const offene = await db.orm.hotel.SyncJob
      .where({
        provider: MANUAL_PROVIDER,
        operation: "AVAILABILITY_PUSH",
        status: "PENDING",
      })
      .select("id", "roomTypeId", "dateFrom", "dateTo")
      .all();

    let angelegt = 0;

    for (const roomTypeId of kategorien) {
      const schonOffen = offene.some(
        (job) =>
          job.roomTypeId === roomTypeId &&
          String(job.dateFrom) === von &&
          String(job.dateTo) === bis
      );

      if (schonOffen) continue;

      await enqueueJob(MANUAL_PROVIDER, {
        operation: "AVAILABILITY_PUSH",
        bookingId: booking.id,
        roomTypeId,
        dateFrom: von,
        dateTo: bis,
        lastError:
          "Verfügbarkeit im Portal von Hand nachziehen. Diese Aufgabe behauptet keine Übertragung.",
      });

      angelegt++;
    }

    return { enqueued: angelegt, skipped: false };
  } catch (error) {
    console.error("Manual task error:", fehlertext(error));

    return { enqueued: 0, skipped: true };
  }
}

/**
 * Hakt eine Aufgabe des manuellen Abgleichs ab. Nur Aufgaben des Anbieters
 * „manual“ - ein echter Auftrag laesst sich nicht von Hand auf erledigt
 * setzen, denn dafuer braucht es die Bestaetigung des Kanals.
 */
export async function completeManualTask(id: number) {
  const job = await db.orm.hotel.SyncJob
    .where({ id, provider: MANUAL_PROVIDER })
    .select("id")
    .first();

  if (!job) return false;

  await db.orm.hotel.SyncJob.where({ id }).update({
    status: "DONE",
    lastError: null,
    completedAt: nowInstant(),
    updatedAt: nowInstant(),
  });

  return true;
}

/**
 * Nimmt faellige Auftraege in Bearbeitung.
 *
 * Unter der Zeilensperre auf der Hotelzeile, damit zwei gleichzeitige
 * Laeufe nicht denselben Auftrag greifen. Die Ausfuehrung selbst passiert
 * danach ausserhalb der Transaktion - ein langsamer Kanal soll keine
 * Datenbanksperre halten.
 */
async function claimJobs(provider: string, limit: number) {
  const hotel = await db.orm.hotel.Hotel.orderBy((h) => h.id.asc()).select("id").first();

  if (!hotel) return [];

  return db.transaction(async (tx) => {
    await tx.orm.hotel.Hotel.where({ id: hotel.id }).update({ updatedAt: nowInstant() });

    const jetzt = nowInstant();

    const faellig = await db.orm.hotel.SyncJob
      .where({ provider, status: "PENDING" })
      .where((job) => job.nextAttemptAt.lte(jetzt))
      .orderBy((job) => job.id.asc())
      .all();

    const genommen = faellig.slice(0, limit);

    for (const job of genommen) {
      await tx.orm.hotel.SyncJob.where({ id: job.id }).update({
        status: "IN_PROGRESS",
        attempts: job.attempts + 1,
        updatedAt: nowInstant(),
      });
    }

    return genommen.map((job) => ({ ...job, attempts: job.attempts + 1 }));
  });
}

async function markJob(
  id: number,
  status: SyncStatus,
  extra: { lastError?: string | null; externalRef?: string | null } = {}
) {
  await db.orm.hotel.SyncJob.where({ id }).update({
    status,
    lastError: extra.lastError ?? null,
    externalRef: extra.externalRef ?? undefined,
    updatedAt: nowInstant(),
    completedAt: status === "DONE" || status === "FAILED" ? nowInstant() : null,
  });
}

async function scheduleRetry(id: number, attempts: number, meldung: string) {
  await db.orm.hotel.SyncJob.where({ id }).update({
    status: "PENDING",
    lastError: meldung,
    nextAttemptAt: nowInstant().add({ minutes: backoffMinutes(attempts) }),
    updatedAt: nowInstant(),
  });
}

/** Verfuegbarkeit einer Kategorie fuer den Zeitraum des Auftrags melden. */
async function runAvailabilityPush(job: {
  id: number;
  roomTypeId: number | null;
  dateFrom: unknown;
  dateTo: unknown;
}) {
  const provider = getChannelProvider();
  const config = channelConfig();

  if (!provider || !config) {
    throw new ChannelError("Kein Vertriebskanal eingerichtet.", { retryable: false });
  }

  if (job.roomTypeId === null || !job.dateFrom || !job.dateTo) {
    throw new ChannelError("Dem Auftrag fehlen Zimmerart oder Zeitraum.", { retryable: false });
  }

  const mapping = await db.orm.hotel.ChannelMapping
    .where({ provider: config.provider, roomTypeId: job.roomTypeId })
    .select("externalPropertyId", "externalRoomTypeId", "syncStatus")
    .first();

  if (!mapping || mapping.syncStatus !== "CONFIRMED") {
    throw new ChannelError("Die Zuordnung dieser Zimmerart ist nicht bestätigt.", {
      retryable: false,
    });
  }

  const von = String(job.dateFrom);
  const bis = String(job.dateTo);
  const naechte = Temporal.PlainDate.from(von).until(Temporal.PlainDate.from(bis)).days;

  const hotel = await db.orm.hotel.Hotel.orderBy((h) => h.id.asc()).select("id").first();

  if (!hotel) throw new ChannelError("Keine Hotelzeile vorhanden.", { retryable: false });

  // Dieselbe Rechnung wie im Belegungskalender.
  const snapshot = await inventoryForRange(hotel.id, von, Math.max(1, naechte));
  const row = snapshot.rows.find((eintrag) => eintrag.roomTypeId === job.roomTypeId);

  const push: AvailabilityPush = {
    externalPropertyId: mapping.externalPropertyId,
    externalRoomTypeId: mapping.externalRoomTypeId,
    days: (row?.days ?? []).map((tag) => ({ date: tag.date, roomsAvailable: tag.free })),
  };

  const ergebnis = await provider.pushAvailability(push);

  if (!ergebnis.accepted) {
    throw new ChannelError("Der Kanal hat die Übertragung nicht bestätigt.");
  }

  return ergebnis.reference;
}

/** Reservierungen beim Kanal abrufen und uebernehmen. */
async function runBookingPull(job: { id: number; dateFrom: unknown }) {
  const provider = getChannelProvider();

  if (!provider) {
    throw new ChannelError("Kein Vertriebskanal eingerichtet.", { retryable: false });
  }

  const seit = job.dateFrom
    ? `${String(job.dateFrom)}T00:00:00Z`
    : String(nowInstant().subtract({ hours: 24 }));

  const externe = await provider.fetchBookings(seit);

  let uebernommen = 0;

  for (const eintrag of externe) {
    const ergebnis = await importExternalBooking(provider.name, eintrag);

    if (ergebnis.status !== "DUPLICATE") uebernommen++;
  }

  return `${uebernommen} von ${externe.length} Reservierungen übernommen`;
}

export type { EnqueueInput };

export { enqueueJob };

export type RunResult = {
  provider: string | null;
  processed: number;
  done: number;
  failed: number;
  retrying: number;
};

/**
 * Arbeitet faellige Auftraege ab.
 *
 * Aufgerufen wird das vom gesicherten Cron-Endpunkt und von der Adminseite.
 * Es laeuft bewusst NICHT beim Oeffnen einer Seite durch einen Gast - eine
 * Synchronisierung, die nur zufaellig stattfindet, waere keine.
 */
export async function runDueJobs(limit = 10): Promise<RunResult> {
  const config = channelConfig();

  // Ohne eingerichteten Kanal gibt es nichts zu uebertragen. Die Aufgaben
  // des manuellen Abgleichs werden bewusst NICHT hier abgearbeitet - sie
  // erledigt der Betrieb im Portal und hakt sie ab.
  if (!config) {
    return { provider: null, processed: 0, done: 0, failed: 0, retrying: 0 };
  }

  const jobs = await claimJobs(config.provider, limit);

  let done = 0;
  let failed = 0;
  let retrying = 0;

  for (const job of jobs) {
    try {
      const referenz =
        job.operation === "AVAILABILITY_PUSH"
          ? await runAvailabilityPush(job)
          : job.operation === "BOOKING_IMPORT"
            ? await runBookingPull(job)
            : null;

      if (job.operation !== "AVAILABILITY_PUSH" && job.operation !== "BOOKING_IMPORT") {
        await markJob(job.id, "FAILED", {
          lastError: `Unbekannter Auftragstyp „${job.operation}“.`,
        });
        failed++;
        continue;
      }

      await markJob(job.id, "DONE", { externalRef: referenz ?? undefined });
      done++;
    } catch (error) {
      const meldung = fehlertext(error);
      const wiederholbar = error instanceof ChannelError ? error.retryable : true;

      if (wiederholbar && job.attempts < job.maxAttempts) {
        await scheduleRetry(job.id, job.attempts, meldung);
        retrying++;
      } else {
        await markJob(job.id, "FAILED", { lastError: meldung });
        failed++;
      }
    }
  }

  return { provider: config.provider, processed: jobs.length, done, failed, retrying };
}

/**
 * Setzt einen Auftrag erneut in die Warteschlange. Die Zahl der Versuche
 * bleibt erhalten, damit die Vorgeschichte sichtbar ist; das Limit wird
 * dafuer angehoben.
 */
export async function retryJob(id: number) {
  const job = await db.orm.hotel.SyncJob.where({ id }).select("id", "attempts", "maxAttempts").first();

  if (!job) return false;

  await db.orm.hotel.SyncJob.where({ id }).update({
    status: "PENDING",
    nextAttemptAt: nowInstant(),
    maxAttempts: Math.max(job.maxAttempts, job.attempts + 1),
    lastError: null,
    completedAt: null,
    updatedAt: nowInstant(),
  });

  return true;
}

/** Legt einen Abrufauftrag an, damit der naechste Lauf Buchungen holt. */
export async function enqueueBookingPull() {
  const config = channelConfig();

  if (!config) return null;

  const offen = await db.orm.hotel.SyncJob
    .where({ provider: config.provider, operation: "BOOKING_IMPORT", status: "PENDING" })
    .select("id")
    .first();

  if (offen) return offen.id;

  return enqueueJob(config.provider, { operation: "BOOKING_IMPORT" });
}
