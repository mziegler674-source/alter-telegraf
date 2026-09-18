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
  ROOM_STATUSES,
  ROOM_STATUS_LABELS,
  type RoomStatus,
} from "@/lib/hotel/constants";

type Room = {
  id: number;
  number: string;
  roomTypeId: number;
  floor: number | null;
  status: RoomStatus;
  notes: string | null;
  active: boolean;
};

type RoomTypeOption = { id: number; code: string; name: string; active: boolean };

type RoomsResponse = { hotelReady: boolean; rooms: Room[]; roomTypes: RoomTypeOption[] };

const fetchRooms = () => apiRequest<RoomsResponse>("/api/admin/hotel/zimmer");

type FormState = {
  number: string;
  roomTypeId: string;
  floor: string;
  status: RoomStatus;
  notes: string;
  active: boolean;
};

const statusTone: Record<RoomStatus, "green" | "amber" | "red" | "neutral"> = {
  CLEAN: "green",
  INSPECTED: "green",
  DIRTY: "amber",
  OUT_OF_SERVICE: "red",
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [hotelReady, setHotelReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const applyResult = useCallback((result: ApiResult<RoomsResponse>) => {
    if (result.ok) {
      setRooms(result.data.rooms);
      setRoomTypes(result.data.roomTypes);
      setHotelReady(result.data.hotelReady);
    } else {
      setError(result.error);
    }

    setLoading(false);
  }, []);

  const load = useCallback(async () => applyResult(await fetchRooms()), [applyResult]);

  useEffect(() => {
    fetchRooms().then(applyResult);
  }, [applyResult]);

  const roomTypeName = (id: number) => {
    const roomType = roomTypes.find((r) => r.id === id);
    return roomType ? `${roomType.name} (${roomType.code})` : "–";
  };

  function openForm(room?: Room) {
    setError("");
    setSuccess("");
    setEditingId(room ? room.id : "new");
    setForm(
      room
        ? {
            number: room.number,
            roomTypeId: String(room.roomTypeId),
            floor: toFormValue(room.floor),
            status: room.status,
            notes: toFormValue(room.notes),
            active: room.active,
          }
        : {
            number: "",
            roomTypeId: String(roomTypes.find((r) => r.active)?.id ?? ""),
            floor: "",
            status: "CLEAN",
            notes: "",
            active: true,
          }
    );
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
    if (!form) return;

    const isNew = editingId === "new";
    const saved = await run(
      () =>
        apiRequest("/api/admin/hotel/zimmer", isNew ? "POST" : "PATCH", {
          ...form,
          ...(isNew ? {} : { id: editingId }),
        }),
      isNew ? `Zimmer ${form.number} wurde angelegt.` : `Zimmer ${form.number} wurde gespeichert.`
    );

    if (saved) {
      setEditingId(null);
      setForm(null);
    }
  }

  function setStatus(room: Room, status: RoomStatus) {
    run(
      () => apiRequest("/api/admin/hotel/zimmer", "PATCH", { id: room.id, action: "setStatus", status }),
      `Zimmer ${room.number}: ${ROOM_STATUS_LABELS[status]}.`
    );
  }

  function toggleActive(room: Room) {
    run(
      () => apiRequest("/api/admin/hotel/zimmer", "PATCH", { id: room.id, action: "setActive", active: !room.active }),
      `Zimmer ${room.number} ist jetzt ${room.active ? "inaktiv" : "aktiv"}.`
    );
  }

  function remove(room: Room) {
    if (!window.confirm(`Zimmer ${room.number} wirklich löschen?`)) return;

    run(
      () => apiRequest("/api/admin/hotel/zimmer", "DELETE", { id: room.id }),
      `Zimmer ${room.number} wurde gelöscht.`
    );
  }

  const noRoomTypes = hotelReady && !loading && roomTypes.length === 0;

  return (
    <div>
      <PageIntro
        eyebrow="Zimmer"
        title="Zimmer"
        description="Konkrete Zimmer mit Nummer, Etage und Reinigungsstatus."
        action={
          hotelReady && !noRoomTypes && editingId === null ? (
            <Button onClick={() => openForm()}>+ Neues Zimmer</Button>
          ) : null
        }
      />

      <div className="mt-8 space-y-3">
        {!loading && !hotelReady && <HotelMissing />}
        {noRoomTypes && (
          <Alert kind="info">
            Bitte zuerst eine{" "}
            <a href="/admin/hotel/zimmerarten" className="underline">
              Zimmerart anlegen
            </a>
            .
          </Alert>
        )}
        {error && <Alert kind="error">{error}</Alert>}
        {success && <Alert kind="success">✓ {success}</Alert>}
      </div>

      {editingId !== null && form && (
        <Card className="mt-8">
          <h2 className="font-serif text-2xl">
            {editingId === "new" ? "Neues Zimmer" : `Zimmer ${form.number} bearbeiten`}
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Zimmernummer" required hint="Eindeutig innerhalb des Hotels.">
              <input
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Zimmerart" required>
              <select
                value={form.roomTypeId}
                onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })}
                className={inputClass}
              >
                <option value="">Bitte wählen</option>
                {roomTypes.map((roomType) => (
                  <option key={roomType.id} value={roomType.id}>
                    {roomType.name} ({roomType.code}){roomType.active ? "" : " – inaktiv"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Etage">
              <input
                type="number"
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Status" required>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as RoomStatus })}
                className={inputClass}
              >
                {ROOM_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {ROOM_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field label="Notizen">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={`${inputClass} resize-y`}
              />
            </Field>
            <div className="md:pt-7">
              <Checkbox
                label="Aktiv"
                description="Inaktive Zimmer werden nicht vergeben."
                checked={form.active}
                onChange={(active) => setForm({ ...form, active })}
              />
            </div>
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => { setEditingId(null); setForm(null); }} disabled={busy}>
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
          <EmptyState title="Zimmer werden geladen..." />
        ) : hotelReady && !noRoomTypes && rooms.length === 0 ? (
          <EmptyState title="Noch keine Zimmer">
            Legen Sie die Zimmer des Hotels mit ihrer Nummer und Zimmerart an.
          </EmptyState>
        ) : rooms.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-[#211f1b]/10 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#e9e2d5] text-xs uppercase tracking-wider text-[#756f64]">
                <tr>
                  <th className="px-4 py-3">Nr.</th>
                  <th className="px-4 py-3">Zimmerart</th>
                  <th className="px-4 py-3">Etage</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Aktiv</th>
                  <th className="px-4 py-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#211f1b]/10">
                {rooms.map((room) => (
                  <tr key={room.id} className={room.active ? "" : "bg-[#f5f1e8]/60 text-[#756f64]"}>
                    <td className="px-4 py-4 font-serif text-xl">{room.number}</td>
                    <td className="px-4 py-4">{roomTypeName(room.roomTypeId)}</td>
                    <td className="px-4 py-4">{room.floor ?? "–"}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Badge tone={statusTone[room.status]}>{ROOM_STATUS_LABELS[room.status]}</Badge>
                        <select
                          aria-label={`Status Zimmer ${room.number}`}
                          value={room.status}
                          disabled={busy}
                          onChange={(e) => setStatus(room, e.target.value as RoomStatus)}
                          className="rounded-lg border border-[#211f1b]/15 bg-white px-2 py-1 text-xs"
                        >
                          {ROOM_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {ROOM_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={room.active ? "green" : "gray"}>{room.active ? "Aktiv" : "Inaktiv"}</Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <Button small variant="secondary" onClick={() => openForm(room)} disabled={busy}>
                          Bearbeiten
                        </Button>
                        <Button small variant="secondary" onClick={() => toggleActive(room)} disabled={busy}>
                          {room.active ? "Deaktivieren" : "Aktivieren"}
                        </Button>
                        <Button small variant="danger" onClick={() => remove(room)} disabled={busy}>
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
