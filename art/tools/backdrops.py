#!/usr/bin/env python3
"""Draw the six zone backdrops: the neighbourhood band between the top bar and the road.

backdrop-<zone>: 360x158 images in Endesga 32, drawn on screen rows 48 to 205.
The street ends at a T-junction: the bottom rows continue the pseudo-3D road
below the band (the same projection, so the same road, curb and sidewalk edges
at the same slope) up to a cross street that runs flat across the band. Beyond it the far side faces the camera: the
zone's houses, park or shops, the scenery behind them (hills, a second row of houses, a
town, a river) and the sky. The houses are slim, about as tall as they are wide under a steep
gable (house with SLIM parts), with trees, hedges and side yards between them. The band, the
approach and the camera come from the game's layout export. The scenery gags (cat on a perch,
a kite caught in a tree) are separate sprites the game places in this band, on the near corners
either side of the street. Beside the kite's tree each zone draws its own static ornament on the
near-right lawn (ORNAMENTS): a bird bath on Elm Avenue, a flower bed in Fairview Park, a pot of
flowers on Main Street's paving, pumpkins on The Long Way Home, a gnome and a toadstool on Willow
Crescent and a rowboat planter on Riverside Path.

Rows, in band rows (0 to 157): the sky is one flat colour above row 45 (CALM), under the
message strip; the far side's ground row 115 (BASE), the far sidewalk 119 to 122, the far curb
123 to 124, the cross street 125 to 133 with its centre line on row 129, the near sidewalk 134
to 138, and the stub from row 139 (STUB, the approach) to the bottom row, 157, which continues
the game's road (the 320-wide strip on columns 100 to 259, lane dividers on 132, 164, 195 and
227, verge outside). Gag spots, kept clear (python3 art/tools/backdrops.py gags prints them for
the current constants): the near-left perch's top rail on rows 142 to 143, x 0 to 72; the
near-right lawn's kite spot, x 284 to 319 (its sprite's top row 117, its foot's outline on row
155), with the ornament beside it at x 322 to 353, its feet on row 155; and the two sidewalks,
whose middles run from (87, 157) to (94, 138) and from
(273, 157) to (266, 138).

Usage:
  backdrops.py preview OUT.png   all six, stacked, scaled up
  backdrops.py gags              print the gag spots and the join for the current constants
  backdrops.py build             write art/backdrops/*.aseprite and
                                 public/art/images/*.png

Run from the repository root. A build overwrites the
.aseprite sources, so hand edits to them belong in this file instead.
"""

import math
import os
import random
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import fonts  # noqa: E402
import scene as sn  # noqa: E402
from pixel import DARKER, K, Grid  # noqa: E402

# ---------- the band and the camera ----------
# Everything below is drawn from these, read from the game's layout export. The camera is the
# game's: the horizon and foot rows on screen, the focal length F in road pixels and the road's
# centre column. The road below the band then shows VISIBLE road pixels, F (1 / s - 1) for the
# scale s on screen row BAR + H.
LAYOUT = sn.LAYOUT
BAND = LAYOUT["regions"]["backdrop"]
W, H = BAND["width"], BAND["height"]   # the band: screen rows BAR to BAR + H - 1
BAR = BAND["y"]                # the status bar's height: band row y is screen row BAR + y
CAMERA = LAYOUT["camera"]
CX = CAMERA["centerX"]         # the road's centre column, and its vanishing point's
YH, FOOT, F = CAMERA["horizonY"], CAMERA["footY"], CAMERA["focal"]


def dk(c):
    return DARKER[K.get(c, c)]


def word(cv, s, mid, y, col):
    """Sign lettering: the logo's letters at 1x in col, a 1px ink outline and a 1px dred shadow
    (fonts.sign), 8 rows from the outline's top on row y to the shadow, centred on column mid
    without the shadow."""
    px, _ = fonts.sign(s, 1, col)
    x = round(mid - fonts.sign_width(s) / 2)
    for (px_x, px_y), c in px.items():
        cv.fill(x + px_x, y + px_y, 1, 1, c)


def sky(cv, top="cyan", low="sky", clouds=()):
    """The sky: top, flat, down to row CALM, then low, with clouds given as (x, base row, width,
    puff): puff is the tallest lobe's radius, and a cloud's top stays below CALM."""
    cv.fill(0, 0, W, FAR_WALK, low)
    cv.fill(0, 0, W, CALM, top)
    for i in range(0, W, 5):
        cv.fill(i, CALM + (i // 5) % 2, 5, 1, top)
    for k, (x, y, w, puff) in enumerate(clouds):
        cloud(cv, x, y, w, puff, k)


def cloud(cv, x, y, w, puff, seed):
    """A cumulus on a flat base at row y: a low body the full width with rounded ends, one big
    dome of radius puff off centre and smaller ones beside it; lgrey on the base row and on each
    dome's lower right."""
    rnd = random.Random(f"cloud-{seed}")
    big = x + w * rnd.uniform(0.35, 0.6)
    domes = [(big, puff), (x + w * rnd.uniform(0.12, 0.25), max(2, puff * 0.55)),
             (x + w * rnd.uniform(0.7, 0.85), max(2, puff * rnd.uniform(0.6, 0.75)))]
    body = max(2, round(puff * 0.4))
    for py in range(y - puff - 1, y + 1):
        for px in range(x, x + w):
            dx_end = min(px + 0.5 - x, x + w - px - 0.5)
            in_body = py > y - body and dx_end >= (y - py) * 0.8
            dome = next(((px + 0.5 - cx, py + 0.5 - (y - body + 1), r) for cx, r in domes
                         if (px + 0.5 - cx) ** 2 + (py + 0.5 - (y - body + 1)) ** 2 <= r * r), None)
            if not in_body and dome is None:
                continue
            shade = py == y or (dome is not None and dome[0] + dome[1] > dome[2] * 0.6 and py > y - body - 2)
            cv.fill(px, py, 1, 1, "lgrey" if shade else "white")


def sunset(cv, cols, bottom):
    """A banded sky down to row bottom whose top band also fills the calm rows above CALM."""
    cv.fill(0, 0, W, CALM, cols[0])
    return bands(cv, CALM, bottom, cols)


def hills(cv, top, bottom, col, edge, seed, amp=8):
    """Far rolling hills: a silhouette of col from about row top (up to amp rows lower) down
    to row bottom, edge on its top row. Returns the top row of each column."""
    tops = []
    for x in range(W):
        t = 0.5 + 0.5 * math.sin(x * 0.017 + seed) * math.cos(x * 0.006 + seed * 1.7)
        y = top + round(amp * t)
        cv.fill(x, y, 1, bottom - y, col)
        cv.fill(x, y, 1, 1, edge)
        tops.append(y)
    return tops


def block(cv, x, w, top, base, wall, line="plum", win="cyan"):
    """A far building facing the camera, rows top to base, drawn as a toy box: a flat wall in a
    1px line with a shaded right side and rows of small windows."""
    cv.fill(x, top, w, base - top, wall)
    cv.fill(x + w - 3, top, 3, base - top, dk(wall))
    outline_box(cv, x, top, w, base - top + 1, line)
    for wy in range(top + 4, base - 6, 9):
        for wx in range(x + 4, x + w - 8, 8):
            cv.fill(wx, wy, 4, 5, line)
            cv.fill(wx + 1, wy + 1, 2, 3, win)


def roofline(cv, base, roofs, col, lit=None, step=2):
    """Far houses as one silhouette of col standing on row base: (x, w, wall rows) each under a
    gable that narrows step columns a side per row (2, a quarter as tall as the house is wide; 1, a
    steep one half as tall), with a lit window of lit in the wall when lit is given."""
    for x, w, wall_h in roofs:
        cv.fill(x, base - wall_h, w, wall_h, col)
        for k in range(w // (2 * step) + 1):
            cv.fill(x - 1 + step * k, base - wall_h - 1 - k, w + 2 - 2 * step * k, 1, col)
        if lit:
            cv.fill(x + w // 2 - 1, base - wall_h + 2, 2, 2, lit)


def birds(cv, spots, col="plum"):
    """Gulls far off: a 5px wing pair each, at (x, y)."""
    for x, y in spots:
        for dx, dy in ((0, 1), (1, 0), (2, 1), (3, 0), (4, 1)):
            cv.fill(x + dx, y + dy, 1, 1, col)


def band_rows(top, bottom, n, ratio=0.7):
    """The rows of n sky bands from top down to bottom, each ratio times the height of the one
    above it, as (first row, row after the last)."""
    weights = [ratio ** i for i in range(n)]
    edges, acc = [top], 0.0
    for wt in weights:
        acc += wt
        edges.append(top + round((bottom - top) * acc / sum(weights)))
    return list(zip(edges, edges[1:]))


def bands(cv, top, bottom, cols, x0=0, w=W, ratio=0.7):
    """A banded sunset sky: hard-edged stripes of cols from row top down to the horizon at
    bottom, shrinking toward it. Above each seam the lower band's colour runs a 1-row line 2 rows
    up, and on a band 12 rows or taller a second one 5 rows up, so the bands interleave."""
    rows = band_rows(top, bottom, len(cols), ratio)
    for (y0, y1), c in zip(rows, cols):
        cv.fill(x0, y0, w, y1 - y0, c)
    for ((a0, a1), (b0, _)), c in zip(zip(rows, rows[1:]), cols[1:]):
        for up in (2, 5) if a1 - a0 >= 12 else (2,):
            if b0 - up > a0:
                cv.fill(x0, b0 - up, w, 1, c)
    return rows


def sun(cv, cx, cy, r, col, low=None):
    """A striped sun: a disc of col centred on cx, cy, its visible part ending on row low (the
    disc's bottom by default). Horizontal gaps cut the lower half of the visible part, the bars
    between them thinning and the gaps widening toward low, and show the sky behind."""
    low = cy + r if low is None else low
    mid = (cy - r + low) / 2
    gaps, y, k = set(), mid, 0
    bar = max(2, round((low - mid) / 4))
    while y <= low:
        y += max(1, bar - k)
        gap = 1 + k // 2
        gaps.update(range(round(y), round(y) + gap))
        y += gap
        k += 1
    for dy in range(-r, r + 1):
        if cy + dy in gaps:
            continue
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * (r + 1):
                cv.fill(cx + dx, cy + dy, 1, 1, col)


def ground(cv, lawn="green"):
    cv.fill(0, 104, W, 26, lawn)
    for i in range(70):
        cv.fill((i * 37) % W, 106 + (i * 11) % 22, 1, 2, dk(lawn))
    cv.fill(0, 130, W, 15, "lgrey")
    for x in range(0, W, 24):
        cv.fill(x, 130, 1, 15, "grey")
    cv.fill(0, 145, W, 3, "grey")
    cv.fill(0, 148, W, 2, "slate")


# A house's windows and door: the window frame's offset below the eaves, its width and height,
# and the door's height. SMALL is the backdrops' house, under a 16-row roof.
HOUSE = (6, 12, 10, 18)
SMALL = (4, 10, 8, 13)
# SLIM is the backdrops' slim house, under a steep 22-row roof: tall windows either side of the door.
SLIM = (4, 8, 10, 13)
# The lit left edge of a roof, a ramp step lighter than the roof.
LIT = dict(slate="grey", dslate="slate", navy="dslate", purple="mauve", dred="red", brown="tan")


def house(cv, x, w, wall, roof, door="dred", top=40, base=104, roof_h=26, parts=HOUSE, curtains=None,
          eave=3, rake=None, dormer=False):
    """A house facing the camera, standing on row base: a gable roof roof_h rows tall from top, its
    eaves eave pixels past the walls. curtains, a colour, draws the windows' curtains closed,
    lamplight in the gap between them. rake, a colour, lights the roof's left edge, which faces the
    top-left light. dormer puts a dormer window in the roof's middle."""
    wall_y = top + roof_h
    off, ww, wh, door_h = parts
    cv.fill(x, wall_y, w, base - wall_y, wall)
    cv.fill(x + w - 3, wall_y, 3, base - wall_y, dk(wall))
    half = w / 2 + eave
    for i in range(roof_h):
        inset = round(i * half / roof_h)
        left = x - eave + (w // 2 + eave) - inset
        cv.fill(left, top + i, inset * 2, 1, roof)
        if rake and inset:
            cv.fill(left, top + i, 1, 1, rake)
    cv.fill(x - eave, wall_y - 1, w + 2 * eave, 2, dk(roof))
    cv.fill(x + w - 14, top + round(roof_h * 0.15), 6, round(roof_h * 0.46), "brown")
    cv.fill(x + w - 15, top + round(roof_h * 0.08), 8, 2, "dbrown")
    if dormer:
        dormer_window(cv, x + w // 2, top + round(roof_h * 0.42), wall_y - 2, wall, roof, curtains)
    for wx in (x + ww // 2, x + w - ww - ww // 2):
        window(cv, wx, wall_y + off, ww, wh, curtains)
    dx = x + w // 2 - 5
    cv.fill(dx, base - door_h, 10, door_h, door)
    cv.fill(dx + 7, base - door_h // 2, 1, 2, "amber")
    cv.fill(dx - 2, base - 2, 14, 2, "lgrey")


def far_house(cv, cx, w, base, wall_h, wall, roof, lit=None):
    """A house further off, centred on column cx and standing on row base: a wall wall_h rows tall,
    shaded on its right, under a gable that rises a row for each column it narrows, and two small
    windows, lit when lit is given, with no door or chimney at that distance."""
    x = cx - w // 2
    top = base - wall_h
    cv.fill(x, top, w, wall_h, wall)
    cv.fill(x + w - 2, top, 2, wall_h, dk(wall))
    for k in range(w // 2 + 2):
        cv.fill(x - 1 + k, top - 1 - k, w + 2 - 2 * k, 1, roof)
    cv.fill(x - 1, top, w + 2, 1, dk(roof))
    for wx in (x + 3, x + w - 7):
        cv.fill(wx, top + 3, 4, 4, "plum")
        cv.fill(wx + 1, top + 4, 2, 2, lit or "cyan")


def window(cv, wx, wy, ww, wh, curtains=None):
    """A window in a plum frame on a white sill: cyan glass with white glazing bars, or curtains
    drawn closed with lamplight between them."""
    cv.fill(wx, wy, ww, wh, "plum")
    if curtains:
        cv.fill(wx + 1, wy + 1, ww - 2, wh - 2, curtains)
        cv.fill(wx + 1, wy + 1, ww - 2, 1, dk(curtains))
        cv.fill(wx + ww // 2 - 1, wy + 2, 2, wh - 3, "yellow")
        cv.fill(wx + 2, wy + 2, 1, wh - 3, dk(curtains))
        cv.fill(wx + ww - 3, wy + 2, 1, wh - 3, dk(curtains))
    else:
        cv.fill(wx + 1, wy + 1, ww - 2, wh - 2, "cyan")
        cv.fill(wx + ww // 2, wy + 1, 1, wh - 2, "white")
        cv.fill(wx + 1, wy + wh // 2, ww - 2, 1, "white")
    cv.fill(wx - 1, wy + wh, ww + 2, 2, "white")


def dormer_window(cv, cx, top, bottom, wall, roof, curtains=None):
    """A dormer centred on column cx, its cap from row top and its front down to row bottom: a
    small gable of roof over a wall front holding one window."""
    fx, fw = cx - 5, 10
    front_y = top + 4
    cv.fill(fx, front_y, fw, bottom - front_y, wall)
    cv.fill(fx + fw - 2, front_y, 2, bottom - front_y, dk(wall))
    for k in range(5):
        cv.fill(cx - 1 - k - (1 if k == 4 else 0), top + k, 2 + 2 * k + (2 if k == 4 else 0), 1, roof if k < 4 else dk(roof))
    window(cv, fx + 2, front_y + 1, 6, bottom - front_y - 3, curtains)


def tree(cv, cx, top, leaf="green", shade="dgreen", trunk="dbrown", r=16, base=104, girth=6):
    """A round tree on row base, its crown centred on row top."""
    cv.fill(cx - girth // 2, top + r, girth, base - top - r, trunk)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                c = shade if dx + dy > r * 0.5 else ("yellow" if leaf == "green" and dx + dy < -r * 1.1 else leaf)
                cv.fill(cx + dx, top + dy, 1, 1, c)


def fence(cv, y=104, x0=0, x1=W, col="white", h=14):
    """A picket fence whose pickets end on row y + 3, h rows tall."""
    for x in range(x0, x1, 6):
        cv.fill(x, y + 4 - h, 4, h, col)
        cv.fill(x + 3, y + 5 - h, 1, h - 1, "lgrey")
    cv.fill(x0, y + 4 - round(h * 0.7), x1 - x0, 2, "lgrey")


# A bush's three lobes, (x, y, radius); SHRUB is the backdrops' smaller one.
BUSH = ((0, 0, 6), (8, -2, 7), (16, 0, 6))
SHRUB = ((0, 0, 4), (5, -1, 5), (10, 0, 4))


def bush(cv, x, y, col="dgreen", lobes=BUSH):
    for dx, dy, r in lobes:
        for yy in range(-r, r + 1):
            for xx in range(-r, r + 1):
                if xx * xx + yy * yy <= r * r and y + dy + yy <= y + 4:
                    cv.fill(x + dx + xx, y + dy + yy, 1, 1, col if xx + yy < 3 else dk(col))


def flowers(cv, x0, x1, y, cols=("red", "yellow", "pink", "white")):
    for i, x in enumerate(range(x0, x1, 4)):
        cv.fill(x, y + (i % 2), 2, 2, cols[i % len(cols)])
        cv.fill(x, y + 2 + (i % 2), 1, 2, "dgreen")


# ---------- the street and the junction ----------
# The road below the band recedes: a point z road pixels ahead of the walker's feet draws at
# scale s = F / (F + z), on screen row YH + KS s. The band's rows from STUB down continue that
# projection exactly, so the street's edges keep the road's slope across the band's bottom
# edge. World units are road pixels at scale 1: x across from the road's centre line, z along
# the road ahead of the feet, h up from the ground.

KS = FOOT - YH
S0 = (BAR + H - 0.5 - YH) / KS  # scale on the band's bottom row
VISIBLE = F * KS / (BAR + H - YH) - F   # road in view below the band, to its bottom edge
Z0 = F / S0 - F                 # the road distance on the band's bottom row
# half the road, its curb and its sidewalk, as the game draws Elm Avenue's verge
ROAD = LAYOUT["regions"]["road"]["width"] // 2
CURB, WALK = LAYOUT["verges"]["street"]["curbTo"], LAYOUT["verges"]["street"]["walkTo"]
DIVIDERS = tuple(x - CX for x in LAYOUT["lanes"]["dividers"])   # lane divider lines, from the road's centre
# The cross street, in band rows from the far side down: the far sidewalk, the far curb, the
# road, the near curb and the near sidewalk, which the street's stub (rows STUB to the bottom)
# opens into. These rows are drawn flat rather than to the projection, which would spread the
# cross street over most of the band; across, they keep the projection's scale per row, so
# lines along the street (curbs, slab seams) still lean toward the road's centre line.
# The stub is the band's part of the approach region, where the game's road raster starts.
STUB = LAYOUT["regions"]["approach"]["y"] - BAR
FAR_WALK, FAR_CURB, CROSS, NEAR_CURB = STUB - 20, STUB - 16, STUB - 14, STUB - 5
LINE = STUB - 10               # the cross street's centre line
CORNER = 5                     # the near corners' curb radius, in pixels
BASE = STUB - 24               # the far side's ground row: the houses stand on it
# The sky above row CALM, 70 rows over the far side's ground row, is one flat colour with no
# clouds, stars or scenery: the debuff bars and the message strip lie over it.
CALM = BASE - 70
PERCH = round(Z0) + 3          # the near-left perch's z: its foot on the bottom row, for the cat
PERCH_H = 30                   # the perch's height: its top rail is h 27 to 30
PERCH_X = (-(WALK + 8), -600)  # the perch, across: from just past the sidewalk out off screen


def scale(yc):
    """Scale of the ground at row centre yc (y + 0.5)."""
    return (BAR + yc - YH) / KS


def at(x, z, h=0):
    """Screen position of the world point x across, z along, h up."""
    s = F / (F + z)
    return CX + x * s, YH + KS * s - BAR - h * s, s


def poly(cv, pts, c):
    from PIL import ImageDraw

    xy = [(round(at(*p)[0] - 0.5), round(at(*p)[1] - 0.5)) for p in pts]
    ImageDraw.Draw(cv.img).polygon(xy, fill=sn.rgb(K.get(c, c)))


def front(cv, x0, x1, z, h0, h1, c):
    """A patch on a wall that faces the camera."""
    poly(cv, [(x0, z, h0), (x1, z, h0), (x1, z, h1), (x0, z, h1)], c)


def noise(x, y):
    """A fixed pseudo-random value in [0, 1) per pixel: a mixed integer hash, so picks fall
    irregularly and no lattice or diagonal rhythm shows."""
    h = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65536


def hashed(x, y, n):
    """About one pixel in n, picked irregularly."""
    return noise(x, y) * n < 1


def street(cv, paint):
    """Paint the street's stub, rows STUB to the bottom: paint(x, z, span, px, py) gives each
    pixel's colour, where span is the length of road the row covers."""
    for py in range(STUB, H):
        s = scale(py + 0.5)
        z = F / s - F
        span = z - (F / scale(py + 1.5) - F)
        for px in range(W):
            cv.fill(px, py, 1, 1, paint((px + 0.5 - CX) / s, z, span, px, py))


def crosses(z, span, period):
    """Whether a line every period along the road falls in this row."""
    return z // period != (z - max(span, 1)) // period


def lanes(cv, mark, edge=None, dash=(12, 32), span=6):
    """The stub's lane dividers, 1px wide; dashes stop where a row spans too much road."""
    for py in range(STUB, H):
        s = scale(py + 0.5)
        z, z1 = F / s - F, F / scale(py + 1.5) - F
        if z - z1 > span or (dash and z % dash[1] >= dash[0]):
            continue
        for d in DIVIDERS:
            x = round(CX + d * s - 0.5)
            cv.fill(x, py, 1, 1, mark)
            if edge:
                cv.fill(x + 1, py, 1, 1, edge)


def kerb(px, py):
    """How far pixel px, py lies inside a near corner, in pixels, or below 0 on the road. The
    corners are the blocks either side of the stub, below the cross street, rounded where the
    stub's curb turns into the near curb."""
    dx = abs(px + 0.5 - CX) - ROAD * scale(py + 0.5)
    dy = py + 0.5 - NEAR_CURB
    if dx < CORNER and dy < CORNER:
        return CORNER - math.hypot(CORNER - dx, CORNER - dy)
    return min(dx, dy)


# Sidewalk slab seams across the cross street's sidewalks, at irregular world x.
SLABS = (34, 30, 38, 32, 36, 29, 40, 31, 35, 33, 37)
SEAMS = [sum(SLABS[i % len(SLABS)] for i in range(k)) - 600 for k in range(40)]


def seam(px, py):
    """Whether a slab seam crosses pixel px on sidewalk row py."""
    s = scale(py + 0.5)
    x0, x1 = (px - CX) / s, (px + 1 - CX) / s
    return any(x0 <= x < x1 for x in SEAMS)


def slabs(px, py):
    return "grey" if seam(px, py) else "lgrey"


def grass(lawn="green", rate=0.03):
    """A flat lawn: 2-row tufts of the darker green, placed irregularly."""
    def paint(px, py):
        return dk(lawn) if noise(px, py) < rate or noise(px, py - 1) < rate else lawn
    return paint


def no_bend(px):
    return 0


def cross(cv, road, edge, walk, curb="grey", top=FAR_WALK, bend=no_bend):
    """Paint the cross street from row top down to the stub: walk(px, py) paints the sidewalks
    (and the far side's ground above them), road(px, py) the road and edge the road's pixels
    beside a curb. curb None leaves the road without curbs, as the park's paths are. bend(px)
    raises the far side by that many rows at column px, for a street that curves away."""
    lift = max(bend(px) for px in range(W))
    for py in range(top - lift, STUB):
        for px in range(W):
            b = bend(px)
            if py < top - b:
                continue
            if py < FAR_CURB - b:
                c = walk(px, py)
            elif py < CROSS - b:
                c = curb or walk(px, py)
            else:
                d = kerb(px, py)
                if d >= (2 if curb else 0):
                    c = walk(px, py)
                elif d >= 0:
                    c = curb
                elif d >= -1 or py == CROSS - b:
                    c = edge
                else:
                    c = road(px, py)
            cv.fill(px, py, 1, 1, c)


def cross_line(cv, mark, edge=None, dash=(12, 32), bend=no_bend):
    """The cross street's centre line on row LINE, dashed at world x like the stub's dividers,
    with edge on the row below it; raised by half the far side's bend."""
    s = scale(LINE + 0.5)
    for px in range(W):
        if dash and ((px + 0.5 - CX) / s) % dash[1] >= dash[0]:
            continue
        y = LINE - bend(px) // 2
        cv.fill(px, y, 1, 1, mark)
        if edge:
            cv.fill(px, y + 1, 1, 1, edge)


def ffence(cv, x0, x1, z, col="white", h=PERCH_H, gap=12):
    """A picket fence facing the camera, across x0..x1 at z: its top rail is a perch."""
    lo, hi = min(x0, x1), max(x0, x1)
    x = lo
    while x < hi:
        front(cv, x, x + gap * 0.6, z, 0, h, col)
        front(cv, x + gap * 0.45, x + gap * 0.6, z, 0, h - 2, "lgrey")
        x += gap
    front(cv, lo, hi, z, h * 0.5, h * 0.62, "lgrey")
    front(cv, lo, hi, z, h - 3, h, col)


def treeline(cv, row, cols, seed, lo=2, hi=7):
    """Far treetops or rooftops along row, rising lo to hi rows."""
    for x in range(W):
        t = (x * 0.21 + seed) % 6.283
        hgt = lo + round((hi - lo) * (0.5 + 0.5 * math.sin(t) * math.cos(t * 2.3 + seed)))
        cv.fill(x, row - hgt + 1, 1, hgt, cols[0])
        cv.fill(x, row - hgt + 1, 1, 1, cols[1])


def yard(cv, y0, y1, paint):
    """Paint the far side's ground, rows y0 to y1."""
    for py in range(y0, y1):
        for px in range(W):
            cv.fill(px, py, 1, 1, paint(px, py))


def path(cv, x, y0, y1, col="lgrey", edge="grey"):
    """A front path from a door on row y0 down to the sidewalk on row y1, widening as it nears."""
    for py in range(y0, y1):
        grow = (py - y0) // 3
        cv.fill(x - grow, py, 12 + 2 * grow, 1, col)
        cv.fill(x - grow, py, 1, 1, edge)


def mailbox(cv, x, y, col="red"):
    """A mailbox whose post stands on row y."""
    cv.fill(x, y - 9, 2, 9, "dbrown")
    cv.fill(x - 3, y - 14, 8, 5, col)
    cv.fill(x - 3, y - 10, 8, 1, dk(col))
    cv.fill(x + 5, y - 16, 2, 3, "amber")


# Lawn texture follows the road strips' rule: mown stripes run along the street and converge
# toward its centre line (stripes across it band and shimmer as rows span more lawn), their
# widths vary, and each ends where it would draw under 4px wide. Tufts are 2-row marks, placed
# irregularly and thinning out with distance.
MOWN = (44, 62, 36, 70, 50, 58, 40, 66)


def mown(x, s):
    """Whether the lawn at x across falls in a darker mown stripe, at ground scale s. Only the
    front lawns, out to 300 past the sidewalk, are mown."""
    a, i = abs(x) - WALK, 0
    if a >= 300:
        return False
    while a >= MOWN[i % len(MOWN)]:
        a -= MOWN[i % len(MOWN)]
        i += 1
    return i % 2 == 1 and MOWN[i % len(MOWN)] * s >= 4


def tuft(px, py, s, rate=0.03):
    """A 2-row grass mark here: about rate of pixels on the band's bottom row, fewer further off."""
    p = rate * (s / S0) ** 2
    return noise(px, py) < p or noise(px, py - 1) < p


def turf(x, z, px, py, lawn="green", stripes=True, patches=()):
    """A lawn pixel: mown stripes or rough patches (world (x, z, rx, rz) ellipses), then tufts."""
    s = F / (F + z)
    c = lawn
    if stripes and mown(x, s):
        c = dk(lawn)
    elif any(((x - qx) / rx) ** 2 + ((z - qz) / rz) ** 2 <= 1 for qx, qz, rx, rz in patches):
        c = dk(lawn)
    return dk(c) if tuft(px, py, s) else c


def rough(seed, n, x0, x1, z0, z1):
    """n rough patches either side of the street, dropping any that would draw under 6 rows tall."""
    rnd = random.Random(seed)
    out = []
    while len(out) < n:
        x, z = rnd.choice((-1, 1)) * rnd.uniform(x0, x1), rnd.uniform(z0, z1)
        rx, rz = rnd.uniform(30, 90), rnd.uniform(16, 40)
        if at(x, max(z - rz, Z0))[1] - at(x, z + rz)[1] >= 6:
            out.append((x, z, rx, rz))
    return out


def verge(road, lawn="green", walk="lgrey", seam="grey", curb="grey", stripes=True):
    """The game's verge beside the road: a curb, a sidewalk with a seam every 32 rows of
    road, then a lawn (see turf). road(x, z, span, px, py) paints the road."""
    def paint(x, z, span, px, py):
        a = abs(x)
        if a < ROAD:
            return road(x, z, span, px, py)
        if a < CURB:
            return curb
        if a < WALK:
            return seam if span < 16 and crosses(z, span, 32) else walk
        return turf(x, z, px, py, lawn, stripes)
    return paint


def flat(road):
    """A stub road painter as the cross street's: its middle, with no lines across."""
    return lambda px, py: road(0, 0, 99, px, py)


def woof_way():
    cv = sn.Canvas(W, H)
    # fair-weather puffs of mixed sizes, spread unevenly above the hill
    sky(cv, clouds=((8, BASE - 57, 40, 7), (110, BASE - 60, 18, 3), (232, BASE - 56, 30, 5),
                    (318, BASE - 48, 18, 3)))
    # the neighbourhood climbs a hill behind the street: a water tower on its crest, a second
    # row of houses up the slope, showing between and above the near ones
    crest = hills(cv, BASE - 52, BASE, "dgreen", "green", 1.7, 10)
    tx = CX + 118
    for lx in (tx - 6, tx + 5):
        cv.fill(lx, BASE - 50, 2, 16, "slate")
    cv.fill(tx - 6, BASE - 43, 13, 1, "slate")
    cv.fill(tx - 9, BASE - 62, 20, 12, "lgrey")
    cv.fill(tx + 7, BASE - 62, 4, 12, "grey")
    cv.fill(tx - 9, BASE - 51, 20, 1, "grey")
    for k in range(4):
        cv.fill(tx - 7 + 2 * k, BASE - 63 - k, 16 - 4 * k, 1, "slate")
    # the second row up the slope, showing between the near roofs and behind the trees
    for cx, w, wall_c, roof in ((22, 20, "lgrey", "slate"), (90, 18, "skin1", "dred"),
                                (208, 20, "cream", "dslate"), (332, 18, "white", "purple")):
        far_house(cv, cx, w, min(BASE - 26, crest[cx] + 16), 12, wall_c, roof)

    def road(x, z, span, px, py):
        if abs(x) >= ROAD - 3:
            return "grey"
        return "slate" if hashed(px, py, 29) else "navy" if hashed(px, py + 3, 31) else "dslate"

    # the houses across the street, one at the end of the street and the outer two cut by the
    # band's edges: slim, under steep roofs, trees and hedges in the gaps between them
    homes = ((0, 44, 22, "lgrey", "slate", "dred", False), (60, 46, 24, "tan", "brown", "dgreen", True),
             (120, 44, 22, "pink", "purple", "white", False), (180, 48, 24, "sky", "navy", "red", True),
             (240, 44, 22, "cream", "dred", "sky", False), (300, 46, 24, "skin1", "dslate", "forest", True),
             (360, 44, 22, "white", "brown", "blue", False))
    for cx, r in ((30, 11), (150, 12), (270, 10)):
        tree(cv, cx, BASE - 19 - 2 * r, r=r, base=BASE, girth=4)
    for cx, w, wall_h, wall_c, roof, door, dormer in homes:
        house(cv, cx - w // 2, w, wall_c, roof, door, top=BASE - 46, base=BASE, roof_h=46 - wall_h,
              parts=SLIM, eave=2, rake=LIT.get(roof), dormer=dormer)
    yard(cv, BASE, FAR_WALK, grass())
    for cx, w, *_ in homes:
        x = cx - w // 2
        path(cv, cx - 6, BASE, FAR_WALK)
        fence(cv, FAR_WALK - 4, max(0, x - 6), cx - 10, h=9)
        fence(cv, FAR_WALK - 4, cx + 10, x + w + 6, h=9)
    for cx in (90, 210, 330):
        bush(cv, cx - 5, BASE - 3, "dgreen", SHRUB)
    flowers(cv, CX - 24, CX - 10, FAR_WALK - 4)
    flowers(cv, CX + 12, CX + 26, FAR_WALK - 3)
    for x in (CX - 134, CX - 46, CX + 128):
        mailbox(cv, x, FAR_WALK)
    cross(cv, flat(road), "grey", slabs)
    cross_line(cv, "lgrey")
    street(cv, verge(road))
    lanes(cv, "lgrey")
    ffence(cv, *PERCH_X, PERCH)
    ornament(cv, "birdbath")
    return cv


def bark_park():
    cv = sn.Canvas(W, H)
    # two big billowing clouds clear of the gate, a small one and a kite
    sky(cv, clouds=((2, BASE - 50, 52, 9), (CX - 66, BASE - 62, 16, 3), (CX + 82, BASE - 52, 56, 10)))
    kx, ky = CX + 34, BASE - 62
    for dy in range(-4, 5):
        cv.fill(kx - (4 - abs(dy)) // 2, ky + dy, (4 - abs(dy)) // 2 * 2 + 1, 1, "red" if dy < 0 else "yellow")
    for k in range(6):
        cv.fill(kx + (k % 2), ky + 5 + k, 1, 1, "plum")
    # the park runs back to wooded hills: a far tree line, an open meadow with a bandstand, then
    # the near tree line behind the pond
    hills(cv, BASE - 46, BASE - 18, "dgreen", "green", 0.4, 6)
    treeline(cv, BASE - 32, ("forest", "dgreen"), 0.9, 2, 5)
    # an unmown park: flat rough patches on the far lawn, tufts thinning toward the trees
    patches = [(60, BASE - 26, 30, 2), (CX + 40, BASE - 24, 24, 2), (CX - 50, BASE - 12, 26, 3),
               (CX - 24, BASE - 10, 20, 2), (CX + 100, BASE - 5, 30, 3), (CX + 128, BASE - 2, 18, 3),
               (40, BASE + 6, 24, 2)]

    def lawn(px, py):
        c = "green"
        if any(((px - qx) / rx) ** 2 + ((py - qy) / ry) ** 2 <= 1 for qx, qy, rx, ry in patches):
            c = "dgreen"
        return grass(c, 0.03 * (max(0, py - (BASE - 40)) / (H - BASE + 40)) ** 2)(px, py)

    yard(cv, BASE - 31, CROSS, lawn)
    # the bandstand out on the meadow
    bx, by = CX + 76, BASE - 22
    cv.fill(bx - 9, by - 2, 19, 2, "lgrey")
    for x in (bx - 8, bx - 1, bx + 6):
        cv.fill(x, by - 9, 2, 7, "white")
    for k in range(5):
        cv.fill(bx - 10 + 2 * k, by - 10 - k, 21 - 4 * k, 1, "red" if k < 4 else "dred")
    treeline(cv, BASE - 18, ("dgreen", "green"), 2.5, 3, 8)
    # the pond, on the left
    for py in range(BASE - 12, BASE):
        for px in range(6, 92):
            e = ((px + 0.5 - 48) / 40) ** 2 + ((py + 0.5 - (BASE - 6)) / 5) ** 2
            if e <= 1:
                cv.fill(px, py, 1, 1, "white" if hashed(px, py, 17) else "sky" if e > 0.5 else "cyan")
    for cx, top, r in ((8, BASE - 26, 8), (96, BASE - 28, 9), (CX + 98, BASE - 26, 8), (352, BASE - 24, 7)):
        tree(cv, cx, top, r=r, base=BASE - 14, girth=4)
    for cx, top, r in ((CX - 78, BASE - 26, 12), (CX + 148, BASE - 28, 13), (-2, BASE - 22, 14)):
        tree(cv, cx, top, r=r, base=BASE + 4)
    # the park gate at the end of the path, its sign facing the street
    for x in (CX - 48, CX + 46):
        cv.fill(x, BASE - 32, 3, 38, "dbrown")
    cv.fill(CX - 62, BASE - 42, 124, 16, "dgreen")
    cv.fill(CX - 62, BASE - 42, 124, 1, "green")
    cv.fill(CX - 62, BASE - 27, 124, 1, "forest")
    word(cv, "FAIRVIEW PARK", CX, BASE - 38, "yellow")
    for x in (CX - 68, CX + 68):
        cv.fill(x, BASE - 18, 2, 24, "slate")
        cv.fill(x - 4, BASE - 24, 10, 7, "navy")
        cv.fill(x - 2, BASE - 22, 6, 4, "yellow")
    # a bench facing the street
    cv.fill(CX + 106, BASE - 3, 24, 2, "brown")
    cv.fill(CX + 106, BASE, 24, 2, "brown")
    cv.fill(CX + 108, BASE + 2, 2, 3, "dbrown")
    cv.fill(CX + 126, BASE + 2, 2, 3, "dbrown")

    def trail(x, z, span, px, py):
        a = abs(x)
        if a >= ROAD - 2:
            return "brown"
        return "brown" if hashed(px, py, 13) else "cream" if hashed(px, py + 5, 23) else "tan"

    # the path on into the park, through the gate
    for py in range(BASE - 8, CROSS):
        half = 18 + (py - BASE + 8) // 3
        cv.fill(CX - half, py, 2 * half, 1, "brown")
        for px in range(CX - half + 1, CX + half - 1):
            cv.fill(px, py, 1, 1, trail(0, 0, 99, px, py))
    cross(cv, flat(trail), "brown", lawn, curb=None, top=CROSS)
    cross_line(cv, "dbrown", dash=(7, 16))
    rough_patches = rough("bark-park-lawn", 10, ROAD + 30, ROAD + 460, Z0 + 10, Z0 + 90)

    def paint(x, z, span, px, py):
        if abs(x) < ROAD:
            return trail(x, z, span, px, py)
        return turf(x, z, px, py, stripes=False, patches=rough_patches)

    street(cv, paint)
    lanes(cv, "dbrown", dash=(7, 16))
    rail(cv, *PERCH_X, PERCH)
    ornament(cv, "bed")
    return cv


def rail(cv, x0, x1, z):
    """A wooden park rail facing the camera: posts and a flat top rail to perch on."""
    lo, hi = min(x0, x1), max(x0, x1)
    for x in range(int(lo), int(hi), 48):
        front(cv, x, x + 8, z, 0, PERCH_H - 2, "dbrown")
    front(cv, lo, hi, z, PERCH_H - 6, PERCH_H, "brown")
    front(cv, lo, hi, z, 12, 18, "brown")


# Main Street's flowers, in its planters and on its card
SHOP_FLOWERS = ("red", "yellow", "white", "amber")
# the planter along each curb, across: its brown sides on PLANTER[0]..+2 and PLANTER[1]-2..
PLANTER = (CURB, CURB + 16)


def sunburst(cv, cx, cy, n, a, b, y1, w=W, r=None):
    """Flat rays of a and b from cx, cy over rows 0 to y1: n of each round the half turn. With r,
    (rx, ry), the rays end on that ellipse round cx, cy and b fills the rest."""
    for py in range(y1):
        for px in range(w):
            if r is not None and ((px + 0.5 - cx) / r[0]) ** 2 + ((py + 0.5 - cy) / r[1]) ** 2 > 1:
                cv.fill(px, py, 1, 1, b)
                continue
            ang = math.atan2(px + 0.5 - cx, cy - py - 0.5)
            cv.fill(px, py, 1, 1, a if math.floor(ang / (math.pi / (2 * n)) + 0.5) % 2 else b)


def bunting(cv, x0, x1, y, sag, cols, line="plum"):
    """A string of pennants hung from x0 to x1 on row y, sagging sag rows in the middle."""
    k = 0
    for x in range(x0, x1):
        t = (x - x0) / max(1, x1 - x0 - 1)
        yy = round(y + sag * 4 * t * (1 - t))
        cv.fill(x, yy, 1, 1, line)
        if (x - x0) % 7 == 1 and x + 5 <= x1:
            for r in range(4):
                cv.fill(x + r // 2, yy + 1 + r, 5 - r // 2 * 2, 1, cols[k % len(cols)])
            k += 1


def outline_box(cv, x, y, w, h, col):
    cv.fill(x, y, w, 1, col)
    cv.fill(x, y + h - 1, w, 1, col)
    cv.fill(x, y, 1, h, col)
    cv.fill(x + w - 1, y, 1, h, col)


def shops_verge(x, z, span, px, py):
    """Main Street's verge: a white curb, a flower planter along it (brown sides round
    green and dgreen leaves, about one pixel in ten a flower), a tan edge, then cream paving
    with a tan seam every 32 rows of road and sparse tan specks."""
    a = abs(x)
    if a < CURB:
        return "white"
    if a < PLANTER[1]:
        if a < PLANTER[0] + 2 or a >= PLANTER[1] - 2:
            return "brown"
        n = noise(px, py)
        if n < 0.10:
            return SHOP_FLOWERS[int(n * 40) % 4]
        return "dgreen" if noise(px + 3, py) < 0.35 else "green"
    if a < PLANTER[1] + 2:
        return "tan"
    if span < 16 and crosses(z, span, 32):
        return "tan"
    return "tan" if noise(px, py) < 0.02 else "cream"


def shops():
    cv = sn.Canvas(W, H)
    # a sunburst of sky and cyan rays from the end of the street, a cloud either side
    # the rays end on an arc below the calm rows, where flat cyan carries on
    sunburst(cv, CX, BASE + 6, 7, "sky", "cyan", FAR_WALK, r=(W * 0.65, BASE + 6 - CALM))
    for x, y, w, p in ((10, BASE - 54, 30, 4), (300, BASE - 50, 38, 5)):
        cloud(cv, x, y, w, p, f"shops-{x}")
    # the town behind the shops: apartment blocks and the clock tower over the toy shop
    for x, w, top, wall_c in ((16, 54, BASE - 54, "tan"), (84, 44, BASE - 62, "lgrey"),
                              (226, 50, BASE - 58, "skin1"), (292, 60, BASE - 50, "lgrey")):
        block(cv, x, w, top, BASE, wall_c)
    block(cv, CX - 15, 30, BASE - 66, BASE, "cream")
    for dy in range(-6, 7):
        for dx in range(-6, 7):
            if dx * dx + dy * dy <= 36:
                cv.fill(CX + dx, BASE - 56 + dy, 1, 1, "plum" if dx * dx + dy * dy > 25 else "white")
    cv.fill(CX, BASE - 61, 1, 6, "plum")
    cv.fill(CX, BASE - 56, 4, 1, "plum")
    # colour-blocked shopfronts across the street, the toy shop at the end of it
    for x, w, top, wall_c, awn, sign, board, letters in (
            (-4, 64, BASE - 40, "cream", "pink", "BAKERY", "dred", "yellow"),
            (CX - 116, 66, BASE - 46, "sky", "amber", "PETS", "navy", "yellow"),
            (CX - 50, 100, BASE - 56, "yellow", "red", "TOYS", "blue", "white"),
            (CX + 50, 70, BASE - 48, "green", "pink", "SCOOPS", "forest", "white"),
            (CX + 120, 66, BASE - 42, "purple", "cyan", "RECORDS", "plum", "cyan")):
        shopfront(cv, x, w, top, BASE, wall_c, awn, sign, board, letters)
    # bunting from roof to roof either side of the toy shop, above the sign boards
    bunting(cv, 0, CX - 50, BASE - 47, 5, ("red", "yellow", "sky", "green", "pink"))
    bunting(cv, CX + 50, W, BASE - 47, 5, ("pink", "sky", "yellow", "red", "green"))

    def paving(px, py):
        return "tan" if seam(px, py) or hashed(px, py, 41) else "cream"

    yard(cv, BASE, FAR_WALK, paving)
    for x in (CX - 140, CX - 64, CX + 40, CX + 112):
        planter(cv, x, FAR_WALK)
        flowers(cv, x + 2, x + 11, FAR_WALK - 8, SHOP_FLOWERS)

    # the pink pavers of road-sniff-street-shops: cream gutter stones on its outer 4 columns
    # inside a mauve seam, a mauve joint every 16 rows and a few skin1 flecks
    def paint(x, z, span, px, py):
        a = abs(x)
        if a >= ROAD:
            return shops_verge(x, z, span, px, py)
        if a >= ROAD - 4:
            return "cream"
        if a >= ROAD - 5:
            return "mauve"
        if span < 6 and crosses(z, span, 16):
            return "mauve"
        return "skin1" if hashed(px, py, 23) else "pink"

    cross(cv, flat(paint), "mauve", paving, curb="white")
    cross_line(cv, "white", "mauve")
    street(cv, paint)
    lanes(cv, "white", "mauve")
    planter_wall(cv, *PERCH_X, PERCH)
    ornament(cv, "pot")
    return cv


def shopfront(cv, x, w, top, base, wall_c, awn, sign, board, letters, line="plum"):
    """A shopfront facing the camera, rows top to base, drawn as a toy box: flat colour blocks
    inside a 1px line, a shaded top and right side, upstairs windows where there is room, a sign
    board in the sign letters, a striped awning, the shop window and the door."""
    cv.fill(x, top, w, base - top, wall_c)
    cv.fill(x + w - 3, top, 3, base - top, dk(wall_c))
    cv.fill(x, top, w, 3, dk(wall_c))
    outline_box(cv, x, top, w, base - top + 1, line)
    if top <= base - 48:
        for wx in (x + 9, x + w - 21):
            cv.fill(wx, base - 44, 12, 10, line)
            cv.fill(wx + 1, base - 43, 10, 8, "cyan")
            cv.fill(wx + 2, base - 42, 3, 1, "white")
    cv.fill(x + 5, base - 32, w - 10, 13, line)
    cv.fill(x + 6, base - 31, w - 12, 11, board)
    word(cv, sign, x + w / 2, base - 29, letters)
    for i in range(0, w - 4, 8):
        cv.fill(x + 2 + i, base - 18, 4, 5, awn)
        cv.fill(x + 6 + i, base - 18, 4, 5, "white")
    cv.fill(x + 1, base - 18, w - 2, 1, line)
    cv.fill(x + 2, base - 13, w - 4, 1, dk(awn))
    for i in range(2, w - 4, 4):
        cv.fill(x + i, base - 12, 2, 1, awn)
    cv.fill(x + 6, base - 11, w - 34, 11, line)
    cv.fill(x + 7, base - 10, w - 36, 9, "cyan")
    cv.fill(x + 9, base - 8, 6, 1, "white")
    cv.fill(x + 9, base - 6, 3, 1, "white")
    cv.fill(x + w - 22, base - 12, 12, 12, line)
    cv.fill(x + w - 21, base - 11, 10, 11, "dbrown")
    cv.fill(x + w - 13, base - 6, 1, 2, "amber")


def planter(cv, x, y):
    """A planter on the far paving, its box standing on row y."""
    cv.fill(x, y - 4, 12, 4, "brown")
    cv.fill(x, y - 4, 12, 1, "dbrown")
    bush(cv, x + 1, y - 7, "green", SHRUB)


def planter_wall(cv, x0, x1, z):
    """A low brick planter facing the camera, its top a ledge to perch on."""
    lo, hi = min(x0, x1), max(x0, x1)
    front(cv, lo, hi, z, 0, PERCH_H - 2, "rust")
    front(cv, lo, hi, z, PERCH_H - 6, PERCH_H, "lgrey")
    for x in range(int(lo), int(hi), 30):
        front(cv, x, x + 2, z, 0, PERCH_H - 6, "dbrown")


# The two sunset zones' sky bands, top to horizon: The Long Way Home's warm sunset under a
# striped sun, Willow Crescent's dusk after the sun has gone, cool at the top.
LONG_WAY_SKY = ("pink", "orange", "amber", "yellow")
SNOOZE_SKY = ("purple", "mauve", "pink", "skin1")


def long_way_home():
    cv = sn.Canvas(W, H)
    # a banded sunset, warm all the way up, and the low sun at the end of the street, striped,
    # setting behind the trees beyond the back yards
    sunset(cv, LONG_WAY_SKY, BASE)
    birds(cv, ((52, BASE - 62), (64, BASE - 58), (284, BASE - 66)))
    sun(cv, CX, BASE - 21, 26, "yellow", low=BASE - 25)
    # far hills the sun is setting behind, then the trees beyond the back yards
    hills(cv, BASE - 30, BASE - 12, "dbrown", "brown", 2.2, 7)
    treeline(cv, BASE - 12, ("rust", "orange"), 4.0, 2, 7)
    leaves = grass()

    def lawn(px, py):
        return "orange" if hashed(px, py, 211) else leaves(px, py)

    yard(cv, BASE - 12, FAR_WALK, lawn)

    def road(x, z, span, px, py):
        a = abs(x)
        if a >= ROAD - 6:
            return "dbrown" if a < ROAD - 5 else "brown"
        return "skin1" if hashed(px, py, 31) else "skin2"

    # the porch houses across the street either side of the sunset, orange trees beside them and
    # shrubs in their side yards
    for cx, top, r in ((8, BASE - 30, 15), (352, BASE - 28, 15), (CX - 46, BASE - 20, 9)):
        tree(cv, cx, top, "rust", "dbrown", r=r, base=BASE, girth=4 if r < 12 else 6)
    for x, w, wall_c, roof, door in ((CX - 141, 58, "white", "dred", "dgreen"),
                                     (CX + 81, 60, "skin1", "navy", "red")):
        porch_house(cv, x, w, wall_c, roof, door)
        path(cv, x + w // 2 - 6, BASE, FAR_WALK)
    for x in (24, CX + 145):
        bush(cv, x, BASE - 3, "dgreen", SHRUB)
    fence(cv, FAR_WALK - 4, 0, 26, h=9)
    fence(cv, FAR_WALK - 4, CX - 34, CX + 68, h=9)
    flowers(cv, CX - 146, CX - 120, FAR_WALK - 4, ("orange", "yellow", "red"))
    flowers(cv, CX + 118, CX + 146, FAR_WALK - 4, ("orange", "yellow", "red"))
    cross(cv, flat(road), "brown", slabs)
    cross_line(cv, "white", "plum", dash=(14, 32))
    street(cv, verge(road))
    lanes(cv, "white", "plum", dash=(14, 32))
    fallen(cv, random.Random("home-leaves"), 80)
    ffence(cv, *PERCH_X, PERCH)
    ornament(cv, "pumpkins")
    return cv


def porch_house(cv, x, w, wall_c, roof, door, top=BASE - 48):
    """A slim house with a porch along its front under its windows, a lamp lit by the door."""
    house(cv, x, w, wall_c, roof, door, top=top, base=BASE, roof_h=22, parts=SLIM[:2] + (8, 10), eave=2,
          rake=LIT.get(roof), dormer=True)
    cv.fill(x + 4, BASE - 12, w - 8, 2, "brown")
    cv.fill(x + 6, BASE - 10, 2, 9, "brown")
    cv.fill(x + w - 8, BASE - 10, 2, 9, "brown")
    cv.fill(x + w // 2 - 10, BASE - 9, 3, 3, "yellow")


# Road colours for the two newest zones: the road, its fleck, its gutter or board seams (with
# their width in pixels), and its lane marks.
SNOOZE_ROAD = dict(road="grey", fleck="slate", gutter="lgrey", mark="white")
PROMENADE_ROAD = dict(road="cream", fleck="tan", seam="tan", seam_px=2, mark="dbrown")

# A cat sitting on a far fence, side-on, its tail curled up: x body, o its lit back.
FENCE_CAT = ("x.x...", "xxx...", "xxx..x", ".xxx.x", ".xoxxx", ".xxxx.")


def fence_cat(cv, x, y, col="plum", lit="purple"):
    """A small cat sitting on a fence top, its feet on row y."""
    for j, row in enumerate(FENCE_CAT):
        for i, ch in enumerate(row):
            if ch != ".":
                cv.fill(x + i, y - len(FENCE_CAT) + j, 1, 1, lit if ch == "o" else col)


def crescent_bend(px):
    """The crescent's far side rises 5 rows at the street's end and none at the band's edges."""
    return round(5 * max(0.0, 1 - ((px + 0.5 - CX) / (W / 2)) ** 2))


def snooze_crescent():
    cv = sn.Canvas(W, H)
    road_c = SNOOZE_ROAD
    # a banded dusk sky, purple down to a last peach glow behind the roofs, a crescent moon and
    # the first stars
    rows = sunset(cv, SNOOZE_SKY, BASE)
    for dy in range(-6, 7):
        for dx in range(-6, 7):
            if dx * dx + dy * dy <= 36 and (dx + 3) ** 2 + (dy - 2) ** 2 > 25:
                cv.fill(CX + 128 + dx, CALM + 10 + dy, 1, 1, "cream")
    for x, y in ((40, 4), (96, 9), (150, 2), (212, 7), (262, 1), (344, 11), (120, 16), (18, 14),
                 (290, 18), (176, 13)):
        if CALM + y < rows[0][1] - 6:
            cv.fill(x, CALM + y, 1, 1, "white")
    # the crescent's far houses up the hill behind, dark against the glow, a few windows lit,
    # and the church spire over them
    hills(cv, BASE - 40, BASE, "dslate", "slate", 3.1, 6)
    roofline(cv, BASE - 28, ((10, 16, 8), (40, 14, 6), (136, 16, 8), (212, 16, 9), (258, 16, 7),
                             (282, 14, 9), (326, 18, 8)), "navy", "amber", step=1)
    sx = 104
    cv.fill(sx - 4, BASE - 50, 9, 26, "navy")
    for k in range(14):
        cv.fill(sx - 4 + k // 3, BASE - 51 - k, 9 - 2 * (k // 3), 1, "navy")
    cv.fill(sx - 1, BASE - 46, 3, 4, "amber")

    def road(x, z, span, px, py):
        if abs(x) >= ROAD - 3:
            return road_c["gutter"]
        return road_c["fleck"] if hashed(px, py, 23) else road_c["road"]

    # quiet houses round the crescent, rising toward its middle with the far side, curtains drawn,
    # a dark tree in each gap
    homes = ((-6, 44, "lgrey", "purple", "navy", "pink"), (56, 44, "skin1", "slate", "dgreen", "mauve"),
             (118, 46, "lgrey", "purple", "navy", "pink"), (180, 48, "cream", "navy", "dred", "tan"),
             (242, 46, "sky", "slate", "white", "pink"), (304, 44, "skin1", "purple", "dgreen", "mauve"),
             (366, 44, "cream", "slate", "dred", "tan"))
    for k in range(len(homes) - 1):
        cx = (homes[k][0] + homes[k + 1][0]) // 2
        lift = crescent_bend(cx)
        tree(cv, cx, BASE - 30 - lift, "dgreen", "forest", r=10, base=BASE - lift, girth=4)
    for k, (cx, w, wall_c, roof, door, curtain) in enumerate(homes):
        lift = crescent_bend(cx)
        house(cv, cx - w // 2, w, wall_c, roof, door, top=BASE - 44 - lift, base=BASE - lift, roof_h=20,
              parts=SLIM, curtains=curtain, eave=2, rake=LIT.get(roof), dormer=k % 3 == 1)
    lawn = grass()
    yard(cv, BASE, FAR_WALK, lawn)
    for px in range(W):
        for py in range(BASE - crescent_bend(px), BASE):
            cv.fill(px, py, 1, 1, lawn(px, py))
    for cx, w, *_ in homes:
        x, lift = cx - w // 2, crescent_bend(cx)
        path(cv, cx - 6, BASE - lift, FAR_WALK)
        fence(cv, FAR_WALK - 4 - crescent_bend(x - 3), max(0, x - 6), cx - 10, h=9)
        fence(cv, FAR_WALK - 4 - crescent_bend(x + w - 3), cx + 10, x + w + 6, h=9)
    for x, col, lit in ((CX - 76, "plum", "purple"), (CX + 26, "orange", "amber"), (CX + 160, "dslate", "slate")):
        fence_cat(cv, x, FAR_WALK - 9 - crescent_bend(x + 3), col, lit)
    bush(cv, CX - 150, FAR_WALK - 4, "dgreen", SHRUB)
    mailbox(cv, CX - 40, FAR_WALK, "blue")
    cross(cv, flat(road), road_c["gutter"], slabs, bend=crescent_bend)
    cross_line(cv, road_c["mark"], dash=(8, 32), bend=crescent_bend)
    street(cv, verge(road))
    lanes(cv, road_c["mark"], dash=(8, 32))
    ffence(cv, *PERCH_X, PERCH)
    ornament(cv, "gnome")
    return cv


def railing(cv, x0, x1, y, col="lgrey", gap=8):
    """A riverside railing facing the camera, its posts standing on row y: a top rail on rows
    y - 8 and y - 7 and a middle rail on row y - 4."""
    for x in range(x0, x1, gap):
        cv.fill(x, y - 8, 2, 8, col)
        cv.fill(x + 1, y - 7, 1, 7, dk(col))
    cv.fill(x0, y - 8, x1 - x0, 2, col)
    cv.fill(x0, y - 7, x1 - x0, 1, dk(col))
    cv.fill(x0, y - 4, x1 - x0, 1, col)


def fence_rail(cv, x0, x1, z, col="lgrey"):
    """The riverside railing at the near-left corner, facing the camera: its top rail a perch."""
    lo, hi = min(x0, x1), max(x0, x1)
    for x in range(int(lo), int(hi), 20):
        front(cv, x, x + 4, z, 0, PERCH_H, col)
    front(cv, lo, hi, z, PERCH_H - 4, PERCH_H, col)
    front(cv, lo, hi, z, PERCH_H - 4, PERCH_H - 2, dk(col))
    front(cv, lo, hi, z, 12, 15, col)


def paws_promenade():
    cv = sn.Canvas(W, H)
    road_c = PROMENADE_ROAD
    sky(cv, clouds=((14, BASE - 52, 36, 6), (CX - 20, BASE - 58, 24, 4), (CX + 96, BASE - 50, 48, 7)))
    # the far bank: hills, a village and trees along a grassy bank, a stone edge and the river
    hills(cv, BASE - 46, BASE - 30, "dgreen", "green", 5.0, 6)
    # the village: slim houses in clusters, each gable rising a row for each column it narrows
    for x, w, wall_h, wall_c, roof in ((32, 12, 10, "cream", "dred"), (46, 10, 8, "skin1", "slate"),
                                       (58, 12, 11, "lgrey", "red"), (206, 10, 9, "lgrey", "red"),
                                       (218, 12, 11, "cream", "navy"), (232, 10, 8, "tan", "dred"),
                                       (244, 12, 10, "skin1", "slate"), (298, 12, 10, "tan", "dred"),
                                       (312, 10, 8, "cream", "navy")):
        cv.fill(x, BASE - 30 - wall_h, w, wall_h, wall_c)
        cv.fill(x + w - 2, BASE - 30 - wall_h, 2, wall_h, dk(wall_c))
        for k in range(w // 2 + 2):
            cv.fill(x - 1 + k, BASE - 31 - wall_h - k, w + 2 - 2 * k, 1, roof)
        cv.fill(x + w // 2 - 2, BASE - 27 - wall_h, 2, 3, "sky")
    cv.fill(136, BASE - 52, 6, 22, "lgrey")
    cv.fill(140, BASE - 52, 2, 22, "grey")
    for k in range(6):
        cv.fill(136 + k // 2, BASE - 53 - k, 6 - 2 * (k // 2), 1, "slate")
    for cx, top, r in ((12, BASE - 38, 7), (CX - 70, BASE - 39, 8), (CX + 12, BASE - 37, 6),
                       (CX + 152, BASE - 38, 7)):
        tree(cv, cx, top, "dgreen", "forest", r=r, base=BASE - 30, girth=2)
    treeline(cv, BASE - 30, ("dgreen", "green"), 1.3, 1, 4)
    cv.fill(0, BASE - 30, W, 2, "green")
    cv.fill(0, BASE - 28, W, 2, "grey")
    water = BASE - 26, BASE - 6
    for py in range(*water):
        for px in range(W):
            c = "blue" if py < BASE - 20 else "sky"
            if hashed(px // 3, py, 9) and py % 3 == 0:
                c = "cyan" if py > BASE - 16 else "sky"
            if hashed(px, py, 61):
                c = "white"
            cv.fill(px, py, 1, 1, c)
    # a sailing dinghy out on the river, ducks and a rowboat nearer
    cv.fill(CX + 120, BASE - 22, 14, 2, "red")
    cv.fill(CX + 121, BASE - 20, 12, 1, "dred")
    for k in range(10):
        cv.fill(CX + 126, BASE - 32 + k, 1 + k // 2, 1, "white")
    cv.fill(CX + 125, BASE - 32, 1, 10, "dbrown")
    for x in (CX - 120, CX - 110):
        cv.fill(x, BASE - 12, 5, 2, "white")
        cv.fill(x + 3, BASE - 14, 2, 2, "white")
        cv.fill(x + 5, BASE - 13, 1, 1, "amber")
        cv.fill(x, BASE - 10, 5, 1, "blue")
    cv.fill(CX + 50, BASE - 16, 22, 3, "brown")
    cv.fill(CX + 52, BASE - 13, 18, 1, "dbrown")
    cv.fill(CX + 59, BASE - 18, 2, 2, "red")
    # the near embankment's stone wall, the promenade paving and its railing over the water
    cv.fill(0, water[1], W, 2, "lgrey")
    cv.fill(0, water[1] + 2, W, BASE - water[1] - 2, "grey")

    def paving(px, py):
        return "grey" if seam(px, py) or hashed(px, py, 29) else "lgrey"

    yard(cv, BASE, FAR_WALK, paving)
    railing(cv, 0, W, BASE + 2)
    for x in (CX - 150, CX - 30, CX + 90):
        cv.fill(x, BASE - 22, 2, 24, "dslate")
        cv.fill(x - 2, BASE - 26, 6, 5, "navy")
        cv.fill(x - 1, BASE - 25, 4, 3, "yellow")
    # a cycle-route sign and a bike rack on the promenade
    sx = CX - 84
    cv.fill(sx, BASE - 14, 2, 18, "slate")
    for dy in range(-5, 6):
        for dx in range(-5, 6):
            if dx * dx + dy * dy <= 25:
                cv.fill(sx + 1 + dx, BASE - 18 + dy, 1, 1, "white" if dx * dx + dy * dy > 16 else "blue")
    for dx, dy in ((-2, 1), (-1, 0), (0, 0), (1, -1), (2, 1), (-2, 0), (2, 0), (0, -1)):
        cv.fill(sx + 1 + dx, BASE - 18 + dy, 1, 1, "white")
    for x in range(CX + 30, CX + 62, 8):
        cv.fill(x, FAR_WALK - 7, 2, 6, "slate")
        cv.fill(x + 4, FAR_WALK - 7, 2, 6, "slate")
        cv.fill(x, FAR_WALK - 8, 6, 1, "slate")
    cv.fill(CX + 34, FAR_WALK - 6, 14, 1, "red")
    for wx in (CX + 33, CX + 45):
        cv.fill(wx, FAR_WALK - 5, 4, 4, "navy")
        cv.fill(wx + 1, FAR_WALK - 4, 2, 2, "lgrey")

    def boards(x, z, span, px, py):
        """The boardwalk below the band: boards along the road, flecked."""
        a = abs(x)
        if a >= ROAD - 2:
            return road_c["seam"]
        if (a % 14) * scale(py + 0.5) < road_c["seam_px"]:
            return road_c["seam"]
        return road_c["fleck"] if hashed(px, py, 27) else road_c["road"]

    def cross_boards(px, py):
        """The cross street's boards run across it, 14 wide at the projection's scale."""
        if ((px + 0.5 - CX) / scale(py + 0.5)) % 14 * scale(py + 0.5) < road_c["seam_px"]:
            return road_c["seam"]
        return road_c["fleck"] if hashed(px, py, 27) else road_c["road"]

    rough_patches = rough("promenade-lawn", 8, WALK + 20, ROAD + 460, Z0 + 10, Z0 + 90)

    def paint(x, z, span, px, py):
        a = abs(x)
        if a < ROAD:
            return boards(x, z, span, px, py)
        if a < WALK:
            return "grey" if span < 16 and crosses(z, span, 32) else "lgrey"
        return turf(x, z, px, py, stripes=False, patches=rough_patches)

    cross(cv, cross_boards, road_c["seam"], paving, curb=None)
    cross_line(cv, road_c["mark"], dash=(10, 32))
    street(cv, paint)
    lanes(cv, road_c["mark"], dash=(10, 32))
    fence_rail(cv, *PERCH_X, PERCH)
    ornament(cv, "boat")
    return cv


# ---------- the near-right lawn's ornament ----------
# A static ornament each zone draws on its near-right lawn, beside the kite's tree: drawn on a
# grid ORN_W x ORN_H with its ground row ORN_H - 3, outlined two ramp steps darker, its grid's
# top-left at band ORN_X, ORN_Y, so its art keeps to x 322 to 353 with its feet on row STUB + 16 (155).
ORN_X, ORN_Y, ORN_W, ORN_H = 320, STUB - 7, 36, 26


def _birdbath(g, base):
    """A white stone bird bath, a sky bird on its rim (Elm Avenue)."""
    g.rect(11, base - 2, 11, 3, "lgrey")
    g.rect(19, base - 2, 3, 3, "grey")
    g.rect(14, 13, 5, base - 15, "lgrey")
    g.rect(14, 13, 1, base - 15, "white")
    g.rect(18, 13, 1, base - 15, "grey")
    g.rect(12, 12, 9, 2, "lgrey")
    g.ell(16.5, 9, 10, 4, "lgrey")
    g.ell(19, 10, 6, 2, "grey")
    g.rect(6, 7, 21, 2, "white")
    g.rect(24, 7, 3, 2, "lgrey")
    g.rect(8, 6, 17, 1, "cyan")
    g.rect(10, 6, 2, 1, "white")
    g.ell(11, 4, 3, 2, "sky")
    g.ell(8, 2, 2, 2, "sky")
    g.p(5, 2, "amber")
    g.p(8, 1, "ink")
    g.tri((13, 4), (16, 0), (15, 5), "blue")


def _bed(g, base):
    """A round flower bed edged in stones (Fairview Park)."""
    g.ell(17, base - 4, 14, 4, "dbrown")
    for x in range(4, 31, 4):
        g.rect(x, base - 1, 3, 2, "lgrey")
        g.p(x + 2, base, "grey")
    for x, y in ((8, base - 7), (14, base - 9), (21, base - 9), (27, base - 6), (11, base - 4), (24, base - 4)):
        g.ell(x, y, 3, 2.5, "dgreen")
        g.ell(x - 0.5, y - 0.5, 2, 1.5, "green")
    for x, y, c in ((7, base - 10, "red"), (13, base - 12, "yellow"), (19, base - 12, "white"), (24, base - 10, "pink"),
                    (29, base - 8, "red"), (10, base - 6, "white"), (17, base - 7, "red"), (22, base - 6, "yellow")):
        g.rect(x, y, 2, 2, c)


def _pot(g, base):
    """A terracotta pot of flowers, its lip lit on the left (Main Street's paving)."""
    g.tri((10, 13), (25, 13), (22, base + 1), "ochre")
    g.tri((10, 13), (22, base + 1), (13, base + 1), "ochre")
    g.tri((25, 13), (22, base + 1), (21, 13), "rust")
    g.rect(8, 11, 19, 3, "ochre")
    g.rect(8, 11, 3, 3, "tan")
    g.rect(24, 11, 3, 3, "rust")
    g.ell(17.5, 7, 9, 5, "dgreen")
    g.ell(16, 6, 6, 3, "green")
    for x, y, c in ((11, 4, "red"), (16, 2, "yellow"), (21, 4, "red"), (13, 8, "pink"), (19, 7, "yellow"),
                    (24, 8, "pink")):
        g.rect(x, y, 2, 2, c)


def _pumpkins(g, base):
    """Two pumpkins on the lawn, a big orange one and a small amber one (The Long Way Home)."""
    g.ell(14, base - 5, 9, 6, "orange")
    g.ell(12, base - 6, 5, 4, "amber")
    g.ell(14, base - 5, 2.5, 6, "orange")
    for x in (9, 18):
        g.rect(x, base - 9, 1, 8, "rust")
    g.rect(13, base - 13, 3, 3, "dgreen")
    g.rect(15, base - 14, 3, 1, "forest")
    g.ell(26, base - 3, 5, 4, "amber")
    g.ell(25, base - 4, 2.5, 2, "yellow")
    g.rect(26, base - 6, 1, 6, "orange")
    g.rect(25, base - 8, 2, 2, "brown")
    g.ell(20, base - 1, 3, 1.5, "dgreen")


def _gnome(g, base):
    """A garden gnome in a blue hat and red coat beside a red toadstool (Willow Crescent)."""
    g.rect(11, base - 8, 10, 8, "red")
    g.rect(18, base - 8, 3, 8, "dred")
    g.rect(11, base, 4, 1, "dbrown")
    g.rect(17, base, 4, 1, "dbrown")
    g.tri((10, 9), (22, 9), (15, 0), "blue")
    g.rect(12, 9, 8, 3, "skin1")
    g.tri((11, 11), (21, 11), (16, 18), "white")
    g.rect(15, 10, 2, 2, "pink")
    g.rect(27, base - 5, 2, 6, "white")
    g.ell(28, base - 5, 4, 2.5, "red")
    g.rect(26, base - 7, 1, 1, "white")
    g.rect(29, base - 6, 1, 1, "white")


def _boat(g, base):
    """A little white rowboat turned planter, its bow to the left, full of flowers (Riverside Path)."""
    g.tri((3, base - 10), (32, base - 7), (28, base + 1), "white")
    g.tri((3, base - 10), (28, base + 1), (11, base + 1), "white")
    g.tri((3, base - 10), (32, base - 7), (32, base - 5), "sky")
    g.tri((3, base - 10), (32, base - 5), (5, base - 8), "sky")
    g.rect(9, base - 2, 20, 1, "red")
    g.rect(26, base - 4, 3, 5, "lgrey")
    for x, y in ((9, base - 11), (15, base - 12), (21, base - 12), (27, base - 10)):
        g.ell(x, y, 4, 3, "dgreen")
        g.ell(x - 1, y - 1, 2.5, 1.5, "green")
    for x, y, c in ((7, base - 13, "red"), (12, base - 15, "yellow"), (18, base - 15, "pink"), (23, base - 14, "white"),
                    (28, base - 12, "red"), (15, base - 11, "white"), (21, base - 10, "yellow")):
        g.rect(x, y, 2, 2, c)


ORNAMENTS = dict(birdbath=_birdbath, bed=_bed, pot=_pot, pumpkins=_pumpkins, gnome=_gnome, boat=_boat)


def ornament(cv, kind):
    """Draw the zone's static ornament on the near-right lawn (see ORNAMENTS)."""
    g = Grid(ORN_W, ORN_H)
    ORNAMENTS[kind](g, ORN_H - 3)
    for y, row in enumerate(g.outlined()):
        for x, c in enumerate(row):
            if c:
                cv.fill(ORN_X + x, ORN_Y + y, 1, 1, c)


# leaves on the sidewalks and lawns: a lit half (f) and a shaded half (v), in rust and ochre
LEAF_SHAPES = (("ff.", ".fv"), (".ff", "fv."), (".f", "fv"))
LEAF_TONES = (("ochre", "rust"), ("rust", "dbrown"), ("ochre", "dbrown"))


def fallen(cv, rnd, n):
    """n leaves on the sidewalks and lawns from the far sidewalk down, falling thicker toward
    the band's bottom edge; none on the road."""
    for _ in range(n):
        py = round(H - 1 - (1 - rnd.random() ** 0.6) * (H - 1 - FAR_WALK))
        px = rnd.randrange(W - 2)
        if py >= STUB and abs((px + 0.5 - CX) / scale(py + 0.5)) < ROAD + 6:
            continue
        if FAR_CURB - 1 <= py < STUB and min(kerb(px, py), kerb(px + 2, py)) < 3:
            continue
        tones = dict(zip("fv", rnd.choice(LEAF_TONES)))
        for j, row in enumerate(rnd.choice(LEAF_SHAPES)):
            for k, ch in enumerate(row):
                if ch != ".":
                    cv.fill(px + k, py + j - 1, 1, 1, tones[ch])


ZONES = {
    "backdrop-woof-way": woof_way,
    "backdrop-bark-park": bark_park,
    "backdrop-sniff-street-shops": shops,
    "backdrop-the-long-way-home": long_way_home,
    "backdrop-snooze-crescent": snooze_crescent,
    "backdrop-paws-promenade": paws_promenade,
}


def gags():
    """Print the camera, the bottom row's join with the road and the gag spots, in band pixels."""
    def column(x, py):
        return CX + x * scale(py + 0.5)

    rail = sorted(round(at(PERCH_X[0], PERCH, h)[1] - 0.5) for h in (PERCH_H - 3, PERCH_H))
    print(f"camera: yH {YH}, footY {FOOT}, r {KS / F:.4f}, f {F:.1f}, centre x {CX}; "
          f"{VISIBLE:.1f} road px in view below the band, scale {S0:.4f} on row {H - 1}")
    road = [px for px in range(W) if abs(px + 0.5 - CX) < ROAD * S0]
    lines = [round(CX + d * S0 - 0.5) for d in DIVIDERS]
    print(f"row {H - 1}: road columns {road[0]}..{road[-1]}, lane dividers {lines}")
    print(f"perch top rail: rows {rail[0]}..{rail[1]}, x 0..{math.floor(column(PERCH_X[0], H - 1))}")
    lawn = math.ceil(column(WALK, H - 1))
    print(f"near-right lawn: x {lawn}..{W - 1}, rows {STUB}..{H - 1}")
    mid = (CURB + WALK) / 2
    for side in (-1, 1):
        ends = [(round(column(side * mid, py)), py) for py in (H - 1, STUB - 1)]
        print(f"sidewalk middle: {ends[0]} to {ends[1]}")


def preview(out, scale=3):
    sheet = Image.new("RGB", (W * scale, (H + 6) * len(ZONES) * scale), sn.rgb("ink"))
    for i, draw in enumerate(ZONES.values()):
        sheet.paste(draw().img.resize((W * scale, H * scale), Image.NEAREST), (0, i * (H + 6) * scale))
    sheet.save(out)


def build():
    os.makedirs("art/backdrops", exist_ok=True)
    os.makedirs("public/art/images", exist_ok=True)
    for key, draw in ZONES.items():
        png = f"public/art/images/{key}.png"
        draw().img.save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/backdrops/{key}.aseprite"], check=True)
    print("built", ", ".join(ZONES))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "gags":
        gags()
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
