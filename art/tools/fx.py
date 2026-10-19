#!/usr/bin/env python3
"""Draw the road effects for collisions and pickups, and the new-best burst on
the end screen. fx-bump, fx-dizzy, fx-coins and fx-sparkle are warm light that
holds 3:1 on Woof Way but fades into the three light roads, so each carries a
1px plum rim (4.4:1 or more on those). fx-splash has no outline.
fx-heart is a token, like fx-bark, so it keeps its ramp outline over the
doghouse roofs. fx-new-best carries the plum rim too, for the cream panel and
the sunset sky of screen-end.

fx-bump     32x32  play (5 frames)  impact star where the pack hits an obstacle
fx-dizzy    32x16  loop (4 frames)  stars circling over the pack while it stumbles
fx-coins    32x32  play (6 frames)  two coins knocked loose ($2 dropped on a minor bump)
fx-splash   32x32  play (5 frames)  water thrown up by a puddle
fx-sparkle  16x16  play (4 frames)  twinkle where a treat or tip is collected
fx-heart    16x16  up (5 frames)    a heart floating up from a dog slot (+1 heart)
                   down (5 frames)  a heart cracking and falling apart (-1 heart)
fx-new-best 96x48  play (8 frames)  rays, sparkles and stars bursting from behind
                                    the ui-new-best ribbon (centred on it)
fx-bark-word 32x16 pop (4 frames, 60, 60, 140, 140ms)  WOOF! in the comic lettering, popping
                                    up 2px, overshooting 1px and settling, 400ms in all. The
                                    game plays it at fx-bark's point in place of fx-bark's pop,
                                    and fx-bark with reduced motion

The comic words (fx-bark-word, and play-word on every fx-hit-* in hits.py) are
built like the sign logo: flat yellow letters, 7 rows with 2px stems, in a 1px ink
ring that fills the counters and the gaps between letters, on a solid dred shadow
2px down and right. Display words only, 2 to 7 letters.

Usage:
  fx.py preview OUT.png   every frame of every effect on the street colours
  fx.py build             write art/fx/*.aseprite and export to
                          public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import Grid, main  # noqa: E402


def rim(g, col="plum"):
    """Ring the shape with a 1px outline in one colour, in place: plum holds 6.5:1 on Bark Park,
    8.3:1 on the shops and 4.4:1 on The Long Way Home, and the fill inside it carries Woof Way."""
    edge = [(x, y) for y in range(g.h) for x in range(g.w) if not g.px[y][x] and any(
        0 <= x + dx < g.w and 0 <= y + dy < g.h and g.px[y + dy][x + dx]
        for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)))]
    for x, y in edge:
        g.p(x, y, col)
    return g


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


# The comic words' letters, 7 rows with 2px stems, so they read at 1x inside their ink ring.
LETTERS = {
    "A": [".###.", "##.##", "##.##", "#####", "##.##", "##.##", "##.##"],
    "C": [".####", "##...", "##...", "##...", "##...", "##...", ".####"],
    "E": ["#####", "##...", "##...", "####.", "##...", "##...", "#####"],
    "F": ["#####", "##...", "##...", "####.", "##...", "##...", "##..."],
    "G": [".####", "##...", "##...", "##.##", "##.##", "##.##", ".####"],
    "H": ["##.##", "##.##", "##.##", "#####", "##.##", "##.##", "##.##"],
    "I": ["##", "##", "##", "##", "##", "##", "##"],
    "K": ["##.##", "##.##", "####.", "###..", "####.", "##.##", "##.##"],
    "L": ["##...", "##...", "##...", "##...", "##...", "##...", "#####"],
    "M": ["##...##", "###.###", "#######", "##.#.##", "##...##", "##...##", "##...##"],
    "N": ["##..##", "###.##", "######", "##.###", "##..##", "##..##", "##..##"],
    "O": [".###.", "##.##", "##.##", "##.##", "##.##", "##.##", ".###."],
    "P": ["####.", "##.##", "##.##", "####.", "##...", "##...", "##..."],
    "Q": [".###..", "##.##.", "##.##.", "##.##.", "##.##.", "##.##.", ".#####"],
    "R": ["####.", "##.##", "##.##", "####.", "##.##", "##.##", "##.##"],
    "S": [".####", "##...", "##...", ".###.", "...##", "...##", "####."],
    "T": ["######", "..##..", "..##..", "..##..", "..##..", "..##..", "..##.."],
    "U": ["##.##", "##.##", "##.##", "##.##", "##.##", "##.##", ".###."],
    "W": ["##...##", "##...##", "##...##", "##.#.##", "#######", "###.###", "##...##"],
    "Y": ["##..##", "##..##", "##..##", ".####.", "..##..", "..##..", "..##.."],
    "!": ["##", "##", "##", "##", "..", "##", "##"],
    "-": ["...", "...", "...", "###", "...", "...", "..."],
}


def word_size(text):
    """The width and height of text's lettering: its letters 1px apart, the ink ring and the 2px shadow."""
    return sum(len(LETTERS[ch][0]) for ch in text) + len(text) - 1 + 4, 11


def word(g, text, cx, top, fill="yellow"):
    """A comic word built like the sign logo: flat letters (yellow, or cream) in a 1px ink ring that also
    fills the counters and the gaps between letters, on a solid dred shadow offset 2px down and right.
    Centred on column cx, the ring's top on row top."""
    w, _ = word_size(text)
    x, letters = round(cx - w / 2) + 1, set()
    for ch in text:
        for j, row in enumerate(LETTERS[ch]):
            letters |= {(x + i, top + 1 + j) for i, c in enumerate(row) if c == "#"}
        x += len(LETTERS[ch][0]) + 1
    ring = {(x + dx, y + dy) for x, y in letters for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
    shadow = {(x + d, y + d) for x, y in ring for d in (1, 2)} - ring
    for pts, col in ((shadow, "dred"), (ring - letters, "ink"), (letters, fill)):
        for x, y in pts:
            g.p(x, y, col)
    return g


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
    """Each coin is rimmed on its own, so the right one stays apart where they overlap."""
    g = Grid(32, 32)
    for side in (-1, 1):
        t = step + (0 if side < 0 else 0.5)
        x = 16 + side * (2 + t * 1.7)
        y = 18 - t * 4.2 + t * t * 0.75
        rx = (2.5, 1.5, 0.6, 1.5)[int(t) % 4]
        c = Grid(32, 32)
        c.ell(x, y, rx + 0.5, 3, "amber", "orange", "yellow")
        if step < 2:
            c.p(x, y - 1, "white")
        rim(c)
        for yy, row in enumerate(c.px):
            for xx, col in enumerate(row):
                if col:
                    g.px[yy][xx] = col
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


# fx-new-best is centred on the 72x20 ui-new-best ribbon, whose top-left sits at RIBBON in the frame.
RIBBON = (12, 14)
# Sparkles thrown out from behind the ribbon, slowing as they go: (x, y on the ribbon's edge, full
# throw dx, dy, first frame, colour). They keep inside the frame's bands above, below and beside it.
SPARKS = ((20, 14, -6, -9, 0, "white"), (40, 14, -3, -10, 1, "yellow"), (58, 14, 4, -11, 0, "white"),
          (76, 14, 8, -8, 2, "cyan"), (26, 34, -6, 9, 1, "yellow"), (50, 34, 1, 10, 0, "white"),
          (70, 34, 6, 9, 2, "pink"), (12, 21, -10, -5, 0, "yellow"), (84, 20, 10, -6, 1, "white"),
          (12, 30, -9, 6, 2, "cyan"), (84, 30, 10, 5, 0, "yellow"), (50, 14, 0, -8, 3, "white"))
# Stars that pop out over the ribbon's edges and arc out under a little gravity: (x, y, dx, dy per frame,
# first frame).
STARS = ((30, 14, -2, -2.6, 0), (66, 14, 2.2, -2.8, 1), (48, 14, 0.3, -2.4, 3), (24, 34, -2.4, 1, 1),
         (72, 34, 2.4, 0.8, 2), (8, 24, -0.6, -2, 2), (88, 24, 0.6, -2, 0))


def new_best(step):
    """96x48: a starburst behind the new-best ribbon, rays first, then sparkles and stars popping out
    and fading. Everything carries the plum rim for the cream panel and the yellow end of the sunset,
    and the ribbon's own area is left clear so the burst comes from behind it."""
    g = Grid(96, 48)
    cx, cy = 48, 24
    if step < 4:
        # rays that slide outward, stretched across so they clear the wide ribbon
        r0, r1 = (6, 11, 17, 23)[step], (15, 21, 25, 27)[step]
        for i in range(16):
            a = math.radians(i * 22.5 + 11)
            for k in range(r0 * 2, r1 * 2):
                g.p(cx + math.cos(a) * k * 0.85, cy + math.sin(a) * k / 2, "white" if step == 0 else "yellow")
    for x, y, dx, dy, first, col in SPARKS:
        t = step - first
        if 0 <= t < 5:
            k = 1 - 0.5 ** (t + 1)
            star4(g, round(x + dx * k), round(y + dy * k), (1, 3, 2, 2, 1)[t], col)
    for x, y, dx, dy, first in STARS:
        t = step - first
        if 0 <= t < 5:
            x, y, r = x + dx * (t + 1), y + dy * (t + 1) + 0.3 * t * t, (4, 5, 5, 4, 3)[t]
            burst(g, x, y, r, r * 0.45, 5, "amber")
            if r > 3:
                burst(g, x, y, r - 2, (r - 2) * 0.45, 5, "yellow")
                g.p(x, y, "white")
    rim(g)
    rx, ry = RIBBON
    g.rect(rx + 5, ry + 1, 62, 17, None)
    g.rect(rx, ry + 3, 72, 15, None)
    return g


def bark_word(step):
    """32x16: WOOF! pops up 2px from below, overshoots by 1px and settles, in the comic lettering. Its ink
    ring holds on the light roads and the yellow fill on Woof Way."""
    return word(Grid(32, 16), "WOOF!", 16, (4, 1, 2, 2)[step])


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    yield "fx-bump", [("play", [rim(bump(i)).outlined(False) for i in range(5)], 60)]
    yield "fx-dizzy", [("loop", [rim(dizzy(i)).outlined(False) for i in range(4)], 110)]
    yield "fx-coins", [("play", [coins(i).outlined(False) for i in range(6)], 80)]
    yield "fx-splash", [("play", [rim(splash(i), "navy").outlined(False) for i in range(5)], 70)]
    yield "fx-sparkle", [("play", [rim(sparkle(i)).outlined(False) for i in range(4)], 60)]
    yield "fx-heart", [("up", [heart_up(i).outlined() for i in range(5)], 90),
                       ("down", [heart_down(i).outlined() for i in range(5)], 90)]
    yield "fx-new-best", [("play", [new_best(i).outlined(False) for i in range(8)], 70)]
    yield "fx-bark-word", [("pop", [bark_word(i).outlined(False) for i in range(4)], [60, 60, 140, 140])]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/fx", __doc__, grounds=("3a4466", "e4a672", "c0cbdc", "c28569"))
