import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Temporal } from "temporal-polyfill";

import { verifySession } from "@/lib/auth";
import { SLUG_PATTERN } from "@/lib/hotel/constants";
import { db } from "@/prisma/db";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export type Body = Record<string, unknown>;

export async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    throw new HttpError(401, "Nicht angemeldet.");
  }

  const user = await db.orm.public.User.first({ id: session.userId });

  if (!user) {
    throw new HttpError(401, "Benutzer nicht gefunden.");
  }

  return user;
}

// Das System verwaltet aktuell genau ein Haus.
export function getHotel() {
  return db.orm.hotel.Hotel.orderBy((h) => h.id.asc()).first();
}

export type HotelRow = NonNullable<Awaited<ReturnType<typeof getHotel>>>;

export async function requireHotel() {
  const hotel = await getHotel();

  if (!hotel) {
    throw new HttpError(
      409,
      "Bitte zuerst die Hotel-Stammdaten unter „Hotel“ speichern."
    );
  }

  return hotel;
}

export async function readBody(request: Request): Promise<Body> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Ungültige Anfrage.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Ungültige Anfrage.");
  }

  return body as Body;
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; current && depth < 5; depth++) {
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };

    if (candidate.code === "23505") {
      return true;
    }

    if (
      typeof candidate.message === "string" &&
      /duplicate key|unique constraint/i.test(candidate.message)
    ) {
      return true;
    }

    current = candidate.cause;
  }

  return false;
}

export async function handle(
  label: string,
  fn: () => Promise<Response>
): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "Ein Eintrag mit diesem Wert existiert bereits." },
        { status: 409 }
      );
    }

    console.error(`${label} error:`, error);

    return NextResponse.json(
      { error: "Die Aktion konnte nicht ausgeführt werden." },
      { status: 500 }
    );
  }
}

export function readId(body: Body, key = "id") {
  const id = Number(body[key]);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, "Ungültige ID.");
  }

  return id;
}

type TextOptions = { required?: boolean; max?: number };

export function readText(
  body: Body,
  key: string,
  label: string,
  { required = false, max = 200 }: TextOptions = {}
): string | null {
  const raw = body[key];
  const value = typeof raw === "string" ? raw.trim() : "";

  if (!value) {
    if (required) {
      throw new HttpError(400, `${label} ist erforderlich.`);
    }

    return null;
  }

  if (value.length > max) {
    throw new HttpError(400, `${label} darf höchstens ${max} Zeichen haben.`);
  }

  return value;
}

export function readRequiredText(
  body: Body,
  key: string,
  label: string,
  max?: number
): string {
  return readText(body, key, label, { required: true, max }) as string;
}

type IntOptions = { required?: boolean; min?: number; max?: number };

export function readInt(
  body: Body,
  key: string,
  label: string,
  { required = false, min, max }: IntOptions = {}
): number | null {
  const raw = body[key];

  if (raw === undefined || raw === null || raw === "") {
    if (required) {
      throw new HttpError(400, `${label} ist erforderlich.`);
    }

    return null;
  }

  const value = Number(raw);

  if (!Number.isInteger(value)) {
    throw new HttpError(400, `${label} muss eine ganze Zahl sein.`);
  }

  if (min !== undefined && value < min) {
    throw new HttpError(400, `${label} muss mindestens ${min} sein.`);
  }

  if (max !== undefined && value > max) {
    throw new HttpError(400, `${label} darf höchstens ${max} sein.`);
  }

  return value;
}

export function readRequiredInt(
  body: Body,
  key: string,
  label: string,
  options: Omit<IntOptions, "required"> = {}
): number {
  return readInt(body, key, label, { ...options, required: true }) as number;
}

export function readBool(body: Body, key: string) {
  return body[key] === true;
}

export function readEnum<T extends string>(
  body: Body,
  key: string,
  label: string,
  values: readonly T[]
): T {
  const raw = body[key];

  if (typeof raw !== "string" || !values.includes(raw as T)) {
    throw new HttpError(400, `${label} ist ungültig.`);
  }

  return raw as T;
}

export function readSlug(body: Body, key: string, label: string) {
  const value = readRequiredText(body, key, label, 80);

  if (!SLUG_PATTERN.test(value)) {
    throw new HttpError(
      400,
      `${label} darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten.`
    );
  }

  return value;
}

export function readCode(body: Body, key: string, label: string) {
  const value = readRequiredText(body, key, label, 30).toUpperCase();

  if (!/^[A-Z0-9_-]+$/.test(value)) {
    throw new HttpError(
      400,
      `${label} darf nur Buchstaben, Ziffern, _ und - enthalten.`
    );
  }

  return value;
}

export function readTime(body: Body, key: string, label: string) {
  const value = readText(body, key, label, { max: 8 });

  if (!value) {
    return null;
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) {
    throw new HttpError(400, `${label} muss im Format HH:MM angegeben werden.`);
  }

  return Temporal.PlainTime.from(value);
}

export function nowInstant() {
  return Temporal.Now.instant();
}
