"""Shared pixel-art tooling: an Endesga 32 drawing grid with coloured outlines,
and the step that turns frames into an Aseprite source and a PNG + JSON export.
Run the art scripts from the repository root."""

import json
import math
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
ROADS = ("3a4466", "e4a672", "f6757a", "c28569")


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


def depth_scales():
    """{suffix: scale} for every depth step below full size in shared/depth-steps.json, the table the game
    reads: {"@88": 0.875, ...}."""
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
    least that size (src/layout/depthScale.ts), so one pixel past a step's side it draws the next larger
    step scaled down to it. A frame, floor(side x scale + 0.5), can round its shorter side past that: hedge@75
    is 23 rows where hedge@88's 26 drawn at 127/147 are 22.46, so the hedge would shrink as it approached. So
    each step's art keeps to the next larger step's art scaled to its own side plus one, rounded down,
    working from full size down the steps."""
    out, frame, art = {}, (w, h), (w, h)
    for s in sorted(scales, reverse=True):
        fw, fh = math.floor(w * s + 0.5), math.floor(h * s + 0.5)
        k = (max(fw, fh) + 1) / max(frame)
        art = (min(fw, math.floor(art[0] * k + 1e-9)), min(fh, math.floor(art[1] * k + 1e-9)))
        out[s], frame = art, (fw, fh)
    return out


def _without_rows(frames, n, first=False, below=None):
    """frames with n rows taken out from inside their opaque bounds (frame 0's when first), or from the rows
    past row below to their last opaque row, then as many clear rows added on top. Each goes where the art
    changes least: the row most like the one above it in every frame, in the longest run of equal rows,
    nearest the middle."""
    for _ in range(n):
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

        def score(r):
            diff = sum(x != y for f in frames for x, y in zip(f[r], f[r - 1]))
            return diff, -run(r), abs(r - mid)

        r = min(rows, key=score)
        frames = [[[None] * len(f[0])] + f[:r] + f[r + 1:] for f in frames]
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


def shortened(tags, rows):
    """tags with frame 0's art cut to at most rows opaque rows, by taking out the rows that change it least
    (see _without_rows)."""
    frames = [f for _, fs, _ in tags for f in fs]
    top, bottom = opaque_rows(frames[:1]) or (0, -1)
    return _regrouped(tags, _without_rows(frames, max(0, bottom - top + 1 - rows), first=True))


def depth_settled(sprites, originals=None):
    """sprites with each depth variant (<key>@<step>) cut to its step's depth_envelope (see squatted) and, for
    a ground sprite, held to the next larger step L's frame 0 and seated on a feet row from it. The game
    draws a ground sprite one pixel past a step's side from L scaled by (side + 1) / L's side
    (src/layout/depthScale.ts), so the step's frame 0 keeps to L's opaque rows at that scale, to the nearest
    pixel, and it does not shrink when the drawing switches steps (see shortened). Its feet row is L's at
    side / L's side, rounded up, or the frame's bottom row when that is past it, so the feet move less than
    1px when it switches. The others (status overlays) are drawn at their own step, not from L. The
    full-size sprite is the one in sprites, else in originals ({key: tags}), else the one already exported;
    so is each step, settled larger steps first. A sprite's steps are the ones in sprites and the ones
    already exported."""
    sprites = list(sprites)
    full = {**(originals or {}), **dict(sprites)}
    scales = depth_scales()
    unanchored = _unanchored()
    settled = {}

    def frame0(key):
        if key in settled:
            return settled[key]
        return full[key][0][1][0] if key in full and "@" not in key else _exported(key)

    def scale_of(key):
        base, at, suffix = key.partition("@")
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
            top_l, feet_l = opaque_rows([frame_l]) or (0, len(frame_l) - 1)
            side_l = max(len(frame_l[0]), len(frame_l))
            side = max(len(tags[0][1][0][0]), len(tags[0][1][0]))
            tags = shortened(tags, math.floor((feet_l - top_l + 1) * (side + 1) / side_l + 0.5))
            tags = seated(key, tags, math.ceil(feet_l * side / side_l - 1e-9))
        settled[key] = tags[0][1][0]
        full[key] = tags
    return [(key, full[key] if key in settled else tags) for key, tags in sprites]


def build(sprites, src_dir, originals=None):
    """Write src_dir/<key>.aseprite for every sprite and export it to public/art/sprites/, each depth
    variant settled by depth_settled."""
    sprites = depth_settled(sprites, originals)
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


def main(argv, sprites, src_dir, doc, grounds=("3a4466", "c0cbdc", "c28569"), originals=None):
    """originals, if given, returns {key: tags} of the full-size sprites whose depth variants sprites draws
    but not their full size (see depth_settled)."""
    import sys

    if len(argv) == 3 and argv[1] == "preview":
        preview(depth_settled(sprites(), originals and originals()), argv[2], grounds)
    elif len(argv) == 2 and argv[1] == "build":
        build(list(sprites()), src_dir, originals and originals())
    else:
        sys.exit(doc)
