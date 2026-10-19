#!/usr/bin/env python3
"""Draw the minor obstacles: things the pack bumps into with no card. Each
spans whole lanes and rows of the road; an n-lane obstacle is 56n-24 px wide
and an m-row one 56m-24 px long, leaving a 12px margin in its cells like the
32x32 road sprites.

cone, bin, hydrant  32x32   1 lane
bench               88x32   2 lanes
barrier-2           88x32   2 lanes, lamps blink (Woof Way, Sniff Street Shops)
barrier-3           144x32  3 lanes, lamps blink
hedge               144x32  3 lanes
parked-car          40x144  1 lane by 3 rows, top-down, nose up the road

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
from pixel import Grid, main  # noqa: E402


def cone():
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
    return g


def bin_():
    g = Grid()
    g.rect(10, 26, 3, 3, "ink")
    g.rect(19, 26, 3, 3, "ink")
    g.tri((8, 10), (24, 10), (22, 27), "dgreen")
    g.tri((8, 10), (10, 27), (22, 27), "dgreen")
    g.rect(16, 10, 7, 17, "forest")
    g.rect(16, 10, 8, 1, "forest")
    for x in (11, 14):
        g.rect(x, 13, 1, 11, "green")
    g.rect(7, 6, 18, 5, "dgreen")
    g.rect(7, 6, 18, 1, "green")
    g.rect(16, 7, 9, 4, "forest")
    g.rect(13, 4, 6, 2, "ink")
    return g


def hydrant():
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
    return g


def bench():
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
    return g


def hedge(w=144):
    g = Grid(w, 32)
    g.rect(1, 9, w - 2, 21, "forest")
    g.rect(1, 6, w - 2, 9, "dgreen")
    g.rect(1, 6, w - 2, 1, "green")
    g.rect(1, 27, w - 2, 3, "teal")
    for i, x in enumerate(range(3, w - 4, 7)):
        y = 8 + (i * 3) % 5
        g.ell(x + 2, y, 3, 2, "green", None, "yellow" if i % 3 == 0 else None)
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


def parked_car():
    """A station wagon from above: short hood, long roof with rails, nose up the road."""
    g = Grid(40, 144)
    for y in (18, 104):
        g.rect(1, y, 4, 18, "ink")
        g.rect(35, y, 4, 18, "ink")
    g.blob(20, 72, 17, 70, "sky", "blue", "cyan", power=6)
    g.rect(19, 6, 2, 22, "blue")
    g.tri((7, 40), (33, 40), (11, 28), "navy")
    g.tri((33, 40), (29, 28), (11, 28), "navy")
    g.rect(13, 30, 6, 2, "slate")
    g.rect(1, 33, 4, 3, "blue")
    g.rect(35, 33, 4, 3, "blue")
    g.rect(7, 42, 26, 72, "sky")
    g.rect(29, 42, 4, 72, "blue")
    g.rect(7, 42, 2, 72, "cyan")
    for x in (11, 28):
        g.rect(x, 48, 1, 60, "dslate")
    for y in (56, 78, 100):
        g.rect(11, y, 18, 1, "dslate")
    g.rect(8, 114, 24, 10, "navy")
    g.rect(10, 115, 8, 1, "slate")
    g.rect(7, 5, 6, 3, "yellow")
    g.rect(27, 5, 6, 3, "yellow")
    g.rect(6, 136, 6, 3, "red")
    g.rect(28, 136, 6, 3, "red")
    g.rect(15, 138, 10, 3, "lgrey")
    return g


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    yield "cone", [("idle", [cone().outlined()], 1000)]
    yield "bin", [("idle", [bin_().outlined()], 1000)]
    yield "hydrant", [("idle", [hydrant().outlined()], 1000)]
    yield "bench", [("idle", [bench().outlined()], 1000)]
    yield "hedge", [("idle", [hedge().outlined()], 1000)]
    for lanes in (2, 3):
        yield f"barrier-{lanes}", [("idle", [barrier(lanes, f).outlined() for f in (0, 1)], 500)]
    yield "parked-car", [("idle", [parked_car().outlined()], 1000)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/obstacles", __doc__, grounds=("5a6988", "c0cbdc"))
