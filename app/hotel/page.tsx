import Navbar from "@/components/Navbar";
import { RoomShowcase, type ShowcaseRoom } from "@/components/hotel/RoomPresentation";
import { loadPublicRooms } from "@/lib/hotel/rooms";

// Die Zimmerdaten pflegt der Betrieb im Admin. Ohne das waere die Seite
// vorgerendert und Aenderungen erst beim naechsten Deploy sichtbar.
export const dynamic = "force-dynamic";

export default async function HotelPage() {
  const rooms = await loadPublicRooms();

  // Die Standardbelegung ist die Zahl, mit der die Kategorie beworben wird.
  const showcase: ShowcaseRoom[] = rooms.map((room) => ({
    roomTypeId: room.roomTypeId,
    name: room.name,
    shortDescription: room.shortDescription,
    description: room.description,
    sizeSqm: room.sizeSqm,
    persons: room.fromOccupancy ?? room.standardOccupancy,
    maxOccupancy: room.maxOccupancy,
    images: room.images,
    amenities: room.amenities,
    bedTypes: room.bedTypes.map(({ bedType, label }) => ({ bedType, label })),
    price: room.fromPrice,
    priceIsFrom: true,
  }));

  // Ausstattung, die in allen gezeigten Kategorien vorhanden ist.
  const sharedAmenities = showcase.length
    ? showcase[0].amenities.filter((amenity) =>
        showcase.every((room) => room.amenities.some((own) => own.code === amenity.code))
      )
    : [];

  return (
    <>
      <Navbar section="hotel" />

      <main className="bg-[#f5f1e8] text-[#211f1b]">
        {/* HERO */}
        <section className="relative min-h-screen overflow-hidden bg-[#211f1b]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: "url('/images/haus-fassade.jpg')",
            }}
          />

          <div className="absolute inset-0 bg-black/55" />

          <div className="absolute inset-0 bg-gradient-to-r from-[#211f1b]/95 via-[#211f1b]/60 to-[#211f1b]/20" />

          <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-6 py-32 lg:px-10">
            <div className="max-w-3xl">
              <p className="mb-6 text-sm font-bold uppercase tracking-[0.35em] text-[#d8c39a]">
                Hotel in Graz
              </p>

              <h1 className="text-6xl leading-[0.95] text-[#f5f1e8] sm:text-7xl lg:text-8xl">
                Hotel
                <br />
                <span className="italic text-[#d8c39a]">
                  Alter Telegraf
                </span>
              </h1>

              <p className="mt-8 max-w-xl text-lg leading-8 text-white/80 sm:text-xl">
                Übernachten mitten in Graz und den Alten Telegraf
                als Ausgangspunkt für Ihren Aufenthalt entdecken.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <a
                  href="#zimmer"
                  className="rounded-full bg-[#315c45] px-7 py-4 text-center text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#264936]"
                >
                  Zimmer entdecken
                </a>

                <a
                  href="/hotel/buchen"
                  className="rounded-full border border-white/40 bg-white/5 px-7 py-4 text-center text-sm font-bold uppercase tracking-wider text-white backdrop-blur-sm transition hover:bg-white/10"
                >
                  Zimmer buchen
                </a>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 md:block">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">
              Graz · Grabenstraße
            </p>
          </div>
        </section>

        {/* ÜBERNACHTEN */}
        <section
          id="uebernachten"
          className="bg-[#f5f1e8] px-6 py-24 lg:px-10 lg:py-32"
        >
          <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="mb-5 text-sm font-bold uppercase tracking-[0.3em] text-[#315c45]">
                Übernachten in Graz
              </p>

              <h2 className="text-4xl leading-tight sm:text-6xl">
                Ihr Aufenthalt
                <br />
                <span className="italic text-[#315c45]">
                  im Alten Telegraf.
                </span>
              </h2>

              <div className="mt-8 max-w-2xl space-y-5 text-lg leading-8 text-[#756f64]">
                <p>
                  Der Hotelbereich des Alten Telegraf erhält seinen
                  eigenen Auftritt und bleibt bewusst vom
                  Restaurantbereich des Hendl-Eck getrennt.
                </p>

                <p>
                  Hier finden Gäste künftig alle Informationen rund
                  um ihren Aufenthalt, die Zimmer und die
                  Ausstattung.
                </p>
              </div>
            </div>

            <div className="border border-[#211f1b]/10 bg-[#e9e2d5] p-8 sm:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#315c45]">
                Hotel Alter Telegraf
              </p>

              <div className="mt-10 space-y-8">
                <div className="border-b border-[#211f1b]/10 pb-8">
                  <p className="text-2xl font-semibold">
                    Mitten in Graz
                  </p>

                  <p className="mt-2 leading-6 text-[#756f64]">
                    Grabenstraße 12 · 8010 Graz
                  </p>
                </div>

                <div className="border-b border-[#211f1b]/10 pb-8">
                  <p className="text-2xl font-semibold">
                    Restaurant & Hotel
                  </p>

                  <p className="mt-2 leading-6 text-[#756f64]">
                    Zwei eigenständige Bereiche unter einer gemeinsamen
                    Adresse.
                  </p>
                </div>

                <div>
                  <p className="text-2xl font-semibold">
                    Persönliche Anfrage
                  </p>

                  <p className="mt-2 leading-6 text-[#756f64]">
                    Kontaktieren Sie das Hotel direkt für Ihren
                    Aufenthalt.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ZIMMER */}
        <section
          id="zimmer"
          className="bg-[#e9e2d5] px-6 py-24 lg:px-10 lg:py-32"
        >
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="mb-5 text-sm font-bold uppercase tracking-[0.3em] text-[#315c45]">
                Übernachten
              </p>

              <h2 className="text-4xl leading-tight sm:text-6xl">
                Unsere
                <br />
                <span className="italic text-[#315c45]">
                  Zimmer.
                </span>
              </h2>

              <p className="mt-7 text-lg leading-8 text-[#756f64]">
                {showcase.length > 0
                  ? "Alle Zimmer verfügen über dieselbe Standardausstattung. Wählen Sie die Kategorie, die zu Ihrem Aufenthalt passt."
                  : "Die Zimmerdaten werden derzeit eingepflegt."}
              </p>
            </div>

            <div className="mt-14">
              {showcase.length > 0 ? (
                <RoomShowcase rooms={showcase} />
              ) : (
                <div className="border border-[#211f1b]/10 bg-[#f5f1e8] p-8">
                  <h3 className="text-2xl">Zimmer folgen</h3>

                  <p className="mt-4 leading-7 text-[#756f64]">
                    Für Ihre Anfrage erreichen Sie uns unter{" "}
                    <a href="tel:+43316686558" className="underline">
                      +43 316 686558
                    </a>
                    .
                  </p>
                </div>
              )}
            </div>

            {showcase.length > 0 && (
              <div className="mt-12 text-center">
                <a
                  href="/hotel/buchen"
                  className="inline-block rounded-full bg-[#211f1b] px-8 py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#3a3630]"
                >
                  Verfügbarkeit prüfen
                </a>
              </div>
            )}
          </div>
        </section>

        {/* AUSSTATTUNG */}
        <section
          id="ausstattung"
          className="bg-[#f5f1e8] px-6 py-24 lg:px-10 lg:py-32"
        >
          <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="mb-5 text-sm font-bold uppercase tracking-[0.3em] text-[#315c45]">
                Hotel
              </p>

              <h2 className="text-4xl leading-tight sm:text-6xl">
                Alles für Ihren
                <br />
                <span className="italic text-[#315c45]">
                  Aufenthalt.
                </span>
              </h2>

              <p className="mt-8 max-w-xl text-lg leading-8 text-[#756f64]">
                {sharedAmenities.length > 0
                  ? "Diese Ausstattung finden Sie in jedem unserer Zimmer."
                  : "Die Ausstattungsmerkmale werden derzeit eingepflegt."}
              </p>

              {sharedAmenities.length > 0 && (
                <ul className="mt-8 grid max-w-xl gap-x-8 gap-y-3 sm:grid-cols-2">
                  {sharedAmenities.map((amenity) => (
                    <li
                      key={amenity.code}
                      className="flex items-center gap-3 border-b border-[#211f1b]/10 pb-3 text-lg"
                    >
                      <span className="text-[#315c45]" aria-hidden>
                        &#10003;
                      </span>
                      {amenity.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="overflow-hidden">
              <img
                src="/images/hotel-flur.jpg"
                alt="Flur im Hotel Alter Telegraf mit Wegweiser zu den Zimmern"
                className="h-[420px] w-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* KONTAKT */}
        <section
          id="kontakt"
          className="bg-[#315c45] px-6 py-24 text-white lg:px-10 lg:py-32"
        >
          <div className="mx-auto max-w-5xl text-center">
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.3em] text-[#d8c39a]">
              Hotel Alter Telegraf
            </p>

            <h2 className="text-4xl leading-tight sm:text-6xl">
              Aufenthalt
              <br />
              <span className="italic text-[#f0dfb8]">
                anfragen.
              </span>
            </h2>

            <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-white/75">
              Sie möchten im Alten Telegraf übernachten? Kontaktieren
              Sie das Hotel direkt für weitere Informationen und Ihre
              Anfrage.
            </p>

            <a
              href="mailto:hotel@altertelegraf.at"
              className="mt-10 inline-block rounded-full bg-[#f5f1e8] px-8 py-4 text-sm font-bold uppercase tracking-wider text-[#211f1b] transition hover:bg-white"
            >
              hotel@altertelegraf.at
            </a>
          </div>
        </section>
      </main>
    </>
  );
}