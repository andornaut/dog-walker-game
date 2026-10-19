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
parked-car          40x128  1 lane by 3 rows, a minivan from behind and above, nose up the road; hazards
                            blink

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
from pixel import Grid, edged, main, road_sprite  # noqa: E402


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
    """leaf offsets the fallen leaf on the seat; None leaves it off. Slats are 4 rows with 2-row plum
    gaps, and every tone band is 2px on even pixels, so each slat and gap survives 0.5x."""
    g = Grid(88, 32)
    # one colour per gap, so whichever of its rows a scaled sprite keeps, it is the same
    for x, y, w in ((4, 6, 80), (4, 12, 80), (2, 18, 84)):
        g.rect(x, y, w, 2, "plum")
    for x in (10, 74):
        g.rect(x, 12, 4, 17, "dslate")
        g.rect(x, 12, 2, 17, "slate")
    for y, c in ((2, "tan"), (8, "brown")):
        g.rect(4, y, 80, 4, c)
    for x in (20, 44, 68):
        g.rect(x, 4, 2, 6, "dbrown")
    for y in (14, 20):
        g.rect(2, y, 84, 2, "tan")
        g.rect(2, y + 2, 84, 2, "brown")
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
    """f swaps which lamp is lit. The rails are 8 rows from a row divisible by 4, striped 8px orange
    every 16px and leaning right in 2px stairs, so each stripe keeps its width at 0.75x and 0.5x."""
    w = 56 * lanes - 24
    g = Grid(w, 32)
    for x in (4, w - 8):
        g.rect(x, 8, 4, 21, "grey")
        g.rect(x + 2, 8, 2, 21, "slate")
        g.rect(x - 2, 27, 8, 2, "dslate")
    for top in (8, 20):
        # the bottom stair is the rail's shaded lower edge
        for k, (base, stripe) in enumerate((("white", "orange"),) * 3 + (("lgrey", "rust"),)):
            y = top + 2 * k
            g.rect(1, y, w - 2, 2, base)
            for x in range(-8 - 2 * k, w - 1, 16):
                g.rect(max(x, 1), y, min(x + 8, w - 1) - max(x, 1), 2, stripe)
    for i, x in enumerate((6, w - 6)):
        on = (i == 0) == bool(f)
        g.ell(x, 4, 3, 3, "amber" if on else "orange", "orange", "yellow" if on else None)
    return g


def parked_car(hazard=False):
    """A minivan from behind and above, nose up the road: the long hood beyond the windscreen
    with the front wheels at its corners, the roof with rails and crossbars between side windows
    split by door pillars, the tailgate with its window and lights, the bumper and rear wheels.
    Its hazard lights, the outer end of each tail light, are lit when hazard is true. The rear
    end sits r rows down, so the roof is long enough for the car to read as long as the three
    rows it blocks."""
    g = edged(Grid(40, 128))
    r = 48
    for x in (2, 33):
        g.rect(x, 7, 5, 14, "ink")
    for x in (3, 32):
        g.rect(x, 66 + r, 5, 12, "ink")
    g.rect(8, 70 + r, 24, 4, "ink")
    # hood: tapering to the nose, a crease either side of the bulge
    g.tri((8, 1), (31, 1), (1, 22), "sky")
    g.tri((31, 1), (38, 22), (1, 22), "sky")
    g.rect(1, 22, 38, 48 + r, "sky")
    for x, y in ((1, 69 + r), (38, 69 + r)):
        g.p(x, y, None)
    g.tri((8, 1), (1, 22), (3, 22), "cyan")
    g.tri((31, 1), (38, 22), (35, 22), "blue")
    for x0, x1 in ((13, 11), (26, 28)):
        for y in range(3, 20):
            g.p(round(x0 + (x1 - x0) * (y - 3) / 16), y, "blue" if x0 > 20 else "cyan")
    g.rect(13, 1, 14, 1, "cyan")
    # sides of the body, with door seams
    g.rect(1, 22, 2, 32 + r, "cyan")
    g.rect(35, 22, 4, 32 + r, "blue")
    for y in (52, 76):
        g.rect(1, y, 2, 1, "sky")
        g.rect(35, y, 4, 1, "navy")
    # mirrors at the windscreen's base
    g.rect(0, 21, 2, 3, "blue")
    g.rect(38, 21, 2, 3, "blue")
    # windscreen, and the side windows slanting back to the rear window, split by the pillars
    g.tri((8, 19), (31, 19), (10, 27), "navy")
    g.tri((31, 19), (29, 27), (10, 27), "navy")
    g.rect(12, 20, 4, 1, "slate")
    g.tri((8, 19), (5, 27), (8, 27), "navy")
    g.tri((31, 19), (34, 27), (31, 27), "navy")
    g.rect(5, 27, 2, 18 + r, "navy")
    g.rect(33, 27, 2, 18 + r, "navy")
    for y in (50, 74):
        g.rect(5, y, 2, 2, "sky")
        g.rect(33, y, 2, 2, "blue")
    # roof: rails along it, crossbars at either end
    g.rect(7, 27, 26, 18 + r, "sky")
    g.rect(7, 27, 2, 18 + r, "cyan")
    g.rect(30, 27, 3, 18 + r, "blue")
    for x in (10, 29):
        g.rect(x, 29, 1, 14 + r, "dslate")
    for y in (36, 82):
        g.rect(10, y, 20, 2, "dslate")
        g.rect(10, y, 20, 1, "slate")
    # rear window, tailgate, lights, plate and bumper
    g.rect(5, 45 + r, 30, 9, "navy")
    g.tri((9, 53 + r), (13, 46 + r), (17, 46 + r), "slate")
    g.rect(1, 54 + r, 38, 1, "cyan")
    g.rect(1, 55 + r, 38, 9, "sky")
    g.rect(1, 64 + r, 38, 4, "blue")
    for x in (2, 32):
        g.rect(x, 56 + r, 6, 5, "red")
        g.rect(x, 56 + r, 6, 1, "pink")
        g.rect(x, 60 + r, 6, 1, "dred")
    if hazard:
        for x in (2, 36):
            g.rect(x, 56 + r, 2, 4, "amber")
            g.rect(x, 56 + r, 2, 1, "yellow")
    g.rect(15, 61 + r, 10, 4, "lgrey")
    g.rect(17, 62 + r, 6, 1, "grey")
    g.rect(18, 57 + r, 4, 2, "lgrey")
    g.rect(1, 67 + r, 38, 4, "dslate")
    g.rect(1, 67 + r, 38, 1, "slate")
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
