"use client";

import { useState } from "react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => setIsOpen(false);

  return (
    <header className="absolute left-0 right-0 top-0 z-50">
      <div className="mx-auto max-w-7xl px-6 py-6 lg:px-10">
        <nav className="flex items-center justify-between">

          {/* Logo */}
          <a
            href="#"
            onClick={closeMenu}
            className="flex flex-col leading-none"
          >
            <span className="text-lg font-semibold tracking-[0.18em] text-white">
              ALTER TELEGRAF
            </span>

            <span className="mt-1 text-[10px] uppercase tracking-[0.35em] text-[#c9a96a]">
              Hendl-Eck · Graz
            </span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-8 md:flex">

            <a
              href="#speisekarte"
              className="text-sm font-medium text-white/75 hover:text-[#c9a96a]"
            >
              Speisekarte
            </a>

            <a
              href="#tagesmenue"
              className="text-sm font-medium text-white/75 hover:text-[#c9a96a]"
            >
              Tagesmenü
            </a>

            <a
              href="#ueber-uns"
              className="text-sm font-medium text-white/75 hover:text-[#c9a96a]"
            >
              Über uns
            </a>

            <a
              href="#gastgarten"
              className="text-sm font-medium text-white/75 hover:text-[#c9a96a]"
            >
              Gastgarten
            </a>

            <a
              href="#kontakt"
              className="text-sm font-medium text-white/75 hover:text-[#c9a96a]"
            >
              Kontakt
            </a>

            <a
              href="#reservieren"
              className="ml-2 rounded-full border border-[#c9a96a]/70 bg-[#c9a96a]/10 px-5 py-2.5 text-sm font-semibold text-white hover:border-[#c9a96a] hover:bg-[#c9a96a] hover:text-[#211f1b]"
            >
              Tisch reservieren
            </a>

          </div>

          {/* Mobile Button */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Menü öffnen"
            aria-expanded={isOpen}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 text-white hover:border-[#c9a96a] hover:text-[#c9a96a] md:hidden"
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

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#211f1b]/95 p-4 shadow-2xl backdrop-blur-md md:hidden">

            <div className="flex flex-col">

              <a
                href="#speisekarte"
                onClick={closeMenu}
                className="border-b border-white/10 px-4 py-4 text-sm font-medium text-white/80 hover:text-[#c9a96a]"
              >
                Speisekarte
              </a>

              <a
                href="#tagesmenue"
                onClick={closeMenu}
                className="border-b border-white/10 px-4 py-4 text-sm font-medium text-white/80 hover:text-[#c9a96a]"
              >
                Tagesmenü
              </a>

              <a
                href="#ueber-uns"
                onClick={closeMenu}
                className="border-b border-white/10 px-4 py-4 text-sm font-medium text-white/80 hover:text-[#c9a96a]"
              >
                Über uns
              </a>

              <a
                href="#gastgarten"
                onClick={closeMenu}
                className="border-b border-white/10 px-4 py-4 text-sm font-medium text-white/80 hover:text-[#c9a96a]"
              >
                Gastgarten
              </a>

              <a
                href="#kontakt"
                onClick={closeMenu}
                className="border-b border-white/10 px-4 py-4 text-sm font-medium text-white/80 hover:text-[#c9a96a]"
              >
                Kontakt
              </a>

              <a
                href="#reservieren"
                onClick={closeMenu}
                className="mt-4 rounded-full bg-[#b08a4a] px-5 py-4 text-center text-sm font-bold uppercase tracking-wider text-white hover:bg-[#c49b58]"
              >
                Tisch reservieren
              </a>

            </div>

          </div>
        )}

      </div>
    </header>
  );
}