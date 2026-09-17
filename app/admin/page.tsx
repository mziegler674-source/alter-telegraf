"use client";

import { useEffect, useMemo, useState } from "react";

type Reservation = {
  id: number;
  firstName: string;
  lastName: string;
  reservationDate: string;
  reservationTime: string;
  guests: number;
  status: "NEW" | "CONFIRMED" | "REJECTED" | "COMPLETED";
};

function getDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getReservationDateString(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return getDateString(date);
}

export default function AdminDashboard() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadReservations() {
    try {
      setLoading(true);

      const response = await fetch("/api/admin/reservations", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Reservierungen konnten nicht geladen werden.");
      }

      const data = await response.json();

      setReservations(data.reservations || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReservations();
  }, []);

  const today = useMemo(() => {
    return getDateString(new Date());
  }, []);

  const todayReservations = reservations.filter(
    (reservation) =>
      getReservationDateString(reservation.reservationDate) === today
  );

  const newReservations = reservations.filter(
    (reservation) => reservation.status === "NEW"
  );

  return (
    <main className="min-h-screen bg-[#f3eee4] text-[#211f1b]">
      {/* TOP BAR */}
      <header className="border-b border-[#211f1b]/10 bg-[#211f1b] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#d8c39a]">
              Alter Telegraf
            </p>

            <h1 className="mt-1 font-serif text-2xl">
              Verwaltungsportal
            </h1>
          </div>

          <a
            href="/"
            className="rounded-full border border-white/20 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/80 transition hover:border-[#d8c39a] hover:text-[#d8c39a]"
          >
            Website ansehen →
          </a>
        </div>
      </header>

      {/* CONTENT */}
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
        {/* WELCOME */}
        <div className="mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#315c45]">
            Dashboard
          </p>

          <h2 className="mt-3 font-serif text-5xl leading-none sm:text-6xl">
            Willkommen zurück.
          </h2>

          <p className="mt-5 max-w-2xl text-base leading-7 text-[#756f64]">
            Verwalten Sie Reservierungen und die Inhalte des Alten Telegraf
            zentral über dieses Portal.
          </p>
        </div>

        {/* STATS */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border border-[#211f1b]/10 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#756f64]">
              Heute
            </p>

            <p className="mt-4 font-serif text-5xl">
              {loading ? "–" : todayReservations.length}
            </p>

            <p className="mt-2 text-sm text-[#756f64]">
              Reservierungen
            </p>
          </div>

          <div className="border border-[#211f1b]/10 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#756f64]">
              Offen
            </p>

            <p className="mt-4 font-serif text-5xl text-[#315c45]">
              {loading ? "–" : newReservations.length}
            </p>

            <p className="mt-2 text-sm text-[#756f64]">
              Neue Anfragen
            </p>
          </div>

          <div className="border border-[#211f1b]/10 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#756f64]">
              Gesamt
            </p>

            <p className="mt-4 font-serif text-5xl">
              {loading ? "–" : reservations.length}
            </p>

            <p className="mt-2 text-sm text-[#756f64]">
              Reservierungen
            </p>
          </div>

          <div className="border border-[#211f1b]/10 bg-[#315c45] p-6 text-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d8c39a]">
              Status
            </p>

            <p className="mt-4 font-serif text-3xl">
              Alles bereit
            </p>

            <p className="mt-2 text-sm text-white/65">
              Verwaltungssystem aktiv
            </p>
          </div>
        </div>

        {/* MAIN MODULES */}
        <div className="mt-10">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#756f64]">
              Verwaltung
            </p>

            <h3 className="mt-2 font-serif text-3xl">
              Inhalte & Reservierungen
            </h3>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* RESERVATIONS */}
            <a
              href="/admin/reservations"
              className="group relative overflow-hidden border border-[#211f1b]/10 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full bg-[#315c45]/10 transition duration-500 group-hover:scale-150" />

              <div className="relative">
                <div className="flex items-start justify-between">
                  <div className="flex h-14 w-14 items-center justify-center bg-[#315c45] text-2xl text-white">
                    📅
                  </div>

                  <span className="text-xl text-[#315c45] transition group-hover:translate-x-1">
                    →
                  </span>
                </div>

                <p className="mt-10 text-xs font-bold uppercase tracking-[0.25em] text-[#315c45]">
                  Restaurant
                </p>

                <h4 className="mt-2 font-serif text-4xl">
                  Reservierungen
                </h4>

                <p className="mt-4 max-w-md text-sm leading-7 text-[#756f64]">
                  Tischreservierungen ansehen, bestätigen, ablehnen oder
                  erledigen.
                </p>

                <div className="mt-7 flex items-center gap-3">
                  <span className="rounded-full bg-[#f4ead5] px-3 py-1 text-xs font-bold text-[#8a682d]">
                    {loading ? "…" : `${newReservations.length} neu`}
                  </span>

                  <span className="text-sm font-semibold text-[#315c45]">
                    Verwaltung öffnen
                  </span>
                </div>
              </div>
            </a>

            {/* DAILY RECOMMENDATION */}
            <a
              href="/admin/tagesmenue"
              className="group relative overflow-hidden border border-[#211f1b]/10 bg-[#e9e2d5] p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full border border-[#315c45]/10 transition duration-500 group-hover:scale-125" />

              <div className="relative">
                <div className="flex items-start justify-between">
                  <div className="flex h-14 w-14 items-center justify-center bg-[#211f1b] text-2xl text-white">
                    🍽️
                  </div>

                  <span className="text-xl text-[#315c45] transition group-hover:translate-x-1">
                    →
                  </span>
                </div>

                <p className="mt-10 text-xs font-bold uppercase tracking-[0.25em] text-[#315c45]">
                  Restaurant
                </p>

                <h4 className="mt-2 font-serif text-4xl">
                  Tagesempfehlung
                </h4>

                <p className="mt-4 max-w-md text-sm leading-7 text-[#756f64]">
                  Tagesgerichte für die einzelnen Wochentage bearbeiten,
                  Preise festlegen und die Anzeige auf der Website steuern.
                </p>

                <div className="mt-7">
                  <span className="text-sm font-semibold text-[#315c45]">
                    Tagesempfehlung verwalten →
                  </span>
                </div>
              </div>
            </a>

            {/* WEBSITE */}
            <a
              href="/restaurant"
              className="group border border-[#211f1b]/10 bg-[#211f1b] p-8 text-white shadow-sm transition duration-300 hover:-translate-y-1 hover:bg-[#292721] lg:col-span-2"
            >
              <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d8c39a]">
                    Vorschau
                  </p>

                  <h4 className="mt-2 font-serif text-4xl">
                    Restaurant-Website
                  </h4>

                  <p className="mt-4 max-w-xl text-sm leading-7 text-white/55">
                    Öffentliche Restaurantseite ansehen und Änderungen
                    kontrollieren.
                  </p>
                </div>

                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#d8c39a]/40 text-xl text-[#d8c39a] transition group-hover:translate-x-1">
                  →
                </span>
              </div>
            </a>
          </div>
        </div>

        {/* TODAY */}
        <section className="mt-14 border-t border-[#211f1b]/10 pt-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#756f64]">
                Heute
              </p>

              <h3 className="mt-2 font-serif text-3xl">
                Kommende Reservierungen
              </h3>
            </div>

            <a
              href="/admin/reservations"
              className="text-sm font-bold text-[#315c45] hover:underline"
            >
              Alle Reservierungen →
            </a>
          </div>

          <div className="mt-6 overflow-hidden border border-[#211f1b]/10 bg-white shadow-sm">
            {loading ? (
              <div className="p-8 text-center text-sm text-[#756f64]">
                Reservierungen werden geladen...
              </div>
            ) : todayReservations.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-serif text-2xl">
                  Heute keine Reservierungen
                </p>

                <p className="mt-2 text-sm text-[#756f64]">
                  Für heute sind aktuell keine Tischreservierungen
                  eingegangen.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#211f1b]/10">
                {todayReservations
                  .sort((a, b) =>
                    a.reservationTime.localeCompare(
                      b.reservationTime
                    )
                  )
                  .slice(0, 5)
                  .map((reservation) => (
                    <div
                      key={reservation.id}
                      className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-5">
                        <div className="min-w-[70px]">
                          <p className="font-serif text-2xl">
                            {reservation.reservationTime}
                          </p>
                        </div>

                        <div>
                          <p className="font-semibold">
                            {reservation.firstName}{" "}
                            {reservation.lastName}
                          </p>

                          <p className="mt-1 text-sm text-[#756f64]">
                            {reservation.guests}{" "}
                            {reservation.guests === 1
                              ? "Person"
                              : "Personen"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                          reservation.status === "NEW"
                            ? "bg-[#f4ead5] text-[#8a682d]"
                            : reservation.status === "CONFIRMED"
                              ? "bg-green-100 text-green-700"
                              : reservation.status === "REJECTED"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {reservation.status === "NEW"
                          ? "Neu"
                          : reservation.status === "CONFIRMED"
                            ? "Bestätigt"
                            : reservation.status === "REJECTED"
                              ? "Abgelehnt"
                              : "Erledigt"}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}