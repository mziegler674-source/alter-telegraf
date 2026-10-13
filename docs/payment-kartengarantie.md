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

## Phase 1: Nachweis und Absicherung

Umgesetzt wurden die fünf vorgezogenen Punkte aus dem Prüfbericht. Stripe
bleibt dabei **abgeschaltet**; es wurde keine Kartenpflicht aktiviert und
keine automatische Belastung eingerichtet.

### Zustimmungsnachweis

`lib/hotel/consent.ts` baut den Nachweis, `cancellationPolicySnapshot` der
Buchung speichert ihn:

```json
"consent": {
  "version": 1,
  "at": "2026-10-13T15:22:59.000Z",
  "terms": true,
  "privacy": true,
  "cancellation": {
    "policyCode": "STANDARD",
    "snapshotVersion": 1,
    "textHash": "…64 Hexzeichen…",
    "lineCount": 3,
    "displayConfirmed": true
  }
}
```

Festgehalten wird nicht der Wortlaut ein zweites Mal, sondern ein SHA-256
des **angezeigten** Textes. Damit lässt sich später jeder vorgelegte Text
gegen den Nachweis prüfen (`consentMatchesText`), und der Wortlaut selbst
steht ohnehin im `text` desselben Schnappschusses.

`displayConfirmed` ist der eigentliche Nachweis der Anzeige: Die
Buchungsstrecke schickt beim Absenden den Streuwert mit, den sie angezeigt
hat (`acceptedPolicyHash`). Der Server **rechnet seinen eigenen** aus dem
eingefrorenen Text und vergleicht. Stimmen sie nicht überein, wurden die
Bedingungen zwischen Anzeige und Absenden geändert: Dann entsteht **keine**
Buchung, sondern `409` mit `details.policyChanged` und dem neuen Wortlaut –
derselbe Gedanke wie beim Preisvergleich über `expectedTotal`.

**Warum im vorhandenen JSON-Feld und nicht in einer eigenen Tabelle?** Eine
eigene Tabelle wäre der bessere Ort. Sie braucht aber eine Änderung am
Contract, und der Laufzeit-Marker wird bei jeder Abfrage geprüft
(`verifyMarker`): Ein geänderter Contract ohne angewendete Migration macht
die gesamte Anwendung unbrauchbar. Angewendet werden kann die Migration
derzeit nicht, weil die einzige `DATABASE_URL` auf die Produktionsdatenbank
zeigt und dort nichts geschrieben werden darf. Der Nachweis liegt deshalb im
bestehenden `Json`-Feld derselben Buchung – fachlich gehört er dorthin, denn
er bezieht sich genau auf die dort eingefrorenen Bedingungen.

**Bestehende Buchungen bleiben ohne Nachweis.** Es wird nichts nachgetragen:
Ein Schnappschuss ohne `consent` bedeutet, dass keine Zustimmung belegt ist.
`readConsentRecord` liefert dafür `null`.

**Grenze:** Ist für einen Tarif **keine** Stornorichtlinie hinterlegt, gibt
es keinen Schnappschuss – und damit auch keinen Nachweis, obwohl der Gast
beide Haken gesetzt hat. Mit der aktuellen Konfiguration tritt der Fall
nicht ein (beide Tarife verweisen auf Policy `STANDARD`). Sauber behoben
wird er erst mit der eigenen Tabelle.

### Zuordnung der Kartenhinterlegung

Drei Riegel, alle serverseitig:

1. `confirmCardSetup` nimmt nur Kennungen der Form `seti_…` an. Alles andere
   erreicht Stripe nicht einmal – vorher wurde die Eingabe des Browsers in
   den Anfragepfad gesetzt.
2. `verifyCardSetup(ref, { email })` vergleicht die E-Mail, die **Stripe**
   am Kunden führt, mit der E-Mail der Buchung. Weicht sie ab: `409`. Liefert
   Stripe keine Adresse, wird die Karte **nicht** übernommen, statt sie
   ungeprüft zu glauben.
3. `assertCardNotReused` weist eine Zahlungsmethode ab, die schon an einer
   anderen wirksamen Buchung hängt (`PENDING`, `CONFIRMED`, `CHECKED_IN`).
   Grund: Die Freigabe löst die Methode beim Anbieter vollständig; an zwei
   Buchungen würde die zweite unbemerkt ihre Garantie verlieren.

Die Prüfung auf Wiederverwendung steht **nach** der Wiederholungserkennung
in der Transaktion. Ein zweites Absenden derselben Buchung ist dort schon
beantwortet und läuft nicht in den Riegel – legitime Wiederholungen
funktionieren weiter. Die Entscheidung selbst liegt als reine Funktion
`cardIsReused` getrennt von der Abfrage und ist damit ohne Datenbank
prüfbar.

### Missbrauchsschutz des Setup-Endpunkts

`lib/rate-limit.ts` zählt in festen Zeitfenstern im Arbeitsspeicher.
`/api/hotel/zahlung/setup` ist damit zweifach begrenzt:

| Merkmal | Grenze |
| --- | --- |
| Aufrufer (`x-forwarded-for`, sonst `x-real-ip`) | 10 Versuche je 10 Minuten |
| E-Mail-Adresse | 5 Versuche je 10 Minuten |

Das Aufrufer-Limit zählt **vor** dem Aufruf bei Stripe – ein abgewiesener
Versuch darf dort keinen Kunden anlegen. Das Adress-Limit zählt **nach** der
Prüfung der Eingaben, damit ein Tippfehler im Formular kein Guthaben
verbraucht. Bei Überschreitung: `429`, `Retry-After` in der Kopfzeile, und
eine Meldung, die auf die Telefonnummer des Hotels verweist, ohne
Zählerstände zu verraten.

Gespeichert wird nie eine IP-Adresse oder eine E-Mail, sondern ein auf 32
Zeichen gekürzter HMAC-SHA256 mit `AUTH_SECRET`. Ohne das Geheimnis lässt
sich daraus nichts zurückrechnen und keine Adressliste abgleichen; Einträge
verfallen mit dem Fenster.

**Grenzen, die zur Bewertung gehören:** Das ist **kein globales** Limit.
Läuft die Anwendung auf mehreren Instanzen – auf Vercel der Normalfall –,
zählt jede für sich. Ein Neustart setzt die Zähler zurück, und viele
Adressen umgehen das Aufrufer-Limit. Es bremst den naheliegenden Fall, nicht
einen entschlossenen Angriff.

### Preis der ersten Nacht

`chargeDecision` übergab bisher den **Gesamtbetrag** als Preis der ersten
Nacht. Mit der aktuellen Richtlinie (`PERCENT_OF_TOTAL`) blieb das
wirkungslos; eine `FIRST_NIGHT`-Regel hätte den ganzen Aufenthalt
verrechnet.

Jetzt wird zuerst die anzuwendende Regel bestimmt. Nur wenn sie
`FIRST_NIGHT` ist, liest `firstNightAmountOf` die früheste
`BookingRoomNight` der Buchung – bei mehreren Zimmern die Summe der ersten
Nächte, denn mehrere Zimmer sind mehrere erste Nächte. Fehlen die
Nachtpreise, wird **nicht** belastet: Die Entscheidung lautet dann
`allowed: false` mit einer nachvollziehbaren Begründung.

### Stornobedingungen mit Datum und Betrag

`previewCancellation` in `lib/hotel/cancellation.ts` rechnet serverseitig
aus der geltenden Regel und dem tatsächlichen Preis:

- `freeUntilDate` – der letzte kostenfreie Tag,
- `feeAmount` – was eine Stornierung am Tag danach kostet,
- `noShowAmount` – was bei Nichtanreise anfällt.

Gerechnet wird mit `calculateCancellationFee`, also genau so, wie später
abgerechnet wird. Die Regel selbst bleibt unverändert; es kommt nur eine
Darstellung hinzu. Jedes Angebot der Suche trägt die Vorschau für **seinen**
Preis, die erste Nacht kommt aus den aufgelösten Nachtpreisen. Die
Buchungsstrecke zeigt sie vor dem Absenden und rechnet nichts nach.

Ist die erste Nacht unbekannt und bräuchte die Regel sie, bleibt
`feeAmount` leer – es wird kein Betrag unterstellt.

Die Beschriftung des Hakens nennt jetzt auch die Stornobedingungen. Wer
Zustimmung dazu festhält, muss sie auch abfragen.

## Aktivierung im Testmodus

### Umgebungsvariablen

In `.env.local` (nicht in Git, `.gitignore` deckt `.env*` ab):

| Variable | Woher |
| --- | --- |
| `STRIPE_PUBLISHABLE_KEY` | Stripe-Dashboard, Testmodus, `pk_test_…` |
| `STRIPE_SECRET_KEY` | Stripe-Dashboard, Testmodus, `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | Ausgabe von `stripe listen`, `whsec_…` |
| `STRIPE_ALLOW_LIVE` | **bleibt ungesetzt** |

`lib/hotel/payment/index.ts` weist einen `sk_live_`-Schlüssel ab, solange
`STRIPE_ALLOW_LIVE` nicht ausdrücklich auf `true` steht. Das ist ein Riegel
gegen Unfälle, keine Einstellung für den Betrieb.

### Webhook lokal prüfen

Die Stripe CLI leitet die Ereignisse des Testkontos an den lokalen Server
weiter. Sie ist in diesem Projekt **nicht** installiert; Installation und
Anmeldung erfolgen am eigenen Rechner:

```bash
winget install Stripe.StripeCLI   # oder: choco install stripe-cli
stripe login                      # öffnet den Browser, bestätigt das Konto
stripe listen --forward-to localhost:3000/api/zahlung/webhook
```

`stripe listen` gibt beim Start ein Geheimnis in der Form `whsec_…` aus. Es
gehört als `STRIPE_WEBHOOK_SECRET` in `.env.local`; danach muss `next dev`
neu gestartet werden, weil die Umgebung beim Start gelesen wird.

Ereignisse auslösen, ohne durch die Buchungsstrecke zu gehen:

```bash
stripe trigger setup_intent.succeeded
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
```

Im Dashboard des Testkontos darf **kein** Endpunkt auf eine öffentliche
Adresse zeigen; `stripe listen` braucht keinen. Der produktive Webhook wird
davon nicht berührt.

### Einstellungen im Stripe-Dashboard

1. **Testmodus** eingeschaltet lassen.
2. Unter *Einstellungen → Zahlungsmethoden* für das Testkonto alles außer
   **Karten** abschalten. Grund siehe unten: Die Zahlungsarten eines
   SetupIntent kommen inzwischen aus dem Konto, nicht mehr aus dem Code.

### Was die aktuelle Stripe-API geändert hat

Zwei Dinge sind beim ersten echten Lauf gegen den Testmodus aufgefallen –
beide hätten im Betrieb gestört:

1. **`payment_method_types` wird abgelehnt.** Die API-Version dieses Kontos
   antwortet: „The `payment_method_types` parameter is no longer supported.
   Payment methods are now managed from your Dashboard settings." Der
   SetupIntent wird deshalb jetzt mit
   `automatic_payment_methods[enabled]=true` und
   `allow_redirects=never` angelegt. Letzteres hält Verfahren mit
   Weiterleitung heraus – eine Garantie soll den Gast nicht aus der
   Buchungsstrecke führen.

   Damit könnte das Konto grundsätzlich auch andere Zahlungsarten anbieten.
   Darauf verlassen wir uns nicht: `confirmCardSetup` liest die Art der
   hinterlegten Methode mit und **nimmt nur `card` an**. Alles andere gilt
   als nicht hinterlegt, es entsteht keine Buchung mit vermeintlicher
   Garantie. Im Browser steht die Karte zusätzlich an erster Stelle
   (`paymentMethodOrder`).

2. **Eine unbekannte Kennung ist kein Störfall.** Vorher warf jede
   unbekannte `seti_`-Kennung einen `PaymentError`, aus dem ein `502`
   wurde – als läge es am Anbieter. Jetzt liefert `callOptional` bei
   `resource_missing` ein `null`, und der Gast bekommt die zutreffende
   Antwort `400` („Die Karte wurde nicht bestätigt"). Echte Störungen des
   Anbieters werfen weiterhin.

Kunde und Zahlungsmethode werden jetzt in **einem** Aufruf mitgeladen
(`expand[]=customer&expand[]=payment_method`) statt in zwei.

### Was im Testmodus tatsächlich geprüft wurde

`scratchpad/test-stripe-echt.mjs` spricht mit `api.stripe.com` und bricht ab,
wenn der Schlüssel kein `sk_test_` ist oder Stripe `livemode: true` meldet.
Verwendet werden ausschließlich die offiziellen Test-Zahlungsmethoden
(`pm_card_visa`, `pm_card_authenticationRequiredOnSetup`,
`pm_card_chargeDeclined`, `pm_card_chargeCustomerFail`) – keine
Kartennummern im Code. Die angelegten Testkunden werden am Ende des Laufs
wieder gelöscht.

**Unsere Datenbank wird dabei nicht berührt.** Es entsteht keine Buchung und
keine Zeile; geprüft wird die Anbieterschicht gegen den echten Dienst.

## Offen, bevor implementiert werden kann

1. ~~**Stripe-Konto** des Betriebs.~~ Vorhanden, Testmodus geprüft.
2. **Testschlüssel**: `STRIPE_SECRET_KEY` und `STRIPE_PUBLISHABLE_KEY` liegen
   in `.env.local` und sind gegen den Testmodus geprüft.
   `STRIPE_WEBHOOK_SECRET` fehlt noch – es entsteht erst beim Start von
   `stripe listen`.
3. Entscheidung, **für welche Rate Plans** eine Garantie gelten soll. Aktuell
   steht `cardGuaranteeRequired` bei beiden auf `false`, die Garantie ist
   also für niemanden aktiv. Umgestellt werden kann das nur in einer
   isolierten Datenbank – in der produktiven wird nichts geändert.
4. Klärung, ob die Karte **nur hinterlegt** oder zusätzlich kurz vor Anreise
   geprüft werden soll.
5. Eine **isolierte Testdatenbank**. Ohne sie bleiben zwei Dinge offen: die
   eigene Tabelle für den Zustimmungsnachweis (Migration) und jeder
   Integrationstest, der eine Buchung anlegt.

Weiterhin **nicht** umgesetzt und ausdrücklich Phase 2 und 3: ein Weg, eine
Stornogebühr einzuziehen oder eine Nichtanreise zu vermerken, die Trennung
von `requires_action` und `FAILED`, `cardBrand`/`cardLast4`, und jede
Prüfung gegen echtes Stripe.
