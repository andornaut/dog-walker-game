#!/usr/bin/env python3
"""Mock: The Beaches, Toronto, as a walk zone on the tall backdrop band.

The walk runs down the boardwalk's planks toward the lake. Draws, in Endesga 32:

- beaches-walk.png (360x560): the top bar; a 174-row band on screen rows 40 to 213 with a calm
  flat sky above band row 61, Lake Ontario to the horizon with sailboats, the downtown skyline
  and the CN Tower far to the west, the R.C. Harris Water Treatment Plant on its bluff to the
  east, the Leuty lifeguard station and volleyball nets on the far beach, and the Martin Goodman
  Trail as the cross street; the boardwalk as the road with sand verges, the park's lawn beyond
  the left one and the lake's edge beyond the right one; roadside props at their depth; the
  walker and pack, obstacles and pickups; and the doghouse row.
- beaches-props.png: the new roadside props at full size, shown 2x on sand, labelled.

The camera is the tall band's: far edge on row 214 at scale 0.5, feet on row 464, focal 720 road
px (horizon on row -36). Props are drawn on the 1.75x design grid at each one's projected scale,
outlined with road_edge, and pass under the band as the game's do.

Usage:
  mock_toronto_beaches.py build    write public/art/mocks/toronto/beaches-*.png

Run from the repository root. Mock tooling only: nothing here is game art.
"""

import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import help as hp  # noqa: E402

# The tall band, before backdrops.py reads the layout: rows 40 to 213, the approach from row 195.
_L = hp.LAYOUT
_L["regions"]["backdrop"].update(height=174)
_L["regions"]["approach"].update(y=195, height=19)
_L["regions"]["road"].update(y=214, height=256)
_L["camera"].update(horizonY=-36, focal=720, farY=214, ratio=500 / 720)

import backdrops as bd  # noqa: E402
from minis import Mini  # noqa: E402
from pixel import K, edged  # noqa: E402

OUT = "public/art/mocks/toronto"
W, H = 360, 560
FAR_Y, FOOT_Y, DOG_BAND_Y = 214, 464, 466
YH, F = -36, 720
KS = FOOT_Y - YH
CX = 180
SCALE = 1.75
DOGS = ("koda", "biscuit", "duchess")
ROAD_C, SHADE, LEASH = "c28569", "brown", "plum"
SAND, SAND_DK = "cream", "tan"


def use_camera():
    hp.W, hp.H, hp.OX, hp.TOP = W, H, 0, 0
    hp.YH, hp.F, hp.KS = YH, F, KS


def to_image(rows):
    img = Image.new("RGBA", (len(rows[0]), len(rows)), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c:
                img.putpixel((x, y), hp.rgb(c) + (255,))
    return img


# ---------- the boardwalk: a 320x64 strip of planks laid across the walk ----------

def strip():
    """Weathered planks 16 rows deep with a 2-row brown seam, one butt joint per plank, sparse
    knots, an edge stringer either side, and lane marks as 2px tan dashes 16 rows in 32."""
    img = Image.new("RGB", (320, 64))
    px = img.load()
    for y in range(64):
        plank, r = y // 16, y % 16
        joint = (plank * 137 + 53) % 300 + 10
        for x in range(320):
            c = ROAD_C
            if r >= 14:
                c = "b86f50"
            elif x == joint or (bd.noise(x, y) < 0.012):
                c = "b86f50"
            if x in (63, 64, 127, 128, 191, 192, 255, 256) and y % 32 < 16:
                c = K["tan"] if r < 14 else "b86f50"
            if x < 2 or x >= 318:
                c = K["dbrown"]
            elif x < 5 or x >= 315:
                c = K["brown"] if r < 15 else K["dbrown"]
            px[x, y] = hp.rgb(K.get(c, c))
    return img


STRIP = strip()


def waterline(z):
    """The lake's edge on the right, across: the shore bends away into the distance."""
    return 262 + max(0.0, z - 640) * 2.5 + 5 * math.sin(z / 41)


def verge(x, z, s):
    """The ground beside the boardwalk at signed across x, z ahead: sand with sparse specks, out
    to the park's dune grass and lawn on the left, and to wet sand, foam and the lake's waves on
    the right. Waves run along the shore, so their lines run along the road."""
    a = abs(x)
    speck = bd.noise(int(x) // 2, int(z) // 3) < 0.035
    if x < 0:
        if a < 296:
            return SAND_DK if speck else SAND
        if a < 316:
            return "dgreen" if bd.noise(int(x), int(z) // 4) < 0.35 else SAND
        return "dgreen" if bd.noise(int(x) // 3, int(z) // 2) < 0.03 else "green"
    w = waterline(z)
    if a < w - 16:
        return SAND_DK if speck else SAND
    if a < w - 3:
        return SAND_DK
    if a < w + 2:
        return "white"
    out = a - w
    crest = (out + 9 * math.sin(z / 23 + out / 30)) % 26
    if crest < 3:
        return "white" if out < 50 else "cyan"
    if crest < 7:
        return "cyan"
    return "sky" if out < 70 else "blue"


def ground(x, z):
    """Road or verge at signed across x, z ahead."""
    if -160 <= x < 160:
        return "%02x%02x%02x" % STRIP.getpixel((math.floor(x + 160), (63 - math.floor(z)) % 64))
    return verge(x, z, 0)


# ---------- the backdrop ----------

def sail(cv, x, base, h, hull, sail_c="white"):
    cv.fill(x, base - h, 1, h, "dbrown")
    for k in range(h - 1):
        cv.fill(x + 1, base - h + k, 1 + k * 2 // 3, 1, sail_c)
    cv.fill(x - h // 3, base, h // 3 * 2 + h // 2 + 2, 1, hull)
    cv.fill(x - h // 3 + 1, base + 1, h // 3 * 2 + h // 2, 1, bd.dk(hull))


def tiny_dog(cv, x, y, col, run=0):
    cv.fill(x, y - 2, 4, 2, col)
    cv.fill(x + 3 + run, y - 4, 2, 2, col)
    cv.fill(x, y, 1, 1, bd.dk(col))
    cv.fill(x + 3, y, 1, 1, bd.dk(col))
    cv.fill(x - 1, y - 3, 1, 1, col)


def umbrella(cv, cx, base, a, b):
    cv.fill(cx, base - 6, 1, 6, "dslate")
    for k, w in enumerate((3, 7, 9)):
        for i in range(w):
            cv.fill(cx - w // 2 + i, base - 9 + k, 1, 1, a if (i + k) % 3 else b)
    cv.fill(cx - 4, base, 6, 1, "pink")


def leuty(cv, cx, base):
    """The Leuty lifeguard station: white clapboard under a red hipped roof, its open lookout
    with a red cap and the flag above."""
    x0 = cx - 16
    cv.fill(x0, base - 17, 32, 17, "white")
    for y in range(base - 15, base, 3):
        cv.fill(x0, y, 32, 1, "lgrey")
    cv.fill(x0 + 29, base - 17, 3, 17, "lgrey")
    for wx in (x0 + 4, x0 + 22):
        cv.fill(wx, base - 13, 6, 6, "plum")
        cv.fill(wx + 1, base - 12, 4, 4, "sky")
        cv.fill(wx + 1, base - 12, 1, 1, "cyan")
    cv.fill(cx - 3, base - 10, 7, 10, "dred")
    cv.fill(cx - 2, base - 9, 5, 3, "red")
    cv.fill(x0 - 3, base, 38, 1, "brown")
    for k in range(7):
        w = 24 + 2 * k
        cv.fill(cx - w // 2, base - 24 + k, w, 1, "red" if k < 6 else "dred")
        cv.fill(cx + w // 2 - 2, base - 24 + k, 2, 1, "dred")
    # the lookout
    cv.fill(cx - 6, base - 32, 12, 8, "white")
    cv.fill(cx - 4, base - 30, 3, 4, "navy")
    cv.fill(cx + 1, base - 30, 3, 4, "navy")
    cv.fill(cx + 4, base - 32, 2, 8, "lgrey")
    for k in range(4):
        cv.fill(cx - 2 - k * 2, base - 36 + k, 4 + k * 4, 1, "red" if k < 3 else "dred")
    cv.fill(cx, base - 46, 1, 10, "slate")
    cv.fill(cx + 1, base - 46, 2, 4, "red")
    cv.fill(cx + 3, base - 46, 3, 4, "white")
    cv.fill(cx + 4, base - 45, 1, 2, "red")
    cv.fill(cx + 6, base - 46, 2, 4, "red")


def harris(cv):
    """The R.C. Harris Water Treatment Plant on its bluff to the east: buff art deco halls with
    tall windows and pilasters, a raised centre pavilion and green copper roofs, over a lawn."""
    shore = 116
    for x in range(232, W):
        top = round(shore - min(1.0, (x - 232) / 46) * 26)
        cv.fill(x, top, 1, shore - top, "dgreen")
        cv.fill(x, top, 1, 1, "green")
        cv.fill(x, shore - 3, 1, 3, "brown" if x % 7 else "dbrown")
    for cx, top, r in ((268, 92, 5), (284, 84, 6), (354, 82, 6)):
        bd.tree(cv, cx, top, "dgreen", "forest", r=r, base=top + r + 6, girth=2)
    base = 90
    cv.fill(290, base - 12, 60, 12, "cream")
    cv.fill(290, base - 13, 60, 1, "tan")
    cv.fill(288, base - 15, 64, 2, "dgreen")
    for x in range(292, 348, 5):
        cv.fill(x, base - 10, 2, 8, "navy")
        cv.fill(x, base - 10, 2, 1, "sky")
        cv.fill(x + 3, base - 12, 1, 12, "tan")
    cv.fill(310, base - 22, 20, 22, "cream")
    cv.fill(308, base - 24, 24, 2, "dgreen")
    cv.fill(312, base - 26, 16, 2, "green")
    for x in range(313, 328, 4):
        cv.fill(x, base - 19, 2, 13, "navy")
        cv.fill(x, base - 19, 2, 1, "sky")
    cv.fill(316, base - 4, 8, 4, "dbrown")
    cv.fill(328, base - 22, 2, 22, "tan")
    cv.fill(286, base, 68, 1, "lgrey")


def skyline(cv):
    """Downtown far to the west across the bay, in haze: towers and the CN Tower."""
    hz = 96
    for x, w, h in ((2, 6, 12), (9, 5, 18), (15, 7, 9), (24, 4, 22), (40, 6, 15), (47, 5, 11),
                    (53, 7, 19), (61, 5, 8), (67, 6, 5)):
        cv.fill(x, hz - h, w, h, "lgrey")
        cv.fill(x + w - 1, hz - h, 1, h, "grey")
    cv.fill(33, 70, 3, hz - 70, "lgrey")
    cv.fill(35, 70, 1, hz - 70, "grey")
    cv.fill(31, 76, 7, 3, "lgrey")
    cv.fill(30, 77, 9, 1, "grey")
    cv.fill(32, 73, 5, 1, "lgrey")
    cv.fill(34, 63, 1, 7, "grey")


def lake(cv):
    hz = 96
    for py in range(hz, 117):
        for px in range(W):
            c = "blue" if py < 103 else "sky"
            if py == hz:
                c = "blue"
            elif bd.hashed(px // 4, py, 7) and py % 2 == 0:
                c = "sky" if py < 103 else ("cyan" if py < 111 else "white")
            cv.fill(px, py, 1, 1, c)
    for px in range(W):
        y = 116 + (1 if math.sin(px / 9) > 0.4 else 0)
        cv.fill(px, y, 1, 1, "white")
        cv.fill(px, y + 1, 1, 118 + 2 - y, "tan")


def sand(px, py):
    return SAND_DK if bd.hashed(px, py, 23) else SAND


def backdrop():
    cv = hp.Canvas(bd.W, bd.H)
    bd.sky(cv)
    cv.fill(0, bd.CALM, W, 96 - bd.CALM, "cyan")
    for i in range(0, W, 5):
        cv.fill(i, bd.CALM + (i // 5) % 2, 5, 1, "cyan")
    for k, (x, y, w, puff) in enumerate(((150, 84, 34, 6), (212, 72, 22, 4), (82, 68, 18, 3))):
        bd.cloud(cv, x, y, w, puff, k)
    # kites over the beach
    for kx, ky, a, b in ((250, 68, "red", "yellow"), (96, 80, "blue", "white")):
        for dy in range(-4, 5):
            n = (4 - abs(dy)) // 2
            cv.fill(kx - n, ky + dy, 2 * n + 1, 1, a if dy < 0 else b)
        for k in range(7):
            cv.fill(kx + (k % 2), ky + 5 + k, 1, 1, "plum")
    skyline(cv)
    lake(cv)
    harris(cv)
    for x, base, h, hull in ((152, 99, 4, "white"), (70, 104, 7, "red"), (196, 108, 9, "navy"),
                             (226, 101, 5, "yellow")):
        sail(cv, x, base, h, hull)
    bd.yard(cv, 119, bd.FAR_WALK, sand)
    # the far beach: lifeguard chair, volleyball nets, umbrellas, Muskoka chairs and dogs at play
    cv.fill(36, 122, 1, 9, "lgrey"); cv.fill(42, 122, 1, 9, "lgrey")
    cv.fill(35, 121, 9, 2, "red"); cv.fill(36, 118, 7, 3, "white")
    for x0 in (206, 244):
        cv.fill(x0, 121, 1, 9, "dslate"); cv.fill(x0 + 26, 121, 1, 9, "dslate")
        cv.fill(x0 + 1, 121, 25, 1, "white")
        for x in range(x0 + 1, x0 + 26, 2):
            cv.fill(x, 122, 1, 2, "white")
    cv.fill(258, 114, 2, 2, "yellow"); cv.fill(258, 115, 1, 1, "blue")
    umbrella(cv, 168, 129, "red", "white")
    umbrella(cv, 300, 129, "amber", "white")
    umbrella(cv, 66, 130, "teal", "white")
    for x, c in ((140, "pink"), (145, "green"), (150, "pink")):
        cv.fill(x, 125, 3, 3, c); cv.fill(x - 1, 127, 5, 1, c); cv.fill(x, 128, 1, 2, c); cv.fill(x + 2, 128, 1, 2, c)
    leuty(cv, 112, 130)
    for x, y, c, run in ((52, 130, "amber", 1), (80, 129, "dbrown", 0), (186, 131, "ink", 1), (196, 129, "white", 0),
                         (318, 130, "brown", 1)):
        tiny_dog(cv, x, y, c, run)
    cv.fill(90, 126, 2, 2, "yellow")
    # the Martin Goodman Trail across the end of the boardwalk, a cyclist on it
    bd.cross(cv, lambda px, py: "grey" if bd.hashed(px, py, 31) else "slate", "dslate", sand, curb=None)
    bd.cross_line(cv, "yellow", dash=(8, 16))
    cx, cy = 286, 146
    for wx in (cx - 4, cx + 3):
        cv.fill(wx - 1, cy - 1, 3, 3, "ink"); cv.fill(wx, cy, 1, 1, "slate")
    cv.fill(cx - 3, cy - 2, 7, 1, "red"); cv.fill(cx - 1, cy - 7, 3, 5, "orange"); cv.fill(cx - 1, cy - 9, 3, 2, "skin1")
    # the boardwalk's approach, its verges, and a wooden rail on the near left for the cat
    bd.street(cv, lambda x, z, span, px, py: ground(x, z))
    bd.rail(cv, *bd.PERCH_X, bd.PERCH)
    return cv


# ---------- the roadside props: front elevations in design units ----------

def lifeguard_stand():
    """A tall white lifeguard chair: splayed legs and rungs, a red seat and back with a white
    band, a red flag and an orange rescue can."""
    w, h = 40, 72

    def draw(g):
        base = h - 2
        g.tri((6, base), (10, base), (14, 30), "white")
        g.tri((30, base), (34, base), (26, 30), "white")
        g.tri((32, base), (34, base), (26, 30), "lgrey")
        for y in (40, 50, 60):
            g.rect(12 - (y - 40) // 8, y, 16 + (y - 40) // 4, 3, "white")
            g.rect(12 - (y - 40) // 8, y + 2, 16 + (y - 40) // 4, 1, "lgrey")
        g.rect(9, 28, 22, 4, "white")
        g.rect(11, 12, 18, 16, "red")
        g.rect(25, 12, 4, 16, "dred")
        g.rect(11, 18, 18, 4, "white")
        g.rect(25, 18, 4, 4, "lgrey")
        g.rect(7, 22, 3, 8, "white")
        g.rect(30, 22, 3, 8, "white")
        g.rect(31, 2, 2, 20, "slate")
        g.rect(33, 3, 7, 5, "red")
        g.rect(4, 32, 6, 10, "orange")
        g.rect(4, 32, 6, 2, "amber")
    return w, h, draw


def muskoka_chairs():
    """Two Muskoka chairs side by side, facing out: fanned slat backs, wide flat arms, in the
    boardwalk's pink and green."""
    w, h = 64, 36

    def chair(g, x, c):
        base = h - 2
        for i, (dx, top) in enumerate(((0, 8), (4, 5), (8, 4), (12, 5), (16, 8))):
            g.rect(x + 4 + dx, top, 3, 22 - top, c if i < 4 else bd.dk(c))
            g.ell(x + 5.5 + dx, top, 1.5, 1.5, c)
        g.rect(x, 18, 28, 3, c)
        g.rect(x, 21, 28, 1, bd.dk(c))
        g.rect(x + 3, 22, 22, 4, bd.dk(c))
        for lx in (x + 1, x + 24):
            g.rect(lx, 21, 3, base - 20, c)
            g.rect(lx + 2, 21, 1, base - 20, bd.dk(c))
    def draw(g):
        chair(g, 3, "pink")
        chair(g, 33, "green")
    return w, h, draw


def volleyball_net():
    """A beach volleyball net between two posts, its white top band, the mesh, and a ball in the
    air above it."""
    w, h = 96, 52

    def draw(g):
        base = h - 2
        for x in (6, 86):
            g.rect(x, 12, 4, base - 11, "dslate")
            g.rect(x + 3, 12, 1, base - 11, "navy")
            g.rect(x - 1, 10, 6, 3, "grey")
        g.rect(10, 16, 76, 3, "white")
        g.rect(10, 18, 76, 1, "lgrey")
        for y in range(23, 38, 5):
            g.rect(10, y, 76, 1, "lgrey")
        for x in range(14, 86, 6):
            g.rect(x, 19, 1, 19, "lgrey")
        g.rect(10, 37, 76, 2, "white")
        g.ell(60, 6, 4, 4, "yellow")
        g.rect(57, 5, 7, 1, "blue")
        g.rect(60, 3, 1, 6, "blue")
    return w, h, draw


def sunbather():
    """A striped beach umbrella over a towel, someone stretched out on it in sunglasses."""
    w, h = 64, 48

    def draw(g):
        base = h - 2
        g.rect(31, 12, 2, base - 11, "dslate")
        g.tri((6, 16), (58, 16), (32, 2), "red")
        for x0 in (14, 30, 46):
            g.tri((x0 - 4, 16), (x0 + 4, 16), (32, 3), "white")
        g.rect(6, 16, 52, 2, "dred")
        g.rect(4, base - 4, 56, 4, "sky")
        g.rect(4, base - 4, 56, 1, "cyan")
        g.rect(4, base - 1, 56, 1, "blue")
        g.ell(12, base - 8, 4, 4, "skin1")
        g.rect(10, base - 9, 6, 2, "ink")
        g.rect(15, base - 8, 30, 4, "skin1")
        g.rect(15, base - 6, 30, 2, "skin2")
        g.rect(22, base - 9, 10, 5, "amber")
        g.rect(22, base - 5, 10, 1, "orange")
    return w, h, draw


def ring_buoy():
    """A lifesaving post: an orange ring buoy hung on a wooden post with a little sign."""
    w, h = 24, 60

    def draw(g):
        base = h - 2
        g.rect(10, 6, 4, base - 5, "brown")
        g.rect(13, 6, 1, base - 5, "dbrown")
        g.rect(4, 4, 16, 8, "white")
        g.rect(6, 6, 12, 1, "dred")
        g.rect(6, 8, 8, 1, "dred")
        g.ell(12, 24, 9, 9, "orange")
        g.ell(12, 24, 4, 4, None)
        for dx, dy in ((-7, -1), (5, -1), (-1, -7), (-1, 5)):
            g.rect(12 + dx, 24 + dy, 3, 3, "white")
    return w, h, draw


def kite_flyer():
    """A kid flying a diamond kite, its string up from the hands to the kite and its tail."""
    w, h = 52, 76

    def draw(g):
        base = h - 2
        g.rect(31, base - 10, 3, 10, "navy")
        g.rect(36, base - 10, 3, 10, "navy")
        g.rect(30, base - 24, 10, 14, "yellow")
        g.rect(37, base - 24, 3, 14, "amber")
        g.ell(35, base - 30, 6, 6, "skin1")
        g.rect(29, base - 36, 12, 4, "dbrown")
        g.rect(24, base - 30, 7, 3, "yellow")
        g.rect(23, base - 33, 3, 3, "skin1")
        for k in range(5):
            g.rect(23 - k * 1.4, base - 37 - k * 4, 1, 4, "plum")
        g.tri((14, 2), (24, 12), (14, 24), "red")
        g.tri((14, 2), (4, 12), (14, 24), "yellow")
        g.tri((4, 12), (24, 12), (14, 14), "orange")
        for k in range(5):
            g.rect(11 - k * 1.6, 25 + k * 3, 3, 2, ("blue", "white", "red", "white", "blue")[k])
    return w, h, draw


PROPS = {
    "lifeguard-stand": (lifeguard_stand(), True),
    "muskoka-chairs": (muskoka_chairs(), False),
    "volleyball-net": (volleyball_net(), False),
    "sunbather": (sunbather(), False),
    "ring-buoy": (ring_buoy(), True),
    "kite-flyer": (kite_flyer(), True),
}


def prop(key, s=1.0):
    (w, h, draw), _ = PROPS[key]
    g = edged(Mini(SCALE * s, w, h))
    draw(g)
    return to_image(g.outlined())


# Placed props: (key, side, inner edge across, distance ahead of the feet).
PLACED = [
    ("volleyball-net", -1, 176, 580),
    ("lifeguard-stand", 1, 180, 370), ("kite-flyer", -1, 172, 330), ("sunbather", 1, 176, 220),
    ("muskoka-chairs", -1, 174, 170), ("ring-buoy", 1, 172, 120),
]
# Road objects: (key, tag, lane, distance ahead).
OBJECTS = [("goose", "idle", 3, 560), ("tip", "idle", 1, 470), ("ball-bounce", "bounce", 0, 390),
           ("treat", "idle", 4, 300), ("tip", "idle", 3, 200), ("goose", "idle", 1, 330)]


def walk():
    use_camera()
    hp.ZONES["beaches"] = dict(name="The Beaches", art="paws-promenade", shadow=K[SHADE], leash=K[LEASH],
                               difficulty=5, difficulty_name=None, fees=None)
    sc = hp.Scene(W, H)
    sc.shade, sc.leash_col = SHADE, LEASH
    px = sc.img.load()
    for y in range(FAR_Y, DOG_BAND_Y):
        z, s = hp.distance_at(y)
        for x in range(W):
            px[x, y] = hp.rgb(ground((x + 0.5 - CX) / s, z))
    # props and road objects, far ones first
    items = []
    for key, side, inner, d in PLACED:
        s = F / (F + d)
        img = prop(key, s)
        across = inner + (PROPS[key][0][0] * SCALE) / 2
        items.append((d, "prop", key, CX + side * across * s, s, img))
    for key, tag, ln, d in OBJECTS:
        items.append((d, "obj", key, tag, ln, None))
    for it in sorted(items, key=lambda it: -it[0]):
        d = it[0]
        if it[1] == "prop":
            _, _, key, sx, s, img = it
            sy = YH + KS * s
            if PROPS[key][1]:
                sc.shade = SAND_DK
                sc.shadow(round(sx), round(sy), img.getbbox()[2] - img.getbbox()[0])
                sc.shade = SHADE
            sc.paste(img, round(sx - img.width / 2), round(sy) - img.height)
        else:
            _, _, key, tag, ln, _ = it
            sc.stand(key, tag, hp.lane(ln), d)
    sc.pack(hp.lane(2), tuple(f"dog-{d}" for d in DOGS))
    band = backdrop().img
    sc.img.paste(band, (0, 40))
    route = [z for z in hp.ZONES if z != "beaches"][:hp.WALK_LENGTH - 1] + ["beaches"]
    sc.top_bar(route, 46, 2, 0.4)
    b = hp.TOP_BAR["buttons"]["sound"]
    sc.paste(hp.frame("ui-icon-button", "normal"), b["face"]["x"], b["face"]["y"])
    sc.paste(hp.frame("icon-sound", "on"), b["icon"]["x"], b["icon"]["y"])
    panel = hp.Scene(W, H - DOG_BAND_Y)
    dog_band = hp.image("ui-dog-band")
    panel.img.paste(dog_band, (0, 0), dog_band)
    for i, d in enumerate(DOGS):
        panel.doghouse(i * 120, 470 - DOG_BAND_Y, d, hp.dog(d)[3])
    sc.img.paste(panel.img, (0, DOG_BAND_Y))
    return sc.img


def sheet():
    """Each new prop at full size, 2x, on sand, labelled under it."""
    keys = list(PROPS)
    imgs = [prop(k) for k in keys]
    cols, pad = 3, 10
    cw = max(i.width for i in imgs) + pad
    rows = [imgs[i:i + cols] for i in range(0, len(imgs), cols)]
    rh = [max(i.height for i in r) + 16 for r in rows]
    cv = hp.Canvas(cols * cw + pad, sum(rh) + pad)
    cv.fill(0, 0, cv.img.width, cv.img.height, SAND)
    y = pad
    for r, (row, h) in enumerate(zip(rows, rh)):
        for c, img in enumerate(row):
            x = pad + c * cw
            cv.paste(img, x + (cw - pad - img.width) // 2, y + h - 16 - img.height)
            hp.text_c(cv, keys[r * cols + c].upper(), x + (cw - pad) / 2, y + h - 12, "plum")
        y += h
    return cv.img.resize((cv.img.width * 2, cv.img.height * 2), Image.NEAREST)


def build():
    os.makedirs(OUT, exist_ok=True)
    walk().convert("RGB").save(f"{OUT}/beaches-walk.png")
    sheet().convert("RGB").save(f"{OUT}/beaches-props.png")
    print("built", f"{OUT}/beaches-walk.png", f"{OUT}/beaches-props.png")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
