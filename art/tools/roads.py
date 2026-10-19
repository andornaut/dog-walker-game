#!/usr/bin/env python3
"""Draw the per-zone road strips and the transitions between zones.

road-<zone>        280x64 images, one per zone. They tile vertically with no
                   seam: every pattern repeats in 64 rows (or a divisor of it)
                   and anything drawn near the top or bottom edge wraps.
road-<zone>-start  280x64 images for the three later zones. The bottom rows are
                   the previous zone's strip and the top rows this zone's, with
                   a crossing between them, so the road reads up the screen as
                   previous strip, start strip, this zone's strip.

Each strip keeps its zone's road colour (src/data/world.ts) as the base, so the
game's shadows (one ramp step darker) still match. The four lane dividers sit
at x = 56k-1 (2px wide) and share one look per zone, so lane edges stay
readable at speed; the outer 3 to 7 px of each side is a curb or verge that
stays clear of the 12px sprite margin.

Usage:
  roads.py preview OUT.png   each zone's road scrolling up: two strips of the
                             previous zone, the start strip, then three of this zone
  roads.py build             write art/roads/*.aseprite and public/art/images/*.png,
                             and list them in the manifest's "images"

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import json
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


# ---------- Woof Way: asphalt with a concrete gutter and white-grey dashes ----------

def woof_way_ground(g):
    rnd = random.Random("road-woof-way")
    g.rect(0, 0, W, H, "dslate")
    specks(g, rnd, 260, "slate", 4, W - 4, 0.3)
    specks(g, rnd, 160, "navy", 4, W - 4, 0.3)
    specks(g, rnd, 18, "grey", 4, W - 4)
    # hairline cracks, kept inside lanes
    for x, y, steps in ((20, 50, 9), (150, 20, 11), (236, 58, 8)):
        for _ in range(steps):
            wp(g, x, y, "navy")
            x += rnd.choice((-1, 0, 1))
            y -= 1
            if rnd.random() < 0.3:
                wp(g, x + 1, y, "navy")
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


# ---------- Bark Park: a dirt path between grass verges, with paw prints ----------

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
    for side in (0, 1):
        for i in range(22):
            y = (i * 3 + side * 7) % H
            x = 1 + (i * 5) % 4
            x = x if side == 0 else W - 1 - x
            wrect(g, x, y, 1, 2, "dgreen")
        for y in (11 + side * 30, 37 - side * 20):
            x = 2 if side == 0 else W - 3
            wp(g, x, y, "yellow" if side == 0 else "white")


def bark_park_lines(g):
    for x in DIVIDERS:
        for y in range(4, H, 16):
            g.rect(x, y, 2, 7, "brown")
            g.rect(x, y, 2, 1, "cream")
            g.rect(x, y + 7, 2, 1, "dbrown")


# ---------- Sniff Street Shops: staggered paving slabs, sett lane lines, drains ----------

def shops_ground(g):
    rnd = random.Random("road-sniff-street-shops")
    g.rect(0, 0, W, H, "lgrey")
    for row in range(H // 16):
        y, off = row * 16, 14 if row % 2 else 0
        g.rect(0, y + 15, W, 1, "grey")
        for x in range(off - 28, W, 28):
            g.rect(x + 27, y, 1, 15, "grey")
            g.rect(x, y, 26, 1, "white")
            if rnd.random() < 0.18:
                for _ in range(10):
                    g.p(x + rnd.randrange(1, 26), y + rnd.randrange(2, 14), "grey")
    specks(g, rnd, 50, "white", 4, W - 4)
    specks(g, rnd, 30, "grey", 4, W - 4)
    # a few dropped bits of gum
    for x, y in ((40, 22), (131, 52), (215, 9)):
        g.rect(x, y, 2, 2, "slate")
        g.p(x, y, "grey")
    # drainage channels, with a grate every 32 rows
    for x0 in (0, W - 4):
        g.rect(x0, 0, 4, H, "grey")
        g.rect(x0 + 1, 0, 2, H, "slate")
        for y in (10, 42):
            g.rect(x0, y, 4, 8, "dslate")
            for yy in range(y + 1, y + 8, 2):
                g.rect(x0 + 1, yy, 2, 1, "grey")


def shops_lines(g):
    for x in DIVIDERS:
        g.rect(x, 0, 2, H, "slate")
        for y in range(0, H, 4):
            g.rect(x, y, 2, 1, "dslate")
        g.rect(x - 1, 0, 1, H, "grey")


# ---------- The Long Way Home: sunset brick, soldier-course edges, fallen leaves ----------

LEAVES = (("orange", "rust"), ("amber", "orange"), ("rust", "dbrown"))


def home_ground(g):
    rnd = random.Random("road-the-long-way-home")
    g.rect(0, 0, W, H, "skin2")
    for row in range(H // 8):
        y, off = row * 8, 7 if row % 2 else 0
        g.rect(0, y + 7, W, 1, "brown")
        for x in range(off - 14, W, 14):
            g.rect(x + 13, y, 1, 7, "brown")
            r = rnd.random()
            if r < 0.2:
                g.rect(x, y, 13, 1, "skin1")
            elif r < 0.26:
                g.rect(x, y, 13, 7, "tan")
                g.rect(x, y + 6, 13, 1, "skin2")
            g.p(x + rnd.randrange(2, 12), y + rnd.randrange(2, 6), "brown")
    # soldier-course edges: bricks set on end along both sides
    for x0, line in ((0, 6), (W - 6, W - 7)):
        g.rect(x0, 0, 6, H, "brown")
        for y in range(0, H, 4):
            g.rect(x0, y + 3, 6, 1, "dbrown")
            g.rect(x0, y, 6, 1, "skin2")
        g.rect(line, 0, 1, H, "dbrown")
    leaves(g, rnd, 11, 10, W - 10)


def leaves(g, rnd, n, x0, x1, y0=0, y1=H):
    for _ in range(n):
        x, y = rnd.randrange(x0, x1), rnd.randrange(y0, y1)
        if (x + 4) % 56 < 8:
            continue
        fill, vein = rnd.choice(LEAVES)
        if rnd.random() < 0.5:
            wrect(g, x, y, 3, 2, fill)
            wp(g, x + 2, y + 1, vein)
            wp(g, x + 3, y + 2, vein)
        else:
            wp(g, x + 1, y, fill)
            wrect(g, x, y + 1, 3, 1, fill)
            wp(g, x + 1, y + 2, vein)


def home_lines(g):
    for x in DIVIDERS:
        for y in (4, 36):
            g.rect(x, y, 2, 14, "cream")
            g.rect(x - 1, y, 1, 14, "dbrown")
            g.rect(x + 2, y, 1, 15, "dbrown")
            g.rect(x, y + 14, 2, 1, "dbrown")


ZONES = {
    "woof-way": (woof_way_ground, woof_way_lines),
    "bark-park": (bark_park_ground, bark_park_lines),
    "sniff-street-shops": (shops_ground, shops_lines),
    "the-long-way-home": (home_ground, home_lines),
}


def strip(zone, y0=0, y1=H):
    """The zone's strip; with y0..y1, only those rows are drawn (the rest stay empty)."""
    ground, lines = ZONES[zone]
    g = Grid(W, H)
    clip(g, y0, y1, lambda s: (ground(s), lines(s)))
    return g


# ---------- the crossings between zones ----------

def crosswalk(g):
    """Woof Way to Bark Park: zebra stripes, then the kerb where the park path starts."""
    g.rect(0, 18, W, 3, "lgrey")
    g.rect(0, 18, W, 1, "white")
    g.rect(0, 20, W, 1, "grey")
    g.rect(0, 21, W, 1, "navy")
    for x in range(8, W - 8, 12):
        g.rect(x, 23, 7, 14, "white")
        g.rect(x + 6, 23, 1, 14, "lgrey")
        g.rect(x, 36, 7, 1, "lgrey")
    # dirt kicked onto the kerb's top edge
    rnd = random.Random("road-bark-park-start")
    for _ in range(30):
        g.p(rnd.randrange(8, W - 8), 17 - rnd.randrange(3), "brown")


def threshold(g):
    """Bark Park to the shops: a granite sill, with dirt tracked onto the first slabs."""
    g.rect(0, 32, W, 4, "grey")
    g.rect(0, 32, W, 1, "lgrey")
    g.rect(0, 35, W, 1, "slate")
    for x in range(0, W, 20):
        g.rect(x, 33, 1, 2, "slate")
    rnd = random.Random("road-sniff-street-shops-start")
    for _ in range(90):
        y = 31 - int(rnd.random() ** 2 * 14)
        x = rnd.randrange(6, W - 6)
        if (x + 2) % 56 > 3:
            g.p(x, y, rnd.choice(("tan", "tan", "brown")))
    # the verges end in a clump of grass on the sill
    for x0 in (0, W - 9):
        g.rect(x0, 36, 9, 2, "green")
        g.rect(x0 + 2, 35, 5, 1, "green")
        g.rect(x0 + 1, 37, 7, 1, "dgreen")


def soldier_band(g):
    """The shops to The Long Way Home: a soldier course of brick, leaves blown onto the slabs."""
    g.rect(0, 24, W, 8, "brown")
    for x in range(0, W, 4):
        g.rect(x + 3, 24, 1, 8, "dbrown")
        g.rect(x, 24, 3, 1, "tan")
    g.rect(0, 31, W, 1, "dbrown")
    g.rect(0, 32, W, 1, "slate")
    leaves(g, random.Random("road-the-long-way-home-start"), 8, 10, W - 10, 34, 54)


# key: (previous zone, this zone, last row of this zone, crossing)
STARTS = {
    "bark-park": ("woof-way", 18, crosswalk),
    "sniff-street-shops": ("bark-park", 32, threshold),
    "the-long-way-home": ("sniff-street-shops", 24, soldier_band),
}


def start(zone):
    prev, split, crossing = STARTS[zone]
    g = strip(zone, 0, split)
    g.px[split:] = strip(prev).px[split:]
    crossing(g)
    return g


def images():
    """Yield (key, Grid) for every image."""
    for zone in ZONES:
        yield f"road-{zone}", strip(zone)
    for zone in STARTS:
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
        prev = STARTS[zone][0] if zone in STARTS else zone
        mid = f"road-{zone}-start" if zone in STARTS else f"road-{zone}"
        # bottom to top, the order the road scrolls into view
        column = [f"road-{prev}"] * 2 + [mid] + [f"road-{zone}"] * 3
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
    path = "public/art/manifest.json"
    manifest = json.load(open(path))
    entries = {i["key"]: i for i in manifest.get("images", [])}
    for key in built:
        entries[key] = {"key": key, "png": f"images/{key}.png"}
    manifest["images"] = sorted(entries.values(), key=lambda i: i["key"])
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print("built", ", ".join(built))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
