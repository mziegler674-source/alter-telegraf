import { findCountry, isCountryCode } from "./countries";

// Pruefung der Gastangaben - eine Stelle fuer Browser und Server.
//
// Die Oberflaeche verwendet dieselben Funktionen, damit der Gast einen
// Fehler sofort sieht. VERBINDLICH ist aber immer die Pruefung auf dem
// Server: Der Browser kann umgangen werden.
//
// Grundhaltung bei Namen und Adressen: Lieber eine ungewoehnliche, aber
// echte Eingabe annehmen als eine echte abweisen. Geprueft wird deshalb auf
// offensichtlich Falsches (Ziffern im Namen, leere Pflichtfelder,
// unplausible Laengen) und nicht mit einer engen Positivliste.
//
// Was hier NICHT geprueft werden kann: ob eine E-Mail-Adresse oder eine
// Telefonnummer tatsaechlich erreichbar ist. Das stellt erst eine
// Zustellung bzw. ein Anruf fest.

export const MAX = {
  name: 80,
  email: 160,
  phone: 40,
  street: 160,
  postalCode: 16,
  city: 80,
  message: 1000,
} as const;

export type FieldName =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "street"
  | "postalCode"
  | "city"
  | "countryCode"
  | "message";

export type GuestInputRaw = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
  message?: string | null;
};

export type GuestClean = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  countryCode: string;
  message: string | null;
};

export type FieldErrors = Partial<Record<FieldName, string>>;

/** Mehrfache Leerzeichen zusammenfassen, Raender entfernen. */
export function squash(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

// Buchstaben aller Schriften, dazu Bindestrich, Apostroph und Punkt.
// \p{L} deckt Umlaute, Akzente und nichtlateinische Schriften ab; \p{M}
// erfasst kombinierende Zeichen.
const NAME_ERLAUBT = /^[\p{L}\p{M}][\p{L}\p{M} '’\-.]*$/u;
const ZIFFER = /\d/u;

export function checkName(value: string | null | undefined, label: string): string | null {
  const text = squash(value);

  if (!text) return `${label} ist erforderlich.`;
  if (text.length > MAX.name) return `${label} darf höchstens ${MAX.name} Zeichen haben.`;
  if (ZIFFER.test(text)) return `${label} darf keine Zahlen enthalten.`;

  if (!NAME_ERLAUBT.test(text)) {
    return `${label} enthält unerlaubte Zeichen. Erlaubt sind Buchstaben, Bindestrich und Apostroph.`;
  }

  // Mindestens ein Buchstabe - "--" oder "''" sind keine Namen.
  if (!/\p{L}/u.test(text)) return `Bitte ${label} angeben.`;

  return null;
}

// Absichtlich zurueckhaltend: ein @, davor und danach etwas, hinten ein
// Punkt mit mindestens zwei Zeichen. Strengere Muster weisen gueltige
// Adressen ab.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function checkEmail(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();

  if (!text) return "Die E-Mail-Adresse ist erforderlich.";
  if (text.length > MAX.email) return `Die E-Mail-Adresse darf höchstens ${MAX.email} Zeichen haben.`;
  if (/\s/.test(text)) return "Die E-Mail-Adresse darf keine Leerzeichen enthalten.";
  if (!EMAIL.test(text)) return "Bitte eine gültige E-Mail-Adresse angeben, z. B. name@beispiel.at.";

  return null;
}

/**
 * Telefonnummer in ein einheitliches Format bringen.
 *
 * Ergebnis ist, wenn moeglich, die internationale Schreibweise mit
 * Laendervorwahl (+43…). Eine oesterreichische Nummer mit fuehrender Null
 * wird dabei umgesetzt: 0664 1234567 -> +436641234567.
 *
 * Das ist eine FORMATIERUNG, keine Erreichbarkeitspruefung.
 */
export function normalisePhone(
  value: string | null | undefined,
  countryCode?: string | null
): string {
  const roh = (value ?? "").trim();

  if (!roh) return "";

  // 00 am Anfang ist die internationale Verkehrsausscheidungsziffer.
  const mitPlus = roh.replace(/^00/, "+");
  const ziffern = mitPlus.replace(/[^\d+]/g, "");

  if (ziffern.startsWith("+")) {
    return `+${ziffern.slice(1).replace(/\D/g, "")}`;
  }

  // Nationale Schreibweise mit fuehrender Null: Vorwahl des Landes davor.
  const vorwahlen: Record<string, string> = {
    AT: "43",
    DE: "49",
    CH: "41",
    IT: "39",
    LI: "423",
  };

  const land = (countryCode ?? "").trim().toUpperCase();
  const vorwahl = vorwahlen[land];

  if (vorwahl && ziffern.startsWith("0")) {
    return `+${vorwahl}${ziffern.slice(1)}`;
  }

  return ziffern;
}

export function checkPhone(
  value: string | null | undefined,
  countryCode?: string | null
): string | null {
  const roh = (value ?? "").trim();

  if (!roh) return "Die Telefonnummer ist erforderlich.";
  if (roh.length > MAX.phone) return `Die Telefonnummer darf höchstens ${MAX.phone} Zeichen haben.`;

  // Erlaubt sind Ziffern und die ueblichen Trennzeichen.
  if (!/^[+0-9 ()/.-]+$/.test(roh)) {
    return "Die Telefonnummer darf nur Ziffern, Leerzeichen und die Zeichen + ( ) / - . enthalten.";
  }

  const normalisiert = normalisePhone(roh, countryCode);
  const ziffern = normalisiert.replace(/\D/g, "");

  // E.164 erlaubt bis zu 15 Ziffern; kuerzer als 6 ist keine erreichbare
  // Nummer, auch nicht national.
  if (ziffern.length < 6) return "Die Telefonnummer ist zu kurz.";
  if (ziffern.length > 15) return "Die Telefonnummer ist zu lang.";

  if (!normalisiert.startsWith("+")) {
    return "Bitte die Nummer mit Ländervorwahl angeben, z. B. +43 664 1234567.";
  }

  return null;
}

// Strassen enthalten Buchstaben, Zahlen und Zeichen wie . , / - und das
// Nummernzeichen. Hausnummern wie „12a“ oder „3/5“ muessen durchkommen.
const STRASSE_VERBOTEN = /[<>{}[\]\\|~^`]/;

export function checkStreet(value: string | null | undefined): string | null {
  const text = squash(value);

  if (!text) return "Straße und Hausnummer sind erforderlich.";
  if (text.length < 3) return "Bitte Straße und Hausnummer vollständig angeben.";
  if (text.length > MAX.street) return `Die Angabe darf höchstens ${MAX.street} Zeichen haben.`;
  if (STRASSE_VERBOTEN.test(text)) return "Die Adresse enthält unerlaubte Zeichen.";
  if (!/\p{L}/u.test(text)) return "Bitte eine Straße angeben.";

  return null;
}

export function checkCity(value: string | null | undefined): string | null {
  const text = squash(value);

  if (!text) return "Der Ort ist erforderlich.";
  if (text.length > MAX.city) return `Der Ort darf höchstens ${MAX.city} Zeichen haben.`;
  if (ZIFFER.test(text) && !/\p{L}/u.test(text)) return "Bitte einen Ortsnamen angeben.";
  if (!/\p{L}/u.test(text)) return "Bitte einen Ortsnamen angeben.";

  return null;
}

export function checkCountry(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();

  if (!text) return "Bitte ein Land auswählen.";
  if (!isCountryCode(text)) return "Das Land muss ein zweistelliger Ländercode sein, z. B. AT.";

  return null;
}

/**
 * Postleitzahl - laenderabhaengig.
 *
 * Die PLZ bleibt TEXT: Fuehrende Nullen gehen sonst verloren. Wo das Format
 * des Landes eindeutig ist, wird es geprueft; sonst nur die Laenge.
 */
export function checkPostalCode(
  value: string | null | undefined,
  countryCode: string | null | undefined
): string | null {
  const text = squash(value);
  const land = findCountry(countryCode);

  if (!text) {
    if (land?.withoutPostalCode) return null;

    return "Die Postleitzahl ist erforderlich.";
  }

  if (text.length > MAX.postalCode) {
    return `Die Postleitzahl darf höchstens ${MAX.postalCode} Zeichen haben.`;
  }

  if (!/^[A-Za-z0-9 -]+$/.test(text)) {
    return "Die Postleitzahl darf nur Ziffern, Buchstaben, Leerzeichen und Bindestriche enthalten.";
  }

  if (land?.postalPattern && !land.postalPattern.test(text)) {
    return land.postalExample
      ? `Für ${land.name} wird eine Postleitzahl wie ${land.postalExample} erwartet.`
      : `Die Postleitzahl passt nicht zum Format von ${land.name}.`;
  }

  return null;
}

export function checkMessage(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();

  if (text.length > MAX.message) {
    return `Die Bemerkung darf höchstens ${MAX.message} Zeichen haben.`;
  }

  return null;
}

/**
 * Welche Felder sind Pflicht?
 *
 * In der oeffentlichen Buchungsstrecke sind alle Kontakt- und Adressfelder
 * erforderlich - die Buchung ist ein Vertrag. Erfasst der Betrieb eine
 * Buchung selbst (Telefon, spontan vor Ort), liegen oft nur Name und
 * Telefonnummer vor. Dann wird nur geprueft, was ausgefuellt ist.
 */
export type GuestRequirements = {
  email?: boolean;
  phone?: boolean;
  street?: boolean;
  postalCode?: boolean;
  city?: boolean;
  countryCode?: boolean;
};

export const GUEST_REQUIRED_PUBLIC: GuestRequirements = {
  email: true,
  phone: true,
  street: true,
  postalCode: true,
  city: true,
  countryCode: true,
};

export const GUEST_REQUIRED_OPERATOR: GuestRequirements = {
  email: false,
  phone: false,
  street: false,
  postalCode: false,
  city: false,
  countryCode: false,
};

const leer = (value: string | null | undefined) => squash(value) === "";

/**
 * Prueft alle Felder und gibt die Fehler je Feld zurueck.
 *
 * Reihenfolge der Felder bleibt stabil, damit die Oberflaeche immer zum
 * ersten Fehler springen kann.
 */
export function validateGuest(
  input: GuestInputRaw,
  required: GuestRequirements = GUEST_REQUIRED_PUBLIC
): FieldErrors {
  const fehler: FieldErrors = {};

  // Name ist immer Pflicht - ohne Namen gibt es keine Buchung.
  const vorname = checkName(input.firstName, "Der Vorname");
  if (vorname) fehler.firstName = vorname;

  const nachname = checkName(input.lastName, "Der Nachname");
  if (nachname) fehler.lastName = nachname;

  // Optionale Felder werden nur geprueft, wenn sie ausgefuellt sind.
  if (required.email !== false || !leer(input.email)) {
    const email = checkEmail(input.email);
    if (email) fehler.email = email;
  }

  if (required.countryCode !== false || !leer(input.countryCode)) {
    const land = checkCountry(input.countryCode);
    if (land) fehler.countryCode = land;
  }

  if (required.phone !== false || !leer(input.phone)) {
    const telefon = checkPhone(input.phone, input.countryCode);
    if (telefon) fehler.phone = telefon;
  }

  if (required.street !== false || !leer(input.street)) {
    const strasse = checkStreet(input.street);
    if (strasse) fehler.street = strasse;
  }

  if (required.postalCode !== false || !leer(input.postalCode)) {
    const plz = checkPostalCode(input.postalCode, input.countryCode);
    if (plz) fehler.postalCode = plz;
  }

  if (required.city !== false || !leer(input.city)) {
    const ort = checkCity(input.city);
    if (ort) fehler.city = ort;
  }

  const bemerkung = checkMessage(input.message);
  if (bemerkung) fehler.message = bemerkung;

  return fehler;
}

export const FIELD_ORDER: FieldName[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "street",
  "postalCode",
  "city",
  "countryCode",
  "message",
];

/** Erste Fehlermeldung in fester Feldreihenfolge, oder null. */
export function firstError(fehler: FieldErrors): { field: FieldName; message: string } | null {
  for (const feld of FIELD_ORDER) {
    const meldung = fehler[feld];

    if (meldung) return { field: feld, message: meldung };
  }

  return null;
}

/**
 * Bereinigt die Eingaben. Setzt voraus, dass validateGuest keine Fehler
 * gemeldet hat.
 */
export function cleanGuest(input: GuestInputRaw): GuestClean {
  const land = (input.countryCode ?? "").trim().toUpperCase();

  return {
    firstName: squash(input.firstName),
    lastName: squash(input.lastName),
    email: (input.email ?? "").trim().toLowerCase(),
    phone: normalisePhone(input.phone, land),
    street: squash(input.street),
    postalCode: squash(input.postalCode).toUpperCase(),
    city: squash(input.city),
    countryCode: land,
    message: (input.message ?? "").trim() || null,
  };
}
