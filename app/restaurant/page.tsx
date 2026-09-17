import Navbar from "@/components/Navbar";
import ReservationWidget from "@/components/ReservationWidget";
import GoogleMap from "@/components/GoogleMap";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

const dayNames: Record<number, string> = {
  1: "Montag",
  2: "Dienstag",
  3: "Mittwoch",
  4: "Donnerstag",
  5: "Freitag",
};

async function getDailyMenus() {
  const restaurant = await db.orm.public.Restaurant.first({
    slug: "alter-telegraf",
  });

  if (!restaurant) {
    return [];
  }

  return db.orm.public.DailyMenu.where({
    restaurantId: restaurant.id,
    visible: true,
  }).all();
}

const menuHighlights = [
  {
    number: "01",
    title: "Hendl-Spezialitäten",
    text: "Knuspriges Hendl und ausgewählte Geflügelgerichte – das Herzstück unseres Hendl-Ecks.",
  },
  {
    number: "02",
    title: "Schnitzel & Klassiker",
    text: "Österreichische Wirtshausklassiker, die seit Generationen zum guten Essen gehören.",
  },
  {
    number: "03",
    title: "Suppen & Salate",
    text: "Frische Vorspeisen und Salate als leichter Einstieg oder Begleitung zu unseren Hauptgerichten.",
  },
  {
    number: "04",
    title: "Vegetarische Küche",
    text: "Auch ohne Fleisch finden sich bei uns abwechslungsreiche Gerichte.",
  },
  {
    number: "05",
    title: "Hausgemachtes",
    text: "Süße Klassiker und hausgemachte Strudel runden den Besuch bei uns ab.",
  },
  {
    number: "06",
    title: "Getränke",
    text: "Vom erfrischenden Getränk bis zum gemütlichen Ausklang – passend zu Ihrem Besuch.",
  },
];

export default async function RestaurantPage() {
  const dailyMenus = await getDailyMenus();

  return (
    <div className="bg-[#f5f1e8] text-[#211f1b]">
      <Navbar section="restaurant" />

      <main>
        {/* =========================================================
            HERO
        ========================================================= */}
        <section className="relative flex min-h-screen items-end overflow-hidden bg-[#211f1b]">
          <img
            src="https://www.altertelegraf.at/wp-content/uploads/2018/11/Alter-Telegraf-017-1024x682.jpg"
            alt="Hendl-Eck Alter Telegraf in Graz"
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* cinematic overlay */}
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#161410] via-[#161410]/35 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#161410]/70 via-transparent to-transparent" />

          {/* Hero content */}
          <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-16 pt-40 lg:px-10 lg:pb-20">
            <div className="max-w-4xl">
              <div className="mb-7 flex items-center gap-4">
                <span className="h-px w-12 bg-[#d8c39a]" />
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#d8c39a]">
                  Hendl-Eck · Alter Telegraf · Graz
                </p>
              </div>

              <h1 className="font-serif text-6xl leading-[0.9] tracking-[-0.03em] text-[#f7f2e8] sm:text-7xl lg:text-[8.5rem]">
                Hendl-Eck
              </h1>

              <p className="mt-5 font-serif text-3xl italic text-[#d8c39a] sm:text-4xl lg:text-5xl">
                Tradition, die man schmeckt.
              </p>

              <p className="mt-7 max-w-xl text-base leading-7 text-white/75 sm:text-lg">
                Österreichische Wirtshausküche, ehrliche Gastfreundschaft
                und mehr als 80 Jahre Hendl-Eck in Graz.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#reservieren"
                  className="group inline-flex items-center justify-center gap-3 rounded-full bg-[#315c45] px-7 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white transition duration-300 hover:bg-[#3c6d53]"
                >
                  Tisch reservieren
                  <span className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </a>

                <a
                  href="#speisekarte"
                  className="inline-flex items-center justify-center rounded-full border border-white/35 bg-white/5 px-7 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm transition duration-300 hover:border-white/60 hover:bg-white/10"
                >
                  Speisekarte entdecken
                </a>
              </div>
            </div>

            {/* Scroll indicator */}
            <a
              href="#ueber-uns"
              className="mt-16 hidden items-center gap-4 text-xs uppercase tracking-[0.25em] text-white/55 transition hover:text-white md:flex"
            >
              <span className="flex h-10 w-6 items-start justify-center rounded-full border border-white/30 p-1">
                <span className="h-2 w-px animate-pulse bg-[#d8c39a]" />
              </span>
              Entdecken
            </a>
          </div>
        </section>

        {/* =========================================================
            INTRO / STORY
        ========================================================= */}
        <section
          id="ueber-uns"
          className="relative overflow-hidden bg-[#f5f1e8] px-6 py-24 lg:px-10 lg:py-36"
        >
          <div className="pointer-events-none absolute -right-32 top-20 h-80 w-80 rounded-full border border-[#315c45]/10" />
          <div className="pointer-events-none absolute -right-20 top-32 h-56 w-56 rounded-full border border-[#315c45]/10" />

          <div className="relative mx-auto max-w-7xl">
            <div className="grid gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-24">
              <div>
                <div className="mb-7 flex items-center gap-4">
                  <span className="h-px w-12 bg-[#315c45]" />
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#315c45]">
                    Ein Stück Graz
                  </p>
                </div>

                <h2 className="font-serif text-5xl leading-[0.95] tracking-[-0.025em] sm:text-6xl lg:text-7xl">
                  Mehr als ein
                  <br />
                  <span className="italic text-[#315c45]">
                    Restaurant.
                  </span>
                </h2>

                <div className="mt-9 max-w-xl space-y-5 text-[17px] leading-8 text-[#756f64]">
                  <p>
                    Das Hendl-Eck im Alten Telegraf gehört seit über 80 Jahren
                    zur Grazer Wirtshauskultur.
                  </p>

                  <p>
                    Bei uns treffen traditionelle österreichische Küche,
                    gemütliches Ambiente und herzliche Gastfreundschaft
                    aufeinander.
                  </p>

                  <p>
                    Ob zum Mittagessen, zum Abendessen oder auf einen
                    gemütlichen Besuch im Gastgarten – bei uns soll gutes Essen
                    vor allem eines sein: unkompliziert und genussvoll.
                  </p>
                </div>

                <div className="mt-10">
                  <a
                    href="#speisekarte"
                    className="inline-flex items-center gap-3 border-b border-[#315c45] pb-2 text-sm font-bold uppercase tracking-[0.15em] text-[#315c45] transition hover:gap-5"
                  >
                    Unsere Küche
                    <span>→</span>
                  </a>
                </div>
              </div>

              {/* editorial statistic panel */}
              <div className="relative">
                <div className="absolute -left-4 -top-4 h-full w-full border border-[#315c45]/15" />

                <div className="relative bg-[#e9e2d5] p-8 sm:p-12 lg:p-14">
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#315c45]">
                    Hendl-Eck
                  </p>

                  <div className="mt-12">
                    <p className="font-serif text-8xl leading-none text-[#211f1b] sm:text-9xl">
                      80<span className="text-[#315c45]">+</span>
                    </p>

                    <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#756f64]">
                      Jahre Tradition in Graz
                    </p>
                  </div>

                  <div className="my-10 h-px bg-[#211f1b]/10" />

                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#211f1b]">
                        Küche
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#756f64]">
                        Österreichische Klassiker & Hendl
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#211f1b]">
                        Atmosphäre
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#756f64]">
                        Wirtshaus & ruhiger Gastgarten
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            IMAGE BREAK
        ========================================================= */}
        <section className="relative h-[55vh] min-h-[420px] overflow-hidden">
          <img
            src="https://www.altertelegraf.at/wp-content/uploads/2018/11/MG_3293ip-1024x681.jpg"
            alt="Alter Telegraf"
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-[#211f1b]/35" />

          <div className="relative flex h-full items-center justify-center px-6 text-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#d8c39a]">
                Gute Küche. Gute Zeit.
              </p>

              <p className="mt-5 max-w-3xl font-serif text-4xl leading-tight text-white sm:text-5xl lg:text-6xl">
                „Da, wo man gerne
                <br />
                noch ein bisschen bleibt.“
              </p>
            </div>
          </div>
        </section>

        {/* =========================================================
            SPEISEKARTE
        ========================================================= */}
        <section
          id="speisekarte"
          className="bg-[#211f1b] px-6 py-24 text-[#f5f1e8] lg:px-10 lg:py-36"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <div className="mb-7 flex items-center gap-4">
                  <span className="h-px w-12 bg-[#d8c39a]" />
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d8c39a]">
                    Aus unserer Küche
                  </p>
                </div>

                <h2 className="font-serif text-5xl leading-[0.95] sm:text-6xl lg:text-7xl">
                  Unsere
                  <br />
                  <span className="italic text-[#d8c39a]">
                    Speisekarte.
                  </span>
                </h2>

                <p className="mt-8 max-w-md text-base leading-7 text-white/55">
                  Von unseren Hendl-Spezialitäten bis zu klassischen
                  österreichischen Gerichten – unsere Küche steht für
                  vertraute Aromen und ehrliches Handwerk.
                </p>

                <a
                  href="#reservieren"
                  className="mt-9 inline-flex items-center gap-3 rounded-full border border-[#d8c39a]/50 px-6 py-3.5 text-xs font-bold uppercase tracking-[0.16em] text-[#d8c39a] transition hover:bg-[#d8c39a] hover:text-[#211f1b]"
                >
                  Tisch reservieren
                  <span>→</span>
                </a>
              </div>

              <div className="grid border-t border-white/10 sm:grid-cols-2">
                {menuHighlights.map((item) => (
                  <div
                    key={item.number}
                    className="group border-b border-white/10 p-7 transition duration-300 hover:bg-white/[0.035] sm:p-9"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-xs font-bold tracking-[0.25em] text-[#d8c39a]">
                        {item.number}
                      </span>

                      <span className="text-white/20 transition duration-300 group-hover:translate-x-1 group-hover:text-[#d8c39a]">
                        ↗
                      </span>
                    </div>

                    <h3 className="mt-14 font-serif text-2xl text-[#f5f1e8] sm:text-3xl">
                      {item.title}
                    </h3>

                    <p className="mt-4 text-sm leading-6 text-white/45">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            TAGESEMPFEHLUNG
        ========================================================= */}
        <section
          id="tagesempfehlung"
          className="relative overflow-hidden bg-[#315c45] px-6 py-24 text-white lg:px-10 lg:py-36"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full border border-white/10" />

          <div className="relative mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-24">
              <div>
                <div className="mb-7 flex items-center gap-4">
                  <span className="h-px w-12 bg-[#d8c39a]" />
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d8c39a]">
                    Heute bei uns
                  </p>
                </div>

                <h2 className="font-serif text-5xl leading-[0.95] sm:text-6xl lg:text-7xl">
                  Die
                  <br />
                  <span className="italic text-[#d8c39a]">
                    Tagesempfehlung.
                  </span>
                </h2>
              </div>

              <div>
                <p className="max-w-2xl text-lg leading-8 text-white/75">
                  Unsere aktuelle Empfehlung des Hauses finden Sie direkt bei
                  uns vor Ort.
                </p>

                <div className="mt-9 flex items-center gap-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#d8c39a]/50 text-[#d8c39a]">
                    ★
                  </div>
                  <p className="text-sm uppercase tracking-[0.14em] text-white/65">
                    Frisch & saisonal
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-16 overflow-hidden border border-white/15 bg-[#244936]/40 backdrop-blur-sm">
              <div className="divide-y divide-white/10">
                {[1, 2, 3, 4, 5].map((weekday) => {
                  const menu = dailyMenus.find(
                    (item) => item.weekday === weekday
                  );

                  return (
                    <div
                      key={weekday}
                      className="grid gap-3 p-7 sm:grid-cols-[120px_1fr_auto] sm:items-center sm:p-9"
                    >
                      {/* Wochentag */}
                      <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d8c39a]">
                        {dayNames[weekday]}
                      </p>

                      {/* Menü */}
                      <div>
                        {menu ? (
                          <>
                            <p className="font-serif text-2xl text-white">
                              {menu.dish}
                            </p>

                            {menu.description && (
                              <p className="mt-1 text-sm leading-6 text-white/55">
                                {menu.description}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="font-serif text-2xl text-white/40">
                            Noch kein Menü eingetragen
                          </p>
                        )}
                      </div>

                      {/* Preis */}
                      <p className="text-sm font-semibold text-[#d8c39a]">
                        {menu ? `€ ${menu.price}` : "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            GASTGARTEN
        ========================================================= */}
        <section
          id="gastgarten"
          className="bg-[#e9e2d5] px-6 py-24 lg:px-10 lg:py-36"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-24">
              <div className="order-2 lg:order-1">
                <div className="mb-7 flex items-center gap-4">
                  <span className="h-px w-12 bg-[#315c45]" />
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#315c45]">
                    Draußen genießen
                  </p>
                </div>

                <h2 className="font-serif text-5xl leading-[0.95] sm:text-6xl lg:text-7xl">
                  Unser
                  <br />
                  <span className="italic text-[#315c45]">
                    Gastgarten.
                  </span>
                </h2>

                <p className="mt-8 max-w-xl text-lg leading-8 text-[#756f64]">
                  Unser Gastgarten liegt ruhig im Innenhof und lädt dazu ein,
                  bei gutem Essen einfach ein wenig länger sitzen zu bleiben.
                </p>

                <div className="mt-10 grid grid-cols-2 gap-6 border-t border-[#211f1b]/10 pt-7">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315c45]">
                      Atmosphäre
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#756f64]">
                      Ruhiger Innenhof
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315c45]">
                      Perfekt für
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#756f64]">
                      Essen & gemütliches Beisammensein
                    </p>
                  </div>
                </div>
              </div>

              <div className="order-1 lg:order-2">
                <div className="relative">
                  <div className="absolute -bottom-5 -left-5 h-full w-full border border-[#315c45]/20" />

                  <div className="relative overflow-hidden">
                    <img
                      src="/images/Gastgarten.jpg"
                      alt="Gastgarten des Hendl-Eck Alter Telegraf"
                      className="h-[420px] w-full object-cover transition duration-700 hover:scale-[1.02] sm:h-[560px]"
                    />
                  </div>

                  <div className="absolute bottom-5 left-5 bg-[#f5f1e8] px-5 py-4 shadow-xl">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315c45]">
                      Alter Telegraf
                    </p>
                    <p className="mt-1 text-sm text-[#756f64]">
                      Gastgarten · Graz
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            RESERVIERUNG
        ========================================================= */}
        <section
          id="reservieren"
          className="bg-[#f5f1e8] px-6 py-24 lg:px-10 lg:py-36"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-24">
              <div>
                <div className="mb-7 flex items-center gap-4">
                  <span className="h-px w-12 bg-[#315c45]" />
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#315c45]">
                    Tisch reservieren
                  </p>
                </div>

                <h2 className="font-serif text-5xl leading-[0.95] sm:text-6xl lg:text-7xl">
                  Wir freuen uns
                  <br />
                  <span className="italic text-[#315c45]">
                    auf Sie.
                  </span>
                </h2>
              </div>

              <p className="max-w-xl text-lg leading-8 text-[#756f64]">
                Stellen Sie bequem Ihre Reservierungsanfrage. Wir freuen uns
                darauf, Sie im Hendl-Eck begrüßen zu dürfen.
              </p>
            </div>

            <div className="border border-[#211f1b]/10 bg-white/40 p-5 shadow-[0_20px_70px_rgba(33,31,27,0.06)] sm:p-8 lg:p-10">
              <ReservationWidget />
            </div>
          </div>
        </section>

        {/* =========================================================
            CONTACT / INFO
        ========================================================= */}
        <section
          id="kontakt"
          className="bg-[#211f1b] px-6 py-20 text-[#f5f1e8] lg:px-10 lg:py-28"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div className="grid gap-12 sm:grid-cols-3 sm:gap-8 lg:grid-cols-1 lg:gap-12">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d8c39a]">
                    Adresse
                  </p>

                  <p className="mt-5 font-serif text-2xl">
                    Grabenstraße 12
                  </p>

                  <p className="mt-1 text-white/45">
                    8010 Graz
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d8c39a]">
                    Öffnungszeiten
                  </p>

                  <p className="mt-5 font-serif text-2xl">
                    Dienstag – Sonntag
                  </p>

                  <p className="mt-1 text-white/45">
                    10:00 – 22:00 Uhr
                  </p>

                  <p className="mt-2 text-sm text-white/35">
                    Montag Ruhetag
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d8c39a]">
                    Kontakt
                  </p>

                  <a
                    href="tel:+43316686558"
                    className="mt-5 block font-serif text-2xl transition hover:text-[#d8c39a]"
                  >
                    +43 316 686558
                  </a>

                  <p className="mt-1 text-white/45">
                    Alter Telegraf · Graz
                  </p>
                </div>
              </div>

              {/* Google Maps */}
              <div className="h-[320px] overflow-hidden rounded-2xl sm:h-[380px] lg:h-[440px]">
                <GoogleMap />
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            FOOTER
        ========================================================= */}
        <footer className="border-t border-white/10 bg-[#211f1b] px-6 pb-10 text-white/40 lg:px-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 pt-8 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} Alter Telegraf · Hendl-Eck Graz
            </p>

            <div className="flex gap-6 uppercase tracking-[0.15em]">
              <a
                href="#ueber-uns"
                className="transition hover:text-[#d8c39a]"
              >
                Über uns
              </a>

              <a
                href="#reservieren"
                className="transition hover:text-[#d8c39a]"
              >
                Reservieren
              </a>

              <a
                href="#kontakt"
                className="transition hover:text-[#d8c39a]"
              >
                Kontakt
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}