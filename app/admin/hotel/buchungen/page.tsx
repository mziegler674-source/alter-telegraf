"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  EmptyState,
  HotelMissing,
  PageIntro,
  inputClass,
} from "@/components/hotel-admin/ui";
import { type ApiResult, apiRequest } from "@/lib/hotel/client";
import { formatEuro } from "@/lib/hotel/pricing";

type BookingRoom = {
  id: number;
  roomTypeId: number;
  roomId: number | null;
  bedType: string | null;
  bedTypeLabel: string | null;
  adults: number;
  children: number;
  mealPlan: string;
};

type Booking = {
  id: number;
  bookingNumber: string;
  status: string;
  source: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomsTotal: string;
  extrasTotal: string;
  discountTotal: string;
  totalAmount: string;
  paymentMethod: string;
  guestMessage: string | null;
  paymentStatus: string;
  payment: {
    provider: string | null;
    customerRef: string | null;
    methodRef: string | null;
    authorizedAt: string | null;
    chargedAt: string | null;
    depositDue: string | null;
    depositPaidAt: string | null;
  } | null;
  cancellation: { name: string; text: string[]; freeUntilDate: string | null } | null;
  cancellationToday: { free: boolean; amount: string; reason: string } | null;
  guest: { firstName: string; lastName: string; email: string; phone: string; city: string | null };
  rooms: BookingRoom[];
};

type RoomRow = {
  id: number;
  number: string;
  roomTypeId: number;
  bedType: string;
  maxOccupancy: number;
  active: boolean;
};

type Response = {
  bookings: Booking[];
  roomTypes: { id: number; code: string; name: string }[];
  rooms: RoomRow[];
};

const STATUS_LABELS: Record<string, string> = {
  INQUIRY: "Anfrage",
  PENDING: "Offen",
  CONFIRMED: "Bestätigt",
  CHECKED_IN: "Eingecheckt",
  CHECKED_OUT: "Ausgecheckt",
  CANCELLED: "Storniert",
  NO_SHOW: "Nicht erschienen",
};

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "gray" | "neutral"> = {
  PENDING: "amber",
  INQUIRY: "amber",
  CONFIRMED: "green",
  CHECKED_IN: "green",
  CHECKED_OUT: "gray",
  CANCELLED: "red",
  NO_SHOW: "red",
};

const PAYMENT_LABELS: Record<string, string> = {
  NOT_REQUIRED: "nicht erforderlich",
  PENDING: "offen",
  VERIFIED: "Karte hinterlegt",
  AUTHORIZED: "autorisiert",
  CHARGED: "belastet",
  FAILED: "fehlgeschlagen",
  CANCELLED: "aufgehoben",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  );

const fetchBookings = () => apiRequest<Response>("/api/admin/hotel/buchungen");

export default function BookingsAdminPage() {
  const [data, setData] = useState<Response | null>(null);
  const [hotelReady, setHotelReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const applyResult = useCallback((result: ApiResult<Response>) => {
    if (result.ok) {
      setData(result.data);
    } else {
      if (/Hotel-Stammdaten/.test(result.error)) setHotelReady(false);
      setError(result.error);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBookings().then(applyResult);
  }, [applyResult]);

  async function run(body: Record<string, unknown>, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");

    const result = await apiRequest("/api/admin/hotel/buchungen", "PATCH", body);

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    applyResult(await fetchBookings());
    setBusy(false);
    setSuccess(message);
  }

  const roomTypeName = (id: number) =>
    data?.roomTypes.find((type) => type.id === id)?.name ?? "–";

  const roomNumber = (id: number | null) =>
    id ? (data?.rooms.find((room) => room.id === id)?.number ?? "–") : null;

  // Zuweisbar ist nur, was Kategorie, Bettart und Personenzahl tragen kann.
  // Die endgueltige Pruefung erfolgt serverseitig.
  const assignableRooms = (booking: Booking, room: BookingRoom) =>
    (data?.rooms ?? []).filter(
      (candidate) =>
        candidate.active &&
        candidate.roomTypeId === room.roomTypeId &&
        candidate.maxOccupancy >= room.adults + room.children &&
        (!room.bedType || candidate.bedType === room.bedType)
    );

  const bookings = data?.bookings ?? [];

  return (
    <div>
      <PageIntro
        eyebrow="Hotel"
        title="Buchungen"
        description="Online-Buchungen kommen als „Offen“ herein. Nach dem Bestätigen gilt die Buchung als verbindlich. Das physische Zimmer wird hier zugewiesen."
      />

      <div className="mt-8 space-y-3">
        {!loading && !hotelReady && <HotelMissing />}
        {error && <Alert kind="error">{error}</Alert>}
        {success && <Alert kind="success">✓ {success}</Alert>}
      </div>

      <section className="mt-8">
        {loading ? (
          <EmptyState title="Wird geladen..." />
        ) : bookings.length === 0 ? (
          <EmptyState title="Noch keine Buchungen">
            Online-Buchungen über die Website erscheinen hier automatisch.
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#211f1b]/10 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-[#e9e2d5] text-xs uppercase tracking-wider text-[#756f64]">
                  <tr>
                    <th className="px-4 py-3">Nummer</th>
                    <th className="px-4 py-3">Gast</th>
                    <th className="px-4 py-3">Anreise</th>
                    <th className="px-4 py-3">Abreise</th>
                    <th className="px-4 py-3">Pers.</th>
                    <th className="px-4 py-3">Zimmerart</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Gesamt</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#211f1b]/10">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className={booking.status === "CANCELLED" ? "text-[#756f64]" : ""}>
                      <td className="px-4 py-4 font-mono text-xs font-semibold">
                        {booking.bookingNumber}
                      </td>
                      <td className="px-4 py-4">
                        {booking.guest.firstName} {booking.guest.lastName}
                      </td>
                      <td className="px-4 py-4">{formatDate(booking.checkIn)}</td>
                      <td className="px-4 py-4">{formatDate(booking.checkOut)}</td>
                      <td className="px-4 py-4">
                        {booking.adults + booking.children}
                      </td>
                      <td className="px-4 py-4">
                        {booking.rooms.map((room) => (
                          <div key={room.id}>
                            {roomTypeName(room.roomTypeId)}
                            {room.roomId && (
                              <span className="ml-1 text-xs text-[#315c45]">
                                → Zi. {roomNumber(room.roomId)}
                              </span>
                            )}
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={STATUS_TONE[booking.status] ?? "neutral"}>
                          {STATUS_LABELS[booking.status] ?? booking.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold">
                        {formatEuro(booking.totalAmount)} €
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          small
                          variant="secondary"
                          onClick={() => setOpenId(openId === booking.id ? null : booking.id)}
                        >
                          {openId === booking.id ? "Schließen" : "Öffnen"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {bookings
              .filter((booking) => booking.id === openId)
              .map((booking) => (
                <div key={booking.id} className="border-t border-[#211f1b]/10 bg-[#f5f1e8] p-6">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <h3 className="font-serif text-xl">Buchung {booking.bookingNumber}</h3>

                      <dl className="mt-4 space-y-2 text-sm">
                        {[
                          ["Gast", `${booking.guest.firstName} ${booking.guest.lastName}`],
                          ["E-Mail", booking.guest.email],
                          ["Telefon", booking.guest.phone],
                          ["Quelle", booking.source],
                          ["Zahlung", booking.paymentMethod === "PAY_AT_HOTEL" ? "vor Ort im Hotel" : booking.paymentMethod],
                          ["Zimmer", `${formatEuro(booking.roomsTotal)} €`],
                          ["Rabatt", `− ${formatEuro(booking.discountTotal)} €`],
                          ["Frühstück", `${formatEuro(booking.extrasTotal)} €`],
                          ["Gesamt", `${formatEuro(booking.totalAmount)} €`],
                        ].map(([label, value]) => (
                          <div key={label} className="flex justify-between gap-6">
                            <dt className="text-[#756f64]">{label}</dt>
                            <dd className="text-right font-semibold">{value}</dd>
                          </div>
                        ))}
                      </dl>

                      {/* Zahlungsangaben. Es werden ausschließlich
                          Referenzen des Anbieters angezeigt - niemals
                          Kartennummer, Prüfziffer oder Ablaufdatum. */}
                      {booking.paymentMethod === "CARD_GUARANTEE" && (
                        <div className="mt-4 rounded-xl border border-[#211f1b]/10 bg-white p-4 text-sm">
                          <p className="text-xs font-bold uppercase tracking-wider text-[#756f64]">
                            Kreditkartengarantie
                          </p>

                          <dl className="mt-2 space-y-1">
                            {[
                              ["Zahlungsart", "Kreditkarte als Garantie"],
                              ["Status", PAYMENT_LABELS[booking.paymentStatus] ?? booking.paymentStatus],
                              ["Anbieter", booking.payment?.provider ?? "–"],
                              ["Kundenreferenz", booking.payment?.customerRef ?? "–"],
                              ["Kartenreferenz", booking.payment?.methodRef ?? "–"],
                              [
                                "Karte hinterlegt",
                                booking.payment?.authorizedAt
                                  ? formatDate(booking.payment.authorizedAt.slice(0, 10))
                                  : "–",
                              ],
                              [
                                "Belastet",
                                booking.payment?.chargedAt
                                  ? formatDate(booking.payment.chargedAt.slice(0, 10))
                                  : "nein",
                              ],
                            ].map(([label, value]) => (
                              <div key={label} className="flex justify-between gap-6">
                                <dt className="text-[#756f64]">{label}</dt>
                                <dd className="break-all text-right font-mono text-xs">{value}</dd>
                              </div>
                            ))}
                          </dl>

                          <p className="mt-3 text-xs text-[#756f64]">
                            Kartennummer, Prüfziffer und Ablaufdatum werden nicht gespeichert.
                          </p>
                        </div>
                      )}

                      {/* Der eingefrorene Stand dieser Buchung, nicht die
                          aktuell aktive Hotelrichtlinie. */}
                      <div className="mt-4 rounded-xl border border-[#211f1b]/10 bg-white p-4 text-sm">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#756f64]">
                          Stornobedingungen dieser Buchung
                        </p>

                        {booking.cancellation ? (
                          <>
                            <ul className="mt-2 space-y-1 leading-6">
                              {booking.cancellation.text.map((zeile) => (
                                <li key={zeile}>{zeile}</li>
                              ))}
                            </ul>

                            {booking.cancellation.freeUntilDate && (
                              <p className="mt-2 text-[#756f64]">
                                Kostenfrei bis einschließlich{" "}
                                {formatDate(booking.cancellation.freeUntilDate)}.
                              </p>
                            )}

                            {booking.cancellationToday && booking.status !== "CANCELLED" && (
                              <p
                                className={`mt-3 font-semibold ${
                                  booking.cancellationToday.free ? "text-[#315c45]" : "text-red-700"
                                }`}
                              >
                                Stornierung heute:{" "}
                                {booking.cancellationToday.free
                                  ? "kostenfrei"
                                  : `${formatEuro(booking.cancellationToday.amount)} €`}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="mt-2 text-[#756f64]">
                            Für diese Buchung wurden keine Bedingungen gespeichert. Sie stammt
                            aus der Zeit vor der Einführung der Stornobedingungen.
                          </p>
                        )}
                      </div>

                      {booking.guestMessage && (
                        <div className="mt-4 rounded-xl border border-[#211f1b]/10 bg-white p-4 text-sm">
                          <p className="text-xs font-bold uppercase tracking-wider text-[#756f64]">
                            Bemerkung des Gastes
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">{booking.guestMessage}</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#756f64]">
                        Zimmerzuweisung
                      </p>

                      {booking.rooms.map((room) => {
                        const options = assignableRooms(booking, room);

                        return (
                          <div
                            key={room.id}
                            className="mt-3 rounded-xl border border-[#211f1b]/10 bg-white p-4"
                          >
                            <p className="font-semibold">{roomTypeName(room.roomTypeId)}</p>
                            <p className="mt-1 text-sm text-[#756f64]">
                              {room.adults + room.children}{" "}
                              {room.adults + room.children === 1 ? "Person" : "Personen"}
                              {room.bedTypeLabel ? ` · ${room.bedTypeLabel}` : ""}
                            </p>

                            <select
                              value={room.roomId ?? ""}
                              disabled={busy || booking.status === "CANCELLED"}
                              onChange={(e) =>
                                run(
                                  {
                                    id: booking.id,
                                    action: "assignRoom",
                                    bookingRoomId: room.id,
                                    roomId: e.target.value === "" ? null : Number(e.target.value),
                                  },
                                  e.target.value === ""
                                    ? "Zimmerzuweisung entfernt."
                                    : "Zimmer wurde zugewiesen."
                                )
                              }
                              className={inputClass}
                            >
                              <option value="">Noch nicht zugewiesen</option>
                              {options.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  Zimmer {candidate.number} (max. {candidate.maxOccupancy})
                                </option>
                              ))}
                            </select>

                            {options.length === 0 && (
                              <p className="mt-2 text-sm text-red-700">
                                Kein passendes Zimmer vorhanden.
                              </p>
                            )}
                          </div>
                        );
                      })}

                      <div className="mt-5 flex flex-wrap gap-2">
                        {booking.status === "PENDING" && (
                          <Button
                            onClick={() =>
                              run(
                                { id: booking.id, action: "confirm" },
                                `Buchung ${booking.bookingNumber} ist bestätigt.`
                              )
                            }
                            disabled={busy}
                          >
                            Bestätigen
                          </Button>
                        )}

                        {booking.status !== "CANCELLED" && (
                          <Button
                            variant="danger"
                            disabled={busy}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Buchung ${booking.bookingNumber} wirklich stornieren?`
                                )
                              ) {
                                return;
                              }

                              run(
                                { id: booking.id, action: "cancel" },
                                `Buchung ${booking.bookingNumber} wurde storniert.`
                              );
                            }}
                          >
                            Stornieren
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
