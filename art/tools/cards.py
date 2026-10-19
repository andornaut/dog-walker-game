#!/usr/bin/env python3
"""Draw the choice card frame and compose the card illustrations.

- card-frame: an 83x140 sprite, one frame per card type (tags encounter, lucky,
  stop, upgrade). The game draws the title in the band, the effect text in the
  body and the cost in the badge. Layout, in card pixels:
    band 2..12 (title), art window 4,15 to 79,72 (illustration at 5,16, 75x56),
    body 6..77 x 76..118, badge 6,121, 71x13.
- card-<encounter>-<option>: 75x56 illustrations, one per option, composed
  from the exported sprites. Build the sprites first.

Usage:
  cards.py preview OUT.png   the frame and every illustration, scaled up
  cards.py build             write art/cards/*.aseprite, the frame to
                             public/art/sprites/ and the illustrations to
                             public/art/images/, and list them in the manifest

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import json
import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import help as hp  # noqa: E402
from pixel import Grid, build as build_sprites  # noqa: E402

CW, CH = 83, 140
AW, AH = 75, 56
BANDS = {"encounter": ("red", "dred"), "lucky": ("sky", "blue"), "stop": ("amber", "orange"), "upgrade": ("dgreen", "forest")}


# ---------- the frame ----------

def card_frame(kind):
    g = Grid(CW, CH)
    band, band_sh = BANDS[kind]
    g.rect(1, 0, CW - 2, CH, "plum")
    g.rect(0, 1, CW, CH - 2, "plum")
    g.rect(2, 2, CW - 4, CH - 4, "cream")
    g.rect(2, CH - 3, CW - 4, 1, "tan")
    g.rect(2, 2, CW - 4, 11, band)
    g.rect(2, 12, CW - 4, 1, band_sh)
    # recessed art window
    g.rect(4, 15, AW + 2, AH + 2, "brown")
    g.rect(4, 15, AW + 2, 1, "dbrown")
    g.rect(5, 16, AW, AH, "tan")
    # divider between the effect text and the badge
    for x in range(8, CW - 8, 3):
        g.p(x, 118, "tan")
    g.rect(6, 121, 71, 13, "plum")
    g.rect(6, 121, 71, 1, "dbrown")
    # corner studs
    for x, y in ((3, 3), (CW - 4, 3), (3, CH - 4), (CW - 4, CH - 4)):
        g.p(x, y, "white" if y < 10 else "tan")
    return g


# ---------- illustration helpers ----------

class Art(hp.Scene):
    def __init__(self):
        super().__init__(AW, AH)

    def ground(self, zone, x0=100):
        self.shade = hp.DARKER[hp.K[hp.ZONES[zone]]]
        tile = hp.TILES[zone].crop((x0, 0, x0 + AW, 64))
        self.img.paste(tile, (0, -4))

    def grass(self):
        self.fill(0, 0, AW, AH, "green")
        for i in range(30):
            self.fill((i * 23) % AW, (i * 17) % AH, 1, 2, "dgreen")
        self.shade = "dgreen"

    def tiles_bg(self, col="lgrey", line="grey"):
        self.fill(0, 0, AW, AH, col)
        for x in range(0, AW, 8):
            self.fill(x, 0, 1, AH, line)
        for y in range(0, AH, 8):
            self.fill(0, y, AW, 1, line)

    def put(self, key, tag, cx, foot, i=0, flip=False, shadow=True):
        self.feet(key, tag, cx, foot, i, flip, shadow)

    def stink(self, x, y, n=3):
        for k in range(n):
            for j in range(7):
                self.fill(x + k * 6 + (0 if (j % 4) < 2 else 1), y + j, 1, 1, "green" if j % 3 else "dgreen")

    def drops(self, pts, col="cyan"):
        for x, y in pts:
            self.fill(x, y, 1, 2, col)

    def sparkle(self, x, y, col="white"):
        for dx, dy in ((0, -2), (0, 2), (-2, 0), (2, 0), (0, 0)):
            self.fill(x + dx, y + dy, 1, 1, col)

    def hearts(self, pts):
        for x, y in pts:
            self.heart(x, y, "red", "pink")

    def coins(self, pts, i=0):
        for k, (x, y) in enumerate(pts):
            self.paste(hp.frame("tip", "idle", i + k), x, y)

    def face(self, key, mood, x, y):
        self.fill(x - 1, y - 1, 34, 34, "plum")
        self.fill(x, y, 32, 32, "tan")
        self.paste(hp.frame(key, mood), x, y)

    def leash(self, x0, y0, x1, y1):
        self.line(x0, y0, x1, y1, "dred")


# ---------- encounters ----------

def skunk_grooming():
    a = Art()
    a.tiles_bg()
    a.put("dog-biscuit", "walk", 37, 42, shadow=False)
    a.fill(14, 34, 47, 3, "white")
    a.fill(16, 37, 43, 14, "white")
    a.fill(56, 37, 3, 14, "lgrey")
    a.fill(16, 50, 43, 1, "grey")
    a.fill(20, 51, 3, 3, "grey")
    a.fill(52, 51, 3, 3, "grey")
    for x, y in ((18, 28), (24, 24), (52, 26), (58, 20), (30, 18), (46, 16)):
        a.fill(x, y, 3, 3, "white")
        a.fill(x + 1, y + 1, 1, 1, "cyan")
    return a


def skunk_rinse():
    a = Art()
    a.grass()
    a.put("dog-biscuit", "walk", 44, 50, 1)
    a.fill(0, 10, 16, 2, "dgreen")
    a.fill(16, 9, 3, 4, "grey")
    a.drops([(20 + k * 2, 11 + k + (k % 2)) for k in range(10)])
    a.stink(50, 8)
    return a


def skunk_ignore():
    a = Art()
    a.ground("street")
    a.put("skunk", "idle", 18, 44)
    a.stink(30, 6, 2)
    a.put("dog-koda", "walk", 54, 40, 2)
    a.stink(46, 4, 2)
    return a


def squirrel_hold():
    a = Art()
    a.ground("park")
    a.put("squirrel", "idle", 62, 26)
    a.put("dog-koda", "pull", 36, 34)
    a.put("walker", "walk", 26, 56, 1)
    a.leash(31, 42, 36, 22)
    return a


def squirrel_chase():
    a = Art()
    a.ground("park")
    a.put("squirrel", "run", 60, 22, 1)
    a.put("dog-koda", "pull", 40, 40, 1)
    a.coins([(10, 34), (18, 42), (6, 44)])
    a.sparkle(26, 34, "yellow")
    return a


def puddle_through():
    a = Art()
    a.ground("street")
    a.paste(hp.frame("puddle", "idle"), 22, 30)
    a.put("dog-duchess", "react", 38, 44, shadow=False)
    a.drops([(26, 26), (30, 22), (48, 24), (52, 28), (44, 20)])
    return a


def puddle_towel():
    a = Art()
    a.ground("home")
    a.put("dog-duchess", "walk", 37, 48)
    a.fill(26, 26, 22, 9, "pink")
    for x in range(26, 48, 4):
        a.fill(x, 26, 2, 9, "white")
    a.fill(26, 34, 22, 1, "mauve")
    return a


def other_dog_sniff():
    a = Art()
    a.ground("park")
    a.put("other-dog", "walk", 38, 30)
    a.put("dog-biscuit", "walk", 38, 54)
    a.hearts([(24, 6), (46, 4)])
    return a


def other_dog_pull_away():
    a = Art()
    a.ground("park")
    a.put("other-dog", "walk", 58, 30)
    a.put("dog-biscuit", "pull", 26, 40, flip=True)
    a.put("walker", "walk", 16, 56)
    a.leash(20, 42, 26, 26)
    a.fill(63, 4, 2, 5, "red")
    a.fill(63, 10, 2, 2, "red")
    return a


def thief_chase():
    a = Art()
    a.ground("street")
    a.put("thief", "flee", 54, 46, 1)
    a.put("dog-koda", "react", 24, 52)
    a.fill(30, 12, 2, 5, "red")
    a.fill(30, 18, 2, 2, "red")
    return a


def thief_let_go():
    a = Art()
    a.ground("street")
    a.put("thief", "walk", 50, 52)
    a.coins([(10, 40), (20, 46)], 1)
    a.bubble(4, 8, 24, ["-$$"], "dred")
    return a


# ---------- lucky encounters ----------

def wallet_return():
    a = Art()
    a.ground("home")
    a.paste(hp.frame("lost-wallet", "idle", 1), 30, 22)
    a.hearts([(14, 8), (52, 10), (24, 40), (48, 38)])
    return a


def wallet_keep():
    a = Art()
    a.ground("home")
    a.paste(hp.frame("lost-wallet", "idle", 1), 12, 24)
    a.coins([(28, 30), (34, 22), (40, 32)])
    a.face("face-owner-zippy", "upset", 41, 12)
    return a


def neighbour_take():
    a = Art()
    a.grass()
    a.put("biscuit-neighbour", "wave", 24, 54)
    for x, y in ((46, 20), (56, 30), (50, 40)):
        a.paste(hp.frame("treat", "idle"), x, y)
    return a


def neighbour_pass():
    a = Art()
    a.grass()
    a.put("biscuit-neighbour", "wave", 54, 54, 1)
    a.put("walker", "walk", 20, 56, 2)
    return a


def photo_pose():
    a = Art()
    a.ground("shops")
    a.put("photo-op", "flash", 54, 52)
    a.put("dog-duchess", "react", 20, 46, shadow=False)
    a.sparkle(10, 10, "yellow")
    a.sparkle(30, 6, "white")
    return a


def photo_wave():
    a = Art()
    a.ground("shops")
    a.put("photo-op", "idle", 56, 52, 1)
    a.put("walker", "walk", 22, 56, 3)
    return a


ILLUSTRATIONS = {
    "card-skunk-grooming": skunk_grooming,
    "card-skunk-rinse": skunk_rinse,
    "card-skunk-ignore": skunk_ignore,
    "card-squirrel-hold": squirrel_hold,
    "card-squirrel-chase": squirrel_chase,
    "card-puddle-through": puddle_through,
    "card-puddle-towel": puddle_towel,
    "card-other-dog-sniff": other_dog_sniff,
    "card-other-dog-pull-away": other_dog_pull_away,
    "card-thief-chase": thief_chase,
    "card-thief-let-go": thief_let_go,
    "card-lost-wallet-return": wallet_return,
    "card-lost-wallet-keep": wallet_keep,
    "card-biscuit-neighbour-take": neighbour_take,
    "card-biscuit-neighbour-pass": neighbour_pass,
    "card-photo-op-pose": photo_pose,
    "card-photo-op-wave": photo_wave,
}


def frame_sprite():
    yield "card-frame", [(kind, [card_frame(kind).outlined(False)], 1000) for kind in BANDS]


def mock_card(kind, key):
    """A whole card as the game will show it, for previews."""
    im = Image.new("RGB", (CW, CH), hp.rgb("dbrown"))
    px = card_frame(kind).px
    for y, row in enumerate(px):
        for x, c in enumerate(row):
            if c:
                im.putpixel((x, y), hp.rgb(c))
    im.paste(ILLUSTRATIONS[key]().img, (5, 16))
    return im


def preview(out, scale=3):
    keys = list(ILLUSTRATIONS)
    kinds = ["encounter"] * 11 + ["lucky"] * 6
    cols = 9
    rows = (len(keys) + cols - 1) // cols
    sheet = Image.new("RGB", ((CW + 6) * cols * scale, (CH + 6) * rows * scale), hp.rgb("ink"))
    for i, (key, kind) in enumerate(zip(keys, kinds)):
        card = mock_card(kind, key).resize((CW * scale, CH * scale), Image.NEAREST)
        sheet.paste(card, ((i % cols) * (CW + 6) * scale, (i // cols) * (CH + 6) * scale))
    sheet.save(out)


def build():
    build_sprites(list(frame_sprite()), "art/cards")
    os.makedirs("public/art/images", exist_ok=True)
    for key, draw in ILLUSTRATIONS.items():
        png = f"public/art/images/{key}.png"
        draw().img.save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/cards/{key}.aseprite"], check=True)
    path = "public/art/manifest.json"
    manifest = json.load(open(path))
    entries = {i["key"]: i for i in manifest.get("images", [])}
    for key in ILLUSTRATIONS:
        entries[key] = {"key": key, "png": f"images/{key}.png"}
    manifest["images"] = sorted(entries.values(), key=lambda i: i["key"])
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print("built", ", ".join(ILLUSTRATIONS))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
