#!/usr/bin/env python3
"""Mock: Cabbagetown, Toronto, as the first world's easiest zone: a calm Victorian residential walk.

Draws, in Endesga 32, on the tall-band camera (backdrop rows 40 to 213, farY 214, focal 720,
feet on row 464):

- cabbagetown-walk.png, a 360x560 walk screen: the top bar, a new 360x174 skyline band, the
  road and its verges in the game's projection, roadside props at their depth on both verges,
  the walker and a pack of three, a few obstacles and pickups, and the doghouse row.
- cabbagetown-props.png: the new roadside props at 2x on the lawn, labelled.

The band: at the end of the street, across the cross street, the Necropolis chapel (yellow
brick, a square tower and spire, lancet windows) behind its iron fence, and Riverdale Farm's red
barn with goats and hens; bay-and-gable rowhouses either side. Behind them Wellesley Park's
treetops, a second row of roofs and, far off, the downtown towers and the CN Tower. The sky is
flat cyan above row 61, under the message strip.

New props (design grid at 1.75x, road_edge outlines, as roadside.py): four bay-and-gable
rowhouses, never flipped, two with the door on the right for the left verge (red brick with a
cat in the window, buff brick) and two with it on the left for the right verge (red brick with
a neighbour on the stoop, painted cream), a tall maple and an autumn maple, a picket front
garden of cabbages and ornamental kale, a raised garden plot with a sunflower, and a paddock with
a goat behind the rails and a hen on a post. The hedge comes from the build. The sidewalk ends at
across 184, narrower than Elm Avenue's 208, so the porches show.

Usage:
  mock_toronto_cabbagetown.py build    write public/art/mocks/toronto/cabbagetown-*.png

Run from the repository root. Mock tooling only: nothing here is game art.
"""

import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import mock_toronto as mt  # noqa: E402
import scene as sn  # noqa: E402

# The tall band's camera, ahead of the game's export: the band on rows 40 to 213, the approach
# from band row 155, the road's far edge on row 214 at scale 0.5, feet on row 464.
sn.LAYOUT["regions"]["backdrop"].update(y=40, height=174)
sn.LAYOUT["regions"]["approach"]["y"] = 195
sn.LAYOUT["camera"].update(horizonY=-36, farY=214)

import backdrops as bd  # noqa: E402
from minis import STEPS, Mini  # noqa: E402
from pixel import DARKER, K, edged  # noqa: E402

OUT = "public/art/mocks/toronto"
W, H = 360, 560
ZONE = "street"
BAND_Y, BAND_H = 40, 174
YH, F, FOOT = -36, 720, 464
DOG_BAND_Y = 466
SCALE = 1.75

mt.W, mt.H, mt.OX, mt.TOP = W, H, 0, 0
mt.YH, mt.F, mt.KS = YH, F, FOOT - YH
sn.ZONES[ZONE]["name"] = "Cabbagetown"
# Cabbagetown's narrow sidewalks: the walk ends at across 184, not Elm Avenue's 208, so the
# front gardens and porches start nearer the road.
WALK = 184
mt.VERGES[ZONE]["walkTo"] = WALK
bd.WALK, bd.PERCH_X = WALK, (-(WALK + 8), -600)


def dk(c):
    return DARKER[K.get(c, c)]


# ---------- the skyline band ----------

def rowhouse_far(cv, x, brick, door, bay_left=True, roof="dslate"):
    """A small bay-and-gable house on the far side, 22 wide, standing on BASE: a two-storey bay
    under a steep front gable with white bargeboard and a finial, the door beside it under a
    white porch roof, a stoop."""
    base = bd.BASE
    top = base - 28
    cv.fill(x, top, 22, 28, brick)
    bx, dx = (x, x + 12) if bay_left else (x + 10, x)
    # the door side's roof, then the gable over the bay
    cv.fill(dx, top - 4, 10, 4, roof)
    for i in range(16):
        half = round(i * 7 / 15)
        cv.fill(bx + 6 - half, top - 16 + i, half * 2, 1, roof)
        if i > 2:
            inner = max(0, half - 1)
            cv.fill(bx + 6 - inner, top - 16 + i, inner * 2, 1, "white")
        if i > 4:
            inner = max(0, half - 2)
            cv.fill(bx + 6 - inner, top - 16 + i, inner * 2, 1, brick)
    cv.fill(bx + 5, top - 18, 2, 3, "white")
    cv.fill(bx + 5, top - 8, 2, 3, "plum")
    cv.fill(bx + 5, top - 7, 1, 1, "cyan")
    # the bay: lit front, shaded far facet, a window per storey
    cv.fill(bx + 1, top, 10, 28, brick)
    cv.fill(bx + 9 if bay_left else bx + 1, top, 2, 28, dk(brick))
    for wy in (top + 4, top + 15):
        cv.fill(bx + 3, wy, 6, 7, "plum")
        cv.fill(bx + 4, wy + 1, 4, 5, "cyan")
        cv.fill(bx + 6, wy + 1, 1, 5, "white")
        cv.fill(bx + 3, wy - 1, 6, 1, "cream")
    # the door side: an upper window, the porch roof, the door with its transom
    cv.fill(dx + 3, top + 4, 4, 6, "plum")
    cv.fill(dx + 4, top + 5, 2, 4, "cyan")
    cv.fill(dx, top + 14, 10, 1, "white")
    cv.fill(dx + 3, top + 16, 4, 1, "yellow")
    cv.fill(dx + 3, top + 17, 4, 9, door)
    cv.fill(dx + 5, top + 21, 1, 1, "amber")
    cv.fill(dx if bay_left else dx + 9, top + 15, 1, 13, "white")
    cv.fill(dx + 2, base - 2, 6, 2, "lgrey")
    # a chimney on the party wall
    cx = x + 21 if bay_left else x - 1
    cv.fill(cx - 1, top - 9, 3, 6, "brown")
    cv.fill(cx - 2, top - 10, 5, 1, "dbrown")


def chapel(cv, x):
    """The Necropolis chapel at x: yellow brick, its gable end facing the street, three lancet
    windows and a rose window, a pointed door, and the square tower with its spire on the east."""
    base, top = bd.BASE, bd.BASE - 22
    wall, shade, roof = "cream", "tan", "dslate"
    w = 30
    cv.fill(x, top, w, 22, wall)
    cv.fill(x + w - 2, top, 2, 22, shade)
    for i in range(22):
        half = round(i * (w / 2 + 2) / 21)
        cv.fill(x + w // 2 - half, top - 22 + i, half * 2, 1, roof)
        inner = max(0, half - 2)
        if i > 3:
            cv.fill(x + w // 2 - inner, top - 22 + i, inner * 2, 1, wall)
    cv.fill(x + w // 2 - 1, top - 25, 2, 4, roof)
    # rose window and lancets
    for dy in range(-2, 3):
        for dx_ in range(-2, 3):
            if dx_ * dx_ + dy * dy <= 5:
                cv.fill(x + w // 2 - 1 + dx_, top - 8 + dy, 1, 1, "plum" if dx_ * dx_ + dy * dy > 1 else "purple")
    for lx in (x + 5, x + w - 8):
        cv.fill(lx, top + 5, 3, 9, "plum")
        cv.fill(lx + 1, top + 4, 1, 1, "plum")
        cv.fill(lx + 1, top + 6, 1, 7, "cyan")
    # the pointed stone entrance
    cx = x + w // 2 - 3
    cv.fill(cx - 1, top + 6, 8, 16, "lgrey")
    cv.fill(cx, top + 9, 6, 13, "dbrown")
    cv.fill(cx + 1, top + 8, 4, 1, "dbrown")
    cv.fill(cx + 2, top + 7, 2, 1, "dbrown")
    # the tower on the east side and its spire, its tip below the calm sky
    tx = x + w + 1
    cv.fill(tx, top - 20, 11, 42, wall)
    cv.fill(tx + 9, top - 20, 2, 42, shade)
    cv.fill(tx - 1, top - 21, 13, 2, "tan")
    for by in (top - 16, top - 4):
        cv.fill(tx + 3, by, 2, 6, "plum")
        cv.fill(tx + 6, by, 2, 6, "plum")
    for i in range(24):
        half = max(0, round((23 - i) * 6 / 23))
        cv.fill(tx + 5 - half, top - 21 - i, half * 2 + 1, 1, roof)
    cv.fill(tx + 5, top - 21 - 26, 1, 3, "slate")
    cv.fill(tx + 4, top - 21 - 25, 3, 1, "slate")
    for px in (tx - 1, tx + 11):
        cv.fill(px, top - 26, 1, 5, roof)


def gravestones(cv, spots):
    for x, h in spots:
        cv.fill(x, bd.BASE - h, 4, h, "lgrey")
        cv.fill(x + 1, bd.BASE - h - 1, 2, 1, "lgrey")
        cv.fill(x + 3, bd.BASE - h, 1, h, "grey")


def iron_fence(cv, x0, x1, y):
    """Wrought iron railings, their spikes on row y - 6."""
    cv.fill(x0, y - 5, x1 - x0, 1, "navy")
    cv.fill(x0, y - 1, x1 - x0, 1, "navy")
    for x in range(x0, x1, 2):
        cv.fill(x, y - 6, 1, 6, "navy")


def barn(cv, x):
    """Riverdale Farm's red barn: a gambrel roof, white trim, a hay door and big X doors."""
    base, top, w = bd.BASE, bd.BASE - 22, 40
    cv.fill(x, top, w, 22, "red")
    cv.fill(x + w - 3, top, 3, 22, "dred")
    for i in range(18):
        if i < 8:
            half = 8 + round(i * 1.4)
        else:
            half = 19 + round((i - 8) * 0.3)
        cv.fill(x + w // 2 - half, top - 18 + i, half * 2, 1, "slate" if i % 4 else "dslate")
    cv.fill(x - 1, top - 1, w + 2, 1, "white")
    cv.fill(x + 15, top - 12, 10, 8, "white")
    cv.fill(x + 16, top - 11, 8, 6, "dred")
    cv.fill(x + 12, top + 6, 16, 16, "white")
    cv.fill(x + 13, top + 7, 14, 15, "dred")
    for i in range(14):
        cv.fill(x + 13 + i, top + 7 + i, 1, 1, "white")
        cv.fill(x + 26 - i, top + 7 + i, 1, 1, "white")
    cv.fill(x + 20, top + 7, 1, 15, "white")
    for wx in (x + 4, x + w - 9):
        cv.fill(wx, top + 6, 5, 5, "white")
        cv.fill(wx + 1, top + 7, 3, 3, "plum")


def goat_far(cv, x, y, col="white", spot="tan"):
    """A goat side on, its feet on row y."""
    cv.fill(x, y - 5, 6, 3, col)
    cv.fill(x + 5, y - 7, 2, 3, col)
    cv.fill(x + 6, y - 8, 1, 1, "grey")
    cv.fill(x + 2, y - 5, 2, 1, spot)
    for lx in (x, x + 4):
        cv.fill(lx, y - 2, 1, 2, col)


def hen_far(cv, x, y):
    cv.fill(x, y - 3, 3, 2, "white")
    cv.fill(x + 2, y - 4, 1, 1, "red")
    cv.fill(x + 1, y - 1, 1, 1, "amber")


def cn_tower(cv, x):
    """The CN Tower far off, its antenna stopping below the calm sky."""
    base = bd.BASE - 20
    cv.fill(x - 1, 72, 3, base - 72, "lgrey")
    cv.fill(x + 1, 72, 1, base - 72, "grey")
    cv.fill(x, 63, 1, 9, "lgrey")
    cv.fill(x - 4, 84, 9, 3, "lgrey")
    cv.fill(x - 3, 87, 7, 1, "grey")
    cv.fill(x - 3, 83, 7, 1, "lgrey")
    cv.fill(x - 2, 75, 5, 2, "lgrey")


def downtown(cv, towers):
    """Far office towers: (x, w, top) in lgrey on grey shade with faint window rows."""
    for x, w, top in towers:
        cv.fill(x, top, w, bd.BASE - top, "lgrey")
        cv.fill(x + w - 2, top, 2, bd.BASE - top, "grey")
        for wy in range(top + 3, bd.BASE - 20, 4):
            cv.fill(x + 2, wy, w - 5, 1, "grey")


def road_paint(x, z, span, px, py):
    """Elm Avenue's road, as backdrops.woof_way paints it."""
    if abs(x) >= bd.ROAD - 3:
        return "grey"
    return "slate" if bd.hashed(px, py, 29) else "navy" if bd.hashed(px, py + 3, 31) else "dslate"


FAR_LEFT = (("rust", "sky", True), ("rust", "yellow", False), ("tan", "dgreen", True), ("rust", "purple", False))
FAR_RIGHT = (("rust", "red", True), ("cream", "blue", False), ("rust", "dgreen", True), ("tan", "mauve", False))


def skyline():
    cv = sn.Canvas(bd.W, bd.H)
    base = bd.BASE
    bd.sky(cv, clouds=((150, 82, 30, 5), (230, 74, 18, 3), (300, 86, 44, 7)))
    # far off: the downtown towers and the CN Tower over the west end
    downtown(cv, ((6, 10, 80), (18, 8, 86), (52, 9, 84), (62, 12, 74), (76, 8, 82), (86, 7, 90)))
    cn_tower(cv, 40)
    # a second row of roofs, then Wellesley Park's treetops behind the far side
    bd.roofline(cv, base - 26, ((0, 22, 8), (26, 20, 9), (96, 24, 8), (262, 22, 9), (290, 20, 8),
                                 (318, 24, 9), (346, 18, 8)), "slate", "cream")
    cv.fill(100, base - 30, 170, 30, "dgreen")
    bd.treeline(cv, base - 30, ("dgreen", "green"), 2.3, 3, 11)
    for x, y in ((128, base - 38), (214, base - 39), (252, base - 36)):
        bd.tree(cv, x, y, "orange", "rust", r=8, base=base - 20, girth=3)
    # the end of the street: the Necropolis chapel behind its railings, Riverdale Farm's barn
    chapel(cv, 130)
    gravestones(cv, ((114, 6), (121, 5), (174, 5), (182, 6)))
    barn(cv, 206)
    bd.tree(cv, 194, base - 32, "green", "dgreen", r=11, base=base, girth=4)
    bd.tree(cv, 112, base - 36, "amber", "orange", r=12, base=base, girth=4)
    bd.tree(cv, 262, base - 34, "green", "dgreen", r=12, base=base, girth=4)
    # rowhouses either side
    for i, (brick, door, bay_left) in enumerate(FAR_LEFT):
        rowhouse_far(cv, 2 + i * 23, brick, door, bay_left)
    for i, (brick, door, bay_left) in enumerate(FAR_RIGHT):
        rowhouse_far(cv, 268 + i * 23, brick, door, bay_left)
    bd.yard(cv, base, bd.FAR_WALK, bd.grass())
    # front gardens, the farm's paddock and the cemetery's railings along the far sidewalk
    for x0, x1 in ((0, 94), (266, 360)):
        bd.fence(cv, bd.FAR_WALK - 4, x0, x1, h=6)
    bd.flowers(cv, 14, 26, bd.FAR_WALK - 4)
    bd.flowers(cv, 300, 312, bd.FAR_WALK - 4, ("pink", "white", "mauve"))
    iron_fence(cv, 104, 196, bd.FAR_WALK)
    cv.fill(141, bd.FAR_WALK - 8, 2, 8, "navy")
    cv.fill(157, bd.FAR_WALK - 8, 2, 8, "navy")
    for x in range(200, 262, 10):
        cv.fill(x, bd.FAR_WALK - 7, 2, 7, "dbrown")
    cv.fill(198, bd.FAR_WALK - 6, 64, 1, "brown")
    cv.fill(198, bd.FAR_WALK - 3, 64, 1, "brown")
    goat_far(cv, 214, base + 1)
    goat_far(cv, 238, base, "lgrey", "dbrown")
    hen_far(cv, 228, bd.FAR_WALK - 6)
    hen_far(cv, 250, base + 2)
    # a cat on a porch rail
    bd.fence_cat(cv, 72, base - 13, "orange", "amber")
    bd.cross(cv, bd.flat(road_paint), "grey", bd.slabs)
    bd.cross_line(cv, "lgrey")
    bd.street(cv, bd.verge(road_paint))
    bd.lanes(cv, "lgrey")
    bd.ffence(cv, *bd.PERCH_X, bd.PERCH)
    return cv.img


# ---------- the roadside props: front elevations on the design grid ----------

def window(g, x, y, w, h, sill="cream"):
    g.rect(x, y, w, h, "plum")
    g.rect(x + 2, y + 2, w - 4, h - 4, "cyan")
    g.rect(x + 2, y + 2, 2, 3, "white")
    g.rect(x + w // 2 - 1, y + 2, 2, h - 4, "plum")
    g.rect(x - 2, y + h, w + 4, 2, sill)
    g.rect(x - 1, y - 3, w + 2, 3, sill)


def half_house(g, x0, mirror, brick, door_c, trim="cream", extra=None):
    """One half of a semi-detached bay-and-gable pair, 56 wide from x0: the bay on its outer side
    under a steep front gable trimmed with white bargeboard and a finial, the door on the party
    wall side under a white porch, a transom of stained glass over the door."""
    base, eaves = 122, 50

    def X(u, w=0):
        return x0 + u if not mirror else x0 + 56 - u - w

    roof = "dslate"
    # the door side's roof, the walls
    g.rect(X(28, 28), 40, 28, 10, roof)
    g.rect(X(28, 28), 40, 28, 2, "slate")
    g.rect(X(0, 56), eaves, 56, base - eaves, brick)
    # the gable over the bay: roof, white bargeboard, brick face, drops and a finial
    a, b, c = X(-3), X(33), X(15)
    g.tri((a, eaves + 2), (b, eaves + 2), (c, 2), roof)
    g.tri((X(0), eaves + 2), (X(30), eaves + 2), (c, 7), "white")
    g.tri((X(4), eaves + 2), (X(26), eaves + 2), (c, 14), brick)
    for t in range(1, 6):
        y = 16 + 6 * t
        for side in (-1, 1):
            g.rect(c + side * ((y - 14) / 38 * 11 - 1.5) - 1, y, 2, 2, "white")
    g.rect(c - 1, 0, 2, 7, "white")
    g.ell(c, 30, 5, 6, "plum")
    g.ell(c, 31, 3, 4, "cyan")
    g.rect(c - 6, 37, 12, 2, trim)
    # the bay: a lit front face, the facets beside it, a tall window per storey
    g.rect(X(2, 26), eaves + 2, 26, base - eaves - 6, brick)
    g.rect(X(24, 4), eaves + 2, 4, base - eaves - 6, dk(brick))
    g.rect(X(2, 4), eaves + 2, 4, base - eaves - 6, dk(brick) if mirror else brick)
    g.rect(X(2, 1), eaves + 2, 1, base - eaves - 6, dk(brick))
    for wy, wh in ((58, 20), (88, 22)):
        window(g, X(9, 12), wy, 12, wh, trim)
        for fx in (X(3, 2), X(25, 2)):
            g.rect(fx, wy + 2, 2, wh - 4, "teal")
    g.rect(X(0, 56), 84, 56, 2, trim)
    # the door side: the upper window, the porch, the door and its transom
    window(g, X(36, 12), 58, 12, 20, trim)
    g.rect(X(37, 10), 88, 10, 5, "plum")
    for i, col in enumerate(("red", "yellow", "dgreen", "yellow")):
        g.rect(X(38 + i * 2, 2), 89, 2, 3, col)
    g.rect(X(37, 10), 93, 10, 23, door_c)
    g.rect(X(39, 6), 96, 6, 8, dk(door_c))
    g.rect(X(39, 6), 106, 6, 7, dk(door_c))
    g.rect(X(44 if not mirror else 38, 2), 104, 2, 2, "amber")
    g.rect(X(29, 27), 82, 27, 3, "white")
    for k in range(5):
        g.rect(X(30 + k * 5, 3), 85, 3, 2, "white")
    for px_ in (X(30, 2), X(53, 2)):
        g.rect(px_, 85, 2, 31, "white")
    g.rect(X(30, 6), 104, 6, 2, "white")
    g.rect(X(48, 7), 104, 7, 2, "white")
    for k in range(3):
        g.rect(X(31 + k * 2, 1), 106, 1, 10, "white")
        g.rect(X(49 + k * 2, 1), 106, 1, 10, "white")
    # stone base and the stoop
    g.rect(X(0, 56), 116, 56, 6, "lgrey")
    g.rect(X(0, 56), 116, 56, 1, "grey")
    g.rect(X(34, 16), 116, 16, 3, "lgrey")
    g.rect(X(32, 20), 119, 20, 3, "lgrey")
    g.rect(X(32, 20), 119, 20, 1, "grey")
    if extra == "cat":
        cx = X(42)
        g.ell(cx, 73, 4, 3, "plum")
        g.ell(cx, 67, 3, 3, "plum")
        g.tri((cx - 3, 66), (cx - 1, 66), (cx - 3, 62), "plum")
        g.tri((cx + 1, 66), (cx + 3, 66), (cx + 3, 62), "plum")
        g.rect(cx - 2, 66, 1, 1, "yellow")
        g.rect(cx + 1, 66, 1, 1, "yellow")
    if extra == "neighbour":
        # sitting on the top step, knees up, a mug in one hand
        cx = X(42)
        g.ell(cx, 93, 4, 4, "skin1")
        g.rect(cx - 4, 88, 8, 3, "dbrown")
        g.rect(cx - 4, 88, 2, 6, "dbrown")
        g.rect(cx - 1, 93, 1, 1, "ink")
        g.rect(cx + 2, 93, 1, 1, "ink")
        g.rect(cx - 5, 98, 10, 9, "green")
        g.rect(cx + 2, 98, 3, 9, "dgreen")
        g.rect(cx - 7, 106, 14, 5, "blue")
        g.rect(cx - 7, 106, 14, 1, "sky")
        g.rect(cx - 6, 111, 4, 7, "blue")
        g.rect(cx + 2, 111, 4, 7, "blue")
        g.rect(cx - 7, 118, 5, 2, "dbrown")
        g.rect(cx + 2, 118, 5, 2, "dbrown")
        g.rect(cx - 6, 104, 3, 2, "skin1")
        g.rect(cx + 4, 101, 4, 4, "white")
        g.rect(cx + 8, 102, 1, 2, "white")


def rowhouse(brick, door_c, door_left=False, extra=None):
    """A bay-and-gable rowhouse, 56 wide: the bay under its front gable on one side, the door
    under a white porch on the other, a chimney on the door side's party wall. Never flipped:
    door_left draws the door on the left, for the right-hand verge, where the inner (left) side
    shows."""
    w, h = 64, 124

    def draw(g, f=0):
        cx = 6 if door_left else 50
        g.rect(cx, 26, 8, 16, "brown")
        g.rect(cx - 1, 24, 10, 3, "dbrown")
        g.rect(cx + 1, 21, 2, 3, "rust")
        g.rect(cx + 5, 21, 2, 3, "rust")
        half_house(g, 4, door_left, brick, door_c, extra=extra)
        g.rect(4 if door_left else 59, 50, 1, 66, dk(brick))
    return w, h, draw


def maple(leaf="green", shade="dgreen", light="yellow", fallen=None):
    """A tall street maple: five lobes over a long trunk that forks into the crown."""
    w, h = 84, 136

    def draw(g, f=0):
        base = h - 2
        g.rect(37, 70, 10, base - 69, "dbrown")
        g.rect(43, 70, 4, base - 69, "plum")
        g.rect(33, base - 3, 18, 4, "dbrown")
        g.tri((38, 76), (42, 76), (24, 54), "dbrown")
        g.tri((42, 74), (46, 74), (60, 52), "dbrown")
        lobes = ((42, 34, 28, 26), (20, 56, 16, 14), (64, 56, 16, 14), (26, 22, 15, 13), (58, 24, 15, 13))
        for cx, cy, rx, ry in lobes:
            g.ell(cx, cy, rx, ry, shade)
        for cx, cy, rx, ry in lobes:
            g.ell(cx - 2, cy - 3, rx - 3, ry - 3, light)
        for cx, cy, rx, ry in lobes:
            g.ell(cx - 1, cy - 2, rx - 4, ry - 4, leaf)
        for x, y, r in ((50, 28, 4), (30, 44, 3), (60, 52, 3), (24, 18, 3), (40, 12, 3), (66, 36, 3)):
            g.ell(x, y, r, r, shade)
        g.rect(40, 62, 4, 10, "dbrown")
        if fallen:
            for x, y in ((14, base - 1), (22, base - 2), (58, base - 1), (68, base - 2), (8, base - 2)):
                g.rect(x, y, 3, 2, fallen)
    return w, h, draw


# A cabbage: (x, its head's centre row, radius, outer leaves, heart).
GREEN_CABBAGE = ("dgreen", "green")
KALE = ("purple", "mauve")


def cabbage(g, x, y, r, outer, heart):
    g.ell(x, y, r, r * 0.8, outer)
    g.ell(x - 0.5, y - 0.5, r * 0.6, r * 0.5, heart)
    g.rect(x - 1, y - r * 0.4, 2, 2, "white" if outer == "purple" else "yellow")


def picket_garden():
    """A front garden behind a low white picket fence: green cabbages and ornamental kale in
    purple and white, a gate in the middle on two ball-topped posts."""
    w, h = 96, 40

    def draw(g, f=0):
        base = h - 2
        for i, x in enumerate(range(10, w - 8, 10)):
            outer, heart = KALE if i % 2 else GREEN_CABBAGE
            cabbage(g, x, 17 + (i % 2) * 2, 6, outer, heart)
        for x in (24, 66):
            g.rect(x, 9, 2, 6, "forest")
            g.rect(x - 1, 6, 4, 4, "pink" if x == 24 else "amber")
        g.rect(3, base - 11, w - 6, 3, "lgrey")
        g.rect(3, base - 4, w - 6, 2, "lgrey")
        for x in range(4, w - 6, 8):
            if 40 <= x <= 52:
                continue
            g.rect(x, base - 15, 5, 16, "white")
            g.tri((x, base - 15), (x + 5, base - 15), (x + 2.5, base - 18), "white")
            g.rect(x + 4, base - 15, 1, 16, "lgrey")
        for x in (38, 54):
            g.rect(x, base - 18, 4, 19, "white")
            g.ell(x + 2, base - 20, 3, 3, "white")
        for x in range(43, 53, 3):
            g.rect(x, base - 13, 2, 12, "white")
        g.rect(42, base - 13, 12, 2, "white")
    return w, h, draw


def cabbage_plot():
    """A raised community-garden bed: plank sides, a row of cabbages, a sunflower and a bean
    teepee."""
    w, h = 84, 64

    def draw(g, f=0):
        base = h - 2
        # the bean teepee and the sunflower behind the bed
        for x0 in (60, 72):
            g.tri((x0 - 1, base - 14), (x0 + 1, base - 14), (66, 4), "brown")
        g.rect(65, 2, 2, 4, "brown")
        for x, y in ((63, 14), (68, 20), (62, 28), (70, 30), (64, 38), (69, 10)):
            g.ell(x, y, 2.5, 2, "green")
        g.rect(66, 24, 2, 2, "red")
        g.rect(14, 12, 2, 32, "forest")
        g.ell(10, 28, 4, 2, "green")
        g.ell(20, 22, 4, 2, "green")
        g.ell(15, 10, 7, 7, "yellow")
        g.ell(15, 10, 7, 7, None)
        for k in range(8):
            a = k * math.pi / 4
            g.ell(15 + 5 * math.cos(a), 10 + 5 * math.sin(a), 2.5, 2.5, "amber" if k % 2 else "yellow")
        g.ell(15, 10, 3.5, 3.5, "dbrown")
        # the cabbages along the top of the bed
        for i, x in enumerate(range(12, w - 8, 12)):
            cabbage(g, x, 42, 6, *GREEN_CABBAGE)
        # the bed's plank sides
        g.rect(4, 46, w - 8, base - 45, "brown")
        g.rect(4, 46, w - 8, 2, "tan")
        g.rect(4, 53, w - 8, 1, "dbrown")
        g.rect(4, base - 1, w - 8, 2, "dbrown")
        for x in (4, w - 8):
            g.rect(x, 44, 4, base - 43, "dbrown")
    return w, h, draw


def goat_pen():
    """A farm paddock: a split-rail fence with a goat standing behind it, side on, and a hen on
    the corner post."""
    w, h = 116, 64

    def draw(g, f=0):
        base = h - 2
        # the goat, behind the rails
        g.ell(54, 36, 18, 9, "white")
        g.ell(57, 39, 15, 6, "white")
        g.ell(60, 34, 6, 4, "tan")
        for x in (40, 46, 62, 68):
            g.rect(x, 40, 4, base - 41, "white")
            g.rect(x, base - 3, 4, 2, "dslate")
        g.rect(43, 44, 1, base - 47, "lgrey")
        g.rect(69, 44, 1, base - 47, "lgrey")
        g.ell(36, 26, 6, 5, "white")
        g.ell(31, 29, 4, 3, "white")
        g.rect(28, 30, 3, 2, "pink")
        g.tri((32, 32), (36, 32), (33, 38), "white")
        g.tri((35, 22), (38, 22), (41, 15), "grey")
        g.tri((38, 22), (40, 22), (44, 17), "lgrey")
        g.tri((40, 24), (43, 22), (47, 27), "tan")
        g.rect(34, 25, 2, 2, "ink")
        g.rect(71, 32, 4, 3, "white")
        # the rails and posts
        for y in (34, 46):
            g.rect(4, y, w - 8, 4, "brown")
            g.rect(4, y + 3, w - 8, 1, "dbrown")
        for x in (6, 52, 98):
            g.rect(x, 28, 6, base - 27, "dbrown")
            g.rect(x, 28, 2, base - 27, "brown")
        # the hen on the corner post
        g.ell(101, 22, 6, 5, "white")
        g.ell(105, 16, 3, 3, "white")
        g.rect(104, 11, 3, 3, "red")
        g.rect(108, 16, 2, 2, "amber")
        g.rect(106, 19, 1, 2, "red")
        g.tri((94, 18), (96, 22), (99, 20), "lgrey")
        g.rect(105, 15, 1, 1, "ink")
    return w, h, draw


BRICK, BUFF, PAINT = "rust", "tan", "cream"
NEW = {
    "roadside-rowhouse-red-cat": (rowhouse(BRICK, "sky", extra="cat"), False),
    "roadside-rowhouse-buff": (rowhouse(BUFF, "red"), False),
    "roadside-rowhouse-stoop": (rowhouse(BRICK, "yellow", True, "neighbour"), False),
    "roadside-rowhouse-painted": (rowhouse(PAINT, "purple", True), False),
    "roadside-maple": (maple(), True),
    "roadside-maple-autumn": (maple("orange", "rust", "amber", "amber"), True),
    "roadside-picket-garden": (picket_garden(), False),
    "roadside-cabbage-plot": (cabbage_plot(), False),
    "roadside-goat-pen": (goat_pen(), False),
}
SHADOWED = {"roadside-lamp-post"} | {k for k, (_, free) in NEW.items() if free}
CACHE = {}


def drawn(key, step=1.0):
    """A new prop at a depth step, outlined, as an RGBA image."""
    if (key, step) not in CACHE:
        w, h, draw = NEW[key][0]
        g = edged(Mini(SCALE * step, w, h))
        draw(g)
        rows = g.outlined()
        img = Image.new("RGBA", (len(rows[0]), len(rows)))
        for y, row in enumerate(rows):
            for x, c in enumerate(row):
                if c:
                    img.putpixel((x, y), sn.rgb(c) + (255,))
        CACHE[key, step] = img
    return CACHE[key, step]


def prop_at(key, s):
    """A prop at scale s, from the smallest of its steps at least that size, scaled down
    nearest-neighbour, as the game draws road sprites."""
    if key not in NEW:
        return mt.depth_frame(key, "idle", s)
    full = drawn(key)
    size = max(1, math.floor(max(full.size) * min(1, s) + 0.5))
    art = full
    for _, step in STEPS:
        f = drawn(key, step)
        if size <= max(f.size) < max(art.size):
            art = f
    if max(art.size) == size:
        return art
    k = size / max(art.size)
    return art.resize((max(1, math.floor(art.width * k + 0.5)), max(1, math.floor(art.height * k + 0.5))), Image.NEAREST)


def width(key):
    return drawn(key).width if key in NEW else sn.frame(key, "idle").width


# The verges: (side, z, key, inner edge across, dz). Lots (a rowhouse, its front garden or
# fence) alternate with gaps (maples, the lamp post, a garden plot, the paddock), the right side
# a slot behind the left, so every lot faces a gap.
LOTS = [
    (-1, 150, "roadside-goat-pen", 188, 0),
    (-1, 300, "roadside-rowhouse-red-cat", 192, 0), (-1, 300, "roadside-picket-garden", 188, -60),
    (-1, 470, "roadside-maple-autumn", 188, 0),
    (-1, 620, "roadside-rowhouse-buff", 192, 0),
    (1, 170, "roadside-cabbage-plot", 188, 0),
    (1, 280, "roadside-maple-autumn", 188, 0),
    (1, 410, "roadside-rowhouse-stoop", 192, 0),
    (1, 560, "roadside-rowhouse-painted", 192, 0), (1, 560, "roadside-hedge", 188, -30),
    (1, 690, "roadside-maple", 188, 0),
]
# Road objects: (key, lane, distance ahead of the feet).
OBJECTS = [("hydrant", 3, 560), ("tip", 1, 480), ("bin", 1, 340), ("treat", 3, 300), ("tip", 0, 200), ("cone", 4, 220)]
DOGS = ("koda", "biscuit", "duchess")


def lawn_shadow(sc, cx, foot, w):
    rx = max(3, w / 2 - 2)
    for y in range(-3, 4):
        for x in range(int(-rx - 1), int(rx + 2)):
            dx, dy = (x + 0.5) / rx, (y + 0.5) / 2.5
            if dx * dx + dy * dy <= 1:
                sc.fill(int(cx + x), int(foot - 1 + y), 1, 1, "dgreen")


def walk():
    sc = mt.Scene(W, H)
    sc.road(ZONE)
    items = [(z + dz, "prop", (side, key, inner + width(key) / 2)) for side, z, key, inner, dz in LOTS]
    items += [(d, "object", (key, ln)) for key, ln, d in OBJECTS]
    for z, kind, what in sorted(items, key=lambda it: -it[0]):
        if kind == "object":
            key, ln = what
            sc.stand(key, "idle", mt.lane(ln), z)
            continue
        side, key, across = what
        s = F / (F + z)
        row = round(YH + (FOOT - YH) * s)
        art = prop_at(key, s)
        cx = 180 + side * across * s
        if key in SHADOWED:
            lawn_shadow(sc, round(cx), row, art.getbbox()[2] - art.getbbox()[0])
        sc.paste(art, cx - art.width / 2, row - art.getbbox()[3] + 1)
    sc.pack(mt.lane(2), tuple(f"dog-{d}" for d in DOGS))
    sc.img.paste(skyline(), (0, BAND_Y))
    sc.top_bar([ZONE], 24, 2, 0.15)
    b = mt.TOP_BAR["buttons"]["sound"]
    sc.paste(sn.frame("ui-icon-button", "normal"), b["face"]["x"], b["face"]["y"])
    sc.paste(sn.frame("icon-sound", "on"), b["icon"]["x"], b["icon"]["y"])
    band = sn.image("ui-dog-band")
    sc.img.paste(band, (0, DOG_BAND_Y), band)
    for i, d in enumerate(DOGS):
        sc.doghouse(i * 120, 470, d, mt.dog(d)[3])
    return sc.img


def props_sheet():
    """Every new prop at 2x on the lawn, labelled with its key, in rows."""
    rows = [("roadside-rowhouse-red-cat", "roadside-rowhouse-buff", "roadside-rowhouse-stoop",
             "roadside-rowhouse-painted"),
            ("roadside-maple", "roadside-maple-autumn", "roadside-goat-pen"),
            ("roadside-picket-garden", "roadside-cabbage-plot")]
    gap, label = 16, 16
    sizes = [[drawn(k).size for k in r] for r in rows]
    sheet_w = max(sum(w * 2 + gap for w, _ in r) + gap for r in sizes)
    sheet_h = sum(max(h for _, h in r) * 2 + label + gap for r in sizes) + gap
    cv = sn.Canvas(sheet_w, sheet_h)
    cv.fill(0, 0, sheet_w, sheet_h, "green")
    y = gap
    for r, sz in zip(rows, sizes):
        x, tall = gap, max(h for _, h in sz) * 2
        for key, (w, h) in zip(r, sz):
            art = drawn(key)
            art = art.resize((w * 2, h * 2), Image.NEAREST)
            sn.text(cv, key.removeprefix("roadside-").upper(), x, y, "ink", 2)
            cv.paste(art, x, y + label + tall - h * 2)
            x += w * 2 + gap
        y += tall + label + gap
    return cv.img


def build():
    os.makedirs(OUT, exist_ok=True)
    walk().save(f"{OUT}/cabbagetown-walk.png")
    props_sheet().save(f"{OUT}/cabbagetown-props.png")
    print("built", f"{OUT}/cabbagetown-walk.png", f"{OUT}/cabbagetown-props.png")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
