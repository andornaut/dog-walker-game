#!/usr/bin/env python3
"""Draw the shop's gear icons.

item-<id>: 32x32 images in Endesga 32 with coloured outlines, on transparency.
The ids are the shop's data ids in kebab case: item-hall-pass is the Hall pass, a
cream pass card on a lanyard.

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
from pixel import Grid, bitmap, to_image  # noqa: E402


# ---------- gear ----------

def fanny_pack(g):
    g.rect(2, 12, 28, 2, "brown")
    g.rect(25, 11, 4, 4, "lgrey")
    g.ell(15, 19, 9.5, 6.5, "amber", "orange", "yellow")
    g.rect(8, 17, 15, 1, "orange")
    g.p(22, 17, "lgrey")


def hall_pass(g):
    """The Hall pass: a cream pass card on a sky lanyard, its clip through a slot punched in the red
    header band, a dred paw stamp on the left and brown lines of print on the right."""
    for i in range(9):
        g.p(7 + i, i, "sky")
        g.p(8 + i, i, "blue")
        g.p(24 - i, i, "sky")
        g.p(23 - i, i, "blue")
    g.rect(3, 12, 26, 17, "cream")
    g.rect(3, 12, 26, 5, "red")
    g.rect(3, 12, 26, 1, "pink")
    g.rect(28, 12, 1, 17, "tan")
    g.rect(3, 28, 26, 1, "tan")
    g.rect(28, 12, 1, 5, "dred")
    g.rect(13, 13, 6, 2, None)
    g.rect(14, 8, 4, 2, "lgrey")
    g.rect(15, 10, 2, 5, "lgrey")
    g.p(17, 9, "grey")
    for x, y in ((6, 20), (9, 18), (13, 18), (16, 20)):
        g.rect(x, y, 2, 2, "dred")
    g.ell(11.5, 24.5, 4, 2.6, "dred")
    for y, w in ((20, 7), (23, 7), (26, 5)):
        g.rect(20, y, w, 1, "brown")


def running_shoes(g):
    """A low running shoe side on, the toe to the left: a sky upper lit cyan along its top, three white
    laces, a navy collar, an orange stripe and heel tab, and a white sole with a toe spring on a lugged
    lgrey outsole."""
    bitmap(g, 2, 10, [
        "......................oo...",
        "...............ccccccccoo..",
        "..............cwwnnnnnnsoo.",
        ".............cssbnnnnnnsss.",
        "...........ccwwssssssssssb.",
        ".........ccsssbsssssoooossb",
        ".......ccswwsssssoooosssssb",
        ".....ccssssssooooossssssssb",
        "...ccsssssooooosssssssssssb",
        ".cccsssssssssssssssssssssbb",
        ".sbbbbbbbbbbbbbbbbbbbbbbbbb",
        ".wwwwwwwwwwwwwwwwwwwwwwwwww",
        "..wwwwwwwwwwwwwwwwwwwwwwwww",
        "...lglglglglglglglglglglgl.",
    ], {"b": "blue", "c": "cyan", "g": "grey", "l": "lgrey", "n": "navy", "o": "orange", "s": "sky",
        "w": "white"})


def lucky_collar(g):
    g.ell(16, 13, 11, 7, "red", "dred", "pink")
    g.ell(16, 13, 8, 4.5, None)
    g.ell(16, 23, 4, 4, "amber", "orange", "yellow")
    for cx, cy in ((14.5, 22.5), (17.5, 22.5), (16, 24.8)):
        g.ell(cx, cy, 1.6, 1.6, "green")


def whistle(g):
    """The whistle: a silver sports whistle side on, lit white along its top, its mouthpiece
    running right with an ink slot on top, a dred paw stamped on the barrel, and three cyan sound
    lines fanning up from the slot."""
    g.ell(13, 20, 9, 8, "lgrey", "grey", "white")
    g.rect(13, 12, 17, 7, "lgrey")
    g.rect(13, 12, 17, 1, "white")
    g.rect(13, 18, 17, 1, "grey")
    g.rect(29, 12, 1, 7, "grey")
    g.rect(15, 12, 5, 3, None)
    g.rect(15, 14, 5, 1, "dslate")
    for x, y in ((10, 17), (12, 17), (9, 18), (13, 18)):
        g.p(x, y, "dred")
    g.rect(10, 19, 3, 3, "dred")
    for x, y in ((16, 9), (16, 8), (16, 7), (20, 9), (21, 8), (22, 7), (12, 9), (11, 8), (10, 7)):
        g.p(x, y, "cyan")


ICONS = {
    "whistle": whistle,
    "fanny-pack": fanny_pack,
    "hall-pass": hall_pass,
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
