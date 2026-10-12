import "server-only";

import { db } from "@/prisma/db";

import {
  type MailMessage,
  getTransport,
  missingSmtpSettings,
  redactSecrets,
} from "./transport";

// Zentraler Mailversand.
//
// Jede E-Mail der Anwendung laeuft durch sendMail: ein Weg, ein Protokoll,
// eine Fehlerbehandlung. Endpunkte bauen keinen eigenen Versand.
//
// Die wichtigste Eigenschaft dieser Datei: sendMail wirft NIE. Ein Ausfall
// des Mailservers darf eine gespeicherte Buchung oder Reservierung nicht
// gefaehrden. Scheitert der Versand, wird er als Fehlschlag protokolliert und
// kann im Admin erneut angestossen werden.

/** Fachliche Anlaesse. Sie landen unveraendert im Protokoll. */
export const MAIL_TYPES = {
  HOTEL_BOOKING_CONFIRMATION: "HOTEL_BOOKING_CONFIRMATION",
  RESTAURANT_RESERVATION_RECEIVED: "RESTAURANT_RESERVATION_RECEIVED",
  RESTAURANT_RESERVATION_CONFIRMED: "RESTAURANT_RESERVATION_CONFIRMED",
  RESTAURANT_RESERVATION_OPERATOR: "RESTAURANT_RESERVATION_OPERATOR",
} as const;

export type MailType = (typeof MAIL_TYPES)[keyof typeof MAIL_TYPES];

/** Anlass, auf den sich eine Mail bezieht. */
export const MAIL_SUBJECTS = {
  HOTEL_BOOKING: "HOTEL_BOOKING",
  RESTAURANT_RESERVATION: "RESTAURANT_RESERVATION",
} as const;

export type MailSubjectType = (typeof MAIL_SUBJECTS)[keyof typeof MAIL_SUBJECTS];

export const MAIL_STATUSES = ["SENT", "FAILED", "SKIPPED"] as const;

export type MailStatus = (typeof MAIL_STATUSES)[number];

export type SendMailInput = MailMessage & {
  type: MailType;
  subjectType?: MailSubjectType;
  subjectId?: number;
};

export type SendMailResult = {
  status: MailStatus;
  transport: string | null;
  messageId: string | null;
  error: string | null;
  attempt: number;
  logId: number | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function readable(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);

  // Zugangsdaten entfernen und kuerzen: Das Protokoll soll diagnostisch
  // nuetzlich sein, nicht ausfuehrlich.
  return redactSecrets(text).slice(0, 500);
}

/** Wievielter Versuch ist das fuer diesen Anlass und Mailtyp? */
async function nextAttempt(input: SendMailInput) {
  if (!input.subjectType || !input.subjectId) return 1;

  try {
    const result = await db.orm.public.EmailLog
      .where({
        type: input.type,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
      })
      .aggregate((a) => ({ n: a.count() }));

    return result.n + 1;
  } catch {
    return 1;
  }
}

async function writeLog(
  input: SendMailInput,
  result: Omit<SendMailResult, "logId">
): Promise<number | null> {
  try {
    const row = await db.orm.public.EmailLog.create({
      type: input.type,
      recipient: input.to,
      subject: input.subject,
      status: result.status,
      transport: result.transport,
      error: result.error,
      messageId: result.messageId,
      subjectType: input.subjectType ?? null,
      subjectId: input.subjectId ?? null,
      attempt: result.attempt,
    });

    return row.id;
  } catch (error) {
    // Selbst ein fehlgeschlagenes Protokoll darf den Aufrufer nicht stoeren.
    console.error("Mail log error:", readable(error));

    return null;
  }
}

/**
 * Verschickt eine E-Mail und protokolliert den Versuch. Wirft nie.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const attempt = await nextAttempt(input);

  const basis = {
    transport: null as string | null,
    messageId: null as string | null,
    error: null as string | null,
    attempt,
  };

  if (!EMAIL_PATTERN.test(input.to.trim())) {
    const result = {
      ...basis,
      status: "FAILED" as MailStatus,
      error: input.to.trim()
        ? "Die Empfängeradresse ist ungültig."
        : "Es ist keine Empfängeradresse hinterlegt.",
    };

    return { ...result, logId: await writeLog(input, result) };
  }

  const transport = getTransport();

  if (!transport) {
    const fehlend = missingSmtpSettings().join(", ");

    console.warn(`Mailversand nicht eingerichtet. Fehlende Variablen: ${fehlend || "-"}`);

    const result = {
      ...basis,
      status: "SKIPPED" as MailStatus,
      error: `Mailversand ist nicht eingerichtet (${fehlend || "SMTP"}).`,
    };

    return { ...result, logId: await writeLog(input, result) };
  }

  try {
    const { messageId } = await transport.send({
      to: input.to.trim(),
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo ?? null,
    });

    const result = {
      ...basis,
      status: "SENT" as MailStatus,
      transport: transport.name,
      messageId,
    };

    return { ...result, logId: await writeLog(input, result) };
  } catch (error) {
    const meldung = readable(error);

    console.error(`Mailversand fehlgeschlagen (${input.type}): ${meldung}`);

    const result = {
      ...basis,
      status: "FAILED" as MailStatus,
      transport: transport.name,
      error: meldung,
    };

    return { ...result, logId: await writeLog(input, result) };
  }
}

export type MailLogEntry = {
  id: number;
  type: string;
  recipient: string;
  subject: string;
  status: string;
  error: string | null;
  attempt: number;
  createdAt: string;
};

/** Der jeweils letzte Versandversuch zu einem Anlass, fuer die Anzeige im Admin. */
export async function latestMailStatus(
  subjectType: MailSubjectType,
  subjectIds: number[]
): Promise<Map<number, MailLogEntry>> {
  const treffer = new Map<number, MailLogEntry>();

  if (subjectIds.length === 0) return treffer;

  const rows = await db.orm.public.EmailLog
    .where({ subjectType })
    .where((log) => log.subjectId.in(subjectIds))
    .orderBy((log) => log.id.asc())
    .all();

  for (const row of rows) {
    if (row.subjectId === null) continue;

    // Aufsteigend sortiert: Der letzte Eintrag je Anlass gewinnt.
    treffer.set(row.subjectId, {
      id: row.id,
      type: row.type,
      recipient: row.recipient,
      subject: row.subject,
      status: row.status,
      error: row.error,
      attempt: row.attempt,
      createdAt: String(row.createdAt),
    });
  }

  return treffer;
}
