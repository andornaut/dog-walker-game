#!/usr/bin/env python3
"""Mock: Kensington Market as a Toronto zone, on the tall backdrop band and the tilted camera.

Draws, in Endesga 32:
- kensington-walk.png: a 360x560 walk screen. The top bar; a 174-row band on rows 40 to 213 (painted
  bay-and-gable houses turned into shops, string lights along their cornices, Bellevue Square's
  parkette, a mural wall with the CN Tower behind it, and a flat sky above row 61); the market street
  in the camera (feet on row 464, focal 720, the far edge at scale 0.5 on row 214) with a narrow
  sidewalk and a brick forecourt where the stalls stand; roadside props on both verges, drawn at their
  depth back to front with the road objects and under the band; the walker and pack, obstacles and
  pickups; and the doghouse row.
- kensington-props.png: the new roadside props at 2x on the forecourt colour, labelled.

Props are front elevations on a design grid drawn 1.75x, outlined with road_edge, as roadside.py's.
Unlike roadside.py's rule, the busker and the shoppers are people: they stand on the forecourt
beyond the sidewalk, never on the road.

Usage:
  mock_toronto_kensington.py build   write public/art/mocks/toronto/kensington-*.png

Run from the repository root. Mock tooling only: nothing here is game art.
"""

import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import mock_toronto as mt  # noqa: E402
import scene as sn  # noqa: E402

# The tall band's camera and regions, which the committed layout export predates.
sn.LAYOUT["regions"]["backdrop"] = dict(x=0, y=40, width=360, height=174)
sn.LAYOUT["regions"]["approach"] = dict(x=0, y=195, width=360, height=19)
sn.LAYOUT["regions"]["road"] = dict(x=20, y=214, width=320, height=256)
sn.LAYOUT["camera"].update(horizonY=-36, farY=214, focal=720, footY=464, ratio=500 / 720)
mt.W, mt.H, mt.OX, mt.TOP = 360, 560, 0, 0
mt.YH, mt.FOOT, mt.F = -36, 464, 720
mt.KS = mt.FOOT - mt.YH

import backdrops as bd  # noqa: E402  (reads the patched layout at import)
from minis import Mini, scaled  # noqa: E402
from pixel import DARKER, K, edged  # noqa: E402

OUT = "public/art/mocks/toronto"
W, H = 360, 560
BAND_Y, FAR_Y, ROAD_END, DOG_BAND_Y = 40, 214, 470, 466
SCALE = 1.75
STEP_SCALES = (1, 0.875, 0.75, 0.625, 0.5)
DOGS = ("koda", "biscuit", "duchess")

# The verge, across from the road's centre line: curb, a narrow sidewalk, then the brick forecourt
# the stalls and houses stand on.
ROAD, CURB, WALK = 160, 164, 186
FORECOURT = "tan"


def dk(c):
    return DARKER[K.get(c, c)]


def noise(x, y):
    return bd.noise(int(x), int(y))


# ---------- the market street ----------

def road(x, z, span, px, py):
    """Worn asphalt: dslate with sealed cracks (navy, wandering along the road, not across it),
    sparse slate flecks and a slate gutter by each curb."""
    a = abs(x)
    if a >= ROAD - 3:
        return "slate"
    cx, cz = math.floor((x + 400) / 64), math.floor(z / 160)
    if z >= 160 and noise(cx, cz + 7) < 0.16 and 30 <= z % 160 < 100:
        line = cx * 64 - 400 + 24 + 6 * math.sin(z / 19 + cx * 2.3) + 3 * math.sin(z / 7 + cz)
        if line <= x < line + 2.5:
            return "navy"
    if noise(px, py) < 1 / 41:
        return "slate"
    return "dslate"


def verge(x, z, span, px, py):
    a = abs(x)
    if a < ROAD:
        return road(x, z, span, px, py)
    if a < CURB:
        return "grey"
    if a < WALK:
        if span < 16 and bd.crosses(z, span, 32):
            return "grey"
        return "grey" if noise(px, py + 11) < 0.02 else "lgrey"
    if a < WALK + 2:
        return "grey"
    if span < 10 and bd.crosses(z, span, 20):
        return "brown"
    return "skin2" if noise(px, py) < 0.04 else FORECOURT


def dividers(img, y, s, z, span):
    """The lane dividers on screen row y: light grey dashes 16 in 32, 2 road px wide."""
    if span > 6 or z % 32 >= 16:
        return
    for d in (-96, -32, 32, 96):
        x0 = round(mt.CX + (d - 1) * s - 0.5)
        for x in range(x0, x0 + max(1, round(2 * s))):
            img.putpixel((x, y), sn.rgb("lgrey"))


def raster(img, y0, y1):
    """The road and verges in the camera, screen rows y0 to y1 - 1."""
    for y in range(y0, y1):
        s = (y + 0.5 - mt.YH) / mt.KS
        z = mt.F / s - mt.F
        span = z - (mt.F / ((y + 1.5 - mt.YH) / mt.KS) - mt.F)
        for x in range(W):
            img.putpixel((x, y), sn.rgb(verge((x + 0.5 - mt.CX) / s, z, span, x, y)))
        dividers(img, y, s, z, span)


# ---------- the backdrop band ----------

def victorian(cv, x, w, top, wall, roof, trim, shop, awn, sign, board, letters):
    """A bay-and-gable house turned shop, facing the camera: a steep gable with trim inside its
    edge and an attic window, a bay window upstairs, and a one-storey shop built out to the sidewalk
    (bd.shopfront) with its cornice."""
    base = bd.BASE
    ext = base - 34
    rb = top + 16
    for r in range(top, rb + 1):
        half = (r - top) * (w / 2 + 2) / 16
        cv.fill(round(x + w / 2 - half), r, round(2 * half), 1, roof)
        if r >= top + 4:
            inner = half - 3
            cv.fill(round(x + w / 2 - inner), r, round(2 * inner), 1, trim)
        if r >= top + 6:
            inner = half - 5
            cv.fill(round(x + w / 2 - inner), r, round(2 * inner), 1, wall)
    mid = x + w // 2
    cv.fill(mid - 2, top + 8, 5, 6, "plum")
    cv.fill(mid - 1, top + 9, 3, 4, "cyan")
    cv.fill(x + 3, rb, w - 6, ext - rb, wall)
    cv.fill(x + w - 6, rb, 3, ext - rb, dk(wall))
    cv.fill(x + 2, rb, 1, ext - rb, "plum")
    cv.fill(x + w - 3, rb, 1, ext - rb, "plum")
    bx, bw = x + w // 2 - 13, 26
    cv.fill(bx - 1, rb + 2, bw + 2, 2, roof)
    cv.fill(bx, rb + 4, bw, ext - rb - 6, trim)
    cv.fill(bx + bw - 2, rb + 4, 2, ext - rb - 6, dk(trim))
    for i in range(3):
        cv.fill(bx + 2 + i * 8, rb + 6, 6, ext - rb - 11, "plum")
        cv.fill(bx + 3 + i * 8, rb + 7, 4, ext - rb - 13, "cyan")
        cv.fill(bx + 3 + i * 8, rb + 7, 1, 2, "white")
    cv.fill(bx - 1, ext - 3, bw + 2, 1, dk(trim))
    bd.shopfront(cv, x, w, ext, base, shop, awn, sign, board, letters)
    cv.fill(x, ext - 1, w, 2, trim)


def lights(cv, x0, x1, y0, y1, sag):
    """A string of bulbs on a plum wire from (x0, y0) to (x1, y1), sagging sag rows in the middle."""
    cols = ("yellow", "orange", "pink", "white", "green")
    for x in range(x0, x1):
        t = (x - x0) / max(1, x1 - x0)
        yy = round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)) + 1
        if 0 <= x < bd.W:
            cv.fill(x, yy, 1, 1, "plum")
            if x % 7 == 3:
                cv.fill(x, yy + 1, 2, 2, cols[(x // 7) % len(cols)])


def cn_tower(cv, cx, foot):
    """The CN Tower in the distance: a pale shaft from row foot, the main pod with its window band,
    the sky pod and the antenna, its tip on row 62, under the message strip's calm rows."""
    cv.fill(cx, 62, 1, 9, "grey")
    cv.fill(cx - 1, 71, 3, 3, "lgrey")
    cv.fill(cx + 1, 71, 1, 3, "grey")
    cv.fill(cx - 1, 74, 3, foot - 74, "lgrey")
    cv.fill(cx + 1, 74, 1, foot - 74, "grey")
    cv.fill(cx - 2, 92, 5, foot - 92, "lgrey")
    cv.fill(cx + 2, 92, 1, foot - 92, "grey")
    cv.fill(cx - 4, 79, 9, 1, "lgrey")
    cv.fill(cx - 5, 80, 11, 3, "lgrey")
    cv.fill(cx - 5, 81, 11, 1, "slate")
    cv.fill(cx + 3, 80, 3, 3, "grey")
    cv.fill(cx - 4, 83, 9, 1, "grey")
    cv.fill(cx - 2, 84, 5, 1, "grey")


def mural_block(cv, x, w, top):
    """A flat-roofed brick block whose wall is one big mural: a sun with a face, a pink wave and
    green leaves on blue, graffiti tags along the bottom."""
    base = bd.BASE
    cv.fill(x, top, w, base - top, "rust")
    cv.fill(x, top, w, 2, "lgrey")
    bd.outline_box(cv, x, top, w, base - top + 1, "plum")
    mx0, my0, mx1, my1 = x + 3, top + 4, x + w - 3, base - 9
    cv.fill(mx0, my0, mx1 - mx0, my1 - my0, "blue")
    cx, cy, r = x + 17, top + 16, 8
    for dy in range(-r - 3, r + 4):
        for dx in range(-r - 3, r + 4):
            d2 = dx * dx + dy * dy
            if mx0 <= cx + dx < mx1 and my0 <= cy + dy < my1:
                if d2 <= r * r:
                    cv.fill(cx + dx, cy + dy, 1, 1, "yellow")
                elif d2 <= (r + 3) ** 2 and (math.atan2(dy, dx) * 8 / math.pi) % 2 < 1:
                    cv.fill(cx + dx, cy + dy, 1, 1, "orange")
    cv.fill(cx - 3, cy - 1, 2, 2, "plum")
    cv.fill(cx + 2, cy - 1, 2, 2, "plum")
    cv.fill(cx - 2, cy + 3, 5, 1, "dred")
    for px in range(mx0, mx1):
        yy = my1 - 9 + round(2.5 * math.sin((px - mx0) / 4))
        cv.fill(px, yy, 1, my1 - yy, "pink")
        cv.fill(px, yy, 1, 1, "white")
    for lx, ly in ((x + w - 16, top + 10), (x + w - 10, top + 16), (x + w - 20, top + 19)):
        cv.fill(lx, ly, 4, 2, "green")
        cv.fill(lx + 1, ly - 1, 2, 4, "green")
        cv.fill(lx + 1, ly + 1, 2, 1, "dgreen")
    for i, c in enumerate(("white", "hot", "cyan", "white", "yellow")):
        tx = x + 4 + i * 9
        cv.fill(tx, base - 7, 5, 1, c)
        cv.fill(tx + 1 + i % 2, base - 6, 1, 3, c)
        cv.fill(tx + 3, base - 5, 3, 1, c)


def parkette(cv, x0, x1):
    """Bellevue Square's parkette: grass, two round trees, a bench and a lamp, a low iron rail."""
    base = bd.BASE
    for px in range(x0, x1):
        for py in range(base - 2, base):
            cv.fill(px, py, 1, 1, "green")
    bd.treeline(cv, base - 2, ("dgreen", "green"), 2.1, 2, 6)
    for cx, top, r in ((x0 + 16, base - 44, 15), (x1 - 18, base - 40, 14)):
        bd.tree(cv, cx, top, r=r, base=base, girth=4)
    cv.fill(x0 + 26, base - 8, 14, 2, "brown")
    cv.fill(x0 + 26, base - 12, 14, 2, "brown")
    cv.fill(x0 + 27, base - 6, 1, 6, "dbrown")
    cv.fill(x0 + 38, base - 6, 1, 6, "dbrown")
    lx = x0 + 46
    cv.fill(lx, base - 22, 2, 22, "forest")
    cv.fill(lx - 1, base - 26, 4, 4, "white")
    cv.fill(lx + 2, base - 25, 1, 3, "lgrey")


def backdrop():
    cv = sn.Canvas(bd.W, bd.H)
    bd.sky(cv, clouds=((112, bd.BASE - 58, 22, 4),))
    base = bd.BASE
    # downtown in the distance, pale, and the CN Tower over the mural block
    for x, w, top in ((206, 22, base - 52), (226, 18, base - 60), (308, 20, base - 56), (330, 26, base - 48),
                      (8, 24, base - 50), (60, 20, base - 56)):
        bd.block(cv, x, w, top, base, "lgrey", "grey", "white")
    cn_tower(cv, 282, base)
    parkette(cv, 96, 152)
    mural_block(cv, 254, 50, base - 46)
    houses = ((-6, 52, 64, "purple", "plum", "yellow", "yellow", "green", "FRUIT", "forest", "yellow"),
              (46, 50, 68, "green", "forest", "white", "pink", "red", "CHEESE", "plum", "yellow"),
              (152, 54, 62, "orange", "rust", "cream", "purple", "pink", "VINTAGE", "plum", "cyan"),
              (206, 48, 70, "sky", "blue", "white", "red", "amber", "SPICES", "dred", "yellow"),
              (304, 62, 66, "pink", "dred", "white", "cyan", "sky", "COFFEE", "navy", "white"))
    for h in houses:
        victorian(cv, *h)
    # string lights hung from gable peak to gable peak, sagging across the gaps
    peaks = [(x + w // 2, top) for x, w, top, *_ in houses]
    for (x0, y0), (x1, y1) in zip([(-30, 70)] + peaks, peaks + [(390, 70)]):
        lights(cv, x0, x1, y0, y1, 9)
    # the far sidewalk, a fruit display and a bike at the post-and-ring stand
    bd.yard(cv, base, bd.FAR_WALK, bd.slabs)
    for i, c in enumerate(("red", "orange", "green", "yellow")):
        cv.fill(6 + i * 7, base - 3, 6, 4, "brown")
        cv.fill(6 + i * 7, base - 5, 6, 2, c)
        cv.fill(7 + i * 7, base - 6, 4, 1, c)
    for c, gx in (("red", 166), ("sky", 174), ("yellow", 182)):
        cv.fill(gx, base - 12, 6, 10, c)
    cv.fill(164, base - 13, 22, 1, "lgrey")
    cv.fill(164, base - 13, 1, 13, "lgrey")
    cv.fill(185, base - 13, 1, 13, "lgrey")
    for wx in (232, 240):
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                if 3 <= dx * dx + dy * dy <= 5:
                    cv.fill(wx + dx, base + 1 + dy, 1, 1, "dslate")
    cv.fill(231, base - 1, 10, 1, "orange")
    cv.fill(236, base - 4, 1, 4, "dslate")
    cv.fill(236, base - 4, 4, 1, "dslate")

    bd.cross(cv, bd.flat(road), "slate", bd.slabs)
    bd.cross_line(cv, "lgrey", dash=(16, 32))
    bd.street(cv, verge)
    bd.lanes(cv, "lgrey", dash=(16, 32))
    # the near-left perch: a low brick wall sprayed with tags, its coping the cat's rail
    lo, hi = sorted(bd.PERCH_X)
    bd.front(cv, lo, hi, bd.PERCH, 0, bd.PERCH_H - 3, "rust")
    for i, xx in enumerate(range(int(hi) - 30, int(hi) - 160, -70)):
        c = ("cyan", "yellow")[i % 2]
        bd.front(cv, xx - 26, xx - 8, bd.PERCH, 13, 16, c)
        bd.front(cv, xx - 18, xx, bd.PERCH, 6, 9, c)
    bd.front(cv, lo, hi, bd.PERCH, bd.PERCH_H - 3, bd.PERCH_H, "lgrey")
    return cv


# ---------- roadside props: front elevations on a design grid ----------

def person(g, cx, base, skin, hair, coat, legs, hat=None, tall=46):
    """A chibi grown-up facing the road, feet on row base, about tall rows from hat to shoe."""
    top = base - tall
    g.rect(cx - 5, base - 12, 4, 11, legs)
    g.rect(cx + 1, base - 12, 4, 11, legs)
    g.rect(cx - 6, base - 2, 5, 2, "dbrown")
    g.rect(cx + 1, base - 2, 5, 2, "dbrown")
    g.rect(cx - 7, top + 17, 14, base - 12 - top - 17, coat)
    g.rect(cx + 4, top + 17, 3, base - 12 - top - 17, dk(coat))
    g.rect(cx - 10, top + 18, 3, 13, coat)
    g.rect(cx + 7, top + 18, 3, 13, dk(coat))
    g.rect(cx - 10, top + 31, 3, 3, skin)
    g.rect(cx + 7, top + 31, 3, 3, skin)
    g.ell(cx, top + 9, 8, 8.5, hair)
    g.ell(cx, top + 11, 6.5, 6.5, skin)
    g.rect(cx - 4, top + 10, 2, 2, "ink")
    g.rect(cx + 2, top + 10, 2, 2, "ink")
    g.rect(cx - 1, top + 14, 2, 1, "dred")
    if hat:
        g.ell(cx, top + 4, 8.5, 5, hat)
        g.rect(cx - 8, top + 5, 17, 3, dk(hat))
        g.ell(cx, top - 0.5, 2, 2, hat)


def shop_house(wall, roof, trim, shop, awn, board, pict):
    """A bay-and-gable Victorian painted bright, its ground floor built out to the sidewalk as a
    shop: a gable with trim inside its edge, a round attic window, a bay window upstairs, a cornice
    hung with string lights, a sign board with the shop's picture, a striped awning, the shop window
    full of goods and the door."""
    w, h = 96, 124

    def draw(g, f=0):
        base, ext, rb = h - 2, h - 42, 36
        g.tri((5, rb + 1), (91, rb + 1), (48, 3), roof)
        g.tri((13, rb + 1), (83, rb + 1), (48, 11), trim)
        g.tri((18, rb + 1), (78, rb + 1), (48, 17), wall)
        g.ell(48, 27, 4.5, 5, "plum")
        g.ell(48, 27, 3, 3.5, "cyan")
        g.rect(12, rb, 72, ext - rb, wall)
        g.rect(80, rb, 4, ext - rb, dk(wall))
        bx0, bx1, by0, by1 = 26, 70, rb + 6, ext - 4
        g.rect(bx0 - 2, by0 - 3, bx1 - bx0 + 4, 3, roof)
        g.rect(bx0, by0, bx1 - bx0, by1 - by0, trim)
        g.rect(bx1 - 3, by0, 3, by1 - by0, dk(trim))
        for px in (bx0 + 3, bx0 + 16, bx0 + 29):
            g.rect(px, by0 + 3, 11, by1 - by0 - 8, "plum")
            g.rect(px + 1, by0 + 4, 9, by1 - by0 - 10, "cyan")
            g.rect(px + 2, by0 + 5, 2, 3, "white")
        g.rect(bx0 - 1, by1 - 3, bx1 - bx0 + 2, 3, dk(trim))
        g.rect(2, ext, 92, base - ext, shop)
        g.rect(90, ext, 4, base - ext, dk(shop))
        g.rect(1, ext - 3, 94, 4, trim)
        g.rect(1, ext, 94, 1, dk(trim))
        for i, x in enumerate(range(12, 84, 8)):
            g.rect(x, ext - 6 + (i % 2), 8, 1, "plum")
            g.rect(x + 3, ext - 5 + (i % 2), 2, 2, ("yellow", "orange", "pink", "cyan", "green")[i % 5])
        g.rect(14, ext + 4, 68, 13, "plum")
        g.rect(15, ext + 5, 66, 11, board)
        pict(g, 48, ext + 10)
        for i, x in enumerate(range(4, 92, 8)):
            g.rect(x, ext + 19, 8, 6, awn if i % 2 == 0 else "white")
            g.ell(x + 4, ext + 25, 4, 2, awn if i % 2 == 0 else "white")
        g.rect(8, ext + 29, 52, base - ext - 29, "plum")
        g.rect(9, ext + 30, 50, base - ext - 31, "cyan")
        g.rect(11, ext + 31, 4, 2, "white")
        for i, c in enumerate(("red", "yellow", "orange", "green", "pink", "amber")):
            g.ell(15 + i * 7.5, base - 4, 3, 3, c)
        g.rect(9, base - 2, 50, 1, "dbrown")
        g.rect(66, ext + 28, 18, base - ext - 28, "plum")
        g.rect(67, ext + 29, 16, base - ext - 29, "dbrown")
        g.rect(68, ext + 31, 12, 7, "cyan")
        g.rect(79, base - 10, 2, 2, "amber")
    return w, h, draw


def pict_cheese(g, cx, cy):
    g.tri((cx - 9, cy + 4), (cx + 9, cy + 4), (cx + 9, cy - 4), "yellow")
    g.rect(cx - 9, cy + 4, 18, 1, "amber")
    g.ell(cx + 4, cy + 1, 1.5, 1.5, "amber")
    g.ell(cx + 6, cy - 2, 1, 1, "amber")


def pict_shirt(g, cx, cy):
    g.rect(cx - 5, cy - 4, 10, 9, "sky")
    g.rect(cx - 9, cy - 4, 4, 4, "sky")
    g.rect(cx + 5, cy - 4, 4, 4, "sky")
    g.rect(cx - 2, cy - 4, 4, 2, "navy")
    g.rect(cx - 1, cy - 6, 2, 2, "lgrey")


def pict_apple(g, cx, cy):
    g.ell(cx, cy + 1, 5, 4.5, "red")
    g.rect(cx, cy - 6, 1, 3, "dbrown")
    g.ell(cx + 3, cy - 4, 2.5, 1.5, "green")
    g.rect(cx - 3, cy - 1, 1, 2, "white")


def mural_wall():
    """A brick side wall, its whole face a mural: a sun with a face over a blue sky, a pink wave,
    green leaves, and graffiti tags painted along its foot."""
    w, h = 96, 72

    def draw(g, f=0):
        base = h - 2
        g.rect(2, 6, 92, base - 6, "rust")
        g.rect(1, 4, 94, 3, "lgrey")
        g.rect(90, 7, 4, base - 7, "dred")
        g.rect(6, 11, 82, base - 25, "blue")
        g.ell(28, 30, 15, 15, "orange")
        g.ell(28, 30, 11, 11, "yellow")
        g.rect(23, 27, 3, 3, "plum")
        g.rect(31, 27, 3, 3, "plum")
        g.rect(25, 35, 7, 2, "dred")
        for x in range(6, 88, 2):
            top = 42 + round(4 * math.sin(x / 7))
            g.rect(x, top, 2, base - 14 - top, "pink")
            g.rect(x, top, 2, 1, "white")
        for lx, ly in ((62, 18), (72, 26), (60, 32), (78, 16)):
            g.ell(lx, ly, 5, 3, "green")
            g.rect(lx - 4, ly, 8, 1, "dgreen")
        for i, c in enumerate(("white", "hot", "cyan", "yellow", "white")):
            x = 8 + i * 16
            g.rect(x, base - 10, 10, 2, c)
            g.rect(x + 2 + i % 3, base - 12, 2, 7, c)
            g.rect(x + 7, base - 8, 4, 2, c)
    return w, h, draw


def fruit_stand():
    """A wooden fruit stall under a green and white striped canopy on two poles: tilted crates of
    apples, oranges, limes and lemons, two more crates under the table, a chalkboard price sign."""
    w, h = 68, 60

    def draw(g, f=0):
        base = h - 2
        g.rect(6, 10, 2, base - 10, "dbrown")
        g.rect(60, 10, 2, base - 10, "dbrown")
        for i, x in enumerate(range(3, 65, 8)):
            g.rect(x, 5, 8, 9, "green" if i % 2 == 0 else "white")
            g.ell(x + 4, 14, 4, 2, "green" if i % 2 == 0 else "white")
        g.rect(3, 4, 62, 1, "forest")
        g.rect(26, 18, 16, 8, "ink")
        g.rect(28, 20, 5, 1, "white")
        g.rect(28, 22, 9, 1, "white")
        g.rect(31, 16, 1, 2, "dbrown")
        g.rect(36, 16, 1, 2, "dbrown")
        for i, c in enumerate(("red", "orange", "green", "yellow")):
            x = 6 + i * 14
            g.rect(x, 32, 14, 8, "brown")
            g.rect(x, 32, 14, 1, "tan")
            g.rect(x + 13, 32, 1, 8, "dbrown")
            for k in range(3):
                g.ell(x + 3.5 + k * 3.5, 31, 2, 2, c)
        g.rect(4, 40, 60, 3, "dbrown")
        g.rect(8, 43, 3, base - 43, "dbrown")
        g.rect(57, 43, 3, base - 43, "dbrown")
        for x, c in ((14, "green"), (34, "red")):
            g.rect(x, base - 9, 18, 9, "brown")
            g.rect(x, base - 9, 18, 1, "tan")
            for k in range(4):
                g.ell(x + 3 + k * 4, base - 10, 2, 2, c)
    return w, h, draw


def clothes_rack():
    """A rolling rail of vintage clothes: a red dress, a denim jacket, a yellow shirt, a striped top
    and a leather jacket on hangers, on a chrome frame with casters."""
    w, h = 52, 60

    def draw(g, f=0):
        base = h - 2
        g.rect(5, 8, 2, base - 10, "lgrey")
        g.rect(45, 8, 2, base - 10, "lgrey")
        g.rect(3, 8, 46, 2, "lgrey")
        g.rect(3, base - 5, 46, 2, "grey")
        for x in (6, 46):
            g.ell(x, base - 1.5, 2, 2, "dslate")
        clothes = (("red", "dress"), ("blue", "jacket"), ("yellow", "shirt"), ("pink", "stripes"), ("dbrown", "jacket"))
        for i, (c, kind) in enumerate(clothes):
            x = 8 + i * 7.5
            g.rect(x + 3, 6, 1, 4, "grey")
            if kind == "dress":
                g.rect(x, 10, 7, 10, c)
                g.tri((x - 2, 36), (x + 9, 36), (x + 3.5, 16), c)
            elif kind == "stripes":
                for k in range(0, 22, 4):
                    g.rect(x, 10 + k, 8, 2, c)
                    g.rect(x, 12 + k, 8, 2, "white")
            else:
                g.rect(x, 10, 8, 22 if kind == "jacket" else 19, c)
                g.rect(x + 7, 10, 1, 22 if kind == "jacket" else 19, dk(c))
            if kind == "jacket":
                g.rect(x + 3, 12, 1, 18, dk(c))
    return w, h, draw


def bike_rack():
    """Toronto's post-and-ring bike stands, overflowing: three bikes locked side on, orange, cyan
    and pink, the pink one with a basket of flowers."""
    w, h = 88, 40

    def draw(g, f=0):
        base = h - 2

        def bike(x, col, basket=False):
            for cx in (x + 8, x + 32):
                g.ell(cx, base - 9, 9, 9, "dslate")
                g.ell(cx, base - 9, 6, 6, None)
                g.rect(cx - 1, base - 10, 2, 2, "grey")
            g.tri((x + 8, base - 9), (x + 16, base - 9), (x + 13, base - 19), col)
            g.tri((x + 16, base - 9), (x + 13, base - 19), (x + 29, base - 19), col)
            g.rect(x + 13, base - 20, 16, 2, col)
            g.rect(x + 28, base - 24, 2, 15, col)
            g.rect(x + 9, base - 23, 9, 3, "ink")
            g.rect(x + 26, base - 26, 8, 2, "lgrey")
            if basket:
                g.rect(x + 31, base - 25, 9, 6, "tan")
                g.rect(x + 31, base - 25, 9, 1, "brown")
                for k, c in enumerate(("red", "yellow", "white")):
                    g.ell(x + 33 + k * 3, base - 27, 1.5, 1.5, c)

        for px in (24, 64):
            g.rect(px, base - 26, 2, 26, "dslate")
            g.ell(px + 1, base - 28, 7, 7, "dslate")
            g.ell(px + 1, base - 28, 5, 5, None)
        bike(2, "orange")
        bike(44, "cyan")
        bike(22, "pink", basket=True)
    return w, h, draw


def garden_car():
    """The garden car: an old sedan side on, facing left (drawn facing right, then mirrored), spray-painted pink with splats and squiggles, grass
    growing on its roof, flowers in its windows and a little tree sprouting from its hood, sitting
    on flat tyres."""
    w, h = 104, 64

    def draw(g, f=0):
        base = h - 2
        g.rect(8, base - 24, 88, 14, "pink")
        g.ell(10, base - 17, 6, 7, "pink")
        g.ell(94, base - 17, 6, 7, "pink")
        g.tri((24, base - 24), (36, base - 38), (36, base - 24), "pink")
        g.rect(36, base - 38, 30, 14, "pink")
        g.tri((66, base - 38), (66, base - 24), (80, base - 24), "pink")
        g.rect(8, base - 12, 88, 2, "mauve")
        for x0, x1 in ((30, 49), (52, 70)):
            g.rect(x0 + (3 if x0 == 30 else 0), base - 35, x1 - x0 - (3 if x0 == 30 else 0), 10, "dgreen")
            for k in range(x0 + 4, x1 - 1, 5):
                g.ell(k, base - 29, 2, 2, ("red", "yellow", "white", "orange")[k % 4])
        for x in range(36, 66, 3):
            g.tri((x, base - 38), (x + 3, base - 38), (x + 1.5, base - 44 - (x % 4)), "green" if x % 2 else "dgreen")
        g.rect(80, base - 34, 3, 10, "dbrown")
        g.ell(81.5, base - 41, 10, 8, "green", "dgreen")
        for x, y, c in ((76, base - 43, "red"), (85, base - 39, "yellow"), (80, base - 46, "white")):
            g.rect(x, y, 2, 2, c)
        for x, y, r, c in ((18, base - 18, 4, "yellow"), (44, base - 16, 3, "cyan"), (62, base - 19, 4, "green"),
                           (88, base - 16, 3, "purple")):
            g.ell(x, y, r, r, c)
        g.rect(26, base - 21, 10, 2, "sky")
        g.rect(50, base - 21, 8, 2, "orange")
        g.rect(70, base - 15, 12, 2, "white")
        for cx in (24, 80):
            g.ell(cx, base - 6, 9, 6, "dslate")
            g.ell(cx, base - 7, 4, 3, "grey")
    return w, h, draw


def busker():
    """A busker in a mustard beanie playing an orange guitar, his open case beside him and two
    notes in the air."""
    w, h = 44, 62

    def draw(g, f=0):
        base = h - 2
        person(g, 18, base, "skin1", "dbrown", "forest", "navy", hat="amber", tall=48)
        g.rect(13, base - 32, 10, 4, "dbrown")
        g.ell(20, base - 22, 7, 6, "orange", "ochre")
        g.ell(20, base - 22, 2, 2, "dbrown")
        for k in range(8):
            g.rect(13 - k * 1.6, base - 26 - k * 1.2, 3, 2, "brown")
        g.rect(0, base - 37, 4, 4, "dbrown")
        g.rect(9, base - 26, 6, 3, "skin1")
        g.rect(29, base - 8, 13, 8, "dred")
        g.rect(30, base - 7, 11, 5, "red")
        for x, y in ((34, 6), (40, 12)):
            g.ell(x, y + 5, 2, 1.5, "plum")
            g.rect(x + 1, y, 1, 5, "plum")
            g.rect(x + 1, y, 3, 1, "plum")
    return w, h, draw


def shoppers():
    """Two shoppers browsing: one in a yellow raincoat with a paper bag of leeks and a baguette,
    one in a pink beanie with a canvas tote."""
    w, h = 56, 62

    def draw(g, f=0):
        base = h - 2
        person(g, 15, base, "skin2", "ink", "yellow", "dslate", tall=46)
        g.rect(1, base - 26, 9, 10, "tan")
        g.rect(1, base - 26, 9, 1, "brown")
        g.rect(3, base - 32, 2, 7, "green")
        g.rect(6, base - 34, 3, 9, "skin1")
        person(g, 39, base, "skin1", "orange", "blue", "navy", hat="pink", tall=50)
        g.rect(47, base - 24, 8, 10, "cream")
        g.rect(48, base - 30, 1, 6, "cream")
        g.rect(53, base - 30, 1, 6, "cream")
    return w, h, draw


def spice_sacks():
    """Three burlap sacks rolled open, heaped with chili, turmeric and paprika, a scoop in one."""
    w, h = 56, 34

    def draw(g, f=0):
        base = h - 2
        for i, c in enumerate(("red", "yellow", "rust")):
            x = 4 + i * 17
            g.rect(x, base - 16, 15, 16, "tan")
            g.rect(x + 12, base - 16, 3, 16, "skin2")
            g.rect(x - 1, base - 18, 17, 4, "skin2")
            g.ell(x + 7.5, base - 18, 7, 4, c)
            g.rect(x + 3, base - 9, 9, 1, "brown")
        g.rect(26, base - 26, 2, 7, "brown")
        g.rect(24, base - 20, 6, 2, "lgrey")
    return w, h, draw


PROPS = {
    "house-lime": shop_house("green", "forest", "white", "pink", "red", "plum", pict_cheese),
    "house-purple": shop_house("purple", "plum", "yellow", "yellow", "orange", "navy", pict_shirt),
    "house-sky": shop_house("sky", "blue", "white", "orange", "yellow", "forest", pict_apple),
    "mural-wall": mural_wall(),
    "fruit-stand": fruit_stand(),
    "clothes-rack": clothes_rack(),
    "bike-rack": bike_rack(),
    "garden-car": garden_car(),
    "busker": busker(),
    "shoppers": shoppers(),
    "spice-sacks": spice_sacks(),
}
MIRRORED = {"garden-car"}
FREE = {"fruit-stand", "clothes-rack", "bike-rack", "garden-car", "busker", "shoppers", "spice-sacks"}
RENDERED = {}


def render(key, step):
    """A prop's frame at a depth step, outlined with road_edge."""
    if (key, step) not in RENDERED:
        w, h, draw = PROPS[key]
        g = edged(Mini(SCALE * step, w, h))
        draw(g)
        rows = g.outlined()
        img = Image.new("RGBA", (len(rows[0]), len(rows)))
        for y, row in enumerate(rows):
            for x, c in enumerate(row):
                if c:
                    img.putpixel((x, y), sn.rgb(c) + (255,))
        RENDERED[key, step] = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if key in MIRRORED else img
    return RENDERED[key, step]


def at_depth(key, s):
    """The prop at scale s, from the smallest step at least s, shrunk nearest-neighbour."""
    step = min((q for q in STEP_SCALES if q >= s), default=1)
    art = render(key, step)
    full = render(key, 1)
    size = (max(1, math.floor(full.width * s + 0.5)), max(1, math.floor(full.height * s + 0.5)))
    return art if art.size == size else art.resize(size, Image.NEAREST)


def frame_w(key):
    return scaled(PROPS[key][0], SCALE)


# Each side's props: (key, inner edge across, z). Houses stand back at the forecourt's far edge,
# stalls, racks and people at its front, all beyond the sidewalk.
LEFT = (("house-lime", 196, 700), ("house-purple", 196, 600), ("fruit-stand", 190, 520), ("clothes-rack", 190, 450),
        ("busker", 190, 380), ("spice-sacks", 190, 310), ("bike-rack", 190, 230))
RIGHT = (("house-sky", 196, 700), ("mural-wall", 196, 610), ("fruit-stand", 190, 540), ("shoppers", 190, 460),
         ("garden-car", 190, 380), ("bike-rack", 190, 270), ("clothes-rack", 190, 170))
# Road objects: (key, tag, centre x on screen at the feet, z).
ROAD_OBJECTS = (("tip", "idle", 116, 640), ("cafe-patio", "idle", 276, 560), ("minor-sandwich-board", "idle", 52, 470),
                ("treat", "idle", 244, 330), ("tip", "idle", 180, 240))


def ground_shadow(sc, cx, foot, w):
    rx = max(3, w / 2 - 2)
    for y in range(-3, 4):
        for x in range(int(-rx - 1), int(rx + 2)):
            dx, dy = (x + 0.5) / rx, (y + 0.5) / 2.5
            if dx * dx + dy * dy <= 1 and 0 <= cx + x < W:
                px = sc.img.getpixel((int(cx + x), int(foot - 1 + y)))
                key = "%02x%02x%02x" % px
                sc.img.putpixel((int(cx + x), int(foot - 1 + y)), sn.rgb(DARKER.get(key, key)))


def walk_screen(band):
    sc = mt.Scene(W, H)
    sc.shade, sc.leash_col = "navy", "pink"
    raster(sc.img, FAR_Y, ROAD_END)
    items = []
    for side, props in ((-1, LEFT), (1, RIGHT)):
        for key, inner, z in props:
            items.append((z, "prop", key, side * (inner + frame_w(key) / 2)))
    for key, tag, x, z in ROAD_OBJECTS:
        items.append((z, "road", key, (tag, x)))
    for z, kind, key, where in sorted(items, key=lambda it: -it[0]):
        s = mt.F / (mt.F + z)
        foot = round(mt.YH + mt.KS * s)
        if kind == "prop":
            art = at_depth(key, s)
            cx = mt.CX + where * s
            if key in FREE:
                ground_shadow(sc, round(cx), foot, art.getbbox()[2] - art.getbbox()[0])
            sc.paste(art, cx - art.width / 2, foot - art.height)
        else:
            tag, x = where
            sc.stand(key, tag, x, z)
    sc.pack(mt.lane(2), tuple(f"dog-{d}" for d in DOGS))
    sc.img.paste(band, (0, BAND_Y))
    zone = dict(sn.ZONES["shops"], name="Kensington Market")
    sn.ZONES["kensington"] = zone
    sc.top_bar(["kensington"], 0, 1, 0.3)
    b = mt.TOP_BAR["buttons"]["sound"]
    sc.paste(sn.frame("ui-icon-button", "normal"), b["face"]["x"], b["face"]["y"])
    sc.paste(sn.frame("icon-sound", "on"), b["icon"]["x"], b["icon"]["y"])
    panel = mt.Scene(W, H - DOG_BAND_Y)
    dog_band = sn.image("ui-dog-band")
    panel.img.paste(dog_band, (0, 0), dog_band)
    for i, d in enumerate(DOGS):
        panel.doghouse(i * 120, 470 - DOG_BAND_Y, d, mt.dog(d)[3])
    sc.img.paste(panel.img, (0, DOG_BAND_Y))
    return sc.img


def props_sheet():
    """Every new prop at 2x on the forecourt, labelled, in rows."""
    rows = (("house-lime", "house-purple", "house-sky"), ("mural-wall", "garden-car", "fruit-stand"),
            ("clothes-rack", "bike-rack", "busker", "shoppers", "spice-sacks"))
    pad, label = 16, 18
    arts = [[render(k, 1) for k in row] for row in rows]
    width = max(sum(a.width * 2 + pad for a in row) + pad for row in arts)
    height = sum(max(a.height * 2 for a in row) + label + pad for row in arts) + pad
    sheet = sn.Canvas(width, height)
    sheet.fill(0, 0, width, height, FORECOURT)
    y = pad
    for keys, row in zip(rows, arts):
        tall = max(a.height * 2 for a in row)
        x = pad
        for key, art in zip(keys, row):
            big = art.resize((art.width * 2, art.height * 2), Image.NEAREST)
            sheet.paste(big, x, y + tall - big.height)
            sn.text_c(sheet, key.upper(), x + big.width / 2, y + tall + 6, "plum", 2)
            x += big.width + pad
        y += tall + label + pad
    return sheet.img


def build():
    os.makedirs(OUT, exist_ok=True)
    band = backdrop().img
    walk_screen(band).save(f"{OUT}/kensington-walk.png")
    props_sheet().save(f"{OUT}/kensington-props.png")
    print("built kensington-walk.png, kensington-props.png")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
