#!/usr/bin/env python3
"""Draw the UI kit: icons, nine-slice panels and buttons, the hint bubble and badges.

Images (16x16 icons unless noted): icon-pause, icon-help, icon-close, icon-lock,
icon-money, icon-stinky; ui-panel, ui-hint (24x24 nine-slices, 8px corners),
ui-hint-tail (8x6), ui-new-best (72x20 ribbon, text baked in with font-title),
ui-slot-locked (112x50, a locked pack slot; the game writes the price); the run
screen's ui-top-bar (360x40), ui-quip (24x24 nine-slice, 8px corners), ui-quip-tail
(6x8), ui-zone-banner (248x48) and ui-touch-hint (96x36).
Sprites: ui-doghouse (72x146, one dog slot; a tag per dog key and `empty`),
ui-select (24x24 nine-slice, 8px corners; tag pulse), ui-check (16x16; tags 1, 2, 3,
tick), fx-tap and fx-dust (16x16; tag play),
ui-heart (8x7; tags full, empty), ui-button (24x24 nine-slice, 6px
corners; tags normal, pressed, disabled), icon-sound and icon-music (tags on, off),
ui-zone-pips (18x8; tags done, current, todo).

Usage:
  ui.py preview OUT.png   every piece, scaled up
  ui.py build             write art/ui/*.aseprite, export to public/art/images/
                          and public/art/sprites/, and list them in the manifest

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
from pixel import Grid, build as build_sprites  # noqa: E402


def to_image(px):
    h, w = len(px), len(px[0])
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y, row in enumerate(px):
        for x, c in enumerate(row):
            if c:
                im.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,))
    return im


# ---------- icons ----------

def pause():
    g = Grid(16, 16)
    g.rect(4, 3, 3, 10, "cream")
    g.rect(9, 3, 3, 10, "cream")
    g.rect(6, 3, 1, 10, "tan")
    g.rect(11, 3, 1, 10, "tan")
    return g


def help_icon():
    g = Grid(16, 16)
    g.ell(8, 8, 6.5, 6.5, "cream", "tan")
    for x, y in ((6, 4), (7, 4), (8, 4), (9, 5), (9, 6), (8, 7), (7, 8), (7, 9)):
        g.p(x, y, "plum")
    g.p(6, 5, "plum")
    g.p(7, 11, "plum")
    return g


def close():
    g = Grid(16, 16)
    for i in range(9):
        g.rect(3 + i, 3 + i, 2, 2, "cream")
        g.rect(11 - i, 3 + i, 2, 2, "cream")
    return g


def lock():
    g = Grid(16, 16)
    g.ell(8, 6, 4, 4.5, "grey", "slate", "lgrey")
    g.ell(8, 6.5, 2, 3, None)
    g.rect(3, 7, 10, 8, "amber")
    g.rect(3, 7, 10, 1, "yellow")
    g.rect(12, 7, 1, 8, "orange")
    g.rect(7, 9, 2, 4, "dbrown")
    return g


def money():
    g = Grid(16, 16)
    g.ell(8, 8, 5.5, 5.5, "amber", "orange", "yellow")
    g.rect(8, 5, 1, 6, "orange")
    g.p(7, 6, "orange")
    g.p(9, 9, "orange")
    return g


def stinky():
    g = Grid(16, 16)
    g.ell(5, 10, 3.5, 3.5, "green", "dgreen")
    g.ell(10, 8.5, 4.5, 4, "green", "dgreen", "yellow")
    g.ell(10, 11, 4, 2.5, "green", "dgreen")
    for x, y in ((3, 2), (4, 3), (3, 4), (8, 1), (9, 2), (8, 3), (13, 2), (14, 3), (13, 4)):
        g.p(x, y, "dgreen")
    return g


def speaker(on, note=False):
    g = Grid(16, 16)
    if note:
        g.rect(5, 3, 2, 9, "cream")
        g.rect(5, 3, 7, 2, "cream")
        g.rect(10, 3, 2, 7, "cream")
        g.ell(4.5, 12, 2.5, 2, "cream", "tan")
        g.ell(9.5, 10, 2.5, 2, "cream", "tan")
    else:
        g.rect(2, 6, 3, 4, "cream")
        g.tri((4, 6), (9, 1), (9, 15), "cream")
        g.tri((4, 10), (9, 1), (9, 15), "cream")
        if on:
            g.rect(11, 6, 1, 4, "cream")
            g.rect(13, 4, 1, 8, "cream")
    if not on:
        for i in range(12):
            g.p(2 + i, 2 + i, "red")
            g.p(3 + i, 2 + i, "red")
    return g


def heart(full):
    g = Grid(8, 7)
    for y, row in enumerate([".11.11.", "1111111", "1111111", ".11111.", "..111..", "...1..."]):
        for x, c in enumerate(row):
            if c == "1":
                g.p(x, y, "red" if full else "tan")
    if full:
        g.p(1, 1, "pink")
    return g


# ---------- nine-slices and badges ----------

def panel():
    g = Grid(24, 24)
    g.rect(1, 0, 22, 24, "plum")
    g.rect(0, 1, 24, 22, "plum")
    g.rect(2, 2, 20, 20, "cream")
    g.rect(2, 21, 20, 1, "tan")
    g.rect(21, 2, 1, 20, "tan")
    g.p(3, 3, "white")
    return g


def button(state):
    face, lip, hi = {"normal": ("amber", "orange", "yellow"), "pressed": ("amber", None, "yellow"),
                     "disabled": ("slate", "dslate", "grey")}[state]
    g = Grid(24, 24)
    top = 2 if state == "pressed" else 0
    if lip:
        g.rect(1, 20, 22, 4, lip)
        g.rect(0, 20, 24, 3, lip)
    g.rect(1, top, 22, 20, face)
    g.rect(0, top + 1, 24, 18, face)
    g.rect(2, top + 1, 20, 1, hi)
    return g


def hint():
    g = Grid(24, 24)
    g.rect(1, 0, 22, 23, "white")
    g.rect(0, 1, 24, 21, "white")
    g.rect(1, 22, 22, 1, "lgrey")
    return g


def hint_tail():
    g = Grid(8, 6)
    g.tri((0, 0), (8, 0), (2, 6), "white")
    return g


def new_best():
    im = Image.new("RGBA", (72, 20), (0, 0, 0, 0))
    g = Grid(72, 20)
    g.tri((0, 4), (8, 4), (4, 10), "dred")
    g.tri((0, 16), (8, 16), (4, 10), "dred")
    g.rect(0, 4, 4, 12, "dred")
    g.tri((72, 4), (64, 4), (68, 10), "dred")
    g.tri((72, 16), (64, 16), (68, 10), "dred")
    g.rect(68, 4, 4, 12, "dred")
    g.rect(6, 2, 60, 15, "red")
    g.rect(6, 2, 60, 1, "pink")
    g.rect(6, 16, 60, 1, "dred")
    im.paste(to_image(g.outlined()), (0, 0))
    gl, ascent, _ = fonts.glyphs(*fonts.FONTS["font-title"][1:])
    text = "NEW BEST!"
    width = sum(gl[ch][3] for ch in text)
    x = (72 - width) // 2
    for ch in text:
        mask, ox, oy, adv = gl[ch]
        if mask is not None:
            im.paste((255, 255, 255, 255), (x + ox, 5 + oy - 1), mask)
        x += adv
    return im


def slot_locked():
    g = Grid(112, 50)
    g.rect(0, 0, 112, 50, "brown")
    g.rect(1, 1, 110, 48, "tan")
    for x in range(2, 110, 4):
        g.rect(x, 2, 2, 1, "brown")
        g.rect(x, 47, 2, 1, "brown")
    for y in range(2, 48, 4):
        g.rect(2, y, 1, 2, "brown")
        g.rect(109, y, 1, 2, "brown")
    im = to_image(g.outlined(False))
    lk = to_image(lock().outlined())
    im.paste(lk.resize((32, 32), Image.NEAREST), (8, 9), lk.resize((32, 32), Image.NEAREST))
    return im


# ---------- the doghouse: one dog slot in the dog column ----------

# Each dog's roof is its signature colour (bow, bandana, collar, sweater, harness).
ROOFS = {
    "duchess": ("pink", "mauve"), "nugget": ("red", "dred"), "zippy": ("ochre", "rust"),
    "pierre": ("purple", "plum"), "biscuit": ("green", "dgreen"), "dash": ("dgreen", "forest"),
    "snowball": ("sky", "blue"), "waffles": ("amber", "orange"), "koda": ("orange", "rust"),
    "empty": ("slate", "dslate"),
}


def doghouse(roof, eave):
    """72x146. The game draws, in slot pixels: the dog's name centred at (36, 11) in
    font-title, the dog face at (20, 36), the owner face at (8, 78), the heart count
    centred at (56, 90) in font-title, the owner's name at (9, 118) in font-body, and
    hearts from (9, 127) in rows of six, 9px across and 8px down."""
    empty = roof == "slate"
    g = Grid(72, 146)
    for i in range(22):
        w = round(36 * (i + 1) / 22)
        g.rect(36 - w, i, w * 2, 1, roof)
    g.rect(0, 20, 72, 3, eave)
    g.rect(8, 9, 56, 11, "cream")
    g.rect(8, 19, 56, 1, "tan")
    g.rect(3, 23, 66, 123, "lgrey" if empty else "tan")
    for y in range(30, 146, 8):
        g.rect(3, y, 66, 1, "grey" if empty else "brown")
    g.rect(3, 23, 2, 123, "grey" if empty else "brown")
    g.rect(67, 23, 2, 123, "slate" if empty else "dbrown")
    # arched doorway
    g.rect(18, 32, 36, 38, "ink" if empty else "plum")
    for i in range(6):
        g.rect(18 + 6 - i, 26 + i, 36 - 2 * (6 - i), 1, "ink" if empty else "plum")
    g.rect(16, 70, 40, 2, "grey" if empty else "dbrown")
    # owner window
    g.rect(6, 76, 36, 36, "white" if empty else "cream")
    g.rect(8, 78, 32, 32, "lgrey" if empty else "sky")
    g.rect(8, 78, 32, 1, "grey" if empty else "blue")
    # hearts board
    g.rect(6, 116, 60, 26, "white" if empty else "cream")
    g.rect(6, 141, 60, 1, "lgrey" if empty else "tan")
    return g


# ---------- selection and feedback ----------

def select_frame(glow):
    """24x24 nine-slice (8px corners): a thick amber frame for a selected tile, pulsing between two frames."""
    g = Grid(24, 24)
    outer, inner = ("yellow", "white") if glow else ("amber", "yellow")
    g.rect(1, 0, 22, 3, outer)
    g.rect(1, 21, 22, 3, outer)
    g.rect(0, 1, 3, 22, outer)
    g.rect(21, 1, 3, 22, outer)
    g.rect(3, 3, 18, 1, inner)
    g.rect(3, 20, 18, 1, inner)
    g.rect(3, 3, 1, 18, inner)
    g.rect(20, 3, 1, 18, inner)
    for x, y in ((1, 1), (22, 1), (1, 22), (22, 22)):
        g.p(x, y, "white" if glow else "yellow")
    return g


def check_badge(label):
    """16x16: the green badge on a selected tile, numbered by pick order, or a tick."""
    g = Grid(16, 16)
    g.ell(8, 8, 7, 7, "green", "dgreen")
    if label == "tick":
        for i, (x, y) in enumerate(((4, 8), (5, 9), (6, 10), (7, 9), (8, 8), (9, 7), (10, 6), (11, 5))):
            g.rect(x, y, 2, 2, "white")
    else:
        bits = {"1": "010110010010111", "2": "110001010100111", "3": "110001010001110"}[label]
        for r in range(5):
            for k in range(3):
                if bits[r * 3 + k] == "1":
                    g.rect(5 + k * 2, 3 + r * 2, 2, 2, "white")
    return g


def tap_burst(step):
    """16x16, 4 frames: sparkles flying out from where a tap lands."""
    g = Grid(16, 16)
    r = (1, 3, 5, 7)[step]
    col = ("white", "yellow", "amber", "orange")[step]
    for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0), (-0.7, -0.7), (0.7, -0.7), (-0.7, 0.7), (0.7, 0.7)):
        g.p(8 + dx * r, 8 + dy * r, col)
        if step < 2:
            g.p(8 + dx * (r - 1), 8 + dy * (r - 1), "white")
    return g


def dust(step):
    """16x16, 4 frames: a puff of dust when the walker hops or lands."""
    g = Grid(16, 16)
    spread, size = (2, 3.5, 5, 6)[step], (2.2, 3, 2.8, 1.8)[step]
    for cx, lift in ((8 - spread, 0), (8, 1), (8 + spread, 0)):
        g.ell(cx, 12 - step - lift, size, size, "white" if step == 3 else "lgrey", None if step == 3 else "grey")
    return g


# ---------- run screen: top bar, zone progress, quips, zone banner, touch hint ----------

def well(g, x, y, w, h):
    """A recessed ink slot in the wood: clipped corners and a dark brown lip below and to the right."""
    g.rect(x + 1, y, w - 2, h, "ink")
    g.rect(x, y + 1, w, h - 2, "ink")
    g.rect(x + 1, y + h - 1, w - 2, 1, "dbrown")
    g.rect(x + w - 1, y + 1, 1, h - 2, "dbrown")


def top_bar():
    """360x40: plum wood with a trim along the bottom and three ink wells, in screen pixels:
    money 4,8 94x26 (coin at 8,13, the amount in font-title x2 at 26,15), treats 100,8
    58x26 (treat at 104,13, count at 122,18), and zone 200,5 156x29 (the zone name right
    aligned at 352,10, ui-zone-pips from 271,22). The pause button sits at 170,10 between
    the treats and zone wells."""
    g = Grid(360, 40)
    g.rect(0, 0, 360, 40, "plum")
    g.rect(0, 1, 360, 1, "dbrown")
    for i in range(40):
        g.rect((i * 53) % 352, 4 + (i * 11) % 31, 4 + (i % 4) * 3, 1, "dbrown")
    g.rect(0, 37, 360, 1, "brown")
    g.rect(0, 38, 360, 1, "dbrown")
    g.rect(0, 39, 360, 1, "ink")
    well(g, 4, 8, 94, 26)
    well(g, 100, 8, 58, 26)
    well(g, 200, 5, 156, 29)
    return g


def zone_pip(state):
    """18x8, one per zone, 3px apart. The game fills the current pip's 16x6 well at 1,1 from
    the left in amber as the zone goes by. A done pip carries a tick, so progress never
    relies on colour alone."""
    rim, hi, inner = {"done": ("dgreen", "green", "green"), "current": ("orange", "amber", "ink"),
                      "todo": ("dbrown", "dbrown", "ink")}[state]
    g = Grid(18, 8)
    g.rect(1, 0, 16, 8, rim)
    g.rect(0, 1, 18, 6, rim)
    g.rect(1, 0, 16, 1, hi)
    g.rect(1, 1, 16, 6, inner)
    if state == "done":
        g.rect(1, 1, 16, 1, "yellow")
        for x, y in ((6, 4), (7, 5), (8, 4), (9, 3), (10, 2), (11, 1)):
            g.p(x, y, "white")
        g.p(7, 6, "dgreen")
    return g


def quip():
    """24x24 nine-slice (8px corners): the owner's speech bubble, cream paper with a round
    plum rim, so it reads apart from the white hint bubble. Text in font-body, plum."""
    g = Grid(24, 24)
    g.rect(3, 0, 18, 24, "plum")
    g.rect(1, 1, 22, 22, "plum")
    g.rect(0, 3, 24, 18, "plum")
    g.rect(3, 1, 18, 22, "cream")
    g.rect(2, 2, 20, 20, "cream")
    g.rect(1, 3, 22, 18, "cream")
    g.rect(3, 22, 18, 1, "tan")
    g.rect(22, 3, 1, 18, "tan")
    g.p(21, 21, "tan")
    g.p(3, 2, "white")
    return g


def quip_tail():
    """6x8, pointing left at the owner's window in the dog column. Place its right column over
    the bubble's left rim so the cream runs through."""
    g = Grid(6, 8)
    for y, row in enumerate([".....P", "....PC", "...PCC", "..PCCC", ".PCCCC", "PCCCCC", ".PPTTC", "...PPP"]):
        for x, c in enumerate(row):
            g.p(x, y, {"P": "plum", "C": "cream", "T": "tan"}.get(c))
    return g


def zone_banner():
    """248x48: a cream board in a plum frame on outlined brown wood ribbon ends, shown over the
    road between zones. The game writes two lines in font-title, plum, centred on x=124: the
    world and zone number ("MAPLE STREET, ZONE 2") with its caps in rows 11 to 15, and the zone
    name at x2 ("BARK PARK", up to 192px wide) with its caps in rows 27 to 36, under the
    dotted divider."""
    g = Grid(248, 48)
    for x0 in (1, 221):
        g.rect(x0, 13, 26, 28, "brown")
        g.rect(x0, 19, 26, 1, "dbrown")
        g.rect(x0, 34, 26, 1, "dbrown")
    g.tri((0, 12), (0, 42), (9, 27), None)
    g.tri((248, 12), (248, 42), (239, 27), None)
    g.px = g.outlined()
    g.rect(15, 0, 218, 48, "plum")
    g.rect(13, 1, 222, 46, "plum")
    g.rect(12, 3, 224, 42, "plum")
    g.rect(15, 3, 218, 42, "cream")
    g.rect(14, 4, 220, 40, "cream")
    g.rect(15, 44, 218, 1, "tan")
    g.rect(233, 4, 1, 40, "tan")
    for x in range(28, 220, 3):
        g.p(x, 21, "tan")
    for x, y in ((17, 6), (230, 6), (17, 41), (230, 41)):
        g.p(x, y, "white" if y < 10 else "tan")
    return g


def chevron(g, x, cy, left, col, sh):
    """A 3px-thick arrowhead 13px tall with its tip at x, shaded below the middle."""
    for d in range(-6, 7):
        px = x + abs(d) if left else x - abs(d) - 2
        g.rect(px, cy + d, 3, 1, sh if d > 0 else col)


def touch_hint():
    """96x36: a finger tapping between two pairs of arrows, for the first-run lane hint. The
    game writes "tap left / right" in font-body under it."""
    g = Grid(96, 36)
    chevron(g, 8, 19, True, "orange", "rust")
    chevron(g, 16, 19, True, "amber", "orange")
    chevron(g, 87, 19, False, "orange", "rust")
    chevron(g, 79, 19, False, "amber", "orange")
    # tap lines around the fingertip
    for x, y in ((40, 4), (41, 5), (48, 0), (48, 1), (56, 4), (55, 5)):
        g.p(x, y, "white")
    # pointing hand: index finger up, the other fingers curled to the right, thumb on the left
    g.rect(46, 6, 5, 13, "skin1")
    g.rect(47, 5, 3, 1, "skin1")
    g.rect(47, 6, 3, 2, "cream")
    g.rect(42, 16, 15, 12, "skin1")
    g.rect(43, 15, 13, 1, "skin1")
    for y in (16, 20, 24):
        g.rect(51, y + 3, 6, 1, "skin2")
    g.rect(40, 18, 3, 6, "skin1")
    g.rect(40, 23, 3, 1, "skin2")
    g.rect(50, 7, 1, 11, "skin2")
    g.rect(56, 16, 1, 12, "skin2")
    g.rect(43, 27, 13, 1, "skin2")
    g.rect(43, 28, 13, 6, "white")
    g.rect(43, 33, 13, 1, "lgrey")
    g.rect(55, 28, 1, 6, "lgrey")
    return g


IMAGES = {
    "icon-pause": lambda: to_image(pause().outlined()),
    "icon-help": lambda: to_image(help_icon().outlined()),
    "icon-close": lambda: to_image(close().outlined()),
    "icon-lock": lambda: to_image(lock().outlined()),
    "icon-money": lambda: to_image(money().outlined()),
    "icon-stinky": lambda: to_image(stinky().outlined()),
    "ui-panel": lambda: to_image(panel().outlined(False)),
    "ui-hint": lambda: to_image(hint().outlined(False)),
    "ui-hint-tail": lambda: to_image(hint_tail().outlined(False)),
    "ui-new-best": new_best,
    "ui-slot-locked": slot_locked,
    "ui-top-bar": lambda: to_image(top_bar().outlined(False)),
    "ui-quip": lambda: to_image(quip().outlined(False)),
    "ui-quip-tail": lambda: to_image(quip_tail().outlined(False)),
    "ui-zone-banner": lambda: to_image(zone_banner().outlined(False)),
    "ui-touch-hint": lambda: to_image(touch_hint().outlined()),
}


def sprites():
    yield "ui-doghouse", [(dog, [doghouse(*cols).outlined(False)], 1000) for dog, cols in ROOFS.items()]
    yield "ui-select", [("pulse", [select_frame(False).outlined(False), select_frame(True).outlined(False)], 450)]
    yield "ui-check", [(lb, [check_badge(lb).outlined()], 1000) for lb in ("1", "2", "3", "tick")]
    yield "fx-tap", [("play", [tap_burst(i).outlined(False) for i in range(4)], 60)]
    yield "fx-dust", [("play", [dust(i).outlined(False) for i in range(4)], 80)]
    yield "ui-heart", [("full", [heart(True).outlined(False)], 1000), ("empty", [heart(False).outlined(False)], 1000)]
    yield "ui-button", [(s, [button(s).outlined(False)], 1000) for s in ("normal", "pressed", "disabled")]
    yield "icon-sound", [("on", [speaker(True).outlined()], 1000), ("off", [speaker(False).outlined()], 1000)]
    yield "icon-music", [("on", [speaker(True, True).outlined()], 1000), ("off", [speaker(False, True).outlined()], 1000)]
    yield "ui-zone-pips", [(s, [zone_pip(s).outlined(False)], 1000) for s in ("done", "current", "todo")]


def preview(out, scale=3, width=380):
    """Every piece in rows that wrap at width, so the 360px top bar gets a row of its own."""
    pieces = [draw() for draw in IMAGES.values()]
    for _, tags in sprites():
        pieces += [to_image(f) for _, fs, _ in tags for f in fs]
    rows, row = [], []
    for p in pieces:
        if row and sum(q.width + 6 for q in row) + p.width > width:
            rows.append(row)
            row = []
        row.append(p)
    rows.append(row)
    height = sum(max(p.height for p in r) + 6 for r in rows)
    sheet = Image.new("RGB", (width, height), (115, 62, 57))
    y = 0
    for r in rows:
        x = 0
        for p in r:
            sheet.paste(p, (x, y), p)
            x += p.width + 6
        y += max(p.height for p in r) + 6
    sheet.resize((width * scale, height * scale), Image.NEAREST).save(out)


def build():
    os.makedirs("art/ui", exist_ok=True)
    os.makedirs("public/art/images", exist_ok=True)
    for key, draw in IMAGES.items():
        png = f"public/art/images/{key}.png"
        draw().save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/ui/{key}.aseprite"], check=True)
    build_sprites(list(sprites()), "art/ui")
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
