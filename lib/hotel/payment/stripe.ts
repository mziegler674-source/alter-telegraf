import "server-only";

import { readStripeEvent, verifyStripeSignature } from "./stripe-webhook";
import {
  PaymentError,
  type PaymentProvider,
  type StoredCard,
  type WebhookEvent,
} from "./provider";

// Stripe-Anbindung ueber die REST-API. Bewusst ohne zusaetzliche
// Abhaengigkeit: Der Umfang ist klein, und so bleibt nachvollziehbar, was
// ueber die Leitung geht.
//
// Die Karte wird als Zahlungsmethode HINTERLEGT (SetupIntent), nicht als
// Autorisierung gehalten. Eine Kartenautorisierung verfaellt nach wenigen
// Tagen und taugt deshalb nicht als Garantie fuer eine Buchung, die Wochen
// in der Zukunft liegt.

const API = "https://api.stripe.com/v1";

/** Formulardaten flach kodieren, wie Stripe sie erwartet. */
function encode(data: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) params.append(key, String(value));
  }

  return params.toString();
}

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe";

  constructor(
    private readonly secretKey: string,
    private readonly publishableKey: string,
    private readonly webhookSecret: string
  ) {}

  private async call(
    pfad: string,
    data?: Record<string, string | number | undefined>,
    idempotencyKey?: string
  ) {
    const response = await fetch(`${API}${pfad}`, {
      method: data ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        ...(data ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: data ? encode(data) : undefined,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Die Meldung des Anbieters kann Kartenhinweise enthalten, aber nie
      // vollstaendige Kartendaten. Trotzdem wird sie gekuerzt weitergegeben.
      const grund = typeof body?.error?.message === "string" ? body.error.message : "unbekannt";

      throw new PaymentError(`Stripe (${pfad}): ${grund.slice(0, 200)}`);
    }

    return body;
  }

  async startCardSetup(input: { email: string; name: string; reference: string }) {
    const customer = await this.call("/customers", {
      email: input.email,
      name: input.name,
      "metadata[reference]": input.reference,
    });

    const setupIntent = await this.call("/setup_intents", {
      customer: customer.id,
      usage: "off_session",
      "payment_method_types[0]": "card",
      "metadata[reference]": input.reference,
    });

    return {
      clientSecret: setupIntent.client_secret as string,
      publishableKey: this.publishableKey,
      customerRef: customer.id as string,
    };
  }

  async confirmCardSetup(setupRef: string) {
    const setupIntent = await this.call(`/setup_intents/${encodeURIComponent(setupRef)}`);

    if (setupIntent.status !== "succeeded") return null;
    if (!setupIntent.customer || !setupIntent.payment_method) return null;

    return {
      customerRef: String(setupIntent.customer),
      methodRef: String(setupIntent.payment_method),
    };
  }

  async chargeStoredCard(input: {
    card: StoredCard;
    amountInCents: number;
    currency: string;
    description: string;
    idempotencyKey: string;
  }) {
    const intent = await this.call(
      "/payment_intents",
      {
        amount: input.amountInCents,
        currency: input.currency.toLowerCase(),
        customer: input.card.customerRef,
        payment_method: input.card.methodRef,
        off_session: "true",
        confirm: "true",
        description: input.description,
      },
      input.idempotencyKey
    );

    return {
      chargeRef: String(intent.id),
      succeeded: intent.status === "succeeded",
      status: String(intent.status),
    };
  }

  async releaseStoredCard(card: StoredCard) {
    await this.call(`/payment_methods/${encodeURIComponent(card.methodRef)}/detach`, {});
  }

  verifyWebhook(rawBody: string, signatureHeader: string | null): WebhookEvent | null {
    if (!verifyStripeSignature(rawBody, signatureHeader, this.webhookSecret)) {
      return null;
    }

    let event: Record<string, unknown>;

    try {
      event = JSON.parse(rawBody);
    } catch {
      return null;
    }

    return readStripeEvent(event);
  }
}

export { readStripeEvent, verifyStripeSignature };
