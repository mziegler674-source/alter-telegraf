"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  HotelMissing,
  PageIntro,
  inputClass,
} from "@/components/hotel-admin/ui";
import { type ApiResult, apiRequest, toFormValue } from "@/lib/hotel/client";

type Amenity = {
  id: number;
  code: string;
  name: string;
  icon: string | null;
  sortOrder: number;
};

type RoomTypeWithAmenities = {
  id: number;
  code: string;
  name: string;
  active: boolean;
  amenityIds: number[];
};

type AmenitiesResponse = {
  hotelReady: boolean;
  amenities: Amenity[];
  roomTypes: RoomTypeWithAmenities[];
};

const fetchAmenities = () => apiRequest<AmenitiesResponse>("/api/admin/hotel/ausstattung");

type FormState = { code: string; name: string; icon: string; sortOrder: string };

const emptyForm: FormState = { code: "", name: "", icon: "", sortOrder: "0" };

export default function AmenitiesPage() {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeWithAmenities[]>([]);
  const [hotelReady, setHotelReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<number | null>(null);
  // Ungespeicherte Checkbox-Änderungen; ohne Entwurf gilt der gespeicherte Stand.
  const [draft, setDraft] = useState<{ roomTypeId: number; ids: number[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const applyResult = useCallback((result: ApiResult<AmenitiesResponse>) => {
    if (result.ok) {
      setAmenities(result.data.amenities);
      setRoomTypes(result.data.roomTypes);
      setHotelReady(result.data.hotelReady);
      setDraft(null);
    } else {
      setError(result.error);
    }

    setLoading(false);
  }, []);

  const load = useCallback(async () => applyResult(await fetchAmenities()), [applyResult]);

  useEffect(() => {
    fetchAmenities().then(applyResult);
  }, [applyResult]);

  const selectedRoomType =
    roomTypes.find((r) => r.id === selectedRoomTypeId) ?? roomTypes[0] ?? null;

  const selection =
    selectedRoomType && draft?.roomTypeId === selectedRoomType.id
      ? draft.ids
      : (selectedRoomType?.amenityIds ?? []);

  function toggleSelection(amenityId: number, checked: boolean) {
    if (!selectedRoomType) return;

    setDraft({
      roomTypeId: selectedRoomType.id,
      ids: checked ? [...selection, amenityId] : selection.filter((id) => id !== amenityId),
    });
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

  function openForm(amenity?: Amenity) {
    setError("");
    setSuccess("");
    setEditingId(amenity ? amenity.id : "new");
    setForm(
      amenity
        ? { code: amenity.code, name: amenity.name, icon: toFormValue(amenity.icon), sortOrder: String(amenity.sortOrder) }
        : emptyForm
    );
  }

  async function handleSave() {
    const isNew = editingId === "new";
    const saved = await run(
      () =>
        apiRequest("/api/admin/hotel/ausstattung", isNew ? "POST" : "PATCH", {
          ...form,
          ...(isNew ? {} : { id: editingId }),
        }),
      isNew ? "Ausstattung wurde angelegt." : "Ausstattung wurde gespeichert."
    );

    if (saved) setEditingId(null);
  }

  function remove(amenity: Amenity) {
    if (!window.confirm(`Ausstattung „${amenity.name}“ wirklich löschen?`)) return;

    run(
      () => apiRequest("/api/admin/hotel/ausstattung", "DELETE", { id: amenity.id }),
      `„${amenity.name}“ wurde gelöscht.`
    );
  }

  function createExamples() {
    run(
      () => apiRequest("/api/admin/hotel/ausstattung", "POST", { action: "createExamples" }),
      "Fehlende Standardausstattung wurde angelegt."
    );
  }

  function saveAssignment() {
    if (!selectedRoomType) return;

    run(
      () =>
        apiRequest("/api/admin/hotel/ausstattung/zuordnung", "PUT", {
          roomTypeId: selectedRoomType.id,
          amenityIds: selection,
        }),
      `Ausstattung für „${selectedRoomType.name}“ wurde gespeichert.`
    );
  }

  const assignedCount = (amenityId: number) =>
    roomTypes.filter((r) => r.amenityIds.includes(amenityId)).length;

  return (
    <div>
      <PageIntro
        eyebrow="Zimmer"
        title="Ausstattung"
        description="Ausstattungsmerkmale pflegen und den Zimmerarten zuordnen."
        action={
          hotelReady && editingId === null ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={createExamples} disabled={busy || loading}>
                Standardausstattung anlegen
              </Button>
              <Button onClick={() => openForm()}>+ Neue Ausstattung</Button>
            </div>
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
            {editingId === "new" ? "Neue Ausstattung" : "Ausstattung bearbeiten"}
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Code" required hint="z. B. WLAN">
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Name" required>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Icon" hint="Optionaler Kurzname">
              <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Sortierung">
              <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className={inputClass} />
            </Field>
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

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="font-serif text-2xl">Katalog</h2>
          <div className="mt-4">
            {loading ? (
              <EmptyState title="Ausstattung wird geladen..." />
            ) : hotelReady && amenities.length === 0 ? (
              <EmptyState title="Noch keine Ausstattung">
                Mit „Standardausstattung anlegen“ werden WLAN, SAT-TV, Klimaanlage, Bad/WC, Föhn, Safe und Balkon erstellt.
              </EmptyState>
            ) : (
              <div className="divide-y divide-[#211f1b]/10 overflow-hidden rounded-2xl border border-[#211f1b]/10 bg-white shadow-sm">
                {amenities.map((amenity) => (
                  <div key={amenity.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{amenity.name}</p>
                      <p className="text-xs text-[#756f64]">
                        <span className="font-mono">{amenity.code}</span> · {assignedCount(amenity.id)} Zimmerart(en)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button small variant="secondary" onClick={() => openForm(amenity)} disabled={busy}>
                        Bearbeiten
                      </Button>
                      <Button small variant="danger" onClick={() => remove(amenity)} disabled={busy}>
                        Löschen
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl">Zuordnung zu Zimmerarten</h2>
          <div className="mt-4">
            {!loading && hotelReady && roomTypes.length === 0 ? (
              <EmptyState title="Noch keine Zimmerarten">
                <a href="/admin/hotel/zimmerarten" className="underline">Zimmerart anlegen</a>, um Ausstattung zuzuordnen.
              </EmptyState>
            ) : roomTypes.length > 0 ? (
              <Card>
                <Field label="Zimmerart">
                  <select
                    value={selectedRoomType?.id ?? ""}
                    onChange={(e) => {
                      setSelectedRoomTypeId(Number(e.target.value));
                      setDraft(null);
                    }}
                    className={inputClass}
                  >
                    {roomTypes.map((roomType) => (
                      <option key={roomType.id} value={roomType.id}>
                        {roomType.name} ({roomType.code}){roomType.active ? "" : " – inaktiv"}
                      </option>
                    ))}
                  </select>
                </Field>

                {amenities.length === 0 ? (
                  <p className="mt-5 text-sm text-[#756f64]">Zuerst Ausstattung im Katalog anlegen.</p>
                ) : (
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {amenities.map((amenity) => (
                      <label key={amenity.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#f5f1e8] px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-[#b08a4a]"
                          checked={selection.includes(amenity.id)}
                          onChange={(e) => toggleSelection(amenity.id, e.target.checked)}
                        />
                        <span className="text-sm font-semibold">{amenity.name}</span>
                      </label>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <Button onClick={saveAssignment} disabled={busy || amenities.length === 0}>
                    Zuordnung speichern
                  </Button>
                </div>
              </Card>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
