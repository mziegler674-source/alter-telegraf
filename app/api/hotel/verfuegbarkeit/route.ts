import "server-only";

import { NextResponse } from "next/server";

import { handle, readBody } from "@/lib/admin-api";
import { parseStayQuery, searchStay } from "@/lib/hotel/booking-service";

// Oeffentliche Verfuegbarkeitssuche. Die Antwort enthaelt bewusst keine
// Zimmernummern - der Gast waehlt nur Kategorie und Bettart.
export async function POST(request: Request) {
  return handle("Hotel availability", async () => {
    const stay = parseStayQuery(await readBody(request));

    return NextResponse.json(await searchStay(stay));
  });
}
