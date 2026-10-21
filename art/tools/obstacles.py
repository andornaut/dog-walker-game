#!/usr/bin/env python3
"""Draw the minor obstacles: things the pack bumps into with no card. Each
spans whole lanes of the 64px road lanes: an n-lane obstacle is 64n-8 px wide,
leaving a 4px margin in its outer lanes.

They are billboards seen from a low camera, as roadside objects in OutRun are:
a front elevation (or a car from straight behind), squat, with at most a sliver
of top surface and never its length along the road. The game scales each one
by distance with its base on the road line.

cone                56x56   1 lane, a glint runs down its highlight
bin                 56x56   1 lane, the lid lifts 1px in a breeze
hydrant             56x56   the Regular dog's need spot (not an obstacle), a drip off the side cap
bench               120x42  2 lanes, backrest and seat edge on short legs; a leaf on the seat stirs
barrier-2           120x42  2 lanes, a striped rail and plank on short legs; lamps blink (Willow
                            Crescent, Elm Avenue, Main Street and Riverside Path)
barrier-3           184x42  3 lanes, lamps blink (the same zones)
hedge               184x42  3 lanes, a low hedge with a rounded, clumped top; leaves rustle 1px at three
                            spots in turn
parked-car          56x49   1 lane by 3 rows of footprint, a minivan from straight behind, drawn at the
                            footprint's near edge; hazards blink. 56 wide, so it centres on its lane
                            with 4px to spare each side. pull-out (4 frames, 100ms): drawn pulling
                            right (the game mirrors it for left), tread lines climb the tyres and the
                            right indicator blinks amber; drive (4 frames, 100ms): driving down its
                            lane, the same tread roll with no indicator
delivery-truck      56x63   1 lane by 3 rows of footprint, a brown box van from straight behind with a tan
                            roller door, drawn at the footprint's near edge; idle (4 frames,
                            400ms): an exhaust puff on frame 2. drive (4 frames, 100ms): tread lines
                            climb the tyres and the body dips 1px onto them on frames 1 and 2

Every obstacle has a looping idle, so nothing on the road is frozen. Each idle
frame is one argument to the drawing function, listed in the *_IDLE tuples;
frame 0 is the rest pose. The drawings are in layout pixels, 40 for a 1-lane
sprite and 30 rows for a lane-spanning one, drawn SCALE (1.4) times bigger on a
minis.Mini, which keeps 1px lines 1px; the parked car and the delivery truck keep
their 56 layout columns and draw only their rows SCALE times taller. minis.py and depths.py run them at
SCALE (or CAR_SCALE) times each depth step for the depth variants.

Usage:
  obstacles.py preview OUT.png   every obstacle on the street colours
  obstacles.py build             write art/obstacles/*.aseprite and export to
                                 public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import K, ROADS, Grid, edged, main, road_edge  # noqa: E402
from road import LIT, rim  # noqa: E402

# The drawings are in layout pixels: a 1-lane sprite's frame is SIZE square and a lane-spanning obstacle ROW
# tall. sprites() draws them SCALE times bigger on a minis.Mini, which keeps 1px lines 1px, so a 1-lane sprite
# exports at 56x56 and a lane-spanning one 42 rows tall. The parked car keeps its 56 layout columns, a lane
# less 4px each side, and draws only its rows SCALE times taller (CAR_SCALE).
SIZE = 40
ROW = 30
SCALE = 1.4
CAR_SCALE = (1, SCALE)


def span(lanes):
    """The width in layout pixels of an obstacle across lanes lanes of 64px: 64n-8 drawn, 4px clear of each
    outer lane edge."""
    return (64 * lanes - 8) / SCALE


def drawn(s, draw, *args, **q):
    """draw(*args, **q) on a minis.Mini at scale s, or (sx, sy) for its columns and rows."""
    import minis  # minis imports this module, so it is imported when first used

    return minis.small(sys.modules[__name__], s, draw, *args, **q)


def unit(g):
    """One drawn pixel in g's layout pixels, across and down, so a 1px motion stays 1px at any scale."""
    return 1 / getattr(g, "s", 1), 1 / getattr(g, "sy", getattr(g, "s", 1))


def lit(g):
    """road.rim with road.LIT on the grid that holds the pixels (a minis.Mini draws onto g.g), so the small
    versions get the rim at their own size."""
    rim(getattr(g, "g", g), LIT)
    return g


def raster(g):
    """(the grid holding g's pixels, its scale, the pixel edge of a full-size coordinate on it)."""
    s = getattr(g, "s", 1)
    return getattr(g, "g", g), s, lambda v: math.floor(v * s + 0.5)


def cone(glint=None):
    """glint is the row of the highlight that flashes white, or None. The two reflective bands are cut
    into the drawn cone, so a depth variant keeps both whole at its own size."""
    g = edged(Grid(SIZE, SIZE))
    # squat: a wide base plate, grey, not dslate, which is Elm Avenue's road colour
    g.rect(9, 31, 22, 5, "grey")
    g.rect(9, 31, 22, 1, "lgrey")
    g.tri((11, 32.5), (29, 32.5), (20, 7.5), "orange")
    g.tri((20, 32.5), (29, 32.5), (20, 7.5), "rust")
    px, s, edge = raster(g)
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


def bin_(lift=0):
    """lift raises the lid and handle by that many drawn pixels (negative is up), showing the dark gap under
    the lid. The forest body takes a green rim on its top-left edges, the ink wheels and handle a grey one."""
    g = edged(Grid(SIZE, SIZE))
    lift *= unit(g)[1]
    g.rect(12, 33, 4, 4, "ink")
    g.rect(24, 33, 4, 4, "ink")
    # the body tapers to its foot; its right half is in shade
    g.tri((10, 13), (30, 13), (27.5, 34), "dgreen")
    g.tri((10, 13), (12.5, 34), (27.5, 34), "dgreen")
    g.tri((20, 13), (30, 13), (27.5, 34), "forest")
    g.tri((20, 13), (20, 34), (27.5, 34), "forest")
    for x in (13, 16):
        g.rect(x, 16, 1, 14, "green")
    if lift:
        g.rect(10, 14 + lift, 20, -lift, "ink")
    g.rect(9, 8 + lift, 22, 6, "dgreen")
    g.rect(9, 8 + lift, 22, 1, "green")
    g.rect(20, 9 + lift, 11, 5, "forest")
    g.rect(16, 5 + lift, 8, 3, "ink")
    return lit(g)


def hydrant(drip=0):
    """drip: 1 a bead under the left cap, 2 the bead stretched to fall, 3 a drop landed beside the base.
    The red body takes a pink rim on its top-left edges."""
    g = edged(Grid(SIZE, SIZE))
    g.rect(11, 33, 18, 4, "dred")
    g.rect(11, 33, 18, 1, "red")
    g.rect(14, 14, 12, 19, "red")
    g.rect(21, 14, 5, 19, "dred")
    g.rect(15, 14, 2, 19, "pink")
    g.ell(20, 14, 7.5, 5.5, "red", "dred", "pink")
    g.rect(18, 5, 4, 4, "dred")
    g.rect(12, 11, 16, 3, "dred")
    g.rect(7, 19, 6, 6, "red")
    g.rect(27, 19, 6, 6, "dred")
    g.rect(6, 20, 2, 4, "lgrey")
    g.rect(32, 20, 2, 4, "grey")
    g.rect(18, 20, 4, 4, "dred")
    g.rect(19, 21, 2, 2, "lgrey")
    if drip in (1, 2):
        g.rect(6, 24, 1, drip, "cyan")
    elif drip == 3:
        g.rect(5, 36, 2, 1, "cyan")
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


def hedge(w=span(3), rustle=()):
    """Low and wide, seen side on: a rounded top edge of leaf clumps, no top surface, lit green on its
    top-left edges. rustle lists the top clumps, by index, that lift 1px and shift 1px right, drawn pixels
    at any scale."""
    g = edged(Grid(w, ROW))
    u = unit(g)[0]
    g.rect(4, 11, w - 8, 18, "forest")
    g.rect(1, 14, w - 2, 10, "forest")
    g.rect(4, 25, w - 8, 4, "teal")
    # the rounded top: a clump every 10px, alternately higher, lit green on the upper left
    for i, x in enumerate(range(9, int(w) - 7, 10)):
        r = u if i in rustle else 0
        y = 10 - (i % 2) - r
        g.ell(x + r, y + 1, 6, 5.5, "dgreen", "forest", "green")
        if i % 3 == 0:
            g.p(x - 2 + r, y - 1, "yellow")
    # the rounded ends
    for x in (6, w - 6):
        g.ell(x, 18, 5, 9, "forest")
    # leaf texture lower down, dgreen clumps and teal hollows, spaced irregularly
    for i, x in enumerate(range(7, int(w) - 7, 9)):
        g.ell(x + 2, 16 + (i * 3) % 4, 2.5, 2, "dgreen")
        g.p(x, 21 + (i * 2) % 3, "teal")
    return lit(g)


def white_keyline(c):
    """road_edge, but white rails take a plum keyline (6.5:1 or more on the light roads) for road_edge's dslate."""
    return K["plum"] if c == K["white"] else road_edge(c)


def barrier(lanes, f):
    """Front elevation, squat: a striped rail over a striped plank on short legs, a lamp on each top
    corner; f swaps which lamp is lit. The rail is 10 rows and the plank 6, each in 2-row stairs, striped
    10px orange every 20px and leaning right 2px a stair; the bottom stair of each is its shaded lower
    edge."""
    w = span(lanes)
    g = edged(Grid(w, ROW), white_keyline)
    for x in (5, w - 10):
        g.rect(x, 5, 5, 24, "grey")
        g.rect(x + 3, 5, 2, 24, "slate")
        g.rect(x - 2, 26, 9, 3, "dslate")
        g.rect(x - 2, 26, 9, 1, "slate")
    for top, stairs in ((5, 5), (19, 3)):
        for k in range(stairs):
            base, stripe = ("lgrey", "rust") if k == stairs - 1 else ("white", "orange")
            y = top + 2 * k
            g.rect(1, y, w - 2, 2, base)
            for x in range(-10 - 2 * k, int(w) - 1, 20):
                g.rect(max(x, 1), y, min(x + 10, w - 1) - max(x, 1), 2, stripe)
    for i, x in enumerate((7.5, w - 7.5)):
        on = (i == 0) == bool(f)
        g.ell(x, 4, 3, 3, "amber" if on else "orange", "orange", "yellow" if on else None)
    return g


def parked_car(hazard=False, roll=None, blink=True):
    """A minivan from straight behind, wide and low: the roof edge, the rear window, the tailgate with its
    tail lights and plate, the bumper and both rear wheels under it, mirrors poking out at the sides. Its
    hazard lights, the outer end of each tail light, are lit when hazard is true. Cyan lights the top and
    left edges, so the sky body holds on Elm Avenue. roll (0 to 3) is a pull-out or drive frame: tread
    lines climb the tyres 1px a frame (treads), and, when blink is true (pull-out), the right indicator is
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
    """Tread lines across a tyre seen from behind, rows y to y + h - 1: one every 4u rows, climbing u a frame
    as the tyre rolls away (frame f of 4), or falling when back (reversing), so the loop is seamless. u is
    one pixel at the drawn size."""
    for k in range(-1, round(h / u) // 4 + 2):
        ty = y + ((f if back else 3 - f) + 4 * k) * u
        if y <= ty and ty + u <= y + h + 1e-9:
            g.rect(x, ty, w, 1, "dslate")


# Idle frames, one drawing argument each, and their duration in ms. Most hold the rest pose for
# two frames so the motion comes as a short event rather than a constant flicker.
CONE_IDLE = (None, None, 9, 11), 400
BIN_IDLE = (0, 0, -1, 0), 400
HYDRANT_IDLE = (0, 1, 2, 3), 450
BENCH_IDLE = ((0, 0), (0, 0), (1, -1), (0, 0)), 450
HEDGE_IDLE = ((), (5,), (10,), (15,)), 350
PARKED_CAR_IDLE = (False, True), 500
# The pull-out: 4 frames of parked_car's roll, and their duration in ms.
PULL_OUT = range(4), 100
# The drive: 4 frames of parked_car's or delivery_truck's roll with no indicator, and their duration in ms.
DRIVE = range(4), 100
# The delivery truck's idle: an exhaust puff on frame 2.
DELIVERY_IDLE = (False, False, True, False), 400


def delivery_truck(puff=False, roll=None):
    """A box van from straight behind, a lane wide and taller than the parked car: a brown box lit tan along
    its top and left edges with mirrors at its sides and amber marker lights on the roof, a tan roller door
    ribbed in brown with a white shipping label on it, red tail lights low at the outer corners, the bumper
    step and both rear wheels. puff blows a grey exhaust puff out beside the
    right wheel. roll (0 to 3) is a drive frame: tread lines climb the tyres 1px a frame (treads) and the
    body dips 1px onto them on frames 1 and 2. Laid out on 56x45 and drawn at CAR_SCALE, as the parked car."""
    g = edged(Grid(56, 45))
    px = getattr(g, "g", g)
    uy = unit(g)[1]
    # wheels first, so the body can dip over them
    for x in (5, 42):
        g.rect(x, 34, 9, 10, "ink")
        g.rect(x, 34, 2, 9, "dslate")
        if roll is not None:
            treads(g, x + 2, 37, 7, 7, roll, uy)
    if puff:
        g.ell(52, 40, 2.5, 2, "lgrey", "grey")
        g.p(54, 37, "lgrey")
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
    g.rect(23, 13, 6, 1, "slate")
    g.rect(23, 15, 9, 1, "slate")
    g.rect(23, 17, 4, 1, "red")
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


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    def idle(draw, spec, s=SCALE):
        args, ms = spec
        return [("idle", [drawn(s, draw, a).outlined() for a in args], ms)]

    yield "cone", idle(cone, CONE_IDLE)
    yield "bin", idle(bin_, BIN_IDLE)
    yield "hydrant", idle(hydrant, HYDRANT_IDLE)
    yield "bench", idle(bench, BENCH_IDLE)
    yield "hedge", idle(lambda r: hedge(rustle=r), HEDGE_IDLE)
    for lanes in (2, 3):
        yield f"barrier-{lanes}", [("idle", [drawn(SCALE, barrier, lanes, f).outlined() for f in (0, 1)], 500)]
    args, ms = PULL_OUT
    drive, drive_ms = DRIVE
    yield "parked-car", idle(parked_car, PARKED_CAR_IDLE, CAR_SCALE) + [
        ("pull-out", [drawn(CAR_SCALE, parked_car, roll=f).outlined() for f in args], ms),
        ("drive", [drawn(CAR_SCALE, parked_car, roll=f, blink=False).outlined() for f in drive], drive_ms)]
    yield "delivery-truck", idle(delivery_truck, DELIVERY_IDLE, CAR_SCALE) + [
        ("drive", [drawn(CAR_SCALE, delivery_truck, roll=f).outlined() for f in drive], drive_ms)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/obstacles", __doc__, grounds=ROADS)
