#!/usr/bin/env python3
"""Compose the help screen's page illustrations from the exported sprites.

help-<page>: 344x236 images in Endesga 32, one per page of the in-game "How to
walk" screen (see public/art/mocks/help-screen.html, which animates the same
scenes). Built from public/art/sprites/ and the road strips and card
illustrations in public/art/images/, so build those first (roads.py, cards.py).
Names and numbers come from src/data/ at build time, so the pages follow the data.

Usage:
  help.py preview OUT.png   all six images side by side, scaled up
  help.py build             write art/help/*.aseprite and public/art/images/*.png,
                            and list them in the manifest's "images"

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import json
import os
import re
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from pixel import DARKER, K  # noqa: E402

W, H = 344, 236
HEX = {k: tuple(int(v[i:i + 2], 16) for i in (0, 2, 4)) for k, v in K.items()}


def rgb(c):
    return HEX[c] if c in HEX else tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


class Canvas:
    def __init__(self, w=W, h=H):
        self.img = Image.new("RGB", (w, h), rgb("ink"))

    def fill(self, x, y, w, h, c):
        x0, y0, x1, y1 = max(0, int(x)), max(0, int(y)), min(self.img.width, int(x + w)), min(self.img.height, int(y + h))
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

    def dim(self, x, y, w, h):
        """Darken a region two ramp steps, staying on the palette."""
        px = self.img.load()
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                r, g, b = px[xx, yy]
                key = "%02x%02x%02x" % (r, g, b)
                if key in DARKER:
                    px[xx, yy] = rgb(DARKER[DARKER[key]])


# ---------- pixel font (3x5, with a 5-wide heart), as in the mocks ----------

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
          "%": "101001010100101"})
HEART5 = "0101011111111110111000100"


def glyph(ch):
    return (5, HEART5) if ch == "♥" else (3, G.get(ch))


def text_w(s, sc=1):
    return max(0, sum((glyph(ch)[0] + 1) * sc for ch in s) - sc)


def text(cv, s, x, y, col, sc=1, acc=None):
    acc = acc or {}
    cx = x
    for ch in s:
        w, bits = glyph(ch)
        if bits:
            for r in range(5):
                for k in range(w):
                    if bits[r * w + k] == "1":
                        cv.fill(cx + k * sc, y + r * sc, sc, sc, acc.get(ch, col))
        cx += (w + 1) * sc


def text_c(cv, s, mid, y, col, sc=1, acc=None):
    text(cv, s, round(mid - text_w(s, sc) / 2), y, col, sc, acc)


def wrap(s, width, sc=1):
    """Split s into lines no wider than width, breaking between words."""
    lines = [""]
    for word in s.split():
        trial = f"{lines[-1]} {word}".strip()
        if lines[-1] and text_w(trial, sc) > width:
            lines.append(word)
        else:
            lines[-1] = trial
    return lines


# ---------- game data, read from src/data/ at build time ----------

def data(name):
    return open(f"src/data/{name}.ts").read()


def ts_block(src, key):
    """The source between the braces of the first `key: {` in src: enough parsing for the plain
    object literals in src/data/, so names and numbers are never copied into this file."""
    i = re.search(rf"\b{key}: \{{", src).end()
    depth = 1
    for j in range(i, len(src)):
        depth += {"{": 1, "}": -1}.get(src[j], 0)
        if depth == 0:
            return src[i:j]
    raise ValueError(f"{key} is not closed")


def ts_value(src, key):
    """The first `key: "text"` or `key: number` in src."""
    v = re.search(rf"(?<![\w.]){key}: (\"[^\"]*\"|-?[\d.]+)", src).group(1)
    return v.strip('"') if v.startswith('"') else float(v)


def tuning(*path):
    src = data("tuning")
    for key in path[:-1]:
        src = ts_block(src, key)
    return ts_value(src, path[-1])


def dollars(v):
    """As the game's formatDollars: "$20", or "$0.60" with cents."""
    v = abs(v)
    return f"${v:g}" if v == int(v) else f"${v:.2f}"


def dog(key):
    """A dog in dogs.ts: (name, owner name, max hearts, starting hearts)."""
    block = ts_block(data("dogs"), key)
    owner = ts_block(block, "owner")
    max_h = tuning("hearts", "maxBySize", ts_value(block, "size"))
    start = tuning("hearts", "startByTemperament", ts_value(owner, "temperament"))
    return ts_value(block, "name").upper(), ts_value(owner, "name").upper(), int(max_h), int(start)


MONEY = r'amount: "(\w+)",\s*change: "(gain|lose)"'
HEARTS = r'amount: (-?\d+),\s*kind: "hearts"'
DEBUFF = r'debuff: "(\w+)"'


def card_options(encounter):
    """An encounter's card options in encounters.ts, left to right: (name, art key, effect text,
    cost for one dog in dollars). The effect text follows the game's effectText, in capitals."""
    out = []
    for chunk in ts_block(data("encounters"), encounter).split("art: ")[1:]:
        effects, cost = [], 0
        for m in sorted((m for p in (MONEY, HEARTS, DEBUFF) for m in re.finditer(p, chunk)), key=lambda m: m.start()):
            if m.re.pattern == MONEY:
                v = tuning("money", m.group(1))
                cost += v if m.group(2) == "lose" else 0
                per_dog = " PER DOG" if "perDog" in chunk[m.end():].split("}")[0] else ""
                effects.append(("-" if m.group(2) == "lose" else "+") + dollars(v) + per_dog)
            elif m.re.pattern == HEARTS:
                n = int(m.group(1))
                effects.append(f"{'-' if n < 0 else '+'}{abs(n)}♥ EACH")
            else:
                effects.append(ts_value(ts_block(data("debuffs"), m.group(1)), "name").upper())
        out.append((ts_value(chunk, "name").upper(), chunk.split('"')[1], ", ".join(effects), cost))
    return out


def world():
    """The route in world.ts: its name and {zone id: (name, road shadow, leash colour)}, in order."""
    zones = re.findall(r'id: "(\w+)",\s*leashColor: "#(\w+)",\s*name: "([^"]+)",\s*roadColor: "#\w+",\s*'
                       r'roadShadowColor: "#(\w+)"', data("world"))
    return ts_value(data("world"), "name").upper(), {z: (name, shadow, leash) for z, leash, name, shadow in zones}


# ---------- road strips: the exported road-<zone> images (roads.py) ----------

WORLD, ZONES = world()
TILES = {z: Image.open(f"public/art/images/road-{name.lower().replace(' ', '-')}.png").convert("RGB")
         for z, (name, _, _) in ZONES.items()}


# ---------- exported sprites ----------

SHEETS = {}


def frame(key, tag, i=0):
    if key not in SHEETS:
        img = Image.open(f"public/art/sprites/{key}.png").convert("RGBA")
        meta = json.load(open(f"public/art/sprites/{key}.json"))
        SHEETS[key] = (img, [f["frame"] for f in meta["frames"].values()], {t["name"]: t for t in meta["meta"]["frameTags"]})
    img, frames, tags = SHEETS[key]
    t = tags[tag]
    f = frames[t["from"] + i % (t["to"] - t["from"] + 1)]
    return img.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))


class Scene(Canvas):
    shade, leash_col = "navy", "dred"

    def road(self, zone):
        _, self.shade, self.leash_col = ZONES[zone]
        for y in range(0, H, 64):
            self.img.paste(TILES[zone], (32, y))
        self.fill(0, 0, 32, H, "green"); self.fill(312, 0, 32, H, "green")
        for i in range(24):
            self.fill(4 + (i * 13) % 24, (i * 37) % H, 1, 2, "dgreen")
            self.fill(316 + (i * 7) % 24, (i * 23) % H, 1, 2, "dgreen")

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

    def pack(self, cx, base, dogs=("dog-koda", "dog-biscuit", "dog-duchess"), lead_tag="walk"):
        spots = [(0, -40), (-13, -28), (13, -26)]
        items = [(k, dx, base + dy, lead_tag if i == 0 else "walk") for i, (k, (dx, dy)) in enumerate(zip(dogs, spots))]
        items.append(("walker-casey", 0, base, "walk"))
        for k, dx, foot, tag in sorted(items, key=lambda it: it[2]):
            self.feet(k, tag, cx + dx, foot)
        for k, dx, foot, _ in items:
            if k != "walker-casey":
                self.line(cx - 9 if dx < 0 else cx + 8, base - 14, cx + dx, foot - 15, self.leash_col)

    def chevron(self, cx, cy, d, col):
        for i in range(8):
            self.fill(cx + d * (i - 4), cy - 8 + i, 3, 1, col)
            self.fill(cx + d * (i - 4), cy + 8 - i, 3, 1, col)

    def bubble(self, x, y, w, lines, col="plum"):
        h = len(lines) * 8 + 6
        self.fill(x + 1, y, w - 2, h, "white"); self.fill(x, y + 1, w, h - 2, "white"); self.fill(x + 1, y + h, w - 2, 1, "lgrey")
        for i, ln in enumerate(lines):
            text_c(self, ln, x + w / 2, y + 4 + i * 8, col, 1, {"♥": "red", "$": "forest"})

    def heart(self, x, y, col, hi=None):
        for j, r in enumerate([".11.11.", "1111111", "1111111", ".11111.", "..111..", "...1..."]):
            for i, c in enumerate(r):
                if c == "1":
                    self.fill(x + i, y + j, 1, 1, col)
        if hi:
            self.fill(x + 1, y + 1, 1, 1, hi)

    def card(self, x, y, label, art, effect, cost):
        """A choice card as CardScene draws it: the exported encounter card-frame with its white band
        label, the option's illustration, the effect text in the body (2x where it fits) and the
        cost on the card-cost plaque."""
        self.paste(frame("card-frame", "encounter"), x, y)
        self.paste(Image.open(f"public/art/images/{art}.png").convert("RGBA"), x + 5, y + 16)
        self.paste(Image.open("public/art/images/card-cost.png").convert("RGBA"), x + 6, y + 121)
        text_c(self, label, x + 42, y + 5, "white")
        sc = 2 if len(wrap(effect, 71, 2)) * 12 <= 42 else 1
        for i, ln in enumerate(wrap(effect, 71, sc)):
            text_c(self, ln, x + 42, y + 78 + i * 6 * sc, "plum", sc, {"♥": "dred"})
        text_c(self, cost, x + 42, y + 125, "cream")


def lane(n):
    return 32 + n * 56 + 28


def lanes():
    c = Scene()
    c.road("street")
    c.pack(lane(2), H - 8)
    c.chevron(60, 70, -1, "white"); c.chevron(284, 70, 1, "white")
    text_c(c, "TAP", 60, 86, "white"); text_c(c, "TAP", 284, 86, "white")
    return c


def pickups():
    c = Scene()
    c.road("park")
    for ln, y, key in ((2, 20, "tip"), (2, 50, "tip"), (2, 80, "tip"), (1, 140, "treat"), (3, 110, "treat")):
        c.feet(key, "idle", lane(ln), y + 16)
    c.pack(lane(2), H - 8, ("dog-biscuit",))
    # one tip for a solo dog, in whole cents as the game counts it
    solo = round(tuning("money", "tip") * tuning("multipliers", "tipByPackSize", "1") * 100) / 100
    c.bubble(200, 168, 70, ["+" + dollars(solo)])
    c.fill(6, 6, 74, 22, "plum"); c.fill(7, 7, 72, 20, "cream")
    c.paste(frame("treat", "idle"), 9, 9)
    text(c, f"TREATS 2/{tuning('counts', 'treatCarryMax'):g}", 28, 14, "plum")
    return c


def cards():
    c = Scene()
    c.road("street")
    c.feet("skunk", "idle", lane(2), 120)
    c.pack(lane(2), H - 8, ("dog-koda",), "react")
    c.dim(0, 0, W, H)
    text_c(c, ts_value(ts_block(data("encounters"), "skunk"), "name").upper() + "!", 172, 8, "white", 2)
    # the skunk card as one dog would see it: each cost is per dog, and a hearts-only option is free
    opts = card_options("skunk")
    x0 = (W - len(opts) * 89 + 6) // 2
    for i, (name, art, effect, cost) in enumerate(opts):
        c.card(x0 + i * 89, 28, name, art, effect, "-" + dollars(cost) if cost else "FREE")
    return c


def owners():
    c = Scene()
    c.fill(0, 0, W, H, "dbrown")
    name, owner, max_h, start = dog("koda")
    sx, sy = 20, 20
    c.fill(sx, sy, 140, 96, "plum"); c.fill(sx + 1, sy + 1, 138, 94, "cream"); c.fill(sx + 4, sy + 4, 66, 34, "tan")
    c.paste(frame("face-owner-koda", "happy"), sx + 5, sy + 5)
    c.paste(frame("face-dog-koda", "happy"), sx + 37, sy + 5)
    text(c, name, sx + 76, sy + 8, "plum"); text(c, owner, sx + 76, sy + 18, "dbrown")
    for j in range(max_h):
        c.paste(frame("ui-heart", "full" if j < start else "empty"), sx + 6 + j * 9, sy + 46)
    text(c, f"{start}♥ OF {max_h}", sx + 6, sy + 60, "plum", 1, {"♥": "dred"})
    c.bubble(sx + 6, sy + 72, 128, [f"TAP TO GIVE A TREAT: +{tuning('hearts', 'treat'):g}♥"])
    name, _, max_h, _ = dog("nugget")
    fx, fy = 186, 20
    c.fill(fx, fy, 140, 96, "plum"); c.fill(fx + 1, fy + 1, 138, 94, "tan"); c.fill(fx + 4, fy + 4, 34, 34, "brown")
    c.paste(frame("face-owner-nugget", "fired"), fx + 5, fy + 5)
    c.bubble(fx + 42, fy + 8, 92, ["YOU'RE FIRED!"], "dred")
    for j in range(max_h):
        c.paste(frame("ui-heart", "empty"), fx + 6 + j * 9, fy + 46)
    text(c, f"0♥: {name} GOES HOME", fx + 6, fy + 60, "plum", 1, {"♥": "dred"})
    text(c, "FEES TAKEN BACK", fx + 6, fy + 72, "plum")
    for i, m in enumerate(("happy", "neutral", "upset")):
        x = 92 + i * 56
        c.fill(x - 2, 138, 36, 36, "tan")
        c.paste(frame("face-owner-duchess", m), x - 1, 139)
        text_c(c, m.upper(), x + 16, 180, "cream")
    text_c(c, "WATCH THEIR FACES", 172, 206, "amber")
    return c


def pulls():
    c = Scene()
    c.road("shops")
    c.feet("squirrel", "idle", lane(3), 70)
    cx = lane(2)
    c.pack(cx, H - 8, ("dog-koda", "dog-duchess"), "tell")
    c.paste(frame("fx-bark", "pop", 1), cx + 10, H - 92)
    for x in range(cx + 20, lane(3) - 8, 4):
        c.fill(x, 150, 2, 2, "amber")
    c.chevron(lane(3) - 6, 151, 1, "amber")
    text_c(c, "LEAN AND BARK", 172, 12, "plum")
    return c


def zones():
    c = Scene()
    c.fill(0, 0, W, H, "dbrown")
    text_c(c, WORLD, 172, 8, "amber", 2)
    for i, (z, (name, _, _)) in enumerate(ZONES.items()):
        x, y = 8 + i * 84, 44
        tile = TILES[z].crop((100, 0, 176, 64))
        c.img.paste(tile, (x, y)); c.img.paste(tile, (x, y + 64))
        c.fill(x, y + 120, 76, 12, "dbrown")
        c.fill(x, y, 76, 1, "plum"); c.fill(x, y + 119, 76, 1, "plum")
        text_c(c, name.upper(), x + 38, y - 12, "cream")
        # the zone number on a plum chip, so it holds contrast on every road (white on plum, 13.6:1)
        c.fill(x + 31, y + 46, 15, 23, "plum"); c.fill(x + 30, y + 47, 17, 21, "plum")
        text_c(c, str(i + 1), x + 38, y + 50, "white", 3)
        c.paste(frame("tip", "idle"), x + 30, y + 124)
        text_c(c, "+FEES", x + 38, y + 144, "amber")
    text_c(c, "UPGRADE CARD BETWEEN ZONES", 172, 214, "yellow")
    return c


PAGES = {"lanes": lanes, "pickups": pickups, "cards": cards, "owners": owners, "pulls": pulls, "zones": zones}


def build():
    os.makedirs("art/help", exist_ok=True)
    os.makedirs("public/art/images", exist_ok=True)
    for name, draw in PAGES.items():
        key = f"help-{name}"
        png = f"public/art/images/{key}.png"
        draw().img.save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/help/{key}.aseprite"], check=True)
    path = "public/art/manifest.json"
    manifest = json.load(open(path))
    entries = {i["key"]: i for i in manifest.get("images", [])}
    for name in PAGES:
        entries[f"help-{name}"] = {"key": f"help-{name}", "png": f"images/help-{name}.png"}
    manifest["images"] = sorted(entries.values(), key=lambda i: i["key"])
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print("built", ", ".join(f"help-{n}" for n in PAGES))


def preview(out, scale=3):
    imgs = [draw().img for draw in PAGES.values()]
    sheet = Image.new("RGB", ((W + 8) * 3 * scale, (H + 8) * 2 * scale), rgb("ink"))
    for i, im in enumerate(imgs):
        sheet.paste(im.resize((W * scale, H * scale), Image.NEAREST), ((i % 3) * (W + 8) * scale, (i // 3) * (H + 8) * scale))
    sheet.save(out)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
