#!/usr/bin/env python3
"""Draw the four zone backdrops: the neighbourhood band between the top bar and the road.

backdrop-<zone>: 360x150 images in Endesga 32. The street ends at a T-junction:
the bottom rows continue the pseudo-3D road below the band (the same projection,
so the same road, curb and sidewalk edges at the same slope) up to a cross street
that runs flat across the band. Beyond it the far side faces the camera: the
zone's houses, park or shops under the sky. The scenery gags (cat on a perch,
sprinkler, rolling ball) are separate sprites the game places in this band, on
the near corners either side of the street.

Usage:
  backdrops.py preview OUT.png   all four, stacked, scaled up
  backdrops.py build             write art/backdrops/*.aseprite and
                                 public/art/images/*.png, and list them in the manifest

Run from the repository root, after fonts.py build. A build overwrites the
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
import help as hp  # noqa: E402
from pixel import DARKER, K  # noqa: E402

W, H = 360, 150
TITLE = None


def dk(c):
    return DARKER[K.get(c, c)]


def title_width(s):
    global TITLE
    if TITLE is None:
        TITLE = fonts.glyphs(*fonts.FONTS["font-title"][1:])[0]
    return sum(TITLE[ch][3] for ch in s)


def word(cv, s, mid, y, col):
    """Shop-sign lettering in font-title."""
    x = round(mid - title_width(s) / 2)
    for ch in s:
        mask, ox, oy, adv = TITLE[ch]
        if mask is not None:
            cv.img.paste(hp.rgb(col), (x + ox, y + oy), mask)
        x += adv


def sky(cv, top="cyan", low="sky", clouds=()):
    """The sky, with clouds given as (x, base row, width, puff): puff is the tallest lobe's radius."""
    cv.fill(0, 0, W, 104, low)
    cv.fill(0, 0, W, 14, top)
    for i in range(0, W, 5):
        cv.fill(i, 14 + (i // 5) % 2, 5, 1, top)
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


def streaks(cv, rows, body="pink", lit="cream"):
    """Sunset cloud streaks, (x, row, width): 2 rows of body, tapered at the ends, with the
    underside lit by the low sun."""
    for x, y, w in rows:
        cv.fill(x + 3, y, w - 9, 1, body)
        cv.fill(x, y + 1, w, 1, body)
        cv.fill(x + 5, y + 2, w - 12, 1, lit)


def ground(cv, lawn="green"):
    cv.fill(0, 104, W, 26, lawn)
    for i in range(70):
        cv.fill((i * 37) % W, 106 + (i * 11) % 22, 1, 2, dk(lawn))
    cv.fill(0, 130, W, 15, "lgrey")
    for x in range(0, W, 24):
        cv.fill(x, 130, 1, 15, "grey")
    cv.fill(0, 145, W, 3, "grey")
    cv.fill(0, 148, W, 2, "slate")


def house(cv, x, w, wall, roof, door="dred", top=40, base=104):
    """A house facing the camera, standing on row base: a gable roof 26 rows tall from top."""
    wall_y = top + 26
    cv.fill(x, wall_y, w, base - wall_y, wall)
    cv.fill(x + w - 3, wall_y, 3, base - wall_y, dk(wall))
    for i in range(26):
        inset = round(i * (w / 2 + 3) / 26)
        cv.fill(x - 3 + (w // 2 + 3) - inset, top + i, inset * 2, 1, roof)
    cv.fill(x - 3, wall_y - 1, w + 6, 2, dk(roof))
    cv.fill(x + w - 14, top + 4, 6, 12, "brown")
    cv.fill(x + w - 15, top + 2, 8, 2, "dbrown")
    for wx in (x + 6, x + w - 18):
        cv.fill(wx, wall_y + 6, 12, 10, "plum")
        cv.fill(wx + 1, wall_y + 7, 10, 8, "cyan")
        cv.fill(wx + 6, wall_y + 7, 1, 8, "white")
        cv.fill(wx + 1, wall_y + 11, 10, 1, "white")
        cv.fill(wx - 1, wall_y + 16, 14, 2, "white")
    dx = x + w // 2 - 5
    cv.fill(dx, base - 18, 10, 18, door)
    cv.fill(dx + 7, base - 9, 1, 2, "amber")
    cv.fill(dx - 2, base - 2, 14, 2, "lgrey")


def tree(cv, cx, top, leaf="green", shade="dgreen", trunk="dbrown", r=16, base=104, girth=6):
    """A round tree on row base, its crown centred on row top."""
    cv.fill(cx - girth // 2, top + r, girth, base - top - r, trunk)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                c = shade if dx + dy > r * 0.5 else ("yellow" if leaf == "green" and dx + dy < -r * 1.1 else leaf)
                cv.fill(cx + dx, top + dy, 1, 1, c)


def fence(cv, y=104, x0=0, x1=W, col="white"):
    for x in range(x0, x1, 6):
        cv.fill(x, y - 10, 4, 14, col)
        cv.fill(x + 3, y - 9, 1, 13, "lgrey")
    cv.fill(x0, y - 6, x1 - x0, 2, "lgrey")


def bush(cv, x, y, col="dgreen"):
    for dx, dy, r in ((0, 0, 6), (8, -2, 7), (16, 0, 6)):
        for yy in range(-r, r + 1):
            for xx in range(-r, r + 1):
                if xx * xx + yy * yy <= r * r and y + dy + yy <= y + 4:
                    cv.fill(x + dx + xx, y + dy + yy, 1, 1, col if xx + yy < 3 else dk(col))


def flowers(cv, x0, x1, y, cols=("red", "yellow", "pink", "white")):
    for i, x in enumerate(range(x0, x1, 4)):
        cv.fill(x, y + (i % 2), 2, 2, cols[i % len(cols)])
        cv.fill(x, y + 2 + (i % 2), 1, 2, "dgreen")


# ---------- the street and the junction ----------
# The road below the band recedes (camera B): a point z road pixels ahead of the walker's
# feet draws at scale s = F / (F + z), on screen row YH + KS s. The band's rows from STUB
# down continue that projection exactly, so the street's edges keep the road's slope across
# the band's bottom edge. World units are road pixels at scale 1: x across from the road's
# centre line, z along the road ahead of the feet, h up from the ground.

CX = 220                       # the road's centre: the dog column is x 0..80, the road 80..360
BAR = 40                       # the status bar's height: band row y is screen row BAR + y
YH, FOOT, RATIO = -260, 634, 1.4   # camera B: the horizon and foot rows on screen, ground speed r
KS = FOOT - YH
F = KS / RATIO                  # r = 1.4 puts 630 road px (5.25 s at 120 px/s) below the band
S0 = (BAR + H - 0.5 - YH) / KS  # scale on the band's bottom row (screen row 189)
ROAD, CURB, WALK = 140, 144, 188   # half the road, its curb and its sidewalk, as the game draws them
DIVIDERS = (-84, -28, 28, 84)      # lane divider lines, from the road's centre
# The cross street, in band rows from the far side down: the far sidewalk, the far curb, the
# road, the near curb and the near sidewalk, which the street's stub (rows STUB to the bottom)
# opens into. These rows are drawn flat rather than to the projection, which would spread the
# cross street over most of the band; across, they keep the projection's scale per row, so
# lines along the street (curbs, slab seams) still lean toward the road's centre line.
FAR_WALK, FAR_CURB, CROSS, NEAR_CURB, STUB = 96, 101, 103, 115, 123
LINE = 108                     # the cross street's centre line
CORNER = 5                     # the near corners' curb radius, in pixels
BASE = 90                      # the far side's ground row: the houses stand on it
PERCH = 634                    # the near-left perch's z: its top rail on rows 132 and 133, for the cat


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


def cross(cv, road, edge, walk, curb="grey", top=FAR_WALK):
    """Paint the cross street from row top down to the stub: walk(px, py) paints the sidewalks
    (and the far side's ground above them), road(px, py) the road and edge the road's pixels
    beside a curb. curb None leaves the road without curbs, as the park's paths are."""
    for py in range(top, STUB):
        for px in range(W):
            if py < FAR_CURB:
                c = walk(px, py)
            elif py < CROSS:
                c = curb or walk(px, py)
            else:
                d = kerb(px, py)
                if d >= (2 if curb else 0):
                    c = walk(px, py)
                elif d >= 0:
                    c = curb
                elif d >= -1 or py == CROSS:
                    c = edge
                else:
                    c = road(px, py)
            cv.fill(px, py, 1, 1, c)


def cross_line(cv, mark, edge=None, dash=(12, 32)):
    """The cross street's centre line on row LINE, dashed at world x like the stub's dividers,
    with edge on the row below it."""
    s = scale(LINE + 0.5)
    for px in range(W):
        if dash and ((px + 0.5 - CX) / s) % dash[1] >= dash[0]:
            continue
        cv.fill(px, LINE, 1, 1, mark)
        if edge:
            cv.fill(px, LINE + 1, 1, 1, edge)


def ffence(cv, x0, x1, z, col="white", h=30, gap=12):
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
    cv.fill(x, y - 14, 2, 14, "dbrown")
    cv.fill(x - 3, y - 20, 9, 6, col)
    cv.fill(x - 3, y - 15, 9, 1, dk(col))
    cv.fill(x + 6, y - 23, 2, 4, "amber")


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
        if at(x, max(z - rz, 632))[1] - at(x, z + rz)[1] >= 6:
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
    sky(cv, clouds=((8, 13, 46, 8), (126, 17, 20, 4), (236, 10, 34, 6), (322, 22, 18, 3)))

    def road(x, z, span, px, py):
        if abs(x) >= ROAD - 3:
            return "grey"
        return "slate" if hashed(px, py, 29) else "navy" if hashed(px, py + 3, 31) else "dslate"

    # the houses across the street, the middle one at the end of the street, a tree in each gap
    homes = ((-6, 72, "pink", "purple", "white"), (90, 74, "cream", "dred", "sky"),
             (182, 76, "sky", "navy", "red"), (284, 72, "tan", "brown", "dgreen"))
    for cx in (78, 167, 271):
        tree(cv, cx, 50, base=BASE)
    for x, w, wall_c, roof, door in homes:
        house(cv, x, w, wall_c, roof, door, top=30, base=BASE)
    yard(cv, BASE, FAR_WALK, grass())
    for x, w, *_ in homes:
        path(cv, x + w // 2 - 6, BASE, FAR_WALK)
        fence(cv, 92, max(0, x - 4), x + w // 2 - 10)
        fence(cv, 92, x + w // 2 + 10, x + w + 6)
    bush(cv, 106, 92)
    bush(cv, 300, 92, "green")
    flowers(cv, 190, 210, 92)
    flowers(cv, 238, 256, 93)
    for x in (52, 152, 340):
        mailbox(cv, x, FAR_WALK)
    cross(cv, flat(road), "grey", slabs)
    cross_line(cv, "lgrey")
    street(cv, verge(road))
    lanes(cv, "lgrey")
    ffence(cv, -196, -470, PERCH)
    return cv


def bark_park():
    cv = hp.Canvas(W, H)
    # two big billowing clouds clear of the gate, and a small one
    sky(cv, clouds=((2, 22, 58, 11), (124, 12, 18, 4), (290, 20, 62, 12)))
    treeline(cv, 66, ("dgreen", "green"), 2.5, 3, 9)
    # an unmown park: flat rough patches on the far lawn, tufts thinning toward the trees
    patches = [(150, 76, 30, 4), (178, 78, 22, 3), (300, 84, 34, 5), (330, 87, 20, 4), (60, 98, 28, 3)]

    def lawn(px, py):
        c = "green"
        if any(((px - qx) / rx) ** 2 + ((py - qy) / ry) ** 2 <= 1 for qx, qy, rx, ry in patches):
            c = "dgreen"
        return grass(c, 0.03 * ((py - 50) / 100) ** 2)(px, py)

    yard(cv, 66, CROSS, lawn)
    # the pond, on the left
    for py in range(78, 92):
        for px in range(20, 122):
            e = ((px + 0.5 - 70) / 46) ** 2 + ((py + 0.5 - 85) / 7) ** 2
            if e <= 1:
                cv.fill(px, py, 1, 1, "white" if hashed(px, py, 17) else "sky" if e > 0.5 else "cyan")
    for cx, top, r in ((22, 54, 10), (128, 52, 11), (318, 54, 10), (352, 58, 9)):
        tree(cv, cx, top, r=r, base=72, girth=4)
    for cx, top, r in ((132, 52, 16), (342, 50, 18), (8, 56, 20)):
        tree(cv, cx, top, r=r, base=96)
    # the park gate at the end of the path, its sign facing the street
    for x in (172, 266):
        cv.fill(x, 50, 3, 48, "dbrown")
    cv.fill(158, 40, 124, 16, "dgreen")
    cv.fill(158, 40, 124, 1, "green")
    cv.fill(158, 55, 124, 1, "forest")
    word(cv, "BARK PARK", CX, 44, "cream")
    for x in (152, 288):
        cv.fill(x, 58, 2, 40, "slate")
        cv.fill(x - 4, 52, 10, 7, "navy")
        cv.fill(x - 2, 54, 6, 4, "yellow")
    # a bench facing the street
    cv.fill(298, 88, 26, 3, "brown")
    cv.fill(298, 92, 26, 3, "brown")
    cv.fill(300, 95, 2, 4, "dbrown")
    cv.fill(320, 95, 2, 4, "dbrown")

    def trail(x, z, span, px, py):
        a = abs(x)
        if a >= ROAD - 2:
            return "brown"
        return "brown" if hashed(px, py, 13) else "cream" if hashed(px, py + 5, 23) else "tan"

    # the path on into the park, through the gate
    for py in range(80, CROSS):
        half = 22 + (py - 80) // 3
        cv.fill(CX - half, py, 2 * half, 1, "brown")
        for px in range(CX - half + 1, CX + half - 1):
            cv.fill(px, py, 1, 1, trail(0, 0, 99, px, py))
    cross(cv, flat(trail), "brown", lawn, curb=None, top=CROSS)
    cross_line(cv, "dbrown", dash=(7, 16))
    rough_patches = rough("bark-park-lawn", 10, ROAD + 30, 600, 640, 720)

    def paint(x, z, span, px, py):
        if abs(x) < ROAD:
            return trail(x, z, span, px, py)
        return turf(x, z, px, py, stripes=False, patches=rough_patches)

    street(cv, paint)
    lanes(cv, "dbrown", dash=(7, 16))
    rail(cv, -170, -470, PERCH)
    return cv


def rail(cv, x0, x1, z):
    """A wooden park rail facing the camera: posts and a flat top rail to perch on."""
    lo, hi = min(x0, x1), max(x0, x1)
    for x in range(int(lo), int(hi), 48):
        front(cv, x, x + 8, z, 0, 30, "dbrown")
    front(cv, lo, hi, z, 24, 32, "brown")
    front(cv, lo, hi, z, 12, 18, "brown")


def shops():
    cv = hp.Canvas(W, H)
    # flatter clouds above the rooftops
    sky(cv, clouds=((22, 11, 30, 4), (150, 9, 64, 5), (300, 13, 26, 4)))

    def paint(x, z, span, px, py):
        a = abs(x)
        if a < ROAD:
            if a >= ROAD - 4:
                return "slate" if a < ROAD - 1 else "grey"
            if span < 6 and crosses(z, span, 16):
                return "grey"
            return "white" if hashed(px, py, 19) else "lgrey"
        if a < CURB:
            return "grey"
        if span < 16 and crosses(z, span, 32):
            return "grey"
        return "grey" if hashed(px, py, 29) else "lgrey"

    def paving(px, py):
        return "grey" if seam(px, py) or hashed(px, py, 29) else "lgrey"

    # the shopfronts across the street, the bookshop at the end of it
    for x, w, top, wall_c, awn, sign in ((0, 90, 26, "rust", "red", "CAFE"), (90, 88, 20, "cream", "dgreen", "PETS"),
                                         (178, 92, 24, "tan", "blue", "BOOKS"), (270, 90, 18, "lgrey", "amber", "BAKERY")):
        shopfront(cv, x, w, top, 88, wall_c, awn, sign)
    yard(cv, 88, FAR_WALK, paving)
    for x in (30, 122, 236, 300):
        planter(cv, x, 95)
    cross(cv, flat(paint), "slate", paving)
    cross_line(cv, "slate", dash=None)
    street(cv, paint)
    lanes(cv, "slate", dash=None, span=14)
    planter_wall(cv, -196, -470, PERCH)
    return cv


def shopfront(cv, x, w, top, base, wall_c, awn, sign):
    """A shop facing the camera, rows top to base: upstairs windows, a sign board, a striped
    awning over the shop window and the door."""
    cv.fill(x, top, w, base - top, wall_c)
    cv.fill(x, top, w, 4, dk(wall_c))
    cv.fill(x + w - 2, top, 2, base - top, dk(wall_c))
    for wx in (x + 12, x + w - 26):
        cv.fill(wx, base - 58, 14, 12, "plum")
        cv.fill(wx + 1, base - 57, 12, 10, "cyan")
    cv.fill(x + 8, base - 42, w - 16, 13, "plum")
    word(cv, sign, x + w / 2, base - 40, "cream")
    for i in range(0, w - 4, 8):
        cv.fill(x + 2 + i, base - 27, 4, 7, awn)
        cv.fill(x + 6 + i, base - 27, 4, 7, "white")
    cv.fill(x + 2, base - 21, w - 4, 1, dk(awn))
    cv.fill(x + 8, base - 18, w - 40, 17, "plum")
    cv.fill(x + 9, base - 17, w - 42, 15, "cyan")
    cv.fill(x + 12, base - 14, 8, 1, "white")
    cv.fill(x + w - 26, base - 19, 14, 19, "dbrown")
    cv.fill(x + w - 16, base - 10, 1, 2, "amber")


def planter(cv, x, y):
    """A planter on the far sidewalk, its box standing on row y."""
    cv.fill(x, y - 6, 14, 6, "brown")
    cv.fill(x, y - 6, 14, 1, "dbrown")
    bush(cv, x - 2, y - 7, "green")


def planter_wall(cv, x0, x1, z):
    """A low brick planter facing the camera, its top a ledge to perch on."""
    lo, hi = min(x0, x1), max(x0, x1)
    front(cv, lo, hi, z, 0, 28, "rust")
    front(cv, lo, hi, z, 24, 30, "lgrey")
    for x in range(int(lo), int(hi), 30):
        front(cv, x, x + 2, z, 0, 24, "dbrown")


def long_way_home():
    cv = hp.Canvas(W, H)
    sky(cv, "amber", "yellow")
    # long streaks instead of puffs, and one across the sun below
    streaks(cv, ((14, 8, 64), (96, 18, 40), (244, 11, 84), (300, 22, 44), (4, 30, 40)))
    # the low sun at the end of the street, setting behind the trees beyond the back yards
    for dy in range(-22, 1):
        for dx in range(-22, 23):
            if dx * dx + dy * dy <= 22 * 22:
                cv.fill(CX + dx, 67 + dy, 1, 1, "white" if dx * dx + dy * dy <= 16 * 16 else "cream")
    streaks(cv, ((184, 53, 72),))
    treeline(cv, 72, ("rust", "orange"), 4.0, 2, 8)
    leaves = grass()

    def lawn(px, py):
        return "orange" if hashed(px, py, 211) else leaves(px, py)

    yard(cv, 72, FAR_WALK, lawn)

    def road(x, z, span, px, py):
        a = abs(x)
        if a >= ROAD - 6:
            return "dbrown" if a < ROAD - 5 else "brown"
        return "skin1" if hashed(px, py, 31) else "skin2"

    # the porch houses across the street either side of the sunset, orange trees beside them
    for cx, top, r in ((38, 48, 20), (346, 50, 20), (170, 60, 12)):
        tree(cv, cx, top, "orange", "rust", r=r, base=BASE, girth=4 if r < 16 else 6)
    for x, w, wall_c, roof, door in ((70, 82, "white", "dred", "dgreen"), (254, 84, "skin1", "navy", "red")):
        porch_house(cv, x, w, wall_c, roof, door)
        path(cv, x + w // 2 - 6, BASE, FAR_WALK)
    fence(cv, 92, 0, 18)
    fence(cv, 92, 160, 250)
    flowers(cv, 74, 104, 92, ("orange", "yellow", "red"))
    flowers(cv, 300, 334, 92, ("orange", "yellow", "red"))
    cross(cv, flat(road), "brown", slabs)
    cross_line(cv, "white", "plum", dash=(14, 32))
    street(cv, verge(road))
    lanes(cv, "white", "plum", dash=(14, 32))
    fallen(cv, random.Random("home-leaves"), 110)
    ffence(cv, -196, -470, PERCH)
    return cv


def porch_house(cv, x, w, wall_c, roof, door, top=24):
    """A house with a porch along its front, a lamp lit by the door."""
    house(cv, x, w, wall_c, roof, door, top=top, base=BASE)
    cv.fill(x + 8, BASE - 21, w - 16, 3, "brown")
    cv.fill(x + 10, BASE - 18, 2, 16, "brown")
    cv.fill(x + w - 12, BASE - 18, 2, 16, "brown")
    cv.fill(x + w // 2 - 9, BASE - 17, 3, 4, "yellow")


# leaves on the sidewalks and lawns: a lit half (f) and a shaded half (v), in rust and ochre
LEAF_SHAPES = (("ff.", ".fv"), (".ff", "fv."), (".f", "fv"))
LEAF_TONES = (("ochre", "rust"), ("rust", "dbrown"), ("ochre", "dbrown"))


def fallen(cv, rnd, n):
    """n leaves on the sidewalks and lawns from the far sidewalk down, falling thicker toward
    the band's bottom edge; none on the road."""
    for _ in range(n):
        py = round(149 - (1 - rnd.random() ** 0.6) * (149 - FAR_WALK))
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
}


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
    path = "public/art/manifest.json"
    manifest = json.load(open(path))
    entries = {i["key"]: i for i in manifest.get("images", [])}
    for key in ZONES:
        entries[key] = {"key": key, "png": f"images/{key}.png"}
    manifest["images"] = sorted(entries.values(), key=lambda i: i["key"])
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print("built", ", ".join(ZONES))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
