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
a plain Grid at full size, and obstacles.span now gives a lane-spanning width in
layout units for a 1.4x minis.Mini.

Minor 1x1, 40x40, 1 lane (as cone and bin):
minor-gnome           Willow Crescent  a garden gnome on a grass tuft; it winks
minor-molehill        Fairview Park    a mound of soil with grass sprigs; crumbs pop from the top
minor-sandwich-board  Main Street      an A-frame chalkboard with a cup and menu lines; a chalk star
                                       twinkles
minor-tackle-box      Riverside Path   a green tackle box with a bobber on the lid; the lid lifts

Minor 2x1, 104x30, 2 lanes (as bench):
minor-kiddie-pool     Willow Crescent  three inflated rings, a rubber duck afloat; the duck bobs
minor-picnic-blanket  Fairview Park    a blue gingham blanket with a cool box, a mug and a thermos;
                                       the mug steams
minor-cafe-table      Main Street      a yellow gingham table, two green bistro chairs pushed in; the
                                       cup steams

Minor 3x1, 168x30, 3 lanes (as hedge):
minor-flower-bed      Fairview Park    tulips in a stone kerb; tulips nod at three spots in turn
minor-flower-cart     Main Street      a green flower cart on two wheels, bunches on top; the bunches
                                       rustle at three spots in turn
minor-rowboat-trailer Riverside Path   a red rowboat on a trailer, the tongue to the right; its bow
                                       pennant flaps

Minor 1x3, 56x35, 1 lane by 3 rows of footprint, drawn at the footprint's near
edge (as parked-car):
minor-tricycles       Willow Crescent  a red tricycle from behind, a yellow one in the row behind it;
                                       the streamers flutter
minor-log             Fairview Park    a fallen log end on, mossy, a toadstool at its foot; a sprout
                                       on top sways
minor-scooter         Main Street      48x72, a sky scooter from behind on its stand, laid out on 32x48 and
                                       drawn at road.SCALE as hazards.cyclist is; the indicators blink
minor-canoe-rack      Riverside Path   four canoes upturned on a two-bar rack; a rope end swings

The 1x3 skins also have parked-car's pull-out (4 frames, 100ms), drawn pulling
right: the scooter as the car (tread lines climb the tyre, the right indicator
blinks), the tricycles' hub pips and the log's face crack turning clockwise, the
canoe rack lurching 1px right on frames 1 and 2. The scooter also has ride (4
frames, 100ms): ridden up its lane away from the pack, a rider in a white helmet
with a sky stripe and a purple jacket on it, the tread climbing the tyre 1px a
frame and the scooter and rider dipping 1px onto it on frames 1 and 2.

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
from obstacles import PULL_OUT, ROW, SIZE, lit, span, treads  # noqa: E402
from pixel import Grid, edged, main  # noqa: E402
from road import SCALE  # noqa: E402

# The parked car's frame: 1 lane by 3 rows of footprint, drawn at its near edge.
CAR_W, CAR_H = 56, 35
# The road colours of the zones these skins belong to: Willow Crescent, Fairview Park, Main Street and
# Riverside Path.
GROUNDS = ("8b9bb4", "e4a672", "f6757a", "ead4aa")


def frame(w, h):
    return edged(Grid(w, h))


# ---------- minor 1x1 ----------

def gnome(wink=0, u=1):
    """A garden gnome on a grass tuft: red hat, white beard, blue coat. wink closes his left eye."""
    g = frame(SIZE, SIZE)
    g.ell(20, 34, 10, 3, "dgreen")
    g.rect(10, 34, 20, 2, "dgreen")
    for x in (11, 15, 24, 28):
        g.rect(x, 31, 1, 2, "green")
    g.rect(14, 30, 5, 4, "dbrown")
    g.rect(21, 30, 5, 4, "dbrown")
    # coat, flaring to the hem, shaded right
    g.tri((13, 19), (27, 19), (29, 31), "blue")
    g.tri((13, 19), (11, 31), (29, 31), "blue")
    g.tri((20, 19), (27, 19), (29, 31), "navy")
    g.tri((20, 19), (20, 31), (29, 31), "navy")
    g.rect(11, 26, 18, 2, "ink")
    g.rect(19, 26, 3, 2, "amber")
    # arms and hands
    g.ell(11.5, 23, 2.5, 4, "blue")
    g.ell(28.5, 23, 2.5, 4, "navy")
    g.rect(10, 26, 3, 2, "skin1")
    g.rect(27, 26, 3, 2, "skin2")
    # beard, face and nose
    g.tri((13, 15), (27, 15), (20, 27), "white")
    g.tri((20, 15), (27, 15), (20, 27), "lgrey")
    g.rect(14, 13, 12, 4, "skin1")
    g.rect(22, 13, 4, 4, "skin2")
    g.ell(20, 16.5, 2, 1.8, "pink")
    if wink:
        g.rect(16, 14, 2, 1, "ink")
    else:
        g.rect(16, 14, 1, 2, "ink")
    g.rect(23, 14, 1, 2, "ink")
    # pointed hat, shaded right, with a brim
    g.tri((12, 13), (28, 13), (19, 1), "red")
    g.tri((20, 13), (28, 13), (19, 1), "dred")
    g.rect(12, 11, 16, 2, "red")
    g.rect(21, 11, 7, 2, "dred")
    g.rect(15, 8, 2, 2, "pink")
    return lit(g)


def molehill(crumb=0, u=1):
    """A mound of dark soil with grass sprigs at its foot. crumb 1 throws two crumbs above the top,
    crumb 2 has them landing on the slope."""
    g = frame(SIZE, SIZE)
    g.ell(20, 37, 13, 15, "dbrown", "plum", "brown")
    # the mound sits on row 35
    g.rect(0, 36, SIZE, SIZE - 36, None)
    # clods on the slope: a lit top over a shaded underside
    for x, y in ((14, 27), (22, 25), (17, 31), (25, 29), (11, 33), (23, 33)):
        g.rect(x, y, 3, 1, "brown")
        g.rect(x, y + 1, 3, 1, "plum")
    # the hole at the top
    g.ell(20, 23.5, 4, 1.5, "ink")
    # grass at the foot and a pebble
    for x, h in ((6, 4), (8, 6), (10, 3), (29, 5), (31, 3), (33, 5)):
        g.rect(x, 36 - h, 1, h, "green")
    g.rect(28, 34, 4, 2, "lgrey")
    g.rect(30, 35, 2, 1, "grey")
    if crumb == 1:
        g.rect(17, 19 - u, 2, 2, "dbrown")
        g.rect(22, 18 - 2 * u, 2, 2, "brown")
    elif crumb == 2:
        g.rect(14, 23, 2, 2, "brown")
        g.rect(25, 22, 2, 2, "dbrown")
    return g


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


def tackle_box(lift=0, u=1):
    """A green tackle box with a carry handle, a latch and a bobber on the lid. lift raises the lid
    (negative is up) on the dark gap and the lures in it."""
    g = frame(SIZE, SIZE)
    g.rect(9, 22, 22, 13, "dgreen")
    g.rect(21, 22, 10, 13, "forest")
    g.rect(9, 34, 22, 1, "forest")
    g.rect(11, 35, 3, 1, "ink")
    g.rect(26, 35, 3, 1, "ink")
    g.rect(9, 27, 22, 1, "forest")
    if lift:
        g.rect(9, 22 + lift, 22, -lift, "ink")
        g.p(13, 21, "red")
        g.p(17, 21, "yellow")
        g.p(24, 21, "cyan")
    # the lid, lit along the top
    g.rect(8, 17 + lift, 24, 5, "dgreen")
    g.rect(8, 17 + lift, 24, 1, "green")
    g.rect(21, 18 + lift, 11, 4, "forest")
    g.rect(18, 21 + lift, 4, 3, "amber")
    g.rect(18, 21 + lift, 4, 1, "yellow")
    # handle
    g.rect(15, 13 + lift, 10, 2, "ink")
    g.rect(15, 13 + lift, 2, 4, "ink")
    g.rect(23, 13 + lift, 2, 4, "ink")
    # bobber on the lid
    g.ell(11.5, 14.5 + lift, 2.5, 2.5, "red")
    g.rect(9, 15 + lift, 5, 2, "white")
    g.rect(11, 10 + lift, 1, 2, "ink")
    return lit(g)


# ---------- minor 2x1 ----------

def ring(g, x0, x1, y, h, base, top, shade):
    """An inflated tube across x0..x1 on rows y to y + h - 1, rounded at the ends."""
    g.rect(x0 + 2, y, x1 - x0 - 4, h, base)
    for x in (x0 + 2, x1 - 2):
        g.ell(x, y + h / 2, 2.5, h / 2, base)
    g.rect(x0 + 3, y, x1 - x0 - 6, 1, top)
    g.rect(x0 + 2, y + h - 1, x1 - x0 - 4, 1, shade)


def kiddie_pool(bob=0, u=1):
    """A paddling pool of three inflated rings, sky, yellow, sky, with a rubber duck afloat behind the
    top ring. bob lifts the duck."""
    w = span(2)
    g = frame(w, ROW)
    # the water's surface behind the top ring's far side, a wave crest along it
    g.rect(8, 8, w - 16, 2, "cyan")
    for x in range(14, w - 14, 18):
        g.rect(x, 8, 4, 1, "white")
    # the duck, afloat behind the top ring
    y = 3 - bob * u
    g.ell(72, y + 7, 6, 4, "yellow")
    g.ell(76, y + 3, 3.5, 3.5, "yellow")
    g.rect(79, y + 3, 3, 2, "orange")
    g.p(77, y + 2, "ink")
    g.rect(68, y + 6, 3, 1, "amber")
    ring(g, 2, w - 2, 10, 6, "sky", "white", "blue")
    ring(g, 3, w - 3, 16, 6, "yellow", "white", "amber")
    ring(g, 2, w - 2, 22, 7, "sky", "cyan", "blue")
    # spots on the middle ring and a valve
    for x in range(12, w - 10, 14):
        g.rect(x, 18, 3, 2, "white")
    g.rect(w - 14, 24, 3, 2, "white")
    return g


def gingham(g, x, y, w, rows, cell, dark, mid, light):
    """Gingham across x..x+w over bands of rows (a list of band heights, top first): a band and a column
    both dark-striped are dark, one is mid, neither is light."""
    for i, h in enumerate(rows):
        for j, cx in enumerate(range(x, x + w, cell)):
            n = (i % 2) + (j % 2)
            g.rect(cx, y, min(cell, x + w - cx), h, (light, mid, dark)[n])
        y += h


def picnic_blanket(steam=0, u=1):
    """A blue gingham blanket on the ground, its checks narrowing toward the far edge, with a sky cool
    box, a white mug and a red thermos on it. steam 1 and 2 raise a wisp off the mug."""
    w = span(2)
    g = frame(w, ROW)
    gingham(g, 3, 21, w - 6, (2, 3, 3), 8, "blue", "sky", "white")
    g.rect(2, 28, w - 4, 1, "navy")
    # cool box, lit on top
    g.rect(14, 10, 22, 13, "sky")
    g.rect(28, 10, 8, 13, "blue")
    g.rect(13, 8, 24, 3, "white")
    g.rect(13, 10, 24, 1, "lgrey")
    g.rect(21, 5, 8, 1, "ink")
    g.rect(21, 5, 1, 3, "ink")
    g.rect(28, 5, 1, 3, "ink")
    g.rect(18, 15, 8, 3, "white")
    # mug
    g.rect(52, 15, 7, 8, "yellow")
    g.rect(57, 15, 2, 8, "amber")
    g.rect(59, 17, 2, 3, "amber")
    g.rect(52, 15, 7, 1, "dbrown")
    if steam:
        g.rect(54 + (steam - 1), 13 - 2 * steam, 1, 2, "white")
    # thermos
    g.rect(74, 7, 8, 16, "red")
    g.rect(79, 7, 3, 16, "dred")
    g.rect(74, 4, 8, 3, "lgrey")
    g.rect(79, 4, 3, 3, "grey")
    g.rect(74, 13, 8, 2, "white")
    return lit(g)


def bistro_chair(g, x):
    """A green bistro chair from behind, 16 wide at x: a rounded back of three slats over the seat
    edge and legs."""
    g.rect(x + 1, 11, 14, 2, "forest")
    g.rect(x + 1, 11, 14, 1, "green")
    for i in range(4):
        g.rect(x + 1 + i * 4 + (i == 3), 12, 2, 10, "forest")
    g.rect(x + 1, 12, 1, 10, "green")
    g.rect(x, 21, 16, 2, "forest")
    g.rect(x, 21, 16, 1, "green")
    for lx in (x + 1, x + 13):
        g.rect(lx, 23, 2, 6, "forest")


def cafe_table(steam=0, u=1):
    """A long cafe table under a yellow gingham cloth with a scalloped hem, two green bistro chairs
    pushed in on the near side, a cup and a vase of flowers on top. steam 1 and 2 raise a wisp
    off the cup."""
    w = span(2)
    g = frame(w, ROW)
    # legs under the cloth
    for x in (8, w - 10):
        g.rect(x, 20, 2, 9, "dslate")
    g.rect(4, 7, w - 8, 2, "yellow")
    gingham(g, 4, 9, w - 8, (3, 4, 4, 1), 6, "orange", "amber", "white")
    for x in range(4, w - 4, 6):
        g.rect(x + 2, 20, 2, 1, "amber")
    # cup and saucer
    g.rect(46, 5, 6, 2, "white")
    g.rect(52, 5, 2, 1, "white")
    g.rect(45, 6, 9, 1, "lgrey")
    if steam:
        g.rect(48 + (steam - 1), 3 - 2 * steam + 1, 1, 2, "white")
    # vase and flowers
    g.rect(72, 3, 4, 4, "sky")
    g.rect(74, 3, 2, 4, "blue")
    g.rect(73, 1, 1, 2, "dgreen")
    g.rect(76, 1, 1, 2, "dgreen")
    g.rect(71, 0, 3, 2, "purple")
    g.rect(75, 0, 3, 2, "yellow")
    bistro_chair(g, 20)
    bistro_chair(g, w - 36)
    return lit(g)


# ---------- minor 3x1 ----------

TULIPS = ("red", "yellow", "purple", "white")


def flower_bed(nod=(), u=1):
    """A bed of tulips in a stone kerb. nod lists the tulips, by index, whose heads tip 1px right."""
    w = span(3)
    g = frame(w, ROW)
    for i, x in enumerate(range(7, w - 6, 8)):
        dx = u if i in nod else 0
        g.rect(x + 1, 9, 1, 10, "dgreen")
        g.rect(x + dx, 5 + (i % 2), 3, 4, TULIPS[i % 4])
        g.p(x + 1 + dx, 5 + (i % 2), "dgreen" if TULIPS[i % 4] != "purple" else "pink")
    # leaves along the bed
    for x in range(5, w - 6, 6):
        g.ell(x + 2, 17, 3.5, 3, "green", "dgreen")
    g.rect(3, 18, w - 6, 2, "dbrown")
    # the kerb: two courses of stone blocks, lit on top
    g.rect(2, 20, w - 4, 9, "lgrey")
    g.rect(2, 20, w - 4, 1, "white")
    g.rect(2, 24, w - 4, 1, "grey")
    g.rect(2, 28, w - 4, 1, "grey")
    for x in range(14, w - 4, 14):
        g.rect(x, 21, 1, 3, "grey")
        g.rect(x - 7, 25, 1, 3, "grey")
    return g


BUNCHES = ("yellow", "white", "purple", "orange", "cyan", "white", "yellow", "purple", "orange", "cyan")


def flower_cart(rustle=(), u=1):
    """A green flower cart side on: bunches of flowers along its top, two spoked wheels, the shafts out
    to the right on a prop. rustle lists the bunches, by index, that lift 1px and shift 1px right."""
    w = span(3)
    g = frame(w, ROW)
    # shafts and their prop
    g.rect(140, 15, 26, 2, "dbrown")
    g.rect(140, 15, 26, 1, "brown")
    g.rect(161, 17, 2, 12, "dbrown")
    # bunches in tin buckets: leaves, then five heads round an amber centre each
    for i, x in enumerate(range(9, 136, 13)):
        r = u if i in rustle else 0
        c = BUNCHES[i]
        g.rect(x + 2, 9, 8, 4, "lgrey")
        g.rect(x + 7, 9, 3, 4, "grey")
        g.ell(x + 6, 8, 6, 2.5, "green", "dgreen")
        top = 2 + (i % 2) - r
        for dx, dy in ((0, 2), (4, 0), (8, 2), (2, 4), (6, 4)):
            g.rect(x + 1 + dx + r, top + dy, 3, 2, c)
            g.p(x + 2 + dx + r, top + dy, "amber" if c != "yellow" else "orange")
    # the cart body: planks, lit along the top
    g.rect(6, 13, 136, 11, "forest")
    g.rect(6, 13, 136, 1, "green")
    g.rect(6, 18, 136, 1, "dgreen")
    g.rect(6, 23, 136, 1, "teal")
    for x in (6, 72, 140):
        g.rect(x, 13, 2, 11, "dgreen")
    # wheels
    for cx in (28, 118):
        g.ell(cx, 23, 6, 6, "ink")
        g.ell(cx, 23, 4, 4, "dbrown")
        g.rect(cx - 4, 22, 8, 2, "brown")
        g.rect(cx - 1, 19, 2, 8, "brown")
        g.rect(cx - 1, 22, 2, 2, "lgrey")
    return lit(g)


def rowboat_trailer(flap=0, u=1):
    """A red rowboat side on, bow to the left, on a slate trailer with tandem wheels and its tongue and
    jockey wheel to the right, an oar along the gunwale and a yellow pennant at the bow. flap folds the
    pennant's tip down."""
    w = span(3)
    g = frame(w, ROW)
    # trailer: rail, tongue, coupler and jockey wheel
    g.rect(14, 21, 130, 3, "dslate")
    g.rect(14, 21, 130, 1, "slate")
    g.rect(144, 22, 18, 2, "dslate")
    g.rect(160, 20, 5, 4, "ink")
    g.rect(154, 24, 2, 3, "dslate")
    g.rect(152, 26, 6, 3, "ink")
    # bow pennant on its pole
    g.rect(12, 0, 1, 7, "dbrown")
    if flap:
        g.tri((13, 0.5), (13, 4.5), (20, 3.5), "yellow")
    else:
        g.tri((13, 0.5), (13, 4.5), (20, 2.5), "yellow")
    # hull: bow rising to the left, square stern on the right
    for y in range(6, 21):
        x = 4 + round(((y - 6) / 15) ** 2 * 16)
        g.rect(x, y, 144 - x, 1, "red" if y < 15 else "dred")
    g.rect(4, 6, 140, 2, "white")
    g.rect(140, 6, 4, 15, "dred")
    g.rect(4, 6, 140, 1, "dbrown")
    # oar along the gunwale, its blade over the stern
    g.rect(30, 4, 112, 1, "brown")
    g.rect(140, 2, 12, 3, "amber")
    g.rect(140, 4, 12, 1, "orange")
    # tie-down straps
    for x in (48, 108):
        g.rect(x, 6, 2, 15, "amber")
    # tandem wheels
    for cx in (66, 84):
        g.ell(cx, 24.5, 5, 4.5, "ink")
        g.rect(cx - 1, 24, 2, 2, "lgrey")
    return lit(g)


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
# The ride's 4 frames, each this long: the tyre's tread climbs 1px a frame, as obstacles.DRIVE's.
SCOOTER_RIDE_MS = 100


def scooter(blink=False, u=1, roll=None, rider=False):
    """A sky scooter from behind: its tyre between the two round side cowls, the tail light and plate under
    the seat, the leg shield and handlebar with its mirrors over it. Parked (roll None), it stands on its
    stand and blink lights both indicators on the cowls. roll (0 to 3) is a pull-out or ride frame: tread
    lines climb the tyre 1px a frame (obstacles.treads) and the stand is up; pulling out, the right
    indicator is lit on frames 0 and 1. rider seats its rider: a white helmet with a sky stripe, a purple
    jacket, jeans, the arms out to the grips; riding, the scooter and rider dip 1px onto the tyre on frames
    1 and 2. u is one pixel at the drawn size, in layout units."""
    g = frame(SCOOTER_W, SCOOTER_H)
    px = getattr(g, "g", g)
    # the tyre first, so the body can dip over it
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
        on = blink or (roll is not None and not rider and roll < 2 and x > SCOOTER_W / 2)
        g.rect(x, 35, 2, 2, "yellow" if on else "orange")
        if on:
            g.rect(x, 35, 2, 1, "white")
    if rider:
        # jeans on the seat
        g.rect(10, 27, 12, 3, "navy")
        g.rect(19, 27, 3, 3, "ink")
        # the arms reaching forward to the grips, then the jacket, lit on the left and shaded down the right
        for x, c in ((7.5, "purple"), (21.5, "plum")):
            g.rect(x, 17, 3, 5, c)
        g.rect(6, 21, 3, 2, "dbrown")
        g.rect(23, 21, 3, 2, "dbrown")
        g.cel(16, 21, 6.5, 7, "purple", "plum", "mauve")
        g.rect(9.5, 21, 13, 7, "purple")
        g.rect(9.5, 21, 1, 7, "mauve")
        g.rect(19.5, 21, 3, 7, "plum")
        g.rect(14.5, 13, 3, 2, "skin2")
        # the helmet from behind, a sky stripe over the crown
        g.cel(16, 9, 6, 6, "white", "lgrey")
        g.rect(15, 3, 2, 11, "sky")
        g.rect(11, 14, 10, 1, "dslate")
    dip = 1 if rider and roll in (1, 2) else 0
    body = px.px
    px.px = [[(body[y - dip][x] if y >= dip else None) or wheel[y][x] for x in range(px.w)] for y in range(px.h)]
    return lit(g)


def scooter_pulling(roll, u=1):
    """scooter's pull-out frame roll, riderless."""
    return scooter(False, u, roll)


def scooter_riding(roll, u=1):
    """scooter's ride frame roll: ridden up its lane, away from the pack."""
    return scooter(False, u, roll, rider=True)


# Each canoe's colour and its light, per rack bar, left then right.
CANOES = ((("dgreen", "green"), ("amber", "yellow")), (("red", "pink"), ("sky", "cyan")))


def canoe(g, x, y, c, li):
    """An upturned canoe end on, 20 wide at x with its gunwale on row y + 9: a pointed arch with the stem
    rising at its peak, lit on the upper left."""
    for k in range(8):
        half = round(10 * (1 - ((7 - k) / 8) ** 1.6) ** 0.5)
        g.rect(x + 10 - half, y + 1 + k, 2 * half, 1, c)
        g.rect(x + 10 - half, y + 1 + k, min(2, half), 1, li)
    g.rect(x + 9, y, 2, 3, "dbrown")
    g.rect(x + 1, y + 7, 18, 1, "white")
    g.rect(x + 1, y + 8, 18, 1, "dbrown")


def canoe_rack(swing=0, u=1):
    """Four canoes upturned on a two-bar rack, seen end on, two to a bar: green and yellow on top, red and
    sky below, the rack's posts either side. A rope end hangs from the top bar and swings 1px with
    swing."""
    g = frame(CAR_W, CAR_H)
    for x in (2, 51):
        g.rect(x, 1, 3, 34, "dbrown")
        g.rect(x, 1, 1, 34, "brown")
    for (left, right), y in zip(CANOES, (3, 19)):
        canoe(g, 6, y, *left)
        canoe(g, 29, y, *right)
        g.rect(2, y + 9, 52, 3, "dbrown")
        g.rect(2, y + 9, 52, 1, "brown")
    # rope end, knotted round the top bar
    g.rect(26, 12, 3, 2, "amber")
    g.rect(27 + swing * u, 14, 1, 5, "amber")
    g.rect(26 + swing * u, 19, 3, 1, "orange")
    return lit(g)


def canoe_rack_pulling(roll, u=1):
    """canoe_rack's pull-out frame roll: the rack lurches 1px right on frames 1 and 2, the rope end lagging
    1px left."""
    lurch = roll in (1, 2)
    g = canoe_rack(-1 if lurch else 0, u)
    if lurch:
        px = getattr(g, "g", g).px
        for y, row in enumerate(px):
            px[y] = [None] + row[:-1]
    return g


# Each sprite: (key, drawing, idle frame arguments, ms per frame, base kind, zone). Most hold the rest
# pose for two frames so the motion comes as a short event rather than a constant flicker.
SKINS = (
    ("minor-gnome", gnome, (0, 0, 0, 1), 400, "cone", "snooze-crescent"),
    ("minor-molehill", molehill, (0, 0, 1, 2), 400, "cone", "bark-park"),
    ("minor-sandwich-board", sandwich_board, (0, 0, 1, 0), 400, "cone", "sniff-street-shops"),
    ("minor-tackle-box", tackle_box, (0, 0, -1, 0), 400, "cone", "paws-promenade"),
    ("minor-kiddie-pool", kiddie_pool, (0, 0, 1, 0), 450, "bench", "snooze-crescent"),
    ("minor-picnic-blanket", picnic_blanket, (0, 0, 1, 2), 450, "bench", "bark-park"),
    ("minor-cafe-table", cafe_table, (0, 0, 1, 2), 450, "bench", "sniff-street-shops"),
    ("minor-flower-bed", flower_bed, ((), (3,), (9,), (15,)), 350, "hedge", "bark-park"),
    ("minor-flower-cart", flower_cart, ((), (1,), (4,), (8,)), 350, "hedge", "sniff-street-shops"),
    ("minor-rowboat-trailer", rowboat_trailer, (0, 0, 1, 0), 400, "hedge", "paws-promenade"),
    ("minor-tricycles", tricycles, (0, 0, 1, 0), 400, "parked-car", "snooze-crescent"),
    ("minor-log", log, (0, 0, 1, 0), 450, "parked-car", "bark-park"),
    ("minor-scooter", scooter, (False, True), 500, "parked-car", "sniff-street-shops"),
    ("minor-canoe-rack", canoe_rack, (0, 0, 1, 0), 450, "parked-car", "paws-promenade"),
)
# The motion tags after a skin's idle: key to [(tag, drawing, frame arguments, ms per frame)].
MOVES = {"minor-canoe-rack": [("pull-out", canoe_rack_pulling, *PULL_OUT)],
         "minor-log": [("pull-out", lambda roll, u=1: log(0, u, roll), *PULL_OUT)],
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
