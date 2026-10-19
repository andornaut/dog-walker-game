#!/usr/bin/env python3
"""Compose the help screen's page illustrations from the exported sprites.

help-<page>: 344x236 images in Endesga 32, one per page of the in-game "How to
walk" screen (see public/art/mocks/help-screen.html, which animates the same
scenes). Built from public/art/sprites/ and the road strips, card illustrations
and UI images in public/art/images/, so build those first (roads.py, cards.py, ui.py).
Names and numbers come from src/data/ at build time, so the pages follow the data.
The road pages show the run screen's bottom rows in the game's projection,
each sprite at its depth step.

Usage:
  help.py preview OUT.png   all six images side by side, scaled up
  help.py build             write art/help/*.aseprite and public/art/images/*.png,
                            and list them in the manifest's "images"

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import json
import math
import os
import re
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from pixel import DARKER, K  # noqa: E402
from ui import ZONE_COLOURS  # noqa: E402

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
          "%": "101001010100101", "×": "000101010101000"})
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


def ts_items(src, key):
    """The source of each object literal in the array after the first `key: [` in src."""
    i, out, depth = re.search(rf"\b{key}: \[", src).end(), [], 0
    for j in range(i, len(src)):
        if src[j] == "{":
            depth += 1
            start = j + 1 if depth == 1 else start
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                out.append(src[start:j])
        elif src[j] == "]" and depth == 0:
            return out
    raise ValueError(f"{key} is not closed")


def ts_opt(src, key, default=None):
    """ts_value, or default where src has no such key."""
    return ts_value(src, key) if re.search(rf"(?<![\w.]){key}: ", src) else default


def world():
    """The world in world.ts: its name, first zone, walk length and {zone id: zone} in its order.
    Each zone has its name, art key (artId, else the name in kebab case), road shadow and leash
    colours, and the difficulty (1 to 5), difficulty name and fee multiplier a fork's path card
    shows, None where world.ts has none."""
    src, zones = data("world"), {}
    for block in ts_items(src, "zones"):
        name = ts_value(block, "name")
        zones[ts_value(block, "id")] = dict(
            name=name, art=ts_opt(block, "artId", re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")),
            shadow=ts_value(block, "roadShadowColor").lstrip("#"), leash=ts_value(block, "leashColor").lstrip("#"),
            difficulty=ts_opt(block, "difficulty"), difficulty_name=ts_opt(block, "difficultyName"),
            fees=ts_opt(block, "fees"))
    head = src[:src.index("zones: [")]
    return (ts_value(src, "name").upper(), ts_opt(head, "firstZone", next(iter(zones))),
            int(ts_opt(head, "walkLength", len(zones))), zones)


# ---------- road strips: the exported road-<zone> images (roads.py) ----------

WORLD, FIRST_ZONE, WALK_LENGTH, ZONES = world()
TILES = {z: Image.open(f"public/art/images/road-{zone['art']}.png").convert("RGB") for z, zone in ZONES.items()}

# ---------- the projected road, as src/layout/projection.ts draws it ----------
# A point d road pixels ahead of the walker's feet draws at scale s = F / (F + d), on screen
# row YH + KS s. The page shows the run screen's bottom H rows, centred on the road: image
# column x is screen column x + OX, image row y screen row y + TOP, so the feet (screen row
# FOOT) land on row H - 8.

# RATIO follows the game's camera at the base scroll speed: 5.25 s of road in view.
YH, FOOT, RATIO = -164, 464, 0.797
KS = FOOT - YH
F = KS / RATIO
CX = 180                        # the road's centre on screen, verges either side out to 0 and 360
OX, TOP = CX - W // 2, FOOT - (H - 8)
STRIP_X = CX - 140              # the road strip's left edge on screen, 280 wide
# The verge beside the road, as src/layout/roadside.ts: across is the distance from the road's
# centre line in road pixels; the curb to curbTo, the sidewalk or paving to walkTo, then lawn.
CURB, WALK = 144, 188
VERGES = {"street": (CURB, WALK, "mown"), "park": (140, 140, "rough"), "shops": (CURB, 10 ** 6, "none"),
          "homeStretch": (CURB, WALK, "mown")}
MOWN = (44, 62, 36, 70, 50, 58, 40, 66)   # stripe widths out from the sidewalk, light then dark
SEAM_PERIOD, SEAM_MAX_SPAN = 32, 16
STEPS = (1, 0.75, 0.5)
# The pack, as src/layout/packFormation.ts: each dog's (dx across, distance ahead of the feet) by
# pack size, the first dog leading; the walker's hands (left dx, right dx, height above the
# feet) and the collar's height above a dog's feet.
FORMATIONS = {1: [(0, 44)], 2: [(-12, 48), (12, 44)], 3: [(0, 58), (-14, 42), (14, 40)]}
HANDS = (-11, 10, 13)
COLLAR = 14


def noise(x, y):
    """A fixed pseudo-random value in [0, 1) per pair of integers, as roadside.ts's noise."""
    h = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65536


def distance_at(y):
    """The road distance drawn on screen row y's centre, and the row's ground scale."""
    s = (y + 0.5 - YH) / KS
    return F / s - F, s


def snap(s):
    """The depth step nearest a scale, judged by ratio, as the game's snapScale."""
    return min(STEPS, key=lambda t: abs(math.log(s / t)))


def verge(zone, across, s, z, span):
    """The colour beside the road at across, on a row of scale s covering span road pixels from
    z: the curb, the sidewalk with a seam every SEAM_PERIOD, then the lawn, mown in stripes
    (none narrower than 4px on screen) or rough, with sparse tufts."""
    curb_to, walk_to, lawn = VERGES[zone]
    if across < curb_to:
        return "grey"
    if across < walk_to:
        seam = span < SEAM_MAX_SPAN and z // SEAM_PERIOD != (z - max(span, 1)) // SEAM_PERIOD
        return "grey" if seam else "lgrey"
    col, rest, i = "green", across - walk_to, 0
    while lawn == "mown" and rest < 300 and rest >= MOWN[i % len(MOWN)]:
        rest -= MOWN[i % len(MOWN)]
        i += 1
    if lawn == "mown" and rest < 300 and i % 2 and MOWN[i % len(MOWN)] * s >= 4:
        col = "dgreen"
    if noise(int(across), int(z) // 2) < 0.03:
        col = "forest" if col == "dgreen" else "dgreen"
    return col


# ---------- exported sprites ----------

SHEETS = {}


def sheet(key):
    """An exported sprite: its sheet, each frame's rectangle and {tag name: tag}."""
    if key not in SHEETS:
        img = Image.open(f"public/art/sprites/{key}.png").convert("RGBA")
        meta = json.load(open(f"public/art/sprites/{key}.json"))
        SHEETS[key] = (img, [f["frame"] for f in meta["frames"].values()], {t["name"]: t for t in meta["meta"]["frameTags"]})
    return SHEETS[key]


def frame(key, tag, i=0):
    img, frames, tags = sheet(key)
    t = tags[tag]
    f = frames[t["from"] + i % (t["to"] - t["from"] + 1)]
    return img.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))


def depth_frame(key, tag, s, i=0):
    """A frame at the depth step for scale s: the redrawn key@75 or key@50 where it exists,
    else the sprite scaled nearest-neighbour, as the game does."""
    step = snap(s)
    if step == 1:
        return frame(key, tag, i)
    variant = f"{key}@{round(step * 100)}"
    if os.path.exists(f"public/art/sprites/{variant}.json"):
        return frame(variant, tag, i)
    f = frame(key, tag, i)
    return f.resize((round(f.width * step), round(f.height * step)), Image.NEAREST)


def image(key):
    return Image.open(f"public/art/images/{key}.png").convert("RGBA")


class Scene(Canvas):
    shade, leash_col = "navy", "dred"

    def road(self, zone):
        """The zone's road in projection: each image row samples one row of the road-<zone>
        strip at its distance, counting strip rows down the road as the game does, and the
        verge beside it."""
        self.shade, self.leash_col = ZONES[zone]["shadow"], ZONES[zone]["leash"]
        tile, px = TILES[zone].load(), self.img.load()
        for y in range(H):
            z, s = distance_at(y + TOP)
            span = z - distance_at(y + TOP + 1)[0]
            row = (63 - math.floor(z)) % 64
            for x in range(W):
                rx = CX + (x + OX + 0.5 - CX) / s
                if STRIP_X <= rx < STRIP_X + 280:
                    px[x, y] = tile[math.floor(rx - STRIP_X), row]
                else:
                    px[x, y] = rgb(verge(zone, abs(rx - CX), s, z, span))

    def at(self, x, d):
        """Where the road point at image column x (on the flat road at the feet) d road pixels
        ahead draws: its image column, row and scale."""
        s = F / (F + d)
        return W / 2 + (x - W / 2) * s, YH + KS * s - TOP, s

    def stand(self, key, tag, x, d, i=0, flip=False, shadow=True):
        """A road sprite standing at road point x, d at its depth step, on its shadow."""
        sx, sy, s = self.at(x, d)
        sprite = depth_frame(key, tag, s, i)
        if shadow:
            self.shadow(round(sx), round(sy), sprite.width)
        self.paste(sprite, sx - sprite.width / 2, round(sy) - sprite.height, flip)
        return sx, sy, s

    def cue(self, x, d, direction=1):
        """A mover's warning at road point x, d: ui-warning standing there and ui-warning-arrow
        a sign's width beside it, pointing the way the mover will cross."""
        sx, sy, _ = self.at(x, d)
        self.paste(frame("ui-warning", "pulse"), round(sx) - 8, round(sy) - 16)
        self.paste(frame("ui-warning-arrow", "pulse"), round(sx) - 8 + 16 * direction, round(sy) - 16, direction < 0)

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

    def pack(self, cx, dogs=("dog-koda", "dog-biscuit", "dog-duchess"), lead_tag="walk"):
        """The walker at the feet in lane centre cx and the dogs ahead of her in the game's
        formation, far ones first, with a leash from her hand to each collar. Returns where each
        stands: image column, row and scale."""
        items = [(k, dx, d, lead_tag if i == 0 else "walk") for i, (k, (dx, d)) in enumerate(zip(dogs, FORMATIONS[len(dogs)]))]
        items.append(("walker-casey", 0, 0, "walk"))
        placed = {k: self.stand(k, tag, cx + dx, d) for k, dx, d, tag in sorted(items, key=lambda it: -it[2])}
        base = round(self.at(cx, 0)[1])
        for k, dx, _, _ in items:
            if k != "walker-casey":
                x, y, s = placed[k]
                hand = HANDS[0] if dx < 0 else HANDS[1]
                self.line(cx + hand, base - HANDS[2], round(x), round(y - COLLAR * s), self.leash_col)
        return placed

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

    def top_bar(self, route, money, treats, fill=None):
        """ui-top-bar as HudScene fills it, in screen pixels less 16 columns cut from the empty
        left end of the zone well, so it fits the image's width: the money, the treat count, the
        Home and pause buttons, and the zone with a pip per zone of the walk: the zones walked
        (route, the last of them current) done, the current one filled fill of the way in its
        colour (done where fill is None), the ones ahead not yet chosen."""
        bar, cut = image("ui-top-bar"), 200
        self.paste(bar.crop((0, 0, cut, 40)), 0, 0)
        self.paste(bar.crop((cut + bar.width - W, 0, bar.width, 40)), cut, 0)
        r = W - 8  # the zone well's right edge, 352 on screen
        self.paste(frame("tip", "idle"), 8, 13)
        text(self, "$", 26, 15, "amber", 2); text(self, f"{money:g}", 26 + text_w("$", 2) + 2, 15, "cream", 2)
        self.paste(frame("treat", "idle"), 100, 13)
        text(self, f"{treats}/{tuning('counts', 'treatCarryMax'):g}", 118, 18, "cream")
        self.button(130, 10, image("icon-home")); self.button(174, 10, image("icon-pause"))
        zone = ZONES[route[-1]]
        name = zone["name"].upper()
        text(self, name, r - text_w(name), 10, "cream")
        self.paste(image(f"icon-zone-{zone['art']}"), r - text_w(name) - 19, 4)
        for i in range(WALK_LENGTH):
            x = r - 81 + i * 21
            art = ZONES[route[i]]["art"] if i < len(route) else None
            current = i == len(route) - 1 and fill is not None
            self.paste(frame("ui-zone-pips", "todo" if art is None else art if current else f"{art}-done"), x, 22)
            if current:
                self.fill(x + 1, 23, round(fill * 16), 6, ZONE_COLOURS[art])

    def nine(self, img, x, y, w, h, c=8):
        """A nine-slice image stretched to w x h at x, y: corners c square kept, edges and middle
        stretched nearest-neighbour."""
        iw, ih = img.size
        xs, ys = ((0, c, iw - c, iw), (0, c, w - c, w)), ((0, c, ih - c, ih), (0, c, h - c, h))
        for i in range(3):
            for j in range(3):
                src = img.crop((xs[0][i], ys[0][j], xs[0][i + 1], ys[0][j + 1]))
                size = (xs[1][i + 1] - xs[1][i], ys[1][j + 1] - ys[1][j])
                if size[0] > 0 and size[1] > 0:
                    self.paste(src.resize(size, Image.NEAREST), x + xs[1][i], y + ys[1][j])

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
        """A 120x90 dog slot as ui-doghouse lays it out (see its docstring in ui.py), in slot
        pixels: the house roofed in the dog's colour, the name centred at 60 on the roof's name
        plate (rows 4 to 15, at 2x where it fits the plate's 80px), the dog in the door at (6, 24),
        the owner in the window at (42, 24), the hearts from (78, 26) in rows of five 8px apart
        on the board with the n/max count centred at (98, 46) under them, the status pegs at
        (78, 62) and (98, 62) left empty, and the owner's name at x 6 on the name strip (rows 60
        to 70). At 0 hearts the owner has fired you: the house is the grey empty one with FIRED
        centred on its plate (rows 72 to 82)."""
        name, owner, max_h, _ = dog(key)
        self.paste(frame("ui-doghouse", key if hearts else "empty"), x, y)
        if text_w(name, 2) <= 76:
            text_c(self, name, x + 60, y + 5, "plum", 2)
        else:
            text_c(self, name, x + 60, y + 8, "plum")
        if not hearts:
            text_c(self, "FIRED", x + 60, y + 75, "dred")
            return
        m = mood(hearts)
        self.paste(frame(f"face-dog-{key}", m), x + 6, y + 24)
        self.paste(frame(f"face-owner-{key}", m), x + 42, y + 24)
        for j in range(max_h):
            self.paste(frame("ui-heart", "full" if j < hearts else "empty"), x + 78 + j % 5 * 8, y + 26 + j // 5 * 8)
        text_c(self, f"{hearts}/{max_h}", x + 98, y + 46, "dred")
        text(self, owner, x + 6, y + 63, "plum")

    def path_card(self, x, y, zone):
        """A fork's path card as CardScene draws it: the route card-frame (the upgrade one until
        cards.py draws it), the zone's name in the band, its card-zone preview in the art window
        (until that is drawn, a crop of its road strip under its zone icon), and in the body
        the ui-difficulty paws, the difficulty name and the fee multiplier, where world.ts has
        them. Taking a path costs nothing."""
        z = ZONES[zone]
        self.paste(frame("card-frame", "route" if "route" in sheet("card-frame")[2] else "upgrade"), x, y)
        if os.path.exists(f"public/art/images/card-zone-{z['art']}.png"):
            self.paste(image(f"card-zone-{z['art']}"), x + 5, y + 16)
        else:
            self.img.paste(TILES[zone].crop((102, 4, 177, 60)), (x + 5, y + 16))
            self.fill(x + 32, y + 34, 20, 20, "plum")
            self.paste(image(f"icon-zone-{z['art']}"), x + 34, y + 36)
        self.paste(image("card-cost"), x + 6, y + 121)
        text_c(self, z["name"].upper(), x + 42, y + 5, "white")
        if z["difficulty"] is not None:
            self.paste(frame("ui-difficulty", str(int(z["difficulty"]))), x + 14, y + 79)
        if z["difficulty_name"] is not None:
            text_c(self, z["difficulty_name"].upper(), x + 42, y + 94, "plum")
        if z["fees"] is not None:
            text_c(self, f"FEES ×{z['fees']:g}", x + 42, y + 104, "plum")
        text_c(self, "FREE", x + 42, y + 125, "cream")


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
    # a squirrel about to dash across ahead: its warning at the road's left edge, the arrow
    # pointing the way it will run, and the squirrel waiting on the verge
    c.cue(42, 195)
    c.stand("squirrel-dash", "run", 10, 195)
    c.pack(lane(3))
    return c


def pickups():
    c = Scene()
    c.road("park")
    for ln, d, key in ((2, 274, "tip"), (2, 215, "tip"), (2, 158, "tip"), (1, 106, "treat"), (3, 182, "treat")):
        c.stand(key, "idle", lane(ln), d)
    c.pack(lane(2), ("dog-biscuit",))
    # one tip for a solo dog, in whole cents as the game counts it
    solo = round(tuning("money", "tip") * tuning("multipliers", "tipByPackSize", "1") * 100) / 100
    c.bubble(200, 168, 70, ["+" + dollars(solo)])
    # the bar after the first zone has paid the dog's fee, with two treats carried
    owner = ts_block(ts_block(data("dogs"), "biscuit"), "owner")
    c.top_bar([FIRST_ZONE, "park"], tuning("money", "feeByTemperament", ts_value(owner, "temperament")), 2, 0.4)
    return c


def cards():
    c = Scene()
    c.road("street")
    c.stand("skunk", "idle", lane(2), 192)
    c.pack(lane(2), ("dog-koda",), "react")
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
    # Koda's house at its starting hearts, a fingertip tapping the wall under the board to give
    # a treat, clear of the faces, hearts and names
    _, _, _, start = dog("koda")
    c.doghouse(8, 8, "koda", start)
    c.finger(108, 82)
    c.bubble(8, 116, 120, [f"TAP TO GIVE A TREAT: +{tuning('hearts', 'treat'):g}♥"])
    # the owner's faces as the hearts go: what each mood looks like
    text_c(c, "WATCH THEIR FACES", 86, 154, "amber")
    for i, m in enumerate(("happy", "neutral", "upset")):
        x = 18 + i * 50
        c.fill(x, 164, 36, 36, "tan")
        c.paste(frame("face-owner-koda", m), x + 2, 166)
        text_c(c, m.upper(), x + 18, 204, "cream")
    # Nugget's house at 0 hearts, and the firing moment under it: the owner's fired face in
    # fx-fired-pop's storm with the cracked heart, and the FIRED! plate in the owner's
    # temperament (ui-fired-plate stretched to 72x28, the text's caps in rows 9 to 18)
    name, _, _, _ = dog("nugget")
    temperament = ts_value(ts_block(ts_block(data("dogs"), "nugget"), "owner"), "temperament")
    c.doghouse(216, 8, "nugget", 0)
    c.paste(frame("fx-fired-pop", "play", 3), 244, 104)
    c.paste(frame("face-owner-nugget", "fired"), 260, 120)
    c.nine(frame("ui-fired-plate", re.sub(r"([A-Z])", r"-\1", temperament).lower()), 240, 158, 72, 28)
    text_c(c, "FIRED!", 276, 167, "white", 2)
    text_c(c, f"0♥: {name} GOES HOME", 276, 196, "cream", 1, {"♥": "white"})
    text_c(c, "FEES TAKEN BACK", 276, 206, "cream")
    return c


def pulls():
    c = Scene()
    c.road("shops")
    c.stand("squirrel", "idle", lane(3), 290)
    cx = lane(2)
    kx, ky, _ = c.pack(cx, ("dog-koda", "dog-duchess"), "tell")["dog-koda"]
    # the bark over the leaning dog's head, and the way it is about to pull
    kx, ky = round(kx), round(ky)
    bark = frame("fx-bark", "pop", 1)
    c.paste(bark, kx - bark.width // 2, ky - 34 - bark.height)
    for x in range(kx + bark.width // 2 + 4, lane(3) - 8, 4):
        c.fill(x, ky - 42, 2, 2, "amber")
    c.chevron(lane(3) - 6, ky - 41, 1, "amber")
    text_c(c, "LEAN AND BARK", 172, 12, "plum")
    return c


def zones():
    c = Scene()
    # the fork at the end of the first zone: the road paused and dimmed under the fork's card,
    # the top bar's route with the first zone done and the rest not yet chosen
    c.road(FIRST_ZONE)
    c.dim(0, 0, W, H)
    owner = ts_block(ts_block(data("dogs"), "koda"), "owner")
    c.top_bar([FIRST_ZONE], tuning("money", "feeByTemperament", ts_value(owner, "temperament")), 2)
    text_c(c, "START", W - 8 - 81 + 9, 42, "amber")
    # CardScene's fork title, white on an ink shadow
    text_c(c, "WHICH WAY?", 173, 46, "ink", 2); text_c(c, "WHICH WAY?", 172, 45, "white", 2)
    # three of the zones not yet walked, easiest on the left, as forkPaths sorts them; the
    # middle one picked
    left = [z for z in ZONES if z != FIRST_ZONE]
    paths = [left[0], left[len(left) // 2], left[-1]]
    for i, z in enumerate(paths):
        c.path_card(39 + i * 91, 61, z)
    c.nine(frame("ui-select", "pulse"), 126, 57, 91, 148)
    text_c(c, "BETWEEN ZONES: UPGRADE CARD, THEN A FORK", 172, 208, "yellow")
    # head home from the pause menu; while paused, the same button shows play and resumes
    c.button(52, 215, image("icon-pause"))
    text(c, "PAUSE: HEAD HOME", 76, 223, "cream")
    c.button(204, 215, image("icon-play"))
    text(c, "RESUME", 228, 223, "cream")
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
