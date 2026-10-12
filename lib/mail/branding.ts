// Veroeffentlichte Kontaktdaten des Betriebs. Hotel und Restaurant liegen im
// selben Haus und teilen Adresse und Telefonnummer; genau diese Werte stehen
// auch auf der Website.
//
// Fuer HOTEL-Mails werden die Werte NICHT hier gelesen, sondern aus der
// Hotelzeile der Datenbank - dort pflegt sie der Betrieb selbst. Dieser
// Baustein dient dem Restaurant, fuer das es keine eigene Stammdatenzeile
// gibt, und der Gestaltung.
export const BUSINESS_CONTACT = {
  street: "Grabenstraße 12",
  postalCode: "8010",
  city: "Graz",
  phone: "+43 316 686558",
};

// Farben der Website, damit die E-Mails zum Auftritt passen.
export const MAIL_COLORS = {
  green: "#315c45",
  greenDark: "#264936",
  ink: "#211f1b",
  muted: "#756f64",
  sand: "#f5f1e8",
  line: "#e9e2d5",
  gold: "#d8c39a",
};
