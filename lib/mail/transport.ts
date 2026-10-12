import "server-only";

import nodemailer from "nodemailer";

// Versandweg der E-Mails.
//
// Die Anwendung kennt nur die Schnittstelle MailTransport. Darunter liegt
// heute SMTP (World4You); ein anderer Weg waere austauschbar, ohne dass eine
// Vorlage oder ein Endpunkt sich aendert.
//
// Zugangsdaten stehen ausschliesslich in Umgebungsvariablen und werden
// niemals protokolliert.

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Antwortadresse, etwa die des Gastes bei einer Betreibermail. */
  replyTo?: string | null;
};

export type MailTransport = {
  name: string;
  send(message: MailMessage): Promise<{ messageId: string | null }>;
};

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  replyTo: string | null;
};

function readPort(raw: string | undefined) {
  const port = Number(raw);

  return Number.isInteger(port) && port > 0 && port < 65_536 ? port : null;
}

/**
 * Liest die SMTP-Einstellungen aus der Umgebung. Fehlt ein Pflichtwert, gibt
 * es keinen halben Versand: dann ist der Mailweg einfach nicht eingerichtet.
 */
export function smtpSettings(): SmtpSettings | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim();
  const port = readPort(process.env.SMTP_PORT) ?? 587;

  if (!host || !user || !password || !from) return null;

  // Port 465 ist implizit verschluesselt (SMTPS), 587 verschluesselt nach
  // STARTTLS. Der Schalter laesst sich bei Bedarf uebersteuern.
  const secureFlag = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureFlag ? secureFlag === "true" : port === 465;

  return {
    host,
    port,
    secure,
    user,
    password,
    from,
    replyTo: process.env.SMTP_REPLY_TO?.trim() || null,
  };
}

/** Welche Pflichtwerte fehlen? Nur Namen, niemals Werte. */
export function missingSmtpSettings(): string[] {
  const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"];

  return required.filter((name) => !process.env[name]?.trim());
}

type Transporter = ReturnType<typeof nodemailer.createTransport>;

let cached: { key: string; transporter: Transporter } | null = null;

function transporterFor(settings: SmtpSettings): Transporter {
  // Der Schluessel enthaelt bewusst kein Passwort.
  const key = `${settings.host}:${settings.port}:${settings.secure}:${settings.user}`;

  if (cached?.key === key) return cached.transporter;

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: { user: settings.user, pass: settings.password },
    // Ohne implizites TLS muss STARTTLS zustande kommen. Sonst wuerden
    // Zugangsdaten im Klartext ueber die Leitung gehen.
    requireTLS: !settings.secure,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 25_000,
  });

  cached = { key, transporter };

  return transporter;
}

function smtpTransport(settings: SmtpSettings): MailTransport {
  return {
    name: "smtp",
    async send(message) {
      const info = await transporterFor(settings).sendMail({
        from: settings.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo ?? settings.replyTo ?? undefined,
      });

      return { messageId: typeof info?.messageId === "string" ? info.messageId : null };
    },
  };
}

// ---------------------------------------------------------------------------
// Mock-Transport
//
// Nur fuer automatisierte Tests und die lokale Entwicklung: Er verschickt
// nichts, sondern merkt sich die Nachrichten. Aktiv ist er ausschliesslich
// bei MAIL_TRANSPORT=mock.
// ---------------------------------------------------------------------------

const outbox: MailMessage[] = [];
let mockShouldFail = false;

export function mockOutbox(): readonly MailMessage[] {
  return outbox;
}

export function clearMockOutbox() {
  outbox.length = 0;
}

/** Laesst den Mock-Transport scheitern, um Ausfaelle zu pruefen. */
export function configureMockTransport(options: { fail: boolean }) {
  mockShouldFail = options.fail;
}

function mockTransport(): MailTransport {
  return {
    name: "mock",
    async send(message) {
      if (mockShouldFail) {
        throw new Error("Mock-Transport: Versand absichtlich fehlgeschlagen.");
      }

      outbox.push(message);

      return { messageId: `mock-${outbox.length}` };
    },
  };
}

/** Ist ein Versandweg eingerichtet? */
export function mailConfigured(): boolean {
  return getTransport() !== null;
}

/**
 * Der aktive Versandweg, oder null, wenn keiner eingerichtet ist. In dem Fall
 * wird nicht geraten und nichts verschickt - die Buchung bleibt davon
 * unberuehrt und der Versuch wird protokolliert.
 */
export function getTransport(): MailTransport | null {
  if (process.env.MAIL_TRANSPORT?.trim().toLowerCase() === "mock") {
    return mockTransport();
  }

  const settings = smtpSettings();

  return settings ? smtpTransport(settings) : null;
}

/**
 * Entfernt Zugangsdaten aus einer Meldung des Mailservers, bevor sie
 * protokolliert wird.
 */
export function redactSecrets(text: string): string {
  const settings = smtpSettings();

  if (!settings) return text;

  const geheim = [
    settings.password,
    Buffer.from(`${settings.user}:${settings.password}`).toString("base64"),
    Buffer.from(settings.password).toString("base64"),
  ].filter((value) => value.length >= 4);

  return geheim.reduce(
    (cleaned, value) => cleaned.split(value).join("[entfernt]"),
    text
  );
}
