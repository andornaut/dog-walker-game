#!/usr/bin/env python3
"""Draw everything on the road except the dogs, and build its Aseprite sources and exports.

People (walkers, forced stops, lucky people, the thief and the other dog's owner)
are 48x72, the other dog, skunk and squirrel 48x48 and the
pickups 24x24: their drawing functions lay them out on 32x48, 32x32 and 16x16, and
sprites() draws them SCALE (1.5) times bigger on a scaling grid, never upscaled.
The bark pop is 16x16. The ice cream truck (56x60, one lane, like
obstacles.delivery_truck; tags idle, 2 frames at 400ms, and drive, 4 at 100ms) is drawn in
its own pixels at 56x50 on a grid that keeps its columns and draws its rows ROW_SCALE (1.2)
times; the puddle (112x48) is drawn in its own
pixels; the skunk's stink haze (112x60) is a ground decal laid out on an 88x40 design
and stretched to its frame on the drawn grid. All are chibi and in Endesga 32 with
coloured outlines. The walker is seen from behind, like the
dogs, except in wave and cheer; everything coming down the road faces the player:
jogger (48x72, run: 4 frames at 100ms, a knee driven up, then that foot passing
down, each side in turn, the ponytail swinging out from behind the head) wears
an orange racerback singlet with a white race bib on its front; kid-on-bike
(48x72, ride: 4 frames at 100ms, the pedals going round, a 1px sway and the
streamers fluttering) is a kid in a red helmet on a mauve bike with training
wheels. The movers going up the road ahead of the pack are seen from behind
too: stroller (48x72, walk: 4 frames at 160ms, the walkers' stride and pace)
is a dad pushing a stroller one-handed, a takeaway coffee in his other hand,
the stroller rolling beside him on his right.

walker-<name> tags: walk (4 frames, 160ms), react (2, 120ms), stumble (4, 90ms), idle (2,
400ms), then wave (4 frames, 150ms, looping): the walker facing the camera, feet on the same rows
as the back view, the left arm (screen right) raised and swinging from the shoulder, the hand
1, 3, 4 and 3 design pixels right of it. At rest (idle frame 0) a 48x72 walker's feet (the outline under the
shoes) are on row 68 (Ada's on row 69), and the hands' top rows 20 above them, their outer columns
16 left and 16 right of the centre column (x 24). Then cheer (4 frames, 120ms, looping), drawn at 2x in the
zone celebration: the front view with the hanging arm taken off and both arms raised from the
shoulders in a V, the hands 1, 3, 4 and 3 design pixels out; a 2px crouch, a hop 2px and 3px up,
then a 1px landing. Trista's tote stays on her shoulder. What stands on the road
is a billboard seen from the walker's eye, as roadside objects in OutRun are: a
front elevation (the ice cream truck a rear one, like obstacles.parked_car),
with no top surface and its base on the last opaque row.

Usage:
  road.py preview OUT.png   every frame on the zone roads, scaled up
  road.py build             write art/road/*.aseprite, then export
                            public/art/sprites/*.png and *.json with Aseprite

Everything that stands or waits on the road has a looping idle: people and
walkers breathe (a 1px bob of the head and shoulders).
New tags go after the existing ones, so the frame indices the game uses stay put.

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import DARKER, Grid, K, edged, main, raster, scale_of  # noqa: E402


def face_front(g, cx, y, eyes="ink", lips="dbrown", spread=4, mouth=4):
    """Eyes and a smile for a chibi head seen from the front; y is the eye row. lips is the mouth's colour;
    spread is each eye's centre's distance from cx; mouth is the smile's corners' row below y."""
    g.rect(cx - spread - 1, y, 2, 2, eyes)
    g.rect(cx + spread - 1, y, 2, 2, eyes)
    g.p(cx - spread - 1, y, "white")
    g.p(cx + spread - 1, y, "white")
    g.p(cx - 2, y + mouth, lips)
    g.p(cx + 1, y + mouth, lips)
    g.rect(cx - 1, y + mouth + 1, 2, 1, lips)


def face_disc(g, cx, cy, rx, ry, skin, shade, to=0.35):
    """A face seen from the front, kept clean as the portraits are: flat skin, with a 1px shadow down its
    near (right) edge from the top to `to` of the radius below the centre, beside the eyes, never across the
    jaw or mouth. Drawn on a minis.Mini, the shadow is 1px of the grid's own pixels."""
    g.ell(cx, cy, rx, ry, skin)
    px, s = raster(g), scale_of(g)
    sy = getattr(g, "sy", s)
    fill = K.get(skin, skin)
    for y in range(max(0, math.floor((cy - ry) * sy)), min(px.h, math.floor((cy + ry * to) * sy) + 1)):
        xs = [x for x in range(px.w) if px.px[y][x] == fill
              and ((x + 0.5 - cx * s) / (rx * s)) ** 2 + ((y + 0.5 - cy * sy) / (ry * sy)) ** 2 <= 1]
        if xs:
            px.p(max(xs), y, shade)


def rim(g, rims):
    """Light a dark figure's silhouette so it holds on the dslate road: an edge pixel of a colour in rims takes
    rims[colour] = (lit, shade), lit where the edge faces up or left into the light and shade where it
    faces right or down. A shade of None leaves that side dark. On a minis.Mini it lights the drawn grid, so
    the rim is 1px at the small size."""
    g = raster(g)
    rims = {K[c]: v for c, v in rims.items()}
    edge = []
    for y in range(g.h):
        for x in range(g.w):
            c = g.px[y][x]
            if c not in rims:
                continue
            empty = [not (0 <= x + dx < g.w and 0 <= y + dy < g.h and g.px[y + dy][x + dx])
                     for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1))]
            if any(empty):
                edge.append((x, y, rims[c][0] if empty[0] or empty[1] else rims[c][1]))
    for x, y, c in edge:
        if c:
            g.p(x, y, c)
    return g


# The lit rim for every road sprite that fails 3:1 on the dslate road, for rim(): navy, ink and dslate take grey
# (slate opposite), slate lgrey, dark browns skin2, mid browns and ochre tan, greens green, blues cyan, and reds,
# mauves and purples pink.
LIT = dict(navy=("grey", "slate"), ink=("grey", "slate"), dslate=("grey", "slate"), slate=("lgrey", None),
           dbrown=("skin2", None), plum=("skin2", None), brown=("tan", None), rust=("tan", None),
           ochre=("tan", None), dgreen=("green", None), forest=("green", None), sky=("cyan", None),
           blue=("cyan", None), red=("pink", None), dred=("pink", None), mauve=("pink", None), purple=("pink", None))


def lit(g, extra=None):
    """rim with LIT (and extra, by colour) on g, returning g."""
    rim(g, {**LIT, **(extra or {})})
    return g


# Road sprites are drawn SCALE times the size their drawing functions lay them out at: a person laid out on
# 32x48, an animal on 32x32 and a pickup on 16x16 export at 48x72, 48x48 and 24x24. sprites() runs the functions
# on minis.Mini, which scales every shape before it rasterizes and keeps 1px lines 1px, so nothing is upscaled;
# the depth variants (minis.py, depths.py) run them at SCALE times each depth step.
SCALE = 1.5
# The ice cream truck is drawn in its own pixels at 56x50, then on a minis.Mini that keeps its 56 columns (a
# lane less 4px each side) and draws its rows ROW_SCALE times.
ROW_SCALE = 1.2
TRUCK_SCALE = (1, ROW_SCALE)


def drawn(s, draw, *args, **q):
    """draw(*args, **q) at scale s on a minis.Mini, or (sx, sy) for its columns and rows, its numeric keyword
    arguments (pose offsets) snapped to whole pixels as minis.snap has them at the row scale."""
    import minis  # minis imports this module, so it is imported when first used

    pose = {k: v for k, v in q.items() if isinstance(v, (int, float)) and not isinstance(v, bool)}
    sy = s[1] if isinstance(s, tuple) else s
    return minis.small(sys.modules[__name__], s, draw, *args, **{**q, **minis.snap(pose, sy)})


def big(draw, *args, **q):
    """draw(*args, **q) at SCALE: a person, an animal or a pickup."""
    return drawn(SCALE, draw, *args, **q)


# ---------- the walker (back view) ----------

def back_arm(g, x, w, top, parts, out=0, lift=0):
    """A walker's arm seen from behind, hanging from its shoulder at row top: parts are (rows, fill, shade) from
    the shoulder down; shade (or None) takes the right column. The shoulder never moves. out swings the hand
    that many pixels sideways, every row shifting in proportion to its distance from the shoulder, and lift
    shortens the arm's longest part that many rows, as an arm swung toward or away from the camera looks
    shorter. Offsets snap to the grid's own pixels, so the arm stays a clean stair of whole pixels."""
    s = scale_of(g)
    heights = [n for n, _, _ in parts]
    longest = heights.index(max(heights))
    heights[longest] = max(1, heights[longest] - lift)
    span = max(1, sum(heights) - 1)
    ends = [sum(heights[:i + 1]) for i in range(len(heights))]
    first, last = round(top * s), round((top + ends[-1]) * s)
    # one rect per row of the grid's own pixels, so the arm has no gaps at any scale or bob
    for py in range(first, last):
        d = py / s - top
        fill, shade = next((f, sh) for (_, f, sh), e in zip(parts, ends) if d < e - 1e-9)
        dx = math.copysign(math.floor(abs(out) * d / span * s), out) / s
        g.rect(x + dx, py / s, w, 1 / s, fill)
        if shade is not None:
            g.rect(x + dx + w - 1, py / s, 1, 1 / s, shade)


def walker_arms(g, xs, w, top, parts, arms, flare, reach):
    """Both of a walker's arms from behind, the left at xs[0] and the right at xs[1]. arms swings them against
    the legs: the arm swung forward (the left for arms above 0, the right below) shortens that much. flare
    throws both hands that many pixels out from the sides and reach shortens both arms, for a start or a
    stumble."""
    for x, side, fwd in ((xs[0], -1, arms), (xs[1], 1, -arms)):
        back_arm(g, x, w, top, parts, side * flare, max(0, fwd) + reach)


def casey_back(lf=0, rf=0, bob=0, arms=0, flare=0, reach=0):
    """Casey from behind: an orange cap over a blue hoodie."""
    g = Grid(32, 48)
    b = bob
    # legs and shoes; lf and rf lift a foot
    for x, f in ((11, lf), (17, rf)):
        g.rect(x, 33 + b, 4, 10 + f - b, "blue")
        g.rect(x + 3, 33 + b, 1, 10 + f - b, "navy")
        g.rect(x, 43 + f, 4, 2, "white")
        g.rect(x, 44 + f, 4, 1, "lgrey")
    # arms swing against the legs
    walker_arms(g, (5, 23), 4, 22 + b, ((10, "sky", "blue"), (3, "skin1", None)), arms, flare, reach)
    # hoodie
    g.rect(9, 21 + b, 14, 13, "sky")
    g.rect(20, 21 + b, 3, 13, "blue")
    g.rect(9, 21 + b, 1, 12, "cyan")
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    g.rect(9, 33 + b, 14, 1, "blue")
    g.ell(16, 22.5 + b, 6, 2.5, "blue", "navy")
    # head: hair, ears, cap and a ponytail
    g.rect(14, 19 + b, 4, 3, "skin1")
    g.cel(16, 12.5 + b, 8.5, 8.5, "dbrown", "plum", "brown")
    g.rect(7, 13 + b, 2, 3, "skin1")
    g.rect(23, 13 + b, 2, 3, "skin1")
    g.cel(16, 8 + b, 8.5, 5, "amber", "orange", "yellow")
    g.rect(8, 10 + b, 17, 2, "orange")
    g.rect(15, 10 + b, 2, 2, "dbrown")
    g.ell(16, 17 + b, 2.5, 4, "dbrown", "plum")
    return g


# ---------- the other walkers (back view) ----------

def ada_back(lf=0, rf=0, bob=0, arms=0, flare=0, reach=0):
    """Ada, 11, mixed race, caramel skin, long black curls falling straight down: yellow tee, blue shorts.
    She stands 4px shorter than the adults: her head and body sit lower and her legs are shorter."""
    g = Grid(32, 48)
    b = bob
    for x, f in ((12, lf), (17, rf)):
        g.rect(x, 40 + b, 3, 3 + f - b, "brown")
        g.rect(x, 43 + f, 3, 1, "white")
        g.rect(x, 44 + f, 3, 1, "lgrey")
        g.rect(x, 45 + f, 3, 1, "pink")
    walker_arms(g, (7, 22), 3, 30 + b, ((3, "yellow", None), (4, "brown", None)), arms, flare, reach)
    g.rect(10, 29 + b, 12, 8, "yellow")
    g.rect(19, 29 + b, 3, 8, "amber")
    g.rect(10, 36 + b, 12, 4, "sky")
    g.rect(19, 36 + b, 3, 4, "blue")
    g.rect(15, 36 + b, 2, 4, "blue")
    g.rect(7, 20 + b, 2, 3, "brown")
    g.rect(23, 20 + b, 2, 3, "brown")
    # black hair: a rounded crown, then long curls hanging straight down the back, bunched into bumps of
    # uneven size along the sides and the hem
    g.ell(16, 18.5 + b, 8, 7.5, "navy", "ink", "dslate")
    g.rect(9, 20 + b, 14, 10, "navy")
    g.rect(21, 20 + b, 2, 10, "ink")
    for x, y, rx, ry in ((8.7, 20.5, 1.4, 1.5), (8.4, 24.2, 1.8, 2.1), (8.8, 28.6, 1.4, 1.3)):
        g.ell(x, y + b, rx, ry, "navy")
    for x, y, rx, ry in ((23.3, 22, 1.6, 1.9), (23.2, 26.6, 1.3, 1.4), (23.4, 29.3, 1.6, 1.5)):
        g.ell(x, y + b, rx, ry, "ink")
    for x, y, rx, ry in ((10.2, 30.6, 1.6, 1.4), (13.4, 31, 2, 1.6), (16.6, 30.4, 1.3, 1.3), (19.4, 30.8, 1.9, 1.5),
                         (21.9, 30.2, 1.2, 1.2)):
        g.ell(x, y + b, rx, ry, "navy" if x < 20 else "ink")
    # the curls as a few unbroken wavy locks down the back, dslate on the lit side and navy in the shade, so
    # the hair holds one mass at road scale with no single-pixel texture
    for x0, y0, length, c in CURL_LOCKS:
        for k, n in curl_runs(length):
            g.rect(x0 + CURL_WAVE[k % len(CURL_WAVE)], y0 + k + b, 1, n, c)
    g.ell(16, 12 + b, 2.5, 1.5, "pink", "mauve")
    # a light rim along the edges facing the light keeps her dark hair and skin off the dark road
    return rim(g, dict(navy=("grey", "slate"), ink=("grey", "slate"), dslate=("grey", "slate"),
                       brown=("skin2", None), blue=("sky", None)))


def mr_b_back(lf=0, rf=0, bob=0, arms=0, flare=0, reach=0):
    """Mr. B, 45, Black, bald (his beard is under his chin, out of sight from behind): lilac tee, navy track pants,
    sneakers. The tee's lilac is a hue no road has, so he reads on all six."""
    g = Grid(32, 48)
    b = bob
    for x, f in ((11, lf), (17, rf)):
        g.rect(x, 33 + b, 4, 10 + f - b, "navy")
        # the track pants' stripe runs down the outside of each leg
        g.rect(x + (3 if x > 16 else 0), 33 + b, 1, 10 + f - b, "grey")
        g.rect(x, 43 + f, 4, 2, "white")
        g.rect(x, 44 + f, 4, 1, "lgrey")
        g.rect(x + 1, 43 + f, 2, 1, "red")
    walker_arms(g, (5, 23), 4, 22 + b, ((4, "lilac", "violet"), (6, "dbrown", "plum"), (3, "dbrown", None)), arms,
                flare, reach)
    # the lilac tee, shaded dgreen down its right side
    g.rect(9, 21 + b, 14, 13, "lilac")
    g.rect(20, 21 + b, 3, 13, "violet")
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    g.rect(13, 19 + b, 6, 3, "dbrown")
    # bald head, the beard showing along the jaw, a shine on the crown
    g.rect(8, 12 + b, 2, 3, "dbrown")
    g.rect(22, 12 + b, 2, 3, "plum")
    g.cel(16, 12 + b, 7, 9, "dbrown", "plum", power=2.15)
    g.rect(11, 7 + b, 3, 1, "brown")
    g.p(11, 8 + b, "brown")
    # a light rim along the edges facing the light, a dimmer one opposite, so he holds on the dark road
    return rim(g, dict(navy=("grey", "grey"), violet=("lilac", None), dbrown=("skin2", "brown"),
                       plum=("skin2", "brown")))


def trista_back(lf=0, rf=0, bob=0, arms=0, flare=0, reach=0):
    """Trista, 50, dirty blonde bob to the shoulders, cute: green cardigan, brown skirt, tights, brown flats."""
    g = Grid(32, 48)
    b = bob
    for x, f in ((11, lf), (17, rf)):
        g.rect(x + 1, 37 + b, 3, 6 + f - b, "dslate")
        g.rect(x, 43 + f, 4, 2, "dbrown")
    walker_arms(g, (5, 23), 4, 22 + b, ((10, "dgreen", "forest"), (3, "skin1", None)), arms, flare, reach)
    g.rect(9, 21 + b, 14, 11, "dgreen")
    g.rect(20, 21 + b, 3, 11, "forest")
    g.rect(9, 21 + b, 1, 10, "green")
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    g.rect(9, 31 + b, 14, 7, "clay")
    g.rect(20, 31 + b, 3, 7, "bark")
    g.rect(9, 31 + b, 14, 1, "tan")
    # a canvas tote with an apple on it
    g.rect(25, 24 + b, 5, 1, "brown")
    g.rect(24, 25 + b, 7, 8, "cream")
    g.rect(29, 25 + b, 2, 8, "tan")
    g.rect(26, 27 + b, 3, 3, "red")
    g.p(27, 26 + b, "dgreen")
    # a dirty blonde bob to the shoulders, flicking out at the ends: light brown, darker than her skin,
    # with golden amber streaks where the light catches it
    g.cel(16, 12.5 + b, 9, 9, "brown", "dbrown", "tan")
    g.rect(8, 14 + b, 17, 5, "brown")
    g.rect(22, 14 + b, 3, 5, "dbrown")
    g.ell(16, 19 + b, 9, 2.5, "brown", "dbrown")
    g.p(7, 20 + b, "brown")
    g.p(25, 20 + b, "dbrown")
    for x, y, h in ((10, 9, 5), (13, 6, 4), (16, 8, 6), (19, 6, 3)):
        g.rect(x, y + b, 1, h, "amber")
    g.rect(14, 11 + b, 1, 4, "dbrown")
    g.rect(20, 11 + b, 1, 4, "dbrown")
    # a light rim along the edges facing the light keeps her hair, cardigan and skirt off the dark road
    return rim(g, dict(brown=("tan", None), dgreen=("green", None), navy=("grey", None), dslate=("grey", None)))


# Ada's curly locks as (x, top row, rows, colour), each a 1px line swinging along CURL_WAVE as it falls, two
# rows at a time, so every pixel of a lock touches the next.
CURL_LOCKS = ((11, 20, 10, "dslate"), (15, 19, 10, "dslate"), (19, 21, 8, "ink"))
CURL_WAVE = (0, 0, 1, 1, 0, 0, -1, -1)


def curl_runs(length):
    """(first row, rows) of each straight run of a lock length rows long: a run is one 1px-wide rect, so drawn
    bigger the lock stays unbroken."""
    k = 0
    while k < length:
        n = 1
        while k + n < length and CURL_WAVE[(k + n) % len(CURL_WAVE)] == CURL_WAVE[k % len(CURL_WAVE)]:
            n += 1
        yield k, n
        k += n


WALKERS = {
    "walker-casey": casey_back,
    "walker-ada": ada_back,
    "walker-mr-b": mr_b_back,
    "walker-trista": trista_back,
}


WALKER_WALK = [dict(lf=-2, rf=0, arms=1), dict(lf=-1, rf=-1, bob=-1), dict(lf=0, rf=-2, arms=-1),
               dict(lf=-1, rf=-1, bob=-1)]
WALKER_REACT = [dict(lf=-4, rf=-4, bob=-4, flare=3, reach=1), dict(lf=-1, rf=-1, bob=-1, flare=1)]
# A bump: lurch left with the arms up, wobble back, steady (a right lean would push a tote out of the frame).
# Each pose is (lean, walker args).
WALKER_STUMBLE = [(-3, dict(lf=-3, rf=0, bob=1, flare=3, reach=1)), (1, dict(lf=0, rf=-3, flare=3, reach=1)),
                  (-1, dict(lf=-1, rf=0, arms=1)), (0, dict(lf=-1, rf=-1, bob=-1))]
# Waiting while the walk pauses: feet planted, arms at rest, a 1px breath.
WALKER_IDLE = [dict(), dict(bob=-1)]
# The breathing bob every standing person shares, and its frame duration in ms.
BREATH, BREATH_MS = (0, -1), 400
# A person walking down the road at the player, as the walkers walk: the left foot lifted, both feet 1px up
# as the body passes over them 1px higher, the right foot lifted, passing again; 4 frames at 100ms, a 400ms
# stride. arms swings the free arms against the legs: 1 takes the screen-left arm back (its hand 1 row up)
# with the left foot lifted, -1 the screen-right arm with the right foot (see swung).
PERSON_WALK = (dict(lf=-2, arms=1), dict(lf=-1, rf=-1, bob=-1), dict(rf=-2, arms=-1), dict(lf=-1, rf=-1, bob=-1))
PERSON_WALK_MS = 100


def lean(g, k):
    """Shear a person about its feet: the head moves k layout pixels sideways (k x the grid's height / 48
    pixels), the shoes stay put."""
    g = raster(g)
    f = g.h / 48
    out = Grid(g.w, g.h)
    out.edge = g.edge
    for y in range(g.h):
        dx = round(k * f * max(0, 44 * f - y) / (36 * f))
        for x in range(g.w):
            if g.px[y][x] and 0 <= x + dx < g.w:
                out.px[y][x + dx] = g.px[y][x]
    return out


# ---------- the walkers waving (front view) ----------
# A walker waving, facing the camera: the same clothes, colours and frame as
# the back view, feet on the same rows, the left arm (screen right) raised and swinging from the shoulder.

def raised_arm(g, x, w, top, bottom, dx, parts):
    """An arm raised from the shoulder (its bottom row) to the hand (its top row), tilted so the hand sits dx
    pixels right of the shoulder; every row shifts in proportion, so it pivots at the shoulder. parts are
    (rows, fill, shade) from the hand down, the last running to the shoulder; shade takes the right column."""
    y = top
    for i, (rows, fill, shade) in enumerate(parts):
        end = bottom + 1 if i == len(parts) - 1 else y + rows
        # each run of rows with the same shift is one rect, so drawn bigger the arm stays solid
        yy = y
        while yy < end:
            s = round(dx * (bottom - yy) / (bottom - top))
            n = 1
            while yy + n < end and round(dx * (bottom - yy - n) / (bottom - top)) == s:
                n += 1
            g.rect(x + s, yy, w, n, fill)
            g.rect(x + s + w - 1, yy, 1, n, shade)
            yy += n
        y = end
    # the thumb, so the hand reads as an open palm
    g.p(x + round(dx * (bottom - top - 1) / (bottom - top)) - 1, top + 1, parts[0][1])


def front_eyes(g, cx, y):
    """Eyes for dark skin: a white beside each ink pupil, so they hold on the face."""
    for x in (cx - 5, cx + 3):
        g.rect(x, y, 1, 2, "white")
        g.rect(x + 1, y, 1, 2, "ink")


def eye_boxes(g, cx, y, spread=4):
    """(left column, top row, size) in pixels of each eye face_front draws at (cx, y) with spread: 2px at
    1x, and on a minis.Mini the eyes minis.face_front draws at its scale."""
    s = scale_of(g)
    n = max(1, math.floor(2 * s + 0.5))
    top = math.floor((y + 1) * s + 0.5 - n / 2)
    return [(math.floor(x * s + 0.5 - n / 2), top, n) for x in (cx - spread, cx + spread)]


def glasses(g, cx, y, c, spread=4, skin="skin1"):
    """Round clear glasses on the eyes face_front draws at (cx, y): a ring 1px out from each eye with its
    corners cut, and a bridge between them a row under the eyes' top. Inside each ring the lens shows skin
    with a 2px pupil glinting white at its top-left, set toward the nose, so they read as glasses and not
    sunglasses. Drawn in pixels round the eyes, so they fit them at any scale."""
    px = raster(g)
    (lx, top, n), (rx, _, _) = eye_boxes(g, cx, y, spread)
    if n >= 3:
        for x0, inner in ((lx, lx + n - 2), (rx, rx)):
            px.rect(x0, top, n, n, skin)
            px.rect(inner, top + n - 2, 2, 2, "ink")
            px.p(inner, top + n - 2, "white")
    for x0 in (lx, rx):
        px.rect(x0 - 1, top, 1, n, c)
        px.rect(x0 + n, top, 1, n, c)
        px.rect(x0, top - 1, n, 1, c)
        px.rect(x0, top + n, n, 1, c)
    px.rect(lx + n + 1, top + 1, rx - lx - n - 2, 1, c)


def nose(g, cx, y, c="skin2", spread=4):
    """A small nose between the eyes face_front draws at (cx, y), just under their bottom row: a 1px shadow
    down its right side and a pixel at its tip, so glasses have something to sit on."""
    px = raster(g)
    (lx, top, n), (rx, _, _) = eye_boxes(g, cx, y, spread)
    mid = (lx + n + rx) // 2
    px.rect(mid, top + n, 1, 2, c)
    px.p(mid - 1, top + n + 1, c)


def raise_mouth(g, cx, y, lips="dbrown", skin="skin1"):
    """Move the smile face_front draws at (cx, y) up a drawn pixel, the skin closing in under it."""
    px, s = raster(g), scale_of(g)
    col, fill = K[lips], K[skin]
    spots = [(x, yy) for yy in range(math.floor((y + 3) * s), math.ceil((y + 7) * s))
             for x in range(math.floor((cx - 3) * s), math.ceil((cx + 3) * s)) if px.px[yy][x] == col]
    for x, yy in spots:
        px.px[yy][x] = fill
    for x, yy in spots:
        px.px[yy - 1][x] = col


def casey_front(wave=0, bob=0):
    """Casey facing the camera: the amber cap's orange brim over the eyes, sky hoodie with a blue kangaroo
    pocket and white drawstrings, jeans, white sneakers."""
    g = Grid(32, 48)
    b = bob
    for x in (11, 17):
        g.rect(x, 33 + b, 4, 10 - b, "blue")
        g.rect(x + 3, 33 + b, 1, 10 - b, "navy")
        g.rect(x, 43, 4, 2, "white")
        g.rect(x, 44, 4, 1, "lgrey")
    g.rect(5, 22 + b, 4, 10, "sky")
    g.rect(5, 22 + b, 1, 10, "cyan")
    g.rect(8, 22 + b, 1, 10, "blue")
    g.rect(5, 32 + b, 4, 3, "skin1")
    g.rect(9, 21 + b, 14, 13, "sky")
    g.rect(20, 21 + b, 3, 13, "blue")
    g.rect(9, 21 + b, 1, 12, "cyan")
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    g.rect(9, 33 + b, 14, 1, "blue")
    g.rect(11, 27 + b, 10, 5, "blue")
    g.rect(12, 28 + b, 8, 4, "sky")
    g.rect(14, 22 + b, 1, 4, "white")
    g.rect(17, 22 + b, 1, 4, "white")
    g.cel(16, 21.5 + b, 6, 2, "blue")
    g.rect(14, 19 + b, 4, 3, "skin2")
    raised_arm(g, 23, 4, 9 + b, 23 + b, wave, ((3, "skin1", "skin2"), (0, "sky", "blue")))
    # head: hair at the sides under the cap, ears, face, then the cap with its brim towards the camera
    g.cel(16, 11 + b, 8.5, 6, "dbrown", "plum", "brown")
    g.rect(7, 13 + b, 2, 3, "skin1")
    g.rect(23, 13 + b, 2, 3, "skin1")
    face_disc(g, 16, 14 + b, 7.5, 6.5, "skin1", "skin2")
    g.cel(16, 8 + b, 8.5, 5, "amber", "orange", "yellow")
    g.rect(7, 10 + b, 18, 2, "orange")
    g.rect(7, 11 + b, 18, 1, "rust")
    g.p(16, 6 + b, "yellow")
    face_front(g, 16, 14 + b)
    nose(g, 16, 14 + b)
    g.p(10, 17 + b, "pink")
    g.p(22, 17 + b, "pink")
    return g


def ada_front(wave=0, bob=0):
    """Ada facing the camera, 4px shorter than the adults: long black curls framing her face and falling past
    her shoulders, a pink clip, yellow tee, blue shorts."""
    g = Grid(32, 48)
    b = bob
    for x in (12, 17):
        g.rect(x, 40 + b, 3, 3 - b, "brown")
        g.rect(x, 43, 3, 1, "white")
        g.rect(x, 44, 3, 1, "lgrey")
        g.rect(x, 45, 3, 1, "pink")
    # the curls behind her shoulders, then the tee and shorts over them
    g.cel(16, 18.5 + b, 8.5, 8, "navy", "ink", "dslate")
    g.rect(8, 19 + b, 16, 11, "navy")
    g.rect(21, 19 + b, 3, 11, "ink")
    for x, y, rx, ry, c in ((8.4, 23, 1.6, 2, "navy"), (8.6, 28, 1.4, 1.6, "navy"), (23.6, 23.5, 1.4, 1.8, "ink"),
                            (23.4, 28.4, 1.5, 1.5, "ink")):
        g.cel(x, y + b, rx, ry, c)
    g.rect(7, 30 + b, 3, 7, "brown")
    g.rect(7, 30 + b, 3, 3, "yellow")
    g.rect(10, 29 + b, 12, 8, "yellow")
    g.rect(19, 29 + b, 3, 8, "amber")
    g.rect(14, 29 + b, 4, 1, "amber")
    g.rect(10, 36 + b, 12, 4, "sky")
    g.rect(19, 36 + b, 3, 4, "blue")
    g.rect(15, 38 + b, 2, 2, "blue")
    g.rect(14, 26 + b, 4, 3, "dbrown")
    raised_arm(g, 22, 3, 16 + b, 31 + b, wave, ((3, "brown", "dbrown"), (9, "brown", "dbrown"), (0, "yellow", "amber")))
    # her face, then the curls over her forehead, lit dslate on the left
    face_disc(g, 16, 20.5 + b, 6.5, 6.5, "brown", "dbrown")
    g.rect(10, 18 + b, 1, 4, "navy")
    g.rect(22, 18 + b, 1, 4, "ink")
    g.cel(16, 14.5 + b, 7.5, 3.5, "navy", "ink", "dslate")
    for x, y in ((11, 16), (14, 17), (18, 17), (21, 16)):
        g.p(x, y + b, "navy")
    g.rect(11, 12 + b, 3, 1, "dslate")
    g.cel(21, 13 + b, 2, 1.5, "pink", "mauve")
    face_front(g, 16, 20 + b)
    nose(g, 16, 20 + b, "dbrown")
    return rim(g, dict(navy=("grey", "slate"), ink=("grey", "slate"), dslate=("grey", "slate"),
                       brown=("skin2", None), blue=("sky", None)))


def mr_b_front(wave=0, bob=0):
    """Mr. B facing the camera: bald, the chin-strap beard along his jaw and under his chin, a smile, lilac tee,
    navy track pants with a grey stripe, white sneakers."""
    g = Grid(32, 48)
    b = bob
    for x in (11, 17):
        g.rect(x, 33 + b, 4, 10 - b, "navy")
        g.rect(x + (0 if x < 16 else 3), 33 + b, 1, 10 - b, "grey")
        g.rect(x, 43, 4, 2, "white")
        g.rect(x, 44, 4, 1, "lgrey")
        g.rect(x + 1, 43, 2, 1, "red")
    g.rect(5, 22 + b, 4, 4, "lilac")
    g.rect(8, 22 + b, 1, 4, "violet")
    g.rect(5, 26 + b, 4, 6, "dbrown")
    g.rect(8, 26 + b, 1, 6, "plum")
    g.rect(5, 32 + b, 4, 3, "dbrown")
    g.rect(9, 21 + b, 14, 13, "lilac")
    g.rect(20, 21 + b, 3, 13, "violet")
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    g.rect(13, 19 + b, 6, 3, "plum")
    g.rect(13, 21 + b, 6, 1, "violet")
    raised_arm(g, 23, 4, 9 + b, 23 + b, wave, ((3, "dbrown", "plum"), (8, "dbrown", "plum"), (0, "lilac", "violet")))
    g.rect(8, 12 + b, 2, 3, "dbrown")
    g.rect(22, 12 + b, 2, 3, "plum")
    face_disc(g, 16, 12 + b, 7, 9, "dbrown", "plum")
    g.rect(11, 7 + b, 3, 1, "brown")
    g.p(11, 8 + b, "brown")
    # the beard runs down the jaw and round under the chin, leaving the upper lip bare
    g.rect(9, 14 + b, 1, 4, "ink")
    g.rect(22, 14 + b, 1, 4, "ink")
    g.cel(16, 18.5 + b, 6, 2.5, "ink")
    g.rect(13, 16 + b, 6, 1, "dbrown")
    front_eyes(g, 16, 12 + b)
    nose(g, 16, 12 + b, "plum")
    g.rect(14, 17 + b, 4, 1, "cream")
    g.p(13, 16 + b, "cream")
    g.p(18, 16 + b, "cream")
    return rim(g, dict(navy=("grey", "grey"), violet=("lilac", None), dbrown=("skin2", "brown"),
                       plum=("skin2", "brown"), ink=("grey", "slate")))


def trista_front(wave=0, bob=0):
    """Trista facing the camera: a dirty blonde bob framing her face with a side-swept fringe, round glasses, a
    green cardigan open over a white blouse, brown skirt, tights, brown flats, her apple tote on her right
    shoulder (screen left)."""
    g = Grid(32, 48)
    b = bob
    for x in (11, 17):
        g.rect(x + 1, 37 + b, 3, 6 - b, "dslate")
        g.rect(x, 43, 4, 2, "dbrown")
    g.rect(5, 22 + b, 4, 10, "dgreen")
    g.rect(8, 22 + b, 1, 10, "forest")
    g.rect(5, 22 + b, 1, 10, "green")
    g.rect(5, 32 + b, 4, 3, "skin1")
    g.rect(9, 21 + b, 14, 11, "dgreen")
    g.rect(20, 21 + b, 3, 11, "forest")
    g.rect(9, 21 + b, 1, 10, "green")
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    g.rect(14, 21 + b, 4, 10, "white")
    g.rect(17, 22 + b, 1, 9, "lgrey")
    g.tri((12, 21 + b), (16, 21 + b), (14.5, 24.5 + b), "white")
    g.tri((16, 21 + b), (20, 21 + b), (17.5, 24.5 + b), "white")
    for y in (25, 28):
        g.p(13, y + b, "amber")
    g.rect(9, 31 + b, 14, 7, "clay")
    g.rect(20, 31 + b, 3, 7, "bark")
    g.rect(9, 31 + b, 14, 1, "tan")
    # the canvas tote hangs off her shoulder by a strap, the apple facing out
    g.rect(7, 21 + b, 1, 5, "brown")
    g.rect(2, 26 + b, 7, 8, "cream")
    g.rect(7, 26 + b, 2, 8, "tan")
    g.rect(4, 28 + b, 3, 3, "red")
    g.p(5, 27 + b, "dgreen")
    # the bob's left flick goes under the arms, so a raised arm covers it
    g.p(6, 19 + b, "brown")
    g.rect(7, 19 + b, 2, 1, "brown")
    raised_arm(g, 23, 4, 9 + b, 23 + b, wave, ((3, "skin1", "skin2"), (0, "dgreen", "forest")))
    # the bob: hair behind and beside the face to the shoulders, flicking out, then the face and fringe
    g.cel(16, 12.5 + b, 9, 9, "brown", "dbrown", "tan")
    g.rect(7, 12 + b, 18, 7, "brown")
    g.rect(22, 12 + b, 3, 7, "dbrown")
    g.p(25, 19 + b, "dbrown")
    g.rect(23, 19 + b, 2, 1, "dbrown")
    face_disc(g, 16, 14.5 + b, 6.5, 6.5, "skin1", "skin2")
    g.rect(14, 19 + b, 4, 2, "skin2")
    g.cel(17, 8.5 + b, 8, 3.5, "brown", "dbrown", "tan")
    g.tri((8, 8 + b), (19, 9 + b), (9, 13.5 + b), "brown")
    for x, y, h in ((11, 6, 3), (15, 5, 3), (19, 6, 2)):
        g.rect(x, y + b, 1, h, "amber")
    # her eyes sit closer together than the others', behind her glasses
    face_front(g, 16, 14 + b, spread=3)
    raise_mouth(g, 16, 14 + b)
    nose(g, 16, 14 + b, spread=3)
    glasses(g, 16, 14 + b, "dbrown", spread=3)
    return rim(g, dict(brown=("tan", None), dgreen=("green", None), navy=("grey", None), dslate=("grey", None)))


WAVES = {
    "walker-casey": casey_front,
    "walker-ada": ada_front,
    "walker-mr-b": mr_b_front,
    "walker-trista": trista_front,
}
# The hand's swing right of the shoulder, one frame each: out, further, back.
WALKER_WAVE = (1, 3, 4, 3)
WALKER_WAVE_MS = 150

# ---------- the walkers cheering (front view) ----------
# The wave drawing with both arms raised: the hanging arm is cleared, then the right arm is raised as the wave
# raises it and the left as its mirror. CHEER_ARMS gives each walker's hanging arm on the 32x48 design grid as
# rects (x0, x1, y0, y1: columns x0 to x1 - 1, rows y0 to y1 - 1 before the crouch) and its colours; only those
# colours are cleared, so what overlaps the arm (Trista's tote) stays.
CHEER_ARMS = {
    "walker-casey": (((5, 9, 22, 35),), ("sky", "cyan", "blue", "skin1")),
    "walker-mr-b": (((5, 9, 22, 35),), ("lilac", "violet", "dbrown", "plum")),
    "walker-ada": (((7, 10, 30, 37),), ("brown", "dbrown", "yellow", "amber")),
    "walker-trista": (((5, 9, 22, 26), (5, 9, 34, 35)), ("dgreen", "forest", "green", "skin1")),
}
# One frame each: (crouch in design pixels, the hands' swing out from the shoulders, hop in pixels): crouch,
# take off, the top of the hop, land.
WALKER_CHEER = ((2, 1, 0), (0, 3, 2), (0, 4, 3), (1, 3, 0))
WALKER_CHEER_MS = 120


def cheering(key, swing, bob=0):
    """key's front view (WAVES) with both arms raised swing design pixels out from the shoulders, crouched bob."""
    global raised_arm
    rects, cols = CHEER_ARMS[key]
    hexes = {K[c] for c in cols}
    lift = raised_arm

    def both(g, x, w, top, bottom, _swing, parts):
        inner, s = raster(g), scale_of(g)
        for x0, x1, y0, y1 in rects:
            for yy in range(math.floor((y0 + bob) * s), math.ceil((y1 + bob) * s)):
                for xx in range(math.floor(x0 * s), math.ceil(x1 * s)):
                    if 0 <= yy < inner.h and inner.px[yy][xx] in hexes:
                        inner.px[yy][xx] = None
        lift(g, x, w, top, bottom, swing, parts)
        # the mirrored arm's thumb goes on the hand's inner (right) side, as a mirror of the raised one's
        left = 32 - x - w
        lift(g, left, w, top, bottom, -swing, parts)
        thumb = left + round(-swing * (bottom - top - 1) / (bottom - top)) - 1
        g.p(thumb, top + 1, None)
        g.p(thumb + w + 1, top + 1, parts[0][1])

    raised_arm = both
    try:
        return WAVES[key](wave=0, bob=bob)
    finally:
        raised_arm = lift


def hopped(rows, hop):
    """A frame's pixel rows moved hop rows up, the feet off the ground."""
    return rows[hop:] + [[None] * len(rows[0]) for _ in range(hop)]


# ---------- pickups ----------

# The treat's idle: it bobs a pixel up and back, its heart glinting at the top of the bob.
TREAT_IDLE = (dict(lift=0), dict(lift=-1))
# The heart on the treat's bone, by its width in drawn pixels: 1 red, d dred, l the lit pixel (pink, white
# when it glints; the 3-wide heart is too small for one). treat_heart picks the widest that suits the scale
# it is drawn at.
TREAT_HEARTS = {
    7: [".11.11.", "1l11111", "111111d", ".1111d.", "..11d..", "...1..."],
    5: ["11.11", "1l11d", ".11d.", "..1.."],
    3: ["1.1", "111", ".1."],
}


def treat_heart(g, cx, cy, glint):
    """A TREAT_HEARTS heart centred on (cx, cy) in design pixels, drawn pixel for pixel at g's scale (as
    face_front draws a face) so it keeps its shape at every size: 7 wide from 1.3x, 5 from 0.9x, else 3."""
    s = getattr(g, "s", 1)
    w = 7 if s >= 1.3 else 5 if s >= 0.9 else 3
    rows = TREAT_HEARTS[w]
    x0 = math.floor(cx * s + 0.5 - w / 2)
    y0 = math.floor(cy * s + 0.5 - len(rows) / 2)
    cols = {"1": "red", "d": "dred", "l": "white" if glint else "pink"}
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                raster(g).p(x0 + x, y0 + y, cols[ch])


def treat(lift=0):
    """A white bone, a fill no road uses, so it shows on every road, with a red heart on the middle of its
    shaft: a treat that gives a heart. The heart's lit pixel glints white at the top of the bob. The road
    outline holds it on the light roads and LIT's rim lights the heart where it stands proud of the bone.
    lift moves the drawn treat whole pixels (lift x the scale, rounded) after it is drawn, so the bone keeps
    its shape at the top of the bob."""
    g = edged(Grid(16, 16))
    y = 6
    g.rect(4, y, 8, 3, "white")
    # each end two round knobs with a notch between them, so the bone reads as a bone and not a bow
    for cx, cy in ((3, y - 0.2), (3, y + 3.2), (13, y - 0.2), (13, y + 3.2)):
        g.ell(cx, cy, 1.7, 1.7, "white", "lgrey")
    g.rect(4, y + 2, 8, 1, "lgrey")
    treat_heart(g, 8, y + 1.5, lift < 0)
    inner = raster(lit(g))
    inner.px = hopped(inner.px, round(-lift * getattr(g, "s", 1)))
    return g


def tip(rx):
    """A coin spinning: rx is its half-width as it turns, with the road outline and a white glint on its lit
    edge."""
    g = edged(Grid(16, 16))
    if rx < 1.5:
        g.rect(7, 3, 2, 10, "orange")
        g.rect(7, 3, 1, 10, "amber")
        g.p(7, 4, "white")
        return g
    g.ell(8, 8, rx, 5.5, "amber", "orange", "yellow")
    if rx > 2:
        g.rect(8, 5, 1, 6, "orange")
        g.p(7, 6, "orange")
        g.p(9, 9, "orange")
    g.p(round(8 - rx * 0.55), 5, "white")
    return g


# ---------- encounters (facing the player) ----------

# The skunk's idle: the tail sways right, back, blinking, then left. Its walk, the step toward the pack: a
# front paw lifts 1px, left then right, with the tail swaying against it.
SKUNK_IDLE = (dict(sway=0), dict(sway=1), dict(sway=0, blink=True), dict(sway=-1))
SKUNK_WALK = (dict(sway=1, paw_l=-1), dict(sway=0), dict(sway=-1, paw_r=-1), dict(sway=0))


def skunk(sway=0, blink=False, paw_l=0, paw_r=0):
    """The skunk facing the player at its own eye level, a squat front elevation: its tail fans up behind its
    right shoulder with a white stripe curving along its inner edge, and sways 1px either way; blink shuts its
    eyes to ink lines; paw_l and paw_r move the left and right front paws down (up when negative). An ink line
    parts the head from the body and the body from the tail. The head is in front of the body: a white blaze
    runs up from a white muzzle between the ears, and the eyes are ink with a white glint. Front paws on the
    road. The road outline and a grey rim on the dark fur so it holds on the dslate road."""
    g = edged(Grid())
    s = sway
    # the tail: a plume up behind the right shoulder, a white crescent along its upper left
    g.ell(20 + s, 11, 8, 8.5, "navy", "ink", "dslate")
    g.ell(20 + s, 11, 6, 6.5, "white", "lgrey")
    g.ell(22 + s, 13, 5, 5.5, "navy", "ink")
    # body, low and wide, lit on its upper left, an ink line parting it from the tail
    g.ell(16, 24, 9.5, 5.8, "ink")
    g.ell(16, 24, 8.5, 4.8, "navy", "ink", "dslate")
    # the neck: an ink line round the head
    g.ell(14, 19, 7.5, 6.5, "ink")
    # head: ears, the blaze down to the muzzle, eyes with glints
    for x, top, inner in ((9, 10, 11), (19, 18, 17)):
        g.tri((x, 17), (top, 11), (2 * inner - x, 15), "dslate")
    g.ell(14, 19, 6.5, 5.5, "dslate")
    g.ell(14, 19.5, 5.5, 4.5, "navy", None, "dslate")
    g.rect(13, 13, 2, 7, "white")
    g.ell(14, 21.5, 2.8, 1.8, "white", "lgrey")
    g.rect(13, 20, 2, 1, "pink")
    for x in (10, 16):
        if blink:
            g.rect(x, 18, 2, 1, "ink")
            continue
        g.rect(x, 17, 2, 2, "ink")
        g.p(x, 17, "white")
    # front paws, set apart from the body by their dslate tops
    for x, dy in ((10, paw_l), (16, paw_r)):
        y = 27 + dy
        g.rect(x, y, 3, 2, "ink")
        g.rect(x, y, 3, 1, "dslate")
    return rim(g, LIT)


# Toronto's black squirrel, for every squirrel drawing (squirrel, squirrel_run, hazards.squirrel_dash and
# the icons): navy fur shaded ink and lit slate, a dslate streak down the tail, a dslate belly and paws held
# at the chest, navy feet and a grey nose. LIT's rim puts grey on its top-left edges and slate on the rest,
# so the dark fur and the tail's edge hold on the dslate road; the eyes keep their white glints.
SQUIRREL_FUR = dict(fur="navy", shade="ink", lit="slate", streak="dslate", belly="dslate", paw="dslate",
                    foot="navy", nose="grey")


# The squirrel is laid out small on the 32x32 animal grid, so at SCALE its body (head to feet, without the
# tail) stands about 20px, under the smallest dog's: a design unit is 1.5px, so lengths in thirds land on whole
# pixels. SQUIRREL_EYE is each eye's side and SQUIRREL_EYE_SPREAD each eye centre's distance from the head's
# centre column, both 2px at full size; minis.squirrel_head draws the eyes from them at every depth step.
SQUIRREL_EYE = 4 / 3
SQUIRREL_EYE_SPREAD = 4 / 3


def squirrel_tail(g, x, y, rx, ry, sway=0):
    """The squirrel's bushy tail, standing ry above and below (x, y): a narrower stem rising from behind the body
    into a plume rx wide at the top, its tip flicked out, with a lighter streak down its core, so it reads apart
    from the darker body in front of it. sway moves the plume sideways and leaves the stem on the body."""
    f = SQUIRREL_FUR
    g.cel(x - 0.5, y + 0.4 * ry, rx - 1, 0.6 * ry, f["fur"], f["shade"], f["lit"])
    x += sway
    g.cel(x, y - 0.3 * ry, rx, 0.7 * ry, f["fur"], f["shade"], f["lit"])
    g.cel(x + rx - 0.6, y - 0.8 * ry, 1.4, 1.2, f["fur"], f["shade"], f["lit"])
    g.cel(x + 0.2, y - 0.2 * ry, rx - 1.8, 0.7 * ry - 1.6, f["streak"])


def squirrel(tail=0):
    """The squirrel sitting up facing the player, a front elevation: its bushy tail rises behind its
    right side and curls over at the top, the body sits upright with its paws held at its chest and its hind
    feet planted. tail swishes the tail 1px right. The road outline and LIT's rim."""
    f = SQUIRREL_FUR
    g = edged(Grid())
    squirrel_tail(g, 21.3, 20, 3, 6.5, tail)
    # body, sitting up, with a lighter belly; hind feet either side
    g.cel(16, 25.2, 3.5, 3.8, f["fur"], f["shade"], f["lit"])
    g.cel(16, 26, 1.5, 2, f["belly"])
    for x in (12 + 2 / 3, 17 + 1 / 3):
        g.rect(x, 28, 2, 4 / 3, f["foot"])
    # paws held together at the chest
    g.rect(14 + 2 / 3, 23 + 1 / 3, 2 + 2 / 3, 4 / 3, f["paw"])
    squirrel_head(g, 16, 19 + 1 / 3)
    return rim(g, LIT)


def squirrel_head(g, x, y):
    """The squirrel's head facing the player, its eyes' centres on row y and either side of column x, with
    its ears, an ink chin line parting it from the body, and its face."""
    f = SQUIRREL_FUR
    g.tri((x - 3, y - 0.7), (x - 2.3, y - 3.3), (x - 0.9, y - 2), f["fur"])
    g.tri((x + 3, y - 0.7), (x + 2.3, y - 3.3), (x + 0.9, y - 2), f["fur"])
    g.cel(x, y + 0.3 + 2 / 3, 3.1, 2.6, f["shade"])
    g.cel(x, y + 0.3, 3.1, 2.6, f["fur"], f["shade"], f["lit"])
    g.cel(x, y + 1.6, 1.6, 1, f["belly"])
    # square eyes, each with a glint a quarter of its size at the top-left, so they read as two bright eyes
    e = SQUIRREL_EYE
    for d in (-1, 1):
        ex = x + d * SQUIRREL_EYE_SPREAD - e / 2
        g.rect(ex, y - e / 2, e, e, "ink")
        g.rect(ex, y - e / 2, e / 2, e / 2, "white")
    g.rect(x - 2 / 3, y + 4 / 3, 4 / 3, 2 / 3, f["nose"])


# The squirrel's bound, landing first: (body y, head y, tail (x, y, rx, ry), front paws (left x, right x, y,
# height)). The head's y stays sitting's plus whole steps of 2px (4/3), so its eyes raster alike every frame.
# It lands stretched low and wide with its tail streaming up behind, crouches to push off with its tail
# swinging over, flies gathered 2px higher with its paws tucked under its chin and its tail arched, then
# reaches down for the next landing.
SQUIRREL_BOUND = (
    (25.3, 23 + 1 / 3, (21.8, 20, 3, 5.6), (12, 18 + 2 / 3, 27 + 2 / 3, 4 / 3)),
    (24.7, 22, (21.6, 18.8, 3, 5.6), (12 + 2 / 3, 18, 27 + 1 / 3, 4 / 3)),
    (23.4, 20 + 2 / 3, (21, 17.3, 3, 5.4), (13 + 1 / 3, 17 + 1 / 3, 26, 4 / 3)),
    (24.3, 22, (21.4, 18.6, 3, 5.6), (12 + 1 / 3, 18 + 1 / 3, 27, 4 / 3)),
)


def squirrel_run(phase):
    """The squirrel bounding down the road at the player, a front elevation, at phase 0 to 3 of
    SQUIRREL_BOUND. Its body spreads wider the lower it is."""
    f = SQUIRREL_FUR
    g = edged(Grid())
    by, hy, (tx, ty, trx, try_), (lx, rx, py, ph) = SQUIRREL_BOUND[phase]
    low = (by - 23.4) / 1.9
    squirrel_tail(g, tx, ty, trx, try_)
    g.cel(16, by, 3.6 + low, 3.4 - 0.3 * low, f["fur"], f["shade"], f["lit"])
    g.cel(16, by + 0.7, 1.5 + 0.3 * low, 1.8 - 0.3 * low, f["belly"])
    # the paws reach up into the body, so no gap opens under it; the head stays on the sitting squirrel's
    # column and its rows 2px apart, so at road.SCALE its square eyes and glints keep one shape
    for x in (lx, rx):
        g.rect(x, min(py, by), 2, py + ph - min(py, by), f["foot"])
    squirrel_head(g, 16, hy)
    return rim(g, LIT)


def puddle(f, w=112, h=48):
    """The road's 2-lane puddle, 112x48 (64n-16 wide for n = 2); cards draw a 32x16 one. Wide puddles get a
    second lobe."""
    g = Grid(w, h)
    lobes = [(w / 2, h / 2, w / 2 - 2, h / 2 - 2)]
    if w > 40:
        lobes = [(w * 0.36, h * 0.52, w * 0.34, h / 2 - 3), (w * 0.66, h * 0.46, w * 0.32, h / 2 - 4)]
    for cx, cy, rx, ry in lobes:
        g.ell(cx, cy, rx, ry, "blue")
    for cx, cy, rx, ry in lobes:
        g.ell(cx, cy + 0.5, rx - 1, ry - 1, "sky")
    if w > 40:
        # the far bank's shade, a blue band down the top edge inside the rim, and the sky's glint in the near
        # lobe: a white streak over a cyan one
        for cx, cy, rx, ry in lobes:
            g.ell(cx, cy + 0.5, rx - 1, ry - 1, "blue")
        for cx, cy, rx, ry in lobes:
            g.ell(cx, cy + 2, rx - 1.5, ry - 2, "sky")
        g.rect(round(w * 0.16), round(h * 0.4), round(w * 0.08), 2, "white")
        g.rect(round(w * 0.14), round(h * 0.4) + 2, round(w * 0.13), 1, "cyan")
    s = 1 if f else 0
    for fx, fy, fw in ((0.28, 0.31, 0.125), (0.59, 0.56, 0.16), (0.41, 0.69, 0.06), (0.75, 0.3, 0.1)):
        if w > 40 or fx < 0.7:
            g.rect(round(fx * w) + (s if fx < 0.5 else -s), round(fy * h), max(2, round(fw * w)), 1, "cyan")
    return g


# The stink haze's puffs as (centre x, centre y, radius across), laid out on an 88x40 design that the sprite
# stretches to CLOUD_SIZE (2 lanes, 64n-16 wide, by 1.5 x 40 rows). The haze hugs the road: each puff is
# CLOUD_SQUASH as tall as it is wide, so together they make a low, wide bank with a lumpy top, its base on the
# frame's last row. A swollen puff still stops a pixel short of the frame's top and sides, so no lobe is clipped
# flat; along the bottom the frame's last row cuts them level, where the haze meets the road.
CLOUD_PUFFS = [(44, 28, 30), (22, 31, 15), (66, 31, 15), (31, 36, 15), (57, 36, 15), (32, 20, 11), (57, 19, 11),
               (44, 14, 9), (11, 35, 9), (77, 35, 9), (19, 24, 7), (70, 24, 7)]
CLOUD_SQUASH = 0.42
CLOUD_W, CLOUD_H = 88, 40
CLOUD_SIZE = (112, 60)
# Where each stink wisp starts, trailing 6 design rows down.
CLOUD_WISPS = ((22, 25), (62, 22), (72, 30), (14, 31), (42, 17))
# The haze's colours: the outer and inner rim, the fill, the seams between lobes, and the wisps.
CLOUD_INK = dict(outer="plum", inner="pink", fill="mauve", dark="purple", wisp="purple")


def skunk_cloud(step, s=1):
    """The stink haze under the skunk at depth step s (CLOUD_SIZE at 1), low and wide on the road: flat mauve
    lobes, a purple seam where one meets the next, with no dither, so it holds on the dark roads. The puffs
    swell in turn by a whole pixel; the base stays on the last row. The rim is two pixels at every size: plum
    outside, which holds 3:1 on the light roads, and pink inside it, which holds on the dslate road. The seams
    and the wisps' 1px wave are laid on the drawn grid, so they keep their pixels at every step. A puff near the
    frame's top or sides is trimmed so that, swollen, it still stops a pixel short of them. Mauve keeps it apart
    from the green hedges, and matches fx-hit-skunk."""
    w, h = (math.floor(v * s + 0.5) for v in CLOUD_SIZE)
    sx, sy = w / CLOUD_W, h / CLOUD_H
    g = Grid(w, h)
    k = CLOUD_SQUASH * sy / sx
    puffs = []
    for i, (cx, cy, r) in enumerate(CLOUD_PUFFS):
        cx, cy = cx * sx, cy * sy
        r = min(r * sx, cx - 1.6, w - cx - 1.6, (cy - 1.6) / k)
        puffs.append((cx, cy, r + (1 if (i + step) % 4 == 0 else 0)))
    # how far inside the nearest puff each pixel is, in pixels across

    def depth_of(puff, x, y):
        cx, cy, r = puff
        return r - ((x + 0.5 - cx) ** 2 + ((y + 0.5 - cy) / k) ** 2) ** 0.5

    depth = [[max(depth_of(p, x, y) for p in puffs) for x in range(w)] for y in range(h)]

    def inside(x, y):
        return 0 <= x < w and 0 <= y < h and depth[y][x] >= 0

    def beside(x, y, test):
        return any(test(x + dx, y + dy) for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)))

    outer = {(x, y) for y in range(h) for x in range(w)
             if inside(x, y) and beside(x, y, lambda a, b: not inside(a, b))}
    # each pixel belongs to the puff it is deepest inside; where two lobes meet, the later one's edge is a
    # purple seam, so the haze reads as flat lobes
    owner = [[max(range(len(puffs)), key=lambda i: depth_of(puffs[i], x, y)) for x in range(w)] for y in range(h)]
    for y in range(h):
        for x in range(w):
            if not inside(x, y):
                continue
            if (x, y) in outer:
                g.p(x, y, CLOUD_INK["outer"])
            elif beside(x, y, lambda a, b: (a, b) in outer):
                g.p(x, y, CLOUD_INK["inner"])
            elif beside(x, y, lambda a, b: inside(a, b) and owner[b][a] < owner[y][x]):
                g.p(x, y, CLOUD_INK["dark"])
            else:
                g.p(x, y, CLOUD_INK["fill"])
    for x0, y0 in CLOUD_WISPS:
        for j in range(max(1, math.floor(6 * sy + 0.5))):
            g.p(math.floor(x0 * sx) + (j + step) % 3 - 1, math.floor(y0 * sy) + j, CLOUD_INK["wisp"])
    return g


def corgi(fl=0, fr=0, bl=0, br=0, bob=0, tail=0, twitch=0):
    """The other dog trotting toward the player at its own eye level, a squat front elevation: the big fox head
    with upright ears over a broad white chest ruff, short front legs either side of it and the hind paws
    showing between them. Each leg offset is that paw's stride, positive reaching toward the player: a
    reaching paw is lifted off the road 2px, a pushing one stays planted on the last row. tail moves the
    fluffy tail, which rises off the rump behind the head and shows over the right shoulder, sideways; twitch
    moves the right ear alone (negative is up). The road outline, and a tan rim on the fur facing the light."""
    g = edged(Grid())
    b = bob

    def lift(k):
        return -2 if k > 0 else 0

    # the tail, a plume over the back behind the head
    g.cel(24.5 + tail, 16.5 + b, 2.5, 2.5, "ochre", "rust", "tan")
    g.p(24 + tail, 15 + b, "cream")
    # hind paws between the front legs, further off and a shade darker
    for x, k in ((13, bl), (17, br)):
        g.rect(x, 25 + b, 2, 4 + lift(k) - b, "rust")
        g.rect(x, 28 + lift(k), 2, 1, "lgrey")
    # shoulders and the white chest ruff
    g.cel(16, 22 + b, 8.5, 4.5, "ochre", "rust", "tan")
    g.cel(16, 22 + b, 4.5, 4, "white", "lgrey")
    # front legs: short, ochre with white socks
    for x, k in ((9, fl), (20, fr)):
        g.rect(x, 24 + b, 3, 4 + lift(k) - b, "ochre")
        g.rect(x + 2, 24 + b, 1, 4 + lift(k) - b, "rust")
        g.rect(x, 27 + lift(k), 3, 3, "white")
        g.p(x + 2, 29 + lift(k), "lgrey")
    # ears, the right one twitching
    t = twitch
    g.tri((7, 14 + b), (8.5, 4.5 + b), (14, 10 + b), "ochre")
    g.tri((25, 14 + b + t), (23.5, 4.5 + b + t), (18, 10 + b + t), "ochre")
    g.tri((9, 12 + b), (9.5, 7 + b), (12.5, 10.5 + b), "pink")
    g.tri((23, 12 + b + t), (22.5, 7 + b + t), (19.5, 10.5 + b + t), "pink")
    # head: ochre crown, white blaze, cheeks and muzzle, eyes, nose and a happy mouth
    g.cel(16, 14 + b, 7.5, 5.5, "ochre", "rust", "tan")
    g.cel(16, 17 + b, 5.5, 2.5, "white", "lgrey")
    g.rect(15, 9 + b, 2, 7, "white")
    g.rect(11, 13 + b, 2, 2, "ink")
    g.rect(19, 13 + b, 2, 2, "ink")
    g.p(11, 13 + b, "white")
    g.p(19, 13 + b, "white")
    g.rect(15, 16 + b, 2, 1, "ink")
    g.p(14, 17 + b, "dbrown")
    g.p(17, 17 + b, "dbrown")
    g.rect(15, 18 + b, 2, 1, "pink")
    # collar
    g.rect(11, 19 + b, 10, 1, "amber")
    g.p(16, 20 + b, "yellow")
    return rim(g, LIT)


# The other dog's trot, as dogs.WALK has it: diagonal pairs swap on beats 0 and 2 and the body bobs up
# on the passing beats; 4 frames at 100ms.
CORGI_WALK = [dict(fl=1, fr=-1, bl=-1, br=1), dict(bob=-1), dict(fl=-1, fr=1, bl=1, br=-1), dict(bob=-1)]
# Standing while its walker chats: the dogs' idle, the tail at -1, 0, +1, 0, the body 1px higher over the middle
# two beats and the right ear 1px higher on the last frame.
CORGI_IDLE = [dict(tail=-1), dict(bob=-1), dict(tail=1, bob=-1), dict(twitch=-1)]


def person(top, legs="navy", shoes="ink", lf=0, rf=0, bob=0, arms=0):
    """A chibi person facing the player: legs and shoes, then the caller's top(g, bob), or top(g, bob, arms)
    for a walk frame whose free arms swing."""
    g = Grid(32, 48)
    for x, f in ((11, lf), (17, rf)):
        g.rect(x, 33 + bob, 4, 10 + f - bob, legs)
        g.rect(x + 3, 33 + bob, 1, 10 + f - bob, DARKER[K[legs]])
        g.rect(x, 43 + f, 4, 2, shoes)
    if arms:
        top(g, bob, arms)
    else:
        top(g, bob)
    return g


def swung(arms, side):
    """How many rows a passer-by's free arm on screen side side (-1 left, 1 right) is shortened in a walk
    frame: an arm swung back, against the lifted foot on its side, shows its hand that much higher."""
    return abs(arms) if arms * side < 0 else 0


def dressed(top, **q):
    """person(top, **q) with the road outline and the lit rim."""
    return rim(edged(person(top, **q)), LIT)


def stripes(g, x, y0, y1, w, b, light="white"):
    """Layout rows y0 to y1 - 1 of the thief's stripes, from x, w wide: light where (row - b) % 4 < 2, else
    ink. The sleeves take lgrey for light, so the arms stay apart from the white-striped chest. Drawn in
    pixels at the grid's scale, every stripe pair 4 x scale rows tall (the light the shorter half), so drawn
    bigger the stripes stay even instead of breaking up into 1px rows."""
    s = scale_of(g)
    px = raster(g)

    def e(v):
        return math.floor(v * s + 0.5)

    period = max(2, e(4))
    anchor = e(20 + b)
    for r in range(e(y0), e(y1)):
        px.rect(e(x), r, max(1, e(x + w) - e(x)), 1, light if (r - anchor) % period < period // 2 else "ink")


# The walker's tip pouch, which the thief snatches: a green cloth drawstring pouch lit lime on its left and
# shaded forest on its right, its neck gathered under a cream drawstring tied off at the top, a yellow coin
# with an amber centre on its face. The road thief carries BIG_POUCH or TIP_POUCH (POUCHES, widest first),
# pouch_px picking by the grid's scale, so it stays a clean bitmap at every depth step and never shrinks
# below TIP_POUCH, which still reads at @50. The cards hold TIP_POUCH close and FAR_POUCH in a distant hand.
BIG_POUCH = ["...c.c...", "....c....", "..lgcgf..", "...lgf...", "..lgggf..", ".lggyggf.", "lggyayggf",
             "lgggyggff", "lggggggff", "lggggggff", ".ggggfff.", "..fffff.."]
TIP_POUCH = ["..c.c..", "...c...", "..lgf..", ".lgggf.", "lggyggf", "lgyaygf", "lggyggf", ".gggff.", "..fff.."]
FAR_POUCH = [".c.c.", "..c..", ".lgf.", "lgygf", "lgggf", ".fff."]
POUCHES = (BIG_POUCH, TIP_POUCH)
POUCH_INK = {"c": "cream", "l": "lime", "g": "green", "f": "forest", "y": "yellow", "a": "amber"}
# The pouch's width in design pixels on the thief: BIG_POUCH from the full size down to @88, TIP_POUCH below.
POUCH_WIDTH = 6.5


def pouch_px(g, cx, fist):
    """The tip pouch from POUCHES hanging from a fist: centred on design column cx, its drawstring's top on the
    last pixel row above design row fist, where the fist ends; the widest no wider than POUCH_WIDTH design
    pixels at the grid's scale (the smallest at least)."""
    s, px = scale_of(g), raster(g)
    sy = getattr(g, "sy", s)
    bitmap = next((b for b in POUCHES if len(b[0]) <= POUCH_WIDTH * s + 0.5), POUCHES[-1])
    x0 = math.floor((cx + 0.5) * s) - len(bitmap[0]) // 2
    y0 = math.floor(fist * sy + 0.5) - 1
    for j, row in enumerate(bitmap):
        for i, ch in enumerate(row):
            if ch in POUCH_INK:
                px.p(x0 + i, y0 + j, POUCH_INK[ch])


def thief_top(g, b, arms=0, pouch=True):
    """The thief coming down the road: striped shirt, beanie and mask, both arms swinging, the walker's tip
    pouch dangling by its drawstring from his fist (screen right). pouch=False leaves it off, for the cards,
    which draw the pouch themselves."""
    stripes(g, 9, 21 + b, 34 + b, 14, b)
    for x, n in ((5, swung(arms, -1)), (23, swung(arms, 1))):
        stripes(g, x, 22 + b, 31 + b - n, 4, b, "lgrey")
        g.rect(x, 31 + b - n, 4, 3, "skin2")
        if x > 16 and pouch:
            pouch_px(g, 25, 34 + b - n)
    face_disc(g, 16, 12.5 + b, 8, 8, "skin2", "brown")
    g.cel(16, 7.5 + b, 8.5, 5, "navy", "ink", "dslate")
    # the beanie's turned-up band meets the mask, so no sliver of skin shows at the temples
    g.rect(8, 9 + b, 17, 3, "dslate")
    g.rect(8, 12 + b, 17, 3, "ink")
    g.rect(11, 13 + b, 2, 1, "white")
    g.rect(19, 13 + b, 2, 1, "white")
    g.rect(14, 17 + b, 4, 1, "dbrown")
    g.p(18, 16 + b, "dbrown")


def thief_fleeing(stride, pouch=True):
    """The thief running off up the road, seen from behind: stride is -1 or 1, the side whose knee is up.
    The arms pump against the legs from the shoulders (the far arm bent forward, its forearm hidden, the near
    one swung back and low), and the tip pouch swings from his fist on screen right: hanging low from the
    swung-back arm, then jerked up beside his ribs by the bent one (pouch=False leaves it off, as thief_top).
    The road outline and the lit rim."""
    g = edged(Grid(32, 48))
    s = stride
    b = -1
    # legs: the lifted one is short, its shoe turned up to show the sole; the pushing one reaches the ground
    for x, lift in ((11, s < 0), (17, s > 0)):
        top = 33 + b
        if lift:
            g.rect(x, top, 4, 5, "navy")
            g.rect(x + 3, top, 1, 5, "ink")
            g.rect(x, top + 5, 4, 2, "ink")
            g.rect(x, top + 7, 4, 1, "dslate")
        else:
            g.rect(x, top, 4, 10 - b, "navy")
            g.rect(x + 3, top, 1, 10 - b, "ink")
            g.rect(x, 43, 4, 2, "ink")
    # arms: the one on the lifted leg's side swings back and low, the other is bent forward and up
    # both hang from the shoulder at row 22, as his walking arms do
    for x, back in ((5, s < 0), (23, s > 0)):
        if back:
            stripes(g, x, 22 + b, 32 + b, 4, b, "lgrey")
            g.rect(x, 32 + b, 4, 3, "skin2")
        else:
            stripes(g, x, 22 + b, 26 + b, 4, b, "lgrey")
            g.rect(x + (1 if x < 16 else -1), 26 + b, 3, 2, "skin2")
    stripes(g, 9, 21 + b, 34 + b, 14, b)
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    if pouch:
        # swinging out from the hand held back and low, or tucked up at the hip under the bent arm's fist,
        # which shows in full over the shirt's edge
        if s > 0:
            pouch_px(g, 25.5, 35 + b)
        else:
            g.rect(22, 26 + b, 3, 2, "skin2")
            pouch_px(g, 24.5, 28 + b)
    # the back of the head: the beanie, the ears and the mask's band tied all the way round
    g.rect(14, 19 + b, 4, 3, "skin2")
    g.cel(16, 12.5 + b, 8, 8, "skin2", "brown", "skin1")
    g.rect(7, 13 + b, 2, 3, "skin2")
    g.rect(23, 13 + b, 2, 3, "brown")
    g.cel(16, 7.5 + b, 8.5, 5, "navy", "ink", "dslate")
    g.rect(8, 9 + b, 17, 2, "dslate")
    g.rect(8, 12 + b, 17, 2, "ink")
    return rim(g, LIT)


# The neighbour's hearts, widest first: red, shaded dred down the right, lit pink and white at the top of the
# left lobe. heart_px picks the widest that fits the grid's scale, so the heart stays a clean bitmap at every
# depth step instead of a blur of scaled curves.
HEARTS = (
    (".111...111.", "1wh11.11111", "1h111111111", "11111111d1d", ".1111111dd.", "..11111dd..", "...111dd...",
     "....1dd....", ".....d....."),
    (".111.111.", "1wh111111", "1h111111d", "1111111dd", ".11111dd.", "..111dd..", "...1dd...", "....d...."),
    (".11.11.", "1wh1111", "1h1111d", ".1111d.", "..11d..", "...d..."),
    (".1.1.", "1h11d", ".11d.", "..d.."),
)
HEART_INK = {"1": "red", "d": "dred", "h": "pink", "w": "white"}


def heart_px(g, cx, top, width, smaller=0):
    """A heart from HEARTS centred on design column cx with its top on design row top: the widest no wider
    than width design pixels at the grid's scale (the smallest at least), then smaller steps down."""
    s, px = getattr(g, "s", 1), getattr(g, "g", g)
    sy = getattr(g, "sy", s)
    fit = [k for k, h in enumerate(HEARTS) if len(h[0]) <= width * s + 0.5] or [len(HEARTS) - 1]
    bitmap = HEARTS[min(fit[0] + smaller, len(HEARTS) - 1)]
    x0 = math.floor(cx * s + 0.5) - len(bitmap[0]) // 2
    y0 = math.floor(top * sy + 0.5)
    for j, row in enumerate(bitmap):
        for i, ch in enumerate(row):
            if ch in HEART_INK:
                px.p(x0 + i, y0 + j, HEART_INK[ch])


# The neighbour's crouch to pet a dog: her body this many design rows lower, her legs that much shorter.
NEIGHBOUR_CROUCH = 3


def neighbour_top(pet, beat):
    """The friendly neighbour, a grey-haired dog lover in a mauve cardigan open over a cream top with a big red
    heart on it, a red heart floating at her top right. From 1x her smile sits a row lower than face_front's,
    under a small nose, clear of her eyes. pet crouches her (with person's bob=NEIGHBOUR_CROUCH)
    and reaches her left arm (screen right) out and down, the open hand patting: beat 1 lowers it a row and
    shrinks the floating heart a step, so it beats. Standing, beat 1 lifts the floating heart a row, so it
    bobs against her breath or her step."""
    def top(g, b, arms=0):
        # the cardigan, open down the front over the cream top, and the big heart on it
        g.rect(9, 21 + b, 14, 13, "mauve")
        g.rect(20, 21 + b, 3, 13, "purple")
        g.rect(12, 21 + b, 8, 13, "cream")
        g.rect(19, 21 + b, 1, 13, "tan")
        g.rect(12, 21 + b, 1, 13, "pink")
        heart_px(g, 16, 24.5 + b, 7)
        # her right arm (screen left) hanging, the hand at her side
        n = swung(arms, -1)
        g.rect(5, 22 + b, 4, 9 - n, "mauve")
        g.rect(5, 31 + b - n, 4, 3, "skin1")
        if pet:
            # the left arm (screen right) reaching out and down to a dog at her side, the hand open, palm down
            d = beat
            for k in range(6):
                g.rect(22 + k, 22 + b + k * 1.4, 4, 4, "mauve")
            g.rect(25, 26 + b, 1, 3, "purple")
            g.rect(26, 30 + b + d, 4, 3, "skin1")
            g.rect(26, 32 + b + d, 4, 1, "skin2")
            for x in (26, 28):
                g.rect(x, 33 + b + d, 1, 1, "skin1")
        else:
            n = swung(arms, 1)
            g.rect(23, 22 + b, 4, 9 - n, "mauve")
            g.rect(23, 31 + b - n, 4, 3, "skin1")
        face_disc(g, 16, 12.5 + b, 8, 8, "skin1", "skin2")
        g.cel(16, 7.5 + b, 9, 5, "lgrey", "grey", "white")
        g.cel(16, 3 + b, 3.5, 2.5, "lgrey", "grey", "white")
        g.rect(8, 9 + b, 2, 6, "lgrey")
        g.rect(22, 9 + b, 2, 6, "lgrey")
        # from 1x the smile drops a row under a small nose; smaller, the face has no rows for either
        roomy = scale_of(g) >= 1
        face_front(g, 16, 13 + b, mouth=5 if roomy else 4)
        if roomy:
            nose(g, 16, 13 + b)
        g.rect(10, 12 + b, 5, 1, "dslate")
        g.rect(18, 12 + b, 5, 1, "dslate")
        g.p(10, 15 + b, "pink")
        g.p(22, 15 + b, "pink")
        # the floating heart, clear of her hair at the top right, on the frame's rows whatever her pose
        heart_px(g, 27.5, 1 if pet else 2 - beat, 7.5, smaller=beat if pet else 0)
    return top


# The $ on the wallet's bill, in drawn pixels so it stays exact at any scale: 3x7 down to the 1.1x depth step,
# a 1px stroke below that, where the bill is too short for it.
WALLET_DOLLAR = [".1.", "111", "1..", "111", "..1", "111", ".1."]


def wallet(glint):
    """The lost wallet, with the road outline: one green bill lit along its top edge stands up out of a
    brown leather wallet, a white $ on it; the wallet's flap tab on the right has an amber snap. The
    leather takes a light rim so it holds on the dslate road: tan along its top edge, brown down the
    shaded sides. glint twinkles a white sparkle at its top right."""
    g = edged(Grid(16, 16))
    g.rect(3, 1.5, 9, 7.5, "green")
    g.rect(3, 1.5, 9, 1, "lgrey")
    g.rect(1.5, 7, 13, 7.5, "brown")
    g.rect(1.5, 13.5, 13, 1, "dbrown")
    g.rect(13.5, 7, 1, 7.5, "dbrown")
    g.rect(1.5, 7, 13, 1, "tan")
    g.rect(9, 9, 5.5, 3, "dbrown")
    g.rect(12, 10, 2, 1, "amber")
    s = scale_of(g)
    px = raster(g)
    rows = WALLET_DOLLAR if s >= 1.1 else ["1", "1", "1"]
    bx, by = math.floor(7.5 * s) - len(rows[0]) // 2, math.floor(2.4 * s)
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c == "1":
                px.p(bx + x, by + y, "white")
    if glint:
        # a 3x3 cross centred on layout pixel (14, 1), drawn in pixels so it stays a cross at any scale
        cx, cy = math.floor(14.5 * s), math.floor(1.5 * s)
        px.rect(cx - 1, cy, 3, 1, "white")
        px.rect(cx, cy - 1, 1, 3, "white")
    return rim(g, WALLET_RIM)


# The wallet's rim: road.LIT, with a dimmer brown down the leather's shaded sides.
WALLET_RIM = dict(LIT, dbrown=("skin2", "brown"), plum=("skin2", "brown"))


def bark(big):
    """The bark pop: a white bubble with red sound arcs, one arc and then, popped bigger, a second outside it,
    outlined in plum on every side so it holds on the light roads."""
    g = edged(Grid(16, 16), "plum")
    r = 6 if big else 5
    g.ell(8.5, 7, r, r - 0.5, "white", "lgrey")
    g.tri((4, 10), (2, 15), (7, 11), "white")
    for x, top, h in ((7, 5, 3),) + (((10, 4, 5),) if big else ()):
        g.p(x - 1, top, "red")
        g.rect(x, top + 1, 1, h, "red")
        g.p(x - 1, top + h + 1, "red")
    return g


def dog_owner_top(g, b, arms=0):
    """The other dog's walker: yellow raincoat, brown bob, leash hand held out low; the free arm swings."""
    g.rect(9, 21 + b, 14, 13, "amber")
    g.rect(20, 21 + b, 3, 13, "orange")
    g.rect(9, 21 + b, 1, 12, "yellow")
    g.rect(15, 22 + b, 1, 11, "orange")
    g.p(13, 25 + b, "orange")
    g.p(13, 29 + b, "orange")
    n = swung(arms, -1)
    g.rect(5, 22 + b, 4, 9 - n, "amber")
    g.rect(5, 31 + b - n, 4, 3, "skin1")
    # the leash arm angles out from the shoulder, so the hand held out low stays under its sleeve
    back_arm(g, 23, 4, 22 + b, ((8, "amber", None), (3, "skin1", None)), out=1)
    face_disc(g, 16, 12.5 + b, 8, 8, "skin1", "skin2")
    g.cel(16, 8.5 + b, 9, 5, "dbrown", "plum", "brown")
    g.rect(7, 9 + b, 3, 9, "dbrown")
    g.rect(22, 9 + b, 3, 9, "dbrown")
    g.rect(10, 9 + b, 12, 2, "dbrown")
    face_front(g, 16, 13 + b)
    g.p(10, 16 + b, "pink")
    g.p(22, 16 + b, "pink")


# ---------- forced stops ----------


# The ice cream truck's drive: 4 frames of ice_cream_truck's roll, and their duration in ms.
TRUCK_DRIVE = range(4), 100


def ice_cream_truck(f=0, roll=None):
    """The ice cream truck from straight behind, a lane wide like obstacles.delivery_truck, laid out on 56x50
    and drawn at TRUCK_SCALE to 56x60: a white box van lit along its top and left, its cone sign on the roof.
    The rear doors split down the middle, each with a window; a pink drip stripe runs across them; tall red
    tail lights sit at the outer corners, amber blinkers under them; then the plate, the bumper and both rear
    wheels. A mirror pokes out on the left and the serving hatch's striped awning on the right. f swaps the
    lit blinker and the white music note. roll (0 to 3) is a drive frame: tread lines climb the tires, the
    body dips 1px onto them on frames 1 and 2, the cone sign rocks on its post the other way, and a note floats
    up beside it. The road outline and the lit rim."""
    import obstacles  # obstacles imports this module

    g = edged(Grid(56, 50))
    px = raster(g)
    uy = obstacles.unit(g)[1]
    for x in (5, 42):
        g.rect(x, 39, 9, 10, "ink")
        g.rect(x, 39, 2, 9, "dslate")
        if roll is not None:
            obstacles.treads(g, x + 2, 42, 7, 7, roll, uy)
    wheels = [row[:] for row in px.px]
    px.px = [[None] * px.w for _ in range(px.h)]
    dip = 1 if roll in (1, 2) else 0
    rock = -dip if roll is not None else 0
    # the cone sign on the roof: a tall waffle cone, lit tan and shaded ochre, under a pink scoop with a cherry
    g.tri((23.5, 5.5 + rock), (32.5, 5.5 + rock), (28, 12.5 + rock), "tan")
    g.tri((28, 5.5 + rock), (32.5, 5.5 + rock), (28, 12.5 + rock), "ochre")
    g.ell(28, 4 + rock, 4.6, 2.6, "pink", "mauve", "white")
    g.rect(28, 0.5 + rock, 1.5, 1.5, "red")
    # the music note: left of the sign at rest (f 0) or right (f 1); driving, it floats up a row a frame
    nx, ny = (12, 4) if f == 0 else (41, 3)
    if roll is not None:
        nx, ny = (12, 5 - roll) if roll < 2 else (41, 7 - roll)
    g.rect(nx + 2, ny, 1, 6, "white")
    g.rect(nx + 2, ny, 3, 1, "white")
    g.rect(nx, ny + 5, 3, 2, "white")
    # the roof edge, then the box: lit along the top and the left, shaded down the right
    g.rect(5, 12, 46, 2, "lgrey")
    g.rect(5, 12, 46, 1, "white")
    g.rect(3, 14, 50, 25, "white")
    g.rect(49, 14, 4, 25, "lgrey")
    # a mirror on the left, the serving hatch's awning on the right, striped pink and white
    g.rect(0, 18, 3, 5, "dslate")
    g.rect(0, 18, 3, 1, "slate")
    for k in range(4):
        g.rect(53, 15 + k * 2, 2, 2, "pink" if k % 2 == 0 else "white")
    # the rear doors: a seam down the middle, a window in each, handles by the seam
    g.rect(27, 15, 2, 23, "lgrey")
    for x in (9, 31):
        g.rect(x, 16, 16, 9, "navy")
        g.rect(x, 16, 16, 1, "slate")
        g.tri((x + 3, 24), (x + 8, 17), (x + 11, 17), "slate")
    g.rect(24, 27, 2, 3, "grey")
    g.rect(30, 27, 2, 3, "grey")
    # the drip stripe: a pink band with drips hanging from it
    g.rect(3, 30, 50, 3, "pink")
    g.rect(3, 32, 50, 1, "mauve")
    for i, x in enumerate(range(6, 50, 8)):
        g.rect(x, 33, 2, 1 + i % 2, "pink")
    # tail lights up the outer corners, blinkers under them, the plate between
    for x in (4, 48):
        g.rect(x, 15, 4, 14, "red")
        g.rect(x, 15, 4, 1, "pink")
        g.rect(x + 3, 16, 1, 13, "dred")
    g.rect(4, 34, 4, 3, "yellow" if f else "amber")
    g.rect(48, 34, 4, 3, "amber" if f else "yellow")
    g.rect(22, 34, 12, 4, "cream")
    g.rect(24, 35, 8, 1, "tan")
    # the bumper step across the full width
    g.rect(1, 38, 54, 3, "dslate")
    g.rect(1, 38, 54, 1, "slate")
    g.rect(1, 38, 1, 3, "grey")
    body = px.px
    px.px = [[(body[y - dip][x] if y >= dip else None) or wheels[y][x] for x in range(px.w)] for y in range(px.h)]
    rim(px, LIT)
    return g


def stair(g, x0, y0, x1, y1, c):
    """A strap running down from layout (x0, y0) to (x1, y1), exclusive: one pixel row per step, each step an
    equal share of the width. Drawn in pixels at the grid's scale, so its steps stay joined at SCALE."""
    s = scale_of(g)
    px = raster(g)

    def e(v):
        return math.floor(v * s + 0.5)

    left, top, w, n = e(x0), e(y0), e(x1) - e(x0), e(y1) - e(y0)
    for i in range(n):
        px.rect(left + i * w // n, top + i, (i + 1) * w // n - i * w // n, 1, c)


def mail_top(g, b, arms=0):
    """The mail carrier: a sky-blue shirt and cap, a navy brim, dark skin and a mailbag on a strap; the free
    arm swings, the one by the bag stays."""
    g.rect(9, 21 + b, 14, 12, "sky")
    g.rect(20, 21 + b, 3, 12, "blue")
    g.rect(15, 21 + b, 2, 12, "cyan")
    n = swung(arms, -1)
    g.rect(5, 22 + b, 4, 9 - n, "sky")
    g.rect(8, 22 + b, 1, 9 - n, "blue")
    g.rect(5, 31 + b - n, 4, 3, "dbrown")
    g.rect(23, 22 + b, 4, 9, "sky")
    g.rect(26, 22 + b, 1, 9, "blue")
    g.rect(23, 31 + b, 4, 3, "dbrown")
    g.rect(9, 33 + b, 14, 3, "navy")
    # mailbag on a strap
    g.cel(24, 30 + b, 5, 4.5, "brown", "dbrown", "tan")
    g.rect(22, 27 + b, 4, 3, "white")
    stair(g, 10, 22 + b, 20, 27 + b, "dbrown")
    face_disc(g, 16, 12.5 + b, 8, 8, "dbrown", "plum")
    g.cel(16, 7 + b, 8.5, 3.5, "sky", "blue", "cyan")
    g.rect(8, 9 + b, 17, 2, "navy")
    g.rect(15, 5 + b, 2, 2, "amber")
    face_front(g, 16, 13 + b, lips="ink")
    g.p(11, 13 + b, "white")
    g.p(19, 13 + b, "white")


def mail_carrier(**q):
    """The mail carrier facing the player, with a light rim on the dark skin, brim and trousers so they hold
    on the dslate road, and the road outline for the light roads."""
    g = edged(person(mail_top, **q))
    return rim(g, dict(dbrown=("skin2", "brown"), plum=("skin2", "brown"), navy=("grey", "slate"),
                       ink=("grey", "slate"), sky=("cyan", None), blue=("sky", None)))


# ---------- road movers going the pack's way (back view) ----------

# Pushing the stroller: the road people's stride, a 1px bob as he passes over each foot; 4 frames at 160ms,
# the walkers' pace.
STROLLER_WALK = PERSON_WALK
STROLLER_WALK_MS = 160


def stroller(lf=0, rf=0, bob=0, arms=0):
    """A dad pushing a stroller up the road, seen from behind as the pack sees it: short ginger hair, a green
    puffer jacket quilted across, jeans and brown shoes, a takeaway coffee in his left hand, his right hand on
    the handlebar. The stroller rolls beside him on his right, its back to the player: a sky-blue hood ribbed
    where it folds over a navy seat back, the handlebar across the top, a basket under the seat, the rear legs
    splaying out to two round rear wheels and the two front wheels inside them, further up the road. It rolls
    steadily while he bobs. The road outline and the lit rim, the puffer's teal shade lit green."""
    g = edged(Grid(32, 48))
    b = bob
    # the front wheels, further up the road, inside the rear ones
    for cx in (21.5, 27.5):
        g.ell(cx, 37.5, 1.6, 2.6, "ink")
        g.p(cx, 37.5, "grey")
    # the rear legs splay out from the seat to the rear wheels
    for i in range(9):
        g.p(20 - i // 5, 31 + i, "lgrey")
        g.p(28 + i // 5, 31 + i, "lgrey")
    # the rear wheels: round tires lit along the top, a hub in the middle
    for cx in (18.5, 29.5):
        g.ell(cx, 42.5, 1.7, 3.2, "ink")
        g.p(cx, 40, "slate")
        g.p(cx, 42, "grey")
    # the basket slung under the seat
    g.rect(20, 32, 9, 3, "ink")
    for x in range(21, 29, 2):
        g.p(x, 33, "slate")
    # the seat back in navy, the hood a sky-blue dome over it, folded in ribs, the handlebar across the top
    g.rect(19, 26, 11, 7, "navy")
    g.rect(19, 26, 1, 7, "dslate")
    g.cel(24.5, 20.5, 6.5, 6.5, "sky", "blue", "cyan", power=2.3)
    g.rect(17, 21, 15, 7, None)
    g.rect(18, 21, 13, 5, "sky")
    g.rect(28, 21, 3, 5, "blue")
    for y in (17, 20, 23):
        g.rect(19, y, 11, 1, "blue")
    g.rect(18, 25, 13, 1, "cyan")
    g.rect(16, 26, 16, 1, "ink")
    g.rect(16, 27, 1, 1, "ink")
    g.rect(31, 27, 1, 1, "ink")
    # the dad, left of the stroller: legs walking and shoes
    for x, f in ((5, lf), (11, rf)):
        g.rect(x, 33 + b, 4, 10 + f - b, "blue")
        g.rect(x + 3, 33 + b, 1, 10 + f - b, "navy")
        g.rect(x, 43 + f, 4, 2, "brown")
        g.rect(x, 44 + f, 4, 1, "dbrown")
    # the left arm holds the coffee, a column in from the frame's edge so the outline closes round it; the
    # right reaches out to the handlebar
    g.rect(1, 22 + b, 3, 9, "forest")
    g.rect(1, 29 + b, 3, 1, "white")
    g.rect(1, 30 + b, 3, 5, "cream")
    g.rect(3, 30 + b, 1, 5, "tan")
    g.rect(1, 32 + b, 3, 1, "brown")
    g.rect(16, 22 + b, 3, 3, "forest")
    g.rect(16, 24 + b, 3, 1, "teal")
    g.rect(16, 25, 3, 2, "skin1")
    # the puffer, lit down its left side and quilted across
    g.rect(4, 21 + b, 13, 13, "forest")
    g.rect(14, 21 + b, 3, 13, "teal")
    g.rect(4, 21 + b, 1, 12, "dgreen")
    for y in (25, 29):
        g.rect(5, y + b, 11, 1, "teal")
    g.p(4, 21 + b, None)
    g.p(16, 21 + b, None)
    g.ell(10.5, 22 + b, 5.5, 2, "forest", "teal")
    # head: the back of short ginger hair, ears and the nape
    g.rect(9, 19 + b, 4, 3, "skin1")
    g.rect(3, 14 + b, 2, 3, "skin1")
    g.rect(16, 14 + b, 2, 3, "skin2")
    g.cel(10.5, 13.5 + b, 6.5, 6.5, "rust", "dbrown", "ochre")
    g.rect(7, 19 + b, 7, 1, "rust")
    return rim(g, {**LIT, "teal": ("dgreen", None)})


# Running at the player: the left knee driven up as the right foot plants and the body rises 1px, the left foot
# passing down under the body, then the same on the right; the ponytail swings out from behind the head away
# from the raised knee. 4 frames at 100ms.
JOGGER_RUN = [dict(knee="left", bob=-1, tail="right"), dict(passing="left"), dict(knee="right", bob=-1, tail="left"),
              dict(passing="right")]
JOGGER_RUN_MS = 100


def jogger(knee=None, passing=None, bob=0, tail=None):
    """A jogger running down the road at the pack, facing the player: a black ponytail tied high (it swings out
    from behind the head to the side tail, "left" or "right", or hangs hidden behind it), a black fringe, an
    orange racerback singlet with a white race bib pinned on its front, bare arms pumping, navy capri tights and
    cyan shoes. knee is the side ("left" or "right", screen left and right) whose knee is driven up, the foot
    lifted and the knee lit, while the other foot plants; passing is the side whose foot is passing down under
    the body, just off the ground. The arm on the raised knee's side swings back, half hidden; the other is bent
    at the elbow, the fist in front of the hip. The road outline and the lit rim."""
    g = edged(Grid(32, 48))
    b = bob
    # the ponytail behind the head, out to one side
    if tail:
        g.cel(16 + (7 if tail == "right" else -7), 17 + b, 2.2, 4, "navy", "ink", "dslate")
    # legs: the raised knee comes at us, lit, its foot lifted; the passing foot just off the ground
    for x, side in ((11, "left"), (17, "right")):
        f = -4 if knee == side else -1 if passing == side else 0
        g.rect(x, 31 + b, 4, 10 + f - b, "navy")
        g.rect(x + 3, 31 + b, 1, 10 + f - b, "ink")
        if knee == side:
            g.rect(x, 33 + b, 4, 2, "dslate")
        g.rect(x + 1, 41 + f, 2, 2, "skin1")
        g.rect(x, 43 + f, 4, 2, "cyan")
        g.rect(x, 44 + f, 4, 1, "white")
    # arms: swung back and down on the raised knee's side; on the other the upper arm hangs to the elbow
    for x, side in ((5, "left"), (24, "right")):
        n = 8 if knee == side else 6
        g.rect(x, 22 + b, 3, n, "skin1")
        g.rect(x + 2, 22 + b, 1, n, "skin2")
    # the racerback singlet, bare shoulders either side, the bib pinned on its front, the tights' waistband
    g.rect(9, 21 + b, 14, 11, "orange")
    g.rect(20, 21 + b, 3, 11, "rust")
    g.rect(9, 23 + b, 1, 8, "amber")
    g.rect(9, 21 + b, 3, 2, "skin1")
    g.rect(20, 21 + b, 3, 2, "skin2")
    g.rect(12, 24 + b, 8, 6, "white")
    g.rect(18, 24 + b, 2, 6, "lgrey")
    g.rect(12, 24 + b, 8, 1, "sky")
    bib(g, 16, 27.5 + b)
    g.rect(9, 31 + b, 14, 1, "ink")
    # the forearm bent at the elbow toward us, the fist in front of the hip just inside the elbow
    for x, side in ((5, "left"), (24, "right")):
        if knee != side:
            fx = x + (2 if side == "left" else -2)
            g.rect(fx, 26 + b, 3, 3, "skin1")
            g.rect(fx, 28 + b, 3, 1, "skin2")
    # the head: the neck, the face, black hair over the crown with a fringe and down the sides
    g.rect(14, 19 + b, 4, 3, "skin1")
    face_disc(g, 16, 12.5 + b, 8, 8, "skin1", "skin2")
    g.cel(16, 8.5 + b, 9, 5, "navy", "ink", "dslate")
    g.rect(7, 9 + b, 2, 7, "navy")
    g.rect(23, 9 + b, 2, 7, "ink")
    g.rect(9, 9 + b, 14, 2, "navy")
    g.rect(10, 9 + b, 4, 1, "dslate")
    face_front(g, 16, 13 + b)
    return rim(g, LIT)


# The bib's number, 3x5 digits drawn in the grid's own pixels, as WALLET_DOLLAR is.
BIB = ("111", "001", "010", "100", "100"), ("111", "100", "111", "001", "111")


def bib(g, cx, cy):
    """The race number "75" centred on design point (cx, cy), 1px apart, in ink; under 1.5x the bib is too
    small for digits and takes a 1px ink bar instead."""
    s, px = scale_of(g), raster(g)
    sy = getattr(g, "sy", s)
    if s < 1.5:
        x0, y0 = math.floor((cx - 2) * s + 0.5), math.floor(cy * sy)
        px.rect(x0, y0, max(1, math.floor(4 * s + 0.5)), 1, "ink")
        return
    x0, y0 = math.floor(cx * s + 0.5) - 3, math.floor(cy * sy + 0.5) - 2
    for i, digit in enumerate(BIB):
        for j, row in enumerate(digit):
            for k, ch in enumerate(row):
                if ch == "1":
                    px.p(x0 + i * 4 + k, y0 + j, "ink")


# Pedalling at the player: each foot's lift above the bottom of the pedal's turn (the pedals go round), the
# kid's sway over the bars and the streamers' flutter, the column each 2-row piece of a streamer swings out by
# from its grip. 4 frames at 100ms.
KID_BIKE_RIDE = [dict(lf=-5, rf=0, sway=-1, flutter=(0, 1, 1)), dict(lf=-3, rf=-2, flutter=(0, 0, 1)),
                 dict(lf=0, rf=-5, sway=1, flutter=(0, 1, 2)), dict(lf=-2, rf=-3, flutter=(0, 1, 0))]
KID_BIKE_RIDE_MS = 100


def kid_on_bike(lf=0, rf=0, sway=0, flutter=(0, 0, 0)):
    """A kid riding a little bike down the road at the pack, facing the player as the cyclist does: a yellow
    tee, sky shorts, red shoes and ochre hair under a red helmet with a white stripe and a dark visor. The
    bike is mauve, its front tire edge-on under a mudguard with a white reflector, the training wheels
    showing either side behind, streamers trailing from the grips. Shorter than an adult rider: the helmet's
    top is 4 design rows (6px) lower than the cyclist's. The road outline and the lit rim."""
    g = edged(Grid(32, 48))
    w = sway
    # the training wheels behind, on their strut, then the front tire, fork, mudguard and reflector
    for x in (9.5, 22.5):
        g.blob(x, 42, 1.5, 2.5, "ink")
    g.rect(10, 40, 13, 1, "grey")
    g.blob(16, 40.5, 2, 5, "ink")
    g.rect(15.5, 34, 1, 6, "lgrey")
    g.rect(14, 33, 4, 2, "mauve")
    g.rect(14, 33, 4, 1, "pink")
    g.rect(15, 35, 2, 1, "white")
    # legs either side of the wheel, pedalling: shorts, bare knees and shins, shoes on the pedals
    for x, f in ((10, lf), (19, rf)):
        g.rect(x, 29, 3, 3, "sky")
        g.rect(x, 32, 3, 10 + f, "skin1")
        g.rect(x + 2, 32, 1, 10 + f, "skin2")
        g.rect(x - (1 if x < 16 else 0), 42 + f, 4, 2, "red")
        g.rect(x - (1 if x < 16 else 0), 43 + f, 4, 1, "dred")
    # the tee, its sleeves and the arms down to the grips
    g.rect(11 + w, 20, 10, 10, "yellow")
    g.rect(18 + w, 20, 3, 10, "amber")
    g.rect(11 + w, 20, 1, 9, "white")
    g.p(11 + w, 20, None)
    g.p(20 + w, 20, None)
    for x in (8, 21):
        g.rect(x + w, 21, 3, 3, "yellow")
        g.rect(x + w, 24, 3, 1, "skin1")
    # the handlebar across in front, the streamers trailing from the grips, the hands on the grips
    g.rect(6, 26, 20, 1, "grey")
    for x, c in ((5, "pink"), (6, "cyan"), (7, "yellow"), (24, "yellow"), (25, "cyan"), (26, "pink")):
        side = -1 if x < 16 else 1
        for k, dx in enumerate(flutter):
            g.rect(x + side * dx, 28 + 2 * k, 1, 2, c)
    g.rect(5, 25, 3, 3, "ink")
    g.rect(24, 25, 3, 3, "ink")
    g.rect(6, 25, 3, 2, "skin1")
    g.rect(23, 25, 3, 2, "skin1")
    # head: the face under the helmet, ochre hair at the sides, then the helmet, its stripe and visor
    g.rect(14 + w, 19, 4, 2, "skin1")
    face_disc(g, 16 + w, 15.5, 6.5, 5.5, "skin1", "skin2")
    g.rect(9 + w, 13, 2, 5, "ochre")
    g.rect(21 + w, 13, 2, 5, "ochre")
    g.cel(16 + w, 11.5, 7, 5, "red", "dred", "pink", power=2.2)
    g.rect(15.5 + w, 7, 1, 6, "white")
    g.rect(9 + w, 13, 14, 1, "ink")
    face_front(g, 16 + w, 15)
    return rim(g, LIT)


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    def frames(gs, outline=True):
        return [g.outlined(outline) for g in gs]

    # the walkers carry the leash on every road, so their outlines hold 3:1 on the light roads
    for key, draw in WALKERS.items():
        def pose(**q):
            return edged(big(draw, **q))

        yield key, [("walk", frames(pose(**q) for q in WALKER_WALK), 160),
                    ("react", frames(pose(**q) for q in WALKER_REACT), 120),
                    ("stumble", frames(lean(pose(**q), k) for k, q in WALKER_STUMBLE), 90),
                    ("idle", frames(pose(**q) for q in WALKER_IDLE), BREATH_MS),
                    ("wave", frames(edged(big(WAVES[key], wave=w)) for w in WALKER_WAVE), WALKER_WAVE_MS),
                    ("cheer", [hopped(edged(big(cheering, key, swing, bob=crouch)).outlined(), hop)
                               for crouch, swing, hop in WALKER_CHEER], WALKER_CHEER_MS)]
    yield "treat", [("idle", frames(big(treat, **q) for q in TREAT_IDLE), 400)]
    yield "tip", [("idle", frames(big(tip, rx) for rx in (5.5, 3.5, 1, 3.5)), 120)]
    yield "skunk", [("idle", frames(big(skunk, **q) for q in SKUNK_IDLE), 300),
                    ("walk", frames(big(skunk, **q) for q in SKUNK_WALK), PERSON_WALK_MS)]
    yield "squirrel", [("idle", frames([big(squirrel, tail=0), big(squirrel, tail=1)]), 300),
                       ("run", frames(big(squirrel_run, k) for k in range(4)), 60)]
    yield "puddle", [("idle", frames([puddle(0), puddle(1)], outline=False), 500)]
    yield "skunk-cloud", [("loop", frames((skunk_cloud(i) for i in range(4)), outline=False), 220)]
    yield "other-dog", [("walk", frames(big(corgi, **q) for q in CORGI_WALK), 100),
                        ("idle", frames(big(corgi, **q) for q in CORGI_IDLE), 300)]
    owner = dict(shoes="dbrown")
    yield "other-dog-owner", [("walk", frames(big(dressed, dog_owner_top, **q, **owner) for q in PERSON_WALK),
                               PERSON_WALK_MS),
                              ("idle", frames(big(dressed, dog_owner_top, bob=bb, **owner) for bb in BREATH),
                               BREATH_MS)]
    yield "thief", [("walk", frames(big(dressed, thief_top, **q) for q in PERSON_WALK), PERSON_WALK_MS),
                    ("flee", frames(big(thief_fleeing, k) for k in (-1, 1)), 110),
                    ("idle", frames(big(dressed, thief_top, bob=bb) for bb in BREATH), BREATH_MS)]
    yield "lost-wallet", [("idle", frames([big(wallet, False), big(wallet, True)]), 450)]
    neighbour = dict(legs="purple", shoes="dbrown")
    yield "petting-neighbour", [("walk", frames(big(dressed, neighbour_top(False, -q.get("bob", 0)), **q, **neighbour)
                                                for q in PERSON_WALK), PERSON_WALK_MS),
                                ("wave", frames(big(dressed, neighbour_top(True, k), bob=NEIGHBOUR_CROUCH,
                                                    **neighbour) for k in (0, 1)), 350),
                                ("idle", frames(big(dressed, neighbour_top(False, k), bob=bb, **neighbour)
                                                for k, bb in enumerate(BREATH)), BREATH_MS)]
    yield "fx-bark", [("pop", frames([bark(False), bark(True)]), 120)]
    drive, drive_ms = TRUCK_DRIVE
    yield "ice-cream-truck", [("idle", frames([drawn(TRUCK_SCALE, ice_cream_truck, f) for f in (0, 1)]), 400),
                              ("drive", frames(drawn(TRUCK_SCALE, ice_cream_truck, 0, r) for r in drive), drive_ms)]
    yield "mail-carrier", [("walk", frames(big(mail_carrier, **q) for q in PERSON_WALK), PERSON_WALK_MS),
                           ("idle", frames(big(mail_carrier, bob=bb) for bb in BREATH), BREATH_MS)]
    yield "stroller", [("walk", frames(big(stroller, **q) for q in STROLLER_WALK), STROLLER_WALK_MS)]
    yield "jogger", [("run", frames(big(jogger, **q) for q in JOGGER_RUN), JOGGER_RUN_MS)]
    yield "kid-on-bike", [("ride", frames(big(kid_on_bike, **q) for q in KID_BIKE_RIDE), KID_BIKE_RIDE_MS)]


if __name__ == "__main__":
    # minis swaps the grid of the module named road, so the build runs that module's functions, not __main__'s
    import road
    main(sys.argv, road.sprites, "art/road", __doc__)
