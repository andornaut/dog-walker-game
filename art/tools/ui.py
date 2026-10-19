#!/usr/bin/env python3
"""Draw the UI kit: icons, nine-slice panels and buttons, the hint bubble and badges.

Images (16x16 icons unless noted): icon-pause, icon-play, icon-help, icon-close,
icon-logbook, icon-settings, icon-lock, icon-money, icon-stinky; ui-panel, ui-hint
(24x24 nine-slices, 8px corners), ui-hint-tail (8x6), ui-new-best (72x20 ribbon, text
baked in with font-title), ui-slot-locked (160x46, the yard sign for the next dog slot;
the game writes its two lines); the home screen's ui-detail-card and ui-step (24x24
nine-slices, 8px corners), ui-detail-band (24x22 three-slice, 8px caps) and
ui-detail-well (68x68); the run screen's ui-top-bar (360x40), ui-quip (24x24
nine-slice, 8px corners), ui-quip-tail (6x8), ui-zone-banner (248x48) and
ui-touch-hint (96x36).
Sprites: ui-doghouse (72x146, one dog slot; a tag per dog key and `empty`),
ui-select (24x24 nine-slice, 8px corners; tag pulse), ui-afford (24x24 nine-slice,
8px corners; tag glint), ui-check and ui-step-number (16x16; tags 1, 2, 3, tick),
fx-tap and fx-dust (16x16; tag play), ui-heart (8x7; tags full, empty), ui-button
(24x24 nine-slice, 3px corners and a 5px bottom; tags normal, pressed, disabled,
secondary, secondary-pressed), ui-icon-button (20x20, the face under a 16x16 icon such as pause, help or sound; tags normal, pressed),
ui-switch (32x16; tags on, off), ui-slider (24x10 three-slice, 4px caps; tags filled,
empty, filled-disabled, empty-disabled), ui-slider-knob (10x16; tags normal, pressed,
disabled), icon-sound and icon-music (tags on, off), icon-sound-panel, icon-music-panel,
icon-effects-panel and icon-motion-panel (tags on, off), ui-zone-pips (18x8; tags done,
current, todo).

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
# icon-pause, icon-help, icon-close, icon-sound and icon-music sit on ui-icon-button's navy
# face, so they have no outline: cream holds 9.6:1 there, tan 6.6:1, amber 7.5:1, orange
# 5.0:1 and pink 5.1:1. The -panel icons sit on the Settings panel's cream: dbrown holds
# 5.85:1 there, plum 9.42:1 and dred 5.07:1.

# The speaker, note and effects inks: face, shade on the lower-right edges, and the mute X.
NAVY_FACE = ("cream", "tan", "pink")
CREAM_PANEL = ("dbrown", "plum", "dred")

def pause():
    """Amber bars, so the run control stands apart from the cream sound toggle beside it."""
    g = Grid(16, 16)
    g.rect(4, 3, 3, 10, "amber")
    g.rect(9, 3, 3, 10, "amber")
    g.rect(6, 3, 1, 10, "orange")
    g.rect(11, 3, 1, 10, "orange")
    return g


def play():
    """The pause button's face while paused: an amber triangle as tall as the pause bars, its
    lower edge orange, 1px right of centre so it looks centred."""
    g = Grid(16, 16)
    for j in range(10):
        w = round(min(j, 9 - j) * 1.6) + 2
        g.rect(5, 3 + j, w, 1, "amber")
        if j >= 5:
            g.p(4 + w, 3 + j, "orange")
    return g


def help_icon():
    """A bold question mark, 2px strokes with a tan right edge like the pause bars."""
    g = Grid(16, 16)
    for y, row in enumerate(["..cccc..", ".cccccct", "cct..cct", "tt...cct", "....ccct", "...ccct.",
                             "...cct..", "...cct..", "........", "...cct..", "...cct.."]):
        for x, ch in enumerate(row):
            if ch != ".":
                g.p(4 + x, 2 + y, "cream" if ch == "c" else "tan")
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


def mute_x(g, y, col="pink"):
    """The X that marks a muted icon, 5x5 in 2px strokes from (10, y)."""
    for i in range(4):
        g.rect(10 + i, y + i, 2, 2, col)
        g.rect(13 - i, y + i, 2, 2, col)


def speaker(ink, on, note=False):
    """The states differ by shape: the speaker has two sound waves for on and an X in their
    place for off; the music note (an eighth note, its flag curling right) is bare for on and
    has the same X below its flag for off. Neither has an outline, which would fill the gaps
    between the waves. ink is NAVY_FACE or CREAM_PANEL."""
    face, shade, x_col = ink
    g = Grid(16, 16)
    if note:
        g.ell(4.5, 12, 3.5, 2.6, face, shade)
        g.rect(7, 2, 1, 10, face)
        g.rect(8, 2, 1, 9, shade)
        for x, y in ((9, 2), (10, 2), (9, 3), (10, 3), (11, 3), (10, 4), (11, 4), (12, 4), (11, 5), (12, 5),
                     (12, 6), (12, 7), (11, 7)):
            g.p(x, y, face)
        if not on:
            mute_x(g, 9, x_col)
        return g
    g.rect(1, 5, 4, 6, face)
    for i in range(4):
        g.rect(5 + i, 4 - i, 1, 8 + 2 * i, face)
    g.rect(1, 10, 4, 1, shade)
    g.rect(8, 1, 1, 14, shade)
    if on:
        for x, y in ((10, 5), (10, 10), (12, 3), (13, 4), (13, 11), (12, 12)):
            g.p(x, y, face)
        g.rect(11, 6, 1, 4, face)
        g.rect(14, 5, 1, 6, face)
    else:
        mute_x(g, 5, x_col)
    return g


def effects(ink, on):
    """The Settings Effects row: a four-point sparkle with two small ones in the waves' place
    for on, and the speaker's X there instead for off."""
    face, shade, x_col = ink
    g = Grid(16, 16)
    for y, row in enumerate(["....f....", "....f....", "...ffs...", "...ffs...", "..fffss..", "fffffffss",
                             "..fffss..", "...fss...", "...fss...", "....s....", "....s...."]):
        for x, ch in enumerate(row):
            if ch != ".":
                g.p(x, 3 + y, face if ch == "f" else shade)
    if on:
        g.rect(12, 2, 1, 5, face)
        g.rect(10, 4, 5, 1, face)
        g.p(13, 4, shade)
        g.rect(13, 9, 1, 3, face)
        g.rect(12, 10, 3, 1, face)
        g.p(10, 13, face)
    else:
        mute_x(g, 5, x_col)
    return g


def motion(ink, on):
    """The Settings Reduced motion row: a ball. on, it flies with three speed lines trailing
    it; off, it rests on a still ground line with no speed lines. The Reduced motion switch
    shows off while it is on."""
    face, shade, _ = ink
    g = Grid(16, 16)
    cy = 7.5 if on else 10.5
    g.ell(11.5, cy, 3.6, 3.6, face, shade)
    if on:
        g.rect(3, 4, 4, 1, face)
        g.rect(0, 7, 7, 1, face)
        g.rect(2, 10, 5, 1, face)
    else:
        g.rect(1, 14, 15, 1, face)
        g.rect(1, 15, 15, 1, shade)
    return g


def logbook_icon():
    """An open ledger, its two pages bowed up from the spine with three ruled lines each; the
    spine is a navy gap, so the face shows through."""
    g = Grid(16, 16)
    for y, row in enumerate(["cc..........cc..", "cccc......cccc..", "ccccccc.cccccct.", "c-----c.c-----t.",
                             "ccccccc.cccccct.", "c----cc.c----ct.", "ccccccc.cccccct.", "c-----c.c-----t.",
                             "ccccccc.cccccct.", "cccccct.ccccctt.", "tttccct.ccctttt.", "...ttt.t.ttt...."]):
        for x, ch in enumerate(row):
            if ch != ".":
                g.p(x, 2 + y, {"c": "cream", "t": "tan", "-": "tan"}[ch])
    return g


def settings_icon():
    """A cog: eight square teeth around a ring with a round hole, cream with tan on the
    lower-right edges like the other navy-face glyphs."""
    import math

    g = Grid(16, 16)
    cx = cy = 7.5
    for y in range(16):
        for x in range(16):
            dx, dy = x + 0.5 - cx - 0.5, y + 0.5 - cy - 0.5
            r = math.hypot(dx, dy)
            a = (math.degrees(math.atan2(dy, dx)) + 22.5) % 45
            tooth = 11 <= a <= 34 and r <= 7.2
            if (r <= 5.2 or tooth) and r > 2.2:
                edge = r > 4.4 if not tooth else r > 6.3
                g.p(x, y, "tan" if edge and dx + dy > 0 else "cream")
    return g


def heart(full):
    """8x7: a full heart is filled dark red; an empty one is a dark brown outline, so the two
    differ by fill as well as colour (5:1 or more on the cream and tan slots)."""
    g = Grid(8, 7)
    rows = [".11.11.", "1111111", "1111111", ".11111.", "..111..", "...1..."]
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c != "1":
                continue
            inside = all(0 <= y + dy < len(rows) and 0 <= x + dx < len(row) and rows[y + dy][x + dx] == "1"
                         for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)))
            if full:
                g.p(x, y, "dred")
            elif not inside:
                g.p(x, y, "dbrown")
    if full:
        g.p(1, 1, "red")
        g.p(2, 1, "pink")
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
    """secondary is a tan face on a brown lip for the actions beside the amber primary (Help,
    Settings, Head home beside Resume). Labels are plum: 7.35:1 on amber, 6.49:1 on tan.
    Every row below 2 and above 19 is plain face, so the plate stretches to any height with
    slices of 3 at the top and sides and 5 at the bottom (or 6 all round). Pressed, the
    highlight sits on the face's top edge (row 2), inside the top slice."""
    face, lip, hi = {"normal": ("amber", "orange", "yellow"), "pressed": ("amber", None, "yellow"),
                     "disabled": ("slate", "dslate", "grey"), "secondary": ("tan", "brown", "cream"),
                     "secondary-pressed": ("tan", None, "cream")}[state]
    g = Grid(24, 24)
    pressed = state.endswith("pressed")
    top = 2 if pressed else 0
    if lip:
        g.rect(1, 20, 22, 4, lip)
        g.rect(0, 20, 24, 3, lip)
    g.rect(1, top, 22, 20, face)
    g.rect(0, top + 1, 24, 18, face)
    g.rect(2, top if pressed else top + 1, 20, 1, hi)
    return g


def icon_button(state):
    """20x20, for a 16x16 icon at (2, 1), or (2, 3) when pressed: a navy face in a tan rim on a
    brown lip, so the rim holds 6.5:1 on the plum bar and 4.5:1 on the home street. Pressed, the
    face sinks 2px into its lip."""
    top = 2 if state == "pressed" else 0
    g = Grid(20, 20)
    if not top:
        g.rect(1, 16, 18, 4, "brown")
        g.rect(0, 16, 20, 3, "brown")
    g.rect(1, top, 18, 18, "tan")
    g.rect(0, top + 1, 20, 16, "tan")
    g.rect(1, top + 1, 18, 16, "navy")
    g.rect(1, top + 1, 18, 1, "dslate")
    g.p(18, top + 1, "navy")
    return g


def switch(on):
    """32x16, for the Settings panel's cream: a plum-rimmed track with the cream knob at the
    right and a white tick on forest when on, at the left with a white cross on slate when off,
    so the state reads by knob side and glyph as well as colour."""
    track, sh = ("forest", "teal") if on else ("slate", "dslate")
    g = Grid(32, 16)
    for dy in range(16):
        inset = round(8 - (64 - (dy - 7.5) ** 2) ** 0.5) if abs(dy - 7.5) < 8 else 8
        g.rect(inset, dy, 32 - 2 * inset, 1, "plum")
        if 0 < dy < 15:
            inner = round(8 - (49 - (dy - 7.5) ** 2) ** 0.5) if abs(dy - 7.5) < 7 else 8
            g.rect(inner + 1, dy, 30 - 2 * inner, 1, sh if dy == 1 else track)
    kx = 23.5 if on else 8.5
    g.ell(kx, 8, 6, 6, "plum")
    g.ell(kx, 8, 5, 5, "cream", "tan")
    g.p(int(kx) - 2, 5, "white")
    if on:
        for x, y in ((4, 8), (5, 9), (6, 10), (7, 9), (8, 8), (9, 7), (10, 6), (11, 5)):
            g.rect(x, y, 1, 2, "white")
    else:
        for i in range(5):
            g.rect(19 + i, 5 + i, 1, 2, "white")
            g.rect(23 - i, 5 + i, 1, 2, "white")
    return g


def slider_track(filled, on=True):
    """24x10 three-slice (4px caps; the middle 16 columns tile) for the Settings volume track on
    cream. filled is a solid forest bar in a plum rim the full 10px tall; empty is a hollow plum
    groove 6px tall in rows 2 to 7, so the level reads by height and fill as well as colour. The
    plum rim holds 9.42:1 on cream and forest 5.39:1. Muted (on false), both keep their shapes
    in slate and grey."""
    rim, face, hi, sh, inner = ("plum", "forest", "dgreen", "teal", "tan") if on else \
        ("slate", "grey", "lgrey", "slate", "lgrey")
    g = Grid(24, 10)
    if filled:
        g.rect(1, 0, 22, 10, rim)
        g.rect(0, 1, 24, 8, rim)
        g.rect(1, 1, 22, 8, face)
        g.rect(1, 1, 22, 1, hi)
        g.rect(1, 8, 22, 1, sh)
    else:
        g.rect(1, 2, 22, 6, rim)
        g.rect(0, 3, 24, 4, rim)
        g.rect(1, 3, 22, 4, "cream")
        g.rect(1, 3, 22, 1, inner)
    return g


def slider_knob(state):
    """10x16, drawn 3px above the track so it overhangs it 3px each way. A cream face in a plum
    rim on a tan lip; dragged, the face sinks 2px into its lip and turns yellow, the active-state
    face. Disabled while sound is muted."""
    rim, face, sh, grip = {"normal": ("plum", "cream", "tan", "brown"),
                           "pressed": ("plum", "yellow", "amber", "orange"),
                           "disabled": ("slate", "lgrey", "grey", "grey")}[state]
    top = 2 if state == "pressed" else 0
    g = Grid(10, 16)
    g.rect(1, top, 8, 16 - top, rim)
    g.rect(0, top + 1, 10, 14 - top, rim)
    g.rect(1, top + 1, 8, 14 - top, sh)
    g.rect(1, top + 1, 7, 12, face)
    g.rect(3, top + 4, 1, 6, grip)
    g.rect(6, top + 4, 1, 6, grip)
    g.p(2, top + 2, "white")
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
    """160x46: the yard sign for the next dog slot, a plum-rimmed board with a tan header plank
    over a cream panel and a padlock at the bottom right. The game writes, in sign pixels: line 1
    ("Slot 2 · $800") in font-title x2, plum (6.49:1 on tan), caps at 5,6, up to 150 wide
    ("SLOT 3 · $1,800" is 150); line 2 ("Save $650 more" darkRed, 5.07:1, or "Tap to buy"
    forest, 5.39:1, on cream) in font-body x2, caps at 5,27, up to 130 wide, left of the lock
    at 139,24. The posts stay in code."""
    g = Grid(160, 46)
    g.rect(1, 0, 158, 46, "plum")
    g.rect(0, 1, 160, 44, "plum")
    g.rect(1, 1, 158, 20, "tan")
    g.rect(1, 1, 158, 1, "cream")
    g.rect(1, 21, 158, 1, "brown")
    g.rect(1, 22, 158, 22, "cream")
    g.rect(1, 43, 158, 1, "tan")
    g.rect(158, 2, 1, 19, "brown")
    g.rect(158, 22, 1, 21, "tan")
    # nail heads at the header plank's ends
    for x in (2, 156):
        g.p(x, 3, "dbrown")
        g.p(x, 18, "dbrown")
    im = to_image(g.outlined(False))
    lk = to_image(lock().outlined())
    im.paste(lk, (139, 24), lk)
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
    """24x24 nine-slice (8px corners): the frame around a selected tile or active control. An ink
    edge on both sides of a 2px yellow band, so it stands out on any background (ink on tan or
    cream is 9:1 or more); the band pulses between yellow and white."""
    g = Grid(24, 24)
    band = "white" if glow else "yellow"
    g.rect(1, 0, 22, 24, "ink")
    g.rect(0, 1, 24, 22, "ink")
    g.rect(1, 1, 22, 22, band)
    g.rect(2, 1, 20, 22, band)
    g.rect(3, 3, 18, 18, "ink")
    g.rect(4, 4, 16, 16, None)
    for x, y in ((1, 1), (22, 1), (1, 22), (22, 22)):
        g.p(x, y, "ink")
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


# ---------- home screen: afford outline, detail card, step headings ----------

# One coin stud, 7x7, lit from the top left: P plum rim, Y yellow, A amber, O orange.
COIN = ["..PPP..", ".PYYAP.", "PYYAAAP", "PYAAAOP", "PAAAOOP", ".PAOOP.", "..PPP.."]


def afford_frame(glint):
    """24x24 nine-slice (8px corners), drawn 2px outside a dog, slot or gear tile the player can
    afford: a plum keyline outside a 1px amber line, with a gold coin stud on each corner. It
    differs from ui-select (ink, a 2px pulsing yellow band, ink, 3px out, square corners) by
    its thin line, its round studs and its deeper gold, and it does not pulse. Amber holds
    4.57:1 on the dark wood, the plum keyline 6.37:1 on the yard's grass and the studs' plum
    rims 6.49:1 on tan tiles. The glint frame flashes the top-left stud white with two rays
    along the line, all inside the corner slice so the stretched edges stay plain."""
    g = Grid(24, 24)
    g.rect(1, 0, 22, 24, "plum")
    g.rect(0, 1, 24, 22, "plum")
    g.rect(1, 1, 22, 22, "amber")
    g.rect(2, 2, 20, 20, None)
    for ox, oy in ((0, 0), (17, 0), (0, 17), (17, 17)):
        for y, row in enumerate(COIN):
            for x, ch in enumerate(row):
                if ch != ".":
                    g.p(ox + x, oy + y, {"P": "plum", "Y": "yellow", "A": "amber", "O": "orange"}[ch])
    if glint:
        for x, y in ((2, 2), (3, 1), (1, 3), (2, 1), (1, 2), (3, 2), (2, 3)):
            g.p(x, y, "white")
        g.p(7, 1, "white")
        g.p(1, 7, "white")
    return g


def detail_card():
    """24x24 nine-slice (8px corners): the hold-to-open detail card. A dark wood frame 3px wide
    with brass rivets, between a 1px tan rim outside (4.04:1 on the dark wood) and a plum
    keyline around the cream paper, so it reads apart from ui-panel's plain plum rim. The
    paper starts 6px in."""
    g = Grid(24, 24)
    g.rect(1, 0, 22, 24, "plum")
    g.rect(0, 1, 24, 22, "plum")
    g.rect(1, 1, 22, 22, "tan")
    g.rect(2, 2, 20, 20, "dbrown")
    g.rect(5, 5, 14, 14, "plum")
    g.rect(6, 6, 12, 12, "cream")
    g.rect(6, 17, 12, 1, "tan")
    g.rect(17, 6, 1, 12, "tan")
    g.p(7, 7, "white")
    for x, y in ((2, 2), (20, 2), (2, 20), (20, 20)):
        g.rect(x, y, 2, 2, "amber")
        g.p(x, y, "yellow")
        g.p(x + 1, y + 1, "orange")
    return g


def detail_band():
    """24x22 three-slice (8px caps; the middle 8 columns tile): the title band across the top
    of the detail card's paper, forest with a dgreen highlight, a teal shade and a plum line
    under it, pinned at both ends with brass pins. The game writes the name in font-title x2,
    white (7.80:1), caps 6px below the band's top."""
    g = Grid(24, 22)
    g.rect(0, 0, 24, 21, "forest")
    g.rect(0, 0, 24, 1, "dgreen")
    g.rect(0, 19, 24, 2, "teal")
    g.rect(0, 21, 24, 1, "plum")
    for x in (2, 20):
        g.rect(x, 9, 2, 2, "amber")
        g.p(x, 9, "yellow")
        g.p(x + 1, 10, "orange")
    return g


def detail_well():
    """68x68: the recessed window on the detail card for a 64x64 portrait (portrait-dog-<name>,
    an owner face or a 32x32 gear icon at 2x), drawn at 2,2. A plum rim (9.42:1 on the cream
    paper), a dark brown lip on the top and left where the recess is in shadow and brown on the
    lit bottom and right, around sky, which every portrait reads on (tan loses Pierre), with a
    blue shadow line under the top and left lips."""
    g = Grid(68, 68)
    g.rect(1, 0, 66, 68, "plum")
    g.rect(0, 1, 68, 66, "plum")
    g.rect(1, 1, 66, 66, "brown")
    g.rect(1, 1, 66, 1, "dbrown")
    g.rect(1, 1, 1, 66, "dbrown")
    g.rect(2, 2, 64, 64, "sky")
    g.rect(2, 2, 64, 1, "blue")
    g.rect(2, 2, 1, 64, "blue")
    return g


def step_plate():
    """24x24 nine-slice (8px corners): the heading plate for the home screen's numbered steps
    (Walker, Dogs, Gear), a tan board in a plum rim on a brown lip, set on the dark wood. The
    game lays ui-step-number at 4,4 and writes the label in font-title x2, plum (6.49:1 on tan),
    caps at 26,7; a note such as "(optional)" follows in font-body x2, plum. Width is the
    label's plus 34; height 24."""
    g = Grid(24, 24)
    g.rect(1, 0, 22, 24, "plum")
    g.rect(0, 1, 24, 22, "plum")
    g.rect(1, 1, 22, 21, "tan")
    g.rect(1, 1, 22, 1, "cream")
    g.rect(1, 20, 22, 2, "brown")
    g.rect(22, 2, 1, 18, "brown")
    return g


def step_number(label):
    """16x16: the step's number on a round amber badge in a plum rim, plum digits (7.35:1), or a
    white tick on forest (7.80:1) once the step is done, so done reads by shape as well."""
    done = label == "tick"
    g = Grid(16, 16)
    g.ell(8, 8, 7.5, 7.5, "plum")
    g.ell(8, 8, 6.5, 6.5, "forest" if done else "amber", "teal" if done else "orange",
          "dgreen" if done else "yellow")
    if done:
        for x, y in ((4, 8), (5, 9), (6, 10), (7, 9), (8, 8), (9, 7), (10, 6), (11, 5)):
            g.rect(x, y, 2, 2, "white")
    else:
        bits = {"1": "010110010010111", "2": "110001010100111", "3": "110001010001110"}[label]
        for r in range(5):
            for k in range(3):
                if bits[r * 3 + k] == "1":
                    g.rect(5 + k * 2, 3 + r * 2, 2, 2, "plum")
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
    42x26 (treat at 104,13, count at 122,18, up to three digits), and zone 194,5 162x29 (the
    zone name right aligned at 352,10, ui-zone-pips from 271,22). Between the treats and zone
    wells sit two ui-icon-buttons: the sound toggle at 146,10 and pause at 170,10."""
    g = Grid(360, 40)
    g.rect(0, 0, 360, 40, "plum")
    g.rect(0, 1, 360, 1, "dbrown")
    for i in range(40):
        g.rect((i * 53) % 352, 4 + (i * 11) % 31, 4 + (i % 4) * 3, 1, "dbrown")
    g.rect(0, 37, 360, 1, "brown")
    g.rect(0, 38, 360, 1, "dbrown")
    g.rect(0, 39, 360, 1, "ink")
    well(g, 4, 8, 94, 26)
    well(g, 100, 8, 42, 26)
    well(g, 194, 5, 162, 29)
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
    """96x36: a fingertip pressed on a two-way track, with fading touch marks either side and
    speed lines, for the first-run lane hint. The game writes "drag to switch lanes" in font-body
    under it."""
    g = Grid(96, 36)
    # the track: a line between two arrowheads
    g.rect(9, 5, 78, 2, "amber")
    g.rect(9, 6, 78, 1, "orange")
    for i in range(5):
        g.rect(4 + i, 6 - i, 1, 1 + 2 * i, "orange")
        g.rect(91 - i, 6 - i, 1, 1 + 2 * i, "orange")
    # where the fingertip was a moment ago, fading out either side
    for cx, col in ((26, "lgrey"), (70, "lgrey"), (36, "white"), (60, "white")):
        g.ell(cx, 6, 3, 3, col)
        g.ell(cx, 6, 1.6, 1.6, None)
    g.ell(48, 6, 4, 4, "yellow", "amber")
    # speed lines beside the hand
    for y, dx in ((16, 0), (20, 3), (24, 0)):
        g.rect(28 - dx, y, 8, 1, "white")
        g.rect(62 + dx, y, 8, 1, "white")
    # pointing hand: index finger up to the contact point, the other fingers curled to the right
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
    "icon-pause": lambda: to_image(pause().outlined(False)),
    "icon-play": lambda: to_image(play().outlined(False)),
    "icon-help": lambda: to_image(help_icon().outlined(False)),
    "icon-close": lambda: to_image(close().outlined(False)),
    "icon-logbook": lambda: to_image(logbook_icon().outlined(False)),
    "icon-settings": lambda: to_image(settings_icon().outlined(False)),
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
    "ui-detail-card": lambda: to_image(detail_card().outlined(False)),
    "ui-detail-band": lambda: to_image(detail_band().outlined(False)),
    "ui-detail-well": lambda: to_image(detail_well().outlined(False)),
    "ui-step": lambda: to_image(step_plate().outlined(False)),
}


def sprites():
    yield "ui-doghouse", [(dog, [doghouse(*cols).outlined(False)], 1000) for dog, cols in ROOFS.items()]
    yield "ui-select", [("pulse", [select_frame(False).outlined(False), select_frame(True).outlined(False)], 450)]
    yield "ui-check", [(lb, [check_badge(lb).outlined()], 1000) for lb in ("1", "2", "3", "tick")]
    rest, glint = afford_frame(False).outlined(False), afford_frame(True).outlined(False)
    yield "ui-afford", [("glint", [rest, rest, rest, glint], 400)]
    yield "ui-step-number", [(lb, [step_number(lb).outlined(False)], 1000) for lb in ("1", "2", "3", "tick")]
    yield "fx-tap", [("play", [tap_burst(i).outlined(False) for i in range(4)], 60)]
    yield "fx-dust", [("play", [dust(i).outlined(False) for i in range(4)], 80)]
    yield "ui-heart", [("full", [heart(True).outlined(False)], 1000), ("empty", [heart(False).outlined(False)], 1000)]
    yield "ui-button", [(s, [button(s).outlined(False)], 1000)
                        for s in ("normal", "pressed", "disabled", "secondary", "secondary-pressed")]
    yield "ui-icon-button", [(s, [icon_button(s).outlined(False)], 1000) for s in ("normal", "pressed")]
    yield "ui-switch", [("on", [switch(True).outlined(False)], 1000), ("off", [switch(False).outlined(False)], 1000)]
    yield "ui-slider", [(t, [slider_track(t.startswith("filled"), not t.endswith("disabled")).outlined(False)], 1000)
                        for t in ("filled", "empty", "filled-disabled", "empty-disabled")]
    yield "ui-slider-knob", [(s, [slider_knob(s).outlined(False)], 1000) for s in ("normal", "pressed", "disabled")]
    for suffix, ink in (("", NAVY_FACE), ("-panel", CREAM_PANEL)):
        yield f"icon-sound{suffix}", [(t, [speaker(ink, t == "on").outlined(False)], 1000) for t in ("on", "off")]
        yield f"icon-music{suffix}", [(t, [speaker(ink, t == "on", True).outlined(False)], 1000) for t in ("on", "off")]
    yield "icon-effects-panel", [(t, [effects(CREAM_PANEL, t == "on").outlined(False)], 1000) for t in ("on", "off")]
    yield "icon-motion-panel", [(t, [motion(CREAM_PANEL, t == "on").outlined(False)], 1000) for t in ("on", "off")]
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
