# Entwicklung und Betrieb

## Voraussetzungen

- Node.js 22, pnpm 10
- PostgreSQL 16, Redis 7 (z. B. `docker compose up -d postgres redis`)

## Erste Schritte

```bash
cp .env.example .env
```

```bash
openssl rand -hex 32   # Ergebnis als APP_ENCRYPTION_KEY in .env eintragen
```

```bash
pnpm install
```

```bash
pnpm build:packages
```

```bash
pnpm db:migrate
```

```bash
pnpm --filter @tapperl/api build && pnpm db:seed:demo
```

```bash
pnpm dev
```

| Dienst | Adresse |
|---|---|
| Website und Kundenkarte | http://localhost:3000 |
| Dashboard | http://localhost:3001 |
| API, OpenAPI-Dokumentation | http://localhost:4000, http://localhost:4000/docs |
| Lokales Testpostfach | http://localhost:4000/dev/mailbox |

Demo-Zugang nach `db:seed:demo`: `demo@tapperl.local` / `Demo-Passwort-123`. Der Super-Admin entsteht aus `SUPERADMIN_EMAIL` und `SUPERADMIN_PASSWORD`.

## Tests

```bash
pnpm test
```

Führt die Pakettests (NFC, Wallet) und die API-Integrationstests aus. Die Integrationstests brauchen eine eigene Datenbank `tapperl_test` (`TEST_DATABASE_URL`, Standard `postgresql://tapperl:tapperl@localhost:5432/tapperl_test`) und leeren sie zwischen den Suiten.

```bash
pnpm build
```

```bash
pnpm test:e2e
```

Die End-to-End-Tests starten die gebauten Dienste bei Bedarf selbst. Sie brauchen `NFC_SIMULATOR_ENABLED=true`, `RATE_LIMIT_DISABLED=true` (viele Registrierungen von einer IP) und keinen SMTP-Zugang (sie lesen Links aus dem Testpostfach). Der Rundgang durch das Super-Admin-Panel läuft nur mit `E2E_ADMIN_EMAIL` und `E2E_ADMIN_PASSWORD`.

```bash
pnpm typecheck
```

## Konventionen

- **Eingaben** werden als Zod-Schema in `packages/types/src/schemas.ts` definiert und in der API mit `@ZBody(schema)` validiert; dasselbe Schema dokumentiert den Endpunkt (`@ApiZodBody`).
- **Mandantenkontext** kommt ausschließlich über `@Tenant()`; jede Abfrage filtert auf `organizationId`. Neue Endpunkte brauchen einen Test für fremde IDs (→ 404).
- **Kartenstände** ändert nur der `LedgerService`.
- **Fehler** sind `AppError` mit Code aus `packages/types/src/errors.ts`.
- **Oberflächen** verwenden nur Komponenten aus `@tapperl/ui`; Texte stehen in `copy`-Objekten, Enum-Bezeichnungen in `apps/dashboard/src/lib/labels.ts`.
- **Schemaänderungen:** `packages/database/prisma/schema.prisma` anpassen, dann `pnpm db:migrate:dev`.

## Konfiguration

Alle Variablen mit Erklärung: `.env.example`. Validierung: `packages/config/src/env.ts`. Welche Integrationen aktiv sind, zeigt `/admin/system`.

## Deployment

```bash
docker compose up --build
```

Baut und startet PostgreSQL, Redis, API, Website und Dashboard. Die API wendet beim Start die Migrationen an und legt Tarife sowie den Super-Admin an.

> Die Docker-Dateien wurden in der Entwicklungsumgebung **nicht gebaut** (dort lief kein Docker-Daemon). Der erste Build sollte in der CI oder lokal geprüft werden.

Für die Produktion:

- **EU-Hosting** (bevorzugt): Dienste und Datenbank in einer EU-Region, Backups verschlüsselt.
- Drei Hostnamen mit TLS, z. B. `tapperl.example` (Website), `app.tapperl.example` (Dashboard), `api.tapperl.example` (API). `WEB_URL`, `DASHBOARD_URL`, `API_PUBLIC_URL` entsprechend setzen; `COOKIE_SECURE=true`, `TRUST_PROXY=true`, `NFC_SIMULATOR_ENABLED=false`.
- `NEXT_PUBLIC_*`-Werte sind Build-Argumente der Next-Images.
- `QUEUE_DRIVER=bullmq`; mehrere API-Instanzen sind möglich (Sitzungen und Sperren liegen in PostgreSQL, Jobs in Redis). Das Rate Limiting zählt derzeit je Instanz – für mehrere Instanzen den Redis-Speicher des Throttlers ergänzen.
- `APP_ENCRYPTION_KEY` sicher verwahren: ohne ihn sind NFC-Schlüssel und 2FA-Secrets verloren.
- Überwachung: `/health`, das Fehlerprotokoll im Super-Admin-Panel und die Logs der API.

## CI

`.github/workflows/ci.yml`: Installation, Paket-Build, Typprüfung, Tests, App-Builds, End-to-End-Tests mit PostgreSQL und Redis als Service-Container.

## Staging/Produktion auf Hetzner (Einzelserver)

Dateien: `deploy/docker-compose.prod.yml`, `deploy/Caddyfile`, `deploy/cloud-init.yml`, `.github/workflows/deploy.yml`.

1. Server (Ubuntu 24.04) mit `deploy/cloud-init.yml` als User-Data anlegen; `__DEPLOY_PUBLIC_KEY__` durch den öffentlichen Deploy-Schlüssel ersetzen. Cloud-init installiert Docker, Firewall (22/80/443), fail2ban und automatische Sicherheitsupdates und erzeugt `/opt/tapperl/.env` mit Datenbankpasswort und `APP_ENCRYPTION_KEY` – diese Werte verlassen den Server nicht.
2. DNS: A-Einträge für Website, Dashboard und API auf die Server-IP.
3. GitHub → Settings → Secrets and variables → Actions:
   - Secrets: `DEPLOY_HOST` (Server-IP), `DEPLOY_SSH_KEY` (privater Deploy-Schlüssel)
   - Variablen: `WEB_HOST`, `DASHBOARD_HOST`, `API_HOST`, `ACME_EMAIL`
4. Jeder Push auf `main` (oder „Run workflow“) überträgt den Code, baut die Images auf dem Server und startet neu. Caddy holt die TLS-Zertifikate automatisch.
5. Weitere Konfiguration (SMTP, Stripe, Wallet, Super-Admin) als Zeilen in `/opt/tapperl/.env` auf dem Server ergänzen.
