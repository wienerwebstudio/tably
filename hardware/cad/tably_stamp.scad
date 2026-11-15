// ============================================================================
//  Tably NFC-Stempel  -  parametrisches OpenSCAD-Modell              Rev. A
// ============================================================================
//  Passiver NFC-Stempel (NTAG 424 DNA) in der Form eines klassischen
//  Holzgriff-Stempels. 4 Druckteile, alle ohne Stuetzstrukturen FDM-druckbar:
//
//    (a) Griff        Rotationskoerper mit Gewindezapfen, Aufnahme fuer
//                     Logo-Scheibe und (optional) Gewicht      -> Druck: Knauf unten
//    (b) Fuss         Tag-Tasche unten, Gewindehals fuer Kappe -> Druck: Oberseite unten
//    (c) Kappe        Stempelflaeche, Boden cover_t = 1,0 mm   -> Druck: Boden unten
//    (d) Logo-Scheibe austauschbar, Gravur oben                -> Druck: Logo oben
//
//  Koordinaten: z = 0 ist die Stempelflaeche (Telefonseite), z+ zum Griff.
//
//  WICHTIG / EHRLICHER HINWEIS: Die STL-Dateien in ../stl/ wurden NICHT aus
//  dieser Datei gerendert (in der Build-Umgebung war kein OpenSCAD verfuegbar),
//  sondern mit ../cad/generate_stl.py, das dieselben Parameter und Formeln
//  verwendet. Diese .scad-Datei wurde dort nicht kompiliert/getestet.
//  Parameter-Aenderungen bitte in beiden Dateien nachziehen.
//
//  Rendern:  openscad -D 'part="griff"' -o tably_griff.stl tably_stamp.scad
//            part = assembly | section | plate | griff | fuss | kappe | logo
// ============================================================================

/* [Ansicht] */
part = "assembly"; // [assembly, section, plate, griff, fuss, kappe, logo]

/* [NFC-Tag] */
tag_d        = 25.0;  // Durchmesser Tag-Inlay/Sticker: 22 / 25 / 30
tag_clear    = 0.3;   // radiales Spiel der Tag-Tasche
tag_pocket_h = 0.6;   // Taschentiefe (Sticker 0,15-0,3 mm + Kleber/Schaumpad)
cover_t      = 1.0;   // Material zwischen Tag und Telefon (Kappenboden), max. 1,2

/* [Fuss und Kappe] */
foot_d       = 44.0;  // Aussendurchmesser Fuss/Kappe
cap_h        = 7.8;   // Gesamthoehe Kappe inkl. Boden
cap_gap      = 0.2;   // Schattenfuge Kappe/Fussring (Fuss sitzt auf Kappenboden auf)
cap_wall_min = 2.2;   // Wandstaerke Kappe am Gewindegrund
flute_n      = 24;    // Anzahl Griffrillen an der Kappe
flute_r      = 1.5;
flute_depth  = 0.6;   // Restwand = cap_wall_min - flute_depth (>= 1,6)
ring_h       = 2.5;   // zylindrischer Fussring oberhalb der Kappe
foot_h       = 18.0;  // Oberkante Fuss ab Stempelflaeche
foot_top_d   = 32.0;  // Durchmesser Fuss oben
edge_chamfer = 0.5;   // Kantenfasen

/* [Rundgewinde (Exzenter-Kreis)] */
cap_thr_e      = 0.45; // Exzentrizitaet = halbe Gewindetiefe (Kappe)
cap_thr_pitch  = 3.0;
stud_r         = 7.5;  // mittlerer Radius Griffzapfen
stud_len       = 9.5;
stud_thr_e     = 0.6;
stud_thr_pitch = 4.0;
thr_clear      = 0.25; // radiales Gewindespiel (Toleranz FDM, 0,2-0,35)
push_d         = 8.0;  // Ausdrueckloch fuer den Tag

/* [Griff] */
handle_h  = 62.0;  // Griffhoehe ab Fuss-Oberkante
collar_d  = 30.0;
collar_h  = 4.0;
waist_d   = 19.0;
waist_z   = 26.0;  // Beginn Taille (ab Griffunterkante)
waist_len = 4.0;
knob_d    = 34.0;
knob_z    = 48.0;  // Beginn Knaufzylinder
crown_h   = 6.0;   // Hoehe der oberen Verrundung (max. 45 Grad)
top_d     = 29.0;  // ebene Oberseite

/* [Logo-Scheibe] */
logo_d       = 24.0;  // Durchmesser der Aufnahme im Griff
logo_t       = 2.4;   // Dicke der Scheibe
logo_chamfer = 1.0;   // 45-Grad-Sitzfase
logo_clear   = 0.10;  // radiales Spiel (leichte Presspassung)
logo_depth   = 0.6;   // Tiefe der Logo-Vertiefung (Restboden >= 1,6)
logo_mode    = "placeholder"; // [placeholder, text, svg, none]
logo_text    = "T";
logo_font    = "Liberation Sans:style=Bold";
logo_svg     = "logo.svg";    // Vektorlogo, zentriert, wird auf logo_svg_size skaliert
logo_svg_size = 16;

/* [Gewicht (optional, nur im Griff)] */
use_weight   = true;
weight_d     = 12.0;  // Rundstahl Ø 12 x 30  (ca. 27 g)
weight_len   = 30.0;
weight_clear = 0.2;

/* [Aufloesung] */
fn = 128;
$fn = fn;

// ---------------------------------------------------------------- abgeleitet
R           = foot_d / 2;
cap_thr_rf  = R - cap_wall_min - cap_thr_e;   // Mutter (Kappe)
cap_thr_rm  = cap_thr_rf - thr_clear;         // Bolzen (Fusshals)
stud_rf     = stud_r + thr_clear;
pocket_r    = tag_d / 2 + tag_clear;
z_pocket_top = cover_t + tag_pocket_h;
z_ring      = cap_h + cap_gap;
total_h     = foot_h + handle_h;
r_w         = weight_d / 2 + weight_clear;
r_rec       = logo_d / 2;
z_rec_bot   = handle_h - (logo_t - logo_chamfer);
z_cone_bot  = z_rec_bot - (r_rec - r_w);
z_bore_bot  = z_cone_bot - (use_weight ? weight_len + 1 : 0);
z_apex      = z_bore_bot - r_w;
weight_to_tag = foot_h + z_bore_bot - z_pocket_top;

echo(str("Gesamthoehe = ", total_h, " mm, Fuss Ø ", foot_d, " mm"));
echo(str("Abstand Gewicht -> Tag = ", weight_to_tag, " mm (Soll >= 15)"));
echo(str("Restwand Kappe = ", cap_wall_min - flute_depth, " mm"));
assert(cover_t <= 1.2, "cover_t: max. 1,2 mm zwischen Tag und Telefon");
assert(cap_wall_min - flute_depth >= 1.6, "Restwand der Kappe < 1,6 mm");
assert(!use_weight || weight_to_tag >= 15, "Gewicht naeher als 15 mm am Tag");
assert(cap_thr_rm - cap_thr_e - pocket_r >= 1.6, "Wand zwischen Tag-Tasche und Gewinde < 1,6 mm");
assert(logo_t - logo_depth >= 1.6, "Restboden Logo-Scheibe < 1,6 mm");

// ---------------------------------------------------------------- Helfer
// Rundgewinde: exzentrischer Kreis, rechtsgaengig verdreht. Die Phase haengt nur
// von der absoluten Hoehe ab -> Bolzen und Mutter passen in Einbaulage zueinander.
// max. Flankenwinkel = atan(e*2*PI/pitch) ~ 43 Grad -> stuetzfrei druckbar.
// slices so gewaehlt, dass je Schicht hoechstens 3 Grad verdreht wird (sonst
// verfaelschen die Sehnen das Profil).
module thread(r, e, pitch, z0, z1) {
    h  = z1 - z0;
    tw = 360 * h / pitch;
    translate([0, 0, z0]) rotate([0, 0, 360 * z0 / pitch])
        linear_extrude(height = h, twist = -tw, slices = ceil(tw / 3), convexity = 10)
            translate([e, 0]) circle(r = r);
}

module rev(pts) { rotate_extrude(convexity = 10) polygon(pts); }

// Aussenkontur des Griffs: Radius ueber lokaler Hoehe z
function handle_r(z) =
    let(rc = collar_d / 2, rw = waist_d / 2, rk = knob_d / 2, rt = top_d / 2,
        z_crown = handle_h - crown_h, z_w2 = waist_z + waist_len)
    z < edge_chamfer ? rc - edge_chamfer + z :
    z < collar_h     ? rc :
    z < waist_z      ? rw + (rc - rw) * (1 + cos(180 * (z - collar_h) / (waist_z - collar_h))) / 2 :
    z < z_w2         ? rw :
    z < knob_z       ? rw + (rk - rw) * (1 - cos(180 * (z - z_w2) / (knob_z - z_w2))) / 2 :
    z < z_crown      ? rk :
                       rk - (rk - rt) * pow((z - z_crown) / crown_h, 2);

handle_zb = [0, edge_chamfer, collar_h, waist_z, waist_z + waist_len, knob_z,
             handle_h - crown_h, handle_h];
handle_n  = 12;
handle_pts = concat(
    [[0, 0]],
    [for (i = [0 : len(handle_zb) - 2]) for (j = [0 : handle_n - 1])
        let(z = handle_zb[i] + (handle_zb[i + 1] - handle_zb[i]) * j / handle_n)
        [handle_r(z), z]],
    [[handle_r(handle_h), handle_h], [0, handle_h]]);

// ---------------------------------------------------------------- (c) Kappe
module kappe() {
    difference() {
        rev([[0, 0], [R - edge_chamfer, 0], [R, edge_chamfer], [R, cap_h], [0, cap_h]]);
        thread(cap_thr_rf, cap_thr_e, cap_thr_pitch, cover_t, cap_h + 1);
        for (i = [0 : flute_n - 1])
            rotate([0, 0, 360 * i / flute_n])
                translate([R + flute_r - flute_depth, 0, cover_t + edge_chamfer])
                    cylinder(r = flute_r, h = cap_h, $fn = 32);
    }
}

// ---------------------------------------------------------------- (b) Fuss
module fuss() {
    zt    = foot_h;
    rt    = foot_top_d / 2;
    rmax  = cap_thr_rm + cap_thr_e;
    z_thr = zt - stud_len - 1.0;           // Grund des Innengewindes
    rf    = stud_rf;
    e     = stud_thr_e;
    rp    = push_d / 2;
    rl    = rf + e + 0.8;                  // 45-Grad-Senkung oben
    difference() {
        union() {
            // Ring + Konus
            rev([[0, z_ring], [R, z_ring], [R, z_ring + ring_h],
                 [rt, zt - edge_chamfer], [rt - edge_chamfer, zt], [0, zt]]);
            // Gewindehals mit Einfuehrfase
            intersection() {
                thread(cap_thr_rm, cap_thr_e, cap_thr_pitch, cover_t, z_ring + 0.5);
                rev([[0, cover_t], [rmax - 0.6, cover_t], [rmax + 0.1, cover_t + 0.7],
                     [rmax + 0.1, z_ring + 0.5], [0, z_ring + 0.5]]);
            }
        }
        // Tag-Tasche
        translate([0, 0, cover_t - 1]) cylinder(r = pocket_r, h = tag_pocket_h + 1);
        // Innengewinde fuer den Griffzapfen
        thread(rf, e, stud_thr_pitch, z_thr, zt + 1);
        // 45-Grad-Uebergang zum Ausdrueckloch (stuetzfrei in Drucklage)
        rev([[0, z_thr - (rf + e - rp)], [rp, z_thr - (rf + e - rp)],
             [rf + e, z_thr], [rf + e, z_thr + 0.01], [0, z_thr + 0.01]]);
        translate([0, 0, z_pocket_top - 0.5]) cylinder(r = rp, h = z_thr - z_pocket_top + 0.5);
        // Einfuehrsenkung oben
        rev([[0, zt + 0.1 - rl], [rl, zt + 0.1], [0, zt + 0.1]]);
    }
}

// ---------------------------------------------------------------- (a) Griff
module griff() {
    zs   = foot_h - stud_len;
    rmax = stud_r + stud_thr_e;
    difference() {
        union() {
            translate([0, 0, foot_h]) rev(handle_pts);
            intersection() {
                thread(stud_r, stud_thr_e, stud_thr_pitch, zs, foot_h + 0.5);
                rev([[0, zs], [rmax - 0.7, zs], [rmax + 0.1, zs + 0.8],
                     [rmax + 0.1, foot_h + 0.5], [0, foot_h + 0.5]]);
            }
        }
        // Logo-Aufnahme -> 45-Grad-Konus -> Gewichtsbohrung -> 45-Grad-Dach
        translate([0, 0, foot_h])
            rev([[0, z_apex], [r_w, z_bore_bot], [r_w, z_cone_bot],
                 [r_rec, z_rec_bot], [r_rec, handle_h + 0.1], [0, handle_h + 0.1]]);
    }
}

// ---------------------------------------------------------------- (d) Logo-Scheibe
module logo_cut_2d() {
    k = logo_d / 24;
    if (logo_mode == "placeholder") {
        difference() {                                   // offener Ring
            circle(r = 10.2 * k);
            circle(r = 9.2 * k);
            translate([-4 * k, -13 * k]) square([8 * k, 6 * k]);
        }
        translate([-5 * k, 2.6 * k])   square([10 * k, 2.6 * k]);   // "T" Querbalken
        translate([-1.3 * k, -4.8 * k]) square([2.6 * k, 10 * k]);  // "T" Stamm
    } else if (logo_mode == "text") {
        text(logo_text, size = 12 * k, font = logo_font, halign = "center", valign = "center");
    } else if (logo_mode == "svg") {
        resize([logo_svg_size, 0], auto = true) import(logo_svg, center = true);
    }
}

module logo() {
    r = r_rec - logo_clear;
    translate([0, 0, total_h - logo_t])
    difference() {
        rev([[0, 0], [r - logo_chamfer, 0], [r, logo_chamfer], [r, logo_t], [0, logo_t]]);
        // Aushebelkerbe (Fingernagel / Plektrum)
        translate([0, -(r + 0.7), logo_chamfer]) cylinder(r = 2.5, h = logo_t, $fn = 48);
        // Logo-Vertiefung
        if (logo_mode != "none")
            translate([0, 0, logo_t - logo_depth])
                linear_extrude(height = logo_depth + 1, convexity = 10) logo_cut_2d();
    }
}

// ---------------------------------------------------------------- Zukaufteile (nur Ansicht)
module tag_dummy()    { color("magenta") translate([0, 0, z_pocket_top - 0.25]) cylinder(r = tag_d / 2, h = 0.25); }
module weight_dummy() { color("silver")  translate([0, 0, foot_h + z_bore_bot]) cylinder(r = weight_d / 2, h = weight_len); }

// ---------------------------------------------------------------- Drucklage (z = 0 auf dem Bett)
module print_kappe() { kappe(); }
module print_fuss()  { translate([0, 0, foot_h])  rotate([180, 0, 0]) fuss(); }
module print_griff() { translate([0, 0, total_h]) rotate([180, 0, 0]) griff(); }
module print_logo()  { translate([0, 0, -(total_h - logo_t)]) logo(); }

module assembly() {
    color("#d9c7a0") griff();
    color("#5b7fa3") fuss();
    color("#3e3e3e") kappe();
    color("#b5463c") logo();
    tag_dummy();
    if (use_weight) weight_dummy();
}

if (part == "griff")        print_griff();
else if (part == "fuss")    print_fuss();
else if (part == "kappe")   print_kappe();
else if (part == "logo")    print_logo();
else if (part == "plate") {
    print_griff();
    translate([foot_d + 6, 0, 0]) print_fuss();
    translate([0, foot_d + 6, 0]) print_kappe();
    translate([foot_d + 6, foot_d + 6, 0]) print_logo();
}
else if (part == "section") {
    difference() {
        assembly();
        translate([-100, -200, -1]) cube([200, 200, total_h + 2]);
    }
}
else assembly();
