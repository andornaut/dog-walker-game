#!/usr/bin/env python3
"""Draw everything on the road except the dogs, and build its Aseprite sources and exports.

People are 32x48, animals 32x32, pickups and small effects 16x16 (the ice cream
truck is 64x48 and the construction barrier 56x32, one lane), all chibi and
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
        g.rect(x, 32 + b + d, 4, 3, "skin1")
    # hoodie
    g.rect(9, 21 + b, 14, 13, "sky")
    g.rect(20, 21 + b, 3, 13, "blue")
    g.rect(9, 21 + b, 1, 12, "cyan")
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    g.rect(9, 33 + b, 14, 1, "blue")
    g.ell(16, 22.5 + b, 6, 2.5, "blue", "navy")
    # head: hair, ears, cap and a ponytail
    g.rect(14, 19 + b, 4, 3, "skin1")
    g.ell(16, 12.5 + b, 8.5, 8.5, "dbrown", "plum", "brown")
    g.rect(7, 13 + b, 2, 3, "skin1")
    g.rect(23, 13 + b, 2, 3, "skin1")
    g.ell(16, 8 + b, 8.5, 5, "amber", "orange", "yellow")
    g.rect(8, 10 + b, 17, 2, "orange")
    g.rect(15, 10 + b, 2, 2, "dbrown")
    g.ell(16, 17 + b, 2.5, 4, "dbrown", "plum")
    return g


# ---------- the other walkers (back view) ----------

def walker_girl(lf=0, rf=0, bob=0, arms=0):
    """Ada, 11, mixed race, caramel skin, long black curls falling straight down: pink tee, teal shorts."""
    g = Grid(32, 48)
    b = bob
    for x, f in ((12, lf), (17, rf)):
        g.rect(x, 37 + b, 3, 6 + f - b, "brown")
        g.rect(x, 43 + f, 3, 1, "white")
        g.rect(x, 44 + f, 3, 2, "lgrey")
        g.rect(x, 45 + f, 3, 1, "pink")
    for x, d in ((7, -arms), (22, arms)):
        g.rect(x, 27 + b + d, 3, 7, "brown")
        g.rect(x, 27 + b + d, 3, 3, "pink")
    g.rect(10, 26 + b, 12, 8, "pink")
    g.rect(19, 26 + b, 3, 8, "mauve")
    g.rect(10, 33 + b, 12, 5, "sky")
    g.rect(19, 33 + b, 3, 5, "blue")
    g.rect(15, 33 + b, 2, 5, "blue")
    g.rect(7, 16 + b, 2, 3, "brown")
    g.rect(23, 16 + b, 2, 3, "brown")
    # black hair: a rounded crown, then long defined curls hanging straight down the back
    g.ell(16, 14.5 + b, 8, 7.5, "navy", "ink", "dslate")
    g.rect(9, 16 + b, 14, 14, "navy")
    g.ell(16, 30 + b, 7, 2, "navy", "ink")
    for x in (10, 13, 16, 19):
        for y in range(15, 31):
            g.p(x + (y // 2) % 2, y + b, "dslate" if x < 18 else "ink")
    g.rect(21, 16 + b, 2, 14, "ink")
    g.ell(16, 8 + b, 2.5, 1.5, "pink", "mauve")
    return g


def walker_man(lf=0, rf=0, bob=0, arms=0):
    """Ben, 45, Black, bald (his beard is under his chin, out of sight from behind): black tee, track pants, sneakers."""
    g = Grid(32, 48)
    b = bob
    for x, f in ((11, lf), (17, rf)):
        g.rect(x, 33 + b, 4, 10 + f - b, "navy")
        g.rect(x + (3 if x > 16 else 0), 33 + b, 1, 10 + f - b, "slate")
        g.rect(x, 43 + f, 4, 2, "white")
        g.rect(x, 44 + f, 4, 1, "lgrey")
        g.rect(x + 1, 43 + f, 2, 1, "red")
    for x, d in ((5, -arms), (23, arms)):
        g.rect(x, 22 + b + d, 4, 4, "navy")
        g.rect(x, 26 + b + d, 4, 6, "dbrown")
        g.rect(x + 3, 26 + b + d, 1, 6, "plum")
        g.rect(x, 32 + b + d, 4, 3, "dbrown")
    g.rect(9, 21 + b, 14, 13, "navy")
    g.rect(20, 21 + b, 3, 13, "ink")
    g.rect(9, 21 + b, 1, 12, "dslate")
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    g.rect(13, 19 + b, 6, 3, "dbrown")
    # bald head, the beard showing along the jaw
    g.rect(8, 12 + b, 2, 3, "dbrown")
    g.rect(22, 12 + b, 2, 3, "plum")
    g.blob(16, 12 + b, 7, 9, "dbrown", "plum", power=2.15)
    g.rect(12, 8 + b, 2, 1, "brown")
    return g


def walker_teacher(lf=0, rf=0, bob=0, arms=0):
    """50, dirty blonde bob to the shoulders, cute: green cardigan, navy skirt, tights, brown flats."""
    g = Grid(32, 48)
    b = bob
    for x, f in ((11, lf), (17, rf)):
        g.rect(x + 1, 37 + b, 3, 6 + f - b, "dslate")
        g.rect(x, 43 + f, 4, 2, "dbrown")
    for x, d in ((5, -arms), (23, arms)):
        g.rect(x, 22 + b + d, 4, 10, "dgreen")
        g.rect(x + 3, 22 + b + d, 1, 10, "forest")
        g.rect(x, 32 + b + d, 4, 3, "skin1")
    g.rect(9, 21 + b, 14, 11, "dgreen")
    g.rect(20, 21 + b, 3, 11, "forest")
    g.rect(9, 21 + b, 1, 10, "green")
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    g.rect(9, 31 + b, 14, 7, "navy")
    g.rect(20, 31 + b, 3, 7, "ink")
    g.rect(9, 31 + b, 14, 1, "dslate")
    # a canvas tote with an apple on it
    g.rect(25, 24 + b, 5, 1, "brown")
    g.rect(24, 25 + b, 7, 8, "cream")
    g.rect(29, 25 + b, 2, 8, "tan")
    g.rect(26, 27 + b, 3, 3, "red")
    g.p(27, 26 + b, "dgreen")
    # a dirty blonde bob to the shoulders, flicking out at the ends
    g.ell(16, 12.5 + b, 9, 9, "tan", "brown", "cream")
    g.rect(8, 14 + b, 17, 5, "tan")
    g.rect(22, 14 + b, 3, 5, "brown")
    g.ell(16, 19 + b, 9, 2.5, "tan", "brown")
    g.p(7, 20 + b, "tan")
    g.p(25, 20 + b, "brown")
    g.rect(13, 9 + b, 1, 4, "brown")
    g.rect(19, 11 + b, 1, 3, "brown")
    return g


WALKERS = {
    "walker-ada": walker_girl,
    "walker-ben": walker_man,
    "walker-trista": walker_teacher,
}


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


def dog_owner_top(g, b):
    """The other dog's walker: yellow raincoat, brown bob, leash hand held out low."""
    g.rect(9, 21 + b, 14, 13, "amber")
    g.rect(20, 21 + b, 3, 13, "orange")
    g.rect(9, 21 + b, 1, 12, "yellow")
    g.rect(15, 22 + b, 1, 11, "orange")
    g.p(13, 25 + b, "orange")
    g.p(13, 29 + b, "orange")
    g.rect(5, 22 + b, 4, 9, "amber")
    g.rect(5, 31 + b, 4, 3, "skin1")
    g.rect(23, 22 + b, 4, 8, "amber")
    g.rect(24, 30 + b, 4, 3, "skin1")
    g.ell(16, 12.5 + b, 8, 8, "skin1", "skin2")
    g.ell(16, 8.5 + b, 9, 5, "dbrown", "plum", "brown")
    g.rect(7, 9 + b, 3, 9, "dbrown")
    g.rect(22, 9 + b, 3, 9, "dbrown")
    g.rect(10, 9 + b, 12, 2, "dbrown")
    face_front(g, 16, 13 + b)
    g.p(10, 16 + b, "pink")
    g.p(22, 16 + b, "pink")


# ---------- forced stops ----------

def stop_sign():
    g = Grid(32, 48)
    g.rect(15, 22, 3, 24, "grey")
    g.rect(17, 22, 1, 24, "slate")
    g.rect(13, 45, 7, 2, "slate")
    # octagon
    g.rect(10, 4, 12, 20, "red")
    g.rect(8, 6, 16, 16, "red")
    g.rect(9, 5, 14, 18, "red")
    g.rect(10, 22, 12, 1, "dred")
    g.rect(23, 7, 1, 14, "dred")
    for i, ch in enumerate(("S", "T", "O", "P")):
        x = 8 + i * 4
        bits = {"S": "011100010001110", "T": "111010010010010", "O": "010101101101010", "P": "110101110100100"}[ch]
        for r in range(5):
            for k in range(3):
                if bits[r * 3 + k] == "1":
                    g.p(x + k, 11 + r, "white")
    return g


def chatty_top(wave):
    def top(g, b):
        g.rect(9, 21 + b, 14, 13, "cream")
        g.rect(11, 21 + b, 10, 12, "dgreen")
        g.rect(19, 21 + b, 2, 12, "forest")
        g.rect(5, 22 + b, 4, 9, "cream")
        g.rect(5, 31 + b, 4, 3, "skin2")
        if wave:
            g.rect(23, 12 + b, 4, 10, "cream")
            g.rect(23, 9 + b, 4, 3, "skin2")
        else:
            g.rect(23, 22 + b, 4, 8, "cream")
            g.rect(24, 28 + b, 5, 5, "white")
            g.rect(25, 29 + b, 3, 1, "brown")
        g.ell(16, 12.5 + b, 8, 8, "skin2", "brown", "skin1")
        g.ell(16, 7 + b, 7, 3.5, "lgrey", "grey", "white")
        g.rect(8, 9 + b, 2, 5, "lgrey")
        g.rect(22, 9 + b, 2, 5, "lgrey")
        face_front(g, 16, 13 + b)
        g.rect(13, 16 + b, 6, 1, "lgrey")
        g.p(12, 17 + b, "lgrey")
        g.p(19, 17 + b, "lgrey")
    return top


def kid(wave=False, mood="happy"):
    g = Grid(32, 48)
    for x in (12, 17):
        g.rect(x, 38, 3, 6, "skin1")
        g.rect(x, 44, 3, 2, "red")
    g.rect(10, 28, 12, 10, "yellow")
    g.rect(19, 28, 3, 10, "amber")
    g.rect(10, 35, 12, 3, "sky")
    g.rect(7, 29, 3, 6, "yellow")
    g.rect(7, 35, 3, 2, "skin1")
    if wave:
        g.rect(22, 20, 3, 8, "yellow")
        g.rect(22, 18, 3, 2, "skin1")
    else:
        g.rect(22, 29, 3, 6, "yellow")
        g.rect(22, 35, 3, 2, "skin1")
    g.ell(16, 20.5, 7.5, 7.5, "skin1", "skin2")
    g.ell(16, 15.5, 8, 4, "red", "dred", "pink")
    g.rect(16, 17, 9, 2, "red")
    g.rect(8, 18, 2, 4, "ochre")
    g.rect(22, 18, 2, 4, "ochre")
    face_front(g, 16, 21, mood if mood != "sad" else "neutral")
    if mood == "sad":
        g.rect(15, 26, 2, 1, "dbrown")
        g.p(14, 27, "dbrown")
        g.p(17, 27, "dbrown")
        g.p(10, 23, "cyan")
    return g


def ice_cream_truck(f):
    g = Grid(64, 48)
    g.rect(6, 12, 52, 30, "white")
    g.rect(6, 12, 52, 2, "lgrey")
    g.rect(54, 12, 4, 30, "lgrey")
    g.rect(6, 30, 52, 4, "pink")
    g.rect(6, 33, 52, 1, "mauve")
    g.rect(12, 16, 40, 10, "cyan")
    g.rect(12, 16, 40, 1, "sky")
    g.rect(31, 16, 2, 10, "lgrey")
    g.rect(4, 38, 56, 4, "lgrey")
    g.rect(4, 41, 56, 1, "grey")
    for x in (8, 46):
        g.rect(x, 42, 10, 4, "ink")
        g.rect(x + 2, 42, 6, 2, "dslate")
    g.rect(10, 35, 4, 2, "yellow" if f else "amber")
    g.rect(50, 35, 4, 2, "yellow" if f else "amber")
    # cone on the roof
    g.tri((29, 9), (35, 9), (32, 2 + 8), "tan")
    g.ell(32, 5, 4, 3.5, "pink", "mauve", "white")
    g.rect(29, 9, 6, 3, "tan")
    g.p(30, 10, "brown")
    g.p(33, 10, "brown")
    if f:
        g.rect(46, 2, 1, 5, "plum")
        g.rect(46, 2, 3, 1, "plum")
        g.rect(44, 6, 2, 2, "plum")
    else:
        g.rect(16, 3, 1, 5, "plum")
        g.rect(14, 7, 2, 2, "plum")
    return g


def construction(f):
    g = Grid(56, 32)
    for x in (6, 46):
        g.rect(x, 12, 3, 18, "grey")
        g.rect(x + 2, 12, 1, 18, "slate")
    g.rect(3, 12, 50, 8, "white")
    for x in range(3, 53, 8):
        g.tri((x, 20), (x + 4, 12), (x + 8, 12), "orange")
        g.tri((x, 20), (x + 4, 20), (x + 8, 12), "orange")
    g.rect(3, 19, 50, 1, "rust")
    g.rect(3, 22, 50, 4, "white")
    for x in range(3, 53, 8):
        g.rect(x, 22, 4, 4, "orange")
    g.ell(7.5, 8, 2.5, 2.5, "amber" if f else "orange", "orange", "yellow" if f else None)
    g.ell(47.5, 8, 2.5, 2.5, "orange" if f else "amber", "orange", None if f else "yellow")
    g.rect(20, 3, 16, 8, "amber")
    g.rect(20, 3, 16, 1, "orange")
    g.rect(23, 6, 10, 2, "plum")
    g.tri((21, 7), (25, 4), (25, 10), "plum")
    return g


def mail_top(g, b):
    g.rect(9, 21 + b, 14, 12, "blue")
    g.rect(20, 21 + b, 3, 12, "navy")
    g.rect(15, 21 + b, 2, 12, "sky")
    g.rect(5, 22 + b, 4, 9, "blue")
    g.rect(5, 31 + b, 4, 3, "dbrown")
    g.rect(23, 22 + b, 4, 9, "blue")
    g.rect(23, 31 + b, 4, 3, "dbrown")
    g.rect(9, 33 + b, 14, 3, "navy")
    # mailbag on a strap
    g.ell(24, 30 + b, 5, 4.5, "brown", "dbrown", "tan")
    g.rect(22, 27 + b, 4, 3, "white")
    g.rect(10, 22 + b, 2, 1, "dbrown")
    g.rect(12, 23 + b, 2, 1, "dbrown")
    g.rect(14, 24 + b, 2, 1, "dbrown")
    g.rect(16, 25 + b, 2, 1, "dbrown")
    g.rect(18, 26 + b, 2, 1, "dbrown")
    g.ell(16, 12.5 + b, 8, 8, "dbrown", "plum")
    g.ell(16, 7 + b, 8.5, 3.5, "blue", "navy", "sky")
    g.rect(8, 9 + b, 17, 2, "navy")
    g.rect(15, 5 + b, 2, 2, "amber")
    face_front(g, 16, 13 + b, eyes="ink")
    g.p(11, 13 + b, "white")
    g.p(19, 13 + b, "white")


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    def frames(gs, outline=True):
        return [g.outlined(outline) for g in gs]

    yield "walker-casey", [("walk", frames(walker(**q) for q in WALKER_WALK), 160),
                     ("react", frames(walker(**q) for q in WALKER_REACT), 120)]
    for key, draw in WALKERS.items():
        yield key, [("walk", frames(draw(**q) for q in WALKER_WALK), 160),
                    ("react", frames(draw(**q) for q in WALKER_REACT), 120)]
    yield "treat", [("idle", frames([treat(0), treat(-1)]), 400)]
    yield "tip", [("idle", frames(tip(rx) for rx in (5.5, 3.5, 1, 3.5)), 120)]
    yield "skunk", [("idle", frames([skunk(0), skunk(1)]), 400)]
    yield "squirrel", [("idle", frames([squirrel(0), squirrel(1)]), 300),
                       ("run", frames([squirrel(0, -1), squirrel(-1, 1)]), 120)]
    yield "puddle", [("idle", frames([puddle(0), puddle(1)], outline=False), 500)]
    yield "other-dog", [("walk", frames([corgi(-1), corgi(1)]), 200)]
    yield "other-dog-owner", [("walk", [person(dog_owner_top, shoes="dbrown", lf=-2).outlined(),
                                        person(dog_owner_top, shoes="dbrown", rf=-2).outlined()], 200)]
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
    yield "stop-sign", [("idle", frames([stop_sign()]), 1000)]
    yield "chatty-neighbour", [("wave", [person(chatty_top(w), legs="brown", shoes="dbrown").outlined() for w in (False, True)], 350)]
    yield "kid", [("wave", frames([kid(False), kid(True)]), 300), ("sad", frames([kid(False, "sad")]), 1000)]
    yield "ice-cream-truck", [("idle", frames([ice_cream_truck(0), ice_cream_truck(1)]), 400)]
    yield "construction", [("idle", frames([construction(0), construction(1)]), 500)]
    yield "mail-carrier", [("walk", [person(mail_top, legs="navy", shoes="ink", lf=-2).outlined(),
                                     person(mail_top, legs="navy", shoes="ink", rf=-2).outlined()], 200)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/road", __doc__)
