"""Shared pixel-art tooling: a drawing grid on the house palette with coloured outlines,
and the step that turns frames into an Aseprite source and a PNG + JSON export.
Run the art scripts from the repository root.

Usage:
  pixel.py palette   write shared/palette.json: every colour by K name, its hex and the name of
                     the colour one ramp step darker (DARKER), for the game's dark ramp
"""

import json
import math
import os
import subprocess
import sys
import tempfile

# Endesga 32, by role.
K = dict(
    rust="be4a2f", ochre="d77643", cream="ead4aa", tan="e4a672", brown="b86f50", dbrown="733e39", plum="3e2731",
    dred="a22633", red="e43b44", orange="f77622", amber="feae34", yellow="fee761", green="63c74d", dgreen="3e8948",
    forest="265c42", teal="193c3e", blue="124e89", sky="0099db", cyan="2ce8f5", white="ffffff", lgrey="c0cbdc",
    grey="8b9bb4", slate="5a6988", dslate="3a4466", navy="262b44", ink="181425", hot="ff0044", purple="68386c",
    mauve="b55088", pink="f6757a", skin1="e8b796", skin2="c28569",
)
PALETTE = list(K.values())
DARKER = dict(p.split(":") for p in (
    "be4a2f:733e39 d77643:be4a2f ead4aa:e4a672 e4a672:b86f50 b86f50:733e39 733e39:3e2731 3e2731:181425 "
    "a22633:3e2731 e43b44:a22633 f77622:be4a2f feae34:f77622 fee761:feae34 63c74d:3e8948 3e8948:265c42 "
    "265c42:193c3e 193c3e:181425 124e89:262b44 0099db:124e89 2ce8f5:0099db ffffff:c0cbdc c0cbdc:8b9bb4 "
    "8b9bb4:5a6988 5a6988:3a4466 3a4466:262b44 262b44:181425 181425:181425 ff0044:a22633 68386c:3e2731 "
    "b55088:68386c f6757a:b55088 e8b796:c28569 c28569:b86f50"
).split())
# The neutral greys, outside Endesga 32 and allowed only for disabled and locked UI (a disabled tile,
# button, slider or knob, a locked item's well): the neutral counterparts of lgrey, grey, slate and
# dslate. Ink stays the darkest step.
NEUTRAL = dict(nlgrey="d8d8d8", ngrey="a4a4a4", nslate="727272", ndslate="4a4a4a")
K.update(NEUTRAL)
DARKER.update({"d8d8d8": "a4a4a4", "a4a4a4": "727272", "727272": "4a4a4a", "4a4a4a": "181425"})
# The Toronto colours, 32 past Endesga 32 for the Toronto neighbourhoods' scenery, roads, verges and
# skies, in ramps that end on an Endesga colour: canopy and olive greens, brick and warm browns,
# warm stones and dark slates for shaded laneways, TTC red, Kensington's painted-house brights, lake
# blues and sky tones. Endesga 32 plus these is the 64-colour house palette.
TORONTO = dict(
    moss="9cb04a", olive="6b8a35", dolive="445a26", canopy="357a2f", pine="1e4d2b", fir="11301c",
    brick="8e3b2b", dbrick="5e2620", clay="9a6a4a", bark="523a2c", walnut="2e2019", driftwood="a99c86",
    stone="8a857c", dstone="625e58", ash="57606a", shale="353b45", coal="26292f", ttc="da291c",
    turquoise="35c2a6", dturq="1f8a7a", lilac="a77bd9", violet="6d4bb0", lime="b2d94a", foam="a8e0e6",
    shallow="58b8c9", lake="2f7fa6", dlake="1d5576", gold="f9c74f", peach="ff9e6b", haze="cfe3ea",
    azure="3d86e0", cobalt="2654b0",
)
K.update(TORONTO)
PALETTE64 = PALETTE + list(TORONTO.values())
DARKER.update(dict(p.split(":") for p in (
    "9cb04a:6b8a35 6b8a35:445a26 445a26:11301c 357a2f:1e4d2b 1e4d2b:11301c 11301c:181425 "
    "8e3b2b:5e2620 5e2620:2e2019 9a6a4a:523a2c 523a2c:2e2019 2e2019:181425 a99c86:8a857c "
    "8a857c:625e58 625e58:26292f 57606a:353b45 353b45:26292f 26292f:181425 da291c:a22633 "
    "35c2a6:1f8a7a 1f8a7a:193c3e a77bd9:6d4bb0 6d4bb0:68386c b2d94a:63c74d a8e0e6:58b8c9 "
    "58b8c9:2f7fa6 2f7fa6:1d5576 1d5576:262b44 f9c74f:feae34 ff9e6b:f77622 cfe3ea:c0cbdc "
    "3d86e0:2654b0 2654b0:124e89"
).split()))
# The contrast roads: dslate (dark, the Distillery District's), then the roads an outline must hold 3:1 on: tan,
# pink and skin2 (light) and Kensington Market's stone (mid grey), which takes it nearly to ink.
ROADS = ("3a4466", "e4a672", "f6757a", "c28569", "8a857c")
# The zone roads, the preview grounds when a set names none: Cabbagetown's grey, High Park's tan, the
# Distillery District's dslate, Kensington Market's stone, The Beaches' cream and Yonge Street's shale.
ZONE_ROADS = ("8b9bb4", "e4a672", "3a4466", "8a857c", "ead4aa", "353b45")


def contrast(a, b):
    """WCAG contrast ratio of two hex colours."""
    def lum(c):
        v = [int(c[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        v = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in v]
        return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]

    la, lb = lum(K.get(a, a)), lum(K.get(b, b))
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


# The Kensington Market murals' diagonal colour bands, shared by the backdrop, its zone card and the mural
# wall prop.
MURAL = ("dred", "ochre", "olive", "dturq", "violet", "mauve")


def dk(c):
    """The colour one ramp step darker than c, a K name or hex."""
    return DARKER[K.get(c, c)]


def raster(g):
    """The grid that holds g's pixels: a minis.Mini's drawn grid, or g."""
    return getattr(g, "g", g)


def scale_of(g):
    """The scale g draws the design grid at: a minis.Mini's s, 1 for a plain Grid."""
    return getattr(g, "s", 1)


def road_edge(c):
    """A road sprite's outline for fill c: two ramp steps darker, then on down the ramp until it holds 3:1
    against the light roads and the stone road (ROADS[1:]). The fill inside it carries the dslate road."""
    out = DARKER[DARKER[c]]
    while DARKER[out] != out and any(contrast(out, r) < 3 for r in ROADS[1:]):
        out = DARKER[out]
    return out


class Grid:
    # edge(fill) gives the outline colour beside fill; None keeps two ramp steps darker
    edge = None
    # close draws the outline along the bottom row too, where the frame cuts a bust or a seated dog
    close = False

    def __init__(self, w=32, h=32):
        self.w, self.h = w, h
        self.px = [[None] * w for _ in range(h)]

    def p(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = K.get(c, c) if c else None

    def rect(self, x, y, w, h, c):
        for j in range(h):
            for i in range(w):
                self.p(x + i, y + j, c)

    def ell(self, cx, cy, rx, ry, c, sh=None, li=None):
        """Filled ellipse, shaded from a top-left light: sh on the lower-right rim, li on the upper-left."""
        for y in range(self.h):
            for x in range(self.w):
                dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1:
                    d = 0.7 * (dx + dy)
                    self.p(x, y, sh if sh and d > 0.5 else li if li and d < -0.72 else c)

    def blob(self, cx, cy, rx, ry, c, sh=None, li=None, power=2.6):
        """A squarer oval (superellipse): rounded, but fuller at the top and sides than ell."""
        for y in range(self.h):
            for x in range(self.w):
                dx, dy = abs(x + 0.5 - cx) / rx, abs(y + 0.5 - cy) / ry
                if dx ** power + dy ** power <= 1:
                    d = 0.7 * ((x + 0.5 - cx) / rx + (y + 0.5 - cy) / ry)
                    self.p(x, y, sh if sh and d > 0.5 else li if li and d < -0.72 else c)

    def cel(self, cx, cy, rx, ry, c, sh=None, li=None, power=2):
        """Filled oval (squarer at power above 2), cel shaded from a top-left light: sh a crescent along the
        lower-right rim and li a thinner one along the upper-left, each following the outline, where ell
        cuts a straight diagonal plane."""
        def inside(x, y, o=0.0):
            dx, dy = abs(x + 0.5 - cx - o) / rx, abs(y + 0.5 - cy - o) / ry
            return dx ** power + dy ** power <= 1

        shade_w, light_w = max(1, 0.13 * (rx + ry)), max(1, 0.06 * (rx + ry))
        for y in range(self.h):
            for x in range(self.w):
                if not inside(x, y):
                    continue
                lit = (x + 0.5 - cx) / rx + (y + 0.5 - cy) / ry < -0.7
                self.p(x, y, sh if sh and not inside(x, y, -shade_w)
                       else li if li and lit and not inside(x, y, light_w) else c)

    def tri(self, a, b, c, col):
        def side(px, py, x1, y1, x2, y2):
            return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2)

        for y in range(self.h):
            for x in range(self.w):
                px, py = x + 0.5, y + 0.5
                d1, d2, d3 = side(px, py, *a, *b), side(px, py, *b, *c), side(px, py, *c, *a)
                if not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0)):
                    self.p(x, y, col)

    def outlined(self, outline=True):
        """Coloured outline: each empty pixel touching the sprite takes the colour two ramp steps darker,
        or edge(fill) when the grid has an edge rule."""
        out = [row[:] for row in self.px]
        if not outline:
            return out
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x]:
                    continue
                for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < self.w and 0 <= yy < self.h and self.px[yy][xx]:
                        c = self.px[yy][xx]
                        out[y][x] = self.edge(c) if self.edge else DARKER[DARKER[c]]
                        break
        if self.close:
            y = self.h - 1
            for x in range(self.w):
                if self.px[y][x]:
                    c = self.px[y][x]
                    out[y][x] = self.edge(c) if self.edge else DARKER[DARKER[c]]
        return out


def icon_edge(c):
    """An icon's outline for fill c: two ramp steps darker, then on down the ramp until it holds 3:1 on
    cream and tan."""
    out = DARKER[DARKER[c]]
    while DARKER[out] != out and min(contrast(out, "cream"), contrast(out, "tan")) < 3:
        out = DARKER[out]
    return out


def edged(g, edge=road_edge, close=False):
    """Give g an outline rule (road_edge unless told otherwise) and return it. edge is a function of the
    fill, or a colour name for one line round every fill. close runs the line along the bottom row. A grid
    that draws onto an inner Grid (minis.Mini keeps it as g.g) passes the rule on, so the small versions
    keep it."""
    if isinstance(edge, str):
        line = K.get(edge, edge)
        edge = lambda c: line  # noqa: E731
    inner = raster(g)
    inner.edge, inner.close = edge, close
    return g


def hairline(g, hair, skin, line):
    """Recolour to line every hair pixel with skin directly below it: the hair's lower edge, where a fill close
    to the skin's tone would otherwise run into the face. On a minis.Mini it is 1px of the drawn grid."""
    px = raster(g)
    hair, skin = K[hair], K[skin]
    edge = [(x, y) for y in range(px.h - 1) for x in range(px.w) if px.px[y][x] == hair and px.px[y + 1][x] == skin]
    for x, y in edge:
        px.p(x, y, line)


# The 7x6 heart the UI, the badges, the fonts' drawn ♥ and scene.py's callout hearts share.
HEART = [".11.11.", "1111111", "1111111", ".11111.", "..111..", "...1..."]


def bitmap(g, x0, y0, rows, cols, mirror=False):
    """Stamp a character map at (x0, y0): each character in cols is a colour, any other is left clear;
    mirror flips it left to right."""
    for y, row in enumerate(rows):
        for x, ch in enumerate(row[::-1] if mirror else row):
            if ch in cols:
                g.p(x0 + x, y0 + y, cols[ch])


def to_image(px):
    """Frame rows of hex colours (None where clear) as an RGBA image."""
    from PIL import Image

    im = Image.new("RGBA", (len(px[0]), len(px)), (0, 0, 0, 0))
    for y, row in enumerate(px):
        for x, c in enumerate(row):
            if c:
                im.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,))
    return im


def preview(sprites, out, grounds=ZONE_ROADS, scale=6, gap=4):
    """Contact sheet: one row per sprite and ground colour, every frame in tag order."""
    from PIL import Image

    rows = []
    for _, tags in sprites:
        frames = [f for _, fs, _ in tags for f in fs]
        for ground in grounds:
            rows.append((frames, ground))
    cell_w = max(len(f[0][0]) for f, _ in rows) + gap
    cell_h = [len(f[0]) + gap for f, _ in rows]
    width = max(len(f) for f, _ in rows) * cell_w * scale
    img = Image.new("RGB", (width, sum(cell_h) * scale), (24, 20, 37))
    y0 = 0
    for (frames, ground), ch in zip(rows, cell_h):
        for i, f in enumerate(frames):
            for y, row in enumerate(f):
                for x, c in enumerate(row):
                    c = c or ground
                    rgb = tuple(int(c[k:k + 2], 16) for k in (0, 2, 4))
                    img.paste(rgb, ((i * cell_w + x) * scale, (y0 + y) * scale,
                                    (i * cell_w + x + 1) * scale, (y0 + y + 1) * scale))
        y0 += ch
    img.save(out)


LUA = """
local spr = Sprite({w}, {h}, ColorMode.RGB)
local pal = Palette({ncolours})
{palette}
spr:setPalette(pal)
local rgba = app.pixelColor.rgba
local frames = {frames}
local durations = {durations}
for i, px in ipairs(frames) do
  if i > 1 then spr:newFrame() end
  local img = spr.layers[1]:cel(i).image
  img:clear()
  for _, p in ipairs(px) do img:drawPixel(p[1], p[2], rgba(p[3], p[4], p[5], 255)) end
  spr.frames[i].duration = durations[i]
end
{tags}
spr:saveAs("{out}")
"""


def _lua(tags, out):
    frames, durations, tag_lines, n = [], [], [], 0
    h, w = len(tags[0][1][0]), len(tags[0][1][0][0])
    for tag, fs, ms in tags:
        tag_lines.append(f'do local t = spr:newTag({n + 1}, {n + len(fs)}); t.name = "{tag}" end')
        # ms is the tag's frame duration, or a list with one duration per frame
        for f, d in zip(fs, ms if isinstance(ms, (list, tuple)) else [ms] * len(fs)):
            pts = []
            for y, row in enumerate(f):
                for x, c in enumerate(row):
                    if c:
                        pts.append("{%d,%d,%d,%d,%d}" % (x, y, int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)))
            frames.append("{" + ",".join(pts) + "}")
            durations.append(str(d / 1000))
        n += len(fs)
    # A sprite drawn in the neutral greys or the Toronto colours carries them after Endesga 32 in its
    # palette.
    used = {c for _, fs, _ in tags for f in fs for row in f for c in row if c}
    colours = (PALETTE + (list(NEUTRAL.values()) if used & set(NEUTRAL.values()) else [])
               + (list(TORONTO.values()) if used & set(TORONTO.values()) else []))
    palette = "\n".join(
        f"pal:setColor({i}, Color{{ r = {int(c[0:2], 16)}, g = {int(c[2:4], 16)}, b = {int(c[4:6], 16)} }})"
        for i, c in enumerate(colours)
    )
    return LUA.format(w=w, h=h, ncolours=len(colours), palette=palette, frames="{" + ",\n".join(frames) + "}",
                      durations="{" + ",".join(durations) + "}", tags="\n".join(tag_lines), out=out)


def depth_scales():
    """{suffix: scale} for every depth step below full size in shared/depth-steps.json, the table the game
    reads: {"@94": 0.9375, "@88": 0.875, ...}."""
    with open(os.path.join(os.path.dirname(__file__), "..", "..", "shared", "depth-steps.json")) as f:
        return {q["suffix"]: q["scale"] for q in json.load(f)["steps"] if q["scale"] < 1}


def opaque_rows(frames):
    """The first and last row with an opaque pixel in any of frames, or None when all are blank."""
    rows = [y for f in frames for y, row in enumerate(f) if any(row)]
    return (min(rows), max(rows)) if rows else None


def _exported(key):
    """public/art/sprites/<key>'s frame 0 as rows of colours (None where clear), or None if it is not
    exported."""
    from PIL import Image

    path = f"public/art/sprites/{key}"
    if not os.path.exists(path + ".json"):
        return None
    with open(path + ".json") as f:
        r = next(iter(json.load(f)["frames"].values()))["frame"]
    img = Image.open(path + ".png").convert("RGBA")
    return [[("%02x%02x%02x" % px[:3]) if px[3] else None
             for px in (img.getpixel((r["x"] + x, r["y"] + y)) for x in range(r["w"]))] for y in range(r["h"])]


def shifted(tags, dy):
    """tags with every frame moved dy rows down (up when negative) in its frame."""
    def move(f):
        blank = [[None] * len(f[0]) for _ in range(abs(dy))]
        return blank + f[:len(f) - dy] if dy > 0 else f[-dy:] + blank if dy < 0 else f

    return [(tag, [move(f) for f in fs], ms) for tag, fs, ms in tags]


def seated(key, tags, feet):
    """A depth variant's tags moved so frame 0's last opaque row, the feet row the game measures, is feet,
    or the frame's bottom row when that is past it. Every frame moves together, and never so far that it
    clips an opaque pixel: art taller than the rows above its feet row first loses the rows that change it
    least, and art reaching further below frame 0's feet than the rows under the feet row loses the rows
    that change it least down there (see _without_rows)."""
    frames = [f for _, fs, _ in tags for f in fs]
    h = len(frames[0])

    def placed():
        return min(feet, h - 1) - (opaque_rows([frames[0]]) or (0, h - 1))[1], *opaque_rows(frames)

    dy, top, bottom = placed()
    if bottom + dy > h - 1:
        frames = _without_rows(frames, bottom + dy - (h - 1), below=(opaque_rows([frames[0]]) or (0, h - 1))[1])
        tags = _regrouped(tags, frames)
        dy, top, bottom = placed()
    if top + dy < 0:
        frames = _without_rows(frames, -(top + dy))
        tags = _regrouped(tags, frames)
        dy, top, bottom = placed()
    if dy and not 0 <= top + dy <= bottom + dy <= h - 1:
        print(f"{key}: cannot move {dy} rows to its feet row without clipping")
        return tags
    return shifted(tags, dy)


def depth_envelope(w, h, scales):
    """{scale: (width, height)}: the most art each of a w x h sprite's depth steps (scales) may fill. The
    game sizes a road sprite by its frame's larger side, an integer, and draws it from the smallest step at
    least that size (src/layout/depthScale.ts), so one pixel past a step's side it draws a larger step
    scaled down to it. A frame, floor(side x scale + 0.5), can round its shorter side past that. So each
    step's art keeps to the full size scaled to its own side plus one, rounded down, and to the next larger
    step's art, so no step is bigger than a larger one."""
    out, art = {}, (w, h)
    for s in sorted(scales, reverse=True):
        fw, fh = math.floor(w * s + 0.5), math.floor(h * s + 0.5)
        k = (max(fw, fh) + 1) / max(w, h)
        art = (min(fw, art[0], math.floor(w * k + 1e-9)), min(fh, art[1], math.floor(h * k + 1e-9)))
        out[s] = art
    return out


class _Lined(str):
    """A fill pixel a cut left on the rim (see _without_rows): it compares as its fill, so the cuts after it
    are chosen as if it were not there, and it is drawn in line, the outline colour beside it."""

    def __new__(cls, fill, line):
        out = super().__new__(cls, fill)
        out.line = line
        return out


def _shown(c):
    """The colour pixel c is drawn in (see _Lined)."""
    return getattr(c, "line", c)


def _opened(frames, r):
    """The pixels that taking row r out of frames leaves newly touching a clear one across the cut and that
    are not outline pixels, as (frame, row, column, the outline colour the cut takes from beside it). An
    outline pixel is one already on the art's rim, or one the colour of that outline pixel, so the outline
    carries on. A pixel is left as it is where drawing it in the outline colour would take a feature out: one
    of a colour none of its other neighbours has (a sparkle's centre, an eye), or one with that outline
    colour behind it, the last fill across a part 1px thin. Rows r - 1 and r + 1 meet at the cut, and
    nothing else moves relative to its neighbours."""
    h, out = len(frames[0]), []
    for i, f in enumerate(frames):
        w = len(f[0])
        above, cut, under = f[r - 1] if r > 0 else None, f[r], f[r + 1] if r + 1 < h else None
        for x in range(w):
            a, b = above and above[x], under and under[x]
            if bool(a) == bool(b) or not cut[x]:
                continue
            y, c, away = (r - 1, a, r - 2) if a else (r + 1, b, r + 2)
            line = _shown(cut[x])
            if _shown(c) == line or x in (0, w - 1) or not (f[y][x - 1] and f[y][x + 1]):
                continue
            if not (0 <= away < h and f[away][x]):
                continue
            if _shown(f[away][x]) == line or _shown(c) not in {_shown(f[y][x - 1]), _shown(f[y][x + 1]),
                                                                 _shown(f[away][x])}:
                continue
            out.append((i, y, x, line))
    return out


def _without_rows(frames, n, first=False, below=None, picks=()):
    """frames with n rows taken out from inside their opaque bounds (frame 0's when first), or from the rows
    past row below to their last opaque row, then as many clear rows added on top. Each goes where the art
    changes least: the row most like the one above it in every frame and crossing the fewest features 2 rows
    thin or less, in the longest run of equal rows, nearest the middle. picks, when given, names the row taken
    out at each step in its place (see PINNED_CUTS). The outline stays closed: a fill pixel the cut leaves on
    the rim is drawn in the outline colour it lost (see _opened and _Lined)."""
    for step in range(n):
        top, bottom = opaque_rows(frames[:1] if first else frames)
        rows = range(top + 1, bottom)
        if below is not None:
            top, rows = below, range(below + 1, bottom + 1)
            below += 1
        if not rows:
            break
        h, mid = len(frames[0]), (top + bottom) / 2

        def same(a, b):
            return all(f[a] == f[b] for f in frames)

        def run(r):
            a, b = r, r
            while a > top and same(a - 1, r):
                a -= 1
            while b < bottom and same(b + 1, r):
                b += 1
            return b - a + 1

        counts = [{} for _ in frames]
        for f, cnt in zip(frames, counts):
            for row in f:
                for c in row:
                    if c:
                        cnt[c] = cnt.get(c, 0) + 1

        def thin(r):
            """The weight of the small features row r crosses: each opaque pixel in a run of its colour at
            most 2 long across rows (a line, a knot, an eye) that taking the row out would thin away, ten
            times over when its colour is rare in the frame (a bow's knot, a collar's tag)."""
            n = 0
            for f, cnt in zip(frames, counts):
                for x, c in enumerate(f[r]):
                    if not c:
                        continue
                    a, b = r, r
                    while a > 0 and f[a - 1][x] == c:
                        a -= 1
                    while b < len(f) - 1 and f[b + 1][x] == c:
                        b += 1
                    if b - a + 1 <= 2:
                        n += 10 if cnt[c] <= 16 else 1
            return n

        def score(r):
            diff = sum(x != y for f in frames for x, y in zip(f[r], f[r - 1]))
            return diff + thin(r), -run(r), abs(r - mid)

        r = picks[step] if step < len(picks) else min(rows, key=score)
        assert r in rows, f"pinned cut {r} is outside rows {rows}"
        opened = _opened(frames, r)
        frames = [[[None] * len(f[0])] + f[:r] + f[r + 1:] for f in frames]
        for i, y, x, line in opened:
            y += y < r
            frames[i][y] = frames[i][y][:]
            frames[i][y][x] = _Lined(frames[i][y][x], line)
        assert all(len(f) == h for f in frames)
    return frames


def _transposed(frames):
    return [[list(col) for col in zip(*f)] for f in frames]


def squatted(tags, w, h):
    """tags with their art cut to at most w x h (see depth_envelope) by taking out the rows and columns
    that change it least (see _without_rows). A column comes out with a clear one added on the side with
    less margin, so the art stays centred."""
    frames = [f for _, fs, _ in tags for f in fs]
    fw, fh = len(frames[0][0]), len(frames[0])
    frames = _without_rows(frames, fh - h)
    if fw > w:
        cols = _transposed(frames)
        cols = _without_rows(cols, fw - w)
        left, right = opaque_rows(cols)
        if left > 0 and left - 1 > fw - 1 - right:
            cols = [c[1:] + [[None] * len(c[0])] for c in cols]
        frames = _transposed(cols)
    return _regrouped(tags, frames)


def _unanchored():
    """The keys public/art/manifest.json lists without an anchor: the game does not stand them on the
    ground (overlays, icons and the like), so they keep their place in their frame."""
    try:
        with open("public/art/manifest.json") as f:
            return {s["key"] for s in json.load(f)["sprites"] if "anchor" not in s}
    except FileNotFoundError:
        return set()


def _regrouped(tags, frames):
    """tags with their frames, in order, replaced by frames."""
    out, i = [], 0
    for tag, fs, ms in tags:
        out.append((tag, frames[i:i + len(fs)], ms))
        i += len(fs)
    return out


def narrowed(tags, cols):
    """tags with frame 0's art cut to at most cols opaque columns, by taking out the columns that change it
    least (see _without_rows), then moved back to centre on the side with more margin."""
    frames = [f for _, fs, _ in tags for f in fs]
    cut = _transposed(frames)
    left, right = opaque_rows(cut[:1]) or (0, -1)
    n = max(0, right - left + 1 - cols)
    if not n:
        return tags
    cut = _without_rows(cut, n, first=True)
    fw = len(cut[0])
    lo, hi = opaque_rows(cut) or (0, fw - 1)
    while lo > 0 and lo - 1 > fw - 1 - hi:
        cut = [c[1:] + [[None] * len(c[0])] for c in cut]
        lo, hi = lo - 1, hi - 1
    return _regrouped(tags, _transposed(cut))


def opaque_cols(frames):
    """The first and last column with an opaque pixel in any of frames, or None when all are blank."""
    return opaque_rows(_transposed(frames))


def shortened(tags, rows, picks=()):
    """tags with frame 0's art cut to at most rows opaque rows, by taking out the rows that change it least,
    or the rows picks names (see _without_rows)."""
    frames = [f for _, fs, _ in tags for f in fs]
    top, bottom = opaque_rows(frames[:1]) or (0, -1)
    return _regrouped(tags, _without_rows(frames, max(0, bottom - top + 1 - rows), first=True, picks=picks))


# Depth steps whose shortening takes out pinned rows, as the row taken out at each step (see shortened), in
# place of the settle's choice. dog-penny@69 takes out row 27: in her shake frames the collar's and the tag's
# outlines share one colour, whose count passes _without_rows's rarity cutoff, so the settle would take out
# row 14, through her left ear.
PINNED_CUTS = {"dog-penny@69": (27,)}


def depth_settled(sprites, originals=None, apart=()):
    """sprites with each depth variant (<key>@<step>) cut to its step's depth_envelope (see squatted) and, for a
    ground sprite, held to its ideal, the full size at its scale, and seated on a feet row from it. The game draws
    a ground sprite smoothly, from the smallest step at least its true size scaled down
    (src/layout/depthScale.ts), so the step's frame 0 keeps inside the full size's opaque rows and columns at
    its scale, rounded half up, and inside the next larger step L's, so no step is bigger than its ideal or
    than a larger step (see shortened and narrowed). A step a little under its ideal is fine; holding each step
    to L at its scale instead would compound the rounding down the steps. Its feet row is the full size's at
    side / full side, rounded up, or the frame's bottom row when that is past it, so the feet move less than
    1px when it switches. The others (status overlays) are drawn at their own step. The full-size sprite is the
    one in sprites, else in originals ({key: tags}), else the one already exported; so is each step, settled
    larger steps first. A sprite's steps are the ones in sprites and the ones already exported.

    The tags named in apart are settled on their own, against their own full-size frame 0, as a second pose
    set: a pose that differs from the rest pose (a crouch beside a standing walk) then takes out the rows
    and columns that change it least, and adding it leaves the other tags' settling as it was. Each step's
    apart frames then move sideways to keep their full-size offset from the rest (see _abreast). apart needs
    each full-size sprite, in sprites or in originals."""
    sprites = list(sprites)
    if apart:
        def split(keep):
            part = [(k, ts) for k, tags in sprites if (ts := [t for t in tags if keep(t[0])])]
            full = {k: ts for k, tags in (originals or {}).items() if (ts := [t for t in tags if keep(t[0])])}
            return dict(depth_settled(part, full or None)), {**full, **dict(part)}

        (rest, rest_full), (own, own_full) = split(lambda tag: tag not in apart), split(lambda tag: tag in apart)
        scales = depth_scales()
        out = []
        for key, tags in sprites:
            base, at, suffix = key.partition("@")
            if at and key in rest and key in own and base in rest_full and base in own_full:
                own[key] = _abreast(own[key], rest[key], scales.get(f"@{suffix}", 1),
                                    _middle(own_full[base]) - _middle(rest_full[base]))
            settled_tags = {t[0]: t for t in rest.get(key, []) + own.get(key, [])}
            out.append((key, [settled_tags[t[0]] for t in tags]))
        return out
    full = {**(originals or {}), **dict(sprites)}
    scales = depth_scales()
    unanchored = _unanchored()
    settled = {}

    def frame0(key):
        if key in settled:
            return settled[key]
        return full[key][0][1][0] if key in full and "@" not in key else _exported(key)

    def scale_of(key):
        _, at, suffix = key.partition("@")
        return scales.get(f"@{suffix}", 1) if at else 1

    for key, tags in sorted(sprites, key=lambda kt: -scale_of(kt[0])):
        base, at, suffix = key.partition("@")
        if not (at and f"@{suffix}" in scales):
            continue
        frame0_full = frame0(base)
        if frame0_full is None:
            print(f"{key}: no full-size {base} to settle it by")
            continue
        steps = [s for x, s in scales.items()
                 if f"{base}{x}" in full or os.path.exists(f"public/art/sprites/{base}{x}.json")]
        scale = scales[f"@{suffix}"]
        w, h = depth_envelope(len(frame0_full[0]), len(frame0_full), steps)[scale]
        tags = squatted(tags, w, h)
        if base not in unanchored:
            larger = min((s for s in steps if s > scale), default=1)
            lkey = base + next(x for x, s in scales.items() if s == larger) if larger < 1 else base
            frame_l = frame0(lkey)
            if frame_l is None:
                print(f"{key}: no {lkey} to settle it by")
                frame_l = frame0_full
            top_f, feet_f = opaque_rows([frame0_full]) or (0, len(frame0_full) - 1)
            left_f, right_f = opaque_cols([frame0_full]) or (0, len(frame0_full[0]) - 1)
            top_l, feet_l = opaque_rows([frame_l]) or (0, len(frame_l) - 1)
            left_l, right_l = opaque_cols([frame_l]) or (0, len(frame_l[0]) - 1)
            side_f = max(len(frame0_full[0]), len(frame0_full))
            side = max(len(tags[0][1][0][0]), len(tags[0][1][0]))
            tags = shortened(tags, min(math.floor((feet_f - top_f + 1) * scale + 0.5), feet_l - top_l + 1),
                             PINNED_CUTS.get(key, ()))
            tags = narrowed(tags, min(math.floor((right_f - left_f + 1) * scale + 0.5), right_l - left_l + 1))
            tags = seated(key, tags, math.ceil(feet_f * side / side_f - 1e-9))
        settled[key] = tags[0][1][0]
        full[key] = tags
    def drawn(tags):
        return [(tag, [[[_shown(c) for c in row] for row in f] for f in fs], ms) for tag, fs, ms in tags]

    return [(key, drawn(full[key]) if key in settled else tags) for key, tags in sprites]


def _middle(tags):
    """The middle of frame 0's opaque columns, or None when it is blank."""
    cols = opaque_cols([tags[0][1][0]])
    return cols and (cols[0] + cols[1]) / 2


def _abreast(tags, rest, scale, gap):
    """A depth step's apart tags (see depth_settled) moved sideways so frame 0 sits gap x scale columns from
    the rest's frame 0, as at full size, rounded, without clipping an opaque pixel."""
    frames = [f for _, fs, _ in tags for f in fs]
    left, right = opaque_cols(frames) or (0, len(frames[0][0]) - 1)
    dx = round(_middle(rest) + gap * scale - _middle(tags))
    dx = max(-left, min(len(frames[0][0]) - 1 - right, dx))

    def move(f):
        return [[None] * dx + row[:len(row) - dx] if dx >= 0 else row[-dx:] + [None] * -dx for row in f]

    return [(tag, [move(f) for f in fs], ms) for tag, fs, ms in tags]


def build(sprites, src_dir, originals=None, apart=()):
    """Write src_dir/<key>.aseprite for every sprite and export it to public/art/sprites/, each depth
    variant settled by depth_settled."""
    sprites = depth_settled(sprites, originals, apart)
    os.makedirs(src_dir, exist_ok=True)
    os.makedirs("public/art/sprites", exist_ok=True)
    built = []
    for key, tags in sprites:
        src = f"{src_dir}/{key}.aseprite"
        with tempfile.NamedTemporaryFile("w", suffix=".lua", delete=False) as f:
            f.write(_lua(tags, src))
        subprocess.run(["aseprite", "-b", "--script", f.name], check=True)
        os.unlink(f.name)
        subprocess.run(["aseprite", "-b", src, "--sheet", f"public/art/sprites/{key}.png",
                        "--data", f"public/art/sprites/{key}.json", "--format", "json-hash", "--list-tags"],
                       check=True, stdout=subprocess.DEVNULL)
        built.append(key)
    print("built", ", ".join(built))


def main(argv, sprites, src_dir, doc, grounds=ZONE_ROADS, originals=None, apart=()):
    """originals, if given, returns {key: tags} of the full-size sprites whose depth variants sprites draws
    but not their full size; apart names the tags settled on their own (see depth_settled)."""
    if len(argv) == 3 and argv[1] == "preview":
        preview(depth_settled(sprites(), originals and originals(), apart), argv[2], grounds)
    elif len(argv) == 2 and argv[1] == "build":
        build(list(sprites()), src_dir, originals and originals(), apart)
    else:
        sys.exit(doc)


PALETTE_JSON = "shared/palette.json"


def palette_table():
    """Every colour by K name (Endesga 32, the neutral greys, the Toronto colours): its hex and the
    name of the colour one ramp step darker."""
    names = {v: k for k, v in K.items()}
    return {name: {"hex": hexed, "darker": names[DARKER[hexed]]} for name, hexed in K.items()}


if __name__ == "__main__":
    if sys.argv[1:] == ["palette"]:
        with open(PALETTE_JSON, "w") as f:
            f.write(json.dumps(palette_table(), indent=2) + "\n")
    else:
        sys.exit(__doc__)
