import "server-only";

import { NextResponse } from "next/server";

import { nowInstant } from "@/lib/admin-api";
import { channelConfig, getChannelProvider, redactChannelSecrets } from "@/lib/hotel/channel";
import { importExternalBooking } from "@/lib/hotel/channel/import";
import { enqueueJob } from "@/lib/hotel/channel/jobs";
import { SIGNATURE_HEADER } from "@/lib/hotel/channel/signature";
import { enqueueAvailabilityForBooking } from "@/lib/hotel/channel/sync";
import { db } from "@/prisma/db";

// Eingang einer Kanalnachricht.
//
// Reihenfolge und Begruendung:
//
//  1. Signatur pruefen. Ohne gueltige Signatur wird NICHTS gelesen und
//     nichts uebernommen. Der Zeitstempel ist Teil der Signatur, eine alte
//     Nachricht laesst sich damit nicht erneut einspielen.
//  2. Nachricht registrieren. Die Datenbank hat einen Unique-Constraint auf
//     (provider, messageId). Geht dieselbe Nachricht erneut ein, schlaegt
//     das Anlegen fehl - genau daran wird die Wiederholung erkannt, ohne
//     Vorabpruefung und damit ohne Zeitfenster fuer ein Wettrennen.
//  3. Reservierung uebernehmen.
//  4. Ergebnis in dieselbe Zeile schreiben.
//
// Fehlerantworten nennen keine internen Details.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const config = channelConfig();

  if (!config) {
    return NextResponse.json({ error: "Kein Vertriebskanal eingerichtet." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get(SIGNATURE_HEADER);

  let provider;

  try {
    provider = getChannelProvider();
  } catch (error) {
    console.error("Channel webhook provider error:", redactChannelSecrets(String(error)));

    return NextResponse.json({ error: "Kanal nicht verfügbar." }, { status: 503 });
  }

  if (!provider) {
    return NextResponse.json({ error: "Kein Vertriebskanal eingerichtet." }, { status: 503 });
  }

  const external = provider.readWebhook(rawBody, signature);

  if (!external) {
    // Bewusst knapp: Der Aufrufer erfaehrt nicht, woran es lag.
    return NextResponse.json({ error: "Nachricht abgewiesen." }, { status: 401 });
  }

  // Ohne Nachrichtenkennung kann nur die Reservierungsnummer als Schluessel
  // dienen. Sie ist stabil, deshalb ist auch das idempotent.
  const messageId = external.messageId?.trim() || `ref:${external.externalRef}`;

  let jobId: number;

  try {
    jobId = await enqueueJob(provider.name, {
      direction: "INBOUND",
      operation: "BOOKING_IMPORT",
      status: "IN_PROGRESS",
      externalRef: external.externalRef,
      messageId,
    });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const ergebnis = await importExternalBooking(
      provider.name,
      { ...external, messageId: null },
      { recordJob: false }
    );

    const status =
      ergebnis.status === "NEEDS_MAPPING"
        ? "NEEDS_MAPPING"
        : ergebnis.status === "UNKNOWN_REFERENCE"
          ? "ATTENTION"
          : ergebnis.overbooked
            ? "ATTENTION"
            : "DONE";

    await db.orm.hotel.SyncJob.where({ id: jobId }).update({
      status,
      operation:
        ergebnis.status === "CANCELLED"
          ? "BOOKING_CANCEL"
          : ergebnis.status === "UPDATED"
            ? "BOOKING_CHANGE"
            : "BOOKING_IMPORT",
      bookingId: ergebnis.bookingId,
      lastError: ergebnis.message,
      updatedAt: nowInstant(),
      completedAt: nowInstant(),
    });

    // Die Belegung hat sich geaendert: Der Kanal braucht die neue
    // Verfuegbarkeit. Scheitert das, bleibt es als Auftrag sichtbar.
    if (ergebnis.bookingId) {
      await enqueueAvailabilityForBooking(ergebnis.bookingId);
    }

    return NextResponse.json({
      received: true,
      result: ergebnis.status,
      bookingNumber: ergebnis.bookingNumber,
      overbooked: ergebnis.overbooked,
    });
  } catch (error) {
    const meldung = redactChannelSecrets(
      error instanceof Error ? error.message : String(error)
    ).slice(0, 500);

    console.error("Channel webhook import error:", meldung);

    await db.orm.hotel.SyncJob.where({ id: jobId }).update({
      status: "FAILED",
      lastError: meldung,
      updatedAt: nowInstant(),
      completedAt: nowInstant(),
    });

    // Der Kanal soll es erneut versuchen duerfen.
    return NextResponse.json({ error: "Verarbeitung fehlgeschlagen." }, { status: 500 });
  }
}
