import "server-only";
import "temporal-polyfill/full/global";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { db } from "@/prisma/db";
import { verifySession } from "@/lib/auth";

const dayNumbers: Record<string, number> = {
    Montag: 1,
    Dienstag: 2,
    Mittwoch: 3,
    Donnerstag: 4,
    Freitag: 5,
};

export async function POST(request: Request) {
    try {
        // Session prüfen
        const cookieStore = await cookies();
        const token = cookieStore.get("session")?.value;

        if (!token) {
            return NextResponse.json(
                { error: "Nicht angemeldet." },
                { status: 401 }
            );
        }

        const session = await verifySession(token);

        if (!session) {
            return NextResponse.json(
                { error: "Ungültige Session." },
                { status: 401 }
            );
        }

        // Benutzer laden
        const user = await db.orm.public.User.first({
            id: session.userId,
        });

        if (!user) {
            return NextResponse.json(
                { error: "Benutzer nicht gefunden." },
                { status: 401 }
            );
        }

        // Request-Daten lesen
        const body = await request.json();

        const selectedDay =
            typeof body.selectedDay === "string"
                ? body.selectedDay
                : "";

        const dish =
            typeof body.dish === "string"
                ? body.dish.trim()
                : "";

        const description =
            typeof body.description === "string"
                ? body.description.trim()
                : "";

        const price =
            typeof body.price === "string"
                ? body.price.trim()
                : "";

        const visible = Boolean(body.visible);

        const weekday = dayNumbers[selectedDay];

        // Eingaben prüfen
        if (!weekday) {
            return NextResponse.json(
                { error: "Ungültiger Wochentag." },
                { status: 400 }
            );
        }

        if (!dish) {
            return NextResponse.json(
                { error: "Bitte ein Gericht eingeben." },
                { status: 400 }
            );
        }

        if (!price) {
            return NextResponse.json(
                { error: "Bitte einen Preis eingeben." },
                { status: 400 }
            );
        }

        // Aktuelles Tagesmenü speichern
        const menu = await db.orm.public.DailyMenu.upsert({
            create: {
                weekday,
                dish,
                description: description || null,
                price,
                visible,
                restaurantId: user.restaurantId,
            },

            update: {
                dish,
                description: description || null,
                price,
                visible,
            },

            conflictOn: {
                restaurantId: user.restaurantId,
                weekday,
            },
        });

        // Menü als wiederverwendbare Vorlage speichern
        const existingTemplate = await db.orm.public.MenuTemplate.first({
            restaurantId: user.restaurantId,
            dish,
            description: description || null,
            price,
          });
          
          if (existingTemplate) {
            return NextResponse.json({
              success: true,
              alreadyExists: true,
              message: "Dieses Menü ist bereits vorhanden.",
              menu,
            });
          }
          
          const template = await db.orm.public.MenuTemplate.create({
            dish,
            description: description || null,
            price,
            restaurantId: user.restaurantId,
          });
          
          console.log(
            "MENU TEMPLATE ERSTELLT:",
            template.id,
            template.dish
          );

        return NextResponse.json({
            success: true,
            menu,
        });
    } catch (error) {
        console.error("Daily menu save error:", error);

        return NextResponse.json(
            {
                error:
                    "Das Tagesmenü konnte nicht gespeichert werden.",
            },
            { status: 500 }
        );
    }
}