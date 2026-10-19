"""Shared pixel-art tooling: an Endesga 32 drawing grid with coloured outlines,
and the step that turns frames into an Aseprite source and a PNG + JSON export.
Run the art scripts from the repository root."""

import os
import subprocess
import tempfile

# Endesga 32, by role.
K = dict(
    rust="be4a2f", ochre="d77643", cream="ead4aa", tan="e4a672", brown="b86f50", dbrown="733e39", plum="3e2731",
    dred="a22633", red="e43b44", orange="f77622", amber="feae34", yellow="fee761", green="63c74d", dgreen="3e8948",
    forest="265c42", teal="193c3e", blue="124e89", sky="0099db", cyan="2ce8f5", white="ffffff", lgrey="c0cbdc",
    grey="8b9bb4", slate="5a6988", dslate="3a4466", navy="262b44", ink="181425", hot="ff0044", purple="68386c",
    mauve="b55088", pink="f6757a", skin1="e8b796", skin2="c28569",
)
PALETTE = [
    "be4a2f", "d77643", "ead4aa", "e4a672", "b86f50", "733e39", "3e2731", "a22633", "e43b44", "f77622", "feae34",
    "fee761", "63c74d", "3e8948", "265c42", "193c3e", "124e89", "0099db", "2ce8f5", "ffffff", "c0cbdc", "8b9bb4",
    "5a6988", "3a4466", "262b44", "181425", "ff0044", "68386c", "b55088", "f6757a", "e8b796", "c28569",
]
DARKER = dict(p.split(":") for p in (
    "be4a2f:733e39 d77643:be4a2f ead4aa:e4a672 e4a672:b86f50 b86f50:733e39 733e39:3e2731 3e2731:181425 "
    "a22633:3e2731 e43b44:a22633 f77622:be4a2f feae34:f77622 fee761:feae34 63c74d:3e8948 3e8948:265c42 "
    "265c42:193c3e 193c3e:181425 124e89:262b44 0099db:124e89 2ce8f5:0099db ffffff:c0cbdc c0cbdc:8b9bb4 "
    "8b9bb4:5a6988 5a6988:3a4466 3a4466:262b44 262b44:181425 181425:181425 ff0044:a22633 68386c:3e2731 "
    "b55088:68386c f6757a:b55088 e8b796:c28569 c28569:b86f50"
).split())
# The road colours: Elm Avenue (dark), then Fairview Park, Main Street and The Long Way Home (light).
ROADS = ("3a4466", "e4a672", "c0cbdc", "c28569")


def contrast(a, b):
    """WCAG contrast ratio of two hex colours."""
    def lum(c):
        v = [int(c[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        v = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in v]
        return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]

    la, lb = lum(K.get(a, a)), lum(K.get(b, b))
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def road_edge(c):
    """A road sprite's outline for fill c: two ramp steps darker, then on down the ramp until it holds 3:1
    against the three light roads. The fill inside it carries Elm Avenue."""
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

        s, l = max(1, 0.13 * (rx + ry)), max(1, 0.06 * (rx + ry))
        for y in range(self.h):
            for x in range(self.w):
                if not inside(x, y):
                    continue
                lit = (x + 0.5 - cx) / rx + (y + 0.5 - cy) / ry < -0.7
                self.p(x, y, sh if sh and not inside(x, y, -s) else li if li and lit and not inside(x, y, l) else c)

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
    inner = getattr(g, "g", g)
    inner.edge, inner.close = edge, close
    return g


def preview(sprites, out, grounds=("3a4466", "c0cbdc", "c28569"), scale=6, gap=4):
    """Contact sheet: one row per sprite and ground colour, every frame in tag order."""
    from PIL import Image

    rows = []
    for key, tags in sprites:
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
local pal = Palette({ncolors})
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
    palette = "\n".join(
        f"pal:setColor({i}, Color{{ r = {int(c[0:2], 16)}, g = {int(c[2:4], 16)}, b = {int(c[4:6], 16)} }})"
        for i, c in enumerate(PALETTE)
    )
    return LUA.format(w=w, h=h, ncolors=len(PALETTE), palette=palette, frames="{" + ",\n".join(frames) + "}",
                      durations="{" + ",".join(durations) + "}", tags="\n".join(tag_lines), out=out)


def build(sprites, src_dir):
    """Write src_dir/<key>.aseprite for every sprite and export it to public/art/sprites/."""
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


def main(argv, sprites, src_dir, doc, grounds=("3a4466", "c0cbdc", "c28569")):
    import sys

    if len(argv) == 3 and argv[1] == "preview":
        preview(list(sprites()), argv[2], grounds)
    elif len(argv) == 2 and argv[1] == "build":
        build(list(sprites()), src_dir)
    else:
        sys.exit(doc)
