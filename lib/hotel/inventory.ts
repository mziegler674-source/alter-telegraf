import "server-only";
import "temporal-polyfill/full/global";

import { Temporal } from "temporal-polyfill";

import { type AllocRoom, roomUsable } from "@/lib/hotel/allocation";
import { loadBlocks, loadDemands } from "@/lib/hotel/booking-service";
import { db } from "@/prisma/db";

// Die gemeinsame Verfuegbarkeitsquelle des Hauses.
//
// Diese Datei beantwortet eine einzige Frage: Wie viele Zimmer einer
// Kategorie sind an einem Tag frei? Antwort geben duerfen nur die echten
// Daten - physische Zimmer, Buchungen aus BookingRoom und Sperren aus
// RoomBlock.
//
// Verwendet wird sie vom Belegungskalender UND von der Kanalsynchronisierung.
// Damit gibt es keine zweite, abweichende Rechnung: Was der Betrieb im
// Kalender sieht, ist genau das, was ein Vertriebskanal gemeldet bekommt.
//
// Wichtig: Es gibt 17 physische Zimmer. Direktbuchungen und externe
// Buchungen zehren vom SELBEN Bestand; Inventar wird nie addiert.

export type InventoryDay = {
  date: string;
  /** Belegungen mit konkret zugewiesenem Zimmer. */
  assigned: number;
  /** Belegungen der Kategorie ohne Zimmerzuweisung. */
  unassigned: number;
  /** Zimmer dieser Kategorie, die an diesem Tag gesperrt sind. */
  blocked: number;
  /** Freie Zimmer der Kategorie. Nie kleiner als 0. */
  free: number;
  arrivals: number;
  departures: number;
};

export type InventoryRow = {
  roomTypeId: number;
  /** Bespielbare Zimmer der Kategorie: aktiv und nicht ausser Betrieb. */
  totalRooms: number;
  days: InventoryDay[];
};

export type InventorySnapshot = {
  from: string;
  /** Exklusiv, wie ein Abreisetag. */
  to: string;
  dates: string[];
  rows: InventoryRow[];
};

export function listDates(from: string, days: number) {
  const start = Temporal.PlainDate.from(from);

  return Array.from({ length: days }, (_, index) => String(start.add({ days: index })));
}

/**
 * Verfuegbarkeit je Kategorie und Tag.
 *
 * Der Abreisetag einer Buchung zaehlt NICHT als belegte Nacht - das Zimmer
 * ist an diesem Tag wieder vergebbar. Stornierte und nicht erschienene
 * Buchungen belegen nichts; darum kuemmert sich loadDemands.
 */
export async function inventoryForRange(
  hotelId: number,
  from: string,
  days: number
): Promise<InventorySnapshot> {
  const dates = listDates(from, days);
  const to = String(Temporal.PlainDate.from(from).add({ days }));

  const [rooms, roomTypes, demands, blocks] = await Promise.all([
    db.orm.hotel.Room
      .where({ hotelId })
      .select("id", "number", "roomTypeId", "bedType", "maxOccupancy", "active", "status")
      .all(),
    db.orm.hotel.RoomType
      .where({ hotelId })
      .select("id", "code", "name", "active", "sortOrder")
      .orderBy([(r) => r.sortOrder.asc(), (r) => r.name.asc()])
      .all(),
    loadDemands(from, to),
    loadBlocks(from, to),
  ]);

  const allocRooms: AllocRoom[] = rooms;

  const rows = roomTypes.map((roomType) => {
    const bestand = allocRooms.filter(
      (room) => room.roomTypeId === roomType.id && roomUsable(room)
    );

    const eigene = demands.filter((demand) => demand.roomTypeId === roomType.id);
    const eigeneIds = new Set(bestand.map((room) => room.id));

    return {
      roomTypeId: roomType.id,
      totalRooms: bestand.length,
      days: dates.map((tag) => {
        const amTag = eigene.filter(
          (demand) => demand.checkIn <= tag && demand.checkOut > tag
        );

        const blocked = blocks.filter(
          (block) => block.startDate <= tag && block.endDate > tag && eigeneIds.has(block.roomId)
        ).length;

        const assigned = amTag.filter((demand) => demand.roomId !== null).length;

        return {
          date: tag,
          assigned,
          unassigned: amTag.length - assigned,
          blocked,
          free: Math.max(0, bestand.length - amTag.length - blocked),
          arrivals: eigene.filter((demand) => demand.checkIn === tag).length,
          departures: eigene.filter((demand) => demand.checkOut === tag).length,
        };
      }),
    };
  });

  return { from, to, dates, rows };
}

/**
 * Hat eine Kategorie im gesamten Zeitraum noch Platz fuer eine weitere
 * Buchung? Grundlage ist dieselbe Rechnung wie oben.
 *
 * Diese Pruefung arbeitet auf Kategorieebene und ist damit bewusst
 * gröber als availableForRequest in allocation.ts, das zusaetzlich
 * Bettenlage und Personenzahl beruecksichtigt. Fuer eine externe Buchung,
 * die der Kanal bereits verkauft hat, ist genau das die richtige Frage:
 * Reicht der Bestand der Kategorie?
 */
export async function categoryHasRoom(
  hotelId: number,
  roomTypeId: number,
  checkIn: string,
  checkOut: string
): Promise<{ fits: boolean; tightestDate: string | null; free: number }> {
  const naechte = Temporal.PlainDate.from(checkIn).until(Temporal.PlainDate.from(checkOut)).days;

  if (naechte < 1) return { fits: false, tightestDate: checkIn, free: 0 };

  const snapshot = await inventoryForRange(hotelId, checkIn, naechte);
  const row = snapshot.rows.find((eintrag) => eintrag.roomTypeId === roomTypeId);

  if (!row) return { fits: false, tightestDate: checkIn, free: 0 };

  let engster: InventoryDay | null = null;

  for (const tag of row.days) {
    if (!engster || tag.free < engster.free) engster = tag;
  }

  return {
    fits: (engster?.free ?? 0) >= 1,
    tightestDate: engster?.date ?? null,
    free: engster?.free ?? 0,
  };
}
