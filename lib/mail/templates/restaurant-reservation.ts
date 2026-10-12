import { BUSINESS_CONTACT } from "../branding";
import { type MailSection, type RenderedMail, formatDateLong, renderMail } from "../layout";

// Reservierungsmails des Restaurants: eine an den Gast, eine an den Betrieb.
//
// Ohne Datenbank und ohne Umgebung - nur Form. Alle Angaben stammen aus der
// gespeicherten Reservierung.

export type RestaurantReservationMailData = {
  restaurantName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Datum im Format YYYY-MM-DD. */
  date: string;
  /** Uhrzeit im Format HH:MM. */
  time: string;
  guests: number;
  message: string | null;
};

/**
 * RECEIVED: Die Anfrage ist eingegangen, der Tisch noch nicht zugesagt.
 * CONFIRMED: Der Betrieb hat die Reservierung bestaetigt.
 */
export type ReservationMailVariant = "RECEIVED" | "CONFIRMED";

function personen(count: number) {
  return count === 1 ? "1 Person" : `${count} Personen`;
}

const KONTAKT_ZEILEN = [
  BUSINESS_CONTACT.street,
  `${BUSINESS_CONTACT.postalCode} ${BUSINESS_CONTACT.city}`,
];

function angaben(data: RestaurantReservationMailData): MailSection {
  return {
    title: "Ihre Angaben",
    rows: [
      { label: "Name", value: `${data.firstName} ${data.lastName}` },
      { label: "Datum", value: formatDateLong(data.date) },
      { label: "Uhrzeit", value: `${data.time} Uhr`, strong: true },
      { label: "Personen", value: personen(data.guests) },
      { label: "Telefon", value: data.phone },
      { label: "E-Mail", value: data.email },
    ],
  };
}

export function renderRestaurantReservation(
  data: RestaurantReservationMailData,
  variant: ReservationMailVariant
): RenderedMail {
  const name = `${data.firstName} ${data.lastName}`;
  const bestaetigt = variant === "CONFIRMED";

  const sections: MailSection[] = [angaben(data)];

  if (data.message) {
    sections.push({ title: "Ihre Nachricht", paragraphs: [data.message] });
  }

  const notes = bestaetigt
    ? [
        `Ihr Tisch ist für ${personen(data.guests)} am ${formatDateLong(data.date)} um ${
          data.time
        } Uhr reserviert. Wir halten ihn für Sie bereit.`,
      ]
    : [
        "Dies ist zunächst eine Reservierungsanfrage. Verbindlich wird sie mit unserer Bestätigung, die wir Ihnen so schnell wie möglich schicken.",
      ];

  return renderMail({
    subject: bestaetigt
      ? `Reservierung bestätigt – ${formatDateLong(data.date)}, ${data.time} Uhr`
      : `Reservierungsanfrage eingegangen – ${formatDateLong(data.date)}, ${data.time} Uhr`,
    preheader: `${formatDateLong(data.date)} um ${data.time} Uhr, ${personen(data.guests)}`,
    eyebrow: "Alter Telegraf · Hendl-Eck",
    heading: bestaetigt ? "Ihr Tisch ist reserviert" : "Ihre Anfrage ist angekommen",
    lead: [
      `Guten Tag ${name},`,
      bestaetigt
        ? `wir freuen uns, Ihre Reservierung im ${data.restaurantName} zu bestätigen.`
        : `vielen Dank für Ihre Reservierungsanfrage im ${data.restaurantName}.`,
    ],
    sections,
    notes,
    closing: [
      "Sollten sich Ihre Pläne ändern, geben Sie uns einfach telefonisch Bescheid.",
      "Herzliche Grüße aus Graz",
    ],
    footer: {
      title: data.restaurantName,
      lines: KONTAKT_ZEILEN,
      phone: BUSINESS_CONTACT.phone,
    },
  });
}

/** Benachrichtigung an den Betrieb. Antwort geht direkt an den Gast. */
export function renderRestaurantOperatorNotice(
  data: RestaurantReservationMailData
): RenderedMail {
  const sections: MailSection[] = [
    {
      title: "Reservierung",
      rows: [
        { label: "Datum", value: formatDateLong(data.date) },
        { label: "Uhrzeit", value: `${data.time} Uhr`, strong: true },
        { label: "Personen", value: personen(data.guests) },
      ],
    },
    {
      title: "Gast",
      rows: [
        { label: "Name", value: `${data.firstName} ${data.lastName}` },
        { label: "Telefon", value: data.phone },
        { label: "E-Mail", value: data.email },
      ],
    },
  ];

  if (data.message) {
    sections.push({ title: "Nachricht", paragraphs: [data.message] });
  }

  return renderMail({
    subject: `Neue Reservierungsanfrage – ${formatDateLong(data.date)} um ${data.time} Uhr`,
    preheader: `${personen(data.guests)}, ${data.firstName} ${data.lastName}`,
    eyebrow: "Alter Telegraf · Hendl-Eck",
    heading: "Neue Reservierungsanfrage",
    lead: ["Über die Website ist eine neue Tischreservierung eingegangen."],
    sections,
    closing: ["Die Anfrage liegt in der Verwaltung unter „Reservierungen“ zur Bestätigung bereit."],
    footer: {
      title: data.restaurantName,
      lines: KONTAKT_ZEILEN,
      phone: BUSINESS_CONTACT.phone,
      note: "Automatische Nachricht der Website.",
    },
  });
}
