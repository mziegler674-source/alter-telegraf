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

### Spätere Schemaänderungen

| Migration | Inhalt |
| --- | --- |
| `20261010T2149_email_log` | Tabelle `public.emailLog` für das Versandprotokoll. Vier Operationen, alle additiv. |
| `20261010T2226_promotion_rules_and_room_blocks` | `promotion`: `discountAmount`, `maxStayNights`, `arrivalTo`, `departureFrom` plus drei Check-Constraints. Neue Tabelle `hotel.roomBlock`. Zwölf Operationen, alle additiv. |
| `20261011T0719_promotion_requires_code` | `promotion.requiresCode` (Boolean, Standard `false`). Eine Operation, additiv. |
| `20261011T0758_channel_mapping_and_sync_jobs` | Neue Tabellen `hotel.channelMapping` und `hotel.syncJob`. 15 Operationen, alle additiv. |

Beide Migrationen sind rein additiv: Es wurde keine Spalte entfernt, kein Typ
geändert und keine Zeile angetastet.

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
- **`.where(...).delete()` entfernt nur EINE Zeile, nicht alle Treffer.** Im
  Kontrollversuch (drei gleichartige Zeilen, ein `delete()`) blieben zwei
  übrig. Löschungen über einen Filter müssen deshalb zeilenweise erfolgen.
  Betroffen ist `app/api/admin/hotel/ausstattung/zuordnung/route.ts`: Dort
  sollen vor dem Neuschreiben alle Zuordnungen einer Zimmerart entfernt
  werden, tatsächlich verschwindet nur eine. Alle übrigen `delete()`-Aufrufe
  im Projekt filtern über `id` und sind damit eindeutig.

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

### Physische Verfügbarkeit

Bis zur Einführung des Kalenders wurde **je Kategorie** gezählt: Zimmer der
Kategorie minus Buchungen der Kategorie. Das ist falsch, sobald die Zimmer
einer Kategorie unterschiedlich viele Personen tragen.

Beispiel aus dem Haus: Das Dreibettzimmer-Superior hat drei Zimmer für vier
Personen (21, 22, 24) und eines für drei (26). Lag eine Dreierbuchung ohne
Zimmerzuweisung vor, zog die alte Rechnung sie von den Vierbett-Plätzen ab und
bot nur noch zwei statt drei Viererzimmer an. Es wurde also **zu wenig**
verkauft – nie zu viel.

`lib/hotel/allocation.ts` beantwortet stattdessen die Frage, die das Haus beim
Zuweisen tatsächlich löst: Lassen sich alle bestehenden Belegungen **und** die
neue Anfrage auf verschiedene, geeignete Zimmer verteilen? Geprüft wird mit
einer Suche mit Rückverfolgung über Kapazität, Bettart, Zeitraum und Sperren.
Bei 17 Zimmern ist das winzig; eine Obergrenze an Schritten schützt dennoch
vor Ausreißern. Läuft die Suche in diese Grenze, lautet die Antwort „nicht
belegbar“ – im Zweifel wird eher zu wenig angeboten als zu viel.

Bewusste Vereinfachung: Belegungen, die den gefragten Zeitraum berühren,
müssen verschiedene Zimmer bekommen, auch wenn zwei von ihnen sich
untereinander nicht überschneiden. Das kann in seltenen Fällen ein Zimmer zu
wenig anbieten, nie eines zu viel.

Buchungsstrecke und Kalender verwenden dieselbe Quelle: `loadDemands` liest
`BookingRoom`, `loadBlocks` liest `RoomBlock`. Der Kalender führt keine eigenen
Belegungsdaten.

Die Frage „wie viele Zimmer einer Kategorie sind an einem Tag frei“ beantwortet
ausschließlich `inventoryForRange` in `lib/hotel/inventory.ts`. Kalender und
Kanalsynchronisierung rufen dieselbe Funktion auf – zu Vertriebskanälen siehe
`docs/booking-com-integration.md`.

Die Absicherung gegen gleichzeitige Doppelbuchungen bleibt unverändert: Die
Zeilensperre auf der Hotelzeile serialisiert konkurrierende Buchungsversuche,
und die Verfügbarkeit wird unter dieser Sperre erneut geprüft.

### Rabattaktionen

Es gibt **eine** Rabattlogik: `lib/hotel/promotions.ts`. Auch die
Langzeitrabatte laufen darüber – sie sind gewöhnliche Aktionen vom Typ `BASIC`
mit einem Mindestaufenthalt und dem Code `LONGSTAY_<Nächte>`.

**Regel:** Es wirkt immer genau **eine** Aktion, nie mehrere zusammen. Von
allen zulässigen gewinnt die für den Gast günstigste; bei Gleichstand die mit
der kleineren ID. Rabatte addieren sich damit nie unkontrolliert, und bei
gleicher Lage kommt immer dasselbe Ergebnis heraus.

Reihenfolge der Berechnung, eindeutig und in dieser Folge:

1. Zimmerpreis = Preis pro Nacht × Nächte
2. abzüglich Rabatt – immer nur auf den Zimmerpreis
3. zuzüglich Frühstück – nie rabattiert

Ein Prozentsatz wirkt auf den Zimmerpreis, ein Festbetrag einmal je
Aufenthalt. Mehr als den Zimmerpreis kann kein Rabatt ausmachen.

`quoteOffer` in `lib/hotel/booking-service.ts` ist die einzige Stelle, an der
ein Aufenthaltspreis entsteht. Die Buchungsstrecke und die Vorschau im Admin
rufen sie gleichermaßen auf – eine Vorschau kann deshalb nicht von der
tatsächlichen Buchung abweichen.

Der Preis einer abgeschlossenen Buchung liegt in `Booking` und in
`BookingRoomNight` fest. Ändert oder löscht der Betrieb eine Aktion später,
bleibt er unverändert; das ist getestet.

**Zwei Editoren, eine Tabelle:** Die Langzeitstaffel wird weiterhin unter
„Preise“ gepflegt. Unter „Promotions“ erscheint sie, lässt sich dort aber nur
aktivieren oder deaktivieren. Zwei Editoren für dieselbe Zeile wären eine
Fehlerquelle.

### Aktionscodes

Eine Aktion wirkt entweder automatisch oder nur mit Code. Das entscheidet
`Promotion.requiresCode`:

- **ohne** Kennzeichen: Die Aktion greift für jeden passenden Aufenthalt –
  so verhalten sich die Langzeitrabatte.
- **mit** Kennzeichen: Die Aktion greift ausschließlich, wenn der Gast ihren
  Code in der Buchungsstrecke eingibt.

Das Kennzeichen war nötig, weil sonst jede angelegte Aktion automatisch für
alle gilt und ein Code gar nichts einschränken würde.

**Die Regel, wenn Code und automatische Aktion zusammentreffen:**

1. Ohne Code gilt die beste automatische Aktion.
2. Ein eingegebener Code wird **serverseitig** gegen alle Bedingungen
   geprüft: aktiv, Buchungsfenster, Anreise- und Abreisefenster, Mindest- und
   Maximalaufenthalt, Vorlauf, Zimmerart, Rate Plan, Kanal und Rabattwert.
   Ein Code wird nie allein aufgrund seines Namens akzeptiert.
3. Gilt der Code, wird er mit der besten automatischen Aktion verglichen. Es
   gewinnt die für den Gast **günstigere**; bei Gleichstand der Code.
4. Verliert der Code, wird er **nicht stillschweigend verworfen**: Der Status
   lautet `OUTPERFORMED`, und die Preisübersicht nennt die Aktion, die
   stattdessen gilt.

Es wirkt weiterhin immer genau eine Aktion; Code und automatische Aktion
addieren sich nicht.

Die Rückmeldung an den Gast hat fünf Zustände: `NONE`, `APPLIED`, `UNKNOWN`,
`NOT_APPLICABLE` (mit Begründung) und `OUTPERFORMED`. Damit auch der Code
einer **abgeschalteten** Aktion die ehrliche Begründung bekommt, lädt
`loadPromotions` bewusst auch inaktive Aktionen – ob eine greift, entscheidet
allein `checkPromotion`.

Der Code wird bei **jeder** Suche mitgeschickt. Ändern sich Reisedaten,
Verpflegung oder Zimmerart, wird die Berechtigung dadurch automatisch neu
geprüft. Beim Anlegen der Buchung läuft dieselbe Prüfung ein letztes Mal;
Preisangaben aus dem Browser werden nie übernommen. Die Kartengarantie
hinterlegt nur die Karte (SetupIntent, ohne Betrag) – eine Belastung richtet
sich ausschließlich nach dem gespeicherten Betrag der Buchung und ihrem
eingefrorenen Storno-Schnappschuss.

### Zimmerzuweisung

Welche physischen Zimmer für eine Buchungsposition in Frage kommen,
entscheidet der Server und liefert sie als `assignableRoomIds` mit. Die
Oberfläche zeigt nur diese Liste; ist sie leer, erscheint „Kein geeignetes
Zimmer verfügbar“.

Geprüft wird mit `assignmentProblem` in `lib/hotel/allocation.ts` – für den
**gesamten** Aufenthalt. Ein Zimmer, das auch nur für eine Nacht belegt oder
gesperrt ist, fällt heraus. Berücksichtigt werden Kategorie, maximale
Belegung, Bettart, Zimmerstatus (`OUT_OF_SERVICE`), aktive Sperren und alle
nicht stornierten Buchungen. Der Abreisetag zählt nicht als Nacht.

Das aktuell zugewiesene Zimmer bleibt wählbar: Die eigene Position wird bei
der Prüfung übersprungen.

Dieselbe Prüfung läuft beim Speichern erneut, und zwar **unter der
Zeilensperre auf der Hotelzeile**. Eine im Browser eingeschmuggelte Option
wird deshalb abgewiesen, und zwei gleichzeitige Zuweisungen auf dasselbe
Zimmer können sich nicht überholen – die zweite scheitert mit einer Meldung,
die die belegende Buchung nennt. Das ist mit zwei parallelen Anfragen
getestet.

### Zimmersperren

`RoomBlock` sperrt ein physisches Zimmer für einen Zeitraum, etwa für Wartung.
`endDate` ist exklusiv wie der Abreisetag einer Buchung. Eine Sperre wirkt wie
eine Belegung: Das Zimmer steht der Online-Buchung nicht zur Verfügung – nicht
bloß optisch im Kalender.

Ein belegtes Zimmer lässt sich nicht sperren, und zwei Sperren dürfen sich
nicht überschneiden. Beides weist der Server ab.

`Room.status = OUT_OF_SERVICE` bleibt die **dauerhafte** Variante ohne
Zeitraum; sie schließt das Zimmer unabhängig von Sperren aus.

### Kalender

Zwei Ansichten, beide mit echten Daten:

- **Physische Zimmer**: eine Zeile je Zimmer, eine Spalte je Tag. Status pro
  Tag über `dayStatus`: frei, belegt, Anreise, Abreise, gesperrt, außer
  Betrieb. Der **Abreisetag zählt nicht** als belegte Nacht. Fällt eine Abreise
  mit einer Anreise zusammen, wiegt die Anreise schwerer.
- **Zimmerkategorien**: freie Zimmer je Kategorie und Tag, mit Anreisen,
  Abreisen, Sperren und offenen Buchungen getrennt gezählt.

Buchungen **ohne** Zimmerzuweisung stehen in einer eigenen Liste, nicht in
einer Zimmerzeile. Es wird kein Zimmer erfunden, das das Haus nicht vergeben
hat.

Farbe ist nie das einzige Unterscheidungsmerkmal: Jede Zelle trägt zusätzlich
ein Zeichen (· frei, ▶ Anreise, ● belegt, ◀ Abreise, ✕ gesperrt, — außer
Betrieb) und einen Tooltip mit Datum, Status und – bei einer Belegung –
Buchungsnummer, Gast und Zeitraum; dazu gibt es eine Legende.

Zum Raster: waagrechte und senkrechte Zellgrenzen, abwechselnd hinterlegte
Zimmerzeilen, Datumskopf mit Wochentag, Tageszahl und Monatskürzel, der
heutige Tag hervorgehoben, Wochenenden dezent getönt. Beide Achsen scrollen
in einem Behälter: Die Zimmerspalte bleibt waagrecht stehen, der Datumskopf
senkrecht. Innerhalb einer mehrnächtigen Belegung entfällt die senkrechte
Linie, sodass ein zusammenhängender Block entsteht; Anfang und Ende sind
abgerundet. Die Spaltenbreite richtet sich nach dem Zeitraum (Woche breit,
Monat schmal), damit Zimmernummern und Daten lesbar bleiben.

Angezeigt werden Buchungsnummer, Gast, Zeitraum, Personen, Kategorie,
zugewiesenes Zimmer, Status, Frühstück, Gesamtpreis und die Zahlungsart.
**Keine** Zahlungsreferenzen und keine Kartendaten.

Der abgefragte Zeitraum ist auf 62 Tage begrenzt, damit keine unnötig großen
Abfragen entstehen. Die Zusatzangaben zu den Belegungen werden in einer
einzigen Abfrage über alle betroffenen Buchungszimmer geladen, nicht je Zeile.

### Gäste und Meldedaten

Der Gast ist der dauerhafte Datensatz, die Buchung der Vorgang. Die
Gästeverwaltung schreibt ausschließlich in `hotel.guest` – eine Änderung der
Stammdaten berührt gespeicherte Buchungssummen und eingefrorene Vertragsdaten
nicht. `BookingRoom.guestName` bleibt der historische Name zum
Buchungszeitpunkt.

Bei einer Buchung wird ein bestehender Gast über die E-Mail-Adresse
wiederverwendet; fehlt er, wird er angelegt. Mehrere Buchungen desselben
Gastes laufen deshalb im Profil zusammen.

Umsatz und Aufenthaltszahl zählen nur `CONFIRMED`, `CHECKED_IN` und
`CHECKED_OUT`. Stornierungen und Nichtanreisen bleiben außen vor, sonst wäre
die Zahl irreführend.

Dubletten werden über gleiche E-Mail oder gleichen Nachnamen mit gleicher
Telefonnummer **erkannt und angezeigt**, aber nie automatisch zusammengeführt.

**Meldedaten: rechtlich noch nicht abgeschlossen.** `Guest` trägt
`birthDate`, `nationality`, `idDocumentType` und `idDocumentNo`. Diese Felder
sind in der Oberfläche als freiwillig gekennzeichnet und bleiben leer, solange
sie nicht erhoben werden. Ein **Gästeblatt nach österreichischem Meldegesetz
ist damit nicht umgesetzt**: Dafür fehlen unter anderem Geschlecht,
Unterschrift sowie An- und Abreisedatum je mitreisender Person, und es wäre ein
eigener Datensatz je Aufenthalt nötig, nicht ein Feld am Gast. Vor einer
Umsetzung ist die rechtliche Anforderung zu klären; erfunden wird hier nichts.

DSGVO: Gespeichert wird nur, was für Aufenthalt und Rechnung nötig ist. Der
Zugriff auf die Gästeverwaltung ist der Rolle `admin` vorbehalten.

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
