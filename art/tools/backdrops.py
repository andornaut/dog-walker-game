#!/usr/bin/env python3
"""Draw the four zone backdrops: the neighbourhood band between the top bar and the road.

backdrop-<zone>: 360x150 images in Endesga 32. The street runs into the
distance: the bottom row continues the pseudo-3D road below the band (same
road, curb and sidewalk edges), and the road narrows to a vanishing point on
the horizon above x = 220, the road's centre line. Sky above, the zone's
buildings or trees along both sides in perspective. The scenery gags (cat on
a fence, sprinkler, rolling ball) are separate sprites the game places in
this band, on the near lawns either side of the road.

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


def house(cv, x, w, wall, roof, door="dred", top=40):
    wall_y = top + 26
    cv.fill(x, wall_y, w, 104 - wall_y, wall)
    cv.fill(x + w - 3, wall_y, 3, 104 - wall_y, dk(wall))
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
    cv.fill(dx, 86, 10, 18, door)
    cv.fill(dx + 7, 95, 1, 2, "amber")
    cv.fill(dx - 2, 102, 14, 2, "lgrey")


def tree(cv, cx, top, leaf="green", shade="dgreen", trunk="dbrown", r=16):
    cv.fill(cx - 3, top + r, 6, 104 - top - r, trunk)
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


# ---------- the street in perspective ----------
# The road below the band recedes (camera B): a point d road pixels ahead of the
# walker's feet draws at scale s = F / (F + d), on screen row YH + KS s. The
# band's bottom row continues that road exactly (same edges, same slope), then
# the street rises gently to the band's own horizon so the sky stays in view.
# World units are road pixels at scale 1: X across from the road's centre
# line, Z along the road ahead of the feet, h up from the ground.

CX = 220                       # the road's centre: the dog column is x 0..80, the road 80..360
HZ = 58                        # the horizon row; the street's vanishing point is (CX, HZ)
YH, FOOT, RATIO = -260, 634, 1.4   # camera B: the horizon and foot rows on screen, ground speed r
KS = FOOT - YH
F = KS / RATIO                  # r = 1.4 puts 630 road px (5.25 s at 120 px/s) below the band
S0 = (40 + H - 0.5 - YH) / KS  # scale on the band's bottom row (screen row 189)
_U = H - 0.5 - HZ
BEND = 2                       # ds/dy on the bottom row, over the road's 1/KS below it
_B = (BEND * _U / KS - S0) / _U ** 2   # s(y) = A u + B u^2, u rows below the horizon:
_A = BEND / KS - 2 * _B * _U           # s = S0 on the bottom row, 0 on the horizon
ROAD, CURB, WALK = 140, 144, 188   # half the road, its curb and its sidewalk, as the game draws them
DIVIDERS = (-84, -28, 28, 84)      # lane divider lines, from the road's centre


def scale(yc):
    """Scale of the ground at row centre yc (y + 0.5)."""
    u = yc - HZ
    return _A * u + _B * u * u


def at(x, z, h=0):
    """Screen position of the world point x across, z along, h up."""
    s = F / (F + z)
    y = HZ + (-_A + (_A * _A + 4 * _B * s) ** 0.5) / (2 * _B)
    return CX + x * s, y - h * s, s


def poly(cv, pts, c):
    from PIL import ImageDraw

    xy = [(round(at(*p)[0] - 0.5), round(at(*p)[1] - 0.5)) for p in pts]
    ImageDraw.Draw(cv.img).polygon(xy, fill=hp.rgb(K.get(c, c)))


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
    """Paint every ground pixel below the horizon: paint(x, z, span, px, py) gives its
    colour, where span is the length of road the row covers."""
    for py in range(int(HZ) + 1, H):
        s = scale(py + 0.5)
        z = F / s - F
        span = z - (F / scale(py + 1.5) - F)
        for px in range(W):
            cv.fill(px, py, 1, 1, paint((px + 0.5 - CX) / s, z, span, px, py))


def crosses(z, span, period):
    """Whether a line every period along the road falls in this row."""
    return z // period != (z - max(span, 1)) // period


def lanes(cv, mark, edge=None, dash=(12, 32), span=6):
    """The lane dividers, 1px wide and converging; dashes stop where a row spans too much road."""
    for py in range(int(HZ) + 1, H):
        s = scale(py + 0.5)
        z, z1 = F / s - F, F / scale(py + 1.5) - F
        if z - z1 > span or (dash and z % dash[1] >= dash[0]):
            continue
        for d in DIVIDERS:
            x = round(CX + d * s - 0.5)
            cv.fill(x, py, 1, 1, mark)
            if edge:
                cv.fill(x + 1, py, 1, 1, edge)


def wall(cv, x, z0, z1, h0, h1, c):
    """A patch on a wall that runs along the street (it faces the road)."""
    poly(cv, [(x, z0, h0), (x, z1, h0), (x, z1, h1), (x, z0, h1)], c)


def front(cv, x0, x1, z, h0, h1, c):
    """A patch on a wall that faces the camera."""
    poly(cv, [(x0, z, h0), (x1, z, h0), (x1, z, h1), (x0, z, h1)], c)


def block(cv, side, x0, x1, z0, z1, h, c, ridge=0, roof=None):
    """A building beside the street: x0..x1 out from the centre line, z0..z1 along it,
    walls h high. Draws the wall facing the road, the roof (a gable along the street
    when ridge > 0) and the end wall facing the camera."""
    xi, xo, xm = side * x0, side * x1, side * (x0 + x1) / 2
    wall(cv, xi, z0, z1, 0, h, dk(c))
    if ridge:
        poly(cv, [(xo, z0, h), (xo, z1, h), (xm, z1, h + ridge), (xm, z0, h + ridge)], dk(roof))
        poly(cv, [(xi - side * 6, z0, h - 4), (xi - side * 6, z1, h - 4), (xm, z1, h + ridge), (xm, z0, h + ridge)], roof)
        front(cv, xi, xo, z0, 0, h, c)
        poly(cv, [(xi, z0, h), (xo, z0, h), (xm, z0, h + ridge)], c)
        poly(cv, [(xi - side * 6, z0, h - 4), (xm, z0, h + ridge), (xm, z0, h + ridge - 8), (xi, z0, h - 10)], dk(roof))
        poly(cv, [(xo + side * 6, z0, h - 4), (xm, z0, h + ridge), (xm, z0, h + ridge - 8), (xo, z0, h - 10)], dk(roof))
    else:
        poly(cv, [(xi, z0, h), (xo, z0, h), (xo, z1, h), (xi, z1, h)], roof or dk(dk(c)))
        front(cv, xi, xo, z0, 0, h, c)


def phouse(cv, side, z, wall_c, roof, door, x0=236, w=170, d=190, h=96, ridge=56):
    """A house end-on to the street: its gable faces the camera, its door the road."""
    xi, xo, xm = side * x0, side * (x0 + w), side * (x0 + w / 2)
    block(cv, side, x0, x0 + w, z, z + d, h, wall_c, ridge, roof)
    # chimney on the far half of the roof
    cz = z + d * 0.7
    cx = side * (x0 + w * 0.3)
    poly(cv, [(cx, cz, h + 30), (cx + side * 16, cz, h + 30), (cx + side * 16, cz, h + 66), (cx, cz, h + 66)], "brown")
    # gable window and two windows on the end wall
    front(cv, xm - 14, xm + 14, z, h + 6, h + 30, "plum")
    front(cv, xm - 11, xm + 11, z, h + 9, h + 27, "cyan")
    for wx in (xi + side * 22, xo - side * 58):
        front(cv, wx, wx + side * 36, z, 34, 70, "plum")
        front(cv, wx + side * 3, wx + side * 33, z, 37, 67, "cyan")
        front(cv, wx + side * 17, wx + side * 19, z, 37, 67, "white")
        front(cv, wx - side * 3, wx + side * 39, z, 30, 34, "white")
    # the front door and a window on the road side
    wall(cv, xi, z + d * 0.45, z + d * 0.65, 0, 58, door)
    wall(cv, xi, z + d * 0.45, z + d * 0.65, 58, 62, "white")
    wall(cv, xi, z + d * 0.12, z + d * 0.32, 34, 70, "plum")
    wall(cv, xi, z + d * 0.14, z + d * 0.30, 38, 66, "cyan")


def ptree(cv, x, z, leaf="green", shade="dgreen", trunk="dbrown", r=44, h=110):
    """A round tree standing at x, z."""
    tx, ty, s = at(x, z)
    _, cy, _ = at(x, z, h)
    tw = max(1, round(10 * s))
    cv.fill(round(tx - tw / 2), round(cy), tw, round(ty - cy), trunk)
    rr = max(1.5, r * s)
    for dy in range(-int(rr) - 1, int(rr) + 2):
        for dx in range(-int(rr) - 1, int(rr) + 2):
            if dx * dx + dy * dy <= rr * rr:
                c = shade if dx + dy > rr * 0.5 else ("yellow" if leaf == "green" and dx + dy < -rr * 1.1 else leaf)
                cv.fill(round(tx) + dx, round(cy) + dy, 1, 1, c)


def pbush(cv, x, z, col="dgreen", r=16):
    tx, ty, s = at(x, z)
    rr = max(1, r * s)
    for dy in range(-int(rr) - 1, 1):
        for dx in range(-int(rr * 1.6) - 1, int(rr * 1.6) + 2):
            if (dx / 1.6) ** 2 + dy * dy <= rr * rr:
                cv.fill(round(tx) + dx, round(ty) + dy, 1, 1, col if dx + dy < 0 else dk(col))


def pfence(cv, x, z0, z1, col="white", h=30, gap=14):
    """A picket fence along the street at x, from z0 to z1."""
    z = z0
    while z < z1:
        poly(cv, [(x, z, 0), (x, z + gap * 0.5, 0), (x, z + gap * 0.5, h), (x, z, h)], col)
        z += gap
    wall(cv, x, z0, z1, h * 0.55, h * 0.7, "lgrey")


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


def mailbox(cv, x, z, col="red"):
    front(cv, x - 2, x + 2, z, 0, 34, "dbrown")
    front(cv, x - 10, x + 10, z, 34, 50, col)
    front(cv, x + 10, x + 14, z, 46, 58, "amber")


def horizon(cv, cols, seed, lo=2, hi=7, gap=10):
    """Far rooftops or treetops along the horizon, clear of the vanishing point."""
    for x in range(W):
        if abs(x + 0.5 - CX) < gap:
            continue
        t = (x * 0.21 + seed) % 6.283
        hgt = lo + round((hi - lo) * (0.5 + 0.5 * math.sin(t) * math.cos(t * 2.3 + seed)))
        hgt = max(1, hgt - max(0, (gap + 14 - abs(x - CX))) // 3)
        cv.fill(x, HZ - hgt + 1, 1, hgt, cols[0])
        cv.fill(x, HZ - hgt + 1, 1, 1, cols[1])


def scene(cv, things):
    """Draw (z, draw) pairs from the farthest in."""
    for _, draw in sorted(things, key=lambda t: -t[0]):
        draw()


# Lawn texture follows the road strips' rule: mown stripes run along the street and converge
# on the vanishing point (stripes across it band and shimmer as rows span more lawn), their
# widths vary, and each ends where it would draw under 4px wide. Tufts are 2-row marks, placed
# irregularly and thinning out with distance, so far lawn stays plain.
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
        rx, rz = rnd.uniform(30, 90), rnd.uniform(50, 150)
        if at(x, max(z - rz, 640))[1] - at(x, z + rz)[1] >= 6:
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


def woof_way():
    cv = hp.Canvas(W, H)
    # fair-weather puffs of mixed sizes, spread unevenly
    sky(cv, clouds=((8, 13, 46, 8), (120, 27, 20, 4), (230, 10, 34, 6), (318, 33, 18, 3)))
    horizon(cv, ("dgreen", "green"), 1.0)

    def road(x, z, span, px, py):
        if abs(x) >= ROAD - 3:
            return "grey"
        return "slate" if hashed(px, py, 29) else "navy" if hashed(px, py + 3, 31) else "dslate"

    street(cv, verge(road))
    lanes(cv, "lgrey")
    homes = (("cream", "dred", "sky"), ("sky", "navy", "red"), ("pink", "purple", "white"), ("tan", "brown", "dgreen"))
    things = []
    for side, z0 in ((-1, 690), (1, 860)):
        for i in range(12):
            z = z0 + i * 360
            wall_c, roof, door = homes[(i * 2 + (side > 0)) % 4]
            things.append((z, lambda side=side, z=z, w=wall_c, r=roof, d=door: phouse(cv, side, z, w, r, d)))
            if i % 2 == (side > 0):
                things.append((z - 60, lambda side=side, z=z: ptree(cv, side * 212, z - 60)))
            if i % 2 == 0:
                things.append((z + 120, lambda side=side, z=z: mailbox(cv, side * 204, z + 120)))
            things.append((z + 210, lambda side=side, z=z: pfence(cv, side * 196, z + 200, z + 330)))
    things.append((640, lambda: ffence(cv, -196, -470, 640)))
    things.append((660, lambda: pbush(cv, 300, 660)))
    scene(cv, things)
    return cv


def bark_park():
    cv = hp.Canvas(W, H)
    # two big billowing clouds clear of the gate, and a small one
    sky(cv, clouds=((2, 20, 58, 11), (128, 9, 18, 4), (284, 17, 66, 12)))
    horizon(cv, ("dgreen", "green"), 2.5, 3, 9)
    # an unmown park: rough patches instead of stripes
    patches = rough("bark-park-lawn", 26, ROAD + 30, 900, 640, 2000)

    def path(x, z, span, px, py):
        a = abs(x)
        if a >= ROAD - 2:
            return "brown"
        return "brown" if hashed(px, py, 13) else "cream" if hashed(px, py + 5, 23) else "tan"

    def paint(x, z, span, px, py):
        a = abs(x)
        if a < ROAD:
            return path(x, z, span, px, py)
        # the pond, on the left
        if ((x + 360) / 120) ** 2 + ((z - 1250) / 260) ** 2 <= 1:
            return "white" if hashed(px, py, 17) else "sky" if ((x + 360) / 120) ** 2 + ((z - 1250) / 260) ** 2 > 0.55 else "cyan"
        return turf(x, z, px, py, stripes=False, patches=patches)

    street(cv, paint)
    lanes(cv, "dbrown", dash=(7, 16))
    things = []
    for side, x, z, r in ((-1, 260, 760, 48), (-1, 520, 980, 56), (-1, 300, 1700, 50), (-1, 560, 2300, 60),
                          (-1, 260, 3000, 50), (1, 230, 900, 46), (1, 420, 1400, 56), (1, 250, 2100, 50),
                          (1, 480, 2900, 60), (1, 240, 4200, 50), (-1, 300, 5200, 56), (1, 330, 6400, 56)):
        things.append((z, lambda side=side, x=x, z=z, r=r: ptree(cv, side * x, z, r=r, h=r * 2.4)))
    for z in (800, 1300, 1900, 2700, 3700):
        for side in (-1, 1):
            things.append((z, lambda side=side, z=z: lamp(cv, side * 158, z)))
    things.append((1150, lambda: bench(cv, 1, 200, 1150)))
    things.append((2400, lambda: bench(cv, -1, 200, 2400)))
    things.append((1500, lambda: gate(cv, 1500, "BARK PARK")))
    things.append((640, lambda: rail(cv, -170, -470, 640)))
    scene(cv, things)
    return cv


def lamp(cv, x, z):
    front(cv, x - 3, x + 3, z, 0, 150, "slate")
    front(cv, x - 12, x + 12, z, 150, 168, "navy")
    front(cv, x - 8, x + 8, z, 153, 165, "yellow")


def bench(cv, side, x, z):
    xi, xo = side * x, side * (x + 30)
    poly(cv, [(xi, z, 22), (xo, z, 22), (xo, z + 90, 22), (xi, z + 90, 22)], "brown")
    wall(cv, xo, z, z + 90, 26, 46, "brown")
    wall(cv, xo, z, z + 90, 26, 28, "dbrown")
    front(cv, xi, xi + side * 4, z, 0, 22, "dbrown")
    front(cv, xo - side * 4, xo, z, 0, 46, "dbrown")


def rail(cv, x0, x1, z):
    """A wooden park rail facing the camera: posts and a flat top rail to perch on."""
    lo, hi = min(x0, x1), max(x0, x1)
    for x in range(int(lo), int(hi), 48):
        front(cv, x, x + 8, z, 0, 30, "dbrown")
    front(cv, lo, hi, z, 24, 32, "brown")
    front(cv, lo, hi, z, 12, 18, "brown")


def gate(cv, z, sign):
    """An arch over the path, its board facing the camera."""
    for x in (-ROAD - 20, ROAD + 8):
        front(cv, x, x + 12, z, 0, 236, "dbrown")
    front(cv, -ROAD - 26, ROAD + 26, z, 196, 250, "dgreen")
    front(cv, -ROAD - 26, ROAD + 26, z, 196, 200, "forest")
    front(cv, -ROAD - 26, ROAD + 26, z, 246, 250, "green")
    _, mid, _ = at(0, z, 223)
    word(cv, sign, CX, round(mid) - 4, "cream")


def shops():
    cv = hp.Canvas(W, H)
    # flatter clouds above the rooftops, one long bank over the gap down the street
    sky(cv, clouds=((28, 9, 28, 4), (148, 19, 72, 6), (292, 7, 26, 4)))
    horizon(cv, ("slate", "grey"), 0.4, 4, 12)

    def paint(x, z, span, px, py):
        a = abs(x)
        if a < ROAD:
            if a >= ROAD - 4:
                return "slate" if a < ROAD - 1 else "grey"
            off = 14 if (z // 16) % 2 else 0
            if span < 6 and (crosses(z, span, 16) or ((x + 140 + off) % 28 < 1 / max(0.05, F / (F + z)) and span < 3)):
                return "grey"
            return "white" if hashed(px, py, 19) else "lgrey"
        if a < CURB:
            return "grey"
        if span < 16 and crosses(z, span, 32):
            return "grey"
        return "grey" if hashed(px, py, 29) else "lgrey"

    street(cv, paint)
    lanes(cv, "slate", dash=None, span=14)
    things = []
    # the nearest shop on each side has its name painted on its end wall, the next a hanging sign
    names = {(-1, 0): ("CAFE", "red", "rust"), (-1, 1): ("PETS", "dgreen", "cream"),
             (1, 0): ("BAKERY", "amber", "lgrey"), (1, 1): ("BOOKS", "blue", "tan")}
    walls = ("rust", "cream", "lgrey", "tan", "skin1", "pink")
    awnings = ("red", "dgreen", "amber", "blue", "purple", "orange")
    for side, z0 in ((-1, 680), (1, 1000)):
        for i in range(12):
            z = z0 + i * 440
            sign, awn, wall_c = names.get((side, i), (None, awnings[(i * 2 + side) % 6], walls[(i * 3 + side) % 6]))
            h = (230, 200, 250, 210)[(i + (side > 0)) % 4]
            things.append((z, lambda side=side, z=z, h=h, w=wall_c, a=awn, n=sign, e=i == 0:
                           shop(cv, side, z, h, w, a, n if e else None)))
            if sign and i:
                things.append((z - 1, lambda side=side, z=z, n=sign: blade(cv, side, z + 40, n)))
            things.append((z - 30, lambda side=side, z=z: planter(cv, side * 194, z - 30)))
    # the cafe's tables on the corner across the street
    things.append((680, lambda: parasol(cv, 250, 680, "red")))
    things.append((640, lambda: planter_wall(cv, -196, -470, 640)))
    scene(cv, things)
    return cv


def shop(cv, side, z, h, wall_c, awn, sign, x0=204, w=200, d=380):
    xi, xo = side * x0, side * (x0 + w)
    block(cv, side, x0, x0 + w, z, z + d, h, wall_c, roof=dk(dk(wall_c)))
    # the shop window, door and striped awning along the street
    wall(cv, xi, z + 30, z + 250, 12, 78, "plum")
    wall(cv, xi, z + 36, z + 244, 16, 74, "cyan")
    wall(cv, xi, z + 280, z + 340, 0, 84, "dbrown")
    for k in range(0, 300, 40):
        wall(cv, xi - side * 4, z + 20 + k, z + 40 + k, 86, 104, awn)
        wall(cv, xi - side * 4, z + 40 + k, z + 60 + k, 86, 104, "white")
    wall(cv, xi - side * 4, z + 20, z + 320, 84, 88, dk(awn))
    # upstairs windows
    for k in (40, 160, 280):
        wall(cv, xi, z + k, z + k + 60, 130, 170, "plum")
        wall(cv, xi, z + k + 4, z + k + 56, 134, 166, "cyan")
    # a window on the end wall, or the shop's name painted there
    fx0, fy, _ = at(xi, z, h - 20)
    fx1, _, _ = at(xo, z, 0)
    if not sign:
        front(cv, xi + side * 40, xo - side * 40, z, 120, 170, "plum")
        front(cv, xi + side * 46, xo - side * 46, z, 126, 164, "cyan")
        return
    mid = (fx0 + fx1) / 2 if side < 0 else min((fx0 + fx1) / 2, (fx0 + W) / 2)
    tw = title_width(sign)
    cv.fill(round(mid - tw / 2 - 4), round(fy), tw + 8, 13, "plum")
    word(cv, sign, mid, round(fy) + 2, "cream")
    front(cv, xi + side * 40, xo - side * 40, z, 40, 90, "plum")
    front(cv, xi + side * 46, xo - side * 46, z, 46, 84, "cyan")


def blade(cv, side, z, sign, h=150):
    """A shop's sign hanging out over the sidewalk on a bracket, its face to the camera."""
    x, y, _ = at(side * 204, z, h)
    w = title_width(sign) + 8
    x0 = round(x) - w if side > 0 else round(x)
    cv.fill(x0, round(y) - 2, w, 1, "plum")
    cv.fill(x0 + (2 if side < 0 else w - 3), round(y) - 1, 1, 1, "plum")
    cv.fill(x0, round(y), w, 12, "plum")
    word(cv, sign, x0 + w / 2, round(y) + 2, "cream")


def parasol(cv, x, z, col):
    """A cafe table under a striped parasol."""
    front(cv, x - 3, x + 3, z, 0, 90, "lgrey")
    front(cv, x - 26, x + 26, z, 30, 36, "white")
    front(cv, x - 4, x + 4, z, 0, 30, "grey")
    _, top, s = at(x, z, 108)
    _, low, _ = at(x, z, 88)
    cx, _, _ = at(x, z)
    r = 56 * s
    for row in range(round(top), round(low) + 1):
        k = (row - top) / max(1, low - top)
        half = round(r * (0.25 + 0.75 * k))
        for dx in range(-half, half + 1):
            cv.fill(round(cx) + dx, row, 1, 1, col if (dx + 64) // 4 % 2 else "white")


def planter(cv, x, z):
    front(cv, x - 14, x + 14, z, 0, 18, "brown")
    pbush(cv, x, z, "green", 18)


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
    streaks(cv, ((14, 8, 64), (96, 21, 38), (244, 11, 84), (286, 29, 50), (8, 35, 46)))
    # the low sun behind the end of the road, behind the streaks
    for dy in range(-22, 1):
        for dx in range(-22, 23):
            if dx * dx + dy * dy <= 22 * 22:
                cv.fill(CX + dx, HZ + dy, 1, 1, "white" if dx * dx + dy * dy <= 16 * 16 else "cream")
    streaks(cv, ((180, 44, 76),))
    horizon(cv, ("rust", "orange"), 4.0, 2, 8, gap=24)

    def road(x, z, span, px, py):
        a = abs(x)
        if a >= ROAD - 6:
            return "dbrown" if a < ROAD - 5 else "brown"
        off = 7 if (z // 8) % 2 else 0
        if span < 4 and (crosses(z, span, 8) or (x + 140 + off) % 14 < 1 / (F / (F + z))):
            return "brown"
        return "skin1" if hashed(px, py, 31) else "skin2"

    street(cv, verge(road))
    fallen(cv, random.Random("home-leaves"), 90)
    lanes(cv, "white", "plum", dash=(14, 32))
    homes = (("white", "dred", "dgreen"), ("skin1", "navy", "red"), ("cream", "brown", "blue"), ("pink", "plum", "white"))
    things = []
    for side, z0 in ((-1, 700), (1, 880)):
        for i in range(12):
            z = z0 + i * 380
            wall_c, roof, door = homes[(i * 2 + (side > 0)) % 4]
            things.append((z, lambda side=side, z=z, w=wall_c, r=roof, d=door: porch_house(cv, side, z, w, r, d)))
            if i % 2 == (side < 0):
                things.append((z - 60, lambda side=side, z=z: ptree(cv, side * 214, z - 60, "orange", "rust", r=48, h=120)))
    things.append((640, lambda: ffence(cv, -196, -470, 640)))
    scene(cv, things)
    return cv


# leaves on the near verges: a lit half (f) and a shaded half (v), in rust and ochre
LEAF_SHAPES = (("ff.", ".fv"), (".ff", "fv."), (".f", "fv"))
LEAF_TONES = (("ochre", "rust"), ("rust", "dbrown"), ("ochre", "dbrown"))


def fallen(cv, rnd, n):
    """n leaves on the sidewalks and lawns below row 96, so none shrink under a pixel; they
    fall thicker toward the band's bottom edge."""
    for _ in range(n):
        py = round(149 - (1 - rnd.random() ** 0.6) * 53)
        px = rnd.randrange(W)
        if abs((px + 0.5 - CX) / scale(py + 0.5)) < ROAD + 6:
            continue
        tones = dict(zip("fv", rnd.choice(LEAF_TONES)))
        for j, row in enumerate(rnd.choice(LEAF_SHAPES)):
            for k, ch in enumerate(row):
                if ch != ".":
                    cv.fill(px + k, py + j - 1, 1, 1, tones[ch])


def porch_house(cv, side, z, wall_c, roof, door):
    phouse(cv, side, z, wall_c, roof, door)
    xi = side * 236
    poly(cv, [(xi, z + 50, 0), (xi - side * 30, z + 50, 0), (xi - side * 30, z + 150, 0), (xi, z + 150, 0)], "brown")
    poly(cv, [(xi, z + 50, 60), (xi - side * 30, z + 50, 60), (xi - side * 30, z + 150, 60), (xi, z + 150, 60)], "brown")
    for pz in (z + 52, z + 146):
        front(cv, xi - side * 30, xi - side * 26, pz, 0, 60, "dbrown")
    wall(cv, xi, z + 90, z + 98, 40, 50, "yellow")


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
