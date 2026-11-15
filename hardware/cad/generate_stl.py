#!/usr/bin/env python3
"""
Tapperl NFC-Stempel - STL-Generator (Python / manifold3d)
=======================================================

Diese Datei ist die TATSAECHLICHE QUELLE der STL-Dateien in ../stl/.
Sie bildet dieselbe Geometrie mit denselben Parametern (Namen + Defaultwerte)
nach wie ../cad/tapperl_stamp.scad. Grund: In der Build-Umgebung stand kein
OpenSCAD zur Verfuegung; die .scad-Datei konnte dort nicht gerendert werden.

Aufruf:
    pip install manifold3d trimesh numpy
    python3 generate_stl.py                 # alle Teile, Tag Ø 25 (+ Fuss-Varianten 22/30)
    python3 generate_stl.py --tag-d 30      # anderer Default-Tag
    python3 generate_stl.py --out ../stl

Koordinaten: Baugruppen-Koordinaten, z = 0 ist die Stempelflaeche (Telefonseite),
z waechst in Richtung Griff. Exportiert wird jedes Teil in DRUCKLAGE (z = 0 = Druckbett).
"""
import argparse
import math
import os
import sys

import numpy as np
from manifold3d import CrossSection, Manifold

# --------------------------------------------------------------------------
# PARAMETER  (identisch zu tapperl_stamp.scad - bei Aenderungen beide pflegen!)
# --------------------------------------------------------------------------
P = dict(
    # --- NFC-Tag ---
    tag_d=25.0,          # Durchmesser Tag-Inlay/Sticker (22 / 25 / 30)
    tag_clear=0.3,       # radiales Spiel der Tag-Tasche
    tag_pocket_h=0.6,    # Tiefe der Tag-Tasche (Sticker 0,15-0,3 mm + Kleber/Schaumpad)
    cover_t=1.0,         # Material zwischen Tag und Telefon (Boden der Kappe), max. 1,2
    # --- Fuss / Kappe ---
    foot_d=44.0,         # Aussendurchmesser Fuss und Kappe
    cap_h=7.8,           # Gesamthoehe der Kappe (inkl. Boden)
    cap_gap=0.2,         # Schattenfuge Kappe/Fussring (Fuss sitzt auf dem Kappenboden auf)
    cap_wall_min=2.2,    # Wandstaerke der Kappe am Gewindegrund
    flute_n=24,          # Griffrillen am Kappenumfang
    flute_r=1.5,
    flute_depth=0.6,     # Restwand = cap_wall_min - flute_depth >= 1,6
    ring_h=2.5,          # zylindrischer Fussring oberhalb der Kappe
    foot_h=18.0,         # Oberkante Fuss (ab Stempelflaeche)
    foot_top_d=32.0,     # Durchmesser Fuss oben
    edge_chamfer=0.5,    # Kantenfasen
    # --- Rundgewinde (Exzenter-Kreis, stuetzfrei druckbar) ---
    cap_thr_e=0.45,      # Exzentrizitaet = halbe Gewindetiefe
    cap_thr_pitch=3.0,
    stud_r=7.5,          # mittlerer Radius Griffzapfen
    stud_len=9.5,
    stud_thr_e=0.6,
    stud_thr_pitch=4.0,
    thr_clear=0.25,      # radiales Gewindespiel (FDM)
    push_d=8.0,          # Ausdrueckloch fuer den Tag (durch den Fuss)
    # --- Griff ---
    handle_h=62.0,       # Griffhoehe ab Fuss-Oberkante
    collar_d=30.0,
    collar_h=4.0,
    waist_d=19.0,
    waist_z=26.0,        # Beginn der Taille (ab Griffunterkante)
    waist_len=4.0,
    knob_d=34.0,
    knob_z=48.0,         # Beginn des Knaufzylinders
    crown_h=6.0,         # Hoehe der oberen Verrundung
    top_d=29.0,          # Durchmesser der ebenen Oberseite
    # --- Logo-Scheibe ---
    logo_d=24.0,         # Durchmesser der Aufnahme im Griff
    logo_t=2.4,          # Dicke der Logo-Scheibe
    logo_chamfer=1.0,    # 45-Grad-Sitzfase unten
    logo_clear=0.10,     # radiales Spiel (leichte Presspassung nach FDM)
    logo_depth=0.6,      # Tiefe der Logo-Gravur
    # --- Gewicht (optional, nur im Griff!) ---
    use_weight=True,
    weight_d=12.0,       # Rundstahl Ø 12 x 30
    weight_len=30.0,
    weight_clear=0.2,
    # --- Aufloesung ---
    fn=128,
)

DENSITY = dict(PETG=1.27, PLA=1.24, ASA=1.07)  # g/cm3


def derive(p):
    """Abgeleitete Masse (gleiche Formeln wie in der .scad-Datei)."""
    d = dict(p)
    d["R"] = p["foot_d"] / 2
    d["cap_thr_rf"] = d["R"] - p["cap_wall_min"] - p["cap_thr_e"]      # Mutter (Kappe)
    d["cap_thr_rm"] = d["cap_thr_rf"] - p["thr_clear"]                 # Bolzen (Fusshals)
    d["stud_rf"] = p["stud_r"] + p["thr_clear"]
    d["pocket_r"] = p["tag_d"] / 2 + p["tag_clear"]
    d["z_pocket_top"] = p["cover_t"] + p["tag_pocket_h"]
    d["z_ring"] = p["cap_h"] + p["cap_gap"]                           # Unterkante Fussring
    d["total_h"] = p["foot_h"] + p["handle_h"]
    r_w = (p["weight_d"] / 2 + p["weight_clear"])
    d["r_w"] = r_w
    d["r_rec"] = p["logo_d"] / 2
    d["z_rec_bot"] = p["handle_h"] - (p["logo_t"] - p["logo_chamfer"])
    d["z_cone_bot"] = d["z_rec_bot"] - (d["r_rec"] - r_w)
    bore = (p["weight_len"] + 1.0) if p["use_weight"] else 0.0
    d["z_bore_bot"] = d["z_cone_bot"] - bore
    d["z_apex"] = d["z_bore_bot"] - r_w
    d["weight_to_tag"] = p["foot_h"] + d["z_bore_bot"] - d["z_pocket_top"]
    return d


# --------------------------------------------------------------------------
# Hilfsfunktionen
# --------------------------------------------------------------------------
def revolve(pts, fn):
    """Rotationskoerper aus (r, z)-Polygon."""
    return Manifold.revolve(CrossSection([np.array(pts, dtype=float)]), fn)


def cyl(r, z0, z1, fn, r2=None):
    return Manifold.cylinder(z1 - z0, r, r if r2 is None else r2, fn).translate((0, 0, z0))


def thread(r, e, pitch, z0, z1, fn):
    """Rundgewinde: exzentrischer Kreis (Radius r, Versatz e), rechtsgaengig verdreht.
    Phase ist eine Funktion der absoluten Hoehe z -> Bolzen und Mutter passen in
    Baugruppen-Koordinaten zueinander.
    Entspricht in OpenSCAD: rotate(360*z0/pitch) linear_extrude(h, twist=-360*h/pitch)
                            translate([e,0]) circle(r)"""
    h = z1 - z0
    # Hinweis: NICHT per twist-Extrusion (die Sehnen zwischen verdrehten Schichten wuerden
    # das Profil um bis zu 0,6 mm verfaelschen). Stattdessen gerader Zylinder, dessen
    # Schichten entlang einer Schraubenlinie verschoben werden - geometrisch identisch
    # zum idealen (fein unterteilten) OpenSCAD-Ergebnis.
    w = 2 * math.pi / pitch
    body = Manifold.extrude(CrossSection.circle(r, fn), h, max(2, math.ceil(h / 0.1))).translate((0, 0, z0))
    return body.warp(lambda v: (v[0] + e * math.cos(w * v[2]), v[1] + e * math.sin(w * v[2]), v[2]))


def handle_r(z, d):
    """Aussenkontur des Griffs: Radius ueber lokaler Hoehe z (0 = Griffunterkante)."""
    ch, H = d["edge_chamfer"], d["handle_h"]
    rc, rw, rk, rt = d["collar_d"] / 2, d["waist_d"] / 2, d["knob_d"] / 2, d["top_d"] / 2
    z_crown = H - d["crown_h"]
    if z < ch:
        return rc - ch + z
    if z < d["collar_h"]:
        return rc
    if z < d["waist_z"]:
        t = (z - d["collar_h"]) / (d["waist_z"] - d["collar_h"])
        return rw + (rc - rw) * (1 + math.cos(math.pi * t)) / 2
    if z < d["waist_z"] + d["waist_len"]:
        return rw
    if z < d["knob_z"]:
        z0 = d["waist_z"] + d["waist_len"]
        t = (z - z0) / (d["knob_z"] - z0)
        return rw + (rk - rw) * (1 - math.cos(math.pi * t)) / 2
    if z < z_crown:
        return rk
    s = (z - z_crown) / d["crown_h"]
    return rk - (rk - rt) * s * s


def handle_profile(d, n=12):
    zb = [0, d["edge_chamfer"], d["collar_h"], d["waist_z"], d["waist_z"] + d["waist_len"],
          d["knob_z"], d["handle_h"] - d["crown_h"], d["handle_h"]]
    pts = [(0.0, 0.0)]
    for i in range(len(zb) - 1):
        for j in range(n):
            z = zb[i] + (zb[i + 1] - zb[i]) * j / n
            pts.append((handle_r(z, d), z))
    pts.append((handle_r(d["handle_h"], d), d["handle_h"]))
    pts.append((0.0, d["handle_h"]))
    return pts


# --------------------------------------------------------------------------
# TEILE (Baugruppen-Koordinaten)
# --------------------------------------------------------------------------
def part_kappe(d):
    """(c) Abdeckkappe / Stempelflaeche: Becher mit 1,0 mm Boden + Innengewinde."""
    R, ch, fn = d["R"], d["edge_chamfer"], d["fn"]
    body = revolve([(0, 0), (R - ch, 0), (R, ch), (R, d["cap_h"]), (0, d["cap_h"])], fn)
    bore = thread(d["cap_thr_rf"], d["cap_thr_e"], d["cap_thr_pitch"],
                  d["cover_t"], d["cap_h"] + 1, fn)
    flutes = Manifold()
    fl = cyl(d["flute_r"], d["cover_t"] + ch, d["cap_h"] + 1, 32).translate(
        (R + d["flute_r"] - d["flute_depth"], 0, 0))
    flutes = Manifold.batch_boolean(
        [fl.rotate((0, 0, 360.0 * i / d["flute_n"])) for i in range(d["flute_n"])],
        __import__("manifold3d").OpType.Add)
    return body - bore - flutes


def part_fuss(d):
    """(b) Fuss: Ring + Konus, unten Gewindehals fuer die Kappe mit Tag-Tasche,
    oben Innengewinde fuer den Griffzapfen, dazwischen Ausdrueckloch."""
    R, ch, fn = d["R"], d["edge_chamfer"], d["fn"]
    zr, zt, rt = d["z_ring"], d["foot_h"], d["foot_top_d"] / 2
    upper = revolve([(0, zr), (R, zr), (R, zr + d["ring_h"]),
                     (rt, zt - ch), (rt - ch, zt), (0, zt)], fn)
    # Gewindehals (Bolzen), unten mit Einfuehrfase
    z0 = d["cover_t"]
    rmax = d["cap_thr_rm"] + d["cap_thr_e"]
    neck = thread(d["cap_thr_rm"], d["cap_thr_e"], d["cap_thr_pitch"], z0, zr + 0.5, fn)
    lead = revolve([(0, z0), (rmax - 0.6, z0), (rmax + 0.1, z0 + 0.7),
                    (rmax + 0.1, zr + 0.5), (0, zr + 0.5)], fn)
    body = upper + (neck ^ lead)
    # Tag-Tasche
    pocket = cyl(d["pocket_r"], z0 - 1, d["z_pocket_top"], fn)
    # Innengewinde fuer Griffzapfen + 45-Grad-Uebergang + Ausdrueckloch
    z_thr = zt - d["stud_len"] - 1.0
    rf, e = d["stud_rf"], d["stud_thr_e"]
    nut = thread(rf, e, d["stud_thr_pitch"], z_thr, zt + 1, fn)
    rp = d["push_d"] / 2
    trans = revolve([(0, z_thr - (rf + e - rp)), (rp, z_thr - (rf + e - rp)),
                     (rf + e, z_thr), (rf + e, z_thr + 0.01), (0, z_thr + 0.01)], fn)
    push = cyl(rp, d["z_pocket_top"] - 0.5, z_thr, fn)
    rl = rf + e + 0.8                                   # 45-Grad-Senkung als Einfuehrfase
    lead_in = revolve([(0, zt + 0.1 - rl), (rl, zt + 0.1), (0, zt + 0.1)], fn)
    return body - pocket - nut - trans - push - lead_in


def part_griff(d):
    """(a) Griff: Rotationskoerper mit Gewindezapfen unten, oben Aufnahme fuer die
    Logo-Scheibe und (optional) Bohrung fuer das Gewicht."""
    fn, zt, H = d["fn"], d["foot_h"], d["handle_h"]
    body = revolve(handle_profile(d), fn).translate((0, 0, zt))
    # Gewindezapfen mit Endfase
    zs = zt - d["stud_len"]
    rmax = d["stud_r"] + d["stud_thr_e"]
    stud = thread(d["stud_r"], d["stud_thr_e"], d["stud_thr_pitch"], zs, zt + 0.5, fn)
    lead = revolve([(0, zs), (rmax - 0.7, zs), (rmax + 0.1, zs + 0.8),
                    (rmax + 0.1, zt + 0.5), (0, zt + 0.5)], fn)
    # Hohlraum: Logo-Aufnahme -> 45-Grad-Konus -> Gewichtsbohrung -> 45-Grad-Dach
    cav = revolve([(0, d["z_apex"]), (d["r_w"], d["z_bore_bot"]), (d["r_w"], d["z_cone_bot"]),
                   (d["r_rec"], d["z_rec_bot"]), (d["r_rec"], H + 0.1), (0, H + 0.1)],
                  fn).translate((0, 0, zt))
    return body + (stud ^ lead) - cav


def part_logo(d, with_logo=True):
    """(d) Logo-Scheibe: Zylinder mit 45-Grad-Sitzfase, Gravur (Platzhalter 'T' im Ring),
    Fingernagel-Kerbe am Rand zum Aushebeln."""
    fn = d["fn"]
    r = d["r_rec"] - d["logo_clear"]
    c, t = d["logo_chamfer"], d["logo_t"]
    # lokal modelliert (z = 0 Unterseite der Scheibe), danach in Einbaulage verschoben
    disc = revolve([(0, 0), (r - c, 0), (r, c), (r, t), (0, t)], fn)
    disc = disc - cyl(2.5, c, t + 1, 48).translate((0, -(r + 0.7), 0))
    if with_logo:
        zg = t - d["logo_depth"]
        k = d["logo_d"] / 24.0
        ring = cyl(10.2 * k, zg, t + 1, fn) - cyl(9.2 * k, zg - 1, t + 2, fn)
        ring = ring - Manifold.cube((8 * k, 6 * k, 8), True).translate((0, -10 * k, t))
        bar_h = Manifold.cube((10 * k, 2.6 * k, 2), False).translate((-5 * k, 2.6 * k, zg))
        bar_v = Manifold.cube((2.6 * k, 10 * k, 2), False).translate((-1.3 * k, -4.8 * k, zg))
        disc = disc - ring - bar_h - bar_v
    return disc.translate((0, 0, d["total_h"] - t))


def weight_body(d):
    r = d["weight_d"] / 2
    z0 = d["foot_h"] + d["z_bore_bot"]
    return cyl(r, z0, z0 + d["weight_len"], 64)


def tag_body(d):
    return cyl(d["tag_d"] / 2, d["z_pocket_top"] - 0.25, d["z_pocket_top"], 96)


def to_print(name, part, d):
    """Baugruppen-Lage -> Drucklage (z = 0 auf dem Bett, stuetzfrei)."""
    if name == "kappe":
        return part                                              # Boden auf dem Bett
    if name == "fuss":
        return part.rotate((180, 0, 0)).translate((0, 0, d["foot_h"]))    # Oberseite aufs Bett
    if name == "griff":
        return part.rotate((180, 0, 0)).translate((0, 0, d["total_h"]))   # Knauf aufs Bett
    if name == "logo":
        return part.translate((0, 0, -(d["total_h"] - d["logo_t"])))      # Logo nach oben
    raise ValueError(name)


def build(p):
    d = derive(p)
    parts = dict(kappe=part_kappe(d), fuss=part_fuss(d), griff=part_griff(d), logo=part_logo(d))
    return d, parts


# --------------------------------------------------------------------------
# Export + Pruefung
# --------------------------------------------------------------------------
def to_trimesh(man):
    import trimesh
    mesh = man.to_mesh()
    tm = trimesh.Trimesh(vertices=np.asarray(mesh.vert_properties)[:, :3],
                         faces=np.asarray(mesh.tri_verts), process=False)
    return tm


def overhang_report(tm, limit_deg=45.0, tol_deg=1.5):
    """Flaeche nach unten zeigender Facetten, die flacher als limit_deg zur Horizontalen
    liegen (also > 45 Grad Ueberhang), ohne die Auflageflaeche auf dem Bett."""
    n = tm.face_normals
    zc = tm.triangles_center[:, 2]
    ang = np.degrees(np.arcsin(np.clip(-n[:, 2], -1, 1)))   # 90 = waagerecht nach unten
    bad = (ang > limit_deg + tol_deg) & (zc > 0.05)
    return float(tm.area_faces[bad].sum()), float(ang[zc > 0.05].max(initial=0.0))


def check_and_export(name, man, path):
    tm = to_trimesh(man)
    tm.export(path)
    import trimesh
    back = trimesh.load(path, force="mesh")          # STL erneut laden (Vertices werden verschmolzen)
    ext = back.bounds[1] - back.bounds[0]
    area, worst = overhang_report(tm)
    res = dict(
        name=name, path=path, bytes=os.path.getsize(path), faces=len(back.faces),
        watertight=bool(back.is_watertight), winding=bool(back.is_winding_consistent),
        volume_ok=bool(back.is_volume), bodies=len(man.decompose()),
        status=str(man.status()), genus=man.genus(),
        bbox=tuple(round(float(x), 2) for x in ext), zmin=round(float(back.bounds[0][2]), 3),
        volume_cm3=float(back.volume) / 1000.0, overhang_area=area, worst_angle=worst,
    )
    return res


def main():
    ap = argparse.ArgumentParser()
    here = os.path.dirname(os.path.abspath(__file__))
    ap.add_argument("--out", default=os.path.join(here, "..", "stl"))
    ap.add_argument("--tag-d", type=float, default=P["tag_d"])
    ap.add_argument("--no-variants", action="store_true")
    a = ap.parse_args()
    out = os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)

    p = dict(P, tag_d=a.tag_d)
    d, parts = build(p)
    jobs = [
        ("griff", f"tapperl_griff.stl", to_print("griff", parts["griff"], d)),
        ("fuss", f"tapperl_fuss_tag{int(a.tag_d)}.stl", to_print("fuss", parts["fuss"], d)),
        ("kappe", "tapperl_kappe.stl", to_print("kappe", parts["kappe"], d)),
        ("logo", "tapperl_logoscheibe.stl", to_print("logo", parts["logo"], d)),
        ("logo_blank", "tapperl_logoscheibe_blank.stl",
         to_print("logo", part_logo(d, with_logo=False), d)),
    ]
    if not a.no_variants:
        for td in (22.0, 25.0, 30.0):
            if td == a.tag_d:
                continue
            dv = derive(dict(P, tag_d=td))
            jobs.append((f"fuss_tag{int(td)}", f"tapperl_fuss_tag{int(td)}.stl",
                         to_print("fuss", part_fuss(dv), dv)))

    ok = True
    print(f"{'Datei':34s} {'BBox X x Y x Z [mm]':24s} {'Vol cm3':>8s} {'Dreiecke':>8s} "
          f"{'dicht':>5s} {'Koerper':>7s} {'Ueberh.>45 mm2':>14s} {'max Grad':>8s}")
    total_vol = 0.0
    for name, fname, man in jobs:
        r = check_and_export(name, man, os.path.join(out, fname))
        good = (r["watertight"] and r["winding"] and r["volume_ok"] and r["bodies"] == 1
                and r["status"].endswith("NoError") and r["bytes"] > 1000 and abs(r["zmin"]) < 1e-3)
        ok &= good
        if not good:
            print("   !!", r)
        if name in ("griff", "fuss", "kappe", "logo"):
            total_vol += r["volume_cm3"]
        bb = "{:.2f} x {:.2f} x {:.2f}".format(*r["bbox"])
        print(f"{fname:34s} {bb:24s} {r['volume_cm3']:8.2f} {r['faces']:8d} "
              f"{'ja' if good else 'NEIN':>5s} {r['bodies']:7d} {r['overhang_area']:14.2f} {r['worst_angle']:8.1f}")

    # Baugruppen-Vorschau (nicht zum Drucken): Teile in Einbaulage, einzelne Koerper
    asm = Manifold.compose([parts["kappe"], parts["fuss"], parts["griff"], parts["logo"]])
    to_trimesh(asm).export(os.path.join(out, "tapperl_baugruppe_vorschau.stl"))

    # Kollisionspruefung in Einbaulage
    names = list(parts)
    print("\nDurchdringung in Einbaulage (soll 0 sein):")
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            v = (parts[names[i]] ^ parts[names[j]]).volume()
            print(f"  {names[i]:6s} / {names[j]:6s}: {v:8.3f} mm3")
            ok &= v < 0.5
    wv = (weight_body(d) ^ parts["griff"]).volume() if d["use_weight"] else 0.0
    tv = (tag_body(d) ^ (parts["fuss"] + parts["kappe"])).volume()
    print(f"  Gewicht / Griff: {wv:8.3f} mm3   Tag / Fuss+Kappe: {tv:8.3f} mm3")
    ok &= wv < 0.5 and tv < 0.5

    print(f"\nGesamthoehe {d['total_h']:.1f} mm, Fuss Ø {d['foot_d']:.1f} mm, "
          f"Material Tag->Telefon {d['cover_t']:.2f} mm")
    print(f"Kappengewinde: Bolzen r={d['cap_thr_rm']:.2f}, Mutter r={d['cap_thr_rf']:.2f}, "
          f"e={d['cap_thr_e']}, P={d['cap_thr_pitch']}")
    print(f"Abstand Gewicht (Unterkante) -> Tag: {d['weight_to_tag']:.1f} mm (Soll >= 15)")
    print(f"Vollvolumen Druckteile: {total_vol:.1f} cm3 -> PETG massiv {total_vol*DENSITY['PETG']:.0f} g")
    if d["use_weight"]:
        wm = math.pi * (d["weight_d"] / 20) ** 2 * d["weight_len"] / 10 * 7.85
        print(f"Gewicht Stahl Ø{d['weight_d']:.0f}x{d['weight_len']:.0f}: {wm:.1f} g")
    print("\nERGEBNIS:", "alle Druckteile wasserdicht / manifold, ein Koerper je Datei" if ok else "FEHLER")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
