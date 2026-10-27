#!/usr/bin/env python3
"""Draw the choice card frame and compose the card illustrations.

- card-frame: an 83x140 sprite, one frame per card type (tags encounter for an
  obstacle's card, route for a fork's path cards). The game draws the title
  in the band, the effect text in the body and the cost in the badge. Layout,
  in card pixels:
    band 2..12 (title), art window 3,15 to 79,72 (illustration at 4,16, 75x56), 1px
    of face or lip either side of it,
    body 6..76 x 76..117, badge spot 6,121, 71x13 (plain face; card-cost goes there on a paid option).
- card-frame-large: a 166x280 sprite with the same tags, for the tap-to-enlarge
  view: the same layout doubled with 1px detail. Band 4..24 (title line from row
  9), art window 6,30, 154x116 (illustration at 2x at 8,32),
  body 12..153 x 152..233, badge spot 12,242, 142x26.
- card-cost: a 71x13 image, the cost plaque laid over the badge (at 2x on the
  large frame); the game writes the cost centred on its face.
- card-<encounter>-<option>, card-<upgrade> and card-skip: 75x56
  illustrations, one per option, composed from the exported
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
import glyphs  # noqa: E402
import scene as sn  # noqa: E402
import road  # noqa: E402
import roads  # noqa: E402
from pixel import Grid, bitmap, build as build_sprites, dk, edged, to_image  # noqa: E402
from ui import chrome  # noqa: E402

CW, CH = 83, 140
AW, AH = 75, 56
# Band colours hold white labels at 7:1 or more. The game draws encounter for an obstacle and route for a
# fork.
BANDS = {"encounter": ("dred", "plum"), "route": ("purple", "plum")}


# ---------- the frame ----------

def card_frame(kind):
    """ui.py's chrome around the card: the ink and plum lines, the cream face with its tan lip,
    the band in the card type's colour over its shade line and a recessed art window (an ink line
    over its top in shadow, plum on the other sides). The badge spot stays the cream face: the game
    lays card-cost there only on an option that costs cash."""
    g = chrome(Grid(CW, CH), 0, 0, CW, CH)
    band, band_sh = BANDS[kind]
    g.rect(2, 2, CW - 4, 11, band)
    g.rect(2, 12, CW - 4, 1, band_sh)
    # recessed art window
    g.rect(3, 15, AW + 2, AH + 2, "plum")
    g.rect(3, 15, AW + 2, 1, "ink")
    g.rect(4, 16, AW, AH, "tan")
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
    g.rect(6, 30, 2 * AW + 4, 2 * AH + 4, "plum")
    g.rect(6, 30, 2 * AW + 4, 2, "ink")
    g.rect(8, 32, 2 * AW, 2 * AH, "tan")
    return g


def card_cost():
    """71x13: the cost plaque, laid over the frame's badge spot at 6,121 (12,242 at 2x on the
    large frame). ui.py's chrome with its corners cut 1px: the cream face is x 2 to 67, rows 2
    to 9, over the tan lip. The game writes the cost ($, $$$, the heart change, Free or Need $...)
    centred in font-title, plum (9.42:1), caps in rows 4 to 8. A disabled card's grey copy turns
    the face nlgrey, where ink holds 12.64:1."""
    return chrome(Grid(71, 13), 0, 0, 71, 13)


# ---------- illustration helpers ----------

class Art(sn.Scene):
    def __init__(self, clear=False):
        """clear leaves the ground transparent, for a pop-up that floats over the road."""
        super().__init__(AW, AH)
        if clear:
            self.img = Image.new("RGBA", (AW, AH), (0, 0, 0, 0))

    def ground(self, zone, x0=122):
        self.shade, self.leash_col = sn.ZONES[zone]["shadow"], sn.ZONES[zone]["leash"]
        tile = sn.TILES[zone].crop((x0, 0, x0 + AW, 64))
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
        collar, scene.COLLAR over its feet (its last opaque row)."""
        self.feet(key, tag, cx, foot, i, flip, shadow)
        f = sn.frame(key, tag, i)
        return foot - f.height + f.getbbox()[3] - 1 - sn.COLLAR

    def stink(self, x, y, n, col, sh):
        """n wavy stink lines rising from x, y, every third pixel in sh."""
        for k in range(n):
            for j in range(7):
                self.fill(x + k * 6 + (0 if (j % 4) < 2 else 1), y + j, 1, 1, col if j % 3 else sh)

    def skunk_stink(self, x, y, n=3):
        """Stink lines in the skunk's colours (road.CLOUD_INK), as skunk-cloud."""
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
            self.paste(sn.frame("tip", "idle", i + k), x, y)

    def face(self, key, mood, x, y):
        self.fill(x - 1, y - 1, 34, 34, "plum")
        self.fill(x, y, 32, 32, "tan")
        self.paste(sn.frame(key, mood), x, y)

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
    a.put("dog-kilo", "walk", 54, 40, 2)
    a.skunk_stink(46, 4, 2)
    return a


def small_puddle(f=0):
    """Cards show a 32x16 puddle; the road's is two lanes wide."""
    return to_image(road.puddle(f, 32, 16).outlined(False))


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
    a.put("dog-kilo", "react", 22, 58)
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


# ---------- lucky encounters ----------

# The found wallet's $: 5x9, bold enough to read at 1x on the front bill.
BILL_DOLLAR = ["..x..", ".xxxx", "x.x..", "x.x..", ".xxx.", "..x.x", "..x.x", "xxxx.", "..x.."]


def found_wallet():
    """44x34, the found wallet close up: a brown leather wallet, lit tan along its top and stitched, its
    flap tab on the right with an amber snap, two green bills standing up out of it, the front one lit
    along its top with a white $."""
    g = edged(Grid(44, 34))
    # the bills, the back one a shade darker and set left, standing up out of the wallet
    g.rect(7, 2, 22, 16, "dgreen")
    g.rect(7, 2, 22, 1, "green")
    g.rect(13, 5, 22, 16, "green")
    g.rect(13, 5, 22, 1, "lgrey")
    g.rect(15, 7, 18, 1, "dgreen")
    bitmap(g, 22, 8, BILL_DOLLAR, {"x": "white"})
    # the wallet, its top edge lit and a stitched seam under it, shaded down the right and along the bottom
    g.rect(3, 16, 38, 17, "brown")
    g.rect(3, 16, 38, 1, "tan")
    g.rect(3, 32, 38, 1, "dbrown")
    g.rect(40, 16, 1, 17, "dbrown")
    for x in range(5, 38, 3):
        g.rect(x, 18, 2, 1, "dbrown")
    # the flap tab with its snap
    g.rect(28, 22, 13, 7, "dbrown")
    g.rect(28, 22, 13, 1, "brown")
    g.rect(33, 24, 3, 3, "amber")
    g.p(33, 24, "yellow")
    return g


def wallet_keep():
    """The found wallet, big and alone with a glint, cut out to float over the road: a lucky find shows the
    thing found."""
    a = Art(clear=True)
    img = to_image(found_wallet().outlined())
    x, y = (AW - img.width) // 2, AH - img.height - 6
    a.paste(img, x, y)
    a.sparkle(x + img.width - 2, y + 3, "yellow")
    a.sparkle(x + 2, y + 8, "yellow")
    return a


def neighbour_take():
    """The friendly neighbour crouched beside a pack dog, reaching up to pat it on the head between its
    ears, hearts rising from the dog. Her road sprite's lowered forearm is cut away and her arm drawn
    raised instead: a mauve sleeve shaded purple in a plum outline, her hand on the dog's crown. Her
    floating heart sits above the art window, so it is left out here. Cut out to float over the road."""
    a = Art(clear=True)
    a.put("dog-biscuit", "idle", 49, 57, shadow=False)
    her = sn.frame("petting-neighbor", "wave", 1)
    her.paste((0, 0, 0, 0), (34, 0, her.width, 14))
    top = 66 - her.height
    her.paste((0, 0, 0, 0), (35, 30 - top, her.width, her.height))
    a.paste(her, -2, top)
    # the sleeve: the upper arm out from her shoulder to the elbow, the forearm up to the dog's crown
    joints = [(31, 31), (37, 29), (44, 21)]
    arm = []
    for (x0, y0), (x1, y1) in zip(joints, joints[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        arm += [(round(x0 + (x1 - x0) * k / n), round(y0 + (y1 - y0) * k / n)) for k in range(n + 1)]
    for x, y in arm:
        a.fill(x - 1, y - 1, 5, 5, "plum")
    for x, y in arm:
        a.fill(x, y, 3, 3, "mauve")
    for x, y in arm:
        a.fill(x + 2, y + 2, 1, 1, "purple")
    # the hand, palm down on the crown between the ears: the back of it, a thumb out to the left and
    # three fingers curled over the dog's brow, in a plum outline
    hand = {(x, y) for x in range(45, 51) for y in range(17, 20)} | {(44, 19), (45, 20), (47, 20), (49, 20),
                                                                     (45, 21), (47, 21), (49, 21)}
    for x, y in hand:
        for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
            if (x + dx, y + dy) not in hand:
                a.fill(x + dx, y + dy, 1, 1, "plum")
    for x, y in hand:
        a.fill(x, y, 1, 1, "skin2" if y == 21 or x == 50 else "skin1")
    a.hearts([(44, 3), (57, 9), (66, 2), (64, 19)])
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
    is at 32,28."""
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
    kick(a, 15, 13, -1)
    kick(a, 51, 18, 1)
    kick(a, 11, 30, -1)
    # the leash runs from the collar off the bottom edge
    a.lead(44, 38, 52)
    a.hearts([(4, 4), (26, 2), (54, 4), (66, 18), (4, 44)])
    return a


def good_leash():
    a = Art()
    a.ground("park")
    a.put("squirrel", "idle", 60, 37)
    c = a.put("dog-kilo", "walk", 30, 56, 1)
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
        a.paste(sn.frame("tip", "idle", k), x, y)
    a.paste(sn.frame("tip", "idle"), 44, 26)
    a.sparkle(42, 24, "white")
    a.arrow(56, 14, -1)
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


def sweet_talker():
    a = Art()
    a.grass()
    a.face("face-owner-pierre", "happy", 6, 14)
    # cheaper per dog: the cost in the bubble, and a down arrow beside it
    a.bubble(40, 8, 32, [""])
    sn.text(a, "$$", 45, 12, "forest")
    a.arrow(57, 11, 1)
    a.heart(50, 38, "red", "pink")
    a.heart(60, 44, "red", "pink")
    return a


def skip():
    """Walk on by: the skunk waits at the left while Duchess and Biscuit trot on past it up the street,
    lgrey speed lines at their heels, and the Hall pass held up over them (glyphs.py's 20x20 icon)."""
    a = Art()
    a.ground("street")
    a.put("skunk", "idle", 13, 49)
    a.put("dog-duchess", "walk", 41, 55, 1)
    a.put("dog-biscuit", "walk", 62, 49, 2)
    for x, y, h in ((33, 47, 6), (49, 48, 5), (55, 43, 5), (70, 42, 4)):
        a.fill(x, y, 1, h, "lgrey")
    a.paste(glyphs.image(glyphs.gear_hall_pass20), 30, 1)
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
FOCAL = 16       # a stub row samples strip row FOCAL / scale: about 2 rows apart near, 7 far
DASH = 5.0       # a stub divider's dashes repeat every 1 / DASH of log(row centre - HORIZON)
MINI = (2, 6, 5, 7)   # a far house's windows and door, as backdrops.house parts


def tufted(lawn="green", rate=0.05):
    def paint(px, py):
        return dk(lawn) if bd.noise(px, py) < rate or bd.noise(px, py - 1) < rate else lawn
    return paint


def flecked(base, fleck, n=23, second=None):
    """A ground of base with about one fleck in n, and a sparser second fleck."""
    def paint(px, py):
        if bd.hashed(px, py, n):
            return fleck
        return second if second and bd.hashed(px, py + 3, n + 8) else base
    return paint


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


# ---------- the Toronto neighborhoods' path cards, after their backdrops ----------

def cabbagetown_view():
    a = ZoneView("cabbagetown", flecked("grey", "slate", 53), tufted("dgreen"), "white", (2, 6), curb="stone",
                 lawn=tufted("dgreen"))
    bd.bands(a, 0, FAR_Y, ("lilac", "pink", "peach", "gold"), w=AW)
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            if dx * dx + dy * dy <= 16 and (dx + 2) ** 2 + (dy - 1) ** 2 > 10:
                a.fill(10 + dx, 5 + dy, 1, 1, "cream")
    for x, y in ((24, 2), (40, 4), (56, 1), (70, 6)):
        a.fill(x, y, 1, 1, "white")
    for x in (14, 61):
        bd.tree(a, x, 10, "canopy", "pine", r=5, base=FAR_Y, girth=2)
    for x, w, wall_c, roof, curtain, top in ((-21, 28, "brick", "shale", None, 3),
                                             (23, 30, "cream", "slate", "gold", 2),
                                             (69, 28, "brick", "dslate", "gold", 3)):
        bd.house(a, x, w, wall_c, roof, "forest", top=top, base=FAR_Y, roof_h=9, parts=MINI, curtains=curtain)
        half = w / 2 + 3
        for i in range(1, 9):
            inset = round(i * half / 9)
            left = x - 3 + (w // 2 + 3) - inset
            a.fill(left, top + i, 1, 1, "white")
            a.fill(left + 2 * inset - 1, top + i, 1, 1, "white")
    a.street()
    bd.iron_fence(a, FAR_Y - 3, 0, 32, h=5)
    bd.iron_fence(a, FAR_Y - 3, 46, AW, h=5)
    return a


def high_park_view():
    trail = flecked("tan", "brown", 13, "cream")
    dark = tufted("pine")
    a = ZoneView("high-park", trail, dark, "dbrown", (2, 5), curb=None, walk=None, lawn=dark)
    a.sky("azure", "sky")
    bd.cloud(a, 54, 5, 16, 3, 2)
    a.treeline(15, ("fir", "pine"), 0, 2, 6)
    a.fill(0, 15, AW, FAR_Y - 15, "pine")
    bd.tree(a, 4, 9, "pink", "mauve", r=6, base=18, girth=2)
    bd.tree(a, 71, 10, "canopy", "pine", r=5, base=18, girth=2)
    for x in (11, 62):
        a.fill(x, 1, 2, FAR_Y - 1, "bark")
    a.fill(13, 2, 49, 17, "pine")
    a.fill(13, 2, 49, 1, "canopy")
    a.fill(13, 18, 49, 1, "fir")
    bd.word(a, "HIGH", AW / 2, 3, "gold")
    bd.word(a, "PARK", AW / 2, 10, "gold")
    a.street()
    for py in range(19, CROSS_Y):
        half = 7 + (py - 13) // 2
        for px in range(round(AW / 2) - half, round(AW / 2) + half):
            a.fill(px, py, 1, 1, trail(px, py))
    return a


def distillery_view():
    paving = flecked("brown", "brick", 19)
    a = ZoneView("distillery-district", flecked("dslate", "slate", 31, "navy"), paving, "lgrey", (3, 4),
                 curb="stone", walk="brown", lawn=paving, walk_fleck="brick", edge="stone")
    a.sky("peach", "skin1")
    a.fill(58, 0, 5, 10, "brick")
    a.fill(61, 0, 2, 10, "dbrick")
    for x, w, top, wall_c, trim in ((-6, 26, 5, "brick", "stone"), (20, 36, 1, "brick", "stone"),
                                    (56, 26, 7, "driftwood", "dstone")):
        bd.warehouse(a, x, w, top, FAR_Y, wall_c, trim)
    a.fill(24, 2, 28, 7, "dbrick")
    a.fill(24, 2, 28, 1, "coal")
    bd.string_lights(a, 0, 20, 8, 2)
    bd.string_lights(a, 56, AW, 9, 2)
    a.street()
    for x in (6, 64):
        bd.barrel(a, x, FAR_Y)
    return a


def kensington_view():
    paving = flecked("shale", "coal", 23)
    a = ZoneView("kensington-market", flecked("dbrick", "brick", 41), paving, "white", (3, 6), curb="stone",
                 walk="shale", lawn=paving, walk_fleck="coal", edge="mauve")
    bd.sunburst(a, AW / 2, FAR_Y + 2, 5, "lake", "dturq", FAR_Y, w=AW)
    for x, w, wall_c, roof, awn in ((-14, 28, "dturq", "navy", "dred"), (14, 26, "violet", "purple", "ochre"),
                                    (40, 26, "ochre", "dbrick", "dturq"), (66, 26, "olive", "dolive", "mauve")):
        for k in range(w // 2 + 2):
            a.fill(x - 1 + k, 7 - k // 2, w + 2 - 2 * k, 1, roof)
        a.fill(x, 7, w, FAR_Y - 7, wall_c)
        a.fill(x + w - 2, 7, 2, FAR_Y - 7, dk(wall_c))
        a.fill(x + 3, 9, 4, 3, "lake")
        a.fill(x + w - 8, 9, 4, 3, "lake")
        for i in range(0, w - 2, 4):
            a.fill(x + 1 + i, 14, 2, 2, awn)
            a.fill(x + 3 + i, 14, 2, 2, "cream")
        a.fill(x + 3, 17, w - 10, 4, "lake")
    for x0 in (0, AW - 5):
        for py in range(FAR_Y):
            a.fill(x0, py, 5, 1, bd.MURAL[(py // 4) % len(bd.MURAL)])
    bd.bunting(a, 5, 70, 4, 2, ("dred", "gold", "dturq", "lilac", "moss"))
    a.street()
    return a


def beaches_view():
    sand = flecked("skin1", "tan", 43)
    a = ZoneView("the-beaches", boards, sand, "dbrown", (4, 9), curb=None, walk="skin1", lawn=sand, walk_fleck="tan")
    a.sky("gold", "yellow")
    bd.cloud(a, 6, 5, 16, 2, 4)
    for py in range(8, 17):
        for px in range(AW):
            c = "dlake" if py < 10 else "lake" if py < 14 else "shallow"
            if bd.hashed(px // 3, py, 9) and py % 2 == 0:
                c = "foam"
            a.fill(px, py, 1, 1, c)
    a.fill(0, 17, AW, FAR_Y - 17, "skin1")
    a.fill(0, 17, AW, 1, "foam")
    a.fill(40, 10, 1, 4, "white")
    a.fill(41, 11, 2, 3, "white")
    a.fill(38, 14, 7, 1, "white")
    # the lifeguard station, small at this distance: a white box under a red roof on stilts
    a.fill(55, 15, 1, 5, "driftwood")
    a.fill(63, 15, 1, 5, "driftwood")
    a.fill(54, 9, 11, 6, "white")
    a.fill(62, 9, 3, 6, "lgrey")
    a.fill(57, 11, 4, 2, "dlake")
    for k in range(3):
        a.fill(53 + k, 8 - k, 13 - 2 * k, 1, "ttc")
    a.fill(59, 3, 1, 3, "coal")
    bd.umbrella(a, 16, FAR_Y, "ttc", "white")
    a.street()
    return a


def yonge_view():
    paving = flecked("dstone", "shale", 67)
    a = ZoneView("yonge-street", flecked("shale", "ash", 41), paving, "amber", (4, 8), curb="stone", walk="dstone",
                 lawn=paving, edge="coal", walk_fleck="shale")
    bd.bands(a, 0, FAR_Y, bd.YONGE_SKY, w=AW)
    for x, y in ((30, 1), (50, 3), (70, 2)):
        a.fill(x, y, 1, 1, "white")
    a.fill(61, 2, 3, 3, "haze")
    a.fill(61, 2, 1, 1, "white")
    # far off in haze, the CN Tower over everything, rising from behind the SkyDome past a low dark block,
    # the dome lined in ink along its top; then the nearer towers: glass where the tower is not, two in
    # front of the dome, the Royal Bank Plaza's gold, glass, First Canadian Place in white under its red band
    # and the TD Centre in black, lit windows on each
    cx = 18
    a.fill(cx, 0, 1, 3, "lgrey")
    a.fill(cx, 0, 1, 1, "red")
    a.fill(cx - 1, 3, 3, 2, "haze")
    a.fill(cx - 4, 5, 9, 2, "haze")
    a.fill(cx - 4, 6, 9, 1, "gold")
    a.fill(cx + 3, 5, 2, 2, "lgrey")
    a.fill(cx - 1, 7, 3, FAR_Y - 7, "haze")
    a.fill(cx + 1, 7, 1, FAR_Y - 7, "lgrey")
    a.fill(14, 11, 8, FAR_Y - 11, "coal")
    a.fill(14, 11, 8, 1, "ink")

    def dome(px, py):
        dx, dy = (px + 0.5 - 28) / 13, (py + 0.5 - (FAR_Y - 3)) / 9
        return dx * dx + dy * dy <= 1

    for py in range(FAR_Y - 12, FAR_Y):
        for px in range(14, 43):
            if dome(px, py):
                lit = px < 26 and not dome(px - 1, py - 1)
                a.fill(px, py, 1, 1, "lgrey" if px in (31, 35) else "white" if lit else "haze")
            elif dome(px, py + 1) or dome(px - 1, py) or dome(px + 1, py):
                a.fill(px, py, 1, 1, "ink")
    for x, w, top, wall_c, lit_c in ((0, 10, 4, "dlake", "gold"), (11, 7, 17, "coal", "gold"),
                                     (27, 9, 17, "dlake", "amber"), (36, 8, 6, "gold", "ochre"),
                                     (44, 12, 7, "dlake", "gold"), (56, 7, 5, "lgrey", "grey"),
                                     (63, 12, 8, "coal", "gold")):
        a.fill(x, top, w, FAR_Y - top, wall_c)
        a.fill(x + w - 1, top, 1, FAR_Y - top, dk(wall_c))
        for y in range(top + 2, FAR_Y - 2, 2):
            for c in range(x + 1, x + w - 2, 2):
                if wall_c in ("gold", "lgrey") or bd.hashed(c, y, 3):
                    a.fill(c, y, 1, 1, lit_c)
    a.fill(57, 5, 5, 1, "ttc")
    a.fill(64, 9, 1, 1, "green")
    a.fill(0, FAR_Y - 4, AW, 4, "coal")
    for x, w, c in ((10, 8, "pink"), (23, 8, "gold"), (44, 10, "turquoise"), (64, 9, "lilac")):
        a.fill(x, FAR_Y - 4, w, 1, c)
    for x in range(1, AW, 3):
        a.fill(x, FAR_Y - 2, 2, 2, "gold")
    a.street()
    return a


ILLUSTRATIONS = {
    "card-skunk-grooming": skunk_grooming,
    "card-skunk-rinse": skunk_rinse,
    "card-skunk-ignore": skunk_ignore,
    "card-other-dog-sniff": other_dog_sniff,
    "card-other-dog-pull-away": other_dog_pull_away,
    "card-thief-chase": thief_chase,
    "card-thief-let-go": thief_let_go,
    "card-lost-wallet-keep": wallet_keep,
    "card-petting-neighbor-take": neighbour_take,
    "card-belly-rubs": belly_rubs,
    "card-good-leash": good_leash,
    "card-big-tipper": big_tipper,
    "card-rush-hour": rush_hour,
    "card-raincoats": raincoats,
    "card-sweet-talker": sweet_talker,
    "card-skip": skip,
    "card-zone-cabbagetown": cabbagetown_view,
    "card-zone-high-park": high_park_view,
    "card-zone-distillery-district": distillery_view,
    "card-zone-kensington-market": kensington_view,
    "card-zone-the-beaches": beaches_view,
    "card-zone-yonge-street": yonge_view,
}


def card_frame_tags():
    """{illustration key: the card-frame tag the game shows it in}, from the game's export: each card
    face's frame; any other art shows in encounter."""
    return {card["art"]: card["frame"] for card in sn.GAME["cards"]}


FRAME_TAGS = card_frame_tags()


def card_kind(key):
    """The frame an illustration shows in, as the game picks it."""
    return FRAME_TAGS.get(key, "encounter")


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
    im.paste(art.resize((AW * scale, AH * scale), Image.NEAREST), (4 * scale, 16 * scale))
    bg = Image.new("RGB", im.size, sn.rgb("dbrown"))
    bg.paste(im, (0, 0), im)
    return bg


def preview(out, scale=3):
    """Every illustration in a normal card, then one enlarged card per card type."""
    keys = list(ILLUSTRATIONS)
    cols = 10
    rows = (len(keys) + cols - 1) // cols
    big = [("encounter", "card-skunk-rinse"), ("route", "card-zone-cabbagetown")]
    width = max((CW + 6) * cols, (LW + 6) * len(big))
    sheet = Image.new("RGB", (width * scale, ((CH + 6) * rows + LH + 6) * scale), sn.rgb("ink"))
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
