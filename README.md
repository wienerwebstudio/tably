# Tably

**Tap. Stamp. Reward.** – Digitale Treuekarten für lokale Betriebe, gestempelt mit einem physischen NFC-Stempel statt mit einem QR-Scanner.

Der Barista hält den Stempel an das Smartphone der Kundin, die Kundin bekommt einen digitalen Stempel – ohne App, direkt im Browser, optional in Apple Wallet oder Google Wallet.

> **Stand:** funktionsfähiger MVP mit getesteter Kernlogik. Externe Integrationen (Apple Wallet, Google Wallet, Stripe, E-Mail-Versand) sind implementiert, laufen aber erst mit eigenen Zugangsdaten; ohne sie arbeitet das System in klar gekennzeichneten Testmodi. Echte NFC-Hardware wurde noch nicht getestet. Details: [`PROGRESS.md`](PROGRESS.md) und [`docs/integrationen.md`](docs/integrationen.md).

## Was enthalten ist

| Bereich | Inhalt |
|---|---|
| **Website** (`apps/web`) | Marketing-Seiten, Preise, Hardware, FAQ, Kontakt, Rechtstext-Gerüste |
| **Kundenkarte** (`apps/web`) | Anmeldung mit Vorname, Webkarte mit Fortschritt, Tap-Seite, Prämie per Code einlösen, Wallet-Download, Datenauskunft und -löschung |
| **Dashboard** (`apps/dashboard`) | Einrichtungsassistent, Karten-Designer mit Live-Vorschau (Web/Apple/Google), Kunden, Theke, NFC-Stempel, Buchungen, Marketing, Analysen, Team, Abo, Sicherheit |
| **Super-Admin** (`apps/dashboard/admin`) | Betriebe, Abos, Benutzer, Hardware, Missbrauch, Tarife und Limits, Fehlerprotokoll, Systemstatus |
| **API** (`apps/api`) | NestJS, PostgreSQL/Prisma, Redis/BullMQ, OpenAPI unter `/docs` |
| **NFC** (`packages/nfc`) | Prüfung der Secure-Unique-NFC-Nachrichten des NXP NTAG 424 DNA, Simulator, Protokoll für aktive Stempel |
| **Wallet** (`packages/wallet`) | Signierte Apple-Pässe, Pass-Webservice, Google-Wallet-Links und -Updates |
| **Hardware** (`hardware/`) | Parametrisches Modell, druckbare STL-Dateien, Maßskizze, Stückliste, Montage, Kostenschätzung |

## Schnellstart

Voraussetzungen: Node.js 22, pnpm 10, PostgreSQL 16, Redis 7.

```bash
docker compose up -d postgres redis
```

```bash
cp .env.example .env
```

In `.env` den Wert `APP_ENCRYPTION_KEY` setzen (`openssl rand -hex 32`), dann:

```bash
pnpm install
```

```bash
pnpm build:packages && pnpm db:migrate
```

```bash
pnpm --filter @tably/api build && pnpm db:seed:demo
```

```bash
pnpm dev
```

- Website und Kundenkarte: http://localhost:3000
- Dashboard: http://localhost:3001 (Demo: `demo@tably.local` / `Demo-Passwort-123`)
- API-Dokumentation: http://localhost:4000/docs

Den ersten Stempel ohne Hardware vergeben: im Dashboard unter **Theke** einen Tap simulieren und den QR-Code mit dem Handy scannen oder den Link öffnen.

## Tests

```bash
pnpm test
```

```bash
pnpm build && pnpm test:e2e
```

## Dokumentation

- [`docs/architektur.md`](docs/architektur.md) – Aufbau, Datenmodell, Buchungslogik
- [`docs/sicherheit.md`](docs/sicherheit.md) – Sicherheitskonzept, Bedrohungen, DSGVO
- [`docs/nfc.md`](docs/nfc.md) – Stempel-Ablauf, Inbetriebnahme, Testabläufe, Messwerte
- [`docs/integrationen.md`](docs/integrationen.md) – Apple, Google, Stripe, E-Mail, Kasse: Stand und fehlende Voraussetzungen
- [`docs/entwicklung.md`](docs/entwicklung.md) – Entwicklung, Konventionen, Deployment
- [`docs/research/`](docs/research) – Wettbewerbsanalyse und technische Recherche mit Quellen
- [`hardware/README.md`](hardware/README.md) – Konstruktion des Stempels
- [`PROGRESS.md`](PROGRESS.md) – Arbeitsstand, offene Punkte, nächste Schritte
