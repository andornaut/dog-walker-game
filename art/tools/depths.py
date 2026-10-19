#!/usr/bin/env python3
"""Draw the depth variants of road sprites that the other art scripts leave
out: @75 and @50 for the road sprites that have none, and the steps in BETWEEN
(between @75 and full size) for every road sprite. Each runs the sprite's own
drawing function on a minis.Mini, so it follows any redraw of the full-size
sprite and gets its own full outline at the small size (see minis.py).

@75 and @50 here:
other-dog-owner, thief, biscuit-neighbour, chatty-neighbour, kid, mail-carrier,
photo-op, stop-sign                         24x36, 16x24
ice-cream-truck                             66x33, 44x22
construction                                42x24, 28x16
puddle (no outline), barrier-2              66x24 and 66x18, 44x16 and 44x12
hedge, barrier-3                            108x18, 72x12
parked-car                                  33x21, 22x14

The steps in BETWEEN, for every road sprite: the ones above, minis.variants,
the hazards (squirrel-dash, loose-dog, ball-bounce, cyclist) and the need
spots. Walkers are the pack, always drawn at 1x, and have none.

Every variant keeps the original's tags, frame counts and durations, and its
frame is floor(original size x scale + 0.5). Offsets that move a part by pixels (a
step, a breath, a wag) are snapped to whole pixels at the small size.

Usage:
  depths.py preview OUT.png   every frame of every variant on the six road colours
  depths.py compare DIR       DIR/<key>.png per sprite: each frame at 1x, then per
                              step nearest-neighbour beside the variant, on the
                              six road colours
  depths.py build             write the @75 and @50 variants to art/depths/*.aseprite,
                              export to public/art/sprites/ and list them in the manifest
  depths.py build-between     the same for the steps in BETWEEN

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import dogs  # noqa: E402
import hazards  # noqa: E402
import minis  # noqa: E402
import needs  # noqa: E402
import obstacles  # noqa: E402
import road  # noqa: E402
from minis import SCALES, scaled, small, snap  # noqa: E402
from pixel import K, build, preview, road_sprite  # noqa: E402

# The steps between @75 and full size, as (suffix, scale), such as ("88", 0.875). Empty until the game's step
# table lists them, since the manifest rejects any other suffix than @75 and @50.
BETWEEN = ()
GROUNDS = ("3a4466", "e4a672", "c0cbdc", "c28569", "8b9bb4", "ead4aa")
# The pose arguments of road.person that move a part by pixels.
POSE = ("lf", "rf", "bob")


def dressed(s, top, **q):
    """road.dressed(top, **q) on a Mini, its pose snapped to whole pixels."""
    pose = snap({k: v for k, v in q.items() if k in POSE}, s)
    return small(road, s, road.dressed, top, **{k: v for k, v in q.items() if k not in POSE}, **pose)


def breathe(s, g, waist=33):
    """g's 1px breath: the rows above full-size row waist lift 1px and the row under them stretches up to
    fill. The thief's stripes are drawn row by row, so his top cannot take road.person's bob at a fraction
    of a full-size pixel; this lifts it after drawing instead."""
    y = scaled(waist, s)
    g.px = g.px[1:y + 1] + g.px[y:]
    return g


def stop_sign(s, glint=None):
    """road.stop_sign on a Mini, with its sheen laid on the small grid along x + y = glint x s. Below 0.875x
    the 3x5 lettering turns to noise, so the legend is a white bar instead, 2px shorter than the lettering
    and centred on it, across the face with a pixel of red each side."""
    g = small(road, s, road.stop_sign)
    if s < 0.875:
        for y in range(math.floor(10.5 * s), math.floor(14.5 * s) + 1):
            g.px[y] = [K["red"] if c == K["white"] else c for c in g.px[y]]
        left, right = scaled(7, s) + 1, scaled(25, s) - 1
        h = max(1, scaled(5, s) - 2)
        g.rect(left, scaled(12.5 - h / 2 / s, s), right - left, h, "white")
    if glint is not None:
        red = K["red"]
        for y in range(scaled(5, s), scaled(21, s)):
            x = scaled(glint, s) - y
            if 0 < x < g.w and g.px[y][x] == red and g.px[y - 1][x] and g.px[y][x - 1]:
                g.p(x, y, "pink")
    return g


def obstacle(s, draw, spec):
    """An obstacles.*_IDLE tag on a Mini."""
    args, ms = spec
    return [("idle", [small(obstacles, s, draw, a).outlined() for a in args], ms)]


def own(s):
    """Yield (key, [(tag, [frame pixels], duration_ms)]) at scale s for the road sprites only this file draws
    small, with the tags road.sprites and obstacles.sprites give them."""
    breath, ms = road.BREATH, road.BREATH_MS

    def walk(top, **q):
        return ("walk", [dressed(s, top, lf=-2, **q).outlined(), dressed(s, top, rf=-2, **q).outlined()], 200)

    owner = dict(shoes="dbrown")
    yield "other-dog-owner", [walk(road.dog_owner_top, **owner),
                              ("idle", [dressed(s, road.dog_owner_top, bob=b, **owner).outlined() for b in breath], ms)]
    yield "thief", [walk(road.thief_top),
                    ("flee", [small(road, s, road.thief_fleeing, k).outlined() for k in (-1, 1)], 110),
                    ("idle", [dressed(s, road.thief_top).outlined(),
                              breathe(s, dressed(s, road.thief_top)).outlined()], ms)]
    for key, top, q in (("biscuit-neighbour", road.neighbour_top, dict(legs="purple", shoes="dbrown")),
                        ("chatty-neighbour", road.chatty_top, dict(legs="brown", shoes="dbrown"))):
        yield key, [("wave", [dressed(s, top(w), **q).outlined() for w in (False, True)], 350),
                    ("idle", [dressed(s, top(False), bob=b, **q).outlined() for b in breath], ms)]
    tourist = dict(legs="skin2", shoes="sky")
    yield "photo-op", [("idle", [dressed(s, road.tourist_top(False), bob=b, **tourist).outlined() for b in breath], ms),
                       ("flash", [dressed(s, road.tourist_top(f), **tourist).outlined() for f in (True, False)], 120)]
    yield "stop-sign", [("idle", [stop_sign(s, c).outlined() for c in (None, None, 18, 24)], 400)]

    def kid(wave=False, mood="happy", bob=0):
        return small(road, s, road.kid, wave, mood, **snap(dict(bob=bob), s)).outlined()

    yield "kid", [("wave", [kid(False), kid(True)], 300), ("sad", [kid(False, "sad")], 1000),
                  ("idle", [kid(bob=b) for b in breath], ms)]
    yield "mail-carrier", [("walk", [small(road, s, road.mail_carrier, **snap(q, s)).outlined()
                                     for q in (dict(lf=-2), dict(rf=-2))], 200),
                           ("idle", [small(road, s, road.mail_carrier, **snap(dict(bob=b), s)).outlined()
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


def borrowed(s):
    """Yield (key, tags) at scale s for the road sprites whose @75 and @50 another file draws: minis.variants,
    the hazards and the need spots. The dogs are the pack, which stays at 1x, so they have none."""
    yield from ((key, tags) for key, tags in minis.variants(s) if not key.startswith("dog-"))
    yield "squirrel-dash", [("run", [hazards.squirrel_dash(**hazards.small(s, q, hazards.SQUIRREL_OFFSETS)).outlined()
                                     for q in hazards.SQUIRREL_RUN], 80)]
    yield "loose-dog", [("run", [hazards.corgi_side(**hazards.small(s, q, hazards.CORGI_OFFSETS)).outlined()
                                 for q in hazards.CORGI_RUN], 100)]
    yield "ball-bounce", [("bounce", [hazards.ball_bounce(f, s) for f in range(6)], 70)]
    yield "cyclist", [("ride", [cyclist(s, **q).outlined() for q in hazards.CYCLIST_RIDE], 90)]
    for key, (draw, module, tags) in needs.SPOTS.items():
        yield key, [(tag, [needs.shrunk(module or needs, s, draw, q).outlined() for q in poses], ms)
                    for tag, poses, ms in tags]


def steps(scales, *sources):
    """Yield (key@suffix, tags) for each scale and each source's sprites at it."""
    for suffix, s in scales:
        for source in sources:
            for key, tags in source(s):
                yield f"{key}@{suffix}", tags


def sprites():
    """Every variant: this file's own at every step, then the borrowed ones at the steps between."""
    yield from steps(SCALES + BETWEEN, own)
    yield from steps(BETWEEN, borrowed)


def originals():
    """Every full-size road sprite, by key."""
    out = {}
    for module in (road, obstacles, dogs, hazards, needs):
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

    full = originals()
    ours = {**dict(minis.sprites()), **dict(sprites())}
    variants = {**full, **ours}
    for key in dict.fromkeys(k.split("@")[0] for k in ours):
        frames = [f for _, fs, _ in full[key] for f in fs]
        found = [(s, [f for _, fs, _ in variants[f"{key}@{x}"] for f in fs])
                 for x, s in sorted(SCALES + BETWEEN, key=lambda q: -q[1]) if f"{key}@{x}" in variants]
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
        build(checked(steps(SCALES, own)), "art/depths", anchored=road_sprite)
    elif len(argv) == 2 and argv[1] == "build-between":
        build(checked(steps(BETWEEN, own, borrowed)), "art/depths", anchored=road_sprite)
    else:
        sys.exit(__doc__)
