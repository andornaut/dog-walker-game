#!/usr/bin/env python3
"""Draw the six zone backdrops: the neighbourhood band between the top bar and the road.

backdrop-<zone>: 360x110 images in Endesga 32, drawn on screen rows 40 to 149.
The street ends at a T-junction: the bottom rows continue the pseudo-3D road
below the band (the same projection, so the same road, curb and sidewalk edges
at the same slope) up to a cross street that runs flat across the band. Beyond it the far side faces the camera: the
zone's houses, park or shops under the sky. The scenery gags (cat on a perch,
sprinkler, rolling ball) are separate sprites the game places in this band, on
the near corners either side of the street.

Rows, in band rows (0 to 109): the far side's ground row 62 (BASE), the far sidewalk 66 to
69, the far curb 70 to 71, the cross street 72 to 80 with its centre line on row 76, the near
sidewalk 81 to 85, and the stub from row 86 (STUB) to the bottom row, 109, which continues the
game's road (the 280-wide strip on columns 110 to 249, lane dividers on 138, 166, 193 and 221,
verge outside). Gag spots, kept clear (python3 art/tools/backdrops.py gags prints them for
the current constants): the near-left perch's top rail on rows 93 to 95, x 0 to 82; the
near-right lawn, x 274 to 359 on rows 86 to 109 (the sprinkler at x 322 to 353); and the two
sidewalks, whose middles run from (97, 109) to (103, 85) and from (263, 109) to (257, 85).

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
import help as hp  # noqa: E402
from pixel import DARKER, K  # noqa: E402

# ---------- the band and the camera ----------
# Everything below is drawn from these, read from the game's layout export. The camera is the
# game's: the horizon and foot rows on screen, the focal length F in road pixels and the road's
# centre column. The road below the band then shows VISIBLE road pixels, F (1 / s - 1) for the
# scale s on screen row BAR + H.
LAYOUT = hp.LAYOUT
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
    """The sky, with clouds given as (x, base row, width, puff): puff is the tallest lobe's radius."""
    cv.fill(0, 0, W, FAR_WALK, low)
    cv.fill(0, 0, W, 10, top)
    for i in range(0, W, 5):
        cv.fill(i, 10 + (i // 5) % 2, 5, 1, top)
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


def house(cv, x, w, wall, roof, door="dred", top=40, base=104, roof_h=26, parts=HOUSE, curtains=None):
    """A house facing the camera, standing on row base: a gable roof roof_h rows tall from top.
    curtains, a colour, draws the windows' curtains closed, lamplight in the gap between them."""
    wall_y = top + roof_h
    off, ww, wh, door_h = parts
    cv.fill(x, wall_y, w, base - wall_y, wall)
    cv.fill(x + w - 3, wall_y, 3, base - wall_y, dk(wall))
    for i in range(roof_h):
        inset = round(i * (w / 2 + 3) / roof_h)
        cv.fill(x - 3 + (w // 2 + 3) - inset, top + i, inset * 2, 1, roof)
    cv.fill(x - 3, wall_y - 1, w + 6, 2, dk(roof))
    cv.fill(x + w - 14, top + round(roof_h * 0.15), 6, round(roof_h * 0.46), "brown")
    cv.fill(x + w - 15, top + round(roof_h * 0.08), 8, 2, "dbrown")
    for wx in (x + ww // 2, x + w - ww - ww // 2):
        cv.fill(wx, wall_y + off, ww, wh, "plum")
        if curtains:
            cv.fill(wx + 1, wall_y + off + 1, ww - 2, wh - 2, curtains)
            cv.fill(wx + 1, wall_y + off + 1, ww - 2, 1, dk(curtains))
            cv.fill(wx + ww // 2 - 1, wall_y + off + 2, 2, wh - 3, "yellow")
            cv.fill(wx + 2, wall_y + off + 2, 1, wh - 3, dk(curtains))
            cv.fill(wx + ww - 3, wall_y + off + 2, 1, wh - 3, dk(curtains))
        else:
            cv.fill(wx + 1, wall_y + off + 1, ww - 2, wh - 2, "cyan")
            cv.fill(wx + ww // 2, wall_y + off + 1, 1, wh - 2, "white")
            cv.fill(wx + 1, wall_y + off + wh // 2, ww - 2, 1, "white")
        cv.fill(wx - 1, wall_y + off + wh, ww + 2, 2, "white")
    dx = x + w // 2 - 5
    cv.fill(dx, base - door_h, 10, door_h, door)
    cv.fill(dx + 7, base - door_h // 2, 1, 2, "amber")
    cv.fill(dx - 2, base - 2, 14, 2, "lgrey")


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
# half the road, its curb and its sidewalk, as the game draws Woof Way's verge
ROAD = LAYOUT["regions"]["road"]["width"] // 2
CURB, WALK = LAYOUT["verges"]["street"]["curbTo"], LAYOUT["verges"]["street"]["walkTo"]
DIVIDERS = tuple(x - CX for x in LAYOUT["lanes"]["dividers"])   # lane divider lines, from the road's centre
# The cross street, in band rows from the far side down: the far sidewalk, the far curb, the
# road, the near curb and the near sidewalk, which the street's stub (rows STUB to the bottom)
# opens into. These rows are drawn flat rather than to the projection, which would spread the
# cross street over most of the band; across, they keep the projection's scale per row, so
# lines along the street (curbs, slab seams) still lean toward the road's centre line.
# The stub is the band's part of the approach region, where the game's road raster starts.
FAR_WALK, FAR_CURB, CROSS, NEAR_CURB = 66, 70, 72, 81
STUB = LAYOUT["regions"]["approach"]["y"] - BAR
LINE = 76                      # the cross street's centre line
CORNER = 5                     # the near corners' curb radius, in pixels
BASE = 62                      # the far side's ground row: the houses stand on it
PERCH = round(Z0) + 3          # the near-left perch's z: its foot on the bottom row, for the cat
PERCH_H = 30                   # the perch's height: its top rail is h 27 to 30
PERCH_X = (-196, -600)         # the perch, across: from just past the sidewalk out off screen


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
    ImageDraw.Draw(cv.img).polygon(xy, fill=hp.rgb(K.get(c, c)))


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
    cv = hp.Canvas(W, H)
    # fair-weather puffs of mixed sizes, spread unevenly above the rooftops
    sky(cv, clouds=((8, 13, 40, 7), (110, 9, 18, 3), (232, 7, 30, 5), (318, 15, 18, 3)))

    def road(x, z, span, px, py):
        if abs(x) >= ROAD - 3:
            return "grey"
        return "slate" if hashed(px, py, 29) else "navy" if hashed(px, py + 3, 31) else "dslate"

    # the houses across the street, the middle one at the end of the street, a tree in each gap
    homes = ((CX - 207, 62, "tan", "brown", "dgreen"), (CX - 119, 60, "pink", "purple", "white"),
             (CX - 31, 62, "sky", "navy", "red"), (CX + 57, 60, "cream", "dred", "sky"),
             (CX + 143, 62, "lgrey", "slate", "dred"))
    for x, w, *_ in homes[1:]:
        tree(cv, x - 13, 34, r=11, base=BASE, girth=4)
    for x, w, wall_c, roof, door in homes:
        house(cv, x, w, wall_c, roof, door, top=24, base=BASE, roof_h=16, parts=SMALL)
    yard(cv, BASE, FAR_WALK, grass())
    for x, w, *_ in homes:
        path(cv, x + w // 2 - 6, BASE, FAR_WALK)
        fence(cv, FAR_WALK - 4, max(0, x - 4), x + w // 2 - 10, h=9)
        fence(cv, FAR_WALK - 4, x + w // 2 + 10, x + w + 6, h=9)
    bush(cv, CX - 68, FAR_WALK - 4, lobes=SHRUB)
    bush(cv, CX + 113, FAR_WALK - 4, "green", SHRUB)
    flowers(cv, CX - 24, CX - 10, FAR_WALK - 4)
    flowers(cv, CX + 12, CX + 26, FAR_WALK - 3)
    for x in (CX - 134, CX - 46, CX + 128):
        mailbox(cv, x, FAR_WALK)
    cross(cv, flat(road), "grey", slabs)
    cross_line(cv, "lgrey")
    street(cv, verge(road))
    lanes(cv, "lgrey")
    ffence(cv, *PERCH_X, PERCH)
    return cv


def bark_park():
    cv = hp.Canvas(W, H)
    # two big billowing clouds clear of the gate, and a small one
    sky(cv, clouds=((2, 17, 52, 9), (CX - 66, 8, 16, 3), (CX + 82, 15, 56, 10)))
    treeline(cv, 44, ("dgreen", "green"), 2.5, 3, 8)
    # an unmown park: flat rough patches on the far lawn, tufts thinning toward the trees
    patches = [(CX - 50, 50, 26, 3), (CX - 24, 52, 20, 2), (CX + 100, 57, 30, 3), (CX + 128, 60, 18, 3),
               (40, 68, 24, 2)]

    def lawn(px, py):
        c = "green"
        if any(((px - qx) / rx) ** 2 + ((py - qy) / ry) ** 2 <= 1 for qx, qy, rx, ry in patches):
            c = "dgreen"
        return grass(c, 0.03 * ((py - 34) / 76) ** 2)(px, py)

    yard(cv, 44, CROSS, lawn)
    # the pond, on the left
    for py in range(50, 62):
        for px in range(6, 92):
            e = ((px + 0.5 - 48) / 40) ** 2 + ((py + 0.5 - 56) / 5) ** 2
            if e <= 1:
                cv.fill(px, py, 1, 1, "white" if hashed(px, py, 17) else "sky" if e > 0.5 else "cyan")
    for cx, top, r in ((8, 36, 8), (96, 34, 9), (CX + 98, 36, 8), (352, 38, 7)):
        tree(cv, cx, top, r=r, base=48, girth=4)
    for cx, top, r in ((CX - 78, 36, 12), (CX + 148, 34, 13), (-2, 40, 14)):
        tree(cv, cx, top, r=r, base=66)
    # the park gate at the end of the path, its sign facing the street
    for x in (CX - 48, CX + 46):
        cv.fill(x, 30, 3, 38, "dbrown")
    cv.fill(CX - 62, 20, 124, 16, "dgreen")
    cv.fill(CX - 62, 20, 124, 1, "green")
    cv.fill(CX - 62, 35, 124, 1, "forest")
    word(cv, "BARK PARK", CX, 24, "yellow")
    for x in (CX - 68, CX + 68):
        cv.fill(x, 44, 2, 24, "slate")
        cv.fill(x - 4, 38, 10, 7, "navy")
        cv.fill(x - 2, 40, 6, 4, "yellow")
    # a bench facing the street
    cv.fill(CX + 106, 59, 24, 2, "brown")
    cv.fill(CX + 106, 62, 24, 2, "brown")
    cv.fill(CX + 108, 64, 2, 3, "dbrown")
    cv.fill(CX + 126, 64, 2, 3, "dbrown")

    def trail(x, z, span, px, py):
        a = abs(x)
        if a >= ROAD - 2:
            return "brown"
        return "brown" if hashed(px, py, 13) else "cream" if hashed(px, py + 5, 23) else "tan"

    # the path on into the park, through the gate
    for py in range(54, CROSS):
        half = 18 + (py - 54) // 3
        cv.fill(CX - half, py, 2 * half, 1, "brown")
        for px in range(CX - half + 1, CX + half - 1):
            cv.fill(px, py, 1, 1, trail(0, 0, 99, px, py))
    cross(cv, flat(trail), "brown", lawn, curb=None, top=CROSS)
    cross_line(cv, "dbrown", dash=(7, 16))
    rough_patches = rough("bark-park-lawn", 10, ROAD + 30, 600, Z0 + 10, Z0 + 90)

    def paint(x, z, span, px, py):
        if abs(x) < ROAD:
            return trail(x, z, span, px, py)
        return turf(x, z, px, py, stripes=False, patches=rough_patches)

    street(cv, paint)
    lanes(cv, "dbrown", dash=(7, 16))
    rail(cv, *PERCH_X, PERCH)
    return cv


def rail(cv, x0, x1, z):
    """A wooden park rail facing the camera: posts and a flat top rail to perch on."""
    lo, hi = min(x0, x1), max(x0, x1)
    for x in range(int(lo), int(hi), 48):
        front(cv, x, x + 8, z, 0, PERCH_H - 2, "dbrown")
    front(cv, lo, hi, z, PERCH_H - 6, PERCH_H, "brown")
    front(cv, lo, hi, z, 12, 18, "brown")


# Sniff Street Shops' flowers, in its planters and on its card
SHOP_FLOWERS = ("red", "yellow", "white", "amber")
# the planter along each curb, across: its brown sides on PLANTER[0]..+2 and PLANTER[1]-2..
PLANTER = (CURB, CURB + 16)


def sunburst(cv, cx, cy, n, a, b, y1, w=W):
    """Flat rays of a and b from cx, cy over rows 0 to y1: n of each round the half turn."""
    for py in range(y1):
        for px in range(w):
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
    """Sniff Street Shops' verge: a white curb, a flower planter along it (brown sides round
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
    cv = hp.Canvas(W, H)
    # a sunburst of sky and cyan rays from the end of the street, a cloud either side
    sunburst(cv, CX, BASE + 6, 7, "sky", "cyan", FAR_WALK)
    for x, y, w, p in ((10, 9, 30, 4), (300, 13, 38, 5)):
        cloud(cv, x, y, w, p, f"shops-{x}")
    # colour-blocked shopfronts across the street, the toy shop at the end of it
    for x, w, top, wall_c, awn, sign, board, letters in (
            (-4, 64, 22, "cream", "pink", "BAKERY", "dred", "yellow"),
            (CX - 116, 66, 16, "sky", "amber", "PETS", "navy", "yellow"),
            (CX - 50, 100, 6, "yellow", "red", "TOYS", "blue", "white"),
            (CX + 50, 70, 14, "green", "pink", "SCOOPS", "forest", "white"),
            (CX + 120, 66, 20, "purple", "cyan", "RECORDS", "plum", "cyan")):
        shopfront(cv, x, w, top, BASE, wall_c, awn, sign, board, letters)
    # bunting from roof to roof either side of the toy shop, above the sign boards
    bunting(cv, 0, CX - 50, 15, 5, ("red", "yellow", "sky", "green", "pink"))
    bunting(cv, CX + 50, W, 15, 5, ("pink", "sky", "yellow", "red", "green"))

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
# striped sun, Snooze Crescent's dusk after the sun has gone, cool at the top.
LONG_WAY_SKY = ("pink", "orange", "amber", "yellow")
SNOOZE_SKY = ("purple", "mauve", "pink", "skin1")


def long_way_home():
    cv = hp.Canvas(W, H)
    # a banded sunset, warm all the way up, and the low sun at the end of the street, striped,
    # setting behind the trees beyond the back yards
    bands(cv, 0, BASE, LONG_WAY_SKY)
    sun(cv, CX, 46, 24, "yellow", low=45)
    treeline(cv, 50, ("rust", "orange"), 4.0, 2, 7)
    leaves = grass()

    def lawn(px, py):
        return "orange" if hashed(px, py, 211) else leaves(px, py)

    yard(cv, 50, FAR_WALK, lawn)

    def road(x, z, span, px, py):
        a = abs(x)
        if a >= ROAD - 6:
            return "dbrown" if a < ROAD - 5 else "brown"
        return "skin1" if hashed(px, py, 31) else "skin2"

    # the porch houses across the street either side of the sunset, orange trees beside them
    for cx, top, r in ((8, 32, 15), (352, 34, 15), (CX - 46, 42, 9)):
        tree(cv, cx, top, "rust", "dbrown", r=r, base=BASE, girth=4 if r < 12 else 6)
    for x, w, wall_c, roof, door in ((CX - 150, 76, "white", "dred", "dgreen"),
                                     (CX + 72, 78, "skin1", "navy", "red")):
        porch_house(cv, x, w, wall_c, roof, door)
        path(cv, x + w // 2 - 6, BASE, FAR_WALK)
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
    return cv


def porch_house(cv, x, w, wall_c, roof, door, top=20):
    """A house with a porch along its front under its windows, a lamp lit by the door."""
    house(cv, x, w, wall_c, roof, door, top=top, base=BASE, roof_h=16, parts=SMALL[:3] + (10,))
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
    cv = hp.Canvas(W, H)
    road_c = SNOOZE_ROAD
    # a banded dusk sky, purple down to a last peach glow behind the roofs, a crescent moon and
    # the first stars
    bands(cv, 0, BASE, SNOOZE_SKY)
    for dy in range(-6, 7):
        for dx in range(-6, 7):
            if dx * dx + dy * dy <= 36 and (dx + 3) ** 2 + (dy - 2) ** 2 > 25:
                cv.fill(CX + 128 + dx, 12 + dy, 1, 1, "cream")
    for x, y in ((40, 4), (96, 8), (150, 3), (212, 6), (262, 2), (344, 7), (120, 15)):
        cv.fill(x, y, 1, 1, "white")

    def road(x, z, span, px, py):
        if abs(x) >= ROAD - 3:
            return road_c["gutter"]
        return road_c["fleck"] if hashed(px, py, 23) else road_c["road"]

    # quiet houses round the crescent, curtains drawn, dark trees between them
    homes = ((CX - 196, 64, "skin1", "dslate", "dgreen", "mauve"),
             (CX - 110, 62, "lgrey", "purple", "navy", "pink"),
             (CX - 31, 62, "cream", "navy", "dred", "tan"),
             (CX + 50, 62, "sky", "dslate", "white", "pink"),
             (CX + 134, 64, "skin1", "purple", "dgreen", "mauve"))
    for x, w, *_ in homes[1:]:
        tree(cv, x - 10, 36, "dgreen", "forest", r=10, base=BASE, girth=4)
    for x, w, wall_c, roof, door, curtain in homes:
        house(cv, x, w, wall_c, roof, door, top=26, base=BASE, roof_h=15, parts=SMALL, curtains=curtain)
    yard(cv, BASE, FAR_WALK, grass())
    for x, w, *_ in homes:
        path(cv, x + w // 2 - 6, BASE, FAR_WALK)
        fence(cv, FAR_WALK - 4, max(0, x - 4), x + w // 2 - 10, h=9)
        fence(cv, FAR_WALK - 4, x + w // 2 + 10, x + w + 6, h=9)
    top = FAR_WALK - 9
    fence_cat(cv, CX - 76, top)
    fence_cat(cv, CX + 26, top, "orange", "amber")
    fence_cat(cv, CX + 160, top, "dslate", "slate")
    bush(cv, CX - 150, FAR_WALK - 4, "dgreen", SHRUB)
    mailbox(cv, CX - 40, FAR_WALK, "blue")
    cross(cv, flat(road), road_c["gutter"], slabs, bend=crescent_bend)
    cross_line(cv, road_c["mark"], dash=(8, 32), bend=crescent_bend)
    street(cv, verge(road))
    lanes(cv, road_c["mark"], dash=(8, 32))
    ffence(cv, *PERCH_X, PERCH)
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
    cv = hp.Canvas(W, H)
    road_c = PROMENADE_ROAD
    sky(cv, clouds=((14, 12, 36, 6), (CX - 20, 8, 24, 4), (CX + 96, 14, 48, 7)))
    # the far bank: trees over a grassy bank, a stone edge and the river
    for cx, top, r in ((20, 26, 11), (CX - 60, 24, 12), (CX + 20, 28, 9), (CX + 150, 25, 12)):
        tree(cv, cx, top, "dgreen", "forest", r=r, base=36, girth=4)
    treeline(cv, 36, ("dgreen", "green"), 1.3, 2, 6)
    cv.fill(0, 36, W, 3, "green")
    cv.fill(0, 39, W, 2, "grey")
    water = 41, 56
    for py in range(*water):
        for px in range(W):
            c = "blue" if py < 44 else "sky"
            if hashed(px // 3, py, 9) and py % 3 == 0:
                c = "cyan" if py > 46 else "sky"
            if hashed(px, py, 61):
                c = "white"
            cv.fill(px, py, 1, 1, c)
    # ducks on the river and a rowboat
    for x in (CX - 120, CX - 110):
        cv.fill(x, 50, 5, 2, "white")
        cv.fill(x + 3, 48, 2, 2, "white")
        cv.fill(x + 5, 49, 1, 1, "amber")
        cv.fill(x, 52, 5, 1, "blue")
    cv.fill(CX + 50, 46, 22, 3, "brown")
    cv.fill(CX + 52, 49, 18, 1, "dbrown")
    cv.fill(CX + 59, 44, 2, 2, "red")
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

    rough_patches = rough("promenade-lawn", 8, WALK + 20, 600, Z0 + 10, Z0 + 90)

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
    return cv


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
    sheet = Image.new("RGB", (W * scale, (H + 6) * len(ZONES) * scale), hp.rgb("ink"))
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
