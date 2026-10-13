import { formatMoney } from "@/lib/money";

import { type MailSection, type RenderedMail, formatDateLong, renderMail } from "../layout";

// Buchungsbestaetigung des Hotels.
//
// Diese Datei kennt keine Datenbank und keine Umgebung: Sie formt
// ausschliesslich die uebergebenen Buchungsdaten. Alle Werte stammen aus der
// tatsaechlichen Buchung, nichts ist festgeschrieben.

export type HotelBookingMailData = {
  hotel: {
    name: string;
    street: string | null;
    postalCode: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    checkInFrom: string | null;
    checkOutUntil: string | null;
  };
  bookingNumber: string;
  guest: {
    firstName: string;
    lastName: string;
    /** Kann fehlen: Gaeste aus dem Haus werden ohne Adresse erfasst. */
    email: string | null;
  };
  /** Datumsangaben im Format YYYY-MM-DD. */
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  roomTypeName: string;
  bedTypeLabel: string | null;
  breakfast: boolean;
  currency: string;
  /** Dezimalbetraege als Text, z. B. "258.00". */
  roomsTotal: string;
  breakfastTotal: string;
  discountTotal: string;
  totalAmount: string;
  /** Eingefrorene Stornobedingung der Buchung. */
  cancellation: { name: string; text: string[] } | null;
  cardGuarantee: boolean;
  guestMessage: string | null;
};

// Darstellung zentral aus lib/money.ts: einheitlich „330,00 €“.
// Der Waehrungscode der Buchung wird nur dann zusaetzlich genannt, wenn er
// nicht Euro ist - das Haus rechnet in Euro.
function geld(amount: string, currency: string) {
  const text = formatMoney(amount);

  return currency && currency !== "EUR" ? `${text} (${currency})` : text;
}

function naechte(count: number) {
  return count === 1 ? "1 Nacht" : `${count} Nächte`;
}

function personen(count: number) {
  return count === 1 ? "1 Person" : `${count} Personen`;
}

export function renderHotelBookingConfirmation(data: HotelBookingMailData): RenderedMail {
  const gastName = `${data.guest.firstName} ${data.guest.lastName}`;

  const aufenthalt: MailSection = {
    title: "Ihr Aufenthalt",
    rows: [
      { label: "Buchungsnummer", value: data.bookingNumber, strong: true },
      { label: "Gast", value: gastName },
      { label: "Anreise", value: formatDateLong(data.checkIn) },
      { label: "Abreise", value: formatDateLong(data.checkOut) },
      { label: "Nächte", value: naechte(data.nights) },
      { label: "Erwachsene", value: personen(data.adults) },
      { label: "Kinder", value: String(data.children) },
      { label: "Zimmerkategorie", value: data.roomTypeName },
      ...(data.bedTypeLabel ? [{ label: "Bettvariante", value: data.bedTypeLabel }] : []),
      { label: "Frühstück", value: data.breakfast ? "ja" : "nein" },
    ],
  };

  // Alle Betraege kommen aus der Buchung. Rabatt und Fruehstueck erscheinen
  // auch dann, wenn sie null sind - so ist die Rechnung nachvollziehbar.
  const preise: MailSection = {
    title: "Preis",
    rows: [
      { label: `Zimmerpreis (${naechte(data.nights)})`, value: geld(data.roomsTotal, data.currency) },
      { label: "Frühstück", value: geld(data.breakfastTotal, data.currency) },
      { label: "Rabatt", value: `− ${geld(data.discountTotal, data.currency)}` },
      { label: "Gesamtbetrag", value: geld(data.totalAmount, data.currency), strong: true },
    ],
  };

  const sections: MailSection[] = [aufenthalt, preise];

  const ankunft: string[] = [];

  if (data.hotel.checkInFrom) {
    ankunft.push(`Anreise ab ${data.hotel.checkInFrom} Uhr`);
  }

  if (data.hotel.checkOutUntil) {
    ankunft.push(`Abreise bis ${data.hotel.checkOutUntil} Uhr`);
  }

  if (ankunft.length > 0) {
    sections.push({ title: "An- und Abreise", bullets: ankunft });
  }

  if (data.cancellation) {
    sections.push({
      title: `Stornobedingungen (${data.cancellation.name})`,
      bullets: data.cancellation.text,
    });
  }

  if (data.guestMessage) {
    sections.push({ title: "Ihre Anmerkung", paragraphs: [data.guestMessage] });
  }

  const notes: string[] = [];

  if (data.cardGuarantee) {
    notes.push(
      "Ihre Kreditkarte ist als Garantie hinterlegt. Es wurde nichts abgebucht. Eine Belastung erfolgt ausschließlich nach den oben genannten Stornobedingungen."
    );
  } else {
    notes.push(
      `Die Zahlung erfolgt vor Ort im Hotel. Vorab ist keine Zahlung nötig, der Gesamtbetrag beträgt ${geld(
        data.totalAmount,
        data.currency
      )}.`
    );
  }

  const adresse = [data.hotel.street, [data.hotel.postalCode, data.hotel.city].filter(Boolean).join(" ")]
    .filter((line): line is string => Boolean(line && line.trim()))
    .map((line) => line.trim());

  return renderMail({
    subject: `Buchungsbestätigung ${data.bookingNumber} – ${data.hotel.name}`,
    preheader: `${formatDateLong(data.checkIn)} bis ${formatDateLong(data.checkOut)}, ${
      data.roomTypeName
    }`,
    eyebrow: "Alter Telegraf · Hendl-Eck",
    heading: "Ihre Buchung ist bestätigt",
    lead: [
      `Guten Tag ${gastName},`,
      `vielen Dank für Ihre Buchung im ${data.hotel.name}. Wir haben Ihren Aufenthalt verbindlich bestätigt und freuen uns auf Ihren Besuch.`,
    ],
    sections,
    notes,
    closing: [
      "Haben Sie Fragen oder möchten Sie etwas ändern? Antworten Sie einfach auf diese E-Mail oder rufen Sie uns an.",
      "Herzliche Grüße aus Graz",
    ],
    footer: {
      title: data.hotel.name,
      lines: adresse,
      phone: data.hotel.phone ?? undefined,
      email: data.hotel.email ?? undefined,
      note: `Diese Bestätigung bezieht sich auf Buchung ${data.bookingNumber}.`,
    },
  });
}
