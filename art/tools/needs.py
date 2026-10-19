#!/usr/bin/env python3
"""Draw the dog needs: the need icons, the pull bubble and its states, the need
spots on the road, the fulfilment moment and the Regular dog's accident.

Icons and the bubble carry cream and tan: icon outlines run down the ramp until
they hold 3:1 on both, so an icon reads on the dog card, the detail card, the
doghouse wall and inside the bubble. The bubble's cream paper carries Woof Way
and its plum rim the light roads. Effects take the 1px plum rim (navy for
water); road sprites take road_edge and the lit rim.

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
fx-need-met        48x48  regular, playful, friendly, nosy, thirsty (6 frames, 70ms each)  a
                          round bubble pops up with the need's icon baked in, swells, hearts and
                          sparkles fly out, then it bursts into droplets. Bottom-centre on the
                          dog's feet
fx-accident        32x32  play (6 frames, 100ms)  a "!" pops over the dog, blush lines and a
                          sweat drop come and stay, and a small pile plops out behind. Laid on the
                          dog's own 32x32 frame; the game then leaves accident-spot on the road
accident-spot      16x16  idle (2 frames, 500ms)  the pile left behind, a ground decal with no
                          outline drawn under everything, a fly circling it
spot-tree          32x48  idle (4 frames, 450ms)  a street tree on a grass patch (Regular); the
                          canopy rustles, then a leaf falls
spot-stranger      32x48  idle (2 frames, 400ms)  a friendly stranger facing the player, one hand
                          up in a wave, breathing (Friendly)
                          wave (2 frames, 300ms)  the raised hand waves
spot-lamp-post     32x48  idle (2 frames, 500ms)  a street lamp with an amber lantern; a sheen
                          crosses the glass (Nosy)
spot-water-bowl    32x32  idle (4 frames, 350ms)  a red dog bowl under a tap: a drop forms,
                          falls and rings the water (Thirsty)
spot-<spot>@<step>  every spot redrawn small on a Mini at each depth step in minis.STEPS (from
                   shared/depth-steps.json), floor(size x scale + 0.5): the same tags, frames and
                   durations, a full 1px outline, motion kept at 1px; the bowl drops its bone

Usage:
  needs.py preview OUT.png   every frame of every piece on the six road colours
  needs.py build             write art/needs/*.aseprite and export them to
                             public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py,
the rim, burst, twinkle and heart helpers in fx.py, piece and layer in hits.py,
dressed, face_front and the lit rim in road.py, small in minis.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fx import HEART, SMALL, burst, rim, stamp, star4  # noqa: E402
from hits import layer, piece  # noqa: E402
from minis import STEPS, small  # noqa: E402
from moments import rounded  # noqa: E402
from pixel import K, Grid, edged, icon_edge, main  # noqa: E402
import road  # noqa: E402

# The six road colours: Woof Way, Bark Park, Sniff Street Shops, The Long Way Home, Snooze Crescent
# and Paws Promenade. Cream is also the cards' paper and tan the doghouse wall.
GROUNDS = ("3a4466", "e4a672", "c0cbdc", "c28569", "8b9bb4", "ead4aa")
NEEDS = ("regular", "playful", "friendly", "nosy", "thirsty")


def bitmap(g, x0, y0, rows, cols):
    """Stamp rows of characters; each character maps to a colour in cols, '.' is empty."""
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in cols:
                g.p(x0 + x, y0 + y, cols[ch])


def lit(g):
    """road.rim with road.LIT on the grid that holds the pixels, so a Mini's small version gets the rim
    at its own size."""
    road.rim(getattr(g, "g", g), road.LIT)
    return g


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
    """10x10: the plum rim, a white ring that carries Woof Way, a red face and a white X."""
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


# ---------- the fulfilment moment ----------

MW = 48
# The round bubble's centre and resting radius in the 48x48 frame; the icon sits in its middle.
MCX, MCY, MR = 24, 16, 12


def round_bubble(g, r, cx=MCX, cy=MCY):
    """A round cream bubble with the plum rim and a tan lip on its lower right, a glint top left."""
    g.ell(cx, cy, r + 1, r + 1, "plum")
    g.ell(cx, cy, r, r, "tan")
    g.ell(cx - 0.6, cy - 0.6, r - 0.8, r - 0.8, "cream")
    g.p(cx - r * 0.55, cy - r * 0.6, "white")
    g.p(cx - r * 0.55 + 1, cy - r * 0.6, "white")


def paste(g, px, x0, y0):
    for y, row in enumerate(px):
        for x, c in enumerate(row):
            if c:
                g.p(x0 + x, y0 + y, c)


def need_met(need, step):
    """The bubble pops up with the icon in it, overshoots and settles; hearts rise from either side and
    sparkles twinkle round it; then it bursts into droplets while the icon hangs a beat and the hearts
    drift up."""
    g = Grid(MW, MW)
    art = ICONS[need]().outlined()
    if step == 0:
        piece(g, lambda p: star4(p, MCX, MCY + 6, 3, "yellow"), size=MW)
        piece(g, lambda p: round_bubble(p, 4, MCX, MCY + 6), size=MW)
        return g
    if step < 4:
        r = (0, 14, 12, 12)[step]
        sub = Grid(MW, MW)
        round_bubble(sub, r)
        paste(sub, art, MCX - 8, MCY - 8)
        layer(g, sub)
    elif step == 4:
        # the burst: a white star ring where the rim was, the icon still hanging in the middle
        piece(g, lambda p: [burst(p, MCX, MCY, 15, 11, 10, "white", 9), p.ell(MCX, MCY, 10.5, 10.5, None)],
              size=MW)
        paste(g, art, MCX - 8, MCY - 9)
    else:
        for k in range(8):
            a = math.radians(k * 45 + 20)
            x, y = round(MCX + math.cos(a) * 15), round(MCY + math.sin(a) * 14)
            piece(g, lambda p: p.rect(x, y, 2 if k % 2 else 1, 2 if k % 2 else 1, "white"), size=MW)
    # hearts rise from both sides of the bubble from frame 2
    for i, (x0, delay) in enumerate(((6, 0), (36, 1))):
        t = step - 2 - delay
        if t < 0:
            continue
        y = 26 - t * 5
        piece(g, lambda p: stamp(p, SMALL if t == 0 else HEART, x0 + (1 if t == 0 else 0), y), size=MW)
    # sparkles at three points round the bubble, in turn
    for i, (x, y) in enumerate(((10, 6), (40, 12), (34, 32))):
        t = step - 1 - i
        if 0 <= t < 3:
            piece(g, lambda p: star4(p, x, y, (1, 2, 1)[t], ("white", "yellow", "white")[t]), size=MW)
    return g


# ---------- the accident ----------

# A small pile seen from the low camera, three tiers and a curl on top: B brown, D dbrown, T tan.
PILE = ["...TB....", "..TBBD...", "...BD....", ".TBBBBD..", "TBBBBBBD.", "DDDDDDDD."]
PILE_SMALL = ["..TB..", ".TBBD.", "DDDDD."]


def accident(step):
    """Laid over the dog's own frame: a "!" pops up at the head's right, then two pink blush strokes on
    each side of the head and a sweat drop slide in and stay, and a small pile plops out behind the right hind paw."""
    g = Grid(32, 32)
    if step in (0, 1, 2, 3):
        def mark(p):
            h = (3, 5, 5, 4)[step]
            p.rect(27, 7 - h, 2, h, "red")
            p.rect(27, 8, 2, 2, "red")
            p.p(27, 7 - h, "pink")
        piece(g, mark, size=32)
    if step >= 1:
        lift = 1 if step in (2, 4) else 0
        for x0 in (3, 21):
            piece(g, lambda p: [p.p(x0 + d + k, 12 + lift - k, "pink") for d in (0, 3) for k in range(2)], size=32)
    if step >= 2:
        slide = min(step - 2, 2)
        piece(g, lambda p: bitmap(p, 5, 2 + slide, [".c.", "cwc", "ccs", ".s."],
                                  {"c": "cyan", "w": "white", "s": "sky"}), "navy", size=32)
    if step >= 3:
        rows = PILE_SMALL if step == 3 else PILE
        piece(g, lambda p: bitmap(p, 21, 30 - len(rows), rows, {"B": "brown", "D": "dbrown", "T": "tan"}),
              size=32)
    return g


def accident_spot(fly):
    """16x16 ground decal: the pile left on the road, no outline. brown carries Woof Way with its tan lit
    edge, the dbrown base the light roads. A fly circles it: ink with a white wing."""
    g = Grid(16, 16)
    bitmap(g, 3, 9, PILE, {"B": "brown", "D": "dbrown", "T": "tan"})
    g.rect(2, 14, 11, 1, "dbrown")
    x, y = ((12, 6), (5, 5))[fly]
    g.p(x, y, "ink")
    g.p(x, y - 1, "white")
    return g


# ---------- need spots on the road ----------

def tree(rustle=0, leaf=None):
    """A street tree on a grass patch: a clumped canopy, dgreen lit green at the top left with forest in the
    lower right, on a brown trunk standing in a mound of grass. rustle shifts the right-hand clumps 1px in
    the wind; leaf drops a single leaf at that height beside the trunk."""
    g = edged(Grid(32, 48))
    # the grass patch at the foot, blades poking up out of it
    g.ell(16, 43.5, 12, 3.5, "dgreen", "forest", "green")
    for x, h in ((5, 2), (7, 3), (10, 2), (20, 2), (23, 3), (26, 2)):
        g.rect(x, 41 - h, 1, h, "green")
    # the trunk, flaring at the root, lit on the left
    g.rect(13, 24, 6, 18, "brown")
    g.rect(17, 24, 2, 18, "dbrown")
    g.rect(13, 24, 1, 18, "tan")
    g.rect(11, 39, 10, 3, "brown")
    g.rect(18, 39, 3, 3, "dbrown")
    g.rect(14, 30, 2, 2, "dbrown")
    # the canopy: overlapping clumps, the right-hand ones swaying with the rustle
    for cx, cy, r, sway in ((16, 13, 10, 0), (8, 17, 6.5, 0), (24, 17, 6.5, 1), (11, 8, 6, 0), (21, 8, 6, 1),
                            (16, 21, 7, 0), (16, 5, 5, 0)):
        g.ell(cx + sway * rustle, cy, r, r * 0.9, "dgreen", "forest", "green")
    for cx, cy, sway in ((10, 9, 0), (16, 5, 0), (20, 10, 1), (7, 16, 0), (14, 15, 0), (23, 16, 1)):
        g.ell(cx + sway * rustle, cy, 2, 1.6, "green")
    if leaf is not None:
        bitmap(g, 22, leaf, ["..g", ".gG", "gG."], {"g": "green", "G": "dgreen"})
    return lit(g)


TREE_IDLE = ((dict(), dict(rustle=1), dict(), dict(leaf=32)), 450)
STRANGER_IDLE = (tuple(dict(bob=bb) for bb in road.BREATH), road.BREATH_MS)
STRANGER_WAVE = ((dict(), dict(wave=1)), 300)


def stranger_top(wave):
    """The friendly stranger: curly ginger hair, freckles and a wide smile, a green hoodie with a pink
    heart on the chest and the right hand up in a wave, fingers spread. wave shifts the raised hand that
    many pixels."""
    def top(g, b):
        g.rect(9, 21 + b, 14, 13, "green")
        g.rect(20, 21 + b, 3, 13, "dgreen")
        g.rect(9, 32 + b, 14, 2, "dgreen")
        g.rect(14, 21 + b, 4, 2, "dgreen")
        bitmap(g, 12, 25 + b, [".11.11.", "1211111", "1111113", ".11113.", "..113..", "...1..."],
               {"1": "pink", "2": "white", "3": "mauve"})
        g.rect(5, 22 + b, 4, 9, "green")
        g.rect(8, 22 + b, 1, 9, "dgreen")
        g.rect(5, 31 + b, 4, 3, "skin1")
        # the raised arm, its hand open with the fingers apart, tipping 1px with the wave
        w = wave
        g.rect(23, 17 + b, 4, 5, "green")
        g.rect(24, 12 + b, 4, 6, "green")
        g.rect(27, 12 + b, 1, 6, "dgreen")
        g.rect(26, 17 + b, 1, 5, "dgreen")
        g.rect(24 + w, 7 + b, 4, 5, "skin1")
        g.rect(27 + w, 7 + b, 1, 5, "skin2")
        for x in (24, 26):
            g.rect(x + w, 4 + b, 1, 3, "skin1")
        g.rect(28 + w, 5 + b, 1, 2, "skin2")
        g.ell(16, 12.5 + b, 8, 8, "skin1", "skin2")
        # curly ginger hair: a round crop with bumps along its top and sides
        g.ell(16, 7 + b, 8.5, 4.5, "orange", "ochre", "amber")
        for x, y in ((9, 5), (12, 3), (16, 2.5), (20, 3), (23, 5), (8, 9)):
            g.ell(x, y + b, 2, 2, "orange", "ochre", "amber")
        g.p(12, 6 + b, "rust")
        g.p(17, 5 + b, "rust")
        g.p(21, 7 + b, "rust")
        face_front_open(g, 16, 13 + b)
        for x, y in ((10, 16), (12, 17), (20, 16), (22, 17)):
            g.p(x, y + b, "skin2")
    return top


def face_front_open(g, cx, y):
    """road.face_front's eyes over a wide open smile with a pink tongue."""
    road.face_front(g, cx, y, "neutral")
    g.rect(cx - 2, y + 4, 4, 2, "dbrown")
    g.p(cx - 3, y + 3, "dbrown")
    g.p(cx + 2, y + 3, "dbrown")
    g.rect(cx - 1, y + 5, 2, 1, "pink")


def stranger(wave=0, bob=0):
    """road.dressed, with the lit rim applied where a Mini keeps its pixels."""
    return lit(edged(road.person(stranger_top(wave), legs="blue", shoes="white", bob=bob)))


def lamp_post(glint=False):
    """A street lamp: a flared foot, a navy post lit grey down its left, a collar halfway up and a lantern
    with amber glass under a peaked cap. glint runs a white sheen down the glass."""
    g = edged(Grid(32, 48))
    # foot and post
    g.rect(11, 44, 10, 3, "navy")
    g.rect(12, 42, 8, 2, "navy")
    g.rect(13, 39, 6, 3, "navy")
    g.rect(14, 14, 4, 26, "navy")
    g.rect(14, 14, 1, 26, "slate")
    g.rect(12, 27, 8, 2, "navy")
    g.rect(12, 27, 8, 1, "dslate")
    # the lantern: a bottom plate, the amber glass between navy bars, a peaked cap with a finial
    g.rect(11, 12, 10, 2, "navy")
    g.rect(11, 5, 10, 7, "amber")
    g.rect(11, 5, 10, 1, "yellow")
    g.rect(18, 6, 2, 6, "orange")
    for x in (11, 15, 20):
        g.rect(x, 5, 1, 7, "navy")
    g.tri((8.5, 5.5), (23.5, 5.5), (16, 0.5), "navy")
    g.rect(9, 4, 14, 1, "navy")
    g.p(15, 0, "navy")
    g.p(16, 0, "navy")
    if glint:
        for y in range(6, 11):
            g.p(13 - (y - 6) // 3, y, "white")
            g.p(17, y, "white")
    else:
        g.p(12, 6, "white")
        g.rect(16, 6, 1, 2, "yellow")
    # a tuft at the foot, where the dogs sniff
    for x, h in ((8, 3), (9, 2), (22, 2), (23, 3)):
        g.rect(x, 47 - h, 1, h, "green")
    return lit(g)


def water_bowl(drip=0):
    """A red dog bowl under a tap: a slate standpipe with a brass spout and a red wheel, the bowl wider at
    its foot with cyan water across its top and a white bone on its side. drip: 0 a bead at the spout,
    1 the bead stretched to fall, 2 the drop halfway down, 3 a ring on the water."""
    g = edged(Grid())
    g.rect(5, 6, 4, 23, "grey")
    g.rect(5, 6, 1, 23, "lgrey")
    g.rect(8, 6, 1, 23, "slate")
    g.rect(4, 27, 6, 2, "slate")
    g.rect(9, 8, 5, 2, "amber")
    g.rect(9, 8, 5, 1, "yellow")
    g.rect(12, 10, 2, 1, "orange")
    g.rect(5, 4, 4, 2, "red")
    g.rect(6, 3, 2, 1, "red")
    # the bowl
    g.rect(14, 21, 14, 1, "cyan")
    g.rect(13, 22, 16, 1, "red")
    g.rect(12, 23, 18, 5, "red")
    g.rect(12, 23, 1, 5, "pink")
    g.rect(27, 23, 3, 5, "dred")
    g.rect(13, 22, 16, 1, "pink")
    g.rect(15, 21, 3, 1, "white")
    # the bone turns to noise when redrawn small, so only the full-size bowl wears it
    if not hasattr(g, "s"):
        bitmap(g, 17, 24, ["ww...ww", ".wwwww.", "ww...ww"], {"w": "white"})
    if drip == 0:
        g.p(12, 11, "cyan")
    elif drip == 1:
        g.rect(12, 11, 1, 2, "cyan")
    elif drip == 2:
        g.rect(12, 15, 1, 2, "cyan")
        g.p(12, 15, "white")
    else:
        g.rect(14, 21, 3, 1, "white")
        g.p(19, 21, "white")
    return lit(g)


BOWL_IDLE = ((0, 1, 2, 3), 350)


def shrunk(module, s, draw, q):
    """draw(**q) at scale s on a Mini. Motion offsets are full-size pixels, so they are divided by s to stay
    1px in the small version."""
    return small(module, s, lambda: draw(**{k: v / s if k in MOTION else v for k, v in q.items()}))


# The pose arguments that move a whole part by pixels.
MOTION = ("rustle", "wave", "bob")
# Each spot's drawing function, the module whose Grid it draws on, and its tags as (tag, poses, ms).
SPOTS = {
    "spot-tree": (tree, None, (("idle",) + TREE_IDLE,)),
    "spot-stranger": (stranger, road, (("idle",) + STRANGER_IDLE, ("wave",) + STRANGER_WAVE)),
    "spot-lamp-post": (lamp_post, None, (("idle", (dict(), dict(glint=True)), 500),)),
    "spot-water-bowl": (water_bowl, None, (("idle", tuple(dict(drip=d) for d in BOWL_IDLE[0]), BOWL_IDLE[1]),)),
}


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
    yield "fx-need-met", [(need, [need_met(need, i).outlined(False) for i in range(6)], 70) for need in NEEDS]
    yield "fx-accident", [("play", [accident(i).outlined(False) for i in range(6)], 100)]
    yield "accident-spot", [("idle", [accident_spot(f).outlined(False) for f in (0, 1)], 500)]
    for key, (draw, module, tags) in SPOTS.items():
        yield key, [(tag, [draw(**q).outlined() for q in poses], ms) for tag, poses, ms in tags]
        for suffix, s in STEPS:
            mod = module or sys.modules[__name__]
            yield f"{key}@{suffix}", [(tag, [shrunk(mod, s, draw, q).outlined() for q in poses], ms)
                                      for tag, poses, ms in tags]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/needs", __doc__, grounds=GROUNDS)
