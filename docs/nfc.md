# NFC-Stempel: Funktionsweise, Inbetriebnahme, Tests

Hintergründe und Quellen: `docs/research/nfc-und-wallet.md`. Hardware: `hardware/README.md`.

## Variante A – passiver Stempel (umgesetzt)

Im Stempelfuß sitzt ein **NXP NTAG 424 DNA**. Bei jedem Lesen erzeugt der Chip eine neue URL:

```
https://<web>/t/<publicId>?e=<32 Hex: verschlüsselte UID + Zähler>&c=<16 Hex: MAC>
```

### Ablauf eines Taps

1. Barista hält den Stempel an das Handy. Das Handy zeigt die NFC-Mitteilung bzw. öffnet den Link (siehe „Was Kund:innen tun müssen“).
2. Die Seite `/t/<publicId>` sendet `e` und `c` an `POST /public/taps`.
3. Die API (`TapsService.submit`):
   1. lädt das Gerät, prüft Status und Sicherheitsstatus,
   2. entschlüsselt `e` mit dem SDMMetaReadKey, leitet den Sitzungsschlüssel ab und prüft `c` (`packages/nfc`, gegen den NXP-Testvektor aus AN12196 getestet),
   3. bindet beim ersten gültigen Tap die UID (Aktivierung) bzw. vergleicht sie,
   4. verwirft bereits verwendete oder veraltete Zählerstände,
   5. erkennt die Karte über das Browser-Token – oder fordert zur Anmeldung auf (der Tap bleibt 3 Minuten reserviert),
   6. bucht nach der **Buchungsrichtlinie** des Programms bzw. Geräts.
4. Das Handy zeigt das Ergebnis; Wallet-Pässe werden im Hintergrund aktualisiert.

### Buchungsrichtlinien

| Richtlinie | Verhalten | Geeignet für |
|---|---|---|
| `AUTO` | Stempel sofort; Mindestabstand (Standard 30 min) und Tageslimit (Standard 2) je Karte | Theken, an denen der Stempel beim Team bleibt |
| `STAFF_CONFIRM` | Tap erscheint in der Theken-Ansicht, Team gibt frei | höherwertige Prämien, Selbstbedienung |
| `POS_EVENT` | Stempel nur, wenn die Kasse innerhalb von 10 Minuten einen Kauf meldet (`POST /integrations/pos/events`) | Betriebe mit angebundener Kasse (Premium) |

Die Richtlinie lässt sich je Gerät übersteuern.

### Was Kund:innen tun müssen (ehrlich)

- **iPhone (XS und neuer):** Display an, Stempel an die Oberkante halten, die erscheinende Mitteilung antippen. Es ist also *ein* Tipp nötig.
- **Android:** NFC muss eingeschaltet und das Gerät entsperrt sein; der Link öffnet sich je nach Version direkt oder nach einer Bestätigung.
- **Beim ersten Besuch:** Vorname eingeben, Datenschutz bestätigen – der Stempel wird direkt danach gutgeschrieben.
- Eine App ist nicht nötig. Der Browser merkt sich die Karte über ein Cookie; wer Cookies löscht oder das Gerät wechselt, öffnet die Karte über E-Mail-Link oder Wallet-Pass erneut.

## Inbetriebnahme eines physischen Stempels

1. **Registrieren:** Dashboard → NFC-Stempel → „Stempel registrieren“. Das Gerät erhält eine `publicId` und zwei zufällige AES-128-Schlüssel (verschlüsselt gespeichert). Status: *Wartet auf Aktivierung*.
2. **Personalisieren – empfohlen mit der Android-App** (siehe unten). Alternativ manuell: Inhaber:in ruft „Personalisierungsdaten“ ab (wird protokolliert). Angezeigt werden URL-Vorlage, Offsets und Schlüssel. Mit einem NFC-Schreibgerät bzw. einer Personalisierungs-App für NTAG 424 DNA:
   - NDEF-Datei (Datei 02) mit der URL-Vorlage beschreiben (URI-Record, Präfix `https://`),
   - SDM aktivieren: UID- und Zähler-Spiegelung, **PICCData verschlüsselt**, `PICCDataOffset`, `SDMMACOffset`, `SDMMACInputOffset = SDMMACOffset`,
   - Schlüssel 1 = SDMMetaReadKey, Schlüssel 2 = SDMFileReadKey setzen, Zugriffsrechte der Datei entsprechend (`SDMMetaRead = 1`, `SDMFileRead = 2`, `SDMCtrRet = 1`),
   - Schlüssel 0 (Master) ändern und sicher verwahren; Schreibzugriff auf die NDEF-Datei sperren.
3. **Aktivieren:** Stempel einmal an ein Smartphone halten und den Link öffnen. Der erste gültige Tap bindet die Chip-UID und schaltet den Stempel aktiv – es wird noch kein Stempel vergeben.
4. **Zuordnen:** Programm und Standort am Gerät setzen.

Für die Serienfertigung übernimmt der Plattformbetreiber die Schritte 1–2 und liefert aktivierungsbereite Stempel aus – ebenfalls mit der Einrichtungs-App.

### Einrichtungs-App (Android, `apps/einrichtung`)

Ein Android-Handy mit NFC ersetzt das USB-Schreibgerät. Ablauf:

1. Dashboard → Stempel → **„Mit Android-Handy einrichten“** erzeugt einen Einmal-Code (`XXXXX-XXXXX`, 30 Minuten gültig, nur für diesen Stempel; ein neuer Code macht den alten ungültig). In der Datenbank liegt nur der SHA-256 des Codes.
2. QR-Code mit dem Handy scannen → Seite `/einrichten` → „In der Einrichtungs-App öffnen“ (oder Code in der App eintippen).
3. Die App holt mit dem Code Schlüssel und NDEF-Profil (`POST /devices/v1/provisioning/fetch`, protokolliert als `KEYS_REVEALED via app`).
4. Chip an die Handy-Rückseite halten. Die App führt aus:
   1. NDEF-Anwendung wählen, `AuthenticateEV2First` mit Schlüssel 0 (gespeicherter Masterschlüssel, sonst Werkszustand `00…00`),
   2. NDEF-Datei 02 mit der URL-Vorlage beschreiben,
   3. `ChangeFileSettings` (verschlüsselt + MAC): SDM an, UID/Zähler gespiegelt, PICCData verschlüsselt mit Schlüssel 1, SDM-MAC mit Schlüssel 2, Zählerabruf Schlüssel 1, **Lesen frei, Schreiben nur mit Schlüssel 0**,
   4. `ChangeKey` 1 und 2 (alte Werte: Werkszustand, aktueller oder zuletzt geschriebener Schlüssel),
   5. `ChangeKey` 0 → zufälliger, gerätespezifischer Masterschlüssel (zuletzt, beendet die Sitzung),
   6. Chip wie ein Kundenhandy lesen und die erste SUN-Signatur an `POST /devices/v1/provisioning/complete` melden → Server prüft sie mit den Schlüsseln, bindet die UID, setzt den Stempel *Aktiv* und verbraucht den Code.
5. Bricht der Vorgang ab (Chip zu früh entfernt), einfach erneut auflegen – jeder Schritt ist wiederholbar.

Der Masterschlüssel wird beim ersten Abruf erzeugt und bleibt danach gleich. Nach „Schlüssel erneuern“ kennt der Server die Schlüssel, die zuletzt nachweislich auf dem Chip standen (`chipMetaKeyEnc`/`chipFileKeyEnc`), sodass derselbe Chip neu eingerichtet werden kann. Fremde Chips (anderer Masterschlüssel) werden abgelehnt, statt sie zu verändern.

Tests ohne Hardware: `apps/einrichtung/core` enthält das Chip-Protokoll als reines Kotlin und einen unabhängig geschriebenen Software-Nachbau des NTAG 424 DNA (`EmulatedNtag424`). Die Tests prüfen Werkszustand, Wiederaufnahme nach Abbruch, Schlüsselrotation, Fremdchip und Schreibschutz. Eine vom Nachbau erzeugte SUN-URL wurde mit `verifySun` aus `packages/nfc` gegengeprüft. **Mit einem echten Chip ist die App noch nicht getestet** – der Nachbau beruht auf Datenblatt und AN12196, nicht auf Hardware.

```bash
cd apps/einrichtung
./gradlew :core:test          # Protokoll-Tests (ohne Android-SDK möglich)
./gradlew :app:assembleDebug  # APK, braucht ANDROID_HOME oder local.properties
```

Die CI baut die APK bei jedem Lauf und legt sie als Artefakt `tapperl-einrichtung-apk` ab. Debug-signierte APKs aus verschiedenen Builds haben unterschiedliche Signaturen: Vor einem Update die alte App deinstallieren. Für eine dauerhafte Signatur `TAPPERL_KEYSTORE` (+ Passwort-Variablen) setzen und `assembleRelease` bauen; der Keystore gehört nie ins Repository.

**Voraussetzung:** `WEB_URL` muss eine `https://`-Adresse sein – iOS öffnet NFC-Links nur zuverlässig über HTTPS. Ohne HTTPS zeigt die Personalisierung eine Warnung statt eines Profils.

### Verlust, Diebstahl, Schlüsselwechsel

- „Als verloren melden“ sperrt den Stempel sofort (Status `LOST`, Sicherheitsstatus `COMPROMISED`).
- „Schlüssel erneuern“ erzeugt neue Schlüssel, setzt Zähler und UID-Bindung zurück und verlangt eine neue Personalisierung. Alte Chips und alte URLs sind danach wertlos.
- Der NTAG 424 DNA erlaubt das Ändern der Schlüssel mit dem Master-Schlüssel (Schlüssel 0). Nach „Schlüssel erneuern“ den Chip einfach erneut mit der Einrichtungs-App einrichten.

## Simulationsmodus

Ohne Hardware lässt sich alles mit **simulierten Stempeln** testen (`NFC_SIMULATOR_ENABLED=true`, in Produktion nicht startbar):

- Ein simulierter Stempel besitzt echte Schlüssel und eine erfundene UID.
- „Tap simulieren“ erzeugt exakt die URL, die ein Chip mit dem nächsten Zählerstand liefern würde.
- Ab dann läuft **dieselbe** Verarbeitung wie bei echter Hardware (gleiche Kryptografie, gleiche Regeln). Buchungen tragen die Quelle `SIMULATED_TAP`, die Kundenseite zeigt „Simulation“.

## Testabläufe

### Automatisiert

- `packages/nfc`: AES-CMAC (RFC 4493), SUN gegen NXP-Testvektor, Ablehnungen, Personalisierungsprofil, Gerätesignaturen.
- `apps/api/test/nfc.test.ts`: Aktivierung, Replay, Nebenläufigkeit, Fälschungen, UID-Abweichung, Verlust/Rotation, alle Richtlinien, Kassen-Ereignisse, Auffälligkeiten.
- `e2e/`: kompletter Ablauf im Browser mit simuliertem Stempel und emuliertem iPhone.

### Manuell mit echtem Chip (noch offen – es lag keine Hardware vor)

| # | Schritt | Erwartung |
|---|---|---|
| 1 | Chip mit der Einrichtungs-App einrichten | „Fertig“, Gerät im Dashboard *Aktiv*, Lesen liefert URL mit wechselndem `e`/`c` |
| 1a | Chip während der Einrichtung zu früh wegnehmen, dann erneut auflegen | Einrichtung läuft beim zweiten Auflegen durch |
| 1b | Eingerichteten Chip mit einem NFC-Tool beschreiben | Schreiben wird vom Chip verweigert |
| 2 | Erster Tap (iPhone und Android) | „Stempel aktiviert“, Gerät im Dashboard *Aktiv* |
| 3 | Tap ohne Karte | Anmeldeformular, danach „Stempel erhalten!“ |
| 4 | Tap mit Karte | Ergebnis ohne weitere Eingabe |
| 5 | Dieselbe URL erneut öffnen (anderes Handy) | „Dieser Tap wurde bereits verwendet“ |
| 6 | Zwei Taps kurz hintereinander | zweiter wird wegen Mindestabstand abgelehnt |
| 7 | Stempel im Dashboard deaktivieren, tappen | „Dieser Stempel ist nicht aktiv“ |
| 8 | Lesedistanz und Position am Handy (iPhone oben, Android Rückseite Mitte) | zuverlässiges Lesen durch die 1-mm-Kappe |
| 9 | Zeit vom Anhalten bis zur Erfolgsanzeige stoppen | Messwerte dokumentieren (iPhone inkl. Antippen der Mitteilung) |

### Gemessene Zeiten (Stand dieser Umgebung)

- Verarbeitung eines Taps im Backend (lokal, PostgreSQL auf demselben Rechner): **Median ca. 35 ms, p95 ca. 42 ms** (30 Messungen, `nfc.test.ts`).
- Seitenaufruf bis sichtbares Ergebnis im emulierten iPhone-Browser gegen den lokalen Entwicklungsserver: **ca. 0,3 s**.
- **Nicht gemessen:** die reale Gesamtdauer mit echtem Chip, Mobilfunk und dem Antippen der NFC-Mitteilung. Diese Zahl wird erst mit Hardware erhoben (Testschritt 9) und bis dahin nirgends behauptet.

## Variante B – aktiver Stempel (vorbereitet, nicht verfügbar)

Ein aktiver Stempel liest selbst (Reader-IC, Mikrocontroller, Secure Element) und meldet die gelesene Karte signiert an `POST /devices/v1/taps`. Im Backend vorhanden: Gerätetyp, Ed25519-Signaturprüfung, Replay-Schutz über Sequenznummern, Buchung über dasselbe Ledger.

Nicht vorhanden und ohne externe Freigaben nicht machbar: das Auslesen von Wallet-Pässen per **Apple VAS** (NFC-Zertifikat von Apple, zertifizierter Reader, Spezifikation unter NDA) und **Google Smart Tap** (Freischaltung als Redemption Issuer mit Collector ID, je Händler). Details und Bewertung: `docs/integrationen.md`.
