#!/usr/bin/env python3
"""Draw the choice card frame and compose the card illustrations.

- card-frame: an 83x140 sprite, one frame per card type (tags encounter, lucky,
  stop, upgrade, and route for a fork's path cards). The game draws the title
  in the band, the effect text in the body and the cost in the badge. Layout,
  in card pixels:
    band 2..12 (title), art window 4,15 to 79,72 (illustration at 5,16, 75x56),
    body 6..77 x 76..118, badge 6,121, 71x13.
- card-frame-large: a 166x280 sprite with the same tags, for the tap-to-enlarge
  view: the same layout doubled with 1px detail. Band 4..22 (title in font-title
  x2, caps from row 9), art window 8,30, 154x116 (illustration at 2x at 10,32),
  body 12..154 x 152..234, badge 12,242, 142x26.
- card-cost: a 71x13 image, the cost plaque laid over the badge (at 2x on the
  large frame); the game writes the cost between its rivets.
- card-<encounter>-<option>, card-<need card>-<option>, card-<upgrade> and
  card-skip: 75x56 illustrations, one per option, composed from the exported
  sprites. Build the sprites first.
- card-zone-<zone>: 75x56, a fork's path card: the zone's road, sampled from
  its road strip, running to a cross street, with the zone's backdrop scenery
  beyond it in miniature.

Usage:
  cards.py preview OUT.png   every illustration in a card, then the enlarged
                             frames, scaled up
  cards.py build             write art/cards/*.aseprite, the frames to
                             public/art/sprites/ and the illustrations and cost
                             plaque to public/art/images/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import subprocess
import sys
from collections import Counter

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import backdrops as bd  # noqa: E402
import encounters as enc  # noqa: E402
import help as hp  # noqa: E402
import needs  # noqa: E402
import people  # noqa: E402
import road  # noqa: E402
import roads  # noqa: E402
from ui import chrome, to_image  # noqa: E402
from pixel import Grid, build as build_sprites  # noqa: E402

CW, CH = 83, 140
AW, AH = 75, 56
# Band colours hold white labels at 7:1 or more; the amber stop band takes plum labels (7.35:1).
# route goes last, so the frame indices of the older tags stay put.
BANDS = {"encounter": ("dred", "plum"), "lucky": ("blue", "navy"), "stop": ("amber", "orange"),
         "upgrade": ("forest", "teal"), "route": ("purple", "plum")}


# ---------- the frame ----------

def card_frame(kind):
    """ui.py's chrome around the card: the ink and plum lines, the cream face with its tan lip,
    the band in the card type's colour over its shade line, a recessed art window (an ink line
    over its top in shadow, plum on the other sides) and the badge socket."""
    g = chrome(Grid(CW, CH), 0, 0, CW, CH)
    band, band_sh = BANDS[kind]
    g.rect(2, 2, CW - 4, 11, band)
    g.rect(2, 12, CW - 4, 1, band_sh)
    # recessed art window
    g.rect(4, 15, AW + 2, AH + 2, "plum")
    g.rect(4, 15, AW + 2, 1, "ink")
    g.rect(5, 16, AW, AH, "tan")
    # divider between the effect text and the badge
    for x in range(8, CW - 8, 3):
        g.p(x, 118, "tan")
    g.rect(6, 121, 71, 13, "plum")
    g.rect(6, 121, 71, 1, "ink")
    return g


LW, LH = 2 * CW, 2 * CH


def card_frame_large(kind):
    """The tap-to-enlarge card: the card-frame layout at twice the size with 1px detail, so the
    illustration shows at 2x and the body has room for the modifiers behind the numbers. The
    chrome's lines and lip are 2px."""
    g = Grid(LW, LH)
    band, band_sh = BANDS[kind]
    small = chrome(Grid(CW, CH), 0, 0, CW, CH).px
    for y in range(LH):
        for x in range(LW):
            g.px[y][x] = small[y // 2][x // 2]
    g.rect(4, 4, LW - 8, 21, band)
    g.rect(4, 23, LW - 8, 2, band_sh)
    # recessed art window, the illustration at 2x
    g.rect(8, 30, 2 * AW + 4, 2 * AH + 4, "plum")
    g.rect(8, 30, 2 * AW + 4, 2, "ink")
    g.rect(10, 32, 2 * AW, 2 * AH, "tan")
    for x in range(16, LW - 16, 6):
        g.rect(x, 236, 3, 1, "tan")
    g.rect(12, 242, 142, 26, "plum")
    g.rect(12, 242, 142, 2, "ink")
    return g


def card_cost():
    """71x13: the cost plaque, laid over the frame's badge socket at 6,121 (12,242 at 2x on the
    large frame). ui.py's chrome with its corners cut 1px: the cream face is x 2 to 67, rows 2
    to 9, over the tan lip. The game writes the cost ($, $$$, the heart change, Free or Need $...)
    centred in font-title, plum (9.42:1), caps in rows 4 to 8. A disabled card's grey copy turns
    the face lightGrey, where navy holds 8.48:1."""
    return chrome(Grid(71, 13), 0, 0, 71, 13)


# ---------- illustration helpers ----------

class Art(hp.Scene):
    def __init__(self):
        super().__init__(AW, AH)

    def ground(self, zone, x0=122):
        self.shade, self.leash_col = hp.ZONES[zone]["shadow"], hp.ZONES[zone]["leash"]
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
        """key's frame standing on its shadow, its frame's bottom on row foot; returns the row of a dog's
        collar, help.COLLAR over its feet (its last opaque row)."""
        self.feet(key, tag, cx, foot, i, flip, shadow)
        f = hp.frame(key, tag, i)
        return foot - f.height + f.getbbox()[3] - 1 - hp.COLLAR

    def stink(self, x, y, n, col, sh):
        """n wavy stink lines rising from x, y, every third pixel in sh."""
        for k in range(n):
            for j in range(7):
                self.fill(x + k * 6 + (0 if (j % 4) < 2 else 1), y + j, 1, 1, col if j % 3 else sh)

    def skunk_stink(self, x, y, n=3):
        """Stink lines in the skunk's colours (road.CLOUD_INK), as skunk-cloud and fx-status-stinky."""
        self.stink(x, y, n, road.CLOUD_INK["inner"], road.CLOUD_INK["outer"])

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
        number, so it never goes stale against the tuning."""
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
    a.skunk_stink(50, 8)
    return a


def skunk_ignore():
    a = Art()
    a.ground("street")
    a.put("skunk", "idle", 18, 44)
    a.skunk_stink(30, 6, 2)
    a.put("dog-koda", "walk", 54, 40, 2)
    a.skunk_stink(46, 4, 2)
    return a


def squirrel_hold():
    a = Art()
    a.ground("park")
    a.put("squirrel", "idle", 60, 37)
    c = a.put("dog-koda", "pull", 30, 54)
    # held back: the leash runs taut out of frame, behind the lunge
    a.lead(30, c, 14)
    return a


def squirrel_chase():
    a = Art()
    a.ground("park")
    a.put("squirrel", "run", 58, 37, 1)
    a.put("dog-koda", "pull", 38, 56, 1)
    a.coins([(0, 20), (8, 28), (0, 36)])
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
    a.put("other-dog", "walk", 38, 36)
    a.put("dog-biscuit", "walk", 38, 58)
    a.hearts([(24, 6), (46, 4)])
    return a


def other_dog_pull_away():
    a = Art()
    a.ground("park")
    a.put("other-dog", "walk", 56, 36)
    c = a.put("dog-biscuit", "pull", 22, 56, flip=True)
    a.lead(22, c, 6)
    a.fill(59, 4, 2, 5, "red")
    a.fill(59, 10, 2, 2, "red")
    return a


def thief_chase():
    a = Art()
    a.ground("street")
    a.put("thief", "flee", 54, 59, 1)
    a.put("dog-koda", "react", 22, 58)
    a.fill(30, 12, 2, 5, "red")
    a.fill(30, 18, 2, 2, "red")
    return a


def thief_let_go():
    a = Art()
    a.ground("street")
    a.put("thief", "walk", 52, 58)
    a.coins([(8, 30), (18, 36)], 1)
    a.bubble(4, 8, 24, ["-$$"], "dred")
    return a


# ---------- zone encounters ----------
# The encounter drawings from encounters.py at 1x, the 2-lane ones cropped by the card's edges.

def drawn(g):
    return to_image(g.outlined())


def need_met(a, need, x, y):
    """A need fulfilled: its icon in a 20x20 chrome bubble (ui.py) with a sparkle at the corner.
    Only urgent needs pay +♥, so these cards show the icon rather than hearts."""
    a.paste(to_image(chrome(Grid(20, 20), 0, 0, 20, 20).px), x, y)
    a.paste(hp.frame(f"icon-need-{need}", "normal"), x + 2, y + 2)
    a.sparkle(x + 20, y, "yellow")


def coin_arc(a, pts):
    """The dotted path a payment takes, off the bottom edge toward whoever is paid."""
    for x, y in pts:
        a.fill(x, y, 1, 1, "white")


def red_alert(a, x, y):
    a.fill(x, y, 2, 5, "red")
    a.fill(x, y + 6, 2, 2, "red")


def honk(a, x, y):
    """Three short lines fanning left from a beak at x, y."""
    for dy, dx in ((-3, -1), (0, 0), (3, -1)):
        a.fill(x - 4 + dx, y + dy, 3, 1, "white")


def paw_prints(a, pts, col="brown"):
    """5x4 prints: four toes round the pad."""
    for x, y in pts:
        for dx, dy in ((1, 0), (3, 0), (0, 1), (4, 1)):
            a.fill(x + dx, y + dy, 1, 1, col)
        a.fill(x + 1, y + 2, 3, 2, col)


# A sandwich from the side with a bite out of its top right: crust (t), bread (c), lettuce (g),
# tomato (r).
SANDWICH = ["ttttt..", "cccccc.", "ggggggg", "rrrrrrr", "ttttttt"]
# A fresh latte on its saucer: the foam (c) inside the rim (b), the cup (w) and its handle (l).
LATTE = ["bccccb..", "wwwwwwll", "wwwwww.l", "wwwwwwll", ".wwwww..", "llllllll"]
# A water bowl, its rim (b) round the water (c) with a glint (h).
BOWL = [".bbbbbbbb.", "bchccccccb", "bccccccccb", ".bbbbbbbb."]
# A petunia seedling in its pot: the flower (p) with its eye (y), a leaf (g), the pot (r, shade o).
POT = [".ppp.", "ppypp", ".pgp.", "ggg..", "rrrrr", ".rro.", ".rro."]


def sandwich(a, x, y):
    a.paste(pixmap(SANDWICH, {"t": "tan", "c": "cream", "g": "green", "r": "red"}), x, y)


def calm_gardener():
    """The petunias with the gardener soothed: eyes shut in happy arcs and a smile."""
    g = enc.petunias(new=enc.mini(enc.BIG), w=enc.TWO_LANES)
    cx = 66 + enc.TWO_LANES - 88
    for x in (cx - 5, cx + 3):
        g.rect(x, 7, 3, 3, "skin1")
        g.p(x, 9, "ink")
        g.rect(x + 1, 8, 1, 1, "ink")
        g.p(x + 2, 9, "ink")
    g.rect(cx - 1, 12, 3, 2, "skin1")
    g.p(cx - 2, 12, "dbrown")
    g.rect(cx - 1, 13, 3, 1, "dbrown")
    g.p(cx + 2, 12, "dbrown")
    return drawn(g)


def waving_kid_stand():
    """The lemonade stand with the kid's right arm up in a wave, as road.kid(wave=True) holds it."""
    g = enc.lemonade_stand(new=enc.mini(enc.BIG))
    g.rect(22, 21, 3, 10, "yellow")
    g.rect(21, 17, 4, 4, "skin1")
    g.rect(24, 17, 1, 4, "skin2")
    return drawn(g)


def picnic_buy_lunch():
    """Buy a new lunch: the dog keeps its stolen sandwich, the coins go to the picnicker, who
    is happily chewing again."""
    a = Art()
    a.ground("park")
    a.paste(hp.frame("picnic", "idle", 3), -10, 0)
    c = a.put("dog-biscuit", "react", 24, 56)
    a.lead(24, c, 18)
    sandwich(a, 21, 26)
    coin_arc(a, [(70, 54), (69, 50), (67, 46), (64, 43)])
    a.coins([(46, 36), (54, 38)], 1)
    a.sparkle(30, 18, "white")
    return a


def picnic_drop_it():
    """Drop it!: the sandwich on the ground, the dog held back from it, its owner's heart lost."""
    a = Art()
    a.ground("park")
    a.paste(hp.frame("picnic", "idle"), -10, 0)
    c = a.put("dog-biscuit", "idle", 28, 56)
    a.lead(28, c, 22)
    sandwich(a, 42, 40)
    broken_hearts(a, [(58, 38)])
    return a


def goose_back_off():
    """Back off slowly: the goose honking at the dog as it backs away, the clock running."""
    a = Art()
    a.ground("homeStretch")
    a.put("goose", "idle", 54, 40, 1, flip=True)
    honk(a, 38, 15)
    c = a.put("dog-koda", "pull", 22, 56, flip=True)
    a.lead(22, c, 34)
    clock(a, 10, 9)
    return a


def goose_honk_back():
    """Honk back: the dog barking at the goose honking back, hearts lost (two for a chaser)."""
    a = Art()
    a.ground("homeStretch")
    a.put("goose", "idle", 56, 38, 1, flip=True)
    honk(a, 40, 13)
    c = a.put("dog-koda", "react", 24, 57)
    a.lead(24, c, 20)
    a.paste(hp.frame("fx-bark", "pop", 1), 22, 2)
    broken_hearts(a, [(2, 4), (10, 10)])
    return a


def petunias_replant():
    """Replant them: fresh petunias in pots by the bed, the coins to the gardener, now smiling."""
    a = Art()
    a.ground("street")
    a.paste(calm_gardener(), -14, 2)
    for x in (6, 14):
        a.paste(pixmap(POT, {"p": "pink", "y": "yellow", "g": "green", "r": "rust", "o": "dbrown"}), x, 38)
    a.sparkle(30, 14, "white")
    c = a.put("dog-biscuit", "idle", 36, 57)
    a.lead(36, c, 40)
    coin_arc(a, [(64, 54), (63, 50), (62, 46)])
    a.coins([(52, 34), (58, 38)], 2)
    return a


def petunias_nature_calls():
    """Nature calls: the dog at the bed's edge with a puddle behind it, the gardener appalled,
    the need met and its owner's heart lost."""
    a = Art()
    a.ground("street")
    a.paste(hp.frame("petunias", "idle"), -14, 2)
    a.put("dog-biscuit", "idle", 36, 55)
    a.fill(32, 52, 9, 1, "ochre")
    a.fill(31, 53, 11, 2, "yellow")
    a.fill(32, 55, 9, 1, "ochre")
    a.fill(33, 53, 2, 1, "white")
    red_alert(a, 72, 2)
    need_met(a, "regular", 4, 36)
    broken_hearts(a, [(58, 40)])
    return a


def trash_sniff():
    """Sniff it all: the dog's nose in the pizza box, scent rising off it, the need met and the
    clock running."""
    a = Art()
    a.ground("street")
    a.paste(hp.frame("trash-bins", "idle"), -7, 2)
    c = a.put("dog-koda", "idle", 52, 57)
    a.lead(52, c, 58)
    for x, y in ((50, 14), (51, 18)):
        for dx, dy in needs.SCENT:
            a.fill(x + dx, y + dy, 1, 1, "white")
    need_met(a, "nosy", 2, 1)
    clock(a, 68, 8)
    return a


def trash_tidy_up():
    """Tidy up: the bins upright again, the last bag on its way in, the ground swept, the
    coins spent and a fussy owner pleased."""
    a = Art()
    a.ground("street")
    a.put("bin", "idle", 16, 40)
    a.put("bin", "idle", 40, 40)
    for x, y in ((26, 48), (28, 42), (30, 36), (32, 30), (34, 24), (37, 18), (40, 13), (43, 9)):
        a.fill(x, y, 1, 1, "white")
    a.paste(pixmap(BAG, {"e": "pink", "k": "mauve", "f": "pink", "s": "mauve", "h": "white"}), 44, 0)
    a.sparkle(10, 48, "white")
    a.sparkle(30, 52, "yellow")
    c = a.put("dog-koda", "idle", 58, 57)
    a.lead(58, c, 64)
    a.coins([(0, 36)], 1)
    a.hearts([(62, 6)])
    return a


def trash_drag_on():
    """Drag them on: the dog straining toward the pizza, the leash taut back out of frame,
    hearts lost (two for a food-driven dog)."""
    a = Art()
    a.ground("homeStretch")
    a.paste(hp.frame("trash-bins", "idle", 1), -7, 0)
    c = a.put("dog-biscuit", "pull", 42, 56)
    a.lead(42, c, 22)
    broken_hearts(a, [(2, 4), (11, 9)])
    return a


def cafe_charm():
    """Charm the crowd: the dog sat up between the tables, the patrons cooing, the need met and
    the clock running."""
    a = Art()
    a.ground("shops")
    a.paste(hp.frame("cafe-patio", "idle"), -7, 0)
    c = a.put("dog-duchess", "react", 37, 57)
    a.lead(37, c, 44)
    a.hearts([(30, 11), (40, 13)])
    need_met(a, "friendly", 2, 36)
    clock(a, 67, 46)
    return a


def cafe_buy_lattes():
    """Buy new lattes: a tray of fresh ones, the coins spent and a fussy owner pleased."""
    a = Art()
    a.ground("shops")
    a.paste(hp.frame("cafe-patio", "idle", 2), -7, 0)
    a.fill(10, 52, 34, 2, "slate")
    a.fill(10, 52, 34, 1, "lgrey")
    for x in (12, 23, 34):
        a.paste(pixmap(LATTE, {"b": "brown", "c": "cream", "w": "white", "l": "lgrey"}), x, 44)
    a.coins([(2, 36)], 1)
    c = a.put("dog-duchess", "idle", 60, 57)
    a.lead(60, c, 68)
    a.hearts([(46, 40)])
    return a


def cafe_slink_away():
    """Slink away: the dog sloping off, latte paw prints behind it, its owner's heart lost."""
    a = Art()
    a.ground("shops")
    a.paste(hp.frame("cafe-patio", "idle"), -7, 0)
    paw_prints(a, [(16, 42), (24, 47), (32, 43), (40, 48)])
    c = a.put("dog-biscuit", "pull", 58, 57)
    a.lead(58, c, 44)
    broken_hearts(a, [(34, 12)])
    return a


def lemonade_water():
    """Water, please: the dog lapping at a bowl by the stand, coins to the kid and the need met."""
    a = Art()
    a.ground("street")
    a.put("lemonade-stand", "idle", 56, 60)
    c = a.put("dog-nugget", "pull", 16, 57)
    a.lead(16, c, 8)
    a.paste(pixmap(BOWL, {"b": "red", "c": "cyan", "h": "white"}), 26, 40)
    a.drops([(28, 36), (33, 32), (38, 36)])
    a.coins([(24, 14)], 1)
    need_met(a, "thirsty", 2, 1)
    return a


def lemonade_say_hi():
    """Say hi: the kid waving, the dog sat up for a fuss, the need met and the clock running."""
    a = Art()
    a.ground("street")
    a.shadow(56, 55, 40)
    a.paste(waving_kid_stand(), 36, 0)
    c = a.put("dog-duchess", "react", 22, 57)
    a.lead(22, c, 18)
    need_met(a, "friendly", 2, 1)
    clock(a, 30, 10)
    return a


def lemonade_maybe_later():
    a = Art()
    a.ground("street")
    a.put("lemonade-stand", "idle", 56, 60)
    c = a.put("dog-duchess", "walk", 22, 52, 2)
    a.lead(22, c, 16)
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
    a.put("biscuit-neighbour", "wave", 24, 60)
    for x, y in ((46, 20), (56, 30), (50, 40)):
        a.paste(hp.frame("treat", "idle"), x, y)
    return a


def photo_pose():
    a = Art()
    a.ground("shops")
    a.put("photo-op", "flash", 54, 58)
    a.put("dog-duchess", "react", 20, 54, shadow=False)
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
    a.put("stop-sign", "idle", 58, 56, shadow=False)
    c = a.put("dog-biscuit", "idle", 30, 56)
    a.lead(30, c, 28)
    clock(a, 12, 12)
    return a


def stop_dart():
    a = Art()
    a.ground("street")
    a.put("stop-sign", "idle", 62, 56, shadow=False)
    c = a.put("dog-koda", "pull", 34, 48, 1)
    # the leash trails out of frame, speed lines behind the dash
    a.lead(34, c, 18)
    for x, y in ((8, 18), (4, 26), (10, 34)):
        a.fill(x, y, 10, 1, "lgrey")
    return a


def chatty_chat():
    a = Art()
    a.grass()
    a.put("chatty-neighbour", "wave", 52, 58)
    # the dog waits out the chat; the neighbour talks to the walker out of frame
    c = a.put("dog-biscuit", "idle", 18, 57)
    a.lead(18, c, 14)
    a.bubble(14, 2, 22, ["..."])
    # the tip, edge-on as it is handed over
    a.coins([(26, 26)], 1)
    return a


def chatty_move_on():
    a = Art()
    a.grass()
    a.put("chatty-neighbour", "wave", 56, 58, 1)
    c = a.put("dog-biscuit", "walk", 24, 50, 2)
    a.lead(24, c, 20)
    return a


def kid_pet():
    a = Art()
    a.grass()
    a.put("kid", "wave", 54, 57)
    a.put("dog-duchess", "react", 28, 56)
    a.hearts([(18, 6), (36, 10)])
    return a


def kid_decline():
    a = Art()
    a.grass()
    a.put("kid", "sad", 56, 57)
    c = a.put("dog-duchess", "walk", 24, 50, 1)
    a.lead(24, c, 18)
    return a


# A pup cup: a scoop (f, highlight h) on a striped paper cup that narrows to its base.
CUP = ["..fff..", ".fhfff.", "fffffff", "WWWWWWW", ".RWRWR.", ".RWRWR.", "..WWW.."]


def truck_cups():
    a = Art()
    a.ground("shops")
    a.paste(hp.frame("ice-cream-truck", "idle"), 32, -1)
    a.put("dog-biscuit", "react", 14, 57)
    for x, (f, h) in zip((34, 47, 60), (("pink", "white"), ("cream", "white"), ("brown", "tan"))):
        a.shadow(x + 4, 55, 9)
        a.paste(pixmap(CUP, {"f": f, "h": h, "W": "white", "R": "red"}), x, 45)
    a.hearts([(4, 4)])
    return a


def truck_walk_past():
    a = Art()
    a.ground("shops")
    a.paste(hp.frame("ice-cream-truck", "idle", 1), 32, 1)
    c = a.put("dog-biscuit", "pull", 16, 54)
    # held back from the truck: the leash runs taut out of frame
    a.lead(16, c, 4)
    a.fill(30, 30, 2, 5, "red")
    a.fill(30, 36, 2, 2, "red")
    return a


def detour_long_way():
    a = Art()
    a.ground("street")
    a.paste(hp.frame("construction", "idle"), 6, 0)
    for x, y in ((5, 52), (3, 46), (1, 40), (1, 34), (3, 28), (5, 22), (68, 52), (70, 46), (72, 40), (72, 34), (70, 28),
                 (68, 22)):
        a.fill(x, y, 2, 2, "amber")
    c = a.put("dog-koda", "walk", 38, 56, 2)
    a.lead(38, c, 38)
    clock(a, 66, 8)
    return a


def detour_squeeze():
    a = Art()
    a.ground("street")
    a.paste(hp.frame("construction", "idle", 1), 6, 0)
    a.put("dog-duchess", "walk", 37, 52, 3)
    for x, y in ((24, 30), (48, 28), (28, 40), (50, 40), (40, 26)):
        a.fill(x, y, 4, 3, "lgrey")
        a.fill(x + 1, y - 1, 2, 1, "grey")
    return a


def mail_hold():
    a = Art()
    a.ground("homeStretch")
    a.put("mail-carrier", "walk", 56, 58)
    c = a.put("dog-koda", "react", 26, 50)
    a.lead(26, c, 14)
    a.paste(hp.frame("fx-bark", "pop", 1), 36, 2)
    return a


def mail_wait():
    a = Art()
    a.ground("homeStretch")
    a.put("mail-carrier", "walk", 56, 58, 1)
    c = a.put("dog-koda", "idle", 26, 54)
    a.lead(26, c, 24)
    clock(a, 10, 10)
    return a


# ---------- upgrades and the Skip option ----------

def disc(a, cx, cy, r, col, edge=None):
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            d = dx * dx + dy * dy
            if d <= r * r:
                a.fill(cx + dx, cy + dy, 1, 1, edge if edge and d > (r - 1) * (r - 1) else col)


def limb(g, pts, col, w=2):
    """A leg w pixels thick along the joints pts."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for k in range(n + 1):
            g.rect(round(x0 + (x1 - x0) * k / n), round(y0 + (y1 - y0) * k / n), w, w, col)


# A paw seen from below, 5x5: three toe beans over the main pad, all pink on the white sock.
PAW = ["pwpwp", "wwwww", "wpppw", "wpppw", ".www."]


def paw(g, x, y, col="white"):
    for j, row in enumerate(PAW):
        for i, ch in enumerate(row):
            if ch != ".":
                g.p(x + i, y + j, "pink" if ch == "p" else col)


def rolled_over():
    """Biscuit rolled onto its back: the body lies along the grass with the navy saddle down
    and the white belly up, pink at its middle. The legs fold: the hind pair splay out at the
    knee with the soles up, the front pair flop at the wrist, each white paw showing its pink
    pads; the far leg of each pair is shaded. The tail wags along the grass at the left, the
    head at the right faces the viewer, eyes shut in happy arcs and mouth open in a grin with
    the tongue out, ears flopped on the grass. 50x36 with its outline; the collar's lower end
    is at 33,28."""
    g = Grid(50, 36)
    # tail, along the grass from the rump, white tipped
    for i, (x, y) in enumerate(((8, 25), (6, 25), (4, 24), (3, 23), (2, 22))):
        g.rect(x, y, 2, 2, "white" if i > 2 else "ochre")
    # far legs first, shaded: a hind leg splayed at the knee and a front leg flopped at the wrist
    limb(g, [(16, 17), (14, 11), (16, 7)], "rust")
    paw(g, 15, 2, "lgrey")
    limb(g, [(25, 16), (23, 11), (26, 10)], "rust")
    paw(g, 25, 6, "lgrey")
    # the body, back down
    g.ell(21, 22, 13, 6.5, "ochre", "rust")
    g.ell(21, 27.5, 11, 2, "navy")
    g.ell(21.5, 18.5, 9, 3.2, "white", "lgrey")
    g.rect(19, 18, 4, 2, "pink")
    g.rect(20, 17, 2, 1, "pink")
    # near legs: the hind thigh out to the left, the shin back up to the sole; the front leg up
    # from the chest, the forearm flopped toward the head
    limb(g, [(11, 19), (7, 13), (8, 8)], "ochre")
    limb(g, [(8, 10), (8, 8)], "white")
    paw(g, 6, 3)
    limb(g, [(29, 16), (29, 11), (32, 11)], "ochre")
    limb(g, [(31, 11), (32, 11)], "white")
    paw(g, 32, 8)
    # ears flopped on the grass either side of the head
    g.ell(34, 26, 3, 5, "rust", "dbrown")
    g.ell(44, 26, 3, 5, "rust", "dbrown")
    # the head, facing the viewer
    g.ell(39, 20, 7, 6.5, "ochre", "rust", "tan")
    g.rect(38, 14, 2, 6, "white")
    g.ell(39, 23.5, 3.6, 2.6, "white", "lgrey")
    g.rect(38, 21, 3, 1, "ink")
    # eyes shut in happy arcs, curving up
    for x in (34, 41):
        g.p(x, 20, "ink")
        g.rect(x + 1, 19, 2, 1, "ink")
        g.p(x + 3, 20, "ink")
    # a wide open grin under the nose, the tongue hanging from it
    g.p(36, 23, "ink")
    g.rect(37, 24, 5, 1, "ink")
    g.p(42, 23, "ink")
    g.rect(38, 25, 3, 3, "pink")
    g.p(39, 25, "red")
    # collar between the head and the chest
    g.rect(31, 15, 2, 12, "green")
    g.rect(32, 15, 1, 12, "dgreen")
    g.p(32, 26, "amber")
    return to_image(g.outlined())


def kick(a, x, y, d):
    """A 1px motion arc beside a kicking paw, bowed away from it (d=1 right, -1 left)."""
    for dy, dx in ((0, 0), (1, 1), (2, 1), (3, 0)):
        a.fill(x + dx * d, y + dy, 1, 1, "white")


def belly_rubs():
    a = Art()
    a.grass()
    a.paste(rolled_over(), 12, 10)
    # kicking paws and a wriggling back, drawn as motion arcs
    kick(a, 15, 13, -1); kick(a, 51, 18, 1); kick(a, 11, 30, -1)
    # the leash runs from the collar off the bottom edge
    a.lead(44, 38, 52)
    a.hearts([(4, 4), (26, 2), (54, 4), (66, 18), (4, 44)])
    return a


def good_leash():
    a = Art()
    a.ground("park")
    a.put("squirrel", "idle", 60, 37)
    c = a.put("dog-koda", "walk", 30, 56, 1)
    a.lead(30, c, 24, 2)
    a.fill(29, c - 1, 3, 3, "amber")
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
    c = a.put("dog-biscuit", "walk", 18, 56, 1)
    a.lead(18, c, 12)
    # the trade-off: a shorter zone, and fewer fees
    a.paste(hp.frame("tip", "idle"), 44, 38)
    a.arrow(60, 40, 1, "red")
    return a


def rush_hour():
    a = Art()
    a.ground("street")
    a.paste(small_puddle(), 2, 38)
    a.put("skunk", "idle", 59, 55)
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
    a.face("face-owner-archie", "happy", 21, 12)
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


# ---------- need cards ----------

def stranger_fuss():
    a = Art()
    a.ground("street")
    a.put("spot-stranger", "wave", 54, 60, 1)
    c = a.put("dog-duchess", "react", 26, 57)
    a.lead(26, c, 22)
    a.hearts([(14, 8), (26, 3), (6, 18)])
    a.coins([(6, 32)])
    return a


def stranger_keep_walking():
    a = Art()
    a.ground("street")
    a.put("spot-stranger", "wave", 56, 60)
    c = a.put("dog-duchess", "walk", 24, 50, 2)
    a.lead(24, c, 18)
    return a


def play_date_play():
    a = Art()
    a.ground("park")
    a.put("other-dog", "walk", 54, 37, 1)
    c = a.put("dog-zippy", "react", 24, 57)
    a.lead(24, c, 20)
    a.paste(hp.frame("gag-ball", "roll", 1), 36, 28)
    a.hearts([(10, 8), (22, 3), (28, 14)])
    return a


def play_date_sniff():
    a = Art()
    a.ground("park")
    a.put("other-dog", "idle", 46, 35)
    c = a.put("dog-zippy", "walk", 32, 58, 1)
    a.lead(32, c, 30)
    # scent lines between the noses, as on the nosy need's icon
    for dx, dy in needs.SCENT:
        a.fill(38 + dx, 33 + dy, 1, 1, "white")
        a.fill(38 + dx, 36 + dy, 1, 1, "white")
    a.hearts([(20, 8)])
    return a


def grumpy_top(g, b):
    """The grumpy neighbour out on his lawn: a blue dressing gown belted at the waist over a white
    collar, fists on his hips, a bald crown with grey tufts over the ears, brows down in a scowl
    and the mouth turned down."""
    people.torso(g, b, "blue", "navy")
    g.rect(14, 21 + b, 4, 3, "white")
    g.rect(15, 24 + b, 2, 2, "white")
    g.rect(9, 28 + b, 14, 2, "sky")
    g.rect(20, 28 + b, 3, 2, "blue")
    # arms akimbo: each upper arm out to the elbow, the forearm back in to a fist on the hip
    for x0, d in ((5, -1), (23, 1)):
        g.rect(x0, 22 + b, 4, 4, "blue")
        g.rect(x0 + 2 * d, 25 + b, 4, 4, "blue")
        g.rect(x0 - d, 29 + b, 4, 2, "blue")
    g.rect(8, 29 + b, 3, 3, "skin2")
    g.rect(21, 29 + b, 3, 3, "skin2")
    g.rect(3, 26 + b, 1, 3, "navy")
    g.rect(28, 26 + b, 1, 3, "navy")
    people.head(g, b, "skin2", "brown", "skin1")
    for x in (8, 22):
        g.rect(x, 10 + b, 2, 5, "lgrey")
    g.rect(13, 5 + b, 3, 1, "skin1")
    road.face_front(g, 16, 13 + b, "neutral")
    g.rect(10, 10 + b, 3, 1, "ink")
    g.p(13, 11 + b, "ink")
    g.rect(20, 10 + b, 3, 1, "ink")
    g.p(19, 11 + b, "ink")
    g.rect(14, 18 + b, 4, 1, "dbrown")
    g.p(13, 19 + b, "dbrown")
    g.p(18, 19 + b, "dbrown")


# A tied poop bag: two ears (e) over the knot (k), the bag (f) with its shade (s) and a glint (h).
BAG = ["e...e", ".eke.", "..k..", ".fff.", "fhffs", "ffffs", ".fss."]


def accident_bag():
    """Clean up with a bag: the spot wiped clean and sparkling, the tied bag arcing into a bin, the
    dog walking on."""
    a = Art()
    a.ground("street")
    a.put("bin", "idle", 62, 40)
    for x, y in ((34, 34), (36, 28), (39, 22), (42, 17), (46, 13), (50, 11)):
        a.fill(x, y, 1, 1, "white")
    # pink, so it reads apart from the green bin
    a.paste(pixmap(BAG, {"e": "pink", "k": "mauve", "f": "pink", "s": "mauve", "h": "white"}), 52, 5)
    a.sparkle(30, 42, "white")
    a.sparkle(37, 46, "yellow")
    a.sparkle(26, 48, "yellow")
    c = a.put("dog-biscuit", "walk", 14, 54, 1)
    a.lead(14, c, 10)
    return a


def grumpy_lawn(a, x=-2):
    """The street with the grumpy neighbour's lawn down its left edge, a grey curb along it, and
    him standing on it, his left edge at column x."""
    a.ground("street")
    a.fill(0, 0, 26, AH, "green")
    for i in range(12):
        a.fill((i * 7) % 24, (i * 13) % AH, 1, 2, "dgreen")
    a.fill(26, 0, 2, AH, "grey")
    neighbour = to_image(road.big(road.dressed, grumpy_top, legs="lgrey", shoes="pink").px)
    shade, a.shade = a.shade, "dgreen"
    a.shadow(x + 20, 55, neighbour.width)
    a.shade = shade
    a.paste(neighbour, x, -1)


def accident_walk_on():
    """Walk on: the pile left at the lawn's edge with its stink, the grumpy neighbour on his lawn
    with his fists on his hips, and the dog trotting off."""
    a = Art()
    grumpy_lawn(a)
    a.paste(to_image(needs.accident_spot(0).px), 30, 34)
    a.stink(32, 24, 2, "green", "dgreen")
    a.fill(30, 2, 2, 5, "red")
    a.fill(30, 8, 2, 2, "red")
    c = a.put("dog-biscuit", "walk", 56, 50, 2)
    a.lead(56, c, 64)
    return a


def broken_hearts(a, pts):
    """Hearts broken in two down the middle, the right half dropped a pixel: a heart lost."""
    for x, y in pts:
        for j, r in enumerate([".11.11.", "1111111", "1111111", ".11111.", "..111..", "...1..."]):
            for i, c in enumerate(r):
                if c == "1":
                    right = i > 3
                    a.fill(x + i + right, y + j + right, 1, 1, "pink" if (i, j) == (1, 1) else "red")


# A sealed envelope: pee-mail, the flap's V in lgrey.
ENVELOPE = ["fwwwwwf", "wfwwwfw", "wwfwfww", "wwwfwww", "wwwwwww"]


def envelopes(a, pts):
    for x, y in pts:
        a.paste(pixmap(ENVELOPE, {"w": "white", "f": "lgrey"}), x, y)


def good_spot_take_time():
    """Take your time: the dog settled at the foot of the tree, hearts over it, the clock running."""
    a = Art()
    a.ground("park")
    a.put("spot-tree", "idle", 22, 58)
    c = a.put("dog-biscuit", "idle", 46, 57)
    a.lead(46, c, 52)
    a.hearts([(48, 8), (60, 14), (52, 22)])
    clock(a, 66, 32)
    return a


def good_spot_keep_walking():
    a = Art()
    a.ground("park")
    a.put("spot-tree", "idle", 54, 58, 1)
    c = a.put("dog-biscuit", "walk", 24, 50, 2)
    a.lead(24, c, 18)
    return a


def pee_mail_sniff():
    """Read it all: the dog's nose at the lamp post's foot, scent rising off it as envelopes,
    hearts over it and the clock running."""
    a = Art()
    a.ground("street")
    a.put("spot-lamp-post", "idle", 18, 58)
    c = a.put("dog-koda", "idle", 38, 57)
    a.lead(38, c, 46)
    for x, y in ((23, 42), (24, 47)):
        for dx, dy in needs.SCENT:
            a.fill(x + dx, y + dy, 1, 1, "white")
    envelopes(a, [(36, 16), (46, 6), (58, 14)])
    a.hearts([(62, 28), (54, 34)])
    clock(a, 66, 6)
    return a


def pee_mail_keep_walking():
    a = Art()
    a.ground("street")
    a.put("spot-lamp-post", "idle", 56, 58)
    envelopes(a, [(64, 36)])
    c = a.put("dog-koda", "walk", 24, 50, 2)
    a.lead(24, c, 18)
    return a


def water_stop_drink():
    """A long drink: the dog's head down in the bowl, the water splashing, hearts over it and the
    clock running."""
    a = Art()
    a.ground("park")
    a.put("spot-water-bowl", "idle", 30, 37, 3)
    c = a.put("dog-duchess", "idle", 36, 57)
    a.lead(36, c, 44)
    a.drops([(26, 14), (31, 10), (42, 12), (47, 16), (36, 7)])
    a.hearts([(54, 8), (64, 16)])
    clock(a, 10, 10)
    return a


def water_stop_sip():
    """Just a sip: a lap at the bowl and on, one drop off the chin and one heart."""
    a = Art()
    a.ground("park")
    a.put("spot-water-bowl", "idle", 54, 42)
    c = a.put("dog-duchess", "walk", 28, 52, 2)
    a.lead(28, c, 22)
    a.drops([(38, 30)])
    a.hearts([(24, 6)])
    return a


# ---------- forks ----------
# A fork's path card looks down the zone's road to a cross street, the zone's far side beyond
# it as its backdrop draws it, in miniature. Rows: the far side stands on row FAR_Y, then the
# far sidewalk from WALK_Y, the far curb from CURB_Y, the cross street from CROSS_Y with its
# centre line on LINE_Y, and from STUB_Y the zone's road in projection, sampled from its road
# strip: SPREAD * (row centre - HORIZON) pixels either side of the centre, the curb, sidewalk
# and lawn beside it.
FAR_Y, WALK_Y, CURB_Y, CROSS_Y, LINE_Y, STUB_Y = 21, 22, 25, 26, 29, 33
HORIZON, SPREAD = 12.0, 0.75
FOCAL = 16       # a stub row samples strip row FOCAL / scale: 1.5 rows apart near, 5 far
DASH = 5.0       # a stub divider's dashes repeat every 1 / DASH of log(row centre - HORIZON)
MINI = (2, 6, 5, 7)   # a far house's windows and door, as backdrops.house parts


def tufted(lawn="green", rate=0.05):
    def paint(px, py):
        return bd.dk(lawn) if bd.noise(px, py) < rate or bd.noise(px, py - 1) < rate else lawn
    return paint


def flecked(base, fleck, n=23, second=None):
    """A ground of base with about one fleck in n, and a sparser second fleck."""
    def paint(px, py):
        if bd.hashed(px, py, n):
            return fleck
        return second if second and bd.hashed(px, py + 3, n + 8) else base
    return paint


def leafy(paint, rate=0.06):
    """paint, strewn with fallen leaves in orange, rust and ochre."""
    def leaves(px, py):
        n = bd.noise(px + 7, py * 3)
        return ("orange", "rust", "ochre")[int(n * 300) % 3] if n < rate else paint(px, py)
    return leaves


def boards(px, py):
    """The promenade's boards across the cross street, a seam every 5 columns."""
    return "tan" if px % 5 == 0 else flecked("cream", "tan", 27)(px, py)


class ZoneView(Art):
    """A zone's path card illustration. road(px, py) paints the cross street, yard(px, py) the
    far side's ground and lawn(px, py) the near corners past the sidewalk; mark is the cross
    street's centre line, dashed (on, period) or solid with None, over an edge row where given.
    walk and curb are the sidewalks' and curbs' colours, None where the zone has none, and
    walk_fleck the sidewalks' flecks."""

    def __init__(self, zone, road, yard, mark, dash, curb="grey", walk="lgrey", lawn=tufted(), edge=None,
                 walk_fleck="grey"):
        super().__init__()
        self.road_px, self.yard, self.lawn = road, yard, lawn
        self.mark, self.dash, self.edge, self.curb, self.walk = mark, dash, edge, curb, walk
        self.walk_fleck = walk_fleck
        ground, lines = roads.ZONES[zone]
        g = Grid(roads.W, roads.H)
        ground(g)
        self.strip = [row[:] for row in g.px]
        lines(g)
        # the stub's dividers take the strip's colour, solid or dashed as the strip's are
        marked = [g.px[y][roads.DIVIDERS[0]] for y in range(roads.H)
                  if g.px[y][roads.DIVIDERS[0]] != self.strip[y][roads.DIVIDERS[0]]]
        self.lane = Counter(marked).most_common(1)[0][0]
        self.duty = 1 if len(marked) == roads.H else max(0.5, len(marked) / roads.H)
        # lines along the road (board seams): columns off the base colour in 3 rows of 4
        base = Counter(c for row in self.strip for c in row).most_common(1)[0][0]
        lanes = {x + d for x in roads.DIVIDERS for d in (0, 1)}
        self.seams = [x for x in range(8, roads.W - 8) if x not in lanes
                      and sum(self.strip[y][x] != base for y in range(roads.H)) >= 0.75 * roads.H]

    def sky(self, top, low):
        self.fill(0, 0, AW, FAR_Y, low)
        self.fill(0, 0, AW, 4, top)
        for i in range(0, AW, 5):
            self.fill(i, 4 + (i // 5) % 2, 5, 1, top)

    def treeline(self, row, cols, phase, lo, hi):
        """Treetops along row, rising lo to hi rows, over a lawn down to the far side's ground."""
        for x in range(AW):
            h = lo + round((hi - lo) * (0.5 + 0.5 * math.sin(x * 0.45 + phase) * math.cos(x * 0.21)))
            self.fill(x, row - h, 1, h, cols[0])
            self.fill(x, row - h, 1, 1, cols[1])
        self.fill(0, row, AW, FAR_Y - row, "green")

    def street(self):
        """The far yard, sidewalk and curb, the cross street and the stub with its corners."""
        for py in range(FAR_Y, AH):
            for px in range(AW):
                self.fill(px, py, 1, 1, self.ground_px(px, py))
        for px in range(AW):
            if not self.dash or (px + 2) % self.dash[1] < self.dash[0]:
                self.fill(px, LINE_Y, 1, 1, self.mark)
                if self.edge:
                    self.fill(px, LINE_Y + 1, 1, 1, self.edge)
        self.lanes()

    def walk_px(self, px, py):
        return self.walk_fleck if bd.hashed(px, py, 29) else self.walk

    def ground_px(self, px, py):
        if py < WALK_Y:
            return self.yard(px, py)
        if py < CURB_Y:
            return self.walk_px(px, py) if self.walk else self.lawn(px, py)
        if py < CROSS_Y:
            return self.curb or self.road_px(px, py)
        if py < STUB_Y:
            return self.road_px(px, py)
        hw = SPREAD * (py + 0.5 - HORIZON)
        a = abs(px + 0.5 - AW / 2)
        if a < hw:
            return self.stub_px(px, py, hw / bd.ROAD)
        if self.curb and a < hw + 1:
            return self.curb
        if self.walk and (py < STUB_Y + 3 or a < hw * bd.WALK / bd.ROAD):
            return self.walk_px(px, py)
        return self.lawn(px, py)

    def stub_px(self, px, py, s):
        """The strip at scale s: the pixel under this one's centre, or a seam in its span, so
        the 1px seams along the road never drop out."""
        row = self.strip[int(FOCAL / s) % roads.H]
        u0, u1 = roads.W / 2 + (px - AW / 2) / s, roads.W / 2 + (px + 1 - AW / 2) / s
        seam = next((x for x in self.seams if u0 <= x < u1), None)
        return row[seam if seam is not None else min(roads.W - 1, int((u0 + u1) / 2))]

    def lanes(self):
        """The stub's four dividers, 1px wide, the dashes at least half on and shortening with
        distance."""
        for py in range(STUB_Y, AH):
            if self.duty < 1 and (DASH * math.log(py + 0.5 - HORIZON)) % 1 >= self.duty:
                continue
            s = SPREAD * (py + 0.5 - HORIZON) / bd.ROAD
            for x in roads.DIVIDERS:
                self.fill(math.floor(AW / 2 + (x + 1 - roads.W / 2) * s), py, 1, 1, self.lane)


def woof_way_view():
    a = ZoneView("woof-way", flecked("dslate", "slate", 29, "navy"), tufted(), "lgrey", (3, 6))
    a.sky("cyan", "sky")
    bd.cloud(a, 1, 7, 18, 3, 0)
    bd.cloud(a, 54, 5, 14, 2, 1)
    # the house at the end of the street, its neighbours cut by the edges, a tree in each gap
    for x in (14, 61):
        bd.tree(a, x, 9, r=5, base=FAR_Y, girth=2)
    for x, w, wall_c, roof, door, top in ((-21, 28, "pink", "purple", "white", 4),
                                          (23, 30, "sky", "navy", "red", 3),
                                          (69, 28, "cream", "dred", "sky", 4)):
        bd.house(a, x, w, wall_c, roof, door, top=top, base=FAR_Y, roof_h=8, parts=MINI)
    a.street()
    bd.fence(a, FAR_Y - 3, 0, 32, h=4)
    bd.fence(a, FAR_Y - 3, 46, AW, h=4)
    return a


def bark_park_view():
    trail = flecked("tan", "brown", 13, "cream")
    a = ZoneView("bark-park", trail, tufted(), "dbrown", (2, 5), curb=None, walk=None)
    a.sky("cyan", "sky")
    bd.cloud(a, 56, 4, 16, 3, 2)
    a.treeline(15, ("dgreen", "green"), 0, 2, 5)
    bd.tree(a, 3, 9, r=6, base=18, girth=2)
    bd.tree(a, 72, 10, r=5, base=18, girth=2)
    # the park gate at the end of the path: its sign on two lines between two posts
    for x in (11, 62):
        a.fill(x, 1, 2, FAR_Y - 1, "dbrown")
    a.fill(13, 2, 49, 17, "dgreen")
    a.fill(13, 2, 49, 1, "green")
    a.fill(13, 18, 49, 1, "forest")
    bd.word(a, "FAIRVIEW", AW / 2, 3, "yellow")
    bd.word(a, "PARK", AW / 2, 10, "yellow")
    a.street()
    # the path on through the gate from under its sign, widening to the cross trail
    for py in range(19, CROSS_Y):
        half = 7 + (py - 13) // 2
        for px in range(round(AW / 2) - half, round(AW / 2) + half):
            a.fill(px, py, 1, 1, trail(px, py))
    return a


def shops_view():
    paving = flecked("cream", "tan", 29)
    a = ZoneView("sniff-street-shops", flecked("pink", "skin1", 19), paving, "white", (3, 6), curb="white",
                 walk="cream", lawn=paving, walk_fleck="tan")
    # the backdrop's sunburst of sky and cyan rays, from the end of the street
    bd.sunburst(a, AW / 2, FAR_Y + 2, 5, "sky", "cyan", FAR_Y, w=AW)
    # three of the backdrop's colour-blocked shopfronts, the toy shop at the end of the street:
    # a sign board, a striped awning, the shop window and the door, inside a plum line
    for (x, w, top), (wall_c, awn, sign, board, letters) in zip(
            ((-36, 44, 4), (11, 54, 2), (68, 40, 4)),
            (("sky", "amber", "PETS", "navy", "yellow"), ("yellow", "red", "TOYS", "blue", "white"),
             ("green", "pink", "ICE", "forest", "white"))):
        a.fill(x, top, w, FAR_Y - top, wall_c)
        a.fill(x + w - 2, top, 2, FAR_Y - top, bd.dk(wall_c))
        bd.outline_box(a, x, top, w, FAR_Y - top + 1, "plum")
        a.fill(x + 2, 5, w - 4, 8, board)
        bd.word(a, sign, x + w / 2, 5, letters)
        for i in range(0, w - 4, 6):
            a.fill(x + 2 + i, 13, 3, 2, awn)
            a.fill(x + 5 + i, 13, 3, 2, "white")
        a.fill(x + 2, 15, w - 4, 1, bd.dk(awn))
        a.fill(x + 4, 16, w - 20, 5, "plum")
        a.fill(x + 5, 17, w - 22, 4, "cyan")
        a.fill(x + 6, 18, 3, 1, "white")
        a.fill(x + w - 13, 16, 7, 5, "plum")
        a.fill(x + w - 12, 17, 5, 4, "dbrown")
    a.street()
    for x0, x1 in ((0, 18), (57, 75)):
        bd.bunting(a, x0, x1, 2, 3, ("red", "yellow", "sky", "pink"))
    return a


def long_way_home_view():
    lawn = leafy(tufted())
    a = ZoneView("the-long-way-home", flecked("skin2", "skin1", 31), lawn, "white", (4, 8), edge="plum", lawn=lawn)
    # the backdrop's banded sunset and its striped sun, setting at the end of the street behind
    # the trees past the back yards
    bd.bands(a, 0, 17, bd.LONG_WAY_SKY, w=AW)
    bd.sun(a, 37, 15, 11, "yellow", low=14)
    a.treeline(17, ("rust", "orange"), 4, 1, 4)
    bd.tree(a, 23, 11, "rust", "dbrown", r=4, base=FAR_Y, girth=2)
    # porch houses either side of the sunset
    for x, w, wall_c, roof, door in ((-12, 28, "white", "dred", "dgreen"), (59, 28, "skin1", "navy", "red")):
        bd.house(a, x, w, wall_c, roof, door, top=3, base=FAR_Y, roof_h=8, parts=MINI)
        a.fill(x + 2, FAR_Y - 7, w - 4, 1, "brown")
        a.fill(x + 3, FAR_Y - 6, 1, 6, "brown")
        a.fill(x + w - 4, FAR_Y - 6, 1, 6, "brown")
    a.street()
    bd.fence(a, FAR_Y - 3, 26, 52, h=4)
    return a


def snooze_crescent_view():
    a = ZoneView("snooze-crescent", flecked("grey", "slate", 23), tufted(), "white", (2, 6))
    # the backdrop's banded dusk sky, a crescent moon and the first stars
    bd.bands(a, 0, FAR_Y, bd.SNOOZE_SKY, w=AW)
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            if dx * dx + dy * dy <= 16 and (dx + 2) ** 2 + (dy - 1) ** 2 > 10:
                a.fill(64 + dx, 5 + dy, 1, 1, "cream")
    for x, y in ((6, 2), (20, 5), (33, 1), (48, 3), (56, 8), (72, 1)):
        a.fill(x, y, 1, 1, "white")
    # quiet houses, curtains drawn, dark trees between them
    for x in (14, 61):
        bd.tree(a, x, 11, "dgreen", "forest", r=5, base=FAR_Y, girth=2)
    for x, w, wall_c, roof, door, curtain, top in ((-21, 28, "lgrey", "purple", "navy", "pink", 6),
                                                   (23, 30, "cream", "navy", "dred", "tan", 5),
                                                   (69, 28, "sky", "dslate", "white", "pink", 6)):
        bd.house(a, x, w, wall_c, roof, door, top=top, base=FAR_Y, roof_h=8, parts=MINI, curtains=curtain)
    a.street()
    bd.fence(a, FAR_Y - 3, 0, 32, h=4)
    bd.fence(a, FAR_Y - 3, 46, AW, h=4)
    bd.fence_cat(a, 50, FAR_Y - 3, "orange", "amber")
    return a


def paws_promenade_view():
    a = ZoneView("paws-promenade", boards, flecked("lgrey", "grey", 29), "dbrown", (4, 9), curb=None)
    a.sky("cyan", "sky")
    bd.cloud(a, 40, 4, 20, 3, 4)
    # the far bank's trees and the river, with ducks and a rowboat
    for cx, top, r in ((6, 6, 5), (30, 5, 6), (66, 7, 4)):
        bd.tree(a, cx, top, "dgreen", "forest", r=r, base=10, girth=2)
    a.fill(0, 9, AW, 1, "green")
    a.fill(0, 10, AW, 1, "grey")
    for py in range(11, 17):
        for px in range(AW):
            c = "blue" if py < 13 else "sky"
            if bd.hashed(px // 3, py, 9) and py % 2 == 0:
                c = "cyan" if py > 13 else "sky"
            a.fill(px, py, 1, 1, "white" if bd.hashed(px, py, 41) else c)
    for x in (10, 16):
        a.fill(x, 14, 4, 1, "white")
        a.fill(x + 2, 13, 2, 1, "white")
        a.fill(x + 4, 13, 1, 1, "amber")
    a.fill(46, 13, 12, 2, "brown")
    a.fill(47, 15, 10, 1, "dbrown")
    a.fill(51, 12, 2, 1, "red")
    # the embankment wall, the railing over the water and the promenade's lamps
    a.fill(0, 17, AW, 1, "lgrey")
    a.fill(0, 18, AW, 3, "grey")
    a.street()
    for x in range(1, AW, 6):
        a.fill(x, FAR_Y - 4, 1, 5, "lgrey")
    a.fill(0, FAR_Y - 4, AW, 1, "lgrey")
    a.fill(0, FAR_Y - 2, AW, 1, "lgrey")
    for x in (24, 54):
        a.fill(x, FAR_Y - 12, 1, 13, "dslate")
        a.fill(x - 1, FAR_Y - 15, 3, 3, "navy")
        a.fill(x, FAR_Y - 14, 1, 1, "yellow")
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
    "card-picnic-buy-lunch": picnic_buy_lunch,
    "card-picnic-drop-it": picnic_drop_it,
    "card-goose-back-off": goose_back_off,
    "card-goose-honk-back": goose_honk_back,
    "card-petunias-replant": petunias_replant,
    "card-petunias-nature-calls": petunias_nature_calls,
    "card-trash-sniff": trash_sniff,
    "card-trash-tidy-up": trash_tidy_up,
    "card-trash-drag-on": trash_drag_on,
    "card-cafe-charm": cafe_charm,
    "card-cafe-buy-lattes": cafe_buy_lattes,
    "card-cafe-slink-away": cafe_slink_away,
    "card-lemonade-water": lemonade_water,
    "card-lemonade-say-hi": lemonade_say_hi,
    "card-lemonade-maybe-later": lemonade_maybe_later,
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
    "card-stranger-loves-fuss": stranger_fuss,
    "card-stranger-loves-keep-walking": stranger_keep_walking,
    "card-play-date-play": play_date_play,
    "card-play-date-sniff": play_date_sniff,
    "card-accident-bag": accident_bag,
    "card-accident-walk-on": accident_walk_on,
    "card-good-spot-take-time": good_spot_take_time,
    "card-good-spot-keep-walking": good_spot_keep_walking,
    "card-pee-mail-sniff": pee_mail_sniff,
    "card-pee-mail-keep-walking": pee_mail_keep_walking,
    "card-water-stop-drink": water_stop_drink,
    "card-water-stop-sip": water_stop_sip,
    "card-zone-woof-way": woof_way_view,
    "card-zone-bark-park": bark_park_view,
    "card-zone-sniff-street-shops": shops_view,
    "card-zone-the-long-way-home": long_way_home_view,
    "card-zone-snooze-crescent": snooze_crescent_view,
    "card-zone-paws-promenade": paws_promenade_view,
}


def card_frame_tags():
    """{illustration key: the card-frame tag the game shows it in}, from the game's export: each card
    face's frame, and lucky (or encounter) for the art an instant encounter shows."""
    tags = {card["art"]: card["frame"] for card in hp.GAME["cards"]}
    for e in hp.GAME["encounters"]:
        if e["resolution"]["kind"] == "instant":
            tags[e["resolution"]["art"]] = "lucky" if e["kind"] == "lucky" else "encounter"
    return tags


FRAME_TAGS = card_frame_tags()


def card_kind(key):
    """The frame an illustration shows in, as the game picks it."""
    if key in FRAME_TAGS:
        return FRAME_TAGS[key]
    # CLEANUP (added 2026-10-19): drop once the game data names the new encounters' cards (picnic,
    # goose, petunias, trash, cafe, lemonade stand).
    return "lucky" if key.startswith("card-lemonade-") else "encounter"


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
    cols = 10
    rows = (len(keys) + cols - 1) // cols
    big = [("encounter", "card-skunk-rinse"), ("lucky", "card-lost-wallet-return"),
           ("route", "card-zone-woof-way"), ("stop", "card-kid-wants-to-pet-pet"), ("upgrade", "card-belly-rubs")]
    width = max((CW + 6) * cols, (LW + 6) * len(big))
    sheet = Image.new("RGB", (width * scale, ((CH + 6) * rows + LH + 6) * scale), hp.rgb("ink"))
    for i, key in enumerate(keys):
        card = mock_card(card_kind(key), key).resize((CW * scale, CH * scale), Image.NEAREST)
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
    print("built", ", ".join([*ILLUSTRATIONS, "card-cost"]))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
