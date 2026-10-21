#!/usr/bin/env python3
"""Compose the card illustrations of the Chase, Snatch and Social encounter skins.

- card-<skin>-<option>: 75x56, one per option of the skin's base encounter,
  named with the base card's option suffix. Each is its base card from
  cards.py, the same moment, sprites, poses and positions, with the skin's road
  sprite in place of the base one, on a scrap of the skin's zone's ground. A
  skin in two zones shows the first one inventory.md names for it. The base
  Social cards show no owner, so the skins' cards show none either.

  Chase (base card-squirrel-hold, card-squirrel-chase):
    chase-cat          Willow Crescent
    chase-pigeons      Main Street
    chase-ducklings    Riverside Path
    chase-rabbit       The Long Way Home
  Snatch (base card-thief-chase, card-thief-let-go):
    snatch-raccoon     Willow Crescent (also The Long Way Home)
    snatch-seagull     Fairview Park (also Riverside Path)
  Social (base card-other-dog-sniff, card-other-dog-pull-away):
    social-gate-dog    Willow Crescent
    social-frisbee-dog Fairview Park
    social-handbag-dog Main Street
    social-jogger-dog  Riverside Path

Usage:
  skin_cards_animals.py preview OUT.png   each skin's cards beside its base
                                          cards, in the card frame, scaled up
  skin_cards_animals.py build             write art/skin-cards-animals/*.aseprite
                                          and the illustrations to
                                          public/art/images/

Run from the repository root after skins_animals.py's build. A build overwrites
the .aseprite sources, so hand edits to them belong in this file instead.
"""

import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import cards  # noqa: E402
import scene as sn  # noqa: E402

# {base kind: [(option suffix, the base card's composition)]}
OPTIONS = {
    "squirrel": [("hold", cards.squirrel_hold), ("chase", cards.squirrel_chase)],
    "thief": [("chase", cards.thief_chase), ("let-go", cards.thief_let_go),
              ("let-them-run", cards.thief_let_them_run)],
    "other-dog": [("sniff", cards.other_dog_sniff), ("pull-away", cards.other_dog_pull_away)],
}
# {skin key: (base kind, the zone id its cards stand in)}
SKINS = {
    "chase-cat": ("squirrel", "snoozeCrescent"),
    "chase-pigeons": ("squirrel", "shops"),
    "chase-ducklings": ("squirrel", "pawsPromenade"),
    "chase-rabbit": ("squirrel", "homeStretch"),
    "snatch-raccoon": ("thief", "snoozeCrescent"),
    "snatch-seagull": ("thief", "park"),
    "social-gate-dog": ("other-dog", "snoozeCrescent"),
    "social-frisbee-dog": ("other-dog", "park"),
    "social-handbag-dog": ("other-dog", "shops"),
    "social-jogger-dog": ("other-dog", "pawsPromenade"),
}


def illustrations():
    """{card key: (base card key, a function drawing the skin's card)}, every option of every skin."""
    out = {}
    for skin, (kind, zone) in SKINS.items():
        for option, draw in OPTIONS[kind]:
            out[f"card-{skin}-{option}"] = (f"card-{kind}-{option}",
                                            lambda draw=draw, zone=zone, skin=skin: draw(zone, skin))
    return out


ILLUSTRATIONS = illustrations()


def mock_card(art):
    """art in an encounter card frame with its cost plaque, on the card table's brown."""
    im = cards.to_image(cards.card_frame("encounter").px)
    cost = cards.to_image(cards.card_cost().px)
    im.paste(cost, (6, 121))
    im.paste(art, (5, 16))
    bg = Image.new("RGB", im.size, sn.rgb("dbrown"))
    bg.paste(im, (0, 0), im)
    return bg


def preview(out, scale=3):
    """One row per skin: its base kind's two cards, then the skin's two."""
    gap = 6
    sheet = Image.new("RGB", ((cards.CW + gap) * 4 * scale, (cards.CH + gap) * len(SKINS) * scale), sn.rgb("ink"))
    for row, skin in enumerate(SKINS):
        keys = [k for k in ILLUSTRATIONS if k.startswith(f"card-{skin}-")]
        arts = [cards.ILLUSTRATIONS[ILLUSTRATIONS[k][0]]().img for k in keys] + [ILLUSTRATIONS[k][1]().img
                                                                               for k in keys]
        for col, art in enumerate(arts):
            card = mock_card(art).resize((cards.CW * scale, cards.CH * scale), Image.NEAREST)
            sheet.paste(card, (col * (cards.CW + gap) * scale, row * (cards.CH + gap) * scale))
    sheet.save(out)


def build():
    os.makedirs("art/skin-cards-animals", exist_ok=True)
    os.makedirs("public/art/images", exist_ok=True)
    for key, (_, draw) in ILLUSTRATIONS.items():
        png = f"public/art/images/{key}.png"
        draw().img.save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/skin-cards-animals/{key}.aseprite"], check=True)
    print("built", ", ".join(ILLUSTRATIONS))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
