#!/usr/bin/env python3
"""Draw the zone skins of the two area encounters: Splash, which reskins the
puddle, and Stink, which reskins the skunk and its haze. A skin changes the
look only: each keeps its base kind's footprint, tags, frame counts, timings
and anchor (the base on the last opaque row of frame 0).

Splash, a 2x1 area (2 lanes, 1 row): a ground decal like road.puddle, 104x40,
no outline and no shadow, drawn under everything. idle (2 frames, 500ms).

splash-sprinkler    Willow Crescent: an oscillating lawn sprinkler in the puddle it makes, a fan
                    of drops arcing from its bar that sweeps left, then right
splash-mud          Fairview Park: a lumpy mud patch with muddy paw prints leading in and out; a
                    bubble swells, then pops
splash-milkshake    Main Street: a striped paper cup on its side, a chocolate milkshake spilt from
                    it with whipped cream and a cherry; a drip falls from the lip
splash-shore        Riverside Path: the river washing over the boards, a scalloped foam crest
                    along its near edge; the crest rolls in 1px and the spray jumps

Stink, a 2x2 area (2 lanes, 2 rows): a source sprite that stands in a stink haze,
as road.skunk stands in road.skunk_cloud. The source has the road outline and
road.LIT's rim; idle (2 frames, 400ms). Three of them stand in skunk-cloud
itself; the fish crate has its own haze (see below).

stink-compost       40x40   Willow Crescent: a compost heap of soil, a banana peel, an apple core, a
                            lettuce leaf and an eggshell, two flies buzzing over it; skunk-cloud
stink-fish-crate    40x40   Main Street: a slatted wooden crate on crushed ice, two fish poking out,
                            one flipping its tail; stink-fish-crate-cloud
stink-seaweed       40x40   Riverside Path: a heap of kelp ribbons with a pink shell and a crab on
                            top that raises its claws; skunk-cloud
stink-garbage-truck 56x60   The Long Way Home: a rear-loader garbage truck from behind, its hopper
                            open on bags and a banana peel, the beacon blinking, two flies;
                            skunk-cloud. Laid out on 56x50 and drawn as obstacles.delivery_truck is
                            (56 columns, rows 1.2x), so it centres on a lane with 4px to spare, taller
                            than the delivery truck (56x54) and as tall as the ice cream truck.
                            drive (4 frames, 100ms): reversing down the lane at the pack, tread
                            lines fall down the tyres, the body dips 1px onto them on frames 1
                            and 2, the beacon blinks

stink-fish-crate-cloud      104x50, loop (4 frames, 220ms) like skunk-cloud: the same puffs, rim
                            and dither, one step down the mauve ramp: fill purple with plum
                            pixels, plum wisps. Main Street's road is pink and its shadow mauve,
                            so skunk-cloud's mauve fill would vanish into it.

The drawings, the garbage truck's aside, are in the 32px units of a 32x32 road sprite, drawn on a
minis.Mini at BIG (1.25x), as encounters.py draws: a 2-lane decal is TWO_LANES units wide, so 104px. A
1px line stays 1px and motion moves whole pixels. The hazes are drawn in pixels at their own size (haze). Every key also
has <key>@<step> for each depth step in minis.STEPS, redrawn at BIG x the step (the haze at the
step), floor(size x scale + 0.5), with the original's tags, frames and durations.

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
from minis import STEPS, Mini, scaled, small  # noqa: E402
from obstacles import treads, unit  # noqa: E402
from pixel import K, Grid, edged, main  # noqa: E402

BIG = 1.25
TWO_LANES = (64 * 2 - 24) / BIG
# The garbage truck is laid out on 56x50 and drawn as obstacles.delivery_truck is, its columns kept (a lane less
# 4px each side) and its rows TRUCK_SCALE times taller: 56x60, taller than the delivery truck's 54 and as tall
# as road.ice_cream_truck.
TRUCK_W, TRUCK_H = 56, 50
TRUCK_SCALE = obstacles.CAR_SCALE
# The stink haze's frame at full size: 2 lanes wide, skunk-cloud's 40 rows x 1.25.
HAZE_W, HAZE_H = 104, 50
# The zone roads, for the preview: Willow Crescent, Fairview Park, Main Street, Riverside Path and The
# Long Way Home.
GROUNDS = ("8b9bb4", "e4a672", "f6757a", "ead4aa", "c28569")


def mini(s):
    """A grid maker for scale s."""
    return lambda w=32, h=32: Mini(s, w, h)


def scale_of(g):
    return getattr(g, "s", 1)


def raster(g):
    """The grid that holds g's pixels."""
    return getattr(g, "g", g)


def lit(g):
    """road.rim with road.LIT on the grid that holds the pixels, so a Mini gets the rim at its own size."""
    road.rim(raster(g), road.LIT)
    return g


def line(g, x0, y0, x1, y1, c):
    """A 1px line between two points in drawing units, stepped in output pixels so it has no gaps at any
    scale."""
    s, px = scale_of(g), raster(g)
    a, b = (x0 + 0.5) * s, (y0 + 0.5) * s
    n = max(1, math.ceil(max(abs(x1 - x0), abs(y1 - y0)) * s))
    for k in range(n + 1):
        t = k / n
        px.p(math.floor(a + (x1 - x0) * s * t), math.floor(b + (y1 - y0) * s * t), c)


def dot(g, x, y, c):
    """One output pixel at (x, y) in drawing units, whatever the scale."""
    s = scale_of(g)
    raster(g).p(math.floor((x + 0.5) * s), math.floor((y + 0.5) * s), c)


def rim_in(g, c, among):
    """Recolour c every pixel of a colour in among that touches an empty pixel or the frame's edge: a 1px
    rim inside the shape at any scale. A ground decal has no outline outside it."""
    px = raster(g)
    among = {K[a] for a in among}
    edge = [(x, y) for y in range(px.h) for x in range(px.w) if px.px[y][x] in among
            and any(not (0 <= x + dx < px.w and 0 <= y + dy < px.h) or not px.px[y + dy][x + dx]
                    for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)))]
    for x, y in edge:
        px.p(x, y, c)


def quad(g, a, b, c, d, col):
    """A filled quadrilateral a b c d, as two triangles."""
    g.tri(a, b, c, col)
    g.tri(a, c, d, col)


# ---------- Splash ----------

def sprinkler(f, new=Grid):
    """Willow Crescent's splash: an oscillating sprinkler on a green sled in the middle of its puddle,
    its grey bar holed along the top, and four jets of drops arcing high from the bar and landing in the
    water. f 0 sweeps the fan left, 1 right. The drops are white and cyan with a blue pixel under each,
    so they hold on the grey road."""
    w = TWO_LANES
    g = new(w, 32)
    lobes = [(25, 23, 23, 7), (57, 22, 23.5, 7.5)]
    for cx, cy, rx, ry in lobes:
        g.ell(cx, cy, rx, ry, "sky")
    rim_in(g, "blue", ("sky",))
    # ripples where the drops land, shifting a pixel each frame
    for x, y, n in ((10, 21, 4), (22, 26, 5), (60, 26, 6), (72, 20, 4), (44, 27, 3)):
        g.rect(x + (1 if f else 0) * (1 if x < 41 else -1), y, n, 1, "cyan")
    # the sled and the bar
    cx = w / 2
    g.rect(cx - 9, 24, 18, 3, "dgreen")
    g.rect(cx - 9, 24, 18, 1, "green")
    g.rect(cx - 8, 20, 2, 4, "green")
    g.rect(cx + 6, 20, 2, 4, "dgreen")
    g.rect(cx - 6, 20, 12, 3, "lgrey")
    g.rect(cx - 6, 22, 12, 1, "grey")
    for k in range(5):
        g.p(cx - 5 + 2.5 * k, 20, "slate")
    # the fan: a jet from four holes, each a parabola of drops landing on the water
    lean = -0.9 if f == 0 else 0.9
    for k, vx in enumerate((-2.9, -1.1, 1.1, 2.9)):
        hx = cx - 4.5 + 3 * k
        vx += lean
        for i in range(1, 60):
            t = i * 0.35
            x, y = hx + vx * t, 19 - 5.6 * t + 0.5 * t * t
            if y > 21 or not 1 <= x <= w - 2:
                break
            if i % 3 == 2:
                continue
            dot(g, x, y + 1, "blue")
            dot(g, x, y, "white" if i % 3 == 0 else "cyan")
    return g


def mud(f, new=Grid):
    """Fairview Park's splash: a lumpy mud patch, dbrown in a plum rim that holds on the tan path and its
    shadow, wet brown sheen and tan glints on it, splats round it and muddy paw prints walking out of it
    at both ends. f 0 has a bubble swelling, 1 its popped ring and a new bubble beside it."""
    w = TWO_LANES
    g = new(w, 32)
    for cx, cy, rx, ry in ((21, 22.5, 17, 7), (42, 20.5, 19, 9), (64, 23, 14, 6.5)):
        g.ell(cx, cy, rx, ry, "dbrown")
    for x, y in ((5, 20), (24, 13), (58, 14), (79, 22), (34, 30), (71, 29)):
        g.ell(x, y, 1.2, 0.9, "dbrown")
    rim_in(g, "plum", ("dbrown",))
    # wet sheen and glints
    for x, y, n in ((14, 19, 7), (36, 16, 9), (56, 21, 6), (27, 25, 5), (67, 25, 4)):
        g.rect(x, y, n, 1, "brown")
        g.p(x + 1, y, "tan")
    # paw prints: out to the upper left, and in from the lower right
    for x, y in ((9, 9), (3, 6), (74, 30), (79, 27)):
        g.ell(x, y + 1.2, 1.4, 1, "dbrown")
        for dx in (-1.5, 0, 1.5):
            g.p(x + dx, y - 0.6 - (0.4 if dx == 0 else 0), "dbrown")
    # the bubble
    if f == 0:
        g.ell(48, 18, 2.4, 1.8, "brown")
        g.p(47, 17, "tan")
    else:
        for x, y in ((46, 18), (47, 17), (48, 17), (49, 17), (50, 18), (47, 19), (48, 19), (49, 19)):
            g.p(x, y, "brown")
        g.ell(31, 22, 1.4, 1.1, "brown")
        g.p(31, 21, "tan")
    return g


def milkshake(f, new=Grid):
    """Main Street's splash: a white paper cup with red stripes on its side at the left, its mouth to the
    right, a chocolate milkshake spilt out of it in a splat with round lobes and splashes, in a dbrown
    rim, with cream swirled through it, a dollop of whipped cream and a cherry. The cup's underside and
    the cream are shaded lgrey, so they hold on the pink road. f 1 drips a drop from the cup's lip and
    shifts the sheen."""
    w = TWO_LANES
    g = new(w, 32)
    for cx, cy, rx, ry in ((45, 22, 22, 8.5), (64, 19.5, 12, 6.5), (69, 26, 9, 4.5), (31, 25.5, 10, 5),
                           (52, 14.5, 7, 4)):
        g.ell(cx, cy, rx, ry, "brown")
    for x, y, r in ((80, 23, 1.6), (77, 15, 1.2), (60, 9, 1.3), (42, 12, 1), (14, 30, 1.2), (55, 30.5, 1)):
        g.ell(x, y, r, r * 0.8, "brown")
    rim_in(g, "dbrown", ("brown",))
    # sheen and a cream swirl in the spill
    s = 1 if f else 0
    for x, y, n in ((40, 17, 6), (60, 16, 5), (66, 25, 4), (46, 27, 6), (52, 12, 3)):
        g.rect(x + s, y, n, 1, "tan")
    for x0, y0, x1, y1 in ((48, 21, 52, 20), (52, 20, 57, 21), (57, 21, 58, 23), (58, 23, 54, 24)):
        line(g, x0, y0, x1, y1, "cream")
    # the cup on its side: closed end left, the wider mouth right
    top = lambda x: 15 - (x - 3) * 0.1  # noqa: E731
    bottom = lambda x: 25 + (x - 3) * 0.1  # noqa: E731
    quad(g, (2, top(2)), (23, top(23)), (23, bottom(23)), (2, bottom(2)), "lgrey")
    quad(g, (3, top(3) + 1), (23, top(23) + 1), (23, bottom(23) - 1.5), (3, bottom(3) - 1.5), "white")
    for x0 in (6, 12, 18):
        quad(g, (x0, top(x0) + 1), (x0 + 2.5, top(x0 + 2.5) + 1), (x0 + 2.5, bottom(x0 + 2.5) - 1),
             (x0, bottom(x0) - 1), "red")
    g.ell(23.5, 20, 2.6, 6.2, "lgrey")
    g.ell(23.8, 20.3, 1.6, 5, "dbrown")
    g.rect(23, 17, 1, 5, "brown")
    # a straw, cyan, out of the mouth
    line(g, 25, 16, 31, 9, "sky")
    line(g, 24, 16, 30, 9, "cyan")
    # whipped cream and a cherry
    g.ell(34, 22, 4.5, 2.6, "lgrey")
    g.ell(33.5, 21.4, 3.8, 2, "white")
    g.ell(34, 19.4, 2.4, 1.6, "white")
    g.ell(34.5, 17.2, 1.7, 1.6, "red", "dred")
    g.p(34, 16.6, "pink")
    line(g, 35, 15.6, 37, 13.6, "dgreen")
    if f:
        g.ell(26, 26.5, 0.9, 1.1, "brown")
    return g


def shore(f, new=Grid):
    """Riverside Path's splash: the river washed over the boards, sky in a blue rim with a wavy far edge,
    cyan wave lines on it and a crest of white foam scallops along its near edge, with spray jumping off
    it. f 1 rolls the crest 1px in and 2px across and throws the spray higher."""
    w = TWO_LANES
    g = new(w, 32)
    s = 1 if f else 0
    for cx, cy, rx, ry in ((42, 18, 38, 8.5), (16, 15.5, 12, 5), (40, 13, 14, 5), (64, 14.5, 13, 5)):
        g.ell(cx, cy, rx, ry, "sky")
    for i in range(9):
        x = 7 + 8.6 * i + 2 * s
        g.ell(x, 24.2 + s - (i % 2) * 0.7, 5, 2.9, "cyan")
    for i in range(9):
        x = 7 + 8.6 * i + 2 * s
        g.ell(x, 24.7 + s - (i % 2) * 0.7, 4.3, 2.2, "white")
    rim_in(g, "blue", ("sky", "white", "cyan"))
    # wave lines on the water
    for x, y, n in ((12, 14, 6), (31, 11, 8), (54, 12, 7), (24, 18, 6), (45, 17, 7), (66, 17, 5)):
        g.rect(x - s, y, n, 1, "cyan")
        g.p(x + n - 1 - s, y - 1, "cyan")
    # spray off the crest
    for x, y in ((11, 20), (29, 19), (50, 20), (70, 19)):
        x += 3 * s
        y -= 2 * s
        g.p(x, y - 1, "blue")
        g.p(x, y - 2, "white")
        g.p(x + 2, y - 3 - s, "white")
        g.p(x + 2, y - 2 - s, "blue")
    return g


# ---------- Stink sources ----------

def flies(g, f, spots):
    """A fly at each spot, its frame f's (x, y) in drawing units: a 2x1 ink body with a 2x1 white wing over
    it, at any scale (one ink pixel below 0.75x). Drawn after the outline, so a fly stays a speck."""
    s, px = scale_of(g), raster(g)
    for frames in spots:
        x, y = frames[f]
        x0, y0 = math.floor((x + 0.5) * s), math.floor((y + 0.5) * s)
        if s < 0.75 * BIG:
            px.p(x0, y0, "ink")
            continue
        px.rect(x0, y0, 2, 1, "ink")
        px.p(x0 + (1 if f else 0), y0 - 1, "white")
        px.p(x0 + (0 if f else 1), y0 - 1, "lgrey")


def compost(f, new=Grid):
    """Willow Crescent's stink: a heap of dark soil with a lumpy top, a banana peel draped over the crown,
    an apple core, a lettuce leaf, a broken eggshell and a carrot top. Two flies circle over it
    (COMPOST_FLIES, drawn on the outlined frame)."""
    g = edged(new(32, 32))
    g.ell(16, 23, 15, 6, "dbrown", "plum", "brown")
    g.ell(9, 19.5, 6.5, 4, "dbrown", "plum", "brown")
    g.ell(17, 17.5, 7, 5, "dbrown", "plum", "brown")
    g.ell(24.5, 20, 5.5, 3.5, "dbrown", "plum", "brown")
    for x, y in ((9, 25), (14, 26), (22, 25), (26, 21), (5, 22), (19, 23), (12, 21)):
        g.p(x, y, "brown")
    # lettuce leaf, left, frilled
    g.ell(7.5, 18, 4, 2.6, "green", "dgreen")
    g.rect(5, 18, 5, 1, "dgreen")
    g.p(4, 16.5, "green")
    g.p(10, 16, "green")
    # apple core, right: red ends, a cream waist and a stalk
    g.rect(22, 18, 4, 2, "red")
    g.rect(22, 18, 1, 2, "pink")
    g.rect(22.5, 20, 3, 2, "cream")
    g.rect(22, 22, 4, 2, "red")
    g.p(24, 17, "dbrown")
    # banana peel over the crown: the stalk, and three flaps hanging from it with brown tips
    for tip in ((11.5, 17), (16.5, 18), (21.5, 17)):
        quad(g, (15.5, 12), (17.5, 12), (tip[0] + 1, tip[1]), (tip[0] - 1, tip[1]), "yellow")
        g.rect(tip[0] - 0.5, tip[1] - 1, 1.5, 1, "brown")
    quad(g, (17.5, 12), (18, 13), (22.5, 16), (21, 16), "amber")
    g.rect(15.5, 11, 2, 2, "yellow")
    g.rect(16, 9.5, 1, 1.5, "brown")
    # eggshell, front
    g.tri((12, 26), (17, 26), (14.5, 22), "white")
    g.tri((15, 26), (18, 26), (17.5, 23), "lgrey")
    # carrot top, left of the crown
    g.tri((7, 25), (11, 25), (9, 21), "orange")
    g.rect(8, 20, 2, 1, "green")
    return lit(g)


COMPOST_FLIES = (((7, 5), (9, 3)), ((25, 3), (23, 5)))


def fish_crate(f, new=Grid):
    """Main Street's stink: a fish crate, front on: tan slats with brown seams on brown corner posts, a
    blue fish stencilled on the middle slat, crushed ice heaped in it, a fish lying across the ice (silver,
    a blue back, a big eye and a forked tail) and another standing on its head with its forked tail up,
    flipping (f 1 bends it right)."""
    g = edged(new(32, 32))
    # crushed ice heaped over the rim
    g.ell(16, 18, 12, 3, "lgrey", "grey", "white")
    for x in (6, 11, 18, 23):
        g.rect(x, 16.5, 2, 2, "white")
        g.p(x + 1, 17.5, "cyan")
    # the fish across the top, head left
    g.ell(12, 14.5, 7.5, 2.8, "lgrey", "grey", "white")
    g.rect(6, 13, 12, 1, "blue")
    g.tri((10, 12.5), (14, 12.5), (13, 10.5), "blue")
    g.tri((18.5, 14.5), (22.5, 11), (21, 14.5), "sky")
    g.tri((18.5, 14.5), (22.5, 18), (21, 14.5), "sky")
    g.rect(7, 14, 2, 2, "white")
    g.p(8, 15, "ink")
    g.p(4.6, 15.2, "dbrown")
    # the fish on its head, tail up
    bend = 1.2 if f else 0
    g.ell(25, 12, 2.2, 5, "lgrey", "grey", "white")
    g.rect(26, 8, 1, 7, "blue")
    g.tri((25 + bend, 7.5), (21.5 + bend * 1.6, 3), (25 + bend * 1.6, 5.5), "sky")
    g.tri((25 + bend, 7.5), (28.5 + bend * 1.6, 3), (25 + bend * 1.6, 5.5), "sky")
    # the crate
    g.rect(4, 19, 24, 10, "tan")
    g.rect(4, 19, 24, 1, "cream")
    for y in (22, 25):
        g.rect(4, y, 24, 1, "brown")
    g.rect(4, 19, 2, 10, "brown")
    g.rect(26, 19, 2, 10, "brown")
    g.rect(4, 28, 24, 1, "brown")
    # stencil: a fish on the middle slat
    g.ell(15, 23.5, 3, 1, "blue")
    g.tri((18, 23.5), (20, 22.5), (20, 24.5), "blue")
    return lit(g)


def seaweed(f, new=Grid):
    """Riverside Path's stink: a heap of seaweed, kelp ribbons draped over it, bladder bulbs, a pink
    scallop shell at its foot and a crab on top; f 1 the crab raises both claws."""
    g = edged(new(32, 32))
    g.ell(16, 23.5, 13.5, 5.5, "dgreen", "forest", "green")
    g.ell(12, 20, 7, 4, "dgreen", "forest", "green")
    g.ell(21, 20.5, 6, 3.5, "dgreen", "forest", "green")
    # ribbons trailing down the heap
    for x0, y0, x1, y1 in ((6, 20, 4, 27), (10, 18, 9, 27), (24, 19, 27, 27), (17, 22, 18, 28)):
        line(g, x0, y0, x1, y1, "forest")
        line(g, x0 + 1, y0, x1 + 1, y1, "green")
    for x, y in ((13, 24), (21, 25), (8, 23), (25, 22)):
        g.ell(x, y, 1.1, 1.1, "ochre")
    # shell
    g.ell(7, 26.5, 2.8, 2.2, "pink", "mauve", "white")
    for x in (6, 8):
        g.rect(x, 25, 1, 3, "mauve")
    # crab
    up = 2 if f else 0
    g.ell(17, 16, 4, 2.4, "orange", "rust", "amber")
    for x in (15, 19):
        g.rect(x, 12.5, 1, 2, "rust")
        g.rect(x - 0.5, 11.5, 2, 1.5, "white")
        g.p(x, 12, "ink")
    for side in (-1, 1):
        x = 17 + side * 6
        g.ell(x, 15 - up, 1.8, 1.5, "orange", "rust", "amber")
        g.rect(x - 0.5 + side * 0.5, 13 - up, 1, 1.5, "orange")
        line(g, 17 + side * 3.5, 16.5, x, 16 - up, "rust")
    return lit(g)


def garbage_truck(f, roll=None):
    """The Long Way Home's stink: a rear-loader garbage truck from straight behind, a lane wide and taller
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



# ---------- the haze ----------

def haze(w, h, step, ink):
    """road.skunk_cloud's haze at w x h: its puffs placed by their share of the frame, the rim, the 2x2
    dither on every other row and the wisps, in the colours ink (road.CLOUD_INK's keys). A puff near the
    frame's top or sides is trimmed so that, swollen, it still stops a pixel short of them; the last row
    cuts the haze level, where it meets the road (as minis.skunk_cloud)."""
    sx, sy = w / road.CLOUD_W, h / road.CLOUD_H
    k = road.CLOUD_SQUASH * sy / sx
    g = Grid(w, h)
    puffs = []
    for i, (cx, cy, r) in enumerate(road.CLOUD_PUFFS):
        cx, cy = cx * sx, cy * sy
        r = min(r * sx, cx - 1.6, w - cx - 1.6, (cy - 1.6) / k)
        puffs.append((cx, cy, r + (1 if (i + step) % 4 == 0 else 0)))
    depth = [[max(r - ((x + 0.5 - cx) ** 2 + ((y + 0.5 - cy) / k) ** 2) ** 0.5 for cx, cy, r in puffs)
              for x in range(w)] for y in range(h)]

    def inside(x, y):
        return 0 <= x < w and 0 <= y < h and depth[y][x] >= 0

    def beside(x, y, test):
        return any(test(x + dx, y + dy) for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)))

    outer = {(x, y) for y in range(h) for x in range(w) if inside(x, y) and beside(x, y, lambda a, b: not inside(a, b))}
    for y in range(h):
        for x in range(w):
            if not inside(x, y):
                continue
            if (x, y) in outer:
                g.p(x, y, ink["outer"])
            elif beside(x, y, lambda a, b: (a, b) in outer):
                g.p(x, y, ink["inner"])
            elif x % 2 == (y // 2 + step) % 2 and y % 2 == 0:
                g.p(x, y, ink["fill"] if (x + y) % 8 else ink["dark"])
    for x0, y0 in road.CLOUD_WISPS:
        for j in range(scaled(6, sy)):
            g.p(x0 * sx + (j + step) % 3 - 1, y0 * sy + j, ink["wisp"])
    return g


# skunk-cloud's colours one step down the mauve ramp, for Main Street's pink road.
FISH_HAZE = dict(outer="plum", inner="pink", fill="purple", dark="plum", wisp="plum")


# ---------- build ----------

def source(draw, f, s, spots=None, w=32, h=32):
    """A stink source's frame f at scale s, outlined, with its flies on it after the outline."""
    g = draw(f, new=mini(s))
    out = Grid(scaled(w, s), scaled(h, s))
    out.px = g.outlined()
    if spots:
        flies(_Onto(out, s), f % 2, spots)
    return out.px


class _Onto:
    """A drawing-unit view of a finished frame at scale s, for dot."""

    def __init__(self, g, s):
        self.g, self.s = g, s


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite, then its depth variants."""
    for suffix, step in (("", 1), *(("@" + k, v) for k, v in STEPS)):
        s = BIG * step
        for key, draw in (("splash-sprinkler", sprinkler), ("splash-mud", mud), ("splash-milkshake", milkshake),
                          ("splash-shore", shore)):
            yield f"{key}{suffix}", [("idle", [draw(f, new=mini(s)).outlined(False) for f in (0, 1)], 500)]
        yield f"stink-compost{suffix}", [("idle", [source(compost, f, s, COMPOST_FLIES) for f in (0, 1)], 400)]
        yield f"stink-fish-crate{suffix}", [("idle", [source(fish_crate, f, s) for f in (0, 1)], 400)]
        yield f"stink-seaweed{suffix}", [("idle", [source(seaweed, f, s) for f in (0, 1)], 400)]
        yield f"stink-garbage-truck{suffix}", [("idle", [truck(garbage_truck, f, step) for f in (0, 1)], 400),
                                               ("drive", [truck(truck_driving, f, step) for f in range(4)], 100)]
        hw, hh = scaled(HAZE_W, step), scaled(HAZE_H, step)
        yield f"stink-fish-crate-cloud{suffix}", [
            ("loop", [haze(hw, hh, i, FISH_HAZE).outlined(False) for i in range(4)], 220)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/skins-areas", __doc__, grounds=GROUNDS)
