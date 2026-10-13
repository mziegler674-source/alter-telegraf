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
import { type ApiResult, apiRequest } from "@/lib/hotel/client";
import { formatAmount } from "@/lib/money";

type RoomType = {
  id: number;
  code: string;
  name: string;
  standardOccupancy: number;
  maxOccupancy: number;
};

type Response = {
  roomTypes: RoomType[];
  prices: { roomTypeId: number; occupancy: number; amount: string }[];
  breakfastPrice: string;
  discountTiers: { minNights: number; percent: number }[];
  error?: string;
};

type PriceRow = { roomTypeId: number; occupancy: number; amount: string };
type TierRow = { minNights: string; percent: string };

const fetchPrices = () => apiRequest<Response>("/api/admin/hotel/preise");

export default function HotelPricesPage() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [breakfast, setBreakfast] = useState("");
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [hotelReady, setHotelReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const applyResult = useCallback((result: ApiResult<Response>) => {
    if (result.ok) {
      setRoomTypes(result.data.roomTypes);
      setPrices(
        result.data.prices.map((price) => ({
          ...price,
          amount: formatAmount(price.amount),
        }))
      );
      setBreakfast(formatAmount(result.data.breakfastPrice));
      setTiers(
        result.data.discountTiers.map((tier) => ({
          minNights: String(tier.minNights),
          percent: String(tier.percent),
        }))
      );
    } else {
      if (/Hotel-Stammdaten/.test(result.error)) setHotelReady(false);
      setError(result.error);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPrices().then(applyResult);
  }, [applyResult]);

  function setAmount(roomTypeId: number, occupancy: number, amount: string) {
    setPrices((current) =>
      current.map((price) =>
        price.roomTypeId === roomTypeId && price.occupancy === occupancy
          ? { ...price, amount }
          : price
      )
    );
  }

  function addOccupancy(roomType: RoomType) {
    const used = prices
      .filter((price) => price.roomTypeId === roomType.id)
      .map((price) => price.occupancy);

    const next = Array.from({ length: roomType.maxOccupancy }, (_, index) => index + 1).find(
      (occupancy) => !used.includes(occupancy)
    );

    if (!next) return;

    setPrices((current) => [...current, { roomTypeId: roomType.id, occupancy: next, amount: "" }]);
  }

  function removePrice(roomTypeId: number, occupancy: number) {
    setPrices((current) =>
      current.filter(
        (price) => !(price.roomTypeId === roomTypeId && price.occupancy === occupancy)
      )
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    setSuccess("");

    const result = await apiRequest("/api/admin/hotel/preise", "PUT", {
      prices: prices.map((price) => ({
        roomTypeId: price.roomTypeId,
        occupancy: price.occupancy,
        amount: price.amount,
      })),
      breakfastPrice: breakfast,
      discountTiers: tiers.map((tier) => ({
        minNights: tier.minNights,
        percent: tier.percent,
      })),
    });

    if (!result.ok) {
      setSaving(false);
      setError(result.error);
      return;
    }

    applyResult(await fetchPrices());
    setSaving(false);
    setSuccess("Preise wurden gespeichert.");
  }

  const priceField = (roomType: RoomType, row: PriceRow) => (
    <div key={`${row.roomTypeId}-${row.occupancy}`} className="flex items-end gap-3">
      <Field
        label={`${row.occupancy} ${row.occupancy === 1 ? "Person" : "Personen"}`}
        className="flex-1"
      >
        <div className="relative">
          <input
            value={row.amount}
            onChange={(e) => setAmount(row.roomTypeId, row.occupancy, e.target.value)}
            placeholder="139,00"
            className={`${inputClass} pr-12`}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-semibold text-[#756f64]">
            €
          </span>
        </div>
      </Field>

      {prices.filter((price) => price.roomTypeId === roomType.id).length > 1 && (
        <Button
          small
          variant="ghost"
          onClick={() => removePrice(row.roomTypeId, row.occupancy)}
          disabled={saving}
        >
          Entfernen
        </Button>
      )}
    </div>
  );

  return (
    <div>
      <PageIntro
        eyebrow="Hotel"
        title="Preise"
        description="Preis pro Nacht je Zimmerart und Belegung. Frühstück und Langzeitrabatt werden bei der Buchung automatisch dazugerechnet."
      />

      <div className="mt-8 space-y-3">
        {!loading && !hotelReady && <HotelMissing />}
        {error && <Alert kind="error">{error}</Alert>}
        {success && <Alert kind="success">✓ {success}</Alert>}
      </div>

      {loading ? (
        <div className="mt-8">
          <EmptyState title="Wird geladen..." />
        </div>
      ) : (
        <div className="mt-8 grid gap-6">
          <Card>
            <h2 className="font-serif text-2xl">Zimmerpreise pro Nacht</h2>

            {roomTypes.length === 0 ? (
              <p className="mt-4 text-sm text-[#756f64]">
                Es sind keine aktiven Zimmerarten vorhanden.
              </p>
            ) : (
              <div className="mt-6 grid gap-8">
                {roomTypes.map((roomType) => {
                  const rows = prices
                    .filter((price) => price.roomTypeId === roomType.id)
                    .sort((a, b) => a.occupancy - b.occupancy);

                  const canAdd = rows.length < roomType.maxOccupancy;

                  return (
                    <div key={roomType.id} className="border-t border-[#211f1b]/10 pt-6 first:border-0 first:pt-0">
                      <p className="font-semibold">{roomType.name}</p>

                      <div className="mt-4 grid gap-4 sm:max-w-md">
                        {rows.length === 0 && (
                          <p className="text-sm text-[#756f64]">
                            Noch kein Preis hinterlegt.
                          </p>
                        )}

                        {rows.map((row) => priceField(roomType, row))}

                        {canAdd && (
                          <div>
                            <Button
                              small
                              variant="secondary"
                              onClick={() => addOccupancy(roomType)}
                              disabled={saving}
                            >
                              + Belegung hinzufügen
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="font-serif text-2xl">Frühstück</h2>

            <div className="mt-6 sm:max-w-xs">
              <Field label="Pro Person und Nacht" required>
                <div className="relative">
                  <input
                    value={breakfast}
                    onChange={(e) => setBreakfast(e.target.value)}
                    placeholder="15,00"
                    className={`${inputClass} pr-12`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-semibold text-[#756f64]">
                    €
                  </span>
                </div>
              </Field>
            </div>

            <p className="mt-4 text-sm text-[#756f64]">
              Wird bei der Buchung als Personen × Nächte × Preis berechnet.
            </p>
          </Card>

          <Card>
            <h2 className="font-serif text-2xl">Langzeitrabatt</h2>

            <p className="mt-2 text-sm text-[#756f64]">
              Gilt automatisch ab der angegebenen Anzahl Nächte. Es greift immer die
              höchste erreichte Stufe, und der Rabatt gilt nur auf den Zimmerpreis.
            </p>

            <div className="mt-6 grid gap-4 sm:max-w-md">
              {tiers.length === 0 && (
                <p className="text-sm text-[#756f64]">Kein Rabatt hinterlegt.</p>
              )}

              {tiers.map((tier, index) => (
                <div key={index} className="flex items-end gap-3">
                  <Field label="ab Nächten" className="w-32">
                    <input
                      value={tier.minNights}
                      onChange={(e) =>
                        setTiers((current) =>
                          current.map((row, i) =>
                            i === index ? { ...row, minNights: e.target.value } : row
                          )
                        )
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Rabatt" className="flex-1">
                    <div className="relative">
                      <input
                        value={tier.percent}
                        onChange={(e) =>
                          setTiers((current) =>
                            current.map((row, i) =>
                              i === index ? { ...row, percent: e.target.value } : row
                            )
                          )
                        }
                        className={`${inputClass} pr-12`}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-semibold text-[#756f64]">
                        %
                      </span>
                    </div>
                  </Field>

                  <Button
                    small
                    variant="ghost"
                    onClick={() => setTiers((current) => current.filter((_, i) => i !== index))}
                    disabled={saving}
                  >
                    Entfernen
                  </Button>
                </div>
              ))}

              <div>
                <Button
                  small
                  variant="secondary"
                  onClick={() => setTiers((current) => [...current, { minNights: "", percent: "" }])}
                  disabled={saving}
                >
                  + Stufe hinzufügen
                </Button>
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || !hotelReady}>
              {saving ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
