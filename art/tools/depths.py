#!/usr/bin/env python3
"""Draw the depth variants of road sprites that the other art scripts leave
out: every depth step (minis.STEPS, from shared/depth-steps.json) for the road
sprites that have no variants elsewhere, and the steps in BETWEEN (those
hazards.py does not build) for hazards.py's squirrel-dash, loose-dog,
ball-bounce, cyclist and coyote. Each runs the sprite's own drawing function on a
minis.Mini, so it follows any redraw of the full-size sprite and gets its own
full outline at the small size (see minis.py).

At every step here: other-dog-owner, thief, biscuit-neighbour, mail-carrier,
stroller, jogger, kid-on-bike, ice-cream-truck, construction, puddle (no
outline), hedge, hot-dog-cart, barrier-2, barrier-3, parked-car, delivery-truck
and streetcar. Walkers
are the pack, always drawn at 1x, and have none.

Every variant keeps the original's tags, frame counts and durations, and its
frame is floor(original size x scale + 0.5). road.py's people are drawn at
road.SCALE x the step, as road.py draws them at road.SCALE. The truck, the
construction barrier, the obstacles and the parked car are drawn at their
full size's scale (road.TRUCK_SCALE, road.CONSTRUCTION_SCALE,
obstacles.SCALE, obstacles.CAR_SCALE) x the step. Offsets that move a
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
from minis import SCALES, STEPS, small, snap  # noqa: E402
from pixel import build, depth_settled, preview  # noqa: E402

# The steps hazards.py leaves to this file: it builds SCALES itself.
BETWEEN = tuple(q for q in STEPS if q not in SCALES)
GROUNDS = ("3a4466", "e4a672", "c0cbdc", "c28569", "8b9bb4", "ead4aa")
# The pose arguments of road.person that move a part by pixels.
POSE = ("lf", "rf", "bob")


def dressed(s, top, **q):
    """road.dressed(top, **q) on a Mini, its pose snapped to whole pixels."""
    pose = snap({k: v for k, v in q.items() if k in POSE}, s)
    return small(road, s, road.dressed, top, **{k: v for k, v in q.items() if k not in POSE}, **pose)


def posed(q, s):
    """A pose q with its numeric offsets snapped to whole pixels at s, its named choices (a side) as given."""
    return {**q, **snap({k: v for k, v in q.items() if isinstance(v, (int, float))}, s)}


def obstacle(s, draw, spec):
    """An obstacles.*_IDLE tag on a Mini at s, or (sx, sy)."""
    args, ms = spec
    return [("idle", [small(obstacles, s, draw, a).outlined() for a in args], ms)]


def own(s):
    """Yield (key, [(tag, [frame pixels], duration_ms)]) at scale s for the road sprites only this file draws
    small, with the tags road.sprites and obstacles.sprites give them. road.py's people are drawn at
    road.SCALE x s, the stop sign too, since their drawing functions lay them out road.SCALE times smaller than
    they export."""
    breath, ms = road.BREATH, road.BREATH_MS
    p = road.SCALE * s

    def walk(top, **q):
        return ("walk", [dressed(p, top, **w, **q).outlined() for w in road.PERSON_WALK], road.PERSON_WALK_MS)

    owner = dict(shoes="dbrown")
    yield "other-dog-owner", [walk(road.dog_owner_top, **owner),
                              ("idle", [dressed(p, road.dog_owner_top, bob=b, **owner).outlined() for b in breath], ms)]
    yield "thief", [walk(road.thief_top),
                    ("flee", [small(road, p, road.thief_fleeing, k).outlined() for k in (-1, 1)], 110),
                    ("idle", [dressed(p, road.thief_top, bob=b).outlined() for b in breath], ms)]
    neighbour = dict(legs="purple", shoes="dbrown")
    yield "biscuit-neighbour", [
        ("wave", [dressed(p, road.neighbour_top(w), **neighbour).outlined() for w in (False, True)], 350),
        ("idle", [dressed(p, road.neighbour_top(False), bob=b, **neighbour).outlined() for b in breath], ms)]
    yield "mail-carrier", [("walk", [small(road, p, road.mail_carrier, **snap(q, p)).outlined()
                                     for q in road.PERSON_WALK], road.PERSON_WALK_MS),
                           ("idle", [small(road, p, road.mail_carrier, **snap(dict(bob=b), p)).outlined()
                                     for b in breath], ms)]
    yield "stroller", [("walk", [small(road, p, road.stroller, **snap(q, p)).outlined() for q in road.STROLLER_WALK],
                        road.STROLLER_WALK_MS)]
    yield "jogger", [("run", [small(road, p, road.jogger, **posed(q, p)).outlined() for q in road.JOGGER_RUN],
                      road.JOGGER_RUN_MS)]
    yield "kid-on-bike", [("ride", [small(road, p, road.kid_on_bike, **posed(q, p)).outlined()
                                    for q in road.KID_BIKE_RIDE], road.KID_BIKE_RIDE_MS)]

    def times(q):
        return tuple(v * s for v in q)

    truck = times(road.TRUCK_SCALE)
    drive, drive_ms = road.TRUCK_DRIVE
    yield "ice-cream-truck", [("idle", [small(road, truck, road.ice_cream_truck, f).outlined() for f in (0, 1)], 400),
                              ("drive", [small(road, truck, road.ice_cream_truck, roll=r).outlined() for r in drive],
                               drive_ms)]
    yield "construction", [("idle", [small(road, times(road.CONSTRUCTION_SCALE), road.construction, f).outlined()
                                     for f in (0, 1)], 500)]
    yield "puddle", [("idle", [small(road, s, road.puddle, f).outlined(False) for f in (0, 1)], 500)]
    b = obstacles.SCALE * s
    yield "hedge", obstacle(b, lambda r: obstacles.hedge(rustle=r), obstacles.HEDGE_IDLE)
    yield "hot-dog-cart", obstacle(b, lambda f: obstacles.hot_dog_cart(steam=f), obstacles.HOT_DOG_CART_IDLE)
    for lanes in (2, 3):
        yield f"barrier-{lanes}", [("idle", [small(obstacles, b, obstacles.barrier, lanes, f).outlined()
                                             for f in (0, 1)], 500)]
    args, ms = obstacles.PULL_OUT
    car = times(obstacles.CAR_SCALE)
    drive, drive_ms = obstacles.DRIVE
    yield "parked-car", obstacle(car, obstacles.parked_car, obstacles.PARKED_CAR_IDLE) + [
        ("pull-out", [small(obstacles, car, obstacles.parked_car, roll=f).outlined() for f in args], ms),
        ("drive", [small(obstacles, car, obstacles.parked_car, roll=f, blink=False).outlined() for f in drive],
         drive_ms)]
    yield "delivery-truck", obstacle(car, obstacles.delivery_truck, obstacles.DELIVERY_IDLE) + [
        ("drive", [small(obstacles, car, obstacles.delivery_truck, roll=f).outlined() for f in drive], drive_ms)]
    yield "streetcar", obstacle(car, obstacles.streetcar, obstacles.STREETCAR_IDLE) + [
        ("drive", [small(obstacles, car, obstacles.streetcar, roll=f).outlined() for f in drive], drive_ms)]


def hazard(s):
    """Yield (key, tags) at scale s for hazards.py's sprites, whose @75 and @50 it draws itself."""
    yield from hazards.steps("", s)


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
        preview(depth_settled(sprites(), originals()), argv[2], GROUNDS)
    elif len(argv) == 3 and argv[1] == "compare":
        compare(argv[2])
    elif len(argv) == 2 and argv[1] == "build":
        build(checked(sprites()), "art/depths", originals())
    else:
        sys.exit(__doc__)
