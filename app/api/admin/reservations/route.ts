import "server-only";
import "temporal-polyfill/full/global";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { db } from "@/prisma/db";
import { verifySession } from "@/lib/auth";
import { sendRestaurantReservationMail } from "@/lib/mail/notifications";



const allowedStatuses = [
    "NEW",
    "CONFIRMED",
    "REJECTED",
    "COMPLETED",
] as const;

async function getAuthenticatedUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;

    if (!token) {
        return null;
    }

    const session = await verifySession(token);

    if (!session) {
        return null;
    }

    const user = await db.orm.public.User.first({
        id: session.userId,
    });

    return user ?? null;
}

export async function GET() {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                {
                    error: "Nicht angemeldet.",
                },
                {
                    status: 401,
                }
            );
        }

        const reservations =
            await db.orm.public.Reservation
                .where({
                    restaurantId: user.restaurantId,
                })
                .all();

        // Nach Datum und anschließend Uhrzeit sortieren
        reservations.sort((a, b) => {
            const dateA = String(a.reservationDate);
            const dateB = String(b.reservationDate);

            if (dateA !== dateB) {
                return dateA.localeCompare(dateB);
            }

            return a.reservationTime.localeCompare(
                b.reservationTime
            );
        });

        return NextResponse.json({
            success: true,
            reservations,
        });
    } catch (error) {
        console.error(
            "Admin reservations GET error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Reservierungen konnten nicht geladen werden.",
            },
            {
                status: 500,
            }
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                {
                    error: "Nicht angemeldet.",
                },
                {
                    status: 401,
                }
            );
        }

        const body = await request.json();

        const id =
            typeof body.id === "number"
                ? body.id
                : Number(body.id);

        const status =
            typeof body.status === "string"
                ? body.status
                : "";

        // Reiner Mailversand ohne Statuswechsel: "Bestätigung erneut senden".
        const resendOnly = body.resend === true;

        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json(
                {
                    error: "Ungültige Reservierungs-ID.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !resendOnly &&
            !allowedStatuses.includes(
                status as (typeof allowedStatuses)[number]
            )
        ) {
            return NextResponse.json(
                {
                    error: "Ungültiger Reservierungsstatus.",
                },
                {
                    status: 400,
                }
            );
        }

        // Prüfen, ob die Reservierung zum eigenen Restaurant gehört
        const reservation =
            await db.orm.public.Reservation.first({
                id,
                restaurantId: user.restaurantId,
            });

        if (!reservation) {
            return NextResponse.json(
                {
                    error: "Reservierung nicht gefunden.",
                },
                {
                    status: 404,
                }
            );
        }

        if (resendOnly) {
            const resent =
                await sendRestaurantReservationMail(
                    reservation.id,
                    reservation.status === "CONFIRMED"
                        ? "CONFIRMED"
                        : "RECEIVED"
                );

            return NextResponse.json({
                success: true,
                reservation,
                mail: resent
                    ? {
                        status: resent.status,
                        error: resent.error,
                        attempt: resent.attempt,
                    }
                    : null,
            });
        }

        const updated =
            await db.orm.public.Reservation
                .where({
                    id: reservation.id,
                    restaurantId: user.restaurantId,
                })
                .update({
                    status,
                });

        /*
         * Mit der Bestätigung des Betriebs wird die Reservierung für den
         * Gast verbindlich - dann geht die Zusage per E-Mail hinaus. Der
         * Statuswechsel steht bereits in der Datenbank; ein Fehler beim
         * Versand kann ihn nicht mehr rückgängig machen.
         */

        const mail =
            status === "CONFIRMED" &&
            reservation.status !== "CONFIRMED"
                ? await sendRestaurantReservationMail(
                    reservation.id,
                    "CONFIRMED"
                )
                : null;

        return NextResponse.json({
            success: true,
            reservation: updated,
            mail: mail
                ? {
                    status: mail.status,
                    error: mail.error,
                    attempt: mail.attempt,
                }
                : null,
        });
    } catch (error) {
        console.error(
            "Admin reservations PATCH error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Der Reservierungsstatus konnte nicht geändert werden.",
            },
            {
                status: 500,
            }
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                {
                    error: "Nicht angemeldet.",
                },
                {
                    status: 401,
                }
            );
        }

        const body = await request.json();

        const id =
            typeof body.id === "number"
                ? body.id
                : Number(body.id);

        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json(
                {
                    error: "Ungültige Reservierungs-ID.",
                },
                {
                    status: 400,
                }
            );
        }

        // Nur Reservierungen des eigenen Restaurants
        // dürfen gelöscht werden.
        const reservation =
            await db.orm.public.Reservation.first({
                id,
                restaurantId: user.restaurantId,
            });

        if (!reservation) {
            return NextResponse.json(
                {
                    error: "Reservierung nicht gefunden.",
                },
                {
                    status: 404,
                }
            );
        }

        await db.orm.public.Reservation
            .where({
                id: reservation.id,
                restaurantId: user.restaurantId,
            })
            .delete();

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error(
            "Admin reservations DELETE error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Die Reservierung konnte nicht gelöscht werden.",
            },
            {
                status: 500,
            }
        );
    }
}