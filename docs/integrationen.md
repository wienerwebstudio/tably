# Externe Integrationen: Stand und fehlende Voraussetzungen

Grundsatz: Tably behauptet keine Integration, die nicht eingerichtet ist. Jede Oberfläche zeigt den tatsächlichen Zustand (`/wallet/status`, `/billing` → `mode`, `/admin/system`).

## Übersicht

| Integration | Code | In dieser Umgebung geprüft | Für den Produktivbetrieb fehlt |
|---|---|---|---|
| NFC passiv (NTAG 424 DNA) | vollständig | Kryptografie gegen NXP-Testvektor; Abläufe mit Simulator | physische Chips, Schreibgerät, Test auf echten Geräten |
| NFC aktiv (Apple VAS / Google Smart Tap) | Backend-Schnittstelle | signierte Gerätemeldungen | Hardware, Apple-NFC-Zertifikat, Google-Smart-Tap-Freigabe |
| Apple Wallet | vollständig | Pass-Erzeugung, Signatur (OpenSSL), Webservice – mit Testzertifikat | Apple-Developer-Konto, Pass-Type-ID-Zertifikat; Test auf echtem iPhone |
| Google Wallet | vollständig | Save-JWT und REST-Client (gemockt) | Issuer-Konto mit Veröffentlichungsfreigabe, Dienstkonto; Test auf echtem Gerät |
| Stripe Billing | vollständig | Webhook-Signatur, Idempotenz, Abo-Abgleich mit signierten Testereignissen | Stripe-Konto, Produkte/Preise, Webhook-Endpunkt; Test im Stripe-Testmodus |
| E-Mail | vollständig | lokaler Testmodus (Testpostfach) | SMTP-Zugang eines Versanddienstes, SPF/DKIM für die Absenderdomain |
| Kassensysteme | generische API | idempotente Ereignisse, Zuordnung zu Taps | Anbindung konkreter Kassenhersteller |

„Vollständig“ heißt: Der Code ist geschrieben und automatisiert getestet, soweit das ohne Zugangsdaten möglich ist. Es heißt **nicht**, dass die Integration gegen den echten Dienst gelaufen ist.

## Apple Wallet

**Benötigt**

1. Apple Developer Program (kostenpflichtig).
2. Pass Type ID anlegen (z. B. `pass.de.tably.loyalty`) und dafür ein Zertifikat erzeugen.
3. Zertifikat und privaten Schlüssel als PEM exportieren, dazu das Apple-WWDR-Zwischenzertifikat (G4).
4. Variablen setzen: `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT_PEM`, `APPLE_PASS_KEY_PEM` (optional `APPLE_PASS_KEY_PASSPHRASE`), `APPLE_WWDR_CERT_PEM`.
5. `API_PUBLIC_URL` muss öffentlich per HTTPS erreichbar sein (Pass-Webservice unter `/wallet/apple/v1/…`).

**Was dann funktioniert:** Download der `.pkpass` von der Webkarte; Registrierung des Geräts; bei jeder Buchung ein stiller Push (APNs, mTLS mit dem Pass-Zertifikat), woraufhin das iPhone den aktualisierten Pass lädt. Sichtbare Mitteilungen entstehen über `changeMessage` bei geänderten Feldern (Stand, Prämie, Nachricht).

**Einschränkungen:** Das Händlerlogo wird nur als PNG in den Pass übernommen und nicht skaliert. Mehrere Händler teilen sich eine Pass Type ID des Plattformbetreibers. Standortbezogene Hinweise sind nicht umgesetzt.

**Nicht geprüft:** Verhalten auf einem echten iPhone und die APNs-Zustellung (beides braucht echte Zertifikate).

## Google Wallet

**Benötigt**

1. Google Wallet Issuer-Konto (Google Pay & Wallet Console) – Veröffentlichungsfreigabe beantragen; bis dahin funktionieren nur Testkonten.
2. Google-Cloud-Projekt mit aktivierter Google Wallet API und einem Dienstkonto, das im Issuer-Konto berechtigt ist.
3. Variablen: `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SA_EMAIL`, `GOOGLE_WALLET_SA_PRIVATE_KEY`.
4. `API_PUBLIC_URL` öffentlich erreichbar (Logo-URL der Klasse).

**Was dann funktioniert:** „Zu Google Wallet hinzufügen“ über ein signiertes JWT, das Klasse und Objekt enthält; Aktualisierung des Objekts per REST nach jeder Buchung.

**Einschränkungen:** Google begrenzt sichtbare Benachrichtigungen (laut Dokumentation drei pro 24 Stunden); Kampagnen über den Kanal „Wallet“ aktualisieren den Pass, lösen aber nicht zwingend eine Mitteilung aus. Die Klasse wird mit dem ersten gespeicherten Pass angelegt; spätere Designänderungen laufen über `updateClass`.

## Aktiver Stempel: Apple VAS und Google Smart Tap

Ziel: Der Stempel liest die Wallet-Karte direkt – kein Browser, kein Antippen einer Mitteilung.

| | Apple VAS | Google Smart Tap |
|---|---|---|
| Voraussetzung auf Passseite | NFC-fähiger Pass: zusätzliches **NFC-Zertifikat**, das Apple auf Antrag vergibt | Freischaltung als **Redemption Issuer** mit Collector ID; laut Recherche je Händler |
| Voraussetzung auf Leserseite | VAS-fähiger, von Apple zugelassener Reader; Protokollspezifikation nur unter NDA | Smart-Tap-fähiges Terminal mit hinterlegtem Schlüssel |
| Realistischer Weg | zertifiziertes OEM-Lesemodul in das Stempelgehäuse integrieren und Zugang bei Apple beantragen | dieselbe Hardware; Onboarding je Händler automatisieren |
| Eigenbau-Reader | ohne Apples Programm nicht zulässig bzw. nicht machbar | Protokoll dokumentiert, aber an die Freischaltung gebunden |

**Stand im Produkt:** Das Backend nimmt signierte Meldungen aktiver Geräte an und bucht darüber. Es gibt keine Firmware, keine Hardware und keine der genannten Freigaben. Die Oberfläche bietet aktive Stempel deshalb nicht an, und die Website nennt sie nur als Ausblick ohne Termin.

**Nächste Schritte (Geschäftsentscheidung):** NFC-Zertifikat bei Apple beantragen; Smart-Tap-Zugang bei Google klären; Muster eines VAS-/Smart-Tap-fähigen Lesemoduls beschaffen; danach Bauraum und Stromversorgung im Gehäuse festlegen (`hardware/README.md`, Kapitel „Ausbaustufe B“).

## Stripe

**Benötigt**

1. Stripe-Konto; je Tarif ein Produkt mit Monats- und Jahrespreis.
2. Preis-IDs im Super-Admin-Panel unter „Tarife“ eintragen.
3. Webhook-Endpunkt `https://<api>/billing/webhooks/stripe` mit den Ereignissen `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`.
4. Variablen: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
5. Steuerliche Einstellungen (Stripe Tax, Rechnungsangaben) nach Unternehmenssitz.

**Ohne diese Variablen** läuft die Abrechnung im **lokalen Testmodus**: Tarifwechsel wirken sofort, Rechnungen sind als Test markiert, es fließt kein Geld. Das Dashboard weist deutlich darauf hin.

**Nicht geprüft:** Checkout, Kundenportal und Tarifwechsel gegen die echte Stripe-API (braucht Testschlüssel). Die Webhook-Verarbeitung ist mit korrekt signierten Ereignissen getestet.

**Offene Geschäftsentscheidungen:** endgültige Preise, Verhalten der Testphase mit hinterlegter Zahlungsart, anteilige Verrechnung bei Tarifwechsel (derzeit Stripe-Standard `create_prorations`), Hardware-Verkauf (einmalig, Miete oder im Tarif enthalten).

## E-Mail

`SMTP_URL` (z. B. `smtps://user:pass@smtp.example.com:465`) und `MAIL_FROM` setzen. Ohne SMTP werden Nachrichten nicht versendet, sondern mit Status `SENT_TEST` gespeichert; außerhalb der Produktion sind sie unter `GET /dev/mailbox` einsehbar.

Für den Produktivbetrieb zusätzlich nötig: Absenderdomain mit SPF, DKIM und DMARC; Behandlung von Rückläufern und Abmeldungen beim Versanddienst.

## Kassensysteme

Generische Schnittstelle (Premium-Tarif): `POST /integrations/pos/events` mit `Authorization: Bearer tably_…`.

```json
{ "externalId": "bon-2026-000123", "locationId": "…", "amountCents": 420, "currency": "EUR" }
```

- `externalId` macht die Meldung idempotent.
- Bei Richtlinie `POS_EVENT` löst ein Ereignis genau einen wartenden Tap aus bzw. wartet bis zu 10 Minuten auf den nächsten Tap am selben Standort.
- Bei Punktekarten bestimmt `amountCents` die Punktzahl.

Fertige Anbindungen an konkrete Kassenhersteller gibt es noch nicht.

## Hardware

Siehe `hardware/README.md`. Vorhanden: parametrisches Modell, druckbare STL-Dateien (aus dem Python-Generator; die OpenSCAD-Datei wurde nicht kompiliert), Maßskizze, Stückliste, Montageanleitung, Kostenschätzung. Offen: Probedruck, Passungen, Messung der Lesereichweite, Bezugsquelle der Chips.
