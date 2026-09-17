import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <>
      <Navbar section="home" />

      <main className="bg-[#211f1b] text-[#f5f1e8]">
        {/* HERO */}
        <section className="relative min-h-screen overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://www.altertelegraf.at/wp-content/uploads/2018/11/Alter-Telegraf-017-1024x682.jpg')",
            }}
          />

          <div className="absolute inset-0 bg-black/60" />

          <div className="absolute inset-0 bg-gradient-to-r from-[#211f1b]/95 via-[#211f1b]/65 to-[#211f1b]/25" />

          <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-6 py-32 lg:px-10">
            <div className="w-full max-w-5xl">
              <p className="mb-6 text-sm font-semibold uppercase tracking-[0.35em] text-[#d8c39a]">
                Willkommen im Alten Telegraf
              </p>

              <h1 className="max-w-4xl text-5xl leading-[0.95] sm:text-7xl lg:text-8xl">
                Ein Ort.
                <br />
                <span className="italic text-[#d8c39a]">
                  Zwei Erlebnisse.
                </span>
              </h1>

              <p className="mt-8 max-w-2xl text-lg leading-8 text-white/80 sm:text-xl">
                Restaurant und Hotel mitten in Graz. Entdecken Sie das
                Hendl-Eck oder verbringen Sie Ihren Aufenthalt im Alten
                Telegraf.
              </p>

              {/* BEREICHE */}
              <div className="mt-12 grid gap-5 sm:grid-cols-2">
                {/* HENDL-ECK */}
                <a
                  href="/restaurant"
                  className="group border border-white/20 bg-[#315c45]/90 p-8 backdrop-blur-sm transition duration-300 hover:bg-[#315c45]"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d8c39a]">
                    Restaurant
                  </p>

                  <h2 className="mt-4 text-3xl text-white">
                    Hendl-Eck
                  </h2>

                  <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">
                    Traditionelle Küche, Hendl-Spezialitäten,
                    Tagesempfehlungen und gemütlicher Gastgarten.
                  </p>

                  <span className="mt-7 inline-block text-sm font-semibold text-white">
                    Zum Hendl-Eck →
                  </span>
                </a>

                {/* HOTEL */}
                <a
                  href="/hotel"
                  className="group border border-white/20 bg-[#f5f1e8]/95 p-8 text-[#211f1b] backdrop-blur-sm transition duration-300 hover:bg-white"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#315c45]">
                    Übernachten
                  </p>

                  <h2 className="mt-4 text-3xl">
                    Hotel Alter Telegraf
                  </h2>

                  <p className="mt-3 max-w-sm text-sm leading-6 text-[#756f64]">
                    Übernachten mitten in Graz und den Alten Telegraf
                    als Ausgangspunkt für Ihren Aufenthalt entdecken.
                  </p>

                  <span className="mt-7 inline-block text-sm font-semibold text-[#315c45]">
                    Zum Hotel →
                  </span>
                </a>
              </div>

              {/* INFO */}
              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-xs uppercase tracking-[0.2em] text-white/50">
                <span>Grabenstraße 12 · 8010 Graz</span>
                <span>Hendl-Eck · Hotel</span>
              </div>
            </div>
          </div>
        </section>

        {/* KURZER EINSTIEG */}
        <section className="bg-[#f5f1e8] px-6 py-24 text-[#211f1b] lg:px-10 lg:py-32">
          <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2">
            <a
              href="/restaurant"
              className="group border border-[#211f1b]/10 bg-[#e9e2d5] p-10 transition hover:border-[#315c45]"
            >
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#315c45]">
                Hendl-Eck
              </p>

              <h2 className="mt-5 text-4xl">
                Gute Küche.
                <br />
                <span className="italic text-[#315c45]">
                  Gemütliches Wirtshaus.
                </span>
              </h2>

              <p className="mt-6 leading-7 text-[#756f64]">
                Werfen Sie einen Blick auf unsere Speisekarte,
                entdecken Sie die aktuelle Tagesempfehlung oder
                reservieren Sie direkt einen Tisch.
              </p>

              <span className="mt-8 inline-block font-semibold text-[#315c45]">
                Restaurant entdecken →
              </span>
            </a>

            <a
              href="/hotel"
              className="group border border-[#211f1b]/10 bg-[#315c45] p-10 text-white transition hover:bg-[#264936]"
            >
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d8c39a]">
                Hotel Alter Telegraf
              </p>

              <h2 className="mt-5 text-4xl">
                Ankommen.
                <br />
                <span className="italic text-[#d8c39a]">
                  Bleiben.
                </span>
              </h2>

              <p className="mt-6 leading-7 text-white/70">
                Informationen zu Zimmern, Aufenthalt und den
                Leistungen des Hotels finden Sie im eigenständigen
                Hotelbereich.
              </p>

              <span className="mt-8 inline-block font-semibold text-white">
                Hotel entdecken →
              </span>
            </a>
          </div>
        </section>
      </main>
    </>
  );
}