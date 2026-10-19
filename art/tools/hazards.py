#!/usr/bin/env python3
"""Draw the moving hazards: things that cross the road or come down it, and the
warning cue shown at the lane edge about a second before one enters.

squirrel-dash       32x32   side view facing right, run (4 frames, 80ms): a bounding gallop, tail streaming
loose-dog           32x32   the corgi from other-dog in side view facing right, no owner, a broken leash
                            trailing; run (4 frames, 100ms)
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
squirrel-dash@75, loose-dog@75 (24x24), squirrel-dash@50, loose-dog@50 (16x16) and
ball-bounce@75, ball-bounce@50 (12x18, 8x12). The cyclist's features are 2px or wider, so it scales at runtime.

Usage:
  hazards.py preview OUT.png   every frame on the four road colours
  hazards.py build             write art/hazards/*.aseprite, export to
                               public/art/sprites/ and list them in the manifest

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import K, ROADS, Grid, edged, main, road_sprite  # noqa: E402
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

# A corgi's short-legged gallop, one dict per frame: body bob, the near front and hind paws' offsets
# (dx, dy; negative dy lifts the paw), the leash end's sway and the stub tail's flick. The far legs
# take the next frame's paws, a beat behind the near ones.
CORGI_RUN = [
    dict(bob=0, front=(2, 0), hind=(-2, 0), leash=0, tail=0),      # stretched out, all four paws down
    dict(bob=-1, front=(2, -2), hind=(-2, -2), leash=1, tail=-1),  # flight
    dict(bob=0, front=(-1, 0), hind=(1, 0), leash=2, tail=0),      # gathered, legs under
    dict(bob=-1, front=(1, -2), hind=(-1, 0), leash=1, tail=1),    # hind pushing off, front reaching
]


def limb(g, x0, y0, x1, y1, w, c):
    """A leg w pixels wide from (x0, y0) down to (x1, y1), one row at a time."""
    n = max(1, round(y1 - y0))
    for k in range(n + 1):
        g.rect(round(x0 + (x1 - x0) * k / n), y0 + k, w, 1, c)


def corgi_side(bob=0, front=(0, 0), hind=(0, 0), leash=0, tail=0, far=None, new=Grid):
    """far holds the far legs' front and hind paws; new makes the grid, as for squirrel_dash."""
    g = edged(new())
    b = bob
    far = far or dict(front=front, hind=hind)
    # far legs: a shade darker, a beat behind the near ones
    for x, (dx, dy) in ((10, far["hind"]), (21, far["front"])):
        limb(g, x, 22 + b, x + dx, 26 + dy, 2, "rust")
        g.rect(x + dx, 26 + dy, 2, 2, "lgrey")
    # the broken leash: from the collar, back over the shoulders and streaming behind, frayed at the end
    pts = [(20, 13), (16, 10), (11, 10), (6, 11 + leash), (2, 12 + leash)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for k in range(n + 1):
            g.p(round(x0 + (x1 - x0) * k / n), round(y0 + (y1 - y0) * k / n + b), "red")
    g.p(1, 11 + leash + b, "red")
    g.p(1, 13 + leash + b, "red")
    # stub tail: a fluffy tuft at the rump
    g.ell(4.5, 16 + b + tail, 2.5, 2, "ochre", "rust", "tan")
    # body: long and low, white underneath
    g.ell(14, 19 + b, 9.5, 5, "ochre", "rust", "tan")
    g.ell(15, 22 + b, 7, 2, "white", "lgrey")
    # chest ruff
    g.ell(21, 19 + b, 3, 3.5, "white", "lgrey")
    # near legs: short, ochre with white socks
    for x, (dx, dy) in ((7, hind), (18, front)):
        limb(g, x, 22 + b, x + dx, 26 + dy, 3, "ochre")
        g.rect(x + dx, 26 + dy, 3, 2, "white")
        g.p(x + dx + 2, 27 + dy, "lgrey")
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
CORGI_OFFSETS = ("bob", "front", "hind", "leash", "tail")


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    def corgi_frames(s=None):
        out = []
        for i, q in enumerate(CORGI_RUN):
            far = CORGI_RUN[(i + 1) % 4]
            if s:
                q, far = small(s, q, CORGI_OFFSETS), small(s, far, CORGI_OFFSETS)
            out.append(corgi_side(**dict(q, far=far)).outlined())
        return out

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


if __name__ == "__main__":
    main(sys.argv, sprites, "art/hazards", __doc__, grounds=ROADS, anchored=road_sprite)
