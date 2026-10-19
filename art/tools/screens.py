#!/usr/bin/env python3
"""Draw the logo and the full-screen backgrounds outside the run.

logo: a 128x30 wooden yard sign carrying the "DOG WALKER" wordmark in
Silkscreen at 2x, with the leash and a paw print. It is the board of the yard
sign on the home screen (at 6,146, left of the gate path, where the pack never
stands), and works as a header on any other screen.

screen-<name>: 360x640 backgrounds in Endesga 32, one per screen. Where panels
and text sit, they are low-contrast dark wood, so the cream and tan UI text
reads on them.
- screen-home: morning on Maple Street. The bar strip, then the gate scene in
  the start screen's layout (street, curb, sidewalk, fence with the open gate,
  front path, yard sign, mailbox), then the porch deck under the dog picker,
  gear, logbook and Start walk.
- screen-stats: evening indoors. A panelled den wall with a window onto Woof
  Way at night, a framed dog photo and the leash hooks, above an open wall for
  the stats and the badge wall.
- screen-end: sunset on The Long Way Home. A tall sky behind the summary
  panel (24,140 to 336,440), then the zone's houses with lit windows, the
  yards, the sidewalk and the brick road.

Usage:
  screens.py preview OUT.png   the logo, then every screen, scaled up; home and
                               end are shown again with their UI blocked in
  screens.py build             write art/screens/*.aseprite and
                               public/art/images/*.png, and list them in the manifest

Run from the repository root, after fonts.py build and the sprite builds. A
build overwrites the .aseprite sources, so hand edits to them belong in this
file instead.
"""

import json
import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import backdrops as bd  # noqa: E402
import fonts  # noqa: E402
import help as hp  # noqa: E402
from pixel import DARKER, K  # noqa: E402

W, H = 360, 640
LOGO_W, LOGO_H = 128, 30
LOGO_AT = (6, 146)


def dk(c):
    return DARKER[K.get(c, c)]


def rand(seed):
    """A small deterministic generator, so a rebuild draws the same specks."""
    s = seed & 0xFFFFFFFF

    def r():
        nonlocal s
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
        return s / 4294967296

    return r


def clear(w, h):
    """A canvas with a transparent background, for the logo and the pasted strips."""
    cv = hp.Canvas(w, h)
    cv.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return cv


def leaf(cv, x, y, col="orange"):
    """A fallen maple leaf, 3x3 with a stem."""
    cv.fill(x + 1, y, 1, 3, col)
    cv.fill(x, y + 1, 3, 1, col)
    cv.fill(x + 2, y + 3, 1, 1, dk(col))


def planks(cv, x, y, w, h, step, vertical=False, seed=1):
    """Dark wood boards: dbrown with plum seams, staggered butt joints, nail pairs and sparse grain."""
    r = rand(seed)
    cv.fill(x, y, w, h, "dbrown")
    span, run = (w, h) if vertical else (h, w)
    for b in range(0, span, step):
        if vertical:
            cv.fill(x + b, y, 1, h, "plum")
        else:
            cv.fill(x, y + b, w, 1, "plum")
        at = -int(r() * 120)
        while at < run:
            at += 90 + int(r() * 70)
            if at < run:
                if vertical:
                    cv.fill(x + b + 1, y + at, step - 1, 1, "plum")
                    cv.fill(x + b + 2, y + at - 2, 1, 1, "plum")
                    cv.fill(x + b + step - 3, y + at - 2, 1, 1, "plum")
                else:
                    cv.fill(x + at, y + b + 1, 1, step - 1, "plum")
                    cv.fill(x + at - 2, y + b + 2, 1, 1, "plum")
                    cv.fill(x + at - 2, y + b + step - 3, 1, 1, "plum")
        for _ in range(run // 110):
            g = int(r() * (run - 8))
            off = 2 + int(r() * (step - 4))
            if vertical:
                cv.fill(x + b + off, y + g, 1, 5, "plum")
            else:
                cv.fill(x + g, y + b + off, 5, 1, "plum")


# ---------- logo ----------

PAW = [".#.#.", "#...#", ".###.", ".###."]


def wordmark(s):
    """The word's Silkscreen pixels at 1x, as a set of (x, y), with the font's own spacing."""
    gl, ascent, _ = fonts.glyphs(*fonts.FONTS["font-title"][1:])
    pts, x = set(), 0
    for ch in s:
        mask, ox, oy, adv = gl[ch]
        if mask is not None:
            for yy in range(mask.height):
                for xx in range(mask.width):
                    if mask.getpixel((xx, yy)):
                        pts.add((x + ox + xx, oy + yy - (ascent - 5)))
        x += adv
    return pts


def logo():
    cv = clear(LOGO_W, LOGO_H)
    # the board: plum frame with rounded corners, tan face, a cream top edge and a brown lip
    cv.fill(1, 0, LOGO_W - 2, LOGO_H, "plum")
    cv.fill(0, 1, LOGO_W, LOGO_H - 2, "plum")
    cv.fill(2, 2, LOGO_W - 4, 24, "tan")
    cv.fill(2, 2, LOGO_W - 4, 1, "cream")
    cv.fill(2, 26, LOGO_W - 4, 2, "brown")
    # the word at 2x: amber face with a yellow top, orange lower half, a 1px dbrown drop and a plum outline
    word = {(2 * x + i, 2 * y + j) for x, y in wordmark("DOG WALKER") for i in (0, 1) for j in (0, 1)}
    wx = max(x for x, _ in word) + 1
    ox, oy = (LOGO_W - wx) // 2, 5
    drop = {(x, y + 1) for x, y in word} - word
    body = word | drop
    for x, y in body:
        for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
            if (x + dx, y + dy) not in body:
                cv.fill(ox + x + dx, oy + y + dy, 1, 1, "plum")
    for x, y in drop:
        cv.fill(ox + x, oy + y, 1, 1, "dbrown")
    for x, y in word:
        cv.fill(ox + x, oy + y, 1, 1, "yellow" if y < 2 else "amber" if y < 6 else "orange")
    # the leash: a handle loop under the D, a slack line under the word, a clip and a paw print at the end
    cv.fill(ox, 20, 5, 1, "dred")
    cv.fill(ox - 1, 21, 1, 3, "dred")
    cv.fill(ox, 24, 5, 1, "dred")
    cv.fill(ox + 5, 21, 1, 3, "dred")
    a, b = ox + 6, ox + wx - 12
    for x in range(a, b):
        t = (2 * x - a - b) / (b - a)
        cv.fill(x, 21 + round(2.4 * (1 - t * t)), 1, 1, "dred")
    cv.fill(ox + wx - 12, 21, 3, 3, "lgrey")
    cv.fill(ox + wx - 11, 22, 1, 1, "grey")
    for j, row in enumerate(PAW):
        for i, c in enumerate(row):
            if c == "#":
                cv.fill(ox + wx - 6 + i, 20 + j, 1, 1, "dbrown")
    return cv


# ---------- screen-home ----------

def home():
    cv = hp.Canvas(W, H)
    r = rand(7)
    # the bar strip the game draws its bar over
    cv.fill(0, 0, W, 38, "plum")
    cv.fill(0, 38, W, 2, "dbrown")
    # Maple Street: asphalt, a dashed centre line, a manhole and a storm drain
    cv.fill(0, 40, W, 52, "dslate")
    for _ in range(260):
        cv.fill(int(r() * W), 40 + int(r() * 52), 1, 1, "slate" if r() < 0.6 else "navy")
    for x in range(4, W, 28):
        cv.fill(x, 65, 14, 2, "lgrey")
    for dy in range(-4, 5):
        for dx in range(-8, 9):
            if (dx / 8.5) ** 2 + (dy / 4.5) ** 2 <= 1:
                inner = (dx / 6) ** 2 + (dy / 3) ** 2 <= 1
                cv.fill(250 + dx, 78 + dy, 1, 1, "slate" if inner and (dx + dy) % 3 == 0 else "navy")
    cv.fill(52, 87, 18, 5, "navy")
    for x in range(54, 70, 3):
        cv.fill(x, 88, 1, 3, "ink")
    # the curb and the sidewalk
    cv.fill(0, 92, W, 4, "grey")
    cv.fill(0, 92, W, 1, "lgrey")
    cv.fill(0, 96, W, 30, "lgrey")
    for x in range(0, W, 24):
        cv.fill(x, 96, 1, 30, "grey")
    cv.fill(98, 104, 3, 1, "grey")
    cv.fill(100, 105, 2, 1, "grey")
    cv.fill(270, 116, 4, 1, "grey")
    # a maple in a sidewalk planter: its shadow, the trunk, then a lumpy crown in autumn colours, lit from the top left
    for dy in range(-6, 7):
        for dx in range(-24, 25):
            if (dx / 24) ** 2 + (dy / 6.5) ** 2 <= 1:
                x, y = 78 + dx, 100 + dy
                cv.fill(x, y, 1, 1, dk("%02x%02x%02x" % cv.img.getpixel((x, y))))
    cv.fill(60, 108, 22, 14, "dbrown")
    cv.fill(61, 109, 20, 12, "brown")
    cv.fill(62, 110, 18, 2, "dbrown")
    cv.fill(69, 92, 4, 20, "dbrown")
    cv.fill(69, 92, 1, 20, "brown")
    for lx, ly, r in ((-6, -10, 10), (8, -9, 10), (0, 0, 13), (-13, 3, 10), (13, 4, 10), (0, 10, 10)):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx * dx + dy * dy <= r * r:
                    lit = (dx + dy) / r
                    c = "rust" if lit > 0.55 else "amber" if lit < -0.75 else "orange"
                    cv.fill(71 + lx + dx, 80 + ly + dy, 1, 1, c)
    for x, y in ((58, 70), (66, 66), (74, 68), (56, 80)):
        cv.fill(x, y, 1, 1, "yellow")
    # the street sign on the corner (the game prints the name on the board in white, which
    # holds 7.8:1 on forest green)
    # (it sits 36px in from the right so the sound toggle fits in the corner above it)
    cv.fill(290, 62, 2, 54, "slate")
    cv.fill(290, 62, 1, 54, "grey")
    cv.fill(264, 56, 54, 11, "teal")
    cv.fill(265, 57, 52, 9, "forest")
    cv.fill(288, 114, 6, 2, "dslate")
    # the front yard
    cv.fill(0, 126, W, 70, "green")
    for i in range(46):
        cv.fill((i * 53) % W, 132 + (i * 29) % 60, 1, 2, "dgreen")
    # flower beds along the inside of the fence
    for x0, x1 in ((0, 152), (208, W)):
        cv.fill(x0, 139, x1 - x0, 5, "dbrown")
        cv.fill(x0, 139, x1 - x0, 1, "plum")
        bd.flowers(cv, x0 + 2, x1 - 2, 140, ("red", "yellow", "pink", "white"))
    # the front path: tan flagstones from the porch to the gate
    cv.fill(164, 126, 32, 70, "tan")
    for y in range(130, 196, 8):
        cv.fill(164, y, 32, 1, "brown")
        cv.fill(180 + (4 if (y // 8) % 2 else -6), y + 1, 1, 7, "brown")
    cv.fill(163, 126, 1, 70, "dgreen")
    cv.fill(196, 126, 1, 70, "dgreen")
    # the picket fence with the gate open, and its posts
    for x in range(2, W, 6):
        if 158 < x < 200:
            continue
        cv.fill(x, 124, 4, 14, "white")
        cv.fill(x + 3, 125, 1, 13, "lgrey")
        cv.fill(x + 1, 123, 2, 1, "white")
        cv.fill(x, 138, 4, 1, "dgreen")
    cv.fill(0, 128, 158, 2, "lgrey")
    cv.fill(202, 128, 158, 2, "lgrey")
    for px in (154, 202):
        cv.fill(px, 120, 5, 20, "lgrey")
        cv.fill(px, 120, 5, 1, "white")
        cv.fill(px + 4, 121, 1, 19, "grey")
        cv.fill(px, 140, 5, 1, "dgreen")
    # the yard sign: blank board (the logo goes over it) on two posts
    for px in (16, 120):
        cv.fill(px, 172, 3, 22, "dbrown")
        cv.fill(px - 1, 194, 5, 1, "dgreen")
    cv.fill(LOGO_AT[0], LOGO_AT[1], LOGO_W, LOGO_H, "plum")
    cv.fill(LOGO_AT[0] + 2, LOGO_AT[1] + 2, LOGO_W - 4, 24, "tan")
    cv.fill(LOGO_AT[0] + 2, LOGO_AT[1] + 26, LOGO_W - 4, 2, "brown")
    # the mailbox
    cv.fill(296, 158, 3, 34, "dbrown")
    cv.fill(294, 192, 7, 1, "dgreen")
    cv.fill(286, 148, 24, 12, "red")
    cv.fill(286, 148, 24, 1, "pink")
    cv.fill(286, 158, 24, 2, "dred")
    cv.fill(308, 142, 2, 8, "amber")
    # a bush in the corner, a water bowl by the path and a ball on the lawn
    bd.bush(cv, 322, 186, "dgreen")
    cv.fill(222, 189, 10, 4, "slate")
    cv.fill(223, 189, 8, 2, "sky")
    cv.fill(224, 189, 3, 1, "cyan")
    cv.fill(250, 176, 5, 5, "red")
    cv.fill(250, 176, 2, 2, "pink")
    cv.fill(254, 179, 1, 2, "dred")
    for x, y, c in ((120, 50, "orange"), (210, 84, "rust"), (30, 104, "orange"), (140, 112, "rust"),
                    (236, 100, "orange"), (240, 160, "orange"), (270, 150, "rust"), (344, 80, "orange")):
        leaf(cv, x, y, c)
    # the porch: a step nosing, then the deck under the panels
    cv.fill(0, 196, W, 1, "tan")
    cv.fill(0, 197, W, 1, "brown")
    planks(cv, 0, 198, W, H - 198, 11, seed=3)
    return cv


# ---------- screen-stats ----------

def night(img):
    """Woof Way after dark: the sky turns navy with stars, everything else a ramp step darker, windows lit."""
    px = img.load()
    w, h = img.size
    skyc = {hp.rgb(c) for c in ("cyan", "sky", "white", "lgrey")}
    sky, todo = set(), [(x, 0) for x in range(w)]
    while todo:
        x, y = todo.pop()
        if (x, y) in sky or not (0 <= x < w and 0 <= y < 104) or px[x, y] not in skyc:
            continue
        sky.add((x, y))
        todo += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    out = img.copy()
    po = out.load()
    cyan, white = hp.rgb("cyan"), hp.rgb("white")
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if (x, y) in sky:
                po[x, y] = hp.rgb("navy" if y < 30 + (x // 5) % 2 else "dslate")
            elif c == cyan:
                po[x, y] = hp.rgb("yellow")
            elif c == white and any(0 <= x + dx < w and px[x + dx, y] == cyan for dx in (-1, 1)):
                po[x, y] = hp.rgb("amber")
            else:
                po[x, y] = hp.rgb(dk("%02x%02x%02x" % c))
    r = rand(11)
    for _ in range(40):
        x, y = int(r() * w), int(r() * 60)
        if (x, y) in sky:
            po[x, y] = hp.rgb("white" if r() < 0.4 else "lgrey")
    return out


def stats():
    cv = hp.Canvas(W, H)
    planks(cv, 0, 0, W, H, 20, vertical=True, seed=5)
    # crown moulding and baseboard
    cv.fill(0, 0, W, 6, "plum")
    cv.fill(0, 6, W, 1, "brown")
    cv.fill(0, 7, W, 1, "ink")
    cv.fill(0, 626, W, 1, "brown")
    cv.fill(0, 627, W, 13, "plum")
    cv.fill(0, 639, W, 1, "ink")
    # the window onto Woof Way at night
    view = night(bd.woof_way().img).crop((100, 18, 260, 112))
    wx, wy, ww, wh = 100, 24, 160, 94
    cv.fill(wx - 6, wy - 6, ww + 12, wh + 12, "plum")
    cv.fill(wx - 5, wy - 5, ww + 10, wh + 10, "tan")
    cv.fill(wx - 5, wy - 5, ww + 10, 1, "cream")
    cv.fill(wx - 1, wy - 1, ww + 2, wh + 2, "brown")
    cv.img.paste(view, (wx, wy))
    cv.fill(wx + ww // 2 - 1, wy, 3, wh, "tan")
    cv.fill(wx, wy + wh // 2 - 1, ww, 3, "tan")
    cv.fill(wx + ww // 2 + 1, wy, 1, wh, "brown")
    cv.fill(wx, wy + wh // 2 + 1, ww, 1, "brown")
    # a crescent moon in the upper pane
    for dy in range(-5, 6):
        for dx in range(-5, 6):
            if dx * dx + dy * dy <= 25 and (dx + 3) ** 2 + (dy - 2) ** 2 > 16:
                cv.fill(wx + 130 + dx, wy + 10 + dy, 1, 1, "cream")
    # the sill
    cv.fill(wx - 10, wy + wh + 6, ww + 20, 4, "tan")
    cv.fill(wx - 10, wy + wh + 6, ww + 20, 1, "cream")
    cv.fill(wx - 8, wy + wh + 10, ww + 16, 2, "brown")
    cv.fill(wx - 8, wy + wh + 12, ww + 16, 1, "plum")
    # curtains, gathered at the sides
    for cx, d in ((wx - 14, 1), (wx + ww + 2, -1)):
        cv.fill(wx - 18, wy - 10, ww + 36, 3, "brown")
        cv.fill(wx - 20, wy - 11, 3, 5, "amber")
        cv.fill(wx + ww + 17, wy - 11, 3, 5, "amber")
        for y in range(wy - 7, wy + wh + 8):
            t = y - (wy - 7)
            bulge = 12 if t < 46 else max(5, 12 - (t - 46) // 3) if t < 64 else min(12, 5 + (t - 64) // 3)
            x0 = cx if d > 0 else cx + 12 - bulge
            cv.fill(x0, y, bulge, 1, "red")
            cv.fill(x0 + (2 if d > 0 else bulge - 4), y, 2, 1, "dred")
            cv.fill(x0 + bulge // 2 + (1 if d > 0 else 0), y, 1, 1, "dred")
        tie = cx + (2 if d > 0 else 4)
        cv.fill(tie, wy + 56, 6, 3, "amber")
    # a framed photo of Koda on the left wall
    fx, fy = 26, 40
    cv.fill(fx, fy, 44, 44, "plum")
    cv.fill(fx + 1, fy + 1, 42, 42, "amber")
    cv.fill(fx + 1, fy + 42, 42, 1, "orange")
    cv.fill(fx + 4, fy + 4, 36, 36, "cream")
    cv.fill(fx + 6, fy + 6, 32, 32, "sky")
    cv.fill(fx + 6, fy + 30, 32, 8, "green")
    cv.paste(hp.frame("face-dog-koda", "happy"), fx + 6, fy + 6)
    cv.fill(fx + 21, fy - 6, 2, 2, "amber")
    cv.line(fx + 22, fy - 5, fx + 6, fy, "plum")
    cv.line(fx + 22, fy - 5, fx + 38, fy, "plum")
    # the leash hooks on the right wall: a peg rail with three leashes
    cv.fill(284, 40, 52, 6, "brown")
    cv.fill(284, 40, 52, 1, "tan")
    cv.fill(284, 46, 52, 1, "plum")
    for i, col in enumerate(("dred", "blue", "dgreen")):
        hx = 292 + i * 16
        cv.fill(hx, 46, 2, 4, "amber")
        cv.fill(hx - 3, 50, 2, 26 + i * 6, col)
        cv.fill(hx + 2, 50, 2, 18 + i * 4, col)
        cv.fill(hx - 3, 50, 7, 2, col)
        bottom = 76 + i * 6
        cv.fill(hx - 4, bottom, 4, 3, "lgrey")
        cv.fill(hx - 3, bottom + 1, 1, 1, "grey")
    return cv


# ---------- screen-end ----------

def end():
    cv = hp.Canvas(W, H)
    # the sunset sky: orange at the top, amber, then yellow toward the roofs, with stepped edges
    cv.fill(0, 0, W, 590, "yellow")
    cv.fill(0, 0, W, 330, "amber")
    cv.fill(0, 0, W, 120, "orange")
    for i in range(0, W, 5):
        cv.fill(i, 120 + (i // 5) % 2, 5, 1, "orange")
        cv.fill(i, 330 + (i // 5) % 2, 5, 1, "amber")
    # the sun, low in the west, and streaks of cloud
    for dy in range(-22, 23):
        for dx in range(-22, 23):
            d = dx * dx + dy * dy
            if d <= 22 * 22:
                cv.fill(300 + dx, 76 + dy, 1, 1, "cream" if d <= 14 * 14 else "yellow")
    for x, y, w, col in ((14, 34, 70, "amber"), (40, 40, 44, "amber"), (196, 96, 64, "amber"), (240, 104, 90, "amber"),
                         (10, 200, 60, "yellow"), (300, 250, 50, "yellow"), (330, 256, 30, "yellow")):
        cv.fill(x, y, w, 2, col)
        cv.fill(x + 6, y - 2, w - 18, 2, col)
    # two birds heading home
    for bx, by in ((92, 62), (108, 54)):
        cv.fill(bx, by, 2, 1, "plum")
        cv.fill(bx + 2, by + 1, 1, 1, "plum")
        cv.fill(bx + 3, by, 2, 1, "plum")
    # the rest of the street, far off: amber rooftops and trees against the low sun
    for x, w, h, kind in ((0, 30, 22, "roof"), (28, 20, 30, "tree"), (50, 40, 18, "roof"), (92, 24, 28, "tree"),
                          (118, 36, 20, "roof"), (156, 20, 28, "tree"), (178, 44, 16, "roof"), (224, 24, 32, "tree"),
                          (250, 38, 22, "roof"), (290, 22, 26, "tree"), (314, 46, 18, "roof")):
        top = 520 - h
        cv.fill(x, top, w, h + 30, "amber")
        if kind == "roof":
            for j in range(w // 4):
                cv.fill(x + 2 * j, top - j, w - 4 * j, 1, "amber")
        else:
            for dy in range(-w // 2, w // 2 + 1):
                for dx in range(-w // 2, w // 2 + 1):
                    if dx * dx + dy * dy <= (w // 2) ** 2:
                        cv.fill(x + w // 2 + dx, top + dy, 1, 1, "amber")
    # The Long Way Home, in the zone backdrop's palette: trees, houses with lit windows, yards and the sidewalk
    strip = clear(W, 150)
    for cx, top in ((20, 44), (182, 40), (346, 46)):
        bd.tree(strip, cx, top, "orange", "rust", r=20)
    for x, w, wall, roof, door in ((44, 70, "white", "dred", "dgreen"), (210, 80, "skin1", "navy", "red")):
        bd.house(strip, x, w, wall, roof, door, top=36)
        strip.fill(x + 8, 82, w - 16, 3, "brown")
        strip.fill(x + 10, 85, 2, 17, "brown")
        strip.fill(x + w - 12, 85, 2, 17, "brown")
        strip.fill(x + w // 2 - 8, 84, 3, 4, "yellow")
        for wx in (x + 6, x + w - 18):
            strip.fill(wx + 1, 69, 10, 8, "yellow")
            strip.fill(wx + 6, 69, 1, 8, "amber")
            strip.fill(wx + 1, 73, 10, 1, "amber")
    for x, w, wall, roof, door in ((124, 50, "tan", "brown", "dred"), (300, 50, "cream", "purple", "blue")):
        bd.house(strip, x, w, wall, roof, door, top=48)
        for wx in (x + 6, x + w - 18):
            strip.fill(wx + 1, 81, 10, 8, "yellow")
            strip.fill(wx + 1, 85, 10, 1, "amber")
    bd.ground(strip)
    bd.flowers(strip, 48, 110, 110, ("orange", "yellow", "red"))
    bd.flowers(strip, 214, 286, 112, ("orange", "yellow", "red"))
    bd.fence(strip, 104, 0, 40)
    bd.fence(strip, 104, 120, 176)
    bd.fence(strip, 104, 294, W)
    for x, y in ((20, 120), (100, 116), (176, 122), (260, 118), (330, 122)):
        strip.fill(x, y, 3, 2, "orange")
        strip.fill(x + 1, y - 1, 1, 1, "rust")
    cv.paste(strip.img, 0, 440)
    # the brick road home
    road = hp.road_tile("home")
    cv.img.paste(road, (0, 590))
    cv.img.paste(road, (280, 590))
    return cv


SCREENS = {
    "logo": logo,
    "screen-home": home,
    "screen-stats": stats,
    "screen-end": end,
}


def ui(cv, key):
    """Block in the UI that sits on a screen, for the preview only (layout from StartScene and EndScene)."""
    def panel(x, y, w, h, face="cream"):
        cv.fill(x, y, w, h, "plum")
        cv.fill(x + 1, y + 1, w - 2, h - 2, face)

    if key == "screen-home":
        cv.paste(logo().img, *LOGO_AT)
        hp.text(cv, "$385", 26, 15, "cream", 2)
        hp.text(cv, "YOUR PACK", 8, 202, "cream")
        hp.text(cv, "2/3 DOGS", 320, 202, "tan")
        for i in range(9):
            panel(8 + (i % 3) * 116, 212 + (i // 3) * 54, 112, 50)
        hp.text(cv, "GEAR", 8, 378, "cream")
        for i in range(5):
            panel(8 + i * 70, 388, 64, 58)
        hp.text_c(cv, "FANNY PACK: START EACH WALK WITH +$15", 180, 451, "amber")
        panel(8, 462, 344, 70)
        cv.fill(8, 544, 344, 36, "orange")
        cv.fill(8, 540, 344, 36, "amber")
        hp.text_c(cv, "PACK FEE $40 PER ZONE", 180, 588, "cream")
        for i in range(4):
            panel(70 + i * 38, 603, 34, 34, "tan")
    elif key == "screen-end":
        panel(24, 140, 312, 300)
        cv.fill(48, 388, 264, 36, "orange")
        cv.fill(48, 384, 264, 36, "amber")


def preview(out, scale=2):
    keys = [k for k in SCREENS if k != "logo"]
    shots = [(k, False) for k in keys] + [("screen-home", True), ("screen-end", True)]
    gap = 8
    top = LOGO_H * 3 + gap
    sheet = Image.new("RGB", ((W + gap) * len(shots) * scale, (top + H) * scale), hp.rgb("ink"))
    lg = logo().img
    for i, ground in enumerate(("green", "dbrown", "amber")):
        bg = Image.new("RGBA", lg.size, hp.rgb(ground) + (255,))
        bg.alpha_composite(lg)
        sheet.paste(bg.resize((LOGO_W * 3 * scale, LOGO_H * 3 * scale), Image.NEAREST), (i * (LOGO_W * 3 + gap) * scale, 0))
    for i, (key, blocked) in enumerate(shots):
        cv = SCREENS[key]()
        if blocked:
            ui(cv, key)
        sheet.paste(cv.img.convert("RGB").resize((W * scale, H * scale), Image.NEAREST), (i * (W + gap) * scale, top * scale))
    sheet.save(out)


def build():
    os.makedirs("art/screens", exist_ok=True)
    os.makedirs("public/art/images", exist_ok=True)
    for key, draw in SCREENS.items():
        png = f"public/art/images/{key}.png"
        draw().img.save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/screens/{key}.aseprite"], check=True)
    path = "public/art/manifest.json"
    manifest = json.load(open(path))
    entries = {i["key"]: i for i in manifest.get("images", [])}
    for key in SCREENS:
        entries[key] = {"key": key, "png": f"images/{key}.png"}
    manifest["images"] = sorted(entries.values(), key=lambda i: i["key"])
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print("built", ", ".join(SCREENS))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
