#!/usr/bin/env python3
"""Draw the dog needs: the pull bubble and its states, the blocked badge, the firing mark and the
failed pull's puff.

The bubble's cream paper carries the dslate road and its plum rim the light roads. Effects take the 1px plum rim.

ui-pull-bubble     32x28  idle (2 frames, 400ms)  the bubble swells 1px up and out and back
                          show (3 frames, 60ms)  pops in: a dot on the tail, an overshoot, the
                          rest pose
                          urgent (4 frames, 120ms)  a red then amber ring inside the plum rim,
                          the bubble swelling, alarm ticks flicking out of its upper corners
                          A 24x22 cream bubble at 4,3 with a 3-row tail down to its tip at
                          15..16,27. The game draws a 16x16 icon at 8,6 on every frame except
                          show 0 and 1, and places the frame with the tip's row one row above
                          the dog's top opaque row, centred on the dog's centre column. The
                          bubble swells up and sideways only, so the icon and tip never move
ui-pull-blocked    10x10  normal (1 frame)  a red badge with a white X in a white ring and the
                          plum rim; at 21,1 on the bubble's frame, over its top-right corner
ui-fires           16x16  static (1 frame)  a broken heart: the firing moment's heart split down a
                          zigzag crack, its halves 1px apart, in an ink outline and a white rim,
                          so it reads on every card band (dred, blue, amber, forest, purple), the
                          cream card and the plum cost plaque
                          pulse (2 frames, 400ms)  frame 0 is static; the right half drops 1px
                          Marks a card option that would fire an owner. The game draws it with its
                          top-left at 4,119 on card-frame (8,238 at 2x on card-frame-large): over
                          the cost plaque's left end, centred on the plaque's rows, clear of a
                          cost up to 40px wide centred on the plaque
fx-pull-fail       16x16  play (4 frames, 90ms)  a disappointed puff: a little cloud huffs out,
                          spreads and sags as it sinks, and breaks into two puffs. Bottom-centre
                          on the dog's centre column, 6px below its top opaque row

Usage:
  needs.py preview OUT.png   every frame of every piece on the zone roads
  needs.py build             write art/needs/*.aseprite and export them to
                             public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py,
the rim and stamp helpers in fx.py, piece in hits.py.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fx import rim, stamp  # noqa: E402
from hits import piece  # noqa: E402
from pixel import Grid, bitmap, main  # noqa: E402


def rounded(g, x, y, w, h, col, r=2):
    """A filled box with its corners clipped by r pixels on a diagonal."""
    for j in range(h):
        cut = max(0, r - j, r - (h - 1 - j))
        g.rect(x + cut, y + j, w - 2 * cut, 1, col)


# ---------- the pull bubble ----------

BW, BH = 32, 28
# The bubble's body: left, top, width, height at rest; the tail hangs from its bottom rim.
BODY = (4, 3, 24, 22)
# The tail, from the bottom rim (row 24) to the tip on columns 15 and 16 (row 27): P plum, C cream,
# T tan. Its first row opens the rim.
TAIL = ["PCCCCCCP", ".PCCCTP.", "..PCTP..", "...PP..."]


def bubble(grow=0, ring=None, size=None):
    """The bubble at rest, swollen grow pixels up and sideways (its bottom and tail stay put), with ring
    1px inside the plum rim. size=(w, h) draws a smaller bubble standing on the tail instead, for the pop."""
    g = Grid(BW, BH)
    x, y, w, h = BODY
    if size:
        w, h = size
        x, y = (BW - w) // 2, y + BODY[3] - h
    x, y, w, h = x - grow, y - grow, w + 2 * grow, h + grow
    rounded(g, x, y, w, h, "plum", 3)
    rounded(g, x + 1, y + 1, w - 2, h - 2, ring or "cream", 2)
    inner = 2 if ring else 1
    rounded(g, x + inner, y + inner, w - 2 * inner, h - 2 * inner, "cream", 1 if ring else 2)
    # a tan lip along the inside of the bottom and right, a glint at the top left
    g.rect(x + inner + 2, y + h - inner - 1, w - 2 * inner - 3, 1, "tan")
    g.rect(x + w - inner - 1, y + inner + 2, 1, h - 2 * inner - 3, "tan")
    g.p(x + inner + 1, y + inner + 1, "white")
    bitmap(g, 12, BODY[1] + BODY[3] - 1, TAIL, {"P": "plum", "C": "cream", "T": "tan"})
    return g


# Alarm ticks out of the bubble's top-left corner, each a ray of pixels from the corner outward; the right
# corner mirrors them. A ray drops its outer pixel on the frames where the ticks pull in.
TICKS = (((2, 7), (1, 7)), ((3, 2), (2, 1)), ((7, 1), (7, 0)))


def ticks(g, out):
    """Three short yellow ticks flicking out of each upper corner, rimmed in plum, so they read on every
    road; out is 0 on the frames where they pull in."""
    t = Grid(BW, BH)
    for ray in TICKS:
        for x, y in ray[:1 + out]:
            t.p(x, y, "yellow")
            t.p(BW - 1 - x, y, "yellow")
    rim(t)
    for yy, row in enumerate(t.px):
        for xx, c in enumerate(row):
            if c and not g.px[yy][xx]:
                g.px[yy][xx] = c
    return g


def blocked():
    """10x10: the plum rim, a white ring that carries the dslate road, a red face and a white X."""
    g = Grid(10, 10)
    g.ell(5, 5, 5, 5, "plum")
    g.ell(5, 5, 4, 4, "white")
    g.ell(5, 5, 3, 3, "red")
    for i in range(4):
        g.p(3 + i, 3 + i, "white")
        g.p(6 - i, 3 + i, "white")
    return g


# The broken heart, 11x10, and the crack's column in each row: the left half keeps the columns before it,
# the right half those after it.
BROKEN = ["..11...11..", ".1211.1111.", "12211111113", "12111111113", "11111111113",
          ".111111113.", "..1111113..", "...11113...", "....113....", ".....1....."]
BROKEN_CRACK = [5, 5, 4, 5, 6, 5, 4, 5, 5, 5]


def fires(drop=0):
    """16x16: the halves of the broken heart, the right one 1px further right and drop pixels lower, each
    outlined in ink (9.71:1 on amber, 12.44:1 on cream) inside a white rim (7.34:1 or more on dred, blue,
    forest, purple and plum). The crack between the halves fills with the ink outline."""
    g = Grid(16, 16)
    stamp(g, BROKEN, 2, 3, keep=lambda x, y: x < BROKEN_CRACK[y])
    stamp(g, BROKEN, 3, 3 + drop, keep=lambda x, y: x > BROKEN_CRACK[y])
    rim(g, "ink")
    return rim(g, "white")


def pull_fail(step):
    """A little cloud huffs out, spreads and sags as it sinks, then breaks into two puffs."""
    g = Grid(16, 16)
    if step == 0:
        piece(g, lambda p: p.ell(8, 9, 3, 2.5, "white", "lgrey"), size=16)
        return g
    if step < 3:
        y, spread = 7 + step, step

        def cloud(p):
            for dx, r in ((-2 - spread, 2.4), (2 + spread, 2.4), (0, 3.2)):
                p.ell(8 + dx, y + (1 if dx else 0), r, r * 0.8, "white", "lgrey")
            # the sag: the middle droops below the side puffs
            p.rect(6, y + 2, 4, 1 + step // 2, "lgrey")
        piece(g, cloud, size=16)
        return g
    for x, yy in ((4, 12), (12, 13)):
        piece(g, lambda p: p.ell(x, yy, 1.6, 1.3, "lgrey"), size=16)
    return g


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    # idle leads, so frame 0 (the anchor the game measures) is the rest pose
    yield "ui-pull-bubble", [
        ("idle", [bubble().outlined(False), bubble(grow=1).outlined(False)], 400),
        ("show", [bubble(size=(10, 8)).outlined(False), bubble(grow=2).outlined(False), bubble().outlined(False)], 60),
        ("urgent", [ticks(bubble(ring="red"), 1).outlined(False), ticks(bubble(1, "red"), 0).outlined(False),
                    ticks(bubble(ring="amber"), 1).outlined(False), ticks(bubble(1, "amber"), 0).outlined(False)],
         120)]
    yield "ui-pull-blocked", [("normal", [blocked().outlined(False)], 1000)]
    yield "ui-fires", [("static", [fires().outlined(False)], 1000),
                       ("pulse", [fires().outlined(False), fires(1).outlined(False)], 400)]
    yield "fx-pull-fail", [("play", [pull_fail(i).outlined(False) for i in range(4)], 90)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/needs", __doc__)
