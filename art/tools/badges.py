#!/usr/bin/env python3
"""Draw the 15 achievement badges and the celebration burst.

badge-<achievement>: 32x32 medals, rimmed by category (firsts bronze, mastery
silver, collection gold, silly pink), each with an icon for its goal. Tags:
earned (in colour) and locked (grey, the icon as a two-tone slate silhouette,
a small padlock). Where an icon's edge holds under 3:1 against the cream and tan
face, the face beside it takes a 1px keyline: plum (9.42:1 on cream, 6.49:1 on
tan), teal for green (eau-de-skunk).
fx-confetti: 64x64, the burst behind a badge as it is earned (tag play, 10
frames at 80ms), plum-rimmed so it reads on the Stats wood and the cream end panel.

Usage:
  badges.py preview OUT.png   every badge, earned and locked, and the burst, on
                              dark wood, slate and cream
  badges.py build             write art/badges/*.aseprite, export to
                              public/art/sprites/ and list them in the manifest

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import K, Grid, contrast, main  # noqa: E402

RIMS = {"firsts": ("ochre", "rust", "tan"), "mastery": ("lgrey", "grey", "white"),
        "collection": ("amber", "orange", "yellow"), "silly": ("pink", "mauve", "white")}
GREYS = ["ffffff", "c0cbdc", "8b9bb4", "5a6988", "3a4466", "262b44", "181425"]
# The icon keyline's colour where it is not plum, after the effects' rims.
KEYLINES = {"eau-de-skunk": "teal"}


def lum(c):
    c = K.get(c, c)
    return 0.299 * int(c[0:2], 16) + 0.587 * int(c[2:4], 16) + 0.114 * int(c[4:6], 16)


def grey(c):
    return min(GREYS, key=lambda g: abs(lum(g) - lum(c)))


# A pad under four toes, each toe apart from the others and the pad by a 1px gap, so the print
# reads as a paw and not as arcs. PAW is 11x10; SMALL_PAW (9x9) is for three to a badge.
PAW = ["...xx.xx...", "..xxx.xxx..", "..xxx.xxx..", "xx.......xx", "xxx.....xxx", "xxx.xxx.xxx",
       "...xxxxx...", "..xxxxxxx..", "..xxxxxxx..", "...xx.xx..."]
SMALL_PAW = ["..xx.xx..", "..xx.xx..", ".........", "xx.....xx", "xx.xxx.xx", "..xxxxx..", ".xxxxxxx.",
             ".xxxxxxx.", "..xx.xx.."]


def paw(g, cx, cy, col="dbrown", small=False):
    """A paw print centred on (cx, cy)."""
    rows = SMALL_PAW if small else PAW
    x0, y0 = cx - len(rows[0]) // 2, cy - len(rows) // 2
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "x":
                g.p(x0 + x, y0 + y, col)


ICONS = {}


def icon(name):
    def deco(fn):
        ICONS[name] = fn
        return fn
    return deco


@icon("first-steps")
def _(g):
    paw(g, 12, 16)
    for r in range(5):
        for k in range(3):
            if "010110010010111"[r * 3 + k] == "1":
                g.rect(19 + k * 2, 9 + r * 2, 2, 2, "plum")


@icon("round-trip")
def _(g):
    g.rect(11, 8, 1, 17, "dbrown")
    for y in range(8, 16, 2):
        for x in range(12, 22, 2):
            g.rect(x, y, 2, 2, "ink" if (x // 2 + y // 2) % 2 else "white")


@icon("double-leash")
def _(g):
    paw(g, 11, 18, small=True)
    paw(g, 20, 11, small=True)


@icon("pack-leader")
def _(g):
    paw(g, 16, 10, small=True)
    paw(g, 11, 20, small=True)
    paw(g, 21, 20, small=True)


@icon("clean-paws")
def _(g):
    paw(g, 16, 16, "blue")
    for x, y in ((9, 9), (22, 10), (22, 21)):
        g.rect(x, y - 1, 1, 3, "blue")
        g.rect(x - 1, y, 3, 1, "blue")


@icon("not-a-scratch")
def _(g):
    pts = [(16 + math.cos(math.radians(a - 90)) * (7 if i % 2 == 0 else 3),
            16 + math.sin(math.radians(a - 90)) * (7 if i % 2 == 0 else 3)) for i, a in enumerate(range(0, 360, 36))]
    for i in range(10):
        g.tri((16, 16), pts[i], pts[(i + 1) % 10], "yellow")
    g.p(14, 12, "white")


@icon("five-star-service")
def _(g):
    for y, row in enumerate([".11.11.", "1111111", "1111111", ".11111.", "..111..", "...1..."]):
        for x, c in enumerate(row):
            if c == "1":
                g.rect(9 + x * 2, 10 + y * 2, 2, 2, "red")
    g.rect(11, 12, 2, 2, "pink")
    g.rect(13, 13, 1, 1, "plum")
    g.rect(18, 13, 1, 1, "plum")
    g.rect(14, 16, 4, 1, "plum")
    g.p(13, 15, "plum")
    g.p(18, 15, "plum")


@icon("big-payday")
def _(g):
    for cx, cy in ((9, 21), (23, 21)):
        g.ell(cx, cy, 3.5, 3.5, "amber", "orange", "yellow")
    g.ell(16, 15, 8, 8, "orange", "rust")
    g.ell(16, 15, 6, 6, "amber", "orange", "yellow")
    for y, row in enumerate(["..1..", ".1111", "1.1..", ".111.", "..1.1", "1111.", "..1.."]):
        for x, c in enumerate(row):
            if c == "1":
                g.p(14 + x, 12 + y, "dbrown")
    g.p(12, 11, "white")


@icon("full-kennel")
def _(g):
    g.tri((8, 15), (24, 15), (16, 7), "red")
    g.rect(10, 15, 12, 9, "tan")
    g.rect(13, 17, 6, 7, "plum")
    g.rect(13, 16, 6, 1, "plum")


@icon("kitted-out")
def _(g):
    """Three of the five gear items: whistle, lucky collar, running shoe."""
    g.ell(11, 11, 4, 3, "lgrey", "grey", "white")
    g.rect(13, 10, 5, 2, "lgrey")
    g.p(10, 11, "ink")
    g.ell(21, 10, 5, 4, "red", "dred")
    g.ell(21, 9.5, 3, 2, None)
    g.ell(21, 15, 1.8, 1.8, "yellow", "amber")
    g.ell(15, 20, 7, 3.5, "sky", "blue", "cyan")
    g.rect(9, 20, 15, 2, "sky")
    g.rect(8, 22, 16, 2, "white")
    g.rect(13, 18, 1, 3, "white")
    g.rect(16, 18, 1, 3, "white")


@icon("neighbourhood-favourite")
def _(g):
    g.ell(16, 16, 7, 7, "yellow", "amber")
    g.rect(13, 13, 1, 2, "plum")
    g.rect(18, 13, 1, 2, "plum")
    g.p(12, 18, "plum")
    g.p(19, 18, "plum")
    g.rect(13, 19, 6, 1, "plum")
    g.p(11, 16, "pink")
    g.p(20, 16, "pink")


@icon("top-walker")
def _(g):
    g.rect(9, 14, 14, 8, "amber")
    g.tri((9, 14), (9, 8), (13, 14), "amber")
    g.tri((16, 14), (16, 7), (12.5, 14), "amber")
    g.tri((16, 14), (16, 7), (19.5, 14), "amber")
    g.tri((23, 14), (23, 8), (19, 14), "amber")
    g.rect(9, 20, 14, 2, "orange")
    for x, c in ((12, "red"), (16, "sky"), (20, "green")):
        g.rect(x - 1, 16, 2, 2, c)


@icon("youre-fired")
def _(g):
    g.ell(16, 19, 6, 6, "orange", "rust")
    g.tri((10, 19), (14, 6), (17, 15), "orange")
    g.tri((22, 19), (19, 8), (15, 15), "orange")
    g.ell(16, 20, 3.5, 4, "yellow", "amber")
    g.tri((13, 20), (16, 11), (19, 20), "yellow")


@icon("eau-de-skunk")
def _(g):
    for cx, cy, r in ((12, 19, 4), (18, 18, 5), (15, 15, 4)):
        g.ell(cx, cy, r, r * 0.85, "green", "dgreen")
    for x in (10, 16, 22):
        for k in range(5):
            g.p(x + (k % 2), 6 + k, "forest")


@icon("squirrel")
def _(g):
    g.ell(20, 13, 4.5, 6, "ochre", "rust", "tan")
    g.ell(13, 18, 4, 4.5, "ochre", "rust")
    g.ell(13, 13, 3, 2.5, "ochre", "rust")
    g.p(11, 10, "ochre")
    g.p(14, 10, "ochre")
    g.p(12, 13, "ink")
    g.ell(13, 20, 2, 2, "cream")


BADGES = {
    "first-steps": "firsts", "round-trip": "firsts", "double-leash": "firsts", "pack-leader": "firsts",
    "clean-paws": "mastery", "not-a-scratch": "mastery", "five-star-service": "mastery", "big-payday": "mastery",
    "full-kennel": "collection", "kitted-out": "collection", "neighbourhood-favourite": "collection",
    "top-walker": "collection",
    "youre-fired": "silly", "eau-de-skunk": "silly", "squirrel": "silly",
}


def badge(name, locked=False):
    rim, rim_sh, rim_li = RIMS[BADGES[name]]
    g = Grid(32, 32)
    g.ell(16, 16, 14.5, 14.5, rim, rim_sh, rim_li)
    for a in range(0, 360, 30):
        g.p(16 + math.cos(math.radians(a)) * 13, 16 + math.sin(math.radians(a)) * 13, rim_sh)
    g.ell(16, 16, 11, 11, "cream", "tan")
    disc = Grid(32, 32)
    disc.ell(16, 16, 11, 11, "cream")
    art = Grid(32, 32)
    ICONS[name](art)
    icon_px = {(x, y) for y in range(32) for x in range(32) if art.px[y][x]}
    # the keyline: every face pixel beside an icon pixel that holds under 3:1 against it
    keyline = {(x, y) for y in range(32) for x in range(32) if disc.px[y][x] and (x, y) not in icon_px and any(
        (x + dx, y + dy) in icon_px and contrast(art.px[y + dy][x + dx], g.px[y][x]) < 3
        for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)))}
    for x, y in icon_px:
        g.px[y][x] = art.px[y][x]
    for x, y in keyline:
        g.p(x, y, KEYLINES.get(name, "plum"))
    if locked:
        # The icon becomes a two-tone silhouette (dark lines stay darker) so its goal still reads on the grey face.
        for y in range(32):
            for x in range(32):
                c = g.px[y][x]
                if c:
                    g.px[y][x] = (K["dslate"] if lum(c) < 90 else K["slate"]) if (x, y) in icon_px | keyline else grey(c)
        g.rect(20, 22, 8, 7, "amber")
        g.rect(20, 22, 8, 1, "yellow")
        g.rect(21, 18, 1, 4, "grey")
        g.rect(26, 18, 1, 4, "grey")
        g.rect(22, 17, 4, 1, "grey")
        g.rect(23, 24, 2, 3, "dbrown")
    return g


# Confetti pieces, fixed so every build draws the same burst: (angle, reach, fall, drift, phase, last frame, colour).
# Angles are jittered off an even spread and reaches vary, so the burst fills the square unevenly.
_rng = random.Random(7)
PIECES = [(math.radians(i * 360 / 36 + _rng.uniform(-14, 14)), _rng.uniform(16, 38), _rng.uniform(0.35, 0.7),
           _rng.uniform(-3, 3), _rng.randrange(3), _rng.randrange(6, 11),
           ("red", "amber", "green", "sky", "pink", "yellow", "white", "cyan", "orange", "mauve")[i % 10])
          for i in range(36)]
# A piece tumbles through these shapes, one per frame.
TUMBLE = ((1, 2), (2, 1), (2, 2))


def confetti(step):
    """64x64: confetti thrown out from behind the badge, slowing, then falling and drifting, 10 frames.
    Each piece carries a 1px plum rim so the light colours hold on the cream end panel as well as the
    dark wood; a piece drawn later covers an earlier one, rim and all, so overlaps stay apart."""
    g = Grid(64, 64)
    for a, reach, fall, drift, phase, last, col in PIECES:
        if step > last:
            continue
        # thrown fast and slowing, with a kick upward, then gravity takes over
        r = reach * (1 - 0.55 ** (step + 1.2))
        x = 32 + math.cos(a) * r + drift * math.sin(step * 0.8 + phase) * min(step / 3, 1)
        y = 32 + math.sin(a) * r - 7 * (1 - 0.5 ** step) + fall * max(step - 1, 0) ** 2
        w, h = TUMBLE[(step + phase) % 3]
        x, y = round(x - w / 2), round(y - h / 2)
        g.rect(x - 1, y, w + 2, h, "plum")
        g.rect(x, y - 1, w, h + 2, "plum")
        g.rect(x, y, w, h, col)
    return g


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    for name in BADGES:
        yield f"badge-{name}", [("earned", [badge(name).outlined()], 1000), ("locked", [badge(name, True).outlined()], 1000)]
    yield "fx-confetti", [("play", [confetti(i).outlined(False) for i in range(10)], 80)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/badges", __doc__, grounds=("733e39", "3a4466", "ead4aa"))
