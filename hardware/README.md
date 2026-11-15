# Tably NFC-Stempel – Hardware (Rev. A)

Physischer, 3D-gedruckter Stempel für digitale Treuekarten. Der Barista hält den Stempel kurz an das
Smartphone des Kunden; im Stempelfuß sitzt ein **passiver NFC-Tag (NXP NTAG 424 DNA)**, der eine
(pro Antippen kryptografisch signierte) URL liefert. Keine Batterie, keine Elektronik außer dem Tag.

| Datei | Inhalt |
|---|---|
| `cad/tably_stamp.scad` | parametrisches OpenSCAD-Modell (Referenzmodell, alle Parameter oben) |
| `cad/generate_stl.py` | Python-Generator (manifold3d + trimesh), **tatsächliche Quelle der STL-Dateien** |
| `stl/tably_griff.stl`, `tably_fuss_tag22/25/30.stl`, `tably_kappe.stl`, `tably_logoscheibe.stl`, `tably_logoscheibe_blank.stl` | Druckteile in Drucklage |
| `stl/tably_baugruppe_vorschau.stl` | Baugruppe in Einbaulage, nur zur Ansicht (4 getrennte Körper, nicht drucken) |
| `drawings/massskizze.svg` | Maßskizze A3: Schnitt A–A, Draufsicht, Detail Tag-Tasche |
| `drawings/make_massskizze.py` | erzeugt die Skizze aus derselben Geometrie wie die STLs |

> **Ehrlicher Hinweis zur Herkunft der STLs:** In der Build-Umgebung ließ sich OpenSCAD nicht
> installieren/ausführen. Die STLs wurden deshalb mit `cad/generate_stl.py` erzeugt, das dieselben
> Parameter und Formeln wie `tably_stamp.scad` verwendet. Die `.scad`-Datei wurde **nicht kompiliert
> oder gerendert** – vor der ersten Nutzung einmal in OpenSCAD öffnen und gegen die STLs
> (Bounding-Box, Volumen) prüfen. Parameteränderungen müssen in beiden Dateien nachgezogen werden.

---

## 1. Konstruktionskonzept

Form: klassischer Holzgriff-Stempel (Knauf – Taille – Bund – konischer Fuß), auf vier glatte
Rotationskörper reduziert. Gesamtmaß **Ø 44 × 80 mm**.

| Pos. | Teil | Funktion | Drucklage |
|---|---|---|---|
| 1 | **Griff** | Knauf Ø 34, Taille Ø 19, Bund Ø 30; unten Gewindezapfen, oben Aufnahme für Logo-Scheibe, innen Bohrung Ø 12,4 für das optionale Gewicht | Knauf nach unten |
| 2 | **Fuß** | unten Tag-Tasche Ø 25,6 × 0,6 und Gewindehals für die Kappe; oben Innengewinde für den Griff; mittig Ausdrückloch Ø 8 | Oberseite nach unten |
| 3 | **Abdeckkappe** | Stempelfläche; Boden 1,0 mm = einziges Material zwischen Tag und Telefon; 24 Griffrillen | Boden nach unten |
| 4 | **Logo-Scheibe** | austauschbare Scheibe Ø 23,8 × 2,4 mit 0,6 mm tiefer Logo-Gravur, verschließt die Gewichtsbohrung | Logo nach oben |

Konstruktive Entscheidungen:

- **Tag austauschbar über Schraubkappe.** Kappe abschrauben → Tag liegt offen in der Tasche. Sitzt er
  fest, Griff abschrauben und den Tag mit einem Stift durch das Ausdrückloch herausdrücken.
- **Rundgewinde statt Bajonett/Schnapphaken.** Das Gewinde ist ein schraubenförmig versetzter Kreis
  („Exzenter-Rundgewinde", Tiefe 0,9 bzw. 1,2 mm, Steigung 3 bzw. 4 mm). Maximaler Flankenwinkel
  ≈ 43° → ohne Stützen druckbar, keine scharfen Gewindespitzen, unempfindlich gegen Schmutz.
  Schnapphaken ermüden bei PLA/PETG, ein Bajonett bräuchte Hinterschnitte.
- **Keine Schrauben, kein Metall im Fuß.** Auf eine M3-Sicherung wurde bewusst verzichtet: Sie läge
  mitten in der Antennenfläche. Wer eine Manipulationssicherung will: Siegelaufkleber über die Fuge
  Kappe/Fuß oder ein Tropfen lösbarer Lack im Gewinde.
- **Definierter Tag-Abstand.** Der Fuß sitzt auf dem Kappenboden auf (nicht die Kappe am Fußring –
  dort bleibt eine 0,2-mm-Schattenfuge). Der Abstand Tag–Stempelfläche ist damit unabhängig davon,
  wie fest die Kappe angezogen wird.
- **Alle Überhänge ≤ 45°.** Dächer von Bohrungen sind 45°-Kegel, Kanten gefast. Das Skript prüft das
  pro Teil automatisch (Fläche mit Überhang > 45° außerhalb der Bettauflage = 0 mm²).
- **Wandstärken ≥ 1,6 mm** (kleinste: Kappe am Grund einer Griffrille 1,6 mm; Logo-Scheibe unter der
  Gravur 1,8 mm). Einzige Ausnahme ist der Kappenboden mit 1,0 mm.

### Optionales Gewicht – und warum es im Griff sitzt

Ein Rundstahl Ø 12 × 30 mm (≈ 27 g) gibt dem leichten Kunststoffteil eine wertigere Haptik
(Druckteile ≈ 40–45 g → gesamt ≈ 70 g). Metall verstimmt und bedämpft eine 13,56-MHz-Antenne
(Wirbelströme, Induktivität sinkt, Resonanz wandert nach oben, Güte fällt). Das Feld einer
Kreisspule mit Radius r fällt auf der Achse mit (r² / (r² + z²))^1,5 ab:

| Abstand z zum Tag (r = 12,5 mm) | relative Feldstärke |
|---|---|
| 5 mm | 80 % |
| 15 mm | 26 % |
| **40 mm (Ist)** | **≈ 3 %** |

15 mm (gut ein Antennenradius) ist deshalb die Untergrenze; konstruiert sind **40,2 mm** zwischen
Tag und Unterkante Gewicht. Nachteil: Der Schwerpunkt liegt höher als bei einem Gewicht im Fuß –
das ist der Preis für die Funkreserve. Bei Ø 44 mm Standfläche steht der Stempel trotzdem sicher.
Das Skript setzt per `assert`/Prüfung durch, dass der Abstand nie unter 15 mm fällt.
Ohne Gewicht: `use_weight = false` (Bohrung entfällt) oder einfach leer lassen.

---

## 2. Maßtabelle

Nennmaße des CAD-Modells (Defaultparameter, Tag Ø 25). Siehe `drawings/massskizze.svg`.

| Maß | Wert | Parameter |
|---|---|---|
| Gesamthöhe | 80,0 mm | `foot_h + handle_h` |
| Fuß-/Kappendurchmesser | Ø 44,0 mm | `foot_d` |
| Höhe Fuß (ab Stempelfläche) | 18,0 mm | `foot_h` |
| Griffhöhe | 62,0 mm | `handle_h` |
| Knauf / Taille / Bund | Ø 34 / Ø 19 / Ø 30 mm | `knob_d`, `waist_d`, `collar_d` |
| Fuß oben, Konuswinkel | Ø 32 mm, ≈ 41° zur Achse | `foot_top_d` |
| Kappenhöhe | 7,8 mm | `cap_h` |
| **Material Tag → Telefon** | **1,0 mm** | `cover_t` (max. 1,2) |
| Tag-Tasche | Ø 25,6 × 0,6 mm | `tag_d + 2·tag_clear`, `tag_pocket_h` |
| Tag-Varianten | Ø 22 → Tasche 22,6 · Ø 30 → Tasche 30,6 | `tag_d` |
| Kappengewinde | Rund Ø 39,1 × P3, 2 Gänge | `cap_thr_*` |
| Griffgewinde | Rund Ø 16,2 × P4, 9,5 mm lang | `stud_*` |
| Gewindespiel radial | 0,25 mm | `thr_clear` |
| Wand Kappe (Gewindegrund / Rille) | 2,2 / 1,6 mm | `cap_wall_min`, `flute_depth` |
| Wand zwischen Tag-Tasche und Gewinde | 5,85 mm (Ø 30-Tag: 3,35 mm) | – |
| Logo-Scheibe | Ø 23,8 × 2,4 mm, Gravur 0,6 mm | `logo_*` |
| Gewichtsbohrung | Ø 12,4 × 31 mm | `weight_*` |
| Abstand Gewicht – Tag | 40,2 mm (Soll ≥ 15) | abgeleitet |

Geprüfte STL-Dateien (Ausgabe von `generate_stl.py`, Drucklage):

| Datei | Bounding-Box X × Y × Z [mm] | Volumen [cm³] | Dreiecke | wasserdicht |
|---|---|---|---|---|
| `tably_griff.stl` | 34,00 × 34,00 × 71,50 | 32,58 | 47 344 | ja |
| `tably_fuss_tag25.stl` | 44,00 × 44,00 × 17,00 | 17,25 | 45 526 | ja |
| `tably_fuss_tag22.stl` | 44,00 × 44,00 × 17,00 | 17,31 | 45 526 | ja |
| `tably_fuss_tag30.stl` | 44,00 × 44,00 × 17,00 | 17,11 | 45 526 | ja |
| `tably_kappe.stl` | 44,00 × 44,00 × 7,80 | 3,70 | 19 742 | ja |
| `tably_logoscheibe.stl` | 23,80 × 23,80 × 2,40 | 0,96 | 1 766 | ja |
| `tably_logoscheibe_blank.stl` | 23,80 × 23,80 × 2,40 | 1,02 | 838 | ja |

Prüfkriterien je Datei: trimesh `is_watertight`, `is_winding_consistent`, `is_volume` nach erneutem
Laden der STL; manifold3d-Status `NoError`; genau ein Körper; Durchdringung der Teile in Einbaulage
0 mm³; Überhangfläche > 45° = 0 mm². **Nicht** geprüft: ein realer Probedruck (siehe Abschnitt 11).

---

## 3. NFC- und Funk-Überlegungen

**Tag.** NTAG 424 DNA (ISO/IEC 14443-A, NFC Forum Type 4, 13,56 MHz, AES-128). Mit „Secure Dynamic
Messaging" (SUN) hängt der Chip bei jedem Lesen UID, Zähler und CMAC an die URL – das Backend kann
damit kopierte URLs und Wiederholungen erkennen. Wichtig für die Bestellung: Es muss wirklich der
**424 DNA** sein (nicht NTAG 213/215/216), als Inlay/Sticker **ohne** Metallfolie und ohne Ferritlage
(„On-Metal"-Tags sind hier unnötig und dicker).

**Lesedistanz.** Smartphones lesen kleine Tags typischerweise auf etwa 1–3 cm, mit Hülle weniger.
Der 424 DNA braucht wegen der AES-Rechnung mehr Feldenergie als ein NTAG 213 und liegt eher am
unteren Ende. Größere Antenne = mehr Reserve:

| Tag | Einschätzung |
|---|---|
| Ø 22 mm | funktioniert, wenig Reserve bei dicken Hüllen |
| **Ø 25 mm** | Standard, guter Kompromiss |
| Ø 30 mm | beste Reichweite; passt mit `tably_fuss_tag30.stl` |

Das sind Erfahrungswerte, keine Messwerte an diesem Gehäuse – vor der Serie mit 5–10 gängigen
Telefonen (mit/ohne Hülle) testen.

**Abstand.** Antennenebene liegt ≈ 1,3–1,6 mm über der Stempelfläche (1,0 mm Kappenboden + Luft/Kleber).
Kunststoff ist für 13,56 MHz praktisch transparent; die Dicke kostet nur Abstand. 1,0 mm ist der
Kompromiss aus Reichweite und Stoßfestigkeit (5 Schichten à 0,2 mm). Unter 0,8 mm wird der Boden
beim Fallenlassen empfindlich.

**Lage des Tags.** Zentrisch, parallel zur Stempelfläche, auf die Taschendecke im Fuß geklebt. Das
Ausdrückloch Ø 8 liegt innerhalb der Antennenschleife und stört nicht. Der Chip darf nicht geknickt
werden – beim Einkleben nicht über die Lochkante drücken.

**Materialien in Tag-Nähe (Fuß, Kappe).** Keine Metallteile, keine Magnete, kein Ferrit. Ebenso
keine leitfähigen Filamente: **Carbonfaser-gefüllte**, metallgefüllte („Bronze-/Kupfer-Fill") und
ESD-Filamente meiden; „Silk"- und Metallic-Farben mit Effektpigmenten vor der Serie testen.
Lackierungen mit Metallpigmenten auf der Kappe ebenfalls vermeiden.

**Orientierung zum Telefon.**

- **iPhone:** Antenne an der **oberen Kante/oberen Rückseite**. Stempel an den oberen Rand der
  Rückseite halten (nicht in die Mitte, dort sitzt die MagSafe-Spule). Hintergrundlesen ab
  iPhone XS: Display muss an sein, es erscheint eine Mitteilung, die der Kunde antippt.
- **Android:** meist **Mitte der Rückseite** bzw. in der Nähe der Kamera/Ladespule (Samsung: Mitte;
  Pixel: unterhalb der Kameraleiste). Gerät muss entsperrt, NFC eingeschaltet sein.
- Die Stempelfläche flach aufsetzen (Spulen parallel), ca. 1 s halten. Verkantet (> 30–40°)
  koppelt deutlich schlechter.
- Schulungssatz für die Theke: *„iPhone oben, Android Mitte."*

**Sonstiges.** Der Stempel darf auf Edelstahl-Theken abgestellt werden (der Tag wird dort nicht
gelesen). Im Ruhezustand nicht direkt auf ein Kartenterminal oder Telefon stellen – sonst wird
ungewollt gelesen.

---

## 4. Materialwahl

| Material | Eignung | Anmerkung |
|---|---|---|
| **PETG** | **Empfehlung** | zäh (Gewinde, Fallschutz), Tg ≈ 80 °C, beständig gegen übliche Reiniger und 70 % Isopropanol, geringe Schwindung |
| PLA / PLA+ | Prototyp, Messe-Muster | sehr gute Optik (matte „Holz"-Töne), aber Tg ≈ 55–60 °C: verzieht neben Siebträger/Spülmaschine/im Auto; spröder |
| ASA | gut, wenn vorhanden | Tg ≈ 100 °C, UV-stabil, matt; braucht geschlossenen Bauraum und Abluft; kein Aceton zum Reinigen |
| Resin (SLA/MSLA) | nur „Tough"/ABS-like | sehr feine Oberfläche und Logos, aber Standardharz ist spröde (Gewinde, Fall) und ungehärtetes Harz ist hautsensibilisierend – vollständig waschen und nachhärten; Maße/Toleranzen neu abstimmen |
| PA12 (MJF/SLS, Dienstleister) | Serie 100–1000 | robust, gleichmäßig matt, kein Schichtbild; `thr_clear` auf ≈ 0,15–0,2 reduzieren und Muster bestellen |

**Lebensmittelumfeld / Reinigung.** Der Stempel ist ein Thekenwerkzeug **ohne bestimmungsgemäßen
Lebensmittelkontakt**. FDM-Teile sind grundsätzlich nicht als lebensmittelecht anzusehen (Rillen
zwischen den Schichten, Pigmente, Düsenabrieb), auch wenn das Rohmaterial es wäre. Praktisch:

- glatte Außenflächen, keine offenen Schrauben oder Spalte außer der Kappenfuge;
- Wischdesinfektion mit Tuch und Spülmittel oder 70 % Isopropanol; nicht in die Spülmaschine,
  nicht einweichen (Feuchtigkeit kriecht ins Gewinde);
- optional lebensmittelkonformen Klarlack/Epoxid-Versiegelung auf Griff und Fuß (nicht nötig für
  die Funktion; Kappe wegen Maßhaltigkeit des Gewindes innen nicht beschichten);
- Kappe ist Verschleißteil (Kratzer von Telefonhüllen) und in Minuten nachgedruckt.

---

## 5. Druckeinstellungen (FDM, Düse 0,4 mm)

| Einstellung | Wert |
|---|---|
| Schichthöhe | 0,2 mm (Kappenboden = 5 Schichten, Tag-Tasche = 3 Schichten) |
| Wandlinien | 3 (Kappe: Wand wird dadurch massiv) |
| Deck-/Bodenschichten | 5 / 5 |
| Füllung | 20–25 % Gyroid; Logo-Scheibe und Kappe 100 % |
| Stützstrukturen | **keine** |
| Haftung | Griff: Brim 5 mm (Auflage ist nur ein Ring Ø 29/24); übrige Teile ohne |
| Elefantenfuß-Kompensation | 0,1–0,15 mm (wichtig für Griff-Oberseite und Kappenrand) |
| Naht | „ausgerichtet/hinten", beim Griff nicht „zufällig" |
| Geschwindigkeit Außenwand | ≤ 60 mm/s (Gewindeflanken) |
| PETG | 235–245 °C / Bett 75–85 °C, Lüfter 30–50 % |
| Druckbett für die Kappe | glattes oder fein strukturiertes PEI – das wird die sichtbare Stempelfläche |

Drucklagen entsprechen bereits den STL-Dateien (z = 0 = Bett). Richtwerte (Schätzung, nicht
gemessen): ≈ 40–45 g Filament und 3,5–5 h Druckzeit für einen kompletten Satz auf einem aktuellen
Bettschubser/CoreXY.

**Passung abstimmen:** zuerst nur Kappe + Fuß drucken. Läuft das Gewinde zu stramm, `thr_clear` von
0,25 auf 0,30–0,35 erhöhen; klappert es, auf 0,20 senken. Logo-Scheibe über `logo_clear` einstellen.

---

## 6. Stückliste (BOM)

Preise sind **grobe Schätzungen** (netto, EUR, Stand der Erstellung) zur Größenordnung – keine
Angebote, keine konkreten Lieferanten. Vor einer Kalkulation aktuelle Preise einholen.

| Pos. | Teil | Menge | Schätzpreis bei 1 Stk. | bei ≈ 1000 Stk. |
|---|---|---|---|---|
| 1–4 | Druckteile PETG, ≈ 45 g (Filament 20–30 €/kg) | 1 Satz | 0,90–1,40 € | 0,70–1,10 € |
| 5 | NFC-Sticker NTAG 424 DNA Ø 25 mm, selbstklebend | 1 | 1,50–3,00 € | 0,45–0,90 € |
| 6 | Rundstahl Ø 12 × 30 mm, verzinkt/Edelstahl, entgratet (optional) | 1 | 1,00–3,00 € | 0,25–0,60 € |
| 7 | Schaumstoff-/Filzpad Ø 12 (Klapperschutz Gewicht), selbstklebend | 1 | 0,05–0,20 € | 0,02–0,05 € |
| 8 | Filz- oder Silikonpunkt für Logo-Scheibe bzw. Klebepunkt (optional) | 1 | 0,05 € | 0,01 € |
| 9 | Verpackung (Karton, Kurzanleitung) | 1 | 0,50–1,50 € | 0,30–0,80 € |

Werkzeug: NFC-fähiges Telefon oder USB-Leser zum Personalisieren des Tags, Pinzette, Entgrater.

---

## 7. Montageanleitung

1. **Teile prüfen.** Brim am Griff entfernen, Kante der Logo-Aufnahme leicht entgraten. Kappe und
   Griff einmal trocken auf den Fuß schrauben; Gewinde müssen von Hand leicht laufen.
2. **Tag personalisieren und testen** (vor dem Einbau): URL/SDM-Konfiguration schreiben, Schlüssel
   setzen, mit einem Telefon lesen. Seriennummer/UID notieren.
3. **Gewicht einsetzen (optional).** Schaumpad auf eine Stirnseite des Rundstahls kleben, Stahl mit
   dem Pad nach oben von oben in die Griffbohrung fallen lassen. Er darf nicht klappern – sonst
   zweites Pad oder einen Tropfen Montagekleber.
4. **Logo-Scheibe eindrücken**, Kerbe nach Wunsch ausrichten. Sie sitzt mit leichter Pressung auf
   dem 45°-Konus und schließt bündig ab. Sitzt sie zu locker: ein Klebepunkt (wieder lösbar).
5. **Tag einkleben.** Fuß umdrehen, Schutzfolie abziehen, Tag mittig in die Tasche Ø 25,6 kleben und
   am Rand andrücken (nicht über dem Ausdrückloch durchdrücken).
6. **Kappe aufschrauben**, handfest, bis der Fuß auf dem Kappenboden aufsitzt (umlaufende Fuge
   ≈ 0,2 mm bleibt sichtbar).
7. **Griff in den Fuß schrauben**, handfest.
8. **Endtest:** mit einem iPhone (obere Kante) und einem Android-Gerät (Mitte) durch die Kappe
   lesen; URL und Signaturprüfung im Backend kontrollieren.
9. Optional Siegelaufkleber über die Kappenfuge.

**Tag tauschen:** Kappe ab → Griff ab → Tag mit einem Stift durch das Ausdrückloch herausdrücken →
Klebereste mit Isopropanol entfernen → neuen Tag wie ab Schritt 5.

---

## 8. Kostenschätzung pro Stück

**Annahmen (alle geschätzt):** PETG 25 €/kg, 45 g je Satz; Druckzeit 4,5 h; Maschinenstundensatz
eigener Drucker 0,40–0,80 €/h (Abschreibung, Strom, Wartung); Ausschuss 5 %; Arbeitslohn 40 €/h;
Handzeit je Stempel inkl. Bestücken, Nacharbeit, Tag-Personalisierung und Test: 30 min (Einzelstück),
8 min (100er-Los), 5 min (1000er-Los mit Vorrichtungen); mit Gewicht; ohne Entwicklungskosten,
Versand, Marge und Umsatzsteuer.

| Posten | 1 Stück | 100 Stück | 1000 Stück |
|---|---|---|---|
| Filament | 1,10 € | 1,00 € | 0,90 € |
| Maschinenzeit | 2–4 € | 2–3,50 € | 2–3 € |
| NFC-Tag | 1,50–3,00 € | 0,80–1,50 € | 0,45–0,90 € |
| Gewicht, Pads | 1–3 € | 0,50–1,00 € | 0,30–0,65 € |
| Verpackung | 0,50–1,50 € | 0,40–1,00 € | 0,30–0,80 € |
| Arbeit | ≈ 20 € | ≈ 5,30 € | ≈ 3,30 € |
| Ausschuss/Reserve | – | ≈ 0,50 € | ≈ 0,40 € |
| **Summe (Schätzung)** | **≈ 26–33 €** | **≈ 10,50–14 €** | **≈ 7,50–10 €** |

Einordnung:

- Beim Einzelstück dominiert die Arbeitszeit; reine Material-/Maschinenkosten liegen bei ≈ 6–12 €.
  Über einen Druckdienstleister kostet ein Einzelsatz eher 25–50 € zuzüglich Tag (Schätzung).
- 1000 Stück per FDM bedeuten ≈ 4 500 Druckstunden, also z. B. 10 Drucker über rund 3–4 Wochen
  Dauerbetrieb. Alternativ MJF/SLS-Dienstleister (Größenordnung 4–8 €/Satz, Schätzung).
- **Spritzguss** lohnt nach grober Schätzung erst ab einigen tausend Stück: Werkzeuge für vier Teile
  in der Größenordnung 10–25 k€, Teilepreis danach < 1,50 €/Satz. Dafür müsste die Konstruktion
  angepasst werden (Gewinde → Bajonett/Schnapp oder Ausdrehkerne, Wandstärken vergleichmäßigen,
  Entformschrägen).

---

## 9. Individualisierung mit Firmenlogo

1. **Logo-Scheibe (Standardweg).** In `tably_stamp.scad` `logo_mode = "svg"` und `logo_svg` setzen
   (einfarbiges Vektorlogo, Strichstärke ≥ 0,8 mm, Innenräume ≥ 0,6 mm) oder `logo_mode = "text"`
   für Initialen. Die Gravur ist 0,6 mm tief. `generate_stl.py` erzeugt nur das Platzhalter-„T" und
   eine Blanko-Scheibe; kundenspezifische Scheiben werden aus der `.scad` gerendert oder im Slicer
   aus der Blanko-Scheibe plus SVG erstellt.
2. **Zweifarbig ohne Mehrfarbdrucker.** Filamentwechsel in der Logo-Scheibe bei z = 1,8 mm: Grund in
   Farbe A, die oberen 0,6 mm in Farbe B – oder Gravur mit Acryllack auslegen und überwischen.
3. **Farbwelt.** Griff in „Holz"-Tönen (matt, PLA/PETG mit Holzoptik nur am Griff – weit weg vom
   Tag), Fuß/Kappe in der Markenfarbe. Die Teilung in vier Teile erlaubt Farbkombinationen ohne
   Mehrfarbdruck.
4. **Stempelfläche.** Auf dem Kappenboden kann außen ein nichtmetallischer Aufkleber (Papier/PVC,
   kein Metallic-/Chromfolien-Druck) mit Logo oder „Hier antippen"-Symbol sitzen; ≤ 0,15 mm trägt
   funktechnisch nicht auf.
5. **Serien-Individualisierung.** Scheiben und Kappen sind die einzigen kundenspezifischen Teile;
   Griff und Fuß können auf Lager produziert werden. Jede Kundencharge erhält eigene Tag-Schlüssel
   (pro Tag aus UID abgeleitet); UID/Seriennummer z. B. als kleines Etikett im Fuß unter der Kappe.
6. Für höhere Stückzahlen: Laser-/UV-Druck auf Blanko-Scheiben statt individueller Druckdateien.

---

## 10. Ausbaustufe B: aktiver Stempel (Konzept, nicht konstruiert)

Ziel wäre ein Stempel, der selbst etwas tut: Rückmeldung per LED/Vibration, wechselnde signierte
Inhalte, Offline-Zähler, Funkverbindung zur Kasse – oder das Lesen eines Wallet-Passes.

### Zwei sehr unterschiedliche Varianten

**B1 – „dynamischer Tag" (realistisch).** Der Stempel bleibt aus Sicht des Telefons ein NFC-Tag,
aber ein Mikrocontroller erzeugt den Inhalt:

- **nRF52840** hat eine NFC-A-Tag-Schnittstelle bereits im Chip (Type-2/Type-4-Emulation,
  Aufwecken durch das Feld) plus Bluetooth LE zur Kasse/zum Tablet – kein separater Reader-IC nötig.
- Alternative: dynamischer Tag-Baustein mit I²C und Feld-Erkennungs-Pin (z. B. ST25DV-Familie oder
  NTAG I²C plus/NTAG 5) an einem beliebigen kleinen MCU.
- Ein **Secure Element** (ATECC608 für ECC-P256-Geräteidentität und Signaturen; SE050, wenn mehr
  Algorithmen, Zertifikatsketten oder höhere Zertifizierungsstufe gebraucht werden) hält den
  Geräteschlüssel. Der Stempel signiert pro Antippen eine URL mit Zähler/Zeitstempel.
- Feld erkannt → kurzer Vibrationsimpuls und LED als Bestätigung für den Barista.
- Funkregulatorisch und vertraglich unkritischer als B2 (kein eigener 13,56-MHz-Sender; BLE-Modul
  mit vorhandener Modulzulassung), CE/RED-Bewertung des Gesamtgeräts bleibt trotzdem nötig.

**B2 – echter Reader.** Der Stempel erzeugt selbst das 13,56-MHz-Feld und liest Telefon/Karte:

| Baustein | Stärken | Grenzen |
|---|---|---|
| **PN532** | billig, viel Beispielcode | alt; geringe Sendeleistung/Empfindlichkeit, für kleine Antennen hinter Kunststoff knapp; kein NCI; Kartenemulation nur eingeschränkt; keine sinnvolle Grundlage für Wallet-Protokolle; für Neuentwicklungen nicht empfohlen |
| **PN7160** | NCI-Controller, Firmware erledigt Protokollarbeit, gute Android/Linux/RTOS-Unterstützung, stromsparende Tag-Erkennung | Verhalten durch NCI-Firmware vorgegeben, proprietäre Polling-Rahmen nur soweit die Firmware sie anbietet |
| **ST25R3916(B)** | leistungsstarkes Analog-Frontend, hohe Ausgangsleistung, automatische Antennenabstimmung, frei programmierbare Rahmen über die RFAL-Bibliothek | mehr Firmware-Aufwand, höherer Strom im Feldbetrieb, Antennen-Matching muss sauber ausgelegt werden |

MCU: **ESP32-C3** (WLAN + BLE, günstig, aber Spitzenstrom um 300 mA und Ruhestrom nur im
Tiefschlaf niedrig – eher für Stempel mit Ladeschale) oder **nRF52840** (BLE/Thread, sehr sparsam,
NFC-Tag-Schnittstelle integriert – erste Wahl für Akkubetrieb).

### Ehrlicher Hinweis zu Apple VAS und Google Smart Tap

Das eigentlich Interessante – ein Wallet-Pass, der sich beim Antippen automatisch präsentiert –
läuft über **Apple Wallet VAS** bzw. **Google Wallet Smart Tap**. Beides ist **nicht frei
implementierbar**:

- **Apple VAS** setzt eine Freigabe durch Apple voraus (NFC-Zertifikat für den Pass-Typ,
  Spezifikationen unter NDA) und erwartet in der Praxis zertifizierte Terminal-Hardware; die dafür
  nötigen Polling-Erweiterungen (ECP) und Schlüssel sind nicht öffentlich dokumentiert.
- **Google Smart Tap** erfordert die Registrierung als Einlöser bei Google (Collector-ID,
  hinterlegte Schlüssel) und vorgesehen sind zertifizierte Terminals.
- Ein Eigenbau-Reader mit PN7160/ST25R3916 kann die Funkschicht technisch erzeugen, **darf und kann
  diese Protokolle aber nicht ohne Weiteres sprechen** – ohne Freigaben, Schlüssel und
  Zertifizierung antworten die Wallets nicht, und Nachbau anhand inoffizieller Quellen wäre
  vertraglich/rechtlich riskant und jederzeit abschaltbar. Der realistische Weg führt über einen
  bereits zertifizierten Terminal-/Reader-Hersteller oder ein Partnerprogramm.
- Auch ohne VAS/Smart Tap ist ein Reader im Stempel nur begrenzt nützlich: Ein iPhone bietet ohne
  besondere Berechtigungen keine frei nutzbare Kartenemulation für Dritt-Apps.
- Details zu den Programmen ändern sich; vor einer Entscheidung den aktuellen Stand direkt bei
  Apple/Google bzw. dem Chip-Hersteller klären.

**Empfehlung:** Stufe A (dieses Dokument) → bei Bedarf B1. B2 nur mit zertifiziertem Partner.

### Bauraum und Aufbau (B1/B2)

- Der heutige Fuß (Ø 44) reicht für eine runde Leiterplatte Ø ≈ 36 mm. Antenne als Leiterschleife
  am Rand der Platine direkt über dem Kappenboden; **dahinter eine gezielt ausgelegte
  Ferritfolie**, die die Antenne von Platine und Akku abschirmt. (Das widerspricht nicht der Regel
  aus Stufe A: Dort verstimmt Ferrit einen fertig abgestimmten Sticker, hier wird die Antenne *mit*
  Ferrit abgestimmt.)
- Akku im Griff: Bohrung von Ø 12,4 auf ≈ Ø 15–20 mm vergrößern (Taille dann ≈ Ø 24–26 mm) für eine
  zylindrische Li-Ion-Zelle (10440/14500-Format) oder einen kleinen LiPo-Pouch (≈ 150–400 mAh).
  Der Akku ersetzt das Gewicht und liegt funktechnisch günstig weit oben.
- USB-C-Buchse seitlich am Bund oder Ladekontakte/Qi im Fuß (Qi-Spule und NFC-Antenne konkurrieren
  um denselben Platz – Ladekontakte in einer Thekenschale sind einfacher).
- LED als Lichtring in der Fuge Fuß/Griff (transluzenter Ring), Vibrationsmotor (LRA oder
  Münz-ERM Ø 8–10 mm) im Fuß neben der Platine.
- Dichtheit gegen Spritzwasser und Kaffee: O-Ring in der Kappenfuge, Kappe verklebt oder
  ultraschallverschweißt (Akkugerät → Gehäuse nicht mehr vom Anwender zu öffnen).

### Grobe BOM Stufe B (Schätzung je Stück bei ≈ 100 Stk., ohne Entwicklung)

| Baustein | B1 | B2 | Schätzpreis |
|---|---|---|---|
| MCU-Modul nRF52840 (oder ESP32-C3 ≈ 1,50–3 €) | x | x | 4–8 € |
| Reader-IC ST25R3916 / PN7160 inkl. Matching | – | x | 4–8 € |
| Dynamischer Tag-IC (falls nicht nRF-intern) | (x) | – | 0,50–1,50 € |
| Secure Element ATECC608 (SE050: 2,50–5 €) | x | x | 0,70–1,20 € |
| LiPo/Li-Ion-Zelle mit Schutzschaltung | x | x | 2–4 € |
| Lade-IC, Regler, USB-C/Kontakte | x | x | 1–2,50 € |
| Vibrationsmotor + Treiber | x | x | 1–4 € |
| LED(s), Lichtleiter | x | x | 0,20–1 € |
| Ferritfolie | x | x | 0,30–1 € |
| Leiterplatte + Bestückung | x | x | 4–10 € |
| Gehäuse (Druckteile, angepasst) | x | x | 3–6 € |
| **Summe Material (Schätzung)** | **≈ 18–35 €** | **≈ 25–45 €** | |

Hinzu kommen einmalig Entwicklung, Antennenabstimmung und Konformität: Funk/EMV (RED),
Produktsicherheit, Akkutransport (UN 38.3), Altgeräte-/Batterieregistrierung. Größenordnung für
Prüfungen grob 5–15 k€ (Schätzung, stark abhängig von Modulzulassungen und Prüflabor). Stufe A
enthält dagegen keinen eigenen Sender und keinen Akku; welche Pflichten dort gelten
(Produktsicherheit, Stoffverbote), sollte vor dem Verkauf trotzdem kurz geprüft werden.

---

## 11. Offene Punkte / nicht verifiziert

- `tably_stamp.scad` wurde nicht in OpenSCAD kompiliert (siehe oben).
- Kein Probedruck: Gewindespiel (`thr_clear`), Passung der Logo-Scheibe und die Bettauflage des
  Griffs (schmaler Ring, Brim nötig) sind am realen Drucker abzustimmen.
- Lesereichweite durch 1,0 mm Kappenboden wurde nicht gemessen; Test mit mehreren Telefonen und
  Hüllen steht aus.
- Das Rundgewinde hält Handkräfte, ist aber kein Feingewinde: Ob die Kappe sich im Alltag lockert,
  zeigt erst ein Dauertest (Abhilfe: Siegelaufkleber, O-Ring als Bremse oder Rastnase).
- Alle Preise, Gewichte und Druckzeiten sind Schätzungen.

## Neu erzeugen

```bash
pip install manifold3d trimesh numpy
python3 hardware/cad/generate_stl.py          # STLs + Prüfbericht
python3 hardware/drawings/make_massskizze.py  # Maßskizze
```
