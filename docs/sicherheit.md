# Sicherheitskonzept

## Schutzziele

1. **Mandantentrennung** – kein Händler sieht oder verändert Daten eines anderen.
2. **Integrität der Stände** – Stempel und Prämien sind nachvollziehbar, nie doppelt, nie vom Client berechnet.
3. **Missbrauchsresistenz des Stempelvorgangs** – gefälschte, wiederholte oder erschlichene Taps werden abgewiesen oder sichtbar.
4. **Datenschutz** – so wenig personenbezogene Daten wie möglich, Auskunft und Löschung eingebaut.

## Authentifizierung und Sitzungen

| Thema | Umsetzung |
|---|---|
| Passwörter | Argon2id; mindestens 10 Zeichen mit Buchstaben und Ziffern |
| Sitzungen | Zufälliges 256-Bit-Token im Cookie (`HttpOnly`, `SameSite=Lax`, in Produktion `Secure`); in der Datenbank nur SHA-256 |
| Laufzeit | 30 Tage gleitend; Abmelden, „Alle anderen abmelden“, Passwortänderung und -reset widerrufen Sitzungen |
| Fehlversuche | Konto wird nach 8 Fehlversuchen 15 Minuten gesperrt; identische Antwort und Laufzeit für unbekannte Konten |
| Zwei-Faktor | TOTP (RFC 6238); Secret mit AES-256-GCM verschlüsselt; Sitzung bleibt bis zum Code unbrauchbar |
| Tokens (Verifizierung, Reset, Einladung, Wiederherstellung) | einmalig, befristet, nur als Hash gespeichert |
| Kunden | Kein Passwort: Browser-Token (Cookie), Wiederherstellung per E-Mail-Link oder Link im Wallet-Pass |

## Autorisierung

- Jede geschützte Route trägt `@Can('<recht>')`, `@Member()` oder `@SuperAdmin()`. `PermissionGuard` prüft Sitzung → Mitgliedschaft in der aktiven Organisation → Recht der Rolle → Sperrstatus → Abo-Status (bei schreibenden Anfragen).
- Rollenmatrix: `packages/types/src/permissions.ts` (OWNER, ADMIN, MANAGER, STAFF).
- Fremde IDs führen zu **404**, nicht 403 – die Existenz fremder Daten wird nicht bestätigt. Fremde Referenzen in eigenen Objekten (z. B. Standort eines anderen Mandanten) werden ebenfalls abgelehnt.
- **Super-Admin** ist ein eigenes Merkmal am Benutzer (`isSuperAdmin`), keine Händlerrolle. Admin-Routen antworten für alle anderen mit 404. Jede Admin-Aktion landet im Audit-Log.
- Entzogene Mitgliedschaften wirken sofort auf laufende Sitzungen.

## Schutz der Web-Schnittstelle

- **CSRF:** `SameSite=Lax`-Cookies + Pflicht-Header `X-Tapperl-Request` für schreibende Anfragen + Prüfung des `Origin`-Headers gegen die eigenen Oberflächen (`apps/api/src/common/csrf.ts`). Ausgenommen sind nur Endpunkte ohne Cookie-Authentifizierung (Webhooks, Wallet-Webservice, Kassen- und Geräte-API).
- **Eingaben:** jede Eingabe wird serverseitig mit Zod validiert; Antworten enthalten Feldfehler.
- **Rate Limiting:** global 300 Anfragen/Minute je IP und Route; streng für Login, Registrierung, Reset, Taps, Einlöse-Codes, Kontaktformular.
- **Header:** Helmet in der API; `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` in beiden Next-Apps.
- **Uploads:** nur PNG/JPEG (Prüfung der Dateisignatur), höchstens 512 KB.
- **CSV-Export:** Zellen werden gegen Formel-Injektion maskiert.
- **Fehler:** stabile Codes, keine Stacktraces nach außen; technische Fehler landen in `SystemError`.

## Geheimnisse

- `APP_ENCRYPTION_KEY` (32 Byte) verschlüsselt ruhende Geheimnisse mit AES-256-GCM: NFC-Schlüssel, TOTP-Secrets, Apple-Pass-Tokens.
- API-Schlüssel, Sitzungs- und sonstige Tokens werden nur als Hash gespeichert; API-Schlüssel werden genau einmal angezeigt.
- Konfiguration ausschließlich über Umgebungsvariablen, validiert beim Start (`packages/config/src/env.ts`). In Produktion verweigert die API den Start mit unsicheren Cookies oder aktivem Simulator.

## NFC: Bedrohungen und Maßnahmen

Was ein Tap beweist: **Der Stempel mit diesen Schlüsseln wurde gelesen und lieferte diesen Zählerstand.** Was er nicht beweist: einen Kauf oder dass der Tap gerade eben stattfand. Daraus folgt das Design:

| Bedrohung | Maßnahme | Test |
|---|---|---|
| Gefälschte Anfrage ohne Stempel | SUN-MAC (AES-CMAC mit gerätespezifischem Schlüssel); Schlüssel verlassen den Server nur beim protokollierten Personalisierungsabruf | `nfc.test.ts` „lehnt gefälschte …“ |
| Replay (URL erneut verwenden, abfotografieren, weiterleiten) | `(deviceId, counter)` ist eindeutig; Zählerstände weit hinter dem Höchststand werden verworfen | „jede Chip-URL ist nur einmal gültig“ |
| Doppelte Requests / Race | Unique-Constraint + Idempotency-Key `tap:<id>` + Kartensperre | „gleichzeitiges Einreichen …“ |
| Manipulierte Gerätekennung | MAC ist an die Schlüssel des Geräts in der URL gebunden | „Manipulierte Gerätekennung“ |
| Kopierte Schlüssel auf fremdem Chip | UID wird beim ersten Tap gebunden; Abweichung sperrt das Gerät (`COMPROMISED`) | „erkennt kopierte Schlüssel …“ |
| Verlorener/gestohlener Stempel | Status `LOST` wirkt sofort; Schlüsselrotation macht den alten Chip wertlos | „verlorene Stempel …“ |
| Kunde stempelt sich selbst mehrfach | Mindestabstand und Tageslimit je Karte (Richtlinie AUTO) oder Freigabe durch Team / Kassen-Ereignis | „AUTO: …“, „STAFF_CONFIRM“, „POS_EVENT“ |
| Missbrauch durch Mitarbeitende | Jede manuelle Buchung mit Benutzer im Ledger und Audit-Log; Übersteuern von Limits und viele manuelle Stempel werden markiert | „manuelle Buchung … wird markiert“ |
| Ungewöhnliche Aktivität | Viele Taps in kurzer Zeit oder viele abgelehnte Taps setzen den Sicherheitsstatus des Geräts auf `WARNING` und markieren Buchungen | „auffällig viele Taps …“ |
| Gefälschte Meldung eines aktiven Stempels | Ed25519-Signatur über Methode, Pfad, Zeit, Nonce und Body; streng steigende Sequenznummer | „Aktiver Stempel …“ |

Bewusste Entscheidung: Zählerstände dürfen bis zu 5 Schritte hinter dem Höchststand liegen, weil der Chip schon beim Lesen zählt und Seiten in vertauschter Reihenfolge ankommen können. Jeder Zählerstand bleibt trotzdem genau einmal einlösbar.

**Restrisiko:** Wer physisch an den Stempel kommt, kann im Modus AUTO innerhalb der Limits Stempel sammeln. Dafür gibt es die Richtlinien „Freigabe durch Team“ und „Kassen-Ereignis“.

## Abrechnung

- Webhooks werden über die Stripe-Signatur geprüft; `BillingEvent (provider, eventId)` garantiert, dass jedes Ereignis genau einmal wirkt. Fehlgeschlagene Verarbeitung liefert 5xx, damit Stripe erneut zustellt.
- Tarifgrenzen und Funktionen werden serverseitig geprüft (`EntitlementsService`), nie nur in der Oberfläche.
- Fehlgeschlagene Zahlung → `PAST_DUE` → nach 7 Tagen Kulanz `RESTRICTED` (nur Lesen und Abrechnung).

## DSGVO

| Anforderung | Umsetzung |
|---|---|
| Datenminimierung | Pflicht ist nur ein Vorname; E-Mail und Geburtstag optional |
| Einwilligung | `ConsentRecord` ist append-only mit Zeitpunkt, Quelle, Version der Hinweise; Marketing nur mit aktiver Einwilligung, Widerruf durch Kund:in jederzeit |
| Auskunft / Übertragbarkeit (Art. 15/20) | JSON-Export durch Händler und durch Kund:in selbst |
| Löschung (Art. 17) | Anonymisierung: Personenbezug wird entfernt, Sitzungen und Wallet-Pässe gelöscht, Buchungen bleiben ohne Personenbezug für die Statistik |
| Protokollierung | Export, Löschung und Einwilligungsänderungen stehen im Audit-Log |
| Cookies | ausschließlich technisch notwendige (Sitzung, Karten-Wiedererkennung); kein Tracking |
| Hosting | EU-Region empfohlen; Auftragsverarbeitung mit Hosting-, Mail- und Zahlungsanbieter ist vertraglich zu regeln |

Offen (organisatorisch, nicht technisch): Auftragsverarbeitungsvertrag zwischen Tapperl und Händlern, Verzeichnis der Verarbeitungstätigkeiten, Löschfristen für Audit- und Geräteprotokolle, rechtlich geprüfte Datenschutzhinweise.

## Geplante Härtung

- PostgreSQL Row-Level-Security als zweite Verteidigungslinie für die Mandantentrennung
- Content-Security-Policy mit Nonces für beide Next-Apps
- Schlüsselverwaltung über KMS/HSM statt Umgebungsvariable; Schlüsselrotation für `APP_ENCRYPTION_KEY`
- Automatische Aufbewahrungsfristen für Protokolle
- Externer Penetrationstest vor dem Produktivstart
