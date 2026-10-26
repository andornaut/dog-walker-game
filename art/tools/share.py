#!/usr/bin/env python3
"""Draw the site's link-preview image.

share-card: a 300x157 picture in the house palette, fully opaque, scaled 4x with
nearest-neighbour to 1200x628, then padded with 1px of ink (its border colour)
above and below to the 1200x630 Open Graph size. Dark wood boards on the left carry
the logo and the tagline in font-title at 2x; on the right, a window onto
Cabbagetown: the backdrop's houses and cross street, the road widening below them, and
Casey walking Koda, Biscuit and Duchess up the middle in the
game's pack formation, the leashes running behind Casey to her hands.

Built from public/art/images/ (logo, backdrop-cabbagetown, road-cabbagetown), the
walker and dog sprites in public/art/sprites/ and the font-title BMFont in
public/art/fonts/, so build those first (screens.py, backdrops.py, roads.py,
road.py, dogs.py, fonts.py). It is not a game asset, so it is written to public/,
outside public/art/.

Usage:
  share.py preview OUT.png   the card at 1200x630
  share.py build             write art/share/share-card.aseprite (the 300x157
                             master) and public/og-image.png

Run from the repository root.
"""

import os
import re
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import backdrops as bd  # noqa: E402
import scene as sn  # noqa: E402
from pixel import PALETTE64  # noqa: E402
from screens import planks  # noqa: E402

W, H = 300, 157
SCALE = 4
OUT_W, OUT_H = 1200, 630
TAGLINE = ("A COZY", "PIXEL-ART", "DOG-WALKING", "LANE RUNNER")

# The window onto Cabbagetown: its left edge, and the backdrop rows it shows above the road
VIEW_X = 152
VIEW_W = W - 1 - VIEW_X
BAND_TOP = bd.BASE - 46    # the first backdrop row shown, 46 rows over the far side's ground row
BAND_ROWS = bd.H - BAND_TOP
STREET = next(z for z, v in sn.ZONES.items() if v["art"] == "cabbagetown")   # Cabbagetown's zone id
# The pack's formation, as src/layout/packFormation.ts: each dog's (side, distance ahead of the
# feet), the dogs in formation order. One dog leads; two walk side by side; three walk in a
# triangle, the lead's row keyed by the three sizes and three large dogs' side dogs closer in.
SIDES = {"lead": 0, "left": -1, "right": 1}
SIZES = {d["id"]: d["size"] for d in sn.GAME["dogs"]}


def formation(dogs):
    feet = sn.PACK["feet"]
    sizes = [SIZES[d] for d in dogs]
    rows = [feet["lead"][sizes[0]]] if len(sizes) == 1 else [
        feet["sideOfThreeLarge"] if sizes == ["large"] * 3 else feet["side"][s] for s in sizes[-2:]]
    if len(sizes) == 3:
        rows = [feet["trioLead"][" ".join(sizes)]] + rows
    return [(SIDES[slot], -row) for slot, row in zip(sn.PACK["slots"][len(dogs) - 1], rows)]


# ---------- font-title, read from its BMFont export ----------

def bmfont(key):
    """{char: (mask, xoffset, yoffset, xadvance)} from public/art/fonts/<key>.fnt and its atlas."""
    with open(f"public/art/fonts/{key}.fnt") as f:
        src = f.read()
    atlas = Image.open(f"public/art/fonts/{key}.png").convert("RGBA").getchannel("A")
    out = {}
    for line in src.splitlines():
        if "<char " not in line:
            continue
        a = {k: int(v) for k, v in re.findall(r'(\w+)="(-?\d+)"', line)}
        mask = atlas.crop((a["x"], a["y"], a["x"] + a["width"], a["y"] + a["height"])) if a["width"] else None
        out[chr(a["id"])] = (mask, a["xoffset"], a["yoffset"], a["xadvance"])
    return out


TITLE = bmfont("font-title")


def title_w(s, sc):
    """The inked width of s at scale sc: the advances, less the trailing gap of the last glyph."""
    mask, ox, _, _ = TITLE[s[-1]]
    return sc * (sum(TITLE[ch][3] for ch in s[:-1]) + ox + (mask.width if mask else 0))


def label(cv, s, mid, y, col, rim, sc=2):
    """s in font-title at sc, centred on mid with its cap tops on row y, in col with a 1px rim all round."""
    pts, x = set(), round(mid - title_w(s, sc) / 2)
    top = min(TITLE[ch][2] for ch in s if TITLE[ch][0])
    for ch in s:
        mask, ox, oy, adv = TITLE[ch]
        if mask:
            for j in range(mask.height):
                for i in range(mask.width):
                    if mask.getpixel((i, j)):
                        for dj in range(sc):
                            for di in range(sc):
                                pts.add((x + (ox + i) * sc + di, y + (oy - top + j) * sc + dj))
        x += adv * sc
    for px, py in pts:
        for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0), (1, 1)):
            if (px + dx, py + dy) not in pts:
                cv.fill(px + dx, py + dy, 1, 1, rim)
    for px, py in pts:
        cv.fill(px, py, 1, 1, col)


# ---------- the window onto Cabbagetown ----------

def street_view():
    """VIEW_W x (H - 2): the backdrop's street around its vanishing point, then the road strip
    sampled as the street keeps widening toward the viewer, with the pack walking up it."""
    cx = VIEW_W // 2
    view = sn.Scene(VIEW_W, H - 2)
    view.shade, view.leash_col = sn.ZONES[STREET]["shadow"], sn.ZONES[STREET]["leash"]
    band = sn.image(f"backdrop-{sn.ZONES[STREET]['art']}").convert("RGB")
    left = bd.CX - cx
    view.img.paste(band.crop((left, BAND_TOP, left + VIEW_W, bd.H)), (0, 0))
    # below the band the street keeps receding: the ground scale climbs from the band's bottom row
    # (about 0.5) to 1 at the walker's feet, and each row samples the road strip at that scale
    road = sn.TILES[STREET]
    rows = view.img.height - BAND_ROWS
    z = 0.0
    for r in range(rows):
        s = 0.5 + 0.5 * min(1, (r + 1) / (rows - 6))
        sy = int(z) % road.height
        for x in range(VIEW_W):
            sx = int(road.width / 2 + (x + 0.5 - cx) / s)
            view.img.putpixel((x, BAND_ROWS + r), road.getpixel((min(max(sx, 0), road.width - 1), sy)))
        z -= 1 / s
    pack(view, cx, view.img.height - 6)
    return view.img


def pack(view, cx, base):
    """The pack at full size with the walker's feet on row base: the dogs in the game's
    formation, far ones first, then a leash from her hand to each collar, then Casey over them, so
    the leashes pass behind her and show only from her hands to the collars."""
    def stand(key, x, feet, shadow=True):
        f = sn.frame(key, "walk")
        if shadow:
            view.shadow(x, feet + 1, f.width)
        view.paste(f, x - f.width // 2, feet - f.getbbox()[3] + 1)

    ids = ("koda", "biscuit", "duchess")   # large, medium, small: formation order
    dogs = [(f"dog-{d}", sn.side_dx(f"dog-{d}", side), base - row) for d, (side, row) in zip(ids, formation(ids))]
    for k, dx, feet in sorted(dogs, key=lambda d: d[2]):
        stand(k, cx + dx, feet)
    walker = sn.frame("walker-casey", "walk")
    view.shadow(cx, base + 1, walker.width)
    for key, dx, feet in dogs:
        hand = sn.HANDS[0] if dx < 0 else sn.HANDS[1]
        view.line(cx + hand, base - sn.HANDS[2], cx + dx, feet - sn.collar(key), view.leash_col)
    stand("walker-casey", cx, base, shadow=False)


# ---------- the card ----------

def card():
    cv = sn.Canvas(W, H)
    # dark wood boards, then a post between them and the window
    planks(cv, 0, 0, VIEW_X, H, 11, seed=21)
    cv.img.paste(street_view(), (VIEW_X, 1))
    cv.fill(VIEW_X - 4, 0, 4, H, "tan")
    cv.fill(VIEW_X - 4, 0, 1, H, "cream")
    cv.fill(VIEW_X - 1, 0, 1, H, "brown")
    cv.fill(VIEW_X - 5, 0, 1, H, "plum")
    # the ink border, which the padding continues
    cv.fill(0, 0, W, 1, "ink")
    cv.fill(0, H - 1, W, 1, "ink")
    cv.fill(0, 0, 1, H, "ink")
    cv.fill(W - 1, 0, 1, H, "ink")
    # the logo and the tagline, centred on the boards
    mid = (VIEW_X - 5) // 2
    logo = sn.image("logo")
    block = logo.height + 14 + len(TAGLINE) * 16 - 4
    y = (H - block) // 2
    cv.paste(logo, mid - logo.width // 2, y)
    y += logo.height + 14
    for line in TAGLINE:
        label(cv, line, mid, y, "cream", "plum")
        y += 16
    return cv.img


def check(img):
    pal = {sn.rgb(c) for c in PALETTE64}
    bad = {c for c in img.getdata() if c not in pal}
    if bad:
        sys.exit(f"off-palette colours: {sorted(bad)[:8]}")


def final(img):
    """The card at SCALE, padded with the ink border to OUT_W x OUT_H."""
    big = img.resize((W * SCALE, H * SCALE), Image.NEAREST)
    out = Image.new("RGB", (OUT_W, OUT_H), sn.rgb("ink"))
    out.paste(big, ((OUT_W - big.width) // 2, (OUT_H - big.height) // 2))
    return out


def build():
    img = card()
    check(img)
    os.makedirs("art/share", exist_ok=True)
    master = "art/share/share-card.png"
    img.save(master)
    subprocess.run(["aseprite", "-b", master, "--save-as", "art/share/share-card.aseprite"], check=True)
    os.unlink(master)
    final(img).save("public/og-image.png")
    print("built share-card")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        img = card()
        check(img)
        final(img).save(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
