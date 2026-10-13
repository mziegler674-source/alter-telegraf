// Geldbetraege darstellen - eine Stelle fuer das ganze Projekt.
//
// Gerechnet wird im Projekt in ganzen Cent (lib/hotel/pricing.ts). Diese
// Datei macht daraus Text und sonst nichts: Sie rundet nicht fachlich und
// rechnet nicht.
//
// Darstellung immer oesterreichisch und immer mit zwei Nachkommastellen:
//
//   formatMoney("18.8")   -> "18,80 €"
//   formatMoney("12")     -> "12,00 €"
//   formatMoney(139)      -> "139,00 €"
//   formatMoney(null)     -> "–"
//
// Ohne Datenbank, ohne Umgebung - in jedem Zusammenhang verwendbar.

// Zahlenformat: Komma als Dezimaltrenner, Punkt als Tausendertrenner -
// „1.234,50“. Dafuer wird bewusst de-DE verwendet: Die Unicode-Datenbasis
// gruppiert bei de-AT mit einem schmalen Leerzeichen („1 234,50“), was auf
// einer oesterreichischen Rechnung unueblich aussieht. Die Nachkommastellen
// sind in beiden Faellen gleich.
export const MONEY_LOCALE = "de-DE";
export const MONEY_CURRENCY = "EUR";

/** Platzhalter, wenn kein Betrag vorliegt. */
export const MONEY_PLACEHOLDER = "–";

const zahl = new Intl.NumberFormat(MONEY_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Bewusst NICHT Intl mit style "currency": Fuer de-AT stellt die
// Unicode-Datenbasis das Eurozeichen VORAN („€ 18,80“). Im Haus und in
// diesem Projekt wird es nachgestellt („18,80 €“) - so steht es auf der
// Karte, in den Mails und in der Buchungsuebersicht. Zahl und Zeichen
// werden deshalb hier verbunden, mit geschuetztem Leerzeichen, damit der
// Betrag nicht umbricht.
const SCHMALES_LEERZEICHEN = " ";

const waehrung = {
  format: (wert: number) => `${zahl.format(wert)}${SCHMALES_LEERZEICHEN}€`,
};

/**
 * Wandelt die im Projekt ueblichen Darstellungen in eine Zahl.
 *
 * Erlaubt sind Zahlen und Dezimaltexte mit Punkt oder Komma. Alles andere
 * gilt als „kein Betrag“ und fuehrt zu null - nicht zu 0, denn ein fehlender
 * Preis ist nicht derselbe Sachverhalt wie ein Preis von null.
 */
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const text = value.trim();

  if (!text) return null;

  // Nur eine der beiden Schreibweisen zulassen, damit "1.234,56" nicht
  // stillschweigend falsch gelesen wird.
  const normalisiert = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;

  if (!/^-?\d+(\.\d+)?$/.test(normalisiert)) return null;

  const n = Number(normalisiert);

  return Number.isFinite(n) ? n : null;
}

/** Betrag mit Waehrung: „18,80 €“. */
export function formatMoney(value: string | number | null | undefined): string {
  const n = toNumber(value);

  return n === null ? MONEY_PLACEHOLDER : waehrung.format(n);
}

/** Betrag ohne Waehrungszeichen: „18,80“. Fuer Eingabefelder und Tabellen. */
export function formatAmount(value: string | number | null | undefined): string {
  const n = toNumber(value);

  return n === null ? MONEY_PLACEHOLDER : zahl.format(n);
}

/** Betrag aus ganzen Cent: formatMoneyCents(1880) -> „18,80 €“. */
export function formatMoneyCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) {
    return MONEY_PLACEHOLDER;
  }

  return waehrung.format(Math.round(cents) / 100);
}

/**
 * Vorzeichenbehaftete Darstellung fuer Zu- und Abschlaege:
 * „+20,00 €“ bzw. „−10,00 €“ (mit dem typografischen Minus).
 */
export function formatMoneyDelta(value: string | number | null | undefined): string {
  const n = toNumber(value);

  if (n === null) return MONEY_PLACEHOLDER;
  if (n === 0) return waehrung.format(0);

  return n > 0 ? `+${waehrung.format(n)}` : `−${waehrung.format(Math.abs(n))}`;
}

/** Prozentangabe: „15 %“ bzw. „−10 %“. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return MONEY_PLACEHOLDER;
  }

  const gerundet = Math.round(value * 100) / 100;
  const text = new Intl.NumberFormat(MONEY_LOCALE, { maximumFractionDigits: 2 }).format(
    Math.abs(gerundet)
  );

  return gerundet < 0 ? `−${text} %` : `${text} %`;
}
