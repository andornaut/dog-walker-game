#!/usr/bin/env python3
"""Draw the site's icons: the home-screen app icons and the favicons.

Archie's own art on flat sky, the blue behind his portrait on the detail card (ui-detail-well), in
the house palette. The ink outline holds 5.6:1 on sky, so he separates from it in colour and in grey.

The app icons scale the master, Archie's 64x64 portrait (public/art/images/portrait-dog-archie.png)
on sky, by a whole number with nearest-neighbour, centred on CENTRE (33,37 in the portrait, the
middle of his head and body, fixed so his tail does not move him) with the sky carried to the
icon's edges, so every icon pixel is one master pixel. Archie fills most of each icon: under the
maskable icon's central 80% safe circle, his head from below the ear tips (portrait rows 23 to 41) and his
whole bandana stay inside it, and the ear tips, paws and tail may be cropped. The iOS rounded
square crops less than that circle, so the 180 shows him whole.

  apple-touch-icon.png    180x180  master x3
  icon-192.png            192x192  master x3
  icon-512.png            512x512  master x8
  icon-maskable-512.png   512x512  the same image as icon-512

The favicons are drawn at their own size, a tile with its corners cut:

  favicon.png             32x32    Archie's happy face (archie_face in dogs.py) drawn at
                                   FAVICON_SIDE over 32 of its design and cropped to 32x32
                                   from the ear tips down, centred across, so his head fills
                                   the tile to the top of the bandana; its eyes, which that
                                   scale draws unevenly, drawn again alike (FAVICON_EYE); on
                                   sky, the corners cut by 2px
  favicon-16.png          16x16    the face drawn again close at half size (ARCHIE_16), the
                                   head filling the tile above the top of the bandana; on sky,
                                   the corners cut by 1px

Usage:
  appicons.py preview OUT.png   every icon at its native size on ink, the maskable icon cropped to a
                                circle with the safe zone marked, and the favicons at 1x and 8x
  appicons.py build             write public/icons/<icon>.png, public/art/favicon.png and
                                favicon-16.png, and the sources art/appicon.aseprite (the master,
                                64x64: what the 192 and 512 show), art/favicon-32.aseprite and
                                art/favicon-16.aseprite

Run from the repository root after portraits.py: the app icons read Archie's exported portrait. The
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
from minis import scaled  # noqa: E402
from pixel import K, PALETTE64  # noqa: E402

PORTRAIT = "public/art/images/portrait-dog-archie.png"
BACKGROUND = "sky"  # ui-detail-well's face, behind his portrait on the detail card
SAFE = 0.4  # the maskable safe zone: a circle of radius 40% of the icon size
MASTER = 64
CENTRE = (33, 37)  # the portrait point the icons centre on
KEEP_ROWS = range(23, 42)  # the portrait's head below the ear tips, down to the chin
BANDANA = ("red", "dred")

ICONS = {
    "apple-touch-icon": (180, 3),
    "icon-192": (192, 3),
    "icon-512": (512, 8),
    "icon-maskable-512": (512, 8),
}

# The 32 favicon: the face drawn at FAVICON_SIDE over 32, and each eye drawn again as the inside of the
# portrait's eye (k ink, w white, i the iris): the shine at the top left, the pupil at the right.
FAVICON_SIDE = 36
FAVICON_EYE = ["wwi", "wkk", "ikk", "iii"]

# The happy face at half size and close, the head filling the tile above the top of the bandana: the
# ears' dbrown folds in the top corners, the blaze into the muzzle, the sky and amber eyes drawn alike
# (the iris down the left column, the pupil down the right), ochre cheeks, the plum nose and the tongue.
ARCHIE_16 = [
    ".kk..........kk.",
    "kDDk........kDDk",
    "kDbbkkkkkkkkbbDk",
    ".kssbbbwwbbbbbk.",
    ".ksbbbbwwbbbbDk.",
    ".ksbSkbwwbakbDk.",
    ".ksbSkwwwwakbDk.",
    ".kobbwwwwwwbbok.",
    ".kbbwwwppwwwbDk.",
    "..kbwwwppwwlDk..",
    "..kbwwkPPkwlDk..",
    "...kDwlPmllDk...",
    "...kkDDllDDkk...",
    "..kRRRRRRRRRRk..",
    ".kwrrrrrRRRRRlk.",
    ".kwlrrrrRRRRllk.",
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


def ground(x, y):
    """The background colour at (x, y): flat sky, defined past any edge."""
    return rgb(K[BACKGROUND])


def portrait():
    return opaque(Image.open(PORTRAIT))


def render(subject, size, scale):
    """subject on sky at a whole scale, centred on CENTRE, the sky carried to the edges."""
    cx, cy = CENTRE
    ox, oy = size / 2 - cx * scale, size / 2 - cy * scale
    assert ox == int(ox) and oy == int(oy), f"{size} does not centre the portrait at x{scale}"
    ox, oy = int(ox), int(oy)
    bg = ground
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
    """Whether every corner of every pixel of his head below the ear tips (KEEP_ROWS) and of his
    bandana lies inside the safe circle."""
    cx, cy = CENTRE
    r = SAFE * size
    bandana = {rgb(K[c]) for c in BANDANA}
    for (x, y), c in subject.items():
        if y not in KEEP_ROWS and c not in bandana:
            continue
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
    """The happy face at FAVICON_SIDE over 32, its eyes drawn again alike, cropped to 32x32 from its top
    row and centred across."""
    import dogs
    import minis

    s = FAVICON_SIDE / 32
    px = minis.small(dogs, s, dogs.archie_face, "happy").outlined()
    top = scaled(dogs.ARCHIE_EYE_Y, s)
    for i, (x, iris) in enumerate(dogs.ARCHIE_EYES):
        # the scaled 3x3 eye back to coat, then FAVICON_EYE set against the blaze: the far eye at the
        # right of its box, the near one at the left
        x0, x1 = scaled(x, s), scaled(x + 3, s)
        for y in range(top, scaled(dogs.ARCHIE_EYE_Y + 3, s)):
            px[y][x0:x1] = [K[dogs.COAT[0]]] * (x1 - x0)
        ex = x1 - len(FAVICON_EYE[0]) if i == 0 else x0
        for dy, row in enumerate(FAVICON_EYE):
            for dx, ch in enumerate(row):
                px[top + dy][ex + dx] = K[{"k": "ink", "w": "white", "i": iris}[ch]]
    face = {(x, y): rgb(c) for y, row in enumerate(px) for x, c in enumerate(row) if c}
    xs = [x for x, _ in face]
    dx, dy = 16 - (min(xs) + max(xs) + 1) // 2, -min(y for _, y in face)
    return tile(32, {(x + dx, y + dy): c for (x, y), c in face.items() if 0 <= y + dy < 32}, ground, 2)


def favicon_16():
    px = {(x, y): rgb(K[INK[ch]]) for y, row in enumerate(ARCHIE_16) for x, ch in enumerate(row) if ch != "."}
    return tile(16, px, ground, 1)


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
            assert in_safe_zone(subject, size, scale), f"{name}: Archie's face leaves the safe zone at x{scale}"
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
    """The master at 1x: the portrait on sky, MASTER square, centred as the icons centre it."""
    subject = portrait()
    cx, cy = CENTRE
    x0, y0 = int(cx - MASTER / 2), int(cy - MASTER / 2)
    bg = ground
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
