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

// Gruende fuer eine zeitraumbezogene Zimmersperre. Eine Sperre wirkt wie
// eine Belegung: Das Zimmer steht der Verfuegbarkeit nicht zur Verfuegung.
export const BLOCK_REASONS = [
  { code: "MAINTENANCE", label: "Wartung" },
  { code: "RENOVATION", label: "Renovierung" },
  { code: "CLEANING", label: "Grundreinigung" },
  { code: "OWNER", label: "Eigenbelegung" },
  { code: "OTHER", label: "Sonstiges" },
] as const;

export type BlockReason = (typeof BLOCK_REASONS)[number]["code"];

export const BLOCK_REASON_LABELS: Record<BlockReason, string> = {
  MAINTENANCE: "Wartung",
  RENOVATION: "Renovierung",
  CLEANING: "Grundreinigung",
  OWNER: "Eigenbelegung",
  OTHER: "Sonstiges",
};

// Quellen einer Buchung. WEBSITE entsteht nur ueber die oeffentliche
// Buchungsstrecke; alles andere erfasst der Betrieb selbst oder es kommt
// ueber einen Vertriebskanal herein.
export const BOOKING_SOURCES = [
  "WEBSITE",
  "PHONE",
  "EMAIL",
  "WALK_IN",
  "MANUAL",
  "BOOKING_COM",
  "EXPEDIA",
  "AIRBNB",
  "OTHER",
] as const;

export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const BOOKING_SOURCE_LABELS: Record<BookingSource, string> = {
  WEBSITE: "Website",
  PHONE: "Telefon",
  EMAIL: "E-Mail",
  WALK_IN: "Spontan vor Ort",
  MANUAL: "Manuell erfasst",
  BOOKING_COM: "Booking.com",
  EXPEDIA: "Expedia",
  AIRBNB: "Airbnb",
  OTHER: "Sonstige",
};

/** Quellen, die im Admin erfasst werden koennen. */
export const OPERATOR_SOURCES = BOOKING_SOURCES.filter(
  (quelle) => quelle !== "WEBSITE"
) as readonly BookingSource[];

/** Quellen, die auf einen externen Vertriebskanal hinweisen. */
export const EXTERNAL_SOURCES: readonly BookingSource[] = [
  "BOOKING_COM",
  "EXPEDIA",
  "AIRBNB",
  "OTHER",
];

export const PRICING_MODES = ["PER_ROOM", "PER_PERSON"] as const;

export type PricingMode = (typeof PRICING_MODES)[number];

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  PER_ROOM: "Pro Zimmer",
  PER_PERSON: "Pro Person",
};

// Ausstattungsmerkmale, die der Betrieb auf altertelegraf.at/zimmer für
// ALLE Zimmer angibt: „Wlan, SAT / TV, Klima, Bad / Wc, Föhn“. Mehr ist dort
// nicht belegt, deshalb steht hier auch nichts weiter. Der Zimmersafe ist nur
// für einen Teil der Zimmer erwähnt und wird daher nicht automatisch
// zugeordnet. Gepflegt wird der Katalog anschließend im Admin.
export const CONFIRMED_AMENITIES = [
  { code: "WLAN", name: "WLAN", icon: "wlan", sortOrder: 10, allRooms: true },
  { code: "SAT_TV", name: "SAT-TV", icon: "tv", sortOrder: 20, allRooms: true },
  { code: "KLIMA", name: "Klimaanlage", icon: "klima", sortOrder: 30, allRooms: true },
  { code: "BAD_WC", name: "Bad/WC", icon: "bad", sortOrder: 40, allRooms: true },
  { code: "FOEHN", name: "Föhn", icon: "foehn", sortOrder: 50, allRooms: true },
  { code: "SAFE", name: "Zimmersafe", icon: "safe", sortOrder: 60, allRooms: false },
] as const;

export type AmenityCode = (typeof CONFIRMED_AMENITIES)[number]["code"];

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
  { href: "/admin/hotel/preise", label: "Preise", ready: true },
  { href: "/admin/hotel/stornobedingungen", label: "Stornobedingungen", ready: true },
  { href: "/admin/hotel/promotions", label: "Promotions", ready: true },
  { href: "/admin/hotel/buchungen", label: "Buchungen", ready: true },
  { href: "/admin/hotel/gaeste", label: "Gäste", ready: true },
  { href: "/admin/hotel/kalender", label: "Kalender", ready: true },
  { href: "/admin/hotel/kanaele", label: "Kanäle", ready: true },
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
