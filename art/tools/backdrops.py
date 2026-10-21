#!/usr/bin/env python3
"""Draw the zone backdrops: the neighborhood band between the top bar and the road.

backdrop-<zone>: 360x158 images in the house palette, drawn on screen rows 48 to 205. The
street ends at a T-junction: the bottom rows continue the pseudo-3D road below the band (the
same projection, so the same road, curb and sidewalk edges at the same slope) up to a cross
street that runs flat across the band. Beyond it the far side faces the camera: the zone's
houses, park or shops, the scenery behind them (hills, rooftops, water, a skyline) and the sky.
The band, the approach and the camera come from the game's layout export. The backdrops draw
no static scenery on the near corners or the stub's verges, where the game's road begins and
its items spawn: only the verge's ground.

Rows, in band rows (0 to 157): the sky is one flat colour above row 45 (CALM), under the
message strip (Yonge Street's skyline, moon and stars rise above it); the far side's ground row
115 (BASE), the far sidewalk 119 to 122, the far curb 123 to 124, the cross street 125 to 133
with its centre line on row 129, the near curb 134 to 135 (none where the cross street has
none), the near sidewalk 136 to 138, and the stub from row 139 (STUB, the approach) to the
bottom row, 157, which continues the game's road (the 320-wide strip on columns 100 to 259,
lane dividers on 132, 164, 195 and 227, verge outside). The two sidewalks' middles run from
(87, 157) to (94, 138) and from (273, 157) to (266, 138) (python3 art/tools/backdrops.py camera
prints them for the current constants).

Usage:
  backdrops.py preview OUT.png   all six, stacked, scaled up
  backdrops.py camera            print the camera, the join with the road and the sidewalks
  backdrops.py verges [--write]  print the Toronto verges (TORONTO_VERGES) as JSON, or write
                                 them to shared/verges.json, which build also writes
  backdrops.py build             write art/backdrops/*.aseprite and
                                 public/art/images/*.png

Run from the repository root. A build overwrites the
.aseprite sources, so hand edits to them belong in this file instead.
"""

import json
import math
import os
import random
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import fonts  # noqa: E402
import scene as sn  # noqa: E402
from pixel import DARKER, K  # noqa: E402

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
# and the door's height.
HOUSE = (6, 12, 10, 18)
# SLIM is the backdrops' slim house, under a steep 22-row roof: tall windows either side of the door.
SLIM = (4, 8, 10, 13)
# The lit left edge of a roof, a ramp step lighter than the roof.
LIT = dict(slate="grey", dslate="slate", navy="dslate", purple="mauve", dred="red", brown="tan")


def house(cv, x, w, wall, roof, door="dred", top=40, base=104, roof_h=26, parts=HOUSE, curtains=None,
          eave=3, rake=None, dormer=False, glass="cyan"):
    """A house facing the camera, standing on row base: a gable roof roof_h rows tall from top, its
    eaves eave pixels past the walls. curtains, a colour, draws the windows' curtains closed,
    lamplight in the gap between them; glass is the windows' colour otherwise. rake, a colour, lights the roof's left edge, which faces the
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
        window(cv, wx, wall_y + off, ww, wh, curtains, glass)
    dx = x + w // 2 - 5
    cv.fill(dx, base - door_h, 10, door_h, door)
    cv.fill(dx + 7, base - door_h // 2, 1, 2, "amber")
    cv.fill(dx - 2, base - 2, 14, 2, "lgrey")


def window(cv, wx, wy, ww, wh, curtains=None, glass="cyan"):
    """A window in a plum frame on a white sill: glass (cyan) with white glazing bars, or curtains
    drawn closed with lamplight between them."""
    cv.fill(wx, wy, ww, wh, "plum")
    if curtains:
        cv.fill(wx + 1, wy + 1, ww - 2, wh - 2, curtains)
        cv.fill(wx + 1, wy + 1, ww - 2, 1, dk(curtains))
        cv.fill(wx + ww // 2 - 1, wy + 2, 2, wh - 3, "yellow")
        cv.fill(wx + 2, wy + 2, 1, wh - 3, dk(curtains))
        cv.fill(wx + ww - 3, wy + 2, 1, wh - 3, dk(curtains))
    else:
        cv.fill(wx + 1, wy + 1, ww - 2, wh - 2, glass)
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
# half the road, then the outer edges of the curb and the sidewalk, across from the road's centre, as
# Cabbagetown's verge (TORONTO_VERGES)
ROAD = LAYOUT["regions"]["road"]["width"] // 2
CURB, WALK = 164, 208
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
# clouds, stars or scenery: the debuff bars and the message strip lie over it. Yonge Street is the
# exception: its skyline, moon and stars rise above it.
CALM = BASE - 70


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


def slabs(px, py):
    """The cross street's plain sidewalk, without seams."""
    return "lgrey"


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
    raises the far side by that many rows at column px, for a street that curves away. The road
    is one flat colour, road's most common, with no texture: flecks or seams across the far
    street read as artefacts."""
    from collections import Counter
    flat_road = Counter(road(px, py) for py in range(CROSS, STUB) for px in range(W)).most_common(1)[0][0]
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
                    c = flat_road
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


def flat(road):
    """A stub road painter as the cross street's: its middle, with no lines across."""
    return lambda px, py: road(0, 0, 99, px, py)


def stats_street():
    """The suburban street screen-stats' window shows (screens.STATS_VIEW_TOP down past the far side's
    ground row): slim houses under steep roofs on a hill."""
    cv = sn.Canvas(W, H)
    hills(cv, BASE - 52, BASE, "dgreen", "green", 1.7, 10)
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
    return cv


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


def shopfront(cv, x, w, top, base, wall_c, awn, sign, board, letters, line="plum", glass="cyan", stripe="white"):
    """A shopfront facing the camera, rows top to base, drawn as a toy box: flat colour blocks
    inside a 1px line, a shaded top and right side, upstairs windows where there is room, a sign
    board in the sign letters, an awning striped awn and stripe, the shop window in glass and the door."""
    cv.fill(x, top, w, base - top, wall_c)
    cv.fill(x + w - 3, top, 3, base - top, dk(wall_c))
    cv.fill(x, top, w, 3, dk(wall_c))
    outline_box(cv, x, top, w, base - top + 1, line)
    if top <= base - 48:
        for wx in (x + 9, x + w - 21):
            cv.fill(wx, base - 44, 12, 10, line)
            cv.fill(wx + 1, base - 43, 10, 8, glass)
            cv.fill(wx + 2, base - 42, 3, 1, "white")
    cv.fill(x + 5, base - 32, w - 10, 13, line)
    cv.fill(x + 6, base - 31, w - 12, 11, board)
    word(cv, sign, x + w / 2, base - 29, letters)
    for i in range(0, w - 4, 8):
        cv.fill(x + 2 + i, base - 18, 4, 5, awn)
        cv.fill(x + 6 + i, base - 18, 4, 5, stripe)
    cv.fill(x + 1, base - 18, w - 2, 1, line)
    cv.fill(x + 2, base - 13, w - 4, 1, dk(awn))
    for i in range(2, w - 4, 4):
        cv.fill(x + i, base - 12, 2, 1, awn)
    cv.fill(x + 6, base - 11, w - 34, 11, line)
    cv.fill(x + 7, base - 10, w - 36, 9, glass)
    cv.fill(x + 9, base - 8, 6, 1, "white")
    cv.fill(x + 9, base - 6, 3, 1, "white")
    cv.fill(x + w - 22, base - 12, 12, 12, line)
    cv.fill(x + w - 21, base - 11, 10, 11, "dbrown")
    cv.fill(x + w - 13, base - 6, 1, 2, "amber")


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


# The warm sunset's sky bands, top to horizon, under screen-end's striped sun.
SUNSET_SKY = ("pink", "orange", "amber", "yellow")


# ---------- Toronto ----------
# The six Toronto neighborhoods, sharing the cross street. Their
# darkness ranges from the open sand of The Beaches to Yonge Street's evening, Kensington Market's
# dark laneways and High Park's canopy, and each has its own sky.

# The game's verge beside each Toronto road, keyed by art id, with colours
# by K name (shared/verges.json):
# the curb to curbTo, the strips (each to its to), the sidewalk or paving with a seam every
# seamEvery to walkTo (None: paving on out, with no lawn), then the lawn, mown or rough. lawnColors
# are the lawn's base, its mown stripes and rough patches, and its 2-row tufts, which draw their own
# colour rather than darkening the pixel under them; None where there is no lawn.
TORONTO_VERGES = {
    "cabbagetown": dict(curbColor="stone", curbTo=CURB, strips=[], walkColor="lgrey", walkDots=[],
                        seamColor="grey", seamEvery=32, walkTo=WALK, lawn="mown",
                        lawnColors=("dgreen", "canopy", "pine"), leaves=False),
    "high-park": dict(curbColor="pine", curbTo=160, strips=[], walkColor="pine", walkDots=[],
                      seamColor="pine", seamEvery=32, walkTo=160, lawn="rough",
                      lawnColors=("pine", "fir", "fir"), leaves=False),
    "distillery-district": dict(curbColor="stone", curbTo=164, strips=[], walkColor="brown",
                                walkDots=[dict(colors=["brick"], share=0.05), dict(colors=["rust"], share=0.02)],
                                seamColor="brick", seamEvery=16, walkTo=None, lawn="none",
                                lawnColors=None, leaves=False),
    "kensington-market": dict(curbColor="stone", curbTo=162, strips=[dict(color="coal", dots=[], to=166)],
                              walkColor="shale", walkDots=[dict(colors=["coal"], share=0.06),
                                                           dict(colors=["ash"], share=0.02)],
                              seamColor="coal", seamEvery=32, walkTo=None, lawn="none",
                              lawnColors=None, leaves=False),
    "the-beaches": dict(curbColor="driftwood", curbTo=164, strips=[], walkColor="skin1",
                        walkDots=[dict(colors=["tan"], share=0.05), dict(colors=["white"], share=0.008)],
                        seamColor="skin1", seamEvery=32, walkTo=None, lawn="none",
                        lawnColors=None, leaves=False),
    "yonge-street": dict(curbColor="stone", curbTo=164, strips=[], walkColor="dstone",
                         walkDots=[dict(colors=["shale"], share=0.015)], seamColor="shale", seamEvery=32,
                         walkTo=None, lawn="none", lawnColors=None, leaves=False),
}


def dotted(dots, value):
    """The dot colour a noise value in [0, 1) picks, or None: each dot takes its share of the range in
    turn, its colours equal parts of that share (as the game's verge dots)."""
    for d in dots:
        if value < d["share"]:
            return d["colors"][math.floor(value / d["share"] * len(d["colors"]))]
        value -= d["share"]
    return None


def toronto_verge(zone, road, patches=()):
    """A stub painter for a Toronto neighborhood: road(x, z, span, px, py) inside the road, then its
    verge (TORONTO_VERGES), with rough patches as world (x, z, rx, rz) ellipses."""
    v = TORONTO_VERGES[zone]
    walk_to = 10 ** 6 if v["walkTo"] is None else v["walkTo"]

    def paint(x, z, span, px, py):
        a = abs(x)
        if a < ROAD:
            return road(x, z, span, px, py)
        if a < v["curbTo"]:
            return v["curbColor"]
        for strip in v["strips"]:
            if a < strip["to"]:
                return dotted(strip["dots"], noise(math.floor(x), math.floor(z))) or strip["color"]
        if a < walk_to:
            if span < 16 and crosses(z, span, v["seamEvery"]):
                return v["seamColor"]
            return dotted(v["walkDots"], noise(math.floor(x), math.floor(z))) or v["walkColor"]
        lawn, dark, tufted = v["lawnColors"]
        s = F / (F + z)
        c = lawn
        if v["lawn"] == "mown" and mown(x, s):
            c = dark
        elif any(((x - qx) / rx) ** 2 + ((z - qz) / rz) ** 2 <= 1 for qx, qz, rx, rz in patches):
            c = dark
        return tufted if tuft(px, py, s) else c
    return paint


VERGES_JSON = "shared/verges.json"


def write_verges():
    """Write TORONTO_VERGES to VERGES_JSON, keyed by art id, colours by K name, for the game."""
    with open(VERGES_JSON, "w") as f:
        f.write(json.dumps(TORONTO_VERGES, indent=2) + "\n")

def iron_fence(cv, y, x0, x1, col="coal", h=9):
    """A wrought-iron front fence whose bars end on row y + 3: a bar every 3 columns under a top
    rail, every other bar topped with a spear."""
    for i, x in enumerate(range(x0, x1, 3)):
        cv.fill(x, y + 4 - h, 1, h, col)
        if i % 2 == 0:
            cv.fill(x, y + 3 - h, 1, 1, col)
    cv.fill(x0, y + 5 - h, x1 - x0, 1, col)
    cv.fill(x0, y + 1, x1 - x0, 1, col)


def gas_lamp(cv, x, y, post="coal"):
    """A heritage street lamp whose post stands on row y: a lantern lit gold."""
    cv.fill(x, y - 22, 2, 22, post)
    cv.fill(x - 1, y - 2, 4, 2, post)
    cv.fill(x - 2, y - 28, 6, 6, post)
    cv.fill(x - 1, y - 27, 4, 4, "gold")
    cv.fill(x - 1, y - 30, 4, 2, post)


def bay_gable(cv, cx, w, wall, roof, door, base, trim="white", curtains=None):
    """A Victorian bay-and-gable house on row base: a steep gable trimmed along both rakes, a two-storey
    bay window on its left half, a door on its right."""
    x = cx - w // 2
    top, roof_h = base - 50, 22
    house(cv, x, w, wall, roof, door, top=top, base=base, roof_h=roof_h, parts=(4, 8, 10, 13), eave=2,
          curtains=curtains)
    half = w / 2 + 2
    for i in range(1, roof_h):
        inset = round(i * half / roof_h)
        left = x - 2 + (w // 2 + 2) - inset
        cv.fill(left, top + i, 1, 1, trim)
        cv.fill(left + 2 * inset - 1, top + i, 1, 1, trim)
    cv.fill(cx - 2, top + 8, 4, 5, "plum")
    cv.fill(cx - 1, top + 9, 2, 3, curtains or "cyan")
    # the bay: a box standing proud of the wall, three windows a storey, its right side in shade
    bx, bw = x + 2, w // 2 - 1
    cv.fill(bx, top + roof_h + 2, bw, base - top - roof_h - 2, wall)
    cv.fill(bx + bw - 2, top + roof_h + 2, 2, base - top - roof_h - 2, dk(wall))
    cv.fill(bx - 1, top + roof_h + 1, bw + 2, 1, trim)
    for wy in (top + roof_h + 4, top + roof_h + 16):
        for k in range(3):
            window(cv, bx + 1 + k * (bw - 2) // 3, wy, max(3, (bw - 2) // 3 - 1), 8, curtains)
    cv.fill(bx - 1, top + roof_h + 14, bw + 2, 1, trim)


def necropolis(cv, cx, top, base):
    """The Necropolis chapel's tower between the roofs, from row top down to row base: red brick banded in
    stone under its belfry, buttresses below, lit lancets, a pinnacle on each corner, a tall slate spire and a
    cream cross."""
    cv.fill(cx - 4, top, 9, base - top, "brick")
    cv.fill(cx + 3, top, 2, base - top, "dbrick")
    for y in (top + 2, top + 12, top + 13):
        cv.fill(cx - 4, y, 9, 1, "stone")
    for x in (cx - 5, cx + 5):
        cv.fill(x, top + 14, 1, base - top - 14, "dbrick")
    for y, col in ((top + 5, "gold"), (top + 18, "gold"), (base - 9, "walnut")):
        cv.fill(cx - 1, y, 3, 6, col)
        cv.fill(cx, y - 1, 1, 1, col)
    cv.fill(cx - 5, top - 1, 11, 2, "dslate")
    for x in (cx - 5, cx + 5):
        cv.fill(x, top - 5, 1, 4, "dslate")
    for k in range(17):
        half = 3 - k // 5
        cv.fill(cx - half, top - 2 - k, 2 * half + 1, 1, "dslate")
        cv.fill(cx - half, top - 2 - k, 1, 1, "slate")
    cv.fill(cx, top - 22, 1, 4, "cream")
    cv.fill(cx - 1, top - 21, 3, 1, "cream")


CHAPEL = 87   # the Necropolis chapel's column: the gap between the second and third houses, left treeless


def cabbagetown():
    cv = sn.Canvas(W, H)
    # a lavender dusk, a last gold glow behind the roofs, a crescent moon and the first stars
    rows = sunset(cv, ("lilac", "pink", "peach", "gold"), BASE)
    for dy in range(-6, 7):
        for dx in range(-6, 7):
            if dx * dx + dy * dy <= 36 and (dx + 3) ** 2 + (dy - 2) ** 2 > 25:
                cv.fill(CX - 128 + dx, CALM + 10 + dy, 1, 1, "cream")
    for x, y in ((40, 4), (96, 9), (162, 2), (212, 7), (262, 1), (344, 11), (120, 16), (300, 14), (186, 12)):
        if CALM + y < rows[0][1] - 6:
            cv.fill(x, CALM + y, 1, 1, "white")
    # the old neighborhood behind: brick roofs up a leafy rise, the Necropolis chapel's spire
    hills(cv, BASE - 40, BASE, "canopy", "olive", 3.1, 6)
    roofline(cv, BASE - 28, ((10, 16, 8), (40, 14, 6), (150, 16, 8), (212, 16, 9), (258, 16, 7),
                             (282, 14, 9), (326, 18, 8)), "dbrick", "gold", step=1)
    necropolis(cv, CHAPEL, BASE - 46, BASE)

    def road(x, z, span, px, py):
        if abs(x) >= ROAD - 4:
            return "stone"
        return "slate" if hashed(px, py, 53) else "grey"

    homes = ((-6, 44, "brick", "shale", "forest", None), (56, 44, "cream", "slate", "ttc", None),
             (118, 46, "brick", "dslate", "navy", "gold"), (180, 48, "dbrick", "shale", "forest", "gold"),
             (242, 46, "brick", "slate", "navy", None), (304, 44, "clay", "shale", "ttc", "gold"),
             (366, 44, "brick", "dslate", "forest", None))
    for k in range(len(homes) - 1):
        cx = (homes[k][0] + homes[k + 1][0]) // 2
        if cx == CHAPEL:
            continue
        lift = crescent_bend(cx)
        tree(cv, cx, BASE - 34 - lift, "canopy", "pine", r=11, base=BASE - lift, girth=4)
    for cx, w, wall_c, roof, door, curtains in homes:
        lift = crescent_bend(cx)
        bay_gable(cv, cx, w, wall_c, roof, door, BASE - lift, curtains=curtains)
    lawn = grass("dgreen")
    yard(cv, BASE, FAR_WALK, lawn)
    for px in range(W):
        for py in range(BASE - crescent_bend(px), BASE):
            cv.fill(px, py, 1, 1, lawn(px, py))
    for cx, w, *_ in homes:
        x = cx - w // 2
        path(cv, cx + 4, BASE - crescent_bend(cx), FAR_WALK, "stone", "dstone")
        iron_fence(cv, FAR_WALK - 4 - crescent_bend(x), max(0, x - 6), cx + 2)
        iron_fence(cv, FAR_WALK - 4 - crescent_bend(x + w), cx + 18, x + w + 6)
    for x, col, lit in ((CX - 70, "plum", "purple"), (CX + 30, "orange", "amber")):
        fence_cat(cv, x, FAR_WALK - 9 - crescent_bend(x + 3), col, lit)
    for x in (CX - 150, CX - 30, CX + 92):
        gas_lamp(cv, x, FAR_WALK + 1 - crescent_bend(x))
    cross(cv, flat(road), "stone", slabs, bend=crescent_bend)
    cross_line(cv, "white", dash=(8, 32), bend=crescent_bend)
    street(cv, toronto_verge("cabbagetown", road))
    lanes(cv, "white", "slate", dash=(8, 32))
    return cv


def cherry(cv, cx, cy, r, base):
    """A cherry tree in blossom on row base: a dark trunk forking under a wide crown of pink lobes,
    mauve on the lower right, white petals picked out on the lit upper left."""
    cv.fill(cx - 1, cy, 2, base - cy, "dbrown")
    cv.fill(cx - 3, cy + 2, 2, 1, "dbrown")
    cv.fill(cx + 2, cy + 1, 2, 1, "dbrown")
    lobes = ((cx - r, cy + 1, r * 0.8), (cx + r, cy + 1, r * 0.8), (cx, cy - 2, r))
    for px in range(cx - 2 * r - 1, cx + 2 * r + 2):
        for py in range(cy - 2 * r, cy + r + 1):
            d = min(((px + 0.5 - lx) ** 2 + (py + 0.5 - ly) ** 2) / lr ** 2 for lx, ly, lr in lobes)
            if d <= 1:
                lit = (px - cx) + 1.5 * (py - cy)
                c = "mauve" if lit > r else "white" if lit < -r * 1.2 and hashed(px, py, 3) else "pink"
                cv.fill(px, py, 1, 1, c)


def castle(cv, cx, base):
    """The castle playground's wooden towers over the trees, centred on cx and standing on row base: two
    round-topped towers under red cones with pennants, a crenellated wall between them, a lookout door."""
    cv.fill(cx - 10, base - 14, 20, 14, "brown")
    for x in range(cx - 10, cx + 10, 4):
        cv.fill(x, base - 16, 2, 2, "brown")
    for x in range(cx - 9, cx + 10, 3):
        cv.fill(x, base - 13, 1, 13, "dbrown")
    cv.fill(cx - 2, base - 9, 4, 9, "walnut")
    for tx, h in ((cx - 13, 26), (cx + 10, 22)):
        cv.fill(tx - 3, base - h, 7, h, "tan")
        cv.fill(tx + 2, base - h, 2, h, "brown")
        cv.fill(tx - 1, base - h + 5, 3, 4, "walnut")
        for k in range(7):
            cv.fill(tx - 4 + k // 2, base - h - 1 - k, 9 - 2 * (k // 2), 1, "red")
        cv.fill(tx - 4, base - h - 1, 9, 1, "dred")
        cv.fill(tx, base - h - 11, 1, 4, "coal")
        cv.fill(tx + 1, base - h - 11, 3, 2, "gold")


def hot_dog_cart(cv, cx, base):
    """A hot dog cart by the park gate, side on with its wheels on row base: a stainless box with a
    counter, ketchup and mustard on it, under a red and yellow striped umbrella."""
    for k in range(4):
        for x in range(cx - 2 - 2 * k, cx + 3 + 2 * k):
            cv.fill(x, base - 22 + k, 1, 1, "red" if ((x - cx + 9) // 3) % 2 else "yellow")
    cv.fill(cx - 9, base - 18, 19, 1, "dred")
    cv.fill(cx, base - 18, 1, 8, "coal")
    cv.fill(cx - 7, base - 10, 15, 7, "lgrey")
    cv.fill(cx + 5, base - 10, 3, 7, "grey")
    cv.fill(cx - 7, base - 10, 15, 1, "white")
    cv.fill(cx - 6, base - 7, 9, 2, "red")
    cv.fill(cx - 5, base - 7, 2, 1, "yellow")
    cv.fill(cx - 5, base - 12, 1, 2, "red")
    cv.fill(cx - 3, base - 12, 1, 2, "yellow")
    for x in (cx - 5, cx + 4):
        cv.fill(x - 1, base - 3, 3, 3, "coal")
        cv.fill(x, base - 2, 1, 1, "ash")


def high_park():
    cv = sn.Canvas(W, H)
    # a deep clear blue, two white clouds over the canopy
    sky(cv, "azure", "sky", clouds=((6, BASE - 52, 46, 8), (CX + 70, BASE - 58, 40, 6)))
    # the park's dense canopy runs back over the hills: dark green rises and a fir tree line
    hills(cv, BASE - 50, BASE - 18, "pine", "canopy", 0.4, 8)
    treeline(cv, BASE - 34, ("fir", "pine"), 0.9, 3, 8)
    patches = [(60, BASE - 26, 30, 2), (CX + 40, BASE - 24, 24, 2), (CX - 50, BASE - 12, 26, 3),
               (CX - 24, BASE - 10, 20, 2), (CX + 100, BASE - 5, 30, 3), (CX + 128, BASE - 2, 18, 3),
               (40, BASE + 6, 24, 2)]

    def lawn(px, py):
        c = "pine"
        if any(((px - qx) / rx) ** 2 + ((py - qy) / ry) ** 2 <= 1 for qx, qy, rx, ry in patches):
            c = "canopy"
        return grass(c, 0.03 * (max(0, py - (BASE - 40)) / (H - BASE + 40)) ** 2)(px, py)

    yard(cv, BASE - 33, CROSS, lawn)
    treeline(cv, BASE - 20, ("pine", "canopy"), 2.5, 3, 9)
    # Grenadier Pond on the left, reeds along its near bank, a cherry in blossom over it
    for py in range(BASE - 16, BASE - 1):
        for px in range(0, 118):
            e = ((px + 0.5 - 54) / 60) ** 2 + ((py + 0.5 - (BASE - 8)) / 7.5) ** 2
            if e <= 1:
                c = "dlake" if py < BASE - 13 else "lake" if e > 0.4 else "shallow"
                cv.fill(px, py, 1, 1, "foam" if hashed(px // 2, py, 13) and py % 2 == 0 else c)
    for x in range(6, 110, 5):
        h = 3 + (x * 7) % 4
        cv.fill(x, BASE - 1 - h, 1, h, "olive")
        cv.fill(x + 2, BASE - h, 1, h - 1, "moss")
    for cx, top, r, leaf, shade in ((8, BASE - 30, 10, "pink", "mauve"), (118, BASE - 30, 9, "pine", "fir"),
                                    (CX + 100, BASE - 30, 9, "olive", "dolive"), (352, BASE - 28, 9, "pine", "fir")):
        tree(cv, cx, top, leaf, shade, r=r, base=BASE - 14, girth=4)
    castle(cv, CX + 112, BASE - 15)
    for cx, r in ((CX - 30, 8), (CX + 30, 8), (CX + 64, 8), (CX + 84, 6), (CX + 166, 7)):
        tree(cv, cx, BASE - 17 - 2 * r - (2 if r < 8 else 0), "canopy" if cx % 2 else "pine", "fir", r=r,
             base=BASE - 14 - (4 if r < 8 else 0), girth=3)
    # the cherry trees in blossom along Grenadier Pond's far bank, their petals on the water
    for cx, r in ((34, 6), (62, 7), (92, 6)):
        cherry(cv, cx, BASE - 16 - r, r, BASE - 14)
    for px in range(20, 104):
        for py in range(BASE - 13, BASE - 9):
            if hashed(px, py, 17) and abs((px - 20) % 29 - 14) < 9:
                cv.fill(px, py, 1, 1, "pink")
    for cx, top, r, leaf, shade in ((CX - 80, BASE - 28, 13, "canopy", "pine"),
                                    (CX + 150, BASE - 30, 14, "canopy", "pine"),
                                    (-2, BASE - 24, 15, "olive", "dolive")):
        tree(cv, cx, top, leaf, shade, trunk="bark", r=r, base=BASE + 4)
    # the park gate at the end of the trail, its sign facing the street
    for x in (CX - 48, CX + 46):
        cv.fill(x, BASE - 32, 3, 38, "bark")
    cv.fill(CX - 58, BASE - 42, 116, 16, "pine")
    cv.fill(CX - 58, BASE - 42, 116, 1, "canopy")
    cv.fill(CX - 58, BASE - 27, 116, 1, "fir")
    word(cv, "HIGH PARK", CX, BASE - 38, "gold")
    for x in (CX - 66, CX + 66):
        cv.fill(x, BASE - 18, 2, 24, "coal")
        cv.fill(x - 4, BASE - 24, 10, 7, "coal")
        cv.fill(x - 2, BASE - 22, 6, 4, "gold")
    hot_dog_cart(cv, CX + 84, BASE + 3)

    def trail(x, z, span, px, py):
        a = abs(x)
        if a >= ROAD - 6:
            return "pine"
        if a >= ROAD - 7:
            return "bark"
        return "brown" if hashed(px, py, 13) else "cream" if hashed(px, py + 5, 23) else "tan"

    for py in range(BASE - 8, CROSS):
        half = 18 + (py - BASE + 8) // 3
        cv.fill(CX - half, py, 2 * half, 1, "bark")
        for px in range(CX - half + 1, CX + half - 1):
            cv.fill(px, py, 1, 1, trail(0, 0, 99, px, py))
    cross(cv, lambda px, py: "brown" if hashed(px, py, 13) else "tan", "bark", lawn, curb=None, top=CROSS)
    cross_line(cv, "dbrown", dash=(7, 16))
    rough_patches = rough("high-park-lawn", 10, ROAD + 30, ROAD + 460, Z0 + 10, Z0 + 90)
    street(cv, toronto_verge("high-park", trail, rough_patches))
    lanes(cv, "dbrown", dash=(7, 16))
    return cv


def warehouse(cv, x, w, top, base, wall, trim="stone", glass="gold", rows=2):
    """A brick warehouse facing the camera, rows top to base: a cornice, arched windows in rows, its
    right side in shade."""
    cv.fill(x, top, w, base - top, wall)
    cv.fill(x + w - 3, top, 3, base - top, dk(wall))
    cv.fill(x - 1, top, w + 2, 3, dk(wall))
    cv.fill(x - 1, top + 3, w + 2, 1, trim)
    for r in range(rows):
        wy = top + 7 + r * 13
        if wy + 10 > base - 2:
            break
        for wx in range(x + 4, x + w - 8, 10):
            cv.fill(wx, wy + 1, 6, 9, trim)
            cv.fill(wx + 1, wy, 4, 1, trim)
            cv.fill(wx + 1, wy + 1, 4, 8, glass)
            cv.fill(wx + 1, wy + 1, 4, 1, dk(glass))
            cv.fill(wx + 3, wy + 2, 1, 7, trim)


def string_lights(cv, x0, x1, y, sag):
    """A string of lit bulbs from x0 to x1 on row y, sagging sag rows in the middle."""
    for x in range(x0, x1):
        t = (x - x0) / max(1, x1 - x0 - 1)
        yy = round(y + sag * 4 * t * (1 - t))
        cv.fill(x, yy, 1, 1, "coal")
        if (x - x0) % 6 == 3:
            cv.fill(x, yy + 1, 1, 2, "gold")


def barrel(cv, x, y):
    """A whisky barrel standing on row y."""
    cv.fill(x, y - 9, 8, 9, "clay")
    cv.fill(x + 6, y - 9, 2, 9, "bark")
    cv.fill(x, y - 8, 8, 1, "coal")
    cv.fill(x, y - 3, 8, 1, "coal")
    cv.fill(x + 1, y - 10, 6, 1, "bark")


def spider(cv, cx, base):
    """I.T., the steel spider sculpture in the lane, standing on row base: a bulbous coal head pierced
    with gold, lit ash on its upper left, on eight long jointed legs whose knees rise over it."""
    legs = ((8, 40, 11), (13, 42, 18), (18, 39, 25), (22, 34, 31))
    hip = base - 26
    for kx, ky, fx in legs:
        for side in (-1, 1):
            knee = (cx + side * kx, base - ky)
            cv.line(cx + side * 3, hip, *knee, "coal")
            cv.line(*knee, cx + side * fx, base, "coal")
            cv.line(knee[0] + side, knee[1], cx + side * (fx + 1), base, "coal")
    for dy in range(-7, 8):
        for dx in range(-9, 10):
            if (dx / 9.5) ** 2 + (dy / 7.5) ** 2 <= 1:
                lit = dx + dy < -8
                cv.fill(cx + dx, hip - 3 + dy, 1, 1, "ash" if lit else "coal")
    for dx, dy in ((-4, -4), (1, -5), (5, -2), (-1, -1), (-5, 1), (2, 2), (6, 2), (-2, 4)):
        cv.fill(cx + dx, hip - 3 + dy, 1, 1, "gold")
    cv.fill(cx - 2, hip + 4, 5, 2, "coal")


def distillery():
    cv = sn.Canvas(W, H)
    # a warm peach evening over the old distillery, gulls
    sky(cv, "peach", "skin1")
    birds(cv, ((60, BASE - 64), (74, BASE - 60), (300, BASE - 66)))
    # the water tower and the chimney stack over the warehouses
    tx = CX + 118
    for lx in (tx - 6, tx + 5):
        cv.fill(lx, BASE - 50, 2, 16, "dstone")
    cv.fill(tx - 6, BASE - 43, 13, 1, "dstone")
    cv.fill(tx - 9, BASE - 62, 20, 12, "bark")
    cv.fill(tx + 7, BASE - 62, 4, 12, "walnut")
    for k in range(4):
        cv.fill(tx - 7 + 2 * k, BASE - 63 - k, 16 - 4 * k, 1, "walnut")
    cv.fill(CX - 102, BASE - 68, 10, 30, "brick")
    cv.fill(CX - 95, BASE - 68, 3, 30, "dbrick")
    cv.fill(CX - 103, BASE - 69, 12, 2, "dbrick")
    # the warehouses across the lane: brick, a limestone mill, the long sign over the middle one
    for x, w, top, wall_c, trim, rows in ((-6, 70, BASE - 40, "brick", "stone", 2),
                                         (64, 52, BASE - 34, "driftwood", "dstone", 2),
                                         (CX - 60, 120, BASE - 52, "brick", "stone", 3),
                                         (CX + 60, 50, BASE - 38, "dbrick", "stone", 2),
                                         (CX + 110, 76, BASE - 44, "brick", "stone", 2)):
        warehouse(cv, x, w, top, BASE, wall_c, trim, rows=rows)
    cv.fill(CX - 46, BASE - 50, 92, 11, "coal")
    cv.fill(CX - 45, BASE - 49, 90, 9, "dbrick")
    word(cv, "DISTILLERY", CX, BASE - 48, "cream")
    for x in (CX - 14, 22, CX + 136):
        cv.fill(x, BASE - 14, 12, 14, "walnut")
        cv.fill(x + 1, BASE - 13, 10, 13, "bark")
        cv.fill(x + 4, BASE - 9, 1, 2, "gold")
    string_lights(cv, 0, CX - 60, BASE - 38, 4)
    string_lights(cv, CX + 60, W, BASE - 36, 4)

    def paving(px, py):
        return "brick" if hashed(px, py, 19) else "brown"

    yard(cv, BASE, FAR_WALK, paving)
    for x in (6, CX + 70, CX + 150):
        barrel(cv, x, FAR_WALK - 1)
    spider(cv, 96, FAR_WALK - 1)

    def road(x, z, span, px, py):
        a = abs(x)
        if a >= ROAD - 4:
            return "brick"
        if span < 6 and crosses(z, span, 8):
            return "navy"
        return "slate" if hashed(px, py, 31) else "dslate"

    cross(cv, lambda px, py: "slate" if hashed(px, py, 31) else "dslate", "navy", paving, curb="stone")
    cross_line(cv, "lgrey", "stone", dash=(6, 8))
    street(cv, toronto_verge("distillery-district", road))
    lanes(cv, "lgrey", "stone", dash=(6, 8))
    return cv


def market_house(cv, cx, w, wall, roof, awn, sign, board, letters, base=BASE):
    """A Kensington house turned shop: a steep gable over a painted wall,
    a shopfront under it, its glass lake and its awning striped cream."""
    x = cx - w // 2
    top = base - 58
    house(cv, x, w, wall, roof, "dbrown", top=top, base=base, roof_h=20, parts=(3, 8, 9, 0), eave=2, glass="lake")
    shopfront(cv, x, w, base - 33, base, wall, awn, sign, board, letters, glass="lake", stripe="cream")


MURAL = ("dred", "ochre", "olive", "dturq", "violet", "mauve")


def mural(cv, x0, top, base, flip):
    """A laneway wall 16 wide, rows top to base, painted with a mural: diagonal bands of bright paint
    under a walnut coping, a dog's face looking out of them, the paint stopping short of the ground."""
    for py in range(top, base):
        for px in range(x0, x0 + 16):
            u = (px - x0) if not flip else (x0 + 15 - px)
            c = MURAL[((u + py) // 5) % len(MURAL)] if py < base - 4 else "coal"
            cv.fill(px, py, 1, 1, c)
    cv.fill(x0, top, 16, 2, "walnut")
    fy = top + 34
    for dy in range(-6, 7):
        for dx in range(-6, 7):
            if (dx / 6.5) ** 2 + (dy / 6) ** 2 <= 1:
                cv.fill(x0 + 8 + dx, fy + dy, 1, 1, "cream")
    for dx in (-6, 4):
        cv.fill(x0 + 8 + dx, fy - 7, 3, 7, "brown")
    for dx in (-3, 2):
        cv.fill(x0 + 8 + dx, fy - 2, 2, 2, "coal")
    cv.fill(x0 + 7, fy + 2, 3, 2, "coal")
    cv.fill(x0 + 8, fy + 5, 1, 2, "ttc")


def garden_car(cv, x, base):
    """The Garden Car, side on with its wheels on row base: an old sedan painted in patches of bright
    colour, its windows and roof, hood and trunk overgrown with plants in flower."""
    cv.fill(x, base - 9, 38, 6, "rust")
    for k, c in enumerate(("gold", "dturq", "moss", "gold", "lilac", "dturq", "moss")):
        cv.fill(x + 2 + k * 5, base - 8 + (k % 2) * 2, 3, 2, c)
    cv.fill(x, base - 4, 38, 1, "dbrown")
    cv.fill(x + 9, base - 15, 20, 6, "rust")
    cv.fill(x + 7, base - 13, 2, 4, "rust")
    cv.fill(x + 29, base - 13, 2, 4, "rust")
    for wx in (x + 10, x + 20):
        cv.fill(wx, base - 14, 8, 4, "olive")
        cv.fill(wx + 2, base - 13, 2, 2, "pine")
    for bx, by, rx in ((x + 4, base - 10, 4), (x + 19, base - 16, 9), (x + 34, base - 10, 4)):
        for dy in range(-4, 1):
            for dx in range(-rx, rx + 1):
                if (dx / (rx + 0.5)) ** 2 + (dy / 4.5) ** 2 <= 1:
                    cv.fill(bx + dx, by + dy, 1, 1, "pine" if dx + dy > rx // 2 else "canopy")
    for fx, fy, c in ((x + 2, base - 13, "red"), (x + 6, base - 12, "yellow"), (x + 13, base - 20, "pink"),
                      (x + 18, base - 21, "yellow"), (x + 23, base - 20, "red"), (x + 27, base - 18, "white"),
                      (x + 33, base - 13, "pink"), (x + 37, base - 12, "yellow")):
        cv.fill(fx, fy, 2, 2, c)
    for wx in (x + 8, x + 30):
        cv.fill(wx - 3, base - 6, 7, 6, "coal")
        cv.fill(wx - 1, base - 4, 3, 2, "ash")


def kensington():
    cv = sn.Canvas(W, H)
    # a deep teal sunburst from the end of the street, flat dturq beyond its arc, two clouds
    sunburst(cv, CX, BASE + 6, 7, "lake", "dturq", FAR_WALK, r=(W * 0.65, BASE + 6 - CALM))
    for x, y, w, p in ((12, BASE - 58, 30, 4), (296, BASE - 60, 38, 5)):
        cloud(cv, x, y, w, p, f"kensington-{x}")
    # rooftops of the back lanes behind the houses
    roofline(cv, BASE - 34, ((24, 18, 10), (76, 16, 8), (228, 18, 9), (300, 16, 10)), "dbrick", "gold", step=1)
    # painted houses turned shops across the street
    for cx, w, wall_c, roof, awn, sign, board, letters in (
            (47, 56, "dturq", "navy", "dred", "FRUIT", "forest", "gold"),
            (CX - 69, 60, "violet", "purple", "ochre", "CHEESE", "navy", "gold"),
            (CX, 68, "ochre", "dbrick", "dturq", "VINTAGE", "purple", "cream"),
            (CX + 69, 60, "olive", "dolive", "mauve", "SPICES", "dbrick", "gold"),
            (313, 56, "mauve", "purple", "lake", "COFFEE", "coal", "cream")):
        market_house(cv, cx, w, wall_c, roof, awn, sign, board, letters)
    bunting(cv, 0, CX - 36, BASE - 37, 5, ("dred", "gold", "dturq", "lilac", "moss"))
    bunting(cv, CX + 36, W, BASE - 37, 5, ("moss", "lilac", "gold", "dred", "dturq"))

    def paving(px, py):
        return "coal" if hashed(px, py, 23) else "shale"

    yard(cv, BASE, FAR_WALK, paving)
    # produce out on the sidewalk: crates of fruit
    for x, fruit in ((6, ("red", "amber")), (CX + 52, ("amber", "orange")), (CX + 108, ("red", "lime"))):
        cv.fill(x, FAR_WALK - 6, 14, 5, "clay")
        cv.fill(x, FAR_WALK - 6, 14, 1, "bark")
        for k in range(6):
            cv.fill(x + 1 + k * 2, FAR_WALK - 8 + (k % 2), 2, 2, fruit[k % 2])
    garden_car(cv, 58, FAR_WALK - 1)
    # the laneway walls at both ends of the street, painted with murals
    for x0 in (0, W - 16):
        mural(cv, x0, BASE - 66, FAR_WALK, x0 > 0)

    def road(x, z, span, px, py):
        a = abs(x)
        if a >= ROAD - 4:
            return "shale"
        if a >= ROAD - 5:
            return "coal"
        if span < 4 and crosses(z, span, 32):
            return "plum"
        return "brick" if hashed(px, py, 61) else "dbrick"

    cross(cv, flat(road), "coal", paving, curb="stone")
    cross_line(cv, "white", "mauve")
    street(cv, toronto_verge("kensington-market", road))
    lanes(cv, "white", "mauve")
    return cv


def leuty(cv, cx, base):
    """A white clapboard lifeguard station with a red hipped roof and a lookout, on stilts, on row base."""
    for x in (cx - 9, cx + 7):
        cv.fill(x, base - 8, 2, 8, "driftwood")
    cv.fill(cx - 11, base - 22, 22, 14, "white")
    cv.fill(cx + 8, base - 22, 3, 14, "lgrey")
    for y in range(base - 20, base - 8, 3):
        cv.fill(cx - 11, y, 22, 1, "lgrey")
    cv.fill(cx - 4, base - 18, 8, 6, "dlake")
    cv.fill(cx - 3, base - 17, 6, 4, "foam")
    for k in range(6):
        cv.fill(cx - 13 + k, base - 23 - k, 26 - 2 * k, 1, "ttc")
    cv.fill(cx - 4, base - 34, 8, 6, "white")
    cv.fill(cx - 3, base - 33, 6, 3, "dlake")
    for k in range(3):
        cv.fill(cx - 5 + k, base - 35 - k, 10 - 2 * k, 1, "ttc")
    cv.fill(cx, base - 41, 1, 4, "coal")
    cv.fill(cx + 1, base - 41, 3, 2, "ttc")


def umbrella(cv, cx, base, a, b):
    """A striped beach umbrella on row base."""
    cv.fill(cx, base - 12, 1, 12, "driftwood")
    for k in range(5):
        for x in range(cx - 8 + k, cx + 9 - k):
            cv.fill(x, base - 13 - k, 1, 1, a if ((x - cx) // 3) % 2 else b)


def rc_harris(cv, x0, base):
    """The R.C. Harris Water Treatment Plant on its lawn at the east end of the beach, standing on row
    base: buff brick Art Deco halls under hipped copper roofs, the middle hall raised over its wings,
    tall arched windows, a stone plinth."""
    cv.fill(x0 - 6, base - 1, W - x0 + 6, 4, "moss")
    cv.fill(x0 - 6, base + 2, W - x0 + 6, 1, "olive")
    for x, w, wall_h, roof_h in ((x0, 22, 11, 4), (x0 + 22, 26, 19, 6), (x0 + 48, 24, 11, 4)):
        top = base - wall_h
        cv.fill(x, top, w, wall_h, "cream")
        cv.fill(x + w - 2, top, 2, wall_h, "tan")
        cv.fill(x, base - 2, w, 2, "stone")
        for k in range(roof_h):
            cv.fill(x - 1 + k, top - 1 - k, w + 2 - 2 * k, 1, "turquoise" if k else "dturq")
        cv.fill(x - 1 + roof_h - 1, top - roof_h, 2, 1, "foam")
        for wx in range(x + 3, x + w - 4, 4):
            cv.fill(wx, top + 3, 2, wall_h - 6, "dlake")
            cv.fill(wx, top + 3, 2, 1, "cream")
            cv.fill(wx, top + 4, 1, 1, "foam")
    cv.fill(x0 + 33, base - 8, 4, 6, "walnut")
    cv.fill(x0 + 31, base - 9, 8, 1, "tan")


def beaches():
    cv = sn.Canvas(W, H)
    # a warm yellow late afternoon over the lake, small clouds and gulls
    sky(cv, "gold", "yellow", clouds=((20, BASE - 56, 26, 4), (CX + 90, BASE - 60, 30, 4)))
    birds(cv, ((70, BASE - 48), (82, BASE - 44), (244, BASE - 52)))
    # Lake Ontario out to the horizon: dark far water, then lake and shallows, foam lines, sails
    for py in range(BASE - 40, BASE - 12):
        for px in range(W):
            c = "dlake" if py < BASE - 34 else "lake" if py < BASE - 22 else "shallow"
            if hashed(px // 3, py, 9) and py % 3 == 0:
                c = "shallow" if c == "lake" else "foam" if c == "shallow" else "lake"
            cv.fill(px, py, 1, 1, c)
    cv.fill(0, BASE - 41, W, 1, "lake")
    for sx, sy in ((CX - 120, BASE - 36), (CX + 40, BASE - 38), (CX - 40, BASE - 30)):
        cv.fill(sx - 4, sy + 6, 10, 2, "white")
        for k in range(8):
            cv.fill(sx, sy - 2 + k, 1 + k // 2, 1, "white")
        cv.fill(sx - 1, sy - 3, 1, 9, "coal")
    for py in range(BASE - 12, BASE):
        cv.fill(0, py, W, 1, "foam" if py == BASE - 12 else "skin1")
    for px in range(W):
        if hashed(px, BASE - 11, 5):
            cv.fill(px, BASE - 11, 1, 1, "foam")
    leuty(cv, CX + 96, BASE - 2)
    for cx, a, b in ((CX - 130, "ttc", "white"), (CX - 60, "turquoise", "white"), (CX + 30, "gold", "dlake")):
        umbrella(cv, cx, BASE - 1, a, b)
    rc_harris(cv, CX + 116, BASE - 9)

    def sand(px, py):
        return "tan" if hashed(px, py, 43) else "white" if hashed(px, py + 7, 150) else "skin1"

    yard(cv, BASE, FAR_WALK, sand)

    def boards(x, z, span, px, py):
        a = abs(x)
        if a >= ROAD - 4:
            return "driftwood"
        if (a % 16) * scale(py + 0.5) < 1:
            return "tan"
        return "tan" if hashed(px, py, 27) else "cream"

    def cross_boards(px, py):
        if ((px + 0.5 - CX) / scale(py + 0.5)) % 16 * scale(py + 0.5) < 2:
            return "tan"
        return "tan" if hashed(px, py, 27) else "cream"

    cross(cv, cross_boards, "tan", sand, curb=None)
    cross_line(cv, "dbrown", dash=(10, 32))
    street(cv, toronto_verge("the-beaches", boards))
    lanes(cv, "dbrown", dash=(10, 32))
    return cv


def cn_tower(cv, cx, base, top):
    """The tower far off at night, from its antenna's tip on row top to row base, in the far landmarks'
    haze shaded lgrey, in its real proportions: the antenna the top sixth, a red beacon at its tip and
    another halfway down; the SkyPod with its gold windows; a 5-column shaft on to the main pod, 23 wide
    with a gold window band, two thirds of the way up; then the long shaft tapering out to 13 columns at the foot."""
    h = base - top

    def row(y, half):
        cv.fill(cx - half, y, 2 * half + 1, 1, "haze")
        cv.fill(cx + max(1, half - 2), y, min(3, half), 1, "lgrey")

    mast, sky_pod, pod = top + round(h * 0.09), top + round(h * 0.16), top + round(h * 0.33)
    cv.fill(cx, top, 1, mast - top, "lgrey")
    for y in range(mast, sky_pod):
        row(y, 1)
    for k, half in enumerate((2, 4, 4, 4, 3)):
        row(sky_pod + k, half)
    cv.fill(cx - 3, sky_pod + 2, 7, 1, "gold")
    for y in range(sky_pod + 5, pod):
        row(y, 2)
    for k, half in enumerate((6, 9, 10, 11, 11, 11, 10, 9, 7, 5)):
        row(pod + k, half)
    cv.fill(cx - 11, pod + 4, 23, 1, "gold")
    for x in range(cx - 10, cx + 11, 3):
        cv.fill(x, pod + 4, 1, 1, "amber")
    for y in range(pod + 10, base):
        row(y, 2 + (y - pod - 10) * 5 // (base - pod - 10))
        cv.fill(cx, y, 1, 1, "lgrey")
    cv.fill(cx, top, 1, 1, "red")
    cv.fill(cx, mast - (mast - top) // 2, 1, 1, "red")


def mast(cv, cx, top, h):
    """A rooftop antenna h rows tall from row top, a red light at its tip."""
    cv.fill(cx, top, 1, h, "ash")
    cv.fill(cx, top, 1, 1, "red")


def scotia(cv, x, w, top):
    """Scotia Plaza: red granite in brick and dbrick facets, its top stepped down to a chevron notch, a
    few windows lit."""
    for k in range(w // 2):
        cv.fill(x + k, top + abs(w // 4 - k) // 2, 1, BASE - top, "brick")
        cv.fill(x + w - 1 - k, top + abs(w // 4 - k) // 2, 1, BASE - top, "dbrick")
    for c in range(x + 2, x + w - 2, 3):
        cv.fill(c, top + 6, 1, BASE - top - 6, "dbrick")
    lit(cv, x + 3, x + w - 3, top + 7, BASE, "scotia", 0.15, ("gold", "amber"), (3, 3))
    cv.fill(x, top, 1, BASE - top, "coal")
    cv.fill(x + w - 1, top, 1, BASE - top, "coal")


def full_moon(cv, cx, cy, r):
    """A full moon: a haze disc lit white on its upper left, three lgrey seas."""
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * (r + 1):
                cv.fill(cx + dx, cy + dy, 1, 1, "white" if dx + dy < -r else "haze")
    for dx, dy, w in ((0, -2, 2), (-2, 1, 2), (1, 2, 2)):
        cv.fill(cx + dx, cy + dy, w, 1, "lgrey")


def lit(cv, x0, x1, y0, y1, seed, rate, cols=("gold", "amber", "cream"), step=(3, 3), size=(1, 1)):
    """Lit windows across columns x0..x1 and rows y0..y1, one window a step, a share rate lit."""
    rnd = random.Random(f"lit-{seed}")
    for y in range(y0, y1, step[1]):
        for x in range(x0, x1, step[0]):
            if rnd.random() < rate:
                cv.fill(x, y, size[0], size[1], rnd.choice(cols))


def skyline(cv, towers):
    """The towers behind the front row: silhouettes standing on BASE, each (x, w, top, wall), a lit
    window in some of every 3 columns and rows."""
    for k, (x, w, top, wall) in enumerate(towers):
        cv.fill(x, top, w, BASE - top, wall)
        lit(cv, x + 2, x + w - 1, top + 3, BASE, f"far-{k}", 0.2, ("gold", "amber"))


def skydome(cv, x, w, wall, ry):
    """The SkyDome far off, in the far landmarks' haze: a dome ry rows tall on row wall, its four panels'
    seams lgrey arcs nested at its right foot, lit white along its upper left, an ink line along its top
    arc so it reads apart from light scenery behind it. Its foot stays hidden behind the nearer towers."""
    rx = w / 2

    def inside(px, py, r):
        dx, dy = (px + 0.5 - (x + w - r)) / r, (py + 0.5 - wall) / (ry * (r / rx) ** 0.5)
        return dx * dx + dy * dy <= 1

    for py in range(wall - ry, wall):
        for px in range(x, x + w):
            if not inside(px, py, rx):
                continue
            c = "white" if not inside(px - 1, py - 1, rx) and px < x + w * 0.6 else "haze"
            for r in (rx * 0.75, rx * 0.5, rx * 0.25):
                if inside(px, py, r) and not inside(px - 1, py, r):
                    c = "lgrey"
            cv.fill(px, py, 1, 1, c)
    for px in range(x, x + w):
        rim = next((py for py in range(wall - ry, wall) if inside(px, py, rx)), None)
        if rim is not None:
            cv.fill(px, rim - 1, 1, 1, "ink")
            if px > x and not inside(px - 1, rim, rx):
                cv.fill(px - 1, rim, 1, 1, "ink")
            if px < x + w - 1 and not inside(px + 1, rim, rx):
                cv.fill(px + 1, rim, 1, 1, "ink")
    cv.fill(x, wall, w, 3, "lgrey")
    for ax in range(x + 3, x + w - 3, 5):
        cv.fill(ax, wall + 1, 3, 1, "gold")


def crown(cv, x, w, top, wall, line="coal", steps=2):
    """A tower's stepped top: steps rows each 2 columns narrower a side, above row top."""
    for k in range(1, steps + 1):
        cv.fill(x + 2 * k, top - k, w - 4 * k, 1, line)
        cv.fill(x + 2 * k + 1, top - k + 1, w - 4 * k - 2, 1, wall)


def royal_bank(cv, x, w, top):
    """A Royal Bank Plaza tower: gold glass in sawtooth facets, a gold and amber pair lit and ochre
    in shade every 4 columns, ochre floors every 3 rows."""
    crown(cv, x, w, top, "gold")
    cv.fill(x, top, w, BASE - top, "ochre")
    for c in range(x + 1, x + w - 1):
        cv.fill(c, top + 1, 1, BASE - top - 1, ("gold", "gold", "amber", "ochre")[(c - x) % 4])
    for y in range(top + 3, BASE, 3):
        cv.fill(x + 1, y, w - 2, 1, "ochre")
    cv.fill(x + w - 3, top + 1, 2, BASE - top - 1, "ochre")
    outline_box(cv, x, top, w, BASE - top + 1, "coal")


def first_canadian(cv, x, w, top):
    """First Canadian Place: white marble, grey fins every 3 columns, its notched corners in grey,
    the red BMO band at the top."""
    crown(cv, x, w, top, "lgrey", steps=1)
    cv.fill(x, top, w, BASE - top, "lgrey")
    for c in range(x + 3, x + w - 3, 3):
        cv.fill(c, top + 5, 1, BASE - top - 5, "grey")
    cv.fill(x + 1, top + 1, 2, BASE - top - 1, "white")
    cv.fill(x + w - 3, top + 1, 2, BASE - top - 1, "grey")
    cv.fill(x + 2, top + 1, w - 4, 3, "ttc")
    cv.fill(x + w // 2 - 3, top + 2, 6, 1, "white")
    lit(cv, x + 4, x + w - 4, top + 7, BASE, "fcp", 0.18, ("cream", "gold"), (3, 2))
    outline_box(cv, x, top, w, BASE - top + 1, "slate")


def dominion(cv, x, w, top, seed):
    """A TD Centre tower: black steel and bronze glass, coal in an ink grid every 3 columns and rows,
    whole runs of each floor lit, the green logo near the top and an ash edge to the light."""
    cv.fill(x, top, w, BASE - top, "coal")
    for c in range(x + 3, x + w - 1, 3):
        cv.fill(c, top + 1, 1, BASE - top - 1, "ink")
    rnd = random.Random(f"td-{seed}")
    for y in range(top + 6, BASE, 3):
        run = 0
        for c in range(x + 1, x + w - 2, 3):
            run = rnd.randrange(2, 6) if run == 0 and rnd.random() < 0.3 else max(0, run - 1)
            if run:
                cv.fill(c, y, 2, 1, rnd.choice(("gold", "amber", "cream")))
    cv.fill(x + 2, top + 2, 3, 3, "green")
    cv.fill(x + 3, top + 3, 1, 1, "white")
    outline_box(cv, x, top, w, BASE - top + 1, "ink")
    cv.fill(x, top, 1, BASE - top, "ash")
    cv.fill(x, top, w - 1, 1, "ash")


def glass_tower(cv, x, w, top, seed, glass="dlake", line="ink"):
    """A glass tower at night: dark glass, a floor line every 3 rows, its right side in shade, some
    floors' windows lit."""
    cv.fill(x, top, w, BASE - top, glass)
    for y in range(top + 2, BASE, 3):
        cv.fill(x + 1, y, w - 2, 1, dk(glass))
    cv.fill(x + w - 3, top, 3, BASE - top, dk(glass))
    lit(cv, x + 2, x + w - 3, top + 3, BASE, f"glass-{seed}", 0.25, ("gold", "amber", "foam"), (2, 3))
    outline_box(cv, x, top, w, BASE - top + 1, line)
    cv.fill(x + 1, top + 1, 1, BASE - top - 1, "lake")


def screens(cv, x, w, top):
    """The Yonge-Dundas tower: shale with a few lit windows over its face of screens, the big WOOF!
    screen and, under it, the bright ads down to its street level."""
    cv.fill(x, top, w, BASE - top, "shale")
    lit(cv, x + 2, x + w - 3, top + 3, BASE - 47, "dundas", 0.3, ("gold", "amber"), (3, 3))
    outline_box(cv, x, top, w, BASE - top + 1, "ink")
    sx, sw, sy = x + 4, w - 8, BASE - 47
    cv.fill(sx, sy, sw, 15, "coal")
    cv.fill(sx + 1, sy + 1, sw - 2, 13, "dlake")
    for k in range(sw - 2):
        cv.fill(sx + 1 + k, sy + 1 + (k * 7) % 13, 1, 1, "lake")
    word(cv, "WOOF!", x + w / 2, sy + 3, "gold")
    aw = (sw - 4) // 3
    for k, (back, bar) in enumerate((("ttc", "white"), ("turquoise", "cyan"), ("hot", "pink"))):
        ax = sx + k * (aw + 2)
        cv.fill(ax, BASE - 31, aw, 12, "coal")
        cv.fill(ax + 1, BASE - 30, aw - 2, 10, back)
        for j, y in enumerate(range(BASE - 28, BASE - 22, 2)):
            cv.fill(ax + 3, y, aw - 6 - 4 * (j % 2), 1, bar)


def street_level(cv, x, w, seed, sign=None):
    """A tower's street level, rows BASE - 18 to BASE: a coal front under an ash canopy edge, shop
    glass in 5-column bays, some lit gold and some dark, and over it a neon sign, (word, colour), on an
    ink board edged in its colour."""
    cv.fill(x, BASE - 18, w, 18, "coal")
    cv.fill(x, BASE - 18, w, 1, "ash")
    rnd = random.Random(f"street-{seed}")
    for bx in range(x + 2, x + w - 6, 6):
        on = rnd.random() < 0.6
        cv.fill(bx, BASE - 8, 5, 8, "gold" if on else "dlake")
        cv.fill(bx, BASE - 2, 5, 2, "amber" if on else "navy")
    if sign:
        s, col = sign
        bw = fonts.sign_width(s) + 4
        bx = round(x + w / 2 - bw / 2)
        cv.fill(bx, BASE - 17, bw, 9, "ink")
        outline_box(cv, bx, BASE - 17, bw, 9, col)
        word(cv, s, x + w / 2, BASE - 17, col)


YONGE_SKY = ("slate", "dslate", "purple", "mauve")


def yonge():
    cv = sn.Canvas(W, H)
    # an evening sky, slate down to dslate and purple, a mauve city glow at the horizon, a full moon
    # and a few stars
    sunset(cv, YONGE_SKY, BASE)
    for x, y in ((8, 6), (62, 2), (108, 9), (150, 4), (196, 11), (232, 3), (288, 22), (318, 4), (352, 12)):
        cv.fill(x, y, 1, 1, "white")
    full_moon(cv, 304, 14, 5)
    # downtown is a wall of towers filling most of the sky, the only sky left in the gaps and over the
    # top: unlike the other backdrops it rises above row 45, under the debuff bars' and the message
    # strip's opaque plates. Far back, dark towers in navy and dslate with a few windows lit
    skyline(cv, ((-2, 16, 30, "navy"), (44, 20, 22, "dslate"), (66, 18, 36, "navy"), (114, 22, 26, "navy"),
                 (150, 18, 16, "dslate"), (170, 20, 34, "navy"), (196, 16, 24, "dslate"), (214, 14, 12, "navy"),
                 (228, 18, 30, "navy"),
                 (268, 16, 40, "dslate"), (300, 18, 30, "navy"), (322, 16, 24, "dslate"), (342, 20, 38, "navy")))
    for cx, top, h in ((52, 22, 9), (122, 26, 7), (156, 16, 8), (178, 34, 6), (220, 12, 6), (348, 38, 8)):
        mast(cv, cx, top - h, h)
    # behind the SkyDome, lit towers and, far off in a lighter haze, the CN Tower, the tallest thing on
    # the skyline, its slender shaft rising from behind the dome's left flank; a low dark block between
    # the shaft and the dome keeps the two light shapes apart; then the SkyDome, large, in front
    glass_tower(cv, 14, 30, 40, 7)
    scotia(cv, 76, 24, 28)
    dominion(cv, 102, 22, 44, 5)
    glass_tower(cv, 126, 22, 34, 8, "dslate")
    cn_tower(cv, 61, BASE, 0)
    cv.fill(48, 71, 26, BASE - 71, "coal")
    outline_box(cv, 48, 71, 26, BASE - 70, "ink")
    cv.fill(49, 72, 24, 1, "ash")
    lit(cv, 51, 72, 74, 80, "dome-block", 0.45, ("amber", "ochre"), (3, 3))
    skydome(cv, 44, 94, BASE - 26, 20)
    # the nearer towers: dark glass on the left and up to the SkyDome's lower half; then, down to
    # the street, the Yonge-Dundas screens, the Royal Bank Plaza's gold pair, First Canadian Place, the TD
    # Centre's black pair and glass, each with neon over its street level
    glass_tower(cv, -4, 18, 24, 4)
    glass_tower(cv, 44, 30, BASE - 30, 5, "dslate")
    glass_tower(cv, 74, 14, BASE - 40, 6)
    dominion(cv, 88, 38, BASE - 28, 4)
    glass_tower(cv, 126, 26, BASE - 34, 1)
    screens(cv, CX - 28, 56, 48)
    royal_bank(cv, 210, 20, 36)
    royal_bank(cv, 230, 14, 58)
    first_canadian(cv, 246, 22, 14)
    dominion(cv, 270, 34, 30, 1)
    dominion(cv, 306, 24, 48, 2)
    glass_tower(cv, 332, 32, 34, 3)
    for k, (x, w, sign) in enumerate(((-4, 18, None), (14, 30, None), (44, 30, None), (74, 14, None),
                                      (88, 38, ("SHOES", "pink")), (126, 26, ("EAT", "gold")),
                                      (CX - 28, 56, ("MUSIC", "turquoise")), (210, 20, None), (230, 14, None),
                                      (246, 22, None), (270, 34, ("BOOKS", "lilac")), (306, 24, None),
                                      (332, 32, None))):
        street_level(cv, x, w, k, sign)
    # the subway entrance sign
    sx = 64
    cv.fill(sx, BASE - 4, 2, FAR_WALK - BASE + 4, "coal")
    cv.fill(sx - 9, BASE - 14, 20, 12, "coal")
    cv.fill(sx - 8, BASE - 13, 18, 10, "ttc")
    word(cv, "TTC", sx + 1, BASE - 12, "white")

    def paving(px, py):
        return "shale" if hashed(px, py, 67) else "dstone"

    yard(cv, BASE, FAR_WALK, paving)

    def road(x, z, span, px, py):
        if abs(x) >= ROAD - 5:
            return "dstone"
        if span < 6 and crosses(z, span, 32):
            return "coal"
        return "ash" if hashed(px, py, 41) else "shale"

    cross(cv, flat(road), "dstone", paving, curb="stone")
    cross_line(cv, "amber", "coal", dash=(14, 32))
    street(cv, toronto_verge("yonge-street", road))
    lanes(cv, "white", "coal", dash=(14, 32))
    return cv


ZONES = {
    "backdrop-cabbagetown": cabbagetown,
    "backdrop-high-park": high_park,
    "backdrop-distillery-district": distillery,
    "backdrop-kensington-market": kensington,
    "backdrop-the-beaches": beaches,
    "backdrop-yonge-street": yonge,
}


def camera():
    """Print the camera, the bottom row's join with the road and the sidewalks, in band pixels."""
    def column(x, py):
        return CX + x * scale(py + 0.5)

    print(f"camera: yH {YH}, footY {FOOT}, r {KS / F:.4f}, f {F:.1f}, centre x {CX}; "
          f"{VISIBLE:.1f} road px in view below the band, scale {S0:.4f} on row {H - 1}")
    road = [px for px in range(W) if abs(px + 0.5 - CX) < ROAD * S0]
    lines = [round(CX + d * S0 - 0.5) for d in DIVIDERS]
    print(f"row {H - 1}: road columns {road[0]}..{road[-1]}, lane dividers {lines}")
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
    elif len(sys.argv) == 2 and sys.argv[1] == "camera":
        camera()
    elif sys.argv[1:] == ["verges"]:
        print(json.dumps(TORONTO_VERGES, indent=2))
    elif sys.argv[1:] == ["verges", "--write"]:
        write_verges()
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
        write_verges()
    else:
        sys.exit(__doc__)
