import "server-only";

import { BED_TYPE_LABELS } from "@/lib/hotel/availability";
import { readPolicySnapshot } from "@/lib/hotel/cancellation";
import { nightsBetween } from "@/lib/hotel/pricing";
import { db } from "@/prisma/db";

import {
  MAIL_SUBJECTS,
  MAIL_TYPES,
  type SendMailResult,
  sendMail,
} from "./service";
import {
  type HotelBookingMailData,
  renderHotelBookingConfirmation,
} from "./templates/hotel-booking";
import {
  type ReservationMailVariant,
  type RestaurantReservationMailData,
  renderRestaurantReservation,
  renderRestaurantOperatorNotice,
} from "./templates/restaurant-reservation";

// Bindeglied zwischen Datenbank und Vorlagen.
//
// Jede Funktion laedt ihre Daten selbst anhand der ID. Dadurch laesst sich
// jede Mail jederzeit erneut erzeugen - genau das braucht die Aktion
// „Bestätigung erneut senden“ in der Verwaltung.

/** Aus "16:00:00" wird "16:00". */
function hhmm(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const text = String(value);
  const match = /^(\d{2}:\d{2})/.exec(text);

  return match ? match[1] : text;
}

/** Datumsanteil einer Datums- oder Zeitstempelspalte. */
function isoDate(value: unknown): string {
  return String(value).slice(0, 10);
}

/** Traegt die Buchung alle Angaben fuer die Bestaetigungsmail zusammen. */
export async function loadHotelBookingMailData(
  bookingId: number
): Promise<HotelBookingMailData | null> {
  const booking = await db.orm.hotel.Booking
    .where({ id: bookingId })
    .include("guest", (g) => g.select("firstName", "lastName", "email"))
    .include("hotel", (h) =>
      h.select(
        "name",
        "street",
        "postalCode",
        "city",
        "phone",
        "email",
        "checkInFrom",
        "checkOutUntil"
      )
    )
    .first();

  if (!booking) return null;

  const rooms = await db.orm.hotel.BookingRoom
    .where({ bookingId })
    .select("id", "bedType", "mealPlanSnapshot")
    .include("roomType", (rt) => rt.select("name"))
    .orderBy((r) => r.id.asc())
    .all();

  const first = rooms[0] ?? null;
  const snapshot = readPolicySnapshot(booking.cancellationPolicySnapshot);

  const checkIn = isoDate(booking.checkIn);
  const checkOut = isoDate(booking.checkOut);

  return {
    hotel: {
      name: booking.hotel.name,
      street: booking.hotel.street,
      postalCode: booking.hotel.postalCode,
      city: booking.hotel.city,
      phone: booking.hotel.phone,
      email: booking.hotel.email,
      checkInFrom: hhmm(booking.hotel.checkInFrom),
      checkOutUntil: hhmm(booking.hotel.checkOutUntil),
    },
    bookingNumber: booking.bookingNumber,
    guest: {
      firstName: booking.guest.firstName,
      lastName: booking.guest.lastName,
      email: booking.guest.email,
    },
    checkIn,
    checkOut,
    nights: nightsBetween(checkIn, checkOut),
    adults: booking.adults,
    children: booking.children,
    roomTypeName: first?.roomType.name ?? "Zimmer",
    bedTypeLabel: first?.bedType ? BED_TYPE_LABELS[first.bedType] : null,
    breakfast: first?.mealPlanSnapshot === "BREAKFAST",
    currency: booking.currency,
    roomsTotal: String(booking.roomsTotal),
    breakfastTotal: String(booking.extrasTotal),
    discountTotal: String(booking.discountTotal),
    totalAmount: String(booking.totalAmount),
    cancellation: snapshot ? { name: snapshot.name, text: snapshot.text } : null,
    cardGuarantee: booking.paymentMethod === "CARD_GUARANTEE",
    guestMessage: booking.guestMessage,
  };
}

/**
 * Bestaetigungsmail zur Hotelbuchung. Wird nach dem erfolgreichen Anlegen
 * aufgerufen und kann in der Verwaltung beliebig oft wiederholt werden.
 */
export async function sendHotelBookingConfirmation(
  bookingId: number
): Promise<SendMailResult | null> {
  const data = await loadHotelBookingMailData(bookingId);

  if (!data) return null;

  const mail = renderHotelBookingConfirmation(data);

  return sendMail({
    type: MAIL_TYPES.HOTEL_BOOKING_CONFIRMATION,
    subjectType: MAIL_SUBJECTS.HOTEL_BOOKING,
    subjectId: bookingId,
    to: data.guest.email ?? "",
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: data.hotel.email,
  });
}

async function loadReservationMailData(
  reservationId: number
): Promise<RestaurantReservationMailData | null> {
  const reservation = await db.orm.public.Reservation
    .where({ id: reservationId })
    .include("restaurant", (r) => r.select("name"))
    .first();

  if (!reservation) return null;

  return {
    restaurantName: reservation.restaurant.name,
    firstName: reservation.firstName,
    lastName: reservation.lastName,
    email: reservation.email,
    phone: reservation.phone,
    date: isoDate(reservation.reservationDate),
    time: reservation.reservationTime,
    guests: reservation.guests,
    message: reservation.message,
  };
}

/**
 * Mail an den Gast zur Tischreservierung. RECEIVED bei Eingang der Anfrage,
 * CONFIRMED sobald der Betrieb sie bestaetigt hat.
 */
export async function sendRestaurantReservationMail(
  reservationId: number,
  variant: ReservationMailVariant
): Promise<SendMailResult | null> {
  const data = await loadReservationMailData(reservationId);

  if (!data) return null;

  const mail = renderRestaurantReservation(data, variant);

  return sendMail({
    type:
      variant === "CONFIRMED"
        ? MAIL_TYPES.RESTAURANT_RESERVATION_CONFIRMED
        : MAIL_TYPES.RESTAURANT_RESERVATION_RECEIVED,
    subjectType: MAIL_SUBJECTS.RESTAURANT_RESERVATION,
    subjectId: reservationId,
    to: data.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
}

/**
 * Benachrichtigung an den Betrieb. Ohne hinterlegte Betriebsadresse
 * entfaellt sie - das ist kein Fehler des Gastvorgangs.
 */
export async function sendRestaurantOperatorNotice(
  reservationId: number
): Promise<SendMailResult | null> {
  const empfaenger = process.env.RESERVATION_NOTIFICATION_EMAIL?.trim();

  if (!empfaenger) return null;

  const data = await loadReservationMailData(reservationId);

  if (!data) return null;

  const mail = renderRestaurantOperatorNotice(data);

  return sendMail({
    type: MAIL_TYPES.RESTAURANT_RESERVATION_OPERATOR,
    subjectType: MAIL_SUBJECTS.RESTAURANT_RESERVATION,
    subjectId: reservationId,
    to: empfaenger,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    // Eine Antwort des Betriebs soll direkt beim Gast landen.
    replyTo: data.email,
  });
}
