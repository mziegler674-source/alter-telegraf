"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  PageIntro,
  inputClass,
} from "@/components/hotel-admin/ui";
import { type ApiResult, apiRequest } from "@/lib/hotel/client";
import {
  type MenuItem,
  type MenuKind,
  formatPrice,
} from "@/lib/menu/constants";

type Response = { items: MenuItem[] };

type FormState = {
  name: string;
  description: string;
  price: string;
  active: boolean;
};

const emptyForm: FormState = { name: "", description: "", price: "", active: true };

export default function MenuEditor({
  menu,
  title,
  intro,
  publicHref,
}: {
  menu: MenuKind;
  title: string;
  intro: string;
  publicHref: string;
}) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchItems = useCallback(
    () => apiRequest<Response>(`/api/admin/speisekarte?menu=${menu}`),
    [menu]
  );

  const applyResult = useCallback((result: ApiResult<Response>) => {
    if (result.ok) setItems(result.data.items);
    else setError(result.error);

    setLoading(false);
  }, []);

  const load = useCallback(async () => applyResult(await fetchItems()), [applyResult, fetchItems]);

  useEffect(() => {
    fetchItems().then(applyResult);
  }, [fetchItems, applyResult]);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");

    const result = await action();

    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? "Die Aktion ist fehlgeschlagen.");
      return false;
    }

    setSuccess(message);
    await load();
    return true;
  }

  function openForm(item?: MenuItem) {
    setError("");
    setSuccess("");
    setEditingId(item ? item.id : "new");
    setForm(
      item
        ? {
            name: item.name,
            description: item.description ?? "",
            price: formatPrice(item.price),
            active: item.active,
          }
        : emptyForm
    );
  }

  async function save() {
    const isNew = editingId === "new";
    const saved = await run(
      () =>
        apiRequest("/api/admin/speisekarte", isNew ? "POST" : "PATCH", {
          ...form,
          menu,
          ...(isNew ? {} : { id: editingId }),
        }),
      isNew ? `„${form.name}“ wurde hinzugefügt.` : `„${form.name}“ wurde gespeichert.`
    );

    if (saved) setEditingId(null);
  }

  function toggleActive(item: MenuItem) {
    run(
      () =>
        apiRequest("/api/admin/speisekarte", "PATCH", {
          id: item.id,
          action: "setActive",
          active: !item.active,
        }),
      `„${item.name}“ ist jetzt ${item.active ? "ausgeblendet" : "sichtbar"}.`
    );
  }

  function remove(item: MenuItem) {
    if (!window.confirm(`„${item.name}“ wirklich löschen?`)) return;

    run(
      () => apiRequest("/api/admin/speisekarte", "DELETE", { id: item.id }),
      `„${item.name}“ wurde gelöscht.`
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f1e8] text-[#211f1b]">
      <header className="bg-[#211f1b] text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5 lg:px-10">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em]">ALTER TELEGRAF</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[#c9a96a]">
              Administration
            </p>
          </div>

          <div className="flex items-center gap-5">
            <a href={publicHref} className="text-sm text-white/60 transition hover:text-white">
              Seite ansehen
            </a>
            <a href="/admin" className="text-sm text-white/60 transition hover:text-white">
              ← Dashboard
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12 lg:px-10">
        <PageIntro
          eyebrow="Restaurant"
          title={title}
          description={intro}
          action={
            editingId === null ? (
              <Button onClick={() => openForm()}>+ Gericht hinzufügen</Button>
            ) : null
          }
        />

        <div className="mt-8 space-y-3">
          {error && <Alert kind="error">{error}</Alert>}
          {success && <Alert kind="success">✓ {success}</Alert>}
        </div>

        {editingId !== null && (
          <Card className="mt-8">
            <h2 className="font-serif text-2xl">
              {editingId === "new" ? "Neues Gericht" : "Gericht bearbeiten"}
            </h2>

            <div className="mt-6 grid gap-5">
              <Field label="Name" required>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Backhendl"
                  className={inputClass}
                />
              </Field>

              <Field label="Beschreibung">
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="mit Erdäpfelsalat"
                  className={inputClass}
                />
              </Field>

              <Field label="Preis" required hint="Zum Beispiel 16,90">
                <div className="relative">
                  <input
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="16,90"
                    className={`${inputClass} pr-12`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-semibold text-[#756f64]">
                    €
                  </span>
                </div>
              </Field>

              <Checkbox
                label="Auf der Website anzeigen"
                checked={form.active}
                onChange={(active) => setForm({ ...form, active })}
              />
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setEditingId(null)} disabled={busy}>
                Abbrechen
              </Button>
              <Button onClick={save} disabled={busy}>
                {busy ? "Speichern..." : "Speichern"}
              </Button>
            </div>
          </Card>
        )}

        <section className="mt-8">
          {loading ? (
            <EmptyState title="Wird geladen..." />
          ) : items.length === 0 ? (
            <EmptyState title="Noch keine Gerichte">
              Legen Sie das erste Gericht über „Gericht hinzufügen“ an.
            </EmptyState>
          ) : (
            <div className="divide-y divide-[#211f1b]/10 overflow-hidden rounded-2xl border border-[#211f1b]/10 bg-white shadow-sm">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between ${
                    item.active ? "" : "bg-[#f5f1e8]/60"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-semibold">{item.name}</p>
                      {!item.active && <Badge tone="gray">Ausgeblendet</Badge>}
                    </div>

                    {item.description && (
                      <p className="mt-1 text-sm text-[#756f64]">{item.description}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-serif text-xl">{formatPrice(item.price)} €</span>

                    <Button small variant="secondary" onClick={() => openForm(item)} disabled={busy}>
                      Bearbeiten
                    </Button>
                    <Button small variant="secondary" onClick={() => toggleActive(item)} disabled={busy}>
                      {item.active ? "Ausblenden" : "Anzeigen"}
                    </Button>
                    <Button small variant="danger" onClick={() => remove(item)} disabled={busy}>
                      Löschen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
