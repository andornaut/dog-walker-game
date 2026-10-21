#!/usr/bin/env python3
"""Draw the ambient layer: people on the sidewalks, with no collisions and no card. Each sprite is a road
sprite, laid out on a design grid and drawn at road.SCALE (1.5) like road.py's people, with @88, @75, @62
and @50 variants; the cross street draws from @50.

The pedestrian is a student out for a stroll, calm and alone: dark brown hair in a ponytail, sky
headphones, a red jacket, a green backpack, sky jeans and white sneakers. No dog, no leash and no prop in
hand, so it never reads as an owner, a walker or a road hazard. It stands on road.person's legs and walks
with the road people's stride, 4 frames at road.PERSON_WALK_MS: a foot lifted, both feet 1px up as the
body passes 1px higher, the other foot lifted, passing again. Its feet are on row 68 at full size, as the
walkers' are.

ambient-pedestrian        48x72  front view, walking toward the walker; walk 4 x 100ms
ambient-pedestrian-back   48x72  back view, walking away; walk 4 x 100ms

Every sprite has the road outline (pixel.road_edge) and the lit rim (road.LIT) on its dark parts.

Usage:
  ambient.py preview OUT.png   every frame on the road colours
  ambient.py build             write art/ambient/*.aseprite and export to public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them belong
in this file instead. Shared tooling is in pixel.py; the legs, face and rim come from road.py.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import road  # noqa: E402
from minis import STEPS, small, snap  # noqa: E402
from pixel import main  # noqa: E402

GROUNDS = ("3a4466", "e4a672", "f6757a", "c28569", "8b9bb4", "ead4aa", "c0cbdc")


# ---------- the pedestrian, laid out on 32x48 as road.person's tops are ----------

def student_front(g, b):
    """The student facing the walker: a red jacket with its zip, the backpack's straps over the shoulders,
    hands at rest, and headphones over dark brown hair."""
    g.rect(9, 21 + b, 14, 13, "red")
    g.rect(20, 21 + b, 3, 13, "dred")
    g.rect(15, 21 + b, 2, 13, "dred")
    g.rect(9, 32 + b, 14, 2, "dred")
    g.rect(5, 22 + b, 4, 9, "red")
    g.rect(5, 31 + b, 4, 3, "skin1")
    g.rect(23, 22 + b, 4, 9, "red")
    g.rect(26, 22 + b, 1, 9, "dred")
    g.rect(23, 31 + b, 4, 3, "skin1")
    g.rect(10, 21 + b, 2, 9, "green")
    g.rect(20, 21 + b, 2, 9, "dgreen")
    road.face_disc(g, 16, 12.5 + b, 8, 8, "skin1", "skin2")
    g.cel(16, 8 + b, 9, 5, "dbrown", "plum", "brown")
    g.rect(7, 8 + b, 3, 7, "dbrown")
    g.rect(22, 8 + b, 3, 7, "plum")
    g.rect(10, 8 + b, 12, 2, "dbrown")
    g.rect(9, 2 + b, 14, 2, "sky")
    g.rect(5, 10 + b, 4, 6, "sky")
    g.rect(23, 10 + b, 4, 6, "blue")
    road.face_front(g, 16, 13 + b)
    g.p(10, 16 + b, "pink")
    g.p(22, 16 + b, "pink")


def student_back(g, b):
    """The student walking away: the green backpack over the red jacket, its pocket and zip, the ponytail
    over the backpack's top, tied in red, the headphones' band over it and a cup over each ear."""
    g.rect(9, 21 + b, 14, 13, "red")
    g.rect(20, 21 + b, 3, 13, "dred")
    g.rect(9, 32 + b, 14, 2, "dred")
    g.rect(5, 22 + b, 4, 9, "red")
    g.rect(5, 31 + b, 4, 3, "skin1")
    g.rect(23, 22 + b, 4, 9, "red")
    g.rect(26, 22 + b, 1, 9, "dred")
    g.rect(23, 31 + b, 4, 3, "skin2")
    g.rect(10, 22 + b, 12, 10, "green")
    g.rect(19, 22 + b, 3, 10, "dgreen")
    g.rect(10, 22 + b, 12, 1, "yellow")
    g.rect(12, 27 + b, 8, 4, "dgreen")
    g.rect(12, 27 + b, 8, 1, "yellow")
    g.rect(14, 19 + b, 4, 3, "skin1")
    g.cel(16, 12.5 + b, 8.5, 8.5, "dbrown", "plum", "brown")
    g.ell(16, 22.5 + b, 2.5, 3.5, "dbrown", "plum")
    g.rect(15, 19 + b, 2, 1, "red")
    g.rect(9, 3 + b, 14, 2, "sky")
    g.rect(5, 10 + b, 4, 6, "sky")
    g.rect(23, 10 + b, 4, 6, "blue")


LEGS = dict(legs="sky", shoes="white")


def walking(s, top, step):
    """A walk frame at scale s (road.SCALE x the depth step), on road.person's legs in road.PERSON_WALK's pose."""
    return small(road, s, road.dressed, top, **LEGS, **snap(road.PERSON_WALK[step], s)).outlined()


def pedestrians(suffix, step):
    """Yield (key, tags) for the pedestrian's front and back views at a depth step."""
    s = road.SCALE * step
    for key, top in (("ambient-pedestrian", student_front), ("ambient-pedestrian-back", student_back)):
        yield f"{key}{suffix}", [("walk", [walking(s, top, f) for f in range(4)], road.PERSON_WALK_MS)]


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every ambient sprite at full size, then at every
    depth step."""
    for suffix, step in (("", 1),) + tuple((f"@{x}", q) for x, q in STEPS):
        yield from pedestrians(suffix, step)


if __name__ == "__main__":
    main(sys.argv, sprites, "art/ambient", __doc__, grounds=GROUNDS)
