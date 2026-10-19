#!/usr/bin/env python3
"""Mock: bigger road sprites on wider lanes, beside today's scale.

Draws three full 360x560 Woof Way run screens in Endesga 32, each with today's top bar,
backdrop and doghouse row:

- today: 32px dogs, 32x48 walker, 5 lanes of 56px (road x 40 to 320 at the pack) and
  5.25 s of road in view, from the real exports.
- big: 40px dogs, 40x60 walker, 20x20 pickups, 5 lanes of 64px (road x 20 to 340 at the
  pack, 20px verges), lane-spanning obstacles 64n-24 wide (bench and puddle 104 wide),
  the same 5.25 s of road.
- big-near: the big scale with 3.5 s of road in view.

The camera is the game's (src/data/screen.ts, src/layout/projection.ts): the far edge on row
150 at scale 0.5 and the walker's feet on row 464, so horizonY is -164 whatever the look-ahead,
and focal = visibleDistance = seconds x roadScrollSpeed. Every object stands at the same
distance ahead in road pixels in each frame, so at the same scroll speed it is the same
number of seconds away.

The big sprites are redrawn, never upscaled: the drawing functions of dogs.py and road.py
run on a grid that scales every rect, ellipse and triangle by 1.25 (times the depth step)
before it rasterizes, keeps 1px lines 1px, then outlines the result at its own size. The cone
(after minis.cone, whose bands obstacles.cone cuts in full-size rows) and the 104px bench
(after obstacles.bench) are drawn here on that grid. The 320px road strip is roads.py's Woof
Way strip drawn 320 wide with dividers at 64k-1.

Usage:
  mock_scale.py build    write public/art/mocks/scale/*.png

Run from the repository root. Mock tooling only: nothing here is game art.
"""

import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "mocks-src"))
import dogs  # noqa: E402
import help as hp  # noqa: E402
import horizon as hz  # noqa: E402
import minis  # noqa: E402
import road  # noqa: E402
import roads  # noqa: E402
from pixel import PALETTE, edged  # noqa: E402

OUT = "public/art/mocks/scale"
ZONE = "street"
LAYOUT = hz.LAYOUT
CAM = LAYOUT["camera"]
FAR_Y, FOOT, CX = CAM["farY"], CAM["footY"], CAM["centerX"]
SPEED = hp.tuning("pixels", "roadScrollSpeed")
TODAY_SECONDS = CAM["secondsInView"]
BIG = 1.25


class Camera:
    """roadCameraFor with the far edge at scale 0.5 on row farY: horizonY = 2 farY - footY, and
    focal = visibleDistance. Lanes are lane px wide at the pack, centred on CX."""

    def __init__(self, seconds, lane):
        self.seconds, self.lane = seconds, lane
        self.distance = seconds * SPEED
        self.focal = self.distance * 0.5 / (1 - 0.5)
        self.horizon = (FAR_Y - 0.5 * FOOT) / (1 - 0.5)
        self.k = FOOT - self.horizon
        self.ratio = self.k / self.focal
        self.half = lane * 5 / 2
        self.lanes = [CX + (i - 2) * lane for i in range(5)]

    def scale_at_row(self, y):
        return (y + 0.5 - self.horizon) / self.k

    def at(self, x, d):
        s = self.focal / (self.focal + d)
        return CX + (x - CX) * s, self.horizon + self.k * s, s

    def lane_x(self, n):
        lo, hi = math.floor(n), math.ceil(n)
        return self.lanes[lo] + (self.lanes[hi] - self.lanes[lo]) * (n - lo)


# ---------- the big sprites: the shipped drawing functions on a scaling grid ----------

class Big(minis.Mini):
    """minis.Mini at any scale, above 1 too: a 1px line stays 1px wide."""

    def rect(self, x, y, w, h, c):
        if self.s < 1 or (w != 1 and h != 1):
            return super().rect(x, y, w, h, c)
        x0, y0 = self._edge(x), self._edge(y)
        x1 = x0 + 1 if w == 1 else self._edge(x + w)
        y1 = y0 + 1 if h == 1 else self._edge(y + h)
        for yy in range(y0, y1):
            for xx in range(x0, x1):
                self.g.p(xx, yy, c)


def drawn(module, s, draw, *args, **q):
    """draw(*args, **q) from module with its Grid swapped for a Big at scale s."""
    full, full_rim = module.Grid, road.rim
    module.Grid = lambda w=32, h=32: Big(s, w, h)
    road.rim = lambda g, rims: full_rim(getattr(g, "g", g), rims)
    try:
        return draw(*args, **q)
    finally:
        module.Grid, road.rim = full, full_rim


def to_image(rows):
    img = Image.new("RGBA", (len(rows[0]), len(rows)), (0, 0, 0, 0))
    img.putdata([(0, 0, 0, 0) if c is None else tuple(int(c[k:k + 2], 16) for k in (0, 2, 4)) + (255,)
                 for row in rows for c in row])
    return img


def feet_row(img):
    a = img.getchannel("A")
    return max(y for y in range(img.height) if any(a.getpixel((x, y)) for x in range(img.width)))


def bench(s, w=104):
    """obstacles.bench widened to w (64n-24 for n lanes) at scale s: the same slats, seat edge and
    legs, the legs and uprights spread in proportion."""
    g = edged(Big(s, w, 24))
    for x in (10, w - 14):
        g.rect(x, 2, 4, 21, "dslate")
        g.rect(x, 2, 2, 21, "slate")
    g.rect(4, 6, w - 8, 2, "plum")
    for y in (2, 8):
        g.rect(4, y, w - 8, 2, "tan")
        g.rect(4, y + 2, w - 8, 2, "brown")
    for x in (round(w * 20 / 88), round(w / 2), round(w * 68 / 88)):
        g.rect(x, 4, 2, 6, "dbrown")
    g.rect(2, 12, w - 4, 2, "plum")
    g.rect(2, 14, w - 4, 2, "tan")
    g.rect(2, 16, w - 4, 2, "brown")
    return g


def cone(s):
    """obstacles.cone at scale s: its two reflective bands, 3 rows at full size, cut at the drawn size
    as minis.cone does."""
    g = edged(Big(s))
    g.rect(7, 25, 18, 4, "grey")
    g.rect(7, 25, 18, 1, "lgrey")
    g.tri((9, 26), (23, 26), (16, 6), "orange")
    g.tri((16, 26), (23, 26), (16, 6), "rust")
    mid = minis.scaled(16, s)
    for y in (12, 19):
        for yy in range(g._edge(y), max(g._edge(y) + 1, g._edge(y + 3))):
            for x in range(g.g.w):
                if g.px[yy][x] in ("f77622", "be4a2f"):
                    g.g.p(x, yy, "white" if x < mid else "lgrey")
    g.g.rect(mid - 1, g._edge(7), 1, g._edge(11) - g._edge(7), "amber")
    return g


def big_sprite(key, s):
    """A big road object at the depth step for s, redrawn at that size; with its feet row."""
    step = hz.snap(s)
    if key == "cone":
        g = cone(BIG * step)
    elif key == "tip":
        g = drawn(road, BIG * step, road.tip, 5.5)
    elif key == "treat":
        g = drawn(road, BIG * step, road.treat, 0)
    elif key == "puddle":
        g = drawn(road, step, road.puddle, 0, w=104, h=32)
        img = to_image(g.outlined(False))
        return img, feet_row(img)
    elif key == "bench":
        g = bench(step)
    img = to_image(g.outlined())
    return img, feet_row(img)


def big_dog(name):
    q = minis.snap(dogs.pose(dogs.WALK[2]), BIG)
    img = to_image(drawn(dogs, BIG, dogs.DOGS[name][0], q).outlined())
    return img, feet_row(img)


def big_walker():
    q = minis.snap(road.WALKER_WALK[1], BIG)
    img = to_image(edged(drawn(road, BIG, road.walker, **q)).outlined())
    return img, feet_row(img)


def today_sprite(key, s):
    return hz.sprite(key, "idle", s)


# ---------- the road: strip and verge per screen row ----------

def wide_strip(width):
    """roads.py's Woof Way strip drawn width wide, its dividers at lane k x width/5 - 1."""
    w, div = roads.W, roads.DIVIDERS
    roads.W, roads.DIVIDERS = width, [k * width // 5 - 1 for k in range(1, 5)]
    try:
        return roads.to_image(roads.strip("woof-way"))
    finally:
        roads.W, roads.DIVIDERS = w, div


LEVELS = {}


def levels(tile):
    if id(tile) not in LEVELS:
        LEVELS[id(tile)] = {f: hz.shrink(tile, f).load() if f > 1 else tile.load() for f in (1, 2, 4, 8, 16, 32, 64)}
    return LEVELS[id(tile)]


def ground(cv, cam, tile, y0, y1, road_only=False):
    """Rows y0..y1-1 of the projected road and verge, as horizon.ground_rows, for cam. The verge
    keeps today's widths from the road's edge out."""
    lv = levels(tile)
    px = cv.img.load()
    half = tile.width / 2
    shift = half - hz.ROAD_HALF
    for y in range(y0, y1):
        s, s_next = cam.scale_at_row(y), cam.scale_at_row(y + 1)
        z = cam.focal / s - cam.focal
        span = z - (cam.focal / s_next - cam.focal)
        f = hz.level_for(span)
        row = min((63 - math.floor(z)) % 64 // f, 64 // f - 1)
        for x in range(hz.SW):
            rx = (x + 0.5 - CX) / s
            if -half <= rx < half:
                px[x, y] = lv[f][math.floor(rx + half), row]
            elif not road_only:
                px[x, y] = hz.rgb(hz.verge_colour(ZONE, rx - math.copysign(shift, rx), z, span, s, x, y))


# ---------- a frame ----------

# (key, lane, distance ahead in road px). Lane-spanning obstacles sit between two lane centres.
OBJECTS = (("tip", 3, 90), ("puddle", 0.5, 160), ("cone", 1, 250), ("treat", 2, 300), ("bench", 3.5, 360),
           ("cone", 0, 480), ("tip", 4, 580))
DOGS = (("koda", 4), ("biscuit", 3), ("duchess", 5))
DECALS = {"puddle"}


def frame(cam, big):
    cv = hz.Screen(ZONE)
    tile = wide_strip(5 * cam.lane) if big else hp.TILES[ZONE]
    ground(cv, cam, tile, FAR_Y, hz.SH)
    sprite = big_sprite if big else today_sprite
    for key, lane, d in sorted(OBJECTS, key=lambda o: -o[2]):
        if d >= cam.distance:
            continue
        sx, sy, s = cam.at(cam.lane_x(lane), d)
        img, feet = sprite(key, s)
        if key not in DECALS:
            cv.shadow(round(sx), round(sy), img.width)
        cv.paste(img, round(sx - img.width / 2), round(sy) - feet - 1)
    pack(cv, cam, big)
    cv.paste(hp.image(f"backdrop-{hp.ZONES[ZONE]['art']}"), 0, hz.BAND_Y)
    approach = LAYOUT["regions"]["approach"]
    ground(cv, cam, tile, approach["y"], approach["y"] + approach["height"], road_only=True)
    hz.hud(cv, [ZONE], 18, 2, 0.35, DOGS)
    return cv


def pack(cv, cam, big):
    """The pack in the centre lane, as horizon.Screen.pack; the big pack's formation, hands and
    collar height grow by 1.25 with the sprites."""
    k = BIG if big else 1
    p = LAYOUT["pack"]
    forms, hands = p["formations"][len(DOGS) - 1], p["walkerHands"]
    collar = round(p["collarHeight"] * k)
    cx = cam.lanes[2]
    placed = []
    for (name, _), f in zip(DOGS, forms):
        img, feet = big_dog(name) if big else (hp.frame(f"dog-{name}", "walk", 2), hz.ANCHORS[f"dog-{name}"]["feetY"])
        placed.append((round(f["footDy"] * k), round(f["dx"] * k), img, feet))
    for dy, dx, img, feet in sorted(placed):
        y, x = FOOT + dy, cx + dx
        cv.shadow(x, y, img.width)
        cv.paste(img, round(x - img.width / 2), y - feet - 1)
    img, feet = big_walker() if big else (hp.frame("walker-casey", "walk", 1), hz.ANCHORS["walker-casey"]["feetY"])
    cv.shadow(cx, FOOT, round(24 * k))
    cv.paste(img, cx - img.width // 2, FOOT - feet - 1)
    for dy, dx, _, _ in placed:
        hand = round((hands["leftDx"] if dx < 0 else hands["rightDx"]) * k)
        cv.line(cx + hand, FOOT - round(hands["heightAboveFeet"] * k), cx + dx, FOOT + dy - collar, cv.leash)


FRAMES = (("today", Camera(TODAY_SECONDS, 56), False), ("big", Camera(TODAY_SECONDS, 64), True),
          ("big-near", Camera(3.5, 64), True))


def build():
    os.makedirs(OUT, exist_ok=True)
    pal = {tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in PALETTE}
    for name, cam, big in FRAMES:
        img = frame(cam, big).img
        bad = {c for _, c in img.convert("RGB").getcolors(1 << 16) if c not in pal}
        assert not bad, f"{name}: off-palette colours {sorted(bad)[:5]}"
        img.save(f"{OUT}/woof-way-{name}.png")
        print(f"{OUT}/woof-way-{name}.png: horizonY {cam.horizon:g}, footY {FOOT}, farY {FAR_Y}, focal {cam.focal:g}, "
              f"ratio {cam.ratio:.4f}, {cam.seconds:g} s x {SPEED} px/s = {cam.distance:g} px, lanes {cam.lane}")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
