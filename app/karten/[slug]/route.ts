import "server-only";

import { MENU_CARDS } from "@/lib/menu/cards";
import { db } from "@/prisma/db";

const SLUGS = MENU_CARDS.map((card) => card.slug) as readonly string[];

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  if (!SLUGS.includes(slug)) {
    return new Response("Karte nicht gefunden.", { status: 404 });
  }

  const restaurant = await db.orm.public.Restaurant.first({ slug: "alter-telegraf" });

  if (!restaurant) {
    return new Response("Karte nicht gefunden.", { status: 404 });
  }

  const card = await db.orm.public.MenuCard.first({
    restaurantId: restaurant.id,
    slug,
  });

  if (!card?.data) {
    return new Response("Diese Karte ist derzeit nicht verfügbar.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const bytes = new Uint8Array(card.data);

  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      // inline: der Browser zeigt die PDF an, statt sie herunterzuladen.
      "Content-Disposition": `inline; filename="${card.slug}.pdf"`,
      "Content-Length": String(bytes.byteLength),
      // Nach einem Austausch muss sofort die neue Datei ausgeliefert werden.
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
