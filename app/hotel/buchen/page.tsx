"use client";

import { type ReactNode, useRef, useState } from "react";

import Navbar from "@/components/Navbar";
import { CardGuarantee, type CardGuaranteeHandle } from "@/components/hotel/CardGuarantee";
import {
  RoomCard,
  RoomDetail,
  type ShowcaseRoom,
} from "@/components/hotel/RoomPresentation";
import { COUNTRIES } from "@/lib/hotel/countries";
import {
  type FieldErrors,
  type FieldName,
  FIELD_ORDER,
  MAX,
  validateGuest,
} from "@/lib/hotel/guest-validation";
import { formatMoney } from "@/lib/money";

type BedOption = { bedType: string; label: string; roomsAvailable: number };

type Totals = {
  nights: number;
  roomsTotal: string;
  discountPercent: number;
  discountTotal: string;
  /** Name der wirksamen Aktion, oder null. */
  discountName: string | null;
  breakfastTotal: string;
  total: string;
};

type PromotionInfo = {
  code: string;
  name: string;
  percent: number;
  source: "AUTOMATIC" | "CODE";
};

type CodeResult = {
  code: string | null;
  status: "NONE" | "APPLIED" | "UNKNOWN" | "NOT_APPLICABLE" | "OUTPERFORMED";
  reason: string | null;
};

type Offer = {
  roomTypeId: number;
  code: string;
  name: string;
  slug: string;
  description: string | null;
  longDescription: string | null;
  persons: number;
  maxOccupancy: number;
  sizeSqm: number | null;
  images: { id: number; src: string; alt: string }[];
  amenities: { code: string; name: string; icon: string | null }[];
  /** Niedrigster Preis einer Nacht - bei schwankenden Preisen ein „ab“-Wert. */
  pricePerNight: string;
  pricePerNightMax: string;
  priceVaries: boolean;
  hasIndividualPrice: boolean;
  nightPrices: { date: string; amount: string; source: "BASE" | "DATE" }[];
  roomsAvailable: number;
  bedTypes: BedOption[];
  totals: Totals;
  cancellationPreview: CancellationPreview | null;
  promotion: PromotionInfo | null;
  promotionCode: CodeResult;
};

/** Serverseitig gerechnet - der Browser rechnet hier nichts nach. */
type CancellationPreview = {
  freeUntilDate: string | null;
  feeAmount: string | null;
  feeReason: string | null;
  noShowAmount: string | null;
};

// Das Angebot des Servers in die Darstellung der Zimmerkarte uebersetzen.
// Preis und Verfuegbarkeit kommen unveraendert aus der Antwort.
const toShowcase = (offer: Offer): ShowcaseRoom => ({
  roomTypeId: offer.roomTypeId,
  name: offer.name,
  shortDescription: offer.description,
  description: offer.longDescription,
  sizeSqm: offer.sizeSqm,
  persons: offer.persons,
  maxOccupancy: offer.maxOccupancy,
  images: offer.images,
  amenities: offer.amenities,
  bedTypes: offer.bedTypes.map(({ bedType, label }) => ({ bedType, label })),
  price: offer.pricePerNight,
  // Bei schwankenden Tagespreisen ist der Kartenpreis ein „ab“-Wert.
  priceIsFrom: offer.priceVaries,
  roomsAvailable: offer.roomsAvailable,
});

type Cancellation = {
  name: string;
  text: string[];
  /** Letzter kostenfreier Tag. Nur in der Suche vorhanden. */
  freeUntilDate?: string | null;
  /** Streuwert des angezeigten Textes, der beim Absenden zurueckgeht. */
  hash?: string;
};

type SearchResult = {
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  persons: number;
  breakfast: boolean;
  breakfastPricePerPersonNight: string | null;
  promotionCode: CodeResult;
  cancellation: Cancellation | null;
  guarantee: { required: boolean; available: boolean };
  offers: Offer[];
};

type Confirmation = {
  bookingNumber: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  roomTypeName: string;
  bedTypeLabel: string;
  breakfast: boolean;
  totals: Totals;
  cancellation: Cancellation | null;
  currency: string;
  paymentMethod: string;
  guest: { firstName: string; lastName: string; email: string };
  nightPrices?: { date: string; amount: string; source: "BASE" | "DATE" }[] | null;
  /** true, wenn das Absenden eine bereits bestehende Buchung getroffen hat. */
  duplicate?: boolean;
  /** Stand des Bestätigungsversands: SENT, SKIPPED, FAILED oder null. */
  confirmationMail?: string | null;
};



const formatDate = (value: string) =>
  new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  );

const today = () => new Date().toISOString().slice(0, 10);

const input =
  "mt-2 w-full rounded-xl border border-[#211f1b]/15 bg-white px-4 py-3 text-[#211f1b] outline-none transition focus:border-[#b08a4a]";

const emptyGuest = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  street: "",
  postalCode: "",
  city: "",
  countryCode: "AT",
  message: "",
};

/**
 * Ein Formularfeld mit Beschriftung, Pflichtkennzeichnung und zugänglicher
 * Fehlermeldung.
 *
 * Der Fehler wird NICHT nur farblich gezeigt: Er steht als Text unter dem
 * Feld, beginnt mit einem Hinweiszeichen, ist über aria-describedby mit dem
 * Feld verbunden und setzt aria-invalid. Damit funktioniert er auch für
 * Vorlesesoftware und bei Farbenblindheit.
 */
function GuestField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  optional,
  type = "text",
  autoComplete,
  inputMode,
  maxLength,
  placeholder,
  className = "",
  children,
}: {
  id: FieldName;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error: string | null;
  optional?: boolean;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  maxLength?: number;
  placeholder?: string;
  className?: string;
  children?: ReactNode;
}) {
  const fehlerId = `${id}-fehler`;

  return (
    <label className={`block ${className}`} htmlFor={id}>
      <span className="text-sm font-bold">
        {label}
        {optional ? (
          <span className="ml-2 font-normal text-[#756f64]">optional</span>
        ) : (
          <span className="ml-1 text-[#b08a4a]" aria-hidden="true">
            *
          </span>
        )}
      </span>

      {children ?? (
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-required={optional ? undefined : true}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? fehlerId : undefined}
          className={`mt-2 w-full rounded-xl border bg-white px-4 py-3.5 text-base outline-none transition focus:ring-2 focus:ring-[#b08a4a]/40 ${
            error
              ? "border-red-400 focus:border-red-500"
              : "border-[#211f1b]/15 focus:border-[#b08a4a]"
          }`}
        />
      )}

      {error && (
        <span id={fehlerId} role="alert" className="mt-2 block text-sm font-semibold text-red-700">
          <span aria-hidden="true">⚠ </span>
          {error}
        </span>
      )}
    </label>
  );
}

export default function BookingPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [stay, setStay] = useState({ checkIn: "", checkOut: "", adults: "2", children: "0" });
  const [breakfast, setBreakfast] = useState(false);
  // Aktionscode des Gastes. Geprüft wird ausschließlich serverseitig; dieses
  // Feld hält nur die Eingabe.
  const [promoCode, setPromoCode] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [roomTypeId, setRoomTypeId] = useState<number | null>(null);
  const [bedType, setBedType] = useState<string>("");
  const [guest, setGuest] = useState(emptyGuest);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const karte = useRef<CardGuaranteeHandle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Welche Felder hat der Gast schon verlassen? Erst dann wird ein Fehler
  // gezeigt - sonst erscheint eine Meldung, bevor überhaupt getippt wurde.
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [showAllErrors, setShowAllErrors] = useState(false);
  // Hinweis, wenn sich der Preis zwischen Übersicht und Absenden geändert hat.
  const [priceNotice, setPriceNotice] = useState("");

  const selected = result?.offers.find((offer) => offer.roomTypeId === roomTypeId) ?? null;

  async function search(withBreakfast = breakfast, keepSelection = false, code = promoCode) {
    setBusy(true);
    setError("");

    const response = await fetch("/api/hotel/verfuegbarkeit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        adults: Number(stay.adults),
        children: Number(stay.children),
        breakfast: withBreakfast,
        // Bei jeder Suche mitgeschickt: Ändern sich Reisedaten oder
        // Verpflegung, wird die Rabattberechtigung neu geprüft.
        promotionCode: code,
      }),
    });

    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(data.error || "Die Suche ist fehlgeschlagen.");
      return;
    }

    setResult(data);

    if (!keepSelection) {
      setRoomTypeId(null);
      setBedType("");
    }

    setStep(2);
  }

  function chooseOffer(offer: Offer) {
    setRoomTypeId(offer.roomTypeId);
    setBedType(offer.bedTypes.length === 1 ? offer.bedTypes[0].bedType : "");
  }

  async function submit() {
    setBusy(true);
    setError("");

    // Verlangt die Rate eine Garantie, wird die Karte zuerst hinterlegt.
    // Schlägt das fehl, entsteht keine Buchung.
    let cardSetupRef: string | null = null;

    if (result?.guarantee.required) {
      if (!karte.current) {
        setBusy(false);
        setError("Bitte warten Sie, bis das Kartenfeld geladen ist.");
        return;
      }

      try {
        cardSetupRef = await karte.current.confirm();
      } catch (fehler) {
        setBusy(false);
        setError(fehler instanceof Error ? fehler.message : "Die Karte wurde nicht akzeptiert.");
        return;
      }
    }

    const response = await fetch("/api/hotel/buchung", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        adults: Number(stay.adults),
        children: Number(stay.children),
        breakfast,
        roomTypeId,
        bedType,
        guest,
        acceptedTerms: terms,
        acceptedPrivacy: privacy,
        cardSetupRef,
        // Der Code wird beim Anlegen erneut geprüft. Der Preis entsteht
        // ausschließlich auf dem Server.
        promotionCode: promoCode,
        // Nur zum Vergleich: Weicht der Serverpreis ab, wird nicht gebucht.
        expectedTotal: selected?.totals.total ?? null,
        // Belegt, welche Stornobedingungen auf dem Bildschirm standen. Der
        // Server rechnet seinen eigenen Streuwert und vergleicht.
        acceptedPolicyHash: result?.cancellation?.hash ?? null,
      }),
    });

    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      // Der Preis hat sich zwischen Übersicht und Absenden geändert. Es
      // entstand KEINE Buchung; der Gast sieht den neuen Betrag und
      // entscheidet erneut.
      if (response.status === 409 && data?.details?.priceChanged) {
        setPriceNotice(
          `Der Gesamtbetrag hat sich von ${formatMoney(
            data.details.expectedTotal
          )} auf ${formatMoney(
            data.details.actualTotal
          )} geändert. Es wurde noch nichts gebucht – bitte prüfen Sie die Übersicht und senden Sie dann erneut ab.`
        );

        await search(breakfast, true);
        setStep(4);
        return;
      }

      // Die Stornobedingungen wurden geändert, seit sie angezeigt wurden.
      // Auch hier entstand KEINE Buchung; der Gast bestätigt den neuen
      // Stand und sendet erneut ab.
      if (response.status === 409 && data?.details?.policyChanged) {
        setPriceNotice(
          "Die Stornobedingungen wurden geändert, seit sie Ihnen angezeigt wurden. Es wurde noch nichts gebucht – bitte lesen Sie den neuen Stand unten und senden Sie dann erneut ab."
        );
        setTerms(false);

        await search(breakfast, true);
        setStep(4);
        return;
      }

      setError(data.error || "Die Buchung konnte nicht abgeschlossen werden.");
      return;
    }

    setPriceNotice("");

    setConfirmation(data.booking);
    setStep(5);
  }

  // Dieselbe Prüfung wie auf dem Server (lib/hotel/guest-validation.ts).
  // Verbindlich ist die Serverprüfung; hier dient sie der direkten Führung.
  const guestErrors: FieldErrors = validateGuest(guest);
  const guestComplete = Object.keys(guestErrors).length === 0;

  const fehlerFuer = (feld: FieldName) =>
    (showAllErrors || touched[feld]) && guestErrors[feld] ? (guestErrors[feld] as string) : null;

  const markiere = (feld: FieldName) => setTouched((bisher) => ({ ...bisher, [feld]: true }));

  /** Springt zum ersten beanstandeten Feld. */
  function zeigeFehler() {
    setShowAllErrors(true);

    const erstes = FIELD_ORDER.find((feld) => guestErrors[feld]);

    if (!erstes) return;

    const element = document.getElementById(erstes);

    if (element) {
      element.scrollIntoView({ block: "center" });
      element.focus();
    }
  }

  const steps = ["Aufenthalt", "Zimmer", "Ihre Daten", "Prüfen", "Bestätigung"];

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#211f1b]">
      <Navbar section="hotel" tone="dunkel" />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-32 lg:pt-40">
        <div className="flex items-center gap-4">
          <span className="h-px w-12 bg-[#b08a4a]" />
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#b08a4a]">
            Hotel Alter Telegraf
          </p>
        </div>

        <h1 className="mt-6 font-serif text-4xl leading-tight sm:text-5xl">
          Zimmer
          <br />
          <span className="italic text-[#b08a4a]">buchen.</span>
        </h1>

        <ol className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-b border-[#211f1b]/10 pb-4 text-xs uppercase tracking-[0.14em]">
          {steps.map((label, index) => (
            <li
              key={label}
              className={
                step === index + 1
                  ? "font-bold text-[#211f1b]"
                  : step > index + 1
                    ? "text-[#b08a4a]"
                    : "text-[#756f64]/50"
              }
            >
              {index + 1}. {label}
            </li>
          ))}
        </ol>

        {error && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}

        {/* SCHRITT 1 */}
        {step === 1 && (
          <section className="mt-10">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold">Anreise</span>
                <input
                  type="date"
                  min={today()}
                  value={stay.checkIn}
                  onChange={(e) => setStay({ ...stay, checkIn: e.target.value })}
                  className={input}
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold">Abreise</span>
                <input
                  type="date"
                  min={stay.checkIn || today()}
                  value={stay.checkOut}
                  onChange={(e) => setStay({ ...stay, checkOut: e.target.value })}
                  className={input}
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold">Erwachsene</span>
                <select
                  value={stay.adults}
                  onChange={(e) => setStay({ ...stay, adults: e.target.value })}
                  className={input}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-bold">Kinder</span>
                <select
                  value={stay.children}
                  onChange={(e) => setStay({ ...stay, children: e.target.value })}
                  className={input}
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={() => search()}
              disabled={busy || !stay.checkIn || !stay.checkOut}
              className="mt-8 rounded-full bg-[#211f1b] px-8 py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#3a3630] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Suche läuft..." : "Zimmer suchen"}
            </button>
          </section>
        )}

        {/* SCHRITT 2 */}
        {step === 2 && result && (
          <section className="mt-10">
            <p className="text-sm text-[#756f64]">
              {formatDate(result.checkIn)} bis {formatDate(result.checkOut)} ·{" "}
              {result.nights} {result.nights === 1 ? "Nacht" : "Nächte"} ·{" "}
              {result.persons} {result.persons === 1 ? "Person" : "Personen"}
            </p>

            {result.breakfastPricePerPersonNight && (
              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-[#211f1b]/10 bg-white p-4">
                <input
                  type="checkbox"
                  checked={breakfast}
                  onChange={(e) => {
                    setBreakfast(e.target.checked);
                    search(e.target.checked, true);
                  }}
                  className="mt-0.5 h-5 w-5 accent-[#b08a4a]"
                />
                <span>
                  <span className="block font-semibold">Frühstück hinzufügen</span>
                  <span className="mt-1 block text-sm text-[#756f64]">
                    {formatMoney(result.breakfastPricePerPersonNight)} pro Person und Nacht
                  </span>
                </span>
              </label>
            )}

            {result.offers.length === 0 ? (
              <div className="mt-8 rounded-xl border border-[#211f1b]/10 bg-white p-8 text-center">
                <p className="font-serif text-2xl">Keine Verfügbarkeit</p>
                <p className="mt-2 text-sm text-[#756f64]">
                  Für diesen Zeitraum und diese Personenzahl haben wir derzeit kein Zimmer
                  frei. Rufen Sie uns gerne an:{" "}
                  <a href="tel:+43316686558" className="underline">+43 316 686558</a>.
                </p>
              </div>
            ) : (
              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                {result.offers.map((offer) => {
                  const active = offer.roomTypeId === roomTypeId;
                  const room = toShowcase(offer);
                  const twin = offer.bedTypes.find(
                    (option) => option.bedType === "ZWEI_EINZELBETTEN"
                  );

                  return (
                    <RoomCard
                      key={offer.roomTypeId}
                      room={room}
                      selected={active}
                      selectLabel={active ? "Weiter" : "Auswählen"}
                      onDetails={() => setDetailId(offer.roomTypeId)}
                      onSelect={() => {
                        if (!active) {
                          chooseOffer(offer);
                          return;
                        }

                        if (bedType) setStep(3);
                      }}
                    >
                      {/* Die Bettkonfiguration ist verkaufsrelevant und steht
                          deshalb direkt auf der Karte, nicht in einem
                          Zusatzschritt. */}
                      {offer.bedTypes.length > 1 ? (
                        <fieldset className="mt-5 border-t border-[#211f1b]/10 pt-5">
                          <legend className="text-sm font-bold">Bettkonfiguration</legend>

                          {twin && (
                            <p className="mt-1 text-sm text-[#315c45]">
                              Sie bevorzugen getrennte Betten? Das ist hier möglich.
                            </p>
                          )}

                          <div className="mt-3 grid gap-2">
                            {offer.bedTypes.map((option) => (
                              <label
                                key={option.bedType}
                                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 transition ${
                                  active && bedType === option.bedType
                                    ? "bg-[#e9e2d5]"
                                    : "bg-[#f5f1e8]"
                                }`}
                              >
                                <span className="flex items-center gap-3">
                                  <input
                                    type="radio"
                                    name={`bedType-${offer.roomTypeId}`}
                                    checked={active && bedType === option.bedType}
                                    onChange={() => {
                                      setRoomTypeId(offer.roomTypeId);
                                      setBedType(option.bedType);
                                    }}
                                    className="h-4 w-4 accent-[#b08a4a]"
                                  />
                                  <span className="text-sm font-semibold">{option.label}</span>
                                </span>

                                <span className="text-xs text-[#756f64]">
                                  {option.roomsAvailable === 1
                                    ? "1 Zimmer"
                                    : `${option.roomsAvailable} Zimmer`}
                                </span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      ) : (
                        offer.bedTypes.length === 1 && (
                          <p className="mt-5 border-t border-[#211f1b]/10 pt-5 text-sm text-[#756f64]">
                            Bettkonfiguration: {offer.bedTypes[0].label}
                          </p>
                        )
                      )}

                      <p className="mt-5 text-sm text-[#756f64]">
                        Gesamt für {offer.totals.nights}{" "}
                        {offer.totals.nights === 1 ? "Nacht" : "Nächte"}:{" "}
                        <span className="font-bold text-[#211f1b]">
                          {formatMoney(offer.totals.total)}
                        </span>
                        {Number(offer.totals.discountTotal) > 0 && (
                          <span className="ml-2 text-[#b08a4a]">
                            inkl. {formatMoney(offer.totals.discountTotal)} Rabatt
                            {offer.totals.discountName ? ` (${offer.totals.discountName})` : ""}
                          </span>
                        )}
                      </p>

                      {active && !bedType && (
                        <p className="mt-2 text-sm text-[#315c45]">
                          Bitte noch die Bettkonfiguration wählen.
                        </p>
                      )}
                    </RoomCard>
                  );
                })}
              </div>
            )}

            {detailId !== null &&
              (() => {
                const offer = result.offers.find((o) => o.roomTypeId === detailId);

                if (!offer) return null;

                return (
                  <RoomDetail
                    room={toShowcase(offer)}
                    onClose={() => setDetailId(null)}
                    selectLabel="Zimmer auswählen"
                    onSelect={() => {
                      chooseOffer(offer);
                      setDetailId(null);
                    }}
                  />
                );
              })()}

            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-8 text-sm font-semibold text-[#756f64] hover:text-[#211f1b]"
            >
              ← Zeitraum ändern
            </button>
          </section>
        )}

        {/* SCHRITT 3 */}
        {step === 3 && (
          <section className="mt-10">
            <h2 className="font-serif text-2xl">Ihre Daten</h2>
            <p className="mt-2 max-w-xl text-[#756f64]">
              Diese Angaben brauchen wir für Ihre Buchungsbestätigung. Mit
              <span aria-hidden="true"> * </span>
              <span className="sr-only"> Sternchen </span>
              gekennzeichnete Felder sind erforderlich.
            </p>

            {showAllErrors && !guestComplete && (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-red-300 bg-red-50 p-5 text-sm text-red-800"
              >
                <p className="font-bold">Bitte prüfen Sie Ihre Angaben:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {FIELD_ORDER.filter((feld) => guestErrors[feld]).map((feld) => (
                    <li key={feld}>{guestErrors[feld]}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <GuestField
                id="firstName"
                label="Vorname"
                value={guest.firstName}
                onChange={(wert) => setGuest({ ...guest, firstName: wert })}
                onBlur={() => markiere("firstName")}
                error={fehlerFuer("firstName")}
                autoComplete="given-name"
                maxLength={MAX.name}
              />

              <GuestField
                id="lastName"
                label="Nachname"
                value={guest.lastName}
                onChange={(wert) => setGuest({ ...guest, lastName: wert })}
                onBlur={() => markiere("lastName")}
                error={fehlerFuer("lastName")}
                autoComplete="family-name"
                maxLength={MAX.name}
              />

              <GuestField
                id="email"
                label="E-Mail"
                type="email"
                inputMode="email"
                value={guest.email}
                onChange={(wert) => setGuest({ ...guest, email: wert })}
                onBlur={() => markiere("email")}
                error={fehlerFuer("email")}
                autoComplete="email"
                maxLength={MAX.email}
                placeholder="name@beispiel.at"
              />

              <GuestField
                id="phone"
                label="Telefon"
                type="tel"
                inputMode="tel"
                value={guest.phone}
                onChange={(wert) => setGuest({ ...guest, phone: wert })}
                onBlur={() => markiere("phone")}
                error={fehlerFuer("phone")}
                autoComplete="tel"
                maxLength={MAX.phone}
                placeholder="+43 664 1234567"
              />

              <GuestField
                id="street"
                label="Straße und Hausnummer"
                value={guest.street}
                onChange={(wert) => setGuest({ ...guest, street: wert })}
                onBlur={() => markiere("street")}
                error={fehlerFuer("street")}
                autoComplete="street-address"
                maxLength={MAX.street}
                className="sm:col-span-2"
              />

              <GuestField
                id="countryCode"
                label="Land"
                value={guest.countryCode}
                onChange={(wert) => setGuest({ ...guest, countryCode: wert })}
                onBlur={() => markiere("countryCode")}
                error={fehlerFuer("countryCode")}
              >
                <select
                  id="countryCode"
                  name="countryCode"
                  value={guest.countryCode}
                  onChange={(e) => setGuest({ ...guest, countryCode: e.target.value })}
                  onBlur={() => markiere("countryCode")}
                  autoComplete="country"
                  aria-required={true}
                  aria-invalid={fehlerFuer("countryCode") ? true : undefined}
                  aria-describedby={
                    fehlerFuer("countryCode") ? "countryCode-fehler" : undefined
                  }
                  className={`mt-2 w-full rounded-xl border bg-white px-4 py-3.5 text-base outline-none transition focus:ring-2 focus:ring-[#b08a4a]/40 ${
                    fehlerFuer("countryCode")
                      ? "border-red-400 focus:border-red-500"
                      : "border-[#211f1b]/15 focus:border-[#b08a4a]"
                  }`}
                >
                  {COUNTRIES.map((land) => (
                    <option key={land.code} value={land.code}>
                      {land.name}
                    </option>
                  ))}
                </select>
              </GuestField>

              <div className="grid gap-6 sm:grid-cols-2">
                <GuestField
                  id="postalCode"
                  label="PLZ"
                  value={guest.postalCode}
                  onChange={(wert) => setGuest({ ...guest, postalCode: wert })}
                  onBlur={() => markiere("postalCode")}
                  error={fehlerFuer("postalCode")}
                  autoComplete="postal-code"
                  maxLength={MAX.postalCode}
                />

                <GuestField
                  id="city"
                  label="Ort"
                  value={guest.city}
                  onChange={(wert) => setGuest({ ...guest, city: wert })}
                  onBlur={() => markiere("city")}
                  error={fehlerFuer("city")}
                  autoComplete="address-level2"
                  maxLength={MAX.city}
                />
              </div>

              <GuestField
                id="message"
                label="Bemerkung"
                optional
                value={guest.message}
                onChange={(wert) => setGuest({ ...guest, message: wert })}
                onBlur={() => markiere("message")}
                error={fehlerFuer("message")}
                className="sm:col-span-2"
              >
                <textarea
                  id="message"
                  name="message"
                  rows={3}
                  value={guest.message}
                  onChange={(e) => setGuest({ ...guest, message: e.target.value })}
                  onBlur={() => markiere("message")}
                  maxLength={MAX.message}
                  aria-invalid={fehlerFuer("message") ? true : undefined}
                  aria-describedby={fehlerFuer("message") ? "message-fehler" : undefined}
                  placeholder="Späte Anreise, Allergien, Wünsche …"
                  className={`mt-2 w-full resize-y rounded-xl border bg-white px-4 py-3.5 text-base outline-none transition focus:ring-2 focus:ring-[#b08a4a]/40 ${
                    fehlerFuer("message")
                      ? "border-red-400 focus:border-red-500"
                      : "border-[#211f1b]/15 focus:border-[#b08a4a]"
                  }`}
                />
              </GuestField>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-full border border-[#211f1b]/20 px-6 py-3 text-sm font-bold uppercase tracking-wider"
              >
                Zurück
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!guestComplete) {
                    zeigeFehler();
                    return;
                  }

                  setStep(4);
                }}
                className="rounded-full bg-[#211f1b] px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#3a3630]"
              >
                Weiter zur Prüfung
              </button>
            </div>
          </section>
        )}

        {/* SCHRITT 4 */}
        {step === 4 && selected && result && (
          <section className="mt-10">
            <h2 className="font-serif text-2xl">Bitte prüfen</h2>

            <dl className="mt-6 divide-y divide-[#211f1b]/10 rounded-2xl border border-[#211f1b]/10 bg-white">
              {[
                ["Anreise", formatDate(result.checkIn)],
                ["Abreise", formatDate(result.checkOut)],
                ["Nächte", String(selected.totals.nights)],
                [
                  "Gäste",
                  `${result.adults} ${result.adults === 1 ? "Erwachsener" : "Erwachsene"}${
                    result.children > 0 ? `, ${result.children} Kind(er)` : ""
                  }`,
                ],
                ["Zimmer", selected.name],
                [
                  "Bettart",
                  selected.bedTypes.find((b) => b.bedType === bedType)?.label ?? "–",
                ],
                ["Frühstück", breakfast ? "ja" : "nein"],
                ["Gast", `${guest.firstName} ${guest.lastName}`],
                ["E-Mail", guest.email],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-6 px-5 py-3.5 text-sm">
                  <dt className="text-[#756f64]">{label}</dt>
                  <dd className="text-right font-semibold">{value}</dd>
                </div>
              ))}
            </dl>

            {/* Aktionscode. Steht bewusst vor der Preisübersicht, damit der
                Gast die Wirkung direkt darunter sieht. */}
            <div className="mt-6 rounded-2xl border border-[#211f1b]/10 bg-white p-5">
              <label className="block text-sm font-semibold" htmlFor="aktionscode">
                Aktionscode / Rabattcode
                <span className="ml-2 font-normal text-[#756f64]">optional</span>
              </label>

              <div className="mt-3 flex flex-wrap gap-3">
                <input
                  id="aktionscode"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="z. B. HERBST2027"
                  className="min-w-0 flex-1 rounded-xl border border-[#211f1b]/15 bg-[#f5f1e8] px-4 py-3 uppercase outline-none transition focus:border-[#b08a4a]"
                />

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => search(breakfast, true)}
                  className="rounded-full bg-[#211f1b] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#3a3630] disabled:opacity-50"
                >
                  {busy ? "Prüfen …" : "Anwenden"}
                </button>

                {promoCode && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPromoCode("");
                      search(breakfast, true, "");
                    }}
                    className="rounded-full px-4 py-3 text-sm font-bold text-[#756f64] transition hover:text-[#211f1b] disabled:opacity-50"
                  >
                    Entfernen
                  </button>
                )}
              </div>

              {selected.promotionCode.status === "APPLIED" && (
                <p className="mt-3 text-sm font-semibold text-[#315c45]">
                  ✓ Code „{selected.promotionCode.code}“ angewendet:{" "}
                  {selected.totals.discountName} – Sie sparen{" "}
                  {formatMoney(selected.totals.discountTotal)}.
                </p>
              )}

              {selected.promotionCode.status === "OUTPERFORMED" && (
                <p className="mt-3 text-sm text-[#8a682d]">{selected.promotionCode.reason}</p>
              )}

              {(selected.promotionCode.status === "UNKNOWN" ||
                selected.promotionCode.status === "NOT_APPLICABLE") && (
                <p className="mt-3 text-sm text-red-700">{selected.promotionCode.reason}</p>
              )}
            </div>

            {priceNotice && (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-[#b08a4a]/40 bg-[#f4ead5] p-5 text-sm font-semibold text-[#6b5125]"
              >
                {priceNotice}
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-[#211f1b]/10 bg-white">
              <div className="flex justify-between px-5 py-3.5 text-sm">
                <span className="text-[#756f64]">
                  Zimmer
                  <span className="ml-1 text-xs">
                    ({selected.totals.nights}{" "}
                    {selected.totals.nights === 1 ? "Nacht" : "Nächte"})
                  </span>
                </span>
                <span className="font-semibold">{formatMoney(selected.totals.roomsTotal)}</span>
              </div>

              {/* Preis jeder einzelnen Übernachtung. Bei unterschiedlichen
                  Preisen ist das die einzige nachvollziehbare Darstellung. */}
              <details className="border-t border-[#211f1b]/10 px-5 py-3" open={selected.priceVaries}>
                <summary className="cursor-pointer text-sm text-[#756f64]">
                  Preis je Übernachtung
                  {selected.priceVaries
                    ? ` (${formatMoney(selected.pricePerNight)} bis ${formatMoney(
                        selected.pricePerNightMax
                      )})`
                    : ` (${formatMoney(selected.pricePerNight)} pro Nacht)`}
                </summary>

                <ul className="mt-3 space-y-1">
                  {selected.nightPrices.map((nacht) => (
                    <li key={nacht.date} className="flex justify-between text-sm">
                      <span className="text-[#756f64]">{formatDate(nacht.date)}</span>
                      <span className="font-semibold">{formatMoney(nacht.amount)}</span>
                    </li>
                  ))}
                </ul>
              </details>

              {Number(selected.totals.discountTotal) > 0 && (
                <div className="flex justify-between px-5 py-3.5 text-sm text-[#b08a4a]">
                  <span>
                    Rabatt
                    {selected.totals.discountName ? ` – ${selected.totals.discountName}` : ""}
                    {selected.totals.discountPercent > 0
                      ? ` (${selected.totals.discountPercent} %)`
                      : ""}
                    {selected.promotion?.source === "CODE" ? " · Aktionscode" : ""}
                  </span>
                  <span className="font-semibold">− {formatMoney(selected.totals.discountTotal)}</span>
                </div>
              )}

              {breakfast && (
                <div className="flex justify-between px-5 py-3.5 text-sm">
                  <span className="text-[#756f64]">Frühstück</span>
                  <span className="font-semibold">{formatMoney(selected.totals.breakfastTotal)}</span>
                </div>
              )}

              <div className="flex justify-between border-t border-[#211f1b]/10 px-5 py-4">
                <span className="font-bold">Gesamt</span>
                <span className="font-serif text-xl">{formatMoney(selected.totals.total)}</span>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-[#e9e2d5] p-5 text-sm leading-6">
              <p className="font-semibold">Zahlung vor Ort im Hotel.</p>
              <p className="mt-1 text-[#756f64]">
                Ihre Buchung wird vom Hotel geprüft und anschließend bestätigt.
              </p>
            </div>

            {result.guarantee.required && (
              <CardGuarantee
                email={guest.email}
                name={`${guest.firstName} ${guest.lastName}`.trim()}
                handleRef={karte}
              />
            )}

            {result.cancellation && (
              <div className="mt-4 rounded-xl border border-[#b08a4a]/40 bg-white p-5 text-sm leading-6">
                <p className="font-semibold">Stornierungsbedingungen</p>

                {/* Datum und Betrag kommen gerechnet vom Server. Hier wird
                    nichts nachgerechnet - der Browser zeigt nur an. */}
                {selected?.cancellationPreview?.freeUntilDate && (
                  <p className="mt-2 font-semibold text-[#315c45]">
                    Kostenfrei stornierbar bis einschließlich{" "}
                    {formatDate(selected.cancellationPreview.freeUntilDate)}.
                  </p>
                )}

                {selected?.cancellationPreview?.feeAmount && (
                  <p className="mt-1 text-[#756f64]">
                    Bei einer Stornierung danach berechnen wir{" "}
                    <span className="font-semibold text-[#211f1b]">
                      {formatMoney(selected.cancellationPreview.feeAmount)}
                    </span>
                    .
                  </p>
                )}

                {selected?.cancellationPreview?.noShowAmount && (
                  <p className="mt-1 text-[#756f64]">
                    Bei Nichtanreise berechnen wir{" "}
                    <span className="font-semibold text-[#211f1b]">
                      {formatMoney(selected.cancellationPreview.noShowAmount)}
                    </span>
                    .
                  </p>
                )}

                <ul className="mt-2 space-y-1 text-[#756f64]">
                  {result.cancellation.text.map((zeile) => (
                    <li key={zeile}>{zeile}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 grid gap-3">
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  className="mt-0.5 h-5 w-5 accent-[#b08a4a]"
                />
                <span>
                  Ich akzeptiere die Buchungsbedingungen und die oben genannten
                  Stornierungsbedingungen.
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={privacy}
                  onChange={(e) => setPrivacy(e.target.checked)}
                  className="mt-0.5 h-5 w-5 accent-[#b08a4a]"
                />
                <span>Ich akzeptiere die Datenschutzerklärung.</span>
              </label>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-full border border-[#211f1b]/20 px-6 py-3 text-sm font-bold uppercase tracking-wider"
              >
                Zurück
              </button>

              <button
                type="button"
                onClick={submit}
                disabled={busy || !terms || !privacy}
                className="rounded-full bg-[#315c45] px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#264936] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Wird gesendet..." : "Buchung absenden"}
              </button>
            </div>
          </section>
        )}

        {/* SCHRITT 5 */}
        {step === 5 && confirmation && (
          <section className="mt-10">
            <h2 className="font-serif text-3xl">Vielen Dank für Ihre Buchung.</h2>

            {confirmation.duplicate ? (
              <p className="mt-3 text-[#756f64]">
                Diese Buchung bestand bereits – wir haben sie nicht doppelt angelegt. Es gilt die
                unten genannte Buchungsnummer.
              </p>
            ) : (
              <p className="mt-3 text-[#756f64]">
                Ihre Buchung ist verbindlich bestätigt und gespeichert.
              </p>
            )}

            {/* Nur das versprechen, was tatsächlich passiert ist. */}
            {confirmation.confirmationMail === "SENT" ? (
              <p className="mt-2 text-[#756f64]">
                Die Bestätigung ist an {confirmation.guest.email} unterwegs.
              </p>
            ) : (
              <p className="mt-2 text-[#756f64]">
                Bitte notieren Sie Ihre Buchungsnummer: Eine Bestätigung per E-Mail konnten wir
                gerade nicht verschicken. Ihre Buchung ist davon unberührt.
              </p>
            )}

            <p className="mt-8 text-xs font-bold uppercase tracking-[0.25em] text-[#b08a4a]">
              Buchungsnummer
            </p>
            <p className="font-serif text-4xl">{confirmation.bookingNumber}</p>

            <dl className="mt-8 divide-y divide-[#211f1b]/10 rounded-2xl border border-[#211f1b]/10 bg-white">
              {[
                ["Gast", `${confirmation.guest.firstName} ${confirmation.guest.lastName}`],
                [
                  "Aufenthalt",
                  `${formatDate(confirmation.checkIn)} – ${formatDate(confirmation.checkOut)} (${
                    confirmation.nights
                  } ${confirmation.nights === 1 ? "Nacht" : "Nächte"})`,
                ],
                ["Zimmer", confirmation.roomTypeName],
                ["Bettart", confirmation.bedTypeLabel],
                ["Frühstück", confirmation.breakfast ? "ja" : "nein"],
                ["Gesamtpreis", formatMoney(confirmation.totals.total)],
                ["Zahlung", "vor Ort im Hotel"],
                ["Status", confirmation.status === "PENDING" ? "in Prüfung" : confirmation.status],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-6 px-5 py-3.5 text-sm">
                  <dt className="text-[#756f64]">{label}</dt>
                  <dd className="text-right font-semibold">{value}</dd>
                </div>
              ))}
            </dl>

            {confirmation.cancellation && (
              <div className="mt-6 rounded-2xl border border-[#211f1b]/10 bg-white p-5 text-sm leading-6">
                <p className="font-semibold">
                  Stornierungsbedingungen für diese Buchung
                </p>

                <ul className="mt-2 space-y-1 text-[#756f64]">
                  {confirmation.cancellation.text.map((zeile) => (
                    <li key={zeile}>{zeile}</li>
                  ))}
                </ul>

                <p className="mt-3 text-xs text-[#756f64]">
                  Diese Bedingungen gelten unverändert für Ihre Buchung, auch wenn das
                  Hotel seine Bedingungen später ändert.
                </p>
              </div>
            )}

            <a
              href="/hotel"
              className="mt-8 inline-block text-sm font-bold text-[#315c45] hover:underline"
            >
              ← Zurück zum Hotel
            </a>
          </section>
        )}
      </main>
    </div>
  );
}
