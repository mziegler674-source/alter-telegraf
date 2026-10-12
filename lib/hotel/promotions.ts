import { nightsBetween, toCents } from "./pricing";

// Rabattaktionen des Hotels.
//
// Dies ist die EINZIGE Stelle, an der entschieden wird, ob und wie viel
// Rabatt ein Aufenthalt bekommt. Auch die Langzeitrabatte laufen hierueber:
// Sie sind gewoehnliche Aktionen vom Typ BASIC mit einem Mindestaufenthalt
// und werden unter „Preise“ gepflegt. Es gibt bewusst keine zweite
// Rabattlogik daneben.
//
// Ohne Datenbankzugriff, damit dieselbe Logik in der Buchungsstrecke, in der
// Admin-Vorschau und im Test laeuft.

export const PROMOTION_TYPES = ["BASIC", "EARLY_BOOKER", "LAST_MINUTE"] as const;

export type PromotionType = (typeof PROMOTION_TYPES)[number];

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  BASIC: "Standard",
  EARLY_BOOKER: "Frühbucher",
  LAST_MINUTE: "Last Minute",
};

export const PROMOTION_CHANNELS = ["PUBLIC", "MOBILE"] as const;

export type PromotionChannel = (typeof PROMOTION_CHANNELS)[number];

export const PROMOTION_CHANNEL_LABELS: Record<PromotionChannel, string> = {
  PUBLIC: "Website",
  MOBILE: "Mobil",
};

/** Kennung der automatisch gepflegten Langzeitrabatte. */
export const LONG_STAY_PREFIX = "LONGSTAY_";

export function isLongStay(code: string) {
  return code.startsWith(LONG_STAY_PREFIX);
}

export type PromotionLike = {
  id: number;
  code: string;
  name: string;
  type: PromotionType;
  channel: PromotionChannel;
  active: boolean;
  /** Dezimalzahl als Text. 0, wenn ein Festbetrag gilt. */
  discountPercent: string;
  /** Dezimalzahl als Text oder null. Gilt einmal je Aufenthalt. */
  discountAmount: string | null;
  bookingFrom: string | null;
  bookingTo: string | null;
  /** Anreise ab / Anreise bis. */
  stayFrom: string | null;
  arrivalTo: string | null;
  /** Abreise ab / Abreise bis. */
  departureFrom: string | null;
  stayTo: string | null;
  minStayNights: number | null;
  maxStayNights: number | null;
  earlyBookerDays: number | null;
  lastMinuteDays: number | null;
  /**
   * Nur mit Aktionscode. Ohne dieses Kennzeichen wirkt die Aktion
   * automatisch für jeden passenden Aufenthalt.
   */
  requiresCode: boolean;
  /** Leer bedeutet: gilt für alle Zimmerarten. */
  roomTypeIds: number[];
  /** Leer bedeutet: gilt für alle Rate Plans. */
  ratePlanIds: number[];
};

export type StayContext = {
  /** YYYY-MM-DD */
  checkIn: string;
  checkOut: string;
  nights: number;
  /** Tag der Buchung in der Zeitzone des Hotels. */
  bookedOn: string;
  roomTypeId: number;
  ratePlanId: number;
  channel?: PromotionChannel;
};

export type PromotionVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Greift diese Aktion für den Aufenthalt? Die Begründung bei „nein“ ist für
 * die Vorschau im Admin gedacht, nicht für den Gast.
 */
export function checkPromotion(
  promotion: PromotionLike,
  context: StayContext
): PromotionVerdict {
  if (!promotion.active) {
    return { ok: false, reason: "Aktion ist nicht aktiv." };
  }

  const kanal = context.channel ?? "PUBLIC";

  if (promotion.channel !== kanal) {
    return { ok: false, reason: `Aktion gilt nur für den Kanal ${promotion.channel}.` };
  }

  if (promotion.bookingFrom && context.bookedOn < promotion.bookingFrom) {
    return { ok: false, reason: `Buchbar erst ab ${promotion.bookingFrom}.` };
  }

  if (promotion.bookingTo && context.bookedOn > promotion.bookingTo) {
    return { ok: false, reason: `Buchbar nur bis ${promotion.bookingTo}.` };
  }

  if (promotion.stayFrom && context.checkIn < promotion.stayFrom) {
    return { ok: false, reason: `Anreise erst ab ${promotion.stayFrom}.` };
  }

  if (promotion.arrivalTo && context.checkIn > promotion.arrivalTo) {
    return { ok: false, reason: `Anreise nur bis ${promotion.arrivalTo}.` };
  }

  if (promotion.departureFrom && context.checkOut < promotion.departureFrom) {
    return { ok: false, reason: `Abreise erst ab ${promotion.departureFrom}.` };
  }

  if (promotion.stayTo && context.checkOut > promotion.stayTo) {
    return { ok: false, reason: `Abreise nur bis ${promotion.stayTo}.` };
  }

  if (promotion.minStayNights !== null && context.nights < promotion.minStayNights) {
    return { ok: false, reason: `Mindestens ${promotion.minStayNights} Nächte nötig.` };
  }

  if (promotion.maxStayNights !== null && context.nights > promotion.maxStayNights) {
    return { ok: false, reason: `Höchstens ${promotion.maxStayNights} Nächte erlaubt.` };
  }

  // Vorlaufzeit zwischen Buchung und Anreise.
  const vorlauf = nightsBetween(context.bookedOn, context.checkIn);

  if (promotion.earlyBookerDays !== null && vorlauf < promotion.earlyBookerDays) {
    return {
      ok: false,
      reason: `Buchung muss mindestens ${promotion.earlyBookerDays} Tage vor Anreise erfolgen.`,
    };
  }

  if (promotion.lastMinuteDays !== null && vorlauf > promotion.lastMinuteDays) {
    return {
      ok: false,
      reason: `Nur innerhalb von ${promotion.lastMinuteDays} Tagen vor Anreise.`,
    };
  }

  if (promotion.roomTypeIds.length > 0 && !promotion.roomTypeIds.includes(context.roomTypeId)) {
    return { ok: false, reason: "Aktion gilt nicht für diese Zimmerart." };
  }

  if (promotion.ratePlanIds.length > 0 && !promotion.ratePlanIds.includes(context.ratePlanId)) {
    return { ok: false, reason: "Aktion gilt nicht für diesen Rate Plan." };
  }

  return { ok: true };
}

/**
 * Rabatt in Cent. Prozent wirkt auf den Zimmerpreis, der Festbetrag gilt
 * einmal je Aufenthalt. Mehr als den Zimmerpreis kann kein Rabatt ergeben.
 */
export function discountCentsFor(promotion: PromotionLike, roomsTotalCents: number): number {
  if (roomsTotalCents <= 0) return 0;

  const prozent = Number(promotion.discountPercent);

  const roh =
    prozent > 0
      ? Math.round((roomsTotalCents * prozent) / 100)
      : promotion.discountAmount
        ? toCents(promotion.discountAmount)
        : 0;

  return Math.max(0, Math.min(roh, roomsTotalCents));
}

export type ResolvedDiscount = {
  promotionId: number;
  code: string;
  name: string;
  /** Prozentsatz, oder 0 bei einem Festbetrag. */
  percent: number;
  cents: number;
  /** Kam die Aktion automatisch zum Zug oder über einen Code? */
  source: "AUTOMATIC" | "CODE";
};

/** Aktionscodes werden ohne Rücksicht auf Schreibweise verglichen. */
export function normalizeCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

export type CodeStatus =
  /** Kein Code eingegeben. */
  | "NONE"
  /** Der Code gilt und wird angewendet. */
  | "APPLIED"
  /** Diesen Code gibt es nicht. */
  | "UNKNOWN"
  /** Der Code existiert, passt aber nicht zu diesem Aufenthalt. */
  | "NOT_APPLICABLE"
  /** Der Code gilt, eine automatische Aktion ist aber günstiger. */
  | "OUTPERFORMED";

export type CodeResult = {
  code: string | null;
  status: CodeStatus;
  /** Verständlicher Satz für den Gast, oder null. */
  reason: string | null;
};

/**
 * Wählt die wirksame Aktion aus.
 *
 * REGEL: Es wirkt immer GENAU EINE Aktion, niemals mehrere zusammen. Von
 * allen zulässigen gewinnt die für den Gast günstigste, bei Gleichstand die
 * mit der kleineren ID. Rabatte addieren sich also nie unkontrolliert, und
 * dasselbe Ergebnis kommt bei gleicher Lage immer wieder heraus.
 */
export function resolveDiscount(
  promotions: PromotionLike[],
  context: StayContext,
  roomsTotalCents: number
): ResolvedDiscount | null {
  let beste: ResolvedDiscount | null = null;

  for (const promotion of promotions) {
    // Aktionen mit Codepflicht greifen nie von selbst.
    if (promotion.requiresCode) continue;

    if (!checkPromotion(promotion, context).ok) continue;

    const cents = discountCentsFor(promotion, roomsTotalCents);

    if (cents <= 0) continue;

    const kandidat: ResolvedDiscount = {
      promotionId: promotion.id,
      code: promotion.code,
      name: promotion.name,
      percent: Number(promotion.discountPercent),
      cents,
      source: "AUTOMATIC",
    };

    if (!beste || cents > beste.cents || (cents === beste.cents && promotion.id < beste.promotionId)) {
      beste = kandidat;
    }
  }

  return beste;
}

/**
 * Rabatt mit Aktionscode.
 *
 * REGEL, bewusst so gewählt und getestet:
 *
 *   1. Ohne Code gilt die beste automatische Aktion - unverändert wie bisher.
 *      Aktionen mit Codepflicht bleiben dabei außen vor.
 *   2. Ein eingegebener Code wird SERVERSEITIG gegen alle Bedingungen
 *      geprüft: aktiv, Buchungsfenster, Anreise- und Abreisefenster,
 *      Mindest- und Maximalaufenthalt, Vorlauf, Zimmerart, Rate Plan, Kanal
 *      und Rabattwert.
 *   3. Gilt der Code, wird er mit der besten automatischen Aktion
 *      verglichen. Es gewinnt die für den Gast GÜNSTIGERE; bei Gleichstand
 *      der Code.
 *   4. Verliert der Code gegen eine automatische Aktion, wird er nicht
 *      stillschweigend verworfen: Der Status lautet OUTPERFORMED und die
 *      Begründung nennt die Aktion, die stattdessen gilt. Die
 *      Preisübersicht zeigt das an.
 *
 * Es wirkt weiterhin immer GENAU EINE Aktion. Code und automatische Aktion
 * addieren sich nicht.
 */
export function resolveDiscountWithCode(
  promotions: PromotionLike[],
  context: StayContext,
  roomsTotalCents: number,
  rawCode?: string | null
): { discount: ResolvedDiscount | null; code: CodeResult } {
  const automatisch = resolveDiscount(promotions, context, roomsTotalCents);
  const code = normalizeCode(rawCode);

  if (!code) {
    return { discount: automatisch, code: { code: null, status: "NONE", reason: null } };
  }

  const treffer = promotions.find(
    (promotion) => normalizeCode(promotion.code) === code && !isLongStay(promotion.code)
  );

  if (!treffer) {
    return {
      discount: automatisch,
      code: {
        code,
        status: "UNKNOWN",
        reason: "Diesen Aktionscode kennen wir nicht. Bitte prüfen Sie die Schreibweise.",
      },
    };
  }

  const urteil = checkPromotion(treffer, context);

  if (!urteil.ok) {
    return {
      discount: automatisch,
      code: { code, status: "NOT_APPLICABLE", reason: urteil.reason },
    };
  }

  const cents = discountCentsFor(treffer, roomsTotalCents);

  if (cents <= 0) {
    return {
      discount: automatisch,
      code: {
        code,
        status: "NOT_APPLICABLE",
        reason: "Dieser Aktionscode ergibt für diesen Aufenthalt keinen Rabatt.",
      },
    };
  }

  const ausCode: ResolvedDiscount = {
    promotionId: treffer.id,
    code: treffer.code,
    name: treffer.name,
    percent: Number(treffer.discountPercent),
    cents,
    source: "CODE",
  };

  // Punkt 3 und 4 der Regel.
  if (automatisch && automatisch.cents > cents) {
    return {
      discount: automatisch,
      code: {
        code,
        status: "OUTPERFORMED",
        reason: `Ihr Code ist gültig. Die Aktion „${automatisch.name}“ ist für Sie jedoch günstiger und wurde angewendet.`,
      },
    };
  }

  return { discount: ausCode, code: { code, status: "APPLIED", reason: null } };
}

/** Alle Aktionen mit Urteil - Grundlage der Vorschau im Admin. */
export function evaluatePromotions(
  promotions: PromotionLike[],
  context: StayContext,
  roomsTotalCents: number,
  rawCode?: string | null
) {
  const { discount: gewinner } = resolveDiscountWithCode(
    promotions,
    context,
    roomsTotalCents,
    rawCode
  );

  const code = normalizeCode(rawCode);

  return promotions.map((promotion) => {
    const urteil = checkPromotion(promotion, context);
    const cents = urteil.ok ? discountCentsFor(promotion, roomsTotalCents) : 0;
    const codeFehlt = promotion.requiresCode && normalizeCode(promotion.code) !== code;

    return {
      promotionId: promotion.id,
      code: promotion.code,
      name: promotion.name,
      requiresCode: promotion.requiresCode,
      applies: urteil.ok && cents > 0 && !codeFehlt,
      wins: gewinner?.promotionId === promotion.id,
      discountCents: cents,
      reason: codeFehlt
        ? "Greift nur mit Aktionscode."
        : urteil.ok
          ? cents > 0
            ? null
            : "Aktion ergibt keinen Rabatt."
          : urteil.reason,
    };
  });
}

/** Bedingungen als Sätze, für Admin-Liste und Vorschau. */
export function describePromotion(promotion: PromotionLike): string[] {
  const zeilen: string[] = [];

  if (promotion.requiresCode) {
    zeilen.push(`Nur mit Aktionscode „${promotion.code}“`);
  }

  const prozent = Number(promotion.discountPercent);

  zeilen.push(
    prozent > 0
      ? `${prozent} % Rabatt auf den Zimmerpreis`
      : `${promotion.discountAmount ?? "0"} € Rabatt je Aufenthalt`
  );

  if (promotion.bookingFrom || promotion.bookingTo) {
    zeilen.push(
      `Buchbar ${promotion.bookingFrom ?? "jederzeit"} bis ${promotion.bookingTo ?? "offen"}`
    );
  }

  if (promotion.stayFrom || promotion.arrivalTo) {
    zeilen.push(`Anreise ${promotion.stayFrom ?? "offen"} bis ${promotion.arrivalTo ?? "offen"}`);
  }

  if (promotion.departureFrom || promotion.stayTo) {
    zeilen.push(`Abreise ${promotion.departureFrom ?? "offen"} bis ${promotion.stayTo ?? "offen"}`);
  }

  if (promotion.minStayNights !== null) {
    zeilen.push(`Mindestens ${promotion.minStayNights} Nächte`);
  }

  if (promotion.maxStayNights !== null) {
    zeilen.push(`Höchstens ${promotion.maxStayNights} Nächte`);
  }

  if (promotion.earlyBookerDays !== null) {
    zeilen.push(`Buchung mindestens ${promotion.earlyBookerDays} Tage vor Anreise`);
  }

  if (promotion.lastMinuteDays !== null) {
    zeilen.push(`Buchung höchstens ${promotion.lastMinuteDays} Tage vor Anreise`);
  }

  if (promotion.roomTypeIds.length > 0) {
    zeilen.push(`Nur für ${promotion.roomTypeIds.length} Zimmerart(en)`);
  }

  if (promotion.ratePlanIds.length > 0) {
    zeilen.push(`Nur für ${promotion.ratePlanIds.length} Rate Plan(s)`);
  }

  return zeilen;
}

export type PromotionProblem = string;

/**
 * Prüft eine Eingabe auf Widersprüche. Serverseitig verwendet, damit keine
 * Aktion entsteht, die nie oder unkontrolliert greifen kann.
 */
export function validatePromotion(input: {
  type: PromotionType;
  discountPercent: number;
  discountAmount: number | null;
  bookingFrom: string | null;
  bookingTo: string | null;
  stayFrom: string | null;
  arrivalTo: string | null;
  departureFrom: string | null;
  stayTo: string | null;
  minStayNights: number | null;
  maxStayNights: number | null;
  earlyBookerDays: number | null;
  lastMinuteDays: number | null;
}): PromotionProblem[] {
  const probleme: PromotionProblem[] = [];

  const hatProzent = input.discountPercent > 0;
  const hatBetrag = input.discountAmount !== null && input.discountAmount > 0;

  if (hatProzent && hatBetrag) {
    probleme.push("Bitte entweder einen Prozentsatz oder einen Festbetrag angeben, nicht beides.");
  }

  if (!hatProzent && !hatBetrag) {
    probleme.push("Ohne Rabattwert hätte die Aktion keine Wirkung.");
  }

  if (input.discountPercent < 0 || input.discountPercent > 100) {
    probleme.push("Der Prozentsatz muss zwischen 0 und 100 liegen.");
  }

  if (input.discountAmount !== null && input.discountAmount < 0) {
    probleme.push("Der Festbetrag darf nicht negativ sein.");
  }

  const reihenfolge: [string, string | null, string | null][] = [
    ["Das Buchungsfenster", input.bookingFrom, input.bookingTo],
    ["Das Anreisefenster", input.stayFrom, input.arrivalTo],
    ["Das Abreisefenster", input.departureFrom, input.stayTo],
  ];

  for (const [name, von, bis] of reihenfolge) {
    if (von && bis && von > bis) {
      probleme.push(`${name} endet vor seinem Beginn.`);
    }
  }

  if (input.stayFrom && input.stayTo && input.stayFrom > input.stayTo) {
    probleme.push("Die Anreise liegt nach dem spätesten Abreisetag.");
  }

  if (
    input.minStayNights !== null &&
    input.maxStayNights !== null &&
    input.minStayNights > input.maxStayNights
  ) {
    probleme.push("Der Mindestaufenthalt ist länger als der Maximalaufenthalt.");
  }

  for (const [name, wert] of [
    ["Mindestaufenthalt", input.minStayNights],
    ["Maximalaufenthalt", input.maxStayNights],
    ["Frühbucher-Vorlauf", input.earlyBookerDays],
    ["Last-Minute-Fenster", input.lastMinuteDays],
  ] as const) {
    if (wert !== null && wert < 1) {
      probleme.push(`${name} muss mindestens 1 betragen.`);
    }
  }

  if (
    input.earlyBookerDays !== null &&
    input.lastMinuteDays !== null &&
    input.earlyBookerDays > input.lastMinuteDays
  ) {
    probleme.push(
      "Vorlauf und Last-Minute-Fenster widersprechen sich: So kann die Aktion nie greifen."
    );
  }

  if (input.type === "EARLY_BOOKER" && input.earlyBookerDays === null) {
    probleme.push("Eine Frühbucher-Aktion braucht einen Vorlauf in Tagen.");
  }

  if (input.type === "LAST_MINUTE" && input.lastMinuteDays === null) {
    probleme.push("Eine Last-Minute-Aktion braucht ein Fenster in Tagen.");
  }

  return probleme;
}
