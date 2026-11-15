#!/usr/bin/env python3
"""Erzeugt massskizze.svg (A3 quer, Massstab 2:1 / Detail 10:1) direkt aus der
Geometrie von ../cad/generate_stl.py - Schnitt und Masse stammen also aus demselben
Parametersatz wie die STL-Dateien.   Aufruf:  python3 make_massskizze.py"""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "cad"))
import generate_stl as g  # noqa: E402
from manifold3d import CrossSection  # noqa: E402

d, parts = g.build(g.P)
S = 2.0                      # Massstab Hauptansichten
AX, BASE = 112.0, 222.0      # Blattposition der Achse / der Stempelflaeche (Schnitt)
TX, TY = 305.0, 92.0         # Mittelpunkt Draufsicht
out = []


def fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return s.replace(".", ",")


def X(x):
    return AX + S * x


def Y(z):
    return BASE - S * z


def section_polys(man, y=0.003):
    """Schnitt in der Ebene y = const -> Polygone in (x, z)."""
    cs = man.rotate((90, 0, 0)).slice(y)          # (x, y, z) -> (x, -z, y)
    return [np.column_stack([p[:, 0], -p[:, 1]]) for p in cs.to_polygons()]


def path(polys, fx, fy, cls):
    dstr = ""
    for p in polys:
        dstr += "M" + " L".join(f"{fx(a):.2f},{fy(b):.2f}" for a, b in p) + " Z "
    out.append(f'<path class="{cls}" fill-rule="evenodd" d="{dstr}"/>')


def line(x1, y1, x2, y2, cls="thin"):
    out.append(f'<line class="{cls}" x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}"/>')


def text(x, y, s, cls="dim", anchor="middle", rot=None):
    tr = f' transform="rotate({rot} {x:.2f} {y:.2f})"' if rot is not None else ""
    out.append(f'<text class="{cls}" x="{x:.2f}" y="{y:.2f}" text-anchor="{anchor}"{tr}>{s}</text>')


def hdim(x1, x2, y, s, e1=None, e2=None, side=-1):
    """Horizontales Mass; e1/e2 = y-Start der Masshilfslinien."""
    for x, e in ((x1, e1), (x2, e2)):
        if e is not None:
            line(x, e, x, y + (1.5 if y > e else -1.5), "ext")
    out.append(f'<line class="dimline" x1="{x1:.2f}" y1="{y:.2f}" x2="{x2:.2f}" y2="{y:.2f}" '
               f'marker-start="url(#arr)" marker-end="url(#arr)"/>')
    text((x1 + x2) / 2, y + (-1.2 if side < 0 else 4.0), s)


def vdim(y1, y2, x, s, e1=None, e2=None, outside=False):
    for yy, e in ((y1, e1), (y2, e2)):
        if e is not None:
            line(e, yy, x + (1.5 if x > e else -1.5), yy, "ext")
    if outside:   # kleines Mass: Pfeile von aussen
        out.append(f'<line class="dimline" x1="{x:.2f}" y1="{min(y1,y2)-6:.2f}" x2="{x:.2f}" y2="{min(y1,y2):.2f}" marker-end="url(#arr)"/>')
        out.append(f'<line class="dimline" x1="{x:.2f}" y1="{max(y1,y2)+6:.2f}" x2="{x:.2f}" y2="{max(y1,y2):.2f}" marker-end="url(#arr)"/>')
        if outside == "left":
            text(x - 2, (y1 + y2) / 2 + 1.1, s, anchor="end")
        else:
            text(x + 2, (y1 + y2) / 2 + 1.1, s, anchor="start")
    else:
        out.append(f'<line class="dimline" x1="{x:.2f}" y1="{y1:.2f}" x2="{x:.2f}" y2="{y2:.2f}" '
                   f'marker-start="url(#arr)" marker-end="url(#arr)"/>')
        text(x - 1.2, (y1 + y2) / 2, s, rot=-90)


def leader(x1, y1, x2, y2, s, anchor="start"):
    out.append(f'<line class="dimline" x1="{x2:.2f}" y1="{y2:.2f}" x2="{x1:.2f}" y2="{y1:.2f}" marker-end="url(#dot)"/>')
    text(x2 + (1 if anchor == "start" else -1), y2 + 1.1, s, anchor=anchor)


def balloon(n, px, py, bx, by):
    out.append(f'<line class="dimline" x1="{bx:.2f}" y1="{by:.2f}" x2="{px:.2f}" y2="{py:.2f}" marker-end="url(#dot)"/>')
    out.append(f'<circle class="balloon" cx="{bx:.2f}" cy="{by:.2f}" r="3.6"/>')
    text(bx, by + 1.25, str(n), cls="bal")


# ------------------------------------------------------------------ Schnitt A-A
sec = {k: section_polys(v) for k, v in parts.items()}
text(AX, 30, "Schnitt A–A  (M 2:1)", cls="title")
zt, H, R = d["foot_h"], d["total_h"], d["R"]
# Gewicht + Tag (Zukaufteile)
if d["use_weight"]:
    wz0 = zt + d["z_bore_bot"]
    wr = d["weight_d"] / 2
    out.append(f'<rect class="weight" x="{X(-wr):.2f}" y="{Y(wz0 + d["weight_len"]):.2f}" '
               f'width="{S*2*wr:.2f}" height="{S*d["weight_len"]:.2f}"/>')
for k in ("kappe", "fuss", "griff", "logo"):
    path(sec[k], X, Y, f"cut h_{k}")
tr = d["tag_d"] / 2
out.append(f'<rect class="tag" x="{X(-tr):.2f}" y="{Y(d["z_pocket_top"]):.2f}" width="{S*2*tr:.2f}" height="{S*0.3:.2f}"/>')
line(AX, Y(H) - 8, AX, BASE + 5, "center")

# Hoehenmasse rechts
xr1, xr2 = X(R) + 14, X(R) + 26
vdim(Y(0), Y(zt), xr1, fmt(zt), e1=X(R) + 1, e2=X(d["foot_top_d"] / 2) + 1)
vdim(Y(zt), Y(H), xr1, fmt(d["handle_h"]), e2=X(d["top_d"] / 2) + 1)
vdim(Y(0), Y(H), xr2, fmt(H), e1=xr1 + 2, e2=xr1 + 2)
# Hoehenmasse links
xl1, xl2 = X(-R) - 10, 19.0
vdim(Y(0), Y(d["cap_h"]), xl1, fmt(d["cap_h"]), e1=X(-R) - 1, e2=X(-R) - 1)
if d["use_weight"]:
    vdim(Y(d["z_pocket_top"]), Y(wz0), xl2, f'{fmt(d["weight_to_tag"])}  (Abstand Gewicht–Tag, Soll ≥ 15)',
         e1=X(-tr) - 1, e2=X(-wr) - 1)
# Durchmesser unten
hdim(X(-d["pocket_r"]), X(d["pocket_r"]), BASE + 9, f'Ø{fmt(2*d["pocket_r"])} Tag-Tasche (Tag Ø{fmt(d["tag_d"])})',
     e1=Y(d["cover_t"]), e2=Y(d["cover_t"]), side=1)
hdim(X(-R), X(R), BASE + 19, f'Ø{fmt(d["foot_d"])}', e1=BASE + 0.5, e2=BASE + 0.5, side=1)
# Durchmesser oben
hdim(X(-d["r_rec"]), X(d["r_rec"]), Y(H) - 9, f'Ø{fmt(d["logo_d"])}', e1=Y(H) - 0.5, e2=Y(H) - 0.5)
hdim(X(-d["knob_d"] / 2), X(d["knob_d"] / 2), Y(H) - 18, f'Ø{fmt(d["knob_d"])}',
     e1=Y(zt + d["knob_z"] + 4), e2=Y(zt + d["knob_z"] + 4))
# Hinweise
zw = zt + d["waist_z"] + d["waist_len"] / 2
leader(X(d["waist_d"] / 2), Y(zw), X(d["waist_d"] / 2) + 16, Y(zw) - 4, f'Ø{fmt(d["waist_d"])} Taille')
leader(X(d["collar_d"] / 2), Y(zt + 2.5), X(R) + 3, Y(zt + 2.5) - 12, f'Ø{fmt(d["collar_d"])} Bund')
leader(X(d["foot_top_d"] / 2 + 1.5), Y(zt - 2), X(R) + 3, Y(zt) - 5.5, f'Ø{fmt(d["foot_top_d"])} / Konus ≈ 41°')
leader(X(d["stud_r"]), Y(zt - 4), X(-R) - 6, Y(zt + 9),
       f'Rundgewinde Ø{fmt(2*(d["stud_r"]+d["stud_thr_e"]))} × P{fmt(d["stud_thr_pitch"])}', anchor="end")
leader(X(-d["cap_thr_rm"]), Y(4.5), X(-R) - 6, Y(13.5),
       f'Rundgewinde Ø{fmt(2*(d["cap_thr_rm"]+d["cap_thr_e"]))} × P{fmt(d["cap_thr_pitch"])}', anchor="end")
leader(X(0.6), Y(d["z_pocket_top"] + 2.2), X(-R) - 6, Y(21), f'Ausdrückloch Ø{fmt(d["push_d"])}', anchor="end")
# Positionsnummern
balloon(1, X(-12), Y(zt + 52), X(-R) - 12, Y(zt + 56))
balloon(2, X(17), Y(12), X(R) + 34, Y(12) + 2)
balloon(3, X(R - 0.8), Y(4), X(R) + 34, Y(1.5) + 7)
balloon(4, X(7), Y(H - 1.6), X(R) + 6, Y(H) - 2)
balloon(5, X(-9), Y(d["z_pocket_top"] - 0.15), X(-R) - 14, BASE + 12)
if d["use_weight"]:
    balloon(6, X(-2), Y(wz0 + 12), X(-R) - 12, Y(wz0 + 16))

# ------------------------------------------------------------------ Draufsicht
text(TX, 30, "Draufsicht  (M 2:1)", cls="title")


def circ(r, cls):
    out.append(f'<circle class="{cls}" cx="{TX}" cy="{TY}" r="{S*r:.2f}"/>')


circ(R, "vis")
circ(d["foot_top_d"] / 2, "vis2")
circ(d["knob_d"] / 2, "vis")
circ(d["top_d"] / 2, "vis2")
circ(d["r_rec"], "vis2")
circ(d["tag_d"] / 2, "hid")
top = parts["logo"].slice(H - 0.3).to_polygons()
path(top, lambda a: TX + S * a, lambda b: TY - S * b, "logo")
line(TX - S * R - 12, TY, TX + S * R + 12, TY, "center")
line(TX, TY - S * R - 6, TX, TY + S * R + 6, "center")
for sx in (-1, 1):
    xx = TX + sx * (S * R + 10)
    out.append(f'<line class="secarrow" x1="{xx:.2f}" y1="{TY - 9:.2f}" x2="{xx:.2f}" y2="{TY - 1:.2f}" marker-start="url(#arr)"/>')
    text(xx, TY - 11, "A", cls="title")
hdim(TX - S * R, TX + S * R, TY + S * R + 12, f'Ø{fmt(d["foot_d"])}', e1=TY + 2, e2=TY + 2, side=1)
leader(TX + S * d["knob_d"] / 2 * 0.707, TY - S * d["knob_d"] / 2 * 0.707, TX + S * R + 4, TY - S * R + 2, f'Ø{fmt(d["knob_d"])} Knauf')
leader(TX + S * d["r_rec"] * 0.5, TY - S * d["r_rec"] * 0.866, TX + S * R + 4, TY - S * R - 6, f'Ø{fmt(d["logo_d"])} Logo-Scheibe (Pos. 4)')
leader(TX + S * tr * 0.707, TY + S * tr * 0.707, TX + S * R + 4, TY + S * R - 2, f'Ø{fmt(d["tag_d"])} NFC-Tag (verdeckt)')
leader(TX, TY + S * (d["r_rec"] - 1.2), TX - S * R - 4, TY + S * R - 2, 'Aushebelkerbe', anchor="end")

# ------------------------------------------------------------------ Detail Z (10:1)
DS, DX0, DZ0 = 10.0, 9.2, -0.0
OX, OY = 246.0, 236.0
x_hi, z_hi = 22.6, 4.3


def DXf(x):
    return OX + DS * (x - DX0)


def DYf(z):
    return OY - DS * z


text((DXf(DX0) + DXf(x_hi)) / 2, OY - DS * z_hi - 9, "Detail Z  (M 10:1) – Tag-Tasche und Abdeckung", cls="title")
clip = CrossSection([np.array([(DX0, -z_hi), (x_hi, -z_hi), (x_hi, 0.0), (DX0, 0.0)])])
for k in ("kappe", "fuss"):
    cs = parts[k].rotate((90, 0, 0)).slice(0.003) ^ clip
    polys = [np.column_stack([p[:, 0], -p[:, 1]]) for p in cs.to_polygons()]
    path(polys, DXf, DYf, f"cut h_{k}")
out.append(f'<rect class="tag" x="{DXf(DX0):.2f}" y="{DYf(d["z_pocket_top"]):.2f}" width="{DS*(tr-DX0):.2f}" height="{DS*0.3:.2f}"/>')
out.append(f'<rect class="break" x="{DXf(DX0):.2f}" y="{DYf(z_hi):.2f}" width="{DS*(x_hi-DX0):.2f}" height="{DS*z_hi:.2f}"/>')
xd = DXf(R) + 9
vdim(DYf(0), DYf(d["cover_t"]), xd, f'{fmt(d["cover_t"])} Abdeckung', e1=DXf(R) + 1, e2=DXf(R) + 1, outside="right")
xd2 = DXf(DX0) - 8
vdim(DYf(d["cover_t"]), DYf(d["z_pocket_top"]), xd2, f'{fmt(d["tag_pocket_h"])} Tasche', e1=DXf(DX0) + 6, e2=DXf(DX0) + 6, outside="left")
hdim(DXf(d["cap_thr_rf"] + d["cap_thr_e"]), DXf(R - d["flute_depth"]), DYf(3.4),
     f'≥ {fmt(d["cap_wall_min"] - d["flute_depth"])}', side=-1)
leader(DXf(tr - 1.2), DYf(d["z_pocket_top"] - 0.15), DXf(DX0) + 4, OY + 9, 'NFC-Tag (Pos. 5)')
leader(DXf(18), DYf(0.5), DXf(16), OY + 9, f'Stempelfläche, Kantenfase {fmt(d["edge_chamfer"])}×45°')
# Markierung Z im Schnitt
out.append(f'<rect class="zmark" x="{X(DX0):.2f}" y="{Y(z_hi):.2f}" width="{S*(x_hi-DX0):.2f}" height="{S*z_hi:.2f}" rx="1.5"/>')
text(X(x_hi) + 2.5, Y(z_hi) + 1.0, "Z", cls="title", anchor="start")

# ------------------------------------------------------------------ Stueckliste + Schriftfeld
LX, LY = 22, 254
rows = [("Pos.", "Benennung", "Werkstoff / Bemerkung"),
        ("1", "Griff mit Gewindezapfen", "PETG, Druck: Knauf nach unten"),
        ("2", f"Fuß mit Tag-Tasche Ø{fmt(2*d['pocket_r'])}", "PETG, Druck: Oberseite nach unten"),
        ("3", f"Abdeckkappe, Boden {fmt(d['cover_t'])} mm", "PETG, Druck: Boden nach unten"),
        ("4", "Logo-Scheibe (austauschbar)", "PETG/PLA, Logo nach oben"),
        ("5", f"NFC-Tag NTAG 424 DNA Ø{fmt(d['tag_d'])}", "Zukaufteil, selbstklebend"),
        ("6", f"Gewicht Rundstahl Ø{fmt(d['weight_d'])}×{fmt(d['weight_len'])} (optional)", "nur im Griff, kein Metall im Fuß")]
for i, (a, b, c) in enumerate(rows):
    yy = LY + i * 4.3
    cls = "tblh" if i == 0 else "tbl"
    text(LX + 2, yy, a, cls=cls, anchor="start")
    text(LX + 12, yy, b, cls=cls, anchor="start")
    text(LX + 92, yy, c, cls=cls, anchor="start")
out.append(f'<rect class="frame2" x="{LX}" y="{LY-5}" width="170" height="{len(rows)*4.3+2.5:.1f}"/>')
line(LX, LY + 1.6, LX + 170, LY + 1.6, "thin")

BX, BY, BW, BH = 250, 255, 160, 32
out.append(f'<rect class="frame2" x="{BX}" y="{BY}" width="{BW}" height="{BH}"/>')
line(BX, BY + 12, BX + BW, BY + 12, "thin")
line(BX + 100, BY + 12, BX + 100, BY + BH, "thin")
text(BX + 4, BY + 8.3, "Tably NFC-Stempel – Maßskizze Baugruppe", cls="big", anchor="start")
text(BX + 4, BY + 18, "Alle Maße in mm · Nennmaße des CAD-Modells", cls="tbl", anchor="start")
text(BX + 4, BY + 23, "Allgemeintoleranz FDM ca. ±0,2 mm", cls="tbl", anchor="start")
text(BX + 4, BY + 28, "Quelle: cad/generate_stl.py (= tably_stamp.scad)", cls="tbl", anchor="start")
text(BX + 104, BY + 18, "Maßstab 2:1 (Detail 10:1)", cls="tbl", anchor="start")
text(BX + 104, BY + 23, "Blatt A3 quer · Rev. A", cls="tbl", anchor="start")
text(BX + 104, BY + 28, f"Gesamt Ø{fmt(d['foot_d'])} × {fmt(H)}", cls="tbl", anchor="start")

svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 420 297">
<title>Tably NFC-Stempel – Maßskizze</title>
<defs>
  <marker id="arr" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="3.2" markerHeight="1.9" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
    <path d="M0,0 L10,3 L0,6 Z" fill="#111"/></marker>
  <marker id="dot" viewBox="0 0 4 4" refX="2" refY="2" markerWidth="1.1" markerHeight="1.1" markerUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="2" fill="#111"/></marker>
  <pattern id="h1" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="1.6" height="1.6" fill="#f3e7d3"/><line x1="0" y1="0" x2="0" y2="1.6" stroke="#8a6a3a" stroke-width="0.22"/></pattern>
  <pattern id="h2" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
    <rect width="1.6" height="1.6" fill="#dfe9f3"/><line x1="0" y1="0" x2="0" y2="1.6" stroke="#3d6a94" stroke-width="0.22"/></pattern>
  <pattern id="h3" width="1.1" height="1.1" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="1.1" height="1.1" fill="#e2f1e2"/><line x1="0" y1="0" x2="0" y2="1.1" stroke="#3c7d45" stroke-width="0.2"/></pattern>
  <pattern id="h4" width="1.1" height="1.1" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
    <rect width="1.1" height="1.1" fill="#f6dede"/><line x1="0" y1="0" x2="0" y2="1.1" stroke="#a04444" stroke-width="0.2"/></pattern>
  <pattern id="h5" width="1.4" height="1.4" patternUnits="userSpaceOnUse">
    <rect width="1.4" height="1.4" fill="#d9d9d9"/><path d="M0,0 L1.4,1.4 M1.4,0 L0,1.4" stroke="#666" stroke-width="0.16"/></pattern>
</defs>
<style>
  text {{ font-family: "DejaVu Sans", Arial, Helvetica, sans-serif; fill: #111; }}
  .dim {{ font-size: 3.1px; }} .title {{ font-size: 4.4px; font-weight: bold; }}
  .big {{ font-size: 5px; font-weight: bold; }} .tbl {{ font-size: 2.9px; }} .tblh {{ font-size: 2.9px; font-weight: bold; }}
  .bal {{ font-size: 3.6px; font-weight: bold; }}
  .cut {{ stroke: #111; stroke-width: 0.35; stroke-linejoin: round; }}
  .h_griff {{ fill: url(#h1); }} .h_fuss {{ fill: url(#h2); }} .h_kappe {{ fill: url(#h3); }} .h_logo {{ fill: url(#h4); }}
  .weight {{ fill: url(#h5); stroke: #444; stroke-width: 0.25; stroke-dasharray: 1.5 0.8; }}
  .tag {{ fill: #d6007f; stroke: none; }}
  .thin {{ stroke: #111; stroke-width: 0.18; }} .ext {{ stroke: #111; stroke-width: 0.13; }}
  .dimline {{ stroke: #111; stroke-width: 0.16; fill: none; }}
  .secarrow {{ stroke: #111; stroke-width: 0.5; }}
  .center {{ stroke: #c22; stroke-width: 0.18; stroke-dasharray: 6 1.2 1 1.2; }}
  .vis {{ fill: none; stroke: #111; stroke-width: 0.4; }} .vis2 {{ fill: none; stroke: #111; stroke-width: 0.22; }}
  .hid {{ fill: none; stroke: #d6007f; stroke-width: 0.3; stroke-dasharray: 1.6 1; }}
  .logo {{ fill: #f6dede; stroke: #111; stroke-width: 0.25; }}
  .balloon {{ fill: #fff; stroke: #111; stroke-width: 0.25; }}
  .frame {{ fill: none; stroke: #111; stroke-width: 0.5; }} .frame2 {{ fill: none; stroke: #111; stroke-width: 0.35; }}
  .break {{ fill: none; stroke: #777; stroke-width: 0.2; stroke-dasharray: 2 1; }}
  .zmark {{ fill: none; stroke: #111; stroke-width: 0.25; stroke-dasharray: 2 0.8; }}
</style>
<rect x="0" y="0" width="420" height="297" fill="#fff"/>
<rect class="frame" x="10" y="10" width="400" height="277"/>
{chr(10).join(out)}
</svg>
'''
dst = os.path.join(HERE, "massskizze.svg")
with open(dst, "w", encoding="utf-8") as f:
    f.write(svg)
print("geschrieben:", dst, len(svg), "Bytes")
