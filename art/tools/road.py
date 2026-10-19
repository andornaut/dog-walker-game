#!/usr/bin/env python3
"""Draw everything on the road except the dogs, and build its Aseprite sources and exports.

People (walkers, forced stops, lucky people, the thief and the other dog's owner)
are 40x60, the other dog, skunk and squirrel 40x40 and pickups 20x20: their drawing
functions lay them out on 32x48, 32x32 and 16x16, and sprites() draws them SCALE
(1.25) times bigger on a scaling grid, never upscaled. The bark pop is 16x16. The
ice cream truck (104x55, two lanes, 64n-24 wide), the construction barrier (64x40, one
whole lane, repeated across the road) and the puddle (104x40) are drawn in their own
pixels; the skunk's stink haze (104x50) is a ground decal laid out on an 88x40 design
and stretched to its frame on the drawn grid. All are chibi and in Endesga 32 with
coloured outlines. The walker is seen from behind, like the
dogs, except in wave; everything coming down the road faces the player.

walker-<name> tags: walk (4 frames, 160ms), react (2, 120ms), stumble (4, 90ms), idle (2,
400ms), then wave (4 frames, 150ms, looping): the walker facing the camera, feet on the same rows
as the back view, the left arm (screen right) raised and swinging from the shoulder, the hand
1, 3, 5 and 3px right of it. At rest (idle frame 0) a 40x60 walker's feet (the outline under the
shoes) are on row 56, and the hands' top rows 16 above them, their outer columns 14 left and 13
right of the centre column (x 20). A walker who unlocks waves from the sidewalk in a popup stop. What stands on the road
is a billboard seen from the walker's eye, as roadside objects in OutRun are: a
front elevation (the ice cream truck a rear one, like obstacles.parked_car),
with no top surface and its base on the last opaque row.

Usage:
  road.py preview OUT.png   contact sheet of every frame, scaled up
  road.py build             write art/road/*.aseprite, then export
                            public/art/sprites/*.png and *.json with Aseprite

Everything that stands or waits on the road has a looping idle: people and
walkers breathe (a 1px bob of the head and shoulders) and the stop sign glints.
New tags go after the existing ones, so the frame indices the game uses stay put.

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import DARKER, K, Grid, edged, main  # noqa: E402


def face_front(g, cx, y, mood="happy", eyes="ink", lips="dbrown"):
    """Eyes and mouth for a chibi head seen from the front; y is the eye row. lips is the mouth's colour."""
    g.rect(cx - 5, y, 2, 2, eyes)
    g.rect(cx + 3, y, 2, 2, eyes)
    g.p(cx - 5, y, "white")
    g.p(cx + 3, y, "white")
    if mood == "happy":
        g.p(cx - 2, y + 4, lips)
        g.p(cx + 1, y + 4, lips)
        g.rect(cx - 1, y + 5, 2, 1, lips)
    elif mood == "smirk":
        g.rect(cx - 1, y + 5, 3, 1, lips)
        g.p(cx + 2, y + 4, lips)
    else:
        g.rect(cx - 1, y + 5, 2, 1, lips)


def rim(g, rims):
    """Light a dark figure's silhouette so it holds on Elm Avenue: an edge pixel of a colour in rims takes
    rims[colour] = (lit, shade), lit where the edge faces up or left into the light and shade where it
    faces right or down. A shade of None leaves that side dark."""
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


# The lit rim for every road sprite that fails 3:1 on Elm Avenue, for rim(): navy, ink and dslate take grey
# (slate opposite), slate lgrey, dark browns skin2, mid browns and ochre tan, greens green, blues cyan, and reds,
# mauves and purples pink. minis.py lights its hand-drawn maps with it too.
LIT = dict(navy=("grey", "slate"), ink=("grey", "slate"), dslate=("grey", "slate"), slate=("lgrey", None),
           dbrown=("skin2", None), plum=("skin2", None), brown=("tan", None), rust=("tan", None),
           ochre=("tan", None), dgreen=("green", None), forest=("green", None), sky=("cyan", None),
           blue=("cyan", None), red=("pink", None), dred=("pink", None), mauve=("pink", None), purple=("pink", None))


# Road sprites are drawn SCALE times the size their drawing functions lay them out at: a person laid out on
# 32x48, an animal on 32x32 and a pickup on 16x16 export at 40x60, 40x40 and 20x20. sprites() runs the functions
# on minis.Mini, which scales every shape before it rasterizes and keeps 1px lines 1px, so nothing is upscaled;
# the depth variants (minis.py, depths.py) run them at SCALE times each depth step.
SCALE = 1.25


def big(draw, *args, **q):
    """draw(*args, **q) at SCALE on a minis.Mini, its numeric keyword arguments (pose offsets) snapped to whole
    pixels as minis.snap has them."""
    import minis  # minis imports this module, so it is imported when first used

    pose = {k: v for k, v in q.items() if isinstance(v, (int, float)) and not isinstance(v, bool)}
    return minis.small(sys.modules[__name__], SCALE, draw, *args, **{**q, **minis.snap(pose, SCALE)})


# ---------- the walker (back view) ----------

def walker(lf=0, rf=0, bob=0, arms=0):
    g = Grid(32, 48)
    b = bob
    # legs and shoes; lf and rf lift a foot
    for x, f in ((11, lf), (17, rf)):
        g.rect(x, 33 + b, 4, 10 + f - b, "blue")
        g.rect(x + 3, 33 + b, 1, 10 + f - b, "navy")
        g.rect(x, 43 + f, 4, 2, "white")
        g.rect(x, 44 + f, 4, 1, "lgrey")
    # arms swing against the legs
    for x, d in ((5, -arms), (23, arms)):
        g.rect(x, 22 + b + d, 4, 10, "sky")
        g.rect(x + 3, 22 + b + d, 1, 10, "blue")
        g.rect(x, 32 + b + d, 4, 3, "skin1")
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
    g.ell(16, 12.5 + b, 8.5, 8.5, "dbrown", "plum", "brown")
    g.rect(7, 13 + b, 2, 3, "skin1")
    g.rect(23, 13 + b, 2, 3, "skin1")
    g.ell(16, 8 + b, 8.5, 5, "amber", "orange", "yellow")
    g.rect(8, 10 + b, 17, 2, "orange")
    g.rect(15, 10 + b, 2, 2, "dbrown")
    g.ell(16, 17 + b, 2.5, 4, "dbrown", "plum")
    return g


# ---------- the other walkers (back view) ----------

def walker_girl(lf=0, rf=0, bob=0, arms=0):
    """Ada, 11, mixed race, caramel skin, long black curls falling straight down: pink tee, teal shorts.
    She stands 4px shorter than the adults: her head and body sit lower and her legs are shorter."""
    g = Grid(32, 48)
    b = bob
    for x, f in ((12, lf), (17, rf)):
        g.rect(x, 40 + b, 3, 3 + f - b, "brown")
        g.rect(x, 43 + f, 3, 1, "white")
        g.rect(x, 44 + f, 3, 1, "lgrey")
        g.rect(x, 45 + f, 3, 1, "pink")
    for x, d in ((7, -arms), (22, arms)):
        g.rect(x, 30 + b + d, 3, 7, "brown")
        g.rect(x, 30 + b + d, 3, 3, "pink")
    g.rect(10, 29 + b, 12, 8, "pink")
    g.rect(19, 29 + b, 3, 8, "mauve")
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
                       purple=("grey", "slate"), brown=("skin2", None), blue=("sky", None)))


def walker_man(lf=0, rf=0, bob=0, arms=0):
    """Ben, 45, Black, bald (his beard is under his chin, out of sight from behind): green tee, navy track pants,
    sneakers. The tee's green is a hue no road has, so he reads on all six."""
    g = Grid(32, 48)
    b = bob
    for x, f in ((11, lf), (17, rf)):
        g.rect(x, 33 + b, 4, 10 + f - b, "navy")
        # the track pants' stripe runs down the outside of each leg
        g.rect(x + (3 if x > 16 else 0), 33 + b, 1, 10 + f - b, "grey")
        g.rect(x, 43 + f, 4, 2, "white")
        g.rect(x, 44 + f, 4, 1, "lgrey")
        g.rect(x + 1, 43 + f, 2, 1, "red")
    for x, d in ((5, -arms), (23, arms)):
        g.rect(x, 22 + b + d, 4, 4, "green")
        g.rect(x + 3, 22 + b + d, 1, 4, "dgreen")
        g.rect(x, 26 + b + d, 4, 6, "dbrown")
        g.rect(x + 3, 26 + b + d, 1, 6, "plum")
        g.rect(x, 32 + b + d, 4, 3, "dbrown")
    # the green tee, shaded dgreen down its right side
    g.rect(9, 21 + b, 14, 13, "green")
    g.rect(20, 21 + b, 3, 13, "dgreen")
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    g.rect(13, 19 + b, 6, 3, "dbrown")
    # bald head, the beard showing along the jaw, a shine on the crown
    g.rect(8, 12 + b, 2, 3, "dbrown")
    g.rect(22, 12 + b, 2, 3, "plum")
    g.blob(16, 12 + b, 7, 9, "dbrown", "plum", power=2.15)
    g.rect(11, 7 + b, 3, 1, "brown")
    g.p(11, 8 + b, "brown")
    # a light rim along the edges facing the light, a dimmer one opposite, so he holds on the dark road
    return rim(g, dict(navy=("grey", "grey"), dgreen=("green", None), dbrown=("skin2", "brown"),
                       plum=("skin2", "brown")))


def walker_teacher(lf=0, rf=0, bob=0, arms=0):
    """50, dirty blonde bob to the shoulders, cute: green cardigan, navy skirt, tights, brown flats."""
    g = Grid(32, 48)
    b = bob
    for x, f in ((11, lf), (17, rf)):
        g.rect(x + 1, 37 + b, 3, 6 + f - b, "dslate")
        g.rect(x, 43 + f, 4, 2, "dbrown")
    for x, d in ((5, -arms), (23, arms)):
        g.rect(x, 22 + b + d, 4, 10, "dgreen")
        g.rect(x + 3, 22 + b + d, 1, 10, "forest")
        g.rect(x, 32 + b + d, 4, 3, "skin1")
    g.rect(9, 21 + b, 14, 11, "dgreen")
    g.rect(20, 21 + b, 3, 11, "forest")
    g.rect(9, 21 + b, 1, 10, "green")
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    g.rect(9, 31 + b, 14, 7, "navy")
    g.rect(20, 31 + b, 3, 7, "ink")
    g.rect(9, 31 + b, 14, 1, "dslate")
    # a canvas tote with an apple on it
    g.rect(25, 24 + b, 5, 1, "brown")
    g.rect(24, 25 + b, 7, 8, "cream")
    g.rect(29, 25 + b, 2, 8, "tan")
    g.rect(26, 27 + b, 3, 3, "red")
    g.p(27, 26 + b, "dgreen")
    # a dirty blonde bob to the shoulders, flicking out at the ends: light brown, darker than her skin,
    # with golden amber streaks where the light catches it
    g.ell(16, 12.5 + b, 9, 9, "brown", "dbrown", "tan")
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
    """(first row, rows) of each straight run of a lock length rows long: a run is one 1px-wide rect, so at
    SCALE the lock stays unbroken."""
    k = 0
    while k < length:
        n = 1
        while k + n < length and CURL_WAVE[(k + n) % len(CURL_WAVE)] == CURL_WAVE[k % len(CURL_WAVE)]:
            n += 1
        yield k, n
        k += n


WALKERS = {
    "walker-ada": walker_girl,
    "walker-ben": walker_man,
    "walker-trista": walker_teacher,
}


WALKER_WALK = [dict(lf=-2, rf=0, arms=1), dict(lf=-1, rf=-1, bob=-1), dict(lf=0, rf=-2, arms=-1), dict(lf=-1, rf=-1, bob=-1)]
WALKER_REACT = [dict(lf=-4, rf=-4, bob=-4, arms=-3), dict(lf=-1, rf=-1, bob=-1, arms=-1)]
# A bump: lurch left with the arms up, wobble back, steady (a right lean would push a tote out of the frame). Each pose is (lean, walker args).
WALKER_STUMBLE = [(-3, dict(lf=-3, rf=0, bob=1, arms=-3)), (1, dict(lf=0, rf=-3, arms=-3)),
                  (-1, dict(lf=-1, rf=0, arms=1)), (0, dict(lf=-1, rf=-1, bob=-1))]
# Waiting while the walk pauses: feet planted, arms at rest, a 1px breath.
WALKER_IDLE = [dict(), dict(bob=-1)]
# The breathing bob every standing person shares, and its frame duration in ms.
BREATH, BREATH_MS = (0, -1), 400


def lean(g, k):
    """Shear a person about its feet: the head moves k layout pixels sideways (k x SCALE on a 40x60 grid), the
    shoes stay put."""
    g = getattr(g, "g", g)
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
# A walker who unlocks waves from the sidewalk, facing the camera: the same clothes, colours and frame as
# the back view, feet on the same rows, the left arm (screen right) raised and swinging from the shoulder.

def raised_arm(g, x, w, top, bottom, dx, parts):
    """An arm raised from the shoulder (its bottom row) to the hand (its top row), tilted so the hand sits dx
    pixels right of the shoulder; every row shifts in proportion, so it pivots at the shoulder. parts are
    (rows, fill, shade) from the hand down, the last running to the shoulder; shade takes the right column."""
    y = top
    for i, (rows, fill, shade) in enumerate(parts):
        end = bottom + 1 if i == len(parts) - 1 else y + rows
        # each run of rows with the same shift is one rect, so at SCALE the arm stays solid
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


def eye_boxes(g, cx, y):
    """(left column, top row, size) in pixels of each eye face_front draws at (cx, y): 2px at 1x, and on a
    minis.Mini the eyes minis.face_front draws at its scale."""
    s = getattr(g, "s", 1)
    n = max(1, math.floor(2 * s + 0.5))
    top = math.floor((y + 1) * s + 0.5 - n / 2)
    return [(math.floor(x * s + 0.5 - n / 2), top, n) for x in (cx - 4, cx + 4)]


def glasses(g, cx, y, c):
    """Round glasses on the eyes face_front draws at (cx, y): a ring 1px out from each eye with its corners
    cut, and a bridge between them along the eyes' top row. Drawn in pixels round the eyes, so they fit
    them at any scale."""
    px = getattr(g, "g", g)
    (lx, top, n), (rx, _, _) = eye_boxes(g, cx, y)
    for x0 in (lx, rx):
        px.rect(x0 - 1, top, 1, n, c)
        px.rect(x0 + n, top, 1, n, c)
        px.rect(x0, top - 1, n, 1, c)
        px.rect(x0, top + n, n, 1, c)
    px.rect(lx + n + 1, top, rx - lx - n - 2, 1, c)


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
    g.ell(16, 21.5 + b, 6, 2, "blue")
    g.rect(14, 19 + b, 4, 3, "skin2")
    raised_arm(g, 23, 4, 9 + b, 23 + b, wave, ((3, "skin1", "skin2"), (0, "sky", "blue")))
    # head: hair at the sides under the cap, ears, face, then the cap with its brim towards the camera
    g.ell(16, 11 + b, 8.5, 6, "dbrown", "plum", "brown")
    g.rect(7, 13 + b, 2, 3, "skin1")
    g.rect(23, 13 + b, 2, 3, "skin1")
    g.ell(16, 14 + b, 7.5, 6.5, "skin1", "skin2")
    g.ell(16, 8 + b, 8.5, 5, "amber", "orange", "yellow")
    g.rect(7, 10 + b, 18, 2, "orange")
    g.rect(7, 11 + b, 18, 1, "rust")
    g.p(16, 6 + b, "yellow")
    face_front(g, 16, 14 + b)
    g.p(10, 17 + b, "pink")
    g.p(22, 17 + b, "pink")
    return g


def ada_front(wave=0, bob=0):
    """Ada facing the camera, 4px shorter than the adults: long black curls framing her face and falling past
    her shoulders, a pink clip, pink tee, teal shorts."""
    g = Grid(32, 48)
    b = bob
    for x in (12, 17):
        g.rect(x, 40 + b, 3, 3 - b, "brown")
        g.rect(x, 43, 3, 1, "white")
        g.rect(x, 44, 3, 1, "lgrey")
        g.rect(x, 45, 3, 1, "pink")
    # the curls behind her shoulders, then the tee and shorts over them
    g.ell(16, 18.5 + b, 8.5, 8, "navy", "ink", "dslate")
    g.rect(8, 19 + b, 16, 11, "navy")
    g.rect(21, 19 + b, 3, 11, "ink")
    for x, y, rx, ry, c in ((8.4, 23, 1.6, 2, "navy"), (8.6, 28, 1.4, 1.6, "navy"), (23.6, 23.5, 1.4, 1.8, "ink"),
                            (23.4, 28.4, 1.5, 1.5, "ink")):
        g.ell(x, y + b, rx, ry, c)
    g.rect(7, 30 + b, 3, 7, "brown")
    g.rect(7, 30 + b, 3, 3, "pink")
    g.rect(10, 29 + b, 12, 8, "pink")
    g.rect(19, 29 + b, 3, 8, "mauve")
    g.rect(14, 29 + b, 4, 1, "mauve")
    g.rect(10, 36 + b, 12, 4, "sky")
    g.rect(19, 36 + b, 3, 4, "blue")
    g.rect(15, 38 + b, 2, 2, "blue")
    g.rect(14, 26 + b, 4, 3, "dbrown")
    raised_arm(g, 22, 3, 16 + b, 31 + b, wave, ((3, "brown", "dbrown"), (9, "brown", "dbrown"), (0, "pink", "mauve")))
    # her face, then the curls over her forehead, lit dslate on the left
    g.ell(16, 20.5 + b, 6.5, 6.5, "brown")
    g.rect(10, 18 + b, 1, 4, "navy")
    g.rect(22, 18 + b, 1, 4, "ink")
    g.ell(16, 14.5 + b, 7.5, 3.5, "navy", "ink", "dslate")
    for x, y in ((11, 16), (14, 17), (18, 17), (21, 16)):
        g.p(x, y + b, "navy")
    g.rect(11, 12 + b, 3, 1, "dslate")
    g.ell(21, 13 + b, 2, 1.5, "pink", "mauve")
    face_front(g, 16, 20 + b, lips="dbrown")
    return rim(g, dict(navy=("grey", "slate"), ink=("grey", "slate"), dslate=("grey", "slate"),
                       brown=("skin2", None), blue=("sky", None)))


def ben_front(wave=0, bob=0):
    """Ben facing the camera: bald, the chin-strap beard along his jaw and under his chin, a smile, green tee,
    navy track pants with a grey stripe, white sneakers."""
    g = Grid(32, 48)
    b = bob
    for x in (11, 17):
        g.rect(x, 33 + b, 4, 10 - b, "navy")
        g.rect(x + (0 if x < 16 else 3), 33 + b, 1, 10 - b, "grey")
        g.rect(x, 43, 4, 2, "white")
        g.rect(x, 44, 4, 1, "lgrey")
        g.rect(x + 1, 43, 2, 1, "red")
    g.rect(5, 22 + b, 4, 4, "green")
    g.rect(8, 22 + b, 1, 4, "dgreen")
    g.rect(5, 26 + b, 4, 6, "dbrown")
    g.rect(8, 26 + b, 1, 6, "plum")
    g.rect(5, 32 + b, 4, 3, "dbrown")
    g.rect(9, 21 + b, 14, 13, "green")
    g.rect(20, 21 + b, 3, 13, "dgreen")
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    g.rect(13, 19 + b, 6, 3, "plum")
    g.rect(13, 21 + b, 6, 1, "dgreen")
    raised_arm(g, 23, 4, 9 + b, 23 + b, wave, ((3, "dbrown", "plum"), (8, "dbrown", "plum"), (0, "green", "dgreen")))
    g.rect(8, 12 + b, 2, 3, "dbrown")
    g.rect(22, 12 + b, 2, 3, "plum")
    g.blob(16, 12 + b, 7, 9, "dbrown", "plum", power=2.15)
    g.rect(11, 7 + b, 3, 1, "brown")
    g.p(11, 8 + b, "brown")
    # the beard runs down the jaw and round under the chin, leaving the upper lip bare
    g.rect(9, 14 + b, 1, 4, "ink")
    g.rect(22, 14 + b, 1, 4, "ink")
    g.ell(16, 18.5 + b, 6, 2.5, "ink")
    g.rect(13, 16 + b, 6, 1, "dbrown")
    front_eyes(g, 16, 12 + b)
    g.rect(14, 17 + b, 4, 1, "cream")
    g.p(13, 16 + b, "cream")
    g.p(18, 16 + b, "cream")
    return rim(g, dict(navy=("grey", "grey"), dgreen=("green", None), dbrown=("skin2", "brown"),
                       plum=("skin2", "brown"), ink=("grey", "slate")))


def trista_front(wave=0, bob=0):
    """Trista facing the camera: a dirty blonde bob framing her face with a side-swept fringe, round glasses, a
    green cardigan open over a white blouse, navy skirt, tights, brown flats, her apple tote on her right
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
    g.rect(9, 31 + b, 14, 7, "navy")
    g.rect(20, 31 + b, 3, 7, "ink")
    g.rect(9, 31 + b, 14, 1, "dslate")
    # the canvas tote hangs off her shoulder by a strap, the apple facing out
    g.rect(7, 21 + b, 1, 5, "brown")
    g.rect(2, 26 + b, 7, 8, "cream")
    g.rect(7, 26 + b, 2, 8, "tan")
    g.rect(4, 28 + b, 3, 3, "red")
    g.p(5, 27 + b, "dgreen")
    raised_arm(g, 23, 4, 9 + b, 23 + b, wave, ((3, "skin1", "skin2"), (0, "dgreen", "forest")))
    # the bob: hair behind and beside the face to the shoulders, flicking out, then the face and fringe
    g.ell(16, 12.5 + b, 9, 9, "brown", "dbrown", "tan")
    g.rect(7, 12 + b, 18, 7, "brown")
    g.rect(22, 12 + b, 3, 7, "dbrown")
    g.p(6, 19 + b, "brown")
    g.p(25, 19 + b, "dbrown")
    g.rect(7, 19 + b, 2, 1, "brown")
    g.rect(23, 19 + b, 2, 1, "dbrown")
    g.ell(16, 14.5 + b, 6.5, 6.5, "skin1", "skin2")
    g.rect(14, 19 + b, 4, 2, "skin2")
    g.ell(17, 8.5 + b, 8, 3.5, "brown", "dbrown", "tan")
    g.tri((8, 8 + b), (19, 9 + b), (9, 13.5 + b), "brown")
    for x, y, h in ((11, 6, 3), (15, 5, 3), (19, 6, 2)):
        g.rect(x, y + b, 1, h, "amber")
    face_front(g, 16, 14 + b)
    glasses(g, 16, 14 + b, "dbrown")
    return rim(g, dict(brown=("tan", None), dgreen=("green", None), navy=("grey", None), dslate=("grey", None)))


WAVES = {
    "walker-casey": casey_front,
    "walker-ada": ada_front,
    "walker-ben": ben_front,
    "walker-trista": trista_front,
}
# The hand's swing right of the shoulder, one frame each: out, further, back.
WALKER_WAVE = (1, 3, 4, 3)
WALKER_WAVE_MS = 150


# ---------- pickups ----------

def treat(lift=0):
    """A bone, outlined in plum so it holds on the light roads; its cream carries Elm Avenue."""
    g = edged(Grid(16, 16))
    y = 6 + lift
    g.rect(4, y, 8, 3, "cream")
    for cx, cy in ((3.5, y + 0.5), (3.5, y + 2.5), (12.5, y + 0.5), (12.5, y + 2.5)):
        g.ell(cx, cy, 1.8, 1.8, "cream", "tan")
    g.rect(4, y + 2, 8, 1, "tan")
    g.p(5, y, "white")
    g.p(3, y - 1, "white")
    return g


def tip(rx):
    """A coin spinning: rx is its half-width as it turns. Outlined in plum so it holds on the light roads,
    with a white glint on its lit edge."""
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

def skunk(sway=0):
    """The skunk facing the player at its own eye level, a squat front elevation: its tail fans up behind
    its right shoulder with a white stripe curving along its inner edge, and sways 1px; the head is in front
    of the body, the white blaze running up from the nose between the ears, front paws on the road. The road
    outline and a grey rim on the dark fur so it holds on Elm Avenue."""
    g = edged(Grid())
    s = sway
    # the tail: a plume up behind the right shoulder, a white crescent along its upper left
    g.ell(20 + s, 11, 8, 8.5, "navy", "ink", "dslate")
    g.ell(20 + s, 11, 6, 6.5, "white", "lgrey")
    g.ell(22 + s, 13, 5, 5.5, "navy", "ink")
    # body, low and wide
    g.ell(16, 24, 9, 5, "ink", None, "dslate")
    # head: a dslate edge parts it from the body; pink-lined ears, the blaze, white-ringed eyes
    for x, top, inner in ((9, 10, 11), (19, 18, 17)):
        g.tri((x, 17), (top, 11), (2 * inner - x, 15), "dslate")
        g.p(inner, 14, "pink")
    g.ell(14, 19, 6.5, 5.5, "dslate")
    g.ell(14, 19.5, 5.5, 4.5, "navy", None, "dslate")
    g.rect(13, 13, 2, 8, "white")
    g.rect(14, 14, 1, 7, "lgrey")
    for x in (10, 16):
        g.rect(x, 18, 2, 2, "white")
        g.rect(x + (1 if x < 13 else 0), 18, 1, 2, "ink")
    g.rect(13, 21, 2, 1, "pink")
    # front paws
    for x in (10, 16):
        g.rect(x, 27, 3, 2, "ink")
    return rim(g, LIT)


def squirrel(tail=0, shift=0):
    """The squirrel sitting up facing the player, a front elevation: its bushy tail curls up behind its
    right side, the body sits upright with its paws held at its chest and its hind feet planted. tail
    swishes the tail's tip 1px right; shift moves the head, body and paws 1px right. The road outline and a
    tan rim on the fur facing the light."""
    g = edged(Grid())
    t, h = tail, shift
    # the tail, rising from the base behind the body and curling over at the top
    g.ell(21 + t, 15, 5.5, 9, "ochre", "rust", "tan")
    g.ell(18 + t, 6.5, 5, 3.5, "ochre", "rust", "tan")
    g.ell(21 + t, 15.5, 2.5, 6, "tan")
    # body, sitting up, with a cream belly; hind feet either side
    g.ell(15 + h, 21.5, 5.5, 6.5, "ochre", "rust", "tan")
    g.ell(15 + h, 22.5, 3, 4.5, "cream")
    for x in (10, 17):
        g.rect(x + h, 27, 4, 2, "rust")
    # paws held together at the chest
    g.rect(13 + h, 19, 4, 2, "rust")
    squirrel_head(g, 15 + h, 12.5)
    return rim(g, LIT)


def squirrel_head(g, x, y):
    """The squirrel's head facing the player, centred on (x, y), with its ears and face."""
    g.tri((x - 4, y - 1.5), (x - 3.5, y - 6), (x - 1, y - 3), "ochre")
    g.tri((x + 4, y - 1.5), (x + 3.5, y - 6), (x + 1, y - 3), "ochre")
    g.ell(x, y, 4.5, 4, "ochre", "rust", "tan")
    g.ell(x, y + 2, 2.5, 1.5, "cream")
    g.rect(x - 3, y - 0.5, 2, 2, "ink")
    g.rect(x + 1, y - 0.5, 2, 2, "ink")
    g.p(x - 3, y - 0.5, "white")
    g.p(x + 1, y - 0.5, "white")
    g.rect(x - 1, y + 1.5, 2, 1, "plum")


def squirrel_run(gather):
    """The squirrel bounding down the road at the player, a front elevation. Stretched (gather False), it
    lands low and wide, front paws planted apart, tail streaming up behind; gathered, it is airborne 3px
    higher, paws tucked under its chin and the tail flung up in an arch."""
    g = edged(Grid())
    if gather:
        g.ell(20, 9, 5, 6, "ochre", "rust", "tan")
        g.ell(20, 9.5, 2.5, 4, "tan")
        g.ell(15, 19, 5.5, 5, "ochre", "rust", "tan")
        g.ell(15, 20, 3, 3, "cream")
        for x in (11, 17):
            g.rect(x, 24, 3, 2, "rust")
        squirrel_head(g, 15, 14.5)
    else:
        g.ell(22, 14, 5, 7, "ochre", "rust", "tan")
        g.ell(22, 14.5, 2.5, 4.5, "tan")
        g.ell(16, 22, 7, 4.5, "ochre", "rust", "tan")
        g.ell(16, 23, 3.5, 2.5, "cream")
        for x in (8, 21):
            g.rect(x, 26, 3, 3, "rust")
            g.rect(x, 28, 3, 1, "tan")
        squirrel_head(g, 16, 18.5)
    return rim(g, LIT)


def puddle(f, w=104, h=40):
    """The road's 2-lane puddle, 104x40 (64n-24 wide for n = 2); cards draw a 32x16 one. Wide puddles get a
    second lobe."""
    g = Grid(w, h)
    lobes = [(w / 2, h / 2, w / 2 - 2, h / 2 - 2)]
    if w > 40:
        lobes = [(w * 0.36, h * 0.52, w * 0.34, h / 2 - 3), (w * 0.66, h * 0.46, w * 0.32, h / 2 - 4)]
    for cx, cy, rx, ry in lobes:
        g.ell(cx, cy, rx, ry, "blue")
    for cx, cy, rx, ry in lobes:
        g.ell(cx, cy + 0.5, rx - 1, ry - 1, "sky")
    s = 1 if f else 0
    for fx, fy, fw in ((0.28, 0.31, 0.125), (0.59, 0.56, 0.16), (0.41, 0.69, 0.06), (0.75, 0.3, 0.1)):
        if w > 40 or fx < 0.7:
            g.rect(round(fx * w) + (s if fx < 0.5 else -s), round(fy * h), max(2, round(fw * w)), 1, "cyan")
    return g


# The stink haze's puffs as (centre x, centre y, radius across), laid out on an 88x40 design that the sprite
# stretches to CLOUD_SIZE (2 lanes, 64n-24 wide, by 1.25 x 40 rows). The haze hugs the road: each puff is
# CLOUD_SQUASH as tall as it is wide, so together they make a low, wide bank with a lumpy top, its base on the
# frame's last row. A swollen puff still stops a pixel short of the frame's top and sides, so no lobe is clipped
# flat; along the bottom the frame's last row cuts them level, where the haze meets the road.
CLOUD_PUFFS = [(44, 28, 30), (22, 31, 15), (66, 31, 15), (31, 36, 15), (57, 36, 15), (32, 20, 11), (57, 19, 11),
               (44, 14, 9), (11, 35, 9), (77, 35, 9), (19, 24, 7), (70, 24, 7)]
CLOUD_SQUASH = 0.42
CLOUD_W, CLOUD_H = 88, 40
CLOUD_SIZE = (104, 50)
# Where each stink wisp starts, trailing 6 design rows down.
CLOUD_WISPS = ((22, 25), (62, 22), (72, 30), (14, 31), (42, 17))
# The haze's colours: the outer and inner rim, the dithered fill and its darker pixels, and the wisps.
CLOUD_INK = dict(outer="plum", inner="pink", fill="mauve", dark="purple", wisp="purple")


def skunk_cloud(step, s=1):
    """The stink haze under the skunk at depth step s (CLOUD_SIZE at 1), low and wide on the road: puffs with a
    solid rim and a 2x2-dithered mauve fill, so the road shows through. The puffs swell in turn by a whole
    pixel; the base stays on the last row. The rim is two pixels at every size: plum outside, which holds 3:1
    on the light roads, and pink inside it, which holds on Elm Avenue. The dither and the wisps' 1px wave are
    laid on the drawn grid, so they keep their pixels at every step. A puff near the frame's top or sides is
    trimmed so that, swollen, it still stops a pixel short of them. Mauve keeps it apart from the green
    hedges, and matches fx-hit-skunk and fx-status-stinky."""
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
    depth = [[max(r - ((x + 0.5 - cx) ** 2 + ((y + 0.5 - cy) / k) ** 2) ** 0.5 for cx, cy, r in puffs)
              for x in range(w)] for y in range(h)]

    def inside(x, y):
        return 0 <= x < w and 0 <= y < h and depth[y][x] >= 0

    def beside(x, y, test):
        return any(test(x + dx, y + dy) for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)))

    outer = {(x, y) for y in range(h) for x in range(w)
             if inside(x, y) and beside(x, y, lambda a, b: not inside(a, b))}
    for y in range(h):
        for x in range(w):
            if not inside(x, y):
                continue
            if (x, y) in outer:
                g.p(x, y, CLOUD_INK["outer"])
            elif beside(x, y, lambda a, b: (a, b) in outer):
                g.p(x, y, CLOUD_INK["inner"])
            elif x % 2 == (y // 2 + step) % 2 and y % 2 == 0:
                g.p(x, y, CLOUD_INK["fill"] if (x + y) % 8 else CLOUD_INK["dark"])
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
    g.ell(24.5 + tail, 16.5 + b, 2.5, 2.5, "ochre", "rust", "tan")
    g.p(24 + tail, 15 + b, "cream")
    # hind paws between the front legs, further off and a shade darker
    for x, k in ((13, bl), (17, br)):
        g.rect(x, 25 + b, 2, 4 + lift(k) - b, "rust")
        g.rect(x, 28 + lift(k), 2, 1, "lgrey")
    # shoulders and the white chest ruff
    g.ell(16, 22 + b, 8.5, 4.5, "ochre", "rust", "tan")
    g.ell(16, 22 + b, 4.5, 4, "white", "lgrey")
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
    g.ell(16, 14 + b, 7.5, 5.5, "ochre", "rust", "tan")
    g.ell(16, 17 + b, 5.5, 2.5, "white", "lgrey")
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
# on the passing beats. Each beat lasts half the old two-frame step, so the dog keeps its pace.
CORGI_WALK = [dict(fl=1, fr=-1, bl=-1, br=1), dict(bob=-1), dict(fl=-1, fr=1, bl=1, br=-1), dict(bob=-1)]
# Standing while its walker chats: the dogs' idle, the tail at -1, 0, +1, 0 and the right ear 1px higher on the
# last frame.
CORGI_IDLE = [dict(tail=-1), dict(), dict(tail=1), dict(twitch=-1)]


def person(top, legs="navy", shoes="ink", lf=0, rf=0, bob=0):
    """A chibi person facing the player: legs and shoes, then the caller's top(g, bob)."""
    g = Grid(32, 48)
    for x, f in ((11, lf), (17, rf)):
        g.rect(x, 33 + bob, 4, 10 + f - bob, legs)
        g.rect(x + 3, 33 + bob, 1, 10 + f - bob, DARKER[K[legs]])
        g.rect(x, 43 + f, 4, 2, shoes)
    top(g, bob)
    return g


def dressed(top, **q):
    """person(top, **q) with the road outline and the lit rim."""
    return rim(edged(person(top, **q)), LIT)


def stripes(g, x, y0, y1, w, b):
    """Layout rows y0 to y1 - 1 of the thief's stripes, from x, w wide: white where (row - b) % 4 < 2, else
    ink. Drawn in pixels at the grid's scale, every stripe pair 4 x scale rows tall (white the shorter half),
    so at SCALE the stripes stay even instead of breaking up into 1px rows."""
    s = getattr(g, "s", 1)
    px = getattr(g, "g", g)

    def e(v):
        return math.floor(v * s + 0.5)

    period = max(2, e(4))
    anchor = e(20 + b)
    for r in range(e(y0), e(y1)):
        px.rect(e(x), r, max(1, e(x + w) - e(x)), 1, "white" if (r - anchor) % period < period // 2 else "ink")


def thief_top(g, b):
    """The thief coming down the road: striped shirt, beanie, mask and the loot sack over his shoulder."""
    stripes(g, 9, 21 + b, 34 + b, 14, b)
    for x in (5, 23):
        stripes(g, x, 22 + b, 31 + b, 4, b)
        g.rect(x, 31 + b, 4, 3, "skin2")
    # loot sack over the shoulder
    g.ell(25, 20 + b, 5, 6, "tan", "brown", "cream")
    g.rect(24, 13 + b, 3, 3, "brown")
    g.rect(23, 19 + b, 1, 3, "dbrown")
    g.rect(24, 18 + b, 3, 1, "dbrown")
    g.rect(24, 21 + b, 3, 1, "dbrown")
    g.rect(26, 22 + b, 1, 2, "dbrown")
    g.ell(16, 12.5 + b, 8, 8, "skin2", "brown", "skin1")
    g.ell(16, 7.5 + b, 8.5, 5, "navy", "ink", "dslate")
    g.rect(8, 9 + b, 17, 2, "dslate")
    g.rect(8, 12 + b, 17, 3, "ink")
    g.rect(11, 13 + b, 2, 1, "white")
    g.rect(19, 13 + b, 2, 1, "white")
    g.rect(14, 17 + b, 4, 1, "dbrown")
    g.p(18, 16 + b, "dbrown")


def thief_fleeing(stride):
    """The thief running off up the road, seen from behind: stride is -1 or 1, the side whose knee is up.
    The arms pump against the legs (the far arm bent forward and up, the near one swung back and low),
    and the loot sack bounces on his back. The road outline and the lit rim."""
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
    for x, back in ((5, s < 0), (23, s > 0)):
        if back:
            stripes(g, x - (1 if x < 16 else -1), 25 + b, 33 + b, 4, b)
            g.rect(x - (1 if x < 16 else -1), 33 + b, 4, 3, "skin2")
        else:
            stripes(g, x, 21 + b, 26 + b, 4, b)
            g.rect(x + (1 if x < 16 else -1), 26 + b, 3, 2, "skin2")
    stripes(g, 9, 21 + b, 34 + b, 14, b)
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    # loot sack slung over the right shoulder, bouncing a pixel against the stride, its neck gathered at the top
    k = b + (1 if s > 0 else 0)
    g.ell(22, 28 + k, 5, 5, "tan", "brown", "cream")
    g.tri((19.5, 24 + k), (24.5, 24 + k), (22, 19 + k), "tan")
    g.rect(21, 21 + k, 3, 2, "brown")
    g.rect(20, 23 + k, 5, 1, "dbrown")
    g.rect(21, 26 + k, 3, 1, "dbrown")
    g.p(21, 27 + k, "dbrown")
    g.rect(21, 28 + k, 3, 1, "dbrown")
    g.p(23, 29 + k, "dbrown")
    g.rect(21, 30 + k, 3, 1, "dbrown")
    # the back of the head: the beanie, the ears and the mask's band tied all the way round
    g.rect(14, 19 + b, 4, 3, "skin2")
    g.ell(16, 12.5 + b, 8, 8, "skin2", "brown", "skin1")
    g.rect(7, 13 + b, 2, 3, "skin2")
    g.rect(23, 13 + b, 2, 3, "brown")
    g.ell(16, 7.5 + b, 8.5, 5, "navy", "ink", "dslate")
    g.rect(8, 9 + b, 17, 2, "dslate")
    g.rect(8, 12 + b, 17, 2, "ink")
    return rim(g, LIT)


def neighbour_top(wave):
    def top(g, b):
        g.rect(9, 21 + b, 14, 13, "mauve")
        g.rect(20, 21 + b, 3, 13, "purple")
        g.rect(15, 21 + b, 2, 13, "pink")
        g.rect(5, 22 + b, 4, 9, "mauve")
        g.rect(5, 31 + b, 4, 3, "skin1")
        if wave:
            g.rect(23, 12 + b, 4, 10, "mauve")
            g.rect(23, 9 + b, 4, 3, "skin1")
        else:
            g.rect(23, 22 + b, 4, 9, "mauve")
            g.rect(23, 31 + b, 4, 3, "skin1")
        # a glass biscuit jar held at the chest: a round body with a glint down its lit side, chocolate-chip
        # biscuits stacked inside, a narrow neck and a red lid with a knob
        g.ell(14.5, 29 + b, 5.5, 5, "lgrey", "grey", "white")
        for x, y in ((12.5, 31), (16.5, 31), (14.5, 27.5)):
            g.ell(x, y + b, 2, 1.5, "tan", "brown")
            g.p(x - 1, y + b - 1, "dbrown")
            g.p(x + 0.5, y + b - 0.5, "dbrown")
        g.rect(10, 26 + b, 1, 4, "white")
        g.rect(10, 22 + b, 9, 2, "red")
        g.rect(10, 23 + b, 9, 1, "dred")
        g.rect(13, 21 + b, 3, 1, "red")
        g.ell(16, 12.5 + b, 8, 8, "skin1", "skin2")
        g.ell(16, 7.5 + b, 9, 5, "lgrey", "grey", "white")
        g.ell(16, 3 + b, 3.5, 2.5, "lgrey", "grey", "white")
        g.rect(8, 9 + b, 2, 6, "lgrey")
        g.rect(22, 9 + b, 2, 6, "lgrey")
        face_front(g, 16, 13 + b)
        g.rect(10, 12 + b, 5, 1, "dslate")
        g.rect(18, 12 + b, 5, 1, "dslate")
        g.p(10, 15 + b, "pink")
        g.p(22, 15 + b, "pink")
    return top


def tourist_top(flash):
    def top(g, b):
        g.rect(9, 21 + b, 14, 12, "orange")
        g.rect(20, 21 + b, 3, 12, "rust")
        for x, y in ((11, 23), (17, 25), (12, 29), (19, 30), (14, 26)):
            g.rect(x, y + b, 2, 2, "yellow")
        for x in (5, 23):
            g.rect(x, 22 + b, 4, 6, "orange")
            g.rect(x, 28 + b, 4, 4, "skin2")
        g.rect(9, 33 + b, 14, 3, "tan")
        # camera on a strap
        g.rect(12, 24 + b, 9, 6, "ink")
        g.rect(13, 25 + b, 7, 4, "dslate")
        g.ell(16.5, 27 + b, 2, 2, "lgrey")
        g.p(16, 26 + b, "white")
        g.rect(18, 23 + b, 2, 1, "dslate")
        g.ell(16, 13.5 + b, 8, 8, "skin2", "brown", "skin1")
        g.rect(9, 12 + b, 6, 3, "ink")
        g.rect(17, 12 + b, 6, 3, "ink")
        g.rect(15, 12 + b, 2, 1, "ink")
        g.p(10, 12 + b, "slate")
        g.p(18, 12 + b, "slate")
        g.rect(14, 18 + b, 4, 1, "dbrown")
        g.ell(16, 8 + b, 13, 3, "tan", "brown", "cream")
        g.ell(16, 6 + b, 7, 4, "tan", "brown", "cream")
        g.rect(9, 7 + b, 14, 1, "red")
        if flash:
            for dx, dy in ((0, -3), (0, 3), (-3, 0), (3, 0), (-2, -2), (2, -2), (-2, 2), (2, 2), (0, 0)):
                g.p(16 + dx, 27 + b + dy, "white")
            g.p(16, 27 + b, "yellow")
    return top


def wallet(glint):
    """The lost wallet, with the road outline. Its dark leather takes a light rim so it holds on Elm Avenue: the
    flap's top edge catches the light in tan, the left edge skin2, and brown runs down the right and along
    the bottom."""
    g = edged(Grid(16, 16))
    g.rect(5, 4, 7, 4, "green")
    g.rect(5, 4, 7, 1, "dgreen")
    g.rect(8, 5, 2, 2, "dgreen")
    g.rect(3, 6, 10, 7, "dbrown")
    g.rect(3, 6, 10, 1, "tan")
    g.rect(3, 9, 10, 1, "plum")
    g.rect(11, 9, 2, 2, "amber")
    if glint:
        # a 3x3 cross centred on layout pixel (13, 3), drawn in pixels so it stays a cross at any scale
        s = getattr(g, "s", 1)
        px, cx, cy = getattr(g, "g", g), math.floor(13.5 * s), math.floor(3.5 * s)
        px.rect(cx - 1, cy, 3, 1, "white")
        px.rect(cx, cy - 1, 1, 3, "white")
    return rim(g, WALLET_RIM)


# The wallet's rim: road.LIT, with a dimmer brown down the leather's shaded sides.
WALLET_RIM = dict(LIT, dbrown=("skin2", "brown"), plum=("skin2", "brown"))


def bark(big):
    """The bark pop: a white bubble with a red mark, outlined in plum on every side so it holds on the light roads."""
    g = edged(Grid(16, 16), lambda c: K["plum"])
    r = 6 if big else 5
    g.ell(8.5, 7, r, r - 0.5, "white", "lgrey")
    g.tri((4, 10), (2, 15), (7, 11), "white")
    g.rect(8, 3 if big else 4, 2, 5 if big else 4, "red")
    g.rect(8, 10 if big else 9, 2, 2, "red")
    return g


def dog_owner_top(g, b):
    """The other dog's walker: yellow raincoat, brown bob, leash hand held out low."""
    g.rect(9, 21 + b, 14, 13, "amber")
    g.rect(20, 21 + b, 3, 13, "orange")
    g.rect(9, 21 + b, 1, 12, "yellow")
    g.rect(15, 22 + b, 1, 11, "orange")
    g.p(13, 25 + b, "orange")
    g.p(13, 29 + b, "orange")
    g.rect(5, 22 + b, 4, 9, "amber")
    g.rect(5, 31 + b, 4, 3, "skin1")
    g.rect(23, 22 + b, 4, 8, "amber")
    g.rect(24, 30 + b, 4, 3, "skin1")
    g.ell(16, 12.5 + b, 8, 8, "skin1", "skin2")
    g.ell(16, 8.5 + b, 9, 5, "dbrown", "plum", "brown")
    g.rect(7, 9 + b, 3, 9, "dbrown")
    g.rect(22, 9 + b, 3, 9, "dbrown")
    g.rect(10, 9 + b, 12, 2, "dbrown")
    face_front(g, 16, 13 + b)
    g.p(10, 16 + b, "pink")
    g.p(22, 16 + b, "pink")


# ---------- forced stops ----------

# The stop sign's legend, 3x5 letters, each as rows of three bits.
STOP = {"S": "011100010001110", "T": "111010010010010", "O": "010101101101010", "P": "110101110100100"}


def stop_sign(glint=None):
    """glint is the diagonal x + y = glint (in layout pixels) along which a pink sheen crosses the red face, or
    None. The road outline and the lit rim. The face is drawn in pixels at the grid's scale: an octagon
    18 x scale across, its corners cut in one-pixel stairs, shaded dred along the lower-right edges and
    the bottom, and the legend in 3x5 letters spread to fill it. An octagon under 16px has no room for the
    letters, so the legend is a white bar across the face instead, a pixel of red each side."""
    g = edged(Grid(32, 48))
    g.rect(15, 22, 3, 24, "grey")
    g.rect(17, 22, 1, 24, "slate")
    g.rect(13, 45, 7, 2, "slate")
    s = getattr(g, "s", 1)
    px = getattr(g, "g", g)

    def e(v):
        return math.floor(v * s + 0.5)

    d, cut, left, top = math.floor(18 * s), e(5), e(7), e(4)
    for y in range(d):
        c = max(0, cut - y, y - (d - 1 - cut))
        px.rect(left + c, top + y, d - 2 * c, 1, "dred" if y == d - 1 else "red")
        if y > cut:
            px.p(left + d - 1 - c, top + y, "dred")
    if d >= 16:
        gap = max(1, (d - 14) // 3)
        x0 = left + (d - 12 - 3 * gap) // 2
        y0 = top + (d - 5) // 2
        for i, ch in enumerate("STOP"):
            for r in range(5):
                for k in range(3):
                    if STOP[ch][r * 3 + k] == "1":
                        px.p(x0 + i * (3 + gap) + k, y0 + r, "white")
    else:
        h = max(1, e(5) - 2)
        px.rect(left + 1, top + (d - h) // 2, d - 2, h, "white")
    if glint is not None:
        # the sheen stays inside the face, so the outline stays dark
        for y in range(top + 1, top + d - 1):
            x = e(glint) - y
            if 0 < x < px.w and px.px[y][x] == K["red"] and px.px[y - 1][x] and px.px[y][x - 1]:
                px.p(x, y, "pink")
    return rim(g, LIT)


def chatty_top(wave):
    def top(g, b):
        g.rect(9, 21 + b, 14, 13, "cream")
        g.rect(11, 21 + b, 10, 12, "dgreen")
        g.rect(19, 21 + b, 2, 12, "forest")
        if wave:
            g.rect(23, 12 + b, 4, 10, "cream")
            g.rect(23, 9 + b, 4, 3, "skin2")
        else:
            g.rect(23, 22 + b, 4, 9, "cream")
            g.rect(23, 31 + b, 4, 3, "skin2")
        # the left arm bent across the chest, holding a red mug of coffee steady through the wave:
        # the handle sticks out on the right, the hand cups it from the left
        g.rect(5, 22 + b, 4, 7, "cream")
        g.rect(5, 27 + b, 6, 3, "cream")
        g.rect(11, 24 + b, 5, 6, "red")
        g.rect(11, 24 + b, 1, 6, "pink")
        g.rect(15, 24 + b, 1, 6, "dred")
        g.rect(12, 24 + b, 3, 1, "dbrown")
        g.rect(16, 25 + b, 2, 1, "red")
        g.rect(17, 26 + b, 1, 2, "dred")
        g.rect(16, 28 + b, 2, 1, "dred")
        g.rect(10, 27 + b, 2, 3, "skin2")
        g.p(10, 27 + b, "skin1")
        g.ell(16, 12.5 + b, 8, 8, "skin2", "brown", "skin1")
        g.ell(16, 7 + b, 7, 3.5, "lgrey", "grey", "white")
        g.rect(8, 9 + b, 2, 5, "lgrey")
        g.rect(22, 9 + b, 2, 5, "lgrey")
        face_front(g, 16, 13 + b)
        g.rect(13, 16 + b, 6, 1, "lgrey")
        g.p(12, 17 + b, "lgrey")
        g.p(19, 17 + b, "lgrey")
    return top


def kid(wave=False, mood="happy", bob=0):
    """The kid, with the road outline and the lit rim."""
    g = edged(Grid(32, 48))
    b = bob
    for x in (12, 17):
        g.rect(x, 38 + b, 3, 6 - b, "skin1")
        g.rect(x, 44, 3, 2, "red")
    g.rect(10, 28 + b, 12, 10, "yellow")
    g.rect(19, 28 + b, 3, 10, "amber")
    g.rect(10, 35 + b, 12, 3, "sky")
    g.rect(7, 29 + b, 3, 6, "yellow")
    g.rect(7, 35 + b, 3, 2, "skin1")
    if wave:
        g.rect(22, 20 + b, 3, 8, "yellow")
        g.rect(22, 18 + b, 3, 2, "skin1")
    else:
        g.rect(22, 29 + b, 3, 6, "yellow")
        g.rect(22, 35 + b, 3, 2, "skin1")
    g.ell(16, 20.5 + b, 7.5, 7.5, "skin1", "skin2")
    g.ell(16, 15.5 + b, 8, 4, "red", "dred", "pink")
    g.rect(16, 17 + b, 9, 2, "red")
    g.rect(8, 18 + b, 2, 4, "ochre")
    g.rect(22, 18 + b, 2, 4, "ochre")
    face_front(g, 16, 21 + b, mood if mood != "sad" else "neutral")
    if mood == "sad":
        g.rect(15, 26 + b, 2, 1, "dbrown")
        g.p(14, 27 + b, "dbrown")
        g.p(17, 27 + b, "dbrown")
        g.p(10, 23 + b, "cyan")
    return rim(g, LIT)


def ice_cream_truck(f):
    """The ice cream truck parked ahead across two lanes, 104x55 (64n-24 wide for n = 2), from straight behind
    like obstacles.parked_car: a wide box van, squat, with its cone sign on the roof. The rear doors split down
    the middle, each with a window; a pink drip stripe runs across the doors; tall tail lights sit at the outer
    corners, amber blinkers under them; then the plate, the bumper and both rear wheels. f swaps the lit
    blinker and the music note. Drawn in its own pixels, symmetric about the seam on columns 51 and 52. The
    road outline and the lit rim."""
    g = edged(Grid(104, 55))
    for x in (10, 77):
        g.rect(x, 44, 17, 10, "ink")
        g.rect(x, 44, 3, 9, "dslate")
    # roof edge, then the box body: lit along the top and the left, shaded on the right
    g.rect(6, 12, 92, 3, "lgrey")
    g.rect(6, 12, 92, 1, "white")
    g.rect(3, 15, 98, 27, "white")
    g.rect(95, 15, 6, 27, "lgrey")
    g.p(3, 15, None)
    g.p(100, 15, None)
    # the rear doors: a seam down the middle, a window in each, handles by the seam
    g.rect(51, 16, 2, 25, "lgrey")
    for x in (19, 58):
        g.rect(x, 17, 27, 11, "navy")
        g.rect(x, 17, 27, 1, "slate")
        g.tri((x + 4, 27), (x + 11, 18), (x + 16, 18), "slate")
    g.rect(47, 30, 2, 4, "grey")
    g.rect(55, 30, 2, 4, "grey")
    # the drip stripe: a pink band with drips hanging from it, every 7 columns
    g.rect(3, 32, 98, 4, "pink")
    g.rect(3, 35, 98, 1, "mauve")
    for x in range(12, 92, 7):
        g.rect(x, 36, 2, 1 + (x // 7) % 2, "pink")
    # tail lights up the outer corners, blinkers under them
    for x in (4, 94):
        g.rect(x, 16, 6, 15, "red")
        g.rect(x, 16, 6, 1, "pink")
        g.rect(x + 5, 17, 1, 14, "dred")
    g.rect(4, 37, 6, 4, "yellow" if f else "amber")
    g.rect(94, 37, 6, 4, "amber" if f else "yellow")
    g.rect(44, 36, 16, 6, "cream")
    g.rect(46, 38, 12, 1, "tan")
    # bumper across the full width
    g.rect(2, 42, 100, 4, "dslate")
    g.rect(2, 42, 100, 1, "slate")
    g.rect(2, 42, 1, 4, "grey")
    # cone sign on the roof
    g.tri((47, 6), (57, 6), (52, 15), "tan")
    g.p(49, 8, "brown")
    g.p(53, 9, "brown")
    g.p(51, 11, "brown")
    g.ell(52, 5, 5, 3.5, "pink", "mauve", "white")
    if f:
        g.rect(73, 2, 1, 7, "plum")
        g.rect(73, 2, 3, 1, "plum")
        g.rect(71, 8, 2, 2, "plum")
    else:
        g.rect(30, 3, 1, 7, "plum")
        g.rect(30, 3, 3, 1, "plum")
        g.rect(28, 9, 2, 2, "plum")
    return rim(g, LIT)


def construction(f):
    """One lane's barrier, 64x40, repeated across every lane; f swaps which lamp is lit. A squat front
    elevation standing on the road line: the board, the lower rail right under it on short legs, the lamps
    and the detour sign. Striped like obstacles.barrier so the stripes hold steady at depth: the board's 5
    stairs of 2 rows are striped 10px orange every 20px, leaning right 2px a stair and stopping at the board's
    ends, and its bottom stair is the shaded lower edge. The lower rail's squares are 4px wide on even
    columns, as are the posts. The road outline and the lit rim."""
    g = edged(Grid(64, 40))
    for x in (7, 53):
        g.rect(x, 20, 4, 19, "grey")
        g.rect(x + 2, 20, 2, 19, "slate")
    for k, (base, stripe) in enumerate((("white", "orange"),) * 4 + (("lgrey", "rust"),)):
        y = 20 + 2 * k
        g.rect(3, y, 58, 2, base)
        for x in range(12 - 2 * k - 20, 61, 20):
            g.rect(max(x, 3), y, min(x + 10, 61) - max(x, 3), 2, stripe)
    g.rect(3, 30, 58, 5, "white")
    for x in range(4, 60, 8):
        g.rect(x, 30, 4, 5, "orange")
    g.ell(9, 16, 3, 3, "amber" if f else "orange", "orange", "yellow" if f else None)
    g.ell(55, 16, 3, 3, "orange" if f else "amber", "orange", None if f else "yellow")
    g.rect(22, 8, 20, 10, "amber")
    g.rect(22, 8, 20, 1, "orange")
    g.rect(27, 12, 12, 2, "plum")
    g.tri((24, 13), (29, 9), (29, 17), "plum")
    return rim(g, LIT)


def stair(g, x0, y0, x1, y1, c):
    """A strap running down from layout (x0, y0) to (x1, y1), exclusive: one pixel row per step, each step an
    equal share of the width. Drawn in pixels at the grid's scale, so its steps stay joined at SCALE."""
    s = getattr(g, "s", 1)
    px = getattr(g, "g", g)

    def e(v):
        return math.floor(v * s + 0.5)

    left, top, w, n = e(x0), e(y0), e(x1) - e(x0), e(y1) - e(y0)
    for i in range(n):
        px.rect(left + i * w // n, top + i, (i + 1) * w // n - i * w // n, 1, c)


def mail_top(g, b):
    """The mail carrier: a sky-blue shirt and cap, a navy brim, dark skin and a mailbag on a strap."""
    g.rect(9, 21 + b, 14, 12, "sky")
    g.rect(20, 21 + b, 3, 12, "blue")
    g.rect(15, 21 + b, 2, 12, "cyan")
    g.rect(5, 22 + b, 4, 9, "sky")
    g.rect(8, 22 + b, 1, 9, "blue")
    g.rect(5, 31 + b, 4, 3, "dbrown")
    g.rect(23, 22 + b, 4, 9, "sky")
    g.rect(26, 22 + b, 1, 9, "blue")
    g.rect(23, 31 + b, 4, 3, "dbrown")
    g.rect(9, 33 + b, 14, 3, "navy")
    # mailbag on a strap
    g.ell(24, 30 + b, 5, 4.5, "brown", "dbrown", "tan")
    g.rect(22, 27 + b, 4, 3, "white")
    stair(g, 10, 22 + b, 20, 27 + b, "dbrown")
    g.ell(16, 12.5 + b, 8, 8, "dbrown", "plum")
    g.ell(16, 7 + b, 8.5, 3.5, "sky", "blue", "cyan")
    g.rect(8, 9 + b, 17, 2, "navy")
    g.rect(15, 5 + b, 2, 2, "amber")
    face_front(g, 16, 13 + b, eyes="ink", lips="ink")
    g.p(11, 13 + b, "white")
    g.p(19, 13 + b, "white")


def mail_carrier(**q):
    """The mail carrier facing the player, with a light rim on the dark skin, brim and trousers so they hold
    on Elm Avenue, and the road outline for the light roads."""
    g = edged(person(mail_top, legs="navy", shoes="ink", **q))
    return rim(g, dict(dbrown=("skin2", "brown"), plum=("skin2", "brown"), navy=("grey", "slate"),
                       ink=("grey", "slate"), sky=("cyan", None), blue=("sky", None)))


# ---------- scenery gags (front view, in the backdrop band) ----------

def cat(tail=0, blink=False, alert=False):
    """A ginger cat sitting on a fence post; the game places its paws on the fence's top rail."""
    g = Grid(24, 24)
    tx = (0, 1, 2, 1)[tail]
    # tail curling up the right side
    g.rect(17 + tx, 10, 2, 8, "ochre")
    g.rect(16 + tx, 9, 3, 2, "ochre")
    g.p(17 + tx, 8, "rust")
    # body and front paws
    g.ell(12, 17.5, 6, 5.5, "ochre", "rust", "tan")
    g.ell(12, 18.5, 3, 3.5, "cream")
    g.rect(9, 22, 2, 1, "cream")
    g.rect(13, 22, 2, 1, "cream")
    # head and ears
    hy = 9 if alert else 10
    g.tri((6.5, hy - 1), (7.5, hy - 6 - (1 if alert else 0)), (10.5, hy - 3), "ochre")
    g.tri((17.5, hy - 1), (16.5, hy - 6 - (1 if alert else 0)), (13.5, hy - 3), "ochre")
    g.p(8, hy - 3, "pink")
    g.p(15, hy - 3, "pink")
    g.ell(12, hy + 1, 5.5, 4.5, "ochre", "rust", "tan")
    for x in (9, 14):
        if blink:
            g.rect(x, hy + 1, 2, 1, "plum")
        else:
            g.rect(x, hy, 2, 2, "green")
            g.p(x + (1 if x < 12 else 0), hy, "ink")
    g.p(12, hy + 3, "pink")
    g.rect(10, hy + 2, 1, 1, "cream")
    g.rect(13, hy + 2, 1, 1, "cream")
    if alert:
        g.rect(19, 2, 1, 3, "white")
        g.p(19, 6, "white")
    return g


def sprinkler(step):
    """A lawn sprinkler sweeping a fan of water across the grass and back."""
    g = Grid(32, 24)
    g.rect(14, 18, 4, 4, "grey")
    g.rect(13, 21, 6, 2, "slate")
    g.rect(15, 15, 2, 4, "lgrey")
    g.rect(0, 22, 13, 1, "dgreen")
    import math
    # the arm sweeps across and back within the loop, so it never snaps from one side to the other
    angle = (-60, 0, 60, 0)[step]
    for k in range(12):
        a = math.radians(angle - 90)
        r = 2 + k * 1.3
        x = 16 + math.cos(a) * r
        y = 15 + math.sin(a) * r + (k * k) * 0.06
        g.p(x, y, "cyan" if k % 3 else "white")
        g.p(x + 1, y + 1, "sky")
    for i in range(4):
        g.p(6 + i * 7 + step, 20 - (i + step) % 3, "cyan")
    return g


def ball(step):
    """A red and white ball; the game rolls it along the sidewalk."""
    g = Grid(14, 14)
    g.ell(7, 7, 5.5, 5.5, "red", "dred", "pink")
    for k in range(2):
        x = 2 + (k * 5 + step * 2) % 10
        for xx in (x, x + 1):
            for yy in range(2, 12):
                if g.px[yy][xx]:
                    g.p(xx, yy, "white" if g.px[yy][xx] != g.px[0][0] else None)
    g.p(5, 4, "white")
    return g


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    def frames(gs, outline=True):
        return [g.outlined(outline) for g in gs]

    # the walkers carry the leash on every road, so their outlines hold 3:1 on the light roads
    for key, draw in {"walker-casey": walker, **WALKERS}.items():
        def pose(**q):
            return edged(big(draw, **q))

        yield key, [("walk", frames(pose(**q) for q in WALKER_WALK), 160),
                    ("react", frames(pose(**q) for q in WALKER_REACT), 120),
                    ("stumble", frames(lean(pose(**q), k) for k, q in WALKER_STUMBLE), 90),
                    ("idle", frames(pose(**q) for q in WALKER_IDLE), BREATH_MS),
                    ("wave", frames(edged(big(WAVES[key], wave=w)) for w in WALKER_WAVE), WALKER_WAVE_MS)]
    yield "treat", [("idle", frames([big(treat, lift=0), big(treat, lift=-1)]), 400)]
    yield "tip", [("idle", frames(big(tip, rx) for rx in (5.5, 3.5, 1, 3.5)), 120)]
    yield "skunk", [("idle", frames([big(skunk, sway=0), big(skunk, sway=1)]), 400)]
    yield "squirrel", [("idle", frames([big(squirrel, tail=0), big(squirrel, tail=1)]), 300),
                       ("run", frames(big(squirrel_run, k) for k in (False, True)), 120)]
    yield "puddle", [("idle", frames([puddle(0), puddle(1)], outline=False), 500)]
    yield "skunk-cloud", [("loop", frames((skunk_cloud(i) for i in range(4)), outline=False), 220)]
    yield "other-dog", [("walk", frames(big(corgi, **q) for q in CORGI_WALK), 100),
                        ("idle", frames(big(corgi, **q) for q in CORGI_IDLE), 300)]
    owner = dict(shoes="dbrown")
    yield "other-dog-owner", [("walk", frames([big(dressed, dog_owner_top, lf=-2, **owner),
                                               big(dressed, dog_owner_top, rf=-2, **owner)]), 200),
                              ("idle", frames(big(dressed, dog_owner_top, bob=bb, **owner) for bb in BREATH), BREATH_MS)]
    yield "thief", [("walk", frames([big(dressed, thief_top, lf=-2), big(dressed, thief_top, rf=-2)]), 200),
                    ("flee", frames(big(thief_fleeing, k) for k in (-1, 1)), 110),
                    ("idle", frames(big(dressed, thief_top, bob=bb) for bb in BREATH), BREATH_MS)]
    yield "lost-wallet", [("idle", frames([big(wallet, False), big(wallet, True)]), 450)]
    neighbour = dict(legs="purple", shoes="dbrown")
    yield "biscuit-neighbour", [("wave", frames(big(dressed, neighbour_top(w), **neighbour) for w in (False, True)), 350),
                                ("idle", frames(big(dressed, neighbour_top(False), bob=bb, **neighbour) for bb in BREATH),
                                 BREATH_MS)]
    tourist = dict(legs="skin2", shoes="sky")
    yield "photo-op", [("idle", frames(big(dressed, tourist_top(False), bob=bb, **tourist) for bb in BREATH), BREATH_MS),
                       ("flash", frames(big(dressed, tourist_top(f), **tourist) for f in (True, False)), 120)]
    yield "fx-bark", [("pop", frames([bark(False), bark(True)]), 120)]
    # the cat blinks once a loop, briefly, as its tail swings home; the loop keeps its 1040ms
    yield "gag-cat", [("idle", frames([cat(0), cat(1), cat(2), cat(3, blink=True)]), [300, 300, 300, 140]),
                      ("react", frames([cat(1, alert=True), cat(2, alert=True)]), 200)]
    yield "gag-sprinkler", [("spray", frames(sprinkler(i) for i in range(4)), 140)]
    yield "gag-ball", [("roll", frames(ball(i) for i in range(4)), 90)]
    # the sheen crosses the sign's top-left half, lit side, then the sign rests for two frames
    yield "stop-sign", [("idle", frames(big(stop_sign, c) for c in (None, None, 18, 24)), 400)]
    chatty = dict(legs="brown", shoes="dbrown")
    yield "chatty-neighbour", [("wave", frames(big(dressed, chatty_top(w), **chatty) for w in (False, True)), 350),
                               ("idle", frames(big(dressed, chatty_top(False), bob=bb, **chatty) for bb in BREATH),
                                BREATH_MS)]
    yield "kid", [("wave", frames([big(kid, False), big(kid, True)]), 300), ("sad", frames([big(kid, False, "sad")]), 1000),
                  ("idle", frames(big(kid, bob=bb) for bb in BREATH), BREATH_MS)]
    yield "ice-cream-truck", [("idle", frames([ice_cream_truck(0), ice_cream_truck(1)]), 400)]
    yield "construction", [("idle", frames([construction(0), construction(1)]), 500)]
    yield "mail-carrier", [("walk", frames([big(mail_carrier, lf=-2), big(mail_carrier, rf=-2)]), 200),
                           ("idle", frames(big(mail_carrier, bob=bb) for bb in BREATH), BREATH_MS)]


if __name__ == "__main__":
    # minis swaps the grid of the module named road, so the build runs that module's functions, not __main__'s
    import road
    main(sys.argv, road.sprites, "art/road", __doc__)
