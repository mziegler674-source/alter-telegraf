import "server-only";

import { NextResponse } from "next/server";

import {
  HttpError,
  handle,
  nowInstant,
  readBody,
  readId,
  readText,
  requireHotelAdmin,
} from "@/lib/hotel/admin-api";
import { getHotel, requireHotel } from "@/lib/hotel/admin-api";
import {
  ALLOWED_IMAGE_LABEL,
  MAX_IMAGES_PER_ROOM_TYPE,
  MAX_IMAGE_BYTES,
  detectImageType,
} from "@/lib/hotel/images";
import { db } from "@/prisma/db";

// Ohne die Spalte `data`: die Dateien sollen nie im JSON landen.
const COLUMNS = [
  "id",
  "roomTypeId",
  "url",
  "alt",
  "sortOrder",
  "isPrimary",
  "fileName",
  "contentType",
  "sizeBytes",
  "uploadedAt",
] as const;

async function loadImages(roomTypeIds: number[]) {
  if (roomTypeIds.length === 0) return [];

  const rows = await db.orm.hotel.RoomTypeImage
    .where((image) => image.roomTypeId.in(roomTypeIds))
    .select(...COLUMNS)
    .orderBy([(image) => image.sortOrder.asc(), (image) => image.id.asc()])
    .all();

  return rows.map((row) => ({
    ...row,
    uploadedAt: row.uploadedAt ? String(row.uploadedAt) : null,
    hasFile: row.sizeBytes !== null,
  }));
}

async function requireOwnImage(hotelId: number, id: number) {
  const image = await db.orm.hotel.RoomTypeImage
    .where({ id })
    .select("id", "roomTypeId", "isPrimary")
    .include("roomType", (type) => type.select("hotelId"))
    .first();

  if (!image || image.roomType.hotelId !== hotelId) {
    throw new HttpError(404, "Bild nicht gefunden.");
  }

  return image;
}

// Genau ein Hauptbild je Kategorie. Fehlt es, wird das erste Bild dazu.
async function normalisePrimary(roomTypeId: number, preferredId?: number) {
  const images = await db.orm.hotel.RoomTypeImage
    .where({ roomTypeId })
    .select("id", "isPrimary")
    .orderBy([(image) => image.sortOrder.asc(), (image) => image.id.asc()])
    .all();

  if (images.length === 0) return;

  const target =
    images.find((image) => image.id === preferredId) ??
    images.find((image) => image.isPrimary) ??
    images[0];

  for (const image of images) {
    const shouldBePrimary = image.id === target.id;

    if (image.isPrimary !== shouldBePrimary) {
      await db.orm.hotel.RoomTypeImage
        .where({ id: image.id })
        .update({ isPrimary: shouldBePrimary });
    }
  }
}

export async function GET() {
  return handle("Room images GET", async () => {
    await requireHotelAdmin();

    const hotel = await getHotel();

    if (!hotel) {
      return NextResponse.json({ hotelReady: false, roomTypes: [], images: [] });
    }

    const roomTypes = await db.orm.hotel.RoomType
      .where({ hotelId: hotel.id })
      .select("id", "code", "name", "active")
      .orderBy([(type) => type.sortOrder.asc(), (type) => type.name.asc()])
      .all();

    return NextResponse.json({
      hotelReady: true,
      roomTypes,
      images: await loadImages(roomTypes.map((type) => type.id)),
    });
  });
}

export async function POST(request: Request) {
  return handle("Room images POST", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    let form: FormData;

    try {
      form = await request.formData();
    } catch {
      throw new HttpError(400, "Die Datei konnte nicht gelesen werden.");
    }

    const roomTypeId = Number(form.get("roomTypeId"));
    const file = form.get("file");
    const alt = String(form.get("alt") ?? "").trim();

    if (!Number.isInteger(roomTypeId) || roomTypeId < 1) {
      throw new HttpError(400, "Bitte eine Zimmerart wählen.");
    }

    if (!(await db.orm.hotel.RoomType.first({ id: roomTypeId, hotelId: hotel.id }))) {
      throw new HttpError(404, "Zimmerart nicht gefunden.");
    }

    if (!(file instanceof File) || file.size === 0) {
      throw new HttpError(400, "Bitte eine Bilddatei auswählen.");
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new HttpError(
        400,
        `Das Bild ist zu groß (maximal ${MAX_IMAGE_BYTES / 1024 / 1024} MB).`
      );
    }

    const existing = await db.orm.hotel.RoomTypeImage
      .where({ roomTypeId })
      .aggregate((a) => ({ count: a.count() }));

    if (Number(existing.count) >= MAX_IMAGES_PER_ROOM_TYPE) {
      throw new HttpError(
        409,
        `Es sind höchstens ${MAX_IMAGES_PER_ROOM_TYPE} Bilder je Zimmerart möglich.`
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = detectImageType(bytes);

    if (!contentType) {
      throw new HttpError(400, `Die Datei ist kein Bild im Format ${ALLOWED_IMAGE_LABEL}.`);
    }

    const last = await db.orm.hotel.RoomTypeImage
      .where({ roomTypeId })
      .select("sortOrder")
      .orderBy((image) => image.sortOrder.desc())
      .first();

    const image = await db.orm.hotel.RoomTypeImage.create({
      roomTypeId,
      url: null,
      alt: alt ? alt.slice(0, 200) : null,
      sortOrder: (last?.sortOrder ?? 0) + 10,
      isPrimary: Number(existing.count) === 0,
      fileName: file.name.slice(0, 200),
      contentType,
      sizeBytes: bytes.byteLength,
      data: bytes,
      uploadedAt: nowInstant(),
    });

    await normalisePrimary(roomTypeId);

    return NextResponse.json({ id: image.id, contentType }, { status: 201 });
  });
}

export async function PATCH(request: Request) {
  return handle("Room images PATCH", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);
    const id = readId(body);
    const image = await requireOwnImage(hotel.id, id);

    if (body.action === "makePrimary") {
      await normalisePrimary(image.roomTypeId, id);

      return NextResponse.json({ success: true });
    }

    // Verschieben tauscht die Reihenfolge mit dem Nachbarbild. Das bleibt auch
    // dann richtig, wenn zwischendurch Bilder geloescht wurden.
    if (body.action === "move") {
      const direction = body.direction === "up" ? "up" : "down";

      const siblings = await db.orm.hotel.RoomTypeImage
        .where({ roomTypeId: image.roomTypeId })
        .select("id", "sortOrder")
        .orderBy([(row) => row.sortOrder.asc(), (row) => row.id.asc()])
        .all();

      const index = siblings.findIndex((row) => row.id === id);
      const target = siblings[direction === "up" ? index - 1 : index + 1];

      if (!target) {
        return NextResponse.json({ success: true, moved: false });
      }

      const own = siblings[index];

      await db.orm.hotel.RoomTypeImage.where({ id: own.id }).update({
        sortOrder: target.sortOrder,
      });
      await db.orm.hotel.RoomTypeImage.where({ id: target.id }).update({
        sortOrder: own.sortOrder,
      });

      return NextResponse.json({ success: true, moved: true });
    }

    const alt = readText(body, "alt", "Bildbeschreibung", { max: 200 });

    await db.orm.hotel.RoomTypeImage.where({ id }).update({ alt });

    return NextResponse.json({ success: true });
  });
}

export async function DELETE(request: Request) {
  return handle("Room images DELETE", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const id = readId(await readBody(request));
    const image = await requireOwnImage(hotel.id, id);

    await db.orm.hotel.RoomTypeImage.where({ id }).delete();

    // War es das Hauptbild, uebernimmt das naechste Bild diese Rolle.
    await normalisePrimary(image.roomTypeId);

    return NextResponse.json({ success: true });
  });
}
