import { NextResponse } from "next/server";
import { Temporal } from "temporal-polyfill";

import { db } from "@/prisma/db";

import {
    sendRestaurantOperatorNotice,
    sendRestaurantReservationMail,
} from "@/lib/mail/notifications";

const availableTimes = [
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
];

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(
        email.trim()
    );
}

function isValidPhone(phone: string) {
    const cleaned = phone.replace(/[\s\-()/]/g, "");

    return /^\+?[0-9]{7,15}$/.test(cleaned);
}

function isValidName(name: string) {
    return /^[A-Za-zÀ-ÖØ-öø-ÿÄÖÜäöüß' -]{2,50}$/.test(
        name.trim()
    );
}

function isValidDate(date: string) {
    if (!date) {
        return false;
    }

    const selectedDate = new Date(
        `${date}T00:00:00`
    );

    if (Number.isNaN(selectedDate.getTime())) {
        return false;
    }

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
        return false;
    }

    // Montag = geschlossen
    if (selectedDate.getDay() === 1) {
        return false;
    }

    return true;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const {
            date,
            time,
            guests,
            firstName,
            lastName,
            email,
            phone,
            message,
        } = body;

        /*
         * -------------------------
         * Pflichtfelder
         * -------------------------
         */

        if (
            !date ||
            !time ||
            guests === undefined ||
            guests === null ||
            !firstName ||
            !lastName ||
            !email ||
            !phone
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Bitte füllen Sie alle Pflichtfelder aus.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * -------------------------
         * Name
         * -------------------------
         */

        if (!isValidName(String(firstName))) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Bitte geben Sie einen gültigen Vornamen ein.",
                },
                {
                    status: 400,
                }
            );
        }

        if (!isValidName(String(lastName))) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Bitte geben Sie einen gültigen Nachnamen ein.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * -------------------------
         * E-Mail
         * -------------------------
         */

        if (!isValidEmail(String(email))) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * -------------------------
         * Telefon
         * -------------------------
         */

        if (!isValidPhone(String(phone))) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Bitte geben Sie eine gültige Telefonnummer ein.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * -------------------------
         * Datum
         * -------------------------
         */

        if (!isValidDate(String(date))) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Das gewählte Datum ist nicht gültig. Montags ist das Restaurant geschlossen.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * -------------------------
         * Uhrzeit
         * -------------------------
         */

        if (!availableTimes.includes(String(time))) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Diese Uhrzeit ist nicht verfügbar.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * -------------------------
         * Personen
         * -------------------------
         */

        const guestCount = Number(guests);

        if (
            !Number.isInteger(guestCount) ||
            guestCount < 1 ||
            guestCount > 20
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Die Personenanzahl muss zwischen 1 und 20 liegen.",
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * -------------------------
         * Nachricht
         * -------------------------
         */

        const cleanMessage = message
            ? String(message).trim().slice(0, 500)
            : null;

        /*
         * -------------------------
         * Restaurant suchen
         * -------------------------
         */

        const restaurant =
            await db.orm.public.Restaurant.first({
                slug: "alter-telegraf",
            });

        if (!restaurant) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Restaurant konnte nicht gefunden werden.",
                },
                {
                    status: 404,
                }
            );
        }

        /*
         * -------------------------
         * Reservierung erstellen
         * -------------------------
         */

        const reservation =
            await db.orm.public.Reservation.create({
                restaurantId: restaurant.id,
                firstName: String(firstName).trim(),
                lastName: String(lastName).trim(),
                email: String(email)
                    .trim()
                    .toLowerCase(),
                phone: String(phone).trim(),
                reservationDate:
                    Temporal.Instant.from(
                        `${date}T00:00:00Z`
                    ),
                reservationTime: String(time),
                guests: guestCount,
                message: cleanMessage,
                status: "NEW",
            });

        /*
         * -------------------------
         * E-Mail-Versand
         * -------------------------
         *
         * Zuerst ist die Reservierung gespeichert, erst danach wird
         * verschickt. Der zentrale Mailservice wirft nie: Ein Ausfall des
         * Mailservers darf eine gueltige Reservierung nicht gefaehrden.
         * Fehlgeschlagene Versuche stehen im Protokoll und lassen sich in
         * der Verwaltung erneut anstossen.
         */

        const guestMail =
            await sendRestaurantReservationMail(
                reservation.id,
                "RECEIVED"
            );

        await sendRestaurantOperatorNotice(
            reservation.id
        );

        const emailSent =
            guestMail?.status === "SENT";

        /*
         * -------------------------
         * Erfolgreiche Antwort
         * -------------------------
         */

        return NextResponse.json(
            {
                success: true,
                reservationId: reservation.id,
                emailSent,
            },
            {
                status: 201,
            }
        );
    } catch (error) {
        console.error(
            "Reservation error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    "Die Reservierungsanfrage konnte nicht gespeichert werden.",
            },
            {
                status: 500,
            }
        );
    }
}