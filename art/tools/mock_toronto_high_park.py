#!/usr/bin/env python3
"""Mock: High Park as a Toronto zone, on the tall backdrop band and the tilted camera.

Writes, in Endesga 32, from the exported art and new drawings:

- high-park-walk.png (360x560): the walk screen. The top bar; a 174-row backdrop on rows 40 to
  213 (a calm flat sky down to row 61; the CN Tower and downtown far off, Bloor Street's apartment
  slabs over the tree line, Grenadier Pond with swans and cherry blossom on its east bank,
  Colborne Lodge on its hill, the Hillside Gardens maple leaf, the zoo's bison and capybaras, a
  HIGH PARK sign where the drive meets the cross path); the park drive under the camera, grey
  asphalt dusted with cherry petals; the pond along the left verge and a dirt side trail on the
  right; the new roadside props on both verges at their depth; the walker and pack, a goose, a
  log, a treat and tips; and the doghouse row.
- high-park-props.png: each new roadside prop at 2x on the verge's green, labelled.

The camera is the tall band's: horizon -36, feet on row 464, focal 720, the road's far edge on
row 214 at scale 0.5. layout.json still holds the short band, so the script sets the tall band's
regions and camera on scene.py's copy before backdrops.py reads them.

Props are drawn as roadside.py draws its own: front elevations on a design grid at 1.75x, outlined
with road_edge, here redrawn at each prop's projected scale.

Usage:
  mock_toronto_high_park.py build   write public/art/mocks/toronto/high-park-*.png

Run from the repository root. Mock tooling only: nothing here is game art.
"""

import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import mock_toronto as mt  # noqa: E402
import scene as sn  # noqa: E402

# The tall band and the tilted camera, set before backdrops.py reads the layout.
L = sn.LAYOUT
L["regions"]["backdrop"]["height"] = 174
L["regions"]["approach"].update(y=195, height=19)
L["regions"]["road"].update(y=214, height=256)
L["camera"].update(horizonY=-36, farY=214)

import backdrops as bd  # noqa: E402
from minis import Mini  # noqa: E402
from pixel import K, edged  # noqa: E402

OUT = "public/art/mocks/toronto"
W, H = 360, 560
BAND_Y, FAR_Y, FOOT_Y, DOG_BAND_Y = 40, 214, 464, 466
YH, F, CX = -36, 720, 180
KS = FOOT_Y - YH
SCALE = 1.75
DOGS = ("koda", "biscuit", "duchess")
ROAD = 160                     # half the road's width, in road px


def use_camera():
    mt.W, mt.H, mt.OX, mt.TOP = W, H, 0, 0
    mt.YH, mt.F, mt.KS = YH, F, KS


# ---------- the ground: one painter for the band's stub and the road below it ----------
# x is across from the road's centre line (negative on the left), z along the road ahead of the
# feet, both in road px. Texture is anchored to the world, so the stub and the road join.

def n(*v):
    return bd.noise(*(int(math.floor(a)) for a in v))


# Grenadier Pond along the left verge: open water past the shore, which runs out round each
# cherry tree's spit of land. CHERRY_Z are the left cherry trees' z.
CHERRY_Z = (330, 600)


def shore(z):
    return 200 + sum(120 * math.exp(-((z - c) / 60) ** 2) for c in CHERRY_Z)


def trail(z):
    """The right verge's dirt side trail: its centre across, or None where it has ended."""
    return None if z > 660 else 190 + 8 * math.sin(z / 150)


def drive(x, z):
    """The park drive: grey asphalt with slate and light flecks, white lane dashes with a slate
    edge, a worn slate edge, cherry petals on top."""
    a = abs(x)
    for d in (-96, -32, 32, 96):
        if d - 1 <= x < d + 1 and z % 32 < 14:
            return "white"
        if d + 1 <= x < d + 2 and z % 32 < 14:
            return "slate"
    if a >= ROAD - 3:
        return "slate"
    p = n(x / 2, z / 2)
    if p < 0.012:
        return "pink"
    return "slate" if n(x, z + 7) < 0.025 else "grey"


def lawn(x, z):
    """The park's grass: tufts, a few dandelions and stray petals, thinning far off."""
    p = n(x / 3, z / 3)
    if p < 0.05:
        return "dgreen"
    if p < 0.054:
        return "yellow"
    if p < 0.058 and abs(x) < 260:
        return "pink"
    return "green"


def ground(x, z):
    a = abs(x)
    if a < ROAD:
        return drive(x, z)
    if x < 0:
        edge = shore(z)
        if a >= edge + 4:
            deep = a - edge
            if n(x / 6, z / 2) < 0.06:
                return "cyan" if deep < 70 else "sky"
            return "sky" if deep < 26 else "blue"
        if a >= edge:
            return "brown" if a >= edge + 2 else "forest"
    else:
        t = trail(z)
        if t is not None and abs(a - t) < 13:
            return "brown" if abs(a - t) >= 11 or n(x / 2, z / 2) < 0.08 else "tan"
    return lawn(x, z)


def painter(x, z, span, px, py):
    return ground(x, z)


# ---------- the backdrop ----------

def leaf_map():
    return ["......X......", ".....XXX.....", "..X..XXX..X..", "..XX.XXX.XX..", "X.XXXXXXXXX.X",
            "XXXXXXXXXXXXX", ".XXXXXXXXXXX.", "..XXXXXXXXX..", ".XXXXXXXXXXX.", "XXXX.XXX.XXXX",
            "......X......", "......X......"]


def blossom(cv, cx, cy, r, trunk_to):
    """A small cherry tree in flower: a dark trunk and a pink crown, mauve on its lower right and
    white flecks on its upper left."""
    cv.fill(cx - 1, cy, 2, trunk_to - cy, "plum")
    for dy in range(-r, r + 1):
        for dx in range(-r - 2, r + 3):
            e = (dx / (r + 2)) ** 2 + (dy / r) ** 2
            if e <= 1:
                c = "mauve" if dx + dy > r * 0.6 else "white" if dx + dy < -r * 0.9 and bd.hashed(cx + dx, cy + dy, 3) else "pink"
                cv.fill(cx + dx, cy + dy, 1, 1, c)


def far_oak(cv, cx, base, r=10):
    """A black oak far off: a crooked trunk and an open, flat-topped crown in clumps."""
    cv.fill(cx - 1, base - r - 4, 3, r + 4, "dbrown")
    cv.fill(cx - 5, base - r - 2, 4, 1, "dbrown")
    cv.fill(cx + 2, base - r - 4, 5, 1, "dbrown")
    for ox, oy, rx, ry in ((-6, -r - 5, 6, 4), (2, -r - 9, 8, 5), (8, -r - 4, 5, 3), (-1, -r - 2, 4, 2)):
        for dy in range(-ry, ry + 1):
            for dx in range(-rx, rx + 1):
                if (dx / rx) ** 2 + (dy / ry) ** 2 <= 1:
                    c = "forest" if dx + dy > rx * 0.5 else "green" if dx + dy < -rx * 0.8 else "dgreen"
                    cv.fill(cx + ox + dx, base + oy + dy, 1, 1, c)


def tiny_walker(cv, x, base, coat, dog):
    """A dog walker far off, 8 rows tall, with a dog on a leash beside her."""
    cv.fill(x, base - 8, 2, 2, "skin1")
    cv.fill(x, base - 6, 2, 4, coat)
    cv.fill(x, base - 2, 1, 2, "navy")
    cv.fill(x + 1, base - 2, 1, 2, "navy")
    cv.fill(x + 2, base - 4, 3, 1, "plum")
    cv.fill(x + 5, base - 3, 3, 2, dog)
    cv.fill(x + 7, base - 4, 1, 1, dog)
    cv.fill(x + 5, base - 1, 1, 1, dog)
    cv.fill(x + 7, base - 1, 1, 1, dog)


def backdrop():
    cv = sn.Canvas(bd.W, bd.H)
    B = bd.BASE
    bd.sky(cv, clouds=((24, B - 58, 34, 6), (150, B - 64, 16, 3), (232, B - 60, 28, 4)))
    # downtown far off to the east: the CN Tower over a cluster of towers
    for x, w, h, c in ((262, 7, 14, "grey"), (270, 6, 22, "lgrey"), (277, 8, 17, "grey"), (288, 5, 26, "lgrey"),
                       (294, 7, 19, "grey"), (304, 6, 13, "lgrey"), (326, 7, 20, "grey"), (334, 5, 15, "lgrey"),
                       (340, 8, 24, "grey"), (349, 6, 12, "lgrey")):
        cv.fill(x, B - 31 - h, w, h, c)
        cv.fill(x + w - 1, B - 31 - h, 1, h, bd.dk(c))
    tx = 316
    cv.fill(tx, B - 64, 3, 34, "lgrey")
    cv.fill(tx + 2, B - 64, 1, 34, "grey")
    cv.fill(tx - 3, B - 54, 9, 4, "grey")
    cv.fill(tx - 2, B - 55, 7, 1, "lgrey")
    cv.fill(tx - 1, B - 50, 5, 1, "slate")
    cv.fill(tx, B - 59, 3, 2, "grey")
    cv.fill(tx + 1, B - 69, 1, 5, "slate")
    # Bloor Street's apartment slabs over the trees to the north-west
    for x, w, h, c in ((10, 22, 26, "lgrey"), (36, 16, 18, "cream"), (58, 26, 30, "lgrey"), (90, 14, 16, "tan")):
        top = B - 30 - h
        cv.fill(x, top, w, h, c)
        cv.fill(x + w - 2, top, 2, h, bd.dk(c))
        cv.fill(x, top, w, 1, bd.dk(c))
        for wy in range(top + 3, B - 32, 4):
            for wx in range(x + 2, x + w - 3, 3):
                cv.fill(wx, wy, 2, 2, "slate")
    # the far tree line and the slope down to the pond
    bd.treeline(cv, B - 28, ("forest", "dgreen"), 1.3, 3, 7)
    cv.fill(0, B - 28, bd.W, bd.CROSS - B + 28, "green")
    bd.treeline(cv, B - 22, ("dgreen", "green"), 4.1, 2, 6)
    # Grenadier Pond on the left, the far bank's trees mirrored dark in it, two swans
    for py in range(B - 20, B - 3):
        for px in range(0, 150):
            e = ((px + 0.5 - 62) / 92) ** 2 + ((py + 0.5 - (B - 11)) / 9) ** 2
            if e <= 1:
                c = "blue" if py < B - 16 else "white" if bd.hashed(px, py, 19) else "cyan" if bd.hashed(px, py, 7) else "sky"
                cv.fill(px, py, 1, 1, c)
    for sx, sy in ((40, B - 12), (70, B - 9)):
        cv.fill(sx, sy, 5, 2, "white")
        cv.fill(sx, sy - 3, 1, 3, "white")
        cv.fill(sx - 1, sy - 3, 1, 1, "orange")
        cv.fill(sx, sy + 2, 5, 1, "lgrey")
    # cherry blossom along the pond's east bank
    for cx, cy, r in ((112, B - 22, 6), (128, B - 26, 8), (146, B - 21, 7), (100, B - 14, 5), (138, B - 12, 6)):
        blossom(cv, cx, cy, r, cy + r + 5)
    # Colborne Lodge on its hill: a cream Regency cottage, its great chimney, a veranda
    lx, lb = 224, B - 14
    for py in range(lb - 4, lb + 3):
        half = 30 - (lb + 3 - py) * 2
        cv.fill(lx + 22 - half, py, 2 * half, 1, "green")
    cv.fill(lx, lb - 12, 44, 12, "cream")
    cv.fill(lx + 41, lb - 12, 3, 12, "tan")
    for k in range(6):
        cv.fill(lx - 3 + k * 3, lb - 13 - k, 50 - k * 6, 1, "dslate")
    cv.fill(lx + 19, lb - 27, 6, 10, "brown")
    cv.fill(lx + 18, lb - 28, 8, 2, "dbrown")
    for wx in (lx + 5, lx + 15, lx + 27, lx + 35):
        cv.fill(wx, lb - 10, 4, 5, "plum")
        cv.fill(wx + 1, lb - 9, 2, 3, "cyan")
        cv.fill(wx - 1, lb - 10, 1, 5, "dgreen")
        cv.fill(wx + 4, lb - 10, 1, 5, "dgreen")
    cv.fill(lx - 2, lb - 4, 48, 1, "forest")
    for vx in range(lx - 1, lx + 46, 5):
        cv.fill(vx, lb - 3, 1, 3, "white")
    cv.fill(lx + 20, lb - 6, 4, 6, "dred")
    # Hillside Gardens' maple leaf on the slope, edged in white flowers
    mx, my = 186, B - 18
    for r, row in enumerate(leaf_map()):
        for c, ch in enumerate(row):
            if ch == "X":
                cv.fill(mx + c, my + r, 1, 1, "red" if c < 9 else "dred")
    for px in range(mx - 3, mx + 16, 2):
        cv.fill(px, my - 2, 1, 1, "white")
        cv.fill(px + 1, my + 13, 1, 1, "white")
    # the zoo on the right: a paddock rail, a bison and a llama, capybaras by their pool
    bx, bb = 300, B - 3
    cv.fill(bx, bb - 9, 13, 6, "dbrown")
    cv.fill(bx + 9, bb - 7, 7, 4, "brown")
    cv.fill(bx - 4, bb - 8, 5, 6, "plum")
    cv.fill(bx - 4, bb - 9, 1, 1, "cream")
    cv.fill(bx, bb - 3, 2, 3, "plum")
    cv.fill(bx + 11, bb - 3, 2, 3, "plum")
    cv.fill(bx + 26, bb - 13, 2, 5, "cream")
    cv.fill(bx + 26, bb - 9, 7, 4, "cream")
    cv.fill(bx + 26, bb - 5, 1, 5, "tan")
    cv.fill(bx + 32, bb - 5, 1, 5, "tan")
    cv.fill(bx + 25, bb - 14, 1, 2, "tan")
    for py in range(bb - 4, bb):
        cv.fill(bx + 42 - (py - bb + 4), py, 14 + 2 * (py - bb + 4), 1, "sky")
    for cx in (bx + 38, bx + 57):
        cv.fill(cx, bb - 4, 6, 3, "brown")
        cv.fill(cx - 1, bb - 4, 2, 2, "dbrown")
        cv.fill(cx + 1, bb - 1, 1, 1, "dbrown")
        cv.fill(cx + 4, bb - 1, 1, 1, "dbrown")
    for x in range(266, bd.W, 9):
        cv.fill(x, B - 6, 2, 8, "dbrown")
    cv.fill(266, B - 5, bd.W - 266, 1, "brown")
    cv.fill(266, B - 1, bd.W - 266, 1, "brown")
    # savannah oaks, people out walking dogs, a jogger
    for cx, base, r in ((282, B - 10, 9), (14, B + 4, 12), (350, B - 8, 10)):
        far_oak(cv, cx, base, r)
    tiny_walker(cv, 96, B + 2, "red", "tan")
    tiny_walker(cv, 236, B + 1, "sky", "dbrown")
    cv.fill(160, B - 6, 2, 2, "skin1")
    cv.fill(160, B - 4, 2, 3, "orange")
    cv.fill(159, B - 1, 1, 1, "navy")
    cv.fill(162, B - 2, 1, 1, "navy")
    # the HIGH PARK sign where the drive ends: a brown board on two posts, cream letters
    for x in (CX - 30, CX + 28):
        cv.fill(x, B - 26, 3, 30, "dbrown")
    cv.fill(CX - 34, B - 32, 68, 14, "dbrown")
    cv.fill(CX - 33, B - 31, 66, 12, "brown")
    cv.fill(CX - 33, B - 31, 66, 1, "tan")
    bd.word(cv, "HIGH PARK", CX, B - 29, "cream")
    # the cross path, the stub, the boardwalk rail by the pond
    bd.cross(cv, bd.flat(lambda x, z, span, px, py: drive(x, 40)), "slate",
             lambda px, py: lawn(px * 3, py * 5), curb=None, top=bd.CROSS)
    bd.cross_line(cv, "white", "lgrey", dash=(14, 32))
    bd.street(cv, painter)
    bd.rail(cv, *bd.PERCH_X, bd.PERCH)
    return cv.img


# ---------- the new roadside props, in design units (drawn at 1.75x) ----------
# Each is (w, h, draw(g)); the ground row is h - 2, and the outer ring stays clear for the outline.

def limb(g, pts, t, col):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        steps = max(1, int(max(abs(x1 - x0), abs(y1 - y0))))
        for i in range(steps + 1):
            g.rect(x0 + (x1 - x0) * i / steps - t / 2, y0 + (y1 - y0) * i / steps - t / 2, t, t, col)


def clumps(g, lobes, shade, light, base):
    for cx, cy, rx, ry in lobes:
        g.ell(cx, cy, rx, ry, shade)
    for cx, cy, rx, ry in lobes:
        g.ell(cx - 2, cy - 2, rx - 2, ry - 2, light)
    for cx, cy, rx, ry in lobes:
        g.ell(cx - 1, cy - 1, rx - 3, ry - 3, base)


def oak(critters=False):
    """A black oak of the savannah: a crooked trunk, low spreading limbs and an open, flat-topped
    crown in dark clumps; with critters, a raccoon peering from a hollow and a black squirrel up
    the trunk."""
    w, h = 100, 112

    def draw(g):
        base = h - 2
        limb(g, [(46, base - 2), (44, 86), (47, 70), (44, 58)], 9, "dbrown")
        g.rect(36, base - 4, 20, 4, "dbrown")
        limb(g, [(44, 70), (30, 60), (18, 50)], 5, "dbrown")
        limb(g, [(47, 78), (62, 70), (76, 72), (84, 64)], 5, "dbrown")
        limb(g, [(46, 62), (58, 46), (74, 38)], 4, "dbrown")
        limb(g, [(44, 60), (40, 40), (34, 28)], 4, "dbrown")
        g.rect(48, 60, 3, base - 62, "plum")
        clumps(g, ((14, 48, 13, 9), (32, 30, 18, 12), (56, 20, 20, 13), (78, 32, 17, 11), (86, 56, 11, 7),
                   (22, 64, 9, 5), (64, 48, 13, 7), (40, 46, 12, 7)), "forest", "green", "dgreen")
        for x, y in ((28, 34), (62, 28), (78, 40), (18, 50)):
            g.rect(x, y, 3, 2, "forest")
        limb(g, [(52, 50), (60, 44)], 3, "dbrown")
        limb(g, [(32, 56), (24, 54)], 3, "dbrown")
        if critters:
            g.ell(45, 82, 5, 6, "ink")
            g.tri((40, 79), (43, 79), (41, 75), "grey")
            g.tri((47, 79), (50, 79), (49, 75), "grey")
            g.ell(45, 82, 5, 3.5, "lgrey")
            g.rect(40, 81, 10, 2, "ink")
            g.rect(42, 81, 1, 1, "white")
            g.rect(47, 81, 1, 1, "white")
            g.rect(44, 84, 2, 1, "ink")
            # the black squirrel, head up the trunk's right side, its tail curling out
            g.ell(56, 92, 3, 5, "navy")
            g.ell(56, 86, 2.5, 2.5, "navy")
            g.rect(55, 83, 1, 2, "navy")
            g.rect(57, 85, 1, 1, "white")
            g.ell(59, 99, 3, 5, "navy")
            g.ell(61, 94, 2, 3, "navy")
            g.rect(55, 89, 1, 5, "dslate")
            g.rect(53, 90, 2, 1, "navy")
            g.rect(53, 95, 2, 1, "navy")
    return w, h, draw


def cherry():
    """A Japanese cherry in full bloom: a dark spreading trunk under a wide umbrella of blossom,
    petals falling and a pink carpet of them on the grass."""
    w, h = 104, 100

    def draw(g):
        base = h - 2
        g.ell(52, base - 1.5, 30, 2.5, "pink")
        for x in (28, 40, 56, 70):
            g.rect(x, base - 2, 2, 1, "white")
        limb(g, [(52, base - 3), (51, 74), (53, 62)], 7, "dbrown")
        limb(g, [(51, 66), (36, 52), (22, 46)], 4, "dbrown")
        limb(g, [(53, 64), (68, 50), (84, 44)], 4, "dbrown")
        limb(g, [(52, 62), (50, 40)], 3, "dbrown")
        g.rect(54, 62, 2, base - 64, "plum")
        clumps(g, ((20, 44, 16, 11), (38, 28, 18, 12), (64, 26, 19, 12), (84, 42, 16, 11), (52, 46, 22, 10)),
               "mauve", "white", "pink")
        for x, y in ((28, 38), (46, 22), (58, 34), (74, 30), (88, 46), (16, 48), (40, 46), (66, 48)):
            g.rect(x, y, 2, 2, "white")
        for x, y in ((40, 58), (78, 62), (24, 74), (86, 80), (66, 84)):
            g.rect(x, y, 2, 2, "pink")
        for x, y in ((14, 64), (72, 72), (34, 86)):
            g.rect(x, y, 2, 2, "white")
    return w, h, draw


def cattails():
    """Reeds and cattails at the pond's edge, a red-winged blackbird on the tallest."""
    w, h = 48, 64

    def draw(g):
        base = h - 2
        g.rect(3, base - 2, w - 6, 3, "sky")
        for x, top, lean, c in ((8, 26, -3, "dgreen"), (14, 18, 2, "green"), (22, 30, -2, "dgreen"),
                                (30, 22, 4, "green"), (37, 32, 3, "dgreen"), (19, 36, -5, "green"), (34, 40, 5, "green")):
            g.tri((x - 2, base - 1), (x + 2, base - 1), (x + lean, top), c)
        for x, top in ((12, 12), (26, 20), (40, 26)):
            g.rect(x, top, 1, base - top, "forest")
            g.rect(x - 1.5, top + 4, 4, 11, "brown")
            g.rect(x + 1.5, top + 4, 1, 11, "dbrown")
            g.rect(x, top, 1, 4, "tan")
        g.ell(12.5, 9, 4, 3, "ink")
        g.rect(15, 8, 3, 1, "ink")
        g.rect(9, 10, 3, 2, "red")
        g.rect(9, 12, 3, 1, "yellow")
        g.rect(8, 6, 1, 1, "ink")
    return w, h, draw


def bench():
    """A green park bench with a brass plaque on its back, a grey squirrel sat on the top rail."""
    w, h = 64, 48

    def draw(g):
        base = h - 2
        for x in (8, 52):
            g.rect(x, 14, 4, base - 13, "forest")
        for y in (16, 22):
            g.rect(6, y, 52, 4, "dgreen")
            g.rect(6, y, 52, 1, "green")
        g.rect(4, base - 14, 56, 4, "dgreen")
        g.rect(4, base - 14, 56, 1, "green")
        g.rect(4, base - 11, 56, 1, "forest")
        for x in (3, 55):
            g.rect(x, base - 20, 6, 2, "forest")
            g.rect(x + 1, base - 18, 2, 4, "forest")
        g.rect(28, 23, 8, 3, "amber")
        g.rect(29, 24, 6, 1, "orange")
        # the grey squirrel, upright on the back's top rail, tail curled up behind it
        g.ell(47, 9, 4, 5.5, "grey")
        g.ell(48, 10, 2, 3.5, "lgrey")
        g.ell(44, 3, 3, 3, "grey")
        g.rect(42, 0.5, 1, 1.5, "grey")
        g.rect(43, 3, 1, 1, "ink")
        g.ell(53, 6, 3.5, 7, "grey")
        g.ell(54, 4, 2, 4, "lgrey")
    return w, h, draw


def bison():
    """The High Park Zoo's bison behind a split-rail paddock fence: a dark shaggy front and hump,
    lighter hindquarters, a low bearded head with pale horns."""
    w, h = 112, 64

    def draw(g):
        base = h - 2
        for x in (36, 48, 78, 88):
            g.rect(x, 40, 6, base - 41, "plum")
        g.ell(80, 34, 15, 11, "brown")
        g.ell(80, 36, 12, 8, "dbrown")
        g.rect(94, 30, 2, 12, "plum")
        g.ell(50, 28, 22, 17, "dbrown")
        g.ell(46, 22, 16, 10, "brown")
        g.ell(49, 26, 14, 8, "dbrown")
        g.ell(24, 36, 11, 11, "plum")
        g.rect(18, 42, 10, 10, "plum")
        g.rect(20, 50, 6, 3, "dbrown")
        g.ell(26, 30, 7, 5, "dbrown")
        g.rect(17, 34, 2, 2, "ink")
        g.rect(17, 34, 1, 1, "white")
        g.rect(13, 40, 3, 3, "dbrown")
        g.tri((13, 30), (18, 30), (11, 23), "cream")
        g.tri((28, 28), (33, 29), (34, 21), "cream")
        for x in (4, 38, 72, 104):
            g.rect(x, base - 26, 5, 27, "dbrown")
            g.rect(x, base - 26, 5, 1, "brown")
        for y in (base - 22, base - 11):
            g.rect(3, y, w - 6, 4, "brown")
            g.rect(3, y, w - 6, 1, "tan")
            g.rect(3, y + 3, w - 6, 1, "dbrown")
    return w, h, draw


def maple():
    """Hillside Gardens' maple leaf: a red leaf of flowers on a grassy mound, edged in white
    alyssum and dotted with marigolds."""
    w, h = 84, 44

    def draw(g):
        base = h - 2
        top = 30
        for i in range(0, top, 2):
            half = 39 * math.sqrt(1 - (i / top) ** 2)
            g.rect(42 - half, base - i - 2, 2 * half, 2, "green")
        for i in range(0, top, 2):
            half = 39 * math.sqrt(1 - (i / top) ** 2)
            g.rect(42 + half - 4, base - i - 2, 4, 2, "dgreen")
        for i in range(2, top - 2, 3):
            half = 39 * math.sqrt(1 - (i / top) ** 2) - 3
            g.rect(42 - half, base - i - 2, 2, 2, "white")
            g.rect(42 + half - 2, base - i - 2, 2, 2, "white")
        for r, row in enumerate(leaf_map()):
            for c, ch in enumerate(row):
                if ch == "X":
                    g.rect(28 + c * 2.2, base - 28 + r * 2, 2.2, 2, "red" if c < 9 else "dred")
        for x, y in ((14, base - 6), (20, base - 12), (66, base - 10), (72, base - 5), (60, base - 4), (24, base - 3)):
            g.rect(x, y, 2, 2, "yellow")
    return w, h, draw


def jogger():
    """A jogger on the side trail, running toward the camera in a red cap: mid-stride, one knee
    up, the opposite arm forward."""
    w, h = 32, 52

    def draw(g):
        base = h - 2
        g.ell(16, 10, 5, 5.5, "skin1")
        g.rect(11, 4, 10, 4, "red")
        g.rect(10, 7, 12, 1, "dred")
        g.rect(19, 9, 2, 2, "dbrown")
        g.rect(14, 10, 1, 1, "ink")
        g.rect(18, 10, 1, 1, "ink")
        g.rect(11, 16, 10, 12, "orange")
        g.rect(19, 16, 2, 12, "rust")
        g.rect(7, 17, 4, 4, "orange")
        g.rect(7, 21, 3, 4, "skin1")
        g.rect(9, 23, 4, 3, "skin1")
        g.rect(21, 17, 4, 4, "orange")
        g.rect(22, 21, 3, 7, "skin1")
        g.rect(11, 28, 10, 6, "navy")
        g.rect(12, 34, 4, 10, "skin1")
        g.rect(11, base - 3, 6, 3, "white")
        g.rect(17, 34, 4, 5, "skin1")
        g.rect(17, 39, 5, 3, "white")
    return w, h, draw


def lupines():
    """Wild lupines in the savannah grass, a Karner blue butterfly over them."""
    w, h = 44, 40

    def draw(g):
        base = h - 2
        for x, top, lean in ((6, 26, -2), (12, 22, 1), (20, 24, -1), (28, 20, 2), (36, 26, 1)):
            g.tri((x - 2, base - 1), (x + 2, base - 1), (x + lean, top), "green")
        for x, y in ((10, base - 5), (24, base - 6), (34, base - 4)):
            g.ell(x, y, 4, 2.5, "dgreen")
        for x, top in ((10, 12), (19, 8), (30, 14)):
            g.rect(x, top + 10, 1, base - top - 10, "forest")
            for k in range(6):
                wd = 1.5 + k * 0.6
                g.rect(x + 0.5 - wd / 2, top + k * 2, wd, 2, "purple" if k == 0 else "blue")
            for k in (2, 4):
                g.rect(x + 0.5 - (1.5 + k * 0.6) / 2, top + k * 2, 1, 1, "sky")
        g.rect(36, 4, 3, 3, "sky")
        g.rect(40, 4, 3, 3, "sky")
        g.rect(39, 5, 1, 3, "navy")
    return w, h, draw


PROPS = {
    "oak": (oak(), True, 0.82),
    "oak-critters": (oak(True), True, 0.82),
    "cherry": (cherry(), True, 0.82),
    "cattails": (cattails(), False),
    "bench": (bench(), True),
    "bison": (bison(), False, 0.86),
    "maple-bed": (maple(), False, 0.55),
    "jogger": (jogger(), True),
    "lupines": (lupines(), False),
}
LABELS = {
    "oak": "black oak", "oak-critters": "oak, raccoon, black squirrel", "cherry": "cherry in bloom",
    "cattails": "cattails, blackbird", "bench": "bench, grey squirrel", "bison": "zoo bison",
    "maple-bed": "maple leaf bed", "jogger": "jogger", "lupines": "lupines, karner blue",
}
CACHE = {}


def prop(key, s=1.0):
    """A prop drawn at s times its full size, outlined with road_edge, as an RGBA image."""
    s = round(s, 3)
    if (key, s) not in CACHE:
        w, h, draw = PROPS[key][0]
        k = PROPS[key][2] if len(PROPS[key]) > 2 else 1
        g = edged(Mini(SCALE * s * k, w, h))
        draw(g)
        rows = g.outlined()
        img = Image.new("RGBA", (len(rows[0]), len(rows)))
        img.putdata([(*sn.rgb(c), 255) if c else (0, 0, 0, 0) for row in rows for c in row])
        CACHE[key, s] = img
    return CACHE[key, s]


# ---------- the walk screen ----------
# Roadside placements: (key, side, inner edge across, d ahead of the feet). The trail props stand
# on the trail's centre instead (inner None).
PLACED = [
    ("lupines", -1, 164, 30), ("bench", -1, 164, 110), ("cattails", -1, 172, 210), ("cherry", -1, 168, CHERRY_Z[0]),
    ("cattails", -1, 176, 460), ("cherry", -1, 170, CHERRY_Z[1]),
    ("lupines", 1, 164, 20), ("maple-bed", 1, 164, 130), ("jogger", 1, None, 260),
    ("bison", 1, 166, 360), ("oak-critters", 1, 166, 500),
]
OBJECTS = [("goose", "idle", 1, 560), ("tip", "idle", 3, 470), ("minor-log", "idle", 3, 330),
           ("treat", "idle", 0, 250), ("tip", "idle", 4, 160)]


def row_of(d):
    s = F / (F + d)
    return YH + KS * s, s


def paint_road(sc):
    px = sc.img.load()
    for y in range(FAR_Y, DOG_BAND_Y):
        s = (y + 0.5 - YH) / KS
        z = F / s - F
        for x in range(W):
            px[x, y] = sn.rgb(ground((x + 0.5 - CX) / s, z))


def place_prop(sc, key, side, inner, d):
    sy, s = row_of(d)
    img = prop(key, s)
    if inner is None:
        across = trail(d)
        cx = CX + side * across * s
    else:
        cx = CX + side * (inner * s + img.width / 2)
    if PROPS[key][1]:
        shade, sc.shade = sc.shade, "dgreen"
        sc.shadow(round(cx), round(sy), max(8, img.width * (0.5 if key in ("oak", "oak-critters", "cherry") else 0.9)))
        sc.shade = shade
    sc.paste(img, round(cx - img.width / 2), round(sy) - img.height)


def bottom_panel():
    panel = mt.Scene(W, H - DOG_BAND_Y)
    band = sn.image("ui-dog-band")
    panel.img.paste(band, (0, 0), band)
    for i, d in enumerate(DOGS):
        panel.doghouse(i * 120, 470 - DOG_BAND_Y, d, mt.dog(d)[3])
    return panel.img


def walk(band):
    use_camera()
    sn.ZONES["highPark"] = {**sn.ZONES["park"], "name": "High Park"}
    sc = mt.Scene(W, H)
    sc.shade, sc.leash_col = "slate", "plum"
    paint_road(sc)
    items = [(d, "prop", p) for p in PLACED for d in (p[3],)] + [(o[3], "obj", o) for o in OBJECTS]
    for d, kind, it in sorted(items, key=lambda i: -i[0]):
        if kind == "prop":
            place_prop(sc, *it)
        else:
            sc.stand(it[0], it[1], mt.lane(it[2]), d)
    sc.pack(mt.lane(2), tuple(f"dog-{d}" for d in DOGS))
    sc.img.paste(band, (0, BAND_Y))
    sc.top_bar(["highPark"], 42, 1, 0.4)
    b = mt.TOP_BAR["buttons"]["sound"]
    sc.paste(sn.frame("ui-icon-button", "normal"), b["face"]["x"], b["face"]["y"])
    sc.paste(sn.frame("icon-sound", "on"), b["icon"]["x"], b["icon"]["y"])
    sc.img.paste(bottom_panel(), (0, DOG_BAND_Y))
    return sc.img


def sheet():
    """Every prop at 2x on the verge's green, a cream label plate under each, three to a row."""
    cells = [(k, prop(k)) for k in PROPS]
    cols, pad = 3, 8
    cw = max(i.width for _, i in cells) + pad
    rows = [cells[i:i + cols] for i in range(0, len(cells), cols)]
    rh = [max(i.height for _, i in r) + 20 for r in rows]
    cv = sn.Canvas(cols * cw + pad, sum(rh) + pad * (len(rows) + 1))
    cv.fill(0, 0, cv.img.width, cv.img.height, "plum")
    y = pad
    for r, h in zip(rows, rh):
        for c, (k, img) in enumerate(r):
            x = pad + c * cw
            cv.fill(x, y, cw - pad, h, "green")
            cv.paste(img, x + (cw - pad - img.width) // 2, y + h - 20 - img.height)
            cv.fill(x, y + h - 18, cw - pad, 18, "cream")
            sn.text_c(cv, f"ROADSIDE-{k.upper()}", x + (cw - pad) / 2, y + h - 15, "plum")
            sn.text_c(cv, LABELS[k].upper(), x + (cw - pad) / 2, y + h - 8, "dbrown")
        y += h + pad
    return cv.img.resize((cv.img.width * 2, cv.img.height * 2), Image.NEAREST)


def build():
    os.makedirs(OUT, exist_ok=True)
    band = backdrop()
    walk(band).save(f"{OUT}/high-park-walk.png")
    sheet().save(f"{OUT}/high-park-props.png")
    print("built", f"{OUT}/high-park-walk.png", f"{OUT}/high-park-props.png")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
