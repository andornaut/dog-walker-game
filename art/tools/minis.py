#!/usr/bin/env python3
"""Draw the small versions of road sprites that the pseudo-3D road shows at
0.75x and 0.5x. A plain nearest-neighbour downscale keeps every other pixel
(0.5x) or drops every fourth (0.75x), so it loses half the 1px outline, makes
legs blink and freezes 1px bobs. These are redrawn at the small size instead:
the same drawing functions run on a grid that scales every rect, ellipse and
triangle before it rasterizes, then the small sprite gets its own full outline.

<key>@75 and <key>@50 keep the original's tags, frame counts and durations,
and their frames are round(original size x scale):

tip@75, treat@75                    12x12
tip@50, treat@50                    8x8
cone@75, bin@75, hydrant@75         24x24
cone@50, bin@50, hydrant@50         16x16
dog-<name>@75 (all nine dogs)       24x24
dog-<name>@50                       16x16

Usage:
  minis.py preview OUT.png   every small frame on the street colours
  minis.py compare OUT.png   each sprite at 1x, then plain nearest-neighbour and
                             this file's version at 0.75x and 0.5x, at 4x zoom
  minis.py build             write art/minis/*.aseprite, export to
                             public/art/sprites/ and list them in the manifest

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import dogs  # noqa: E402
import obstacles  # noqa: E402
import road  # noqa: E402
from pixel import Grid, main, road_sprite  # noqa: E402

SCALES = (("75", 0.75), ("50", 0.5))


class Mini:
    """A Grid that takes coordinates at full size and draws them s times smaller.
    No shape shrinks to nothing: a primitive that covers no pixel sets the one at
    its centre. A single-pixel highlight never paints over a shape that has
    shrunk to 1px (an eye or a stud would otherwise turn into its own glint)."""

    def __init__(self, s, w=32, h=32):
        self.s, self.w, self.h = s, w, h
        self.g = Grid(round(w * s), round(h * s))
        self.keep = set()

    @property
    def px(self):
        return self.g.px

    def _edge(self, v):
        return math.floor(v * self.s + 0.5)

    def _set(self, draw, x, y, c, *args):
        before = [row[:] for row in self.g.px]
        draw(*args)
        if before == self.g.px:
            self.g.p(math.floor(x * self.s), math.floor(y * self.s), c)
        self.keep = {(xx, yy) for xx, yy in self.keep if self.g.px[yy][xx] == before[yy][xx]}

    def p(self, x, y, c):
        x, y = math.floor((x + 0.5) * self.s), math.floor((y + 0.5) * self.s)
        if (x, y) not in self.keep:
            self.g.p(x, y, c)

    def rect(self, x, y, w, h, c):
        """A rect too thin to cover a pixel's edge-to-edge span takes the pixel at its centre. A 1px line
        (a seam or a shaded edge) does not paint over a shape that shrank to 1px either."""
        x0, y0, x1, y1 = self._edge(x), self._edge(y), self._edge(x + w), self._edge(y + h)
        if x1 <= x0:
            x0 = math.floor((x + w / 2) * self.s)
            x1 = x0 + 1
        if y1 <= y0:
            y0 = math.floor((y + h / 2) * self.s)
            y1 = y0 + 1
        line, shrunk = w == 1 or h == 1, (w > 1 and x1 - x0 == 1) or (h > 1 and y1 - y0 == 1)
        for yy in range(y0, y1):
            for xx in range(x0, x1):
                if line and (xx, yy) in self.keep:
                    continue
                self.g.p(xx, yy, c)
                if shrunk:
                    self.keep.add((xx, yy))
                else:
                    self.keep.discard((xx, yy))

    def ell(self, cx, cy, rx, ry, c, sh=None, li=None):
        """Under 3px of radius an ellipse grows a 1px nub at each tip, so it is drawn a little squarer."""
        s = self.s
        if min(rx, ry) * s < 3:
            self._set(self.g.blob, cx, cy, c, cx * s, cy * s, rx * s, ry * s, c, sh, li, 3)
        else:
            self._set(self.g.ell, cx, cy, c, cx * s, cy * s, rx * s, ry * s, c, sh, li)

    def blob(self, cx, cy, rx, ry, c, sh=None, li=None, power=2.6):
        s = self.s
        self._set(self.g.blob, cx, cy, c, cx * s, cy * s, rx * s, ry * s, c, sh, li, power)

    def tri(self, a, b, c, col):
        s = self.s
        mx, my = (a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3
        self._set(self.g.tri, mx, my, col, *((x * s, y * s) for x, y in (a, b, c)), col)

    def outlined(self, outline=True):
        return self.g.outlined(outline)


def small(module, s, draw, *args):
    """Run module's draw(*args) with its Grid swapped for a Mini at scale s."""
    full = module.Grid
    module.Grid = lambda w=32, h=32: Mini(s, w, h)
    try:
        return draw(*args)
    finally:
        module.Grid = full


def snap(q, s):
    """A pose whose offsets move whole pixels at scale s, rounded down. Sideways and upward offsets
    still move at least one, so a 1px bob, step or wag shows; downward ones may round to nothing,
    because the feet already sit on the frame's bottom row and a lower foot would lose its outline."""
    out = {}
    for k, v in q.items():
        n = math.floor(abs(v) * s)
        if v < 0 or k not in ("fl", "fr", "bl", "br", "bob"):
            n = max(1, n) if v else 0
        out[k] = math.copysign(n, v) / s
    return out


def tip(s, rx):
    """road.tip; at 0.5x the coin keeps its face and rim but drops the stamped mark, which turns to noise."""
    g = Mini(s, 16, 16)
    if rx < 1.5:
        g.rect(7, 3, 2, 10, "orange")
        g.rect(7, 3, 1, 10, "amber")
        return g
    g.ell(8, 8, rx, 5.5, "amber", "orange", "yellow")
    if rx > 2 and s > 0.5:
        g.rect(8, 5, 1, 6, "orange")
        g.p(7, 6, "orange")
        g.p(9, 9, "orange")
    return g


# The bone drawn by hand: scaled, its four knobs merge unevenly. c cream, t tan, w the glint.
TREAT = {
    0.75: [".wc....cc.",
           "cccccccccc",
           "cttttttttt",
           ".tt....tt."],
    0.5: ["w....c",
          "cccccc",
          "cttttt",
          "t....t"],
}


def treat(s, lift):
    """road.treat redrawn: a bone whose knobs stick out above and below the shaft at both ends."""
    g = Grid(round(16 * s), round(16 * s))
    y = g.h // 2 - 2 + lift
    for j, row in enumerate(TREAT[s]):
        for i, ch in enumerate(row):
            if ch != ".":
                g.p(1 + i, y + j, {"c": "cream", "t": "tan", "w": "white"}[ch])
    return g


def cone(s):
    """obstacles.cone with its two reflective bands cut at the small size."""
    g = Mini(s)
    g.rect(8, 25, 16, 4, "dslate")
    g.rect(8, 25, 16, 1, "slate")
    g.tri((10, 26), (22, 26), (16, 4), "orange")
    g.tri((16, 26), (22, 26), (16, 4), "rust")
    mid = round(16 * s)
    for y in (11, 19):
        yy = g._edge(y)
        for x in range(g.g.w):
            if g.px[yy][x] in ("f77622", "be4a2f"):
                g.g.p(x, yy, "white" if x < mid else "lgrey")
                if s > 0.5:
                    g.g.p(x, yy + 1, "white" if x < mid else "lgrey")
    # the highlight stays just left of the centre line, where it is at full size
    g.g.rect(round(16 * s) - 1, g._edge(5), 1, g._edge(9) - g._edge(5), "amber")
    return g


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    for suffix, s in SCALES:
        yield f"tip@{suffix}", [("idle", [tip(s, rx).outlined() for rx in (5.5, 3.5, 1, 3.5)], 120)]
        yield f"treat@{suffix}", [("idle", [treat(s, lift).outlined() for lift in (0, -1)], 400)]
        yield f"cone@{suffix}", [("idle", [cone(s).outlined()], 1000)]
        yield f"bin@{suffix}", [("idle", [small(obstacles, s, obstacles.bin_).outlined()], 1000)]
        yield f"hydrant@{suffix}", [("idle", [small(obstacles, s, obstacles.hydrant).outlined()], 1000)]
        for name, (draw, _) in dogs.DOGS.items():
            yield f"dog-{name}@{suffix}", [(tag, [small(dogs, s, draw, snap(dogs.pose(q), s)).outlined() for q in poses], ms)
                                           for tag, poses, ms in dogs.ROAD_TAGS]


def originals():
    """The full-size sprites this file makes small versions of, by key."""
    out = {}
    for module in (road, obstacles, dogs):
        for key, tags in module.sprites():
            out[key] = tags
    return out


def nearest(f, s):
    """What the game's nearest-neighbour scaling shows: each screen pixel samples the source at its centre."""
    h, w = round(len(f) * s), round(len(f[0]) * s)
    return [[f[int((y + 0.5) / s)][int((x + 0.5) / s)] for x in range(w)] for y in range(h)]


def compare(out, grounds=("3a4466", "c0cbdc"), scale=4, gap=4):
    """Per sprite and ground, three lines: every frame at 1x, then nearest-neighbour beside
    this file's version at 0.75x, then the same at 0.5x."""
    from PIL import Image

    full = originals()
    minis = dict(sprites())
    lines = []
    for key in [k[:-3] for k in minis if k.endswith("@75")]:
        frames = [f for _, fs, _ in full[key] for f in fs]
        for ground in grounds:
            lines.append(([frames], ground))
            for suffix, s in SCALES:
                lines.append(([[nearest(f, s) for f in frames],
                               [f for _, fs, _ in minis[f"{key}@{suffix}"] for f in fs]], ground))
    width = max(sum(sum(len(f[0]) + gap for f in b) + 2 * gap for b in blocks) for blocks, _ in lines)
    height = sum(len(blocks[0][0]) + gap for blocks, _ in lines)
    img = Image.new("RGB", (width * scale, height * scale), (24, 20, 37))
    y0 = 0
    for blocks, ground in lines:
        x0 = 0
        for block in blocks:
            for f in block:
                for y, row in enumerate(f):
                    for x, c in enumerate(row):
                        rgb = tuple(int((c or ground)[k:k + 2], 16) for k in (0, 2, 4))
                        img.paste(rgb, ((x0 + x) * scale, (y0 + y) * scale, (x0 + x + 1) * scale, (y0 + y + 1) * scale))
                x0 += len(f[0]) + gap
            x0 += 2 * gap
        y0 += len(blocks[0][0]) + gap
    img.save(out)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "compare":
        compare(sys.argv[2])
    else:
        main(sys.argv, sprites, "art/minis", __doc__, grounds=("3a4466", "c0cbdc"), anchored=road_sprite)
