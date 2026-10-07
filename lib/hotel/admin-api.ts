import "server-only";

import { HttpError } from "@/lib/admin-api";
import { db } from "@/prisma/db";

// Generische Admin-Helfer liegen in lib/admin-api.ts und werden hier
// weitergereicht, damit die bestehenden Hotel-Importe unveraendert bleiben.
export * from "@/lib/admin-api";

// Das System verwaltet aktuell genau ein Haus.
export function getHotel() {
  return db.orm.hotel.Hotel.orderBy((h) => h.id.asc()).first();
}

export type HotelRow = NonNullable<Awaited<ReturnType<typeof getHotel>>>;

export async function requireHotel() {
  const hotel = await getHotel();

  if (!hotel) {
    throw new HttpError(
      409,
      "Bitte zuerst die Hotel-Stammdaten unter „Hotel“ speichern."
    );
  }

  return hotel;
}
