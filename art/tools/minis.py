#!/usr/bin/env python3
"""Draw the small versions of road sprites that the pseudo-3D road shows at
each depth step below full size: STEPS, read from shared/depth-steps.json, the
table the game reads (0.875x, 0.75x, 0.625x and 0.5x). A plain nearest-
neighbour downscale drops rows and columns, so it loses up to half the 1px
outline, makes legs blink and freezes 1px bobs. These are redrawn at the small
size instead: the same drawing functions run on a grid that scales every rect,
ellipse and triangle before it rasterizes, then the small sprite gets its own
full outline. Faces are drawn at the small size (small() swaps in face_front,
squirrel() squirrel_head). Where that still loses a feature (the treat's knobs
at @75 and @50, the skunk's face), the sprite or the feature is a hand-drawn
pixel map instead. road.py's sprites are drawn at road.SCALE x the step, as
road.py draws them at road.SCALE.

<key>@<step> keeps the original's tags, frame counts and durations, and its
frame is floor(original size x scale + 0.5). At every step: tip, treat,
lost-wallet, cone, bin, hydrant, bench, skunk, squirrel, other-dog and
skunk-cloud (no outline). At @75 and @50 only (SCALES): dog-<name> for every
dog, since the pack is drawn at full size; a dog's design grid is drawn at
dogs.ROAD_SCALE times the step, so its frame is 30x30 at @75 and 20x20 at @50.

Usage:
  minis.py preview OUT.png   every small frame on the street colours
  minis.py compare OUT.png   each sprite at 1x, then plain nearest-neighbour and
                             this file's version at each scale it has, at 4x zoom
  minis.py build             write art/minis/*.aseprite and export them to
                             public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import dogs  # noqa: E402
import obstacles  # noqa: E402
import road  # noqa: E402
from pixel import K, Grid, edged, main  # noqa: E402



def depth_steps():
    """(suffix, scale) for every depth step below full size in shared/depth-steps.json, the table the game
    reads, the suffix without its @: ("88", 0.875) and so on."""
    root = os.path.join(os.path.dirname(__file__), "..", "..")
    with open(os.path.join(root, "shared", "depth-steps.json")) as f:
        steps = json.load(f)["steps"]
    return tuple((q["suffix"].lstrip("@"), q["scale"]) for q in steps if q["scale"] < 1)


STEPS = depth_steps()
# The steps the hand-drawn maps here and in hazards.py are drawn for.
SCALES = tuple((suffix, s) for suffix, s in STEPS if s in (0.75, 0.5))


def scaled(v, s):
    """v at scale s in whole pixels, halves rounding up as the game rounds them."""
    return math.floor(v * s + 0.5)


class Mini:
    """A Grid that takes coordinates at full size and draws them s times smaller.
    No shape shrinks to nothing: a primitive that covers no pixel sets the one at
    its centre. A single-pixel highlight never paints over a shape that has
    shrunk to 1px (an eye or a stud would otherwise turn into its own glint)."""

    def __init__(self, s, w=32, h=32):
        self.s, self.w, self.h = s, w, h
        self.g = Grid(scaled(w, s), scaled(h, s))
        self.keep = set()

    @property
    def px(self):
        return self.g.px

    def _edge(self, v):
        return scaled(v, self.s)

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

    def _hug(self, a, b, cells):
        """Drawn bigger (s above 1), a 1px line whose full-size pixel spans output pixels a to b - 1 keeps to
        one of them: the last when what it is drawn over ends just past b - 1 and carries on before a (a
        seam along a shape's lower or right edge), else the first. cells are (x, None) for a row or (None, y)
        for a column."""
        px, h, w = self.g.px, self.g.h, self.g.w

        def at(cell, v):
            x, y = (cell[0], v) if cell[1] is None else (v, cell[1])
            return px[y][x] if 0 <= x < w and 0 <= y < h else None

        before = sum(at(c, a - 1) == at(c, a) for c in cells)
        after = sum(at(c, b) == at(c, b - 1) for c in cells)
        return b - 1 if after < before else a

    def rect(self, x, y, w, h, c):
        """A rect too thin to cover a pixel's edge-to-edge span takes the pixel at its centre. A 1px line
        (a seam or a shaded edge) does not paint over a shape that shrank to 1px either, and drawn bigger it
        stays 1px wide (see _hug)."""
        x0, y0, x1, y1 = self._edge(x), self._edge(y), self._edge(x + w), self._edge(y + h)
        if x1 <= x0:
            x0 = math.floor((x + w / 2) * self.s)
            x1 = x0 + 1
        if y1 <= y0:
            y0 = math.floor((y + h / 2) * self.s)
            y1 = y0 + 1
        line, shrunk = w == 1 or h == 1, (w > 1 and x1 - x0 == 1) or (h > 1 and y1 - y0 == 1)
        if self.s > 1 and h == 1 and y1 - y0 > 1:
            y0 = self._hug(y0, y1, [(xx, None) for xx in range(x0, x1)])
            y1 = y0 + 1
        if self.s > 1 and w == 1 and x1 - x0 > 1:
            x0 = self._hug(x0, x1, [(None, yy) for yy in range(y0, y1)])
            x1 = x0 + 1
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


def small(module, s, draw, *args, **q):
    """Run module's draw(*args, **q) with its Grid swapped for a Mini at scale s. Meanwhile road.rim lights
    the Mini's own grid, so a drawing that ends in rim gets the rim at the small size, and road.face_front
    (module's too, where it imports it) is face_front at scale s."""
    full, full_rim, full_face = module.Grid, road.rim, road.face_front
    faced = [m for m in {road, module} if getattr(m, "face_front", None) is full_face]
    module.Grid = lambda w=32, h=32: Mini(s, w, h)
    road.rim = lambda g, rims: full_rim(getattr(g, "g", g), rims)
    for m in faced:
        m.face_front = lambda g, cx, y, *a, **k: face_front(s, g, cx, y, *a, **k)
    try:
        return draw(*args, **q)
    finally:
        module.Grid, road.rim = full, full_rim
        for m in faced:
            m.face_front = full_face


def face_front(s, g, cx, y, mood="happy", eyes="ink", lips="dbrown"):
    """road.face_front at scale s on the Mini g, drawn at the small size: scaled, its eyes lose their glint
    and its mouth swells into a dark blot. Each eye is 2 x s square, rounded, at least 1px, centred where it
    is at full size, with its white glint at the top-left when it is 2px. The mouth is 2 x s wide on the row
    under the mouth's full-size row; from 0.75x a happy or smirking mouth keeps its upturned corners."""
    px = getattr(g, "g", g)
    n = max(1, scaled(2, s))
    top = math.floor((y + 1) * s + 0.5 - n / 2)
    for x in (cx - 4, cx + 4):
        x0 = math.floor(x * s + 0.5 - n / 2)
        px.rect(x0, top, n, n, eyes)
        if n > 1:
            px.p(x0, top, "white")
    m = max(1, scaled(3 if mood == "smirk" else 2, s))
    row, left = math.floor((y + 5.5) * s), math.floor((cx + (0.5 if mood == "smirk" else 0)) * s + 0.5 - m / 2)
    px.rect(left, row, m, 1, lips)
    if s >= 0.75 and mood in ("happy", "smirk"):
        if mood == "happy":
            px.p(left - 1, row - 1, lips)
        px.p(left + m, row - 1, lips)


def snap(q, s, up=False):
    """A pose whose offsets move whole pixels at scale s, rounded down. Sideways and upward offsets
    still move at least one, so a 1px bob, step or wag shows, and up rounds them up instead; downward ones
    always round down, maybe to nothing, because the feet already sit on the frame's bottom row and a lower
    foot would lose its outline."""
    out = {}
    for k, v in q.items():
        n = math.floor(abs(v) * s)
        if v < 0 or k not in ("fl", "fr", "bl", "br", "bob"):
            if up:
                n = math.ceil(abs(v) * s - 1e-9)
            n = max(1, n) if v else 0
        out[k] = math.copysign(n, v) / s
    return out


def dog_frames(draw, poses, s, module=dogs):
    """module's draw(q) at scale s of the design grid for each pose in a tag: dogs.ROAD_SCALE for the full
    size, times the step for a depth variant. Where two poses round to the same frame (a 2px lean and a 3px
    one are both 1px at the smallest step), the bigger of the two rounds up instead, so the tag still
    moves."""
    def frame(q, up=False):
        return small(module, s, draw, snap(module.pose(q), s, up)).outlined()

    frames = [frame(q) for q in poses]
    for i in range(1, len(frames)):
        if frames[i] == frames[i - 1]:
            k = max((i - 1, i), key=lambda j: sum(abs(v) for v in poses[j].values()))
            frames[k] = frame(poses[k], up=True)
    return frames


def tip(s, rx):
    """road.tip, with its road outline and white glint; at 0.5x the coin keeps its face and rim but drops the
    stamped mark, which turns to noise."""
    g = edged(Mini(s, 16, 16))
    if rx < 1.5:
        g.rect(7, 3, 2, 10, "orange")
        g.rect(7, 3, 1, 10, "amber")
        g.p(7, 4, "white")
        return g
    g.ell(8, 8, rx, 5.5, "amber", "orange", "yellow")
    if rx > 2 and s > 0.5:
        g.rect(8, 5, 1, 6, "orange")
        g.p(7, 6, "orange")
        g.p(9, 9, "orange")
    g.p(round(8 - rx * 0.55), 5, "white")
    return g


# The colour of each letter in a hand-drawn pixel map; "." is empty.
MAP = {"n": "navy", "d": "dslate", "#": "ink", "W": "white", "l": "lgrey", "p": "pink", "P": "plum",
       "o": "ochre", "r": "rust", "t": "tan", "c": "cream", "a": "amber", "g": "green", "G": "dgreen",
       "B": "dbrown"}


def paint(g, rows, x=0, y=0):
    """Draw a pixel map on g with its top-left corner at (x, y)."""
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != ".":
                g.p(x + i, y + j, MAP[ch])


# The bone drawn by hand at the scales where a Mini merges its four knobs into a bar (the 15px @75, 13px @62
# and 10px @50 treats, at road.SCALE x 0.75, x 0.625 and x 0.5). W is the glint. Each end is two rows taller
# than the shaft above and below it, its outer corners cut, so the small bone does not read as an H or a bar.
TREAT = {
    0.9375: [".Wc.......cc.",
             "cccc.....cccc",
             "ccccccccccccc",
             "ctttttttttttt",
             ".tt.......tt."],
    0.78125: [".Wc.....cc.",
              "ccc.....ccc",
              "ccccccccccc",
              "ctttttttttt",
              ".tt.....tt."],
    0.625: [".W....c.",
            "cc....cc",
            "cccccccc",
            "cttttttt",
            ".t....t."],
}


def treat(s, lift):
    """road.treat redrawn: a bone whose knobs stick out above and below the shaft at both ends, with the road
    outline. A scale with no map takes road.treat on a Mini."""
    if s not in TREAT:
        return shrunk(s, road.treat, lift=lift)
    g = edged(Grid(scaled(16, s), scaled(16, s)))
    rows = TREAT[s]
    paint(g, rows, (g.w - len(rows[0])) // 2, (g.h - len(rows)) // 2 + lift)
    return g


def wallet(s, glint):
    """road.wallet on a Mini at scale s, with the road outline and road.WALLET_RIM."""
    return small(road, s, road.wallet, glint)


def cone(s, glint=None):
    """obstacles.cone on a Mini at scale s; it cuts its reflective bands at the drawn size. glint is the
    idle's highlight row, as in obstacles.CONE_IDLE."""
    return small(obstacles, s, obstacles.cone, glint)


def shrunk(s, draw, **q):
    """road's draw(**q) on a Mini at scale s, its offsets snapped to whole pixels as snap() has them."""
    return small(road, s, draw, **snap(q, s))


class Faceless:
    """A grid that passes every draw on to g except rects and pixels in the colours drop, so a drawing's
    face can be left off and painted at the small size instead."""

    def __init__(self, g, drop):
        self.g, self.drop = g, {K[c] for c in drop}

    def rect(self, x, y, w, h, c):
        if K[c] not in self.drop:
            self.g.rect(x, y, w, h, c)

    def p(self, x, y, c):
        if K[c] not in self.drop:
            self.g.p(x, y, c)

    def ell(self, *args):
        self.g.ell(*args)

    def tri(self, *args):
        self.g.tri(*args)


def squirrel_head(full, s, g, x, y):
    """road.squirrel_head on the Mini g without its face, then the face at the small size: scaled, the eyes
    and nose merge into one dark row. Each eye is 2 x s square, rounded, ink with a white glint at its
    top-left when it is 2px, centred where it is at full size; the plum nose fills the gap between them on
    the row under them."""
    full(Faceless(g, ("ink", "white", "plum")), x, y)
    n = max(1, scaled(2, s))
    top = math.floor((y + 0.5) * s + 0.5 - n / 2)
    left, right = (math.floor((x + d) * s + 0.5 - n / 2) for d in (-2, 2))
    for x0 in (left, right):
        g.g.rect(x0, top, n, n, "ink")
        if n > 1:
            g.g.p(x0, top, "white")
    g.g.rect(left + n, top + n, right - left - n, 1, "plum")


def squirrel(s, draw, *args, **q):
    """road's squirrel drawing draw on a Mini at scale s, with squirrel_head's face."""
    full = road.squirrel_head
    road.squirrel_head = lambda g, x, y: squirrel_head(full, s, g, x, y)
    try:
        return small(road, s, draw, *args, **snap(q, s))
    finally:
        road.squirrel_head = full


# road.skunk's face by hand where Mini loses it, as (left column, top row, rows): on the 20px @50 skunk
# (road.SCALE x 0.5) the eyes merge with the blaze, so each eye is a white glint over ink, either side of the
# 1px blaze.
SKUNK_FACE = {
    0.625: (6, 11, ["WnWnW",
                    "#nWn#"]),
}


def skunk(s, sway):
    """road.skunk on a Mini at scale s, its face from SKUNK_FACE where it has one."""
    g = shrunk(s, road.skunk, sway=sway)
    if s in SKUNK_FACE:
        x, y, rows = SKUNK_FACE[s]
        paint(g, rows, x, y)
    return g


def variants(s):
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite this file draws small, at scale s.
    road.py's sprites are drawn at road.SCALE x s, as road.py draws them at road.SCALE."""
    p = road.SCALE * s
    yield "tip", [("idle", [tip(p, rx).outlined() for rx in (5.5, 3.5, 1, 3.5)], 120)]
    yield "treat", [("idle", [treat(p, lift).outlined() for lift in (0, -1)], 400)]
    frames, ms = obstacles.CONE_IDLE
    yield "cone", [("idle", [cone(s, gl).outlined() for gl in frames], ms)]
    # the lid's lift is in full-size pixels, so it is divided by the scale to stay 1px here
    frames, ms = obstacles.BIN_IDLE
    yield "bin", [("idle", [small(obstacles, s, obstacles.bin_, a / s).outlined() for a in frames], ms)]
    frames, ms = obstacles.HYDRANT_IDLE
    yield "hydrant", [("idle", [small(obstacles, s, obstacles.hydrant, d).outlined() for d in frames], ms)]
    frames, ms = obstacles.BENCH_IDLE
    yield "bench", [("idle", [small(obstacles, s, obstacles.bench, (a[0] / s, a[1] / s) if a else a).outlined()
                              for a in frames], ms)]
    yield "skunk", [("idle", [skunk(p, v).outlined() for v in (0, 1)], 400)]
    yield "squirrel", [("idle", [squirrel(p, road.squirrel, tail=v).outlined() for v in (0, 1)], 300),
                       ("run", [squirrel(p, road.squirrel_run, k).outlined() for k in (False, True)], 120)]
    yield "other-dog", [("walk", [shrunk(p, road.corgi, **q).outlined() for q in road.CORGI_WALK], 100),
                        ("idle", [shrunk(p, road.corgi, **q).outlined() for q in road.CORGI_IDLE], 300)]
    yield "lost-wallet", [("idle", [wallet(p, gl).outlined() for gl in (False, True)], 450)]
    yield "skunk-cloud", [("loop", [road.skunk_cloud(i, s).outlined(False) for i in range(4)], 220)]


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite: variants at every step, and the
    dogs at SCALES only. The dogs are the pack, which the game draws at full size."""
    for suffix, s in STEPS:
        for key, tags in variants(s):
            yield f"{key}@{suffix}", tags
    for suffix, s in SCALES:
        for name, (draw, _) in dogs.DOGS.items():
            yield f"dog-{name}@{suffix}", [(tag, dog_frames(draw, poses, dogs.ROAD_SCALE * s), ms)
                                           for tag, poses, ms in dogs.road_tags(name)]


def originals():
    """The full-size sprites this file makes small versions of, by key."""
    out = {}
    for module in (road, obstacles, dogs):
        for key, tags in module.sprites():
            out[key] = tags
    return out


def nearest(f, s):
    """What the game's nearest-neighbour scaling shows: each screen pixel samples the source at its centre."""
    h, w = scaled(len(f), s), scaled(len(f[0]), s)
    return [[f[min(int((y + 0.5) / s), len(f) - 1)][min(int((x + 0.5) / s), len(f[0]) - 1)] for x in range(w)]
            for y in range(h)]


def compare(out, grounds=("3a4466", "c0cbdc"), scale=4, gap=4):
    """Per sprite and ground, a line of every frame at 1x, then for each scale the sprite has a
    line of nearest-neighbour beside this file's version."""
    from PIL import Image

    full = originals()
    minis = dict(sprites())
    lines = []
    for key in dict.fromkeys(k.split("@")[0] for k in minis):
        frames = [f for _, fs, _ in full[key] for f in fs]
        for ground in grounds:
            lines.append(([frames], ground))
            for suffix, s in STEPS:
                if f"{key}@{suffix}" in minis:
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
        main(sys.argv, sprites, "art/minis", __doc__, grounds=("3a4466", "c0cbdc"))
