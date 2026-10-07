import "temporal-polyfill/full/global";

import { Temporal } from "temporal-polyfill";

// Zeitrechnung des Hotels. Eigenes Modul, damit sowohl die Buchungslogik als
// auch die Zahlungslogik darauf zugreifen koennen, ohne sich gegenseitig zu
// importieren.

/**
 * Heutiges Datum in der Zeitzone des Hotels. Stornofristen werden danach
 * gerechnet, nicht nach UTC und nicht nach der Zeitzone des Gastes: Ob eine
 * Frist abgelaufen ist, entscheidet der Kalender vor Ort.
 */
export function todayInHotelTimezone(timezone: string): string {
  try {
    return Temporal.Now.plainDateISO(timezone).toString();
  } catch {
    return Temporal.Now.plainDateISO("Europe/Vienna").toString();
  }
}
