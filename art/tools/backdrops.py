#!/usr/bin/env python3
"""Draw the zone backdrops: the neighbourhood band between the top bar and the road.

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
  backdrops.py verges [--write]  print the verges (VERGES) as JSON, or write
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
import roadside  # noqa: E402
import scene as sn  # noqa: E402
from pixel import K, MURAL, dk  # noqa: E402
from roads import LANE_PAINT  # noqa: E402

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
CX = CAMERA["centreX"]         # the road's centre column, and its vanishing point's
YH, FOOT, F = CAMERA["horizonY"], CAMERA["footY"], CAMERA["focal"]


def word(cv, s, mid, y, col, scale=1):
    """Sign lettering: the logo's letters at scale in col, a 1px ink outline and a dred shadow
    (fonts.sign), 8 rows at 1x from the outline's top on row y to the shadow, centred on column mid
    without the shadow."""
    px, _ = fonts.sign(s, scale, col)
    x = round(mid - fonts.sign_width(s, scale) / 2)
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


def roofline(cv, base, roofs, col):
    """Far houses as one silhouette of col standing on row base: (x, w, wall rows) each under a steep
    gable that narrows a column a side per row, half as tall as the house is wide."""
    for x, w, wall_h in roofs:
        cv.fill(x, base - wall_h, w, wall_h, col)
        for k in range(w // 2 + 1):
            cv.fill(x - 1 + k, base - wall_h - 1 - k, w + 2 - 2 * k, 1, col)


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
# SLIM is the slim house's windows and door: tall windows either side of the door.
SLIM = (4, 8, 10, 13)
# The lit left edge of a roof, a ramp step lighter than the roof.
RAKE = dict(slate="grey", dslate="slate", navy="dslate", purple="mauve", plum="purple", dred="red", brown="tan")


def house(cv, x, w, wall, roof, door="dred", top=40, base=104, roof_h=26, parts=HOUSE, curtains=None,
          eave=3, rake=None, dormer=False, glass="cyan"):
    """A house facing the camera, standing on row base: a gable roof roof_h rows tall from top, its eaves eave
    pixels past the walls. curtains, a colour, draws the windows' curtains closed, lamplight in the gap between
    them; glass is the windows' colour otherwise. rake, a colour, lights the roof's left edge, which faces the
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
        wide = 1 if k == 4 else 0
        cv.fill(cx - 1 - k - wide, top + k, 2 + 2 * k + 2 * wide, 1, roof if k < 4 else dk(roof))
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
# Cabbagetown's verge (VERGES)
ROAD = LAYOUT["regions"]["road"]["width"] // 2
CURB, WALK = 164, 208
DIVIDERS = tuple(x - CX for x in LAYOUT["lanes"]["dividers"])   # lane divider lines, from the road's centre
# The cross street, in band rows from the far side down: the far sidewalk, the far curb, the
# road, the near curb and the near sidewalk, which the street's stub (rows STUB to the bottom)
# opens into. These rows are drawn flat rather than to the projection, which would spread the
# cross street over most of the band; across, they keep the projection's scale per row, so
# lines along the street (curbs, slab seams) still lean toward the road's centre line.
# The stub is the band's part of the approach region. The near curb and sidewalk are the junction
# region's rows above it, where the game's road raster starts, drawing only the road surface between
# the near corners, so the corners stay the backdrop's.
STUB = LAYOUT["regions"]["approach"]["y"] - BAR
NEAR_CURB = LAYOUT["regions"]["junction"]["y"] - BAR
FAR_WALK, FAR_CURB, CROSS = STUB - 20, STUB - 16, STUB - 14
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


def at(x, z):
    """Band position of the ground point x across, z along, and its scale."""
    s = F / (F + z)
    return CX + x * s, YH + KS * s - BAR, s


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
    """The stub's lane dividers, 1px wide; dashes stop where a row spans too much road. mark and edge
    are a colour, or a tuple of one per divider, left to right."""
    marks = mark if isinstance(mark, tuple) else (mark,) * len(DIVIDERS)
    edges = edge if isinstance(edge, tuple) else (edge,) * len(DIVIDERS)
    for py in range(STUB, H):
        s = scale(py + 0.5)
        z, z1 = F / s - F, F / scale(py + 1.5) - F
        if z - z1 > span or (dash and z % dash[1] >= dash[0]):
            continue
        for d, m, e in zip(DIVIDERS, marks, edges):
            x = round(CX + d * s - 0.5)
            cv.fill(x, py, 1, 1, m)
            if e:
                cv.fill(x + 1, py, 1, 1, e)


def corner_depth(px, py):
    """How far pixel px, py lies inside a near corner, in pixels, or below 0 on the road. The
    corners are the blocks either side of the stub, below the cross street, rounded where the
    stub's curb turns into the near curb."""
    dx = abs(px + 0.5 - CX) - ROAD * scale(py + 0.5)
    dy = py + 0.5 - NEAR_CURB
    if dx < CORNER and dy < CORNER:
        return CORNER - math.hypot(CORNER - dx, CORNER - dy)
    return min(dx, dy)


def slabs(px, py):
    """Cabbagetown's cross street sidewalk, plain stone without seams, as its verge's."""
    return "stone"


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
                d = corner_depth(px, py)
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
              parts=SLIM, eave=2, rake=RAKE.get(roof), dormer=dormer)
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


def bunting(cv, x0, x1, y, sag, cols, line="plum", every=7):
    """A string of pennants hung from x0 to x1 on row y, sagging sag rows in the middle, one every
    every columns."""
    k = 0
    for x in range(x0, x1):
        t = (x - x0) / max(1, x1 - x0 - 1)
        yy = round(y + sag * 4 * t * (1 - t))
        cv.fill(x, yy, 1, 1, line)
        if (x - x0) % every == 1 and x + 5 <= x1:
            for r in range(4):
                cv.fill(x + r // 2, yy + 1 + r, 5 - r // 2 * 2, 1, cols[k % len(cols)])
            k += 1


def outline_box(cv, x, y, w, h, col):
    cv.fill(x, y, w, 1, col)
    cv.fill(x, y + h - 1, w, 1, col)
    cv.fill(x, y, 1, h, col)
    cv.fill(x + w - 1, y, 1, h, col)


def shopfront(cv, x, w, top, base, wall_c, awn, sign, board, letters, line="plum", glass="cyan", stripe="white"):
    """A shopfront facing the camera, rows top to base, drawn as a toy box: flat colour blocks inside a 1px
    line, a shaded top and right side, a sign board in the sign letters, an awning striped awn and stripe,
    the shop window in glass and the door."""
    cv.fill(x, top, w, base - top, wall_c)
    cv.fill(x + w - 3, top, 3, base - top, dk(wall_c))
    cv.fill(x, top, w, 3, dk(wall_c))
    outline_box(cv, x, top, w, base - top + 1, line)
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


# ---------- the six neighbourhoods ----------
# The six Toronto neighbourhoods, sharing the cross street. Their
# darkness ranges from the open sand of The Beaches to Yonge Street's evening and Kensington
# Market's Pedestrian Sunday at twilight, and each has its own sky.

# A pool of light on a verge (its pools): the light def keyed light (shared/lights.json), centred across from
# the road's centre line, repeating every road px along each side from its offset there, counted from the
# zone's start strip as the roadside slots are; every is a whole number of the road's 32 px joints. zones,
# when given, lists the zone ids it shows in. The game draws it (src/road/lightPlaces.ts); the stub rows
# paint none, since the light layer draws over the backdrop's approach.
def pool(light, across, every, left, right, zones=None):
    p = {"light": light, "across": across, "every": every, "offset": {"left": left, "right": right}}
    if zones is not None:
        p["zones"] = list(zones)
    return p


def prop_slots(zone, key):
    """Where a zone's roadside props named key stand along one period of its placement (roadside.PLACEMENT),
    as (period, left zs, right zs), z from the zone's start as the game places them."""
    table = roadside.PLACEMENT[zone]
    period = table["slot"] * 2 * math.lcm(len(table["gaps"]), len(table["lots"]))
    zs = {}
    for name, side in table["sides"].items():
        zs[name] = []
        for n in range(period // table["slot"]):
            m = n - side["offset"]
            k = m // 2
            groups, start, stride = (("lots", "lotStart", "lotStride") if m % 2 == 0
                                     else ("gaps", "gapStart", "gapStride"))
            group = table[groups][(side[start] + k * side[stride]) % len(table[groups])]
            zs[name] += [(n * table["slot"] + dz) % period for k_, _, dz in group if k_ == f"roadside-{key}"]
        zs[name].sort()
    return period, zs["left"], zs["right"]


def under_lamps(zone, light):
    """A light under each of a zone's street lamps, at the lamps' across, one entry per lamp of a period of its
    placement (each entry's every that period), pairing the sides' lamps in order."""
    period, left, right = prop_slots(zone, "street-lamp")
    across = next(p for g in roadside.PLACEMENT[zone]["gaps"] for p in g if p[0] == "roadside-street-lamp")[1]
    return [pool(light, across, period, lz, rz) for lz, rz in zip(left, right)]


def between_lamps(zone, lights, across, gap=560):
    """Lights midway between a zone's street lamps where they stand gap road px or more apart on a side, one
    entry per light in turn, pairing the sides' wide gaps in order."""
    period, left, right = prop_slots(zone, "street-lamp")

    def middles(zs):
        return [round((z + (zs[(i + 1) % len(zs)] - z) % period / 2) % period / 2) * 2
                for i, z in enumerate(zs) if (zs[(i + 1) % len(zs)] - z) % period >= gap]
    return [pool(light, across, period, lz, rz) for light, lz, rz in zip(lights, middles(left), middles(right))]


# The game's verge beside each road, keyed by art id, with colours
# by K name (shared/verges.json):
# the curb to curbTo, the strips (each to its to), the sidewalk or paving with a seam every
# seamEvery to walkTo (None: paving on out, with no lawn), then the lawn, mown or rough. lawnColours
# are the lawn's base, its mown stripes and rough patches, and its 2-row tufts, which draw their own
# colour rather than darkening the pixel under them; None where there is no lawn. walkDots are single
# pixels that shimmer as the road scrolls, so together they cover 6% or less of the paving. pools, where
# a verge has them, are lights the game draws along it (pool).
VERGES = {
    "cabbagetown": dict(curbColour="dstone", curbTo=CURB, strips=[], walkColour="stone", walkDots=[],
                        seamColour="dstone", seamEvery=32, walkTo=WALK, lawn="mown",
                        lawnColours=("olive", "dolive", "pine"), leaves=False),
    "high-park": dict(curbColour="pine", curbTo=160, strips=[], walkColour="pine", walkDots=[],
                      seamColour="pine", seamEvery=32, walkTo=160, lawn="rough",
                      lawnColours=("pine", "bark", "fir"), leaves=False),
    "distillery-district": dict(curbColour="dstone", curbTo=164, strips=[], walkColour="brown",
                                walkDots=[dict(colours=["brick"], share=0.036), dict(colours=["dbrown"], share=0.015),
                                          dict(colours=["rust"], share=0.008)],
                                seamColour="dbrown", seamEvery=32, walkTo=None, lawn="none",
                                lawnColours=None, leaves=False),
    "kensington-market": dict(curbColour="stone", curbTo=162, strips=[dict(colour="mauve", dots=[], to=166)],
                              walkColour="grey",
                              walkDots=[dict(colours=["lgrey"], share=0.01), dict(colours=["slate"], share=0.012),
                                        dict(colours=["pink", "lime", "lilac", "cyan"], share=0.016)],
                              seamColour="slate", seamEvery=32, walkTo=None, lawn="none",
                              lawnColours=None, leaves=False),
    "the-beaches": dict(curbColour="clay", curbTo=164, strips=[], walkColour="driftwood",
                        walkDots=[dict(colours=["stone"], share=0.025)],
                        seamColour="driftwood", seamEvery=32, walkTo=None, lawn="none",
                        lawnColours=None, leaves=False),
    "yonge-street": dict(curbColour="grey", curbTo=164, strips=[], walkColour="dslate",
                         walkDots=[dict(colours=["slate"], share=0.012)], seamColour="navy", seamEvery=32,
                         walkTo=None, lawn="none", lawnColours=None, leaves=False,
                         pools=under_lamps("yonge-street", "street-lamp-pool")
                         + between_lamps("yonge-street", ("neon-mauve", "neon-azure"), 209)),
}


def dotted(dots, value):
    """The dot colour a noise value in [0, 1) picks, or None: each dot takes its share of the range in
    turn, its colours equal parts of that share (as the game's verge dots)."""
    for d in dots:
        if value < d["share"]:
            return d["colours"][math.floor(value / d["share"] * len(d["colours"]))]
        value -= d["share"]
    return None


def verge_paving(zone):
    """A painter for the far side's ground and the cross street's corners, paved as the zone's verge
    (VERGES): its sidewalk or paving colour with its dots."""
    v = VERGES[zone]

    def paint(px, py):
        return dotted(v["walkDots"], noise(px, py)) or v["walkColour"]
    return paint


def verge(zone, road, patches=()):
    """A stub painter for a Toronto neighbourhood: road(x, z, span, px, py) inside the road, then its
    verge (VERGES), with rough patches as world (x, z, rx, rz) ellipses."""
    v = VERGES[zone]
    walk_to = 10 ** 6 if v["walkTo"] is None else v["walkTo"]

    def ground(x, z, span):
        a = abs(x)
        if a < v["curbTo"]:
            return v["curbColour"]
        for strip in v["strips"]:
            if a < strip["to"]:
                return dotted(strip["dots"], noise(math.floor(x), math.floor(z))) or strip["colour"]
        if span < 16 and crosses(z, span, v["seamEvery"]):
            return v["seamColour"]
        return dotted(v["walkDots"], noise(math.floor(x), math.floor(z))) or v["walkColour"]

    def paint(x, z, span, px, py):
        a = abs(x)
        if a < ROAD:
            return road(x, z, span, px, py)
        if a < walk_to:
            return ground(x, z, span)
        lawn, dark, tufted = v["lawnColours"]
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
    """Write VERGES to VERGES_JSON, keyed by art id, colours by K name, for the game."""
    with open(VERGES_JSON, "w") as f:
        f.write(json.dumps(VERGES, indent=2) + "\n")


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
    house(cv, x, w, wall, roof, door, top=top, base=base, roof_h=roof_h, parts=SLIM, eave=2,
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
    # the old neighbourhood behind: brick roofs up a leafy rise, the Necropolis chapel's spire
    hills(cv, BASE - 40, BASE, "canopy", "olive", 3.1, 6)
    roofline(cv, BASE - 28, ((10, 16, 8), (40, 14, 6), (150, 16, 8), (212, 16, 9), (258, 16, 7),
                             (282, 14, 9), (326, 18, 8)), "dbrick")
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
    lawn = grass("olive")
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
    cross(cv, flat(road), "stone", slabs, curb="dstone", bend=crescent_bend)
    cross_line(cv, "white", dash=(8, 64), bend=crescent_bend)
    street(cv, verge("cabbagetown", road))
    lanes(cv, "white", "slate", dash=(12, 64))
    return cv


def cherry(cv, cx, cy, r, base):
    """A cherry tree in blossom on row base: a dark trunk under a wide crown of pink lobes, mauve on the
    lower right, white petals picked out on the lit upper left."""
    cv.fill(cx - 1, cy, 2, base - cy, "dbrown")
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

    def dirt(px, py, worn=False):
        """The trail's packed earth: tan, flecked brown and skin2, skin1 where feet wear it."""
        if hashed(px, py, 31):
            return "brown"
        if hashed(px, py + 5, 37):
            return "skin2"
        return "skin1" if worn else "tan"

    def trail(x, z, span, px, py):
        a = abs(x)
        if a >= ROAD - 5:
            return "pine"
        if a >= ROAD - 6:
            return "brown"
        lane = (x + ROAD) % 64 - 32
        return dirt(px, py, abs(lane) < 5 and noise(px // 3, py // 2) < 0.7)

    # the trail on to the gate, its worn middle drifting, ragged brown edges
    for py in range(BASE - 8, CROSS):
        half = 18 + (py - BASE + 8) // 3 + (1 if hashed(0, py, 3) else 0)
        cv.fill(CX - half, py, 2 * half, 1, "brown")
        for px in range(CX - half + 1, CX + half - 1):
            cv.fill(px, py, 1, 1, dirt(px, py, abs(px + 0.5 - CX - (py % 7 > 3)) < 6 + (py - BASE) // 4))
    # the cross path, packed earth with no line painted on it: a skin1 strip worn along its middle,
    # broken where the grass edges hold
    cross(cv, lambda px, py: "tan", "brown", lawn, curb=None, top=CROSS)
    for px in range(W):
        if noise(px // 6, 3) < 0.75:
            cv.fill(px, LINE - 1, 1, 2, "skin1")
        if hashed(px, LINE + 2, 9):
            cv.fill(px, LINE + 2 + (px % 3 == 0), 1, 1, "skin2")
    # grass tufts break the path's edges
    for py in range(CROSS, STUB):
        for px in range(W):
            if cv.img.getpixel((px, py)) == sn.rgb("brown") and hashed(px, py, 4):
                cv.fill(px, py, 1, 1, "pine")
    rough_patches = rough("high-park-lawn", 10, ROAD + 30, ROAD + 460, Z0 + 10, Z0 + 90)
    street(cv, verge("high-park", trail, rough_patches))
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


def chimney(cv, x, top, w=10):
    """The Boiler House's brick chimney stack standing on row BASE: its right 3 columns in shade, a dbrick
    cap and a band below it."""
    cv.fill(x, top, w, BASE - top, "brick")
    cv.fill(x + w - 3, top, 3, BASE - top, "dbrick")
    cv.fill(x - 1, top - 1, w + 2, 2, "dbrick")
    cv.fill(x - 1, top + 6, w + 2, 1, "dbrick")


def water_tower(cv, tx, low):
    """A bark wooden water tank on two dstone legs whose feet stand on row low, under a stepped walnut cap."""
    for lx in (tx - 6, tx + 5):
        cv.fill(lx, low - 16, 2, 16, "dstone")
    cv.fill(tx - 9, low - 28, 20, 12, "bark")
    cv.fill(tx + 7, low - 28, 4, 12, "walnut")
    for k in range(4):
        cv.fill(tx - 7 + 2 * k, low - 29 - k, 16 - 4 * k, 1, "walnut")


def sign_board(cv, mid, y, text, board, letters):
    """A sign board centred on column mid from row y: a coal frame round a board of 9 rows, the text in sign
    lettering."""
    w = fonts.sign_width(text) + 8
    x = round(mid - w / 2)
    cv.fill(x - 1, y - 1, w + 2, 11, "coal")
    cv.fill(x, y, w, 9, board)
    word(cv, text, mid, y + 1, letters)


# The paintings hung in a gallery's windows: (sky or ground, lower field, a spot of colour).
PAINTINGS = (("azure", "moss", "red"), ("mauve", "peach", "gold"), ("teal", "lilac", "white"),
             ("ochre", "dturq", "cream"))


def painting(cv, x, y, w, h, scheme):
    """A painting in a gold frame shaded ochre on its right and bottom: two fields and a spot of colour."""
    a, b, c = scheme
    cv.fill(x, y, w, h, "gold")
    cv.fill(x + w - 1, y, 1, h, "ochre")
    cv.fill(x, y + h - 1, w, 1, "ochre")
    cv.fill(x + 1, y + 1, w - 2, h - 2, a)
    cv.fill(x + 1, y + 1 + (h - 2) // 2, w - 2, h - 2 - (h - 2) // 2, b)
    cv.fill(x + 1 + (w - 2) // 2, y + 2, 2, 2, c)


def gallery(cv, x, w, top, base, wall="brick"):
    """A brick warehouse whose ground floor is an art gallery: two tall coal-framed shop windows lit skin1,
    framed paintings hung in them, a GALLERY board over a dturq door between them, the upper floor's arched
    windows above."""
    warehouse(cv, x, w, top, base, wall, "stone", "skin1", rows=1)
    gy = base - 26
    cv.fill(x + 2, gy - 1, w - 6, 1, "stone")
    sign_board(cv, x + w / 2, gy - 10, "GALLERY", "walnut", "cream")
    ww = (w - 26) // 2
    k = 0
    for wx in (x + 4, x + w - 7 - ww):
        cv.fill(wx, gy + 2, ww, 22, "coal")
        cv.fill(wx + 1, gy, ww - 2, 2, "coal")
        cv.fill(wx + 1, gy + 2, ww - 2, 21, "cream")
        cv.fill(wx + 2, gy + 1, ww - 4, 1, "cream")
        for px in range(wx + 3, wx + ww - 8, 10):
            painting(cv, px, gy + 6, 7, 9, PAINTINGS[k % len(PAINTINGS)])
            k += 1
        cv.fill(wx + 1, gy + 18, ww - 2, 1, "dstone")
    dx = x + w // 2 - 6
    cv.fill(dx, base - 18, 9, 18, "coal")
    cv.fill(dx + 1, base - 17, 7, 17, "dturq")
    cv.fill(dx + 4, base - 17, 1, 17, "coal")


def theatre(cv, x, w, top, base, wall="dbrick"):
    """The Young Centre, a tank house turned theatre: dark brick with two rows of arched windows, its ground
    floor a glazed lobby lit gold with theatregoers' silhouettes inside, and a marquee over the doors, its
    THEATRE board in gold letters edged with yellow bulbs."""
    warehouse(cv, x, w, top, base, wall, "stone", "gold", rows=2)
    ly = base - 20
    cv.fill(x + 3, ly, w - 6, 20, "coal")
    cv.fill(x + 4, ly + 1, w - 8, 19, "gold")
    for mx in range(x + 13, x + w - 6, 10):
        cv.fill(mx, ly + 1, 1, 19, "coal")
    rnd = random.Random("theater-lobby")
    for px in range(x + 8, x + w - 10, 13):
        h = rnd.choice((7, 8, 9))
        cv.fill(px, base - h, 4, h, "dbrown")
        cv.fill(px + 1, base - h - 3, 2, 3, "dbrown")
    mw = min(w - 10, 70)
    mx0, my = x + (w - mw) // 2, ly - 12
    cv.fill(mx0 - 2, my + 10, mw + 4, 3, "coal")
    cv.fill(mx0, my, mw, 10, "coal")
    cv.fill(mx0 + 1, my + 1, mw - 2, 8, "dbrick")
    word(cv, "THEATRE", mx0 + mw / 2, my + 1, "gold")
    for bx in range(mx0, mx0 + mw, 3):
        cv.fill(bx, my - 1, 1, 1, "yellow")
        cv.fill(bx + 1, my + 10, 1, 1, "yellow")


def cafe_umbrella(cv, cx, base, col, trim, top=16):
    """A café's market umbrella on a cream pole from row base: a canopy of col widening to 21 columns over
    4 rows, its eave a ramp step darker with a valance dotted in trim, and a finial."""
    cv.fill(cx, base - top, 1, top, "cream")
    cv.fill(cx, base - top - 6, 1, 2, "cream")
    for k, (dx, w) in enumerate(((-4, 9), (-7, 15), (-9, 19), (-10, 21))):
        cv.fill(cx + dx, base - top - 4 + k, w, 1, col)
    cv.fill(cx - 10, base - top, 21, 2, dk(col))
    for vx in range(cx - 10, cx + 11, 4):
        cv.fill(vx, base - top + 2, 2, 1, trim)


def bistro_set(cv, cx, base):
    """A round bistro table with a red flower and a cream cup, and a chair either side, in coal iron on
    row base."""
    cv.fill(cx - 4, base - 6, 9, 1, "lgrey")
    cv.fill(cx, base - 5, 1, 5, "coal")
    cv.fill(cx - 2, base - 1, 5, 1, "coal")
    for sx, seat in ((cx - 8, cx - 7), (cx + 7, cx + 5)):
        cv.fill(sx, base - 8, 1, 8, "coal")
        cv.fill(seat, base - 4, 2, 1, "coal")
        cv.fill(seat, base - 3, 1, 3, "coal")
    cv.fill(cx - 2, base - 8, 2, 2, "red")
    cv.fill(cx + 1, base - 7, 1, 1, "cream")


def bistro_patio(cv, x0, x1, base, cols):
    """A restaurant patio from column x0 to x1 on row base: bistro sets under umbrellas every 26 columns,
    their canopies alternating the two cols, behind a low coal rail with a geranium planter at each end."""
    for k, cx in enumerate(range(x0 + 12, x1 - 8, 26)):
        col, trim = cols if k % 2 == 0 else cols[::-1]
        cafe_umbrella(cv, cx, base, col, trim)
        bistro_set(cv, cx, base)
    cv.fill(x0, base - 5, x1 - x0, 1, "coal")
    for px in range(x0, x1, 4):
        cv.fill(px, base - 5, 1, 5, "coal")
    for px in (x0, x1 - 6):
        cv.fill(px, base - 6, 6, 6, "bark")
        cv.fill(px + 4, base - 6, 2, 6, "walnut")
        for gx in range(px, px + 6, 2):
            cv.fill(gx, base - 8, 2, 2, "canopy")
        cv.fill(px + 2, base - 9, 1, 1, "pink")


# Still Dancing's loops of track, from the top: (rows below the cupola, radius, colour, tilt).
DANCING_LOOPS = ((6, 9, "red", 0.35), (18, 11, "turquoise", -0.3), (31, 10, "lilac", 0.25),
                 (43, 8, "cream", -0.2))


def still_dancing(cv, cx, base, top):
    """Still Dancing, Dennis Oppenheim's sculpture in the square, standing on row base: a coal mast on a
    tripod, lit ash on its left, ringed by four tilted loops of coloured track, their far halves a ramp step
    darker behind it, under a gold cupola on row top."""
    for fx in (-10, 0, 10):
        cv.line(cx + fx, base, cx, base - 22, "coal")

    def loops(near):
        for dy, r, col, tilt in DANCING_LOOPS:
            for a in range(0, 360, 2):
                t = math.radians(a)
                if (math.sin(t) > 0) != near:
                    continue
                x = cx + r * math.cos(t)
                y = top + 4 + dy + r * (0.32 * math.sin(t) + tilt * math.cos(t))
                cv.fill(round(x), round(y), 1, 2, col if near else dk(col))
    loops(False)
    cv.fill(cx - 1, top + 3, 3, base - 25 - top, "coal")
    cv.fill(cx - 1, top + 3, 1, base - 25 - top, "ash")
    loops(True)
    cv.fill(cx - 3, top - 1, 7, 4, "gold")
    cv.fill(cx + 2, top - 1, 2, 4, "ochre")
    cv.fill(cx - 1, top - 3, 3, 2, "gold")


# The LOVE sign's heart, beside its letters.
LOVE_HEART = (".##.##.", "#######", "#######", ".#####.", "..###..", "...#...")


def love_sign(cv, cx, base):
    """The LOVE sign standing on row base, centred on column cx: a ttc heart and the red letters LOVE on a
    coal rail on two posts, padlocks hung along the rail."""
    w = fonts.sign_width("LOVE") + 12
    x0, top = round(cx - w / 2), base - 17
    cv.fill(x0, top + 9, w, 2, "coal")
    for px in (x0 + 1, x0 + w - 3):
        cv.fill(px, top + 9, 2, base - top - 9, "coal")
    for j, row in enumerate(LOVE_HEART):
        for i, ch in enumerate(row):
            if ch == "#":
                cv.fill(x0 + i, top + 1 + j, 1, 1, "ttc")
    word(cv, "LOVE", x0 + 9 + fonts.sign_width("LOVE") / 2, top, "red")
    for k, px in enumerate(range(x0 + 2, x0 + w - 2, 3)):
        cv.fill(px, top + 11, 1, 2, ("gold", "lgrey", "amber", "turquoise")[k % 4])


def strollers(cv, spots, base, seed):
    """Far passers-by on row base, one at each column in spots: 3 columns wide and 10 rows tall, coal legs,
    a top of a mixed colour shaded on its right column, a face and hair."""
    rnd = random.Random(seed)
    for x in spots:
        top = rnd.choice(("dred", "teal", "cream", "mauve", "navy", "ochre", "forest"))
        cv.fill(x, base - 3, 1, 3, "coal")
        cv.fill(x + 2, base - 3, 1, 3, "coal")
        cv.fill(x, base - 7, 3, 4, top)
        cv.fill(x + 2, base - 7, 1, 4, dk(top))
        cv.fill(x, base - 9, 3, 2, rnd.choice(("skin1", "skin2", "brown")))
        cv.fill(x, base - 10, 3, 1, rnd.choice(("walnut", "dbrown", "ochre", "coal")))


# The golden-hour sky's bands, from the top, down to the square's roof.
DISTILLERY_SKY = ("peach", "orange", "amber")


def distillery():
    cv = sn.Canvas(W, H)
    # Trinity Square at golden hour: bands of peach, orange and amber, the striped sun low over the
    # square's far side, gulls
    sunset(cv, DISTILLERY_SKY, BASE - 36)
    sun(cv, CX + 4, BASE - 49, 12, "yellow", BASE - 37)
    birds(cv, ((48, BASE - 62), (62, BASE - 58), (296, BASE - 64)))
    chimney(cv, CX - 120, BASE - 66)
    water_tower(cv, CX + 140, BASE - 30)
    # round the square: the gallery and an old limestone mill on the left, the long low warehouse across
    # it under the DISTILLERY sign, the theatre and another warehouse on the right
    gallery(cv, -10, 80, BASE - 44, BASE)
    warehouse(cv, 70, 56, BASE - 36, BASE, "driftwood", "dstone")
    warehouse(cv, CX - 54, 108, BASE - 36, BASE, "brick", "stone", rows=0)
    sign_board(cv, CX, BASE - 30, "DISTILLERY", "dbrick", "cream")
    theatre(cv, CX + 54, 80, BASE - 50, BASE)
    warehouse(cv, CX + 134, 56, BASE - 40, BASE, "brick", "stone")
    # the square's paving, café tables under umbrellas, Still Dancing, the LOVE sign, lamps and passers-by
    def paving(px, py):
        return "brick" if hashed(px, py, 19) else "brown"

    yard(cv, BASE, FAR_WALK, paving)
    bistro_patio(cv, CX - 50, CX + 46, FAR_WALK - 1, ("cream", "forest"))
    still_dancing(cv, CX - 72, FAR_WALK - 1, CALM + 4)
    love_sign(cv, 104, FAR_WALK - 1)
    for x in (8, CX + 60, CX + 132):
        gas_lamp(cv, x, FAR_WALK - 1)
    strollers(cv, (40, 52, CX + 70, CX + 100, CX + 110, 330), FAR_WALK - 1, "distillery")

    def road(x, z, span, px, py):
        a = abs(x)
        if a >= ROAD - 4:
            return "brick"
        if span < 6 and crosses(z, span, 8):
            return "navy"
        return "slate" if hashed(px, py, 31) else "dslate"

    # the lane across is cobbled and car-free: dslate setts between brick gutters, with no curbs and no
    # centre line
    cross(cv, lambda px, py: "dslate", "brick", paving, curb=None)
    street(cv, verge("distillery-district", road))
    lanes(cv, "lgrey", "stone", dash=(22, 64))
    return cv


def market_house(cv, cx, w, wall, roof, awn, sign, board, letters, base=BASE, trim="gold"):
    """A Kensington house turned shop: a steep gable over a painted wall, its roof's left edge lit, a
    scalloped trim under the eaves, a shopfront under it, its glass lake and its awning striped cream."""
    x = cx - w // 2
    top = base - 58
    house(cv, x, w, wall, roof, "dbrown", top=top, base=base, roof_h=20, parts=(3, 8, 9, 0), eave=2, glass="lake",
          rake=RAKE.get(roof))
    for i in range(x - 1, x + w + 1, 3):
        cv.fill(i, top + 21, 2, 1, trim)
    shopfront(cv, x, w, base - 33, base, wall, awn, sign, board, letters, glass="lake", stripe="cream")


def mural(cv, x0, top, base, flip):
    """A laneway wall 16 wide, rows top to base, painted with a mural: diagonal bands of MURAL's paint a ramp
    step darker, so the walls at the band's edges sit behind the shopfronts, under a walnut coping, a dog's
    face looking out of them, the paint stopping short of the ground."""
    for py in range(top, base):
        for px in range(x0, x0 + 16):
            u = (px - x0) if not flip else (x0 + 15 - px)
            c = dk(MURAL[((u + py) // 5) % len(MURAL)]) if py < base - 4 else "coal"
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


def ring(cv, cx, cy, r, col):
    """A 1px circle of radius r round cx, cy."""
    for a in range(0, 360, 6):
        t = math.radians(a)
        cv.fill(round(cx + r * math.cos(t)), round(cy + r * math.sin(t)), 1, 1, col)


def bike(cv, x, base, frame="red", flip=False):
    """A bicycle side on, 15 wide and 9 tall, its wheels on row base: coal tires round ash hubs, a
    diamond frame, a saddle, and the handlebars at the front (right, or left when flipped)."""
    def at_x(dx):
        return x + (14 - dx if flip else dx)
    for wx in (2, 12):
        ring(cv, at_x(wx), base - 3, 3, "coal")
        cv.fill(at_x(wx), base - 3, 1, 1, "ash")
    for (x0, y0), (x1, y1) in (((2, 3), (6, 7)), ((6, 7), (11, 7)), ((6, 7), (7, 3)), ((7, 3), (2, 3)),
                               ((7, 3), (11, 7)), ((11, 7), (12, 3))):
        cv.line(at_x(x0), base - y0, at_x(x1), base - y1, frame)
    cv.fill(min(at_x(4), at_x(7)), base - 9, 4, 1, "coal")
    cv.fill(at_x(6), base - 8, 1, 1, "coal")
    cv.fill(at_x(11), base - 9, 1, 2, "coal")
    cv.fill(min(at_x(10), at_x(13)), base - 9, 3, 1, "coal")


def basket_bike(cv, x, base, frame, flip=False):
    """A bicycle with an ochre basket of flowers on its handlebars."""
    bike(cv, x, base, frame, flip)
    bx = x + (0 if flip else 11)
    cv.fill(bx, base - 11, 5, 3, "ochre")
    cv.fill(bx, base - 11, 5, 1, dk("ochre"))
    for k, c in enumerate(("pink", "yellow", "red")):
        cv.fill(bx + k * 2, base - 13 + (k % 2), 1, 2, c)


GARMENTS = ("red", "dturq", "gold", "lilac", "pink", "moss", "orange", "cream")


def clothes_rack(cv, x, w, base, first=0):
    """A vintage clothes rail out front, w wide: two coal posts and a rail 14 rows up, hung with shirts
    and dresses in GARMENTS from the first, each 3 wide on a hanger, every third a dress flaring at the
    hem, its right column in shade."""
    top = base - 14
    cv.fill(x, top, 1, 14, "coal")
    cv.fill(x + w - 1, top, 1, 14, "coal")
    cv.fill(x, top, w, 1, "coal")
    for k, gx in enumerate(range(x + 2, x + w - 4, 4), first):
        c = GARMENTS[k % len(GARMENTS)]
        n = 9 if k % 3 == 1 else 6
        cv.fill(gx + 1, top + 1, 1, 1, "ash")
        cv.fill(gx, top + 2, 3, n, c)
        cv.fill(gx + 2, top + 2, 1, n, dk(c))
        if k % 3 == 1:
            cv.fill(gx - 1, top + n, 5, 2, c)
            cv.fill(gx + 3, top + n, 1, 2, dk(c))


def crates(cv, x, base, fruit):
    """Produce on the sidewalk: two clay crates side by side and one stepped back on top, each heaped
    with fruit in turn, a white glint on the heap."""
    for tier, (y, n) in enumerate(((base - 5, 2), (base - 10, 1))):
        for i in range(n):
            cx = x + i * 13 + tier * 6
            cv.fill(cx, y, 12, 5, "clay")
            cv.fill(cx, y, 12, 1, "bark")
            cv.fill(cx + 11, y, 1, 5, "bark")
            for k in range(5):
                cv.fill(cx + 1 + k * 2, y - 2 + (k % 2), 2, 2, fruit[(i + tier) % len(fruit)])
            cv.fill(cx + 2, y - 2, 1, 1, "white")


def busker(cv, x, base):
    """A busker's pitch with no one at it, on row base: an amp and a guitar leaning on it beside its open
    case, below the shop's sign board."""
    cv.fill(x, base - 8, 8, 8, "coal")
    cv.fill(x + 1, base - 7, 6, 5, "ash")
    cv.fill(x + 3, base - 5, 2, 2, "coal")
    cv.fill(x + 1, base - 9, 6, 1, "coal")
    gx = x + 10
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            if (dx / 3.4) ** 2 + (dy / 3.4) ** 2 <= 1:
                cv.fill(gx + dx, base - 4 + dy, 1, 1, "ochre" if dx + dy < 2 else "brown")
    cv.fill(gx, base - 4, 1, 1, "walnut")
    cv.line(gx, base - 7, gx - 2, base - 17, "walnut")
    cv.fill(gx - 3, base - 18, 2, 2, "walnut")
    cv.fill(x + 15, base - 3, 12, 3, "walnut")
    cv.fill(x + 16, base - 2, 10, 1, "dred")


def patio(cv, cx, base, a, b):
    """A cafe table under an umbrella striped a and b, a chair each side, on row base."""
    umbrella(cv, cx, base, a, b)
    cv.fill(cx - 4, base - 5, 9, 1, "walnut")
    cv.fill(cx, base - 4, 1, 4, "walnut")
    for sx in (cx - 7, cx + 6):
        cv.fill(sx, base - 4, 2, 1, "walnut")
        cv.fill(sx, base - 3, 2, 3, "walnut")


def kensington():
    cv = sn.Canvas(W, H)
    # a Pedestrian Sunday at twilight: a sunburst of purple rays from the end of the street, flat violet
    # beyond its arc
    sunburst(cv, CX, BASE + 6, 7, "purple", "violet", FAR_WALK, r=(W * 0.65, BASE + 6 - CALM))
    # rooftops of the back lanes behind the houses
    roofline(cv, BASE - 34, ((24, 18, 10), (76, 16, 8), (228, 18, 9), (300, 16, 10)), "dbrick")
    # painted houses turned shops across the street
    for cx, w, wall_c, roof, awn, sign, board, letters in (
            (47, 56, "dturq", "navy", "dred", "FRUIT", "forest", "gold"),
            (CX - 69, 60, "violet", "plum", "ochre", "RECORDS", "navy", "gold"),
            (CX, 68, "ochre", "dbrick", "dturq", "VINTAGE", "purple", "cream"),
            (CX + 69, 60, "olive", "dolive", "red", "CHEESE", "dbrick", "gold"),
            (313, 56, "mauve", "plum", "lake", "TACOS", "coal", "cream")):
        market_house(cv, cx, w, wall_c, roof, awn, sign, board, letters)
    # pennants zig-zagging across the street between the house fronts, spaced out so the strings stay
    # quieter than the sign boards under them
    pennants = ("red", "gold", "dturq", "lilac", "lime", "orange")
    for i, (x0, x1, y) in enumerate(((0, 90, BASE - 44), (90, 180, BASE - 40), (180, 270, BASE - 44),
                                     (270, W, BASE - 40))):
        bunting(cv, x0, x1, y, 5, pennants[i:] + pennants[:i], every=12)

    ground = verge_paving("kensington-market")
    yard(cv, BASE, FAR_WALK, ground)
    # out front: produce, the Garden Car, a stall, a vintage rail, a busker's pitch, two bikes and a patio
    crates(cv, 4, FAR_WALK - 1, ("red", "lime", "orange"))
    garden_car(cv, 58, FAR_WALK - 1)
    umbrella(cv, CX - 64, FAR_WALK - 1, "gold", "dturq")
    clothes_rack(cv, CX - 28, 22, FAR_WALK - 1, first=5)
    busker(cv, CX + 6, FAR_WALK - 1)
    bike(cv, CX + 40, FAR_WALK - 1, "lilac")
    basket_bike(cv, CX + 56, FAR_WALK - 1, "lime", flip=True)
    patio(cv, CX + 96, FAR_WALK - 1, "red", "cream")
    # the laneway walls at both ends of the street, painted with murals
    for x0 in (0, W - 16):
        mural(cv, x0, BASE - 66, FAR_WALK, x0 > 0)

    def road(x, z, span, px, py):
        a = abs(x)
        if a >= ROAD - 4:
            return "clay"
        if a >= ROAD - 5:
            return "bark"
        if span < 4 and crosses(z, span, 32):
            return "plum"
        return "brick" if hashed(px, py, 61) else "dbrick"

    cross(cv, flat(road), "bark", ground, curb=VERGES["kensington-market"]["curbColour"])
    cross_line(cv, "gold", "dred", dash=(12, 64))
    street(cv, verge("kensington-market", road))
    lanes(cv, LANE_PAINT, tuple(dk(c) for c in LANE_PAINT), dash=(10, 32))
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


def shade_tree(cv, cx, cy, r, base, leaf, shade, lit, trunk="dbrown", girth=4):
    """A broad shade tree, a maple or an oak, on row base: a trunk under a crown of five round lobes
    about row cy, shade on the lower right and lit flecks on the upper left."""
    cv.fill(cx - girth // 2, cy, girth, base - cy, trunk)
    cv.fill(cx + girth // 2 - 1, cy, 1, base - cy, dk(trunk))
    lobes = ((cx - r * 0.8, cy + r * 0.25, r * 0.7), (cx + r * 0.8, cy + r * 0.25, r * 0.7),
             (cx - r * 0.3, cy - r * 0.45, r * 0.75), (cx + r * 0.35, cy - r * 0.35, r * 0.7),
             (cx, cy + r * 0.1, r * 0.8))
    for px in range(int(cx - 2 * r), int(cx + 2 * r + 1)):
        for py in range(int(cy - 2 * r), int(cy + r + 1)):
            d = min(((px + 0.5 - lx) ** 2 + (py + 0.5 - ly) ** 2) / lr ** 2 for lx, ly, lr in lobes)
            if d <= 1:
                t = (px - cx) + 1.4 * (py - cy)
                c = shade if t > r * 0.55 else lit if t < -r and hashed(px, py, 2) else leaf
                cv.fill(px, py, 1, 1, c)


def willow(cv, cx, cy, r, base, trunk="dbrown"):
    """A weeping willow on row base: a round crown on row cy whose streamers flare 2 columns past it
    and hang to ragged tips above the ground; olive, moss on the lit left, dolive on the right and in
    the gaps between streamers, lime along the crown's lit top."""
    cv.fill(cx - 2, cy, 4, base - cy, trunk)
    cv.fill(cx + 1, cy, 1, base - cy, dk(trunk))
    for px in range(cx - r - 2, cx + r + 3):
        dx = (px + 0.5 - cx) / r
        out = abs(px - cx) - r
        top = cy + 2 * out + 1 if out > 0 else cy - round(r * 0.75 * math.sqrt(max(0.0, 1 - dx * dx)))
        hem = base - 5 - round(7 * dx * dx) - (4 if px % 2 else 0) - round(3 * noise(px, 7))
        for py in range(top, hem):
            gap = py > cy + 2 and px % 3 == 2
            c = "dolive" if gap or dx > 0.6 else "moss" if dx + (py - cy) / (2 * r) < -0.35 else "olive"
            cv.fill(px, py, 1, 1, "lime" if py == top and dx < 0.3 and out <= 0 else c)


# Beach volleyball players side on, facing right: rows from the top down to the feet, h hair, s skin,
# t swimsuit. block and spike are jumps, drawn in the air.
PLAYER = dict(
    block=("...s.s", "...s.s", "..hhss", "..hss.", "..ttt.", "..tt..", "..tt..", "..tt..", "..s.s.",
           "..s.s.", ".s..s."),
    dig=("..hh..", "..hs..", ".ttt..", ".tttss", ".ttt.s", ".s..s.", "s...s."),
    ready=("..hh..", "..hs..", "..ss..", ".ttt..", ".ttts.", ".ttt.s", ".ttt..", ".s..s.", ".s..s.",
           "s...s."),
    spike=(".....s", "....s.", "..hhs.", "..hs..", ".ttt..", "sttt..", "..tt..", "..tt..", ".s..s.",
           "s...s.", "s....."),
)


def player(cv, x, base, pose, hair, skin, suit, flip=False, lift=0):
    """A beach volleyball player (PLAYER) from column x, feet on row base, or lift rows above it in a
    jump; flip faces left."""
    rows = PLAYER[pose]
    w = len(rows[0])
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch != ".":
                cv.fill(x + (w - 1 - dx if flip else dx), base - lift - len(rows) + 1 + dy, 1, 1,
                        dict(h=hair, s=skin, t=suit)[ch])


def net(cv, near, far, top=13, deep=4):
    """A volleyball net seen end on, running away from the camera between posts at near and far,
    (column, ground row): white posts, the far one lgrey and a row shorter, and between their tops a
    white tape over deep rows of coal mesh, its bottom cord coal."""
    (x0, g0), (x1, g1) = near, far
    cv.fill(x1, g1 - top + 1, 1, top, "lgrey")
    for i in range(x1 - x0 + 1):
        x = x0 + i
        t = round(g0 - top + (g1 - g0 + 1) * i / (x1 - x0))
        cv.fill(x, t, 1, 1, "white")
        for y in range(t + 1, t + deep):
            if (x + y) % 2 == 0:
                cv.fill(x, y, 1, 1, "coal")
        cv.fill(x, t + deep, 1, 1, "coal")
    cv.fill(x0, g0 - top, 1, top + 1, "white")


def volleyball(cv, x, base):
    """A beach volleyball game mid-rally, two against two, on a court roped in lake blue whose near
    left corner is column x on row base: the net runs away from the camera across the court's middle,
    a red player digs at the back and a red player jumps to block as a blue player leaps to spike the
    ball over the net, the blue partner ready behind."""
    cv.fill(x, base, 80, 1, "lake")
    cv.fill(x + 12, base - 8, 74, 1, "lake")
    cv.line(x, base, x + 12, base - 8, "lake")
    cv.line(x + 79, base, x + 85, base - 8, "lake")
    player(cv, x + 14, base - 4, "dig", "dbrown", "brown", "ttc")
    player(cv, x + 51, base - 6, "spike", "walnut", "clay", "cobalt", flip=True, lift=5)
    net(cv, (x + 38, base), (x + 50, base - 8))
    player(cv, x + 29, base - 2, "block", "gold", "skin2", "ttc", lift=3)
    player(cv, x + 67, base - 2, "ready", "plum", "skin2", "cobalt", flip=True)
    # the ball: a white plus shaded lgrey on its lower right, never yellow, so it reads as a ball and not a
    # sparkle
    cv.fill(x + 45, base - 25, 3, 1, "white")
    cv.fill(x + 46, base - 26, 1, 3, "white")
    cv.fill(x + 47, base - 25, 1, 1, "lgrey")
    cv.fill(x + 46, base - 24, 1, 1, "lgrey")


def beaches():
    cv = sn.Canvas(W, H)
    # a warm yellow late afternoon over the lake, small clouds and gulls
    sky(cv, "gold", "yellow", clouds=((58, BASE - 58, 26, 4), (CX + 70, BASE - 60, 30, 4)))
    birds(cv, ((100, BASE - 50), (112, BASE - 46), (232, BASE - 52)))
    # Lake Ontario out to the horizon: dark far water, then lake and shallows, foam lines, sails
    for py in range(BASE - 40, BASE - 12):
        for px in range(W):
            c = "dlake" if py < BASE - 34 else "lake" if py < BASE - 22 else "shallow"
            if hashed(px // 3, py, 9) and py % 3 == 0:
                c = "shallow" if c == "lake" else "foam" if c == "shallow" else "lake"
            cv.fill(px, py, 1, 1, c)
    cv.fill(0, BASE - 41, W, 1, "lake")
    for sx, sy in ((CX - 96, BASE - 36), (CX + 40, BASE - 38), (CX + 2, BASE - 30)):
        cv.fill(sx - 4, sy + 6, 10, 2, "white")
        for k in range(8):
            cv.fill(sx, sy - 2 + k, 1 + k // 2, 1, "white")
        cv.fill(sx - 1, sy - 3, 1, 9, "coal")
    for py in range(BASE - 12, BASE):
        cv.fill(0, py, W, 1, "foam" if py == BASE - 12 else "driftwood")
    for px in range(W):
        if hashed(px, BASE - 11, 5):
            cv.fill(px, BASE - 11, 1, 1, "foam")
    # big shade trees: two in Kew-Balmy Beach park behind the plant, a maple and a willow by the
    # boardwalk at the west end
    shade_tree(cv, 338, BASE - 42, 12, BASE - 8, "canopy", "pine", "green")
    shade_tree(cv, 310, BASE - 36, 9, BASE - 8, "green", "dgreen", "lime")
    leuty(cv, CX + 96, BASE - 2)
    rc_harris(cv, CX + 116, BASE - 9)
    shade_tree(cv, 6, BASE - 44, 16, BASE, "green", "dgreen", "lime", girth=5)
    willow(cv, 44, BASE - 30, 14, BASE)
    for cx, a, b in ((CX - 100, "ttc", "white"), (CX + 30, "gold", "dlake")):
        umbrella(cv, cx, BASE - 1, a, b)
    volleyball(cv, CX - 82, BASE - 1)

    def sand(px, py):
        return "stone" if hashed(px, py, 43) else "white" if hashed(px, py + 7, 150) else "driftwood"

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
    cross_line(cv, "dbrown", dash=(10, 64))
    street(cv, verge("the-beaches", boards))
    lanes(cv, "dbrown", dash=(20, 64))
    return cv


# The CN Tower's main pod, close up: each row's half-width from its top, a cap over a wide skirt of window
# rings, then its underside narrowing into the shaft.
CN_POD = (12, 18, 22, 25, 27, 28, 28, 28, 28, 28, 27, 25, 22, 18, 14, 11, 9, 8)


def cn_tower(cv, cx, base, pod):
    """The CN Tower at night, huge and close, the largest structure in the city, centred on column cx, in
    an ink outline, lgrey lit white on its left and grey in shade on its right. Its main pod (CN_POD), 57
    wide, has its top on row pod, near the band's top, its upper shaft running off the band's top above
    it; a white cap, a ring of lit 2x2 windows gold and amber at its widest, a ring of cream ones under a
    grey band, its underside in shade; then the shaft tapers out from 15 columns to 23 down to row base."""
    rows = {y: 4 for y in range(0, pod)}
    for k, half in enumerate(CN_POD):
        rows[pod + k] = half
    low = pod + len(CN_POD)
    for y in range(low, base):
        rows[y] = 7 + (y - low) * 4 // max(1, base - low)
    inside = {(x, y) for y, half in rows.items() for x in range(cx - half, cx + half + 1)}
    for x, y in inside:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in inside and y + dy >= 0:
                cv.fill(x + dx, y + dy, 1, 1, "ink")
    for y, half in rows.items():
        cv.fill(cx - half, y, 2 * half + 1, 1, "lgrey")
        cv.fill(cx - half, y, 2, 1, "white")
        shade = min(4, half)
        cv.fill(cx + half - shade + 1, y, shade, 1, "grey")
    # the pod: a white cap, a ring of gold and amber windows at its widest, a grey band, a ring of cream
    # windows, the underside in shade
    cv.fill(cx - 20, pod + 2, 41, 2, "white")
    for k, x in enumerate(range(cx - 26, cx + 26, 3)):
        cv.fill(x, pod + 5, 2, 2, ("gold", "amber")[k % 2])
    cv.fill(cx - 28, pod + 8, 57, 1, "grey")
    for x in range(cx - 25, cx + 25, 3):
        cv.fill(x, pod + 10, 2, 2, "cream")
    for k, half in enumerate(CN_POD[13:]):
        cv.fill(cx - half, pod + 13 + k, 2 * half + 1, 1, "grey")


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
    lit(cv, x + 3, x + w - 3, top + 7, BASE, "scotia", 0.15, ("gold", "amber"))
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


def lit(cv, x0, x1, y0, y1, seed, rate, cols=("gold", "amber", "cream")):
    """Lit windows across columns x0..x1 and rows y0..y1 in blocks, never speckle: a floor every 4 rows,
    a 2x2 window every 3 columns, lit in runs of 2 to 4 windows of one colour; rate sets how many."""
    rnd = random.Random(f"lit-{seed}")
    for y in range(y0, y1 - 1, 4):
        run, col = 0, None
        for x in range(x0, x1 - 1, 3):
            if run == 0 and rnd.random() < rate * 0.45:
                run, col = rnd.randrange(2, 5), rnd.choice(cols)
            if run:
                cv.fill(x, y, 2, 2, col)
                run -= 1


def skyline(cv, towers):
    """The towers behind the front row: silhouettes standing on BASE, each (x, w, top, wall), with runs
    of lit windows, gold and amber and a few pink and cyan."""
    for k, (x, w, top, wall) in enumerate(towers):
        cv.fill(x, top, w, BASE - top, wall)
        lit(cv, x + 2, x + w - 1, top + 3, BASE, f"far-{k}", 0.3, ("gold", "amber") * 2 + ("pink", "cyan"))


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


def crown(cv, x, w, top, wall, line="coal", steps=2):
    """A tower's stepped top: steps rows each 2 columns narrower a side, above row top."""
    for k in range(1, steps + 1):
        cv.fill(x + 2 * k, top - k, w - 4 * k, 1, line)
        cv.fill(x + 2 * k + 1, top - k + 1, w - 4 * k - 2, 1, wall)


def royal_bank(cv, x, w, top):
    """A Royal Bank Plaza tower: gold glass in sawtooth facets, a gold and amber pair lit and ochre
    in shade every 4 columns, ochre floors every 3 rows."""
    crown(cv, x, w, top, "gold")
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
    lit(cv, x + 4, x + w - 4, top + 7, BASE, "fcp", 0.18, ("cream", "gold"))
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
            run = rnd.randrange(2, 6) if run == 0 and rnd.random() < 0.4 else max(0, run - 1)
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
    lit(cv, x + 2, x + w - 3, top + 3, BASE, f"glass-{seed}", 0.35, ("gold", "amber", "foam"))
    outline_box(cv, x, top, w, BASE - top + 1, line)
    cv.fill(x + 1, top + 1, 1, BASE - top - 1, "lake")


def screen(cv, x, y, w, h, back, art=None):
    """A video screen: back inside an ink frame 1px round it, and art(cv, x, y, w, h) on it in big shapes."""
    cv.fill(x - 1, y - 1, w + 2, h + 2, "ink")
    cv.fill(x, y, w, h, back)
    if art:
        art(cv, x, y, w, h)


def paw_art(cv, x, y, w, h):
    """A white paw print in the middle of a screen."""
    px, py = x + (w - len(PAW[0])) // 2, y + (h - len(PAW)) // 2
    for j, row in enumerate(PAW):
        for i, ch in enumerate(row):
            if ch == "#":
                cv.fill(px + i, py + j, 1, 1, "white")


def word_art(text, col):
    """Screen art: text in the sign letters, centred on the screen."""
    def draw(cv, x, y, w, h):
        word(cv, text, x + w / 2, y + (h - 8) // 2, col)
    return draw


def dundas_screens(cv, x, w, top):
    """The Yonge-Dundas tower: shale from row top with runs of lit windows over its wall of screens, low
    enough to show while a message is up: the giant LIVE! screen at 2x on cobalt over blue from row 62
    and, under it, three ads (EAT on red, a paw print on turquoise, NEW on hot pink)."""
    cv.fill(x, top, w, BASE - top, "shale")
    outline_box(cv, x, top, w, BASE - top + 1, "ink")
    lit(cv, x + 2, x + w - 3, top + 3, 59, "dundas", 0.5, ("gold", "amber"))
    sx, sw, sy, sh = x + 3, w - 6, 62, 17
    screen(cv, sx, sy, sw, sh, "cobalt")
    cv.fill(sx, sy + sh - 6, sw, 6, "blue")
    word(cv, "LIVE!", x + w / 2, sy, "gold", 2)
    ay = sy + sh + 3
    aw = (sw - 4) // 3
    for k, (back, art) in enumerate((("ttc", word_art("EAT", "white")), ("turquoise", paw_art),
                                     ("hot", word_art("NEW", "white")))):
        screen(cv, sx + k * (aw + 2), ay, aw, 11, back, art)


def street_level(cv, x, w, seed, sign=None):
    """A tower's lit podium seen from far off, rows BASE - 18 to BASE: coal under an ash top edge, its
    floors lit in runs of 2x2 windows, gold, amber and cream, with no doors or shopfronts; and over it a
    neon sign, (word, colour), on an ink board edged in its colour."""
    cv.fill(x, BASE - 18, w, 18, "coal")
    cv.fill(x, BASE - 18, w, 1, "ash")
    lit(cv, x + 2, x + w - 2, BASE - 14, BASE, f"podium-{seed}", 1.2, ("gold", "amber", "cream"))
    if sign:
        s, col = sign
        bw = fonts.sign_width(s) + 4
        bx = round(x + w / 2 - bw / 2)
        cv.fill(bx, BASE - 17, bw, 9, "ink")
        outline_box(cv, bx, BASE - 17, bw, 9, col)
        word(cv, s, x + w / 2, BASE - 17, col)


def front_pool(cv, x0, x1, skip=()):
    """A lit podium's light on the far sidewalk, rows BASE to FAR_WALK, under columns x0 to x1: stone
    on its first 2 rows inside a dstone edge, each row out a column wider a side, with no pixel in the
    column ranges skip (the side street's mouth)."""
    rows = FAR_WALK - BASE
    for k in range(rows):
        a, z = x0 + (rows - 1 - k), x1 - (rows - 1 - k)
        for x in range(max(0, a), min(W, z)):
            if any(lo <= x <= hi for lo, hi in skip):
                continue
            cv.fill(x, BASE + k, 1, 1, "stone" if k < 2 and a + 2 <= x < z - 2 else "dstone")


def bulbs(cv, x, y, w, h, cols=("gold", "cream")):
    """A 2px-deep border of marquee bulbs round the box x, y, w, h: 2x2 bulbs every 4 px on ink, the
    colours in turn."""
    for fx, fy, fw, fh in ((x, y, w, 2), (x, y + h - 2, w, 2), (x, y, 2, h), (x + w - 2, y, 2, h)):
        cv.fill(fx, fy, fw, fh, "ink")
    k = 0
    for px in range(x, x + w - 1, 4):
        for py in (y, y + h - 2):
            cv.fill(px, py, 2, 2, cols[k % len(cols)])
        k += 1
    for py in range(y + 4, y + h - 3, 4):
        for px in (x, x + w - 2):
            cv.fill(px, py, 2, 2, cols[k % len(cols)])
        k += 1


def blade(cv, x, top, text, col):
    """A vertical neon sign hung from a wall: an ink board from row top with text read down it, a
    letter every 7 rows, edged in col."""
    h = 7 * len(text) + 3
    cv.fill(x, top, 9, h, "ink")
    outline_box(cv, x, top, 9, h, col)
    for k, ch in enumerate(text):
        word(cv, ch, x + 4.5, top + 1 + 7 * k, col)


def eaton_centre(cv, x, w, top):
    """The Eaton Centre seen from far off, one huge mall mass with no entrance: the galleria's long barrel
    vault of lake glass on white ribs across its whole width, then a dlake glass facade from the vault down
    to the street, its right 3 columns navy in shade, white-foam mullions every 4 columns and 4 rows, its
    floors lit gold and amber in long runs of 3x3 panes; and on the roof the EATON CENTRE sign: cyan letters
    on an ink board in a 2px border of marquee bulbs, on coal legs."""
    vault = 7
    for dy in range(vault):
        half = round(w / 2 * math.sqrt(1 - ((vault - dy) / vault) ** 2))
        cv.fill(round(x + w / 2 - half), top + dy, 2 * half, 1, "lake")
    for c in range(x + 4, x + w - 2, 8):
        cv.fill(c, top + 2, 1, vault - 2, "white")
    cv.fill(x, top + vault, w, BASE - top - vault, "dlake")
    cv.fill(x + w - 3, top + vault, 3, BASE - top - vault, "navy")
    rnd = random.Random("eaton")
    for y in range(top + vault + 1, BASE - 2, 4):
        run, col = 0, None
        for c in range(x + 1, x + w - 4, 4):
            if run == 0 and rnd.random() < 0.3:
                run, col = rnd.randrange(2, 6), rnd.choice(("gold", "amber", "gold"))
            if run:
                cv.fill(c, y, 3, 3, col)
                run -= 1
        cv.fill(x, y + 3, w - 3, 1, "foam")
    for c in range(x + 4, x + w - 3, 4):
        cv.fill(c, top + vault, 1, BASE - top - vault, "foam")
    outline_box(cv, x, top + vault, w, BASE - top - vault + 1, "navy")
    text = "EATON CENTRE"
    bw = fonts.sign_width(text) + 8
    bx = round(x + w / 2 - bw / 2)
    by = top - 17
    for c in (bx + 6, bx + bw - 7):
        cv.fill(c, by + 13, 2, top - by - 13 + 2, "coal")
    cv.fill(bx, by, bw, 14, "ink")
    bulbs(cv, bx, by, bw, 14, ("gold", "cream", "hot", "cream"))
    word(cv, text, x + w / 2, by + 3, "cyan")


def car_lights(cv, cx, y, w, back):
    """A car in a jam far down a side street, w columns wide on row y: from behind, a slate body with
    red tail lights at its corners; from the front, gold headlights."""
    h = max(2, round(w * 0.6))
    x = cx - w // 2
    cv.fill(x, y - h + 1, w, h, "slate")
    if h > 3:
        cv.fill(x + 1, y - h + 1, w - 2, 1, "ink")
    lamp, size = "red" if back else "gold", 1 + (w >= 6)
    cv.fill(x, y - h // 2, size, 1, lamp)
    cv.fill(x + w - size, y - h // 2, size, 1, lamp)


def bus_back(cv, cx, y):
    """A TTC bus from behind at the mouth of the side street: white over red, a dark back window,
    red tail lights low at its corners and an amber route sign."""
    cv.fill(cx - 6, y - 12, 13, 13, "ink")
    cv.fill(cx - 5, y - 11, 11, 6, "white")
    cv.fill(cx - 5, y - 5, 11, 5, "ttc")
    cv.fill(cx - 4, y - 10, 9, 4, "dslate")
    cv.fill(cx - 2, y - 11, 5, 1, "amber")
    cv.fill(cx - 5, y - 3, 2, 2, "red")
    cv.fill(cx + 4, y - 3, 2, 2, "red")
    cv.fill(cx - 5, y - 6, 11, 1, "white")


def side_street(cv, x0, x1, vy, rise=34):
    """A side street running away between two towers, columns x0 to x1, in one-point perspective to
    a vanishing point on row vy: its two side walls, rise rows tall at the mouth, the right one shale
    and the left coal, both in the canyon's shade, with rows of lit windows running to the vanishing
    point; a far block at its end; a shale road between stone curbs; and gridlock on it, cars going
    away showing their tail lights on the left, cars coming in their headlights on the right, a TTC
    bus at the mouth."""
    mid = (x0 + x1 + 1) / 2
    floor = FAR_WALK - 1
    half = (x1 - x0 + 1) / 2
    depth = floor + 0.5 - vy
    rnd = random.Random("side-street")
    for px in range(x0, x1 + 1):
        d = px + 0.5 - mid
        k = abs(d) / half                       # 0 at the vanishing point, 1 at the mouth
        top, foot = vy - rise * k, vy + depth * k
        floors = {math.floor(vy - rise * k * f) for f in (0.15, 0.3, 0.45, 0.6, 0.75, 0.9)}
        for py in range(math.floor(top), floor + 1):
            if py + 0.5 < foot:
                c = "coal" if d < 0 else "shale"
                if py in floors and px % 2 and rnd.random() < 0.55:
                    c = rnd.choice(("gold", "amber", "cream"))
            else:
                t = (py + 0.5 - vy) / depth
                c = "shale" if abs(d) < half * t * 0.75 else "stone" if abs(d) < half * t * 0.8 else "dstone"
            cv.fill(px, py, 1, 1, c)
    cv.fill(round(mid) - 3, vy - 7, 6, 7, "dslate")
    lit(cv, round(mid) - 2, round(mid) + 3, vy - 6, vy, "side-end", 0.6, ("gold", "cream"))
    for t in (0.12, 0.2, 0.3, 0.42, 0.56, 0.72):
        y = round(vy + depth * t)
        w = max(2, round(11 * t))
        car_lights(cv, round(mid - half * t * 0.38), y, w, True)
        car_lights(cv, round(mid + half * t * 0.38), y, w, False)
    bus_back(cv, round(mid - half * 0.38), floor)


def elgin(cv, x, top, base, text="ELGIN", col="red", step=8):
    """A theatre's vertical blade sign, 13 columns wide from row top: text read down it in col on cream,
    a letter every step rows, in a 2px border of marquee bulbs, on a coal bracket down to row base."""
    h = step * len(text) + 6
    cv.fill(x, top, 13, h, "cream")
    bulbs(cv, x, top, 13, h)
    for k, ch in enumerate(text):
        word(cv, ch, x + 6.5, top + 3 + step * k, col)
    cv.fill(x + 5, top + h, 3, base - top - h, "coal")


def marquee(cv, x, w, text, col):
    """A theatre marquee over a street level, columns x to x + w - 1, rows BASE - 25 to BASE - 11: text in
    col on a cream board in a 2px border of marquee bulbs."""
    y = BASE - 25
    cv.fill(x, y, w, 15, "ink")
    cv.fill(x + 2, y + 2, w - 4, 11, "cream")
    bulbs(cv, x, y, w, 15)
    word(cv, text, x + w / 2, y + 4, col)


# A paw print, 11 by 10: four toe beans over the pad.
PAW = ("..##...##..", ".####.####.", ".####.####.", "..##...##..", "##.......##", "##..###..##",
       "...#####...", "..#######..", "..#######..", "...##.##...")
# One ramp step lighter, for the street's glow on the towers' feet.
UP = dict(navy="dslate", dslate="slate", dlake="lake", shale="ash", coal="shale", ink="coal", lake="shallow",
          blue="cobalt", purple="mauve", dbrick="brick", brick="rust", ochre="amber", slate="grey", ash="stone",
          teal="dturq")
NAMES = {tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)): n for n, h in reversed(list(K.items()))}


def uplight(cv, y0, y1):
    """The street's glow on the towers' feet: every pixel on rows y0 to y1 with a lighter step in UP
    takes it."""
    for y in range(y0, y1):
        for x in range(W):
            n = NAMES.get(cv.img.getpixel((x, y))[:3])
            if n in UP:
                cv.fill(x, y, 1, 1, UP[n])


def crosswalk(cv, mid, w, road):
    """A crosswalk over the cross street, w columns centred on mid: white bars along the street on
    every other row, the road between them clear of the centre line."""
    x = round(mid - w / 2)
    cv.fill(x, CROSS + 1, w, NEAR_CURB - CROSS - 1, road)
    for py in range(CROSS + 1, NEAR_CURB, 2):
        cv.fill(x, py, w, 1, "white")


YONGE_SKY = ("slate", "dslate", "purple", "mauve")


def yonge():
    cv = sn.Canvas(W, H)
    # an evening sky, slate down to dslate and purple, a mauve city glow at the horizon, a full moon
    # and a few stars
    sunset(cv, YONGE_SKY, BASE)
    for x, y in ((8, 6), (62, 2), (108, 9), (150, 4), (196, 11), (232, 3), (288, 22), (318, 4), (352, 12)):
        cv.fill(x, y, 1, 1, "white")
    full_moon(cv, 304, 14, 5)
    # downtown seen from far off, its towers stepping up toward the top third, the CN Tower huge and close
    # over them all: its main pod near the band's top, the antenna and SkyPod cut off above, the shaft
    # tapering down to the street. The message strip covers the band's top rows while a message shows, so
    # the screens and signs stay below row 57. Far back, dark towers in navy and dslate with runs of windows
    # lit, those either side of the tower's shaft kept low
    skyline(cv, ((-2, 16, 30, "navy"), (40, 14, 62, "dslate"), (78, 16, 52, "navy"), (114, 22, 26, "navy"),
                 (150, 18, 16, "dslate"), (170, 20, 30, "navy"), (196, 16, 24, "dslate"), (214, 14, 18, "navy"),
                 (228, 18, 28, "navy"),
                 (268, 16, 36, "dslate"), (300, 18, 30, "navy"), (322, 16, 22, "dslate"), (342, 20, 34, "navy")))
    for cx, top, h in ((122, 26, 6), (156, 22, 5), (178, 30, 6), (220, 24, 4), (348, 34, 6)):
        mast(cv, cx, top - h, h)
    # the SkyDome off to the tower's right, its foot behind the Eaton Centre; lit towers behind it; then the
    # CN Tower, its shaft clear down to the street
    skydome(cv, 84, 70, BASE - 32, 16)
    glass_tower(cv, 10, 30, 36, 7)
    scotia(cv, 96, 24, 30)
    dominion(cv, 120, 22, 40, 5)
    glass_tower(cv, -4, 16, 22, 4)
    cn_tower(cv, 56, BASE, 3)
    # the nearer towers: dark glass on the left and up to the SkyDome's lower half; then, down to
    # the street, the Yonge-Dundas screens, the Royal Bank Plaza's gold pair, First Canadian Place, a TD
    # Centre tower and glass under a turquoise crown, the street's glow on their feet and most with neon
    # over a lit street level; in front, the Eaton Centre under its sign, a HOTEL sign down the left
    # tower, screens on the glass, the TD tower and the crowned tower, and the theatre: the ELGIN blade
    # over a marquee in front of the Royal Bank pair
    dundas_screens(cv, CX - 32, 64, 34)
    royal_bank(cv, 210, 20, 30)
    royal_bank(cv, 230, 14, 50)
    first_canadian(cv, 246, 22, 20)
    dominion(cv, 270, 34, 28, 1)
    glass_tower(cv, 332, 32, 32, 3)
    crown(cv, 332, 32, 32, "turquoise", "turquoise", steps=3)
    uplight(cv, BASE - 24, BASE - 18)
    uplight(cv, BASE - 21, BASE - 18)
    fronts = ((-4, 18, None), (14, 30, ("CAFE", "turquoise")), (44, 30, None), (74, 14, None),
              (CX - 32, 64, ("PIZZA", "gold")), (210, 20, None), (230, 14, None), (246, 22, None),
              (270, 34, ("BOOKS", "lilac")), (332, 32, ("BAR", "pink")))
    for k, (x, w, sign) in enumerate(fronts):
        street_level(cv, x, w, k, sign)
    eaton_centre(cv, 72, 76, BASE - 36)
    blade(cv, 3, 62, "HOTEL", "pink")
    screen(cv, 14, 72, 30, 18, "turquoise", word_art("WOOF!", "white"))
    screen(cv, 274, 70, 26, 18, "azure", paw_art)
    screen(cv, 334, 72, 26, 18, "hot", word_art("SALE", "white"))
    elgin(cv, 236, BASE - 25 - 41, BASE - 25, step=7)
    marquee(cv, 208, 40, "SHOW", "red")
    # the subway entrance sign
    sx = 64
    cv.fill(sx, BASE - 4, 2, FAR_WALK - BASE + 4, "coal")
    cv.fill(sx - 9, BASE - 14, 20, 12, "coal")
    cv.fill(sx - 8, BASE - 13, 18, 10, "ttc")
    word(cv, "TTC", sx + 1, BASE - 12, "white")

    def paving(px, py):
        return "slate" if hashed(px, py, 67) else "dslate"

    yard(cv, BASE, FAR_WALK, paving)
    # the lit podiums' and the Eaton Centre's light on the far sidewalk
    for x0, x1 in [(x + 1, x + w - 1) for x, w, _ in fronts] + [(79, 153)]:
        front_pool(cv, x0, x1, skip=((300, 334),))
    # a side street jammed with traffic between the TD tower and the glass, down to the far sidewalk
    side_street(cv, 304, 331, BASE - 26, rise=18)

    def road(x, z, span, px, py):
        if abs(x) >= ROAD - 5:
            return "dstone"
        if span < 6 and crosses(z, span, 32):
            return "coal"
        return "ash" if hashed(px, py, 41) else "shale"

    cross(cv, flat(road), "dstone", paving, curb="grey")
    cross_line(cv, "amber", "coal", dash=(14, 64))
    # crosswalks over the cross street from the stub's two sidewalks
    for mid in (94, 266):
        crosswalk(cv, mid, 14, "shale")
    street(cv, verge("yonge-street", road))
    lanes(cv, "white", "coal", dash=(14, 64))
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
        print(json.dumps(VERGES, indent=2))
    elif sys.argv[1:] == ["verges", "--write"]:
        write_verges()
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
        write_verges()
    else:
        sys.exit(__doc__)
