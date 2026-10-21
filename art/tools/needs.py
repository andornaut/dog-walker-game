#!/usr/bin/env python3
"""Draw the dog needs: the need icons and the pull bubble and its states.

Icons and the bubble carry cream and tan: icon outlines run down the ramp until
they hold 3:1 on both, so an icon reads on the dog card, the detail card, the
doghouse wall and inside the bubble. The bubble's cream paper carries the dslate
road and its plum rim the light roads. Effects take the 1px plum rim.

icon-need-<need>   16x16  normal (1 frame)  regular (a hydrant on a grass tuft), playful (a
                          tennis ball with a bounce), friendly (a waving hand and a small
                          heart), nosy (a dog's nose breathing in scent lines), thirsty (a drop
                          over a red water bowl)
icon-growl         16x16  normal (1 frame)  a snarling muzzle baring its fangs, nose wrinkled:
                          the Nervous quirk's strain toward another dog, drawn in ui-pull-bubble
                          like a need icon
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
                          the cost plaque's left rivet, centred on the plaque's rows, clear of a
                          cost up to 40px wide centred between the rivets
fx-pull-fail       16x16  play (4 frames, 90ms)  a disappointed puff: a little cloud huffs out,
                          spreads and sags as it sinks, and breaks into two puffs. Bottom-centre
                          on the dog's centre column, 6px below its top opaque row (as fx-status)

Usage:
  needs.py preview OUT.png   every frame of every piece on the six road colours
  needs.py build             write art/needs/*.aseprite and export them to
                             public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py,
the rim helper in fx.py, piece in hits.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fx import rim, stamp  # noqa: E402
from hits import piece  # noqa: E402
from moments import rounded  # noqa: E402
from pixel import K, Grid, icon_edge, main  # noqa: E402

# The preview roads: dslate, tan, lgrey, skin2, grey and cream. Cream is also the cards' paper and tan the doghouse wall.
GROUNDS = ("3a4466", "e4a672", "c0cbdc", "c28569", "8b9bb4", "ead4aa")


def bitmap(g, x0, y0, rows, cols, big=None):
    """Stamp rows of characters; each character maps to a colour in cols, '.' is empty. On a minis.Mini
    above 1x the map is stamped pixel for pixel from (x0, y0) scaled, so it keeps no gaps: big, a map
    redrawn for that size, if given, else rows."""
    s = getattr(g, "s", 1)
    if s > 1:
        g, x0, y0, rows = g.g, round(x0 * s), round(y0 * s), big or rows
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in cols:
                g.p(x0 + x, y0 + y, cols[ch])


# ---------- need icons ----------

class Icon(Grid):
    """A 16x16 icon grid with icon_edge outlines; marks are pixels laid over the outline afterwards, for
    thin lines that an outline would smother."""

    def __init__(self):
        super().__init__(16, 16)
        self.edge = icon_edge
        self.marks = []

    def outlined(self, outline=True):
        px = super().outlined(outline)
        for x, y, c in self.marks:
            px[y][x] = K[c]
        return px


def regular():
    """A little red hydrant standing in a grass tuft: the hydrant is what reads as a dog's stop."""
    g = Icon()
    for x, h in ((2, 3), (3, 4), (4, 2), (11, 2), (12, 4), (13, 3)):
        g.rect(x, 14 - h, 1, h, "green")
    g.rect(2, 13, 12, 1, "dgreen")
    g.rect(5, 12, 6, 2, "dred")
    g.rect(6, 6, 4, 7, "red")
    g.rect(9, 6, 1, 7, "dred")
    g.rect(6, 6, 1, 6, "pink")
    g.ell(8, 6, 3, 2.5, "red", "dred", "pink")
    g.rect(7, 2, 2, 2, "dred")
    g.rect(5, 6, 6, 1, "dred")
    g.rect(4, 8, 2, 2, "red")
    g.rect(10, 8, 2, 2, "dred")
    g.rect(7, 8, 2, 2, "lgrey")
    g.p(7, 8, "white")
    return g


def playful():
    """A tennis ball with its white seam, bouncing: two ticks under it on the left."""
    g = Icon()
    g.ell(9, 7, 5.5, 5.5, "yellow", "amber", "white")
    for y in range(2, 13):
        for x in range(4, 15):
            if g.px[y][x] and abs(math.hypot(x + 0.5 - 4, y + 0.5 - 12) - 6.2) < 0.55:
                g.p(x, y, "white")
            if g.px[y][x] and abs(math.hypot(x + 0.5 - 15, y + 0.5 - 2) - 6.2) < 0.55:
                g.p(x, y, "white")
    g.rect(2, 13, 3, 1, "orange")
    g.rect(1, 11, 2, 1, "orange")
    return g


def friendly():
    """An open hand raised in a wave, fingers apart, a small heart over its shoulder."""
    g = Icon()
    g.rect(4, 8, 6, 6, "skin1")
    g.rect(9, 8, 1, 6, "skin2")
    g.rect(4, 13, 6, 1, "skin2")
    # fingers 1px apart, so the outline shows between them; the middle two are longest
    for x, top in ((4, 5), (6, 3), (8, 4)):
        g.rect(x, top, 1, 8 - top, "skin1")
    g.rect(10, 6, 1, 3, "skin2")
    # the thumb out to the left, low
    g.rect(2, 10, 2, 2, "skin1")
    g.p(2, 9, "skin1")
    bitmap(g, 10, 1, [".11.11.", "1211111", "1111113", ".11113.", "..113..", "...1..."],
           {"1": "red", "2": "pink", "3": "dred"})
    return g


def nosy():
    """A dog's nose from the front, breathing in three wavy scent lines from the upper right. The lines
    are 1px purple marks with no outline (6.11:1 on cream, 4.22:1 on tan), lying across the icon where
    Stinky's green lines rise up it."""
    g = Icon()
    bitmap(g, 1, 8, [".nnnnnnn.", "nnddnnnnn", "nnnnnnnnn", ".nn#n#nn.", "..nnnnn..", "...nnn..."],
           {"n": "navy", "d": "slate", "#": "ink"})
    g.p(3, 9, "lgrey")
    for x0, y0 in ((8, 1), (10, 4), (9, 7)):
        for dx, dy in SCENT:
            if x0 + dx < 16:
                g.marks.append((x0 + dx, y0 + dy, "purple"))
    return g


# One wavy scent line, 6x2: down, up, up, down, down, up.
SCENT = ((0, 1), (1, 0), (2, 0), (3, 1), (4, 1), (5, 0))


def thirsty():
    """A water drop falling over a red water bowl."""
    g = Icon()
    # the bowl: wider at the foot, a red band with a pink lit side, cyan water across the top
    g.rect(3, 9, 10, 1, "cyan")
    g.rect(3, 10, 10, 1, "red")
    g.rect(2, 11, 12, 3, "red")
    g.rect(2, 11, 1, 3, "pink")
    g.rect(12, 11, 2, 3, "dred")
    g.rect(3, 9, 2, 1, "white")
    # the drop: a point over a round base, lit at the top left
    g.tri((8, 0.5), (5.8, 5), (10.2, 5), "sky")
    g.ell(8, 5, 2.4, 2.4, "sky", "blue", "cyan")
    g.p(7, 4, "white")
    return g


ICONS = {"regular": regular, "playful": playful, "friendly": friendly, "nosy": nosy, "thirsty": thirsty}


def growl():
    """A golden muzzle snarling from the front: the nose over wrinkles slanting in toward it, the lip curled
    off pink gums, two fangs down and two up around a plum mouth and a red tongue."""
    g = Icon()
    bitmap(g, 1, 1, ["....nnnnnn....",
                     "...nlnnnnnn...",
                     "..aan#nn#naa..",
                     ".aaaannnnaaaa.",
                     "aaoaaaaaaaaoaa",
                     "aaaoaaaaaaoaaa",
                     "apppppppppppPa",
                     "aWWddddddddWWa",
                     "adWddddddddWda",
                     "addddrrrrdddda",
                     "adWdrrrrrrdWda",
                     "aWWppppppppWWa",
                     ".aaaaaaaaaaaa."],
           {"n": "navy", "#": "ink", "l": "slate", "a": "amber", "o": "orange", "p": "pink", "P": "mauve",
            "W": "white", "d": "plum", "r": "red"})
    return g


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
    for need, draw in ICONS.items():
        yield f"icon-need-{need}", [("normal", [draw().outlined()], 1000)]
    yield "icon-growl", [("normal", [growl().outlined()], 1000)]
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
    main(sys.argv, sprites, "art/needs", __doc__, grounds=GROUNDS)
