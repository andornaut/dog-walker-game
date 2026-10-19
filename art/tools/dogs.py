#!/usr/bin/env python3
"""Draw the dogs in code and build their Aseprite sources and exports.

Each dog gets two sprites, both 32x32 and in Endesga 32 with coloured outlines:

- dog-<name>: the road sprite, seen from above and behind. Tags: walk (4
  frames), react (2) and pull (2, leaning right; the game mirrors it for left).
- face-dog-<name>: the dog column face. Tags: happy, neutral, upset.

Usage:
  dogs.py preview OUT.png   contact sheet of every frame, scaled up
  dogs.py build             write art/dogs/*.aseprite, then export
                            public/art/sprites/*.png and *.json with Aseprite

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead.
"""

import json
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
SIZE = 32


class Grid:
    def __init__(self):
        self.px = [[None] * SIZE for _ in range(SIZE)]

    def p(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < SIZE and 0 <= y < SIZE:
            self.px[y][x] = K.get(c, c) if c else None

    def rect(self, x, y, w, h, c):
        for j in range(h):
            for i in range(w):
                self.p(x + i, y + j, c)

    def ell(self, cx, cy, rx, ry, c, sh=None, li=None):
        """Filled ellipse, shaded from a top-left light: sh on the lower-right rim, li on the upper-left."""
        for y in range(SIZE):
            for x in range(SIZE):
                dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1:
                    d = 0.7 * (dx + dy)
                    self.p(x, y, sh if sh and d > 0.5 else li if li and d < -0.72 else c)

    def tri(self, a, b, c, col):
        def side(px, py, x1, y1, x2, y2):
            return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2)

        for y in range(SIZE):
            for x in range(SIZE):
                px, py = x + 0.5, y + 0.5
                d1, d2, d3 = side(px, py, *a, *b), side(px, py, *b, *c), side(px, py, *c, *a)
                if not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0)):
                    self.p(x, y, col)

    def outlined(self):
        """Coloured outline: each empty pixel touching the sprite takes the colour two ramp steps darker."""
        out = [row[:] for row in self.px]
        for y in range(SIZE):
            for x in range(SIZE):
                if self.px[y][x]:
                    continue
                for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < SIZE and 0 <= yy < SIZE and self.px[yy][xx]:
                        out[y][x] = DARKER[DARKER[self.px[yy][xx]]]
                        break
        return out


# Road poses. Walk is a 4-beat trot: diagonal leg pairs swap on beats 0 and 2,
# and the body bobs up on the passing beats 1 and 3.
WALK = [
    dict(fl=-1, fr=1, bl=1, br=-1, bob=0, tail=-1),
    dict(fl=0, fr=0, bl=0, br=0, bob=-1, tail=0),
    dict(fl=1, fr=-1, bl=-1, br=1, bob=0, tail=1),
    dict(fl=0, fr=0, bl=0, br=0, bob=-1, tail=0),
]
REACT = [
    dict(fl=-4, fr=-4, bl=-3, br=-3, bob=-3, tail=0, ears=-1),
    dict(fl=-1, fr=-1, bl=-1, br=-1, bob=-1, tail=0, ears=-1),
]
PULL = [
    dict(fl=-1, fr=-1, bl=1, br=1, bob=0, tail=-2, lean=2),
    dict(fl=-2, fr=-1, bl=1, br=1, bob=0, tail=-2, lean=3),
]
ROAD_TAGS = [("walk", WALK, 150), ("react", REACT, 120), ("pull", PULL, 160)]
FACE_TAGS = ["happy", "neutral", "upset"]


def pose(q):
    return dict(dict(fl=0, fr=0, bl=0, br=0, bob=0, tail=0, ears=0, lean=0), **q)


# ---------- Koda: husky, big, grey and white, blue eyes, orange harness ----------

def koda_road(q):
    g, q = Grid(), pose(q)
    b, ln = q["bob"], q["lean"]
    # legs: white, front pair beside the shoulders, back pair under the hips
    g.rect(7 + ln // 2, 15 + q["fl"] + b, 3, 4, "lgrey")
    g.rect(22 + ln // 2, 15 + q["fr"] + b, 3, 4, "lgrey")
    g.rect(9, 25 + q["bl"], 3, 4, "lgrey")
    g.rect(20, 25 + q["br"], 3, 4, "lgrey")
    # body: white flanks, grey saddle, harness
    bx = 16 + ln // 2
    g.ell(bx, 20.5 + b, 7.5, 6.5, "lgrey", "grey", "white")
    g.ell(bx, 19.5 + b, 5, 5.5, "slate", "dslate", "grey")
    g.rect(bx - 6, 16 + b, 12, 2, "orange")
    g.rect(bx - 6, 17 + b, 12, 1, "rust")
    g.rect(bx - 2, 20 + b, 4, 2, "orange")
    g.rect(bx - 1, 21 + b, 2, 1, "slate")
    g.ell(bx, 15 + b, 5, 1.5, "dslate")
    # curled tail over the hips
    tx = 16 + q["tail"]
    g.ell(tx, 27 + b, 3.5, 2.5, "lgrey", "grey", "white")
    g.p(tx, 27 + b, "grey")
    # big head with white cheeks and upright ears
    hx = 16 + ln
    e = q["ears"]
    g.tri((hx - 7, 7 + b), (hx - 6, 1 + b + e), (hx - 2, 4.5 + b), "dslate")
    g.tri((hx + 7, 7 + b), (hx + 6, 1 + b + e), (hx + 2, 4.5 + b), "dslate")
    g.ell(hx, 9.5 + b, 8, 6, "slate", "dslate", "grey")
    g.ell(hx - 6.5, 12 + b, 2, 2.2, "lgrey")
    g.ell(hx + 6.5, 12 + b, 2, 2.2, "lgrey", "grey")
    return g


def koda_face(mood):
    g = Grid()
    g.tri((7, 11), (8, 1), (13.5, 6), "slate")
    g.tri((25, 11), (24, 1), (18.5, 6), "slate")
    g.tri((8.5, 8.5), (9, 4), (12, 6.5), "pink")
    g.tri((23.5, 8.5), (23, 4), (20, 6.5), "pink")
    g.ell(16, 28, 7, 3.5, "lgrey", "grey", "white")
    g.ell(16, 16, 10, 8.5, "slate", "dslate", "grey")
    # white mask: brows, cheeks and muzzle
    g.ell(16, 20.5, 8, 5, "lgrey", "grey", "white")
    g.rect(15, 8, 2, 7, "lgrey")
    g.rect(10, 12, 3, 1, "white")
    g.rect(19, 12, 3, 1, "white")
    # harness
    g.rect(9, 27, 14, 2, "orange")
    g.rect(9, 28, 14, 1, "rust")
    g.rect(15, 26, 2, 3, "orange")
    eyes(g, 10, 19, 14, iris="sky", mood=mood)
    g.rect(14, 18, 4, 2, "ink")
    g.p(14, 18, "slate")
    mouth(g, 20, mood)
    return g


# ---------- Biscuit: beagle, medium, tricolour, long ears, green collar ----------

def biscuit_road(q):
    g, q = Grid(), pose(q)
    b, ln = q["bob"], q["lean"]
    g.rect(9 + ln // 2, 18 + q["fl"] + b, 2, 3, "white")
    g.rect(21 + ln // 2, 18 + q["fr"] + b, 2, 3, "white")
    g.rect(10, 25 + q["bl"], 3, 3, "white")
    g.rect(19, 25 + q["br"], 3, 3, "white")
    bx = 16 + ln // 2
    g.ell(bx, 22 + b, 6.5, 5.5, "white", "lgrey")
    g.ell(bx, 21.5 + b, 5, 4.5, "navy", "ink", "dslate")
    g.ell(bx - 5, 23.5 + b, 1.8, 2.5, "ochre")
    g.ell(bx + 5, 23.5 + b, 1.8, 2.5, "ochre", "rust")
    # tail held up, white tip
    tx = 16 + q["tail"]
    g.rect(tx - 1, 26 + b, 2, 3, "navy")
    g.rect(tx - 1, 29 + b, 2, 1, "white")
    g.ell(bx, 16 + b, 4.5, 1.5, "ink")
    g.rect(bx - 5, 16 + b, 10, 2, "green")
    g.rect(bx - 5, 17 + b, 10, 1, "dgreen")
    hx = 16 + ln
    g.ell(hx, 11.5 + b, 7, 5.5, "ochre", "rust", "tan")
    g.ell(hx - 6.5, 14 + b - q["ears"], 2.3, 4.5, "rust", "dbrown")
    g.ell(hx + 6.5, 14 + b - q["ears"], 2.3, 4.5, "rust", "dbrown")
    return g


def biscuit_face(mood):
    g = Grid()
    g.ell(16, 28.5, 6.5, 3, "white", "lgrey")
    g.ell(16, 15.5, 9, 8, "ochre", "rust", "tan")
    g.rect(15, 7, 2, 9, "white")
    g.ell(16, 20.5, 6, 4.5, "white", "lgrey")
    g.ell(6.5, 18, 3, 7.5, "rust", "dbrown")
    g.ell(25.5, 18, 3, 7.5, "rust", "dbrown")
    g.rect(9, 26, 14, 2, "green")
    g.rect(9, 27, 14, 1, "dgreen")
    eyes(g, 11, 19, 14, mood=mood)
    g.rect(14, 17, 4, 2, "ink")
    g.p(14, 17, "dslate")
    mouth(g, 20, mood)
    return g


# ---------- Duchess: Maltese, small, white, pink bow ----------

def duchess_road(q):
    g, q = Grid(), pose(q)
    b, ln = q["bob"], q["lean"]
    g.rect(12, 27 + q["bl"], 2, 2, "lgrey")
    g.rect(18, 27 + q["br"], 2, 2, "lgrey")
    bx = 16 + ln // 2
    g.ell(bx, 23.5 + b, 5.5, 4.5, "white", "lgrey")
    g.ell(bx - 4.5, 25 + b, 1.6, 2, "white", "lgrey")
    g.ell(bx + 4.5, 25 + b, 1.6, 2, "lgrey")
    g.ell(bx, 20 + b, 4, 1.2, "lgrey")
    tx = 16 + q["tail"]
    g.ell(tx, 26.5 + b, 3, 2, "white", "lgrey", "white")
    g.p(tx + 1, 27 + b, "lgrey")
    hx = 16 + ln
    g.ell(hx - 4.5, 18 + b - q["ears"], 2.2, 4, "white", "lgrey")
    g.ell(hx + 4.5, 18 + b - q["ears"], 2.2, 4, "lgrey")
    g.ell(hx, 15.5 + b, 5.5, 4.5, "white", "lgrey")
    bow(g, hx, 10 + b)
    return g


def duchess_face(mood):
    g = Grid()
    g.ell(16, 26.5, 6, 3.5, "white", "lgrey")
    g.ell(7.5, 19, 3.5, 7.5, "white", "lgrey")
    g.ell(24.5, 19, 3.5, 7.5, "lgrey", "grey")
    g.ell(16, 16, 8.5, 8, "white", "lgrey")
    g.ell(16, 20.5, 4.5, 3.5, "white", "lgrey")
    bow(g, 16, 6, big=True)
    eyes(g, 11, 19, 15, mood=mood)
    g.rect(15, 18, 2, 2, "ink")
    mouth(g, 21, mood)
    return g


# ---------- shared features ----------

def bow(g, cx, y, big=False):
    w = 4 if big else 3
    g.tri((cx - 1, y + 1), (cx - 1 - w, y - 1), (cx - 1 - w, y + 3), "pink")
    g.tri((cx + 1, y + 1), (cx + 1 + w, y - 1), (cx + 1 + w, y + 3), "pink")
    g.p(cx - 1 - w + 1, y + 2, "mauve")
    g.p(cx + w, y + 2, "mauve")
    g.rect(cx - 1, y, 2, 2, "mauve")


def eyes(g, lx, rx, y, iris=None, mood="happy"):
    for x in (lx, rx):
        if iris:
            g.rect(x, y, 3, 3, iris)
            g.p(x + 1, y + 1, "ink")
            g.p(x + 2, y + 2, "blue")
            g.p(x, y, "white")
        else:
            g.rect(x, y, 2, 2, "ink")
            g.p(x, y, "white")
    if mood == "upset":
        wide = 3 if iris else 2
        # brows tilt up toward the middle
        g.p(lx - 1, y - 1, "ink")
        g.rect(lx, y - 2, wide - 1, 1, "ink")
        g.rect(rx + 1, y - 2, wide - 1, 1, "ink")
        g.p(rx + wide, y - 1, "ink")


def mouth(g, y, mood):
    if mood == "happy":
        g.p(14, y, "ink")
        g.p(17, y, "ink")
        g.rect(15, y + 1, 2, 1, "ink")
        g.rect(15, y + 2, 2, 2, "pink")
        g.p(16, y + 3, "mauve")
    elif mood == "neutral":
        g.rect(15, y + 1, 2, 1, "ink")
    else:
        g.rect(15, y, 2, 1, "ink")
        g.p(14, y + 1, "ink")
        g.p(17, y + 1, "ink")


DOGS = {
    "duchess": (duchess_road, duchess_face),
    "biscuit": (biscuit_road, biscuit_face),
    "koda": (koda_road, koda_face),
}


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    for name, (road, face) in DOGS.items():
        yield f"dog-{name}", [(tag, [road(q).outlined() for q in poses], ms) for tag, poses, ms in ROAD_TAGS]
        yield f"face-dog-{name}", [(m, [face(m).outlined()], 1000) for m in FACE_TAGS]


def preview(out):
    from PIL import Image

    scale, gap = 6, 4
    grounds = ["3a4466", "c0cbdc", "c28569"]
    rows = []
    for key, tags in sprites():
        frames = [f for _, fs, _ in tags for f in fs]
        for ground in grounds if key.startswith("dog-") else ["e4a672"]:
            rows.append((frames, ground))
    width = max(len(f) for f, _ in rows) * (SIZE + gap) * scale
    img = Image.new("RGB", (width, len(rows) * (SIZE + gap) * scale), (24, 20, 37))
    for r, (frames, ground) in enumerate(rows):
        for i, f in enumerate(frames):
            x0, y0 = i * (SIZE + gap) * scale, r * (SIZE + gap) * scale
            for y in range(SIZE):
                for x in range(SIZE):
                    c = f[y][x] or ground
                    rgb = tuple(int(c[k:k + 2], 16) for k in (0, 2, 4))
                    for yy in range(scale):
                        for xx in range(scale):
                            img.putpixel((x0 + x * scale + xx, y0 + y * scale + yy), rgb)
    img.save(out)


LUA = """
local spr = Sprite({size}, {size}, ColorMode.RGB)
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


def lua_for(key, tags, out):
    frames, durations, tag_lines, n = [], [], [], 0
    for tag, fs, ms in tags:
        tag_lines.append(f'do local t = spr:newTag({n + 1}, {n + len(fs)}); t.name = "{tag}" end')
        for f in fs:
            pts = []
            for y in range(SIZE):
                for x in range(SIZE):
                    c = f[y][x]
                    if c:
                        pts.append("{%d,%d,%d,%d,%d}" % (x, y, int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)))
            frames.append("{" + ",".join(pts) + "}")
            durations.append(str(ms / 1000))
        n += len(fs)
    palette = "\n".join(
        f"pal:setColor({i}, Color{{ r = {int(c[0:2], 16)}, g = {int(c[2:4], 16)}, b = {int(c[4:6], 16)} }})"
        for i, c in enumerate(PALETTE)
    )
    return LUA.format(size=SIZE, ncolors=len(PALETTE), palette=palette, frames="{" + ",\n".join(frames) + "}",
                      durations="{" + ",".join(durations) + "}", tags="\n".join(tag_lines), out=out)


def build():
    os.makedirs("art/dogs", exist_ok=True)
    os.makedirs("public/art/sprites", exist_ok=True)
    built = []
    for key, tags in sprites():
        src = f"art/dogs/{key}.aseprite"
        with tempfile.NamedTemporaryFile("w", suffix=".lua", delete=False) as f:
            f.write(lua_for(key, tags, src))
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


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
