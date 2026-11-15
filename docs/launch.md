# Launch-Checkliste

Was bis zum ersten zahlenden Betrieb noch fehlt – in der Reihenfolge, in der es sich gegenseitig blockiert. „Du“ = Betreiber, „Claude“ = Entwicklung.

## Phase 0 – sofort (blockiert alles Weitere)

| # | Wer | Aufgabe | Ergebnis |
|---|---|---|---|
| 0.1 | Du | Domains kaufen: `tapperl.at`, `tapperl.com`, `tapperl.app`, `tapperl.de` | Name gesichert |
| 0.2 | Du | Marke „Tapperl“ prüfen lassen (Ähnlichkeitsrecherche inkl. österreichischem Register) und anmelden: Klassen 9, 35, 42 | Markenschutz beantragt |
| 0.3 | Du | Auf GitHub einen Hauptbranch `main` anlegen (leerer erster Commit genügt); optional Repository in `tapperl` umbenennen | Pull Request und CI möglich |
| 0.4 | Du | 10 × NXP NTAG 424 DNA (Ø 25 mm) und ein NFC-Schreibgerät bzw. Android-Handy mit NFC bestellen | Hardware-Tests möglich |
| 0.5 | Du | Stempelgehäuse probedrucken (`hardware/stl/`) | Passungen prüfbar |

## Phase 1 – Staging (1–2 Wochen)

| # | Wer | Aufgabe |
|---|---|---|
| 1.1 | Du | Hosting-Anbieter in der EU wählen (z. B. Hetzner) und Zugang bereitstellen; DNS-Verwaltung der Domain freigeben |
| 1.2 | Claude | CI zum Laufen bringen, Docker-Build prüfen und korrigieren |
| 1.3 | Claude | Staging aufsetzen: `staging.tapperl.at`, `app.staging…`, `api.staging…` mit HTTPS, Datenbank-Backups |
| 1.4 | Du | SMTP-Dienst anlegen (z. B. Brevo, Postmark, Mailjet – EU-Anbieter bevorzugt), Absenderdomain freigeben |
| 1.5 | Claude | SMTP anbinden, SPF/DKIM/DMARC-Einträge vorbereiten |
| 1.6 | Du | Stripe-Konto anlegen (zunächst Testmodus), Testschlüssel bereitstellen |
| 1.7 | Claude | Produkte und Preise in Stripe anlegen, Webhook einrichten, Checkout, Portal und Tarifwechsel im Testmodus prüfen |

## Phase 2 – Hardware und Wallet (2–4 Wochen, parallel)

| # | Wer | Aufgabe |
|---|---|---|
| 2.1 | Du + Claude | Ersten Chip nach `docs/nfc.md` personalisieren; Testplan auf iPhone und Android durchführen; reale Zeiten messen |
| 2.2 | Claude | Auffälligkeiten aus dem Hardware-Test beheben; ggf. Fertigungs-Client zum Beschreiben der Chips bauen |
| 2.3 | Du | Probedruck bewerten: Gewinde, Logo-Scheibe, Lesereichweite durch die Kappe |
| 2.4 | Du | Apple Developer Program beitreten (99 USD/Jahr), Pass Type ID und Zertifikat erzeugen |
| 2.5 | Du | Google Wallet Issuer-Konto anlegen und Veröffentlichungsfreigabe beantragen (Dauer unbekannt – früh starten) |
| 2.6 | Claude | Zertifikate einbinden; Pässe auf echtem iPhone und Android-Gerät testen (Download, Aktualisierung nach Stempel) |

Wallet ist für den Start **nicht zwingend**: Die Webkarte funktioniert ohne. Falls Apple oder Google sich verzögern, kann ohne Wallet gestartet werden.

## Phase 3 – Recht und Geschäft (parallel, blockiert den öffentlichen Start)

| # | Wer | Aufgabe |
|---|---|---|
| 3.1 | Du | Firmendaten liefern: Firmenname, Rechtsform, Anschrift, Firmenbuchnummer, UID, Vertretung, Kontakt |
| 3.2 | Du | Impressum, Datenschutzhinweise und AGB rechtlich prüfen lassen (Platzhalter sind markiert) |
| 3.3 | Du | Auftragsverarbeitungsvertrag für Händler erstellen lassen; AV-Verträge mit Hosting, Mail, Stripe abschließen |
| 3.4 | Du | Preise final festlegen; Hardware-Angebot entscheiden (Kauf, Miete oder im Tarif) |
| 3.5 | Claude | Texte, Preise und Hardware-Angebot einpflegen; Stripe Tax bzw. Rechnungsangaben konfigurieren |

## Phase 4 – Härtung vor dem Start (1 Woche)

| # | Wer | Aufgabe |
|---|---|---|
| 4.1 | Claude | Offene Oberflächenpfade testen (Rollen, dunkler Modus, Punktekarte, geplanter Kampagnenversand) |
| 4.2 | Claude | Sicherheit: Content-Security-Policy, Row-Level-Security, Rate Limiting über Redis, Fehler-Monitoring |
| 4.3 | Claude | Barrierefreiheit: Durchgang mit Screenreader und automatischer Prüfung |
| 4.4 | Du | Optional, empfohlen: externer Penetrationstest |
| 4.5 | Claude | Produktionsumgebung aufsetzen, Stripe auf Live-Schlüssel, Super-Admin anlegen, Backups und Wiederherstellung proben |

## Phase 5 – Pilot und Start

| # | Wer | Aufgabe |
|---|---|---|
| 5.1 | Du | Ein bis zwei befreundete Betriebe für einen Pilot gewinnen |
| 5.2 | Du + Claude | Pilot zwei bis vier Wochen begleiten; Rückmeldungen einarbeiten |
| 5.3 | Du | Erste Serie Stempel fertigen und personalisieren |
| 5.4 | Du + Claude | Öffentlicher Start |

## Was Claude an Zugängen braucht

Zugangsdaten nie in den Chat schreiben, sondern als Geheimnisse in der Umgebung bzw. beim Hosting hinterlegen.

| Zugang | Wofür | Wann |
|---|---|---|
| GitHub: Hauptbranch vorhanden | Pull Request, CI | sofort |
| Hosting (Server oder Projektzugang) + DNS | Staging und Produktion | Phase 1 |
| SMTP-Zugangsdaten | E-Mail-Versand | Phase 1 |
| Stripe-Testschlüssel, später Live-Schlüssel | Abrechnung | Phase 1 / 4 |
| Apple: Pass-Zertifikat, Schlüssel, Team-ID, Pass Type ID | Apple Wallet | Phase 2 |
| Google: Issuer-ID, Dienstkonto-Schlüssel | Google Wallet | Phase 2 |

## Mindestumfang für einen Start

Zwingend: Phase 0, 1, 2.1–2.3, 3 und 4.5. Alles andere kann nach dem Pilotstart folgen – insbesondere Wallet-Karten, weitere Kartentypen, englische Sprache und der aktive Stempel.
