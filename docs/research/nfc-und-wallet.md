# NFC und Wallet: technische Grundlagen für Tably

Stand der Recherche: 15.11.2026. Belegt wird mit offizieller Dokumentation von NXP, Apple, Google, Android, W3C/Chrome. Herstellerseiten der Reader-Anbieter sind als solche gekennzeichnet (Eigenangaben, nicht von Apple/Google gegengeprüft).

Kennzeichnung:
- **[belegt]** steht in der genannten Quelle.
- **[abgeleitet]** eigene Schlussfolgerung aus belegten Fakten.
- **[NICHT VERIFIZIERT]** konnte anhand einer offiziellen Quelle nicht bestätigt werden.

Die drei NXP-PDFs (Datenblatt NT4H2421Gx Rev. 3.0, AN12196 Rev. 2.0, AN10922 Rev. 2.2) wurden im Volltext ausgewertet; Abschnittsnummern beziehen sich darauf.

## Kurzfazit

1. Das MVP mit NTAG 424 DNA und SUN-URL ist ohne jede externe Freigabe umsetzbar.
2. SUN beweist "dieser echte Tag wurde gelesen und lieferte Zählerstand n". Es beweist weder Ort, Zeitpunkt, Person noch Kauf. NXP nennt die Zählerprüfung im Backend ausdrücklich eine Mindestanforderung.
3. Auf dem iPhone muss der Kunde eine Benachrichtigung antippen. Ab Android 17 gilt dasselbe auch für Android.
4. Apple-Wallet- und Google-Wallet-Karten mit Updates sind mit normalen Entwicklerkonten machbar; Google verlangt eine Freischaltung (Publishing Access).
5. Der "aktive Stempel" (Apple VAS / Google Smart Tap) hängt an einem Apple-NFC-Zertifikat, an zertifizierter Reader-Hardware und an nicht öffentlichen Protokollspezifikationen. Ein Eigenbau-Reader ist ohne Apples Reader-Programm nicht realistisch.

---

## a) NXP NTAG 424 DNA

### Chip-Eckdaten

| Eigenschaft | Wert | Quelle |
|---|---|---|
| Standard | ISO/IEC 14443-4, NFC Forum Type 4 Tag | [belegt] Datenblatt Kap. 1 und 2; AN12196 Kap. 1.4 |
| Speicher | 3 Dateien: CC-Datei 32 Byte, NDEF-Datei 256 Byte, geschützte Datei 128 Byte | [belegt] Datenblatt Kap. 2 und 8.2.3 |
| Schlüssel | 5 kundendefinierte AES-128-Schlüssel (AppKey 0 bis 4) mit Schlüsselversion; zusätzlich 4 werkseitige OriginalityKeys | [belegt] Datenblatt Kap. 2 und 8.2.4.2/8.2.4.5 |
| Krypto | AES-128, optional LRP (Schutz gegen Seitenkanalangriffe) | [belegt] Datenblatt Kap. 2 |
| Zertifizierung | Common Criteria EAL4 für Hard- und Software | [belegt] Datenblatt Kap. 2; https://www.nxp.com/products/NTAG424DNA |
| Haltbarkeit | 50 Jahre Datenerhalt, mindestens 200.000 Schreibzyklen | [belegt] Datenblatt Kap. 2 |
| UID | 7 Byte, optional Random ID | [belegt] Datenblatt Kap. 2 |
| Echtheit | ECC-Originalitätssignatur (secp224r1, 56 Byte) über die UID | [belegt] AN12196 Kap. 7.2 |

Quellen: https://www.nxp.com/docs/en/data-sheet/NT4H2421Gx.pdf, https://www.nxp.com/docs/en/application-note/AN12196.pdf

### SUN / SDM: Funktionsweise

- **Begriffe.** Secure Dynamic Messaging (SDM) erlaubt vertraulichen und integritätsgeschützten Datenaustausch ohne vorherige Authentisierung. Die Secure Unique NFC Message (SUN) gilt nur für die NDEF-Datei: dynamische Werte werden bei jedem Tap ASCII-kodiert in die NDEF-Nachricht (z. B. URL) gespiegelt. [belegt] AN12196 Kap. 3
- **Kein App-Zwang.** Der Tag liefert bei jedem Tap eine eindeutige, gesicherte NDEF-Nachricht; Android- und iOS-Geräte öffnen den Link ohne eigene App. [belegt] AN12196 Kap. 1
- **Was gespiegelt werden kann.** UID, Zähler, Teile der statischen Daten, TagTamper-Status, CMAC; Position und Trenner frei wählbar, Spiegel dürfen sich nicht überlappen. Gespiegelt wird nur im nicht authentisierten Zustand. [belegt] AN12196 Kap. 3.1
- **PICCData.** Besteht aus UID und SDMReadCtr; im Klartext 14 bzw. 6 ASCII-Zeichen. Beispiel von NXP: `https://ntag.nxp.com/424?uid=04C767F2066180&ctr=000001&c=54A45B2C3A558765`. [belegt] AN12196 Kap. 3.4.1
- **Verschlüsselte PICCData.** `PICCENCData = E(KSDMMetaRead; PICCDataTag || UID || SDMReadCtr || RandomPadding)`, ein 16-Byte-Block, als 32 ASCII-Zeichen gespiegelt. AES im CBC-Modus mit Null-IV. Das PICCDataTag-Byte kodiert, ob UID (Bit 7) und Zähler (Bit 6) enthalten sind, sowie die UID-Länge. Beispiel: `https://ntag.nxp.com/424?e=EF963FF7828658A599F3041510671E88&c=94EED9EE65337086`. [belegt] AN12196 Kap. 3.4.2; Datenblatt Kap. 9.3.4.1
- **SDMReadCtr.** 24-Bit-Zähler, wird beim Aktivieren von SDM auf 0 gesetzt. Im nicht authentisierten Zustand wird er vor dem ersten Lesekommando um 1 erhöht; weitere Lesevorgänge in derselben Sitzung erhöhen ihn nicht. Bei Erreichen von FFFFFFh (oder des optionalen SDMReadCtrLimit) liefert der Tag einen Fehler. In der URL steht er MSB-first, in den Kryptoberechnungen LSB-first. [belegt] Datenblatt Kap. 9.3.1 und 9.3.2; AN12196 Kap. 3.2 und 6.6
- **Session-Schlüssel.** Abgeleitet per CMAC aus dem SDMFileReadKey über Session-Vektoren:
  - `SV1 = C3 3C 00 01 00 80 || UID || SDMReadCtr` ergibt `SesSDMFileReadENCKey = MAC(SDMFileReadKey; SV1)`
  - `SV2 = 3C C3 00 01 00 80 [|| UID] [|| SDMReadCtr] [|| ZeroPadding]` ergibt `SesSDMFileReadMACKey = MAC(SDMFileReadKey; SV2)`
  - 3CC3h/C33Ch sind Labels für MAC bzw. Verschlüsselung, 0001h Zähler, 0080h Schlüssellänge. [belegt] Datenblatt Kap. 9.3.9.1; AN12196 Kap. 3.3
- **SDMMAC.** `SDMMAC = MACt(SesSDMFileReadMACKey; DynamicFileData[SDMMACInputOffset .. SDMMACOffset-1])`. Der CMAC wird auf 8 Byte gekürzt (16 ASCII-Zeichen in der URL). Sind Eingabe- und MAC-Offset gleich, wird über eine leere Eingabe gerechnet. [belegt] AN12196 Kap. 3.4.4; Datenblatt Kap. 9.3.7. Bei der Kürzung bleiben die geradzahligen Bytes erhalten (AN12196 Kap. 2, Definition MACt; Datenblatt Kap. 9.1.3).
- **Optional: verschlüsselte Dateidaten** (SDMENCFileData) mit dem ENC-Session-Schlüssel und einem aus dem Zähler abgeleiteten IV. [belegt] AN12196 Kap. 3.4.3

**Prüfablauf im Backend** [abgeleitet aus AN12196 Kap. 3.4.2.2 und 3.4.4.2]:
1. `e` mit SDMMetaReadKey entschlüsseln (AES-CBC, IV = 0), PICCDataTag prüfen, UID und Zähler entnehmen.
2. SDMFileReadKey für diese UID bestimmen (ggf. diversifiziert), SV2 bilden, Session-MAC-Schlüssel ableiten.
3. CMAC über den definierten URL-Abschnitt rechnen, kürzen, mit `c` vergleichen (konstante Laufzeit).
4. Zähler gegen den gespeicherten Höchststand dieses Tags prüfen; nur strikt grössere Werte akzeptieren und den neuen Stand atomar speichern.

### Schlüsselkonzept

- Fünf AppKeys; Key 0 ist der AppMasterKey. Welche Schlüsselnummer als SDMMetaReadKey und als SDMFileReadKey dient, wird über die Zugriffsrechte der NDEF-Datei (ChangeFileSettings) festgelegt. NXPs Beispielkonfiguration nutzt Key 2 für die PICCData-Verschlüsselung und Key 1 für den MAC. [belegt] Datenblatt Kap. 8.2.4; AN12196 Kap. 5
- **Diversifizierung (AN10922).** Aus einem Masterschlüssel wird je Karte ein eigener Schlüssel abgeleitet, damit ein kompromittierter Schlüssel nur diese eine Karte betrifft. Empfohlenes Verfahren: CMAC-basiert; für AES-128 wird `0x01 || M || Padding` mit M = 1 bis 31 Byte Diversifizierungseingabe (im Beispiel UID, Application ID, System Identifier) per CMAC mit dem Masterschlüssel verarbeitet. [belegt] https://www.nxp.com/docs/en/application-note/AN10922.pdf Kap. 1 und 2.2
- **Wichtige Einschränkung.** Bei verschlüsselten PICCData kennt die Prüfseite die UID vor dem Entschlüsseln nicht. NXP schreibt: Der SDMMetaReadKey darf dann nicht UID-diversifiziert sein und muss auf Systemebene besonders sicher gespeichert werden. [belegt] AN12196 Kap. 3.4.2
- Schlüssel bzw. Masterschlüssel sollen im Backend in einem HSM liegen. [belegt] AN12196 Kap. 8.1

Folgen für Tably [abgeleitet]:
- SDMFileReadKey (MAC) je Tag aus der UID diversifizieren.
- SDMMetaReadKey ist zwangsläufig ein Gruppenschlüssel. Um den Schaden zu begrenzen, kann eine nicht geheime Tag- oder Mandanten-ID im statischen URL-Teil stehen (z. B. `https://t.tably.app/s/<tagId>?e=...&c=...`), über die das Backend den passenden MetaRead-Schlüssel wählt. Diese Variante ist eine eigene Architekturidee und in den NXP-Dokumenten nicht beschrieben.
- AppMasterKey und die ungenutzten Schlüssel ebenfalls vom Werkswert (lauter Nullen in den NXP-Beispielen) auf diversifizierte Werte ändern, sonst kann jeder den Tag umkonfigurieren.

### Was SUN beweist und was nicht

**Beweist** [belegt bzw. abgeleitet aus Datenblatt Kap. 9.3 und AN12196 Kap. 3]:
- Die URL wurde von einem Tag erzeugt, der den geheimen Schlüssel kennt (Echtheit des Tags).
- UID und Zählerstand sind unverfälscht (Integrität über den MAC).
- Jede Kombination aus Tag und Zählerstand ist einmalig; das Backend kann Wiederholungen erkennen.

**Beweist nicht:**
- **Keinen Kauf.** Der Tag weiss nichts über Kasse oder Bon. [abgeleitet]
- **Keine Anwesenheit des Einlösenden und keinen Zeitpunkt.** NXP schreibt: Da SDM freies Lesen ohne Reader-Authentisierung erlaubt, kann jeder die Nachricht auslesen; ein Angreifer kann eine oder mehrere Nachrichten auslesen, speichern und später beim Prüfer abspielen. Wer dieses Restrisiko nicht tragen kann, soll gegenseitige Authentisierung mit eigener App verwenden. [belegt] Datenblatt Kap. 9.3
- **Keine Bindung an ein bestimmtes Handy.** Die URL lässt sich abfotografieren oder weiterleiten; wer sie zuerst beim Server einlöst, erhält den Stempel. Danach ist dieser Zählerstand verbraucht. [abgeleitet aus dem Vorigen]
- **Keinen Schutz vor "Vorratslesen".** Wer den Stempel kurz in der Hand hat, kann mehrere gültige URLs erzeugen und einzeln später einlösen. NXP: mehrfaches Auslesen schützt nicht gegen Angreifer, die ebenfalls mehrfach gelesen haben und in gleicher Reihenfolge abspielen. [belegt] Datenblatt Kap. 9.3

**Von NXP genannte Gegenmassnahmen** [belegt] Datenblatt Kap. 9.3:
- SDMReadCtr je Tag auf der Prüfseite nachführen; bereits gesehene oder ausser der Reihe gespielte Werte ablehnen. NXP: "This is a minimum requirement any verifier should implement."
- Zeitfenster des Angreifers begrenzen, indem Tags regelmässig (z. B. täglich) präsentiert werden müssen.

Zusätzliche Massnahmen für Tably [abgeleitet]: kurze Gültigkeit ab erstem Abruf, Verwerfen aller älteren Zählerstände sobald ein höherer eingelöst wurde (macht Vorrats-URLs wertlos, sobald der Stempel normal weiterbenutzt wird), ein Stempel je Kunde und Zeitraum, Auffälligkeitserkennung (Zählersprünge, Einlösungen ausserhalb der Öffnungszeiten), Sperren verlorener Stempel.

Hinweis zum SDMReadCtrLimit: Damit lässt sich die Zahl der Lesevorgänge begrenzen; NXP weist auf das DoS-Risiko hin. Für einen dauerhaft genutzten Stempel eher ungeeignet. [belegt] AN12196 Kap. 6.6. Der 24-Bit-Zähler reicht für rund 16,7 Mio. Taps. [abgeleitet]

### NTAG 424 DNA TagTamper

- Variante mit vier Pads: zwei für die Antenne, zwei für eine Detektionsschleife. Beim Start prüft der IC die Schleife; ist sie offen, wird das dauerhaft im Speicher vermerkt (TTPermStatus). Der Status kann in die NDEF-Nachricht gespiegelt werden; mit `GetTTStatus` erhält man dauerhaften und aktuellen Status. [belegt] AN12196 Kap. 6.5
- NXP nennt als Zweck "once-opened and current-status detection" für Siegel. [belegt] https://www.nxp.com/products/NTAG424DNA
- Der Tag ist passiv und misst nur im Feld; NXP empfiehlt konstruktive Gegenmassnahmen gegen Öffnen und Wiederverschliessen zwischen zwei Messungen. [belegt] AN12196 Kap. 6.5
- Relevanz für Tably [abgeleitet]: Mit einer Schleife durch das Stempelgehäuse liesse sich erkennen, ob der Tag aus dem Stempel herausgelöst wurde. Für das MVP nicht nötig; Aufwand für Schleifendesign siehe NXP AN11941 (nicht ausgewertet).

### Personalisierungswerkzeuge

| Werkzeug | Angabe | Status |
|---|---|---|
| NXP TagWriter (Android, iOS) | Schreibt NDEF, sperrt, Massenbeschreibung; NTAG 424 DNA ist als unterstütztes Produkt gelistet | [belegt] https://www.nxp.com/design/design-center/software/rfid-developer-resources/nfc-tagwriter-app-by-nxp:NFC-TAGWRITER und AN12196 Kap. 9.1 |
| TagWriter: SDM-/SUN-Konfiguration und Schlüsselwechsel | Auf der NXP-Seite nicht beschrieben | **[NICHT VERIFIZIERT]** |
| NXP TagInfo (Android, iOS) | Detailinfos zu NXP-Tags | [belegt] AN12196 Kap. 9.1 |
| RFIDDiscover (PC) | Evaluierung des NTAG 424 DNA, über NXP DocStore | [belegt] AN12196 Kap. 9.1 |
| TapLinX SDK (Android/Java) | Unterstützt NTAG 424 DNA | [belegt] AN12196 Kap. 9.1 |
| NXPRdLib (C#) | Windows-API, NXP DocStore | [belegt] AN12196 Kap. 9.1 |
| NXP TagXplorer | In AN12196 und auf der Produktseite nicht für NTAG 424 DNA genannt | **[NICHT VERIFIZIERT]** |
| Drittanbieter-Apps und Open-Source-Bibliotheken | keine offizielle Quelle | **[NICHT VERIFIZIERT]** |

AN12196 Kap. 5 enthält den vollständigen Personalisierungsablauf mit APDU-Beispielen (ISOSelect, AuthenticateEV2First, WriteData der NDEF-Datei, ChangeFileSettings mit SDM-Optionen und Offsets, ChangeKey). Ein eigenes Personalisierungswerkzeug auf Basis eines PC/SC-Lesers oder einer Android-App ist damit umsetzbar. [abgeleitet] Hinweis: Eine Web-App kann das nicht, siehe Abschnitt e.

### Stückpreise

NXP nennt auf der Produktseite keinen Preis. [belegt] https://www.nxp.com/products/NTAG424DNA

Händlerpreise für fertige Tags/Inlays (keine offizielle Quelle, Preise laut Suchtreffern vom 15.11.2026, Shopseiten nicht einzeln geöffnet, daher **[NICHT VERIFIZIERT]**):
- 25-mm-Inlay: ca. 0,60 USD bei 1.000 Stück (https://store.gototags.com/simple-nfc-inlay-ntag424-dna-25-mm-circle)
- 25-mm-PET-Tag: 0,99 EUR bei 50, 0,69 EUR bei 1.000 Stück (https://rfid.it/en/nfc-tag-identiv/5308-flexible-pet-25mm-nfc-tag-with-ntag424-dna-chip.html)
- 22-mm-Sticker: 0,72 EUR bei 500, 0,56 EUR bei 2.000 Stück (https://www.shopnfc.com/en/nfc-stickers/487-nfc-stickers-ntag424-dna-d22mm.html)

Grössenordnung: etwa 0,60 bis 1,30 EUR/USD je Tag in Kleinmengen. Preis der TagTamper-Variante: **[NICHT VERIFIZIERT]**.

---

## b) Verhalten der Smartphones beim Tap

### iPhone: Background Tag Reading

Quelle für alle Punkte: https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading

- **Modelle.** "iPhone XS and later support background tag reading." [belegt]
- **Bedingung.** Das System liest Tags im Hintergrund nur, wenn das iPhone "in use" ist. [belegt] Dass damit ein eingeschaltetes Display gemeint ist, folgt aus der Formulierung der Ausnahmeliste ("the display is on and background tag reading is unavailable"). [abgeleitet]
- **Nicht verfügbar**, obwohl das Display an ist, wenn: das Gerät seit dem Start noch nie entsperrt wurde, eine Core-NFC-Lesesitzung läuft, Apple Pay/Wallet in Benutzung ist, die Kamera in Benutzung ist oder der Flugmodus aktiv ist. [belegt]
- **Ablauf.** Das System zeigt bei jedem neu gelesenen Tag eine Benachrichtigung. Erst nach dem Antippen wird die URL geöffnet. Ist das iPhone gesperrt, fordert es zum Entsperren auf. [belegt]
- **Inhalt.** Ausgewertet wird der erste NDEF-URI-Record (Well-Known-Typ "U"). Unterstützt sind u. a. `http/https`; eigene URL-Schemata nicht. Ist keine App mit passendem Universal Link installiert, öffnet sich Safari. [belegt]
- **Ältere iPhones** (vor XS): Apple empfiehlt, zusätzlich eine Lesemöglichkeit in der App anzubieten, weil nicht alle Geräte Background Tag Reading unterstützen. [belegt] Dass iPhone 7 bis X Tags über den NFC-Leser im Kontrollzentrum lesen können, ist **[NICHT VERIFIZIERT]**.

**Was der iPhone-Kunde real tun muss:** Display an (Sperrbildschirm genügt), Barista hält den Stempel an die obere Geräterückseite, Kunde tippt die erscheinende Benachrichtigung an, entsperrt bei Bedarf per Face ID, Safari öffnet die Stempelseite. Kamera-App und Wallet dürfen nicht offen sein. Die genaue Antennenposition und Lesedistanz: **[NICHT VERIFIZIERT]**.

### Android

Quelle: https://developer.android.com/develop/connectivity/nfc/nfc

- Android-Geräte suchen in der Regel nach NFC-Tags, wenn der Bildschirm **entsperrt** ist, sofern NFC in den Einstellungen nicht deaktiviert wurde. [belegt]
- Das Tag-Dispatch-System liest den ersten NDEF-Record und startet die passende Activity; bei einer URI bislang ohne Rückfrage, sofern nur eine App zuständig ist. [belegt]
- **Ab Android 16** lösen Tags mit Weblinks (`http://`, `https://`) `ACTION_VIEW` statt `ACTION_NDEF_DISCOVERED` aus. [belegt]
- **Ab Android 17** erscheint beim Scannen eines solchen Tags eine "open link"-Benachrichtigung; der Link öffnet sich erst nach ausdrücklicher Nutzerinteraktion. [belegt]

### Unterschiede auf einen Blick

| | iPhone (XS und neuer) | Android bis 16 | Android ab 17 |
|---|---|---|---|
| NFC abschaltbar | Flugmodus deaktiviert es | ja, in den Einstellungen | ja |
| Gerätezustand | Display an; gesperrt möglich | Bildschirm entsperrt | Bildschirm entsperrt |
| Nutzeraktion | Benachrichtigung antippen, ggf. entsperren | keine, Browser öffnet direkt | "open link"-Hinweis antippen |
| Blockierende Zustände | Kamera, Wallet, laufende NFC-Sitzung, nie entsperrt | NFC aus, gesperrt | NFC aus, gesperrt |

Konsequenz [abgeleitet]: "Ein Tap und fertig" stimmt künftig auf keiner Plattform mehr wörtlich. Realistisch ist "Tap, einmal antippen". Das Onboarding-Material (Thekenaufsteller) sollte den Antipp-Schritt zeigen. Der QR-Fallback bleibt nötig für Geräte ohne NFC, mit abgeschaltetem NFC und für ältere iPhones.

Dass der Zähler bereits beim Lesen durch das Handy hochzählt, auch wenn der Kunde die Benachrichtigung nicht antippt, folgt aus dem Datenblatt (Erhöhung beim ersten Lesekommando). Das Backend muss also Lücken in der Zählerfolge als normal behandeln. [abgeleitet aus Datenblatt Kap. 9.3.1]

---

## c) Apple Wallet

### Pass-Erzeugung

Quelle: https://developer.apple.com/documentation/walletpasses/building-a-pass
- Schritte: Quelldateien erstellen (`pass.json`, Bilder), Pass Type Identifier anlegen (Reverse-DNS, unter Certificates, Identifiers & Profiles), **Pass Type ID Certificate** per CSR erzeugen, `manifest.json` mit SHA-1-Hashes aller Dateien schreiben, daraus eine **PKCS #7 detached signature** mit dem privaten Schlüssel des Zertifikats erzeugen (Datei `signature`), Verzeichnis zippen und in `.pkpass` umbenennen. [belegt]
- `passTypeIdentifier` und `teamIdentifier` in `pass.json` müssen zu Zertifikat und Entwicklerkonto passen; `passTypeIdentifier` plus `serialNumber` identifizieren einen Pass eindeutig. [belegt]
- Pass-Stile: Boarding Pass, Coupon, Event Ticket, **Store Card**, Generic. [belegt] https://developer.apple.com/wallet/get-started/
- Läuft das Zertifikat ab, funktionieren installierte Pässe weiter, aber es lassen sich keine neuen signieren und keine Updates senden; bei Widerruf funktionieren Pässe nicht mehr richtig. [belegt] https://developer.apple.com/wallet/get-started/
- **WWDR-Zwischenzertifikat** in der Signatur: auf den ausgewerteten Seiten nicht erwähnt. **[NICHT VERIFIZIERT]** (gängige Praxis, in der aktuellen Apple-Doku aber nicht gefunden).
- Kostenpflichtige Mitgliedschaft im Apple Developer Program als Voraussetzung: auf den ausgewerteten Seiten nicht ausdrücklich genannt. **[NICHT VERIFIZIERT]**

### Verteilung

Quelle: https://developer.apple.com/documentation/walletpasses/distributing-and-updating-a-pass
- Wege: aus einer App, per App Clip, über eine Webseite mit "Add to Apple Wallet"-Button (Download des Passes) oder als E-Mail-Anhang. [belegt]
- Mehrere Pässe als `.pkpasses`-Bundle (bis 10 Pässe / 150 MB). [belegt]
- MIME-Typ `application/vnd.apple.pkpass` für Einzelpässe: auf der Seite nicht genannt. **[NICHT VERIFIZIERT]**

### Update-Mechanismus

Quellen: https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes und https://developer.apple.com/documentation/walletpasses
- Im Pass stehen `webServiceURL` und `authenticationToken`. [belegt]
- Der eigene Server implementiert die Endpunkte: Register a Pass for Update Notifications, Get the List of Updatable Passes, Send an Updated Pass, Unregister a Pass for Update Notifications, Log a Message. [belegt]
- Registrierung: `POST {webServiceURL}/v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}` mit Header `Authorization: ApplePass {authenticationToken}` und dem Push-Token im Body; Antworten 201, 200, 401. [belegt] https://developer.apple.com/documentation/walletpasses/register-a-pass-for-update-notifications
- Pfade der übrigen vier Endpunkte: nicht einzeln abgerufen. **[NICHT VERIFIZIERT]** (Namen belegt, Pfade nicht).
- Push: Der Server sendet über APNs eine Benachrichtigung mit **leerem JSON-Objekt** an das registrierte Push-Token, authentisiert mit demselben Zertifikat und Schlüssel, mit dem der Pass signiert wurde. Nur in der Produktionsumgebung. Ungültige Tokens sind zu löschen. Danach fragt das Gerät die Liste geänderter Seriennummern ab und lädt den neuen Pass. [belegt]
- HTTPS ist in Produktion Pflicht. [belegt]
- Sichtbare Änderungsmeldung: Nur wenn ein Feld einen `changeMessage`-Formatstring mit `%@` enthält, zeigt das System beim Update eine Benachrichtigung (z. B. "Du hast jetzt %@ Stempel"). Gilt nicht für watchOS. [belegt] https://developer.apple.com/documentation/walletpasses/passfieldcontent
- Mengen- oder Frequenzlimits für Pass-Updates: in den ausgewerteten Seiten keine Angabe. **[NICHT VERIFIZIERT]**

Konsequenz [abgeleitet]: Apple Wallet kennt keine frei formulierbaren Marketing-Pushes. Nachrichten entstehen als Nebenwirkung einer Feldänderung mit `changeMessage` oder über Orts-/Zeitrelevanz. Win-back-Nachrichten müssen als Änderung eines Pass-Feldes umgesetzt werden.

### NFC-Pässe / Value Added Services (VAS)

- Ein Pass kann ein `nfc`-Objekt enthalten: `message` (Nutzlast an das Terminal, höchstens 64 Byte), `encryptionPublicKey` (Base64-kodierter X.509 SubjectPublicKeyInfo mit ECDH-Schlüssel P-256), optional `requiresAuthentication`. [belegt] https://developer.apple.com/documentation/walletpasses/pass/nfc-data.dictionary
- "Adding NFC to a Pass requires a special entitlement issued by Apple." [belegt] gleiche Quelle
- Beantragung: Wer einen kontaktlosen Pass für Apple Pay entwickeln will, stellt eine **NFC-Zertifikatsanfrage** über https://developer.apple.com/contact/passkit/. [belegt] https://developer.apple.com/wallet/loyalty-passes/. Das Formular liegt hinter dem Apple-Login; Felder, Kriterien, Bearbeitungsdauer und Ablehnungsquote: **[NICHT VERIFIZIERT]**.
- Apple Pay Value Added Services (VAS) ist das Protokoll, über das kontaktlose Terminals per NFC mit Apple-Geräten kommunizieren. [belegt] https://developer.apple.com/wallet/loyalty-passes/
- Laut Apple müssen **drei Komponenten zertifiziert** sein: die kontaktlosen Pässe (bzw. der Pass-Anbieter), die Terminals/Reader (müssen Apple Pay akzeptieren und VAS-zertifiziert sein) und die POS-Software (Modi "VAS Only" und "Payment and VAS"). [belegt] gleiche Quelle
- Reader-Hersteller treten dem **WPC Reader Program** bei (http://mfi.apple.com/wpc-login/); Apple führt dann durch die Zertifizierung je Terminal(-familie). Zertifizierte Reader lassen sich unter https://mfi.apple.com/reader-search/ suchen. [belegt] gleiche Quelle
- Drei Nutzungsarten: One-tap (Pass zusammen mit Apple-Pay-Zahlung), Two-tap, Rewards-only ohne Zahlung. [belegt] gleiche Quelle
- Von Apple beispielhaft genannte Pass-Anbieter: Airship, Lava, Passcreator, PassEntry, PassKit, Paytronix, Pronto CX, Punchh, Stell, Vibes. [belegt] gleiche Quelle

### Reader-Hardware (Herstellerangaben)

| Gerät | Angabe des Herstellers | Quelle |
|---|---|---|
| Dot Origin VTAP (VTAP100, VTAP50, VTAP25-Modul) | "Certified for Apple VAS, Google Smart Tap and Apple ECP2/Access Control"; "platform independent, no SDK required". Konfiguration: ECC-Privatschlüssel als `private#.pem` (max. 6 Slots, werden in Hardware abgelegt), in `config.txt` `VAS1MerchantID` mit Key-Slot für Apple und `ST1CollectorID` mit Key-Slot für Google | https://www.vtapnfc.com/, https://www.vtapnfc.com/downloads/VTAP_Configuration_Guide.pdf (über Suchtreffer, PDF nicht im Volltext geprüft) |
| Socket Mobile SocketScan S550 | Laut Hersteller Apple-VAS-zertifiziert (Meldung Dezember 2023) und Google Smart Tap unterstützt; Bluetooth-Reader | https://www.socketmobile.com/products/s550 (über Suchtreffer) |
| ACS WalletMate / WalletMate II | Laut Hersteller Apple VAS (bzw. "Apple MFi", ECP 1.0/2.0) und Google Smart Tap zertifiziert, PC/SC und CCID; nur VAS, kein Zahlungsterminal | https://www.acs.com.hk/en/products/548/walletmate-mobile-wallet-nfc-reader-apple-vas-google-smart-tap-certified/ (über Suchtreffer, Seite selbst HTTP 403) |

Google listet Dot Origin, Socket Mobile und Advanced Card Systems Ltd. unter den Smart-Tap-fähigen Terminalanbietern. [belegt] https://developers.google.com/wallet/smart-tap/introduction/overview. Die Apple-Zertifizierung der einzelnen Modelle wurde nicht in Apples Reader-Suche gegengeprüft. **[NICHT VERIFIZIERT]** (nur Herstellerangaben). Preise der Reader: **[NICHT VERIFIZIERT]**.

### Eigenbau-Reader: Anforderungen und Hürden

Was ein eigener "aktiver Stempel" können müsste [abgeleitet aus den belegten Fakten oben]:
- Als NFC-Reader (Initiator) ein Feld erzeugen und ISO-14443-4 sprechen, also Akku, Reader-IC und Antenne im Stempel.
- Das Apple-VAS-Protokoll implementieren, einschliesslich der Signalisierung, die das iPhone zum automatischen Präsentieren des Passes veranlasst (Apple nennt bei den ACS-/VTAP-Angaben "ECP").
- Den zum `encryptionPublicKey` gehörenden ECC-Privatschlüssel sicher im Gerät halten und die Pass-Nutzlast entschlüsseln.
- Google Smart Tap mit Collector ID und eigenem Schlüssel sprechen.
- Die gelesene Kundenkennung online an das Backend senden (WLAN/BLE/Mobilfunk).

Warum das nicht ohne Weiteres geht:
- Apple verlangt VAS-zertifizierte Terminals und führt Hersteller über das WPC Reader Program. [belegt] https://developer.apple.com/wallet/loyalty-passes/
- Die VAS-Protokollspezifikation ist in der öffentlichen Apple-Dokumentation nicht enthalten; die Loyalty-Seite beschreibt das Protokoll nicht. [belegt, dass sie dort fehlt] Dass sie nur unter NDA im Rahmen des Programms erhältlich ist: **[NICHT VERIFIZIERT]**.
- Google stellt die Smart-Tap-Dokumentation Terminalanbietern erst nach Kontaktaufnahme für die Zertifizierung bereit. [belegt] https://developers.google.com/wallet/smart-tap/introduction/overview
- Ohne Apples NFC-Zertifikat lässt sich kein Pass mit `nfc`-Schlüssel ausgeben; die Reader-Seite allein nützt nichts. [belegt]

Realistischer Weg für die Ausbaustufe [abgeleitet]: ein zertifiziertes OEM-Modul (z. B. VTAP25/VTAP50-OEM, ACS WalletMate II Mini) in das Stempelgehäuse integrieren und früh die NFC-Zertifikatsanfrage bei Apple stellen. Ob Apple das Zertifikat einem jungen SaaS-Anbieter direkt erteilt oder auf einen der gelisteten Pass-Anbieter verweist: **[NICHT VERIFIZIERT]**.

---

## d) Google Wallet

### Loyalty Class und Loyalty Object

- Ein Pass entsteht aus einer **Passes Class** (gemeinsame Vorlage, Eigenschaften für alle Pässe) und einem **Passes Object** (individueller Pass eines Nutzers), verknüpft über `classId`. IDs folgen dem Muster `ISSUER_ID.eigene_kennung`. Änderungen an der Class wirken sofort auf alle Objects; Nutzer sehen sie bei der nächsten Synchronisierung. [belegt] https://developers.google.com/wallet/retail/loyalty-cards/overview/how-classes-objects-work
- Für Tably [abgeleitet]: eine LoyaltyClass je Mandant bzw. Kartenprogramm, ein LoyaltyObject je Endkunde mit Stempelstand.

### Issuer-Konto und Freischaltung

- Issuer-Konto in der Google Pay & Wallet Console anlegen, Nutzungsbedingungen akzeptieren; für die REST-API zusätzlich die Google Wallet API in der Google Cloud Console aktivieren. [belegt] https://developers.google.com/wallet/retail/loyalty-cards/getting-started/issuer-onboarding
- Neue Konten starten im **Demo Mode**: Pässe nur für Admins/Entwickler des Kontos und eingetragene Testkonten, mit Zusatz "[TEST ONLY]". [belegt] https://developers.google.com/wallet/retail/loyalty-cards/test-and-go-live/request-publishing-access
- **Publishing Access** wird in der Console beantragt, nachdem das Business Profile (inkl. Payments Profile) ausgefüllt ist; Google prüft das Konto. Eine Bearbeitungsdauer nennt Google nicht. [belegt] gleiche Quelle
- Ob ein Plattformanbieter für jeden Mandanten ein eigenes Issuer-Konto braucht oder alle Mandanten unter einem Konto führen darf: für Loyalty-Pässe **[NICHT VERIFIZIERT]** (für Smart Tap verlangt Google je Händler ein eigenes Redemption-Issuer-Konto, siehe unten).

### "Add to Google Wallet" per JWT

Quelle: https://developers.google.com/wallet/retail/loyalty-cards/overview/add-to-google-wallet-flow
- JWT mit `iss`, `aud` ("google"), `typ` ("savetowallet"), `origins` und `payload` (Classes/Objects oder Verweise darauf) serverseitig mit dem Schlüssel eines Google-Cloud-Service-Accounts signieren (Beispiel: RS256). [belegt]
- Link: `https://pay.google.com/gp/v/save/<signiertes_jwt>`, hinter dem "Add to Google Wallet"-Button. [belegt]
- Objekte können vorab per REST angelegt und im JWT referenziert oder direkt im JWT eingebettet werden. [belegt]
- Längenlimit für das JWT: auf der Seite nicht genannt. **[NICHT VERIFIZIERT]**

### Updates und Benachrichtigungen

- Classes und Objects werden über die REST-API erstellt, gelesen und aktualisiert; `UPDATE` ersetzt vollständig, `PATCH` ändert einzelne Felder. [belegt] https://developers.google.com/wallet/retail/loyalty-cards und https://developers.google.com/wallet/smart-tap/introduction/pass-configuration
- Push: Add-Message-API mit `message_type = TEXT_AND_NOTIFY` (statt `TEXT`) für Class oder Object. [belegt] https://developers.google.com/wallet/generic/use-cases/trigger-push-notifications
- **Limit: höchstens drei benachrichtigende Nachrichten in 24 Stunden**; darüber hinaus Antwort `QuotaExceededException`. Google kann zusätzlich drosseln, wenn es Spam vermutet. Nutzer müssen Benachrichtigungen für den Pass aktiviert haben. [belegt] gleiche Quelle. Ob das Limit je Pass oder je Issuer gilt, sagt die Seite nicht eindeutig. **[NICHT VERIFIZIERT]**
- Die Quelle liegt im Dokumentationszweig "generic"; die Beispiele dort verwenden eine LoyaltyClass. Eine eigene Loyalty-Seite mit denselben Limits wurde nicht abgerufen. [belegt mit dieser Einschränkung]
- Standortbezogene Hinweise: bis zu 10 Händlerstandorte je Class und je Object. [belegt] gleiche Quelle
- Ob eine reine Feldänderung (Stempelstand) ohne Add-Message eine sichtbare Benachrichtigung auslöst: **[NICHT VERIFIZIERT]**

### Smart Tap

Quellen: https://developers.google.com/wallet/smart-tap/introduction/overview, https://developers.google.com/wallet/smart-tap/introduction/issuer-configuration, https://developers.google.com/wallet/smart-tap/introduction/merchant-configuration, https://developers.google.com/wallet/smart-tap/introduction/pass-configuration
- Smart Tap löst Pässe ein, indem das Handy an ein kompatibles NFC-Terminal gehalten wird. [belegt]
- Voraussetzungen laut Google: Class und Objects vorhanden; Beziehung zu einem Smart-Tap-fähigen Terminalanbieter; Pässe für Smart Tap konfiguriert; Daten gelangen vom Terminal ins eigene System; Pass danach aktualisieren. [belegt]
- **Redemption Issuer**: Issuer-Konto des einlösenden Händlers. Ein bestehendes Konto darf nur wiederverwendet werden, wenn es ausschliesslich Classes dieses Händlers enthält; sonst ist ein neues anzulegen. [belegt]
- **Schlüssel**: Öffentlichen Schlüssel (`.pem`) mit Schlüsselversion in der Console (Google Wallet API, Additional features, Add an authentication key) oder per API (`smartTapMerchantData.authenticationKeys`) hochladen. [belegt]
- **Collector ID**: wird nach dem Hochladen des Schlüssels vergeben (`smartTapMerchantData.smartTapMerchantId`). Collector ID, Schlüsselversion und privater Schlüssel werden auf dem Terminal konfiguriert. [belegt]
- **Pass-Konfiguration**: Class mit `enableSmartTap = true` und `redemptionIssuers` (Liste der Redemption-Issuer-IDs); Object mit `smartTapRedemptionValue` (Wert, der beim Tap ans Terminal geht). [belegt]
- **Terminals**: müssen das Smart-Tap-Protokoll unterstützen. Google listet kompatible Anbieter, darunter Advanced Card Systems, Dot Origin, Elatec, Famoco, HID, Ingenico, Pax, Socket Mobile, SpringCard, Sunmi, Verifone, Zebra. Terminalanbieter, die sich zertifizieren wollen, müssen den Support kontaktieren, um die Dokumentation zu erhalten. [belegt]
- Eine gesonderte Zugangsfreigabe für Händler/Issuer (über Publishing Access hinaus) nennen die ausgewerteten Seiten nicht; die verlinkte "Prerequisites"-Seite wurde nicht abgerufen. **[NICHT VERIFIZIERT]**

Folge für die Mandantenarchitektur [abgeleitet]: Für Smart Tap braucht jeder Tably-Mandant ein eigenes Redemption-Issuer-Konto mit eigener Collector ID. Das ist ein manueller oder zumindest API-gestützter Onboarding-Schritt je Mandant und sollte im Datenmodell früh vorgesehen werden.

---

## e) Web NFC

- Web NFC (`NDEFReader`) erlaubt Webseiten, NDEF-Nachrichten zu lesen und zu schreiben sowie Tags schreibgeschützt zu machen. [belegt] https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API
- Verfügbar in **Chrome für Android ab Version 89** (`makeReadOnly()` ab 100). MDN: experimentell, "Limited availability", nicht Baseline. [belegt] https://developer.chrome.com/docs/capabilities/nfc und MDN
- Die Spezifikation ist ein Entwurf der Web NFC Community Group, keine W3C-Empfehlung. [belegt] https://w3c-cg.github.io/web-nfc/
- Nicht unterstützt: Low-Level-I/O (ISO-DEP, NFC-A/B/F), Host Card Emulation, Peer-to-Peer. [belegt] Chrome-Doku und Spezifikation
- Nur HTTPS, nur Top-Level-Frame, Berechtigungsabfrage, Aufruf nur nach Nutzergeste, Seite muss sichtbar und Gerät entsperrt sein. [belegt] Chrome-Doku
- Safari/iOS: Die Chrome-Seite beschreibt nur Android; eine ausdrückliche WebKit-Aussage wurde nicht gefunden. Dass Safari Web NFC nicht unterstützt: **[NICHT VERIFIZIERT]** anhand einer WebKit-Quelle (MDN-Einstufung "nicht in einigen der meistgenutzten Browser" stützt es indirekt).

**Relevanz für Tably:**
- **Für den Stempelvorgang irrelevant.** Der Tap funktioniert über das Betriebssystem (URL öffnen), nicht über eine Web-API. Web NFC würde eine bereits geöffnete Seite, eine Berechtigungsabfrage und Chrome auf Android voraussetzen und schliesst iPhones aus. [abgeleitet]
- **Für die Personalisierung ungeeignet.** SDM-Konfiguration und Schlüsselwechsel brauchen ISO-DEP/APDU-Zugriff (AuthenticateEV2First, ChangeFileSettings, ChangeKey), den Web NFC nicht bietet. Dafür ist eine native Android-App (z. B. mit TapLinX) oder ein PC/SC-Leser nötig. [abgeleitet aus AN12196 Kap. 5 und den Web-NFC-Grenzen]
- **Möglicher Nebennutzen:** einfache Diagnose im Händler-Dashboard auf Android ("Stempel testen": NDEF lesen und URL-Struktur prüfen). Kein MVP-Bedarf. [abgeleitet]

---

## f) Was ist sofort machbar, was braucht Freigaben?

| Baustein | Sofort machbar? | Was nötig ist | Externe Abhängigkeit |
|---|---|---|---|
| NTAG-424-DNA-Tags kaufen | ja | Bestellung bei Händlern, ca. 0,60 bis 1,30 EUR je Stück (Preis nicht verifiziert) | keine |
| Tags personalisieren (URL, SDM, Schlüssel) | ja | Android-App oder PC/SC-Leser mit eigener Software nach AN12196; evtl. TagWriter (SDM-Umfang nicht verifiziert) | keine |
| SUN-Prüfung im Backend (AES-CMAC, Zähler) | ja | Eigene Implementierung nach AN12196/Datenblatt, sichere Schlüsselablage | keine |
| Stempeln per Tap im Browser (iPhone XS+, Android) | ja | HTTPS-Domain; Nutzer tippt Benachrichtigung an | keine |
| QR-Fallback | ja | Eigene Umsetzung | keine |
| Apple-Wallet-Pass (.pkpass) | ja | Apple-Entwicklerkonto, Pass Type ID, Pass-Type-ID-Zertifikat | Apple-Konto (Standardprozess) |
| Apple-Wallet-Updates | ja | Eigener Web Service nach Apple-Vorgabe, APNs-Verbindung mit dem Pass-Zertifikat | keine weitere |
| Google-Wallet-Pass im Testbetrieb | ja | Issuer-Konto, Service Account, Wallet API aktiviert | Google-Konto (Standardprozess) |
| Google-Wallet-Pass für echte Kunden | nein, erst nach Freigabe | Business Profile, Antrag auf Publishing Access, Prüfung durch Google | **Freigabe durch Google**, Dauer unbekannt |
| Google-Wallet-Benachrichtigungen | ja, nach Publishing Access | Add Message mit `TEXT_AND_NOTIFY`, max. 3 in 24 h | Limit von Google |
| Web NFC | technisch ja, aber nicht sinnvoll | nur Chrome/Android | keine |
| TagTamper-Variante | ja | Schleifendesign im Stempelgehäuse | keine |
| Apple-Pass mit NFC (VAS) | **nein** | NFC-Zertifikat/Entitlement von Apple, Antrag über Apple-Formular | **Einzelfreigabe durch Apple**, Kriterien nicht öffentlich |
| Reader für Apple VAS | **nein** im Eigenbau | zertifizierter Reader oder zertifiziertes OEM-Modul (Dot Origin VTAP, Socket Mobile S550, ACS WalletMate laut Herstellern) | **Hardwarekauf**; Eigenentwicklung nur über Apples WPC Reader Program |
| Google Smart Tap je Mandant | bedingt | Redemption-Issuer-Konto je Händler, Schlüsselpaar, Collector ID, Class/Object-Felder | Smart-Tap-fähiges Terminal; Konto je Händler |
| Eigener Smart-Tap-Reader | **nein** | Protokolldokumentation und Zertifizierung über Google-Support | **Zertifizierung durch Google** |

---

## Liste der nicht verifizierten Punkte

1. Umfang der NTAG-424-DNA-Unterstützung in NXP TagWriter (SDM-Konfiguration, Schlüsselwechsel).
2. Eignung von NXP TagXplorer für NTAG 424 DNA.
3. Drittanbieter-Apps und Open-Source-Bibliotheken zur Personalisierung.
4. Stückpreise (nur Händler-Suchtreffer, keine NXP-Angabe); Preis der TagTamper-Variante.
5. Lesbarkeit von NFC-Tags auf iPhone 7 bis X über das Kontrollzentrum; Antennenposition und Lesedistanz am iPhone.
6. WWDR-Zwischenzertifikat als Bestandteil der Pass-Signatur und Developer-Program-Mitgliedschaft als Voraussetzung (in der aktuellen Apple-Doku nicht gefunden).
7. MIME-Typ für Einzelpässe; Pfade von vier der fünf Apple-Web-Service-Endpunkte; Frequenzlimits für Apple-Pass-Updates.
8. Inhalt, Kriterien und Dauer der Apple-NFC-Zertifikatsanfrage (Formular hinter Login); ob Apple das Zertifikat kleinen Plattformanbietern direkt erteilt.
9. Apple-VAS-Zertifizierung der genannten Reader (nur Herstellerangaben, nicht in Apples Reader-Suche geprüft); Reader-Preise.
10. Verfügbarkeit der Apple-VAS-Spezifikation nur unter NDA.
11. Ob das Google-Limit von drei Benachrichtigungen je Pass oder je Issuer gilt; ob reine Feldupdates benachrichtigen; JWT-Längenlimit.
12. Ob Google für Smart Tap eine gesonderte Zugangsfreigabe für Issuer verlangt (Prerequisites-Seite nicht abgerufen); ob Loyalty-Pässe mehrerer Mandanten unter einem Issuer-Konto zulässig sind.
13. Fehlende Web-NFC-Unterstützung in Safari anhand einer WebKit-Quelle.
