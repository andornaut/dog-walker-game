#!/usr/bin/env python3
"""Draw the minor obstacles: things the pack bumps into with no card. Each
spans whole lanes of the road: an n-lane obstacle is 56n-24 px wide, leaving a
12px margin in its cells like the 32x32 road sprites.

They are billboards seen from a low camera, as roadside objects in OutRun are:
a front elevation (or a car from straight behind), squat, with at most a sliver
of top surface and never its length along the road. The game scales each one
by distance with its base on the road line.

cone                32x32   1 lane, a glint runs down its highlight
bin                 32x32   1 lane, the lid lifts in a breeze
hydrant             32x32   the Regular dog's need spot (not an obstacle), a drip off the side cap
bench               88x24   2 lanes, backrest and seat edge on short legs; a leaf on the seat stirs
barrier-2           88x24   2 lanes, a striped rail and plank on short legs; lamps blink (Woof Way,
                            Sniff Street Shops)
barrier-3           144x24  3 lanes, lamps blink
hedge               144x24  3 lanes, a low hedge with a rounded, clumped top; leaves rustle at three
                            spots in turn
parked-car          44x28   1 lane by 3 rows of footprint, a minivan from straight behind, drawn at the
                            footprint's near edge; hazards blink

Every obstacle has a looping idle, so nothing on the road is frozen. Each idle
frame is one argument to the drawing function, listed in the *_IDLE tuples;
frame 0 is the rest pose.

Usage:
  obstacles.py preview OUT.png   every obstacle on the street colours
  obstacles.py build             write art/obstacles/*.aseprite and export to
                                 public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import K, ROADS, Grid, edged, main, road_edge  # noqa: E402
from road import LIT, rim  # noqa: E402


def lit(g):
    """road.rim with road.LIT on the grid that holds the pixels (a minis.Mini draws onto g.g), so the small
    versions get the rim at their own size."""
    rim(getattr(g, "g", g), LIT)
    return g


def cone(glint=None):
    """glint is the row of the highlight that flashes white, or None."""
    g = edged(Grid())
    # squat: a wide base plate, grey, not dslate, which is Woof Way's road colour
    g.rect(7, 25, 18, 4, "grey")
    g.rect(7, 25, 18, 1, "lgrey")
    g.tri((9, 26), (23, 26), (16, 6), "orange")
    g.tri((16, 26), (23, 26), (16, 6), "rust")
    for y, h in ((12, 3), (19, 3)):
        for x in range(32):
            for yy in range(y, y + h):
                if g.px[yy][x]:
                    g.p(x, yy, "white" if x < 16 else "lgrey")
    g.rect(15, 7, 1, 4, "amber")
    if glint is not None:
        g.p(15, glint, "white")
    return g


def bin_(lift=0):
    """lift raises the lid and handle (negative is up), showing the dark gap under the lid. The forest
    body takes a green rim on its top-left edges, the ink wheels and handle a grey one."""
    g = edged(Grid())
    g.rect(10, 26, 3, 3, "ink")
    g.rect(19, 26, 3, 3, "ink")
    g.tri((8, 10), (24, 10), (22, 27), "dgreen")
    g.tri((8, 10), (10, 27), (22, 27), "dgreen")
    g.rect(16, 10, 7, 17, "forest")
    g.rect(16, 10, 8, 1, "forest")
    for x in (11, 14):
        g.rect(x, 13, 1, 11, "green")
    if lift:
        g.rect(8, 11 + lift, 16, -lift, "ink")
    g.rect(7, 6 + lift, 18, 5, "dgreen")
    g.rect(7, 6 + lift, 18, 1, "green")
    g.rect(16, 7 + lift, 9, 4, "forest")
    g.rect(13, 4 + lift, 6, 2, "ink")
    return lit(g)


def hydrant(drip=0):
    """drip: 1 a bead under the left cap, 2 the bead stretched to fall, 3 a drop landed beside the base.
    The red body takes a pink rim on its top-left edges."""
    g = edged(Grid())
    g.rect(9, 26, 14, 3, "dred")
    g.rect(9, 26, 14, 1, "red")
    g.rect(11, 11, 10, 15, "red")
    g.rect(17, 11, 4, 15, "dred")
    g.rect(12, 11, 2, 15, "pink")
    g.ell(16, 11, 6, 4.5, "red", "dred", "pink")
    g.rect(14, 4, 4, 3, "dred")
    g.rect(10, 9, 12, 2, "dred")
    g.rect(6, 15, 5, 5, "red")
    g.rect(21, 15, 5, 5, "dred")
    g.rect(5, 16, 2, 3, "lgrey")
    g.rect(25, 16, 2, 3, "grey")
    g.rect(14, 16, 4, 4, "dred")
    g.rect(15, 17, 2, 2, "lgrey")
    if drip in (1, 2):
        g.rect(5, 19, 1, drip, "cyan")
    elif drip == 3:
        g.rect(4, 28, 2, 1, "cyan")
    return lit(g)


def bench(leaf=(0, 0)):
    """From behind, low: the backrest (two slats) and the seat's front edge as two bands on short legs.
    leaf offsets the fallen leaf on the seat edge; None leaves it off. Slats are 4 rows with 2-row plum
    gaps, and every tone band is 2px on even pixels, so each slat and gap survives 0.5x."""
    g = edged(Grid(88, 24))
    # legs, behind everything: short, slate lit on the left
    for x in (10, 74):
        g.rect(x, 2, 4, 21, "dslate")
        g.rect(x, 2, 2, 21, "slate")
    # backrest: two slats with a plum gap, the uprights showing through it
    g.rect(4, 6, 80, 2, "plum")
    for y in (2, 8):
        g.rect(4, y, 80, 2, "tan")
        g.rect(4, y + 2, 80, 2, "brown")
    for x in (20, 44, 68):
        g.rect(x, 4, 2, 6, "dbrown")
    # the seat's edge, wider than the backrest, with a plum shadow line over it
    g.rect(2, 12, 84, 2, "plum")
    g.rect(2, 14, 84, 2, "tan")
    g.rect(2, 16, 84, 2, "brown")
    if leaf:
        x, y = 56 + leaf[0], 13 + leaf[1]
        g.rect(x, y, 3, 1, "amber")
        g.rect(x + 1, y + 1, 3, 1, "orange")
        g.p(x + 4, y + 1, "rust")
    return g


def hedge(w=144, rustle=()):
    """Low and wide, seen side on: a rounded top edge of leaf clumps, no top surface, lit green on its
    top-left edges. rustle lists the top clumps, by index, that lift 1px and shift 1px right."""
    g = edged(Grid(w, 24))
    g.rect(3, 9, w - 6, 14, "forest")
    g.rect(1, 11, w - 2, 8, "forest")
    g.rect(3, 20, w - 6, 3, "teal")
    # the rounded top: a clump every 8px, alternately higher, lit green on the upper left
    for i, x in enumerate(range(7, w - 6, 8)):
        r = 1 if i in rustle else 0
        y = 8 - (i % 2) - r
        g.ell(x + r, y + 1, 5, 4.5, "dgreen", "forest", "green")
        if i % 3 == 0:
            g.p(x - 2 + r, y - 1, "yellow")
    # the rounded ends
    for x in (5, w - 5):
        g.ell(x, 14, 4, 7, "forest")
    # leaf texture lower down, dgreen clumps and teal hollows, spaced irregularly
    for i, x in enumerate(range(6, w - 6, 7)):
        g.ell(x + 2, 13 + (i * 5) % 5, 2, 1.5, "dgreen")
        g.p(x, 17 + (i * 2) % 3, "teal")
    return lit(g)


def white_keyline(c):
    """road_edge, but white rails take a plum keyline (6.5:1 or more on the light roads) for road_edge's dslate."""
    return K["plum"] if c == K["white"] else road_edge(c)


def barrier(lanes, f):
    """Front elevation, squat: a striped rail over a striped plank on short legs, a lamp on each top
    corner; f swaps which lamp is lit. The rail is 8 rows and the plank 4, each from a row divisible by 4,
    striped 8px orange every 16px and leaning right in 2px stairs, so each stripe keeps its width at 0.75x
    and 0.5x."""
    w = 56 * lanes - 24
    g = edged(Grid(w, 24), white_keyline)
    for x in (4, w - 8):
        g.rect(x, 4, 4, 19, "grey")
        g.rect(x + 2, 4, 2, 19, "slate")
        g.rect(x - 2, 21, 8, 2, "dslate")
        g.rect(x - 2, 21, 8, 1, "slate")
    for top, stairs in ((4, 4), (16, 2)):
        # the bottom stair is the rail's shaded lower edge
        for k in range(stairs):
            base, stripe = ("lgrey", "rust") if k == stairs - 1 else ("white", "orange")
            y = top + 2 * k
            g.rect(1, y, w - 2, 2, base)
            for x in range(-8 - 2 * k, w - 1, 16):
                g.rect(max(x, 1), y, min(x + 8, w - 1) - max(x, 1), 2, stripe)
    for i, x in enumerate((6, w - 7)):
        on = (i == 0) == bool(f)
        g.ell(x, 3, 2.5, 2.5, "amber" if on else "orange", "orange", "yellow" if on else None)
    return g


def parked_car(hazard=False):
    """A minivan from straight behind, wide and low: the roof edge, the rear window, the tailgate with its
    tail lights and plate, the bumper and both rear wheels under it, mirrors poking out at the sides. Its
    hazard lights, the outer end of each tail light, are lit when hazard is true. Cyan lights the top and
    left edges, so the sky body holds on Woof Way."""
    g = edged(Grid(44, 28))
    # rear wheels, under the body at either side
    for x in (4, 33):
        g.rect(x, 20, 7, 7, "ink")
        g.rect(x, 20, 2, 6, "dslate")
    # roof edge and rear window, narrower than the body
    g.rect(8, 1, 28, 2, "sky")
    g.rect(8, 1, 28, 1, "cyan")
    g.tri((6, 11), (8, 3), (8, 11), "sky")
    g.tri((38, 11), (36, 3), (36, 11), "blue")
    g.rect(8, 3, 28, 8, "navy")
    g.tri((11, 10), (16, 4), (20, 4), "slate")
    g.p(6, 10, "cyan")
    g.rect(7, 3, 1, 1, "cyan")
    # mirrors at the window's base
    g.rect(2, 9, 4, 2, "blue")
    g.rect(2, 9, 4, 1, "sky")
    g.rect(38, 9, 4, 2, "blue")
    # tailgate: lit along the top and the left, shaded on the right
    g.rect(3, 11, 38, 9, "sky")
    g.rect(3, 11, 38, 1, "cyan")
    g.rect(3, 11, 1, 9, "cyan")
    g.rect(38, 12, 3, 8, "blue")
    for x in (4, 33):
        g.rect(x, 13, 7, 4, "red")
        g.rect(x, 13, 7, 1, "pink")
        g.rect(x, 16, 7, 1, "dred")
    if hazard:
        for x in (4, 38):
            g.rect(x, 13, 2, 3, "amber")
            g.rect(x, 13, 2, 1, "yellow")
    g.rect(17, 14, 10, 4, "lgrey")
    g.rect(19, 15, 6, 1, "grey")
    g.rect(20, 12, 4, 1, "lgrey")
    # bumper across the full width
    g.rect(2, 20, 40, 3, "dslate")
    g.rect(2, 20, 40, 1, "slate")
    g.rect(2, 20, 1, 3, "grey")
    return g


# Idle frames, one drawing argument each, and their duration in ms. Most hold the rest pose for
# two frames so the motion comes as a short event rather than a constant flicker.
CONE_IDLE = (None, None, 7, 8), 400
BIN_IDLE = (0, 0, -1, 0), 400
HYDRANT_IDLE = (0, 1, 2, 3), 450
BENCH_IDLE = ((0, 0), (0, 0), (1, -1), (0, 0)), 450
HEDGE_IDLE = ((), (5,), (10,), (15,)), 350
PARKED_CAR_IDLE = (False, True), 500


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
    yield "parked-car", idle(parked_car, PARKED_CAR_IDLE)


if __name__ == "__main__":
    main(sys.argv, sprites, "art/obstacles", __doc__, grounds=ROADS)
