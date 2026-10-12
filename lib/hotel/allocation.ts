import type { BedType } from "./availability";

// Belegung auf Ebene der PHYSISCHEN Zimmer.
//
// Warum es diese Datei gibt: Zuvor wurde je Kategorie gezaehlt - Zimmer der
// Kategorie minus Buchungen der Kategorie. Das ist falsch, sobald die Zimmer
// einer Kategorie unterschiedlich viele Personen tragen. Beispiel aus dem
// Haus: Ein Doppelzimmer mit nur einem Einzelbett (17, 18) kann keine zwei
// Personen aufnehmen. Eine Einzelbuchung darin belegte aber rechnerisch
// einen der Zweibettplaetze, also wurde zu wenig verkauft.
//
// Hier wird stattdessen geprueft, ob sich alle bestehenden Belegungen UND
// die neue Anfrage tatsaechlich auf verschiedene, geeignete Zimmer verteilen
// lassen. Das ist dieselbe Frage, die das Haus beim Zuweisen loest.
//
// Ohne Datenbankzugriff - dieselbe Logik fuer Buchungsstrecke, Kalender und
// Test.

export type AllocRoom = {
  id: number;
  number: string;
  roomTypeId: number;
  bedType: BedType;
  maxOccupancy: number;
  active: boolean;
  /** room_status. OUT_OF_SERVICE bedeutet dauerhaft nicht verfuegbar. */
  status: string;
};

export type AllocDemand = {
  /** Eindeutige Kennung, etwa die BookingRoom-ID. */
  key: string;
  roomTypeId: number;
  persons: number;
  /** Gewuenschte Bettart, oder null wenn gleichgueltig. */
  bedType: BedType | null;
  /** Bereits zugewiesenes Zimmer, oder null. */
  roomId: number | null;
  checkIn: string;
  checkOut: string;
};

export type AllocBlock = {
  roomId: number;
  startDate: string;
  /** Exklusiv, wie checkOut einer Buchung. */
  endDate: string;
};

export type AllocRequest = {
  roomTypeId: number;
  persons: number;
  bedType: BedType | null;
  checkIn: string;
  checkOut: string;
};

/** Halboffene Zeitraeume [von, bis). Der Abreisetag ist keine Nacht. */
export function overlaps(aFrom: string, aTo: string, bFrom: string, bTo: string) {
  return aFrom < bTo && bFrom < aTo;
}

/** Zimmer, die grundsaetzlich vergeben werden koennen. */
export function roomUsable(room: AllocRoom) {
  return room.active && room.status !== "OUT_OF_SERVICE";
}

/** Traegt dieses Zimmer die Anforderung - Kategorie, Personen, Bettart? */
function passt(room: AllocRoom, roomTypeId: number, persons: number, bedType: BedType | null) {
  if (!roomUsable(room)) return false;
  if (room.roomTypeId !== roomTypeId) return false;
  if (room.maxOccupancy < persons) return false;
  if (bedType && room.bedType !== bedType) return false;

  return true;
}

type Belegung = { from: string; to: string };

/**
 * Welche Zeitraeume sind je Zimmer bereits fest vergeben? Zugewiesene
 * Buchungen und Sperren sind unverhandelbar: Sie gelten so, wie sie in der
 * Datenbank stehen.
 */
function festeBelegungen(demands: AllocDemand[], blocks: AllocBlock[]) {
  const belegt = new Map<number, Belegung[]>();

  const eintragen = (roomId: number, from: string, to: string) => {
    const liste = belegt.get(roomId) ?? [];
    liste.push({ from, to });
    belegt.set(roomId, liste);
  };

  for (const demand of demands) {
    if (demand.roomId !== null) {
      eintragen(demand.roomId, demand.checkIn, demand.checkOut);
    }
  }

  for (const block of blocks) {
    eintragen(block.roomId, block.startDate, block.endDate);
  }

  return belegt;
}

function freiImZeitraum(belegt: Belegung[] | undefined, from: string, to: string) {
  if (!belegt) return true;

  return !belegt.some((eintrag) => overlaps(eintrag.from, eintrag.to, from, to));
}

type OffeneForderung = {
  key: string;
  roomTypeId: number;
  persons: number;
  bedType: BedType | null;
  checkIn: string;
  checkOut: string;
};

/**
 * Lassen sich alle offenen Forderungen auf verschiedene geeignete Zimmer
 * verteilen, ohne dass sich zwei im selben Zimmer ueberschneiden?
 *
 * Suche mit Rueckverfolgung. Bei 17 Zimmern ist das winzig; die Obergrenze
 * an Schritten schuetzt dennoch vor Ausreissern. Laeuft die Suche in die
 * Grenze, lautet die Antwort „nicht belegbar“ - im Zweifel wird also eher zu
 * wenig angeboten als zu viel.
 */
export function kannVerteilen(
  rooms: AllocRoom[],
  offene: OffeneForderung[],
  festVergeben: Map<number, Belegung[]>,
  maxSchritte = 50_000
): boolean {
  if (offene.length === 0) return true;

  // Kleinste passende Zimmer zuerst: Das haelt grosse Zimmer fuer grosse
  // Forderungen frei und findet gueltige Verteilungen schneller.
  const sortierteZimmer = [...rooms].sort(
    (a, b) => a.maxOccupancy - b.maxOccupancy || a.id - b.id
  );

  // Am staerksten eingeschraenkte Forderung zuerst.
  const kandidatenJeForderung = new Map<string, AllocRoom[]>();

  for (const forderung of offene) {
    const moeglich = sortierteZimmer.filter(
      (room) =>
        passt(room, forderung.roomTypeId, forderung.persons, forderung.bedType) &&
        freiImZeitraum(festVergeben.get(room.id), forderung.checkIn, forderung.checkOut)
    );

    if (moeglich.length === 0) return false;

    kandidatenJeForderung.set(forderung.key, moeglich);
  }

  const reihenfolge = [...offene].sort(
    (a, b) =>
      (kandidatenJeForderung.get(a.key)?.length ?? 0) -
        (kandidatenJeForderung.get(b.key)?.length ?? 0) ||
      a.checkIn.localeCompare(b.checkIn)
  );

  const vergeben = new Map<number, Belegung[]>();
  let schritte = 0;

  const suche = (index: number): boolean => {
    if (index === reihenfolge.length) return true;
    if (++schritte > maxSchritte) return false;

    const forderung = reihenfolge[index];

    for (const room of kandidatenJeForderung.get(forderung.key) ?? []) {
      if (!freiImZeitraum(vergeben.get(room.id), forderung.checkIn, forderung.checkOut)) {
        continue;
      }

      const liste = vergeben.get(room.id) ?? [];
      liste.push({ from: forderung.checkIn, to: forderung.checkOut });
      vergeben.set(room.id, liste);

      if (suche(index + 1)) return true;

      liste.pop();
    }

    return false;
  };

  return suche(0);
}

export type AvailabilityInput = {
  rooms: AllocRoom[];
  /** Bestehende Belegungen, die den gefragten Zeitraum beruehren. */
  demands: AllocDemand[];
  blocks: AllocBlock[];
  request: AllocRequest;
  /** Obergrenze der Antwort. Standard: Zahl der passenden Zimmer. */
  limit?: number;
};

/**
 * Wie viele weitere Buchungen dieser Art passen noch in den Zeitraum?
 *
 * Gezaehlt wird, indem die Anfrage so lange zusaetzlich eingeplant wird, wie
 * sich alles noch verteilen laesst.
 */
export function availableForRequest(input: AvailabilityInput): number {
  const { rooms, blocks, request } = input;

  const passende = rooms.filter((room) =>
    passt(room, request.roomTypeId, request.persons, request.bedType)
  );

  if (passende.length === 0) return 0;

  const obergrenze = Math.min(input.limit ?? passende.length, passende.length);

  // Nur Belegungen, die den gefragten Zeitraum beruehren, koennen ihn
  // einschraenken.
  const relevante = input.demands.filter((demand) =>
    overlaps(demand.checkIn, demand.checkOut, request.checkIn, request.checkOut)
  );

  const festVergeben = festeBelegungen(relevante, blocks);

  const offene: OffeneForderung[] = relevante
    .filter((demand) => demand.roomId === null)
    .map((demand) => ({
      key: demand.key,
      roomTypeId: demand.roomTypeId,
      persons: demand.persons,
      bedType: demand.bedType,
      checkIn: demand.checkIn,
      checkOut: demand.checkOut,
    }));

  // Lassen sich schon die bestehenden offenen Belegungen nicht verteilen,
  // ist der Bestand ueberbucht. Dann wird nichts weiter angeboten.
  if (!kannVerteilen(rooms, offene, festVergeben)) return 0;

  let moeglich = 0;

  for (let anzahl = 1; anzahl <= obergrenze; anzahl++) {
    const mitAnfrage: OffeneForderung[] = [
      ...offene,
      ...Array.from({ length: anzahl }, (_, index) => ({
        key: `anfrage-${index}`,
        roomTypeId: request.roomTypeId,
        persons: request.persons,
        bedType: request.bedType,
        checkIn: request.checkIn,
        checkOut: request.checkOut,
      })),
    ];

    if (!kannVerteilen(rooms, mitAnfrage, festVergeben)) break;

    moeglich = anzahl;
  }

  return moeglich;
}

export type DayStatus =
  | "FREI"
  | "BELEGT"
  | "ANREISE"
  | "ABREISE"
  | "GESPERRT"
  | "AUSSER_BETRIEB";

export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  FREI: "Frei",
  BELEGT: "Belegt",
  ANREISE: "Anreise",
  ABREISE: "Abreise",
  GESPERRT: "Gesperrt",
  AUSSER_BETRIEB: "Außer Betrieb",
};

/**
 * Zustand eines Zimmers an einem Tag.
 *
 * ANREISE und ABREISE sind Sonderfaelle von BELEGT bzw. FREI: Am Abreisetag
 * ist die Nacht NICHT mehr belegt, das Zimmer ist nach der Reinigung wieder
 * verfuegbar. Faellt auf denselben Tag eine Abreise und eine Anreise, wiegt
 * die Anreise schwerer - die Nacht ist belegt.
 */
export function dayStatus(
  room: AllocRoom,
  tag: string,
  demands: AllocDemand[],
  blocks: AllocBlock[]
): DayStatus {
  if (!roomUsable(room)) return "AUSSER_BETRIEB";

  const eigene = demands.filter((demand) => demand.roomId === room.id);

  if (eigene.some((demand) => demand.checkIn === tag)) return "ANREISE";

  if (eigene.some((demand) => demand.checkIn < tag && demand.checkOut > tag)) {
    return "BELEGT";
  }

  if (blocks.some((block) => block.roomId === room.id && block.startDate <= tag && block.endDate > tag)) {
    return "GESPERRT";
  }

  if (eigene.some((demand) => demand.checkOut === tag)) return "ABREISE";

  return "FREI";
}

export type AssignmentProblem =
  | { kind: "INACTIVE" }
  | { kind: "OUT_OF_SERVICE" }
  | { kind: "WRONG_TYPE" }
  | { kind: "CAPACITY"; maxOccupancy: number; persons: number }
  | { kind: "BED_TYPE"; roomBedType: BedType; wanted: BedType }
  | { kind: "BLOCKED"; startDate: string; endDate: string }
  | { kind: "OCCUPIED"; conflictKey: string };

/**
 * Warum laesst sich diese Buchungsposition NICHT in dieses Zimmer legen?
 * null bedeutet: zulaessig.
 *
 * Geprueft wird der GESAMTE Aufenthaltszeitraum. Ein Zimmer, das auch nur
 * fuer eine der Naechte belegt oder gesperrt ist, scheidet aus. Der
 * Abreisetag zaehlt dabei nicht als Nacht - overlaps arbeitet halboffen.
 *
 * Die eigene Position wird uebersprungen: Das aktuell zugewiesene Zimmer
 * bleibt dadurch eine gueltige Auswahl.
 */
export function assignmentProblem(
  room: AllocRoom,
  demand: AllocDemand,
  demands: AllocDemand[],
  blocks: AllocBlock[]
): AssignmentProblem | null {
  if (!room.active) return { kind: "INACTIVE" };
  if (room.status === "OUT_OF_SERVICE") return { kind: "OUT_OF_SERVICE" };
  if (room.roomTypeId !== demand.roomTypeId) return { kind: "WRONG_TYPE" };

  if (room.maxOccupancy < demand.persons) {
    return { kind: "CAPACITY", maxOccupancy: room.maxOccupancy, persons: demand.persons };
  }

  if (demand.bedType && room.bedType !== demand.bedType) {
    return { kind: "BED_TYPE", roomBedType: room.bedType, wanted: demand.bedType };
  }

  const sperre = blocks.find(
    (block) =>
      block.roomId === room.id &&
      overlaps(block.startDate, block.endDate, demand.checkIn, demand.checkOut)
  );

  if (sperre) {
    return { kind: "BLOCKED", startDate: sperre.startDate, endDate: sperre.endDate };
  }

  const belegt = demands.find(
    (andere) =>
      andere.key !== demand.key &&
      andere.roomId === room.id &&
      overlaps(andere.checkIn, andere.checkOut, demand.checkIn, demand.checkOut)
  );

  if (belegt) return { kind: "OCCUPIED", conflictKey: belegt.key };

  return null;
}

/** Alle Zimmer, in die diese Buchungsposition gelegt werden darf. */
export function assignableRooms(
  rooms: AllocRoom[],
  demand: AllocDemand,
  demands: AllocDemand[],
  blocks: AllocBlock[]
): AllocRoom[] {
  return rooms.filter((room) => assignmentProblem(room, demand, demands, blocks) === null);
}

