import "server-only";

import { db } from "@/prisma/db";

// Liefert ein Zimmerfoto aus der Datenbank aus. Oeffentlich erreichbar, die
// Bilder sind Teil der Zimmerdarstellung. Keine Zimmernummer im Pfad.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const imageId = Number(id);

  if (!Number.isInteger(imageId) || imageId < 1) {
    return new Response("Nicht gefunden", { status: 404 });
  }

  const image = await db.orm.hotel.RoomTypeImage
    .where({ id: imageId })
    .select("data", "contentType", "uploadedAt")
    .first();

  if (!image?.data) {
    return new Response("Nicht gefunden", { status: 404 });
  }

  // Die Adresse traegt beim Einbinden den Upload-Zeitstempel, deshalb darf die
  // Antwort selbst lange gecacht werden.
  return new Response(new Uint8Array(image.data) as unknown as BodyInit, {
    headers: {
      "Content-Type": image.contentType ?? "application/octet-stream",
      "Content-Length": String(image.data.byteLength),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
