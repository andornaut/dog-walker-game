#!/usr/bin/env python3
"""Draw the dog portraits for the dog pick and the shop.

portrait-dog-<name>: 64x64 images in Endesga 32 with an ink outer line
closed along the bottom edge, cel shaded, on transparency. Each dog sits in a three-quarter front view turned toward the
viewer's left (into the top-left light), head and shoulders with its front
paws at the bottom edge. Coats, markings and accessories match the dog's
road sprite and face in dogs.py.

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
from pixel import DARKER, K, Grid, edged  # noqa: E402

S = 64


def dk(c, n=2):
    c = K.get(c, c)
    for _ in range(n):
        c = DARKER[c]
    return c


def lined(g, cx, cy, rx, ry, c, sh=None, li=None):
    """An ellipse ringed in its colour two ramp steps darker, for a shape drawn over one of the same coat."""
    g.ell(cx, cy, rx + 1, ry + 1, dk(c))
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
        g.p(x + w - 2, y + 4, "blue")
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
    g.ell(cx, cy, rx, ry, dk(c))
    for x, y in lumps:
        g.ell(x, y, r + 1, r + 1, dk(c))
    g.cel(cx, cy, rx - 1, ry - 1, c, sh, li)
    for x, y in lumps:
        g.cel(x, y, r, r, c, sh if y > cy + ry * 0.5 else None, li)
    g.ell(cx, cy, rx - r, ry - r, c)


def stripe(g, y, c, over):
    """Recolour row y wherever it shows one of the colours in over, so knit stripes stay inside a garment."""
    over = {K.get(o, o) for o in over}
    for x in range(S):
        if g.px[y][x] in over:
            g.p(x, y, c)


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
    """Duchess's pink bow, or Pierre's mauve show ribbon tied in purple: the knot and folds take the second colour."""
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


# ---------- Pierre: standard poodle, medium, apricot, show-clip pom-poms ----------

def pierre(g):
    # shaved legs with pom-pom bracelets, a curly mane over the chest
    g.cel(48, 56, 9, 7, "skin1", "brown", "cream")
    for x in (24, 35):
        g.rect(x, 50, 4, 10, "skin2")
        g.rect(x + 3, 50, 1, 10, "brown")
        pom(g, x + 2, 60.5, 4.5, 3, n=5)
    pom(g, 31, 48, 14, 9, n=10)
    # long fluffy ears hanging from under the topknot
    pom(g, 16, 35, 6, 11, n=6)
    pom(g, 45, 35, 6, 11, n=6)
    # the smooth shaved face, ringed a step darker than the curls and set off from them by the shadow it
    # casts down and right, under a smaller topknot whose scalloped edge overlaps the brow
    g.ell(31.5, 31.5, 11, 10.5, "brown")
    g.ell(29.5, 27, 11.5, 10.5, "dbrown")
    g.cel(29.5, 27, 10.5, 9.5, "skin1", "skin2", "cream")
    pom(g, 30, 12, 12, 8, n=9)
    bow(g, 30, 5, colours=("mauve", "purple"))
    # shaved muzzle, long and narrow
    lined(g, 23, 32, 7, 4.5, "cream", "tan")
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
    coat, (blot, _), (ear, tip) = dogs.COAT, dogs.BLOT, dogs.EAR
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


# ---------- Snowball: Samoyed, big, fluffy white, collar with a bell ----------

def snowball(g):
    g.cel(46, 52, 13, 11, "white", "lgrey")
    g.cel(31, 50, 16, 13, "white", "lgrey")
    legs(g, (22, 33), 52, "white", "lgrey", w=6)
    # fluffy cheek ruff, tufted at the edges
    g.cel(15, 34, 7, 7, "white", "lgrey")
    g.cel(46, 34, 7, 7, "white", "lgrey")
    g.tri((8, 32), (10, 38), (5, 37), "white")
    g.tri((53, 32), (51, 38), (56, 37), "lgrey")
    g.tri((11, 39), (15, 41), (9, 43), "white")
    g.rect(18, 43, 26, 2, "sky")
    g.rect(18, 44, 26, 1, "blue")
    g.cel(31, 47.5, 3.5, 3.5, "amber", "orange", "yellow")
    g.rect(30, 48, 3, 1, "orange")
    # upright ears with pink insides
    g.tri((13, 19), (15, 3), (25, 12), "white")
    g.tri((16, 15), (16, 7), (22, 12), "pink")
    g.tri((45, 18), (44, 2), (35, 11), "lgrey")
    g.tri((43, 14), (43, 6), (38, 11), "pink")
    g.cel(30, 26, 18, 15, "white", "lgrey")
    g.cel(26, 33, 9, 6, "white", "lgrey")
    eyes(g, 18, 33, 21)
    nose(g, 21, 28)


# ---------- Penny: golden retriever with a Labrador build, big, golden coat, otter tail, blue collar ----------

def penny(g):
    base, shade, light = dogs.GOLD
    # the haunch, and a thick otter tail curled forward round it along the ground, tapering to a blunt tip
    g.cel(46, 53, 13, 10, base, shade, light)
    dogs.inlay(g, dk(base), lambda t: (t.cel(52, 59.5, 10, 3.5, base, shade, light),
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
    dogs.inlay(g, dk(shade), lambda t: (t.tri((11, 16), (21, 13), (15, 37), shade),
                                        t.tri((11, 16), (10, 33), (15, 37), shade)))
    dogs.inlay(g, dk(shade), lambda t: (t.tri((39, 13), (49, 16), (47, 38), shade),
                                        t.tri((49, 16), (51, 34), (47, 38), shade)))
    # a square muzzle, a shade lighter than the coat, set off from the brow by a clear stop
    dogs.inlay(g, dk(light), lambda t: t.cel(25, 34, 9, 6.5, light, base, power=3.2))
    eyes(g, 18, 33, 21)
    nose(g, 21, 29)


# ---------- Koda: husky, big, grey and white, blue eyes, orange harness ----------

def koda(g):
    g.cel(46, 52, 13, 11, "slate", "dslate", "grey")
    g.cel(31, 51, 15, 13, "lgrey", "grey", "white")
    legs(g, (22, 33), 53, "lgrey", "grey", w=6)
    # harness: a strap across the chest and one down the middle
    g.rect(16, 43, 32, 3, "orange")
    g.rect(16, 45, 32, 1, "rust")
    g.rect(28, 43, 4, 10, "orange")
    g.rect(31, 43, 1, 10, "rust")
    g.rect(28, 47, 4, 2, "slate")
    # upright ears with pink insides
    g.tri((12, 20), (14, 3), (25, 12), "slate")
    g.tri((15, 16), (15, 7), (22, 12), "pink")
    g.tri((46, 19), (45, 2), (35, 11), "slate")
    g.tri((44, 15), (44, 6), (38, 11), "pink")
    g.cel(30, 26, 18, 15, "slate", "dslate", "grey")
    # white mask: brows, cheeks and muzzle
    g.cel(27, 33, 13, 8, "lgrey", "grey", "white")
    g.rect(27, 13, 3, 12, "lgrey")
    g.rect(17, 19, 5, 2, "white")
    g.rect(33, 19, 6, 2, "white")
    eyes(g, 17, 33, 21, iris="sky")
    nose(g, 21, 29)


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


def to_image(px):
    im = Image.new("RGBA", (len(px[0]), len(px)), (0, 0, 0, 0))
    for y, row in enumerate(px):
        for x, c in enumerate(row):
            if c:
                im.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,))
    return im


def image(draw):
    g = edged(Grid(S, S), "ink", close=True)
    draw(g)
    return to_image(g.outlined())


def preview(out, scale=4):
    """One row per dog: its happy face at 2x, then the portrait on the dog pick's tile colours."""
    grounds = [(228, 166, 114), (234, 212, 170), (254, 231, 97), (58, 68, 102)]
    cell = S + 4
    sheet = Image.new("RGB", (cell * (1 + len(grounds)) * scale, cell * len(PORTRAITS) * scale), (24, 20, 37))
    for i, (name, draw) in enumerate(PORTRAITS.items()):
        face = to_image(dogs.DOGS[name][1]("happy").outlined()).resize((S, S), Image.NEAREST)
        im = image(draw)
        for j, tile_im in enumerate([face] + [im] * len(grounds)):
            tile = Image.new("RGB", (S, S), grounds[max(0, j - 1)])
            tile.paste(tile_im, (0, 0), tile_im)
            sheet.paste(tile.resize((S * scale, S * scale), Image.NEAREST), (j * cell * scale, i * cell * scale))
    sheet.save(out)


def build():
    os.makedirs("art/portraits", exist_ok=True)
    os.makedirs("public/art/images", exist_ok=True)
    for name, draw in PORTRAITS.items():
        key = f"portrait-dog-{name}"
        png = f"public/art/images/{key}.png"
        image(draw).save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/portraits/{key}.aseprite"], check=True)
    print("built", ", ".join(f"portrait-dog-{n}" for n in PORTRAITS))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
