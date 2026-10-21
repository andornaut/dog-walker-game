#!/usr/bin/env python3
"""Draw the shop's gear icons.

item-<id>: 32x32 images in Endesga 32 with coloured outlines, on transparency.
The ids are the shop's data ids in kebab case.

Usage:
  icons.py preview OUT.png   every icon on the shop's slot colours, scaled up
  icons.py build             write art/icons/*.aseprite and public/art/images/*.png

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from pixel import Grid, to_image  # noqa: E402


# ---------- gear ----------

def fanny_pack(g):
    g.rect(2, 12, 28, 2, "dbrown")
    g.rect(25, 11, 4, 4, "lgrey")
    g.ell(15, 19, 9.5, 6.5, "amber", "orange", "yellow")
    g.rect(8, 17, 15, 1, "orange")
    g.p(22, 17, "lgrey")


def poop_bags(g):
    g.ell(14, 16, 9, 9, "green", "dgreen", "yellow")
    g.ell(14, 16, 3, 3, "forest")
    g.tri((20, 21), (29, 27), (22, 28), "green")
    g.rect(22, 22, 4, 4, "green")


def running_shoes(g):
    g.ell(16, 20, 12, 5, "sky", "blue", "cyan")
    g.rect(5, 23, 23, 3, "white")
    g.rect(5, 25, 23, 1, "lgrey")
    g.rect(10, 15, 8, 2, "white")
    g.rect(21, 18, 6, 2, "orange")


def lucky_collar(g):
    g.ell(16, 13, 11, 7, "red", "dred", "pink")
    g.ell(16, 13, 8, 4.5, None)
    g.ell(16, 23, 4, 4, "amber", "orange", "yellow")
    for cx, cy in ((14.5, 22.5), (17.5, 22.5), (16, 24.8)):
        g.ell(cx, cy, 1.6, 1.6, "green")


ICONS = {
    "fanny-pack": fanny_pack,
    "poop-bags": poop_bags,
    "running-shoes": running_shoes,
    "lucky-collar": lucky_collar,
}


def image(draw):
    g = Grid(32, 32)
    draw(g)
    return to_image(g.outlined())


def preview(out, scale=4):
    grounds = [(234, 212, 170), (228, 166, 114)]
    sheet = Image.new("RGB", ((36 * len(ICONS)) * scale, 36 * len(grounds) * scale), (24, 20, 37))
    for i, draw in enumerate(ICONS.values()):
        im = image(draw)
        for j, ground in enumerate(grounds):
            tile = Image.new("RGB", (32, 32), ground)
            tile.paste(im, (0, 0), im)
            sheet.paste(tile.resize((32 * scale, 32 * scale), Image.NEAREST), (i * 36 * scale, j * 36 * scale))
    sheet.save(out)


def build():
    os.makedirs("art/icons", exist_ok=True)
    os.makedirs("public/art/images", exist_ok=True)
    for name, draw in ICONS.items():
        key = f"item-{name}"
        png = f"public/art/images/{key}.png"
        image(draw).save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/icons/{key}.aseprite"], check=True)
    print("built", ", ".join(f"item-{n}" for n in ICONS))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
