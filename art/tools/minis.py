#!/usr/bin/env python3
"""Draw the small versions of road sprites that the pseudo-3D road shows at
each depth step below full size: STEPS, read from shared/depth-steps.json, the
table the game reads (0.875x, 0.75x, 0.625x and 0.5x). A plain nearest-
neighbour downscale drops rows and columns, so it loses up to half the 1px
outline, makes legs blink and freezes 1px bobs. These are redrawn at the small
size instead: the same drawing functions run on a grid that scales every rect,
ellipse and triangle before it rasterizes, then the small sprite gets its own
full outline. Faces are drawn at the small size (small() swaps in face_front,
squirrel() squirrel_head). road.py's sprites are drawn at road.SCALE x
the step and obstacles.py's at obstacles.SCALE x the step, as those files draw
them at full size. A Mini can also scale its rows by more than its columns
(small() takes (sx, sy)), for the vehicles that keep their lane's width and
grow taller.

<key>@<step> keeps the original's tags, frame counts and durations, and its
frame is floor(original size x scale + 0.5). At every step: tip, treat,
lost-wallet, cone, bin, hydrant, bench, skunk, squirrel, other-dog,
skunk-cloud (no outline) and dog-<name> for every dog; a dog's design grid is
drawn at dogs.road_scale(name) times the step, so a 48px dog's frame is 42x42 at @88, 36x36
at @75, 30x30 at @62 and 24x24 at @50.

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
# The steps hazards.py builds itself.
SCALES = tuple((suffix, s) for suffix, s in STEPS if s in (0.75, 0.5))


def scaled(v, s):
    """v at scale s in whole pixels, halves rounding up as the game rounds them."""
    return math.floor(v * s + 0.5)


def side(v, s):
    """A frame side v at scale s, as scaled, but with a hair to spare at a half: a scale with no exact binary
    form (1.4) can land a whole side a hair under a half, and the frame must be the size rule's."""
    return math.floor(v * s + 0.5 + 1e-9)


class Mini:
    """A Grid that takes coordinates at full size and draws them s times smaller (or bigger, above 1). sy, if
    given, scales the rows instead of s, for a drawing that grows taller than it grows wide. No shape shrinks
    to nothing: a primitive that covers no pixel sets the one at its centre. A single-pixel highlight never
    paints over a shape that has shrunk to 1px (an eye or a stud would otherwise turn into its own glint)."""

    def __init__(self, s, w=32, h=32, sy=None):
        self.s, self.sy, self.w, self.h = s, s if sy is None else sy, w, h
        self.g = Grid(side(w, s), side(h, self.sy))
        self.keep = set()

    @property
    def px(self):
        return self.g.px

    def _edge(self, v):
        return scaled(v, self.s)

    def _edge_y(self, v):
        return scaled(v, self.sy)

    def _set(self, draw, x, y, c, *args):
        before = [row[:] for row in self.g.px]
        draw(*args)
        if before == self.g.px:
            self.g.p(math.floor(x * self.s), math.floor(y * self.sy), c)
        self.keep = {(xx, yy) for xx, yy in self.keep if self.g.px[yy][xx] == before[yy][xx]}

    def p(self, x, y, c):
        x, y = math.floor((x + 0.5) * self.s), math.floor((y + 0.5) * self.sy)
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
        x0, y0, x1, y1 = self._edge(x), self._edge_y(y), self._edge(x + w), self._edge_y(y + h)
        if x1 <= x0:
            x0 = math.floor((x + w / 2) * self.s)
            x1 = x0 + 1
        if y1 <= y0:
            y0 = math.floor((y + h / 2) * self.sy)
            y1 = y0 + 1
        line, shrunk = w == 1 or h == 1, (w > 1 and x1 - x0 == 1) or (h > 1 and y1 - y0 == 1)
        if self.sy > 1 and h == 1 and y1 - y0 > 1:
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
        s, sy = self.s, self.sy
        if min(rx * s, ry * sy) < 3:
            self._set(self.g.blob, cx, cy, c, cx * s, cy * sy, rx * s, ry * sy, c, sh, li, 3)
        else:
            self._set(self.g.ell, cx, cy, c, cx * s, cy * sy, rx * s, ry * sy, c, sh, li)

    def cel(self, cx, cy, rx, ry, c, sh=None, li=None, power=2):
        """As ell, a little squarer under 3px of radius so it grows no nub at its tips."""
        s, sy = self.s, self.sy
        if min(rx * s, ry * sy) < 3:
            power = max(power, 3)
        self._set(self.g.cel, cx, cy, c, cx * s, cy * sy, rx * s, ry * sy, c, sh, li, power)

    def blob(self, cx, cy, rx, ry, c, sh=None, li=None, power=2.6):
        s, sy = self.s, self.sy
        self._set(self.g.blob, cx, cy, c, cx * s, cy * sy, rx * s, ry * sy, c, sh, li, power)

    def tri(self, a, b, c, col):
        s, sy = self.s, self.sy
        mx, my = (a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3
        self._set(self.g.tri, mx, my, col, *((x * s, y * sy) for x, y in (a, b, c)), col)

    def outlined(self, outline=True):
        return self.g.outlined(outline)


def small(module, s, draw, *args, **q):
    """Run module's draw(*args, **q) with its Grid swapped for a Mini at scale s, or (sx, sy) for one that
    scales its columns by sx and its rows by sy. Meanwhile road.rim lights the Mini's own grid, so a drawing
    that ends in rim gets the rim at the small size, and road.face_front (module's too, where it imports it)
    is face_front at scale s."""
    full, full_rim, full_face = module.Grid, road.rim, road.face_front
    faced = [m for m in {road, module} if getattr(m, "face_front", None) is full_face]
    sx, sy = s if isinstance(s, tuple) else (s, s)
    s = sx
    module.Grid = lambda w=32, h=32: Mini(sx, w, h, sy)
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


# The design column a zoomed dog grows about: its centre.
DOG_AXIS = 16


def bottom(f):
    """The last row of frame f with an opaque pixel."""
    return max(y for y, row in enumerate(f) if any(row))


def zoomed(f, s, zoom, top):
    """Frame f, drawn at s x zoom ((across, down), or one factor for both), cut to the frame side(32, s) about
    DOG_AXIS from row top, so the dog fills more of its frame."""
    zx = zoom[0] if isinstance(zoom, tuple) else zoom
    side_ = side(32, s)
    left = math.floor(DOG_AXIS * s * zx + 0.5) - math.floor(DOG_AXIS * s + 0.5)
    lost = sum(1 for y, row in enumerate(f) for x, c in enumerate(row)
               if c and not (left <= x < left + side_ and top <= y < top + side_))
    if lost:
        print(f"zoomed: {lost} pixels fall outside the {side_}px frame")
    return [row[left:left + side_] for row in f[top:top + side_]]


def dog_frames(draw, poses, s, module=dogs, zoom=1):
    """module's draw(q) at scale s of the design grid for each pose in a tag: dogs.road_scale for the full
    size, times the step for a depth variant. zoom draws the dog that much bigger in the same frame, across
    and down ((zx, zy), or one factor for both; see zoomed), for a small dog that fills more of its frame.
    Where two poses round to the same frame (a 2px lean and a 3px one are both 1px at the smallest step), the
    bigger of the two rounds up instead, so the tag still moves."""
    zx, zy = zoom if isinstance(zoom, tuple) else (zoom, zoom)
    p = (s * zx, s * zy) if zx != zy else s * zx

    def drawn(q, up=False, at=p, z=zy):
        # a zoomed dog moves as far in pixels as it would unzoomed, so its hops and spray stay in the frame
        q = {k: v if k == "glint" or isinstance(v, bool) else v / z for k, v in module.pose(q).items()}
        return small(module, at, draw, snap(q, s * z, up)).outlined()

    # zoomed, the feet of the dog standing square go one row lower than at s, onto the frame's spare bottom
    # rows, for headroom
    top = zoom != 1 and bottom(drawn({})) - bottom(drawn({}, at=s, z=1)) - 1

    def frame(q, up=False):
        f = drawn(q, up)
        return zoomed(f, s, zoom, top) if zoom != 1 else f

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


def treat(s, lift=0, glint=5):
    """road.treat on a Mini at scale s: a bone whose knobs stick out above and below the shaft at both ends,
    with the road outline."""
    return small(road, s, road.treat, glint=glint, **snap(dict(lift=lift), s))


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
    """A grid that passes every draw on to g except rects, pixels, ellipses and cel ovals in the colours drop,
    so a drawing's face can be left off and painted at the small size instead."""

    def __init__(self, g, drop):
        self.g, self.drop = g, {K[c] for c in drop}

    def rect(self, x, y, w, h, c):
        if K[c] not in self.drop:
            self.g.rect(x, y, w, h, c)

    def p(self, x, y, c):
        if K[c] not in self.drop:
            self.g.p(x, y, c)

    def ell(self, *args):
        if K[args[4]] not in self.drop:
            self.g.ell(*args)

    def cel(self, *args, **kw):
        if K[args[4]] not in self.drop:
            self.g.cel(*args, **kw)

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


def skunk(s, sway=0, blink=False):
    """road.skunk on a Mini at scale s."""
    return shrunk(s, road.skunk, sway=sway, blink=blink)


def variants(s):
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite this file draws small, at scale s.
    road.py's sprites are drawn at road.SCALE x s and obstacles.py's at obstacles.SCALE x s, as those
    files draw them at road.SCALE and obstacles.SCALE. The bin's lift and the bench's leaf are in drawn
    pixels, so they stay 1px here."""
    p, o = road.SCALE * s, obstacles.SCALE * s
    yield "tip", [("idle", [tip(p, rx).outlined() for rx in (5.5, 3.5, 1, 3.5)], 120)]
    yield "treat", [("idle", [treat(p, **q).outlined() for q in road.TREAT_IDLE], 200)]
    frames, ms = obstacles.CONE_IDLE
    yield "cone", [("idle", [cone(o, gl).outlined() for gl in frames], ms)]
    frames, ms = obstacles.BIN_IDLE
    yield "bin", [("idle", [small(obstacles, o, obstacles.bin_, a).outlined() for a in frames], ms)]
    frames, ms = obstacles.HYDRANT_IDLE
    yield "hydrant", [("idle", [small(obstacles, o, obstacles.hydrant, d).outlined() for d in frames], ms)]
    frames, ms = obstacles.BENCH_IDLE
    yield "bench", [("idle", [small(obstacles, o, obstacles.bench, a).outlined() for a in frames], ms)]
    yield "skunk", [("idle", [skunk(p, **q).outlined() for q in road.SKUNK_IDLE], 300)]
    yield "squirrel", [("idle", [squirrel(p, road.squirrel, tail=v).outlined() for v in (0, 1)], 300),
                       ("run", [squirrel(p, road.squirrel_run, k).outlined() for k in range(4)], 60)]
    yield "other-dog", [("walk", [shrunk(p, road.corgi, **q).outlined() for q in road.CORGI_WALK], 100),
                        ("idle", [shrunk(p, road.corgi, **q).outlined() for q in road.CORGI_IDLE], 300)]
    yield "lost-wallet", [("idle", [wallet(p, gl).outlined() for gl in (False, True)], 450)]
    yield "skunk-cloud", [("loop", [road.skunk_cloud(i, s).outlined(False) for i in range(4)], 220)]


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite: variants at every step, the dogs
    included."""
    for suffix, s in STEPS:
        for key, tags in variants(s):
            yield f"{key}@{suffix}", tags
    for suffix, s in STEPS:
        for name, (draw, _) in dogs.DOGS.items():
            yield f"dog-{name}@{suffix}", [(tag, dog_frames(draw, poses, dogs.road_scale(name) * s,
                                                            zoom=dogs.DOG_ZOOM.get(name, 1)), ms)
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
        main(sys.argv, sprites, "art/minis", __doc__, grounds=("3a4466", "c0cbdc"), originals=originals)
