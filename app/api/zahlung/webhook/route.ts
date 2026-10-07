import "server-only";
import "temporal-polyfill/full/global";

import { NextResponse } from "next/server";

import { nowInstant } from "@/lib/admin-api";
import { getPaymentProvider } from "@/lib/hotel/payment";
import { db } from "@/prisma/db";

// Webhook des Zahlungsanbieters. Nur dieser Weg darf den Zahlungsstatus
// aendern - eine Meldung aus dem Browser wird nie geglaubt.
//
// Drei Dinge sind hier wesentlich:
//   1. Die Signatur wird geprueft, bevor irgendetwas gelesen wird.
//   2. Jedes Ereignis wird genau einmal verarbeitet. Die Eindeutigkeit
//      erzwingt die Datenbank, nicht eine Abfrage davor.
//   3. Fehler werden mit 200 quittiert, sobald das Ereignis vermerkt ist,
//      damit der Anbieter nicht endlos wiederholt.

export async function POST(request: Request) {
  const provider = getPaymentProvider();

  if (!provider) {
    return NextResponse.json({ error: "Kein Anbieter eingerichtet." }, { status: 503 });
  }

  // Der Rohtext wird fuer die Signaturpruefung gebraucht, unveraendert.
  const rawBody = await request.text();
  const event = provider.verifyWebhook(rawBody, request.headers.get("stripe-signature"));

  if (!event) {
    // Bewusst ohne Einzelheiten: Wer die Signatur nicht treffen kann, soll
    // auch nicht erfahren, woran es lag.
    return NextResponse.json({ error: "Ungültige Signatur." }, { status: 400 });
  }

  // Idempotenz: Das Einfügen schlägt fehl, wenn das Ereignis schon da war.
  try {
    await db.orm.hotel.PaymentEvent.create({
      provider: provider.name,
      eventId: event.id,
      eventType: event.type,
    });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const booking = event.data.methodRef
    ? await db.orm.hotel.Booking
        .where({ paymentMethodRef: event.data.methodRef })
        .select("id", "paymentStatus", "paymentChargedAt")
        .first()
    : null;

  let ergebnis = "ohne Zuordnung";

  if (booking) {
    const status = statusFor(event.type, event.data.status);

    if (status) {
      await db.orm.hotel.Booking.where({ id: booking.id }).update({
        paymentStatus: status,
        ...(status === "CHARGED" && !booking.paymentChargedAt
          ? { paymentChargedAt: nowInstant() }
          : {}),
        ...(status === "VERIFIED" ? { paymentAuthorizedAt: nowInstant() } : {}),
        updatedAt: nowInstant(),
      });

      ergebnis = `Buchung ${booking.id} → ${status}`;
    } else {
      ergebnis = `Buchung ${booking.id}, kein Statuswechsel`;
    }

    await db.orm.hotel.PaymentEvent
      .where({ provider: provider.name, eventId: event.id })
      .update({ bookingId: booking.id, result: ergebnis });
  } else {
    await db.orm.hotel.PaymentEvent
      .where({ provider: provider.name, eventId: event.id })
      .update({ result: ergebnis });
  }

  return NextResponse.json({ received: true });
}

/** Ereignis des Anbieters auf unseren Zahlungsstatus abbilden. */
function statusFor(type: string, status: string | null | undefined) {
  if (type === "setup_intent.succeeded") return "VERIFIED" as const;
  if (type === "setup_intent.setup_failed") return "FAILED" as const;
  if (type === "payment_intent.succeeded") return "CHARGED" as const;
  if (type === "payment_intent.payment_failed") return "FAILED" as const;
  if (type === "payment_method.detached") return "CANCELLED" as const;

  // Unbekannte Ereignisse werden vermerkt, aber ändern nichts.
  void status;

  return null;
}
