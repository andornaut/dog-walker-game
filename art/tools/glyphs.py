#!/usr/bin/env python3
"""Draw the info icons shown beside a dog in the pack picker, the shop and the zone banner, a walker's
pace and style icons, the dog status icons on the doghouse heart board, and the run top bar's state strip icons.

16x16 images in Endesga 32 with coloured outlines, on transparency:
icon-trait-<trait>          fancy (a pink bow), food-driven (a bone), chaser (a squirrel)
icon-pace-<pace>            a walker's pace, on walker tiles and the detail card: slow (a snail), fast
                            (a hare bounding, with speed lines)
icon-style-<style>          a walker's style beside the pace: charm (a red rose with a twinkle),
                            hustle (a green money bag with a yellow $)
icon-quirk-<dog>            each dog's quirk, beside its trait, outlined to hold 3:1 on cream and
                            tan: archie Acrobatic (a red arrow looping a flip around a paw),
                            biscuit Scent hound (a beagle in profile sniffing scent lines from a
                            tip one lane over), duchess Pampered (a treat bone under two hearts),
                            koda Sled dog (a sled racing right over speed lines), nugget Camera
                            ready (a camera with a flash star), penny Nervous (a golden dog on stiff
                            legs, hackles up, trembling), pierre Show dog (a purple prize rosette),
                            snowball Crowd pleaser (a crowd of three under a heart), zippy Ratter
                            (a white foreleg stamping on a squirrel's tail)
icon-energy-<energy>        calm (a sleepy moon), steady (a paw print), hyper (a lightning bolt)
icon-owner-<temperament>    laid-back (sunglasses and a grin), fussy (a frown and a cross mark),
                            dramatic (a wail and a tear)
icon-zone-<zone>            snooze-crescent (a crescent moon over a roof), bark-park (a tree),
                            woof-way (a house), sniff-street-shops (a shopfront),
                            paws-promenade (a railing over a wave), the-long-way-home (a
                            sunset over a path); each inside a 1px ring for its outline, which
                            holds 3:1 on cream and tan as the need icons' does
icon-soaked, icon-spooked   dog statuses beside icon-stinky (ui.py), on cream: water drops; a
                            wide-eyed, floppy-eared dog face with fright lines and a sweat drop
icon-tangled                two loops of green leash knotted through each other, teal-outlined
icon-tuckered-out           the dog face gone droopy: eyes shut, tongue out, a yellow z rising
icon-upgrade-<upgrade>      state strip, on the top bar's ink: belly-rubs (a hand under a heart),
                            big-tipper (coins and an up arrow), good-leash (a leash), raincoats
                            (a yellow raincoat), rush-hour (an alarm clock), second-wind (two
                            hearts on the wind), shortcut (two chevrons), sweet-talker (a speech
                            bubble with $ and a down arrow), treat-magnet (a magnet and a bone)
icon-gear-<gear>            state strip, on ink: the shop's item art (icons.py) at 16x16
icon-bump, icon-fired,      the walk's message strip, beside its lines, on cream: bump (an amber
icon-hint, icon-last-heart, impact burst), fired (a pink slip under a dred stamp), hint (a white i
icon-lucky                  on a sky disc), last-heart (a red heart cracked down from its notch),
                            lucky (a four-leaf clover with a twinkle)
The upgrade and gear ids are the data ids in kebab case. icon-stinky also reads on ink.

Sprite: ui-difficulty (55x10; tags 1 to 5), a zone's difficulty under its name on a fork's path
card: that many filled paws out of five, 11px apart. A filled paw is amber, a hollow one a tan
rim around an empty pad, both outlined in plum, so they differ by shape on cream and on the
card's plum frame.

Usage:
  glyphs.py preview OUT.png   every icon on the UI's paper, panel, wood and ink colours, then
                              ui-difficulty's tags, scaled up
  glyphs.py build             write art/glyphs/*.aseprite, export to public/art/images/ and
                              public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from pixel import DARKER, K, Grid, build as build_sprites, icon_edge  # noqa: E402
from fx import burst, star4  # noqa: E402
from needs import SCENT, Icon  # noqa: E402
from ui import to_image  # noqa: E402


def bitmap(g, x0, y0, rows, cols):
    """Stamp rows of characters; each character maps to a colour in cols, '.' is empty."""
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in cols:
                g.p(x0 + x, y0 + y, cols[ch])


# ---------- traits ----------

def fancy():
    g = Grid(16, 16)
    for s in (-1, 1):
        g.tri((8, 8), (8 + s * 7, 2.5), (8 + s * 7, 13.5), "pink")
        g.ell(8 + s * 5, 8, 2.6, 4.6, "pink")
        g.p(8 + s * 6, 11, "mauve")
        g.p(8 + s * 5, 12, "mauve")
        g.p(8 + s * 5, 5, "white" if s < 0 else "pink")
    g.tri((7, 9), (5, 14), (7.5, 14), "mauve")
    g.tri((9, 9), (11, 14), (8.5, 14), "mauve")
    g.ell(8, 8, 2, 2.5, "hot")
    g.p(7, 7, "pink")
    return g


def food_driven():
    g = Grid(16, 16)
    for i in range(11):
        g.rect(3 + i, 11 - i, 2, 2, "cream")
    for cx, cy in ((2.5, 11.5), (4.5, 13.5), (11.5, 2.5), (13.5, 4.5)):
        g.ell(cx, cy, 2, 2, "cream", "tan")
    for i in range(8):
        g.p(6 + i, 11 - i, "tan")
    g.p(10, 3, "white")
    g.p(11, 2, "white")
    return g


def chaser():
    g = Grid(16, 16)
    g.ell(11.5, 6, 3.5, 5.5, "ochre", "rust", "tan")
    g.ell(11.5, 6.5, 1.5, 3.5, "tan")
    g.ell(8.5, 9, 1.4, 4, "rust")
    g.ell(7, 11, 3.5, 3.8, "ochre", "rust", "tan")
    g.ell(5.5, 12, 1.6, 2.4, "cream")
    g.ell(5, 6, 3, 2.8, "ochre", "rust", "tan")
    g.p(6, 3, "ochre")
    g.p(6, 2, "rust")
    g.rect(4, 5, 1, 2, "ink")
    g.p(2, 7, "plum")
    g.rect(4, 14, 2, 1, "rust")
    return g


# ---------- walkers: pace and style, on walker tiles and the detail card ----------
# Animals and objects with no bow, bone, squirrel, moon, paw or bolt, so they never read as a dog's trait or
# energy: slow and fast are a snail and a hare, charm a rose and hustle a money bag.

def pace_slow():
    """A snail creeping right: an amber shell coiled in orange over a yellow foot, its eye stalk up."""
    g = Grid(16, 16)
    g.rect(1, 12, 14, 2, "yellow")
    g.rect(1, 13, 14, 1, "amber")
    g.ell(13, 10.5, 2, 2.5, "yellow", "amber")
    g.rect(13, 5, 1, 4, "yellow")
    g.rect(13, 4, 2, 2, "yellow")
    g.p(14, 4, "ink")
    g.ell(6, 7.5, 5, 5, "amber", "orange", "yellow")
    bitmap(g, 3, 4, ["..ooo..", ".o...o.", "o..o..o", "o.o.o.o", "o..o..o", ".o....o"], {"o": "rust"})
    g.p(14, 10, "ink")
    return g


def pace_fast():
    """A hare at full stretch, bounding right: ears laid back, forelegs reaching, hind legs kicked out behind,
    with speed lines streaming off its back."""
    g = Grid(16, 16)
    bitmap(g, 0, 1, ["........ww......",
                     ".......wppw.....",
                     ".sss.....wppw...",
                     "...........wwww.",
                     "........wwwwwww.",
                     ".ss..wwwwwwwwkw.",
                     "...wwwwwwwwwwwp.",
                     "..wwwwwwwwwwwwl.",
                     "..wwwwwwwwwwll..",
                     "...lwwwwwwlll...",
                     "..ll.......lwww.",
                     ".ll..........ww."],
           {"w": "white", "l": "lgrey", "p": "pink", "k": "ink", "s": "sky"})
    return g


def style_charm():
    """A red rose on a green stem with a leaf, and a twinkle beside the bloom."""
    g = Grid(16, 16)
    g.rect(7, 8, 2, 7, "dgreen")
    g.rect(7, 8, 1, 7, "green")
    g.ell(4.5, 11.5, 2.5, 1.5, "green", "dgreen")
    g.ell(7.5, 5, 4.5, 4, "red", "dred", "pink")
    bitmap(g, 5, 3, ["..d..", ".d.d.", "d.d.d", ".dd.."], {"d": "dred"})
    star4(g, 13, 3, 2, "yellow")
    g.p(15, 3, None)
    return g


def style_hustle():
    """A money bag: a green sack tied at the neck with an amber cord, a yellow $ on its front."""
    g = Grid(16, 16)
    g.ell(8, 10.5, 6, 5, "green", "dgreen")
    g.rect(6, 3, 4, 3, "green")
    g.tri((4.5, 1), (8, 4.5), (6.5, 1), "green")
    g.tri((11.5, 1), (8, 4.5), (9.5, 1), "dgreen")
    g.rect(5, 5, 6, 1, "amber")
    bitmap(g, 6, 7, [".y.", "yyy", "y..", "yyy", "..y", "yyy", ".y."], {"y": "yellow"})
    return g


# ---------- quirks: one per dog, beside its trait ----------
# On Icon (needs.py), so outlines run down the ramp until they hold 3:1 on cream and tan, and
# 1px marks go on after the outline.

def acrobatic():
    """Archie: a red arrow looping a full flip around a paw print."""
    g = Icon()
    for y in range(16):
        for x in range(16):
            dx, dy = x + 0.5 - 7.5, y + 0.5 - 8.5
            a = math.degrees(math.atan2(dy, dx))
            if 5 <= math.hypot(dx, dy) <= 6.8 and not -5 < a < 80:
                g.p(x, y, "pink" if dx < -1 and dy < -1 and math.hypot(dx, dy) < 5.8 else "red")
    bitmap(g, 10, 8, ["1111111", ".11112.", "..112..", "...2..."], {"1": "red", "2": "dred"})
    bitmap(g, 5, 6, ["1.1.1", ".....", ".222.", ".222."], {"1": "skin2", "2": "brown"})
    return g


def scent_hound():
    """Biscuit: a beagle's head in profile, long ear down, sniffing scent lines that reach sideways from a
    tip one lane over."""
    g = Icon()
    bitmap(g, 6, 1, ["....oooo..",
                     "...oooooo.",
                     "..oooeooo.",
                     ".kkwwoorrr",
                     ".kkwwworrr",
                     "..wwwwrrrr",
                     "...www.rrr",
                     "......grr.",
                     ".....ggg..",
                     "........r."],
           {"o": "ochre", "w": "white", "r": "rust", "e": "ink", "k": "ink", "g": "green"})
    g.ell(3, 12.5, 3, 3, "amber", "orange", "yellow")
    g.rect(3, 11, 1, 3, "orange")
    for x0, y0 in ((0, 3), (1, 7)):
        for dx, dy in SCENT:
            g.marks.append((x0 + dx, y0 + dy, "purple"))
    return g


def pampered():
    """Duchess: a treat bone under two hearts."""
    g = Icon()
    heart(g, 1, 1)
    heart(g, 8, 3)
    g.rect(4, 12, 8, 2, "cream")
    for cx, cy in ((3.5, 11.5), (3.5, 13.5), (12.5, 11.5), (12.5, 13.5)):
        g.ell(cx, cy, 1.6, 1.6, "cream", "tan")
    g.rect(4, 13, 8, 1, "tan")
    g.p(4, 12, "white")
    return g


def sled_dog():
    """Koda: a dog sled racing right, its driver's handlebar at the back, the runner curling up at the
    front, speed lines trailing behind."""
    g = Icon()
    g.rect(4, 3, 1, 6, "brown")
    g.rect(4, 3, 3, 1, "brown")
    g.rect(4, 8, 9, 2, "brown")
    g.rect(4, 8, 9, 1, "ochre")
    for x in (5, 8, 11):
        g.rect(x, 10, 1, 2, "dbrown")
    g.rect(3, 12, 10, 1, "lgrey")
    bitmap(g, 12, 7, ["..11", "...1", "...1", "...1", "..1.", "11.."], {"1": "lgrey"})
    for x, y, w in ((0, 5, 3), (0, 9, 3), (0, 12, 2)):
        g.rect(x, y, w, 1, "sky")
    return g


def camera_ready():
    """Nugget: a camera with a flash star at its top right."""
    g = Icon()
    g.rect(1, 6, 13, 8, "slate")
    g.rect(1, 6, 13, 1, "grey")
    g.rect(3, 4, 4, 2, "slate")
    g.ell(7.5, 10, 3.3, 3.3, "lgrey", "grey", "white")
    g.ell(7.5, 10, 1.9, 1.9, "sky", "blue", "cyan")
    g.p(11, 8, "red")
    star4(g, 12, 3, 2, "yellow")
    return g


def nervous():
    """Penny: a golden dog in profile on stiff legs, hackles bristling along her back, ear flat, tail
    tucked, trembling."""
    g = Icon()
    for x in (3, 5, 9, 11):
        g.rect(x, 11, 1, 4, "amber")
    g.ell(7.5, 9.5, 5, 2.8, "amber", "orange", "yellow")
    g.ell(12.5, 6.5, 3, 2.6, "amber", "orange", "yellow")
    g.rect(14, 7, 2, 2, "amber")
    g.p(15, 7, "ink")
    g.ell(11.5, 7.5, 1.2, 2.2, "orange")
    g.p(13, 6, "ink")
    g.p(14, 5, "white")
    for x in (3, 5, 7, 9):
        g.tri((x - 1, 7.5), (x + 0.5, 4.5), (x + 1.5, 7.5), "ochre")
    g.rect(2, 10, 2, 2, "orange")
    g.p(4, 12, "orange")
    for x, y in ((0, 5), (1, 6), (0, 7), (0, 10), (1, 11), (0, 12)):
        g.marks.append((x, y, "purple"))
    return g


def show_dog():
    """Pierre: a purple prize rosette with a gold centre and two ribbon tails."""
    g = Icon()
    for x0, slant in ((4, -1), (9, 1)):
        g.tri((x0, 9), (x0 + 3, 9), (x0 + 1.5 + slant * 2, 15.5), "purple")
    g.ell(8, 6.5, 6.5, 6.5, "mauve")
    for i in range(12):
        a = math.radians(i * 30)
        g.p(8 + 6.2 * math.cos(a) - 0.5, 6.5 + 6.2 * math.sin(a) - 0.5, None)
    g.ell(8, 6.5, 4.2, 4.2, "purple")
    g.ell(8, 6.5, 2.6, 2.6, "amber", "orange", "yellow")
    return g


def crowd_pleaser():
    """Snowball: a crowd of three under a heart."""
    g = Icon()
    for cx, cy, r, skin, hair, shirt in ((2.5, 9, 2.3, "skin1", "dbrown", "sky"),
                                        (13.5, 9, 2.3, "brown", "plum", "red"),
                                        (8, 10.5, 2.7, "skin2", "amber", "green")):
        g.ell(cx, cy + 5, r + 0.6, 2.6, shirt)
        g.ell(cx, cy, r, r, skin)
        for y in range(16):
            for x in range(16):
                if y + 0.5 < cy - r * 0.35 and math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r:
                    g.p(x, y, hair)
        g.p(cx - 1.5, cy, "ink")
        g.p(cx + 0.5, cy, "ink")
    heart(g, 5, 0)
    return g


def ratter():
    """Zippy: a white foreleg stamping down on a squirrel's bushy tail, pinning it."""
    g = Icon()
    g.ell(5, 6, 4.5, 5.5, "ochre", "rust", "tan")
    g.ell(5.5, 6.5, 2, 3.5, "tan")
    g.ell(3.5, 2, 2, 1.6, "ochre")
    g.ell(8.5, 12, 4.5, 2.6, "ochre", "rust")
    g.ell(14.5, 14, 1.6, 1.6, "ochre", "rust")
    g.rect(11, 3, 4, 7, "white")
    g.rect(14, 3, 1, 7, "lgrey")
    g.ell(12, 11.5, 3.5, 2.5, "white", "lgrey")
    for x in (11, 13):
        g.rect(x, 12, 1, 2, "grey")
    return g


# ---------- energy ----------

def calm():
    g = Grid(16, 16)
    g.ell(7, 9, 5.5, 5.5, "lgrey", "grey", "white")
    g.ell(9.5, 7, 4.5, 4.5, None)
    bitmap(g, 10, 1, ["111", "..1", ".1.", "1..", "111"], {"1": "sky"})
    return g


def steady():
    g = Grid(16, 16)
    g.ell(8, 11.5, 3.6, 3, "brown", "dbrown", "ochre")
    for cx, cy in ((2.5, 7), (6, 4), (10, 4), (13.5, 7)):
        g.ell(cx, cy, 1.5, 1.8, "brown", "dbrown", "ochre")
    return g


def hyper():
    g = Grid(16, 16)
    g.tri((10, 0.5), (3, 9.5), (8.5, 9.5), "yellow")
    g.tri((7.5, 6.5), (13, 6.5), (5, 15.5), "yellow")
    g.tri((8.5, 9.5), (13, 6.5), (5, 15.5), "amber")
    g.p(8, 3, "white")
    return g


# ---------- owner temperaments: one face, three moods ----------

def face():
    g = Grid(16, 16)
    g.ell(8, 8.5, 6.5, 6.5, "skin1", "skin2")
    return g


def laid_back():
    g = face()
    g.rect(3, 6, 4, 3, "ink")
    g.rect(9, 6, 4, 3, "ink")
    g.rect(7, 6, 2, 1, "ink")
    g.p(4, 6, "slate")
    g.p(10, 6, "slate")
    bitmap(g, 5, 10, ["1....1", ".1111."], {"1": "dbrown"})
    return g


def fussy():
    g = face()
    bitmap(g, 3, 5, ["11....11", "..1..1.."], {"1": "dbrown"})
    g.rect(5, 7, 1, 2, "ink")
    g.rect(10, 7, 1, 2, "ink")
    bitmap(g, 5, 11, [".111.", "1...1"], {"1": "dbrown"})
    bitmap(g, 11, 1, ["1.1", ".1.", "1.1"], {"1": "red"})
    return g


def dramatic():
    g = face()
    bitmap(g, 3, 4, [".11....11.", "1........1"], {"1": "dbrown"})
    for x in (4, 10):
        g.rect(x, 6, 2, 3, "ink")
        g.p(x, 6, "white")
    g.ell(8, 12, 1.6, 2, "plum")
    g.p(8, 13, "red")
    g.rect(11, 9, 1, 2, "cyan")
    g.rect(11, 11, 2, 2, "cyan")
    g.p(11, 11, "white")
    return g


# ---------- zones, after their backdrops ----------

class Zone(Grid):
    """A 16x16 zone picture drawn only inside the 1px ring its outline takes, with icon_edge outlines like
    the need icons, so a picture that fills its frame is outlined on every side."""

    def __init__(self):
        super().__init__(16, 16)
        self.edge = icon_edge

    def p(self, x, y, c):
        if 1 <= int(x) <= 14 and 1 <= int(y) <= 14:
            super().p(x, y, c)


def woof_way():
    g = Zone()
    g.tri((0.5, 7.5), (8, 1), (15.5, 7.5), "red")
    g.rect(1, 7, 14, 1, "dred")
    g.rect(2, 8, 12, 7, "cream")
    g.rect(13, 8, 1, 7, "tan")
    g.rect(4, 10, 3, 5, "sky")
    g.p(6, 12, "amber")
    g.rect(9, 9, 3, 3, "cyan")
    g.rect(9, 9, 3, 1, "white")
    return g


def bark_park():
    g = Zone()
    g.rect(7, 9, 2, 5, "dbrown")
    g.ell(8, 6.5, 6.5, 5.5, "green", "dgreen")
    g.p(4, 4, "yellow")
    g.p(5, 3, "yellow")
    g.p(5, 7, "dgreen")
    g.p(10, 4, "dgreen")
    g.rect(1, 13, 14, 2, "dgreen")
    g.rect(1, 13, 14, 1, "green")
    return g


def sniff_street_shops():
    g = Zone()
    g.rect(1, 2, 14, 13, "rust")
    g.rect(14, 2, 1, 13, "dbrown")
    for x in range(1, 15, 4):
        g.rect(x, 4, 2, 3, "red")
        g.rect(x + 2, 4, 2, 3, "white")
    g.rect(1, 7, 14, 1, "dred")
    g.rect(2, 9, 7, 5, "cyan")
    g.p(3, 10, "white")
    g.rect(10, 9, 3, 6, "dbrown")
    g.p(12, 12, "amber")
    g.rect(1, 2, 14, 1, "ochre")
    return g


def the_long_way_home():
    g = Zone()
    g.ell(8, 9, 5, 5, "amber", "orange", "yellow")
    for x, y in ((8, 1), (2, 5), (14, 5), (1, 9), (14, 9)):
        g.p(x, y, "amber")
    g.ell(8, 16, 9, 6, "green", "dgreen")
    g.tri((7.5, 10), (8.5, 10), (12, 16), "tan")
    g.tri((7.5, 10), (4, 16), (12, 16), "tan")
    return g


def snooze_crescent():
    g = Zone()
    g.ell(11, 5, 4.5, 4.5, "yellow")
    g.ell(13.5, 3.5, 3.6, 3.6, None)
    g.p(2, 2, "white")
    g.p(14, 9, "white")
    g.tri((0.5, 11.5), (6, 5.5), (11.5, 11.5), "purple")
    g.rect(1, 11, 10, 1, "plum")
    g.rect(2, 12, 8, 3, "lgrey")
    g.rect(9, 12, 1, 3, "grey")
    g.rect(4, 12, 3, 2, "amber")
    g.p(4, 12, "yellow")
    return g


def paws_promenade():
    g = Zone()
    g.rect(0, 1, 16, 2, "ochre")
    g.rect(0, 1, 16, 1, "tan")
    g.rect(0, 5, 16, 1, "ochre")
    for x in (2, 12):
        g.rect(x, 3, 2, 5, "brown")
    g.rect(0, 7, 16, 2, "brown")
    g.rect(0, 7, 16, 1, "tan")
    g.rect(0, 10, 16, 6, "sky")
    bitmap(g, 0, 10, ["..cc......cc....", ".c..c....c..c...", "c....cccc....ccc"], {"c": "cyan"})
    g.rect(0, 14, 16, 1, "blue")
    g.p(6, 13, "white")
    return g


# ---------- dog statuses, on the doghouse's cream heart board beside icon-stinky ----------
# Like icon-stinky, each reads on cream by its outline (navy, blue, dbrown and plum hold 5.8:1
# or more there) and differs from the others by shape: drops, a scared face, a knot, a sleepy
# face, stink lines.

def drop(g, cx, top, r, fill, sh=None, li=None):
    """A water drop: a point at (cx, top) over a round base of radius r."""
    base = top + 2.2 * r
    g.tri((cx, top), (cx - r * 0.93, base - r * 0.4), (cx + r * 0.93, base - r * 0.4), fill)
    g.ell(cx, base, r, r, fill, sh, li)


def soaked():
    """One big drop and two small ones falling beside it."""
    g = Grid(16, 16)
    drop(g, 6, 1, 4.6, "sky", "blue", "cyan")
    g.rect(5, 4, 1, 3, "cyan")
    g.rect(3, 9, 1, 3, "white")
    g.p(4, 8, "white")
    for x, y in ((12, 1), (12, 9)):
        bitmap(g, x, y, [".s.", ".s.", "sss", "ssb", ".b."], {"s": "sky", "b": "blue"})
    return g


MUDDY = (
    "................",
    "................",
    ".....lb..lb.....",
    ".....bd..bd.....",
    ".....bd..bd.....",
    "..lb........lb..",
    "..bd........bd..",
    "..bd........bd..",
    "......lbbb......",
    ".....lbbbbd.....",
    "....lbbbbbbd....",
    "....bbbbbbbd....",
    ".....bdbbdd.....",
    "......d..d......",
    "......d..d......",
    ".........d......",
)


def muddy():
    """A muddy paw print, MUDDY: four toes and a pad in brown, lit tan on their top left and shaded
    dbrown on the right, in a plum line, with two drips of mud running off the pad."""
    g = Grid(16, 16)
    g.edge = lambda c: K["plum"]
    bitmap(g, 0, 0, list(MUDDY), {"b": "brown", "d": "dbrown", "l": "tan"})
    return g


def spooked():
    """A dog's face gone wide-eyed, long ears hanging, with fright lines and a sweat drop as in
    fx-status-spooked (hits.py): the white lines rimmed in plum, the cyan drop in navy, so both
    hold on cream and ink."""
    g = Grid(16, 16)
    g.edge = lambda c: K["plum"] if c == K["white"] else K["navy"] if c in (K["cyan"], K["sky"]) else DARKER[DARKER[c]]
    g.ell(8, 9.5, 5, 4.8, "tan", "brown")
    for cx in (3, 13):
        g.ell(cx, 10, 1.6, 4.2, "brown")
    g.ell(8, 12.5, 3, 2, "cream")
    for x in (5, 9):
        g.rect(x, 7, 3, 3, "white")
        g.p(x + 1, 8, "ink")
    g.rect(7, 11, 3, 1, "ink")
    g.p(8, 12, "ink")
    g.p(8, 13, "plum")
    # fright lines fanning out over the head's top left
    for x, y in ((0, 5), (1, 5), (1, 1), (2, 2), (5, 0), (5, 1)):
        g.p(x, y, "white")
    bitmap(g, 12, 0, [".c.", "cwc", "cws", ".s."], {"c": "cyan", "w": "white", "s": "sky"})
    return g


class Drawn(Grid):
    """A 16x16 icon already outlined part by part: outlined() returns its pixels as they are."""

    def __init__(self, g):
        super().__init__(16, 16)
        self.px = g.px

    def outlined(self, outline=True):
        return [row[:] for row in self.px]


def tangled():
    """Two loops of leash knotted through each other, as in fx-status-tangled (hits.py) in a
    thicker rope: green lit yellow and shaded dgreen, A over B at the upper crossing and under it
    at the lower one, the loose ends trailing off. Each part takes the overlay's teal rim (8.3:1 on
    cream, 6.4:1 on amber), laid in turn so the crossings read; on ink the green rope (8.4:1)
    carries it."""
    from hits import knot, rope_loop

    a = rope_loop(16, 6, 6, 4.8, 4.4, 1.6, "dgreen")
    b = rope_loop(16, 10.5, 10.5, 4.2, 3.8, 1.6, "dgreen")
    for x, y in ((2, 10), (1, 11), (1, 12), (2, 13)):
        a.p(x, y, "green")
    for x, y in ((14, 7), (14, 6), (14, 5)):
        b.p(x, y, "green")
    return Drawn(knot(a, b, 6, 9))


def tuckered_out():
    """The dog's face from icon-spooked gone droopy: eyes shut under heavy lids, ears flat, tongue
    lolling, and a yellow z rising off its head as in fx-status-tuckered-out (hits.py), the z
    outlined in plum, so it holds on cream, amber and ink."""
    g = Grid(16, 16)
    g.edge = lambda c: K["plum"] if c == K["yellow"] else DARKER[DARKER[c]]
    g.ell(7, 10.5, 5, 4.5, "tan", "brown")
    for cx in (2, 12):
        g.ell(cx, 11.5, 1.6, 3.6, "brown")
    g.ell(7, 13, 3, 1.8, "cream")
    # shut eyes: a brown lid over an ink lash line
    for x in (4, 8):
        g.rect(x, 9, 3, 1, "brown")
        g.rect(x, 10, 3, 1, "ink")
    g.rect(6, 12, 3, 1, "ink")
    g.rect(7, 13, 2, 2, "pink")
    g.p(8, 14, "red")
    bitmap(g, 10, 1, ["zzzz", "..z.", ".z..", "zzzz"], {"z": "yellow"})
    return g


# ---------- the state strip, in the top bar's ink wells (#181425) ----------
# Every fill that carries a shape holds 3:1 or more on ink; the darker coloured outlines sink
# into the well, so the silhouette is the fill. Dark ramp colours (dbrown, dred, forest, blue)
# appear only inside a lighter fill.

HEART = [".11.11.", "1111111", "1111111", ".11111.", "..111..", "...1..."]
BIG_HEART = [".111.111.", "11111111p", "1111111pp", "111111ppp", ".11111pp.", "..111pp..", "...1pp...", "....p...."]


def heart(g, x, y, big=False):
    bitmap(g, x, y, BIG_HEART if big else HEART, {"1": "red", "p": "hot"})
    g.p(x + 1, y + 1, "pink")


def belly_rubs():
    """A hand rubbing below a heart."""
    g = Grid(16, 16)
    heart(g, 6, 1, big=True)
    bitmap(g, 1, 9, ["....ssssss..", "ssssssssssss", "sssssddddd..", "sssssssssss.", "ssssdddd....",
                     "ssssssssss.."], {"s": "skin1", "d": "skin2"})
    return g


def second_wind():
    """Two hearts lifted on gusts of wind."""
    g = Grid(16, 16)
    heart(g, 8, 2)
    heart(g, 6, 8)
    for x, y, w in ((1, 4, 5), (0, 10, 4), (2, 14, 6)):
        g.rect(x, y, w, 1, "white")
    g.p(6, 3, "white")
    g.p(8, 15, "white")
    return g


def big_tipper():
    """A stack of coins with an arrow up."""
    g = Grid(16, 16)
    for x, y in ((1, 12), (2, 10), (1, 8), (2, 6)):
        g.rect(x, y, 8, 2, "amber")
        g.rect(x, y + 1, 8, 1, "orange")
        g.p(x + 1, y, "yellow")
    g.ell(6, 4.5, 4, 2, "yellow", "amber")
    g.rect(4, 4, 4, 1, "amber")
    g.tri((13, 0.5), (9.5, 5.5), (16.5, 5.5), "green")
    g.rect(12, 5, 2, 9, "green")
    return g


def good_leash():
    """A leash: a handle loop, the line and its clip."""
    g = Grid(16, 16)
    g.ell(4.5, 4.5, 3.8, 3.8, "red", None, "pink")
    g.ell(4.5, 4.5, 1.8, 1.8, None)
    for i in range(6):
        g.rect(7 + i, 7 + i, 2, 1, "red")
    g.ell(13, 13, 2.3, 2.3, "lgrey", "grey", "white")
    g.p(13, 13, "slate")
    return g


def raincoats():
    """A yellow raincoat with its hood up, and a drop of rain."""
    g = Grid(16, 16)
    bitmap(g, 2, 2, [
        "....yyyy....",
        "...yyyyya...",
        "..yy....ya..",
        "..yy....ya..",
        ".yyyy..yyaa.",
        "yyyyyyyyyyaa",
        "yyy.yyyy.yaa",
        "yy..yykyy.aa",
        "....yyyyya..",
        "....yykyya..",
        "...yyyyyyya.",
        "...yyyyyyaa.",
        "...yyyyyaaa.",
    ], {"y": "yellow", "a": "amber", "k": "orange"})
    drop(g, 1.5, 0, 1.3, "cyan", "sky")
    return g


def treat_magnet():
    """A horseshoe magnet pulling a bone."""
    g = Grid(16, 16)
    g.ell(10, 6.5, 5, 5, "red", None, "pink")
    g.ell(10, 6.5, 2, 2, None)
    g.rect(5, 6, 11, 6, None)
    g.rect(5, 6, 3, 4, "red")
    g.rect(12, 6, 3, 4, "red")
    g.rect(5, 10, 3, 2, "lgrey")
    g.rect(12, 10, 3, 2, "lgrey")
    bitmap(g, 0, 12, ["cc...cc", ".ccccc.", "cc...cc"], {"c": "cream"})
    bitmap(g, 3, 7, ["1.", "..", ".1"], {"1": "lgrey"})
    return g


def sweet_talker():
    """A speech bubble saying money goes down."""
    g = Grid(16, 16)
    g.rect(1, 2, 14, 9, "white")
    g.rect(0, 3, 16, 7, "white")
    g.rect(1, 10, 14, 1, "lgrey")
    g.tri((3, 10), (3, 15), (7, 10), "white")
    bitmap(g, 3, 3, [".s.", "sss", "s..", "sss", "..s", "sss", ".s."], {"s": "forest"})
    bitmap(g, 8, 3, ["..d..", "..d..", "..d..", "ddddd", ".ddd.", "..d.."], {"d": "dred"})
    return g


def shortcut():
    """Two chevrons pointing ahead."""
    g = Grid(16, 16)
    for x0 in (1, 7):
        for i in range(6):
            g.rect(x0 + i, 2 + i, 3, 1, "amber")
            g.rect(x0 + i, 13 - i, 3, 1, "orange" if i < 5 else "amber")
    return g


def rush_hour():
    """An alarm clock ringing."""
    g = Grid(16, 16)
    g.ell(3.5, 3.5, 2.5, 2.5, "amber", "orange", "yellow")
    g.ell(12.5, 3.5, 2.5, 2.5, "amber", "orange", "yellow")
    g.rect(3, 13, 2, 3, "lgrey")
    g.rect(11, 13, 2, 3, "lgrey")
    g.ell(8, 9, 6, 6, "red", None, "pink")
    g.ell(8, 9, 4, 4, "white", "lgrey")
    g.rect(8, 6, 1, 4, "ink")
    g.rect(9, 9, 2, 1, "ink")
    return g


# The gear, after its 32x32 item art in icons.py.

def gear_fanny_pack():
    g = Grid(16, 16)
    g.rect(0, 5, 16, 2, "brown")
    g.rect(12, 4, 3, 4, "lgrey")
    g.ell(7.5, 10, 6.5, 4.5, "amber", "orange", "yellow")
    g.rect(3, 9, 9, 1, "orange")
    g.p(11, 9, "lgrey")
    return g


def gear_whistle():
    g = Grid(16, 16)
    g.ell(6, 10, 4.5, 4.5, "lgrey", "grey", "white")
    g.rect(8, 5, 7, 4, "lgrey")
    g.rect(8, 8, 7, 1, "grey")
    g.rect(5, 9, 2, 2, "slate")
    g.rect(1, 2, 2, 5, "red")
    g.rect(1, 1, 7, 2, "red")
    return g


def gear_poop_bags():
    g = Grid(16, 16)
    g.ell(7, 7.5, 6, 6, "green", "dgreen", "yellow")
    g.ell(7, 7.5, 2, 2, "forest")
    g.tri((10, 10), (15.5, 14), (11, 15), "green")
    g.rect(11, 11, 2, 2, "green")
    return g


def gear_running_shoes():
    g = Grid(16, 16)
    g.ell(8, 9.5, 7, 4, "sky", None, "cyan")
    g.rect(1, 11, 14, 2, "white")
    g.rect(1, 13, 14, 1, "lgrey")
    g.rect(4, 6, 5, 1, "white")
    g.rect(10, 8, 4, 2, "orange")
    return g


def gear_lucky_collar():
    g = Grid(16, 16)
    g.ell(8, 6, 6.5, 4.5, "red", None, "pink")
    g.ell(8, 6, 4.5, 2.5, None)
    g.ell(8, 12, 3, 3, "amber", "orange", "yellow")
    for x, y in ((7, 11), (8, 11), (7, 12), (9, 12), (8, 13)):
        g.p(x, y, "green")
    return g


# ---------- the message strip, on its cream panel beside each line ----------
# Each differs from the status and trait icons it shares the strip with by shape and colour family.

def bump():
    """An impact burst, as fx-bump: an amber eight-point star round a yellow one and a white core."""
    g = Grid(16, 16)
    burst(g, 8, 8, 7.4, 3.6, 8, "amber", 22.5)
    burst(g, 8, 8, 4.4, 2.2, 8, "yellow", 22.5)
    g.rect(7, 7, 2, 2, "white")
    return g


def fired():
    """A pink slip: a page with two lines of plum text and a folded corner, under a dred stamp
    lettered in a white line, as ui-fired-plate's dred face."""
    g = Grid(16, 16)
    g.rect(3, 1, 10, 14, "pink")
    g.rect(3, 1, 10, 1, "white")
    g.rect(12, 2, 1, 13, "mauve")
    for x, y in ((10, 1), (11, 1), (12, 1), (11, 2), (12, 2), (12, 3)):
        g.p(x, y, None)
    g.rect(10, 2, 1, 2, "mauve")
    g.rect(11, 3, 1, 1, "mauve")
    g.rect(5, 4, 4, 1, "plum")
    g.rect(5, 6, 6, 1, "plum")
    g.rect(2, 9, 12, 5, "dred")
    g.rect(4, 11, 8, 1, "white")
    return g


def hint():
    """A white i on a sky disc, lit cyan at its top left and shaded blue at its lower right."""
    g = Grid(16, 16)
    g.cel(8, 8, 6.6, 6.6, "sky", "blue", "cyan")
    g.rect(7, 3, 2, 2, "white")
    g.rect(7, 6, 2, 6, "white")
    g.rect(6, 6, 1, 1, "white")
    g.rect(6, 11, 4, 1, "white")
    return g


def last_heart():
    """One big red heart, lit pink at its top left and shaded dred, cracked from its notch half way down."""
    g = Grid(16, 16)
    for cx in (5, 11):
        g.cel(cx, 6, 3.8, 3.8, "red", "dred", "pink")
    g.tri((1.2, 7.2), (14.8, 7.2), (8, 14.6), "red")
    g.tri((8, 14.6), (14.8, 7.2), (12.6, 9.6), "dred")
    for x, y in ((8, 3), (8, 4), (7, 5), (7, 6), (8, 7), (9, 8), (8, 9)):
        g.p(x, y, "plum")
    return g


def lucky():
    """A four-leaf clover on its stem, green shaded dgreen, each leaf notched at its tip and veined
    dgreen to the centre, with a yellow twinkle at the top right."""
    g = Grid(16, 16)
    for i in range(5):
        g.p(9 + i, 10 + i, "dgreen")
    for cx, cy in ((4.5, 5.5), (9.5, 5.5), (4.5, 10.5), (9.5, 10.5)):
        g.cel(cx, cy, 2.6, 2.6, "green", "dgreen")
    for x, y in ((7, 2), (7, 13), (1, 8), (12, 8)):
        g.p(x, y, None)
    for x, y in ((7, 4), (7, 5), (7, 6), (7, 7), (7, 9), (7, 10), (7, 11), (3, 8), (4, 8), (5, 8), (6, 8),
                 (8, 8), (9, 8), (10, 8)):
        g.p(x, y, "dgreen")
    g.p(7, 8, "yellow")
    star4(g, 13, 3, 1, "yellow")
    return g

IMAGES = {
    "icon-trait-fancy": fancy,
    "icon-trait-food-driven": food_driven,
    "icon-trait-chaser": chaser,
    "icon-pace-slow": pace_slow,
    "icon-pace-fast": pace_fast,
    "icon-style-charm": style_charm,
    "icon-style-hustle": style_hustle,
    "icon-quirk-archie": acrobatic,
    "icon-quirk-biscuit": scent_hound,
    "icon-quirk-duchess": pampered,
    "icon-quirk-koda": sled_dog,
    "icon-quirk-nugget": camera_ready,
    "icon-quirk-penny": nervous,
    "icon-quirk-pierre": show_dog,
    "icon-quirk-snowball": crowd_pleaser,
    "icon-quirk-zippy": ratter,
    "icon-energy-calm": calm,
    "icon-energy-steady": steady,
    "icon-energy-hyper": hyper,
    "icon-owner-laid-back": laid_back,
    "icon-owner-fussy": fussy,
    "icon-owner-dramatic": dramatic,
    "icon-zone-snooze-crescent": snooze_crescent,
    "icon-zone-bark-park": bark_park,
    "icon-zone-woof-way": woof_way,
    "icon-zone-sniff-street-shops": sniff_street_shops,
    "icon-zone-paws-promenade": paws_promenade,
    "icon-zone-the-long-way-home": the_long_way_home,
    "icon-muddy": muddy,
    "icon-soaked": soaked,
    "icon-spooked": spooked,
    "icon-tangled": tangled,
    "icon-tuckered-out": tuckered_out,
    "icon-upgrade-belly-rubs": belly_rubs,
    "icon-upgrade-big-tipper": big_tipper,
    "icon-upgrade-good-leash": good_leash,
    "icon-upgrade-raincoats": raincoats,
    "icon-upgrade-rush-hour": rush_hour,
    "icon-upgrade-second-wind": second_wind,
    "icon-upgrade-shortcut": shortcut,
    "icon-upgrade-sweet-talker": sweet_talker,
    "icon-upgrade-treat-magnet": treat_magnet,
    "icon-gear-fanny-pack": gear_fanny_pack,
    "icon-gear-lucky-collar": gear_lucky_collar,
    "icon-gear-poop-bags": gear_poop_bags,
    "icon-gear-running-shoes": gear_running_shoes,
    "icon-gear-whistle": gear_whistle,
    "icon-bump": bump,
    "icon-fired": fired,
    "icon-hint": hint,
    "icon-last-heart": last_heart,
    "icon-lucky": lucky,
}


# ---------- the difficulty marker on a fork's path card ----------

PAW_PRINT = ("..ff.ff..", "..ff.ff..", "ff.....ff", "ff.....ff", "...fff...", "..fffff..", ".fffffff.",
             "..fffff..")


def paw(g, x0, filled):
    """One 11x10 paw at x0: filled is amber, shaded orange along the pad's foot, outlined in plum by
    hand; hollow is only a tan rim with no outline, so the empty slots recede and the count reads
    from the filled paws' silhouettes."""
    cells = {(x, y) for y, row in enumerate(PAW_PRINT) for x, ch in enumerate(row) if ch == "f"}
    sides = ((0, -1), (0, 1), (-1, 0), (1, 0))
    for x, y in cells:
        for dx, dy in sides:
            if filled and (x + dx, y + dy) not in cells:
                g.p(x0 + 1 + x + dx, 1 + y + dy, "plum")
    for x, y in cells:
        rim = any((x + dx, y + dy) not in cells for dx, dy in sides)
        if filled:
            g.p(x0 + 1 + x, 1 + y, "orange" if y == 7 else "amber")
        elif rim:
            g.p(x0 + 1 + x, 1 + y, "tan")


def difficulty(n):
    """55x10: n filled paws, then hollow ones, out of five. The filled paw's plum outline holds 9.4:1
    on cream and its amber 7.4:1 on the frame's plum; the hollow tan rim is a faint slot marker."""
    g = Grid(55, 10)
    for i in range(5):
        paw(g, i * 11, i < n)
    return g


def sprites():
    yield "ui-difficulty", [(str(n), [difficulty(n).outlined(False)], 1000) for n in range(1, 6)]


def image(draw):
    """Every content icon takes icon_edge unless its drawing set its own outline rule."""
    g = draw()
    if g.edge is None:
        g.edge = icon_edge
    return to_image(g.outlined())


def preview(out, scale=6):
    grounds = [(234, 212, 170), (228, 166, 114), (115, 62, 57), (58, 68, 102), (24, 20, 37)]
    marks = [to_image(f) for _, tags in sprites() for _, fs, _ in tags for f in fs]
    width = max(20 * len(IMAGES), 60 * len(marks))
    sheet = Image.new("RGB", (width * scale, (20 + 14) * len(grounds) * scale), (62, 39, 49))
    for i, draw in enumerate(IMAGES.values()):
        im = image(draw)
        for j, ground in enumerate(grounds):
            tile = Image.new("RGB", (16, 16), ground)
            tile.paste(im, (0, 0), im)
            sheet.paste(tile.resize((16 * scale, 16 * scale), Image.NEAREST), (i * 20 * scale, j * 20 * scale))
    # ui-difficulty, one row per ground
    for i, im in enumerate(marks):
        for j, ground in enumerate(grounds):
            tile = Image.new("RGB", (im.width + 2, im.height + 2), ground)
            tile.paste(im, (1, 1), im)
            y = 20 * len(grounds) + j * 14
            sheet.paste(tile.resize((tile.width * scale, tile.height * scale), Image.NEAREST),
                        (i * 60 * scale, y * scale))
    sheet.save(out)


def build():
    os.makedirs("art/glyphs", exist_ok=True)
    os.makedirs("public/art/images", exist_ok=True)
    for key, draw in IMAGES.items():
        png = f"public/art/images/{key}.png"
        image(draw).save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/glyphs/{key}.aseprite"], check=True)
    build_sprites(list(sprites()), "art/glyphs")
    print("built", ", ".join(IMAGES))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
