import "server-only";

import { NextResponse } from "next/server";

import {
  type Body,
  HttpError,
  getHotel,
  handle,
  nowInstant,
  readBody,
  readRequiredText,
  readSlug,
  readText,
  readTime,
  requireAdmin,
} from "@/lib/hotel/admin-api";
import { db } from "@/prisma/db";

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("de-AT", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function parseHotel(body: Body) {
  const countryCode = readRequiredText(body, "countryCode", "Land", 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw new HttpError(400, "Land muss ein zweistelliger ISO-Code sein (z. B. AT).");
  }

  const currency = readRequiredText(body, "currency", "Währung", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new HttpError(400, "Währung muss ein dreistelliger ISO-Code sein (z. B. EUR).");
  }

  const timezone = readRequiredText(body, "timezone", "Zeitzone", 60);
  if (!isValidTimeZone(timezone)) {
    throw new HttpError(400, "Zeitzone ist ungültig (z. B. Europe/Vienna).");
  }

  const email = readText(body, "email", "E-Mail", { max: 160 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new HttpError(400, "E-Mail ist ungültig.");
  }

  return {
    name: readRequiredText(body, "name", "Name", 120),
    slug: readSlug(body, "slug", "Slug"),
    legalName: readText(body, "legalName", "Rechtlicher Name", { max: 160 }),
    vatId: readText(body, "vatId", "UID/VAT-ID", { max: 30 }),
    street: readRequiredText(body, "street", "Adresse", 160),
    postalCode: readRequiredText(body, "postalCode", "PLZ", 12),
    city: readRequiredText(body, "city", "Ort", 80),
    countryCode,
    phone: readText(body, "phone", "Telefon", { max: 40 }),
    fax: readText(body, "fax", "Fax", { max: 40 }),
    email,
    timezone,
    currency,
    checkInFrom: readTime(body, "checkInFrom", "Check-in ab"),
    checkOutUntil: readTime(body, "checkOutUntil", "Check-out bis"),
    receptionFrom: readTime(body, "receptionFrom", "Rezeption von"),
    receptionUntil: readTime(body, "receptionUntil", "Rezeption bis"),
  };
}

export async function GET() {
  return handle("Hotel settings GET", async () => {
    await requireAdmin();

    return NextResponse.json({ hotel: await getHotel() });
  });
}

export async function PUT(request: Request) {
  return handle("Hotel settings PUT", async () => {
    await requireAdmin();

    const data = parseHotel(await readBody(request));
    const existing = await getHotel();

    if (existing) {
      await db.orm.hotel.Hotel.where({ id: existing.id }).update({
        ...data,
        updatedAt: nowInstant(),
      });
    } else {
      await db.orm.hotel.Hotel.create(data);
    }

    return NextResponse.json({
      hotel: await getHotel(),
      created: !existing,
    });
  });
}
