"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  EmptyState,
  PageIntro,
} from "@/components/hotel-admin/ui";
import { MAX_PDF_BYTES, MENU_CARDS, formatBytes } from "@/lib/menu/cards";

type Card = {
  id: number;
  slug: string;
  title: string;
  fileName: string | null;
  sizeBytes: number | null;
  uploadedAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function KartenAdminPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchCards = useCallback(async () => {
    const response = await fetch("/api/admin/karten", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));

    return { ok: response.ok, data } as { ok: boolean; data: { cards?: Card[]; error?: string } };
  }, []);

  const applyResult = useCallback(
    (result: { ok: boolean; data: { cards?: Card[]; error?: string } }) => {
      if (result.ok) setCards(result.data.cards ?? []);
      else setError(result.data.error || "Die Karten konnten nicht geladen werden.");

      setLoading(false);
    },
    []
  );

  const load = useCallback(async () => applyResult(await fetchCards()), [applyResult, fetchCards]);

  useEffect(() => {
    fetchCards().then(applyResult);
  }, [fetchCards, applyResult]);

  async function upload(slug: string) {
    const input = inputs.current[slug];
    const file = input?.files?.[0];

    setError("");
    setSuccess("");

    if (!file) {
      setError("Bitte zuerst eine PDF-Datei auswählen.");
      return;
    }

    if (file.size > MAX_PDF_BYTES) {
      setError(`Die Datei ist zu groß (maximal ${MAX_PDF_BYTES / 1024 / 1024} MB).`);
      return;
    }

    setBusySlug(slug);

    const body = new FormData();
    body.append("slug", slug);
    body.append("file", file);

    const response = await fetch("/api/admin/karten", { method: "POST", body });
    const data = await response.json().catch(() => ({}));

    setBusySlug(null);

    if (!response.ok) {
      setError(data.error || "Der Upload ist fehlgeschlagen.");
      return;
    }

    if (input) input.value = "";

    setSuccess(`Neue PDF für „${cards.find((c) => c.slug === slug)?.title}“ ist online.`);
    await load();
  }

  async function removeFile(card: Card) {
    if (!window.confirm(`PDF für „${card.title}“ entfernen? Die Karte wird dann nicht mehr angezeigt.`)) {
      return;
    }

    setBusySlug(card.slug);
    setError("");
    setSuccess("");

    const response = await fetch(`/api/admin/karten?slug=${card.slug}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));

    setBusySlug(null);

    if (!response.ok) {
      setError(data.error || "Die PDF konnte nicht entfernt werden.");
      return;
    }

    setSuccess(`PDF für „${card.title}“ wurde entfernt.`);
    await load();
  }

  return (
    <main className="min-h-screen bg-[#f5f1e8] text-[#211f1b]">
      <header className="bg-[#211f1b] text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5 lg:px-10">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em]">ALTER TELEGRAF</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[#c9a96a]">
              Administration
            </p>
          </div>

          <div className="flex items-center gap-5">
            <a href="/restaurant" className="text-sm text-white/60 transition hover:text-white">
              Seite ansehen
            </a>
            <a href="/admin" className="text-sm text-white/60 transition hover:text-white">
              ← Dashboard
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-12 lg:px-10">
        <PageIntro
          eyebrow="Restaurant"
          title="Unsere Karten"
          description="Jede Karte ist eine eigene PDF. Wählen Sie eine neue Datei aus und laden Sie sie hoch – die alte wird ersetzt und die neue ist sofort auf der Website sichtbar."
        />

        <div className="mt-8 space-y-3">
          {error && <Alert kind="error">{error}</Alert>}
          {success && <Alert kind="success">✓ {success}</Alert>}
        </div>

        <section className="mt-8">
          {loading ? (
            <EmptyState title="Wird geladen..." />
          ) : (
            <div className="divide-y divide-[#211f1b]/10 overflow-hidden rounded-2xl border border-[#211f1b]/10 bg-white shadow-sm">
              {cards.map((card) => {
                const uploaded = formatDate(card.uploadedAt);
                const busy = busySlug === card.slug;

                return (
                  <div key={card.slug} className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{card.title}</p>

                        <p className="mt-1 text-sm text-[#756f64]">
                          {card.fileName ? (
                            <>
                              {card.fileName}
                              {card.sizeBytes ? ` · ${formatBytes(card.sizeBytes)}` : ""}
                              {uploaded ? ` · hochgeladen am ${uploaded}` : ""}
                            </>
                          ) : (
                            "Noch keine PDF hinterlegt"
                          )}
                        </p>
                      </div>

                      {card.fileName ? (
                        <div className="flex items-center gap-3">
                          <Badge tone="green">Online</Badge>
                          <a
                            href={`/karten/${card.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-[#315c45] underline underline-offset-4"
                          >
                            Ansehen
                          </a>
                        </div>
                      ) : (
                        <Badge tone="gray">Nicht sichtbar</Badge>
                      )}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        ref={(element) => {
                          inputs.current[card.slug] = element;
                        }}
                        className="w-full text-sm text-[#756f64] file:mr-4 file:rounded-full file:border-0 file:bg-[#e9e2d5] file:px-5 file:py-2.5 file:text-sm file:font-bold file:text-[#211f1b] hover:file:bg-[#dbd2c2] sm:w-auto"
                      />

                      <div className="flex gap-2">
                        <Button onClick={() => upload(card.slug)} disabled={busy} small>
                          {busy ? "Hochladen..." : "Hochladen"}
                        </Button>

                        {card.fileName && (
                          <Button
                            variant="danger"
                            small
                            onClick={() => removeFile(card)}
                            disabled={busy}
                          >
                            Entfernen
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="mt-6 text-sm text-[#756f64]">
          Es sind {MENU_CARDS.length} Karten vorgesehen. Karten ohne PDF werden auf der
          Website nicht angeboten.
        </p>
      </div>
    </main>
  );
}
