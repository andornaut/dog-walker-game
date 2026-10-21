#!/usr/bin/env python3
"""Draw the 24 achievement badges and the celebration burst.

badge-<achievement>: 32x32 medals, rimmed by category (firsts bronze, mastery
silver, collection gold, silly pink), each with its own emblem for its goal: no
two share a motif, so each reads apart from the rest at 1x on the badge wall.
Tags: earned (in colour) and locked (in the neutral greys of locked UI: an
ndslate ring, an ngrey face, the emblem as a two-tone ink and ndslate silhouette,
a small padlock), dark enough that it never reads as silver. Where an emblem's edge holds under 3:1 against the cream and tan
face, the face beside it takes a 1px keyline: plum (9.42:1 on cream, 6.49:1 on
tan), teal for green (eau-de-skunk).
fx-confetti: 64x64, the burst behind a badge as it is earned (tag play, 10
frames at 80ms), plum-rimmed so it reads on the Stats wood and the cream end panel.
fx-confetti-bit: 6x6, one bit of the zone celebration's falling confetti, a tag per colour
(amber, cyan, green, pink, white, yellow), each 4 frames at 100ms tumbling face on, edge on,
turning and edge on the other way, in the same plum rim. The game drops them down the dimmed
road view.

Usage:
  badges.py preview OUT.png   every badge, earned and locked, and the burst, on
                              dark wood, slate and cream
  badges.py build             write art/badges/*.aseprite and export to
                              public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import HEART, K, Grid, bitmap, contrast, main  # noqa: E402
from road import SQUIRREL_FUR  # noqa: E402

RIMS = {"firsts": ("ochre", "rust", "tan"), "mastery": ("lgrey", "grey", "white"),
        "collection": ("amber", "orange", "yellow"), "silly": ("pink", "mauve", "white")}
# The icon keyline's colour where it is not plum, after the effects' rims.
KEYLINES = {"eau-de-skunk": "teal"}


def lum(c):
    c = K.get(c, c)
    return 0.299 * int(c[0:2], 16) + 0.587 * int(c[2:4], 16) + 0.114 * int(c[4:6], 16)


# A muddy print: a pad under four toes, each toe apart from the others and the pad by a 1px gap, so the
# print reads as a paw and not as arcs. 9x9.
PAW_PRINT = ["..xx.xx..", "..xx.xx..", ".........", "xx.....xx", "xx.xxx.xx", "..xxxxx..", ".xxxxxxx.",
             ".xxxxxxx.", "..xx.xx.."]


def line(g, a, b, col, w=1):
    """A w-pixel line from a to b."""
    n = math.ceil(max(abs(b[0] - a[0]), abs(b[1] - a[1]), 1) * 2)
    for i in range(n + 1):
        x, y = a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n
        g.rect(round(x - (w - 1) / 2), round(y - (w - 1) / 2), w, w, col)


def ring(g, cx, cy, r, col, hi=None):
    """A 1px circle of radius r, with a white glint at its upper left when hi is set."""
    for y in range(32):
        for x in range(32):
            if r - 1 < math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r:
                g.p(x, y, col)
    if hi:
        g.p(cx - r * 0.5, cy - r * 0.5, hi)


def heart(g, x0, y0, col="red", hi="pink"):
    """A 14x12 heart: HEART at 2x, its upper-left lobe lit."""
    for y, row in enumerate(HEART):
        for x, c in enumerate(row):
            if c == "1":
                g.rect(x0 + x * 2, y0 + y * 2, 2, 2, col)
    g.rect(x0 + 2, y0 + 2, 2, 2, hi)


ICONS = {}


def icon(name):
    def deco(fn):
        ICONS[name] = fn
        return fn
    return deco


@icon("first-steps")
def _(g):
    """A fingerpost: a green arrow pointing on, a sky one back, on a post in a grass tuft."""
    g.rect(15, 7, 2, 18, "dbrown")
    g.rect(15, 7, 1, 18, "brown")
    for y in range(9, 14):
        g.rect(8, y, 13 + 2 * (2 - abs(y - 11)), 1, "dgreen" if y == 13 else "green")
    for y in range(15, 20):
        x = 10 - 2 * (2 - abs(y - 17))
        g.rect(x, y, 22 - x, 1, "blue" if y == 19 else "sky")
    for x, h in ((11, 2), (12, 1), (13, 2), (17, 2), (18, 1), (19, 2), (20, 1)):
        g.rect(x, 25 - h, 1, h, "green")
    g.rect(11, 25, 10, 1, "dgreen")


@icon("round-trip")
def _(g):
    """A loop arrow running clockwise round a house."""
    for y in range(32):
        for x in range(32):
            dx, dy = x + 0.5 - 16, y + 0.5 - 16.5
            r, a = math.hypot(dx, dy), math.degrees(math.atan2(dy, dx))
            if 5.4 <= r <= 8 and not -80 <= a <= -20:
                g.p(x, y, "blue" if r > 6.9 and dx + dy > 0 else "sky")
    a = math.radians(-80)
    px, py = 16 + 6.7 * math.cos(a), 16.5 + 6.7 * math.sin(a)
    t, n = (-math.sin(a), math.cos(a)), (math.cos(a), math.sin(a))
    g.tri((px + 4.5 * t[0], py + 4.5 * t[1]), (px + 3.8 * n[0], py + 3.8 * n[1]),
          (px - 3.8 * n[0], py - 3.8 * n[1]), "sky")
    g.tri((12, 16.5), (20, 16.5), (16, 12.5), "red")
    g.rect(13, 16, 6, 4, "brown")
    g.rect(15, 17, 2, 3, "plum")


# A dog's head face on, floppy ears beside its muzzle: F fur, E ears, M muzzle, N nose, I eyes.
DOG_FACE = ["..FFFFFF..", ".FFFFFFFF.", "EEFFFFFFEE", "EEFIFFIFEE", "EEFIFFIFEE", "EEFMMMMFEE", "EE.MNNM.EE",
            "E..MMMM..E", "....MM...."]


@icon("double-leash")
def _(g):
    """Two dogs' heads side by side, each in its collar."""
    for x0, y0, fur, ears, muzzle, collar in ((5, 9, "ochre", "dbrown", "white", "red"),
                                              (16, 12, "white", "ink", "lgrey", "sky")):
        bitmap(g, x0, y0, DOG_FACE, {"F": fur, "E": ears, "M": muzzle, "N": "ink", "I": "ink"})
        g.rect(x0 + 3, y0 + 9, 4, 1, collar)


@icon("pack-leader")
def _(g):
    """One leash handle, three leashes fanning out to three collars."""
    g.ell(16, 8.5, 4.5, 3, "red", "dred")
    g.ell(16, 8.5, 2.5, 1.2, None)
    for (x, y), col in (((9, 20), "green"), ((16, 21), "sky"), ((23, 20), "amber")):
        line(g, (16, 11), (x, y - 3), "dred")
        g.ell(x, y, 3, 3, col)
        g.ell(x, y, 1.5, 1.5, None)
        g.p(x, y + 3, "yellow")


# A walker's bust: H hair, S skin, I eyes, C shirt.
WALKER = [".HHH.", "HHHHH", "HSSSH", "HISIH", ".SSS.", "CCCCC", "CCCCC", "CCCCC", "CCCCC", "CCCCC", "CCCCC"]


@icon("dream-team")
def _(g):
    """The four walkers shoulder to shoulder, the outer two cheering."""
    crew = (("ink", "skin2", "red"), ("ochre", "skin1", "sky"), ("dbrown", "brown", "green"),
            ("yellow", "skin1", "amber"))
    for i, (hair, skin, shirt) in enumerate(crew):
        x0, y0 = 6 + i * 5, 11 if i in (0, 3) else 10
        bitmap(g, x0, y0, WALKER, {"H": hair, "S": skin, "I": "ink", "C": shirt})
    for x, s in ((5, -1), (26, 1)):
        g.rect(x, 12, 1, 4, "skin1")
        g.p(x + s, 11, "skin1")


@icon("clean-paws")
def _(g):
    """A bar of soap under three bubbles."""
    g.rect(8, 16, 15, 7, "pink")
    g.rect(9, 15, 13, 1, "pink")
    g.rect(9, 23, 13, 1, "mauve")
    g.rect(22, 17, 1, 6, "mauve")
    g.rect(10, 17, 6, 1, "white")
    g.p(10, 18, "white")
    ring(g, 20, 10, 3.5, "sky", "white")
    ring(g, 12, 10, 2.5, "sky", "white")
    ring(g, 25, 15, 2, "sky")


@icon("not-a-scratch")
def _(g):
    """A shield with a tick."""
    for y in range(15):
        w = 6 if y < 8 else round(6 - (y - 7) * 6 / 7.5)
        g.rect(16 - w, 8 + y, w, 1, "sky")
        g.rect(16, 8 + y, w + (1 if y < 8 else 0), 1, "blue")
    line(g, (12, 15), (14.5, 18), "white", 2)
    line(g, (14.5, 18), (20, 12), "white", 2)


STAR = ["..xx..", "..xx..", "xxxxxx", ".xxxx.", ".xxxx.", "xx..xx"]


@icon("five-star-service")
def _(g):
    """Five stars, three over two."""
    for x0, y0 in ((6, 9), (13, 8), (20, 9), (9, 17), (17, 17)):
        bitmap(g, x0, y0, STAR, {"x": "yellow"})
        g.rect(x0 + 2, y0 + 4, 3, 1, "amber")


@icon("big-payday")
def _(g):
    for cx, cy in ((9, 21), (23, 21)):
        g.ell(cx, cy, 3.5, 3.5, "amber", "orange", "yellow")
    g.ell(16, 15, 8, 8, "orange", "rust")
    g.ell(16, 15, 6, 6, "amber", "orange", "yellow")
    for y, row in enumerate(["..1..", ".1111", "1.1..", ".111.", "..1.1", "1111.", "..1.."]):
        for x, c in enumerate(row):
            if c == "1":
                g.p(14 + x, 12 + y, "dbrown")
    g.p(12, 11, "white")


@icon("everybody-home")
def _(g):
    """Three leashes reaching a front door."""
    g.rect(15, 7, 10, 18, "dbrown")
    g.rect(16, 8, 8, 17, "blue")
    g.rect(16, 8, 1, 17, "sky")
    g.rect(18, 10, 4, 3, "cyan")
    g.rect(18, 15, 4, 7, "teal")
    g.rect(19, 16, 2, 5, "blue")
    g.rect(13, 25, 13, 1, "lgrey")
    g.p(17, 18, "yellow")
    for (x, y), col in (((7, 10), "dred"), ((6, 16), "dgreen"), ((7, 22), "purple")):
        line(g, (x, y), (16, 18), col)
        g.rect(x - 1, y - 1, 2, 2, col)


@icon("close-shave")
def _(g):
    """A cracked heart breaking a sweat."""
    heart(g, 7, 10)
    for a, b in (((15, 10), (14, 13)), ((14, 13), (17, 16)), ((17, 16), (15, 19)), ((15, 19), (16, 21))):
        line(g, a, b, "plum")
    bitmap(g, 22, 5, ["..c..", ".ccc.", "cwccc", "ccccs", ".css."], {"c": "cyan", "w": "white", "s": "sky"})


# A small dog side on, stretched mid-leap: B body, E ear, N nose, I eye.
LEAPER = ["........EB..", "B......BIBBN", ".BBBBBBBBB..", "..BBBBBBB...", ".BB......BB.", "BB........BB"]


@icon("dodge-ball")
def _(g):
    """A tiny dog mid-hop over a traffic cone."""
    g.tri((16, 15), (11.5, 24.5), (20.5, 24.5), "orange")
    g.rect(13, 19, 6, 2, "white")
    g.rect(10, 24, 12, 2, "rust")
    bitmap(g, 10, 7, LEAPER, {"B": "white", "E": "ink", "N": "ink", "I": "ink"})
    for x, y in ((7, 20), (7, 17), (8, 14), (9, 12)):
        g.p(x, y, "sky")


@icon("full-kennel")
def _(g):
    g.tri((8, 15), (24, 15), (16, 7), "red")
    g.rect(10, 15, 12, 9, "tan")
    g.rect(13, 17, 6, 7, "plum")
    g.rect(13, 16, 6, 1, "plum")


@icon("kitted-out")
def _(g):
    """Three of the gear items: the fanny pack, the lucky collar and a running shoe."""
    g.rect(6, 9, 12, 1, "dbrown")
    g.rect(14, 8, 2, 3, "lgrey")
    g.ell(11, 12.5, 4.5, 3, "amber", "orange", "yellow")
    g.ell(21, 10, 5, 4, "red", "dred")
    g.ell(21, 9.5, 3, 2, None)
    g.ell(21, 15, 1.8, 1.8, "green", "dgreen")
    g.ell(15, 20, 7, 3.5, "sky", "blue", "cyan")
    g.rect(9, 20, 15, 2, "sky")
    g.rect(8, 22, 16, 2, "white")
    g.rect(18, 19, 3, 1, "orange")


@icon("neighbourhood-favourite")
def _(g):
    g.ell(16, 16, 7, 7, "yellow", "amber")
    g.rect(13, 13, 1, 2, "plum")
    g.rect(18, 13, 1, 2, "plum")
    g.p(12, 18, "plum")
    g.p(19, 18, "plum")
    g.rect(13, 19, 6, 1, "plum")
    g.p(11, 16, "pink")
    g.p(20, 16, "pink")


@icon("top-walker")
def _(g):
    g.rect(9, 14, 14, 8, "amber")
    g.tri((9, 14), (9, 8), (13, 14), "amber")
    g.tri((16, 14), (16, 7), (12.5, 14), "amber")
    g.tri((16, 14), (16, 7), (19.5, 14), "amber")
    g.tri((23, 14), (23, 8), (19, 14), "amber")
    g.rect(9, 20, 14, 2, "orange")
    for x, c in ((12, "red"), (16, "sky"), (20, "green")):
        g.rect(x - 1, 16, 2, 2, c)


@icon("youre-fired")
def _(g):
    g.ell(16, 19, 6, 6, "orange", "rust")
    g.tri((10, 19), (14, 6), (17, 15), "orange")
    g.tri((22, 19), (19, 8), (15, 15), "orange")
    g.ell(16, 20, 3.5, 4, "yellow", "amber")
    g.tri((13, 20), (16, 11), (19, 20), "yellow")


@icon("eau-de-skunk")
def _(g):
    for cx, cy, r in ((12, 19, 4), (18, 18, 5), (15, 15, 4)):
        g.ell(cx, cy, r, r * 0.85, "green", "dgreen")
    for x in (10, 16, 22):
        for k in range(5):
            g.p(x + (k % 2), 6 + k, "forest")


@icon("mud-season")
def _(g):
    """Muddy paw prints walking out of a puddle."""
    g.ell(13, 22, 7, 3, "brown", "dbrown")
    for cx, cy in ((12, 15), (21, 11)):
        for y, row in enumerate(PAW_PRINT):
            for x, ch in enumerate(row):
                if ch == "x":
                    g.p(cx - 4 + x, cy - 4 + y, "dbrown")
    for x, y in ((22, 19), (23, 20), (8, 9), (16, 7), (25, 17)):
        g.p(x, y, "brown")


# A dog side on at full stretch, ears streaming back: B body, S belly and legs, E ear, N nose, I eye, T tail.
RUNNER = ["...........EEB...", "..........EBBIB..", "T.........BBBBBBN", "TBBBBBBBBBBBBBB..", ".BBBBBBBBBBBB....",
          "..SSSSSSSSSS.....", ".SS........SS....", "SS..........SS..."]


@icon("zoomies")
def _(g):
    """A dog at full stretch, speed lines and a dust puff behind it."""
    bitmap(g, 9, 10, RUNNER, {"B": "brown", "S": "dbrown", "E": "dbrown", "N": "ink", "I": "ink", "T": "brown"})
    for y, x0 in ((11, 5), (14, 4), (17, 5)):
        g.rect(x0, y, 4, 1, "sky")
    g.ell(9, 21.5, 2.5, 2, "white", "lgrey")
    g.ell(6, 20.5, 1.5, 1.5, "white", "lgrey")


@icon("squirrel")
def _(g):
    """Toronto's black squirrel in road.SQUIRREL_FUR, its tail up behind it, a white glint for its eye."""
    f = SQUIRREL_FUR
    g.ell(20, 13, 4.5, 6, f["fur"], f["shade"], f["lit"])
    g.ell(13, 18, 4, 4.5, f["fur"], f["shade"])
    g.ell(13, 13, 3, 2.5, f["fur"], f["shade"])
    g.p(11, 10, f["fur"])
    g.p(12, 13, "white")
    g.p(14, 10, f["fur"])
    g.ell(13, 20, 2, 2, f["belly"])


# An open hand reaching down out of a striped sleeve: N and W the sleeve's stripes, H skin, h the gaps
# between the fingers.
GRAB = ["..NWNWNW..", "..NWNWNW..", "..NWNWNW..", "..HHHHHH..", ".HHHHHHHH.", "HHHHHHHHHH", "HH.HhHhHhH",
        "H..HhHhHhH", "...HhHhHhH", "...H.H.H.H"]


@icon("yoink")
def _(g):
    """A thief's hand swooping on a tip coin."""
    bitmap(g, 11, 6, GRAB, {"N": "navy", "W": "white", "H": "skin1", "h": "skin2"})
    g.ell(16, 21.5, 4.5, 4.5, "amber", "orange", "yellow")
    g.rect(16, 19, 1, 5, "dbrown")
    g.p(14, 19, "white")


# A dog's head side on, its nose to the right: F fur, E ear, M muzzle, N nose, I eye.
SNIFFER = ["..FFFF.....", ".FFFFFF....", "EEFFFIFF...", "EEFFFFFFFNN", "EEEFFFFFFNN", "EEEFFFFFFF.",
           ".EEFFFFMM..", "..FFFF.....", "..FFFF....."]


@icon("sniff-test")
def _(g):
    """Two dogs' noses meeting, sniff marks above them."""
    bitmap(g, 5, 11, SNIFFER, {"F": "ochre", "E": "dbrown", "M": "white", "N": "ink", "I": "ink"})
    bitmap(g, 16, 11, SNIFFER, {"F": "white", "E": "ink", "M": "lgrey", "N": "ink", "I": "ink"}, mirror=True)
    for x, y in ((13, 8), (16, 6), (19, 8)):
        g.rect(x, y, 1, 2, "sky")
        g.p(x + 1, y - 1, "sky")


BONE = ["xx......xx", "xxx....xxx", ".xxxxxxxx.", ".xxxxxxxx.", "xxx....xxx", "xx......xx"]
# The red heart on each bone's shaft, as the treat pickup carries it, its tip below the shaft: r red, d dred.
BONE_HEART = ["r.r", "rrd", ".d."]


@icon("snack-attack")
def _(g):
    """A pile of the treat pickup's white bones in their crumbs, each with its red heart."""
    for x0, y0 in ((6, 18), (16, 18), (11, 11)):
        bitmap(g, x0, y0, BONE, {"x": "white"})
        for y, row in enumerate(BONE):
            for x, ch in enumerate(row):
                if ch == "x" and (y == len(BONE) - 1 or BONE[y + 1][x] != "x"):
                    g.p(x0 + x, y0 + y, "lgrey")
        bitmap(g, x0 + 4, y0 + 2, BONE_HEART, {"r": "red", "d": "dred"})
    for x, y in ((22, 12), (24, 15), (8, 15), (6, 25), (11, 26), (20, 26), (25, 25)):
        g.p(x, y, "brown")


BADGES = {
    "double-leash": "firsts", "dream-team": "firsts", "first-steps": "firsts", "pack-leader": "firsts",
    "round-trip": "firsts",
    "big-payday": "mastery", "clean-paws": "mastery", "dodge-ball": "mastery", "everybody-home": "mastery",
    "five-star-service": "mastery", "not-a-scratch": "mastery",
    "full-kennel": "collection", "kitted-out": "collection", "neighbourhood-favourite": "collection",
    "top-walker": "collection",
    "close-shave": "silly", "eau-de-skunk": "silly", "mud-season": "silly", "sniff-test": "silly", "snack-attack": "silly",
    "squirrel": "silly", "yoink": "silly", "youre-fired": "silly", "zoomies": "silly",
}


def badge(name, locked=False):
    rim, rim_sh, rim_li = RIMS[BADGES[name]]
    g = Grid(32, 32)
    g.ell(16, 16, 14.5, 14.5, rim, rim_sh, rim_li)
    for a in range(0, 360, 30):
        g.p(16 + math.cos(math.radians(a)) * 13, 16 + math.sin(math.radians(a)) * 13, rim_sh)
    g.ell(16, 16, 11, 11, "cream", "tan")
    disc = Grid(32, 32)
    disc.ell(16, 16, 11, 11, "cream")
    art = Grid(32, 32)
    ICONS[name](art)
    icon_px = {(x, y) for y in range(32) for x in range(32) if art.px[y][x]}
    # the keyline: every face pixel beside an icon pixel that holds under 3:1 against it
    keyline = {(x, y) for y in range(32) for x in range(32) if disc.px[y][x] and (x, y) not in icon_px and any(
        (x + dx, y + dy) in icon_px and contrast(art.px[y + dy][x + dx], g.px[y][x]) < 3
        for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)))}
    for x, y in icon_px:
        g.px[y][x] = art.px[y][x]
    for x, y in keyline:
        g.p(x, y, KEYLINES.get(name, "plum"))
    if locked:
        # In the neutral greys, as locked UI is: the ring darkens to ndslate and the face to ngrey, so a locked
        # badge never reads as silver; the icon becomes a two-tone silhouette (dark lines in ink, the rest
        # ndslate, 3.56:1 on ngrey) so its goal still reads on the grey face. The padlock keeps its colours.
        ring_to = {K[rim]: K["ndslate"], K[rim_sh]: K["ink"], K[rim_li]: K["nslate"]}
        for y in range(32):
            for x in range(32):
                c = g.px[y][x]
                if not c:
                    continue
                if (x, y) in icon_px | keyline:
                    g.px[y][x] = K["ink"] if lum(c) < 90 else K["ndslate"]
                else:
                    g.px[y][x] = K["ngrey"] if disc.px[y][x] else ring_to[c]
        g.rect(20, 22, 8, 7, "amber")
        g.rect(20, 22, 8, 1, "yellow")
        g.rect(21, 18, 1, 4, "lgrey")
        g.rect(26, 18, 1, 4, "lgrey")
        g.rect(22, 17, 4, 1, "lgrey")
        g.rect(23, 24, 2, 3, "dbrown")
    return g


# Confetti pieces, fixed so every build draws the same burst: (angle, reach, fall, drift, phase, last frame, colour).
# Angles are jittered off an even spread and reaches vary, so the burst fills the square unevenly.
_rng = random.Random(7)
PIECES = [(math.radians(i * 360 / 36 + _rng.uniform(-14, 14)), _rng.uniform(16, 38), _rng.uniform(0.35, 0.7),
           _rng.uniform(-3, 3), _rng.randrange(3), _rng.randrange(6, 11),
           ("red", "amber", "green", "sky", "pink", "yellow", "white", "cyan", "orange", "mauve")[i % 10])
          for i in range(36)]
# A piece tumbles through these shapes, one per frame.
TUMBLE = ((1, 2), (2, 1), (2, 2))


def confetti(step):
    """64x64: confetti thrown out from behind the badge, slowing, then falling and drifting, 10 frames.
    Each piece carries a 1px plum rim so the light colours hold on the cream end panel as well as the
    dark wood; a piece drawn later covers an earlier one, rim and all, so overlaps stay apart."""
    g = Grid(64, 64)
    for a, reach, fall, drift, phase, last, col in PIECES:
        if step > last:
            continue
        # thrown fast and slowing, with a kick upward, then gravity takes over
        r = reach * (1 - 0.55 ** (step + 1.2))
        x = 32 + math.cos(a) * r + drift * math.sin(step * 0.8 + phase) * min(step / 3, 1)
        y = 32 + math.sin(a) * r - 7 * (1 - 0.5 ** step) + fall * max(step - 1, 0) ** 2
        w, h = TUMBLE[(step + phase) % 3]
        x, y = round(x - w / 2), round(y - h / 2)
        g.rect(x - 1, y, w + 2, h, "plum")
        g.rect(x, y - 1, w, h + 2, "plum")
        g.rect(x, y, w, h, col)
    return g


# One falling confetti bit's tumble, one shape per frame as cells of its 6x6 frame: face on (3x2), edge on
# (4x1), turning (a 3-step diagonal), edge on the other way (1x4).
BIT_TUMBLE = (((1, 2), (2, 2), (3, 2), (1, 3), (2, 3), (3, 3)), ((1, 2), (2, 2), (3, 2), (4, 2)),
              ((1, 1), (2, 1), (2, 2), (3, 2), (3, 3)), ((2, 1), (2, 2), (2, 3), (2, 4)))
BIT_COLOURS = ("amber", "cyan", "green", "pink", "white", "yellow")


def confetti_bit(col, step):
    """6x6: one bit of the zone celebration's falling confetti in col, frame step of its tumble, in the
    effects' 1px plum rim."""
    g = Grid(6, 6)
    for x, y in BIT_TUMBLE[step]:
        g.p(x, y, col)
    for x, y in {(x + dx, y + dy) for x, y in BIT_TUMBLE[step] for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0))}:
        if not g.px[y][x]:
            g.p(x, y, "plum")
    return g


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    for name in BADGES:
        yield f"badge-{name}", [("earned", [badge(name).outlined()], 1000),
                                ("locked", [badge(name, True).outlined()], 1000)]
    yield "fx-confetti", [("play", [confetti(i).outlined(False) for i in range(10)], 80)]
    yield "fx-confetti-bit", [(col, [confetti_bit(col, i).outlined(False) for i in range(4)], 100)
                              for col in BIT_COLOURS]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/badges", __doc__, grounds=("733e39", "3a4466", "ead4aa"))
