#!/usr/bin/env python3
"""Draw the road feedback for heart changes, near misses and dodges: the
broken heart that pops over a dog and arcs into its doghouse, the pink heart
that pops and flies up, and a small dog's dodge.

The hearts are built like ui-fires (needs.py): red, pink and dred (white, pink
and mauve for a gained heart) in a 1px ink line inside a 1px white rim, so the
ink holds on the light roads and the cream doghouse and the white on the dslate
road and the dimmed road. The dodge's dust and lines take a plum rim.

fx-heart-loss  32x32  pop (6 frames: 50, 50, 90, 90, 90, 450ms; 820ms)  a small whole heart
                      pops in on a white star, then the big heart (17x15 in its rims, 21x19)
                      with impact ticks, settles, cracks down a zigzag in ink, and splits:
                      the right half 1px right and 1px lower, then 2px lower; the last frame
                      holds. The big heart's centre is (16, 16), its rims x 6 to 26, rows 7 to 25.
                      fly (2 frames, 120ms, loops)  the small broken heart (ui-fires' 11x10, rims
                      15x14, x 9 to 23, rows 9 to 22), the right half bobbing 1px; centred on the
                      same point (16, 16), for the game to tween in an arc down into the doghouse
fx-heart-gain  32x32  pop (5 frames: 50, 50, 90, 90, 450ms; 730ms)  the same pop in pink: a
                      small heart on a white star, the big heart with impact ticks, then
                      sparkles twinkling at its shoulders; the last frame holds
                      fly (2 frames, 120ms, loops)  the small whole pink heart, a white glint
                      on the second frame; centred on (16, 16)
                      Both: the frame's centre column on the dog's centre column, its bottom
                      row on the dog's top opaque row + 4, so the heart's tip overlaps the
                      head. The game writes "-1" / "+1" in font-title at 1x, left edge at
                      frame x 31 (clear of the split halves and the impact ticks), caps
                      centred on row 16. The game swaps pop's last frame for fly at the same
                      point and tweens fly's centre to the slot's heartLabels band (slot x 2
                      to 117, rows 64 to 87), where its 14 rows fit.
fx-dodge       48x48  play (5 frames, 70ms; 350ms)  laid on a small dog's 48x48 frame as it dodges a
                      hit: a dust puff kicked up at its left foot swells, drifts back and thins,
                      three speed lines trail on its left and shorten. The game letters DODGE!
                      over its head in font-comic (ring top-left at 6,0) on frames 0 to 3.
                      Drawn for a sidestep right; the game mirrors it for a sidestep left

Usage:
  feedback.py preview OUT.png   every frame on the six road colours and the dimmed road
  feedback.py build             write art/feedback/*.aseprite and export to
                                public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py,
the rim, burst, twinkle and heart helpers in fx.py, piece and
layer in hits.py, the broken heart in needs.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fx import burst, rim, stamp, star4  # noqa: E402
from hits import layer, piece  # noqa: E402
from needs import BROKEN, BROKEN_CRACK  # noqa: E402
from pixel import DARKER, Grid, main  # noqa: E402

# The preview roads (dslate, tan, lgrey, skin2, grey and cream), then each one ramp step darker: the road
# dimmed under a card.
ROADS = ("3a4466", "e4a672", "c0cbdc", "c28569", "8b9bb4", "ead4aa")
GROUNDS = ROADS + tuple(DARKER[c] for c in ROADS)

# ---------- heart changes ----------

# The big heart, 17x15, drawn like ui-fires' BROKEN: 1 the fill, 2 the light, 3 the shade.
BIG = ["..11111...11111..", ".1122211.1111111.", "11222111111111113", "12211111111111113",
       "12111111111111113", "11111111111111113", "11111111111111113", ".111111111111113.",
       "..1111111111113..", "...11111111113...", "....111111113....", ".....1111113.....",
       "......11113......", ".......113.......", "........1........"]
# The crack's column in each row of BIG, a zigzag like BROKEN_CRACK's.
BIG_CRACK = [8, 8, 8, 7, 8, 9, 8, 7, 8, 9, 8, 8, 8, 8, 8]
LOSS = ("red", "pink", "dred")
GAIN = ("pink", "white", "mauve")
# The hearts' centre in the 32x32 frame; BIG's top-left and the small heart's.
CX, CY = 16, 16
BIG_AT = (CX - 8, CY - 7)
SMALL_AT = (CX - 5, CY - 5)


def ringed(g):
    """ui-fires' rims: a 1px ink line, then a 1px white rim outside it."""
    rim(g, "ink")
    return rim(g, "white")


def ticks(step):
    """Eight short white impact ticks round the big heart, in an ink line, on its first big frame."""
    g = Grid(32, 32)
    for k in range(8):
        a = math.radians(k * 45 + 22.5)
        for r in (12.5, 13.5):
            g.p(round(CX - 0.5 + math.cos(a) * r), round(CY - 0.5 + math.sin(a) * r * 0.92), "white")
    return rim(g, "ink")


def pop_in(g, cols):
    """Frame 0 of both pops: a white star with the small whole heart over it."""
    piece(g, lambda p: burst(p, CX, CY, 9, 4, 8, "white", 11), "ink", 32)
    h = Grid(32, 32)
    stamp(h, BROKEN, *SMALL_AT, cols)
    return layer(g, ringed(h))


def heart_loss(step):
    """Pops in, settles, cracks and splits, then holds split."""
    g = Grid(32, 32)
    if step == 0:
        return pop_in(g, LOSS)
    x0, y0 = BIG_AT
    h = Grid(32, 32)
    if step < 4:
        stamp(h, BIG, x0, y0, LOSS)
        if step == 3:
            for y, x in enumerate(BIG_CRACK):
                if BIG[y][x] != ".":
                    h.p(x0 + x, y0 + y, "ink")
    else:
        # the halves part 3px, then 4px, so a white seam opens between their ink lines; the right one drops
        drop = step - 3
        stamp(h, BIG, x0 - 1, y0, LOSS, lambda x, y: x < BIG_CRACK[y])
        stamp(h, BIG, x0 + drop, y0 + drop, LOSS, lambda x, y: x > BIG_CRACK[y])
    if step == 1:
        layer(g, ticks(step))
    return layer(g, ringed(h))


def heart_gain(step):
    """Pops in, settles, then twinkles at its shoulders."""
    g = Grid(32, 32)
    if step == 0:
        return pop_in(g, GAIN)
    h = Grid(32, 32)
    stamp(h, BIG, *BIG_AT, GAIN)
    if step == 1:
        layer(g, ticks(step))
    layer(g, ringed(h))
    if step >= 2:
        for (x, y), r in zip(((5, 6), (27, 9), (26, 26)), ((2, 1, 2), (1, 2, 1), (1, 1, 2))[step - 2]):
            piece(g, lambda p: star4(p, x, y, r, "yellow"), "ink", 32)
    return g


def fly_loss(bob):
    """ui-fires' broken heart, centred on the pop's centre: the halves 1px apart, the right one bob
    pixels lower."""
    g = Grid(32, 32)
    x0, y0 = SMALL_AT
    stamp(g, BROKEN, x0, y0, LOSS, lambda x, y: x < BROKEN_CRACK[y])
    stamp(g, BROKEN, x0 + 1, y0 + bob, LOSS, lambda x, y: x > BROKEN_CRACK[y])
    return ringed(g)


def fly_gain(glint):
    """The small whole pink heart, with a white glint on its right lobe."""
    g = Grid(32, 32)
    stamp(g, BROKEN, *SMALL_AT, GAIN)
    if glint:
        g.p(SMALL_AT[0] + 8, SMALL_AT[1] + 2, "white")
    return ringed(g)


# ---------- the dodge ----------

# fx-dodge is laid on a 48x48 dog's frame. The dog sidesteps right: its dust kicks up at the left foot and
# speed lines trail it on the left (the game mirrors the frame for a sidestep left).
DODGE = 48
# Per frame: each puff's (x, y, radius), the speed lines' length.
DODGE_PUFFS = (((19, 43, 2), (15, 44, 1.5)),
               ((17, 42, 2.8), (12, 43, 2.3), (21, 44, 1.8)),
               ((15, 40, 3.2), (9, 42, 2.8), (21, 43, 2.3)),
               ((14, 39, 2.8), (8, 40, 2.3), (19, 41, 1.8)),
               ((12, 37, 2), (6, 39, 1.5)))
DODGE_LINES = (10, 9, 6, 3, 0)
DODGE_ROWS = (25, 30, 35)


def dodge(step):
    """A small dog's sidestep: a dust puff kicked up at its left foot that swells, drifts back and thins out,
    and three speed lines trailing on its left that shorten as it settles. Light grey and white dust and
    white lines in a plum rim, as the effects' rule, so they hold on every road."""
    g = Grid(DODGE, DODGE)
    for x, y, r in DODGE_PUFFS[step]:
        g.ell(x, y, r, r * 0.8, "white" if step == 4 else "lgrey", None if step == 4 else "grey")
    n = DODGE_LINES[step]
    for k, y in enumerate(DODGE_ROWS):
        if n:
            g.rect(12 - n + (2 if k == 1 else 0), y, n - (2 if k == 1 else 0), 1, "white")
    return rim(g)


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    yield "fx-heart-loss", [("pop", [heart_loss(i).outlined(False) for i in range(6)], [50, 50, 90, 90, 90, 450]),
                            ("fly", [fly_loss(b).outlined(False) for b in (0, 1)], 120)]
    yield "fx-heart-gain", [("pop", [heart_gain(i).outlined(False) for i in range(5)], [50, 50, 90, 90, 450]),
                            ("fly", [fly_gain(b).outlined(False) for b in (0, 1)], 120)]
    yield "fx-dodge", [("play", [dodge(i).outlined(False) for i in range(5)], 70)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/feedback", __doc__, grounds=GROUNDS)
