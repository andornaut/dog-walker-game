#!/usr/bin/env python3
"""Draw the roadside props: the houses, fences, trees and yard clutter on the lawns beyond the
sidewalks, and hold the per-zone table that places them.

They are road sprites in the OutRun manner: front elevations (the bike side on), anchored bottom
centre on their road row, scaled with the road camera and drawn back to front with the road objects.
Every prop's inner edge lies beyond the sidewalk, so none stands on a lane or a sidewalk, and none
is a person, a live animal on the ground, a coin or a bone, so none reads as an obstacle, an
encounter or a pickup. The hedge is bumped and in flower, unlike the obstacle `hedge`; the mailbox
is blue with a yellow flag, unlike the red hydrant; the shrub is round and in bloom, unlike the
obstacle `hedge`; the little library is a box on a post, apart from the bench and the bin.

Each is laid out on a design grid and drawn SCALE (1.5) times larger, as the road objects are:
every rect, ellipse and triangle scales, 1px lines stay 1px. Design sizes are multiples of 4, so
every frame and depth variant is a whole size. Full size, then @88, @75, @62 and @50:

roadside-house-cottage       120x120  a tan cottage under a steep brown gable, green door
roadside-house-cottage-pink  120x120  a pink cottage under a steep purple gable, white door
roadside-house-tall          114x132  a cream two-storey house under a steep dred gable, sky door
roadside-house-tall-grey     114x132  a light grey two-storey house under a steep slate gable, dred door
roadside-house-porch         126x126  a sky house under a steep navy gable with a dormer, red porch awning
roadside-house-porch-tan     126x126  a tan house under a steep brown gable with a dormer, the porch awning
roadside-fence               150x42   a white picket fence
roadside-fence-cat           150x60   the fence with a plum cat sitting on the pickets
roadside-hedge               132x48   a bumpy front hedge with white flowers
roadside-mailbox             36x48    a blue mailbox on a post, its yellow flag up
roadside-tree                114x156  a round street tree in three lobes
roadside-tree-blossom        114x156  the tree in pink blossom
roadside-lamp-post           36x150   a white globe lamp on a forest post with a flower basket
roadside-gnome               30x42    a garden gnome in a blue hat and red coat
roadside-flowers             90x30    a border of mixed blooms on their stems
roadside-bike                72x48    a kid's red bike on its stand, side on, streamers
roadside-sprinkler           78x42    a lawn sprinkler's fan of water; idle 2 frames x 200ms; not placed
roadside-laundry             162x96   a washing line on two T posts: a shirt, a sheet, socks, a dress
roadside-birdbath            48x66    a white stone bird bath, a sky bird on its rim
roadside-flamingos           60x66    a pair of pink plastic lawn flamingos on wire legs
roadside-wheelbarrow         84x54    a red wheelbarrow side on, heaped with flowers
roadside-library             48x96    a little free library: a red box of books under a slate gable on a post
roadside-urn                 48x66    a terracotta urn of red geraniums on a stone plinth
roadside-shrub               66x54    a round hydrangea bush in sky and mauve mopheads
roadside-topiary             42x90    a pom-pom topiary, three clipped balls, in a white box planter
roadside-swing               114x96   a swing set: a sky A-frame each end, a red seat and a yellow one
roadside-well                60x84    a stone wishing well under a dred gable, its winch and bucket

The Toronto neighborhoods' props, in the house palette's Toronto colours too:

roadside-barrels, -clothes-rack, -dune-fence, -dune-grass, -fern, -fruit-stand, -gas-lamp,
-hot-dog-stand, -house-bay-gable (-cream, -dark), -house-beach, -iron-fence, -leuty, -lifeguard-chair,
-love-lock, -market-house-lilac (-lime, -turquoise), -muskoka-chair (-red), -planter-tree, -post-ring,
-storefront (-red), -street-lamp, -trail-sign, -transit-stop, -tree-maple, -tree-oak, -tree-pine,
-umbrella (-turquoise), -warehouse (-stone); art/inventory.md lists their sizes.

Every prop has one tag, `idle`: one frame of 1000ms, or the sprinkler's two. Every other prop is
static: one frame, no motion. PLACEMENT places static props only. The ground row is the
last opaque row; the frame keeps a clear ring for the outline. Outlines are road_edge; there is no
light rim (road.LIT), since the props stand on the lawn, never on the road.

PLACEMENT holds the per-zone placement tables, Elm Avenue's and each Toronto neighborhood's (see the
style guide's Roadside section); `table` prints them as JSON with every prop's across offset resolved
and each zone's shadow colour. They place only the odd prop: most of the props are drawn but not placed.

Usage:
  roadside.py preview OUT.png   every frame on green, dgreen and Elm Avenue's road
  roadside.py build             write art/roadside/*.aseprite and export to public/art/sprites/
  roadside.py table             print the placement table as JSON
  roadside.py table --write     write it to shared/roadside.json, which the game reads; build writes it too

Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
belong in this file instead. Shared tooling is in pixel.py.
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from minis import STEPS, Mini, scaled  # noqa: E402
from pixel import DARKER, K, edged, main  # noqa: E402

SCALE = 1.5
GROUNDS = (K["green"], K["dgreen"], K["dslate"])
STILL_MS = 1000
SPRAY_MS = 200


def dk(c):
    return DARKER[K.get(c, c)]


# ---------- the props: front elevations, in design units ----------
# Each draw(g, f) paints on a grid of the prop's design size, frame f of its idle; base = h - 2 is the
# ground row, so the outline closes under it, and the outer ring of the frame stays clear.

def window(g, x, y, w=16, h=14, shutters=None, box=False):
    if shutters:
        g.rect(x - 4, y, 3, h, shutters)
        g.rect(x + w + 1, y, 3, h, shutters)
    g.rect(x, y, w, h, "plum")
    g.rect(x + 2, y + 2, w - 4, h - 4, "cyan")
    g.rect(x + 2, y + 2, 2, 2, "white")
    g.rect(x + w // 2 - 1, y + 2, 2, h - 4, "white")
    g.rect(x - 2, y + h, w + 4, 2, "white")
    if box:
        g.rect(x - 1, y + h + 2, w + 2, 4, "dbrown")
        for i, c in enumerate(("red", "yellow", "pink", "red", "white")[:(w + 4) // 4]):
            g.rect(x + i * 4 - 1, y + h - 1 + (i % 2), 3, 3, c)


def door(g, cx, base, col, h=26):
    g.rect(cx - 7, base - h, 14, h, col)
    g.rect(cx - 5, base - h + 3, 10, 6, dk(col))
    g.rect(cx + 3, base - h // 2, 2, 2, "amber")
    g.rect(cx - 10, base - 3, 20, 3, "lgrey")


# The lit left edge of a roof, a ramp step lighter, as on the backdrops' houses.
RAKE = dict(brown="tan", dred="red", navy="dslate", purple="mauve", slate="grey", shale="ash", dslate="slate",
            dbrick="brick", violet="lilac", dolive="olive", dlake="lake", brick="clay")


def gable(g, x0, ww, top, roof, ridge=None):
    """A steep gable over a wall from column x0, ww wide, whose top row is top, drawn in whole pixels: its
    eaves 2px past the walls in a 2px dark band, then a row up for each column it narrows on both sides,
    its left edge a ramp step lighter and, given ridge, its right edge that colour (a dormer's cap, so it
    stands out of the roof behind it). Returns the ridge's row in design units."""
    eave = scaled(4 / 3, g.s)
    left, right, y = scaled(x0, g.s) - eave, scaled(x0 + ww, g.s) + eave, scaled(top, g.s)
    g.g.rect(left, y - eave, right - left, eave, dk(roof))
    y -= eave
    while right - left > 2:
        left, right, y = left + 1, right - 1, y - 1
        g.g.rect(left, y, right - left, 1, roof)
        g.g.p(left, y, RAKE[roof])
        if ridge:
            g.g.p(right - 1, y, ridge)
    return y / g.s


def walls(g, x0, ww, top, base, wall):
    """A wall from column x0, ww wide, rows top to base, its right 3px a step darker."""
    g.rect(x0, top, ww, base - top, wall)
    g.rect(x0 + ww - 2, top, 2, base - top, dk(wall))


def chimney(g, x, top, h):
    g.rect(x, top, 8, h, "brown")
    g.rect(x + 6, top, 2, h, "dbrown")
    g.rect(x - 1, top - 2, 10, 3, "dbrown")


def round_window(g, cx, cy, r, frame):
    g.ell(cx, cy, r, r, frame)
    g.ell(cx, cy, r - 2, r - 2, "cyan")


def dormer(g, cx, top, bottom, wall, roof):
    """A dormer centred on column cx, its cap from row top and its front down to row bottom: a small
    steep gable over a wall front holding one window."""
    gable(g, cx - 7, 14, top + 7, roof, ridge=dk(roof))
    walls(g, cx - 7, 14, top + 7, bottom, wall)
    window(g, cx - 4, top + 9, 8, bottom - top - 13)


def cottage(wall, roof, door_c):
    """One storey under a steep gable: two shuttered windows with flower boxes, a door, a round attic
    window."""
    w, h, ww, wall_h = 80, 80, 72, 34

    def draw(g, f=0):
        x0, base = 4, h - 2
        top = base - wall_h
        chimney(g, x0 + ww - 20, top - 28, 14)
        apex = gable(g, x0, ww, top, roof)
        walls(g, x0, ww, top, base, wall)
        for x in (x0 + 8, x0 + ww - 20):
            window(g, x, top + 6, 12, 14, shutters=roof, box=True)
        door(g, x0 + ww // 2, base, door_c)
        round_window(g, x0 + ww / 2, apex + 22, 5, "plum")
    return w, h, draw


def two_storey(wall, roof, door_c):
    """Two storeys under a steep gable with a round attic window."""
    w, h, ww, wall_h = 76, 88, 68, 46

    def draw(g, f=0):
        x0, base = 4, h - 2
        top = base - wall_h
        chimney(g, x0 + 10, top - 26, 13)
        apex = gable(g, x0, ww, top, roof)
        walls(g, x0, ww, top, base, wall)
        g.rect(x0, top + 20, ww, 2, dk(wall))
        for x in (x0 + 8, x0 + ww - 22):
            window(g, x, top + 4, 12, 12, shutters=roof)
        window(g, x0 + 8, top + 25, 12, 12, box=True)
        door(g, x0 + ww - 16, base, door_c, h=22)
        round_window(g, x0 + ww / 2, apex + 22, 6, "white")
    return w, h, draw


def porch_house(wall, roof, door_c):
    """One storey under a steep gable with a dormer, a striped awning over the porch."""
    w, h, ww, wall_h = 84, 84, 76, 36

    def draw(g, f=0):
        x0, base = 4, h - 2
        top = base - wall_h
        chimney(g, x0 + ww - 18, top - 26, 13)
        apex = gable(g, x0, ww, top, roof)
        walls(g, x0, ww, top, base, wall)
        dormer(g, x0 + ww // 2, apex + 15, top - 2, wall, roof)
        for x in (x0 + 6, x0 + ww - 20):
            window(g, x, top + 9, 14, 13, box=True)
        cx = x0 + ww // 2
        door(g, cx, base - 2, door_c, h=24)
        # the porch: an awning in red and white stripes on two posts, a deck
        for i in range(6):
            c = "red" if i % 2 == 0 else "white"
            g.rect(cx - 15 + i * 5, top + 3, 5, 7, c)
            g.rect(cx - 15 + i * 5 + 1, top + 10, 3, 2, c)
        for x in (cx - 14, cx + 11):
            g.rect(x, top + 12, 3, wall_h - 14, "white")
        g.rect(cx - 17, base - 3, 34, 3, "tan")
    return w, h, draw


# The plum cat sitting on the fence, from the backdrops' perch, in 2x2 cells: x body, o its far eye's
# socket; its near eye is yellow.
CAT = ("x.x...", "xxx...", "xxx..x", ".xxx.x", ".xoxxx", ".xxxx.")


def fence(cat=False):
    """A white picket fence, its two rails showing between the pickets; with the plum cat on top."""
    w, h = 100, 40 if cat else 28

    def draw(g, f=0):
        base = h - 2
        g.rect(2, base - 15, w - 4, 3, "lgrey")
        g.rect(2, base - 7, w - 4, 3, "lgrey")
        for x in range(3, w - 6, 10):
            g.rect(x, base - 20, 6, 21, "white")
            g.tri((x, base - 20), (x + 6, base - 20), (x + 3, base - 24), "white")
            g.rect(x + 5, base - 20, 1, 21, "lgrey")
        if cat:
            for r, row in enumerate(CAT):
                for c, ch in enumerate(row):
                    if ch != ".":
                        g.rect(64 + 2 * c, 2 + 2 * r, 2, 2, "plum" if ch == "x" else "purple")
            g.rect(66, 4, 2, 2, "yellow")
    return w, h, draw


def hedge():
    """A front hedge with a bumped top, lit on its upper left, dotted with white flowers."""
    w, h = 88, 32

    def draw(g, f=0):
        base = h - 2
        g.rect(3, 14, w - 6, base - 13, "dgreen")
        for x in range(12, w - 8, 15):
            g.ell(x, 14, 10, 10, "dgreen")
            g.ell(x - 2, 12, 6, 6, "green")
        g.rect(3, base - 5, w - 6, 6, "forest")
        for x in range(8, w - 8, 15):
            g.rect(x + 4, 18, 3, 2, "forest")
        for x, y in ((9, 9), (24, 16), (38, 8), (51, 18), (66, 10), (78, 17), (17, 20), (45, 21), (72, 21)):
            g.rect(x, y, 2, 2, "white")
    return w, h, draw


def mailbox():
    """A blue mailbox on a wooden post, its yellow flag up."""
    w, h = 24, 32

    def draw(g, f=0):
        base = h - 2
        g.rect(10, 14, 4, base - 13, "dbrown")
        g.rect(13, 14, 1, base - 13, "plum")
        g.rect(8, base - 1, 8, 2, "dbrown")
        g.rect(4, 8, 14, 8, "blue")
        g.ell(11, 8, 7, 5, "blue")
        g.rect(14, 8, 4, 8, "navy")
        g.rect(6, 6, 6, 2, "sky")
        g.rect(18, 3, 2, 10, "dbrown")
        g.rect(18, 3, 4, 4, "yellow")
    return w, h, draw


def tree(leaf="green", shade="dgreen", light="yellow", petals=None):
    """A round street tree: three lobes over a short trunk, cel shaded from the top left; a blossom
    tree takes petals instead of a lit rim."""
    w, h = 76, 104

    def draw(g, f=0):
        base = h - 2
        g.rect(33, 61, 10, base - 60, "dbrown")
        g.rect(39, 61, 4, base - 60, "plum")
        g.rect(29, base - 3, 18, 4, "dbrown")
        lobes = ((38, 33, 32, 30), (21, 53, 17, 14), (55, 53, 17, 14))
        for cx, cy, rx, ry in lobes:
            g.ell(cx, cy, rx, ry, shade)
        for cx, cy, rx, ry in lobes:
            g.ell(cx - 2, cy - 3, rx - 3, ry - 3, light or leaf)
        for cx, cy, rx, ry in lobes:
            g.ell(cx - 1, cy - 2, rx - 4, ry - 4, leaf)
        for x, y, r in ((47, 25, 4), (27, 41, 3), (51, 49, 3), (31, 15, 3)):
            g.ell(x, y, r, r, shade)
        if petals:
            for x, y in ((21, 21), (35, 7), (41, 35), (17, 47), (55, 41), (29, 55)):
                g.rect(x, y, 3, 3, petals)
    return w, h, draw


def lamp_post():
    """A park lamp: a white globe on a slim forest post, a flower basket hung from an arm."""
    w, h = 24, 100

    def draw(g, f=0):
        base = h - 2
        g.rect(10, 24, 4, base - 23, "forest")
        g.rect(10, 24, 1, base - 23, "dgreen")
        g.rect(7, base - 7, 10, 8, "forest")
        g.rect(7, base - 7, 10, 1, "dgreen")
        g.rect(8, 22, 8, 3, "forest")
        g.ell(12, 13, 9, 9, "white")
        g.ell(14, 15, 6, 6, "lgrey")
        g.ell(12, 13, 6, 6, "white")
        g.rect(8, 8, 3, 3, "cream")
        g.rect(11, 2, 2, 3, "forest")
        # the basket's arm and chains, the basket, its flowers
        g.rect(14, 34, 5, 2, "forest")
        g.rect(16, 36, 1, 4, "dslate")
        g.rect(20, 36, 1, 4, "dslate")
        g.ell(18.5, 43, 4, 3, "dbrown")
        for x, y, c in ((15, 38, "pink"), (18, 37, "red"), (21, 38, "yellow")):
            g.rect(x, y, 2, 2, c)
        g.rect(16, 40, 5, 1, "dgreen")
    return w, h, draw


def gnome():
    """A garden gnome in a blue hat and a red coat, white beard, brown boots."""
    w, h = 20, 28

    def draw(g, f=0):
        base = h - 2
        g.rect(5, base - 11, 10, 10, "red")
        g.rect(12, base - 11, 3, 10, "dred")
        g.rect(5, base - 1, 4, 2, "dbrown")
        g.rect(11, base - 1, 4, 2, "dbrown")
        g.tri((4, 12), (16, 12), (9, 1), "blue")
        g.rect(6, 12, 8, 4, "skin1")
        g.tri((5, 15), (15, 15), (10, 23), "white")
        g.rect(9, 13, 2, 2, "pink")
    return w, h, draw


# A border's blooms, left to right: colour and how far up its head stands.
BLOOMS = (("red", 9), ("yellow", 13), ("pink", 7), ("white", 12), ("red", 15), ("orange", 8), ("pink", 13),
          ("yellow", 10), ("white", 14), ("red", 8))


def flowers():
    """A flower border on bare soil: leafy clumps and mixed blooms on their stems, no box."""
    w, h = 60, 20

    def draw(g, f=0):
        base = h - 2
        g.rect(3, base - 1, w - 6, 2, "dbrown")
        for i, (c, up) in enumerate(BLOOMS):
            x = 6 + i * 5
            g.rect(x + 1, base - up + 2, 1, up - 2, "forest")
            g.ell(x + 1, base - 2, 3, 2.5, "dgreen")
            g.rect(x, base - up - 1, 3, 3, c)
            g.rect(x + 1, base - up, 1, 1, dk(c) if c != "yellow" else "orange")
    return w, h, draw


def bike():
    """A kid's bike on its stand, side on: two wheels, a red frame, streamers."""
    w, h = 48, 32

    def draw(g, f=0):
        base = h - 2
        for cx in (12, 36):
            g.ell(cx, base - 8, 8.5, 8.5, "dslate")
            g.ell(cx, base - 8, 5.5, 5.5, None)
            g.rect(cx - 1, base - 9, 2, 2, "grey")
        g.tri((12, base - 8), (20, base - 9), (17, base - 18), "red")
        g.tri((17, base - 18), (33, base - 18), (25, base - 9), "red")
        g.tri((25, base - 9), (20, base - 9), (17, base - 18), None)
        g.rect(17, base - 18, 16, 3, "red")
        g.rect(32, base - 22, 3, 14, "red")
        g.rect(13, base - 22, 9, 3, "navy")
        g.rect(30, base - 25, 9, 3, "lgrey")
        g.rect(39, base - 25, 2, 6, "pink")
        g.rect(41, base - 23, 2, 6, "cyan")
    return w, h, draw


def sprinkler():
    """A lawn sprinkler's fan of water on a little grey head. Frame 1 moves every drop half a step
    along its arc and swaps its colour, so the spray runs."""
    w, h = 52, 28

    def draw(g, f=0):
        base = h - 2
        g.rect(23, base - 4, 6, 5, "grey")
        g.rect(24, base - 6, 4, 2, "lgrey")
        for side in (-1, 1):
            for i in range(1, 7):
                t = i + 0.5 * f
                x = 26 + side * (t * 3.4)
                y = base - 8 - 14 * math.sin(math.pi * t / 8)
                g.rect(round(x) - 1, round(y), 3, 3, "cyan" if (i + f) % 2 else "white")
    return w, h, draw


def laundry():
    """A washing line between two T posts: a shirt, a sheet, socks, a dress."""
    w, h = 108, 64

    def draw(g, f=0):
        base = h - 2
        for x in (6, w - 10):
            g.rect(x, 8, 4, base - 7, "lgrey")
            g.rect(x - 4, 8, 12, 3, "lgrey")
        g.rect(8, 12, w - 16, 1, "grey")
        g.rect(16, 13, 18, 18, "sky")
        g.rect(12, 13, 4, 8, "sky")
        g.rect(34, 13, 4, 8, "sky")
        g.rect(23, 13, 4, 3, "white")
        g.rect(42, 13, 24, 26, "white")
        g.rect(42, 31, 24, 2, "pink")
        g.rect(70, 13, 5, 12, "red")
        g.rect(70, 23, 8, 3, "red")
        g.rect(80, 13, 5, 12, "yellow")
        g.rect(80, 23, 8, 3, "yellow")
        g.tri((89, 13), (97, 13), (93, 34), "pink")
        g.rect(89, 13, 8, 8, "pink")
        g.tri((86, 34), (100, 34), (93, 18), "pink")
    return w, h, draw


def bar(g, a, b, c, wide=2):
    """A straight bar wide design units across from point a to point b, as two triangles."""
    (x0, y0), (x1, y1) = a, b
    g.tri((x0, y0), (x0 + wide, y0), (x1 + wide, y1), c)
    g.tri((x0, y0), (x1, y1), (x1 + wide, y1), c)


def wishing_well():
    """A stone wishing well: a round wall of grey stones under a lit rim, two wooden posts holding a
    dred gable, its winch, rope and bucket."""
    w, h = 40, 56

    def draw(g, f=0):
        base = h - 2
        gable(g, 6, 28, 22, "dred")
        for x in (7, 30):
            g.rect(x, 21, 3, 18, "brown")
            g.rect(x + 2, 21, 1, 18, "dbrown")
        g.rect(7, 26, 26, 2, "dbrown")
        g.rect(33, 25, 3, 1, "lgrey")
        g.rect(35, 25, 1, 3, "lgrey")
        g.rect(19, 28, 1, 5, "tan")
        g.rect(17, 33, 5, 4, "slate")
        g.rect(17, 33, 5, 1, "lgrey")
        g.rect(4, base - 14, 32, 15, "grey")
        g.rect(31, base - 14, 5, 15, "slate")
        for i, y in enumerate(range(base - 10, base, 4)):
            g.rect(4, y, 32, 1, "slate")
            for x in range(6 + 4 * (i % 2), 34, 8):
                g.rect(x, y - 3, 1, 3, "slate")
        g.rect(2, base - 16, 36, 3, "lgrey")
        g.rect(2, base - 16, 6, 3, "white")
        g.rect(33, base - 16, 5, 3, "grey")
    return w, h, draw


def birdbath():
    """A white stone bird bath: a wide basin of water on a waisted pedestal and a square foot, a sky bird
    perched on its rim."""
    w, h = 32, 44

    def draw(g, f=0):
        base = h - 2
        g.rect(8, base - 4, 16, 5, "lgrey")
        g.rect(20, base - 4, 4, 5, "grey")
        g.rect(11, base - 6, 10, 2, "white")
        g.rect(13, 22, 6, base - 27, "lgrey")
        g.rect(13, 22, 2, base - 27, "white")
        g.rect(17, 22, 2, base - 27, "grey")
        g.rect(11, 19, 10, 3, "lgrey")
        g.ell(16, 14, 13, 6, "lgrey")
        g.ell(19, 16, 9, 3, "grey")
        g.rect(2, 12, 28, 3, "white")
        g.rect(26, 12, 4, 3, "lgrey")
        g.rect(5, 11, 22, 1, "cyan")
        g.rect(8, 11, 3, 1, "white")
        # the bird: a round sky body, its head to the left, a dark tail up behind it
        g.ell(9, 8, 4, 3, "sky")
        g.ell(10, 9, 3, 1.5, "blue")
        g.ell(5, 5, 2.5, 2.5, "sky")
        g.rect(2, 5, 2, 1, "amber")
        g.rect(5, 4, 1, 1, "ink")
        g.tri((12, 7), (16, 3), (14, 8), "blue")
    return w, h, draw


def flamingo(g, x, base, rise):
    """A pink plastic lawn flamingo facing left, its body's front at column x: a round body on two wire
    legs, an S neck up rise rows and a head with a white beak, its tip ink."""
    top = base - 15
    for lx in (x + 6, x + 9):
        g.rect(lx, top, 1, base - top + 1, "grey")
    g.ell(x + 7, top - 3, 7, 4, "pink")
    g.ell(x + 9, top - 2, 4, 2, "mauve")
    g.tri((x + 12, top - 6), (x + 17, top - 7), (x + 13, top - 1), "pink")
    g.rect(x + 1, top - rise, 3, rise - 3, "pink")
    g.rect(x + 3, top - rise - 2, 3, 3, "pink")
    g.ell(x + 2, top - rise - 3, 3, 2.5, "pink")
    g.rect(x - 3, top - rise - 3, 3, 2, "white")
    g.rect(x - 3, top - rise - 2, 1, 2, "ink")
    g.rect(x + 2, top - rise - 4, 1, 1, "ink")


def flamingos():
    """A pair of pink plastic lawn flamingos, the near one taller."""
    w, h = 40, 44

    def draw(g, f=0):
        base = h - 2
        flamingo(g, 21, base - 2, 12)
        flamingo(g, 5, base, 18)
    return w, h, draw


def wheelbarrow():
    """A red wheelbarrow side on, heaped with soil and flowers: its wheel to the left, a leg and a handle to
    the right."""
    w, h = 56, 36

    def draw(g, f=0):
        base = h - 2
        bar(g, (14, 22), (50, 12), "brown")
        g.rect(47, 11, 6, 3, "dbrown")
        g.rect(36, 18, 2, base - 17, "dslate")
        g.rect(33, base - 1, 6, 2, "dslate")
        g.ell(26, 12, 17, 5, "dbrown")
        g.tri((7, 13), (43, 13), (37, 25), "red")
        g.tri((7, 13), (37, 25), (15, 25), "red")
        g.tri((43, 13), (37, 25), (36, 13), "dred")
        g.rect(6, 12, 38, 2, "dred")
        g.ell(11, base - 7, 7.5, 7.5, "dslate")
        g.ell(11, base - 7, 4.5, 4.5, "grey")
        g.rect(10, base - 8, 2, 2, "dslate")
        for x, y, c in ((12, 6, "yellow"), (17, 4, "white"), (22, 7, "pink"), (27, 3, "red"), (32, 6, "yellow"),
                        (37, 8, "white"), (15, 9, "red"), (29, 9, "pink")):
            g.rect(x, y + 3, 1, 3, "forest")
            g.rect(x - 1, y, 3, 3, c)
        for x in (10, 20, 25, 34):
            g.rect(x, 9, 3, 2, "dgreen")
    return w, h, draw


def little_library():
    """A little free library: a red box under a slate gable on a post, its glass door showing the books."""
    w, h = 32, 64

    def draw(g, f=0):
        base = h - 2
        g.rect(14, 40, 4, base - 39, "dbrown")
        g.rect(17, 40, 1, base - 39, "plum")
        g.rect(10, base - 1, 12, 2, "dbrown")
        g.rect(8, 38, 16, 3, "brown")
        g.rect(22, 38, 2, 3, "dbrown")
        gable(g, 5, 22, 18, "slate")
        walls(g, 5, 22, 18, 38, "red")
        g.rect(8, 21, 15, 15, "white")
        g.rect(9, 22, 13, 13, "navy")
        g.rect(9, 28, 13, 1, "dslate")
        for i, (c, top) in enumerate((("yellow", 23), ("green", 24), ("pink", 23), ("sky", 25), ("white", 24),
                                      ("orange", 29), ("cream", 30), ("green", 29), ("red", 31), ("sky", 30))):
            x = 10 + (i % 5) * 2 + (i % 5) // 2
            g.rect(x, top, 2, (28 if i < 5 else 35) - top, c)
        g.rect(9, 22, 2, 2, "cyan")
        g.rect(20, 28, 2, 2, "amber")
    return w, h, draw


def urn():
    """A terracotta urn on a stone plinth, red geraniums over its leaves and leaves trailing over its lip."""
    w, h = 32, 44

    def draw(g, f=0):
        base = h - 2
        g.rect(8, base - 5, 16, 6, "lgrey")
        g.rect(20, base - 5, 4, 6, "grey")
        g.rect(13, base - 10, 6, 5, "ochre")
        g.rect(17, base - 10, 2, 5, "rust")
        g.rect(10, base - 12, 12, 2, "ochre")
        g.rect(19, base - 12, 3, 2, "rust")
        g.ell(16, 23, 11, 8, "rust")
        g.ell(15, 22, 10, 7, "ochre")
        g.ell(16, 11, 11, 6, "dgreen")
        g.ell(14, 9, 8, 4, "green")
        for x, y in ((8, 6), (14, 3), (20, 5), (11, 10), (19, 9), (24, 11)):
            g.rect(x, y, 4, 3, "red")
            g.rect(x + 1, y, 1, 1, "pink")
        g.rect(4, 15, 24, 3, "tan")
        g.rect(23, 15, 5, 3, "ochre")
        g.rect(4, 17, 24, 1, "rust")
        g.rect(6, 15, 2, 5, "dgreen")
        g.rect(24, 15, 2, 4, "dgreen")
    return w, h, draw


def shrub():
    """A round hydrangea bush, lit on its upper left, dotted with sky and mauve mopheads."""
    w, h = 44, 36

    def draw(g, f=0):
        base = h - 2
        g.ell(22, 20, 19, 15, "dgreen")
        g.rect(10, base - 3, 24, 4, "dgreen")
        g.ell(20, 17, 15, 11, "green")
        g.ell(23, 20, 15, 11, "dgreen")
        for x, y, c in ((12, 12, "sky"), (22, 8, "mauve"), (31, 13, "sky"), (18, 18, "mauve"), (27, 21, "sky"),
                        (9, 22, "mauve"), (35, 24, "mauve"), (17, 27, "sky")):
            g.ell(x, y, 3.5, 3, c)
            g.rect(x - 2, y - 1, 1, 1, "cyan" if c == "sky" else "pink")
            g.rect(x + 1, y, 1, 1, "cyan" if c == "sky" else "pink")
    return w, h, draw


def topiary():
    """A pom-pom topiary: three clipped balls on a stem in a white box planter."""
    w, h = 28, 60

    def draw(g, f=0):
        base = h - 2
        g.rect(13, 10, 2, base - 20, "dbrown")
        for cy, r in ((base - 20, 8), (25, 6), (9, 5)):
            g.ell(14, cy, r + 1, r, "dgreen")
            g.ell(13, cy - 1, r - 1, r - 2, "green")
            g.ell(15, cy + 1, r - 2, r - 3, "dgreen")
        g.rect(6, base - 11, 16, 12, "white")
        g.rect(19, base - 11, 3, 12, "lgrey")
        g.rect(5, base - 13, 18, 2, "lgrey")
        g.rect(9, base - 8, 1, 7, "lgrey")
        g.rect(18, base - 8, 1, 7, "lgrey")
    return w, h, draw


def swing():
    """A swing set: a sky A-frame at each end of a top bar, two seats on their ropes, red and yellow."""
    w, h = 76, 64

    def draw(g, f=0):
        base = h - 2
        for x in (10, 64):
            bar(g, (x, 6), (x - 7, base + 1), "sky")
            bar(g, (x - 2, 6), (x + 5, base + 1), "sky")
            g.rect(x - 4, base - 18, 10, 2, "blue")
        g.rect(5, 4, 66, 3, "sky")
        g.rect(5, 6, 66, 1, "blue")
        for x0, c in ((24, "red"), (44, "yellow")):
            g.rect(x0, 7, 1, 38, "lgrey")
            g.rect(x0 + 10, 7, 1, 38, "lgrey")
            g.rect(x0 - 1, 45, 13, 3, c)
            g.rect(x0 - 1, 47, 13, 1, dk(c))
    return w, h, draw


# ---------- Toronto ----------
# The Toronto neighborhoods' props, for busier roadsides than Maplewood's: brick bay-and-gable
# houses, painted market houses, warehouses and storefronts, and the street furniture between them.

def gas_lamp():
    """A heritage street lamp: a coal post on a fluted base, a four-sided lantern lit gold."""
    w, h = 24, 100

    def draw(g, f=0):
        base = h - 2
        g.rect(10, 26, 4, base - 25, "coal")
        g.rect(10, 26, 1, base - 25, "ash")
        g.rect(7, base - 9, 10, 10, "coal")
        g.rect(7, base - 9, 1, 10, "ash")
        g.rect(8, 22, 8, 4, "coal")
        g.rect(5, 8, 14, 14, "coal")
        g.rect(7, 10, 10, 10, "gold")
        g.rect(7, 10, 3, 3, "cream")
        g.rect(11, 10, 1, 10, "coal")
        g.tri((4, 8), (20, 8), (12, 2), "coal")
    return w, h, draw


def street_lamp():
    """A downtown street light: an ash pole, an arm each way, a flat lgrey head on each lit gold beneath."""
    w, h = 40, 120

    def draw(g, f=0):
        base = h - 2
        g.rect(18, 10, 4, base - 9, "ash")
        g.rect(18, 10, 1, base - 9, "stone")
        g.rect(15, base - 6, 10, 7, "shale")
        g.rect(8, 10, 24, 3, "ash")
        for x in (3, 27):
            g.rect(x, 9, 10, 4, "lgrey")
            g.rect(x + 1, 13, 8, 2, "gold")
    return w, h, draw


def post_ring():
    """A Toronto bike post: a coal ring on a post, a red bike locked to it, side on."""
    w, h = 48, 40

    def draw(g, f=0):
        base = h - 2
        g.rect(22, 8, 4, base - 7, "coal")
        g.ell(24, 10, 8, 8, "coal")
        g.ell(24, 10, 5, 5, None)
        g.rect(23, 18, 1, base - 17, "ash")
        for cx in (10, 38):
            g.ell(cx, base - 8, 8, 8, "coal")
            g.ell(cx, base - 8, 6, 6, None)
            g.rect(cx - 1, base - 9, 2, 2, "lgrey")
        g.tri((10, base - 8), (19, base - 20), (27, base - 9), "ttc")
        g.tri((19, base - 20), (33, base - 20), (27, base - 9), "ttc")
        g.tri((33, base - 20), (38, base - 8), (35, base - 8), "ttc")
        g.rect(16, base - 23, 7, 3, "coal")
        g.rect(32, base - 26, 3, 6, "coal")
        g.rect(29, base - 27, 8, 2, "coal")
    return w, h, draw


def lobed_tree(leaf, shade, light, trunk="dbrown", big=False):
    """A street or park tree: lobes over a trunk, shaded lower right, lit upper left; big is the park's
    spreading oak, wider and with more lobes."""
    w, h = (96, 116) if big else (76, 104)

    def draw(g, f=0):
        base = h - 2
        cx = w // 2
        g.rect(cx - 5, h - 44, 10, 43, trunk)
        g.rect(cx + 1, h - 44, 4, 43, dk(trunk))
        g.rect(cx - 9, base - 3, 18, 4, trunk)
        lobes = (((cx, 34, 40, 30), (cx - 26, 52, 18, 15), (cx + 26, 52, 18, 15), (cx - 18, 26, 16, 14),
                  (cx + 20, 28, 16, 14)) if big else
                 ((cx, 33, 32, 30), (cx - 17, 53, 17, 14), (cx + 17, 53, 17, 14)))
        for x, y, rx, ry in lobes:
            g.ell(x, y, rx, ry, shade)
        for x, y, rx, ry in lobes:
            g.ell(x - 2, y - 3, rx - 3, ry - 3, light)
        for x, y, rx, ry in lobes:
            g.ell(x - 1, y - 2, rx - 4, ry - 4, leaf)
        for x, y, r in ((cx + 9, 25, 4), (cx - 11, 41, 3), (cx + 13, 49, 3), (cx - 7, 15, 3)):
            g.ell(x, y, r, r, shade)
    return w, h, draw


def pine():
    """A conifer: four tiers of fir and pine boughs, each lit on its left, over a short bark trunk."""
    w, h = 64, 124

    def draw(g, f=0):
        base = h - 2
        cx = w // 2
        g.rect(cx - 4, base - 16, 8, 17, "bark")
        g.rect(cx + 1, base - 16, 3, 17, "walnut")
        for top, half, depth in ((4, 12, 26), (22, 18, 30), (44, 24, 34), (68, 29, 38)):
            g.tri((cx, top), (cx - half, top + depth), (cx + half, top + depth), "fir")
            g.tri((cx, top), (cx - half + 2, top + depth - 2), (cx + 2, top + depth - 2), "pine")
            g.tri((cx - 1, top + 4), (cx - half + 6, top + depth - 3), (cx - 3, top + depth - 3), "canopy")
    return w, h, draw


def bay_gable(wall, roof, door_c, trim="white"):
    """A Victorian bay-and-gable house: a steep gable trimmed in white along both rakes, with a round
    attic window, a two-storey bay of three windows a floor on its left, a door on its right."""
    w, h, ww, wall_h = 76, 96, 68, 54

    def draw(g, f=0):
        x0, base = 4, h - 2
        top = base - wall_h
        chimney(g, x0 + ww - 14, top - 30, 16)
        apex = gable(g, x0, ww, top, roof)
        walls(g, x0, ww, top, base, wall)
        # the bargeboard: a trim line just inside each rake
        for k in range(int(top - apex) - 2):
            y = top - 3 - k
            g.rect(x0 + 1 + k, y, 2, 1, trim)
            g.rect(x0 + ww - 3 - k, y, 2, 1, trim)
        round_window(g, x0 + ww / 2, apex + 20, 5, trim)
        bx, bw = x0 + 3, 36
        g.rect(bx, top + 2, bw, wall_h - 2, wall)
        g.rect(bx + bw - 4, top + 2, 4, wall_h - 2, dk(wall))
        g.rect(bx - 2, top, bw + 4, 3, trim)
        g.rect(bx - 2, top + 25, bw + 4, 3, trim)
        for wy in (top + 6, top + 31):
            for k in range(3):
                window(g, bx + 2 + k * 11, wy, 9, 15)
        door(g, x0 + ww - 14, base, door_c, h=28)
        g.rect(x0 + ww - 25, base - 33, 22, 3, trim)
    return w, h, draw


def iron_fence():
    """A wrought-iron front fence: coal bars with spear tips between two rails, an ash glint on the top
    rail."""
    w, h = 100, 32

    def draw(g, f=0):
        base = h - 2
        g.rect(2, base - 18, w - 4, 2, "coal")
        g.rect(2, base - 4, w - 4, 2, "coal")
        g.rect(2, base - 18, w - 4, 1, "ash")
        for i, x in enumerate(range(3, w - 4, 5)):
            g.rect(x, base - 21, 2, 22, "coal")
            g.tri((x - 1, base - 21), (x + 3, base - 21), (x + 1, base - 24 - (i % 2) * 2), "coal")
        for x in (3, w - 7):
            g.rect(x, base - 24, 4, 25, "coal")
            g.ell(x + 2, base - 25, 3, 3, "coal")
    return w, h, draw


def trail_sign():
    """A park trail sign: a bark post with two arrow boards, pine with gold edges."""
    w, h = 52, 72

    def draw(g, f=0):
        base = h - 2
        g.rect(24, 6, 4, base - 5, "bark")
        g.rect(27, 6, 1, base - 5, "walnut")
        for y, right in ((10, True), (24, False)):
            x0 = 8 if right else 10
            g.rect(x0, y, 32, 9, "pine")
            g.rect(x0, y, 32, 1, "canopy")
            if right:
                g.tri((x0 + 32, y), (x0 + 37, y + 4.5), (x0 + 32, y + 9), "pine")
            else:
                g.tri((x0, y), (x0 - 4, y + 4.5), (x0, y + 9), "pine")
            g.rect(x0 + 4, y + 4, 22, 1, "gold")
    return w, h, draw


def fern():
    """A clump of ferns: fronds fanning from the ground in pine and canopy, lit moss tips."""
    w, h = 52, 32

    def draw(g, f=0):
        base = h - 2
        for x0, x1, c in ((26, 4, "pine"), (26, 48, "pine"), (26, 10, "canopy"), (26, 42, "canopy"),
                          (26, 18, "canopy"), (26, 34, "pine"), (26, 26, "canopy")):
            g.tri((x0 - 3, base + 1), (x0 + 3, base + 1), (x1, 6 + abs(x1 - 26) // 2), c)
        for x, y in ((8, 12), (20, 6), (32, 7), (44, 13)):
            g.rect(x, y, 2, 2, "moss")
    return w, h, draw


def warehouse(wall, trim, glass="gold"):
    """A front of an old distillery warehouse: brick or limestone, a cornice, arched windows on two
    floors, a timber loading door."""
    w, h, ww, wall_h = 84, 92, 76, 84

    def draw(g, f=0):
        x0, base = 4, h - 2
        top = base - wall_h
        walls(g, x0, ww, top, base, wall)
        g.rect(x0 - 2, top - 2, ww + 4, 6, dk(wall))
        g.rect(x0 - 2, top + 4, ww + 4, 2, trim)
        for wy in (top + 12, top + 40):
            for k in range(3):
                x = x0 + 6 + k * 24
                g.rect(x, wy + 4, 16, 18, trim)
                g.ell(x + 8, wy + 5, 8, 5, trim)
                g.rect(x + 2, wy + 6, 12, 15, glass)
                g.ell(x + 8, wy + 6, 6, 3, glass)
                g.rect(x + 7, wy + 2, 2, 19, trim)
                g.rect(x + 2, wy + 13, 12, 1, trim)
        g.rect(x0 + 26, base - 14, 24, 15, "bark")
        g.rect(x0 + 26, base - 14, 24, 2, trim)
        for x in range(x0 + 29, x0 + 50, 5):
            g.rect(x, base - 12, 1, 13, "walnut")
    return w, h, draw


def barrels():
    """Three whisky barrels: two on their ends and one lying on top, clay staves in coal hoops."""
    w, h = 56, 48

    def draw(g, f=0):
        base = h - 2
        for x in (6, 28):
            g.rect(x, base - 20, 22, 21, "clay")
            g.rect(x + 17, base - 20, 5, 21, "bark")
            g.rect(x + 2, base - 20, 2, 21, "tan")
            for y in (base - 17, base - 5):
                g.rect(x, y, 22, 2, "coal")
        g.ell(28, base - 30, 14, 10, "clay")
        g.ell(28, base - 30, 6, 10, "bark")
        g.ell(28, base - 30, 3, 5, "walnut")
        g.rect(16, base - 38, 2, 16, "coal")
        g.rect(38, base - 38, 2, 16, "coal")
    return w, h, draw


def market_house(wall, roof, awning, board):
    """A Kensington Market house turned shop: a steep gable over a painted wall, two upstairs windows,
    a sign board, a striped awning over the shop window, a door."""
    w, h, ww, wall_h = 76, 100, 68, 56

    def draw(g, f=0):
        x0, base = 4, h - 2
        top = base - wall_h
        chimney(g, x0 + 8, top - 28, 14)
        apex = gable(g, x0, ww, top, roof)
        walls(g, x0, ww, top, base, wall)
        round_window(g, x0 + ww / 2, apex + 20, 5, "white")
        for x in (x0 + 8, x0 + ww - 22):
            window(g, x, top + 4, 14, 12)
        g.rect(x0 + 4, top + 22, ww - 8, 9, "coal")
        g.rect(x0 + 5, top + 23, ww - 10, 7, board)
        for x in range(x0 + 10, x0 + ww - 12, 6):
            g.rect(x, top + 25, 4, 3, "white")
        for i in range(0, ww - 4, 8):
            g.rect(x0 + 2 + i, top + 33, 4, 7, awning)
            g.rect(x0 + 6 + i, top + 33, 4, 7, "white")
        g.rect(x0 + 2, top + 40, ww - 4, 1, dk(awning))
        g.rect(x0 + 6, top + 42, 34, base - top - 42, "coal")
        g.rect(x0 + 7, top + 43, 32, base - top - 44, "cyan")
        g.rect(x0 + 9, top + 45, 8, 1, "white")
        door(g, x0 + ww - 14, base, "dbrown", h=22)
    return w, h, draw


def fruit_stand():
    """A tiered fruit stand under a little striped awning: three rows of crates heaped with fruit."""
    w, h = 72, 56

    def draw(g, f=0):
        base = h - 2
        for x in (6, 62):
            g.rect(x, 8, 3, base - 7, "bark")
        for i in range(8):
            g.rect(4 + i * 8, 4, 8, 6, "ttc" if i % 2 == 0 else "white")
        g.rect(4, 10, 64, 1, "dred")
        for row, (y, fruits) in enumerate(((base - 30, ("lime", "moss")), (base - 19, ("red", "ttc")),
                                           (base - 8, ("orange", "amber")))):
            x0 = 10 - row * 2
            g.rect(x0, y, 52 + row * 4, 9, "clay")
            g.rect(x0, y + 4, 52 + row * 4, 1, "bark")
            g.rect(x0 + 50 + row * 4 - 3, y, 3, 9, "bark")
            for k in range((52 + row * 4) // 5):
                g.ell(x0 + 3 + k * 5, y - 1, 2.4, 2.2, fruits[k % 2])
    return w, h, draw


def clothes_rack():
    """A vintage clothes rack out on the sidewalk: a coal rail on legs, coats and a dress on hangers."""
    w, h = 64, 56

    def draw(g, f=0):
        base = h - 2
        g.rect(4, 8, 56, 3, "coal")
        for x in (6, 56):
            g.rect(x, 8, 2, base - 7, "coal")
            g.rect(x - 3, base - 1, 8, 2, "coal")
        for x, col, long_ in ((10, "lilac", 30), (20, "turquoise", 26), (30, "gold", 32), (40, "ttc", 24),
                              (48, "lime", 28)):
            g.rect(x + 3, 10, 1, 3, "ash")
            g.tri((x, 14), (x + 7, 14), (x + 3.5, 12), col)
            g.rect(x, 14, 8, long_, col)
            g.rect(x + 6, 14, 2, long_, dk(col))
    return w, h, draw


def lifeguard_chair():
    """A tall white lifeguard chair on splayed legs, a ladder up the front, a red cross on its back."""
    w, h = 48, 100

    def draw(g, f=0):
        base = h - 2
        bar(g, (14, 40), (6, base + 1), "white")
        bar(g, (34, 40), (42, base + 1), "white")
        for y in range(48, base - 2, 10):
            g.rect(10, y, 28, 2, "lgrey")
        g.rect(10, 36, 28, 5, "white")
        g.rect(34, 36, 4, 5, "lgrey")
        g.rect(12, 8, 24, 28, "white")
        g.rect(32, 8, 4, 28, "lgrey")
        g.rect(21, 12, 6, 16, "ttc")
        g.rect(16, 17, 16, 6, "ttc")
    return w, h, draw


def beach_umbrella(a, b):
    """A striped beach umbrella planted in the sand, its pole driftwood."""
    w, h = 64, 72

    def draw(g, f=0):
        base = h - 2
        g.rect(31, 12, 3, base - 11, "driftwood")
        g.rect(33, 12, 1, base - 11, "stone")
        for j in range(8):
            g.tri((32, 6), (4 + j * 7, 22), (11 + j * 7, 22), a if j % 2 == 0 else b)
        g.rect(4, 22, 56, 2, dk(a))
        g.rect(30, 2, 4, 4, "driftwood")
    return w, h, draw


def muskoka_chair(col):
    """A Muskoka chair side on: a raked slatted back, broad arms, a seat sloping back."""
    w, h = 44, 44

    def draw(g, f=0):
        base = h - 2
        g.tri((6, 4), (12, 4), (22, 28), col)
        g.tri((6, 4), (22, 28), (17, 28), col)
        g.rect(10, 24, 28, 4, col)
        g.rect(10, 27, 28, 1, dk(col))
        g.rect(22, 16, 18, 3, col)
        g.rect(35, 19, 3, base - 18, dk(col))
        g.rect(12, 28, 3, base - 27, dk(col))
        g.rect(26, 28, 3, base - 27, dk(col))
        g.rect(8, 6, 2, 3, "white")
    return w, h, draw


def dune_fence():
    """A slatted sand fence: driftwood slats wired between posts, leaning a little."""
    w, h = 100, 32

    def draw(g, f=0):
        base = h - 2
        for x in range(3, w - 4, 4):
            g.rect(x, base - 20 + (x // 4) % 2, 2, 21 - (x // 4) % 2, "driftwood")
        g.rect(2, base - 16, w - 4, 1, "dstone")
        g.rect(2, base - 6, w - 4, 1, "dstone")
        for x in (3, 47, w - 7):
            g.rect(x, base - 24, 4, 25, "clay")
    return w, h, draw


def dune_grass():
    """A tuft of dune grass, blades of moss and olive with gold tips."""
    w, h = 40, 32

    def draw(g, f=0):
        base = h - 2
        for x, top, c in ((6, 14, "olive"), (11, 6, "moss"), (16, 10, "olive"), (21, 4, "moss"), (26, 9, "olive"),
                          (31, 12, "moss"), (34, 18, "olive")):
            g.tri((x - 2, base + 1), (x + 2, base + 1), (x + (2 if x > 20 else -2), top), c)
            g.rect(x + (2 if x > 20 else -2), top, 1, 2, "gold")
    return w, h, draw


def storefront(wall, sign, awning):
    """A downtown storefront: a wall with an upstairs window band, a lit sign board, a striped awning,
    a tall shop window and a glass door."""
    w, h, ww, wall_h = 80, 100, 72, 92

    def draw(g, f=0):
        x0, base = 4, h - 2
        top = base - wall_h
        walls(g, x0, ww, top, base, wall)
        g.rect(x0 - 2, top - 2, ww + 4, 4, dk(wall))
        for wy in (top + 6, top + 24):
            g.rect(x0 + 4, wy, ww - 8, 12, "coal")
            for x in range(x0 + 5, x0 + ww - 6, 9):
                g.rect(x, wy + 1, 8, 10, "lake")
                g.rect(x + 1, wy + 2, 2, 2, "foam")
        g.rect(x0 + 2, top + 42, ww - 4, 12, "coal")
        g.rect(x0 + 3, top + 43, ww - 6, 10, sign)
        for x in range(x0 + 10, x0 + ww - 12, 6):
            g.rect(x, top + 46, 4, 4, "white")
        for i in range(0, ww - 4, 8):
            g.rect(x0 + 2 + i, top + 56, 4, 6, awning)
            g.rect(x0 + 6 + i, top + 56, 4, 6, "white")
        g.rect(x0 + 2, top + 62, ww - 4, 1, dk(awning))
        g.rect(x0 + 4, top + 64, 44, base - top - 64, "coal")
        g.rect(x0 + 5, top + 65, 42, base - top - 66, "cyan")
        g.rect(x0 + 7, top + 67, 10, 1, "white")
        g.rect(x0 + 52, top + 64, 16, base - top - 64, "coal")
        g.rect(x0 + 53, top + 65, 14, base - top - 65, "lake")
        g.rect(x0 + 64, base - 14, 2, 3, "lgrey")
    return w, h, draw


def transit_stop():
    """A TTC stop pole: a coal pole, a red and white stop sign at the top, a timetable box."""
    w, h = 28, 100

    def draw(g, f=0):
        base = h - 2
        g.rect(12, 6, 4, base - 5, "coal")
        g.rect(12, 6, 1, base - 5, "ash")
        g.rect(4, 6, 20, 24, "ttc")
        g.rect(6, 8, 16, 10, "white")
        g.rect(8, 11, 12, 4, "ttc")
        g.rect(6, 21, 16, 6, "white")
        g.rect(9, 40, 10, 16, "coal")
        g.rect(10, 41, 8, 14, "lgrey")
        for y in range(43, 54, 3):
            g.rect(11, y, 6, 1, "stone")
    return w, h, draw


def planter_tree():
    """A young street tree in a square granite planter, its crown maple green."""
    w, h = 52, 100

    def draw(g, f=0):
        base = h - 2
        g.rect(24, 40, 4, base - 50, "bark")
        g.ell(26, 26, 20, 22, "canopy")
        g.ell(24, 23, 16, 18, "moss")
        g.ell(25, 25, 15, 17, "olive")
        for x, y in ((30, 18, ), (18, 30), (32, 34)):
            g.ell(x, y, 3, 3, "canopy")
        g.rect(8, base - 12, 36, 13, "lgrey")
        g.rect(38, base - 12, 6, 13, "stone")
        g.rect(6, base - 14, 40, 3, "white")
        g.rect(12, base - 16, 28, 2, "bark")
    return w, h, draw


def hot_dog_stand():
    """A park hot dog stand: a red kiosk under a flat white roof, a hot dog on its sign, a yellow and white
    striped awning over the serving hatch, ketchup and mustard on the counter."""
    w, h = 60, 84

    def draw(g, f=0):
        base = h - 2
        for x in (18, 40):
            g.rect(x, 18, 2, 11, "coal")
        g.ell(30, 11, 27, 4, "dred")
        g.ell(28, 10, 23, 2, "red")
        g.ell(30, 15, 20, 5, "amber")
        g.ell(31, 17, 18, 3, "ochre")
        g.rect(11, 12, 38, 1, "tan")
        for i in range(11):
            g.rect(12 + i * 3.5, 7 + 2 * (i % 2), 2, 2, "yellow")
        g.rect(2, 28, 56, 5, "white")
        g.rect(2, 32, 56, 1, "lgrey")
        walls(g, 6, 48, 33, base, "ttc")
        for i in range(0, 48, 6):
            g.rect(6 + i, 33, 3, 7, "yellow")
            g.rect(9 + i, 33, 3, 7, "white")
        g.rect(6, 40, 48, 1, "amber")
        g.rect(10, 41, 40, 16, "coal")
        g.rect(12, 43, 12, 8, "cream")
        for y in (45, 48):
            g.rect(14, y, 8, 1, "dbrown")
        g.rect(30, 46, 16, 3, "lgrey")
        g.rect(8, 57, 44, 3, "lgrey")
        g.rect(8, 59, 44, 1, "grey")
        for x, col in ((32, "ttc"), (37, "yellow")):
            g.rect(x, 50, 3, 7, col)
            g.rect(x + 1, 48, 1, 2, col)
        g.rect(42, 53, 6, 4, "white")
        g.rect(6, 68, 48, 3, "white")
    return w, h, draw


def love_lock():
    """The Distillery's love lock heart: a red steel heart on a post, its middle a coal mesh hung with
    padlocks, on a stone plinth."""
    w, h = 52, 60

    def heart(g, r, tip, col):
        g.ell(17, 18, r, r, col)
        g.ell(35, 18, r, r, col)
        g.tri((26 - r - 9, 21), (26 + r + 9, 21), (26, tip), col)

    def span(y, r, tip):
        """The columns the inner heart covers on row y, as (x0, x1), or None."""
        xs = [x for x in range(4, 48)
              if (x + 0.5 - 17) ** 2 + (y + 0.5 - 18) ** 2 <= r * r or (x + 0.5 - 35) ** 2 + (y + 0.5 - 18) ** 2 <= r * r
              or (y + 0.5 >= 21 and abs(x + 0.5 - 26) <= (tip - y - 0.5) * (r + 9) / (tip - 21))]
        return (xs[0], xs[-1] + 1) if xs else None

    def draw(g, f=0):
        base = h - 2
        g.rect(12, base - 8, 28, 9, "stone")
        g.rect(36, base - 8, 4, 9, dk("stone"))
        g.rect(12, base - 8, 28, 1, "lgrey")
        g.rect(23, 40, 6, base - 47, "coal")
        heart(g, 12, 47, "ttc")
        g.ell(13, 13, 4, 3, "red")
        heart(g, 7, 39, "coal")
        for y in range(12, 38, 4):
            sp = span(y, 6, 38)
            if sp:
                g.rect(sp[0], y, sp[1] - sp[0], 1, "shale")
        for x in range(12, 42, 4):
            ys = [y for y in range(8, 40) if (sp := span(y, 6, 38)) and sp[0] <= x < sp[1]]
            if ys:
                g.rect(x, ys[0], 1, ys[-1] + 1 - ys[0], "shale")
        for x, y, col in ((14, 15, "gold"), (21, 20, "lgrey"), (32, 14, "turquoise"), (36, 21, "gold"),
                          (25, 27, "pink"), (18, 26, "amber"), (30, 31, "lgrey"), (25, 15, "amber")):
            g.rect(x, y + 1, 3, 3, col)
            g.rect(x + 1, y, 1, 1, "grey")
    return w, h, draw


def leuty():
    """The Leuty Lifeguard Station: a white clapboard house on driftwood stilts under a red hipped roof,
    a windowed lookout on top under its own red cap, the flag up."""
    w, h = 64, 104

    def draw(g, f=0):
        base = h - 2
        for x in (12, 30, 49):
            g.rect(x, 84, 3, base - 83, "driftwood")
        bar(g, (14, 86), (49, base - 2), "driftwood")
        g.rect(6, 82, 52, 3, "driftwood")
        g.rect(10, 50, 44, 32, "white")
        g.rect(50, 50, 4, 32, "lgrey")
        for y in range(53, 82, 4):
            g.rect(10, y, 40, 1, "lgrey")
        g.rect(24, 58, 16, 14, "dlake")
        g.rect(26, 60, 12, 10, "lake")
        g.rect(27, 61, 3, 3, "foam")
        g.rect(31, 58, 2, 14, "white")
        g.tri((4, 50), (60, 50), (48, 38), "ttc")
        g.tri((4, 50), (48, 38), (16, 38), "ttc")
        g.tri((4, 50), (16, 38), (9, 50), "red")
        g.rect(4, 48, 56, 2, "dred")
        g.rect(22, 24, 20, 14, "white")
        g.rect(38, 24, 4, 14, "lgrey")
        g.rect(25, 27, 14, 7, "dlake")
        g.rect(31, 27, 2, 7, "white")
        g.rect(26, 28, 2, 2, "foam")
        g.tri((19, 25), (45, 25), (32, 14), "ttc")
        g.tri((19, 25), (32, 14), (24, 25), "red")
        g.rect(19, 24, 26, 2, "dred")
        g.rect(31, 4, 2, 11, "coal")
        g.rect(33, 4, 9, 5, "ttc")
    return w, h, draw


# The houses' colourways, after backdrop-woof-way's row of houses: wall, roof, door.
TAN, PINK, SKY, CREAM, GREY = (("tan", "brown", "dgreen"), ("pink", "purple", "white"), ("sky", "navy", "red"),
                               ("cream", "dred", "sky"), ("lgrey", "slate", "dred"))

# key: (design w, h, draw), idle frame arguments, ms per frame, whether it stands free and casts the
# game's ground shadow.
PROPS = {
    "roadside-house-cottage": (cottage(*TAN), (0,), STILL_MS, False),
    "roadside-house-cottage-pink": (cottage(*PINK), (0,), STILL_MS, False),
    "roadside-house-tall": (two_storey(*CREAM), (0,), STILL_MS, False),
    "roadside-house-tall-grey": (two_storey(*GREY), (0,), STILL_MS, False),
    "roadside-house-porch": (porch_house(*SKY), (0,), STILL_MS, False),
    "roadside-house-porch-tan": (porch_house(*TAN), (0,), STILL_MS, False),
    "roadside-fence": (fence(), (0,), STILL_MS, False),
    "roadside-fence-cat": (fence(cat=True), (0,), STILL_MS, False),
    "roadside-hedge": (hedge(), (0,), STILL_MS, False),
    "roadside-mailbox": (mailbox(), (0,), STILL_MS, True),
    "roadside-tree": (tree(), (0,), STILL_MS, True),
    "roadside-tree-blossom": (tree("pink", "mauve", None, "white"), (0,), STILL_MS, True),
    "roadside-lamp-post": (lamp_post(), (0,), STILL_MS, True),
    "roadside-gnome": (gnome(), (0,), STILL_MS, True),
    "roadside-flowers": (flowers(), (0,), STILL_MS, False),
    "roadside-bike": (bike(), (0,), STILL_MS, True),
    "roadside-sprinkler": (sprinkler(), (0, 1), SPRAY_MS, False),
    "roadside-laundry": (laundry(), (0,), STILL_MS, False),
    "roadside-birdbath": (birdbath(), (0,), STILL_MS, True),
    "roadside-flamingos": (flamingos(), (0,), STILL_MS, True),
    "roadside-wheelbarrow": (wheelbarrow(), (0,), STILL_MS, True),
    "roadside-library": (little_library(), (0,), STILL_MS, True),
    "roadside-urn": (urn(), (0,), STILL_MS, True),
    "roadside-shrub": (shrub(), (0,), STILL_MS, True),
    "roadside-topiary": (topiary(), (0,), STILL_MS, True),
    "roadside-swing": (swing(), (0,), STILL_MS, False),
    "roadside-well": (wishing_well(), (0,), STILL_MS, True),
    "roadside-gas-lamp": (gas_lamp(), (0,), STILL_MS, True),
    "roadside-street-lamp": (street_lamp(), (0,), STILL_MS, True),
    "roadside-post-ring": (post_ring(), (0,), STILL_MS, True),
    "roadside-tree-maple": (lobed_tree("canopy", "pine", "moss"), (0,), STILL_MS, True),
    "roadside-tree-oak": (lobed_tree("pine", "fir", "canopy", "bark", big=True), (0,), STILL_MS, True),
    "roadside-tree-pine": (pine(), (0,), STILL_MS, True),
    "roadside-house-bay-gable": (bay_gable("brick", "shale", "forest"), (0,), STILL_MS, False),
    "roadside-house-bay-gable-cream": (bay_gable("cream", "dslate", "ttc"), (0,), STILL_MS, False),
    "roadside-house-bay-gable-dark": (bay_gable("dbrick", "slate", "navy"), (0,), STILL_MS, False),
    "roadside-iron-fence": (iron_fence(), (0,), STILL_MS, False),
    "roadside-trail-sign": (trail_sign(), (0,), STILL_MS, True),
    "roadside-fern": (fern(), (0,), STILL_MS, True),
    "roadside-warehouse": (warehouse("brick", "stone"), (0,), STILL_MS, False),
    "roadside-warehouse-stone": (warehouse("driftwood", "dstone"), (0,), STILL_MS, False),
    "roadside-barrels": (barrels(), (0,), STILL_MS, True),
    "roadside-market-house-turquoise": (market_house("turquoise", "dslate", "ttc", "forest"), (0,), STILL_MS, False),
    "roadside-market-house-lilac": (market_house("lilac", "violet", "amber", "navy"), (0,), STILL_MS, False),
    "roadside-market-house-lime": (market_house("lime", "dolive", "pink", "dbrick"), (0,), STILL_MS, False),
    "roadside-fruit-stand": (fruit_stand(), (0,), STILL_MS, True),
    "roadside-clothes-rack": (clothes_rack(), (0,), STILL_MS, True),
    "roadside-lifeguard-chair": (lifeguard_chair(), (0,), STILL_MS, True),
    "roadside-umbrella": (beach_umbrella("ttc", "white"), (0,), STILL_MS, True),
    "roadside-umbrella-turquoise": (beach_umbrella("turquoise", "white"), (0,), STILL_MS, True),
    "roadside-muskoka-chair": (muskoka_chair("turquoise"), (0,), STILL_MS, True),
    "roadside-muskoka-chair-red": (muskoka_chair("ttc"), (0,), STILL_MS, True),
    "roadside-dune-fence": (dune_fence(), (0,), STILL_MS, False),
    "roadside-dune-grass": (dune_grass(), (0,), STILL_MS, True),
    "roadside-house-beach": (cottage("driftwood", "dlake", "turquoise"), (0,), STILL_MS, False),
    "roadside-storefront": (storefront("ash", "lake", "turquoise"), (0,), STILL_MS, False),
    "roadside-storefront-red": (storefront("brick", "ttc", "gold"), (0,), STILL_MS, False),
    "roadside-transit-stop": (transit_stop(), (0,), STILL_MS, True),
    "roadside-planter-tree": (planter_tree(), (0,), STILL_MS, True),
    "roadside-hot-dog-stand": (hot_dog_stand(), (0,), STILL_MS, True),
    "roadside-love-lock": (love_lock(), (0,), STILL_MS, True),
    "roadside-leuty": (leuty(), (0,), STILL_MS, True),
}


def size(key, step=1):
    """A prop's frame at a depth step, in pixels."""
    w, h, _ = PROPS[key][0]
    return scaled(w, SCALE * step), scaled(h, SCALE * step)


def draw_frame(key, step, f):
    """One idle frame of a prop at a depth step, outlined, as rows of hex colours or None."""
    w, h, draw = PROPS[key][0]
    g = edged(Mini(SCALE * step, w, h))
    draw(g, f)
    fill = g.g.px
    rows = len(fill)
    if any(fill[0]) or any(fill[-1]) or any(r[0] or r[-1] for r in fill) or rows != size(key, step)[1]:
        sys.exit(f"{key} at {step}: the fill touches the frame's edge")
    return g.outlined()


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every prop at full size, then at every depth
    step."""
    for suffix, step in (("", 1),) + tuple((f"@{s}", q) for s, q in STEPS):
        for key, (_, frames, ms, _) in PROPS.items():
            yield f"{key}{suffix}", [("idle", [draw_frame(key, step, f) for f in frames], ms)]


# ---------- placement ----------
# Road px: across from the road's centre line, z along the road. The sidewalk ends at across 208
# (the street verge's walkTo, backdrops.WALK). Each prop's across is its frame's centre, set from its inner edge.

def at_inner(key, inner):
    """The across of a prop's centre, in whole road px, whose frame's inner edge is at inner or beyond."""
    return math.ceil(inner + size(key)[0] / 2)


def gap(*props):
    """(key, inner edge, dz) props, each placed with its frame's inner edge there."""
    return tuple((f"roadside-{k}", at_inner(f"roadside-{k}", inner), dz) for k, inner, dz in props)


# Per zone, by art id. slot: road px along z between one side's slots. Slot n on a side stands at
# z = n * slot; with m = n - offset, an even m is a lot and an odd m a gap, k = m // 2 counts them, and
# the side takes lots[(lotStart + k * lotStride) % len(lots)] and gaps[(gapStart + k * gapStride) %
# len(gaps)]. gap() takes each prop as (key, inner edge, dz) and resolves its across from its frame's width;
# dz is road px from the slot's z, nearer negative.
# Each table is sparse: an empty lot and six gaps, a prop in
# gaps 0 and 3, so each side has a prop every 6 slots (840 px), the neighborhood's tree then its own
# prop (High Park's hot dog stand, the Distillery's love lock heart, Kensington's fruit stand,
# The Beaches' Leuty). The right side's gapStart of 2 puts its props 3 slots after the left's, so they alternate
# sides, one every 420 px. Each neighborhood's character comes from its backdrop, verges and road,
# not from its roadside.
SIDES = dict(
    left=dict(offset=0, lotStart=0, lotStride=1, gapStart=0, gapStride=1),
    right=dict(offset=1, lotStart=0, lotStride=1, gapStart=2, gapStride=1),
)


def sparse(tree, own):
    """A sparse table: tree alone in gap 0 and own alone in gap 3, each a (key, inner edge, dz)."""
    return dict(slot=140, lots=((),), gaps=(gap(tree), (), (), gap(own), (), ()), sides=SIDES)


PLACEMENT = {
    "cabbagetown": sparse(("tree-maple", 220, 0), ("gas-lamp", 213, 0)),
    "high-park": sparse(("tree-oak", 220, 0), ("hot-dog-stand", 216, 0)),
    "distillery-district": sparse(("gas-lamp", 213, 0), ("love-lock", 216, 0)),
    "kensington-market": sparse(("tree-maple", 220, 0), ("fruit-stand", 216, 0)),
    "the-beaches": sparse(("leuty", 220, 0), ("dune-grass", 213, 0)),
    "yonge-street": sparse(("street-lamp", 213, 0), ("transit-stop", 213, 0)),
}
# Each zone's ground shadow under a free-standing prop: its lawn or paving one ramp step darker.
SHADOWS = {"cabbagetown": "canopy", "high-park": "fir", "distillery-district": "dbrown",
           "kensington-market": "coal", "the-beaches": "skin2", "yonge-street": "coal"}
# Props that stand free and take the game's ground shadow.
SHADOWED = tuple(k for k, v in PROPS.items() if v[3])
TABLE_JSON = "shared/roadside.json"


def placements(zone, side, z0, z1):
    """Every prop on one side ("left" or "right") of a zone with its z in z0..z1-1, as (z, across, key),
    from PLACEMENT as the game reads it."""
    p = PLACEMENT[zone]
    sd, slot = p["sides"][side], p["slot"]
    lo = math.floor(z0 / slot) - 2
    out = []
    for n in range(lo, math.ceil(z1 / slot) + 2):
        m = n - sd["offset"]
        k = m // 2
        props = (p["lots"][(sd["lotStart"] + k * sd["lotStride"]) % len(p["lots"])] if m % 2 == 0
                 else p["gaps"][(sd["gapStart"] + k * sd["gapStride"]) % len(p["gaps"])])
        out += [(n * slot + dz, across, key) for key, across, dz in props]
    return sorted(q for q in out if z0 <= q[0] < z1)


def check_placement():
    """Every prop's frame clears the sidewalk by at least 4 road px, and at no k do the two sides take the
    same lot or gap that holds props."""
    walk = 208
    for zone, p in PLACEMENT.items():
        for group in p["lots"] + p["gaps"]:
            for key, across, _ in group:
                inner = across - size(key)[0] / 2
                if inner < walk + 4:
                    sys.exit(f"{zone}: {key} at across {across} has its inner edge at {inner}")
        left, right = p["sides"]["left"], p["sides"]["right"]
        for kind in ("lot", "gap"):
            groups = p[f"{kind}s"]
            n = len(groups)
            for k in range(n):
                a, b = ((sd[f"{kind}Start"] + k * sd[f"{kind}Stride"]) % n for sd in (left, right))
                if a == b and groups[a]:
                    sys.exit(f"{zone}: the sides take the same {kind} in step")


def table():
    """The placement table as JSON, with the shadowed keys."""
    check_placement()
    out = {}
    for zone, p in PLACEMENT.items():
        def props(group):
            return [{"key": k, "across": a, "dz": dz} for k, a, dz in group]
        out[zone] = {"slot": p["slot"], "lots": [props(g) for g in p["lots"]], "gaps": [props(g) for g in p["gaps"]],
                     "sides": p["sides"], "shadowColour": K[SHADOWS[zone]]}
    return {"shadowed": list(SHADOWED), "zones": out}


def write_table():
    """Write the placement table to TABLE_JSON, as table prints it, for the game to read."""
    with open(TABLE_JSON, "w") as f:
        f.write(json.dumps(table(), indent=2) + "\n")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "table":
        print(json.dumps(table(), indent=2))
    elif sys.argv[1:] == ["table", "--write"]:
        write_table()
    else:
        check_placement()
        main(sys.argv, sprites, "art/roadside", __doc__, grounds=GROUNDS)
        if sys.argv[1:] == ["build"]:
            write_table()
