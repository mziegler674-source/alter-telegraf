// Erzeugt eine Buchungsnummer im Format AT-JJJJ-NNNNNN.
//
// Eigene Datei, damit sowohl die Buchungsstrecke als auch die Uebernahme
// externer Reservierungen sie verwenden koennen, ohne einen Importzyklus zu
// bilden. Die Eindeutigkeit stellt die Datenbank sicher; der Aufrufer
// versucht es bei einer Kollision erneut.
export function bookingNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");

  return `AT-${year}-${random}`;
}
