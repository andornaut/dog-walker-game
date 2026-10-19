#!/usr/bin/env python3
"""Draw the 15 achievement badges and the celebration burst.

badge-<achievement>: 32x32 medals, rimmed by category (firsts bronze, mastery
silver, collection gold, silly pink), each with an icon for its goal. Tags:
earned (in colour) and locked (grey, the icon as a two-tone slate silhouette,
a small padlock).
fx-confetti: 64x64, the burst behind a badge as it is earned (tag play).

Usage:
  badges.py preview OUT.png   every badge, earned and locked, and the burst
  badges.py build             write art/badges/*.aseprite, export to
                              public/art/sprites/ and list them in the manifest

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import K, Grid, main  # noqa: E402

RIMS = {"firsts": ("ochre", "rust", "tan"), "mastery": ("lgrey", "grey", "white"),
        "collection": ("amber", "orange", "yellow"), "silly": ("pink", "mauve", "white")}
GREYS = ["ffffff", "c0cbdc", "8b9bb4", "5a6988", "3a4466", "262b44", "181425"]


def lum(c):
    c = K.get(c, c)
    return 0.299 * int(c[0:2], 16) + 0.587 * int(c[2:4], 16) + 0.114 * int(c[4:6], 16)


def grey(c):
    return min(GREYS, key=lambda g: abs(lum(g) - lum(c)))


def paw(g, cx, cy, col="dbrown", s=1.0):
    g.ell(cx, cy + 1.5 * s, 2.6 * s, 2.2 * s, col)
    for dx, dy in ((-2.6, -1.4), (-0.9, -2.8), (0.9, -2.8), (2.6, -1.4)):
        g.ell(cx + dx * s, cy + dy * s, 0.9 * s + 0.3, 0.9 * s + 0.3, col)


ICONS = {}


def icon(name):
    def deco(fn):
        ICONS[name] = fn
        return fn
    return deco


@icon("first-walk")
def _(g):
    paw(g, 13, 17)
    for r in range(5):
        for k in range(3):
            if "010110010010111"[r * 3 + k] == "1":
                g.rect(19 + k * 2, 9 + r * 2, 2, 2, "plum")


@icon("full-route")
def _(g):
    g.rect(11, 8, 1, 17, "dbrown")
    for y in range(8, 16, 2):
        for x in range(12, 22, 2):
            g.rect(x, y, 2, 2, "ink" if (x // 2 + y // 2) % 2 else "white")


@icon("pack-of-two")
def _(g):
    paw(g, 12, 15)
    paw(g, 20, 19)


@icon("pack-of-three")
def _(g):
    paw(g, 10, 21, s=0.75)
    paw(g, 16, 15, s=0.75)
    paw(g, 22, 9, s=0.75)


@icon("clean-paws")
def _(g):
    paw(g, 15, 17, "sky")
    for x, y in ((9, 9), (22, 10), (22, 21)):
        g.rect(x, y - 1, 1, 3, "blue")
        g.rect(x - 1, y, 3, 1, "blue")


@icon("spotless")
def _(g):
    pts = [(16 + math.cos(math.radians(a - 90)) * (7 if i % 2 == 0 else 3),
            16 + math.sin(math.radians(a - 90)) * (7 if i % 2 == 0 else 3)) for i, a in enumerate(range(0, 360, 36))]
    for i in range(10):
        g.tri((16, 16), pts[i], pts[(i + 1) % 10], "yellow")
    g.p(14, 12, "white")


@icon("no-hard-feelings")
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


@icon("high-earner")
def _(g):
    g.ell(16, 19, 7, 6, "brown", "dbrown", "tan")
    g.tri((12, 10), (20, 10), (16, 14), "brown")
    g.rect(13, 12, 6, 1, "dbrown")
    for y, row in enumerate(["0110", "1000", "0110", "0001", "1110"]):
        for x, c in enumerate(row):
            if c == "1":
                g.p(14 + x, 16 + y, "yellow")
    g.rect(15, 15, 1, 7, "yellow")


@icon("full-kennel")
def _(g):
    g.tri((8, 15), (24, 15), (16, 7), "red")
    g.rect(10, 15, 12, 9, "tan")
    g.rect(13, 17, 6, 7, "plum")
    g.rect(13, 16, 6, 1, "plum")


@icon("fully-equipped")
def _(g):
    g.rect(6, 14, 20, 2, "dslate")
    g.rect(14, 13, 4, 4, "lgrey")
    g.rect(15, 14, 2, 2, "slate")
    g.blob(16, 21, 7, 4.5, "red", "dred", "pink")
    g.rect(10, 20, 12, 1, "dred")
    g.rect(20, 20, 1, 3, "yellow")


@icon("every-owner-smiles")
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


@icon("stinky-streak")
def _(g):
    for cx, cy, r in ((12, 19, 4), (18, 18, 5), (15, 15, 4)):
        g.ell(cx, cy, r, r * 0.85, "green", "dgreen")
    for x in (10, 16, 22):
        for k in range(5):
            g.p(x + (k % 2), 6 + k, "dgreen")


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
    "first-walk": "firsts", "full-route": "firsts", "pack-of-two": "firsts", "pack-of-three": "firsts",
    "clean-paws": "mastery", "spotless": "mastery", "no-hard-feelings": "mastery", "high-earner": "mastery",
    "full-kennel": "collection", "fully-equipped": "collection", "every-owner-smiles": "collection",
    "top-walker": "collection",
    "youre-fired": "silly", "stinky-streak": "silly", "squirrel": "silly",
}


def badge(name, locked=False):
    rim, rim_sh, rim_li = RIMS[BADGES[name]]
    g = Grid(32, 32)
    g.ell(16, 16, 14.5, 14.5, rim, rim_sh, rim_li)
    for a in range(0, 360, 30):
        g.p(16 + math.cos(math.radians(a)) * 13, 16 + math.sin(math.radians(a)) * 13, rim_sh)
    g.ell(16, 16, 11, 11, "cream", "tan")
    face = [row[:] for row in g.px]
    ICONS[name](g)
    if locked:
        # The icon becomes a two-tone silhouette (dark lines stay darker) so its goal still reads on the grey face.
        for y in range(32):
            for x in range(32):
                c = g.px[y][x]
                if c:
                    g.px[y][x] = grey(c) if c == face[y][x] else K["dslate"] if lum(c) < 90 else K["slate"]
        g.rect(20, 22, 8, 7, "amber")
        g.rect(20, 22, 8, 1, "yellow")
        g.rect(21, 18, 1, 4, "grey")
        g.rect(26, 18, 1, 4, "grey")
        g.rect(22, 17, 4, 1, "grey")
        g.rect(23, 24, 2, 3, "dbrown")
    return g


def confetti(step):
    """64x64: a burst of confetti and rays behind the badge, 6 frames."""
    g = Grid(64, 64)
    cols = ("red", "amber", "green", "sky", "pink", "yellow")
    r = 6 + step * 4.5
    for i in range(18):
        a = math.radians(i * 20 + step * 7)
        x, y = 32 + math.cos(a) * r, 32 + math.sin(a) * r + step * step * 0.25
        g.rect(x, y, 2, 2 if i % 2 else 1, cols[i % len(cols)])
    if step < 3:
        for i in range(8):
            a = math.radians(i * 45)
            for k in range(2, 4 + step * 2):
                g.p(32 + math.cos(a) * (8 + k), 32 + math.sin(a) * (8 + k), "yellow" if step else "white")
    return g


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    for name in BADGES:
        yield f"badge-{name}", [("earned", [badge(name).outlined()], 1000), ("locked", [badge(name, True).outlined()], 1000)]
    yield "fx-confetti", [("play", [confetti(i).outlined(False) for i in range(6)], 90)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/badges", __doc__, grounds=("733e39",))
