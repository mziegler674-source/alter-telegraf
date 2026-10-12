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

// Vertriebskanäle.
//
// Die Seite zeigt den tatsächlichen Zustand und beschönigt nichts: Grün
// erscheint nur, wenn ein Kanal eingerichtet ist, mindestens eine Zuordnung
// bestätigt wurde und kein Auftrag offen oder fehlgeschlagen ist.

type Job = {
  id: number;
  provider: string;
  direction: string;
  operation: string;
  status: string;
  statusLabel: string;
  bookingNumber: string | null;
  roomTypeId: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  externalRef: string | null;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  createdAt: string;
  completedAt: string | null;
};

type Mapping = {
  id: number;
  provider: string;
  roomTypeId: number;
  roomTypeName: string;
  ratePlanId: number | null;
  ratePlanName: string | null;
  externalPropertyId: string;
  externalRoomTypeId: string;
  externalRatePlanId: string | null;
  syncStatus: string;
  note: string | null;
};

type ChannelBooking = {
  id: number;
  bookingNumber: string;
  source: string;
  sourceLabel: string;
  externalChannel?: string | null;
  externalRef?: string | null;
  status: string;
  checkIn: string;
  checkOut: string;
  note: string | null;
  syncState: string;
};

type ManualTask = {
  id: number;
  roomTypeId: number | null;
  roomTypeName: string;
  bookingNumber: string | null;
  dateFrom: string;
  dateTo: string;
  createdAt: string;
  totalRooms: number;
  days: { date: string; free: number }[];
  needsClosing: boolean;
};

type Response = {
  manualTasks: ManualTask[];
  status: {
    state: "NOT_CONFIGURED" | "NO_MAPPING" | "ERROR" | "PENDING" | "OK";
    provider: string | null;
    missing: string[];
    confirmedMappings: number;
    lastSuccessAt: string | null;
    counts: {
      pending: number;
      inProgress: number;
      done: number;
      failed: number;
      needsMapping: number;
      attention: number;
      skipped: number;
    };
  };
  jobs: Job[];
  mappings: Mapping[];
  roomTypes: { id: number; code: string; name: string; active: boolean; channelCode: string | null }[];
  ratePlans: { id: number; code: string; name: string; channelCode: string | null }[];
  externalBookings: ChannelBooking[];
  manualBookings: ChannelBooking[];
  counts: { externalBookings: number; manualBookings: number; unsyncedBookings: number };
};

const ZUSTAND: Record<
  Response["status"]["state"],
  { kind: "error" | "success" | "info"; titel: string; text: string }
> = {
  NOT_CONFIGURED: {
    kind: "info",
    titel: "Noch nicht eingerichtet",
    text: "Es ist kein Vertriebskanal verbunden. Buchungen, Kalender und Verfügbarkeit arbeiten vollständig weiter – es wird nur nichts nach außen gemeldet.",
  },
  NO_MAPPING: {
    kind: "info",
    titel: "Zuordnung fehlt",
    text: "Ein Kanal ist konfiguriert, aber keine Zimmerart ist bestätigt zugeordnet. Ohne bestätigte Zuordnung wird bewusst nichts übertragen und nichts übernommen.",
  },
  ERROR: {
    kind: "error",
    titel: "Fehler – Aktion nötig",
    text: "Mindestens ein Auftrag ist fehlgeschlagen oder braucht eine Entscheidung. Bis dahin gilt: Der Kanal kennt den aktuellen Stand nicht.",
  },
  PENDING: {
    kind: "info",
    titel: "Übertragung ausstehend",
    text: "Es warten Aufträge auf die Übertragung. Die Buchungen selbst sind gespeichert.",
  },
  OK: {
    kind: "success",
    titel: "Synchronisiert",
    text: "Alle Aufträge sind bestätigt übertragen.",
  },
};

const JOB_TONE: Record<string, "green" | "amber" | "red" | "gray" | "neutral"> = {
  DONE: "green",
  PENDING: "amber",
  IN_PROGRESS: "amber",
  FAILED: "red",
  NEEDS_MAPPING: "red",
  ATTENTION: "red",
  SKIPPED: "gray",
};

const MAPPING_TONE: Record<string, "green" | "amber" | "gray"> = {
  CONFIRMED: "green",
  UNVERIFIED: "amber",
  DISABLED: "gray",
};

const MAPPING_LABEL: Record<string, string> = {
  CONFIRMED: "Bestätigt",
  UNVERIFIED: "Nicht bestätigt",
  DISABLED: "Abgeschaltet",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`)
  );

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

type MappingForm = {
  id: number | null;
  provider: string;
  roomTypeId: string;
  ratePlanId: string;
  externalPropertyId: string;
  externalRoomTypeId: string;
  externalRatePlanId: string;
  syncStatus: string;
  note: string;
};

export default function KanaelePage() {
  const [data, setData] = useState<Response | null>(null);
  const [form, setForm] = useState<MappingForm | null>(null);
  const [hotelReady, setHotelReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const anwenden = useCallback((result: ApiResult<Response>) => {
    if (result.ok) {
      setData(result.data);
      setError("");
    } else {
      if (/Hotel-Stammdaten/.test(result.error)) setHotelReady(false);
      setError(result.error);
    }

    setLoading(false);
  }, []);

  const abfragen = useCallback(() => apiRequest<Response>("/api/admin/hotel/kanaele"), []);

  useEffect(() => {
    abfragen().then(anwenden);
  }, [abfragen, anwenden]);

  async function aktion(body: Record<string, unknown>, meldung: string) {
    setBusy(true);
    setError("");
    setSuccess("");

    const result = await apiRequest<{ run?: { done: number; failed: number; retrying: number } }>(
      "/api/admin/hotel/kanaele",
      "POST",
      body
    );

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    anwenden(await abfragen());
    setBusy(false);

    const lauf = result.data.run;

    setSuccess(
      lauf
        ? `${meldung} ${lauf.done} bestätigt, ${lauf.retrying} erneut eingeplant, ${lauf.failed} fehlgeschlagen.`
        : meldung
    );
  }

  const status = data?.status;
  const zustand = status ? ZUSTAND[status.state] : null;

  return (
    <div>
      <PageIntro
        eyebrow="Hotel"
        title="Kanäle"
        description="Verbindung zu Vertriebsportalen. Eine Buchung ist gespeichert, sobald sie hier erscheint – ob ein Portal davon weiß, steht getrennt daneben."
      />

      <div className="mt-8 space-y-3">
        {!loading && !hotelReady && <HotelMissing />}
        {error && <Alert kind="error">{error}</Alert>}
        {success && <Alert kind="success">✓ {success}</Alert>}
      </div>

      {loading ? (
        <div className="mt-8">
          <EmptyState title="Wird geladen..." />
        </div>
      ) : (
        status &&
        zustand && (
          <>
            <Card className="mt-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-block h-3 w-3 rounded-full ${
                        status.state === "OK"
                          ? "bg-green-600"
                          : status.state === "ERROR"
                            ? "bg-red-600"
                            : status.state === "PENDING"
                              ? "bg-[#b08a4a]"
                              : "bg-gray-400"
                      }`}
                    />
                    <h2 className="font-serif text-2xl">{zustand.titel}</h2>
                  </div>

                  <p className="mt-2 max-w-2xl text-sm text-[#756f64]">{zustand.text}</p>

                  <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ["Anbieter", status.provider ?? "keiner"],
                      ["Bestätigte Zuordnungen", String(status.confirmedMappings)],
                      [
                        "Letzte Bestätigung",
                        status.lastSuccessAt ? formatDateTime(status.lastSuccessAt) : "keine",
                      ],
                      ["Offene Aufträge", String(status.counts.pending + status.counts.inProgress)],
                      ["Fehlgeschlagen", String(status.counts.failed)],
                      ["Zuordnung fehlt", String(status.counts.needsMapping)],
                      ["Aktion nötig", String(status.counts.attention)],
                      [
                        "Buchungen ohne Bestätigung",
                        String(data?.counts.unsyncedBookings ?? 0),
                      ],
                    ].map(([label, wert]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-[#211f1b]/10 bg-[#f5f1e8] p-4"
                      >
                        <p className="text-xs text-[#756f64]">{label}</p>
                        <p className="mt-1 text-lg font-bold">{wert}</p>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    disabled={busy || status.state === "NOT_CONFIGURED"}
                    onClick={() => aktion({ action: "runJobs" }, "Aufträge abgearbeitet.")}
                  >
                    Aufträge jetzt abarbeiten
                  </Button>

                  <Button
                    variant="secondary"
                    disabled={busy || status.state === "NOT_CONFIGURED"}
                    onClick={() => aktion({ action: "pullBookings" }, "Reservierungen abgerufen.")}
                  >
                    Reservierungen abrufen
                  </Button>
                </div>
              </div>

              {status.state === "NOT_CONFIGURED" && (
                <div className="mt-6">
                  <Alert kind="info">
                    <span className="font-bold">So läuft der Betrieb derzeit:</span> Dieses PMS
                    führt den Bestand, das Portal wird im Extranet von Hand nachgezogen. Jede
                    Änderung erzeugt unten eine Aufgabe. Das ist ausdrücklich{" "}
                    <span className="font-bold">keine</span> Synchronisierung – es wird nichts
                    übertragen.
                  </Alert>
                </div>
              )}

              {status.missing.length > 0 && (
                <div className="mt-6">
                  <Alert kind="info">
                    Fehlende Konfiguration: {status.missing.join(", ")}. Die Werte gehören in
                    <span className="font-mono"> .env.local</span>, niemals in den Quellcode. Welcher
                    Anbieter dafür in Frage kommt, steht in{" "}
                    <span className="font-mono">docs/booking-com-integration.md</span>.
                  </Alert>
                </div>
              )}
            </Card>

            {/* Manueller Abgleich. Die Hauptbetriebsart, solange keine
                bezahlte Anbindung freigegeben ist. */}
            <Card className="mt-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl">
                    Abgleich mit dem Portal
                    {(data?.manualTasks ?? []).length > 0 && (
                      <span className="ml-3 align-middle">
                        <Badge tone="amber">{(data?.manualTasks ?? []).length} offen</Badge>
                      </span>
                    )}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-[#756f64]">
                    Diese Zahlen gehören in das Extranet des Portals: freie Zimmer je Kategorie
                    und Tag, berechnet aus denselben Buchungen wie der Belegungskalender. Nach dem
                    Eintragen haken Sie die Aufgabe ab – das Abhaken übermittelt nichts, es hält
                    nur fest, dass Sie es erledigt haben.
                  </p>
                </div>
              </div>

              {(data?.manualTasks ?? []).length === 0 ? (
                <div className="mt-6">
                  <EmptyState title="Nichts offen">
                    Es liegt keine Änderung vor, die im Portal nachgezogen werden müsste.
                  </EmptyState>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {(data?.manualTasks ?? []).map((aufgabe) => (
                    <div
                      key={aufgabe.id}
                      className={`rounded-xl border p-5 ${
                        aufgabe.needsClosing
                          ? "border-red-200 bg-red-50"
                          : "border-[#211f1b]/10 bg-[#f5f1e8]"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">
                            {aufgabe.roomTypeName}
                            <span className="ml-2 font-normal text-[#756f64]">
                              {formatDate(aufgabe.dateFrom)} bis {formatDate(aufgabe.dateTo)}
                            </span>
                          </p>

                          <p className="mt-1 text-xs text-[#756f64]">
                            {aufgabe.totalRooms} Zimmer in dieser Kategorie
                            {aufgabe.bookingNumber ? ` · Auslöser: ${aufgabe.bookingNumber}` : ""}
                          </p>

                          {aufgabe.needsClosing && (
                            <p className="mt-2 text-sm font-semibold text-red-700">
                              Mindestens ein Tag ist ausgebucht – im Portal auf 0 setzen bzw.
                              schließen.
                            </p>
                          )}
                        </div>

                        <Button
                          small
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            aktion(
                              { action: "completeManualTask", jobId: aufgabe.id },
                              "Aufgabe abgehakt."
                            )
                          }
                        >
                          Im Portal erledigt
                        </Button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {aufgabe.days.map((tag) => (
                          <span
                            key={tag.date}
                            title={`${formatDate(tag.date)}: ${tag.free} frei`}
                            className={`inline-flex min-w-[64px] flex-col items-center rounded-lg border px-2 py-1 text-center ${
                              tag.free === 0
                                ? "border-red-300 bg-white text-red-700"
                                : "border-[#211f1b]/10 bg-white"
                            }`}
                          >
                            <span className="text-[10px] uppercase tracking-wide text-[#756f64]">
                              {tag.date.slice(8, 10)}.{tag.date.slice(5, 7)}.
                            </span>
                            <span className="text-base font-bold leading-tight">{tag.free}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl">Zuordnungen</h2>
                  <p className="mt-2 max-w-2xl text-sm text-[#756f64]">
                    Welche externe Zimmerart entspricht welcher eigenen? Die Kennungen kommen aus
                    dem Portal und müssen ausdrücklich bestätigt werden. Ohne Bestätigung wird
                    nichts übertragen und keine Reservierung übernommen – geraten wird nie.
                  </p>
                </div>

                <Button
                  onClick={() =>
                    setForm({
                      id: null,
                      provider: status.provider ?? "",
                      roomTypeId: "",
                      ratePlanId: "",
                      externalPropertyId: "",
                      externalRoomTypeId: "",
                      externalRatePlanId: "",
                      syncStatus: "UNVERIFIED",
                      note: "",
                    })
                  }
                >
                  Zuordnung anlegen
                </Button>
              </div>

              {form && (
                <div className="mt-6 rounded-xl border border-[#211f1b]/10 bg-[#f5f1e8] p-5">
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Anbieter" required hint="Kennung wie in CHANNEL_PROVIDER.">
                      <input
                        className={inputClass}
                        value={form.provider}
                        onChange={(e) => setForm({ ...form, provider: e.target.value })}
                      />
                    </Field>

                    <Field label="Eigene Zimmerart" required>
                      <select
                        className={inputClass}
                        value={form.roomTypeId}
                        onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })}
                      >
                        <option value="">Bitte wählen</option>
                        {(data?.roomTypes ?? []).map((typ) => (
                          <option key={typ.id} value={typ.id}>
                            {typ.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Eigener Rate Plan" hint="Optional.">
                      <select
                        className={inputClass}
                        value={form.ratePlanId}
                        onChange={(e) => setForm({ ...form, ratePlanId: e.target.value })}
                      >
                        <option value="">Keiner</option>
                        {(data?.ratePlans ?? []).map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Externe Unterkunft-ID" required>
                      <input
                        className={inputClass}
                        value={form.externalPropertyId}
                        onChange={(e) => setForm({ ...form, externalPropertyId: e.target.value })}
                      />
                    </Field>

                    <Field label="Externe Zimmerart-ID" required>
                      <input
                        className={inputClass}
                        value={form.externalRoomTypeId}
                        onChange={(e) => setForm({ ...form, externalRoomTypeId: e.target.value })}
                      />
                    </Field>

                    <Field label="Externe Tarifplan-ID" hint="Optional.">
                      <input
                        className={inputClass}
                        value={form.externalRatePlanId}
                        onChange={(e) => setForm({ ...form, externalRatePlanId: e.target.value })}
                      />
                    </Field>

                    <Field label="Status" required hint="Erst „Bestätigt“ schaltet frei.">
                      <select
                        className={inputClass}
                        value={form.syncStatus}
                        onChange={(e) => setForm({ ...form, syncStatus: e.target.value })}
                      >
                        <option value="UNVERIFIED">Nicht bestätigt</option>
                        <option value="CONFIRMED">Bestätigt</option>
                        <option value="DISABLED">Abgeschaltet</option>
                      </select>
                    </Field>

                    <Field label="Notiz" className="sm:col-span-2">
                      <input
                        className={inputClass}
                        value={form.note}
                        onChange={(e) => setForm({ ...form, note: e.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        aktion(
                          { action: "saveMapping", ...form },
                          "Die Zuordnung wurde gespeichert."
                        ).then(() => setForm(null))
                      }
                    >
                      Speichern
                    </Button>
                    <Button variant="ghost" small onClick={() => setForm(null)}>
                      Abbrechen
                    </Button>
                  </div>
                </div>
              )}

              {(data?.mappings ?? []).length === 0 ? (
                <div className="mt-6">
                  <EmptyState title="Keine Zuordnungen">
                    Solange keine Zuordnung bestätigt ist, bleibt die Synchronisierung
                    abgeschaltet.
                  </EmptyState>
                </div>
              ) : (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="bg-[#e9e2d5] text-xs uppercase tracking-wider text-[#756f64]">
                      <tr>
                        <th className="px-4 py-3">Anbieter</th>
                        <th className="px-4 py-3">Eigene Zimmerart</th>
                        <th className="px-4 py-3">Externe Kennungen</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#211f1b]/10">
                      {(data?.mappings ?? []).map((mapping) => (
                        <tr key={mapping.id}>
                          <td className="px-4 py-4 font-mono text-xs">{mapping.provider}</td>
                          <td className="px-4 py-4">
                            <div className="font-semibold">{mapping.roomTypeName}</div>
                            {mapping.ratePlanName && (
                              <div className="text-xs text-[#756f64]">{mapping.ratePlanName}</div>
                            )}
                          </td>
                          <td className="px-4 py-4 font-mono text-xs">
                            <div>Unterkunft: {mapping.externalPropertyId}</div>
                            <div>Zimmerart: {mapping.externalRoomTypeId}</div>
                            {mapping.externalRatePlanId && (
                              <div>Tarif: {mapping.externalRatePlanId}</div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <Badge tone={MAPPING_TONE[mapping.syncStatus] ?? "neutral"}>
                              {MAPPING_LABEL[mapping.syncStatus] ?? mapping.syncStatus}
                            </Badge>
                            {mapping.note && (
                              <div className="mt-1 text-xs text-[#756f64]">{mapping.note}</div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                small
                                variant="secondary"
                                onClick={() =>
                                  setForm({
                                    id: mapping.id,
                                    provider: mapping.provider,
                                    roomTypeId: String(mapping.roomTypeId),
                                    ratePlanId: toFormValue(mapping.ratePlanId),
                                    externalPropertyId: mapping.externalPropertyId,
                                    externalRoomTypeId: mapping.externalRoomTypeId,
                                    externalRatePlanId: toFormValue(mapping.externalRatePlanId),
                                    syncStatus: mapping.syncStatus,
                                    note: toFormValue(mapping.note),
                                  })
                                }
                              >
                                Bearbeiten
                              </Button>

                              <Button
                                small
                                variant="danger"
                                disabled={busy}
                                onClick={() => {
                                  if (!window.confirm("Zuordnung wirklich entfernen?")) return;

                                  aktion(
                                    { action: "deleteMapping", mappingId: mapping.id },
                                    "Die Zuordnung wurde entfernt."
                                  );
                                }}
                              >
                                Entfernen
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="mt-8">
              <h2 className="font-serif text-2xl">Aufträge</h2>
              <p className="mt-2 max-w-2xl text-sm text-[#756f64]">
                Jede Übertragung und jede eingegangene Nachricht steht hier. Nur „Synchronisiert“
                bedeutet, dass der Kanal die Änderung bestätigt hat.
              </p>

              {(data?.jobs ?? []).length === 0 ? (
                <div className="mt-6">
                  <EmptyState title="Keine Aufträge" />
                </div>
              ) : (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-[#e9e2d5] text-xs uppercase tracking-wider text-[#756f64]">
                      <tr>
                        <th className="px-4 py-3">Nr.</th>
                        <th className="px-4 py-3">Richtung</th>
                        <th className="px-4 py-3">Vorgang</th>
                        <th className="px-4 py-3">Bezug</th>
                        <th className="px-4 py-3">Versuche</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#211f1b]/10">
                      {(data?.jobs ?? []).map((job) => (
                        <tr key={job.id}>
                          <td className="px-4 py-4 font-mono text-xs text-[#756f64]">{job.id}</td>
                          <td className="px-4 py-4 text-xs">
                            {job.direction === "INBOUND" ? "← herein" : "→ hinaus"}
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-mono text-xs">{job.operation}</div>
                            {job.dateFrom && job.dateTo && (
                              <div className="text-xs text-[#756f64]">
                                {formatDate(job.dateFrom)} – {formatDate(job.dateTo)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-xs">
                            {job.bookingNumber && (
                              <div className="font-mono font-semibold">{job.bookingNumber}</div>
                            )}
                            {job.externalRef && (
                              <div className="break-all text-[#756f64]">{job.externalRef}</div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-xs">
                            {job.attempts} / {job.maxAttempts}
                            {job.nextAttemptAt && job.status === "PENDING" && (
                              <div className="text-[#756f64]">
                                nächster: {formatDateTime(job.nextAttemptAt)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <Badge tone={JOB_TONE[job.status] ?? "neutral"}>{job.statusLabel}</Badge>
                            {job.lastError && (
                              <div className="mt-1 max-w-xs text-xs text-red-700">
                                {job.lastError}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {["FAILED", "NEEDS_MAPPING", "ATTENTION"].includes(job.status) && (
                              <Button
                                small
                                variant="secondary"
                                disabled={busy}
                                onClick={() =>
                                  aktion(
                                    { action: "retryJob", jobId: job.id },
                                    `Auftrag ${job.id} erneut versucht.`
                                  )
                                }
                              >
                                Erneut versuchen
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="mt-8">
              <h2 className="font-serif text-2xl">Buchungen außerhalb der Website</h2>
              <p className="mt-2 max-w-2xl text-sm text-[#756f64]">
                Externe Reservierungen mit Portalreferenz und selbst erfasste Buchungen aus
                Telefon oder E-Mail. Erfasst werden sie unter „Buchungen“.
              </p>

              {[
                { titel: "Über ein Portal", liste: data?.externalBookings ?? [], extern: true },
                { titel: "Selbst erfasst", liste: data?.manualBookings ?? [], extern: false },
              ].map((gruppe) => (
                <div key={gruppe.titel} className="mt-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#756f64]">
                    {gruppe.titel} ({gruppe.liste.length})
                  </p>

                  {gruppe.liste.length === 0 ? (
                    <p className="mt-2 text-sm text-[#756f64]">Keine Einträge.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {gruppe.liste.map((booking) => (
                        <div
                          key={booking.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#211f1b]/10 bg-[#f5f1e8] px-4 py-3 text-sm"
                        >
                          <span className="font-mono text-xs font-bold">
                            {booking.bookingNumber}
                          </span>
                          <span>{booking.sourceLabel}</span>
                          <span>
                            {formatDate(booking.checkIn)} – {formatDate(booking.checkOut)}
                          </span>
                          {gruppe.extern && booking.externalRef && (
                            <span className="break-all font-mono text-xs text-[#756f64]">
                              {booking.externalRef}
                            </span>
                          )}
                          <Badge tone={JOB_TONE[booking.syncState] ?? "neutral"}>
                            {booking.syncState === "DONE" ? "nichts offen" : booking.syncState}
                          </Badge>
                          {booking.note && (
                            <span className="w-full text-xs text-red-700">{booking.note}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <a
                href="/admin/hotel/buchungen"
                className="mt-6 inline-block text-sm font-bold text-[#315c45] hover:underline"
              >
                Zu den Buchungen →
              </a>
            </Card>
          </>
        )
      )}
    </div>
  );
}
