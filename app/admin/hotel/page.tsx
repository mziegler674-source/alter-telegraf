import "server-only";

import { Badge, HotelMissing, PageIntro } from "@/components/hotel-admin/ui";
import { getHotel } from "@/lib/hotel/admin-api";
import { HOTEL_NAV, ROOM_STATUSES, ROOM_STATUS_LABELS } from "@/lib/hotel/constants";
import { db } from "@/prisma/db";

const moduleDescriptions: Record<string, string> = {
  "/admin/hotel/einstellungen": "Stammdaten, Kontakt, Check-in/-out und Rezeptionszeiten.",
  "/admin/hotel/zimmerarten": "Kategorien mit Belegung, Preisart und Frühstück.",
  "/admin/hotel/zimmer": "Konkrete Zimmer mit Nummer, Etage und Reinigungsstatus.",
  "/admin/hotel/ausstattung": "Ausstattungskatalog und Zuordnung zu Zimmerarten.",
  "/admin/hotel/buchungen": "Buchungen mit mehreren Zimmern, Gästen und Nächten.",
  "/admin/hotel/gaeste": "Gästestammdaten und Meldedaten.",
  "/admin/hotel/kalender": "Belegungs- und Verfügbarkeitskalender.",
  "/admin/hotel/preise": "Rate Plans und Tagespreise je Zimmerart.",
};

export default async function HotelOverviewPage() {
  const hotel = await getHotel();

  const [roomTypes, rooms, amenityCount, bookingCount] = hotel
    ? await Promise.all([
        db.orm.hotel.RoomType.where({ hotelId: hotel.id }).select("id", "active").all(),
        db.orm.hotel.Room.where({ hotelId: hotel.id }).select("id", "status", "active").all(),
        db.orm.hotel.Amenity.where({ hotelId: hotel.id }).aggregate((a) => ({ n: a.count() })),
        db.orm.hotel.Booking.where({ hotelId: hotel.id }).aggregate((a) => ({ n: a.count() })),
      ])
    : [[], [], { n: 0 }, { n: 0 }];

  const activeRooms = rooms.filter((room) => room.active);

  const stats = [
    { label: "Zimmerarten", value: roomTypes.length, sub: `${roomTypes.filter((r) => r.active).length} aktiv` },
    { label: "Zimmer", value: rooms.length, sub: `${activeRooms.length} aktiv` },
    { label: "Ausstattung", value: amenityCount.n, sub: "Merkmale" },
    { label: "Buchungen", value: bookingCount.n, sub: "gesamt" },
  ];

  return (
    <div>
      <PageIntro
        eyebrow="Übersicht"
        title={hotel ? hotel.name : "Hotel-PMS"}
        description="Zentrale Verwaltung für Zimmer, Ausstattung und künftig Buchungen des Hotels."
      />

      {!hotel && (
        <div className="mt-8">
          <HotelMissing />
        </div>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="border border-[#211f1b]/10 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#756f64]">
              {stat.label}
            </p>
            <p className="mt-4 font-serif text-5xl">{stat.value}</p>
            <p className="mt-2 text-sm text-[#756f64]">{stat.sub}</p>
          </div>
        ))}
      </div>

      {activeRooms.length > 0 && (
        <section className="mt-8 border border-[#211f1b]/10 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#756f64]">
            Zimmerstatus (aktive Zimmer)
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {ROOM_STATUSES.map((status) => (
              <Badge key={status} tone={status === "OUT_OF_SERVICE" ? "red" : status === "DIRTY" ? "amber" : "green"}>
                {ROOM_STATUS_LABELS[status]}: {activeRooms.filter((r) => r.status === status).length}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Bereiche</h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {HOTEL_NAV.filter((item) => item.href !== "/admin/hotel").map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="group border border-[#211f1b]/10 bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-serif text-2xl">{item.label}</h3>
                {item.ready ? (
                  <span className="text-xl text-[#315c45] transition group-hover:translate-x-1">→</span>
                ) : (
                  <Badge tone="amber">In Vorbereitung</Badge>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-[#756f64]">
                {moduleDescriptions[item.href]}
              </p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
