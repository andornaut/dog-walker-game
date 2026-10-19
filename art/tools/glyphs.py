#!/usr/bin/env python3
"""Draw the info icons shown beside a dog in the pack picker, the shop and the zone banner, the
dog status icons on the doghouse heart board, and the run top bar's state strip icons.

16x16 images in Endesga 32 with coloured outlines, on transparency:
icon-trait-<trait>          fancy (a pink bow), food-driven (a bone), chaser (a squirrel)
icon-energy-<energy>        calm (a sleepy moon), steady (a paw print), hyper (a lightning bolt)
icon-owner-<temperament>    laid-back (sunglasses and a grin), fussy (a frown and a cross mark),
                            dramatic (a wail and a tear)
icon-zone-<zone>            woof-way (a house), bark-park (a tree), sniff-street-shops
                            (a shopfront), the-long-way-home (a sunset over a path)
icon-soaked, icon-spooked   dog statuses beside icon-stinky (ui.py), on cream: water drops; a
                            wide-eyed dog face with a sweat drop
icon-upgrade-<upgrade>      state strip, on the top bar's ink: belly-rubs (a hand under a heart),
                            big-tipper (coins and an up arrow), good-leash (a leash), raincoats
                            (a yellow raincoat), rush-hour (an alarm clock), second-wind (two
                            hearts on the wind), shortcut (two chevrons), sweet-talker (a speech
                            bubble with $ and a down arrow), treat-magnet (a magnet and a bone)
icon-gear-<gear>            state strip, on ink: the shop's item art (icons.py) at 16x16
The upgrade and gear ids are the data ids in kebab case. icon-stinky also reads on ink.

Usage:
  glyphs.py preview OUT.png   every icon on the UI's paper, panel, wood and ink colours, scaled up
  glyphs.py build             write art/glyphs/*.aseprite and public/art/images/*.png,
                              and list them in the manifest's "images"

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import json
import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from pixel import Grid  # noqa: E402
from ui import to_image  # noqa: E402


def bitmap(g, x0, y0, rows, cols):
    """Stamp rows of characters; each character maps to a colour in cols, '.' is empty."""
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in cols:
                g.p(x0 + x, y0 + y, cols[ch])


# ---------- traits ----------

def fancy():
    g = Grid(16, 16)
    for s in (-1, 1):
        g.tri((8, 8), (8 + s * 7, 2.5), (8 + s * 7, 13.5), "pink")
        g.ell(8 + s * 5, 8, 2.6, 4.6, "pink")
        g.p(8 + s * 6, 11, "mauve")
        g.p(8 + s * 5, 12, "mauve")
        g.p(8 + s * 5, 5, "white" if s < 0 else "pink")
    g.tri((7, 9), (5, 14), (7.5, 14), "mauve")
    g.tri((9, 9), (11, 14), (8.5, 14), "mauve")
    g.ell(8, 8, 2, 2.5, "hot")
    g.p(7, 7, "pink")
    return g


def food_driven():
    g = Grid(16, 16)
    for i in range(11):
        g.rect(3 + i, 11 - i, 2, 2, "cream")
    for cx, cy in ((2.5, 11.5), (4.5, 13.5), (11.5, 2.5), (13.5, 4.5)):
        g.ell(cx, cy, 2, 2, "cream", "tan")
    for i in range(8):
        g.p(6 + i, 11 - i, "tan")
    g.p(10, 3, "white")
    g.p(11, 2, "white")
    return g


def chaser():
    g = Grid(16, 16)
    g.ell(11.5, 6, 3.5, 5.5, "ochre", "rust", "tan")
    g.ell(11.5, 6.5, 1.5, 3.5, "tan")
    g.ell(8.5, 9, 1.4, 4, "rust")
    g.ell(7, 11, 3.5, 3.8, "ochre", "rust", "tan")
    g.ell(5.5, 12, 1.6, 2.4, "cream")
    g.ell(5, 6, 3, 2.8, "ochre", "rust", "tan")
    g.p(6, 3, "ochre")
    g.p(6, 2, "rust")
    g.rect(4, 5, 1, 2, "ink")
    g.p(2, 7, "plum")
    g.rect(4, 14, 2, 1, "rust")
    return g


# ---------- energy ----------

def calm():
    g = Grid(16, 16)
    g.ell(7, 9, 5.5, 5.5, "lgrey", "grey", "white")
    g.ell(9.5, 7, 4.5, 4.5, None)
    bitmap(g, 10, 1, ["111", "..1", ".1.", "1..", "111"], {"1": "sky"})
    return g


def steady():
    g = Grid(16, 16)
    g.ell(8, 11.5, 3.6, 3, "brown", "dbrown", "ochre")
    for cx, cy in ((2.5, 7), (6, 4), (10, 4), (13.5, 7)):
        g.ell(cx, cy, 1.5, 1.8, "brown", "dbrown", "ochre")
    return g


def hyper():
    g = Grid(16, 16)
    g.tri((10, 0.5), (3, 9.5), (8.5, 9.5), "yellow")
    g.tri((7.5, 6.5), (13, 6.5), (5, 15.5), "yellow")
    g.tri((8.5, 9.5), (13, 6.5), (5, 15.5), "amber")
    g.p(8, 3, "white")
    return g


# ---------- owner temperaments: one face, three moods ----------

def face():
    g = Grid(16, 16)
    g.ell(8, 8.5, 6.5, 6.5, "skin1", "skin2")
    return g


def laid_back():
    g = face()
    g.rect(3, 6, 4, 3, "ink")
    g.rect(9, 6, 4, 3, "ink")
    g.rect(7, 6, 2, 1, "ink")
    g.p(4, 6, "slate")
    g.p(10, 6, "slate")
    bitmap(g, 5, 10, ["1....1", ".1111."], {"1": "dbrown"})
    return g


def fussy():
    g = face()
    bitmap(g, 3, 5, ["11....11", "..1..1.."], {"1": "dbrown"})
    g.rect(5, 7, 1, 2, "ink")
    g.rect(10, 7, 1, 2, "ink")
    bitmap(g, 5, 11, [".111.", "1...1"], {"1": "dbrown"})
    bitmap(g, 11, 1, ["1.1", ".1.", "1.1"], {"1": "red"})
    return g


def dramatic():
    g = face()
    bitmap(g, 3, 4, [".11....11.", "1........1"], {"1": "dbrown"})
    for x in (4, 10):
        g.rect(x, 6, 2, 3, "ink")
        g.p(x, 6, "white")
    g.ell(8, 12, 1.6, 2, "plum")
    g.p(8, 13, "red")
    g.rect(11, 9, 1, 2, "cyan")
    g.rect(11, 11, 2, 2, "cyan")
    g.p(11, 11, "white")
    return g


# ---------- zones, after their backdrops ----------

def woof_way():
    g = Grid(16, 16)
    g.tri((0.5, 7.5), (8, 1), (15.5, 7.5), "red")
    g.rect(1, 7, 14, 1, "dred")
    g.rect(2, 8, 12, 7, "cream")
    g.rect(13, 8, 1, 7, "tan")
    g.rect(4, 10, 3, 5, "sky")
    g.p(6, 12, "amber")
    g.rect(9, 9, 3, 3, "cyan")
    g.rect(9, 9, 3, 1, "white")
    return g


def bark_park():
    g = Grid(16, 16)
    g.rect(7, 9, 2, 5, "dbrown")
    g.ell(8, 6.5, 6.5, 5.5, "green", "dgreen")
    g.p(4, 4, "yellow")
    g.p(5, 3, "yellow")
    g.p(5, 7, "dgreen")
    g.p(10, 4, "dgreen")
    g.rect(1, 13, 14, 2, "dgreen")
    g.rect(1, 13, 14, 1, "green")
    return g


def sniff_street_shops():
    g = Grid(16, 16)
    g.rect(1, 2, 14, 13, "rust")
    g.rect(14, 2, 1, 13, "dbrown")
    for x in range(1, 15, 4):
        g.rect(x, 4, 2, 3, "red")
        g.rect(x + 2, 4, 2, 3, "white")
    g.rect(1, 7, 14, 1, "dred")
    g.rect(2, 9, 7, 5, "cyan")
    g.p(3, 10, "white")
    g.rect(10, 9, 3, 6, "dbrown")
    g.p(12, 12, "amber")
    g.rect(1, 2, 14, 1, "ochre")
    return g


def the_long_way_home():
    g = Grid(16, 16)
    g.ell(8, 9, 5, 5, "amber", "orange", "yellow")
    for x, y in ((8, 1), (2, 5), (14, 5), (1, 9), (15, 9)):
        g.p(x, y, "amber")
    g.ell(8, 16, 9, 6, "green", "dgreen")
    g.tri((7.5, 10), (8.5, 10), (12, 16), "tan")
    g.tri((7.5, 10), (4, 16), (12, 16), "tan")
    return g


# ---------- dog statuses, on the doghouse's cream heart board beside icon-stinky ----------
# Like icon-stinky, each reads on cream by its outline (navy, blue, dbrown and plum hold 5.8:1
# or more there) and differs from the others by shape: drops, a scared face, stink lines.

def drop(g, cx, top, r, fill, sh=None, li=None):
    """A water drop: a point at (cx, top) over a round base of radius r."""
    base = top + 2.2 * r
    g.tri((cx, top), (cx - r * 0.93, base - r * 0.4), (cx + r * 0.93, base - r * 0.4), fill)
    g.ell(cx, base, r, r, fill, sh, li)


def soaked():
    """One big drop and two small ones falling beside it."""
    g = Grid(16, 16)
    drop(g, 6, 1, 4.6, "sky", "blue", "cyan")
    g.rect(5, 4, 1, 3, "cyan")
    g.rect(3, 9, 1, 3, "white")
    g.p(4, 8, "white")
    for x, y in ((12, 1), (12, 9)):
        bitmap(g, x, y, [".s.", ".s.", "sss", "ssb", ".b."], {"s": "sky", "b": "blue"})
    return g


def spooked():
    """A dog's face gone wide-eyed, ears flat and a wobbly mouth, with a sweat drop."""
    g = Grid(16, 16)
    g.ell(8, 9, 5, 5, "tan")
    for s in (-1, 1):
        g.ell(8 + s * 5, 8.5, 1.6, 3.6, "brown")
    g.ell(8, 10.8, 2.6, 1.8, "cream")
    for x in (5, 9):
        g.rect(x, 6, 2, 3, "white")
    g.p(6, 7, "ink")
    g.p(9, 7, "ink")
    g.rect(7, 9, 2, 1, "ink")
    bitmap(g, 6, 11, ["1.1.", ".1.1"], {"1": "plum"})
    bitmap(g, 12, 0, [".c.", ".c.", "ccs", "css", ".s."], {"c": "cyan", "s": "sky"})
    return g


# ---------- the state strip, in the top bar's ink wells (#181425) ----------
# Every fill that carries a shape holds 3:1 or more on ink; the darker coloured outlines sink
# into the well, so the silhouette is the fill. Dark ramp colours (dbrown, dred, forest, blue)
# appear only inside a lighter fill.

HEART = [".11.11.", "1111111", "1111111", ".11111.", "..111..", "...1..."]
BIG_HEART = [".111.111.", "11111111p", "1111111pp", "111111ppp", ".11111pp.", "..111pp..", "...1pp...", "....p...."]


def heart(g, x, y, big=False):
    bitmap(g, x, y, BIG_HEART if big else HEART, {"1": "red", "p": "hot"})
    g.p(x + 1, y + 1, "pink")


def belly_rubs():
    """A hand rubbing below a heart."""
    g = Grid(16, 16)
    heart(g, 6, 1, big=True)
    bitmap(g, 1, 9, ["....ssssss..", "ssssssssssss", "sssssddddd..", "sssssssssss.", "ssssdddd....",
                     "ssssssssss.."], {"s": "skin1", "d": "skin2"})
    return g


def second_wind():
    """Two hearts lifted on gusts of wind."""
    g = Grid(16, 16)
    heart(g, 8, 2)
    heart(g, 6, 8)
    for x, y, w in ((1, 4, 5), (0, 10, 4), (2, 14, 6)):
        g.rect(x, y, w, 1, "white")
    g.p(6, 3, "white")
    g.p(8, 15, "white")
    return g


def big_tipper():
    """A stack of coins with an arrow up."""
    g = Grid(16, 16)
    for x, y in ((1, 12), (2, 10), (1, 8), (2, 6)):
        g.rect(x, y, 8, 2, "amber")
        g.rect(x, y + 1, 8, 1, "orange")
        g.p(x + 1, y, "yellow")
    g.ell(6, 4.5, 4, 2, "yellow", "amber")
    g.rect(4, 4, 4, 1, "amber")
    g.tri((13, 0.5), (9.5, 5.5), (16.5, 5.5), "green")
    g.rect(12, 5, 2, 9, "green")
    return g


def good_leash():
    """A leash: a handle loop, the line and its clip."""
    g = Grid(16, 16)
    g.ell(4.5, 4.5, 3.8, 3.8, "red", None, "pink")
    g.ell(4.5, 4.5, 1.8, 1.8, None)
    for i in range(6):
        g.rect(7 + i, 7 + i, 2, 1, "red")
    g.ell(13, 13, 2.3, 2.3, "lgrey", "grey", "white")
    g.p(13, 13, "slate")
    return g


def raincoats():
    """A yellow raincoat with its hood up, and a drop of rain."""
    g = Grid(16, 16)
    bitmap(g, 2, 2, [
        "....yyyy....",
        "...yyyyya...",
        "..yy....ya..",
        "..yy....ya..",
        ".yyyy..yyaa.",
        "yyyyyyyyyyaa",
        "yyy.yyyy.yaa",
        "yy..yykyy.aa",
        "....yyyyya..",
        "....yykyya..",
        "...yyyyyyya.",
        "...yyyyyyaa.",
        "...yyyyyaaa.",
    ], {"y": "yellow", "a": "amber", "k": "orange"})
    drop(g, 1.5, 0, 1.3, "cyan", "sky")
    return g


def treat_magnet():
    """A horseshoe magnet pulling a bone."""
    g = Grid(16, 16)
    g.ell(10, 6.5, 5, 5, "red", None, "pink")
    g.ell(10, 6.5, 2, 2, None)
    g.rect(5, 6, 11, 6, None)
    g.rect(5, 6, 3, 4, "red")
    g.rect(12, 6, 3, 4, "red")
    g.rect(5, 10, 3, 2, "lgrey")
    g.rect(12, 10, 3, 2, "lgrey")
    bitmap(g, 0, 12, ["cc...cc", ".ccccc.", "cc...cc"], {"c": "cream"})
    bitmap(g, 3, 7, ["1.", "..", ".1"], {"1": "lgrey"})
    return g


def sweet_talker():
    """A speech bubble saying money goes down."""
    g = Grid(16, 16)
    g.rect(1, 2, 14, 9, "white")
    g.rect(0, 3, 16, 7, "white")
    g.rect(1, 10, 14, 1, "lgrey")
    g.tri((3, 10), (3, 15), (7, 10), "white")
    bitmap(g, 3, 3, [".s.", "sss", "s..", "sss", "..s", "sss", ".s."], {"s": "forest"})
    bitmap(g, 8, 3, ["..d..", "..d..", "..d..", "ddddd", ".ddd.", "..d.."], {"d": "dred"})
    return g


def shortcut():
    """Two chevrons pointing ahead."""
    g = Grid(16, 16)
    for x0 in (1, 7):
        for i in range(6):
            g.rect(x0 + i, 2 + i, 3, 1, "amber")
            g.rect(x0 + i, 13 - i, 3, 1, "orange" if i < 5 else "amber")
    return g


def rush_hour():
    """An alarm clock ringing."""
    g = Grid(16, 16)
    g.ell(3.5, 3.5, 2.5, 2.5, "amber", "orange", "yellow")
    g.ell(12.5, 3.5, 2.5, 2.5, "amber", "orange", "yellow")
    g.rect(3, 13, 2, 3, "lgrey")
    g.rect(11, 13, 2, 3, "lgrey")
    g.ell(8, 9, 6, 6, "red", None, "pink")
    g.ell(8, 9, 4, 4, "white", "lgrey")
    g.rect(8, 6, 1, 4, "ink")
    g.rect(9, 9, 2, 1, "ink")
    return g


# The gear, after its 32x32 item art in icons.py.

def gear_fanny_pack():
    g = Grid(16, 16)
    g.rect(0, 5, 16, 2, "brown")
    g.rect(12, 4, 3, 4, "lgrey")
    g.ell(7.5, 10, 6.5, 4.5, "amber", "orange", "yellow")
    g.rect(3, 9, 9, 1, "orange")
    g.p(11, 9, "lgrey")
    return g


def gear_whistle():
    g = Grid(16, 16)
    g.ell(6, 10, 4.5, 4.5, "lgrey", "grey", "white")
    g.rect(8, 5, 7, 4, "lgrey")
    g.rect(8, 8, 7, 1, "grey")
    g.rect(5, 9, 2, 2, "slate")
    g.rect(1, 2, 2, 5, "red")
    g.rect(1, 1, 7, 2, "red")
    return g


def gear_poop_bags():
    g = Grid(16, 16)
    g.ell(7, 7.5, 6, 6, "green", "dgreen", "yellow")
    g.ell(7, 7.5, 2, 2, "forest")
    g.tri((10, 10), (15.5, 14), (11, 15), "green")
    g.rect(11, 11, 2, 2, "green")
    return g


def gear_running_shoes():
    g = Grid(16, 16)
    g.ell(8, 9.5, 7, 4, "sky", None, "cyan")
    g.rect(1, 11, 14, 2, "white")
    g.rect(1, 13, 14, 1, "lgrey")
    g.rect(4, 6, 5, 1, "white")
    g.rect(10, 8, 4, 2, "orange")
    return g


def gear_lucky_collar():
    g = Grid(16, 16)
    g.ell(8, 6, 6.5, 4.5, "red", None, "pink")
    g.ell(8, 6, 4.5, 2.5, None)
    g.ell(8, 12, 3, 3, "amber", "orange", "yellow")
    for x, y in ((7, 11), (8, 11), (7, 12), (9, 12), (8, 13)):
        g.p(x, y, "green")
    return g


IMAGES = {
    "icon-trait-fancy": fancy,
    "icon-trait-food-driven": food_driven,
    "icon-trait-chaser": chaser,
    "icon-energy-calm": calm,
    "icon-energy-steady": steady,
    "icon-energy-hyper": hyper,
    "icon-owner-laid-back": laid_back,
    "icon-owner-fussy": fussy,
    "icon-owner-dramatic": dramatic,
    "icon-zone-woof-way": woof_way,
    "icon-zone-bark-park": bark_park,
    "icon-zone-sniff-street-shops": sniff_street_shops,
    "icon-zone-the-long-way-home": the_long_way_home,
    "icon-soaked": soaked,
    "icon-spooked": spooked,
    "icon-upgrade-belly-rubs": belly_rubs,
    "icon-upgrade-big-tipper": big_tipper,
    "icon-upgrade-good-leash": good_leash,
    "icon-upgrade-raincoats": raincoats,
    "icon-upgrade-rush-hour": rush_hour,
    "icon-upgrade-second-wind": second_wind,
    "icon-upgrade-shortcut": shortcut,
    "icon-upgrade-sweet-talker": sweet_talker,
    "icon-upgrade-treat-magnet": treat_magnet,
    "icon-gear-fanny-pack": gear_fanny_pack,
    "icon-gear-lucky-collar": gear_lucky_collar,
    "icon-gear-poop-bags": gear_poop_bags,
    "icon-gear-running-shoes": gear_running_shoes,
    "icon-gear-whistle": gear_whistle,
}


def image(draw):
    return to_image(draw().outlined())


def preview(out, scale=6):
    grounds = [(234, 212, 170), (228, 166, 114), (115, 62, 57), (58, 68, 102), (24, 20, 37)]
    sheet = Image.new("RGB", (20 * len(IMAGES) * scale, 20 * len(grounds) * scale), (62, 39, 49))
    for i, draw in enumerate(IMAGES.values()):
        im = image(draw)
        for j, ground in enumerate(grounds):
            tile = Image.new("RGB", (16, 16), ground)
            tile.paste(im, (0, 0), im)
            sheet.paste(tile.resize((16 * scale, 16 * scale), Image.NEAREST), (i * 20 * scale, j * 20 * scale))
    sheet.save(out)


def build():
    os.makedirs("art/glyphs", exist_ok=True)
    os.makedirs("public/art/images", exist_ok=True)
    for key, draw in IMAGES.items():
        png = f"public/art/images/{key}.png"
        image(draw).save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/glyphs/{key}.aseprite"], check=True)
    path = "public/art/manifest.json"
    manifest = json.load(open(path))
    entries = {i["key"]: i for i in manifest.get("images", [])}
    for key in IMAGES:
        entries[key] = {"key": key, "png": f"images/{key}.png"}
    manifest["images"] = sorted(entries.values(), key=lambda i: i["key"])
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print("built", ", ".join(IMAGES))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
