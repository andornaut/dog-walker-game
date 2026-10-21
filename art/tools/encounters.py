#!/usr/bin/env python3
"""Draw the zone encounters on the road: the goose and the café patio. Each is a billboard
like the minor obstacles (obstacles.py): a front elevation (the goose a side
view), squat, its base on the last opaque row, 64n-8 px wide for n lanes.

goose               48x48   1 lane, a mover: a white goose, wings up, neck stretched, beak open
                            mid-honk; side view facing right, the game mirrors it for left.
                            run (4 frames, 110ms): a waddle, the feet swap and the body bobs 1px on
                            the passing frames, the wings flap 1px; idle (4 frames, 300ms): the honk,
                            the neck thrust 1px forward with the beak wide, then the beak shut
cafe-patio          112x60  2 lanes, a striped awning on two poles over two bistro tables and two
                            cooing patrons, a toppled cup with a foam heart in its spill on the left
                            table and a cup on a saucer on the right; idle (4 frames, 350ms): a steam
                            curl rises off the cup 1px a frame

The drawings are in the 32px units of a 32x32 road sprite: the sprites draw them on a minis.Mini
at BIG (1.5x, road.SCALE), a 2-lane one TWO_LANES units wide, so 32 units are 48px and a 2-lane
encounter is 112px wide. A 1px line stays 1px and motion moves whole pixels. Every encounter also has
<key>@<step> for each depth step in minis.STEPS (from shared/depth-steps.json), redrawn the same
way at BIG x the step, floor(size x scale + 0.5), with the original's tags, frames and durations
and a full outline.

All take the road outline rule (pixel.road_edge) and road.LIT's rim on their dark colours,
so the silhouette holds 3:1 on every road. The drawing functions take new, the grid maker
(Grid for the 32-unit size, or mini(s)).

Usage:
  encounters.py preview OUT.png   every frame on the road colours
  encounters.py build             write art/encounters/*.aseprite and export to
                                  public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import road  # noqa: E402
from minis import STEPS, Mini  # noqa: E402
from pixel import ROADS, Grid, edged, main  # noqa: E402
from road import LIT  # noqa: E402

# The drawings are in the 32px units of the old road sprites; the sprites draw them BIG times larger (48px
# for a 32px unit frame), and a 2-lane one TWO_LANES units wide, so it is 112px (64n-16 for n lanes).
BIG = road.SCALE
TWO_LANES = (64 * 2 - 16) / BIG

# Every road the encounters stand on, for the preview: the four in pixel.ROADS, then Willow Crescent
# and Riverside Path.
GROUNDS = (*ROADS, "8b9bb4", "ead4aa")


def mini(s):
    """A grid maker for a depth variant at scale s."""
    return lambda w=32, h=32: Mini(s, w, h)


def lit(g):
    """road.rim with road.LIT on the grid that holds the pixels, so a Mini gets the rim at its own size."""
    road.rim(getattr(g, "g", g), LIT)
    return g


def heart(g, x, y, col, shade):
    """A 5x4 heart from (x, y)."""
    g.rect(x, y, 2, 2, col)
    g.rect(x + 3, y, 2, 2, col)
    g.rect(x, y + 1, 5, 1, col)
    g.rect(x + 1, y + 2, 3, 1, col)
    g.p(x + 2, y + 3, col)
    g.p(x + 4, y + 1, shade)
    g.p(x + 3, y + 2, shade)


# ---------- goose ----------

def goose(fa=0, fb=0, bob=0, flap=0, beak=1, thrust=0, new=Grid):
    """Side view facing right. fa and fb move the near and far feet along the ground, bob lifts the body
    (negative is up), flap lifts the wing tips, beak opens it (0 shut, 1 open, 2 wide) and thrust pushes
    the head forward. The white takes the road outline; the orange beak and feet carry it on every road."""
    g = edged(new())
    b, f, t = bob, flap, thrust
    # legs and webbed feet, the far one a shade darker; the foot swinging forward is 1px off the ground
    for x, step, leg, foot in ((11, fb, "ochre", "rust"), (16, fa, "orange", "ochre")):
        up = 1 if step > 0 else 0
        g.rect(x + step / 2, 24 + b, 2, 4 - b - up, leg)
        g.rect(x + step - 1, 28 - up, 3, 1, leg)
        g.rect(x + step - 1, 29 - up, 4, 1, foot)
    # the far wing, raised behind the body and clear of the neck, so the neck shows against the road
    g.tri((10, 15 + b), (19, 14 + b), (16, 2 + b + f), "lgrey")
    g.tri((13, 14 + b), (18, 14 + b), (16, 5 + b + f), "grey")
    # tail and body
    g.tri((2, 12 + b), (6, 20 + b), (9, 15 + b), "white")
    g.cel(14, 19.5 + b, 9.5, 5.5, "white", "lgrey")
    g.rect(8, 23 + b, 12, 1, "lgrey")
    # the near wing, spread up and back, its feather tips stepped in grey
    g.tri((7, 17 + b), (18, 16 + b), (5, 3 + b + f), "white")
    g.tri((10, 17 + b), (18, 16 + b), (14, 6 + b + f), "white")
    for k in range(4):
        g.rect(5 + k * 2, 5 + k * 3 + b + f, 2, 1, "lgrey")
    g.rect(9, 16 + b, 9, 1, "lgrey")
    # the neck stretched forward and up to the head
    for k in range(6):
        g.rect(18 + k + t * k / 5, 15 - k * 1.2 + b, 4, 3, "white")
    g.cel(24.5 + t, 7.5 + b, 3.5, 3, "white", "lgrey")
    # the beak: an orange knob, upper mandible and, opened, the lower one with the mouth between
    hx = 26 + min(t, 1)
    g.rect(hx, 5 + b, 2, 1, "orange")
    g.rect(hx, 6 + b, 3, 2, "orange")
    g.p(hx + 2, 7 + b, "ochre")
    if beak:
        g.rect(hx + 1, 8 + b, 2, beak, "dred")
        g.rect(hx, 8 + beak + b, 3, 1, "ochre")
    else:
        g.rect(hx, 8 + b, 3, 1, "ochre")
    # an angry eye under a scowling brow
    g.p(hx - 2, 7 + b, "ink")
    g.rect(hx - 3, 6 + b, 2, 1, "slate")
    return lit(g)


# The waddle: the near foot back, passing, forward, passing; the body bobs on the passing frames, and the
# wings beat with the stride, raised on the steps and swept down as the body rises.
GOOSE_RUN = [dict(fa=-2, fb=2, flap=-1), dict(bob=-1, flap=2), dict(fa=2, fb=-2, flap=-1), dict(bob=-1, flap=2)]
# The honk: open, a thrust with the beak wide, open, shut.
GOOSE_IDLE = [dict(), dict(beak=2, thrust=1), dict(), dict(beak=0)]
GOOSE_OFFSETS = ("fa", "fb", "bob", "flap", "thrust")


# ---------- café patio ----------

def patron(g, cx, hair, shirt, shade, skin, skin_shade):
    """A seated patron facing the player, cooing: eyes shut in happy arcs, an "o" mouth, blushing, hands
    clasped under the chin."""
    g.rect(cx - 7, 25, 14, 8, shirt)
    g.rect(cx + 4, 25, 3, 8, shade)
    road.face_disc(g, cx, 18, 7.5, 7.5, skin, skin_shade)
    g.ell(cx, 13.5, 8, 4, *hair)
    g.rect(cx - 8, 14, 2, 6, hair[0])
    g.rect(cx + 6, 14, 2, 6, hair[1])
    for ex in (cx - 5, cx + 2):
        g.p(ex, 19, "ink")
        g.p(ex + 1, 18, "ink")
        g.p(ex + 2, 19, "ink")
    g.rect(cx - 6, 21, 2, 1, "pink")
    g.rect(cx + 4, 21, 2, 1, "pink")
    g.rect(cx - 1, 22, 2, 2, "dbrown")
    g.rect(cx - 3, 26, 6, 3, skin)
    g.rect(cx, 26, 1, 3, skin_shade)


def cafe_patio(steam=0, new=Grid, w=88):
    """The awning hangs from a pole at each end over the two tables; the left patron's cup lies toppled in
    its spill with a foam heart floating in it, the right one's stands on a saucer. steam is the curl's
    step: it rises 1px a frame over a 4-row wave. w is the width in drawing units: the right pole, patron
    and table move left by what it is short of 88, the awning's ten stripes narrow to fit and the tables
    narrow so a gap stays between them."""
    d = w - 88
    g = edged(new(w, 40))
    for x in (3, 83 + d):
        g.rect(x, 3, 2, 35, "slate")
        g.rect(x, 3, 1, 35, "grey")
    patron(g, 24, ("amber", "orange", "yellow"), "pink", "mauve", "skin1", "skin2")
    patron(g, 64 + d, ("dbrown", "plum", "brown"), "sky", "blue", "skin2", "brown")
    # the awning: green and cream stripes over a scalloped edge
    sw = (80 + d) / 10
    for i in range(10):
        x = 4 + i * sw
        col, shade = ("green", "dgreen") if i % 2 == 0 else ("cream", "tan")
        g.rect(x, 3, sw, 4, col)
        g.rect(x, 5, sw, 2, shade)
        g.ell(x + sw / 2, 7, sw / 2, 2.5, col, shade)
    g.rect(2, 1, 84 + d, 2, "dgreen")
    g.rect(2, 3, 2, 4, "dgreen")
    g.rect(84 + d, 3, 2, 4, "dgreen")
    # the tables: a white top edge, a grey rim, a slate pedestal on a dslate foot
    half = min(11, round((40 + d) / 2) - 1)
    for cx in (24, 64 + d):
        g.rect(cx - half, 30, 2 * half, 1, "white")
        g.rect(cx - half, 31, 2 * half, 1, "lgrey")
        g.rect(cx - half + 1, 32, 2 * half - 2, 1, "grey")
        g.rect(cx - 1, 33, 3, 4, "slate")
        g.rect(cx - 5, 36, 11, 2, "dslate")
        g.rect(cx - 5, 36, 11, 1, "slate")
    # left: the cup on its side, latte spilled across the top and dripping off the edge, the foam heart in it
    g.rect(15, 29, 13, 1, "tan")
    g.rect(16, 31, 2, 3, "tan")
    g.p(16, 34, "brown")
    g.rect(28, 26, 6, 4, "white")
    g.rect(28, 29, 6, 1, "lgrey")
    g.rect(34, 27, 1, 2, "lgrey")
    g.rect(27, 27, 1, 2, "brown")
    g.ell(21.5, 27.5, 6.5, 2.5, "tan", "brown")
    heart(g, 19, 25, "white", "lgrey")
    # right: a cup on its saucer, and its steam curl
    g.rect(67 + d, 29, 9, 1, "lgrey")
    g.rect(69 + d, 25, 5, 4, "white")
    g.rect(73 + d, 25, 1, 4, "lgrey")
    g.rect(74 + d, 26, 2, 2, "lgrey")
    g.rect(69 + d, 25, 4, 1, "brown")
    k = int(steam)
    for j in range(5):
        y = 23 - j
        x = 72 + d + (0, 1, 0, -1)[(j + k) % 4]
        if (j + k) % 5 != 4:
            g.p(x, y, "white")
    return lit(g)


CAFE_IDLE = (0, 1, 2, 3), 350


# ---------- build ----------

def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite, then its depth variants. Each is
    drawn at BIG times its step, the 2-lane ones TWO_LANES wide in drawing units."""
    for suffix, step in (("", 1), *(("@" + k, v) for k, v in STEPS)):
        s = BIG * step
        new = mini(s)

        def snapped(q, keys):
            return {k: (v / s if k in keys and v else v) for k, v in q.items()}

        def idle(draw, spec, keys=(), **wide):
            args, ms = spec
            frames = [draw(**snapped(a, keys), new=new, **wide) if isinstance(a, dict) else draw(a, new=new, **wide)
                      for a in args]
            return [("idle", [f.outlined() for f in frames], ms)]

        yield f"goose{suffix}", [
            ("run", [goose(**snapped(q, GOOSE_OFFSETS), new=new).outlined() for q in GOOSE_RUN], 110),
            ("idle", [goose(**snapped(q, GOOSE_OFFSETS), new=new).outlined() for q in GOOSE_IDLE], 300)]
        yield f"cafe-patio{suffix}", idle(cafe_patio, CAFE_IDLE, w=TWO_LANES)


if __name__ == "__main__":
    main(sys.argv, sprites, "art/encounters", __doc__, grounds=GROUNDS)
