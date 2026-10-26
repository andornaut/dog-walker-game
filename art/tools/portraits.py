#!/usr/bin/env python3
"""Draw the dog and walker portraits for the start screen's detail card and the shop.

portrait-dog-<name> and portrait-walker-<name>: 64x64 images in Endesga 32
with an ink outer line closed along the bottom edge, cel shaded, on
transparency, in a three-quarter front view turned toward the viewer's left
(into the top-left light). Each dog sits, head and shoulders with its front
paws at the bottom edge; its coat, markings and accessories match its road
sprite and face in dogs.py. Each walker is a head-and-shoulders bust to the
bottom edge; their skin, hair, cap, clothes and Trista's tote match their
road sprite in road.py and face in owners.py.

Usage:
  portraits.py preview OUT.png   every portrait beside its face (at 2x), on the
                                 start screen's tile colours, scaled up
  portraits.py build             write art/portraits/*.aseprite and
                                 public/art/images/*.png

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import dogs  # noqa: E402
import minis  # noqa: E402
import owners  # noqa: E402
from pixel import DARKER, K, Grid, edged, to_image  # noqa: E402

S = 64


def dk2(c):
    """The colour two ramp steps darker than c, a K name or hex: a portrait's inner line."""
    return DARKER[DARKER[K.get(c, c)]]


def lined(g, cx, cy, rx, ry, c, sh=None, li=None):
    """An ellipse ringed in its colour two ramp steps darker, for a shape drawn over one of the same coat."""
    g.ell(cx, cy, rx + 1, ry + 1, dk2(c))
    g.cel(cx, cy, rx, ry, c, sh, li)


# ---------- shared features ----------
# The head turns toward the viewer's left: the muzzle sits left of the skull's
# centre, the far (left) eye is narrower and the near (right) eye full width.

def eye(g, x, y, w=5, iris=None):
    """A big round eye 6 tall, with a two-pixel shine top-left and a glint bottom-right."""
    g.rect(x + 1, y, w - 2, 6, "ink")
    g.rect(x, y + 1, w, 4, "ink")
    if iris:
        g.rect(x + 1, y + 1, w - 2, 4, iris)
        g.rect(x + 1, y + 2, w - 2, 2, "ink")
    g.rect(x + 1, y + 1, 2 if w > 4 else 1, 2, "white")
    g.p(x + w - 2, y + 4, "white" if not iris else "blue")


def eyes(g, fx, nx, y, iris=None):
    eye(g, fx, y, 4, iris)
    eye(g, nx, y, 5, iris)


def nose(g, x, y):
    """A rounded nose 6 wide with a shine, then the happy open mouth under it."""
    g.rect(x + 1, y, 4, 4, "ink")
    g.rect(x, y + 1, 6, 2, "ink")
    g.rect(x + 1, y + 1, 2, 1, "slate")
    # philtrum, then a w-shaped smile around a pink tongue
    g.rect(x + 2, y + 4, 2, 1, "ink")
    g.ell(x + 3, y + 7, 3.5, 2.5, "dred")
    g.cel(x + 3, y + 8.5, 2, 2, "pink", "mauve")
    g.p(x + 3, y + 8, "mauve")
    for dx, dy in ((-2, 5), (-1, 5), (0, 5), (1, 5), (4, 5), (5, 5), (6, 5), (7, 5), (-3, 4), (8, 4)):
        g.p(x + dx, y + dy, "ink")


def legs(g, xs, top, c, sh, w=6):
    """Front legs from top to the bottom edge, each shaded down its right side, with toes on the paws."""
    for x in xs:
        g.rect(x, top, w, S - top - 2, c)
        g.rect(x + w - 1, top, 1, S - top - 3, sh)
        g.cel(x + w / 2, S - 2.5, w / 2 + 1, 2.5, c, sh)
        for t in range(1, w, 2):
            g.p(x + t, S - 2, sh)


def pom(g, cx, cy, rx, ry, n=8, c="skin1", sh="brown", li="cream"):
    """A clipped pom-pom: an ellipse ringed by n lumps, so the silhouette scallops like curls.
    The pom takes the shadow; each lump only a highlight, which keeps the curls from turning blotchy."""
    r = min(rx, ry) * 0.45
    lumps = [(cx + (rx - r * 0.5) * math.cos(a), cy + (ry - r * 0.5) * math.sin(a))
             for a in (2 * math.pi * (k + 0.5) / n for k in range(n))]
    g.ell(cx, cy, rx, ry, dk2(c))
    for x, y in lumps:
        g.ell(x, y, r + 1, r + 1, dk2(c))
    g.cel(cx, cy, rx - 1, ry - 1, c, sh, li)
    for x, y in lumps:
        g.cel(x, y, r, r, c, sh if y > cy + ry * 0.5 else None, li)
    g.ell(cx, cy, rx - r, ry - r, c)


# ---------- Duchess: Maltese, small, white, pink bow ----------

def duchess(g):
    # long silky coat falling to the ground, the haunch behind on the right
    g.cel(44, 54, 12, 9, "white", "lgrey")
    g.cel(31, 52, 13, 12, "white", "lgrey", "white")
    for x in range(20, 46, 4):
        g.tri((x, 58), (x + 4, 58), (x + 2, 63), "white")
        g.p(x + 3, 61, "lgrey")
    legs(g, (24, 33), 54, "white", "lgrey", w=5)
    # long ears drape to the chest
    g.cel(16, 34, 6, 11, "white", "lgrey")
    lined(g, 30, 25, 15, 13, "white", "lgrey")
    g.cel(43, 35, 6, 12, "white", "lgrey")
    g.cel(43, 35, 4.5, 10, "white", "lgrey")
    g.rect(41, 26, 1, 16, "lgrey")
    g.cel(25, 32, 8, 5.5, "white", "lgrey")
    g.rect(27, 12, 6, 2, "lgrey")
    bow(g, 30, 9)
    eyes(g, 17, 31, 22)
    nose(g, 21, 29)


def bow(g, cx, y, colours=("pink", "mauve")):
    """Duchess's pink bow, or Pepe's mauve show ribbon tied in purple: the knot and folds take the second colour."""
    c, knot = colours
    g.tri((cx - 1, y + 2), (cx - 9, y - 2), (cx - 8, y + 7), c)
    g.tri((cx + 1, y + 2), (cx + 9, y - 2), (cx + 8, y + 7), c)
    g.tri((cx - 1, y + 2), (cx - 8, y + 7), (cx - 6, y + 6), knot)
    g.tri((cx + 1, y + 2), (cx + 8, y + 7), (cx + 6, y + 6), knot)
    g.p(cx - 7, y, "white")
    g.rect(cx - 2, y, 4, 4, knot)
    g.rect(cx - 1, y + 1, 2, 1, c)


# ---------- Nugget: pug, small, fawn, black mask, red bandana ----------

def nugget(g):
    g.cel(45, 55, 11, 8, "skin1", "skin2", "cream")
    # curled tail over the hip
    g.cel(53, 46, 3.5, 3, "skin1", "skin2", "cream")
    g.p(53, 46, "skin2")
    g.cel(31, 53, 13, 11, "skin1", "skin2", "cream")
    legs(g, (23, 33), 54, "skin1", "skin2")
    # bandana knotted at the throat, white polka dots
    g.tri((17, 41), (45, 41), (30, 56), "red")
    g.tri((32, 47), (45, 41), (30, 56), "dred")
    for x, y in ((23, 43), (31, 45), (38, 43), (28, 49), (34, 50)):
        g.p(x, y, "white")
    g.cel(30, 26, 17, 15, "skin1", "skin2", "cream")
    # folded black ears
    g.tri((13, 21), (17, 11), (23, 15), "navy")
    g.tri((47, 20), (44, 10), (37, 14), "navy")
    g.tri((44, 20), (44, 12), (39, 15), "ink")
    # forehead wrinkles
    g.rect(24, 16, 9, 1, "skin2")
    g.rect(26, 18, 6, 1, "skin2")
    # black mask over a short flat muzzle
    g.cel(26, 32, 9, 7, "navy", "ink", "dslate")
    g.ell(21, 26, 4, 4, "navy")
    g.ell(35, 26, 4.5, 4, "navy")
    eyes(g, 18, 33, 23)
    nose(g, 23, 29)


# ---------- Zippy: Jack Russell, small, white with tan patches, red collar ----------

def zippy(g):
    g.cel(44, 54, 11, 9, "white", "lgrey")
    g.cel(47, 51, 5, 4, "ochre", "rust")
    g.cel(31, 52, 12, 11, "white", "lgrey")
    legs(g, (24, 33), 52, "white", "lgrey", w=5)
    g.rect(19, 40, 24, 3, "red")
    g.rect(19, 42, 24, 1, "dred")
    g.cel(30, 44, 2.5, 2.5, "amber", "orange", "yellow")
    g.cel(30, 26, 16, 14, "white", "lgrey")
    # tan patches over both eyes and ears; a white blaze between
    g.cel(20, 21, 6.5, 6.5, "ochre", "rust", "tan")
    g.cel(37, 20, 7.5, 7, "ochre", "rust", "tan")
    g.rect(27, 12, 3, 12, "white")
    # button ears folded forward
    g.tri((11, 20), (14, 9), (22, 13), "ochre")
    g.tri((13, 18), (14, 12), (19, 14), "rust")
    g.tri((49, 19), (45, 8), (37, 12), "ochre")
    g.tri((47, 17), (45, 11), (40, 13), "rust")
    g.cel(25, 32, 8, 5.5, "white", "lgrey")
    eyes(g, 17, 32, 21)
    nose(g, 21, 28)


# ---------- Pepe (key pierre): miniature poodle, medium, black with a white stripe, show-clip pom-poms ----------

# Pepe's coat is dogs.CURL and dogs.SHAVED.


def pierre(g):
    # shaved legs with pom-pom bracelets, a curly mane over the chest
    g.cel(48, 56, 9, 7, *dogs.CURL)
    for x in (24, 35):
        g.rect(x, 50, 4, 10, dogs.SHAVED[0])
        g.rect(x + 3, 50, 1, 10, dogs.SHAVED[1])
        pom(g, x + 2, 60.5, 4.5, 3, 5, *dogs.CURL)
    pom(g, 31, 48, 14, 9, 10, *dogs.CURL)
    # the white stripe running on from the topknot along the top of the back to the rump, shaded under it
    for x in range(41, 57):
        y = round(56 - 7 * math.sqrt(max(0, 1 - ((x + 0.5 - 48) / 9) ** 2))) + 1
        g.rect(x, y, 1, 2, "white")
        g.p(x, y + 2, "lgrey")
    # long fluffy ears hanging from under the topknot
    pom(g, 16, 35, 6, 11, 6, *dogs.CURL)
    pom(g, 45, 35, 6, 11, 6, *dogs.CURL)
    # the smooth shaved face, ringed a step darker than the curls and set off from them by the shadow it
    # casts down and right, under a smaller topknot whose scalloped edge overlaps the brow
    g.ell(31.5, 31.5, 11, 10.5, "ink")
    g.ell(29.5, 27, 11.5, 10.5, "navy")
    g.cel(29.5, 27, 10.5, 9.5, *dogs.SHAVED)
    pom(g, 30, 15.5, 12, 6, 9, *dogs.CURL)
    # the white stripe from the brow up over the topknot, shaded down its right side, under the show bow
    g.rect(28, 10, 4, 10, "white")
    g.rect(31, 11, 1, 9, "lgrey")
    g.rect(29, 20, 2, 2, "white")
    bow(g, 30, 10, colours=("mauve", "purple"))
    # shaved muzzle, long and narrow
    lined(g, 23, 32, 7, 4.5, "grey", "slate")
    eyes(g, 20, 32, 22)
    nose(g, 15, 29)


# ---------- Biscuit: beagle, medium, tricolour, long ears, green collar ----------

def biscuit(g):
    # black saddle and white-tipped tail behind, white chest in front
    g.rect(52, 33, 3, 12, "navy")
    g.rect(52, 30, 3, 4, "white")
    g.cel(45, 53, 12, 9, "navy", "ink", "dslate")
    g.cel(46, 58, 10, 6, "ochre", "rust")
    g.cel(31, 52, 13, 11, "white", "lgrey")
    legs(g, (23, 33), 52, "white", "lgrey")
    g.rect(18, 40, 26, 3, "green")
    g.rect(18, 42, 26, 1, "dgreen")
    g.cel(30, 44, 2.5, 2.5, "amber", "orange", "yellow")
    g.cel(30, 26, 16, 14, "ochre", "rust", "tan")
    # white blaze down the forehead into a white muzzle
    g.tri((27, 12), (31, 12), (29, 26), "white")
    g.rect(27, 12, 4, 6, "white")
    g.cel(25, 33, 9, 6.5, "white", "lgrey")
    # long ears hang past the cheeks
    g.cel(13, 33, 5, 12, "rust", "dbrown")
    g.cel(47, 33, 5.5, 12, "rust", "dbrown")
    g.rect(45, 23, 1, 18, "dbrown")
    eyes(g, 18, 33, 22)
    nose(g, 20, 29)


# ---------- Archie: Australian Shepherd, medium, red merle, one blue eye, red bandana ----------

def archie(g):
    coat, (blot,), (ear, tip) = dogs.COAT, dogs.BLOT, dogs.EAR
    # merle haunch and bobtail behind, a white ruff down the chest in front
    g.cel(45, 54, 12, 9, *coat)
    g.cel(53, 46, 3.5, 3, *coat)
    g.cel(44, 52, 4.5, 3, blot)
    g.cel(52, 59, 3, 2.5, blot)
    g.cel(31, 52, 13, 11, "white", "lgrey")
    legs(g, (23, 33), 53, "white", "lgrey")
    for x in (23, 33):
        g.rect(x, 53, 5, 2, "ochre")
    # the red bandana knotted at the throat, plain, with its fold in dred
    g.tri((17, 40), (45, 40), (30, 57), "red")
    g.tri((32, 46), (45, 40), (30, 57), "dred")
    g.rect(17, 40, 28, 1, "dred")
    # ears set high, the tips folding forward
    g.tri((12, 21), (15, 7), (24, 13), ear)
    g.tri((15, 7), (9, 13), (16, 13), tip)
    g.tri((47, 20), (45, 6), (36, 12), ear)
    g.tri((45, 6), (51, 12), (44, 12), tip)
    g.cel(30, 26, 16, 14, *coat)
    # merle in three flat patches: over the blue eye, across the skull and on the near cheek
    g.cel(20, 23, 6.5, 6, blot)
    g.cel(38, 16, 4.5, 3.5, blot)
    g.cel(42.5, 28.5, 2.5, 2, blot)
    # white blaze into a white muzzle, copper brows and cheek
    g.tri((27, 12), (31, 12), (29, 26), "white")
    g.rect(27, 12, 4, 5, "white")
    g.rect(34, 19, 3, 1, "ochre")
    g.cel(38, 32, 3, 2.5, "ochre", "rust")
    g.cel(25, 33, 9, 6.5, "white", "lgrey")
    eye(g, 18, 22, 4, "sky")
    # the near eye amber
    eye(g, 33, 22, 5, "amber")
    g.p(36, 26, "orange")
    nose(g, 20, 29)
    # a liver nose
    g.rect(21, 29, 4, 4, "plum")
    g.rect(20, 30, 6, 2, "plum")
    g.rect(21, 30, 2, 1, "dbrown")


# ---------- Snowy: Great Pyrenees, big, giant white fluff, collar with a bell ----------

def snowball(g):
    g.cel(47, 52, 14, 11, "white", "lgrey")
    g.cel(31, 50, 18, 14, "white", "lgrey")
    legs(g, (21, 34), 52, "white", "lgrey", w=7)
    # a thick ruff under the jaw, wider than the skull
    g.cel(31, 36, 23, 8, "white", "lgrey")
    g.rect(17, 43, 28, 2, "sky")
    g.rect(17, 44, 28, 1, "blue")
    g.cel(31, 47.5, 3.5, 3.5, "amber", "orange", "yellow")
    g.rect(30, 48, 3, 1, "orange")
    # a Great Pyrenees' broad flat skull, small V drop ears set at its sides and marked badger tan, and a long
    # wedge muzzle set off by its line, so he reads as a grown giant rather than a pup
    g.cel(30, 24, 17, 14, "white", "lgrey")
    dogs.inlay(g, "skin2", lambda t: (t.tri((13, 15), (22, 12), (16, 28), "tan"),
                                      t.tri((15, 15), (21, 13.5), (16.5, 24), "cream")))
    dogs.inlay(g, "skin2", lambda t: (t.tri((38, 12), (47, 15), (44, 28), "tan"),
                                      t.tri((39.5, 13.5), (45, 15.5), (43.5, 24), "cream")))
    lined(g, 25, 32, 9, 6, "white", "lgrey")
    eyes(g, 18, 31, 20)
    nose(g, 20, 28)


# ---------- Penny: golden retriever with a Labrador build, big, golden coat, otter tail, blue collar ----------

def penny(g):
    base, shade, light = dogs.GOLD
    # the haunch, and a thick otter tail curled forward round it along the ground, tapering to a blunt tip
    g.cel(46, 53, 13, 10, base, shade, light)
    dogs.inlay(g, dk2(base), lambda t: (t.cel(52, 59.5, 10, 3.5, base, shade, light),
                                        t.tri((42, 58), (42, 63), (34, 62), base)))
    # a deep chest on solid legs
    g.cel(31, 51, 15.5, 13, base, shade, light, power=2.4)
    legs(g, (21, 33), 53, base, shade, w=7)
    # blue collar and a silver tag
    g.rect(16, 42, 30, 3, "blue")
    g.rect(16, 42, 30, 1, "sky")
    g.cel(30, 47.5, 2.5, 2.5, "lgrey", "grey", "white")
    # a broad, blocky head
    g.cel(30, 25, 17, 14, base, shade, light, power=2.6)
    # short flat drop ears set at the top of the skull's sides, hanging no lower than the jaw
    dogs.inlay(g, dk2(shade), lambda t: (t.tri((11, 16), (21, 13), (15, 37), shade),
                                         t.tri((11, 16), (10, 33), (15, 37), shade)))
    dogs.inlay(g, dk2(shade), lambda t: (t.tri((39, 13), (49, 16), (47, 38), shade),
                                         t.tri((49, 16), (51, 34), (47, 38), shade)))
    # a square muzzle, a shade lighter than the coat, set off from the brow by a clear stop
    dogs.inlay(g, dk2(light), lambda t: t.cel(25, 34, 9, 6.5, light, base, power=3.2))
    eyes(g, 18, 33, 21)
    nose(g, 21, 29)


# ---------- Koda: Alaskan Malamute, big, heavy, grey and white, blue eyes, orange harness ----------

def koda(g):
    g.cel(46, 52, 13, 11, "slate", "dslate", "grey")
    g.cel(31, 51, 15, 13, "lgrey", "grey", "white")
    legs(g, (22, 33), 53, "lgrey", "grey", w=6)
    # a Y-front harness: a strap down from each shoulder to a ring on the chest, one down from it
    for i in range(9):
        g.rect(18 + i * 1.3, 40 + i, 3, 2, "orange")
        g.rect(42 - i * 1.3, 40 + i, 3, 2, "orange")
        g.p(18 + i * 1.3, 41 + i, "rust")
        g.p(44 - i * 1.3, 41 + i, "rust")
    g.rect(28, 49, 4, 7, "orange")
    g.rect(31, 49, 1, 7, "rust")
    g.cel(30, 49, 2.5, 2.5, "grey", "slate", "lgrey")
    # a Malamute's ears: small, set wide on the broad skull, their tips rounded, pink inside
    g.tri((10, 21), (13, 6), (24, 13), "slate")
    g.tri((13.5, 17), (14, 10), (21, 13), "pink")
    g.tri((48, 20), (46, 5), (36, 12), "slate")
    g.tri((45, 16), (44.5, 9), (39, 12), "pink")
    g.cel(30, 26, 19, 15, "slate", "dslate", "grey")
    # white mask: brows, cheeks and muzzle
    g.cel(27, 33, 13, 8, "lgrey", "grey", "white")
    g.rect(27, 13, 3, 12, "lgrey")
    g.rect(17, 19, 5, 2, "white")
    g.rect(33, 19, 6, 2, "white")
    eyes(g, 17, 33, 21, iris="sky")
    nose(g, 21, 29)


# ---------- the walkers: head-and-shoulders busts ----------
# The face turns toward the viewer's left like the dogs': the features sit left of the head's centre, the far
# (left) eye is narrower, and only the near (right) ear shows. Faces stay clean: flat skin with a blush, a
# shadow only under the hair or cap and down the near edge beside the eyes, never across the jaw or mouth.

def human_eye(g, x, y, w, h=5, sclera=False):
    """An eye h tall and w wide, rounded at the corners, with a shine top-left and a glint bottom-right;
    sclera sets a white left of the pupil, so the eye reads on dark skin."""
    g.rect(x, y + 1, w, h - 2, "ink")
    g.rect(x + 1, y, w - 2, h, "ink")
    s = 2 if w > 4 else 1
    g.rect(x + 1, y + 1, s, s if h > 5 else 1, "white")
    g.p(x + w - 2, y + h - 2, "white")
    if sclera:
        g.rect(x - 1, y + 2, 1, 2, "white")


def smile(g, x, y, lips="ink", teeth="white"):
    """A small open smile 7 wide, centred on x, its corners turned up."""
    g.rect(x - 3, y, 7, 1, lips)
    g.rect(x - 2, y + 1, 5, 1, lips)
    g.p(x - 4, y - 1, lips)
    g.p(x + 4, y - 1, lips)
    g.rect(x - 2, y, 5, 1, teeth)


def shade_under(g, skin, sh, x0, x1, top):
    """A 1px shadow on the face just under whatever hair or cap sits over it, between columns x0 and x1."""
    skin, sh = K[skin], K[sh]
    for x in range(x0, x1 + 1):
        for y in range(top, S):
            if g.px[y][x] == skin:
                if y > top and g.px[y - 1][x] not in (skin, None):
                    g.p(x, y, sh)
                break


def shade_near(g, skin, sh, y0, y1):
    """A 1px shadow down the near (right) edge of the face from row y0 to y1, beside the eyes."""
    skin = K[skin]
    for y in range(y0, y1 + 1):
        xs = [x for x in range(S) if g.px[y][x] == skin]
        if xs:
            g.p(max(xs), y, sh)


def ring(g, cx, cy, rx, ry, c):
    """A 1px oval outline."""
    for y in range(S):
        for x in range(S):
            d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
            if abs(d - 1) * min(rx, ry) < 0.5:
                g.p(x, y, c)


def bust(g, c, sh, li=None, neck="skin2", cx=32, cy=62, rx=27, ry=16, nx=25, nw=9):
    """Shoulders cut by the bottom edge, and the neck."""
    g.cel(cx, cy, rx, ry, c, sh, li)
    g.rect(nx, 38, nw, 10, neck)


def adult_face(g, brow, blush="pink", brow_y=23):
    """Eyes under short brows, a dot of nose shadow, a blush on each cheek and a small smile."""
    for x, w in ((20, 3), (32, 4)):
        human_eye(g, x, 26, w)
        g.rect(x, brow_y, w, 1, brow)
    g.p(26, 33, "skin2")
    if blush:
        g.rect(17, 33, 3, 1, blush)
        g.rect(34, 33, 3, 1, blush)
    smile(g, 26, 36)


def casey(g):
    """The amber cap with its orange brim over brown hair, the sky hoodie with its blue hood, white drawstrings
    and kangaroo pocket."""
    bust(g, "sky", "blue", "cyan")
    g.rect(18, 58, 26, 6, "blue")
    g.rect(20, 59, 22, 5, "sky")
    g.cel(30, 47, 13, 4.5, "blue", "navy")
    g.rect(25, 44, 9, 3, "skin2")
    for x in (25, 33):
        g.rect(x, 49, 1, 7, "white")
        g.p(x, 56, "lgrey")
    # brown hair under the cap at the sides, the near ear, then the face
    g.cel(31, 24, 15, 12, "dbrown", "plum", "brown")
    g.cel(44, 29, 2.5, 4, "skin1", "skin2")
    g.p(44, 29, "skin2")
    g.cel(29, 28, 13, 13, "skin1")
    # the cap's crown, its button, and the brim towards the camera, rust underneath
    g.cel(31, 15, 15, 10, "amber", "orange", "yellow")
    g.rect(30, 5, 3, 2, "orange")
    g.ell(25, 20.5, 17, 3.5, "orange")
    g.rect(15, 18, 14, 1, "amber")
    g.rect(13, 22, 26, 1, "rust")
    shade_under(g, "skin1", "skin2", 16, 42, 22)
    shade_near(g, "skin1", "skin2", 24, 31)
    adult_face(g, "dbrown")


def ada(g):
    """11 and round-faced: a big head on small shoulders, long black curls in a few simple rounded locks with
    a pink clip, caramel skin, big eyes set low, a small smile, yellow tee."""
    # the curls behind her, falling past her shoulders in a few rounded locks
    g.cel(30, 29, 20, 19, "navy", "ink", "dslate")
    g.rect(10, 29, 41, 23, "navy")
    g.rect(45, 29, 6, 23, "ink")
    for x, y, c in ((10, 36, "navy"), (10, 47, "navy"), (51, 40, "ink"), (51, 50, "ink")):
        g.ell(x, y, 2.5, 4, c)
    bust(g, "yellow", "amber", neck="brown", cx=31, cy=65, rx=21, ry=14, nx=26, nw=7)
    g.rect(26, 51, 9, 1, "amber")
    g.p(25, 50, "amber")
    g.p(35, 50, "amber")
    # the round face, then the fringe in three rounded bumps along the brow
    g.cel(30, 31, 14, 13.5, "brown")
    g.cel(30, 18, 16, 8.5, "navy", "ink", "dslate")
    for x, y, c in ((20, 23, "navy"), (28, 24, "navy"), (37, 23, "navy"), (43, 22, "ink")):
        g.ell(x, y, 4.5, 3, c)
    g.cel(41, 14, 3.5, 2.5, "pink", "mauve")
    shade_under(g, "brown", "dbrown", 16, 44, 20)
    shade_near(g, "brown", "dbrown", 27, 35)
    # big eyes with two shines each, a blush, and a small smile
    for x, w in ((20, 5), (32, 6)):
        human_eye(g, x, 30, w, 7)
    g.rect(18, 38, 3, 1, "pink")
    g.rect(35, 38, 4, 1, "pink")
    g.p(25, 40, "dbrown")
    g.rect(26, 41, 3, 1, "dbrown")
    g.p(29, 40, "dbrown")


def ben(g):
    """Bald, a shine on the crown, the chin-strap beard along his jaw and under his chin with no moustache, the
    lilac tee with its violet collar."""
    bust(g, "lilac", "violet", neck="plum")
    g.rect(22, 46, 15, 1, "violet")
    g.p(21, 45, "violet")
    g.p(37, 45, "violet")
    g.cel(44, 29, 2.5, 4, "dbrown", "plum")
    g.rect(44, 28, 1, 3, "plum")
    g.cel(30, 26, 13.5, 15.5, "dbrown", power=2.3)
    g.rect(22, 14, 4, 1, "brown")
    g.rect(21, 15, 2, 1, "brown")
    shade_near(g, "dbrown", "plum", 14, 30)
    # the beard: down both jaws and round under the chin, the upper lip bare
    g.rect(17, 30, 2, 6, "ink")
    g.rect(41, 30, 2, 8, "ink")
    g.ell(29, 39, 12, 4, "ink")
    g.rect(20, 34, 18, 3, "dbrown")
    for x, w in ((20, 3), (32, 4)):
        human_eye(g, x, 26, w, sclera=True)
        g.rect(x, 23, w, 1, "ink")
    g.p(26, 32, "plum")
    smile(g, 26, 36, teeth="cream")


def trista(g):
    """A clean dirty blonde bob to the shoulders with a side-swept fringe and a few amber streaks, round
    glasses, the green cardigan open over a white blouse, and the apple tote over her right shoulder."""
    # the bob behind her face, curling under at the shoulders
    g.cel(30, 26, 17, 16, "brown", "dbrown", "tan")
    g.rect(13, 26, 34, 15, "brown")
    g.rect(43, 26, 4, 15, "dbrown")
    g.ell(17, 41, 5, 2.5, "brown")
    g.ell(43, 41, 5, 2.5, "dbrown")
    bust(g, "dgreen", "forest", "green")
    g.rect(25, 46, 9, 18, "white")
    g.rect(33, 47, 1, 17, "lgrey")
    g.tri((21, 45), (30, 46), (25, 52), "white")
    g.tri((29, 46), (38, 45), (34, 52), "lgrey")
    for y in (53, 59):
        g.p(23, y, "amber")
    g.cel(29, 28, 12.5, 12.5, "skin1")
    # the fringe sweeping down to the left over the brow, with a few amber streaks
    g.cel(31, 16, 15, 7.5, "brown", "dbrown", "tan")
    g.tri((15, 15), (38, 18), (16, 24), "brown")
    for x, y, h in ((21, 11, 3), (27, 9, 4), (34, 10, 3)):
        g.rect(x, y, 1, h, "amber")
    shade_under(g, "skin1", "skin2", 16, 42, 18)
    shade_near(g, "skin1", "skin2", 25, 31)
    adult_face(g, "dbrown", brow_y=22)
    # round glasses: thin frames round each eye, a bridge and the near arm back to the hair
    ring(g, 21.5, 28.5, 3.6, 4.4, "dbrown")
    ring(g, 34, 28.5, 4.4, 4.4, "dbrown")
    g.rect(26, 27, 3, 1, "dbrown")
    g.rect(39, 28, 3, 1, "dbrown")
    # the canvas tote hangs off her right shoulder by a brown strap, the apple facing out
    g.rect(15, 45, 1, 6, "brown")
    g.rect(3, 50, 15, 14, "cream")
    g.rect(14, 50, 4, 14, "tan")
    g.cel(9, 57.5, 3, 3, "red", "dred")
    g.p(8, 56, "white")
    g.rect(9, 53, 2, 1, "dgreen")
    g.p(9, 54, "dbrown")


PORTRAITS = {
    "duchess": duchess,
    "nugget": nugget,
    "zippy": zippy,
    "pierre": pierre,
    "biscuit": biscuit,
    "archie": archie,
    "snowball": snowball,
    "penny": penny,
    "koda": koda,
}

WALKERS = {
    "ada": ada,
    "ben": ben,
    "casey": casey,
    "trista": trista,
}


# How much of the 64px well a dog's portrait fills, by size class, sat on the bottom edge.
PORTRAIT_SIDE = {"big": 64, "medium": 58, "small": 52}


def image(draw, side=S):
    """draw's portrait, drawn at side over S of its design, sat on the bottom edge of an S x S image."""
    if side == S:
        g = edged(Grid(S, S), "ink", close=True)
        draw(g)
        return to_image(g.outlined())
    g = edged(minis.Mini(side / S, S, S), "ink", close=True)
    draw(g)
    return to_image(dogs.padded(g.outlined(), S))


def portraits():
    """{key: (draw, side)} for every dog's portrait, then every walker's."""
    return {**{f"portrait-dog-{n}": (d, PORTRAIT_SIDE[dogs.DOG_CLASS[n]]) for n, d in PORTRAITS.items()},
            **{f"portrait-walker-{n}": (d, S) for n, d in WALKERS.items()}}


def faces():
    """The happy face of every dog, then every walker, in portraits() order."""
    for name in PORTRAITS:
        yield dogs.DOGS[name][1]("happy")
    for name in WALKERS:
        yield owners.WALKERS[f"walker-{name}"]("happy")


def preview(out, scale=4):
    """One row per dog, then per walker: its happy face at 2x, then the portrait on the dog pick's tile colours
    and the detail card well's sky."""
    grounds = [(228, 166, 114), (234, 212, 170), (254, 231, 97), (58, 68, 102), (0, 153, 219)]
    cell = S + 4
    rows = len(PORTRAITS) + len(WALKERS)
    sheet = Image.new("RGB", (cell * (1 + len(grounds)) * scale, cell * rows * scale), (24, 20, 37))
    for i, (face_grid, (draw, side)) in enumerate(zip(faces(), portraits().values())):
        face = to_image(face_grid.outlined()).resize((S, S), Image.NEAREST)
        im = image(draw, side)
        for j, tile_im in enumerate([face] + [im] * len(grounds)):
            tile = Image.new("RGB", (S, S), grounds[max(0, j - 1)])
            tile.paste(tile_im, (0, 0), tile_im)
            sheet.paste(tile.resize((S * scale, S * scale), Image.NEAREST), (j * cell * scale, i * cell * scale))
    sheet.save(out)


def build():
    os.makedirs("art/portraits", exist_ok=True)
    os.makedirs("public/art/images", exist_ok=True)
    keys = portraits()
    for key, (draw, side) in keys.items():
        png = f"public/art/images/{key}.png"
        image(draw, side).save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/portraits/{key}.aseprite"], check=True)
    print("built", ", ".join(keys))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
