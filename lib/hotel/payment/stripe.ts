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

  /**
   * Wie `call`, liefert aber null, wenn der Anbieter den Datensatz nicht
   * kennt. Eine erfundene oder abgelaufene Kennung ist kein Stoerfall des
   * Anbieters, sondern eine ungueltige Eingabe - sie darf keinen 502
   * ausloesen.
   */
  private async callOptional(pfad: string) {
    const response = await fetch(`${API}${pfad}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });

    const body = await response.json().catch(() => ({}));

    if (response.status === 404 || body?.error?.code === "resource_missing") {
      return null;
    }

    if (!response.ok) {
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

    // Zahlungsarten verwaltet Stripe inzwischen im Dashboard des Kontos;
    // `payment_method_types` wird von der aktuellen API-Version abgelehnt.
    // `allow_redirects: never` haelt Verfahren mit Weiterleitung heraus -
    // eine Garantie soll den Gast nicht aus der Buchungsstrecke fuehren.
    //
    // Dass am Ende wirklich eine KARTE hinterlegt ist, prueft
    // `confirmCardSetup` selbst. Darauf verlassen wir uns, nicht auf die
    // Einstellungen im Dashboard.
    const setupIntent = await this.call("/setup_intents", {
      customer: customer.id,
      usage: "off_session",
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never",
      "metadata[reference]": input.reference,
    });

    return {
      clientSecret: setupIntent.client_secret as string,
      publishableKey: this.publishableKey,
      customerRef: customer.id as string,
    };
  }

  async confirmCardSetup(setupRef: string) {
    // Nur Kennungen von Stripe annehmen. Ohne das landet jede Eingabe des
    // Browsers im Pfad der Anfrage.
    if (!/^seti_[A-Za-z0-9_]+$/.test(setupRef)) return null;

    // Kunde und Zahlungsmethode in einem Aufruf mitladen: Die E-Mail haengt
    // am Kunden, die Art an der Methode - beides wird hier gebraucht.
    const setupIntent = await this.callOptional(
      `/setup_intents/${encodeURIComponent(setupRef)}` +
        "?expand[]=customer&expand[]=payment_method"
    );

    if (!setupIntent) return null;
    if (setupIntent.status !== "succeeded") return null;
    if (!setupIntent.customer || !setupIntent.payment_method) return null;

    const kunde = setupIntent.customer as Record<string, unknown> | string;
    const methode = setupIntent.payment_method as Record<string, unknown> | string;

    const customerRef = typeof kunde === "string" ? kunde : String(kunde.id);
    const methodRef = typeof methode === "string" ? methode : String(methode.id);

    // Es muss eine KARTE sein. Eine Garantie, die sich nicht spaeter
    // belasten laesst, waere keine - und was das Dashboard anbietet, liegt
    // nicht in unserer Hand.
    const art = typeof methode === "string" ? null : String(methode.type ?? "");

    if (art !== null && art !== "card") return null;

    const customerEmail =
      typeof kunde === "string" || typeof kunde.email !== "string"
        ? null
        : kunde.email;

    const metadata = (setupIntent.metadata as Record<string, string> | undefined) ?? {};

    return {
      customerRef,
      methodRef,
      customerEmail,
      reference: typeof metadata.reference === "string" ? metadata.reference : null,
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
