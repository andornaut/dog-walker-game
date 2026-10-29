#!/usr/bin/env python3
"""Draw the minor obstacles: things the pack bumps into with no card. Each
spans whole lanes of the 64px road lanes: an n-lane obstacle is 64n-16 px wide,
leaving an 8px margin in its outer lanes.

They are billboards seen from a low camera, as roadside objects in OutRun are:
a front elevation (or a car from straight behind), squat, with at most a sliver
of top surface and never its length along the road. The game scales each one
by distance with its base on the road line.

cone                48x48   1 lane, a glint runs down its highlight
trash-can           48x48   1 lane, the lid's handle rattles up 1px
bench               112x36  2 lanes, backrest and seat edge on short legs; a leaf on the seat stirs
hedge               176x42  3 lanes, a hedge with a rounded, clumped top, its clumps larger and alternately
                            2px higher; leaves rustle 1px at three spots in turn
parked-car          56x42   1 lane by 3 rows of footprint, a minivan from straight behind, drawn at the
                            footprint's near edge; hazards blink. 56 wide, so it centres on its lane
                            with 4px to spare each side. pull-out (4 frames, 100ms): drawn pulling
                            right (the game mirrors it for left), tread lines climb the tires and the
                            right indicator blinks amber; drive (4 frames, 100ms): driving down its
                            lane, the same tread roll with no indicator
delivery-truck      56x54   1 lane by 3 rows of footprint, a brown box van from straight behind with a tan
                            roller door, drawn at the footprint's near edge; idle (4 frames,
                            400ms): an exhaust puff on frame 2 that drifts up and thins on frame 3.
                            drive (4 frames, 100ms): tread lines
                            climb the tires and the body dips 1px onto them on frames 1 and 2
hot-dog-cart        112x66  2 lanes, a stainless street meat cart side on under a striped umbrella;
                            idle (2 frames, 500ms): wavy steam wisps rising off the steam table
ice-cream-cart      112x66  2 lanes, the hot dog cart's frame: a turquoise beach ice cream cart under a
                            turquoise and white umbrella, a cone for its finial, scoop tubs on its counter
                            and a double cone on its side; idle (2 frames, 500ms): a pistachio drip runs
                            down the side cone
streetcar           56x66   1 lane by 3 rows of footprint, a red TTC Flexity from behind, its pantograph
                            on the roof, drawn at the footprint's near edge; idle (4 frames, 400ms): a
                            spark at the pan head on frame 2. drive (4 frames, 100ms): tread lines climb
                            the wheels and the body sways 1px over the bogie
taxi                56x42   1 lane by 2 rows of footprint, Yonge Street's mover: a gold Toronto cab from
                            straight behind, drawn at CAR_SCALE as the parked car, a white TAXI roof
                            light lettered in dred, black mirrors, rocker band and bumper. drive (4
                            frames, 100ms): the parked car's tread roll. cue (6 frames, 100ms, 600ms in
                            all, played once): the roll with the right indicator and its mirror repeater
                            lit on frames 0, 1, 4 and 5. merge (4 frames, 100ms): angled right, changing
                            lanes, the right flank showing, the indicator lit on frames 2 and 3. The
                            game mirrors cue and merge for a merge left. No idle: it falls back to drive

Every obstacle but the taxi, which only drives, has a looping idle, so nothing
on the road is frozen. Each idle frame is one argument to the drawing function,
listed in the *_IDLE tuples; frame 0 is the rest pose. The drawings are in
layout pixels, 40 for a 1-lane sprite and 30 rows for a lane-spanning one, drawn
SCALE (1.2) times bigger on a minis.Mini, which keeps 1px lines 1px; the parked
car, the delivery truck, the streetcar and the taxi keep their 56 layout columns
and draw only their rows SCALE times taller. minis.py and depths.py run them at
SCALE (or CAR_SCALE) times each depth step for the depth variants.

Usage:
  obstacles.py preview OUT.png   every obstacle on the zone roads
  obstacles.py build             write art/obstacles/*.aseprite and export to
                                 public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import Grid, K, edged, main, raster, road_edge, scale_of  # noqa: E402
from road import lit  # noqa: E402

# The drawings are in layout pixels: a 1-lane sprite's frame is SIZE square and a lane-spanning obstacle ROW
# tall. sprites() draws them SCALE times bigger on a minis.Mini, which keeps 1px lines 1px, so a 1-lane sprite
# exports at 48x48 and a lane-spanning one 36 rows tall. The parked car, the delivery truck and the streetcar
# keep their 56 layout columns, a lane less 4px each side, and draw only their rows SCALE times taller
# (CAR_SCALE).
SIZE = 40
ROW = 30
SCALE = 1.2
CAR_SCALE = (1, SCALE)


def span(lanes):
    """The width in layout pixels of an obstacle across lanes lanes of 64px: 64n-16 drawn, 8px clear of each
    outer lane edge."""
    return (64 * lanes - 16) / SCALE


def drawn(s, draw, *args, **q):
    """draw(*args, **q) on a minis.Mini at scale s, or (sx, sy) for its columns and rows."""
    import minis  # minis imports this module, so it is imported when first used

    return minis.small(sys.modules[__name__], s, draw, *args, **q)


def unit(g):
    """One drawn pixel in g's layout pixels, across and down, so a 1px motion stays 1px at any scale."""
    return 1 / scale_of(g), 1 / getattr(g, "sy", scale_of(g))


def pixel_edge(g):
    """The pixel edge of a full-size coordinate on the grid holding g's pixels."""
    s = scale_of(g)
    return lambda v: math.floor(v * s + 0.5)


def cone(glint=None):
    """glint is the row of the highlight that flashes white, or None. The two reflective bands are cut
    into the drawn cone, so a depth variant keeps both whole at its own size."""
    g = edged(Grid(SIZE, SIZE))
    # squat: a wide base plate, grey, not dslate, which is the Distillery District's road colour
    g.rect(9, 31, 22, 5, "grey")
    g.rect(9, 31, 22, 1, "lgrey")
    g.tri((11, 32.5), (29, 32.5), (20, 7.5), "orange")
    g.tri((20, 32.5), (29, 32.5), (20, 7.5), "rust")
    px, edge = raster(g), pixel_edge(g)
    mid = edge(20)
    cone_px = (K["orange"], K["rust"])
    for top in (15, 24):
        for y in range(edge(top), max(edge(top) + 1, edge(top + 4))):
            for x in range(px.w):
                if px.px[y][x] in cone_px:
                    px.p(x, y, "white" if x < mid else "lgrey")
    # the highlight runs just left of the centre line
    px.rect(mid - 1, edge(9), 1, edge(14) - edge(9), "amber")
    if glint is not None:
        px.p(mid - 1, edge(glint), "white")
    return g


def trash_can(lift=0):
    """lift raises the lid's handle by that many drawn pixels (negative is up), the lid held still. The forest
    body takes a green rim on its top-left edges, the ink wheels and handle a grey one.
    Its lit half has two green ribs, one below TEXTURE_MIN."""
    g = edged(Grid(SIZE, SIZE))
    g.rect(12, 33, 4, 4, "ink")
    g.rect(24, 33, 4, 4, "ink")
    # the body tapers to its foot; its right half is in shade
    g.tri((10, 13), (30, 13), (27.5, 34), "dgreen")
    g.tri((10, 13), (12.5, 34), (27.5, 34), "dgreen")
    g.tri((20, 13), (30, 13), (27.5, 34), "forest")
    g.tri((20, 13), (20, 34), (27.5, 34), "forest")
    for x in (13, 16) if scale_of(g) >= TEXTURE_MIN else (15,):
        g.rect(x, 16, 1, 14, "green")
    g.rect(9, 8, 22, 6, "dgreen")
    g.rect(9, 8, 22, 1, "green")
    g.rect(20, 9, 11, 5, "forest")
    # the handle in drawn pixels, so the lift moves it whole at any scale
    x0, y0, x1, y1 = (math.floor(v * scale_of(g) + 0.5) for v in (16, 5, 24, 8))
    raster(g).rect(x0, y0 + lift, x1 - x0, y1 - y0, "ink")
    return lit(g)


def bench(leaf=(0, 0), w=span(2)):
    """From behind, low: the backrest (two slats) and the seat's front edge as bands on short legs. leaf
    offsets the fallen leaf on the seat edge; None leaves it off. Each slat is a 2-row tan top over a
    3-row brown face, with a 2-row plum gap between them."""
    g = edged(Grid(w, ROW))
    # legs, behind everything: short, slate lit on the left
    for x in (12, w - 17):
        g.rect(x, 2, 5, 27, "dslate")
        g.rect(x, 2, 2, 27, "slate")
    # backrest: two slats with a plum gap, the uprights showing through it
    g.rect(4, 7, w - 8, 2, "plum")
    for y in (2, 9):
        g.rect(4, y, w - 8, 2, "tan")
        g.rect(4, y + 2, w - 8, 3, "brown")
    for x in (round(w * 20 / 88), w // 2 - 1, round(w * 68 / 88) - 2):
        g.rect(x, 4, 2, 7, "dbrown")
    # the seat's edge, wider than the backrest, with a plum shadow line over it
    g.rect(2, 14, w - 4, 2, "plum")
    g.rect(2, 16, w - 4, 3, "tan")
    g.rect(2, 19, w - 4, 3, "brown")
    if leaf:
        ux, uy = unit(g)
        x, y = round(w * 0.64) + leaf[0] * ux, 15 + leaf[1] * uy
        g.rect(x, y, 4, 1, "amber")
        g.rect(x + 1, y + 1, 4, 1, "orange")
        g.p(x + 5, y + 1, "rust")
    return g


# The smallest scale the hedge's leaf texture and the trash can's two ribs are drawn at: under it (the @50 step) a
# 1px detail lands on single pixels or merges with its neighbour.
TEXTURE_MIN = 0.7


# The hedge's layout height, 5 rows over a lane spanner's ROW: drawn at SCALE it is 42 rows, and every depth step a
# whole number of rows.
HEDGE_ROWS = 35


def hedge(w=span(3), rustle=()):
    """Wide, seen side on: a rounded top edge of leaf clumps about 13px apart,
    alternately 2px higher, no top surface, lit green on their top-left edges; the rounded ends as tall as
    the body; a teal band at its foot. rustle lists the top clumps, by index, that lift 1px and shift 1px
    right, drawn pixels at any scale. Below TEXTURE_MIN the lower leaf texture is left off: its clumps
    shrink to single pixels there and read as noise."""
    g = edged(Grid(w, HEDGE_ROWS))
    u = unit(g)[0]
    g.rect(4, 12, w - 8, 22, "forest")
    g.rect(1, 15, w - 2, 14, "forest")
    g.rect(4, 30, w - 8, 4, "teal")
    # the rounded top: clumps spaced evenly from 10px in at each end, so both ends round off the same
    n = round((w - 20) / 13) + 1
    for i in range(n):
        x = 10 + i * (w - 20) / (n - 1)
        r = u if i in rustle else 0
        y = 10 - 2 * (i % 2) - r
        g.ell(x + r, y + 1, 7, 6.5, "dgreen", "forest", "green")
    # the rounded ends
    for x in (6, w - 6):
        g.ell(x, 21, 5, 12, "forest")
    # leaf texture lower down: dgreen clumps, spaced irregularly
    for i, x in enumerate(range(8, int(w) - 8, 11) if scale_of(g) >= TEXTURE_MIN else ()):
        g.ell(x + 2, 20 + (i * 5) % 6, 3, 2.5, "dgreen")
    return lit(g)


def white_keyline(c):
    """road_edge, but white takes a plum keyline (6.5:1 or more on the light roads) for road_edge's dslate."""
    return K["plum"] if c == K["white"] else road_edge(c)


def parked_car(hazard=False, roll=None, blink=True):
    """A minivan from straight behind, wide and low: the roof edge, the rear window, the tailgate with its
    tail lights and plate, the bumper and both rear wheels under it, mirrors poking out at the sides. Its
    hazard lights, the outer end of each tail light, are lit when hazard is true. Cyan lights the top and
    left edges, so the sky body holds on the dslate road. roll (0 to 3) is a pull-out or drive frame: tread
    lines climb the tires 1px a frame (treads), and, when blink is true (pull-out), the right indicator is
    lit on frames 0 and 1."""
    g = edged(Grid(56, 35))
    # rear wheels, under the body at either side
    for x in (5, 42):
        g.rect(x, 25, 9, 9, "ink")
        g.rect(x, 25, 2, 8, "dslate")
    # roof edge and rear window, narrower than the body
    g.rect(10, 1, 36, 3, "sky")
    g.rect(10, 1, 36, 1, "cyan")
    g.tri((8, 14), (10, 4), (10, 14), "sky")
    g.tri((48, 14), (46, 4), (46, 14), "blue")
    g.rect(10, 4, 36, 10, "navy")
    g.tri((14, 13), (20, 5), (25, 5), "slate")
    g.p(8, 13, "cyan")
    g.p(9, 4, "cyan")
    # mirrors at the window's base
    g.rect(3, 11, 5, 3, "blue")
    g.rect(3, 11, 5, 1, "sky")
    g.rect(48, 11, 5, 3, "blue")
    # tailgate: lit along the top and the left, shaded on the right
    g.rect(4, 14, 48, 11, "sky")
    g.rect(4, 14, 48, 1, "cyan")
    g.rect(4, 14, 1, 11, "cyan")
    g.rect(48, 15, 4, 10, "blue")
    for x in (5, 42):
        g.rect(x, 16, 9, 5, "red")
        g.rect(x, 16, 9, 1, "pink")
        g.rect(x, 20, 9, 1, "dred")
    if hazard:
        for x in (5, 48):
            g.rect(x, 16, 3, 4, "amber")
            g.rect(x, 16, 3, 1, "yellow")
    g.rect(22, 18, 12, 5, "lgrey")
    g.rect(24, 20, 8, 1, "grey")
    g.rect(25, 15, 6, 1, "lgrey")
    # bumper across the full width
    g.rect(3, 25, 50, 4, "dslate")
    g.rect(3, 25, 50, 1, "slate")
    g.rect(3, 25, 1, 4, "grey")
    if roll is not None:
        for x in (5, 42):
            treads(g, x + 2, 29, 7, 5, roll, unit(g)[1])
        if blink and roll < 2:
            g.rect(48, 16, 3, 4, "amber")
            g.rect(48, 16, 3, 1, "yellow")
    return g


def treads(g, x, y, w, h, f, u=1, back=False):
    """Tread lines across a tire seen from behind, rows y to y + h - 1: one every 4u rows, climbing u a frame
    as the tire rolls away (frame f of 4), or falling when back (reversing), so the loop is seamless. u is
    one pixel at the drawn size."""
    for k in range(-1, round(h / u) // 4 + 2):
        ty = y + ((f if back else 3 - f) + 4 * k) * u
        if y <= ty and ty + u <= y + h + 1e-9:
            g.rect(x, ty, w, 1, "dslate")


# Idle frames, one drawing argument each, and their duration in ms. Most hold the rest pose for
# two frames so the motion comes as a short event rather than a constant flicker.
CONE_IDLE = (None, None, 9, 11), 400
TRASH_CAN_IDLE = (0, 0, -1, 0), 400
BENCH_IDLE = ((0, 0), (0, 0), (1, -1), (0, 0)), 450
HEDGE_IDLE = ((), (5,), (10,), (1,)), 350
PARKED_CAR_IDLE = (False, True), 500
# The pull-out: 4 frames of parked_car's roll, and their duration in ms.
PULL_OUT = range(4), 100
# The drive: 4 frames of parked_car's, delivery_truck's, streetcar's or taxi's roll with no indicator, and
# their duration in ms.
DRIVE = range(4), 100
# The delivery truck's idle: an exhaust puff on frame 2, drifting up and thinning on frame 3.
DELIVERY_IDLE = (0, 0, 1, 2), 400


# The smallest column scale the delivery truck's label keeps its three lines at: under it (@62 and @50) they
# land on adjacent rows and run together.
LABEL_MIN = 0.7


def delivery_truck(puff=0, roll=None):
    """A box van from straight behind, a lane wide and taller than the parked car: a brown box lit tan along
    its top and left edges with mirrors at its sides and amber marker lights on the roof, a tan roller door
    ribbed in brown with a white shipping label on it, red tail lights low at the outer corners, the bumper
    step and both rear wheels. puff 1 blows a grey exhaust puff out beside the right wheel and puff 2
    lets it drift up and thin to two wisps. roll (0 to 3) is a drive frame: tread lines climb the tires 1px a frame (treads) and the
    body dips 1px onto them on frames 1 and 2. Laid out on 56x45 and drawn at CAR_SCALE, as the parked car."""
    g = edged(Grid(56, 45))
    px = raster(g)
    uy = unit(g)[1]
    # wheels first, so the body can dip over them
    for x in (5, 42):
        g.rect(x, 34, 9, 10, "ink")
        g.rect(x, 34, 2, 9, "dslate")
        if roll is not None:
            treads(g, x + 2, 37, 7, 7, roll, uy)
    if puff == 1:
        g.ell(52, 40, 2.5, 2, "lgrey", "grey")
        g.p(54, 37, "lgrey")
    elif puff == 2:
        g.ell(51.5, 35.5, 1.8, 1.5, "lgrey")
        g.p(53, 32.5, "lgrey")
    wheels = [row[:] for row in px.px]
    px.px = [[None] * px.w for _ in range(px.h)]
    # the box: lit along the top and the left, shaded down the right; mirrors poke out at its sides
    g.rect(4, 1, 48, 32, "brown")
    g.rect(4, 1, 48, 1, "tan")
    g.rect(4, 1, 1, 32, "tan")
    g.rect(48, 2, 4, 31, "dbrown")
    for x in (1, 52):
        g.rect(x, 7, 3, 5, "dslate")
        g.rect(x, 7, 3, 1, "slate")
    # amber marker lights along the roof
    for x in (18, 27, 36):
        g.rect(x, 2, 3, 1, "amber")
    # the roller door, its slats, its handle and a parcel label taped across
    g.rect(10, 5, 36, 26, "tan")
    for y in range(8, 31, 3):
        g.rect(10, y, 36, 1, "brown")
    g.rect(43, 5, 3, 26, "brown")
    g.rect(25, 27, 6, 2, "grey")
    g.rect(25, 27, 6, 1, "lgrey")
    g.rect(21, 11, 13, 9, "white")
    g.rect(21, 19, 13, 1, "lgrey")
    if scale_of(g) >= LABEL_MIN:
        g.rect(23, 13, 6, 1, "slate")
        g.rect(23, 15, 9, 1, "slate")
        g.rect(23, 17, 4, 1, "red")
    else:
        # smaller, the three lines would run together: one address line and the red tag, a row apart
        g.rect(23, 13, 9, 1, "slate")
        g.rect(23, 16, 4, 1, "red")
    # tail lights low at the outer corners
    for x in (5, 47):
        g.rect(x, 21, 4, 8, "red")
        g.rect(x, 21, 4, 1, "pink")
        g.rect(x, 28, 4, 1, "dred")
    # the bumper step across the full width
    g.rect(1, 32, 54, 3, "dslate")
    g.rect(1, 32, 54, 1, "slate")
    g.rect(1, 32, 1, 3, "grey")
    dip = 1 if roll in (1, 2) else 0
    body = px.px
    px.px = [[(body[y - dip][x] if y >= dip else None) or wheels[y][x] for x in range(px.w)] for y in range(px.h)]
    return lit(g)


# 5-row letters for the streetcar's route sign and wordmark and the taxi's roof light, one string per row, 1 for
# a lit pixel: 3 columns wide, the I 1.
LETTERS = {"0": ("111", "101", "101", "101", "111"), "4": ("101", "101", "111", "001", "001"),
           "5": ("111", "100", "111", "001", "111"), "A": ("010", "101", "111", "101", "101"),
           "C": ("111", "100", "100", "100", "111"), "I": ("1", "1", "1", "1", "1"),
           "T": ("111", "010", "010", "010", "010"), "X": ("101", "101", "010", "101", "101")}
# The streetcar's idle: a spark at the pantograph on frame 2.
STREETCAR_IDLE = (False, False, True, False), 400
# Its drive's sideways sway, in drawn pixels per frame, as the bogies roll under it.
STREETCAR_SWAY = (0, 1, 0, -1)


def lettering(g, cx, y, text, c, bar=None):
    """text in LETTERS centred on layout column cx with its top on layout row y, drawn pixel for pixel on the
    grid holding g's pixels, 1px apart. Where the grid is too small for it to sit inside the layout's 5 rows
    and its letters' columns, bar draws a 1px line of that colour across its middle instead, or nothing."""
    px = raster(g)
    s, sy = scale_of(g), getattr(g, "sy", scale_of(g))
    w = sum(len(LETTERS[ch][0]) + 1 for ch in text) - 1
    if s < 0.85 or sy * 5 < 5:
        if bar:
            px.rect(math.floor((cx - w / 2) * s + 0.5), math.floor((y + 2.5) * sy), max(1, round(w * s)), 1, bar)
        return
    x0, y0 = math.floor(cx * s + 0.5) - w // 2, math.floor((y + 2.5) * sy + 0.5) - 2
    for ch in text:
        for j, row in enumerate(LETTERS[ch]):
            for k, on in enumerate(row):
                if on == "1":
                    px.p(x0 + k, y0 + j, c)
        x0 += len(LETTERS[ch][0]) + 1


def streetcar(spark=False, roll=None):
    """A red TTC Flexity streetcar from straight behind, a lane wide, laid out on 56x55 and drawn at CAR_SCALE
    to 56x66: a pantograph on the roof, its pan head under the wire, over a red body with a rounded roof; the
    route sign "504" in amber on black at the top; the black window band across the back, a big rear window
    with a glint; a white stripe under it, "TTC" in white on the red, tail lights and amber blinkers low at the
    outer corners in black housings, the anticlimber bumper, and the rear bogie's two wheels under the skirt.
    spark lights a cyan spark at the pan head. roll (0 to 3) is a drive frame: tread lines climb the wheels
    1px a frame as it rolls away, and the body and pantograph sway STREETCAR_SWAY over the bogie."""
    g = edged(Grid(56, 55))
    px = raster(g)
    uy = unit(g)[1]
    # the bogie and its wheels first, so the body can sway over them
    g.rect(14, 48, 28, 3, "dslate")
    g.rect(14, 48, 28, 1, "slate")
    for x in (8, 41):
        g.rect(x, 47, 7, 8, "ink")
        g.rect(x, 47, 2, 7, "dslate")
        if roll is not None:
            treads(g, x + 2, 48, 5, 6, roll, uy)
    wheels = [row[:] for row in px.px]
    px.px = [[None] * px.w for _ in range(px.h)]
    # the pantograph: a diamond of grey arms on an insulated base, the lgrey pan head with its horns on top
    g.rect(21, 8, 14, 2, "dslate")
    g.rect(21, 8, 14, 1, "slate")
    for (x0, y0), (x1, y1) in (((23, 7), (19, 5)), ((19, 5), (24, 3)), ((32, 7), (36, 5)), ((36, 5), (31, 3))):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for k in range(n + 1):
            g.rect(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, 1, 1, "grey")
    g.rect(21, 2, 14, 1, "lgrey")
    g.p(20, 3, "grey")
    g.p(35, 3, "grey")
    if spark:
        g.rect(26, 0, 3, 2, "cyan")
        g.p(27, 1, "white")
        g.p(25, 1, "cyan")
        g.p(29, 0, "cyan")
    # the body: a rounded roof over a box, lit along the top and the left, shaded down the right
    g.cel(28, 20, 26, 11, "red", "dred", "pink", power=3)
    g.rect(2, 20, 52, 27, "red")
    g.rect(50, 20, 4, 27, "dred")
    # the route sign
    g.rect(20, 12, 16, 6, "ink")
    lettering(g, 28, 12.5, "504", "amber", "amber")
    # the black band and the rear window in it, with a glint across the glass
    g.rect(2, 19, 52, 13, "ink")
    g.rect(7, 20, 42, 11, "navy")
    g.rect(7, 20, 42, 1, "dslate")
    g.tri((12, 31), (20, 20.5), (25, 20.5), "dslate")
    g.tri((19, 31), (27, 20.5), (29, 20.5), "dslate")
    # the white stripe, the wordmark, the lamps in their housings
    g.rect(2, 32, 52, 1, "white")
    lettering(g, 28, 36, "TTC", "white")
    for x in (4, 46):
        g.rect(x, 35, 6, 9, "ink")
        g.rect(x + 1, 36, 4, 3, "red")
        g.rect(x + 1, 36, 4, 1, "pink")
        g.rect(x + 1, 40, 4, 2, "amber")
        g.p(x + 1, 40, "yellow")
    # the anticlimber bumper and the skirt over the bogie
    g.rect(3, 44, 50, 3, "dslate")
    g.rect(3, 44, 50, 1, "slate")
    g.rect(3, 44, 1, 3, "grey")
    g.rect(24, 44, 8, 2, "grey")
    g.rect(24, 44, 8, 1, "lgrey")
    sway = STREETCAR_SWAY[roll] if roll is not None else 0
    body = px.px
    px.px = [[(body[y][x - sway] if 0 <= x - sway < px.w else None) or wheels[y][x] for x in range(px.w)]
             for y in range(px.h)]
    return lit(g)


# The taxi's cue, (roll, signal) a frame: the drive's tread roll at its 100ms with the right indicator lit on
# frames 0, 1, 4 and 5, 600ms in all, the game's mover warning. Its merge carries the beat on, lit on frames 2
# and 3, angled right.
TAXI_CUE = ((0, True), (1, True), (2, False), (3, False), (0, True), (1, True)), 100
TAXI_MERGE = ((0, False), (1, False), (2, True), (3, True)), 100


def taxi(roll=None, signal=False, turn=False):
    """A Toronto taxi from straight behind, a sedan a lane wide, laid out on 56x35 and drawn at CAR_SCALE to
    56x42 as the parked car: a white TAXI roof light lettered in dred over a gold body lit yellow along its top
    and left edges and shaded amber down its right, the dark rear window between the pillars, the trunk lid's
    lip, tail light clusters in ink housings at the outer corners (red inside, the indicator outside), a white
    plate, a black rocker band and bumper and both rear tires, mirrors at the window's base. signal lights the
    right indicator amber and the repeater on the right mirror; unlit they are dbrown and dslate. roll (0 to 3)
    is a drive frame: tread lines climb the tires 1px a frame (treads). turn angles it right, changing lanes:
    the rear face narrows and slides left, the roof light and cabin lean 2px further right, and the right flank
    shows down the right edge in amber, its side window, its mirror and repeater, and the right rear tire side
    on."""
    g = edged(Grid(56, 35))
    uy = unit(g)[1]
    # the rear face's columns, narrowed and slid left when turning; up leans the upper parts further right
    k, x0, lean = (0.875, 3, 2) if turn else (1, 4, 0)

    def X(x, up=0):
        return x0 + (x - 4) * k + (lean if up else 0)

    def r(x, y, w, h, c, up=0):
        g.rect(X(x, up), y, w * k, h, c)

    # rear tires, under the body at either side
    for x in (6, 42):
        r(x, 26, 8, 8, "ink")
        r(x, 26, 2, 7, "dslate")
    if turn:
        # the right flank: the beltline and rocker rising toward the front, the rear tire side on
        g.tri((X(52), 17), (54, 16), (54, 26), "amber")
        g.tri((X(52), 17), (X(52), 27), (54, 26), "amber")
        g.rect(X(52), 25, 54 - X(52), 2, "ink")
        g.cel(50, 29.5, 3.2, 4, "ink", None, "dslate")
        if scale_of(g) >= TEXTURE_MIN:
            g.cel(50, 29.5, 1.3, 1.5, "grey", None, "lgrey")
        # the cabin's side: the side window under the roof's edge
        g.rect(X(44, 1), 8, 52 - X(44, 1), 9, "amber")
        g.rect(X(44, 1), 8, 52 - X(44, 1), 1, "yellow")
        g.rect(X(45, 1), 10, 50 - X(45, 1), 6, "navy")
    # roof and rear window, narrower than the body, between the pillars
    r(12, 8, 32, 2, "gold", 1)
    r(12, 8, 32, 1, "yellow", 1)
    g.tri((X(9), 17), (X(12, 1), 9), (X(12, 1), 17), "gold")
    g.tri((X(47), 17), (X(44, 1), 9), (X(44, 1), 17), "amber")
    g.rect(X(12, 1), 10, X(44, 1) - X(12, 1), 7, "navy")
    g.rect(X(12, 1), 10, X(44, 1) - X(12, 1), 1, "dslate")
    g.tri((X(16, 1), 16), (X(21, 1), 11), (X(26, 1), 11), "slate")
    g.p(X(9), 16, "yellow")
    # the roof light: a white box on a short base, lettered TAXI
    r(25, 7, 6, 1, "dslate", 1)
    r(19, 1, 18, 6, "white", 1)
    r(19, 6, 18, 1, "lgrey", 1)
    r(36, 2, 1, 4, "lgrey", 1)
    lettering(g, X(27, 1), 1, "TAXI", "dred", "dred")
    # black mirrors at the window's base; the right one carries the indicator's repeater
    r(3, 13, 5, 3, "ink")
    mx, my = (50, 12) if turn else (X(48), 13)
    g.rect(mx, my, 5, 3, "ink")
    g.rect(mx + 1, my + 1, 3, 2, "amber" if signal else "dslate")
    if signal:
        g.rect(mx + 1, my + 1, 3, 1, "yellow")
    # the trunk lid's lip and the rear face: lit along the top and the left, shaded on the right
    r(4, 17, 48, 10, "gold")
    r(4, 17, 48, 1, "yellow")
    r(4, 17, 1, 10, "yellow")
    r(48, 18, 4, 9, "amber")
    r(4, 19, 48, 1, "amber")
    # tail light clusters: red inside, the indicator outside, in ink housings
    for x, tail in ((5, 11), (39, 40)):
        r(x, 20, 13, 6, "ink")
        r(tail, 21, 6, 4, "red")
        r(tail, 21, 6, 1, "pink")
    r(6, 21, 5, 4, "dbrown")
    if signal:
        r(46, 21, 5, 4, "amber")
        r(47, 21, 3, 3, "yellow")
        r(48, 22, 1, 1, "white")
    else:
        r(46, 21, 5, 4, "dbrown")
    # the plate, white with a blue line, and the black rocker band and bumper
    r(22, 20, 12, 5, "white")
    r(22, 24, 12, 1, "lgrey")
    r(24, 22, 8, 1, "blue")
    if turn:
        # the tail light housing wraps round the corner onto the flank
        g.rect(X(52), 20, 1, 6, "ink")
    r(4, 26, 48, 1, "ink")
    r(3, 27, 50, 2, "ink")
    r(3, 27, 50, 1, "dslate")
    # tread lines on the tires' 5 rows under the bumper, as the parked car's
    if roll is not None:
        for x in (6, 42):
            treads(g, X(x + 2), 29, 6 * k, 5, roll, uy)
    return lit(g)


# The hot dog cart's idle: steam off the steam table, rising a drawn pixel and swapping sides on frame 1.
HOT_DOG_CART_IDLE = (0, 1), 500


# The hot dog cart's steam wisps: each drawn row's sideways offset, from the lid up.
STEAM_WAVE = (0, 1, 1, 0, -1, -1)


def cart_edge(c):
    """road_edge, but the steam (haze, which nothing else on the cart uses) takes no outline."""
    return None if c == K["haze"] else road_edge(c)


def cart_wheels(g, w):
    """A street cart's two wheels, behind its box: ink tires, grey hubs."""
    for x in (19, w - 19):
        g.cel(x, 48, 6, 6.5, "ink", None, "dslate")
        g.cel(x, 48, 2, 2, "grey", None, "lgrey")


def cart_umbrella(g, w, cols, top=2, base=15):
    """A street cart's umbrella: six wedges from its tip at row top to row base, a scallop under each.
    cols is ((lit, lit), (shade, shade)): the left three wedges take the lit pair in turn, the right three
    the shaded pair."""
    c = w / 2
    left, right = 8, w - 8
    for i in range(6):
        x0, x1 = left + (right - left) * i / 6, left + (right - left) * (i + 1) / 6
        g.tri((x0, base), (x1, base), (c, top), cols[i >= 3][i % 2])
    for i in range(6):
        x0 = left + (right - left) * i / 6
        g.cel(x0 + (right - left) / 12, base, (right - left) / 12, 2.5, cols[i >= 3][i % 2])


def cart_pole(g, w, top):
    """A street cart's umbrella pole, from row top down to the counter."""
    c = w / 2
    g.rect(c - 1, top, 2, 28 - top, "slate")
    g.rect(c - 1, top, 1, 28 - top, "grey")


def cart_box(g, w, body, light, shade, lip=("white", "lgrey")):
    """A street cart's counter lip, then its box: lit down its left in light, shaded down its right."""
    g.rect(6, 28, w - 12, 2, lip[0])
    g.rect(6, 29, w - 12, 1, lip[1])
    g.rect(9, 30, w - 18, 15, body)
    g.rect(9, 30, 1, 15, light)
    g.rect(w - 14, 30, 5, 15, shade)


def hot_dog_cart(steam=0, w=span(2)):
    """A Toronto street meat cart side on, two lanes wide, laid out on span(2) x 55 and drawn at SCALE to
    112x66: a stainless box on two wheels under a red and yellow striped umbrella with a scalloped valance,
    lit on its left and shaded on its right; ketchup, mustard and relish bottles and a stack of buns on the
    counter at the left, the steam table's lids at the right with steam curling off them, and a hot dog
    with a mustard zigzag on the box's side. steam (0 or 1) shifts the wisps' wave half a period."""
    g = edged(Grid(w, 55), cart_edge)
    c = w / 2
    cart_wheels(g, w)
    # the umbrella: six wedges from the finial, red and yellow, the right three in shade
    cart_umbrella(g, w, (("red", "yellow"), ("dred", "amber")))
    g.rect(c - 1, 0, 2, 2, "grey")
    g.p(c - 1, 0, "lgrey")
    cart_pole(g, w, 17)
    # on the counter, left: ketchup, mustard and relish bottles, their nozzles white, and a stack of buns
    for x, col, sh in ((12, "red", "dred"), (17, "yellow", "amber"), (22, "green", "dgreen")):
        g.rect(x, 21, 4, 7, col)
        g.rect(x + 3, 21, 1, 7, sh)
        g.rect(x + 1, 19, 2, 2, "white")
        g.p(x + 1.5, 18, "white")
    for k in range(3):
        g.cel(32, 26.5 - 2.2 * k, 4, 1.6, "tan", "ochre", "cream")
    # on the counter, right: the steam table's two lids
    for x in (w - 33, w - 20):
        g.cel(x, 27, 6, 3.5, "lgrey", "grey", "white")
    # the steam: a wavy 1px wisp rising off each lid, in haze with no outline, so it reads as vapour and not
    # as a knob on the lid; the two wisps wave in opposite phase and steam shifts the wave half a period
    px, edge = raster(g), pixel_edge(g)
    for i, x in enumerate((w - 33, w - 20)):
        x0 = edge(x)
        for k, y in enumerate(range(edge(22.5) - 1, edge(18.5) - 1, -1)):
            px.p(x0 + STEAM_WAVE[(k + 3 * (steam + i)) % len(STEAM_WAVE)], y, "haze")
    # the stainless box, lit along its top and left, shaded down its right, with two seams
    cart_box(g, w, "lgrey", "white", "grey")
    g.rect(9, 30, w - 18, 1, "grey")
    for x in (round(w * 0.3), round(w * 0.7)):
        g.rect(x, 31, 1, 13, "grey")
    # the hot dog on the side: the bun's back, the sausage poking out of it under a mustard zigzag, the bun's front
    g.cel(c, 37, 11, 3, "tan", "ochre", "cream")
    g.cel(c, 37.5, 14, 1.8, "red", "dred", "pink")
    for k, x in enumerate(range(round(c - 9), round(c + 9), 3)):
        g.rect(x, 37 - k % 2, 2, 1, "yellow")
    g.cel(c, 40, 11.5, 1.8, "tan", "ochre")
    g.rect(9, 44, w - 18, 1, "slate")
    return lit(g)


# The ice cream cart's idle: a pistachio drip runs down the side sign's cone on frame 1.
ICE_CREAM_CART_IDLE = (0, 1), 500


def waffle(g, x0, x1, y0, tip):
    """A waffle cone point down from its rim on row y0, lit tan on its left half and shaded ochre on its
    right, crosshatched in 1px brown lines 3px apart down to TEXTURE_MIN."""
    cx = (x0 + x1) / 2
    g.tri((x0, y0), (x1, y0), (cx, tip), "tan")
    g.tri((cx, y0), (x1, y0), (cx, tip), "ochre")
    if scale_of(g) < TEXTURE_MIN:
        return
    px, edge = raster(g), pixel_edge(g)
    cone = (K["tan"], K["ochre"])
    for y in range(edge(y0), edge(tip)):
        for x in range(edge(x0), edge(x1) + 1):
            if 0 <= x < px.w and px.px[y][x] in cone and ((x + y) % 3 == 0 or (x - y) % 3 == 0):
                px.p(x, y, "brown")


def ice_cream_cart(drip=0, w=span(2)):
    """A beach ice cream cart side on, the hot dog cart's frame: laid out on span(2) x 55 and drawn at SCALE
    to 112x66, a turquoise box on two wheels under a turquoise and white umbrella, a strawberry cone for its
    finial, lit on its left and shaded on its right; four tubs heaped with strawberry, vanilla, pistachio
    and chocolate scoops along its cream counter, and on the box's side a cream panel with a pistachio and
    strawberry double cone. drip (0 or 1) runs a pistachio drip down the cone's lit side."""
    g = edged(Grid(w, 55), cart_edge)
    c = w / 2
    cart_wheels(g, w)
    # the umbrella, 4 rows lower than the hot dog cart's under its cone finial
    cart_umbrella(g, w, (("turquoise", "white"), ("dturq", "lgrey")), 6, 17)
    g.tri((c - 2.2, 4), (c + 2.2, 4), (c, 9.7), "tan")
    g.tri((c, 4), (c + 2.2, 4), (c, 9.7), "ochre")
    g.cel(c, 2.7, 2.6, 2.1, "pink", "mauve", "white")
    g.rect(c - 2.6, 3.4, 5.2, 1, "mauve")
    cart_pole(g, w, 19)
    # on the counter: four white tubs, each heaped with its scoop
    for x, col, sh, li in ((14, "pink", "mauve", "white"), (25, "cream", "tan", "white"),
                           (w - 25, "lime", "green", "white"), (w - 14, "brown", "dbrown", "tan")):
        g.cel(x, 24, 4.2, 3, col, sh, li)
        g.rect(x - 4, 24.5, 8, 3.5, "white")
        g.rect(x + 3, 24.5, 1, 3.5, "lgrey")
    cart_box(g, w, "turquoise", "foam", "dturq", ("cream", "tan"))
    # the side sign: a cream panel, a waffle cone under a pistachio scoop and a strawberry one
    g.rect(c - 12, 30, 24, 14, "cream")
    g.rect(c + 10, 30, 2, 14, "tan")
    waffle(g, c - 4.5, c + 4.5, 38.5, 46)
    g.cel(c, 36.3, 5.2, 3, "lime", "green", "white")
    g.cel(c, 32.3, 4.4, 2.8, "pink", "mauve", "white")
    if drip:
        # 1 drawn pixel wide, so it stays a drip at every depth step
        px, edge = raster(g), pixel_edge(g)
        px.rect(edge(c - 2.5), edge(38.5), 1, max(2, edge(42) - edge(38.5)), "lime")
    g.rect(9, 44, w - 18, 1, "slate")
    return lit(g)


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    def idle(draw, spec, s=SCALE):
        args, ms = spec
        return [("idle", [drawn(s, draw, a).outlined() for a in args], ms)]

    yield "cone", idle(cone, CONE_IDLE)
    yield "trash-can", idle(trash_can, TRASH_CAN_IDLE)
    yield "bench", idle(bench, BENCH_IDLE)
    yield "hedge", idle(lambda r: hedge(rustle=r), HEDGE_IDLE)
    args, ms = PULL_OUT
    drive, drive_ms = DRIVE
    yield "parked-car", idle(parked_car, PARKED_CAR_IDLE, CAR_SCALE) + [
        ("pull-out", [drawn(CAR_SCALE, parked_car, roll=f).outlined() for f in args], ms),
        ("drive", [drawn(CAR_SCALE, parked_car, roll=f, blink=False).outlined() for f in drive], drive_ms)]
    yield "delivery-truck", idle(delivery_truck, DELIVERY_IDLE, CAR_SCALE) + [
        ("drive", [drawn(CAR_SCALE, delivery_truck, roll=f).outlined() for f in drive], drive_ms)]
    yield "hot-dog-cart", idle(lambda f: hot_dog_cart(steam=f), HOT_DOG_CART_IDLE)
    yield "ice-cream-cart", idle(lambda f: ice_cream_cart(drip=f), ICE_CREAM_CART_IDLE)
    yield "streetcar", idle(streetcar, STREETCAR_IDLE, CAR_SCALE) + [
        ("drive", [drawn(CAR_SCALE, streetcar, roll=f).outlined() for f in drive], drive_ms)]
    cue, cue_ms = TAXI_CUE
    merge, merge_ms = TAXI_MERGE
    yield "taxi", [("drive", [drawn(CAR_SCALE, taxi, roll=f).outlined() for f in drive], drive_ms),
                   ("cue", [drawn(CAR_SCALE, taxi, roll=f, signal=b).outlined() for f, b in cue], cue_ms),
                   ("merge", [drawn(CAR_SCALE, taxi, roll=f, signal=b, turn=True).outlined() for f, b in merge],
                    merge_ms)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/obstacles", __doc__)
