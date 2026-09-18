"use client";

import { useEffect, useState } from "react";

import {
  Alert,
  Button,
  Card,
  Field,
  PageIntro,
  inputClass,
} from "@/components/hotel-admin/ui";
import { apiRequest, toFormValue, toTimeValue } from "@/lib/hotel/client";
import {
  ALTER_TELEGRAF_DEFAULTS,
  type HotelFormValues,
} from "@/lib/hotel/constants";

type HotelResponse = {
  hotel: (Record<keyof HotelFormValues, string | null> & { id: number }) | null;
};

const timeKeys = ["checkInFrom", "checkOutUntil", "receptionFrom", "receptionUntil"] as const;

function toForm(hotel: NonNullable<HotelResponse["hotel"]>): HotelFormValues {
  const form = { ...ALTER_TELEGRAF_DEFAULTS };

  for (const key of Object.keys(form) as (keyof HotelFormValues)[]) {
    form[key] = (timeKeys as readonly string[]).includes(key)
      ? toTimeValue(hotel[key])
      : toFormValue(hotel[key]);
  }

  return form;
}

export default function HotelSettingsPage() {
  const [form, setForm] = useState<HotelFormValues>(ALTER_TELEGRAF_DEFAULTS);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    apiRequest<HotelResponse>("/api/admin/hotel/einstellungen").then((result) => {
      if (!result.ok) {
        setError(result.error);
      } else if (result.data.hotel) {
        setForm(toForm(result.data.hotel));
        setExists(true);
      }

      setLoading(false);
    });
  }, []);

  function update<K extends keyof HotelFormValues>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");

    const result = await apiRequest<HotelResponse & { created: boolean }>(
      "/api/admin/hotel/einstellungen",
      "PUT",
      form
    );

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.data.hotel) {
      setForm(toForm(result.data.hotel));
    }

    setExists(true);
    setSuccess(result.data.created ? "Hotel-Stammdaten wurden angelegt." : "Änderungen wurden gespeichert.");
  }

  const text = (key: keyof HotelFormValues, label: string, opts: { required?: boolean; placeholder?: string; hint?: string; type?: string; className?: string } = {}) => (
    <Field label={label} required={opts.required} hint={opts.hint} className={opts.className}>
      <input
        type={opts.type ?? "text"}
        value={form[key]}
        onChange={(e) => update(key, e.target.value)}
        placeholder={opts.placeholder}
        disabled={loading}
        className={inputClass}
      />
    </Field>
  );

  return (
    <div>
      <PageIntro
        eyebrow="Hotel"
        title="Stammdaten"
        description="Grunddaten des Hotels. Sie gelten für Zimmer, Buchungen und später die Website-Buchung."
      />

      {!loading && !exists && (
        <div className="mt-8">
          <Alert kind="info">
            Noch nicht gespeichert. Das Formular ist mit den bekannten Daten des Hotels Alter Telegraf vorausgefüllt. Bitte prüfen und speichern.
          </Alert>
        </div>
      )}

      <div className="mt-8 grid gap-6">
        <Card>
          <h2 className="font-serif text-2xl">Allgemein</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {text("name", "Name", { required: true })}
            {text("slug", "Slug", { required: true, hint: "Kleinbuchstaben, Ziffern und Bindestriche." })}
            {text("legalName", "Rechtlicher Name")}
            {text("vatId", "UID/VAT-ID")}
          </div>
          <p className="mt-5 text-xs text-[#756f64]">
            Beschreibung: Das Hotel-Modell hat derzeit kein Beschreibungsfeld. Dafür ist eine Contract-Erweiterung nötig.
          </p>
        </Card>

        <Card>
          <h2 className="font-serif text-2xl">Adresse & Kontakt</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-6">
            {text("street", "Adresse", { required: true, className: "md:col-span-6" })}
            {text("postalCode", "PLZ", { required: true, className: "md:col-span-2" })}
            {text("city", "Ort", { required: true, className: "md:col-span-2" })}
            {text("countryCode", "Land", { required: true, hint: "ISO-Code, z. B. AT = Österreich", className: "md:col-span-2" })}
            {text("phone", "Telefon", { type: "tel", className: "md:col-span-2" })}
            {text("fax", "Fax", { type: "tel", className: "md:col-span-2" })}
            {text("email", "E-Mail", { type: "email", className: "md:col-span-2" })}
          </div>
        </Card>

        <Card>
          <h2 className="font-serif text-2xl">Betrieb</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {text("timezone", "Zeitzone", { required: true, placeholder: "Europe/Vienna" })}
            {text("currency", "Währung", { required: true, placeholder: "EUR" })}
            <div className="hidden lg:block" />
            {text("checkInFrom", "Check-in ab", { type: "time" })}
            {text("checkOutUntil", "Check-out bis", { type: "time" })}
            <div className="hidden lg:block" />
            {text("receptionFrom", "Rezeption von", { type: "time" })}
            {text("receptionUntil", "Rezeption bis", { type: "time" })}
          </div>
        </Card>
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
        <Button onClick={handleSave} disabled={loading || saving}>
          {saving ? "Speichern..." : exists ? "Änderungen speichern" : "Hotel anlegen"}
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {error && <Alert kind="error">{error}</Alert>}
        {success && <Alert kind="success">✓ {success}</Alert>}
      </div>
    </div>
  );
}
