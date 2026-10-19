"""Shared pixel-art tooling: an Endesga 32 drawing grid with coloured outlines,
and the step that turns frames into an Aseprite source, a PNG + JSON export and
a manifest entry. Run the art scripts from the repository root."""

import json
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


class Grid:
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
        """Coloured outline: each empty pixel touching the sprite takes the colour two ramp steps darker."""
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
                        out[y][x] = DARKER[DARKER[self.px[yy][xx]]]
                        break
        return out


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
        for f in fs:
            pts = []
            for y, row in enumerate(f):
                for x, c in enumerate(row):
                    if c:
                        pts.append("{%d,%d,%d,%d,%d}" % (x, y, int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)))
            frames.append("{" + ",".join(pts) + "}")
            durations.append(str(ms / 1000))
        n += len(fs)
    palette = "\n".join(
        f"pal:setColor({i}, Color{{ r = {int(c[0:2], 16)}, g = {int(c[2:4], 16)}, b = {int(c[4:6], 16)} }})"
        for i, c in enumerate(PALETTE)
    )
    return LUA.format(w=w, h=h, ncolors=len(PALETTE), palette=palette, frames="{" + ",\n".join(frames) + "}",
                      durations="{" + ",".join(durations) + "}", tags="\n".join(tag_lines), out=out)


def build(sprites, src_dir):
    """Write src_dir/<key>.aseprite for every sprite, export it to public/art/sprites/ and list it in the manifest."""
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
    manifest_path = "public/art/manifest.json"
    with open(manifest_path) as f:
        manifest = json.load(f)
    entries = {s["key"]: s for s in manifest.get("sprites", [])}
    for key in built:
        entries[key] = {"key": key, "png": f"sprites/{key}.png", "json": f"sprites/{key}.json"}
    manifest["sprites"] = sorted(entries.values(), key=lambda s: s["key"])
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print("built", ", ".join(built))


def main(argv, sprites, src_dir, doc, grounds=("3a4466", "c0cbdc", "c28569")):
    import sys

    if len(argv) == 3 and argv[1] == "preview":
        preview(list(sprites()), argv[2], grounds)
    elif len(argv) == 2 and argv[1] == "build":
        build(list(sprites()), src_dir)
    else:
        sys.exit(doc)
