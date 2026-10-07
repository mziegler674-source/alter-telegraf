import "server-only";

import { NextResponse } from "next/server";

import { HttpError, handle, readBody } from "@/lib/admin-api";
import { getPaymentProvider } from "@/lib/hotel/payment";
import { PaymentError } from "@/lib/hotel/payment/provider";

// Beginnt die Kartenhinterlegung. Die Antwort enthaelt nur das Geheimnis
// fuer den Browser und den oeffentlichen Schluessel - die Karte selbst wird
// anschliessend direkt beim Anbieter eingegeben und beruehrt diesen Server
// nie.
export async function POST(request: Request) {
  return handle("Card setup", async () => {
    const provider = getPaymentProvider();

    if (!provider) {
      throw new HttpError(503, "Die Kartenhinterlegung ist derzeit nicht verfügbar.");
    }

    const body = await readBody(request);

    const email = String(body.email ?? "").trim();
    const name = String(body.name ?? "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new HttpError(400, "Bitte eine gültige E-Mail-Adresse angeben.");
    }

    if (name.length < 2 || name.length > 160) {
      throw new HttpError(400, "Bitte Vor- und Nachnamen angeben.");
    }

    try {
      const session = await provider.startCardSetup({
        email,
        name,
        // Zu diesem Zeitpunkt existiert noch keine Buchungsnummer. Die
        // Zuordnung erfolgt beim Anlegen der Buchung ueber die Referenzen.
        reference: `setup-${Date.now()}`,
      });

      return NextResponse.json({
        clientSecret: session.clientSecret,
        publishableKey: session.publishableKey,
      });
    } catch (error) {
      if (error instanceof PaymentError) {
        throw new HttpError(502, "Die Kartenerfassung konnte nicht gestartet werden.");
      }

      throw error;
    }
  });
}
