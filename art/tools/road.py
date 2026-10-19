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

Everything that stands or waits on the road has a looping idle: people and
walkers breathe (a 1px bob of the head and shoulders) and the stop sign glints.
New tags go after the existing ones, so the frame indices the game uses stay put.

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import DARKER, K, Grid, edged, main, road_sprite  # noqa: E402


def face_front(g, cx, y, mood="happy", eyes="ink", lips="dbrown"):
    """Eyes and mouth for a chibi head seen from the front; y is the eye row. lips is the mouth's colour."""
    g.rect(cx - 5, y, 2, 2, eyes)
    g.rect(cx + 3, y, 2, 2, eyes)
    g.p(cx - 5, y, "white")
    g.p(cx + 3, y, "white")
    if mood == "happy":
        g.p(cx - 2, y + 4, lips)
        g.p(cx + 1, y + 4, lips)
        g.rect(cx - 1, y + 5, 2, 1, lips)
    elif mood == "smirk":
        g.rect(cx - 1, y + 5, 3, 1, lips)
        g.p(cx + 2, y + 4, lips)
    else:
        g.rect(cx - 1, y + 5, 2, 1, lips)


def rim(g, rims):
    """Light a dark figure's silhouette so it holds on Woof Way: an edge pixel of a colour in rims takes
    rims[colour] = (lit, shade), lit where the edge faces up or left into the light and shade where it
    faces right or down. A shade of None leaves that side dark."""
    rims = {K[c]: v for c, v in rims.items()}
    edge = []
    for y in range(g.h):
        for x in range(g.w):
            c = g.px[y][x]
            if c not in rims:
                continue
            empty = [not (0 <= x + dx < g.w and 0 <= y + dy < g.h and g.px[y + dy][x + dx])
                     for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1))]
            if any(empty):
                edge.append((x, y, rims[c][0] if empty[0] or empty[1] else rims[c][1]))
    for x, y, c in edge:
        if c:
            g.p(x, y, c)
    return g


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
    """Ada, 11, mixed race, caramel skin, long black curls falling straight down: pink tee, teal shorts.
    She stands 4px shorter than the adults: her head and body sit lower and her legs are shorter."""
    g = Grid(32, 48)
    b = bob
    for x, f in ((12, lf), (17, rf)):
        g.rect(x, 40 + b, 3, 3 + f - b, "brown")
        g.rect(x, 43 + f, 3, 1, "white")
        g.rect(x, 44 + f, 3, 2, "lgrey")
        g.rect(x, 45 + f, 3, 1, "pink")
    for x, d in ((7, -arms), (22, arms)):
        g.rect(x, 30 + b + d, 3, 7, "brown")
        g.rect(x, 30 + b + d, 3, 3, "pink")
    g.rect(10, 29 + b, 12, 8, "pink")
    g.rect(19, 29 + b, 3, 8, "mauve")
    g.rect(10, 36 + b, 12, 4, "sky")
    g.rect(19, 36 + b, 3, 4, "blue")
    g.rect(15, 36 + b, 2, 4, "blue")
    g.rect(7, 20 + b, 2, 3, "brown")
    g.rect(23, 20 + b, 2, 3, "brown")
    # black hair: a rounded crown, then long ringlets hanging straight down the back, their ends
    # bunched into bumps along the sides and the hem
    g.ell(16, 18.5 + b, 8, 7.5, "navy", "ink", "dslate")
    g.rect(9, 20 + b, 14, 10, "navy")
    g.rect(21, 20 + b, 2, 10, "ink")
    for y in (21.5, 25, 28.5):
        g.ell(8.8, y + b, 1.5, 1.8, "navy")
        g.ell(23.2, y + b, 1.5, 1.8, "ink")
    for x in (10.5, 14, 17.5, 21):
        g.ell(x, 30.5 + b, 1.8, 1.5, "navy" if x < 20 else "ink")
    # four ringlets of stacked curls, each lit purple and mauve on its upper left and dark on its lower right
    for col, x in enumerate((10, 13, 16, 19)):
        for y in range(20 + col % 2, 31, 3):
            lit = col < 3
            g.p(x, y + b, "mauve" if lit else "purple")
            g.p(x + 1, y + b, "purple")
            g.p(x, y + 1 + b, "purple" if lit else "dslate")
            g.p(x + 1, y + 2 + b, "ink")
            g.p(x + 2, y + 1 + b, "ink")
    g.ell(16, 12 + b, 2.5, 1.5, "pink", "mauve")
    # a light rim along the edges facing the light keeps her dark hair and skin off the dark road
    return rim(g, dict(navy=("grey", "slate"), ink=("grey", "slate"), dslate=("grey", "slate"),
                       purple=("grey", "slate"), brown=("skin2", None), blue=("sky", None)))


def walker_man(lf=0, rf=0, bob=0, arms=0):
    """Ben, 45, Black, bald (his beard is under his chin, out of sight from behind): black tee, track pants, sneakers."""
    g = Grid(32, 48)
    b = bob
    for x, f in ((11, lf), (17, rf)):
        g.rect(x, 33 + b, 4, 10 + f - b, "navy")
        # the track pants' stripe runs down the outside of each leg
        g.rect(x + (3 if x > 16 else 0), 33 + b, 1, 10 + f - b, "grey")
        g.rect(x, 43 + f, 4, 2, "white")
        g.rect(x, 44 + f, 4, 1, "lgrey")
        g.rect(x + 1, 43 + f, 2, 1, "red")
    for x, d in ((5, -arms), (23, arms)):
        g.rect(x, 22 + b + d, 4, 4, "navy")
        g.rect(x, 26 + b + d, 4, 6, "dbrown")
        g.rect(x + 3, 26 + b + d, 1, 6, "plum")
        g.rect(x, 32 + b + d, 4, 3, "dbrown")
    # the black tee: slate catches the light down the left side and across the shoulders
    g.rect(9, 21 + b, 14, 13, "navy")
    g.rect(20, 21 + b, 3, 13, "ink")
    g.rect(10, 22 + b, 1, 11, "slate")
    g.rect(11, 22 + b, 8, 1, "slate")
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    g.rect(13, 19 + b, 6, 3, "dbrown")
    # bald head, the beard showing along the jaw, a shine on the crown
    g.rect(8, 12 + b, 2, 3, "dbrown")
    g.rect(22, 12 + b, 2, 3, "plum")
    g.blob(16, 12 + b, 7, 9, "dbrown", "plum", power=2.15)
    g.rect(11, 7 + b, 3, 1, "brown")
    g.p(11, 8 + b, "brown")
    # a light rim along the edges facing the light, a dimmer one opposite, so he holds on the dark road
    return rim(g, dict(navy=("grey", "grey"), ink=("grey", "grey"), slate=("lgrey", "grey"),
                       dbrown=("skin2", "brown"), plum=("skin2", "brown")))


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
    # a dirty blonde bob to the shoulders, flicking out at the ends: light brown, darker than her skin,
    # with golden amber streaks where the light catches it
    g.ell(16, 12.5 + b, 9, 9, "brown", "dbrown", "tan")
    g.rect(8, 14 + b, 17, 5, "brown")
    g.rect(22, 14 + b, 3, 5, "dbrown")
    g.ell(16, 19 + b, 9, 2.5, "brown", "dbrown")
    g.p(7, 20 + b, "brown")
    g.p(25, 20 + b, "dbrown")
    for x, y, h in ((10, 9, 5), (13, 6, 4), (16, 8, 6), (19, 6, 3)):
        g.rect(x, y + b, 1, h, "amber")
    g.rect(14, 11 + b, 1, 4, "dbrown")
    g.rect(20, 11 + b, 1, 4, "dbrown")
    # a light rim along the edges facing the light keeps her hair, cardigan and skirt off the dark road
    return rim(g, dict(brown=("tan", None), dgreen=("green", None), navy=("grey", None), dslate=("grey", None)))


WALKERS = {
    "walker-ada": walker_girl,
    "walker-ben": walker_man,
    "walker-trista": walker_teacher,
}


WALKER_WALK = [dict(lf=-2, rf=0, arms=1), dict(lf=-1, rf=-1, bob=-1), dict(lf=0, rf=-2, arms=-1), dict(lf=-1, rf=-1, bob=-1)]
WALKER_REACT = [dict(lf=-4, rf=-4, bob=-4, arms=-3), dict(lf=-1, rf=-1, bob=-1, arms=-1)]
# A bump: lurch left with the arms up, wobble back, steady (a right lean would push a tote out of the frame). Each pose is (lean, walker args).
WALKER_STUMBLE = [(-3, dict(lf=-3, rf=0, bob=1, arms=-3)), (1, dict(lf=0, rf=-3, arms=-3)),
                  (-1, dict(lf=-1, rf=0, arms=1)), (0, dict(lf=-1, rf=-1, bob=-1))]
# Waiting while the walk pauses: feet planted, arms at rest, a 1px breath.
WALKER_IDLE = [dict(), dict(bob=-1)]
# The breathing bob every standing person shares, and its frame duration in ms.
BREATH, BREATH_MS = (0, -1), 400


def lean(g, k):
    """Shear a 32x48 figure about its feet: the head moves k pixels sideways, the shoes stay put."""
    out = Grid(g.w, g.h)
    out.edge = g.edge
    for y in range(g.h):
        dx = round(k * max(0, 44 - y) / 36)
        for x in range(g.w):
            if g.px[y][x] and 0 <= x + dx < g.w:
                out.px[y][x + dx] = g.px[y][x]
    return out


# ---------- pickups ----------

def treat(lift=0):
    """A bone, outlined in plum so it holds on the light roads; its cream carries Woof Way."""
    g = edged(Grid(16, 16))
    y = 6 + lift
    g.rect(4, y, 8, 3, "cream")
    for cx, cy in ((3.5, y + 0.5), (3.5, y + 2.5), (12.5, y + 0.5), (12.5, y + 2.5)):
        g.ell(cx, cy, 1.8, 1.8, "cream", "tan")
    g.rect(4, y + 2, 8, 1, "tan")
    g.p(5, y, "white")
    g.p(3, y - 1, "white")
    return g


def tip(rx):
    """A coin spinning: rx is its half-width as it turns. Outlined in plum so it holds on the light roads,
    with a white glint on its lit edge."""
    g = edged(Grid(16, 16))
    if rx < 1.5:
        g.rect(7, 3, 2, 10, "orange")
        g.rect(7, 3, 1, 10, "amber")
        g.p(7, 4, "white")
        return g
    g.ell(8, 8, rx, 5.5, "amber", "orange", "yellow")
    if rx > 2:
        g.rect(8, 5, 1, 6, "orange")
        g.p(7, 6, "orange")
        g.p(9, 9, "orange")
    g.p(round(8 - rx * 0.55), 5, "white")
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
    squirrel_head(g, 14 + h, 25.5)
    return g


def squirrel_head(g, x, y):
    """The squirrel's head facing the player, centred on (x, y), with its ears and face."""
    g.tri((x - 4, y - 1.5), (x - 3.5, y - 6), (x - 1, y - 3), "ochre")
    g.tri((x + 4, y - 1.5), (x + 3.5, y - 6), (x + 1, y - 3), "ochre")
    g.ell(x, y, 4.5, 4, "ochre", "rust", "tan")
    g.ell(x, y + 2, 2.5, 1.5, "cream")
    g.rect(x - 3, y - 0.5, 2, 2, "ink")
    g.rect(x + 1, y - 0.5, 2, 2, "ink")
    g.p(x - 3, y - 0.5, "white")
    g.p(x + 1, y - 0.5, "white")
    g.rect(x - 1, y + 1.5, 2, 1, "plum")


def squirrel_run(gather):
    """The squirrel bounding down the road at the player. Stretched (gather False), it reaches its front
    paws ahead under its chin and kicks its hind feet out behind, low, with the tail streaming straight
    back; gathered, it is airborne 2px higher and bunched up, the hind feet tucked beside its cheeks and
    the tail swept up in an arch that curls to the side."""
    g = Grid()
    if gather:
        g.ell(19, 9, 4.5, 6, "ochre", "rust", "tan")
        g.ell(14.5, 3.5, 3.5, 2.5, "ochre", "rust", "tan")
        g.ell(19, 9.5, 2, 4, "tan")
        for x in (9, 20):
            g.rect(x, 20, 3, 2, "rust")
        g.ell(15, 17.5, 4.5, 4, "ochre", "rust", "tan")
        g.ell(15, 18.5, 2.5, 2.5, "cream")
        squirrel_head(g, 15, 23.5)
    else:
        g.ell(16.5, 9, 4.5, 6.5, "ochre", "rust", "tan")
        g.ell(15, 4, 3.5, 2.5, "ochre", "rust", "tan")
        g.ell(16.5, 9.5, 2, 4.5, "tan")
        for x in (10, 19):
            g.rect(x, 13, 2, 3, "rust")
        g.ell(15, 19.5, 3.5, 5.5, "ochre", "rust", "tan")
        g.ell(15, 20.5, 1.5, 3.5, "cream")
        for x in (10, 19):
            g.rect(x, 28, 2, 2, "tan")
        squirrel_head(g, 15, 26.5)
    return g


def puddle(f, w=88, h=32):
    """The road's 2-lane puddle; cards draw a 32x16 one. Wide puddles get a second lobe."""
    g = Grid(w, h)
    lobes = [(w / 2, h / 2, w / 2 - 2, h / 2 - 2)]
    if w > 40:
        lobes = [(w * 0.36, h * 0.52, w * 0.34, h / 2 - 3), (w * 0.66, h * 0.46, w * 0.32, h / 2 - 4)]
    for cx, cy, rx, ry in lobes:
        g.ell(cx, cy, rx, ry, "blue")
    for cx, cy, rx, ry in lobes:
        g.ell(cx, cy + 0.5, rx - 1, ry - 1, "sky")
    s = 1 if f else 0
    for fx, fy, fw in ((0.28, 0.31, 0.125), (0.59, 0.56, 0.16), (0.41, 0.69, 0.06), (0.75, 0.3, 0.1)):
        if w > 40 or fx < 0.7:
            g.rect(round(fx * w) + (s if fx < 0.5 else -s), round(fy * h), max(2, round(fw * w)), 1, "cyan")
    return g


def skunk_cloud(step):
    """88x88 spray cloud drawn under the skunk: puffs with a solid rim and a 2x2-dithered
    fill, so the road shows through. The puffs swell in turn. The rim is two pixels: teal outside,
    which holds 3:1 on the light roads, and green inside it, which holds on Woof Way."""
    g = Grid(88, 88)
    puffs = [(44, 44, 30), (24, 28, 17), (64, 26, 18), (22, 62, 18), (64, 64, 18), (44, 14, 13), (44, 74, 13),
             (12, 44, 11), (76, 44, 11)]
    puffs = [(cx, cy, r + (1 if (i + step) % 4 == 0 else 0)) for i, (cx, cy, r) in enumerate(puffs)]
    dist = [[min(((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5 / r for cx, cy, r in puffs) for x in range(88)]
            for y in range(88)]

    def inside(x, y):
        return 0 <= x < 88 and 0 <= y < 88 and dist[y][x] <= 1

    def beside(x, y, test):
        return any(test(x + dx, y + dy) for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)))

    outer = {(x, y) for y in range(88) for x in range(88)
             if inside(x, y) and beside(x, y, lambda a, b: not inside(a, b))}
    for y in range(88):
        for x in range(88):
            if not inside(x, y):
                continue
            if (x, y) in outer:
                g.p(x, y, "teal")
            elif dist[y][x] > 1 - 1.6 / 14 or beside(x, y, lambda a, b: (a, b) in outer):
                g.p(x, y, "green")
            elif x % 2 == (y // 2 + step) % 2 and y % 2 == 0:
                g.p(x, y, "green" if (x + y) % 8 else "dgreen")
    for x0, y0 in ((20, 22), (60, 18), (66, 58), (26, 58)):
        for k in range(6):
            g.p(x0 + (k + step) % 3 - 1, y0 + k, "dgreen")
    return g


def corgi(fl=0, fr=0, bl=0, br=0, bob=0):
    """The other dog trotting toward the player. Each leg offset moves a paw along the road, positive
    toward the player: the hind paws peek out beside the rump, the front paws beside the jaw."""
    g = Grid()
    g.rect(10, 4 + bl, 2, 4, "ochre")
    g.rect(20, 4 + br, 2, 4, "rust")
    g.rect(10, 26 + fl, 2, 3, "white")
    g.rect(20, 26 + fr, 2, 3, "lgrey")
    b = bob
    g.ell(16, 13 + b, 6.5, 8, "ochre", "rust", "tan")
    g.ell(16, 17 + b, 4, 4, "white", "lgrey")
    g.tri((10, 24 + b), (8.5, 14.5 + b), (14, 19 + b), "ochre")
    g.tri((22, 24 + b), (23.5, 14.5 + b), (18, 19 + b), "ochre")
    g.tri((10.5, 21.5 + b), (9.5, 16.5 + b), (12.5, 19.5 + b), "pink")
    g.tri((21.5, 21.5 + b), (22.5, 16.5 + b), (19.5, 19.5 + b), "pink")
    g.ell(16, 23.5 + b, 6, 5, "ochre", "rust", "tan")
    g.ell(16, 25.5 + b, 3.5, 2.5, "white", "lgrey")
    g.rect(15, 18 + b, 2, 4, "white")
    g.rect(12, 22 + b, 2, 2, "ink")
    g.rect(18, 22 + b, 2, 2, "ink")
    g.p(12, 22 + b, "white")
    g.p(18, 22 + b, "white")
    g.rect(15, 25 + b, 2, 1, "ink")
    g.rect(11, 18 + b, 10, 1, "amber")
    return g


# The other dog's trot, as dogs.WALK has it: diagonal pairs swap on beats 0 and 2 and the body bobs up
# on the passing beats. Each beat lasts half the old two-frame step, so the dog keeps its pace.
CORGI_WALK = [dict(fl=1, fr=-1, bl=-1, br=1), dict(bob=-1), dict(fl=-1, fr=1, bl=1, br=-1), dict(bob=-1)]


def person(top, legs="navy", shoes="ink", lf=0, rf=0, bob=0):
    """A chibi person facing the player: legs and shoes, then the caller's top(g, bob)."""
    g = Grid(32, 48)
    for x, f in ((11, lf), (17, rf)):
        g.rect(x, 33 + bob, 4, 10 + f - bob, legs)
        g.rect(x + 3, 33 + bob, 1, 10 + f - bob, DARKER[K[legs]])
        g.rect(x, 43 + f, 4, 2, shoes)
    top(g, bob)
    return g


def thief_top(g, b):
    """The thief coming down the road: striped shirt, beanie, mask and the loot sack over his shoulder."""
    for y in range(21 + b, 34 + b):
        stripe = "white" if (y - b) % 4 < 2 else "ink"
        g.rect(9, y, 14, 1, stripe)
    for x in (5, 23):
        for y in range(22 + b, 31 + b):
            g.rect(x, y, 4, 1, "white" if (y - b) % 4 < 2 else "ink")
        g.rect(x, 31 + b, 4, 3, "skin2")
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
    g.rect(14, 17 + b, 4, 1, "dbrown")
    g.p(18, 16 + b, "dbrown")


def thief_fleeing(stride):
    """The thief running off up the road, seen from behind: stride is -1 or 1, the side whose knee is up.
    The arms pump against the legs (the far arm bent forward and up, the near one swung back and low),
    and the loot sack bounces on his back."""
    g = Grid(32, 48)
    s = stride
    b = -1
    # legs: the lifted one is short, its shoe turned up to show the sole; the pushing one reaches the ground
    for x, lift in ((11, s < 0), (17, s > 0)):
        top = 33 + b
        if lift:
            g.rect(x, top, 4, 5, "navy")
            g.rect(x + 3, top, 1, 5, "ink")
            g.rect(x, top + 5, 4, 2, "ink")
            g.rect(x, top + 7, 4, 1, "dslate")
        else:
            g.rect(x, top, 4, 10 - b, "navy")
            g.rect(x + 3, top, 1, 10 - b, "ink")
            g.rect(x, 43, 4, 2, "ink")
    # arms: the one on the lifted leg's side swings back and low, the other is bent forward and up
    for x, back in ((5, s < 0), (23, s > 0)):
        if back:
            for y in range(25 + b, 33 + b):
                g.rect(x - (1 if x < 16 else -1), y, 4, 1, "white" if (y - b) % 4 < 2 else "ink")
            g.rect(x - (1 if x < 16 else -1), 33 + b, 4, 3, "skin2")
        else:
            for y in range(21 + b, 26 + b):
                g.rect(x, y, 4, 1, "white" if (y - b) % 4 < 2 else "ink")
            g.rect(x + (1 if x < 16 else -1), 26 + b, 3, 2, "skin2")
    for y in range(21 + b, 34 + b):
        g.rect(9, y, 14, 1, "white" if (y - b) % 4 < 2 else "ink")
    g.p(9, 21 + b, None)
    g.p(22, 21 + b, None)
    # loot sack slung over the right shoulder, bouncing a pixel against the stride, its neck gathered at the top
    k = b + (1 if s > 0 else 0)
    g.ell(22, 28 + k, 5, 5, "tan", "brown", "cream")
    g.tri((19.5, 24 + k), (24.5, 24 + k), (22, 19 + k), "tan")
    g.rect(21, 21 + k, 3, 2, "brown")
    g.rect(20, 23 + k, 5, 1, "dbrown")
    g.rect(21, 26 + k, 3, 1, "dbrown")
    g.p(21, 27 + k, "dbrown")
    g.rect(21, 28 + k, 3, 1, "dbrown")
    g.p(23, 29 + k, "dbrown")
    g.rect(21, 30 + k, 3, 1, "dbrown")
    # the back of the head: the beanie, the ears and the mask's band tied all the way round
    g.rect(14, 19 + b, 4, 3, "skin2")
    g.ell(16, 12.5 + b, 8, 8, "skin2", "brown", "skin1")
    g.rect(7, 13 + b, 2, 3, "skin2")
    g.rect(23, 13 + b, 2, 3, "brown")
    g.ell(16, 7.5 + b, 8.5, 5, "navy", "ink", "dslate")
    g.rect(8, 9 + b, 17, 2, "dslate")
    g.rect(8, 12 + b, 17, 2, "ink")
    return g


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
        # a glass biscuit jar held at the chest: a round body with a glint down its lit side, chocolate-chip
        # biscuits stacked inside, a narrow neck and a red lid with a knob
        g.ell(14.5, 29 + b, 5.5, 5, "lgrey", "grey", "white")
        for x, y in ((12.5, 31), (16.5, 31), (14.5, 27.5)):
            g.ell(x, y + b, 2, 1.5, "tan", "brown")
            g.p(x - 1, y + b - 1, "dbrown")
            g.p(x + 0.5, y + b - 0.5, "dbrown")
        g.rect(10, 26 + b, 1, 4, "white")
        g.rect(10, 22 + b, 9, 2, "red")
        g.rect(10, 23 + b, 9, 1, "dred")
        g.rect(13, 21 + b, 3, 1, "red")
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
    """The bark pop: a white bubble with a red mark, outlined in plum on every side so it holds on the light roads."""
    g = edged(Grid(16, 16), lambda c: K["plum"])
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

def stop_sign(glint=None):
    """glint is the diagonal x + y = glint along which a pink sheen crosses the red face, or None."""
    g = Grid(32, 48)
    g.rect(15, 22, 3, 24, "grey")
    g.rect(17, 22, 1, 24, "slate")
    g.rect(13, 45, 7, 2, "slate")
    # an 18px octagon, its corners cut in 5 one-pixel stairs, shaded dred along the lower-right edges
    for y in range(18):
        cut = max(0, 5 - y, y - 12)
        g.rect(7 + cut, 4 + y, 18 - 2 * cut, 1, "red")
        if y >= 6:
            g.p(24 - cut, 4 + y, "dred")
    g.rect(12, 21, 8, 1, "dred")
    for i, ch in enumerate(("S", "T", "O", "P")):
        x = 8 + i * 4
        bits = {"S": "011100010001110", "T": "111010010010010", "O": "010101101101010", "P": "110101110100100"}[ch]
        for r in range(5):
            for k in range(3):
                if bits[r * 3 + k] == "1":
                    g.p(x + k, 10 + r, "white")
    if glint is not None:
        # the sheen stays inside the face, so the outline stays dark
        for y in range(5, 21):
            x = glint - y
            if 0 < x < g.w and g.px[y][x] == K["red"] and g.px[y - 1][x] and g.px[y][x - 1]:
                g.p(x, y, "pink")
    return g


def chatty_top(wave):
    def top(g, b):
        g.rect(9, 21 + b, 14, 13, "cream")
        g.rect(11, 21 + b, 10, 12, "dgreen")
        g.rect(19, 21 + b, 2, 12, "forest")
        if wave:
            g.rect(23, 12 + b, 4, 10, "cream")
            g.rect(23, 9 + b, 4, 3, "skin2")
        else:
            g.rect(23, 22 + b, 4, 9, "cream")
            g.rect(23, 31 + b, 4, 3, "skin2")
        # the left arm bent across the chest, holding a red mug of coffee steady through the wave:
        # the handle sticks out on the right, the hand cups it from the left
        g.rect(5, 22 + b, 4, 7, "cream")
        g.rect(5, 27 + b, 6, 3, "cream")
        g.rect(11, 24 + b, 5, 6, "red")
        g.rect(11, 24 + b, 1, 6, "pink")
        g.rect(15, 24 + b, 1, 6, "dred")
        g.rect(12, 24 + b, 3, 1, "dbrown")
        g.rect(16, 25 + b, 2, 1, "red")
        g.rect(17, 26 + b, 1, 2, "dred")
        g.rect(16, 28 + b, 2, 1, "dred")
        g.rect(10, 27 + b, 2, 3, "skin2")
        g.p(10, 27 + b, "skin1")
        g.ell(16, 12.5 + b, 8, 8, "skin2", "brown", "skin1")
        g.ell(16, 7 + b, 7, 3.5, "lgrey", "grey", "white")
        g.rect(8, 9 + b, 2, 5, "lgrey")
        g.rect(22, 9 + b, 2, 5, "lgrey")
        face_front(g, 16, 13 + b)
        g.rect(13, 16 + b, 6, 1, "lgrey")
        g.p(12, 17 + b, "lgrey")
        g.p(19, 17 + b, "lgrey")
    return top


def kid(wave=False, mood="happy", bob=0):
    g = Grid(32, 48)
    b = bob
    for x in (12, 17):
        g.rect(x, 38 + b, 3, 6 - b, "skin1")
        g.rect(x, 44, 3, 2, "red")
    g.rect(10, 28 + b, 12, 10, "yellow")
    g.rect(19, 28 + b, 3, 10, "amber")
    g.rect(10, 35 + b, 12, 3, "sky")
    g.rect(7, 29 + b, 3, 6, "yellow")
    g.rect(7, 35 + b, 3, 2, "skin1")
    if wave:
        g.rect(22, 20 + b, 3, 8, "yellow")
        g.rect(22, 18 + b, 3, 2, "skin1")
    else:
        g.rect(22, 29 + b, 3, 6, "yellow")
        g.rect(22, 35 + b, 3, 2, "skin1")
    g.ell(16, 20.5 + b, 7.5, 7.5, "skin1", "skin2")
    g.ell(16, 15.5 + b, 8, 4, "red", "dred", "pink")
    g.rect(16, 17 + b, 9, 2, "red")
    g.rect(8, 18 + b, 2, 4, "ochre")
    g.rect(22, 18 + b, 2, 4, "ochre")
    face_front(g, 16, 21 + b, mood if mood != "sad" else "neutral")
    if mood == "sad":
        g.rect(15, 26 + b, 2, 1, "dbrown")
        g.p(14, 27 + b, "dbrown")
        g.p(17, 27 + b, "dbrown")
        g.p(10, 23 + b, "cyan")
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
    """f swaps which lamp is lit. Striped like obstacles.barrier so the stripes hold steady at depth: the
    board's stripes are 8px orange every 16px, leaning right in 2-row stairs that start on even columns
    and stop at the board's ends, and its bottom stair is the shaded lower edge. The lower rail's squares
    and the posts are 4px wide on even columns."""
    g = Grid(56, 32)
    for x in (6, 46):
        g.rect(x, 12, 4, 18, "grey")
        g.rect(x + 2, 12, 2, 18, "slate")
    for k, (base, stripe) in enumerate((("white", "orange"),) * 3 + (("lgrey", "rust"),)):
        y = 12 + 2 * k
        g.rect(3, y, 50, 2, base)
        for x in range(10 - 2 * k - 16, 53, 16):
            g.rect(max(x, 3), y, min(x + 8, 53) - max(x, 3), 2, stripe)
    g.rect(3, 22, 50, 4, "white")
    for x in range(4, 52, 8):
        g.rect(x, 22, 4, 4, "orange")
    g.ell(7.5, 8, 2.5, 2.5, "amber" if f else "orange", "orange", "yellow" if f else None)
    g.ell(47.5, 8, 2.5, 2.5, "orange" if f else "amber", "orange", None if f else "yellow")
    g.rect(20, 3, 16, 8, "amber")
    g.rect(20, 3, 16, 1, "orange")
    g.rect(23, 6, 10, 2, "plum")
    g.tri((21, 7), (25, 4), (25, 10), "plum")
    return g


def mail_top(g, b):
    """The mail carrier: a sky-blue shirt and cap, a navy brim, dark skin and a mailbag on a strap."""
    g.rect(9, 21 + b, 14, 12, "sky")
    g.rect(20, 21 + b, 3, 12, "blue")
    g.rect(15, 21 + b, 2, 12, "cyan")
    g.rect(5, 22 + b, 4, 9, "sky")
    g.rect(8, 22 + b, 1, 9, "blue")
    g.rect(5, 31 + b, 4, 3, "dbrown")
    g.rect(23, 22 + b, 4, 9, "sky")
    g.rect(26, 22 + b, 1, 9, "blue")
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
    g.ell(16, 7 + b, 8.5, 3.5, "sky", "blue", "cyan")
    g.rect(8, 9 + b, 17, 2, "navy")
    g.rect(15, 5 + b, 2, 2, "amber")
    face_front(g, 16, 13 + b, eyes="ink", lips="ink")
    g.p(11, 13 + b, "white")
    g.p(19, 13 + b, "white")


def mail_carrier(**q):
    """The mail carrier facing the player, with a light rim on the dark skin, brim and trousers so they hold
    on Woof Way, and the road outline for the light roads."""
    g = edged(person(mail_top, legs="navy", shoes="ink", **q))
    return rim(g, dict(dbrown=("skin2", "brown"), plum=("skin2", "brown"), navy=("grey", "slate"),
                       ink=("grey", "slate"), sky=("cyan", None), blue=("sky", None)))


# ---------- scenery gags (front view, in the backdrop band) ----------

def cat(tail=0, blink=False, alert=False):
    """A ginger cat sitting on a fence post; the game places its paws on the fence's top rail."""
    g = Grid(24, 24)
    tx = (0, 1, 2, 1)[tail]
    # tail curling up the right side
    g.rect(17 + tx, 10, 2, 8, "ochre")
    g.rect(16 + tx, 9, 3, 2, "ochre")
    g.p(17 + tx, 8, "rust")
    # body and front paws
    g.ell(12, 17.5, 6, 5.5, "ochre", "rust", "tan")
    g.ell(12, 18.5, 3, 3.5, "cream")
    g.rect(9, 22, 2, 1, "cream")
    g.rect(13, 22, 2, 1, "cream")
    # head and ears
    hy = 9 if alert else 10
    g.tri((6.5, hy - 1), (7.5, hy - 6 - (1 if alert else 0)), (10.5, hy - 3), "ochre")
    g.tri((17.5, hy - 1), (16.5, hy - 6 - (1 if alert else 0)), (13.5, hy - 3), "ochre")
    g.p(8, hy - 3, "pink")
    g.p(15, hy - 3, "pink")
    g.ell(12, hy + 1, 5.5, 4.5, "ochre", "rust", "tan")
    for x in (9, 14):
        if blink:
            g.rect(x, hy + 1, 2, 1, "plum")
        else:
            g.rect(x, hy, 2, 2, "green")
            g.p(x + (1 if x < 12 else 0), hy, "ink")
    g.p(12, hy + 3, "pink")
    g.rect(10, hy + 2, 1, 1, "cream")
    g.rect(13, hy + 2, 1, 1, "cream")
    if alert:
        g.rect(19, 2, 1, 3, "white")
        g.p(19, 6, "white")
    return g


def sprinkler(step):
    """A lawn sprinkler sweeping a fan of water across the grass and back."""
    g = Grid(32, 24)
    g.rect(14, 18, 4, 4, "grey")
    g.rect(13, 21, 6, 2, "slate")
    g.rect(15, 15, 2, 4, "lgrey")
    g.rect(0, 22, 13, 1, "dgreen")
    import math
    # the arm sweeps across and back within the loop, so it never snaps from one side to the other
    angle = (-60, 0, 60, 0)[step]
    for k in range(12):
        a = math.radians(angle - 90)
        r = 2 + k * 1.3
        x = 16 + math.cos(a) * r
        y = 15 + math.sin(a) * r + (k * k) * 0.06
        g.p(x, y, "cyan" if k % 3 else "white")
        g.p(x + 1, y + 1, "sky")
    for i in range(4):
        g.p(6 + i * 7 + step, 20 - (i + step) % 3, "cyan")
    return g


def ball(step):
    """A red and white ball; the game rolls it along the sidewalk."""
    g = Grid(14, 14)
    g.ell(7, 7, 5.5, 5.5, "red", "dred", "pink")
    for k in range(2):
        x = 2 + (k * 5 + step * 2) % 10
        for xx in (x, x + 1):
            for yy in range(2, 12):
                if g.px[yy][xx]:
                    g.p(xx, yy, "white" if g.px[yy][xx] != g.px[0][0] else None)
    g.p(5, 4, "white")
    return g


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    def frames(gs, outline=True):
        return [g.outlined(outline) for g in gs]

    # the walkers carry the leash on every road, so their outlines hold 3:1 on the light roads
    for key, draw in {"walker-casey": walker, **WALKERS}.items():
        def pose(**q):
            return edged(draw(**q))

        yield key, [("walk", frames(pose(**q) for q in WALKER_WALK), 160),
                    ("react", frames(pose(**q) for q in WALKER_REACT), 120),
                    ("stumble", frames(lean(pose(**q), k) for k, q in WALKER_STUMBLE), 90),
                    ("idle", frames(pose(**q) for q in WALKER_IDLE), BREATH_MS)]
    yield "treat", [("idle", frames([treat(0), treat(-1)]), 400)]
    yield "tip", [("idle", frames(tip(rx) for rx in (5.5, 3.5, 1, 3.5)), 120)]
    yield "skunk", [("idle", frames([skunk(0), skunk(1)]), 400)]
    yield "squirrel", [("idle", frames([squirrel(0), squirrel(1)]), 300),
                       ("run", frames(squirrel_run(k) for k in (False, True)), 120)]
    yield "puddle", [("idle", frames([puddle(0), puddle(1)], outline=False), 500)]
    yield "skunk-cloud", [("loop", frames((skunk_cloud(i) for i in range(4)), outline=False), 220)]
    yield "other-dog", [("walk", frames(corgi(**q) for q in CORGI_WALK), 100)]
    yield "other-dog-owner", [("walk", [person(dog_owner_top, shoes="dbrown", lf=-2).outlined(),
                                        person(dog_owner_top, shoes="dbrown", rf=-2).outlined()], 200),
                              ("idle", [person(dog_owner_top, shoes="dbrown", bob=bb).outlined() for bb in BREATH],
                               BREATH_MS)]
    yield "thief", [("walk", [person(thief_top, lf=-2).outlined(), person(thief_top, rf=-2).outlined()], 200),
                    ("flee", frames(thief_fleeing(k) for k in (-1, 1)), 110),
                    ("idle", [person(thief_top, bob=bb).outlined() for bb in BREATH], BREATH_MS)]
    yield "lost-wallet", [("idle", frames([wallet(False), wallet(True)]), 450)]
    yield "biscuit-neighbour", [("wave", [person(neighbour_top(w), legs="purple", shoes="dbrown").outlined()
                                          for w in (False, True)], 350),
                                ("idle", [person(neighbour_top(False), legs="purple", shoes="dbrown", bob=bb).outlined()
                                          for bb in BREATH], BREATH_MS)]
    yield "photo-op", [("idle", [person(tourist_top(False), legs="skin2", shoes="sky", bob=bb).outlined()
                                 for bb in BREATH], BREATH_MS),
                       ("flash", [person(tourist_top(True), legs="skin2", shoes="sky").outlined(),
                                  person(tourist_top(False), legs="skin2", shoes="sky").outlined()], 120)]
    yield "fx-bark", [("pop", frames([bark(False), bark(True)]), 120)]
    # the cat blinks once a loop, briefly, as its tail swings home; the loop keeps its 1040ms
    yield "gag-cat", [("idle", frames([cat(0), cat(1), cat(2), cat(3, blink=True)]), [300, 300, 300, 140]),
                      ("react", frames([cat(1, alert=True), cat(2, alert=True)]), 200)]
    yield "gag-sprinkler", [("spray", frames(sprinkler(i) for i in range(4)), 140)]
    yield "gag-ball", [("roll", frames(ball(i) for i in range(4)), 90)]
    # the sheen crosses the sign's top-left half, lit side, then the sign rests for two frames
    yield "stop-sign", [("idle", frames(stop_sign(c) for c in (None, None, 18, 24)), 400)]
    yield "chatty-neighbour", [("wave", [person(chatty_top(w), legs="brown", shoes="dbrown").outlined() for w in (False, True)], 350),
                               ("idle", [person(chatty_top(False), legs="brown", shoes="dbrown", bob=bb).outlined()
                                         for bb in BREATH], BREATH_MS)]
    yield "kid", [("wave", frames([kid(False), kid(True)]), 300), ("sad", frames([kid(False, "sad")]), 1000),
                  ("idle", frames(kid(bob=bb) for bb in BREATH), BREATH_MS)]
    yield "ice-cream-truck", [("idle", frames([ice_cream_truck(0), ice_cream_truck(1)]), 400)]
    yield "construction", [("idle", frames([construction(0), construction(1)]), 500)]
    yield "mail-carrier", [("walk", [mail_carrier(lf=-2).outlined(), mail_carrier(rf=-2).outlined()], 200),
                           ("idle", [mail_carrier(bob=bb).outlined() for bb in BREATH], BREATH_MS)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/road", __doc__, anchored=road_sprite)
