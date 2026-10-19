#!/usr/bin/env python3
"""Mock: an OutRun-style horizon in place of the backdrop's cross street.

Draws full 360x560 run screens in Endesga 32 from the exported art (ui-top-bar, the road
strips, walker, dogs, road objects, ui-doghouse), each zone twice: as the game draws it
now (the backdrop's houses and cross street) and with a horizon instead, where the road
runs on to a vanishing point under a low skyline.

The camera is the game's (shared/export/layout.json): the far edge on row 150 at scale 0.5,
the walker's feet on row 464, the true vanishing point on row -164. Everything from row 150
down is drawn the same in both versions. Above it, a flat road would still be 120px wide at
the top of the band, so the horizon version bends the ground away past the far edge: from
row 150 up to the horizon row the road's scale falls from 0.5 to 0 along a curve whose slope
matches the camera's at row 150, so the edges leave the far edge without a kink and meet at
a vanishing point on the horizon. Strip rows there are sampled at their road distance
(F / s - F), shrunk by the span each row covers as the game's strip levels do. The last
rows before the horizon dither the road and sidewalk into the lawn, as the game's far-road
fade does.

Usage:
  horizon.py build    write public/art/mocks/horizon/*.png

Run from the repository root. Mock tooling only: nothing here is game art.
"""

import json
import math
import os
import random
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
import backdrops as bd  # noqa: E402
import fonts  # noqa: E402
import help as hp  # noqa: E402
from pixel import DARKER, K, PALETTE  # noqa: E402

OUT = "public/art/mocks/horizon"
LAYOUT = json.load(open("shared/export/layout.json"))
CAM = LAYOUT["camera"]
SW, SH = LAYOUT["screen"]["width"], LAYOUT["screen"]["height"]
YH, FOOT, F, CX = CAM["horizonY"], CAM["footY"], CAM["focal"], CAM["centerX"]
KS = FOOT - YH
FAR_Y = CAM["farY"]                       # the road's far edge, scale 0.5
BAND_Y = LAYOUT["regions"]["backdrop"]["y"]
ROAD_HALF = LAYOUT["regions"]["road"]["width"] / 2
LANES = LAYOUT["lanes"]["centers"]
FADE_ROWS = 6
BAYER_4 = (0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5)


def rgb(c):
    return hp.rgb(K.get(c, c) if c in K else c)


# ---------- the ground: road strip and verge, per screen row ----------

def true_scale(y):
    """The camera's ground scale at row centre y + 0.5."""
    return (y + 0.5 - YH) / KS


def bend_scale(horizon):
    """Ground scale for rows between the horizon and the far edge: s = 0.5 f(t), t running 0 at
    the horizon to 1 at the far edge, f(t) = a t + (1 - a) t^2 with f'(1) set to the camera's
    slope there, so the road's edges carry on from the far edge without a kink."""
    span = FAR_Y - horizon
    a = 2 - span / (0.5 * KS)

    def s(y):
        t = (y + 0.5 - horizon) / span
        return 0.5 * (a * t + (1 - a) * t * t)
    return s


def shrink(tile, factor):
    """The strip shrunk factor times along its length as the game's shrinkRows: each pixel the
    colour most of its rows have, a tie to the strip's commonest colour."""
    px = tile.load()
    counts = {}
    for y in range(tile.height):
        for x in range(tile.width):
            counts[px[x, y]] = counts.get(px[x, y], 0) + 1
    base = max(counts, key=counts.get)
    h = max(1, tile.height // factor)
    out = Image.new("RGB", (tile.width, h))
    o = out.load()
    for r in range(h):
        for x in range(tile.width):
            seen = {}
            for k in range(min(factor, tile.height)):
                c = px[x, (r * factor + k) % tile.height]
                seen[c] = seen.get(c, 0) + 1
            most = max(seen.values())
            tied = [c for c in seen if seen[c] == most]
            o[x, r] = base if base in tied else tied[0]
    return out


LEVELS = {}


def levels(zone):
    """The strip at factors 1, 2, 4 as the game keeps it, then 8 to 64 for the bent rows, whose
    spans grow without bound toward the vanishing point."""
    if zone not in LEVELS:
        tile = hp.TILES[zone]
        LEVELS[zone] = {f: shrink(tile, f).load() if f > 1 else tile.load() for f in (1, 2, 4, 8, 16, 32, 64)}
    return LEVELS[zone]


def level_for(span):
    for f, top in ((1, 2), (2, 4), (4, 8), (8, 16), (16, 32), (32, 64)):
        if span <= top:
            return f
    return 64


MOWN = (44, 62, 36, 70, 50, 58, 40, 66)


def mown(across, s, walk_to):
    """Whether the front lawn at across falls in a dark mown stripe; the stripes start at the
    sidewalk's outer edge, walk_to."""
    rest, i = across - walk_to, 0
    if rest < 0 or rest >= 300:
        return False
    while rest >= MOWN[i % len(MOWN)]:
        rest -= MOWN[i % len(MOWN)]
        i += 1
    return i % 2 == 1 and MOWN[i % len(MOWN)] * s >= 4


def rough_patches(block):
    n = hp.noise
    out = []
    for i in range(10):
        side = -1 if n(block, 3 * i) < 0.5 else 1
        out.append((side * (ROAD_HALF + 30 + 730 * n(block, 3 * i + 1)),
                    (block + n(block, 3 * i + 2)) * 512, 30 + 60 * n(i, block + 7), 50 + 100 * n(block + 11, i)))
    return out


def verge_colour(zone, x, z, span, s, px, py):
    """The game's verge (src/layout/roadside.ts) at road x: help.py's curb, strips and sidewalk or
    paving with their seams and dots, then the lawn, mown or with rough patches, and tufts."""
    v = hp.VERGES[zone]
    across = abs(x)
    walk_to = v["walkTo"]
    if across < walk_to:
        return hp.verge(zone, across, s, z, span, x)
    col = K["green"]
    if v["lawn"] == "mown" and mown(across, s, walk_to):
        col = K["dgreen"]
    elif v["lawn"] == "rough":
        b = int(z // 512)
        if any(((x - qx) / rx) ** 2 + ((z - qz) / rz) ** 2 <= 1 for bb in (b - 1, b, b + 1)
               for qx, qz, rx, rz in rough_patches(bb)):
            col = K["dgreen"]
    rate = 0.03 * min(2, (s / 0.5) ** 2)
    if hp.noise(px, py) < rate or hp.noise(px, py - 1) < rate:
        col = DARKER[col]
    return col


def ground_rows(cv, zone, y0, y1, scale_of, scroll=0, road_only=False):
    """Draw screen rows y0..y1-1 of the projected road and verge: each row samples the strip at
    its road distance, at the level its span calls for."""
    lv = levels(zone)
    px = cv.img.load()
    for y in range(y0, y1):
        s = scale_of(y)
        if s <= 0:
            continue
        s_next = scale_of(y + 1)
        z = F / s - F + scroll
        span = z - (F / s_next - F + scroll) if s_next > 0 else 10 ** 6
        f = level_for(span)
        tile = lv[f]
        h = 64 // f
        row = (63 - math.floor(z)) % 64 // f
        row = min(row, h - 1)
        for x in range(SW):
            rx = (x + 0.5 - CX) / s
            if -ROAD_HALF <= rx < ROAD_HALF:
                px[x, y] = tile[math.floor(rx + ROAD_HALF), row]
            elif not road_only:
                px[x, y] = rgb(verge_colour(zone, rx, z, span, s, x, y))


def fade(cv, y0, rows, colour, x0=0, x1=SW, keep=None):
    """The game's far-road fade: ordered dither of rows y0.. y0+rows-1 into colour, the share
    given over to it growing toward y0. keep(x, y) protects pixels."""
    for k in range(rows):
        share = (rows - k - 0.5) / rows
        for x in range(x0, x1):
            if (BAYER_4[(k & 3) * 4 + (x & 3)] + 0.5) / 16 < share and not (keep and keep(x, y0 + k)):
                cv.fill(x, y0 + k, 1, 1, colour)


# ---------- sprites ----------

def sprite(key, tag, s, i=0):
    """The frame at scale s as the game draws it (help.depth_frame), with its feet row: the last
    opaque row."""
    _, _, tags = hp.sheet(key)
    tag = tag if tag in tags else next(iter(tags))
    f = hp.depth_frame(key, tag, s, i)
    return f, f.getbbox()[3] - 1


class Screen(hp.Canvas):
    def __init__(self, zone):
        super().__init__(SW, SH)
        self.zone = zone
        z = hp.ZONES[zone]
        self.shade, self.leash = z["shadow"], z["leash"]

    def at(self, x, d):
        s = F / (F + d)
        return CX + (x - CX) * s, YH + KS * s, s

    def shadow(self, cx, foot, w):
        rx = max(3, w / 2 - 2)
        ry = max(1.5, rx * 0.22)
        for y in range(-4, 5):
            for x in range(int(-rx - 1), int(rx + 2)):
                dx, dy = (x + 0.5) / rx, (y + 0.5) / ry
                if dx * dx + dy * dy <= 1:
                    self.fill(int(cx + x), int(foot - 1 + y), 1, 1, self.shade)

    def stand(self, key, tag, x, d, i=0, flip=False, shadow=True):
        sx, sy, s = self.at(x, d)
        img, feet = sprite(key, tag, s, i)
        if shadow:
            self.shadow(round(sx), round(sy), img.width)
        self.paste(img, round(sx - img.width / 2), round(sy) - feet, flip)
        return sx, sy, s

    def pack(self, cx, dogs):
        """The dogs footDy rows above the walker's feet, drawn at full size, far ones first; then a
        leash from the walker's hand to each collar, over the dogs and their shadows; then the walker,
        who hides the part of each leash behind her."""
        forms = LAYOUT["pack"]["formations"][len(dogs) - 1]
        hands = LAYOUT["pack"]["walkerHands"]
        collar = LAYOUT["pack"]["collarHeight"]
        items = [(k, f["dx"], -f["footDy"]) for k, f in zip(dogs, forms)]
        for k, dx, d in sorted(items, key=lambda it: -it[2]):
            img, feet = sprite(k, "walk", 1, 2)
            x, y = cx + dx, FOOT - d
            self.shadow(x, y, img.width)
            self.paste(img, round(x - img.width / 2), y - feet)
        img, feet = sprite("walker-casey", "walk", 1, 1)
        self.shadow(cx, FOOT, img.width)
        for k, dx, d in items:
            hand = hands["leftDx"] if dx < 0 else hands["rightDx"]
            self.line(cx + hand, FOOT - hands["heightAboveFeet"], round(cx + dx), FOOT - d - collar, self.leash)
        self.paste(img, cx - img.width // 2, FOOT - feet)


# ---------- the HUD: top bar and doghouses, as HudScene draws them ----------

GLYPHS = {}


def glyph_set(font):
    if font not in GLYPHS:
        GLYPHS[font] = fonts.glyphs(*fonts.FONTS[font][1:])[0]
    return GLYPHS[font]


def text_width(s, font="font-title", sc=1):
    g = glyph_set(font)
    return sum(g[ch][3] for ch in s) * sc


def text(cv, s, x, y, col, font="font-title", sc=1, origin=0.0):
    """Text as addPixelText places it: y is the top of the capitals."""
    g = glyph_set(font)
    x = round(x - text_width(s, font, sc) * origin)
    y -= g["H"][2] * sc
    for ch in s:
        mask, ox, oy, adv = g[ch]
        if mask is not None:
            m = mask.resize((mask.width * sc, mask.height * sc), Image.NEAREST) if sc > 1 else mask
            cv.img.paste(rgb(col), (x + ox * sc, y + oy * sc), m)
        x += adv * sc


def top_bar(cv, money, treats, route, fill):
    tb = LAYOUT["topBar"]
    cv.paste(hp.image("ui-top-bar"), 0, 0)
    mw, tw, zw = tb["wells"]["money"], tb["wells"]["treats"], tb["wells"]["zone"]
    cv.paste(hp.frame("tip", "idle"), mw["x"] + 4, mw["y"] + 5)
    text(cv, "$", mw["x"] + 22, mw["y"] + 7, "amber", sc=2)
    text(cv, str(money), mw["x"] + 22 + text_width("$", sc=2) + 2, mw["y"] + 7, "cream", sc=2)
    cv.paste(hp.frame("treat", "idle"), tw["x"] - 1, tw["y"] + 5)
    text(cv, str(treats), tw["x"] + tw["width"] - 2, tw["y"] + 10, "cream", origin=1)
    for b, icon in (("home", "icon-home"), ("pause", "icon-pause")):
        btn = tb["buttons"][b]
        cv.paste(hp.frame("ui-icon-button", "normal"), btn["face"]["x"], btn["face"]["y"])
        cv.paste(hp.image(icon), btn["icon"]["x"], btn["icon"]["y"])
    zone = hp.ZONES[route[-1]]
    right = zw["nameRight"]
    text(cv, zone["name"], right, zw["y"] + 4, "cream", origin=1)
    icon = hp.image(f"icon-zone-{zone['art']}")
    cv.paste(icon, right - text_width(zone["name"]) - 3 - icon.width, zw["y"] - 1)
    n = hp.WALK_LENGTH
    for i in range(n):
        x = right + 3 - n * 21 + i * 21
        art = hp.ZONES[route[i]]["art"] if i < len(route) else None
        current = i == len(route) - 1
        cv.paste(hp.frame("ui-zone-pips", "todo" if art is None else art if current else f"{art}-done"), x, zw["y"] + 17)
        if current:
            cv.fill(x + 1, zw["y"] + 18, round(fill * 16), 6, hp.ZONE_COLOURS[art])


def doghouse(cv, x, y, key, hearts):
    name, owner, max_h, _ = hp.dog(key)
    parts = LAYOUT["doghouse"]["parts"]
    cv.paste(hp.frame("ui-doghouse", key), x, y)
    sc = next((k for k in parts["name"]["scales"] if text_width(name, sc=k) <= parts["name"]["width"]), 1)
    text(cv, name, x + parts["name"]["x"], y + parts["name"]["y"], "plum", sc=sc, origin=0.5)
    m = hp.mood(hearts)
    cv.paste(hp.frame(f"face-dog-{key}", m), x + parts["dogFace"]["x"], y + parts["dogFace"]["y"])
    cv.paste(hp.frame(f"face-owner-{key}", m), x + parts["ownerFace"]["x"], y + parts["ownerFace"]["y"])
    hp_ = parts["hearts"]
    for j in range(max_h):
        cv.paste(hp.frame("ui-heart", "full" if j < hearts else "empty"),
                 x + hp_["x"] + j % hp_["perRow"] * hp_["pitchX"], y + hp_["y"] + j // hp_["perRow"] * hp_["pitchY"])
    text(cv, f"{hearts}/{max_h}", x + parts["heartCount"]["x"], y + parts["heartCount"]["y"], "dred", origin=0.5)
    text(cv, owner.title(), x + parts["ownerName"]["x"], y + parts["ownerName"]["y"], "plum", font="font-body")


def hud(cv, route, money, treats, fill, dogs):
    top_bar(cv, money, treats, route, fill)
    for slot, (key, hearts) in zip(LAYOUT["doghouse"]["slots"], dogs):
        doghouse(cv, slot["x"], slot["y"], key, hearts)


# ---------- the horizon band: sky, skyline layers ----------

def sky_bands(cv, y0, y1, bands):
    """Flat sky bands top to bottom, (colour, first row); each boundary steps in 5px blocks
    one row either way, as the backdrops' sky does."""
    for i, (col, top) in enumerate(bands):
        bottom = bands[i + 1][1] if i + 1 < len(bands) else y1
        cv.fill(0, max(y0, top), SW, bottom - max(y0, top), col)
        if i:
            for x in range(0, SW, 5):
                if (x // 5) % 2:
                    cv.fill(x, top, 5, 1, bands[i - 1][0])


def clouds(cv, items, seed):
    """Cumulus as the backdrops draw them: (x, base row on screen, width, puff)."""
    def draw(band):
        for k, (x, y, w, puff) in enumerate(items):
            bd.cloud(band, x, y - BAND_Y, w, puff, f"{seed}-{k}")
    overlay(cv, draw)


def ridge(cv, base, col, seed, lo, hi, period=0.05, x0=0, x1=SW):
    """A rolling silhouette standing on row base, lo to hi rows tall."""
    for x in range(x0, x1):
        t = x * period + seed
        v = 0.5 + 0.3 * math.sin(t) + 0.2 * math.sin(t * 2.7 + seed * 1.3)
        h = lo + round((hi - lo) * v)
        cv.fill(x, base - h, 1, h, col)


def blob_tree(cv, cx, base, r, col, shade=None, trunk=None, trunk_h=0):
    """A round treetop of radius r whose lowest row is base - trunk_h, shaded lower right."""
    cy = base - trunk_h - r
    if trunk and trunk_h:
        cv.fill(cx - 1, base - trunk_h - 1, 2, trunk_h + 1, trunk)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r + r * 0.6:
                c = shade if shade and dx + dy > r * 0.55 else col
                cv.fill(cx + dx, cy + dy, 1, 1, c)


def gable(cv, x, base, w, wall_h, roof_h, wall, roof, window=None, chimney=None):
    """A small house facing the camera on row base: wall_h of wall under a roof_h gable."""
    top = base - wall_h - roof_h
    for i in range(roof_h):
        inset = round((roof_h - 1 - i) * (w / 2 + 1) / roof_h)
        cv.fill(x - 1 + inset, top + i, w + 2 - 2 * inset, 1, roof)
    if chimney:
        cv.fill(x + w - 5, top + 1, 2, roof_h // 2, chimney)
    if wall_h:
        cv.fill(x, base - wall_h, w, wall_h, wall)
        if window:
            for wx in (x + 2, x + w - 4):
                if wx + 2 <= x + w:
                    cv.fill(wx, base - wall_h + 1, 2, 2, window)


def water_tower(cv, cx, base, col):
    cv.fill(cx - 5, base - 17, 10, 6, col)
    cv.fill(cx - 4, base - 18, 8, 1, col)
    cv.fill(cx - 1, base - 20, 2, 2, col)
    for dx in (-4, 3):
        cv.fill(cx + dx, base - 11, 1, 11, col)
    cv.fill(cx - 4, base - 6, 8, 1, col)


def steeple(cv, cx, base, col):
    cv.fill(cx - 3, base - 12, 6, 12, col)
    for i in range(8):
        cv.fill(cx - i // 3, base - 20 + i, 1 + 2 * (i // 3), 1, col)
    cv.fill(cx, base - 23, 1, 3, col)
    cv.fill(cx - 7, base - 7, 14, 7, col)


# ---------- zones ----------
# Each zone gives its horizon row, its sky and skyline (drawn over rows BAND_Y to the horizon),
# the colour the far road fades into, its near-left perch, the road objects (key, tag, lane,
# distance ahead), the pack with each dog's hearts, and the top bar's money and treats.

def woof_way_sky(cv, hz):
    sky_bands(cv, BAND_Y, hz, [("sky", BAND_Y), ("cyan", hz - 30)])
    clouds(cv, ((14, BAND_Y + 14, 38, 6), (128, BAND_Y + 8, 18, 3), (236, BAND_Y + 11, 34, 5),
                (316, BAND_Y + 20, 20, 3)), "ww")
    # far: hazy hills with the town's water tower and the church steeple
    ridge(cv, hz, "lgrey", 0.4, 6, 14, 0.035)
    water_tower(cv, 62, hz - 8, "lgrey")
    steeple(cv, 286, hz - 7, "lgrey")
    # middle: rooftops of the next streets, roofs only above a treeline, in the haze's grey
    rnd = random.Random("ww-roofs")
    x = -6
    while x < SW:
        w = rnd.choice((12, 14, 16, 18))
        if abs(x + w / 2 - CX) > 30:
            gable(cv, x, hz - 3, w, 0, rnd.choice((5, 6, 7)), None, "grey", chimney="grey" if rnd.random() < 0.4 else None)
        x += w + rnd.choice((4, 6, 9))
    ridge(cv, hz, "grey", 2.0, 3, 6, 0.11)
    # near: the end of the street, a row of little houses and round trees on the horizon
    homes = ((14, 22, "tan", "brown"), (64, 20, "pink", "purple"), (112, 18, "lgrey", "slate"),
             (CX - 12, 24, "cream", "dred"), (226, 18, "sky", "navy"), (272, 22, "skin1", "dslate"),
             (322, 20, "white", "dred"))
    for cx, r in ((44, 6), (98, 5), (150, 7), (206, 6), (256, 5), (304, 7), (352, 6)):
        blob_tree(cv, cx, hz, r, "dgreen", "forest", "dbrown", 3)
    for x, w, wall, roof in homes:
        gable(cv, x, hz, w, 6, 8, wall, roof, window="navy", chimney="brown")
    # the hedge line along the horizon, broken where the street runs on
    for x in range(SW):
        if abs(x + 0.5 - CX) > 3:
            h = 2 + (hp.noise(x // 3, 7) < 0.4)
            cv.fill(x, hz - h + 1, 1, h, "forest")


def promenade_sky(cv, hz):
    sky_bands(cv, BAND_Y, hz, [("sky", BAND_Y), ("cyan", hz - 34)])
    clouds(cv, ((8, BAND_Y + 12, 40, 6), (CX - 26, BAND_Y + 7, 26, 4), (CX + 94, BAND_Y + 15, 50, 7)), "pp")
    # the river runs across the horizon; the far bank's town stands on its far shore
    shore = hz - 9
    # far: the old town's skyline, hazy, with the clock tower
    rnd = random.Random("pp-town")
    x = -4
    while x < SW:
        w, h = rnd.choice((10, 12, 14, 16)), rnd.choice((8, 10, 12, 14, 16))
        cv.fill(x, shore - 4 - h, w, h + 4, "lgrey")
        if rnd.random() < 0.5:
            cv.fill(x + 1, shore - 6 - h, w - 2, 2, "lgrey")
        for wy in range(shore - 1 - h, shore - 6, 4):
            for wx in range(x + 2, x + w - 2, 4):
                if rnd.random() < 0.7:
                    cv.fill(wx, wy, 2, 2, "grey")
        x += w + rnd.choice((0, 2, 3))
    cv.fill(250, shore - 34, 8, 30, "lgrey")
    cv.fill(252, shore - 38, 4, 4, "lgrey")
    cv.fill(253, shore - 31, 2, 2, "grey")
    # middle: the far bank's trees and the arched bridge downriver
    ridge(cv, shore, "dgreen", 1.1, 4, 9, 0.09)
    for cx, r in ((20, 7), (70, 6), (128, 8), (206, 6), (300, 8), (346, 6)):
        blob_tree(cv, cx, shore, r, "dgreen", "forest")
    cv.fill(0, shore - 1, SW, 2, "green")
    # the footbridge downriver, on the left: a deck with its rail over stone piers in the water
    deck = shore - 2
    cv.fill(0, deck - 3, 92, 1, "lgrey")
    for x in range(0, 92, 4):
        cv.fill(x, deck - 2, 1, 2, "lgrey")
    cv.fill(0, deck, 92, 2, "lgrey")
    cv.fill(0, deck + 2, 92, 1, "grey")
    # the river: the far stone edge, water with glints, the near bank's edge on the horizon
    cv.fill(0, shore + 1, SW, 1, "grey")
    for py in range(shore + 2, hz):
        for px in range(SW):
            c = "blue" if py < shore + 4 else "sky"
            if hp.noise(px // 4, py) < 0.12 and py % 2 == 0:
                c = "cyan"
            if hp.noise(px, py * 7) < 0.02:
                c = "white"
            cv.fill(px, py, 1, 1, c)
    for x in (18, 50, 82):
        cv.fill(x, deck + 3, 4, hz - deck - 4, "grey")
        cv.fill(x, deck + 3, 1, hz - deck - 4, "lgrey")
    # the near embankment's edge along the horizon
    cv.fill(0, hz, SW, 1, "lgrey")
    # a rowboat and the ducks
    cv.fill(CX + 54, shore + 4, 14, 2, "brown")
    cv.fill(CX + 56, shore + 6, 10, 1, "dbrown")
    cv.fill(CX + 59, shore + 2, 2, 2, "red")
    for x in (CX - 104, CX - 96):
        cv.fill(x, shore + 6, 4, 2, "white")
        cv.fill(x + 3, shore + 5, 1, 1, "white")
        cv.fill(x + 4, shore + 5, 1, 1, "amber")


def overlay(cv, draw):
    """Draw backdrops.py art made for the 110-row band (draw(band)) over the band's rows."""
    band = hp.Canvas(SW, LAYOUT["regions"]["backdrop"]["height"])
    band.img = Image.new("RGBA", band.img.size, (0, 0, 0, 0))
    band.fill = lambda x, y, w, h, c: band.img.paste(rgb(c) + (255,), (int(x), int(y), int(x + w), int(y + h)))
    draw(band)
    cv.paste(band.img, 0, BAND_Y)


# The near-left perch the cat gag sits on, at its spot in each backdrop.
def picket_perch(band):
    bd.ffence(band, *bd.PERCH_X, bd.PERCH)


def rail_perch(band):
    bd.fence_rail(band, *bd.PERCH_X, bd.PERCH)


ZONES = {
    "street": dict(horizon=96, sky=woof_way_sky, fade_into="green", perch=picket_perch,
                   objects=(("tip", "idle", 2, 170), ("tip", "idle", 2, 230), ("tip", "idle", 2, 290),
                            ("parked-car", "idle", 4, 340), ("trash-bins", "idle", 0.5, 450),
                            ("cone", "idle", 2, 560), ("hydrant", "idle", 3, 250)),
                   dogs=(("koda", 4), ("biscuit", 3), ("duchess", 5)), money=18, treats=2),
    "pawsPromenade": dict(horizon=100, sky=promenade_sky, fade_into="green", perch=rail_perch,
                          objects=(("tip", "idle", 1, 180), ("tip", "idle", 1, 240), ("bench", "idle", 3.5, 300),
                                   ("goose", "idle", 1, 430), ("cyclist", "ride", 4, 520), ("treat", "idle", 2, 360)),
                          dogs=(("koda", 3), ("biscuit", 2), ("duchess", 4)), money=42, treats=1),
}
ROUTES = {"street": ["street"], "pawsPromenade": ["street", "pawsPromenade"]}


def lane_x(n):
    lo, hi = math.floor(n), math.ceil(n)
    return LANES[lo] + (LANES[hi] - LANES[lo]) * (n - lo)


def objects(cv, items):
    for key, tag, lane, d in sorted(items, key=lambda it: -it[3]):
        cv.stand(key, tag, lane_x(lane), d)


def current(zone):
    """The run screen as the game draws it now: the road and its sprites, the backdrop over
    them, the road's approach rows over the backdrop, then the HUD."""
    z = ZONES[zone]
    cv = Screen(zone)
    ground_rows(cv, zone, FAR_Y, SH, true_scale)
    objects(cv, z["objects"])
    cv.pack(LANES[2], [f"dog-{k}" for k, _ in z["dogs"]])
    cv.paste(hp.image(f"backdrop-{hp.ZONES[zone]['art']}"), 0, BAND_Y)
    approach = LAYOUT["regions"]["approach"]
    ground_rows(cv, zone, approach["y"], approach["y"] + approach["height"], true_scale, road_only=True)
    hud(cv, ROUTES[zone], z["money"], z["treats"], 0.35, z["dogs"])
    return cv


def horizon(zone):
    """The run screen with the horizon: rows from the far edge down as now; above it the ground
    bends away to the vanishing point on the horizon row, under the zone's sky and skyline."""
    z = ZONES[zone]
    hz = z["horizon"]
    cv = Screen(zone)
    ground_rows(cv, zone, FAR_Y, SH, true_scale)
    objects(cv, z["objects"])
    cv.pack(LANES[2], [f"dog-{k}" for k, _ in z["dogs"]])
    ground_rows(cv, zone, hz, FAR_Y, bend_scale(hz))
    lawn = {rgb(c) for c in ("green", "dgreen", "forest")}
    fade(cv, hz, FADE_ROWS, z["fade_into"], keep=lambda x, y: cv.img.getpixel((x, y)) in lawn)
    overlay(cv, z["perch"])
    z["sky"](cv, hz)
    hud(cv, ROUTES[zone], z["money"], z["treats"], 0.35, z["dogs"])
    return cv


def check(img):
    pal = {tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in PALETTE}
    bad = {c for _, c in img.convert("RGB").getcolors(1 << 16) if c not in pal}
    assert not bad, f"off-palette colours: {sorted(bad)[:5]}"


def build():
    os.makedirs(OUT, exist_ok=True)
    for zone in ZONES:
        art = hp.ZONES[zone]["art"]
        for name, draw in (("current", current), ("horizon", horizon)):
            img = draw(zone).img
            check(img)
            img.save(f"{OUT}/{art}-{name}.png")
            print(f"{OUT}/{art}-{name}.png")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
