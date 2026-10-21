#!/usr/bin/env python3
"""Draw the home-screen app icons.

The favicon's dog face on a full-bleed sunburst of rust and ochre rays, in
Endesga 32 and fully opaque. The master is 36x36: the 30x25 face on the rays,
3 columns in from each side, 5 rows from the top. Each icon scales the master by a whole number with nearest-neighbour
and extends the rays to its exact size, so every icon pixel is one master pixel.

  apple-touch-icon.png    180x180  master x5
  icon-192.png            192x192  master x5, rays extended by 6px a side
  icon-512.png            512x512  master x14, rays extended by 4px a side
  icon-maskable-512.png   512x512  the largest whole scale that keeps the face
                                   inside the central 80% safe circle

Usage:
  appicons.py preview OUT.png   every icon at its native size on ink, then the
                                maskable icon cropped to a circle with the safe
                                zone marked, and the icons at home-screen size
  appicons.py build             write public/icons/<icon>.png and the master as
                                art/appicon.aseprite

Run from the repository root. The icons are not in public/art/manifest.json:
the pages and the web app manifest link them by path. A build overwrites
art/appicon.aseprite, so change this file, not the source.
"""

import math
import os
import subprocess
import sys
import tempfile

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from pixel import K, PALETTE  # noqa: E402

MASTER = 36

# The favicon's face (public/art/favicon.png, rows 4 to 28, columns 1 to 30).
FACE = [
    "..........bbbbbboooo..........",
    "........bbccccccttttoo........",
    ".......bcccccccttttttto.......",
    "......bcccccccttttttttto......",
    "..ooooccccccctttttttttttoooo..",
    ".ossssccccccttttttttttttsssso.",
    ".ossssccccctttttttttttttsssso.",
    "ossssssccctttttttttttttsssssso",
    "ossssssccttttttttttttttsssssso",
    "ossssssctwkkttttttwkkttsssssso",
    "ossssssttkkkttttttkkkttsssssso",
    "ossssssttkkkttttttkkktssssssso",
    "ossssssttttttttttttttsssssssso",
    "osssssstttttccccccttssssssssso",
    "osssssstttccckkkkcccssssssssso",
    "osssssstttccckkkkcccssssssssso",
    "ossssssttccccccccccccsssssssso",
    ".ossssttttccccccccccsssssssso.",
    ".ossssotttccccccccccsssosssso.",
    "..oooo.ottttccppccsssso.oooo..",
    "........oottssppssssoo........",
    "........nnooooppoooonn........",
    ".......nyyyyyyyyyyyyyyn.......",
    ".......nyyyyyyyyyyyyyyn.......",
    "........nnnnnnnnnnnnnn........",
]
INK = dict(o="dbrown", b="brown", c="cream", t="tan", s="skin2", w="white", k="ink", p="pink", n="navy", y="sky")
FACE_X, FACE_Y = 3, 5  # the face's top-left in the master: 3 columns each side, 5 rows above, 6 below

# The rays radiate from the middle of the head, behind the eyes.
RAY_CX, RAY_CY = 18, 16.5
RAYS = 12
RAY_DARK, RAY_LIGHT = "rust", "ochre"

SAFE = 0.4  # the maskable safe zone: a circle of radius 40% of the icon size


def face(mx, my):
    """The face colour at master pixel (mx, my), or None where the rays show."""
    fx, fy = mx - FACE_X, my - FACE_Y
    if 0 <= fy < len(FACE) and 0 <= fx < len(FACE[0]) and FACE[fy][fx] != ".":
        return K[INK[FACE[fy][fx]]]
    return None


def ray(mx, my):
    """The ray colour at master pixel (mx, my). Defined past the master's edges so an icon can extend it."""
    turn = math.atan2(my + 0.5 - RAY_CY, mx + 0.5 - RAY_CX) / (2 * math.pi) + 1
    return K[RAY_LIGHT if int(turn * RAYS * 2 + 0.5) % 2 else RAY_DARK]


def master_px(mx, my):
    return face(mx, my) or ray(mx, my)


def rgb(c):
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def render(size, scale):
    """The master at a whole scale, centred on a size x size canvas, the rays carried to its edges."""
    off = (size - MASTER * scale) // 2
    assert (size - MASTER * scale) % 2 == 0, f"{size} - {MASTER}x{scale} does not centre"
    cells = {}
    img = Image.new("RGB", (size, size))
    for y in range(size):
        my = (y - off) // scale
        for x in range(size):
            mx = (x - off) // scale
            if (mx, my) not in cells:
                cells[mx, my] = rgb(master_px(mx, my))
            img.putpixel((x, y), cells[mx, my])
    return img


def face_in_safe_zone(size, scale):
    """Whether every corner of every face pixel lies inside the safe circle."""
    off = (size - MASTER * scale) / 2
    c, r = size / 2, SAFE * size
    for fy, row in enumerate(FACE):
        for fx, ch in enumerate(row):
            if ch == ".":
                continue
            x0, y0 = off + (FACE_X + fx) * scale, off + (FACE_Y + fy) * scale
            for x, y in ((x0, y0), (x0 + scale, y0), (x0, y0 + scale), (x0 + scale, y0 + scale)):
                if math.hypot(x - c, y - c) > r:
                    return False
    return True


def maskable_scale(size):
    return max(s for s in range(1, size // MASTER + 1)
               if (size - MASTER * s) % 2 == 0 and face_in_safe_zone(size, s))


ICONS = {
    "apple-touch-icon": (180, 5),
    "icon-192": (192, 5),
    "icon-512": (512, 14),
    "icon-maskable-512": (512, maskable_scale(512)),
}


def check(name, img, size):
    """Exact size, opaque RGB, every pixel an Endesga 32 colour."""
    assert img.size == (size, size), f"{name}: {img.size}"
    assert img.mode == "RGB", f"{name}: mode {img.mode}"
    palette = {rgb(c) for c in PALETTE}
    stray = {c for _, c in img.getcolors(size * size)} - palette
    assert not stray, f"{name}: off-palette {stray}"


def icons():
    for name, (size, scale) in ICONS.items():
        img = render(size, scale)
        check(name, img, size)
        yield name, img


def preview(out, gap=16):
    imgs = dict(icons())
    big = imgs["icon-maskable-512"]
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
    row = list(imgs.values()) + [masked]
    small = [im.resize((60, 60), Image.LANCZOS)
             for im in (imgs["apple-touch-icon"], imgs["icon-192"], imgs["icon-512"])]
    width = sum(im.size[0] for im in row) + gap * (len(row) + 1)
    sheet = Image.new("RGB", (width, gap * 3 + 512 + 60), rgb(K["ink"]))
    x = gap
    for im in row:
        sheet.paste(im, (x, gap))
        x += im.size[0] + gap
    x = gap
    for im in small:
        sheet.paste(im, (x, gap * 2 + 512))
        x += 60 + gap
    sheet.save(out)


def build():
    os.makedirs("public/icons", exist_ok=True)
    for name, img in icons():
        img.save(f"public/icons/{name}.png", optimize=True)
    with tempfile.TemporaryDirectory() as tmp:
        png = os.path.join(tmp, "appicon.png")
        master = Image.new("RGB", (MASTER, MASTER))
        for y in range(MASTER):
            for x in range(MASTER):
                master.putpixel((x, y), rgb(master_px(x, y)))
        master.save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", "art/appicon.aseprite"], check=True)
    print("built", ", ".join(f"{n} {s}x{s} (master x{k})" for n, (s, k) in ICONS.items()), "and art/appicon.aseprite")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
