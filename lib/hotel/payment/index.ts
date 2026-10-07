import "server-only";

import { type PaymentProvider } from "./provider";
import { StripeProvider } from "./stripe";

// Der Anbieter wird erst beim Aufruf erzeugt, nie beim Laden des Moduls.
// Ein fehlender Schluessel darf den Build nicht zum Absturz bringen - genau
// daran ist in diesem Projekt schon einmal ein Deployment gescheitert.

export const PAYMENT_ENV = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;

/** True, wenn ein Anbieter vollstaendig eingerichtet ist. */
export function paymentConfigured(): boolean {
  return PAYMENT_ENV.every((name) => Boolean(process.env[name]));
}

/** Der eingerichtete Anbieter, oder null. */
export function getPaymentProvider(): PaymentProvider | null {
  if (!paymentConfigured()) return null;

  const secret = process.env.STRIPE_SECRET_KEY as string;

  // Schutz gegen Unfaelle: Solange die Garantie nicht ausdruecklich scharf
  // geschaltet ist, werden Live-Schluessel abgelehnt.
  if (secret.startsWith("sk_live_") && process.env.STRIPE_ALLOW_LIVE !== "true") {
    throw new Error(
      "Es ist ein Stripe-Live-Schlüssel hinterlegt. Für den Testbetrieb bitte einen sk_test_-Schlüssel verwenden."
    );
  }

  return new StripeProvider(
    secret,
    process.env.STRIPE_PUBLISHABLE_KEY as string,
    process.env.STRIPE_WEBHOOK_SECRET as string
  );
}

export { PaymentError } from "./provider";
export type { ChargeResult, PaymentProvider, StoredCard, WebhookEvent } from "./provider";
