#!/usr/bin/env python3
"""Draw the vehicle minor obstacles: the garbage truck (garbageTruck) and the scooter (scooter). Like
obstacles.py's they are billboards from a low camera, a front elevation, squat, with at most a sliver of
top surface, with the road outline and road.LIT's rim.

stink-garbage-truck 56x60   a rear-loader garbage truck from behind, its hopper
                            open on bags and a banana peel, the beacon blinking, two flies.
                            Laid out on 56x50 and drawn as obstacles.delivery_truck is
                            (56 columns, rows 1.2x), so it centres on a lane with 4px to spare, taller
                            than the delivery truck (56x54) and as tall as the ice cream truck.
                            idle (2 frames, 400ms). drive (4 frames, 100ms): reversing down the lane
                            at the pack, tread lines fall down the tyres, the body dips 1px onto them
                            on frames 1 and 2, the beacon blinks
minor-scooter       48x72   a sky scooter from behind on its stand, laid out on 32x48 and drawn at
                            road.SCALE as hazards.cyclist is; idle (2 frames, 500ms): the indicators
                            blink. pull-out (4 frames, 100ms), parked-car's, drawn pulling right:
                            tread lines climb the tyre, the right indicator blinks. ride (4 frames,
                            100ms): ridden down its lane at the pack, facing the player as
                            hazards.cyclist does, a rider in an open white helmet with a sky stripe
                            and a purple jacket on it behind the leg shield and headlight, the tread
                            falling down the tyre 1px a frame and the scooter and rider dipping 1px
                            onto it on frames 1 and 2

Every key also has <key>@<step> for each depth step in minis.STEPS, floor(size x scale + 0.5), with
the original's tags, frames and durations, drawn on a minis.Mini with its own outline. The scooter's
drawing functions take u, one pixel at the drawn size in full-size units (1 at full size, 1/s on a
minis.Mini at scale s), so motion stays 1px in every depth variant.

Usage:
  vehicles.py preview OUT.png   every frame on the zone roads
  vehicles.py build             write art/vehicles/*.aseprite and export to
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
from obstacles import PULL_OUT, treads, unit  # noqa: E402
from pixel import K, Grid, edged, main  # noqa: E402
from road import SCALE, face_disc, face_front  # noqa: E402

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


def frame(w, h):
    return edged(Grid(w, h))


# ---------- garbage truck ----------


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


# ---------- scooter ----------


# The scooter is laid out on 32x48 and drawn at road.SCALE, 48x72, as hazards.cyclist is: a two-wheeler a
# rider sits on, so the rider is a road person's size.
SCOOTER_W, SCOOTER_H = 32, 48
# The ride's 4 frames, each this long: the tyre's tread falls 1px a frame, as the garbage truck's reverse.
SCOOTER_RIDE_MS = 100


def scooter(blink=False, u=1, roll=None):
    """A sky scooter from behind: its tyre between the two round side cowls, the tail light and plate under
    the seat, the leg shield and handlebar with its mirrors over it. Parked (roll None), it stands on its
    stand and blink lights both indicators on the cowls. roll (0 to 3) is a pull-out frame: tread
    lines climb the tyre 1px a frame (obstacles.treads) and the stand is up; pulling out, the right
    indicator is lit on frames 0 and 1. u is one pixel at the drawn size, in layout units."""
    g = frame(SCOOTER_W, SCOOTER_H)
    px = getattr(g, "g", g)
    # the tyre first, so the body lies over it
    g.rect(14, 38, 4, 9, "ink")
    g.rect(14, 38, 1, 8, "dslate")
    if roll is not None:
        treads(g, 15, 40, 3, 7, roll, u)
    else:
        for x in (10, 21):
            g.rect(x, 43, 1, 4, "dslate")
    wheel = [row[:] for row in px.px]
    px.px = [[None] * px.w for _ in range(px.h)]
    # mirrors on stalks, the handlebar and its grips, the leg shield behind the seat
    for x in (6, 23):
        g.rect(x, 16, 3, 2, "lgrey")
        g.rect(x + 1, 17, 2, 1, "grey")
        g.rect(x + 1, 18, 1, 4, "dslate")
    g.rect(7, 22, 18, 2, "dslate")
    g.rect(7, 22, 18, 1, "slate")
    g.rect(6, 22, 3, 2, "ink")
    g.rect(23, 22, 3, 2, "ink")
    g.rect(11, 24, 10, 6, "sky")
    g.rect(11, 24, 10, 1, "cyan")
    g.rect(18, 25, 3, 5, "blue")
    # the side cowls and the body between them
    g.rect(12, 30, 8, 9, "sky")
    g.rect(17, 30, 3, 9, "blue")
    for cx in (9.5, 22.5):
        g.cel(cx, 36.5, 5, 4.5, "sky", "blue", "cyan")
    # the seat, tail light and plate
    g.cel(16, 30, 7, 2, "plum", None, "purple")
    g.rect(13, 33, 6, 2, "red")
    g.rect(13, 33, 6, 1, "pink")
    g.rect(13.5, 36, 5, 3, "lgrey")
    g.rect(14.5, 37, 3, 1, "grey")
    for x in (5, 25):
        on = blink or (roll is not None and roll < 2 and x > SCOOTER_W / 2)
        g.rect(x, 35, 2, 2, "yellow" if on else "orange")
        if on:
            g.rect(x, 35, 2, 1, "white")
    px.px = [[body or wheel[y][x] for x, body in enumerate(row)] for y, row in enumerate(px.px)]
    return lit(g)


def scooter_pulling(roll, u=1):
    """scooter's pull-out frame roll, riderless."""
    return scooter(False, u, roll)


def scooter_riding(roll, u=1):
    """scooter's ride frame roll: ridden down its lane at the pack, facing the player as hazards.cyclist does.
    The front tyre edge-on under the front mudguard, tread lines falling 1px a frame as it rolls toward the
    player (obstacles.treads, back); the sky leg shield across the front with a chrome horn badge, the
    headlight on the headset over it, the handlebar with its orange indicators at the ends and the mirrors
    on stalks. Its rider, behind the shield: an open white helmet with a sky stripe over the face, a purple
    jacket, brown gloves on the grips. The scooter and rider dip 1px onto the tyre on frames 1 and 2. u is
    one pixel at the drawn size, in layout units."""
    g = frame(SCOOTER_W, SCOOTER_H)
    px = getattr(g, "g", g)
    # the tyre first, so the body can dip over it
    g.rect(14, 38, 4, 9, "ink")
    g.rect(14, 38, 1, 8, "dslate")
    treads(g, 15, 40, 3, 7, roll, u, back=True)
    wheel = [row[:] for row in px.px]
    px.px = [[None] * px.w for _ in range(px.h)]
    # the rider: the jacket and arms out to the grips, the face under the helmet
    g.rect(14.5, 15, 3, 2, "skin2")
    g.cel(16, 21, 6.5, 7, "purple", "plum", "mauve")
    g.rect(9.5, 18, 13, 6, "purple")
    g.rect(9.5, 18, 1, 6, "mauve")
    g.rect(19.5, 18, 3, 6, "plum")
    for x, c in ((6.5, "purple"), (22.5, "plum")):
        g.rect(x, 17, 3, 5, c)
    face_disc(g, 16, 11, 5.5, 5, "skin1", "skin2")
    g.cel(16, 6.5, 6.5, 4, "white", "lgrey")
    g.rect(9.5, 6, 1.5, 7, "white")
    g.rect(21, 6, 1.5, 7, "lgrey")
    g.rect(15, 2.5, 2, 5, "sky")
    g.rect(11, 8, 10, 1, "dslate")
    face_front(g, 16, 10)
    # mirrors on stalks, the handlebar, the gloves on the grips, the indicators at its ends
    for x in (5, 24):
        g.rect(x, 13, 3, 2, "lgrey")
        g.rect(x + 1, 14, 2, 1, "grey")
        g.rect(x + 1, 15, 1, 5, "dslate")
    g.rect(6, 21, 20, 2, "dslate")
    g.rect(6, 21, 20, 1, "slate")
    g.rect(6, 20, 3, 3, "dbrown")
    g.rect(23, 20, 3, 3, "dbrown")
    g.rect(4, 21, 2, 2, "orange")
    g.rect(26, 21, 2, 2, "orange")
    # the leg shield across the front, lit down its left, a chrome horn badge on it, the headlight on top
    g.cel(16, 31, 7.5, 9, "sky", "blue", "cyan", power=2.6)
    g.rect(12, 22, 8, 3, "sky")
    g.rect(18, 22, 2, 3, "blue")
    g.rect(14, 27, 4, 3, "lgrey")
    g.rect(14, 27, 4, 1, "white")
    g.rect(15, 29, 2, 1, "grey")
    g.cel(16, 21, 2.5, 2, "yellow", "amber", "white")
    # the front mudguard over the tyre
    g.cel(16, 38.5, 3, 2, "sky", "blue", "cyan")
    dip = 1 if roll in (1, 2) else 0
    body = px.px
    px.px = [[(body[y - dip][x] if y >= dip else None) or wheel[y][x] for x in range(px.w)] for y in range(px.h)]
    return lit(g)


# The scooter's motion tags after its idle: [(tag, drawing, frame arguments, ms per frame)].
SCOOTER_MOVES = [("pull-out", scooter_pulling, *PULL_OUT), ("ride", scooter_riding, range(4), SCOOTER_RIDE_MS)]


# ---------- build ----------


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for each sprite at full size, then at every depth
    step: the garbage truck on a minis.Mini at TRUCK_SCALE x the step, the scooter at road.SCALE x the step."""
    this = sys.modules[__name__]
    for suffix, step in (("", 1), *(("@" + k, v) for k, v in STEPS)):
        yield f"stink-garbage-truck{suffix}", [("idle", [truck(garbage_truck, f, step) for f in (0, 1)], 400),
                                               ("drive", [truck(truck_driving, f, step) for f in range(4)], 100)]
    for suffix, step in (("", 1), *(("@" + k, v) for k, v in STEPS)):
        s = SCALE * step
        yield f"minor-scooter{suffix}", [(tag, [small(this, s, d, a, 1 / s).outlined() for a in fargs], fms)
                                         for tag, d, fargs, fms in [("idle", scooter, (False, True), 500),
                                                                    *SCOOTER_MOVES]]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/vehicles", __doc__, grounds=GROUNDS)
