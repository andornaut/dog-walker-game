#!/usr/bin/env python3
"""Draw the moving hazards: things that cross the road or come down it, and the
warning cue shown at the lane edge about a second before one enters.

squirrel-dash       32x32   side view facing right, run (4 frames, 80ms): a bounding gallop, tail streaming
loose-dog           32x32   the corgi from other-dog in side view facing right, no owner; run (4 frames,
                            100ms): a gallop, gathered, reaching, airborne and landing, the broken leash
                            trailing up off the back, frayed, a 1px wave travelling down it
ball-bounce         16x24   the gag-ball ball bouncing across lanes; bounce (6 frames, 70ms), squashed on
                            contact, with its own ground shadow (the game draws none)
cyclist             32x48   front view, riding down a lane at the player; ride (4 frames, 90ms): pedalling
                            legs and a 1px sway
ui-warning          16x16   a yellow warning sign with a bold "!", ink outline; pulse (2 frames, 250ms)
ui-warning-arrow    16x16   a yellow arrow, ink outline; pulse (2 frames, 250ms) points right for a
                            crosser, down-pulse (2 frames, 250ms) points down the lane at the player

The side views face right; the game mirrors squirrel-dash, loose-dog and
ui-warning-arrow for a crossing to the left. Every road sprite takes the road
outline rule (pixel.road_edge), so its silhouette holds 3:1 on the three light
roads and its fill carries Woof Way. The warning cues are outlined in ink.

Depth variants, redrawn at their own size with a full outline (see minis.py):
squirrel-dash@75, loose-dog@75 (24x24), squirrel-dash@50, loose-dog@50 (16x16),
ball-bounce@75, ball-bounce@50 (12x18, 8x12) and cyclist@75, cyclist@50 (24x36, 16x24),
the cyclist drawn by hand at each size so its face and the turning crank stay readable.

Usage:
  hazards.py preview OUT.png   every frame on the four road colours
  hazards.py build             write art/hazards/*.aseprite and export to
                               public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import K, ROADS, Grid, edged, main  # noqa: E402
from minis import SCALES, Mini  # noqa: E402
from road import face_front, lean  # noqa: E402


# ---------- squirrel-dash: side view, facing right ----------

# A bounding gallop, one dict per frame: body lift, body stretch, front and hind paw positions
# (x, y of the paw's top-left pixel) and the tail tip's offset as it streams.
SQUIRREL_RUN = [
    dict(dy=0, st=-1, front=(18, 26), hind=(13, 26), tail=(0, 0)),     # gathered: all four paws under
    dict(dy=-1, st=1, front=(25, 23), hind=(7, 26), tail=(-1, 1)),     # hind push off, front reaching
    dict(dy=-2, st=1, front=(26, 24), hind=(3, 22), tail=(-1, 2)),     # flight, stretched out
    dict(dy=-1, st=0, front=(23, 26), hind=(9, 23), tail=(0, 1)),      # front paws land, hind swing in
]


def squirrel_dash(dy=0, st=0, front=(18, 26), hind=(13, 26), tail=(0, 0), new=Grid):
    """new makes the grid: a Grid at full size, or a minis.Mini for a depth variant."""
    g = edged(new())
    tx, ty = tail
    # far legs: a shade darker, a step behind the near ones
    g.rect(hind[0] + 2, hind[1] - 1, 3, 2, "rust")
    g.rect(front[0] - 2, front[1] - 1, 2, 2, "rust")
    # tail: a big plume streaming back and up from the rump, its tip curling over
    g.ell(9.5 + tx / 2, 15 + dy + ty / 2, 3.5, 3.5, "ochre", "rust")
    g.ell(7 + tx, 9 + dy + ty, 4.8, 5.5, "ochre", "rust", "tan")
    g.ell(7.5 + tx, 10 + dy + ty, 2.5, 3.5, "tan")
    g.ell(10.5 + tx, 4.5 + dy + ty, 3.5, 2.5, "ochre", "rust", "tan")
    # hind leg: haunch, then a long foot
    hx, hy = hind
    for k in range(6):
        t = k / 5
        g.rect(round(11 + (hx - 11) * t), round(21 + dy + (hy - 21 - dy) * t), 2, 2, "ochre")
    g.rect(hx, hy, 3, 2, "ochre")
    g.rect(hx, hy + 1, 3, 1, "rust")
    # body
    g.ell(15, 20 + dy, 6.5 + st, 4.5, "ochre", "rust", "tan")
    g.ell(11, 20 + dy, 3.5, 4, "ochre", "rust", "tan")
    g.ell(16.5, 22.5 + dy, 3.5, 1.5, "cream")
    # front leg: a thin arm from the chest to the paw
    fx, fy = front
    for k in range(5):
        t = k / 4
        g.rect(round(20 + (fx - 20) * t), round(22 + dy + (fy - 22 - dy) * t), 2, 2, "ochre")
    g.rect(fx, fy, 2, 2, "ochre")
    g.p(fx + 1, fy + 1, "rust")
    # head: round, a cream cheek, a tufted ear, a big eye and a pink-plum nose
    g.tri((20, 12 + dy), (21.5, 7.5 + dy), (23.5, 11.5 + dy), "ochre")
    g.p(21, 10 + dy, "rust")
    g.ell(24, 15.5 + dy, 5, 4.5, "ochre", "rust", "tan")
    g.ell(25.5, 18 + dy, 3, 1.5, "cream")
    g.rect(25, 13 + dy, 2, 2, "ink")
    g.p(25, 13 + dy, "white")
    g.p(29, 15 + dy, "plum")
    return g


# ---------- loose-dog: the other dog's corgi, side view, facing right ----------

# A corgi's gallop, one dict per frame, read like SQUIRREL_RUN: body lift, the near front and hind paws'
# top-left pixels, and the broken leash's wave, a 1px offset for each of its three trailing points. The
# wave travels down the leash 1px a frame. The far legs follow the near ones 2px further forward.
CORGI_RUN = [
    dict(bob=0, front=(16, 27), hind=(9, 27), leash=(0, 1, 0)),      # gathered: all four paws under
    dict(bob=-1, front=(23, 25), hind=(3, 27), leash=(1, 0, -1)),    # hind push off, front reaching
    dict(bob=-2, front=(25, 23), hind=(1, 24), leash=(0, -1, 0)),    # airborne, stretched out
    dict(bob=-1, front=(20, 27), hind=(6, 25), leash=(-1, 0, 1)),    # front paws land, hind swing in
]


def limb(g, x0, y0, x1, y1, w, c):
    """A leg w pixels wide and 2 tall per step, from the shoulder or hip (x0, y0) to the paw (x1, y1)."""
    n = max(1, round(max(abs(x1 - x0), abs(y1 - y0))))
    for k in range(n + 1):
        g.rect(round(x0 + (x1 - x0) * k / n), round(y0 + (y1 - y0) * k / n), w, 2, c)


def corgi_side(bob=0, front=(14, 27), hind=(11, 27), leash=(0, 0, 0), new=Grid):
    """new makes the grid, as for squirrel_dash. The dog sits 1px lower than bob says, so the ear tips keep
    their outline in flight."""
    g = edged(new())
    b = bob + 1
    # far legs: a shade darker, 2px further forward than the near ones
    for (x, y), (px, py) in (((10, 21 + b), hind), ((20, 21 + b), front)):
        limb(g, x, y, px + 3, py - 1, 2, "rust")
        g.rect(px + 3, py, 2, 2, "lgrey")
    # the broken leash: up off the collar and trailing well clear of the back, waving, frayed at the end
    w1, w2, w3 = leash
    pts = [(19, 13), (15, 7), (10, 5 + w1), (6, 4 + w2), (3, 5 + w3)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for k in range(round(n) + 1):
            g.p(round(x0 + (x1 - x0) * k / n), round(y0 + (y1 - y0) * k / n + b), "red")
    ex, ey = pts[-1]
    g.p(ex - 1, ey - 1 + b, "red")
    g.p(ex - 1, ey + 1 + b, "red")
    # stub tail: a fluffy tuft at the rump
    g.ell(4.5, 16 + b, 2.5, 2, "ochre", "rust", "tan")
    # body: long and low, white underneath
    g.ell(14, 19 + b, 9.5, 5, "ochre", "rust", "tan")
    g.ell(15, 22 + b, 7, 2, "white", "lgrey")
    # chest ruff
    g.ell(21, 19 + b, 3, 3.5, "white", "lgrey")
    # near legs: short, ochre with white socks
    for (x, y), (px, py) in (((7, 21 + b), hind), ((18, 21 + b), front)):
        limb(g, x, y, px, py - 1, 3, "ochre")
        g.rect(px, py, 3, 2, "white")
        g.p(px + 2, py + 1, "lgrey")
    # head: fox face, big upright ears with pink insides, white blaze and muzzle
    g.tri((19.5, 9 + b), (20.5, 2 + b), (24, 7.5 + b), "ochre")
    g.tri((24, 8 + b), (26.5, 2 + b), (28, 9 + b), "ochre")
    g.tri((21, 8 + b), (21, 4.5 + b), (23, 7.5 + b), "pink")
    g.tri((25.5, 7 + b), (26.5, 4 + b), (27, 7.5 + b), "pink")
    g.ell(23.5, 12.5 + b, 5, 4.5, "ochre", "rust", "tan")
    g.ell(27, 14.5 + b, 3, 2, "white", "lgrey")
    g.rect(29, 13 + b, 1, 2, "ink")
    g.p(28, 13 + b, "ink")
    g.rect(24, 11 + b, 2, 2, "ink")
    g.p(24, 11 + b, "white")
    g.p(27, 16 + b, "dbrown")
    # collar, with the snapped leash clip
    g.rect(19, 13 + b, 2, 5, "amber")
    g.p(20, 13 + b, "yellow")
    return g


# ---------- ball-bounce: the gag-ball ball, bouncing ----------

# The bounce at each size: frame size; the ground row (the ball's outline touches it on contact, and the
# shadow is centred on it); the ball's bottom height per frame; its radii when squashed on contact,
# stretched near the ground and round at the top of the arc; the stripes' width, spacing and step per
# frame (whole cycles over the 6 frames, so the loop has no jump); and the shadow's width per frame.
BALL = {
    1: dict(size=(16, 24), ground=22, heights=(0, 6, 9, 10, 9, 6), squash=(6, 4), stretch=(4, 6), round=(5, 5),
            stripes=(2, 6, 2), shadow=(12, 10, 8, 6, 8, 10)),
    0.75: dict(size=(12, 18), ground=16, heights=(0, 4, 6, 7, 6, 4), squash=(5, 3), stretch=(3, 5), round=(4, 4),
               stripes=(2, 4, 2), shadow=(10, 8, 6, 4, 6, 8)),
    0.5: dict(size=(8, 12), ground=11, heights=(0, 2, 3, 4, 3, 2), squash=(3.2, 2), stretch=(2, 3), round=(3, 3),
              stripes=(1, 3, 1), shadow=(6, 6, 4, 4, 4, 6)),
}


def ball_bounce(f, s=1):
    """Frame f of the bounce at scale s: squashed on contact (f == 0), stretched on the frames either side
    of it, round at the top. Unlike gag-ball it is white with two red stripes rolling across, so it reads
    on the dark Woof Way road as well as the light ones."""
    q = BALL[s]
    w, h = q["size"]
    up = q["heights"][f]
    rx, ry = q["squash"] if f == 0 else q["stretch"] if up < max(q["heights"]) - 2 else q["round"]
    g = edged(Grid(w, h))
    cx, cy = w / 2, q["ground"] - up - ry
    g.ell(cx, cy, rx, ry, "white", "lgrey")
    sw, gap, step = q["stripes"]
    left = round(cx - rx)
    for x in range(left - 2 * gap, w):
        if (x - left - f * step) % gap < sw:
            for y in range(h):
                if g.px[y][x]:
                    g.p(x, y, "dred" if g.px[y][x] == K["lgrey"] else "red")
    out = g.outlined()
    # the ground shadow: no outline, narrower as the ball rises; at 0.5 a single row
    sw = q["shadow"][f]
    rows = [(q["ground"], sw)] if s == 0.5 else [(q["ground"], sw), (q["ground"] + 1, sw - 2)]
    if s == 1:
        rows.append((q["ground"] - 1, sw - 2))
    for y, rw in rows:
        for x in range(round(w / 2 - rw / 2), round(w / 2 + rw / 2)):
            if 0 <= y < h and not out[y][x]:
                out[y][x] = K["navy"]
    return out


# ---------- cyclist: front view, riding down a lane at the player ----------

# Pedalling, one dict per frame: the left and right foot rows (the pedals go round) and the sway.
CYCLIST_RIDE = [
    dict(lf=36, rf=41, sway=-1),
    dict(lf=38, rf=39, sway=0),
    dict(lf=41, rf=36, sway=1),
    dict(lf=39, rf=38, sway=0),
]


def cyclist(lf=36, rf=41, sway=0):
    g = edged(Grid(32, 48))
    # front wheel: a tyre seen edge-on, with a mudguard and the fork
    g.blob(16, 39.5, 2.5, 7, "ink")
    g.rect(15, 35, 1, 9, "grey")
    g.rect(14, 33, 4, 2, "lgrey")
    g.rect(14, 34, 4, 1, "grey")
    g.rect(15, 29, 2, 4, "sky")
    g.rect(16, 29, 1, 4, "blue")
    # legs either side of the wheel: shorts, bare knees and shins, shoes on the pedals
    for x, foot in ((10, lf), (19, rf)):
        g.rect(x, 29, 3, 4, "navy")
        g.rect(x + 2, 29, 1, 4, "ink")
        g.rect(x, 33, 3, foot - 33, "skin1")
        g.rect(x + 2, 33, 1, foot - 33, "skin2")
        g.rect(x - 1 if x < 16 else x, foot, 4, 2, "white")
        g.rect(x - 1 if x < 16 else x, foot + 1, 4, 1, "lgrey")
        g.rect(x + (2 if x < 16 else -1), foot + 2, 2, 1, "grey")
    # jersey: bright lime with a white chest band, leaning over the bars
    g.rect(9, 20, 14, 10, "green")
    g.rect(20, 20, 3, 10, "dgreen")
    g.rect(9, 24, 14, 2, "white")
    g.rect(20, 24, 3, 2, "lgrey")
    g.p(9, 20, None)
    g.p(22, 20, None)
    # arms down to the grips
    for x in (5, 24):
        g.rect(x, 21, 3, 3, "green")
        g.rect(x, 24, 3, 3, "skin1")
        g.rect(x + 2, 24, 1, 3, "skin2")
    # handlebar across, grips under the hands
    g.rect(6, 27, 20, 2, "grey")
    g.rect(6, 27, 20, 1, "lgrey")
    for x in (4, 25):
        g.rect(x, 26, 3, 3, "ink")
        g.rect(x, 25, 3, 2, "skin1")
    # head: face, then a cyan helmet with vents and a dark visor
    g.ell(16, 13.5, 7.5, 6.5, "skin1", "skin2")
    face_front(g, 16, 13)
    g.ell(16, 7.5, 9, 5, "cyan", "sky", "white")
    g.rect(7, 10, 18, 2, "cyan")
    g.rect(22, 10, 3, 2, "sky")
    g.rect(8, 12, 16, 1, "ink")
    for x in (12, 16, 20):
        g.rect(x - 1 if x == 16 else x, 4, 2, 3, "navy")
    g.rect(8, 13, 1, 5, "dslate")
    g.rect(23, 13, 1, 5, "dslate")
    return edged(lean(g, sway)) if sway else g


# The cyclist at 0.75x and 0.5x, drawn at size: scaled, the face goes and the pedals barely move. Per frame,
# as CYCLIST_RIDE: the left and right foot rows, the sway of everything above the handlebar, and the row of
# the tread mark rolling down the tyre. A foot coming forward is drawn wider and white, one going back
# narrower and lgrey, so the four beats read as a turning crank.
CYCLIST_SMALL = {
    0.75: [dict(lf=26, rf=31, sway=-1, tread=26), dict(lf=29, rf=28, sway=0, tread=28),
           dict(lf=31, rf=26, sway=1, tread=30), dict(lf=28, rf=29, sway=0, tread=32)],
    0.5: [dict(lf=17, rf=21, sway=-1, tread=17), dict(lf=20, rf=18, sway=0, tread=19),
          dict(lf=21, rf=17, sway=1, tread=21), dict(lf=18, rf=20, sway=0, tread=17)],
}


def sway_rows(g, k, bottom):
    """Shift rows above bottom k pixels sideways: the rider leans over the bars, which stay put."""
    if k:
        for y in range(bottom):
            row = g.px[y]
            g.px[y] = [row[x - k] if 0 <= x - k < g.w else None for x in range(g.w)]


def cyclist_75(lf, rf, sway, tread):
    """cyclist at 24x36: a vented cyan helmet over a visor, a face with 2px eyes and a smile, the lime
    jersey with its white band, and a 4px tyre between the legs, lit grey on its left as road.LIT has it."""
    g = edged(Grid(24, 36))
    # tyre, mudguard and fork; the tread mark rolls down the tyre
    g.rect(11, 25, 2, 10, "ink")
    g.rect(10, 26, 4, 8, "ink")
    g.rect(10, 26, 1, 8, "grey")
    g.p(12, tread, "slate")
    g.p(12, tread + 1, "slate")
    g.rect(10, 24, 4, 1, "lgrey")
    g.rect(11, 22, 2, 2, "sky")
    g.p(12, 22, "blue")
    g.p(12, 23, "blue")
    # legs: shorts, shins, then the feet on the pedals
    for x, foot, fwd in ((7, lf, lf > rf), (15, rf, rf > lf)):
        g.rect(x, 22, 3, 2, "navy")
        g.p(x + 2, 22, "ink")
        g.p(x + 2, 23, "ink")
        g.rect(x, 24, 2, foot - 24, "skin1")
        g.rect(x + 1, 24, 1, foot - 24, "skin2")
        fx = x - 1 if x < 12 else x
        if fwd:
            g.rect(fx, foot, 3, 1, "white")
            g.rect(fx, foot + 1, 3, 1, "lgrey")
        else:
            g.rect(fx + (1 if x < 12 else 0), foot, 2, 2, "lgrey")
        g.rect(x if x < 12 else x, foot + 2, 2, 1, "grey")
    # handlebar and grips, which do not sway
    g.rect(4, 20, 16, 1, "lgrey")
    g.rect(4, 21, 16, 1, "grey")
    g.rect(2, 20, 3, 2, "ink")
    g.rect(19, 20, 3, 2, "ink")
    # jersey, arms and hands
    g.rect(6, 15, 12, 5, "green")
    g.rect(15, 15, 3, 5, "dgreen")
    g.rect(6, 17, 12, 2, "white")
    g.rect(15, 17, 3, 2, "lgrey")
    g.p(6, 15, None)
    g.p(17, 15, None)
    for x in (3, 18):
        g.rect(x, 15, 3, 3, "green" if x < 12 else "dgreen")
        g.rect(x, 18, 3, 2, "skin1")
        g.p(x + 2, 19, "skin2")
    # face: eyes with a glint, a smile, the chin narrower
    g.rect(6, 8, 12, 6, "skin1")
    g.rect(7, 14, 10, 1, "skin1")
    g.rect(16, 8, 2, 6, "skin2")
    g.p(16, 14, "skin2")
    for x in (8, 14):
        g.rect(x, 9, 2, 2, "ink")
        g.p(x, 9, "white")
    g.p(10, 12, "dbrown")
    g.p(13, 12, "dbrown")
    g.rect(11, 13, 2, 1, "dbrown")
    # helmet: a cyan dome, three vents, a sky right side, the dark visor under the brim
    g.rect(8, 1, 8, 1, "cyan")
    g.rect(6, 2, 12, 1, "cyan")
    g.rect(5, 3, 14, 4, "cyan")
    g.rect(16, 3, 3, 4, "sky")
    g.rect(15, 2, 3, 1, "sky")
    g.rect(7, 2, 2, 1, "white")
    g.p(6, 3, "white")
    for x, w in ((9, 1), (11, 2), (14, 1)):
        g.rect(x, 3, w, 2, "navy")
    g.rect(6, 7, 12, 1, "ink")
    sway_rows(g, sway, 20)
    return g


def cyclist_50(lf, rf, sway, tread):
    """cyclist at 16x24: helmet, visor, 1px eyes and mouth, jersey band, a 2px tyre between the legs."""
    g = edged(Grid(16, 24))
    g.rect(7, 17, 2, 6, "ink")
    g.rect(7, 17, 1, 5, "grey")
    g.p(8, tread, "slate")
    g.rect(7, 16, 2, 1, "lgrey")
    g.p(7, 15, "sky")
    g.p(8, 15, "blue")
    for x, foot, fwd in ((4, lf, lf > rf), (10, rf, rf > lf)):
        g.rect(x, 15, 2, 1, "navy")
        g.p(x + 1, 15, "ink")
        g.rect(x, 16, 2, foot - 16, "skin1")
        g.rect(x + 1, 16, 1, foot - 16, "skin2")
        fx = x - 1 if x < 8 else x
        if fwd:
            g.rect(fx, foot, 3, 1, "white")
        else:
            g.rect(x, foot, 2, 1, "lgrey")
        g.p(x + 1 if x < 8 else x, foot + 1, "grey")
    g.rect(3, 14, 10, 1, "lgrey")
    g.rect(1, 14, 3, 1, "ink")
    g.rect(12, 14, 3, 1, "ink")
    g.rect(4, 10, 8, 4, "green")
    g.rect(10, 10, 2, 4, "dgreen")
    g.rect(4, 12, 8, 1, "white")
    g.rect(10, 12, 2, 1, "lgrey")
    for x in (2, 12):
        g.rect(x, 10, 2, 3, "green" if x < 8 else "dgreen")
        g.rect(x, 13, 2, 1, "skin1")
    g.rect(4, 6, 8, 3, "skin1")
    g.rect(5, 9, 6, 1, "skin1")
    g.rect(11, 6, 1, 3, "skin2")
    g.p(10, 9, "skin2")
    g.p(6, 7, "ink")
    g.p(9, 7, "ink")
    g.rect(7, 8, 2, 1, "dbrown")
    g.rect(5, 1, 6, 1, "cyan")
    g.rect(4, 2, 8, 1, "cyan")
    g.rect(3, 3, 10, 2, "cyan")
    g.rect(11, 2, 2, 3, "sky")
    g.p(5, 1, "white")
    g.p(4, 2, "white")
    g.p(6, 2, "navy")
    g.p(9, 2, "navy")
    g.rect(4, 5, 8, 1, "ink")
    sway_rows(g, sway, 14)
    return g


# ---------- the warning cue (UI, ink outlined) ----------

def ink(c):
    return K["ink"]


def warning(big):
    """A yellow warning triangle with a bold "!", built row by row; big is the pulse frame, 1px larger
    all round."""
    g = edged(Grid(16, 16), ink)
    top, bottom, slope = (2, 14, 0.55) if big else (3, 13, 0.5)
    for y in range(top, bottom + 1):
        hw = int(1 + (y - top) * slope)
        g.rect(8 - hw, y, 2 * hw, 1, "amber" if y == bottom else "yellow")
    g.rect(7, 5, 2, 5, "ink")
    g.rect(7, 11, 2, 2, "ink")
    return g


def warning_arrow(shift, down=False):
    """A yellow arrow pointing right, or down when down is true; shift nudges it along its direction on
    the pulse frame. The down arrow is the right one transposed, so its shading lands on the right."""
    g = edged(Grid(16, 16), ink)
    s = shift
    g.rect(1 + s, 6, 6, 4, "yellow")
    g.tri((6.5 + s, 1.5), (6.5 + s, 14.5), (13.5 + s, 8), "yellow")
    g.rect(1 + s, 9, 6, 1, "amber")
    for x in range(16):
        for y in (12, 13):
            if g.px[y][x] == K["yellow"] and not (y + 1 < 16 and g.px[y + 1][x]):
                g.p(x, y, "amber")
    if down:
        g.px = [list(col) for col in zip(*g.px)]
    return g


def snap(v, s):
    """An offset in full-size pixels that moves whole pixels at scale s, at least one if it moves at all."""
    return math.copysign(max(1, math.floor(abs(v) * s)), v) / s if v else 0


def small(s, q, offsets):
    """Pose q for a depth variant at scale s: its offset keys snapped to whole pixels, and a Mini grid."""
    def fit(v):
        return tuple(snap(x, s) for x in v) if isinstance(v, tuple) else snap(v, s)

    q = {k: fit(v) if k in offsets else v for k, v in q.items()}
    return dict(q, new=lambda w=32, h=32: Mini(s, w, h))


# the squirrel's tail sway is left unsnapped: snapped, it would push the plume out of the 16px frame
SQUIRREL_OFFSETS = ("dy",)
CORGI_OFFSETS = ("bob", "leash")


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    def corgi_frames(s=None):
        return [corgi_side(**(small(s, q, CORGI_OFFSETS) if s else q)).outlined() for q in CORGI_RUN]

    yield "squirrel-dash", [("run", [squirrel_dash(**q).outlined() for q in SQUIRREL_RUN], 80)]
    yield "loose-dog", [("run", corgi_frames(), 100)]
    yield "ball-bounce", [("bounce", [ball_bounce(f) for f in range(6)], 70)]
    yield "cyclist", [("ride", [cyclist(**q).outlined() for q in CYCLIST_RIDE], 90)]
    yield "ui-warning", [("pulse", [warning(False).outlined(), warning(True).outlined()], 250)]
    yield "ui-warning-arrow", [("pulse", [warning_arrow(0).outlined(), warning_arrow(1).outlined()], 250),
                               ("down-pulse", [warning_arrow(0, True).outlined(),
                                               warning_arrow(1, True).outlined()], 250)]
    for suffix, s in SCALES:
        yield f"squirrel-dash@{suffix}", [("run", [squirrel_dash(**small(s, q, SQUIRREL_OFFSETS)).outlined()
                                                   for q in SQUIRREL_RUN], 80)]
        yield f"loose-dog@{suffix}", [("run", corgi_frames(s), 100)]
        yield f"ball-bounce@{suffix}", [("bounce", [ball_bounce(f, s) for f in range(6)], 70)]
        draw = cyclist_75 if s == 0.75 else cyclist_50
        yield f"cyclist@{suffix}", [("ride", [draw(**q).outlined() for q in CYCLIST_SMALL[s]], 90)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/hazards", __doc__, grounds=ROADS)
