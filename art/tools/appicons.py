#!/usr/bin/env python3
"""Draw the site's icons: the home-screen app icons and the favicons.

Archie's own art on a sunburst of turquoise and dturq rays, in the house palette. The ink outline
holds 8.1:1 on turquoise and 4.3:1 on dturq, so he separates from the rays in colour and in grey.

The app icons scale the master, Archie's 64x64 portrait (public/art/images/portrait-dog-archie.png)
on the rays, by a whole number with nearest-neighbour, centred on the middle of his inked area
(33,37 in the portrait) and the rays carried to the icon's edges, so every icon pixel is one master
pixel. The rays radiate from that same point. The scales are the largest that keep every inked
pixel inside the central 80% safe circle, so the 512 also serves as the maskable icon.

  apple-touch-icon.png    180x180  master x2
  icon-192.png            192x192  master x2
  icon-512.png            512x512  master x6
  icon-maskable-512.png   512x512  the same image as icon-512

The favicons are drawn at their own size, a tile with its corners cut:

  favicon.png             32x32    Archie's happy face (public/art/sprites/face-dog-archie.png,
                                   frame 0) at 1x, its inked area centred, on the rays round the
                                   tile's middle; the corners cut by 2px
  favicon-16.png          16x16    the face drawn again at half size (ARCHIE_16) on flat
                                   turquoise; the corners cut by 1px

Usage:
  appicons.py preview OUT.png   every icon at its native size on ink, the maskable icon cropped to a
                                circle with the safe zone marked, and the favicons at 1x and 8x
  appicons.py build             write public/icons/<icon>.png, public/art/favicon.png and
                                favicon-16.png, and the sources art/appicon.aseprite (the master,
                                96x96: what the 192 shows), art/favicon-32.aseprite and
                                art/favicon-16.aseprite

Run from the repository root after portraits.py and dogs.py: the icons read Archie's exported art. The
icons are not in public/art/manifest.json: the pages and the web app manifest link them by path. A
build overwrites the .aseprite sources, so change this file or Archie's art, not the sources.
"""

import math
import os
import subprocess
import sys
import tempfile

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from pixel import K, PALETTE64  # noqa: E402

PORTRAIT = "public/art/images/portrait-dog-archie.png"
FACE = "public/art/sprites/face-dog-archie.png"  # frame 0, the happy face, is its first 32x32
RAY_LIGHT, RAY_DARK = "turquoise", "dturq"
RAYS = 12  # light rays, each with a dark one beside it
SAFE = 0.4  # the maskable safe zone: a circle of radius 40% of the icon size
MASTER = 96

ICONS = {
    "apple-touch-icon": (180, 2),
    "icon-192": (192, 2),
    "icon-512": (512, 6),
    "icon-maskable-512": (512, 6),
}

# The happy face at half size: the ears' dbrown folds, the blaze into the muzzle, the sky and amber
# eyes, ochre cheeks, the plum nose, the tongue, and the bandana with the ruff at its ends.
ARCHIE_16 = [
    "................",
    "..kk........kk..",
    ".kDDk......kDDk.",
    ".kDbbkkkkkkbbDk.",
    "..kssbbwwbbbbk..",
    "..ksbbbwwbbbDk..",
    "..ksSkbwwbakDk..",
    "..kbSSwwwwaaDk..",
    "..kobwwppwwbok..",
    "...kbwwppwlDk...",
    "...kbwkPPklDk...",
    "....kDlPmlDk....",
    "..kRRRRRRRRRRk..",
    "..kwrrrrRRRRlk..",
    "...klrrrRRRlk...",
    "....kkkkkkkk....",
]
INK = dict(k="ink", D="dbrown", b="brown", s="skin2", w="white", l="lgrey", o="ochre", p="plum", S="sky",
           a="amber", P="pink", m="mauve", r="red", R="dred")


def rgb(c):
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def opaque(img):
    """img's opaque pixels as {(x, y): (r, g, b)}."""
    img = img.convert("RGBA")
    return {(x, y): img.getpixel((x, y))[:3] for y in range(img.height) for x in range(img.width)
            if img.getpixel((x, y))[3]}


def centre(px):
    """The middle of px's inked area."""
    xs, ys = [p[0] for p in px], [p[1] for p in px]
    return (min(xs) + max(xs) + 1) / 2, (min(ys) + max(ys) + 1) / 2


def rays(cx, cy):
    """The ray colour at (x, y) round (cx, cy), defined past any edge."""
    def at(x, y):
        turn = math.atan2(y + 0.5 - cy, x + 0.5 - cx) / (2 * math.pi) + 1
        return rgb(K[RAY_LIGHT if int(turn * RAYS * 2 + 0.5) % 2 else RAY_DARK])
    return at


def portrait():
    return opaque(Image.open(PORTRAIT))


def render(subject, size, scale):
    """subject on the rays at a whole scale, centred on its inked area, the rays carried to the edges."""
    cx, cy = centre(subject)
    ox, oy = size / 2 - cx * scale, size / 2 - cy * scale
    assert ox == int(ox) and oy == int(oy), f"{size} does not centre the portrait at x{scale}"
    ox, oy = int(ox), int(oy)
    bg = rays(cx, cy)
    img = Image.new("RGB", (size, size))
    cells = {}
    for y in range(size):
        my = (y - oy) // scale
        for x in range(size):
            mx = (x - ox) // scale
            if (mx, my) not in cells:
                cells[mx, my] = subject.get((mx, my)) or bg(mx, my)
            img.putpixel((x, y), cells[mx, my])
    return img


def in_safe_zone(subject, size, scale):
    """Whether every corner of every inked pixel lies inside the safe circle."""
    cx, cy = centre(subject)
    r = SAFE * size
    for x, y in subject:
        for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
            if math.hypot((x + dx - cx) * scale, (y + dy - cy) * scale) > r + 1e-9:
                return False
    return True


def tile(n, px, bg, cut):
    """A favicon: px over bg(x, y) on an n x n tile, the corners cut by a cut-pixel bevel."""
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    for y in range(n):
        for x in range(n):
            if min(x, n - 1 - x) + min(y, n - 1 - y) >= cut:
                img.putpixel((x, y), (px.get((x, y)) or bg(x, y)) + (255,))
    return img


def favicon_32():
    face = opaque(Image.open(FACE).crop((0, 0, 32, 32)))
    cx, cy = centre(face)
    dx, dy = int(16 - cx), int(16 - cy)
    return tile(32, {(x + dx, y + dy): c for (x, y), c in face.items()}, rays(16, 16), 2)


def favicon_16():
    px = {(x, y): rgb(K[INK[ch]]) for y, row in enumerate(ARCHIE_16) for x, ch in enumerate(row) if ch != "."}
    return tile(16, px, lambda x, y: rgb(K[RAY_LIGHT]), 1)


def check(name, img, size):
    """Exact size, every opaque pixel a house palette colour; the app icons fully opaque."""
    assert img.size == (size, size), f"{name}: {img.size}"
    assert img.mode == ("RGBA" if name.startswith("favicon") else "RGB"), f"{name}: mode {img.mode}"
    palette = {rgb(c) for c in PALETTE64}
    stray = {c[:3] for _, c in img.convert("RGBA").getcolors(size * size) if c[3]} - palette
    assert not stray, f"{name}: off-palette {stray}"


def icons():
    """{path: image} for every icon the site serves."""
    subject = portrait()
    out = {}
    for name, (size, scale) in ICONS.items():
        if "maskable" in name:
            assert in_safe_zone(subject, size, scale), f"{name}: Archie leaves the safe zone at x{scale}"
        out[f"public/icons/{name}.png"] = render(subject, size, scale)
    out["public/art/favicon.png"] = favicon_32()
    out["public/art/favicon-16.png"] = favicon_16()
    for path, img in out.items():
        check(os.path.basename(path)[:-4], img, img.size[0])
    return out


def preview(out, gap=16, zoom=8):
    imgs = icons()
    big = imgs["public/icons/icon-maskable-512.png"]
    size = big.size[0]
    # The maskable icon under the most aggressive mask, a circle the full width, with the safe circle in hot pink.
    masked = Image.new("RGB", big.size, rgb(K["ink"]))
    c = size / 2
    for y in range(size):
        for x in range(size):
            d = math.hypot(x + 0.5 - c, y + 0.5 - c)
            if d <= c:
                masked.putpixel((x, y), big.getpixel((x, y)))
            if abs(d - SAFE * size) < 1:
                masked.putpixel((x, y), rgb(K["hot"]))
    row = [im for p, im in imgs.items() if p.startswith("public/icons/")] + [masked]
    favs = [imgs["public/art/favicon.png"], imgs["public/art/favicon-16.png"]]
    favs += [im.resize((im.width * zoom, im.height * zoom), Image.NEAREST) for im in favs]
    width = max(sum(im.width for im in row), sum(im.width for im in favs)) + gap * (len(row) + 1)
    sheet = Image.new("RGB", (width, gap * 3 + 512 + 32 * zoom), rgb(K["ink"]))
    x = gap
    for im in row:
        sheet.paste(im, (x, gap))
        x += im.width + gap
    x = gap
    for im in favs:
        sheet.paste(im, (x, gap * 2 + 512), im)
        x += im.width + gap
    sheet.save(out)


def master():
    """The master at 1x: the portrait on the rays, MASTER square, centred as the icons centre it."""
    subject = portrait()
    cx, cy = centre(subject)
    x0, y0 = int(cx - MASTER / 2), int(cy - MASTER / 2)
    bg = rays(cx, cy)
    img = Image.new("RGB", (MASTER, MASTER))
    for y in range(MASTER):
        for x in range(MASTER):
            img.putpixel((x, y), subject.get((x0 + x, y0 + y)) or bg(x0 + x, y0 + y))
    return img


def build():
    os.makedirs("public/icons", exist_ok=True)
    imgs = icons()
    for path, img in imgs.items():
        img.save(path, optimize=True)
    sources = {"art/appicon.aseprite": master(), "art/favicon-32.aseprite": imgs["public/art/favicon.png"],
               "art/favicon-16.aseprite": imgs["public/art/favicon-16.png"]}
    with tempfile.TemporaryDirectory() as tmp:
        for src, img in sources.items():
            png = os.path.join(tmp, os.path.basename(src)[:-9] + ".png")
            img.save(png)
            subprocess.run(["aseprite", "-b", png, "--save-as", src], check=True)
    print("built", ", ".join(imgs), "and", ", ".join(sources))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
