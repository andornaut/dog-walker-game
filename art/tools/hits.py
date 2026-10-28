#!/usr/bin/env python3
"""Draw the encounter hit moments: a burst over the pack per encounter, the screen-edge
flash in the encounter's colour and the plate behind the big label. Bursts carry a 1px
plum rim so they hold 3:1 on the three light roads while their fills carry the dslate
road. The flash strips pair a light ink (or, for mauve, a pink rim) with a dark fringe
for the same reason. The encounters' hits match their road sprites in road.py. The
bursts are laid out on a 64x64 design and drawn 77/64 times bigger on a minis.Mini, so
they keep 1px lines 1px; their pixel maps and twinkles keep their pixels. Every burst
opens on an impact frame (impact): an eight-point star in its colour with a white core
and white speed lines.

fx-hit-skunk       77x77  play (8 frames, 70ms)  lumpy mauve gas cloud that thins to a dither, wisps
                                                  and stink squiggles
fx-hit-thief       77x77  play (8 frames, 70ms)  the tip pouch flying up out of a poof, three coins
                                                  thrown out
fx-hit-other-dog   77x77  play (8 frames, 70ms)  tangle cloud, fur tufts and hearts
ui-hit-flash-sky, -amber, -mauve, -orange, -pink
                   16x64  play (4 frames, 70ms)  left screen-edge strip, solid at x=0,
                          4x4 ordered dither to clear by x=15; tiles vertically, the
                          game mirrors it for the right edge
ui-hit-label       24x24  normal, lucky (1 frame each)  nine-slice, 8px corners: a dred
                          (normal) or blue (lucky) plate in ui.py's chrome (a cream band),
                          stretched to 176x32 for every label; white font-title text at 2x,
                          centred, its line top 3px below the plate's top so the 10px caps sit
                          in rows 11 to 20

Usage:
  hits.py preview OUT.png   every frame of every piece on the zone roads
  hits.py build             write art/hits/*.aseprite and export to
                            public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py,
the rim, burst, twinkle and heart helpers in fx.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fx import HEART, SMALL, burst  # noqa: E402
import fx  # noqa: E402
from pixel import Grid, main, raster, scale_of  # noqa: E402

BAYER = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))
# A sideways wobble with an 8px period: a line rising 2px a frame loops seamlessly in 4 frames.
WAVE = (0, 1, 1, 1, 0, -1, -1, -1)


# The bursts are laid out on a 64x64 design and drawn BURST_SCALE times bigger, 77x77, on a minis.Mini that
# keeps 1px lines 1px (burst_frame). Pixel maps, twinkles and the rim go on the drawn grid
# pixel for pixel, at the drawn place of their design position, so they keep their pixels.
BURST = 64
BURST_SCALE = 77 / BURST
# How much bigger frame 0's impact star is than its base radius, 16, for punch.
IMPACT = 1.25


def drawn_at(g, x, y):
    """Where design point (x, y) lands on g's pixels: scaled to the nearest pixel on a minis.Mini, else itself."""
    s = getattr(g, "s", None)
    return (round(x * s), round(y * s)) if s else (x, y)


def rim(g, col="plum"):
    """fx.rim on the grid that holds g's pixels, so a burst's rim is 1px at its drawn size."""
    fx.rim(raster(g), col)
    return g


def stamp(g, rows, x0, y0, cols=("red", "pink", "dred")):
    """fx.stamp pixel for pixel from the drawn place of (x0, y0)."""
    fx.stamp(raster(g), rows, *drawn_at(g, x0, y0), cols)


def star4(g, cx, cy, r, col):
    """fx.star4 on the drawn grid, centred at the drawn place of (cx, cy), its arms r scaled."""
    fx.star4(raster(g), *drawn_at(g, cx, cy), round(r * scale_of(g)), col)


def dots(g, x0, y0, pts):
    """(dx, dy, colour) pixels from the drawn place of (x0, y0), pixel for pixel."""
    x, y = drawn_at(g, x0, y0)
    for dx, dy, c in pts:
        raster(g).p(x + dx, y + dy, c)


def burst_frame(draw, step):
    """A burst's frame step: draw(step) laid out on BURST x BURST and drawn BURST_SCALE times bigger."""
    import minis  # imported when first used, so feedback, moments and needs, which import hits, don't load it

    return minis.small(sys.modules[__name__], BURST_SCALE, draw, step)


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


def impact(g, outer, cx=32, cy=32):
    """Frame 0 of every burst: an eight-point star in the encounter's colour with a white core, IMPACT times
    16 in radius, and a white speed line flying out between each pair of its points."""
    r = 16 * IMPACT
    for k in range(8):
        a = math.radians(k * 45 + 11 - 90 + 22.5)  # between the points, as burst turns them 11 degrees
        (x0, y0), (x1, y1) = (drawn_at(g, cx + math.cos(a) * d, cy + math.sin(a) * d) for d in (r, r * 1.3))
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            raster(g).p(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), "white")
    burst(g, cx, cy, r, r * 0.4, 8, outer, 11)
    burst(g, cx, cy, r * 0.62, r * 0.25, 8, "yellow", 11)
    g.ell(cx, cy, r * 0.25, r * 0.25, "white")


# ---------- hit bursts ----------

def hit_skunk(step):
    """The cloud swells in seven lobes, each with a scalloped rim of smaller puffs, then the lobes drift apart,
    shrink and thin to a dither as the gas clears, trailing dithered wisps. Mauve, as skunk-cloud: the puffs
    mauve, shaded purple on their lower right and lit pink on their upper left, so the pink carries the dslate
    road and the plum rim the light roads. Stink squiggles rise out of it, pink with a plum side, so they read
    over the cloud and on every road."""
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
    # the seams, shading, dither, wisps and squiggles are laid on the drawn pixels
    px, w, h = raster(g), raster(g).w, raster(g).h
    mass = [row[:] for row in px.px]
    front = [(cx, cy, rk) for k, (cx, cy, rk, _) in enumerate(lobes) if k % 2 == 0] + ([(32, 33, core)] if core else [])
    for cx, cy, pr in front:
        for deg in range(0, 100, 2):
            a = math.radians(deg)
            x, y = drawn_at(g, cx + math.cos(a) * (pr - 0.5), cy + math.sin(a) * (pr - 0.5))
            if 2 <= x < w - 2 and 2 <= y < h - 2 and all(mass[y + dy][x + dx]
                                                         for dx in (-2, 0, 2) for dy in (-2, 0, 2)):
                px.p(x, y, "purple")
    # shade the lower-right edge of every puff, so the lumps read and overlapping lobes read as one mass, and
    # light the mass's upper-left edge pink
    lit = [row[:] for row in px.px]
    for y in range(h - 2):
        for x in range(w - 2):
            if lit[y][x] and not (lit[y + 1][x + 1] and lit[y + 2][x + 2]):
                px.p(x, y, "purple")
            elif lit[y][x] and (x == 0 or y == 0 or not lit[y - 1][x] or not lit[y][x - 1]):
                px.p(x, y, "pink")
    if 1 <= step < 4:
        g.ell(32 - core * 0.35, 33 - core * 0.4, core * 0.3, core * 0.2, "pink")
        g.ell(32 - core * 0.3, 33 - core * 0.3, core * 0.3, core * 0.2, "mauve")
    rim(g, "plum")
    if step >= 5:
        # clearing: the inside thins to a checker dither, the solid rim and the edge just inside it stay
        solid = [row[:] for row in px.px]
        for y in range(2, h - 2):
            for x in range(2, w - 2):
                if all(solid[y + dy][x + dx] for dx in (-2, 0, 2) for dy in (-2, 0, 2)) and (x + y + step) % 2:
                    px.p(x, y, None)
    if step >= 2:
        # wisps curling off the cloud, dithered: alternate pixels pink and plum, so they hold on every road,
        # with a second strand on alternate pixels at the base
        t = step - 2
        for deg, curl in ((200, 1), (330, -1), (60, 1), (140, -1), (265, 1)):
            a = math.radians(deg + step * 5)
            r0 = d + r + 1 + t * 2
            for i in range(6 + t):
                b = a + curl * i * 0.1
                rr = r0 + i * 1.2
                x, y = drawn_at(g, 32 + math.cos(b) * rr, 33 + math.sin(b) * rr * 0.9)
                for k, (dx, dy) in enumerate(((0, 0), (1, 1)) if i < 3 else ((0, 0),)):
                    xx, yy = x + dx, y + dy
                    if 1 <= xx < w - 1 and 1 <= yy < h - 1 and not px.px[yy][xx] and (k == 0 or i % 2):
                        px.p(xx, yy, "pink" if (i + k) % 2 == 0 else "plum")
    if step >= 1:
        # five rising S-lines: 2px a frame up over an 8px wave, the outer ones leaning out
        rise = (0, 0, 4, 8, 12, 15, 18, 20)[step]
        length = (0, 5, 8, 9, 9, 8, 6, 4)[step]
        sc = scale_of(g)
        for j, (x0, y0, lean) in enumerate(((14, 26, -1), (22, 20, -0.5), (32, 17, 0), (42, 20, 0.5), (50, 26, 1))):
            for t in range(round(length * sc)):
                x, y = drawn_at(g, x0 + lean * (rise + t / sc) * 0.4, y0 - rise)
                x, y = x + WAVE[(t + j * 3 + step * 2) % 8], y - t
                if 1 <= y < h - 1:
                    px.p(x, y, "pink")
                    px.p(x + 1, y, "plum")
    return g


def pouch(g, cx, cy, tilt):
    """The walker's tip pouch as road.py's thief carries it, about 11x15: a green cloth body lit lime and
    shaded forest, its neck gathered under a cream drawstring, the frill above it flared, the drawstring's
    two ends tied off at the top and a yellow coin with an amber centre on its face; tilt swings the neck
    and frill a pixel as the pouch tumbles."""
    g.cel(cx, cy, 5.5, 5, "green", "forest", "lime")
    g.rect(cx - 1.5 + tilt / 2, cy - 6.5, 3, 2, "green")
    g.tri((cx - 3.5 + tilt, cy - 9.5), (cx + 3.5 + tilt, cy - 9.5), (cx + tilt / 2, cy - 5.5), "green")
    g.rect(cx - 3 + tilt, cy - 9.5, 2, 1, "lime")
    g.rect(cx + 1.5 + tilt, cy - 9.5, 2, 1, "forest")
    g.rect(cx - 2 + tilt / 2, cy - 6, 4, 1, "cream")
    g.p(cx - 3 + tilt, cy - 11, "cream")
    g.p(cx + 2 + tilt, cy - 11, "cream")
    g.p(cx - 2 + tilt, cy - 10.2, "cream")
    g.p(cx + 1 + tilt, cy - 10.2, "cream")
    g.cel(cx - 0.5, cy + 0.5, 2.5, 2.5, "yellow", "amber")
    x, y = drawn_at(g, cx - 0.5, cy + 0.5)
    raster(g).p(x, y, "amber")


def coin(g, x, y, spin):
    rx = (3, 2, 0.8, 2)[spin % 4]
    g.ell(x, y, rx + 0.5, 3.5, "amber", "orange", "yellow")
    if spin % 4 != 2:
        g.p(x - 1, y - 1, "white")


def hit_thief(step):
    """A dust poof; the snatched tip pouch shoots straight up out of it while three coins fly out and fall.
    No second ring of puffs, so the pouch carries the moment."""
    g = Grid(64, 64)
    cx, cy = 32, 40
    if step == 0:
        impact(g, "amber", cx, cy)
        return rim(g)
    pr = (0, 10, 13, 14, 11, 7, 0, 0)[step]
    if pr:
        piece(g, lambda p: [p.ell(cx + dx * pr / 12, cy + dy * pr / 12, pr * 0.55, pr * 0.5, "white", "lgrey")
                            for dx, dy in ((-7, 2), (7, 2), (0, -5), (0, 5), (-4, -3), (4, -3))])
    wy = (0, 32, 23, 17, 14, 13, 13, 14)[step]
    tilt = (0, 0, 1, 0, -1, 0, 1, 0)[step]
    t = step - 0.5
    for i, (vx, vy) in enumerate(((-9, -6), (9, -6), (-5, -9.5))):
        x, y = cx + vx * t * 0.85, cy - 4 + vy * t * 0.85 + 1.2 * t * t
        if 3 <= y < 60 and 3 <= x < 61:
            piece(g, lambda p: coin(p, x, y, step + i))
    piece(g, lambda p: pouch(p, cx, wy + 2, tilt))
    return g


TUFTS = ("cream", "white", "tan", "lgrey", "brown", "grey")


def tuft(g, x, y, col, flip):
    dots(g, x, y, [(dx, dy, col) for dx, dy in ((0, 0), (1, 1), (2, 0), (1, 2), (3, -1) if flip else (-1, -1))])


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
        for x0, delay in ((24, 0), (36, 1), (30, 2)):
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

# Each strip's ink, its dark fringe and, where the ink holds under 3:1 on the dark roads, a light rim one
# step up its ramp (mauve's pink, 3.52:1 on dslate).
FLASH = {"sky": ("cyan", "navy", None), "amber": ("amber", "plum", None),
         "mauve": ("mauve", "plum", "pink"), "orange": ("orange", "plum", None), "pink": ("pink", "plum", None)}


def flash(colour, step):
    """16x64, the left screen edge: solid at x=0, an ordered 4x4 dither that clears inward. Each lit
    pixel in the sparse inner half with a gap inward of it gets a dark fringe there, and takes the light rim
    itself where the strip has one; the light ink (or rim) carries the dark roads, 3:1 or more, and the dark
    fringe the light roads. Later frames recede toward the edge."""
    ink, fringe, light = FLASH[colour]
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
                if light:
                    g.p(x - 1, y, light)
    return g


# ---------- label plate ----------

# The plate's face, its lit edge and its shaded edge: dred for an encounter, blue for a lucky find.
PLATES = {"normal": ("dred", "red", "plum"), "lucky": ("blue", "sky", "navy")}


def label_plate(face, lit, shade):
    """ui-hit-label's 24x24 nine-slice, 8px corners: ui.py's chrome plate (dred for normal, blue for lucky),
    stretched to 176x32. White text holds 7.34:1 on dred and 8.48:1 on blue; the cream band carries the
    dslate road and the ink line the light roads."""
    import ui

    return ui.plate(face, lit, shade)


# Each burst: its drawing and its frame count.
HITS = {
    "fx-hit-skunk": (hit_skunk, 8),
    "fx-hit-thief": (hit_thief, 8),
    "fx-hit-other-dog": (hit_other_dog, 8),
}


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    for key, (draw, frames) in HITS.items():
        yield key, [("play", [burst_frame(draw, i).outlined(False) for i in range(frames)], 70)]
    for colour in FLASH:
        yield f"ui-hit-flash-{colour}", [("play", [flash(colour, i).outlined(False) for i in range(4)], 70)]
    yield "ui-hit-label", [(tag, [label_plate(*cols).outlined(False)], 1000) for tag, cols in PLATES.items()]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/hits", __doc__)
