import "server-only";

import {
  type AvailabilityPush,
  type ChannelProvider,
  ChannelError,
  type ExternalBooking,
  type PushResult,
} from "./provider";
import { verifySignature } from "./signature";

// Einrichtung des Vertriebskanals.
//
// Welcher Anbieter verwendet wird, steht in Umgebungsvariablen - niemals in
// der Datenbank und niemals im Quellcode:
//
//   CHANNEL_PROVIDER        Name des Anbieters, derzeit nur "mock"
//   CHANNEL_PROPERTY_ID     Kennung der Unterkunft beim Anbieter
//   CHANNEL_API_TOKEN       Zugangstoken
//   CHANNEL_WEBHOOK_SECRET  Geheimnis fuer eingehende Nachrichten
//
// Fehlt etwas davon, ist der Kanal NICHT eingerichtet. Die Anwendung laeuft
// dann vollstaendig weiter: Buchungen entstehen, der Kalender stimmt, und
// jede Uebertragung wird als „nicht uebertragen“ protokolliert. Es wird
// nichts geraten und nichts als synchronisiert ausgegeben.
//
// Fuer einen echten Anbieter fehlt die Freigabe. Was dafuer noetig ist,
// steht in docs/booking-com-integration.md. Hier wird kein Endpunkt und kein
// Authentifizierungsverfahren erfunden.

export type ChannelConfig = {
  provider: string;
  propertyId: string;
  token: string;
  webhookSecret: string;
};

const PFLICHTFELDER = [
  "CHANNEL_PROVIDER",
  "CHANNEL_PROPERTY_ID",
  "CHANNEL_API_TOKEN",
  "CHANNEL_WEBHOOK_SECRET",
] as const;

/** Welche Pflichtwerte fehlen? Nur Namen, niemals Werte. */
export function missingChannelSettings(): string[] {
  return PFLICHTFELDER.filter((name) => !process.env[name]?.trim());
}

export function channelConfig(): ChannelConfig | null {
  if (missingChannelSettings().length > 0) return null;

  return {
    provider: (process.env.CHANNEL_PROVIDER as string).trim().toLowerCase(),
    propertyId: (process.env.CHANNEL_PROPERTY_ID as string).trim(),
    token: process.env.CHANNEL_API_TOKEN as string,
    webhookSecret: process.env.CHANNEL_WEBHOOK_SECRET as string,
  };
}

export function channelConfigured() {
  return channelConfig() !== null;
}

// ---------------------------------------------------------------------------
// Mock-Anbieter
//
// Nur fuer Tests und die lokale Entwicklung. Er verschickt nichts, sondern
// merkt sich die Uebertragungen. Die Signaturpruefung eingehender
// Nachrichten ist dabei echt - genau die soll geprueft werden.
// ---------------------------------------------------------------------------

const uebertragungen: AvailabilityPush[] = [];
let eingehende: ExternalBooking[] = [];
let scheitert: { fail: boolean; retryable: boolean } = { fail: false, retryable: true };

export function mockPushes(): readonly AvailabilityPush[] {
  return uebertragungen;
}

export function clearMockChannel() {
  uebertragungen.length = 0;
  eingehende = [];
  scheitert = { fail: false, retryable: true };
}

/** Steuert den Mock-Anbieter im Test. */
export function configureMockChannel(options: {
  fail?: boolean;
  retryable?: boolean;
  bookings?: ExternalBooking[];
}) {
  if (options.fail !== undefined) scheitert.fail = options.fail;
  if (options.retryable !== undefined) scheitert.retryable = options.retryable;
  if (options.bookings) eingehende = options.bookings;
}

function mockProvider(config: ChannelConfig): ChannelProvider {
  return {
    name: "mock",

    async pushAvailability(push: AvailabilityPush): Promise<PushResult> {
      if (scheitert.fail) {
        throw new ChannelError("Mock-Kanal: Übertragung absichtlich fehlgeschlagen.", {
          retryable: scheitert.retryable,
        });
      }

      uebertragungen.push(push);

      return { accepted: true, reference: `mock-${uebertragungen.length}` };
    },

    async fetchBookings() {
      if (scheitert.fail) {
        throw new ChannelError("Mock-Kanal: Abruf absichtlich fehlgeschlagen.", {
          retryable: scheitert.retryable,
        });
      }

      return eingehende;
    },

    readWebhook(rawBody: string, signature: string | null) {
      if (!verifySignature(rawBody, signature, config.webhookSecret).ok) return null;

      try {
        const daten = JSON.parse(rawBody) as ExternalBooking;

        if (!daten?.externalRef || !daten?.externalRoomTypeId) return null;

        return daten;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Der eingerichtete Anbieter, oder null.
 *
 * Ein unbekannter Name fuehrt bewusst zu einem Fehler statt zu stiller
 * Untaetigkeit: Sonst koennte ein Tippfehler in der Konfiguration wie ein
 * funktionierender Kanal aussehen.
 */
export function getChannelProvider(): ChannelProvider | null {
  const config = channelConfig();

  if (!config) return null;

  if (config.provider === "mock") return mockProvider(config);

  throw new ChannelError(
    `Für den Kanal „${config.provider}“ ist keine Anbindung implementiert. ` +
      "Siehe docs/booking-com-integration.md.",
    { retryable: false }
  );
}

/** Entfernt Zugangsdaten aus einer Meldung, bevor sie protokolliert wird. */
export function redactChannelSecrets(text: string): string {
  const config = channelConfig();

  if (!config) return text;

  return [config.token, config.webhookSecret]
    .filter((wert) => wert && wert.length >= 6)
    .reduce((bisher, wert) => bisher.split(wert).join("[entfernt]"), text);
}
