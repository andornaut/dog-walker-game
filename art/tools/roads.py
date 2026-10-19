#!/usr/bin/env python3
"""Draw the per-zone road strips and the transitions between zones.

road-<zone>        280x64 images, one per zone. They tile vertically with no
                   seam: every pattern repeats in 64 rows (or a divisor of it)
                   and anything drawn near the top or bottom edge wraps.
road-<zone>-start  280x64 images, one per zone. Rows 20 to 63 are a neutral cross
                   street in the backdrops' asphalt (CROSSING) and rows 0 to 19
                   this zone's strip, so a start strip follows any zone at a
                   fork: the road reads up the screen as the previous zone's
                   strip, the start strip, then this zone's strip.

Each strip keeps its zone's road colour (src/data/world.ts) as the base, so the
game's shadows (one ramp step darker) still match. The four lane dividers sit
at x = 56k-1 (2px wide) and share one look per zone, so lane edges stay
readable at speed; the outer 3 to 7 px of each side is a curb or verge that
stays clear of the 12px sprite margin.

Usage:
  roads.py preview OUT.png   each zone's road scrolling up: two strips of the zone
                             before it in ZONES, the start strip, then three of this zone
  roads.py build             write art/roads/*.aseprite and public/art/images/*.png

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import random
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import PALETTE, Grid  # noqa: E402

W, H = 280, 64
DIVIDERS = [k * 56 - 1 for k in range(1, 5)]


def wp(g, x, y, c):
    """A pixel that wraps top to bottom, so features crossing the edge stay seamless."""
    g.p(x, y % H, c)


def wrect(g, x, y, w, h, c):
    for j in range(h):
        for i in range(w):
            wp(g, x + i, y + j, c)


def specks(g, rnd, n, col, x0=0, x1=W, wide=0.0):
    """Scatter n texture specks; a share of them (wide) are 2px wide."""
    for _ in range(n):
        x, y = rnd.randrange(x0, x1), rnd.randrange(H)
        wp(g, x, y, col)
        if rnd.random() < wide:
            wp(g, x + 1, y, col)


def scatter(rnd, n, x0, x1, gap, y0=0, y1=H, ok=lambda x, y: True):
    """Up to n points at least gap apart (wrapping top to bottom) where ok(x, y) holds, so
    texture never falls into a regular rhythm or a clump."""
    pts = []
    for _ in range(n * 40):
        if len(pts) == n:
            break
        x, y = rnd.randrange(x0, x1), rnd.randrange(y0, y1)
        if ok(x, y) and all(abs(x - px) >= gap or min(abs(y - py), H - abs(y - py)) >= gap for px, py in pts):
            pts.append((x, y))
    return pts


def wave(y, seed, base, amp):
    """A width that wobbles down the strip and repeats every 64 rows."""
    t = 2 * math.pi * y / H
    return base + round(amp * (0.6 * math.sin(t + seed) + 0.4 * math.sin(3 * t + seed * 2.3)))


def clip(g, y0, y1, draw):
    """Run draw(scratch) and keep only its rows y0..y1-1 on g."""
    s = Grid(W, H)
    draw(s)
    for y in range(y0, y1):
        for x in range(W):
            if s.px[y][x]:
                g.px[y][x] = s.px[y][x]


# ---------- Elm Avenue: asphalt with a concrete gutter and white-grey dashes ----------

def woof_way_ground(g):
    rnd = random.Random("road-woof-way")
    g.rect(0, 0, W, H, "dslate")
    # sparse 2px grit, lighter and darker, spaced apart: dense 1px speckle reads as noise
    for x, y in scatter(rnd, 70, 6, W - 7, 7):
        col = rnd.choice(("slate", "slate", "navy", "navy", "navy", "grey"))
        if rnd.random() < 0.7:
            wrect(g, x, y, 1, 2, col)
        else:
            wrect(g, x, y, 2, 1, col)
    # cracks running along the road, 1 to 2px wide, kept inside lanes
    for x, y, steps in ((20, 50, 12), (150, 20, 14), (236, 58, 10), (93, 33, 8)):
        for _ in range(steps):
            wp(g, x, y, "navy")
            if rnd.random() < 0.25:
                x += rnd.choice((-1, 1))
                wp(g, x, y, "navy")
            y -= 1
    # concrete gutters, with expansion joints every 16 rows
    for x0, edge in ((0, 3), (W - 3, W - 4)):
        g.rect(x0, 0, 3, H, "grey")
        g.rect(edge, 0, 1, H, "navy")
        for y in range(0, H, 16):
            g.rect(x0, y, 3, 1, "slate")
    g.rect(0, 0, 1, H, "lgrey")
    g.rect(W - 1, 0, 1, H, "slate")


def woof_way_lines(g):
    for x in DIVIDERS:
        for y in (8, 40):
            g.rect(x, y, 2, 12, "lgrey")
            g.rect(x, y, 1, 12, "white")
            g.rect(x + 2, y + 1, 1, 12, "navy")


# ---------- Fairview Park: a dirt path between grass verges, with paw prints ----------

PAW = (".x.x.", "x...x", ".xxx.", ".xxx.")


def bark_park_ground(g):
    rnd = random.Random("road-bark-park")
    g.rect(0, 0, W, H, "tan")
    specks(g, rnd, 150, "brown", 8, W - 8, 0.4)
    specks(g, rnd, 70, "cream", 8, W - 8, 0.2)
    # pebbles, lit from the top left
    for _ in range(12):
        x, y = rnd.randrange(12, W - 14), rnd.randrange(H)
        if (x + 3) % 56 < 6:
            continue
        wrect(g, x, y, 2, 2, "lgrey")
        wp(g, x + 1, y + 1, "grey")
        wp(g, x, y, "white")
    # a trail of paw prints up lane 2, alternating sides, 16 rows apart
    for i in range(4):
        x, y = 74 + (6 if i % 2 else 0), i * 16 + 4
        for j, row in enumerate(PAW):
            for k, ch in enumerate(row):
                if ch == "x":
                    wp(g, x + k, y + j, "brown")
    # grass verges with a wobbling edge, darker dirt where the path meets them
    for y in range(H):
        for side, seed in ((0, 0.4), (1, 2.1)):
            w = wave(y, seed, 6, 1.6)
            x0 = 0 if side == 0 else W - w
            g.rect(x0, y, w, 1, "green")
            g.p(w if side == 0 else W - w - 1, y, "brown")
    # blades at uneven spacing: a regular 3-row rhythm runs backwards at the scroll speed
    for side in (0, 1):
        y = side * 7
        while y < H + side * 7 - 3:
            x = 1 + rnd.randrange(4)
            x = x if side == 0 else W - 1 - x
            wrect(g, x, y, 1, 2, "dgreen")
            y += rnd.randrange(2, 6)
        for y in (11 + side * 30, 37 - side * 20):
            x = 2 if side == 0 else W - 3
            wp(g, x, y, "yellow" if side == 0 else "white")


def bark_park_lines(g):
    for x in DIVIDERS:
        for y in range(4, H, 16):
            # dbrown holds 4:1 on the tan path; plum caps the bottom
            g.rect(x, y, 2, 7, "dbrown")
            g.rect(x, y + 7, 2, 1, "plum")


# ---------- Main Street: pink pavers, cream gutter stones, white dashes ----------

def shops_ground(g):
    rnd = random.Random("road-sniff-street-shops")
    g.rect(0, 0, W, H, "pink")
    # square pavers: 2-row mauve joints every 16 rows (low contrast, so they do not blink) and
    # staggered 1px joints along the road; a few skin1 pavers, never side by side
    tinted = False
    for row in range(H // 16):
        y, off = row * 16, 14 if row % 2 else 0
        g.rect(0, y + 14, W, 2, "mauve")
        for x in range(off - 28, W, 28):
            g.rect(x + 27, y, 1, 14, "mauve")
            tinted = not tinted and rnd.random() < 0.07
            if tinted:
                g.rect(x, y, 27, 14, "skin1")
    specks(g, rnd, 20, "skin1", 6, W - 6)
    specks(g, rnd, 16, "mauve", 6, W - 6)
    # cream gutter stones on the outer 4 columns, a mauve seam on the road side and a 2-row
    # tan joint every 16 rows
    for x0, inner in ((0, 4), (W - 4, W - 5)):
        g.rect(x0, 0, 4, H, "cream")
        g.rect(inner, 0, 1, H, "mauve")
        for y in range(0, H, 16):
            g.rect(x0, y, 4, 2, "tan")


def shops_lines(g):
    for x in DIVIDERS:
        for y in (8, 40):
            # white dashes (2.7:1 on the pink) with a mauve edge on the right
            g.rect(x, y, 2, 12, "white")
            g.rect(x + 2, y + 1, 1, 12, "mauve")


# ---------- The Long Way Home: sunset brick, soldier-course edges, fallen leaves ----------

# fallen leaves in rust and ochre (amber and orange read as coins): a pointed blade, lit (f) on
# the upper left of a dark vein (v) that runs on out as the stem and shaded (s) below it, so each
# reads as a leaf and not a round fleck
LEAVES = (("ochre", "rust", "dbrown"), ("ochre", "rust", "dbrown"), ("rust", "rust", "dbrown"),
          ("rust", "dbrown", "plum"))
_TILTED = ("..fff", ".ffvf", "ffvss", "fvss.", "v....")
_SMALL = ("..ff", ".fvf", "fvs.", "v...")
LEAF_SHAPES = (_TILTED, tuple(r[::-1] for r in _TILTED), _SMALL, tuple(r[::-1] for r in _SMALL),
               (".ff.", "fvfs", "fvss", ".vs.", ".v.."))


def home_ground(g):
    rnd = random.Random("road-the-long-way-home")
    g.rect(0, 0, W, H, "skin2")
    # 2-row mortar and whole-brick tints: under the projection a 1-row line blinks
    for row in range(H // 8):
        y, off = row * 8, 7 if row % 2 else 0
        g.rect(0, y + 6, W, 2, "brown")
        for x in range(off - 14, W, 14):
            g.rect(x + 13, y, 1, 6, "brown")
            r = rnd.random()
            if r < 0.1:
                g.rect(x, y, 13, 6, "skin1")
            elif r < 0.16:
                g.rect(x, y, 13, 6, "tan")
            g.p(x + rnd.randrange(2, 12), y + rnd.randrange(2, 6), "brown")
    # soldier-course edges: bricks set on end along both sides, 6 rows plus a 2-row joint
    for x0, line in ((0, 6), (W - 6, W - 7)):
        g.rect(x0, 0, 6, H, "brown")
        for y in range(0, H, 8):
            g.rect(x0, y + 6, 6, 2, "dbrown")
            g.rect(x0, y, 1, 6, "skin2")
        g.rect(line, 0, 1, H, "dbrown")
    leaves(g, rnd, 6, 10, W - 10)


def leaves(g, rnd, n, x0, x1, y0=0, y1=H, tones=LEAVES):
    """n leaves spaced apart, clear of the lane dividers, each in one of tones."""
    for x, y in scatter(rnd, n, x0, x1, 18, y0, y1, lambda x, y: (x + 7) % 56 >= 9):
        tone = dict(zip("fsv", rnd.choice(tones)))
        for j, row in enumerate(rnd.choice(LEAF_SHAPES)):
            for k, ch in enumerate(row):
                if ch != ".":
                    wp(g, x + k, y + j, tone[ch])


def home_lines(g):
    for x in DIVIDERS:
        for y in (4, 36):
            # white (3:1 on the brick) outlined in plum (4.4:1)
            g.rect(x, y, 2, 14, "white")
            g.rect(x - 1, y, 1, 14, "plum")
            g.rect(x + 2, y, 1, 15, "plum")
            g.rect(x, y + 14, 2, 1, "plum")


# ---------- Willow Crescent: worn pale asphalt, concrete gutters, a few chalk doodles ----------

# chalk doodles: a crescent moon and a "Zz". Every stroke across the road is 2 rows tall, so
# the projection keeps it
MOON = ("..yy", ".yyy", "yyy.", "yy..", "yy..", "yy..", "yy..", "yyy.", ".yyy", "..yy")
BIG_Z = ("zzzzzz", "zzzzzz", "...zz.", "..zz..", ".zz...", "zz....", "zzzzzz", "zzzzzz")
SMALL_Z = ("zzzz", "zzzz", ".zz.", "zz..", "zzzz", "zzzz")


def stamp(g, x0, y0, rows, col):
    """Draw every non-'.' character of rows in col, wrapping top to bottom."""
    for j, row in enumerate(rows):
        for k, ch in enumerate(row):
            if ch != ".":
                wp(g, x0 + k, y0 + j, col)


def snooze_ground(g):
    rnd = random.Random("road-snooze-crescent")
    g.rect(0, 0, W, H, "grey")
    # sparse 2px grit, as on Elm Avenue but paler
    for x, y in scatter(rnd, 60, 6, W - 7, 7):
        col = rnd.choice(("slate", "slate", "dslate", "lgrey", "lgrey"))
        if rnd.random() < 0.7:
            wrect(g, x, y, 1, 2, col)
        else:
            wrect(g, x, y, 2, 1, col)
    # sealed cracks running along the road, kept inside lanes
    for x, y, steps in ((38, 12, 10), (196, 50, 14), (250, 30, 8)):
        for _ in range(steps):
            wp(g, x, y, "dslate")
            if rnd.random() < 0.25:
                x += rnd.choice((-1, 1))
                wp(g, x, y, "dslate")
            y -= 1
    stamp(g, 22, 6, MOON, "yellow")
    for x, y, col in ((182, 36, "white"), (72, 54, "lgrey")):
        stamp(g, x, y, BIG_Z, col)
        stamp(g, x + 8, y + 2, SMALL_Z, col)
    # a little leaf litter from the street trees, green so it reads apart from The Long Way Home
    leaves(g, rnd, 4, 10, W - 10, tones=(("green", "dgreen", "forest"),))
    # pale concrete gutters, with 2-row expansion joints every 16 rows
    for x0, edge in ((0, 3), (W - 3, W - 4)):
        g.rect(x0, 0, 3, H, "lgrey")
        g.rect(edge, 0, 1, H, "slate")
        for y in range(0, H, 16):
            g.rect(x0, y, 3, 2, "grey")
    g.rect(0, 0, 1, H, "white")
    g.rect(W - 1, 0, 1, H, "grey")


def snooze_lines(g):
    rnd = random.Random("road-snooze-crescent-lines")
    for x in DIVIDERS:
        for y in (10, 42):
            # faded white (2.8:1 on the grey) with a slate edge, chipped where the paint wore
            g.rect(x, y, 2, 12, "white")
            g.rect(x + 2, y + 1, 1, 12, "slate")
            for _ in range(2):
                g.p(x + rnd.randrange(2), y + rnd.randrange(1, 11), "lgrey")


# ---------- Riverside Path: a pale boardwalk, boards along the road, timber edges ----------

def paws_ground(g):
    rnd = random.Random("road-paws-promenade")
    g.rect(0, 0, W, H, "cream")
    # boards 13px wide with 1px seams at x = 14k-1, so the lane dividers fall on seams; a few
    # newer boards, never two side by side (a white board reads as a line along the road)
    boards = range(0, W, 14)
    tinted = False
    for x0 in boards:
        tinted = not tinted and rnd.random() < 0.1
        if tinted:
            g.rect(x0, 0, 13, H, "skin1")
        # grain runs along the board, 5 to 11 rows long
        for _ in range(rnd.randrange(1, 3)):
            wrect(g, x0 + rnd.randrange(1, 12), rnd.randrange(H), 1, rnd.randrange(5, 12), "tan")
    for x0 in boards[1:]:
        g.rect(x0 - 1, 0, 1, H, "tan")
    # each board ends once in the strip: a 2-row butt joint (low contrast, so it does not
    # blink) with a nail either side, at uneven rows
    for x0 in boards:
        y = rnd.randrange(H)
        wrect(g, x0, y, 13, 2, "tan")
        wp(g, x0 + 3, y - 2, "grey")
        wp(g, x0 + 9, y + 3, "grey")
    # a few knots, spaced apart
    for x, y in scatter(rnd, 7, 8, W - 8, 20, ok=lambda x, y: x % 14 < 11):
        wrect(g, x, y, 2, 2, "tan")
        wp(g, x + 1, y + 1, "brown")
    # edge beams along both sides, meeting the paving verge with no curb
    for x0, outer in ((0, 0), (W - 4, W - 1)):
        g.rect(x0, 0, 4, H, "tan")
        g.rect(outer, 0, 1, H, "brown")


def paws_lines(g):
    for x in DIVIDERS:
        for y in (6, 38):
            # dbrown (5.9:1 on the boards), 20 rows in 32: a longer rhythm than Fairview Park's
            g.rect(x, y, 2, 20, "dbrown")


# easiest to hardest, as the fork cards sort them
ZONES = {
    "snooze-crescent": (snooze_ground, snooze_lines),
    "bark-park": (bark_park_ground, bark_park_lines),
    "woof-way": (woof_way_ground, woof_way_lines),
    "sniff-street-shops": (shops_ground, shops_lines),
    "paws-promenade": (paws_ground, paws_lines),
    "the-long-way-home": (home_ground, home_lines),
}


def strip(zone, y0=0, y1=H):
    """The zone's strip; with y0..y1, only those rows are drawn (the rest stay empty)."""
    ground, lines = ZONES[zone]
    g = Grid(W, H)
    clip(g, y0, y1, lambda s: (ground(s), lines(s)))
    return g


# ---------- the cross street every start strip begins with ----------

# Strip rows of the cross street, first and past-last: the zone's own strip is above it and
# the game draws the previous zone's strip below it.
CROSSING = (20, 64)


def crossing(g):
    """A neutral cross street in the backdrops' asphalt, so a start strip follows any zone. Up
    the road: the near kerb's top (rows 60 to 63) and rounded edge (58, 59), the asphalt with a
    zebra crossing (35 to 48), then the far kerb's shadow (24, 25), face (22, 23) and lit top
    (20, 21). Every band across the road is 2 rows, each step 3.4:1 or less."""
    y0, y1 = CROSSING
    rnd = random.Random("road-crossing")
    g.rect(0, y0, W, y1 - y0, "dslate")
    for x, y in scatter(rnd, 30, 0, W, 7, 27, 56):
        g.rect(x, y, 1, 2, rnd.choice(("slate", "navy", "navy")))
    for x in range(8, W - 8, 12):
        g.rect(x, 35, 7, 14, "white")
        g.rect(x + 6, 35, 1, 14, "lgrey")
        g.rect(x, 47, 7, 2, "lgrey")
    g.rect(0, 20, W, 2, "lgrey")
    g.rect(0, 22, W, 2, "slate")
    g.rect(0, 24, W, 2, "navy")
    g.rect(0, 58, W, 2, "grey")
    g.rect(0, 60, W, 4, "lgrey")
    # kerbstone joints at uneven spacing, along the road
    x = rnd.randrange(10, 30)
    while x < W:
        g.rect(x, 60, 1, 4, "grey")
        g.rect(x + rnd.randrange(-6, 7), 20, 1, 4, "grey")
        x += rnd.randrange(22, 38)


def start(zone):
    g = strip(zone, 0, CROSSING[0])
    crossing(g)
    return g


def images():
    """Yield (key, Grid) for every image."""
    for zone in ZONES:
        yield f"road-{zone}", strip(zone)
    for zone in ZONES:
        yield f"road-{zone}-start", start(zone)


def to_image(g):
    from PIL import Image

    img = Image.new("RGB", (g.w, g.h))
    img.putdata([tuple(int(c[k:k + 2], 16) for k in (0, 2, 4)) for row in g.px for c in row])
    return img


def check(key, g):
    """Every pixel is opaque and on the palette, at the inventory size."""
    assert (g.w, g.h) == (W, H), key
    bad = {c for row in g.px for c in row if c not in PALETTE}
    assert not bad, f"{key}: {bad}"


def preview(out, scale=2, gap=8):
    from PIL import Image

    tiles = dict(images())
    for key, g in tiles.items():
        check(key, g)
    zones = list(ZONES)
    col_h = 6 * H
    sheet = Image.new("RGB", ((W + gap) * len(zones) * scale, col_h * scale), (24, 20, 37))
    for i, zone in enumerate(zones):
        # bottom to top, the order the road scrolls into view
        column = [f"road-{zones[i - 1]}"] * 2 + [f"road-{zone}-start"] + [f"road-{zone}"] * 3
        for j, key in enumerate(column):
            y = col_h - (j + 1) * H
            tile = to_image(tiles[key]).resize((W * scale, H * scale), Image.NEAREST)
            sheet.paste(tile, (i * (W + gap) * scale, y * scale))
    sheet.save(out)


def build():
    os.makedirs("art/roads", exist_ok=True)
    os.makedirs("public/art/images", exist_ok=True)
    built = []
    for key, g in images():
        check(key, g)
        png = f"public/art/images/{key}.png"
        to_image(g).save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/roads/{key}.aseprite"], check=True)
        built.append(key)
    print("built", ", ".join(built))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
