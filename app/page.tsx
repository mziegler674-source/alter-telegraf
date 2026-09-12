import Navbar from "@/components/Navbar";
import { db } from "@/prisma/db";
import ReservationWidget from "@/components/ReservationWidget";
import GoogleMap from "@/components/GoogleMap";

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

export default async function Home() {
  const dailyMenus = await getDailyMenus();

  return (
    <>
      <Navbar />

      <main>
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
          <div className="absolute inset-0 bg-gradient-to-r from-[#211f1b]/95 via-[#211f1b]/65 to-[#211f1b]/20" />

          <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-6 pb-20 pt-32 lg:px-10">

            <div className="max-w-3xl">

              <p className="mb-6 text-sm font-semibold uppercase tracking-[0.35em] text-[#d2ad68]">
                Seit über 80 Jahren in Graz
              </p>

              <h1 className="text-6xl leading-[0.95] text-[#f5f1e8] sm:text-7xl lg:text-8xl">
                Hendl-Eck
                <br />
                <span className="italic text-[#d2ad68]">
                  Alter Telegraf
                </span>
              </h1>

              <p className="mt-8 max-w-xl text-lg leading-8 text-white/85 sm:text-xl">
                Traditionelle Küche, ehrliche Gastfreundschaft und ein
                Stück Grazer Wirtshauskultur.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">

                <a
                  href="#reservieren"
                  className="rounded-full bg-[#b08a4a] px-7 py-4 text-center text-sm font-bold uppercase tracking-wider text-white shadow-lg transition hover:bg-[#c49b58]"
                >
                  Tisch reservieren
                </a>

                <a
                  href="#speisekarte"
                  className="rounded-full border border-white/50 bg-white/5 px-7 py-4 text-center text-sm font-bold uppercase tracking-wider text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Speisekarte ansehen
                </a>

              </div>

            </div>

          </div>

          {/* Location */}
          <div className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 md:block">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">
              Graz · Grabenstraße
            </p>
          </div>

        </section>

        {/* ÜBER UNS */}
        <section
          id="ueber-uns"
          className="bg-[#f5f1e8] px-6 py-24 lg:px-10 lg:py-32"
        >
          <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">

            {/* Text */}
            <div>
              <p className="mb-5 text-sm font-bold uppercase tracking-[0.3em] text-[#b08a4a]">
                Ein Stück Graz
              </p>

              <h2 className="max-w-2xl text-4xl leading-tight text-[#211f1b] sm:text-6xl">
                Tradition,
                <br />
                <span className="italic text-[#b08a4a]">
                  die bleibt.
                </span>
              </h2>

              <div className="mt-8 max-w-2xl space-y-5 text-lg leading-8 text-[#756f64]">
                <p>
                  Das Hendl-Eck im Alten Telegraf gehört seit über 80 Jahren
                  zur Grazer Wirtshauskultur.
                </p>

                <p>
                  Was als traditionelles Grazer Hendl-Eck bekannt wurde,
                  steht bis heute für ehrliche Küche, regionale Zutaten und
                  herzliche Gastfreundschaft.
                </p>

                <p>
                  Ob zum Mittagessen, auf ein gemütliches Abendessen oder
                  bei schönem Wetter im Gastgarten – bei uns soll man sich
                  einfach wohlfühlen.
                </p>
              </div>

              <div className="mt-10">
                <a
                  href="#reservieren"
                  className="inline-block rounded-full bg-[#211f1b] px-7 py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#3a3630]"
                >
                  Tisch reservieren
                </a>
              </div>
            </div>

            {/* Historie / Fakten */}
            <div className="relative">
              <div className="border border-[#211f1b]/10 bg-[#e9e2d5] p-8 sm:p-10">

                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#b08a4a]">
                  Auf einen Blick
                </p>

                <div className="mt-10 space-y-8">

                  <div className="border-b border-[#211f1b]/10 pb-8">
                    <p className="text-4xl font-semibold text-[#211f1b]">
                      80+
                    </p>
                    <p className="mt-2 text-sm uppercase tracking-wider text-[#756f64]">
                      Jahre Hendl-Eck in Graz
                    </p>
                  </div>

                  <div className="border-b border-[#211f1b]/10 pb-8">
                    <p className="text-2xl font-semibold text-[#211f1b]">
                      Regional & traditionell
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#756f64]">
                      Österreichische Küche mit Fokus auf bewährte Klassiker.
                    </p>
                  </div>

                  <div>
                    <p className="text-2xl font-semibold text-[#211f1b]">
                      Mitten in Graz
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#756f64]">
                      Grabenstraße 12 · 8010 Graz
                    </p>
                  </div>

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

            {/* Header */}
            <div className="max-w-3xl">
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
                Entdecken Sie unsere Küche – von unseren beliebten
                Hendl-Spezialitäten bis zu traditionellen österreichischen
                Klassikern.
              </p>
            </div>

            {/* Kategorien */}
            <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">

              {/* Hendl */}
              <a
                href="#hendl"
                className="group relative flex min-h-[260px] flex-col justify-between overflow-hidden border border-white/10 bg-[#2a2722] p-8 transition duration-300 hover:-translate-y-1 hover:border-[#c9a96a]/60"
              >
                <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#b08a4a]/10 blur-3xl transition group-hover:bg-[#b08a4a]/20" />

                <div className="relative">
                  <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#c9a96a]">
                    01
                  </span>
                </div>

                <div className="relative">
                  <h3 className="text-3xl">
                    Hendl & Geflügel
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-white/50">
                    Unsere Spezialitäten rund ums Huhn.
                  </p>

                  <span className="mt-6 inline-block text-sm font-semibold text-[#c9a96a]">
                    Karte öffnen →
                  </span>
                </div>
              </a>

              {/* Klassiker */}
              <a
                href="#klassiker"
                className="group relative flex min-h-[260px] flex-col justify-between overflow-hidden border border-white/10 bg-[#2a2722] p-8 transition duration-300 hover:-translate-y-1 hover:border-[#c9a96a]/60"
              >
                <div className="relative">
                  <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#c9a96a]">
                    02
                  </span>
                </div>

                <div className="relative">
                  <h3 className="text-3xl">
                    Schnitzel & Klassiker
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-white/50">
                    Österreichische Wirtshausklassiker.
                  </p>

                  <span className="mt-6 inline-block text-sm font-semibold text-[#c9a96a]">
                    Karte öffnen →
                  </span>
                </div>
              </a>

              {/* Suppen & Salate */}
              <a
                href="#suppen-salate"
                className="group relative flex min-h-[260px] flex-col justify-between overflow-hidden border border-white/10 bg-[#2a2722] p-8 transition duration-300 hover:-translate-y-1 hover:border-[#c9a96a]/60"
              >
                <div className="relative">
                  <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#c9a96a]">
                    03
                  </span>
                </div>

                <div className="relative">
                  <h3 className="text-3xl">
                    Suppen & Salate
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-white/50">
                    Frisch, hausgemacht und klassisch.
                  </p>

                  <span className="mt-6 inline-block text-sm font-semibold text-[#c9a96a]">
                    Karte öffnen →
                  </span>
                </div>
              </a>

              {/* Vegetarisch */}
              <a
                href="#vegetarisch"
                className="group relative flex min-h-[260px] flex-col justify-between overflow-hidden border border-white/10 bg-[#2a2722] p-8 transition duration-300 hover:-translate-y-1 hover:border-[#c9a96a]/60"
              >
                <div className="relative">
                  <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#c9a96a]">
                    04
                  </span>
                </div>

                <div className="relative">
                  <h3 className="text-3xl">
                    Vegetarisch
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-white/50">
                    Vegetarische Gerichte für jeden Geschmack.
                  </p>

                  <span className="mt-6 inline-block text-sm font-semibold text-[#c9a96a]">
                    Karte öffnen →
                  </span>
                </div>
              </a>

              {/* Nachspeisen */}
              <a
                href="#nachspeisen"
                className="group relative flex min-h-[260px] flex-col justify-between overflow-hidden border border-white/10 bg-[#2a2722] p-8 transition duration-300 hover:-translate-y-1 hover:border-[#c9a96a]/60"
              >
                <div className="relative">
                  <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#c9a96a]">
                    05
                  </span>
                </div>

                <div className="relative">
                  <h3 className="text-3xl">
                    Nachspeisen
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-white/50">
                    Strudel und süße Klassiker.
                  </p>

                  <span className="mt-6 inline-block text-sm font-semibold text-[#c9a96a]">
                    Karte öffnen →
                  </span>
                </div>
              </a>

              {/* Getränke */}
              <a
                href="#getraenke"
                className="group relative flex min-h-[260px] flex-col justify-between overflow-hidden border border-white/10 bg-[#2a2722] p-8 transition duration-300 hover:-translate-y-1 hover:border-[#c9a96a]/60"
              >
                <div className="relative">
                  <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#c9a96a]">
                    06
                  </span>
                </div>

                <div className="relative">
                  <h3 className="text-3xl">
                    Getränke
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-white/50">
                    Erfrischungen, Bier, Wein und mehr.
                  </p>

                  <span className="mt-6 inline-block text-sm font-semibold text-[#c9a96a]">
                    Karte öffnen →
                  </span>
                </div>
              </a>

            </div>

            {/* Hinweis */}
            <div className="mt-12 border-t border-white/10 pt-7">
              <p className="text-sm text-white/40">
                Die vollständige Speisekarte wird beim Öffnen der jeweiligen
                Kategorie angezeigt.
              </p>
            </div>

          </div>
        </section>

        {/* TAGESMENÜ */}
        <section
          id="tagesmenue"
          className="bg-[#e9e2d5] px-6 py-24 lg:px-10 lg:py-32"
        >
          <div className="mx-auto max-w-7xl">

            {/* Header */}
            <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-end">

              <div>
                <p className="mb-5 text-sm font-bold uppercase tracking-[0.3em] text-[#b08a4a]">
                  Heute bei uns
                </p>

                <h2 className="text-4xl leading-tight text-[#211f1b] sm:text-6xl">
                  Jeden Tag etwas
                  <br />
                  <span className="italic text-[#b08a4a]">
                    Besonderes.
                  </span>
                </h2>
              </div>

              <p className="max-w-xl text-lg leading-8 text-[#756f64] lg:justify-self-end">
                Unser Tagesmenü wechselt regelmäßig und bietet Ihnen
                abwechslungsreiche Küche zu einem fairen Preis.
              </p>

            </div>

            {/* Menu Card */}
            <div className="mt-16 overflow-hidden border border-[#211f1b]/10 bg-[#f5f1e8]">

              {/* Card Header */}
              <div className="flex flex-col gap-4 border-b border-[#211f1b]/10 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-10">

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#b08a4a]">
                    Tagesmenü
                  </p>

                  <h3 className="mt-3 text-3xl text-[#211f1b] sm:text-4xl">
                    Diese Woche bei uns
                  </h3>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-xs uppercase tracking-wider text-[#756f64]">
                    Aktualisiert
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#211f1b]">
                    Täglich
                  </p>
                </div>

              </div>

              {/* Menu Items */}
              <div className="divide-y divide-[#211f1b]/10">

                {[1, 2, 3, 4, 5].map((weekday) => {
                  const menu = dailyMenus.find(
                    (item) => item.weekday === weekday
                  );

                  return (
                    <div
                      key={weekday}
                      className="grid gap-4 p-7 sm:grid-cols-[120px_1fr_auto] sm:items-center sm:p-10"
                    >

                      {/* Wochentag */}
                      <p className="text-sm font-bold uppercase tracking-wider text-[#b08a4a]">
                        {dayNames[weekday]}
                      </p>

                      {/* Menü */}
                      <div>
                        {menu ? (
                          <>
                            <p className="text-xl font-semibold text-[#211f1b]">
                              {menu.dish}
                            </p>

                            {menu.description && (
                              <p className="mt-1 text-sm leading-6 text-[#756f64]">
                                {menu.description}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-xl font-semibold text-[#211f1b]">
                              Noch kein Menü eingetragen
                            </p>

                            <p className="mt-1 text-sm leading-6 text-[#756f64]">
                              Das Tagesmenü wird hier angezeigt, sobald es
                              veröffentlicht wurde.
                            </p>
                          </>
                        )}
                      </div>

                      {/* Preis */}
                      <p className="text-sm font-semibold text-[#211f1b]">
                        {menu ? `€ ${menu.price}` : "—"}
                      </p>

                    </div>
                  );
                })}

              </div>

            </div>

            {/* Admin Hinweis */}
            <div className="mt-8 flex flex-col gap-3 border-l-2 border-[#b08a4a] pl-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-[#756f64]">
                Das Tagesmenü wird täglich über den Verwaltungsbereich
                aktualisiert.
              </p>

              <span className="text-xs font-bold uppercase tracking-wider text-[#b08a4a]">
                Einfach · Schnell · Selbst verwalten
              </span>
            </div>

          </div>
        </section>

        {/* GASTGARTEN */}
        <section
          id="gastgarten"
          className="bg-[#f5f1e8] px-6 py-24 lg:px-10 lg:py-32"
        >
          <div className="mx-auto max-w-7xl">

            {/* Image */}
            <div className="relative h-[300px] overflow-hidden sm:h-[380px] lg:h-[500px]">
              <img
                src="/images/Gastgarten.jpg"
                alt="Gastgarten des Alten Telegrafen in Graz"
                className="h-full w-full object-cover"
              />

              {/* subtle overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

              {/* image label */}
              <div className="absolute bottom-6 left-6 sm:bottom-8 sm:left-8">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
                  Alter Telegraf · Graz
                </p>
              </div>

            </div>

            {/* Text */}
            <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:items-end">

              <div>
                <p className="mb-5 text-sm font-bold uppercase tracking-[0.3em] text-[#b08a4a]">
                  Im Grünen genießen
                </p>

                <h2 className="text-4xl leading-tight text-[#211f1b] sm:text-5xl">
                  Unser
                  <br />
                  Gastgarten
                </h2>
              </div>

              <div>
                <p className="text-lg leading-8 text-[#756f64]">
                  Genießen Sie unsere Küche in unserem gemütlichen Gastgarten
                  im ruhigen Innenhof. Zwischen viel Grün und entspannter
                  Atmosphäre wird aus einem Essen ein schöner Aufenthalt.
                </p>

                <a
                  href="#reservieren"
                  className="mt-8 inline-block rounded-full bg-[#211f1b] px-7 py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#3a3630]"
                >
                  Tisch reservieren
                </a>
              </div>

            </div>

          </div>
        </section>

        {/* RESERVIERUNG */}
        <section
          id="reservieren"
          className="bg-[#b08a4a] px-6 py-24 text-white lg:px-10 lg:py-32"
        >
          <div className="mx-auto max-w-7xl">

            <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">

              {/* TEXT */}
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/70">
                  Ihr Tisch wartet
                </p>

                <h2 className="mt-4 text-4xl leading-tight sm:text-5xl">
                  Tisch reservieren
                </h2>

                <p className="mt-6 max-w-lg text-lg leading-8 text-white/80">
                  Reservieren Sie bequem online Ihren Tisch im Alten Telegraf.
                  Wählen Sie einfach Datum, Uhrzeit und Personenanzahl.
                </p>

                <div className="mt-8 border-t border-white/20 pt-7">
                  <p className="text-sm font-semibold uppercase tracking-wider text-white/70">
                    Lieber telefonisch?
                  </p>

                  <a
                    href="tel:+43316686558"
                    className="mt-2 inline-block text-xl font-semibold transition hover:text-[#211f1b]"
                  >
                    +43 316 686558
                  </a>
                </div>
              </div>

              {/* RESMIO */}
              <div className="rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
                <ReservationWidget />
              </div>

            </div>

          </div>
        </section>

        {/* KONTAKT */}
        <section
          id="kontakt"
          className="bg-[#f5f1e8] px-6 py-24 lg:px-10 lg:py-32"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-stretch">

              {/* Kontaktinformationen */}
              <div className="flex flex-col justify-center">
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#b08a4a]">
                  So finden Sie uns
                </p>

                <h2 className="mt-4 text-4xl leading-tight text-[#211f1b] sm:text-5xl">
                  Anfahrt &<br />
                  Kontakt
                </h2>

                <p className="mt-6 max-w-md text-lg leading-8 text-[#756f64]">
                  Besuchen Sie uns in der Grazer Grabenstraße und genießen Sie
                  traditionelle Küche im Alten Telegraf.
                </p>

                <div className="mt-10 space-y-7">

                  {/* Adresse */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#b08a4a]">
                      Adresse
                    </p>

                    <p className="mt-2 text-lg font-semibold text-[#211f1b]">
                      Grabenstraße 12
                    </p>

                    <p className="text-[#756f64]">
                      8010 Graz
                    </p>
                  </div>

                  {/* Telefon */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#b08a4a]">
                      Telefon
                    </p>

                    <a
                      href="tel:+43316686558"
                      className="mt-2 inline-block text-lg font-semibold text-[#211f1b] transition hover:text-[#b08a4a]"
                    >
                      +43 316 686558
                    </a>
                  </div>

                  {/* Öffnungszeiten */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#b08a4a]">
                      Öffnungszeiten
                    </p>

                    <p className="mt-2 text-[#211f1b]">
                      Dienstag – Sonntag
                    </p>

                    <p className="text-[#756f64]">
                      10:00 – 22:00 Uhr
                    </p>

                    <p className="mt-1 text-sm text-[#756f64]">
                      Montag geschlossen
                    </p>
                  </div>

                </div>

                {/* Route */}
                <a
                  href="https://www.google.com/maps/dir/?api=1&destination=Grabenstraße+12,+8010+Graz,+Austria"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-10 inline-flex w-fit items-center rounded-full bg-[#211f1b] px-7 py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#b08a4a]"
                >
                  Route planen
                  <span className="ml-3">→</span>
                </a>
              </div>

              {/* Google Maps */}
              <div className="h-[600px] overflow-hidden rounded-2xl shadow-xl">
                <GoogleMap />
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
                  Grabenstraße 12<br />
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
                © {new Date().getFullYear()} Alter Telegraf · Konzept / Demo
              </p>
            </div>

          </div>
        </footer>

      </main>
    </>
  );
}