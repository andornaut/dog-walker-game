#!/usr/bin/env python3
"""Mock: the Distillery District as a Toronto zone, on the tall band's camera.

Draws in Endesga 32 from the exported art and new drawings here:
- distillery-walk.png (360x560): the top bar; a 174-row skyline band on rows 40 to 213 (the
  Gooderham and Worts warehouses in red brick and limestone, the chimney stack, the painted
  sign, an iron catwalk, a festoon of lights, the CN Tower and the glass condos behind, a flat
  sky above band row 61); the cobbled lane and its verges in the game's projection (horizon
  -36, focal 720, feet on 464, far edge on 214 at scale 0.5); the walker and pack, obstacles,
  pickups; the new roadside props on both verges at their depth; the doghouse row.
- distillery-props.png: the new roadside props at full size, shown 2x on the plaza's tan,
  labelled.

The lane is grey granite setts, the lane lines runs of pale granite, the curb a flush granite
strip, then a red brick walk to across 190 (narrower than Elm Avenue's 208), a granite edge, and a tan flagstone plaza where
the props stand. Props are front elevations on roadside.py's 1.75 design grid, drawn straight
at their projected scale (a mock shortcut: no depth steps).

Usage:
  mock_toronto_distillery.py build   write public/art/mocks/toronto/distillery-*.png

Run from the repository root. Mock tooling only: nothing here is game art.
"""

import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import backdrops as bd  # noqa: E402
import fonts  # noqa: E402
import mock_toronto as mt  # noqa: E402
import scene as sn  # noqa: E402
from minis import Mini  # noqa: E402
from pixel import DARKER, K, edged  # noqa: E402

OUT = "public/art/mocks/toronto"
W, H = 360, 560
BAR, BAND_H = 40, 174           # the band: screen rows 40 to 213
FAR_Y, FOOT_Y, FOCAL = 214, 464, 720
HORIZON = FOOT_Y - 2 * (FOOT_Y - FAR_Y)   # -36: scale 0.5 on the far edge
APPROACH = 155                  # band row where the projected lane takes over (screen 195)
CALM = 61                       # sky rows above this stay one flat colour
BASE = 131                      # the far side's ground row
DOG_BAND_Y = 466
SCALE = 1.75
WALK_TO = 190                   # the brick walk ends; a granite edge, then the plaza
INNER = 196                     # every prop's inner edge, across
DOGS = ("koda", "biscuit", "duchess")
fonts.SIGN.setdefault("&", [".##..", "#..#.", ".##.#", "#..#.", ".##.#"])


def dk(c):
    return DARKER[K.get(c, c)]


def use_camera():
    mt.W, mt.H, mt.OX, mt.TOP = W, H, 0, 0
    mt.YH, mt.F, mt.KS = HORIZON, FOCAL, FOOT_Y - HORIZON


# ---------- the ground: cobbled lane, granite curb, brick walk, flagstone plaza ----------

def ground(a, rx, z):
    """The ground colour at across a (absolute), signed road x rx and distance z."""
    n = mt.noise
    if a < 160:
        u = rx + 160
        if any(abs(u - d) < 1.5 for d in (64, 128, 192, 256)):
            return "grey" if z % 26 < 2 else "lgrey"
        course = math.floor(z / 9)
        off = (course % 2) * 7 + math.floor(n(course, 7) * 5)
        stone = math.floor((u + off) / 13)
        if (u + off) % 13 < 1 or z % 9 < 1.4:
            return "slate"
        if n(stone, course) < 0.05 and (u + off) % 13 < 4 and z % 9 < 3.5:
            return "lgrey"
        return "grey"
    if a < 166:
        return "grey" if z % 30 < 2 else "lgrey"
    if a < WALK_TO:
        row = math.floor((a - 166) / 6)
        if (a - 166) % 6 < 1 or (z + 6 * (row % 2)) % 12 < 1.4:
            return "dbrown"
        return "brown" if n(row, math.floor((z + 6 * (row % 2)) / 12)) < 0.2 else "rust"
    if a < WALK_TO + 4:
        return "lgrey"
    col = math.floor((a - WALK_TO - 4) / 26)
    slab = math.floor((z + 11 * (col % 2)) / 30)
    if (a - WALK_TO - 4) % 26 < 1 or (z + 11 * (col % 2)) % 30 < 1.4:
        return "brown"
    return "cream" if n(col * 7 + (rx < 0), slab) < 0.08 else "tan"


def road(sc):
    px = sc.img.load()
    for y in range(BAR + APPROACH, DOG_BAND_Y):
        z, s = mt.distance_at(y)
        for x in range(W):
            rx = (x + 0.5 - 180) / s
            px[x, y] = sn.rgb(ground(abs(rx), rx, z))


# ---------- the skyline band ----------

def wall_bricks(cv, x0, x1, top, base, wall="rust", mortar="dbrown"):
    """A brick wall: wall, its right 3 columns a ramp step darker, sparse mortar dashes."""
    cv.fill(x0, top, x1 - x0, base - top, wall)
    for k, y in enumerate(range(top + 3, base, 4)):
        for x in range(x0 + 1, x1 - 3):
            if (x // 3 + k) % 4 == 0:
                cv.fill(x, y, 2, 1, mortar)
    cv.fill(x1 - 3, top, 3, base - top, dk(wall))


def arch_window(cv, x, y, w=5, h=8, glass="navy", frame="cream", glint="sky"):
    cv.fill(x, y + 1, w, h - 1, glass)
    cv.fill(x + 1, y, w - 2, 1, glass)
    cv.fill(x - 1, y + h, w + 2, 1, frame)
    cv.fill(x + 1, y + 2, 1, 2, glint)
    cv.fill(x + w // 2, y + 1, 1, h - 1, dk(frame) if frame != "cream" else "tan")


def gable_roof(cv, x0, x1, top, eave, col="dslate", edge="slate"):
    """A gable end facing the camera: a triangle from x0..x1 at row eave up to top."""
    mid, half = (x0 + x1) / 2, (x1 - x0) / 2
    for y in range(top, eave + 1):
        r = half * (y - top) / (eave - top)
        cv.fill(round(mid - r), y, max(1, round(2 * r)), 1, col)
        cv.fill(round(mid - r), y, 1, 1, edge)
    cv.fill(x0 - 1, eave, x1 - x0 + 2, 2, edge)


def hip_roof(cv, x0, x1, top, eave, col="dslate", edge="slate"):
    """A pitched roof seen along its ridge: a trapezoid, the ridge line light."""
    for y in range(top, eave + 1):
        inset = round((eave - y) * 1.2)
        cv.fill(x0 + inset, y, x1 - x0 - 2 * inset, 1, col)
    cv.fill(x0 + round((eave - top) * 1.2), top, x1 - x0 - 2 * round((eave - top) * 1.2), 1, edge)
    cv.fill(x0 - 1, eave, x1 - x0 + 2, 2, edge)


def festoon(cv, x0, x1, y, sag, bulbs=("yellow", "amber", "white", "red")):
    """A string of lights sagging between two points on row y."""
    pts = []
    for x in range(x0, x1 + 1):
        t = (x - x0) / max(1, x1 - x0)
        yy = round(y + sag * 4 * t * (1 - t))
        cv.fill(x, yy, 1, 1, "ink")
        pts.append((x, yy))
    for i, (x, yy) in enumerate(pts[2::5]):
        cv.fill(x, yy + 1, 1, 2, bulbs[i % len(bulbs)])


def cn_tower(cv, cx):
    cv.fill(cx, 63, 1, 10, "lgrey")                 # the antenna
    cv.fill(cx, 63, 1, 1, "red")
    cv.fill(cx - 1, 70, 3, 6, "lgrey")              # the SkyPod
    cv.fill(cx - 2, 74, 5, 2, "grey")
    cv.fill(cx - 1, 76, 3, 14, "lgrey")
    cv.fill(cx + 1, 76, 1, 14, "grey")
    cv.fill(cx - 5, 89, 11, 2, "lgrey")             # the main pod
    cv.fill(cx - 6, 91, 13, 3, "white")
    cv.fill(cx - 6, 92, 13, 1, "navy")
    cv.fill(cx - 5, 94, 11, 2, "grey")
    for y in range(96, BASE):
        w = 3 + (y - 96) // 9
        cv.fill(cx - w // 2, y, w, 1, "lgrey")
        cv.fill(cx - w // 2 + w - 1, y, 1, 1, "grey")


def condo(cv, x, w, top, glass="cyan"):
    cv.fill(x, top, w, BASE - top, "lgrey")
    cv.fill(x + w - 3, top, 3, BASE - top, "grey")
    for y in range(top + 2, BASE, 4):
        cv.fill(x + 1, y, w - 5, 2, glass)
    cv.fill(x - 1, top - 2, w + 2, 2, "grey")


def band():
    cv = sn.Canvas(W, BAND_H)
    # sky: flat cyan to CALM, sky below, two low clouds
    cv.fill(0, 0, W, BASE, "sky")
    cv.fill(0, 0, W, CALM, "cyan")
    for i in range(0, W, 5):
        cv.fill(i, CALM + (i // 5) % 2, 5, 1, "cyan")
    bd.cloud(cv, 112, 80, 34, 5, 1)
    bd.cloud(cv, 300, 74, 26, 4, 2)
    # behind: the CN Tower to the west, the Distillery's glass condos to the east
    cn_tower(cv, 34)
    condo(cv, 300, 22, 66)
    condo(cv, 326, 16, 82, "sky")
    condo(cv, 214, 18, 76)
    # A: a brick warehouse, gable end on, with a round window
    wall_bricks(cv, 0, 66, 98, BASE)
    gable_roof(cv, -4, 70, 80, 98, col="rust", edge="dbrown")
    for y in range(84, 99):
        r = 35 * (y - 80) / 18
        cv.fill(round(33 - r) + 2, y, max(0, round(2 * r) - 4), 1, "rust")
    cv.fill(29, 88, 8, 7, "cream")
    cv.fill(30, 89, 6, 5, "navy")
    cv.fill(33, 89, 1, 5, "cream")
    cv.fill(30, 91, 6, 1, "cream")
    for x in (6, 18, 42, 54):
        arch_window(cv, x, 103)
    # the café on A's ground floor: an awning and its board
    cv.fill(2, 117, 60, 4, "cream")
    for x in range(2, 62, 6):
        cv.fill(x, 117, 3, 4, "dred")
    for x in range(2, 62, 3):
        cv.fill(x, 121, 2, 1, "dred" if (x // 3) % 2 == 0 else "cream")
    cv.fill(8, 123, 18, 8, "navy")
    cv.fill(9, 124, 7, 7, "cyan")
    cv.fill(36, 123, 10, 8, "forest")
    cv.fill(44, 126, 1, 2, "amber")
    # the chimney stack
    for y in range(64, BASE):
        w = 8 + (y - 64) // 22
        cv.fill(79 - w // 2, y, w, 1, "rust")
        cv.fill(79 - w // 2 + w - 2, y, 2, 1, "dbrown")
    for y in (64, 70):
        cv.fill(74, y, 11, 2, "dbrown")
    cv.fill(73, 64, 13, 1, "plum")
    for k, y in enumerate(range(74, BASE, 4)):
        cv.fill(76 + (k % 2) * 3, y, 2, 1, "dbrown")
    # B: the long warehouse with the painted sign
    hip_roof(cv, 92, 266, 76, 84)
    for x in (128, 228):
        cv.fill(x, 70, 6, 8, "rust")
        cv.fill(x - 1, 69, 8, 2, "dbrown")
    wall_bricks(cv, 94, 264, 85, BASE)
    bd.word(cv, "GOODERHAM & WORTS", 179, 88, "cream")
    for y in (100, 113):
        for x in range(100, 258, 12):
            arch_window(cv, x, y, w=6, h=9)
    # ground floor: a big arched door, a gallery window, a shop window
    cv.fill(170, 119, 18, 12, "dbrown")
    cv.fill(172, 117, 14, 2, "dbrown")
    cv.fill(178, 119, 1, 12, "plum")
    cv.fill(169, 116, 20, 1, "cream")
    cv.fill(110, 120, 30, 11, "cyan")
    cv.fill(110, 120, 30, 1, "cream")
    cv.fill(125, 120, 1, 11, "cream")
    for x, c in ((114, "red"), (118, "yellow"), (130, "blue")):
        cv.fill(x, 124, 3, 4, c)
    cv.fill(214, 120, 28, 11, "navy")
    cv.fill(216, 122, 10, 6, "amber")
    cv.fill(228, 122, 12, 6, "cyan")
    # the iron catwalk over the gap between B and C, the condos showing through
    cv.fill(264, 104, 18, 1, "ink")
    cv.fill(264, 110, 18, 1, "ink")
    for x in range(264, 282, 6):
        cv.line(x, 105, x + 5, 109, "navy")
        cv.line(x + 5, 105, x, 109, "navy")
    cv.fill(264, 111, 18, 1, "dslate")
    # C: the limestone stone distillery with its cupola
    cv.fill(282, 86, 78, BASE - 86, "lgrey")
    for k, y in enumerate(range(89, BASE, 5)):
        cv.fill(282, y, 78, 1, "grey")
        for x in range(282 + (k % 2) * 6, 360, 12):
            cv.fill(x, y - 4, 1, 4, "grey")
    hip_roof(cv, 280, 362, 78, 86)
    cv.fill(316, 66, 10, 12, "white")
    cv.fill(324, 66, 2, 12, "lgrey")
    cv.fill(318, 70, 6, 5, "navy")
    cv.fill(314, 63, 14, 3, "dslate")
    cv.fill(320, 61 + 1, 2, 1, "dslate")
    for y in (93, 108):
        for x in range(290, 356, 12):
            cv.fill(x, y, 6, 10, "navy")
            cv.fill(x + 3, y, 1, 10, "white")
            cv.fill(x, y + 4, 6, 1, "white")
            cv.fill(x + 1, y + 1, 1, 2, "sky")
            cv.fill(x - 1, y + 10, 8, 1, "white")
    cv.fill(296, 121, 22, 10, "dbrown")
    cv.fill(296, 119, 22, 2, "slate")
    bd.word(cv, "MARKET", 307, 120, "yellow")
    # the festoon of lights across the far side
    for x0, x1 in ((0, 66), (66, 168), (190, 282), (282, 360)):
        festoon(cv, x0, x1, 112, 5)
    # barrels by the doors and a Christmas tree in the square
    for x in (64, 90, 196):
        barrel_far(cv, x, BASE)
    tree_far(cv, 154, BASE)
    # far walk, flush curb, the cross lane, near walk
    flat_ground(cv, BASE, BAND_H)
    return cv.img


def barrel_far(cv, x, base):
    cv.fill(x, base - 7, 6, 7, "brown")
    cv.fill(x + 4, base - 7, 2, 7, "dbrown")
    cv.fill(x, base - 6, 6, 1, "grey")
    cv.fill(x, base - 2, 6, 1, "grey")
    cv.fill(x - 1, base - 5, 1, 3, "brown")


def tree_far(cv, cx, base):
    for k, y in enumerate(range(base - 30, base - 3)):
        r = 1 + k * 7 // 27
        cv.fill(cx - r, y, 2 * r + 1, 1, "dgreen")
        cv.fill(cx + r - 1, y, 2, 1, "forest")
    cv.fill(cx - 1, base - 3, 3, 3, "dbrown")
    cv.fill(cx, base - 32, 1, 2, "yellow")
    for i, (dx, dy) in enumerate(((-2, 8), (2, 12), (-4, 17), (3, 20), (-1, 23), (5, 25), (-6, 25))):
        cv.fill(cx + dx, base - 31 + dy, 1, 1, ("red", "yellow", "white", "amber")[i % 4])


def flat_ground(cv, top, bottom):
    """The band's flat ground from row top: brick walk, granite curb, cobbled cross lane, brick
    near walk, as flat strips (their texture spaced by column)."""
    for y in range(top, APPROACH):
        for x in range(W):
            if 139 <= y <= 140:
                c = "grey" if x % 30 == 0 else "lgrey"
            elif 141 <= y <= 149:
                off = 0 if y < 145 else 5
                c = "slate" if (x + off) % 10 == 0 or y in (141, 145) else "grey"
            else:
                off = 0 if (y - top) // 3 % 2 else 4
                c = "dbrown" if (x + off) % 8 == 0 or (y - top) % 3 == 0 else "rust"
            cv.fill(x, y, 1, 1, c)


# ---------- the roadside props, in design units ----------

def thick(g, x0, y0, x1, y1, t, c):
    n = max(1, int(max(abs(x1 - x0), abs(y1 - y0))))
    for i in range(n + 1):
        g.rect(round(x0 + (x1 - x0) * i / n - t / 2), round(y0 + (y1 - y0) * i / n - t / 2), t, t, c)


def barrels():
    """Three oak barrels stacked two and one, grey hoops."""
    w, h = 48, 40

    def one(g, cx, cy):
        g.blob(cx, cy, 10, 10, "brown", sh="dbrown", li="ochre", power=2.2)
        for x in (cx - 5, cx, cx + 5):
            g.rect(x, cy - 8, 1, 16, "dbrown")
        for y in (cy - 6, cy + 5):
            g.rect(cx - 9, y, 18, 2, "grey")
            g.rect(cx - 9, y, 18, 1, "lgrey")

    def draw(g, f=0):
        one(g, 24, 12)
        one(g, 13, 28)
        one(g, 35, 28)
        g.rect(22, 9, 4, 2, "cream")
    return w, h, draw


def patio():
    """A bistro table under a striped umbrella, two iron chairs, two cups."""
    w, h = 72, 60

    def draw(g, f=0):
        base = h - 2
        g.rect(35, 14, 2, base - 14, "dbrown")
        g.tri((6, 18), (66, 18), (36, 4), "cream")
        for i in range(6):
            x = 6 + i * 10
            g.tri((x, 18), (x + 5, 18), (36, 4), "dred")
        for i in range(6):
            g.ell(9 + i * 10, 18, 5, 2, "dred" if i % 2 == 0 else "cream")
        g.rect(34, 2, 4, 3, "dbrown")
        g.rect(22, 38, 28, 3, "cream")
        g.rect(22, 40, 28, 1, "tan")
        g.rect(34, 41, 4, base - 41, "navy")
        g.rect(30, base - 1, 12, 1, "navy")
        g.rect(26, 35, 3, 3, "white")
        g.rect(43, 35, 3, 3, "white")
        for x, d in ((6, 1), (58, -1)):
            back = x if d > 0 else x + 7
            g.rect(back, 30, 2, base - 30, "navy")
            g.rect(x, 42, 9, 2, "navy")
            g.rect(x + (7 if d > 0 else 0), 44, 2, base - 44, "navy")
            g.ell(back + 1, 31, 3, 3, "navy")
    return w, h, draw


def lamp_lights():
    """A Victorian iron lamp with a wreath, festoons of bulbs hung from its crossbar."""
    w, h = 52, 100

    def draw(g, f=0):
        base = h - 2
        cx = 26
        g.rect(cx - 2, 22, 4, base - 22, "navy")
        g.rect(cx - 2, 22, 1, base - 22, "dslate")
        g.rect(cx - 5, base - 8, 10, 8, "navy")
        g.rect(cx - 4, base - 12, 8, 4, "navy")
        g.rect(cx - 5, base - 8, 1, 8, "dslate")
        g.rect(cx - 5, 8, 10, 12, "yellow")
        g.rect(cx - 6, 8, 1, 12, "navy")
        g.rect(cx + 5, 8, 1, 12, "navy")
        g.rect(cx - 1, 8, 2, 12, "amber")
        g.tri((cx - 8, 8), (cx + 8, 8), (cx, 2), "navy")
        g.rect(cx - 6, 20, 12, 2, "navy")
        g.rect(2, 30, 48, 2, "navy")
        for x0, x1 in ((3, cx - 2), (cx + 2, 49)):
            for x in range(x0, x1):
                t = (x - x0) / (x1 - x0)
                y = 32 + round(10 * 4 * t * (1 - t))
                g.rect(x, y, 1, 1, "ink")
                if (x - x0) % 5 == 2:
                    g.rect(x, y + 1, 2, 3, ("yellow", "amber", "white", "red")[(x // 5) % 4])
        g.ell(cx, 54, 7, 7, "dgreen", sh="forest")
        g.ell(cx, 54, 3, 3, None)
        g.rect(cx - 2, 59, 4, 3, "red")
        for x, y in ((cx - 5, 50), (cx + 4, 52), (cx - 3, 57)):
            g.rect(x, y, 2, 2, "red")
    return w, h, draw


def love_lock():
    """The Love Lock: a red iron heart on a granite plinth, its lattice hung with padlocks."""
    w, h = 64, 76

    def heart(x, y, cx, cy, r):
        u, v = (x + 0.5 - cx) / r, -(y + 0.5 - cy) / r
        return (u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0

    def draw(g, f=0):
        base = h - 2
        cx, cy, r = 32, 28, 24
        k = g.s   # the heart is drawn per output pixel, so its ring and lattice stay solid
        for py in range(g.g.h):
            for px in range(g.g.w):
                x, y = (px + 0.5) / k - 0.5, (py + 0.5) / k - 0.5
                if heart(x, y, cx, cy, r):
                    if not heart(x, y, cx, cy + 1, r - 5):
                        g.g.p(px, py, "red" if heart(x + 2, y + 2, cx, cy, r) else "dred")
                    elif px % round(7 * k) == 0 or py % round(7 * k) == 0:
                        g.g.p(px, py, "dred")
        for i, (x, y) in enumerate(((22, 22), (30, 28), (38, 24), (26, 34), (34, 36), (42, 30),
                                   (18, 28), (30, 42), (38, 40), (24, 16), (40, 16), (32, 20))):
            c = ("amber", "yellow", "pink", "sky", "lgrey", "green")[i % 6]
            g.rect(x, y + 1, 4, 3, c)
            g.rect(x + 1, y, 2, 1, "grey")
        g.rect(29, 52, 6, base - 62, "dred")
        g.rect(14, base - 10, 36, 10, "lgrey")
        g.rect(14, base - 10, 36, 2, "white")
        g.rect(46, base - 10, 4, 10, "grey")
        g.rect(18, base - 6, 24, 2, "grey")
    return w, h, draw


def spider():
    """A giant steel spider sculpture standing on a granite slab."""
    w, h = 76, 92

    def X(x):
        return round(38 + (x - 50) * 0.72)

    def draw(g, f=0):
        base = h - 2
        g.rect(3, base - 4, 70, 4, "lgrey")
        g.rect(3, base - 4, 70, 1, "white")
        g.rect(3, base - 1, 70, 1, "grey")
        legs = ((44, 26, 22, 6, 8), (44, 28, 16, 14, 18), (46, 30, 26, 22, 30), (48, 30, 36, 28, 40),
                (56, 26, 78, 6, 92), (56, 28, 84, 14, 82), (54, 30, 74, 22, 70), (52, 30, 64, 28, 60))
        for bx, by, kx, ky, fx in legs:
            bx, kx, fx = X(bx), X(kx), X(fx)
            thick(g, bx, by, kx, ky, 3, "dslate")
            thick(g, kx, ky, fx, base - 4, 3, "dslate")
            thick(g, bx, by - 1, kx, ky - 1, 1, "slate")
            thick(g, kx - 1, ky, fx - 1, base - 5, 1, "slate")
            g.rect(fx - 2, base - 6, 4, 2, "navy")
        g.blob(X(56), 30, 11, 10, "dslate", sh="navy", li="slate")
        g.blob(X(42), 34, 6, 5, "dslate", sh="navy", li="slate")
        for x, y in ((X(52), 26), (X(58), 26), (X(55), 32)):
            g.rect(x, y, 2, 2, "grey")
        g.rect(X(38), 33, 2, 2, "lgrey")
    return w, h, draw


def person(g, x, base, coat, hair, legs="navy", skin="skin1", face=1, cup=None):
    """A chibi passer-by, 16 design units wide, 46 tall, side on, facing right (face 1) or left."""
    cx = x + 8
    g.rect(cx - 4, base - 12, 3, 12, legs)
    g.rect(cx + 1, base - 12, 3, 12, dk(legs))
    g.rect(cx - 5, base - 1, 5, 1, "ink")
    g.rect(cx, base - 1, 5, 1, "ink")
    g.blob(cx, base - 21, 7, 10, coat, sh=dk(coat), power=3)
    g.blob(cx, base - 35, 7, 7, skin)
    g.blob(cx - 2 * face, base - 39, 7, 4, hair, power=2.2)
    g.rect(cx - 7 if face > 0 else cx + 4, base - 39, 4, 9, hair)
    g.rect(cx + 4 * face, base - 35, 1, 2, "ink")
    g.rect(cx + 2 * face - 1, base - 26, 3, 9, dk(coat))
    if cup:
        g.rect(cx + 4 * face - 1, base - 26, 3, 4, cup)
        g.rect(cx + 4 * face - 1, base - 26, 3, 1, "dbrown")


def stroller():
    """A parent pushing a navy pram along the walk, side on."""
    w, h = 68, 52

    def draw(g, f=0):
        base = h - 2
        person(g, 2, base, "purple", "dbrown")
        g.rect(16, 26, 12, 2, "ink")
        thick(g, 26, 27, 32, 36, 2, "ink")
        g.rect(30, 30, 30, 10, "navy")
        g.rect(30, 30, 30, 2, "dslate")
        for y in range(16, 31):
            r = math.sqrt(max(0, 15 ** 2 - (31 - y) ** 2))
            g.rect(45, y, round(r), 1, "blue")
        g.rect(45, 16, 1, 15, "navy")
        g.rect(32, 40, 26, 1, "ink")
        for cx in (35, 54):
            g.ell(cx, base - 4, 4, 4, "ink")
            g.rect(cx - 1, base - 5, 2, 2, "grey")
    return w, h, draw


def chatting():
    """Two gallery-goers chatting over coffee."""
    w, h = 44, 52

    def draw(g, f=0):
        base = h - 2
        person(g, 3, base, "teal", "plum", cup="white")
        person(g, 23, base, "orange", "amber", legs="dslate", skin="skin2", face=-1, cup="white")
    return w, h, draw


def stall():
    """A Christmas Market chalet: plank walls, a red gable with a garland of lights, a vendor at
    the counter with mugs."""
    w, h = 80, 84

    def draw(g, f=0):
        base = h - 2
        g.rect(8, 30, 64, base - 30, "brown")
        for x in range(10, 70, 6):
            g.rect(x, 30, 1, base - 30, "dbrown")
        g.rect(68, 30, 4, base - 30, "dbrown")
        g.tri((2, 32), (78, 32), (40, 4), "dred")
        g.tri((10, 30), (70, 30), (40, 10), "red")
        g.rect(2, 30, 76, 3, "dred")
        for x in range(4, 76):
            y = 33 + round(3 * math.sin(x * 0.35))
            g.rect(x, y, 1, 1, "dgreen")
            g.rect(x, y + 1, 1, 1, "forest")
            if x % 5 == 0:
                g.rect(x, y + 1, 2, 2, ("yellow", "red", "white")[(x // 5) % 3])
        g.rect(16, 40, 48, 22, "plum")
        g.blob(40, 50, 6, 6, "skin2", sh="brown")
        g.tri((33, 46), (47, 46), (40, 37), "red")
        g.rect(33, 45, 14, 2, "white")
        g.blob(40, 62, 9, 6, "forest", power=3)
        g.rect(12, 60, 56, 4, "cream")
        g.rect(12, 63, 56, 1, "tan")
        for x in (20, 26, 52, 58):
            g.rect(x, 56, 4, 4, "red" if x < 40 else "white")
            g.rect(x + 4, 57, 1, 2, "red" if x < 40 else "white")
        g.ell(40, 22, 5, 5, "dgreen", sh="forest")
        g.ell(40, 22, 2, 2, "red")
    return w, h, draw


PROPS = {
    "barrels": barrels(),
    "patio": patio(),
    "lamp-lights": lamp_lights(),
    "love-lock": love_lock(),
    "spider": spider(),
    "stroller": stroller(),
    "chatting": chatting(),
    "market-stall": stall(),
}
LABELS = {
    "barrels": "BARRELS", "patio": "CAFE TABLE", "lamp-lights": "IRON LAMP",
    "love-lock": "LOVE LOCK", "spider": "STEEL SPIDER", "stroller": "PRAM",
    "chatting": "GALLERY-GOERS", "market-stall": "MARKET CHALET",
}
SHADOWED = {"barrels", "lamp-lights", "stroller", "chatting", "patio"}


def prop(key, s=1.0):
    """The prop at scale s (1 is full size), outlined, as an RGBA image."""
    w, h, draw = PROPS[key]
    g = edged(Mini(SCALE * s, w, h))
    draw(g)
    rows = g.outlined()
    img = Image.new("RGBA", (len(rows[0]), len(rows)), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c:
                img.putpixel((x, y), sn.rgb(c) + (255,))
    return img


# ---------- the walk screen ----------

# (key, side, distance ahead): left -1, right 1. Big props stand nearer, so they show whole
# below the band.
PLACED = [
    ("lamp-lights", -1, 700), ("chatting", 1, 690), ("lamp-lights", 1, 620), ("barrels", -1, 610),
    ("market-stall", 1, 520), ("spider", -1, 420), ("love-lock", 1, 410), ("patio", -1, 330),
    ("stroller", 1, 330), ("lamp-lights", 1, 270), ("barrels", -1, 250),
    ("barrels", 1, 210), ("chatting", -1, 200), ("patio", 1, 150), ("lamp-lights", -1, 150),
]
# Road objects: (key, tag, lane or (lane, lane), distance ahead).
OBJECTS = [("tip", "idle", 1, 700), ("cafe-patio", "idle", (3, 4), 600), ("treat", "idle", 2, 520),
           ("minor-sandwich-board", "idle", 0, 430), ("bin", "idle", 4, 330), ("tip", "idle", 3, 230)]


def shadow(sc, cx, foot, w, col="brown"):
    rx = max(3, w / 2 - 2)
    for y in range(-2, 3):
        for x in range(int(-rx - 1), int(rx + 2)):
            dx, dy = (x + 0.5) / rx, (y + 0.5) / 2
            if dx * dx + dy * dy <= 1:
                sc.fill(int(cx + x), int(foot - 1 + y), 1, 1, col)


def bottom_panel():
    panel = mt.Scene(W, H - DOG_BAND_Y)
    band_img = sn.image("ui-dog-band")
    panel.img.paste(band_img, (0, 0), band_img)
    for i, d in enumerate(DOGS):
        panel.doghouse(i * 120, 470 - DOG_BAND_Y, d, mt.dog(d)[3])
    return panel.img


def walk():
    use_camera()
    sc = mt.Scene(W, H)
    sc.shade, sc.leash_col = "slate", "plum"
    road(sc)
    items = []
    for key, side, d in PLACED:
        items.append((d, ("prop", key, side, INNER)))
    for key, tag, ln, d in OBJECTS:
        x = sum(mt.lane(n) for n in ln) / len(ln) if isinstance(ln, tuple) else mt.lane(ln)
        items.append((d, ("object", key, tag, x)))
    items.append((max(d for _, d in mt.FORMATIONS[3]) + 1, ("pack",)))
    for d, item in sorted(items, key=lambda it: -it[0]):
        if item[0] == "prop":
            _, key, side, inner = item
            s = FOCAL / (FOCAL + d)
            img = prop(key, s)
            cx = 180 + side * (inner * s + img.width / 2)
            foot = round(HORIZON + (FOOT_Y - HORIZON) * s)
            if key in SHADOWED:
                shadow(sc, round(cx), foot, img.width)
            sc.img.paste(img, (round(cx - img.width / 2), foot - img.height + 1), img)
        elif item[0] == "object":
            _, key, tag, x = item
            sc.stand(key, tag, x, d)
        else:
            sc.pack(mt.lane(2), tuple(f"dog-{d}" for d in DOGS))
    sky = band()
    sc.img.paste(sky.crop((0, 0, W, APPROACH)), (0, BAR))
    zone = dict(sn.ZONES["shops"], name="Distillery")
    sn.ZONES["distillery"] = zone
    sc.top_bar(["distillery"], 48, 1, 0.4)
    b = mt.TOP_BAR["buttons"]["sound"]
    sc.paste(sn.frame("ui-icon-button", "normal"), b["face"]["x"], b["face"]["y"])
    sc.paste(sn.frame("icon-sound", "on"), b["icon"]["x"], b["icon"]["y"])
    sc.img.paste(bottom_panel(), (0, DOG_BAND_Y))
    return sc.img


def sheet():
    imgs = {k: prop(k) for k in PROPS}
    gap, cols = 10, 4
    keys = list(PROPS)
    rows = [keys[i:i + cols] for i in range(0, len(keys), cols)]
    widths = [sum(imgs[k].width for k in r) + gap * (len(r) + 1) for r in rows]
    heights = [max(imgs[k].height for k in r) + 16 for r in rows]
    cv = sn.Canvas(max(widths), sum(heights) + gap * (len(rows) + 1))
    cv.fill(0, 0, cv.img.width, cv.img.height, "tan")
    y = gap
    for r, hh in zip(rows, heights):
        x = gap
        for k in r:
            img = imgs[k]
            foot = y + hh - 16
            if k in SHADOWED:
                shadow(cv, x + img.width // 2, foot, img.width)
            cv.img.paste(img, (x, foot - img.height + 1), img)
            sn.text_c(cv, LABELS[k], x + img.width / 2, foot + 5, "plum")
            x += img.width + gap
        y += hh + gap
    return cv.img.resize((cv.img.width * 2, cv.img.height * 2), Image.NEAREST)


def build():
    os.makedirs(OUT, exist_ok=True)
    walk().save(f"{OUT}/distillery-walk.png")
    sheet().save(f"{OUT}/distillery-props.png")
    print("built", f"{OUT}/distillery-walk.png", f"{OUT}/distillery-props.png")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
