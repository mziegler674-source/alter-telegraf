import type { Metadata } from "next";

import DeliveryLinks from "@/components/DeliveryLinks";
import PublicMenu from "@/components/PublicMenu";

export const metadata: Metadata = {
  title: "Gästeverkauf · Hendl-Eck Graz",
  description:
    "Frisch gekochte Speisen vom Hendl-Eck im Alten Telegraf in Graz – zum Abholen und über unsere Lieferpartner bestellen.",
};

export const dynamic = "force-dynamic";

export default function GaesteverkaufPage() {
  return (
    <main className="min-h-screen bg-[#f5f1e8] text-[#211f1b]">
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#315c45]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(216,195,154,0.18),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(0,0,0,0.18),transparent_40%)]" />

        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-12 sm:px-8 lg:px-12 lg:pb-28 lg:pt-20">
          {/* Breadcrumb / small label */}
          <div className="mb-10 flex items-center gap-3 text-sm font-medium tracking-[0.18em] text-[#d8c39a] uppercase">
            <span className="h-px w-8 bg-[#d8c39a]" />
            Hendl-Eck · Alter Telegraf
          </div>

          <div className="max-w-4xl">
            <p className="mb-5 text-sm font-semibold tracking-[0.22em] text-[#d8c39a] uppercase">
              Frisch gekocht · direkt zum Mitnehmen
            </p>

            <h1 className="text-5xl font-semibold leading-[0.95] tracking-[-0.04em] text-[#f5f1e8] sm:text-6xl lg:text-8xl">
              Gäste
              <span className="block text-[#d8c39a]">verkauf.</span>
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-[#f5f1e8]/85 sm:text-xl">
              Unsere Küche gibt es nicht nur bei uns im Wirtshaus. Viele
              unserer Speisen können Sie auch bequem mitnehmen und zu Hause
              genießen – frisch zubereitet und direkt aus dem Hendl-Eck.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a
                href="#speisekarte"
                className="inline-flex items-center justify-center rounded-full bg-[#d8c39a] px-7 py-4 text-sm font-semibold text-[#211f1b] transition hover:-translate-y-0.5 hover:bg-[#eadbbd]"
              >
                Gästeverkauf entdecken
                <span className="ml-3 text-lg">↓</span>
              </a>

              <a
                href="tel:+43316686558"
                className="inline-flex items-center justify-center rounded-full border border-[#f5f1e8]/30 px-7 py-4 text-sm font-semibold text-[#f5f1e8] transition hover:border-[#d8c39a] hover:text-[#d8c39a]"
              >
                Telefonisch vorbestellen
              </a>
            </div>
          </div>

          {/* Highlight strip */}
          <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-[#f5f1e8]/10 bg-[#f5f1e8]/10 sm:grid-cols-3">
            <div className="bg-[#264936]/80 px-6 py-6">
              <p className="text-xs font-semibold tracking-[0.18em] text-[#d8c39a] uppercase">
                Frisch
              </p>
              <p className="mt-2 text-base text-[#f5f1e8]">
                Frisch zubereitete Speisen aus unserer Küche.
              </p>
            </div>

            <div className="bg-[#264936]/80 px-6 py-6">
              <p className="text-xs font-semibold tracking-[0.18em] text-[#d8c39a] uppercase">
                Abholung
              </p>
              <p className="mt-2 text-base text-[#f5f1e8]">
                In der Grabenstraße 12 in Graz abholen.
              </p>
            </div>

            <div className="bg-[#264936]/80 px-6 py-6">
              <p className="text-xs font-semibold tracking-[0.18em] text-[#d8c39a] uppercase">
                Zuhause genießen
              </p>
              <p className="mt-2 text-base text-[#f5f1e8]">
                Oder bequem über unsere Lieferpartner bestellen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* INTRO */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-[#315c45] uppercase">
              Aus unserer Küche
            </p>

            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
              Wirtshausküche,
              <span className="block text-[#315c45]">
                die auch zu Hause schmeckt.
              </span>
            </h2>
          </div>

          <div className="max-w-2xl text-base leading-8 text-[#756f64] sm:text-lg">
            <p>
              Wer nicht bei uns im Alten Telegraf Platz nehmen kann, muss
              trotzdem nicht auf unsere Küche verzichten. Im Gästeverkauf
              finden Sie ausgewählte Speisen, die Sie direkt bei uns abholen
              können.
            </p>

            <p className="mt-5">
              Damit es unkompliziert bleibt, können Sie Ihre Bestellung
              telefonisch vorbestellen und anschließend bei uns in der
              Grabenstraße 12 abholen.
            </p>

            <p className="mt-5">
              Wer lieber liefern lässt, findet unsere Küche außerdem bei
              ausgewählten Lieferdiensten.
            </p>
          </div>
        </div>
      </section>

      {/* MENU */}
      <section
        id="speisekarte"
        className="border-y border-[#211f1b]/10 bg-[#ebe5d9]"
      >
        <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="mb-12 max-w-2xl">
            <p className="text-sm font-semibold tracking-[0.2em] text-[#315c45] uppercase">
              Zum Mitnehmen
            </p>

            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
              Unsere Auswahl
            </h2>

            <p className="mt-5 text-base leading-7 text-[#756f64] sm:text-lg">
              Die aktuelle Auswahl unseres Gästeverkaufs. Preise und Gerichte
              werden laufend von unserem Team aktualisiert.
            </p>
          </div>

          {/* Existing dynamic menu */}
          <PublicMenu
            menu="GAESTEVERKAUF"
            eyebrow=""
            title=""
            titleAccent=""
            intro=""
            note=""
          />
        </div>
      </section>

      {/* PICKUP */}
      <section className="bg-[#f5f1e8]">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="overflow-hidden rounded-3xl bg-[#211f1b]">
            <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
              <div className="p-8 sm:p-12 lg:p-16">
                <p className="text-sm font-semibold tracking-[0.2em] text-[#d8c39a] uppercase">
                  Abholung in Graz
                </p>

                <h2 className="mt-4 max-w-xl text-4xl font-semibold leading-tight tracking-[-0.035em] text-[#f5f1e8] sm:text-5xl">
                  Bestellen, abholen,
                  <span className="block text-[#d8c39a]">
                    genießen.
                  </span>
                </h2>

                <p className="mt-6 max-w-xl text-base leading-8 text-[#f5f1e8]/70 sm:text-lg">
                  Sie möchten Wartezeit vermeiden? Rufen Sie uns kurz an und
                  geben Sie Ihre Bestellung telefonisch durch. Anschließend
                  können Sie Ihre Speisen direkt bei uns abholen.
                </p>

                <div className="mt-8">
                  <a
                    href="tel:+43316686558"
                    className="inline-flex items-center rounded-full bg-[#d8c39a] px-7 py-4 text-sm font-semibold text-[#211f1b] transition hover:-translate-y-0.5 hover:bg-[#eadbbd]"
                  >
                    +43 316 686558
                  </a>
                </div>
              </div>

              <div className="flex items-center border-t border-[#f5f1e8]/10 bg-[#264936] p-8 sm:p-12 lg:border-l lg:border-t-0 lg:p-16">
                <div>
                  <p className="text-sm font-semibold tracking-[0.2em] text-[#d8c39a] uppercase">
                    Abholadresse
                  </p>

                  <p className="mt-4 text-2xl font-semibold text-[#f5f1e8]">
                    Alter Telegraf
                  </p>

                  <p className="mt-2 leading-7 text-[#f5f1e8]/70">
                    Grabenstraße 12
                    <br />
                    8010 Graz
                  </p>

                  <a
                    href="https://www.google.com/maps/search/?api=1&query=Alter+Telegraf+Grabenstra%C3%9Fe+12+8010+Graz"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 inline-flex text-sm font-semibold text-[#d8c39a] underline decoration-[#d8c39a]/40 underline-offset-4 transition hover:text-[#f5f1e8]"
                  >
                    Route anzeigen →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DELIVERY */}
      <section className="bg-[#315c45]">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-[#d8c39a] uppercase">
                Keine Zeit für die Abholung?
              </p>

              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.035em] text-[#f5f1e8] sm:text-5xl">
                Dann kommt das
                <span className="block text-[#d8c39a]">
                  Hendl-Eck zu Ihnen.
                </span>
              </h2>

              <p className="mt-6 max-w-xl text-base leading-8 text-[#f5f1e8]/75 sm:text-lg">
                Unsere Speisen können Sie auch bequem über unsere
                Lieferpartner bestellen. Einfach auswählen, online bestellen
                und zu Hause genießen.
              </p>
            </div>

            <div className="rounded-3xl bg-[#f5f1e8] p-6 shadow-2xl sm:p-8">
              <div className="mb-6">
                <p className="text-xs font-semibold tracking-[0.18em] text-[#315c45] uppercase">
                  Online bestellen
                </p>

                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#211f1b]">
                  Unsere Lieferpartner
                </h3>
              </div>

              <DeliveryLinks dark={false} />
            </div>
          </div>
        </div>
      </section>

      {/* BRAND / STORY */}
      <section className="bg-[#f5f1e8]">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold tracking-[0.2em] text-[#315c45] uppercase">
              Alter Telegraf · Hendl-Eck
            </p>

            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
              Gute Küche muss nicht kompliziert sein.
            </h2>

            <p className="mt-6 text-base leading-8 text-[#756f64] sm:text-lg">
              Als Familienbetrieb mitten in Graz verbinden wir traditionelle
              Wirtshausküche mit frischen Zutaten und echtem Handwerk. Mit dem
              Gästeverkauf möchten wir Ihnen diese Küche auch dann anbieten,
              wenn Sie gerade nicht bei uns im Gastgarten oder im Wirtshaus
              Platz nehmen können.
            </p>

            <div className="mt-10">
              <a
                href="/restaurant"
                className="inline-flex items-center rounded-full border border-[#315c45]/25 px-7 py-4 text-sm font-semibold text-[#315c45] transition hover:border-[#315c45] hover:bg-[#315c45] hover:text-[#f5f1e8]"
              >
                Zum Hendl-Eck
                <span className="ml-3">→</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-[#211f1b]/10 bg-[#ebe5d9]">
        <div className="mx-auto max-w-7xl px-6 py-16 text-center sm:px-8 lg:px-12 lg:py-20">
          <p className="text-sm font-semibold tracking-[0.2em] text-[#315c45] uppercase">
            Hendl-Eck Graz
          </p>

          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Heute schon entschieden, was auf den Tisch kommt?
          </h2>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="#speisekarte"
              className="inline-flex items-center justify-center rounded-full bg-[#315c45] px-7 py-4 text-sm font-semibold text-[#f5f1e8] transition hover:bg-[#264936]"
            >
              Gästeverkauf ansehen
            </a>

            <a
              href="tel:+43316686558"
              className="inline-flex items-center justify-center rounded-full border border-[#211f1b]/20 px-7 py-4 text-sm font-semibold text-[#211f1b] transition hover:border-[#315c45] hover:text-[#315c45]"
            >
              Vorbestellen
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}