import { NextResponse } from "next/server";

import { db } from "@/prisma/db";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const availableTimes = [
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30",
    "20:00",
    "20:30",
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

/**
 * HTML-Sonderzeichen escapen.
 * Dadurch können Inhalte des Gastes nicht als HTML
 * innerhalb der E-Mail interpretiert werden.
 */
function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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

        const customerEmail = String(email).trim().toLowerCase();

        await resend.emails.send({
            from:
                process.env.RESEND_FROM_EMAIL ||
                "Hendl-Eck <onboarding@resend.dev>",
            to: customerEmail,
            subject: "Reservierungsanfrage – Hendl-Eck",
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #211f1b;">
            <h2>Vielen Dank für Ihre Reservierungsanfrage!</h2>

            <p>Hallo ${String(firstName).trim()},</p>

            <p>
                vielen Dank für Ihre Reservierungsanfrage beim
                <strong>Hendl-Eck</strong>.
            </p>

            <h3>Ihre Anfrage</h3>

            <p>
                <strong>Datum:</strong> ${String(date)}<br>
                <strong>Uhrzeit:</strong> ${String(time)} Uhr<br>
                <strong>Personen:</strong> ${guestCount}
            </p>

            ${cleanMessage
                    ? `
                        <p>
                            <strong>Ihre Nachricht:</strong><br>
                            ${cleanMessage}
                        </p>
                    `
                    : ""
                }

            <p>
                Ihre Reservierungsanfrage wurde erfolgreich übermittelt.
            </p>

            <p>
                <strong>Wichtig:</strong> Dies ist zunächst eine
                Reservierungsanfrage. Die Reservierung ist erst nach
                Bestätigung durch das Hendl-Eck verbindlich.
            </p>

            <p>
                Wir melden uns schnellstmöglich bei Ihnen.
            </p>

            <p>
                Freundliche Grüße<br>
                <strong>Hendl-Eck</strong><br>
                Grabenstraße 12<br>
                8010 Graz
            </p>
        </div>
    `,
        });

        /*
         * -------------------------
         * E-Mail an Betreiber
         * -------------------------
         */

        const resendApiKey =
            process.env.RESEND_API_KEY;

        const notificationEmail =
            process.env.RESERVATION_NOTIFICATION_EMAIL;

        const fromEmail =
            process.env.RESEND_FROM_EMAIL;

        let emailSent = false;

        if (
            resendApiKey &&
            notificationEmail &&
            fromEmail
        ) {
            try {
                const resend = new Resend(
                    resendApiKey
                );

                const formattedDate =
                    new Intl.DateTimeFormat(
                        "de-AT",
                        {
                            weekday: "long",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                        }
                    ).format(
                        new Date(
                            `${date}T12:00:00`
                        )
                    );

                const safeFirstName =
                    escapeHtml(
                        String(firstName).trim()
                    );

                const safeLastName =
                    escapeHtml(
                        String(lastName).trim()
                    );

                const safeEmail =
                    escapeHtml(
                        String(email)
                            .trim()
                            .toLowerCase()
                    );

                const safePhone =
                    escapeHtml(
                        String(phone).trim()
                    );

                const safeTime =
                    escapeHtml(
                        String(time)
                    );

                const safeMessage =
                    cleanMessage
                        ? escapeHtml(cleanMessage)
                        : "";

                const messageSection =
                    safeMessage
                        ? `
                            <div style="margin-top: 24px;">
                                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #756f64; margin-bottom: 8px;">
                                    Nachricht
                                </div>

                                <div style="background: #f5f1e8; border-radius: 12px; padding: 16px; color: #211f1b; line-height: 1.6; white-space: pre-wrap;">
                                    ${safeMessage}
                                </div>
                            </div>
                        `
                        : "";

                const { error } =
                    await resend.emails.send({
                        from: fromEmail,
                        to: [notificationEmail],
                        replyTo: safeEmail,
                        subject: `Neue Reservierungsanfrage – ${formattedDate} um ${String(
                            time
                        )} Uhr`,
                        html: `
                            <div style="margin: 0; padding: 32px 16px; background: #f5f1e8; font-family: Arial, Helvetica, sans-serif; color: #211f1b;">
                                <div style="max-width: 620px; margin: 0 auto;">

                                    <div style="background: #211f1b; color: white; border-radius: 16px 16px 0 0; padding: 28px 32px;">
                                        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #c9a96a; font-weight: 700;">
                                            Alter Telegraf
                                        </div>

                                        <h1 style="margin: 8px 0 0; font-size: 26px; line-height: 1.2;">
                                            Neue Reservierungsanfrage
                                        </h1>
                                    </div>

                                    <div style="background: white; border-radius: 0 0 16px 16px; padding: 32px;">

                                        <p style="margin: 0 0 24px; color: #756f64; line-height: 1.6;">
                                            Über die Website wurde eine neue Tischreservierung angefragt.
                                        </p>

                                        <div style="display: grid; gap: 12px;">

                                            <div style="background: #f5f1e8; border-radius: 12px; padding: 16px;">
                                                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #756f64;">
                                                    Gast
                                                </div>

                                                <div style="margin-top: 5px; font-size: 18px; font-weight: 700;">
                                                    ${safeFirstName} ${safeLastName}
                                                </div>
                                            </div>

                                            <div style="background: #f5f1e8; border-radius: 12px; padding: 16px;">
                                                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #756f64;">
                                                    Reservierung
                                                </div>

                                                <div style="margin-top: 5px; font-size: 17px; font-weight: 700;">
                                                    ${formattedDate}
                                                </div>

                                                <div style="margin-top: 4px; font-size: 16px;">
                                                    ${safeTime} Uhr · ${guestCount} ${guestCount === 1
                                ? "Person"
                                : "Personen"
                            }
                                                </div>
                                            </div>

                                        </div>

                                        <div style="margin-top: 24px;">
                                            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #756f64; margin-bottom: 8px;">
                                                Kontakt
                                            </div>

                                            <div style="border: 1px solid #211f1b1a; border-radius: 12px; overflow: hidden;">

                                                <div style="padding: 13px 16px; border-bottom: 1px solid #211f1b1a;">
                                                    <strong>Telefon:</strong>
                                                    <a href="tel:${safePhone}" style="color: #211f1b; text-decoration: none; margin-left: 8px;">
                                                        ${safePhone}
                                                    </a>
                                                </div>

                                                <div style="padding: 13px 16px;">
                                                    <strong>E-Mail:</strong>
                                                    <a href="mailto:${safeEmail}" style="color: #211f1b; text-decoration: none; margin-left: 8px;">
                                                        ${safeEmail}
                                                    </a>
                                                </div>

                                            </div>
                                        </div>

                                        ${messageSection}

                                        <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #211f1b1a; color: #756f64; font-size: 13px; line-height: 1.6;">
                                            Diese Reservierung wurde automatisch über die Website des Alter Telegraf übermittelt.
                                        </div>

                                    </div>

                                </div>
                            </div>
                        `,
                    });

                if (error) {
                    console.error(
                        "Reservation email error:",
                        error
                    );
                } else {
                    emailSent = true;
                    console.log(
                        "Reservation notification email sent successfully."
                    );
                }
            } catch (emailError) {
                console.error(
                    "Reservation email exception:",
                    emailError
                );
            }
        } else {
            console.warn(
                "Reservation email not configured. Missing RESEND_API_KEY, RESERVATION_NOTIFICATION_EMAIL or RESEND_FROM_EMAIL."
            );
        }

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