import { createHmac, timingSafeEqual } from "node:crypto";

import type { WebhookEvent } from "./provider";

// Reine Pruefung eingehender Stripe-Ereignisse: ohne Netzwerk, ohne
// Zugangsdaten und ohne Zustand. Dadurch laesst sie sich vollstaendig
// testen, auch bevor ein Stripe-Konto eingerichtet ist.

/**
 * Prüft die Stripe-Signatur. Der Header hat die Form
 * `t=<Zeit>,v1=<HMAC>`; signiert wird `<Zeit>.<Rohtext>` mit SHA-256.
 *
 * Als eigene Funktion, damit sie ohne Netzwerk und ohne Schlüssel des
 * Anbieters getestet werden kann.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!signatureHeader || !secret) return false;

  const teile = new Map(
    signatureHeader
      .split(",")
      .map((teil) => teil.split("=", 2))
      .filter((teil): teil is [string, string] => teil.length === 2)
      .map(([schluessel, wert]) => [schluessel.trim(), wert.trim()])
  );

  const zeit = Number(teile.get("t"));
  const signatur = teile.get("v1");

  if (!Number.isFinite(zeit) || !signatur) return false;

  // Alte Signaturen zurueckweisen, sonst liesse sich ein mitgeschnittener
  // Aufruf beliebig oft wiederholen.
  if (Math.abs(nowSeconds - zeit) > toleranceSeconds) return false;

  const erwartet = createHmac("sha256", secret).update(`${zeit}.${rawBody}`).digest("hex");

  const a = Buffer.from(erwartet, "utf8");
  const b = Buffer.from(signatur, "utf8");

  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/** Liest aus einem Stripe-Ereignis nur die unkritischen Felder heraus. */
export function readStripeEvent(event: Record<string, unknown>): WebhookEvent | null {
  const id = typeof event.id === "string" ? event.id : null;
  const type = typeof event.type === "string" ? event.type : null;

  if (!id || !type) return null;

  const objekt =
    (event.data as { object?: Record<string, unknown> } | undefined)?.object ?? {};
  const metadata = (objekt.metadata as Record<string, string> | undefined) ?? {};

  return {
    id,
    type,
    reference: typeof metadata.reference === "string" ? metadata.reference : null,
    data: {
      customerRef: typeof objekt.customer === "string" ? objekt.customer : null,
      methodRef: typeof objekt.payment_method === "string" ? objekt.payment_method : null,
      status: typeof objekt.status === "string" ? objekt.status : null,
    },
  };
}
