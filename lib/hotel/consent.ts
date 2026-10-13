// Nachweis der Zustimmung des Gastes.
//
// Festgehalten wird, WAS dem Gast gezeigt wurde, DASS er zugestimmt hat und
// WANN. Der Nachweis entsteht serverseitig aus dem eingefrorenen Stand der
// Stornobedingungen - nie aus einer Behauptung des Browsers.
//
// Der angezeigte Text wird nicht ein zweites Mal gespeichert, sondern als
// Streuwert (SHA-256) festgehalten. Das genuegt als Nachweis: Zu einem
// spaeteren Zeitpunkt laesst sich jeder Text gegen den Streuwert pruefen,
// und der Wortlaut steht ohnehin im Schnappschuss derselben Buchung.
//
// Ohne Datenbank und ohne Umgebung - vollstaendig testbar.

import { createHash } from "node:crypto";

export const CONSENT_VERSION = 1 as const;

export type ConsentRecord = {
  version: typeof CONSENT_VERSION;
  /** Zeitpunkt der Zustimmung, ISO-8601 mit Zeitzone. */
  at: string;
  /** Zustimmung zu den Buchungsbedingungen. Immer true - sonst entsteht keine Buchung. */
  terms: true;
  /** Zustimmung zur Datenschutzerklaerung. Immer true. */
  privacy: true;
  /** Zustimmung zu den angezeigten Stornobedingungen. */
  cancellation: {
    /** Kennung der Richtlinie, etwa "STANDARD". */
    policyCode: string;
    /** Version des Schnappschussformats, aus dem der Text stammt. */
    snapshotVersion: number;
    /** SHA-256 des angezeigten Textes, hexadezimal. */
    textHash: string;
    /** Anzahl der angezeigten Zeilen - eine schnelle Plausibilitaetspruefung. */
    lineCount: number;
    /**
     * True, wenn der Browser denselben Streuwert mitgeschickt hat, den der
     * Server berechnet hat. Dann ist belegt, dass genau dieser Text auf dem
     * Bildschirm stand. False heisst nur: nicht bestaetigt - nicht, dass
     * etwas anderes gezeigt wurde.
     */
    displayConfirmed: boolean;
  };
};

/**
 * Streuwert des angezeigten Textes. Vor dem Rechnen werden Leerraeume
 * normalisiert, damit Zeilenumbrueche und Einzuege das Ergebnis nicht
 * veraendern - der Wortlaut entscheidet, nicht die Formatierung.
 */
export function hashPolicyText(lines: readonly string[]): string {
  const normalisiert = lines
    .map((zeile) => zeile.replace(/\s+/g, " ").trim())
    .filter((zeile) => zeile.length > 0)
    .join("\n");

  return createHash("sha256").update(normalisiert, "utf8").digest("hex");
}

export type ConsentInput = {
  /** Beide Haken. Fehlt einer, darf kein Nachweis entstehen. */
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  /** Kennung der eingefrorenen Richtlinie. */
  policyCode: string;
  /** Version des Schnappschussformats. */
  snapshotVersion: number;
  /** Der Text, wie er dem Gast gezeigt wurde - serverseitig erzeugt. */
  shownText: readonly string[];
  /** Streuwert, den der Browser mitgeschickt hat, oder null. */
  clientHash?: string | null;
  /** Zeitpunkt, ISO-8601. */
  at: string;
};

/**
 * Baut den Nachweis. Liefert null, wenn eine Zustimmung fehlt - dann darf
 * die Buchung ohnehin nicht entstehen.
 */
export function buildConsentRecord(input: ConsentInput): ConsentRecord | null {
  if (!input.acceptedTerms || !input.acceptedPrivacy) return null;

  const textHash = hashPolicyText(input.shownText);

  return {
    version: CONSENT_VERSION,
    at: input.at,
    terms: true,
    privacy: true,
    cancellation: {
      policyCode: input.policyCode,
      snapshotVersion: input.snapshotVersion,
      textHash,
      lineCount: input.shownText.filter((zeile) => zeile.trim().length > 0).length,
      // Gleichheit wird in konstanter Zeit nicht gebraucht: Der Streuwert
      // ist kein Geheimnis, er steht in der Antwort der Suche.
      displayConfirmed:
        typeof input.clientHash === "string" &&
        input.clientHash.toLowerCase() === textHash,
    },
  };
}

/** Liest einen gespeicherten Nachweis zurueck, soweit er brauchbar ist. */
export function readConsentRecord(value: unknown): ConsentRecord | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Partial<ConsentRecord>;

  if (record.terms !== true || record.privacy !== true) return null;
  if (typeof record.at !== "string" || !record.at) return null;
  if (!record.cancellation || typeof record.cancellation.textHash !== "string") {
    return null;
  }

  return record as ConsentRecord;
}

/**
 * Prueft einen vorliegenden Text gegen den Nachweis. Damit laesst sich
 * spaeter belegen, dass dem Gast genau dieser Wortlaut gezeigt wurde.
 */
export function consentMatchesText(
  record: ConsentRecord,
  lines: readonly string[]
): boolean {
  return hashPolicyText(lines) === record.cancellation.textHash;
}
