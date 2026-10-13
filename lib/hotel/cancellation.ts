// Stornierungsbedingungen. Die Regeln sind Daten, keine Programmlogik: Fristen
// und Saetze kommen aus der Datenbank und werden vom Betrieb im Admin
// gepflegt. Hier steht nur, wie aus diesen Daten eine Gebuehr und ein Text
// entsteht.
//
// Bewusst ohne Datenbankzugriff, damit die Berechnung vollstaendig testbar
// ist und spaeter auch die Karten-Garantie dieselbe Logik verwenden kann.

import { fromCents, toCents } from "@/lib/hotel/pricing";

import { formatMoney } from "@/lib/money";

import type { ConsentRecord } from "./consent";

export const CANCELLATION_BASES = [
  "PERCENT_OF_TOTAL",
  "FIRST_NIGHT",
  "FIXED_AMOUNT",
] as const;

export type CancellationBasis = (typeof CANCELLATION_BASES)[number];

export const BASIS_LABELS: Record<CancellationBasis, string> = {
  PERCENT_OF_TOTAL: "Prozent vom Gesamtbetrag",
  FIRST_NIGHT: "Preis der ersten Nacht",
  FIXED_AMOUNT: "fester Betrag",
};

export type RuleLike = {
  /**
   * Die Regel greift, wenn bis zur Anreise WENIGER als so viele Tage
   * verbleiben. Eine Regel mit 3 bedeutet also: bis 3 Tage vor Anreise
   * kostenlos, ab dann greift sie.
   */
  appliesFromDaysBefore: number;
  basis: CancellationBasis;
  feePercent: string | null;
  feeAmount: string | null;
};

export type PolicyLike = {
  code: string;
  name: string;
  description: string | null;
  /** Gebühr bei Nichtanreise, in Prozent des Gesamtbetrags. */
  noShowFeePercent: string | null;
  rules: RuleLike[];
};

/** Tage zwischen zwei Datumsangaben im Format YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error("Ungültiges Datum.");
  }

  return Math.round((end - start) / 86_400_000);
}

/**
 * Die anzuwendende Regel: Es greifen alle Regeln, deren Frist noch nicht
 * erreicht ist. Davon gilt die mit der kleinsten Frist, also die, die der
 * Anreise am nächsten liegt. Greift keine, ist die Stornierung kostenlos.
 */
export function applicableRule(rules: RuleLike[], daysBeforeArrival: number): RuleLike | null {
  const treffer = rules.filter((rule) => daysBeforeArrival < rule.appliesFromDaysBefore);

  if (treffer.length === 0) return null;

  return treffer.reduce((beste, rule) =>
    rule.appliesFromDaysBefore < beste.appliesFromDaysBefore ? rule : beste
  );
}

/** Die früheste Frist, ab der überhaupt etwas verrechnet wird. */
export function freeUntilDaysBefore(rules: RuleLike[]): number | null {
  if (rules.length === 0) return null;

  return rules.reduce(
    (kleinste, rule) => Math.min(kleinste, rule.appliesFromDaysBefore),
    Number.POSITIVE_INFINITY
  );
}

export type FeeInput = {
  policy: PolicyLike;
  /** Gesamtbetrag der Buchung als Dezimalzahl. */
  totalAmount: string;
  /** Preis der ersten Nacht, für die Basis FIRST_NIGHT. */
  firstNightAmount: string;
  /** Anreisedatum, YYYY-MM-DD. */
  checkIn: string;
  /** Tag der Stornierung in der Zeitzone des Hotels, YYYY-MM-DD. */
  cancelledOn: string;
  /** True, wenn der Gast nicht angereist ist. */
  noShow?: boolean;
};

export type FeeResult = {
  daysBeforeArrival: number;
  free: boolean;
  percent: number | null;
  basis: CancellationBasis | null;
  amount: string;
  reason: string;
};

const prozentBetrag = (betrag: string, prozent: number) =>
  fromCents(Math.round((toCents(betrag) * prozent) / 100));

export function calculateCancellationFee(input: FeeInput): FeeResult {
  const daysBeforeArrival = daysBetween(input.cancelledOn, input.checkIn);

  if (input.noShow) {
    const prozent = Number(input.policy.noShowFeePercent ?? "0");

    return {
      daysBeforeArrival,
      free: prozent === 0,
      percent: prozent,
      basis: "PERCENT_OF_TOTAL",
      amount: prozentBetrag(input.totalAmount, prozent),
      reason:
        prozent === 0
          ? "Für Nichtanreise ist keine Gebühr hinterlegt."
          : `Nichtanreise: ${prozent} % des Gesamtbetrags.`,
    };
  }

  const rule = applicableRule(input.policy.rules, daysBeforeArrival);

  if (!rule) {
    return {
      daysBeforeArrival,
      free: true,
      percent: 0,
      basis: null,
      amount: "0.00",
      reason: "Kostenlose Stornierung: Die Frist ist noch nicht abgelaufen.",
    };
  }

  if (rule.basis === "FIXED_AMOUNT") {
    const betrag = rule.feeAmount ?? "0.00";

    return {
      daysBeforeArrival,
      free: toCents(betrag) === 0,
      percent: null,
      basis: rule.basis,
      amount: betrag,
      reason: `Weniger als ${rule.appliesFromDaysBefore} Tage vor Anreise: fester Betrag.`,
    };
  }

  const prozent = Number(rule.feePercent ?? "0");
  const grundlage = rule.basis === "FIRST_NIGHT" ? input.firstNightAmount : input.totalAmount;
  const amount =
    rule.basis === "FIRST_NIGHT" && prozent === 0
      ? grundlage
      : prozentBetrag(grundlage, prozent);

  return {
    daysBeforeArrival,
    free: toCents(amount) === 0,
    percent: prozent,
    basis: rule.basis,
    amount,
    reason:
      rule.basis === "FIRST_NIGHT"
        ? `Weniger als ${rule.appliesFromDaysBefore} Tage vor Anreise: Preis der ersten Nacht.`
        : `Weniger als ${rule.appliesFromDaysBefore} Tage vor Anreise: ${prozent} % des Gesamtbetrags.`,
  };
}

const tage = (anzahl: number) => `${anzahl} ${anzahl === 1 ? "Tag" : "Tage"}`;

/**
 * Der Text für den Gast. Er entsteht ausschließlich aus den gepflegten
 * Werten - ändert der Betrieb die Frist, ändert sich der Text mit.
 */
export function describePolicy(policy: PolicyLike): string[] {
  const zeilen: string[] = [];
  const sortiert = [...policy.rules].sort(
    (a, b) => b.appliesFromDaysBefore - a.appliesFromDaysBefore
  );

  const frist = freeUntilDaysBefore(policy.rules);

  if (frist === null) {
    zeilen.push("Diese Buchung können Sie jederzeit kostenfrei stornieren.");
  } else {
    zeilen.push(`Kostenlose Stornierung bis ${tage(frist)} vor Anreise.`);
  }

  for (const rule of sortiert) {
    const ab = `Ab weniger als ${tage(rule.appliesFromDaysBefore)} vor Anreise`;

    if (rule.basis === "FIXED_AMOUNT") {
      zeilen.push(`${ab} berechnen wir ${formatMoney(rule.feeAmount ?? "0")}.`);
    } else if (rule.basis === "FIRST_NIGHT") {
      zeilen.push(`${ab} berechnen wir den Preis der ersten Nacht.`);
    } else {
      zeilen.push(`${ab} berechnen wir ${Number(rule.feePercent ?? "0")} % des Buchungsbetrags.`);
    }
  }

  const noShow = Number(policy.noShowFeePercent ?? "0");

  if (noShow > 0) {
    zeilen.push(`Bei Nichtanreise berechnen wir ${noShow} % des Buchungsbetrags.`);
  }

  return zeilen;
}

/**
 * Was bei einer Buchung eingefroren wird. Der Schnappschuss enthält alles,
 * was später für eine Stornoabrechnung gebraucht wird - eine spätere
 * Änderung der Hotelrichtlinie berührt bestehende Buchungen deshalb nicht.
 */
export type PolicySnapshot = PolicyLike & {
  version: 1;
  /** Zeitpunkt des Einfrierens, ISO-8601. */
  frozenAt: string;
  /** Letzter Tag, an dem kostenlos storniert werden kann, YYYY-MM-DD. */
  freeUntilDate: string | null;
  text: string[];
  /**
   * Nachweis der Zustimmung des Gastes. Fehlt er, ist nichts belegt - er
   * wird niemals nachtraeglich ergaenzt.
   */
  consent?: ConsentRecord;
};

/**
 * Der letzte Tag, an dem kostenlos storniert werden kann. Wer an diesem Tag
 * storniert, zahlt nichts. Null bedeutet: jederzeit kostenfrei.
 */
export function freeUntilDate(rules: RuleLike[], checkIn: string): string | null {
  const frist = freeUntilDaysBefore(rules);

  if (frist === null || !Number.isFinite(frist)) return null;

  return new Date(Date.parse(`${checkIn}T00:00:00Z`) - frist * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Der Tag nach Ablauf der Frist - der erste, an dem eine Gebuehr anfaellt. */
function firstChargeableDate(rules: RuleLike[], checkIn: string): string | null {
  const frei = freeUntilDate(rules, checkIn);

  if (!frei) return null;

  return new Date(Date.parse(`${frei}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

export type CancellationPreview = {
  /** Letzter kostenfreier Tag, YYYY-MM-DD, oder null. */
  freeUntilDate: string | null;
  /** Gebuehr bei einer Stornierung nach Ablauf der Frist. */
  feeAmount: string | null;
  feeReason: string | null;
  /** Gebuehr bei Nichtanreise. */
  noShowAmount: string | null;
};

/**
 * Was eine Stornierung diese Buchung kosten wuerde - serverseitig gerechnet,
 * aus der geltenden Regel und dem tatsaechlichen Preis.
 *
 * Die Regel selbst wird dabei nicht veraendert: Gerechnet wird mit
 * `calculateCancellationFee`, also genau so, wie spaeter abgerechnet wird.
 */
export function previewCancellation(input: {
  policy: PolicyLike;
  totalAmount: string;
  /** Preis der ersten Nacht. Null, wenn unbekannt. */
  firstNightAmount: string | null;
  checkIn: string;
}): CancellationPreview {
  const frei = freeUntilDate(input.policy.rules, input.checkIn);
  const faellig = firstChargeableDate(input.policy.rules, input.checkIn);

  // Ohne Regel gibt es keine Gebuehr - und ohne Preis der ersten Nacht
  // lassen wir das Feld leer, statt den Gesamtbetrag zu unterstellen.
  const gebuehr =
    faellig === null
      ? null
      : calculateCancellationFee({
          policy: input.policy,
          totalAmount: input.totalAmount,
          firstNightAmount: input.firstNightAmount ?? "0.00",
          checkIn: input.checkIn,
          cancelledOn: faellig,
        });

  const brauchtNacht = gebuehr?.basis === "FIRST_NIGHT" && input.firstNightAmount === null;

  const noShowProzent = Number(input.policy.noShowFeePercent ?? "0");

  return {
    freeUntilDate: frei,
    feeAmount: gebuehr && !brauchtNacht ? gebuehr.amount : null,
    feeReason: gebuehr && !brauchtNacht ? gebuehr.reason : null,
    noShowAmount:
      noShowProzent > 0 ? prozentBetrag(input.totalAmount, noShowProzent) : null,
  };
}

export function buildPolicySnapshot(
  policy: PolicyLike,
  context: { checkIn: string; frozenAt: string }
): PolicySnapshot {
  return {
    version: 1,
    code: policy.code,
    name: policy.name,
    description: policy.description,
    noShowFeePercent: policy.noShowFeePercent,
    rules: policy.rules.map((rule) => ({
      appliesFromDaysBefore: rule.appliesFromDaysBefore,
      basis: rule.basis,
      feePercent: rule.feePercent,
      feeAmount: rule.feeAmount,
    })),
    frozenAt: context.frozenAt,
    freeUntilDate: freeUntilDate(policy.rules, context.checkIn),
    text: describePolicy(policy),
  };
}

/** Liest einen gespeicherten Schnappschuss zurück, soweit er brauchbar ist. */
export function readPolicySnapshot(value: unknown): PolicySnapshot | null {
  if (!value || typeof value !== "object") return null;

  const snapshot = value as Partial<PolicySnapshot>;

  if (!Array.isArray(snapshot.rules) || typeof snapshot.name !== "string") {
    return null;
  }

  return snapshot as PolicySnapshot;
}
