import "server-only";
import "temporal-polyfill/full/global";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { db } from "@/prisma/db";
import { verifySession } from "@/lib/auth";

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
        { error: "Nicht angemeldet." },
        { status: 401 }
      );
    }

    const templates = await db.orm.public.MenuTemplate
      .select(
        "id",
        "dish",
        "description",
        "price"
      )
      .where({
        restaurantId: user.restaurantId,
      })
      .all();

    return NextResponse.json({
      templates,
    });
  } catch (error) {
    console.error("Menu templates GET error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Die gespeicherten Menüs konnten nicht geladen werden.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Nicht angemeldet." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const id =
      typeof body.id === "number"
        ? body.id
        : Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Ungültige Menü-ID." },
        { status: 400 }
      );
    }

    // Wichtig:
    // Es darf nur eine Vorlage des eigenen Restaurants
    // gelöscht werden.
    const template = await db.orm.public.MenuTemplate.first({
      id,
      restaurantId: user.restaurantId,
    });

    if (!template) {
      return NextResponse.json(
        { error: "Menüvorlage nicht gefunden." },
        { status: 404 }
      );
    }

    await db.orm.public.MenuTemplate
      .where({
        id: template.id,
        restaurantId: user.restaurantId,
      })
      .delete();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Menu template DELETE error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Das Menü konnte nicht gelöscht werden.",
      },
      { status: 500 }
    );
  }
}