// Schnittstelle zu einem Vertriebskanal.
//
// Die Anwendung kennt nur diese Schnittstelle. Darunter kann ein Channel
// Manager liegen, der Booking.com bedient - oder bei Tests ein Mock.
//
// Bewusst ohne Bezug auf einen konkreten Anbieter: Solange kein Zugang
// freigegeben ist, wird hier nichts erfunden. Welche Anbieter in Frage
// kommen und was sie verlangen, steht in docs/booking-com-integration.md.
//
// Ohne Datenbankzugriff und ohne Umgebungsvariablen, damit dieselbe Logik im
// Test laeuft.

export type AvailabilityDay = {
  /** YYYY-MM-DD */
  date: string;
  /** Freie Zimmer der Kategorie an diesem Tag. */
  roomsAvailable: number;
};

export type AvailabilityPush = {
  externalPropertyId: string;
  externalRoomTypeId: string;
  days: AvailabilityDay[];
};

export type PushResult = {
  /** Nur true, wenn der Kanal die Aenderung bestaetigt hat. */
  accepted: boolean;
  /** Referenz des Kanals, falls er eine liefert. */
  reference: string | null;
};

/** Minimale Gastangaben einer externen Reservierung. */
export type ExternalGuest = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  countryCode: string | null;
};

export type ExternalBookingStatus = "NEW" | "MODIFIED" | "CANCELLED";

export type ExternalBooking = {
  /** Stabile Reservierungsnummer des Kanals. Grundlage der Idempotenz. */
  externalRef: string;
  status: ExternalBookingStatus;
  /** Kennung der Nachricht, falls der Kanal eine mitgibt. */
  messageId: string | null;
  externalRoomTypeId: string;
  externalRatePlanId: string | null;
  /** YYYY-MM-DD, checkOut exklusiv. */
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  guest: ExternalGuest;
  /** Dezimalbetrag als Text, oder null. */
  totalAmount: string | null;
  currency: string | null;
  /** booking_source des PMS, etwa BOOKING_COM. */
  source: string;
  note: string | null;
};

export type ChannelProvider = {
  name: string;
  /** Verfuegbarkeit melden. Wirft bei Fehlern eine ChannelError. */
  pushAvailability(push: AvailabilityPush): Promise<PushResult>;
  /** Reservierungen abrufen, die seit diesem Zeitpunkt entstanden sind. */
  fetchBookings(sinceIso: string): Promise<ExternalBooking[]>;
  /**
   * Eingehende Nachricht pruefen. Gibt null zurueck, wenn Signatur oder
   * Aufbau nicht stimmen - dann wird nichts uebernommen.
   */
  readWebhook(rawBody: string, signature: string | null): ExternalBooking | null;
};

/** Fehler im Umgang mit dem Kanal. */
export class ChannelError extends Error {
  readonly retryable: boolean;

  constructor(message: string, options: { retryable?: boolean } = {}) {
    super(message);
    this.name = "ChannelError";
    // Vorsicht als Standard: Ein unbekannter Fehler gilt als vorübergehend
    // und wird wiederholt, aber nur begrenzt oft.
    this.retryable = options.retryable ?? true;
  }
}

export const SYNC_DIRECTIONS = ["INBOUND", "OUTBOUND"] as const;

export type SyncDirection = (typeof SYNC_DIRECTIONS)[number];

export const SYNC_OPERATIONS = [
  "AVAILABILITY_PUSH",
  "BOOKING_IMPORT",
  "BOOKING_CHANGE",
  "BOOKING_CANCEL",
] as const;

export type SyncOperation = (typeof SYNC_OPERATIONS)[number];

export const SYNC_STATUSES = [
  /** Wartet auf Uebertragung. */
  "PENDING",
  /** Wird gerade bearbeitet. */
  "IN_PROGRESS",
  /** Vom Kanal bestaetigt. */
  "DONE",
  /** Endgueltig gescheitert, Wiederholungen aufgebraucht. */
  "FAILED",
  /** Externe Zimmerart ist nicht zugeordnet oder nicht bestaetigt. */
  "NEEDS_MAPPING",
  /** Uebernommen, aber der Betrieb muss sich kuemmern (z. B. Ueberbuchung). */
  "ATTENTION",
  /** Bewusst nicht uebertragen, etwa weil kein Kanal eingerichtet ist. */
  "SKIPPED",
] as const;

export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  PENDING: "Ausstehend",
  IN_PROGRESS: "Läuft",
  DONE: "Synchronisiert",
  FAILED: "Fehlgeschlagen",
  NEEDS_MAPPING: "Zuordnung fehlt",
  ATTENTION: "Aktion nötig",
  SKIPPED: "Nicht übertragen",
};

export const MAPPING_STATUSES = ["UNVERIFIED", "CONFIRMED", "DISABLED"] as const;

export type MappingStatus = (typeof MAPPING_STATUSES)[number];

export const MAPPING_STATUS_LABELS: Record<MappingStatus, string> = {
  UNVERIFIED: "Nicht bestätigt",
  CONFIRMED: "Bestätigt",
  DISABLED: "Abgeschaltet",
};

/**
 * Wartezeit vor dem naechsten Versuch, in Minuten.
 *
 * Verdoppelt sich je Versuch und ist bei 60 Minuten gedeckelt. Nach
 * maxAttempts wird nicht weiter versucht - ein dauerhafter Fehler soll keine
 * endlose Schleife erzeugen.
 */
export function backoffMinutes(attempts: number) {
  return Math.min(60, 2 ** Math.max(0, attempts - 1));
}
