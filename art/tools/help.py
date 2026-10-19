#!/usr/bin/env python3
"""Compose the help screen's page illustrations from the exported sprites.

help-<page>: 344x236 images in Endesga 32, one per page of the in-game "How to
walk" screen (see public/art/mocks/help-screen.html, which animates the same
scenes). Built from public/art/sprites/ and the road strips, card illustrations
and UI images in public/art/images/, so build those first (roads.py, cards.py, ui.py).
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


def mood(hearts):
    """The owner's face at this many hearts, as the game's faceMood."""
    if hearts >= tuning("hearts", "faceHappyFrom"):
        return "happy"
    return "neutral" if hearts >= tuning("hearts", "faceNeutralFrom") else "upset"


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


def image(key):
    return Image.open(f"public/art/images/{key}.png").convert("RGBA")


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
        self.paste(image(art), x + 5, y + 16)
        self.paste(image("card-cost"), x + 6, y + 121)
        text_c(self, label, x + 42, y + 5, "white")
        sc = 2 if len(wrap(effect, 71, 2)) * 12 <= 42 else 1
        for i, ln in enumerate(wrap(effect, 71, sc)):
            text_c(self, ln, x + 42, y + 78 + i * 6 * sc, "plum", sc, {"♥": "dred"})
        text_c(self, cost, x + 42, y + 125, "cream")

    def button(self, x, y, icon):
        """A ui-icon-button face with its 16x16 icon, as the top bar places them."""
        self.paste(frame("ui-icon-button", "normal"), x, y)
        self.paste(icon, x + 2, y + 1)

    def top_bar(self, zone, money, treats, fill):
        """ui-top-bar as HudScene fills it, in screen pixels less 16 columns cut from the empty
        left end of the zone well, so it fits the image's width: the money, the treat count, the
        sound and pause buttons, and the zone with its pips, the current one fill done."""
        bar, cut = image("ui-top-bar"), 200
        self.paste(bar.crop((0, 0, cut, 40)), 0, 0)
        self.paste(bar.crop((cut + bar.width - W, 0, bar.width, 40)), cut, 0)
        r = W - 8  # the zone well's right edge, 352 on screen
        self.paste(frame("tip", "idle"), 8, 13)
        text(self, "$", 26, 15, "amber", 2); text(self, f"{money:g}", 26 + text_w("$", 2) + 2, 15, "cream", 2)
        self.paste(frame("treat", "idle"), 104, 13)
        text(self, f"{treats}/{tuning('counts', 'treatCarryMax'):g}", 122, 18, "cream")
        self.button(146, 10, frame("icon-sound", "on")); self.button(170, 10, image("icon-pause"))
        name, index = ZONES[zone][0].upper(), list(ZONES).index(zone)
        text(self, name, r - text_w(name), 10, "cream")
        self.paste(image(f"icon-zone-{ZONES[zone][0].lower().replace(' ', '-')}"), r - text_w(name) - 19, 4)
        for i in range(len(ZONES)):
            x = r - 81 + i * 21
            self.paste(frame("ui-zone-pips", "done" if i < index else "current" if i == index else "todo"), x, 22)
            if i == index:
                self.fill(x + 2, 24, round(fill * 14), 4, "amber")

    def drag(self, x0, x1, y):
        """ui-touch-hint's drag, laid out for one drag: the fingertip pressed at x1 on the two-way
        track, the hand below it, and the touch marks it left fading back to x0, where it began.
        Pieces are cropped from the 96x36 export, whose fingertip glow is centred at 48,6."""
        hint = image("ui-touch-hint")
        ox, oy = x1 - 48, y - 6
        # the track: the hint's arrowheads (its outer 22 columns) either side of the drag, joined
        # by its plain middle column
        for x in range(x0 - 4, x1 + 4):
            self.paste(hint.crop((22, 0, 23, 12)), x, oy)
        self.paste(hint.crop((0, 0, 22, 12)), x0 - 26, oy); self.paste(hint.crop((74, 0, 96, 12)), x1 + 4, oy)
        # the faint mark where the drag began, the brighter one halfway, the speed lines trailing
        self.paste(hint.crop((23, 2, 29, 10)), x0 - 3, oy + 2)
        self.paste(hint.crop((33, 2, 39, 10)), (x0 + x1) // 2 - 3, oy + 2)
        self.paste(hint.crop((24, 15, 37, 26)), ox + 24, oy + 15)
        self.finger(x1, y)

    def finger(self, x, y):
        """ui-touch-hint's fingertip pressed at x, y: its glow, then the hand below, both cropped
        clear of the track."""
        hint = image("ui-touch-hint")
        self.paste(hint.crop((44, 1, 52, 10)), x - 4, y - 5)
        self.paste(hint.crop((39, 10, 59, 35)), x - 9, y + 4)

    def doghouse(self, x, y, key, hearts):
        """A dog-column slot as HudScene draws it (DOGHOUSE in src/hud/doghouse.ts): the house
        roofed in the dog's colour, its name on the roof plate, the dog in the door, the owner in
        the window, and the hearts in rows of six on the board with their count. At 0 hearts the
        owner has fired you: the house is the grey empty one and reads FIRED."""
        name, owner, max_h, _ = dog(key)
        self.paste(frame("ui-doghouse", key if hearts else "empty"), x, y)
        text_c(self, name, x + 36, y + 12, "plum")
        if not hearts:
            text_c(self, "FIRED", x + 36, y + 128, "dred")
            return
        m = mood(hearts)
        self.paste(frame(f"face-dog-{key}", m), x + 20, y + 36)
        self.paste(frame(f"face-owner-{key}", m), x + 8, y + 78)
        text_c(self, f"{hearts}/{max_h}", x + 56, y + 92, "dred")
        text(self, owner, x + 9, y + 118, "plum")
        for j in range(max_h):
            self.paste(frame("ui-heart", "full" if j < hearts else "empty"), x + 9 + j % 6 * 9, y + 127 + j // 6 * 8)


def lane(n):
    return 32 + n * 56 + 28


def lanes():
    c = Scene()
    c.road("street")
    # a thumb dragged one lane-width to the right, well clear of the walker, moves the pack from
    # lane 2 to lane 3: the drag is counted from where it began, not where the pack is
    c.bubble(88, 16, 112, ["DRAG ANYWHERE:", "ONE LANE-WIDTH, ONE LANE"])
    c.drag(lane(1), lane(2), 66)
    for x in range(lane(2), lane(3) - 30, 4):
        c.fill(x, 212, 2, 2, "amber")
    c.chevron(lane(3) - 26, 213, 1, "amber")
    c.pack(lane(3), H - 8)
    return c


def pickups():
    c = Scene()
    c.road("park")
    for ln, y, key in ((2, 50, "tip"), (2, 80, "tip"), (2, 110, "tip"), (1, 150, "treat"), (3, 124, "treat")):
        c.feet(key, "idle", lane(ln), y + 16)
    c.pack(lane(2), H - 8, ("dog-biscuit",))
    # one tip for a solo dog, in whole cents as the game counts it
    solo = round(tuning("money", "tip") * tuning("multipliers", "tipByPackSize", "1") * 100) / 100
    c.bubble(200, 168, 70, ["+" + dollars(solo)])
    # the bar after the first zone has paid the dog's fee, with two treats carried
    owner = ts_block(ts_block(data("dogs"), "biscuit"), "owner")
    c.top_bar("park", tuning("money", "feeByTemperament", ts_value(owner, "temperament")), 2, 0.4)
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
    # Koda's house at its starting hearts, a fingertip tapping it to give a treat
    _, _, _, start = dog("koda")
    c.doghouse(10, 18, "koda", start)
    c.finger(75, 152)
    c.bubble(10, 190, 128, [f"TAP TO GIVE A TREAT: +{tuning('hearts', 'treat'):g}♥"])
    # the faces between: what each owner's mood looks like
    text_c(c, "WATCH THEIR FACES", 136, 18, "amber")
    for i, m in enumerate(("happy", "neutral", "upset")):
        y = 32 + i * 44
        c.fill(98, y, 36, 36, "tan")
        c.paste(frame("face-owner-duchess", m), 100, y + 2)
        text(c, m.upper(), 138, y + 16, "cream")
    # Nugget's house at 0 hearts, its owner firing you beside it
    name, _, _, _ = dog("nugget")
    c.doghouse(192, 18, "nugget", 0)
    c.bubble(270, 18, 66, ["YOU'RE FIRED!"], "dred")
    c.fill(285, 40, 36, 36, "tan")
    c.paste(frame("face-owner-nugget", "fired"), 287, 42)
    text(c, f"0♥: {name} GOES HOME", 192, 178, "cream", 1, {"♥": "white"})
    text(c, "FEES TAKEN BACK", 192, 190, "cream")
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
    text_c(c, WORLD, 172, 6, "amber", 2)
    for i, (z, (name, _, _)) in enumerate(ZONES.items()):
        x, y = 8 + i * 84, 36
        tile = TILES[z].crop((100, 0, 176, 64))
        c.img.paste(tile, (x, y)); c.img.paste(tile.crop((0, 0, 76, 40)), (x, y + 64))
        c.fill(x, y, 76, 1, "plum"); c.fill(x, y + 103, 76, 1, "plum")
        text_c(c, name.upper(), x + 38, y - 12, "cream")
        # the zone number on a plum chip, so it holds contrast on every road (white on plum, 13.6:1)
        c.fill(x + 31, y + 40, 15, 23, "plum"); c.fill(x + 30, y + 41, 17, 21, "plum")
        text_c(c, str(i + 1), x + 38, y + 44, "white", 3)
        c.paste(frame("tip", "idle"), x + 30, y + 108)
        text_c(c, "+FEES", x + 38, y + 128, "amber")
    text_c(c, "UPGRADE CARD BETWEEN ZONES", 172, 182, "yellow")
    # head home from the pause menu; while paused, the same button shows play and resumes
    c.button(52, 202, image("icon-pause"))
    text(c, "PAUSE: HEAD HOME", 76, 210, "cream")
    c.button(204, 202, image("icon-play"))
    text(c, "RESUME", 228, 210, "cream")
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
