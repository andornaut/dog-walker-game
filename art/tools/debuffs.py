#!/usr/bin/env python3
"""Draw the four pack-level contact-debuff effects around each member's feet.

fx-debuff-muddy, -spotlight, -stinky and -zoomies are 48x28, with play frames
0 to 11 at 100ms each, played once (1200ms). Frame 4 is the reduced-motion
pose. Each member has one copy: walker and visible dogs, anchored at (24,24)
on (feetX, feetY-1), origin (0.5,6/7). Follow their feet for the whole cue.
Draw above ground shadows and below all actors and leashes (road depth 9.5),
clipped to the road viewport. Nothing floats above a head.

The sparse mud splats, low gas wisps, rushing arcs and pools of light use
the exact face, shade, fill and name colours from ui.DEBUFF_LOOKS, plus
the same ink edge as the bars. No recoloured icon is baked into a sprite.
The one pack-level native 16px HUD icon sits in a 24x24 cream ui-panel beside
the walker's feet, with 4px padding: left=walkerX+48, top=walkerFeetY-28,
or left=walkerX-72 when the right cannot fit the viewport's 4px inset.
The matching sound plays once per pack acquisition, never per member.

Usage:
  debuffs.py preview OUT.png   every frame on the neighbourhood roads
  debuffs.py build             write art/debuffs/*.aseprite and export
                              public/art/sprites/*.png and *.json

Run from the repository root. Edit this script, not the generated sources.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fx import rim  # noqa: E402
from pixel import Grid, main  # noqa: E402
from ui import DEBUFF_LOOKS  # noqa: E402

WIDTH, HEIGHT = 48, 28
FRAME_MS = 100
PEAK = 4
ENVELOPE = (0.56, 0.74, 0.92, 1, 1, 0.98, 0.94, 0.86, 0.74, 0.60, 0.42, 0.22)


def point(step, x, y):
    """Expand around the ground under the feet, never up toward a head."""
    s = ENVELOPE[step]
    return 24 + (x - 24) * s, 22 + (y - 22) * s


def oval(g, step, x, y, rx, ry, fill, shade=None, light=None):
    s = ENVELOPE[step]
    g.cel(*point(step, x, y), max(1.5, rx * s), max(1.5, ry * s), fill, shade, light)


def path(g, step, points, colour, width=2):
    points = [point(step, x, y) for x, y in points]
    for a, b in zip(points, points[1:]):
        n = max(1, math.ceil(max(abs(b[0] - a[0]), abs(b[1] - a[1]))))
        for k in range(n + 1):
            x, y = (a[i] + (b[i] - a[i]) * k / n for i in (0, 1))
            g.rect(round(x - width / 2), round(y - width / 2), width, width, colour)


def part(dst, draw):
    """A thin ink edge, matching the progress bar's edge, keeps low shapes readable."""
    g = Grid(WIDTH, HEIGHT)
    draw(g)
    rim(g, "ink")
    for y, row in enumerate(g.px):
        for x, c in enumerate(row):
            if c:
                dst.px[y][x] = c


def muddy(step):
    """A low mud crown, two squelched patches and heavy drops near the ankles."""
    face, shade, light, _ = DEBUFF_LOOKS["muddy"]
    g = Grid(WIDTH, HEIGHT)
    for x, y, rx, ry in ((8, 22, 6, 3), (39, 22, 6, 3)):
        part(g, lambda p, x=x, y=y, rx=rx, ry=ry: oval(p, step, x, y, rx, ry, face, shade, light))
    spread = (0, 1, 2, 3, 4, 5, 6, 6, 6, 5, 4, 2)[step]
    lift = (0, 2, 4, 5, 5, 4, 3, 2, 0, -1, -1, 0)[step]
    for side in (-1, 1):
        x = 24 + side * (11 + spread)
        y = 17 - lift
        part(g, lambda p, x=x, y=y: oval(p, step, x, y, 3, 4, face, shade, light))
        part(g, lambda p, side=side: path(p, step, [(24 + side * 10, 23),
                                                     (24 + side * 13, 18),
                                                     (24 + side * 16, 22)], face, 3))
    return g


def stinky(step):
    """Low mauve puffs with two broad pink curls rising beside the ankles."""
    face, shade, light, name = DEBUFF_LOOKS["stinky"]
    g = Grid(WIDTH, HEIGHT)
    rise = (0, 1, 2, 3, 4, 5, 5, 6, 6, 6, 5, 3)[step]
    for side in (-1, 1):
        x = 24 + side * 16
        part(g, lambda p, x=x: oval(p, step, x, 22 - rise / 2, 6, 4.5, face, shade, light))
        sway = (0, 0, 1, 2, 2, 1, 0, -1, -1, 0, 0, 0)[step] * side
        pts = [(x, 21), (x + side * 3, 16 - rise / 2),
               (x - side * 1 + sway, 12 - rise / 2), (x + side * 2 + sway, 8 - rise / 2)]
        part(g, lambda p, pts=pts: path(p, step, pts, light))
        if 2 <= step <= 7:
            part(g, lambda p, x=x, side=side: path(p, step, [(x - side * 2, 19), (x - side * 3, 17)], name))
    return g


def zoomies(step):
    """Green rushing arcs and yellow tips sweep once round the feet, with open space between."""
    face, shade, light, _ = DEBUFF_LOOKS["zoomies"]
    g = Grid(WIDTH, HEIGHT)
    turn = -35 + step * 19
    for offset in (0, 180):
        angles = range(round(turn + offset), round(turn + offset + 82), 6)
        pts = [(24 + math.cos(math.radians(a)) * 20, 19 + math.sin(math.radians(a)) * 5) for a in angles]
        part(g, lambda p, pts=pts: path(p, step, pts, shade, 4))
        part(g, lambda p, pts=pts: path(p, step, [(x, y - 1) for x, y in pts], face, 3))
        part(g, lambda p, pts=pts: path(p, step, pts[-3:], light, 2))
    for side in (-1, 1):
        x = 24 + side * 15
        part(g, lambda p, x=x, side=side: path(p, step, [(x - side * 3, 12), (x + side * 4, 12)], light))
    return g


def spotlight(step):
    """A blue pool edged in yellow, with two restrained white light marks at the rim."""
    face, shade, light, name = DEBUFF_LOOKS["spotlight"]
    g = Grid(WIDTH, HEIGHT)

    def pool(p):
        oval(p, step, 24, 21, 21, 5.5, face, shade)
        oval(p, step, 24, 20, 17, 3.5, light)
        oval(p, step, 24, 19.5, 12, 1.8, face)
    part(g, pool)
    slide = (0, 2, 4, 6, 7, 7, 6, 4, 2, 0, -1, 0)[step]
    for side in (-1, 1):
        x = 24 + side * (12 + slide / 2)
        part(g, lambda p, x=x, side=side: path(p, step, [(x, 16), (x + side * 2, 11)], name, 2))
    return g


DEBUFFS = {"muddy": muddy, "spotlight": spotlight, "stinky": stinky, "zoomies": zoomies}


def sprites():
    for name, draw in DEBUFFS.items():
        yield f"fx-debuff-{name}", [("play", [draw(i).outlined(False) for i in range(len(ENVELOPE))], FRAME_MS)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/debuffs", __doc__)
