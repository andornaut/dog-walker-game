#!/usr/bin/env python3
"""Draw the gear drops: a piece of the shop's gear lying on the road, which the
pack grabs to wear for the rest of the walk.

drop-<gear>   24x24   one per droppable gear: drop-fanny-pack, drop-hall-pass,
                      drop-lucky-collar, drop-running-shoes and drop-whistle.
                      idle (2 frames, 500ms): the sparkle beside the gear twinkles,
                      a small plus on frame 0 (the rest pose) and a four-point
                      star on frame 1; the gear stays still.

Each shows its gear in the shop art's colours and silhouette (icons.py's item-<gear>,
glyphs.py's icon-gear-<gear>), with a yellow sparkle at a top corner so it reads as a
pickup. Apart from the other pickups: tip is a spinning coin, treat a white bone, and
lost-wallet a brown wallet whose white glint comes and goes; a drop's sparkle is
yellow and always there.

The drawings are laid out on a 16-unit design grid like road.py's pickups and drawn on a
minis.Mini at road.SCALE (1.5x), so 16 units are 24px. Each also has <key>@<step> for
each depth step in minis.STEPS (from shared/depth-steps.json), redrawn at road.SCALE x the
step, floor(size x scale + 0.5), with the original's tags, frames and durations and a full
outline. The sparkle and the small marks (the paw, the clover) are drawn in pixels at the
drawn size, as road.wallet draws its $, so they keep their shape at every step.

They take the road outline rule (pixel.road_edge) and road.LIT's rim on their dark
colours, so each holds 3:1 on every road.

Usage:
  drops.py preview OUT.png   every frame on the zone roads
  drops.py build             write art/drops/*.aseprite and export to
                             public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import road  # noqa: E402
from minis import STEPS, Mini  # noqa: E402
from pixel import edged, main, raster  # noqa: E402

# The sparkle by its size, in drawn pixels: w white, y yellow. SPARKLES[big] is the twinkle's frame 1, the
# one before it frame 0; sparkle() picks the pair that suits the scale.
SPARKLES = (
    ["w"],
    [".y.", "ywy", ".y."],
    ["..y..", "..w..", "ywwwy", "..w..", "..y.."],
)
SPARKLE_COLS = {"w": "white", "y": "yellow"}
# The idle: the sparkle small, then big.
IDLE_MS = 500


def stamp(g, cx, cy, rows, cols):
    """rows (one character a pixel, '.' clear) centred on design point (cx, cy), drawn in g's own pixels."""
    s = getattr(g, "s", 1)
    px = raster(g)
    x0 = math.floor(cx * s + 0.5 - len(rows[0]) / 2)
    y0 = math.floor(cy * s + 0.5 - len(rows) / 2)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in cols:
                px.p(x0 + x, y0 + y, cols[ch])


def sparkle(g, cx, cy, big):
    """The pickup's sparkle centred on design point (cx, cy): from 1.2x the plus and the star, below it a
    dot and the plus."""
    k = 1 if getattr(g, "s", 1) >= 1.2 else 0
    stamp(g, cx, cy, SPARKLES[k + big], SPARKLE_COLS)


def paw(g, cx, cy, c="dred"):
    """A paw print centred on design point (cx, cy), in drawn pixels: three toes over a pad from 1.2x, a
    2px pad below it."""
    if getattr(g, "s", 1) >= 1.2:
        stamp(g, cx, cy, ["1.1.1", ".....", ".111.", ".111."], {"1": c})
    else:
        stamp(g, cx, cy, ["11"], {"1": c})


# ---------- the gear ----------

def fanny_pack(g):
    """A forest-green waist pack: a pouch flat along the top and round below, its dslate webbing belt out of
    each side, dipping at the ends as it would round a waist, a dslate side-release buckle with an lgrey
    catch on the left strap, so it holds on the walk bar's ink well, a black zip across the top with its
    pull hanging at the right end, and a white logo patch low on the left. icons.py's item-fanny-pack,
    glyphs.py's icon-gear-fanny-pack and badges.py's kitted-out draw this same design."""
    g.rect(0.6, 5.8, 14.8, 1.8, "dslate")
    g.rect(0.6, 5.8, 14.8, 0.6, "slate")
    g.rect(0, 6.6, 1.2, 1.8, "dslate")
    g.rect(14.8, 6.6, 1.2, 1.8, "dslate")
    # the buckle: a dslate clip with an lgrey catch
    g.rect(0.4, 5, 2.2, 3.6, "dslate")
    g.rect(1, 5.8, 1, 2, "lgrey")
    # the pouch, lit along its top
    g.blob(8, 9, 5.4, 4.4, "dgreen", "forest", "green", power=3)
    g.rect(2.8, 4.6, 10.4, 3, "dgreen")
    g.rect(3.4, 4.6, 9.2, 0.8, "green")
    # the zip and its pull
    g.rect(3.6, 6.4, 8.8, 0.8, "ink")
    g.rect(11.4, 6.4, 0.8, 2.6, "ink")
    # the logo patch, its navy mark only where it has room, so it never splits into two white dots
    g.rect(4.4, 9.4, 3, 1.6, "white")
    if getattr(g, "s", 1) >= 1.5:
        g.rect(5, 10, 1.8, 0.6, "navy")


def hall_pass(g):
    """A cream pass card under a red header band, its lgrey clip on a sky lanyard whose two straps (blue
    on their inner edges) rise steeply out of the frame's top, a dred paw stamp on the left and brown lines
    of print on the right."""
    for i in range(5):
        g.rect(5.6 - 0.45 * i, 5.2 - i, 1.4, 1, "sky")
        g.rect(8.2 + 0.45 * i, 5.2 - i, 1.4, 1, "sky")
        g.rect(6.5 - 0.45 * i, 5.2 - i, 0.6, 1, "blue")
        g.rect(8.2 + 0.45 * i, 5.2 - i, 0.6, 1, "blue")
    g.rect(1, 6.5, 13, 8.5, "cream")
    g.rect(1, 6.5, 13, 2.5, "red")
    g.rect(13.3, 6.5, 0.7, 8.5, "tan")
    g.rect(1, 14.3, 13, 0.7, "tan")
    g.rect(13.3, 6.5, 0.7, 2.5, "dred")
    g.rect(6.2, 5.2, 2.6, 2.3, "lgrey")
    paw(g, 4.2, 11.6)
    for y in (10.2, 12.4):
        g.rect(8.2, y, 3.8, 0.7, "brown")


def lucky_collar(g):
    """A red collar lit pink, seen as a ring, with a round amber tag hanging under it stamped with a green
    clover."""
    g.ell(7.5, 6.5, 6.3, 4.2, "red", "dred", "pink")
    g.ell(7.5, 6.3, 3.9, 2.2, None)
    g.ell(7.5, 12, 3, 3, "amber", "orange", "yellow")
    s = getattr(g, "s", 1)
    clover = [".1.", "111", ".11"] if s >= 1.2 else ["1"]
    stamp(g, 7.5, 12, clover, {"1": "green"})


def running_shoes(g):
    """A low running shoe side on, the toe to the left: a sky upper rising to the heel, lit cyan along its
    top, white laces, a navy collar, an orange stripe and heel tab, and a white sole on an lgrey outsole."""
    g.tri((1, 11.5), (14.5, 11.5), (13.5, 4.5), "cyan")
    g.tri((2.3, 11.5), (14.5, 11.5), (14, 5.6), "sky")
    g.rect(9.3, 4.6, 4.2, 1.6, "navy")
    g.rect(13.5, 3.8, 1.2, 2.5, "orange")
    g.rect(13.8, 6.2, 0.7, 5.3, "blue")
    for x, y in ((5.5, 8.4), (7.5, 7.0)):
        g.rect(x, y, 1.4, 0.7, "white")
    for x, y in ((3.6, 10.5), (6, 9.7), (8.4, 8.9), (10.8, 8.1)):
        g.rect(x, y, 2.4, 0.7, "orange")
    g.rect(0.8, 11.5, 14.4, 1.6, "white")
    g.rect(1.6, 13.1, 13.2, 0.9, "lgrey")


def whistle(g):
    """A silver sports whistle side on, lit white along its top: a round barrel, its mouthpiece running
    right with an ink slot on top, and from 1.2x two cyan sound lines rising from the slot. The barrel's paw
    stamp is left off: at road size it reads as a face."""
    g.ell(6.5, 10.3, 5.2, 4.7, "lgrey", "grey", "white")
    g.rect(6.5, 6.5, 8.2, 4, "lgrey")
    g.rect(6.5, 6.5, 8.2, 0.7, "white")
    g.rect(6.5, 9.8, 8.2, 0.7, "grey")
    g.rect(14, 6.5, 0.7, 4, "grey")
    g.rect(7.6, 6.5, 2.8, 1, None)
    g.rect(7.6, 7.5, 2.8, 0.8, "dslate")
    if getattr(g, "s", 1) >= 1.2:
        g.rect(8.6, 2, 0.7, 2.6, "cyan")
        for k in range(2):
            g.rect(11.2 + 0.7 * k, 3.9 - 0.7 * k, 0.7, 0.7, "cyan")


# Each drop: its drawing and its sparkle's centre in design units, in the top corner its gear leaves clear.
DROPS = {
    "fanny-pack": (fanny_pack, (13.2, 2.6)),
    "hall-pass": (hall_pass, (13.2, 2.6)),
    "lucky-collar": (lucky_collar, (13.2, 2.6)),
    "running-shoes": (running_shoes, (3, 3.4)),
    "whistle": (whistle, (3, 3.4)),
}


def drop(name, s, big):
    """drop-<name> at scale s (road.SCALE x the step): the gear, lit, then its sparkle, small or big."""
    draw, (cx, cy) = DROPS[name]
    g = edged(Mini(s, 16, 16))
    draw(g)
    road.lit(g)
    sparkle(g, cx, cy, big)
    return g


# ---------- build ----------

def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every drop at full size, then at each step."""
    for suffix, step in (("", 1), *(("@" + k, v) for k, v in STEPS)):
        s = road.SCALE * step
        for name in DROPS:
            yield f"drop-{name}{suffix}", [("idle", [drop(name, s, b).outlined() for b in (0, 1)], IDLE_MS)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/drops", __doc__)
