// Missbrauchsschutz fuer oeffentliche Endpunkte.
//
// Bewusst ohne neue Infrastruktur: Es gibt in diesem Projekt kein Redis und
// keinen Zaehlerspeicher. Gezaehlt wird im Arbeitsspeicher des Prozesses,
// in festen Zeitfenstern.
//
// Was das leistet und was nicht - das gehoert zur Bewertung dazu:
//
//   + Es bremst den naheliegenden Fall: eine Schleife aus einem Browser
//     oder einem Skript gegen eine Instanz.
//   - Es ist KEIN globales Limit. Laeuft die Anwendung auf mehreren
//     Instanzen (auf Vercel der Normalfall), zaehlt jede fuer sich. Ein
//     Angreifer mit vielen Adressen wird damit nicht aufgehalten.
//   - Ein Neustart setzt die Zaehler zurueck.
//
// Datenschutz: Gespeichert wird nie eine IP-Adresse oder eine E-Mail,
// sondern nur ein gekuerzter Streuwert mit einem Geheimnis der Anwendung.
// Daraus laesst sich der Ursprung nicht zurueckrechnen, und ein Abgleich
// gegen eine Adressliste scheitert ohne das Geheimnis. Eintraege verfallen.

import { createHmac } from "node:crypto";

export type RateLimitRule = {
  /** Erlaubte Versuche innerhalb des Fensters. */
  limit: number;
  /** Laenge des Fensters in Sekunden. */
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  /** Verbleibende Versuche im laufenden Fenster. */
  remaining: number;
  /** Sekunden bis zum Ende des Fensters. */
  retryAfterSeconds: number;
};

type Eintrag = { count: number; resetAt: number };

// Ein Speicher je Namensraum, damit sich die Zaehler verschiedener
// Endpunkte nicht in die Quere kommen.
const speicher = new Map<string, Map<string, Eintrag>>();

/** Abgelaufene Eintraege entfernen, damit die Map nicht unbegrenzt waechst. */
function aufraeumen(buckets: Map<string, Eintrag>, jetzt: number) {
  for (const [schluessel, eintrag] of buckets) {
    if (eintrag.resetAt <= jetzt) buckets.delete(schluessel);
  }
}

/**
 * Gekuerzter Streuwert eines Merkmals. Ohne `AUTH_SECRET` wird ein
 * Prozessgeheimnis verwendet - dann sind die Werte nur innerhalb dieses
 * Prozesses vergleichbar, was fuer die Zaehlung genuegt.
 */
const prozessgeheimnis = `fallback-${Math.random()}`;

export function hashIdentifier(value: string): string {
  const geheimnis = process.env.AUTH_SECRET || prozessgeheimnis;

  return createHmac("sha256", geheimnis)
    .update(value.trim().toLowerCase(), "utf8")
    .digest("hex")
    .slice(0, 32);
}

/**
 * Zaehlt einen Versuch und sagt, ob er erlaubt ist.
 *
 * `now` ist nur fuer Tests gedacht; im Betrieb wird die Uhr des Systems
 * verwendet.
 */
export function consumeRateLimit(
  namespace: string,
  identifier: string,
  rule: RateLimitRule,
  now = Date.now()
): RateLimitResult {
  let buckets = speicher.get(namespace);

  if (!buckets) {
    buckets = new Map();
    speicher.set(namespace, buckets);
  }

  aufraeumen(buckets, now);

  const schluessel = hashIdentifier(identifier);
  const vorhanden = buckets.get(schluessel);

  if (!vorhanden || vorhanden.resetAt <= now) {
    buckets.set(schluessel, { count: 1, resetAt: now + rule.windowSeconds * 1000 });

    return {
      allowed: true,
      remaining: rule.limit - 1,
      retryAfterSeconds: rule.windowSeconds,
    };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((vorhanden.resetAt - now) / 1000));

  if (vorhanden.count >= rule.limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  vorhanden.count += 1;

  return {
    allowed: true,
    remaining: rule.limit - vorhanden.count,
    retryAfterSeconds,
  };
}

/** Nur fuer Tests: setzt die Zaehler eines Namensraums zurueck. */
export function resetRateLimit(namespace?: string) {
  if (namespace) speicher.delete(namespace);
  else speicher.clear();
}

/**
 * Das Merkmal des Aufrufers aus den Kopfzeilen. Hinter einem Proxy steht die
 * echte Adresse in `x-forwarded-for`; die erste Angabe ist der Ursprung.
 *
 * Fehlt alles, wird "unbekannt" zurueckgegeben. Dann greift nur das Limit
 * je E-Mail-Adresse - besser als keine Zaehlung.
 */
export function callerIdentifier(request: Request): string {
  const weitergeleitet = request.headers.get("x-forwarded-for");

  if (weitergeleitet) {
    const erste = weitergeleitet.split(",")[0]?.trim();

    if (erste) return erste;
  }

  return request.headers.get("x-real-ip")?.trim() || "unbekannt";
}
