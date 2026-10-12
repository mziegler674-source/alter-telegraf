# E-Mail-Versand – Aufbau und Entscheidungen

Stand 11.10.2026.

## Grundsatz

Jede E-Mail der Anwendung läuft durch **einen** Service. Kein Endpunkt baut
seinen eigenen Versand. Der Grund ist nicht Schönheit, sondern Verlässlichkeit:
Protokollierung, Fehlerbehandlung und das Maskieren von Gasteingaben passieren
dadurch an genau einer Stelle.

**Eine E-Mail ist niemals der Beweis, dass eine Buchung geklappt hat.** Erst
wird gespeichert, dann verschickt. Scheitert der Versand, bleibt die Buchung
bestehen und bestätigt; der Versuch steht im Protokoll und lässt sich in der
Verwaltung wiederholen.

## Bausteine

| Baustein | Datei |
| --- | --- |
| Versandweg (SMTP, Mock) | `lib/mail/transport.ts` |
| Versand und Protokoll | `lib/mail/service.ts` |
| Daten laden und verschicken | `lib/mail/notifications.ts` |
| HTML- und Textgerüst | `lib/mail/layout.ts` |
| Farben, Kontaktdaten | `lib/mail/branding.ts` |
| Hotelbestätigung | `lib/mail/templates/hotel-booking.ts` |
| Reservierungsmails | `lib/mail/templates/restaurant-reservation.ts` |

Die Vorlagen kennen weder Datenbank noch Umgebung: Sie bekommen Daten und
geben `{subject, html, text}` zurück. Das macht sie ohne Mailserver prüfbar.
`notifications.ts` lädt die Daten anhand der ID – deshalb kann jede Mail
jederzeit erneut erzeugt werden, was die Aktion „Bestätigung erneut senden“
erst möglich macht.

## Technik

SMTP über **nodemailer**. Das Protokoll selbst nachzubauen – TLS-Aufbau,
`AUTH`, Dot-Stuffing, MIME mit `quoted-printable` für Umlaute – wäre deutlich
mehr eigener Code an einer Stelle, an der Fehler erst beim echten Versand
auffallen. nodemailer liegt hinter der eigenen Schnittstelle `MailTransport`,
der Anbieter bleibt also austauschbar.

Ohne implizites TLS (Port 465) wird **STARTTLS erzwungen** (`requireTLS`).
Sonst gingen die Zugangsdaten im Klartext über die Leitung.

## Umgebungsvariablen

| Variable | Pflicht | Bedeutung |
| --- | --- | --- |
| `SMTP_HOST` | ja | Postausgangsserver von World4You |
| `SMTP_PORT` | nein | Standard 587 |
| `SMTP_USER` | ja | Benutzername des Mailkontos |
| `SMTP_PASSWORD` | ja | Kennwort des Mailkontos |
| `SMTP_FROM` | ja | Absender, z. B. `Alter Telegraf <…>` |
| `SMTP_SECURE` | nein | übersteuert die Verschlüsselung; ohne Angabe implizit bei Port 465, sonst STARTTLS |
| `SMTP_REPLY_TO` | nein | Antwortadresse der Gastmails |
| `RESERVATION_NOTIFICATION_EMAIL` | nein | Adresse des Betriebs für neue Reservierungen |
| `MAIL_TRANSPORT` | nein | `mock` verschickt nichts; nur für Tests und lokale Arbeit |

**Fehlt einer der vier Pflichtwerte, verschickt die Anwendung nichts.** Sie
rät nicht und bricht auch nichts ab: Buchungen und Reservierungen entstehen
normal, der Versuch wird als `SKIPPED` protokolliert und der Grund genannt.

Die echten Werte stehen ausschließlich in `.env.local`. `.env.example` enthält
nur die Namen.

## Protokoll

Tabelle `emailLog` im Schema `public`, Migration
`20261010T2149_email_log`. Festgehalten werden Mailtyp, Empfänger, Betreff,
Status (`SENT`, `FAILED`, `SKIPPED`), Transportweg, Fehlermeldung,
Server-Kennung, Anlass (`HOTEL_BOOKING` bzw. `RESTAURANT_RESERVATION` samt ID)
und die Nummer des Versuchs.

**Nicht gespeichert** werden der Mailtext und alles, was nach Zugangsdaten
aussieht. Vor dem Protokollieren entfernt `redactSecrets` das SMTP-Kennwort
aus Servermeldungen, und die Meldung wird auf 500 Zeichen gekürzt.

Der Anlass ist bewusst **ohne Fremdschlüssel** hinterlegt: Hotel und
Restaurant liegen in getrennten Schemas, und ein Protokolleintrag soll das
Löschen eines Datensatzes nicht verhindern.

## Status und Abläufe

### Hotelbuchung

Eine Online-Buchung ist nach dem Anlegen **`CONFIRMED`**. Verfügbarkeit,
Bettart und Preis sind serverseitig geprüft, es bleibt kein Schritt für den
Betrieb offen – ein Zwischenstatus wäre eine Fiktion. Direkt danach geht die
Bestätigungsmail an den Gast.

Die Verwaltung kann sie unter „Buchungen“ jederzeit erneut senden und sieht
dort den letzten Versandversuch.

Buchungen aus anderen Quellen (Telefon, manuell) bleiben beim bisherigen
Ablauf: Sie werden vom Betrieb bestätigt, und mit dieser Bestätigung geht die
Mail hinaus.

### Restaurantreservierung

Die Reservierung bleibt **`NEW`**. Der Gast erhält sofort eine Mail
„Anfrage eingegangen“, die ausdrücklich **keine** Zusage ist; der Betrieb wird
parallel benachrichtigt. Erst wenn der Betrieb in der Verwaltung auf
`CONFIRMED` stellt, geht die verbindliche Zusage an den Gast.

Das ist eine bewusste Abweichung von einer vollautomatischen Bestätigung: Für
den Tischbestand gibt es keine Kapazitätsprüfung. Eine automatische Zusage
würde einen Tisch versprechen, den es zu dieser Uhrzeit möglicherweise nicht
gibt. Sobald eine Tischverwaltung existiert, kann das umgestellt werden.

## Gestaltung

Tabellen und Inline-Styles, eine Spalte mit höchstens 620 Pixeln, Schriftgröße
ab 14 Pixeln, grüner Kopf in den Farben der Website (`#315c45`). Nur das
stellen alle gängigen Mailprogramme zuverlässig dar, und es ist auf dem
Telefon ebenso lesbar wie am Schreibtisch.

Jede Mail hat zwingend eine Textfassung: `renderMail` erzeugt HTML und Text aus
denselben Daten, eine Fassung kann also nicht veralten.

Alle Werte werden beim Rendern maskiert. Eine Gastnachricht mit `<script>`
landet als Text in der Mail, nicht als Markup.

## Was noch offen ist

- **Benachrichtigung des Betriebs bei neuen Hotelbuchungen.** Für das
  Restaurant gibt es sie, für das Hotel noch nicht.
- **Stornierungsmails.** Der Service ist darauf vorbereitet, ein Mailtyp
  genügt; die Aktion im Admin verschickt derzeit nichts.
- **Erneuter Versand im Stapel.** Heute wird je Buchung einzeln gesendet.
- **Adresse und Telefonnummer des Restaurants** stehen in
  `lib/mail/branding.ts`, nicht in der Datenbank – anders als beim Hotel, das
  seine Stammdaten selbst pflegt. Für das Restaurant gibt es keine
  Stammdatenzeile. Falls der Betrieb das ändern können soll, braucht es
  Felder an `Restaurant`.
