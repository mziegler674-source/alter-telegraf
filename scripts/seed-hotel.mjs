// Legt die Grunddaten des Hotels an. Mehrfaches Ausfuehren ist unschaedlich:
// Jeder Datensatz wird ueber seinen fachlichen Schluessel gesucht und nur
// angelegt, wenn er fehlt. Vorhandene Datensaetze werden aktualisiert.
//
// Aufruf:  node scripts/seed-hotel.mjs
//          node scripts/seed-hotel.mjs --dry-run

import "dotenv/config";
import "temporal-polyfill/full/global";

import postgres from "@prisma/orm-postgres/runtime";
import contractJson from "../prisma/contract.json" with { type: "json" };

const dryRun = process.argv.includes("--dry-run");

const db = postgres({ contractJson, url: process.env.DATABASE_URL });

// Drei oeffentlich buchbare Kategorien.
const ROOM_TYPES = [
  {
    code: "EZ",
    name: "Einzelzimmer",
    slug: "einzelzimmer",
    standardOccupancy: 1,
    maxOccupancy: 1,
    maxAdults: 1,
    sortOrder: 10,
    active: true,
  },
  {
    code: "DZ",
    name: "Doppelzimmer",
    slug: "doppelzimmer",
    standardOccupancy: 2,
    maxOccupancy: 2,
    maxAdults: 2,
    sortOrder: 20,
    active: true,
  },
  {
    code: "DZS",
    name: "Doppelzimmer mit Schlafsofa",
    slug: "doppelzimmer-mit-schlafsofa",
    standardOccupancy: 2,
    maxOccupancy: 4,
    maxAdults: 4,
    sortOrder: 30,
    active: true,
  },
];

// Die 17 physischen Zimmer. bedType und maxOccupancy sind die reale
// Bettenlage bzw. Belegungsgrenze des Zimmers. Beides ist fix hinterlegt
// und wird im Admin nur angezeigt.
//
// Verteilung nach der Korrektur des Betreibers vom 03.10.2026:
//   Einzelzimmer  11 12 14 17 18 19 20          = 7
//   Doppelzimmer  15 16 23 25 27 28             = 6
//   mit Schlafsofa 21 22 24 (je 4) und 26 (3)   = 4
const ROOMS = [
  {
    number: "11",
    type: "EZ",
    bedType: "EINZELBETT",
    maxOccupancy: 1,
    bedConfiguration: "1 Einzelbett",
  },
  {
    number: "12",
    type: "EZ",
    bedType: "EINZELBETT",
    maxOccupancy: 1,
    bedConfiguration: "1 Einzelbett",
  },
  {
    number: "14",
    type: "EZ",
    bedType: "EINZELBETT",
    maxOccupancy: 1,
    bedConfiguration: "1 Einzelbett",
  },
  {
    number: "15",
    type: "DZ",
    bedType: "DOPPELBETT",
    maxOccupancy: 2,
    bedConfiguration: "1 Doppelbett",
  },
  {
    number: "16",
    type: "DZ",
    bedType: "DOPPELBETT",
    maxOccupancy: 2,
    bedConfiguration: "1 Doppelbett",
  },
  {
    number: "17",
    type: "EZ",
    bedType: "EINZELBETT",
    maxOccupancy: 1,
    bedConfiguration: "1 Einzelbett",
    notes: null,
  },
  {
    number: "18",
    type: "EZ",
    bedType: "EINZELBETT",
    maxOccupancy: 1,
    bedConfiguration: "1 Einzelbett",
    notes: null,
  },
  {
    number: "19",
    type: "EZ",
    bedType: "EINZELBETT",
    maxOccupancy: 1,
    bedConfiguration: "1 Einzelbett",
  },
  {
    number: "20",
    type: "EZ",
    bedType: "EINZELBETT",
    maxOccupancy: 1,
    bedConfiguration: "1 Einzelbett",
  },
  {
    number: "21",
    type: "DZS",
    bedType: "DOPPELBETT_PLUS_ZWEI",
    maxOccupancy: 4,
    bedConfiguration: "1 Doppelbett + 2 weitere Betten",
  },
  {
    number: "22",
    type: "DZS",
    bedType: "DOPPELBETT_PLUS_ZWEI",
    maxOccupancy: 4,
    bedConfiguration: "1 Doppelbett + 2 weitere Betten",
  },
  {
    number: "23",
    type: "DZ",
    bedType: "DOPPELBETT",
    maxOccupancy: 2,
    bedConfiguration: "1 Doppelbett",
  },
  {
    number: "24",
    type: "DZS",
    bedType: "DOPPELBETT_PLUS_ZWEI",
    maxOccupancy: 4,
    bedConfiguration: "1 Doppelbett + 2 weitere Betten",
  },
  {
    number: "25",
    type: "DZ",
    bedType: "DOPPELBETT",
    maxOccupancy: 2,
    bedConfiguration: "1 Doppelbett",
  },
  {
    number: "26",
    type: "DZS",
    bedType: "DREI_BETTEN",
    maxOccupancy: 3,
    bedConfiguration: "3 Betten",
    notes: "Belegung bis 3 Personen.",
  },
  {
    number: "27",
    type: "DZ",
    bedType: "ZWEI_EINZELBETTEN",
    maxOccupancy: 2,
    bedConfiguration: "2 Betten",
  },
  {
    number: "28",
    type: "DZ",
    bedType: "ZWEI_EINZELBETTEN",
    maxOccupancy: 2,
    bedConfiguration: "2 Betten",
  },
];

// Fruehstueck laeuft ueber den Rate Plan, nicht ueber die Zimmerkategorie.
const RATE_PLANS = [
  {
    code: "STANDARD_OHNE_FRUEHSTUECK",
    name: "Standard ohne Fruehstueck",
    description: "Uebernachtung ohne Verpflegung.",
    mealPlan: "ROOM_ONLY",
    sortOrder: 10,
  },
  {
    code: "STANDARD_MIT_FRUEHSTUECK",
    name: "Standard mit Fruehstueck",
    description: "Uebernachtung inklusive Fruehstueck.",
    mealPlan: "BREAKFAST",
    sortOrder: 20,
  },
];

// Vom Betreiber am 03.10.2026 final bestaetigte Preise pro Nacht.
// Das Doppelzimmer mit Schlafsofa hat je Belegung einen eigenen Preis.
const BASE_PRICES = [
  { type: "EZ", occupancy: 1, amount: "92.00" },
  { type: "DZ", occupancy: 2, amount: "139.00" },
  { type: "DZS", occupancy: 3, amount: "159.00" },
  { type: "DZS", occupancy: 4, amount: "189.00" },
];

const BREAKFAST_PRICE = "15.00";

// Stornierungsbedingungen des Hauses, vom Betreiber am 04.10.2026 vorgegeben:
// kostenlos bis 3 Tage vor Anreise, danach 100 %, Nichtanreise 100 %.
// Die Werte sind Startwerte - gepflegt wird anschliessend im Admin unter
// Hotel / Stornobedingungen.
const CANCELLATION_POLICY = {
  code: "STANDARD",
  name: "Standard-Stornierungsbedingungen",
  description: "Kostenlose Stornierung bis 3 Tage vor Anreise.",
  noShowFeePercent: "100.00",
  active: true,
  // Eine Regel greift, wenn weniger als so viele Tage bis zur Anreise
  // verbleiben.
  rules: [
    { appliesFromDaysBefore: 3, basis: "PERCENT_OF_TOTAL", feePercent: "100.00" },
  ],
};

// Ausstattung genau in dem Umfang, den der Betrieb auf altertelegraf.at/zimmer
// fuer alle Zimmer angibt: "Wlan, SAT / TV, Klima, Bad / Wc, Foehn". Der
// Zimmersafe ist dort nur fuer einen Teil der Zimmer erwaehnt und wird deshalb
// angelegt, aber keiner Kategorie zugeordnet. Nichts davon ist erfunden.
const AMENITIES = [
  { code: "WLAN", name: "WLAN", icon: "wlan", sortOrder: 10, allRooms: true },
  { code: "SAT_TV", name: "SAT-TV", icon: "tv", sortOrder: 20, allRooms: true },
  { code: "KLIMA", name: "Klimaanlage", icon: "klima", sortOrder: 30, allRooms: true },
  { code: "BAD_WC", name: "Bad/WC", icon: "bad", sortOrder: 40, allRooms: true },
  { code: "FOEHN", name: "Föhn", icon: "foehn", sortOrder: 50, allRooms: true },
  { code: "SAFE", name: "Zimmersafe", icon: "safe", sortOrder: 60, allRooms: false },
];

// Eigene Rabattstaffel des Hauses, keine Vorgabe eines Buchungsportals.
const LONG_STAY_TIERS = [
  { minNights: 3, percent: "10.00" },
  { minNights: 5, percent: "15.00" },
  { minNights: 7, percent: "20.00" },
];

const stats = { erstellt: 0, aktualisiert: 0, unveraendert: 0 };

function note(action, label) {
  stats[action]++;
  console.log(`  ${action.padEnd(14)} ${label}`);
}

async function upsert(model, find, data, label) {
  const existing = await model.first(find);

  if (!existing) {
    if (!dryRun) await model.create({ ...find, ...data });
    note("erstellt", label);
    return dryRun ? { id: -1, ...find, ...data } : await model.first(find);
  }

  const changed = Object.entries(data).filter(
    ([key, value]) => existing[key] !== value
  );

  if (changed.length === 0) {
    note("unveraendert", label);
    return existing;
  }

  if (!dryRun) await model.where({ id: existing.id }).update(data);
  note("aktualisiert", `${label} (${changed.map(([k]) => k).join(", ")})`);
  return existing;
}

async function main() {
  if (dryRun) console.log("PROBELAUF - es wird nichts geschrieben.\n");

  const hotel = await db.orm.hotel.Hotel.orderBy((h) => h.id.asc()).first();

  if (!hotel) {
    throw new Error(
      "Kein Hotel vorhanden. Bitte zuerst die Stammdaten unter /admin/hotel/einstellungen speichern."
    );
  }

  console.log(`Hotel: ${hotel.name} (id ${hotel.id})\n`);

  console.log("Zimmerarten:");
  const roomTypeIds = new Map();

  for (const { code, ...data } of ROOM_TYPES) {
    const row = await upsert(
      db.orm.hotel.RoomType,
      { hotelId: hotel.id, code },
      { breakfastIncluded: false, pricingMode: "PER_ROOM", ...data },
      `${code} – ${data.name}`
    );
    roomTypeIds.set(code, row?.id);
  }

  console.log("\nZimmer:");
  for (const { number, type, ...data } of ROOMS) {
    const roomTypeId = roomTypeIds.get(type);

    if (!roomTypeId) throw new Error(`Zimmerart ${type} fehlt.`);

    await upsert(
      db.orm.hotel.Room,
      { hotelId: hotel.id, number },
      { roomTypeId, ...data },
      `Zimmer ${number} (${type})`
    );
  }

  console.log("\nRate Plans:");
  for (const { code, ...data } of RATE_PLANS) {
    await upsert(
      db.orm.hotel.RatePlan,
      { hotelId: hotel.id, code },
      { active: true, cardGuaranteeRequired: false, ...data },
      `${code}`
    );
  }

  const standardPlan = await db.orm.hotel.RatePlan.first({
    hotelId: hotel.id,
    code: "STANDARD_OHNE_FRUEHSTUECK",
  });

  if (!standardPlan) throw new Error("Rate Plan STANDARD_OHNE_FRUEHSTUECK fehlt.");

  console.log("\nZimmerpreise (Grundpreis, ohne Datum):");

  for (const entry of BASE_PRICES) {
    const roomTypeId = roomTypeIds.get(entry.type);

    if (!roomTypeId) throw new Error(`Zimmerart ${entry.type} fehlt.`);

    const existing = await db.orm.hotel.RatePrice
      .where({ ratePlanId: standardPlan.id, roomTypeId, occupancy: entry.occupancy })
      .where((price) => price.date.isNull())
      .first();

    const label = `${entry.type} / ${entry.occupancy} Pers. = ${entry.amount}`;

    if (!existing) {
      if (!dryRun) {
        await db.orm.hotel.RatePrice.create({
          ratePlanId: standardPlan.id,
          roomTypeId,
          occupancy: entry.occupancy,
          amount: entry.amount,
        });
      }
      note("erstellt", label);
    } else if (String(existing.amount) !== entry.amount) {
      if (!dryRun) {
        await db.orm.hotel.RatePrice.where({ id: existing.id }).update({ amount: entry.amount });
      }
      note("aktualisiert", `${label} (vorher ${existing.amount})`);
    } else {
      note("unveraendert", label);
    }
  }

  console.log("\nFruehstueck:");
  await upsert(
    db.orm.hotel.ServiceItem,
    { hotelId: hotel.id, code: "BREAKFAST" },
    {
      name: "Frühstück",
      description: "Pro Person und Nacht.",
      price: BREAKFAST_PRICE,
      unit: "PER_PERSON_NIGHT",
      active: true,
      sortOrder: 10,
    },
    `${BREAKFAST_PRICE} pro Person/Nacht`
  );

  console.log("\nAusstattung:");
  const amenityIds = new Map();

  for (const { code, allRooms, ...data } of AMENITIES) {
    const row = await upsert(
      db.orm.hotel.Amenity,
      { hotelId: hotel.id, code },
      data,
      `${code} – ${data.name}`
    );

    if (allRooms) amenityIds.set(code, row?.id);
  }

  // Alle drei oeffentlichen Kategorien tragen dieselbe Standardausstattung.
  console.log("\nZuordnung je Zimmerkategorie:");

  for (const [code, roomTypeId] of roomTypeIds) {
    for (const [amenityCode, amenityId] of amenityIds) {
      if (!amenityId || amenityId < 0) continue;

      const existing = await db.orm.hotel.RoomTypeAmenity.first({ roomTypeId, amenityId });
      const label = `${code} + ${amenityCode}`;

      if (existing) {
        note("unveraendert", label);
        continue;
      }

      if (!dryRun) await db.orm.hotel.RoomTypeAmenity.create({ roomTypeId, amenityId });
      note("erstellt", label);
    }
  }

  console.log("\nStornierungsbedingungen:");
  {
    const { code, rules, ...data } = CANCELLATION_POLICY;

    const policy = await upsert(
      db.orm.hotel.CancellationPolicy,
      { hotelId: hotel.id, code },
      data,
      `${code} – ${data.name}`
    );

    for (const rule of rules) {
      const { appliesFromDaysBefore, ...werte } = rule;

      await upsert(
        db.orm.hotel.CancellationRule,
        { policyId: policy.id, appliesFromDaysBefore },
        { feeAmount: null, ...werte },
        `ab weniger als ${appliesFromDaysBefore} Tagen = ${werte.feePercent} %`
      );
    }

    // Beide Rate Plans verwenden dieselbe Richtlinie.
    for (const planCode of RATE_PLANS.map((p) => p.code)) {
      const plan = await db.orm.hotel.RatePlan.first({ hotelId: hotel.id, code: planCode });

      if (!plan) continue;

      if (plan.cancellationPolicyId === policy.id) {
        note("unveraendert", `${planCode} → ${code}`);
        continue;
      }

      if (!dryRun) {
        await db.orm.hotel.RatePlan.where({ id: plan.id }).update({
          cancellationPolicyId: policy.id,
        });
      }

      note("aktualisiert", `${planCode} → ${code}`);
    }
  }

  console.log("\nLangzeitrabatte:");

  for (const tier of LONG_STAY_TIERS) {
    await upsert(
      db.orm.hotel.Promotion,
      { hotelId: hotel.id, code: `LONGSTAY_${tier.minNights}` },
      {
        name: `Langzeitrabatt ab ${tier.minNights} Nächten`,
        description: "Automatischer Rabatt ab einer Mindestanzahl an Nächten.",
        type: "BASIC",
        channel: "PUBLIC",
        discountPercent: tier.percent,
        minStayNights: tier.minNights,
        active: true,
      },
      `ab ${tier.minNights} Nächten = ${tier.percent} %`
    );
  }

  console.log(
    `\nErgebnis: ${stats.erstellt} erstellt, ${stats.aktualisiert} aktualisiert, ${stats.unveraendert} unveraendert.`
  );
}

try {
  await main();
} finally {
  await db.close?.();
}
