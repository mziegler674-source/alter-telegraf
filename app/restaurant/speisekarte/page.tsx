import type { Metadata } from "next";

import PublicMenu from "@/components/PublicMenu";

export const metadata: Metadata = {
  title: "Speisekarte · Hendl-Eck Graz",
  description:
    "Die Speisekarte des Hendl-Eck im Alten Telegraf, Grabenstraße 12 in Graz.",
};

// Der Betreiber pflegt die Karte im Admin - Aenderungen muessen sofort
// sichtbar sein, deshalb kein statisches Vorrendern beim Build.
export const dynamic = "force-dynamic";

export default function SpeisekartePage() {
  return (
    <PublicMenu
      menu="SPEISEKARTE"
      eyebrow="Aus unserer Küche"
      title="Unsere"
      titleAccent="Speisekarte."
      intro="Frisch zubereitet in unserer Küche mitten in Graz. Unsere Speisen gibt es auch zum Mitnehmen."
      footer={
        <section className="border-t border-[#211f1b]/10 px-6 py-16 lg:px-10">
          <div className="mx-auto flex max-w-3xl flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[#756f64]">Unsere Speisen auch zum Mitnehmen.</p>
            <a
              href="/restaurant/gaesteverkauf"
              className="rounded-full bg-[#211f1b] px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#3a3630]"
            >
              Gästeverkauf ansehen
            </a>
          </div>
        </section>
      }
    />
  );
}
