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
import { type ApiResult, apiRequest } from "@/lib/hotel/client";
import { PRICE_SOURCE_LABELS, WEEKDAYS } from "@/lib/hotel/rate-calendar";
import { formatAmount, formatMoney } from "@/lib/money";

// Preiskalender.
//
// Jeder Tag zeigt den Preis, der für diese Übernachtung tatsächlich gilt.
// „Grundpreis“ und „Individuell“ sind deutlich unterschieden – nicht nur
// über die Farbe, sondern auch über Beschriftung und Rahmen.
//
// Geändert wird nie direkt: Erst entsteht eine Vorschau mit vorher/nachher
// je Tag, dann wird gespeichert. Gerechnet wird beides serverseitig mit
// derselben Logik, mit der auch gebucht wird.

type DayPrice = {
  date: string;
  price: string | null;
  source: "DATE" | "BASE" | null;
};

type Availability = {
  date: string;
  free: number;
  totalRooms: number;
  blocked: number;
  soldOut: boolean;
};

type OccupancyRow = {
  occupancy: number;
  basePrice: string | null;
  days: DayPrice[];
};

type CalendarRow = {
  roomTypeId: number;
  name: string;
  code: string;
  active: boolean;
  maxOccupancy: number;
  standardOccupancy: number;
  occupancies: OccupancyRow[];
  availability: Availability[];
};

type Response = {
  range: { from: string; to: string; days: number; dates: string[] };
  today: string;
  ratePlan: { id: number; code: string; name: string };
  rows: CalendarRow[];
};

type PlanRow = {
  date: string;
  before: string | null;
  beforeSource: "DATE" | "BASE" | null;
  after: string | null;
  effective: string | null;
  changes: boolean;
  problem: string | null;
};

type PreviewResponse = {
  plan: PlanRow[];
  summary: {
    days: number;
    changedDays: number;
    problems: string[];
    min: string | null;
    max: string | null;
  };
  roomTypeName: string;
  occupancy: number;
};

type Mode = "SET" | "PERCENT" | "DELTA" | "RESET";

const MODE_LABELS: Record<Mode, string> = {
  SET: "Festen Preis setzen",
  PERCENT: "Prozentual ändern",
  DELTA: "Festen Betrag ändern",
  RESET: "Grundpreis wiederherstellen",
};

const MODE_HINTS: Record<Mode, string> = {
  SET: "Dieser Preis gilt dann für jede ausgewählte Nacht.",
  PERCENT: "Zum Beispiel 15 für +15 % oder −10 für einen Abschlag.",
  DELTA: "Zum Beispiel 20 für +20,00 € oder −10 für 10,00 € weniger.",
  RESET: "Entfernt den individuellen Tagespreis. Danach gilt wieder der Grundpreis.",
};

const ANSICHTEN = [
  { value: 1, label: "Tag" },
  { value: 7, label: "Woche" },
  { value: 14, label: "14 Tage" },
  { value: 31, label: "Monat" },
];

const formatDay = (iso: string) =>
  new Intl.DateTimeFormat("de-AT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${iso}T12:00:00Z`));

const formatDateLong = (iso: string) =>
  new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T12:00:00Z`));

function plusTage(iso: string, tage: number) {
  const datum = new Date(`${iso}T12:00:00Z`);
  datum.setUTCDate(datum.getUTCDate() + tage);

  return datum.toISOString().slice(0, 10);
}

const istWochenende = (iso: string) => {
  const tag = new Date(`${iso}T12:00:00Z`).getUTCDay();

  return tag === 0 || tag === 6;
};

type FormState = {
  mode: Mode;
  value: string;
  from: string;
  to: string;
  weekdays: number[];
};

export default function PreiskalenderPage() {
  const [data, setData] = useState<Response | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [hotelReady, setHotelReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [from, setFrom] = useState("");
  const [days, setDays] = useState(31);
  const [roomTypeId, setRoomTypeId] = useState<number | null>(null);
  const [occupancy, setOccupancy] = useState<number | null>(null);

  const [form, setForm] = useState<FormState | null>(null);

  const anwenden = useCallback((result: ApiResult<Response>) => {
    if (result.ok) {
      setData(result.data);
      setFrom((bisher) => bisher || result.data.range.from);

      setRoomTypeId((bisher) => {
        if (bisher !== null && result.data.rows.some((zeile) => zeile.roomTypeId === bisher)) {
          return bisher;
        }

        return result.data.rows.find((zeile) => zeile.active)?.roomTypeId ?? null;
      });

      setError("");
    } else {
      if (/Hotel-Stammdaten|Rate Plan/.test(result.error)) setHotelReady(false);
      setError(result.error);
    }

    setLoading(false);
  }, []);

  const abfragen = useCallback(() => {
    const params = new URLSearchParams({ days: String(days) });

    if (from) params.set("from", from);

    return apiRequest<Response>(`/api/admin/hotel/preiskalender?${params.toString()}`);
  }, [from, days]);

  useEffect(() => {
    abfragen().then(anwenden);
  }, [abfragen, anwenden]);

  const zeile = data?.rows.find((eintrag) => eintrag.roomTypeId === roomTypeId) ?? null;

  // Die wirksame Belegung wird ABGELEITET, nicht im Effekt gesetzt: Solange
  // der Betrieb nichts gewählt hat oder die Wahl nicht zur Zimmerart passt,
  // gilt die Standardbelegung.
  const occupancyGewaehlt =
    occupancy !== null && zeile?.occupancies.some((eintrag) => eintrag.occupancy === occupancy)
      ? occupancy
      : (zeile?.occupancies.find(
          (eintrag) => eintrag.occupancy === zeile.standardOccupancy
        )?.occupancy ??
        zeile?.occupancies[0]?.occupancy ??
        null);

  const belegung =
    zeile?.occupancies.find((eintrag) => eintrag.occupancy === occupancyGewaehlt) ?? null;

  async function neuLaden() {
    anwenden(await abfragen());
  }

  async function vorschau(naechster: FormState) {
    if (roomTypeId === null || occupancyGewaehlt === null) return;

    setBusy(true);
    setError("");
    setSuccess("");

    const result = await apiRequest<PreviewResponse>(
      "/api/admin/hotel/preiskalender",
      "POST",
      {
        action: "preview",
        ...naechster,
        value: naechster.value.replace(",", "."),
        roomTypeId,
        occupancy: occupancyGewaehlt,
      }
    );

    setBusy(false);

    if (!result.ok) {
      setPreview(null);
      setError(result.error);
      return;
    }

    setPreview(result.data);
  }

  async function speichern() {
    if (!form || roomTypeId === null || occupancyGewaehlt === null) return;

    setBusy(true);
    setError("");
    setSuccess("");

    const result = await apiRequest<{ applied: number; note: string | null }>(
      "/api/admin/hotel/preiskalender",
      "POST",
      {
        action: "apply",
        ...form,
        value: form.value.replace(",", "."),
        roomTypeId,
        occupancy: occupancyGewaehlt,
      }
    );

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess(
      result.data.note ??
        `${result.data.applied} ${result.data.applied === 1 ? "Tag" : "Tage"} gespeichert.`
    );

    setPreview(null);
    setForm(null);
    await neuLaden();
  }

  /** Öffnet die Maske für genau einen Tag. */
  function tagBearbeiten(tag: DayPrice) {
    const naechster: FormState = {
      mode: "SET",
      value: tag.price ? formatAmount(tag.price).replace(/\./g, "").replace(",", ".") : "",
      from: tag.date,
      to: tag.date,
      weekdays: [],
    };

    setForm(naechster);
    vorschau(naechster);
  }

  function formSetzen(teil: Partial<FormState>) {
    const basis: FormState =
      form ?? {
        mode: "SET",
        value: "",
        from: data?.range.from ?? "",
        to: data?.range.to ?? "",
        weekdays: [],
      };

    const naechster = { ...basis, ...teil };

    setForm(naechster);
    setPreview(null);
  }

  return (
    <div>
      <PageIntro
        eyebrow="Hotel"
        title="Preiskalender"
        description="Preise je Übernachtungsdatum. Ein Tagespreis gilt genau für seine Nacht und hat Vorrang vor dem Grundpreis. Preise sagen nichts über die Verfügbarkeit – belegte und gesperrte Tage sind nur gekennzeichnet."
      />

      <div className="mt-8 space-y-3">
        {!loading && !hotelReady && <HotelMissing />}
        {error && <Alert kind="error">{error}</Alert>}
        {success && <Alert kind="success">✓ {success}</Alert>}
      </div>

      <Card className="mt-8">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex gap-2">
            <Button small variant="secondary" onClick={() => setFrom(plusTage(from, -days))}>
              ← Zurück
            </Button>
            <Button small variant="secondary" onClick={() => setFrom(data?.today ?? from)}>
              Heute
            </Button>
            <Button small variant="secondary" onClick={() => setFrom(plusTage(from, days))}>
              Weiter →
            </Button>
          </div>

          <Field label="Ab Datum">
            <input
              className={inputClass}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>

          <Field label="Ansicht">
            <select
              className={inputClass}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {ANSICHTEN.map((eintrag) => (
                <option key={eintrag.value} value={eintrag.value}>
                  {eintrag.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Zimmerart">
            <select
              className={inputClass}
              value={roomTypeId ?? ""}
              onChange={(e) => setRoomTypeId(Number(e.target.value))}
            >
              {(data?.rows ?? []).map((eintrag) => (
                <option key={eintrag.roomTypeId} value={eintrag.roomTypeId}>
                  {eintrag.name}
                  {eintrag.active ? "" : " (inaktiv)"}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Belegung" hint="Preise werden je Personenzahl gepflegt.">
            <select
              className={inputClass}
              value={occupancyGewaehlt ?? ""}
              onChange={(e) => setOccupancy(Number(e.target.value))}
            >
              {(zeile?.occupancies ?? []).map((eintrag) => (
                <option key={eintrag.occupancy} value={eintrag.occupancy}>
                  {eintrag.occupancy} {eintrag.occupancy === 1 ? "Person" : "Personen"}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-[#211f1b]/10 pt-5 text-xs">
          <span className="font-bold uppercase tracking-wider text-[#756f64]">Legende</span>

          <span className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#211f1b]/15 bg-white">
              =
            </span>
            Grundpreis
          </span>

          <span className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded border-2 border-[#b08a4a] bg-[#f4ead5] font-bold text-[#8a682d]">
              ✎
            </span>
            Individueller Tagespreis
          </span>

          <span className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-red-300 bg-red-50 text-red-700">
              ✕
            </span>
            Ausgebucht oder gesperrt
          </span>

          {data && (
            <span className="text-[#756f64]">
              Rate Plan: {data.ratePlan.name}
              {belegung?.basePrice
                ? ` · Grundpreis ${formatMoney(belegung.basePrice)}`
                : " · kein Grundpreis hinterlegt"}
            </span>
          )}
        </div>
      </Card>

      <section className="mt-8">
        {loading ? (
          <EmptyState title="Wird geladen..." />
        ) : !zeile || !belegung ? (
          <EmptyState title="Keine Preise hinterlegt">
            Für diese Zimmerart ist noch kein Grundpreis gespeichert. Grundpreise werden unter
            „Preise“ gepflegt.
          </EmptyState>
        ) : (
          <div className="rounded-2xl border border-[#211f1b]/10 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-serif text-2xl">
                {zeile.name}
                <span className="ml-2 text-base font-normal text-[#756f64]">
                  {belegung.occupancy} {belegung.occupancy === 1 ? "Person" : "Personen"}
                </span>
              </h2>
              <p className="text-sm text-[#756f64]">
                {formatDateLong(data!.range.from)} bis {formatDateLong(data!.range.to)}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {belegung.days.map((tag) => {
                const verfuegbar = zeile.availability.find(
                  (eintrag) => eintrag.date === tag.date
                );
                const individuell = tag.source === "DATE";
                const heute = tag.date === data?.today;

                return (
                  <button
                    key={tag.date}
                    type="button"
                    onClick={() => tagBearbeiten(tag)}
                    aria-label={`${formatDateLong(tag.date)}: ${
                      tag.price ? formatMoney(tag.price) : "kein Preis"
                    }, ${tag.source ? PRICE_SOURCE_LABELS[tag.source] : "nicht bepreist"}${
                      verfuegbar?.soldOut ? ", ausgebucht" : ""
                    }`}
                    className={`rounded-xl border p-3 text-left transition hover:border-[#b08a4a] focus:border-[#b08a4a] focus:outline-none focus:ring-2 focus:ring-[#b08a4a]/40 ${
                      individuell
                        ? "border-2 border-[#b08a4a] bg-[#f4ead5]"
                        : istWochenende(tag.date)
                          ? "border-[#211f1b]/15 bg-[#f5f1e8]"
                          : "border-[#211f1b]/10 bg-white"
                    } ${heute ? "ring-2 ring-[#315c45]/40" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-[#756f64]">
                        {formatDay(tag.date)}
                      </span>
                      <span className="text-xs" aria-hidden="true">
                        {individuell ? "✎" : "="}
                      </span>
                    </div>

                    <div className="mt-1 text-base font-bold leading-tight">
                      {tag.price ? formatMoney(tag.price) : "–"}
                    </div>

                    <div className="mt-1 text-[11px] leading-tight text-[#756f64]">
                      {tag.source ? PRICE_SOURCE_LABELS[tag.source] : "kein Preis"}
                    </div>

                    {verfuegbar && (
                      <div
                        className={`mt-1 text-[11px] leading-tight ${
                          verfuegbar.soldOut ? "font-semibold text-red-700" : "text-[#315c45]"
                        }`}
                      >
                        {verfuegbar.soldOut
                          ? "✕ ausgebucht"
                          : `${verfuegbar.free} von ${verfuegbar.totalRooms} frei`}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-xs text-[#756f64]">
              Auf einen Tag klicken, um nur diesen Tag zu ändern. Für Zeiträume und Wochentage die
              Maske darunter verwenden.
            </p>
          </div>
        )}
      </section>

      <Card className="mt-8">
        <h2 className="font-serif text-2xl">Preise ändern</h2>
        <p className="mt-2 max-w-2xl text-sm text-[#756f64]">
          Es wird nur geändert, was in der Vorschau steht: ausschließlich Tage im gewählten
          Zeitraum und nur die gewählten Wochentage.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Art der Änderung" required>
            <select
              className={inputClass}
              value={form?.mode ?? "SET"}
              onChange={(e) => formSetzen({ mode: e.target.value as Mode })}
            >
              {(Object.keys(MODE_LABELS) as Mode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </Field>

          {form?.mode !== "RESET" && (
            <Field
              label={
                form?.mode === "PERCENT"
                  ? "Prozent"
                  : form?.mode === "DELTA"
                    ? "Betrag in Euro"
                    : "Preis in Euro"
              }
              required
              hint={MODE_HINTS[form?.mode ?? "SET"]}
            >
              <input
                className={inputClass}
                inputMode="decimal"
                value={form?.value ?? ""}
                onChange={(e) => formSetzen({ value: e.target.value })}
              />
            </Field>
          )}

          <Field label="Von" required>
            <input
              className={inputClass}
              type="date"
              value={form?.from ?? data?.range.from ?? ""}
              onChange={(e) => formSetzen({ from: e.target.value })}
            />
          </Field>

          <Field label="Bis" required hint="Einschließlich dieses Tages.">
            <input
              className={inputClass}
              type="date"
              value={form?.to ?? data?.range.to ?? ""}
              onChange={(e) => formSetzen({ to: e.target.value })}
            />
          </Field>
        </div>

        {form?.mode === "RESET" && (
          <div className="mt-4">
            <Alert kind="info">{MODE_HINTS.RESET}</Alert>
          </div>
        )}

        <div className="mt-5">
          <p className="text-sm font-bold">Wochentage</p>
          <p className="mt-1 text-xs text-[#756f64]">
            Keine Auswahl bedeutet: alle Tage des Zeitraums.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {WEEKDAYS.map((tag) => {
              const aktiv = (form?.weekdays ?? []).includes(tag.value);

              return (
                <button
                  key={tag.value}
                  type="button"
                  aria-pressed={aktiv}
                  onClick={() =>
                    formSetzen({
                      weekdays: aktiv
                        ? (form?.weekdays ?? []).filter((wert) => wert !== tag.value)
                        : [...(form?.weekdays ?? []), tag.value],
                    })
                  }
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-[#b08a4a]/40 ${
                    aktiv
                      ? "border-[#211f1b] bg-[#211f1b] text-white"
                      : "border-[#211f1b]/15 bg-white text-[#211f1b] hover:border-[#b08a4a]"
                  }`}
                >
                  {tag.short}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            disabled={busy || !form || roomTypeId === null || occupancyGewaehlt === null}
            onClick={() => form && vorschau(form)}
          >
            Vorschau berechnen
          </Button>

          {form && (
            <Button
              variant="ghost"
              small
              onClick={() => {
                setForm(null);
                setPreview(null);
              }}
            >
              Zurücksetzen
            </Button>
          )}
        </div>

        {preview && (
          <div className="mt-8 rounded-xl border border-[#211f1b]/10 bg-[#f5f1e8] p-5">
            <h3 className="font-serif text-xl">Vorschau</h3>

            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Zimmerart", `${preview.roomTypeName}, ${preview.occupancy} Pers.`],
                ["Betroffene Tage", String(preview.summary.days)],
                ["Davon geändert", String(preview.summary.changedDays)],
                [
                  "Neuer Preis",
                  preview.summary.min === null
                    ? "–"
                    : preview.summary.min === preview.summary.max
                      ? formatMoney(preview.summary.min)
                      : `${formatMoney(preview.summary.min)} bis ${formatMoney(
                          preview.summary.max
                        )}`,
                ],
              ].map(([label, wert]) => (
                <div key={label} className="rounded-xl border border-[#211f1b]/10 bg-white p-4">
                  <p className="text-xs text-[#756f64]">{label}</p>
                  <p className="mt-1 text-lg font-bold">{wert}</p>
                </div>
              ))}
            </dl>

            {preview.summary.problems.length > 0 && (
              <div className="mt-4 space-y-2">
                {preview.summary.problems.map((problem) => (
                  <Alert key={problem} kind="error">
                    {problem}
                  </Alert>
                ))}
              </div>
            )}

            {preview.summary.changedDays === 0 ? (
              <div className="mt-4">
                <Alert kind="info">
                  Diese Änderung würde nichts bewirken – die Preise sind bereits so hinterlegt.
                </Alert>
              </div>
            ) : (
              <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-[#211f1b]/10 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[#e9e2d5] text-xs uppercase tracking-wider text-[#756f64]">
                    <tr>
                      <th className="px-4 py-3">Tag</th>
                      <th className="px-4 py-3">Bisher</th>
                      <th className="px-4 py-3">Neu</th>
                      <th className="px-4 py-3">Hinweis</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#211f1b]/10">
                    {preview.plan.map((row) => (
                      <tr key={row.date} className={row.changes ? "" : "text-[#756f64]"}>
                        <td className="px-4 py-2">{formatDateLong(row.date)}</td>
                        <td className="px-4 py-2">
                          {row.before ? formatMoney(row.before) : "–"}
                          {row.beforeSource && (
                            <span className="ml-2 text-xs text-[#756f64]">
                              {PRICE_SOURCE_LABELS[row.beforeSource]}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 font-semibold">
                          {row.effective ? formatMoney(row.effective) : "–"}
                          {row.after === null && row.changes && (
                            <span className="ml-2 text-xs text-[#756f64]">Grundpreis</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {row.problem ? (
                            <span className="text-red-700">{row.problem}</span>
                          ) : row.changes ? (
                            <Badge tone="amber">wird geändert</Badge>
                          ) : (
                            "unverändert"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                disabled={busy || preview.summary.changedDays === 0}
                onClick={speichern}
              >
                {preview.summary.changedDays} {preview.summary.changedDays === 1 ? "Tag" : "Tage"}{" "}
                speichern
              </Button>

              <Button variant="ghost" small onClick={() => setPreview(null)}>
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
