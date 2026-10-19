#!/usr/bin/env python3
"""Draw the choice card frame and compose the card illustrations.

- card-frame: an 83x140 sprite, one frame per card type (tags encounter, lucky,
  stop, upgrade). The game draws the title in the band, the effect text in the
  body and the cost in the badge. Layout, in card pixels:
    band 2..12 (title), art window 4,15 to 79,72 (illustration at 5,16, 75x56),
    body 6..77 x 76..118, badge 6,121, 71x13.
- card-frame-large: a 166x280 sprite with the same tags, for the tap-to-enlarge
  view: the same layout doubled with 1px detail. Band 4..22 (title in font-title
  x2, caps from row 9), art window 8,30, 154x116 (illustration at 2x at 10,32),
  body 12..154 x 152..234, badge 12,242, 142x26.
- card-cost: a 71x13 image, the cost plaque laid over the badge (at 2x on the
  large frame); the game writes the cost between its rivets.
- card-<encounter>-<option>, card-<upgrade> and card-skip: 75x56
  illustrations, one per option, composed from the exported sprites. Build
  the sprites first.

Usage:
  cards.py preview OUT.png   every illustration in a card, then the enlarged
                             frames, scaled up
  cards.py build             write art/cards/*.aseprite, the frames to
                             public/art/sprites/ and the illustrations and cost
                             plaque to public/art/images/, and list them in the
                             manifest

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import json
import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import help as hp  # noqa: E402
import road  # noqa: E402
from ui import to_image  # noqa: E402
from pixel import Grid, build as build_sprites  # noqa: E402

CW, CH = 83, 140
AW, AH = 75, 56
# Band colours hold white labels at 7:1 or more; the amber stop band takes plum labels (7.35:1).
BANDS = {"encounter": ("dred", "plum"), "lucky": ("blue", "navy"), "stop": ("amber", "orange"), "upgrade": ("forest", "teal")}


# ---------- the frame ----------

def card_frame(kind):
    g = Grid(CW, CH)
    band, band_sh = BANDS[kind]
    g.rect(1, 0, CW - 2, CH, "plum")
    g.rect(0, 1, CW, CH - 2, "plum")
    g.rect(2, 2, CW - 4, CH - 4, "cream")
    g.rect(2, CH - 3, CW - 4, 1, "tan")
    g.rect(2, 2, CW - 4, 11, band)
    g.rect(2, 12, CW - 4, 1, band_sh)
    # recessed art window
    g.rect(4, 15, AW + 2, AH + 2, "brown")
    g.rect(4, 15, AW + 2, 1, "dbrown")
    g.rect(5, 16, AW, AH, "tan")
    # divider between the effect text and the badge
    for x in range(8, CW - 8, 3):
        g.p(x, 118, "tan")
    g.rect(6, 121, 71, 13, "plum")
    g.rect(6, 121, 71, 1, "dbrown")
    # corner studs
    for x, y in ((3, 3), (CW - 4, 3), (3, CH - 4), (CW - 4, CH - 4)):
        g.p(x, y, "white" if y < 10 else "tan")
    return g


LW, LH = 2 * CW, 2 * CH


def card_frame_large(kind):
    """The tap-to-enlarge card: the card-frame layout at twice the size with 1px detail, so the
    illustration shows at 2x and the body has room for the modifiers behind the numbers."""
    g = Grid(LW, LH)
    band, band_sh = BANDS[kind]
    g.rect(2, 0, LW - 4, LH, "plum")
    g.rect(1, 1, LW - 2, LH - 2, "plum")
    g.rect(0, 2, LW, LH - 4, "plum")
    g.rect(3, 3, LW - 6, LH - 6, "dbrown")
    g.rect(4, 4, LW - 8, LH - 8, "cream")
    g.rect(4, LH - 6, LW - 8, 2, "tan")
    g.rect(4, 4, LW - 8, 21, band)
    g.rect(4, 23, LW - 8, 2, band_sh)
    # recessed art window, the illustration at 2x
    g.rect(8, 30, 2 * AW + 4, 2 * AH + 4, "brown")
    g.rect(8, 30, 2 * AW + 4, 2, "dbrown")
    g.rect(10, 32, 2 * AW, 2 * AH, "tan")
    for x in range(16, LW - 16, 6):
        g.rect(x, 236, 3, 1, "tan")
    g.rect(12, 242, 142, 26, "plum")
    g.rect(12, 242, 142, 2, "dbrown")
    for x, y in ((6, 6), (LW - 8, 6), (6, LH - 8), (LW - 8, LH - 8)):
        g.rect(x, y, 2, 2, "white" if y < 20 else "tan")
    return g


def card_cost():
    """71x13: the cost plaque, laid over the frame's badge socket at 6,121 (12,242 at 2x on the
    large frame). Rounded ends, a dark brown bevel on top and brass rivets at both ends; the
    game writes the cost ($, $$$, the heart change, Free or Need $...) centred in font-title,
    cream, in the 63px between the rivets."""
    g = Grid(71, 13)
    g.rect(1, 0, 69, 13, "plum")
    g.rect(0, 1, 71, 11, "plum")
    g.rect(2, 1, 67, 1, "dbrown")
    g.rect(2, 11, 67, 1, "ink")
    for x in (2, 67):
        g.rect(x, 5, 2, 2, "amber")
        g.p(x, 5, "yellow")
        g.p(x + 1, 6, "orange")
    return g


# ---------- illustration helpers ----------

class Art(hp.Scene):
    def __init__(self):
        super().__init__(AW, AH)

    def ground(self, zone, x0=100):
        _, self.shade, self.leash_col = hp.ZONES[zone]
        tile = hp.TILES[zone].crop((x0, 0, x0 + AW, 64))
        self.img.paste(tile, (0, -4))

    def grass(self):
        self.fill(0, 0, AW, AH, "green")
        for i in range(30):
            self.fill((i * 23) % AW, (i * 17) % AH, 1, 2, "dgreen")
        self.shade = "dgreen"

    def tiles_bg(self, col="lgrey", line="grey"):
        self.fill(0, 0, AW, AH, col)
        for x in range(0, AW, 8):
            self.fill(x, 0, 1, AH, line)
        for y in range(0, AH, 8):
            self.fill(0, y, AW, 1, line)

    def put(self, key, tag, cx, foot, i=0, flip=False, shadow=True):
        self.feet(key, tag, cx, foot, i, flip, shadow)

    def stink(self, x, y, n=3):
        for k in range(n):
            for j in range(7):
                self.fill(x + k * 6 + (0 if (j % 4) < 2 else 1), y + j, 1, 1, "green" if j % 3 else "dgreen")

    def drops(self, pts, col="cyan"):
        for x, y in pts:
            self.fill(x, y, 1, 2, col)

    def sparkle(self, x, y, col="white"):
        for dx, dy in ((0, -2), (0, 2), (-2, 0), (2, 0), (0, 0)):
            self.fill(x + dx, y + dy, 1, 1, col)

    def hearts(self, pts):
        for x, y in pts:
            self.heart(x, y, "red", "pink")

    def coins(self, pts, i=0):
        for k, (x, y) in enumerate(pts):
            self.paste(hp.frame("tip", "idle", i + k), x, y)

    def face(self, key, mood, x, y):
        self.fill(x - 1, y - 1, 34, 34, "plum")
        self.fill(x, y, 32, 32, "tan")
        self.paste(hp.frame(key, mood), x, y)

    def leash(self, x0, y0, x1, y1):
        self.line(x0, y0, x1, y1, self.leash_col)

    def lead(self, x, y, x1, n=1):
        """A leash from the collar at x,y off the bottom edge at x1. Cards show no walker, since
        the player picks one of four: the leash running out of frame stands for them."""
        for d in range(n):
            self.line(x + d, y, x1 + d, AH, self.leash_col)

    def arrow(self, x, y, d, col="green"):
        """A 9x9 arrow, up (d=-1) or down (d=1): upgrade art shows a change by direction, not a
        number, so it never goes stale against tuning.ts."""
        self.paste(pixmap(ARROW if d < 0 else ARROW[::-1], {"a": col}), x, y)


def pixmap(rows, colours):
    """A small drawn sprite from a character map, with the coloured outline (pixel.Grid)."""
    g = Grid(max(map(len, rows)) + 2, len(rows) + 2)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in colours:
                g.p(x + 1, y + 1, colours[ch])
    return to_image(g.outlined())


ARROW = ["...a...", "..aaa..", ".aaaaa.", "aaaaaaa", "..aaa..", "..aaa..", "..aaa.."]


# ---------- encounters ----------

def skunk_grooming():
    a = Art()
    a.tiles_bg()
    a.put("dog-biscuit", "walk", 37, 42, shadow=False)
    a.fill(14, 34, 47, 3, "white")
    a.fill(16, 37, 43, 14, "white")
    a.fill(56, 37, 3, 14, "lgrey")
    a.fill(16, 50, 43, 1, "grey")
    a.fill(20, 51, 3, 3, "grey")
    a.fill(52, 51, 3, 3, "grey")
    for x, y in ((18, 28), (24, 24), (52, 26), (58, 20), (30, 18), (46, 16)):
        a.fill(x, y, 3, 3, "white")
        a.fill(x + 1, y + 1, 1, 1, "cyan")
    return a


def skunk_rinse():
    a = Art()
    a.grass()
    a.put("dog-biscuit", "walk", 44, 50, 1)
    a.fill(0, 10, 16, 2, "dgreen")
    a.fill(16, 9, 3, 4, "grey")
    a.drops([(20 + k * 2, 11 + k + (k % 2)) for k in range(10)])
    a.stink(50, 8)
    return a


def skunk_ignore():
    a = Art()
    a.ground("street")
    a.put("skunk", "idle", 18, 44)
    a.stink(30, 6, 2)
    a.put("dog-koda", "walk", 54, 40, 2)
    a.stink(46, 4, 2)
    return a


def squirrel_hold():
    a = Art()
    a.ground("park")
    a.put("squirrel", "idle", 62, 24)
    a.put("dog-koda", "pull", 34, 42)
    # held back: the leash runs taut out of frame, behind the lunge
    a.lead(34, 28, 18)
    return a


def squirrel_chase():
    a = Art()
    a.ground("park")
    a.put("squirrel", "run", 60, 22, 1)
    a.put("dog-koda", "pull", 40, 40, 1)
    a.coins([(10, 34), (18, 42), (6, 44)])
    a.sparkle(26, 34, "yellow")
    return a


def small_puddle(f=0):
    """Cards show a 32x16 puddle; the road's is two lanes wide."""
    return to_image(road.puddle(f, 32, 16).outlined(False))


def puddle_through():
    a = Art()
    a.ground("street")
    a.paste(small_puddle(), 22, 30)
    a.put("dog-duchess", "react", 38, 44, shadow=False)
    a.drops([(26, 26), (30, 22), (48, 24), (52, 28), (44, 20)])
    return a


def puddle_towel():
    a = Art()
    a.ground("homeStretch")
    a.put("dog-duchess", "walk", 37, 48)
    a.fill(26, 26, 22, 9, "pink")
    for x in range(26, 48, 4):
        a.fill(x, 26, 2, 9, "white")
    a.fill(26, 34, 22, 1, "mauve")
    return a


def other_dog_sniff():
    a = Art()
    a.ground("park")
    a.put("other-dog", "walk", 38, 30)
    a.put("dog-biscuit", "walk", 38, 54)
    a.hearts([(24, 6), (46, 4)])
    return a


def other_dog_pull_away():
    a = Art()
    a.ground("park")
    a.put("other-dog", "walk", 54, 30)
    a.put("dog-biscuit", "pull", 24, 46, flip=True)
    a.lead(24, 31, 8)
    a.fill(59, 4, 2, 5, "red")
    a.fill(59, 10, 2, 2, "red")
    return a


def thief_chase():
    a = Art()
    a.ground("street")
    a.put("thief", "flee", 54, 46, 1)
    a.put("dog-koda", "react", 24, 52)
    a.fill(30, 12, 2, 5, "red")
    a.fill(30, 18, 2, 2, "red")
    return a


def thief_let_go():
    a = Art()
    a.ground("street")
    a.put("thief", "walk", 50, 52)
    a.coins([(10, 40), (20, 46)], 1)
    a.bubble(4, 8, 24, ["-$$"], "dred")
    return a


# ---------- lucky encounters ----------

def wallet_return():
    a = Art()
    a.ground("homeStretch")
    a.paste(hp.frame("lost-wallet", "idle", 1), 30, 22)
    a.hearts([(14, 8), (52, 10), (24, 40), (48, 38)])
    return a


def wallet_keep():
    a = Art()
    a.ground("homeStretch")
    a.paste(hp.frame("lost-wallet", "idle", 1), 12, 24)
    a.coins([(28, 30), (34, 22), (40, 32)])
    a.face("face-owner-zippy", "upset", 41, 12)
    return a


def neighbour_take():
    a = Art()
    a.grass()
    a.put("biscuit-neighbour", "wave", 24, 54)
    for x, y in ((46, 20), (56, 30), (50, 40)):
        a.paste(hp.frame("treat", "idle"), x, y)
    return a


def photo_pose():
    a = Art()
    a.ground("shops")
    a.put("photo-op", "flash", 54, 52)
    a.put("dog-duchess", "react", 20, 46, shadow=False)
    a.sparkle(10, 10, "yellow")
    a.sparkle(30, 6, "white")
    return a


# ---------- forced stops ----------

def clock(a, x, y):
    for dx in range(-4, 5):
        for dy in range(-4, 5):
            d = dx * dx + dy * dy
            if d <= 16:
                a.fill(x + dx, y + dy, 1, 1, "white" if d < 12 else "plum")
    a.fill(x, y - 3, 1, 4, "plum")
    a.fill(x, y, 3, 1, "plum")


def stop_wait():
    a = Art()
    a.ground("street")
    a.put("stop-sign", "idle", 58, 52, shadow=False)
    a.put("dog-biscuit", "idle", 32, 48)
    a.lead(32, 33, 30)
    clock(a, 12, 12)
    return a


def stop_dart():
    a = Art()
    a.ground("street")
    a.put("stop-sign", "idle", 62, 52, shadow=False)
    a.put("dog-koda", "pull", 36, 38, 1)
    # the leash trails out of frame, speed lines behind the dash
    a.lead(36, 24, 18)
    for x, y in ((8, 18), (4, 26), (10, 34)):
        a.fill(x, y, 10, 1, "lgrey")
    return a


def chatty_chat():
    a = Art()
    a.grass()
    a.put("chatty-neighbour", "wave", 50, 54)
    # the dog waits out the chat; the neighbour talks to the walker out of frame
    a.put("dog-biscuit", "idle", 18, 54)
    a.lead(18, 39, 14)
    a.bubble(14, 2, 22, ["..."])
    # the tip, edge-on as it is handed over
    a.coins([(26, 26)], 1)
    return a


def chatty_move_on():
    a = Art()
    a.grass()
    a.put("chatty-neighbour", "wave", 58, 54, 1)
    a.put("dog-biscuit", "walk", 26, 40, 2)
    a.lead(26, 25, 20)
    return a


def kid_pet():
    a = Art()
    a.grass()
    a.put("kid", "wave", 52, 54)
    a.put("dog-duchess", "react", 30, 50)
    a.hearts([(18, 6), (36, 10)])
    return a


def kid_decline():
    a = Art()
    a.grass()
    a.put("kid", "sad", 56, 54)
    a.put("dog-duchess", "walk", 26, 40, 1)
    a.lead(26, 26, 18)
    return a


# A pup cup: a scoop (f, highlight h) on a striped paper cup that narrows to its base.
CUP = ["..fff..", ".fhfff.", "fffffff", "WWWWWWW", ".RWRWR.", ".RWRWR.", "..WWW.."]


def truck_cups():
    a = Art()
    a.ground("shops")
    a.paste(hp.frame("ice-cream-truck", "idle"), 32, -4)
    a.put("dog-biscuit", "react", 14, 52)
    for x, (f, h) in zip((34, 47, 60), (("pink", "white"), ("cream", "white"), ("brown", "tan"))):
        a.shadow(x + 4, 55, 9)
        a.paste(pixmap(CUP, {"f": f, "h": h, "W": "white", "R": "red"}), x, 45)
    a.hearts([(4, 4)])
    return a


def truck_walk_past():
    a = Art()
    a.ground("shops")
    a.paste(hp.frame("ice-cream-truck", "idle", 1), 30, 2)
    a.put("dog-biscuit", "pull", 18, 44)
    # held back from the truck: the leash runs taut out of frame
    a.lead(18, 29, 6)
    a.fill(30, 30, 2, 5, "red")
    a.fill(30, 36, 2, 2, "red")
    return a


def detour_long_way():
    a = Art()
    a.ground("street")
    a.paste(hp.frame("construction", "idle"), 10, 4)
    for x, y in ((8, 52), (6, 46), (4, 40), (4, 34), (6, 28), (10, 24), (66, 52), (70, 46), (72, 40), (72, 34), (70, 28), (66, 24)):
        a.fill(x, y, 2, 2, "amber")
    a.put("dog-koda", "walk", 38, 52, 2)
    a.lead(38, 38, 38)
    clock(a, 66, 8)
    return a


def detour_squeeze():
    a = Art()
    a.ground("street")
    a.paste(hp.frame("construction", "idle", 1), 10, 4)
    a.put("dog-duchess", "walk", 37, 46, 3)
    for x, y in ((24, 30), (48, 28), (28, 40), (50, 40), (40, 26)):
        a.fill(x, y, 4, 3, "lgrey")
        a.fill(x + 1, y - 1, 2, 1, "grey")
    return a


def mail_hold():
    a = Art()
    a.ground("homeStretch")
    a.put("mail-carrier", "walk", 58, 54)
    a.put("dog-koda", "react", 30, 40)
    a.lead(30, 24, 16)
    a.paste(hp.frame("fx-bark", "pop", 1), 36, 2)
    return a


def mail_wait():
    a = Art()
    a.ground("homeStretch")
    a.put("mail-carrier", "walk", 56, 54, 1)
    a.put("dog-koda", "idle", 28, 44)
    a.lead(28, 30, 26)
    clock(a, 10, 10)
    return a


# ---------- upgrades and the Skip option ----------

def disc(a, cx, cy, r, col, edge=None):
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            d = dx * dx + dy * dy
            if d <= r * r:
                a.fill(cx + dx, cy + dy, 1, 1, edge if edge and d > (r - 1) * (r - 1) else col)


def rolled_over():
    """Biscuit rolled onto its back: the body lies along the grass with the navy saddle down
    and the white belly up, four white legs in the air with curled paws, the white-tipped tail
    wagging at the left, and the head at the right turned to the viewer, eyes shut in bliss and
    tongue out, its ears flopped on the grass. 46x34 with its outline; the collar's lower end
    is at 33,27."""
    g = Grid(46, 34)
    # tail, wagging up from the rump, white tipped
    for i, (x, y) in enumerate(((7, 19), (6, 18), (5, 16), (5, 15), (5, 14))):
        g.rect(x, y, 2, 2, "white" if i > 2 else "ochre")
    # legs in the air: hind pair at the left, front pair at the right, the far leg of each
    # pair shaded; each paw curls forward
    for x, top, sh in ((10, 7, "lgrey"), (16, 5, "white"), (23, 5, "lgrey"), (29, 7, "white")):
        g.rect(x, top, 2, 13 - top, sh)
        g.rect(x, top - 1, 3, 2, sh)
        g.p(x + 1, top - 1, "pink")
    # the body, back down
    g.ell(20, 19, 13, 6.5, "ochre", "rust")
    g.ell(20, 24.5, 11, 2, "navy")
    g.ell(20.5, 15.5, 9, 3, "white", "lgrey")
    g.p(17, 15, "pink")
    g.p(22, 15, "pink")
    # ears flopped on the grass either side of the head
    g.ell(32, 25, 3, 5, "rust", "dbrown")
    g.ell(42, 25, 3, 5, "rust", "dbrown")
    # the head, facing the viewer
    g.ell(37, 19, 7, 6.5, "ochre", "rust", "tan")
    g.rect(36, 13, 2, 6, "white")
    g.ell(37, 22.5, 3.6, 2.6, "white", "lgrey")
    g.rect(36, 21, 3, 1, "ink")
    # eyes shut, happy arcs
    for x in (32, 39):
        g.p(x, 19, "ink")
        g.rect(x + 1, 18, 2, 1, "ink")
        g.p(x + 3, 19, "ink")
    # tongue lolling out of the side of the mouth
    g.rect(38, 24, 2, 4, "pink")
    g.p(38, 24, "red")
    # collar between the head and the chest
    g.rect(30, 14, 2, 12, "green")
    g.rect(31, 14, 1, 12, "dgreen")
    g.p(31, 25, "amber")
    return to_image(g.outlined())


def belly_rubs():
    a = Art()
    a.grass()
    a.paste(rolled_over(), 14, 12)
    # the leash runs from the collar off the bottom edge
    a.lead(45, 38, 52)
    a.hearts([(6, 8), (20, 4), (50, 2), (64, 10), (4, 40)])
    return a


def good_leash():
    a = Art()
    a.ground("park")
    a.put("squirrel", "idle", 62, 24)
    a.put("dog-koda", "walk", 34, 44, 1)
    a.lead(34, 30, 26, 2)
    a.fill(33, 29, 3, 3, "amber")
    # tick: the chaser ignores the squirrel
    for i, (x, y) in enumerate(((52, 44), (53, 45), (54, 46), (55, 45), (56, 44), (57, 43), (58, 42), (59, 41))):
        a.fill(x, y, 2, 2, "green" if i % 2 else "dgreen")
    return a


def big_tipper():
    a = Art()
    a.ground("shops")
    for k, (x, y) in enumerate(((8, 38), (14, 34), (20, 38), (11, 30), (17, 26), (26, 36), (23, 30))):
        a.paste(hp.frame("tip", "idle", k), x, y)
    a.paste(hp.frame("tip", "idle"), 44, 26)
    a.sparkle(42, 24, "white")
    a.arrow(56, 14, -1)
    return a


def shortcut():
    a = Art()
    a.ground("street")
    for x, y in ((8, 50), (14, 44), (20, 38), (26, 32), (32, 26), (38, 20), (44, 14), (50, 8)):
        a.fill(x, y, 3, 2, "amber")
    a.chevron(56, 8, 1, "amber")
    a.put("dog-biscuit", "walk", 16, 50, 1)
    a.lead(16, 35, 12)
    # the trade-off: a shorter zone, and fewer fees
    a.paste(hp.frame("tip", "idle"), 44, 38)
    a.arrow(60, 40, 1, "red")
    return a


def rush_hour():
    a = Art()
    a.ground("street")
    a.paste(small_puddle(), 2, 38)
    a.put("skunk", "idle", 62, 54)
    a.put("squirrel", "idle", 36, 52)
    a.coins([(8, 4), (22, 10), (40, 4), (50, 16), (30, 22), (14, 22)])
    a.arrow(62, 2, -1)
    return a


def raincoats():
    a = Art()
    a.ground("street")
    a.paste(small_puddle(1), 22, 36)
    a.put("dog-duchess", "walk", 37, 46, shadow=False)
    a.fill(31, 34, 13, 8, "amber")
    a.fill(31, 34, 13, 1, "yellow")
    a.fill(42, 34, 2, 8, "orange")
    a.fill(34, 31, 7, 3, "amber")
    for x, y in ((6, 4), (16, 12), (26, 2), (54, 8), (64, 16), (12, 28), (60, 30), (48, 2)):
        a.fill(x, y, 1, 3, "cyan")
    return a


def treat_magnet():
    a = Art()
    a.ground("park")
    # a horseshoe magnet
    a.fill(46, 14, 6, 22, "red")
    a.fill(60, 14, 6, 22, "red")
    a.fill(46, 30, 20, 6, "red")
    a.fill(46, 30, 20, 1, "pink")
    a.fill(46, 14, 6, 4, "lgrey")
    a.fill(60, 14, 6, 4, "lgrey")
    a.fill(64, 18, 2, 18, "dred")
    for k, (x, y) in enumerate(((6, 18), (20, 28), (10, 40))):
        a.paste(hp.frame("treat", "idle"), x, y)
        for d in range(3):
            a.fill(x + 18 + d * 5, y + 6, 3, 1, "cream")
    return a


def second_wind():
    a = Art()
    a.grass()
    a.face("face-owner-dash", "happy", 21, 12)
    for y, x0 in ((8, 4), (22, 2), (36, 6)):
        a.fill(x0, y, 12, 1, "white")
        a.fill(x0 + 10, y - 1, 3, 1, "white")
        a.fill(x0 + 12, y - 2, 1, 1, "white")
    a.heart(56, 14, "red", "pink")
    a.heart(56, 26, "red", "pink")
    a.arrow(55, 36, -1, "white")
    return a


def sweet_talker():
    a = Art()
    a.grass()
    a.face("face-owner-pierre", "happy", 6, 14)
    # cheaper per dog: the cost in the bubble, and a down arrow beside it
    a.bubble(40, 8, 32, [""])
    hp.text(a, "$$", 45, 12, "forest")
    a.arrow(57, 11, 1)
    a.heart(50, 38, "red", "pink")
    a.heart(60, 44, "red", "pink")
    return a


def skip():
    a = Art()
    a.ground("street")
    a.put("skunk", "idle", 16, 54)
    a.put("dog-biscuit", "walk", 46, 52, 2)
    disc(a, 58, 13, 7, "green", "dgreen")
    disc(a, 58, 13, 2, "forest")
    a.fill(62, 17, 8, 4, "green")
    a.fill(68, 17, 2, 4, "dgreen")
    hp.text(a, "SKIP", 4, 4, "white", 2)
    for y in (40, 44, 48):
        a.fill(28, y, 8, 1, "lgrey")
    return a


ILLUSTRATIONS = {
    "card-skunk-grooming": skunk_grooming,
    "card-skunk-rinse": skunk_rinse,
    "card-skunk-ignore": skunk_ignore,
    "card-squirrel-hold": squirrel_hold,
    "card-squirrel-chase": squirrel_chase,
    "card-puddle-through": puddle_through,
    "card-puddle-towel": puddle_towel,
    "card-other-dog-sniff": other_dog_sniff,
    "card-other-dog-pull-away": other_dog_pull_away,
    "card-thief-chase": thief_chase,
    "card-thief-let-go": thief_let_go,
    "card-lost-wallet-return": wallet_return,
    "card-lost-wallet-keep": wallet_keep,
    "card-biscuit-neighbour-take": neighbour_take,
    "card-photo-op-pose": photo_pose,
    "card-stop-sign-wait": stop_wait,
    "card-stop-sign-dart": stop_dart,
    "card-chatty-neighbour-chat": chatty_chat,
    "card-chatty-neighbour-move-on": chatty_move_on,
    "card-kid-wants-to-pet-pet": kid_pet,
    "card-kid-wants-to-pet-decline": kid_decline,
    "card-ice-cream-truck-pup-cups": truck_cups,
    "card-ice-cream-truck-walk-past": truck_walk_past,
    "card-construction-detour-long-way": detour_long_way,
    "card-construction-detour-squeeze": detour_squeeze,
    "card-mail-carrier-hold": mail_hold,
    "card-mail-carrier-wait": mail_wait,
    "card-belly-rubs": belly_rubs,
    "card-good-leash": good_leash,
    "card-big-tipper": big_tipper,
    "card-shortcut": shortcut,
    "card-rush-hour": rush_hour,
    "card-raincoats": raincoats,
    "card-treat-magnet": treat_magnet,
    "card-second-wind": second_wind,
    "card-sweet-talker": sweet_talker,
    "card-skip": skip,
}


def frame_sprite():
    yield "card-frame", [(kind, [card_frame(kind).outlined(False)], 1000) for kind in BANDS]
    yield "card-frame-large", [(kind, [card_frame_large(kind).outlined(False)], 1000) for kind in BANDS]


def mock_card(kind, key, large=False):
    """A whole card as the game will show it, cost plaque included, for previews."""
    scale = 2 if large else 1
    im = to_image((card_frame_large if large else card_frame)(kind).px)
    cost = to_image(card_cost().px)
    im.paste(cost.resize((cost.width * scale, cost.height * scale), Image.NEAREST), (6 * scale, 121 * scale))
    art = ILLUSTRATIONS[key]().img
    im.paste(art.resize((AW * scale, AH * scale), Image.NEAREST), (5 * scale, 16 * scale))
    bg = Image.new("RGB", im.size, hp.rgb("dbrown"))
    bg.paste(im, (0, 0), im)
    return bg


def preview(out, scale=3):
    """Every illustration in a normal card, then one enlarged card per card type."""
    keys = list(ILLUSTRATIONS)
    kinds = ["encounter"] * 11 + ["lucky"] * 6 + ["stop"] * 12 + ["upgrade"] * 9 + ["encounter"]
    cols = 10
    rows = (len(keys) + cols - 1) // cols
    big = [("encounter", "card-skunk-rinse"), ("lucky", "card-lost-wallet-return"),
           ("stop", "card-kid-wants-to-pet-pet"), ("upgrade", "card-belly-rubs")]
    width = max((CW + 6) * cols, (LW + 6) * len(big))
    sheet = Image.new("RGB", (width * scale, ((CH + 6) * rows + LH + 6) * scale), hp.rgb("ink"))
    for i, (key, kind) in enumerate(zip(keys, kinds)):
        card = mock_card(kind, key).resize((CW * scale, CH * scale), Image.NEAREST)
        sheet.paste(card, ((i % cols) * (CW + 6) * scale, (i // cols) * (CH + 6) * scale))
    for i, (kind, key) in enumerate(big):
        card = mock_card(kind, key, True).resize((LW * scale, LH * scale), Image.NEAREST)
        sheet.paste(card, (i * (LW + 6) * scale, (CH + 6) * rows * scale))
    sheet.save(out)


def build():
    build_sprites(list(frame_sprite()), "art/cards")
    os.makedirs("public/art/images", exist_ok=True)
    for key, draw in ILLUSTRATIONS.items():
        png = f"public/art/images/{key}.png"
        draw().img.save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/cards/{key}.aseprite"], check=True)
    to_image(card_cost().outlined(False)).save("public/art/images/card-cost.png")
    subprocess.run(["aseprite", "-b", "public/art/images/card-cost.png", "--save-as", "art/cards/card-cost.aseprite"],
                   check=True)
    path = "public/art/manifest.json"
    manifest = json.load(open(path))
    entries = {i["key"]: i for i in manifest.get("images", [])}
    for key in [*ILLUSTRATIONS, "card-cost"]:
        entries[key] = {"key": key, "png": f"images/{key}.png"}
    manifest["images"] = sorted(entries.values(), key=lambda i: i["key"])
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print("built", ", ".join([*ILLUSTRATIONS, "card-cost"]))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
