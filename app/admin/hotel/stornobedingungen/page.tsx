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
import {
  BASIS_LABELS,
  CANCELLATION_BASES,
  type CancellationBasis,
} from "@/lib/hotel/cancellation";
import { type ApiResult, apiRequest, toFormValue } from "@/lib/hotel/client";

type Rule = {
  id: number;
  appliesFromDaysBefore: number;
  basis: CancellationBasis;
  feePercent: string | null;
  feeAmount: string | null;
};

type Policy = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  noShowFeePercent: string | null;
  rules: Rule[];
  preview: string[];
};

type RatePlan = {
  id: number;
  code: string;
  name: string;
  cancellationPolicyId: number | null;
  active: boolean;
  cardGuaranteeRequired: boolean;
};

type Response = {
  hotelReady: boolean;
  policies: Policy[];
  ratePlans: RatePlan[];
  paymentConfigured: boolean;
};

const ENDPOINT = "/api/admin/hotel/stornobedingungen";
const fetchData = () => apiRequest<Response>(ENDPOINT);

const emptyRule = { appliesFromDaysBefore: "3", basis: "PERCENT_OF_TOTAL" as CancellationBasis, feePercent: "100", feeAmount: "" };

export default function CancellationPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", noShowFeePercent: "", active: true });
  const [newRule, setNewRule] = useState<Record<number, typeof emptyRule>>({});

  const applyResult = useCallback((result: ApiResult<Response>) => {
    if (result.ok) setData(result.data);
    else setError(result.error);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData().then(applyResult);
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

    applyResult(await fetchData());
    setBusy(false);
    setSuccess(message);
  }

  function openPolicy(policy: Policy) {
    setEditing(policy.id);
    setForm({
      name: policy.name,
      description: toFormValue(policy.description),
      noShowFeePercent: toFormValue(policy.noShowFeePercent),
      active: policy.active,
    });
  }

  const policies = data?.policies ?? [];
  const ratePlans = data?.ratePlans ?? [];
  const ruleForm = (policyId: number) => newRule[policyId] ?? emptyRule;

  return (
    <div>
      <PageIntro
        eyebrow="Hotel"
        title="Stornobedingungen"
        description="Fristen und Gebühren der Stornierung. Die Werte gelten sofort für neue Buchungen. Bereits bestehende Buchungen behalten die Bedingungen, die beim Buchen galten."
      />

      <div className="mt-8 space-y-3">
        {!loading && data?.hotelReady === false && <HotelMissing />}
        {error && <Alert kind="error">{error}</Alert>}
        {success && <Alert kind="success">✓ {success}</Alert>}
      </div>

      {loading ? (
        <div className="mt-8">
          <EmptyState title="Wird geladen..." />
        </div>
      ) : policies.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Noch keine Richtlinie">
            Legen Sie mit dem Seed-Skript die Standardbedingungen an.
          </EmptyState>
        </div>
      ) : (
        policies.map((policy) => (
          <Card key={policy.id} className="mt-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-serif text-2xl">{policy.name}</h2>
                  <Badge tone={policy.active ? "green" : "gray"}>
                    {policy.active ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-[#756f64]">{policy.code}</p>
              </div>

              {editing === policy.id ? (
                <div className="flex gap-2">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => apiRequest(ENDPOINT, "PATCH", { id: policy.id, ...form }),
                        "Die Richtlinie wurde gespeichert."
                      ).then(() => setEditing(null))
                    }
                  >
                    Speichern
                  </Button>
                  <Button variant="secondary" onClick={() => setEditing(null)}>
                    Abbrechen
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" onClick={() => openPolicy(policy)}>
                  Bearbeiten
                </Button>
              )}
            </div>

            {editing === policy.id && (
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field label="Name">
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Gebühr bei Nichtanreise (%)">
                  <input
                    value={form.noShowFeePercent}
                    onChange={(e) => setForm({ ...form, noShowFeePercent: e.target.value })}
                    placeholder="z. B. 100"
                    className={inputClass}
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field label="Beschreibung (intern)">
                    <input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <Checkbox
                  label="Aktiv"
                  checked={form.active}
                  onChange={(active) => setForm({ ...form, active })}
                />
              </div>
            )}

            {/* Was der Gast sieht */}
            <div className="mt-6 rounded-xl border border-[#211f1b]/10 bg-[#f5f1e8] p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#756f64]">
                So steht es auf der Buchungsseite
              </p>
              <ul className="mt-3 space-y-1 text-sm leading-6">
                {policy.preview.map((zeile) => (
                  <li key={zeile}>{zeile}</li>
                ))}
              </ul>
            </div>

            {/* Fristen */}
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-[#756f64]">
                Fristen und Gebühren
              </p>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-[#e9e2d5] text-xs uppercase tracking-wider text-[#756f64]">
                    <tr>
                      <th className="px-4 py-3">Ab weniger als … Tagen vor Anreise</th>
                      <th className="px-4 py-3">Grundlage</th>
                      <th className="px-4 py-3">Gebühr</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#211f1b]/10">
                    {policy.rules.map((rule) => (
                      <tr key={rule.id}>
                        <td className="px-4 py-3 font-semibold">{rule.appliesFromDaysBefore}</td>
                        <td className="px-4 py-3">{BASIS_LABELS[rule.basis]}</td>
                        <td className="px-4 py-3">
                          {rule.basis === "FIXED_AMOUNT"
                            ? `${Number(rule.feeAmount ?? 0).toFixed(2)} €`
                            : rule.basis === "FIRST_NIGHT"
                              ? "erste Nacht"
                              : `${Number(rule.feePercent ?? 0)} %`}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            small
                            variant="danger"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm("Diese Frist wirklich löschen?")) return;

                              run(
                                () =>
                                  apiRequest(ENDPOINT, "DELETE", {
                                    action: "deleteRule",
                                    ruleId: rule.id,
                                  }),
                                "Die Frist wurde gelöscht."
                              );
                            }}
                          >
                            Löschen
                          </Button>
                        </td>
                      </tr>
                    ))}

                    {policy.rules.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-[#756f64]">
                          Ohne Frist ist jede Stornierung kostenlos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Neue Frist */}
              <div className="mt-4 grid gap-3 rounded-xl border border-[#211f1b]/10 bg-white p-4 sm:grid-cols-4">
                <Field label="Ab weniger als … Tagen">
                  <input
                    value={ruleForm(policy.id).appliesFromDaysBefore}
                    onChange={(e) =>
                      setNewRule({
                        ...newRule,
                        [policy.id]: { ...ruleForm(policy.id), appliesFromDaysBefore: e.target.value },
                      })
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Grundlage">
                  <select
                    value={ruleForm(policy.id).basis}
                    onChange={(e) =>
                      setNewRule({
                        ...newRule,
                        [policy.id]: {
                          ...ruleForm(policy.id),
                          basis: e.target.value as CancellationBasis,
                        },
                      })
                    }
                    className={inputClass}
                  >
                    {CANCELLATION_BASES.map((basis) => (
                      <option key={basis} value={basis}>
                        {BASIS_LABELS[basis]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label={
                    ruleForm(policy.id).basis === "FIXED_AMOUNT" ? "Betrag (€)" : "Gebühr (%)"
                  }
                >
                  <input
                    value={
                      ruleForm(policy.id).basis === "FIXED_AMOUNT"
                        ? ruleForm(policy.id).feeAmount
                        : ruleForm(policy.id).feePercent
                    }
                    onChange={(e) =>
                      setNewRule({
                        ...newRule,
                        [policy.id]: {
                          ...ruleForm(policy.id),
                          ...(ruleForm(policy.id).basis === "FIXED_AMOUNT"
                            ? { feeAmount: e.target.value }
                            : { feePercent: e.target.value }),
                        },
                      })
                    }
                    className={inputClass}
                  />
                </Field>

                <div className="flex items-end">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          apiRequest(ENDPOINT, "POST", {
                            action: "addRule",
                            policyId: policy.id,
                            ...ruleForm(policy.id),
                          }),
                        "Die Frist wurde hinzugefügt."
                      )
                    }
                  >
                    + Frist
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))
      )}

      {/* Zuordnung zu den Rate Plans */}
      {ratePlans.length > 0 && (
        <Card className="mt-8">
          <h2 className="font-serif text-2xl">Zuordnung</h2>
          <p className="mt-1 text-sm text-[#756f64]">
            Welche Richtlinie gilt für welchen Rate Plan. Die Buchungsstrecke verwendet den
            Standard-Rate-Plan.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {ratePlans.map((plan) => (
              <div key={plan.id} className="rounded-xl border border-[#211f1b]/10 bg-white p-4">
                <p className="font-semibold">{plan.name}</p>
                <p className="mt-1 font-mono text-xs text-[#756f64]">{plan.code}</p>

                <select
                  value={plan.cancellationPolicyId ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    run(
                      () =>
                        apiRequest(ENDPOINT, "PATCH", {
                          action: "assign",
                          ratePlanId: plan.id,
                          policyId: e.target.value === "" ? null : Number(e.target.value),
                        }),
                      "Die Zuordnung wurde gespeichert."
                    )
                  }
                  className={`${inputClass} mt-3`}
                >
                  <option value="">Keine Stornierungsbedingung</option>
                  {policies.map((policy) => (
                    <option key={policy.id} value={policy.id}>
                      {policy.name}
                    </option>
                  ))}
                </select>

                <div className="mt-4 border-t border-[#211f1b]/10 pt-4">
                  <Checkbox
                    label="Kreditkarte als Garantie verlangen"
                    checked={plan.cardGuaranteeRequired}
                    onChange={(cardGuaranteeRequired) =>
                      run(
                        () =>
                          apiRequest(ENDPOINT, "PATCH", {
                            action: "cardGuarantee",
                            ratePlanId: plan.id,
                            cardGuaranteeRequired,
                          }),
                        cardGuaranteeRequired
                          ? "Für diesen Rate Plan ist jetzt eine Kreditkarte nötig."
                          : "Für diesen Rate Plan ist keine Kreditkarte mehr nötig."
                      )
                    }
                  />

                  {plan.cardGuaranteeRequired && data?.paymentConfigured === false && (
                    <p className="mt-2 text-sm text-red-700">
                      Es ist kein Zahlungsanbieter eingerichtet. Buchungen über diesen Rate
                      Plan sind derzeit nicht möglich.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
