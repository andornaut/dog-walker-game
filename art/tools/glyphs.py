#!/usr/bin/env python3
"""Draw the pull squirrel, the zone icons, a walker's perk icons, the debuff and effect icons, the
walk bar's effect wells, the walk's message strip icons and a path card's difficulty paws.

16x16 images in the house palette with coloured outlines, on transparency:
icon-trait-chaser           a black squirrel, in the pull bubble and on the message strip
icon-perk-<perk>            a walker's perk, on walker tiles, the new walker celebration and
                            the message strip: calm-voice (a sky speech bubble with a white
                            wave), kind-words (a pink speech bubble with a red heart), long-reach
                            (an open hand over a green arrow pointing both ways), treat-finder (a
                            magnifying glass over a treat)
icon-zone-<zone>            cabbagetown (a bay-and-gable house), high-park (a pine and a cherry
                            in blossom), distillery-district (a brick warehouse),
                            kensington-market (a painted house turned shop), the-beaches (the
                            lifeguard station), yonge-street (the CN Tower); each inside a 1px
                            ring for its outline, which holds 3:1 on cream and tan
icon-muddy                  a debuff beside icon-stinky (ui.py), on its bar and on cream: a
                            muddy paw print
icon-zoomies                a debuff's bar and message line: an amber paw print dashing right
                            off three sky speed lines
icon-upgrade-<upgrade>      the shop, the cards and the message strip: belly-rubs (a hand under a heart),
                            big-tipper (coins and an up arrow), good-leash (a leash), raincoats
                            (a yellow raincoat), rush-hour (an alarm clock), sweet-talker (a speech
                            bubble with $ and a down arrow)
icon-gear-<gear>            the shop and the message strip: the shop's item art (icons.py) at 16x16
<key>-20                    each icon-perk-*, icon-upgrade-* and icon-gear-* drawn again at 20x20 for
                            the walk bar's 22x22 effect wells: the same subject and colours
icon-bump, icon-fired,      the walk's message strip, beside its lines, on cream: bump (an amber
icon-hint, icon-last-heart, impact burst), fired (a pink slip under a dred stamp), hint (a white i
icon-lucky                  on a sky disc), last-heart (a red heart cracked down from its notch),
                            lucky (a four-leaf clover with a twinkle)
The upgrade and gear ids are the data ids in kebab case.

Sprite: ui-difficulty (55x10; tags 1 to 5), a zone's difficulty under its name on a fork's path
card: that many filled paws out of five, 11px apart. A filled paw is amber in a plum outline; a
hollow one is only a faint tan rim, so the filled paws carry the count on the card's cream body.

Usage:
  glyphs.py preview OUT.png   every icon on the UI's paper, panel, wood and ink colours, then
                              ui-difficulty's tags, scaled up
  glyphs.py build             write art/glyphs/*.aseprite, export to public/art/images/ and
                              public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from pixel import K, Grid, bitmap, build as build_sprites, icon_edge, to_image  # noqa: E402
from fx import burst, star4  # noqa: E402
from road import SQUIRREL_FUR  # noqa: E402


# ---------- traits ----------

def chaser():
    """Toronto's black squirrel in road.SQUIRREL_FUR, side on facing left, its tail up behind it, a white glint
    over its eye."""
    f = SQUIRREL_FUR
    g = Grid(16, 16)
    g.ell(11.5, 6, 3.5, 5.5, f["fur"], f["shade"], f["lit"])
    g.ell(11.5, 6.5, 1.5, 3.5, f["streak"])
    g.ell(8.5, 9, 1.4, 4, f["shade"])
    g.ell(7, 11, 3.5, 3.8, f["fur"], f["shade"], f["lit"])
    g.ell(5.5, 12, 1.6, 2.4, f["belly"])
    g.ell(5, 6, 3, 2.8, f["fur"], f["shade"], f["lit"])
    g.p(6, 3, f["fur"])
    g.p(6, 2, f["shade"])
    g.p(4, 5, "white")
    g.p(4, 6, "ink")
    g.p(2, 7, f["nose"])
    g.rect(4, 14, 2, 1, f["shade"])
    return g


# ---------- walkers: perks, on walker tiles, the new walker celebration and the message strip ----------
# Each holds its silhouette on cream and on the strip's ink. The two voice perks are speech bubbles told
# apart by colour and mark: calm voice a sky bubble with a wave, kind words a pink one with a heart.

def calm_voice():
    """A sky speech bubble, lit cyan along its top, holding a white wave: a soft, even tone."""
    g = Grid(16, 16)
    g.rect(1, 2, 14, 9, "sky")
    g.rect(0, 3, 16, 7, "sky")
    g.rect(1, 2, 14, 1, "cyan")
    g.rect(0, 3, 1, 3, "cyan")
    g.rect(1, 10, 14, 1, "blue")
    g.tri((3, 10), (3, 15), (7, 10), "sky")
    bitmap(g, 2, 5, [".ww...ww...ww", "w..w.w..w.w..", "....w....w..."], {"w": "white"})
    return g


def kind_words():
    """A pink speech bubble holding a red heart."""
    g = Grid(16, 16)
    g.rect(1, 1, 14, 10, "pink")
    g.rect(0, 2, 16, 8, "pink")
    g.rect(1, 10, 14, 1, "mauve")
    g.tri((10, 10), (13, 15), (13.5, 10), "pink")
    heart(g, 4, 2)
    return g


def long_reach():
    """An open hand, palm out, over a green arrow pointing both ways: a reach a lane to each side."""
    g = Grid(16, 16)
    bitmap(g, 4, 0, [".s.s.s..", ".s.s.s.s", ".sssss.s", "ss.sssss", "sssssssd", ".ssssssd",
                     "..sssssd", "..sssdd."], {"s": "skin1", "d": "skin2"})
    g.tri((0, 12.5), (3.5, 9), (3.5, 16), "green")
    g.tri((16, 12.5), (12.5, 9), (12.5, 16), "green")
    g.rect(3, 11, 10, 3, "green")
    g.rect(3, 13, 10, 1, "dgreen")
    return g


def treat_finder():
    """A magnifying glass, its cyan lens over the treat (a white bone with a red heart on its shaft), its
    brown handle down to the right."""
    g = Grid(16, 16)
    for i in range(5):
        g.rect(10 + i, 10 + i, 2, 2, "brown")
    g.ell(6.5, 6.5, 5.7, 5.7, "lgrey", "grey")
    g.ell(6.5, 6.5, 4.2, 4.2, "cyan", None, "white")
    bitmap(g, 3, 5, ["ww1.1ww", ".w111w.", "ww.1.ww"], {"w": "white", "1": "red"})
    return g


# ---------- zones, after their backdrops ----------

class Zone(Grid):
    """A 16x16 zone picture drawn only inside the 1px ring its outline takes, with icon_edge outlines, so a
    picture that fills its frame is outlined on every side."""

    def __init__(self):
        super().__init__(16, 16)
        self.edge = icon_edge

    def p(self, x, y, c):
        if 1 <= int(x) <= 14 and 1 <= int(y) <= 14:
            super().p(x, y, c)


def cabbagetown():
    """A bay-and-gable house: a steep slate gable trimmed in white over brick, a bay of lit windows."""
    g = Zone()
    g.tri((1.5, 7.5), (8, 1), (14.5, 7.5), "dslate")
    for k in range(6):
        g.p(3 + k, 6 - k, "white")
        g.p(12 - k, 6 - k, "white")
    g.rect(2, 7, 12, 8, "brick")
    g.rect(12, 7, 2, 8, "dbrick")
    g.rect(2, 7, 6, 8, "clay")
    for y in (8, 12):
        g.rect(3, y, 4, 2, "gold")
    g.rect(10, 10, 2, 5, "forest")
    g.p(8, 4, "cyan")
    return g


def high_park():
    """A dark pine on the park's grass, a cherry in blossom behind it."""
    g = Zone()
    g.ell(4, 6, 3.5, 3.5, "pink", "mauve")
    g.p(3, 5, "white")
    g.rect(9, 12, 2, 3, "bark")
    for top, half in ((1, 2), (4, 4), (7, 5)):
        g.tri((10, top), (10 - half, top + 5), (10 + half, top + 5), "pine")
        g.tri((10, top), (10 - half, top + 5), (10, top + 5), "canopy")
    g.rect(1, 13, 14, 2, "pine")
    g.rect(1, 13, 14, 1, "canopy")
    return g


def distillery_district():
    """A brick warehouse with an arched lit window, its chimney stack beside it."""
    g = Zone()
    g.rect(11, 1, 3, 6, "brick")
    g.rect(13, 1, 1, 6, "dbrick")
    g.rect(1, 6, 14, 9, "brick")
    g.rect(13, 6, 2, 9, "dbrick")
    g.rect(1, 6, 14, 1, "stone")
    for x in (3, 8):
        g.rect(x, 9, 3, 4, "gold")
        g.p(x + 1, 8, "gold")
    return g


def kensington_market():
    """A painted house turned shop: a turquoise wall under a violet gable, a striped awning."""
    g = Zone()
    g.tri((1.5, 6.5), (8, 1), (14.5, 6.5), "violet")
    g.rect(2, 6, 12, 9, "turquoise")
    g.rect(12, 6, 2, 9, "dturq")
    for x in range(2, 14, 4):
        g.rect(x, 9, 2, 2, "ttc")
        g.rect(x + 2, 9, 2, 2, "white")
    g.rect(3, 12, 5, 3, "cyan")
    g.rect(10, 12, 2, 3, "dbrown")
    g.rect(6, 7, 4, 1, "white")
    return g


def the_beaches():
    """The lifeguard station: a white tower under a red roof, over the lake."""
    g = Zone()
    g.tri((3.5, 6.5), (8, 2), (12.5, 6.5), "ttc")
    g.rect(4, 6, 8, 5, "white")
    g.rect(10, 6, 2, 5, "lgrey")
    g.rect(6, 7, 3, 2, "dlake")
    g.rect(8, 0, 1, 2, "coal")
    g.rect(1, 11, 14, 4, "lake")
    g.rect(1, 11, 14, 1, "foam")
    g.rect(2, 13, 3, 1, "shallow")
    g.rect(9, 14, 4, 1, "shallow")
    return g


def yonge_street():
    """The CN Tower over downtown blocks."""
    g = Zone()
    g.rect(7, 1, 1, 3, "grey")
    g.rect(6, 4, 3, 2, "lgrey")
    g.rect(6, 5, 3, 1, "dlake")
    g.rect(7, 6, 2, 7, "lgrey")
    g.rect(8, 6, 1, 7, "grey")
    g.rect(1, 9, 5, 6, "ash")
    g.rect(10, 8, 5, 7, "lake")
    for y in (10, 12):
        g.rect(2, y, 3, 1, "haze")
        g.rect(11, y - 1, 3, 1, "foam")
    g.rect(1, 14, 14, 1, "ttc")
    return g


# ---------- debuffs: icon-muddy beside ui.py's icon-stinky ----------
# Like icon-stinky, icon-muddy reads on cream by its plum outline (9.42:1) and differs from it by
# shape: a paw print against stink lines.

def drop(g, cx, top, r, fill, sh=None, li=None):
    """A water drop: a point at (cx, top) over a round base of radius r."""
    base = top + 2.2 * r
    g.tri((cx, top), (cx - r * 0.93, base - r * 0.4), (cx + r * 0.93, base - r * 0.4), fill)
    g.ell(cx, base, r, r, fill, sh, li)


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


def zoomies():
    """A paw print dashing right: four toes and a pad in amber, lit yellow on their top left
    and shaded orange along their foot, with three sky speed lines streaming off its left."""
    g = Grid(16, 16)
    bitmap(g, 0, 1, ["........yy.yy...",
                     "........aa.aa...",
                     "........ao.ao...",
                     "......yy....yy..",
                     ".sss..aa....aa..",
                     "......ao....ao..",
                     ".........ya.....",
                     "..ssss..yaaaa...",
                     "........aaaaao..",
                     "........aaaaao..",
                     ".sss.....oooo...",
                     "................"],
           {"a": "amber", "y": "yellow", "o": "orange", "s": "sky"})
    return g


# ---------- upgrades: the shop, the cards and the message strip ----------
# Every fill that carries a shape also holds 3:1 or more on ink, where the 20x20 copies sit in the walk
# bar's wells and their darker outlines sink, so the silhouette is the fill. Dark ramp colours (dbrown,
# dred, forest, blue) appear only inside a lighter fill.

BIG_HEART = [".111.111.", "11111111p", "1111111pp", "111111ppp", ".11111pp.", "..111pp..", "...1pp...", "....p...."]


def heart(g, x, y):
    bitmap(g, x, y, BIG_HEART, {"1": "red", "p": "hot"})
    g.p(x + 1, y + 1, "pink")


def belly_rubs():
    """A hand rubbing below a heart."""
    g = Grid(16, 16)
    heart(g, 6, 1)
    bitmap(g, 1, 9, ["....ssssss..", "ssssssssssss", "sssssddddd..", "sssssssssss.", "ssssdddd....",
                     "ssssssssss.."], {"s": "skin1", "d": "skin2"})
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

def gear_dog_whistle():
    g = Grid(16, 16)
    g.ell(3.5, 3.5, 3, 3.2, "mauve", "purple")
    g.ell(3.5, 3.5, 1.4, 1.6, None)
    g.ell(8, 10.5, 5, 4.5, "lgrey", "grey", "white")
    g.rect(9, 5, 6, 3, "lgrey")
    g.rect(9, 5, 6, 1, "white")
    g.rect(14, 5, 1, 3, "grey")
    g.rect(10, 6, 3, 1, "dslate")
    g.rect(6, 10, 2, 2, "slate")
    for x, y in ((11, 2), (14, 3)):
        g.p(x, y, "cyan")
    return g


def gear_fanny_pack():
    g = Grid(16, 16)
    g.rect(0, 5, 16, 2, "brown")
    g.rect(12, 4, 3, 4, "lgrey")
    g.ell(7.5, 10, 6.5, 4.5, "amber", "orange", "yellow")
    g.rect(3, 9, 9, 1, "orange")
    g.p(11, 9, "lgrey")
    return g


def gear_hall_pass():
    g = Grid(16, 16)
    g.p(3, 0, "sky")
    g.p(4, 1, "sky")
    g.p(5, 2, "sky")
    g.p(12, 0, "sky")
    g.p(11, 1, "sky")
    g.p(10, 2, "sky")
    g.rect(1, 5, 14, 10, "cream")
    g.rect(1, 5, 14, 3, "red")
    g.rect(14, 5, 1, 10, "tan")
    g.rect(1, 14, 14, 1, "tan")
    g.rect(14, 5, 1, 3, "dred")
    g.rect(6, 3, 4, 2, "lgrey")
    g.rect(7, 5, 2, 2, "lgrey")
    for x, y in ((2, 10), (4, 9), (6, 10)):
        g.p(x, y, "dred")
    g.rect(3, 11, 3, 2, "dred")
    g.rect(9, 10, 4, 1, "brown")
    g.rect(9, 12, 4, 1, "brown")
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


# ---------- the walk bar's effect wells: each perk, gear and upgrade icon drawn again at 20x20 ----------
# The same subject, colours and silhouette as its 16x16 icon, redrawn with the room spent on detail.
# Like the 16x16 icons', every fill that carries a shape holds 3:1 or more on the well's ink.

BIG_HEART_20 = [".111...111.", "11111.11111", "11111111111", "1111111111p", ".11111111p.", "..111111p..",
                "...1111p...", "....11p....", ".....p....."]


def heart20(g, x, y):
    """An 11x9 heart, red with a hot right side, lit white at the top of its left lobe."""
    bitmap(g, x, y, BIG_HEART_20, {"1": "red", "p": "hot"})
    g.p(x + 1, y + 1, "white")
    g.p(x + 2, y + 1, "pink")


def kind_words20():
    """A pink speech bubble holding a red heart, its tail down to the right."""
    g = Grid(20, 20)
    g.rect(2, 1, 16, 13, "pink")
    g.rect(1, 2, 18, 11, "pink")
    g.rect(2, 13, 16, 1, "mauve")
    g.rect(18, 3, 1, 9, "mauve")
    g.tri((11, 13), (15.5, 19), (16, 13), "pink")
    g.p(15, 14, "mauve")
    g.p(15, 15, "mauve")
    heart20(g, 4, 3)
    return g


def big_tipper20():
    """A stack of four coins under a fifth seen from above, and a green arrow up beside it."""
    g = Grid(20, 20)
    for x, y in ((1, 16), (2, 14), (1, 12), (2, 10)):
        g.rect(x, y, 10, 2, "amber")
        g.rect(x, y + 1, 10, 1, "orange")
        g.p(x + 1, y, "yellow")
        g.p(x + 2, y, "yellow")
    g.ell(7, 8, 5, 2.5, "yellow", "amber")
    g.rect(5, 8, 4, 1, "amber")
    g.tri((16, 0.5), (11.5, 6.5), (20.5, 6.5), "green")
    g.rect(15, 6, 3, 12, "green")
    g.rect(17, 6, 1, 12, "dgreen")
    g.p(16, 3, "yellow")
    return g


def gear_running_shoes20():
    """The running shoe side on, the toe to the left: a sky upper lit cyan along its top, white laces up
    the instep, a navy collar, an orange heel tab and a white sole on an lgrey tread."""
    g = Grid(20, 20)
    bitmap(g, 0, 4, [
        "............ccccc...",
        "..........ccsnnnns..",
        "........ccssssssooo.",
        "......ccswsswsssoo..",
        "....ccswsswssssooo..",
        "..ccsssssssssssss...",
        ".csssssssssssssssss.",
        ".sssssssssssssssssb.",
        ".bbbbbbbbbbbbbbbbbb.",
        ".wwwwwwwwwwwwwwwwww.",
        ".wwwwwwwwwwwwwwwwww.",
        "..llllllllllllllll..",
    ], {"c": "cyan", "s": "sky", "n": "navy", "w": "white", "o": "orange", "b": "blue", "l": "lgrey"})
    return g


def bubble20(g, fill, shade, lit=None):
    """An 18x12 speech bubble with clipped corners, shaded along its foot and right side, its tail down to
    the left."""
    g.rect(2, 1, 16, 12, fill)
    g.rect(1, 2, 18, 10, fill)
    g.rect(2, 12, 16, 1, shade)
    g.rect(18, 3, 1, 9, shade)
    g.tri((4, 12), (4, 18.5), (9, 12), fill)
    g.p(5, 13, shade)
    if lit:
        g.rect(2, 1, 16, 1, lit)
        g.rect(1, 2, 1, 5, lit)


def calm_voice20():
    """A sky speech bubble, lit cyan along its top, holding a white wave: a soft, even tone."""
    g = Grid(20, 20)
    bubble20(g, "sky", "blue", "cyan")
    bitmap(g, 2, 5, ["..ww......ww....", ".w..w....w..w...", "w....w..w....w..", "......ww......ww"],
           {"w": "white"})
    return g


def long_reach20():
    """An open hand, palm out, over a green arrow pointing both ways: a reach a lane to each side."""
    g = Grid(20, 20)
    bitmap(g, 4, 0, ["....ss.ss...", ".ss.ss.ss...", ".ss.ss.ss.ss", ".ss.ss.ss.ss", ".ss.ss.ss.ss",
                     "s.ssssssssss", "ss.sssssssss", ".ssssssssssd", "..sssssssdd.", "...sssssdd.."],
           {"s": "skin1", "d": "skin2"})
    g.tri((1, 14.5), (5, 10.5), (5, 18.5), "green")
    g.tri((19, 14.5), (15, 10.5), (15, 18.5), "green")
    g.rect(5, 13, 10, 3, "green")
    g.rect(5, 15, 10, 1, "dgreen")
    return g


def treat_finder20():
    """A magnifying glass, its cyan lens over the treat (a white bone with a red heart on its shaft), its
    brown handle down to the right."""
    g = Grid(20, 20)
    for i in range(5):
        g.rect(13 + i, 13 + i, 2, 2, "brown")
    g.ell(8, 8, 7, 7, "lgrey", "grey")
    g.ell(8, 8, 5.2, 5.2, "cyan", None, "white")
    bitmap(g, 4, 6, ["..11.11..", "ww11111ww", ".ww111ww.", "ww..1..ww"],
           {"w": "white", "1": "red"})
    return g


def belly_rubs20():
    """A hand, palm up, rubbing below a heart."""
    g = Grid(20, 20)
    heart20(g, 6, 1)
    bitmap(g, 1, 11, ["......sssss.....", "ssssssssssssss..", "sssssssdddddd...", "sssssssssssssss.",
                      "ssssssdddddd....", "ssssssssssssss..", "sssssddddd......", "ssssssssssss...."],
           {"s": "skin1", "d": "skin2"})
    return g


def good_leash20():
    """A leash: a handle loop, the line and its clip."""
    g = Grid(20, 20)
    g.ell(5.5, 5.5, 4.5, 4.5, "red", None, "pink")
    g.ell(5.5, 5.5, 2.2, 2.2, None)
    for i in range(7):
        g.rect(9 + i, 9 + i, 2, 1, "red")
    g.ell(16, 16, 2.8, 2.8, "lgrey", "grey", "white")
    g.p(16, 16, "slate")
    return g


def raincoats20():
    """A yellow raincoat with its hood up, buttoned down the front, and a drop of rain."""
    g = Grid(20, 20)
    bitmap(g, 4, 3, [
        ".....yyyy.....",
        "....yyyyyy....",
        "...yyyyyyya...",
        "...yy....ya...",
        "...yy....ya...",
        "..yyy....yaa..",
        ".yyyyy..yyyaa.",
        "yyyyyyyyyyyyaa",
        "yyyy.yyyyy.yaa",
        "yyy..yykyy..aa",
        "yyy..yyyyy..aa",
        "yy...yykyy...a",
        ".....yyyyya...",
        "....yyyyyyya..",
        "....yyyyyyaa..",
        "....yyyyyaaa..",
    ], {"y": "yellow", "a": "amber", "k": "orange"})
    drop(g, 2.5, 1, 1.6, "cyan", "sky")
    return g


def rush_hour20():
    """An alarm clock ringing: two amber bells, a red case on lgrey feet and a white face."""
    g = Grid(20, 20)
    g.ell(4.5, 4.5, 3, 3, "amber", "orange", "yellow")
    g.ell(15.5, 4.5, 3, 3, "amber", "orange", "yellow")
    g.rect(4, 15, 2, 4, "lgrey")
    g.rect(14, 15, 2, 4, "lgrey")
    g.ell(10, 10.5, 7, 7, "red", None, "pink")
    g.ell(10, 10.5, 5, 5, "white", "lgrey")
    g.rect(9, 3, 2, 1, "lgrey")
    g.rect(10, 7, 1, 4, "ink")
    g.rect(11, 10, 3, 1, "ink")
    return g


def sweet_talker20():
    """A speech bubble saying money goes down: a forest $ and a dred arrow down."""
    g = Grid(20, 20)
    bubble20(g, "white", "lgrey")
    bitmap(g, 3, 2, ["..s..", ".ssss", "s.s..", "s.s..", ".sss.", "..s.s", "..s.s", "ssss.", "..s.."],
           {"s": "forest"})
    bitmap(g, 10, 3, ["..ddd..", "..ddd..", "..ddd..", "..ddd..", "ddddddd", ".ddddd.", "..ddd..", "...d..."],
           {"d": "dred"})
    return g


def gear_dog_whistle20():
    """The dog whistle: a silver whistle with its mouthpiece up and right, an ink slot, a purple
    lanyard loop (mauve, so it holds on the walk bar's navy) on its left end and cyan sound marks
    off the slot."""
    g = Grid(20, 20)
    g.ell(4.5, 4.5, 3.6, 4, "mauve", "purple")
    g.ell(4.5, 4.5, 1.8, 2.2, None)
    g.ell(10, 13, 6, 5.5, "lgrey", "grey", "white")
    g.rect(11, 6, 7, 4, "lgrey")
    g.rect(11, 6, 7, 1, "white")
    g.rect(17, 6, 1, 4, "grey")
    g.rect(11, 9, 7, 1, "grey")
    g.rect(12, 7, 4, 1, "dslate")
    g.rect(8, 12, 3, 3, "slate")
    for x, y in ((12, 3), (12, 2), (15, 3), (16, 2), (19, 4), (19, 5)):
        g.p(x, y, "cyan")
    return g


def gear_fanny_pack20():
    """The fanny pack: an amber pouch zipped in orange on a brown strap with an lgrey buckle."""
    g = Grid(20, 20)
    g.rect(1, 6, 18, 2, "brown")
    g.rect(15, 5, 3, 4, "lgrey")
    g.p(16, 6, "grey")
    g.p(16, 7, "grey")
    g.ell(9, 12.5, 7.5, 5.5, "amber", "orange", "yellow")
    g.rect(4, 11, 10, 1, "orange")
    g.p(14, 11, "lgrey")
    g.p(14, 12, "lgrey")
    return g


def gear_hall_pass20():
    """The Hall pass: a cream pass card on a sky lanyard, clipped through its red header band, a dred
    paw stamp on the left and brown lines of print on the right."""
    g = Grid(20, 20)
    for i in range(5):
        g.p(4 + i, i, "sky")
        g.p(15 - i, i, "sky")
    g.rect(2, 7, 16, 11, "cream")
    g.rect(2, 7, 16, 3, "red")
    g.rect(2, 7, 16, 1, "pink")
    g.rect(17, 7, 1, 11, "tan")
    g.rect(2, 17, 16, 1, "tan")
    g.rect(17, 7, 1, 3, "dred")
    g.rect(8, 4, 4, 2, "lgrey")
    g.rect(9, 6, 2, 3, "lgrey")
    for x, y in ((3, 12), (5, 11), (7, 11), (9, 12)):
        g.p(x, y, "dred")
    g.rect(4, 13, 5, 3, "dred")
    g.rect(4, 15, 1, 1, "cream")
    g.rect(8, 15, 1, 1, "cream")
    g.rect(11, 12, 5, 1, "brown")
    g.rect(11, 14, 5, 1, "brown")
    return g


def gear_lucky_collar20():
    """The lucky collar: a red collar lit pink with an amber tag stamped with a green clover."""
    g = Grid(20, 20)
    g.ell(10, 7, 8, 5.5, "red", None, "pink")
    g.ell(10, 7, 5.5, 3, None)
    g.ell(10, 14.5, 3.8, 3.8, "amber", "orange", "yellow")
    for x, y in ((10, 13), (9, 14), (11, 14), (10, 15), (11, 16)):
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
    lettered in a white line, as the empty ui-dog-card's FIRED plate."""
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
    "icon-trait-chaser": chaser,
    "icon-perk-calm-voice": calm_voice,
    "icon-perk-kind-words": kind_words,
    "icon-perk-long-reach": long_reach,
    "icon-perk-treat-finder": treat_finder,
    "icon-zone-cabbagetown": cabbagetown,
    "icon-zone-high-park": high_park,
    "icon-zone-distillery-district": distillery_district,
    "icon-zone-kensington-market": kensington_market,
    "icon-zone-the-beaches": the_beaches,
    "icon-zone-yonge-street": yonge_street,
    "icon-muddy": muddy,
    "icon-zoomies": zoomies,
    "icon-upgrade-belly-rubs": belly_rubs,
    "icon-upgrade-big-tipper": big_tipper,
    "icon-upgrade-good-leash": good_leash,
    "icon-upgrade-raincoats": raincoats,
    "icon-upgrade-rush-hour": rush_hour,
    "icon-upgrade-sweet-talker": sweet_talker,
    "icon-gear-dog-whistle": gear_dog_whistle,
    "icon-gear-fanny-pack": gear_fanny_pack,
    "icon-gear-lucky-collar": gear_lucky_collar,
    "icon-gear-hall-pass": gear_hall_pass,
    "icon-gear-running-shoes": gear_running_shoes,
    "icon-perk-calm-voice-20": calm_voice20,
    "icon-perk-kind-words-20": kind_words20,
    "icon-perk-long-reach-20": long_reach20,
    "icon-perk-treat-finder-20": treat_finder20,
    "icon-upgrade-belly-rubs-20": belly_rubs20,
    "icon-upgrade-big-tipper-20": big_tipper20,
    "icon-upgrade-good-leash-20": good_leash20,
    "icon-upgrade-raincoats-20": raincoats20,
    "icon-upgrade-rush-hour-20": rush_hour20,
    "icon-upgrade-sweet-talker-20": sweet_talker20,
    "icon-gear-dog-whistle-20": gear_dog_whistle20,
    "icon-gear-fanny-pack-20": gear_fanny_pack20,
    "icon-gear-lucky-collar-20": gear_lucky_collar20,
    "icon-gear-hall-pass-20": gear_hall_pass20,
    "icon-gear-running-shoes-20": gear_running_shoes20,
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
    on cream; the hollow tan rim is a faint slot marker."""
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
            tile = Image.new("RGB", im.size, ground)
            tile.paste(im, (0, 0), im)
            sheet.paste(tile.resize((im.width * scale, im.height * scale), Image.NEAREST),
                        (i * 20 * scale, j * 20 * scale))
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
