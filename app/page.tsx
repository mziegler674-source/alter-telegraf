import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <>
      <Navbar />

      <main className="bg-[#f5f1e8] text-[#211f1b]">
        {/* HERO */}
        <section className="relative overflow-hidden bg-[#211f1b]">
          {/* Background image */}
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
          <div className="absolute inset-0 bg-gradient-to-b from-[#211f1b]/15 via-[#211f1b]/35 to-[#211f1b]/95" />

          <div className="relative mx-auto max-w-7xl px-4 pt-24 sm:px-8 sm:pt-28 lg:px-10 lg:pt-36">

            {/* HERO CONTENT */}
            <div className="flex flex-col items-center justify-center text-center
      min-h-[360px] pb-8
      sm:min-h-[540px] sm:pb-16
      lg:min-h-[600px] lg:pb-24"
            >
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-[#d8c39a] sm:mb-6 sm:text-sm sm:tracking-[0.35em]">
                Seit über 80 Jahren in Graz
              </p>

              <h1
                className="
          max-w-[950px]
          font-serif
          text-[3rem]
          leading-[0.92]
          text-[#f5f1e8]
          sm:text-6xl
          md:text-7xl
          lg:text-8xl
        "
              >
                Hendl-Eck
                <br />
                <span className="italic text-[#d8c39a]">
                  Alter Telegraf
                </span>
              </h1>

              <p
                className="
          mt-5
          max-w-[650px]
          text-sm
          leading-6
          text-white/80
          sm:mt-8
          sm:text-lg
          sm:leading-8
          lg:text-xl
        "
              >
                Traditionelles Grazer Wirtshaus mit Gastgarten – und gemütliche
                Zimmer zum Übernachten, mitten in der Grabenstraße.
              </p>
            </div>

            {/* RESTAURANT / HOTEL */}
            <div className="grid grid-cols-1 overflow-hidden border-t border-white/10 sm:grid-cols-2">

              {/* RESTAURANT */}
              <a
                href="/restaurant"
                className="
          group
          border-b border-white/10
          bg-[#211f1b]/90
          px-4
          py-6
          sm:border-b-0
          sm:border-r
          backdrop-blur-md
          transition
          duration-300
          hover:bg-[#315c45]/90
          sm:px-7
          sm:py-9
          lg:px-10
          lg:py-10
        "
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#d8c39a] sm:text-xs sm:tracking-[0.3em]">
                  Restaurant
                </p>

                <h2 className="mt-1 font-serif text-xl text-white sm:mt-2 sm:text-3xl lg:text-4xl">
                  Hendl-Eck
                </h2>

                <p className="mt-2 max-w-sm text-[13px] leading-5 text-white/60 sm:text-sm sm:leading-6">
                  Speisekarte, Tagesempfehlung und Tischreservierung.
                </p>

                <span className="mt-4 inline-flex text-[11px] font-semibold text-[#d8c39a] sm:mt-5 sm:text-sm">
                  Zum Restaurant →
                </span>
              </a>

              {/* HOTEL */}
              <a
                href="/hotel"
                className="
          group
          bg-[#211f1b]/90
          px-4
          py-6
          backdrop-blur-md
          transition
          duration-300
          hover:bg-[#315c45]/90
          sm:px-7
          sm:py-9
          lg:px-10
          lg:py-10
        "
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#d8c39a] sm:text-xs sm:tracking-[0.3em]">
                  Hotel
                </p>

                <h2 className="mt-1 font-serif text-xl text-white sm:mt-2 sm:text-3xl lg:text-4xl">
                  Alter Telegraf
                </h2>

                <p className="mt-2 max-w-sm text-[13px] leading-5 text-white/60 sm:text-sm sm:leading-6">
                  Zimmer, Ausstattung und Aufenthalt anfragen.
                </p>

                <span className="mt-4 inline-flex text-[11px] font-semibold text-[#d8c39a] sm:mt-5 sm:text-sm">
                  Zum Hotel →
                </span>
              </a>
            </div>
          </div>
        </section>

        {/* ÜBER UNS */}
        <section className="px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-32">
          <div className="mx-auto grid max-w-7xl gap-12 sm:gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-[#b08a4a] sm:mb-5 sm:text-sm sm:tracking-[0.3em]">
                Ein Stück Graz
              </p>

              <h2 className="font-serif text-4xl leading-tight sm:text-5xl">
                Tradition,
                <br />
                <span className="italic text-[#b08a4a]">
                  die bleibt.
                </span>
              </h2>

              <p className="mt-5 max-w-xl text-base leading-7 text-[#756f64] sm:mt-6 sm:text-lg sm:leading-8">
                Das Hendl-Eck im Alten Telegraf gehört seit über 80 Jahren zur
                Grazer Wirtshauskultur – ehrliche Küche, regionale Zutaten und
                herzliche Gastfreundschaft. Wer bei uns übernachten möchte,
                findet direkt im Haus gemütliche Hotelzimmer.
              </p>
            </div>

            <div className="border border-[#211f1b]/10 bg-[#e9e2d5] p-6 sm:p-8 lg:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#b08a4a]">
                Auf einen Blick
              </p>

              <div className="mt-7 space-y-6 sm:mt-8">
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

        {/* FOOTER */}
        <footer className="bg-[#211f1b] px-5 py-14 text-white sm:px-8 sm:py-16 lg:px-10">
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
      </main >
    </>
  );
}