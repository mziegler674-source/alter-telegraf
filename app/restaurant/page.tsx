import Navbar from "@/components/Navbar";
import ReservationWidget from "@/components/ReservationWidget";

export default function RestaurantPage() {
  return (
    <>
      <Navbar section="restaurant" />

      <main className="bg-[#f5f1e8] text-[#211f1b]">
        {/* HERO */}
        <section className="relative min-h-[90vh] overflow-hidden bg-[#211f1b]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://www.altertelegraf.at/wp-content/uploads/2018/11/Alter-Telegraf-017-1024x682.jpg')",
            }}
          />

          <div className="absolute inset-0 bg-black/50" />

          <div className="absolute inset-0 bg-gradient-to-r from-[#211f1b]/90 via-[#211f1b]/55 to-transparent" />

          <div className="relative mx-auto flex min-h-[90vh] max-w-7xl items-center px-6 py-32 lg:px-10">
            <div className="max-w-3xl">
              <p className="mb-5 text-sm font-bold uppercase tracking-[0.3em] text-[#c9a96a]">
                Restaurant in Graz
              </p>

              <h1 className="text-6xl leading-[0.95] text-[#f5f1e8] sm:text-7xl lg:text-8xl">
                Hendl-Eck
                <br />
                <span className="italic text-[#c9a96a]">
                  Alter Telegraf
                </span>
              </h1>

              <p className="mt-8 max-w-xl text-lg leading-8 text-white/80 sm:text-xl">
                Traditionelle Küche, ehrliche Gastfreundschaft und
                Grazer Wirtshauskultur.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <a
                  href="#reservieren"
                  className="rounded-full bg-[#315c45] px-7 py-4 text-center text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#264936]"
                >
                  Tisch reservieren
                </a>

                <a
                  href="#speisekarte"
                  className="rounded-full border border-white/40 bg-white/5 px-7 py-4 text-center text-sm font-bold uppercase tracking-wider text-white backdrop-blur-sm transition hover:bg-white/10"
                >
                  Speisekarte
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ÜBER UNS */}
        <section
          id="ueber-uns"
          className="bg-[#f5f1e8] px-6 py-24 lg:px-10 lg:py-32"
        >
          <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="mb-5 text-sm font-bold uppercase tracking-[0.3em] text-[#315c45]">
                Ein Stück Graz
              </p>

              <h2 className="text-4xl leading-tight sm:text-6xl">
                Tradition,
                <br />
                <span className="italic text-[#315c45]">
                  die bleibt.
                </span>
              </h2>

              <div className="mt-8 max-w-2xl space-y-5 text-lg leading-8 text-[#756f64]">
                <p>
                  Das Hendl-Eck im Alten Telegraf gehört seit über
                  80 Jahren zur Grazer Wirtshauskultur.
                </p>

                <p>
                  Traditionelle Küche, gemütliches Ambiente und
                  herzliche Gastfreundschaft stehen im Mittelpunkt.
                </p>

                <p>
                  Ob Mittagessen, Abendessen oder ein gemütlicher
                  Besuch im Gastgarten – hier geht es um gutes Essen
                  und eine angenehme Zeit.
                </p>
              </div>
            </div>

            <div className="border border-[#211f1b]/10 bg-[#e9e2d5] p-8 sm:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#315c45]">
                Hendl-Eck
              </p>

              <div className="mt-10 space-y-8">
                <div className="border-b border-[#211f1b]/10 pb-8">
                  <p className="text-4xl font-semibold">80+</p>
                  <p className="mt-2 text-sm uppercase tracking-wider text-[#756f64]">
                    Jahre in Graz
                  </p>
                </div>

                <div className="border-b border-[#211f1b]/10 pb-8">
                  <p className="text-2xl font-semibold">
                    Traditionelle Küche
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#756f64]">
                    Österreichische Klassiker und Hendl-Spezialitäten.
                  </p>
                </div>

                <div>
                  <p className="text-2xl font-semibold">
                    Gastgarten
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#756f64]">
                    Gemütlich essen und entspannen mitten in Graz.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SPEISEKARTE */}
        <section
          id="speisekarte"
          className="bg-[#211f1b] px-6 py-24 text-[#f5f1e8] lg:px-10 lg:py-32"
        >
          <div className="mx-auto max-w-7xl">
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.3em] text-[#c9a96a]">
              Aus unserer Küche
            </p>

            <h2 className="text-4xl leading-tight sm:text-6xl">
              Unsere
              <br />
              <span className="italic text-[#c9a96a]">
                Speisekarte.
              </span>
            </h2>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/60">
              Von unseren Hendl-Spezialitäten bis zu klassischen
              österreichischen Gerichten.
            </p>

            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[
                ["01", "Hendl & Geflügel"],
                ["02", "Schnitzel & Klassiker"],
                ["03", "Suppen & Salate"],
                ["04", "Vegetarisch"],
                ["05", "Nachspeisen"],
                ["06", "Getränke"],
              ].map(([number, title]) => (
                <div
                  key={number}
                  className="border border-white/10 bg-[#2a2722] p-8 transition hover:border-[#315c45]"
                >
                  <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#c9a96a]">
                    {number}
                  </span>

                  <h3 className="mt-16 text-2xl">{title}</h3>

                  <span className="mt-5 inline-block text-sm font-semibold text-[#8fb49a]">
                    Mehr entdecken →
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TAGESEMPFEHLUNG */}
        <section
          id="tagesempfehlung"
          className="bg-[#315c45] px-6 py-24 text-white lg:px-10 lg:py-32"
        >
          <div className="mx-auto max-w-7xl">
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.3em] text-[#d8c39a]">
              Heute bei uns
            </p>

            <h2 className="text-4xl leading-tight sm:text-6xl">
              Unsere
              <br />
              <span className="italic text-[#f0dfb8]">
                Tagesempfehlung.
              </span>
            </h2>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/75">
              Entdecken Sie unsere aktuelle Empfehlung des Hauses.
            </p>

            <div className="mt-12 border border-white/15 bg-white/10 p-8 backdrop-blur-sm sm:p-10">
              <p className="text-sm uppercase tracking-[0.2em] text-[#d8c39a]">
                Aktuelle Empfehlung
              </p>

              <h3 className="mt-4 text-3xl">
                Tagesempfehlung
              </h3>

              <p className="mt-4 max-w-2xl leading-7 text-white/70">
                Die aktuelle Empfehlung wird hier angezeigt.
              </p>
            </div>
          </div>
        </section>

        {/* GASTGARTEN */}
        <section
          id="gastgarten"
          className="bg-[#e9e2d5] px-6 py-24 lg:px-10 lg:py-32"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="mb-5 text-sm font-bold uppercase tracking-[0.3em] text-[#315c45]">
                Im Sommer
              </p>

              <h2 className="text-4xl leading-tight sm:text-6xl">
                Unser
                <br />
                <span className="italic text-[#315c45]">
                  Gastgarten.
                </span>
              </h2>

              <p className="mt-8 max-w-xl text-lg leading-8 text-[#756f64]">
                Genießen Sie unsere Küche in gemütlicher Atmosphäre
                im ruhigen Innenhof.
              </p>
            </div>

            <div className="overflow-hidden">
              <img
                src="/images/Gastgarten.jpg"
                alt="Gastgarten des Hendl-Eck"
                className="h-[420px] w-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* RESERVIERUNG */}
        <section
          id="reservieren"
          className="bg-[#f5f1e8] px-6 py-24 lg:px-10 lg:py-32"
        >
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <p className="mb-5 text-sm font-bold uppercase tracking-[0.3em] text-[#315c45]">
                Tisch reservieren
              </p>

              <h2 className="text-4xl sm:text-6xl">
                Wir freuen uns
                <br />
                <span className="italic text-[#315c45]">
                  auf Ihren Besuch.
                </span>
              </h2>

              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#756f64]">
                Stellen Sie bequem Ihre Reservierungsanfrage.
              </p>
            </div>

            <ReservationWidget />
          </div>
        </section>
      </main>
    </>
  );
}