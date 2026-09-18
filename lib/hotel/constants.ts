export const ROOM_STATUSES = [
  "CLEAN",
  "DIRTY",
  "INSPECTED",
  "OUT_OF_SERVICE",
] as const;

export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  CLEAN: "Sauber",
  DIRTY: "Zu reinigen",
  INSPECTED: "Kontrolliert",
  OUT_OF_SERVICE: "Außer Betrieb",
};

export const PRICING_MODES = ["PER_ROOM", "PER_PERSON"] as const;

export type PricingMode = (typeof PRICING_MODES)[number];

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  PER_ROOM: "Pro Zimmer",
  PER_PERSON: "Pro Person",
};

// Laut alter Website in allen Zimmern (WLAN, SAT-TV, Klima, Bad/WC, Föhn),
// teilweise Safe, vereinzelt Balkon.
export const EXAMPLE_AMENITIES = [
  { code: "WLAN", name: "WLAN", sortOrder: 10 },
  { code: "SAT_TV", name: "SAT-TV", sortOrder: 20 },
  { code: "KLIMA", name: "Klimaanlage", sortOrder: 30 },
  { code: "BAD_WC", name: "Bad/WC", sortOrder: 40 },
  { code: "FOEHN", name: "Föhn", sortOrder: 50 },
  { code: "SAFE", name: "Safe", sortOrder: 60 },
  { code: "BALKON", name: "Balkon", sortOrder: 70 },
] as const;

// Nur Werte, die für das Hotel belegt sind. Alles andere bleibt leer.
export const ALTER_TELEGRAF_DEFAULTS = {
  name: "Hotel Alter Telegraf",
  slug: "alter-telegraf",
  legalName: "",
  vatId: "",
  street: "Grabenstraße 12",
  postalCode: "8010",
  city: "Graz",
  countryCode: "AT",
  phone: "+43 316 686558",
  fax: "",
  email: "hotel@altertelegraf.at",
  timezone: "Europe/Vienna",
  currency: "EUR",
  checkInFrom: "16:00",
  checkOutUntil: "12:00",
  receptionFrom: "08:00",
  receptionUntil: "22:00",
};

export type HotelFormValues = typeof ALTER_TELEGRAF_DEFAULTS;

export const HOTEL_NAV = [
  { href: "/admin/hotel", label: "Übersicht", ready: true },
  { href: "/admin/hotel/einstellungen", label: "Hotel", ready: true },
  { href: "/admin/hotel/zimmerarten", label: "Zimmerarten", ready: true },
  { href: "/admin/hotel/zimmer", label: "Zimmer", ready: true },
  { href: "/admin/hotel/ausstattung", label: "Ausstattung", ready: true },
  { href: "/admin/hotel/buchungen", label: "Buchungen", ready: false },
  { href: "/admin/hotel/gaeste", label: "Gäste", ready: false },
  { href: "/admin/hotel/kalender", label: "Kalender", ready: false },
  { href: "/admin/hotel/preise", label: "Preise", ready: false },
] as const;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
