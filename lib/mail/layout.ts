import { MAIL_COLORS } from "./branding";

// Gemeinsames Grundgeruest aller E-Mails.
//
// Die Vorlagen beschreiben nur ihren INHALT als Daten; HTML und Plain-Text
// entstehen hier. Damit sehen alle Mails gleich aus, jede hat zwingend eine
// Textfassung, und Gasteingaben werden an genau einer Stelle maskiert.
//
// Umgesetzt mit Tabellen und Inline-Styles: Nur das stellen alle gaengigen
// Mailprogramme zuverlaessig dar. Eine Spalte mit hoechstens 620 Pixeln
// Breite ist auf dem Telefon ebenso lesbar wie am Schreibtisch.

export type RenderedMail = {
  subject: string;
  html: string;
  text: string;
};

export type MailRow = {
  label: string;
  value: string;
  /** Hebt den Wert hervor, etwa den Gesamtbetrag. */
  strong?: boolean;
};

export type MailSection = {
  title: string;
  rows?: MailRow[];
  paragraphs?: string[];
  bullets?: string[];
};

export type MailDocument = {
  subject: string;
  /** Erste Zeile in der Vorschau des Mailprogramms. */
  preheader: string;
  eyebrow: string;
  heading: string;
  lead?: string[];
  sections?: MailSection[];
  /** Hervorgehobene Hinweise, etwa zur Zahlung. */
  notes?: string[];
  closing?: string[];
  footer?: {
    title?: string;
    lines?: string[];
    phone?: string;
    email?: string;
    note?: string;
  };
};

/** HTML-Sonderzeichen maskieren, damit Eingaben nie als Markup wirken. */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Aus "+43 316 686558" wird "+43316686558" fuer den tel:-Link. */
function telHref(phone: string) {
  return phone.replace(/[^+0-9]/g, "");
}

/** Datum im Format YYYY-MM-DD als "Freitag, 24. Oktober 2026". */
export function formatDateLong(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) return isoDate;

  return new Intl.DateTimeFormat("de-AT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

const CELL_LABEL = `font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:${MAIL_COLORS.muted};padding:10px 12px 10px 0;vertical-align:top;`;

function renderRows(rows: MailRow[]) {
  const cells = rows
    .map((row) => {
      const value = `font-family:Arial,Helvetica,sans-serif;font-size:${
        row.strong ? "18px;font-weight:bold" : "15px"
      };color:${MAIL_COLORS.ink};padding:10px 0;vertical-align:top;`;

      return `<tr>
                <td style="${CELL_LABEL}">${escapeHtml(row.label)}</td>
                <td style="${value}">${escapeHtml(row.value)}</td>
              </tr>`;
    })
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">${cells}</table>`;
}

function renderSection(section: MailSection) {
  const parts: string[] = [
    `<tr><td style="padding:26px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:${MAIL_COLORS.green};border-top:1px solid ${MAIL_COLORS.line};">${escapeHtml(
      section.title
    )}</td></tr>`,
  ];

  for (const paragraph of section.paragraphs ?? []) {
    parts.push(
      `<tr><td style="padding:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${MAIL_COLORS.ink};">${escapeHtml(
        paragraph
      )}</td></tr>`
    );
  }

  if (section.bullets?.length) {
    const items = section.bullets
      .map((bullet) => `<li style="margin:0 0 6px;">${escapeHtml(bullet)}</li>`)
      .join("");

    parts.push(
      `<tr><td style="padding:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${MAIL_COLORS.ink};"><ul style="margin:0;padding-left:20px;">${items}</ul></td></tr>`
    );
  }

  if (section.rows?.length) {
    parts.push(`<tr><td style="padding:6px 0 0;">${renderRows(section.rows)}</td></tr>`);
  }

  return parts.join("");
}

function renderNote(note: string) {
  return `<tr><td style="padding:18px 0 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:${MAIL_COLORS.sand};border-radius:12px;">
              <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${MAIL_COLORS.ink};">${escapeHtml(
                note
              )}</td></tr>
            </table>
          </td></tr>`;
}

export function renderMail(doc: MailDocument): RenderedMail {
  const body: string[] = [];

  for (const paragraph of doc.lead ?? []) {
    body.push(
      `<tr><td style="padding:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${MAIL_COLORS.ink};">${escapeHtml(
        paragraph
      )}</td></tr>`
    );
  }

  for (const section of doc.sections ?? []) {
    body.push(renderSection(section));
  }

  for (const note of doc.notes ?? []) {
    body.push(renderNote(note));
  }

  for (const paragraph of doc.closing ?? []) {
    body.push(
      `<tr><td style="padding:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${MAIL_COLORS.ink};">${escapeHtml(
        paragraph
      )}</td></tr>`
    );
  }

  const footer = doc.footer;
  const footerParts: string[] = [];

  if (footer) {
    if (footer.title) {
      footerParts.push(
        `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:${MAIL_COLORS.ink};">${escapeHtml(
          footer.title
        )}</div>`
      );
    }

    for (const line of footer.lines ?? []) {
      footerParts.push(
        `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${MAIL_COLORS.muted};">${escapeHtml(
          line
        )}</div>`
      );
    }

    if (footer.phone) {
      footerParts.push(
        `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><a href="tel:${escapeHtml(
          telHref(footer.phone)
        )}" style="color:${MAIL_COLORS.green};text-decoration:underline;">${escapeHtml(
          footer.phone
        )}</a></div>`
      );
    }

    if (footer.email) {
      footerParts.push(
        `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><a href="mailto:${escapeHtml(
          footer.email
        )}" style="color:${MAIL_COLORS.green};text-decoration:underline;">${escapeHtml(
          footer.email
        )}</a></div>`
      );
    }

    if (footer.note) {
      footerParts.push(
        `<div style="margin-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${MAIL_COLORS.muted};">${escapeHtml(
          footer.note
        )}</div>`
      );
    }
  }

  const html = `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(doc.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:${MAIL_COLORS.sand};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(doc.preheader)}</div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:${MAIL_COLORS.sand};">
      <tr>
        <td align="center" style="padding:24px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="width:100%;max-width:620px;border-collapse:collapse;">

            <tr>
              <td style="background:${MAIL_COLORS.green};border-radius:16px 16px 0 0;padding:28px 28px 26px;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;color:${MAIL_COLORS.gold};">${escapeHtml(
                  doc.eyebrow
                )}</div>
                <div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.25;font-weight:bold;color:#ffffff;">${escapeHtml(
                  doc.heading
                )}</div>
              </td>
            </tr>

            <tr>
              <td style="background:#ffffff;padding:28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
                  ${body.join("\n                  ")}
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:#ffffff;border-radius:0 0 16px 16px;border-top:1px solid ${MAIL_COLORS.line};padding:24px 28px 28px;">
                ${footerParts.join("\n                ")}
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject: doc.subject, html, text: renderText(doc) };
}

/** Textfassung derselben Inhalte. Sie entsteht aus denselben Daten. */
function renderText(doc: MailDocument): string {
  const lines: string[] = [doc.eyebrow.toUpperCase(), "", doc.heading, ""];

  for (const paragraph of doc.lead ?? []) {
    lines.push(paragraph, "");
  }

  for (const section of doc.sections ?? []) {
    lines.push(section.title.toUpperCase());

    for (const paragraph of section.paragraphs ?? []) {
      lines.push(paragraph);
    }

    for (const bullet of section.bullets ?? []) {
      lines.push(`- ${bullet}`);
    }

    for (const row of section.rows ?? []) {
      lines.push(`${row.label}: ${row.value}`);
    }

    lines.push("");
  }

  for (const note of doc.notes ?? []) {
    lines.push(note, "");
  }

  for (const paragraph of doc.closing ?? []) {
    lines.push(paragraph, "");
  }

  const footer = doc.footer;

  if (footer) {
    lines.push("--");

    if (footer.title) lines.push(footer.title);

    for (const line of footer.lines ?? []) {
      lines.push(line);
    }

    if (footer.phone) lines.push(`Telefon: ${footer.phone}`);
    if (footer.email) lines.push(`E-Mail: ${footer.email}`);
    if (footer.note) lines.push("", footer.note);
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}
