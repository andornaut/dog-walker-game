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
- screen-home: morning on a suburban street. The bar strip, then the gate
  scene (y 40 to 196: street, curb, sidewalk, fence with the open gate, front
  path, yard sign), then the porch deck from y 198 under the walker, dog and
  gear steps and Start walk. The street sign's board (300,72 54x11, a 52x9
  forest face) sits at the right edge, clear of the walker's speech bubble;
  the game prints homeText.gateSign on it in font-body, white, centred at 327,75 (48px
  wide in capitals). The yard's right lot is left for ui-pet-shop.
- screen-stats: evening indoors. A panelled den wall that leaves the top left
  clear for the title (12,12 to 68,22); then, between the title and the close
  button and above the tabs (y 56), a framed dog photo, a low window onto
  the street's houses at night (backdrops.stats_street's rows 90 to 117, from STATS_VIEW_TOP, a
  ramp step darker, the windows lit), and the leash hooks. Below the
  tabs the wall is open for the stats panel and the badge wall (8,108 to
  352,552).
- screen-end: a street at sunset. Between the logo (116,40) and the
  summary panel (24,112 to 336,412), the front of the house the pack comes
  home to: its gable peeks over the logo, the front door (171,73 18x23) opens
  onto a step (164,96 32x4), and a flagstone path (168,100 24x12) runs down
  behind the panel's top edge. The lawn from y 96 gives the waving owners
  room either side, feet on y 110. The banded sunset (SUNSET_SKY) fills the sky
  twice: behind the house down to its lawn, under the striped sun at 300,44,
  and behind the panel down to the far rooftops (y 450). Then the street's
  houses with lit windows (from y 370), the yards, the sidewalk and
  Kensington Market's brick road under the button (48,512 264x44). The houses, trees and fences
  stay within x 8 to 352, so beside the badges panel (8,416 344x92) the
  margins show only sky, lawn and sidewalk.
- screen-loading: a Toronto street at night, shown while the game loads, seen
  from the road. NIGHT_SKY's bands fill the sky down to SKY_FOOT (356), stars,
  a crescent moon at the top left and the logo drawn in at 2x (256x60 at
  52,80) in the navy band. Far back, downtown's towers in navy and dslate
  silhouette with a few gold floors lit, and the CN Tower lit (its haze shaft,
  the pod's gold window ring, the SkyPod and a red beacon on the mast, tip at
  row 150) over the corner lot. The near row: three Cabbagetown
  bay-and-gables in brick and dbrick (stone and driftwood bargeboards, an
  arched attic window, a two-storey bay, the door with its lit transom),
  most windows lit gold, over pine front yards behind a coal iron fence with
  stone stoops; a board fence across the lane, a heritage lamp lit yellow in
  front of it at x 227; and ui-pet-shop's building on the corner lot (236,306)
  a ramp step darker, its board lit and its display window and door pane
  glowing gold. The sidewalk (rows 414 to 469, grey, slabs every 24px)
  carries the track and the pair, a TTC streetcar stop at its left end;
  then the curb, and the street, flat navy and plain from the curb to row
  500, where a status line could sit (the game draws none), then two
  streetcar tracks.

ui-pet-shop: a 120x108 sprite, tags normal, pressed and glint: the pet shop on
the yard's right lot, which opens the shop. The game draws it at PET_SHOP_AT
(234,86), its base on the yard's bottom row (193), and its hit area is the
frame. The PET SHOP board (BOARD, 3,0 114x22 in the frame, 237,86 on screen)
spans the parapet, its bottom 2 rows over it, built and coloured as ui-button's
go state (green face, yellow highlight, forest lip, ink line), with PET SHOP in
the sign letters' shapes at 2x in ink, as the go label. Under it a red and
white awning, a display window with a food bag and a puppy behind its bone, and a door with a
paw on its glass; rust brick with dbrown mortar, lit ochre on the left, dred on the right, ink
outline all round, on a grey step. pressed dips as ui-button does: the front
sinks 2px onto the step, the step 1px shallower, and the board loses its lip
and highlight to face, as go-pressed. glint is 7 frames at 60ms: a 6px light
band sweeping up and across the raised board (GLINT_STEPS), then a clean
frame; the game plays it every few seconds while idle, with a bob of at most
2px, which keeps the board's top (86) clear of the street sign's plate (bottom
row 82). An affordable item in the shop takes ui-afford 2px outside the frame
(232,84 124x112).

ui-loading-track: a 316x8 image, the sidewalk being walked: Biscuit's paw
prints in dslate, staggered on two rows from Casey's heel to the Pet shop's door.
The game draws it at TRACK_AT (16,456).
ui-loading: a 98x84 sprite, tag walk (4 frames, 160ms): Casey and Biscuit side
on, walking right on a plum leash, at the road sprites' size (Casey as tall as
her 56x84 walker, Biscuit as his 56x56 dog), cel shaded with the road outline,
Casey's face flat skin. Frames 0 and 2 plant the feet apart, 1 and 3 pass
with the body 1px higher, a foot lifted, and Biscuit's diagonal pairs swap.
The game draws it at PAIR_AT (6,379) plus round(228 * progress) to the right,
its feet on row 460, so Casey's heel starts on the first paw print and
Biscuit's nose ends at the Pet shop's door pane.

Usage:
  screens.py preview OUT.png   the logo, the ui-loading frames, then every screen,
                               scaled up, and every screen again with its UI
                               blocked in
  screens.py shop-preview OUT.png
                               ui-pet-shop's tags on the yard at 1x and 4x, and
                               screen-home with it in at 1x and 4x
  screens.py build             write art/screens/*.aseprite, public/art/images/*.png
                               and public/art/sprites/ui-loading.* and ui-pet-shop.*

Run from the repository root, after fonts.py build and the sprite builds. A
build overwrites the .aseprite sources, so hand edits to them belong in this
file instead.
"""

import math
import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import backdrops as bd  # noqa: E402
import fonts  # noqa: E402
import scene as sn  # noqa: E402
import minis  # noqa: E402
import road  # noqa: E402
from pixel import Grid, K, build as build_sprites, dk, edged, to_image  # noqa: E402
from ui import STATES  # noqa: E402

W, H = 360, 560
LOGO_W, LOGO_H = 128, 30
LOGO_AT = (6, 146)
PET_SHOP_W, PET_SHOP_H = 120, 108
PET_SHOP_AT = (234, 86)
# The PET SHOP board in the sprite: ui-button's go state 114x22, its bottom 2 rows over the parapet.
# The building below it starts BOARD_RISE rows down.
BOARD = (3, 0, 114, 22)
BOARD_RISE = 4
# ui-pet-shop's glint: the light band's left edge on the board in each frame, then a clean frame.
GLINT_STEPS = (-6, 16, 38, 60, 82, 104)


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
    cv = sn.Canvas(w, h)
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
    cv = sn.Canvas(W, H)
    r = rand(7)
    # the bar strip the game draws its bar over
    cv.fill(0, 0, W, 38, "plum")
    cv.fill(0, 38, W, 2, "dbrown")
    # the street past the gate: asphalt, a dashed centre line, a manhole and a storm drain
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
    for lx, ly, rad in ((-6, -10, 10), (8, -9, 10), (0, 0, 13), (-13, 3, 10), (13, 4, 10), (0, 10, 10)):
        for dy in range(-rad, rad + 1):
            for dx in range(-rad, rad + 1):
                if dx * dx + dy * dy <= rad * rad:
                    lit = (dx + dy) / rad
                    c = "rust" if lit > 0.55 else "amber" if lit < -0.75 else "orange"
                    cv.fill(71 + lx + dx, 80 + ly + dy, 1, 1, c)
    for x, y in ((58, 70), (66, 66), (74, 68), (56, 80)):
        cv.fill(x, y, 1, 1, "yellow")
    # the street sign at the right edge, under the sound toggle and clear of the walker's speech
    # bubble (x 70 to 290, rows 46 to 112); the game prints the name centred at 327,75 in white,
    # which holds 7.8:1 on forest green
    cv.fill(326, 72, 2, 44, "slate")
    cv.fill(326, 72, 1, 44, "grey")
    cv.fill(300, 72, 54, 11, "teal")
    cv.fill(301, 73, 52, 9, "forest")
    cv.fill(324, 114, 6, 2, "dslate")
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
    # a bush in the corner, a water bowl by the path and a ball on the lawn
    bd.bush(cv, 322, 186, "dgreen")
    cv.fill(222, 189, 10, 4, "slate")
    cv.fill(223, 189, 8, 2, "sky")
    cv.fill(224, 189, 3, 1, "cyan")
    cv.fill(250, 176, 5, 5, "red")
    cv.fill(250, 176, 2, 2, "pink")
    cv.fill(254, 179, 1, 2, "dred")
    for x, y, c in ((120, 50, "orange"), (210, 84, "rust"), (30, 104, "orange"), (140, 112, "rust"),
                    (236, 100, "orange"), (240, 160, "orange"), (270, 150, "rust"), (344, 86, "orange")):
        leaf(cv, x, y, c)
    # the porch: a step nosing, then the deck under the panels
    cv.fill(0, 196, W, 1, "tan")
    cv.fill(0, 197, W, 1, "brown")
    planks(cv, 0, 198, W, H - 198, 11, seed=3)
    return cv


# ---------- ui-pet-shop ----------

BONE = ["..cc.......cc..", ".cccc.....cccc.", "ccccccccccccccc", "ccccccccccccccc", ".cccc.....cccc.",
        "..cc.......cc.."]


def window_puppy():
    """17x21: a tan puppy sitting up in the shop window, front view, floppy brown ears, a white muzzle
    and chest, a pink tongue out; cel shaded in an ink line, as the faces are."""
    g = edged(Grid(17, 21), "ink")
    g.cel(8.5, 16, 5.5, 4.5, "tan", "brown")
    g.cel(8.5, 16.5, 2.5, 3, "white", "lgrey")
    g.cel(8.5, 8.2, 6, 5.3, "tan", "brown", "skin1", power=2.6)
    for x in (2.5, 14.5):
        g.cel(x, 9, 1.8, 3.6, "brown", "dbrown")
    g.cel(8.5, 11, 2.6, 1.9, "white", "lgrey")
    for x in (5, 11):
        g.rect(x, 7, 2, 2, "ink")
        g.p(x, 7, "white")
    g.rect(8, 9, 2, 1, "ink")
    g.rect(8, 11, 2, 2, "pink")
    g.p(4, 10, "pink")
    g.p(13, 10, "pink")
    return g


def pet_shop(pressed=False, glint=None):
    """The shop front, PET_SHOP_W x PET_SHOP_H: the building from BOARD_RISE down, under the board.
    Everything but the step is drawn t rows lower, so pressed sinks the front 2px onto a step 1px
    shallower, as ui-button's face sinks into its lip. glint, if given, is the left edge of the light
    band swept across the board (glint_board)."""
    w, h = PET_SHOP_W, PET_SHOP_H
    cv = clear(w, h)
    building(cv, w, h - BOARD_RISE, pressed)
    shop_board(cv, pressed, glint)
    return cv


def shop_board(cv, pressed, glint):
    """The PET SHOP board at BOARD: ui-button's go state, a green face with a yellow top highlight on a
    forest lip 4px deep, in an ink line with its corners cut, and PET SHOP in the sign letters' shapes at
    2x, filled ink (8.41:1 on green) with no outline or shadow, as the go label. Raised, row 0 is ink,
    row 1 the highlight, the face runs to row 16, the lip fills rows 17 to 20 and ink row 21; the caps
    fill rows 4 to 13. Pressed, the lip and highlight give way to face, as go-pressed, and the board
    rides down with the front: face and letters sink 2px."""
    bx, by, bw, bh = BOARD
    t = 2 if pressed else 0
    face, lip, hi = STATES["go"]
    cv.fill(bx + 1, by + t, bw - 2, bh, "ink")
    cv.fill(bx, by + 1 + t, bw, bh - 2, "ink")
    cv.fill(bx + 1, by + 1 + t, bw - 2, bh - 2, face)
    if not pressed:
        cv.fill(bx + 1, by + 1, bw - 2, 1, hi)
        cv.fill(bx + 1, by + bh - 5, bw - 2, 4, lip)
    letters, _ = fonts.sign("PET SHOP", 2)
    caps = [(x, y) for (x, y), c in letters.items() if c not in ("ink", "dred")]
    x0, y0 = min(x for x, _ in caps), min(y for _, y in caps)
    lw = max(x for x, _ in caps) + 1 - x0
    lx = bx + (bw - lw) // 2
    for x, y in caps:
        cv.fill(lx + x - x0, by + 4 + t + y - y0, 1, 1, "ink")
    if glint is not None:
        glint_board(cv, glint)


def glint_board(cv, left):
    """A light band slanting up to the right across the raised board, 6px wide: yellow edges and a
    white middle on the face, white on the highlight row, green on the lip. The ink line and the
    letters stay as they are."""
    bx, by, bw, bh = BOARD
    lit = {K[c]: c for c in ("green", "forest", "yellow")}
    px = cv.img.load()
    for y in range(by + 1, by + bh - 1):
        for x in range(bx + 1, bx + bw - 1):
            d = (x - bx) - left + (y - by) // 2
            if not 0 <= d < 6:
                continue
            c = lit.get("%02x%02x%02x" % px[x, y][:3])
            if c == "green":
                cv.fill(x, y, 1, 1, "white" if 0 < d < 5 else "yellow")
            elif c == "yellow":
                cv.fill(x, y, 1, 1, "white")
            elif c == "forest":
                cv.fill(x, y, 1, 1, "green")


def building(cv, w, h, pressed):
    """The shop below the board, w x h from BOARD_RISE down: walls, parapet, awning, window, door and
    step."""
    full = cv
    cv = clear(w, h)
    t = 2 if pressed else 0
    # walls: rust brick in an ink line, lit ochre on the left, dred on the right, so the green board
    # stands off them; dbrown mortar every 4 rows, the joints 8px apart and staggered a half brick
    cv.fill(4, 18 + t, w - 8, h - 18 - t, "ink")
    cv.fill(5, 19 + t, w - 10, h - 19 - t, "rust")
    for n, y in enumerate(range(22 + t, h, 4)):
        cv.fill(7, y, w - 14, 1, "dbrown")
        for x in range(7 + (n % 2) * 4, w - 7, 8):
            cv.fill(x, y + 1, 1, 3, "dbrown")
    cv.fill(5, 19 + t, 2, h - 19 - t, "ochre")
    cv.fill(w - 7, 19 + t, 2, h - 19 - t, "dred")
    # the parapet trim
    cv.fill(2, 16 + t, w - 4, 4, "ink")
    cv.fill(3, 17 + t, w - 6, 2, "cream")
    # the awning: red and white stripes 6px wide, shaded along the bottom, over a scalloped ink edge
    top, bot = 24 + t, 36 + t
    cv.fill(2, top - 1, w - 4, bot - top + 2, "ink")
    for x in range(3, w - 3):
        red = ((x - 3) // 6) % 2 == 0
        cv.fill(x, top, 1, bot - top - 3, "red" if red else "white")
        cv.fill(x, bot - 3, 1, 3, "dred" if red else "lgrey")
        if (x - 3) % 6 in (1, 2, 3, 4):
            cv.fill(x, bot, 1, 1, "dred" if red else "lgrey")
            cv.fill(x, bot + 1, 1, 1, "ink")
        else:
            cv.fill(x, bot, 1, 1, "ink")
    # the display window: a cream frame, sky glass with two glints, a blue sill
    wx, wy, ww, wh = 10, 44 + t, 56, 46
    cv.fill(wx - 1, wy - 1, ww + 2, wh + 2, "ink")
    cv.fill(wx, wy, ww, wh, "cream")
    cv.fill(wx + 2, wy + 2, ww - 4, wh - 4, "sky")
    cv.fill(wx + 2, wy + wh - 8, ww - 4, 6, "blue")
    cv.fill(wx + 2, wy + wh - 3, ww - 4, 1, "plum")
    for i in range(10):
        cv.fill(wx + 6 + i, wy + 14 - i, 1, 1, "cyan")
        cv.fill(wx + 10 + i, wy + 18 - i, 1, 1, "white")
    # a food bag and a bone on the sill
    cv.fill(wx + 8, wy + 20, 14, 18, "ink")
    cv.fill(wx + 9, wy + 21, 12, 16, "amber")
    cv.fill(wx + 9, wy + 21, 12, 2, "yellow")
    cv.fill(wx + 19, wy + 23, 2, 14, "orange")
    cv.fill(wx + 11, wy + 26, 7, 6, "red")
    cv.fill(wx + 13, wy + 28, 3, 2, "white")
    # a puppy sitting on the sill behind the bone, waiting to be taken home
    for y, row in enumerate(window_puppy().outlined()):
        for x, c in enumerate(row):
            if c:
                cv.fill(wx + 28 + x, wy + 15 + y, 1, 1, c)
    bone = {(x, y) for y, row in enumerate(BONE) for x, ch in enumerate(row) if ch == "c"}
    for x, y in {(x + dx, y + dy) for x, y in bone for dx, dy in ((0, 1), (1, 0), (0, -1), (-1, 0))} - bone:
        cv.fill(wx + 29 + x, wy + 31 + y, 1, 1, "blue")
    for x, y in bone:
        cv.fill(wx + 29 + x, wy + 31 + y, 1, 1, "white" if y < 2 else "lgrey" if y > 3 else "cream")
    # the door: a cream frame, a navy door with a lit glass pane, a cream paw on it, an amber knob
    dx, dy, dw = 76, 44 + t, 30
    cv.fill(dx - 1, dy - 1, dw + 2, h - dy + 1, "ink")
    cv.fill(dx, dy, dw, h - dy, "cream")
    cv.fill(dx + 2, dy + 2, dw - 4, h - dy - 2, "navy")
    cv.fill(dx + 2, dy + 2, 1, h - dy - 2, "dslate")
    cv.fill(dx + 6, dy + 6, dw - 12, 14, "sky")
    cv.fill(dx + 6, dy + 6, dw - 12, 1, "cyan")
    for j, row in enumerate(PAW):
        for i, c in enumerate(row):
            if c == "#":
                cv.fill(dx + 13 + i, dy + 11 + j, 1, 1, "cream")
    cv.fill(dx + dw - 8, dy + 30, 3, 3, "amber")
    # the step: 4 rows, 3 when pressed
    sy = h - 3 if pressed else h - 4
    cv.fill(2, sy, w - 4, h - sy, "ink")
    cv.fill(3, sy + 1, w - 6, h - sy - 2, "lgrey")
    if not pressed:
        cv.fill(3, h - 2, w - 6, 1, "grey")
    full.img.alpha_composite(cv.img, (0, BOARD_RISE))


def image_rows(img):
    """An RGBA image as sprite frame rows: hex colours, None where clear."""
    px = img.load()
    return [["%02x%02x%02x" % px[x, y][:3] if px[x, y][3] else None for x in range(img.width)]
            for y in range(img.height)]


# ---------- screen-stats ----------

# The sky after dark, top to horizon: night falling over a last mauve glow, on screen-loading.
NIGHT_SKY = ("navy", "purple", "mauve")
# The first backdrop band row screen-stats' window shows, 25 rows over the far side's ground row: the
# houses' lit walls, their doors and the ground row.
STATS_VIEW_TOP = bd.BASE - 25


def night(img):
    """The street after dark: every colour a ramp step darker but the windows, their cyan glass lit
    yellow and the white beside it amber."""
    px = img.load()
    w, h = img.size
    out = img.copy()
    po = out.load()
    cyan, white = sn.rgb("cyan"), sn.rgb("white")
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if c == cyan:
                po[x, y] = sn.rgb("yellow")
            elif c == white and any(0 <= x + dx < w and px[x + dx, y] == cyan for dx in (-1, 1)):
                po[x, y] = sn.rgb("amber")
            else:
                po[x, y] = sn.rgb(dk("%02x%02x%02x" % c))
    return out


def stats():
    cv = sn.Canvas(W, H)
    planks(cv, 0, 0, W, H, 20, vertical=True, seed=5)
    # crown moulding and baseboard
    cv.fill(0, 0, W, 6, "plum")
    cv.fill(0, 6, W, 1, "brown")
    cv.fill(0, 7, W, 1, "ink")
    cv.fill(0, 548, W, 1, "brown")
    cv.fill(0, 549, W, 10, "plum")
    cv.fill(0, 559, W, 1, "ink")
    # a low window onto the street at night, between the photo and the leash hooks, above the tabs: the
    # houses across the street from STATS_VIEW_TOP, their windows lit, down past the far side's ground row
    wx, wy, ww, wh = 140, 16, 100, 28
    view = night(bd.stats_street().img.crop((120, STATS_VIEW_TOP, 120 + ww, STATS_VIEW_TOP + wh)))
    cv.fill(wx - 6, wy - 6, ww + 12, wh + 12, "plum")
    cv.fill(wx - 5, wy - 5, ww + 10, wh + 10, "tan")
    cv.fill(wx - 5, wy - 5, ww + 10, 1, "cream")
    cv.fill(wx - 1, wy - 1, ww + 2, wh + 2, "brown")
    cv.img.paste(view, (wx, wy))
    cv.fill(wx + ww // 2 - 1, wy, 3, wh, "tan")
    cv.fill(wx, wy + wh // 2 - 1, ww, 3, "tan")
    cv.fill(wx + ww // 2 + 1, wy, 1, wh, "brown")
    cv.fill(wx, wy + wh // 2 + 1, ww, 1, "brown")
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
    fx, fy = 75, 14
    cv.fill(fx, fy, 38, 38, "plum")
    cv.fill(fx + 1, fy + 1, 36, 36, "amber")
    cv.fill(fx + 1, fy + 36, 36, 1, "orange")
    cv.fill(fx + 3, fy + 3, 32, 32, "sky")
    cv.fill(fx + 3, fy + 27, 32, 8, "green")
    cv.paste(sn.frame("face-dog-koda", "happy"), fx + 3, fy + 3)
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

END_STREET = 370  # top of the street strip on screen-end


def end():
    cv = sn.Canvas(W, H)
    # The banded sunset, twice: behind the house down to its lawn, with the striped sun low
    # in the west, and behind the panel down to the far rooftops of the street below
    cv.fill(0, 0, W, 520, bd.SUNSET_SKY[-1])
    bd.bands(cv, 0, 96, bd.SUNSET_SKY)
    bd.bands(cv, 112, END_STREET + 80, bd.SUNSET_SKY)
    bd.sun(cv, 300, 44, 22, "yellow")
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
    # The street below, in the sunset's palette: trees, houses with lit windows, yards and the sidewalk.
    # Everything standing is kept within x 8 to 352, so the badges panel never cuts it into slivers.
    strip = clear(W, 150)
    for cx, top in ((28, 44), (178, 40), (330, 46)):
        bd.tree(strip, cx, top, "orange", "rust", r=20)
    # slim houses as on the zone's backdrop, about as tall as they are wide under steep gables, their
    # curtains drawn against the low sun with the lamps lit between them
    homes = ((46, 54, "white", "dred", "dgreen"), (106, 50, "tan", "brown", "dred"),
             (200, 54, "skin1", "navy", "red"), (260, 50, "cream", "purple", "blue"))
    for k, (x, w, wall, roof, door) in enumerate(homes):
        bd.house(strip, x, w, wall, roof, door, top=104 - w, roof_h=w // 2, parts=bd.SLIM, curtains="orange",
                 eave=2, rake=bd.RAKE.get(roof), dormer=k % 2 == 0)
    bd.ground(strip)
    bd.flowers(strip, 50, 96, 110, ("orange", "yellow", "red"))
    bd.flowers(strip, 204, 250, 112, ("orange", "yellow", "red"))
    bd.fence(strip, 104, 8, 42)
    bd.fence(strip, 104, 160, 196)
    bd.fence(strip, 104, 314, 352)
    for x, y in ((20, 120), (100, 116), (176, 122), (260, 118), (330, 122)):
        strip.fill(x, y, 3, 2, "orange")
        strip.fill(x + 1, y - 1, 1, 1, "rust")
    cv.paste(strip.img, 0, END_STREET)
    # Kensington Market's brick road, its top rows under the button
    tile = sn.TILES[next(z for z, v in sn.ZONES.items() if v["art"] == "kensington-market")]
    cv.img.paste(tile, (0, END_STREET + 150))
    cv.img.paste(tile, (280, END_STREET + 150))
    return cv


# ---------- screen-loading, ui-loading-track, ui-loading ----------

SKY_FOOT = 356  # NIGHT_SKY's bands end here, behind the skyline's foot
YARD_FOOT = 414  # the iron fences' and the Pet shop's bottom row: the sidewalk starts under it
CURB = 470  # the sidewalk's last row is CURB - 1; the curb, then the street
LOADING_LOGO_AT = ((W - 2 * LOGO_W) // 2, 80)  # the logo at 2x, 256x60
SHOP_AT = (W - 4 - PET_SHOP_W, YARD_FOOT - PET_SHOP_H)  # ui-pet-shop's building on the corner lot
# ui-pet-shop's display window and door pane in its frame, left lit on screen-loading
SHOP_WINDOW = (9, 47, 67, 96)
SHOP_DOOR_PANE = (82, 54, 100, 68)
# The display window's and door pane's day glass, lamplit at night; the door's cream paw turns clay on it
SHOP_GLOW = {K["sky"]: "gold", K["cyan"]: "yellow", K["blue"]: "ochre"}
TRACK_END = 332  # the track's end and Biscuit's last nose column, at the Pet shop's door pane (318 to 335)
LAMP_X = 227
MOON = (40, 42)
PAIR_W, PAIR_H = 98, 84
PAIR_FEET = 81  # the pair's bottom opaque row (the shoes' and paws' outline) in its frame
WALK_FOOT = 460  # the screen row the pair's feet stand on
PAIR_HEEL, PAIR_NOSE = 10, 97  # Casey's rear heel on the contact frames and Biscuit's nose, opaque columns
TRACK_AT = (16, WALK_FOOT - 4)
TRACK_W, TRACK_H = TRACK_END - TRACK_AT[0], 8
# Where the game draws ui-loading (origin top left) at progress 0, and how far right it walks by 1: Casey's
# heel starts on the first paw print and Biscuit's nose ends at the Pet shop's door. Its feet stand on WALK_FOOT.
PAIR_AT = (TRACK_AT[0] - PAIR_HEEL, WALK_FOOT - PAIR_FEET)
PAIR_TRAVEL = TRACK_AT[0] + TRACK_W - PAIR_NOSE - 1 - PAIR_AT[0]

# The skyline, far back: (left, width, top, wall) for each downtown tower, its foot hidden behind the street.
TOWERS = ((-6, 28, 286, "dslate"), (44, 18, 270, "navy"), (110, 24, 258, "dslate"), (172, 20, 276, "navy"),
          (200, 26, 250, "dslate"), (290, 24, 262, "dslate"), (318, 16, 284, "navy"), (338, 26, 272, "dslate"))
CN_X, CN_FOOT, CN_TIP = 258, 372, 150  # the CN Tower's centre column, its foot and its mast's tip
# The near row, Cabbagetown's bay-and-gables: (left, width, wall, trim, door, bay on the left, lit windows),
# the lit windows by their order in victorian.
HOMES = ((-10, 76, "brick", "stone", "forest", False, (0, 2, 3, 5)),
         (66, 76, "dbrick", "driftwood", "ttc", True, (0, 1, 2, 4, 6)),
         (142, 76, "brick", "stone", "navy", True, (1, 3, 4, 5)))
HOME_BASE = YARD_FOOT - 10  # the houses' ground row, over the front yards


def after_dark(img, steps=2):
    """A transparent strip drawn in daylight, turned to night: every colour steps ramp steps darker, the
    window glass lit yellow and the white mullions beside it amber."""
    px = img.load()
    w, h = img.size
    out = img.copy()
    po = out.load()
    cyan, white = sn.rgb("cyan"), sn.rgb("white")
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if c[3] == 0:
                continue
            if c[:3] == cyan:
                po[x, y] = sn.rgb("yellow") + (255,)
            elif c[:3] == white and any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][:3] == cyan
                                        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                po[x, y] = sn.rgb("amber") + (255,)
            else:
                d = "%02x%02x%02x" % c[:3]
                for _ in range(steps):
                    d = dk(d)
                po[x, y] = sn.rgb(d) + (255,)
    return out


def stars(cv, r, top, bottom, n):
    """n single specks in lgrey and slate between rows top and bottom."""
    for _ in range(n):
        x, y = int(r() * W), top + int(r() * (bottom - top))
        cv.fill(x, y, 1, 1, "lgrey" if r() < 0.7 else "slate")


def tower_block(cv, x, w, top, wall, seed):
    """A downtown tower in silhouette from row top down to the street, a 3-row crown stepped in 3 columns a
    side, and its lit floors: 2x1 gold windows on a 4-column, 5-row grid, about one in five lit."""
    cv.fill(x, top, w, YARD_FOOT - top, wall)
    cv.fill(x + 3, top - 3, w - 6, 3, wall)
    r = rand(seed)
    for wy in range(top + 4, SKY_FOOT, 5):
        for wx in range(x + 3, x + w - 4, 4):
            if r() < 0.22:
                cv.fill(wx, wy, 2, 1, "gold")


def cn_tower(cv, cx, foot, tip):
    """The CN Tower lit for the night: a tapering haze shaft in its floodlight, shaded on the right, the
    main pod at 62% of its height with a ring of gold windows, the SkyPod above it, then the mast, a red
    beacon at its tip."""
    h = foot - tip
    pod = foot - round(h * 0.62)
    sky_pod = foot - round(h * 0.81)
    mast = foot - round(h * 0.84)
    for y in range(pod, foot):
        half = 2 + (y - pod) * 7 // (foot - pod)
        cv.fill(cx - half, y, 2 * half + 1, 1, "haze")
        cv.fill(cx + 1, y, half, 1, "lgrey")
        cv.fill(cx - half, y, 1, 1, "white")
    for y in range(mast, pod):
        cv.fill(cx - 1, y, 3, 1, "haze")
        cv.fill(cx + 1, y, 1, 1, "lgrey")
    # the main pod: a flared skirt, the window ring, the observation deck's cap
    cv.fill(cx - 5, pod + 6, 11, 2, "lgrey")
    cv.fill(cx - 8, pod + 4, 17, 2, "lgrey")
    cv.fill(cx - 10, pod + 2, 21, 2, "haze")
    cv.fill(cx - 11, pod - 2, 23, 4, "dlake")
    for wx in range(cx - 10, cx + 11, 2):
        cv.fill(wx, pod - 1, 1, 2, "gold")
    cv.fill(cx - 10, pod - 4, 21, 2, "haze")
    cv.fill(cx - 7, pod - 6, 15, 2, "lgrey")
    cv.fill(cx - 4, pod - 8, 9, 2, "lgrey")
    # the SkyPod
    cv.fill(cx - 3, sky_pod - 1, 7, 3, "lgrey")
    cv.fill(cx - 2, sky_pod, 5, 1, "gold")
    # the mast, a beacon at its tip and one partway up
    cv.fill(cx, tip, 1, mast - tip, "lgrey")
    cv.fill(cx - 1, tip, 3, 1, "ttc")
    cv.fill(cx, tip - 1, 1, 1, "ttc")
    cv.fill(cx - 1, (tip + mast) // 2, 3, 1, "ttc")


def lit_window(cv, x, y, w, h, trim, lit, arch=False):
    """A sash window in a trim frame on a sill: lit gold glass behind amber curtains drawn back to its
    sides, or dark shale glass. arch rounds its head."""
    cv.fill(x - 1, y - 1, w + 2, h + 2, trim)
    cv.fill(x, y, w, h, "gold" if lit else "shale")
    if lit:
        cv.fill(x, y, 1, h, "amber")
        cv.fill(x + w - 1, y, 1, h, "amber")
    cv.fill(x, y + h // 2, w, 1, trim)
    cv.fill(x - 2, y + h + 1, w + 4, 1, trim)
    if arch:
        cv.fill(x - 1, y - 1, 1, 1, dk(trim))
        cv.fill(x + w, y - 1, 1, 1, dk(trim))
        cv.fill(x, y - 2, w, 1, trim)


def door_column(home):
    """The centre column of a HOMES house's front door, on the half its bay leaves."""
    x, w, *_, bay_left, _ = home
    bw = w // 2 - 2
    return (x + w - 3 - bw if bay_left else x + 3) + bw // 2


def victorian(cv, x, w, wall, trim, door, bay_left, lit):
    """A Cabbagetown bay-and-gable on HOME_BASE, w wide: a steep front gable over the full width, its brick
    face edged with a coal roof and a bargeboard in trim, a king post under the peak and an arched attic
    window; below, a two-storey bay on one half (three windows a storey, the outer two on its shaded
    sides) and the front door with its transom on the other, a window over it, and a stone stoop.
    lit lists which windows glow: 0 the attic, 1 to 3 the bay's lower storey, 4 to 6 its upper one, then
    the window over the door as 7."""
    base = HOME_BASE
    gable_h, wall_h = 40, 86
    top = base - wall_h - gable_h
    cx = x + w // 2
    half = w // 2 + 2
    for i in range(gable_h):
        inset = round(i * half / gable_h)
        cv.fill(cx - inset, top + i, 2 * inset, 1, wall)
        cv.fill(cx - inset - 1, top + i, 1, 1, "coal")
        cv.fill(cx + inset, top + i, 1, 1, "coal")
        if inset > 2:
            cv.fill(cx - inset, top + i, 2, 1, trim)
            cv.fill(cx + inset - 2, top + i, 2, 1, trim)
    cv.fill(x - 3, top + gable_h - 1, w + 6, 2, "coal")
    cv.fill(cx - 1, top - 3, 1, 4, trim)
    cv.fill(cx - 1, top + 2, 1, 7, trim)
    cv.fill(cx - 5, top + 9, 9, 1, trim)
    lit_window(cv, cx - 4, top + 16, 7, 14, trim, 0 in lit, arch=True)
    wy = top + gable_h + 1
    cv.fill(x, wy, w, base - wy, wall)
    cv.fill(x + w - 3, wy, 3, base - wy, dk(wall))
    # the bay
    bw = w // 2 - 2
    bx = x + 3 if bay_left else x + w - 3 - bw
    cv.fill(bx - 1, wy + 6, bw + 2, 2, "coal")
    cv.fill(bx, wy + 8, bw, base - wy - 8, wall)
    cv.fill(bx, wy + 8, 6, base - wy - 8, dk(wall))
    cv.fill(bx + bw - 6, wy + 8, 6, base - wy - 8, dk(wall))
    cv.fill(bx - 1, wy + 44, bw + 2, 2, trim)
    for storey, sy in ((4, wy + 14), (1, wy + 52)):
        lit_window(cv, bx + 2, sy, 3, 22, trim, storey in lit)
        lit_window(cv, bx + 9, sy, bw - 18, 22, trim, storey + 1 in lit)
        lit_window(cv, bx + bw - 5, sy, 3, 22, trim, storey + 2 in lit)
    # the door half
    dc = door_column((x, w, wall, trim, door, bay_left, lit))
    lit_window(cv, dc - 5, wy + 14, 10, 22, trim, 7 in lit)
    cv.fill(dc - 7, base - 34, 14, 34, trim)
    cv.fill(dc - 5, base - 32, 10, 5, "gold")
    cv.fill(dc - 5, base - 26, 10, 26, door)
    cv.fill(dc - 5, base - 26, 1, 26, dk(door))
    cv.fill(dc + 2, base - 13, 1, 2, "gold")
    for k in range(3):
        cv.fill(dc - 7 - k, base + 3 * k, 14 + 2 * k, 3, "stone")
        cv.fill(dc - 7 - k, base + 3 * k + 2, 14 + 2 * k, 1, "dstone")


def iron_fence(cv, x0, x1, foot, gaps=()):
    """A coal wrought-iron fence on row foot - 1, 9 rows tall: a bar every 3 columns, every other one
    topped with a spear, between two rails, left open over gaps ((left, right) column pairs)."""
    for i, x in enumerate(range(x0, x1, 3)):
        if any(a <= x < b for a, b in gaps):
            continue
        cv.fill(x, foot - 9, 1, 9, "coal")
        if i % 2 == 0:
            cv.fill(x, foot - 10, 1, 1, "coal")
    edges = sorted({x0, x1, *[c for g in gaps for c in g]})
    for a, b in zip(edges[::2], edges[1::2]):
        cv.fill(a, foot - 8, b - a, 1, "coal")
        cv.fill(a, foot - 2, b - a, 1, "coal")


def heritage_lamp(cv, x, foot, top):
    """A Toronto heritage street lamp: a coal post from row top down to foot, a fluted base, and an acorn
    lantern lit yellow with a gold rim, a cap and a finial."""
    cv.fill(x - 1, top, 3, foot - top, "coal")
    cv.fill(x - 1, top, 1, foot - top, "ash")
    cv.fill(x - 3, foot - 10, 7, 10, "coal")
    cv.fill(x - 3, foot - 10, 1, 10, "ash")
    cv.fill(x - 4, foot - 1, 9, 2, "coal")
    cv.fill(x - 3, top - 2, 7, 2, "coal")
    cv.fill(x - 4, top - 12, 9, 10, "yellow")
    cv.fill(x - 4, top - 12, 1, 10, "gold")
    cv.fill(x + 4, top - 12, 1, 10, "gold")
    cv.fill(x - 2, top - 10, 2, 4, "cream")
    cv.fill(x - 3, top - 14, 7, 2, "coal")
    cv.fill(x - 1, top - 16, 3, 2, "coal")
    cv.fill(x, top - 18, 1, 2, "coal")


def ttc_stop(cv, x, foot):
    """A TTC streetcar stop: a coal pole on row foot - 1 carrying the red and white stop sign, a white
    streetcar on its red face."""
    cv.fill(x, foot - 58, 2, 58, "coal")
    cv.fill(x - 6, foot - 72, 14, 16, "white")
    cv.fill(x - 5, foot - 71, 12, 14, "ttc")
    cv.fill(x - 3, foot - 68, 8, 5, "white")
    cv.fill(x - 2, foot - 67, 2, 2, "ttc")
    cv.fill(x + 1, foot - 67, 2, 2, "ttc")
    cv.fill(x - 3, foot - 62, 1, 1, "white")
    cv.fill(x + 4, foot - 62, 1, 1, "white")
    cv.fill(x, foot - 70, 2, 2, "white")


def loading():
    cv = sn.Canvas(W, H)
    r = rand(13)
    # the night sky in bands, navy down to a mauve glow over the city, stars and a crescent moon in the navy band
    rows = bd.bands(cv, 0, SKY_FOOT, NIGHT_SKY)
    cv.fill(0, SKY_FOOT, W, YARD_FOOT - SKY_FOOT, "coal")
    stars(cv, r, 0, rows[0][1] - 6, 36)
    for x, y in ((334, 34), (338, 120), (22, 150), (180, 28)):
        cv.fill(x - 1, y, 3, 1, "lgrey")
        cv.fill(x, y - 1, 1, 3, "lgrey")
        cv.fill(x, y, 1, 1, "white")
    for dy in range(-10, 11):
        for dx in range(-10, 11):
            if dx * dx + dy * dy <= 100 and (dx + 5) ** 2 + (dy - 3) ** 2 > 64:
                cv.fill(MOON[0] + dx, MOON[1] + dy, 1, 1, "cream")
    # the skyline far back: downtown's towers in silhouette, their lit floors, and the CN Tower lit
    for k, (x, w, top, wall) in enumerate(TOWERS):
        tower_block(cv, x, w, top, wall, 31 + k)
    cn_tower(cv, CN_X, CN_FOOT, CN_TIP)
    # the near row: Cabbagetown's bay-and-gables behind their iron fences, a board fence across the lane and
    # the lamp in front of it, and ui-pet-shop's building on the corner lot, its board, window and door pane lit
    end = HOMES[-1][0] + HOMES[-1][1]
    lane = (end, SHOP_AT[0] + 3)
    cv.fill(lane[0], YARD_FOOT - 22, lane[1] - lane[0], 22, "bark")
    for x in range(lane[0] + 3, lane[1], 4):
        cv.fill(x, YARD_FOOT - 22, 1, 22, "walnut")
    cv.fill(lane[0], YARD_FOOT - 23, lane[1] - lane[0], 1, "walnut")
    cv.fill(0, HOME_BASE, end, YARD_FOOT - HOME_BASE, "pine")
    for x, w, wall, trim, door, bay_left, lit in HOMES:
        victorian(cv, x, w, wall, trim, door, bay_left, lit)
    iron_fence(cv, 0, end, YARD_FOOT, [(c - 9, c + 9) for c in map(door_column, HOMES)])
    shop = pet_shop().img
    near = clear(W, H)
    near.img.alpha_composite(shop, SHOP_AT)
    lit = after_dark(near.img, 1)
    lit.alpha_composite(shop.crop((0, 0, PET_SHOP_W, BOARD[3])), SHOP_AT)
    for box, paw in ((SHOP_WINDOW, {}), (SHOP_DOOR_PANE, {K["cream"]: "clay"})):
        glow = shop.crop(box)
        gp = glow.load()
        for y in range(glow.height):
            for x in range(glow.width):
                c = {**SHOP_GLOW, **paw}.get("%02x%02x%02x" % gp[x, y][:3])
                if c and gp[x, y][3]:
                    gp[x, y] = sn.rgb(c) + (255,)
        lit.alpha_composite(glow, (SHOP_AT[0] + box[0], SHOP_AT[1] + box[1]))
    cv.img.paste(lit, (0, 0), lit)
    heritage_lamp(cv, LAMP_X, YARD_FOOT + 2, YARD_FOOT - 80)
    # the sidewalk, grey, slabs every 24px, the TTC stop at its back
    cv.fill(0, YARD_FOOT, W, CURB - YARD_FOOT, "grey")
    for x in range(0, W, 24):
        cv.fill(x, YARD_FOOT, 1, CURB - YARD_FOOT, "slate")
    cv.fill(0, YARD_FOOT, W, 2, "slate")
    ttc_stop(cv, 12, YARD_FOOT + 3)
    # the curb, then the street: flat navy, plain from the curb to row 500, then the streetcar tracks, two rails
    # a track, set in the asphalt; the near curb and sidewalk along the bottom
    cv.fill(0, CURB, W, 4, "slate")
    cv.fill(0, CURB, W, 1, "grey")
    cv.fill(0, CURB + 4, W, 2, "ink")
    cv.fill(0, CURB + 6, W, 536 - CURB - 6, "navy")
    for y in (506, 512, 524, 530):
        cv.fill(0, y, W, 1, "slate")
        cv.fill(0, y + 1, W, 1, "ink")
    cv.fill(0, 536, W, 4, "dslate")
    cv.fill(0, 536, W, 1, "slate")
    cv.fill(0, 540, W, 20, "dslate")
    for x in range(12, W, 24):
        cv.fill(x, 540, 1, 20, "navy")
    big = logo().img.resize((2 * LOGO_W, 2 * LOGO_H), Image.NEAREST)
    cv.img.paste(big, LOADING_LOGO_AT, big)
    return cv


def loading_track():
    """The sidewalk being walked: Biscuit's paw prints in dslate (3.39:1 on the night sidewalk's grey),
    left and right paws 8px apart, staggered on two rows, from Casey's heel to the Pet shop's door."""
    cv = clear(TRACK_W, TRACK_H)
    for n, x in enumerate(range(0, TRACK_W - 4, 8)):
        y = 0 if n % 2 else 4
        for j, row in enumerate(PAW):
            for i, c in enumerate(row):
                if c == "#":
                    cv.fill(x + i, y + j, 1, 1, "dslate")
    return cv


SCREENS = {
    "logo": logo,
    "screen-home": home,
    "screen-stats": stats,
    "screen-end": end,
    "screen-loading": loading,
    "ui-loading-track": loading_track,
}


# ui-loading is drawn on a PAIR_DESIGN design grid at PAIR_SCALE, the road people's 1.75, on a minis.Mini that
# keeps 1px lines and single pixels 1px, so Casey stands as tall as her 56x84 road sprite and Biscuit as his
# 56x56 one.
PAIR_DESIGN = (56, 48)
PAIR_SCALE = 1.75
# The pair's stride, one dict per frame: Casey's near and far feet (forward of the hip, in design px) and which
# is lifted, the body's bob, Biscuit's near front and hind paws, his bob and his tail's wag. Contact frames (0, 2)
# plant both feet apart; on the passing frames (1, 3) the swinging foot lifts 1px under the hip as the body
# rises 1px, as the walkers' stride has it, and Biscuit's diagonal pairs swap with his ears lagging.
PAIR_WALK = [
    dict(near=4, far=-4, lift=None, bob=0, front=2, hind=-2, dbob=0, wag=-1, flop=0),
    dict(near=0, far=0, lift="far", bob=-1, front=0, hind=0, dbob=-1, wag=0, flop=1),
    dict(near=-4, far=4, lift=None, bob=0, front=-2, hind=2, dbob=0, wag=1, flop=0),
    dict(near=0, far=0, lift="near", bob=-1, front=0, hind=0, dbob=-1, wag=0, flop=1),
]
PAIR_WALK_MS = 160
# Casey's hand and Biscuit's collar on the design grid, before the bob: the leash's two ends.
HAND = (21, 28)
COLLAR = (44, 28)


def leg(g, hip, foot, lift, trouser, shade, shoe, sole):
    """One of Casey's legs, from the hip (x, row) to its shoe on row 43, the foot lift rows up: 3 wide,
    in 2-row steps so it stays unbroken at any scale, the shoe pointing right."""
    (hx, hy), fx = hip, foot
    end = 42 - lift
    n = max(1, end - hy)
    for k in range(0, n + 1, 1):
        x = hx + (fx - hx) * k / n
        g.rect(round(x), hy + k, 3, 2, trouser)
        g.rect(round(x) + 2, hy + k, 1, 2, shade)
    g.rect(fx, 43 - lift, 5, 2, shoe)
    g.rect(fx, 45 - lift - 1, 5, 1, sole)


def dog_leg(g, hip, paw, upper, sock, sock_shade):
    """One of Biscuit's legs, from the hip or shoulder to its paw on row 45: the coat colour above a white
    sock 3 rows deep."""
    (hx, hy), px = hip, paw
    n = max(1, 43 - hy)
    for k in range(n + 1):
        x = round(hx + (px - hx) * k / n)
        g.rect(x, hy + k, 3, 2, upper if hy + k < 41 else sock)
    g.rect(px, 44, 3, 2, sock)
    g.p(px + 2, 45, sock_shade)


def pair_design(near=0, far=0, lift=None, bob=0, front=0, hind=0, dbob=0, wag=0, flop=0):
    """One frame of ui-loading on the PAIR_DESIGN grid: Casey side on, walking right, and Biscuit trotting
    ahead of her, cel shaded with the road outline and the lit rim, as the road sprites."""
    g = edged(Grid(*PAIR_DESIGN))
    b = bob
    ln, lf = (1 if lift == "near" else 0), (1 if lift == "far" else 0)
    # Casey: the far leg and arm a shade darker, behind the body
    leg(g, (10, 33 + b), 10 + far, lf, "navy", "navy", "lgrey", "grey")
    g.rect(7 - near // 2, 23 + b, 3, 8, "blue")
    g.rect(7 - near // 2, 31 + b, 3, 2, "skin2")
    # the hoodie, its hood at the back of the neck, and a white drawstring at the front
    g.cel(11.5, 27.5 + b, 6, 6.5, "sky", "blue", "cyan", power=4)
    g.rect(6, 33 + b, 11, 1, "blue")
    g.cel(7.5, 21.5 + b, 3, 2.5, "blue", "navy")
    g.rect(15, 22 + b, 1, 4, "white")
    leg(g, (10, 33 + b), 10 + near, ln, "blue", "navy", "white", "lgrey")
    # head: the ponytail and hair behind a flat-skin face in profile, the ear, then the cap, its brim forward
    g.rect(11, 19 + b, 3, 3, "skin2")
    g.cel(4.5, 17 + b, 2, 3.5, "dbrown", "plum")
    g.cel(12, 12.5 + b, 8, 8.5, "dbrown", "plum", "brown")
    g.ell(15.5, 14.5 + b, 5.5, 5.5, "skin1")
    g.p(21, 15 + b, "skin1")
    g.rect(10, 13 + b, 2, 3, "skin1")
    g.p(11, 14 + b, "skin2")
    g.rect(17, 13 + b, 2, 2, "ink")
    g.p(17, 13 + b, "white")
    g.p(15, 16 + b, "pink")
    g.rect(17, 18 + b, 2, 1, "dbrown")
    g.p(19, 17 + b, "dbrown")
    g.cel(12, 8 + b, 8.5, 5, "amber", "orange", "yellow")
    g.rect(14, 10 + b, 9, 2, "orange")
    g.rect(14, 11 + b, 9, 1, "rust")
    g.p(12, 3 + b, "yellow")
    # the near arm reaching forward to hold the leash
    g.rect(10, 22 + b, 4, 5, "sky")
    g.rect(10, 22 + b, 1, 5, "cyan")
    g.rect(12, 25 + b, 7, 3, "sky")
    g.rect(12, 27 + b, 7, 1, "blue")
    g.rect(HAND[0] - 2, HAND[1] - 2 + b, 3, 3, "skin1")
    g.p(HAND[0], HAND[1] + b, "skin2")
    # Biscuit: far legs a shade darker, the tail flagged up with its white tip, then the tan body under the
    # black saddle, white belly and chest, the near legs, and the head with a long rust ear
    d = dbob
    dog_leg(g, (33, 36 + d), 33 - hind, "rust", "lgrey", "grey")
    dog_leg(g, (44, 36 + d), 44 - front, "rust", "lgrey", "grey")
    for k in range(8):
        g.rect(round(29.5 - k * 0.35 + wag * k / 7), 31 - k + d, 2, 2, "navy")
    g.rect(round(29.5 - 7 * 0.35) + wag, 22 + d, 2, 2, "white")
    g.cel(37.5, 34.5 + d, 9, 5, "ochre", "rust", "tan")
    g.cel(36.5, 31.5 + d, 6.5, 2.6, "navy", "ink", "dslate")
    g.cel(39, 38 + d, 6, 1.5, "white", "lgrey")
    g.cel(45, 34.5 + d, 2.5, 3.5, "white", "lgrey")
    dog_leg(g, (31, 36 + d), 31 + hind, "ochre", "white", "lgrey")
    dog_leg(g, (42, 36 + d), 42 + front, "ochre", "white", "lgrey")
    g.cel(48, 26 + d, 5.5, 5, "ochre", "rust", "tan")
    g.cel(52.5, 28.5 + d, 3, 2.2, "white", "lgrey")
    g.rect(50, 21 + d, 2, 4, "white")
    g.rect(54, 26 + d, 2, 2, "ink")
    g.rect(49, 24 + d, 2, 2, "ink")
    g.p(49, 24 + d, "white")
    g.p(52, 30 + d, "dbrown")
    g.cel(45.5, 28.5 + d + flop, 2.2, 4.5, "rust", "dbrown")
    g.rect(COLLAR[0] - 1, COLLAR[1] - 2 + d, 2, 6, "green")
    g.rect(COLLAR[0], COLLAR[1] - 2 + d, 1, 6, "dgreen")
    return road.rim(g, road.LIT)


def pair(step):
    """PAIR_W x PAIR_H, one frame of the walk: pair_design at PAIR_SCALE, outlined, then the leash sagging 1px
    wide from Casey's hand to Biscuit's collar, over the outline: plum, as on Cabbagetown's grey road, since
    the night sidewalk is grey (4.84:1)."""
    q = PAIR_WALK[step]
    g = minis.small(sys.modules[__name__], PAIR_SCALE, pair_design, **q)
    px = g.outlined()
    s = PAIR_SCALE
    a = (math.floor((HAND[0] + 0.5) * s), math.floor((HAND[1] - 1 + q["bob"] + 0.5) * s))
    z = (math.floor((COLLAR[0] - 0.5) * s), math.floor((COLLAR[1] - 1 + q["dbob"] + 0.5) * s))
    sag = 3 + (q["bob"] != 0)
    for x in range(a[0] + 1, z[0]):
        t = (x - a[0]) / (z[0] - a[0])
        y = round(a[1] + (z[1] - a[1]) * t + sag * 4 * t * (1 - t))
        if g.px[y][x] is None:
            px[y][x] = K["plum"]
    return px


def sprites():
    yield "ui-loading", [("walk", [pair(i) for i in range(len(PAIR_WALK))], PAIR_WALK_MS)]
    yield "ui-pet-shop", [(tag, [image_rows(pet_shop(tag == "pressed").img)], 1000)
                          for tag in ("normal", "pressed")] + [
        ("glint", [image_rows(pet_shop(glint=g).img) for g in GLINT_STEPS] + [image_rows(pet_shop().img)], 60)]


def ui(cv, key):
    """Block in the UI that sits on a screen, for the preview only (layout from StartScene, StatsScene on its
    badges tab, EndScene and loadingScreen.ts, which draws no text)."""
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
        sn.text(cv, "$385", 26, 15, "cream", 2)
        for x in (216, 268):
            panel(x, 10, 20, 20, "tan")
        for x in (8, 332):
            panel(x, 46, 20, 20, "tan")
        sn.text_c(cv, "HIGH PARK", 327, 75, "white")
        panel(130, 46, 100, 34, "white")
        cv.paste(pet_shop().img, *PET_SHOP_AT)
        panel(194, 166, 18, 18)
        figure(180, 196, 16, 40, "sky")
        for x, foot in ((180, 150), (154, 182), (206, 184)):
            figure(x, foot, 20, 16, "ochre")
        panel(4, 210, 132, 24, "tan")
        for i in range(4):
            panel(156 + i * 52, 200, 44, 44)
        panel(4, 248, 132, 24, "tan")
        sn.text(cv, "2/3 DOGS", 308, 255, "cream")
        for i in range(9):
            panel(4 + (i % 3) * 120, 276 + (i // 3) * 52, 112, 44)
        panel(4, 428, 132, 24, "tan")
        for i in range(5):
            panel(4 + i * 72, 456, 64, 44)
        sn.text_c(cv, "PACK FEE $40 PER ZONE", 180, 502, "cream")
        cv.fill(4, 518, 352, 40, "orange")
        cv.fill(4, 514, 352, 40, "amber")
    elif key == "screen-stats":
        sn.text(cv, "STATS", 12, 12, "cream")
        panel(332, 10, 20, 20, "tan")
        for i in range(3):
            panel(4 + i * 120, 56, 112, 44, "cream" if i == 2 else "tan")
        sn.text(cv, "BADGES", 12, 112, "cream")
        sn.text(cv, "7/15", 336, 112, "cream")
        for i in range(15):
            x, y = 8 + (i // 8) * 176, 132 + (i % 8) * 52
            panel(x, y + 2, 32, 32, "amber")
            sn.text(cv, "BADGE NAME", x + 36, y + 4, "amber", 2)
            sn.text(cv, "THE GOAL", x + 36, y + 20, "lgrey", 2)
            sn.text(cv, "SECOND LINE", x + 36, y + 36, "lgrey", 2)
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
        frame = to_image(pair(0))
        cv.img.paste(frame, (PAIR_AT[0] + round(PAIR_TRAVEL * 0.4), PAIR_AT[1]), frame)


def preview(out, scale=2):
    keys = [k for k in SCREENS if k.startswith("screen-")]
    shots = [(k, False) for k in keys] + [(k, True) for k in keys]
    gap = 8
    top = LOGO_H * 3 + gap
    sheet = Image.new("RGB", ((W + gap) * len(shots) * scale, (top + H) * scale), sn.rgb("ink"))
    x = 0
    for ground in ("green", "dbrown", "amber", "navy"):
        bg = Image.new("RGBA", (LOGO_W, LOGO_H), sn.rgb(ground) + (255,))
        bg.alpha_composite(logo().img)
        sheet.paste(bg.resize((LOGO_W * 3 * scale, LOGO_H * 3 * scale), Image.NEAREST), (x * scale, 0))
        x += LOGO_W * 3 + gap
    # the ui-loading frames, on the night sidewalk
    for i in range(4):
        bg = Image.new("RGBA", (PAIR_W, PAIR_H), sn.rgb("grey") + (255,))
        bg.alpha_composite(to_image(pair(i)))
        sheet.paste(bg.resize((PAIR_W * scale, PAIR_H * scale), Image.NEAREST), (x * scale, 0))
        x += PAIR_W + gap
    for i, (key, blocked) in enumerate(shots):
        cv = SCREENS[key]()
        if blocked:
            ui(cv, key)
        sheet.paste(cv.img.convert("RGB").resize((W * scale, H * scale), Image.NEAREST),
                    (i * (W + gap) * scale, top * scale))
    sheet.save(out)


def shop_preview(out, scale=4):
    """ui-pet-shop's tags on the yard at 1x and scale, then screen-home with the building in, at 1x and
    scale."""
    tags = [pet_shop(p).img for p in (False, True)]
    home_cv = home()
    home_cv.img.paste(logo().img, LOGO_AT, logo().img)
    home_cv.img.paste(tags[0], PET_SHOP_AT, tags[0])
    lot = home_cv.img.crop((PET_SHOP_AT[0] - 4, PET_SHOP_AT[1] - 4, PET_SHOP_AT[0] + PET_SHOP_W + 4,
                            PET_SHOP_AT[1] + PET_SHOP_H + 4))
    tiles = []
    for t in tags:
        bg = home().img.crop((PET_SHOP_AT[0], PET_SHOP_AT[1], PET_SHOP_AT[0] + PET_SHOP_W, PET_SHOP_AT[1] + PET_SHOP_H))
        bg.paste(t, (0, 0), t)
        tiles.append(bg)
    gap = 8
    top = PET_SHOP_H * (scale + 1) + gap
    sheet = Image.new("RGB", (max(W * (scale + 1) + gap, (PET_SHOP_W * (scale + 1) + gap) * 2), top + H * scale),
                      sn.rgb("ink"))
    x = 0
    for t in tiles:
        sheet.paste(t, (x, 0))
        sheet.paste(t.resize((PET_SHOP_W * scale, PET_SHOP_H * scale), Image.NEAREST), (x + PET_SHOP_W + gap // 2, 0))
        x += PET_SHOP_W * (scale + 1) + gap
    sheet.paste(home_cv.img.convert("RGB"), (0, top))
    sheet.paste(home_cv.img.convert("RGB").resize((W * scale, H * scale), Image.NEAREST), (W + gap, top))
    sheet.save(out)
    lot.resize((lot.width * scale, lot.height * scale), Image.NEAREST).save(out.replace(".png", "-lot.png"))


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
    elif len(sys.argv) == 3 and sys.argv[1] == "shop-preview":
        shop_preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
