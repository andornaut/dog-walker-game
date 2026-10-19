#!/usr/bin/env python3
"""Rasterize the game's two pixel fonts into BMFonts (XML .fnt plus a PNG atlas).

- font-body: Tiny5 at 8px, for body text, quips and floating labels.
- font-title: Silkscreen at 8px, for titles, numbers and buttons.

Both are SIL Open Font License fonts; the font files and licenses are in
art/fonts/. Glyphs are white on transparent so the game tints them. Printable
ASCII, the middle dot (U+00B7) and a drawn heart for ♥ (U+2665), which neither font has.

Usage:
  fonts.py preview OUT.png   a sample of both fonts, scaled up
  fonts.py build             write public/art/fonts/*.png and *.fnt and list
                             them in the manifest's "fonts"

Run from the repository root.
"""

import json
import os
import sys
from xml.sax.saxutils import quoteattr

from PIL import Image, ImageDraw, ImageFont

FONTS = {
    "font-body": ("Tiny5", "art/fonts/tiny5/Tiny5.ttf", 8),
    "font-title": ("Silkscreen", "art/fonts/silkscreen/Silkscreen-Regular.ttf", 8),
}
CHARS = [chr(c) for c in range(32, 127)] + ["·", "♥"]
HEART = [".11.11.", "1111111", "1111111", ".11111.", "..111..", "...1..."]
ATLAS_W = 128


def glyphs(path, size):
    font = ImageFont.truetype(path, size)
    ascent, descent = font.getmetrics()
    out = {}
    for ch in CHARS:
        if ch == "♥":
            im = Image.new("L", (7, 6), 0)
            for y, row in enumerate(HEART):
                for x, c in enumerate(row):
                    if c == "1":
                        im.putpixel((x, y), 255)
            out[ch] = (im, 0, ascent - 6, 8)
            continue
        canvas = Image.new("L", (size * 3, ascent + descent + 2), 0)
        d = ImageDraw.Draw(canvas)
        d.fontmode = "1"
        d.text((0, 0), ch, font=font, fill=255)
        box = canvas.getbbox()
        adv = round(font.getlength(ch))
        if not box:
            out[ch] = (None, 0, 0, adv)
            continue
        out[ch] = (canvas.crop(box), box[0], box[1], adv)
    return out, ascent, descent


def pack(gl):
    x = y = row_h = 0
    places = {}
    for ch, (im, *_rest) in gl.items():
        if im is None:
            places[ch] = (0, 0)
            continue
        if x + im.width + 1 > ATLAS_W:
            x, y, row_h = 0, y + row_h + 1, 0
        places[ch] = (x, y)
        x += im.width + 1
        row_h = max(row_h, im.height)
    height = 1
    while height < y + row_h + 1:
        height *= 2
    atlas = Image.new("RGBA", (ATLAS_W, height), (0, 0, 0, 0))
    for ch, (im, *_rest) in gl.items():
        if im is not None:
            white = Image.new("RGBA", im.size, (255, 255, 255, 255))
            atlas.paste(white, places[ch], im)
    return atlas, places


def build_font(key, face, path, size):
    gl, ascent, descent = glyphs(path, size)
    atlas, places = pack(gl)
    os.makedirs("public/art/fonts", exist_ok=True)
    atlas.save(f"public/art/fonts/{key}.png")
    lines = [
        '<?xml version="1.0"?>',
        "<font>",
        f'  <info face={quoteattr(face)} size="{size}" bold="0" italic="0" charset="" unicode="1" stretchH="100" '
        'smooth="0" aa="0" padding="0,0,0,0" spacing="1,1"/>',
        f'  <common lineHeight="{ascent + descent + 1}" base="{ascent}" scaleW="{atlas.width}" '
        f'scaleH="{atlas.height}" pages="1" packed="0"/>',
        f'  <pages><page id="0" file="{key}.png"/></pages>',
        f'  <chars count="{len(gl)}">',
    ]
    for ch, (im, ox, oy, adv) in gl.items():
        x, y = places[ch]
        w, h = (im.width, im.height) if im is not None else (0, 0)
        lines.append(f'    <char id="{ord(ch)}" x="{x}" y="{y}" width="{w}" height="{h}" xoffset="{ox}" '
                     f'yoffset="{oy}" xadvance="{adv}" page="0" chnl="15"/>')
    lines += ["  </chars>", "</font>", ""]
    with open(f"public/art/fonts/{key}.fnt", "w") as f:
        f.write("\n".join(lines))
    return gl, ascent, descent


def build():
    for key, (face, path, size) in FONTS.items():
        build_font(key, face, path, size)
    path = "public/art/manifest.json"
    manifest = json.load(open(path))
    entries = {f["key"]: f for f in manifest.get("fonts", [])}
    for key in FONTS:
        entries[key] = {"key": key, "png": f"fonts/{key}.png", "fnt": f"fonts/{key}.fnt"}
    manifest["fonts"] = sorted(entries.values(), key=lambda f: f["key"])
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print("built", ", ".join(FONTS))


def preview(out, scale=3):
    samples = ["DOG WALKER  $42  ZONE 1: WOOF WAY", "Rosa: No rush, dear. ♥", "-2 ♥, dramatic   +$1.50 tip, solo",
               "0123456789 !?.,:'+-/$%&()"]
    sheet = Image.new("RGB", (300, 20 + 14 * len(samples) * len(FONTS)), (115, 62, 57))
    y = 4
    for key, (face, path, size) in FONTS.items():
        gl, ascent, _ = glyphs(path, size)
        for s in samples:
            x = 4
            for ch in s:
                im, ox, oy, adv = gl.get(ch, gl["?"])
                if im is not None:
                    sheet.paste((234, 212, 170), (x + ox, y + oy), im)
                x += adv
            y += 12
        y += 6
    sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST).save(out)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
