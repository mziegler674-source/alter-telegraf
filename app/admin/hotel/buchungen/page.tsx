"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  HotelMissing,
  PageIntro,
  inputClass,
} from "@/components/hotel-admin/ui";
import { BED_TYPES, BED_TYPE_LABELS } from "@/lib/hotel/availability";
import { type ApiResult, apiRequest } from "@/lib/hotel/client";
import { BOOKING_SOURCE_LABELS, OPERATOR_SOURCES } from "@/lib/hotel/constants";
import { formatMoney } from "@/lib/money";

type BookingRoom = {
  id: number;
  roomTypeId: number;
  roomId: number | null;
  bedType: string | null;
  bedTypeLabel: string | null;
  adults: number;
  children: number;
  mealPlan: string;
  /**
   * Vom Server ermittelt: Zimmer, die für den gesamten Aufenthalt geeignet
   * und frei sind. Das aktuell zugewiesene Zimmer ist enthalten.
   */
  assignableRoomIds: number[];
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
  /** Letzter Versandversuch der Bestätigungsmail, oder null. */
  confirmationMail: {
    status: string;
    recipient: string;
    error: string | null;
    attempt: number;
    createdAt: string;
  } | null;
  sourceLabel: string;
  externalChannel: string | null;
  externalRef: string | null;
  internalNote: string | null;
  /** Letzter Stand der Kanalübertragung, oder null wenn es keinen gibt. */
  channelSync: { status: string; operation: string; error: string | null } | null;
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

const MAIL_STATUS_LABELS: Record<string, string> = {
  SENT: "gesendet",
  FAILED: "fehlgeschlagen",
  SKIPPED: "nicht verschickt",
};

const SYNC_LABELS: Record<string, string> = {
  PENDING: "Übertragung ausstehend",
  IN_PROGRESS: "Übertragung läuft",
  DONE: "an den Kanal übertragen",
  FAILED: "Übertragung fehlgeschlagen",
  NEEDS_MAPPING: "Zuordnung fehlt",
  ATTENTION: "Aktion nötig",
  SKIPPED: "nicht übertragen",
};

const SYNC_TONE: Record<string, "green" | "amber" | "red" | "gray" | "neutral"> = {
  DONE: "green",
  PENDING: "amber",
  IN_PROGRESS: "amber",
  FAILED: "red",
  NEEDS_MAPPING: "red",
  ATTENTION: "red",
  SKIPPED: "gray",
};

type ErfassungForm = {
  source: string;
  externalRef: string;
  checkIn: string;
  checkOut: string;
  adults: string;
  children: string;
  breakfast: boolean;
  roomTypeId: string;
  bedType: string;
  totalAmount: string;
  note: string;
  allowOverbooking: boolean;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  countryCode: string;
};

const LEERE_ERFASSUNG: ErfassungForm = {
  source: "PHONE",
  externalRef: "",
  checkIn: "",
  checkOut: "",
  adults: "2",
  children: "0",
  breakfast: false,
  roomTypeId: "",
  bedType: "",
  totalAmount: "",
  note: "",
  allowOverbooking: false,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  street: "",
  postalCode: "",
  city: "",
  countryCode: "AT",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  );

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

type PatchResponse = {
  mail: { status: string; error: string | null; attempt: number } | null;
};

/**
 * Ergänzt die Erfolgsmeldung um den Ausgang des Mailversands. Ein
 * fehlgeschlagener Versand ändert nichts an der Buchung, der Betrieb soll es
 * aber sofort sehen.
 */
function withMailHint(response: PatchResponse, message: string) {
  const mail = response.mail;

  if (!mail || mail.status === "SENT") return message;

  if (mail.status === "SKIPPED") {
    return `${message} Hinweis: Es ist kein Mailversand eingerichtet, daher ging keine E-Mail hinaus.`;
  }

  return `${message} Achtung: Die E-Mail konnte nicht verschickt werden${
    mail.error ? ` (${mail.error})` : ""
  }. Die Buchung ist davon unberührt.`;
}

const fetchBookings = () => apiRequest<Response>("/api/admin/hotel/buchungen");

export default function BookingsAdminPage() {
  const [data, setData] = useState<Response | null>(null);
  const [hotelReady, setHotelReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [erfassung, setErfassung] = useState<ErfassungForm | null>(null);

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

  async function run(
    body: Record<string, unknown>,
    message: string | ((response: PatchResponse) => string)
  ) {
    setBusy(true);
    setError("");
    setSuccess("");

    const result = await apiRequest<PatchResponse>(
      "/api/admin/hotel/buchungen",
      "PATCH",
      body
    );

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    applyResult(await fetchBookings());
    setBusy(false);
    setSuccess(typeof message === "string" ? message : message(result.data));
  }

  const roomTypeName = (id: number) =>
    data?.roomTypes.find((type) => type.id === id)?.name ?? "–";

  const roomNumber = (id: number | null) =>
    id ? (data?.rooms.find((room) => room.id === id)?.number ?? "–") : null;

  // Die Auswahl kommt vollständig vom Server: Kategorie, Bettart,
  // Personenzahl, Belegung im gesamten Zeitraum, Sperren und Zimmerstatus
  // sind dort geprüft. Beim Speichern läuft dieselbe Prüfung erneut, eine
  // reine Filterung hier wäre also auch nicht umgehbar.
  const assignableRooms = (room: BookingRoom) =>
    (data?.rooms ?? []).filter((candidate) => room.assignableRoomIds.includes(candidate.id));

  const bookings = data?.bookings ?? [];

  async function erfassen() {
    if (!erfassung) return;

    setBusy(true);
    setError("");
    setSuccess("");

    const result = await apiRequest<{
      booking: {
        bookingNumber: string;
        totalAmount: string;
        overbooked: boolean;
        warning: string | null;
      };
    }>("/api/admin/hotel/buchungen", "POST", {
      action: "create",
      ...erfassung,
      adults: Number(erfassung.adults),
      children: Number(erfassung.children),
      roomTypeId: Number(erfassung.roomTypeId),
      guest: {
        firstName: erfassung.firstName,
        lastName: erfassung.lastName,
        email: erfassung.email,
        phone: erfassung.phone,
        street: erfassung.street,
        postalCode: erfassung.postalCode,
        city: erfassung.city,
        countryCode: erfassung.countryCode,
      },
    });

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    applyResult(await fetchBookings());
    setBusy(false);
    setErfassung(null);

    const neu = result.data.booking;

    setSuccess(
      `Buchung ${neu.bookingNumber} erfasst (${formatMoney(neu.totalAmount)}).${
        neu.warning ? ` ${neu.warning}` : ""
      }`
    );
  }

  return (
    <div>
      <PageIntro
        eyebrow="Hotel"
        title="Buchungen"
        description="Online-Buchungen sind verbindlich bestätigt, sobald sie hier erscheinen; der Gast erhält die Bestätigung automatisch per E-Mail. Telefon-, E-Mail- und Portalbuchungen erfassen Sie hier selbst. Das physische Zimmer wird hier zugewiesen."
        action={
          <Button onClick={() => setErfassung({ ...LEERE_ERFASSUNG })}>Buchung erfassen</Button>
        }
      />

      <div className="mt-8 space-y-3">
        {!loading && !hotelReady && <HotelMissing />}
        {error && <Alert kind="error">{error}</Alert>}
        {success && <Alert kind="success">✓ {success}</Alert>}
      </div>

      {erfassung && (
        <Card className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif text-2xl">Buchung erfassen</h2>
            <Button variant="ghost" small onClick={() => setErfassung(null)}>
              Abbrechen
            </Button>
          </div>

          <p className="mt-2 max-w-2xl text-sm text-[#756f64]">
            Geprüft wird mit derselben Verfügbarkeitsrechnung wie bei einer Online-Buchung. Ohne
            freies Zimmer entsteht keine Buchung – es sei denn, Sie erlauben die Überbuchung
            ausdrücklich.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Quelle" required>
              <select
                className={inputClass}
                value={erfassung.source}
                onChange={(e) => setErfassung({ ...erfassung, source: e.target.value })}
              >
                {OPERATOR_SOURCES.map((quelle) => (
                  <option key={quelle} value={quelle}>
                    {BOOKING_SOURCE_LABELS[quelle]}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Externe Referenz"
              hint="Reservierungsnummer des Portals. Verhindert Doppelerfassung."
            >
              <input
                className={inputClass}
                value={erfassung.externalRef}
                onChange={(e) => setErfassung({ ...erfassung, externalRef: e.target.value })}
              />
            </Field>

            <Field label="Zimmerart" required>
              <select
                className={inputClass}
                value={erfassung.roomTypeId}
                onChange={(e) => setErfassung({ ...erfassung, roomTypeId: e.target.value })}
              >
                <option value="">Bitte wählen</option>
                {(data?.roomTypes ?? []).map((typ) => (
                  <option key={typ.id} value={typ.id}>
                    {typ.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Anreise" required>
              <input
                className={inputClass}
                type="date"
                value={erfassung.checkIn}
                onChange={(e) => setErfassung({ ...erfassung, checkIn: e.target.value })}
              />
            </Field>

            <Field label="Abreise" required>
              <input
                className={inputClass}
                type="date"
                value={erfassung.checkOut}
                onChange={(e) => setErfassung({ ...erfassung, checkOut: e.target.value })}
              />
            </Field>

            <Field label="Bettart" hint="Leer lassen, wenn gleichgültig.">
              <select
                className={inputClass}
                value={erfassung.bedType}
                onChange={(e) => setErfassung({ ...erfassung, bedType: e.target.value })}
              >
                <option value="">Gleichgültig</option>
                {BED_TYPES.map((bett) => (
                  <option key={bett} value={bett}>
                    {BED_TYPE_LABELS[bett]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Erwachsene" required>
              <input
                className={inputClass}
                value={erfassung.adults}
                onChange={(e) => setErfassung({ ...erfassung, adults: e.target.value })}
              />
            </Field>

            <Field label="Kinder">
              <input
                className={inputClass}
                value={erfassung.children}
                onChange={(e) => setErfassung({ ...erfassung, children: e.target.value })}
              />
            </Field>

            <Field
              label="Gesamtbetrag"
              hint="Leer lassen, um aus den hinterlegten Preisen zu rechnen."
            >
              <input
                className={inputClass}
                value={erfassung.totalAmount}
                onChange={(e) => setErfassung({ ...erfassung, totalAmount: e.target.value })}
              />
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#b08a4a]"
                checked={erfassung.breakfast}
                onChange={(e) => setErfassung({ ...erfassung, breakfast: e.target.checked })}
              />
              mit Frühstück
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#b08a4a]"
                checked={erfassung.allowOverbooking}
                onChange={(e) =>
                  setErfassung({ ...erfassung, allowOverbooking: e.target.checked })
                }
              />
              Überbuchung ausdrücklich erlauben
            </label>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Vorname" required>
              <input
                className={inputClass}
                value={erfassung.firstName}
                onChange={(e) => setErfassung({ ...erfassung, firstName: e.target.value })}
              />
            </Field>

            <Field label="Nachname" required>
              <input
                className={inputClass}
                value={erfassung.lastName}
                onChange={(e) => setErfassung({ ...erfassung, lastName: e.target.value })}
              />
            </Field>

            <Field label="E-Mail">
              <input
                className={inputClass}
                value={erfassung.email}
                onChange={(e) => setErfassung({ ...erfassung, email: e.target.value })}
              />
            </Field>

            <Field label="Telefon">
              <input
                className={inputClass}
                value={erfassung.phone}
                onChange={(e) => setErfassung({ ...erfassung, phone: e.target.value })}
              />
            </Field>

            <Field label="Straße">
              <input
                className={inputClass}
                value={erfassung.street}
                onChange={(e) => setErfassung({ ...erfassung, street: e.target.value })}
              />
            </Field>

            <Field label="PLZ">
              <input
                className={inputClass}
                value={erfassung.postalCode}
                onChange={(e) => setErfassung({ ...erfassung, postalCode: e.target.value })}
              />
            </Field>

            <Field label="Ort">
              <input
                className={inputClass}
                value={erfassung.city}
                onChange={(e) => setErfassung({ ...erfassung, city: e.target.value })}
              />
            </Field>

            <Field label="Land">
              <input
                className={inputClass}
                maxLength={2}
                value={erfassung.countryCode}
                onChange={(e) =>
                  setErfassung({ ...erfassung, countryCode: e.target.value.toUpperCase() })
                }
              />
            </Field>
          </div>

          <Field label="Interne Notiz" className="mt-5">
            <input
              className={inputClass}
              value={erfassung.note}
              onChange={(e) => setErfassung({ ...erfassung, note: e.target.value })}
            />
          </Field>

          <div className="mt-6">
            <Button onClick={erfassen} disabled={busy}>
              Buchung anlegen
            </Button>
          </div>
        </Card>
      )}

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
                        {booking.source !== "WEBSITE" && (
                          <div className="mt-1 font-sans text-[10px] font-bold uppercase tracking-wide text-[#8a682d]">
                            {booking.sourceLabel}
                          </div>
                        )}
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
                        {formatMoney(booking.totalAmount)}
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
                          ["Zimmer", `${formatMoney(booking.roomsTotal)}`],
                          ["Rabatt", `− ${formatMoney(booking.discountTotal)}`],
                          ["Frühstück", `${formatMoney(booking.extrasTotal)}`],
                          ["Gesamt", `${formatMoney(booking.totalAmount)}`],
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
                                  : `${formatMoney(booking.cancellationToday.amount)}`}
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

                      {/* Stand der Kanalübertragung. Eine gespeicherte
                          Buchung und eine bestätigte Übertragung sind zwei
                          verschiedene Dinge. */}
                      {booking.channelSync && (
                        <div className="mt-4 rounded-xl border border-[#211f1b]/10 bg-white p-4 text-sm">
                          <p className="text-xs font-bold uppercase tracking-wider text-[#756f64]">
                            Vertriebskanal
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge tone={SYNC_TONE[booking.channelSync.status] ?? "neutral"}>
                              {SYNC_LABELS[booking.channelSync.status] ??
                                booking.channelSync.status}
                            </Badge>
                            <span className="font-mono text-xs text-[#756f64]">
                              {booking.channelSync.operation}
                            </span>
                          </div>

                          {booking.channelSync.error && (
                            <p className="mt-2 text-xs text-red-700">
                              {booking.channelSync.error}
                            </p>
                          )}

                          <a
                            href="/admin/hotel/kanaele"
                            className="mt-2 inline-block text-xs font-bold text-[#315c45] hover:underline"
                          >
                            Zu den Kanälen →
                          </a>
                        </div>
                      )}

                      {booking.externalRef && (
                        <div className="mt-4 rounded-xl border border-[#211f1b]/10 bg-white p-4 text-sm">
                          <p className="text-xs font-bold uppercase tracking-wider text-[#756f64]">
                            Externe Reservierung
                          </p>
                          <p className="mt-1">
                            {booking.externalChannel} ·{" "}
                            <span className="break-all font-mono text-xs">
                              {booking.externalRef}
                            </span>
                          </p>
                        </div>
                      )}

                      {booking.internalNote && (
                        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                          <p className="text-xs font-bold uppercase tracking-wider">Hinweis</p>
                          <p className="mt-1">{booking.internalNote}</p>
                        </div>
                      )}

                      {/* Versandprotokoll der Bestätigungsmail. Ein
                          Fehlschlag hat die Buchung nicht verändert. */}
                      <div className="mt-4 rounded-xl border border-[#211f1b]/10 bg-white p-4 text-sm">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#756f64]">
                          Bestätigungs-E-Mail
                        </p>

                        {booking.confirmationMail ? (
                          <>
                            <p className="mt-2 font-semibold">
                              {MAIL_STATUS_LABELS[booking.confirmationMail.status] ??
                                booking.confirmationMail.status}
                            </p>

                            <p className="mt-1 break-all text-[#756f64]">
                              {booking.confirmationMail.recipient} ·{" "}
                              {formatDateTime(booking.confirmationMail.createdAt)}
                              {booking.confirmationMail.attempt > 1
                                ? ` · ${booking.confirmationMail.attempt}. Versuch`
                                : ""}
                            </p>

                            {booking.confirmationMail.error && (
                              <p className="mt-2 text-red-700">
                                {booking.confirmationMail.error}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="mt-2 text-[#756f64]">
                            Noch keine Bestätigung verschickt.
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
                        const options = assignableRooms(room);

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
                                Kein geeignetes Zimmer verfügbar.
                              </p>
                            )}

                            {options.length > 0 && (
                              <p className="mt-2 text-xs text-[#756f64]">
                                Angezeigt werden nur Zimmer, die vom{" "}
                                {formatDate(booking.checkIn)} bis{" "}
                                {formatDate(booking.checkOut)} durchgehend frei und geeignet
                                sind.
                              </p>
                            )}
                          </div>
                        );
                      })}

                      <div className="mt-5 flex flex-wrap gap-2">
                        {booking.status === "PENDING" && (
                          <Button
                            onClick={() =>
                              run({ id: booking.id, action: "confirm" }, (response) =>
                                withMailHint(
                                  response,
                                  `Buchung ${booking.bookingNumber} ist bestätigt.`
                                )
                              )
                            }
                            disabled={busy}
                          >
                            Bestätigen
                          </Button>
                        )}

                        {booking.status !== "CANCELLED" && (
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              run(
                                { id: booking.id, action: "resendConfirmation" },
                                (response) =>
                                  withMailHint(
                                    response,
                                    `Bestätigung zu ${booking.bookingNumber} wurde erneut an ${booking.guest.email} geschickt.`
                                  )
                              )
                            }
                          >
                            Bestätigung erneut senden
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
