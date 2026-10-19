#!/usr/bin/env python3
"""Draw the minor obstacles: things the pack bumps into with no card. Each
spans whole lanes and rows of the road; an n-lane obstacle is 56n-24 px wide
and an m-row one 56m-24 px long, leaving a 12px margin in its cells like the
32x32 road sprites.

cone                32x32   1 lane, a glint runs down its highlight
bin                 32x32   1 lane, the lid lifts in a breeze
hydrant             32x32   1 lane, a drip off the side cap
bench               88x32   2 lanes, a leaf on the seat stirs
barrier-2           88x32   2 lanes, lamps blink (Woof Way, Sniff Street Shops)
barrier-3           144x32  3 lanes, lamps blink
hedge               144x32  3 lanes, leaves rustle at three spots in turn
parked-car          40x80   1 lane by 3 rows, from behind and above, nose up the road; hazards blink

Every obstacle has a looping idle, so nothing on the road is frozen. Each idle
frame is one argument to the drawing function, listed in the *_IDLE tuples;
frame 0 is the rest pose.

Usage:
  obstacles.py preview OUT.png   every obstacle on the street colours
  obstacles.py build             write art/obstacles/*.aseprite, export to
                                 public/art/sprites/ and list them in the manifest

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import Grid, main, road_sprite  # noqa: E402


def cone(glint=None):
    """glint is the row of the highlight that flashes white, or None."""
    g = Grid()
    g.rect(8, 25, 16, 4, "dslate")
    g.rect(8, 25, 16, 1, "slate")
    g.tri((10, 26), (22, 26), (16, 4), "orange")
    g.tri((16, 26), (22, 26), (16, 4), "rust")
    for y, h in ((11, 3), (19, 3)):
        for x in range(32):
            for yy in range(y, y + h):
                if g.px[yy][x]:
                    g.p(x, yy, "white" if x < 16 else "lgrey")
    g.rect(15, 5, 1, 4, "amber")
    if glint is not None:
        g.p(15, glint, "white")
    return g


def bin_(lift=0):
    """lift raises the lid and handle (negative is up), showing the dark gap under the lid."""
    g = Grid()
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
    return g


def hydrant(drip=0):
    """drip: 1 a bead under the left cap, 2 the bead stretched to fall, 3 a drop landed beside the base."""
    g = Grid()
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
    return g


def bench(leaf=(0, 0)):
    """leaf offsets the fallen leaf on the seat; None leaves it off."""
    g = Grid(88, 32)
    for x in (10, 74):
        g.rect(x, 12, 4, 17, "dslate")
        g.rect(x, 12, 1, 17, "slate")
    for y, c in ((3, "tan"), (8, "brown")):
        g.rect(4, y, 80, 4, c)
        g.rect(4, y + 3, 80, 1, "dbrown")
    g.rect(4, 3, 80, 1, "cream")
    for y in (15, 20):
        g.rect(2, y, 84, 4, "brown")
        g.rect(2, y, 84, 1, "tan")
        g.rect(2, y + 3, 84, 1, "dbrown")
    for x in (20, 44, 68):
        g.rect(x, 4, 1, 7, "dbrown")
    if leaf:
        x, y = 56 + leaf[0], 16 + leaf[1]
        g.rect(x, y, 3, 1, "amber")
        g.rect(x + 1, y + 1, 3, 1, "orange")
        g.p(x + 4, y + 1, "rust")
    return g


def hedge(w=144, rustle=()):
    """rustle lists the top clumps, by index, that lift 1px and shift 1px right."""
    g = Grid(w, 32)
    g.rect(1, 9, w - 2, 21, "forest")
    g.rect(1, 6, w - 2, 9, "dgreen")
    g.rect(1, 6, w - 2, 1, "green")
    g.rect(1, 27, w - 2, 3, "teal")
    for i, x in enumerate(range(3, w - 4, 7)):
        y = 8 + (i * 3) % 5
        r = 1 if i in rustle else 0
        g.ell(x + 2 + r, y - r, 3, 2, "green", None, "yellow" if i % 3 == 0 else None)
        g.ell(x + 5, 17 + (i * 5) % 7, 2, 1.5, "dgreen")
        g.p(x + 1, 22 + (i * 2) % 4, "teal")
    return g


def barrier(lanes, f):
    w = 56 * lanes - 24
    g = Grid(w, 32)
    for x in (4, w - 8):
        g.rect(x, 12, 4, 17, "grey")
        g.rect(x + 3, 12, 1, 17, "slate")
        g.rect(x - 2, 27, 8, 2, "dslate")
    for top in (12, 21):
        g.rect(1, top, w - 2, 6, "white")
        for x in range(1, w - 1, 10):
            g.tri((x, top + 6), (x + 5, top), (x + 10, top), "orange")
            g.tri((x, top + 6), (x + 5, top + 6), (x + 10, top), "orange")
        g.rect(1, top + 5, w - 2, 1, "rust")
    for i, x in enumerate((6, w - 6)):
        on = (i == 0) == bool(f)
        g.ell(x, 7, 3, 3, "amber" if on else "orange", "orange", "yellow" if on else None)
    return g


def parked_car(hazard=False):
    """A station wagon from behind and above, nose up the road: a glimpse of hood, the roof
    with rails, the tailgate with its window and lights, the bumper and rear wheels. Its
    hazard lights, the outer end of each tail light, are lit when hazard is true."""
    g = Grid(40, 80)
    for x in (2, 33):
        g.rect(x, 4, 5, 8, "ink")
    for x in (3, 32):
        g.rect(x, 66, 5, 12, "ink")
    g.rect(8, 70, 24, 4, "ink")
    g.tri((8, 1), (31, 1), (1, 15), "sky")
    g.tri((31, 1), (38, 15), (1, 15), "sky")
    g.rect(1, 15, 38, 55, "sky")
    for x, y in ((1, 69), (38, 69)):
        g.p(x, y, None)
    g.tri((8, 1), (1, 15), (3, 15), "cyan")
    g.rect(1, 15, 2, 39, "cyan")
    g.tri((31, 1), (38, 15), (35, 15), "blue")
    g.rect(35, 15, 4, 39, "blue")
    g.rect(0, 14, 2, 3, "blue")
    g.rect(38, 14, 2, 3, "blue")
    g.tri((8, 12), (31, 12), (10, 19), "navy")
    g.tri((31, 12), (29, 19), (10, 19), "navy")
    g.rect(12, 13, 4, 1, "slate")
    g.tri((8, 12), (5, 46), (7, 46), "navy")
    g.tri((31, 12), (34, 46), (32, 46), "navy")
    g.rect(7, 19, 26, 26, "sky")
    g.rect(7, 19, 2, 26, "cyan")
    g.rect(30, 19, 3, 26, "blue")
    for x in (10, 29):
        g.rect(x, 21, 1, 22, "dslate")
    g.rect(5, 45, 30, 9, "navy")
    g.tri((9, 53), (13, 46), (17, 46), "slate")
    g.rect(1, 54, 38, 1, "cyan")
    g.rect(1, 55, 38, 9, "sky")
    g.rect(1, 64, 38, 4, "blue")
    for x in (2, 32):
        g.rect(x, 56, 6, 5, "red")
        g.rect(x, 56, 6, 1, "pink")
        g.rect(x, 60, 6, 1, "dred")
    if hazard:
        for x in (2, 36):
            g.rect(x, 56, 2, 4, "amber")
            g.rect(x, 56, 2, 1, "yellow")
    g.rect(15, 61, 10, 4, "lgrey")
    g.rect(17, 62, 6, 1, "grey")
    g.rect(18, 57, 4, 2, "lgrey")
    g.rect(1, 67, 38, 4, "dslate")
    g.rect(1, 67, 38, 1, "slate")
    return g


# Idle frames, one drawing argument each, and their duration in ms. Most hold the rest pose for
# two frames so the motion comes as a short event rather than a constant flicker.
CONE_IDLE = (None, None, 5, 6), 400
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
    main(sys.argv, sprites, "art/obstacles", __doc__, grounds=("5a6988", "c0cbdc"), anchored=road_sprite)
