#!/usr/bin/env python3
"""Compose the help screen's page illustrations from the exported sprites.

help-<page>: 344x236 images in Endesga 32, one per page of the in-game "How to
walk" screen (see public/art/mocks/help-screen.html, which animates the same
scenes). Built from public/art/sprites/ and the road strips, card illustrations
and UI images in public/art/images/, so build those first (roads.py, cards.py, ui.py).
Names, numbers, the camera and the layout come from the game's export in
shared/export/ at build time, so the pages follow the game.
The road pages show the run screen's bottom rows in the game's projection,
each sprite at its depth step.

Usage:
  help.py preview OUT.png   all six images side by side, scaled up
  help.py build             write art/help/*.aseprite and public/art/images/*.png

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
from pixel import DARKER, K, Grid  # noqa: E402
from ui import ZONE_COLOURS, chrome, to_image  # noqa: E402

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


# ---------- game data and layout, from the game's export in shared/export/ ----------

GAME = json.load(open("shared/export/game-data.json"))
LAYOUT = json.load(open("shared/export/layout.json"))


def by_id(items):
    return {item["id"]: item for item in items}


DOGS, ENCOUNTERS, DEBUFFS = by_id(GAME["dogs"]), by_id(GAME["encounters"]), by_id(GAME["debuffs"])


def tuning(*path):
    v = GAME["tuning"]
    for key in path:
        v = v[key]
    return v


def dollars(v):
    """As the game's formatDollars: "$20", or "$0.60" with cents."""
    v = abs(v)
    return f"${v:g}" if v == int(v) else f"${v:.2f}"


def dog(key):
    """A dog: (name, owner name, max hearts, starting hearts)."""
    d = DOGS[key]
    return d["name"].upper(), d["owner"]["name"].upper(), d["figures"]["maxHearts"], d["figures"]["startHearts"]


def fee(key):
    """The fee a dog pays after each zone, in dollars."""
    return DOGS[key]["figures"]["feeCents"] / 100


def mood(hearts):
    """The owner's face at this many hearts, as the game's faceMood."""
    if hearts >= tuning("hearts", "faceHappyFrom"):
        return "happy"
    return "neutral" if hearts >= tuning("hearts", "faceNeutralFrom") else "upset"


def card_options(encounter):
    """An encounter's card options, left to right: (name, art key, effect text, cost for one dog in
    dollars). The effect text follows the game's effectText, in capitals."""
    out = []
    for option in ENCOUNTERS[encounter]["resolution"]["options"]:
        effects, cost = [], 0
        for e in option["effects"]:
            if e["kind"] == "money":
                v = tuning("money", e["amount"])
                cost += v if e["change"] == "lose" else 0
                per_dog = " PER DOG" if "perDog" in e else ""
                effects.append(("-" if e["change"] == "lose" else "+") + dollars(v) + per_dog)
            elif e["kind"] == "hearts":
                n = e["amount"]
                effects.append(f"{'-' if n < 0 else '+'}{abs(n)}♥ EACH")
            elif e["kind"] == "debuff":
                effects.append(DEBUFFS[e["debuff"]]["name"].upper())
        out.append((option["name"].upper(), option["art"], ", ".join(effects), cost))
    return out


def world():
    """The world: its name, first zone, walk length and {zone id: zone} in its order. Each zone has
    its name, art key, road shadow and leash colours, and the difficulty (1 to 5), difficulty name
    and fee multiplier a fork's path card shows, None where the zone has none."""
    zones = {z["id"]: dict(
        name=z["name"], art=z["art"], shadow=z["roadShadowColor"].lstrip("#"), leash=z["leashColor"].lstrip("#"),
        difficulty=z.get("difficulty"), difficulty_name=z.get("difficultyName"), fees=z.get("fees"))
        for z in GAME["zones"]}
    w = GAME["world"]
    return w["name"].upper(), w["firstZone"], w["walkLength"], zones


# ---------- road strips: the exported road-<zone> images (roads.py) ----------

WORLD, FIRST_ZONE, WALK_LENGTH, ZONES = world()
TILES = {z: Image.open(f"public/art/images/road-{zone['art']}.png").convert("RGB") for z, zone in ZONES.items()}

# ---------- the projected road, as src/layout/projection.ts draws it ----------
# A point d road pixels ahead of the walker's feet draws at scale s = F / (F + d), on screen
# row YH + KS s. The page shows the run screen's bottom H rows, centred on the road: image
# column x is screen column x + OX, image row y screen row y + TOP, so the feet (screen row
# FOOT) land on row H - 8.

CAMERA = LAYOUT["camera"]
YH, FOOT, F = CAMERA["horizonY"], CAMERA["footY"], CAMERA["focal"]
KS = FOOT - YH
CX = CAMERA["centerX"]          # the road's centre on screen, verges either side out to the screen's edges
OX, TOP = CX - W // 2, FOOT - (H - 8)
STRIP_X, STRIP_W = LAYOUT["regions"]["road"]["x"], LAYOUT["regions"]["road"]["width"]
# The verge beside the road, as src/layout/roadside.ts: across is the distance from the road's
# centre line in road pixels; the curb to curbTo, the strips (bands out to each one's to), the
# sidewalk or paving to walkTo (on out where walkTo is null), then lawn. Colours are hex strings
# here. A plain grey sidewalk stands in where the export has no strips, walk or seam fields.
SIDEWALK = dict(strips=[], walkColor=K["lgrey"], walkDots=[], seamColor=K["grey"], seamEvery=32)


def hexed(c):
    return "%06x" % c if isinstance(c, int) else c


VERGES = {z: {**SIDEWALK, **v, "curbColor": hexed(v["curbColor"]),
              "walkColor": hexed(v.get("walkColor", SIDEWALK["walkColor"])),
              "seamColor": hexed(v.get("seamColor", SIDEWALK["seamColor"])),
              "walkTo": 10 ** 6 if v["walkTo"] is None else v["walkTo"]}
          for z, v in LAYOUT["verges"].items()}
MOWN = (44, 62, 36, 70, 50, 58, 40, 66)   # stripe widths out from the sidewalk, light then dark
SEAM_MAX_SPAN = 16
STEPS = {step["scale"]: step["suffix"] for step in LAYOUT["depthSteps"]}
# The pack, as src/layout/packFormation.ts: each dog's (dx across, distance ahead of the feet) by
# pack size, the first dog leading; the walker's hands (left dx, right dx, height above the
# feet) and the collar's height above a dog's feet.
PACK = LAYOUT["pack"]
FORMATIONS = {n + 1: [(p["dx"], -p["footDy"]) for p in f] for n, f in enumerate(PACK["formations"])}
HANDS = (PACK["walkerHands"]["leftDx"], PACK["walkerHands"]["rightDx"], PACK["walkerHands"]["heightAboveFeet"])
COLLAR = PACK["collarHeight"]
TOP_BAR = LAYOUT["topBar"]
DOGHOUSE = LAYOUT["doghouse"]["parts"]
CARD = LAYOUT["scenes"]["cards"]


def noise(x, y):
    """A fixed pseudo-random value in [0, 1) per pair of integers, as roadside.ts's noise."""
    h = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65536


def distance_at(y):
    """The road distance drawn on screen row y's centre, and the row's ground scale."""
    s = (y + 0.5 - YH) / KS
    return F / s - F, s


def dot(dots, value):
    """The dot colour a noise value in [0, 1) picks, or None: each dot takes its share of the range in
    turn, its colours equal parts of that share, as roadside.ts's dotColor."""
    for d in dots:
        if value < d["share"]:
            return hexed(d["colors"][math.floor(value / d["share"] * len(d["colors"]))])
        value -= d["share"]
    return None


def verge(zone, across, s, z, span, rx=0):
    """The colour beside the road at across (rx signed, negative on the left), on a row of scale s
    covering span road pixels from z: the curb, the strips, the sidewalk or paving with a seam every
    seamEvery, the strips and the paving with their dots, then the lawn, mown in stripes (none
    narrower than 4px on screen) or rough, with sparse tufts."""
    v = VERGES[zone]
    walk_to, lawn = v["walkTo"], v["lawn"]
    if across < v["curbTo"]:
        return v["curbColor"]
    for strip in v["strips"]:
        if across < strip["to"]:
            return dot(strip["dots"], noise(math.floor(rx), math.floor(z))) or hexed(strip["color"])
    if across < walk_to:
        if span < SEAM_MAX_SPAN and z // v["seamEvery"] != (z - max(span, 1)) // v["seamEvery"]:
            return v["seamColor"]
        return dot(v["walkDots"], noise(math.floor(rx), math.floor(z))) or v["walkColor"]
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
    """A frame at scale s as src/layout/depthScale.ts draws it: its larger side floor(side x s + 0.5),
    s capped at 1, from the smallest of its art steps (1x and the redrawn key@88 to key@50 it has) at
    least that size, scaled down nearest-neighbour."""
    art = frame(key, tag, i)
    size = max(1, math.floor(max(art.size) * min(1, s) + 0.5))
    for step, suffix in STEPS.items():
        if step < 1 and os.path.exists(f"public/art/sprites/{key}{suffix}.json"):
            f = frame(f"{key}{suffix}", tag, i)
            if size <= max(f.size) < max(art.size):
                art = f
    if max(art.size) == size:
        return art
    k = size / max(art.size)
    return art.resize((max(1, math.floor(art.width * k + 0.5)), max(1, math.floor(art.height * k + 0.5))),
                      Image.NEAREST)


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
                if STRIP_X <= rx < STRIP_X + STRIP_W:
                    px[x, y] = tile[math.floor(rx - STRIP_X), row]
                else:
                    px[x, y] = rgb(verge(zone, abs(rx - CX), s, z, span, rx - CX))

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
        formation, far ones first, with a leash from her hand to each collar (COLLAR over a dog's
        feet, its last opaque row; the hands HANDS[2] over the walker's). The leashes run under
        the walker, who hides the part behind her, and over the dogs and their shadows. Returns
        where each stands: image column, row and scale."""
        def feet(key, tag, sy, s):
            f = depth_frame(key, tag, s)
            return round(sy) - f.height + f.getbbox()[3] - 1

        items = [(k, dx, d, lead_tag if i == 0 else "walk") for i, (k, (dx, d)) in enumerate(zip(dogs, FORMATIONS[len(dogs)]))]
        placed = {k: self.stand(k, tag, cx + dx, d) for k, dx, d, tag in sorted(items, key=lambda it: -it[2])}
        sx, sy, _ = self.at(cx, 0)
        walker = frame("walker-casey", "walk")
        self.shadow(round(sx), round(sy), walker.width)
        hands = feet("walker-casey", "walk", sy, 1) - HANDS[2]
        for k, dx, _, tag in items:
            x, y, s = placed[k]
            hand = HANDS[0] if dx < 0 else HANDS[1]
            self.line(cx + hand, hands, round(x), round(feet(k, tag, y, s) - COLLAR * s), self.leash_col)
        placed["walker-casey"] = self.stand("walker-casey", "walk", cx, 0, shadow=False)
        return placed

    def chevron(self, cx, cy, d, col):
        for i in range(8):
            self.fill(cx + d * (i - 4), cy - 8 + i, 3, 1, col)
            self.fill(cx + d * (i - 4), cy + 8 - i, 3, 1, col)

    def bubble(self, x, y, w, lines, col="plum"):
        """A callout in ui.py's chrome, w wide, one 8px row per line: plum text on cream (9.42:1),
        $ in forest (5.39:1) and ♥ in dred (5.07:1)."""
        h = len(lines) * 8 + 7
        self.paste(to_image(chrome(Grid(w, h), 0, 0, w, h).px), x, y)
        for i, ln in enumerate(lines):
            text_c(self, ln, x + w / 2, y + 4 + i * 8, col, 1, {"♥": "dred", "$": "forest"})

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
        self.paste(image(art), x + CARD["art"]["x"], y + CARD["art"]["y"])
        self.paste(image("card-cost"), x + CARD["badge"]["x"], y + CARD["badge"]["y"])
        text_c(self, label, x + 42, y + 5, "white")
        body = CARD["effect"]["width"]
        sc = 2 if len(wrap(effect, body, 2)) * 12 <= 42 else 1
        for i, ln in enumerate(wrap(effect, body, sc)):
            text_c(self, ln, x + 42, y + 78 + i * 6 * sc, "plum", sc, {"♥": "dred"})
        text_c(self, cost, x + 42, y + 125, "plum")

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
        r = TOP_BAR["wells"]["zone"]["nameRight"] - (LAYOUT["screen"]["width"] - W)  # the zone well's right edge
        self.paste(frame("tip", "idle"), 8, 13)
        text(self, "$", 26, 15, "amber", 2); text(self, f"{money:g}", 26 + text_w("$", 2) + 2, 15, "cream", 2)
        self.paste(image("icon-treat"), 100, 13)
        text(self, f"{treats}/{tuning('counts', 'treatCarryMax'):g}", 118, 18, "cream")
        for name in ("home", "pause"):
            b = TOP_BAR["buttons"][name]
            self.paste(frame("ui-icon-button", "normal"), b["face"]["x"], b["face"]["y"])
            self.paste(image(f"icon-{name}"), b["icon"]["x"], b["icon"]["y"])
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
        pixels: the dog's file card, the name centred at 60 with its caps from row 6 on the
        header's name plate (at 2x where it fits name.width), the dog in its photo at (6, 24),
        the owner in theirs at (42, 24), the hearts from (78, 26) in rows of five 8px apart in
        the hearts box with the n/max count centred at (98, 46) under them, the status boxes at
        (78, 62) and (98, 62) left empty, and the owner's name at x 6 on the ID line (rows 60
        to 70). At 0 hearts the owner has fired you: the card is the grey empty one with FIRED
        in white centred on its plate (caps from row 74)."""
        name, owner, max_h, _ = dog(key)
        self.paste(frame("ui-doghouse", key if hearts else "empty"), x, y)
        plate = DOGHOUSE["name"]
        text_c(self, name, x + plate["x"], y + plate["y"], "plum", 2 if text_w(name, 2) <= plate["width"] else 1)
        if not hearts:
            fired = DOGHOUSE["fired"]
            text_c(self, "FIRED", x + fired["x"], y + fired["y"], "white")
            return
        m, dog_face, owner_face, row = mood(hearts), DOGHOUSE["dogFace"], DOGHOUSE["ownerFace"], DOGHOUSE["hearts"]
        self.paste(frame(f"face-dog-{key}", m), x + dog_face["x"], y + dog_face["y"])
        self.paste(frame(f"face-owner-{key}", m), x + owner_face["x"], y + owner_face["y"])
        for j in range(max_h):
            self.paste(frame("ui-heart", "full" if j < hearts else "empty"),
                       x + row["x"] + j % row["perRow"] * row["pitchX"], y + row["y"] + j // row["perRow"] * row["pitchY"])
        count = DOGHOUSE["heartCount"]
        text_c(self, f"{hearts}/{max_h}", x + count["x"], y + count["y"], "dred")
        text(self, owner, x + 6, y + 63, "plum")

    def path_card(self, x, y, zone):
        """A fork's path card as CardScene draws it: the route card-frame (the upgrade one until
        cards.py draws it), the zone's name in the band, its card-zone preview in the art window
        (until that is drawn, a crop of its road strip under its zone icon), and in the body
        the ui-difficulty paws, the difficulty name and the fee multiplier, where the zone has
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
        text_c(self, "FREE", x + 42, y + 125, "plum")


def lane(n):
    """Lane n's centre, in image columns."""
    return LAYOUT["lanes"]["centers"][n] - OX


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
    c.cue(STRIP_X - OX + 10, 195)
    c.stand("squirrel-dash", "run", STRIP_X - OX - 22, 195)
    c.pack(lane(3))
    return c


def pickups():
    c = Scene()
    c.road("park")
    for ln, d, key in ((2, 274, "tip"), (2, 215, "tip"), (2, 158, "tip"), (1, 106, "treat"), (3, 182, "treat")):
        c.stand(key, "idle", lane(ln), d)
    c.pack(lane(2), ("dog-biscuit",))
    # one tip: a pack's size changes how many tips appear, not what each is worth
    c.bubble(200, 168, 70, ["+" + dollars(tuning("money", "tip"))])
    # the bar after the first zone has paid the dog's fee, with two treats carried
    c.top_bar([FIRST_ZONE, "park"], fee("biscuit"), 2, 0.4)
    return c


def cards():
    c = Scene()
    c.road("street")
    c.stand("skunk", "idle", lane(2), 192)
    c.pack(lane(2), ("dog-koda",), "react")
    c.dim(0, 0, W, H)
    text_c(c, ENCOUNTERS["skunk"]["name"].upper() + "!", 172, 8, "white", 2)
    # the skunk card as one dog would see it: each cost is per dog, and a hearts-only option is free
    opts = card_options("skunk")
    x0 = (W - len(opts) * 89 + 6) // 2
    for i, (name, art, effect, cost) in enumerate(opts):
        c.card(x0 + i * 89, 28, name, art, effect, "-" + dollars(cost) if cost else "FREE")
    return c


def owners():
    c = Scene()
    c.fill(0, 0, W, H, "dbrown")
    # Koda's card at its starting hearts, a fingertip tapping the card under the hearts box to give
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
    # Nugget's card at 0 hearts, and the firing moment under it: the owner's fired face in
    # fx-fired-pop's storm with the cracked heart, and the FIRED! plate in the owner's
    # temperament (ui-fired-plate stretched to 84x28, the text's caps in rows 9 to 18)
    name, _, _, _ = dog("nugget")
    temperament = DOGS["nugget"]["owner"]["temperament"]
    c.doghouse(216, 8, "nugget", 0)
    c.paste(frame("fx-fired-pop", "play", 3), 244, 104)
    c.paste(frame("face-owner-nugget", "fired"), 260, 120)
    c.nine(frame("ui-fired-plate", re.sub(r"([A-Z])", r"-\1", temperament).lower()), 234, 158, 84, 28)
    text_c(c, "FIRED!", 276, 167, "white", 2)
    text_c(c, f"0♥: {name} GOES HOME", 276, 200, "cream", 1, {"♥": "white"})
    return c


def pulls():
    c = Scene()
    c.road("shops")
    c.stand("squirrel", "idle", lane(3), 290)
    cx = lane(2)
    kx, ky, ks = c.pack(cx, ("dog-koda", "dog-duchess"), "tell")["dog-koda"]
    # the bark 2 rows over the leaning dog's top opaque row, and the way it is about to pull
    kx, ky = round(kx), round(ky)
    dog_sprite = depth_frame("dog-koda", "tell", ks)
    top = ky - dog_sprite.height + dog_sprite.getbbox()[1]
    bark = frame("fx-bark", "pop", 1)
    c.paste(bark, kx - bark.width // 2, top - 2 - bark.height)
    mid = top - 2 - bark.height // 2
    for x in range(kx + bark.width // 2 + 4, lane(3) - 8, 4):
        c.fill(x, mid - 1, 2, 2, "amber")
    c.chevron(lane(3) - 6, mid, 1, "amber")
    text_c(c, "LEAN AND BARK", 172, 12, "plum")
    return c


def needs():
    c = Scene()
    c.road("snoozeCrescent")
    # Koda's need is Nosy, met at a lamp post
    need = DOGS["koda"]["need"]
    cx = lane(2)
    post = c.stand("spot-lamp-post", "idle", lane(3), 145)
    kx, ky, ks = c.pack(cx, ("dog-koda", "dog-duchess"), "pull")["dog-koda"]
    # Koda's urgent bubble as NeedSignals places it: the tail's tip a row above the dog's top
    # opaque row, centred on its centre column, the need's icon at 8,6
    dog_sprite = depth_frame("dog-koda", "pull", ks)
    top = round(ky) - dog_sprite.height + dog_sprite.getbbox()[1]
    bx, by = round(kx) - 16, top - 28
    c.paste(frame("ui-pull-bubble", "urgent"), bx, by)
    c.paste(frame(f"icon-need-{need}", "normal"), bx + 8, by + 6)
    # the pull line as NeedSignals draws it: from the bubble's centre to the spot's middle, 2x2
    # yellow dots in a plum rim every 7px from outside the bubble, then a 7x7 yellow arrowhead
    # in a 9x9 plum one
    sx, sy, ss = post
    lamp = depth_frame("spot-lamp-post", "idle", ss)
    x0, y0, x1, y1 = bx + 16, by + 14, round(sx), round(sy - lamp.height / 2)
    length = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / length, (y1 - y0) / length
    at = 16
    while at < length - 7:
        x, y = round(x0 + ux * at) - 1, round(y0 + uy * at) - 1
        c.fill(x - 1, y - 1, 4, 4, "plum")
        c.fill(x, y, 2, 2, "yellow")
        at += 7
    for size, col, inset in ((9, "plum", 0), (7, "yellow", 1)):
        tip = (x1 - ux * inset, y1 - uy * inset)
        base = (tip[0] - ux * size, tip[1] - uy * size)
        pts = [(round(tip[0]), round(tip[1])), (round(base[0] - uy * size / 2), round(base[1] + ux * size / 2)),
               (round(base[0] + uy * size / 2), round(base[1] - ux * size / 2))]
        for y in range(min(p[1] for p in pts), max(p[1] for p in pts) + 1):
            for x in range(min(p[0] for p in pts), max(p[0] for p in pts) + 1):
                d = [(pts[(i + 1) % 3][0] - pts[i][0]) * (y + 0.5 - pts[i][1])
                     - (pts[(i + 1) % 3][1] - pts[i][1]) * (x + 0.5 - pts[i][0]) for i in range(3)]
                if all(v >= 0 for v in d) or all(v <= 0 for v in d):
                    c.fill(x, y, 1, 1, col)
    # what steering in gets: the owner's happy face and the hearts the need gives when met
    met = next(e["amount"] for e in by_id(GAME["needs"])[need]["met"] if e["kind"] == "hearts")
    c.fill(W - 44, 8, 36, 36, "tan")
    c.paste(frame("face-owner-koda", "happy"), W - 42, 10)
    c.bubble(W - 82, 16, 30, [f"+{met}♥"])
    return c


def zones():
    c = Scene()
    # the fork at the end of the first zone: the road paused and dimmed under the fork's card,
    # the top bar's route with the first zone done and the rest not yet chosen
    c.road(FIRST_ZONE)
    c.dim(0, 0, W, H)
    c.top_bar([FIRST_ZONE], fee("koda"), 2)
    text_c(c, "START", W - 8 - 81 + 9, 42, "amber")
    # CardScene's fork title, white on an ink shadow
    text_c(c, "WHICH WAY?", 173, 46, "ink", 2); text_c(c, "WHICH WAY?", 172, 45, "white", 2)
    # three of the zones not yet walked, easiest on the left, as forkPaths sorts them; the
    # middle one picked
    left = [z for z in ZONES if z != FIRST_ZONE]
    paths = [left[0], left[len(left) // 2], left[-1]]
    for i, z in enumerate(paths):
        c.path_card(CARD["rows"][2][i]["x"] - OX, 61, z)
    c.nine(frame("ui-select", "pulse"), 126, 57, 91, 148)
    text_c(c, "BETWEEN ZONES: UPGRADE CARD, THEN A FORK", 172, 208, "yellow")
    # head home from the pause menu; while paused, the same button shows play and resumes
    c.button(52, 215, image("icon-pause"))
    text(c, "PAUSE: HEAD HOME", 76, 223, "cream")
    c.button(204, 215, image("icon-play"))
    text(c, "RESUME", 228, 223, "cream")
    return c


PAGES = {"lanes": lanes, "pickups": pickups, "cards": cards, "owners": owners, "pulls": pulls, "zones": zones,
         "needs": needs}


def build():
    os.makedirs("art/help", exist_ok=True)
    os.makedirs("public/art/images", exist_ok=True)
    for name, draw in PAGES.items():
        key = f"help-{name}"
        png = f"public/art/images/{key}.png"
        draw().img.save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/help/{key}.aseprite"], check=True)
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
