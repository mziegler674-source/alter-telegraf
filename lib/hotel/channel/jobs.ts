import "server-only";
import "temporal-polyfill/full/global";

import { Temporal } from "temporal-polyfill";

import { nowInstant } from "@/lib/admin-api";
import { db } from "@/prisma/db";

import type { SyncOperation, SyncStatus } from "./provider";

// Schreibzugriff auf die Auftragstabelle.
//
// Eigene Datei, damit sowohl die Uebernahme externer Reservierungen als auch
// die Auftragsverarbeitung Auftraege anlegen koennen, ohne sich gegenseitig
// zu importieren.

/** Status, nach denen kein weiterer Versuch mehr folgt. */
const ABGESCHLOSSEN: SyncStatus[] = ["DONE", "SKIPPED", "FAILED", "ATTENTION", "NEEDS_MAPPING"];

export type EnqueueInput = {
  operation: SyncOperation;
  direction?: "INBOUND" | "OUTBOUND";
  status?: SyncStatus;
  bookingId?: number | null;
  roomTypeId?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  externalRef?: string | null;
  messageId?: string | null;
  payload?: unknown;
  lastError?: string | null;
};

const datum = (value: string | null | undefined) =>
  value ? Temporal.PlainDate.from(value) : null;

/**
 * Legt einen Auftrag an und gibt seine ID zurueck.
 *
 * Ein Auftrag mit messageId kann nur einmal entstehen: Die Datenbank hat
 * darauf einen Unique-Constraint. Geht dieselbe Nachricht erneut ein,
 * scheitert das Anlegen - und genau daran erkennt der Aufrufer die
 * Wiederholung.
 */
export async function enqueueJob(provider: string, input: EnqueueInput) {
  const row = await db.orm.hotel.SyncJob.create({
    provider,
    direction: input.direction ?? "OUTBOUND",
    operation: input.operation,
    status: input.status ?? "PENDING",
    bookingId: input.bookingId ?? null,
    roomTypeId: input.roomTypeId ?? null,
    dateFrom: datum(input.dateFrom),
    dateTo: datum(input.dateTo),
    externalRef: input.externalRef ?? null,
    messageId: input.messageId ?? null,
    payload: (input.payload ?? null) as never,
    nextAttemptAt: nowInstant(),
    lastError: input.lastError ?? null,
    completedAt:
      input.status && ABGESCHLOSSEN.includes(input.status) ? nowInstant() : null,
  });

  return row.id;
}
