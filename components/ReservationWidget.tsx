"use client";

import { useMemo, useState } from "react";

type Step = 1 | 2 | 3 | 4 | 5;

type FormData = {
  date: string;
  time: string;
  guests: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
};

const times = [
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
];

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim());
}

function validatePhone(phone: string) {
  const cleaned = phone.replace(/[\s\-()/]/g, "");

  return /^\+?[0-9]{7,15}$/.test(cleaned);
}

function validateName(name: string) {
  return /^[A-Za-zÀ-ÖØ-öø-ÿÄÖÜäöüß' -]{2,50}$/.test(name.trim());
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDayName(date: Date) {
  return new Intl.DateTimeFormat("de-AT", {
    weekday: "short",
  }).format(date);
}

function getDayNumber(date: Date) {
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
  }).format(date);
}

function getMonthName(date: Date) {
  return new Intl.DateTimeFormat("de-AT", {
    month: "short",
  }).format(date);
}

export default function ReservationWidget() {
  const [step, setStep] = useState<Step>(1);

  const [form, setForm] = useState<FormData>({
    date: "",
    time: "",
    guests: 2,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    message: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const dates = useMemo(() => {
    const result: Date[] = [];
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      result.push(date);
    }

    return result;
  }, []);

  const updateForm = <K extends keyof FormData>(
    key: K,
    value: FormData[K]
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    if (key === "firstName" || key === "lastName" || key === "email" || key === "phone") {
      setSubmitError("");
    }
  };

  const isDateValid = (date: string) => {
    if (!date) return false;

    const selectedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(selectedDate.getTime())) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      return false;
    }

    // Monday = 1
    if (selectedDate.getDay() === 1) {
      return false;
    }

    return true;
  };

  const canContinue = () => {
    if (step === 1) {
      return isDateValid(form.date);
    }

    if (step === 2) {
      return times.includes(form.time);
    }

    if (step === 3) {
      return (
        Number.isInteger(form.guests) &&
        form.guests >= 1 &&
        form.guests <= 20
      );
    }

    if (step === 4) {
      return (
        validateName(form.firstName) &&
        validateName(form.lastName) &&
        validateEmail(form.email) &&
        validatePhone(form.phone)
      );
    }

    return true;
  };

  const getFieldError = (
    field: "firstName" | "lastName" | "email" | "phone"
  ) => {
    if (field === "firstName") {
      if (!form.firstName.trim()) {
        return "Bitte geben Sie Ihren Vornamen ein.";
      }

      if (!validateName(form.firstName)) {
        return "Bitte geben Sie einen gültigen Vornamen ein.";
      }
    }

    if (field === "lastName") {
      if (!form.lastName.trim()) {
        return "Bitte geben Sie Ihren Nachnamen ein.";
      }

      if (!validateName(form.lastName)) {
        return "Bitte geben Sie einen gültigen Nachnamen ein.";
      }
    }

    if (field === "email") {
      if (!form.email.trim()) {
        return "Bitte geben Sie Ihre E-Mail-Adresse ein.";
      }

      if (!validateEmail(form.email)) {
        return "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
      }
    }

    if (field === "phone") {
      if (!form.phone.trim()) {
        return "Bitte geben Sie Ihre Telefonnummer ein.";
      }

      if (!validatePhone(form.phone)) {
        return "Bitte geben Sie eine gültige Telefonnummer ein.";
      }
    }

    return "";
  };

  const nextStep = () => {
    if (step === 4) {
      setShowFieldErrors(true);
    }

    if (!canContinue()) {
      return;
    }

    setShowFieldErrors(false);

    if (step < 5) {
      setStep((step + 1) as Step);
    }
  };

  const previousStep = () => {
    setShowFieldErrors(false);
    setSubmitError("");

    if (step > 1) {
      setStep((step - 1) as Step);
    }
  };

  const submitReservation = async () => {
    setShowFieldErrors(true);

    if (!canContinue()) {
      setStep(4);
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Reservierung konnte nicht gespeichert werden."
        );
      }

      setSubmitted(true);
    } catch (error) {
      console.error("Reservation submission error:", error);

      setSubmitError(
        error instanceof Error
          ? error.message
          : "Leider ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-[520px] flex-col items-center justify-center px-6 py-12 text-center text-[#211f1b]">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#211f1b] text-3xl text-white">
          ✓
        </div>

        <p className="mt-8 text-xs font-bold uppercase tracking-[0.3em] text-[#b08a4a]">
          Anfrage erhalten
        </p>

        <h3 className="mt-3 text-3xl font-semibold tracking-tight text-[#211f1b] sm:text-4xl">
          Vielen Dank, {form.firstName}!
        </h3>

        <p className="mt-5 max-w-md text-base leading-7 text-[#756f64]">
          Ihre Reservierungsanfrage wurde erfolgreich übermittelt.
          Wir melden uns schnellstmöglich bei Ihnen zur Bestätigung.
        </p>

        <div className="mt-8 rounded-2xl bg-[#f5f1e8] px-6 py-5 text-left">
          <p className="text-sm text-[#756f64]">
            <strong className="text-[#211f1b]">Datum:</strong>{" "}
            {new Date(`${form.date}T00:00:00`).toLocaleDateString("de-AT")}
          </p>

          <p className="mt-2 text-sm text-[#756f64]">
            <strong className="text-[#211f1b]">Uhrzeit:</strong>{" "}
            {form.time} Uhr
          </p>

          <p className="mt-2 text-sm text-[#756f64]">
            <strong className="text-[#211f1b]">Personen:</strong>{" "}
            {form.guests}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white text-[#211f1b]">
      {/* Header */}
      <div className="border-b border-[#211f1b]/10 px-6 pb-5 pt-6 sm:px-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#b08a4a]">
              Reservierung
            </p>

            <p className="mt-1 text-sm text-[#756f64]">
              Schritt {step} von 5
            </p>
          </div>

          <div className="text-sm font-semibold text-[#211f1b]">
            {Math.round((step / 5) * 100)}%
          </div>
        </div>

        <div className="mt-5 h-1 overflow-hidden rounded-full bg-[#e9e2d5]">
          <div
            className="h-full rounded-full bg-[#b08a4a] transition-all duration-500"
            style={{
              width: `${(step / 5) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8 sm:px-8 sm:py-10">
        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-[#211f1b] sm:text-3xl">
              Wann dürfen wir Sie begrüßen?
            </h3>

            <p className="mt-2 text-sm leading-6 text-[#756f64]">
              Wählen Sie Ihren Wunschtermin.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {dates.slice(0, 15).map((date) => {
                const value = formatDate(date);
                const selected = form.date === value;
                const closed = date.getDay() === 1;

                return (
                  <button
                    key={value}
                    type="button"
                    disabled={closed}
                    onClick={() => updateForm("date", value)}
                    className={`rounded-xl border px-2 py-4 text-center transition-all ${
                      closed
                        ? "cursor-not-allowed border-[#211f1b]/5 bg-[#f5f1e8] text-[#756f64]/40"
                        : selected
                          ? "border-[#211f1b] bg-[#211f1b] text-white shadow-lg"
                          : "border-[#211f1b]/10 bg-white text-[#211f1b] hover:border-[#b08a4a] hover:bg-[#f5f1e8]"
                    }`}
                  >
                    <span className="block text-xs font-semibold uppercase">
                      {getDayName(date)}
                    </span>

                    <span className="mt-1 block text-2xl font-semibold">
                      {getDayNumber(date)}
                    </span>

                    <span
                      className={`mt-1 block text-[10px] uppercase ${
                        selected
                          ? "text-white/60"
                          : closed
                            ? "text-[#756f64]/40"
                            : "text-[#756f64]"
                      }`}
                    >
                      {closed ? "geschlossen" : getMonthName(date)}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-5 text-xs text-[#756f64]">
              Montags ist unser Restaurant geschlossen.
            </p>

            {form.date && !isDateValid(form.date) && (
              <p className="mt-3 text-sm font-medium text-red-600">
                Bitte wählen Sie einen gültigen Öffnungstag.
              </p>
            )}
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-[#211f1b] sm:text-3xl">
              Welche Uhrzeit passt Ihnen?
            </h3>

            <p className="mt-2 text-sm leading-6 text-[#756f64]">
              Wählen Sie Ihre gewünschte Ankunftszeit.
            </p>

            <div className="mt-8">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#756f64]">
                Mittag
              </p>

              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {times.slice(0, 5).map((time) => {
                  const selected = form.time === time;

                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => updateForm("time", time)}
                      className={`rounded-xl border px-4 py-4 text-sm font-semibold transition-all ${
                        selected
                          ? "border-[#211f1b] bg-[#211f1b] text-white shadow-lg"
                          : "border-[#211f1b]/10 bg-white text-[#211f1b] hover:border-[#b08a4a] hover:bg-[#f5f1e8]"
                      }`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#756f64]">
                Abend
              </p>

              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {times.slice(5).map((time) => {
                  const selected = form.time === time;

                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => updateForm("time", time)}
                      className={`rounded-xl border px-4 py-4 text-sm font-semibold transition-all ${
                        selected
                          ? "border-[#211f1b] bg-[#211f1b] text-white shadow-lg"
                          : "border-[#211f1b]/10 bg-white text-[#211f1b] hover:border-[#b08a4a] hover:bg-[#f5f1e8]"
                      }`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-[#211f1b] sm:text-3xl">
              Für wie viele Personen?
            </h3>

            <p className="mt-2 text-sm leading-6 text-[#756f64]">
              Teilen Sie uns mit, wie viele Gäste Sie erwarten.
            </p>

            <div className="mt-10 flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() =>
                  updateForm("guests", Math.max(1, form.guests - 1))
                }
                className="flex h-14 w-14 items-center justify-center rounded-full border border-[#211f1b]/10 text-2xl text-[#211f1b] transition hover:border-[#b08a4a] hover:bg-[#f5f1e8]"
                aria-label="Eine Person weniger"
              >
                −
              </button>

              <div className="w-24 text-center">
                <div className="text-6xl font-semibold tracking-tight text-[#211f1b]">
                  {form.guests}
                </div>

                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-[#756f64]">
                  {form.guests === 1 ? "Person" : "Personen"}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  updateForm("guests", Math.min(20, form.guests + 1))
                }
                className="flex h-14 w-14 items-center justify-center rounded-full border border-[#211f1b]/10 text-2xl text-[#211f1b] transition hover:border-[#b08a4a] hover:bg-[#f5f1e8]"
                aria-label="Eine Person mehr"
              >
                +
              </button>
            </div>

            <p className="mt-10 text-center text-xs leading-5 text-[#756f64]">
              Für größere Gruppen kontaktieren Sie uns bitte telefonisch.
            </p>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-[#211f1b] sm:text-3xl">
              Wie dürfen wir Sie erreichen?
            </h3>

            <p className="mt-2 text-sm leading-6 text-[#756f64]">
              Wir benötigen Ihre Kontaktdaten für die Reservierungsbestätigung.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {/* Vorname */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-[#756f64]">
                  Vorname
                </label>

                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) =>
                    updateForm("firstName", e.target.value)
                  }
                  placeholder="Max"
                  autoComplete="given-name"
                  className={`w-full rounded-xl border px-4 py-4 text-sm text-[#211f1b] outline-none transition focus:ring-2 ${
                    (showFieldErrors || form.firstName) &&
                    getFieldError("firstName")
                      ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                      : "border-[#211f1b]/10 focus:border-[#b08a4a] focus:ring-[#b08a4a]/20"
                  }`}
                />

                {(showFieldErrors || form.firstName) &&
                  getFieldError("firstName") && (
                    <p className="mt-2 text-xs text-red-600">
                      {getFieldError("firstName")}
                    </p>
                  )}
              </div>

              {/* Nachname */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-[#756f64]">
                  Nachname
                </label>

                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) =>
                    updateForm("lastName", e.target.value)
                  }
                  placeholder="Mustermann"
                  autoComplete="family-name"
                  className={`w-full rounded-xl border px-4 py-4 text-sm text-[#211f1b] outline-none transition focus:ring-2 ${
                    (showFieldErrors || form.lastName) &&
                    getFieldError("lastName")
                      ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                      : "border-[#211f1b]/10 focus:border-[#b08a4a] focus:ring-[#b08a4a]/20"
                  }`}
                />

                {(showFieldErrors || form.lastName) &&
                  getFieldError("lastName") && (
                    <p className="mt-2 text-xs text-red-600">
                      {getFieldError("lastName")}
                    </p>
                  )}
              </div>

              {/* E-Mail */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-[#756f64]">
                  E-Mail
                </label>

                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    updateForm("email", e.target.value)
                  }
                  placeholder="max@beispiel.at"
                  autoComplete="email"
                  inputMode="email"
                  className={`w-full rounded-xl border px-4 py-4 text-sm text-[#211f1b] outline-none transition focus:ring-2 ${
                    (showFieldErrors || form.email) &&
                    getFieldError("email")
                      ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                      : "border-[#211f1b]/10 focus:border-[#b08a4a] focus:ring-[#b08a4a]/20"
                  }`}
                />

                {(showFieldErrors || form.email) &&
                  getFieldError("email") && (
                    <p className="mt-2 text-xs text-red-600">
                      {getFieldError("email")}
                    </p>
                  )}
              </div>

              {/* Telefon */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-[#756f64]">
                  Telefon
                </label>

                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    updateForm("phone", e.target.value)
                  }
                  placeholder="+43 664 1234567"
                  autoComplete="tel"
                  inputMode="tel"
                  className={`w-full rounded-xl border px-4 py-4 text-sm text-[#211f1b] outline-none transition focus:ring-2 ${
                    (showFieldErrors || form.phone) &&
                    getFieldError("phone")
                      ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                      : "border-[#211f1b]/10 focus:border-[#b08a4a] focus:ring-[#b08a4a]/20"
                  }`}
                />

                {(showFieldErrors || form.phone) &&
                  getFieldError("phone") && (
                    <p className="mt-2 text-xs text-red-600">
                      {getFieldError("phone")}
                    </p>
                  )}
              </div>

              {/* Nachricht */}
              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-[#756f64]">
                  Nachricht
                  <span className="ml-2 font-normal normal-case tracking-normal">
                    optional
                  </span>
                </label>

                <textarea
                  value={form.message}
                  onChange={(e) =>
                    updateForm("message", e.target.value.slice(0, 500))
                  }
                  placeholder="Besondere Wünsche oder Hinweise ..."
                  rows={3}
                  maxLength={500}
                  className="w-full resize-none rounded-xl border border-[#211f1b]/10 px-4 py-4 text-sm text-[#211f1b] outline-none transition focus:border-[#b08a4a] focus:ring-2 focus:ring-[#b08a4a]/20"
                />

                <p className="mt-1 text-right text-[11px] text-[#756f64]">
                  {form.message.length}/500
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5 */}
        {step === 5 && (
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-[#211f1b] sm:text-3xl">
              Fast geschafft.
            </h3>

            <p className="mt-2 text-sm leading-6 text-[#756f64]">
              Überprüfen Sie Ihre Angaben und senden Sie anschließend Ihre
              Reservierungsanfrage.
            </p>

            <div className="mt-8 divide-y divide-[#211f1b]/10 rounded-2xl border border-[#211f1b]/10">
              {/* Datum */}
              <div className="flex items-center justify-between gap-4 px-5 py-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-[#756f64]">
                    Datum
                  </p>

                  <p className="mt-1 font-semibold text-[#211f1b]">
                    {new Date(`${form.date}T00:00:00`).toLocaleDateString(
                      "de-AT",
                      {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      }
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-[#b08a4a] hover:underline"
                >
                  Ändern
                </button>
              </div>

              {/* Uhrzeit */}
              <div className="flex items-center justify-between gap-4 px-5 py-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-[#756f64]">
                    Uhrzeit
                  </p>

                  <p className="mt-1 font-semibold text-[#211f1b]">
                    {form.time} Uhr
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs font-semibold text-[#b08a4a] hover:underline"
                >
                  Ändern
                </button>
              </div>

              {/* Gäste */}
              <div className="flex items-center justify-between gap-4 px-5 py-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-[#756f64]">
                    Gäste
                  </p>

                  <p className="mt-1 font-semibold text-[#211f1b]">
                    {form.guests}{" "}
                    {form.guests === 1 ? "Person" : "Personen"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-xs font-semibold text-[#b08a4a] hover:underline"
                >
                  Ändern
                </button>
              </div>

              {/* Gast */}
              <div className="flex items-center justify-between gap-4 px-5 py-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-[#756f64]">
                    Gast
                  </p>

                  <p className="mt-1 font-semibold text-[#211f1b]">
                    {form.firstName} {form.lastName}
                  </p>

                  <p className="mt-1 text-sm text-[#756f64]">
                    {form.email}
                  </p>

                  <p className="text-sm text-[#756f64]">
                    {form.phone}
                  </p>

                  {form.message && (
                    <p className="mt-2 max-w-md text-sm text-[#756f64]">
                      {form.message}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="text-xs font-semibold text-[#b08a4a] hover:underline"
                >
                  Ändern
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-[#f5f1e8] px-5 py-4 text-xs leading-5 text-[#756f64]">
              Ihre Anfrage wird zunächst an den Alten Telegraf übermittelt.
              Die Reservierung gilt erst nach Bestätigung durch unser Team
              als verbindlich.
            </div>

            {submitError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                {submitError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-4 border-t border-[#211f1b]/10 bg-[#faf9f6] px-6 py-5 sm:px-8">
        <button
          type="button"
          onClick={previousStep}
          disabled={step === 1 || submitting}
          className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${
            step === 1 || submitting
              ? "cursor-not-allowed text-[#756f64]/30"
              : "text-[#211f1b] hover:bg-[#e9e2d5]"
          }`}
        >
          Zurück
        </button>

        {step < 5 ? (
          <button
            type="button"
            onClick={nextStep}
            disabled={!canContinue()}
            className={`rounded-xl px-6 py-3 text-sm font-semibold transition ${
              canContinue()
                ? "bg-[#211f1b] text-white shadow-lg hover:-translate-y-0.5 hover:bg-[#302d28]"
                : "cursor-not-allowed bg-[#e9e2d5] text-[#756f64]/50"
            }`}
          >
            Weiter →
          </button>
        ) : (
          <button
            type="button"
            onClick={submitReservation}
            disabled={submitting}
            className="rounded-xl bg-[#211f1b] px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#302d28] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Wird gesendet …" : "Anfrage senden"}
          </button>
        )}
      </div>
    </div>
  );
}