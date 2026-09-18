"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import LogoutButton from "@/components/LogoutButton";
import { HOTEL_NAV } from "@/lib/hotel/constants";

export default function HotelAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-[#f5f1e8] text-[#211f1b]">
      <header className="bg-[#211f1b] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em]">ALTER TELEGRAF</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[#c9a96a]">
              Hotel-PMS
            </p>
          </div>

          <div className="flex items-center gap-5">
            <a href="/admin" className="text-sm text-white/60 transition hover:text-white">
              ← Dashboard
            </a>
            <LogoutButton />
          </div>
        </div>

        <nav className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 lg:px-8">
            {HOTEL_NAV.map((item) => {
              const active =
                item.href === "/admin/hotel"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm transition ${
                    active
                      ? "border-[#c9a96a] font-semibold text-white"
                      : "border-transparent text-white/60 hover:text-white"
                  }`}
                >
                  {item.label}
                  {!item.ready && (
                    <span className="ml-1.5 align-middle text-[9px] uppercase tracking-wider text-white/35">
                      bald
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14">{children}</div>
    </main>
  );
}
