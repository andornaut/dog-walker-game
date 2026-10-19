#!/usr/bin/env python3
"""Compose the card illustrations of the area encounter skins: each zone's Splash and Stink skin
(art/tools/skins_areas.py) in the moment of its base card's option, on the zone's ground.

- card-<splash skin>-through, card-<splash skin>-towel: as card-puddle-through and
  card-puddle-towel. The skin's decal is drawn at SMALL (42x16, as the cards' 32x16 puddle);
  through has the dog standing in it, towel has it behind the toweled dog. After the mud the dog
  has muddy feet and mud spots, after the milkshake chocolate spots and a dollop of whipped cream
  with a cherry on its head; the splashes flying off it take the same colours.
    splash-sprinkler  Willow Crescent    splash-mud    Fairview Park
    splash-milkshake  Main Street        splash-shore  Riverside Path
- card-<stink skin>-grooming, -rinse, -ignore: as card-skunk-grooming, card-skunk-rinse and
  card-skunk-ignore. The source stands at its road size beside the dog in ignore, and at its @50
  step at the back in grooming and rinse, where a tub and a hose stand
  on the zone's ground. Stink lines take the source's haze colours: skunk-cloud's pink and plum,
  the fish crate's purple and plum (stink-fish-crate-cloud), so they hold on Main Street's pink.
    stink-compost  Willow Crescent    stink-fish-crate     Main Street
    stink-seaweed  Riverside Path     stink-garbage-truck  The Long Way Home

Each is 75x56, composed from the exported sprites with cards.py's helpers: build the road sprites
(skins_areas.py, dogs.py) first. A skin has every option's card or none.

Usage:
  skin_cards_areas.py preview OUT.png   each card beside its base card, in card frames, at 3x
  skin_cards_areas.py build             write art/skin-cards-areas/*.aseprite and the
                                        illustrations to public/art/images/

Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
belong in this file instead.
"""

import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import cards  # noqa: E402
import help as hp  # noqa: E402
import road  # noqa: E402
import skins_areas as sa  # noqa: E402
from cards import Art, pixmap  # noqa: E402
from ui import to_image  # noqa: E402

AW, AH = cards.AW, cards.AH
SMALL = 0.5   # a Splash decal's scale on a card: 42x16, as the cards' 32x16 puddle

SPLASH = {"splash-sprinkler": (sa.sprinkler, "snoozeCrescent", "water"),
          "splash-mud": (sa.mud, "park", "mud"),
          "splash-milkshake": (sa.milkshake, "shops", "milkshake"),
          "splash-shore": (sa.shore, "pawsPromenade", "water")}

SKUNK_INK = (road.CLOUD_INK["inner"], road.CLOUD_INK["outer"])
FISH_INK = (sa.FISH_HAZE["fill"], sa.FISH_HAZE["outer"])
# key: zone and stink line colours
STINK = {"stink-compost": ("snoozeCrescent", SKUNK_INK),
         "stink-fish-crate": ("shops", FISH_INK),
         "stink-seaweed": ("pawsPromenade", SKUNK_INK),
         "stink-garbage-truck": ("homeStretch", SKUNK_INK)}

# What splashes off the dog: (spot, its glint, a drop's colour, the drop's underside).
SPOTS = {"mud": ("dbrown", "brown", "dbrown", "plum"),
         "milkshake": ("brown", "tan", "brown", "cream")}

WHIP = ["..rr.", "..rr.", ".www.", "wwwww", ".lll."]


def decal(draw, f=0):
    """A Splash skin's decal at SMALL, with no outline, as road sprites are."""
    return to_image(draw(f, new=sa.mini(SMALL)).outlined(False))


def stink(a, x, y, n, ink):
    a.stink(x, y, n, *ink)


def interior(px, w, h, x, y):
    return (0 < x < w - 1 and 0 < y < h - 1 and px[x, y][3]
            and all(px[x + dx, y + dy][3] for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0))))


def splattered(img, look):
    """A dog's frame after the mud or the milkshake: inside its outline, mud caked up its feet (a wavy band
    over the last rows) and mud spots on its body; or chocolate spots, each with a drip under it."""
    if look not in SPOTS:
        return img
    img = img.copy()
    px, (w, h) = img.load(), img.size
    x0, y0, x1, y1 = img.getbbox()
    spot, glint = (hp.rgb(c) + (255,) for c in SPOTS[look][:2])
    inside = [(x, y) for y in range(y0, y1) for x in range(x0, x1) if interior(px, w, h, x, y)]
    if look == "mud":
        for x, y in inside:
            top = y1 - 5 - (x % 3 == 0) + (x % 4 == 1)
            if y >= top:
                px[x, y] = glint if y == top else spot
    for x, y in inside:
        t = y - y0
        if t < (y1 - y0) * 0.35 or y > y1 - 7 or (x * 7 + y * 5) % 23:
            continue
        for dx in (0, 1):
            if interior(px, w, h, x + dx, y):
                px[x + dx, y] = spot
        if interior(px, w, h, x, y - 1):
            px[x, y - 1] = glint
        if look == "milkshake" and interior(px, w, h, x + 1, y + 1):
            px[x + 1, y + 1] = spot
    return img


def splash_dog(a, key, tag, cx, foot, look, i=0, shadow=True):
    """The dog's frame, splattered for the look, standing as Art.put stands it."""
    f = splattered(hp.frame(key, tag, i), look)
    if shadow:
        a.shadow(cx, foot, f.width)
    a.paste(f, cx - f.width / 2, foot - f.height)
    if look == "milkshake":
        x0, y0, x1, _ = f.getbbox()
        a.paste(pixmap(WHIP, {"w": "white", "l": "lgrey", "r": "red"}), cx - f.width / 2 + (x0 + x1) / 2 - 1, foot - f.height + y0 - 3)
    return f


def flung(a, pts, look):
    """What flies off the dog: water drops (as the base card), or 1x2 mud or milkshake drops in their colours."""
    if look not in SPOTS:
        a.drops(pts)
        return
    _, _, body, under = SPOTS[look]
    for x, y in pts:
        a.fill(x, y, 1, 1, body)
        a.fill(x, y + 1, 1, 1, under)


# ---------- Splash ----------

def through(skin):
    """card-puddle-through: the dog standing in the decal, reacting, splashes flying."""
    draw, zone, look = SPLASH[skin]

    def card():
        a = Art()
        a.ground(zone)
        d = decal(draw)
        a.paste(d, 14, 43 - d.height)
        splash_dog(a, "dog-duchess", "react", 44, 44, look, shadow=False)
        flung(a, [(32, 26), (36, 22), (54, 24), (58, 28), (50, 20)], look)
        return a
    return card


def towel(skin):
    """card-puddle-towel: the dog under a striped towel, walking on; the decal it came out of behind it."""
    draw, zone, look = SPLASH[skin]

    def card():
        a = Art()
        a.ground(zone)
        d = decal(draw)
        a.paste(d, AW - d.width - 2, 2)
        splash_dog(a, "dog-duchess", "walk", 30, 52, look)
        a.fill(19, 30, 22, 9, "pink")
        for x in range(19, 41, 4):
            a.fill(x, 30, 2, 9, "white")
        a.fill(19, 38, 22, 1, "mauve")
        if look in SPOTS:
            spot, glint = SPOTS[look][:2]
            for x, y in ((22, 33), (31, 35), (36, 32)):
                a.fill(x, y, 2, 1, spot)
                a.fill(x, y - 1, 1, 1, glint)
        return a
    return card


# ---------- Stink ----------

def back_source(a, skin):
    """The source at its @50 step at the back left, its stink rising off it."""
    f = hp.frame(skin + "@50", "idle")
    a.feet(skin + "@50", "idle", 2 + f.width / 2, f.height + 2)
    stink(a, 4 + f.width // 2, 0, 2, STINK[skin][1])


def tub(a):
    """card-skunk-grooming's tub, in a grey line so it holds on the light roads."""
    a.fill(17, 33, 49, 5, "grey")
    a.fill(19, 36, 45, 16, "grey")
    a.fill(18, 34, 47, 3, "white")
    a.fill(20, 37, 43, 14, "white")
    a.fill(60, 37, 3, 14, "lgrey")
    a.fill(20, 50, 43, 1, "grey")
    a.fill(24, 51, 3, 3, "grey")
    a.fill(56, 51, 3, 3, "grey")


def grooming(skin):
    """card-skunk-grooming: the dog in a tub of bubbles on the zone's ground, the source at the back."""
    zone = STINK[skin][0]

    def card():
        a = Art()
        a.ground(zone)
        back_source(a, skin)
        a.put("dog-biscuit", "walk", 41, 42, shadow=False)
        a.shadow(41, 55, 50)
        tub(a)
        for x, y in ((22, 28), (28, 24), (56, 26), (62, 20), (66, 30), (50, 16)):
            a.fill(x, y, 3, 3, "white")
            a.fill(x + 1, y + 1, 1, 1, "cyan")
        return a
    return card


def rinse(skin):
    """card-skunk-rinse: a hose from the left washing the dog down, the stink still rising off it, the
    source at the back."""
    zone, ink = STINK[skin]

    def card():
        a = Art()
        a.ground(zone)
        back_source(a, skin)
        a.put("dog-biscuit", "walk", 48, 52, 1)
        a.fill(0, 30, 16, 2, "dgreen")
        a.fill(16, 29, 3, 4, "grey")
        a.drops([(20 + k * 2, 31 - k + (k % 2)) for k in range(10)])
        stink(a, 56, 8, 3, ink)
        return a
    return card


# card-skunk-ignore's layout: the source's centre and feet row, its stink lines, the dog's centre and feet
# row, and its stink lines. The garbage truck is wider and taller than a 40x40 source, so it runs off the
# card's left edge and the dog walks nearer.
IGNORE = {"": (18, 44, (30, 6), 54, 40, (46, 4)),
          "stink-garbage-truck": (16, 45, (29, 1), 58, 52, (50, 12))}


def ignore(skin):
    """card-skunk-ignore: the source at its road size, the dog walking past it, the stink on both."""
    zone, ink = STINK[skin]
    sx, sfoot, (lx, ly), dx, dfoot, (mx, my) = IGNORE.get(skin, IGNORE[""])

    def card():
        a = Art()
        a.ground(zone)
        a.put(skin, "idle", sx, sfoot)
        stink(a, lx, ly, 2, ink)
        a.put("dog-koda", "walk", dx, dfoot, 2)
        stink(a, mx, my, 2, ink)
        return a
    return card


ILLUSTRATIONS = {}
for _skin in SPLASH:
    ILLUSTRATIONS[f"card-{_skin}-through"] = through(_skin)
    ILLUSTRATIONS[f"card-{_skin}-towel"] = towel(_skin)
for _skin in STINK:
    ILLUSTRATIONS[f"card-{_skin}-grooming"] = grooming(_skin)
    ILLUSTRATIONS[f"card-{_skin}-rinse"] = rinse(_skin)
    ILLUSTRATIONS[f"card-{_skin}-ignore"] = ignore(_skin)
# The base card each skin card stands in for.
BASES = {key: "card-" + ("puddle" if key.startswith("card-splash-") else "skunk") + "-" + key.rsplit("-", 1)[1]
         for key in ILLUSTRATIONS}


def preview(out, scale=3):
    """Each skin's cards in a row of card frames, its base cards first."""
    rows = [[BASES[k] for k in ILLUSTRATIONS if k.startswith("card-splash-sprinkler")],
            [BASES[k] for k in ILLUSTRATIONS if k.startswith("card-stink-compost")]]
    for skin in (*SPLASH, *STINK):
        rows.append([k for k in ILLUSTRATIONS if k.startswith(f"card-{skin}-")])
    every = {**cards.ILLUSTRATIONS, **ILLUSTRATIONS}
    gap = 6
    sheet = Image.new("RGB", ((cards.CW + gap) * 3 * scale, (cards.CH + gap) * len(rows) * scale), hp.rgb("ink"))
    for r, keys in enumerate(rows):
        for c, key in enumerate(keys):
            card = mock_card(every, key).resize((cards.CW * scale, cards.CH * scale), Image.NEAREST)
            sheet.paste(card, (c * (cards.CW + gap) * scale, r * (cards.CH + gap) * scale))
    sheet.save(out)


def mock_card(every, key):
    """The illustration in an encounter card frame, as the game shows it."""
    im = to_image(cards.card_frame("encounter").px)
    im.paste(every[key]().img, (5, 16))
    bg = Image.new("RGB", im.size, hp.rgb("dbrown"))
    bg.paste(im, (0, 0), im)
    return bg


def build():
    os.makedirs("art/skin-cards-areas", exist_ok=True)
    os.makedirs("public/art/images", exist_ok=True)
    for key, draw in ILLUSTRATIONS.items():
        png = f"public/art/images/{key}.png"
        draw().img.save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/skin-cards-areas/{key}.aseprite"], check=True)
    print("built", ", ".join(ILLUSTRATIONS))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
