#!/usr/bin/env python3
"""Compose the card illustrations of the area encounter skins: each Stink skin
(art/tools/skins_areas.py) in the moment of its base card's option, on the zone's ground.

- card-<stink skin>-grooming, -rinse, -ignore: as card-skunk-grooming, card-skunk-rinse and
  card-skunk-ignore. The source stands beside the dog in ignore, and at its @50 step at the back
  in grooming and rinse, where a tub and a hose stand on the zone's ground. Stink lines take
  skunk-cloud's pink and plum.
    stink-garbage-truck  The Long Way Home

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
import scene as sn  # noqa: E402
import road  # noqa: E402
from cards import Art  # noqa: E402
from ui import to_image  # noqa: E402

SKUNK_INK = (road.CLOUD_INK["inner"], road.CLOUD_INK["outer"])
# key: zone and stink line colours
STINK = {"stink-garbage-truck": ("yongeStreet", SKUNK_INK)}


def stink(a, x, y, n, ink):
    a.stink(x, y, n, *ink)


# ---------- Stink ----------

def back_source(a, skin):
    """The source at its @50 step at the back left, its stink rising off it."""
    f = sn.frame(skin + "@50", "idle")
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
# row, and its stink lines. The garbage truck is taller than the card, so it stands further up the road, drawn
# at its @75 depth step (IGNORE_SPRITE), and the dog walks nearer.
IGNORE = {"stink-garbage-truck": (21, 47, (43, 8), 58, 52, (50, 12))}
IGNORE_SPRITE = {"stink-garbage-truck": "stink-garbage-truck@75"}


def ignore(skin):
    """card-skunk-ignore: the source at its road size, the dog walking past it, the stink on both."""
    zone, ink = STINK[skin]
    sx, sfoot, (lx, ly), dx, dfoot, (mx, my) = IGNORE[skin]

    def card():
        a = Art()
        a.ground(zone)
        a.put(IGNORE_SPRITE.get(skin, skin), "idle", sx, sfoot)
        stink(a, lx, ly, 2, ink)
        a.put("dog-koda", "walk", dx, dfoot, 2)
        stink(a, mx, my, 2, ink)
        return a
    return card


ILLUSTRATIONS = {}
for _skin in STINK:
    ILLUSTRATIONS[f"card-{_skin}-grooming"] = grooming(_skin)
    ILLUSTRATIONS[f"card-{_skin}-rinse"] = rinse(_skin)
    ILLUSTRATIONS[f"card-{_skin}-ignore"] = ignore(_skin)
# The base card each skin card stands in for.
BASES = {key: "card-skunk-" + key.rsplit("-", 1)[1] for key in ILLUSTRATIONS}


def preview(out, scale=3):
    """Each skin's cards in a row of card frames, its base cards first."""
    rows = [[BASES[k] for k in ILLUSTRATIONS if k.startswith("card-stink-garbage-truck")]]
    for skin in STINK:
        rows.append([k for k in ILLUSTRATIONS if k.startswith(f"card-{skin}-")])
    every = {**cards.ILLUSTRATIONS, **ILLUSTRATIONS}
    gap = 6
    sheet = Image.new("RGB", ((cards.CW + gap) * 3 * scale, (cards.CH + gap) * len(rows) * scale), sn.rgb("ink"))
    for r, keys in enumerate(rows):
        for c, key in enumerate(keys):
            card = mock_card(every, key).resize((cards.CW * scale, cards.CH * scale), Image.NEAREST)
            sheet.paste(card, (c * (cards.CW + gap) * scale, r * (cards.CH + gap) * scale))
    sheet.save(out)


def mock_card(every, key):
    """The illustration in an encounter card frame, as the game shows it."""
    im = to_image(cards.card_frame("encounter").px)
    im.paste(every[key]().img, (5, 16))
    bg = Image.new("RGB", im.size, sn.rgb("dbrown"))
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
