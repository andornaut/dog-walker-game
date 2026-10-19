#!/usr/bin/env python3
"""Draw the road effects for collisions and pickups. No outlines: effects sit
over sprites and read as light, not as objects. fx-heart is the exception: it
is a token, like fx-bark, so it keeps its outline over the doghouse roofs.

fx-bump     32x32  play (5 frames)  impact star where the pack hits an obstacle
fx-dizzy    32x16  loop (4 frames)  stars circling over the pack while it stumbles
fx-coins    32x32  play (6 frames)  two coins knocked loose ($2 dropped on a minor bump)
fx-splash   32x32  play (5 frames)  water thrown up by a puddle
fx-stinky   32x32  loop (4 frames)  green stink lines over the pack while Stinky lasts
fx-sparkle  16x16  play (4 frames)  twinkle where a treat or tip is collected
fx-heart    16x16  up (5 frames)    a heart floating up from a dog slot (+1 heart)
                   down (5 frames)  a heart cracking and falling apart (-1 heart)

Usage:
  fx.py preview OUT.png   every frame of every effect on the street colours
  fx.py build             write art/fx/*.aseprite, export to public/art/sprites/
                          and list them in the manifest

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import Grid, main  # noqa: E402


def star4(g, cx, cy, r, col, core="white"):
    """A four-point twinkle: a plus with arms r long and a lit centre."""
    for k in range(-r, r + 1):
        g.p(cx + k, cy, col)
        g.p(cx, cy + k, col)
    if r >= 3:
        g.rect(cx - 1, cy - 1, 3, 3, col)
    g.p(cx, cy, core)


def burst(g, cx, cy, r_out, r_in, points, col, turn=0.0):
    pts = []
    for i in range(points * 2):
        a = math.radians(i * 180 / points + turn - 90)
        r = r_out if i % 2 == 0 else r_in
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    for i in range(len(pts)):
        g.tri((cx, cy), pts[i], pts[(i + 1) % len(pts)], col)


def bump(step):
    g = Grid(32, 32)
    if step == 0:
        burst(g, 16, 16, 6, 2.5, 4, "white")
    elif step == 1:
        burst(g, 16, 16, 13, 5, 8, "amber", 11)
        burst(g, 16, 16, 9, 3.5, 8, "yellow", 11)
        g.ell(16, 16, 3, 3, "white")
    elif step == 2:
        burst(g, 16, 16, 14, 6, 8, "orange", 11)
        burst(g, 16, 16, 10, 4, 8, "yellow", 11)
        g.ell(16, 16, 4.5, 4.5, None)
    else:
        r, col = (11, 13)[step - 3], ("amber", "orange")[step - 3]
        for i in range(8):
            a = math.radians(i * 45 + 11 - 90)
            x, y = 16 + math.cos(a) * r, 16 + math.sin(a) * r
            g.rect(x - (step == 3), y - (step == 3), 2 if step == 3 else 1, 2 if step == 3 else 1, col)
    return g


def dizzy(step):
    g = Grid(32, 16)
    for i in range(3):
        a = math.radians(step * 30 + i * 120)
        x, y = 16 + math.cos(a) * 11, 8 + math.sin(a) * 3.5
        if math.sin(a) > -0.2:
            star4(g, round(x), round(y), 2, "yellow")
        else:
            star4(g, round(x), round(y), 1, "amber", "yellow")
    return g


def coins(step):
    g = Grid(32, 32)
    for side in (-1, 1):
        t = step + (0 if side < 0 else 0.5)
        x = 16 + side * (2 + t * 2.2)
        y = 18 - t * 4.2 + t * t * 0.75
        rx = (2.5, 1.5, 0.6, 1.5)[int(t) % 4]
        g.ell(x, y, rx + 0.5, 3, "amber", "orange", "yellow")
        if step < 2:
            g.p(x, y - 1, "white")
    return g


def splash(step):
    g = Grid(32, 32)
    if step < 2:
        g.ell(16, 26, 7 + step * 4, 2 + step, "sky", "blue", "cyan")
        g.ell(16, 26, 4 + step * 3, 1 + step * 0.6, None)
    for i, (vx, vy) in enumerate(((-3, -5), (-1.6, -7), (0, -8), (1.6, -7), (3, -5), (-4.4, -3), (4.4, -3))):
        t = step + 0.8
        x, y = 16 + vx * t * 0.9, 25 + vy * t + 1.6 * t * t
        if y < 31:
            g.rect(x, y, 2 if i % 2 else 1, 2, "cyan" if step < 3 else "sky")
            if step < 2:
                g.p(x, y - 1, "white")
    return g


def stinky(step):
    g = Grid(32, 32)
    for i, x0 in enumerate((7, 15, 23)):
        for y in range(4, 26):
            phase = (y + step * 3 + i * 4) / 3.2
            x = x0 + round(math.sin(phase) * 1.6)
            fade = (y + step * 3 + i * 5) % 22
            if fade > 3:
                # green reads on the dark street, its teal edge on the light roads
                g.p(x, y, "green")
                g.p(x + 1, y, "teal")
    return g


def sparkle(step):
    g = Grid(16, 16)
    r = (2, 5, 3, 1)[step]
    star4(g, 8, 8, r, ("white", "yellow", "amber", "yellow")[step], "white")
    if step in (1, 2):
        for dx, dy in ((-5, -5), (5, -4), (-4, 5), (5, 5)):
            g.p(8 + dx * (step / 1.5), 8 + dy * (step / 1.5), "white" if step == 1 else "yellow")
    return g


HEART = [".111.111.", "122111111", "121111113", "111111113", ".1111113.", "..11113..", "...113...", "....1...."]
SMALL = [".11.11.", "1211111", "1111113", ".11113.", "..113..", "...1..."]
# The crack's column in each row of HEART; the left half keeps what is left of it.
CRACK = [4, 4, 5, 4, 3, 4, 4, 4]


def stamp(g, rows, x0, y0, cols=("red", "pink", "dred"), keep=None):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != "." and (keep is None or keep(x, y)):
                g.p(x0 + x, y0 + y, cols["123".index(ch)])


def heart_up(step):
    """Pops in small at the slot, grows and rises, then shrinks to a pink glint at the top."""
    g = Grid(16, 16)
    if step == 0:
        stamp(g, SMALL, 5, 9)
    elif step < 4:
        stamp(g, HEART, 4, (7, 4, 2)[step - 1])
        if step == 1:
            for x, y in ((2, 9), (13, 8), (3, 4)):
                g.p(x, y, "white")
    else:
        stamp(g, SMALL, 5, 1, ("pink", "white", "red"))
    return g


def heart_down(step):
    """Cracks down the middle, then the halves split and drop, darkening as they fall."""
    g = Grid(16, 16)
    if step == 0:
        stamp(g, HEART, 4, 1)
    elif step == 1:
        stamp(g, HEART, 4, 1)
        for y, x in enumerate(CRACK):
            g.p(4 + x, 1 + y, "plum")
    else:
        spread, drop = (1, 2, 2)[step - 2], (1, 3, 5)[step - 2]
        cols = ("red", "pink", "dred") if step < 4 else ("dred", "red", "plum")
        stamp(g, HEART, 4 - spread, 1 + drop, cols, lambda x, y: x < CRACK[y])
        stamp(g, HEART, 4 + spread, 1 + drop + 1, cols, lambda x, y: x > CRACK[y])
    return g


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    yield "fx-bump", [("play", [bump(i).outlined(False) for i in range(5)], 60)]
    yield "fx-dizzy", [("loop", [dizzy(i).outlined(False) for i in range(4)], 110)]
    yield "fx-coins", [("play", [coins(i).outlined(False) for i in range(6)], 80)]
    yield "fx-splash", [("play", [splash(i).outlined(False) for i in range(5)], 70)]
    yield "fx-stinky", [("loop", [stinky(i).outlined(False) for i in range(4)], 180)]
    yield "fx-sparkle", [("play", [sparkle(i).outlined(False) for i in range(4)], 60)]
    yield "fx-heart", [("up", [heart_up(i).outlined() for i in range(5)], 90),
                       ("down", [heart_down(i).outlined() for i in range(5)], 90)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/fx", __doc__, grounds=("3a4466", "c0cbdc"))
