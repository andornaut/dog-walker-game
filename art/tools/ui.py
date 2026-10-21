#!/usr/bin/env python3
"""Draw the UI kit: icons, nine-slice panels and buttons, the hint bubble and badges.

Images (16x16 icons unless noted): icon-pause, icon-play, icon-home, icon-help, icon-close,
icon-logbook, icon-settings, icon-lock, icon-lock-open (the padlock with its shackle lifted, on a
locked item the bank covers), icon-money, icon-treat (the treat pickup's bone as
road.treat lays it out at 16x16, for the top bar's treat well), icon-stinky; icon-dog-slot (32x32, a pack
slot for sale in the shop: a doghouse with a green plus badge, as the shop's item-<gear> art,
outlined with icon_edge); ui-panel, ui-hint
(24x24 nine-slices, 8px corners), ui-hint-tail (8x6), ui-new-best (72x20 ribbon, text
baked in with font-title); the home screen's ui-detail-card (24x24
nine-slice, 8px corners), ui-detail-band (24x22 three-slice, 8px caps) and
ui-detail-well (68x68) and ui-detail-well-locked (68x68, neutral grey, for an item not owned); the walker section's ui-cork (32x32 seamless corkboard tile), the dogs section's ui-plaid (16x16 seamless tartan tile), the Pocket section's ui-denim (16x16 seamless twill tile), ui-stitch-h (8x2)
and ui-stitch-v (2x8, seamless stitch runs), all repeated with TileSprite; the run screen's ui-strip-well (24x24
nine-slice, the state strip's tab), ui-quip (24x24 nine-slice, 8px corners), ui-quip-name (12x12 three-slice, 4px caps, the speaking
owner's name plate), ui-quip-tail (6x8), ui-quip-tail-down and ui-quip-tail-up (8x6),
ui-celebrate-burst (148x132, the starburst behind the walker in the zone celebration), ui-zone-banner (248x48);
the start screen top bar's ui-home-cash-well (176x30, drawn at (4, 4));
the walk HUD's ui-walk-bar (360x48), ui-effect-well (22x22),
ui-dog-card-band (360x80, drawn at (0, 480)), ui-lead-tag (27x11, LEAD baked in with
font-title) and ui-owner-tab (36x36).
Sprites: ui-dog-card (120x74, one of three cards in the walk's card row; a tag per dog key and
`empty`, then heart-loss: 4 frames, 60, 60, 80 and 80ms, an overlay drawn over the card and under
the game's faces, hearts and text),
ui-dog-card-warn (120x74, the low-hearts rim drawn over ui-dog-card; tags pulse, static),
ui-debuff-bar (360x16, one active debuff's bar under the walk bar; tags muddy, stinky, zoomies),
ui-select (24x24 nine-slice, 8px corners; tag pulse), ui-afford (24x24 nine-slice,
8px corners; tag glint), ui-check (16x16; tags 1, 2, 3, tick),
ui-section (24x32 nine-slice, 3px sides and bottom, 24px top; tags complete, neutral),
fx-tap and fx-dust (16x16; tag play), ui-heart (8x7; tags full, empty, and full-dark and empty-dark for the navy ui-dog-card), ui-button
(24x24 nine-slice, 3px corners and a 5px bottom; tags normal, pressed, disabled,
secondary, secondary-pressed, go, go-pressed, go-disabled), ui-icon-button (20x20, the face under a 16x16 icon such as pause, help or sound; tags normal, pressed),
ui-switch (32x16; tags on, off), ui-slider (24x10 three-slice, 4px caps; tags filled,
empty, filled-disabled, empty-disabled), ui-slider-knob (10x16; tags normal, pressed,
disabled), icon-sound and icon-music (tags on, off), icon-sound-panel, icon-music-panel,
icon-effects-panel and icon-motion-panel (tags on, off), ui-zone-pips (18x8; tags todo,
and <zone> and <zone>-done for each zone in ZONE_COLOURS), ui-tile (24x24 nine-slice, 4px
on every side; tags normal, selected, disabled), ui-sticker (56x28; tags new, price, pop),
ui-touch-drag (104x40, the help screen's one lane-width drag; tags press, drag, release).
Panels, bubbles, plates, tiles and card frames share one chrome (chrome_shape); hits.py,
moments.py, scene.py and cards.py draw their plates, callouts and frames with it.

Usage:
  ui.py preview OUT.png   every piece, scaled up
  ui.py build             write art/ui/*.aseprite and export to
                          public/art/images/ and public/art/sprites/

Run from the repository root, after fonts.py build. A build overwrites the
.aseprite sources, so hand edits to them belong in this file instead.
"""

import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import fonts  # noqa: E402
from pixel import DARKER, K, Grid, contrast, edged, icon_edge, build as build_sprites  # noqa: E402


def to_image(px):
    h, w = len(px), len(px[0])
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y, row in enumerate(px):
        for x, c in enumerate(row):
            if c:
                im.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,))
    return im


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
# icon-pause, icon-play, icon-home, icon-help, icon-close, icon-sound and icon-music sit on
# ui-icon-button's navy face, so they have no outline: cream holds 9.6:1 there, tan 6.6:1,
# amber 7.5:1, orange 5.0:1 and pink 5.1:1. The -panel icons sit on the Settings panel's cream: dbrown holds
# 5.85:1 there, plum 9.42:1 and dred 5.07:1.

# The speaker, note and effects inks: face, shade on the lower-right edges, and the mute X.
NAVY_FACE = ("cream", "tan", "pink")
CREAM_PANEL = ("dbrown", "plum", "dred")

def pause():
    """Amber bars, like the Home glyph beside it on the run bar, so the run controls stand apart
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
    """The run bar's Home button, beside pause: a house as tall as the pause bars, amber with
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


def lock_open():
    """icon-lock with its shackle lifted: the left leg still in the body, the right leg's end a
    row clear of it, so a locked item the bank covers reads apart from one it does not by shape.
    The body is a row shorter than icon-lock's to leave the gap."""
    g = Grid(16, 16)
    g.ell(8, 4.5, 4, 4, "grey", "slate", "lgrey")
    g.ell(8, 5, 2, 2.6, None)
    g.rect(4, 4, 2, 4, "grey")
    g.rect(4, 4, 1, 4, "lgrey")
    g.rect(8, 6, 5, 2, None)
    g.rect(3, 8, 10, 7, "amber")
    g.rect(3, 8, 10, 1, "yellow")
    g.rect(12, 8, 1, 7, "orange")
    g.rect(7, 10, 2, 3, "dbrown")
    return g


def money():
    g = Grid(16, 16)
    g.ell(8, 8, 5.5, 5.5, "amber", "orange", "yellow")
    g.rect(8, 5, 1, 6, "orange")
    g.p(7, 6, "orange")
    g.p(9, 9, "orange")
    return g


def treat_icon():
    """The treat pickup's bone as road.treat lays it out at 16x16 (idle frame 0), outlined with icon_edge
    as the content icons are. Its white holds on the top bar's ink as the road bone holds on Elm Avenue."""
    import road

    g = road.treat(lift=0)
    g.edge = icon_edge
    return g


# The stink lines' sideways offset down a line, as in fx-status-stinky (hits.py).
STINK_WAVE = (0, 1, 1, 1, 0, -1, -1, -1)


def stinky():
    """Three stink lines waving in step out of a small cloud puff, in the skunk's mauve family as
    fx-status-stinky and skunk-cloud: pink with a plum right side and no outline, so the plum
    carries the lines on cream (9.42:1) and the pink on the top bar's ink (6.64:1). The puff is
    mauve, shaded purple, in its ramp outline. Returns frame pixels."""
    g = Grid(16, 16)
    for cx, cy, rx, ry in ((4, 12.5, 3, 2.3), (12, 12.5, 3, 2.3), (8, 11, 3.5, 3)):
        g.ell(cx, cy, rx, ry, "mauve", "purple")
    g.rect(4, 14, 8, 1, "purple")
    px = g.outlined()
    for x0, top in ((2, 1), (7, 0), (12, 1)):
        for y in range(top, 9):
            x = x0 + STINK_WAVE[(y + 6) % 8]
            px[y][x], px[y][x + 1] = K["pink"], K["plum"]
    return px


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


def heart(full, dark=False):
    """8x7: a full heart is filled dark red; an empty one is a dark brown outline, so the two
    differ by fill as well as colour (5:1 or more on the cream and tan slots). dark is for the navy
    dog card: the full heart red (3.31:1) lit pink and white, the empty one a grey outline (4.93:1)."""
    g = Grid(8, 7)
    rows = [".11.11.", "1111111", "1111111", ".11111.", "..111..", "...1..."]
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c != "1":
                continue
            inside = all(0 <= y + dy < len(rows) and 0 <= x + dx < len(row) and rows[y + dy][x + dx] == "1"
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
    secondary-pressed are copies of normal and pressed, kept so frame numbers hold.
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


def tile(state):
    """24x24 nine-slice, 4px on every side: a pickable tile (walker, dog or gear) in one of the
    interaction states. normal is the chrome: ink and plum lines, cream face, a tan lip 2px deep
    at the bottom and 1px at the right. selected is the gold of ui-section's complete state: an
    ink line, a 1px amber band and an orange line round a yellow face on a 1px amber lip.
    disabled (not owned and short, the pack full, not available) is flat in the neutral greys: an
    ink line, an nslate line and an ngrey face with no lip. Content sits from 3px in."""
    face, lip, _ = STATES[state]
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


# ---------- plates: the hit label, the firing plate and the payout tag ----------

def hit_label(face="dred", lit="red", shade="plum"):
    """ui-hit-label's 24x24 nine-slice, 8px corners: a plate (dred for normal, blue for lucky)
    stretched to 176x32. White text holds 7.34:1 on dred and 8.48:1 on blue; the cream band
    carries Elm Avenue and the ink line the light roads."""
    return plate(face, lit, shade)


def fired_plate(face, lit, shade):
    """ui-fired-plate's 24x24 nine-slice, 8px corners: a plate in the owner's temperament colour
    (blue, purple, dred) with a white stamp line 2px inside the face, its corners cut so it reads
    as a stamp's rounded border. The game stretches it to 116x28 over the doghouse's name plate."""
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


# ---------- stickers ----------

STICKER_W, STICKER_H = 56, 28
# Each look's body and spike colours: new for a tile that just became affordable, price for the
# next locked tile's price. Ink text holds 14.43:1 on yellow and 11.98:1 on cyan.
STICKERS = {"new": ("yellow", "amber"), "price": ("cyan", "sky")}


def sticker(body, spikes, scale=1.0, turn=0.0):
    """56x28: a starburst sticker, a squared oval body (a superellipse, 20x7 half axes) ringed by
    14 spikes 5px long, spaced evenly round its edge, in an ink outline. The game writes one short
    word on the body in font-title, ink, centred on x 28 with its caps in rows 12 to 16, up to
    36px wide. scale and turn (a fraction of a spike) draw the pop's frames."""
    import math

    a, b, n, spike = 20 * scale, 7 * scale, 14, 5 * scale
    cx, cy = STICKER_W / 2, STICKER_H / 2
    # the edge's arc length at each parametric angle, so the spikes fall evenly round it
    steps = 720
    edge = [(math.copysign(a * abs(math.cos(t)) ** 0.5, math.cos(t)),
             math.copysign(b * abs(math.sin(t)) ** 0.5, math.sin(t)))
            for t in (2 * math.pi * i / steps for i in range(steps + 1))]
    arc = [0.0]
    for (x0, y0), (x1, y1) in zip(edge, edge[1:]):
        arc.append(arc[-1] + math.hypot(x1 - x0, y1 - y0))
    g = Grid(STICKER_W, STICKER_H)
    for y in range(STICKER_H):
        for x in range(STICKER_W):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            r = ((abs(dx) / a) ** 4 + (abs(dy) / b) ** 4) ** 0.25
            if r <= 1:
                g.p(x, y, body)
                continue
            phi = math.atan2(math.copysign((abs(dy) / b) ** 2, dy), math.copysign((abs(dx) / a) ** 2, dx))
            t = (arc[round(phi % (2 * math.pi) / (2 * math.pi) * steps)] / arc[-1] * n + turn) % 1
            beyond = math.hypot(dx, dy) * (1 - 1 / r)
            if beyond <= spike * (1 - abs(2 * t - 1)):
                g.p(x, y, spikes)
    fill = [row[:] for row in g.px]
    for y in range(STICKER_H):
        for x in range(STICKER_W):
            if not fill[y][x] and any(0 <= x + dx < STICKER_W and 0 <= y + dy < STICKER_H and fill[y + dy][x + dx]
                                      for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0))):
                g.p(x, y, "ink")
    return g


# ---------- the dogs' colours and the debuff bars ----------

# Each dog's colour: base, shade and dark, from the dog's accessory. It backs the dog's photo, rings
# its emblem badge and runs along the card's foot stripe. No two dogs share a base. Card
# backgrounds never use zone colours; a dog's accent is its own colour. Snowball's is
# his collar's blue, not its sky, which backs every owner's photo; Archie's is rust, for his red
# merle coat; Pierre's is his show bow's mauve, which holds his black coat's ink line at 3.83:1.
DOG_COLOURS = {
    "duchess": ("pink", "mauve", "purple"), "nugget": ("red", "dred", "plum"), "zippy": ("dred", "plum", "ink"),
    "pierre": ("mauve", "purple", "plum"), "biscuit": ("green", "dgreen", "forest"),
    "archie": ("rust", "dbrown", "plum"), "snowball": ("blue", "navy", "ink"),
    "penny": ("amber", "brown", "dbrown"), "koda": ("orange", "rust", "dbrown"),
    "empty": ("slate", "dslate", "navy"),
}


def depth(solid, x, y, r):
    """True when every pixel within r of (x, y) is on the card."""
    return all(solid(x + dx, y + dy) for dx in range(-r, r + 1) for dy in range(-r, r + 1))


# Each debuff's bar under the walk bar: its face, the empty track, the track's fill and the name's
# colour. The name holds 4.5:1 or more on the face: ink on brown 4.66:1, white on mauve 4.70:1,
# ink on green 8.41:1. Zoomies is green so its bar never sits blue on a blue sky.
DEBUFF_LOOKS = {
    "muddy": ("brown", "dbrown", "tan", "ink"), "stinky": ("mauve", "purple", "pink", "white"),
    "zoomies": ("green", "forest", "yellow", "ink"),
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


def detail_band():
    """24x22 three-slice (8px caps; the middle 8 columns tile): the title band across the top of
    the detail card's paper, navy over an ink line like ui-section's heading band, in a 1px ink
    edge with its corners cut. The game writes the name in font-title x2, white (13.89:1), caps
    6px below the band's top."""
    g = Grid(24, 22)
    g.rect(1, 0, 22, 22, "ink")
    g.rect(0, 1, 24, 20, "ink")
    g.rect(1, 1, 22, 19, "navy")
    g.rect(1, 1, 22, 1, "dslate")
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


def detail_well_locked():
    """68x68: ui-detail-well for an item not owned, in the disabled tile's neutral greys: ink and
    nslate lines round an ngrey recess shaded ndslate under its top and left edges. The game draws
    the portrait's ink silhouette at 2,2 (7.23:1 on ngrey), never the portrait."""
    g = Grid(68, 68)
    g.rect(1, 0, 66, 68, "ink")
    g.rect(0, 1, 68, 66, "ink")
    g.rect(1, 1, 66, 66, "nslate")
    g.rect(2, 2, 64, 64, "ngrey")
    g.rect(2, 2, 64, 1, "ndslate")
    g.rect(2, 2, 1, 64, "ndslate")
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


DENIM = 16
STITCH_DASH, STITCH_GAP = 5, 3


def denim():
    """16x16 seamless tile: the Pocket section's jeans-pocket fill, repeated (TileSprite) over the
    section's tile area. Blue twill: dslate diagonals rising to the right every 4px, and sparse slate
    flecks of weft between them. Blue holds apart from the band's navy and the dogs section's wood,
    and the tiles' ink edges hold on it."""
    g = Grid(DENIM, DENIM)
    g.rect(0, 0, DENIM, DENIM, "blue")
    for y in range(DENIM):
        for x in range(DENIM):
            d = (x + y) % 4
            if d == 0:
                g.p(x, y, "dslate")
            elif d == 2 and (x * 7 + y * 3) % 5 == 0:
                g.p(x, y, "slate")
    return g


# The cork's tile side: twice the denim's, so its scattered granules repeat too far apart to show a grid.
CORK = 32


def cork():
    """32x32 seamless tile: the walker section's corkboard, repeated (TileSprite) over its tile area,
    where the walkers' cards are pinned. Brown with scattered ochre and dbrown granules; the cream
    tiles' ink edges hold on it, and it holds apart from the Pocket's blue and the dogs' plaid."""
    g = Grid(CORK, CORK)
    g.rect(0, 0, CORK, CORK, "brown")
    for x, y, c in CORK_GRAINS:
        g.p(x, y, c)
    return g


def cork_grains(seed=11, gap=3.4, tries=8000):
    """The cork's granules: blue noise on the CORK x CORK torus (no two closer than gap, measured across the
    tile's wrap too), so the repeated tile scatters evenly with no lattice. Each is dbrown or ochre, and
    about half grow a second pixel beside or below them, so the grains vary in size as cork's do."""
    import random

    r, seeds = random.Random(seed), []
    for _ in range(tries):
        x, y = r.randrange(CORK), r.randrange(CORK)
        if all(min(abs(x - a), CORK - abs(x - a)) ** 2 + min(abs(y - b), CORK - abs(y - b)) ** 2 >= gap * gap
               for a, b in seeds):
            seeds.append((x, y))
    pts = []
    for x, y in seeds:
        c = "dbrown" if r.random() < 0.5 else "ochre"
        pts.append((x, y, c))
        if r.random() < 0.5:
            dx, dy = r.choice(((1, 0), (0, 1), (1, 1)))
            pts.append(((x + dx) % CORK, (y + dy) % CORK, c))
    return pts


CORK_GRAINS = cork_grains()


def plaid():
    """16x16 seamless tile: the dogs section's dog-blanket tartan, repeated (TileSprite) over its tile
    area. A dred ground crossed each way by a 2px plum band and, halfway between, a 1px plum thread, so a
    plum line runs about every 8px: quiet enough that the dog tiles stay the loudest thing on it."""
    g = Grid(DENIM, DENIM)
    for y in range(DENIM):
        for x in range(DENIM):
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


# ---------- run screen: the state strip, zone progress, quips, zone banner ----------

def well(g, x, y, w, h):
    """A recessed ink slot in the wood: clipped corners and a dark brown lip below and to the right."""
    g.rect(x + 1, y, w - 2, h, "ink")
    g.rect(x, y + 1, w, h - 2, "ink")
    g.rect(x + 1, y + h - 1, w - 2, 1, "dbrown")
    g.rect(x + w - 1, y + 1, 1, h - 2, "dbrown")


def strip_well():
    """24x24 nine-slice (8px corners): the state strip's tab hanging under the zone well, plum wood
    with a flat top (it tucks under the bar) and rounded bottom corners around an ink well that
    holds the 16x16 state icons (they hold 3:1 on ink). Stretch it to the strip's width."""
    g = Grid(24, 24)
    g.rect(0, 0, 24, 22, "plum")
    g.rect(1, 22, 22, 1, "plum")
    g.rect(2, 23, 20, 1, "ink")
    g.p(0, 22, "ink")
    g.p(23, 22, "ink")
    g.rect(0, 0, 1, 22, "dbrown")
    g.rect(23, 0, 1, 22, "ink")
    well(g, 3, 1, 18, 19)
    return g


# ---------- the walk HUD: the 48-row walk bar, the debuff bars and the dog cards ----------

WALK_BAR = (360, 48)
# The walk bar's wells, in screen pixels: the cash, and the neighbourhood with its name and "n of N"
# on one line.
WALK_WELLS = ((4, 5, 75, 37), (80, 5, 110, 12))
# The row of effect wells under the neighbourhood well, kept plain wood so the wells sit clear of
# the grain: five 22x22 wells side by side from x 80, each lip against the next well, on rows 20 to 41.
# Between the trim lines (row 1 and row 45) the neighbourhood well (rows 5 to 16) and the wells
# split the height evenly, 3 wood rows above the name well, 3 between and 3 under the wells, and
# the cash well spans the same rows 5 to 41.
EFFECT_ROW = (79, 17, 112, 26)
EFFECT_WELL = 22


def walk_bar():
    """360x48, ui-walk-bar: plum wood with a trim (dbrown on row 1; brown, dbrown and ink on rows
    45 to 47) and two ink wells, the grain kept 1px clear of each and of the effect row:
    cash 4,5 75x37, sized for "$888" at 3x with no coin, and neighbourhood 80,5 110x12, one text line as wide
    as the five effect wells under it, which ends clear of the Home button's hit at x 190. The game
    draws the effect wells, the Home, Help, Sound, Settings and Pause buttons and every text and
    icon on it."""
    w, h = WALK_BAR
    g = Grid(w, h)
    wood(g, 0, h)
    g.rect(0, 1, w, 1, "dbrown")
    for i, c in enumerate(("brown", "dbrown", "ink")):
        g.rect(0, h - 3 + i, w, 1, c)
    for x, y, ww, hh in WALK_WELLS:
        g.rect(x - 1, y - 1, ww + 2, hh + 2, "plum")
    g.rect(*EFFECT_ROW, "plum")
    grain = K["dbrown"]
    for y in range(2, h - 3):
        x = 0
        while x < g.w:
            n = 0
            while x + n < g.w and g.px[y][x + n] == grain:
                n += 1
            if 0 < n < 3:
                g.rect(x, y, n, 1, "plum")
            x += max(n, 1)
    for x, y, ww, hh in WALK_WELLS:
        well(g, x, y, ww, hh)
    return g


# The start screen top bar's bank well, in screen pixels: the left half of the 38 rows above the
# bar's rule, ending 4px before the Logbook button's hit at x 184.
HOME_CASH_WELL = (4, 4, 176, 30)


def home_cash_well():
    """176x30, ui-home-cash-well: the start screen top bar's ink well for the bank, drawn at (4, 4)
    on the bar's plum, with the walk bar's wells' clipped corners and dbrown lip. The game centres
    the bank in it."""
    _, _, w, h = HOME_CASH_WELL
    g = Grid(w, h)
    well(g, 0, 0, w, h)
    return g


def effect_well():
    """22x22, ui-effect-well: an ink well for one active effect's 20x20 icon at (1, 1), with the
    walk bar's wells' clipped corners and dbrown lip."""
    g = Grid(EFFECT_WELL, EFFECT_WELL)
    well(g, 0, 0, EFFECT_WELL, EFFECT_WELL)
    return g


# The dog card: 120x74 in its slot, the chrome on x 1 to 118 and rows 0 to 73, so a 1px gap runs
# down each side and the card's foot is the screen's bottom row. The cards are navy, as a neutral
# ui-section, so the eye stays on the road and the dogs' photos and hearts carry the row.
DOG_CARD = (120, 74)
DOG_CARD_FRAME = (1, 0, 118, 74)
# The photo in the body (the navy on x 3 to 115 and rows 18 to 70): 3 columns of navy to its left, as
# the owner's column keeps to its right, 8 rows above it and 9 below.
DOG_PHOTO = (6, 26)
# The owner's photo, x, y and side: 3 columns right of the dog's and level with its top, an ink frame
# round a white mat round sky, as ui-owner-tab frames the owner, for the 20x20 face-owner-<dog>-20.
DOG_CARD_OWNER = (45, 26, 24)
# The hearts area the heart-loss flash fills, as x, y, w, h: one row of six hearts from (45,55), its
# foot level with the dog's photo, with a pixel round them. The only part of the card it touches, so
# the warn rim stays the card's only border.
DOG_CARD_HEARTS = (44, 54, 55, 9)
# The empty card's FIRED plate, x, y, w and h: a band across the empty photo, centred on it, the
# plate's sides on the photo's frame.
DOG_CARD_FIRED = (6, 35, 36, 17)
# Each heart-loss frame: the flash's colour and how many of the area's pixels it fills (1 every
# pixel, 2 a checkerboard, 4 one in four), so it bursts white and dithers away. White keeps the
# hearts drawn over it readable (red 4.19:1, the grey outlines 2.82:1), where a red or pink flash
# would swallow the red hearts (1.0:1 and 1.55:1).
DOG_CARD_HEART_LOSS = (("white", 1), ("white", 1), ("white", 2), ("white", 4))


def dog_card(dog):
    """120x74, ui-dog-card: one of three cards in the walk's card row, in the neutral section look: a
    2px ink frame (the chrome with an ink inner line and an ink lip) round a navy face, the header
    (rows 1 to 16) split from the body by an ink rule on row 17. The game writes the name on the
    header in cream (9.59:1), with no plate. The dog's photo is an ink frame (6,26 36x36) round a
    cream mat round its colour (8,28 32x32), in the body's middle. The owner's photo is an ink frame
    (45,26 24x24) round a white mat round sky (47,28 20x20) for the owner's small face; the game writes
    the owner's name (tan, 6.61:1) beside it and the hearts (ui-heart full-dark and empty-dark) under
    it, and pins the LEAD tag across the foot of the dog's photo. The empty card (a fired dog's) is
    dslate in the same frame, with a dslate photo crossed by a dred plate built as ui-fired-plate
    (6,35 36x17, its face 10,39 28x9) for FIRED, and the owner's photo."""
    empty = dog == "empty"
    face = "dslate" if empty else "navy"
    w, h = DOG_CARD
    g = Grid(w, h)
    chrome(g, *DOG_CARD_FRAME, r=1, face=face, lip="ink", line="ink")
    g.rect(3, 17, 114, 1, "ink")
    x, y = DOG_PHOTO
    g.rect(x, y, 36, 36, "ink")
    g.rect(x + 1, y + 1, 34, 34, "cream")
    g.rect(x + 2, y + 2, 32, 32, "dslate" if empty else DOG_COLOURS[dog][0])
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
    """120x74, ui-dog-card-warn: a 2px rim inside the card's outline, for an owner at one heart;
    steps 0 to 2 run dim to bright. The outer pixel holds 7.35:1 on the wood and 7.49:1 on navy."""
    outer, inner = (("orange", "red"), ("amber", "red"), ("amber", "orange"))[step]
    solid = dog_card_solid()
    w, h = DOG_CARD
    g = Grid(w, h)
    for y in range(h):
        for x in range(w):
            if not solid(x, y):
                continue
            if not depth(solid, x, y, 1):
                g.p(x, y, outer)
            elif not depth(solid, x, y, 2):
                g.p(x, y, inner)
    return g


def dog_card_heart_loss(step):
    """120x74, ui-dog-card's heart-loss frames, an overlay over the card and under the game's face,
    hearts and text that fills only the hearts area (44,54 55x9, its corners cut 1px), never the
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


CARD_BAND = (360, 80)
# The band's top rows, where the road ends: a dithered ink shadow cast onto the road (rows 0 and
# 1, a quarter then three quarters of their pixels), then the trim: ink, a lit tan line and ink
# (rows 2 to 4), then the wood.
CARD_BAND_TRIM = ("ink", "tan", "ink")


def dog_card_band():
    """360x80, ui-dog-card-band: drawn at (0, 480) under the cards. Rows 0 and 1 (screen 480 and 481)
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
    im = to_image(g.px)
    gl, _, _ = fonts.glyphs(*fonts.FONTS["font-title"][1:])
    x = 3
    for ch in "LEAD":
        mask, ox, oy, adv = gl[ch]
        if mask is not None:
            im.paste((24, 20, 37, 255), (x + ox, 3 + oy - 4), mask)
        x += adv
    return im


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
    "woof-way": "dslate", "bark-park": "tan", "sniff-street-shops": "pink", "the-long-way-home": "skin2",
    "snooze-crescent": "grey", "paws-promenade": "cream",
}
# One ramp step up: the inverse of DARKER, for rims that must lighten to hold 3:1 on ink.
LIGHTER = {v: k for k, v in DARKER.items() if k != v}


def pip_rim(fill):
    """A chosen pip's rim: the zone colour, stepped up its ramp until it holds 3:1 on the ink well."""
    c = K[fill]
    while contrast(c, "ink") < 3:
        c = LIGHTER[c]
    return c


def zone_pip(zone=None, done=False):
    """18x8, one per zone of the chosen route, 3px apart. todo (no zone) is a dashed dbrown rim
    around the bare well: not yet chosen. <zone> is chosen: a rim in the zone's colour (pip_rim) around a 16x6
    well at 1,1 in the zone's road shadow. The game fills the current pip's well from the left in
    the zone's colour (ZONE_COLOURS) as the zone goes by. <zone>-done is the full colour with a
    tick (white, or plum where white falls under 3:1), so progress never relies on colour alone."""
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
    g.rect(1, 0, 16, 8, pip_rim(fill))
    g.rect(0, 1, 18, 6, pip_rim(fill))
    g.rect(1, 1, 16, 6, fill if done else DARKER[K[fill]])
    if done:
        tick = "white" if contrast(fill, "white") >= 3 else "plum"
        for x, y in ((6, 4), (7, 5), (8, 4), (9, 3), (10, 2), (11, 1)):
            g.p(x, y, tick)
        g.p(7, 6, DARKER[K[fill]])
    return g


def quip_tail_down():
    """8x6, ui-quip-tail turned to point down from a bubble above the doghouse row. Place its top row
    over the bubble's bottom rim so the cream runs through; the tip is at column 5, row 5."""
    return down_tail(5)


def quip_tail_up():
    """8x6, ui-quip-tail-down turned to point up from a bubble's top rim at the speaker above it. Place
    its bottom row over the bubble's top rim so the cream runs through; the tip is at column 3, row 0."""
    rows = ["...#....", "..###...", "..####..", ".######.", ".######.", "########"]
    return chrome_shape(Grid(8, 6), lambda x, y: rows[y][x] == "#", lambda x, y: y > 5 and 1 <= x < 7, line=None)


CELEBRATE_BURST = (148, 132)


def celebrate_burst():
    """148x132: the starburst behind the cheering walker in the zone celebration, ui-sticker's look as a
    round burst: a yellow body (an ellipse with 62x54 half axes) ringed by 18 amber spikes 10px long, in a
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


QUIP_NAME = (12, 12)


def quip_name():
    """12x12 three-slice (4px caps), ui-quip-name: the plate that names the speaking owner, laid on
    the corner of their ui-quip nearest the tab. An ink line with its corners cut 1px round a plum
    face lit purple along its top row; columns 4 to 7 are uniform, so it stretches to the name's
    width + 8. The game writes the name in font-body, cream (9.42:1), its capitals at +3."""
    w, h = QUIP_NAME
    g = Grid(w, h)
    g.rect(1, 0, w - 2, h, "ink")
    g.rect(0, 1, w, h - 2, "ink")
    g.rect(1, 1, w - 2, h - 2, "plum")
    g.rect(1, 1, w - 2, 1, "purple")
    return g


def quip_tail():
    """6x8, pointing left at the owner's window in the dog column: cream in an ink line. Place its
    right column over the bubble's left rim so the cream meets the bubble's plum line."""
    rows = ["....##", "...###", "..####", ".#####", "######", ".#####", "...###", ".....#"]
    g = Grid(6, 8)
    return chrome_shape(g, lambda x, y: rows[y][x] == "#", lambda x, y: x > 5 and 1 <= y < 7, line=None)


def zone_banner():
    """248x48: a cream board in the chrome on navy ribbon ends, shown over the road between
    zones. The game writes two lines in font-title, plum, centred on x=124: the world and zone
    number ("MAPLEWOOD, ZONE 2") with its caps in rows 11 to 15, and the zone name at x2
    ("FAIRVIEW PARK", up to 192px wide) with its caps in rows 27 to 36, under the dotted divider."""
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


def chevron(g, x, cy, left, col, sh):
    """A 3px-thick arrowhead 13px tall with its tip at x, shaded below the middle."""
    for d in range(-6, 7):
        px = x + abs(d) if left else x - abs(d) - 2
        g.rect(px, cy + d, 3, 1, sh if d > 0 else col)


def touch_track(g, left, right, y):
    """The touch hint's two-way track on row y: an amber line (orange along its lower row) between
    two orange arrowheads 5 columns long, their tips on columns left and right."""
    g.rect(left + 5, y - 1, right - left - 9, 2, "amber")
    g.rect(left + 5, y, right - left - 9, 1, "orange")
    for i in range(5):
        g.rect(left + i, y - i, 1, 1 + 2 * i, "orange")
        g.rect(right - i, y - i, 1, 1 + 2 * i, "orange")


def touch_mark(g, x, y, col):
    """A touch mark the fingertip left at x, y: a small ring."""
    g.ell(x, y, 3, 3, col)
    g.ell(x, y, 1.6, 1.6, None)


def touch_glow(g, x, y):
    """The pressed fingertip's glow centred on x, y."""
    g.ell(x, y, 4, 4, "yellow", "amber")


def touch_speed(g, x, sides):
    """Speed lines beside a hand whose fingertip is on column x: on the left (-1), the right (1) or both."""
    for y, dx in ((16, 0), (20, 3), (24, 0)):
        if -1 in sides:
            g.rect(x - 20 - dx, y, 8, 1, "white")
        if 1 in sides:
            g.rect(x + 14 + dx, y, 8, 1, "white")


def touch_hand(g, x, y):
    """The pointing hand, its index fingertip's contact pixel at x, y (the finger's top row y - 1),
    the other fingers curled to the right and a white cuff below: 17 columns, 29 rows."""
    dx, dy = x - 48, y - 6
    for rx, ry, w, h, c in ((46, 6, 5, 13, "skin1"), (47, 5, 3, 1, "skin1"), (47, 6, 3, 2, "cream"),
                            (42, 16, 15, 12, "skin1"), (43, 15, 13, 1, "skin1"),
                            (51, 19, 6, 1, "skin2"), (51, 23, 6, 1, "skin2"), (51, 27, 6, 1, "skin2"),
                            (40, 18, 3, 6, "skin1"), (40, 23, 3, 1, "skin2"), (50, 7, 1, 11, "skin2"),
                            (56, 16, 1, 12, "skin2"), (43, 27, 13, 1, "skin2"), (43, 28, 13, 6, "white"),
                            (43, 33, 13, 1, "lgrey"), (55, 28, 1, 6, "lgrey")):
        g.rect(rx + dx, ry + dy, w, h, c)


# ui-touch-drag: one lane-width drag (64px) to the right on a 104x40 frame, for the help screen.
# The track's centre is row TOUCH_Y, the drag runs from column TOUCH_FROM to TOUCH_TO, and each
# frame is (fingertip column, fingertip row, glow, the marks left behind, speed lines).
TOUCH_SIZE, TOUCH_Y, TOUCH_FROM, TOUCH_TO = (104, 40), 6, 20, 84
TOUCH_HALF = (TOUCH_FROM + TOUCH_TO) // 2
TOUCH_FRAMES = {
    "press": [(TOUCH_FROM, TOUCH_Y - 3, None, (), False), (TOUCH_FROM, TOUCH_Y, "glow", (), False)],
    "drag": [(TOUCH_FROM, TOUCH_Y, "glow", (), False), (41, TOUCH_Y, "glow", ("faint",), True),
             (63, TOUCH_Y, "glow", ("faint", "bright"), True), (TOUCH_TO, TOUCH_Y, "glow", ("faint", "bright"), True)],
    "release": [(TOUCH_TO, TOUCH_Y - 3, "ring", ("faint", "bright"), False),
                (TOUCH_TO, TOUCH_Y - 3, "fading", ("faint", "bright"), False)],
}
TOUCH_MS = 150


def touch_drag(x, y, glow, marks, speed):
    """A frame of ui-touch-drag: the track, the marks the drag left (faint at its start, bright
    halfway), the glow under the fingertip (a wide yellow ring, then a light grey one, as it lifts), the speed
    lines trailing on the left while it moves, and the hand. Drawn dragging right; the game
    mirrors it for a drag to the left."""
    g = Grid(*TOUCH_SIZE)
    touch_track(g, 4, 99, TOUCH_Y)
    for mark in marks:
        touch_mark(g, TOUCH_FROM if mark == "faint" else TOUCH_HALF, TOUCH_Y, "lgrey" if mark == "faint" else "white")
    if glow == "glow":
        touch_glow(g, x, TOUCH_Y)
    elif glow is not None:
        # wider than a touch mark, so it shows either side of the lifted finger
        g.ell(x, TOUCH_Y, 5, 5, "yellow" if glow == "ring" else "lgrey")
        g.ell(x, TOUCH_Y, 3.4, 3.4, None)
    if speed:
        touch_speed(g, x, (-1,))
    touch_hand(g, x, y)
    return g

IMAGES = {
    "icon-pause": lambda: to_image(pause().outlined(False)),
    "icon-play": lambda: to_image(play().outlined(False)),
    "icon-home": lambda: to_image(home_icon().outlined(False)),
    "icon-help": lambda: to_image(help_icon().outlined(False)),
    "icon-close": lambda: to_image(close().outlined(False)),
    "icon-logbook": lambda: to_image(logbook_icon().outlined(False)),
    "icon-settings": lambda: to_image(settings_icon().outlined(False)),
    "icon-lock": lambda: to_image(lock().outlined()),
    "icon-lock-open": lambda: to_image(lock_open().outlined()),
    "icon-money": lambda: to_image(money().outlined()),
    "icon-treat": lambda: to_image(treat_icon().outlined()),
    "icon-stinky": lambda: to_image(stinky()),
    "icon-dog-slot": lambda: to_image(dog_slot().outlined()),
    "ui-panel": lambda: to_image(panel().outlined(False)),
    "ui-hint": lambda: to_image(hint().outlined(False)),
    "ui-hint-tail": lambda: to_image(hint_tail().outlined(False)),
    "ui-new-best": new_best,
    "ui-strip-well": lambda: to_image(strip_well().outlined(False)),
    "ui-quip": lambda: to_image(quip().outlined(False)),
    "ui-quip-name": lambda: to_image(quip_name().outlined(False)),
    "ui-quip-tail": lambda: to_image(quip_tail().outlined(False)),
    "ui-quip-tail-down": lambda: to_image(quip_tail_down().outlined(False)),
    "ui-quip-tail-up": lambda: to_image(quip_tail_up().outlined(False)),
    "ui-celebrate-burst": lambda: to_image(celebrate_burst().outlined(False)),
    "ui-zone-banner": lambda: to_image(zone_banner().outlined(False)),
    "ui-walk-bar": lambda: to_image(walk_bar().outlined(False)),
    "ui-effect-well": lambda: to_image(effect_well().outlined(False)),
    "ui-home-cash-well": lambda: to_image(home_cash_well().outlined(False)),
    "ui-dog-card-band": lambda: to_image(dog_card_band().outlined(False)),
    "ui-lead-tag": lead_tag,
    "ui-owner-tab": lambda: to_image(owner_tab().outlined(False)),
    "ui-detail-card": lambda: to_image(detail_card().outlined(False)),
    "ui-detail-band": lambda: to_image(detail_band().outlined(False)),
    "ui-detail-well": lambda: to_image(detail_well().outlined(False)),
    "ui-detail-well-locked": lambda: to_image(detail_well_locked().outlined(False)),
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
        yield f"icon-music{suffix}", [(t, [speaker(ink, t == "on", True).outlined(False)], 1000) for t in ("on", "off")]
    yield "icon-effects-panel", [(t, [effects(CREAM_PANEL, t == "on").outlined(False)], 1000) for t in ("on", "off")]
    yield "icon-motion-panel", [(t, [motion(CREAM_PANEL, t == "on").outlined(False)], 1000) for t in ("on", "off")]
    yield "ui-zone-pips", [("todo", [zone_pip().outlined(False)], 1000)] + [
        (zone + suffix, [zone_pip(zone, bool(suffix)).outlined(False)], 1000)
        for zone in ZONE_COLOURS for suffix in ("", "-done")]
    yield "ui-touch-drag", [(tag, [touch_drag(*f).outlined() for f in frames], TOUCH_MS)
                            for tag, frames in TOUCH_FRAMES.items()]
    pop = [sticker(*STICKERS["new"], scale, turn).outlined(False)
           for scale, turn in ((0.45, 0.5), (0.85, 0.25), (1.06, 0), (1, 0))]
    yield "ui-sticker", [(t, [sticker(*cols).outlined(False)], 1000) for t, cols in STICKERS.items()] + [
        ("pop", pop, 70)]


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
