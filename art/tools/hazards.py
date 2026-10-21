#!/usr/bin/env python3
"""Draw the moving hazards: things that cross the road or come down it, and the
warning cue shown at the lane edge about a second before one enters.

squirrel-dash       48x48   side view facing right, run (4 frames, 80ms): a bounding gallop, tail streaming
loose-dog           48x48   the corgi from other-dog in side view facing right, no owner; run (4 frames,
                            100ms): a gallop, gathered, reaching, airborne and landing, the broken leash
                            trailing up off the back, frayed, a 1px wave travelling down it
ball-bounce         24x36   a ball bouncing across lanes; bounce (6 frames, 70ms), squashed on
                            contact, with its own ground shadow (the game draws none)
cyclist             48x72   front view, riding down a lane at the player; ride (4 frames, 90ms): pedalling
                            legs and a 1px sway
ui-warning          16x16   a yellow warning sign with a bold "!", ink outline; pulse (2 frames, 250ms)
ui-warning-arrow    16x16   a yellow arrow, ink outline; pulse (2 frames, 250ms) points right for a
                            crosser, down-pulse (2 frames, 250ms) points down the road for a mover
                            about to come at the pack, up-pulse (2 frames, 250ms) points up the road
                            for one about to move off ahead; each nudges 1px its way on frame 2
ui-warning-wander   16x16   a bold yellow "?", ink outline, over a wanderer before each step; pulse
                            (2 frames, 250ms) pops it 1px up on frame 2

The side views face right; the game mirrors squirrel-dash, loose-dog and
ui-warning-arrow for a crossing to the left. Every road sprite takes the road
outline rule (pixel.road_edge), so its silhouette holds 3:1 on the three light
roads and its fill carries Elm Avenue. The warning cues are outlined in ink.

The road sprites are laid out on 32x32 (the cyclist 32x48) and drawn
road.SCALE (1.5) times bigger on a minis.Mini, which keeps 1px lines 1px;
the ball is drawn at each size from BALL. Depth variants, redrawn at their own
size with a full outline (see minis.py): squirrel-dash@75, loose-dog@75 (36x36),
squirrel-dash@50, loose-dog@50 (24x24), ball-bounce@75, ball-bounce@50 (18x27,
12x18) and cyclist@75, cyclist@50 (36x54, 24x36), each on a Mini at SCALE
times the step; depths.py draws the steps between them.

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
import minis  # noqa: E402
from minis import SCALES, Mini, scaled  # noqa: E402
from road import SCALE, face_disc, face_front, lean  # noqa: E402


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
    g.cel(9.5 + tx / 2, 15 + dy + ty / 2, 3.5, 3.5, "ochre", "rust")
    g.cel(7 + tx, 9 + dy + ty, 4.8, 5.5, "ochre", "rust", "tan")
    g.cel(7.5 + tx, 10 + dy + ty, 2.5, 3.5, "tan")
    g.cel(10.5 + tx, 4.5 + dy + ty, 3.5, 2.5, "ochre", "rust", "tan")
    # hind leg: haunch, then a long foot
    hx, hy = hind
    for k in range(6):
        t = k / 5
        g.rect(round(11 + (hx - 11) * t), round(21 + dy + (hy - 21 - dy) * t), 2, 2, "ochre")
    g.rect(hx, hy, 3, 2, "ochre")
    g.rect(hx, hy + 1, 3, 1, "rust")
    # body
    g.cel(15, 20 + dy, 6.5 + st, 4.5, "ochre", "rust", "tan")
    g.cel(11, 20 + dy, 3.5, 4, "ochre", "rust", "tan")
    g.cel(16.5, 22.5 + dy, 3.5, 1.5, "cream")
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
    g.cel(24, 15.5 + dy, 5, 4.5, "ochre", "rust", "tan")
    g.cel(25.5, 18 + dy, 3, 1.5, "cream")
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
    # the leash is 1px wide and unbroken at any scale: its points are placed on the drawn grid and joined there
    w1, w2, w3 = leash
    sc, px = getattr(g, "s", 1), getattr(g, "g", g)
    pts = [(math.floor((x + 0.5) * sc), math.floor((y + b + 0.5) * sc))
           for x, y in ((19, 13), (15, 7), (10, 5 + w1), (6, 4 + w2), (3, 5 + w3))]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for k in range(n + 1):
            px.p(round(x0 + (x1 - x0) * k / n), round(y0 + (y1 - y0) * k / n), "red")
    ex, ey = pts[-1]
    px.p(ex - 1, ey - 1, "red")
    px.p(ex - 1, ey + 1, "red")
    # stub tail: a fluffy tuft at the rump
    g.cel(4.5, 16 + b, 2.5, 2, "ochre", "rust", "tan")
    # body: long and low, white underneath
    g.cel(14, 19 + b, 9.5, 5, "ochre", "rust", "tan")
    g.cel(15, 22 + b, 7, 2, "white", "lgrey")
    # chest ruff
    g.cel(21, 19 + b, 3, 3.5, "white", "lgrey")
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
    g.cel(23.5, 12.5 + b, 5, 4.5, "ochre", "rust", "tan")
    g.cel(27, 14.5 + b, 3, 2, "white", "lgrey")
    g.rect(29, 13 + b, 1, 2, "ink")
    g.p(28, 13 + b, "ink")
    g.rect(24, 11 + b, 2, 2, "ink")
    g.p(24, 11 + b, "white")
    g.p(27, 16 + b, "dbrown")
    # collar, with the snapped leash clip
    g.rect(19, 13 + b, 2, 5, "amber")
    g.p(20, 13 + b, "yellow")
    return g


# ---------- ball-bounce: a ball, bouncing ----------

# The bounce, laid out for the 28x42 ball and scaled to each step's frame, floor(24x36 x step + 0.5): the ground
# row (the ball's outline touches it on contact, and the shadow is centred on it); the ball's bottom height per
# frame; its radii when squashed on contact, stretched near the ground and round at the top of the arc; the
# stripes' width, spacing and step per frame (whole cycles over the 6 frames, so the loop has no jump); and the
# shadow's width per frame.
BALL_LAYOUT = dict(size=(28, 42), ground=40, heights=(0, 11, 15, 17, 15, 11), squash=(10.4, 7), stretch=(7, 10.4),
                   round=(9, 9), shadow=(21, 17, 14, 11, 14, 17))
BALL_SIZE = (24, 36)


def ball_steps():
    """{step: the bounce's layout at that depth step} for the full size and each of minis.STEPS."""
    out = {}
    for s in (1, *(v for _, v in minis.STEPS)):
        w, h = (math.floor(v * s + 0.5) for v in BALL_SIZE)
        k = w / BALL_LAYOUT["size"][0]
        out[s] = dict(size=(w, h), ground=h - 2,
                      heights=tuple(round(v * k) for v in BALL_LAYOUT["heights"]),
                      squash=tuple(v * k for v in BALL_LAYOUT["squash"]),
                      stretch=tuple(v * k for v in BALL_LAYOUT["stretch"]),
                      round=tuple(v * k for v in BALL_LAYOUT["round"]),
                      stripes=(3, 9, 3) if w >= 24 else (2, 6, 2),
                      shadow=tuple(max(3, round(v * k)) for v in BALL_LAYOUT["shadow"]))
    return out


BALL = ball_steps()


def ball_bounce(f, s=1):
    """Frame f of the bounce at scale s: squashed on contact (f == 0), stretched on the frames either side
    of it, round at the top. It is white with two red stripes rolling across, so it reads on the dark Elm
    Avenue road as well as the light ones."""
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
    if s >= 0.875:
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


def cyclist(lf=36, rf=41):
    """The rider facing the player, laid out on 32x48; cyclist_at draws it at size and adds the sway."""
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
    face_disc(g, 16, 13.5, 7.5, 6.5, "skin1", "skin2")
    face_front(g, 16, 13)
    g.cel(16, 7.5, 9, 5, "cyan", "sky", "white")
    g.rect(7, 10, 18, 2, "cyan")
    g.rect(22, 10, 3, 2, "sky")
    g.rect(8, 12, 16, 1, "ink")
    for x in (12, 16, 20):
        g.rect(x - 1 if x == 16 else x, 4, 2, 3, "navy")
    g.rect(8, 13, 1, 5, "dslate")
    g.rect(23, 13, 1, 5, "dslate")
    return g


def sway_rows(g, k, bottom):
    """Shift rows above bottom k pixels sideways: the rider leans over the bars, which stay put."""
    if k:
        for y in range(bottom):
            row = g.px[y]
            g.px[y] = [row[x - k] if 0 <= x - k < g.w else None for x in range(g.w)]


def cyclist_at(s, lf=36, rf=41, sway=0):
    """cyclist on a Mini at SCALE x step s. At full size the rider leans (road.lean shears about the feet);
    smaller, the rows above the handlebar shift sideways, which keeps the bars and wheel put."""
    g = minis.small(sys.modules[__name__], SCALE * s, cyclist, lf=lf, rf=rf)
    if s == 1:
        return edged(lean(g, sway)) if sway else g.g
    g = g.g
    sway_rows(g, sway, scaled(26, SCALE * s))
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


def warning_arrow(shift, down=False, up=False):
    """A yellow arrow pointing right, down when down is true or up when up is; shift nudges it along its
    direction on the pulse frame. The down arrow is the right one transposed, so its shading lands on the
    right, and the up arrow is the down one flipped."""
    g = edged(Grid(16, 16), ink)
    s = shift
    g.rect(1 + s, 6, 6, 4, "yellow")
    g.tri((6.5 + s, 1.5), (6.5 + s, 14.5), (13.5 + s, 8), "yellow")
    g.rect(1 + s, 9, 6, 1, "amber")
    for x in range(16):
        for y in (12, 13):
            if g.px[y][x] == K["yellow"] and not (y + 1 < 16 and g.px[y + 1][x]):
                g.p(x, y, "amber")
    if down or up:
        g.px = [list(col) for col in zip(*g.px)]
    if up:
        g.px = g.px[::-1]
    return g


# The "?": (x, y, w, h) rects on the 16x16 frame, the hook from its top bar round to the stem, then the dot.
QUERY = ((5, 2, 6, 3), (4, 3, 2, 3), (10, 3, 3, 5), (8, 7, 3, 2), (7, 8, 3, 3), (7, 12, 3, 3))


def warning_wander(lift):
    """A bold yellow "?" in the warning cues' style, ink outlined, amber along each part's bottom; lift raises
    it on the pulse frame."""
    g = edged(Grid(16, 16), ink)
    for x, y, w, h in QUERY:
        g.rect(x, y - lift, w, h, "yellow")
    for x, y in ((12, 3 - lift), (4, 3 - lift)):
        g.p(x, y, None)
    for x in range(16):
        for y in range(15):
            if g.px[y][x] == K["yellow"] and not g.px[y + 1][x]:
                g.p(x, y, "amber")
    return g


def snap(v, s):
    """An offset in full-size pixels that moves whole pixels at scale s, at least one if it moves at all."""
    return math.copysign(max(1, math.floor(abs(v) * s)), v) / s if v else 0


def small(s, q, offsets):
    """Pose q at depth step s (1 for the full size): drawn on a Mini at SCALE x s, its offset keys
    snapped to whole pixels there."""
    p = SCALE * s

    def fit(v):
        return tuple(snap(x, p) for x in v) if isinstance(v, tuple) else snap(v, p)

    q = {k: fit(v) if k in offsets else v for k, v in q.items()}
    return dict(q, new=lambda w=32, h=32: Mini(p, w, h))


# the squirrel's tail sway is left unsnapped: snapped, it would push the plume out of the 16px frame
SQUIRREL_OFFSETS = ("dy",)
CORGI_OFFSETS = ("bob", "leash")


def steps(suffix, s):
    """Yield (key + suffix, tags) for the road hazards at depth step s; depths.py draws the steps between
    SCALES with this too."""
    yield f"squirrel-dash{suffix}", [("run", [squirrel_dash(**small(s, q, SQUIRREL_OFFSETS)).outlined()
                                              for q in SQUIRREL_RUN], 80)]
    yield f"loose-dog{suffix}", [("run", [corgi_side(**small(s, q, CORGI_OFFSETS)).outlined() for q in CORGI_RUN],
                                  100)]
    yield f"ball-bounce{suffix}", [("bounce", [ball_bounce(f, s) for f in range(6)], 70)]
    yield f"cyclist{suffix}", [("ride", [cyclist_at(s, **q).outlined() for q in CYCLIST_RIDE], 90)]


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    yield from steps("", 1)
    yield "ui-warning", [("pulse", [warning(False).outlined(), warning(True).outlined()], 250)]
    yield "ui-warning-arrow", [("pulse", [warning_arrow(0).outlined(), warning_arrow(1).outlined()], 250),
                               ("down-pulse", [warning_arrow(0, True).outlined(),
                                               warning_arrow(1, True).outlined()], 250),
                               ("up-pulse", [warning_arrow(0, up=True).outlined(),
                                             warning_arrow(1, up=True).outlined()], 250)]
    yield "ui-warning-wander", [("pulse", [warning_wander(0).outlined(), warning_wander(1).outlined()], 250)]
    for suffix, s in SCALES:
        yield from steps(f"@{suffix}", s)


if __name__ == "__main__":
    main(sys.argv, sprites, "art/hazards", __doc__, grounds=ROADS)
