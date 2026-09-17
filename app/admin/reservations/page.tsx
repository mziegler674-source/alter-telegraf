"use client";

import { useEffect, useMemo, useState } from "react";

type ReservationStatus =
    | "NEW"
    | "CONFIRMED"
    | "REJECTED"
    | "COMPLETED";

type Reservation = {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    reservationDate: string;
    reservationTime: string;
    guests: number;
    message: string | null;
    status: ReservationStatus;
    createdAt: string;
};

type Filter = "TODAY" | "TOMORROW" | "WEEK" | "ALL";

const statusLabels: Record<ReservationStatus, string> = {
    NEW: "Neu",
    CONFIRMED: "Bestätigt",
    REJECTED: "Abgelehnt",
    COMPLETED: "Erledigt",
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

function formatDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat("de-AT", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
}

function getStartOfWeek(date: Date) {
    const result = new Date(date);
    const day = result.getDay();

    // Montag = 0, Sonntag = 6
    const mondayOffset = day === 0 ? -6 : 1 - day;

    result.setDate(result.getDate() + mondayOffset);
    result.setHours(0, 0, 0, 0);

    return result;
}

function getEndOfWeek(date: Date) {
    const result = getStartOfWeek(date);

    result.setDate(result.getDate() + 6);
    result.setHours(23, 59, 59, 999);

    return result;
}

export default function ReservationsPage() {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [filter, setFilter] = useState<Filter>("TODAY");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    async function loadReservations() {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(
                "/api/admin/reservations",
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Die Reservierungen konnten nicht geladen werden."
                );
            }

            setReservations(data.reservations || []);
        } catch (err) {
            console.error(err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Die Reservierungen konnten nicht geladen werden."
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadReservations();
    }, []);

    async function updateStatus(
        id: number,
        status: ReservationStatus
    ) {
        try {
            setUpdatingId(id);
            setError("");

            const response = await fetch(
                "/api/admin/reservations",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        id,
                        status,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Der Status konnte nicht geändert werden."
                );
            }

            setReservations((current) =>
                current.map((reservation) =>
                    reservation.id === id
                        ? {
                            ...reservation,
                            status,
                        }
                        : reservation
                )
            );
        } catch (err) {
            console.error(err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Der Status konnte nicht geändert werden."
            );
        } finally {
            setUpdatingId(null);
        }
    }

    async function deleteReservation(id: number) {
        const reservation = reservations.find(
            (item) => item.id === id
        );

        const reservationName = reservation
            ? `${reservation.firstName} ${reservation.lastName}`
            : "diese Reservierung";

        const confirmed = window.confirm(
            `Möchten Sie die Reservierung von ${reservationName} wirklich löschen?\n\n` +
            "Die Reservierung wird dauerhaft aus der Datenbank entfernt."
        );

        if (!confirmed) {
            return;
        }

        try {
            setDeletingId(id);
            setError("");

            const response = await fetch(
                "/api/admin/reservations",
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        id,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Die Reservierung konnte nicht gelöscht werden."
                );
            }

            setReservations((current) =>
                current.filter(
                    (reservation) => reservation.id !== id
                )
            );
        } catch (err) {
            console.error(err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Die Reservierung konnte nicht gelöscht werden."
            );
        } finally {
            setDeletingId(null);
        }
    }

    const filteredReservations = useMemo(() => {
        const now = new Date();

        const today = getDateString(now);

        const tomorrowDate = new Date(now);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);

        const tomorrow = getDateString(tomorrowDate);

        const weekStart = getStartOfWeek(now);
        const weekEnd = getEndOfWeek(now);

        return reservations
            .filter((reservation) => {
                const reservationDate =
                    getReservationDateString(
                        reservation.reservationDate
                    );

                if (filter === "TODAY") {
                    return reservationDate === today;
                }

                if (filter === "TOMORROW") {
                    return reservationDate === tomorrow;
                }

                if (filter === "WEEK") {
                    const date = new Date(
                        `${reservationDate}T12:00:00`
                    );

                    return (
                        date >= weekStart &&
                        date <= weekEnd
                    );
                }

                return true;
            })
            .sort((a, b) => {
                const dateA =
                    getReservationDateString(
                        a.reservationDate
                    );

                const dateB =
                    getReservationDateString(
                        b.reservationDate
                    );

                if (dateA !== dateB) {
                    return dateA.localeCompare(dateB);
                }

                return a.reservationTime.localeCompare(
                    b.reservationTime
                );
            });
    }, [reservations, filter]);

    const newReservationsCount = reservations.filter(
        (reservation) => reservation.status === "NEW"
    ).length;

    return (
        <main className="min-h-screen bg-[#f5f1e8] px-6 py-10 text-[#211f1b]">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <a
                            href="/admin"
                            className="mb-4 inline-block text-sm font-semibold text-[#756f64] transition hover:text-[#b08a4a]"
                        >
                            ← Zurück zum Dashboard
                        </a>

                        <h1 className="text-4xl font-bold tracking-tight">
                            Reservierungen
                        </h1>

                        <p className="mt-2 text-[#756f64]">
                            Eingegangene Tischreservierungen ansehen
                            und verwalten.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-[#211f1b]/10 bg-white px-5 py-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#756f64]">
                                Neue Reservierungen
                            </p>

                            <p className="mt-1 text-2xl font-bold text-[#b08a4a]">
                                {newReservationsCount}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={loadReservations}
                            disabled={loading}
                            className="rounded-full border border-[#211f1b]/15 bg-white px-5 py-3 text-sm font-bold transition hover:border-[#b08a4a] hover:text-[#b08a4a] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading
                                ? "Laden..."
                                : "Aktualisieren"}
                        </button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* Filter */}
                <div className="mb-8 flex flex-wrap gap-2">
                    {[
                        {
                            value: "TODAY" as Filter,
                            label: "Heute",
                        },
                        {
                            value: "TOMORROW" as Filter,
                            label: "Morgen",
                        },
                        {
                            value: "WEEK" as Filter,
                            label: "Diese Woche",
                        },
                        {
                            value: "ALL" as Filter,
                            label: "Alle",
                        },
                    ].map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() =>
                                setFilter(item.value)
                            }
                            className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${filter === item.value
                                    ? "bg-[#211f1b] text-white"
                                    : "border border-[#211f1b]/10 bg-white text-[#211f1b] hover:border-[#b08a4a] hover:text-[#b08a4a]"
                                }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {/* Loading */}
                {loading && (
                    <div className="rounded-2xl border border-[#211f1b]/10 bg-white p-10 text-center shadow-sm">
                        <p className="text-sm text-[#756f64]">
                            Reservierungen werden geladen...
                        </p>
                    </div>
                )}

                {/* Empty */}
                {!loading &&
                    filteredReservations.length === 0 && (
                        <div className="rounded-2xl border border-[#211f1b]/10 bg-white p-12 text-center shadow-sm">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e9e2d5] text-2xl">
                                📅
                            </div>

                            <h2 className="mt-5 text-2xl font-bold">
                                Keine Reservierungen
                            </h2>

                            <p className="mt-2 text-sm text-[#756f64]">
                                Für den ausgewählten Zeitraum
                                wurden keine Reservierungen
                                gefunden.
                            </p>
                        </div>
                    )}

                {/* Reservation list */}
                {!loading &&
                    filteredReservations.length > 0 && (
                        <div className="space-y-5">
                            {filteredReservations.map(
                                (reservation) => (
                                    <article
                                        key={reservation.id}
                                        className="rounded-2xl border border-[#211f1b]/10 bg-white p-6 shadow-sm"
                                    >
                                        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                                            {/* Main information */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <div>
                                                        <h2 className="text-2xl font-bold">
                                                            {
                                                                reservation.firstName
                                                            }{" "}
                                                            {
                                                                reservation.lastName
                                                            }
                                                        </h2>
                                                    </div>

                                                    <span
                                                        className={`rounded-full px-3 py-1 text-xs font-bold ${reservation.status ===
                                                                "NEW"
                                                                ? "bg-[#f4ead5] text-[#8a682d]"
                                                                : reservation.status ===
                                                                    "CONFIRMED"
                                                                    ? "bg-green-100 text-green-700"
                                                                    : reservation.status ===
                                                                        "REJECTED"
                                                                        ? "bg-red-100 text-red-700"
                                                                        : "bg-gray-100 text-gray-600"
                                                            }`}
                                                    >
                                                        {
                                                            statusLabels[
                                                            reservation
                                                                .status
                                                            ]
                                                        }
                                                    </span>
                                                </div>

                                                {/* Date / time / guests */}
                                                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                                    <div className="rounded-xl bg-[#f5f1e8] p-4">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-[#756f64]">
                                                            Datum
                                                        </p>

                                                        <p className="mt-1 font-bold capitalize">
                                                            {formatDate(
                                                                reservation.reservationDate
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-xl bg-[#f5f1e8] p-4">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-[#756f64]">
                                                            Uhrzeit
                                                        </p>

                                                        <p className="mt-1 text-lg font-bold">
                                                            {
                                                                reservation.reservationTime
                                                            }{" "}
                                                            Uhr
                                                        </p>
                                                    </div>

                                                    <div className="rounded-xl bg-[#f5f1e8] p-4">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-[#756f64]">
                                                            Personen
                                                        </p>

                                                        <p className="mt-1 text-lg font-bold">
                                                            {
                                                                reservation.guests
                                                            }
                                                            {" "}
                                                            {reservation.guests ===
                                                                1
                                                                ? "Person"
                                                                : "Personen"}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Contact */}
                                                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                                    <a
                                                        href={`tel:${reservation.phone}`}
                                                        className="rounded-xl border border-[#211f1b]/10 px-4 py-3 transition hover:border-[#b08a4a] hover:bg-[#f5f1e8]"
                                                    >
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-[#756f64]">
                                                            Telefon
                                                        </p>

                                                        <p className="mt-1 font-semibold">
                                                            {
                                                                reservation.phone
                                                            }
                                                        </p>
                                                    </a>

                                                    <a
                                                        href={`mailto:${reservation.email}`}
                                                        className="rounded-xl border border-[#211f1b]/10 px-4 py-3 transition hover:border-[#b08a4a] hover:bg-[#f5f1e8]"
                                                    >
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-[#756f64]">
                                                            E-Mail
                                                        </p>

                                                        <p className="mt-1 break-all font-semibold">
                                                            {
                                                                reservation.email
                                                            }
                                                        </p>
                                                    </a>
                                                </div>

                                                {/* Message */}
                                                {reservation.message && (
                                                    <div className="mt-5 rounded-xl bg-[#f5f1e8] p-4">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-[#756f64]">
                                                            Nachricht
                                                        </p>

                                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                                                            {
                                                                reservation.message
                                                            }
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex w-full flex-col gap-3 lg:w-56">
                                                <div>
                                                    <label
                                                        htmlFor={`status-${reservation.id}`}
                                                        className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#756f64]"
                                                    >
                                                        Status
                                                    </label>

                                                    <select
                                                        id={`status-${reservation.id}`}
                                                        value={
                                                            reservation.status
                                                        }
                                                        onChange={(event) =>
                                                            updateStatus(
                                                                reservation.id,
                                                                event
                                                                    .target
                                                                    .value as ReservationStatus
                                                            )
                                                        }
                                                        disabled={
                                                            updatingId ===
                                                            reservation.id ||
                                                            deletingId ===
                                                            reservation.id
                                                        }
                                                        className="w-full rounded-xl border border-[#211f1b]/15 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-[#b08a4a] disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <option value="NEW">
                                                            Neu
                                                        </option>

                                                        <option value="CONFIRMED">
                                                            Bestätigt
                                                        </option>

                                                        <option value="REJECTED">
                                                            Abgelehnt
                                                        </option>

                                                        <option value="COMPLETED">
                                                            Erledigt
                                                        </option>
                                                    </select>

                                                    {updatingId ===
                                                        reservation.id && (
                                                            <p className="mt-2 text-xs text-[#756f64]">
                                                                Status wird
                                                                gespeichert...
                                                            </p>
                                                        )}
                                                </div>

                                                <div className="h-px bg-[#211f1b]/10" />

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        deleteReservation(
                                                            reservation.id
                                                        )
                                                    }
                                                    disabled={
                                                        deletingId ===
                                                        reservation.id ||
                                                        updatingId ===
                                                        reservation.id
                                                    }
                                                    className="rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {deletingId ===
                                                        reservation.id
                                                        ? "Löschen..."
                                                        : "Reservierung löschen"}
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                )
                            )}
                        </div>
                    )}
            </div>
        </main>
    );
}