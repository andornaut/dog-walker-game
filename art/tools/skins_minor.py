#!/usr/bin/env python3
"""Draw the zone skins of the minor obstacles: each zone's own look for a minor
obstacle kind, with the base kind's size, footprint, anchor, idle tag and depth
variants (obstacles.py draws the base kinds). Like the base kinds they are
billboards from a low camera: a front elevation, squat, with at most a sliver of
top surface, and no people, so they read as something to bump rather than a
pickup or an encounter.

It builds the scooter alone, the one of these in play, as a moving road
obstacle. The others are not drawn in play (the game draws only the base
looks), so their exports stay as they are, unmaintained: they draw in pixels on
a plain Grid at full size.

Minor 1x1, 40x40, 1 lane (as cone and bin):
minor-sandwich-board  Main Street      an A-frame chalkboard with a cup and menu lines; a chalk star
                                       twinkles

Minor 1x3, 56x35, 1 lane by 3 rows of footprint, drawn at the footprint's near
edge (as parked-car):
minor-tricycles       Willow Crescent  a red tricycle from behind, a yellow one in the row behind it;
                                       the streamers flutter
minor-log             Fairview Park    a fallen log end on, mossy, a toadstool at its foot; a sprout
                                       on top sways
minor-scooter         Main Street      48x72, a sky scooter from behind on its stand, laid out on 32x48 and
                                       drawn at road.SCALE as hazards.cyclist is; the indicators blink

The 1x3 skins also have parked-car's pull-out (4 frames, 100ms), drawn pulling
right: the scooter as the car (tread lines climb the tyre, the right indicator
blinks), the tricycles' hub pips and the log's face crack turning clockwise. The
scooter also has ride (4 frames, 100ms): ridden down its lane at the pack,
facing the player as hazards.cyclist does, a rider in an open white helmet with
a sky stripe and a purple jacket on it behind the leg shield and headlight, the
tread falling down the tyre 1px a frame and the scooter and rider dipping 1px
onto it on frames 1 and 2.

Every sprite has one looping idle, frame 0 the rest pose. Each drawing function
takes the idle frame's argument and u, one pixel at the drawn size in full-size
units (1 at full size, 1/s on a minis.Mini at scale s), so motion stays 1px in
every depth variant. sprites() yields each full size, then each at every depth
step (minis.STEPS) drawn on a minis.Mini with its own outline.

Usage:
  skins_minor.py preview OUT.png   every frame on the four zone road colours
  skins_minor.py build             write art/skins_minor/*.aseprite and export to
                                   public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from minis import STEPS, small  # noqa: E402
from obstacles import PULL_OUT, SIZE, lit, treads  # noqa: E402
from pixel import Grid, edged, main  # noqa: E402
from road import SCALE, face_disc, face_front  # noqa: E402

# The parked car's frame: 1 lane by 3 rows of footprint, drawn at its near edge.
CAR_W, CAR_H = 56, 35
# The road colours of the zones these skins belong to: Willow Crescent, Fairview Park, Main Street and
# Riverside Path.
GROUNDS = ("8b9bb4", "e4a672", "f6757a", "ead4aa")


def frame(w, h):
    return edged(Grid(w, h))


# ---------- minor 1x1 ----------


def sandwich_board(star=0, u=1):
    """An A-frame chalkboard from the front: the back board's legs splay out behind; the face has a
    coffee cup and menu lines in chalk. star swells the chalk star to a cross."""
    g = frame(SIZE, SIZE)
    # the back board's legs, splayed out behind
    g.tri((7, 36), (10, 36), (16, 7), "plum")
    g.tri((30, 36), (33, 36), (24, 7), "plum")
    # the front board: a frame narrowing to the hinge at the top, on two feet
    g.tri((10, 34), (30, 34), (14, 6), "dbrown")
    g.tri((30, 34), (26, 6), (14, 6), "dbrown")
    g.tri((10, 34), (12, 34), (15, 6), "brown")
    g.rect(14, 6, 12, 1, "brown")
    g.rect(11, 34, 3, 2, "dbrown")
    g.rect(26, 34, 3, 2, "dbrown")
    g.rect(16, 4, 8, 2, "brown")
    # chalkboard face
    g.tri((13, 32), (27, 32), (16, 8), "teal")
    g.tri((27, 32), (24, 8), (16, 8), "teal")
    # cup and steam
    g.rect(16, 13, 6, 5, "white")
    g.rect(22, 14, 2, 2, "white")
    g.rect(17, 14, 4, 1, "lgrey")
    g.rect(15, 18, 8, 1, "white")
    g.p(18, 11, "white")
    g.p(19, 10, "white")
    # menu lines
    for y, w, c in ((21, 9, "yellow"), (24, 7, "white"), (27, 9, "pink"), (30, 6, "white")):
        g.rect(15, y, w, 1, c)
    g.p(24, 10, "yellow")
    if star:
        g.rect(23, 10, 3, 1, "yellow")
        g.rect(24, 9, 1, 3, "yellow")
    return g


# ---------- minor 1x3 ----------

def trike(g, cx, y, c, top, shade, seat):
    """The top of a tricycle from behind at centre cx, its handlebar on row y: a handlebar in the frame
    colour c (lit with top) with ink grips, and the seat on its stem."""
    g.rect(cx - 11, y, 22, 2, c)
    g.rect(cx - 11, y, 22, 1, top)
    g.rect(cx - 13, y - 1, 3, 4, "ink")
    g.rect(cx + 10, y - 1, 3, 4, "ink")
    g.rect(cx - 1, y + 2, 2, 5, shade)
    g.ell(cx, y + 4, 5, 2, seat)


def tricycles(flutter=0, u=1, roll=None):
    """A row of tricycles from behind: a red one at the near edge, the yellow one behind it peeking over
    its handlebar. Streamers hang from the red one's grips; flutter swings them 1px. roll (0 to 3) is a
    pull-out frame: the red one's hub pips turn a quarter a frame, clockwise, the top one half under the
    frame."""
    g = frame(CAR_W, CAR_H)
    for cx in (17, 39):
        g.ell(cx, 13, 4, 4.5, "ink")
        g.ell(cx, 13, 2, 2.5, "dslate")
    trike(g, 28, 3, "yellow", "white", "amber", "plum")
    # the red tricycle: wheels, the front wheel between them, the rear step, the stem, handlebar and seat
    for cx in (12, 44):
        g.ell(cx, 28, 6, 6.5, "ink")
        g.ell(cx, 28, 3, 3.5, "dslate")
        dx, dy = ((0, 0), (0, -1), (2, 0), (0, 2), (-2, 0))[0 if roll is None else roll + 1]
        g.rect(cx - 1 + dx, 27 + dy, 2, 2, "lgrey")
    g.rect(25, 26, 6, 9, "ink")
    g.rect(13, 23, 30, 4, "red")
    g.rect(13, 23, 30, 1, "pink")
    g.rect(13, 26, 30, 1, "dred")
    g.rect(25, 18, 6, 6, "red")
    g.rect(29, 18, 2, 6, "dred")
    g.rect(14, 14, 28, 2, "red")
    g.rect(14, 14, 28, 1, "pink")
    g.rect(11, 13, 4, 4, "white")
    g.rect(41, 13, 4, 4, "white")
    g.rect(13, 13, 2, 4, "lgrey")
    g.rect(43, 13, 2, 4, "lgrey")
    g.ell(28, 18, 6, 4, "navy")
    g.rect(23, 21, 10, 2, "navy")
    g.rect(24, 15, 5, 1, "slate")
    for x, c in ((11, "pink"), (13, "cyan"), (42, "cyan"), (44, "pink")):
        g.rect(x + (flutter * u if x < 28 else -flutter * u), 17, 1, 5, c)
    return lit(g)


def log(sway=0, u=1, roll=None):
    """A fallen log end on: bark round a pale cut face with growth rings, moss on top, a toadstool at its
    foot. A sprout on top sways 1px with sway. roll (0 to 3) is a pull-out frame, the log rolling right:
    the crack in its cut face turns a quarter a frame, clockwise."""
    g = frame(CAR_W, CAR_H)
    # twig stubs either side
    g.rect(3, 15, 6, 3, "dbrown")
    g.rect(47, 22, 6, 3, "dbrown")
    g.ell(28, 20, 22, 14, "dbrown")
    g.ell(28, 20, 22, 14, "dbrown", "plum")
    g.ell(28, 20, 18, 11, "skin1")
    g.ell(28, 20, 14, 8.5, "tan")
    g.ell(28, 20, 11, 6.5, "skin1")
    g.ell(28, 20, 7, 4, "tan")
    g.ell(28, 20, 3.5, 2, "ochre")
    g.rect(*((28, 11, 1, 5), (36, 20, 6, 1), (28, 25, 1, 5), (14, 20, 6, 1))[roll or 0], "ochre")
    # moss along the top
    g.ell(20, 7, 8, 2.5, "green", None, None)
    g.ell(33, 6.5, 7, 2, "dgreen")
    g.ell(32, 6, 5, 1.5, "green")
    # sprout
    g.rect(26, 2, 1, 4, "dgreen")
    g.rect(24 + sway * u, 1, 2, 2, "green")
    g.rect(27 + sway * u, 2, 2, 1, "green")
    # toadstool
    g.rect(45, 29, 2, 5, "cream")
    g.ell(46, 28.5, 4, 2.5, "red")
    g.p(44, 28, "white")
    g.p(47, 27, "white")
    return lit(g)


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


# Each sprite: (key, drawing, idle frame arguments, ms per frame, base kind, zone). Most hold the rest
# pose for two frames so the motion comes as a short event rather than a constant flicker.
SKINS = (
    ("minor-sandwich-board", sandwich_board, (0, 0, 1, 0), 400, "cone", "sniff-street-shops"),
    ("minor-tricycles", tricycles, (0, 0, 1, 0), 400, "parked-car", "snooze-crescent"),
    ("minor-log", log, (0, 0, 1, 0), 450, "parked-car", "bark-park"),
    ("minor-scooter", scooter, (False, True), 500, "parked-car", "sniff-street-shops"),
)
# The motion tags after a skin's idle: key to [(tag, drawing, frame arguments, ms per frame)].
MOVES = {"minor-log": [("pull-out", lambda roll, u=1: log(0, u, roll), *PULL_OUT)],
         "minor-scooter": [("pull-out", scooter_pulling, *PULL_OUT), ("ride", scooter_riding, range(4), SCOOTER_RIDE_MS)],
         "minor-tricycles": [("pull-out", lambda roll, u=1: tricycles(0, u, roll), *PULL_OUT)]}
# The zone road colour each skin is checked on.
ROAD = {"snooze-crescent": "8b9bb4", "bark-park": "e4a672", "sniff-street-shops": "f6757a",
        "paws-promenade": "ead4aa"}


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for the scooter at full size, then at every depth step,
    on a minis.Mini at road.SCALE x the step: idle (2 frames, 500ms), pull-out (4 frames, 100ms) and ride (4
    frames, SCOOTER_RIDE_MS). The other skins are not in play, so their exports stay as they are."""
    this = sys.modules[__name__]
    key, draw, args, ms, _, _ = next(skin for skin in SKINS if skin[0] == "minor-scooter")
    for suffix, step in (("", 1), *(("@" + k, v) for k, v in STEPS)):
        s = SCALE * step
        yield f"{key}{suffix}", [(tag, [small(this, s, d, a, 1 / s).outlined() for a in fargs], fms)
                                 for tag, d, fargs, fms in [("idle", draw, args, ms), *MOVES[key]]]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/skins_minor", __doc__, grounds=GROUNDS)
