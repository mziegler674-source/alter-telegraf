// Schnittstelle zum Zahlungsanbieter. Die Buchungslogik kennt nur diese
// Schnittstelle, nie einen konkreten Anbieter - dadurch bleibt Stripe
// austauschbar.
//
// Wichtig fuer das gesamte Modul: Kartennummer, Pruefziffer und
// Ablaufdatum erreichen diesen Server nie. Die Karte wird ausschliesslich
// im Browser direkt beim Anbieter erfasst; hier laufen nur dessen
// Referenzen durch.

/** Was wir ueber eine hinterlegte Karte wissen duerfen. */
export type StoredCard = {
  /** Kennung des Kunden beim Anbieter. */
  customerRef: string;
  /** Kennung der hinterlegten Zahlungsmethode beim Anbieter. */
  methodRef: string;
};

export type SetupSession = {
  /** Vom Browser benoetigtes Geheimnis, um die Karte zu erfassen. */
  clientSecret: string;
  /** Oeffentlicher Schluessel fuer die Seite. */
  publishableKey: string;
  customerRef: string;
};

export type ChargeResult = {
  /** Kennung der Belastung beim Anbieter. */
  chargeRef: string;
  /** True, wenn die Belastung sofort erfolgreich war. */
  succeeded: boolean;
  /** Vom Anbieter gemeldeter Zustand, fuer die Protokollierung. */
  status: string;
};

export interface PaymentProvider {
  /** Kennzeichen des Anbieters, landet in Booking.paymentProvider. */
  readonly name: string;

  /**
   * Beginnt die Karten-Hinterlegung. Liefert nur Referenzen und ein
   * Geheimnis fuer den Browser.
   */
  startCardSetup(input: {
    email: string;
    name: string;
    reference: string;
  }): Promise<SetupSession>;

  /**
   * Prüft beim Anbieter, ob die Karte tatsächlich hinterlegt wurde.
   * Der Client darf das nicht behaupten - gefragt wird der Anbieter.
   */
  confirmCardSetup(setupRef: string): Promise<StoredCard | null>;

  /**
   * Belastet eine hinterlegte Karte. Der Betrag kommt aus der
   * Stornoberechnung, nie aus dem Browser.
   */
  chargeStoredCard(input: {
    card: StoredCard;
    amountInCents: number;
    currency: string;
    description: string;
    /**
     * Schluessel gegen Doppelbelastung. Derselbe Schluessel fuehrt beim
     * Anbieter nie zu einer zweiten Belastung.
     */
    idempotencyKey: string;
  }): Promise<ChargeResult>;

  /** Loest die Hinterlegung wieder, etwa nach fristgerechter Stornierung. */
  releaseStoredCard(card: StoredCard): Promise<void>;

  /**
   * Prüft die Signatur eines eingehenden Webhooks und gibt das Ereignis
   * zurück. Null bedeutet: nicht echt, verwerfen.
   */
  verifyWebhook(rawBody: string, signatureHeader: string | null): WebhookEvent | null;
}

export type WebhookEvent = {
  id: string;
  type: string;
  /** Vom Anbieter mitgegebene eigene Referenz, hier die Buchungsnummer. */
  reference: string | null;
  /** Flach ausgelesene, unkritische Felder. Nie Kartendaten. */
  data: {
    customerRef?: string | null;
    methodRef?: string | null;
    status?: string | null;
  };
};

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly statusCode = 502
  ) {
    super(message);
    this.name = "PaymentError";
  }
}
