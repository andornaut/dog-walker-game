#!/usr/bin/env python3
"""Draw the per-zone road strips and the transitions between zones.

road-<zone>        320x64 images, one per zone. They tile vertically with no
                   seam: every pattern repeats in 64 rows (or a divisor of it)
                   and anything drawn near the top or bottom edge wraps.
road-<zone>-start  320x64 images, one per zone. Rows 20 to 63 are a neutral cross
                   street in dslate asphalt (CROSSING) and rows 0 to 19
                   this zone's strip, so a start strip follows any zone at a
                   fork: the road reads up the screen as the previous zone's
                   strip, the start strip, then this zone's strip.

Each strip keeps its zone's road colour (the game data's roadColour) as the base, so
the game's shadows (one ramp step darker) still match. The four lane dividers sit
at x = 64k-1 (2px wide) and share one look per zone (Kensington Market's are
painted a colour each), so lane edges stay readable at speed; the outer 5 to 8 px
of each side is a curb or verge, which an outer lane's 56px sprite (4 px in from
its 64px lane's edge) overlaps by up to 4 px.

Usage:
  roads.py preview OUT.png   each zone's road scrolling up: two strips of the zone
                             before it in ZONES, the start strip, then three of this zone
  roads.py build             write art/roads/*.aseprite and public/art/images/*.png

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import random
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import PALETTE64, Grid, dk  # noqa: E402

W, H = 320, 64
LANE = 64
# The period of every joint or seam across the road: the road scrolls up to 11 px a frame at 30 fps, and a
# pattern that repeats in under twice that strobes like a wagon wheel, its motion seeming to reverse.
SEAM_PERIOD = 32
DIVIDERS = [k * LANE - 1 for k in range(1, 5)]


def wp(g, x, y, c):
    """A pixel that wraps top to bottom, so features crossing the edge stay seamless."""
    g.p(x, y % H, c)


def wrect(g, x, y, w, h, c):
    for j in range(h):
        for i in range(w):
            wp(g, x + i, y + j, c)


def specks(g, rnd, n, col, x0=0, x1=W, wide=0.0):
    """Scatter n texture specks; a share of them (wide) are 2px wide."""
    for _ in range(n):
        x, y = rnd.randrange(x0, x1), rnd.randrange(H)
        wp(g, x, y, col)
        if rnd.random() < wide:
            wp(g, x + 1, y, col)


def scatter(rnd, n, x0, x1, gap, y0=0, y1=H, ok=lambda x, y: True):
    """Up to n points at least gap apart (wrapping top to bottom) where ok(x, y) holds, so
    texture never falls into a regular rhythm or a clump."""
    pts = []
    for _ in range(n * 40):
        if len(pts) == n:
            break
        x, y = rnd.randrange(x0, x1), rnd.randrange(y0, y1)
        if ok(x, y) and all(abs(x - px) >= gap or min(abs(y - py), H - abs(y - py)) >= gap for px, py in pts):
            pts.append((x, y))
    return pts


def wave(y, seed, base, amp):
    """A width that wobbles down the strip and repeats every 64 rows."""
    t = 2 * math.pi * y / H
    return base + round(amp * (0.6 * math.sin(t + seed) + 0.4 * math.sin(3 * t + seed * 2.3)))


def clip(g, y0, y1, draw):
    """Run draw(scratch) and keep only its rows y0..y1-1 on g."""
    s = Grid(W, H)
    draw(s)
    for y in range(y0, y1):
        for x in range(W):
            if s.px[y][x]:
                g.px[y][x] = s.px[y][x]


# ---------- lane lines ----------

def meander(rnd, lo, hi, hold=(8, 14)):
    """A per-row offset for each of the 64 rows, wrapping: a walk between lo and hi that steps 1px at a
    time and holds each value hold rows or more, so a wobbling edge keeps runs long enough to read as a
    line along the road, its steps falling at irregular rows."""
    while True:
        vals, v = [], rnd.randint(lo, hi)
        while len(vals) < H:
            vals += [v] * rnd.randint(*hold)
            v = min(hi, max(lo, v + rnd.choice((-1, 1))))
        vals = vals[:H]
        tail = next(k for k in range(1, H + 1) if k == H or vals[H - 1 - k] != vals[-1])
        if vals[-1] == vals[0] or (abs(vals[-1] - vals[0]) == 1 and tail >= hold[0]):
            return vals


def high_park_lines(g):
    """High Park's path has no lines between its lanes: a dirt path, unlike the streets."""


# Pedestrian Sunday's painted lane lines, one colour per divider, left to right; each holds 4:1 or more
# on Kensington Market's dbrick, and none is gold, amber or orange, which read as coins.
LANE_PAINT = ("cream", "turquoise", "pink", "lime")


def kensington_lines(g):
    """A 10-row painted dash every SEAM_PERIOD rows from row 24, wrapping, each divider its own colour, a
    ramp step darker down its right edge. Rows 35 to 55 stay bare: screen-end shows rows 36 to 39 below its
    button."""
    for x, c in zip(DIVIDERS, LANE_PAINT):
        for y in range(24, 24 + H, SEAM_PERIOD):
            wrect(g, x, y, 2, 10, c)
            wrect(g, x + 2, y + 1, 1, 10, dk(c))


# fallen leaves (never amber or orange, which read as coins): a pointed blade, lit (f) on
# the upper left of a dark vein (v) that runs on out as the stem and shaded (s) below it, so each
# reads as a leaf and not a round fleck
_TILTED = ("..fff", ".ffvf", "ffvss", "fvss.", "v....")
_SMALL = ("..ff", ".fvf", "fvs.", "v...")
LEAF_SHAPES = (_TILTED, tuple(r[::-1] for r in _TILTED), _SMALL, tuple(r[::-1] for r in _SMALL),
               (".ff.", "fvfs", "fvss", ".vs.", ".v.."))


def leaves(g, rnd, n, x0, x1, tones, y0=0, y1=H):
    """n leaves spaced apart, clear of the lane dividers, each in one of tones (lit, shade, vein)."""
    for x, y in scatter(rnd, n, x0, x1, 18, y0, y1, lambda x, y: (x + 7) % LANE >= 9):
        tone = dict(zip("fsv", rnd.choice(tones)))
        for j, row in enumerate(rnd.choice(LEAF_SHAPES)):
            for k, ch in enumerate(row):
                if ch != ".":
                    wp(g, x + k, y + j, tone[ch])


def cabbagetown_lines(g):
    rnd = random.Random("road-cabbagetown-lines")
    for x in DIVIDERS:
        for y in (10,):
            # faded white (2.8:1 on the grey) with a slate edge, chipped where the paint wore
            g.rect(x, y, 2, 12, "white")
            g.rect(x + 2, y + 1, 1, 12, "slate")
            for _ in range(2):
                g.p(x + rnd.randrange(2), y + rnd.randrange(1, 11), "lgrey")


def beaches_lines(g):
    for x in DIVIDERS:
        for y in (6,):
            # dbrown (5.9:1 on the boards), 20 rows in 64: a longer rhythm than High Park's
            g.rect(x, y, 2, 20, "dbrown")


# ---------- the six neighbourhoods ----------
# Each strip's base is its zone's road colour, which the game's road shadow steps down from.

def grit(g, rnd, n, cols):
    """Sparse 2px grit spaced apart, 1x2 or 2x1."""
    for x, y in scatter(rnd, n, 6, W - 7, 7):
        col = rnd.choice(cols)
        if rnd.random() < 0.7:
            wrect(g, x, y, 1, 2, col)
        else:
            wrect(g, x, y, 2, 1, col)


def cracks(g, rnd, runs, col):
    """Cracks running along the road, 1 to 2px wide, kept inside lanes."""
    for x, y, steps in runs:
        for _ in range(steps):
            wp(g, x, y, col)
            if rnd.random() < 0.25:
                x += rnd.choice((-1, 1))
                wp(g, x, y, col)
            y -= 1


def cabbagetown_ground(g):
    """Pale asphalt with granite gutters in stone, their joints every 32 rows."""
    rnd = random.Random("road-cabbagetown")
    g.rect(0, 0, W, H, "grey")
    grit(g, rnd, 60, ("slate", "slate", "dslate", "lgrey", "lgrey"))
    cracks(g, rnd, ((43, 12, 10), (100, 40, 12), (160, 62, 9), (224, 50, 14), (286, 30, 8)), "dslate")
    leaves(g, rnd, 4, 10, W - 10, (("moss", "olive", "dolive"), ("gold", "ochre", "rust")))
    for x0, edge in ((0, 4), (W - 4, W - 5)):
        g.rect(x0, 0, 4, H, "stone")
        g.rect(edge, 0, 1, H, "slate")
        for y in range(0, H, SEAM_PERIOD):
            g.rect(x0, y, 4, 2, "dstone")
    g.rect(0, 0, 1, H, "lgrey")
    g.rect(W - 1, 0, 1, H, "dstone")


def oval(g, rnd, x, y, w, h, col):
    """A ragged oval w by h with its top left at x, y, wrapping: each row's ends nudged by up to a pixel."""
    for j in range(h):
        half = w / 2 * math.sqrt(max(0.0, 1 - ((j + 0.5 - h / 2) / (h / 2)) ** 2))
        left = round(w / 2 - half) + rnd.choice((-1, 0, 0, 1))
        right = round(w / 2 + half) + rnd.choice((-1, 0, 0, 1))
        if right - left >= 1:
            wrect(g, x + left, y + j, right - left, 1, col)


def root(g, rnd, x, y, dx, steps):
    """A root creeping in from the undergrowth: a bark line 2px wide stepping dx across on most rows as it
    runs down the strip, its top rows lit clay, thinning to a 1px tip."""
    pts = []
    for k in range(steps):
        pts.append((x, y, 2 if k < steps - 3 else 1))
        if rnd.random() < 0.6:
            x += dx
        y += 1
    for x, y, w in pts:
        wrect(g, x if dx > 0 or w == 1 else x - 1, y, w, 1, "bark")
    for x, y, w in pts[:-3]:
        wp(g, x + (1 if dx > 0 else -1), y - 1, "clay")


def high_park_ground(g):
    """Packed earth on High Park's trail: skin1 worn patches down the middle of each lane where feet go,
    scuffed cream; skin2 damp patches; roots creeping in from the undergrowth; stones, pebbles, needles
    and fallen leaves; ragged pine undergrowth along both edges with grass spilling onto the dirt."""
    rnd = random.Random("road-high-park")
    g.rect(0, 0, W, H, "tan")
    # worn ground down each lane where feet go: skin1 patches chained along the lane's middle, drifting
    # side to side, overlapping or leaving a gap, so the lane wears unevenly rather than in a stripe;
    # swept clean of the grit around them but for a cream scuff
    worn = Grid(W, H)
    for k in range(W // LANE):
        cx, drift = k * LANE + LANE // 2, rnd.randint(-3, 3)
        y = y0 = rnd.randrange(H)
        while y < y0 + H - 6:
            w, h = rnd.randint(7, 13), rnd.randint(14, 26)
            oval(worn, rnd, cx + drift - w // 2, y, w, h, "skin1")
            wrect(worn, cx + drift + rnd.randint(-2, 1), y + rnd.randint(3, h - 6), 1, rnd.randint(2, 3), "cream")
            drift = max(-8, min(8, drift + rnd.randint(-4, 4)))
            y += rnd.randint(h // 2, h + 8)
    specks(g, rnd, 90, "brown", 9, W - 9)
    specks(g, rnd, 40, "skin2", 9, W - 9, 0.3)
    for y in range(H):
        for x in range(W):
            if worn.px[y][x]:
                g.px[y][x] = worn.px[y][x]
        # a tan crease splits any row of a patch 8 or more wide, so none reads as a seam across the road
        x = 0
        while x < W:
            run = 1
            while x + run < W and worn.px[y][x + run] and g.px[y][x + run] == g.px[y][x]:
                run += 1
            if worn.px[y][x] and run >= 8:
                run = min(7, run // 2 + round(wave(y, 1.7, 0, 1)))
                g.p(x + run, y, "tan")
            x += run
    # damp patches, long along the road so each looks round in the view, under 8 columns wide so none
    # reads as a seam across the road, with a brown wet spot
    for x, y in scatter(rnd, 9, 10, W - 16, 16, ok=lambda x, y: 4 < (x + 2) % LANE < 54):
        w, h = rnd.randint(4, 7), rnd.randint(6, 12)
        oval(g, rnd, x, y, w, h, "skin2")
        wp(g, x + w // 2, y + h // 2, "brown")
    # stones half sunk in the dirt, lit on the top left, and loose pebbles
    for x, y in scatter(rnd, 7, 12, W - 14, 16, ok=lambda x, y: 4 < (x + 2) % LANE < 58):
        wrect(g, x, y, 3, 2, "driftwood")
        wp(g, x, y, "lgrey")
        wp(g, x + 2, y + 1, "stone")
        wrect(g, x, y + 2, 3, 1, "brown")
    for x, y in scatter(rnd, 20, 10, W - 10, 5, ok=lambda x, y: 2 < (x + 1) % LANE < 61):
        wp(g, x, y, rnd.choice(("stone", "driftwood", "driftwood", "dstone")))
    # fallen needles in pairs, clear of the lane lines
    for x, y in scatter(rnd, 14, 10, W - 12, 9, ok=lambda x, y: (x + 4) % LANE >= 8):
        wp(g, x, y, "bark")
        wp(g, x + 1, y + 1, "bark")
        wp(g, x + 2, y + 1, "bark")
    leaves(g, rnd, 5, 10, W - 10, (("moss", "olive", "dolive"), ("skin2", "brown", "dbrown")))
    # the undergrowth along each edge keeps to the outer 8 columns, clear of a sprite's margin: pine
    # with fir blades, a ragged brown margin of damp earth, and grass clumps spilling onto the dirt
    def col(side, x):
        return x if side == 0 else W - 1 - x

    for side in (0, 1):
        width = meander(rnd, 2, 5, (2, 6))
        for y in range(H):
            w = width[y]
            for x in range(w):
                g.p(col(side, x), y, "pine")
            g.p(col(side, w), y, "brown")
            if width[y - 1] < w or rnd.random() < 0.3:
                g.p(col(side, w + 1), y, "skin2")
        y = rnd.randrange(H)
        while y < H * 2:
            wrect(g, col(side, rnd.randrange(3)), y, 1, 2, "fir")
            y += rnd.randrange(3, 7)
        for _, y in scatter(rnd, 9, 0, 1, 5):
            # a clump: blades spilling over the margin onto the dirt, out to column 7 at most, canopy
            # with a lit moss or olive tip
            reach = rnd.randint(1, 7 - width[y])
            for b in range(reach):
                wrect(g, col(side, width[y] + b), y - b % 2, 1, 3 - b % 2, "canopy")
            wp(g, col(side, width[y] + reach - 1), y - 1 - (reach - 1) % 2, rnd.choice(("moss", "olive")))
    # roots creeping in from the undergrowth, two a side, each reaching a dozen or so columns onto the dirt
    for side in (0, 1):
        for y in (rnd.randrange(0, 20), rnd.randrange(30, 50)):
            dx = 1 if side == 0 else -1
            x = 5 if side == 0 else W - 6
            root(g, rnd, x, y, dx, rnd.randint(7, 11))


def distillery_ground(g):
    """Dslate cobbles laid long along the road: columns 16 wide, each cobble 30 rows long over a 2-row navy
    joint, so a column's joints repeat every 32 rows (SEAM_PERIOD); each column starts its cobbles at its own
    multiple of 4, never within 4 rows of its neighbour's, so no joint runs across the road. Each cobble's
    corners are rounded off in navy and its top left glints slate; 1px navy joints between the columns, a
    navy pit in some cobbles; brick gutters along both sides."""
    rnd = random.Random("road-distillery-district")
    g.rect(0, 0, W, H, "dslate")
    phase = 0
    for x in range(0, W, 16):
        prev = phase
        phase = rnd.choice([p for p in range(0, SEAM_PERIOD, 4) if min(abs(p - prev), SEAM_PERIOD - abs(p - prev)) > 4])
        g.rect(x + 15, 0, 1, H, "navy")
        for y in range(phase, phase + H, SEAM_PERIOD):
            wrect(g, x, y + SEAM_PERIOD - 2, 15, 2, "navy")
            for cx, cy in ((x, y), (x + 14, y), (x, y + SEAM_PERIOD - 3), (x + 14, y + SEAM_PERIOD - 3)):
                wp(g, cx, cy, "navy")
            wrect(g, x + 1, y + 1, 3, 1, "slate")
            wp(g, x + 1, y + 2, "slate")
            if rnd.random() < 0.5:
                wp(g, x + rnd.randrange(4, 13), y + rnd.randrange(4, 26), "navy")
    for x0, edge in ((0, 4), (W - 4, W - 5)):
        g.rect(x0, 0, 4, H, "brick")
        g.rect(edge, 0, 1, H, "navy")
        for y in range(0, H, SEAM_PERIOD):
            g.rect(x0, y + 6, 4, 2, "dbrick")
    g.rect(0, 0, 1, H, "rust")


def distillery_lines(g):
    """A pale granite curbstone on each lane line every 64 rows: lgrey, 22 rows long, a stone edge."""
    for x in DIVIDERS:
        g.rect(x, 0, 2, 22, "lgrey")
        g.rect(x + 1, 0, 1, 22, "stone")


def kensington_ground(g):
    """Dark brick flagstones in offset courses between clay gutters: dbrick stones in plum joints, brick,
    walnut and mauve flecks worn into them; clay stones on the outer 4 columns inside a bark seam, a bark
    joint every 32 rows."""
    rnd = random.Random("road-kensington-market")
    g.rect(0, 0, W, H, "dbrick")
    # flagstones half a lane wide in courses SEAM_PERIOD rows deep, each course offset half a stone, so
    # the lane dividers fall on joints of every other course
    for course in range(H // SEAM_PERIOD):
        y, off = course * SEAM_PERIOD, 16 if course % 2 else 0
        g.rect(0, y + SEAM_PERIOD - 2, W, 2, "plum")
        for x in range(off - 1, W, 32):
            g.rect(x, y, 1, SEAM_PERIOD - 2, "plum")
    specks(g, rnd, 20, "brick", 6, W - 6)
    specks(g, rnd, 10, "walnut", 6, W - 6)
    specks(g, rnd, 6, "mauve", 6, W - 6)
    for x0, inner in ((0, 4), (W - 4, W - 5)):
        g.rect(x0, 0, 4, H, "clay")
        g.rect(inner, 0, 1, H, "bark")
        for y in range(0, H, SEAM_PERIOD):
            g.rect(x0, y, 4, 2, "bark")


def beaches_ground(g):
    """A boardwalk, weathered: some boards skin1, sand drifted in skin1 along the edge beams, the
    beams driftwood."""
    rnd = random.Random("road-the-beaches")
    g.rect(0, 0, W, H, "cream")
    boards = range(0, W, 16)
    tinted = False
    for x0 in boards:
        tinted = not tinted and rnd.random() < 0.05
        if tinted:
            g.rect(x0, 0, 15, H, "skin1")
        for _ in range(rnd.randrange(1, 3)):
            wrect(g, x0 + rnd.randrange(1, 14), rnd.randrange(H), 1, rnd.randrange(5, 12), "tan")
    for x0 in boards[1:]:
        g.rect(x0 - 1, 0, 1, H, "tan")
    for x0 in boards:
        y = rnd.randrange(H)
        wrect(g, x0, y, 15, 2, "tan")
        wp(g, x0 + 3, y - 2, "driftwood")
        wp(g, x0 + 11, y + 3, "driftwood")
    for x, y in scatter(rnd, 7, 8, W - 8, 20, ok=lambda x, y: x % 16 < 13):
        wrect(g, x, y, 2, 2, "tan")
        wp(g, x + 1, y + 1, "brown")
    # sand drifted onto the boards beside each beam, 1 to 3 columns, wobbling down the strip
    for y in range(H):
        for side, seed in ((0, 0.8), (1, 3.3)):
            w = wave(y, seed, 2, 1.2)
            if w > 0:
                g.rect(4 if side == 0 else W - 4 - w, y, w, 1, "skin1")
    for x0, outer in ((0, 0), (W - 4, W - 1)):
        g.rect(x0, 0, 4, H, "driftwood")
        g.rect(outer, 0, 1, H, "stone")


def yonge_ground(g):
    """Dark concrete: shale slabs a lane wide and 32 rows long, their 2-row expansion joints in coal
    across the road and 1px along it under the lane lines, sparse ash and coal grit, a few coal cracks;
    dstone granite gutters, their joints in shale every 32 rows."""
    rnd = random.Random("road-yonge-street")
    g.rect(0, 0, W, H, "shale")
    grit(g, rnd, 50, ("ash", "ash", "coal", "coal", "dslate"))
    cracks(g, rnd, ((40, 20, 9), (150, 50, 11), (230, 12, 8)), "coal")
    for y in (14, 46):
        g.rect(0, y, W, 2, "coal")
    for x in DIVIDERS:
        g.rect(x, 0, 1, H, "coal")
    for x0, line in ((0, 5), (W - 5, W - 6)):
        g.rect(x0, 0, 5, H, "dstone")
        for y in range(0, H, SEAM_PERIOD):
            g.rect(x0, y, 5, 2, "shale")
        g.rect(line, 0, 1, H, "coal")
    g.rect(0, 0, 1, H, "stone")
    g.rect(W - 1, 0, 1, H, "shale")


def yonge_lines(g):
    """White dashes 14 rows long in 64 (11.3:1 on the shale) with a coal edge."""
    for x in DIVIDERS:
        for y in (2,):
            g.rect(x, y, 2, 14, "white")
            g.rect(x + 2, y, 1, 14, "coal")


# easiest to hardest, as the fork cards sort them
ZONES = {
    "cabbagetown": (cabbagetown_ground, cabbagetown_lines),
    "high-park": (high_park_ground, high_park_lines),
    "distillery-district": (distillery_ground, distillery_lines),
    "kensington-market": (kensington_ground, kensington_lines),
    "the-beaches": (beaches_ground, beaches_lines),
    "yonge-street": (yonge_ground, yonge_lines),
}


def strip(zone, y0=0, y1=H):
    """The zone's strip; with y0..y1, only those rows are drawn (the rest stay empty)."""
    ground, lines = ZONES[zone]
    g = Grid(W, H)
    clip(g, y0, y1, lambda s: (ground(s), lines(s)))
    return g


# ---------- the cross street every start strip begins with ----------

# Strip rows of the cross street, first and past-last: the zone's own strip is above it and
# the game draws the previous zone's strip below it.
CROSSING = (20, 64)


def crossing(g):
    """A neutral cross street in dslate asphalt, so a start strip follows any zone. Up
    the road: the near curb's top (rows 60 to 63) and rounded edge (58, 59), the asphalt with a
    zebra crossing (35 to 48), then the far curb's shadow (24, 25), face (22, 23) and lit top
    (20, 21). Every curb band is 2 rows but the near curb's 4-row top, each step 3.4:1 or less."""
    y0, y1 = CROSSING
    rnd = random.Random("road-crossing")
    g.rect(0, y0, W, y1 - y0, "dslate")
    for x, y in scatter(rnd, 30, 0, W, 7, 27, 56):
        g.rect(x, y, 1, 2, rnd.choice(("slate", "navy", "navy")))
    for x in range(12, W - 12, 12):
        g.rect(x, 35, 7, 14, "white")
        g.rect(x + 6, 35, 1, 14, "lgrey")
        g.rect(x, 47, 7, 2, "lgrey")
    g.rect(0, 20, W, 2, "lgrey")
    g.rect(0, 22, W, 2, "slate")
    g.rect(0, 24, W, 2, "navy")
    g.rect(0, 58, W, 2, "grey")
    g.rect(0, 60, W, 4, "lgrey")
    # curbstone joints at uneven spacing, along the road
    x = rnd.randrange(10, 30)
    while x < W:
        g.rect(x, 60, 1, 4, "grey")
        g.rect(x + rnd.randrange(-6, 7), 20, 1, 4, "grey")
        x += rnd.randrange(22, 38)


def start(zone):
    g = strip(zone, 0, CROSSING[0])
    crossing(g)
    return g


def images():
    """Yield (key, Grid) for every image."""
    for zone in ZONES:
        yield f"road-{zone}", strip(zone)
    for zone in ZONES:
        yield f"road-{zone}-start", start(zone)


def strip_image(g):
    from PIL import Image

    img = Image.new("RGB", (g.w, g.h))
    img.putdata([tuple(int(c[k:k + 2], 16) for k in (0, 2, 4)) for row in g.px for c in row])
    return img


def check(key, g):
    """Every pixel is opaque and on the palette, at the inventory size."""
    assert (g.w, g.h) == (W, H), key
    bad = {c for row in g.px for c in row if c not in PALETTE64}
    assert not bad, f"{key}: {bad}"


def preview(out, scale=2, gap=8):
    from PIL import Image

    tiles = dict(images())
    for key, g in tiles.items():
        check(key, g)
    zones = list(ZONES)
    col_h = 6 * H
    sheet = Image.new("RGB", ((W + gap) * len(zones) * scale, col_h * scale), (24, 20, 37))
    for i, zone in enumerate(zones):
        # bottom to top, the order the road scrolls into view
        column = [f"road-{zones[i - 1]}"] * 2 + [f"road-{zone}-start"] + [f"road-{zone}"] * 3
        for j, key in enumerate(column):
            y = col_h - (j + 1) * H
            tile = strip_image(tiles[key]).resize((W * scale, H * scale), Image.NEAREST)
            sheet.paste(tile, (i * (W + gap) * scale, y * scale))
    sheet.save(out)


def build():
    os.makedirs("art/roads", exist_ok=True)
    os.makedirs("public/art/images", exist_ok=True)
    built = []
    for key, g in images():
        check(key, g)
        png = f"public/art/images/{key}.png"
        strip_image(g).save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/roads/{key}.aseprite"], check=True)
        built.append(key)
    print("built", ", ".join(built))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
