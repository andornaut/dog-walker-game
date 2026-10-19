#!/usr/bin/env python3
"""Draw the logo and the full-screen backgrounds outside the run.

logo: a 128x30 wooden yard sign carrying the "DOG WALKER" wordmark in
block letters at 2x (flat yellow, a 1px ink outline and a solid 2px dred
shadow), with the leash and a paw print. It is the board of the yard
sign on the home screen (at 6,146, left of the gate path, where the pack never
stands), and works as a header on any other screen.

screen-<name>: 360x560 backgrounds in Endesga 32, one per screen. Where panels
and text sit, they are low-contrast dark wood, so the cream and tan UI text
reads on them.
- screen-home: morning on Maple Street. The bar strip, then the gate scene
  (y 40 to 196: street, curb, sidewalk, fence with the open gate, front path,
  yard sign, mailbox), then the porch deck from y 198 under the walker, dog
  and gear steps and Start walk. The slot sign (196,140 160x46) covers the
  right of the yard while a slot is for sale.
- screen-stats: evening indoors. A panelled den wall with, between the title
  and the close button and above the tabs (y 56), a framed dog photo, a low
  window onto Woof Way at night and the leash hooks. Below the tabs the wall
  is open for the stats panel and the badge wall (8,108 to 352,552).
- screen-end: sunset on The Long Way Home. Between the logo (116,40) and the
  summary panel (24,112 to 336,412), the front of the house the pack comes
  home to: its gable peeks over the logo, the front door (171,73 18x23) opens
  onto a step (164,96 32x4), and a flagstone path (168,100 24x12) runs down
  behind the panel's top edge. The lawn from y 96 gives the waving owners
  room either side, feet on y 110. Then a tall sky behind the panel, the
  zone's houses with lit windows (from y 370), the yards, the sidewalk and the
  brick road under the button (48,512 264x44). The houses, trees and fences
  stay within x 8 to 352, so beside the badges panel (8,416 344x92) the
  margins show only sky, lawn and sidewalk.
- screen-loading: Woof Way at night, shown while the game loads. The logo is
  drawn in, centred at 116,92; a starry sky above the houses and street lamps;
  the sidewalk at y 350 to 365 carries the progress track, and the plain road
  below it (to y 450) leaves room for a status line.

ui-loading-track: a 200x8 image, the dotted path the pair walks along, with a
doghouse at the far end. The game draws it at TRACK_AT (80,357).
ui-loading: a 48x32 sprite, tag walk (4 frames, 160ms): Casey and Biscuit side
on, walking right on a pink leash. The game draws it at PAIR_AT (76,332) plus
round(148 * progress) to the right, so Casey's heels start on the first dot and
Biscuit's nose ends at the doghouse.

Usage:
  screens.py preview OUT.png   the logo, the ui-loading frames, then every screen,
                               scaled up, and every screen again with its UI
                               blocked in
  screens.py build             write art/screens/*.aseprite, public/art/images/*.png
                               and public/art/sprites/ui-loading.*

Run from the repository root, after fonts.py build and the sprite builds. A
build overwrites the .aseprite sources, so hand edits to them belong in this
file instead.
"""

import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import backdrops as bd  # noqa: E402
import help as hp  # noqa: E402
from pixel import DARKER, Grid, K, build as build_sprites  # noqa: E402

W, H = 360, 560
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

# The sign letters, 5 rows at 1x (W is 6 wide), drawn at 2x with a 2px gap and 7px more for a space.
SIGN = {
    "D": ["####.", "#...#", "#...#", "#...#", "####."],
    "O": [".###.", "#...#", "#...#", "#...#", ".###."],
    "G": [".####", "#....", "#..##", "#...#", ".####"],
    "W": ["#....#", "#....#", "#.##.#", "#.##.#", ".#..#."],
    "A": [".###.", "#...#", "#####", "#...#", "#...#"],
    "L": ["#....", "#....", "#....", "#....", "#####"],
    "K": ["#..#.", "#.#..", "##...", "#.#..", "#..#."],
    "E": ["#####", "#....", "####.", "#....", "#####"],
    "R": ["####.", "#...#", "####.", "#..#.", "#...#"],
}
# The leash's span under the word, from its handle to the paw print, centred on the board.
LEASH_W = 112


def wordmark(s):
    """The word's pixels at 2x, as a set of (x, y) from its top-left."""
    pts, x = set(), 0
    for ch in s:
        if ch == " ":
            x += 7
            continue
        rows = SIGN[ch]
        for y, row in enumerate(rows):
            for i, c in enumerate(row):
                if c == "#":
                    pts |= {(x + 2 * i + dx, 2 * y + dy) for dx in (0, 1) for dy in (0, 1)}
        x += 2 * len(rows[0]) + 2
    return pts


def board(cv, x, y):
    """The yard sign's board, LOGO_W x LOGO_H: a plum rim with rounded corners, a light trim (cream top,
    tan sides) so it keeps its edge on dark wood and night sky, a dark-stained dbrown face, and a brown lip."""
    cv.fill(x + 1, y, LOGO_W - 2, LOGO_H, "plum")
    cv.fill(x, y + 1, LOGO_W, LOGO_H - 2, "plum")
    cv.fill(x + 1, y + 1, LOGO_W - 2, 25, "tan")
    cv.fill(x + 1, y + 1, LOGO_W - 2, 1, "cream")
    cv.fill(x + 2, y + 2, LOGO_W - 4, 24, "dbrown")
    cv.fill(x + 1, y + 26, LOGO_W - 2, 2, "brown")


def logo():
    cv = clear(LOGO_W, LOGO_H)
    board(cv, 0, 0)
    # a little plum grain on the face, under the word and clear of the leash
    for x, y, n in ((4, 3, 6), (118, 3, 5), (30, 25, 6), (86, 25, 5)):
        cv.fill(x, y, n, 1, "plum")
    # the word: flat yellow letters (6.79:1 on the dbrown face) in a 1px ink outline, on a solid dred
    # shadow offset 2px down and right, upright
    word = wordmark("DOG WALKER")
    wx = max(x for x, _ in word) + 1
    ox, oy = (LOGO_W - wx - 3) // 2, 4
    ring = {(x + dx, y + dy) for x, y in word for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
    shadow = {(x + d, y + d) for x, y in ring for d in (1, 2)} - ring
    for pts, col in ((shadow, "dred"), (ring - word, "ink"), (word, "yellow")):
        for x, y in pts:
            cv.fill(ox + x, oy + y, 1, 1, col)
    # the leash in pink (3.1:1 on the face): a handle loop at the left, a slack line under the word, a
    # clip and a cream paw print at the end
    lx = (LOGO_W - LEASH_W) // 2
    cv.fill(lx, 20, 5, 1, "pink")
    cv.fill(lx - 1, 21, 1, 3, "pink")
    cv.fill(lx, 24, 5, 1, "pink")
    cv.fill(lx + 5, 21, 1, 3, "pink")
    a, b = lx + 6, lx + LEASH_W - 12
    for x in range(a, b):
        t = (2 * x - a - b) / (b - a)
        cv.fill(x, 21 + round(2.4 * (1 - t * t)), 1, 1, "pink")
    cv.fill(lx + LEASH_W - 12, 21, 3, 3, "lgrey")
    cv.fill(lx + LEASH_W - 11, 22, 1, 1, "grey")
    for j, row in enumerate(PAW):
        for i, c in enumerate(row):
            if c == "#":
                cv.fill(lx + LEASH_W - 6 + i, 20 + j, 1, 1, "cream")
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
    board(cv, *LOGO_AT)
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
    cv.fill(0, 548, W, 1, "brown")
    cv.fill(0, 549, W, 10, "plum")
    cv.fill(0, 559, W, 1, "ink")
    # a low window onto Woof Way at night, between the title and the close button, above the tabs
    wx, wy, ww, wh = 116, 16, 128, 28
    view = night(bd.woof_way().img).crop((126, 20, 126 + ww, 20 + wh))
    cv.fill(wx - 6, wy - 6, ww + 12, wh + 12, "plum")
    cv.fill(wx - 5, wy - 5, ww + 10, wh + 10, "tan")
    cv.fill(wx - 5, wy - 5, ww + 10, 1, "cream")
    cv.fill(wx - 1, wy - 1, ww + 2, wh + 2, "brown")
    cv.img.paste(view, (wx, wy))
    cv.fill(wx + ww // 2 - 1, wy, 3, wh, "tan")
    cv.fill(wx, wy + wh // 2 - 1, ww, 3, "tan")
    cv.fill(wx + ww // 2 + 1, wy, 1, wh, "brown")
    cv.fill(wx, wy + wh // 2 + 1, ww, 1, "brown")
    # a crescent moon in the upper right pane
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            if dx * dx + dy * dy <= 16 and (dx + 2) ** 2 + (dy - 2) ** 2 > 10:
                cv.fill(wx + 116 + dx, wy + 7 + dy, 1, 1, "cream")
    # the sill
    cv.fill(wx - 10, wy + wh + 6, ww + 20, 3, "tan")
    cv.fill(wx - 10, wy + wh + 6, ww + 20, 1, "cream")
    cv.fill(wx - 8, wy + wh + 9, ww + 16, 1, "brown")
    cv.fill(wx - 8, wy + wh + 10, ww + 16, 1, "plum")
    # curtains, gathered at the sides
    cv.fill(wx - 18, wy - 8, ww + 36, 2, "brown")
    cv.fill(wx - 20, wy - 9, 3, 4, "amber")
    cv.fill(wx + ww + 17, wy - 9, 3, 4, "amber")
    for cx, d in ((wx - 14, 1), (wx + ww + 2, -1)):
        for y in range(wy - 6, wy + wh + 6):
            t = y - (wy - 6)
            bulge = 12 if t < 14 else max(5, 12 - (t - 14) // 2) if t < 26 else min(10, 5 + (t - 26) // 2)
            x0 = cx if d > 0 else cx + 12 - bulge
            cv.fill(x0, y, bulge, 1, "red")
            cv.fill(x0 + (2 if d > 0 else bulge - 4), y, 2, 1, "dred")
            cv.fill(x0 + bulge // 2 + (1 if d > 0 else 0), y, 1, 1, "dred")
        tie = cx + (2 if d > 0 else 4)
        cv.fill(tie, wy + 22, 6, 2, "amber")
    # a framed photo of Koda, right of the title
    fx, fy = 54, 14
    cv.fill(fx, fy, 38, 38, "plum")
    cv.fill(fx + 1, fy + 1, 36, 36, "amber")
    cv.fill(fx + 1, fy + 36, 36, 1, "orange")
    cv.fill(fx + 3, fy + 3, 32, 32, "sky")
    cv.fill(fx + 3, fy + 27, 32, 8, "green")
    cv.paste(hp.frame("face-dog-koda", "happy"), fx + 3, fy + 3)
    cv.fill(fx + 18, fy - 5, 2, 2, "amber")
    cv.line(fx + 19, fy - 4, fx + 4, fy, "plum")
    cv.line(fx + 19, fy - 4, fx + 34, fy, "plum")
    # the leash hooks, left of the close button: a peg rail with three leashes
    cv.fill(266, 12, 46, 5, "brown")
    cv.fill(266, 12, 46, 1, "tan")
    cv.fill(266, 17, 46, 1, "plum")
    for i, col in enumerate(("dred", "blue", "dgreen")):
        hx = 274 + i * 14
        cv.fill(hx, 17, 2, 3, "amber")
        cv.fill(hx - 3, 20, 2, 18 + i * 4, col)
        cv.fill(hx + 2, 20, 2, 12 + i * 3, col)
        cv.fill(hx - 3, 20, 7, 2, col)
        bottom = 38 + i * 4
        cv.fill(hx - 4, bottom, 4, 3, "lgrey")
        cv.fill(hx - 3, bottom + 1, 1, 1, "grey")
    return cv


# ---------- screen-end ----------

END_STREET = 370  # top of The Long Way Home strip on screen-end


def end():
    cv = hp.Canvas(W, H)
    # the sunset sky: orange at the top, amber, then yellow toward the roofs, with stepped edges
    cv.fill(0, 0, W, 520, "yellow")
    cv.fill(0, 0, W, 296, "amber")
    cv.fill(0, 0, W, 96, "orange")
    for i in range(0, W, 5):
        cv.fill(i, 96 + (i // 5) % 2, 5, 1, "orange")
        cv.fill(i, 296 + (i // 5) % 2, 5, 1, "amber")
    # the sun, low in the west, and streaks of cloud
    for dy in range(-22, 23):
        for dx in range(-22, 23):
            d = dx * dx + dy * dy
            if d <= 22 * 22:
                cv.fill(300 + dx, 44 + dy, 1, 1, "cream" if d <= 14 * 14 else "yellow")
    for x, y, w, col in ((14, 20, 70, "amber"), (40, 26, 44, "amber"), (252, 74, 64, "amber"), (276, 80, 84, "amber"),
                         (0, 176, 60, "yellow"), (300, 226, 50, "yellow"), (330, 232, 30, "yellow")):
        cv.fill(x, y, w, 2, col)
        cv.fill(x + 6, y - 2, w - 18, 2, col)
    # two birds heading home
    for bx, by in ((84, 50), (100, 42)):
        cv.fill(bx, by, 2, 1, "plum")
        cv.fill(bx + 2, by + 1, 1, 1, "plum")
        cv.fill(bx + 3, by, 2, 1, "plum")
    # the house the pack comes home to, between the logo and the panel. Its dred gable peeks over the logo,
    # which hangs on the front like a sign; the sun to the right stays clear.
    for i in range(30):
        half = round(4 + i * 58 / 29)
        cv.fill(180 - half, 18 + i, 2 * half, 1, "dred")
        cv.fill(180 - half, 18 + i, 2, 1, "red")
    cv.fill(116, 47, 128, 2, "plum")
    cv.fill(124, 49, 112, 47, "cream")
    cv.fill(233, 49, 3, 47, "tan")
    for y in range(54, 96, 6):
        cv.fill(124, y, 109, 1, "tan")
    # two lit windows with white sills, under the logo
    for wx in (132, 208):
        cv.fill(wx, 73, 20, 15, "plum")
        cv.fill(wx + 1, 74, 18, 13, "yellow")
        cv.fill(wx + 10, 74, 1, 13, "amber")
        cv.fill(wx + 1, 80, 18, 1, "amber")
        cv.fill(wx - 1, 88, 22, 2, "white")
    # the front door in a white frame, a porch light beside it, and the step
    cv.fill(169, 71, 22, 25, "white")
    cv.fill(171, 73, 18, 23, "dgreen")
    for py in (75, 85):
        cv.fill(173, py, 6, 8, "forest")
        cv.fill(181, py, 6, 8, "forest")
    cv.fill(186, 83, 2, 2, "amber")
    cv.fill(194, 74, 4, 2, "plum")
    cv.fill(195, 76, 2, 3, "yellow")
    # the lawn, flower beds along the wall and a hedge on each side
    cv.fill(0, 96, W, 16, "green")
    for i in range(30):
        cv.fill((i * 41) % W, 98 + (i * 7) % 13, 1, 2, "dgreen")
    for x0, x1 in ((124, 164), (196, 236)):
        cv.fill(x0, 92, x1 - x0, 4, "dbrown")
        cv.fill(x0, 92, x1 - x0, 1, "plum")
        bd.flowers(cv, x0 + 2, x1 - 2, 90, ("orange", "yellow", "red", "pink"))
    for x in list(range(-4, 112, 22)) + list(range(246, W, 22)):
        bd.bush(cv, x, 93, "dgreen")
    cv.fill(164, 96, 32, 4, "lgrey")
    cv.fill(164, 99, 32, 1, "grey")
    # the front path: tan flagstones from the step down behind the panel
    cv.fill(168, 100, 24, 12, "tan")
    cv.fill(168, 106, 24, 1, "brown")
    cv.fill(178, 100, 1, 6, "brown")
    cv.fill(184, 107, 1, 5, "brown")
    cv.fill(167, 100, 1, 12, "dgreen")
    cv.fill(192, 100, 1, 12, "dgreen")
    # the rest of the street, far off: amber rooftops and trees against the low sun
    for x, w, h, kind in ((8, 22, 22, "roof"), (28, 20, 30, "tree"), (50, 40, 18, "roof"), (92, 24, 28, "tree"),
                          (118, 36, 20, "roof"), (156, 20, 28, "tree"), (178, 44, 16, "roof"), (224, 24, 32, "tree"),
                          (250, 38, 22, "roof"), (290, 22, 26, "tree"), (314, 38, 18, "roof")):
        top = END_STREET + 80 - h
        cv.fill(x, top, w, h + 30, "amber")
        if kind == "roof":
            for j in range(w // 4):
                cv.fill(x + 2 * j, top - j, w - 4 * j, 1, "amber")
        else:
            for dy in range(-w // 2, w // 2 + 1):
                for dx in range(-w // 2, w // 2 + 1):
                    if dx * dx + dy * dy <= (w // 2) ** 2:
                        cv.fill(x + w // 2 + dx, top + dy, 1, 1, "amber")
    # The Long Way Home, in the zone backdrop's palette: trees, houses with lit windows, yards and the sidewalk.
    # Everything standing is kept within x 8 to 352, so the badges panel never cuts it into slivers.
    strip = clear(W, 150)
    for cx, top in ((30, 44), (182, 40), (330, 46)):
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
    for x, w, wall, roof, door in ((124, 50, "tan", "brown", "dred"), (298, 50, "cream", "purple", "blue")):
        bd.house(strip, x, w, wall, roof, door, top=48)
        for wx in (x + 6, x + w - 18):
            strip.fill(wx + 1, 81, 10, 8, "yellow")
            strip.fill(wx + 1, 85, 10, 1, "amber")
    bd.ground(strip)
    bd.flowers(strip, 48, 110, 110, ("orange", "yellow", "red"))
    bd.flowers(strip, 214, 286, 112, ("orange", "yellow", "red"))
    bd.fence(strip, 104, 8, 40)
    bd.fence(strip, 104, 120, 176)
    bd.fence(strip, 104, 294, 352)
    for x, y in ((20, 120), (100, 116), (176, 122), (260, 118), (330, 122)):
        strip.fill(x, y, 3, 2, "orange")
        strip.fill(x + 1, y - 1, 1, 1, "rust")
    cv.paste(strip.img, 0, END_STREET)
    # the brick road home, its top rows under the button
    road = hp.TILES["homeStretch"]
    cv.img.paste(road, (0, END_STREET + 150))
    cv.img.paste(road, (280, END_STREET + 150))
    return cv


# ---------- screen-loading, ui-loading-track, ui-loading ----------

STREET = 220  # top of the night street strip on screen-loading
LOADING_LOGO_AT = ((W - LOGO_W) // 2, 92)
TRACK_W, TRACK_H = 200, 8
TRACK_AT = (80, 357)
PAIR_W, PAIR_H = 48, 32
PAIR_FEET = 29  # the row the pair's feet stand on, in its frame
# Where the game draws ui-loading (origin top left) at progress 0, and how far right it walks by 1: Casey's
# heels start on the first dot and Biscuit's nose ends at the doghouse door. Its feet stand on the dots' row.
PAIR_AT = (TRACK_AT[0] - 4, TRACK_AT[1] + 4 - PAIR_FEET)
PAIR_TRAVEL = 148


def after_dark(img, steps=2):
    """A transparent strip drawn in daylight, turned to night: every colour steps ramp steps darker, the
    window glass lit yellow and the white mullions beside it amber."""
    px = img.load()
    w, h = img.size
    out = img.copy()
    po = out.load()
    cyan, white = hp.rgb("cyan"), hp.rgb("white")
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if c[3] == 0:
                continue
            if c[:3] == cyan:
                po[x, y] = hp.rgb("yellow") + (255,)
            elif c[:3] == white and any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][:3] == cyan
                                        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                po[x, y] = hp.rgb("amber") + (255,)
            else:
                d = "%02x%02x%02x" % c[:3]
                for _ in range(steps):
                    d = dk(d)
                po[x, y] = hp.rgb(d) + (255,)
    return out


def loading():
    cv = hp.Canvas(W, H)
    r = rand(13)
    # the night sky: navy over a dslate band behind the roofs, stepped where they meet, with streaks of cloud
    cv.fill(0, 0, W, STREET + 104, "dslate")
    cv.fill(0, 0, W, STREET + 20, "navy")
    for i in range(0, W, 5):
        cv.fill(i, STREET + 20 + (i // 5) % 2, 5, 1, "navy")
    for x, y, w in ((22, 140, 70), (244, 150, 84), (150, 196, 60)):
        cv.fill(x, y, w, 2, "dslate")
        cv.fill(x + 6, y - 2, w - 18, 2, "dslate")
    # stars: single specks, and a few brighter crosses
    for _ in range(90):
        x, y = int(r() * W), int(r() * (STREET + 10))
        cv.fill(x, y, 1, 1, "lgrey" if r() < 0.7 else "slate")
    for x, y in ((40, 40), (176, 30), (64, 150), (330, 132), (210, 170), (20, 200)):
        cv.fill(x - 1, y, 3, 1, "lgrey")
        cv.fill(x, y - 1, 1, 3, "lgrey")
        cv.fill(x, y, 1, 1, "white")
    # a crescent moon, top right
    for dy in range(-10, 11):
        for dx in range(-10, 11):
            if dx * dx + dy * dy <= 100 and (dx + 5) ** 2 + (dy - 3) ** 2 > 64:
                cv.fill(300 + dx, 48 + dy, 1, 1, "cream")
    # Woof Way after dark, drawn by day and then taken two ramp steps down: trees, houses with front paths,
    # fences and the sidewalk the pair walks along
    strip = clear(W, 150)
    for cx, top, rad in ((10, 44, 16), (180, 40, 16), (356, 50, 14)):
        bd.tree(strip, cx, top, "dgreen", "forest", r=rad)
    doors = []
    for x, w, wall, roof, door, top in ((30, 66, "white", "sky", "red", 38), (112, 52, "pink", "red", "dgreen", 50),
                                        (204, 70, "cream", "green", "blue", 34),
                                        (290, 54, "lgrey", "mauve", "red", 48)):
        bd.house(strip, x, w, wall, roof, door, top=top)
        doors.append(x + w // 2 - 5)
    bd.ground(strip)
    # the sidewalk a step darker than ground() draws it, so by night it is Woof Way's dslate road colour,
    # where the pink leash holds 3.5:1 and the track's cream dots 6.6:1
    strip.fill(0, 130, W, 15, "grey")
    for x in range(0, W, 24):
        strip.fill(x, 130, 1, 15, "slate")
    strip.fill(0, 145, W, 3, "lgrey")
    strip.fill(0, 148, W, 2, "grey")
    for dx in doors:
        strip.fill(dx, 104, 10, 26, "tan")
        strip.fill(dx, 112, 10, 1, "brown")
        strip.fill(dx, 121, 10, 1, "brown")
    edges = [0] + [e for dx in doors for e in (dx - 4, dx + 16)] + [W]
    for x0, x1 in zip(edges[::2], edges[1::2]):
        bd.fence(strip, 104, x0, x1)
    lit, glow = after_dark(strip.img), after_dark(strip.img, 1)
    # two street lamps, each leaving a pool one ramp step lighter on the lawn and the sidewalk, clear of the track
    for lx in (34, 326):
        for y in range(116, 150):
            for x in range(lx - 30, lx + 31):
                if 0 <= x < W and ((x - lx) / 30) ** 2 + ((y - 137) / 13) ** 2 <= 1:
                    lit.putpixel((x, y), glow.getpixel((x, y)))
    cv.paste(lit, 0, STREET)
    for lx in (34, 326):
        cv.fill(lx - 1, STREET + 46, 3, 88, "slate")
        cv.fill(lx - 1, STREET + 46, 1, 88, "grey")
        cv.fill(lx - 3, STREET + 132, 7, 2, "navy")
        cv.fill(lx - 5, STREET + 38, 11, 2, "navy")
        cv.fill(lx - 4, STREET + 40, 9, 5, "yellow")
        cv.fill(lx - 4, STREET + 44, 9, 1, "amber")
        cv.fill(lx - 2, STREET + 41, 2, 2, "cream")
        cv.fill(lx - 3, STREET + 45, 7, 1, "navy")
    # porch lights by the doors
    for dx in doors:
        cv.fill(dx - 3, STREET + 88, 2, 2, "yellow")
    # the street, navy: specks and a dashed centre line, then the near curb, sidewalk and a hedge along the
    # bottom. The road between the curb and y 450 has no markings, so a status line can sit there.
    cv.fill(0, STREET + 150, W, 140, "navy")
    for _ in range(320):
        cv.fill(int(r() * W), STREET + 150 + int(r() * 140), 1, 1, "dslate" if r() < 0.6 else "ink")
    for x in range(4, W, 28):
        cv.fill(x, 460, 14, 2, "slate")
    cv.fill(0, 510, W, 4, "dslate")
    cv.fill(0, 510, W, 1, "slate")
    cv.fill(0, 514, W, 18, "dslate")
    for x in range(12, W, 24):
        cv.fill(x, 514, 1, 18, "navy")
    cv.fill(0, 532, W, 28, "forest")
    for x in range(-6, W, 22):
        bd.bush(cv, x, 548 - (x // 22) % 2, "teal")
    cv.paste(logo().img, *LOADING_LOGO_AT)
    return cv


# The track's doghouse at the far end: a red roof and tan walls in a plum rim, and an ink door.
DOGHOUSE = [
    "...pppp...",
    "..pRRRRp..",
    ".pRRRRRRp.",
    "pRRRRRRRRp",
    ".pttkkttp.",
    ".pttkkttp.",
    ".pttkkttp.",
    ".pppppppp.",
]


def loading_track():
    """The dotted path the pair walks along: cream dots in plum rings every 6px, and a doghouse, home, at the end."""
    cv = clear(TRACK_W, TRACK_H)
    for x in range(0, 184, 6):
        cv.fill(x, 3, 4, 2, "plum")
        cv.fill(x + 1, 2, 2, 4, "plum")
        cv.fill(x + 1, 3, 2, 2, "cream")
    cols = {"p": "plum", "R": "red", "t": "tan", "k": "ink"}
    for j, row in enumerate(DOGHOUSE):
        for i, c in enumerate(row):
            if c in cols:
                cv.fill(TRACK_W - 10 + i, j, 1, 1, cols[c])
    return cv


SCREENS = {
    "logo": logo,
    "screen-home": home,
    "screen-stats": stats,
    "screen-end": end,
    "screen-loading": loading,
    "ui-loading-track": loading_track,
}


# Casey from the side, walking right: orange cap, dbrown hair, a face with one eye, and the blue hoodie
# (sky, lit cyan, shaded blue) with the near arm reaching forward to hold the leash. The legs are drawn per frame.
CASEY = [
    "...aaaaa......",
    "..ayyaaaa.....",
    ".aaaaaaaao....",
    ".ooooooooooo..",
    ".hhhsssss.....",
    ".hhhssskss....",
    ".hhhsssssss...",
    "..hhsssssm....",
    "...msss.......",
    "..bcccccb.....",
    ".bcCCccccc....",
    ".bcCcccbccc...",
    ".bccccccbbcc..",
    ".bcccccc..css.",
    ".bbccccb......",
    "..nnnnnn......",
]
# Biscuit from the side, trotting right: tricolour (ochre, a navy saddle, white chest and muzzle), a long
# rust ear, the green collar and a white-tipped tail. The legs are drawn per frame.
BISCUIT = [
    "...................",
    "e...........eeee...",
    ".e.........eeeeew..",
    ".e........reeekeww.",
    ".e.nnnnnnnrreeewwwk",
    ".eennnnnnnrrreewww.",
    ".eeennnnnngrrrww...",
    "..eeeeeeeegrrw.....",
    "..eeeeeeeeewww.....",
    "..eeeeeeewwww......",
]
PAIR_COLS = dict(a="amber", y="yellow", o="orange", h="dbrown", s="skin1", m="skin2", k="ink", b="blue", c="sky",
                 C="cyan", n="navy", e="ochre", r="rust", w="white", g="green")


def stamp(g, rows, x, y, cols=PAIR_COLS):
    for j, row in enumerate(rows):
        for i, c in enumerate(row):
            if c in cols:
                g.p(x + i, y + j, cols[c])


def pair(step):
    """48x32, one frame of the walk: Casey and Biscuit side on, the leash slack between them. The far legs
    are a shade darker. On the passing frames (1 and 3) the legs pass under the body and Casey bobs up 1px."""
    g = Grid(PAIR_W, PAIR_H)
    bob = step % 2
    # Casey: hips at row 22, shoes on row PAIR_FEET
    wx, wy = 4, PAIR_FEET - 23 - bob
    # on a passing frame the leg swinging through lifts its foot 1px, its shin a pixel back
    stride, swing = (3, 0, -3, 0)[step], (None, 0, None, 1)[step]
    for i, (hip, sway, trouser, shoe) in enumerate(((3, -stride, "navy", "lgrey"), (5, stride, "dslate", "white"))):
        up = 1 if swing == i else 0
        n = 6 + bob - up
        for k in range(n):
            g.rect(wx + hip + round(sway * k / (n - 1)) - (up if k > 2 else 0), wy + 16 + k, 2, 1, trouser)
        g.rect(wx + hip + sway - up, PAIR_FEET - up, 3, 1, shoe)
    stamp(g, CASEY, wx, wy)
    # Biscuit: diagonal leg pairs swap, legs from row 10 of the body to PAIR_FEET, and the tail tip wags
    dx, dy = 27, PAIR_FEET - 12
    reach = (1, 0, -1, 0)[step]
    for hip, sway, col in ((2, reach, "lgrey"), (11, -reach, "lgrey"), (4, -reach, "white"), (13, reach, "white")):
        for k in range(3):
            g.rect(dx + hip + round(sway * k / 2), dy + 10 + k, 2, 1, col)
    stamp(g, BISCUIT, dx, dy)
    g.p(dx + 1 + (0, 1, 0, -1)[step], dy, "white")
    px = g.outlined()
    # the leash, after the outline so it stays 1px: pink (3.5:1 on the night street), sagging from the hand
    # to the collar
    a, b = (wx + 13, wy + 13), (dx + 10, dy + 6)
    for x in range(a[0], b[0] + 1):
        t = (x - a[0]) / (b[0] - a[0])
        y = round(a[1] + (b[1] - a[1]) * t + (2 + bob) * 4 * t * (1 - t))
        if g.px[y][x] is None:
            px[y][x] = K["pink"]
    return px


def sprite_image(px):
    """A sprite frame (rows of hex colours or None) as an RGBA image, for the preview."""
    img = Image.new("RGBA", (len(px[0]), len(px)), (0, 0, 0, 0))
    for y, row in enumerate(px):
        for x, c in enumerate(row):
            if c:
                img.putpixel((x, y), hp.rgb(c) + (255,))
    return img


def sprites():
    yield "ui-loading", [("walk", [pair(i) for i in range(4)], 160)]


def ui(cv, key):
    """Block in the UI that sits on a screen, for the preview only (layout from StartScene, StatsScene on its
    badges tab, EndScene and loadingScreen.ts)."""
    def panel(x, y, w, h, face="cream"):
        cv.fill(x, y, w, h, "plum")
        cv.fill(x + 1, y + 1, w - 2, h - 2, face)

    def figure(x, foot, w, h, col):
        cv.fill(x - w // 2, foot - h, w, h, "plum")
        cv.fill(x - w // 2 + 1, foot - h + 1, w - 2, h - 2, col)

    if key == "screen-home":
        # The gate scene at 40..196, then StartScene's walker, dog and gear rows and Start walk on the deck,
        # which is plain planks so any arrangement of them works.
        cv.paste(logo().img, *LOGO_AT)
        hp.text(cv, "$385", 26, 15, "cream", 2)
        for x in (216, 268):
            panel(x, 10, 20, 20, "tan")
        for x in (8, 332):
            panel(x, 46, 20, 20, "tan")
        hp.text_c(cv, "MAPLE ST", 291, 59, "white")
        panel(130, 46, 100, 34, "white")
        panel(196, 140, 160, 46, "tan")
        for x in (206, 343):
            cv.fill(x, 186, 3, 10, "dbrown")
        panel(194, 166, 18, 18)
        figure(180, 196, 16, 40, "sky")
        for x, foot in ((180, 150), (154, 182), (206, 184)):
            figure(x, foot, 20, 16, "ochre")
        panel(4, 210, 132, 24, "tan")
        for i in range(4):
            panel(156 + i * 52, 200, 44, 44)
        panel(4, 248, 132, 24, "tan")
        hp.text(cv, "2/3 DOGS", 308, 255, "cream")
        for i in range(9):
            panel(4 + (i % 3) * 120, 276 + (i // 3) * 52, 112, 44)
        panel(4, 428, 132, 24, "tan")
        for i in range(5):
            panel(4 + i * 72, 456, 64, 44)
        hp.text_c(cv, "PACK FEE $40 PER ZONE", 180, 502, "cream")
        cv.fill(4, 518, 352, 40, "orange")
        cv.fill(4, 514, 352, 40, "amber")
    elif key == "screen-stats":
        hp.text(cv, "STATS", 12, 12, "cream")
        panel(332, 10, 20, 20, "tan")
        for i in range(3):
            panel(4 + i * 120, 56, 112, 44, "cream" if i == 2 else "tan")
        hp.text(cv, "BADGES", 12, 112, "cream")
        hp.text(cv, "7/15", 336, 112, "cream")
        for i in range(15):
            x, y = 8 + (i // 8) * 176, 132 + (i % 8) * 52
            panel(x, y + 2, 32, 32, "amber")
            hp.text(cv, "BADGE NAME", x + 36, y + 4, "amber", 2)
            hp.text(cv, "THE GOAL", x + 36, y + 20, "lgrey", 2)
            hp.text(cv, "SECOND LINE", x + 36, y + 36, "lgrey", 2)
    elif key == "screen-end":
        cv.paste(logo().img, 116, 40)
        for x, foot in ((116, 110), (144, 110), (216, 110)):
            figure(x, foot, 16, 40, "skin1")
        figure(180, 110, 16, 40, "sky")
        for x, foot in ((166, 106), (194, 105), (152, 108)):
            figure(x, foot, 20, 16, "ochre")
        panel(24, 112, 312, 300)
        panel(8, 416, 344, 92)
        cv.fill(48, 516, 264, 40, "orange")
        cv.fill(48, 512, 264, 40, "amber")
    elif key == "screen-loading":
        cv.paste(loading_track().img, *TRACK_AT)
        cv.paste(sprite_image(pair(0)), PAIR_AT[0] + round(PAIR_TRAVEL * 0.4), PAIR_AT[1])
        hp.text_c(cv, "LOADING 40%", 180, 390, "cream")


def preview(out, scale=2):
    keys = [k for k in SCREENS if k.startswith("screen-")]
    shots = [(k, False) for k in keys] + [(k, True) for k in keys]
    gap = 8
    top = LOGO_H * 3 + gap
    sheet = Image.new("RGB", ((W + gap) * len(shots) * scale, (top + H) * scale), hp.rgb("ink"))
    x = 0
    for ground in ("green", "dbrown", "amber", "navy"):
        bg = Image.new("RGBA", (LOGO_W, LOGO_H), hp.rgb(ground) + (255,))
        bg.alpha_composite(logo().img)
        sheet.paste(bg.resize((LOGO_W * 3 * scale, LOGO_H * 3 * scale), Image.NEAREST), (x * scale, 0))
        x += LOGO_W * 3 + gap
    # the ui-loading frames, on the night sidewalk
    for i in range(4):
        bg = Image.new("RGBA", (PAIR_W, PAIR_H), hp.rgb("grey") + (255,))
        bg.alpha_composite(sprite_image(pair(i)))
        sheet.paste(bg.resize((PAIR_W * 3 * scale, PAIR_H * 3 * scale), Image.NEAREST), (x * scale, 0))
        x += PAIR_W * 3 + gap
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
    build_sprites(list(sprites()), "art/screens")
    print("built", ", ".join(SCREENS))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
