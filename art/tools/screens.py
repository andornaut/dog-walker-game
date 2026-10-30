#!/usr/bin/env python3
"""Draw the logo and the full-screen backgrounds outside the run.

logo: 145x41 on a transparent ground, "Archie's Dog Walks" stacked beside
Archie's head. On the left, portrait-dog-archie's head (its rows 10 to 41, in
its ink line) over a short red bandana, lit red on the left and dred on the
right. On the right, ARCHIE'S in the comic letters (fx.LETTERS, 7 rows, 2px
stems, plus an apostrophe) over DOG WALKS in the sign letters at 2x
(fonts.sign), both cream in a 1px ink outline on a solid dred shadow, so the
bandana is the one red accent. The game draws it on the end screen; the home
page and screen-loading show it at 2x and the og-image at 1x.

screen-<name>: 360x560 backgrounds in the house palette, one per screen. Where panels
and text sit, they are low-contrast dark wood, so the cream and tan UI text
reads on them.
- screen-home: an autumn morning on a Cabbagetown street. The bar strip, then the
  gate scene (y 40 to 196). Across the street (FAR_BASE 74): a foam sky over a
  haze band, the CN Tower far back over the laneway at the right (FAR_CN), a
  row of small bay-and-gables in brick, dbrick, cream and clay with ochre and
  brown trees between them, their bare front yards strewn with leaves behind
  an iron fence. Then the far sidewalk, the street (rows 82 to 91), the curb
  and our sidewalk with a turned maple (amber, ochre and rust) in its planter
  and its leaves fallen around it, then the iron fence on a stone curb with beds
  of mums inside it, open at the gate between two brick piers (152 and 202). The
  front yard is pale driftwood flagstones, the front path (x 164 to 195) red
  brick in basket weave, with fallen leaves, the yard sign, a stone urn of
  mums in the corner and the flat dark-brown backing from y 199 under the walker, dogs and
  Pocket sections and Start walk. The street sign's board (300,72 54x11, a
  52x9 navy face) sits at the right edge, clear of the walker's speech bubble;
  the game prints homeText.gateSign on it in font-body, white, centred at
  327,75. The yard sign (SIGN_AT 6,138, a 128x38 board on two posts, left of
  the gate path, where the pack never stands) carries ARCHIE'S over DOG WALKS
  in the sign letters at 2x, yellow, the letters centred on its face. The
  yard's right lot is left for ui-pet-shop. The scene holds no strong green, so
  the Pet shop's board and Start walk stand out.
- screen-end: a Cabbagetown street at dusk. Between the logo (END_LOGO_AT
  107,2) and the summary panel (24,112 to 336,412), the front of the brick
  cottage the pack comes home to: the logo stands on its slate roof's ridge
  (END_RIDGE, row 43), a low centre gable trimmed in white rises from the
  ridge with a small lit arched window, two lit sash windows flank
  the front door (171,73 18x23) under its lit transom, which opens onto a step
  (164,96 32x4), and a flagstone path (168,100 24x12) runs down behind the
  panel's top edge. Bay-and-gables stand either side, their lamps lit behind
  orange curtains, and the CN Tower rises lit over the right ones (END_CN). The
  lawn from y 96 gives the waving owners room either side, feet on y 110.
  Cabbagetown's dusk bands (DUSK_SKY) fill the sky twice: behind the house down
  to its lawn, and behind the panel down to the far rooftops and towers in
  mauve (y 450). Then the street's bay-and-gables and canopy trees (from y
  370), iron fences, the yards, the sidewalk (rows 491 to 505) with two
  heritage lamps, the curb, and from END_ROAD (511) Kensington Market's brick
  road under the button (4,514 352x44), which bobs 1px up, so at least 2 rows of
  road show above and below it. The houses,
  trees and fences stay within x 8 to 352, so beside the badges panel (8,416
  344x92) the margins show only sky, lawn and sidewalk.
- screen-loading: a Toronto street at night, shown while the game loads, seen
  from the road. NIGHT_SKY's bands fill the sky down to SKY_FOOT (356), stars,
  a crescent moon at the top left and the logo drawn in at 2x (290x82 at
  35,74) in the navy band. Far back, downtown's towers in navy and dslate
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

ui-loading-track: a 316x8 image, the sidewalk being walked: Lady's paw
prints in dslate, staggered on two rows from Casey's heel to the Pet shop's door.
The game draws it at TRACK_AT (16,456).
ui-loading: a 98x84 sprite, tag walk (4 frames, 160ms): Casey and Lady side
on, walking right on a plum leash, at 1.75x, larger than on the road (Casey 84
rows tall, Lady 56), cel shaded with the road outline,
Casey's face flat skin. Frames 0 and 2 plant the feet apart, 1 and 3 pass
with the body 1px higher, a foot lifted, and Lady's diagonal pairs swap.
The game draws it at PAIR_AT (6,379) plus round(228 * progress) to the right,
its feet on row 460, so Casey's heel starts on the first paw print and
Lady's nose ends at the Pet shop's door pane.

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
import fx  # noqa: E402
import scene as sn  # noqa: E402
import minis  # noqa: E402
import road  # noqa: E402
from pixel import Grid, K, build as build_sprites, dk, edged, to_image  # noqa: E402
from ui import STATES  # noqa: E402

W, H = 360, 560
LOGO_W, LOGO_H = 145, 41
SIGN_W, SIGN_H = 128, 38
SIGN_AT = (6, 138)
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
    """A fallen leaf lying askew, 3x3 on a diagonal with its stem a ramp step darker at the narrow end,
    tilted the other way on an odd column, so the leaves never read as crosses or sparkles."""
    pts = ((2, 0), (1, 1), (2, 1), (0, 2), (1, 2))
    flip = x % 2
    for dx, dy in pts:
        cv.fill(x + (2 - dx if flip else dx), y + dy, 1, 1, col)
    cv.fill(x + (2 if flip else 0), y + 3, 1, 1, dk(col))


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

# The comic letters' apostrophe, 2px wide like their stems, for ARCHIE'S.
APOSTROPHE = ["##", "##", "#."]
# The bandana's rows under the portrait's collar (row 41), and the column its point is centred on.
BANDANA_ROWS, BANDANA_MID = 8, 30.5


def board(cv, x, y, w, h):
    """The yard sign's board, w x h: a plum rim with rounded corners, a light trim (cream top, tan
    sides) so it keeps its edge on the dark yard, a dark-stained dbrown face, and a brown lip."""
    cv.fill(x + 1, y, w - 2, h, "plum")
    cv.fill(x, y + 1, w, h - 2, "plum")
    cv.fill(x + 1, y + 1, w - 2, h - 5, "tan")
    cv.fill(x + 1, y + 1, w - 2, 1, "cream")
    cv.fill(x + 2, y + 2, w - 4, h - 6, "dbrown")
    cv.fill(x + 1, y + h - 4, w - 2, 2, "brown")


def lettering(px, cv, x, y):
    """Draw a {(x, y): colour} lettering at x, y by its top-left inked pixel."""
    x0, y0 = min(p[0] for p in px), min(p[1] for p in px)
    for (px_, py), col in px.items():
        cv.fill(x + px_ - x0, y + py - y0, 1, 1, col)


def extent(px):
    """The width and height of a {(x, y): colour} lettering."""
    xs, ys = [p[0] for p in px], [p[1] for p in px]
    return max(xs) + 1 - min(xs), max(ys) + 1 - min(ys)


def comic(text, fill):
    """text in the comic letters (fx.LETTERS and APOSTROPHE), built as fx.word builds them: letters 1px
    apart, a 1px ink ring that fills the gaps, a solid dred shadow 2px down and right."""
    letters, x = set(), 1
    for ch in text:
        rows = APOSTROPHE if ch == "'" else fx.LETTERS[ch]
        letters |= {(x + i, 1 + j) for j, row in enumerate(rows) for i, c in enumerate(row) if c == "#"}
        x += len(rows[0]) + 1
    ring = {(a + dx, b + dy) for a, b in letters for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
    shadow = {(a + d, b + d) for a, b in ring for d in (1, 2)} - ring
    out = {p: "dred" for p in shadow}
    out.update({p: "ink" for p in ring - letters})
    out.update({p: fill for p in letters})
    return out


# A pixel of Archie's face in portrait-dog-archie, where bust() gathers his head from.
HEAD_SEED = (29, 25)


def bust():
    """Archie's head from portrait-dog-archie (its rows 10 to 41, the collar's ink line last, only what joins
    his face, so the tip of his tail is left out) over a short bandana in a closed ink line: {(x, y): RGBA}
    from the portrait's top-left."""
    img = sn.image("portrait-dog-archie")
    rows = {(x, y): img.getpixel((x, y)) for y in range(10, 42) for x in range(img.width)
            if img.getpixel((x, y))[3]}
    px, todo = {}, [HEAD_SEED]
    while todo:
        q = todo.pop()
        if q in rows and q not in px:
            px[q] = rows[q]
            todo += [(q[0] + dx, q[1] + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
    band = {}
    for k in range(BANDANA_ROWS):
        half = 12.5 - 1.7 * k
        for x in range(round(BANDANA_MID - half), round(BANDANA_MID + half) + 1):
            band[(x, 42 + k)] = sn.rgb("red" if x < 33 - k // 2 else "dred") + (255,)
    px.update(band)
    for x, y in list(band):
        for q in ((x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            px.setdefault(q, sn.rgb("ink") + (255,))
    x0, y0 = min(p[0] for p in px), min(p[1] for p in px)
    return {(x - x0, y - y0): c for (x, y), c in px.items()}


def logo():
    cv = clear(LOGO_W, LOGO_H)
    head = bust()
    for p, c in head.items():
        cv.img.putpixel(p, c)
    hw, hh = extent(head)
    small, big = comic("ARCHIE'S", "cream"), fonts.sign("DOG WALKS", 2, "cream")[0]
    sw, sh = extent(small)
    bw, bh = extent(big)
    y = (hh - sh - bh) // 2 + 1
    lettering(small, cv, hw + 2, y)
    lettering(big, cv, hw + 1, y + sh)
    return cv


# ---------- screen-home ----------

FAR_BASE = 74  # the far side's ground row on screen-home: its houses stand on it, their front yards under it
# The far side's bay-and-gables: (left, width, wall, trim, door, bay on the left).
FAR_HOMES = ((-8, 30, "brick", "white", "dbrick", True), (24, 30, "cream", "stone", "ttc", False),
             (56, 30, "dbrick", "driftwood", "navy", True), (88, 30, "brick", "white", "ttc", False),
             (120, 30, "clay", "stone", "dbrick", True), (152, 30, "brick", "driftwood", "navy", False),
             (184, 30, "dbrick", "white", "dbrick", True), (216, 30, "brick", "stone", "ttc", False),
             (248, 30, "cream", "white", "navy", True), (280, 30, "brick", "stone", "dbrick", False))
FAR_CN = (340, 89, 36)  # the CN Tower's centre column, foot and mast tip on screen-home, over the laneway


# The far houses' window glass: a muted lake blue, so the row across the street stays behind the porch.
FAR_GLASS = "shallow"


def far_gable(cv, x, w, wall, trim, door, bay_left, base=FAR_BASE):
    """A small Cabbagetown bay-and-gable across the street, w wide on row base, 34 rows tall: a steep front
    gable edged in a coal roof and a trim bargeboard over an arched attic window, a two-storey bay on one
    half (three windows a storey, FAR_GLASS in daylight) and the door with its transom on the other,
    on a stone stoop."""
    top, gable_h = base - 34, 14
    cx, half = x + w // 2, w // 2 + 2
    for i in range(gable_h):
        inset = round(i * half / gable_h)
        cv.fill(cx - inset, top + i, 2 * inset, 1, wall)
        cv.fill(cx - inset - 1, top + i, 1, 1, "coal")
        cv.fill(cx + inset, top + i, 1, 1, "coal")
        if inset > 2:
            cv.fill(cx - inset, top + i, 1, 1, trim)
            cv.fill(cx + inset - 1, top + i, 1, 1, trim)
    cv.fill(x - 2, top + gable_h - 1, w + 4, 1, "coal")
    cv.fill(cx - 2, top + 6, 3, 5, trim)
    cv.fill(cx - 1, top + 7, 1, 4, FAR_GLASS)
    wy = top + gable_h
    cv.fill(x, wy, w, base - wy, wall)
    cv.fill(x + w - 2, wy, 2, base - wy, dk(wall))
    bw = w // 2
    bx = x + 1 if bay_left else x + w - 1 - bw
    cv.fill(bx, wy + 1, bw, base - wy - 1, dk(wall))
    cv.fill(bx + 2, wy + 1, bw - 4, base - wy - 1, wall)
    cv.fill(bx - 1, wy, bw + 2, 1, trim)
    cv.fill(bx - 1, wy + 10, bw + 2, 1, trim)
    for sy in (wy + 3, wy + 12):
        for wx in (bx + 1, bx + bw // 2 - 1, bx + bw - 3):
            cv.fill(wx, sy, 2, 5, FAR_GLASS)
            cv.fill(wx, sy, 2, 1, trim)
    dc = x + w - 1 - bw // 2 - 1 if bay_left else x + bw // 2
    cv.fill(dc - 2, wy + 3, 4, 5, FAR_GLASS)
    cv.fill(dc - 2, wy + 3, 4, 1, trim)
    cv.fill(dc - 3, base - 10, 6, 10, trim)
    cv.fill(dc - 2, base - 9, 4, 2, FAR_GLASS)
    cv.fill(dc - 2, base - 7, 4, 7, door)
    cv.fill(dc - 3, base, 6, 2, "stone")
    cv.fill(dc - 4, base + 2, 8, 1, "dstone")


def noise(x, y, seed):
    """A fixed pseudo-random value in [0, 1) per cell and seed, from backdrops.noise."""
    return bd.noise(x * 7 + seed * 131, y * 13 + seed * 71)


def crown(cv, cx, cy, rad, lit, face, shade, bright=-0.7, dim=0.6):
    """A round crown of leaves centred on cx,cy, lit from the top left: lit where (dx + dy) / rad is under
    bright, shade where it is over dim, face between."""
    for dy in range(-rad, rad + 1):
        for dx in range(-rad, rad + 1):
            if dx * dx + dy * dy <= rad * rad:
                t = (dx + dy) / rad
                cv.fill(cx + dx, cy + dy, 1, 1, shade if t > dim else lit if t < bright else face)


def crowns(cv, lobes, lit, face, shade):
    """A crown of round lobes, (cx, cy, rad) back to front, lit as one mass from the top left: each lobe
    takes a crescent of shade along its lower right rim and of light along its upper left, the shade only
    where the lobe lies off the crown's lit side and the light only off its shaded side, so the lobes read as
    clumps of one tree rather than separate balls."""
    mx = sum(x for x, _, _ in lobes) / len(lobes)
    my = sum(y for _, y, _ in lobes) / len(lobes)
    reach = max(math.hypot(x - mx, y - my) + r for x, y, r in lobes)
    px = {}
    for cx, cy, rad in lobes:
        dark, light = rad * 0.4, rad * 0.35
        for dy in range(-rad, rad + 1):
            for dx in range(-rad, rad + 1):
                if dx * dx + dy * dy <= rad * rad:
                    g = (cx + dx - mx + cy + dy - my) / reach
                    if (dx + dark) ** 2 + (dy + dark) ** 2 > rad * rad and g > -0.35:
                        c = shade
                    elif (dx - light) ** 2 + (dy - light) ** 2 > rad * rad and g < 0.35:
                        c = lit
                    else:
                        c = face
                    px[(cx + dx, cy + dy)] = c
    for (x, y), c in px.items():
        cv.fill(x, y, 1, 1, c)


def far_tree(cv, cx, top, rad):
    """An autumn street tree across the street: a 2px bark trunk on FAR_BASE under an ochre, brown and bark
    crown centred on row top."""
    cv.fill(cx - 1, top + rad, 2, FAR_BASE - top - rad, "bark")
    crown(cv, cx, top, rad, "ochre", "brown", "bark")


def flagstones(cv, x0, y0, w, courses, face, joint, alt, seed):
    """Irregular flagstones from x0, w wide, in courses of the given heights from row y0 down: each course
    split into stones 10 to 21 wide, a 1px joint under and between them, about a third in alt."""
    top = y0
    for k, h in enumerate(courses):
        edges, x = [], x0 - int(noise(k, 1, seed) * 12)
        while x < x0 + w:
            edges.append(x)
            x += 10 + int(noise(k, x, seed) * 12)
        for y in range(top, top + h):
            for px in range(x0, x0 + w):
                start = max(e for e in edges if e <= px)
                c = joint if y == top + h - 1 or px in edges else alt if noise(start, k, seed) < 0.3 else face
                cv.fill(px, y, 1, 1, c)
        top += h


def basket_weave(cv, x0, y0, w, h, face, joint, alt, seed=2):
    """Basket-weave brick: 8x8 tiles on the screen's grid, each two bricks laid across or along in turn,
    1px joints, about a quarter of the bricks in alt."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            lx, ly, tx, ty = x % 8, y % 8, x // 8, y // 8
            across = (tx + ty) % 2 == 0
            if (ly in (3, 7) or lx == 7) if across else (lx in (3, 7) or ly == 7):
                c = joint
            else:
                half = ly // 4 if across else lx // 4
                c = alt if noise(tx * 2 + half, ty, seed) < 0.25 else face
            cv.fill(x, y, 1, 1, c)


def urn(cv, x, foot):
    """A stone urn planter centred on column x, its plinth's bottom row on foot - 1, holding amber, red and
    cream mums."""
    cv.fill(x - 4, foot - 2, 9, 2, "dstone")
    cv.fill(x - 2, foot - 5, 5, 3, "stone")
    cv.fill(x - 5, foot - 11, 11, 6, "stone")
    cv.fill(x + 3, foot - 11, 3, 6, "dstone")
    cv.fill(x - 6, foot - 12, 13, 1, "driftwood")
    for k, (dx, dy) in enumerate(((-5, -14), (-2, -15), (1, -15), (4, -14), (-3, -13), (2, -13))):
        cv.fill(x + dx, foot + dy, 2, 2, ("amber", "red", "cream")[k % 3])


def home():
    cv = sn.Canvas(W, H)
    # the bar strip the game draws its bar over
    cv.fill(0, 0, W, 38, "plum")
    cv.fill(0, 38, W, 2, "dbrown")
    # across the street: an autumn sky, the CN Tower far back over the laneway at the right, a row of
    # Cabbagetown bay-and-gables with turned trees between them, their bare front yards strewn with
    # leaves behind an iron fence
    cv.fill(0, 40, W, FAR_BASE - 40, "foam")
    cv.fill(0, 57, W, FAR_BASE - 57, "haze")
    for i in range(0, W, 5):
        cv.fill(i, 57 - (i // 5) % 2, 5, 1, "haze")
    cn_tower(cv, *FAR_CN, lit=False)
    for x, w, *_ in FAR_HOMES:
        far_tree(cv, x + w + 1, FAR_BASE - 20, 8)
    far_tree(cv, 322, FAR_BASE - 8, 7)
    for x, w, wall, trim, door, bay_left in FAR_HOMES:
        far_gable(cv, x, w, wall, trim, door, bay_left)
    cv.fill(0, FAR_BASE, W, 3, "bark")
    for i in range(0, W, 7):
        cv.fill(i + (i * 3) % 5, FAR_BASE + 1, 1, 1, "ochre")
    iron_fence(cv, 0, W, FAR_BASE + 3, [(x + (w - w // 2 // 2 - 6 if bay else w // 2 // 2 - 4),
                                        x + (w - w // 2 // 2 + 2 if bay else w // 2 // 2 + 4))
                                       for x, w, _, _, _, bay in FAR_HOMES])
    # the far sidewalk and curb, then the street: asphalt and a storm drain
    cv.fill(0, FAR_BASE + 3, W, 4, "lgrey")
    for x in range(10, W, 24):
        cv.fill(x, FAR_BASE + 3, 1, 4, "grey")
    cv.fill(0, FAR_BASE + 7, W, 1, "grey")
    cv.fill(0, FAR_BASE + 8, W, 92 - FAR_BASE - 8, "dslate")
    cv.fill(52, 88, 18, 4, "navy")
    for x in range(54, 70, 3):
        cv.fill(x, 89, 1, 3, "ink")
    # the curb and the sidewalk
    cv.fill(0, 92, W, 4, "grey")
    cv.fill(0, 92, W, 1, "lgrey")
    cv.fill(0, 96, W, 30, "lgrey")
    for x in range(0, W, 24):
        cv.fill(x, 96, 1, 30, "grey")
    # a maple in a sidewalk planter, turned: its shadow, the trunk, then a lumpy crown, lit amber from the
    # top left and shaded rust, and its leaves fallen on the sidewalk
    for dy in range(-6, 7):
        for dx in range(-24, 25):
            if (dx / 24) ** 2 + (dy / 6.5) ** 2 <= 1:
                x, y = 78 + dx, 100 + dy
                cv.fill(x, y, 1, 1, dk("%02x%02x%02x" % cv.img.getpixel((x, y))))
    cv.fill(60, 108, 22, 14, "dbrown")
    cv.fill(61, 109, 20, 12, "brown")
    cv.fill(62, 110, 18, 2, "dbrown")
    cv.fill(69, 92, 4, 20, "bark")
    cv.fill(69, 92, 1, 20, "clay")
    crowns(cv, [(71 + lx, 80 + ly, rad) for lx, ly, rad in ((-6, -10, 10), (8, -9, 10), (0, 0, 13), (-13, 3, 10),
                                                             (13, 4, 10), (0, 10, 10))], "amber", "ochre", "rust")
    for x, y in ((92, 104), (110, 118), (128, 100), (34, 116), (206, 112), (140, 122)):
        leaf(cv, x, y, "ochre")
    # the street sign at the right edge, under the sound toggle and clear of the walker's speech
    # bubble (x 70 to 290, rows 46 to 112); the game prints the name centred at 327,75 in white,
    # which holds 13.9:1 on navy
    cv.fill(326, 72, 2, 44, "slate")
    cv.fill(326, 72, 1, 44, "grey")
    cv.fill(300, 72, 54, 11, "dslate")
    cv.fill(301, 73, 52, 9, "navy")
    cv.fill(324, 114, 6, 2, "dslate")
    # the front yard: pale driftwood flagstones, some in stone
    flagstones(cv, 0, 126, W, (7, 8, 9, 8, 9, 9, 10, 10), "driftwood", "dstone", "stone", seed=11)
    # beds of mums along the inside of the fence
    for x0, x1 in ((0, 152), (208, W)):
        cv.fill(x0, 139, x1 - x0, 5, "bark")
        cv.fill(x0, 139, x1 - x0, 1, "walnut")
        for i, x in enumerate(range(x0 + 2, x1 - 2, 4)):
            cv.fill(x, 140 + i % 2, 2, 2, ("amber", "red", "cream", "rust")[i % 4])
    # the front path: red brick in basket weave from the porch to the gate
    basket_weave(cv, 164, 126, 32, 70, "brick", "dbrick", "clay")
    cv.fill(163, 126, 1, 70, "dstone")
    cv.fill(196, 126, 1, 70, "dstone")
    # the iron fence on a stone curb, open at the gate between two brick piers with stone caps
    cv.fill(0, 135, 156, 3, "stone")
    cv.fill(204, 135, W - 204, 3, "stone")
    cv.fill(0, 137, 156, 1, "dstone")
    cv.fill(204, 137, W - 204, 1, "dstone")
    iron_fence(cv, 1, W, 136, [(155, 205)])
    for px in (152, 202):
        cv.fill(px, 118, 6, 22, "brick")
        cv.fill(px + 4, 118, 2, 22, "dbrick")
        for y in range(121, 138, 4):
            cv.fill(px, y, 6, 1, "dbrick")
        cv.fill(px - 1, 116, 8, 2, "stone")
        cv.fill(px - 1, 116, 8, 1, "lgrey")
        cv.fill(px, 140, 6, 1, "dstone")
    # the yard sign on two posts: ARCHIE'S over DOG WALKS in the sign letters at 2x, yellow
    for px in (16, 120):
        cv.fill(px, 172, 3, 22, "dbrown")
        cv.fill(px - 1, 194, 5, 1, "dstone")
    board(cv, *SIGN_AT, SIGN_W, SIGN_H)
    top, bottom = (fonts.sign(t, 2, "yellow")[0] for t in ("ARCHIE'S", "DOG WALKS"))
    # the inked letters centred down the dark face, 4 rows above and below, their shadow in the bottom margin
    y = SIGN_AT[1] + 6
    for line in (top, bottom):
        w, h = extent(line)
        lettering(line, cv, SIGN_AT[0] + (SIGN_W - w) // 2 + 1, y)
        y += h - 2
    # an urn of mums in the corner, fallen leaves, a water bowl by the path and a ball on the flagstones
    urn(cv, 324, 194)
    for x, y, col in ((40, 186, "ochre"), (140, 178, "rust"), (212, 172, "brown"), (96, 186, "ochre"),
                      (230, 150, "rust"), (300, 170, "ochre")):
        leaf(cv, x, y, col)
    cv.fill(222, 189, 10, 4, "slate")
    cv.fill(223, 189, 8, 2, "sky")
    cv.fill(224, 189, 3, 1, "cyan")
    cv.fill(251, 176, 3, 5, "red")
    cv.fill(250, 177, 5, 3, "red")
    cv.fill(251, 177, 1, 1, "pink")
    cv.fill(253, 179, 1, 1, "dred")
    cv.fill(254, 178, 1, 1, "dred")
    # Two quiet ground rows below the feet, then a continuous divider and flat panel backing.
    cv.fill(0, 196, W, 2, "brown")
    cv.fill(0, 198, W, H - 198, "dbrown")
    cv.fill(0, 198, W, 1, "plum")
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


# The sky after dark, top to horizon: night falling over a last mauve glow, on screen-loading.
NIGHT_SKY = ("navy", "purple", "mauve")


# ---------- screen-end ----------

END_STREET = 370  # top of the street strip on screen-end
# The street strip's front yards, the lawn from its row 104; the sidewalk, curb and gutter's 20 rows follow, so
# the road starts on screen row END_ROAD, 3 rows over the button's top (514) and 2 over its 1px bob
END_YARD = 17
END_WALK = 104 + END_YARD  # the strip's first sidewalk row
END_ROAD = END_STREET + END_WALK + 20
# Cabbagetown's dusk, top to horizon, as its backdrop: lilac over pink and peach to a gold glow.
DUSK_SKY = ("lilac", "pink", "peach", "gold")
END_CN = (306, 96, 4)  # the CN Tower's centre column, foot and mast tip on screen-end
END_RIDGE = 43  # the house's roof ridge on screen-end, under the logo's foot
END_LOGO_AT = ((W - LOGO_W) // 2, END_RIDGE - LOGO_H)  # where EndScene draws the logo, 107,2


def end():
    cv = sn.Canvas(W, H)
    # Cabbagetown's dusk, twice: behind the house down to its lawn, and behind the panel down to the far
    # rooftops of the street below; the CN Tower lit over the roofs at the right
    cv.fill(0, 0, W, 520, DUSK_SKY[-1])
    bd.bands(cv, 0, 96, DUSK_SKY)
    bd.bands(cv, 112, END_STREET + 80, DUSK_SKY)
    for x, y in ((40, 6), (92, 14), (262, 4), (348, 20), (20, 30)):
        cv.fill(x, y, 1, 1, "white")
    cn_tower(cv, *END_CN)
    # two gulls heading home
    for bx, by in ((84, 50), (100, 42)):
        cv.fill(bx, by, 2, 1, "plum")
        cv.fill(bx + 2, by + 1, 1, 1, "plum")
        cv.fill(bx + 3, by, 2, 1, "plum")
    # the neighbours either side: bay-and-gables with their lamps lit behind the curtains
    for cx, wall, roof, door in ((6, "brick", "dslate", "navy"), (60, "dbrick", "shale", "forest"),
                                 (300, "brick", "shale", "ttc"), (354, "dbrick", "dslate", "forest")):
        bd.bay_gable(cv, cx, 46, wall, roof, door, 96, trim="cream", curtains="orange")
    # the house the pack comes home to, between the logo and the panel: a brick Cabbagetown cottage whose
    # slate roof's ridge (END_RIDGE) the logo stands on, a low centre gable trimmed in white over the door
    for i in range(49 - END_RIDGE):
        cv.fill(122 - 2 * i, END_RIDGE + i, 116 + 4 * i, 1, "shale")
        cv.fill(122 - 2 * i, END_RIDGE + i, 2, 1, "ash")
    cv.fill(108, 49, 144, 2, "coal")
    cv.fill(124, 51, 112, 45, "brick")
    cv.fill(233, 51, 3, 45, "dbrick")
    for y in range(55, 96, 5):
        for x in range(124 + (y // 5 % 2) * 6, 233, 12):
            cv.fill(x, y, 1, 1, "dbrick")
    rows = 54 - END_RIDGE
    for i in range(rows):
        half = 2 + i * 22 // (rows - 1)
        cv.fill(180 - half, END_RIDGE + i, 2 * half, 1, "brick")
        cv.fill(180 - half - 1, END_RIDGE + i, 2, 1, "white")
        cv.fill(180 + half - 1, END_RIDGE + i, 2, 1, "white")
    cv.fill(158, 54, 44, 1, "white")
    lit_window(cv, 178, 47, 5, 5, "stone", True, arch=True)
    # two tall sash windows lit gold under stone lintels
    for wx in (134, 208):
        cv.fill(wx - 2, 58, 22, 3, "stone")
        lit_window(cv, wx, 62, 18, 24, "white", True)
    # the front door in a stone surround under its lit transom, a porch light beside it, and the step
    cv.fill(167, 63, 26, 33, "stone")
    cv.fill(169, 65, 22, 31, "white")
    cv.fill(171, 66, 18, 6, "gold")
    cv.fill(179, 66, 2, 6, "white")
    cv.fill(171, 73, 18, 23, "dgreen")
    for py in (75, 85):
        cv.fill(173, py, 6, 8, "forest")
        cv.fill(181, py, 6, 8, "forest")
    cv.fill(186, 83, 2, 2, "amber")
    cv.fill(196, 70, 4, 2, "coal")
    cv.fill(197, 72, 2, 3, "yellow")
    # the lawn, flower beds along the wall and a low hedge either side of the house
    cv.fill(0, 96, W, 16, "green")
    for i in range(30):
        cv.fill((i * 41) % W, 98 + (i * 7) % 13, 1, 2, "dgreen")
    for x0, x1 in ((124, 164), (196, 236)):
        cv.fill(x0, 92, x1 - x0, 4, "dbrown")
        cv.fill(x0, 92, x1 - x0, 1, "plum")
        bd.flowers(cv, x0 + 2, x1 - 2, 90, ("orange", "yellow", "red", "pink"))
    for x in (90, 104, 240, 254):
        bd.bush(cv, x, 93, "dgreen", bd.SHRUB)
    cv.fill(164, 96, 32, 4, "stone")
    cv.fill(164, 99, 32, 1, "dstone")
    # the front path: tan flagstones from the step down behind the panel
    cv.fill(168, 100, 24, 12, "tan")
    cv.fill(168, 106, 24, 1, "brown")
    cv.fill(178, 100, 1, 6, "brown")
    cv.fill(184, 107, 1, 5, "brown")
    cv.fill(167, 100, 1, 12, "dgreen")
    cv.fill(192, 100, 1, 12, "dgreen")
    # the rest of the city, far off: rooftops and towers in mauve against the glow
    bd.roofline(cv, END_STREET + 110, ((8, 22, 30), (50, 40, 26), (118, 36, 28), (178, 44, 24), (250, 38, 30),
                                       (314, 38, 26)), "mauve")
    r = rand(17)
    for x, w, h in ((30, 14, 56), (96, 18, 70), (160, 12, 50), (226, 16, 64), (292, 14, 58)):
        top = END_STREET + 80 - h
        cv.fill(x, top, w, h + 30, "mauve")
        cv.fill(x + 3, top - 3, w - 6, 3, "mauve")
        for wy in range(top + 4, END_STREET + 60, 5):
            for wx in range(x + 3, x + w - 3, 4):
                if r() < 0.3:
                    cv.fill(wx, wy, 2, 1, "gold")
    # The street below at dusk: Cabbagetown's bay-and-gables, lamps lit behind their curtains, canopy trees,
    # iron fences, the yards and the sidewalk with its heritage lamps. Everything standing is kept within x 8
    # to 352, so the badges panel never cuts it into slivers.
    strip = clear(W, 150)
    for cx, top in ((28, 50), (180, 46), (330, 52)):
        bd.tree(strip, cx, top, "canopy", "pine", "bark", r=16)
    for cx, wall, roof, door in ((60, "brick", "shale", "forest"), (114, "cream", "slate", "ttc"),
                                 (246, "dbrick", "dslate", "navy"), (300, "brick", "shale", "ttc")):
        bd.bay_gable(strip, cx, 46, wall, roof, door, 104, trim="white", curtains="orange")
    bd.ground(strip, yard=END_YARD)
    bd.flowers(strip, 40, 84, END_WALK - 13, ("orange", "yellow", "red"))
    bd.flowers(strip, 226, 270, END_WALK - 12, ("orange", "yellow", "red"))
    for x0, x1 in ((8, 52), (72, 106), (126, 236), (258, 292), (312, 352)):
        bd.iron_fence(strip, END_WALK - 10, x0, x1)
    for x in (150, 210):
        bd.gas_lamp(strip, x, END_WALK + 14)
    cv.paste(strip.img, 0, END_STREET)
    # Kensington Market's brick road under the button, from the tile's row 5: its lane dashes (rows 0 to 2,
    # 24 to 34 and 56 to 63, x 64k-1) then fall under the button or off the screen's right edge, and the road's
    # rows above and below the button show none. The tile's columns 64 to 126 fill the right of the screen, so
    # its dark left edge (columns 0 to 4) shows only at the screen's left edge.
    tile = sn.TILES[next(z for z, v in sn.ZONES.items() if v["art"] == "kensington-market")]
    tile = tile.crop((0, 5, tile.width, 5 + H - END_ROAD))
    cv.img.paste(tile, (0, END_ROAD))
    cv.img.paste(tile.crop((64, 0, 127, tile.height)), (W - 63, END_ROAD))
    return cv


# ---------- screen-loading, ui-loading-track, ui-loading ----------

SKY_FOOT = 356  # NIGHT_SKY's bands end here, behind the skyline's foot
YARD_FOOT = 414  # the iron fences' and the Pet shop's bottom row: the sidewalk starts under it
CURB = 470  # the sidewalk's last row is CURB - 1; the curb, then the street
LOADING_LOGO_AT = ((W - 2 * LOGO_W) // 2, 74)  # the logo at 2x, 290x82, inside the navy band
SHOP_AT = (W - 4 - PET_SHOP_W, YARD_FOOT - PET_SHOP_H)  # ui-pet-shop's building on the corner lot
# ui-pet-shop's display window and door pane in its frame, left lit on screen-loading
SHOP_WINDOW = (9, 47, 67, 96)
SHOP_DOOR_PANE = (82, 54, 100, 68)
# The display window's and door pane's day glass, lamplit at night; the door's cream paw turns clay on it
SHOP_GLOW = {K["sky"]: "gold", K["cyan"]: "yellow", K["blue"]: "ochre"}
TRACK_END = 332  # the track's end and Lady's last nose column, at the Pet shop's door pane (318 to 335)
LAMP_X = 227
MOON = (40, 42)
PAIR_W, PAIR_H = 98, 84
PAIR_FEET = 81  # the pair's bottom opaque row (the shoes' and paws' outline) in its frame
WALK_FOOT = 460  # the screen row the pair's feet stand on
PAIR_HEEL, PAIR_NOSE = 10, 97  # Casey's rear heel on the contact frames and Lady's nose, opaque columns
TRACK_AT = (16, WALK_FOOT - 4)
TRACK_W, TRACK_H = TRACK_END - TRACK_AT[0], 8
# Where the game draws ui-loading (origin top left) at progress 0, and how far right it walks by 1: Casey's
# heel starts on the first paw print and Lady's nose ends at the Pet shop's door. Its feet stand on WALK_FOOT.
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


def cn_tower(cv, cx, foot, tip, lit=True):
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
        cv.fill(wx, pod - 1, 1, 2, "gold" if lit else "foam")
    cv.fill(cx - 10, pod - 4, 21, 2, "haze")
    cv.fill(cx - 7, pod - 6, 15, 2, "lgrey")
    cv.fill(cx - 4, pod - 8, 9, 2, "lgrey")
    # the SkyPod
    cv.fill(cx - 3, sky_pod - 1, 7, 3, "lgrey")
    cv.fill(cx - 2, sky_pod, 5, 1, "gold" if lit else "foam")
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
    """The sidewalk being walked: Lady's paw prints in dslate (3.39:1 on the night sidewalk's grey),
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
    "screen-end": end,
    "screen-loading": loading,
    "ui-loading-track": loading_track,
}


# ui-loading is drawn on a PAIR_DESIGN design grid at PAIR_SCALE on a minis.Mini that keeps 1px lines and
# single pixels 1px, so Casey stands 84 rows tall and Lady 56.
PAIR_DESIGN = (56, 48)
PAIR_SCALE = 1.75
# The pair's stride, one dict per frame: Casey's near and far feet (forward of the hip, in design px) and which
# is lifted, the body's bob, Lady's near front and hind paws, its bob and its tail's wag. Contact frames (0, 2)
# plant both feet apart; on the passing frames (1, 3) the swinging foot lifts 1px under the hip as the body
# rises 1px, as the walkers' stride has it, and Lady's diagonal pairs swap with its ears lagging.
PAIR_WALK = [
    dict(near=4, far=-4, lift=None, bob=0, front=2, hind=-2, dbob=0, wag=-1, flop=0),
    dict(near=0, far=0, lift="far", bob=-1, front=0, hind=0, dbob=-1, wag=0, flop=1),
    dict(near=-4, far=4, lift=None, bob=0, front=-2, hind=2, dbob=0, wag=1, flop=0),
    dict(near=0, far=0, lift="near", bob=-1, front=0, hind=0, dbob=-1, wag=0, flop=1),
]
PAIR_WALK_MS = 160
# Casey's hand and Lady's collar on the design grid, before the bob: the leash's two ends.
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
    """One of Lady's legs, from the hip or shoulder to its paw on row 45: the coat colour above a white
    sock 3 rows deep."""
    (hx, hy), px = hip, paw
    n = max(1, 43 - hy)
    for k in range(n + 1):
        x = round(hx + (px - hx) * k / n)
        g.rect(x, hy + k, 3, 2, upper if hy + k < 41 else sock)
    g.rect(px, 44, 3, 2, sock)
    g.p(px + 2, 45, sock_shade)


def pair_design(near=0, far=0, lift=None, bob=0, front=0, hind=0, dbob=0, wag=0, flop=0):
    """One frame of ui-loading on the PAIR_DESIGN grid: Casey side on, walking right, and Lady trotting
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
    # Lady: far legs a shade darker, the tail flagged up with its white tip, then the tan body under the
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
    wide from Casey's hand to Lady's collar, over the outline: plum, as on Cabbagetown's grey road, since
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


# ---------- ui-slot-sign ----------

# The dog-slot sign hung from the Pet shop's awning across its front: the frame's size and where the game draws
# it, and the cream board in the frame, where the game writes its two lines.
SLOT_SIGN_W, SLOT_SIGN_H = 81, 30
SLOT_SIGN_AT = (255, 120)
SLOT_BOARD = (1, 5, 79, 24)


def slot_sign(pressed=False):
    """ui-slot-sign: a cream board in a 1px dbrown frame, lit white along its top and tan along its bottom,
    hung by two dbrown cords from the awning's bottom edge. pressed lets the board drop 1px on longer
    cords."""
    g = Grid(SLOT_SIGN_W, SLOT_SIGN_H)
    x, y, w, h = SLOT_BOARD
    d = 1 if pressed else 0
    for cx in (8, SLOT_SIGN_W - 9):
        g.rect(cx, 0, 1, y + d, "dbrown")
    g.rect(x, y + d, w, h, "dbrown")
    g.rect(x + 1, y + d + 1, w - 2, h - 2, "cream")
    g.rect(x + 1, y + d + 1, w - 2, 1, "white")
    g.rect(x + 1, y + d + h - 2, w - 2, 1, "tan")
    return g.outlined(False)


def sprites():
    yield "ui-slot-sign", [(tag, [slot_sign(tag == "pressed")], 1000) for tag in ("normal", "pressed")]
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
        # which has a flat dark-brown backing.
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
    elif key == "screen-end":
        cv.paste(logo().img, *END_LOGO_AT)
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
