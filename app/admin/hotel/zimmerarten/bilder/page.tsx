"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  EmptyState,
  HotelMissing,
  PageIntro,
  inputClass,
} from "@/components/hotel-admin/ui";
import { type ApiResult, apiRequest } from "@/lib/hotel/client";
import {
  ALLOWED_IMAGE_LABEL,
  MAX_IMAGES_PER_ROOM_TYPE,
  MAX_IMAGE_BYTES,
  formatImageSize,
  imageSrc,
} from "@/lib/hotel/images";

type RoomType = { id: number; code: string; name: string; active: boolean };

type Image = {
  id: number;
  roomTypeId: number;
  url: string | null;
  alt: string | null;
  sortOrder: number;
  isPrimary: boolean;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  uploadedAt: string | null;
  hasFile: boolean;
};

type Response = { hotelReady: boolean; roomTypes: RoomType[]; images: Image[] };

const ENDPOINT = "/api/admin/hotel/zimmerbilder";

const fetchImages = () => apiRequest<Response>(ENDPOINT);

export default function RoomImagesPage() {
  const [data, setData] = useState<Response | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const applyResult = useCallback((result: ApiResult<Response>) => {
    if (result.ok) {
      setData(result.data);
      setSelectedId((current) => current ?? result.data.roomTypes[0]?.id ?? null);
    } else {
      setError(result.error);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchImages().then(applyResult);
  }, [applyResult]);

  async function run(action: () => Promise<ApiResult<unknown>>, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");

    const result = await action();

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    applyResult(await fetchImages());
    setBusy(false);
    setSuccess(message);
  }

  async function upload(file: File) {
    if (!selectedId) return;

    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Das Bild ist zu groß (maximal ${MAX_IMAGE_BYTES / 1024 / 1024} MB).`);
      return;
    }

    const form = new FormData();
    form.append("roomTypeId", String(selectedId));
    form.append("file", file);

    setBusy(true);
    setError("");
    setSuccess("");

    const response = await fetch(ENDPOINT, { method: "POST", body: form });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setBusy(false);
      setError(body.error ?? "Das Bild konnte nicht gespeichert werden.");
      return;
    }

    applyResult(await fetchImages());
    setBusy(false);
    setSuccess("Das Bild wurde hinzugefügt.");

    if (fileInput.current) fileInput.current.value = "";
  }

  const roomTypes = data?.roomTypes ?? [];
  const images = (data?.images ?? []).filter((image) => image.roomTypeId === selectedId);
  const selected = roomTypes.find((type) => type.id === selectedId) ?? null;

  return (
    <div>
      <PageIntro
        eyebrow="Zimmerarten"
        title="Bilder"
        description="Fotos je Zimmerkategorie. Das Hauptbild erscheint groß auf der Zimmerkarte, die übrigen Bilder in der Galerie."
      />

      <nav className="mt-6 flex flex-wrap gap-2 text-sm">
        <a
          href="/admin/hotel/zimmerarten"
          className="rounded-full border border-[#211f1b]/15 bg-white px-4 py-2 font-semibold transition hover:border-[#315c45]"
        >
          Allgemein
        </a>

        <span className="rounded-full bg-[#315c45] px-4 py-2 font-semibold text-white">
          Bilder
        </span>

        <a
          href="/admin/hotel/ausstattung"
          className="rounded-full border border-[#211f1b]/15 bg-white px-4 py-2 font-semibold transition hover:border-[#315c45]"
        >
          Ausstattung
        </a>
      </nav>

      <div className="mt-8 space-y-3">
        {!loading && data?.hotelReady === false && <HotelMissing />}
        {error && <Alert kind="error">{error}</Alert>}
        {success && <Alert kind="success">✓ {success}</Alert>}
      </div>

      {roomTypes.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {roomTypes.map((type) => {
            const count = (data?.images ?? []).filter(
              (image) => image.roomTypeId === type.id
            ).length;

            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedId(type.id)}
                className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                  type.id === selectedId
                    ? "border-[#315c45] bg-[#315c45] text-white"
                    : "border-[#211f1b]/15 bg-white hover:border-[#315c45]"
                }`}
              >
                {type.name}
                <span className="ml-2 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <section className="mt-8 rounded-2xl border border-[#211f1b]/10 bg-white p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl">{selected.name}</h2>
              <p className="mt-1 text-sm text-[#756f64]">
                {ALLOWED_IMAGE_LABEL}, bis {MAX_IMAGE_BYTES / 1024 / 1024} MB je Bild, höchstens{" "}
                {MAX_IMAGES_PER_ROOM_TYPE} Bilder.
              </p>
            </div>

            <label className="block">
              <span className="sr-only">Bild auswählen</span>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) upload(file);
                }}
                className={inputClass}
              />
            </label>
          </div>

          {images.length === 0 ? (
            <div className="mt-6">
              <EmptyState title="Noch keine Bilder">
                Ohne Bild zeigt die Zimmerkarte nur den Namen der Kategorie.
              </EmptyState>
            </div>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((image, index) => {
                const src = imageSrc(image);

                return (
                  <li
                    key={image.id}
                    className="overflow-hidden rounded-xl border border-[#211f1b]/10"
                  >
                    <div className="aspect-[4/3] bg-[#e9e2d5]">
                      {src && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={src}
                          alt={image.alt ?? ""}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        {image.isPrimary ? (
                          <Badge tone="green">Hauptbild</Badge>
                        ) : (
                          <span className="text-xs text-[#756f64]">Bild {index + 1}</span>
                        )}

                        {image.sizeBytes !== null && (
                          <span className="text-xs text-[#756f64]">
                            {formatImageSize(image.sizeBytes)}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 truncate text-xs text-[#756f64]">
                        {image.fileName ?? image.url ?? "—"}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {!image.isPrimary && (
                          <Button
                            small
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  apiRequest(ENDPOINT, "PATCH", {
                                    id: image.id,
                                    action: "makePrimary",
                                  }),
                                "Das Hauptbild wurde geändert."
                              )
                            }
                          >
                            Als Hauptbild
                          </Button>
                        )}

                        <Button
                          small
                          variant="secondary"
                          disabled={busy || index === 0}
                          onClick={() =>
                            run(
                              () =>
                                apiRequest(ENDPOINT, "PATCH", {
                                  id: image.id,
                                  action: "move",
                                  direction: "up",
                                }),
                              "Die Reihenfolge wurde geändert."
                            )
                          }
                        >
                          ← Nach vorn
                        </Button>

                        <Button
                          small
                          variant="secondary"
                          disabled={busy || index === images.length - 1}
                          onClick={() =>
                            run(
                              () =>
                                apiRequest(ENDPOINT, "PATCH", {
                                  id: image.id,
                                  action: "move",
                                  direction: "down",
                                }),
                              "Die Reihenfolge wurde geändert."
                            )
                          }
                        >
                          Nach hinten →
                        </Button>

                        <Button
                          small
                          variant="danger"
                          disabled={busy}
                          onClick={() => {
                            if (!window.confirm("Dieses Bild wirklich löschen?")) return;

                            run(
                              () => apiRequest(ENDPOINT, "DELETE", { id: image.id }),
                              "Das Bild wurde gelöscht."
                            );
                          }}
                        >
                          Löschen
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {loading && <EmptyState title="Wird geladen..." />}
    </div>
  );
}
