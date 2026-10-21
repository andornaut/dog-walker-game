#!/usr/bin/env python3
"""Rasterize the game's pixel fonts into BMFonts (XML .fnt plus a PNG atlas).

- font-body: Tiny5 at 8px made a row taller, for body text, quips and floating labels.
- font-title: Silkscreen at 8px, for titles, numbers and buttons.
- font-display and font-display-cream: the yard sign logo's lettering, for big display words only
  (zone names, "WHICH WAY?", "FIRED!", "NEW BEST!", the end screen title, hit labels). Upright blocky
  capitals 5 rows tall drawn at 2x (10px caps), each in a 1px ink outline on a solid dred shadow 2px
  down and right. The colours are baked in: yellow letters in font-display, cream in
  font-display-cream, a red heart in both. Draw them untinted.
- font-comic: the comic words' lettering from fx.py, for the word over a hit burst. Draw it untinted.

font-body and font-title are SIL Open Font License fonts; the font files and licenses are in
art/fonts/. Their glyphs are white on transparent so the game tints them. Printable ASCII, the
middle dot (U+00B7) and a drawn heart for ♥ (U+2665), which neither font has.

font-body keeps Tiny5's 10-row line and its capitals' top on row 2, a row taller than Tiny5 so
small text reads: capitals and digits 6 rows (rows 2 to 7, Tiny5's with one row drawn twice,
REPEAT), a drawn lower case (LOWER) on a 5-row x-height (rows 3 to 7) with round letters 4 wide,
ascenders a row above the capitals (row 1) and descenders one row (row 8), base 8. Marks that span
the capitals get a row more; marks on the baseline or the x-height's middle move a row down
(LOWERED). Its $ is drawn (DRAWN), as Tiny5's is too thin to read at 1x.

font-display has A to Z, 0 to 9, ! ? , . ' - + $, space and ♥. Its line is 18px: the capitals'
outline on rows 2 to 13 and their fill on rows 3 to 12 (base 13), with room above for the $ and
below for the comma's tail and the shadow. Letters sit 2px apart, which their outlines fill;
pairs whose shapes leave room (LT, P., TY) kern 2px closer. Lower case is not in the font: set it
in capitals.

font-comic is the comic words' lettering from fx.py, for the word drawn over a hit burst: flat yellow
capitals 7 rows tall with 2px stems in a 1px ink ring that fills the gaps between letters, on a solid
dred shadow 2px down and right, colours baked in (draw untinted). A to Z, ! ? - and space. Its line is
11px: the ring on rows 0 to 8, the fill on rows 1 to 7 (base 8), the shadow to row 10. Letters sit 1px
apart, which their rings fill, with no kerning. A word is its letters' widths, plus 1 between each pair,
plus 4.

In-art signs (shop boards, the park gate, the lemonade stand) use the same letters and outline at
1x, with a 1px shadow, through sign().

Usage:
  fonts.py preview OUT.png   a sample of every font, scaled up
  fonts.py build             write public/art/fonts/*.png and *.fnt

Run from the repository root.
"""

import os
import sys
from xml.sax.saxutils import quoteattr

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from fx import LETTERS, word, word_size  # noqa: E402
from pixel import Grid, K  # noqa: E402

FONTS = {
    "font-body": ("Tiny5", "art/fonts/tiny5/Tiny5.ttf", 8),
    "font-title": ("Silkscreen", "art/fonts/silkscreen/Silkscreen-Regular.ttf", 8),
}
CHARS = [chr(c) for c in range(32, 127)] + ["·", "♥"]
HEART = [".11.11.", "1111111", "1111111", ".11111.", "..111..", "...1..."]
TINY5 = "art/fonts/tiny5/Tiny5.ttf"
# Glyphs drawn in place of a font's own, by font file: rows, then the top row's offset and the advance.
DRAWN = {TINY5: {
    # Tiny5's $ is a 3px S that reads as a stray mark at 1x: a 4px S with 2px diagonals, its stem a
    # row above and below it.
    "$": (["..1.", ".111", "11..", "11..", "..11", "111.", ".1.."], 1, 5),
    # The lower case: x-height rows 3 to 7, ascenders from row 1, descenders on row 8.
    "a": ([".11.", "...1", ".111", "1..1", ".111"], 3, 5),
    "b": (["1...", "1...", "111.", "1..1", "1..1", "1..1", "111."], 1, 5),
    "c": ([".111", "1...", "1...", "1...", ".111"], 3, 5),
    "d": (["...1", "...1", ".111", "1..1", "1..1", "1..1", ".111"], 1, 5),
    "e": ([".11.", "1..1", "1111", "1...", ".111"], 3, 5),
    "f": ([".11", "1..", "111", "1..", "1..", "1..", "1.."], 1, 4),
    "g": ([".111", "1..1", "1..1", ".111", "...1", "111."], 3, 5),
    "h": (["1...", "1...", "111.", "1..1", "1..1", "1..1", "1..1"], 1, 5),
    "i": (["1", ".", "1", "1", "1", "1", "1"], 1, 2),
    "j": ([".1", "..", ".1", ".1", ".1", ".1", ".1", "1."], 1, 3),
    "k": (["1...", "1...", "1..1", "1.1.", "11..", "1.1.", "1..1"], 1, 5),
    "l": (["1.", "1.", "1.", "1.", "1.", "1.", ".1"], 1, 3),
    "m": (["1111.", "1.1.1", "1.1.1", "1.1.1", "1.1.1"], 3, 6),
    "n": (["111.", "1..1", "1..1", "1..1", "1..1"], 3, 5),
    "o": ([".11.", "1..1", "1..1", "1..1", ".11."], 3, 5),
    "p": (["111.", "1..1", "1..1", "1..1", "111.", "1..."], 3, 5),
    "q": ([".111", "1..1", "1..1", "1..1", ".111", "...1"], 3, 5),
    "r": (["1.11", "11..", "1...", "1...", "1..."], 3, 5),
    "s": ([".111", "1...", ".11.", "...1", "111."], 3, 5),
    "t": (["1..", "111", "1..", "1..", "1..", ".11"], 2, 4),
    "u": (["1..1", "1..1", "1..1", "1..1", ".111"], 3, 5),
    "v": (["1...1", "1...1", ".1.1.", ".1.1.", "..1.."], 3, 6),
    "w": (["1...1", "1...1", "1.1.1", "1.1.1", ".1.1."], 3, 6),
    "x": (["1...1", ".1.1.", "..1..", ".1.1.", "1...1"], 3, 6),
    "y": (["1..1", "1..1", "1..1", ".111", "...1", "111."], 3, 5),
    "z": (["1111", "...1", "..1.", ".1..", "1111"], 3, 5),
}}
# Tiny5's capitals, digits and the marks that span them, a row taller: the row named here is drawn
# twice (a crossbar's lower half, a bowl's side, a diagonal's top).
REPEAT = {TINY5: {
    **{c: 3 for c in "ABEFHIJKLMNPRSTUY1356789"},
    **{c: 2 for c in "CDGOQ04"},
    **{c: 0 for c in "VWX"},
    **{c: 1 for c in "Z2"},
    **{c: 2 for c in "!?()[]{}/\\|#&@<>"},
}}
# Marks on the baseline or the x-height's middle, a row lower with them.
LOWERED = {TINY5: set(".,;:-+=*~_%·♥")}
# How many rows lower than the face's ascent the baseline is.
BASE_DROP = {TINY5: 1}
ATLAS_W = 128

# ---------- the sign lettering ----------

# The yard sign logo's letters, 5 rows from the top of the capitals, one cell a row (D, O, G, W, A,
# L, K, E and R are the logo's own). A glyph with more rows starts RISE[ch] rows above the capitals
# ($) or runs below them (the comma's tail).
SIGN = {
    "A": [".###.", "#...#", "#####", "#...#", "#...#"],
    "B": ["####.", "#...#", "####.", "#...#", "####."],
    "C": [".####", "#....", "#....", "#....", ".####"],
    "D": ["####.", "#...#", "#...#", "#...#", "####."],
    "E": ["#####", "#....", "####.", "#....", "#####"],
    "F": ["#####", "#....", "####.", "#....", "#...."],
    "G": [".####", "#....", "#..##", "#...#", ".####"],
    "H": ["#...#", "#...#", "#####", "#...#", "#...#"],
    "I": ["###", ".#.", ".#.", ".#.", "###"],
    "J": ["....#", "....#", "....#", "#...#", ".###."],
    "K": ["#..#", "#.#.", "##..", "#.#.", "#..#"],
    "L": ["#....", "#....", "#....", "#....", "#####"],
    "M": ["#....#", "##..##", "#.##.#", "#....#", "#....#"],
    "N": ["#...#", "##..#", "#.#.#", "#..##", "#...#"],
    "O": [".###.", "#...#", "#...#", "#...#", ".###."],
    "P": ["####.", "#...#", "####.", "#....", "#...."],
    "Q": [".###.", "#...#", "#...#", "#..#.", ".##.#"],
    "R": ["####.", "#...#", "####.", "#..#.", "#...#"],
    "S": [".####", "#....", ".###.", "....#", "####."],
    "T": ["#####", "..#..", "..#..", "..#..", "..#.."],
    "U": ["#...#", "#...#", "#...#", "#...#", ".###."],
    "V": ["#...#", "#...#", "#...#", ".#.#.", "..#.."],
    "W": ["#....#", "#....#", "#.##.#", "#.##.#", ".#..#."],
    "X": ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
    "Y": ["#...#", ".#.#.", "..#..", "..#..", "..#.."],
    "Z": ["#####", "...#.", "..#..", ".#...", "#####"],
    "0": [".##.", "#..#", "#..#", "#..#", ".##."],
    "1": [".#.", "##.", ".#.", ".#.", "###"],
    "2": ["###.", "...#", ".##.", "#...", "####"],
    "3": ["###.", "...#", ".##.", "...#", "###."],
    "4": ["#..#", "#..#", "####", "...#", "...#"],
    "5": ["####", "#...", "###.", "...#", "###."],
    "6": [".##.", "#...", "###.", "#..#", ".##."],
    "7": ["####", "...#", "..#.", ".#..", ".#.."],
    "8": [".##.", "#..#", ".##.", "#..#", ".##."],
    "9": [".##.", "#..#", ".###", "...#", ".##."],
    "!": ["#", "#", "#", ".", "#"],
    "?": ["###.", "...#", ".##.", "....", ".#.."],
    ".": [".", ".", ".", ".", "#"],
    ",": ["..", "..", "..", "..", ".#", "#."],
    "'": ["#", "#"],
    "-": ["...", "...", "###"],
    "+": ["...", ".#.", "###", ".#."],
    "$": ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
    "♥": [".#.#.", "#####", "#####", ".###.", "..#.."],
}
RISE = {"$": 1}
# The heart keeps its own colour in every colourway.
FILL = {"♥": "red"}
# The space's advance at 2x, as the logo spaces its words; half that, rounded up, at 1x.
SPACE = 3.5
DISPLAY = {"font-display": "yellow", "font-display-cream": "cream"}
DISPLAY_SCALE = 2
# The capitals' fill starts this far below the line's top at 2x, leaving room for the $ and its outline.
CAP_TOP = 3
LINE_HEIGHT = 18


def cells(ch):
    """The glyph's filled cells as (column, row), rows from the top of the capitals."""
    rise = RISE.get(ch, 0)
    return {(i, j - rise) for j, row in enumerate(SIGN[ch]) for i, c in enumerate(row) if c == "#"}


def kerned(a, b):
    """Whether b can sit a cell closer after a: their fills stay two cells apart, so each letter keeps
    its own outline."""
    if a not in SIGN or b not in SIGN:
        return False
    adv = len(SIGN[a][0])
    second = {(x + adv, y) for x, y in cells(b)}
    return all(max(abs(x - u), abs(y - v)) >= 2 for x, y in cells(a) for u, v in second)


def sign(text, scale=1, fill="yellow", kern=True):
    """text in the sign letters at scale: ({(x, y): colour}, the advance). x runs from the pen, where
    the first letter's outline starts, and y from the top of the capitals' outline; a raised glyph
    ($) reaches above 0. Letters are drawn first, then their 1px ink outline (8-neighbour) and a solid
    dred shadow: the outline moved 1 to scale px down and right, under the outline and the letters."""
    letters, x, prev = {}, 1, None
    for ch in text:
        if ch == " ":
            x += int(SPACE * scale + 0.5)
            prev = None
            continue
        if kern and prev is not None and kerned(prev, ch):
            x -= scale
        col = FILL.get(ch, fill)
        for cx, cy in cells(ch):
            for dx in range(scale):
                for dy in range(scale):
                    letters[(x + cx * scale + dx, 1 + cy * scale + dy)] = col
        x += scale * (len(SIGN[ch][0]) + 1)
        prev = ch
    ring = {(px + dx, py + dy) for px, py in letters for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
    shadow = {(px + d, py + d) for px, py in ring for d in range(1, scale + 1)} - ring
    # a counter too small to show the shadow (the middle of O at 1x) stays ink
    ring |= {(px, py) for px, py in shadow
             if all(q in ring for q in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)))}
    out = {p: "dred" for p in shadow - ring}
    out.update({p: "ink" for p in ring})
    out.update(letters)
    return out, x - 1


def sign_width(text, scale=1):
    """The width of text's letters and outline, without the shadow."""
    px, _ = sign(text, scale)
    xs = [x for (x, y), c in px.items() if c != "dred"]
    return max(xs) + 1 - min(xs)


def display_glyphs(fill):
    """font-display's glyphs in fill: (RGBA image, xoffset, yoffset, xadvance) by character."""
    out = {" ": (None, 0, 0, int(SPACE * DISPLAY_SCALE + 0.5))}
    for ch in SIGN:
        px, adv = sign(ch, DISPLAY_SCALE, fill, kern=False)
        x0, y0 = min(x for x, _ in px), min(y for _, y in px)
        w, h = max(x for x, _ in px) + 1 - x0, max(y for _, y in px) + 1 - y0
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        for (x, y), c in px.items():
            im.putpixel((x - x0, y - y0), tuple(int(K[c][i:i + 2], 16) for i in (0, 2, 4)) + (255,))
        # the sign's y 0 is the capitals' outline, one row above their fill
        out[ch] = (im, x0, y0 + CAP_TOP - 1, adv)
    return out


# ---------- the comic lettering ----------

# font-comic: fx.py's comic words as a font, for the words the game draws over a burst. Each glyph is
# one letter as fx.word draws it alone: its ring from the image's column 0, the letter from column 1,
# the dred shadow to the right and below. The advance is the letter's width plus 1, so the next glyph's
# ring lands on the 1px gap and the two rings merge. Glyphs drawn left to right, each over the last,
# give fx.word's pixels exactly: a glyph's shadow that reaches the next letter falls under that
# letter's ring and fill.
COMIC = "font-comic"
COMIC_LINE = 11
# The letters' fill runs from row 1 to row 7.
COMIC_BASE = 8
COMIC_SPACE = 4


def comic_glyphs():
    """font-comic's glyphs: (RGBA image, xoffset, yoffset, xadvance) by character."""
    out = {" ": (None, 0, 0, COMIC_SPACE)}
    for ch in LETTERS:
        w, h = word_size(ch)
        g = word(Grid(w, h), ch, w / 2, 0)
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        for y, row in enumerate(g.px):
            for x, c in enumerate(row):
                if c:
                    im.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,))
        out[ch] = (im, 0, 0, len(LETTERS[ch][0]) + 1)
    return out


def kernings():
    return [(a, b, -DISPLAY_SCALE) for a in SIGN for b in SIGN if kerned(a, b)]


# ---------- the TrueType fonts ----------

def repeat_row(im, row):
    """im one row taller, its row drawn twice."""
    out = Image.new(im.mode, (im.width, im.height + 1), 0)
    out.paste(im.crop((0, 0, im.width, row + 1)), (0, 0))
    out.paste(im.crop((0, row, im.width, im.height)), (0, row + 1))
    return out


def glyphs(path, size):
    font = ImageFont.truetype(path, size)
    ascent, descent = font.getmetrics()
    out = {}
    drawn = DRAWN.get(path, {})
    repeat = REPEAT.get(path, {})
    lowered = LOWERED.get(path, set())
    for ch in CHARS:
        if ch in drawn:
            rows, top, adv = drawn[ch]
            im = Image.new("L", (len(rows[0]), len(rows)), 0)
            for y, row in enumerate(rows):
                for x, c in enumerate(row):
                    if c == "1":
                        im.putpixel((x, y), 255)
            out[ch] = (im, 0, top, adv)
            continue
        if ch == "♥":
            im = Image.new("L", (7, 6), 0)
            for y, row in enumerate(HEART):
                for x, c in enumerate(row):
                    if c == "1":
                        im.putpixel((x, y), 255)
            out[ch] = (im, 0, ascent - 6 + (ch in lowered), 8)
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
        im, top = canvas.crop(box), box[1]
        if ch in repeat:
            im = repeat_row(im, repeat[ch])
        if ch in lowered:
            top += 1
        out[ch] = (im, box[0], top, adv)
    return out, ascent, descent


def pack(gl):
    """Lay the glyphs out in rows on an atlas ATLAS_W wide: a mask (mode L) goes on in white, a
    coloured glyph (RGBA) as it is."""
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
        if im is None:
            continue
        if im.mode == "L":
            atlas.paste(Image.new("RGBA", im.size, (255, 255, 255, 255)), places[ch], im)
        else:
            atlas.paste(im, places[ch])
    return atlas, places


def write_font(key, face, size, line_height, base, gl, kerns=()):
    atlas, places = pack(gl)
    os.makedirs("public/art/fonts", exist_ok=True)
    atlas.save(f"public/art/fonts/{key}.png")
    lines = [
        '<?xml version="1.0"?>',
        "<font>",
        f'  <info face={quoteattr(face)} size="{size}" bold="0" italic="0" charset="" unicode="1" stretchH="100" '
        'smooth="0" aa="0" padding="0,0,0,0" spacing="1,1"/>',
        f'  <common lineHeight="{line_height}" base="{base}" scaleW="{atlas.width}" '
        f'scaleH="{atlas.height}" pages="1" packed="0"/>',
        f'  <pages><page id="0" file="{key}.png"/></pages>',
        f'  <chars count="{len(gl)}">',
    ]
    for ch, (im, ox, oy, adv) in gl.items():
        x, y = places[ch]
        w, h = (im.width, im.height) if im is not None else (0, 0)
        lines.append(f'    <char id="{ord(ch)}" x="{x}" y="{y}" width="{w}" height="{h}" xoffset="{ox}" '
                     f'yoffset="{oy}" xadvance="{adv}" page="0" chnl="15"/>')
    lines.append("  </chars>")
    if kerns:
        lines.append(f'  <kernings count="{len(kerns)}">')
        lines += [f'    <kerning first="{ord(a)}" second="{ord(b)}" amount="{n}"/>' for a, b, n in kerns]
        lines.append("  </kernings>")
    lines += ["</font>", ""]
    with open(f"public/art/fonts/{key}.fnt", "w") as f:
        f.write("\n".join(lines))


def build():
    for key, (face, path, size) in FONTS.items():
        gl, ascent, descent = glyphs(path, size)
        write_font(key, face, size, ascent + descent + 1, ascent + BASE_DROP.get(path, 0), gl)
    for key, fill in DISPLAY.items():
        write_font(key, "Sign", 5 * DISPLAY_SCALE, LINE_HEIGHT, CAP_TOP + 5 * DISPLAY_SCALE,
                   display_glyphs(fill), kernings())
    write_font(COMIC, "Comic", 7, COMIC_LINE, COMIC_BASE, comic_glyphs())
    print("built", ", ".join([*FONTS, *DISPLAY, COMIC]))


def preview(out, scale=3):
    samples = ["DOG WALKER  $42  ZONE 1: HIGH PARK", "Rosa: No rush, dear. ♥", "-2 ♥, dramatic   +$1.50 tip, solo",
               "0123456789 !?.,:'+-/$%&()"]
    display = ["OOPS, PETUNIAS!", "WHICH WAY? $1.50 ♥"]
    sheet = Image.new("RGB", (300, 26 + 14 * len(samples) * len(FONTS) + 20 * len(display) * len(DISPLAY)),
                      (115, 62, 57))
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
    for fill in DISPLAY.values():
        for s in display:
            px, _ = sign(s, DISPLAY_SCALE, fill)
            for (x, yy), c in px.items():
                sheet.putpixel((4 + x, y + CAP_TOP - 1 + yy), tuple(int(K[c][i:i + 2], 16) for i in (0, 2, 4)))
            y += LINE_HEIGHT + 2
    sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST).save(out)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
