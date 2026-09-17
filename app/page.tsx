import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <>
      <Navbar />

      <main className="bg-[#f5f1e8] text-[#211f1b]">
        {/* HERO */}
        <section className="relative min-h-screen overflow-hidden bg-[#211f1b]">
          {/* Restaurant photo */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://www.altertelegraf.at/wp-content/uploads/2018/11/Alter-Telegraf-017-1024x682.jpg')",
            }}
          />

          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/55" />

          {/* Warm gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#211f1b] via-[#211f1b]/45 to-[#211f1b]/10" />

          <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-6 pb-40 pt-32 text-center lg:px-10">
            <p className="mb-6 text-sm font-bold uppercase tracking-[0.35em] text-[#d8c39a]">
              Seit über 80 Jahren in Graz
            </p>

            <h1 className="font-serif text-6xl leading-[0.95] text-[#f5f1e8] sm:text-7xl lg:text-8xl">
              Hendl-Eck
              <br />
              <span className="italic text-[#d8c39a]">Alter Telegraf</span>
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-white/80 sm:text-xl">
              Traditionelles Grazer Wirtshaus mit Gastgarten – und gemütliche
              Zimmer zum Übernachten, mitten in der Grabenstraße.
            </p>
          </div>

          {/* Auswahl: Restaurant / Hotel */}
          <div className="absolute bottom-0 left-0 right-0">
            <div className="mx-auto grid max-w-7xl sm:grid-cols-2">
              <a
                href="/restaurant"
                className="group relative overflow-hidden border-t border-white/10 bg-[#211f1b]/70 px-6 py-10 backdrop-blur-sm transition hover:bg-[#315c45]/80 lg:px-10 lg:py-12"
              >
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d8c39a]">
                  Restaurant
                </p>

                <h2 className="mt-2 font-serif text-3xl text-white sm:text-4xl">
                  Hendl-Eck
                </h2>

                <p className="mt-3 max-w-sm text-sm leading-6 text-white/60">
                  Speisekarte, Tagesempfehlung und Tischreservierung.
                </p>

                <span className="mt-6 inline-flex items-center text-sm font-semibold text-[#d8c39a] transition group-hover:translate-x-1">
                  Zum Restaurant →
                </span>
              </a>

              <a
                href="/hotel"
                className="group relative overflow-hidden border-t border-white/10 bg-[#211f1b]/70 px-6 py-10 backdrop-blur-sm transition hover:bg-[#315c45]/80 sm:border-l sm:border-white/10 lg:px-10 lg:py-12"
              >
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d8c39a]">
                  Hotel
                </p>

                <h2 className="mt-2 font-serif text-3xl text-white sm:text-4xl">
                  Alter Telegraf
                </h2>

                <p className="mt-3 max-w-sm text-sm leading-6 text-white/60">
                  Zimmer, Ausstattung und Aufenthalt anfragen.
                </p>

                <span className="mt-6 inline-flex items-center text-sm font-semibold text-[#d8c39a] transition group-hover:translate-x-1">
                  Zum Hotel →
                </span>
              </a>
            </div>
          </div>
        </section>

        {/* ÜBER UNS */}
        <section className="px-6 py-24 lg:px-10 lg:py-32">
          <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="mb-5 text-sm font-bold uppercase tracking-[0.3em] text-[#b08a4a]">
                Ein Stück Graz
              </p>

              <h2 className="font-serif text-4xl leading-tight sm:text-5xl">
                Tradition,
                <br />
                <span className="italic text-[#b08a4a]">die bleibt.</span>
              </h2>

              <p className="mt-6 max-w-xl text-lg leading-8 text-[#756f64]">
                Das Hendl-Eck im Alten Telegraf gehört seit über 80 Jahren zur
                Grazer Wirtshauskultur – ehrliche Küche, regionale Zutaten und
                herzliche Gastfreundschaft. Wer bei uns übernachten möchte,
                findet direkt im Haus gemütliche Hotelzimmer.
              </p>
            </div>

            <div className="border border-[#211f1b]/10 bg-[#e9e2d5] p-8 sm:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#b08a4a]">
                Auf einen Blick
              </p>

              <div className="mt-8 space-y-6">
                <div className="border-b border-[#211f1b]/10 pb-6">
                  <p className="text-3xl font-semibold text-[#211f1b]">
                    80+
                  </p>
                  <p className="mt-1 text-sm uppercase tracking-wider text-[#756f64]">
                    Jahre Hendl-Eck in Graz
                  </p>
                </div>

                <div>
                  <p className="text-2xl font-semibold text-[#211f1b]">
                    Mitten in Graz
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#756f64]">
                    Grabenstraße 12 · 8010 Graz
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="bg-[#211f1b] px-6 py-16 text-white lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 md:grid-cols-3">
              <div>
                <p className="text-lg font-semibold tracking-[0.18em]">
                  ALTER TELEGRAF
                </p>

                <p className="mt-2 text-[10px] uppercase tracking-[0.35em] text-[#c9a96a]">
                  Hendl-Eck · Graz
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-white/50">
                  Adresse
                </p>

                <p className="mt-3 text-white/80">
                  Grabenstraße 12
                  <br />
                  8010 Graz
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-white/50">
                  Kontakt
                </p>

                <a
                  href="tel:+43316686558"
                  className="mt-3 block text-white/80 transition hover:text-[#c9a96a]"
                >
                  +43 316 686558
                </a>
              </div>
            </div>

            <div className="mt-12 border-t border-white/10 pt-6">
              <p className="text-sm text-white/40">
                © {new Date().getFullYear()} Alter Telegraf · Hendl-Eck Graz
              </p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
