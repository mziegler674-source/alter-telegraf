// Die sieben Karten des Hauses. Jede Karte ist eine eigene PDF.
// Reihenfolge und Titel sind fix hinterlegt - der Betreiber tauscht nur die PDF aus.
export const MENU_CARDS = [
  {
    slug: "hendl-spezialitaeten",
    title: "Hendl-Spezialitäten",
    teaser:
      "Knuspriges Hendl und ausgewählte Geflügelgerichte – das Herzstück unseres Hendl-Ecks.",
  },
  {
    slug: "suppen-salate-beilagen",
    title: "Suppen, hausgemachte Salate & Beilagen",
    teaser:
      "Frische Vorspeisen, hausgemachte Salate und Beilagen zu unseren Hauptgerichten.",
  },
  {
    slug: "fisch-vegetarisch",
    title: "Fischgerichte & Vegetarisch",
    teaser: "Fischgerichte und vegetarische Speisen aus unserer Küche.",
  },
  {
    slug: "gourmet",
    title: "Gourmet",
    teaser: "Unsere Gourmet-Karte.",
  },
  {
    slug: "nachspeisen",
    title: "Nachspeisen",
    teaser: "Süße Klassiker und hausgemachte Strudel runden den Besuch bei uns ab.",
  },
  {
    slug: "getraenkekarte",
    title: "Getränkekarte",
    teaser:
      "Vom erfrischenden Getränk bis zum gemütlichen Ausklang – passend zu Ihrem Besuch.",
  },
  {
    slug: "weinkarte",
    title: "Weinkarte",
    teaser: "Unsere Weinauswahl.",
  },
] as const;

export type MenuCardSlug = (typeof MENU_CARDS)[number]["slug"];

export const MAX_PDF_BYTES = 4 * 1024 * 1024;

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
