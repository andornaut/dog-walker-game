#!/usr/bin/env python3
"""Draw the road feedback for heart changes, near misses and minor bumps: the
broken heart that pops over a dog and arcs into its doghouse, the pink heart
that pops and flies up, the small splash or puff of an area effect that caught
nobody, and the coins that burst from the pack on a minor bump.

The hearts are built like ui-fires (needs.py): red, pink and dred (white, pink
and mauve for a gained heart) in a 1px ink line inside a 1px white rim, so the
ink holds on the light roads and the cream doghouse and the white on Woof Way
and the dimmed road. The splash takes the navy rim, the puff fx-hit-skunk's
mauve in its plum rim, the coins fx-coin-fly's coin in its plum rim.

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
fx-close-one   32x32  splash (5 frames, 70ms)  a small puddle splash: a ripple at the feet, a
                      few drops up and back
                      puff (5 frames, 80ms)  a small mauve stink puff (fx-hit-skunk's mauve and
                      plum): three puffs swell, rise and break apart, a stink line curling up
                      splash-word, puff-word  the same frames and timing, with PHEW! in the
                      comic lettering in rows 1 to 11 over frames 0 to 3
                      The frame's centre column on the pack's centre, its bottom row on the
                      walker's feet. The game writes "Close one!" centred on x 16, its line
                      bottom 2px above the frame's top row
fx-coin-burst  64x48  play (7 frames, 70ms; 490ms)  an amber pop at (32, 28), then five of
                      fx-coin-fly's coins thrown up and out, spinning, falling back under
                      gravity; the highest coin's top is row 8. (32, 28) on the contact point.
                      The game writes "-$2" centred on x 32, its line bottom on frame row 6

Usage:
  feedback.py preview OUT.png   every frame on the six road colours and the dimmed road
  feedback.py build             write art/feedback/*.aseprite and export to
                                public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py,
the rim, burst, twinkle, heart and comic word helpers in fx.py, piece and
layer in hits.py, the coin in moments.py, the broken heart in needs.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fx import burst, rim, stamp, star4, word  # noqa: E402
from hits import layer, piece  # noqa: E402
from moments import coin_fly  # noqa: E402
from needs import BROKEN, BROKEN_CRACK  # noqa: E402
from pixel import DARKER, Grid, main  # noqa: E402

# The six road colours (Woof Way, Bark Park, Sniff Street Shops, The Long Way Home, Snooze Crescent,
# Paws Promenade), then each one ramp step darker: the road dimmed under a card.
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


# ---------- the close one ----------

FEET = 28


def close_splash(step):
    """A small crown of water rises from a ripple at the feet and falls back, throwing five drops up and
    out; the ripple spreads and opens to a thin ring."""
    g = Grid(32, 32)
    rx, ry = (5, 7, 9, 10, 11)[step], (1.5, 2, 2.5, 2.5, 2)[step]
    g.ell(16, FEET, rx, ry, "sky", "blue", "cyan")
    if step:
        g.ell(16, FEET - 0.5, rx - (2, 2, 2, 2, 1.5)[step], ry - 1, None)
    # the crown: five spikes round the ripple's back, cyan with white tips
    h = (2, 5, 6, 3, 0)[step]
    for k, dx in enumerate((-6, -3, 0, 3, 6)):
        hk = h - (1 if k in (0, 4) else 0)
        x = 16 + round(dx * rx / 10)
        if hk > 0:
            g.rect(x, FEET - 1 - hk, 1 + (k == 2), hk, "cyan")
            g.p(x, FEET - 1 - hk, "white")
    for i, (vx, vy) in enumerate(((-3.2, -5.5), (-1.6, -7.5), (0.2, -8.5), (1.8, -7.5), (3.3, -5.5))):
        t = step + 0.4
        x, y = 16 + vx * t, FEET - 3 + vy * t + 2.2 * t * t
        if step and y < FEET - 3:
            g.rect(x, y, 2 if i % 2 else 1, 2, "cyan" if step < 3 else "sky")
            if step < 3:
                g.p(x, y, "white")
    return rim(g, "navy")


def close_puff(step):
    """Three mauve puffs swell at the feet, rise and drift apart, the middle one breaking first, with a
    stink line curling up out of them."""
    g = Grid(32, 32)
    rise = (0, 1, 3, 5, 7)[step]
    spread = (0, 1, 2, 4, 5)[step]
    r = (3, 4.2, 4.8, 4, 2.8)[step]
    puffs = ((16 - 4 - spread, FEET - 3 - rise, r * 0.9), (16 + 4 + spread, FEET - 2 - rise, r * 0.85))
    if step < 4:
        puffs += ((16, FEET - 5 - rise * 1.2, r * 1.15),)

    def cloud(p):
        for x, y, pr in puffs:
            p.ell(x, y, pr + 0.5, pr, "mauve", "purple", "pink" if step < 2 else None)
    piece(g, cloud, "plum", 32)
    if step >= 1:
        # two stink lines curling up out of the puffs, pink with a plum side, as fx-hit-skunk's
        squiggle = Grid(32, 32)
        for x0, base, lean in ((12, FEET - 8, -1), (20, FEET - 9, 1)):
            top = base - rise * 1.3
            for t in range((3, 5, 6, 5)[step - 1]):
                x = x0 + (0, 1, 1, 0, -1, -1)[(t + step) % 6] + lean * (t // 3)
                squiggle.p(x, round(top - t), "pink")
                squiggle.p(x + 1, round(top - t), "plum")
        layer(g, squiggle)
    return g


# The comic word shows over frames 0 to 3, its ink ring's top on row 1.
WORD = "PHEW!"
WORD_FRAMES = 4


def worded(g, step):
    return word(g, WORD, 16, 1) if step < WORD_FRAMES else g


# ---------- the coin burst ----------

BURST = (32, 28)
# Each coin's launch angle in degrees (0 points right, -90 straight up) and its first spin phase.
COINS = ((-150, 0), (-118, 1), (-90, 2), (-62, 3), (-30, 1))
# How far each coin has been thrown out from the pop, slowing, and how far it has fallen, per frame.
THROW = (0, 12, 18, 21, 23, 24, 25)
FALL = (0, 0, 1, 3, 6, 10, 14)


def coin_burst(step):
    """64x48: an amber pop, then five coins thrown up and out, slowing as they rise and falling back,
    each spinning through fx-coin-fly's four faces."""
    g = Grid(64, 48)
    cx, cy = BURST
    if step == 0:
        burst(g, cx, cy, 8, 3.5, 8, "amber", 11)
        burst(g, cx, cy, 5, 2, 8, "yellow", 11)
        g.p(cx, cy, "white")
        g.p(cx - 1, cy, "white")
        return rim(g)
    for deg, phase in COINS:
        a = math.radians(deg)
        x = cx + math.cos(a) * THROW[step] * 1.1
        y = cy + math.sin(a) * THROW[step] * 0.8 + FALL[step]
        coin = coin_fly((phase + step) % 4)
        for yy, row in enumerate(coin.px):
            for xx, c in enumerate(row):
                if c:
                    g.p(round(x) - 6 + xx, round(y) - 6 + yy, c)
    return g


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    yield "fx-heart-loss", [("pop", [heart_loss(i).outlined(False) for i in range(6)], [50, 50, 90, 90, 90, 450]),
                            ("fly", [fly_loss(b).outlined(False) for b in (0, 1)], 120)]
    yield "fx-heart-gain", [("pop", [heart_gain(i).outlined(False) for i in range(5)], [50, 50, 90, 90, 450]),
                            ("fly", [fly_gain(b).outlined(False) for b in (0, 1)], 120)]
    yield "fx-close-one", [("splash", [close_splash(i).outlined(False) for i in range(5)], 70),
                           ("puff", [close_puff(i).outlined(False) for i in range(5)], 80),
                           ("splash-word", [worded(close_splash(i), i).outlined(False) for i in range(5)], 70),
                           ("puff-word", [worded(close_puff(i), i).outlined(False) for i in range(5)], 80)]
    yield "fx-coin-burst", [("play", [coin_burst(i).outlined(False) for i in range(7)], 70)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/feedback", __doc__, grounds=GROUNDS)
