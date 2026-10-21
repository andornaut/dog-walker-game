"""Shared tools for the pictures composed from exported art (card illustrations, screens,
backdrops, the share card): an RGB canvas on the palette, the 3x5 pixel font, the game's data
and layout from its export in shared/export/, the zones and their road-<zone> strips (roads.py),
the pack's hands and collars, and the exported sprites and images in public/art/. Run from the
repository root. It has no commands.
"""

import json
import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from pixel import HEART, K, Grid, to_image  # noqa: E402
from ui import chrome  # noqa: E402

HEX = {k: tuple(int(v[i:i + 2], 16) for i in (0, 2, 4)) for k, v in K.items()}


def rgb(c):
    return HEX[c] if c in HEX else tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


class Canvas:
    def __init__(self, w, h):
        self.img = Image.new("RGB", (w, h), rgb("ink"))

    def fill(self, x, y, w, h, c):
        x0, y0 = max(0, int(x)), max(0, int(y))
        x1, y1 = min(self.img.width, int(x + w)), min(self.img.height, int(y + h))
        if x1 > x0 and y1 > y0:
            self.img.paste(rgb(c), (x0, y0, x1, y1))

    def paste(self, sprite, x, y, flip=False):
        if flip:
            sprite = sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        self.img.paste(sprite, (int(round(x)), int(round(y))), sprite)

    def line(self, x0, y0, x1, y1, c):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(int(n) + 1):
            self.fill(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), 1, 1, c)


# ---------- pixel font (3x5) ----------

G = dict(
    A="010101111101101", B="110101110101110", C="011100100100011", D="110101101101110", E="111100110100111",
    F="111100110100100", G="011100101101011", H="101101111101101", I="111010010010111", J="001001001101010",
    K="101101110101101", L="100100100100111", M="101111111101101", N="110101101101101", O="010101101101010",
    P="110101110100100", Q="010101101110011", R="110101110101101", S="011100010001110", T="111010010010010",
    U="101101101101111", V="101101101101010", W="101101111111101", X="101101010101101", Y="101101010010010",
    Z="111001010100111",
)
G.update({"0": "111101101101111", "1": "010110010010111", "2": "110001010100111", "3": "110001010001110",
          "4": "101101111001001", "5": "111100110001110", "6": "011100111101111", "7": "111001010010010",
          "8": "111101111101111", "9": "111101111001110", "$": "011110111011110", "+": "000010111010000",
          "-": "000000111000000", "/": "001001010100100", ":": "000010000010000", ".": "000000000000010",
          "!": "010010010000010", "?": "110001010000010", "'": "010010000000000", ",": "000000000010100",
          "%": "101001010100101", "×": "000101010101000"})


def text_w(s, sc=1):
    """The width of s in the 3x5 font at scale sc: 3 columns a glyph, 1 between."""
    return max(0, 4 * sc * len(s) - sc)


def text(cv, s, x, y, col, sc=1, acc=None):
    acc = acc or {}
    cx = x
    for ch in s:
        bits = G.get(ch)
        if bits:
            for r in range(5):
                for k in range(3):
                    if bits[r * 3 + k] == "1":
                        cv.fill(cx + k * sc, y + r * sc, sc, sc, acc.get(ch, col))
        cx += 4 * sc


def text_c(cv, s, mid, y, col, sc=1, acc=None):
    text(cv, s, round(mid - text_w(s, sc) / 2), y, col, sc, acc)


# ---------- game data and layout, from the game's export in shared/export/ ----------

def read_json(path):
    with open(path) as f:
        return json.load(f)


GAME = read_json("shared/export/game-data.json")
LAYOUT = read_json("shared/export/layout.json")
# {zone id: zone} in the world's order: each zone's name, art key, road shadow and leash colours.
ZONES = {z["id"]: dict(name=z["name"], art=z["art"], shadow=z["roadShadowColor"].lstrip("#"),
                       leash=z["leashColor"].lstrip("#"))
         for z in GAME["zones"]}
# Each zone's road strip: the exported road-<zone> image (roads.py).
TILES = {z: Image.open(f"public/art/images/road-{zone['art']}.png").convert("RGB") for z, zone in ZONES.items()}
# The pack, as src/layout/packFormation.ts: the walker's hands (left dx, right dx, height above the
# feet) and each dog's collar height above its feet (COLLAR, the highest, for a dog with none listed).
PACK = LAYOUT["pack"]
HANDS = (PACK["walkerHands"]["leftDx"], PACK["walkerHands"]["rightDx"], PACK["walkerHands"]["heightAboveFeet"])
COLLARS = PACK["collarHeights"]
COLLAR = max(COLLARS.values())
# Each sprite's anchor (feetY, opaqueWidth) from the manifest, empty for one the game does not stand on the ground.
ANCHORS = {s["key"]: s.get("anchor", {}) for s in read_json("public/art/manifest.json")["sprites"]}


def collar(key):
    """A dog's collar height above its feet, at full size."""
    return COLLARS.get(key.removeprefix("dog-"), COLLAR)


def side_dx(key, side):
    """A dog's dx off the lane centre on side -1, 0 or 1: half the lane less half its opaque width."""
    return side * math.floor(PACK["laneHalfWidth"] - ANCHORS[key]["opaqueWidth"] / 2)


# ---------- exported sprites ----------

SHEETS = {}


def sheet(key):
    """An exported sprite: its sheet, each frame's rectangle and {tag name: tag}."""
    if key not in SHEETS:
        img = Image.open(f"public/art/sprites/{key}.png").convert("RGBA")
        with open(f"public/art/sprites/{key}.json") as f:
            meta = json.load(f)
        SHEETS[key] = (img, [fr["frame"] for fr in meta["frames"].values()],
                       {t["name"]: t for t in meta["meta"]["frameTags"]})
    return SHEETS[key]


def frame(key, tag, i=0):
    img, frames, tags = sheet(key)
    t = tags[tag]
    f = frames[t["from"] + i % (t["to"] - t["from"] + 1)]
    return img.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))


def image(key):
    return Image.open(f"public/art/images/{key}.png").convert("RGBA")


class Scene(Canvas):
    """A canvas with sprites standing on their shadows, leashes in the zone's colour, callouts and hearts."""
    shade, leash_col = "navy", "dred"

    def shadow(self, cx, foot, w):
        rx = max(3, w / 2 - 2)
        for y in range(-3, 4):
            for x in range(int(-rx - 1), int(rx + 2)):
                dx, dy = (x + 0.5) / rx, (y + 0.5) / 2.5
                if dx * dx + dy * dy <= 1:
                    self.fill(int(cx + x), int(foot - 1 + y), 1, 1, self.shade)

    def feet(self, key, tag, cx, foot, i=0, flip=False, shadow=True):
        s = frame(key, tag, i)
        if shadow:
            self.shadow(cx, foot, s.width)
        self.paste(s, cx - s.width / 2, foot - s.height, flip)

    def bubble(self, x, y, w, lines, col="plum"):
        """A callout in ui.py's chrome, w wide, one 8px row per line: plum text on cream (9.42:1),
        $ in forest (5.39:1)."""
        h = len(lines) * 8 + 7
        self.paste(to_image(chrome(Grid(w, h), 0, 0, w, h).px), x, y)
        for i, ln in enumerate(lines):
            text_c(self, ln, x + w / 2, y + 4 + i * 8, col, 1, {"$": "forest"})

    def heart(self, x, y, col, hi=None):
        for j, r in enumerate(HEART):
            for i, c in enumerate(r):
                if c == "1":
                    self.fill(x + i, y + j, 1, 1, col)
        if hi:
            self.fill(x + 1, y + 1, 1, 1, hi)
