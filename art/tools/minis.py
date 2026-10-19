#!/usr/bin/env python3
"""Draw the small versions of road sprites that the pseudo-3D road shows at
0.75x and 0.5x. A plain nearest-neighbour downscale keeps every other pixel
(0.5x) or drops every fourth (0.75x), so it loses half the 1px outline, makes
legs blink and freezes 1px bobs. These are redrawn at the small size instead:
the same drawing functions run on a grid that scales every rect, ellipse and
triangle before it rasterizes, then the small sprite gets its own full outline.
Where that still loses a feature (the treat's knobs, the wallet's clasp and
glint, the faces of the skunk, squirrel and other dog), the sprite is a
hand-drawn pixel map instead.

<key>@75 and <key>@50 keep the original's tags, frame counts and durations,
and their frames are round(original size x scale):

tip@75, treat@75                    12x12
tip@50, treat@50                    8x8
cone@75, bin@75, hydrant@75         24x24
cone@50, bin@50, hydrant@50         16x16
bench@75                            66x18
bench@50                            44x12
dog-<name>@75 (all nine dogs)       24x24
dog-<name>@50                       16x16
lost-wallet@75                      12x12
lost-wallet@50                      8x8
skunk@75                            24x24
skunk@50, other-dog@50, squirrel@50 16x16
skunk-cloud@50 (no outline)         44x44

Usage:
  minis.py preview OUT.png   every small frame on the street colours
  minis.py compare OUT.png   each sprite at 1x, then plain nearest-neighbour and
                             this file's version at each scale it has, at 4x zoom
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
from pixel import Grid, edged, main, road_sprite  # noqa: E402

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


def dog_frames(draw, poses, s):
    """dogs' draw(q) at scale s for each pose in a tag. Where two poses round to the same frame (a 2px lean
    and a 3px one are both 1px at 0.5x), the bigger of the two rounds up instead, so the tag still moves."""
    def frame(q, up=False):
        return small(dogs, s, draw, snap(dogs.pose(q), s, up)).outlined()

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


# The bone drawn by hand: scaled, its four knobs merge unevenly. W is the glint. Each end is rounded, its
# outer corners cut, so the small bone does not read as an H.
TREAT = {
    0.75: [".Wc....cc.",
           "cccccccccc",
           "cttttttttt",
           ".tt....tt."],
    0.5: [".W..c.",
          "cccccc",
          "cttttt",
          ".t..t."],
}


def treat(s, lift):
    """road.treat redrawn: a bone whose knobs stick out above and below the shaft at both ends, with the road
    outline."""
    g = edged(Grid(round(16 * s), round(16 * s)))
    paint(g, TREAT[s], 1, g.h // 2 - 2 + lift)
    return g


# road.wallet by hand, as (body, glint): the bill peeking out over the flap, the tan flap edge, the plum seam
# and the amber clasp. Scaled, the seam and the clasp merge and the 5px glint turns to a blob; here the glint
# is a 3px cross at 0.75x and 1px at 0.5x.
WALLET = {
    0.75: (["............",
            "............",
            "............",
            "...GGGGG....",
            "...ggGgg....",
            "..tttttttt..",
            "..BBBBBBBB..",
            "..PPPPPPaB..",
            "..BBBBBBaB..",
            "..BBBBBBBB.."],
           [(9, 1), (8, 2), (10, 2), (9, 3), (9, 2)]),
    0.5: (["........",
           "........",
           "..gGg...",
           ".ttttt..",
           ".BBBBB..",
           ".PPPPa..",
           ".BBBBB.."],
          [(6, 1)]),
}


def wallet(s, glint):
    """road.wallet redrawn, with the road outline and road.WALLET_RIM."""
    g = edged(Grid(round(16 * s), round(16 * s)))
    body, sparkle = WALLET[s]
    paint(g, body)
    if glint:
        for x, y in sparkle:
            g.p(x, y, "white")
    return road.rim(g, road.WALLET_RIM)


def cone(s, glint=None):
    """obstacles.cone with its two reflective bands cut at the small size; glint is the idle's
    highlight row, as in obstacles.CONE_IDLE."""
    g = edged(Mini(s))
    g.rect(7, 25, 18, 4, "grey")
    g.rect(7, 25, 18, 1, "lgrey")
    g.tri((9, 26), (23, 26), (16, 6), "orange")
    g.tri((16, 26), (23, 26), (16, 6), "rust")
    mid = round(16 * s)
    for y in (12, 19):
        yy = g._edge(y)
        for x in range(g.g.w):
            if g.px[yy][x] in ("f77622", "be4a2f"):
                g.g.p(x, yy, "white" if x < mid else "lgrey")
                if s > 0.5:
                    g.g.p(x, yy + 1, "white" if x < mid else "lgrey")
    # the highlight stays just left of the centre line, where it is at full size
    g.g.rect(mid - 1, g._edge(7), 1, g._edge(11) - g._edge(7), "amber")
    if glint is not None:
        g.g.p(mid - 1, g._edge(glint), "white")
    return g


# road.skunk by hand, as (top row, map) for the tail, which sways, and for the body and head drawn over it.
# Scaled, the stripe breaks where the head starts and the right eye sinks into the ink shading. At 0.5x
# the stripe is 1px and each eye is a glint over ink, since ink alone does not show on navy.
SKUNK = {
    0.75: ((2, [".........ddnnnn.........",
                "........ddnWWnnn........",
                ".......ddnWWWWnnn.......",
                ".......dnnWWWWlnn.......",
                ".......nnnWWWlln#.......",
                ".......nnnnWlln##.......",
                ".......nnnnWlnn##.......",
                "........nnnnn###........"]),
           (10, [".........ddWlnn.........",
                 "........ddnWlnnn........",
                 ".......ddnnWlnnnn.......",
                 ".......nnnnWlnnnn.......",
                 ".......nnnnWlnn##.......",
                 ".......nnnnWlnn##.......",
                 ".......nnddWWnn##.......",
                 "........dnnWWnnn........",
                 "........nW#nnW#n........",
                 "........n##nn##n........",
                 "........nnnppn##........",
                 "..........nn##.........."])),
    0.5: ((1, ["......dnnn......",
               ".....ddWWnn.....",
               "....ddWWWlnn....",
               "....dnWWWlnn....",
               "....nnnWlnn#....",
               ".....nnnnn##...."]),
          (7, [".....dnWnnn.....",
               "....dnnWnnnn....",
               "....nnnWnnn#....",
               ".....dnnnnn.....",
               ".....nWnnWn.....",
               ".....n#nn#n.....",
               ".....nnppn#.....",
               "......nn##......"])),
}


def skunk(s, sway):
    """road.skunk redrawn: the tail moves a whole pixel. The road outline and road.LIT's rim, as at full size."""
    g = edged(Grid(round(32 * s), round(32 * s)))
    (tail_y, tail), (body_y, body) = SKUNK[s]
    paint(g, tail, sway, tail_y)
    paint(g, body, 0, body_y)
    return road.rim(g, road.LIT)


# road.squirrel at 0.5x by hand: the tail, which swishes, and the body and head drawn over it, which shift.
# Scaled, the eyes and nose merge into one dark row. The eyes are 1px of ink, the nose 2px of plum on the muzzle.
SQUIRREL = ((1, ["......tooo......",
                 "......ooooro....",
                 "......oorroo....",
                 ".......tottoo...",
                 ".......tottor...",
                 ".......oottor...",
                 ".......oottrr...",
                 "........ottr....",
                 "........orrr...."]),
            (8, [".....tooo.......",
                 ".....occo.......",
                 ".....occo.......",
                 "....toooor......",
                 "....o#oo#r......",
                 "....ocPPcr......",
                 ".....occr......."]))


def squirrel(tail, shift):
    """road.squirrel(tail, shift) at 0.5x: each offset moves a whole pixel. The road outline and road.LIT's rim."""
    g = edged(Grid(16, 16))
    (tail_y, tail_rows), (body_y, body) = SQUIRREL
    paint(g, tail_rows, tail, tail_y)
    paint(g, body, shift, body_y)
    return road.rim(g, road.LIT)


# road.squirrel_run at 0.5x by hand, stretched then gathered, from row 1. Scaled, the gathered face turns to
# glints over ink; here both keep the idle's face, and the gathered squirrel is 1px higher, in the air.
SQUIRREL_RUN = (["......oooo......",
                 "......ooro......",
                 "......ttto......",
                 "......ottor.....",
                 "......ottr......",
                 "......ottr......",
                 ".....rtoorr.....",
                 "......oco.......",
                 "......oco.......",
                 "......ocr.......",
                 ".....toooor.....",
                 ".....o#oo#r.....",
                 "....tocPPcrt....",
                 "......occr......"],
                ["......oooo......",
                 "......orrooo....",
                 ".......totoo....",
                 ".......ootor....",
                 ".......ootrr....",
                 ".......ootr.....",
                 ".....toooor.....",
                 ".....occcor.....",
                 "....roccccrr....",
                 ".....toooor.....",
                 ".....o#oo#r.....",
                 ".....ocPPcr.....",
                 "......occr......"])


def squirrel_run(gather):
    """road.squirrel_run(gather) at 0.5x, with the road outline and road.LIT's rim."""
    g = edged(Grid(16, 16))
    paint(g, SQUIRREL_RUN[gather], 0, 1)
    return road.rim(g, road.LIT)


# road.corgi at 0.5x by hand. Scaled, the collar breaks, one ear loses its pink and the 1px nose sits off
# centre; here the blaze and nose are 2px on the centre line.
CORGI = ["......tooo......",
         ".....tooooo.....",
         ".....oooooo.....",
         ".....ooooor.....",
         "....ooWWWWro....",
         "....opWWWlpo....",
         ".....aaaaaa.....",
         ".....toWWoo.....",
         ".....o#oo#r.....",
         ".....oW##Wr.....",
         ".....oWWllr....."]


def corgi(fl=0, fr=0, bl=0, br=0, bob=0, tail=0, twitch=0):
    """road.corgi at 0.5x, posed as in road.CORGI_WALK and road.CORGI_IDLE: a hind paw swung back peeks out
    beside the rump and a front paw reaching forward shows under the jaw. On the passing beats the body bobs
    up 1px and both front paws show under it, planted. The 2px tail over the rump moves a whole pixel with
    tail, and twitch lifts the right ear's tip 1px. The road outline and road.LIT's rim."""
    g = edged(Grid(16, 16))
    g.rect(7 + int(tail), 2 + bob, 2, 1, "ochre")
    paint(g, CORGI, 0, 3 + bob)
    if twitch:
        g.p(11, 6 + bob, "ochre")
        g.p(11, 8 + bob, None)
    for x, back in ((5, bl < 0), (10, br < 0)):
        if back:
            g.p(x, 3, "ochre")
    for x, paw, c in ((5, fl, "white"), (10, fr, "lgrey")):
        if paw > 0 or bob:
            g.p(x, 14 + bob, c)
    return road.rim(g, road.LIT)


def skunk_cloud(s, step):
    """road.skunk_cloud redrawn at its own size. The full-size fill is a dither on every other row, which
    nearest-neighbour at 0.5x skips entirely, so the same dither is laid on the small grid instead. The rim
    keeps both of its pixels, teal outside for the light roads and green inside it for Woof Way; the stink
    wisps are half as long, and a swelling puff still grows by a whole pixel. A puff near the frame's edge is
    trimmed so that, swollen, it still stops a pixel short of it."""
    n = round(88 * s)
    g = Grid(n, n)
    k = road.CLOUD_SQUASH
    puffs = []
    for i, (cx, cy, r) in enumerate(road.CLOUD_PUFFS):
        cx, cy = cx * s, cy * s
        r = min(r * s, cx - 1.6, n - cx - 1.6, (cy - 1.6) / k, (n - cy - 1.6) / k)
        puffs.append((cx, cy, r + (1 if (i + step) % 4 == 0 else 0)))
    # how far inside the nearest puff each pixel is, in pixels across
    depth = [[max(r - ((x + 0.5 - cx) ** 2 + ((y + 0.5 - cy) / k) ** 2) ** 0.5 for cx, cy, r in puffs)
              for x in range(n)] for y in range(n)]

    def inside(x, y):
        return 0 <= x < n and 0 <= y < n and depth[y][x] >= 0

    def beside(x, y, test):
        return any(test(x + dx, y + dy) for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)))

    outer = {(x, y) for y in range(n) for x in range(n) if inside(x, y) and beside(x, y, lambda a, b: not inside(a, b))}
    for y in range(n):
        for x in range(n):
            if not inside(x, y):
                continue
            if (x, y) in outer:
                g.p(x, y, "teal")
            elif depth[y][x] < 2 or beside(x, y, lambda a, b: (a, b) in outer):
                g.p(x, y, "green")
            elif x % 2 == (y // 2 + step) % 2 and y % 2 == 0:
                g.p(x, y, "green" if (x + y) % 8 else "dgreen")
    for x0, y0 in road.CLOUD_WISPS:
        for j in range(round(6 * s)):
            g.p(x0 * s + (j + step) % 3 - 1, y0 * s + j, "dgreen")
    return g


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    for suffix, s in SCALES:
        yield f"tip@{suffix}", [("idle", [tip(s, rx).outlined() for rx in (5.5, 3.5, 1, 3.5)], 120)]
        yield f"treat@{suffix}", [("idle", [treat(s, lift).outlined() for lift in (0, -1)], 400)]
        frames, ms = obstacles.CONE_IDLE
        yield f"cone@{suffix}", [("idle", [cone(s, gl).outlined() for gl in frames], ms)]
        # the lid's lift is in full-size pixels, so it is divided by the scale to stay 1px here
        frames, ms = obstacles.BIN_IDLE
        yield f"bin@{suffix}", [("idle", [small(obstacles, s, obstacles.bin_, a / s).outlined() for a in frames], ms)]
        frames, ms = obstacles.HYDRANT_IDLE
        yield f"hydrant@{suffix}", [("idle", [small(obstacles, s, obstacles.hydrant, d).outlined() for d in frames], ms)]
        frames, ms = obstacles.BENCH_IDLE
        yield f"bench@{suffix}", [("idle", [small(obstacles, s, obstacles.bench, (a[0] / s, a[1] / s) if a else a).outlined()
                                            for a in frames], ms)]
        for name, (draw, _) in dogs.DOGS.items():
            yield f"dog-{name}@{suffix}", [(tag, dog_frames(draw, poses, s), ms) for tag, poses, ms in dogs.ROAD_TAGS]
        yield f"skunk@{suffix}", [("idle", [skunk(s, sway).outlined() for sway in (0, 1)], 400)]
        yield f"lost-wallet@{suffix}", [("idle", [wallet(s, gl).outlined() for gl in (False, True)], 450)]
    yield "skunk-cloud@50", [("loop", [skunk_cloud(0.5, i).outlined(False) for i in range(4)], 220)]
    yield "other-dog@50", [("walk", [corgi(**q).outlined() for q in road.CORGI_WALK], 100),
                           ("idle", [corgi(**q).outlined() for q in road.CORGI_IDLE], 300)]
    yield "squirrel@50", [("idle", [squirrel(0, 0).outlined(), squirrel(1, 0).outlined()], 300),
                          ("run", [squirrel_run(k).outlined() for k in (0, 1)], 120)]


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
            for suffix, s in SCALES:
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
        main(sys.argv, sprites, "art/minis", __doc__, grounds=("3a4466", "c0cbdc"), anchored=road_sprite)
