// Laender fuer die Gastadresse.
//
// Gespeichert wird weiterhin der zweistellige Laendercode (ISO 3166-1
// alpha-2), damit das Datenmodell unveraendert bleibt. Diese Liste gibt dem
// Gast nur eine verstaendliche Auswahl statt eines Freitextfeldes.
//
// Zur PLZ-Pruefung: Hinterlegt ist ein Muster NUR dort, wo es eindeutig ist.
// Wo das Format uneinheitlich ist oder kein Postleitzahlsystem existiert,
// steht bewusst kein Muster - dann wird die Eingabe nur auf eine plausible
// Laenge geprueft. Eine erfundene Regel wuerde echte Adressen abweisen, und
// das ist der schlimmere Fehler.
//
// Ohne Datenbank und ohne Umgebung, damit Client und Server dieselbe Liste
// verwenden.

export type Country = {
  code: string;
  name: string;
  /** Regulaerer Ausdruck fuer die Postleitzahl, oder null. */
  postalPattern?: RegExp;
  /** Beispiel fuer die Fehlermeldung. */
  postalExample?: string;
  /** Land ohne Postleitzahlsystem: Feld bleibt leer zulaessig. */
  withoutPostalCode?: boolean;
};

/**
 * Haeufige Herkunftslaender zuerst, danach alphabetisch. Die Liste ist
 * bewusst nicht vollstaendig; „Anderes Land“ deckt den Rest ab.
 */
export const COUNTRIES: Country[] = [
  { code: "AT", name: "Österreich", postalPattern: /^\d{4}$/, postalExample: "8010" },
  { code: "DE", name: "Deutschland", postalPattern: /^\d{5}$/, postalExample: "80331" },
  { code: "CH", name: "Schweiz", postalPattern: /^\d{4}$/, postalExample: "8001" },
  { code: "IT", name: "Italien", postalPattern: /^\d{5}$/, postalExample: "39100" },

  { code: "BE", name: "Belgien", postalPattern: /^\d{4}$/, postalExample: "1000" },
  { code: "BG", name: "Bulgarien", postalPattern: /^\d{4}$/, postalExample: "1000" },
  { code: "DK", name: "Dänemark", postalPattern: /^\d{4}$/, postalExample: "1050" },
  { code: "EE", name: "Estland", postalPattern: /^\d{5}$/, postalExample: "10111" },
  { code: "FI", name: "Finnland", postalPattern: /^\d{5}$/, postalExample: "00100" },
  { code: "FR", name: "Frankreich", postalPattern: /^\d{5}$/, postalExample: "75001" },
  { code: "GR", name: "Griechenland", postalPattern: /^\d{3} ?\d{2}$/, postalExample: "104 31" },
  { code: "IE", name: "Irland" },
  { code: "HR", name: "Kroatien", postalPattern: /^\d{5}$/, postalExample: "10000" },
  { code: "LV", name: "Lettland" },
  { code: "LI", name: "Liechtenstein", postalPattern: /^\d{4}$/, postalExample: "9490" },
  { code: "LT", name: "Litauen", postalPattern: /^(LT-)?\d{5}$/, postalExample: "01100" },
  { code: "LU", name: "Luxemburg", postalPattern: /^(L-)?\d{4}$/, postalExample: "1111" },
  { code: "NL", name: "Niederlande", postalPattern: /^\d{4} ?[A-Za-z]{2}$/, postalExample: "1012 AB" },
  { code: "NO", name: "Norwegen", postalPattern: /^\d{4}$/, postalExample: "0150" },
  { code: "PL", name: "Polen", postalPattern: /^\d{2}-?\d{3}$/, postalExample: "00-001" },
  { code: "PT", name: "Portugal", postalPattern: /^\d{4}-?\d{3}$/, postalExample: "1000-001" },
  { code: "RO", name: "Rumänien", postalPattern: /^\d{6}$/, postalExample: "010011" },
  { code: "SE", name: "Schweden", postalPattern: /^\d{3} ?\d{2}$/, postalExample: "111 20" },
  { code: "RS", name: "Serbien" },
  { code: "SK", name: "Slowakei", postalPattern: /^\d{3} ?\d{2}$/, postalExample: "811 01" },
  { code: "SI", name: "Slowenien", postalPattern: /^(SI-)?\d{4}$/, postalExample: "1000" },
  { code: "ES", name: "Spanien", postalPattern: /^\d{5}$/, postalExample: "28001" },
  { code: "CZ", name: "Tschechien", postalPattern: /^\d{3} ?\d{2}$/, postalExample: "110 00" },
  { code: "TR", name: "Türkei", postalPattern: /^\d{5}$/, postalExample: "34000" },
  { code: "HU", name: "Ungarn", postalPattern: /^\d{4}$/, postalExample: "1051" },
  { code: "GB", name: "Vereinigtes Königreich" },
  { code: "UA", name: "Ukraine", postalPattern: /^\d{5}$/, postalExample: "01001" },

  { code: "US", name: "Vereinigte Staaten", postalPattern: /^\d{5}(-\d{4})?$/, postalExample: "10001" },
  { code: "CA", name: "Kanada" },
  { code: "AU", name: "Australien", postalPattern: /^\d{4}$/, postalExample: "2000" },
  { code: "NZ", name: "Neuseeland", postalPattern: /^\d{4}$/, postalExample: "6011" },
  { code: "JP", name: "Japan", postalPattern: /^\d{3}-?\d{4}$/, postalExample: "100-0001" },
  { code: "CN", name: "China", postalPattern: /^\d{6}$/, postalExample: "100000" },
  { code: "IL", name: "Israel" },
  { code: "AE", name: "Vereinigte Arabische Emirate", withoutPostalCode: true },
  { code: "HK", name: "Hongkong", withoutPostalCode: true },
  { code: "ZA", name: "Südafrika", postalPattern: /^\d{4}$/, postalExample: "0001" },
  { code: "BR", name: "Brasilien", postalPattern: /^\d{5}-?\d{3}$/, postalExample: "01000-000" },
];

const NACH_CODE = new Map(COUNTRIES.map((land) => [land.code, land]));

export function findCountry(code: string | null | undefined): Country | null {
  if (!code) return null;

  return NACH_CODE.get(code.trim().toUpperCase()) ?? null;
}

export function countryName(code: string | null | undefined): string | null {
  return findCountry(code)?.name ?? (code ? code.toUpperCase() : null);
}

/** Ist der Code formal ein Laendercode? Auch Laender ausserhalb der Liste. */
export function isCountryCode(code: string | null | undefined): boolean {
  return typeof code === "string" && /^[A-Za-z]{2}$/.test(code.trim());
}
