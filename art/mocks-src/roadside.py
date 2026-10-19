#!/usr/bin/env python3
"""Mock: Elm Avenue's verges with roadside scenery, beside today's plain lawn.

Draws full 360x560 Elm Avenue run screens in Endesga 32 from the exported art (ui-top-bar, the
road strip, walker, dogs, road objects, backdrop-woof-way, ui-doghouse), as horizon.py does:
today's frame, then the same road with roadside billboards on the lawns beyond the sidewalks
at three scroll positions, and one of those under the dimmed road a card or the pause menu
draws.

The camera is the game's (shared/export/layout.json): a point d road px ahead of the feet
draws at scale s = 630 / (630 + d) on row -164 + 628 s, at x 180 -/+ across x s. The curb
runs to across 144 and the sidewalk to 188; every prop's inner edge lies at across 192 or
more, so on screen it stays outside the sidewalk on its own row and every row above it, and
the sidewalks and lanes stay clear. Props are road sprites in the OutRun manner: front
elevations, anchored bottom centre on their row, drawn back to front with the road objects,
under the backdrop band (so a far prop rises from behind its bottom edge, as the road's
objects do) and under the doghouses.

Each prop is drawn here at its depth step (1, 0.875, 0.75, 0.625, 0.5), redrawn at that size
on minis.Mini with its own road_edge outline, as minis.py draws the road objects' variants.

Placement: each side has a slot every SLOT road px, lots and gaps alternating, the right side
offset by one slot, so a house on one side faces a tree, lamp post or laundry line on the
other. A lot is a house with a picket fence or hedge in front, and a mailbox by the sidewalk
or a yard prop or both; each side steps through LOTS and GAPS with its own stride, so the two
sides differ and each repeats only after every lot and gap has passed.

Usage:
  roadside.py build    write public/art/mocks/roadside/*.png

Run from the repository root. Mock tooling only: nothing here is game art.
"""

import math
import os
import sys

from PIL import Image

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
sys.path.insert(0, HERE)
import help as hp  # noqa: E402
import horizon as hz  # noqa: E402
from minis import Mini  # noqa: E402
from pixel import DARKER, K, PALETTE, edged  # noqa: E402

OUT = "public/art/mocks/roadside"
ZONE = "street"
F, YH, KS, CX = hz.F, hz.YH, hz.KS, hz.CX
STEPS = (1, 0.875, 0.75, 0.625, 0.5)


def dk(c):
    return DARKER[K.get(c, c)]


# ---------- the props: front elevations, coordinates at full size ----------
# Each draw(g) paints on a Mini of the prop's frame size; the frame keeps a 1px clear ring for
# the outline. The bottom drawn row is the prop's ground row.

def window(g, x, y, w=16, h=14, shutters=None, box=False):
    if shutters:
        g.rect(x - 5, y, 4, h, shutters)
        g.rect(x + w + 1, y, 4, h, shutters)
    g.rect(x, y, w, h, "plum")
    g.rect(x + 2, y + 2, w - 4, h - 4, "cyan")
    g.rect(x + 2, y + 2, 3, 3, "white")
    g.rect(x + w // 2 - 1, y + 2, 2, h - 4, "white")
    g.rect(x - 2, y + h, w + 4, 2, "white")
    if box:
        g.rect(x - 1, y + h + 2, w + 2, 4, "dbrown")
        for i, c in enumerate(("red", "yellow", "pink", "red", "white")):
            g.rect(x + i * 4 - 1, y + h - 1 + (i % 2), 3, 3, c)


def door(g, cx, base, col, h=26):
    g.rect(cx - 8, base - h, 16, h, col)
    g.rect(cx - 6, base - h + 3, 12, 6, dk(col))
    g.rect(cx + 4, base - h // 2, 2, 2, "amber")
    g.rect(cx - 11, base - 3, 22, 3, "lgrey")


def gable(g, x0, x1, base, top, roof):
    g.tri((x0, base), (x1, base), ((x0 + x1) / 2, top), roof)
    g.rect(x0, base - 3, x1 - x0, 3, dk(roof))


def chimney(g, x, top, h):
    g.rect(x, top, 10, h, "brown")
    g.rect(x - 1, top - 2, 12, 3, "dbrown")


def cottage(wall, roof, door_c):
    """One storey under a steep gable: two shuttered windows with flower boxes, a door."""
    w, h, ww, wall_h = 98, 86, 84, 44

    def draw(g):
        x0, base = 7, h - 1
        top = base - wall_h
        chimney(g, x0 + ww - 24, 14, 22)
        gable(g, x0 - 5, x0 + ww + 5, top + 1, 2, roof)
        g.rect(x0, top, ww, wall_h, wall)
        g.rect(x0 + ww - 4, top, 4, wall_h, dk(wall))
        for x in (x0 + 10, x0 + ww - 26):
            window(g, x, top + 8, shutters=roof, box=True)
        door(g, x0 + ww // 2, base, door_c)
        g.ell(x0 + ww / 2, 20 + 3, 5, 5, "plum")
        g.ell(x0 + ww / 2, 20 + 3, 3, 3, "cyan")
    return w, h, draw


def two_storey(wall, roof, door_c):
    """Two storeys under a gable with a round attic window."""
    w, h, ww, wall_h = 88, 104, 74, 66

    def draw(g):
        x0, base = 7, h - 1
        top = base - wall_h
        chimney(g, x0 + 8, 16, 18)
        gable(g, x0 - 5, x0 + ww + 5, top + 1, 2, roof)
        g.rect(x0, top, ww, wall_h, wall)
        g.rect(x0 + ww - 4, top, 4, wall_h, dk(wall))
        g.rect(x0, top + 30, ww, 2, dk(wall))
        for x in (x0 + 9, x0 + ww - 25):
            window(g, x, top + 8, shutters=roof)
        window(g, x0 + 9, top + 40, box=True)
        door(g, x0 + ww - 20, base, door_c)
        g.ell(x0 + ww / 2, 24, 6, 6, "white")
        g.ell(x0 + ww / 2, 24, 4, 4, "cyan")
    return w, h, draw


def porch_house(wall, roof, door_c):
    """A wide bungalow under a hipped roof, a striped awning over the porch."""
    w, h, ww, wall_h = 112, 80, 100, 46

    def draw(g):
        x0, base = 6, h - 1
        top = base - wall_h
        chimney(g, x0 + ww - 26, 6, 18)
        g.tri((x0 - 5, top + 1), (x0 + 22, top + 1), (x0 + 22, 3), roof)
        g.tri((x0 + ww - 22, top + 1), (x0 + ww + 5, top + 1), (x0 + ww - 22, 3), roof)
        g.rect(x0 + 22, 3, ww - 44, top - 2, roof)
        g.rect(x0 - 5, top - 2, ww + 10, 3, dk(roof))
        g.rect(x0, top, ww, wall_h, wall)
        g.rect(x0 + ww - 4, top, 4, wall_h, dk(wall))
        for x in (x0 + 10, x0 + ww - 26):
            window(g, x, top + 10, shutters=None, box=True)
        cx = x0 + ww // 2
        door(g, cx, base - 2, door_c, h=24)
        # the porch: an awning in red and white stripes on two posts, a deck
        for i in range(8):
            g.rect(cx - 20 + i * 5, top + 4, 5, 8, "red" if i % 2 == 0 else "white")
        for i in range(8):
            g.rect(cx - 20 + i * 5 + 1, top + 12, 3, 2, "red" if i % 2 == 0 else "white")
        for x in (cx - 19, cx + 16):
            g.rect(x, top + 14, 3, wall_h - 16, "white")
        g.rect(cx - 22, base - 3, 44, 3, "tan")
    return w, h, draw


def fence(cat=False):
    """A white picket fence, 22 tall, its rails showing between the pickets; with the plum
    cat from the backdrops' perch sitting on top, at twice its size."""
    w, h = 102, 36 if cat else 24

    def draw(g):
        base = h - 1
        g.rect(1, base - 15, w - 2, 3, "lgrey")
        g.rect(1, base - 7, w - 2, 3, "lgrey")
        for x in range(2, w - 6, 10):
            g.rect(x, base - 18, 6, 19, "white")
            g.tri((x, base - 18), (x + 6, base - 18), (x + 3, base - 22), "white")
            g.rect(x + 5, base - 18, 1, 19, "lgrey")
        if cat:
            cells = ("x.x...", "xxx...", "xxx..x", ".xxx.x", ".xoxxx", ".xxxx.")
            for r, row in enumerate(cells):
                for c, ch in enumerate(row):
                    if ch != ".":
                        g.rect(64 + 2 * c, 1 + 2 * r, 2, 2, "plum" if ch == "x" else "purple")
            g.rect(66, 3, 2, 2, "yellow")
    return w, h, draw


def mailbox():
    w, h = 20, 32

    def draw(g):
        base = h - 1
        g.rect(8, 14, 4, base - 13, "dbrown")
        g.rect(3, 8, 14, 8, "blue")
        g.ell(10, 8, 7, 5, "blue")
        g.rect(13, 8, 4, 8, "navy")
        g.rect(5, 6, 6, 2, "sky")
        g.rect(16, 2, 2, 10, "red")
        g.rect(16, 2, 3, 3, "red")
    return w, h, draw


def tree(leaf="green", shade="dgreen", light="yellow", petals=None):
    """A round street tree: three lobes over a short trunk, cel shaded from the top left; a
    blossom tree takes petals instead of a lit rim."""
    w, h = 74, 114

    def draw(g):
        base = h - 1
        g.rect(32, 70, 10, base - 69, "dbrown")
        g.rect(38, 70, 4, base - 69, "plum")
        g.rect(28, base - 3, 18, 4, "dbrown")
        lobes = ((37, 42, 32, 30), (20, 62, 17, 14), (54, 62, 17, 14))
        for cx, cy, rx, ry in lobes:
            g.ell(cx, cy, rx, ry, shade)
        for cx, cy, rx, ry in lobes:
            g.ell(cx - 2, cy - 3, rx - 3, ry - 3, light or leaf)
        for cx, cy, rx, ry in lobes:
            g.ell(cx - 1, cy - 2, rx - 4, ry - 4, leaf)
        for x, y, r in ((46, 34, 4), (26, 50, 3), (50, 58, 3), (30, 24, 3)):
            g.ell(x, y, r, r, shade)
        if petals:
            for x, y in ((20, 30), (34, 16), (40, 44), (16, 56), (54, 50), (28, 64)):
                g.rect(x, y, 3, 3, petals)
    return w, h, draw


def hedge():
    w, h = 86, 32

    def draw(g):
        base = h - 1
        g.rect(3, 14, w - 6, base - 13, "dgreen")
        for x in range(12, w - 8, 15):
            g.ell(x, 14, 10, 10, "dgreen")
        g.rect(3, base - 5, w - 6, 6, "forest")
        for x in range(8, w - 8, 15):
            g.rect(x, 7, 5, 3, "green")
            g.rect(x + 4, 18, 3, 2, "forest")
    return w, h, draw


def lamp():
    """A street lamp: a lantern with a warm glass on a slim post."""
    w, h = 22, 98

    def draw(g):
        base = h - 1
        g.rect(9, 22, 4, base - 21, "dslate")
        g.rect(9, 22, 1, base - 21, "slate")
        g.rect(6, base - 7, 10, 8, "dslate")
        g.rect(7, 22, 8, 3, "dslate")
        g.rect(4, 10, 14, 12, "yellow")
        g.rect(4, 10, 3, 12, "white")
        g.rect(15, 10, 3, 12, "amber")
        g.tri((1, 11), (21, 11), (11, 2), "navy")
        g.rect(3, 20, 16, 2, "navy")
    return w, h, draw


def gnome():
    w, h = 18, 28

    def draw(g):
        base = h - 1
        g.rect(4, base - 11, 10, 10, "blue")
        g.rect(4, base - 1, 4, 2, "dbrown")
        g.rect(10, base - 1, 4, 2, "dbrown")
        g.tri((3, 12), (15, 12), (8, 1), "red")
        g.rect(5, 12, 8, 4, "skin1")
        g.tri((4, 15), (14, 15), (9, 23), "white")
        g.rect(8, 13, 2, 2, "pink")
    return w, h, draw


def flowers():
    w, h = 58, 18

    def draw(g):
        base = h - 1
        g.rect(2, base - 4, w - 4, 5, "dbrown")
        g.rect(2, base - 4, w - 4, 1, "brown")
        cols = ("red", "yellow", "pink", "white", "red", "orange", "pink", "yellow", "white", "red")
        for i, c in enumerate(cols):
            x = 4 + i * 5
            g.ell(x + 2, base - 7, 3, 3, "dgreen")
            g.rect(x + (i % 2), base - 12 + 2 * (i % 3), 4, 4, c)
    return w, h, draw


def bike():
    """A kid's bike on its stand, side on: two wheels, a red frame, streamers."""
    w, h = 46, 30

    def draw(g):
        base = h - 1
        for cx in (11, 35):
            g.ell(cx, base - 8, 9, 9, "dslate")
            g.ell(cx, base - 8, 6, 6, None)
            g.rect(cx - 1, base - 9, 2, 2, "grey")
        g.tri((11, base - 8), (19, base - 9), (16, base - 18), "red")
        g.tri((16, base - 18), (32, base - 18), (24, base - 9), "red")
        g.tri((24, base - 9), (19, base - 9), (16, base - 18), None)
        g.rect(16, base - 18, 16, 3, "red")
        g.rect(31, base - 22, 3, 14, "red")
        g.rect(12, base - 22, 9, 3, "navy")
        g.rect(29, base - 25, 9, 3, "lgrey")
        g.rect(38, base - 25, 2, 6, "pink")
        g.rect(40, base - 23, 2, 6, "cyan")
    return w, h, draw


def sprinkler():
    """A lawn sprinkler's fan of water on a little grey head."""
    w, h = 52, 28

    def draw(g):
        base = h - 1
        g.rect(23, base - 4, 6, 5, "grey")
        g.rect(24, base - 6, 4, 2, "lgrey")
        for side in (-1, 1):
            for i in range(1, 7):
                x = 26 + side * (i * 3.6)
                y = base - 8 - 14 * math.sin(math.pi * i / 8)
                g.rect(round(x) - 1, round(y), 3, 3, "cyan" if i % 2 else "white")
    return w, h, draw


def laundry():
    """A washing line between two T posts: a shirt, a sheet, socks, a dress."""
    w, h = 106, 64

    def draw(g):
        base = h - 1
        for x in (6, w - 10):
            g.rect(x, 8, 4, base - 7, "lgrey")
            g.rect(x - 4, 8, 12, 3, "lgrey")
        g.rect(8, 12, w - 16, 1, "grey")
        # shirt
        g.rect(16, 13, 18, 18, "sky")
        g.rect(12, 13, 4, 8, "sky")
        g.rect(34, 13, 4, 8, "sky")
        g.rect(23, 13, 4, 3, "white")
        # sheet
        g.rect(42, 13, 24, 26, "white")
        g.rect(42, 31, 24, 2, "pink")
        # socks
        g.rect(70, 13, 5, 12, "red")
        g.rect(70, 23, 8, 3, "red")
        g.rect(80, 13, 5, 12, "yellow")
        g.rect(80, 23, 8, 3, "yellow")
        # dress
        g.tri((88, 13), (96, 13), (92, 34), "pink")
        g.rect(88, 13, 8, 8, "pink")
        g.tri((85, 34), (99, 34), (92, 18), "pink")
    return w, h, draw


# The houses' colourways, after backdrop-woof-way's row of houses: wall, roof, door.
TAN, PINK, SKY, CREAM, GREY = (("tan", "brown", "dgreen"), ("pink", "purple", "white"), ("sky", "navy", "red"),
                               ("cream", "dred", "sky"), ("lgrey", "slate", "dred"))

PROPS = {
    "house-cottage": lambda: cottage(*TAN),
    "house-cottage-pink": lambda: cottage(*PINK),
    "house-tall": lambda: two_storey(*CREAM),
    "house-tall-grey": lambda: two_storey(*GREY),
    "house-porch": lambda: porch_house(*SKY),
    "house-porch-tan": lambda: porch_house(*TAN),
    "fence": lambda: fence(),
    "fence-cat": lambda: fence(cat=True),
    "hedge": hedge,
    "mailbox": mailbox,
    "tree": tree,
    "tree-blossom": lambda: tree("pink", "mauve", None, "white"),
    "lamp": lamp,
    "gnome": gnome,
    "flowers": flowers,
    "bike": bike,
    "sprinkler": sprinkler,
    "laundry": laundry,
}
# Props that cast the game's ground shadow (one ramp step darker): the free-standing ones.
SHADOWED = {"tree", "tree-blossom", "lamp", "mailbox", "gnome", "bike"}

SPRITES = {}


def sprite(key, step):
    """The prop redrawn at depth step `step`, with its own outline; and its ground row."""
    if (key, step) not in SPRITES:
        w, h, draw = PROPS[key]()
        g = edged(Mini(step, w, h))
        draw(g)
        rows = g.outlined()
        img = Image.new("RGBA", (len(rows[0]), len(rows)), (0, 0, 0, 0))
        img.putdata([(0, 0, 0, 0) if c is None else hp.rgb(c) + (255,) for row in rows for c in row])
        a = img.getchannel("A")
        feet = max(y for y in range(img.height) if any(a.getpixel((x, y)) for x in range(img.width)))
        SPRITES[key, step] = img, feet
    return SPRITES[key, step]


# ---------- placement ----------
# A lot: (house, front, [(prop, across, dz)]). across is the prop's centre from the road's centre
# line in road px; dz is how far behind (+) or in front of (-) the house it stands. The house's
# inner edge sits at across 206, the fence's at 210, the mailbox's at 198.

SLOT = 112
FRONT_DZ = -26


def house_across(key):
    return 206 + PROPS[key]()[0] / 2


LOTS = (
    ("house-cottage", "fence", (("mailbox", 208, -30), ("flowers", 252, -34))),
    ("house-tall", "hedge", (("mailbox", 208, -30), ("gnome", 232, -12))),
    ("house-porch", "fence-cat", (("bike", 230, -36),)),
    ("house-cottage-pink", "fence", (("mailbox", 208, -30), ("sprinkler", 268, -12))),
    ("house-tall-grey", "fence", (("gnome", 240, -12),)),
    ("house-porch-tan", "hedge", (("mailbox", 208, -30), ("flowers", 256, -34))),
)
GAPS = (
    (("tree", 230, 0),),
    (("lamp", 204, -10), ("tree-blossom", 256, 10)),
    (("laundry", 262, 0),),
    (("tree", 236, 0), ("lamp", 204, -30)),
    (("tree-blossom", 232, 0),),
)


def placements(side, z0, z1):
    """Every prop on one side (-1 left, 1 right) with its world z in z0..z1: (z, across, key).
    Slot n stands at z n SLOT, the left side's even slots and the right side's odd ones being
    lots; each side walks LOTS and GAPS with its own stride, so the two sides differ."""
    out = []
    for n in range(math.floor(z0 / SLOT) - 1, math.ceil(z1 / SLOT) + 2):
        z = n * SLOT
        lot = (n % 2 == 0) == (side < 0)
        k = n // 2
        if lot:
            house, front, extras = LOTS[(k * (1 if side < 0 else 5) + (0 if side < 0 else 3)) % len(LOTS)]
            out.append((z, house_across(house), house))
            out.append((z + FRONT_DZ, 210 + PROPS[front]()[0] / 2, front))
            out += [(z + dz, across, key) for key, across, dz in extras]
        else:
            gap = GAPS[(k * (2 if side < 0 else 3) + (0 if side < 0 else 1)) % len(GAPS)]
            out += [(z + dz, across, key) for key, across, dz in gap]
    return [p for p in out if z0 <= p[0] < z1]


def shadow(cv, cx, foot, w):
    """The ground's own colour one ramp step darker, in an ellipse under a prop's feet."""
    px = cv.img.load()
    rx = max(3, w / 2 - 2)
    ry = max(1.5, rx * 0.22)
    for y in range(-4, 5):
        for x in range(int(-rx - 1), int(rx + 2)):
            dx, dy = (x + 0.5) / rx, (y + 0.5) / ry
            xx, yy = int(cx + x), int(foot - 1 + y)
            if dx * dx + dy * dy <= 1 and 0 <= xx < hz.SW and 0 <= yy < hz.SH:
                px[xx, yy] = hp.rgb(DARKER["%02x%02x%02x" % px[xx, yy]])


# ---------- frames ----------

def frame(scroll, props=True):
    """Elm Avenue at this scroll (road px walked): the road, the props and road objects back to
    front, the pack, the backdrop band over them, the band's road rows, the HUD."""
    z = hz.ZONES[ZONE]
    cv = hz.Screen(ZONE)
    hz.ground_rows(cv, ZONE, hz.FAR_Y, hz.SH, hz.true_scale, scroll=scroll)
    items = [(it[3], "road", it) for it in z["objects"]]
    if props:
        for side in (-1, 1):
            for wz, across, key in placements(side, scroll, scroll + hz.LAYOUT["camera"]["visibleDistance"]):
                items.append((wz - scroll, "prop", (side, across, key)))
    for d, kind, it in sorted(items, key=lambda i: -i[0]):
        if kind == "road":
            key, tag, lane, _ = it
            cv.stand(key, tag, hz.lane_x(lane), d)
            continue
        side, across, key = it
        s = F / (F + d)
        img, feet = sprite(key, hz.snap(s))
        x, y = CX + side * across * s, YH + KS * s
        if key in SHADOWED:
            shadow(cv, round(x), round(y), img.width * (0.55 if key.startswith("tree") else 1))
        cv.paste(img, round(x - img.width / 2), round(y) - feet - 1)
    cv.pack(hz.LANES[2], [f"dog-{k}" for k, _ in z["dogs"]])
    cv.paste(hp.image(f"backdrop-{hp.ZONES[ZONE]['art']}"), 0, hz.BAND_Y)
    approach = hz.LAYOUT["regions"]["approach"]
    hz.ground_rows(cv, ZONE, approach["y"], approach["y"] + approach["height"], hz.true_scale,
                   scroll=scroll, road_only=True)
    hz.hud(cv, hz.ROUTES[ZONE], z["money"], z["treats"], 0.35, z["dogs"])
    return cv


def dimmed(cv):
    """The road view two ramp steps darker, as the pause menu dims it under its panel."""
    road = hz.LAYOUT["regions"]["roadView"]
    cv.dim(road["x"], road["y"], road["width"], road["height"])
    return cv


def sheet():
    """Every prop at each depth step, bottoms aligned, on Elm Avenue's lawn."""
    keys = list(PROPS)
    gap, pad = 6, 8
    cols = [max(sprite(k, s)[0].width for s in STEPS) for k in keys]
    rows = [max(sprite(k, s)[0].height for k in keys) for s in STEPS]
    img = Image.new("RGB", (sum(cols) + gap * (len(keys) - 1) + 2 * pad, sum(rows) + gap * 4 + 2 * pad),
                    hp.rgb("green"))
    y = pad
    for s, rh in zip(STEPS, rows):
        x = pad
        for k, cw in zip(keys, cols):
            spr, feet = sprite(k, s)
            img.paste(spr, (x + (cw - spr.width) // 2, y + rh - 1 - feet), spr)
            x += cw + gap
        y += rh + gap
    return img


SCROLLS = (0, 120, 240)


def build():
    os.makedirs(OUT, exist_ok=True)
    out = {"woof-way-today": frame(0, props=False).img}
    for i, scroll in enumerate(SCROLLS):
        out[f"woof-way-roadside-{i + 1}"] = frame(scroll).img
    out["woof-way-roadside-dimmed"] = dimmed(frame(SCROLLS[0])).img
    out["props"] = sheet()
    for name, img in out.items():
        hz.check(img)
        img.save(f"{OUT}/{name}.png")
        print(f"{OUT}/{name}.png {img.width}x{img.height}")
    for k in PROPS:
        print(k, " ".join(f"{sprite(k, s)[0].width}x{sprite(k, s)[0].height}" for s in STEPS))


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
