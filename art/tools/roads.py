#!/usr/bin/env python3
"""Draw the per-zone road strips and the transitions between zones.

road-<zone>        320x64 images, one per zone. They tile vertically with no
                   seam: every pattern repeats in 64 rows (or a divisor of it)
                   and anything drawn near the top or bottom edge wraps.
road-<zone>-start  320x64 images, one per zone. Rows 20 to 63 are a neutral cross
                   street in dslate asphalt (CROSSING) and rows 0 to 19
                   this zone's strip, so a start strip follows any zone at a
                   fork: the road reads up the screen as the previous zone's
                   strip, the start strip, then this zone's strip.

Each strip keeps its zone's road colour (the game data's roadColor) as the base, so
the game's shadows (one ramp step darker) still match. The four lane dividers sit
at x = 64k-1 (2px wide) and share one look per zone, so lane edges stay
readable at speed; the outer 5 to 8 px of each side is a curb or verge, which an
outer lane's 56px sprite (4 px in from its 64px lane's edge) overlaps by up to 4 px.

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
from pixel import PALETTE64, Grid  # noqa: E402

W, H = 320, 64
LANE = 64
DIVIDERS = [k * LANE - 1 for k in range(1, 5)]


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


# ---------- lane lines ----------

PAW = (".x.x.", "x...x", ".xxx.", ".xxx.")


def high_park_lines(g):
    for x in DIVIDERS:
        for y in range(4, H, 16):
            # dbrown holds 4:1 on the tan path; plum caps the bottom
            g.rect(x, y, 2, 7, "dbrown")
            g.rect(x, y + 7, 2, 1, "plum")


def kensington_lines(g):
    for x in DIVIDERS:
        for y in (8, 40):
            # white dashes (11.8:1 on Kensington Market's dbrick) with a mauve
            # edge on the right
            g.rect(x, y, 2, 12, "white")
            g.rect(x + 2, y + 1, 1, 12, "mauve")


# fallen leaves (never amber or orange, which read as coins): a pointed blade, lit (f) on
# the upper left of a dark vein (v) that runs on out as the stem and shaded (s) below it, so each
# reads as a leaf and not a round fleck
_TILTED = ("..fff", ".ffvf", "ffvss", "fvss.", "v....")
_SMALL = ("..ff", ".fvf", "fvs.", "v...")
LEAF_SHAPES = (_TILTED, tuple(r[::-1] for r in _TILTED), _SMALL, tuple(r[::-1] for r in _SMALL),
               (".ff.", "fvfs", "fvss", ".vs.", ".v.."))


def leaves(g, rnd, n, x0, x1, tones, y0=0, y1=H):
    """n leaves spaced apart, clear of the lane dividers, each in one of tones (lit, shade, vein)."""
    for x, y in scatter(rnd, n, x0, x1, 18, y0, y1, lambda x, y: (x + 7) % LANE >= 9):
        tone = dict(zip("fsv", rnd.choice(tones)))
        for j, row in enumerate(rnd.choice(LEAF_SHAPES)):
            for k, ch in enumerate(row):
                if ch != ".":
                    wp(g, x + k, y + j, tone[ch])


def cabbagetown_lines(g):
    rnd = random.Random("road-cabbagetown-lines")
    for x in DIVIDERS:
        for y in (10, 42):
            # faded white (2.8:1 on the grey) with a slate edge, chipped where the paint wore
            g.rect(x, y, 2, 12, "white")
            g.rect(x + 2, y + 1, 1, 12, "slate")
            for _ in range(2):
                g.p(x + rnd.randrange(2), y + rnd.randrange(1, 11), "lgrey")


def beaches_lines(g):
    for x in DIVIDERS:
        for y in (6, 38):
            # dbrown (5.9:1 on the boards), 20 rows in 32: a longer rhythm than High Park's
            g.rect(x, y, 2, 20, "dbrown")


# ---------- the six neighborhoods ----------
# Each strip's base is its zone's road colour, which the game's road shadow steps down from.

def grit(g, rnd, n, cols):
    """Sparse 2px grit spaced apart, 1x2 or 2x1."""
    for x, y in scatter(rnd, n, 6, W - 7, 7):
        col = rnd.choice(cols)
        if rnd.random() < 0.7:
            wrect(g, x, y, 1, 2, col)
        else:
            wrect(g, x, y, 2, 1, col)


def cracks(g, rnd, runs, col):
    """Cracks running along the road, 1 to 2px wide, kept inside lanes."""
    for x, y, steps in runs:
        for _ in range(steps):
            wp(g, x, y, col)
            if rnd.random() < 0.25:
                x += rnd.choice((-1, 1))
                wp(g, x, y, col)
            y -= 1


def cabbagetown_ground(g):
    """Pale asphalt with granite gutters in stone, their joints every 16 rows."""
    rnd = random.Random("road-cabbagetown")
    g.rect(0, 0, W, H, "grey")
    grit(g, rnd, 60, ("slate", "slate", "dslate", "lgrey", "lgrey"))
    cracks(g, rnd, ((43, 12, 10), (100, 40, 12), (160, 62, 9), (224, 50, 14), (286, 30, 8)), "dslate")
    leaves(g, rnd, 4, 10, W - 10, (("moss", "olive", "dolive"), ("gold", "ochre", "rust")))
    for x0, edge in ((0, 4), (W - 4, W - 5)):
        g.rect(x0, 0, 4, H, "stone")
        g.rect(edge, 0, 1, H, "slate")
        for y in range(0, H, 16):
            g.rect(x0, y, 4, 2, "dstone")
    g.rect(0, 0, 1, H, "lgrey")
    g.rect(W - 1, 0, 1, H, "dstone")


def high_park_ground(g):
    """A dirt trail between High Park's dark undergrowth: pine edges with fir blades
    and moss glints, bark-brown needles on the path."""
    rnd = random.Random("road-high-park")
    g.rect(0, 0, W, H, "tan")
    specks(g, rnd, 150, "brown", 8, W - 8, 0.4)
    specks(g, rnd, 60, "cream", 8, W - 8, 0.2)
    # fallen needles in pairs along the trail, clear of the lane dividers
    for x, y in scatter(rnd, 16, 10, W - 10, 9, ok=lambda x, y: (x + 4) % LANE >= 8):
        wp(g, x, y, "bark")
        wp(g, x + 1, y + 1, "bark")
        wp(g, x + 2, y + 1, "bark")
    for _ in range(12):
        x, y = rnd.randrange(12, W - 14), rnd.randrange(H)
        if (x + 3) % LANE < 6:
            continue
        wrect(g, x, y, 2, 2, "lgrey")
        wp(g, x + 1, y + 1, "grey")
        wp(g, x, y, "white")
    for i in range(4):
        x, y = 214 + (6 if i % 2 else 0), i * 16 + 10
        for j, row in enumerate(PAW):
            for k, ch in enumerate(row):
                if ch == "x":
                    wp(g, x + k, y + j, "brown")
    for y in range(H):
        for side, seed in ((0, 1.1), (1, 2.7)):
            w = wave(y, seed, 6, 1.6)
            x0 = 0 if side == 0 else W - w
            g.rect(x0, y, w, 1, "pine")
            g.p(w if side == 0 else W - w - 1, y, "bark")
    for side in (0, 1):
        y = side * 5
        while y < H + side * 5 - 3:
            x = 1 + rnd.randrange(4)
            x = x if side == 0 else W - 1 - x
            wrect(g, x, y, 1, 2, "fir")
            y += rnd.randrange(2, 6)
        for y in (9 + side * 28, 44 - side * 22):
            wp(g, 2 if side == 0 else W - 3, y, "moss")


def distillery_ground(g):
    """Dslate laid as cobbles: setts 15 wide in courses 8 rows deep, half-offset each
    course, navy joints (2 rows across the road, 1px along it), a slate glint on some setts' top
    left; brick gutters along both sides."""
    rnd = random.Random("road-distillery-district")
    g.rect(0, 0, W, H, "dslate")
    for course in range(H // 8):
        y, off = course * 8, 8 if course % 2 else 0
        g.rect(0, y + 6, W, 2, "navy")
        for x in range(off - 16, W, 16):
            g.rect(x + 15, y, 1, 6, "navy")
            if rnd.random() < 0.45:
                g.rect(x + 1, y + 1, 3, 1, "slate")
            if rnd.random() < 0.15:
                g.p(x + rnd.randrange(4, 13), y + rnd.randrange(2, 5), "navy")
    for x0, edge in ((0, 4), (W - 4, W - 5)):
        g.rect(x0, 0, 4, H, "brick")
        g.rect(edge, 0, 1, H, "navy")
        for y in range(0, H, 8):
            g.rect(x0, y + 6, 4, 2, "dbrick")
    g.rect(0, 0, 1, H, "rust")


def distillery_lines(g):
    """A row of pale granite setts on each lane line: lgrey, 6 rows on and 2 off, a stone edge."""
    for x in DIVIDERS:
        for y in range(0, H, 8):
            g.rect(x, y, 2, 6, "lgrey")
            g.rect(x + 1, y, 1, 6, "stone")


def kensington_ground(g):
    """Dark brick flagstones in offset courses between dark laneway gutters: dbrick stones in plum joints,
    brick, walnut and mauve flecks worn into them; shale stones on the outer 4 columns inside a coal seam, an ash
    joint every 16 rows."""
    rnd = random.Random("road-kensington-market")
    g.rect(0, 0, W, H, "dbrick")
    # flagstones half a lane wide in courses 16 rows deep, each course offset half a stone, so the
    # lane dividers fall on joints of every other course
    for course in range(H // 16):
        y, off = course * 16, 16 if course % 2 else 0
        g.rect(0, y + 14, W, 2, "plum")
        for x in range(off - 1, W, 32):
            g.rect(x, y, 1, 14, "plum")
    specks(g, rnd, 20, "brick", 6, W - 6)
    specks(g, rnd, 10, "walnut", 6, W - 6)
    specks(g, rnd, 6, "mauve", 6, W - 6)
    for x0, inner in ((0, 4), (W - 4, W - 5)):
        g.rect(x0, 0, 4, H, "shale")
        g.rect(inner, 0, 1, H, "coal")
        for y in range(0, H, 16):
            g.rect(x0, y, 4, 2, "ash")


def beaches_ground(g):
    """A boardwalk, weathered: some boards skin1, sand drifted in skin1 along the edge beams, the
    beams driftwood."""
    rnd = random.Random("road-the-beaches")
    g.rect(0, 0, W, H, "cream")
    boards = range(0, W, 16)
    tinted = False
    for x0 in boards:
        tinted = not tinted and rnd.random() < 0.05
        if tinted:
            g.rect(x0, 0, 15, H, "skin1")
        for _ in range(rnd.randrange(1, 3)):
            wrect(g, x0 + rnd.randrange(1, 14), rnd.randrange(H), 1, rnd.randrange(5, 12), "tan")
    for x0 in boards[1:]:
        g.rect(x0 - 1, 0, 1, H, "tan")
    for x0 in boards:
        y = rnd.randrange(H)
        wrect(g, x0, y, 15, 2, "tan")
        wp(g, x0 + 3, y - 2, "driftwood")
        wp(g, x0 + 11, y + 3, "driftwood")
    for x, y in scatter(rnd, 7, 8, W - 8, 20, ok=lambda x, y: x % 16 < 13):
        wrect(g, x, y, 2, 2, "tan")
        wp(g, x + 1, y + 1, "brown")
    # sand drifted onto the boards beside each beam, 1 to 3 columns, wobbling down the strip
    for y in range(H):
        for side, seed in ((0, 0.8), (1, 3.3)):
            w = wave(y, seed, 2, 1.2)
            if w > 0:
                g.rect(4 if side == 0 else W - 4 - w, y, w, 1, "skin1")
    for x0, outer in ((0, 0), (W - 4, W - 1)):
        g.rect(x0, 0, 4, H, "driftwood")
        g.rect(outer, 0, 1, H, "stone")


def yonge_ground(g):
    """Dark concrete: shale slabs a lane wide and 32 rows long, their 2-row expansion joints in coal
    across the road and 1px along it under the lane lines, sparse ash and coal grit, a few coal cracks;
    dstone granite gutters, their joints in shale every 16 rows."""
    rnd = random.Random("road-yonge-street")
    g.rect(0, 0, W, H, "shale")
    grit(g, rnd, 50, ("ash", "ash", "coal", "coal", "dslate"))
    cracks(g, rnd, ((40, 20, 9), (150, 50, 11), (230, 12, 8)), "coal")
    for y in (14, 46):
        g.rect(0, y, W, 2, "coal")
    for x in DIVIDERS:
        g.rect(x, 0, 1, H, "coal")
    for x0, line in ((0, 5), (W - 5, W - 6)):
        g.rect(x0, 0, 5, H, "dstone")
        for y in range(0, H, 16):
            g.rect(x0, y, 5, 2, "shale")
        g.rect(line, 0, 1, H, "coal")
    g.rect(0, 0, 1, H, "stone")
    g.rect(W - 1, 0, 1, H, "shale")


def yonge_lines(g):
    """White dashes 14 rows long in 32 (11.3:1 on the shale) with a coal edge."""
    for x in DIVIDERS:
        for y in (2, 34):
            g.rect(x, y, 2, 14, "white")
            g.rect(x + 2, y, 1, 14, "coal")


# easiest to hardest, as the fork cards sort them
ZONES = {
    "cabbagetown": (cabbagetown_ground, cabbagetown_lines),
    "high-park": (high_park_ground, high_park_lines),
    "distillery-district": (distillery_ground, distillery_lines),
    "kensington-market": (kensington_ground, kensington_lines),
    "the-beaches": (beaches_ground, beaches_lines),
    "yonge-street": (yonge_ground, yonge_lines),
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
    """A neutral cross street in dslate asphalt, so a start strip follows any zone. Up
    the road: the near curb's top (rows 60 to 63) and rounded edge (58, 59), the asphalt with a
    zebra crossing (35 to 48), then the far curb's shadow (24, 25), face (22, 23) and lit top
    (20, 21). Every curb band is 2 rows but the near curb's 4-row top, each step 3.4:1 or less."""
    y0, y1 = CROSSING
    rnd = random.Random("road-crossing")
    g.rect(0, y0, W, y1 - y0, "dslate")
    for x, y in scatter(rnd, 30, 0, W, 7, 27, 56):
        g.rect(x, y, 1, 2, rnd.choice(("slate", "navy", "navy")))
    for x in range(12, W - 12, 12):
        g.rect(x, 35, 7, 14, "white")
        g.rect(x + 6, 35, 1, 14, "lgrey")
        g.rect(x, 47, 7, 2, "lgrey")
    g.rect(0, 20, W, 2, "lgrey")
    g.rect(0, 22, W, 2, "slate")
    g.rect(0, 24, W, 2, "navy")
    g.rect(0, 58, W, 2, "grey")
    g.rect(0, 60, W, 4, "lgrey")
    # curbstone joints at uneven spacing, along the road
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


def strip_image(g):
    from PIL import Image

    img = Image.new("RGB", (g.w, g.h))
    img.putdata([tuple(int(c[k:k + 2], 16) for k in (0, 2, 4)) for row in g.px for c in row])
    return img


def check(key, g):
    """Every pixel is opaque and on the palette, at the inventory size."""
    assert (g.w, g.h) == (W, H), key
    bad = {c for row in g.px for c in row if c not in PALETTE64}
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
            tile = strip_image(tiles[key]).resize((W * scale, H * scale), Image.NEAREST)
            sheet.paste(tile, (i * (W + gap) * scale, y * scale))
    sheet.save(out)


def build():
    os.makedirs("art/roads", exist_ok=True)
    os.makedirs("public/art/images", exist_ok=True)
    built = []
    for key, g in images():
        check(key, g)
        png = f"public/art/images/{key}.png"
        strip_image(g).save(png)
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
