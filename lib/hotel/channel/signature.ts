import { createHmac, timingSafeEqual } from "node:crypto";

// Signatur eingehender Kanalnachrichten.
//
// Aufbau wie bei der Zahlungsschnittstelle, weil sich das Verfahren dort
// bewaehrt hat: Der Kopf enthaelt Zeitstempel und Signatur,
//
//   X-Channel-Signature: t=<unix-sekunden>,v1=<hmac_sha256(t.body)>
//
// Der Zeitstempel geht in die Signatur ein und wird gegen ein Zeitfenster
// geprueft. Eine abgefangene Nachricht laesst sich damit nicht beliebig
// spaeter erneut einspielen.
//
// Ohne Datenbank und ohne Umgebungszugriff - pruefbar im Test.

export const SIGNATURE_HEADER = "x-channel-signature";

export function signPayload(body: string, secret: string, timestampSeconds: number) {
  const mac = createHmac("sha256", secret).update(`${timestampSeconds}.${body}`).digest("hex");

  return `t=${timestampSeconds},v1=${mac}`;
}

function parseHeader(header: string) {
  const teile = header.split(",");
  let timestamp: number | null = null;
  let signature: string | null = null;

  for (const teil of teile) {
    const [schluessel, wert] = teil.split("=", 2);

    if (schluessel?.trim() === "t") timestamp = Number(wert);
    if (schluessel?.trim() === "v1") signature = wert?.trim() ?? null;
  }

  return { timestamp, signature };
}

function gleich(a: string, b: string) {
  const links = Buffer.from(a);
  const rechts = Buffer.from(b);

  if (links.length !== rechts.length) return false;

  return timingSafeEqual(links, rechts);
}

export type SignatureResult =
  | { ok: true }
  | { ok: false; reason: "MISSING" | "MALFORMED" | "EXPIRED" | "INVALID" };

export function verifySignature(
  body: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000)
): SignatureResult {
  if (!header) return { ok: false, reason: "MISSING" };
  if (!secret) return { ok: false, reason: "MISSING" };

  const { timestamp, signature } = parseHeader(header);

  if (!signature || timestamp === null || !Number.isFinite(timestamp)) {
    return { ok: false, reason: "MALFORMED" };
  }

  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return { ok: false, reason: "EXPIRED" };
  }

  const erwartet = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

  return gleich(erwartet, signature) ? { ok: true } : { ok: false, reason: "INVALID" };
}

export const SIGNATURE_REASONS: Record<
  Exclude<SignatureResult, { ok: true }>["reason"],
  string
> = {
  MISSING: "Signatur fehlt.",
  MALFORMED: "Signatur ist unlesbar.",
  EXPIRED: "Signatur ist zu alt.",
  INVALID: "Signatur stimmt nicht.",
};
