import "server-only";

import { NextResponse } from "next/server";

import {
  type Body,
  HttpError,
  getHotel,
  handle,
  readBody,
  readBool,
  readCode,
  readEnum,
  readId,
  readInt,
  readRequiredText,
  readText,
  requireHotelAdmin,
  requireHotel,
} from "@/lib/hotel/admin-api";
import {
  CANCELLATION_BASES,
  type CancellationBasis,
  describePolicy,
} from "@/lib/hotel/cancellation";
import { paymentConfigured } from "@/lib/hotel/payment";
import { db } from "@/prisma/db";

import type { Numeric } from "@prisma/orm-postgres/target/codec-types";

const percent = (value: string | null) => value as unknown as Numeric<5, 2> | null;
const money = (value: string | null) => value as unknown as Numeric<10, 2> | null;

// Prozentangaben kommen als Text aus dem Formular. Leer bedeutet "nicht
// gesetzt", nicht "null Prozent".
function readPercent(body: Body, key: string, label: string) {
  const raw = body[key];

  if (raw === null || raw === undefined || String(raw).trim() === "") return null;

  const value = Number(String(raw).replace(",", "."));

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new HttpError(400, `${label} muss zwischen 0 und 100 liegen.`);
  }

  return value.toFixed(2);
}

function readAmount(body: Body, key: string, label: string) {
  const raw = body[key];

  if (raw === null || raw === undefined || String(raw).trim() === "") return null;

  const value = Number(String(raw).replace(",", "."));

  if (!Number.isFinite(value) || value < 0) {
    throw new HttpError(400, `${label} muss eine Zahl ab 0 sein.`);
  }

  return value.toFixed(2);
}

async function loadPolicies(hotelId: number) {
  const policies = await db.orm.hotel.CancellationPolicy
    .where({ hotelId })
    .select("id", "code", "name", "description", "active", "noShowFeePercent")
    .orderBy((p) => p.name.asc())
    .include("rules", (r) =>
      r.select("id", "appliesFromDaysBefore", "basis", "feePercent", "feeAmount")
    )
    .all();

  return policies.map((policy) => {
    const rules = policy.rules
      .map((rule) => ({
        id: rule.id,
        appliesFromDaysBefore: rule.appliesFromDaysBefore,
        basis: rule.basis as CancellationBasis,
        feePercent: rule.feePercent === null ? null : String(rule.feePercent),
        feeAmount: rule.feeAmount === null ? null : String(rule.feeAmount),
      }))
      .sort((a, b) => a.appliesFromDaysBefore - b.appliesFromDaysBefore);

    const noShowFeePercent =
      policy.noShowFeePercent === null ? null : String(policy.noShowFeePercent);

    return {
      id: policy.id,
      code: policy.code,
      name: policy.name,
      description: policy.description,
      active: policy.active,
      noShowFeePercent,
      rules,
      // Derselbe Text, den der Gast zu sehen bekommt.
      preview: describePolicy({
        code: policy.code,
        name: policy.name,
        description: policy.description,
        noShowFeePercent,
        rules,
      }),
    };
  });
}

export async function GET() {
  return handle("Cancellation GET", async () => {
    await requireHotelAdmin();

    const hotel = await getHotel();

    if (!hotel) {
      return NextResponse.json({ hotelReady: false, policies: [], ratePlans: [] });
    }

    const [policies, ratePlans] = await Promise.all([
      loadPolicies(hotel.id),
      db.orm.hotel.RatePlan
        .where({ hotelId: hotel.id })
        .select("id", "code", "name", "cancellationPolicyId", "active", "cardGuaranteeRequired")
        .orderBy((p) => p.sortOrder.asc())
        .all(),
    ]);

    return NextResponse.json({
      hotelReady: true,
      policies,
      ratePlans,
      // Ob überhaupt ein Zahlungsanbieter eingerichtet ist.
      paymentConfigured: paymentConfigured(),
    });
  });
}

export async function POST(request: Request) {
  return handle("Cancellation POST", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);

    if (body.action === "addRule") {
      const policyId = readId(body, "policyId");

      if (!(await db.orm.hotel.CancellationPolicy.first({ id: policyId, hotelId: hotel.id }))) {
        throw new HttpError(404, "Richtlinie nicht gefunden.");
      }

      const appliesFromDaysBefore = readInt(body, "appliesFromDaysBefore", "Frist", {
        min: 1,
        max: 365,
      });

      if (appliesFromDaysBefore === null) {
        throw new HttpError(400, "Bitte eine Frist in Tagen angeben.");
      }

      const vorhanden = await db.orm.hotel.CancellationRule.first({
        policyId,
        appliesFromDaysBefore,
      });

      if (vorhanden) {
        throw new HttpError(409, `Für ${appliesFromDaysBefore} Tage gibt es bereits eine Regel.`);
      }

      await db.orm.hotel.CancellationRule.create({
        policyId,
        appliesFromDaysBefore,
        basis: readEnum(body, "basis", "Grundlage", CANCELLATION_BASES) ?? "PERCENT_OF_TOTAL",
        feePercent: percent(readPercent(body, "feePercent", "Gebühr")),
        feeAmount: money(readAmount(body, "feeAmount", "Betrag")),
      });

      return NextResponse.json({ success: true }, { status: 201 });
    }

    const code = readCode(body, "code", "Code");

    if (await db.orm.hotel.CancellationPolicy.first({ hotelId: hotel.id, code })) {
      throw new HttpError(409, `Der Code „${code}“ wird bereits verwendet.`);
    }

    const policy = await db.orm.hotel.CancellationPolicy.create({
      hotelId: hotel.id,
      code,
      name: readRequiredText(body, "name", "Name", 120),
      description: readText(body, "description", "Beschreibung", { max: 500 }),
      active: readBool(body, "active"),
      noShowFeePercent: percent(readPercent(body, "noShowFeePercent", "No-Show-Gebühr")),
    });

    return NextResponse.json({ policy }, { status: 201 });
  });
}

export async function PATCH(request: Request) {
  return handle("Cancellation PATCH", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);

    // Kartengarantie je Rate Plan ein- oder ausschalten.
    if (body.action === "cardGuarantee") {
      const ratePlanId = readId(body, "ratePlanId");

      if (!(await db.orm.hotel.RatePlan.first({ id: ratePlanId, hotelId: hotel.id }))) {
        throw new HttpError(404, "Rate Plan nicht gefunden.");
      }

      await db.orm.hotel.RatePlan.where({ id: ratePlanId }).update({
        cardGuaranteeRequired: readBool(body, "cardGuaranteeRequired"),
      });

      return NextResponse.json({ success: true });
    }

    // Richtlinie einem Rate Plan zuordnen oder die Zuordnung lösen.
    if (body.action === "assign") {
      const ratePlanId = readId(body, "ratePlanId");

      if (!(await db.orm.hotel.RatePlan.first({ id: ratePlanId, hotelId: hotel.id }))) {
        throw new HttpError(404, "Rate Plan nicht gefunden.");
      }

      const policyId = body.policyId === null ? null : readId(body, "policyId");

      if (policyId !== null) {
        if (!(await db.orm.hotel.CancellationPolicy.first({ id: policyId, hotelId: hotel.id }))) {
          throw new HttpError(404, "Richtlinie nicht gefunden.");
        }
      }

      await db.orm.hotel.RatePlan.where({ id: ratePlanId }).update({
        cancellationPolicyId: policyId,
      });

      return NextResponse.json({ success: true });
    }

    if (body.action === "updateRule") {
      const ruleId = readId(body, "ruleId");

      const rule = await db.orm.hotel.CancellationRule
        .where({ id: ruleId })
        .include("policy", (p) => p.select("hotelId"))
        .first();

      if (!rule || rule.policy.hotelId !== hotel.id) {
        throw new HttpError(404, "Regel nicht gefunden.");
      }

      const appliesFromDaysBefore = readInt(body, "appliesFromDaysBefore", "Frist", {
        min: 1,
        max: 365,
      });

      await db.orm.hotel.CancellationRule.where({ id: ruleId }).update({
        ...(appliesFromDaysBefore === null ? {} : { appliesFromDaysBefore }),
        basis: readEnum(body, "basis", "Grundlage", CANCELLATION_BASES) ?? rule.basis,
        feePercent: percent(readPercent(body, "feePercent", "Gebühr")),
        feeAmount: money(readAmount(body, "feeAmount", "Betrag")),
      });

      return NextResponse.json({ success: true });
    }

    const id = readId(body);

    if (!(await db.orm.hotel.CancellationPolicy.first({ id, hotelId: hotel.id }))) {
      throw new HttpError(404, "Richtlinie nicht gefunden.");
    }

    await db.orm.hotel.CancellationPolicy.where({ id }).update({
      name: readRequiredText(body, "name", "Name", 120),
      description: readText(body, "description", "Beschreibung", { max: 500 }),
      active: readBool(body, "active"),
      noShowFeePercent: percent(readPercent(body, "noShowFeePercent", "No-Show-Gebühr")),
    });

    return NextResponse.json({ success: true });
  });
}

export async function DELETE(request: Request) {
  return handle("Cancellation DELETE", async () => {
    await requireHotelAdmin();
    const hotel = await requireHotel();

    const body = await readBody(request);

    if (body.action === "deleteRule") {
      const ruleId = readId(body, "ruleId");

      const rule = await db.orm.hotel.CancellationRule
        .where({ id: ruleId })
        .include("policy", (p) => p.select("hotelId"))
        .first();

      if (!rule || rule.policy.hotelId !== hotel.id) {
        throw new HttpError(404, "Regel nicht gefunden.");
      }

      await db.orm.hotel.CancellationRule.where({ id: ruleId }).delete();

      return NextResponse.json({ success: true });
    }

    const id = readId(body);

    const policy = await db.orm.hotel.CancellationPolicy
      .where({ id, hotelId: hotel.id })
      .include("ratePlans", (p) => p.count())
      .first();

    if (!policy) {
      throw new HttpError(404, "Richtlinie nicht gefunden.");
    }

    if (Number(policy.ratePlans) > 0) {
      throw new HttpError(
        409,
        "Die Richtlinie ist noch einem Rate Plan zugeordnet. Bitte zuerst die Zuordnung lösen."
      );
    }

    // Bereits bestehende Buchungen tragen ihren eigenen Schnappschuss und
    // bleiben davon unberührt.
    await db.orm.hotel.CancellationPolicy.where({ id }).delete();

    return NextResponse.json({ success: true });
  });
}
