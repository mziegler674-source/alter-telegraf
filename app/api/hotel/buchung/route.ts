import "server-only";

import { NextResponse } from "next/server";

import { HttpError, handle, readBody } from "@/lib/admin-api";
import type { BedType } from "@/lib/hotel/availability";
import {
  createBooking,
  parseGuest,
  parseStayQuery,
} from "@/lib/hotel/booking-service";

// Erstellt eine Online-Buchung. Alles wird serverseitig erneut geprueft:
// Zeitraum, Belegung, Verfuegbarkeit, Bettart und Preis. Werte aus dem
// Frontend werden nie uebernommen.
export async function POST(request: Request) {
  return handle("Hotel booking", async () => {
    const body = await readBody(request);

    const stay = parseStayQuery(body);
    const guest = parseGuest((body.guest ?? {}) as Record<string, unknown>);

    const roomTypeId = Number(body.roomTypeId);

    if (!Number.isInteger(roomTypeId) || roomTypeId < 1) {
      throw new HttpError(400, "Bitte eine Zimmerart wählen.");
    }

    const booking = await createBooking({
      stay,
      roomTypeId,
      bedType: String(body.bedType ?? "") as BedType,
      guest,
      acceptedTerms: body.acceptedTerms === true,
      acceptedPrivacy: body.acceptedPrivacy === true,
      // Nur die Referenz der Kartenhinterlegung. Sie wird serverseitig beim
      // Anbieter nachgeprueft, bevor eine Buchung entsteht.
      cardSetupRef: typeof body.cardSetupRef === "string" ? body.cardSetupRef : null,
    });

    return NextResponse.json({ booking }, { status: 201 });
  });
}
