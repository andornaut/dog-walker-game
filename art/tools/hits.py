#!/usr/bin/env python3
"""Draw the encounter hit moments: a burst over the pack per encounter, the
screen-edge flash in the encounter's colour, the plate behind the big label,
and the per-dog status overlays. Bursts carry a 1px rim (plum, navy for water,
teal for the skunk's green) so they hold 3:1 on the three light roads while
their fills carry Woof Way. The flash strips pair a light ink with a dark
fringe for the same reason.

fx-hit-skunk       64x64  play (8 frames, 70ms)  green spray cloud and stink squiggles
fx-hit-puddle      64x64  play (7 frames, 70ms)  splash crown and flying drops
fx-hit-thief       64x64  play (8 frames, 70ms)  coins and a wallet flying up out of a poof
fx-hit-squirrel    64x64  play (7 frames, 70ms)  tail-flick sweep, motion lines, leaves
fx-hit-other-dog   64x64  play (8 frames, 70ms)  tangle cloud, fur tufts and hearts
ui-hit-flash-green, -sky, -amber, -orange, -pink
                   16x64  play (4 frames, 70ms)  left screen-edge strip, solid at x=0,
                          4x4 ordered dither to clear by x=15; tiles vertically, the
                          game mirrors it for the right edge
ui-hit-label       24x24  normal (1 frame)       nine-slice, 8px corners: a dred plate in
                          a yellow band with corner spikes, stretched to 176x32 for every
                          label; white font-title text at 2x, centred, its line top 3px
                          below the plate's top so the 10px caps sit in rows 11 to 20
fx-status-stinky   16x16  loop (4 frames, 180ms) green stink lines rising over a dog's head
fx-status-soaked   16x16  loop (4 frames, 150ms) drips falling off
fx-status-spooked  16x16  loop (4 frames, 150ms) sweat drop popping, surprise lines
                   each status also has @75 (12x12) and @50 (8x8), same tags and timing;
                   bottom-centre on the dog's centre column, 6px (4px at @75, 3px at
                   @50) below the dog's top opaque row, so the lower rows overlap the head

Usage:
  hits.py preview OUT.png   every frame of every piece on the four road colours
  hits.py build             write art/hits/*.aseprite, export to public/art/sprites/
                            and list them in the manifest

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py,
the rim, burst, twinkle and heart helpers in fx.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fx import HEART, SMALL, burst, rim, stamp, star4  # noqa: E402
from pixel import Grid, main  # noqa: E402

BAYER = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))
# A sideways wobble with an 8px period: a line rising 2px a frame loops seamlessly in 4 frames.
WAVE = (0, 1, 1, 1, 0, -1, -1, -1)
ROADS = ("3a4466", "e4a672", "c0cbdc", "c28569")


def layer(dst, src):
    """Copy src's opaque pixels over dst."""
    for y, row in enumerate(src.px):
        for x, c in enumerate(row):
            if c:
                dst.px[y][x] = c
    return dst


def piece(dst, draw, col="plum", size=64):
    """Draw one part on its own grid, rim it and lay it over dst, so overlapping parts stay apart."""
    g = Grid(size, size)
    draw(g)
    return layer(dst, rim(g, col))


def impact(g, outer, cx=32, cy=32, r=16):
    """Frame 0 of every burst: an eight-point star in the encounter's colour with a white core."""
    burst(g, cx, cy, r, r * 0.4, 8, outer, 11)
    burst(g, cx, cy, r * 0.62, r * 0.25, 8, "yellow", 11)
    g.ell(cx, cy, r * 0.25, r * 0.25, "white")


# ---------- hit bursts ----------

def hit_skunk(step):
    """The cloud swells in seven lobes, then the lobes drift apart and shrink. Stink squiggles rise
    out of it, green with a teal side, so they read over the cloud and on every road."""
    g = Grid(64, 64)
    if step == 0:
        impact(g, "green")
        return rim(g, "teal")
    d = (0, 6, 10, 13, 16, 19, 22, 25)[step]
    r = (0, 7, 9, 10, 9, 7, 5, 3)[step]
    core = (0, 9, 12, 13, 10, 5, 0, 0)[step]
    for k in range(7):
        a = math.radians(k * 360 / 7 + 20 + step * 4)
        rk = r * (1 + 0.15 * (k % 3 - 1))
        g.ell(32 + math.cos(a) * d, 33 + math.sin(a) * d * 0.9, rk, rk, "green")
    if core:
        g.ell(32, 33, core, core, "green")
    # shade the lower-right edge of the whole cloud, so overlapping lobes read as one mass
    lit = [row[:] for row in g.px]
    for y in range(62):
        for x in range(62):
            if lit[y][x] and not (lit[y + 1][x + 1] and lit[y + 2][x + 2]):
                g.p(x, y, "dgreen")
    if 1 <= step < 4:
        g.ell(32 - core * 0.35, 33 - core * 0.4, core * 0.3, core * 0.2, "yellow")
        g.ell(32 - core * 0.3, 33 - core * 0.3, core * 0.3, core * 0.2, "green")
    rim(g, "teal")
    if step >= 1:
        # five rising S-lines: 2px a frame up over an 8px wave, the outer ones leaning out
        rise = (0, 0, 4, 8, 12, 15, 18, 20)[step]
        length = (0, 5, 8, 9, 9, 8, 6, 4)[step]
        for j, (x0, y0, lean) in enumerate(((14, 26, -1), (22, 20, -0.5), (32, 17, 0), (42, 20, 0.5), (50, 26, 1))):
            for t in range(length):
                y = y0 - rise - t
                x = x0 + lean * (rise + t) * 0.4 + WAVE[(t + j * 3 + step * 2) % 8]
                if 1 <= y < 63:
                    g.p(round(x), y, "green")
                    g.p(round(x) + 1, y, "teal")
    return g


def hit_puddle(step):
    """A crown of water rises from a ring, throws drops off its points and falls back to a ripple."""
    g = Grid(64, 64)
    cx, cy = 32, 46
    if step == 0:
        g.ell(cx, cy, 14, 4, "sky", "blue", "cyan")
        impact(g, "cyan", cx, cy - 6, 13)
        return rim(g, "navy")
    h = (0, 10, 18, 22, 15, 7, 0)[step]
    rx = (0, 11, 14, 16, 18, 19, 21)[step]
    ry = rx * 0.32
    spikes = []
    for k in range(10):
        a = math.radians(k * 36 + 9)
        bx, by = cx + rx * math.cos(a), cy + ry * math.sin(a)
        hk = h * (0.7 + 0.3 * ((k * 7) % 4) / 3)
        tip = (cx + (rx + h * 0.3) * math.cos(a), by - hk)
        spikes.append((math.sin(a), bx, by, tip))
    if h:
        for s, bx, by, tip in spikes:
            if s < 0:
                g.tri((bx - 3, by + 1), (bx + 3, by + 1), tip, "blue")
    g.ell(cx, cy, rx + 1, ry + 1.5, "sky", "blue")
    g.ell(cx, cy - 0.5, max(rx - 3, 1), max(ry - 1.5, 1), "blue")
    if step == 6:
        g.ell(cx, cy, rx - 4, ry - 2, None)
    if h:
        for s, bx, by, tip in spikes:
            if s >= 0:
                g.tri((bx - 3, by + 1), (bx + 3, by + 1), tip, "sky")
                g.tri((bx - 2, by), (bx, by), (tip[0] - 0.5, tip[1] + 2), "cyan")
                g.p(tip[0], tip[1] + 0.5, "white")
    if 2 <= step <= 4:
        jy = cy - (0, 0, 16, 26, 30)[step]
        g.ell(cx, jy, 2, 3, "cyan", "sky")
        g.p(cx - 1, jy - 1, "white")
    if step >= 2:
        t = step - 1.5
        for vx, vy in ((-7, -6), (-5, -9), (-2, -11), (2, -10), (5, -8), (7, -5), (-9, -3), (9, -2)):
            x, y = cx + vx * t * 0.75, cy - 16 + vy * t + 1.7 * t * t
            if 2 <= x < 61 and 2 <= y < 61:
                g.rect(x, y, 2, 2 if step < 5 else 1, "cyan" if step < 5 else "sky")
                if step < 4:
                    g.p(x, y, "white")
    return rim(g, "navy")


def wallet(g, cx, cy, tilt):
    """12x8 brown wallet, its flap seam dbrown, a green bill poking out; tilt shears it by a pixel."""
    for j in range(8):
        sx = round(tilt * (j - 4) / 4)
        g.rect(cx - 6 + sx, cy - 4 + j, 12, 1, "dbrown" if j == 7 else "brown")
    g.rect(cx - 4 - tilt, cy - 6, 8, 2, "green")
    g.p(cx - 3 - tilt, cy - 6, "yellow")
    g.rect(cx - 6, cy - 1, 12, 1, "dbrown")
    g.rect(cx + 2, cy - 1, 3, 2, "amber")
    g.p(cx - 5 - round(tilt * 0.75), cy - 3, "tan")


def coin(g, x, y, spin):
    rx = (3, 2, 0.8, 2)[spin % 4]
    g.ell(x, y, rx + 0.5, 3.5, "amber", "orange", "yellow")
    if spin % 4 != 2:
        g.p(x - 1, y - 1, "white")


def hit_thief(step):
    """A dust poof; the wallet shoots straight up out of it while six coins fan out and fall."""
    g = Grid(64, 64)
    cx, cy = 32, 40
    if step == 0:
        impact(g, "amber", cx, cy)
        return rim(g)
    pr = (0, 10, 13, 14, 0, 0, 0, 0)[step]
    if pr:
        piece(g, lambda p: [p.ell(cx + dx * pr / 12, cy + dy * pr / 12, pr * 0.55, pr * 0.5, "white", "lgrey")
                            for dx, dy in ((-7, 2), (7, 2), (0, -5), (0, 5), (-4, -3), (4, -3))])
    elif step < 6:
        def puffs(p):
            for k in range(6):
                a = math.radians(k * 60 + 30)
                d = 14 + (step - 4) * 4
                p.ell(cx + math.cos(a) * d, cy + math.sin(a) * d * 0.6, 3 - (step - 4), 2.5 - (step - 4) * 0.8,
                      "white", "lgrey")
        piece(g, puffs)
    wy = (0, 32, 23, 17, 14, 13, 13, 14)[step]
    tilt = (0, 0, 1, 0, -1, 0, 1, 0)[step]
    t = step - 0.5
    for i, (vx, vy) in enumerate(((-9, -5), (-6, -8), (-2.5, -9), (2.5, -9.5), (6, -8), (9, -5.5))):
        x, y = cx + vx * t * 0.85, cy - 4 + vy * t * 0.85 + 1.2 * t * t
        if 3 <= y < 60 and 3 <= x < 61:
            piece(g, lambda p: coin(p, x, y, step + i))
    piece(g, lambda p: wallet(p, cx, wy, tilt))
    if step in (3, 5):
        piece(g, lambda p: star4(p, cx + (9 if step == 3 else -10), wy - 3, 2, "yellow"))
    return g


TAIL = ("ochre", "rust", "tan")


def tail(g, theta, cx=32, cy=40, rad=14):
    """A bushy plume along an arc starting at angle theta, curling in at the tip: thin at the base,
    then an even width with fur bumps on both sides and a tan stripe along its inner side."""
    pts, ang, rr = [], theta, rad
    for i in range(14):
        a = math.radians(ang)
        r = min(4.5, 1.5 + i * 0.6)
        x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        pts.append((x, y, r, a))
        g.ell(x, y, r, r, *TAIL)
        if i > 3 and i % 2 == 0:
            side = 1 if i % 4 == 0 else -1
            g.ell(x + math.cos(a) * r * 0.8 * side, y + math.sin(a) * r * 0.8 * side, 2, 2, *TAIL)
        ang += 8 + max(0, i - 9) * 4
        rr -= max(0, i - 9) * 0.8
    for x, y, r, a in pts[4:-2]:
        g.ell(x - math.cos(a) * 1.5, y - math.sin(a) * 1.5, 1.2, 1.2, "tan")


LEAVES = (("green", "dgreen"), ("orange", "rust"), ("amber", "ochre"), ("green", "dgreen"),
          ("orange", "rust"), ("amber", "ochre"), ("green", "forest"))
LEAF = ("..111", ".1121", "1121.", "22...")


def leaf(g, x, y, flip, cols):
    """5x4 leaf, its midrib and stem in the darker colour; flip mirrors it, so leaves flutter."""
    for j, row in enumerate(LEAF):
        for i, ch in enumerate(row[::-1] if flip else row):
            if ch != ".":
                g.p(x + i, y + j, cols[int(ch) - 1])


def hit_squirrel(step):
    """The tail flicks across from left to right with arced motion lines behind it, and knocks a
    spray of leaves outward that flutter down."""
    g = Grid(64, 64)
    if step == 0:
        impact(g, "orange")
        return rim(g)
    theta = (0, 150, 205, 265, None, None, None)[step]
    if step <= 4:
        sweep_from, sweep_to = (0, 120, 150, 190, 250)[step], (0, 160, 230, 300, 330)[step]
        def lines(p):
            for rad, col in ((10, "white"), (15, "white"), (20, "white")):
                for deg in range(sweep_from, sweep_to, 2):
                    if (deg // 2 + rad) % 7 < 5:
                        a = math.radians(deg)
                        p.p(round(32 + math.cos(a) * rad), round(40 + math.sin(a) * rad * 0.9), col)
        piece(g, lines)
    if theta is not None:
        piece(g, lambda p: tail(p, theta))
    if step >= 2:
        t = step - 1
        for i, cols in enumerate(LEAVES):
            a = math.radians(i * 360 / 7 - 100)
            x = 30 + math.cos(a) * (8 + t * 5) + math.sin(t * 1.3 + i) * 2
            y = 33 + math.sin(a) * (6 + t * 4) + t * t * 0.9
            if 1 <= x < 58 and 1 <= y < 59:
                piece(g, lambda p: leaf(p, x, y, (step + i) % 2, cols))
    return g


TUFTS = ("cream", "white", "tan", "lgrey", "brown", "grey")


def tuft(g, x, y, col, flip):
    for i, (dx, dy) in enumerate(((0, 0), (1, 1), (2, 0), (1, 2), (3, -1) if flip else (-1, -1))):
        g.p(x + dx, y + dy, col)


def hit_other_dog(step):
    """A cartoon tangle: a jostling dust cloud with leash loops in it, fur tufts flying off, then
    hearts popping up as the dogs make friends."""
    g = Grid(64, 64)
    cx, cy = 32, 38
    if step == 0:
        impact(g, "pink", cx, cy)
        return rim(g)
    r = (0, 9, 12, 13, 13, 11, 0, 0)[step]
    if r:
        def cloud(p):
            for k in range(6):
                a = math.radians(k * 60 + step * 23)
                d = r * 0.75
                p.ell(cx + math.cos(a) * d, cy + math.sin(a) * d * 0.75, r * 0.6, r * 0.55, "white", "lgrey")
            p.ell(cx, cy, r * 0.8, r * 0.65, "white", "lgrey")
            for k in range(3):
                a = math.radians(k * 120 + step * 50)
                lx, ly = cx + math.cos(a) * r * 0.45, cy + math.sin(a) * r * 0.35
                p.ell(lx, ly, 3, 3, "brown")
                p.ell(lx, ly, 1.8, 1.8, "white")
        piece(g, cloud)
    elif step == 6:
        def puffs(p):
            for k in range(5):
                a = math.radians(k * 72 + 10)
                p.ell(cx + math.cos(a) * 15, cy + math.sin(a) * 11, 3.5, 3, "white", "lgrey")
        piece(g, puffs)
    if step >= 2:
        t = step - 1
        for i, col in enumerate(TUFTS):
            a = math.radians(i * 60 + 15)
            x = cx + math.cos(a) * (9 + t * 4.5)
            y = cy + math.sin(a) * (7 + t * 3.5) + t * t * 0.5
            if 2 <= x < 59 and 2 <= y < 59:
                piece(g, lambda p: tuft(p, x, y, col, (step + i) % 2))
    if step >= 3:
        t = step - 3
        for i, (x0, delay) in enumerate(((24, 0), (36, 1), (30, 2))):
            tt = t - delay
            if tt < 0:
                continue
            y = cy - 12 - tt * 6
            if y < 2:
                continue
            if tt == 0:
                piece(g, lambda p: stamp(p, SMALL, x0, y))
            else:
                piece(g, lambda p: stamp(p, HEART, x0 - 1, y))
    return g


# ---------- edge flash ----------

FLASH = {"green": ("green", "teal"), "sky": ("cyan", "navy"), "amber": ("amber", "plum"),
         "orange": ("orange", "plum"), "pink": ("pink", "plum")}


def flash(colour, step):
    """16x64, the left screen edge: solid at x=0, an ordered 4x4 dither that clears inward. Each lit
    pixel in the sparse inner half with a gap inward of it gets a dark fringe there; the light ink carries Woof Way and the
    dark fringe the light roads. Later frames recede toward the edge."""
    ink, fringe = FLASH[colour]
    width = (16, 11, 7, 4)[step]
    solid = 2 if step < 2 else 1
    g = Grid(16, 64)
    for y in range(64):
        for x in range(width):
            n = 16 if x < solid else round(16 * (width - 1 - x) / (width - solid))
            if BAYER[y % 4][x % 4] < n:
                g.p(x, y, ink)
    lit = [row[:] for row in g.px]
    for y in range(64):
        for x in range(max(1, width // 2), 16):
            if not lit[y][x] and lit[y][x - 1]:
                g.p(x, y, fringe)
    return g


# ---------- label plate ----------

def label_plate():
    """24x24 nine-slice, 8px corners. The middle rows and columns are uniform, so a stretch keeps
    them crisp. White text sits on the dred face (7.34:1) from 6px in; the yellow band carries Woof
    Way and the plum rim the light roads. A spike pokes out of each corner."""
    g = Grid(24, 24)
    for (x0, y0), (sx, sy) in (((1, 1), (1, 1)), ((22, 1), (-1, 1)), ((1, 22), (1, -1)), ((22, 22), (-1, -1))):
        g.tri((x0 + 0.5 * sx, y0 + 0.5 * sy), (x0 + 7 * sx, y0 + 3.5 * sy), (x0 + 3.5 * sx, y0 + 7 * sy),
              "yellow")
    g.rect(3, 3, 18, 18, "yellow")
    g.rect(3, 19, 18, 2, "amber")
    g.rect(19, 5, 2, 14, "amber")
    g.rect(5, 5, 14, 14, "dred")
    g.rect(5, 5, 14, 1, "red")
    g.rect(5, 5, 1, 14, "red")
    g.rect(5, 18, 14, 1, "plum")
    g.rect(18, 6, 1, 13, "plum")
    rim(g)
    g.rect(3, 22, 18, 1, "plum")
    return g


# ---------- dog status overlays ----------



def status_stinky(size, step):
    """Wavy lines rising 2px a frame over an 8px wave, so 4 frames loop with no seam. Green with a
    teal right side, like fx-stinky."""
    g = Grid(size, size)
    lines = {16: ((2, 0), (7, 3), (12, 6)), 12: ((2, 0), (7, 4)), 8: ((1, 0), (5, 0))}[size]
    top, bottom = {16: (2, 14), 12: (1, 11), 8: (0, 8)}[size]
    for x0, ph in lines:
        for y in range(top, bottom):
            k = (y + 2 * step + ph) % 8
            if k == 7 or (size == 8 and k == 3):
                continue
            x = x0 + WAVE[k]
            g.p(x, y, "green")
            g.p(x + 1, y, "teal")
    return g


DRIP = {16: (".c.", "cwc", "ccs", ".s."), 12: ("c.", "ws", "s."), 8: ("c", "s")}


def status_soaked(size, step):
    """Drops form at the top and fall a whole number of pixels a frame, wrapping after 4 frames.
    Cyan with a sky underside and a white glint, navy rim."""
    g = Grid(size, size)
    drops = {16: ((1, 0), (6, 2), (12, 1)), 12: ((1, 0), (5, 2), (9, 1)), 8: ((1, 0), (5, 2))}[size]
    fall, y0 = {16: (3, 1), 12: (2, 1), 8: (1, 1)}[size]
    shape = DRIP[size]
    for x, ph in drops:
        k = (step + ph) % 4
        y = y0 + k * fall
        if k == 0 and size > 8:
            g.p(x + len(shape[0]) // 2, y + 1, "cyan")
            continue
        for j, row in enumerate(shape):
            for i, ch in enumerate(row):
                if ch != ".":
                    g.p(x + i, y + j, {"c": "cyan", "w": "white", "s": "sky"}[ch])
    return rim(g, "navy")


SWEAT = {16: (".c..", ".cc.", "cwcc", "cwcs", "ccss", ".ss."), 12: (".c.", "cwc", "cws", ".s."),
         8: ("c", "w", "s")}
# Surprise lines: (start, end) radii out from a point at the head's top-left, and their angles.
SURPRISE = {16: ((6, 15), (4, 7.5), (-160, -120, -80)), 12: ((4, 11), (3, 5.5), (-160, -120, -80)),
            8: ((3, 8), (2.5, 4.5), (-150, -90))}


def status_spooked(size, step):
    """A sweat drop pops in at the head's right and slides down; surprise lines fan out over the
    head's left and flick out and back. The drop has a navy rim, the white lines a plum one."""
    g = Grid(size, size)
    drop = Grid(size, size)
    shape = SWEAT[size]
    dx, dy = {16: (11, 3), 12: (8, 2), 8: (6, 2)}[size]
    slide = (0, 0, 1, 2)[step] if size > 8 else (0, 0, 1, 1)[step]
    if step == 0:
        drop.p(dx + len(shape[0]) // 2, dy + len(shape) - 2, "cyan")
        drop.p(dx + len(shape[0]) // 2, dy + len(shape) - 1, "sky")
    else:
        for j, row in enumerate(shape):
            for i, ch in enumerate(row):
                if ch != ".":
                    drop.p(dx + i, dy + slide + j, {"c": "cyan", "w": "white", "s": "sky"}[ch])
    rim(drop, "navy")
    lines = Grid(size, size)
    (ox, oy), (r0, r1), angles = SURPRISE[size]
    out = 0 if step in (1, 3) else 1
    for deg in angles:
        a = math.radians(deg)
        rr = r0 + out
        while rr <= r1 + out:
            lines.p(round(ox + math.cos(a) * rr), round(oy + math.sin(a) * rr), "white")
            rr += 0.5
    rim(lines)
    layer(g, lines)
    layer(g, drop)
    return g


def sizes(key, draw, ms):
    for size, suffix in ((16, ""), (12, "@75"), (8, "@50")):
        yield f"{key}{suffix}", [("loop", [draw(size, i).outlined(False) for i in range(4)], ms)]


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    yield "fx-hit-skunk", [("play", [hit_skunk(i).outlined(False) for i in range(8)], 70)]
    yield "fx-hit-puddle", [("play", [hit_puddle(i).outlined(False) for i in range(7)], 70)]
    yield "fx-hit-thief", [("play", [hit_thief(i).outlined(False) for i in range(8)], 70)]
    yield "fx-hit-squirrel", [("play", [hit_squirrel(i).outlined(False) for i in range(7)], 70)]
    yield "fx-hit-other-dog", [("play", [hit_other_dog(i).outlined(False) for i in range(8)], 70)]
    for colour in FLASH:
        yield f"ui-hit-flash-{colour}", [("play", [flash(colour, i).outlined(False) for i in range(4)], 70)]
    yield "ui-hit-label", [("normal", [label_plate().outlined(False)], 1000)]
    yield from sizes("fx-status-stinky", status_stinky, 180)
    yield from sizes("fx-status-soaked", status_soaked, 150)
    yield from sizes("fx-status-spooked", status_spooked, 150)


if __name__ == "__main__":
    main(sys.argv, sprites, "art/hits", __doc__, grounds=ROADS)
