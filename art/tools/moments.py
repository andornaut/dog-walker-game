#!/usr/bin/env python3
"""Draw the feedback moments at the dog column: the firing moment's plate and
pop, the fee payout's flying coin and amount plate, and the treat's landing pop.
Effects carry the 1px plum rim, so they hold on the light roads and the cream
doghouse while their fills carry the dark brown column and the plum top bar.
Plates keep a cream band inside a plum rim, so they read on the column and on
every road.

ui-fired-plate  24x24  laid-back, fussy, dramatic (1 frame each)  nine-slice, 8px
                       corners: a stamp-like plate in the owner's temperament colour
                       (blue, purple, dred) inside a cream band, with a white stamp line
                       5px in. Stretched to 72x28 for "FIRED!" in white font-title at
                       2x, centred: caps in rows 9 to 18, ink from x=10 to 61
fx-fired-pop    64x64  play (6 frames, 70ms)  drawn at 2x (128x128) centred on the 2x
                       owner face, so its pixels match the face's: an impact star, then a
                       storm cloud on each side with a bolt and a heart above the face
                       that cracks and falls apart; the middle 32x32 stays behind the face
fx-coin-fly     12x12  spin (4 frames, 80ms)  a coin turning edge-on and back as it flies
                       from a doghouse to the bank
ui-payout-label 24x16  normal (1 frame)  three-slice, 8px caps: a cream price tag with a
                       punched hole in its pointed left cap. Stretched to 60x16 for "+$20"
                       in forest font-title at 2x: caps in rows 3 to 12, ink from x=9
fx-treat-pop    24x24  play (5 frames, 60ms)  hearts and crumbs bursting where the bone
                       lands on the dog in the doghouse door

Usage:
  moments.py preview OUT.png   every frame of every piece on the column and road colours
  moments.py build             write art/moments/*.aseprite, export to public/art/sprites/
                               and list them in the manifest

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py,
the rim, burst, twinkle and heart helpers in fx.py, piece in hits.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fx import SMALL, burst, rim, stamp, star4  # noqa: E402
from hits import piece  # noqa: E402
from pixel import Grid, main  # noqa: E402

# The dark brown column, the plum top bar and the three light roads, for the preview.
GROUNDS = ("733e39", "3e2731", "e4a672", "c0cbdc", "c28569")


def rounded(g, x, y, w, h, col, r=2):
    """A filled box with its corners clipped by r pixels on a diagonal."""
    for j in range(h):
        cut = max(0, r - j, r - (h - 1 - j))
        g.rect(x + cut, y + j, w - 2 * cut, 1, col)


# ---------- firing moment ----------

# Each temperament's plate: face, its lit edge (top and left) and its shaded edge (bottom and right).
# White text holds 8.48:1 on blue, 8.86:1 on purple and 7.34:1 on dred.
TEMPERAMENTS = {"laid-back": ("blue", "sky", "navy"), "fussy": ("purple", "mauve", "plum"),
                "dramatic": ("dred", "red", "plum")}


def fired_plate(face, lit, shade):
    """24x24 nine-slice, 8px corners; rows and columns 8 to 15 are uniform, so a stretch keeps
    them crisp. A plum rim, a cream band (tan on the shaded sides) that carries the dark column,
    then the face, bevelled, with a white stamp line 5px in around the text."""
    g = Grid(24, 24)
    rounded(g, 0, 0, 24, 24, "plum", 3)
    rounded(g, 1, 1, 22, 22, "cream", 2)
    g.rect(3, 21, 18, 1, "tan")
    g.rect(21, 3, 1, 18, "tan")
    g.p(20, 20, "tan")
    rounded(g, 3, 3, 18, 18, shade, 1)
    g.rect(3, 4, 17, 16, face)
    g.rect(4, 3, 16, 17, face)
    g.rect(4, 3, 16, 1, lit)
    g.rect(3, 4, 1, 16, lit)
    # the stamp line, its corners cut so it reads as a stamp's rounded border
    g.rect(6, 5, 12, 1, "white")
    g.rect(6, 18, 12, 1, "white")
    g.rect(5, 6, 1, 12, "white")
    g.rect(18, 6, 1, 12, "white")
    return g


def cloud(g, cx, cy, s, bolt=False):
    """A storm cloud of three puffs, slate with a dslate underside and a grey top; s scales it.
    bolt hangs a yellow lightning zigzag under it."""
    for dx, dy, r in ((-0.55, 0.15, 0.5), (0.5, 0.2, 0.45), (0, -0.2, 0.62)):
        g.ell(cx + dx * s * 2, cy + dy * s * 2, r * s * 1.6, r * s * 1.3, "slate", "dslate", "grey")
    g.rect(round(cx - s * 1.1), round(cy + s * 0.55), round(s * 2.2), 1, "dslate")
    if bolt:
        x, y = round(cx), round(cy + s * 0.9)
        for dx, dy in ((0, 0), (-1, 1), (-1, 2), (0, 2), (1, 2), (0, 3), (0, 4), (-1, 5)):
            g.p(x + dx, y + dy, "yellow")


# Big heart over the face: HEART at 2x is too heavy beside the 2x face, so a 13x11 drawn here.
BIG = ["..111...111..", ".12211.11111.", "1221111111113", "1211111111113", "1111111111113",
       ".11111111113.", "..111111113..", "...1111113...", "....11113....", ".....113.....", "......1......"]
BIG_CRACK = [6, 6, 7, 6, 5, 6, 7, 6, 6, 6, 6]


def fired_pop(step):
    """64x64, shown at 2x behind the 2x face, which covers the middle 32x32. Frame 0 is an impact
    star while the face is still small; then a storm cloud swells on each side of the face, one
    with a bolt, and a heart pops up above it, cracks, splits and falls in two darkening halves."""
    g = Grid(64, 64)
    cx, cy = 32, 34
    if step < 2:
        r = (14, 26)[step]
        burst(g, cx, cy, r, r * 0.42, 8, "red" if step else "white", 11)
        burst(g, cx, cy, r * 0.62, r * 0.26, 8, "yellow", 11)
        g.ell(cx, cy, r * 0.24, r * 0.24, "white")
        rim(g)
    if step >= 1:
        # half a cloud is about 2.1s wide, so the drift keeps both inside the frame
        s = (0, 3, 4, 4.5, 4, 3.5)[step]
        drift = (0, 0, 1, 2, 3, 3)[step]
        piece(g, lambda p: cloud(p, 12 - drift, 28 - drift, s, step in (2, 3)))
        piece(g, lambda p: cloud(p, 52 + drift, 24 - drift, s * 0.9, step in (3, 4)))
    if step == 1:
        piece(g, lambda p: stamp(p, SMALL, cx - 3, 8))
    elif step in (2, 3):
        def heart(p):
            stamp(p, BIG, cx - 6, 4)
            if step == 3:
                for y, x in enumerate(BIG_CRACK):
                    p.p(cx - 6 + x, 4 + y, "plum")
        piece(g, heart)
        if step == 2:
            for x, y in ((cx - 10, 6), (cx + 9, 3), (cx + 11, 12)):
                piece(g, lambda p: star4(p, x, y, 1, "white", "yellow"))
    elif step >= 4:
        spread, drop = (2, 4)[step - 4], (2, 6)[step - 4]
        cols = ("red", "pink", "dred") if step == 4 else ("dred", "red", "plum")
        piece(g, lambda p: stamp(p, BIG, cx - 6 - spread, 4 + drop, cols, lambda x, y: x < BIG_CRACK[y]))
        piece(g, lambda p: stamp(p, BIG, cx - 6 + spread, 5 + drop, cols, lambda x, y: x > BIG_CRACK[y]))
    # the face covers the middle from frame 2 on, so keep it clear for a clean silhouette
    if step >= 2:
        g.rect(19, 21, 26, 30, None)
    return g


# ---------- fee payout ----------

def coin_fly(step):
    """12x12: the coin turns edge-on and back. Amber holds 4.57:1 on the dark brown column and
    7.35:1 on the plum top bar; the plum rim carries the light roads and the cream doghouse."""
    g = Grid(12, 12)
    if step == 2:
        g.rect(5, 1, 2, 10, "orange")
        g.rect(5, 1, 1, 10, "yellow")
        g.p(5, 1, "white")
    else:
        rx = (4.5, 2.5, 0, 2.5)[step]
        g.ell(6, 6, rx + 0.5, 5, "amber", "orange", "yellow")
        if step == 0:
            # a stamped ring on the face, lit away at the top-left where the light catches it
            for y in range(12):
                for x in range(12):
                    d = math.hypot(x + 0.5 - 6, (y + 0.5 - 6) * 0.9)
                    if 2.2 < d < 3.2 and x + y > 8:
                        g.p(x, y, "orange")
            g.p(3, 3, "white")
        else:
            g.rect(5 if step == 1 else 6, 3, 1, 6, "orange")
            g.p(5 if step == 1 else 6, 2, "yellow")
            g.p(4 if step == 1 else 7, 3, "white")
    return rim(g)


def payout_label():
    """24x16 three-slice, 8px caps; columns 8 to 15 are uniform. A cream price tag with a plum
    rim and a tan lip, its left cap a point stepping in 1px every 2 rows with a punched hole.
    Forest text holds 5.39:1 on the cream."""
    g = Grid(24, 16)
    for j in range(16):
        left = (int(abs(j - 7.5)) + 1) // 2
        right = 21 if j in (0, 15) else 22 if j in (1, 14) else 23
        if j in (0, 15):
            g.rect(left, j, right - left + 1, 1, "plum")
            continue
        g.p(left, j, "plum")
        g.p(right, j, "plum")
        g.rect(left + 1, j, right - left - 1, 1, "tan" if j == 14 else "cream")
        if 2 <= j < 14:
            g.p(right - 1, j, "tan")
    # the punched hole: clear, in a plum ring
    g.rect(3, 6, 4, 4, "plum")
    g.rect(4, 7, 2, 2, None)
    for x, y in ((3, 6), (6, 6), (3, 9), (6, 9)):
        g.p(x, y, "cream")
    return g


# ---------- treat given ----------

CRUMBS = ((-6, -2, "cream"), (5, -3, "tan"), (-4, 1, "brown"), (6, 1, "cream"), (1, -4, "tan"))
# A 5x5 heart: SMALL crowds three hearts into 24x24.
MINI = ["11.11", "12111", "11113", ".113.", "..1.."]


def treat_pop(step):
    """24x24, centred where the bone lands on the dog. A yellow twinkle, a white pop, then three
    small hearts pop up out of it and fan out while crumbs scatter and fall; each part is rimmed on its own so
    they stay apart, and the last frame fades the hearts to pink."""
    g = Grid(24, 24)
    cx, cy = 12, 15
    if step == 0:
        piece(g, lambda p: star4(p, cx, cy, 3, "yellow"), size=24)
        return g
    if step == 1:
        piece(g, lambda p: burst(p, cx, cy, 5.5, 2.5, 6, "white", 15), size=24)
    for dx, dy, col in CRUMBS:
        x = round(cx + dx * (0.5 + step * 0.35))
        y = round(cy + dy * (0.5 + step * 0.3) + step * step * 0.4)
        if 1 <= x < 23 and 1 <= y < 23:
            piece(g, lambda p: p.p(x, y, col), size=24)
    for i, (x0, vx, delay) in enumerate(((cx - 7, -1, 0), (cx + 3, 1, 0), (cx - 2, 0, 1))):
        t = step - 2 - delay
        if t < 0:
            continue
        cols = ("red", "pink", "dred") if step < 4 else ("pink", "white", "red")
        piece(g, lambda p: stamp(p, MINI, x0 + vx * t, round(cy - 8 - t * 2.5), cols), size=24)
    return g


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    yield "ui-fired-plate", [(t, [fired_plate(*cols).outlined(False)], 1000) for t, cols in TEMPERAMENTS.items()]
    yield "fx-fired-pop", [("play", [fired_pop(i).outlined(False) for i in range(6)], 70)]
    yield "fx-coin-fly", [("spin", [coin_fly(i).outlined(False) for i in range(4)], 80)]
    yield "ui-payout-label", [("normal", [payout_label().outlined(False)], 1000)]
    yield "fx-treat-pop", [("play", [treat_pop(i).outlined(False) for i in range(5)], 60)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/moments", __doc__, grounds=GROUNDS)
