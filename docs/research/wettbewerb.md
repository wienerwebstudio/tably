# Wettbewerbsanalyse: digitale Stempelkarten

Stand der Recherche: 15.11.2026. Grundlage sind ausschliesslich öffentlich abrufbare Seiten der Anbieter (Startseite, Preise, Features, Hilfe/Docs). Jede Aussage trägt ihre Quelle. Was nicht auffindbar war, ist als **nicht öffentlich auffindbar** markiert. Eigene Schlussfolgerungen sind als **Einschätzung** gekennzeichnet.

Wichtige Einschränkung vorab: **tapstamp.co.uk war nicht abrufbar** (HTTP 403, Cloudflare-Sperre, sowohl Startseite als auch `/pricing`). Alle Angaben zu TapStamp stammen deshalb aus Drittverzeichnissen (SourceForge, Product Hunt, Suchtreffer zu Capterra/GetApp/G2/Software Advice) und sind entsprechend schwächer belegt.

## Kurzfazit

1. **Ekhtem (Dubai) ist praktisch das Tably-Konzept, bereits am Markt**: 3D-gedruckter NFC-Stempel, Chip erzeugt pro Tap einen einmal gültigen Link, Karte im Browser plus Apple/Google Wallet, ohne Kunden-App und ohne Personal-App. Das Alleinstellungsmerkmal ist also nicht mehr weltweit einzigartig, im DACH-Raum aber (soweit auffindbar) unbesetzt.
2. **Stamply (CH) und Boomerang (US)** arbeiten mit QR-Scan durch das Personal (Scanner-Web-App/PWA) bzw. Kiosk-Selbstscan. NFC kommt auf ihren Seiten nicht vor.
3. **Stamply basiert sehr wahrscheinlich auf Boomerang (White Label)** (Einschätzung, Begründung unten). Der lokale DACH-Wettbewerber ist damit ein Wiederverkäufer ohne eigene Technologie.
4. **TapStamp (UK)** nutzt einen fest montierten NFC-"Pod", an den der Kunde sein Handy hält, und setzt laut Verzeichnissen auf eine eigene Kunden-App (iOS/Android), also mit Installationshürde.

---

## 1. Stamply (stamply.ch)

**Positionierung.** Digitale Treuekarten für lokale Schweizer KMU (Cafés, Restaurants, Coiffeure, Hotels), Karte in Apple Wallet / Google Wallet, keine Kunden-App. Quelle: https://www.stamply.ch/

**Kartentypen.**
- Auf der Website beworben: stempel-, punkte-, stufen- und mitgliederbasierte Treue. Quelle: https://www.stamply.ch/ (Footer-Links `/loyalty-modules/...`)
- In der Wissensdatenbank dokumentiert: Stempelkarte, Abonnement (Multipass), Cashback, Geschenkkarte, Gutschein, Mitgliedskarte, Rabattkarte, Belohnungskarte. Quelle: https://stamply.gitbook.io/stamply-knowledge-base/llms.txt

**Funktionsumfang.** Kundenprofile/CRM mit Filter und RFM-Analyse, Import/Export, Push-Nachrichten, Geo-Push, Empfehlungsprogramm, Feedback- und Google-Review-Sammlung, Dashboard mit Wochenbericht, Workflow-Builder für Automatisierungen, API und Webhooks. Quellen: https://www.stamply.ch/ und https://stamply.gitbook.io/stamply-knowledge-base/llms.txt

**Onboarding.** Vier Schritte: Vorlage wählen und Logo/Farben setzen ("unter 15 Minuten"), Kunden scannen QR-Code und speichern die Karte im Wallet, Personal scannt die Karte, automatische Benachrichtigungen. 14 Tage Test ohne Kreditkarte. Optional begleitetes Setup durch ein Schweizer Team, Go-live "in unter 48 Stunden". Quelle: https://www.stamply.ch/

**Stempelvergabe (technisch).**
- Personal scannt den Code der Wallet-Karte mit der Scanner-App. Diese ist eine Web-Anwendung unter `https://app.stamply.ch/scanner-app/login`, die über "Zum Startbildschirm hinzufügen" abgelegt wird; Login mit E-Mail und Passwort, dann "Scannen" und Anzahl Stempel/Punkte wählen. Quelle: https://stamply.gitbook.io/stamply-knowledge-base/wie-nutze-ich-stamply/scanner-app-installation
- Einschränkung laut Doku: Wer dieselben Zugangsdaten auf mehreren Geräten nutzt, wird ausgeloggt; pro Gerät braucht es ein eigenes Manager-Konto. Quelle: wie oben.
- "Smart Scan Mode": Kunden scannen ihre Karte selbst an einem Smartphone/Tablet des Geschäfts, der Stempel wird automatisch gebucht; Doppelscans werden laut Seite verhindert, das Verfahren wird nicht erklärt. Quelle: https://www.stamply.ch/loyalty-features/smart-scan-mode
- Kassenanbindung: Lightspeed-X, Shopify POS, Square; E-Commerce: Shopify, WooCommerce, Gloria Food. Quelle: https://www.stamply.ch/integrationen. Die Wissensdatenbank nennt zusätzlich ToastPOS. Quelle: https://stamply.gitbook.io/stamply-knowledge-base/llms.txt
- NFC: wird nirgends erwähnt. Quellen: https://www.stamply.ch/, https://www.stamply.ch/loyalty-features/smart-scan-mode

**Hardware.** Keine eigene. Smartphone, Tablet oder PC genügt; druckbares QR-Poster im Starter-Plan. Quelle: https://www.stamply.ch/

**Marketing-Automationen.** Manuelle Push-Nachrichten (Starter); automatische und geplante Push, Geburtstag, Reaktivierung inaktiver Kunden, Empfehlungsprogramm (Business); Geo-Benachrichtigungen; Google-Bewertungen sammeln. Kanäle laut Integrationsseite zusätzlich WhatsApp-Bot, Telegram-Bot, Facebook Messenger, E-Mail (Mailgun/SMTP/Resend), SMS (Twilio), Meta Ads. Quellen: https://www.stamply.ch/, https://www.stamply.ch/integrationen

**Preise (CHF pro Monat).** Quelle: https://www.stamply.ch/preise

| Plan | jährlich | monatlich | Umfang |
|---|---|---|---|
| Starter | 39 | 49 | 1 Karte, 1 Standort, unbegrenzt Mitglieder, Branding, manuelle Push, QR-Poster, Google-Reviews |
| Business | 65 | 79 | 3 Karten, 3 Standorte, automatische/geplante Push, Geburtstag, Reaktivierung, Empfehlungen, Mitarbeiterzugänge |
| Enterprise | 119 | 149 | 10 Karten, 10 Standorte, erweiterte Reports, API, Kassenanbindung, Setup-Service, fester Ansprechpartner |

MwSt.-Angabe, Setup-Gebühren, Add-on-Preise: nicht öffentlich auffindbar.

**Erkennbare Schwächen.**
- Stempeln braucht ein eingeloggtes Gerät mit Kamera am Tresen und mehrere Handgriffe (App öffnen, scannen, Anzahl wählen). Quelle: https://stamply.gitbook.io/stamply-knowledge-base/wie-nutze-ich-stamply/scanner-app-installation
- Automationen erst ab Business (CHF 79/Monat), API und Kasse erst ab Enterprise (CHF 149/Monat). Quelle: https://www.stamply.ch/preise
- Missbrauchsschutz beim Selbstscan nicht nachvollziehbar dokumentiert. Quelle: https://www.stamply.ch/loyalty-features/smart-scan-mode
- **Einschätzung (nicht vom Anbieter bestätigt):** Stamply ist sehr wahrscheinlich ein White-Label von Boomerang. Indizien: Die Seitenstruktur der Stamply-Wissensdatenbank deckt sich nahezu 1:1 mit den Boomerang-Docs (Scanner App je Kartentyp, Kiosk-Modus, Multipass, RFM-Analyse, ToastPOS, Gloria Food, "Marketplace (Beta)", identische FAQ-Titel zu Push); Boomerang verkauft genau dafür einen Agency-Plan mit White Label und eigener Domain. Quellen: https://stamply.gitbook.io/stamply-knowledge-base/llms.txt, https://docs.boomerangme.cards/llms.txt, https://boomerangme.com/pricing

---

## 2. Boomerang (boomerangme.com)

**Positionierung.** Wallet-basierte Loyalty-Plattform für lokale Geschäfte, Agenturen (White Label, Wiederverkauf) und Franchise-Ketten. Seit 2019, in Delaware inkorporiert, laut eigener FAQ 23 Mitarbeitende. Quellen: https://boomerangme.com/, https://docs.boomerangme.cards/support/faq.md

**Kartentypen.** Stempelkarte, Cashback, Mitgliedschaft, Reward (Punkte), Rabatt, Prepaid-Stempelkarte (Multipass), Coupon, Geschenkkarte. Quelle: https://boomerangme.com/

**Funktionsumfang.** Kartendesigner, CRM/Customer Data Platform, Segmentierung und RFM-Analyse, Push/SMS/E-Mail, Empfehlungsprogramm, Feedback, Zwei-Wege-Kommunikation, Analytics, offene API und Webhooks, Zapier/Make/Albato/Pabbly, Shopify, 35+ Sprachen. Quellen: https://boomerangme.com/, https://boomerangme.com/integrations, https://docs.boomerangme.cards/support/faq.md

**Onboarding.** Link zum Google-Unternehmensprofil einfügen; die KI "Richie" erzeugt Karte, Regeln und erste Nachrichten; "etwa 15 Minuten" bis live; 14 Tage Test ohne Kreditkarte; geführter Import von anderen Anbietern. Quelle: https://boomerangme.com/

**Stempelvergabe (technisch).**
- Scanner-App als Progressive Web App im Browser; Personal richtet die Kamera auf die digitale Karte und bucht "in 2 Klicks"; eigene Zugangsdaten je Mitarbeiter mit Auswertung pro Person. Keine native App. Quellen: https://boomerangme.com/customer-engagement/scanner-app, https://docs.boomerangme.cards/support/faq.md
- Kiosk-Modus: Beim Scan werden Stempel/Punkte automatisch gebucht; Schutz nur über eine Verzögerung bis zur nächsten Buchung derselben Karte (Dauer nicht angegeben). Nicht automatisierbar: Cashback, Rabatt, Geschenkkarte und ausgabenbasierte Mechaniken. Quelle: https://docs.boomerangme.cards/scanner-app/kiosk-mode.md
- Kasse: Toast, Square, Lightspeed, Shopify POS, GloriaFood, Altegio dokumentiert. Quelle: https://docs.boomerangme.cards/llms.txt
- NFC: weder auf Produkt-, Integrations- noch Hilfeseiten erwähnt. Quellen: https://boomerangme.com/, https://boomerangme.com/integrations, https://docs.boomerangme.cards/llms.txt

**Hardware.** Keine. Quelle: https://boomerangme.com/

**Marketing-Automationen.** KI-gestützte Angebote über Push/SMS/E-Mail, Journey-Automation, Auto-Push (Geburtstag, Erinnerung, Feedback), Geo-Push. Geo-Push-Details: fester Radius ca. 100 m, auf iOS frei formulierbarer Text und ohne Tageslimit bei jedem Betreten; auf Android bestimmt Google Text und Distanz; nicht für PWA-Karten; maximal 10 Standorte je Sub-Account im höchsten Plan, weitere gegen Gebühr. Quellen: https://boomerangme.com/, https://docs.boomerangme.cards/push-notifications/push-section/geo-push.md

**Preise (USD pro Monat).** Quelle: https://boomerangme.com/pricing

| Plan | monatlich | quartalsweise | jährlich | Kern |
|---|---|---|---|---|
| Business | 199 | 179 | 164 | unbegrenzt Karten, 10 Aktionen, 10 Standorte, 50 Manager-Plätze, Push gratis, Geo-Push, PWA-Scanner, API/Webhooks, Richie AI |
| Agency | 259 | 239 | 214 | zusätzlich White Label, Reseller-Dashboard, Stripe/PayPal, 3 Sub-Accounts inklusive |
| Franchise | 299 | 269 | 249 | zusätzlich Multi-Standort-Verwaltung, Mandantenfähigkeit, POS-Integrationen, Kettenreports |
| Enterprise | auf Anfrage | | | |

Zusatz-Sub-Accounts: Die Preisseite nennt widersprüchlich +15 USD/Monat und +99 USD/Monat ab dem vierten. SMS-Preise: nicht öffentlich auffindbar. Die Startseite spricht von "free to start"; ein dauerhaft kostenloser Plan ist auf der Preisseite nicht ausgewiesen.

**Erkennbare Schwächen.**
- Hoher Einstiegspreis (ab 164 USD/Monat) für ein einzelnes Café. Quelle: https://boomerangme.com/pricing
- Stempeln erfordert ein Gerät mit Kamera und eingeloggtem Personal; der Kiosk-Modus schützt nur per Zeitverzögerung. Quelle: https://docs.boomerangme.cards/scanner-app/kiosk-mode.md
- Sehr breiter Funktionsumfang mit 8 Kartentypen und Reseller-Logik; für Kleinbetriebe komplex (Einschätzung).
- Hosting in den USA und Deutschland (DigitalOcean); Datenstandort also nicht garantiert EU/CH. Quelle: https://docs.boomerangme.cards/support/faq.md

---

## 3. TapStamp (tapstamp.co.uk)

Die Anbieter-Website war nicht abrufbar (HTTP 403). Alle Angaben aus Drittquellen; **nicht am Original verifiziert**.

**Positionierung.** Loyalty-App für britische Kleinbetriebe (Cafés, Barbiere, Restaurants, Salons), gegründet 2026. Quelle: https://sourceforge.net/software/product/TapStamp/

**Kartentypen.** Digitale Stempelkarten mit eigenem Branding; Gutscheine/Angebote. Weitere Kartentypen: nicht öffentlich auffindbar. Quelle: https://sourceforge.net/software/product/TapStamp/

**Funktionsumfang.** Dashboard mit 14 Analytics-Diagrammen, Kundenverwaltung, Push-Nachrichten und Angebote, automatische Geburtstagsprämien, Google-Review-Aufforderung, Gutscheinverteilung, Teamverwaltung mit Rollen, CSV-Export, automatische E-Mail-Reports, Offline-Betrieb ("cache-first"). Quellen: https://sourceforge.net/software/product/TapStamp/, https://www.producthunt.com/products/tapstamp

**Stempelvergabe (technisch).** Der **Kunde** hält sein Handy an einen NFC-"Pod" an der Kasse ("one tap, one stamp, done in under a second", "tamper-proof"); QR-Code als Fallback. Welcher Chip verwendet wird und wie Kopierschutz funktioniert: nicht öffentlich auffindbar. Quelle: https://sourceforge.net/software/product/TapStamp/

**Kunden-App.** Laut Verzeichnissen mit Apps für iPhone und Android (App Store / Google Play); die App sei für Kunden kostenlos und funktioniere offline. Apple-/Google-Wallet-Unterstützung wird nicht erwähnt. Quellen: https://sourceforge.net/software/product/TapStamp/, https://www.producthunt.com/products/tapstamp

**Hardware.** NFC-Pod, laut Suchtreffer zu GetApp batterielos, mit Acrylständer und Infokarte, abgegolten über eine einmalige Setup-Gebühr (Höhe nicht auffindbar). Quellen: Suchtreffer zu https://www.getapp.com/all-software/a/tapstamp/ (Seite selbst HTTP 403), https://sourceforge.net/software/product/TapStamp/

**Onboarding.** Dokumentation und Live-Online-Schulungen, nur Online-Support, nur Englisch. Quelle: https://sourceforge.net/software/product/TapStamp/

**Marketing-Automationen.** Push, Geburtstag, Google-Review, Gutscheine. Geo-Push, Win-back, Empfehlungen: nicht öffentlich auffindbar.

**Preise.** Drei Pläne ab 20 GBP/Monat (Starter), 30 Tage kostenlos testen. Inhalte und Preise der höheren Pläne: nicht öffentlich auffindbar. Product Hunt führt das Produkt als "Free". Quellen: https://sourceforge.net/software/product/TapStamp/, https://www.producthunt.com/products/tapstamp, Suchtreffer zu https://www.softwareadvice.com/product/548852-TapStamp/ (Seite selbst HTTP 403)

**Erkennbare Schwächen.**
- Eigene Kunden-App nötig (Installationshürde), sofern die Verzeichnisangaben stimmen. Quelle: https://sourceforge.net/software/product/TapStamp/
- Fest stehender Pod: Der Kunde stempelt selbst, ohne dass Personal den Vorgang auslöst; wie ein Stempel ohne Kauf verhindert wird, ist nicht dokumentiert (nicht öffentlich auffindbar).
- Sehr junges Produkt ohne Bewertungen; Website sperrt automatisierte Zugriffe. Quelle: https://www.producthunt.com/products/tapstamp

---

## 4. Ekhtem (ekhtem.app)

**Positionierung.** "Tap the stamp. Get a stamp. Come back." NFC-Stempel plus digitale Karte für Geschäfte in Dubai/VAE; Anbieter DAIM SP LLC-FZ. Kein Kunden-App-Download, keine Provision. Quelle: https://ekhtem.app/

**Kartentypen.** Reine Stempelkarte (z. B. 6, 8 oder 10 Stempel bis zur Prämie), optional Mindestumsatz pro Stempel; mehrere Karten (z. B. Kaffee und Desserts) über mehrere Stempel. Punkte, Cashback, Mitgliedschaft: nicht angeboten bzw. nicht öffentlich auffindbar. Quellen: https://ekhtem.app/start, https://ekhtem.app/nfc-loyalty-card

**Stempelvergabe (technisch).** Quelle, soweit nicht anders vermerkt: https://ekhtem.app/nfc-loyalty-card
- Das **Personal** hält den Stempel an das Kunden-Handy. Das Handy öffnet die Kartenseite des Geschäfts im Browser, der Stempel wird gebucht. Keine App für Kunden oder Personal.
- "Der Chip erzeugt bei jedem Tap einen neuen Link", jeder Link ist nur einmal gültig und wird serverseitig geprüft; kopierte Links oder Screenshots funktionieren nicht. Die Adresse ist auf den Chip geschrieben und per Passwort gesperrt. Chipmodell wird nicht genannt (das beschriebene Verhalten entspricht einem SUN/SDM-Tag wie NTAG 424 DNA; **Einschätzung**).
- Erster Besuch: Kunde gibt einmalig Handynummer (optional Vorname) ein, Opt-in-Häkchen für Angebote. Danach genügt ein Tap.
- iPhone liest NFC automatisch; auf Android muss NFC eingeschaltet sein. Für Handys ohne NFC lässt sich ein QR-Code als Backup aktivieren.
- Missbrauchsregeln: Zeitstempel je Stempel, ein Stempel pro Kunde und Tag, Prämien werden mit einer separaten "Reward Card" eingelöst, die der Inhaber verwahrt. Quellen: https://ekhtem.app/, https://ekhtem.app/nfc-loyalty-card
- Zusatzoption: QR-Code auf Liefertüten für Liefer-/Online-Bestellungen (Preis auf Anfrage). Quelle: https://ekhtem.app/

**Hardware.** 3D-gedruckter Stempel, ca. 11,5 cm hoch, in Geschäftsfarbe, ohne Batterie/Kabel; Holzstempel mit Messingkopf als Extra. Kostenlose Box: Stempel, Reward Card, Google-Review-Karte, Thekenaufsteller, QR-Aufsteller. Der Stempel bleibt Eigentum von Ekhtem und wird bei Kündigung abgeholt; bei Verlust wird er deaktiviert. Quellen: https://ekhtem.app/nfc-loyalty-card, https://ekhtem.app/, https://ekhtem.app/terms

**Wallet.** Nach dem ersten Stempel erscheint "Add to Apple Wallet" / "Add to Google Wallet"; die Karte funktioniert auch nur im Browser. Karte aktualisiert sich nach jedem Stempel, Hinweise auf dem Sperrbildschirm (Stempel erhalten, Prämie bereit, Win-back, "in der Nähe" auf iPhone). Angebotsnachrichten nur an Opt-in-Kunden, höchstens 2 pro Woche, nur 07:00 bis 21:00 Uhr. Quelle: https://ekhtem.app/apple-wallet-loyalty-card

**Onboarding.** Dreistufiges Web-Formular (Geschäft, Prämie, Termin) mit Live-Vorschau; Team kommt in 1 bis 2 Tagen vor Ort, richtet ein und schult das Personal; Kontakt über WhatsApp. Quellen: https://ekhtem.app/start, https://ekhtem.app/

**Marketing-Automationen.** Liste überfälliger/inaktiver Kunden mit Ein-Klick-Nachricht, Geburtstagsgeschenk, zeitlich begrenzte Angebote, "Bring a friend"-Link, Google-Review-Aufforderung nach Prämie, Monatsbericht. Quelle: https://ekhtem.app/

**Preise.** 249 AED/Monat regulär, aktuell 199 AED/Monat (befristetes Angebot); weitere Filiale 149 AED/Monat mit eigenem Stempel; Setup und Box gratis; keine Vertragsbindung; 12 Monate im Voraus mit 2 Gratismonaten; keine MwSt. aufgeschlagen. Quellen: https://ekhtem.app/, https://ekhtem.app/terms

**Erkennbare Schwächen.**
- Nur ein Kartentyp, ein Plan, keine API/Kassenanbindung erkennbar (nicht öffentlich auffindbar). Quelle: https://ekhtem.app/
- Geschäftsmodell mit Vor-Ort-Einrichtung skaliert nur regional (VAE). Quelle: https://ekhtem.app/start
- Kein Self-Service-Zugang ohne Besuch erkennbar; Stempel bleibt Leihgerät. Quelle: https://ekhtem.app/terms
- Kein SLA, Haftung für Ausfälle ausgeschlossen. Quelle: https://ekhtem.app/terms
- Technische Details zur Sicherheit nicht offengelegt.

---

## 5. Vergleichstabelle

| Kriterium | Stamply | Boomerang | TapStamp (Drittquellen) | Ekhtem |
|---|---|---|---|---|
| Markt | Schweiz | global, USA-Fokus | UK | VAE |
| Stempelvergabe | Personal scannt QR der Wallet-Karte; Selbstscan-Modus; Kasse | Personal scannt per PWA; Kiosk-Modus; Kasse | Kunde tippt Handy an NFC-Pod; QR-Fallback | Personal hält NFC-Stempel ans Handy; QR-Fallback |
| NFC | nein | nein | ja (stationärer Pod) | ja (mobiler Stempel, Einmal-Link) |
| Kunden-App nötig | nein (Wallet) | nein (Wallet/PWA) | ja, laut Verzeichnissen | nein (Browser, Wallet optional) |
| Personal-App nötig | ja (Web-Scanner mit Login) | ja (PWA mit Login) | nicht öffentlich auffindbar | nein |
| Apple/Google Wallet | ja | ja | nicht erwähnt | ja |
| Kartentypen | 4 beworben, 8 dokumentiert | 8 | Stempelkarte, Gutscheine | Stempelkarte |
| Hardware | keine | keine | NFC-Pod gegen Setup-Gebühr | 3D-gedruckter Stempel, gratis als Leihgabe |
| Automationen | Push, Geburtstag, Reaktivierung, Geo, Empfehlung (ab Business) | Push/SMS/E-Mail-Journeys, Geo, RFM, KI | Push, Geburtstag, Review | Win-back, Geburtstag, Angebote, Empfehlung, Review |
| Kasse/API | ab Enterprise | ja | nicht öffentlich auffindbar | nicht öffentlich auffindbar |
| Einstiegspreis/Monat | CHF 39 (jährlich) / 49 | USD 164 (jährlich) / 199 | GBP 20 | AED 199 (regulär 249) |
| Test | 14 Tage | 14 Tage | 30 Tage | keine Vertragsbindung |
| Onboarding | Self-Service, optional begleitet | Self-Service mit KI | Online | Vor-Ort-Einrichtung in 1 bis 2 Tagen |

Quellen der Tabelle: siehe die jeweiligen Abschnitte oben.

---

## 6. Konsequenzen für Tably

**Was die Recherche am Produktversprechen ändert**

- "Tap. Stamp. Reward." mit physischem Stempel ist bereits bei Ekhtem live. Tably sollte sich nicht als Welt-Neuheit positionieren, sondern als erste solche Lösung im DACH-Raum mit Self-Service, Mandantenfähigkeit und offengelegter Sicherheit. (Ob es im DACH-Raum weitere NFC-Stempel-Anbieter gibt, wurde nicht untersucht; nur die vier vorgegebenen Anbieter wurden analysiert.)
- Ekhtems Ablauf bestätigt die Machbarkeit des MVP ohne Apple-/Google-Freigaben: Einmal-Link im Browser, Telefonnummer beim ersten Besuch, Wallet als optionaler zweiter Schritt.

**Wo Tably besser sein kann**

1. **Geschwindigkeit am Tresen.** Stamply und Boomerang brauchen ein eingeloggtes Gerät, Kamera und mehrere Klicks. Der Stempel braucht kein Gerät, keinen Login und keine Schulung. Das ist der klarste, belegbare Vorteil gegenüber den QR-Anbietern.
2. **Personal löst aus, nicht der Kunde.** Beim stationären Pod (TapStamp) oder Kiosk-Selbstscan (Stamply, Boomerang) stempelt der Kunde selbst; geschützt wird nur per Verzögerung. Ein Stempel in der Hand des Barista bindet die Vergabe an eine bewusste Handlung des Personals.
3. **Keine Kunden-App.** Gegenüber TapStamp ein direkter Vorteil; gleichauf mit den anderen.
4. **Self-Service statt Vor-Ort-Termin.** Ekhtem liefert und richtet persönlich ein. Tably kann Stempel vorpersonalisiert versenden und per Erst-Tap aktivieren ("Stempel antippen, mit Konto verknüpfen"). Das skaliert überregional.
5. **Transparente Sicherheit.** Keiner der vier erklärt sein Verfahren. Tably kann offen dokumentieren, was der Tap beweist und was nicht (siehe `nfc-und-wallet.md`), und Regeln wie "ein Stempel pro Tag/Kunde", Geofencing oder Stempel-Sperre bei Verlust konfigurierbar machen. Ekhtem hat die Tagesregel und die Sperre bereits.
6. **Preis und Paketierung.** Lücke zwischen Stamply (CHF 39 bis 149) und Boomerang (USD 164 bis 299). Stamply sperrt Automationen hinter den mittleren Plan. Tably kann Win-back, Geburtstag und Review-Aufforderung schon im Einstiegsplan anbieten, wie Ekhtem es im Einheitspreis tut. Zu klären ist die Hardware: einmalige Gebühr (TapStamp), Leihgabe im Abo (Ekhtem) oder Kauf.
7. **Mandantenfähigkeit und Filialen.** Ekhtem rechnet pro Filiale mit eigenem Stempel ab; Boomerang verlangt den Franchise-Plan. Mehrere Stempel pro Standort und mehrere Standorte pro Mandant von Anfang an sauber abzubilden ist ein Differenzierungsmerkmal.
8. **Datenstandort und Sprache.** Boomerang hostet in den USA und Deutschland, Stamply hängt vermutlich daran. EU-/CH-Hosting und deutschsprachige Oberfläche sind für DACH-KMU ein Verkaufsargument.

**Was Tably mindestens gleichziehen muss**

- Apple Wallet und Google Wallet mit Aktualisierung nach jedem Stempel (alle ausser evtl. TapStamp).
- QR-Fallback für Geräte ohne NFC (Ekhtem, TapStamp).
- Win-back, Geburtstag, Empfehlung, Google-Review (alle).
- Opt-in und Frequenzbegrenzung für Werbenachrichten (Ekhtem: max. 2 pro Woche, Zeitfenster).
- Prämieneinlösung als eigener, kontrollierter Vorgang (Ekhtem nutzt eine separate Reward Card beim Inhaber).

**Bewusst nicht kopieren (Einschätzung)**

- Acht Kartentypen wie Boomerang. Für das MVP reicht die Stempelkarte, eventuell Punkte.
- Reseller-/White-Label-Ebene im ersten Schritt.

---

## 7. Nicht verifizierbare Punkte

- Sämtliche TapStamp-Angaben (Website gesperrt, nur Drittverzeichnisse; Angaben zu Gratisplan und Setup-Gebühr widersprüchlich).
- Stamply als Boomerang-White-Label (Indizien, keine Bestätigung).
- Chipmodell und Kryptoverfahren von Ekhtem und TapStamp.
- MwSt.-Behandlung und Add-on-Preise bei Stamply; SMS-Preise und Sub-Account-Aufpreis bei Boomerang (widersprüchliche Angaben auf der Preisseite).
- Bewertungen auf Capterra, GetApp, G2 und Software Advice waren nicht abrufbar (HTTP 403).
