#!/usr/bin/env python3
"""Draw the 40 achievement badges and the celebration burst.

badge-<achievement>: 32x32 medals, rimmed by category (firsts bronze, mastery
silver, collection gold, legend purple with gold studs for the one hardest badge,
silly pink), each with its own emblem for its goal: no two share a motif, so each
reads apart from the rest at 1x on the badge wall. The ring's outline takes icon_edge, so it holds
3:1 on the wall's cream; the face is flat cream with a 1px tan crescent along its lower right.
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
import drops  # noqa: E402
from minis import Mini  # noqa: E402
from pixel import HEART, K, Grid, bitmap, contrast, icon_edge, main  # noqa: E402
from road import SQUIRREL_FUR  # noqa: E402

RIMS = {"firsts": ("ochre", "rust", "tan"), "mastery": ("lgrey", "grey", "white"),
        "collection": ("amber", "orange", "yellow"), "legend": ("purple", "plum", "mauve"),
        "silly": ("pink", "mauve", "white")}
# The rim's studs where they are not the rim's shade: gold on the legend's purple.
STUDS = {"legend": "yellow"}
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


@icon("whole-city")
def _(g):
    """Toronto's skyline round the CN Tower: a grey needle with its pod and a red light, and either
    side blocks in the neighbourhoods' colours (Kensington's lilac, Cabbagetown's brick, the
    Distillery's ochre, the Beaches' sky), amber-lit, on a strip of High Park green."""
    blocks = ((7, 17, 4, "lilac", "violet"), (11, 13, 4, "brick", "dbrick"), (19, 15, 4, "ochre", "rust"),
              (23, 18, 3, "sky", "blue"))
    for x, top, w, fill, shade in blocks:
        g.rect(x, top, w, 24 - top, fill)
        g.rect(x + w - 1, top, 1, 24 - top, shade)
        for wy in range(top + 2, 23, 3):
            for wx in range(x + 1, x + w - 1, 2):
                g.p(wx, wy, "yellow")
    g.rect(15, 8, 2, 16, "lgrey")
    g.rect(16, 8, 1, 16, "grey")
    g.rect(15, 6, 1, 2, "grey")
    g.p(15, 5, "red")
    g.rect(13, 11, 6, 2, "lgrey")
    g.rect(13, 12, 6, 1, "grey")
    g.rect(14, 10, 4, 1, "white")
    g.rect(6, 24, 20, 2, "green")
    g.rect(6, 25, 20, 1, "dgreen")


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
    """One red leash handle splitting into three leashes, each ending in an lgrey clip."""
    g.ell(16, 8.5, 4.5, 3, "red", "dred")
    g.ell(16, 8.5, 2.5, 1.2, None)
    g.rect(15, 11, 2, 4, "red")
    for x1 in (9, 16, 23):
        line(g, (15.5 if x1 < 16 else 16.5 if x1 > 16 else 16, 14), (x1, 20), "red")
        g.ell(x1 + 0.5, 22.5, 2, 2.5, "lgrey", "grey")
        g.ell(x1 + 0.5, 22.5, 0.9, 1.3, None)


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
    """The front door in its dbrown frame, its transom lit gold, a white paw on its blue panel and an amber
    knob."""
    g.rect(10, 6, 12, 20, "dbrown")
    g.rect(11, 7, 10, 3, "gold")
    g.rect(11, 10, 10, 1, "dbrown")
    g.rect(11, 11, 10, 15, "blue")
    g.rect(11, 11, 1, 15, "sky")
    bitmap(g, 12, 14, SIGN_PAW, {"P": "white", "T": "white"})
    g.rect(18, 19, 2, 2, "amber")


@icon("close-shave")
def _(g):
    """A cracked heart breaking a sweat."""
    heart(g, 7, 10)
    for a, b in (((15, 10), (14, 13)), ((14, 13), (17, 16)), ((17, 16), (15, 19)), ((15, 19), (16, 21))):
        line(g, a, b, "plum")
    bitmap(g, 22, 5, ["..c..", ".ccc.", "cwccc", "ccccs", ".css."], {"c": "cyan", "w": "white", "s": "sky"})


# A dog side on, stretched mid-leap, forelegs reaching and hind legs pushing off: B body, L legs, E ear,
# N nose, I eye, T tail.
LEAPER = ["............EE....", "T..........EBBBB..", "TT.........BIBBBN.", ".TBBBBBBBBBBBB....", "..BBBBBBBBBBB.....",
          "..LBBBBBBBBLL.....", ".LL........LLL....", "LL...........LL..."]


@icon("dodge-ball")
def _(g):
    """A dog mid-leap over a traffic cone, its jump's arc dotted behind it."""
    g.tri((16, 15), (11.5, 24.5), (20.5, 24.5), "orange")
    g.rect(13, 19, 6, 2, "white")
    g.rect(10, 24, 12, 2, "rust")
    bitmap(g, 7, 6, LEAPER, {"B": "white", "L": "lgrey", "E": "ink", "N": "ink", "I": "ink", "T": "white"})
    for x, y in ((6, 21), (6, 18), (7, 15)):
        g.p(x, y, "sky")


@icon("full-kennel")
def _(g):
    g.tri((8, 15), (24, 15), (16, 7), "red")
    g.rect(10, 15, 12, 9, "tan")
    g.rect(13, 17, 6, 7, "plum")
    g.rect(13, 16, 6, 1, "plum")


@icon("kitted-out")
def _(g):
    """The fanny pack alone, drops.fanny_pack at 1.4x: a pocket for everything."""
    m = Mini(1.4, 16, 16)
    drops.fanny_pack(m)
    for y, row in enumerate(m.px):
        for x, c in enumerate(row):
            if c:
                g.px[y + 9][x + 5] = c


@icon("local-favourite")
def _(g):
    g.ell(16, 16, 7, 7, "yellow", "amber")
    g.rect(13, 13, 1, 2, "plum")
    g.rect(18, 13, 1, 2, "plum")
    g.p(12, 18, "plum")
    g.p(19, 18, "plum")
    g.rect(13, 19, 6, 1, "plum")
    g.p(11, 16, "pink")
    g.p(20, 16, "pink")


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
    """A pile of the treat pickup's white bones, each with its red heart."""
    for x0, y0 in ((6, 18), (16, 18), (11, 11)):
        bitmap(g, x0, y0, BONE, {"x": "white"})
        for y, row in enumerate(BONE):
            for x, ch in enumerate(row):
                if ch == "x" and (y == len(BONE) - 1 or BONE[y + 1][x] != "x"):
                    g.p(x0 + x, y0 + y, "lgrey")
        bitmap(g, x0 + 4, y0 + 2, BONE_HEART, {"r": "red", "d": "dred"})


# ---------- the second set of badges ----------

# Three-row-tall digits for a number on a badge: 3x5 each, 4 apart.
DIGITS = {"0": ["111", "1.1", "1.1", "1.1", "111"], "1": [".1.", "11.", ".1.", ".1.", "111"]}


def digits(g, x, y, text, col):
    """text in DIGITS from (x, y), col."""
    for ch in text:
        bitmap(g, x, y, DIGITS[ch], {"1": col})
        x += 4


def dizzy_star(g, cx, cy, col="yellow"):
    """A 3x3 plus-shaped dizzy star with an amber centre."""
    g.rect(cx - 1, cy, 3, 1, col)
    g.rect(cx, cy - 1, 1, 3, col)
    g.p(cx, cy, "amber")


# Hearts by width, 9, 7 and 5 wide.
H9 = [".xxx.xxx.", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", ".xxxxxxx.", "..xxxxx..", "...xxx...", "....x...."]
H7 = [".xx.xx.", "xxxxxxx", "xxxxxxx", ".xxxxx.", "..xxx..", "...x..."]
H5 = ["xx.xx", "xxxxx", "xxxxx", ".xxx.", "..x.."]
# An open palm, fingers up, thumb out to the right.
PALM = ["1.1.1..", "1.1.1..", "1.1.1.1", "11111.1", "1111111", "111111.", ".1111..", ".111..."]


@icon("twenty-grand")
def _(g):
    """A thick wad of green banknotes bound by a red paper band, a white $ on the top note."""
    for i in range(4):
        g.rect(7, 16 + i * 2, 18, 2, "dgreen" if i % 2 else "green")
    g.rect(7, 10, 18, 6, "green")
    g.rect(7, 10, 18, 1, "lgrey")
    g.rect(15, 10, 4, 14, "red")
    g.rect(15, 10, 1, 14, "pink")
    bitmap(g, 9, 10, [".1.", "111", "1..", "111", "..1", "111", ".1."], {"1": "white"})


@icon("tip-jar")
def _(g):
    """A glass jar with a slot in its dslate lid, loose gold coins piled inside."""
    g.rect(10, 9, 12, 3, "dslate")
    g.rect(13, 9, 6, 1, "ink")
    g.rect(9, 12, 14, 13, "lgrey")
    g.rect(10, 13, 12, 11, "white")
    for cx, cy in ((12.5, 22.5), (16, 22.5), (19.5, 22.5), (14, 20), (18, 20), (16, 17.5)):
        g.ell(cx, cy, 2.2, 1.6, "amber", "orange", "yellow")
    g.rect(11, 14, 1, 3, "lgrey")


# A paw print for a street sign's blade and the front door: P pad, T toe.
SIGN_PAW = [".T.T.T.", ".......", "..PPP..", ".PPPPP.", ".PPPPP."]


@icon("legend-of-the-leash")
def _(g):
    """A Toronto street sign named for you: a blue blade with a white rule and a white paw, under its
    ornamental cap, on a slate pole."""
    g.rect(15, 17, 2, 10, "slate")
    g.rect(16, 17, 1, 10, "dslate")
    g.rect(12, 26, 8, 1, "dslate")
    g.rect(5, 9, 22, 9, "navy")
    g.rect(6, 10, 20, 7, "blue")
    g.rect(6, 16, 20, 1, "white")
    bitmap(g, 13, 10, SIGN_PAW, {"P": "white", "T": "white"})
    # the cap: a stepped crest over the blade's middle, as Toronto's signs have
    g.rect(11, 7, 10, 2, "navy")
    g.rect(14, 6, 4, 1, "navy")
    g.rect(15, 7, 2, 1, "sky")


@icon("marathon")
def _(g):
    """A white race bib pinned at its corners, a red 100 on it."""
    g.rect(7, 9, 18, 14, "white")
    g.rect(7, 22, 18, 1, "lgrey")
    for x, y in ((8, 10), (23, 10), (8, 21), (23, 21)):
        g.p(x, y, "grey")
    digits(g, 10, 13, "100", "red")


@icon("tag-team")
def _(g):
    """A high five: two open palms meeting, one skin1 and one skin2, a yellow flash where they slap."""
    bitmap(g, 9, 10, PALM, {"1": "skin1"})
    bitmap(g, 16, 10, [r[::-1] for r in PALM], {"1": "skin2"})
    g.rect(9, 18, 4, 4, "sky")
    g.rect(19, 18, 4, 4, "green")
    for x, y in ((16, 4), (16, 5), (13, 6), (19, 6), (16, 8), (12, 8), (20, 8)):
        g.p(x, y, "yellow")


@icon("bird-brain")
def _(g):
    """A grey pigeon side on, facing left, with three yellow dizzy stars circling its head."""
    g.ell(18, 19, 7, 4.6, "grey", "slate", "lgrey")
    g.rect(23, 17, 4, 3, "slate")
    g.rect(13, 15, 4, 4, "teal")
    g.ell(12, 13, 3.4, 3.2, "grey", None, "lgrey")
    g.p(11, 12, "ink")
    g.tri((8.6, 13.4), (9.6, 12), (9.6, 14.6), "orange")
    g.rect(16, 18, 6, 1, "slate")
    g.rect(17, 20, 5, 1, "slate")
    for x in (16, 19):
        g.rect(x, 23, 1, 3, "pink")
    for x, y in ((7, 8), (12, 6), (17, 8)):
        dizzy_star(g, x, y)


@icon("fender-bender")
def _(g):
    """A small red car side on, facing left, its front bumper crumpled in a zigzag, an amber impact mark
    beside it."""
    g.rect(11, 11, 9, 5, "red")
    g.rect(12, 12, 3, 3, "sky")
    g.rect(16, 12, 3, 3, "sky")
    g.rect(9, 15, 17, 6, "red")
    g.rect(9, 20, 17, 1, "dred")
    g.rect(24, 16, 2, 2, "amber")
    for y, x in ((15, 9), (16, 8), (17, 9), (18, 8), (19, 9), (20, 8)):
        g.p(x, y, "lgrey")
    g.ell(13, 21.5, 2.4, 2.4, "ink")
    g.ell(22, 21.5, 2.4, 2.4, "ink")
    g.p(13, 21, "grey")
    g.p(22, 21, "grey")
    for a, b in (((6, 13), (4, 11)), ((6, 17), (4, 17)), ((6, 21), (4, 23))):
        line(g, a, b, "amber")


@icon("trash-panda")
def _(g):
    """A raccoon's face front on: grey head, round dark ears, a black eye mask with white brows and eyes,
    a white muzzle and an ink nose."""
    g.ell(9.5, 9.5, 3, 3, "slate")
    g.ell(22.5, 9.5, 3, 3, "slate")
    g.ell(9.5, 9.5, 1.4, 1.4, "pink")
    g.ell(22.5, 9.5, 1.4, 1.4, "pink")
    g.ell(16, 16, 9, 7.5, "grey", "slate", "lgrey")
    g.rect(9, 12, 14, 1, "white")
    g.ell(11.5, 15.5, 3.4, 2.4, "ink")
    g.ell(20.5, 15.5, 3.4, 2.4, "ink")
    g.rect(12, 14, 8, 3, "ink")
    g.p(11, 15, "white")
    g.p(20, 15, "white")
    g.ell(16, 20.5, 4.5, 3, "white")
    g.ell(16, 18.8, 1.6, 1.1, "ink")


@icon("burned-bridges")
def _(g):
    """A thick wooden arch bridge, lit tan along its top, a small flame burning on its crown."""
    for x in range(6, 27):
        u = (x + 0.5 - 16) / 10.5
        top = round(23 - 7 * math.sqrt(max(0.0, 1 - u * u)))
        g.rect(x, top, 1, 5, "brown")
        g.p(x, top, "tan")
        g.p(x, top + 4, "dbrown")
    for x in (6, 7, 25, 26):
        g.rect(x, 23, 1, 3, "dbrown")
    g.ell(16, 13.5, 3.2, 3, "orange")
    g.tri((16, 7), (13, 13), (19, 13), "orange")
    g.ell(16, 14, 1.8, 1.8, "yellow")
    g.tri((16, 10), (14.5, 14), (17.5, 14), "yellow")


@icon("finders-keepers")
def _(g):
    """The lost wallet as the road draws it: a green bill with a white $ standing up out of a brown
    wallet whose flap tab carries an amber snap."""
    g.rect(10, 6, 12, 10, "green")
    g.rect(10, 6, 12, 1, "lgrey")
    bitmap(g, 15, 7, [".x.", "xxx", "x..", "xxx", "..x", "xxx", ".x."], {"x": "white"})
    g.rect(6, 14, 20, 11, "brown")
    g.rect(6, 14, 20, 1, "tan")
    g.rect(6, 24, 20, 1, "dbrown")
    g.rect(25, 14, 1, 11, "dbrown")
    g.rect(17, 17, 9, 5, "dbrown")
    g.rect(21, 19, 3, 1, "amber")


@icon("popular-pack")
def _(g):
    """Three whole hearts floating up from big to small, the way the friendly neighbour's hearts rise:
    red, red and pink, each with a white glint."""
    for x0, y0, rows in ((6, 14, H9), (17, 10, H7), (11, 6, H5)):
        bitmap(g, x0, y0, rows, {"x": "red" if rows is not H5 else "pink"})
        g.p(x0 + 1, y0 + 1, "white")

# ---------- the card choices and the Spotlight ----------

# The stage lamp at the Spotlight's upper left, aimed down and right: d its dslate can, s slate light on it,
# g its grey rim and yoke, w the white lens.
LAMP = ["...g.......", "..gsdd.....", ".gssddd....", "gssdddddd..", ".sddddddd..", "..dddddgw..", "...ddddgww.",
        "....dgwww..", ".....gww..."]
# A $ for a price tag, 3x7.
DOLLAR = [".1.", "111", "1..", "111", "..1", "111", ".1."]
# A camera flash, 5x5.
SPARK = ["..w..", ".wyw.", "wyyyw", ".wyw.", "..w.."]


@icon("paparazzi")
def _(g):
    """The Spotlight debuff's stage lamp at the upper left, throwing one wide yellow beam down and right,
    gold along its middle."""
    g.tri((12, 15), (15, 12), (27, 18), "yellow")
    g.tri((12, 15), (27, 18), (18, 27), "yellow")
    g.tri((13, 15), (15, 13), (24, 22), "gold")
    bitmap(g, 6, 6, LAMP, {"d": "dslate", "s": "slate", "g": "grey", "w": "white"})


@icon("zookeeper")
def _(g):
    """The escaped capybara side on, facing right, its blunt snout and small ear under its keeper's khaki
    safari hat."""
    g.ell(13, 19, 7.5, 5, "brown", "dbrown", "tan")
    g.rect(18, 13, 6, 8, "brown")
    g.rect(23, 14, 3, 6, "brown")
    g.rect(18, 20, 8, 1, "dbrown")
    g.rect(25, 15, 1, 2, "dbrown")
    g.p(24, 18, "plum")
    g.p(21, 15, "ink")
    g.rect(17, 12, 2, 2, "dbrown")
    for x in (8, 11, 15, 18):
        g.rect(x, 22, 2, 3, "dbrown")
    g.rect(16, 11, 10, 1, "ochre")
    g.rect(18, 8, 6, 3, "ochre")
    g.rect(18, 8, 6, 1, "tan")
    g.rect(18, 10, 6, 1, "dbrown")


@icon("say-cheese")
def _(g):
    """The wedding photographer's camera face on, its flash popping, the bride's red and pink bouquet in its
    white ribbon before it."""
    g.rect(15, 10, 5, 2, "slate")
    g.rect(10, 12, 16, 10, "dslate")
    g.rect(10, 12, 16, 1, "slate")
    g.rect(10, 21, 16, 1, "navy")
    g.rect(21, 10, 3, 2, "lgrey")
    g.ell(18, 16.5, 4.5, 4.5, "lgrey", "grey", "white")
    g.ell(18, 16.5, 3, 3, "ink")
    g.ell(18, 16.5, 1.6, 1.6, "blue")
    g.p(17, 15, "white")
    bitmap(g, 20, 5, SPARK, {"w": "white", "y": "yellow"})
    for x, y in ((9, 23), (11, 23), (10, 24)):
        g.rect(x, y, 1, 2, "dgreen")
    g.rect(9, 22, 3, 1, "white")
    for cx, cy, col in ((8.5, 19.5, "red"), (12.5, 19.5, "pink"), (10.5, 18, "pink"), (10.5, 21, "red")):
        g.ell(cx, cy, 1.8, 1.8, col)


@icon("sugar-rush")
def _(g):
    """An upright ice cream cone, its waffle an ochre cone crossed by rust lines 4px apart, its pink scoop
    lit white with one drip down the waffle."""
    cone = Grid(32, 32)
    cone.tri((11, 15), (21, 15), (16, 27), "ochre")
    for y in range(32):
        for x in range(32):
            if cone.px[y][x]:
                g.p(x, y, "rust" if (x + y) % 4 == 0 or (x - y) % 4 == 0 else "ochre")
    g.ell(16, 11.5, 6, 5, "pink", "mauve", "white")
    g.rect(11, 15, 10, 1, "pink")
    g.rect(13, 16, 2, 3, "pink")


# A fish side on, facing left: B its sky body, D the blue back, W the white belly, F the blue fins and tail,
# I its eye.
FISH = ["......DDDD.......", "....DDDDDDDD...FF", "..BBBBBBBBBBB.FFF", ".BIBBBBBBBBBBBFFF", "BBBBBBBBBBBBBBFF.",
        ".BBWWWWWWWBBBBFFF", "..WWWWWWWWWBB.FFF", "....WWWWWW.....FF"]


@icon("fishmongers-friend")
def _(g):
    """A fish off the spilled crates with an amber price tag tied on, a dbrown $ on it."""
    bitmap(g, 6, 8, FISH, {"B": "sky", "D": "blue", "W": "white", "F": "blue", "I": "ink"})
    line(g, (19, 14), (18, 17), "plum")
    g.rect(14, 18, 9, 9, "amber")
    g.rect(14, 18, 9, 1, "yellow")
    g.rect(22, 18, 1, 9, "orange")
    g.p(18, 18, "plum")
    bitmap(g, 17, 20, DOLLAR, {"1": "dbrown"})


# The porch cat's fish treat: b brown, d its dbrown eye and tail edge.
TREAT = [".bbbb.d", "bdbbbbd", ".bbbb.d"]


@icon("cat-whisperer")
def _(g):
    """The porch cat's calico face front on, an orange patch and an ink patch over its white, a little heart
    above it and a brown fish treat under its chin."""
    g.tri((7, 16), (8, 8), (13, 12), "orange")
    g.tri((16, 12), (21, 8), (22, 16), "ink")
    g.tri((8.5, 14), (9, 10.5), (11.5, 12.5), "pink")
    g.ell(14.5, 17.5, 8, 6, "white", "lgrey")
    g.ell(10, 14.5, 3.5, 2.5, "orange")
    g.ell(19.5, 14.5, 3, 2.2, "ink")
    g.rect(10, 16, 2, 2, "green")
    g.rect(17, 16, 2, 2, "green")
    g.p(11, 16, "ink")
    g.p(18, 16, "ink")
    g.p(14, 19, "pink")
    g.p(13, 20, "plum")
    g.p(15, 20, "plum")
    bitmap(g, 12, 6, H5, {"x": "red"})
    g.p(13, 7, "white")
    bitmap(g, 12, 23, TREAT, {"b": "brown", "d": "dbrown"})


# A dog's paw raised to wave: F fur, P a pink pad.
WAVE_PAW = [".P.P.P.", "PFPFPFP", "FFFFFFF", "FFPPPFF", "FPPPPPF", ".FPPPF.", "..FFF..", "..FFF..", "..FFF.."]


@icon("big-screen")
def _(g):
    """The promo's big screen on its post, bulbs along the top, a dog's paw on it waving between yellow
    wave marks."""
    g.rect(15, 21, 3, 4, "slate")
    g.rect(12, 25, 9, 1, "dslate")
    g.rect(8, 8, 17, 14, "ink")
    g.rect(9, 10, 15, 11, "blue")
    g.rect(9, 10, 15, 4, "sky")
    for x in range(9, 24, 2):
        g.p(x, 8, "yellow")
    bitmap(g, 13, 11, WAVE_PAW, {"F": "ochre", "P": "pink"})
    for x, y in ((11, 12), (10, 13), (10, 14), (11, 15), (21, 12), (22, 13), (22, 14), (21, 15)):
        g.p(x, y, "yellow")


@icon("clean-streets")
def _(g):
    """A Toronto green bin standing upright with its lid shut: a dgreen cart lit green down its left and shaded
    forest on its right, tapering to two dslate wheels, its lid overhanging the top with a grip at the front and
    an lgrey latch below it."""
    g.rect(9, 8, 14, 3, "green")
    g.rect(9, 10, 14, 1, "dgreen")
    g.rect(10, 7, 12, 1, "green")
    g.rect(14, 11, 4, 1, "forest")
    for y in range(11, 24):
        inset = (y - 11) // 6
        g.rect(10 + inset, y, 12 - 2 * inset, 1, "dgreen")
        g.p(10 + inset, y, "green")
        g.rect(20 - inset, y, 2, 1, "forest")
    g.rect(15, 12, 2, 3, "lgrey")
    g.rect(11, 23, 3, 3, "dslate")
    g.rect(18, 23, 3, 3, "dslate")


BADGES = {
    "double-leash": "firsts", "pack-leader": "firsts", "round-trip": "firsts",
    "legend-of-the-leash": "legend",
    "big-payday": "mastery", "clean-paws": "mastery", "dodge-ball": "mastery", "everybody-home": "mastery",
    "five-star-service": "mastery", "marathon": "mastery", "not-a-scratch": "mastery", "tip-jar": "mastery",
    "twenty-grand": "mastery",
    "full-kennel": "collection", "kitted-out": "collection", "local-favourite": "collection",
    "tag-team": "collection", "whole-city": "collection",
    "big-screen": "silly", "bird-brain": "silly", "burned-bridges": "silly", "cat-whisperer": "silly",
    "clean-streets": "silly", "close-shave": "silly", "eau-de-skunk": "silly", "fender-bender": "silly", "finders-keepers": "silly",
    "fishmongers-friend": "silly", "mud-season": "silly", "paparazzi": "silly", "popular-pack": "silly",
    "say-cheese": "silly", "snack-attack": "silly", "sniff-test": "silly", "squirrel": "silly",
    "sugar-rush": "silly", "trash-panda": "silly", "yoink": "silly", "youre-fired": "silly",
    "zookeeper": "silly", "zoomies": "silly",
}


def face(g):
    """The medal's flat cream face, r 11, with a 1px tan crescent along its lower-right rim where the ring's
    lip shades it, so the emblem stands on one quiet colour."""
    for y in range(32):
        for x in range(32):
            if math.hypot(x + 0.5 - 16, y + 0.5 - 16) <= 11:
                g.p(x, y, "tan" if math.hypot(x + 1.5 - 16, y + 1.5 - 16) > 11 else "cream")


def badge(name, locked=False):
    rim, rim_sh, rim_li = RIMS[BADGES[name]]
    g = Grid(32, 32)
    # the ring's outline holds 3:1 on the badge wall's cream panel, its white and yellow lights included
    g.edge = icon_edge
    g.ell(16, 16, 14.5, 14.5, rim, rim_sh, rim_li)
    # twelve studs round the ring, the right and bottom ones held 1px inside its outer edge (column and row
    # 29) as the left and top ones are, so none breaks the rim
    for a in range(0, 360, 30):
        x, y = (min(int(16 + f(math.radians(a)) * 13), 28) for f in (math.cos, math.sin))
        g.p(x, y, STUDS.get(BADGES[name], rim_sh))
    face(g)
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
        ring_to = {K[rim]: K["ndslate"], K[rim_sh]: K["ink"], K[rim_li]: K["nslate"],
                   K[STUDS.get(BADGES[name], rim_sh)]: K["ink"]}
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
