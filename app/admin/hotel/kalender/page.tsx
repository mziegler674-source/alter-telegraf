"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
import {
  type AllocBlock,
  type AllocDemand,
  type AllocRoom,
  type DayStatus,
  DAY_STATUS_LABELS,
  dayStatus,
} from "@/lib/hotel/allocation";
import { type ApiResult, apiRequest } from "@/lib/hotel/client";
import { ROOM_STATUS_LABELS, type RoomStatus } from "@/lib/hotel/constants";
import { formatEuro } from "@/lib/hotel/pricing";

// Belegungskalender.
//
// Der Kalender zeigt ausschließlich, was in der Datenbank steht. Buchungen
// mit zugewiesenem Zimmer stehen in der Zimmerzeile; Buchungen ohne
// Zuweisung erscheinen in einer eigenen Zeile je Kategorie, damit kein
// Zimmer vorgetäuscht wird, das das Haus nicht vergeben hat.

type RoomRow = {
  id: number;
  number: string;
  floor: number | null;
  roomTypeId: number;
  roomTypeName: string;
  bedType: string;
  bedTypeLabel: string;
  maxOccupancy: number;
  status: string;
  active: boolean;
  notes: string | null;
};

type BookingSpan = {
  bookingRoomId: number;
  bookingId: number | null;
  bookingNumber: string | null;
  status: string | null;
  guestName: string | null;
  roomId: number | null;
  roomTypeId: number;
  checkIn: string;
  checkOut: string;
  persons: number;
  adults: number | null;
  children: number | null;
  bedTypeLabel: string | null;
  breakfast: boolean;
  totalAmount: string | null;
  currency: string;
  paymentMethod: string | null;
};

type Block = {
  id: number;
  roomId: number;
  startDate: string;
  endDate: string;
  reason: string;
  note: string | null;
};

type CategoryDay = {
  date: string;
  assigned: number;
  unassigned: number;
  blocked: number;
  free: number;
  arrivals: number;
  departures: number;
};

type Response = {
  range: { from: string; to: string; days: number; dates: string[] };
  today: string;
  rooms: RoomRow[];
  roomTypes: { id: number; code: string; name: string; maxOccupancy: number; active: boolean }[];
  bookings: BookingSpan[];
  blocks: Block[];
  categoryDays: { roomTypeId: number; rooms: number; days: CategoryDay[] }[];
  blockReasons: readonly { code: string; label: string }[];
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

// Farbe UND Zeichen: Die Farbe allein darf kein Unterscheidungsmerkmal sein.
const ZELLE: Record<DayStatus, { klasse: string; zeichen: string }> = {
  FREI: { klasse: "text-[#756f64]", zeichen: "·" },
  BELEGT: { klasse: "bg-[#315c45] text-white", zeichen: "●" },
  ANREISE: { klasse: "bg-[#315c45] text-white", zeichen: "▶" },
  ABREISE: { klasse: "bg-[#cfe0d6] text-[#264936]", zeichen: "◀" },
  GESPERRT: { klasse: "bg-[#8a682d] text-white", zeichen: "✕" },
  AUSSER_BETRIEB: { klasse: "bg-[#d8d3c8] text-[#4a463f]", zeichen: "—" },
};

const ANSICHTEN = [
  { value: 1, label: "Tag" },
  { value: 7, label: "Woche" },
  { value: 14, label: "14 Tage" },
  { value: 31, label: "Monat" },
];

const wochentag = (iso: string) =>
  new Intl.DateTimeFormat("de-AT", { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`)
  );

const monatKurz = (iso: string) =>
  new Intl.DateTimeFormat("de-AT", { month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`)
  );

const tagesZahl = (iso: string) => iso.slice(8, 10);

/** Samstag und Sonntag werden dezent hinterlegt. */
const istWochenende = (iso: string) => {
  const tag = new Date(`${iso}T12:00:00Z`).getUTCDay();

  return tag === 0 || tag === 6;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`)
  );

function plusTage(iso: string, tage: number) {
  const datum = new Date(`${iso}T12:00:00Z`);
  datum.setUTCDate(datum.getUTCDate() + tage);

  return datum.toISOString().slice(0, 10);
}

export default function KalenderPage() {
  const [data, setData] = useState<Response | null>(null);
  const [hotelReady, setHotelReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [from, setFrom] = useState("");
  const [days, setDays] = useState(14);
  const [ansicht, setAnsicht] = useState<"ZIMMER" | "KATEGORIE">("ZIMMER");
  const [filterTyp, setFilterTyp] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [suche, setSuche] = useState("");

  const [auswahl, setAuswahl] = useState<BookingSpan | null>(null);
  const [sperre, setSperre] = useState<{
    roomId: number;
    roomNumber: string;
    startDate: string;
    endDate: string;
    reason: string;
    note: string;
  } | null>(null);

  const anwenden = useCallback((result: ApiResult<Response>) => {
    if (result.ok) {
      setData(result.data);
      setFrom((bisher) => bisher || result.data.range.from);
      setError("");
    } else {
      if (/Hotel-Stammdaten/.test(result.error)) setHotelReady(false);
      setError(result.error);
    }

    setLoading(false);
  }, []);

  const abfragen = useCallback(() => {
    const params = new URLSearchParams({ days: String(days) });

    if (from) params.set("from", from);

    return apiRequest<Response>(`/api/admin/hotel/kalender?${params.toString()}`);
  }, [from, days]);

  useEffect(() => {
    abfragen().then(anwenden);
  }, [abfragen, anwenden]);

  async function neuLaden() {
    anwenden(await abfragen());
  }

  const dates = data?.range.dates ?? [];
  const heute = data?.today ?? "";

  // Belegungen, die ein konkretes Zimmer haben, und die offenen getrennt.
  const zugewiesen = useMemo(
    () => (data?.bookings ?? []).filter((eintrag) => eintrag.roomId !== null),
    [data]
  );

  const offen = useMemo(
    () => (data?.bookings ?? []).filter((eintrag) => eintrag.roomId === null),
    [data]
  );

  const gesuchteBuchung = suche.trim().toLowerCase();

  const zimmer = useMemo(() => {
    const alle = data?.rooms ?? [];

    return alle.filter((raum) => {
      if (filterTyp && String(raum.roomTypeId) !== filterTyp) return false;
      if (filterStatus && raum.status !== filterStatus) return false;

      if (!gesuchteBuchung) return true;

      if (raum.number.toLowerCase().includes(gesuchteBuchung)) return true;

      // Suche nach Buchungsnummer: Zimmer behalten, die diese Buchung tragen.
      return zugewiesen.some(
        (eintrag) =>
          eintrag.roomId === raum.id &&
          (eintrag.bookingNumber ?? "").toLowerCase().includes(gesuchteBuchung)
      );
    });
  }, [data, filterTyp, filterStatus, gesuchteBuchung, zugewiesen]);

  const demands: AllocDemand[] = useMemo(
    () =>
      zugewiesen.map((eintrag) => ({
        key: String(eintrag.bookingRoomId),
        roomTypeId: eintrag.roomTypeId,
        persons: eintrag.persons,
        bedType: null,
        roomId: eintrag.roomId,
        checkIn: eintrag.checkIn,
        checkOut: eintrag.checkOut,
      })),
    [zugewiesen]
  );

  const blocks: AllocBlock[] = useMemo(
    () =>
      (data?.blocks ?? []).map((block) => ({
        roomId: block.roomId,
        startDate: block.startDate,
        endDate: block.endDate,
      })),
    [data]
  );

  function belegungAn(roomId: number, tag: string) {
    return zugewiesen.find(
      (eintrag) =>
        eintrag.roomId === roomId && eintrag.checkIn <= tag && eintrag.checkOut > tag
    );
  }

  function blockAn(roomId: number, tag: string) {
    return (data?.blocks ?? []).find(
      (block) => block.roomId === roomId && block.startDate <= tag && block.endDate > tag
    );
  }

  async function sperreSpeichern() {
    if (!sperre) return;

    setBusy(true);
    setError("");
    setSuccess("");

    const result = await apiRequest("/api/admin/hotel/kalender", "POST", sperre);

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess(`Zimmer ${sperre.roomNumber} ist gesperrt. Die Verfügbarkeit berücksichtigt das.`);
    setSperre(null);
    await neuLaden();
  }

  async function sperreEntfernen(block: Block, roomNumber: string) {
    if (!window.confirm(`Sperre für Zimmer ${roomNumber} aufheben?`)) return;

    setBusy(true);
    setError("");
    setSuccess("");

    const result = await apiRequest("/api/admin/hotel/kalender", "DELETE", { id: block.id });

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess(`Die Sperre für Zimmer ${roomNumber} wurde aufgehoben.`);
    await neuLaden();
  }

  // Spalten so breit, dass Datum und Zeichen lesbar bleiben; im Monat
  // schmaler, dafür scrollt die Tabelle waagrecht.
  const spaltenBreite =
    days <= 7 ? "min-w-[76px]" : days <= 14 ? "min-w-[60px]" : "min-w-[46px]";

  const zelleHoehe = "h-14";

  /** Gehören zwei aufeinanderfolgende Tage zur selben Belegung? */
  function gleicheBelegung(roomId: number, tag: string, index: number) {
    if (index === 0) return false;

    const davor = belegungAn(roomId, dates[index - 1]);
    const jetzt = belegungAn(roomId, tag);

    return Boolean(davor && jetzt && davor.bookingRoomId === jetzt.bookingRoomId);
  }

  return (
    <div>
      <PageIntro
        eyebrow="Hotel"
        title="Kalender"
        description="Belegung je physischem Zimmer und je Kategorie. Grundlage sind dieselben Buchungen und Zimmersperren, mit denen auch die Online-Buchung rechnet."
      />

      <div className="mt-8 space-y-3">
        {!loading && !hotelReady && <HotelMissing />}
        {error && <Alert kind="error">{error}</Alert>}
        {success && <Alert kind="success">✓ {success}</Alert>}
      </div>

      <Card className="mt-8">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex gap-2">
            <Button
              small
              variant="secondary"
              onClick={() => setFrom(plusTage(from || heute, -days))}
            >
              ← Zurück
            </Button>
            <Button small variant="secondary" onClick={() => setFrom(heute)}>
              Heute
            </Button>
            <Button
              small
              variant="secondary"
              onClick={() => setFrom(plusTage(from || heute, days))}
            >
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

          <Field label="Zeitraum">
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

          <Field label="Ansicht">
            <select
              className={inputClass}
              value={ansicht}
              onChange={(e) => setAnsicht(e.target.value as "ZIMMER" | "KATEGORIE")}
            >
              <option value="ZIMMER">Physische Zimmer</option>
              <option value="KATEGORIE">Zimmerkategorien</option>
            </select>
          </Field>

          <Field label="Kategorie">
            <select
              className={inputClass}
              value={filterTyp}
              onChange={(e) => setFilterTyp(e.target.value)}
            >
              <option value="">Alle</option>
              {(data?.roomTypes ?? []).map((typ) => (
                <option key={typ.id} value={typ.id}>
                  {typ.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Zimmerstatus">
            <select
              className={inputClass}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Alle</option>
              {Object.entries(ROOM_STATUS_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Suche" hint="Zimmernummer oder Buchungsnummer.">
            <input
              className={inputClass}
              value={suche}
              placeholder="z. B. 21 oder AT-2026-…"
              onChange={(e) => setSuche(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#211f1b]/10 pt-5 text-xs">
          <span className="font-bold uppercase tracking-wider text-[#756f64]">Legende</span>

          {(Object.keys(ZELLE) as DayStatus[]).map((status) => (
            <span key={status} className="flex items-center gap-2">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded ${ZELLE[status].klasse}`}
              >
                {ZELLE[status].zeichen}
              </span>
              {DAY_STATUS_LABELS[status]}
            </span>
          ))}
        </div>
      </Card>

      {loading ? (
        <div className="mt-8">
          <EmptyState title="Wird geladen..." />
        </div>
      ) : ansicht === "ZIMMER" ? (
        <section className="mt-8">
          {zimmer.length === 0 ? (
            <EmptyState title="Keine Zimmer zu diesen Filtern" />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#211f1b]/10 bg-white shadow-sm">
              {/* Ein Behälter für beide Richtungen: Die Zimmerspalte bleibt
                  beim waagrechten Scrollen stehen, der Datumskopf beim
                  senkrechten. */}
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="text-xs text-[#756f64]">
                    <tr>
                      <th className="sticky left-0 top-0 z-40 min-w-[200px] border-b-2 border-r-2 border-[#211f1b]/15 bg-[#e9e2d5] px-4 py-3 text-left sm:min-w-[230px]">
                        Zimmer
                      </th>
                      {dates.map((tag) => (
                        <th
                          key={tag}
                          title={formatDate(tag)}
                          className={`${spaltenBreite} sticky top-0 z-30 border-b-2 border-l border-[#211f1b]/15 px-1 py-2 text-center ${
                            tag === heute
                              ? "bg-[#f4ead5] font-bold text-[#8a682d]"
                              : istWochenende(tag)
                                ? "bg-[#e3dbca]"
                                : "bg-[#e9e2d5]"
                          }`}
                        >
                          <div className="uppercase tracking-wide">{wochentag(tag)}</div>
                          <div className="text-base font-bold leading-tight text-[#211f1b]">
                            {tagesZahl(tag)}
                          </div>
                          <div className="text-[10px] leading-tight">
                            {tagesZahl(tag) === "01" || tag === dates[0] ? monatKurz(tag) : " "}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {zimmer.map((raum, zeilenIndex) => {
                      const allocRoom: AllocRoom = raum as unknown as AllocRoom;
                      const zeilenFarbe = zeilenIndex % 2 === 0 ? "bg-white" : "bg-[#faf7f0]";

                      return (
                        <tr key={raum.id} className={`${zeilenFarbe} border-b border-[#211f1b]/10`}>
                          <th
                            className={`sticky left-0 z-20 min-w-[200px] border-r-2 border-[#211f1b]/15 px-4 py-3 text-left align-top font-normal sm:min-w-[230px] ${zeilenFarbe}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold">Zimmer {raum.number}</span>
                              {raum.status !== "CLEAN" && (
                                <Badge
                                  tone={raum.status === "OUT_OF_SERVICE" ? "red" : "amber"}
                                >
                                  {ROOM_STATUS_LABELS[raum.status as RoomStatus] ?? raum.status}
                                </Badge>
                              )}
                            </div>

                            <div className="text-xs text-[#756f64]">
                              {raum.roomTypeName} · {raum.bedTypeLabel} · max.{" "}
                              {raum.maxOccupancy}
                            </div>

                            <button
                              type="button"
                              className="mt-1 text-xs font-bold text-[#315c45] hover:underline"
                              onClick={() =>
                                setSperre({
                                  roomId: raum.id,
                                  roomNumber: raum.number,
                                  startDate: from || heute,
                                  endDate: plusTage(from || heute, 1),
                                  reason: "MAINTENANCE",
                                  note: "",
                                })
                              }
                            >
                              Sperren
                            </button>
                          </th>

                          {dates.map((tag, index) => {
                            const status = dayStatus(allocRoom, tag, demands, blocks);
                            const stil = ZELLE[status];
                            const belegung = belegungAn(raum.id, tag);
                            const block = blockAn(raum.id, tag);
                            const belegt = status === "BELEGT" || status === "ANREISE";

                            // Zusammenhängende Belegung: Die senkrechte Linie
                            // innerhalb eines Blocks entfällt, dafür runden
                            // Anfang und Ende den Block ab.
                            const fortsetzung = belegt && gleicheBelegung(raum.id, tag, index);
                            const endetHier =
                              belegt &&
                              !(
                                index + 1 < dates.length &&
                                gleicheBelegung(raum.id, dates[index + 1], index + 1)
                              );

                            const titel = belegung
                              ? `${belegung.bookingNumber ?? ""} · ${belegung.guestName ?? ""} · ${formatDate(
                                  belegung.checkIn
                                )} bis ${formatDate(belegung.checkOut)} · ${
                                  DAY_STATUS_LABELS[status]
                                } am ${formatDate(tag)}`
                              : block
                                ? `Gesperrt (${
                                    data?.blockReasons.find((grund) => grund.code === block.reason)
                                      ?.label ?? block.reason
                                  }) · ${formatDate(block.startDate)} bis ${formatDate(
                                    block.endDate
                                  )} · zum Aufheben klicken`
                                : `Zimmer ${raum.number} · ${formatDate(tag)} · ${
                                    DAY_STATUS_LABELS[status]
                                  }`;

                            return (
                              <td
                                key={tag}
                                className={`${spaltenBreite} p-0 text-center align-middle ${
                                  fortsetzung ? "" : "border-l border-[#211f1b]/10"
                                }`}
                              >
                                <button
                                  type="button"
                                  title={titel}
                                  aria-label={titel}
                                  onClick={() => {
                                    if (belegung) setAuswahl(belegung);
                                    else if (block) sperreEntfernen(block, raum.number);
                                  }}
                                  className={`${zelleHoehe} w-full px-1 text-xs font-bold ${
                                    status === "FREI"
                                      ? istWochenende(tag)
                                        ? "bg-[#efe9dc] text-[#756f64]"
                                        : "text-[#756f64]"
                                      : stil.klasse
                                  } ${fortsetzung ? "" : belegt ? "rounded-l-md" : ""} ${
                                    endetHier ? "rounded-r-md" : ""
                                  } ${belegung || block ? "cursor-pointer" : "cursor-default"}`}
                                >
                                  {status === "ANREISE" && belegung ? (
                                    <span className="block truncate">
                                      {stil.zeichen} {belegung.guestName?.split(" ").pop() ?? ""}
                                    </span>
                                  ) : (
                                    <span aria-hidden="true">{stil.zeichen}</span>
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {offen.length > 0 && (
            <Card className="mt-6">
              <h2 className="font-serif text-xl">Noch ohne Zimmerzuweisung</h2>
              <p className="mt-2 text-sm text-[#756f64]">
                Diese Buchungen belegen ihre Kategorie, haben aber noch kein konkretes Zimmer.
                Sie erscheinen bewusst nicht in einer Zimmerzeile.
              </p>

              <div className="mt-4 space-y-2">
                {offen.map((eintrag) => (
                  <button
                    key={eintrag.bookingRoomId}
                    type="button"
                    onClick={() => setAuswahl(eintrag)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-[#211f1b]/10 bg-[#f5f1e8] px-4 py-3 text-left text-sm hover:border-[#b08a4a]"
                  >
                    <span className="font-mono text-xs font-bold">{eintrag.bookingNumber}</span>
                    <span>{eintrag.guestName}</span>
                    <span>
                      {formatDate(eintrag.checkIn)} – {formatDate(eintrag.checkOut)}
                    </span>
                    <span className="text-[#756f64]">
                      {data?.roomTypes.find((typ) => typ.id === eintrag.roomTypeId)?.name}
                    </span>
                    <Badge tone="amber">Zimmer offen</Badge>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </section>
      ) : (
        <section className="mt-8">
          <div className="overflow-hidden rounded-2xl border border-[#211f1b]/10 bg-white shadow-sm">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="text-xs text-[#756f64]">
                  <tr>
                    <th className="sticky left-0 top-0 z-40 min-w-[200px] border-b-2 border-r-2 border-[#211f1b]/15 bg-[#e9e2d5] px-4 py-3 sm:min-w-[230px]">
                      Kategorie
                    </th>
                    {dates.map((tag) => (
                      <th
                        key={tag}
                        title={formatDate(tag)}
                        className={`${spaltenBreite} sticky top-0 z-30 border-b-2 border-l border-[#211f1b]/15 px-1 py-2 text-center ${
                          tag === heute
                            ? "bg-[#f4ead5] font-bold text-[#8a682d]"
                            : istWochenende(tag)
                              ? "bg-[#e3dbca]"
                              : "bg-[#e9e2d5]"
                        }`}
                      >
                        <div className="uppercase tracking-wide">{wochentag(tag)}</div>
                        <div className="text-base font-bold leading-tight text-[#211f1b]">
                          {tagesZahl(tag)}
                        </div>
                        <div className="text-[10px] leading-tight">
                          {tagesZahl(tag) === "01" || tag === dates[0] ? monatKurz(tag) : " "}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {(data?.categoryDays ?? [])
                    .filter((zeile) => !filterTyp || String(zeile.roomTypeId) === filterTyp)
                    .map((zeile, zeilenIndex) => {
                      const typ = data?.roomTypes.find((eintrag) => eintrag.id === zeile.roomTypeId);
                      const zeilenFarbe = zeilenIndex % 2 === 0 ? "bg-white" : "bg-[#faf7f0]";

                      return (
                        <tr key={zeile.roomTypeId} className={`${zeilenFarbe} border-b border-[#211f1b]/10`}>
                          <th
                            className={`sticky left-0 z-20 min-w-[200px] border-r-2 border-[#211f1b]/15 px-4 py-3 text-left align-top font-normal sm:min-w-[230px] ${zeilenFarbe}`}
                          >
                            <div className="text-base font-bold">{typ?.name ?? "–"}</div>
                            <div className="text-xs text-[#756f64]">
                              {zeile.rooms} Zimmer · max. {typ?.maxOccupancy} Personen
                            </div>
                          </th>

                          {zeile.days.map((tag) => {
                            const belegt = tag.assigned + tag.unassigned;
                            const voll = tag.free === 0;

                            return (
                              <td
                                key={tag.date}
                                className={`${spaltenBreite} border-l border-[#211f1b]/10 p-0 text-center`}
                              >
                                <div
                                  title={`${formatDate(tag.date)}: ${belegt} belegt (davon ${tag.unassigned} ohne Zimmer), ${tag.blocked} gesperrt, ${tag.free} frei, ${tag.arrivals} Anreisen, ${tag.departures} Abreisen`}
                                  className={`flex ${zelleHoehe} flex-col items-center justify-center text-xs font-bold ${
                                    voll
                                      ? "bg-[#315c45] text-white"
                                      : belegt > 0
                                        ? "bg-[#cfe0d6] text-[#264936]"
                                        : istWochenende(tag.date)
                                          ? "bg-[#efe9dc] text-[#756f64]"
                                          : "text-[#756f64]"
                                  }`}
                                >
                                  <span>{tag.free}</span>
                                  <span className="text-[10px] font-normal opacity-80">
                                    {voll ? "voll" : "frei"}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-3 text-xs text-[#756f64]">
            Die Zahl nennt die freien Zimmer der Kategorie an diesem Tag. Gesperrte Zimmer und
            Buchungen ohne Zuweisung sind bereits abgezogen. Ob eine Kategorie für eine bestimmte
            Personenzahl noch buchbar ist, entscheidet zusätzlich die Bettenlage des einzelnen
            Zimmers – das prüft die Buchungsstrecke.
          </p>
        </section>
      )}

      {sperre && (
        <Card className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif text-2xl">Zimmer {sperre.roomNumber} sperren</h2>
            <Button variant="ghost" small onClick={() => setSperre(null)}>
              Abbrechen
            </Button>
          </div>

          <p className="mt-2 text-sm text-[#756f64]">
            Eine Sperre wirkt wie eine Belegung: Das Zimmer steht der Online-Buchung in diesem
            Zeitraum nicht zur Verfügung. Der Endtag ist der Abreisetag – an ihm ist das Zimmer
            wieder frei.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Von" required>
              <input
                className={inputClass}
                type="date"
                value={sperre.startDate}
                onChange={(e) => setSperre({ ...sperre, startDate: e.target.value })}
              />
            </Field>

            <Field label="Bis" required hint="Exklusiv, wie ein Abreisetag.">
              <input
                className={inputClass}
                type="date"
                value={sperre.endDate}
                onChange={(e) => setSperre({ ...sperre, endDate: e.target.value })}
              />
            </Field>

            <Field label="Grund" required>
              <select
                className={inputClass}
                value={sperre.reason}
                onChange={(e) => setSperre({ ...sperre, reason: e.target.value })}
              >
                {(data?.blockReasons ?? []).map((grund) => (
                  <option key={grund.code} value={grund.code}>
                    {grund.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Notiz">
              <input
                className={inputClass}
                value={sperre.note}
                onChange={(e) => setSperre({ ...sperre, note: e.target.value })}
              />
            </Field>
          </div>

          <div className="mt-6">
            <Button onClick={sperreSpeichern} disabled={busy}>
              Sperre eintragen
            </Button>
          </div>
        </Card>
      )}

      {auswahl && (
        <Card className="mt-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl">Buchung {auswahl.bookingNumber}</h2>
              <p className="mt-1 text-sm text-[#756f64]">{auswahl.guestName}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral">
                {STATUS_LABELS[auswahl.status ?? ""] ?? auswahl.status ?? "–"}
              </Badge>
              <Button variant="ghost" small onClick={() => setAuswahl(null)}>
                Schließen
              </Button>
            </div>
          </div>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ["Anreise", formatDate(auswahl.checkIn)],
              ["Abreise", formatDate(auswahl.checkOut)],
              [
                "Gäste",
                auswahl.adults !== null
                  ? `${auswahl.adults} Erwachsene, ${auswahl.children ?? 0} Kinder`
                  : `${auswahl.persons} Person(en)`,
              ],
              [
                "Zimmerkategorie",
                data?.roomTypes.find((typ) => typ.id === auswahl.roomTypeId)?.name ?? "–",
              ],
              [
                "Zugewiesenes Zimmer",
                auswahl.roomId
                  ? `Zimmer ${data?.rooms.find((raum) => raum.id === auswahl.roomId)?.number ?? "?"}`
                  : "noch nicht zugewiesen",
              ],
              ["Bettvariante", auswahl.bedTypeLabel ?? "–"],
              ["Frühstück", auswahl.breakfast ? "ja" : "nein"],
              [
                "Gesamtpreis",
                auswahl.totalAmount
                  ? `${formatEuro(auswahl.totalAmount)} ${auswahl.currency}`
                  : "–",
              ],
              [
                "Zahlung",
                auswahl.paymentMethod === "CARD_GUARANTEE"
                  ? "Kreditkarte als Garantie"
                  : "vor Ort im Hotel",
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-6 rounded-xl border border-[#211f1b]/10 bg-[#f5f1e8] px-4 py-3 text-sm"
              >
                <dt className="text-[#756f64]">{label}</dt>
                <dd className="text-right font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 text-xs text-[#756f64]">
            Zimmerzuweisung, Bestätigung und Storno erfolgen im Buchungsdetail. Zahlungsdaten
            werden hier nicht angezeigt.
          </p>

          <a
            href="/admin/hotel/buchungen"
            className="mt-4 inline-block text-sm font-bold text-[#315c45] hover:underline"
          >
            Zum Buchungsdetail →
          </a>
        </Card>
      )}
    </div>
  );
}
