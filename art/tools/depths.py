#!/usr/bin/env python3
"""Draw the depth variants of road sprites that the other art scripts leave
out: every depth step (minis.STEPS, from shared/depth-steps.json) for the road
sprites that have no variants elsewhere, and the steps in BETWEEN (those
without hazards.py's hand-drawn art) for hazards.py's squirrel-dash, loose-dog,
ball-bounce and cyclist. Each runs the sprite's own drawing function on a
minis.Mini, so it follows any redraw of the full-size sprite and gets its own
full outline at the small size (see minis.py).

At every step here: other-dog-owner, thief, biscuit-neighbour, chatty-neighbour,
kid, mail-carrier, photo-op, stop-sign, ice-cream-truck, construction, puddle
(no outline), hedge, barrier-2, barrier-3 and parked-car. Walkers are the
pack, always drawn at 1x, and have none.

Every variant keeps the original's tags, frame counts and durations, and its
frame is floor(original size x scale + 0.5). road.py's people are drawn at
road.SCALE x the step, as road.py draws them at road.SCALE. Offsets that move a
part by pixels (a step, a breath, a wag) are snapped to whole pixels at the small
size.

Usage:
  depths.py preview OUT.png   every frame of every variant on the six road colours
  depths.py compare DIR       DIR/<key>.png per sprite: each frame at 1x, then per
                              step nearest-neighbour beside the variant, on the
                              six road colours
  depths.py build             write every variant to art/depths/*.aseprite and
                              export to public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import hazards  # noqa: E402
import minis  # noqa: E402
import obstacles  # noqa: E402
import road  # noqa: E402
from minis import SCALES, STEPS, scaled, small, snap  # noqa: E402
from pixel import build, preview  # noqa: E402

# The steps hazards.py has no hand-drawn art for.
BETWEEN = tuple(q for q in STEPS if q not in SCALES)
GROUNDS = ("3a4466", "e4a672", "c0cbdc", "c28569", "8b9bb4", "ead4aa")
# The pose arguments of road.person that move a part by pixels.
POSE = ("lf", "rf", "bob")


def dressed(s, top, **q):
    """road.dressed(top, **q) on a Mini, its pose snapped to whole pixels."""
    pose = snap({k: v for k, v in q.items() if k in POSE}, s)
    return small(road, s, road.dressed, top, **{k: v for k, v in q.items() if k not in POSE}, **pose)


def obstacle(s, draw, spec):
    """An obstacles.*_IDLE tag on a Mini."""
    args, ms = spec
    return [("idle", [small(obstacles, s, draw, a).outlined() for a in args], ms)]


def own(s):
    """Yield (key, [(tag, [frame pixels], duration_ms)]) at scale s for the road sprites only this file draws
    small, with the tags road.sprites and obstacles.sprites give them. road.py's people are drawn at
    road.SCALE x s, since their drawing functions lay them out road.SCALE times smaller than they export."""
    breath, ms = road.BREATH, road.BREATH_MS
    p = road.SCALE * s

    def walk(top, **q):
        return ("walk", [dressed(p, top, lf=-2, **q).outlined(), dressed(p, top, rf=-2, **q).outlined()], 200)

    owner = dict(shoes="dbrown")
    yield "other-dog-owner", [walk(road.dog_owner_top, **owner),
                              ("idle", [dressed(p, road.dog_owner_top, bob=b, **owner).outlined() for b in breath], ms)]
    yield "thief", [walk(road.thief_top),
                    ("flee", [small(road, p, road.thief_fleeing, k).outlined() for k in (-1, 1)], 110),
                    ("idle", [dressed(p, road.thief_top, bob=b).outlined() for b in breath], ms)]
    for key, top, q in (("biscuit-neighbour", road.neighbour_top, dict(legs="purple", shoes="dbrown")),
                        ("chatty-neighbour", road.chatty_top, dict(legs="brown", shoes="dbrown"))):
        yield key, [("wave", [dressed(p, top(w), **q).outlined() for w in (False, True)], 350),
                    ("idle", [dressed(p, top(False), bob=b, **q).outlined() for b in breath], ms)]
    tourist = dict(legs="skin2", shoes="sky")
    yield "photo-op", [("idle", [dressed(p, road.tourist_top(False), bob=b, **tourist).outlined() for b in breath], ms),
                       ("flash", [dressed(p, road.tourist_top(f), **tourist).outlined() for f in (True, False)], 120)]
    # road.stop_sign draws its face, legend and sheen in pixels at the grid's scale
    yield "stop-sign", [("idle", [small(road, p, road.stop_sign, c).outlined() for c in (None, None, 18, 24)], 400)]

    def kid(wave=False, mood="happy", bob=0):
        return small(road, p, road.kid, wave, mood, **snap(dict(bob=bob), p)).outlined()

    yield "kid", [("wave", [kid(False), kid(True)], 300), ("sad", [kid(False, "sad")], 1000),
                  ("idle", [kid(bob=b) for b in breath], ms)]
    yield "mail-carrier", [("walk", [small(road, p, road.mail_carrier, **snap(q, p)).outlined()
                                     for q in (dict(lf=-2), dict(rf=-2))], 200),
                           ("idle", [small(road, p, road.mail_carrier, **snap(dict(bob=b), p)).outlined()
                                     for b in breath], ms)]
    yield "ice-cream-truck", [("idle", [small(road, s, road.ice_cream_truck, f).outlined() for f in (0, 1)], 400)]
    yield "construction", [("idle", [small(road, s, road.construction, f).outlined() for f in (0, 1)], 500)]
    yield "puddle", [("idle", [small(road, s, road.puddle, f).outlined(False) for f in (0, 1)], 500)]
    yield "hedge", obstacle(s, lambda r: obstacles.hedge(rustle=r), obstacles.HEDGE_IDLE)
    for lanes in (2, 3):
        yield f"barrier-{lanes}", [("idle", [small(obstacles, s, obstacles.barrier, lanes, f).outlined()
                                             for f in (0, 1)], 500)]
    yield "parked-car", obstacle(s, obstacles.parked_car, obstacles.PARKED_CAR_IDLE)


# hazards.BALL's bounce at 0.875x and 0.625x: frame size, ground row, heights, radii, stripes and shadow
# widths between hazards.BALL's at 1, 0.75 and 0.5, the stripe step a whole cycle over the 6 frames. Radii
# stop short of a half pixel: an ellipse whose tip reaches a pixel centre grows a 1px nub there.
BALL = {
    0.875: dict(size=(14, 21), ground=19, heights=(0, 5, 8, 9, 8, 5), squash=(5, 3.4), stretch=(3.4, 5),
                round=(4.4, 4.4), stripes=(2, 6, 2), shadow=(10, 8, 6, 6, 6, 8)),
    0.625: dict(size=(10, 15), ground=13, heights=(0, 3, 5, 6, 5, 3), squash=(4, 2.4), stretch=(2.4, 4),
                round=(3.4, 3.4), stripes=(2, 4, 2), shadow=(8, 6, 6, 4, 6, 6)),
}
hazards.BALL.update(BALL)


def cyclist(s, lf, rf, sway):
    """hazards.cyclist on a Mini; the sway shifts the rows above the handlebar, where hazards.lean's shear
    moves them 1px."""
    g = small(hazards, s, hazards.cyclist, lf=lf, rf=rf).g
    hazards.sway_rows(g, sway, scaled(26, s))
    return g


def hazard(s):
    """Yield (key, tags) at scale s for hazards.py's sprites, whose @75 and @50 it draws itself."""
    yield "squirrel-dash", [("run", [hazards.squirrel_dash(**hazards.small(s, q, hazards.SQUIRREL_OFFSETS)).outlined()
                                     for q in hazards.SQUIRREL_RUN], 80)]
    yield "loose-dog", [("run", [hazards.corgi_side(**hazards.small(s, q, hazards.CORGI_OFFSETS)).outlined()
                                 for q in hazards.CORGI_RUN], 100)]
    yield "ball-bounce", [("bounce", [hazards.ball_bounce(f, s) for f in range(6)], 70)]
    yield "cyclist", [("ride", [cyclist(s, **q).outlined() for q in hazards.CYCLIST_RIDE], 90)]


def steps(scales, *sources):
    """Yield (key@suffix, tags) for each scale and each source's sprites at it."""
    for suffix, s in scales:
        for source in sources:
            for key, tags in source(s):
                yield f"{key}@{suffix}", tags


def sprites():
    """Every variant: this file's own at every step, then the hazards at the steps in BETWEEN."""
    yield from steps(STEPS, own)
    yield from steps(BETWEEN, hazard)


def originals():
    """Every full-size road sprite, by key."""
    out = {}
    for module in (road, obstacles, hazards):
        out.update(module.sprites())
    return out


def checked(variants):
    """variants, after checking each keeps its original's tags, frame counts and durations."""
    full = originals()
    out = list(variants)
    for key, tags in out:
        want = [(tag, len(fs), ms) for tag, fs, ms in full[key.split("@")[0]]]
        got = [(tag, len(fs), ms) for tag, fs, ms in tags]
        if got != want:
            sys.exit(f"{key}: tags {got} differ from the original's {want}")
    return out


def compare(out_dir, scale=4, gap=4):
    """Per sprite with a variant here or in minis.py, a sheet with a band per road colour: each frame at 1x,
    then per step a line of nearest-neighbour beside the variant."""
    from PIL import Image

    full = {**originals(), **minis.originals()}
    ours = {**dict(minis.sprites()), **dict(sprites())}
    variants = {**full, **ours}
    for key in dict.fromkeys(k.split("@")[0] for k in ours):
        frames = [f for _, fs, _ in full[key] for f in fs]
        found = [(s, [f for _, fs, _ in variants[f"{key}@{x}"] for f in fs])
                 for x, s in STEPS if f"{key}@{x}" in variants]
        lines = [[frames]] + [[[minis.nearest(f, s) for f in frames], small_frames] for s, small_frames in found]
        width = max(sum(sum(len(f[0]) + gap for f in block) + 2 * gap for block in line) for line in lines)
        band = sum(len(line[0][0]) + gap for line in lines)
        img = Image.new("RGB", (width * scale, band * len(GROUNDS) * scale), (24, 20, 37))
        y0 = 0
        for ground in GROUNDS:
            for line in lines:
                x0 = 0
                for block in line:
                    for f in block:
                        for y, row in enumerate(f):
                            for x, c in enumerate(row):
                                rgb = tuple(int((c or ground)[i:i + 2], 16) for i in (0, 2, 4))
                                img.paste(rgb, ((x0 + x) * scale, (y0 + y) * scale,
                                                (x0 + x + 1) * scale, (y0 + y + 1) * scale))
                        x0 += len(f[0]) + gap
                    x0 += 2 * gap
                y0 += len(line[0][0]) + gap
        img.save(os.path.join(out_dir, f"{key}.png"))


if __name__ == "__main__":
    argv = sys.argv
    if len(argv) == 3 and argv[1] == "preview":
        preview(list(sprites()), argv[2], GROUNDS)
    elif len(argv) == 3 and argv[1] == "compare":
        compare(argv[2])
    elif len(argv) == 2 and argv[1] == "build":
        build(checked(sprites()), "art/depths")
    else:
        sys.exit(__doc__)
