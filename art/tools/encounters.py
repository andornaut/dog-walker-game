#!/usr/bin/env python3
"""Draw the goose, a zone encounter on the road. It is a billboard like the minor
obstacles (obstacles.py), but a side view, squat, its base on the last opaque row.

goose               48x48   1 lane, a mover: a white goose, wings up, neck stretched, beak open
                            mid-honk; side view facing right, the game mirrors it for left.
                            run (4 frames, 110ms): a waddle, the feet swap and the body bobs 1px on
                            the passing frames, the wings flap 3px, raised on the steps and swept down on the
                            passing frames; idle (4 frames, 300ms): the honk,
                            the neck thrust 1px forward with the beak wide, then the beak shut

The drawing is laid out on a 32-unit design grid: the sprites draw it on a minis.Mini at BIG
(1.5x, road.SCALE), so 32 units are 48px. A 1px line stays 1px and motion moves whole pixels.
The goose also has <key>@<step> for each depth step in minis.STEPS (from
shared/depth-steps.json), redrawn the same way at BIG x the step, floor(size x scale + 0.5),
with the original's tags, frames and durations and a full outline.

It takes the road outline rule (pixel.road_edge) and road.LIT's rim on its dark colours, so
the silhouette holds 3:1 on every road. goose() takes new, the grid maker (Grid for the
32-unit size, or mini(s)).

Usage:
  encounters.py preview OUT.png   every frame on the zone roads
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
from pixel import Grid, edged, main  # noqa: E402
from road import LIT  # noqa: E402

# The drawings are laid out on a 32-unit design grid; the sprites draw them road.SCALE times larger (32 units
# are 48px).
BIG = road.SCALE


def mini(s):
    """A grid maker for a depth variant at scale s."""
    return lambda w=32, h=32: Mini(s, w, h)


def lit(g):
    """road.rim with road.LIT on the grid that holds the pixels, so a Mini gets the rim at its own size."""
    road.rim(getattr(g, "g", g), LIT)
    return g


# ---------- goose ----------

def goose(fa=0, fb=0, bob=0, flap=0, beak=1, thrust=0, new=Grid):
    """Side view facing right. fa and fb move the near and far feet along the ground, bob lifts the body
    (negative is up), flap moves the wing tips down (negative is up), beak opens it (0 shut, 1 open, 2 wide) and thrust pushes
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


# ---------- build ----------

def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite, then its depth variants. Each is
    drawn at BIG times its step."""
    for suffix, step in (("", 1), *(("@" + k, v) for k, v in STEPS)):
        s = BIG * step
        new = mini(s)

        def snapped(q, keys):
            return {k: (v / s if k in keys and v else v) for k, v in q.items()}

        yield f"goose{suffix}", [
            ("run", [goose(**snapped(q, GOOSE_OFFSETS), new=new).outlined() for q in GOOSE_RUN], 110),
            ("idle", [goose(**snapped(q, GOOSE_OFFSETS), new=new).outlined() for q in GOOSE_IDLE], 300)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/encounters", __doc__)
