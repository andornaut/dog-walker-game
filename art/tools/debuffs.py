#!/usr/bin/env python3
"""Draw the four contact-debuff bursts, at full size over the struck dog.

fx-debuff-muddy, -spotlight, -stinky, -zoomies are 96x96, play (8 frames,
90ms each, 720ms). Frame 2 is the reduced-motion peak. Their frame centre
(48,48) sits on the dog's centre column, 6px above its top opaque row.
The lower centre stays clear so the dog remains visible. Every burst shows
its own motif from frame 0, expands into two peak frames, then shrinks and rises.
There are no depth variants, baked-in words, shadows or partial alpha.

Muddy throws a dripping brown paw and mud crown; Spotlight's angled lamp
opens a blue beam in yellow edges; Stinky swells pink-lit mauve gas and
rising curls; Zoomies circles green motion trails around an amber paw. Each part has a
1px plum rim for the light roads and a pale fill or highlight for dark roads.

Usage:
  debuffs.py preview OUT.png   every frame on the zone roads
  debuffs.py build             write art/debuffs/*.aseprite and export
                              public/art/sprites/*.png and *.json

Run from the repository root. Edit this script, not the generated sources.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fx import rim  # noqa: E402
from pixel import Grid, main  # noqa: E402

SIDE = 96
GROW = (0.78, 0.94, 1, 1, 0.96, 0.84, 0.63, 0.38)
RISE = (0, 0, 0, 0, 1, 3, 6, 9)
FRAME_MS = 90
PEAK = 2


def point(step, x, y):
    """A design point as the burst expands about its centre and rises away."""
    s = GROW[step]
    return 48 + (x - 48) * s, 48 + (y - 48) * s - RISE[step]


def oval(g, step, x, y, rx, ry, fill, shade=None, light=None):
    g.cel(*point(step, x, y), max(2, rx * GROW[step]), max(2, ry * GROW[step]), fill, shade, light)


def stroke(g, points, colour, width=3):
    """Connected square pixel clusters, with no one-pixel flecks."""
    for a, b in zip(points, points[1:]):
        n = max(1, math.ceil(max(abs(b[0] - a[0]), abs(b[1] - a[1]))))
        for k in range(n + 1):
            x, y = (a[i] + (b[i] - a[i]) * k / n for i in (0, 1))
            g.rect(round(x - width / 2), round(y - width / 2), width, width, colour)


def path(g, step, points, colour, width=3):
    stroke(g, [point(step, x, y) for x, y in points], colour, max(2, round(width * GROW[step])))


def polygon(g, step, points, colour):
    pts = [point(step, x, y) for x, y in points]
    for y in range(SIDE):
        crosses = []
        for a, b in zip(pts, pts[1:] + pts[:1]):
            if min(a[1], b[1]) <= y + 0.5 < max(a[1], b[1]):
                crosses.append(a[0] + (b[0] - a[0]) * (y + 0.5 - a[1]) / (b[1] - a[1]))
        crosses.sort()
        for left, right in zip(crosses[::2], crosses[1::2]):
            for x in range(max(0, math.ceil(left - 0.5)), min(SIDE, math.ceil(right - 0.5))):
                g.p(x, y, colour)


def part(dst, draw):
    """Keep each overlapping part distinct with the effects' fixed plum rim."""
    g = Grid(SIDE, SIDE)
    draw(g)
    rim(g)
    for y, row in enumerate(g.px):
        for x, c in enumerate(row):
            if c:
                dst.px[y][x] = c


def impact_ticks(g, step, colour):
    """Two large, short outward marks on arrival, clear of the effect's motif."""
    if step > 1:
        return
    for side in (-1, 1):
        part(g, lambda p: path(p, step, [(48 + side * 33, 17), (48 + side * 39, 10)], colour, 4))


def paw(g, step, fill, shade, light, dx=0):
    """The HUD's four-toed paw motif, redrawn as large clean shapes for the contact burst."""
    for x, y, rx, ry in ((32, 26, 5, 7), (42, 17, 5, 7), (54, 17, 5, 7), (65, 26, 5, 7)):
        part(g, lambda p, x=x, y=y, rx=rx, ry=ry: oval(p, step, x + dx, y, rx, ry, fill, shade, light))

    def pad(p):
        oval(p, step, 48 + dx, 41, 13, 10, fill, shade, light)
        oval(p, step, 42 + dx, 46, 6, 5, fill, shade)
        oval(p, step, 54 + dx, 46, 6, 5, fill, shade)
    part(g, pad)


def muddy(step):
    """A dripping muddy paw above a mud crown rising either side of the dog."""
    g = Grid(SIDE, SIDE)

    def crown(p):
        polygon(p, step, [(12, 68), (17, 43), (26, 52), (29, 37), (38, 49),
                          (48, 45), (58, 49), (67, 37), (70, 52), (79, 43), (84, 68),
                          (64, 71), (62, 55), (34, 55), (32, 71)], "brown")
        polygon(p, step, [(12, 68), (17, 56), (27, 63), (32, 59), (32, 71)], "dbrown")
        polygon(p, step, [(64, 71), (67, 55), (78, 62), (84, 68)], "dbrown")
        path(p, step, [(19, 47), (22, 57), (29, 61)], "tan", 4)
        path(p, step, [(31, 43), (34, 50), (40, 51)], "tan", 4)
        path(p, step, [(61, 49), (65, 43)], "tan", 4)
        path(p, step, [(75, 48), (78, 61)], "tan", 4)
    part(g, crown)
    for x, y, rx, ry in ((17, 25, 4, 6), (79, 22, 4, 6)):
        part(g, lambda p, x=x, y=y, rx=rx, ry=ry: oval(p, step, x, y, rx, ry, "brown", "dbrown", "tan"))
    paw(g, step, "brown", "dbrown", "tan")
    part(g, lambda p: path(p, step, [(43, 47), (43, 55)], "brown", 4))
    part(g, lambda p: path(p, step, [(54, 47), (54, 52)], "brown", 4))
    impact_ticks(g, step, "cream")
    return g


def spotlight(step):
    """An angled stage lamp opens a cone of light around the dog, with a bright pool below."""
    g = Grid(SIDE, SIDE)

    def pool(p):
        oval(p, step, 53, 72, 31, 7, "yellow", "amber", "white")
        oval(p, step, 53, 71, 24, 4, None)
    part(g, pool)

    def beam(p):
        polygon(p, step, [(31, 26), (37, 28), (32, 65), (23, 66)], "blue")
        polygon(p, step, [(37, 22), (42, 19), (84, 65), (75, 69)], "blue")
        path(p, step, [(31, 27), (24, 64)], "yellow", 4)
        path(p, step, [(42, 23), (82, 64)], "yellow", 4)
        path(p, step, [(35, 35), (31, 55)], "sky", 3)
    part(g, beam)
    def lamp(p):
        polygon(p, step, [(15, 14), (25, 4), (43, 20), (32, 32)], "dslate")
        polygon(p, step, [(16, 14), (25, 5), (29, 9), (20, 19)], "grey")
        path(p, step, [(32, 30), (41, 21)], "white", 4)
        path(p, step, [(10, 14), (10, 27), (20, 33), (25, 29)], "grey", 3)
    part(g, lamp)
    for points in ([(65, 24), (73, 17)], [(79, 41), (89, 39)]):
        part(g, lambda p, points=points: path(p, step, points, "yellow", 4))
    impact_ticks(g, step, "white")
    return g


def stinky(step):
    """Pink-lit gas swells in an open arch, with three broad smell curls above it."""
    g = Grid(SIDE, SIDE)
    for x, y, rx, ry in ((21, 59, 13, 13), (23, 43, 15, 13), (37, 38, 15, 13),
                         (57, 38, 16, 13), (72, 45, 15, 13), (76, 61, 12, 11)):
        part(g, lambda p, x=x, y=y, rx=rx, ry=ry: oval(p, step, x, y, rx, ry, "mauve", "purple", "pink"))
    for x, top in ((25, 12), (48, 6), (71, 13)):
        sway = (step % 3 - 1) * 2
        points = [(x, top + 20), (x - 4, top + 15), (x - 4, top + 10),
                  (x + 3 + sway, top + 5), (x + 3 + sway, top)]
        part(g, lambda p, points=points: path(p, step, points, "pink", 4))
    impact_ticks(g, step, "white")
    return g


def zoomies(step):
    """Two green speed arcs and bold streaks race around the HUD's amber paw."""
    g = Grid(SIDE, SIDE)

    def arc(p, angles):
        pts = [(48 + math.cos(math.radians(a)) * 35,
                45 + math.sin(math.radians(a)) * 29) for a in angles]
        path(p, step, pts, "green", 7)
        lit = [(x - 1, y - 2) for x, y in pts]
        path(p, step, lit, "yellow", 3)
    part(g, lambda p: arc(p, range(150, 281, 5)))
    part(g, lambda p: arc(p, range(-30, 61, 5)))
    part(g, lambda p: polygon(p, step, [(16, 54), (7, 48), (9, 66), (27, 65)], "green"))
    part(g, lambda p: polygon(p, step, [(77, 22), (88, 23), (82, 8), (67, 13)], "green"))

    paw(g, step, "amber", "orange", "yellow", dx=5)
    for points in ([(10, 35), (26, 35)], [(7, 46), (30, 46)], [(12, 57), (26, 57)]):
        part(g, lambda p, points=points: path(p, step, points, "yellow", 4))
    impact_ticks(g, step, "white")
    return g


DEBUFFS = {"muddy": muddy, "spotlight": spotlight, "stinky": stinky, "zoomies": zoomies}


def sprites():
    for name, draw in DEBUFFS.items():
        yield f"fx-debuff-{name}", [("play", [draw(i).outlined(False) for i in range(len(GROW))], FRAME_MS)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/debuffs", __doc__)
