#!/usr/bin/env python3
"""Mock: Yonge Street downtown as a Toronto zone, on the tall band and the tilted camera.

Draws two images in Endesga 32 from the exported art and new drawings:

- yonge-walk.png (360x560): the top bar; a 174-row skyline band on rows 40 to 213 (a dusk sky
  flat above band row 61, the CN Tower whose antenna alone rises into the calm rows, glass towers,
  Yonge-Dundas Square's screens and billboards facing the camera, Dundas Street across with a
  TTC streetcar under its wire and a food truck); the road under the camera (farY 214, focal
  720, feet on 464) in asphalt with two streetcar tracks; the verges (curb, a furniture strip of
  dark pavers, the walk, the shop line); roadside props that scroll with the road, drawn at their
  depth step back to front with the road objects and under the band; the walker and a pack of
  3, obstacles and pickups; and the doghouse row.
- yonge-props.png: the new roadside props at 2x on the walk's paving, labelled.

The props are front elevations on a design grid drawn at 1.75x with road_edge outlines, as
roadside.py's. They stand past the curb: the furniture (hot dog cart, newspaper boxes, TTC stop,
shelter, lamp, drums, hoarding) on the furniture strip from across 166, the crowd on the walk,
the shops from across 236.

Usage:
  mock_toronto_yonge.py build    write public/art/mocks/toronto/yonge-*.png

Run from the repository root. Mock tooling only: nothing here is game art.
"""

import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import backdrops as bd  # noqa: E402
import mock_toronto as mt  # noqa: E402
import scene as sn  # noqa: E402
from minis import Mini, scaled  # noqa: E402
from pixel import DARKER, K, edged  # noqa: E402
from ui import to_image  # noqa: E402

OUT = "public/art/mocks/toronto"
W, H = 360, 560
BAR, BAND_H = 40, 174           # the band: screen rows 40 to 213
FAR_Y, FOOT, F, CX = 214, 464, 720, 180
YH = (FAR_Y - 0.5 * FOOT) / 0.5  # the horizon: scale 0.5 on row farY, so -36
KS = FOOT - YH
CALM = 61                       # band rows above this stay one flat colour
BASE = 131                      # the far side's ground row
STUB = 155                      # band rows from here continue the road's projection
SCALE = 1.75
STEPS = (1, 0.875, 0.75, 0.625, 0.5)
DOG_BAND_Y = 466
DOGS = ("koda", "biscuit", "duchess")


def dk(c):
    return DARKER[K.get(c, c)]


def use_camera():
    """Point mock_toronto.py's Scene at the full screen and the tilted camera."""
    mt.W, mt.H, mt.OX, mt.TOP = W, H, 0, 0
    mt.YH, mt.F, mt.KS = YH, F, KS


def scale_at(y):
    """The ground scale and road distance on screen row y's centre."""
    s = (y + 0.5 - YH) / KS
    return s, F / s - F


# ---------- the road: asphalt, two streetcar tracks, white lane dashes ----------

def strip():
    """The 320x64 road strip as colour names: dslate asphalt with sparse navy and slate grit,
    a slate track slab in lanes 1 and 3 with two grey rails each (lgrey on their inner edge),
    and white lane dashes 16 rows long in 32 on the dividers."""
    rows = []
    for y in range(64):
        row = []
        for x in range(320):
            c = "dslate"
            n = mt.noise(x, y)
            if n < 0.012:
                c = "navy"
            elif n < 0.018:
                c = "slate"
            for mid in (96, 224):
                if mid - 18 <= x < mid + 18:
                    c = "slate" if mt.noise(x + 7, y + 3) > 0.02 else "grey"
                    if x in (mid - 18, mid + 17):
                        c = "dslate"
                    for rail in (mid - 12, mid + 10):
                        if x == rail or x == rail + 1:
                            c = "lgrey" if (x == rail + 1) == (rail < mid) else "grey"
            if x % 64 in (63, 0) and 0 < x < 319 and y % 32 < 16:
                c = "white"
            row.append(c)
        rows.append(row)
    return rows


STRIP = strip()
CURB, FURNISH, WALK, SHOPS = 164, 196, 236, 236   # across: curb to, furniture strip to, walk to, shop line


def verge(across, z, span, rx):
    """The colour beside the road at across, on a row covering span road px from z: a slate gutter
    line and the lgrey curb, the furniture strip of grey pavers (slate seams every 24 along, lgrey
    flecks), the lgrey walk (grey seams every 32), then the plaza paving."""
    def seam(every):
        return span < 16 and z // every != (z - max(span, 1)) // every

    if across < 161:
        return "slate"
    if across < CURB:
        return "lgrey"
    if across < FURNISH:
        if seam(24) or across < 166:
            return "slate"
        return "lgrey" if mt.noise(math.floor(rx), math.floor(z)) < 0.03 else "grey"
    if across < WALK + 60:
        return "grey" if seam(32) else "lgrey"
    return "grey" if seam(48) or int(across) % 48 == 0 else "lgrey"


def road(sc, y0, y1):
    """The projected road and verges on screen rows y0 to y1 - 1."""
    px = sc.img.load()
    for y in range(y0, y1):
        s, z = scale_at(y)
        span = z - scale_at(y + 1)[1]
        row = (63 - math.floor(z)) % 64
        for x in range(W):
            rx = (x + 0.5 - CX) / s
            if -160 <= rx < 160:
                c = STRIP[row][math.floor(rx + 160)]
            else:
                c = verge(abs(rx), z, span, rx)
            px[x, y] = sn.rgb(c)


# ---------- the roadside props: front elevations in design units, drawn 1.75x ----------
# Each returns (w, h, draw); draw(g) paints on the design grid, base = h - 2 the ground row, the
# outer ring of the frame clear for the outline.

def hot_dog_cart():
    """A street meat cart: a steel box on two wheels with a hot dog on its side, ketchup, mustard
    and relish on the counter, under a red and yellow striped umbrella."""
    w, h = 46, 54

    def draw(g):
        base = h - 2
        g.rect(27, 12, 2, 18, "dslate")
        for i, c in enumerate(("red", "yellow", "red", "yellow")):
            x0 = 13 + i * 7
            g.tri((x0, 14), (x0 + 7, 14), (28, 4), c)
        g.rect(13, 14, 28, 2, "red")
        for x in range(14, 40, 4):
            g.rect(x, 16, 2, 1, "yellow")
        g.rect(27, 3, 2, 2, "dslate")
        for x, c in ((8, "red"), (12, "yellow"), (16, "green")):
            g.rect(x, 22, 3, 6, c)
            g.rect(x + 1, 21, 1, 1, "white")
        g.rect(4, 28, 38, 3, "white")
        g.rect(5, 31, 36, 15, "lgrey")
        g.rect(37, 31, 4, 15, "grey")
        g.rect(5, 31, 36, 1, "grey")
        g.ell(20, 38.5, 10, 4, "tan")
        g.rect(11, 37, 18, 3, "red")
        for x in range(13, 28, 3):
            g.rect(x, 37 + (x // 3) % 2, 2, 1, "yellow")
        g.rect(2, 30, 3, 2, "grey")
        for x in (12, 32):
            g.ell(x, base - 3, 4, 4, "dslate")
            g.rect(x - 1, base - 4, 2, 2, "lgrey")
    return w, h, draw


def news_boxes():
    """Three newspaper boxes on short legs: blue, red and green, each with its window and lid."""
    w, h = 40, 32

    def draw(g):
        base = h - 2
        for i, c in enumerate(("blue", "red", "green")):
            x = 3 + i * 12
            g.rect(x + 1, base - 3, 2, 3, "dslate")
            g.rect(x + 7, base - 3, 2, 3, "dslate")
            g.rect(x, 8, 10, base - 10, c)
            g.rect(x + 8, 8, 2, base - 10, dk(c))
            g.rect(x - 1, 6, 12, 3, dk(c))
            g.rect(x + 2, 11, 6, 6, "cyan")
            g.rect(x + 2, 11, 2, 1, "white")
            g.rect(x + 3, 19, 4, 1, "plum")
    return w, h, draw


def ttc_stop():
    """A TTC stop: a grey pole carrying a white sign with red bands and a red streetcar on it."""
    w, h = 20, 100

    def draw(g):
        base = h - 2
        g.rect(9, 20, 2, base - 19, "grey")
        g.rect(10, 20, 1, base - 19, "slate")
        g.rect(7, base - 2, 6, 2, "slate")
        g.rect(3, 4, 14, 20, "white")
        g.rect(3, 4, 14, 4, "red")
        g.rect(3, 20, 14, 4, "red")
        g.rect(5, 11, 10, 6, "red")
        g.rect(6, 12, 8, 2, "white")
        g.rect(9, 9, 2, 2, "dslate")
    return w, h, draw


def shelter():
    """A glass transit shelter: a dslate roof and posts, a bench, cyan glass with glints, and a
    lit poster at its right end with a cartoon dog on it."""
    w, h = 72, 60

    def draw(g):
        base = h - 2
        g.rect(2, 4, 68, 4, "dslate")
        g.rect(2, 8, 68, 1, "red")
        for x in (4, 66):
            g.rect(x, 9, 2, base - 8, "dslate")
        g.rect(6, 10, 46, base - 12, "cyan")
        for x in (14, 34):
            for k in range(8):
                g.rect(x + k, 14 + k * 2, 1, 2, "white")
        g.rect(29, 10, 1, base - 12, "sky")
        g.rect(10, 38, 34, 3, "brown")
        g.rect(12, 41, 2, base - 41, "dslate")
        g.rect(40, 41, 2, base - 41, "dslate")
        g.rect(52, 10, 14, base - 12, "slate")
        g.rect(53, 12, 12, 30, "yellow")
        g.ell(59, 26, 4.5, 4, "tan")
        g.rect(54, 22, 2, 5, "brown")
        g.rect(62, 22, 2, 5, "brown")
        g.rect(57, 25, 1, 1, "ink")
        g.rect(60, 25, 1, 1, "ink")
        g.rect(58, 28, 2, 1, "plum")
        g.rect(55, 34, 8, 3, "red")
    return w, h, draw


def crowd():
    """Shoppers milling on the walk, facing the street: a toque, a phone, a shopping bag, a
    backpack, in coats of five colours."""
    w, h = 60, 50
    people = ((7, 36, "red", "skin1", "dbrown", "toque"), (18, 40, "blue", "skin2", "ink", "phone"),
              (30, 34, "green", "brown", "plum", None), (41, 38, "mauve", "skin1", "ochre", "bag"),
              (52, 35, "amber", "tan", "dbrown", "pack"))

    def draw(g):
        base = h - 2
        for x, tall, coat, skin, hair, extra in people:
            top = base - tall
            g.rect(x - 3, base - 9, 2, 9, "navy")
            g.rect(x + 1, base - 9, 2, 9, "navy")
            g.rect(x - 4, top + 11, 8, tall - 19, coat)
            g.rect(x + 2, top + 11, 2, tall - 19, dk(coat))
            g.ell(x, top + 6, 4, 4.5, skin)
            g.rect(x - 4, top + 1, 8, 3, hair)
            g.rect(x - 2, top + 6, 1, 1, "ink")
            g.rect(x + 1, top + 6, 1, 1, "ink")
            if extra == "toque":
                g.rect(x - 4, top, 8, 4, "red")
                g.rect(x - 4, top + 3, 8, 1, "white")
                g.rect(x - 1, top - 2, 2, 2, "white")
            elif extra == "phone":
                g.rect(x - 1, top + 14, 3, 4, "cyan")
            elif extra == "bag":
                g.rect(x + 4, top + 18, 5, 6, "yellow")
                g.rect(x + 5, top + 16, 3, 1, "plum")
            elif extra == "pack":
                g.rect(x + 4, top + 12, 2, 8, "teal")
    return w, h, draw


def lamp():
    """A downtown lamp: a dslate pole, a cobra head on its arm, and a blue banner with a red leaf."""
    w, h = 32, 120

    def draw(g):
        base = h - 2
        g.rect(8, 12, 3, base - 11, "dslate")
        g.rect(8, 12, 1, base - 11, "slate")
        g.rect(6, base - 6, 7, 6, "dslate")
        g.rect(10, 11, 14, 2, "dslate")
        g.ell(25, 12, 5, 2.5, "grey")
        g.rect(22, 14, 6, 1, "yellow")
        g.rect(11, 24, 1, 30, "dslate")
        g.rect(12, 24, 12, 28, "blue")
        g.rect(12, 24, 12, 2, "white")
        g.rect(12, 50, 12, 2, "white")
        leaf(g, 18, 38, "red")
    return w, h, draw


def leaf(g, cx, cy, c, k=1):
    """A maple leaf centred on cx, cy, k times the small one: three points up and out on a body,
    and a stem."""
    g.tri((cx - 2 * k, cy + 2 * k), (cx + 2 * k, cy + 2 * k), (cx, cy - 6 * k), c)
    g.tri((cx - k, cy + 3 * k), (cx - k, cy - k), (cx - 6 * k, cy - 2 * k), c)
    g.tri((cx + k, cy + 3 * k), (cx + k, cy - k), (cx + 6 * k, cy - 2 * k), c)
    g.rect(cx - 3 * k, cy - k, 6 * k, 4 * k, c)
    g.rect(cx, cy + 3 * k, 1, 3 * k, c)


def drums():
    """Two orange construction drums with white reflective bands."""
    w, h = 36, 32

    def draw(g):
        base = h - 2
        for x in (3, 19):
            g.rect(x, 8, 14, base - 8, "orange")
            g.rect(x + 11, 8, 3, base - 8, "rust")
            for y in (13, 21):
                g.rect(x, y, 14, 3, "white")
                g.rect(x + 11, y, 3, 3, "lgrey")
            g.rect(x - 1, 6, 16, 3, "rust")
            g.rect(x - 1, base - 2, 16, 2, "dslate")
    return w, h, draw


def hoarding():
    """A construction hoarding: plywood planks pasted with posters, hazard stripes along its foot."""
    w, h = 96, 50

    def draw(g):
        base = h - 2
        g.rect(2, 4, 92, base - 4, "tan")
        for x in range(17, 92, 16):
            g.rect(x, 4, 1, base - 4, "brown")
        g.rect(2, 4, 92, 2, "brown")
        for x, y, c, mark in ((6, 9, "pink", "yellow"), (24, 7, "cyan", "blue"), (42, 11, "yellow", "red"),
                              (60, 8, "green", "white"), (76, 10, "mauve", "cyan")):
            g.rect(x, y, 13, 22, c)
            g.rect(x + 2, y + 3, 9, 6, mark)
            g.rect(x + 2, y + 12, 9, 1, dk(c))
            g.rect(x + 2, y + 15, 6, 1, dk(c))
        for i, x in enumerate(range(2, 94, 6)):
            g.rect(x, base - 8, 6, 8, "orange" if i % 2 else "white")
    return w, h, draw


def facade(wall, upper, neon):
    """A three-storey shop facing the street: wall colour wall, upper storeys drawn by upper(g),
    the neon sign by neon(g, y) over a dark band on rows y to y + 16, the shop window and door."""
    w, h = 96, 132

    def draw(g):
        base = h - 2
        g.rect(2, 2, 92, base - 2, wall)
        g.rect(88, 2, 6, base - 2, dk(wall))
        g.rect(2, 2, 92, 3, dk(wall))
        upper(g)
        y = base - 52
        g.rect(4, y, 88, 18, "ink")
        neon(g, y)
        g.rect(4, base - 32, 88, 2, dk(wall))
        g.rect(6, base - 29, 58, 27, "plum")
        g.rect(8, base - 27, 54, 23, "cyan")
        g.rect(8, base - 9, 54, 5, "teal")
        for x in (12, 26, 40, 52):
            g.rect(x, base - 15, 6, 6, ("pink", "yellow", "white", "red")[x % 4])
        g.rect(10, base - 25, 8, 1, "white")
        g.rect(10, base - 23, 4, 1, "white")
        g.rect(68, base - 30, 20, 30, "plum")
        g.rect(70, base - 28, 16, 28, "amber")
        g.rect(70, base - 28, 16, 2, "yellow")
        g.rect(77, base - 28, 2, 28, "orange")
    return w, h, draw


def windows(rows, glass="yellow", frame="plum"):
    def upper(g):
        for y in rows:
            for x in (10, 32, 54, 72):
                g.rect(x, y, 12, 14, frame)
                g.rect(x + 1, y + 1, 10, 12, glass if (x + y) % 3 else "navy")
                g.rect(x + 2, y + 2, 2, 2, "white")
    return upper


def records_neon(g, y):
    """Two red neon records, spinning discs in tube rings."""
    for cx in (26, 66):
        g.ell(cx, y + 8, 10, 7, "red")
        g.ell(cx, y + 8, 8, 5.5, "dred")
        g.ell(cx, y + 8, 6, 4, "red")
        g.ell(cx, y + 8, 2.5, 2, "white")
    g.rect(40, y + 7, 12, 2, "hot")


def pizza_neon(g, y):
    """A neon pizza slice between two pink tube bars."""
    g.tri((32, y + 3), (64, y + 3), (48, y + 16), "yellow")
    g.rect(32, y + 2, 32, 2, "orange")
    for x, yy in ((42, 6), (51, 6), (47, 10)):
        g.rect(x, y + yy, 3, 3, "red")
    for x in (8, 72):
        g.rect(x, y + 5, 16, 2, "pink")
        g.rect(x, y + 11, 16, 2, "pink")


def marquee_neon(g, y):
    """A theatre marquee: a white board ringed with amber bulbs, red stripes for its letters."""
    g.rect(6, y + 1, 84, 16, "white")
    for x in range(7, 90, 3):
        g.rect(x, y + 1, 1, 1, "amber")
        g.rect(x, y + 16, 1, 1, "amber")
    for yy in (5, 10):
        for x in range(12, 84, 8):
            g.rect(x, y + yy, 6, 3, "red")


def maple_neon(g, y):
    """A souvenir shop's neon: a red leaf between cyan tube bars."""
    leaf(g, 48, y + 9, "red", 1.4)
    for x in (10, 64):
        g.rect(x, y + 4, 22, 2, "cyan")
        g.rect(x, y + 12, 22, 2, "cyan")


def billboard(rows_y, colours):
    """Windows on the second storey and a lit billboard across the third."""
    def upper(g):
        windows((rows_y,))(g)
        g.rect(8, 8, 80, 34, "ink")
        g.rect(10, 10, 76, 30, colours[0])
        g.ell(32, 25, 12, 10, colours[1])
        g.rect(52, 18, 28, 4, colours[2])
        g.rect(52, 26, 20, 4, colours[2])
    return upper


PROPS = {
    "yonge-hot-dog-cart": hot_dog_cart(),
    "yonge-news-boxes": news_boxes(),
    "yonge-ttc-stop": ttc_stop(),
    "yonge-shelter": shelter(),
    "yonge-crowd": crowd(),
    "yonge-lamp": lamp(),
    "yonge-drums": drums(),
    "yonge-hoarding": hoarding(),
    "yonge-shop-records": facade("lgrey", windows((10, 34)), records_neon),
    "yonge-shop-pizza": facade("rust", billboard(48, ("cyan", "pink", "white")), pizza_neon),
    "yonge-shop-theatre": facade("purple", windows((10, 34), "pink"), marquee_neon),
    "yonge-shop-souvenir": facade("teal", billboard(48, ("yellow", "red", "ink")), maple_neon),
}
CAPTIONS = {
    "yonge-hot-dog-cart": "HOT DOG CART", "yonge-news-boxes": "NEWS BOXES", "yonge-ttc-stop": "TTC STOP",
    "yonge-shelter": "SHELTER", "yonge-crowd": "CROWD", "yonge-lamp": "LAMP",
    "yonge-drums": "DRUMS", "yonge-hoarding": "HOARDING", "yonge-shop-records": "RECORD SHOP",
    "yonge-shop-pizza": "PIZZA AND BILLBOARD", "yonge-shop-theatre": "THEATRE MARQUEE",
    "yonge-shop-souvenir": "SOUVENIRS",
}
FREE = {"yonge-hot-dog-cart", "yonge-news-boxes", "yonge-ttc-stop", "yonge-lamp", "yonge-drums"}
CACHE = {}


def prop(key, step=1):
    """A prop's frame drawn at a depth step, outlined, as an RGBA image."""
    if (key, step) not in CACHE:
        w, h, draw = PROPS[key]
        g = edged(Mini(SCALE * step, w, h))
        draw(g)
        CACHE[key, step] = to_image(g.outlined())
    return CACHE[key, step]


def at_depth(key, s):
    """A prop at scale s as the game draws road sprites: from the smallest step at least its
    projected size, scaled down nearest-neighbour."""
    w, h, _ = PROPS[key]
    size = max(1, math.floor(max(scaled(w, SCALE), scaled(h, SCALE)) * min(1, s) + 0.5))
    step = min((q for q in STEPS if max(prop(key, q).size) >= size), default=1)
    art = prop(key, step)
    if max(art.size) == size:
        return art
    k = size / max(art.size)
    return art.resize((max(1, math.floor(art.width * k + 0.5)), max(1, math.floor(art.height * k + 0.5))),
                      Image.NEAREST)


def inner(key, edge):
    """The across of a prop's centre whose frame's inner edge is at edge."""
    return edge + scaled(PROPS[key][0], SCALE) / 2


# (key, side, inner edge across, z): side -1 left, 1 right. Furniture on the strip from 166, the
# crowd on the walk, shops from the shop line; nearer than the band's edge at z 720.
PLACED = [
    ("yonge-shop-theatre", -1, SHOPS, 700), ("yonge-shop-records", -1, SHOPS, 530),
    ("yonge-shop-souvenir", -1, SHOPS, 360),
    ("yonge-shop-pizza", 1, SHOPS, 640), ("yonge-shop-records", 1, SHOPS, 470),
    ("yonge-lamp", -1, 168, 660), ("yonge-ttc-stop", -1, 172, 560), ("yonge-shelter", -1, 176, 520),
    ("yonge-crowd", -1, 204, 400), ("yonge-news-boxes", -1, 170, 330), ("yonge-hot-dog-cart", -1, 170, 210),
    ("yonge-lamp", -1, 168, 110),
    ("yonge-hoarding", 1, 176, 600), ("yonge-drums", 1, 170, 520), ("yonge-lamp", 1, 168, 440),
    ("yonge-hot-dog-cart", 1, 170, 360), ("yonge-crowd", 1, 200, 270), ("yonge-news-boxes", 1, 170, 170),
]
# Road objects: (key, tag, lane, distance ahead of the feet).
OBJECTS = [("construction", "idle", 0, 560), ("cone", "idle", 4, 470), ("tip", "idle", 3, 420),
           ("tip", "idle", 3, 360), ("cyclist", "ride", 1, 300), ("treat", "idle", 3, 230),
           ("cone", "idle", 0, 180)]


# ---------- the band ----------

class Band(sn.Canvas):
    def __init__(self):
        super().__init__(W, BAND_H)


def tower(cv, x, w, top, wall, glass, lit, seed, crown=None):
    """A glass tower standing behind the front row: a wall with a shaded right side, mullion
    columns of glass, and a few lit windows picked by noise."""
    cv.fill(x, top, w, BASE - top, wall)
    cv.fill(x + w - 2, top, 2, BASE - top, dk(wall))
    for cx in range(x + 2, x + w - 3, 4):
        for cy in range(top + 3, BASE, 4):
            n = mt.noise(cx + seed, cy)
            cv.fill(cx, cy, 2, 2, lit if n < 0.18 else glass)
    if crown:
        cv.fill(x + 1, top - 2, w - 2, 2, crown)
        cv.fill(x + w // 2 - 1, top - 5, 2, 3, crown)


def cn_tower(cv, cx):
    """The CN Tower in lgrey with a grey right side: a tapering shaft from behind the towers, the
    main pod with its dark window ring, the upper shaft, the SkyPod and a 1px antenna that alone
    rises into the calm rows, a red light on its tip."""
    for y in range(80, BASE):
        half = 2 + (y - 80) * 4 // (BASE - 80)
        cv.fill(cx - half, y, half * 2 + 1, 1, "lgrey")
        cv.fill(cx + half - 1, y, 2, 1, "grey")
    cv.fill(cx - 8, 76, 17, 3, "lgrey")
    cv.fill(cx - 9, 79, 19, 2, "dslate")
    cv.fill(cx - 8, 81, 17, 3, "lgrey")
    cv.fill(cx + 5, 76, 4, 8, "grey")
    cv.fill(cx - 6, 74, 13, 2, "grey")
    cv.fill(cx - 1, 64, 3, 10, "lgrey")
    cv.fill(cx + 1, 64, 1, 10, "grey")
    cv.fill(cx - 2, 62, 5, 2, "lgrey")
    cv.fill(cx, 40, 1, 22, "lgrey")
    cv.fill(cx, 39, 1, 1, "red")


def screen(cv, x, y, w, h, bg, frame="ink"):
    cv.fill(x - 1, y - 1, w + 2, h + 2, frame)
    cv.fill(x, y, w, h, bg)


def dog_ad(cv, cx, cy):
    """The big screen's cartoon dog: a tan head, brown ears, ink eyes, a pink tongue."""
    for dx, dy in ((-11, -3), (8, -3)):
        cv.fill(cx + dx, cy + dy, 4, 10, "brown")
    for y in range(-8, 9):
        half = round(10 * math.sqrt(max(0, 1 - (y / 9) ** 2)))
        cv.fill(cx - half, cy + y, half * 2, 1, "tan")
    cv.fill(cx - 5, cy - 2, 2, 3, "ink")
    cv.fill(cx + 3, cy - 2, 2, 3, "ink")
    cv.fill(cx - 2, cy + 2, 4, 2, "plum")
    cv.fill(cx - 1, cy + 5, 2, 3, "pink")


def streetcar(cv, x0, x1, base, wire):
    """A red TTC streetcar on the cross street, its wheels on row base: a black window band with
    cyan glints, a white skirt line, a rounded cab at the right, and its pantograph up to the wire."""
    top = base - 22
    cv.fill(x0, top + 2, x1 - x0, 18, "red")
    cv.fill(x0 + 2, top, x1 - x0 - 6, 2, "red")
    cv.fill(x1 - 4, top + 2, 2, 2, "dred")
    cv.fill(x0, top + 5, x1 - x0 - 1, 7, "ink")
    for x in range(x0 + 3, x1 - 6, 9):
        cv.fill(x, top + 6, 6, 5, "navy")
        cv.fill(x, top + 6, 2, 1, "cyan")
    cv.fill(x1 - 6, top + 5, 5, 7, "dslate")
    cv.fill(x1 - 5, top + 6, 2, 2, "cyan")
    cv.fill(x0, top + 15, x1 - x0, 1, "white")
    cv.fill(x0, top + 19, x1 - x0, 1, "dred")
    for x in range(x0 + 8, x1 - 8, 26):
        cv.fill(x, top + 9, 2, 10, "dred")
    cv.fill(x1 - 3, top + 16, 2, 2, "yellow")
    for x in (x0 + 10, x0 + 16, x1 - 22, x1 - 16):
        cv.fill(x, base - 2, 4, 2, "ink")
    mid = (x0 + x1) // 2
    cv.fill(mid - 6, top - 1, 12, 1, "dslate")
    rise = top - 2 - wire
    for k in range(rise):
        dx = 5 - abs(rise // 2 - k) * 10 // rise
        cv.fill(mid - dx, top - 2 - k, 1, 1, "dslate")
        cv.fill(mid + dx, top - 2 - k, 1, 1, "dslate")
    cv.fill(mid - 3, wire + 1, 7, 1, "grey")


def food_truck(cv, x0, x1, base):
    """A food truck at the far curb, cab at the left: a white body with an orange stripe, an open
    serving hatch under a striped awning, a menu board, two wheels."""
    top = base - 24
    cv.fill(x0 + 14, top, x1 - x0 - 14, 20, "white")
    cv.fill(x1 - 3, top, 3, 20, "lgrey")
    cv.fill(x0, top + 7, 16, 13, "white")
    cv.fill(x0 + 2, top + 8, 9, 5, "navy")
    cv.fill(x0 + 3, top + 8, 2, 1, "cyan")
    cv.fill(x0, top + 15, x1 - x0, 2, "orange")
    cv.fill(x0 + 22, top + 4, 30, 9, "ink")
    cv.fill(x0 + 23, top + 5, 28, 7, "amber")
    for x in range(x0 + 20, x0 + 54, 4):
        cv.fill(x, top + 1, 2, 3, "red")
        cv.fill(x + 2, top + 1, 2, 3, "yellow")
    cv.fill(x0 + 56, top + 3, 12, 10, "ink")
    for y in (top + 5, top + 8, top + 11):
        cv.fill(x0 + 58, y, 8, 1, "white")
    for x in (x0 + 8, x1 - 14):
        cv.fill(x, base - 4, 7, 4, "ink")
        cv.fill(x + 2, base - 3, 3, 2, "grey")
    bd.outline_box(cv, x0, top + 7, 16, 14, "slate")


def band():
    """The skyline band in band rows 0 to 154; rows from STUB down come from the road below."""
    cv = Band()
    cv.fill(0, 0, W, BASE, "blue")
    bd.bands(cv, CALM, 116, ("blue", "purple", "mauve", "pink"))
    cv.fill(0, 116, W, BASE - 116, "pink")
    # the far skyline: dark towers in depth, lit windows, then the CN Tower, then glass towers
    for x, w, top, seed in ((0, 24, 100, 1), (22, 18, 90, 2), (96, 22, 84, 3), (116, 16, 98, 4),
                            (196, 20, 86, 5), (214, 26, 96, 6), (262, 18, 70, 7), (300, 24, 88, 8),
                            (338, 22, 98, 9)):
        tower(cv, x, w, top, "dslate", "navy", "amber", seed)
    cn_tower(cv, 66)
    for x, w, top, wall, glass, crown, seed in ((80, 20, 80, "blue", "sky", None, 11),
                                                (150, 26, 84, "teal", "dslate", "cyan", 12),
                                                (232, 22, 68, "blue", "sky", "white", 13),
                                                (318, 22, 76, "navy", "dslate", "red", 14),
                                                (176, 18, 96, "dslate", "blue", None, 15)):
        tower(cv, x, w, top, wall, glass, "yellow", seed, crown)
    # the far side, facing the camera on row BASE: Yonge-Dundas Square
    # left: the mall's media tower and its glass galleria
    cv.fill(0, 102, 96, BASE - 102, "dslate")
    cv.fill(0, 102, 96, 2, "slate")
    for y in range(106, 114, 4):
        cv.fill(0, y, 64, 2, "sky")
    screen(cv, 70, 96, 22, 32, "orange")
    for y in range(99, 126, 6):
        cv.fill(72, y, 18, 2, "yellow")
    bd.word(cv, "SALE", 81, 106, "white")
    for x in range(4, 60):
        dy = round(10 * math.sqrt(max(0, 1 - ((x - 32) / 28) ** 2)))
        cv.fill(x, BASE - 8 - dy, 1, 8 + dy, "cyan")
        cv.fill(x, BASE - 8 - dy, 1, 1, "white")
    for x in range(8, 60, 8):
        cv.fill(x, BASE - 18, 1, 18, "lgrey")
    cv.fill(4, BASE - 8, 56, 1, "lgrey")
    # centre: the big screen tower over the square, stacked panels, the plaza and its fountains
    cv.fill(98, 76, 152, 4, "dslate")
    cv.fill(104, 80, 140, BASE - 80, "navy")
    screen(cv, 112, 82, 124, 29, "cyan")
    dog_ad(cv, 146, 96)
    bd.word(cv, "WOOF!", 196, 93, "yellow")
    for i, (bg, txt, col) in enumerate((("pink", "EAT", "white"), ("yellow", "", ""), ("green", "SHOP", "white"))):
        x = 110 + i * 44
        screen(cv, x, 113, 38, 10, bg)
        if txt:
            bd.word(cv, txt, x + 19, 114, col)
        else:
            for k in range(3):
                cv.fill(x + 6 + k * 10, 116, 6, 4, ("red", "blue", "hot")[k])
    cv.fill(104, 125, 140, BASE - 124, "lgrey")
    for x in range(110, 240, 9):
        cv.fill(x, 126, 1, 4, "cyan" if (x // 9) % 2 else "white")
    # right: a corner screen and a vertical neon blade sign on a brick block
    cv.fill(250, 92, 110, BASE - 92, "rust")
    cv.fill(250, 92, 110, 2, "dbrown")
    screen(cv, 254, 97, 44, 22, "purple")
    cv.fill(258, 100, 16, 16, "green")
    cv.fill(262, 104, 8, 8, "yellow")
    cv.fill(278, 102, 16, 3, "white")
    cv.fill(278, 108, 12, 3, "white")
    for y in range(90, 128, 2):
        cv.fill(306, y, 6, 1, "hot" if (y // 2) % 2 else "white")
    bd.outline_box(cv, 305, 89, 8, 40, "ink")
    for y in range(97, 126, 9):
        for x in range(318, 356, 9):
            cv.fill(x, y, 6, 6, "plum")
            cv.fill(x + 1, y + 1, 4, 4, "amber" if (x + y) % 4 else "navy")
    # the far paving, curb, Dundas Street with its rails and centre line, the near sidewalk
    cv.fill(0, BASE, W, 8, "lgrey")
    for x in range(0, W, 24):
        cv.fill(x, BASE, 1, 8, "grey")
    cv.fill(0, 139, W, 1, "lgrey")
    cv.fill(0, 140, W, 1, "slate")
    cv.fill(0, 141, W, 9, "dslate")
    for y in (142, 147):
        cv.fill(0, y, W, 1, "grey")
    for x in range(0, W, 16):
        cv.fill(x, 144, 8, 2, "amber")
    for x in range(0, W):
        cv.fill(x, 150, 1, 5, "lgrey")
    for y in range(150, STUB):
        s, _ = scale_at(BAR + y)
        lo, hi = round(CX - 160 * s), round(CX + 160 * s)
        cv.fill(lo, y, hi - lo, 1, "dslate")
        cv.fill(lo - 2, y, 2, 1, "lgrey")
        cv.fill(hi, y, 2, 1, "lgrey")
    cv.fill(0, 150, W, 1, "grey")
    # the overhead wire, the streetcar under it, the food truck at the far curb
    cv.fill(0, 112, W, 1, "ink")
    streetcar(cv, 6, 102, 149, 112)
    food_truck(cv, 268, 352, 146)
    return cv.img


# ---------- the screen ----------

def walk():
    use_camera()
    sc = mt.Scene(W, H)
    sc.shade, sc.leash_col = "navy", "pink"
    road(sc, BAR + STUB, DOG_BAND_Y)
    items = []
    for key, side, edge, z in PLACED:
        s = F / (F + z)
        items.append((YH + KS * s, "prop", (key, side, edge, s)))
    for key, tag, ln, d in OBJECTS:
        items.append((YH + KS * F / (F + d), "obj", (key, tag, ln, d)))
    for foot, kind, a in sorted(items, key=lambda it: it[0]):
        if kind == "obj":
            key, tag, ln, d = a
            sc.stand(key, tag, mt.lane(ln), d)
            continue
        key, side, edge, s = a
        art = at_depth(key, s)
        cx = CX + side * inner(key, edge) * s
        y = round(foot)
        if key in FREE:
            shade = sc.shade
            sc.shade = "slate"
            sc.shadow(round(cx), y, art.width * 0.8)
            sc.shade = shade
        sc.paste(art, cx - art.width / 2, y - art.height)
    sc.pack(mt.lane(2), tuple(f"dog-{d}" for d in DOGS))
    b = band()
    sc.img.paste(b.crop((0, 0, W, STUB)), (0, BAR))
    sn.ZONES["yonge"] = dict(sn.ZONES["shops"], name="Yonge Street")
    sc.top_bar(["yonge"], 0, 1, 0.3)
    bt = mt.TOP_BAR["buttons"]["sound"]
    sc.paste(sn.frame("ui-icon-button", "normal"), bt["face"]["x"], bt["face"]["y"])
    sc.paste(sn.frame("icon-sound", "on"), bt["icon"]["x"], bt["icon"]["y"])
    panel = mt.Scene(W, H - DOG_BAND_Y)
    panel.img.paste(sn.image("ui-dog-band"), (0, 0), sn.image("ui-dog-band"))
    for i, d in enumerate(DOGS):
        panel.doghouse(i * 120, 470 - DOG_BAND_Y, d, mt.dog(d)[3])
    sc.img.paste(panel.img, (0, DOG_BAND_Y))
    return sc.img


def props_sheet():
    """Every prop at full size, drawn 2x, on the walk's lgrey paving, a label under each."""
    pad, label_h, max_w = 12, 22, 1560
    rows, row, x = [], [], pad
    for key in PROPS:
        art = prop(key)
        if row and x + art.width * 2 > max_w:
            rows.append(row)
            row, x = [], pad
        row.append((key, art))
        x += art.width * 2 + pad
    rows.append(row)
    width = max(sum(a.width * 2 + pad for _, a in r) + pad for r in rows)
    height = sum(max(a.height * 2 for _, a in r) + label_h + pad for r in rows) + pad
    cv = sn.Canvas(width, height)
    cv.fill(0, 0, width, height, "lgrey")
    y = pad
    for r in rows:
        tall = max(a.height * 2 for _, a in r)
        x = pad
        for key, art in r:
            big = art.resize((art.width * 2, art.height * 2), Image.NEAREST)
            cv.fill(x, y + tall, big.width, 1, "grey")
            cv.paste(big, x, y + tall - big.height)
            sn.text(cv, CAPTIONS[key], x, y + tall + 6, "plum", 2)
            x += big.width + pad
        y += tall + label_h + pad
    return cv.img


def build():
    os.makedirs(OUT, exist_ok=True)
    walk().save(f"{OUT}/yonge-walk.png")
    props_sheet().save(f"{OUT}/yonge-props.png")
    print("built", f"{OUT}/yonge-walk.png", f"{OUT}/yonge-props.png")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
