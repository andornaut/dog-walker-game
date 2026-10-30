#!/usr/bin/env python3
"""Draw the UI kit: icons, nine-slice panels and buttons, the hint bubble and badges.

Images (16x16 icons unless noted): icon-pause, icon-play, icon-home, icon-help, icon-close,
icon-logbook, icon-settings, icon-exit, icon-share (Safari's Share button, on the iOS install steps card),
icon-browser-menu (the browser menu button's three dots, on the Firefox for Android install steps
card), icon-update (a green down arrow into a tray, on the home screen's update notice), icon-lock,
icon-bill (a green dollar bill with a white $, on an item for sale the bank covers), icon-treat
(the treat pickup, its bone and heart as road.treat lays them out at 16x16, for the message
strip), icon-stinky; icon-dog-slot (32x32, a pack slot for sale in the shop: a doghouse with a
green plus badge, as the shop's item-<gear> art, outlined with icon_edge); ui-panel (24x24
nine-slice, 4px corners), ui-hint (24x24 nine-slice, 8px corners), ui-hint-tail
(8x6), ui-new-best (72x20 ribbon, text baked in with font-title); the start screen's ui-detail-card
(24x24 nine-slice, 8px corners) and ui-detail-well (68x68); the shop list's ui-scroll-track (8x24) and
ui-scroll-thumb (6x24, three-slices with 3px caps); the walker section's ui-cork (32x32 seamless corkboard tile), the dogs section's ui-plaid
(16x16 seamless tartan tile), the Pocket section's ui-denim (16x16 seamless twill tile), ui-stitch-h
(8x2) and ui-stitch-v (2x8, seamless stitch runs), all repeated with TileSprite; the card rows'
ui-strip-well (24x24 nine-slice, the band behind a card row's subtitle), ui-quip (24x24 nine-slice,
8px corners), ui-quip-tail (6x8), ui-quip-tail-down and ui-quip-tail-up (8x6), ui-celebrate-burst (148x132, the
starburst behind the walker in the zone celebration), ui-zone-banner (248x48); the start screen top
bar's bank well, drawn at (5, 5) in three pieces that stretch it to the bank's width,
ui-home-cash-well-left, ui-home-cash-well-mid (repeated across) and ui-home-cash-well-right (1x29 each); the walk HUD's ui-walk-bar (360x40),
ui-effect-well (22x22), ui-zone-pill (13x13 three-slice, 4px ends), ui-dog-card-band (360x76, drawn at (0, 480)), ui-lead-tag (27x11, LEAD baked
in with font-title) and ui-owner-tab (36x36).

Sprites: ui-dog-card (120x70, one of three cards in the walk's card row; a tag per dog key and
`empty`, then heart-loss: 4 frames, 60, 60, 80 and 80ms, an overlay drawn over the card and under
the game's faces, hearts and text), ui-dog-card-warn (120x70, the low-hearts rim drawn over
ui-dog-card; tags pulse, static), ui-debuff-bar (360x16, one active debuff's bar under the walk bar;
tags muddy, stinky, zoomies, spotlight), ui-select (24x24 nine-slice, 8px corners; tag pulse), ui-afford (24x24
nine-slice, 8px corners; tag glint), ui-check (16x16; tags 1, 2, 3, tick), ui-section (24x32
nine-slice, 3px sides and bottom, 24px top; tags complete, neutral), fx-tap and fx-dust (16x16; tag
play), ui-heart (8x7; tags full, empty, and full-dark and empty-dark for the navy ui-dog-card),
ui-button (24x24 nine-slice, 3px corners and a 5px bottom; tags normal, pressed, disabled,
secondary, secondary-pressed, go, go-pressed, go-disabled), ui-icon-button (20x20, the face under a
16x16 icon such as pause, help or sound; tags normal, pressed), ui-switch (32x16; tags on, off),
ui-slider (24x10 three-slice, 4px caps; tags filled, empty, filled-disabled, empty-disabled),
ui-slider-knob (10x16; tags normal, pressed, disabled), icon-sound (tags on, off),
icon-sound-panel, icon-music-panel, icon-effects-panel, icon-motion-panel and icon-install-panel (tags on, off),
ui-zone-pips (18x8; tags todo, and <zone> and <zone>-done for each zone in ZONE_COLOURS), ui-tile
(24x24 nine-slice, 4px on every side; tags normal, selected, disabled), ui-touch-drag (104x40, the
help screen's swipe, a white glove dragging one lane-width; tags right and left, each a whole swipe of
15 frames timed per frame (TOUCH_MS) and ending on an empty frame, and still (one frame for reduced
motion)).

Panels, bubbles, plates, tiles and card frames share one chrome (chrome_shape); hits.py, moments.py,
scene.py and cards.py draw their plates, callouts and frames with it.

Usage:
  ui.py preview OUT.png   every piece, scaled up
  ui.py build             write art/ui/*.aseprite and export to
                          public/art/images/ and public/art/sprites/

Run from the repository root. A build overwrites the
.aseprite sources, so hand edits to them belong in this file instead.
"""

import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import fonts  # noqa: E402
import hits  # noqa: E402
from pixel import DARKER, HEART, K, Grid, bitmap, contrast, edged, icon_edge, to_image, build as build_sprites  # noqa: E402


# ---------- the chrome: one frame for every panel, bubble, plate and card frame ----------

def chrome_shape(g, inside, open_edge=None, face="cream", lip="tan", line="plum"):
    """Frame the shape inside(x, y) on g in the UI chrome: a 1px ink outer line, a 1px inner line
    (plum; None leaves it out, for shapes too small to hold it), the face, and the lip (tan on
    cream) along the face's bottom row and right column. open_edge(x, y) is true for points off
    the grid that continue the shape, so a tail laid over a bubble's rim stays open on that side.
    Ink holds 3:1 on the light roads, the cream face on navy, ink and dark wood; text sits on
    the face."""
    def solid(x, y):
        if 0 <= x < g.w and 0 <= y < g.h:
            return inside(x, y)
        return bool(open_edge and open_edge(x, y))

    sides = ((0, -1), (0, 1), (-1, 0), (1, 0))
    ring = {}
    for y in range(g.h):
        for x in range(g.w):
            if inside(x, y):
                ring[x, y] = 0 if any(not solid(x + dx, y + dy) for dx, dy in sides) else None
    for (x, y), d in ring.items():
        if line and d is None and any(ring.get((x + dx, y + dy)) == 0 for dx, dy in sides):
            ring[x, y] = 1
    for (x, y), d in ring.items():
        if d == 0:
            g.p(x, y, "ink")
        elif d == 1:
            g.p(x, y, line)
        else:
            framed = [ring.get((x + dx, y + dy), -1) for dx, dy in ((0, 1), (1, 0))]
            g.p(x, y, lip if any(v is not None and v >= 0 for v in framed) else face)
    return g


def rounded_inside(x0, y0, w, h, r):
    """A box with each corner cut on a diagonal r pixels long, as an inside(x, y) test."""
    def inside(x, y):
        i, j = x - x0, y - y0
        if not (0 <= i < w and 0 <= j < h):
            return False
        return min(i, w - 1 - i) + min(j, h - 1 - j) >= r
    return inside


def chrome(g, x, y, w, h, r=1, face="cream", lip="tan", line="plum"):
    """A chrome box (chrome_shape) at x, y, w x h, its corners cut r pixels."""
    return chrome_shape(g, rounded_inside(x, y, w, h, r), face=face, lip=lip, line=line)


def plate(face, lit, shade, w=24, h=24):
    """A coloured plate in the chrome: the frame and a cream band 2px wide (the lip on its bottom
    and right), then the face from 4px in, lit along its top and left and shaded along its bottom
    and right. Rows and columns 8 to w - 9 are uniform, so a nine-slice with 8px corners keeps them
    crisp. White text on the face: 7.34:1 on dred, 8.48:1 on blue, 8.86:1 on purple."""
    g = Grid(w, h)
    chrome(g, 0, 0, w, h)
    g.rect(4, 4, w - 8, h - 8, face)
    g.rect(4, 4, w - 8, 1, lit)
    g.rect(4, 4, 1, h - 8, lit)
    g.rect(4, h - 5, w - 8, 1, shade)
    g.rect(w - 5, 5, 1, h - 9, shade)
    return g


# ---------- icons ----------
# icon-pause, icon-play, icon-home, icon-help, icon-close, icon-logbook, icon-settings, icon-exit and
# icon-sound sit on ui-icon-button's navy face, so they have no outline: cream holds 9.6:1 there, tan 6.6:1,
# amber 7.5:1, orange 5.0:1 and pink 5.1:1. The -panel icons sit on the Settings panel's cream, and icon-share
# and icon-browser-menu on the install steps card's: dbrown holds 5.85:1 there, plum 9.42:1 and dred 5.07:1.

# The speaker, note and effects inks: face, shade on the lower-right edges, and the mute X.
NAVY_FACE = ("cream", "tan", "pink")
CREAM_PANEL = ("dbrown", "plum", "dred")


def pause():
    """Amber bars, like the Home glyph, so the walk controls stand apart
    from the cream help and sound glyphs."""
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


def home_icon():
    """The Home button: a house as tall as the pause bars, amber with
    orange on its lower-right edges like them, a chimney on the right slope and a doorway the
    navy face shows through."""
    g = Grid(16, 16)
    for y, row in enumerate([".....aa.ao..", "....aaaaao..", "...aaaaaao..", "..aaaaaaao..", ".aaaaaaaaao.",
                             "aaaaaaaaaaao", "..aaaaaaao..", "..aaa..aao..", "..aaa..aao..", "..ooo..ooo.."]):
        for x, ch in enumerate(row):
            if ch != ".":
                g.p(2 + x, 3 + y, "amber" if ch == "a" else "orange")
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


# The $ on icon-bill, 5x7: a stroke down the middle through an S.
DOLLAR = ["..a..", ".aaaa", "a.a..", ".aaa.", "..a.a", "aaaa.", "..a.."]


def bill():
    """A green dollar bill, its border and its seal's ring in dgreen round a white $, on an item for
    sale the bank covers, where icon-lock marks one it does not: the two differ by shape as well as
    colour."""
    g = Grid(16, 16)
    g.rect(1, 4, 14, 9, "green")
    g.rect(1, 12, 14, 1, "dgreen")
    g.rect(14, 4, 1, 9, "dgreen")
    g.rect(2, 5, 12, 1, "dgreen")
    g.rect(2, 11, 12, 1, "dgreen")
    g.ell(8.5, 8.5, 3.6, 3.2, "dgreen")
    bitmap(g, 6, 5, DOLLAR, {"a": "white"})
    return g


def treat_icon():
    """The treat pickup's bone and heart as road.treat lays them out at 16x16 (idle frame 0), outlined with icon_edge
    as the content icons are."""
    import road

    g = road.treat(lift=0)
    g.edge = icon_edge
    return g


def stinky():
    """Three stink lines waving in step out of a small cloud puff, in the skunk's mauve family as
    skunk-cloud: pink with a plum right side and no outline, so the plum
    carries the lines on cream (9.42:1) and the pink on its mauve debuff bar. The puff is
    mauve, shaded purple, in its ramp outline. Returns frame pixels."""
    g = Grid(16, 16)
    for cx, cy, rx, ry in ((4, 12.5, 3, 2.3), (12, 12.5, 3, 2.3), (8, 11, 3.5, 3)):
        g.ell(cx, cy, rx, ry, "mauve", "purple")
    g.rect(4, 14, 8, 1, "purple")
    px = g.outlined()
    for x0, top in ((2, 1), (7, 0), (12, 1)):
        for y in range(top, 9):
            x = x0 + hits.WAVE[(y + 6) % 8]
            px[y][x], px[y][x + 1] = K["pink"], K["plum"]
    return px


def mute_x(g, x, y, col):
    """The X that marks a muted icon, 5x5 in 2px strokes from (x, y)."""
    for i in range(4):
        g.rect(x + i, y + i, 2, 2, col)
        g.rect(x + 3 - i, y + i, 2, 2, col)


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
            mute_x(g, 10, 9, x_col)
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
        mute_x(g, 10, 5, x_col)
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
        mute_x(g, 10, 5, x_col)
    return g


def motion(ink, on):
    """The Settings Reduced motion row, its tag following the switch as every row's does: a ball.
    on (motion reduced), it rests on a still ground line with no speed lines; off, it flies with
    three speed lines trailing it."""
    face, shade, _ = ink
    g = Grid(16, 16)
    cy = 10.5 if on else 7.5
    g.ell(11.5, cy, 3.6, 3.6, face, shade)
    if on:
        g.rect(1, 14, 15, 1, face)
        g.rect(1, 15, 15, 1, shade)
    else:
        g.rect(3, 4, 4, 1, face)
        g.rect(0, 7, 7, 1, face)
        g.rect(2, 10, 5, 1, face)
    return g


def install(ink, on):
    """The Settings Install app row: a phone, its screen a gap the panel shows through, with a
    down arrow into the screen for on and the speaker's X in the arrow's place for off."""
    face, shade, x_col = ink
    g = Grid(16, 16)
    for y, row in enumerate(["...ffffffffff...", "..fffffffffffs..", "..ff........fs..", "..ff........fs..",
                             "..ff...fs...fs..", "..ff...fs...fs..", "..ff...fs...fs..", "..ff...fs...fs..",
                             "..ff.ffffss.fs..", "..ff..ffss..fs..", "..ff...fs...fs..", "..ff........fs..",
                             "..ff........fs..", "..fffffffffffs..", "..fffffffffffs..", "...ssssssssss..."]):
        for x, ch in enumerate(row):
            if ch != ".":
                g.p(x, y, face if ch == "f" else shade)
    if not on:
        g.rect(4, 4, 8, 7, None)
        mute_x(g, 5, 5, x_col)
    return g


def share_icon():
    """Safari's Share button, for the iOS install steps card: a box open at the top with an
    arrow rising out of it, its chevron head and box in 2px strokes, in the -panel icons' inks."""
    face, shade, _ = CREAM_PANEL
    g = Grid(16, 16)
    for y, row in enumerate([".......fs.......", "......ffss......", ".....fffsss.....", "....ff.fs.ss....",
                             ".......fs.......", ".......fs.......", "..fff..fs..ffs..", "..ff...fs...fs..",
                             "..ff...fs...fs..", "..ff...fs...fs..", "..ff...fs...fs..", "..ff........fs..",
                             "..ff........fs..", "..ff........fs..", "..fffffffffffs..", "...ssssssssss..."]):
        for x, ch in enumerate(row):
            if ch != ".":
                g.p(x, y, face if ch == "f" else shade)
    return g


def browser_menu_icon():
    """The browser menu button, for the Firefox for Android install steps card: three round
    4x4 dots stacked on the centre line with 2px gaps, lit like icon-share."""
    face, shade, _ = CREAM_PANEL
    g = Grid(16, 16)
    for top in (0, 6, 12):
        for y, row in enumerate([".ff.", "fffs", "ffss", ".ss."]):
            for x, ch in enumerate(row):
                if ch != ".":
                    g.p(6 + x, top + y, face if ch == "f" else shade)
    return g


# icon-update, 16x16 fills: lime lights the top-left edges, dgreen shades the lower-right.
UPDATE_ROWS = ["................", "................", "......LLLL......", "......LGGD......",
               "......LGGD......", "..LLLLLGGDLLLD..", "...LGGGGGGGGD...", "....LGGGGGGD....",
               ".....LGGGGD.....", "......LGGD......", ".LL....GD....LL.", ".LG..........GD.",
               ".LG..........GD.", ".LGGGGGGGGGGGGD.", ".DDDDDDDDDDDDDD.", "................"]


def update_icon():
    """The home screen's update notice: a green down arrow, its head 12 wide over a 4-wide shaft,
    pointing into a tray of 2px walls and floor, with 2px or more clear between the head and the
    walls. One forest line round every fill, which holds 3:1 on cream and tan as icon_edge's
    outline on green does."""
    g = edged(Grid(16, 16), "forest")
    inks = {"L": "lime", "G": "green", "D": "dgreen"}
    for y, row in enumerate(UPDATE_ROWS):
        for x, ch in enumerate(row):
            if ch != ".":
                g.p(x, y, inks[ch])
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
    """A cog: eight teeth around a ring with an eight-sided hole, the shape the sibling
    duck-platformer game's Settings button shares, cream with tan on the lower-right edges like
    the other navy-face glyphs."""
    g = Grid(16, 16)
    for y, row in enumerate(["......ccct......", "......ccct......", "..ct..ccct..ct..", "..tcccccccccct..",
                             "...ccccttccct...", "...ccct..tcct...", "ccccct....tcccct", "cccct......cccct",
                             "cccct......cccct", "tttcct....cccttt", "...ccct..ccct...", "...ccccccccct...",
                             "..ccttccccttct..", "..tt..ccct..tt..", "......ccct......", "......tttt......"]):
        for x, ch in enumerate(row):
            if ch != ".":
                g.p(x, y, "cream" if ch == "c" else "tan")
    return g


def exit_icon():
    """The home top bar's Exit button: a doorway with an arrow leaving it to the right, the shape
    the sibling duck-platformer game's shares, cream with tan on the lower-right edges like the
    other navy-face glyphs."""
    g = Grid(16, 16)
    for y, row in enumerate([".cccccccct......", ".cctttttct......", ".ct.....ct..t...", ".ct.....tt..ct..",
                             ".ct.........cct.", ".ct...ccccccccct", ".ct...ttttttccct", ".ct.........cct.",
                             ".ct.....ct..ct..", ".ct.....ct..t...", ".cccccccct......", ".ttttttttt......"]):
        for x, ch in enumerate(row):
            if ch != ".":
                g.p(x, 2 + y, "cream" if ch == "c" else "tan")
    return g


def heart(full, dark=False):
    """8x7: a full heart is filled dark red; an empty one is a dark brown outline, so the two
    differ by fill as well as colour (5:1 or more on cream). dark is for the navy
    dog card: the full heart red (3.31:1) lit pink and white, the empty one a grey outline (4.93:1)."""
    g = Grid(8, 7)
    for y, row in enumerate(HEART):
        for x, c in enumerate(row):
            if c != "1":
                continue
            inside = all(0 <= y + dy < len(HEART) and 0 <= x + dx < len(row) and HEART[y + dy][x + dx] == "1"
                         for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)))
            if full:
                g.p(x, y, "red" if dark else "dred")
            elif not inside:
                g.p(x, y, "grey" if dark else "dbrown")
    if full:
        g.p(1, 1, "pink" if dark else "red")
        g.p(2, 1, "white" if dark else "pink")
    return g


# ---------- nine-slices and badges ----------

def panel():
    """24x24 nine-slice (4px corners): the chrome box (chrome) with its corners cut 1px."""
    return chrome(Grid(24, 24), 0, 0, 24, 24)


# The interaction states shared by tiles and buttons: each state's face, its lip and a button
# face's top highlight. normal is the chrome's cream, selected the gold of ui-section's complete
# state, go the one primary action on a screen, disabled a flat grey with no lip.
STATES = {"normal": ("cream", "tan", "white"), "selected": ("yellow", "amber", None),
          "go": ("green", "forest", "yellow"), "disabled": ("ngrey", None, None)}


def button(state):
    """24x24 nine-slice, 3px top and sides and a 5px bottom: a face in a 1px ink line on its lip,
    in one of the interaction states (STATES). normal and pressed are the cream standard button,
    plum label (9.42:1); go and go-pressed the primary action, one per screen, ink label on green
    (8.41:1); disabled and go-disabled are the same flat ngrey face sunk to the pressed depth with
    no lip or highlight, ndslate label (3.56:1; inactive, so exempt). secondary and
    secondary-pressed are copies of normal and pressed.
    Raised, row 0 is ink, row 1 the highlight, the face runs to row 18, the lip fills rows 19 to
    22 and ink row 23. Sunk, rows 0 and 1 are clear, row 2 is ink and the face fills rows 3 to
    22, 2px lower, so every row from 3 to 18 is plain face and the plate stretches cleanly."""
    kind = {"normal": "normal", "pressed": "normal", "secondary": "normal", "secondary-pressed": "normal",
            "go": "go", "go-pressed": "go", "disabled": "disabled", "go-disabled": "disabled"}[state]
    face, lip, hi = STATES[kind]
    sunk = state.endswith("pressed") or kind == "disabled"
    top = 2 if sunk else 0
    g = Grid(24, 24)
    g.rect(1, top, 22, 24 - top, "ink")
    g.rect(0, top + 1, 24, 22 - top, "ink")
    g.rect(1, top + 1, 22, 22 - top, face)
    if not sunk:
        g.rect(1, 19, 22, 4, lip)
        g.rect(1, 1, 22, 1, hi)
    return g


TILE = 24
# A normal tile's lip: brown, not the chrome's tan, so it reads apart from the tan box behind an
# owned item's picture, which sits on it.
TILE_LIP = "brown"


def tile(state):
    """24x24 nine-slice, 4px on every side: a pickable tile (walker, dog or gear) in one of the
    interaction states. normal is the chrome's ink and plum lines and cream face on a TILE_LIP
    lip 2px deep at the bottom and 1px at the right. selected is the gold of ui-section's complete state: an
    ink line, a 1px amber band and an orange line round a yellow face on a 1px amber lip.
    disabled (not owned and short, the pack full, not available) is flat in the neutral greys: an
    ink line, an nslate line and an ngrey face with no lip. Content sits from 3px in."""
    face, lip, _ = STATES[state]
    if state == "normal":
        lip = TILE_LIP
    g = Grid(TILE, TILE)
    if state == "selected":
        g.rect(1, 0, TILE - 2, TILE, "ink")
        g.rect(0, 1, TILE, TILE - 2, "ink")
        g.rect(1, 1, TILE - 2, TILE - 2, "amber")
        g.rect(2, 2, TILE - 4, TILE - 4, "orange")
        g.rect(3, 3, TILE - 6, TILE - 6, face)
        g.rect(3, TILE - 4, TILE - 6, 1, lip)
        g.rect(TILE - 4, 3, 1, TILE - 6, lip)
        return g
    chrome(g, 0, 0, TILE, TILE, face=face, lip=lip or face, line="nslate" if lip is None else "plum")
    if lip:
        g.rect(2, TILE - 4, TILE - 4, 1, lip)
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
    in the neutral greys."""
    rim, face, hi, sh, inner = ("plum", "forest", "dgreen", "teal", "tan") if on else \
        ("nslate", "ngrey", "nlgrey", "nslate", "nlgrey")
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
                           "disabled": ("nslate", "nlgrey", "ngrey", "ngrey")}[state]
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
    """24x24 nine-slice (8px corners): the first-run hint, the chrome box with corners cut 2px, so
    it reads apart from the rounder quip bubble. Text in font-body, plum (9.42:1)."""
    return chrome(Grid(24, 24), 0, 0, 24, 24, 2)


def down_tail(tip):
    """8x6, a tail pointing down from a bubble's bottom rim to its tip column: cream in an ink
    line, the lip down its right side. Its top row lies over the rim's ink row, open there, so
    the cream meets the bubble's plum line."""
    rows = {4: ["########", ".######.", ".######.", "..####..", "..####..", "...##..."],
            5: ["########", ".#######", "..######", "...#####", "....###.", ".....#.."]}[tip]
    g = Grid(8, 6)
    return chrome_shape(g, lambda x, y: rows[y][x] == "#", lambda x, y: y < 0 and 1 <= x < 7, line=None)


def hint_tail():
    """8x6, centred under the hint bubble with its top row over the bubble's bottom rim; the tip
    is at columns 3 and 4."""
    return down_tail(4)


def title_glyphs():
    """font-title's glyphs: (mask, xoffset, yoffset, xadvance) by character."""
    return fonts.glyphs(*fonts.FONTS["font-title"][1:])[0]


def baked(im, text, x, y, col):
    """im with text baked in, in font-title and colour col, from column x, each glyph's yoffset below row y."""
    rgba = tuple(int(K[col][i:i + 2], 16) for i in (0, 2, 4)) + (255,)
    gl = title_glyphs()
    for ch in text:
        mask, ox, oy, adv = gl[ch]
        if mask is not None:
            im.paste(rgba, (x + ox, y + oy), mask)
        x += adv
    return im


def new_best():
    """72x20: the end screen's NEW BEST! ribbon, the words baked in white font-title."""
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
    im = to_image(g.outlined())
    text = "NEW BEST!"
    width = sum(title_glyphs()[ch][3] for ch in text)
    return baked(im, text, (72 - width) // 2, 4, "white")


def dog_slot():
    """32x32: a pack slot for sale, for the shop's slot rows on a tan box: a doghouse (a red roof shaded
    dred under its eaves, tan walls shaded brown on the right, a plum door under a cream bone plaque,
    a dbrown base) with a green plus badge at the top right. Every fill takes icon_edge's outline, so
    it holds 3:1 on cream and tan as the item-<gear> art does."""
    g = edged(Grid(32, 32), icon_edge)
    for y in range(5, 15):
        half = y - 5 + 3
        for x in range(16 - half, 16 + half):
            g.p(x, y, "dred" if y >= 13 else "pink" if x < 16 - half + 2 and y > 6 else "red")
    g.rect(14, 4, 4, 1, "red")
    g.rect(6, 15, 20, 13, "tan")
    g.rect(24, 15, 2, 13, "brown")
    g.rect(6, 15, 20, 1, "brown")
    g.rect(13, 17, 6, 2, "cream")
    g.rect(12, 20, 8, 8, "plum")
    g.p(12, 20, "tan")
    g.p(19, 20, "tan")
    g.rect(4, 28, 24, 2, "dbrown")
    # the plus badge, clear of the roof's outline
    g.rect(23, 2, 7, 7, "green")
    g.rect(24, 1, 5, 9, "green")
    g.rect(22, 3, 9, 5, "green")
    g.rect(28, 7, 2, 1, "forest")
    g.rect(29, 6, 1, 1, "forest")
    g.rect(26, 2, 1, 7, "white")
    g.rect(23, 5, 7, 1, "white")
    return g


# ---------- plates: the fired plate and the payout tag (hits.py draws the hit label with plate) ----------

def fired_plate(face, lit, shade):
    """ui-fired-plate's 24x24 nine-slice, 8px corners: a plate in face with a white stamp line 2px inside
    the face, its corners cut so it reads as a stamp's rounded border. The game stretches it to 116x28
    over the dog's card."""
    g = plate(face, lit, shade)
    g.rect(7, 6, 10, 1, "white")
    g.rect(7, 17, 10, 1, "white")
    g.rect(6, 7, 1, 10, "white")
    g.rect(17, 7, 1, 10, "white")
    return g


def payout_label():
    """ui-payout-label's 24x16 three-slice, 8px caps; columns 8 to 15 are uniform. A cream price
    tag in the chrome, its left cap a point stepping in 1px every 2 rows with a punched hole in a
    plum ring. Forest text holds 5.39:1 on the cream, caps in rows 3 to 12."""
    def inside(x, y):
        left = (int(abs(y - 7.5)) + 1) // 2
        right = 21 if y in (0, 15) else 22 if y in (1, 14) else 23
        return left <= x <= right

    g = chrome_shape(Grid(24, 16), inside)
    g.rect(4, 6, 4, 4, "plum")
    g.rect(5, 7, 2, 2, None)
    for x, y in ((4, 6), (7, 6), (4, 9), (7, 9)):
        g.p(x, y, "cream")
    return g


# ---------- the dogs' colours and the debuff bars ----------

# Each dog's colour, from its accessory, behind its photo on ui-dog-card (the empty card's is dslate). No two
# dogs share one, and none is a zone colour. Sequoia's is his collar's blue, not its sky, which backs every
# owner's photo; Archie's is rust, for his brown coat; Pepe's is his show bow's mauve, which holds his
# black coat's ink line at 3.83:1.
DOG_COLOURS = {
    "ginger": "pink", "reggie": "red", "buddy": "dred", "pepe": "mauve", "lady": "green", "archie": "rust",
    "sequoia": "blue", "penny": "amber", "kilo": "orange", "empty": "dslate",
}


def interior(solid, x, y, r):
    """True when every pixel within r of (x, y) is on the card."""
    return all(solid(x + dx, y + dy) for dx in range(-r, r + 1) for dy in range(-r, r + 1))


# Each debuff's bar under the walk bar: its face, the empty track, the track's fill and the name's
# colour. The name holds 4.5:1 or more on the face: ink on brown 4.66:1, white on mauve 4.70:1,
# ink on green 8.41:1, white on blue 8.48:1. Zoomies is green so its bar never sits blue on a blue sky;
# the spotlight's is a dark stage blue under its yellow beam, darker than every sky band.
DEBUFF_LOOKS = {
    "muddy": ("brown", "dbrown", "tan", "ink"), "stinky": ("mauve", "purple", "pink", "white"),
    "zoomies": ("green", "forest", "yellow", "ink"), "spotlight": ("blue", "navy", "yellow", "white"),
}
DEBUFF_BAR = (360, 16)
# The bar's track, in bar pixels: its ink frame, and the run the game fills inside it.
DEBUFF_TRACK = (68, 4, 288, 7)
DEBUFF_FILL = (69, 5, 286, 5)


def debuff_bar(debuff):
    """360x16, ui-debuff-bar: one active debuff, drawn full width under the walk bar. The face in the
    debuff's colour (rows 0 to 13), its shade along row 14 and an ink line on row 15 against the sky;
    the track's ink frame at x 68 to 355, rows 4 to 10, round an empty track in the shade (x 69 to
    354, rows 5 to 9). The game draws icon-<debuff> at (4, 0), the name at x 24 with its capitals
    on rows 5 to 9, and the fill across the track from x 69."""
    face, shade, _, _ = DEBUFF_LOOKS[debuff]
    w, h = DEBUFF_BAR
    g = Grid(w, h)
    g.rect(0, 0, w, h - 2, face)
    g.rect(0, h - 2, w, 1, shade)
    g.rect(0, h - 1, w, 1, "ink")
    x, y, tw_, th = DEBUFF_TRACK
    g.rect(x + 1, y, tw_ - 2, th, "ink")
    g.rect(x, y + 1, tw_, th - 2, "ink")
    fx, fy, fw, fh = DEBUFF_FILL
    g.rect(fx, fy, fw, fh, shade)
    return g


# ---------- wood ----------

def wood(g, top, h):
    """Plum wood across g from row top, h rows: h short dbrown grain lines at scattered rows and
    columns."""
    g.rect(0, top, g.w, h, "plum")
    for i in range(h):
        g.rect((i * 53) % (g.w - 8), top + 4 + (i * 11) % (h - 9), 4 + (i % 4) * 3, 1, "dbrown")


# ---------- selection and feedback ----------

def select_frame(glow):
    """24x24 nine-slice (8px corners): the frame around a selected tile or active control. An ink
    edge on both sides of a 2px amber band, so it stands out on any background (ink on tan or
    cream is 9:1 or more); the band pulses between amber and orange, apart from a selected item's yellow face."""
    g = Grid(24, 24)
    band = "orange" if glow else "amber"
    g.rect(1, 0, 22, 24, "ink")
    g.rect(0, 1, 24, 22, "ink")
    g.rect(1, 1, 22, 22, band)
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
    """16x16, 4 frames: sparks flying out from where a tap lands, each a 2px streak with an orange or rust
    head and a lighter tail, cooling to lone rust specks in the last frame, so the burst shows on the cream
    panels and the light roads as well as on the dark ones."""
    g = Grid(16, 16)
    r = (1, 3, 5, 7)[step]
    tail, head = (("yellow", "orange"), ("yellow", "orange"), ("amber", "rust"), (None, "rust"))[step]
    # the first frame is a plus on the tap's pixel: diagonals 1px out round unevenly
    dirs = ((0, -1), (0, 1), (-1, 0), (1, 0)) + (() if step == 0 else ((-0.7, -0.7), (0.7, -0.7), (-0.7, 0.7),
                                                                      (0.7, 0.7)))
    for dx, dy in dirs:
        if tail is not None:
            g.p(8 + dx * (r - 1), 8 + dy * (r - 1), tail)
        g.p(8 + dx * r, 8 + dy * r, head)
    return g


def dust(step):
    """16x16, 4 frames: a puff of dust when a dog joins the pack and hops onto the gate path, its last
    wisps light grey with no shade, so it thins out rather than flashing white."""
    g = Grid(16, 16)
    spread, size = (2, 3.5, 5, 6)[step], (2.2, 3, 2.8, 1.8)[step]
    for cx, lift in ((8 - spread, 0), (8, 1), (8 + spread, 0)):
        g.ell(cx, 12 - step - lift, size, size, "lgrey", None if step == 3 else "grey")
    return g


# ---------- start screen: afford outline, detail card, section frames ----------

# One coin stud, 7x7, lit from the top left: P plum rim, Y yellow, A amber, O orange.
COIN = ["..PPP..", ".PYYAP.", "PYYAAAP", "PYAAAOP", "PAAAOOP", ".PAOOP.", "..PPP.."]


def afford_frame(glint):
    """24x24 nine-slice (8px corners), drawn 2px outside the Pet shop building or a shop row the player can
    afford: a plum keyline outside a 1px amber line, with a gold coin stud on each corner. It
    differs from ui-select (ink, a 2px band pulsing amber to orange, ink, 1px out) by
    its thin line, its round studs and its deeper gold, and it does not pulse. Amber holds
    4.57:1 on the dark wood, the plum keyline 6.37:1 on the yard's grass and the studs' plum
    rims 6.49:1 on tan tiles. glint runs a flash along the line over two frames: 1 lights the
    top-left stud with rays heading right and down the line, 2 lights the top-right and
    bottom-left studs as the rays arrive, all inside the corner slices so the stretched edges
    stay plain."""
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
    # the coin's lit top-left, with the line's pixels either side of the stud
    shine = ((2, 2), (3, 1), (1, 3), (2, 1), (1, 2), (3, 2), (2, 3))
    studs, rays = {1: (((0, 0),), ((7, 1), (1, 7))), 2: (((17, 0), (0, 17)), ((16, 1), (1, 16)))}.get(glint, ((), ()))
    for ox, oy in studs:
        for x, y in shine:
            g.p(ox + x, oy + y, "white")
    for x, y in rays:
        g.p(x, y, "white")
    return g


def detail_card():
    """24x24 nine-slice (8px corners): the hold-to-open detail card, the chrome box with corners
    cut 2px; the paper starts 2px in."""
    return chrome(Grid(24, 24), 0, 0, 24, 24, 2)


def scroll_track():
    """8x24 three-slice (3px caps; the middle rows tile): the shop list's scrollbar track, a navy
    groove in a 1px ink edge with its corners cut, as tall as the list. Navy holds 9.59:1 on the
    card's cream and the ink edge 12.44:1."""
    g = Grid(8, 24)
    g.rect(1, 0, 6, 24, "ink")
    g.rect(0, 1, 8, 22, "ink")
    g.rect(1, 1, 6, 22, "navy")
    return g


def scroll_thumb():
    """6x24 three-slice (3px caps; the middle rows tile): the scrollbar's thumb, drawn 1px inside
    ui-scroll-track so it fills the groove's width. The gold accent of a picked tab, yellow with
    amber on its right column and bottom row and its corners cut: yellow holds 11.13:1 on the
    track's navy and 14.43:1 on its ink edge."""
    g = Grid(6, 24)
    g.rect(1, 0, 4, 24, "yellow")
    g.rect(0, 1, 6, 22, "yellow")
    g.rect(5, 1, 1, 22, "amber")
    g.rect(1, 23, 4, 1, "amber")
    g.p(1, 1, "white")
    return g


def detail_well():
    """68x68: the recessed window on the detail card for a 64x64 portrait (portrait-dog-<name>,
    an owner face or a 32x32 gear icon at 2x), drawn at 2,2. The chrome's ink and plum lines
    around sky, which every portrait reads on, with a blue shadow line under the top and left
    edges where the recess is in shadow."""
    g = Grid(68, 68)
    g.rect(1, 0, 66, 68, "ink")
    g.rect(0, 1, 68, 66, "ink")
    g.rect(1, 1, 66, 66, "plum")
    g.rect(2, 2, 64, 64, "sky")
    g.rect(2, 2, 64, 1, "blue")
    g.rect(2, 2, 1, 64, "blue")
    return g


SECTION_W, SECTION_H = 24, 32
SECTION_BAND = 21  # band rows, its bottom line included, under the 3px frame


def section(state):
    """24x32 nine-slice (3px left, right and bottom, 24px top): one start screen section (walker,
    dogs, Pocket) framed as a unit, its heading band across the top over transparent space for the
    tiles. A 1px ink edge, then a 2px border: ink for neutral (nothing in the section chosen yet), so
    dividers between sections read dark; amber for complete (something chosen). The band fills rows
    3 to 23 between the side borders: navy over an ink line, or amber over an orange line when
    complete. The game writes, in font-title x2 with caps in rows 8 to 17: the heading 9px from the
    left, cream on navy (9.59:1) or ink on amber (9.71:1), and when complete the choice right-aligned
    9px from the right in ink."""
    lit = state == "complete"
    g = Grid(SECTION_W, SECTION_H)
    g.rect(0, 0, SECTION_W, SECTION_H, "ink")
    g.rect(3, 3, SECTION_W - 6, SECTION_H - 6, None)
    if lit:
        g.rect(1, 1, SECTION_W - 2, 2, "amber")
        g.rect(1, SECTION_H - 3, SECTION_W - 2, 2, "amber")
        g.rect(1, 1, 2, SECTION_H - 2, "amber")
        g.rect(SECTION_W - 3, 1, 2, SECTION_H - 2, "amber")
    g.rect(3, 3, SECTION_W - 6, SECTION_BAND - 1, "amber" if lit else "navy")
    g.rect(3, 2 + SECTION_BAND, SECTION_W - 6, 1, "orange" if lit else "ink")
    return g


# The side of the seamless fabric tiles, ui-denim and ui-plaid.
FABRIC = 16
STITCH_DASH, STITCH_GAP = 5, 3


def denim():
    """16x16 seamless tile: the Pocket section's jeans-pocket fill, repeated (TileSprite) over the
    section's tile area. Blue twill: dslate diagonals rising to the right every 4px, with no flecks
    between them. Blue holds apart from the band's navy and the dogs section's plaid, and the tiles'
    ink edges hold on it."""
    g = Grid(FABRIC, FABRIC)
    g.rect(0, 0, FABRIC, FABRIC, "blue")
    for y in range(FABRIC):
        for x in range(FABRIC):
            if (x + y) % 4 == 0:
                g.p(x, y, "dslate")
    return g


# The cork's tile side: twice the denim's, so its scattered granules repeat too far apart to show a grid.
CORK = 32


def cork():
    """32x32 seamless tile: the walker section's corkboard, repeated (TileSprite) over its tile area,
    where the walkers' cards are pinned. Brown with sparse 2x2 ochre and clay granules, close to it in
    value so the fill stays quiet; the cream tiles' ink edges hold on it, and it holds apart from the
    Pocket's blue and the dogs' plaid."""
    g = Grid(CORK, CORK)
    g.rect(0, 0, CORK, CORK, "brown")
    for x, y, c in CORK_GRAINS:
        g.p(x, y, c)
    return g


def cork_grains(seed=11, gap=7, tries=8000):
    """The cork's granules: blue noise on the CORK x CORK torus (no two closer than gap, measured across the
    tile's wrap too), so the repeated tile scatters evenly with no lattice. Each is a 2x2 block of ochre or
    clay, so no grain turns to a lone fleck."""
    import random

    r, seeds = random.Random(seed), []
    for _ in range(tries):
        x, y = r.randrange(CORK), r.randrange(CORK)
        if all(min(abs(x - a), CORK - abs(x - a)) ** 2 + min(abs(y - b), CORK - abs(y - b)) ** 2 >= gap * gap
               for a, b in seeds):
            seeds.append((x, y))
    pts = []
    for x, y in seeds:
        c = "clay" if r.random() < 0.5 else "ochre"
        pts += [((x + dx) % CORK, (y + dy) % CORK, c) for dx in (0, 1) for dy in (0, 1)]
    return pts


CORK_GRAINS = cork_grains()


def plaid():
    """16x16 seamless tile: the dogs section's dog-blanket tartan, repeated (TileSprite) over its tile
    area. A dred ground crossed each way by a 2px plum band and, halfway between, a 1px plum thread, so a
    plum line runs about every 8px: quiet enough that the dog tiles stay the loudest thing on it."""
    g = Grid(FABRIC, FABRIC)
    for y in range(FABRIC):
        for x in range(FABRIC):
            band = x < 2 or y < 2
            thread = x == 9 or y == 9
            g.p(x, y, "plum" if band or thread else "dred")
    return g


def stitch(horizontal):
    """A seamless run of the Pocket's stitch line, repeated (TileSprite) along it: tan dashes
    STITCH_DASH long with STITCH_GAP gaps, each on a 1px navy shadow below (ui-stitch-h, 8x2) or to
    the right (ui-stitch-v, 2x8). Tiled from the line's start, the first dash sits at its start."""
    n = STITCH_DASH + STITCH_GAP
    g = Grid(n, 2) if horizontal else Grid(2, n)
    for i in range(STITCH_DASH):
        if horizontal:
            g.p(i, 0, "tan")
            g.p(i, 1, "navy")
        else:
            g.p(0, i, "tan")
            g.p(1, i, "navy")
    return g


# ---------- walk screen and card rows: the strip well, zone progress, quips, zone banner ----------

def well(g, x, y, w, h):
    """A recessed ink slot in the wood: clipped corners and a dark brown lip below and to the right."""
    g.rect(x + 1, y, w - 2, h, "ink")
    g.rect(x, y + 1, w, h - 2, "ink")
    g.rect(x + 1, y + h - 1, w - 2, 1, "dbrown")
    g.rect(x + w - 1, y + 1, 1, h - 2, "dbrown")


def strip_well():
    """24x24 nine-slice (8px corners): the band behind a card row's subtitle, plum wood in a 1px ink
    outline with rounded corners round an ink well, its rim 3 rows deep at top and bottom and 3 columns at
    the sides. Each corner steps 2 columns in over a row. Stretch it to the subtitle's width."""
    g = Grid(24, 24)
    g.rect(0, 2, 24, 20, "plum")
    for y in (1, 22):
        g.rect(2, y, 20, 1, "plum")
        g.rect(0, y, 2, 1, "ink")
        g.rect(22, y, 2, 1, "ink")
    g.rect(2, 0, 20, 1, "ink")
    g.rect(2, 23, 20, 1, "ink")
    g.rect(0, 2, 1, 20, "ink")
    g.rect(23, 2, 1, 20, "ink")
    well(g, 3, 4, 18, 16)
    return g


# ---------- the walk HUD: the 40-row walk bar, the debuff bars and the dog cards ----------

WALK_BAR = (360, 40)
# Every top bar (the start screen's, the walk bar, Help's) is 40 rows of flat plum with this trim: a
# dbrown line on row 1, and the bottom rows brown, dbrown and ink, so the bar ends on a lit edge over
# the scene.
TOP_BAR_LINE = 1
TOP_BAR_EDGE = ("brown", "dbrown", "ink")
# The walk bar's cash well, in screen pixels: the start screen's bank well at its narrowest, 3 rows
# clear of the trim above and below.
WALK_CASH_WELL = (5, 5, 70, 29)
# The effect wells the game draws on the bar: six 22x22 wells (the perk, Pocket, found item and three
# upgrades), 2 columns apart, set evenly between the cash well and Help's face at x 231, on rows 8 to
# 29, centred on the buttons' faces (rows 9 to 28). The buttons' hits, 34 wide, fill x 224 to 359 at
# a 34 pitch, each face centred in its hit (faces at 231 + 34i).
EFFECT_WELL = 22


def walk_bar():
    """360x40, ui-walk-bar: flat plum with the top bars' trim (dbrown on row 1; brown, dbrown and ink
    on rows 37 to 39) and the ink cash well at 5,5 70x29, sized for "$888" at 3x with no coin.
    The game draws the effect wells, the Help, Sound, Settings and Pause buttons and every text and
    icon on it."""
    w, h = WALK_BAR
    g = Grid(w, h)
    g.rect(0, 0, w, h, "plum")
    g.rect(0, TOP_BAR_LINE, w, 1, "dbrown")
    for i, c in enumerate(TOP_BAR_EDGE):
        g.rect(0, h - len(TOP_BAR_EDGE) + i, w, 1, c)
    well(g, *WALK_CASH_WELL)
    return g


# The start screen top bar's bank well, in screen pixels at its narrowest: the walk bar's cash well.
HOME_CASH_WELL = WALK_CASH_WELL


# The start screen top bar's bank well in three pieces, left to right, each one column of a well with the walk bar's
# clipped corners and dbrown lip: its first, any middle one and its last. The game stretches it to the bank's width
# and centres the bank in it. Every middle column is the same, so the middle repeats with no seam.
HOME_CASH_WELL_PIECES = ("left", "mid", "right")


def home_cash_well_piece(piece):
    """1x29, ui-home-cash-well-<piece>: one column of the bank well, so the game can draw the well as
    wide as the bank needs. left: the ink side, its top and bottom pixels clipped for the
    corners. mid: ink over the dbrown lip's row, repeated (TileSprite) between the caps. right: the
    dbrown lip's side, clipped top and bottom. left + mid x (w - 2) + right is the well w wide."""
    _, _, _, h = HOME_CASH_WELL
    n = len(HOME_CASH_WELL_PIECES)
    whole = Grid(n, h)
    well(whole, 0, 0, n, h)
    x = HOME_CASH_WELL_PIECES.index(piece)
    g = Grid(1, h)
    for y in range(h):
        g.px[y][0] = whole.px[y][x]
    return g


def effect_well():
    """22x22, ui-effect-well: an ink well for one active effect's 20x20 icon at (1, 1), with the
    walk bar's wells' clipped corners and dbrown lip."""
    g = Grid(EFFECT_WELL, EFFECT_WELL)
    well(g, 0, 0, EFFECT_WELL, EFFECT_WELL)
    return g


# The neighbourhood pill on the walk: 13 rows, its ends 4 columns each with two corner steps, so
# the game stretches it as a three-slice to the label's width.
PILL = (13, 13)


def zone_pill():
    """13x13 three-slice (4px ends), ui-zone-pill: the walk's neighbourhood label, centred just under
    the walk bar, where the message strip may cover it. A navy face with a lighter top row in a 1px ink line, its corners
    stepped two pixels, so it reads on every backdrop. The game sets the name in cream and "n of N"
    in lgrey, font-body at 1x, their capitals on row 4, 6 columns in from each end."""
    w, h = PILL
    g = Grid(w, h)
    g.rect(2, 0, w - 4, h, "ink")
    g.rect(1, 1, w - 2, h - 2, "ink")
    g.rect(0, 2, w, h - 4, "ink")
    g.rect(2, 1, w - 4, h - 2, "navy")
    g.rect(1, 2, w - 2, h - 4, "navy")
    g.rect(2, 1, w - 4, 1, "dslate")
    return g


# The dog card: 120x70 in its slot, the chrome on x 1 to 118 and rows 0 to 69, so a 1px gap runs
# down each side and the card's foot sits on the band's last row, over the neighbourhood progress
# line. The cards are navy, as a neutral ui-section, so the eye stays on the road and the dogs'
# photos and hearts carry the row.
DOG_CARD = (120, 70)
DOG_CARD_FRAME = (1, 0, 118, 70)
# The header's rows (2 to 15) and the ink rule under it.
DOG_CARD_RULE = 16
# The photo in the body (the navy on x 3 to 115 and rows 17 to 66): 3 columns of navy to its left, as
# the owner's column keeps to its right, 6 rows above it and 8 below.
DOG_PHOTO = (6, 23)
# The owner's photo, x, y and side: 3 columns right of the dog's and level with its top, an ink frame
# round a white mat round sky, as ui-owner-tab frames the owner, for the 20x20 face-owner-<dog>-20.
DOG_CARD_OWNER = (45, 23, 24)
# The hearts area the heart-loss flash fills, as x, y, w, h: one row of six hearts from (45,52), its
# foot level with the dog's photo, with a pixel round them. The only part of the card it touches, so
# the warn rim stays the card's only border.
DOG_CARD_HEARTS = (44, 51, 55, 9)
# The empty card's FIRED plate, x, y, w and h: a band across the empty photo, centred on it, the
# plate's sides on the photo's frame.
DOG_CARD_FIRED = (6, 32, 36, 17)
# Each heart-loss frame: the flash's colour and how many of the area's pixels it fills (1 every
# pixel, 2 a checkerboard, 4 one in four), so it bursts white and dithers away. White keeps the
# hearts drawn over it readable (red 4.19:1, the grey outlines 2.82:1), where a red or pink flash
# would swallow the red hearts (1.0:1 and 1.55:1).
DOG_CARD_HEART_LOSS = (("white", 1), ("white", 1), ("white", 2), ("white", 4))


def dog_card(dog):
    """120x70, ui-dog-card: one of three cards in the walk's card row, in the neutral section look: a
    2px ink frame (the chrome with an ink inner line and an ink lip) round a navy face, the header
    (rows 2 to 15) split from the body by an ink rule on row 16. The game writes the name on the
    header in cream (9.59:1), with no plate. The dog's photo is an ink frame (6,23 36x36) round a
    cream mat round its colour (8,25 32x32), in the body's middle. The owner's photo is an ink frame
    (45,23 24x24) round a white mat round sky (47,25 20x20) for the owner's small face; the game writes
    the owner's name (tan, 6.61:1) beside it and the hearts (ui-heart full-dark and empty-dark) under
    it, and pins the LEAD tag across the foot of the dog's photo. The empty card (a fired dog's) is
    dslate in the same frame, with a dslate photo crossed by a dred plate built as ui-fired-plate
    (6,32 36x17, its face 10,36 28x9) for FIRED, and the owner's photo."""
    empty = dog == "empty"
    face = "dslate" if empty else "navy"
    w, h = DOG_CARD
    g = Grid(w, h)
    chrome(g, *DOG_CARD_FRAME, r=1, face=face, lip="ink", line="ink")
    g.rect(3, DOG_CARD_RULE, 114, 1, "ink")
    x, y = DOG_PHOTO
    g.rect(x, y, 36, 36, "ink")
    g.rect(x + 1, y + 1, 34, 34, "cream")
    g.rect(x + 2, y + 2, 32, 32, DOG_COLOURS[dog])
    ox, oy, side = DOG_CARD_OWNER
    g.rect(ox, oy, side, side, "ink")
    g.rect(ox + 1, oy + 1, side - 2, side - 2, "white")
    g.rect(ox + 2, oy + 2, side - 4, side - 4, "sky")
    if empty:
        fx, fy, fw, fh = DOG_CARD_FIRED
        fired = plate("dred", "red", "plum", fw, fh)
        for yy, row in enumerate(fired.px):
            for xx, c in enumerate(row):
                if c:
                    g.px[fy + yy][fx + xx] = c
    return g


def dog_card_solid():
    card = dog_card("empty").px
    w, h = DOG_CARD

    def solid(x, y):
        return 0 <= x < w and 0 <= y < h and card[y][x] is not None
    return solid


def dog_card_warn(step):
    """120x70, ui-dog-card-warn: a 2px rim inside the card's outline, for an owner at one heart;
    steps 0 to 2 run dim to bright. The outer pixel holds 7.35:1 on the wood and 7.49:1 on navy."""
    outer, inner = (("orange", "red"), ("amber", "red"), ("amber", "orange"))[step]
    solid = dog_card_solid()
    w, h = DOG_CARD
    g = Grid(w, h)
    for y in range(h):
        for x in range(w):
            if not solid(x, y):
                continue
            if not interior(solid, x, y, 1):
                g.p(x, y, outer)
            elif not interior(solid, x, y, 2):
                g.p(x, y, inner)
    return g


def dog_card_heart_loss(step):
    """120x70, ui-dog-card's heart-loss frames, an overlay over the card and under the game's face,
    hearts and text that fills only the hearts area (44,51 55x9, its corners cut 1px), never the
    card's edge or header: frames 0 and 1 white (13.89:1 on navy), then white on a checkerboard and
    on one pixel in four, so the flash clears."""
    colour, every = DOG_CARD_HEART_LOSS[step]
    x0, y0, w, h = DOG_CARD_HEARTS
    inside = rounded_inside(x0, y0, w, h, 1)
    g = Grid(*DOG_CARD)
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if not inside(x, y):
                continue
            if every == 1 or (every == 2 and (x + y) % 2 == 0) or (every == 4 and x % 2 == 0 and y % 2 == 0):
                g.p(x, y, colour)
    return g


CARD_BAND = (360, 76)
# The band's top rows, where the road ends: a dithered ink shadow cast onto the road (rows 0 and
# 1, a quarter then three quarters of their pixels), then the trim: ink, a lit tan line and ink
# (rows 2 to 4), then the wood.
CARD_BAND_TRIM = ("ink", "tan", "ink")


def dog_card_band():
    """360x76, ui-dog-card-band: drawn at (0, 480) under the cards. Rows 0 and 1 (screen 480 and 481)
    are a dithered ink shadow over the road's last rows, clear between its pixels; rows 2 to 4
    (482 to 484) the trim, ink, tan and ink, so the road ends on a lit edge; then plum wood, which
    shows on row 5 (485) above the cards and between them."""
    w, h = CARD_BAND
    g = Grid(w, h)
    wood(g, 2, h - 2)
    for x in range(w):
        if x % 4 == 0:
            g.p(x, 0, "ink")
        if x % 4 != 2:
            g.p(x, 1, "ink")
    for i, c in enumerate(CARD_BAND_TRIM):
        g.rect(0, 2 + i, w, 1, c)
    return g


def lead_tag():
    """27x11, ui-lead-tag: the front dog's tag, LEAD in font-title, ink on a yellow face (14.43:1)
    with an amber foot, in an ink line with its corners cut 1px."""
    w, h = 27, 11
    g = Grid(w, h)
    g.rect(1, 0, w - 2, h, "ink")
    g.rect(0, 1, w, h - 2, "ink")
    g.rect(1, 1, w - 2, h - 2, "yellow")
    g.rect(1, h - 2, w - 2, 1, "amber")
    return baked(to_image(g.px), "LEAD", 3, -1, "ink")


def owner_tab():
    """36x36, ui-owner-tab: the owner's photo that pops in on a dog card's top-right corner: an ink
    frame round a white mat round sky (2,2 32x32) for the owner's 32x32 face, with plum mounts on
    its bottom corners where it meets the card."""
    g = Grid(36, 36)
    g.rect(0, 0, 36, 36, "ink")
    g.rect(1, 1, 34, 34, "white")
    g.rect(2, 2, 32, 32, "sky")
    g.rect(0, 35, 3, 1, "plum")
    g.rect(33, 35, 3, 1, "plum")
    return g


# Each zone's colour on its pip: its road colour, which the zone's road shadow (one ramp step
# down) dims.
ZONE_COLOURS = {
    "cabbagetown": "grey", "high-park": "tan", "distillery-district": "dslate", "kensington-market": "stone",
    "the-beaches": "cream", "yonge-street": "shale",
}
def pip_rim(well):
    """A zone pip's rim: its well's colour stepped down its ramp, at least one step, until it holds 3:1 on
    the end screen's cream panel, so every pip shows its edge there, the cream Beaches pip too."""
    c = DARKER[K.get(well, well)]
    while contrast(c, "cream") < 3:
        c = DARKER[c]
    return c


def zone_pip(zone=None, done=False):
    """18x8, one per zone of the route on the end screen, 3px apart. todo (no zone) is a dashed dbrown
    rim around the bare well: not yet chosen. <zone> is chosen: a 16x6 well at 1,1 in the zone's road
    shadow. <zone>-done is the well in the zone's full colour with a tick (white, or plum where white falls
    under 3:1), so progress never relies on colour alone. A chosen or done pip's rim is pip_rim of its
    well."""
    g = Grid(18, 8)
    if zone is None:
        for x in range(1, 17, 3):
            g.rect(x, 0, 2, 1, "dbrown")
            g.rect(x, 7, 2, 1, "dbrown")
        g.rect(0, 2, 1, 4, "dbrown")
        g.rect(17, 2, 1, 4, "dbrown")
        g.rect(1, 1, 16, 6, "ink")
        return g
    fill = ZONE_COLOURS[zone]
    well = K[fill] if done else DARKER[K[fill]]
    g.rect(1, 0, 16, 8, pip_rim(well))
    g.rect(0, 1, 18, 6, pip_rim(well))
    g.rect(1, 1, 16, 6, well)
    if done:
        tick = "white" if contrast(fill, "white") >= 3 else "plum"
        for x, y in ((6, 4), (7, 5), (8, 4), (9, 3), (10, 2), (11, 1)):
            g.p(x, y, tick)
        g.p(7, 6, DARKER[K[fill]])
    return g


def quip_tail_down():
    """8x6, ui-quip-tail turned to point down from a bubble above the owner's tab. Place its top row
    over the bubble's bottom rim so the cream runs through; the tip is at column 5, row 5."""
    return down_tail(5)


def quip_tail_up():
    """8x6, ui-quip-tail-down turned to point up from a bubble's top rim at the speaker above it. Place
    its bottom row over the bubble's top rim so the cream runs through; the tip is at column 3, row 0."""
    rows = ["...#....", "..###...", "..####..", ".######.", ".######.", "########"]
    return chrome_shape(Grid(8, 6), lambda x, y: rows[y][x] == "#", lambda x, y: y > 5 and 1 <= x < 7, line=None)


CELEBRATE_BURST = (148, 132)


def celebrate_burst():
    """148x132: the starburst behind the cheering walker in the zone celebration, a round
    burst: a yellow body (an ellipse with 62x54 half axes) ringed by 18 amber spikes 10px long, in a
    1px ink outline, with a white glint along the body's upper left. No text goes on it."""
    import math

    w, h = CELEBRATE_BURST
    points, spike = 18, 10
    cx, cy, rx, ry = w / 2, h / 2, w / 2 - 12, h / 2 - 12
    g = Grid(w, h)
    for y in range(h):
        for x in range(w):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            r = math.hypot(dx, dy)
            if r <= 1:
                g.p(x, y, "yellow")
                continue
            t = (math.atan2(dy, dx) / (2 * math.pi) * points + 0.5) % 1
            if (r - 1) * min(rx, ry) <= spike * (1 - abs(2 * t - 1)):
                g.p(x, y, "amber")
    shape = [row[:] for row in g.px]
    for y in range(h):
        for x in range(w):
            if not shape[y][x] and any(0 <= x + dx < w and 0 <= y + dy < h and shape[y + dy][x + dx]
                                       for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0))):
                g.p(x, y, "ink")
    for y in range(h):
        for x in range(w):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if 0.86 <= math.hypot(dx, dy) <= 0.92 and dx + dy < -0.6 and g.px[y][x] == K["yellow"]:
                g.p(x, y, "white")
    return g


def quip():
    """24x24 nine-slice (8px corners): the owner's speech bubble, the chrome box with corners cut
    3px, rounder than the hint. Text in font-body, plum (9.42:1)."""
    return chrome(Grid(24, 24), 0, 0, 24, 24, 3)


def quip_tail():
    """6x8, pointing left at the speaker (flipped for a bubble on its left): cream in
    an ink line. Place its
    right column over the bubble's left rim so the cream meets the bubble's plum line."""
    rows = ["....##", "...###", "..####", ".#####", "######", ".#####", "...###", ".....#"]
    g = Grid(6, 8)
    return chrome_shape(g, lambda x, y: rows[y][x] == "#", lambda x, y: x > 5 and 1 <= y < 7, line=None)


def zone_banner():
    """248x48: a cream board in the chrome on navy ribbon ends, shown over the road between
    zones. The game writes two lines in font-title, plum, centred on x=124: the world and zone
    number ("TORONTO, NEIGHBOURHOOD 2") with its caps in rows 11 to 15, and the zone name at x2
    ("KENSINGTON MARKET", up to 192px wide) with its caps in rows 27 to 36, under the dotted divider."""
    g = Grid(248, 48)
    ribbon = Grid(248, 48)
    for x0 in (0, 220):
        ribbon.rect(x0, 12, 28, 30, "ink")
        ribbon.rect(x0 + 1, 13, 26, 28, "navy")
        ribbon.rect(x0 + 1, 13, 26, 1, "dslate")
        ribbon.rect(x0 + 1, 40, 26, 1, "ink")
    ribbon.tri((0, 12), (0, 42), (10, 27), None)
    ribbon.tri((248, 12), (248, 42), (238, 27), None)
    for y in range(48):
        for x in range(248):
            c = ribbon.px[y][x]
            if c and any(not (0 <= x + dx < 248) or not ribbon.px[y][x + dx] for dx in (-1, 1)):
                c = K["ink"]
            g.px[y][x] = c
    chrome(g, 12, 0, 224, 48, 3)
    for x in range(28, 220, 3):
        g.p(x, 21, "tan")
    return g


# ui-touch-drag: the help screen's swipe, a white glove dragging one lane-width (64px) on a 104x40
# frame. The fingertip's contact row is TOUCH_Y; a swipe right runs from column TOUCH_FROM to TOUCH_TO
# and a swipe left back again, so the anchor (TOUCH_FROM, TOUCH_Y) stands on lane 1's centre.
TOUCH_SIZE, TOUCH_Y, TOUCH_FROM, TOUCH_TO = (104, 40), 6, 20, 84
# The glove, a right hand from the back pointing up, outlined in ink: the fingertip's contact pixel is
# column TOUCH_TIP of row 0. W white, L lgrey shade, G grey creases and the line above the cuff, C and D
# the cuff and its shade.
TOUCH_GLOVE = [
    ".....WW.........",
    "....WWWW........",
    "....WWWL........",
    "....WWWL........",
    "....WWWL........",
    "....WWWL........",
    "....WWWLWWW.....",
    "....WWWLWWWLWW..",
    "....WWWGWWWGWWW.",
    "....WWWGWWWGWWWL",
    ".WW.WWWGWWWGWWWL",
    "WWWLWWWWWWWWWWWL",
    "WWWWLWWWWWWWWWWL",
    ".WWWWWWWWWWWWWWL",
    "..WWWWWWWWWWWWWL",
    "...WWWWWWWWWWWL.",
    "....WWWWWWWWWWL.",
    "....WWWWWWWWWLL.",
    "....LLLLLLLLLLL.",
    "....GGGGGGGGGGG.",
    "....CCCCCCCCCCD.",
    "....CCCCCCCCCCD.",
    "....CCCCCCCCCCD.",
]
TOUCH_TIP = 5
TOUCH_GLOVE_COLS = {"W": "white", "L": "lgrey", "G": "grey", "C": "white", "D": "lgrey"}
# The drag's offsets from its start, eased in and out over 7 frames; the glove off the glass stands
# TOUCH_HOVER down and right of the contact.
TOUCH_OFFSETS = (4, 12, 24, 38, 51, 60, 64)
TOUCH_HOVER = (2, 3)
# Per-frame ms of one swipe: hover, press (2), drag (7), hold (2), lift (2) and the empty pause.
TOUCH_MS = [300, 80, 100] + [70] * 7 + [80, 80, 90, 90, 350]
# The still for reduced motion: the swipe right's fifth drag frame, its whole trail kept.
TOUCH_STILL = 4


def touch_layer(draw):
    """One layer of a touch frame, outlined in ink on its own, so a later layer's line sits over an earlier
    layer's fill (the glove's line over the trail and the ring)."""
    g = Grid(*TOUCH_SIZE)
    draw(g)
    g.edge = lambda c: K["ink"]
    return g.outlined()


def touch_ring(x, r, col):
    """The press ring (yellow) or the lift ring (lgrey) round the contact at column x, under the glove."""
    def draw(g):
        g.ell(x + 0.5, TOUCH_Y + 0.5, r, r, col)
        g.ell(x + 0.5, TOUCH_Y + 0.5, r - 1.25, r - 1.25, None)
    return touch_layer(draw)


def touch_glove(x, dx=0, dy=0):
    cols = {k: K[v] for k, v in TOUCH_GLOVE_COLS.items()}
    return touch_layer(lambda g: bitmap(g, x - TOUCH_TIP + dx, TOUCH_Y + dy, TOUCH_GLOVE, cols))


def touch_trail(head, start, fade=0, whole=False):
    """The dots the fingertip leaves from start to head: 2x2 every 4px in an ink rim, white within 20px of
    the finger, then lgrey, then grey, none past 48px. fade draws the tail in 12px per frame once the finger
    stops. whole keeps every dot back to the start, white then lgrey, for a still that shows the whole
    path (grey dots vanish on Cabbagetown's grey road)."""
    way = 1 if head >= start else -1

    def draw(g):
        x = start
        while (head - x) * way > 5:
            back = (head - x) * way + 12 * fade
            if whole or back <= 48:
                g.rect(x if way > 0 else x - 1, TOUCH_Y - 1, 2, 2,
                       "white" if back < 20 else "lgrey" if whole or back < 36 else "grey")
            x += 4 * way
    return touch_layer(draw)


def touch_frame(*layers):
    out = [[None] * TOUCH_SIZE[0] for _ in range(TOUCH_SIZE[1])]
    for rows in layers:
        for y, row in enumerate(rows):
            for x, c in enumerate(row):
                if c:
                    out[y][x] = c
    return out


def touch_swipe(start, way):
    """One swipe from column start, way 1 (right) or -1 (left), as TOUCH_MS times it: the glove hovers off
    the glass, presses (the yellow ring grows), drags with the ring round the fingertip and the dots behind,
    holds while the dots draw in, lifts (the lgrey ring grows as the glove leaves) and is gone."""
    end = start + 64 * way
    frames = [touch_frame(touch_glove(start, *TOUCH_HOVER)),
              touch_frame(touch_ring(start, 3.5, "yellow"), touch_glove(start)),
              touch_frame(touch_ring(start, 5.5, "yellow"), touch_glove(start))]
    for o in TOUCH_OFFSETS:
        x = start + o * way
        frames.append(touch_frame(touch_trail(x, start), touch_ring(x, 3.5, "yellow"), touch_glove(x)))
    for fade in (1, 2):
        frames.append(touch_frame(touch_trail(end, start, fade), touch_ring(end, 3.5, "yellow"), touch_glove(end)))
    frames.append(touch_frame(touch_ring(end, 4, "lgrey"), touch_glove(end, *TOUCH_HOVER)))
    frames.append(touch_frame(touch_ring(end, 5.5, "lgrey"), touch_glove(end, TOUCH_HOVER[0] + 1, TOUCH_HOVER[1] + 2)))
    frames.append(touch_frame())
    return frames


def touch_still():
    """The reduced-motion still: the swipe right's drag frame TOUCH_STILL, its whole trail kept."""
    x = TOUCH_FROM + TOUCH_OFFSETS[TOUCH_STILL]
    return touch_frame(touch_trail(x, TOUCH_FROM, whole=True), touch_ring(x, 3.5, "yellow"), touch_glove(x))


def touch_tags():
    right, left = touch_swipe(TOUCH_FROM, 1), touch_swipe(TOUCH_TO, -1)
    return [("right", right, TOUCH_MS), ("left", left, TOUCH_MS), ("still", [touch_still()], 1000)]


IMAGES = {
    "icon-pause": lambda: to_image(pause().outlined(False)),
    "icon-play": lambda: to_image(play().outlined(False)),
    "icon-home": lambda: to_image(home_icon().outlined(False)),
    "icon-help": lambda: to_image(help_icon().outlined(False)),
    "icon-close": lambda: to_image(close().outlined(False)),
    "icon-logbook": lambda: to_image(logbook_icon().outlined(False)),
    "icon-settings": lambda: to_image(settings_icon().outlined(False)),
    "icon-exit": lambda: to_image(exit_icon().outlined(False)),
    "icon-share": lambda: to_image(share_icon().outlined(False)),
    "icon-browser-menu": lambda: to_image(browser_menu_icon().outlined(False)),
    "icon-update": lambda: to_image(update_icon().outlined()),
    "icon-lock": lambda: to_image(lock().outlined()),
    "icon-bill": lambda: to_image(bill().outlined()),
    "icon-treat": lambda: to_image(treat_icon().outlined()),
    "icon-stinky": lambda: to_image(stinky()),
    "icon-dog-slot": lambda: to_image(dog_slot().outlined()),
    "ui-panel": lambda: to_image(panel().outlined(False)),
    "ui-hint": lambda: to_image(hint().outlined(False)),
    "ui-hint-tail": lambda: to_image(hint_tail().outlined(False)),
    "ui-new-best": new_best,
    "ui-strip-well": lambda: to_image(strip_well().outlined(False)),
    "ui-quip": lambda: to_image(quip().outlined(False)),
    "ui-quip-tail": lambda: to_image(quip_tail().outlined(False)),
    "ui-quip-tail-down": lambda: to_image(quip_tail_down().outlined(False)),
    "ui-quip-tail-up": lambda: to_image(quip_tail_up().outlined(False)),
    "ui-celebrate-burst": lambda: to_image(celebrate_burst().outlined(False)),
    "ui-zone-banner": lambda: to_image(zone_banner().outlined(False)),
    "ui-walk-bar": lambda: to_image(walk_bar().outlined(False)),
    "ui-effect-well": lambda: to_image(effect_well().outlined(False)),
    "ui-zone-pill": lambda: to_image(zone_pill().outlined(False)),
    **{f"ui-home-cash-well-{p}": (lambda p=p: to_image(home_cash_well_piece(p).outlined(False)))
       for p in HOME_CASH_WELL_PIECES},
    "ui-dog-card-band": lambda: to_image(dog_card_band().outlined(False)),
    "ui-lead-tag": lead_tag,
    "ui-owner-tab": lambda: to_image(owner_tab().outlined(False)),
    "ui-detail-card": lambda: to_image(detail_card().outlined(False)),
    "ui-detail-well": lambda: to_image(detail_well().outlined(False)),
    "ui-scroll-thumb": lambda: to_image(scroll_thumb().outlined(False)),
    "ui-scroll-track": lambda: to_image(scroll_track().outlined(False)),
    "ui-cork": lambda: to_image(cork().outlined(False)),
    "ui-denim": lambda: to_image(denim().outlined(False)),
    "ui-plaid": lambda: to_image(plaid().outlined(False)),
    "ui-stitch-h": lambda: to_image(stitch(True).outlined(False)),
    "ui-stitch-v": lambda: to_image(stitch(False).outlined(False)),
}


def sprites():
    yield "ui-dog-card", [(dog, [dog_card(dog).outlined(False)], 1000) for dog in DOG_COLOURS] + [
        ("heart-loss", [dog_card_heart_loss(i).outlined(False) for i in range(4)], [60, 60, 80, 80])]
    card_warn = [dog_card_warn(i).outlined(False) for i in (0, 1, 2, 1)]
    yield "ui-dog-card-warn", [("pulse", card_warn, 400), ("static", [card_warn[1]], 1000)]
    yield "ui-debuff-bar", [(d, [debuff_bar(d).outlined(False)], 1000) for d in DEBUFF_LOOKS]
    yield "ui-select", [("pulse", [select_frame(False).outlined(False), select_frame(True).outlined(False)], 450)]
    yield "ui-check", [(lb, [check_badge(lb).outlined()], 1000) for lb in ("1", "2", "3", "tick")]
    yield "ui-afford", [("glint", [afford_frame(i).outlined(False) for i in (0, 0, 1, 2)], 400)]
    yield "ui-section", [(s, [section(s).outlined(False)], 1000) for s in ("complete", "neutral")]
    yield "fx-tap", [("play", [tap_burst(i).outlined(False) for i in range(4)], 60)]
    yield "fx-dust", [("play", [dust(i).outlined(False) for i in range(4)], 80)]
    yield "ui-heart", [("full", [heart(True).outlined(False)], 1000), ("empty", [heart(False).outlined(False)], 1000),
                       ("full-dark", [heart(True, True).outlined(False)], 1000),
                       ("empty-dark", [heart(False, True).outlined(False)], 1000)]
    yield "ui-tile", [(s, [tile(s).outlined(False)], 1000) for s in ("normal", "selected", "disabled")]
    yield "ui-button", [(s, [button(s).outlined(False)], 1000)
                        for s in ("normal", "pressed", "disabled", "secondary", "secondary-pressed", "go", "go-pressed",
                                  "go-disabled")]
    yield "ui-icon-button", [(s, [icon_button(s).outlined(False)], 1000) for s in ("normal", "pressed")]
    yield "ui-switch", [("on", [switch(True).outlined(False)], 1000), ("off", [switch(False).outlined(False)], 1000)]
    yield "ui-slider", [(t, [slider_track(t.startswith("filled"), not t.endswith("disabled")).outlined(False)], 1000)
                        for t in ("filled", "empty", "filled-disabled", "empty-disabled")]
    yield "ui-slider-knob", [(s, [slider_knob(s).outlined(False)], 1000) for s in ("normal", "pressed", "disabled")]
    for suffix, ink in (("", NAVY_FACE), ("-panel", CREAM_PANEL)):
        yield f"icon-sound{suffix}", [(t, [speaker(ink, t == "on").outlined(False)], 1000) for t in ("on", "off")]
    yield "icon-music-panel", [(t, [speaker(CREAM_PANEL, t == "on", True).outlined(False)], 1000)
                               for t in ("on", "off")]
    yield "icon-effects-panel", [(t, [effects(CREAM_PANEL, t == "on").outlined(False)], 1000) for t in ("on", "off")]
    yield "icon-motion-panel", [(t, [motion(CREAM_PANEL, t == "on").outlined(False)], 1000) for t in ("on", "off")]
    yield "icon-install-panel", [(t, [install(CREAM_PANEL, t == "on").outlined(False)], 1000) for t in ("on", "off")]
    yield "ui-zone-pips", [("todo", [zone_pip().outlined(False)], 1000)] + [
        (zone + suffix, [zone_pip(zone, bool(suffix)).outlined(False)], 1000)
        for zone in ZONE_COLOURS for suffix in ("", "-done")]
    yield "ui-touch-drag", touch_tags()


def preview(out, scale=3, width=380):
    """Every piece in rows that wrap at width, so the 360px walk bar gets a row of its own."""
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
    print("built", ", ".join(IMAGES))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
