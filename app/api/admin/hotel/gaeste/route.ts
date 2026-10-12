import "server-only";
import "temporal-polyfill/full/global";

import { NextResponse } from "next/server";
import { Temporal } from "temporal-polyfill";

import {
  type Body,
  HttpError,
  handle,
  readBody,
  readId,
  readRequiredText,
  readText,
  requireHotel,
  requireHotelAdmin,
} from "@/lib/hotel/admin-api";
import { BED_TYPE_LABELS } from "@/lib/hotel/availability";
import { toCents, fromCents } from "@/lib/hotel/pricing";
import { todayInHotelTimezone } from "@/lib/hotel/time";
import { db } from "@/prisma/db";

// Gaestestammdaten.
//
// Der Gast ist der dauerhafte Datensatz, die Buchung der Vorgang. Beides
// bleibt getrennt: Eine Aenderung der Stammdaten darf gespeicherte
// Buchungssummen oder eingefrorene Vertragsdaten nicht beruehren. Deshalb
// schreibt dieser Endpunkt ausschliesslich in hotel.guest - niemals in
// Buchungen.
//
// DSGVO: Gespeichert wird nur, was fuer Aufenthalt und Rechnung noetig ist.
// Meldedaten (Geburtsdatum, Staatsangehoerigkeit, Ausweis) sind freiwillige
// Zusatzfelder und bleiben leer, solange sie nicht erfasst werden. Sie
// erscheinen nur im Detail, nicht in der Liste.

type Sort = "name" | "lastStay" | "bookings" | "created";

const PER_PAGE = 25;

/** Nur Ziffern, fuer den Telefonvergleich. */
function phoneKey(phone: string | null) {
  const ziffern = (phone ?? "").replace(/[^0-9]/g, "");

  return ziffern.length >= 6 ? ziffern.slice(-9) : "";
}

function readOptionalDate(body: Body, key: string, label: string) {
  const raw = body[key];

  if (raw === null || raw === undefined || String(raw).trim() === "") return null;

  const value = String(raw).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${label} muss im Format JJJJ-MM-TT angegeben werden.`);
  }

  try {
    return Temporal.PlainDate.from(value);
  } catch {
    throw new HttpError(400, `${label} ist kein gültiges Datum.`);
  }
}

function readEmail(body: Body, required: boolean) {
  const email = readText(body, "email", "E-Mail", { max: 160, required });

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new HttpError(400, "Bitte eine gültige E-Mail-Adresse angeben.");
  }

  return email ? email.toLowerCase() : null;
}

/** Felder, die der Betrieb pflegen darf. */
function guestFields(body: Body, required: boolean) {
  const countryCode = readText(body, "countryCode", "Land", { max: 2 });

  if (countryCode && !/^[A-Za-z]{2}$/.test(countryCode)) {
    throw new HttpError(400, "Das Land muss ein zweistelliger Ländercode sein, z. B. AT.");
  }

  return {
    firstName: required
      ? readRequiredText(body, "firstName", "Vorname", 80)
      : readText(body, "firstName", "Vorname", { max: 80 }),
    lastName: required
      ? readRequiredText(body, "lastName", "Nachname", 80)
      : readText(body, "lastName", "Nachname", { max: 80 }),
    email: readEmail(body, false),
    phone: readText(body, "phone", "Telefon", { max: 40 }),
    street: readText(body, "street", "Straße", { max: 160 }),
    postalCode: readText(body, "postalCode", "PLZ", { max: 12 }),
    city: readText(body, "city", "Ort", { max: 80 }),
    countryCode: countryCode ? countryCode.toUpperCase() : null,
    birthDate: readOptionalDate(body, "birthDate", "Geburtsdatum"),
    nationality: readText(body, "nationality", "Staatsangehörigkeit", { max: 80 }),
    idDocumentType: readText(body, "idDocumentType", "Ausweisart", { max: 40 }),
    idDocumentNo: readText(body, "idDocumentNo", "Ausweisnummer", { max: 60 }),
    notes: readText(body, "notes", "Notiz", { max: 2000 }),
  };
}

type Aufenthalt = {
  bookingId: number;
  bookingNumber: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  totalAmount: string;
  currency: string;
  roomTypeName: string | null;
  bedTypeLabel: string | null;
  roomNumber: string | null;
};

/**
 * Zahlen zum Gast. Umsatz wird ausschliesslich aus abgeschlossenen oder
 * laufenden Aufenthalten gebildet: Storno und Nichtanreise zaehlen nicht,
 * sonst waere die Zahl irreführend.
 */
const UMSATZ_STATUS = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"];

export async function GET(request: Request) {
  return handle("Guests GET", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const url = new URL(request.url);
    const heute = todayInHotelTimezone(hotel.timezone);

    const einzelId = Number(url.searchParams.get("id"));

    // Alle Buchungen des Hauses, einmal geladen. Daraus entstehen Kennzahlen
    // und Detailansicht, ohne Abfrage je Gast.
    const [gaeste, buchungen, roomTypes, rooms] = await Promise.all([
      db.orm.hotel.Guest.orderBy([(g) => g.lastName.asc(), (g) => g.firstName.asc()]).all(),
      db.orm.hotel.Booking
        .where({ hotelId: hotel.id })
        .select(
          "id",
          "bookingNumber",
          "guestId",
          "status",
          "checkIn",
          "checkOut",
          "adults",
          "children",
          "totalAmount",
          "currency",
          "createdAt"
        )
        .include("rooms", (r) => r.select("roomTypeId", "roomId", "bedType"))
        .all(),
      db.orm.hotel.RoomType.where({ hotelId: hotel.id }).select("id", "name").all(),
      db.orm.hotel.Room.where({ hotelId: hotel.id }).select("id", "number").all(),
    ]);

    const typName = new Map(roomTypes.map((typ) => [typ.id, typ.name]));
    const zimmerNummer = new Map(rooms.map((zimmer) => [zimmer.id, zimmer.number]));

    const jeGast = new Map<number, Aufenthalt[]>();

    for (const buchung of buchungen) {
      const erste = buchung.rooms[0] ?? null;
      const checkIn = String(buchung.checkIn);
      const checkOut = String(buchung.checkOut);

      const eintrag: Aufenthalt = {
        bookingId: buchung.id,
        bookingNumber: buchung.bookingNumber,
        status: buchung.status,
        checkIn,
        checkOut,
        nights: Math.max(
          0,
          Temporal.PlainDate.from(checkIn).until(Temporal.PlainDate.from(checkOut)).days
        ),
        adults: buchung.adults,
        children: buchung.children,
        totalAmount: String(buchung.totalAmount),
        currency: buchung.currency,
        roomTypeName: erste ? (typName.get(erste.roomTypeId) ?? null) : null,
        bedTypeLabel: erste?.bedType ? BED_TYPE_LABELS[erste.bedType] : null,
        roomNumber: erste?.roomId ? (zimmerNummer.get(erste.roomId) ?? null) : null,
      };

      const liste = jeGast.get(buchung.guestId) ?? [];
      liste.push(eintrag);
      jeGast.set(buchung.guestId, liste);
    }

    const kennzahlen = (guestId: number) => {
      const liste = (jeGast.get(guestId) ?? [])
        .slice()
        .sort((a, b) => b.checkIn.localeCompare(a.checkIn));

      const gezaehlt = liste.filter((eintrag) => UMSATZ_STATUS.includes(eintrag.status));

      const umsatz = gezaehlt.reduce(
        (summe, eintrag) => summe + toCents(eintrag.totalAmount),
        0
      );

      const vergangen = liste.filter((eintrag) => eintrag.checkOut <= heute);
      const kommend = liste.filter((eintrag) => eintrag.checkOut > heute);

      return {
        bookings: liste.length,
        stays: gezaehlt.length,
        cancelled: liste.filter((eintrag) => eintrag.status === "CANCELLED").length,
        noShows: liste.filter((eintrag) => eintrag.status === "NO_SHOW").length,
        revenue: fromCents(umsatz),
        lastStay: vergangen[0]?.checkOut ?? null,
        nextStay:
          kommend.length > 0 ? kommend[kommend.length - 1].checkIn : null,
        stayList: liste,
      };
    };

    // Dubletten: gleiche E-Mail oder gleicher Nachname mit gleicher
    // Telefonnummer. Nur ein Hinweis - zusammengefuehrt wird nichts
    // automatisch.
    const nachEmail = new Map<string, number[]>();
    const nachTelefon = new Map<string, number[]>();

    for (const gast of gaeste) {
      if (gast.email) {
        const key = gast.email.toLowerCase();
        nachEmail.set(key, [...(nachEmail.get(key) ?? []), gast.id]);
      }

      const telefon = phoneKey(gast.phone);

      if (telefon) {
        const key = `${gast.lastName.toLowerCase()}|${telefon}`;
        nachTelefon.set(key, [...(nachTelefon.get(key) ?? []), gast.id]);
      }
    }

    const dublette = (gast: (typeof gaeste)[number]) => {
      const perEmail = gast.email ? (nachEmail.get(gast.email.toLowerCase()) ?? []) : [];
      const telefon = phoneKey(gast.phone);
      const perTelefon = telefon
        ? (nachTelefon.get(`${gast.lastName.toLowerCase()}|${telefon}`) ?? [])
        : [];

      const andere = new Set([...perEmail, ...perTelefon].filter((id) => id !== gast.id));

      return andere.size > 0 ? [...andere] : null;
    };

    // Einzelabruf fuer das Detail.
    if (Number.isInteger(einzelId) && einzelId > 0) {
      const gast = gaeste.find((eintrag) => eintrag.id === einzelId);

      if (!gast) throw new HttpError(404, "Gast nicht gefunden.");

      const zahlen = kennzahlen(gast.id);

      return NextResponse.json({
        guest: {
          ...gast,
          birthDate: gast.birthDate ? String(gast.birthDate) : null,
          createdAt: String(gast.createdAt),
          duplicateOf: dublette(gast),
          ...zahlen,
        },
      });
    }

    const suche = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const sort = (url.searchParams.get("sort") ?? "name") as Sort;
    const seite = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const nurMitBuchung = url.searchParams.get("withBookings") === "true";
    const nurDubletten = url.searchParams.get("duplicates") === "true";

    const angereichert = gaeste.map((gast) => {
      const zahlen = kennzahlen(gast.id);

      return {
        id: gast.id,
        firstName: gast.firstName,
        lastName: gast.lastName,
        email: gast.email,
        phone: gast.phone,
        city: gast.city,
        countryCode: gast.countryCode,
        hasNotes: Boolean(gast.notes),
        createdAt: String(gast.createdAt),
        duplicateOf: dublette(gast),
        bookings: zahlen.bookings,
        stays: zahlen.stays,
        cancelled: zahlen.cancelled,
        noShows: zahlen.noShows,
        revenue: zahlen.revenue,
        lastStay: zahlen.lastStay,
        nextStay: zahlen.nextStay,
        bookingNumbers: zahlen.stayList.map((eintrag) => eintrag.bookingNumber),
      };
    });

    const gefiltert = angereichert.filter((gast) => {
      if (nurMitBuchung && gast.bookings === 0) return false;
      if (nurDubletten && !gast.duplicateOf) return false;

      if (!suche) return true;

      const heuhaufen = [
        gast.firstName,
        gast.lastName,
        `${gast.firstName} ${gast.lastName}`,
        gast.email ?? "",
        gast.phone ?? "",
        // Telefonnummern auch ohne Trennzeichen durchsuchbar machen.
        (gast.phone ?? "").replace(/[^0-9]/g, ""),
        gast.city ?? "",
        ...gast.bookingNumbers,
      ]
        .join(" ")
        .toLowerCase();

      const nurZiffern = suche.replace(/[^0-9]/g, "");

      if (nurZiffern.length >= 4 && heuhaufen.includes(nurZiffern)) return true;

      return heuhaufen.includes(suche);
    });

    const sortiert = [...gefiltert].sort((a, b) => {
      if (sort === "bookings") return b.bookings - a.bookings || a.lastName.localeCompare(b.lastName);
      if (sort === "created") return b.createdAt.localeCompare(a.createdAt);

      if (sort === "lastStay") {
        return (b.lastStay ?? "").localeCompare(a.lastStay ?? "") ||
          a.lastName.localeCompare(b.lastName);
      }

      return (
        a.lastName.localeCompare(b.lastName, "de") ||
        a.firstName.localeCompare(b.firstName, "de")
      );
    });

    const seiten = Math.max(1, Math.ceil(sortiert.length / PER_PAGE));
    const sicher = Math.min(seite, seiten);

    return NextResponse.json({
      guests: sortiert.slice((sicher - 1) * PER_PAGE, sicher * PER_PAGE),
      page: sicher,
      pages: seiten,
      perPage: PER_PAGE,
      total: sortiert.length,
      totalAll: angereichert.length,
      duplicates: angereichert.filter((gast) => gast.duplicateOf).length,
      today: heute,
    });
  });
}

export async function POST(request: Request) {
  return handle("Guests POST", async () => {
    await requireHotelAdmin();
    await requireHotel();

    const body = await readBody(request);
    const felder = guestFields(body, true);

    // Hinweis auf eine moegliche Dublette, bevor ein zweiter Datensatz
    // entsteht. Mit force kann der Betrieb bewusst anlegen.
    if (felder.email && body.force !== true) {
      const vorhanden = await db.orm.hotel.Guest.where({ email: felder.email }).first();

      if (vorhanden) {
        throw new HttpError(
          409,
          `Zu dieser E-Mail gibt es bereits den Gast ${vorhanden.firstName} ${vorhanden.lastName}.`
        );
      }
    }

    const gast = await db.orm.hotel.Guest.create({
      firstName: felder.firstName as string,
      lastName: felder.lastName as string,
      email: felder.email,
      phone: felder.phone,
      street: felder.street,
      postalCode: felder.postalCode,
      city: felder.city,
      countryCode: felder.countryCode,
      birthDate: felder.birthDate,
      nationality: felder.nationality,
      idDocumentType: felder.idDocumentType,
      idDocumentNo: felder.idDocumentNo,
      notes: felder.notes,
    });

    return NextResponse.json({ success: true, id: gast.id }, { status: 201 });
  });
}

export async function PATCH(request: Request) {
  return handle("Guests PATCH", async () => {
    await requireHotelAdmin();
    await requireHotel();

    const body = await readBody(request);
    const id = readId(body);

    const gast = await db.orm.hotel.Guest.first({ id });

    if (!gast) throw new HttpError(404, "Gast nicht gefunden.");

    const felder = guestFields(body, true);

    if (felder.email && felder.email !== gast.email) {
      const vorhanden = await db.orm.hotel.Guest.where({ email: felder.email }).first();

      if (vorhanden && vorhanden.id !== id) {
        throw new HttpError(
          409,
          `Diese E-Mail gehört bereits zu ${vorhanden.firstName} ${vorhanden.lastName}.`
        );
      }
    }

    // Nur Stammdaten. Buchungen, Summen und eingefrorene Vertragsdaten
    // bleiben unberuehrt.
    await db.orm.hotel.Guest.where({ id }).update({
      firstName: felder.firstName as string,
      lastName: felder.lastName as string,
      email: felder.email,
      phone: felder.phone,
      street: felder.street,
      postalCode: felder.postalCode,
      city: felder.city,
      countryCode: felder.countryCode,
      birthDate: felder.birthDate,
      nationality: felder.nationality,
      idDocumentType: felder.idDocumentType,
      idDocumentNo: felder.idDocumentNo,
      notes: felder.notes,
    });

    return NextResponse.json({ success: true });
  });
}
