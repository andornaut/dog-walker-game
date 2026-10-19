#!/usr/bin/env python3
"""Compose the help screen's page illustrations from the exported sprites.

help-<page>: 344x236 images in Endesga 32, one per page of the in-game "How to
walk" screen (see public/art/mocks/help-screen.html, which animates the same
scenes). Built from public/art/sprites/, so build the sprites first.

Usage:
  help.py preview OUT.png   all six images side by side, scaled up
  help.py build             write art/help/*.aseprite and public/art/images/*.png,
                            and list them in the manifest's "images"

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import json
import os
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


# ---------- road tiles (280x64), as in the mocks ----------

ZONES = {"street": "dslate", "park": "tan", "shops": "lgrey", "home": "skin2"}
NAMES = {"street": "WOOF WAY", "park": "BARK PARK", "shops": "SNIFF STREET SHOPS", "home": "THE LONG WAY HOME"}


def road_tile(zone):
    cv = Canvas(280, 64)
    s = (len(zone) * 97 + 13) & 0xFFFFFFFF

    def r():
        nonlocal s
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
        return s / 4294967296

    f = cv.fill

    def speck(n, col):
        for _ in range(n):
            f(int(r() * 280), int(r() * 64), 1, 1, col)

    lanes = [k * 56 - 1 for k in range(1, 5)]
    if zone == "street":
        f(0, 0, 280, 64, "dslate"); speck(110, "slate"); speck(70, "navy")
        f(0, 0, 3, 64, "grey"); f(277, 0, 3, 64, "grey")
        for y in range(0, 64, 16):
            f(0, y, 3, 1, "slate"); f(277, y, 3, 1, "slate")
        for x in lanes:
            f(x, 8, 2, 12, "lgrey"); f(x, 40, 2, 12, "lgrey")
    elif zone == "park":
        f(0, 0, 280, 64, "tan"); speck(90, "brown"); speck(40, "cream")
        f(0, 0, 7, 64, "green"); f(273, 0, 7, 64, "green")
        for y in range(2, 64, 6):
            d = 0 if y % 4 else 1
            f(5 + d, y, 1, 2, "dgreen"); f(2, y + 3, 1, 2, "dgreen"); f(274 - d, y, 1, 2, "dgreen"); f(277, y + 3, 1, 2, "dgreen")
        for x in lanes:
            for y in range(4, 64, 16):
                f(x, y, 2, 6, "brown")
    elif zone == "shops":
        f(0, 0, 280, 64, "lgrey"); speck(40, "white")
        for x in range(27, 280, 28):
            f(x, 0, 1, 64, "grey")
        f(0, 0, 280, 1, "grey"); f(0, 32, 280, 1, "grey")
        for x in lanes:
            f(x, 0, 2, 64, "slate")
    else:
        f(0, 0, 280, 64, "skin2")
        for row in range(8):
            y, off = row * 8, 7 if row % 2 else 0
            f(0, y + 7, 280, 1, "brown")
            for x in range(off, 280 + 14, 14):
                f(x - 1, y, 1, 7, "brown")
                if r() < 0.3:
                    f(x, y, 13, 1, "skin1")
        for x in lanes:
            f(x, 6, 2, 10, "cream"); f(x, 38, 2, 10, "cream")
    return cv.img


TILES = {z: road_tile(z) for z in ZONES}


# ---------- exported sprites ----------

SHEETS = {}


def frame(key, tag, i=0):
    if key not in SHEETS:
        img = Image.open(f"public/art/sprites/{key}.png").convert("RGBA")
        data = json.load(open(f"public/art/sprites/{key}.json"))
        SHEETS[key] = (img, [f["frame"] for f in data["frames"].values()], {t["name"]: t for t in data["meta"]["frameTags"]})
    img, frames, tags = SHEETS[key]
    t = tags[tag]
    f = frames[t["from"] + i % (t["to"] - t["from"] + 1)]
    return img.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))


class Scene(Canvas):
    shade = "navy"

    def road(self, zone):
        self.shade = DARKER[K[ZONES[zone]]]
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
        items.append(("walker", 0, base, "walk"))
        for k, dx, foot, tag in sorted(items, key=lambda it: it[2]):
            self.feet(k, tag, cx + dx, foot)
        for k, dx, foot, _ in items:
            if k != "walker":
                self.line(cx - 9 if dx < 0 else cx + 8, base - 14, cx + dx, foot - 15, "dred")

    def chevron(self, cx, cy, d, col):
        for i in range(8):
            self.fill(cx + d * (i - 4), cy - 8 + i, 3, 1, col)
            self.fill(cx + d * (i - 4), cy + 8 - i, 3, 1, col)

    def bubble(self, x, y, w, lines, col="plum"):
        h = len(lines) * 8 + 6
        self.fill(x + 1, y, w - 2, h, "white"); self.fill(x, y + 1, w, h - 2, "white"); self.fill(x + 1, y + h, w - 2, 1, "lgrey")
        for i, ln in enumerate(lines):
            text_c(self, ln, x + w / 2, y + 4 + i * 8, col, 1, {"♥": "red", "$": "dgreen"})

    def heart(self, x, y, col, hi=None):
        for j, r in enumerate([".11.11.", "1111111", "1111111", ".11111.", "..111..", "...1..."]):
            for i, c in enumerate(r):
                if c == "1":
                    self.fill(x + i, y + j, 1, 1, col)
        if hi:
            self.fill(x + 1, y + 1, 1, 1, hi)

    def mini_card(self, x, y, title, cost, art):
        self.fill(x + 1, y, 62, 92, "plum"); self.fill(x, y + 1, 64, 90, "plum")
        self.fill(x + 2, y + 2, 60, 88, "cream"); self.fill(x + 2, y + 2, 60, 10, "red")
        text_c(self, title, x + 32, y + 4, "white")
        self.fill(x + 5, y + 15, 54, 44, "brown")
        art(x + 6, y + 16)
        self.fill(x + 6, y + 74, 52, 11, "plum")
        text_c(self, cost, x + 32, y + 77, "cream", 1, {"♥": "red", "$": "amber"})


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
    c.bubble(200, 168, 70, ["+$1"])
    c.fill(6, 6, 74, 22, "plum"); c.fill(7, 7, 72, 20, "cream")
    c.paste(frame("treat", "idle"), 9, 9)
    text(c, "TREATS 2/3", 28, 14, "plum")
    return c


def cards():
    c = Scene()
    c.road("street")
    c.feet("skunk", "idle", lane(2), 120)
    c.pack(lane(2), H - 8, ("dog-koda",), "react")
    c.dim(0, 0, W, H)
    text_c(c, "SKUNK!", 172, 18, "white", 2)

    def groom(x, y):
        c.fill(x, y, 52, 42, "lgrey"); c.paste(frame("dog-biscuit", "walk"), x + 10, y + 6)
        for bx, by in ((6, 8), (40, 10), (34, 30)):
            c.fill(x + bx, y + by, 3, 3, "white")

    def rinse(x, y):
        c.fill(x, y, 52, 42, "green"); c.paste(frame("dog-biscuit", "walk", 1), x + 10, y + 6)
        for k in range(6):
            c.fill(x + 4 + k * 3, y + 4 + k * 2, 1, 2, "cyan")

    def ignore(x, y):
        c.fill(x, y, 52, 42, "tan"); c.paste(frame("skunk", "idle"), x + 10, y + 6)

    c.mini_card(66, 50, "GROOM", "-$15 EACH", groom)
    c.mini_card(140, 50, "RINSE", "-$5 EACH", rinse)
    c.mini_card(214, 50, "IGNORE", "-2♥ EACH", ignore)
    c.fill(214, 144, 64, 2, "amber")
    text_c(c, "FREE", 246, 150, "amber")
    return c


def owners():
    c = Scene()
    c.fill(0, 0, W, H, "dbrown")
    sx, sy = 20, 20
    c.fill(sx, sy, 140, 96, "plum"); c.fill(sx + 1, sy + 1, 138, 94, "cream"); c.fill(sx + 4, sy + 4, 66, 34, "tan")
    c.paste(frame("face-owner-koda", "happy"), sx + 5, sy + 5)
    c.paste(frame("face-dog-koda", "happy"), sx + 37, sy + 5)
    text(c, "KODA", sx + 76, sy + 8, "plum"); text(c, "JESSE", sx + 76, sy + 18, "dbrown")
    for j in range(10):
        c.heart(sx + 6 + j * 9, sy + 46, "red" if j < 5 else "tan", "pink" if j < 5 else None)
    text(c, "5♥ OF 10", sx + 6, sy + 60, "plum", 1, {"♥": "red"})
    c.bubble(sx + 6, sy + 72, 128, ["TAP TO GIVE A TREAT: +1♥"])
    fx, fy = 186, 20
    c.fill(fx, fy, 140, 96, "plum"); c.fill(fx + 1, fy + 1, 138, 94, "tan"); c.fill(fx + 4, fy + 4, 34, 34, "brown")
    c.paste(frame("face-owner-nugget", "fired"), fx + 5, fy + 5)
    c.bubble(fx + 42, fy + 8, 92, ["YOU'RE FIRED!"], "red")
    for j in range(8):
        c.heart(fx + 6 + j * 9, fy + 46, "brown")
    text(c, "0♥: NUGGET GOES HOME", fx + 6, fy + 60, "plum", 1, {"♥": "red"})
    text(c, "FEES TAKEN BACK", fx + 6, fy + 72, "dred")
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
    text_c(c, "MAPLE STREET", 172, 8, "amber", 2)
    for i, z in enumerate(ZONES):
        x, y = 8 + i * 84, 44
        tile = TILES[z].crop((100, 0, 176, 64))
        c.img.paste(tile, (x, y)); c.img.paste(tile, (x, y + 64))
        c.fill(x, y + 120, 76, 12, "dbrown")
        c.fill(x, y, 76, 1, "plum"); c.fill(x, y + 119, 76, 1, "plum")
        text_c(c, NAMES[z], x + 38, y - 12, "cream")
        text_c(c, str(i + 1), x + 38, y + 50, "white", 3)
        c.paste(frame("tip", "idle"), x + 30, y + 124)
        text_c(c, "+FEES", x + 38, y + 144, "amber")
    text_c(c, "UPGRADE CARD BETWEEN ZONES", 172, 214, "green")
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
