import "server-only";

import {
  type BedType,
  BED_TYPE_LABELS,
  bedTypeOptions,
} from "@/lib/hotel/availability";
import { imageSrc } from "@/lib/hotel/images";
import { toCents } from "@/lib/hotel/pricing";
import { db } from "@/prisma/db";

// Die redaktionelle Darstellung einer Zimmerkategorie: Texte, Bilder,
// Ausstattung, Bettarten und der niedrigste Preis. Bewusst getrennt von der
// Verfuegbarkeits- und Preisberechnung - diese bleiben die Quelle der Wahrheit
// und werden hier nicht nachgebaut.

export type RoomImage = {
  id: number;
  src: string;
  alt: string;
};

export type RoomAmenity = {
  code: string;
  name: string;
  icon: string | null;
};

export type RoomPresentation = {
  roomTypeId: number;
  code: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  sizeSqm: number | null;
  standardOccupancy: number;
  maxOccupancy: number;
  images: RoomImage[];
  amenities: RoomAmenity[];
  bedTypes: { bedType: BedType; label: string; rooms: number }[];
  /** Niedrigster hinterlegter Grundpreis, oder null wenn keiner gepflegt ist. */
  fromPrice: string | null;
  fromOccupancy: number | null;
};

export async function loadRoomPresentations(hotelId: number): Promise<RoomPresentation[]> {
  const [roomTypes, rooms, images, links, amenities, prices] = await Promise.all([
    db.orm.hotel.RoomType
      .where({ hotelId, active: true })
      .select(
        "id",
        "code",
        "name",
        "slug",
        "shortDescription",
        "description",
        "sizeSqm",
        "standardOccupancy",
        "maxOccupancy"
      )
      .orderBy([(type) => type.sortOrder.asc(), (type) => type.name.asc()])
      .all(),
    db.orm.hotel.Room
      .where({ hotelId, active: true })
      .select("id", "number", "roomTypeId", "bedType", "maxOccupancy", "active")
      .all(),
    db.orm.hotel.RoomTypeImage
      .select("id", "roomTypeId", "url", "alt", "isPrimary", "sortOrder", "sizeBytes", "uploadedAt")
      .orderBy([(image) => image.sortOrder.asc(), (image) => image.id.asc()])
      .all(),
    db.orm.hotel.RoomTypeAmenity.select("roomTypeId", "amenityId").all(),
    db.orm.hotel.Amenity
      .where({ hotelId })
      .select("id", "code", "name", "icon")
      .orderBy([(a) => a.sortOrder.asc(), (a) => a.name.asc()])
      .all(),
    db.orm.hotel.RatePrice
      .where((price) => price.date.isNull())
      .select("roomTypeId", "occupancy", "amount")
      .all(),
  ]);

  const amenityById = new Map(amenities.map((amenity) => [amenity.id, amenity]));

  return roomTypes.map((type) => {
    // Das Hauptbild zuerst, danach die gepflegte Reihenfolge. Boolesche
    // Spalten lassen sich nicht sortieren, deshalb hier statt in der Abfrage.
    const ownImages = images
      .filter((image) => image.roomTypeId === type.id)
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map((image) => ({
        id: image.id,
        src: imageSrc({
          id: image.id,
          url: image.url,
          uploadedAt: image.uploadedAt ? String(image.uploadedAt) : null,
          hasFile: image.sizeBytes !== null,
        }),
        alt: image.alt ?? type.name,
      }))
      .filter((image): image is RoomImage => image.src !== null);

    const ownAmenities = links
      .filter((link) => link.roomTypeId === type.id)
      .map((link) => amenityById.get(link.amenityId))
      .filter((amenity): amenity is NonNullable<typeof amenity> => Boolean(amenity))
      .map(({ code, name, icon }) => ({ code, name, icon }));

    // Alle Bettarten, die in dieser Kategorie physisch vorhanden sind. Fuer die
    // Darstellung genuegt eine Belegung von einer Person.
    const beds = bedTypeOptions(rooms, type.id, 1).map((option) => ({
      bedType: option.bedType,
      label: BED_TYPE_LABELS[option.bedType],
      rooms: option.rooms,
    }));

    const ownPrices = prices
      .filter((price) => price.roomTypeId === type.id)
      .map((price) => ({ occupancy: price.occupancy, amount: String(price.amount) }))
      .sort((a, b) => toCents(a.amount) - toCents(b.amount));

    return {
      roomTypeId: type.id,
      code: type.code,
      name: type.name,
      slug: type.slug,
      shortDescription: type.shortDescription,
      description: type.description,
      sizeSqm: type.sizeSqm,
      standardOccupancy: type.standardOccupancy,
      maxOccupancy: type.maxOccupancy,
      images: ownImages,
      amenities: ownAmenities,
      bedTypes: beds,
      fromPrice: ownPrices[0]?.amount ?? null,
      fromOccupancy: ownPrices[0]?.occupancy ?? null,
    };
  });
}

/** Kategorien, die oeffentlich gezeigt werden: nur mit gepflegtem Preis. */
export async function loadPublicRooms(): Promise<RoomPresentation[]> {
  const hotel = await db.orm.hotel.Hotel.orderBy((h) => h.id.asc()).select("id").first();

  if (!hotel) return [];

  const all = await loadRoomPresentations(hotel.id);

  return all.filter((room) => room.fromPrice !== null && room.bedTypes.length > 0);
}
