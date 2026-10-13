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
import { type ApiResult, apiRequest, toFormValue } from "@/lib/hotel/client";
import { formatMoney } from "@/lib/money";

// Gästestammdaten.
//
// Der Gast ist der dauerhafte Datensatz, die Buchung der Vorgang. Hier
// werden ausschließlich Stammdaten bearbeitet; Buchungssummen und
// eingefrorene Vertragsdaten bleiben unberührt.

type GuestRow = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  countryCode: string | null;
  hasNotes: boolean;
  duplicateOf: number[] | null;
  bookings: number;
  stays: number;
  cancelled: number;
  noShows: number;
  revenue: string;
  lastStay: string | null;
  nextStay: string | null;
};

type Stay = {
  bookingId: number;
  bookingNumber: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  totalAmount: string;
  currency: string;
  roomTypeName: string | null;
  bedTypeLabel: string | null;
  roomNumber: string | null;
};

type GuestDetail = GuestRow & {
  street: string | null;
  postalCode: string | null;
  birthDate: string | null;
  nationality: string | null;
  idDocumentType: string | null;
  idDocumentNo: string | null;
  notes: string | null;
  createdAt: string;
  stayList: Stay[];
};

type ListResponse = {
  guests: GuestRow[];
  page: number;
  pages: number;
  total: number;
  totalAll: number;
  duplicates: number;
  today: string;
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

const SORTS = [
  { value: "name", label: "Name" },
  { value: "lastStay", label: "Letzter Aufenthalt" },
  { value: "bookings", label: "Anzahl Buchungen" },
  { value: "created", label: "Neu angelegt" },
];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`)
  );

type FormState = {
  id: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  countryCode: string;
  birthDate: string;
  nationality: string;
  idDocumentType: string;
  idDocumentNo: string;
  notes: string;
};

const LEERES_FORMULAR: FormState = {
  id: null,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  street: "",
  postalCode: "",
  city: "",
  countryCode: "AT",
  birthDate: "",
  nationality: "",
  idDocumentType: "",
  idDocumentNo: "",
  notes: "",
};

export default function GaestePage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [detail, setDetail] = useState<GuestDetail | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [hotelReady, setHotelReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [suche, setSuche] = useState("");
  const [sort, setSort] = useState("name");
  const [seite, setSeite] = useState(1);
  const [nurMitBuchung, setNurMitBuchung] = useState(false);
  const [nurDubletten, setNurDubletten] = useState(false);

  // Abfrage und Auswertung getrennt: So wird der Zustand erst im
  // then-Zweig gesetzt, nicht im Effekt selbst.
  const abfragen = useCallback(() => {
    const params = new URLSearchParams({ q: suche, sort, page: String(seite) });

    if (nurMitBuchung) params.set("withBookings", "true");
    if (nurDubletten) params.set("duplicates", "true");

    return apiRequest<ListResponse>(`/api/admin/hotel/gaeste?${params.toString()}`);
  }, [suche, sort, seite, nurMitBuchung, nurDubletten]);

  const anwenden = useCallback((result: ApiResult<ListResponse>) => {
    if (result.ok) {
      setData(result.data);
      setError("");
    } else {
      if (/Hotel-Stammdaten/.test(result.error)) setHotelReady(false);
      setError(result.error);
    }

    setLoading(false);
  }, []);

  const laden = useCallback(() => abfragen().then(anwenden), [abfragen, anwenden]);

  useEffect(() => {
    abfragen().then(anwenden);
  }, [abfragen, anwenden]);

  async function oeffnen(id: number) {
    setBusy(true);
    setError("");

    const result = await apiRequest<{ guest: GuestDetail }>(
      `/api/admin/hotel/gaeste?id=${id}`
    );

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setDetail(result.data.guest);
    setForm(null);
  }

  function bearbeiten(gast: GuestDetail) {
    setForm({
      id: gast.id,
      firstName: gast.firstName,
      lastName: gast.lastName,
      email: toFormValue(gast.email),
      phone: toFormValue(gast.phone),
      street: toFormValue(gast.street),
      postalCode: toFormValue(gast.postalCode),
      city: toFormValue(gast.city),
      countryCode: toFormValue(gast.countryCode) || "AT",
      birthDate: toFormValue(gast.birthDate),
      nationality: toFormValue(gast.nationality),
      idDocumentType: toFormValue(gast.idDocumentType),
      idDocumentNo: toFormValue(gast.idDocumentNo),
      notes: toFormValue(gast.notes),
    });
  }

  async function speichern(force = false) {
    if (!form) return;

    setBusy(true);
    setError("");
    setSuccess("");

    const koerper = { ...form, force };

    const result = form.id
      ? await apiRequest("/api/admin/hotel/gaeste", "PATCH", koerper)
      : await apiRequest<{ id: number }>("/api/admin/hotel/gaeste", "POST", koerper);

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess(form.id ? "Die Stammdaten wurden gespeichert." : "Der Gast wurde angelegt.");

    const id = form.id ?? (result.data as { id: number }).id;

    setForm(null);
    await laden();
    await oeffnen(id);
  }

  const gaeste = data?.guests ?? [];

  return (
    <div>
      <PageIntro
        eyebrow="Hotel"
        title="Gäste"
        description="Stammdaten der Gäste mit allen Aufenthalten. Eine Änderung hier wirkt nur auf die Stammdaten – gespeicherte Buchungen behalten ihre ursprünglichen Daten."
        action={
          <Button
            onClick={() => {
              setForm({ ...LEERES_FORMULAR });
              setDetail(null);
            }}
          >
            Gast anlegen
          </Button>
        }
      />

      <div className="mt-8 space-y-3">
        {!loading && !hotelReady && <HotelMissing />}
        {error && <Alert kind="error">{error}</Alert>}
        {success && <Alert kind="success">✓ {success}</Alert>}
      </div>

      {form && (
        <Card className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif text-2xl">
              {form.id ? "Stammdaten bearbeiten" : "Neuen Gast anlegen"}
            </h2>
            <Button variant="ghost" small onClick={() => setForm(null)}>
              Abbrechen
            </Button>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="Vorname" required>
              <input
                className={inputClass}
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </Field>

            <Field label="Nachname" required>
              <input
                className={inputClass}
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </Field>

            <Field label="E-Mail" hint="Dient auch der Erkennung von Dubletten.">
              <input
                className={inputClass}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>

            <Field label="Telefon">
              <input
                className={inputClass}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>

            <Field label="Straße" className="sm:col-span-2">
              <input
                className={inputClass}
                value={form.street}
                onChange={(e) => setForm({ ...form, street: e.target.value })}
              />
            </Field>

            <Field label="PLZ">
              <input
                className={inputClass}
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              />
            </Field>

            <Field label="Ort">
              <input
                className={inputClass}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </Field>

            <Field label="Land" hint="Zweistelliger Ländercode, z. B. AT.">
              <input
                className={inputClass}
                maxLength={2}
                value={form.countryCode}
                onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })}
              />
            </Field>
          </div>

          <div className="mt-8 rounded-xl border border-[#211f1b]/10 bg-[#f5f1e8] p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#756f64]">
              Meldedaten – freiwillig
            </p>
            <p className="mt-2 text-sm text-[#756f64]">
              Diese Felder bleiben leer, solange sie nicht erhoben werden. Ein rechtlich
              geprüftes Gästeblatt nach Meldegesetz ist damit noch nicht umgesetzt.
            </p>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Geburtsdatum">
                <input
                  className={inputClass}
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                />
              </Field>

              <Field label="Staatsangehörigkeit">
                <input
                  className={inputClass}
                  value={form.nationality}
                  onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                />
              </Field>

              <Field label="Ausweisart">
                <input
                  className={inputClass}
                  value={form.idDocumentType}
                  onChange={(e) => setForm({ ...form, idDocumentType: e.target.value })}
                />
              </Field>

              <Field label="Ausweisnummer">
                <input
                  className={inputClass}
                  value={form.idDocumentNo}
                  onChange={(e) => setForm({ ...form, idDocumentNo: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <Field label="Interne Notiz" className="mt-6" hint="Nur für den Betrieb sichtbar.">
            <textarea
              className={inputClass}
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => speichern(false)} disabled={busy}>
              {form.id ? "Speichern" : "Anlegen"}
            </Button>

            {!form.id && (
              <Button variant="secondary" disabled={busy} onClick={() => speichern(true)}>
                Trotz Dublette anlegen
              </Button>
            )}
          </div>
        </Card>
      )}

      <Card className="mt-8">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="Suche" hint="Name, E-Mail, Telefon oder Buchungsnummer.">
            <input
              className={inputClass}
              value={suche}
              placeholder="z. B. Gruber, AT-2026-…"
              onChange={(e) => {
                setSeite(1);
                setSuche(e.target.value);
              }}
            />
          </Field>

          <Field label="Sortierung">
            <select
              className={inputClass}
              value={sort}
              onChange={(e) => {
                setSeite(1);
                setSort(e.target.value);
              }}
            >
              {SORTS.map((eintrag) => (
                <option key={eintrag.value} value={eintrag.value}>
                  {eintrag.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#b08a4a]"
              checked={nurMitBuchung}
              onChange={(e) => {
                setSeite(1);
                setNurMitBuchung(e.target.checked);
              }}
            />
            Nur Gäste mit Buchung
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#b08a4a]"
              checked={nurDubletten}
              onChange={(e) => {
                setSeite(1);
                setNurDubletten(e.target.checked);
              }}
            />
            Nur mögliche Dubletten
            {data && data.duplicates > 0 && (
              <Badge tone="amber">{data.duplicates}</Badge>
            )}
          </label>

          {data && (
            <span className="text-[#756f64]">
              {data.total} von {data.totalAll} Gästen
            </span>
          )}
        </div>
      </Card>

      <section className="mt-8">
        {loading ? (
          <EmptyState title="Wird geladen..." />
        ) : gaeste.length === 0 ? (
          <EmptyState title="Keine Gäste gefunden">
            Gäste entstehen automatisch mit der ersten Buchung oder lassen sich hier anlegen.
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#211f1b]/10 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[#e9e2d5] text-xs uppercase tracking-wider text-[#756f64]">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Kontakt</th>
                    <th className="px-4 py-3">Ort</th>
                    <th className="px-4 py-3 text-right">Buchungen</th>
                    <th className="px-4 py-3">Letzter Aufenthalt</th>
                    <th className="px-4 py-3 text-right">Umsatz</th>
                    <th className="px-4 py-3">Hinweise</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#211f1b]/10">
                  {gaeste.map((gast) => (
                    <tr key={gast.id}>
                      <td className="px-4 py-4 font-mono text-xs text-[#756f64]">{gast.id}</td>
                      <td className="px-4 py-4 font-semibold">
                        {gast.lastName}, {gast.firstName}
                      </td>
                      <td className="px-4 py-4">
                        <div className="break-all">{gast.email ?? "–"}</div>
                        <div className="text-xs text-[#756f64]">{gast.phone ?? "–"}</div>
                      </td>
                      <td className="px-4 py-4">
                        {gast.city ?? "–"}
                        {gast.countryCode ? ` (${gast.countryCode})` : ""}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {gast.bookings}
                        {gast.cancelled + gast.noShows > 0 && (
                          <span className="ml-1 text-xs text-[#756f64]">
                            ({gast.cancelled + gast.noShows} storniert)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {gast.lastStay ? formatDate(gast.lastStay) : "–"}
                        {gast.nextStay && (
                          <div className="text-xs text-[#315c45]">
                            kommt {formatDate(gast.nextStay)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold">
                        {formatMoney(gast.revenue)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {gast.duplicateOf && <Badge tone="amber">Dublette?</Badge>}
                          {gast.noShows > 0 && <Badge tone="red">No-Show</Badge>}
                          {gast.hasNotes && <Badge tone="neutral">Notiz</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          small
                          variant="secondary"
                          disabled={busy}
                          onClick={() => oeffnen(gast.id)}
                        >
                          Öffnen
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data && data.pages > 1 && (
              <div className="flex items-center justify-between gap-4 border-t border-[#211f1b]/10 px-4 py-4">
                <Button
                  small
                  variant="secondary"
                  disabled={data.page <= 1}
                  onClick={() => setSeite(data.page - 1)}
                >
                  ← Zurück
                </Button>

                <span className="text-sm text-[#756f64]">
                  Seite {data.page} von {data.pages}
                </span>

                <Button
                  small
                  variant="secondary"
                  disabled={data.page >= data.pages}
                  onClick={() => setSeite(data.page + 1)}
                >
                  Weiter →
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {detail && (
        <Card className="mt-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl">
                {detail.firstName} {detail.lastName}
              </h2>
              <p className="mt-1 text-sm text-[#756f64]">
                Gast-ID {detail.id} · angelegt am {formatDate(detail.createdAt)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button small variant="secondary" onClick={() => bearbeiten(detail)}>
                Bearbeiten
              </Button>
              <Button small variant="ghost" onClick={() => setDetail(null)}>
                Schließen
              </Button>
            </div>
          </div>

          {detail.duplicateOf && (
            <div className="mt-5">
              <Alert kind="info">
                Mögliche Dublette: gleiche E-Mail oder gleicher Name mit gleicher Telefonnummer
                wie Gast-ID {detail.duplicateOf.join(", ")}. Zusammengeführt wird nichts
                automatisch.
              </Alert>
            </div>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#756f64]">
                Stammdaten
              </p>

              <dl className="mt-3 space-y-2 text-sm">
                {[
                  ["E-Mail", detail.email ?? "–"],
                  ["Telefon", detail.phone ?? "–"],
                  ["Straße", detail.street ?? "–"],
                  ["PLZ / Ort", [detail.postalCode, detail.city].filter(Boolean).join(" ") || "–"],
                  ["Land", detail.countryCode ?? "–"],
                  ["Geburtsdatum", detail.birthDate ? formatDate(detail.birthDate) : "–"],
                  ["Staatsangehörigkeit", detail.nationality ?? "–"],
                  [
                    "Ausweis",
                    [detail.idDocumentType, detail.idDocumentNo].filter(Boolean).join(" ") || "–",
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-6">
                    <dt className="text-[#756f64]">{label}</dt>
                    <dd className="break-all text-right font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>

              {detail.notes && (
                <div className="mt-5 rounded-xl border border-[#211f1b]/10 bg-[#f5f1e8] p-4 text-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#756f64]">
                    Interne Notiz
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{detail.notes}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#756f64]">
                Kennzahlen
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3">
                {[
                  ["Buchungen", String(detail.bookings)],
                  ["Gezählte Aufenthalte", String(detail.stays)],
                  ["Storniert", String(detail.cancelled)],
                  ["Nicht erschienen", String(detail.noShows)],
                  ["Umsatz", `${formatMoney(detail.revenue)}`],
                  ["Letzter Aufenthalt", detail.lastStay ? formatDate(detail.lastStay) : "–"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-[#211f1b]/10 bg-[#f5f1e8] p-4"
                  >
                    <p className="text-xs text-[#756f64]">{label}</p>
                    <p className="mt-1 text-lg font-bold">{value}</p>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs text-[#756f64]">
                Der Umsatz zählt bestätigte, laufende und abgeschlossene Aufenthalte.
                Stornierungen und Nichtanreisen bleiben außen vor.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-xs font-bold uppercase tracking-wider text-[#756f64]">
              Aufenthalte
            </p>

            {detail.stayList.length === 0 ? (
              <p className="mt-3 text-sm text-[#756f64]">
                Für diesen Gast ist noch keine Buchung gespeichert.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-[#e9e2d5] text-xs uppercase tracking-wider text-[#756f64]">
                    <tr>
                      <th className="px-3 py-2">Nummer</th>
                      <th className="px-3 py-2">Zeitraum</th>
                      <th className="px-3 py-2">Nächte</th>
                      <th className="px-3 py-2">Personen</th>
                      <th className="px-3 py-2">Zimmer</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Betrag</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#211f1b]/10">
                    {detail.stayList.map((aufenthalt) => (
                      <tr key={aufenthalt.bookingId}>
                        <td className="px-3 py-3 font-mono text-xs font-semibold">
                          {aufenthalt.bookingNumber}
                        </td>
                        <td className="px-3 py-3">
                          {formatDate(aufenthalt.checkIn)} – {formatDate(aufenthalt.checkOut)}
                        </td>
                        <td className="px-3 py-3">{aufenthalt.nights}</td>
                        <td className="px-3 py-3">{aufenthalt.adults + aufenthalt.children}</td>
                        <td className="px-3 py-3">
                          {aufenthalt.roomTypeName ?? "–"}
                          {aufenthalt.roomNumber && (
                            <span className="ml-1 text-xs text-[#315c45]">
                              → Zi. {aufenthalt.roomNumber}
                            </span>
                          )}
                          {aufenthalt.bedTypeLabel && (
                            <div className="text-xs text-[#756f64]">
                              {aufenthalt.bedTypeLabel}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={STATUS_TONE[aufenthalt.status] ?? "neutral"}>
                            {STATUS_LABELS[aufenthalt.status] ?? aufenthalt.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold">
                          {formatMoney(aufenthalt.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <a
              href="/admin/hotel/buchungen"
              className="mt-4 inline-block text-sm font-bold text-[#315c45] hover:underline"
            >
              Zu den Buchungen →
            </a>
          </div>
        </Card>
      )}
    </div>
  );
}
