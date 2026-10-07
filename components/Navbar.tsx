"use client";

import { useState } from "react";

type NavbarProps = {
  section?: "home" | "restaurant" | "hotel";
  /**
   * "hell" für Seiten mit dunklem Hero hinter der Navigation,
   * "dunkel" für Seiten mit hellem Hintergrund.
   */
  tone?: "hell" | "dunkel";
};

// Farbwerte nach WCAG gegen den hellen Seitenhintergrund #f5f1e8 geprüft:
// #211f1b erreicht 14.59:1, #315c45 als Hover 6.78:1. Beides erfüllt AA.
const TONE = {
  hell: {
    logo: "text-white",
    sub: "text-[#d8c39a]",
    link: "text-white/85 hover:text-[#d8c39a]",
    button: "border-white/30 text-white hover:border-[#d8c39a] hover:text-[#d8c39a]",
  },
  dunkel: {
    logo: "text-[#211f1b]",
    sub: "text-[#315c45]",
    link: "text-[#211f1b] hover:text-[#315c45]",
    button: "border-[#211f1b]/30 text-[#211f1b] hover:border-[#315c45] hover:text-[#315c45]",
  },
} as const;

export default function Navbar({ section = "home", tone = "hell" }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const farbe = TONE[tone];

  const closeMenu = () => setIsOpen(false);

  const restaurantLinks = [
    { label: "Unsere Karten", href: "/restaurant#speisekarte" },
    { label: "Gästeverkauf", href: "/restaurant/gaesteverkauf" },
    {
      label: "Tagesempfehlung",
      href: "/restaurant#tagesempfehlung",
    },
    { label: "Gastgarten", href: "/restaurant#gastgarten" },
  ];

  const hotelLinks = [
    { label: "Zimmer", href: "/hotel#zimmer" },
    { label: "Übernachten", href: "/hotel#uebernachten" },
    { label: "Ausstattung", href: "/hotel#ausstattung" },
    { label: "Kontakt", href: "/hotel#kontakt" },
  ];

  const links =
    section === "restaurant"
      ? restaurantLinks
      : section === "hotel"
        ? hotelLinks
        : [];

  const isHome = section === "home";

  return (
    <header className="absolute left-0 right-0 top-0 z-50">
      <div className="mx-auto max-w-7xl px-6 py-5 lg:px-10">
        <nav className="flex items-center justify-between">
          {/* LOGO */}
          <a
            href="/"
            onClick={closeMenu}
            className="flex flex-col leading-none"
          >
            <span className={`text-lg font-semibold tracking-[0.18em] ${farbe.logo}`}>
              ALTER TELEGRAF
            </span>

            <span className={`mt-1 text-[10px] uppercase tracking-[0.35em] ${farbe.sub}`}>
              Graz · Grabenstraße
            </span>
          </a>

          {/* DESKTOP NAVIGATION */}
          <div className="hidden items-center gap-7 md:flex">
            {isHome ? (
              <>
                <a
                  href="/restaurant"
                  className={`text-sm font-medium transition ${farbe.link}`}
                >
                  Hendl-Eck
                </a>

                <a
                  href="/hotel"
                  className={`text-sm font-medium transition ${farbe.link}`}
                >
                  Hotel
                </a>
              </>
            ) : (
              <>
                {links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className={`text-sm font-medium transition ${farbe.link}`}
                  >
                    {link.label}
                  </a>
                ))}

                {section === "restaurant" && (
                  <a
                    href="/restaurant#reservieren"
                    className="ml-2 rounded-full bg-[#315c45] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#264936]"
                  >
                    Tisch reservieren
                  </a>
                )}

                {section === "hotel" && (
                  <a
                    href="/hotel/buchen"
                    className="ml-2 rounded-full bg-[#315c45] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#264936]"
                  >
                    Zimmer buchen
                  </a>
                )}
              </>
            )}
          </div>

          {/* MOBILE BUTTON */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Menü öffnen"
            aria-expanded={isOpen}
            className={`flex h-11 w-11 items-center justify-center rounded-full border transition md:hidden ${farbe.button}`}
          >
            <div className="flex flex-col gap-1.5">
              <span
                className={`block h-px w-5 bg-current transition ${
                  isOpen ? "translate-y-[4px] rotate-45" : ""
                }`}
              />

              <span
                className={`block h-px w-5 bg-current transition ${
                  isOpen ? "opacity-0" : ""
                }`}
              />

              <span
                className={`block h-px w-5 bg-current transition ${
                  isOpen ? "-translate-y-[4px] -rotate-45" : ""
                }`}
              />
            </div>
          </button>
        </nav>

        {/* MOBILE NAVIGATION */}
        {isOpen && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#211f1b]/95 p-4 shadow-2xl backdrop-blur-md md:hidden">
            <div className="flex flex-col">
              {isHome ? (
                <>
                  <a
                    href="/restaurant"
                    onClick={closeMenu}
                    className="border-b border-white/10 px-4 py-4 text-sm font-medium text-white/85"
                  >
                    Hendl-Eck
                  </a>

                  <a
                    href="/hotel"
                    onClick={closeMenu}
                    className="px-4 py-4 text-sm font-medium text-white/85"
                  >
                    Hotel Alter Telegraf
                  </a>
                </>
              ) : (
                <>
                  {links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={closeMenu}
                      className="border-b border-white/10 px-4 py-4 text-sm font-medium text-white/85"
                    >
                      {link.label}
                    </a>
                  ))}

                  {section === "restaurant" && (
                    <a
                      href="/restaurant#reservieren"
                      onClick={closeMenu}
                      className="mt-4 rounded-full bg-[#315c45] px-5 py-4 text-center text-sm font-bold uppercase tracking-wider text-white"
                    >
                      Tisch reservieren
                    </a>
                  )}

                  {section === "hotel" && (
                    <a
                      href="/hotel/buchen"
                      onClick={closeMenu}
                      className="mt-4 rounded-full bg-[#315c45] px-5 py-4 text-center text-sm font-bold uppercase tracking-wider text-white"
                    >
                      Zimmer buchen
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}