#!/usr/bin/env python3
"""Draw everything on the road except the dogs, and build its Aseprite sources and exports.

People are 32x48, animals 32x32, pickups and small effects 16x16, all chibi and
in Endesga 32 with coloured outlines. The walker is seen from behind, like the
dogs; everything coming down the road faces the player.

Usage:
  road.py preview OUT.png   contact sheet of every frame, scaled up
  road.py build             write art/road/*.aseprite, then export
                            public/art/sprites/*.png and *.json with Aseprite

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import DARKER, K, Grid, main  # noqa: E402


def face_front(g, cx, y, mood="happy", eyes="ink"):
    """Eyes and mouth for a chibi head seen from the front; y is the eye row."""
    g.rect(cx - 5, y, 2, 2, eyes)
    g.rect(cx + 3, y, 2, 2, eyes)
    g.p(cx - 5, y, "white")
    g.p(cx + 3, y, "white")
    if mood == "happy":
        g.p(cx - 2, y + 4, "dbrown")
        g.p(cx + 1, y + 4, "dbrown")
        g.rect(cx - 1, y + 5, 2, 1, "dbrown")
    elif mood == "smirk":
        g.rect(cx - 1, y + 5, 3, 1, "dbrown")
        g.p(cx + 2, y + 4, "dbrown")
    else:
        g.rect(cx - 1, y + 5, 2, 1, "dbrown")


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
        g.rect(x, 32 + b + d, 4, 3, "skin2")
    # hoodie
    g.rect(9, 21 + b, 14, 13, "sky")
    g.rect(20, 21 + b, 3, 13, "blue")
    g.rect(9, 21 + b, 1, 12, "cyan")
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    g.rect(9, 33 + b, 14, 1, "blue")
    g.ell(16, 22.5 + b, 6, 2.5, "blue", "navy")
    # head: hair, ears, cap and a ponytail
    g.rect(14, 19 + b, 4, 3, "skin2")
    g.ell(16, 12.5 + b, 8.5, 8.5, "dbrown", "plum", "brown")
    g.rect(7, 13 + b, 2, 3, "skin2")
    g.rect(23, 13 + b, 2, 3, "skin2")
    g.ell(16, 8 + b, 8.5, 5, "amber", "orange", "yellow")
    g.rect(8, 10 + b, 17, 2, "orange")
    g.rect(15, 10 + b, 2, 2, "dbrown")
    g.ell(16, 17 + b, 2.5, 4, "dbrown", "plum")
    return g


WALKER_WALK = [dict(lf=-2, rf=0, arms=1), dict(lf=-1, rf=-1, bob=-1), dict(lf=0, rf=-2, arms=-1), dict(lf=-1, rf=-1, bob=-1)]
WALKER_REACT = [dict(lf=-4, rf=-4, bob=-4, arms=-3), dict(lf=-1, rf=-1, bob=-1, arms=-1)]


# ---------- pickups ----------

def treat(lift=0):
    g = Grid(16, 16)
    y = 6 + lift
    g.rect(4, y, 8, 3, "cream")
    for cx, cy in ((3.5, y + 0.5), (3.5, y + 2.5), (12.5, y + 0.5), (12.5, y + 2.5)):
        g.ell(cx, cy, 1.8, 1.8, "cream", "tan")
    g.rect(4, y + 2, 8, 1, "tan")
    g.p(5, y, "white")
    g.p(3, y - 1, "white")
    return g


def tip(rx):
    g = Grid(16, 16)
    if rx < 1.5:
        g.rect(7, 3, 2, 10, "orange")
        g.rect(7, 3, 1, 10, "amber")
        return g
    g.ell(8, 8, rx, 5.5, "amber", "orange", "yellow")
    if rx > 2:
        g.rect(8, 5, 1, 6, "orange")
        g.p(7, 6, "orange")
        g.p(9, 9, "orange")
    return g


# ---------- encounters (facing the player) ----------

def skunk(sway=0):
    g = Grid()
    g.ell(16 + sway, 9, 7, 6.5, "navy", "ink", "dslate")
    g.ell(16 + sway, 8, 3, 4, "white", "lgrey")
    g.ell(16, 19, 7, 6, "navy", "ink", "dslate")
    g.rect(15, 13, 2, 9, "white")
    g.rect(16, 13, 1, 9, "lgrey")
    g.tri((11, 22), (12, 18.5), (14.5, 21), "navy")
    g.tri((21, 22), (20, 18.5), (17.5, 21), "navy")
    g.ell(16, 25, 5.5, 4.5, "navy", "ink", "dslate")
    g.rect(15, 21, 2, 3, "white")
    g.rect(12, 24, 2, 2, "ink")
    g.rect(18, 24, 2, 2, "ink")
    g.p(12, 24, "white")
    g.p(18, 24, "white")
    g.rect(15, 27, 2, 1, "pink")
    return g


def squirrel(tail=0, shift=0):
    g = Grid()
    t, h = tail, shift
    g.ell(20 + t, 12, 5.5, 7.5, "ochre", "rust", "tan")
    g.ell(16.5 + t, 5, 4.5, 3, "ochre", "rust", "tan")
    g.ell(20 + t, 12.5, 2.5, 5, "tan")
    g.ell(14 + h, 19.5, 4, 4.5, "ochre", "rust", "tan")
    g.ell(14 + h, 20.5, 2, 3, "cream")
    g.tri((10 + h, 24), (10.5 + h, 19.5), (13 + h, 22.5), "ochre")
    g.tri((18 + h, 24), (17.5 + h, 19.5), (15 + h, 22.5), "ochre")
    g.ell(14 + h, 25.5, 4.5, 4, "ochre", "rust", "tan")
    g.ell(14 + h, 27.5, 2.5, 1.5, "cream")
    g.rect(11 + h, 25, 2, 2, "ink")
    g.rect(15 + h, 25, 2, 2, "ink")
    g.p(11 + h, 25, "white")
    g.p(15 + h, 25, "white")
    g.rect(13 + h, 27, 2, 1, "plum")
    return g


def puddle(f):
    g = Grid(32, 16)
    g.ell(16, 8, 14, 6, "blue")
    g.ell(16, 8.5, 13, 5, "sky")
    s = 1 if f else 0
    g.rect(9 + s, 5, 4, 1, "cyan")
    g.rect(19 - s, 9, 5, 1, "cyan")
    g.rect(13 + s, 11, 2, 1, "cyan")
    return g


def corgi(step=0):
    g = Grid()
    g.rect(10, 8 + step, 3, 3, "ochre")
    g.rect(19, 8 - step, 3, 3, "ochre")
    g.rect(10, 16 - step, 3, 3, "white")
    g.rect(19, 16 + step, 3, 3, "white")
    g.ell(16, 13, 6.5, 8, "ochre", "rust", "tan")
    g.ell(16, 17, 4, 4, "white", "lgrey")
    g.tri((10, 24), (8.5, 14.5), (14, 19), "ochre")
    g.tri((22, 24), (23.5, 14.5), (18, 19), "ochre")
    g.tri((10.5, 21.5), (9.5, 16.5), (12.5, 19.5), "pink")
    g.tri((21.5, 21.5), (22.5, 16.5), (19.5, 19.5), "pink")
    g.ell(16, 23.5, 6, 5, "ochre", "rust", "tan")
    g.ell(16, 25.5, 3.5, 2.5, "white", "lgrey")
    g.rect(15, 18, 2, 4, "white")
    g.rect(12, 22, 2, 2, "ink")
    g.rect(18, 22, 2, 2, "ink")
    g.p(12, 22, "white")
    g.p(18, 22, "white")
    g.rect(15, 25, 2, 1, "ink")
    g.rect(11, 18, 10, 1, "amber")
    return g


def person(top, legs="navy", shoes="ink", lf=0, rf=0, bob=0):
    """A chibi person facing the player: legs and shoes, then the caller's top(g, bob)."""
    g = Grid(32, 48)
    for x, f in ((11, lf), (17, rf)):
        g.rect(x, 33 + bob, 4, 10 + f - bob, legs)
        g.rect(x + 3, 33 + bob, 1, 10 + f - bob, DARKER[K[legs]])
        g.rect(x, 43 + f, 4, 2, shoes)
    top(g, bob)
    return g


def thief_top(flee):
    def top(g, b):
        arm = 3 if flee else 0
        for y in range(21 + b, 34 + b):
            stripe = "white" if (y - b) % 4 < 2 else "ink"
            g.rect(9, y, 14, 1, stripe)
        for x, d in ((5, -arm), (23, arm)):
            for y in range(22 + b + d, 31 + b + d):
                g.rect(x, y, 4, 1, "white" if (y - b - d) % 4 < 2 else "ink")
            g.rect(x, 31 + b + d, 4, 3, "skin2")
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
        if flee:
            g.rect(15, 17 + b, 2, 2, "dbrown")
            g.p(24, 6 + b, "cyan")
            g.p(24, 7 + b, "cyan")
        else:
            g.rect(14, 17 + b, 4, 1, "dbrown")
            g.p(18, 16 + b, "dbrown")
    return top


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
        # biscuit jar held at the chest
        g.rect(10, 25 + b, 9, 9, "lgrey")
        g.rect(10, 25 + b, 9, 2, "red")
        g.rect(11, 28 + b, 7, 5, "white")
        g.rect(12, 29 + b, 2, 2, "tan")
        g.rect(15, 30 + b, 2, 2, "ochre")
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
    g = Grid(16, 16)
    g.rect(5, 4, 7, 4, "green")
    g.rect(5, 4, 7, 1, "dgreen")
    g.rect(8, 5, 2, 2, "dgreen")
    g.rect(3, 6, 10, 7, "dbrown")
    g.rect(3, 6, 10, 1, "brown")
    g.rect(3, 9, 10, 1, "plum")
    g.rect(11, 9, 2, 2, "amber")
    if glint:
        for x, y in ((13, 2), (12, 3), (14, 3), (13, 4), (13, 3)):
            g.p(x, y, "white")
    return g


def bark(big):
    g = Grid(16, 16)
    r = 6 if big else 5
    g.ell(8.5, 7, r, r - 0.5, "white", "lgrey")
    g.tri((4, 10), (2, 15), (7, 11), "white")
    g.rect(8, 3 if big else 4, 2, 5 if big else 4, "red")
    g.rect(8, 10 if big else 9, 2, 2, "red")
    return g


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    def frames(gs, outline=True):
        return [g.outlined(outline) for g in gs]

    yield "walker", [("walk", frames(walker(**q) for q in WALKER_WALK), 160),
                     ("react", frames(walker(**q) for q in WALKER_REACT), 120)]
    yield "treat", [("idle", frames([treat(0), treat(-1)]), 400)]
    yield "tip", [("idle", frames(tip(rx) for rx in (5.5, 3.5, 1, 3.5)), 120)]
    yield "skunk", [("idle", frames([skunk(0), skunk(1)]), 400)]
    yield "squirrel", [("idle", frames([squirrel(0), squirrel(1)]), 300),
                       ("run", frames([squirrel(0, -1), squirrel(-1, 1)]), 120)]
    yield "puddle", [("idle", frames([puddle(0), puddle(1)], outline=False), 500)]
    yield "other-dog", [("walk", frames([corgi(-1), corgi(1)]), 200)]
    yield "thief", [("walk", [person(thief_top(False), lf=-2).outlined(), person(thief_top(False), rf=-2).outlined()], 200),
                    ("flee", [person(thief_top(True), lf=-3, bob=-1).outlined(),
                              person(thief_top(True), rf=-3, bob=-1).outlined()], 110)]
    yield "lost-wallet", [("idle", frames([wallet(False), wallet(True)]), 450)]
    yield "biscuit-neighbour", [("wave", [person(neighbour_top(w), legs="purple", shoes="dbrown").outlined()
                                          for w in (False, True)], 350)]
    yield "photo-op", [("idle", [person(tourist_top(False), legs="skin2", shoes="sky", bob=bb).outlined()
                                 for bb in (0, -1)], 400),
                       ("flash", [person(tourist_top(True), legs="skin2", shoes="sky").outlined(),
                                  person(tourist_top(False), legs="skin2", shoes="sky").outlined()], 120)]
    yield "fx-bark", [("pop", frames([bark(False), bark(True)]), 120)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/road", __doc__)
