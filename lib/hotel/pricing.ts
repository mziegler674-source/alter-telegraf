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

export function formatEuro(decimal: string): string {
  return Number(decimal).toLocaleString("de-AT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

export type StayInput = {
  nights: number;
  /** Preis pro Nacht fuer die gewaehlte Belegung, als Dezimalzahl. */
  pricePerNight: string;
  /** Personen, die Fruehstueck nehmen. */
  breakfastPersons: number;
  breakfastPricePerPersonNight: string;
  discountTiers: DiscountTier[];
};

export type StayTotals = {
  nights: number;
  roomsTotal: string;
  discountPercent: number;
  discountTotal: string;
  breakfastTotal: string;
  total: string;
};

export function calculateStay(input: StayInput): StayTotals {
  if (input.nights < 1) {
    throw new Error("Der Aufenthalt muss mindestens eine Nacht umfassen.");
  }

  const roomsTotalCents = toCents(input.pricePerNight) * input.nights;

  const discountPercent = pickDiscountPercent(input.nights, input.discountTiers);

  // Der Rabatt gilt nur auf den Zimmerpreis, nicht auf das Fruehstueck.
  const discountTotalCents = Math.round((roomsTotalCents * discountPercent) / 100);

  const breakfastTotalCents =
    input.breakfastPersons > 0
      ? toCents(input.breakfastPricePerPersonNight) * input.breakfastPersons * input.nights
      : 0;

  return {
    nights: input.nights,
    roomsTotal: fromCents(roomsTotalCents),
    discountPercent,
    discountTotal: fromCents(discountTotalCents),
    breakfastTotal: fromCents(breakfastTotalCents),
    total: fromCents(roomsTotalCents - discountTotalCents + breakfastTotalCents),
  };
}
