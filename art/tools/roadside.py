#!/usr/bin/env python3
"""Draw the roadside props: the houses, fences, trees and yard clutter on the lawns beyond the
sidewalks, and hold the per-zone table that places them.

They are road sprites in the OutRun manner: front elevations (the bike side on), anchored bottom
centre on their road row, scaled with the road camera and drawn back to front with the road objects.
Every prop's inner edge lies beyond the sidewalk, so none stands on a lane or a sidewalk, and none
is a person, a live animal on the ground, a coin or a bone, so none reads as an obstacle, an
encounter or a pickup. The lamp post is a white globe on a green post with a flower basket, unlike
the navy lantern of the need spot `spot-lamp-post`; the street tree is three round lobes, unlike
`spot-tree`'s blocky crown; the hedge is bumped and in flower, unlike the obstacle `hedge`; the
flower border has no box, unlike `petunias`; the gnome wears a blue hat and a red coat, unlike
`minor-gnome`; the mailbox is blue with a yellow flag, unlike the red hydrant.

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
roadside-sprinkler           78x42    a lawn sprinkler's fan of water; idle 2 frames x 200ms
roadside-laundry             162x96   a washing line on two T posts: a shirt, a sheet, socks, a dress

Every prop has one tag, `idle`: one frame of 1000ms, or the sprinkler's two. The ground row is the
last opaque row; the frame keeps a clear ring for the outline. Outlines are road_edge; there is no
light rim (road.LIT), since the props stand on the lawn, never on the road.

PLACEMENT holds the per-zone placement table (see the style guide's Roadside section); `table`
prints it as JSON with every prop's across offset resolved, for the game.

Usage:
  roadside.py preview OUT.png   every frame on green, dgreen and Elm Avenue's road
  roadside.py build             write art/roadside/*.aseprite and export to public/art/sprites/
  roadside.py table             print the placement table as JSON

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

HOUSE_IN = 220      # a house's inner edge
FRONT_IN = 224      # a fence's or hedge's inner edge
FRONT_DZ = -32      # the fence or hedge stands this far nearer than its house


def at_inner(key, inner):
    """The across of a prop's centre, in whole road px, whose frame's inner edge is at inner or beyond."""
    return math.ceil(inner + size(key)[0] / 2)


def lot(house, front, *extras):
    """A lot: the house at its slot, the fence or hedge in front, then (key, inner edge, dz) extras."""
    return ((f"roadside-{house}", at_inner(f"roadside-{house}", HOUSE_IN), 0),
            (f"roadside-{front}", at_inner(f"roadside-{front}", FRONT_IN), FRONT_DZ),
            *gap(*extras))


def gap(*props):
    """(key, inner edge, dz) props, each placed with its frame's inner edge there."""
    return tuple((f"roadside-{k}", at_inner(f"roadside-{k}", inner), dz) for k, inner, dz in props)


# Per zone, by art id. slot: road px along z between one side's slots. Slot n on a side stands at
# z = n * slot; with m = n - offset, an even m is a lot and an odd m a gap, k = m // 2 counts them, and
# the side takes lots[(lotStart + k * lotStride) % len(lots)] and gaps[(gapStart + k * gapStride) %
# len(gaps)]. The right side's offset of one slot puts a gap across from every lot. Each extra prop is (key,
# inner edge, dz), its across resolved from its frame's width: dz is road px from the slot's z, nearer
# negative.
PLACEMENT = {
    "woof-way": dict(
        slot=140,
        lots=(
            lot("house-cottage", "fence", ("mailbox", 213, -38), ("flowers", 250, -42)),
            lot("house-tall", "hedge", ("mailbox", 213, -38), ("gnome", 250, -15)),
            lot("house-porch", "fence-cat", ("bike", 231, -45)),
            lot("house-cottage-pink", "fence", ("mailbox", 213, -38), ("sprinkler", 275, -15)),
            lot("house-tall-grey", "fence", ("gnome", 260, -15)),
            lot("house-porch-tan", "hedge", ("mailbox", 213, -38), ("flowers", 255, -42)),
        ),
        gaps=(
            gap(("tree", 213, 0)),
            gap(("lamp-post", 213, -12), ("tree-blossom", 245, 12)),
            gap(("laundry", 232, 0)),
            gap(("tree", 220, 0), ("lamp-post", 213, -38)),
            gap(("tree-blossom", 215, 0)),
        ),
        sides=dict(
            left=dict(offset=0, lotStart=0, lotStride=1, gapStart=0, gapStride=2),
            right=dict(offset=1, lotStart=3, lotStride=5, gapStart=1, gapStride=3),
        ),
    ),
}
# Props that stand free and take the game's ground shadow.
SHADOWED = tuple(k for k, v in PROPS.items() if v[3])
SHADOW_COLOUR = "dgreen"


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
    """Every prop's frame clears the sidewalk by at least 4 road px, and no slot holds the same lot or gap
    on both sides."""
    walk = 208
    for zone, p in PLACEMENT.items():
        for group in p["lots"] + p["gaps"]:
            for key, across, _ in group:
                inner = across - size(key)[0] / 2
                if inner < walk + 4:
                    sys.exit(f"{zone}: {key} at across {across} has its inner edge at {inner}")
        left, right = p["sides"]["left"], p["sides"]["right"]
        n = len(p["lots"])
        if any((left["lotStart"] + k * left["lotStride"]) % n == (right["lotStart"] + k * right["lotStride"]) % n
               for k in range(n)):
            sys.exit(f"{zone}: the sides take the same lot in step")


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
    else:
        check_placement()
        main(sys.argv, sprites, "art/roadside", __doc__, grounds=GROUNDS)
