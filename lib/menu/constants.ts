export const MENU_KINDS = ["SPEISEKARTE", "GAESTEVERKAUF"] as const;

export type MenuKind = (typeof MENU_KINDS)[number];

export const MENU_LABELS: Record<MenuKind, string> = {
  SPEISEKARTE: "Speisekarte",
  GAESTEVERKAUF: "Gästeverkauf",
};

export type MenuItem = {
  id: number;
  menu: MenuKind;
  name: string;
  description: string | null;
  price: string;
  active: boolean;
  sortOrder: number;
};

// Der Betreiber tippt "16,90" oder "16.90". Gespeichert wird als Dezimalzahl.
export function parsePriceInput(value: string) {
  return value.trim().replace(/\s/g, "").replace(",", ".");
}

// numeric kommt als "16.90" aus der Datenbank zurueck.
// Darstellung liegt zentral in lib/money.ts.
//
// formatPrice gibt die Zahl OHNE Waehrungszeichen und ist fuer
// Eingabefelder gedacht. Fuer die Anzeige ist formatMoney zu verwenden.
export { formatAmount as formatPrice, formatMoney } from "@/lib/money";
