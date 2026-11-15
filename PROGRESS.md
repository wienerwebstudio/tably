# Arbeitsstand

Stand: 15.11.2026 · Branch `claude/zealous-ride-l07329`

## Kurzfassung

Die Plattform läuft durchgängig: Händler registrieren sich, gestalten eine Karte, registrieren einen Stempel und vergeben Stempel; Kund:innen melden sich im Browser an, sammeln per Tap und lösen Prämien ein. Die Kernlogik ist automatisiert getestet. **Nicht produktionsreif** ist das System, solange echte NFC-Chips, Apple-/Google-Wallet-Zugänge und Stripe nicht gegen die echten Dienste geprüft wurden (siehe „Offen“).

## Ausgeführte Tests (letzter Lauf)

| Suite | Ergebnis | Inhalt |
|---|---|---|
| `packages/nfc` | 18 / 18 | AES-CMAC (RFC 4493), SUN gegen NXP-Testvektor (AN12196), Ablehnungen, Personalisierungsprofil, Gerätesignaturen |
| `packages/wallet` | 11 / 11 | `.pkpass`-Aufbau, Manifest, PKCS#7-Signatur (mit OpenSSL verifiziert), PNG-Erzeugung, Google-JWT, REST-Client (gemockt) |
| `apps/api` | 74 / 74 | Auth, 2FA, CSRF, Rollen, Mandantentrennung, Idempotenz und Nebenläufigkeit, NFC-Taps und Richtlinien, DSGVO, Abrechnung, Stripe-Webhooks, Wallet-Webservice, Marketing, Analysen, Super-Admin, Rate Limiting |
| `e2e` (Playwright, Produktions-Builds) | 11 / 11 | Einrichtung bis zum ersten Stempel, Kundenkarte mit Einlösung, Freigabe durch das Team, Zugriffsschutz, Rundgang durch alle Seiten von Website, Dashboard und Super-Admin |
| Typprüfung, Builds | grün | alle Pakete und Apps |

Messwerte dieser Umgebung: Tap-Verarbeitung im Backend Median ca. 35 ms (p95 ca. 42 ms); Seitenaufruf bis Ergebnis im emulierten iPhone-Browser ca. 0,3 s (lokal). Die reale Dauer mit Chip und Mobilfunk ist **nicht** gemessen.

## Fertiggestellt

**Backend**
- Registrierung, Login, E-Mail-Bestätigung, Passwort-Reset, TOTP-2FA, Sitzungsverwaltung, Einladungen, vier Rollen
- Betriebe, Standorte, Logo, Team, API-Schlüssel, Audit-Log, Onboarding-Status
- Treueprogramme (Stempel- und Punktekarte), Prämien, Kartendesign
- Kunden: Suche, Filter, Profil, Einwilligungen, Export, Löschung (auch durch Kund:innen selbst)
- Ledger: atomare, idempotente Buchungen; Korrektur, Storno, Einlösung direkt und per Code
- NFC: Geräteverwaltung, SUN-Prüfung, UID-Bindung, Replay-Schutz, drei Buchungsrichtlinien, Auffälligkeitserkennung, Simulator, Kassen-Ereignisse, Schnittstelle für aktive Stempel
- Wallet: Apple-Pass und Webservice, Google-Link und Updates (jeweils mit Status „nicht eingerichtet“ ohne Zugangsdaten)
- Abrechnung: Tarife in der Datenbank, Limits und Funktionen je Tarif, Testphase, Stripe-Adapter mit Webhooks, lokaler Testmodus
- Marketing: Zielgruppen mit Einwilligungsprüfung, Ankündigung/Angebot, Geburtstag, Rückgewinnung, Bonus-Stempel
- Analysen aus echten Buchungen; Super-Admin-API; tägliche Aufräumarbeiten; OpenAPI unter `/docs`

**Oberflächen**
- Website: Start, Funktionen, Branchen, Preise (aus der API), Hardware, FAQ, Kontakt, Rechtstext-Gerüste
- Kundenkarte: Anmeldung, Tap-Seite mit allen Zuständen, Webkarte, Einlöse-Code, Wallet-Buttons, Wiederherstellung, eigene Daten
- Dashboard: Einrichtungsassistent, Übersicht, Theke, Kunden, Karten-Designer mit drei Vorschauen, NFC-Stempel, Buchungen, Marketing, Analysen, Einstellungen (Betrieb, Standorte, Team, Abo, Sicherheit, Integrationen, Protokoll), heller und dunkler Modus
- Super-Admin: Übersicht, Betriebe, Benutzer, Hardware, Missbrauch, Tarife, Fehler, Anfragen, Protokoll

**Sonstiges**
- Hardware: parametrisches Modell, STL-Dateien, Maßskizze, Stückliste, Montage, Kostenschätzung
- Recherche: Wettbewerb, NFC und Wallet mit Quellen
- Dockerfile, docker-compose, CI-Workflow, Dokumentation

## Offen

### Braucht externe Zugänge oder Hardware

| Punkt | Was fehlt |
|---|---|
| Echte NFC-Chips | NTAG 424 DNA, Schreibgerät; Testplan in `docs/nfc.md` |
| Apple Wallet | Developer-Konto, Pass-Type-ID-Zertifikat; Test auf iPhone inkl. Push |
| Google Wallet | Issuer-Konto mit Freigabe, Dienstkonto; Test auf Android |
| Stripe | Konto, Produkte/Preise, Webhook; Checkout und Portal im Stripe-Testmodus prüfen |
| E-Mail | SMTP-Zugang, SPF/DKIM |
| Aktiver Stempel | Apple-NFC-Zertifikat, Smart-Tap-Freigabe, zertifiziertes Lesemodul |
| Stempel-Gehäuse | Probedruck, Passungen, Reichweitenmessung; `.scad` gegen die STLs prüfen |

### Geschäftsentscheidungen

- Endgültige Preise (derzeit 29 / 59 / 99 €) und Verhalten nach der Testphase
- Hardware-Angebot: Kauf, Miete oder im Tarif enthalten; Preis
- Betreiberangaben und rechtlich geprüfte Texte für Impressum, Datenschutz, AGB (Platzhalter sind markiert); Auftragsverarbeitungsvertrag
- Hosting-Anbieter und Region

### Technisch offen

- **Nicht geprüft:** Docker-Build (kein Docker-Daemon in der Entwicklungsumgebung) und der CI-Workflow (noch nie gelaufen)
- Kartentypen Cashback, Mitgliedschaft, Rabatt, Gutschein, VIP, Prepaid: im Datenmodell angelegt, in der Oberfläche als „geplant“ markiert
- Punktekarte: Backend und Auswahl vorhanden, aber nicht eigens end-to-end getestet
- Fertigungs-Client zum Beschreiben der Chips (bisher: Werte abrufen und mit vorhandenem Schreibwerkzeug übertragen)
- Rate Limiting zählt je API-Instanz (Redis-Speicher für mehrere Instanzen fehlt)
- PostgreSQL Row-Level-Security, Content-Security-Policy, KMS für den Anwendungsschlüssel (siehe `docs/sicherheit.md`)
- Englische Übersetzung: Struktur vorhanden (`defineCopy`), Texte nur deutsch; einige Seiten enthalten noch Texte direkt im Markup
- Barrierefreiheit: nach WCAG 2.2 AA gebaut (Labels, Fokus, Tastatur, Kontrastwarnung im Designer), aber ohne formale Prüfung und ohne Screenreader-Test
- Mitarbeitende lassen sich nicht auf einzelne Standorte beschränken
- Objektspeicher für Logos (derzeit PostgreSQL), Skalierung von Logos für Wallet-Pässe

### Nicht durchgespielte Pfade in der Oberfläche

- Rollen unterhalb „Inhaber:in“ in Einstellungen, Stempel- und Marketing-Seiten (serverseitig getestet, in der Oberfläche nicht)
- Stripe-Pfade im Dashboard (Checkout-Weiterleitung, Kundenportal)
- Personalisierungsdialog mit vollständigem Profil (braucht `WEB_URL` mit https; lokal erscheint die Warnung)
- Zeitgesteuerter Kampagnenversand und Rückgewinnung in der Oberfläche (im Backend: Geburtstag und einmaliger Versand getestet)
- Dunkler Modus wurde nur stichprobenartig angesehen

## Bekannte Einschränkungen

- Analysen: Geräte- und Programmtabelle berücksichtigen den Standortfilter nicht; „Neue Kunden“ ebenfalls nicht (Hinweis steht auf der Seite).
- Storno-Status in Listen wird nur aus den geladenen Buchungen erkannt; die API verhindert doppelte Stornos in jedem Fall.
- Simulierte Tap-URLs zeigen auf `WEB_URL`; mit `localhost` sind sie nur auf demselben Gerät nutzbar.
- Die Demo-Datenbank der Entwicklungsumgebung enthält Reste aus Oberflächentests (anonymisierte Kunden, Testbetriebe). `pnpm db:seed:demo` auf einer frischen Datenbank ist sauber.

## Architekturentscheidungen

- Modularer Monolith, zwei Next-Apps, Same-Origin-Proxy für die API (`docs/architektur.md`)
- Kunden sind mandantenbezogen; Wiedererkennung über Browser-Token statt Passwort
- Schlüssel je Gerät, ausgewählt über die Gerätekennung in der URL; UID-Bindung beim ersten Tap
- Zählerfenster von 5 statt streng monotoner Zähler (Chip zählt beim Lesen)
- Ein Tap gilt nie als Kaufnachweis → wählbare Buchungsrichtlinien
- Tap wird clientseitig per POST eingereicht, nicht beim Seitenabruf (Vorschau-Abrufe verbrauchen keinen Tap)
- Tarife liegen in der Datenbank; `packages/config` liefert nur die Startwerte
- Eigene Komponenten auf Radix statt kopierter shadcn-Dateien; OpenAPI aus Zod-Schemas

## Notwendige Zugangsdaten

Alle Variablen stehen in `.env.example`. Pflicht: `DATABASE_URL`, `APP_ENCRYPTION_KEY`. Optional je Integration: `SMTP_URL`, `STRIPE_*`, `APPLE_*`, `GOOGLE_WALLET_*`, `SUPERADMIN_*`.

## Nächste Schritte

1. CI einmal laufen lassen und den Docker-Build prüfen.
2. Zehn NTAG-424-DNA-Chips und ein Schreibgerät beschaffen, Testplan aus `docs/nfc.md` durchführen, reale Zeiten messen.
3. Stempelgehäuse probedrucken, Passungen und Lesereichweite prüfen.
4. Stripe-Testkonto anbinden und Checkout, Portal, Tarifwechsel prüfen.
5. Apple-Developer- und Google-Wallet-Issuer-Konto einrichten; Pässe auf echten Geräten testen.
6. Rechtstexte und Betreiberangaben fertigstellen; Auftragsverarbeitungsvertrag.
7. Staging-Umgebung in einer EU-Region mit HTTPS aufsetzen; SMTP anbinden.
8. Offene Oberflächenpfade nachtesten (Rollen, dunkler Modus), Screenreader-Durchgang.
9. Pilot mit ein bis zwei Betrieben; danach Punktekarte und weitere Kartentypen priorisieren.
10. Anträge für Apple-NFC-Zertifikat und Google Smart Tap stellen, falls der aktive Stempel verfolgt wird.
