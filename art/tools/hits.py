#!/usr/bin/env python3
"""Draw the encounter hit moments: a burst over the pack per encounter, the
screen-edge flash in the encounter's colour, the plate behind the big label,
and the per-dog status overlays. Bursts carry a 1px rim (plum, navy for water,
teal for green) so they hold 3:1 on the three light roads while
their fills carry Woof Way. The flash strips pair a light ink with a dark
fringe for the same reason. The encounters' hits match their road sprites in
encounters.py.

fx-hit-skunk       64x64  play (8 frames, 70ms)  lumpy mauve gas cloud that thins to a dither, wisps
                                                  and stink squiggles
fx-hit-puddle      64x64  play (7 frames, 70ms)  splash crown and flying drops
fx-hit-thief       64x64  play (8 frames, 70ms)  coins and a wallet flying up out of a poof
fx-hit-squirrel    64x64  play (7 frames, 70ms)  tail-flick sweep, motion lines, leaves
fx-hit-other-dog   64x64  play (8 frames, 70ms)  tangle cloud, fur tufts and hearts
fx-hit-picnic      64x64  play (8 frames, 70ms)  a poof, sandwiches, an apple and a cheese wedge
                                                  flying up and falling, crumbs
fx-hit-goose       64x64  play (8 frames, 70ms)  a white star, sound waves arcing out to both sides,
                                                  feathers seesawing down
fx-hit-petunias    64x64  play (8 frames, 70ms)  a puff of soil, clods, three whole flowers tumbling,
                                                  falling petals
fx-hit-trash       64x64  play (8 frames, 70ms)  a poof, the bin lid spinning, a can, a banana peel, a
                                                  fish bone and paper flying, flies buzzing round
fx-hit-cafe        64x64  play (8 frames, 70ms)  a latte splash, the cup flipping up, drops, the foam
                                                  heart floating up
                   every fx-hit-* also has play-word, after play: the same frames and timing with
                   its comic word over frames 0 to 5 (420ms), centred on the impact star: cafe
                   SPLAT!, goose HONK!, other-dog SNIFF!, petunias SQUISH!, picnic CHOMP!, puddle
                   SPLOSH!, skunk PEE-YEW!, squirrel CHITTER!, thief YOINK!, trash CLANG!. The game
                   plays play-word, and play with reduced motion
fx-lemonade        64x64  play (8 frames, 70ms)  the lucky lemonade stand: a yellow star, a cup of
                                                  lemonade popping up, lemon slices, twinkles
ui-hit-flash-green, -sky, -amber, -mauve, -orange, -pink, -white
                   16x64  play (4 frames, 70ms)  left screen-edge strip, solid at x=0,
                          4x4 ordered dither to clear by x=15; tiles vertically, the
                          game mirrors it for the right edge
ui-hit-label       24x24  normal, lucky (1 frame each)  nine-slice, 8px corners: a dred
                          (normal) or blue (lucky) plate in ui.py's chrome (a cream band),
                          stretched to 176x32 for every label; white font-title text at 2x,
                          centred, its line top 3px below the plate's top so the 10px caps sit
                          in rows 11 to 20
fx-status-stinky   16x16  loop (4 frames, 180ms) pink stink lines, plum-rimmed, rising over a dog's head
fx-status-soaked   16x16  loop (4 frames, 150ms) drips falling off
fx-status-spooked  16x16  loop (4 frames, 150ms) sweat drop popping, surprise lines
                   each status also has @75 (12x12) and @50 (8x8), same tags and timing;
                   bottom-centre on the dog's centre column, 6px (4px at @75, 3px at
                   @50) below the dog's top opaque row, so the lower rows overlap the head

Usage:
  hits.py preview OUT.png   every frame of every piece on the four road colours
  hits.py build             write art/hits/*.aseprite and export to
                            public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py,
the rim, burst, twinkle, heart and comic word helpers in fx.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fx import HEART, SMALL, burst, rim, stamp, star4, word  # noqa: E402
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
    """The cloud swells in seven lobes, each with a scalloped rim of smaller puffs, then the lobes drift
    apart, shrink and thin to a dither as the gas clears, trailing dithered wisps. Mauve, as skunk-cloud and
    fx-status-stinky: the puffs mauve, shaded purple on their lower right and lit pink on their upper left, so
    the pink carries Woof Way and the plum rim the light roads. Stink squiggles rise out of it, pink with a
    plum side, so they read over the cloud and on every road."""
    g = Grid(64, 64)
    if step == 0:
        impact(g, "mauve")
        return rim(g, "plum")
    d = (0, 6, 10, 13, 16, 19, 22, 25)[step]
    r = (0, 7, 9, 10, 9, 7, 5, 3)[step]
    core = (0, 9, 12, 13, 10, 5, 0, 0)[step]
    lobes = []
    for k in range(7):
        a = math.radians(k * 360 / 7 + 20 + step * 4)
        lobes.append((32 + math.cos(a) * d, 33 + math.sin(a) * d * 0.9, r * (1 + 0.15 * (k % 3 - 1)), a))
    # puffs round each lobe's outer side, so the cloud's edge is scalloped, not one smooth curve
    puffs = []
    for cx, cy, rk, a in lobes:
        if rk >= 3:
            for j in (-2, -1, 0, 1, 2):
                b = a + j * 0.6 + (step + j) % 2 * 0.15
                puffs.append((cx + math.cos(b) * rk * 1.1, cy + math.sin(b) * rk * 1.1, rk * (0.45 if j % 2 else 0.55)))
    puffs += [(cx, cy, rk) for cx, cy, rk, _ in lobes] + ([(32, 33, core)] if core else [])
    for cx, cy, pr in puffs:
        g.ell(cx, cy, pr, pr, "mauve")
    # a purple seam along the lower right of the core and every other lobe, where it lies inside the cloud,
    # so the puffs in front read over the ones behind
    mass = [row[:] for row in g.px]
    front = [(cx, cy, rk) for k, (cx, cy, rk, _) in enumerate(lobes) if k % 2 == 0] + ([(32, 33, core)] if core else [])
    for cx, cy, pr in front:
        for deg in range(0, 100, 4):
            x, y = round(cx + math.cos(math.radians(deg)) * (pr - 0.5)), round(cy + math.sin(math.radians(deg)) * (pr - 0.5))
            if 2 <= x < 62 and 2 <= y < 62 and all(mass[y + dy][x + dx] for dx in (-2, 0, 2) for dy in (-2, 0, 2)):
                g.p(x, y, "purple")
    # shade the lower-right edge of every puff, so the lumps read and overlapping lobes read as one mass, and
    # light the mass's upper-left edge pink
    lit = [row[:] for row in g.px]
    for y in range(62):
        for x in range(62):
            if lit[y][x] and not (lit[y + 1][x + 1] and lit[y + 2][x + 2]):
                g.p(x, y, "purple")
            elif lit[y][x] and (x == 0 or y == 0 or not lit[y - 1][x] or not lit[y][x - 1]):
                g.p(x, y, "pink")
    if 1 <= step < 4:
        g.ell(32 - core * 0.35, 33 - core * 0.4, core * 0.3, core * 0.2, "pink")
        g.ell(32 - core * 0.3, 33 - core * 0.3, core * 0.3, core * 0.2, "mauve")
    rim(g, "plum")
    if step >= 5:
        # clearing: the inside thins to a checker dither, the solid rim and the edge just inside it stay
        solid = [row[:] for row in g.px]
        for y in range(2, 62):
            for x in range(2, 62):
                if all(solid[y + dy][x + dx] for dx in (-2, 0, 2) for dy in (-2, 0, 2)) and (x + y + step) % 2:
                    g.p(x, y, None)
    if step >= 2:
        # wisps curling off the cloud, dithered: alternate pixels pink and plum, so they hold on every road,
        # with a second strand on alternate pixels at the base
        t = step - 2
        for j, (deg, curl) in enumerate(((200, 1), (330, -1), (60, 1), (140, -1), (265, 1))):
            a = math.radians(deg + step * 5)
            r0 = d + r + 1 + t * 2
            for i in range(6 + t):
                b = a + curl * i * 0.1
                rr = r0 + i * 1.2
                x, y = round(32 + math.cos(b) * rr), round(33 + math.sin(b) * rr * 0.9)
                for k, (dx, dy) in enumerate(((0, 0), (1, 1)) if i < 3 else ((0, 0),)):
                    xx, yy = x + dx, y + dy
                    if 1 <= xx < 63 and 1 <= yy < 63 and not g.px[yy][xx] and (k == 0 or i % 2):
                        g.p(xx, yy, "pink" if (i + k) % 2 == 0 else "plum")
    if step >= 1:
        # five rising S-lines: 2px a frame up over an 8px wave, the outer ones leaning out
        rise = (0, 0, 4, 8, 12, 15, 18, 20)[step]
        length = (0, 5, 8, 9, 9, 8, 6, 4)[step]
        for j, (x0, y0, lean) in enumerate(((14, 26, -1), (22, 20, -0.5), (32, 17, 0), (42, 20, 0.5), (50, 26, 1))):
            for t in range(length):
                y = y0 - rise - t
                x = x0 + lean * (rise + t) * 0.4 + WAVE[(t + j * 3 + step * 2) % 8]
                if 1 <= y < 63:
                    g.p(round(x), y, "pink")
                    g.p(round(x) + 1, y, "plum")
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


# the squirrel's colours: orange fur, ochre shade, a tan light and stripe
TAIL = ("orange", "ochre", "tan")


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


def fly(step, vx, vy, cx=32, cy=38, gravity=1.1, t0=0.5):
    """Where a thrown piece is on a frame: launched from (cx, cy) at (vx, vy) a frame, falling under gravity."""
    t = step - t0
    return cx + vx * t, cy + vy * t + gravity * t * t


def poof(g, step, cx, cy, frames=(0, 10, 13, 14), cols=("white", "lgrey")):
    """A dust poof over the first frames, then six puffs drifting out and shrinking, as hit_thief's."""
    pr = frames[step] if step < len(frames) else 0
    if pr:
        piece(g, lambda p: [p.ell(cx + dx * pr / 12, cy + dy * pr / 12, pr * 0.55, pr * 0.5, *cols)
                            for dx, dy in ((-7, 2), (7, 2), (0, -5), (0, 5), (-4, -3), (4, -3))])
    elif step < len(frames) + 2:
        k = step - len(frames)

        def puffs(p):
            for j in range(6):
                a = math.radians(j * 60 + 30)
                d = 14 + k * 4
                p.ell(cx + math.cos(a) * d, cy + math.sin(a) * d * 0.6, 3 - k, 2.5 - k * 0.8, *cols)
        piece(g, puffs)


def inside(x, y, m=4):
    return m <= x < 64 - m and m <= y < 64 - m


def sandwich(g, x, y, flip):
    """A triangle sandwich, 13 wide: a tan crust round cream bread with lettuce and tomato showing at the
    cut; flip turns it over."""
    d = -1 if flip else 1
    g.tri((x - 7, y + 4 * d), (x + 7, y + 4 * d), (x, y - 5 * d), "tan")
    g.tri((x - 5, y + 3 * d), (x + 5, y + 3 * d), (x, y - 3 * d), "cream")
    g.rect(x - 6, y + 2 * d, 13, 1, "green")
    g.rect(x - 6, y + 3 * d, 13, 1, "red")
    g.rect(x - 6, y + 4 * d, 13, 1, "tan")


def apple(g, x, y, spin):
    g.ell(x, y, 4, 4, "red", "dred", "pink")
    g.p(x - 1, y - 2, "white")
    g.rect(x + (0, 1, 0, -1)[spin % 4], y - 5, 1, 2, "dbrown")
    g.rect(x + 1 + (0, 1, 0, -1)[spin % 4], y - 5, 2, 1, "green")


def cheese(g, x, y, spin):
    """A cheese wedge, its holes showing, tipping one way then the other."""
    if spin % 2:
        g.tri((x - 5, y + 3), (x + 5, y + 3), (x + 5, y - 4), "yellow")
    else:
        g.tri((x - 5, y + 3), (x + 5, y + 3), (x - 5, y - 4), "yellow")
    g.rect(x - 5, y + 2, 11, 2, "amber")
    g.p(x - 1 if spin % 2 else x - 3, y, "amber")
    g.p(x + 2 if spin % 2 else x, y + 1, "amber")


def hit_picnic(step):
    """Lunch goes flying: a poof, then two sandwiches tumbling, an apple and a cheese wedge fan up and
    fall back while crumbs scatter."""
    g = Grid(64, 64)
    cx, cy = 32, 40
    if step == 0:
        impact(g, "orange", cx, cy)
        return rim(g)
    poof(g, step, cx, cy)
    for i, (vx, vy) in enumerate(((-3, -2), (4, -3), (-1.5, -4.5), (5, -1.5), (-5, -1), (2, -5), (-4, -3.5),
                                   (1, -2.5))):
        x, y = fly(step, vx, vy, cx, cy - 2, 0.9)
        if inside(x, y, 2):
            piece(g, lambda p: p.rect(x, y, 2, 1 + i % 2, ("tan", "cream", "brown")[i % 3]))
    for i, (draw, vx, vy) in enumerate(((sandwich, -3.4, -6), (sandwich, 3.6, -5.5), (apple, -0.4, -8),
                                        (cheese, 4.4, -3))):
        x, y = fly(step, vx, vy, cx, cy - 4, 1.05)
        if inside(x, y, 8):
            piece(g, lambda p: draw(p, round(x), round(y), (step + i) % 4 if draw is not sandwich else (step + i) % 2))
    return g


FEATHER = ("...111", ".12211", "12111.", "2.....")


def feather(g, x, y, flip, cols=("white", "lgrey")):
    """A 6x4 feather, its quill in the second colour; flip mirrors it, so it seesaws as it drifts."""
    for j, row in enumerate(FEATHER):
        for i, ch in enumerate(row[::-1] if flip else row):
            if ch != ".":
                g.p(x + i, y + j, cols[int(ch) - 1])


def hit_goose(step):
    """The honk: a white puff, sound waves arcing out to both sides, and feathers flying off that seesaw
    down."""
    g = Grid(64, 64)
    cx, cy = 32, 36
    if step == 0:
        impact(g, "white", cx, cy)
        return rim(g)
    poof(g, step, cx, cy, (0, 8, 10))
    if step <= 5:
        def waves(p):
            for k in range(3):
                r = 9 + k * 5 + step * 2
                if r > 28:
                    continue
                for side in (-1, 1):
                    for deg in range(-40, 41, 2):
                        a = math.radians(deg)
                        x, y = cx + side * math.cos(a) * r, cy + math.sin(a) * r
                        p.rect(round(x) - (side < 0), round(y), 2, 1, "white")
        piece(g, waves)
    for i, (vx, vy) in enumerate(((-4, -5), (4, -5.5), (-6, -1.5), (6, -2), (-1.5, -6.5), (2, -6.5))):
        t = step - 0.5
        x = cx - 3 + vx * min(t, 3) + (math.sin(step * 1.7 + i) * 2 if step > 4 else 0)
        y = cy + vy * min(t, 3) + max(0, t - 3) * 2.5
        if inside(x, y, 3) and step >= 2:
            piece(g, lambda p: feather(p, round(x), round(y), (step + i) % 2))
    return g


PETALS = (("pink", "mauve"), ("mauve", "purple"), ("white", "lgrey"), ("hot", "dred"))


def flower(g, x, y, cols, tilt):
    """A petunia pulled up whole: a trumpet of five petals round a yellow throat, two leaves and a stem
    with roots; tilt leans the stem one way or the other as it tumbles."""
    for j in range(6):
        g.p(x + round(tilt * j / 3), y + 3 + j, "dgreen")
    g.rect(x - 2 + tilt, y + 5, 2, 1, "green")
    g.rect(x + 1 + tilt, y + 6, 2, 1, "green")
    g.p(x - 1 + 2 * tilt, y + 9, "brown")
    g.p(x + 1 + 2 * tilt, y + 9, "brown")
    g.ell(x + 0.5, y + 0.5, 4, 3.6, cols[0], cols[1])
    g.rect(x, y - 3, 1, 7, cols[1])
    g.rect(x - 3, y, 7, 1, cols[1])
    g.ell(x + 0.5, y + 0.5, 1.5, 1.5, "yellow")


def hit_petunias(step):
    """The bed bursts: a puff of soil, clods flying, three whole flowers tumbling up and falling, and
    petals seesawing down."""
    g = Grid(64, 64)
    cx, cy = 32, 42
    if step == 0:
        impact(g, "pink", cx, cy)
        return rim(g)
    poof(g, step, cx, cy, (0, 9, 12, 13), ("brown", "dbrown"))
    for i, (vx, vy) in enumerate(((-5, -4), (5, -4.5), (-3, -6.5), (3, -7), (-7, -1), (7, -0.5), (0, -8))):
        x, y = fly(step, vx, vy, cx, cy, 1.1)
        if inside(x, y, 3):
            piece(g, lambda p: p.ell(x, y, 2.5 - (i % 2) * 0.5, 2, "brown", "dbrown"))
    if step >= 3:
        for i in range(9):
            a = math.radians(i * 40 - 80)
            x = cx + math.cos(a) * (8 + step * 3) + math.sin(step * 1.4 + i) * 2
            y = cy - 18 + math.sin(a) * (5 + step * 2) + (step - 3) * 3
            if inside(x, y, 2):
                col = PETALS[i % 4]
                piece(g, lambda p: (p.rect(x, y, 3, 2, col[0]), p.p(x + 2 * ((step + i) % 2), y + 1, col[1])))
    for i, (vx, vy) in enumerate(((-3.5, -7), (3.5, -6.5), (-0.3, -8.5))):
        x, y = fly(step, vx, vy, cx, cy - 6, 1.15)
        if inside(x, y, 6):
            piece(g, lambda p: flower(p, round(x), round(y), PETALS[i], (-1, 0, 1, 0)[(step + i) % 4]))
    return g


def can(g, x, y, spin):
    """A drink can tumbling: upright, then on its side."""
    if spin % 2 == 0:
        g.rect(x - 3, y - 4, 7, 9, "red")
        g.rect(x - 3, y - 4, 7, 1, "lgrey")
        g.rect(x - 2, y - 2, 1, 5, "pink")
        g.rect(x + 2, y - 3, 2, 8, "dred")
        g.rect(x - 1, y, 3, 2, "white")
    else:
        g.rect(x - 4, y - 3, 9, 7, "red")
        g.rect(x - 4, y - 3, 1, 7, "lgrey")
        g.rect(x - 3, y - 2, 8, 1, "pink")
        g.rect(x - 3, y + 2, 8, 2, "dred")
        g.rect(x, y - 1, 2, 3, "white")


def lid(g, x, y, spin):
    """The bin's lid spinning like a plate: face on, tilted, edge on."""
    ry = (4, 2.5, 1, 2.5)[spin % 4]
    g.ell(x, y, 8, ry + 0.5, "grey", "slate", "lgrey")
    if ry > 1:
        g.rect(x - 2, y - round(ry * 0.5) - 1, 5, 2, "slate")
        g.rect(x - 1, y - round(ry * 0.5) - 1, 3, 1, "lgrey")


def peel(g, x, y, flip):
    """A banana peel, its three flaps splayed; flip turns it upside down."""
    d = -1 if flip else 1
    g.rect(x - 1, y - d * 4, 3, 5, "yellow")
    g.p(x, y - d * 5, "dbrown")
    g.tri((x - 1, y), (x - 6, y + d * 5), (x - 1, y + d * 3), "yellow")
    g.tri((x + 1, y), (x + 6, y + d * 5), (x + 2, y + d * 3), "amber")
    g.tri((x - 1, y), (x + 1, y), (x, y + d * 6), "amber")


def fishbone(g, x, y, flip):
    """A fish skeleton: a spine with ribs, a head and a forked tail."""
    d = -1 if flip else 1
    g.rect(x - 5, y, 10, 1, "white")
    for k in (-3, -1, 1, 3):
        g.rect(x + k, y - 2, 1, 2, "white")
        g.rect(x + k, y + 1, 1, 2, "white")
    g.ell(x + 6 * d, y + 0.5, 2.5, 2.5, "white", "lgrey")
    g.p(x + 6 * d + d, y - 1, "ink")
    g.tri((x - 5 * d, y + 0.5), (x - 8 * d, y - 3), (x - 8 * d, y + 4), "white")


def fly_bug(g, x, y, flap):
    """A buzzing fly: an ink body under two white wings that flap."""
    g.rect(x, y, 2, 2, "ink")
    g.p(x - 1, y - 1 - flap, "white")
    g.p(x + 2, y - 1 - flap, "white")
    g.p(x - 2, y - 1 - flap, "white")
    g.p(x + 3, y - 1 - flap, "white")


def hit_trash(step):
    """The bins' contents go up out of a green star: the lid spinning, a can, a banana peel, a fish bone
    and paper, with flies buzzing round as it all comes down."""
    g = Grid(64, 64)
    cx, cy = 32, 40
    if step == 0:
        impact(g, "green", cx, cy)
        return rim(g, "teal")
    poof(g, step, cx, cy)
    for i, (draw, vx, vy) in enumerate(((lid, 2.6, -7), (can, -4.4, -3.6), (peel, 5, -3.6), (fishbone, -1.6, -6.4),
                                        (None, 5, -2), (None, -5.5, -1.5))):
        x, y = fly(step, vx, vy, cx, cy - 2, 0.95)
        if not inside(x, y, 8):
            continue
        if draw is None:
            piece(g, lambda p: (p.ell(x, y, 3, 2.6, "white", "lgrey"), p.p(x - 1, y, "lgrey")))
        elif draw in (can, lid):
            piece(g, lambda p: draw(p, round(x), round(y), step + i))
        else:
            piece(g, lambda p: draw(p, round(x), round(y), (step + i) % 2))
    if step >= 3:
        for i in range(3):
            a = math.radians(i * 120 + step * 50)
            x, y = round(cx + math.cos(a) * 16), round(cy - 10 + math.sin(a) * 7)
            piece(g, lambda p: fly_bug(p, x, y, step % 2))
    return g


def cup(g, x, y, tilt):
    """A latte cup, 10 wide, tumbling, its handle on the right: upright (tilt 0) showing its foam, on its
    side (1 and 3, the latte pouring out of the mouth) or upside down (2)."""
    g.rect(x - 5, y - 4, 10, 9, "white")
    g.rect(x + 2, y - 4, 3, 9, "lgrey")
    if tilt % 2 == 0:
        g.rect(x + 5, y - 2, 3, 5, "lgrey")
        g.rect(x + 5, y - 1, 1, 3, None)
        g.rect(x - 4, y - 4 if tilt == 0 else y + 4, 8, 1, "tan" if tilt == 0 else "lgrey")
    else:
        mouth = x + 5 if tilt == 1 else x - 6
        g.rect(x - 2, y - 7 if tilt == 1 else y + 5, 5, 3, "lgrey")
        g.rect(mouth, y - 3, 1, 7, "tan")
        g.rect(mouth + (1 if tilt == 1 else -1), y - 1, 1, 4, "brown")


def hit_cafe(step):
    """The cup flips up out of an amber star with the latte splashing out of it in drops, and its foam
    heart floats up out of the splash."""
    g = Grid(64, 64)
    cx, cy = 32, 40
    if step == 0:
        impact(g, "amber", cx, cy)
        return rim(g)
    if step <= 4:
        def splash(p):
            r = (0, 9, 13, 15, 16)[step]
            for k in range(9):
                a = math.radians(200 + k * 17.5)
                x, y = cx + math.cos(a) * r, cy - 2 + math.sin(a) * r * 0.9
                p.ell(x, y, 3 - step * 0.4, 3 - step * 0.4, "brown", "dbrown", "tan")
            p.ell(cx, cy, r * 0.7, r * 0.28, "brown", "dbrown", "tan")
        piece(g, splash)
    for i, (vx, vy) in enumerate(((-6, -5), (6, -5.5), (-3.5, -7.5), (4, -8), (-8, -2), (8, -2.5))):
        x, y = fly(step, vx, vy, cx, cy - 2, 1.3)
        if inside(x, y, 3) and step >= 2:
            piece(g, lambda p: p.ell(x, y, 2, 2.2, "brown", "dbrown", "tan"))
    wy = (0, 30, 21, 15, 12, 11, 12, 14)[step]
    piece(g, lambda p: cup(p, cx + 6 + (0, 1, 2, 3, 3, 2, 1, 0)[step], wy, step % 4))
    if step >= 3:
        hy = cy - 10 - (step - 3) * 4
        piece(g, lambda p: stamp(p, HEART, cx - 16, hy, ("white", "white", "lgrey")))
    return g


def lemonade_cup(g, x, y):
    """A paper cup of lemonade with a straw and a lemon slice on the rim."""
    g.tri((x - 5, y - 6), (x + 6, y - 6), (x + 3.5, y + 6), "white")
    g.tri((x - 5, y - 6), (x - 2.5, y + 6), (x + 3.5, y + 6), "white")
    g.rect(x - 4, y - 5, 9, 4, "yellow")
    g.rect(x - 4, y - 5, 9, 1, "white")
    g.rect(x + 2, y - 4, 2, 9, "lgrey")
    g.rect(x - 3, y + 1, 7, 1, "red")
    g.rect(x + 1, y - 13, 1, 8, "red")
    g.rect(x + 1, y - 13, 3, 1, "red")
    g.ell(x - 5, y - 6, 2.5, 2.5, "yellow", "amber")
    g.p(x - 5, y - 6, "white")


def lemon(g, x, y, spin):
    """A lemon slice spinning: face on, then edge on."""
    if spin % 2 == 0:
        g.ell(x, y, 2.5, 2.5, "yellow", "amber")
        g.p(x, y, "white")
    else:
        g.rect(x - 1, y - 2, 2, 5, "amber")
        g.p(x - 1, y - 2, "yellow")


def lemonade_pop(step):
    """The lucky lemonade: a yellow star, then the cup pops up out of a ring of sparkles while lemon slices
    fan out and drops of water twinkle."""
    g = Grid(64, 64)
    cx, cy = 32, 38
    if step == 0:
        impact(g, "yellow", cx, cy, 14)
        return rim(g)
    if step == 1:
        piece(g, lambda p: burst(p, cx, cy, 13, 5, 8, "white", 11))
    wy = (0, 36, 30, 27, 26, 26, 27, 27)[step]
    piece(g, lambda p: lemonade_cup(p, cx, wy))
    for i, (vx, vy) in enumerate(((-8, -5), (8, -5.5), (-10, 0), (10, 0.5))):
        x, y = fly(step, vx, vy, cx, cy, 0.8)
        if inside(x, y, 4):
            piece(g, lambda p: lemon(p, round(x), round(y), step + i))
    if step >= 2:
        for i, (x, y) in enumerate(((cx - 13, 18), (cx + 14, 16), (cx - 7, 9), (cx + 9, 7), (cx + 17, 30))):
            if (step + i) % 3 != 0:
                r = 2 if (step + i) % 3 == 1 else 1
                piece(g, lambda p: star4(p, x, y, r, "cyan" if i % 2 else "yellow"))
    return g


# ---------- edge flash ----------

FLASH = {"green": ("green", "teal"), "sky": ("cyan", "navy"), "amber": ("amber", "plum"),
         "mauve": ("mauve", "plum"), "orange": ("orange", "plum"), "pink": ("pink", "plum"),
         "white": ("white", "plum")}


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

# The plate's face, its lit edge and its shaded edge: dred for an encounter, blue for a lucky find.
PLATES = {"normal": ("dred", "red", "plum"), "lucky": ("blue", "sky", "navy")}


def label_plate(face="dred", lit="red", shade="plum"):
    """24x24 nine-slice, 8px corners: ui.py's chrome plate (hit_label)."""
    import ui

    return ui.hit_label(face, lit, shade)


# ---------- dog status overlays ----------



def status_stinky(size, step):
    """Wavy lines rising 2px a frame over an 8px wave, so 4 frames loop with no seam. Pink, each whole
    squiggle rimmed in plum, so the pink carries Woof Way and the plum the light roads: the skunk's mauve
    family, as skunk-cloud and fx-hit-skunk. The lines sit
    1px in from every edge, so the rim closes round them, and wave in step (the middle one a row ahead),
    so neighbouring rims never close the gap between them."""
    g = Grid(size, size)
    lines = {16: ((2, 0), (7, 1), (12, 0)), 12: ((2, 0), (8, 1)), 8: ((4, 0),)}[size]
    top, bottom = {16: (2, 14), 12: (1, 11), 8: (1, 7)}[size]
    for x0, ph in lines:
        for y in range(top, bottom):
            k = (y + 2 * step + ph) % 8
            if k == 7 or (size == 8 and k == 3):
                continue
            g.p(x0 + WAVE[k], y, "pink")
    return rim(g, "plum")


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


# Each burst: its drawing, its frame count, its comic word and the row its impact star is centred on.
HITS = {
    "fx-hit-skunk": (hit_skunk, 8, "PEE-YEW!", 32),
    "fx-hit-puddle": (hit_puddle, 7, "SPLOSH!", 40),
    "fx-hit-thief": (hit_thief, 8, "YOINK!", 40),
    "fx-hit-squirrel": (hit_squirrel, 7, "CHITTER!", 32),
    "fx-hit-other-dog": (hit_other_dog, 8, "SNIFF!", 38),
    "fx-hit-picnic": (hit_picnic, 8, "CHOMP!", 40),
    "fx-hit-goose": (hit_goose, 8, "HONK!", 36),
    "fx-hit-petunias": (hit_petunias, 8, "SQUISH!", 42),
    "fx-hit-trash": (hit_trash, 8, "CLANG!", 40),
    "fx-hit-cafe": (hit_cafe, 8, "SPLAT!", 40),
}
# The word shows on frames 0 to 5 (420ms at 70ms), then the last frames play out without it.
WORD_FRAMES = 6


def worded(g, text, cy, step):
    """A burst frame with its comic word over it, centred on the impact star, while the word shows."""
    return word(g, text, 32, cy - 5) if step < WORD_FRAMES else g


def sizes(key, draw, ms):
    for size, suffix in ((16, ""), (12, "@75"), (8, "@50")):
        yield f"{key}{suffix}", [("loop", [draw(size, i).outlined(False) for i in range(4)], ms)]


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    for key, (draw, frames, text, cy) in HITS.items():
        yield key, [("play", [draw(i).outlined(False) for i in range(frames)], 70),
                    ("play-word", [worded(draw(i), text, cy, i).outlined(False) for i in range(frames)], 70)]
    yield "fx-lemonade", [("play", [lemonade_pop(i).outlined(False) for i in range(8)], 70)]
    for colour in FLASH:
        yield f"ui-hit-flash-{colour}", [("play", [flash(colour, i).outlined(False) for i in range(4)], 70)]
    yield "ui-hit-label", [(tag, [label_plate(*cols).outlined(False)], 1000) for tag, cols in PLATES.items()]
    yield from sizes("fx-status-stinky", status_stinky, 180)
    yield from sizes("fx-status-soaked", status_soaked, 150)
    yield from sizes("fx-status-spooked", status_spooked, 150)


if __name__ == "__main__":
    main(sys.argv, sprites, "art/hits", __doc__, grounds=ROADS)
