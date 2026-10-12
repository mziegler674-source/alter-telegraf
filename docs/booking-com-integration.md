# Booking.com und Vertriebskanäle

Stand 11.10.2026. Dieses Dokument hält den Ist-Zustand, die geprüften
Möglichkeiten, die Kosten und die offenen Voraussetzungen fest.

**Wichtigster Satz vorweg:** Es ist derzeit **keine** Verbindung zu
Booking.com aktiv, und es wurde keine hergestellt. Was im Repository liegt,
ist die vollständige, getestete *Grundlage* dafür — mit einem Mock-Anbieter
geprüft, nicht gegen ein echtes Portal.

## 1. Bestandsaufnahme

### Was das PMS schon kann

| Bereich | Stand |
| --- | --- |
| Buchungsstrecke | öffentlich, serverseitige Preis- und Verfügbarkeitshoheit |
| Verfügbarkeit | auf Ebene der physischen Zimmer, mit Bettenlage und Kapazität |
| Zimmer | 17 physische Zimmer, 4 Kategorien, Zimmersperren mit Zeitraum |
| Belegungskalender | Zimmer- und Kategorieansicht aus den echten Buchungen |
| Zimmerzuweisung | serverseitig geprüft, transaktionssicher |
| Stornobedingungen | pflegbar, zum Buchungszeitpunkt eingefroren |
| Preise und Aktionen | eine Rabattlogik, Aktionscodes, Vorschau |
| Gäste | Stammdaten, Zusammenführung über die E-Mail-Adresse |
| E-Mail | zentraler Service mit Versandprotokoll |
| Kartengarantie | Stripe-Testmodus, anbieterunabhängig gekapselt |
| Rechte | Hotelverwaltung nur für die Rolle `admin` |

### Was im Schema bereits vorbereitet war

Vor dieser Arbeit vorhanden und unverändert genutzt:

- `Booking.source` mit `BOOKING_COM`, `EXPEDIA`, `AIRBNB`, `PHONE`, `EMAIL`,
  `WALK_IN`, `MANUAL`, `OTHER`
- `Booking.externalChannel` und `Booking.externalBookingId` mit
  `@@unique([externalChannel, externalBookingId])` — **die Idempotenz lag
  also schon im Schema**
- `RoomType.channelCode` und `RatePlan.channelCode`

### Was fehlte

- Keine Möglichkeit, eine Buchung aus Telefon, E-Mail oder einem Portal
  überhaupt zu **erfassen**. Der Admin konnte nur bestehende Buchungen
  bearbeiten.
- Keine Zuordnung zwischen eigener und externer Zimmerart.
- Kein Auftrags- oder Protokollwesen für Übertragungen.
- Keine Trennung zwischen „lokal gespeichert“ und „vom Kanal bestätigt“.
- `Inventory` existiert im Schema, wurde aber von **keiner Zeile Code**
  verwendet. Es bleibt unangetastet; der Kalender und die Kanalmeldung
  rechnen aus `BookingRoom` und `RoomBlock`.

### Umgebung

| Baustein | Befund |
| --- | --- |
| Hosting | Vercel, keine `vercel.json` vorhanden (jetzt angelegt) |
| Datenbank | Prisma Postgres (`pooled.db.prisma.io`) |
| Hintergrundprozesse | keine; keine Cron-Jobs konfiguriert |
| Kanalbezogene Variablen | keine vorhanden |

## 2. Weg A: Direkte Anbindung an Booking.com

**Ergebnis: für dieses Haus nicht verfügbar.**

Booking.com verlangt für die Connectivity-APIs eine Zulassung als
*Connectivity Partner*. Veröffentlichte Anforderungen:

- PCI- und PII-Konformität
- cloud- oder zentralserverbasierte Software
- Verwaltung von Preisen und Verfügbarkeit, Reservierungsverwaltung,
  Echtzeit-Aktualisierung, sofortige Bestätigung eingehender Reservierungen,
  Verwaltung von Inhalten
- eine **Mindestanzahl angebundener Unterkünfte**, abhängig von Markt und
  Region
- Unterstützung aller API-Funktionen und Laden von mindestens einem
  vollen Jahr an Raten und Verfügbarkeit

Dazu kommt: Das Partnerportal nimmt laut eigener Angabe **derzeit keine neuen
Registrierungen** an, weil die Bedingungen überarbeitet werden.

Ein eigenes PMS für ein einzelnes Haus mit 17 Zimmern erfüllt die
Mindestanzahl nicht. Ein eigener API-Endpunkt genügt nicht — ohne Zulassung
gibt es keinen Zugang. Deshalb wurde hier **kein** Booking.com-Adapter
implementiert und **kein** Endpunkt, Schlüssel oder Verfahren erfunden.

## 3. Weg B: Anbindung über einen Channel Manager

Der Channel Manager ist bei Booking.com zugelassen; unser PMS spricht mit dem
Channel Manager. Entscheidend ist, dass der Anbieter die Anbindung eines
**selbst entwickelten** PMS per API erlaubt.

| Anbieter | Eigenes PMS per API? | Kosten | Belegt? |
| --- | --- | --- | --- |
| **Beds24** | ja, ausdrücklich dokumentiert | Basis ab ca. **15,90 €/Monat** je Unterkunft, zzgl. ca. 1,00 € je weiterer Einheit; API im bezahlten Konto ohne Aufpreis | API-Weg **belegt** (Herstellerdokumentation), **Preise nicht auf der Herstellerseite verifiziert** |
| **Channex** | ja, API-first | ab ca. **130 USD/Monat** Plattformgebühr zzgl. ca. 7 USD je Hotel | Preis aus Drittquelle, nicht verifiziert |
| **NoBeds** | **unklar** | kostenloser Tarif, Premium ca. 15 €/Monat | **Eignung nicht belegt**: Eine offene API für ein eigenes PMS ist nicht nachgewiesen. Ohne sie wäre es ein zweites vollständiges PMS — genau das wollen wir nicht |

### Was bei Beds24 nachweislich geht

Aus der Herstellerdokumentation (API V2):

- Ein eigenes PMS kann die Anbindung entwickeln; eine Anmeldung im
  Beds24-Konto für Einrichtung und Buchungsverwaltung ist „in der Regel nicht
  erforderlich“.
- Authentifizierung: Einladungscode → Zugriffstoken + `refreshToken`.
- Verfügbarkeit und Preise: `POST /inventory/rooms/calendar` (senden),
  `GET /inventory/rooms/calendar` (lesen).
- Reservierungen: `GET /bookings` (abrufen) oder Buchungs-Webhooks oder
  beides.
- **Einschränkung:** Die Zuordnung zu Booking.com lässt sich **nicht** über
  die API vornehmen, sondern nur im Kontrollpanel von Beds24.

Diese letzte Einschränkung hat die Architektur geprägt: Zuordnungen werden
bei uns **eingetragen und ausdrücklich bestätigt**, nicht automatisch
ermittelt.

### Nicht implementiert — mit Absicht

Für Beds24 liegt **kein** Adapter im Code. Die Endpunktnamen und der
Authentifizierungsablauf sind belegt, die genauen Feldnamen der Nutzdaten
aber nicht. Die zu erraten hätte genau das erzeugt, was vermieden werden
soll: Code, der plausibel aussieht und im Echtbetrieb falsch ist. Sobald ein
Konto besteht, ist der Adapter gegen die Schnittstelle `ChannelProvider`
(rund 5 Methoden) zu schreiben — alles darüber liegt fertig und getestet vor.

## 4. Weg C: Kontrollierter manueller Betrieb — jetzt verfügbar

Dieser Weg ist **umgesetzt und einsatzbereit**, ohne jede externe Freigabe:

- Buchungen aus Telefon, E-Mail, spontan vor Ort und von Portalen lassen sich
  unter „Buchungen“ erfassen → „Buchung erfassen“.
- Die Quelle wird mitgeführt und in der Liste angezeigt.
- Eine **externe Referenz** (Reservierungsnummer des Portals) verhindert, dass
  dieselbe Reservierung zweimal erfasst wird.
- Geprüft wird mit **derselben** Verfügbarkeitsrechnung wie bei einer
  Online-Buchung, unter derselben Zeilensperre.
- Eine Überbuchung ist möglich, aber nur **ausdrücklich** — und sie wird an
  der Buchung vermerkt.
- Zimmer sperren und freigeben: im Kalender.
- Die Seite „Kanäle“ nennt den Zustand ehrlich: ohne Einrichtung
  „noch nicht eingerichtet“.

**Das ist keine Synchronisierung.** Verfügbarkeiten auf Booking.com müssen im
Extranet weiter von Hand gepflegt werden. Die Oberfläche behauptet nirgends
etwas anderes.

## 5. Umgesetzte Architektur

| Baustein | Datei |
| --- | --- |
| Gemeinsame Verfügbarkeitsquelle | `lib/hotel/inventory.ts` |
| Schnittstelle zum Kanal | `lib/hotel/channel/provider.ts` |
| Einrichtung, Mock-Anbieter | `lib/hotel/channel/index.ts` |
| Signaturprüfung | `lib/hotel/channel/signature.ts` |
| Auftragstabelle | `lib/hotel/channel/jobs.ts` |
| Auftragsverarbeitung, Wiederholungen | `lib/hotel/channel/sync.ts` |
| Übernahme externer Reservierungen | `lib/hotel/channel/import.ts` |
| Erfassung durch den Betrieb | `lib/hotel/operator-booking.ts` |
| Kanalverwaltung (API) | `app/api/admin/hotel/kanaele/route.ts` |
| Eingehende Nachrichten | `app/api/channel/webhook/route.ts` |
| Geplanter Lauf | `app/api/cron/channel/route.ts` |
| Oberfläche | `app/admin/hotel/kanaele/page.tsx` |

### Eine Quelle für die Verfügbarkeit

`inventoryForRange` ist die einzige Stelle, die beantwortet, wie viele Zimmer
einer Kategorie an einem Tag frei sind. Der Belegungskalender und die
Kanalmeldung verwenden **dieselbe Funktion** — der Kalender kann also nichts
anderes anzeigen als gemeldet wird. Grundlage sind ausschließlich
`BookingRoom` (ohne Storno und Nichtanreise) und `RoomBlock`.

Es gibt **17 physische Zimmer**. Direktbuchungen und externe Buchungen zehren
vom selben Bestand; Inventar wird nie addiert.

### Lokal gespeichert ≠ übertragen

Eine Buchung ist gespeichert und gültig, sobald sie in der Datenbank steht.
Ob ein Kanal davon weiß, ist eine **getrennte** Frage und steht als Auftrag
in `syncJob`. Nur der Status `DONE` belegt eine bestätigte Übertragung. Die
Buchungsliste zeigt beides nebeneinander.

### Idempotenz

- **Eingehende Reservierungen:** `@@unique([externalChannel,
  externalBookingId])`. Dieselbe Reservierung kann keine zweite Buchung
  erzeugen. Unterschieden wird zwischen Neueingang (`CREATED`), Wiederholung
  (`DUPLICATE`), Änderung (`UPDATED`) und Storno (`CANCELLED`).
- **Eingehende Nachrichten:** `@@unique([provider, messageId])`. Der
  Webhook registriert die Nachricht, *bevor* er sie verarbeitet, und erkennt
  eine Wiederholung am Scheitern des Einfügens — ohne Vorabprüfung und damit
  ohne Zeitfenster für ein Wettrennen.
- **Wiederholungen** verwenden denselben Auftrag; es entstehen keine
  Duplikate.

### Wiederholungen und Fehler

Wartezeit verdoppelt sich je Versuch, gedeckelt bei 60 Minuten, höchstens
5 Versuche. Danach `FAILED` — keine Endlosschleife. Ein Fehler, der nicht
vorübergehend sein kann (fehlende Zuordnung, unbekannter Anbieter), wird
sofort endgültig. Fehlgeschlagene Aufträge bleiben sichtbar und lassen sich
von Hand erneut anstoßen.

### Sicherheit

- Eingehende Nachrichten brauchen eine gültige HMAC-Signatur mit Zeitstempel
  im Signaturumfang (Fenster 300 Sekunden) → Schutz vor Wiedereinspielung.
- Zugangsdaten stehen **nur** in Umgebungsvariablen, nie in der Datenbank,
  nie im Code, nie im Protokoll. `redactChannelSecrets` entfernt sie vor dem
  Speichern aus Fehlermeldungen.
- Die Nutzlast eines Auftrags enthält keine vollständigen Gastdatensätze.
- Admin-Endpunkte: Rolle `admin`. Der geplante Lauf verlangt ein
  Bearer-Token und ist ohne `CRON_SECRET` abgeschaltet.
- Externe Reservierungen werden wie Fremdeingaben geprüft; ohne **bestätigte**
  Zuordnung entsteht keine Buchung, sondern eine Aufgabe.

### Überbuchung statt stiller Ablehnung

Hat der Kanal verkauft, obwohl bei uns nichts mehr frei war, wird die
Reservierung trotzdem übernommen und als **Überbuchung gekennzeichnet**
(Auftragsstatus `ATTENTION`, Hinweis an der Buchung). Sie zu verwerfen wäre
der schlimmere Fehler: Der Gast stünde dann trotzdem vor der Tür.

## 6. Hintergrundverarbeitung auf Vercel

Geprüfte Grenzen der offiziellen Dokumentation:

| Tarif | Cron-Jobs je Projekt | Mindestabstand | Genauigkeit |
| --- | --- | --- | --- |
| Hobby | 100 | **einmal pro Tag** | pro Stunde (±59 Min.) |
| Pro | 100 | einmal pro Minute | pro Minute |

Folgen für uns:

- Ein **Webhook** ist der eigentliche Weg für eingehende Reservierungen:
  sofort, ohne Zeitplan, auf jedem Tarif.
- Der geplante Lauf ist das **Netz darunter**. `vercel.json` enthält
  deshalb bewusst einen **täglichen** Lauf (`0 4 * * *`): Dieser Ausdruck ist
  auf beiden Tarifen zulässig. Ein häufigerer Ausdruck würde das Deployment
  im Hobby-Tarif **scheitern** lassen.
- Für zeitnahes Abrufen (etwa alle 5–15 Minuten) ist der **Pro-Tarif**
  nötig.
- Dauerhaft laufende Prozesse gibt es nicht und werden nicht verwendet.
- Eine Synchronisierung, die nur läuft, wenn jemand eine Seite öffnet, wurde
  **nicht** gebaut.

## 7. Kosten

### Bereits bestehend

| Posten | Betrag | Belegt? |
| --- | --- | --- |
| Vercel | Tarif unbekannt | **offen** — bitte im Konto prüfen |
| Prisma Postgres | Tarif unbekannt | **offen** |
| E-Mail (World4You) | im bestehenden Paket | laut Betreiber vorhanden |
| Domain altertelegraf.at | bestehend | unverändert |

### Zusätzlich, je nach Weg

| Weg | Zusätzlich pro Monat | Anmerkung |
| --- | --- | --- |
| **C: manueller Betrieb** | **0 €** | sofort einsatzbereit, keine Verträge |
| B: Beds24 | ca. 16–35 € (nicht verifiziert) | Preis auf der Herstellerseite prüfen; 17 Einheiten erhöhen den Grundpreis |
| B: Channex | ab ca. 130 USD | für dieses Haus unverhältnismäßig |
| Vercel Pro (für häufige Cron-Läufe) | ca. 20 USD je Nutzer | nur nötig, wenn regelmäßiges Abrufen gewünscht ist |
| Booking.com-Provision | 15–18 % je Buchung | bestehendes Geschäftsverhältnis, keine Softwarekosten |

### Zwei Hinweise, die Geld betreffen

1. **Vercel Hobby ist auf nicht-kommerzielle, private Nutzung beschränkt.**
   Eine Hotelwebsite mit Buchungsannahme ist kommerziell. Falls das Projekt
   im Hobby-Tarif läuft, ist der **Pro-Tarif** unabhängig von jeder
   Kanalanbindung erforderlich. (Quelle: Drittanbieter-Zusammenfassung der
   Vercel-Bedingungen — **bitte in den Vercel-Bedingungen selbst
   bestätigen**.)
2. Beim kostenlosen Tarif von Prisma Postgres gilt dasselbe Prüfgebot:
   Grenzen und kommerzielle Zulässigkeit sind zu klären.

Keine der genannten Optionen wurde aktiviert, kein Vertrag geschlossen, kein
Konto angelegt.

## 8. Entscheidungsvorschlag

1. **Jetzt:** Weg C betreiben. Kosten 0 €, keine Doppelbuchungen durch
   Direktbuchungen, Portalreservierungen werden erfasst und sind sichtbar.
   Verfügbarkeit auf Booking.com weiterhin im Extranet pflegen.
2. **Wenn Automatisierung gewünscht ist:** Beds24-Konto anlegen, Preise auf
   der Herstellerseite bestätigen, Einladungscode erzeugen, Adapter gegen
   `ChannelProvider` schreiben, Zuordnungen im Beds24-Panel vornehmen und bei
   uns bestätigen, dann erst scharf schalten.
3. **Weg A bleibt zu:** solange das Partnerportal keine Registrierungen
   annimmt und die Mindestanzahl an Unterkünften nicht erreicht wird.

## 9. Offene Voraussetzungen

| Was | Wofür |
| --- | --- |
| Entscheidung für einen Anbieter | Weg B |
| Konto beim Anbieter + Einladungscode/Token | Weg B |
| Bestätigte Preise des Anbieters | Kostenfreigabe |
| `CHANNEL_*`-Variablen in `.env.local` | Einrichtung |
| `CRON_SECRET` | geplanter Lauf |
| Vercel-Tarif geklärt | Taktung und Zulässigkeit |
| Zuordnung der Zimmerarten im Portal | Übertragung |
| Datenschutzhinweis ergänzen | Übermittlung von Gastdaten an den Anbieter |

## 10. Was ausdrücklich nicht geprüft werden konnte

- Kein Test gegen eine echte Booking.com- oder Channel-Manager-Schnittstelle.
  Alle Tests laufen gegen den Mock-Anbieter.
- Ob Beds24 mit 17 Einheiten tatsächlich zum genannten Preis verfügbar ist.
- Ob NoBeds eine für uns nutzbare API hat.
- Der tatsächliche Vercel- und Prisma-Tarif dieses Projekts.
