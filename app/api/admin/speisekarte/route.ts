import "server-only";

import { NextResponse } from "next/server";

import {
  type Body,
  HttpError,
  handle,
  readBody,
  readBool,
  readEnum,
  readId,
  readInt,
  readRequiredText,
  readText,
  requireAdmin,
} from "@/lib/admin-api";
import { MENU_KINDS, type MenuKind, parsePriceInput } from "@/lib/menu/constants";
import { db } from "@/prisma/db";

import type { Numeric } from "@prisma/orm-postgres/target/codec-types";

function readPrice(body: Body) {
  const raw = readRequiredText(body, "price", "Preis", 20);
  const value = parsePriceInput(raw);

  if (!/^\d{1,6}(\.\d{1,2})?$/.test(value)) {
    throw new HttpError(400, "Bitte einen gültigen Preis eingeben, z. B. 16,90.");
  }

  // numeric-Spalten werden zur Laufzeit als Dezimal-String uebergeben,
  // der Typ ist aber markiert - daher die explizite Zusicherung.
  return value as unknown as Numeric<10, 2>;
}

function parseItem(body: Body) {
  return {
    menu: readEnum<MenuKind>(body, "menu", "Karte", MENU_KINDS),
    name: readRequiredText(body, "name", "Name", 120),
    description: readText(body, "description", "Beschreibung", { max: 300 }),
    price: readPrice(body),
    active: readBool(body, "active"),
    sortOrder: readInt(body, "sortOrder", "Sortierung", { min: -9999, max: 9999 }) ?? 0,
  };
}

async function findItem(restaurantId: number, id: number) {
  const item = await db.orm.public.MenuItem.first({ id, restaurantId });

  if (!item) {
    throw new HttpError(404, "Gericht nicht gefunden.");
  }

  return item;
}

export async function GET(request: Request) {
  return handle("Menu GET", async () => {
    const user = await requireAdmin();

    const menu = new URL(request.url).searchParams.get("menu") ?? "SPEISEKARTE";

    if (!MENU_KINDS.includes(menu as MenuKind)) {
      throw new HttpError(400, "Unbekannte Karte.");
    }

    const items = await db.orm.public.MenuItem
      .where({ restaurantId: user.restaurantId, menu: menu as MenuKind })
      .orderBy([(m) => m.sortOrder.asc(), (m) => m.name.asc()])
      .all();

    return NextResponse.json({ items });
  });
}

export async function POST(request: Request) {
  return handle("Menu POST", async () => {
    const user = await requireAdmin();

    const data = parseItem(await readBody(request));
    const item = await db.orm.public.MenuItem.create({
      ...data,
      restaurantId: user.restaurantId,
    });

    return NextResponse.json({ item }, { status: 201 });
  });
}

export async function PATCH(request: Request) {
  return handle("Menu PATCH", async () => {
    const user = await requireAdmin();

    const body = await readBody(request);
    const item = await findItem(user.restaurantId, readId(body));
    const scope = db.orm.public.MenuItem.where({
      id: item.id,
      restaurantId: user.restaurantId,
    });

    if (body.action === "setActive") {
      await scope.update({ active: readBool(body, "active") });
    } else {
      await scope.update(parseItem(body));
    }

    return NextResponse.json({ item: await findItem(user.restaurantId, item.id) });
  });
}

export async function DELETE(request: Request) {
  return handle("Menu DELETE", async () => {
    const user = await requireAdmin();

    const id = readId(await readBody(request));
    await findItem(user.restaurantId, id);
    await db.orm.public.MenuItem.where({ id, restaurantId: user.restaurantId }).delete();

    return NextResponse.json({ success: true });
  });
}
