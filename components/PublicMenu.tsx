import "server-only";

import type { ReactNode } from "react";

import Navbar from "@/components/Navbar";
import { DeliveryButtons } from "@/components/DeliveryLinks";
import { type MenuKind } from "@/lib/menu/constants";
import { formatMoney } from "@/lib/money";
import { db } from "@/prisma/db";

async function getItems(menu: MenuKind) {
  const restaurant = await db.orm.public.Restaurant.first({ slug: "alter-telegraf" });

  if (!restaurant) return [];

  return db.orm.public.MenuItem
    .where({ restaurantId: restaurant.id, menu, active: true })
    .orderBy([(m) => m.sortOrder.asc(), (m) => m.name.asc()])
    .all();
}

export default async function PublicMenu({
  menu,
  eyebrow,
  title,
  titleAccent,
  intro,
  note,
  footer,
}: {
  menu: MenuKind;
  eyebrow: string;
  title: string;
  titleAccent: string;
  intro: string;
  note?: string;
  footer?: ReactNode;
}) {
  const items = await getItems(menu);

  return (
    <div className="bg-[#f5f1e8] text-[#211f1b]">
      <Navbar section="restaurant" />

      <main>
        <section className="px-6 pb-16 pt-36 lg:px-10 lg:pb-20 lg:pt-44">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center gap-4">
              <span className="h-px w-12 bg-[#b08a4a]" />
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#b08a4a]">
                {eyebrow}
              </p>
            </div>

            <h1 className="mt-7 font-serif text-5xl leading-[0.95] sm:text-6xl">
              {title}
              <br />
              <span className="italic text-[#b08a4a]">{titleAccent}</span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-7 text-[#756f64]">{intro}</p>

            {note && (
              <p className="mt-4 max-w-xl text-sm leading-6 text-[#756f64]/80">{note}</p>
            )}
          </div>
        </section>

        <section className="px-6 pb-24 lg:px-10 lg:pb-32">
          <div className="mx-auto max-w-3xl">
            {items.length === 0 ? (
              <p className="border-t border-[#211f1b]/10 pt-10 text-[#756f64]">
                Die Karte wird gerade überarbeitet. Rufen Sie uns gerne an:{" "}
                <a href="tel:+43316686558" className="underline underline-offset-4">
                  +43 316 686558
                </a>
                .
              </p>
            ) : (
              <ul className="border-t border-[#211f1b]/10">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-baseline justify-between gap-6 border-b border-[#211f1b]/10 py-7"
                  >
                    <div className="min-w-0">
                      <h2 className="text-base font-bold uppercase tracking-[0.12em]">
                        {item.name}
                      </h2>

                      {item.description && (
                        <p className="mt-2 text-sm leading-6 text-[#756f64]">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <p className="shrink-0 font-serif text-xl tabular-nums">
                      {formatMoney(item.price)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {footer}

        <footer className="border-t border-[#211f1b]/10 px-6 py-14 lg:px-10">
          <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold tracking-[0.14em]">ALTER TELEGRAF · HENDL-ECK</p>
              <p className="mt-1 text-sm text-[#756f64]">
                Grabenstraße 12 · 8010 Graz ·{" "}
                <a href="tel:+43316686558" className="underline underline-offset-4">
                  +43 316 686558
                </a>
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b08a4a]">
                Online bestellen
              </p>

              <div className="mt-3">
                <DeliveryButtons dark={false} />
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
