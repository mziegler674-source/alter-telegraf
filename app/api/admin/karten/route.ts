import "server-only";

import { NextResponse } from "next/server";

import { HttpError, handle, nowInstant, requireAdmin } from "@/lib/admin-api";
import { MAX_PDF_BYTES, MENU_CARDS, type MenuCardSlug } from "@/lib/menu/cards";
import { db } from "@/prisma/db";

const SLUGS = MENU_CARDS.map((card) => card.slug) as readonly string[];

// Die sieben Karten sind fix. Fehlende Zeilen werden angelegt, damit der
// Betreiber ohne Einrichtungsschritt direkt hochladen kann.
async function ensureCards(restaurantId: number) {
  const existing = await db.orm.public.MenuCard
    .where({ restaurantId })
    .select("slug")
    .all();

  const known = new Set(existing.map((card) => card.slug));

  for (const [index, card] of MENU_CARDS.entries()) {
    if (known.has(card.slug)) continue;

    await db.orm.public.MenuCard.create({
      restaurantId,
      slug: card.slug,
      title: card.title,
      sortOrder: (index + 1) * 10,
    });
  }
}

export async function GET() {
  return handle("Menu cards GET", async () => {
    const user = await requireAdmin();

    await ensureCards(user.restaurantId);

    // Ohne die Spalte `data`: die Dateien sollen nicht im JSON landen.
    const cards = await db.orm.public.MenuCard
      .where({ restaurantId: user.restaurantId })
      .select("id", "slug", "title", "sortOrder", "fileName", "sizeBytes", "uploadedAt")
      .orderBy((c) => c.sortOrder.asc())
      .all();

    return NextResponse.json({ cards });
  });
}

export async function POST(request: Request) {
  return handle("Menu cards POST", async () => {
    const user = await requireAdmin();

    let form: FormData;

    try {
      form = await request.formData();
    } catch {
      throw new HttpError(400, "Die Datei konnte nicht gelesen werden.");
    }

    const slug = String(form.get("slug") ?? "");
    const file = form.get("file");

    if (!SLUGS.includes(slug)) {
      throw new HttpError(400, "Unbekannte Karte.");
    }

    if (!(file instanceof File) || file.size === 0) {
      throw new HttpError(400, "Bitte eine PDF-Datei auswählen.");
    }

    if (file.size > MAX_PDF_BYTES) {
      throw new HttpError(
        400,
        `Die Datei ist zu groß (maximal ${MAX_PDF_BYTES / 1024 / 1024} MB).`
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // Inhalt prüfen, nicht nur den gemeldeten Typ: jede PDF beginnt mit %PDF-.
    const header = new TextDecoder().decode(bytes.subarray(0, 5));

    if (header !== "%PDF-") {
      throw new HttpError(400, "Die Datei ist keine PDF.");
    }

    await ensureCards(user.restaurantId);

    const card = await db.orm.public.MenuCard.first({
      restaurantId: user.restaurantId,
      slug: slug as MenuCardSlug,
    });

    if (!card) {
      throw new HttpError(404, "Karte nicht gefunden.");
    }

    await db.orm.public.MenuCard.where({ id: card.id }).update({
      fileName: file.name.slice(0, 200),
      sizeBytes: bytes.byteLength,
      data: bytes,
      uploadedAt: nowInstant(),
    });

    return NextResponse.json({
      slug,
      fileName: file.name,
      sizeBytes: bytes.byteLength,
    });
  });
}

export async function DELETE(request: Request) {
  return handle("Menu cards DELETE", async () => {
    const user = await requireAdmin();

    const slug = new URL(request.url).searchParams.get("slug") ?? "";

    if (!SLUGS.includes(slug)) {
      throw new HttpError(400, "Unbekannte Karte.");
    }

    const card = await db.orm.public.MenuCard.first({
      restaurantId: user.restaurantId,
      slug: slug as MenuCardSlug,
    });

    if (!card) {
      throw new HttpError(404, "Karte nicht gefunden.");
    }

    // Nur die Datei entfernen, die Karte selbst bleibt bestehen.
    await db.orm.public.MenuCard.where({ id: card.id }).update({
      fileName: null,
      sizeBytes: null,
      data: null,
      uploadedAt: null,
    });

    return NextResponse.json({ success: true });
  });
}
