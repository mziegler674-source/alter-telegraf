import "server-only";

import { NextResponse } from "next/server";

import { HttpError, handle, readBody } from "@/lib/admin-api";
import { getPaymentProvider } from "@/lib/hotel/payment";
import { PaymentError } from "@/lib/hotel/payment/provider";
import { callerIdentifier, consumeRateLimit } from "@/lib/rate-limit";

// Grenzen des Missbrauchsschutzes. Jeder Aufruf legt beim Anbieter einen
// Kunden an, deshalb wird gezaehlt - zweifach, weil beide Merkmale fuer sich
// umgehbar sind:
//
//   je Aufrufer:   bremst eine Schleife von einer Adresse,
//   je Adresse:    bremst die Streuung ueber viele Zugaenge.
//
// Die Werte sind so gewaehlt, dass ein Gast mit Tippfehlern, einem
// Kartenwechsel oder einem zweiten Anlauf nicht auflaeuft.
const LIMIT_AUFRUFER = { limit: 10, windowSeconds: 600 };
const LIMIT_ADRESSE = { limit: 5, windowSeconds: 600 };

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

    // Vor dem Anbieter zaehlen: Ein abgewiesener Aufruf darf dort keinen
    // Kunden anlegen.
    const aufrufer = consumeRateLimit(
      "zahlung-setup-aufrufer",
      callerIdentifier(request),
      LIMIT_AUFRUFER
    );

    if (!aufrufer.allowed) {
      throw new HttpError(
        429,
        "Zu viele Versuche. Bitte versuchen Sie es in einigen Minuten erneut oder rufen Sie das Hotel an: +43 316 686558.",
        { retryAfterSeconds: aufrufer.retryAfterSeconds }
      );
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

    // Erst nach der Pruefung der Eingaben zaehlen, damit ein Tippfehler im
    // Formular kein Guthaben verbraucht.
    const adresse = consumeRateLimit("zahlung-setup-adresse", email, LIMIT_ADRESSE);

    if (!adresse.allowed) {
      throw new HttpError(
        429,
        "Für diese E-Mail-Adresse wurde die Kartenerfassung zu oft gestartet. Bitte versuchen Sie es später erneut oder rufen Sie das Hotel an: +43 316 686558.",
        { retryAfterSeconds: adresse.retryAfterSeconds }
      );
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
