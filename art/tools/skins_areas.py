#!/usr/bin/env python3
"""Draw the garbage truck, the garbageTruck minor obstacle. It has the road outline and
road.LIT's rim; idle (2 frames, 400ms).

stink-garbage-truck 56x60   a rear-loader garbage truck from behind, its hopper
                            open on bags and a banana peel, the beacon blinking, two flies.
                            Laid out on 56x50 and drawn as obstacles.delivery_truck is
                            (56 columns, rows 1.2x), so it centres on a lane with 4px to spare, taller
                            than the delivery truck (56x54) and as tall as the ice cream truck.
                            drive (4 frames, 100ms): reversing down the lane at the pack, tread
                            lines fall down the tyres, the body dips 1px onto them on frames 1
                            and 2, the beacon blinks

Every key also has <key>@<step> for each depth step in minis.STEPS, floor(size x scale + 0.5),
with the original's tags, frames and durations.

Usage:
  skins_areas.py preview OUT.png   every frame on the zone roads
  skins_areas.py build             write art/skins-areas/*.aseprite and export to
                                   public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import road  # noqa: E402
import obstacles  # noqa: E402
from minis import STEPS, small  # noqa: E402
from obstacles import treads, unit  # noqa: E402
from pixel import K, Grid, edged, main  # noqa: E402

# The garbage truck is laid out on 56x50 and drawn as obstacles.delivery_truck is, its columns kept (a lane less
# 4px each side) and its rows TRUCK_SCALE times taller: 56x60, taller than the delivery truck's 54 and as tall
# as road.ice_cream_truck.
TRUCK_W, TRUCK_H = 56, 50
TRUCK_SCALE = obstacles.CAR_SCALE
# The zone roads, for the preview: Cabbagetown, High Park, the Distillery District, Kensington Market,
# The Beaches and Yonge Street.
GROUNDS = ("8b9bb4", "e4a672", "3a4466", "5e2620", "ead4aa", "353b45")


def raster(g):
    """The grid that holds g's pixels."""
    return getattr(g, "g", g)


def lit(g):
    """road.rim with road.LIT on the grid that holds the pixels, so a Mini gets the rim at its own size."""
    road.rim(raster(g), road.LIT)
    return g


# ---------- Stink sources ----------


def garbage_truck(f, roll=None):
    """A rear-loader garbage truck from straight behind, a lane wide and taller
    than obstacles.delivery_truck, laid out on TRUCK_W x TRUCK_H and drawn at TRUCK_SCALE as it is: a green
    packer body with a rounded top, ribbed in forest with a white stripe, its hopper open on a bag, a sack, a
    can and a banana peel under the grey packer blade, grab bars either side, red tail lights, the bumper
    step, both rear wheels and an amber beacon on the roof that blinks (f 1 off). roll (0 to 3) is a drive
    frame, reversing down the lane at the pack: tread lines fall down the tyres 1px a frame and the body
    dips 1px onto them on frames 1 and 2."""
    w = TRUCK_W
    g = edged(Grid(TRUCK_W, TRUCK_H))
    px = raster(g)
    uy = unit(g)[1]
    # wheels first, so the body can dip over them
    for x in (5, 42):
        g.rect(x, 39, 9, 10, "ink")
        g.rect(x, 39, 2, 9, "dslate")
        if roll is not None:
            treads(g, x + 2, 42, 7, 7, roll, uy, back=True)
    wheels = [row[:] for row in px.px]
    px.px = [[None] * px.w for _ in range(px.h)]
    # the packer body: a rounded top over a box, lit along the left, shaded down the right
    g.cel(w / 2, 15, 23, 13, "dgreen", "forest", "green")
    g.rect(5, 15, w - 10, 23, "dgreen")
    g.rect(5, 15, 1, 23, "green")
    g.rect(w - 9, 15, 4, 23, "forest")
    for x in (15, 28, 41):
        g.rect(x, 4, 1, 11, "forest")
    g.rect(6, 16, w - 12, 1, "white")
    # the beacon
    g.rect(w / 2 - 2, 1, 4, 2, "amber" if f == 0 else "rust")
    if f == 0:
        g.p(w / 2 - 2, 1, "yellow")
    # the hopper: its mouth, the trash and the packer blade
    g.rect(9, 21, w - 18, 12, "ink")
    g.cel(16, 29, 5, 3.5, "lgrey", "grey", "white")
    g.rect(15.5, 25, 1, 2, "slate")
    g.cel(25.5, 29.5, 4.5, 3, "purple", "plum", "mauve")
    g.rect(31, 26.5, 3, 6, "red")
    g.rect(31, 26.5, 3, 1, "pink")
    g.tri((35, 32.5), (40, 32.5), (38.5, 27), "yellow")
    g.p(38, 27.5, "dbrown")
    g.rect(9, 21, w - 18, 3, "grey")
    g.rect(9, 21, w - 18, 1, "lgrey")
    g.rect(9, 23, w - 18, 1, "slate")
    # grab bars and tail lights
    for x in (2, w - 3):
        g.rect(x, 17, 1, 17, "lgrey")
    for x in (5, w - 9):
        g.rect(x, 29, 4, 6, "red")
        g.rect(x, 29, 4, 1, "pink")
        g.rect(x, 34, 4, 1, "dred")
    # the bumper step across the full width
    g.rect(1, 37, w - 2, 3, "dslate")
    g.rect(1, 37, w - 2, 1, "slate")
    g.rect(1, 37, 1, 3, "grey")
    dip = 1 if roll in (1, 2) else 0
    body = px.px
    px.px = [[(body[y - dip][x] if y >= dip else None) or wheels[y][x] for x in range(px.w)] for y in range(px.h)]
    return lit(g)


def truck_driving(roll):
    """garbage_truck's drive frame roll, its beacon lit on frames 0 and 1."""
    return garbage_truck(0 if roll < 2 else 1, roll)


# Two flies circling over the truck's roof, (x, y) per idle frame in layout pixels.
TRUCK_FLIES = (((12, 4), (14, 2)), ((44, 2), (42, 1)))


def truck(draw, f, step):
    """A garbage truck frame f at depth step step on a minis.Mini at TRUCK_SCALE x step, outlined, with its
    flies on it after the outline: one ink pixel below 0.75x, else a 2x1 ink body under a white wing."""
    sx, sy = TRUCK_SCALE[0] * step, TRUCK_SCALE[1] * step
    out = small(sys.modules[__name__], (sx, sy), draw, f).outlined()
    for frames in TRUCK_FLIES:
        x, y = frames[f % 2]
        x0, y0 = math.floor((x + 0.5) * sx), math.floor((y + 0.5) * sy)
        if step < 0.75:
            out[y0][x0] = K["ink"]
            continue
        for xx in (x0, x0 + 1):
            out[y0][xx] = K["ink"]
        out[y0 - 1][x0 + (1 if f % 2 else 0)] = K["white"]
        out[y0 - 1][x0 + (0 if f % 2 else 1)] = K["lgrey"]
    return out


# ---------- build ----------


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite, then its depth variants."""
    for suffix, step in (("", 1), *(("@" + k, v) for k, v in STEPS)):
        yield f"stink-garbage-truck{suffix}", [("idle", [truck(garbage_truck, f, step) for f in (0, 1)], 400),
                                               ("drive", [truck(truck_driving, f, step) for f in range(4)], 100)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/skins-areas", __doc__, grounds=GROUNDS)
