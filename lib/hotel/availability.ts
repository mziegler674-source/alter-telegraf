// Welche Kategorie ist fuer wie viele Personen buchbar, und welche
// physischen Zimmer tragen diese Belegung?
//
// Zwei Bedingungen muessen zusammen erfuellt sein:
//   1. Es gibt einen Preis fuer genau diese Personenzahl.
//   2. Es gibt mindestens ein aktives Zimmer, dessen maxOccupancy ausreicht.
//
// Punkt 2 ist entscheidend: Zimmer 17 und 18 sind als Doppelzimmer geführt,
// haben aber nur ein Einzelbett. Sie duerfen fuer zwei Personen nie
// ausgewaehlt werden.

export const BED_TYPES = [
  "EINZELBETT",
  "DOPPELBETT",
  "ZWEI_EINZELBETTEN",
  "DOPPELBETT_PLUS_ZWEI",
  "DREI_BETTEN",
] as const;

export type BedType = (typeof BED_TYPES)[number];

export const BED_TYPE_LABELS: Record<BedType, string> = {
  EINZELBETT: "1 Einzelbett",
  DOPPELBETT: "1 Doppelbett",
  ZWEI_EINZELBETTEN: "2 Einzelbetten",
  DOPPELBETT_PLUS_ZWEI: "1 Doppelbett + 2 weitere Betten",
  DREI_BETTEN: "3 Betten",
};

export type RoomLike = {
  id: number;
  number: string;
  roomTypeId: number;
  bedType: BedType;
  maxOccupancy: number;
  active: boolean;
};

export type RoomTypeLike = {
  id: number;
  code: string;
  name: string;
  active: boolean;
};

export type PriceLike = {
  roomTypeId: number;
  occupancy: number;
  amount: string;
};

/** Zimmer einer Kategorie, die die Personenzahl tatsaechlich tragen. */
export function roomsForOccupancy(
  rooms: RoomLike[],
  roomTypeId: number,
  persons: number
): RoomLike[] {
  return rooms.filter(
    (room) =>
      room.active && room.roomTypeId === roomTypeId && room.maxOccupancy >= persons
  );
}

/** Auswaehlbare Bettarten fuer eine Kategorie und Personenzahl. */
export function bedTypeOptions(
  rooms: RoomLike[],
  roomTypeId: number,
  persons: number
): { bedType: BedType; label: string; rooms: number }[] {
  const matching = roomsForOccupancy(rooms, roomTypeId, persons);
  const counts = new Map<BedType, number>();

  for (const room of matching) {
    counts.set(room.bedType, (counts.get(room.bedType) ?? 0) + 1);
  }

  return BED_TYPES.filter((bedType) => counts.has(bedType)).map((bedType) => ({
    bedType,
    label: BED_TYPE_LABELS[bedType],
    rooms: counts.get(bedType) as number,
  }));
}

export type Offer = {
  roomTypeId: number;
  code: string;
  name: string;
  persons: number;
  pricePerNight: string;
  rooms: number;
  bedTypes: { bedType: BedType; label: string; rooms: number }[];
};

/** Alle Kategorien, die fuer diese Personenzahl angeboten werden koennen. */
export function offersForOccupancy(
  roomTypes: RoomTypeLike[],
  rooms: RoomLike[],
  prices: PriceLike[],
  persons: number
): Offer[] {
  if (!Number.isInteger(persons) || persons < 1) {
    return [];
  }

  const offers: Offer[] = [];

  for (const roomType of roomTypes) {
    if (!roomType.active) continue;

    const price = prices.find(
      (entry) => entry.roomTypeId === roomType.id && entry.occupancy === persons
    );

    if (!price) continue;

    const matching = roomsForOccupancy(rooms, roomType.id, persons);

    if (matching.length === 0) continue;

    offers.push({
      roomTypeId: roomType.id,
      code: roomType.code,
      name: roomType.name,
      persons,
      pricePerNight: price.amount,
      rooms: matching.length,
      bedTypes: bedTypeOptions(rooms, roomType.id, persons),
    });
  }

  return offers;
}
