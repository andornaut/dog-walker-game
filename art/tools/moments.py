#!/usr/bin/env python3
"""Draw the feedback moments at the dog column: the firing moment's plate and
pop, the fee payout's flying coin and amount plate, and the treat's landing pop.
Effects carry the 1px plum rim, so they hold on the light roads and the cream
doghouse while their fills carry the dark brown column and the plum top bar.
Plates are ui.py's chrome: a cream band inside ink and plum lines, so they read
on the column and on every road.

ui-fired-plate  24x24  laid-back, fussy, dramatic (1 frame each)  nine-slice, 8px
                       corners: a stamp-like plate in the owner's temperament colour
                       (blue, purple, dred) inside a cream band, with a white stamp line
                       6px in. Stretched to 116x28 over the doghouse's name plate, with
                       "FIRED!" in font-display (62px) centred
fx-fired-pop    64x64  play (6 frames, 70ms)  drawn at 2x (128x128) centred on the 2x
                       owner face, so its pixels match the face's: an amber impact star, then
                       an amber starburst behind a POOF of cream puffs ringing the face, and
                       a front door at the left that swings shut and slams; the middle 32x32
                       stays behind the face, and the game holds the last frame
fx-coin-fly     12x12  spin (4 frames, 80ms)  a coin turning edge-on and back as it flies
                       from a doghouse to the bank
ui-payout-label 24x16  normal (1 frame)  three-slice, 8px caps: a cream price tag with a
                       punched hole in its pointed left cap. Stretched to 60x16 for "+$20"
                       in forest font-title at 2x: caps in rows 3 to 12, ink from x=9
fx-treat-pop    24x24  play (5 frames, 60ms)  hearts and crumbs bursting where the bone
                       lands on the dog in the doghouse door

Usage:
  moments.py preview OUT.png   every frame of every piece on the column and road colours
  moments.py build             write art/moments/*.aseprite and export to
                               public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py,
the rim, burst, twinkle and heart helpers in fx.py, piece in hits.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fx import burst, rim, stamp, star4  # noqa: E402
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
    """24x24 nine-slice, 8px corners: ui.py's chrome plate with a stamp line (fired_plate)."""
    import ui

    return ui.fired_plate(face, lit, shade)


def door(g, x, y, swing, jolt=0):
    """A front door in its cream frame, the hinge at the left, 13x21 from (x, y): swing 0 is shut, 1 half
    open and 2 wide open, the door then a narrowing amber slab swung out toward the viewer in front of a
    plum doorway. jolt shifts the shut door and its frame right, as it slams."""
    x += jolt
    g.rect(x, y, 13, 21, "cream")
    g.rect(x + 12, y + 1, 1, 20, "tan")
    if swing == 0:
        g.rect(x + 1, y + 1, 11, 20, "amber")
        g.rect(x + 1, y + 1, 11, 1, "yellow")
        g.rect(x + 1, y + 1, 1, 20, "yellow")
        g.rect(x + 11, y + 1, 1, 20, "orange")
        # two raised panels, outlined in orange
        for py, ph in ((y + 3, 6), (y + 11, 8)):
            g.rect(x + 3, py, 7, ph, "orange")
            g.rect(x + 4, py + 1, 5, ph - 2, "amber")
        g.rect(x + 9, y + 10, 2, 2, "yellow")
        g.p(x + 10, y + 11, "ochre")
        return
    g.rect(x + 1, y + 1, 11, 20, "plum")
    w = (0, 6, 3)[swing]
    for i in range(w):
        lift = round(i * 0.5)
        g.rect(x + 1 - w + i, y + 1 - lift, 1, 20 + 2 * lift, "orange" if i == 0 else "amber")
    g.rect(x + 1 - w, y + 1 - round((w - 1) * 0.5), w, 1, "yellow")


# The puffs of the POOF cloud round the face: (angle in degrees, size against the frame's puff radius).
PUFFS = ((-90, 1.05), (-50, 0.9), (-15, 1.1), (20, 0.95), (55, 1.05), (125, 1.0), (160, 0.9), (200, 1.1),
         (235, 0.95))


def poof_cloud(g, cx, cy, d, pr):
    """A ring of cream puffs d out from (cx, cy), tan on their lower-right, white on their upper-left."""
    for deg, k in PUFFS:
        a = math.radians(deg)
        g.ell(cx + math.cos(a) * d, cy + math.sin(a) * d * 0.9, pr * k, pr * k * 0.9, "cream", "tan", "white")


def fired_pop(step):
    """64x64, shown at 2x behind the 2x face, which covers the middle 32x32. Frame 0 is an amber impact
    star with a cream core while the face is still small; then an amber starburst opens behind a POOF of
    cream puffs ringing the face, while a front door at the left swings shut and slams, jolting, with slam
    lines and a puff of dust at its foot. The last frame, which the game holds, is the burst, the cloud
    and the shut door."""
    g = Grid(64, 64)
    cx, cy = 32, 33
    if step == 0:
        burst(g, cx, cy, 14, 6, 8, "amber", 11)
        burst(g, cx, cy, 9, 3.6, 8, "cream", 11)
        g.ell(cx, cy, 3.4, 3.4, "white")
        return rim(g)
    r = (0, 24, 30, 31, 31, 31)[step]
    piece(g, lambda p: burst(p, cx, cy, r, r * 0.6, 8, "amber", 11))
    d, pr = (0, 13, 18, 20, 21, 21)[step], (0, 5, 7, 7.5, 7, 7)[step]

    def cloud(p):
        poof_cloud(p, cx, cy, d, pr)
        # on frame 1 the cloud is still one mass round the small face; after that the face fills its middle
        if step == 1:
            p.ell(cx, cy, 11, 10, "cream", "tan", "white")
    piece(g, cloud)
    swing, jolt = (0, 2, 1, 0, 0, 0)[step], (0, 0, 0, 1, 0, 0)[step]
    piece(g, lambda p: door(p, 6, 30, swing, jolt))
    if step == 3:
        # slam lines beside the hinge, clear of the face, and a twinkle at the frame's top corner
        def lines(p):
            for x, y, n in ((1, 33, 3), (0, 40, 4), (1, 47, 3)):
                p.rect(x, y, n, 1, "white")
        piece(g, lines)
        piece(g, lambda p: star4(p, 6, 27, 2, "yellow"))
    if step in (3, 4):
        t = step - 3
        for x, rr in ((6 - t, 2.5), (17 + t, 2.5 - t * 0.5), (12, 2)):
            piece(g, lambda p: p.ell(x, 52 + t, rr + 0.5, rr, "cream", "tan"))
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
    """24x16 three-slice, 8px caps: ui.py's chrome price tag (payout_label)."""
    import ui

    return ui.payout_label()


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
