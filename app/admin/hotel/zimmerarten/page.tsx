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
  HotelMissing,
  PageIntro,
  inputClass,
} from "@/components/hotel-admin/ui";
import { type ApiResult, apiRequest, toFormValue } from "@/lib/hotel/client";
import {
  PRICING_MODES,
  PRICING_MODE_LABELS,
  type PricingMode,
  slugify,
} from "@/lib/hotel/constants";

type RoomType = {
  id: number;
  code: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  standardOccupancy: number;
  maxOccupancy: number;
  maxAdults: number | null;
  maxChildren: number | null;
  bedConfiguration: string | null;
  sizeSqm: number | null;
  pricingMode: PricingMode;
  breakfastIncluded: boolean;
  channelCode: string | null;
  sortOrder: number;
  active: boolean;
  rooms: number;
};

type RoomTypesResponse = { hotelReady: boolean; roomTypes: RoomType[] };

const fetchRoomTypes = () => apiRequest<RoomTypesResponse>("/api/admin/hotel/zimmerarten");

type FormState = {
  code: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  standardOccupancy: string;
  maxOccupancy: string;
  maxAdults: string;
  maxChildren: string;
  bedConfiguration: string;
  sizeSqm: string;
  pricingMode: PricingMode;
  breakfastIncluded: boolean;
  channelCode: string;
  sortOrder: string;
  active: boolean;
};

const emptyForm: FormState = {
  code: "",
  name: "",
  slug: "",
  shortDescription: "",
  description: "",
  standardOccupancy: "1",
  maxOccupancy: "1",
  maxAdults: "",
  maxChildren: "",
  bedConfiguration: "",
  sizeSqm: "",
  pricingMode: "PER_ROOM",
  breakfastIncluded: true,
  channelCode: "",
  sortOrder: "0",
  active: true,
};

function toForm(roomType: RoomType): FormState {
  return {
    code: roomType.code,
    name: roomType.name,
    slug: roomType.slug,
    shortDescription: toFormValue(roomType.shortDescription),
    description: toFormValue(roomType.description),
    standardOccupancy: String(roomType.standardOccupancy),
    maxOccupancy: String(roomType.maxOccupancy),
    maxAdults: toFormValue(roomType.maxAdults),
    maxChildren: toFormValue(roomType.maxChildren),
    bedConfiguration: toFormValue(roomType.bedConfiguration),
    sizeSqm: toFormValue(roomType.sizeSqm),
    pricingMode: roomType.pricingMode,
    breakfastIncluded: roomType.breakfastIncluded,
    channelCode: toFormValue(roomType.channelCode),
    sortOrder: String(roomType.sortOrder),
    active: roomType.active,
  };
}

export default function RoomTypesPage() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [hotelReady, setHotelReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const applyResult = useCallback((result: ApiResult<RoomTypesResponse>) => {
    if (result.ok) {
      setRoomTypes(result.data.roomTypes);
      setHotelReady(result.data.hotelReady);
    } else {
      setError(result.error);
    }

    setLoading(false);
  }, []);

  const load = useCallback(async () => applyResult(await fetchRoomTypes()), [applyResult]);

  useEffect(() => {
    fetchRoomTypes().then(applyResult);
  }, [applyResult]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "name" && !slugTouched) {
        next.slug = slugify(String(value));
      }

      return next;
    });
  }

  function openForm(roomType?: RoomType) {
    setError("");
    setSuccess("");
    setEditingId(roomType ? roomType.id : "new");
    setForm(roomType ? toForm(roomType) : emptyForm);
    setSlugTouched(Boolean(roomType));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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

  async function handleSave() {
    const isNew = editingId === "new";
    const saved = await run(
      () =>
        apiRequest("/api/admin/hotel/zimmerarten", isNew ? "POST" : "PATCH", {
          ...form,
          ...(isNew ? {} : { id: editingId }),
        }),
      isNew ? "Zimmerart wurde angelegt." : "Zimmerart wurde gespeichert."
    );

    if (saved) {
      setEditingId(null);
    }
  }

  function toggleActive(roomType: RoomType) {
    run(
      () =>
        apiRequest("/api/admin/hotel/zimmerarten", "PATCH", {
          id: roomType.id,
          action: "setActive",
          active: !roomType.active,
        }),
      `„${roomType.name}“ ist jetzt ${roomType.active ? "inaktiv" : "aktiv"}.`
    );
  }

  function remove(roomType: RoomType) {
    if (!window.confirm(`Zimmerart „${roomType.name}“ wirklich löschen?`)) {
      return;
    }

    run(
      () => apiRequest("/api/admin/hotel/zimmerarten", "DELETE", { id: roomType.id }),
      `„${roomType.name}“ wurde gelöscht.`
    );
  }

  const input = (key: keyof FormState, label: string, opts: { required?: boolean; type?: string; hint?: string; min?: number } = {}) => (
    <Field label={label} required={opts.required} hint={opts.hint}>
      <input
        type={opts.type ?? "text"}
        min={opts.min}
        value={String(form[key])}
        onChange={(e) => {
          if (key === "slug") setSlugTouched(true);
          update(key, e.target.value as never);
        }}
        className={inputClass}
      />
    </Field>
  );

  return (
    <div>
      <PageIntro
        eyebrow="Zimmer"
        title="Zimmerarten"
        description="Kategorien, die Gäste buchen. Konkrete Zimmer werden einer Zimmerart zugeordnet."
        action={
          hotelReady && editingId === null ? (
            <Button onClick={() => openForm()}>+ Neue Zimmerart</Button>
          ) : null
        }
      />

      <div className="mt-8 space-y-3">
        {!loading && !hotelReady && <HotelMissing />}
        {error && <Alert kind="error">{error}</Alert>}
        {success && <Alert kind="success">✓ {success}</Alert>}
      </div>

      {editingId !== null && (
        <Card className="mt-8">
          <h2 className="font-serif text-2xl">
            {editingId === "new" ? "Neue Zimmerart" : "Zimmerart bearbeiten"}
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {input("code", "Code", { required: true, hint: "z. B. DZ" })}
            {input("name", "Name", { required: true })}
            {input("slug", "Slug", { required: true, hint: "Wird aus dem Namen vorgeschlagen." })}
          </div>

          <div className="mt-5 grid gap-5">
            {input("shortDescription", "Kurzbeschreibung")}
            <Field label="Beschreibung">
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                className={`${inputClass} resize-y`}
              />
            </Field>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {input("standardOccupancy", "Standardbelegung", { required: true, type: "number", min: 1 })}
            {input("maxOccupancy", "Maximalbelegung", { required: true, type: "number", min: 1 })}
            {input("maxAdults", "Max. Erwachsene", { type: "number", min: 1 })}
            {input("maxChildren", "Max. Kinder", { type: "number", min: 0 })}
            {input("bedConfiguration", "Bettenkonfiguration", { hint: "z. B. 1 Doppelbett" })}
            {input("sizeSqm", "Größe (m²)", { type: "number", min: 1 })}
            <Field label="Preisart" required>
              <select
                value={form.pricingMode}
                onChange={(e) => update("pricingMode", e.target.value as PricingMode)}
                className={inputClass}
              >
                {PRICING_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {PRICING_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </Field>
            {input("channelCode", "Channel-Code", { hint: "Für Booking.com o. ä." })}
            {input("sortOrder", "Sortierung", { type: "number" })}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Checkbox
              label="Frühstück inklusive"
              checked={form.breakfastIncluded}
              onChange={(value) => update("breakfastIncluded", value)}
            />
            <Checkbox
              label="Aktiv"
              description="Inaktive Zimmerarten sind nicht buchbar."
              checked={form.active}
              onChange={(value) => update("active", value)}
            />
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setEditingId(null)} disabled={busy}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={busy}>
              {busy ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </Card>
      )}

      <section className="mt-8">
        {loading ? (
          <EmptyState title="Zimmerarten werden geladen..." />
        ) : hotelReady && roomTypes.length === 0 ? (
          <EmptyState title="Noch keine Zimmerarten">
            Legen Sie die erste Zimmerart an, z. B. Einbettzimmer oder Doppelbettzimmer.
          </EmptyState>
        ) : roomTypes.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-[#211f1b]/10 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#e9e2d5] text-xs uppercase tracking-wider text-[#756f64]">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Belegung</th>
                  <th className="px-4 py-3">Preisart</th>
                  <th className="px-4 py-3">Frühstück</th>
                  <th className="px-4 py-3">Sort.</th>
                  <th className="px-4 py-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#211f1b]/10">
                {roomTypes.map((roomType) => (
                  <tr key={roomType.id} className={roomType.active ? "" : "bg-[#f5f1e8]/60 text-[#756f64]"}>
                    <td className="px-4 py-4 font-mono font-semibold">{roomType.code}</td>
                    <td className="px-4 py-4">
                      <p className="font-semibold">{roomType.name}</p>
                      <p className="text-xs text-[#756f64]">{roomType.rooms} Zimmer</p>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={roomType.active ? "green" : "gray"}>
                        {roomType.active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      {roomType.standardOccupancy} / max. {roomType.maxOccupancy}
                    </td>
                    <td className="px-4 py-4">{PRICING_MODE_LABELS[roomType.pricingMode]}</td>
                    <td className="px-4 py-4">{roomType.breakfastIncluded ? "Ja" : "Nein"}</td>
                    <td className="px-4 py-4">{roomType.sortOrder}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <Button small variant="secondary" onClick={() => openForm(roomType)} disabled={busy}>
                          Bearbeiten
                        </Button>
                        <Button small variant="secondary" onClick={() => toggleActive(roomType)} disabled={busy}>
                          {roomType.active ? "Deaktivieren" : "Aktivieren"}
                        </Button>
                        <Button small variant="danger" onClick={() => remove(roomType)} disabled={busy}>
                          Löschen
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
