#!/usr/bin/env python3
"""Draw the vehicle minor obstacles: the garbage truck (garbageTruck) and the scooter (scooter), High Park's
tourist train and Yonge Street's crossing TTC bus. Like obstacles.py's the truck and the scooter are
billboards from a low camera, a front elevation, squat, with at most a sliver of top surface; the train and
the bus are crossers, side on. All take the road outline and road.LIT's rim.

stink-garbage-truck 56x60   a rear-loader garbage truck from behind, its hopper
                            open on bags and a banana peel, the beacon blinking, two flies.
                            Laid out on 56x50 and drawn as obstacles.delivery_truck is
                            (56 columns, rows 1.2x), so it centres on a lane with 4px to spare, taller
                            than the delivery truck (56x54) and as tall as the ice cream truck.
                            idle (2 frames, 400ms). drive (4 frames, 100ms): reversing down the lane
                            at the pack, tread lines fall down the tires, the body dips 1px onto them
                            on frames 1 and 2, the beacon blinks
minor-scooter       48x72   a sky scooter from behind on its stand, laid out on 32x48 and drawn at
                            road.SCALE as hazards.cyclist is; idle (2 frames, 500ms): the indicators
                            blink. pull-out (4 frames, 100ms), parked-car's, drawn pulling right:
                            tread lines climb the tire, the right indicator blinks. ride (4 frames,
                            100ms): ridden down its lane at the pack, facing the player as
                            hazards.cyclist does, a rider in an open white helmet with a sky stripe
                            and a purple jacket on it behind the leg shield and lit headlamp, the tread
                            falling down the tire 1px a frame and the scooter and rider dipping 1px
                            onto it on frames 1 and 2
tourist-train       176x64  High Park's trackless tourist train crossing the road side on, facing right
                            (the game mirrors it for left), laid out on 176/1.5 x 64/1.5 and drawn at
                            road.SCALE: a red engine dressed as an old steam locomotive (a black
                            boiler with slate bands, a black funnel stack with a flared lip, a
                            headlamp, a black cowcatcher, the driver in a hickory-striped engineer's
                            cap and blue overalls in an open cab, a Canadian flag on the cab roof)
                            pulling two open cars of passengers, each with red and white striped
                            bench boards and a cream canopy with a scalloped red hem on red posts, on
                            black tires with red hubs; push (4 frames, 100ms): the spokes turning a
                            quarter of their spacing a frame, the engine dipping 1px onto its wheels
                            on frames 1 and 2 and the cars bobbing 1px in turn; idle (4 frames,
                            400ms): stopped, the middle passenger of the second car waving, the hand
                            swung out on frame 2; cue (3 frames, 120ms): the whistle, a white puff out of the
                            stack growing and lifting away
ttc-bus-crossing    176x64  a TTC bus crossing Yonge Street side on, facing right (the game mirrors it for
                            left), on the train's grid: a red roof trim over the white upper body and
                            its one long dark window band, glints across it, a roof pod at the back, the
                            amber destination sign over the front door and windshield, the mirror on its
                            arm off the roof's front, the ttc red lower body with a white stripe, two
                            glass doors split down the middle, a white headlamp and an amber indicator,
                            two black tires with grey hubs in dark arches, no pantograph; told apart
                            from ttc-bus, the same bus from behind, and from the streetcar. push (4
                            frames, 100ms): a spoke across each hub turning an eighth a frame, the body
                            dipping 1px onto the wheels on frames 1 and 2; idle (4 frames, 400ms): at its
                            stop, both doors open on a lit doorway with a yellow pole, the body kneeling
                            1px on frames 1 and 2; cue (3 frames, 120ms): the doors shut, the indicator
                            blinking, the body up off its kneel from frame 1 and the wheels a quarter
                            turned on frame 2

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
import obstacles  # noqa: E402
from minis import STEPS, small  # noqa: E402
from obstacles import PULL_OUT, treads, unit  # noqa: E402
from pixel import K, Grid, edged, main, raster, scale_of  # noqa: E402
from road import SCALE, face_disc, face_front, headlamp, lit, raise_mouth  # noqa: E402

# The garbage truck is laid out on 56x50 and drawn as obstacles.delivery_truck is, its columns kept (a lane less
# 4px each side) and its rows TRUCK_SCALE times taller: 56x60, taller than the delivery truck's 54 and as tall
# as road.ice_cream_truck.
TRUCK_W, TRUCK_H = 56, 50
TRUCK_SCALE = obstacles.CAR_SCALE


def frame(w, h):
    return edged(Grid(w, h))


# ---------- garbage truck ----------


def garbage_truck(f, roll=None):
    """A rear-loader garbage truck from straight behind, a lane wide and taller
    than obstacles.delivery_truck, laid out on TRUCK_W x TRUCK_H and drawn at TRUCK_SCALE as it is: a green
    packer body with a rounded top, ribbed in forest with a white stripe, its hopper open on a bag, a sack, a
    can and a banana peel under the grey packer blade, grab bars either side, red tail lights, the bumper
    step, both rear wheels and an amber beacon on the roof that blinks (f 1 off). roll (0 to 3) is a drive
    frame, reversing down the lane at the pack: tread lines fall down the tires 1px a frame and the body
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
    flies on it after the outline: one ink pixel below 0.75x, else a 2x1 ink body under a white and lgrey wing."""
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
# The ride's 4 frames, each this long: the tire's tread falls 1px a frame, as the garbage truck's reverse.
SCOOTER_RIDE_MS = 100


def scooter(blink=False, u=1, roll=None):
    """A sky scooter from behind: its tire between the two round side cowls, the tail light and plate under
    the seat, the leg shield and handlebar with its mirrors over it. Parked (roll None), it stands on its
    stand and blink lights both indicators on the cowls. roll (0 to 3) is a pull-out frame: tread
    lines climb the tire 1px a frame (obstacles.treads) and the stand is up; pulling out, the right
    indicator is lit on frames 0 and 1. u is one pixel at the drawn size, in layout units."""
    g = frame(SCOOTER_W, SCOOTER_H)
    px = raster(g)
    # the tire first, so the body lies over it
    g.rect(14, 38, 4, 9, "ink")
    g.rect(14, 38, 1, 8, "dslate")
    if roll is not None:
        treads(g, 15, 40, 3, 7, roll, u)
    else:
        # the stand's two legs, down from under the cowls so they join the body
        for x in (10, 21):
            g.rect(x, 39, 1, 8, "dslate")
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
    """scooter's ride frame roll: ridden down its lane at the pack, facing the player as hazards.cyclist does. The
    front tire edge-on under the front mudguard, tread lines falling 1px a frame as it rolls toward the player
    (obstacles.treads, back); the sky leg shield across the front with a chrome horn badge, a lit headlamp
    (road.headlamp) in a chrome housing on the headset over it, the handlebar with its orange indicators at the ends
    and the mirrors on stalks. Its rider, behind the shield: an open white helmet with a sky stripe over the face, a
    purple jacket, brown gloves on the grips. The scooter and rider dip 1px onto the tire on frames 1 and 2. u is one
    pixel at the drawn size, in layout units."""
    g = frame(SCOOTER_W, SCOOTER_H)
    px = raster(g)
    # the tire first, so the body can dip over it
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
    # the smile up a pixel, clear of the chin's edge and the jacket's collar
    raise_mouth(g, 16, 10)
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
    # the leg shield across the front, lit down its left, a chrome horn badge on it, the headlamp on top
    g.cel(16, 31, 7.5, 9, "sky", "blue", "cyan", power=2.6)
    g.rect(12, 22, 8, 3, "sky")
    g.rect(18, 22, 2, 3, "blue")
    g.rect(14, 27, 4, 3, "lgrey")
    g.rect(14, 27, 4, 1, "white")
    g.rect(15, 29, 2, 1, "grey")
    g.cel(16, 21, 2.5, 2, "lgrey", "grey")
    headlamp(g, 16, 21.5)
    # the front mudguard over the tire
    g.cel(16, 38.5, 3, 2, "sky", "blue", "cyan")
    dip = 1 if roll in (1, 2) else 0
    body = px.px
    px.px = [[(body[y - dip][x] if y >= dip else None) or wheel[y][x] for x in range(px.w)] for y in range(px.h)]
    return lit(g)


# The scooter's motion tags after its idle: [(tag, drawing, frame arguments, ms per frame)].
SCOOTER_MOVES = [("pull-out", scooter_pulling, *PULL_OUT), ("ride", scooter_riding, range(4), SCOOTER_RIDE_MS)]


# ---------- tourist train ----------


# The key, and the tourist train's design grid: 176x64 at road.SCALE, as the couple's 112 columns are laid out.
TRAIN_KEY = "tourist-train"
TRAIN_W, TRAIN_H = 176 / SCALE, 64 / SCALE
# The wheels' centre row and radius, the feet a row above the frame's bottom row so the outline closes under them.
TRAIN_AXLE, TRAIN_WHEEL = 37.2, 4.4
# Moving: the wheels' spokes turn a quarter of their spacing a frame (roll), the engine dips 1px onto its wheels
# on frames 1 and 2 and the cars bob 1px in turn; 4 frames at 100ms, as every drive. Stopped: the second car's
# middle passenger waves, the hand swung out on frame 2; 4 frames at 400ms. Restarting: the whistle's puff grows out of
# the stack and lifts away; 3 frames at 120ms.
TRAIN_TAGS = (
    ("push", tuple(dict(roll=r) for r in range(4)), 100),
    ("idle", (dict(), dict(wave=1), dict(wave=2), dict(wave=1)), 400),
    ("cue", (dict(toot=1), dict(toot=2), dict(toot=3)), 120),
)
# Each car's left column and its passengers, back to front: (top, hair).
TRAIN_CARS = ((2, (("teal", "ink"), ("amber", "dbrown"), ("lilac", "brown"))),
              (40, (("orange", "gold"), ("sky", "rust"), ("green", "ink"))))


def quad(g, a, b, c, d, col):
    g.tri(a, b, c, col)
    g.tri(a, c, d, col)


def strand(g, pts, c):
    """A 1px line in drawn pixels through the design points pts, so a spoke stays one pixel at any scale."""
    s, px = scale_of(g), raster(g)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        a, b = (math.floor(x0 * s), math.floor(y0 * s)), (math.floor(x1 * s), math.floor(y1 * s))
        n = max(abs(b[0] - a[0]), abs(b[1] - a[1]), 1)
        for k in range(n + 1):
            px.p(round(a[0] + (b[0] - a[0]) * k / n), round(a[1] + (b[1] - a[1]) * k / n), c)


def train_wheel(g, cx, roll):
    """A black tire side on round a red hub, two spokes crossing it turned a quarter of their spacing a frame
    (roll 0 to 3), so the loop is seamless, and an amber axle cap."""
    r, cy = TRAIN_WHEEL, TRAIN_AXLE
    g.ell(cx, cy, r, r, "ink")
    g.rect(cx - r + 0.6, cy - 1.5, 0.75, 3, "dslate")
    g.ell(cx, cy, r * 0.55, r * 0.55, "red", "dred")
    for k in range(2):
        a = math.pi / 2 * (k + roll / 4)
        dx, dy = r * 0.5 * math.cos(a), r * 0.5 * math.sin(a)
        strand(g, [(cx - dx, cy - dy), (cx + dx, cy + dy)], "dred")
    g.p(cx, cy, "amber")


def canopy(g, x0, x1, y):
    """A canopy seen side on: a red roof line over a cream valance with a scalloped red hem, its back (right)
    end shaded."""
    g.rect(x0 - 0.5, y, x1 - x0 + 1, 1, "red")
    x, i = x0, 0
    while x < x1 - 0.01:
        w = min(2, x1 - x)
        shade = x > x1 - 3
        g.rect(x, y + 1, w, 2.5, "tan" if shade else "cream")
        if i % 2 == 0:
            g.rect(x, y + 3, w, 1.5, "dred" if shade else "red")
        x += w
        i += 1


def eyes(g, cx, y):
    """A small face's 1px eyes and mouth, in drawn pixels."""
    g.p(cx - 1.4, y, "ink")
    g.p(cx + 1.0, y, "ink")
    g.p(cx - 0.2, y + 2, "dbrown")


def train_car(g, x0, heads, wave=0):
    """An open car from x0, 36 columns long: three passengers in its bays under the canopy, the striped bench
    boards, the chassis and two wheels. wave raises the middle passenger's hand (2 swings it out)."""
    g.rect(x0 + 1, 10, 34, 13, "navy")
    for i, (top, hair) in enumerate(heads):
        cx = x0 + 6.5 + i * 11.5
        g.cel(cx, 21.5, 3.8, 2.4, top, None, power=3)
        face_disc(g, cx, 17, 3, 3, "skin1", "skin2")
        eyes(g, cx, 17)
        g.cel(cx, 14.6, 3.2, 1.7, hair, None, power=3)
    g.rect(x0, 22.5, 36, 8, "red")
    # the white bench boards on a whole-pixel pitch, so both cars keep their stripes at every depth step
    s, px = scale_of(g), raster(g)
    pitch = round(4 * s)
    w = min(max(1, round(2 * s)), pitch - 1)
    x, end = math.floor((x0 + 1.5) * s), math.floor((x0 + 35) * s)
    while x + w <= end:
        px.rect(x, math.floor(23.5 * s), w, math.floor(29.5 * s) - math.floor(23.5 * s), "white")
        x += pitch
    g.rect(x0, 30, 36, 3, "red")
    g.rect(x0, 32, 36, 1, "dred")
    for x in (x0, x0 + 11.75, x0 + 23.25, x0 + 34.5):
        g.rect(x, 8.5, 1.5, 14.5, "red")
    canopy(g, x0 - 0.5, x0 + 36.5, 6.5)
    if wave:
        # the middle passenger's arm up out of the open side, in front of the post, the hand open under the
        # canopy's hem, swung out on wave 2
        top, cx = heads[1][0], x0 + 18
        hx = cx + (3.8 if wave == 1 else 5.3)
        g.rect(cx + 3, 16.5, 1.5, 4, top)
        g.rect(hx - 0.3, 13, 1.5, 4.5, top)
        g.rect(hx - 0.5, 11.3, 2.5, 2.5, "skin1")


def train_engine(g, toot=0):
    """The engine, its cab at the back (left) and the boiler in front."""
    # the open cab: the driver in a hickory-striped cap and blue overalls with a red neckerchief
    g.rect(81, 10, 10, 13, "navy")
    g.cel(86, 21.5, 4, 2.5, "blue", "navy", "sky", power=3)
    g.rect(85, 19, 2.5, 1.2, "red")
    face_disc(g, 86, 16.5, 3.2, 3.2, "skin1", "skin2")
    eyes(g, 86, 16.5)
    g.cel(86.5, 13.2, 3.8, 2, "white", "lgrey", power=3)
    for x in (84.5, 86.5, 88.5):
        g.rect(x, 11.8, 0.75, 2.5, "sky")
    g.rect(86, 14.3, 5.5, 0.9, "blue")
    for x in (80, 90.5):
        g.rect(x, 8.5, 1.5, 22, "red")
    g.rect(80, 22.5, 12, 8.5, "red")
    g.rect(82, 24, 8, 5, "dred")
    g.rect(82.5, 24.5, 7, 4, "red")
    canopy(g, 78.5, 93.5, 6.5)
    # the Canadian flag on the cab roof, flying back
    g.rect(79, 1.2, 1, 5.3, "ink")
    g.rect(74.5, 1.2, 1.25, 2.5, "red")
    g.rect(75.75, 1.2, 2, 2.5, "white")
    g.rect(77.75, 1.2, 1.25, 2.5, "red")
    g.p(76.5, 2.2, "red")
    # the boiler, black, lit along its top, two slate bands, the smokebox's front ring
    g.rect(91, 20, 17, 11, "ink")
    g.rect(91, 20, 17, 1, "dslate")
    for x in (95.5, 101.5):
        g.rect(x, 20, 1, 11, "dslate")
    g.rect(107, 19.5, 2.5, 12, "dslate")
    g.rect(107, 19.5, 1, 12, "slate")
    # the funnel stack with its flared lip, and the whistle's puff over it
    x, top = 102, 7.5
    g.rect(x - 1.5, top + 4, 3, 20 - top - 4, "ink")
    g.rect(x - 1.5, top + 4, 1, 20 - top - 4, "dslate")
    g.tri((x - 4, top + 1.5), (x + 4, top + 1.5), (x, top + 6), "ink")
    g.rect(x - 4, top, 8, 1.5, "ink")
    g.rect(x - 3.5, top, 2.5, 1, "dslate")
    if toot == 1:
        g.cel(x, top - 1.6, 2.2, 1.6, "white", "lgrey")
    elif toot == 2:
        g.cel(x - 0.5, top - 3, 3.2, 2.2, "white", "lgrey")
        g.cel(x + 1.8, top - 1, 1.5, 1.2, "white", "lgrey")
    elif toot == 3:
        g.cel(x - 2, top - 4, 3.4, 2.2, "lgrey", "grey", "white")
        g.cel(x + 2.2, top - 5, 1.5, 1.1, "lgrey", "grey")
    # the headlamp on the smokebox
    g.rect(107, 15.5, 3.5, 4, "dslate")
    g.rect(109.5, 16.5, 1.25, 2, "cream")
    # the frame under it all and the slatted black cowcatcher
    g.rect(79.5, 31, 30, 4, "red")
    g.rect(79.5, 34, 30, 1, "dred")
    quad(g, (109.5, 31), (111, 31), (116, 41), (109.5, 41), "ink")
    for k in range(3):
        g.rect(111 + k * 1.6, 33 + k * 2.5, 1, 1, "dslate")


def tourist_train(roll=None, wave=0, toot=0):
    """High Park's tourist train side on, facing right: the engine pulling two open cars (see the docstring).
    roll (0 to 3) is a push frame: the spokes turn, the engine dips onto its wheels on frames 1 and 2 and the
    cars bob in turn; wave raises the waving passenger's hand (2 swings it out), toot (1 to 3) is the
    whistle's puff."""
    g = edged(Grid(TRAIN_W, TRAIN_H))
    px = raster(g)
    moving = roll is not None
    dip = 1 if roll in (1, 2) else 0
    alt = 1 if roll in (0, 3) else 0
    out = [[None] * px.w for _ in range(px.h)]

    def layer(draw, dy):
        px.px = [[None] * px.w for _ in range(px.h)]
        draw()
        for y in range(dy, px.h):
            for x in range(px.w):
                c = px.px[y - dy][x]
                if c:
                    out[y][x] = c

    def couplers():
        g.rect(38, 32.5, 3, 1.5, "ink")
        g.rect(76, 32.5, 4, 1.5, "ink")

    def wheels():
        for x0, _ in TRAIN_CARS:
            for x in (x0 + 7.5, x0 + 28.5):
                train_wheel(g, x, roll or 0)
        for x in (86, 102.5):
            train_wheel(g, x, roll or 0)

    (back_x, back), (front_x, front) = TRAIN_CARS
    layer(couplers, 0)
    layer(lambda: train_car(g, back_x, back), alt if moving else 0)
    layer(lambda: train_car(g, front_x, front, wave), (1 - alt) if moving else 0)
    layer(wheels, 0)
    layer(lambda: train_engine(g, toot), dip)
    px.px = out
    return lit(g)


# ---------- TTC bus crossing ----------


# The key, and the bus's design grid: 176x64 at road.SCALE, as the tourist train's.
BUS_KEY = "ttc-bus-crossing"
BUS_W, BUS_H = TRAIN_W, TRAIN_H
# The body's rear and front columns, its roof, belt (white over red) and sill rows; the wheels' centre row,
# radius and columns, the feet a row above the frame's bottom row as the train's.
BUS_REAR, BUS_FRONT, BUS_ROOF, BUS_BELT, BUS_SILL = 2, 112, 4, 22, 36.5
BUS_AXLE, BUS_WHEEL, BUS_WHEELS = 37.2, 4.6, (28, 89)
# The doors' left columns, middle and front, each BUS_DOOR wide.
BUS_DOORS, BUS_DOOR = (52, 98), 7.5
# Moving: the hubs' spokes turn a quarter of their spacing a frame (roll) and the body dips 1px onto its wheels
# on frames 1 and 2; 4 frames at 100ms, as every drive. Stopped at its stop: the doors open, the body kneels
# 1px on frames 1 and 2; 4 frames at 400ms. Pulling away: the doors shut and the front indicator blinks, the
# body up off its kneel from frame 1 and the wheels a quarter turned on frame 2; 3 frames at 120ms, the
# train's.
BUS_TAGS = (
    ("push", tuple(dict(roll=r) for r in range(4)), 100),
    ("idle", (dict(doors=1), dict(doors=1, kneel=1), dict(doors=1, kneel=1), dict(doors=1)), 400),
    ("cue", (dict(kneel=1, blink=1), dict(), dict(roll=1, blink=1)), 120),
)


def bus_wheel(g, cx, roll):
    """A black tire side on round a flat grey hub, a dslate spoke across the hub turned an eighth of a turn
    clockwise a frame (roll 0 to 3: |, /, - and \\), as a wheel rolling right turns; the spoke's two ends
    make the loop seamless."""
    r, cy = BUS_WHEEL, BUS_AXLE
    g.ell(cx, cy, r, r, "ink")
    g.rect(cx - r + 0.6, cy - 1.5, 0.75, 3, "dslate")
    g.ell(cx, cy, r * 0.5, r * 0.5, "grey")
    a, d = math.pi / 4 * roll, r * 0.42
    dx, dy = d * math.sin(a), -d * math.cos(a)
    strand(g, [(cx - dx, cy - dy), (cx + dx, cy + dy)], "dslate")


def row(g, x0, x1, y, c):
    """A 1px row in drawn pixels from design column x0 to x1 on design row y, so a stripe stays one pixel."""
    s = scale_of(g)
    raster(g).rect(math.floor(x0 * s), math.floor(y * s), math.floor(x1 * s) - math.floor(x0 * s), 1, c)


def glint(g, x, y0, y1, c="dslate"):
    """A glint across glass in drawn pixels: a stroke 2px wide from design (x, y1) leaning right up to row y0,
    a column right every two rows, as ttc_bus's glints lean."""
    s, px = scale_of(g), raster(g)
    X, Y0, Y1 = math.floor(x * s), math.floor(y0 * s), math.floor(y1 * s)
    for Y in range(Y0, Y1):
        off = (Y1 - 1 - Y) // 2
        px.p(X + off, Y, c)
        px.p(X + off + 1, Y, c)


def bus_door(g, x0, open_):
    """A glass door from the window band's top to the sill in an lgrey frame: shut, two navy leaves split
    down the middle; open, the leaves folded back to its sides on the lit doorway, a yellow pole up it and its
    grey step."""
    top, w = BUS_ROOF + 4, BUS_DOOR
    g.rect(x0, top, w, BUS_SILL - top, "lgrey")
    if open_:
        g.rect(x0 + 1.5, top + 0.75, w - 3, BUS_SILL - top - 2.25, "dslate")
        g.rect(x0 + 1.5, BUS_SILL - 1.5, w - 3, 1.5, "grey")
        s = scale_of(g)
        raster(g).rect(math.floor((x0 + w / 2) * s), math.floor((top + 0.75) * s), 1,
                       math.floor((BUS_SILL - 1.5) * s) - math.floor((top + 0.75) * s), "yellow")
        for x in (x0 + 0.75, x0 + w - 1.5):
            g.rect(x, top + 0.75, 0.75, BUS_SILL - top - 1.5, "navy")
    else:
        for x in (x0 + 0.75, x0 + w / 2 + 0.375):
            g.rect(x, top + 0.75, w / 2 - 1.125, BUS_SILL - top - 2.25, "navy")
        glint(g, x0 + 1, top + 1.5, top + 7)


def bus_body(g, doors=0, blink=0):
    """The bus's body, facing right: a red roof trim over the white upper body and its long dark window band,
    the roof pod at the back, the amber destination sign over the front door and windshield, the red lower
    body with a white stripe and a dred sill, the two doors, the dark wheel arches, the bumpers, the
    headlamp and the indicator, the mirror on its arm off the front of the roof."""
    x0, x1, top, belt, sill = BUS_REAR, BUS_FRONT, BUS_ROOF, BUS_BELT, BUS_SILL
    # the roof pod, white lit over lgrey, at the back
    g.rect(9, top - 2, 30, 2, "lgrey")
    row(g, 9, 39, top - 2, "white")
    # the white upper body, its top corners rounded, shaded down the nose
    r = 3
    g.rect(x0 + r, top, x1 - x0 - 2 * r, belt - top, "white")
    g.rect(x0, top + r, x1 - x0, belt - top - r, "white")
    for cx in (x0 + r, x1 - r):
        g.ell(cx, top + r, r, r, "white")
    g.rect(x1 - 1, top + r, 1, belt - top - r, "lgrey")
    row(g, x0 + r, x1 - r, top, "ttc")
    # the long dark window band, glints across it
    g.rect(x0 + 3, top + 4, 92, 11.5, "navy")
    for x in (12, 16, 66, 70):
        glint(g, x, top + 4, top + 15.5)
    # the windshield wrapping round the front, under the sign
    g.rect(x1 - 4.5, top + 4, 3.5, 18, "navy")
    glint(g, x1 - 4.5, top + 4, top + 9)
    # the destination sign: amber in an ink box, the route apart from its name
    g.rect(x1 - 15, top + 0.75, 13.5, 3, "ink")
    g.rect(x1 - 14, top + 1.5, 3, 1.5, "amber")
    g.rect(x1 - 10, top + 1.5, 7.5, 1.5, "amber")
    # the red lower body, lit along its top, a white stripe, the sill a step darker, shaded down the nose
    g.rect(x0, belt, x1 - x0, sill - belt, "ttc")
    row(g, x0, x1, belt, "red")
    row(g, x0, x1, belt + 2.5, "white")
    g.rect(x0, sill - 1.5, x1 - x0, 1.5, "dred")
    g.rect(x1 - 1, belt + 1, 1, sill - belt - 1, "dred")
    for x in BUS_DOORS:
        bus_door(g, x, doors)
    # the indicator and headlamp at the front, the bumpers at each end
    g.rect(x1 - 7, belt + 5.5, 3, 2, "yellow" if blink else "amber")
    if blink:
        row(g, x1 - 7, x1 - 4, belt + 5.5, "white")
    g.rect(x1 - 2.5, sill - 6.5, 2.5, 2.5, "white")
    for x in (x0 - 0.5, x1 - 2):
        g.rect(x, sill - 3.5, 2.5, 3.5, "dslate")
        row(g, x, x + 2.5, sill - 3.5, "slate")
    # the mirror on its arm off the front of the roof
    g.rect(x1 - 1, top + 1, 3, 1, "dslate")
    g.rect(x1 + 1.5, top + 1, 1, 3, "dslate")
    g.rect(x1 + 1, top + 3.5, 2, 5, "ink")
    # the wheel arches, dark, cut off at the sill
    for cx in BUS_WHEELS:
        g.ell(cx, BUS_AXLE, BUS_WHEEL + 1.5, BUS_WHEEL + 1.5, "navy")
    g.rect(0, sill, BUS_W, BUS_H, None)


def ttc_bus_crossing(roll=None, doors=0, kneel=0, blink=0):
    """A TTC bus crossing Yonge Street side on, facing right (see the docstring). roll (0 to 3) is a push frame:
    the spokes turn and the body dips onto its wheels on frames 1 and 2; doors opens both doors, kneel dips
    the body 1px at the stop, blink lights the indicator."""
    g = edged(Grid(BUS_W, BUS_H))
    px = raster(g)
    dip = 1 if roll in (1, 2) or kneel else 0
    out = [[None] * px.w for _ in range(px.h)]

    def layer(draw, dy):
        px.px = [[None] * px.w for _ in range(px.h)]
        draw()
        for y in range(dy, px.h):
            for x in range(px.w):
                c = px.px[y - dy][x]
                if c:
                    out[y][x] = c

    layer(lambda: bus_body(g, doors, blink), dip)
    layer(lambda: [bus_wheel(g, x, roll or 0) for x in BUS_WHEELS], 0)
    px.px = out
    return lit(g, dict(ttc=("red", None)))


# ---------- build ----------


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for each sprite at full size, then at every depth
    step: the garbage truck on a minis.Mini at TRUCK_SCALE x the step, the scooter, the tourist train and the
    TTC bus at road.SCALE x the step."""
    this = sys.modules[__name__]
    drive, drive_ms = obstacles.DRIVE
    for suffix, step in (("", 1), *(("@" + k, v) for k, v in STEPS)):
        yield f"stink-garbage-truck{suffix}", [("idle", [truck(garbage_truck, f, step) for f in (0, 1)], 400),
                                               ("drive", [truck(truck_driving, f, step) for f in drive], drive_ms)]
    for suffix, step in (("", 1), *(("@" + k, v) for k, v in STEPS)):
        s = SCALE * step
        yield f"minor-scooter{suffix}", [(tag, [small(this, s, d, a, 1 / s).outlined() for a in fargs], fms)
                                         for tag, d, fargs, fms in [("idle", scooter, (False, True), 500),
                                                                    *SCOOTER_MOVES]]
    for suffix, step in (("", 1), *(("@" + k, v) for k, v in STEPS)):
        s = SCALE * step
        yield f"{TRAIN_KEY}{suffix}", [(tag, [small(this, s, tourist_train, **q).outlined() for q in poses], ms)
                                       for tag, poses, ms in TRAIN_TAGS]
    for suffix, step in (("", 1), *(("@" + k, v) for k, v in STEPS)):
        s = SCALE * step
        yield f"{BUS_KEY}{suffix}", [(tag, [small(this, s, ttc_bus_crossing, **q).outlined() for q in poses], ms)
                                     for tag, poses, ms in BUS_TAGS]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/vehicles", __doc__)
