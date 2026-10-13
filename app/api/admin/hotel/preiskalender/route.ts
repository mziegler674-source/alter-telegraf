import "server-only";
import "temporal-polyfill/full/global";

import { NextResponse } from "next/server";
import { Temporal } from "temporal-polyfill";

import {
  type Body,
  HttpError,
  handle,
  readBody,
  readEnum,
  readId,
  readInt,
  requireHotel,
  requireHotelAdmin,
} from "@/lib/hotel/admin-api";
import { inventoryForRange } from "@/lib/hotel/inventory";
import {
  type PriceChangeMode,
  type RatePriceRow,
  indexPrices,
  planPriceChange,
  summarisePlan,
} from "@/lib/hotel/rate-calendar";
import { todayInHotelTimezone } from "@/lib/hotel/time";
import { db } from "@/prisma/db";

import type { Numeric } from "@prisma/orm-postgres/target/codec-types";

const money = (value: string) => value as unknown as Numeric<10, 2>;

// Preiskalender.
//
// Gepflegt werden Zeilen in RatePrice: ohne Datum der Grundpreis, mit Datum
// der Preis genau dieser Nacht. Welcher Preis am Ende gilt, entscheidet
// ausschliesslich lib/hotel/rate-calendar.ts - dieselbe Datei, mit der die
// Buchungsstrecke rechnet. Eine Vorschau kann deshalb nicht von der
// tatsaechlichen Buchung abweichen.
//
// Zwei Dinge sind bewusst getrennt:
//   - PREIS:         hier gepflegt.
//   - VERFUEGBARKEIT: kommt aus Buchungen und Zimmersperren und wird nur
//                     ANGEZEIGT. Ein Preis sperrt oder oeffnet nie ein
//                     Zimmer.

const MAX_TAGE = 62;

const MODES: PriceChangeMode[] = ["SET", "PERCENT", "DELTA", "RESET"];

/** Der Rate Plan, mit dem die Buchungsstrecke rechnet. */
async function getStandardRatePlan(hotelId: number) {
  const byCode = await db.orm.hotel.RatePlan.first({
    hotelId,
    code: "STANDARD_OHNE_FRUEHSTUECK",
  });

  if (byCode) return byCode;

  const roomOnly = await db.orm.hotel.RatePlan
    .where({ hotelId, mealPlan: "ROOM_ONLY" })
    .orderBy((p) => p.sortOrder.asc())
    .first();

  if (roomOnly) return roomOnly;

  throw new HttpError(409, "Es ist kein Rate Plan vorhanden.");
}

/** Alle Preiszeilen des Plans fuer einen Zeitraum, plus Grundpreise. */
async function loadRows(
  ratePlanId: number,
  from: string,
  to: string
): Promise<RatePriceRow[]> {
  const von = Temporal.PlainDate.from(from);
  const bis = Temporal.PlainDate.from(to);

  const [grund, datiert] = await Promise.all([
    db.orm.hotel.RatePrice
      .where({ ratePlanId })
      .where((p) => p.date.isNull())
      .select("roomTypeId", "occupancy", "amount", "date")
      .all(),
    db.orm.hotel.RatePrice
      .where({ ratePlanId })
      .where((p) => p.date.gte(von))
      .where((p) => p.date.lte(bis))
      .select("roomTypeId", "occupancy", "amount", "date")
      .all(),
  ]);

  return [...grund, ...datiert].map((row) => ({
    roomTypeId: row.roomTypeId,
    occupancy: row.occupancy,
    date: row.date === null ? null : String(row.date),
    amount: String(row.amount),
  }));
}

function readDate(body: Body, key: string, label: string) {
  const value = String(body[key] ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${label} muss im Format JJJJ-MM-TT angegeben werden.`);
  }

  return value;
}

function readWeekdays(body: Body) {
  const raw = body.weekdays;

  if (raw === undefined || raw === null) return [];

  if (!Array.isArray(raw)) {
    throw new HttpError(400, "Die Wochentage müssen als Liste angegeben werden.");
  }

  const tage = raw.map((entry) => Number(entry));

  if (tage.some((tag) => !Number.isInteger(tag) || tag < 0 || tag > 6)) {
    throw new HttpError(400, "Ein Wochentag ist ungültig.");
  }

  return [...new Set(tage)];
}

/** Eingabe einer Preisänderung, einmal geprüft für Vorschau und Speichern. */
async function readChange(hotelId: number, body: Body) {
  const mode = readEnum(body, "mode", "Art der Änderung", MODES);
  const from = readDate(body, "from", "Beginn");
  const to = readDate(body, "to", "Ende");

  if (to < from) {
    throw new HttpError(400, "Das Ende des Zeitraums liegt vor dem Beginn.");
  }

  const spanne =
    Temporal.PlainDate.from(from).until(Temporal.PlainDate.from(to)).days + 1;

  if (spanne > 366) {
    throw new HttpError(400, "Bitte höchstens ein Jahr auf einmal bearbeiten.");
  }

  const roomTypeId = readId(body, "roomTypeId");
  const roomType = await db.orm.hotel.RoomType.first({ id: roomTypeId, hotelId });

  if (!roomType) throw new HttpError(400, "Unbekannte Zimmerart.");

  const occupancy = readInt(body, "occupancy", "Belegung", { min: 1, max: 20, required: true });

  const rohWert = body.value;
  const wert =
    mode === "RESET"
      ? 0
      : Number(String(rohWert ?? "").replace(",", "."));

  if (mode !== "RESET" && !Number.isFinite(wert)) {
    throw new HttpError(400, "Bitte einen Wert für die Änderung angeben.");
  }

  if (mode === "SET" && (wert < 0 || wert > 100_000)) {
    throw new HttpError(400, "Der Preis muss zwischen 0 und 100.000 liegen.");
  }

  if (mode === "PERCENT" && (wert < -100 || wert > 500)) {
    throw new HttpError(400, "Der Prozentsatz muss zwischen −100 und 500 liegen.");
  }

  if (mode === "DELTA" && (wert < -100_000 || wert > 100_000)) {
    throw new HttpError(400, "Der Betrag ist unplausibel.");
  }

  const ratePlan = await getStandardRatePlan(hotelId);
  const rows = await loadRows(ratePlan.id, from, to);

  return {
    mode,
    value: wert,
    from,
    to,
    weekdays: readWeekdays(body),
    roomTypeId,
    roomTypeName: roomType.name,
    occupancy: occupancy as number,
    ratePlanId: ratePlan.id,
    rows,
  };
}

export async function GET(request: Request) {
  return handle("Rate calendar GET", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const url = new URL(request.url);
    const heute = todayInHotelTimezone(hotel.timezone);

    const roh = url.searchParams.get("from") ?? heute;
    const from = /^\d{4}-\d{2}-\d{2}$/.test(roh) ? roh : heute;

    const gewuenscht = Number(url.searchParams.get("days"));
    const days =
      Number.isInteger(gewuenscht) && gewuenscht >= 1 ? Math.min(gewuenscht, MAX_TAGE) : 31;

    const letzterTag = String(Temporal.PlainDate.from(from).add({ days: days - 1 }));

    const ratePlan = await getStandardRatePlan(hotel.id);

    const [roomTypes, rows, bestand] = await Promise.all([
      db.orm.hotel.RoomType
        .where({ hotelId: hotel.id })
        .select("id", "code", "name", "maxOccupancy", "standardOccupancy", "active", "sortOrder")
        .orderBy([(r) => r.sortOrder.asc(), (r) => r.name.asc()])
        .all(),
      loadRows(ratePlan.id, from, letzterTag),
      inventoryForRange(hotel.id, from, days),
    ]);

    const dates = Array.from({ length: days }, (_, index) =>
      String(Temporal.PlainDate.from(from).add({ days: index }))
    );

    // Je Zimmerart und Belegung eine Zeile mit den Tagen.
    const zeilen = roomTypes.map((roomType) => {
      const index = indexPrices(rows, roomType.id);

      // Welche Belegungen sind hinterlegt? Grundlage sind die Grundpreise;
      // ohne Grundpreis ist eine Belegung nicht buchbar.
      const belegungen = [
        ...new Set(
          rows
            .filter((row) => row.roomTypeId === roomType.id)
            .map((row) => row.occupancy)
        ),
      ].sort((a, b) => a - b);

      const inventar = bestand.rows.find((eintrag) => eintrag.roomTypeId === roomType.id);

      return {
        roomTypeId: roomType.id,
        name: roomType.name,
        code: roomType.code,
        active: roomType.active,
        maxOccupancy: roomType.maxOccupancy,
        standardOccupancy: roomType.standardOccupancy,
        occupancies: belegungen.map((occupancy) => ({
          occupancy,
          basePrice: index.base(occupancy),
          days: dates.map((date) => {
            const tagespreis = index.dated(occupancy, date);
            const grund = index.base(occupancy);

            return {
              date,
              // Tatsächlich gültiger Übernachtungspreis dieses Tages.
              price: tagespreis ?? grund,
              source: tagespreis !== null ? "DATE" : grund !== null ? "BASE" : null,
            };
          }),
        })),
        // Nur zur Anzeige: Ein Preis sperrt nichts.
        availability: dates.map((date) => {
          const tag = inventar?.days.find((eintrag) => eintrag.date === date);

          return {
            date,
            free: tag?.free ?? 0,
            totalRooms: inventar?.totalRooms ?? 0,
            blocked: tag?.blocked ?? 0,
            soldOut: (tag?.free ?? 0) === 0,
          };
        }),
      };
    });

    return NextResponse.json({
      range: { from, to: letzterTag, days, dates },
      today: heute,
      ratePlan: { id: ratePlan.id, code: ratePlan.code, name: ratePlan.name },
      rows: zeilen,
    });
  });
}

export async function POST(request: Request) {
  return handle("Rate calendar POST", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);
    const action = String(body.action ?? "");

    if (action !== "preview" && action !== "apply") {
      throw new HttpError(400, "Unbekannte Aktion.");
    }

    const input = await readChange(hotel.id, body);

    const plan = planPriceChange({
      mode: input.mode,
      value: input.value,
      from: input.from,
      to: input.to,
      weekdays: input.weekdays,
      occupancy: input.occupancy,
      roomTypeId: input.roomTypeId,
      rows: input.rows,
    });

    const zusammenfassung = summarisePlan(plan);

    if (action === "preview") {
      return NextResponse.json({
        plan,
        summary: zusammenfassung,
        roomTypeName: input.roomTypeName,
        occupancy: input.occupancy,
      });
    }

    // --- Speichern ---------------------------------------------------------
    //
    // Es werden ausschliesslich Tage aus dem Plan geschrieben. Der Plan
    // enthaelt nur Tage innerhalb von [from, to] und nur die gewaehlten
    // Wochentage - ausserhalb kann sich damit nichts aendern.
    const anzuwenden = plan.filter((zeile) => zeile.changes && !zeile.problem);

    if (anzuwenden.length === 0) {
      return NextResponse.json({
        success: true,
        applied: 0,
        summary: zusammenfassung,
        note: "Es gab nichts zu ändern.",
      });
    }

    await db.transaction(async (tx) => {
      // Zeilensperre auf der Hotelzeile: Zwei gleichzeitige Preisänderungen
      // können sich nicht überholen.
      await tx.orm.hotel.Hotel.where({ id: hotel.id }).update({ updatedAt: Temporal.Now.instant() });

      for (const zeile of anzuwenden) {
        const datum = Temporal.PlainDate.from(zeile.date);

        const vorhanden = await tx.orm.hotel.RatePrice
          .where({
            ratePlanId: input.ratePlanId,
            roomTypeId: input.roomTypeId,
            occupancy: input.occupancy,
          })
          .where((p) => p.date.eq(datum))
          .select("id")
          .first();

        if (zeile.after === null) {
          // Grundpreis wiederherstellen: Die Tageszeile entfällt.
          if (vorhanden) {
            await tx.orm.hotel.RatePrice.where({ id: vorhanden.id }).delete();
          }

          continue;
        }

        if (vorhanden) {
          await tx.orm.hotel.RatePrice.where({ id: vorhanden.id }).update({
            amount: money(zeile.after),
          });
        } else {
          await tx.orm.hotel.RatePrice.create({
            ratePlanId: input.ratePlanId,
            roomTypeId: input.roomTypeId,
            occupancy: input.occupancy,
            date: datum,
            amount: money(zeile.after),
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      applied: anzuwenden.length,
      summary: zusammenfassung,
      note: null,
    });
  });
}
