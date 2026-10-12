import "server-only";

import { NextResponse } from "next/server";

import { channelConfigured } from "@/lib/hotel/channel";
import { enqueueBookingPull, runDueJobs } from "@/lib/hotel/channel/sync";

// Geplanter Lauf der Kanalsynchronisierung.
//
// Aufgerufen wird dieser Endpunkt vom Zeitplan der Hosting-Umgebung (siehe
// vercel.json) oder von Hand. Er laeuft NICHT beim Oeffnen einer Seite durch
// einen Gast - eine Synchronisierung, die nur zufaellig stattfindet, waere
// keine.
//
// Absicherung: Ohne CRON_SECRET ist der Endpunkt abgeschaltet. Mit Geheimnis
// wird ein Bearer-Token verlangt; Vercel sendet es bei geplanten Laeufen
// automatisch mit.
//
// WICHTIG zur Taktung: Im kostenlosen Hobby-Tarif von Vercel ist genau EIN
// Lauf pro Tag moeglich. Das genuegt nicht, um Verfuegbarkeiten zeitnah zu
// melden. Der eigentliche Weg fuer eingehende Reservierungen ist deshalb der
// Webhook; dieser Lauf ist das Netz darunter. Siehe
// docs/booking-com-integration.md.

export const dynamic = "force-dynamic";

const MAX_JOBS = 25;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return NextResponse.json(
      { error: "Der geplante Lauf ist nicht eingerichtet (CRON_SECRET fehlt)." },
      { status: 503 }
    );
  }

  const header = request.headers.get("authorization") ?? "";

  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 401 });
  }

  if (!channelConfigured()) {
    return NextResponse.json({
      ran: false,
      reason: "Kein Vertriebskanal eingerichtet.",
    });
  }

  try {
    await enqueueBookingPull();

    const ergebnis = await runDueJobs(MAX_JOBS);

    return NextResponse.json({ ran: true, ...ergebnis });
  } catch (error) {
    console.error("Channel cron error:", error instanceof Error ? error.message : error);

    return NextResponse.json({ error: "Der Lauf ist fehlgeschlagen." }, { status: 500 });
  }
}
