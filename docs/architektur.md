# Architektur

## Überblick

Tapperl ist ein **modularer Monolith** in einem pnpm-Monorepo. Drei ausführbare Dienste teilen sich sechs Pakete:

```
apps/
  api/         NestJS-REST-API (einziger Dienst mit Datenbankzugriff)
  web/         Next.js – Marketing-Website, Kundenkarte, Tap-Seiten
  dashboard/   Next.js – Händler-Dashboard und Super-Admin-Panel
packages/
  config/      Tarife, Limits, Umgebungsvalidierung, Konstanten
  types/       Zod-Schemas (Eingaben), Antworttypen, Rollen/Rechte, Fehlercodes
  database/    Prisma-Schema, Migrationen, generierter Client
  nfc/         SUN/SDM-Verifikation (NTAG 424 DNA), Personalisierungsprofil, Geräteprotokoll
  wallet/      Apple-.pkpass-Erzeugung, APNs-Push, Google-Wallet-JWT und REST-Client
  ui/          Design-System (Tokens, Komponenten, Treuekarte), API-Client
docs/          Technische Dokumentation und Recherche
hardware/      CAD, STL, Maßskizze und Konzept des physischen Stempels
e2e/           Playwright-Tests über alle drei Dienste
```

```
Browser (Händler) ──► dashboard (Next) ──┐
                                         ├─ /api/* (Same-Origin-Proxy) ──► api (NestJS) ──► PostgreSQL
Browser (Kunde)  ──► web (Next) ─────────┘                                   │
NFC-Stempel ─► öffnet URL auf web                                            ├──► Redis / BullMQ (Jobs)
Kasse (POS) ─────────────── Bearer-API-Schlüssel ───────────────────────────►│
Wallet (iPhone) ─────────── Pass-Webservice ────────────────────────────────►│
Stripe ──────────────────── signierte Webhooks ─────────────────────────────►│
```

### Warum so?

- **Ein Backend-Prozess statt Microservices.** Buchungen, Prämien und Limits müssen in *einer* Datenbanktransaktion konsistent sein. Fachmodule sind sauber getrennt (`apps/api/src/modules/*`), teilen sich aber Infrastruktur und rufen sich über Services auf.
- **Zwei Next-Apps.** Die Kunden-Website ist öffentlich, extrem leichtgewichtig und trägt die NFC-URLs; das Dashboard ist ein geschützter Arbeitsbereich. Getrennte Origins bedeuten getrennte Cookies – ein Händler-Login ist auf der Kundendomain nicht vorhanden und umgekehrt.
- **Same-Origin-Proxy.** Beide Apps leiten `/api/*` an die API weiter. Cookies bleiben First-Party (`SameSite=Lax`, `HttpOnly`), CORS ist im Normalbetrieb nicht nötig.

## Fachmodule der API

| Modul | Aufgabe |
|---|---|
| `auth` | Registrierung, Login, Sitzungen, E-Mail-Bestätigung, Passwort-Reset, TOTP-2FA, Einladungen |
| `organizations` | Betriebsdaten, Logo, Standorte, Team und Rollen, API-Schlüssel, Onboarding-Status, Audit-Log |
| `programs` / `cards` | Treueprogramme, Prämien, Kartendesign; Kartenansicht für Web und Wallet |
| `customers` | Kundenliste, Profile, Einwilligungen, Auskunft, Löschung |
| `ledger` | **Einzige Stelle, die Kartenstände ändert** – Stempel, Korrektur, Storno, Einlösung |
| `stamps` | Buchungs-Endpunkte für Mitarbeitende (Theke) |
| `nfc` | Geräteverwaltung, Tap-Verarbeitung, Buchungsrichtlinien, Simulator, Kassen-Ereignisse, aktive Reader |
| `public` | Kundenseitige Endpunkte: Anmeldung, Karte, Einlöse-Code, Wiederherstellung, Kontakt |
| `wallet` | Pass-Erzeugung, Apple-Webservice, Aktualisierungsjobs |
| `billing` | Tarife, Abo-Status, Stripe-Anbindung, Webhooks, lokaler Testmodus |
| `campaigns` | Zielgruppen, einmalige Kampagnen, Automationen, Bonus-Aktionen |
| `analytics` | Kennzahlen direkt aus Buchungen (SQL) |
| `admin` | Super-Admin-Panel (strikt getrennt von Händlerrollen) |

## Datenmodell

Vollständig in `packages/database/prisma/schema.prisma`. Kernideen:

- **Mandant = `Organization`.** Jede mandantenbezogene Tabelle trägt `organizationId`. Die API liest die Organisation ausschließlich aus der Sitzung (`TenantContext`), nie aus Parametern der Anfrage.
- **Kunden gehören einem Mandanten.** Dieselbe Person bei zwei Händlern sind zwei getrennte `Customer`-Datensätze. Ein Browser-Token (`CustomerSession`) kann Konten bei mehreren Händlern tragen.
- **Buchungen sind unveränderlich.** `StampTransaction` beschreibt den Vorfall (wer, wo, womit), `PointLedger` die Wirkung auf den Stand inkl. `balanceAfter`. Korrekturen sind Gegenbuchungen (`REVERSAL`), nie Änderungen.
- **`LoyaltyCard.balance`** ist ein zwischengespeicherter Stand, der in derselben Transaktion wie das Ledger fortgeschrieben wird. Tests prüfen: Stand = Summe des Ledgers, auch unter Last.
- **`TapEvent`** hält jeden kryptografisch geprüften Tap fest; `(deviceId, counter)` ist eindeutig.
- **Abrechnung:** `Plan` (in der Datenbank, vom Betreiber änderbar), `Subscription`, `Invoice`, `BillingEvent` (Webhook-Idempotenz).
- **Betrieb:** `AuditLog`, `NfcDeviceEvent`, `SystemError`, `Notification` (jede ausgehende Nachricht).

## Buchungen: Atomarität und Idempotenz

`LedgerService` (apps/api/src/modules/ledger) führt jede Buchung so aus:

1. Transaktion öffnen, Kartenzeile mit `SELECT … FOR UPDATE` sperren → Buchungen derselben Karte laufen nacheinander.
2. Idempotency-Key prüfen (`@@unique([organizationId, idempotencyKey])`). Ist er bekannt, wird die ursprüngliche Buchung zurückgegeben.
3. Geschäftsregeln prüfen (Status, Laufzeit, Mindestabstand, Tageslimit, Stand ≥ Kosten).
4. `StampTransaction` + `PointLedger` schreiben, Karte fortschreiben.
5. Nach dem Commit: Wallet-Aktualisierung als Job einreihen.

Idempotency-Keys: Dashboard-Aktionen senden den Header `Idempotency-Key`; Taps verwenden `tap:<tapId>`, Einlösungen `redemption:<id>`, Stornos `reversal:<transactionId>`, Kassen-Ereignisse die `externalId`.

## Hintergrundverarbeitung

`QueueService` kapselt BullMQ (Redis). Jobs: `wallet.sync`, `wallet.syncProgram`, `campaign.send`, stündlich `campaign.tick` (geplante Sendungen, Geburtstage, Rückgewinnung, abgelaufene Aktionen). Mit `QUEUE_DRIVER=inline` laufen dieselben Handler ohne Redis im API-Prozess (Tests, Minimalbetrieb).

## Erweiterbarkeit

- **Kartentypen:** `ProgramType` kennt bereits alle acht geplanten Typen. Umgesetzt sind `STAMP` und `POINTS` (gleiches Ledger, Prämien mit eigenen Kosten). Weitere Typen ergänzen Regeln im `LedgerService` und Felder im Designer; die Oberfläche zeigt sie als „geplant“.
- **Aktive Stempel:** `NfcDeviceKind.ACTIVE_READER`, signierte Geräteanfragen (`packages/nfc/src/active.ts`) und der Endpunkt `POST /devices/v1/taps` existieren und sind getestet. Es fehlen Hardware und Herstellerfreigaben (siehe `docs/integrationen.md`).
- **Versandkanäle, Zahlungsanbieter, Wallets** sind Adapter mit ehrlichem Status „nicht eingerichtet“.
- **Internationalisierung:** Texte liegen getrennt vom Markup in `copy`-Objekten (`defineCopy`/`useCopy`), Enum-Bezeichnungen zentral in `apps/dashboard/src/lib/labels.ts`. Fehlermeldungen der API tragen stabile Codes (`packages/types/src/errors.ts`).

## Begründete Abweichungen vom Wunsch-Stack

| Vorgabe | Umsetzung | Grund |
|---|---|---|
| shadcn/ui | Eigene Komponenten im shadcn-Stil auf Radix-Primitives (`packages/ui`) | Ein geteiltes Paket für beide Apps statt kopierter Komponenten je App; gleiche Technik (Radix, Tailwind, Lucide) |
| OpenAPI aus DTO-Klassen | OpenAPI aus den Zod-Schemas (`z.toJSONSchema`) | Eine einzige Quelle für Validierung, Typen und Dokumentation |
| Logo-Upload in Objektspeicher | Logos als `bytea` in PostgreSQL (≤ 512 KB) | Kein zusätzlicher Dienst für den MVP; S3-Adapter ist ein späterer Austausch hinter `Asset` |
