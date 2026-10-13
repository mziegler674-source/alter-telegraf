import { toCents } from "./pricing";

// Welcher Preis gilt in welcher Nacht?
//
// Das Datenmodell kann das schon: RatePrice ohne Datum ist der Grundpreis,
// RatePrice MIT Datum ist der Preis genau dieser Nacht. Diese Datei wertet
// das aus - und zwar an einer einzigen Stelle, damit Buchungsstrecke,
// Preiskalender und Admin-Vorschau nicht auseinanderlaufen koennen.
//
// VORRANGREGEL, verbindlich und getestet:
//
//   1. Gibt es fuer (Zimmerart, Belegung, genau diese Nacht) einen Preis mit
//      Datum, dann gilt dieser. Immer. Er uebersteuert jede allgemeine Regel.
//   2. Sonst gilt der Grundpreis fuer (Zimmerart, Belegung).
//   3. Gibt es beides nicht, ist die Nacht nicht bepreist - dann wird die
//      Kategorie fuer diesen Aufenthalt NICHT angeboten. Es wird nichts
//      geschaetzt und nichts hochgerechnet.
//
// Mehrdeutigkeit kann nicht entstehen: Die Datenbank laesst je (Rate Plan,
// Zimmerart, Datum, Belegung) nur eine Zeile zu, und ein Teilindex sichert
// genau einen Grundpreis je Belegung. Die Reihenfolge der Abfrage spielt
// deshalb keine Rolle - gesucht wird ueber eine Zuordnung, nicht ueber die
// erste passende Zeile.
//
// Ohne Datenbankzugriff, damit dieselbe Logik im Test laeuft.

export type PriceSource = "BASE" | "DATE";

export const PRICE_SOURCE_LABELS: Record<PriceSource, string> = {
  BASE: "Grundpreis",
  DATE: "Individuell",
};

/** Eine Preiszeile aus RatePrice. date === null bedeutet Grundpreis. */
export type RatePriceRow = {
  roomTypeId: number;
  occupancy: number;
  /** YYYY-MM-DD oder null. */
  date: string | null;
  /** Dezimalbetrag als Text. */
  amount: string;
};

export type NightPrice = {
  /** YYYY-MM-DD */
  date: string;
  amount: string;
  source: PriceSource;
};

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/** Ein Tag weiter, ohne Zeitzonenfallen. */
export function nextDate(date: string): string {
  const [jahr, monat, tag] = date.split("-").map(Number);
  const d = new Date(Date.UTC(jahr, monat - 1, tag + 1));

  return d.toISOString().slice(0, 10);
}

/**
 * Die Naechte eines Aufenthalts als Datumsliste.
 *
 * Der Abreisetag ist KEINE Nacht und kommt nicht vor: 10. bis 12. ergibt
 * den 10. und den 11.
 */
export function stayNights(checkIn: string, checkOut: string): string[] {
  if (!DATUM.test(checkIn) || !DATUM.test(checkOut)) {
    throw new Error("Ungültiges Datum.");
  }

  const naechte: string[] = [];
  let aktuell = checkIn;

  // Obergrenze als Schutz vor einer Endlosschleife bei verdrehten Daten.
  for (let i = 0; aktuell < checkOut && i < 400; i++) {
    naechte.push(aktuell);
    aktuell = nextDate(aktuell);
  }

  return naechte;
}

/** Schlüssel der Zuordnung: Belegung und Datum. */
const key = (occupancy: number, date: string | null) => `${occupancy}|${date ?? "BASE"}`;

export type PriceIndex = {
  /** Preis fuer genau diese Nacht, oder null. */
  dated(occupancy: number, date: string): string | null;
  /** Grundpreis, oder null. */
  base(occupancy: number): string | null;
};

/**
 * Baut aus den Preiszeilen einer Zimmerart eine Zuordnung. Danach ist jede
 * Abfrage eindeutig und von der Zeilenreihenfolge unabhaengig.
 */
export function indexPrices(rows: RatePriceRow[], roomTypeId: number): PriceIndex {
  const zuordnung = new Map<string, string>();

  for (const row of rows) {
    if (row.roomTypeId !== roomTypeId) continue;

    zuordnung.set(key(row.occupancy, row.date), row.amount);
  }

  return {
    dated: (occupancy, date) => zuordnung.get(key(occupancy, date)) ?? null,
    base: (occupancy) => zuordnung.get(key(occupancy, null)) ?? null,
  };
}

export type ResolveInput = {
  /** Naechte des Aufenthalts, aus stayNights. */
  nights: string[];
  rows: RatePriceRow[];
  roomTypeId: number;
  occupancy: number;
};

/**
 * Preis je Nacht nach der Vorrangregel.
 *
 * Gibt null zurueck, wenn fuer mindestens eine Nacht kein Preis zu
 * ermitteln ist. Dann darf die Kategorie nicht angeboten werden.
 */
export function resolveNightPrices(input: ResolveInput): NightPrice[] | null {
  if (input.nights.length === 0) return null;

  const index = indexPrices(input.rows, input.roomTypeId);
  const grundpreis = index.base(input.occupancy);

  const ergebnis: NightPrice[] = [];

  for (const nacht of input.nights) {
    const tagespreis = index.dated(input.occupancy, nacht);

    if (tagespreis !== null) {
      ergebnis.push({ date: nacht, amount: tagespreis, source: "DATE" });
      continue;
    }

    if (grundpreis === null) return null;

    ergebnis.push({ date: nacht, amount: grundpreis, source: "BASE" });
  }

  return ergebnis;
}

/** Summe der Naechte in ganzen Cent. */
export function nightsTotalCents(nights: NightPrice[]): number {
  return nights.reduce((summe, nacht) => summe + toCents(nacht.amount), 0);
}

export type PriceSpan = {
  /** Niedrigster Preis einer Nacht, als Dezimaltext. */
  min: string;
  max: string;
  /** Unterscheiden sich die Naechte? */
  varies: boolean;
  /** Mindestens eine Nacht hat einen individuellen Preis. */
  hasIndividual: boolean;
};

export function priceSpan(nights: NightPrice[]): PriceSpan {
  if (nights.length === 0) {
    return { min: "0.00", max: "0.00", varies: false, hasIndividual: false };
  }

  let min = nights[0];
  let max = nights[0];

  for (const nacht of nights) {
    if (toCents(nacht.amount) < toCents(min.amount)) min = nacht;
    if (toCents(nacht.amount) > toCents(max.amount)) max = nacht;
  }

  return {
    min: min.amount,
    max: max.amount,
    varies: toCents(min.amount) !== toCents(max.amount),
    hasIndividual: nights.some((nacht) => nacht.source === "DATE"),
  };
}

// ---------------------------------------------------------------------------
// Preise aendern
//
// Die folgenden Funktionen berechnen, WELCHE Preise entstehen wuerden. Sie
// schreiben nichts. Die Oberflaeche zeigt damit eine Vorschau, und erst ein
// zweiter Schritt speichert - so kann niemand versehentlich Tage ausserhalb
// des gewaehlten Zeitraums veraendern.
// ---------------------------------------------------------------------------

export const WEEKDAYS = [
  { value: 1, short: "Mo", label: "Montag" },
  { value: 2, short: "Di", label: "Dienstag" },
  { value: 3, short: "Mi", label: "Mittwoch" },
  { value: 4, short: "Do", label: "Donnerstag" },
  { value: 5, short: "Fr", label: "Freitag" },
  { value: 6, short: "Sa", label: "Samstag" },
  { value: 0, short: "So", label: "Sonntag" },
] as const;

/** Wochentag eines Datums: 0 = Sonntag, 1 = Montag … */
export function weekdayOf(date: string): number {
  const [jahr, monat, tag] = date.split("-").map(Number);

  return new Date(Date.UTC(jahr, monat - 1, tag)).getUTCDay();
}

export type PriceChangeMode =
  /** Festen Preis setzen. */
  | "SET"
  /** Prozentual auf den bisher gueltigen Preis. */
  | "PERCENT"
  /** Festen Betrag auf den bisher gueltigen Preis. */
  | "DELTA"
  /** Individuellen Preis entfernen, Grundpreis gilt wieder. */
  | "RESET";

export type PriceChangeInput = {
  mode: PriceChangeMode;
  /** Bei SET der Preis, bei PERCENT der Prozentsatz, bei DELTA der Betrag. */
  value: number;
  /** Zeitraum, beide Tage einschliesslich. */
  from: string;
  to: string;
  /** Leer bedeutet: alle Wochentage. */
  weekdays: number[];
  occupancy: number;
  roomTypeId: number;
  rows: RatePriceRow[];
};

export type PriceChange = {
  date: string;
  /** Bisher gueltiger Preis, oder null wenn keiner hinterlegt war. */
  before: string | null;
  beforeSource: PriceSource | null;
  /** Neuer individueller Preis, oder null bei RESET. */
  after: string | null;
  /** Nach dem Speichern tatsaechlich gueltiger Preis. */
  effective: string | null;
  /** Aendert sich ueberhaupt etwas? */
  changes: boolean;
  /** Hinweis, wenn die Zeile nicht anwendbar ist. */
  problem: string | null;
};

const runden = (cents: number) => Math.max(0, Math.round(cents));

/**
 * Berechnet die Aenderung je betroffenem Tag - als Vorschau.
 *
 * Tage ausserhalb von [from, to] kommen nicht vor. Wochentage, die nicht
 * gewaehlt sind, kommen nicht vor.
 */
export function planPriceChange(input: PriceChangeInput): PriceChange[] {
  if (!DATUM.test(input.from) || !DATUM.test(input.to)) {
    throw new Error("Ungültiger Zeitraum.");
  }

  if (input.to < input.from) {
    throw new Error("Das Ende des Zeitraums liegt vor dem Beginn.");
  }

  const index = indexPrices(input.rows, input.roomTypeId);
  const grundpreis = index.base(input.occupancy);

  const plan: PriceChange[] = [];
  let aktuell = input.from;

  for (let i = 0; aktuell <= input.to && i < 400; i++) {
    const tag = aktuell;
    aktuell = nextDate(aktuell);

    if (input.weekdays.length > 0 && !input.weekdays.includes(weekdayOf(tag))) {
      continue;
    }

    const tagespreis = index.dated(input.occupancy, tag);
    const bisher = tagespreis ?? grundpreis;
    const quelle: PriceSource | null = tagespreis ? "DATE" : grundpreis ? "BASE" : null;

    if (input.mode === "RESET") {
      plan.push({
        date: tag,
        before: bisher,
        beforeSource: quelle,
        after: null,
        effective: grundpreis,
        changes: tagespreis !== null,
        problem:
          grundpreis === null
            ? "Ohne Grundpreis bliebe dieser Tag unbepreist."
            : null,
      });

      continue;
    }

    if (input.mode === "SET") {
      const neu = runden(Math.round(input.value * 100));

      plan.push({
        date: tag,
        before: bisher,
        beforeSource: quelle,
        after: centsToText(neu),
        effective: centsToText(neu),
        changes: bisher === null || toCents(bisher) !== neu,
        problem: input.value < 0 ? "Ein negativer Preis ist nicht möglich." : null,
      });

      continue;
    }

    // PERCENT und DELTA brauchen einen Ausgangswert.
    if (bisher === null) {
      plan.push({
        date: tag,
        before: null,
        beforeSource: null,
        after: null,
        effective: null,
        changes: false,
        problem: "Für diesen Tag ist kein Preis hinterlegt, auf den sich die Änderung beziehen könnte.",
      });

      continue;
    }

    const basis = toCents(bisher);

    const neu =
      input.mode === "PERCENT"
        ? runden(basis + Math.round((basis * input.value) / 100))
        : runden(basis + Math.round(input.value * 100));

    plan.push({
      date: tag,
      before: bisher,
      beforeSource: quelle,
      after: centsToText(neu),
      effective: centsToText(neu),
      changes: neu !== basis,
      problem: null,
    });
  }

  return plan;
}

/** Cent als Dezimaltext mit zwei Stellen. */
function centsToText(cents: number): string {
  const sicher = Math.max(0, Math.round(cents));

  return `${Math.floor(sicher / 100)}.${String(sicher % 100).padStart(2, "0")}`;
}

export type PlanSummary = {
  days: number;
  changedDays: number;
  problems: string[];
  /** Niedrigster und hoechster neuer Preis. */
  min: string | null;
  max: string | null;
};

export function summarisePlan(plan: PriceChange[]): PlanSummary {
  const betroffen = plan.filter((zeile) => zeile.changes);
  const werte = betroffen
    .map((zeile) => zeile.effective)
    .filter((wert): wert is string => wert !== null)
    .map(toCents);

  return {
    days: plan.length,
    changedDays: betroffen.length,
    problems: [...new Set(plan.map((zeile) => zeile.problem).filter((p): p is string => Boolean(p)))],
    min: werte.length > 0 ? centsToText(Math.min(...werte)) : null,
    max: werte.length > 0 ? centsToText(Math.max(...werte)) : null,
  };
}
