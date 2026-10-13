// Preisberechnung des Hotels. Bewusst ohne Datenbankzugriff, damit sie
// vollstaendig testbar ist und spaeter sowohl die Buchungsstrecke als auch
// die Verwaltung dieselbe Logik verwenden.
//
// Gerechnet wird in ganzen Cent. Dezimalzahlen als Gleitkommawerte wuerden
// bei Summen zu Rundungsfehlern fuehren.

export const BREAKFAST_SERVICE_CODE = "BREAKFAST";
export const LONG_STAY_CODE_PREFIX = "LONGSTAY_";

export type DiscountTier = {
  minNights: number;
  percent: number;
};

// Vom Betrieb vorgegebene Staffel. Dient nur als Startwert beim Einrichten;
// gepflegt wird sie anschliessend in der Datenbank.
export const DEFAULT_DISCOUNT_TIERS: DiscountTier[] = [
  { minNights: 3, percent: 10 },
  { minNights: 5, percent: 15 },
  { minNights: 7, percent: 20 },
];

export const DEFAULT_BREAKFAST_PRICE = "15.00";

export function toCents(decimal: string | number): number {
  const value = typeof decimal === "number" ? decimal.toFixed(2) : decimal.trim();
  const match = /^(-?)(\d+)(?:[.,](\d{1,2}))?$/.exec(value);

  if (!match) {
    throw new Error(`Ungültiger Betrag: ${decimal}`);
  }

  const [, sign, whole, fraction = "0"] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  return sign === "-" ? -cents : cents;
}

export function fromCents(cents: number): string {
  const rounded = Math.round(cents);
  const sign = rounded < 0 ? "-" : "";
  const absolute = Math.abs(rounded);

  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

// Darstellung von Geldbetraegen liegt zentral in lib/money.ts. Hier nur
// weitergereicht, damit bestehende Importe gueltig bleiben.
export { formatAmount, formatMoney, formatMoneyCents } from "@/lib/money";

import { formatAmount as formatAmountIntern } from "@/lib/money";

/**
 * Betrag ohne Waehrungszeichen.
 *
 * @deprecated Fuer Anzeige formatMoney verwenden (mit „€“), fuer
 * Eingabefelder formatAmount. Bleibt als Alias, damit bestehende Aufrufe
 * nicht brechen.
 */
export function formatEuro(decimal: string): string {
  return formatAmountIntern(decimal);
}

// Anzahl der Naechte zwischen zwei Datumsangaben im Format YYYY-MM-DD.
export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error("Ungültiges Datum.");
  }

  return Math.round((end - start) / 86_400_000);
}

// Es gilt die hoechste Stufe, deren Mindestaufenthalt erreicht ist.
export function pickDiscountPercent(nights: number, tiers: DiscountTier[]): number {
  return tiers
    .filter((tier) => nights >= tier.minNights)
    .reduce((best, tier) => Math.max(best, tier.percent), 0);
}

/**
 * Bereits ermittelter Rabatt eines Aufenthalts. Welche Aktion gilt,
 * entscheidet ausschliesslich lib/hotel/promotions.ts; hier wird nur noch
 * gerechnet.
 */
export type StayDiscount = {
  /** Prozentsatz, oder 0 wenn ein Festbetrag gilt. Nur zur Anzeige. */
  percent: number;
  /** Rabatt in ganzen Cent. */
  cents: number;
  name: string | null;
};

export type StayInput = {
  nights: number;
  /**
   * Preis pro Nacht fuer die gewaehlte Belegung, als Dezimalzahl. Nur noch
   * fuer gleichbleibende Preise; nightPrices hat Vorrang.
   */
  pricePerNight?: string;
  /**
   * Preis je Nacht. Entsteht in lib/hotel/rate-calendar.ts aus Grundpreis
   * und hinterlegten Tagespreisen und hat Vorrang vor pricePerNight.
   */
  nightPrices?: { amount: string }[];
  /** Personen, die Fruehstueck nehmen. */
  breakfastPersons: number;
  breakfastPricePerPersonNight: string;
  discount?: StayDiscount | null;
};

export type StayTotals = {
  nights: number;
  roomsTotal: string;
  discountPercent: number;
  discountTotal: string;
  /** Name der wirksamen Aktion, oder null. */
  discountName: string | null;
  breakfastTotal: string;
  total: string;
};

/**
 * Reihenfolge der Berechnung - eindeutig und in dieser Folge:
 *   1. Zimmerpreis = Preis pro Nacht x Naechte
 *   2. abzueglich Rabatt, immer nur auf den Zimmerpreis
 *   3. zuzueglich Fruehstueck, nie rabattiert
 */
export function calculateStay(input: StayInput): StayTotals {
  if (input.nights < 1) {
    throw new Error("Der Aufenthalt muss mindestens eine Nacht umfassen.");
  }

  // Zimmerpreis: Summe der Naechte, wenn sie einzeln vorliegen - sonst der
  // gleichbleibende Preis mal Naechte.
  const roomsTotalCents =
    input.nightPrices && input.nightPrices.length > 0
      ? input.nightPrices.reduce((summe, nacht) => summe + toCents(nacht.amount), 0)
      : input.pricePerNight !== undefined
        ? toCents(input.pricePerNight) * input.nights
        : null;

  if (roomsTotalCents === null) {
    throw new Error("Für den Aufenthalt liegt kein Zimmerpreis vor.");
  }

  // Mehr als den Zimmerpreis kann kein Rabatt ausmachen.
  const discountTotalCents = Math.max(
    0,
    Math.min(input.discount?.cents ?? 0, roomsTotalCents)
  );

  const breakfastTotalCents =
    input.breakfastPersons > 0
      ? toCents(input.breakfastPricePerPersonNight) * input.breakfastPersons * input.nights
      : 0;

  return {
    nights: input.nights,
    roomsTotal: fromCents(roomsTotalCents),
    discountPercent: discountTotalCents > 0 ? (input.discount?.percent ?? 0) : 0,
    discountTotal: fromCents(discountTotalCents),
    discountName: discountTotalCents > 0 ? (input.discount?.name ?? null) : null,
    breakfastTotal: fromCents(breakfastTotalCents),
    total: fromCents(roomsTotalCents - discountTotalCents + breakfastTotalCents),
  };
}
