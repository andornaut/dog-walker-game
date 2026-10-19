#!/usr/bin/env python3
"""Draw the four zone backdrops: the neighbourhood band between the top bar and the road.

backdrop-<zone>: 360x150 images in Endesga 32. Sky at the top, the zone's
buildings or trees, then front yards, a sidewalk, and a curb along the bottom
row that meets the road. The scenery gags (cat on a fence, sprinkler, rolling
ball) are separate sprites the game places in this band.

Usage:
  backdrops.py preview OUT.png   all four, stacked, scaled up
  backdrops.py build             write art/backdrops/*.aseprite and
                                 public/art/images/*.png, and list them in the manifest

Run from the repository root, after fonts.py build. A build overwrites the
.aseprite sources, so hand edits to them belong in this file instead.
"""

import json
import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import fonts  # noqa: E402
import help as hp  # noqa: E402
from pixel import DARKER, K  # noqa: E402

W, H = 360, 150
TITLE = None


def dk(c):
    return DARKER[K.get(c, c)]


def word(cv, s, mid, y, col):
    """Shop-sign lettering in font-title."""
    global TITLE
    if TITLE is None:
        TITLE = fonts.glyphs(*fonts.FONTS["font-title"][1:])[0]
    width = sum(TITLE[ch][3] for ch in s)
    x = round(mid - width / 2)
    for ch in s:
        mask, ox, oy, adv = TITLE[ch]
        if mask is not None:
            cv.img.paste(hp.rgb(col), (x + ox, y + oy), mask)
        x += adv


def sky(cv, top="cyan", low="sky"):
    cv.fill(0, 0, W, 104, low)
    cv.fill(0, 0, W, 14, top)
    for i in range(0, W, 5):
        cv.fill(i, 14 + (i // 5) % 2, 5, 1, top)
    for x, y, w in ((30, 6, 26), (150, 10, 34), (270, 4, 22)):
        cv.fill(x, y, w, 4, "white")
        cv.fill(x + 4, y - 3, w - 10, 3, "white")
        cv.fill(x, y + 4, w, 1, "lgrey")


def ground(cv, lawn="green"):
    cv.fill(0, 104, W, 26, lawn)
    for i in range(70):
        cv.fill((i * 37) % W, 106 + (i * 11) % 22, 1, 2, dk(lawn))
    cv.fill(0, 130, W, 15, "lgrey")
    for x in range(0, W, 24):
        cv.fill(x, 130, 1, 15, "grey")
    cv.fill(0, 145, W, 3, "grey")
    cv.fill(0, 148, W, 2, "slate")


def house(cv, x, w, wall, roof, door="dred", top=40):
    wall_y = top + 26
    cv.fill(x, wall_y, w, 104 - wall_y, wall)
    cv.fill(x + w - 3, wall_y, 3, 104 - wall_y, dk(wall))
    for i in range(26):
        inset = round(i * (w / 2 + 3) / 26)
        cv.fill(x - 3 + (w // 2 + 3) - inset, top + i, inset * 2, 1, roof)
    cv.fill(x - 3, wall_y - 1, w + 6, 2, dk(roof))
    cv.fill(x + w - 14, top + 4, 6, 12, "brown")
    cv.fill(x + w - 15, top + 2, 8, 2, "dbrown")
    for wx in (x + 6, x + w - 18):
        cv.fill(wx, wall_y + 6, 12, 10, "plum")
        cv.fill(wx + 1, wall_y + 7, 10, 8, "cyan")
        cv.fill(wx + 6, wall_y + 7, 1, 8, "white")
        cv.fill(wx + 1, wall_y + 11, 10, 1, "white")
        cv.fill(wx - 1, wall_y + 16, 14, 2, "white")
    dx = x + w // 2 - 5
    cv.fill(dx, 86, 10, 18, door)
    cv.fill(dx + 7, 95, 1, 2, "amber")
    cv.fill(dx - 2, 102, 14, 2, "lgrey")


def tree(cv, cx, top, leaf="green", shade="dgreen", trunk="dbrown", r=16):
    cv.fill(cx - 3, top + r, 6, 104 - top - r, trunk)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                c = shade if dx + dy > r * 0.5 else ("yellow" if leaf == "green" and dx + dy < -r * 1.1 else leaf)
                cv.fill(cx + dx, top + dy, 1, 1, c)


def fence(cv, y=104, x0=0, x1=W, col="white"):
    for x in range(x0, x1, 6):
        cv.fill(x, y - 10, 4, 14, col)
        cv.fill(x + 3, y - 9, 1, 13, "lgrey")
    cv.fill(x0, y - 6, x1 - x0, 2, "lgrey")


def bush(cv, x, y, col="dgreen"):
    for dx, dy, r in ((0, 0, 6), (8, -2, 7), (16, 0, 6)):
        for yy in range(-r, r + 1):
            for xx in range(-r, r + 1):
                if xx * xx + yy * yy <= r * r and y + dy + yy <= y + 4:
                    cv.fill(x + dx + xx, y + dy + yy, 1, 1, col if xx + yy < 3 else dk(col))


def flowers(cv, x0, x1, y, cols=("red", "yellow", "pink", "white")):
    for i, x in enumerate(range(x0, x1, 4)):
        cv.fill(x, y + (i % 2), 2, 2, cols[i % len(cols)])
        cv.fill(x, y + 2 + (i % 2), 1, 2, "dgreen")


def woof_way():
    cv = hp.Canvas(W, H)
    sky(cv)
    tree(cv, 100, 50)
    for x, w, wall, roof, door in ((6, 70, "cream", "dred", "sky"), (118, 76, "sky", "navy", "red"),
                                    (210, 64, "pink", "purple", "white"), (290, 66, "tan", "brown", "dgreen")):
        house(cv, x, w, wall, roof, door)
    ground(cv)
    fence(cv, 104, 0, 112)
    fence(cv, 104, 200, W)
    bush(cv, 124, 108)
    for x in (82, 280):
        cv.fill(x, 98, 2, 14, "dbrown")
        cv.fill(x - 3, 92, 9, 6, "red")
        cv.fill(x + 6, 89, 2, 4, "amber")
    flowers(cv, 210, 262, 110)
    return cv


def bark_park():
    cv = hp.Canvas(W, H)
    sky(cv)
    for cx, top, r in ((30, 50, 20), (110, 46, 22), (250, 52, 18), (330, 48, 20)):
        tree(cv, cx, top, r=r)
    # the pond
    for dy in range(-10, 11):
        for dx in range(-46, 47):
            if (dx / 46) ** 2 + (dy / 10) ** 2 <= 1:
                cv.fill(180 + dx, 112 + dy, 1, 1, "sky" if dy > -3 else "cyan")
    cv.fill(150, 96, 60, 2, "green")
    ground(cv, "green")
    for dy in range(-8, 9):
        for dx in range(-40, 41):
            if (dx / 40) ** 2 + (dy / 8) ** 2 <= 1:
                cv.fill(180 + dx, 114 + dy, 1, 1, "sky" if dy > -2 else "cyan")
    cv.fill(170, 112, 8, 1, "white")
    cv.fill(190, 116, 6, 1, "white")
    # bench and lamp post
    cv.fill(56, 100, 30, 4, "brown")
    cv.fill(56, 94, 30, 3, "brown")
    cv.fill(58, 104, 2, 8, "dbrown")
    cv.fill(82, 104, 2, 8, "dbrown")
    cv.fill(290, 70, 2, 40, "slate")
    cv.fill(286, 64, 10, 7, "navy")
    cv.fill(288, 66, 6, 4, "yellow")
    # the park sign
    cv.fill(132, 64, 2, 32, "dbrown")
    cv.fill(226, 64, 2, 32, "dbrown")
    cv.fill(126, 58, 108, 16, "dgreen")
    cv.fill(127, 59, 106, 1, "green")
    word(cv, "BARK PARK", 180, 62, "cream")
    return cv


def shops():
    cv = hp.Canvas(W, H)
    sky(cv)
    for x, w, wall, awn, sign in ((0, 92, "rust", "red", "CAFE"), (92, 88, "cream", "dgreen", "PETS"),
                                  (180, 92, "lgrey", "amber", "BAKERY"), (272, 88, "tan", "blue", "BOOKS")):
        cv.fill(x, 30, w, 74, wall)
        cv.fill(x, 30, w, 4, dk(wall))
        cv.fill(x + w - 2, 30, 2, 74, dk(wall))
        # upstairs windows
        for wx in (x + 12, x + w - 26):
            cv.fill(wx, 40, 14, 12, "plum")
            cv.fill(wx + 1, 41, 12, 10, "cyan")
        # sign board, striped awning, shop window and door
        cv.fill(x + 8, 55, w - 16, 13, "plum")
        word(cv, sign, x + w / 2, 57, "cream")
        for i in range(0, w - 4, 8):
            cv.fill(x + 2 + i, 70, 4, 8, awn)
            cv.fill(x + 6 + i, 70, 4, 8, "white")
        cv.fill(x + 2, 77, w - 4, 1, dk(awn))
        cv.fill(x + 8, 80, w - 40, 22, "plum")
        cv.fill(x + 9, 81, w - 42, 20, "cyan")
        cv.fill(x + 12, 84, 8, 1, "white")
        cv.fill(x + w - 26, 80, 14, 24, "dbrown")
        cv.fill(x + w - 16, 91, 1, 2, "amber")
    cv.fill(0, 104, W, 26, "lgrey")
    for x in range(0, W, 24):
        cv.fill(x, 104, 1, 26, "grey")
    cv.fill(0, 117, W, 1, "grey")
    for x in (40, 132, 226, 316):
        cv.fill(x, 108, 14, 10, "brown")
        bush(cv, x - 2, 106, "green")
    cv.fill(0, 130, W, 15, "lgrey")
    cv.fill(0, 145, W, 3, "grey")
    cv.fill(0, 148, W, 2, "slate")
    return cv


def long_way_home():
    cv = hp.Canvas(W, H)
    sky(cv, "amber", "yellow")
    for cx, top in ((60, 46), (300, 50)):
        tree(cv, cx, top, "orange", "rust", r=20)
    for x, w, wall, roof, door in ((92, 80, "white", "dred", "dgreen"), (186, 84, "skin1", "navy", "red")):
        house(cv, x, w, wall, roof, door, top=36)
        cv.fill(x + 8, 82, w - 16, 3, "brown")
        cv.fill(x + 10, 85, 2, 17, "brown")
        cv.fill(x + w - 12, 85, 2, 17, "brown")
        cv.fill(x + w // 2 - 8, 84, 3, 4, "yellow")
    ground(cv)
    flowers(cv, 96, 166, 110)
    flowers(cv, 192, 264, 112, ("orange", "yellow", "red"))
    fence(cv, 104, 0, 88)
    fence(cv, 104, 274, W)
    for x, y in ((20, 120), (40, 116), (320, 118), (340, 122), (176, 120)):
        cv.fill(x, y, 3, 2, "orange")
        cv.fill(x + 1, y - 1, 1, 1, "rust")
    return cv


ZONES = {
    "backdrop-woof-way": woof_way,
    "backdrop-bark-park": bark_park,
    "backdrop-sniff-street-shops": shops,
    "backdrop-the-long-way-home": long_way_home,
}


def preview(out, scale=3):
    sheet = Image.new("RGB", (W * scale, (H + 6) * len(ZONES) * scale), hp.rgb("ink"))
    for i, draw in enumerate(ZONES.values()):
        sheet.paste(draw().img.resize((W * scale, H * scale), Image.NEAREST), (0, i * (H + 6) * scale))
    sheet.save(out)


def build():
    os.makedirs("art/backdrops", exist_ok=True)
    os.makedirs("public/art/images", exist_ok=True)
    for key, draw in ZONES.items():
        png = f"public/art/images/{key}.png"
        draw().img.save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/backdrops/{key}.aseprite"], check=True)
    path = "public/art/manifest.json"
    manifest = json.load(open(path))
    entries = {i["key"]: i for i in manifest.get("images", [])}
    for key in ZONES:
        entries[key] = {"key": key, "png": f"images/{key}.png"}
    manifest["images"] = sorted(entries.values(), key=lambda i: i["key"])
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print("built", ", ".join(ZONES))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
