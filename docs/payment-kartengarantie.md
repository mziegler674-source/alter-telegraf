# Kreditkartengarantie – Entscheidungsgrundlage

Stand 04.10.2026. Dieses Dokument hält die Providerentscheidung und die
geplante Architektur fest, **bevor** Code entsteht.

## Ausgangslage im Projekt

Im Projekt ist **kein Payment-Provider eingerichtet**. Geprüft wurde:

- keine Abhängigkeit in `package.json` (kein Stripe, Mollie, Adyen, PayPal)
- keine Zugangsdaten in `.env` oder `.env.local`
  (vorhanden sind nur `DATABASE_URL`, `AUTH_SECRET`, `RESEND_*`)

Die Datenbank ist dagegen bereits vorbereitet. `Booking` trägt
`paymentStatus`, `paymentMethod`, `paymentProvider`, `paymentCustomerRef`,
`paymentMethodRef`, `paymentAuthorizedAt`, `paymentChargedAt`, dazu
`depositDue` und `depositPaidAt`; `RatePlan` trägt `cardGuaranteeRequired`.
**Für die Kartengarantie ist kein Schemaumbau nötig.**

## Anforderungen

| Anforderung | Begründung |
| --- | --- |
| Kreditkarten, EUR, Österreich | Standort des Betriebs |
| Tokenisierung | Kartendaten dürfen den eigenen Server nie erreichen |
| Hinterlegen für spätere Belastung | Garantie, nicht Sofortzahlung |
| Belastung zu einem späteren Zeitpunkt | Stornogebühr, Nichtanreise |
| Freigabe ohne Belastung | fristgerechte Stornierung |
| Webhooks mit Signatur | Statusänderungen müssen autoritativ vom Anbieter kommen |
| SCA / PSD2 | gesetzlich verpflichtend im EWR |
| Auftragsverarbeitungsvertrag | DSGVO |

## Vergleich

**Stripe** erfüllt alle Punkte. SetupIntent zum Hinterlegen der Karte,
off-session-Belastung über PaymentIntent, signierte Webhooks, SCA über
3D Secure, EUR und Österreich, AVV und EU-Rechenzentren vorhanden. Die REST-API
ist ohne zusätzliche Abhängigkeit per `fetch` ansprechbar, die
Signaturprüfung mit `node:crypto` nachbaubar. Gute Testumgebung mit Testkarten,
auch für fehlgeschlagene Autorisierung und SCA-Abfragen.

**Mollie** ist in Europa stark und günstig, kann Karten hinterlegen und später
belasten. Die Unterstützung für Autorisierung und spätere Belastung ist bei
Karten jedoch eingeschränkter als bei Stripe, und die Testwerkzeuge für
Kartenszenarien sind weniger ausgereift.

**Adyen** kann fachlich alles und ist im Hotelbereich verbreitet, verlangt aber
einen aufwendigeren Vertrags- und Einrichtungsprozess. Für ein Haus mit
17 Zimmern ist das unverhältnismäßig.

## Entscheidung

**Stripe**, umgesetzt hinter einer eigenen Schnittstelle
(`lib/hotel/payment/provider.ts`), sodass der Anbieter später austauschbar
bleibt. Die Buchungslogik kennt nur diese Schnittstelle, nicht Stripe.

## Wichtig: Garantie ist keine Autorisierung

Eine klassische Kartenautorisierung (ein Hold) **verfällt bei Kreditkarten
nach rund sieben Tagen**. Eine Buchung liegt oft Wochen oder Monate in der
Zukunft. Ein Hold ist für eine Hotelgarantie deshalb untauglich.

Richtig ist: Die Karte wird über einen **SetupIntent** hinterlegt und für die
spätere Nutzung freigegeben. Belastet wird erst dann, wenn die gespeicherte
Stornierungsbedingung es hergibt. Das passt genau zu den vorhandenen Feldern
`paymentCustomerRef` und `paymentMethodRef`.

Abbildung auf den vorhandenen `payment_status`:

| Zustand | Wert |
| --- | --- |
| Zahlung vor Ort, keine Karte nötig | `NOT_REQUIRED` |
| Karte angefragt, noch nicht bestätigt | `PENDING` |
| Karte hinterlegt und bestätigt | `VERIFIED` |
| echter Hold, falls später gewünscht | `AUTHORIZED` |
| Stornogebühr belastet | `CHARGED` |
| Karte abgelehnt | `FAILED` |
| Garantie aufgehoben | `CANCELLED` |

`paymentMethod` wechselt dabei von `PAY_AT_HOTEL` auf `CARD_GUARANTEE`.
Der **Buchungsstatus bleibt davon unberührt** – eine Zahlung ersetzt keinen
Buchungsstatus.

## Geplanter Ablauf

1. Gast wählt Zimmer, Frühstück, gibt seine Daten ein und sieht Preis und
   Stornobedingungen.
2. Verlangt der Rate Plan eine Garantie (`cardGuaranteeRequired`), fordert der
   Server beim Anbieter einen SetupIntent an und gibt nur dessen
   Client-Secret an die Seite.
3. Die Karte wird **ausschließlich im Browser** in ein Feld des Anbieters
   eingegeben. Kartennummer und Prüfziffer erreichen unseren Server nie.
4. Der Anbieter bestätigt die Karte, nötigenfalls mit 3D Secure.
5. Die Buchung wird angelegt, sobald die Karte bestätigt ist. Scheitert die
   Bestätigung, entsteht **keine** Buchung.
6. Der Webhook des Anbieters ist maßgeblich für jede weitere
   Statusänderung.

Belastet wird nur anhand des **eingefrorenen Schnappschusses** der Buchung
(`cancellationPolicySnapshot`) über `calculateCancellationFee`. Stellt der
Betrieb später auf 7 Tage / 50 % um, arbeitet die Belastung automatisch mit der
Regel, die für die jeweilige Buchung gespeichert ist. Feste Werte stehen
nirgends im Code.

## Was wir speichern – und was nicht

Gespeichert werden ausschließlich: `paymentProvider` (`"stripe"`),
`paymentCustomerRef` (Kundenkennung des Anbieters), `paymentMethodRef`
(Kennung der hinterlegten Karte), `paymentStatus`, `paymentAuthorizedAt`,
`paymentChargedAt`.

**Niemals gespeichert**: Kartennummer, Prüfziffer, vollständiges
Ablaufdatum, Karteninhaber. Für die Anzeige im Admin genügen Kartenmarke und
die letzten vier Stellen – beides liefert der Anbieter als eigene Felder und
beides wäre, falls gewünscht, ein eigener kleiner Migrationsschritt.

## Umgesetzter Stand

| Baustein | Datei |
| --- | --- |
| Schnittstelle zum Anbieter | `lib/hotel/payment/provider.ts` |
| Stripe-Anbindung | `lib/hotel/payment/stripe.ts` |
| Signatur- und Ereignisprüfung | `lib/hotel/payment/stripe-webhook.ts` |
| Einrichtung und Schutz vor Live-Schlüsseln | `lib/hotel/payment/index.ts` |
| Garantie, Belastung, Freigabe | `lib/hotel/payment/guarantee.ts` |
| Kartenerfassung starten | `app/api/hotel/zahlung/setup/route.ts` |
| Webhook | `app/api/zahlung/webhook/route.ts` |
| Kartenfeld im Browser | `components/hotel/CardGuarantee.tsx` |

Die Anwendung bindet keine Stripe-Bibliothek ein. Die REST-API wird mit
`fetch` angesprochen, die Signatur mit `node:crypto` geprüft. Das hält die
Abhängigkeiten klein und macht nachvollziehbar, was übertragen wird.

Ohne die drei Umgebungsvariablen ist die Garantie **abgeschaltet**: Die
Buchungsstrecke läuft dann unverändert mit Zahlung vor Ort. Ein
Live-Schlüssel wird abgewiesen, solange `STRIPE_ALLOW_LIVE` nicht gesetzt
ist.

## Offen, bevor implementiert werden kann

1. **Stripe-Konto** des Betriebs (oder Freigabe, eines anzulegen).
2. **Testschlüssel**: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
   `STRIPE_WEBHOOK_SECRET` – ausschließlich Testmodus.
3. Entscheidung, **für welche Rate Plans** eine Garantie gelten soll. Aktuell
   steht `cardGuaranteeRequired` bei beiden auf `false`, die Garantie wäre
   also für niemanden aktiv.
4. Klärung, ob die Karte **nur hinterlegt** oder zusätzlich kurz vor Anreise
   geprüft werden soll.
