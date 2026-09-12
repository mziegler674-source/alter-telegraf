"use client";

import { useEffect, useState } from "react";

const days = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
];

type MenuTemplate = {
  id: number;
  dish: string;
  description: string | null;
  price: string;
};

export default function TagesmenuePage() {
  const [selectedDay, setSelectedDay] = useState("Montag");
  const [dish, setDish] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [visible, setVisible] = useState(true);

  const [templates, setTemplates] = useState<MenuTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadTemplates() {
    try {
      setLoadingTemplates(true);

      const response = await fetch("/api/admin/menue-vorlagen", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Die gespeicherten Menüs konnten nicht geladen werden."
        );
        return;
      }

      setTemplates(data.templates || []);
    } catch {
      setError(
        "Die gespeicherten Menüs konnten nicht geladen werden."
      );
    } finally {
      setLoadingTemplates(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  function useTemplate(template: MenuTemplate) {
    setDish(template.dish);
    setDescription(template.description || "");
    setPrice(template.price);

    setSaved(false);
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deleteTemplate(id: number) {
    const confirmed = window.confirm(
      "Möchten Sie dieses gespeicherte Menü wirklich löschen?\n\n" +
        "Das Menü kann danach nicht mehr als Vorlage verwendet werden."
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(id);
    setError("");

    try {
      const response = await fetch("/api/admin/menue-vorlagen", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Das gespeicherte Menü konnte nicht gelöscht werden."
        );
        return;
      }

      // Liste direkt aktualisieren
      setTemplates((currentTemplates) =>
        currentTemplates.filter(
          (template) => template.id !== id
        )
      );
    } catch {
      setError(
        "Die Verbindung zum Server ist fehlgeschlagen."
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSave() {
    setSaved(false);
    setError("");
    setSaving(true);
  
    try {
      const response = await fetch("/api/admin/tagesmenue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedDay,
          dish,
          description,
          price,
          visible,
        }),
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        setError(
          data.error ||
            "Das Tagesmenü konnte nicht gespeichert werden."
        );
        return;
      }
  
      if (data.alreadyExists) {
        setSaved(false);
        setError(
          data.message ||
            "Dieses Menü ist bereits vorhanden."
        );
      } else {
        setSaved(true);
      }
  
      await loadTemplates();
  
      setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch {
      setError(
        "Die Verbindung zum Server ist fehlgeschlagen."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f1e8] text-[#211f1b]">

      {/* HEADER */}
      <header className="border-b border-[#211f1b]/10 bg-[#211f1b] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">

          <div>
            <p className="text-sm font-semibold tracking-[0.18em]">
              ALTER TELEGRAF
            </p>

            <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[#c9a96a]">
              Administration
            </p>
          </div>

          <a
            href="/admin"
            className="text-sm text-white/60 transition hover:text-white"
          >
            ← Dashboard
          </a>

        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12 lg:px-10 lg:py-16">

        {/* INTRO */}
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#b08a4a]">
            Speiseverwaltung
          </p>

          <h1 className="mt-3 text-4xl sm:text-5xl">
            Tagesmenü bearbeiten
          </h1>

          <p className="mt-4 max-w-2xl text-[#756f64]">
            Aktualisieren Sie hier das Tagesmenü für Ihre Gäste.
          </p>
        </div>

        {/* FORMULAR */}
        <div className="mt-10 rounded-2xl border border-[#211f1b]/10 bg-white p-7 shadow-sm sm:p-10">

          {/* Wochentag */}
          <div>
            <label className="text-sm font-bold">
              Wochentag
            </label>

            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="mt-3 w-full rounded-xl border border-[#211f1b]/15 bg-[#f5f1e8] px-4 py-4 text-[#211f1b] outline-none transition focus:border-[#b08a4a]"
            >
              {days.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          {/* Gericht */}
          <div className="mt-7">
            <label className="text-sm font-bold">
              Gericht
            </label>

            <input
              type="text"
              value={dish}
              onChange={(e) => setDish(e.target.value)}
              placeholder="z. B. Backhendl mit Erdäpfelsalat"
              className="mt-3 w-full rounded-xl border border-[#211f1b]/15 bg-[#f5f1e8] px-4 py-4 text-[#211f1b] outline-none transition placeholder:text-[#756f64]/50 focus:border-[#b08a4a]"
            />
          </div>

          {/* Beschreibung */}
          <div className="mt-7">
            <label className="text-sm font-bold">
              Beschreibung
            </label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung des Tagesmenüs"
              rows={4}
              className="mt-3 w-full resize-none rounded-xl border border-[#211f1b]/15 bg-[#f5f1e8] px-4 py-4 text-[#211f1b] outline-none transition placeholder:text-[#756f64]/50 focus:border-[#b08a4a]"
            />
          </div>

          {/* Preis */}
          <div className="mt-7">
            <label className="text-sm font-bold">
              Preis
            </label>

            <div className="relative mt-3">

              <input
                type="number"
                step="0.10"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="12,90"
                className="w-full rounded-xl border border-[#211f1b]/15 bg-[#f5f1e8] px-4 py-4 pr-14 text-[#211f1b] outline-none transition placeholder:text-[#756f64]/50 focus:border-[#b08a4a]"
              />

              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-semibold text-[#756f64]">
                €
              </span>

            </div>
          </div>

          {/* SICHTBARKEIT */}
          <div className="mt-8 rounded-xl bg-[#e9e2d5] p-5">

            <label className="flex cursor-pointer items-center gap-4">

              <input
                type="checkbox"
                checked={visible}
                onChange={(e) => setVisible(e.target.checked)}
                className="h-5 w-5 accent-[#b08a4a]"
              />

              <div>
                <p className="font-semibold">
                  Auf Website anzeigen
                </p>

                <p className="mt-1 text-sm text-[#756f64]">
                  Das Menü wird für Gäste sichtbar.
                </p>
              </div>

            </label>

          </div>

          {/* BUTTONS */}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <a
              href="/admin"
              className="text-center text-sm font-semibold text-[#756f64] hover:text-[#211f1b]"
            >
              Abbrechen
            </a>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-[#211f1b] px-8 py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#3a3630] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Speichern..." : "Menü speichern"}
            </button>

          </div>

          {/* ERFOLG */}
          {saved && (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
              ✓ Tagesmenü wurde erfolgreich gespeichert.
            </div>
          )}

          {/* FEHLER */}
          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
              {error}
            </div>
          )}

        </div>

        {/* GESPEICHERTE MENÜS */}
        <section className="mt-14">

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#b08a4a]">
              Wiederverwenden
            </p>

            <h2 className="mt-3 text-3xl sm:text-4xl">
              Bereits verwendete Menüs
            </h2>

            <p className="mt-3 max-w-2xl text-[#756f64]">
              Hier finden Sie bereits eingegebene Menüs. Mit
              „Übernehmen“ werden Gericht, Beschreibung und Preis
              automatisch in das Formular geladen.
            </p>
          </div>

          {/* Loading */}
          {loadingTemplates && (
            <div className="mt-7 rounded-2xl border border-[#211f1b]/10 bg-white p-8 text-center text-sm text-[#756f64]">
              Gespeicherte Menüs werden geladen...
            </div>
          )}

          {/* Keine Vorlagen */}
          {!loadingTemplates && templates.length === 0 && (
            <div className="mt-7 rounded-2xl border border-[#211f1b]/10 bg-white p-8 text-center">

              <p className="text-lg font-semibold">
                Noch keine gespeicherten Menüs
              </p>

              <p className="mt-2 text-sm text-[#756f64]">
                Sobald Sie ein Tagesmenü speichern, erscheint es
                hier und kann später wiederverwendet werden.
              </p>

            </div>
          )}

          {/* Vorlagen */}
          {!loadingTemplates && templates.length > 0 && (
            <div className="mt-7 grid gap-4">

              {templates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-2xl border border-[#211f1b]/10 bg-white p-6 shadow-sm transition hover:border-[#b08a4a]/40 sm:p-7"
                >

                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                    <div className="min-w-0">

                      <p className="text-xl font-semibold text-[#211f1b]">
                        {template.dish}
                      </p>

                      {template.description && (
                        <p className="mt-2 text-sm leading-6 text-[#756f64]">
                          {template.description}
                        </p>
                      )}

                      <p className="mt-3 text-sm font-bold text-[#b08a4a]">
                        € {template.price}
                      </p>

                    </div>

                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">

                      <button
                        type="button"
                        onClick={() => useTemplate(template)}
                        className="rounded-full bg-[#e9e2d5] px-6 py-3 text-sm font-bold text-[#211f1b] transition hover:bg-[#b08a4a] hover:text-white"
                      >
                        Übernehmen
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteTemplate(template.id)}
                        disabled={deletingId === template.id}
                        className="rounded-full border border-red-200 px-6 py-3 text-sm font-bold text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === template.id
                          ? "Löschen..."
                          : "Löschen"}
                      </button>

                    </div>

                  </div>

                </div>
              ))}

            </div>
          )}

        </section>

        {/* VORSCHAU */}
        <section className="mt-14">

          <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#b08a4a]">
            Vorschau
          </p>

          <div className="mt-5 rounded-2xl border border-[#211f1b]/10 bg-[#e9e2d5] p-7 sm:p-8">

            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#b08a4a]">
              {selectedDay}
            </p>

            <h2 className="mt-3 text-2xl">
              {dish || "Ihr Tagesmenü"}
            </h2>

            <p className="mt-3 leading-7 text-[#756f64]">
              {description ||
                "Die Beschreibung des Tagesmenüs erscheint hier."}
            </p>

            {price && (
              <p className="mt-5 text-xl font-bold text-[#211f1b]">
                € {price}
              </p>
            )}

            {!visible && (
              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-red-700">
                Aktuell nicht auf der Website sichtbar
              </p>
            )}

          </div>

        </section>

      </div>
    </main>
  );
}