#!/usr/bin/env python3
"""Draw the minor obstacles: things the pack bumps into with no card. Each
spans whole lanes of the 64px road lanes: an n-lane obstacle is 64n-24 px wide,
leaving a 12px margin in its cells like the 40x40 road sprites.

They are billboards seen from a low camera, as roadside objects in OutRun are:
a front elevation (or a car from straight behind), squat, with at most a sliver
of top surface and never its length along the road. The game scales each one
by distance with its base on the road line.

cone                40x40   1 lane, a glint runs down its highlight
bin                 40x40   1 lane, the lid lifts in a breeze
hydrant             40x40   the Regular dog's need spot (not an obstacle), a drip off the side cap
bench               104x30  2 lanes, backrest and seat edge on short legs; a leaf on the seat stirs
barrier-2           104x30  2 lanes, a striped rail and plank on short legs; lamps blink (Elm Avenue,
                            Main Street)
barrier-3           168x30  3 lanes, lamps blink
hedge               168x30  3 lanes, a low hedge with a rounded, clumped top; leaves rustle at three
                            spots in turn
parked-car          56x35   1 lane by 3 rows of footprint, a minivan from straight behind, drawn at the
                            footprint's near edge; hazards blink. 56 wide, so it centres on its lane
                            with 4px to spare each side. pull-out (4 frames, 100ms): drawn pulling
                            right (the game mirrors it for left), tread lines climb the tyres and the
                            right indicator blinks amber

Every obstacle has a looping idle, so nothing on the road is frozen. Each idle
frame is one argument to the drawing function, listed in the *_IDLE tuples;
frame 0 is the rest pose. The drawings are in the full size's pixels; minis.py
and depths.py run them on a minis.Mini for the depth variants.

Usage:
  obstacles.py preview OUT.png   every obstacle on the street colours
  obstacles.py build             write art/obstacles/*.aseprite and export to
                                 public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import K, ROADS, Grid, edged, main, road_edge  # noqa: E402
from road import LIT, rim  # noqa: E402

# A road sprite's frame and a lane-spanning obstacle's width and height.
SIZE = 40
ROW = 30


def span(lanes):
    """The width of an obstacle across lanes lanes of 64px, 12px clear of each outer lane edge."""
    return 64 * lanes - 24


def lit(g):
    """road.rim with road.LIT on the grid that holds the pixels (a minis.Mini draws onto g.g), so the small
    versions get the rim at their own size."""
    rim(getattr(g, "g", g), LIT)
    return g


def raster(g):
    """(the grid holding g's pixels, its scale, the pixel edge of a full-size coordinate on it)."""
    s = getattr(g, "s", 1)
    return getattr(g, "g", g), s, lambda v: math.floor(v * s + 0.5)


def cone(glint=None):
    """glint is the row of the highlight that flashes white, or None. The two reflective bands are cut
    into the drawn cone, so a depth variant keeps both whole at its own size."""
    g = edged(Grid(SIZE, SIZE))
    # squat: a wide base plate, grey, not dslate, which is Elm Avenue's road colour
    g.rect(9, 31, 22, 5, "grey")
    g.rect(9, 31, 22, 1, "lgrey")
    g.tri((11, 32.5), (29, 32.5), (20, 7.5), "orange")
    g.tri((20, 32.5), (29, 32.5), (20, 7.5), "rust")
    px, s, edge = raster(g)
    mid = edge(20)
    cone_px = (K["orange"], K["rust"])
    for top in (15, 24):
        for y in range(edge(top), max(edge(top) + 1, edge(top + 4))):
            for x in range(px.w):
                if px.px[y][x] in cone_px:
                    px.p(x, y, "white" if x < mid else "lgrey")
    # the highlight runs just left of the centre line
    px.rect(mid - 1, edge(9), 1, edge(14) - edge(9), "amber")
    if glint is not None:
        px.p(mid - 1, edge(glint), "white")
    return g


def bin_(lift=0):
    """lift raises the lid and handle (negative is up), showing the dark gap under the lid. The forest
    body takes a green rim on its top-left edges, the ink wheels and handle a grey one."""
    g = edged(Grid(SIZE, SIZE))
    g.rect(12, 33, 4, 4, "ink")
    g.rect(24, 33, 4, 4, "ink")
    # the body tapers to its foot; its right half is in shade
    g.tri((10, 13), (30, 13), (27.5, 34), "dgreen")
    g.tri((10, 13), (12.5, 34), (27.5, 34), "dgreen")
    g.tri((20, 13), (30, 13), (27.5, 34), "forest")
    g.tri((20, 13), (20, 34), (27.5, 34), "forest")
    for x in (13, 16):
        g.rect(x, 16, 1, 14, "green")
    if lift:
        g.rect(10, 14 + lift, 20, -lift, "ink")
    g.rect(9, 8 + lift, 22, 6, "dgreen")
    g.rect(9, 8 + lift, 22, 1, "green")
    g.rect(20, 9 + lift, 11, 5, "forest")
    g.rect(16, 5 + lift, 8, 3, "ink")
    return lit(g)


def hydrant(drip=0):
    """drip: 1 a bead under the left cap, 2 the bead stretched to fall, 3 a drop landed beside the base.
    The red body takes a pink rim on its top-left edges."""
    g = edged(Grid(SIZE, SIZE))
    g.rect(11, 33, 18, 4, "dred")
    g.rect(11, 33, 18, 1, "red")
    g.rect(14, 14, 12, 19, "red")
    g.rect(21, 14, 5, 19, "dred")
    g.rect(15, 14, 2, 19, "pink")
    g.ell(20, 14, 7.5, 5.5, "red", "dred", "pink")
    g.rect(18, 5, 4, 4, "dred")
    g.rect(12, 11, 16, 3, "dred")
    g.rect(7, 19, 6, 6, "red")
    g.rect(27, 19, 6, 6, "dred")
    g.rect(6, 20, 2, 4, "lgrey")
    g.rect(32, 20, 2, 4, "grey")
    g.rect(18, 20, 4, 4, "dred")
    g.rect(19, 21, 2, 2, "lgrey")
    if drip in (1, 2):
        g.rect(6, 24, 1, drip, "cyan")
    elif drip == 3:
        g.rect(5, 36, 2, 1, "cyan")
    return lit(g)


def bench(leaf=(0, 0), w=span(2)):
    """From behind, low: the backrest (two slats) and the seat's front edge as bands on short legs. leaf
    offsets the fallen leaf on the seat edge; None leaves it off. Each slat is a 2-row tan top over a
    3-row brown face, with a 2-row plum gap between them."""
    g = edged(Grid(w, ROW))
    # legs, behind everything: short, slate lit on the left
    for x in (12, w - 17):
        g.rect(x, 2, 5, 27, "dslate")
        g.rect(x, 2, 2, 27, "slate")
    # backrest: two slats with a plum gap, the uprights showing through it
    g.rect(4, 7, w - 8, 2, "plum")
    for y in (2, 9):
        g.rect(4, y, w - 8, 2, "tan")
        g.rect(4, y + 2, w - 8, 3, "brown")
    for x in (round(w * 20 / 88), w // 2 - 1, round(w * 68 / 88) - 2):
        g.rect(x, 4, 2, 7, "dbrown")
    # the seat's edge, wider than the backrest, with a plum shadow line over it
    g.rect(2, 14, w - 4, 2, "plum")
    g.rect(2, 16, w - 4, 3, "tan")
    g.rect(2, 19, w - 4, 3, "brown")
    if leaf:
        x, y = round(w * 0.64) + leaf[0], 15 + leaf[1]
        g.rect(x, y, 4, 1, "amber")
        g.rect(x + 1, y + 1, 4, 1, "orange")
        g.p(x + 5, y + 1, "rust")
    return g


def hedge(w=span(3), rustle=()):
    """Low and wide, seen side on: a rounded top edge of leaf clumps, no top surface, lit green on its
    top-left edges. rustle lists the top clumps, by index, that lift 1px and shift 1px right."""
    g = edged(Grid(w, ROW))
    g.rect(4, 11, w - 8, 18, "forest")
    g.rect(1, 14, w - 2, 10, "forest")
    g.rect(4, 25, w - 8, 4, "teal")
    # the rounded top: a clump every 10px, alternately higher, lit green on the upper left
    for i, x in enumerate(range(9, w - 7, 10)):
        r = 1 if i in rustle else 0
        y = 10 - (i % 2) - r
        g.ell(x + r, y + 1, 6, 5.5, "dgreen", "forest", "green")
        if i % 3 == 0:
            g.p(x - 2 + r, y - 1, "yellow")
    # the rounded ends
    for x in (6, w - 6):
        g.ell(x, 18, 5, 9, "forest")
    # leaf texture lower down, dgreen clumps and teal hollows, spaced irregularly
    for i, x in enumerate(range(7, w - 7, 9)):
        g.ell(x + 2, 16 + (i * 3) % 4, 2.5, 2, "dgreen")
        g.p(x, 21 + (i * 2) % 3, "teal")
    return lit(g)


def white_keyline(c):
    """road_edge, but white rails take a plum keyline (6.5:1 or more on the light roads) for road_edge's dslate."""
    return K["plum"] if c == K["white"] else road_edge(c)


def barrier(lanes, f):
    """Front elevation, squat: a striped rail over a striped plank on short legs, a lamp on each top
    corner; f swaps which lamp is lit. The rail is 10 rows and the plank 6, each in 2-row stairs, striped
    10px orange every 20px and leaning right 2px a stair; the bottom stair of each is its shaded lower
    edge."""
    w = span(lanes)
    g = edged(Grid(w, ROW), white_keyline)
    for x in (5, w - 10):
        g.rect(x, 5, 5, 24, "grey")
        g.rect(x + 3, 5, 2, 24, "slate")
        g.rect(x - 2, 26, 9, 3, "dslate")
        g.rect(x - 2, 26, 9, 1, "slate")
    for top, stairs in ((5, 5), (19, 3)):
        for k in range(stairs):
            base, stripe = ("lgrey", "rust") if k == stairs - 1 else ("white", "orange")
            y = top + 2 * k
            g.rect(1, y, w - 2, 2, base)
            for x in range(-10 - 2 * k, w - 1, 20):
                g.rect(max(x, 1), y, min(x + 10, w - 1) - max(x, 1), 2, stripe)
    for i, x in enumerate((7.5, w - 7.5)):
        on = (i == 0) == bool(f)
        g.ell(x, 4, 3, 3, "amber" if on else "orange", "orange", "yellow" if on else None)
    return g


def parked_car(hazard=False, roll=None):
    """A minivan from straight behind, wide and low: the roof edge, the rear window, the tailgate with its
    tail lights and plate, the bumper and both rear wheels under it, mirrors poking out at the sides. Its
    hazard lights, the outer end of each tail light, are lit when hazard is true. Cyan lights the top and
    left edges, so the sky body holds on Elm Avenue. roll (0 to 3) is a pull-out frame: tread lines climb
    the tyres 1px a frame (treads), and the right indicator is lit on frames 0 and 1."""
    g = edged(Grid(56, 35))
    # rear wheels, under the body at either side
    for x in (5, 42):
        g.rect(x, 25, 9, 9, "ink")
        g.rect(x, 25, 2, 8, "dslate")
    # roof edge and rear window, narrower than the body
    g.rect(10, 1, 36, 3, "sky")
    g.rect(10, 1, 36, 1, "cyan")
    g.tri((8, 14), (10, 4), (10, 14), "sky")
    g.tri((48, 14), (46, 4), (46, 14), "blue")
    g.rect(10, 4, 36, 10, "navy")
    g.tri((14, 13), (20, 5), (25, 5), "slate")
    g.p(8, 13, "cyan")
    g.p(9, 4, "cyan")
    # mirrors at the window's base
    g.rect(3, 11, 5, 3, "blue")
    g.rect(3, 11, 5, 1, "sky")
    g.rect(48, 11, 5, 3, "blue")
    # tailgate: lit along the top and the left, shaded on the right
    g.rect(4, 14, 48, 11, "sky")
    g.rect(4, 14, 48, 1, "cyan")
    g.rect(4, 14, 1, 11, "cyan")
    g.rect(48, 15, 4, 10, "blue")
    for x in (5, 42):
        g.rect(x, 16, 9, 5, "red")
        g.rect(x, 16, 9, 1, "pink")
        g.rect(x, 20, 9, 1, "dred")
    if hazard:
        for x in (5, 48):
            g.rect(x, 16, 3, 4, "amber")
            g.rect(x, 16, 3, 1, "yellow")
    g.rect(22, 18, 12, 5, "lgrey")
    g.rect(24, 20, 8, 1, "grey")
    g.rect(25, 15, 6, 1, "lgrey")
    # bumper across the full width
    g.rect(3, 25, 50, 4, "dslate")
    g.rect(3, 25, 50, 1, "slate")
    g.rect(3, 25, 1, 4, "grey")
    if roll is not None:
        for x in (5, 42):
            treads(g, x + 2, 29, 7, 5, roll, 1 / getattr(g, "s", 1))
        if roll < 2:
            g.rect(48, 16, 3, 4, "amber")
            g.rect(48, 16, 3, 1, "yellow")
    return g


def treads(g, x, y, w, h, f, u=1, back=False):
    """Tread lines across a tyre seen from behind, rows y to y + h - 1: one every 4u rows, climbing u a frame
    as the tyre rolls away (frame f of 4), or falling when back (reversing), so the loop is seamless. u is
    one pixel at the drawn size."""
    for k in range(-1, round(h / u) // 4 + 2):
        ty = y + ((f if back else 3 - f) + 4 * k) * u
        if y <= ty and ty + u <= y + h + 1e-9:
            g.rect(x, ty, w, 1, "dslate")


# Idle frames, one drawing argument each, and their duration in ms. Most hold the rest pose for
# two frames so the motion comes as a short event rather than a constant flicker.
CONE_IDLE = (None, None, 9, 11), 400
BIN_IDLE = (0, 0, -1, 0), 400
HYDRANT_IDLE = (0, 1, 2, 3), 450
BENCH_IDLE = ((0, 0), (0, 0), (1, -1), (0, 0)), 450
HEDGE_IDLE = ((), (5,), (10,), (15,)), 350
PARKED_CAR_IDLE = (False, True), 500
# The pull-out: 4 frames of parked_car's roll, and their duration in ms.
PULL_OUT = range(4), 100


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    def idle(draw, spec):
        args, ms = spec
        return [("idle", [draw(a).outlined() for a in args], ms)]

    yield "cone", idle(cone, CONE_IDLE)
    yield "bin", idle(bin_, BIN_IDLE)
    yield "hydrant", idle(hydrant, HYDRANT_IDLE)
    yield "bench", idle(bench, BENCH_IDLE)
    yield "hedge", idle(lambda r: hedge(rustle=r), HEDGE_IDLE)
    for lanes in (2, 3):
        yield f"barrier-{lanes}", [("idle", [barrier(lanes, f).outlined() for f in (0, 1)], 500)]
    args, ms = PULL_OUT
    yield "parked-car", idle(parked_car, PARKED_CAR_IDLE) + [
        ("pull-out", [parked_car(roll=f).outlined() for f in args], ms)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/obstacles", __doc__, grounds=ROADS)
