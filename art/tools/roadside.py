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

Every prop has one tag, `idle`: one frame of 1000ms, or the sprinkler's two. Every other prop is
static: one frame, no motion. PLACEMENT places static props only. The ground row is the
last opaque row; the frame keeps a clear ring for the outline. Outlines are road_edge; there is no
light rim (road.LIT), since the props stand on the lawn, never on the road.

PLACEMENT holds the per-zone placement table (see the style guide's Roadside section); `table`
prints it as JSON with every prop's across offset resolved, for the game. It places only the odd
street tree: most of the props are drawn but not placed.

Usage:
  roadside.py preview OUT.png   every frame on green, dgreen and Elm Avenue's road
  roadside.py build             write art/roadside/*.aseprite and export to public/art/sprites/
  roadside.py table             print the placement table as JSON
  roadside.py table --write     write it to shared/roadside.json, which the game reads

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
RAKE = dict(brown="tan", dred="red", navy="dslate", purple="mauve", slate="grey")


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
# (layout.json verges.street.walkTo). Each prop's across is its frame's centre, set from its inner edge.

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
# The verges stay mostly bare lawn: a lot is empty and one gap in three holds a single street tree, so each
# side has a tree every 6 slots (840 px). The right side's gapStart of 2 puts its trees 3 slots after the
# left's, so the trees alternate sides, one every 420 px, and one is always in view.
PLACEMENT = {
    "woof-way": dict(
        slot=140,
        lots=((),),
        gaps=(
            gap(("tree", 220, 0)), (), (),
            gap(("tree-blossom", 220, 0)), (), (),
        ),
        sides=dict(
            left=dict(offset=0, lotStart=0, lotStride=1, gapStart=0, gapStride=1),
            right=dict(offset=1, lotStart=0, lotStride=1, gapStart=2, gapStride=1),
        ),
    ),
}
# Props that stand free and take the game's ground shadow.
SHADOWED = tuple(k for k, v in PROPS.items() if v[3])
SHADOW_COLOUR = "dgreen"
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
    """The placement table as JSON, with the shadowed keys and the shadow colour."""
    check_placement()
    out = {}
    for zone, p in PLACEMENT.items():
        def props(group):
            return [{"key": k, "across": a, "dz": dz} for k, a, dz in group]
        out[zone] = {"slot": p["slot"], "lots": [props(g) for g in p["lots"]], "gaps": [props(g) for g in p["gaps"]],
                     "sides": p["sides"]}
    return {"shadowColour": K[SHADOW_COLOUR], "shadowed": list(SHADOWED), "zones": out}


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "table":
        print(json.dumps(table(), indent=2))
    elif sys.argv[1:] == ["table", "--write"]:
        with open(TABLE_JSON, "w") as f:
            f.write(json.dumps(table(), indent=2) + "\n")
    else:
        check_placement()
        main(sys.argv, sprites, "art/roadside", __doc__, grounds=GROUNDS)
