"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

// Kartenerfassung für die Garantie.
//
// Die Karte wird ausschließlich in einem Feld von Stripe eingegeben, das in
// einem eigenen Rahmen läuft. Kartennummer, Prüfziffer und Ablaufdatum
// erreichen weder diese Komponente noch unseren Server. Zurück kommt nur die
// Referenz der Hinterlegung.

declare global {
  interface Window {
    Stripe?: (key: string) => StripeLike;
  }
}

type StripeLike = {
  elements: (options: {
    clientSecret: string;
    appearance?: unknown;
    /** Karte zuerst anzeigen. Welche Arten moeglich sind, steuert das Konto. */
    paymentMethodOrder?: string[];
  }) => {
    create: (typ: string, options?: unknown) => { mount: (ziel: HTMLElement) => void };
    submit: () => Promise<{ error?: { message?: string } }>;
  };
  confirmSetup: (options: {
    elements: unknown;
    redirect: "if_required";
  }) => Promise<{ error?: { message?: string }; setupIntent?: { id: string; status: string } }>;
};

const SCRIPT = "https://js.stripe.com/v3/";

function ladeStripe(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Stripe) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const vorhanden = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);

    if (vorhanden) {
      vorhanden.addEventListener("load", () => resolve());
      vorhanden.addEventListener("error", () => reject(new Error("Stripe nicht erreichbar")));
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Stripe nicht erreichbar"));
    document.head.appendChild(script);
  });
}

/** Holt das Geheimnis vom Server und baut das Kartenfeld. Ohne Zustand. */
async function vorbereiten(email: string, name: string) {
  const response = await fetch("/api/hotel/zahlung/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? "Die Kartenerfassung konnte nicht gestartet werden.");
  }

  await ladeStripe();

  if (!window.Stripe) throw new Error("Stripe konnte nicht geladen werden.");

  const stripe = window.Stripe(data.publishableKey);

  // Karte steht vorn. Welche Zahlungsarten ueberhaupt angeboten werden,
  // entscheidet die Einstellung des Stripe-Kontos; der Server nimmt am Ende
  // ohnehin nur eine Karte an (confirmCardSetup prueft die Art).
  const elements = stripe.elements({
    clientSecret: data.clientSecret,
    paymentMethodOrder: ["card"],
  });

  return { stripe, elements, feld: elements.create("payment") };
}

export type CardGuaranteeHandle = {
  /** Liefert die Referenz der Hinterlegung, oder wirft mit einer Meldung. */
  confirm: () => Promise<string>;
};

export function CardGuarantee({
  email,
  name,
  handleRef,
}: {
  email: string;
  name: string;
  /** Die Komponente trägt hier ein, sobald das Kartenfeld bereit ist. */
  handleRef: RefObject<CardGuaranteeHandle | null>;
}) {
  const [status, setStatus] = useState<"laden" | "bereit" | "fehler">("laden");
  const [meldung, setMeldung] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const elements = useRef<ReturnType<StripeLike["elements"]> | null>(null);
  const stripe = useRef<StripeLike | null>(null);

  useEffect(() => {
    let aktiv = true;

    vorbereiten(email, name)
      .then((ergebnis) => {
        if (!aktiv) return;

        stripe.current = ergebnis.stripe;
        elements.current = ergebnis.elements;

        if (container.current) ergebnis.feld.mount(container.current);

        setStatus("bereit");
      })
      .catch((error: unknown) => {
        if (!aktiv) return;

        setStatus("fehler");
        setMeldung(error instanceof Error ? error.message : "Unbekannter Fehler.");
      });

    return () => {
      aktiv = false;
    };
  }, [email, name]);

  useEffect(() => {
    if (status !== "bereit") {
      handleRef.current = null;
      return;
    }

    handleRef.current = {
      confirm: async () => {
        if (!stripe.current || !elements.current) {
          throw new Error("Die Kartenerfassung ist nicht bereit.");
        }

        const abgeschickt = await elements.current.submit();

        if (abgeschickt.error) {
          throw new Error(abgeschickt.error.message ?? "Bitte prüfen Sie Ihre Kartendaten.");
        }

        // redirect "if_required": Nur wenn die Bank eine Bestätigung
        // verlangt, wird der Gast weitergeleitet (3-D Secure).
        const ergebnis = await stripe.current.confirmSetup({
          elements: elements.current,
          redirect: "if_required",
        });

        if (ergebnis.error) {
          throw new Error(
            ergebnis.error.message ?? "Die Karte konnte nicht hinterlegt werden."
          );
        }

        if (!ergebnis.setupIntent || ergebnis.setupIntent.status !== "succeeded") {
          throw new Error("Die Karte wurde nicht bestätigt. Bitte versuchen Sie es erneut.");
        }

        return ergebnis.setupIntent.id;
      },
    };
  }, [status, handleRef]);

  return (
    <div className="mt-6 rounded-2xl border border-[#211f1b]/10 bg-white p-5">
      <p className="font-semibold">Kreditkarte als Garantie</p>
      <p className="mt-1 text-sm leading-6 text-[#756f64]">
        Für diese Rate hinterlegen wir Ihre Kreditkarte als Sicherheit. Es wird jetzt nichts
        abgebucht. Eine Belastung erfolgt nur, wenn die oben genannten Stornobedingungen es
        vorsehen.
      </p>

      <div ref={container} className="mt-4 min-h-[48px]" />

      {status === "laden" && (
        <p className="mt-2 text-sm text-[#756f64]">Kartenfeld wird geladen …</p>
      )}

      {status === "fehler" && (
        <p className="mt-2 text-sm text-red-700">
          {meldung} Bitte wenden Sie sich an das Hotel:{" "}
          <a href="tel:+43316686558" className="underline">
            +43 316 686558
          </a>
          .
        </p>
      )}

      <p className="mt-3 text-xs text-[#756f64]">
        Ihre Kartendaten werden direkt an unseren Zahlungsdienstleister übertragen. Das Hotel
        speichert weder Kartennummer noch Prüfziffer.
      </p>
    </div>
  );
}
