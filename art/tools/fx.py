#!/usr/bin/env python3
"""Draw the road effects for collisions and pickups, and the new-best burst on
the end screen. The bumps, debris and fx-sparkle are light, warm or small, and
would fade into the three light roads, so each carries a 1px plum rim (4.4:1 or
more on those); fx-splash and fx-splunk carry a navy one. fx-new-best carries the plum rim
too, for the cream panel and the sunset sky of screen-end. The pack is always
drawn at full size, so the hit effects have no depth variants.

fx-bump          48x48  play (6 frames, 50ms)  impact star where a dog hits a standing
                                               obstacle, white impact lines in its gaps,
                                               shrinking away; centred on the contact
fx-bump-big      64x64  play (7 frames, 50ms)  a mover's impact: a four-layer star in a
                                               ring of radial motion lines, shrinking away;
                                               centred on the contact
fx-debris-leaves 48x48  play (6 frames, 70ms)  leaves and a twig knocked out of a hedge,
                                               fluttering down; centred on the contact
fx-debris-litter 48x48  play (6 frames, 70ms)  paper, a can and a banana peel thrown out
                                               of a trash can; centred on the contact
fx-splash        64x48  play (8 frames, 60ms)  a puddle: a crown of five water jets rising
                                               from the feet, three drops thrown off it and
                                               one ripple; its ground point, row 40, goes on
                                               the dog's feet
fx-splunk        64x48  play (8 frames, 60ms)  a pothole: a thick column of water jumping up
                                               from the feet between two low side sheets, a
                                               drop falling off its top, four asphalt chips
                                               tumbling out and one ripple; its ground point
                                               is fx-splash's, row 40; the comic word's ring
                                               sits at 10,1 (SPLUNK!, 43 wide), above the
                                               column's top
fx-sparkle       16x16  play (4 frames, 60ms)  twinkle where a treat or tip is collected
fx-new-best      96x48  play (8 frames, 70ms)  rays, sparkles and stars in yellow, amber and
                                               white bursting from behind the ui-new-best
                                               ribbon (centred on it), each part in its own rim

The comic lettering (LETTERS, word), which fonts.py exports as font-comic, is built like the
sign logo: flat yellow letters, 7 rows with 2px stems, in a 1px ink ring that fills the
counters and the gaps between letters, on a solid dred shadow 2px down and right. Display
words only, 2 to 7 letters.

Usage:
  fx.py preview OUT.png   every frame of every effect on the zone roads
  fx.py build             write art/fx/*.aseprite and export to
                          public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import Grid, main  # noqa: E402


def rim(g, col="plum"):
    """Ring the shape with a 1px outline in one colour, in place: plum holds 6.5:1 on the tan road,
    5.0:1 on the pink and 4.4:1 on skin2, and the fill inside it carries the dslate road."""
    edge = [(x, y) for y in range(g.h) for x in range(g.w) if not g.px[y][x] and any(
        0 <= x + dx < g.w and 0 <= y + dy < g.h and g.px[y + dy][x + dx]
        for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)))]
    for x, y in edge:
        g.p(x, y, col)
    return g


def star4(g, cx, cy, r, col):
    """A four-point twinkle: a plus with arms r long and a white centre."""
    for k in range(-r, r + 1):
        g.p(cx + k, cy, col)
        g.p(cx, cy + k, col)
    if r >= 3:
        g.rect(cx - 1, cy - 1, 3, 3, col)
    g.p(cx, cy, "white")


def burst(g, cx, cy, r_out, r_in, points, col, turn=0.0):
    pts = []
    for i in range(points * 2):
        a = math.radians(i * 180 / points + turn - 90)
        r = r_out if i % 2 == 0 else r_in
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    for i in range(len(pts)):
        g.tri((cx, cy), pts[i], pts[(i + 1) % len(pts)], col)


# The comic words' letters, 7 rows with 2px stems, so they read at 1x inside their ink ring.
LETTERS = {
    "A": [".###.", "##.##", "##.##", "#####", "##.##", "##.##", "##.##"],
    "B": ["####.", "##.##", "##.##", "####.", "##.##", "##.##", "####."],
    "C": [".####", "##...", "##...", "##...", "##...", "##...", ".####"],
    "D": ["####.", "##.##", "##.##", "##.##", "##.##", "##.##", "####."],
    "E": ["#####", "##...", "##...", "####.", "##...", "##...", "#####"],
    "F": ["#####", "##...", "##...", "####.", "##...", "##...", "##..."],
    "G": [".####", "##...", "##...", "##.##", "##.##", "##.##", ".####"],
    "H": ["##.##", "##.##", "##.##", "#####", "##.##", "##.##", "##.##"],
    "I": ["##", "##", "##", "##", "##", "##", "##"],
    "J": ["...##", "...##", "...##", "...##", "...##", "##.##", ".###."],
    "K": ["##.##", "##.##", "####.", "###..", "####.", "##.##", "##.##"],
    "L": ["##...", "##...", "##...", "##...", "##...", "##...", "#####"],
    "M": ["##...##", "###.###", "#######", "##.#.##", "##...##", "##...##", "##...##"],
    "N": ["##..##", "###.##", "######", "##.###", "##..##", "##..##", "##..##"],
    "O": [".###.", "##.##", "##.##", "##.##", "##.##", "##.##", ".###."],
    "P": ["####.", "##.##", "##.##", "####.", "##...", "##...", "##..."],
    "Q": [".###..", "##.##.", "##.##.", "##.##.", "##.##.", "##.##.", ".#####"],
    "R": ["####.", "##.##", "##.##", "####.", "##.##", "##.##", "##.##"],
    "S": [".####", "##...", "##...", ".###.", "...##", "...##", "####."],
    "T": ["######", "..##..", "..##..", "..##..", "..##..", "..##..", "..##.."],
    "U": ["##.##", "##.##", "##.##", "##.##", "##.##", "##.##", ".###."],
    "V": ["##..##", "##..##", "##..##", "##..##", "##..##", ".####.", "..##.."],
    "W": ["##...##", "##...##", "##...##", "##.#.##", "#######", "###.###", "##...##"],
    "X": ["##..##", "##..##", ".####.", "..##..", ".####.", "##..##", "##..##"],
    "Y": ["##..##", "##..##", "##..##", ".####.", "..##..", "..##..", "..##.."],
    "Z": ["######", "....##", "...##.", "..##..", ".##...", "##....", "######"],
    "!": ["##", "##", "##", "##", "..", "##", "##"],
    "?": [".###.", "##.##", "...##", "..##.", ".....", "..##.", "..##."],
    "-": ["...", "...", "...", "###", "...", "...", "..."],
}


def word_size(text):
    """The width and height of text's lettering: its letters 1px apart, the ink ring and the 2px shadow."""
    return sum(len(LETTERS[ch][0]) for ch in text) + len(text) - 1 + 4, 11


def word(g, text, cx, top, fill="yellow"):
    """A comic word built like the sign logo: flat letters (yellow, or cream) in a 1px ink ring that also
    fills the counters and the gaps between letters, on a solid dred shadow offset 2px down and right.
    Centred on column cx, the ring's top on row top."""
    w, _ = word_size(text)
    x, letters = round(cx - w / 2) + 1, set()
    for ch in text:
        for j, row in enumerate(LETTERS[ch]):
            letters |= {(x + i, top + 1 + j) for i, c in enumerate(row) if c == "#"}
        x += len(LETTERS[ch][0]) + 1
    halo = {(x + dx, y + dy) for x, y in letters for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
    shadow = {(x + d, y + d) for x, y in halo for d in (1, 2)} - halo
    for pts, col in ((shadow, "dred"), (halo - letters, "ink"), (letters, fill)):
        for x, y in pts:
            g.p(x, y, col)
    return g


def line(g, x0, y0, x1, y1, col):
    """A 1px line from (x0, y0) to (x1, y1)."""
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(int(round(n)) + 1):
        g.p(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), col)


def rays(g, cx, cy, r0, r1, count, col, turn=0.0):
    """count straight lines from radius r0 to r1 round (cx, cy): the comic impact lines."""
    for i in range(count):
        a = math.radians(i * 360 / count + turn - 90)
        line(g, cx + math.cos(a) * r0, cy + math.sin(a) * r0, cx + math.cos(a) * r1, cy + math.sin(a) * r1, col)


def bump(step):
    """48x48, centred on the contact point: a white pip, the full amber star with white impact lines in its
    gaps, a hotter orange star, then the star shrinking away, so it ends without a scatter of specks."""
    g = Grid(48, 48)
    c = 24
    if step == 0:
        burst(g, c, c, 11, 4, 4, "white")
        rays(g, c, c, 14, 18, 4, "white", 45)
    elif step in (1, 2):
        burst(g, c, c, 20 + step, 8, 8, ("amber", "orange")[step - 1], 11)
        burst(g, c, c, 14 + step, 6, 8, "yellow", 11)
        g.ell(c, c, 6 - step, 6 - step, ("white", "amber")[step - 1])
        if step == 1:
            rays(g, c, c, 15, 22, 8, "white", 33.5)
    else:
        r = (12, 8, 5)[step - 3]
        burst(g, c, c, r, r * 0.45, 8, ("amber", "yellow", "yellow")[step - 3], 11)
        g.ell(c, c, max(1, r * 0.25), max(1, r * 0.25), "white")
    return g


def bump_big(step):
    """64x64, centred on the contact point, for a mover: a white star inside a ring of impact lines, a
    four-layer star (orange, amber, yellow, white core) with the lines thrown wide, then the star
    shrinking away."""
    g = Grid(64, 64)
    c = 32
    if step == 0:
        burst(g, c, c, 14, 5, 8, "white", 11)
        rays(g, c, c, 18, 25, 16, "white", 5)
    elif step in (1, 2):
        turn = 11 + 9 * (step - 1)
        burst(g, c, c, 29, 12, 10, ("orange", "red")[step - 1], turn)
        burst(g, c, c, 23, 9, 10, "amber", turn)
        burst(g, c, c, 16, 6, 10, "yellow", turn)
        g.ell(c, c, 6 - step, 6 - step, "white")
        rays(g, c, c, (25, 28)[step - 1], 31, 16, "white", 5)
    else:
        r = (20, 14, 9, 5)[step - 3]
        burst(g, c, c, r, r * 0.42, 10, ("amber", "amber", "yellow", "yellow")[step - 3], 20)
        g.ell(c, c, max(1, r * 0.22), max(1, r * 0.22), "white")
    return g


def ripple(g, cx, cy, rx, ry, col):
    """A ripple ring about 2px thick around (cx, cy)."""
    for y in range(g.h):
        for x in range(g.w):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            if (dx / rx) ** 2 + (dy / ry) ** 2 <= 1 and (dx / (rx - 2)) ** 2 + (dy / (ry - 1.2)) ** 2 > 1:
                g.p(x, y, col)


def jet(g, x0, y0, x1, y1, w0, w1, col):
    """A jet of water from (x0, y0) to (x1, y1), w0 thick at its foot tapering to w1 at its tip."""
    for k in range(17):
        t = k / 16
        r = w0 + (w1 - w0) * t
        g.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, col)


# The splash's crown: five jets of water fanning out from the feet (base dx, tip dx, tip height) at full
# height, and the crown's height by frame: it rises over 3 frames and sinks over 3.
SPLASH_JETS = ((-7, -22, -9), (-3, -11, -18), (0, 0, -23), (3, 11, -18), (7, 22, -9))
SPLASH_HEIGHT = (0.45, 0.85, 1.0, 0.8, 0.55, 0.3, 0, 0)
# The splash's ground point, where the dog's feet meet the water: the frame's centre column, row 40.
SPLASH_GROUND = (32, 40)


def splash(step):
    """64x48, its ground point 8px above the frame's bottom: a crown of five cyan jets tapering from a pool
    of water at the feet, rising and sinking; three round drops thrown off the middle jets' tips, rising
    and falling, each with a white glint; and one ripple spreading from frame 3. One cyan, a navy outline,
    no specks, so it reads at a glance."""
    g = Grid(64, 48)
    cx, gy = SPLASH_GROUND
    if step >= 3:
        k = (step - 2) / 5
        ripple(g, cx, gy, 14 + 15 * k, 3.5 + 2.5 * k, "cyan" if step < 6 else "sky")
    h = SPLASH_HEIGHT[step]
    if h:
        g.ell(cx, gy, 9 + 4 * h, 3, "cyan")
        for bx, tx, ty in SPLASH_JETS:
            jet(g, cx + bx, gy, cx + bx + (tx - bx) * h, gy + ty * h, 2.8, 1.2, "cyan")
    if 1 <= step <= 6:
        t = step - 1
        for bx, tx, ty in SPLASH_JETS[1:4]:
            x = cx + tx * (0.9 + 0.12 * t) + (tx / 22) * 2 * t
            y = gy + ty - 3 - 2.5 * t + 1.6 * t * t
            if y < gy - 2:
                g.ell(x, y, 2, 2, "cyan")
                g.p(round(x - 0.5), round(y - 0.5), "white")
    return g


# The splunk's column of water and its two side sheets (base dx, tip dx, tip height, foot and tip radius) at full
# height, and its height by frame: it jumps up over 3 frames and slumps back over 3.
SPLUNK_JETS = ((0, 0, -22, 5, 3.5), (-6, -17, -9, 3.5, 1.5), (6, 17, -9, 3.5, 1.5))
SPLUNK_HEIGHT = (0.5, 0.9, 1.0, 0.75, 0.45, 0.2, 0, 0)
# The asphalt chips thrown out of the pothole from frame 1: each (dx, dy) a frame from beside the column's foot,
# falling SPLUNK_FALL faster each frame, so they peak on frame 3 and land on frame 6 or 7.
SPLUNK_CHIPS = ((-4.4, -8.0), (-2.6, -9.4), (2.8, -9.0), (4.6, -7.6))
SPLUNK_FALL = 3


def chip(g, x, y, turn):
    """A 4x3 chip of asphalt, lgrey lit from the top left and grey along its lower right; turn flips it as it
    tumbles."""
    if turn:
        g.rect(x + 1, y, 3, 1, "lgrey")
        g.rect(x, y + 1, 3, 1, "lgrey")
        g.rect(x + 3, y + 1, 1, 1, "grey")
        g.rect(x, y + 2, 3, 1, "grey")
    else:
        g.rect(x, y, 3, 1, "lgrey")
        g.rect(x, y + 1, 4, 1, "lgrey")
        g.rect(x + 1, y + 2, 3, 1, "grey")


def splunk(step):
    """64x48, its ground point where fx-splash's is: a pothole's splunk. A thick column of sky water jumps up from
    a pool at the feet between two low side sheets, each with a cyan core lit from the top left, then slumps back,
    a drop with a white glint falling off the column's top; four asphalt chips tumble out and down either side
    from frame 1; one ripple spreads from frame 3. A navy outline, no specks."""
    g = Grid(64, 48)
    cx, gy = SPLASH_GROUND
    if step >= 3:
        k = (step - 2) / 5
        ripple(g, cx, gy, 14 + 15 * k, 3.5 + 2.5 * k, "sky")
    h = SPLUNK_HEIGHT[step]
    if h:
        g.ell(cx, gy, 10 + 4 * h, 3, "sky")
        for bx, tx, ty, r0, r1 in SPLUNK_JETS:
            jet(g, cx + bx, gy, cx + bx + (tx - bx) * h, gy + ty * h, r0, r1, "sky")
        for bx, tx, ty, r0, r1 in SPLUNK_JETS:
            jet(g, cx + bx - 1, gy - 1, cx + bx - 1 + (tx - bx) * h, gy + ty * h, r0 - 2, max(0.8, r1 - 1.5), "cyan")
    if 3 <= step <= 6:
        t = step - 3
        y = gy - 22 - 5 + 3 * t * t
        if y < gy - 4:
            g.ell(cx + t, y, 2.5, 2.5, "sky")
            g.p(round(cx + t - 1), round(y - 1), "white")
    t = step
    for i, (vx, vy) in enumerate(SPLUNK_CHIPS):
        x, y = round(cx - 2 + (3 if vx > 0 else -3) + vx * t), round(gy - 6 + vy * t + SPLUNK_FALL * t * t / 2)
        if t and y <= gy - 3:
            chip(g, x, y, (i + step) % 2)
    return g


def leaf(g, x, y, flip, col="dgreen", lit="green"):
    """A 4x3 leaf (3x4 when flip) with clipped corners and a lit tip."""
    w, h = (3, 4) if flip else (4, 3)
    x, y = round(x), round(y)
    g.rect(x, y, w, h, col)
    g.p(x + w - 1, y, None)
    g.p(x, y + h - 1, None)
    g.p(x + 1, y + 1, lit)


# Leaves knocked out of a hedge (dx, dy per frame), the frame's centre on the contact point.
LEAVES = ((-6, -5), (-3.5, -7), (-1, -6), (2, -7.5), (4.5, -5.5), (7, -3), (-7.5, -2), (5.5, -1), (0.5, -3))


def debris_leaves(step):
    """48x48, centred on the contact point: leaves knocked out of a hedge, flung up and out, then
    fluttering down as they turn, with a twig."""
    g = Grid(48, 48)
    t = step + 1
    for i, (vx, vy) in enumerate(LEAVES):
        drag = (1 - 0.72 ** t) / 0.28
        x, y = 24 + vx * drag, 24 + vy * drag + 0.5 * t * t
        flip = (i + step) % 2 == 1
        leaf(g, x, y, flip, ("dgreen", "green", "forest")[i % 3], ("green", "yellow", "dgreen")[i % 3])
    a = math.radians(step * 50)
    x, y = 24 + 3 * t, 24 - 4 * t + 0.9 * t * t
    line(g, x - 2 * math.cos(a), y - 2 * math.sin(a), x + 2 * math.cos(a), y + 2 * math.sin(a), "dbrown")
    return g


def debris_litter(step):
    """48x48, centred on the contact point: litter thrown out of a trash can, arcing up and falling, each piece
    turning as it goes: two paper balls, a crumpled sheet, a can and a banana peel."""
    g = Grid(48, 48)
    t = step + 1
    for i, (vx, vy) in enumerate(((-5.5, -6.5), (-2, -8), (2.5, -7.5), (5.5, -6), (0.5, -5))):
        x, y = round(22 + vx * t), round(20 + vy * t + 1.5 * t * t)
        turn = (i + step) % 2
        if i in (0, 3):  # paper ball
            g.rect(x, y, 4, 4, "cream")
            g.p(x + 3 * turn, y, None)
            g.p(x + 3 - 3 * turn, y + 3, None)
            g.p(x + 1, y + 1, "white")
            g.p(x + 2, y + 2, "tan")
        elif i == 1:  # crumpled sheet
            g.rect(x, y, 5 - turn, 3 + turn, "white")
            g.p(x + 1, y + 1, "lgrey")
            g.p(x + 3 - turn, y + 1 + turn, "lgrey")
        elif i == 2:  # can
            w, h = (5, 3) if turn else (3, 5)
            g.rect(x, y, w, h, "red")
            g.rect(x, y, 1 if turn else 3, 3 if turn else 1, "lgrey")
            g.p(x + (2 if turn else 1), y + (1 if turn else 2), "white")
        else:  # banana peel
            g.rect(x + 1, y + 1, 3, 2, "yellow")
            g.p(x, y + 3 * turn, "yellow")
            g.p(x + 4, y + 3 * turn, "yellow")
            g.p(x + 2, y + 3 - 3 * turn, "amber")
    return g


def sparkle(step):
    g = Grid(16, 16)
    r = (2, 5, 3, 1)[step]
    star4(g, 8, 8, r, ("white", "yellow", "amber", "yellow")[step])
    if step in (1, 2):
        for dx, dy in ((-5, -5), (5, -4), (-4, 5), (5, 5)):
            g.p(8 + dx * (step / 1.5), 8 + dy * (step / 1.5), "white" if step == 1 else "yellow")
    return g


HEART = [".111.111.", "122111111", "121111113", "111111113", ".1111113.", "..11113..", "...113...", "....1...."]
SMALL = [".11.11.", "1211111", "1111113", ".11113.", "..113..", "...1..."]


def stamp(g, rows, x0, y0, cols=("red", "pink", "dred"), keep=None):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != "." and (keep is None or keep(x, y)):
                g.p(x0 + x, y0 + y, cols["123".index(ch)])


# fx-new-best is centred on the 72x20 ui-new-best ribbon, whose top-left sits at RIBBON in the frame.
RIBBON = (12, 14)
# Sparkles thrown out from behind the ribbon, slowing as they go: (x, y on the ribbon's edge, full
# throw dx, dy, first frame, colour). They keep inside the frame's bands above, below and beside it.
SPARKS = ((20, 14, -6, -9, 0, "white"), (40, 14, -3, -10, 1, "yellow"), (58, 14, 4, -11, 0, "white"),
          (26, 34, -6, 9, 1, "yellow"), (50, 34, 1, 10, 0, "white"), (12, 21, -10, -5, 0, "yellow"),
          (84, 20, 10, -6, 1, "white"), (12, 30, -9, 6, 2, "white"), (84, 30, 10, 5, 0, "yellow"))
# Stars that pop out over the ribbon's edges and arc out under a little gravity: (x, y, dx, dy per frame,
# first frame).
STARS = ((30, 14, -2, -2.6, 0), (66, 14, 2.2, -2.8, 1), (48, 14, 0.3, -2.4, 3), (24, 34, -2.4, 1, 1),
         (72, 34, 2.4, 0.8, 2))


def over(dst, src):
    """Rim src on its own and lay it over dst, so overlapping parts keep their outlines apart."""
    rim(src)
    for y, row in enumerate(src.px):
        for x, c in enumerate(row):
            if c:
                dst.px[y][x] = c


def new_best(step):
    """96x48: a starburst behind the new-best ribbon, rays first, then sparkles and stars popping out
    and fading, in yellow, amber and white only. Each part carries its own plum rim, for the cream panel and
    the yellow end of the sunset, laid over the ones behind it, and the ribbon's own area is left clear so
    the burst comes from behind it."""
    g = Grid(96, 48)
    cx, cy = 48, 24
    if step < 4:
        # rays that slide outward, stretched across so they clear the wide ribbon
        r0, r1 = (6, 11, 17, 23)[step], (15, 21, 25, 27)[step]
        part = Grid(96, 48)
        for i in range(12):
            a = math.radians(i * 30 + 15)
            for k in range(r0 * 2, r1 * 2):
                part.p(cx + math.cos(a) * k * 0.85, cy + math.sin(a) * k / 2, "white" if step == 0 else "yellow")
        over(g, part)
    for x, y, dx, dy, first, col in SPARKS:
        t = step - first
        if 0 <= t < 5:
            k = 1 - 0.5 ** (t + 1)
            part = Grid(96, 48)
            star4(part, round(x + dx * k), round(y + dy * k), (2, 3, 3, 2, 2)[t], col)
            over(g, part)
    for x, y, dx, dy, first in STARS:
        t = step - first
        if 0 <= t < 5:
            x, y, r = x + dx * (t + 1), y + dy * (t + 1) + 0.3 * t * t, (4, 5, 5, 4, 3)[t]
            part = Grid(96, 48)
            burst(part, x, y, r, r * 0.45, 5, "amber")
            if r > 3:
                burst(part, x, y, r - 2, (r - 2) * 0.45, 5, "yellow")
                part.p(x, y, "white")
            over(g, part)
    rx, ry = RIBBON
    g.rect(rx + 5, ry + 1, 62, 17, None)
    g.rect(rx, ry + 3, 72, 15, None)
    return g


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    yield "fx-bump", [("play", [rim(bump(i)).outlined(False) for i in range(6)], 50)]
    yield "fx-bump-big", [("play", [rim(bump_big(i)).outlined(False) for i in range(7)], 50)]
    yield "fx-debris-leaves", [("play", [rim(debris_leaves(i)).outlined(False) for i in range(6)], 70)]
    yield "fx-debris-litter", [("play", [rim(debris_litter(i)).outlined(False) for i in range(6)], 70)]
    yield "fx-splash", [("play", [rim(splash(i), "navy").outlined(False) for i in range(8)], 60)]
    yield "fx-splunk", [("play", [rim(splunk(i), "navy").outlined(False) for i in range(8)], 60)]
    yield "fx-sparkle", [("play", [rim(sparkle(i)).outlined(False) for i in range(4)], 60)]
    yield "fx-new-best", [("play", [new_best(i).outlined(False) for i in range(8)], 70)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/fx", __doc__)
