# Hotel-PMS – Entscheidungen und Abläufe

Kurze Referenz zum Hotelteil des Projekts. Der Restaurantbereich (`public`-Schema)
ist davon getrennt und wird hier nicht berührt.

## Datenbank

Die Hoteldaten liegen im eigenen Postgres-Schema `hotel`, die Restaurantdaten in
`public`. Beide werden über denselben Prisma-8-Contract (`prisma/contract.prisma`)
beschrieben.

### Migrationsablauf

Dieses Projekt nutzt **nicht** `prisma migrate dev` oder `prisma db push`. Ebenso
wird `prisma db update` bewusst nicht verwendet: Es schreibt keine
Migrationsdateien, wodurch der vorhandene Migrationsgraph unter `migrations/app/`
dauerhaft von der Datenbank abweichen würde. Stattdessen gilt:

```bash
npx prisma contract emit                 # Contract-Artefakte erzeugen
npx prisma db update --dry-run           # Vorschau, nur zur Kontrolle
npx prisma migration plan --name <slug>  # Migrationspaket schreiben
node migrations/app/<paket>/migration.ts # nach Handänderungen neu emittieren
npx prisma db migrate --show             # Route prüfen, nur lesend
npx prisma db migrate                    # anwenden (eine Transaktion)
npx prisma db verify                     # Schema und Marker prüfen
```

Zeigt der lokale `db`-Ref nicht auf den Stand der Datenbank, muss er vorher
nachgezogen werden, sonst plant Prisma bereits angewendete Migrationen erneut:

```bash
npx prisma migration ref set db <hash-des-markers>
```

### Bekannte Eigenheiten der eingesetzten RC-Version

- **`this.setDefault(...)` wirkt nicht.** In der Migration `hotel_pms_v2` wurden
  die beiden Default-Änderungen deshalb als `rawSql` mit eigener Nachprüfung
  geschrieben. Ohne das schlägt die Schemaprüfung nach dem Anwenden fehl.
- **Der SQL-Builder kann für Tabellen außerhalb des Default-Schemas kein SQL
  rendern** (`qualifyTable` fehlt im Contract). Datenmigrationen im Schema
  `hotel` daher als `rawSql` schreiben, nicht über `dataTransform` mit
  Query-Buildern.
- **Die Reihenfolge von `dropTable` beachtet keine Fremdschlüssel.** Beim
  Entfernen von `amenity` musste `roomTypeAmenity` von Hand vorgezogen werden.

## Fachliche Entscheidungen

### Zimmer 26

**Korrigiert am 03.10.2026 durch den Betreiber.** Zimmer 26 war zunächst als
internes Dreibettzimmer geführt. Es ist tatsächlich öffentlich buchbar und
gehört zur Kategorie **Doppelzimmer mit Schlafsofa (`DZS`)** mit einer Belegung
von **bis zu 3 Personen** zu 159 € pro Nacht.

Die zuvor angelegte interne Kategorie `DREI_INTERN` ist damit gegenstandslos.
Sie steht noch inaktiv und ohne Zimmer in der Datenbank und kann in der
Zimmerartenverwaltung gelöscht werden. Im Seed ist sie entfernt.

Öffentlich buchbar sind genau drei Kategorien:

| Code | Name | Belegung | Zimmer |
| --- | --- | --- | --- |
| `EZ` | Einzelzimmer | 1 | 7 |
| `DZ` | Doppelzimmer | 2 | 6 |
| `DZS` | Doppelzimmer mit Schlafsofa | 2 bis 4 | 4 |

### Zimmerverteilung

Vom Betreiber am 03.10.2026 endgültig festgelegt:

| Kategorie | Zimmer |
| --- | --- |
| Einzelzimmer | 11, 12, 14, 17, 18, 19, 20 |
| Doppelzimmer | 15, 16, 23, 25, 27, 28 |
| Doppelzimmer mit Schlafsofa | 21, 22, 24 (je 4 Personen), 26 (3 Personen) |

**Zimmer 17 und 18** waren zunächst als Doppelzimmer mit nur einem Einzelbett
geführt und brauchten dafür eine Ausnahme. Der Betreiber hat klargestellt, dass
es echte Einzelzimmer sind. Damit entfällt jede Sonderlogik: beide liegen in der
Kategorie `EZ`, tragen `EINZELBETT` und `maxOccupancy = 1`.

`Room.maxOccupancy` begrenzt die Belegung pro physischem Zimmer. Deshalb kann
Zimmer 26 (3 Betten) keiner Buchung für 4 Personen zugewiesen werden, obwohl die
Kategorie bis 4 Personen erlaubt.

### Ausstattung

Die Tabellen `amenity` und `roomTypeAmenity` wurden mit `hotel_pms_v2` entfernt
und mit `room_presentation` wieder eingeführt, weil die Merkmale auf der
Zimmerkarte einzeln erscheinen sollen. Fließtext in `RoomType.description` ließe
sich dafür nicht einheitlich darstellen.

Angelegt ist ausschließlich, was der Betrieb selbst angibt. Auf
altertelegraf.at/zimmer steht für alle Zimmer: „Wlan, SAT / TV, Klima, Bad / Wc,
Föhn“. Diese fünf Merkmale sind allen drei Kategorien zugeordnet. Der Zimmersafe
ist dort nur für einen Teil der Zimmer erwähnt und liegt deshalb im Katalog, aber
ohne Zuordnung. Größenangaben in m² gibt es in der Quelle nicht; `sizeSqm` bleibt
leer und die Zimmerkarte zeigt die Zeile dann nicht an.

### Zimmerbilder

`roomTypeImage` speichert die Datei als `bytea` – dieselbe Lösung wie bei den
Speisekarten-PDFs. Begründung: Es sind wenige, selten geänderte Dateien. Dateien
unter `public/` wären nach jedem Deploy auf Vercel verloren, und ein zusätzlicher
Speicherdienst (Vercel Blob, S3) wäre für diese Menge nicht angemessen; im
Projekt ist auch keiner eingerichtet. Ausgeliefert werden die Bilder von
`/hotel/zimmerbild/<id>`; die Adresse trägt den Upload-Zeitstempel, damit ein
ersetztes Bild sofort sichtbar ist, obwohl die Antwort einen Tag gecacht wird.

Die Spalte `url` bleibt für extern gehostete Bilder erhalten und ist seit
`room_presentation` optional. Je Kategorie sind höchstens 20 Bilder und 6 MB je
Datei erlaubt. Geprüft wird der Dateiinhalt (JPEG, PNG, WebP), nicht der vom
Browser gemeldete Typ. Genau ein Bild ist Hauptbild; wird es gelöscht, übernimmt
automatisch das nächste.

### Stornierungsbedingungen

Fristen und Gebühren sind **Daten, keine Programmlogik**. Gepflegt werden sie
unter *Admin → Hotel → Stornobedingungen*.

Eine `CancellationRule` greift, wenn bis zur Anreise **weniger als**
`appliesFromDaysBefore` Tage verbleiben. Greifen mehrere Regeln, gilt die mit
dem kleinsten Wert – also die, die der Anreise am nächsten liegt. Greift keine,
ist die Stornierung kostenlos. Damit lässt sich sowohl eine einfache Frist als
auch eine Staffel abbilden, ohne den Code zu ändern.

Aktiv ist die Richtlinie `STANDARD`: kostenlos bis 3 Tage vor Anreise, danach
100 %, Nichtanreise 100 %. Die Nichtanreise hängt an keiner Frist und steht
deshalb als `noShowFeePercent` an der Richtlinie selbst.

Bei jeder Buchung wird der zu diesem Zeitpunkt gültige Stand in
`Booking.cancellationPolicySnapshot` eingefroren: Regeln, Nichtanreisegebühr,
letzter kostenfreier Tag und der Text für den Gast. Eine spätere Änderung der
Hotelrichtlinie berührt bestehende Buchungen deshalb nicht. Der Admin zeigt im
Buchungsdetail diesen Schnappschuss, nicht die aktuell aktive Richtlinie.

Gerechnet wird in der Zeitzone des Hotels (`Hotel.timezone`, Europe/Vienna) –
ob eine Frist abgelaufen ist, entscheidet der Kalender vor Ort und nicht die
Zeitzone des Gastes. Die Berechnung liegt in `lib/hotel/cancellation.ts` und
ist frei von Datenbankzugriffen, damit sie vollständig testbar bleibt und
später die Karten-Garantie dieselbe Grundlage verwenden kann.

### Frühstück

Frühstück hängt nicht mehr an der Zimmerkategorie, sondern am Rate Plan
(`RatePlan.mealPlan`). Angelegt sind `STANDARD_OHNE_FRUEHSTUECK` (`ROOM_ONLY`)
und `STANDARD_MIT_FRUEHSTUECK` (`BREAKFAST`). `HALF_BOARD` und `FULL_BOARD` sind
im Schema vorgesehen, aber nicht angelegt. Das Feld `RoomType.breakfastIncluded`
existiert noch aus V1 und steht auf `false`; es wird nicht mehr ausgewertet.

### Deposit-Felder

`booking.depositDue` und `booking.depositPaidAt` stammen aus V1 und wurden
bewusst erhalten, obwohl der erste Migrationsentwurf sie löschen wollte. Über
ihren Verbleib wird später in einer eigenen Migration entschieden.

### Zahlung

Standard ist `PAY_AT_HOTEL`. Optional ist eine Kartengarantie über einen externen
Anbieter vorgesehen. In der Datenbank liegen ausschließlich Referenzen des
Anbieters (`paymentProvider`, `paymentCustomerRef`, `paymentMethodRef`),
**niemals** Kartendaten.

## Seed

```bash
node scripts/seed-hotel.mjs --dry-run   # zeigt nur an, was passieren würde
node scripts/seed-hotel.mjs             # legt an bzw. aktualisiert
```

Der Seed ist idempotent: Er sucht jeden Datensatz über seinen fachlichen
Schlüssel (`hotelId` + `code` bzw. `hotelId` + `number`) und legt nur Fehlendes
an. Er erwartet einen bereits vorhandenen Hoteldatensatz und legt kein zweites
Hotel an. Angelegt werden vier Zimmerarten (drei öffentliche plus die interne),
17 physische Zimmer und zwei Rate Plans.
