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
import { formatEuro } from "@/lib/hotel/pricing";
import {
  PROMOTION_CHANNELS,
  PROMOTION_CHANNEL_LABELS,
  PROMOTION_TYPES,
  PROMOTION_TYPE_LABELS,
} from "@/lib/hotel/promotions";

// Rabattaktionen.
//
// Die Vorschau rechnet nicht selbst: Sie fragt den Server, der dieselbe
// Funktion verwendet wie die echte Buchung. Was hier steht, kommt also auch
// beim Gast heraus.

type Promotion = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  type: string;
  channel: string;
  active: boolean;
  discountPercent: string;
  discountAmount: string | null;
  bookingFrom: string | null;
  bookingTo: string | null;
  stayFrom: string | null;
  arrivalTo: string | null;
  departureFrom: string | null;
  stayTo: string | null;
  minStayNights: number | null;
  maxStayNights: number | null;
  earlyBookerDays: number | null;
  lastMinuteDays: number | null;
  requiresCode: boolean;
  roomTypeIds: number[];
  ratePlanIds: number[];
  managedUnderPricing: boolean;
  conditions: string[];
};

type Response = {
  promotions: Promotion[];
  roomTypes: { id: number; code: string; name: string; active: boolean }[];
  ratePlans: { id: number; code: string; name: string }[];
  today: string;
};

type Evaluation = {
  promotionId: number;
  code: string;
  name: string;
  requiresCode: boolean;
  applies: boolean;
  wins: boolean;
  discountCents: number;
  reason: string | null;
};

type CodeResult = {
  code: string | null;
  status: "NONE" | "APPLIED" | "UNKNOWN" | "NOT_APPLICABLE" | "OUTPERFORMED";
  reason: string | null;
};

type PreviewRow = {
  roomTypeId: number;
  roomTypeName: string;
  pricePerNight: string;
  totals: {
    nights: number;
    roomsTotal: string;
    discountPercent: number;
    discountTotal: string;
    discountName: string | null;
    breakfastTotal: string;
    total: string;
  };
  promotion: {
    code: string;
    name: string;
    percent: number;
    cents: number;
    source: "AUTOMATIC" | "CODE";
  } | null;
  promotionCode: CodeResult;
  evaluations: Evaluation[];
};

type Preview = {
  stay: {
    checkIn: string;
    checkOut: string;
    nights: number;
    persons: number;
    breakfast: boolean;
    bookedOn: string;
  };
  ratePlan: { id: number; name: string };
  rows: PreviewRow[];
  note: string | null;
};

type FormState = {
  id: number | null;
  code: string;
  name: string;
  description: string;
  type: string;
  channel: string;
  active: boolean;
  requiresCode: boolean;
  discountKind: "PERCENT" | "AMOUNT";
  discountPercent: string;
  discountAmount: string;
  bookingFrom: string;
  bookingTo: string;
  stayFrom: string;
  arrivalTo: string;
  departureFrom: string;
  stayTo: string;
  minStayNights: string;
  maxStayNights: string;
  earlyBookerDays: string;
  lastMinuteDays: string;
  roomTypeIds: number[];
  ratePlanIds: number[];
};

const LEER: FormState = {
  id: null,
  code: "",
  name: "",
  description: "",
  type: "BASIC",
  channel: "PUBLIC",
  active: true,
  requiresCode: false,
  discountKind: "PERCENT",
  discountPercent: "10",
  discountAmount: "",
  bookingFrom: "",
  bookingTo: "",
  stayFrom: "",
  arrivalTo: "",
  departureFrom: "",
  stayTo: "",
  minStayNights: "",
  maxStayNights: "",
  earlyBookerDays: "",
  lastMinuteDays: "",
  roomTypeIds: [],
  ratePlanIds: [],
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  );

const euroAusCent = (cents: number) =>
  (cents / 100).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function plusTage(iso: string, tage: number) {
  const datum = new Date(`${iso}T12:00:00Z`);
  datum.setUTCDate(datum.getUTCDate() + tage);

  return datum.toISOString().slice(0, 10);
}

export default function PromotionsPage() {
  const [data, setData] = useState<Response | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [hotelReady, setHotelReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [probe, setProbe] = useState({
    checkIn: "",
    checkOut: "",
    adults: "2",
    children: "0",
    breakfast: false,
    bookedOn: "",
    promotionCode: "",
  });

  const anwenden = useCallback((result: ApiResult<Response>) => {
    if (result.ok) {
      setData(result.data);

      setProbe((bisher) =>
        bisher.checkIn
          ? bisher
          : {
              ...bisher,
              checkIn: plusTage(result.data.today, 30),
              checkOut: plusTage(result.data.today, 33),
              bookedOn: result.data.today,
            }
      );
    } else {
      if (/Hotel-Stammdaten/.test(result.error)) setHotelReady(false);
      setError(result.error);
    }

    setLoading(false);
  }, []);

  const abfragen = useCallback(
    () => apiRequest<Response>("/api/admin/hotel/promotions"),
    []
  );

  useEffect(() => {
    abfragen().then(anwenden);
  }, [abfragen, anwenden]);

  async function neuLaden() {
    anwenden(await abfragen());
  }

  function bearbeiten(promotion: Promotion) {
    const hatBetrag = Number(promotion.discountPercent) === 0 && promotion.discountAmount;

    setForm({
      id: promotion.id,
      code: promotion.code,
      name: promotion.name,
      description: toFormValue(promotion.description),
      type: promotion.type,
      channel: promotion.channel,
      active: promotion.active,
      requiresCode: promotion.requiresCode,
      discountKind: hatBetrag ? "AMOUNT" : "PERCENT",
      discountPercent: hatBetrag ? "" : String(Number(promotion.discountPercent)),
      discountAmount: hatBetrag ? String(Number(promotion.discountAmount)) : "",
      bookingFrom: toFormValue(promotion.bookingFrom),
      bookingTo: toFormValue(promotion.bookingTo),
      stayFrom: toFormValue(promotion.stayFrom),
      arrivalTo: toFormValue(promotion.arrivalTo),
      departureFrom: toFormValue(promotion.departureFrom),
      stayTo: toFormValue(promotion.stayTo),
      minStayNights: toFormValue(promotion.minStayNights),
      maxStayNights: toFormValue(promotion.maxStayNights),
      earlyBookerDays: toFormValue(promotion.earlyBookerDays),
      lastMinuteDays: toFormValue(promotion.lastMinuteDays),
      roomTypeIds: promotion.roomTypeIds,
      ratePlanIds: promotion.ratePlanIds,
    });
  }

  async function speichern() {
    if (!form) return;

    setBusy(true);
    setError("");
    setSuccess("");

    const koerper = {
      ...form,
      discountPercent: form.discountKind === "PERCENT" ? form.discountPercent : "0",
      discountAmount: form.discountKind === "AMOUNT" ? form.discountAmount : "",
    };

    const result = form.id
      ? await apiRequest("/api/admin/hotel/promotions", "PATCH", koerper)
      : await apiRequest("/api/admin/hotel/promotions", "POST", koerper);

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess(form.id ? "Die Aktion wurde gespeichert." : "Die Aktion wurde angelegt.");
    setForm(null);
    await neuLaden();
    await vorschauLaden();
  }

  async function umschalten(promotion: Promotion) {
    setBusy(true);
    setError("");
    setSuccess("");

    const result = await apiRequest("/api/admin/hotel/promotions", "PATCH", {
      id: promotion.id,
      action: "toggle",
      active: !promotion.active,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess(
      `„${promotion.name}“ ist jetzt ${promotion.active ? "deaktiviert" : "aktiv"}.`
    );
    await neuLaden();
    await vorschauLaden();
  }

  async function entfernen(promotion: Promotion) {
    if (!window.confirm(`Aktion „${promotion.name}“ wirklich löschen?`)) return;

    setBusy(true);
    setError("");
    setSuccess("");

    const result = await apiRequest("/api/admin/hotel/promotions", "DELETE", {
      id: promotion.id,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess("Die Aktion wurde gelöscht. Bestätigte Buchungen behalten ihren Preis.");
    await neuLaden();
    await vorschauLaden();
  }

  const vorschauLaden = useCallback(async () => {
    if (!probe.checkIn || !probe.checkOut) return;

    const result = await apiRequest<Preview>("/api/admin/hotel/promotions", "POST", {
      action: "preview",
      ...probe,
      adults: Number(probe.adults),
      children: Number(probe.children),
    });

    if (result.ok) {
      setPreview(result.data);
    } else {
      setPreview(null);
      setError(result.error);
    }
  }, [probe]);

  const promotions = data?.promotions ?? [];
  const typLabel = (code: string) =>
    PROMOTION_TYPE_LABELS[code as keyof typeof PROMOTION_TYPE_LABELS] ?? code;

  return (
    <div>
      <PageIntro
        eyebrow="Hotel"
        title="Promotions"
        description="Rabattaktionen mit Zeiträumen, Mindestaufenthalt und Zuordnung zu Zimmerarten und Rate Plans. Es wirkt immer genau eine Aktion – die für den Gast günstigste."
        action={<Button onClick={() => setForm({ ...LEER })}>Aktion anlegen</Button>}
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
              {form.id ? `Aktion bearbeiten: ${form.name}` : "Neue Aktion"}
            </h2>
            <Button variant="ghost" small onClick={() => setForm(null)}>
              Abbrechen
            </Button>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {!form.id && (
              <Field label="Code" required hint="Eindeutig, z. B. FRUEHLING2027.">
                <input
                  className={inputClass}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                />
              </Field>
            )}

            <Field label="Name" required hint="So heißt die Aktion im Haus.">
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>

            <Field label="Art" required>
              <select
                className={inputClass}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {PROMOTION_TYPES.map((code) => (
                  <option key={code} value={code}>
                    {PROMOTION_TYPE_LABELS[code]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Kanal" required>
              <select
                className={inputClass}
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
              >
                {PROMOTION_CHANNELS.map((code) => (
                  <option key={code} value={code}>
                    {PROMOTION_CHANNEL_LABELS[code]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Interne Beschreibung" className="sm:col-span-2">
              <textarea
                className={inputClass}
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>

            <Field label="Rabattart" required>
              <select
                className={inputClass}
                value={form.discountKind}
                onChange={(e) =>
                  setForm({ ...form, discountKind: e.target.value as "PERCENT" | "AMOUNT" })
                }
              >
                <option value="PERCENT">Prozent vom Zimmerpreis</option>
                <option value="AMOUNT">Fester Betrag je Aufenthalt</option>
              </select>
            </Field>

            {form.discountKind === "PERCENT" ? (
              <Field label="Prozentsatz" required hint="0 bis 100.">
                <input
                  className={inputClass}
                  value={form.discountPercent}
                  onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                />
              </Field>
            ) : (
              <Field label="Betrag in Euro" required hint="Gilt einmal je Aufenthalt.">
                <input
                  className={inputClass}
                  value={form.discountAmount}
                  onChange={(e) => setForm({ ...form, discountAmount: e.target.value })}
                />
              </Field>
            )}
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Buchbar ab">
              <input
                className={inputClass}
                type="date"
                value={form.bookingFrom}
                onChange={(e) => setForm({ ...form, bookingFrom: e.target.value })}
              />
            </Field>

            <Field label="Buchbar bis">
              <input
                className={inputClass}
                type="date"
                value={form.bookingTo}
                onChange={(e) => setForm({ ...form, bookingTo: e.target.value })}
              />
            </Field>

            <Field label="Anreise ab">
              <input
                className={inputClass}
                type="date"
                value={form.stayFrom}
                onChange={(e) => setForm({ ...form, stayFrom: e.target.value })}
              />
            </Field>

            <Field label="Anreise bis">
              <input
                className={inputClass}
                type="date"
                value={form.arrivalTo}
                onChange={(e) => setForm({ ...form, arrivalTo: e.target.value })}
              />
            </Field>

            <Field label="Abreise ab">
              <input
                className={inputClass}
                type="date"
                value={form.departureFrom}
                onChange={(e) => setForm({ ...form, departureFrom: e.target.value })}
              />
            </Field>

            <Field label="Abreise bis">
              <input
                className={inputClass}
                type="date"
                value={form.stayTo}
                onChange={(e) => setForm({ ...form, stayTo: e.target.value })}
              />
            </Field>

            <Field label="Mindestaufenthalt" hint="Nächte. Leer = keine Vorgabe.">
              <input
                className={inputClass}
                value={form.minStayNights}
                onChange={(e) => setForm({ ...form, minStayNights: e.target.value })}
              />
            </Field>

            <Field label="Maximalaufenthalt" hint="Nächte. Leer = keine Vorgabe.">
              <input
                className={inputClass}
                value={form.maxStayNights}
                onChange={(e) => setForm({ ...form, maxStayNights: e.target.value })}
              />
            </Field>

            {form.type === "EARLY_BOOKER" && (
              <Field
                label="Vorlauf in Tagen"
                required
                hint="Buchung mindestens so viele Tage vor Anreise."
              >
                <input
                  className={inputClass}
                  value={form.earlyBookerDays}
                  onChange={(e) => setForm({ ...form, earlyBookerDays: e.target.value })}
                />
              </Field>
            )}

            {form.type === "LAST_MINUTE" && (
              <Field
                label="Fenster in Tagen"
                required
                hint="Buchung höchstens so viele Tage vor Anreise."
              >
                <input
                  className={inputClass}
                  value={form.lastMinuteDays}
                  onChange={(e) => setForm({ ...form, lastMinuteDays: e.target.value })}
                />
              </Field>
            )}
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-sm font-bold">Zimmerarten</p>
              <p className="mt-1 text-xs text-[#756f64]">
                Keine Auswahl bedeutet: gilt für alle Zimmerarten.
              </p>

              <div className="mt-3 space-y-2">
                {(data?.roomTypes ?? []).map((typ) => (
                  <label key={typ.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#b08a4a]"
                      checked={form.roomTypeIds.includes(typ.id)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          roomTypeIds: e.target.checked
                            ? [...form.roomTypeIds, typ.id]
                            : form.roomTypeIds.filter((id) => id !== typ.id),
                        })
                      }
                    />
                    {typ.name}
                    {!typ.active && <span className="text-xs text-[#756f64]">(inaktiv)</span>}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold">Rate Plans</p>
              <p className="mt-1 text-xs text-[#756f64]">
                Keine Auswahl bedeutet: gilt für alle Rate Plans.
              </p>

              <div className="mt-3 space-y-2">
                {(data?.ratePlans ?? []).map((plan) => (
                  <label key={plan.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#b08a4a]"
                      checked={form.ratePlanIds.includes(plan.id)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          ratePlanIds: e.target.checked
                            ? [...form.ratePlanIds, plan.id]
                            : form.ratePlanIds.filter((id) => id !== plan.id),
                        })
                      }
                    />
                    {plan.name}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#b08a4a]"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Aktion ist aktiv
            </label>

            <label className="flex items-start gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[#b08a4a]"
                checked={form.requiresCode}
                onChange={(e) => setForm({ ...form, requiresCode: e.target.checked })}
              />
              <span>
                Nur mit Aktionscode
                <span className="mt-1 block font-normal text-[#756f64]">
                  Mit Haken greift die Aktion nur, wenn der Gast den Code{" "}
                  {form.code ? `„${form.code}“ ` : ""}in der Buchungsstrecke eingibt. Ohne Haken
                  wirkt sie automatisch für jeden passenden Aufenthalt.
                </span>
              </span>
            </label>
          </div>

          <div className="mt-6">
            <Button onClick={speichern} disabled={busy}>
              {form.id ? "Speichern" : "Anlegen"}
            </Button>
          </div>
        </Card>
      )}

      <section className="mt-8">
        {loading ? (
          <EmptyState title="Wird geladen..." />
        ) : promotions.length === 0 ? (
          <EmptyState title="Noch keine Aktionen">
            Legen Sie eine Aktion an, oder pflegen Sie die Langzeitstaffel unter „Preise“.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {promotions.map((promotion) => (
              <Card key={promotion.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-serif text-xl">{promotion.name}</h3>
                      <Badge tone={promotion.active ? "green" : "gray"}>
                        {promotion.active ? "aktiv" : "inaktiv"}
                      </Badge>
                      <Badge tone="neutral">{typLabel(promotion.type)}</Badge>
                      {promotion.requiresCode && <Badge tone="amber">nur mit Code</Badge>}
                      {promotion.managedUnderPricing && (
                        <Badge tone="amber">Staffel unter „Preise“</Badge>
                      )}
                    </div>

                    <p className="mt-1 font-mono text-xs text-[#756f64]">{promotion.code}</p>

                    {promotion.description && (
                      <p className="mt-2 max-w-2xl text-sm text-[#756f64]">
                        {promotion.description}
                      </p>
                    )}

                    <ul className="mt-3 space-y-1 text-sm">
                      {promotion.conditions.map((zeile) => (
                        <li key={zeile}>· {zeile}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      small
                      variant="secondary"
                      disabled={busy}
                      onClick={() => umschalten(promotion)}
                    >
                      {promotion.active ? "Deaktivieren" : "Aktivieren"}
                    </Button>

                    {promotion.managedUnderPricing ? (
                      <a
                        href="/admin/hotel/preise"
                        className="self-center text-xs font-bold text-[#315c45] hover:underline"
                      >
                        Unter „Preise“ bearbeiten →
                      </a>
                    ) : (
                      <>
                        <Button small variant="secondary" onClick={() => bearbeiten(promotion)}>
                          Bearbeiten
                        </Button>
                        <Button
                          small
                          variant="danger"
                          disabled={busy}
                          onClick={() => entfernen(promotion)}
                        >
                          Löschen
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card className="mt-8">
        <h2 className="font-serif text-2xl">Vorschau für einen Beispielaufenthalt</h2>
        <p className="mt-2 text-sm text-[#756f64]">
          Gerechnet wird serverseitig mit derselben Funktion wie bei einer echten Buchung. Der
          Buchungstag ist frei wählbar, damit sich auch Frühbucher- und Last-Minute-Aktionen
          prüfen lassen.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Anreise">
            <input
              className={inputClass}
              type="date"
              value={probe.checkIn}
              onChange={(e) => setProbe({ ...probe, checkIn: e.target.value })}
            />
          </Field>

          <Field label="Abreise">
            <input
              className={inputClass}
              type="date"
              value={probe.checkOut}
              onChange={(e) => setProbe({ ...probe, checkOut: e.target.value })}
            />
          </Field>

          <Field label="Erwachsene">
            <input
              className={inputClass}
              value={probe.adults}
              onChange={(e) => setProbe({ ...probe, adults: e.target.value })}
            />
          </Field>

          <Field label="Kinder">
            <input
              className={inputClass}
              value={probe.children}
              onChange={(e) => setProbe({ ...probe, children: e.target.value })}
            />
          </Field>

          <Field label="Buchungstag" hint="Wirkt auf Frühbucher und Last Minute.">
            <input
              className={inputClass}
              type="date"
              value={probe.bookedOn}
              onChange={(e) => setProbe({ ...probe, bookedOn: e.target.value })}
            />
          </Field>

          <Field label="Aktionscode" hint="Für Aktionen mit Codepflicht.">
            <input
              className={inputClass}
              value={probe.promotionCode}
              onChange={(e) =>
                setProbe({ ...probe, promotionCode: e.target.value.toUpperCase() })
              }
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#b08a4a]"
              checked={probe.breakfast}
              onChange={(e) => setProbe({ ...probe, breakfast: e.target.checked })}
            />
            mit Frühstück
          </label>

          <Button onClick={vorschauLaden} disabled={busy}>
            Vorschau berechnen
          </Button>
        </div>

        {preview && (
          <div className="mt-6">
            <p className="text-sm text-[#756f64]">
              {preview.stay.nights} Nächte · {preview.stay.persons} Person(en) ·{" "}
              {preview.stay.breakfast ? "mit" : "ohne"} Frühstück · Rate Plan{" "}
              {preview.ratePlan.name} · gebucht am {formatDate(preview.stay.bookedOn)}
            </p>

            {preview.note && (
              <div className="mt-4">
                <Alert kind="info">{preview.note}</Alert>
              </div>
            )}

            {preview.rows.map((zeile) => (
              <div
                key={zeile.roomTypeId}
                className="mt-4 rounded-xl border border-[#211f1b]/10 bg-[#f5f1e8] p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-semibold">{zeile.roomTypeName}</p>
                  <p className="text-sm text-[#756f64]">
                    {formatEuro(zeile.pricePerNight)} € pro Nacht
                  </p>
                </div>

                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between gap-6">
                    <dt className="text-[#756f64]">Zimmerpreis</dt>
                    <dd className="font-semibold">{formatEuro(zeile.totals.roomsTotal)} €</dd>
                  </div>

                  <div className="flex justify-between gap-6">
                    <dt className="text-[#756f64]">
                      Rabatt
                      {zeile.totals.discountName ? ` – ${zeile.totals.discountName}` : ""}
                      {zeile.totals.discountPercent > 0
                        ? ` (${zeile.totals.discountPercent} %)`
                        : ""}
                    </dt>
                    <dd className="font-semibold">− {formatEuro(zeile.totals.discountTotal)} €</dd>
                  </div>

                  <div className="flex justify-between gap-6">
                    <dt className="text-[#756f64]">Frühstück</dt>
                    <dd className="font-semibold">{formatEuro(zeile.totals.breakfastTotal)} €</dd>
                  </div>

                  <div className="flex justify-between gap-6 border-t border-[#211f1b]/10 pt-2">
                    <dt className="font-bold">Gesamt</dt>
                    <dd className="text-lg font-bold">{formatEuro(zeile.totals.total)} €</dd>
                  </div>
                </dl>

                {zeile.promotionCode.status !== "NONE" && (
                  <p
                    className={`mt-3 text-sm ${
                      zeile.promotionCode.status === "APPLIED"
                        ? "font-semibold text-[#315c45]"
                        : zeile.promotionCode.status === "OUTPERFORMED"
                          ? "text-[#8a682d]"
                          : "text-red-700"
                    }`}
                  >
                    Code „{zeile.promotionCode.code}“:{" "}
                    {zeile.promotionCode.status === "APPLIED"
                      ? "angewendet"
                      : zeile.promotionCode.reason}
                  </p>
                )}

                {zeile.evaluations.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#756f64]">
                      Bewertung je Aktion
                    </p>

                    <ul className="mt-2 space-y-1 text-sm">
                      {zeile.evaluations.map((bewertung) => (
                        <li key={bewertung.promotionId} className="flex flex-wrap gap-2">
                          <span className="font-semibold">{bewertung.name}</span>
                          {bewertung.requiresCode && <Badge tone="amber">Code</Badge>}
                          {bewertung.wins ? (
                            <Badge tone="green">wirkt · {euroAusCent(bewertung.discountCents)} €</Badge>
                          ) : bewertung.applies ? (
                            <Badge tone="neutral">
                              möglich · {euroAusCent(bewertung.discountCents)} €
                            </Badge>
                          ) : (
                            <span className="text-[#756f64]">{bewertung.reason}</span>
                          )}
                        </li>
                      ))}
                    </ul>

                    <p className="mt-2 text-xs text-[#756f64]">
                      Es wirkt immer genau eine Aktion. Rabatte werden nicht addiert.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
