import Navbar from "@/components/Navbar";

export default function HotelPage() {
  return (
    <>
      <Navbar section="hotel" />

      <main className="bg-[#f5f1e8] text-[#211f1b]">
        {/* HERO */}
        <section className="relative min-h-screen overflow-hidden bg-[#211f1b]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://www.altertelegraf.at/wp-content/uploads/2018/11/MG_3293ip-1024x681.jpg')",
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
                  href="#kontakt"
                  className="rounded-full border border-white/40 bg-white/5 px-7 py-4 text-center text-sm font-bold uppercase tracking-wider text-white backdrop-blur-sm transition hover:bg-white/10"
                >
                  Aufenthalt anfragen
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
                Die Zimmer werden hier mit ihren tatsächlichen
                Informationen, Bildern, Ausstattungsmerkmalen und
                Preisen vorgestellt.
              </p>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="min-h-[260px] border border-[#211f1b]/10 bg-[#f5f1e8] p-8">
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#315c45]">
                  Zimmer
                </span>

                <h3 className="mt-16 text-2xl">
                  Informationen folgen
                </h3>

                <p className="mt-4 leading-7 text-[#756f64]">
                  Die konkreten Zimmerdaten werden nach Rücksprache
                  mit dem Betreiber eingepflegt.
                </p>
              </div>

              <div className="min-h-[260px] border border-[#211f1b]/10 bg-[#f5f1e8] p-8">
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#315c45]">
                  Ausstattung
                </span>

                <h3 className="mt-16 text-2xl">
                  Komfort & Aufenthalt
                </h3>

                <p className="mt-4 leading-7 text-[#756f64]">
                  Hier werden später die tatsächlichen
                  Ausstattungsmerkmale dargestellt.
                </p>
              </div>

              <div className="min-h-[260px] border border-[#211f1b]/10 bg-[#f5f1e8] p-8">
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#315c45]">
                  Anfrage
                </span>

                <h3 className="mt-16 text-2xl">
                  Aufenthalt planen
                </h3>

                <p className="mt-4 leading-7 text-[#756f64]">
                  Informationen zur Anfrage und späteren
                  Hotelbuchung werden hier integriert.
                </p>
              </div>
            </div>
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
                Dieser Bereich wird mit den echten Informationen
                des Hotels ergänzt, sobald wir diese vom Betreiber
                erhalten.
              </p>
            </div>

            <div className="overflow-hidden">
              <img
                src="https://www.altertelegraf.at/wp-content/uploads/2018/11/ip_MG_9708h-1024x683.jpg"
                alt="Alter Telegraf in Graz"
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