#!/usr/bin/env python3
"""Draw the ambient layer: people, traffic and lawn animals that pass by with no collisions and no card.
Each is a road sprite with @88, @75, @62 and @50 variants, outlined with pixel.road_edge and lit with
road.LIT's rim on its dark parts; the cross street draws from @50. Side views face right; the game
flips them to go left.

The pedestrian is a student out for a stroll, calm and alone: dark brown hair in a ponytail, sky
headphones, a red jacket, a green backpack, sky jeans and white sneakers. No dog, no leash and no prop in
hand, so it never reads as an owner, a walker or a road hazard. It is laid out on 32x48 and drawn at
road.SCALE (1.5) on road.person's legs, and walks with the road people's stride, 4 frames at
road.PERSON_WALK_MS: a foot lifted, both feet 1px up as the body passes 1px higher, the other foot lifted,
passing again. Its feet are on row 68 at full size, as the walkers' are.

The cars are laid out in design units and drawn at road.SCALE: a cyan greenhouse with a lit roof and a
glint, the body lit along the belt line and a step darker along the sill and down the nose, lamps,
bumpers, dark wheel arches. drive (4 frames at DRIVE_MS): a spoke through each hub turns an eighth a frame,
and the body dips 1px onto the wheels on frames 1 and 2. ambient-car is the sedan; the other bodies are
extra keys. The cyclist rides an amber helmet, a mauve jersey and navy shorts on a red bike; ride
(4 frames at RIDE_MS): the cranks turn a quarter a frame with the feet on the pedals, a cross of spokes
turns an eighth, and the back and head sit 1px lower on frames 1 and 3. Its wheels are clear inside, so
the road shows between the spokes.

The lawn animals are laid out on 32x32 and drawn at ANIMAL_SCALE (1.25), the chase animals' size, each
idle first so frame 0 is its rest pose on the ground.

ambient-pedestrian        48x72  front view, walking toward the walker; walk 4 x 100ms
ambient-pedestrian-back   48x72  back view, walking away; walk 4 x 100ms
ambient-car               72x42  an orange sedan; drive 4 x 100ms
ambient-car-hatchback     63x42  a red hatchback
ambient-car-van           69x45  a two-tone van, white over green
ambient-car-wagon         75x42  a cream station wagon with a wood side panel and a roof rack
ambient-bike              66x72  the cyclist side on; ride 4 x 120ms
ambient-cat               40x40  a ginger tabby; idle 2 x 400ms (sat, its tail flicking), run 4 x 90ms (a gallop)
ambient-rabbit            40x40  a brown cottontail; idle 2 x 400ms (a nose twitch), hop 4 x 110ms
ambient-bird              40x40  a robin; idle 2 x 400ms (a peck), fly 4 x 90ms (wings up, level, down, level)
ambient-plane             24x10  a passenger jet far off in Yonge Street's evening sky, at full size only;
                                 fly 2 x 250ms (only its lights blink)

The plane is a navy silhouette outlined in ink against the slate sky, its underside lit grey by the city,
amber cabin windows, a steady white strobe on its fin and a wingtip light blinking red then white. It flies
far back, so it has no depth variants, and it stays smaller than the CN Tower's pod.

Usage:
  ambient.py preview OUT.png   every frame on the road colours
  ambient.py build             write art/ambient/*.aseprite and export to public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them belong
in this file instead. Shared tooling is in pixel.py; the legs, face and rim come from road.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import road  # noqa: E402
from minis import STEPS, Mini, small, snap  # noqa: E402
from pixel import DARKER, K, Grid, edged, main  # noqa: E402

DRIVE_MS = 100
RIDE_MS = 120
# The lawn animals are laid out on 32x32 and drawn ANIMAL_SCALE times larger, 40x40, the chase animals' size.
ANIMAL_SCALE = 1.25
IDLE_MS = 400
RUN_MS = 90
HOP_MS = 110
FLY_MS = 90
PLANE_MS = 250

GROUNDS = ("3a4466", "e4a672", "f6757a", "c28569", "8b9bb4", "ead4aa", "c0cbdc")


# ---------- the pedestrian, laid out on 32x48 as road.person's tops are ----------

def student_front(g, b):
    """The student facing the walker: a red jacket with its zip, the backpack's straps over the shoulders,
    hands at rest, and headphones over dark brown hair."""
    g.rect(9, 21 + b, 14, 13, "red")
    g.rect(20, 21 + b, 3, 13, "dred")
    g.rect(15, 21 + b, 2, 13, "dred")
    g.rect(9, 32 + b, 14, 2, "dred")
    g.rect(5, 22 + b, 4, 9, "red")
    g.rect(5, 31 + b, 4, 3, "skin1")
    g.rect(23, 22 + b, 4, 9, "red")
    g.rect(26, 22 + b, 1, 9, "dred")
    g.rect(23, 31 + b, 4, 3, "skin1")
    g.rect(10, 21 + b, 2, 9, "green")
    g.rect(20, 21 + b, 2, 9, "dgreen")
    road.face_disc(g, 16, 12.5 + b, 8, 8, "skin1", "skin2")
    g.cel(16, 8 + b, 9, 5, "dbrown", "plum", "brown")
    g.rect(7, 8 + b, 3, 7, "dbrown")
    g.rect(22, 8 + b, 3, 7, "plum")
    g.rect(10, 8 + b, 12, 2, "dbrown")
    g.rect(9, 2 + b, 14, 2, "sky")
    g.rect(5, 10 + b, 4, 6, "sky")
    g.rect(23, 10 + b, 4, 6, "blue")
    road.face_front(g, 16, 13 + b)
    g.p(10, 16 + b, "pink")
    g.p(22, 16 + b, "pink")


def student_back(g, b):
    """The student walking away: the green backpack over the red jacket, its pocket and zip, the ponytail
    over the backpack's top, tied in red, the headphones' band over it and a cup over each ear."""
    g.rect(9, 21 + b, 14, 13, "red")
    g.rect(20, 21 + b, 3, 13, "dred")
    g.rect(9, 32 + b, 14, 2, "dred")
    g.rect(5, 22 + b, 4, 9, "red")
    g.rect(5, 31 + b, 4, 3, "skin1")
    g.rect(23, 22 + b, 4, 9, "red")
    g.rect(26, 22 + b, 1, 9, "dred")
    g.rect(23, 31 + b, 4, 3, "skin2")
    g.rect(10, 22 + b, 12, 10, "green")
    g.rect(19, 22 + b, 3, 10, "dgreen")
    g.rect(10, 22 + b, 12, 1, "yellow")
    g.rect(12, 27 + b, 8, 4, "dgreen")
    g.rect(12, 27 + b, 8, 1, "yellow")
    g.rect(14, 19 + b, 4, 3, "skin1")
    g.cel(16, 12.5 + b, 8.5, 8.5, "dbrown", "plum", "brown")
    g.ell(16, 22.5 + b, 2.5, 3.5, "dbrown", "plum")
    g.rect(15, 19 + b, 2, 1, "red")
    g.rect(9, 3 + b, 14, 2, "sky")
    g.rect(5, 10 + b, 4, 6, "sky")
    g.rect(23, 10 + b, 4, 6, "blue")


LEGS = dict(legs="sky", shoes="white")


def walking(s, top, step):
    """A walk frame at scale s (road.SCALE x the depth step), on road.person's legs in road.PERSON_WALK's pose."""
    return small(road, s, road.dressed, top, **LEGS, **snap(road.PERSON_WALK[step], s)).outlined()


def pedestrians(suffix, step):
    """Yield (key, tags) for the pedestrian's front and back views at a depth step."""
    s = road.SCALE * step
    for key, top in (("ambient-pedestrian", student_front), ("ambient-pedestrian-back", student_back)):
        yield f"{key}{suffix}", [("walk", [walking(s, top, f) for f in range(4)], road.PERSON_WALK_MS)]


# ---------- cars: side elevations, laid out in design units and drawn at road.SCALE ----------

def dk(c):
    return DARKER[K.get(c, c)]


def rimmed(g, extra=None):
    """road.rim with road.LIT (and extra) on g's own grid, returning g."""
    road.rim(getattr(g, "g", g), {**road.LIT, **(extra or {})})
    return g


# A hub's spoke a frame, an eighth of a turn clockwise each, as a wheel rolling right turns: |, /, - and \,
# as offsets from the hub's centre.
SPOKES = (((0, -2), (0, -1), (0, 1), (0, 2)), ((1, -1), (-1, 1)), ((-2, 0), (-1, 0), (1, 0), (2, 0)),
          ((-1, -1), (1, 1)))
ROOF = 3            # every car's roof row; the frame keeps 2 clear rows above it and 2 columns each side
TYRE = 5            # a tyre's radius; it rises 3 rows into the body


class Car:
    """A car's side profile facing right, in design units. The greenhouse runs from the roof (ROOF) to the
    row above belt, the body from belt for body rows, and the tyres reach TYRE * 2 - 3 rows past the body to
    the ground row. cabin is the roof's first and last column; back and front are how many columns the
    greenhouse widens per row behind and ahead. Columns are counted from the art's left edge, 2 in from the
    frame's."""

    def __init__(self, length, belt, cabin, back, front, wheels, paint, body=9, **q):
        self.length, self.belt, self.body, self.cabin = length, belt, body, cabin
        self.back, self.front, self.wheels = back, front, wheels
        self.base, self.shade, self.light = paint
        self.q = q
        self.end = belt + body - 1
        self.cy = self.end - 3 + TYRE + 0.5
        self.w, self.h = length + 4, self.end + TYRE * 2 - 3 + 2

    def span(self, y):
        """The greenhouse's first and last column on row y."""
        x0, x1 = self.cabin
        k = y - ROOF
        return math.floor(x0 - k * self.back), math.ceil(x1 + k * self.front)

    def draw(self, s, roll):
        """Drive frame roll (0 to 3) at scale s: the body 1px lower on frames 1 and 2."""
        g = edged(Mini(s, self.w, self.h))
        dip = 1 / s if roll in (1, 2) else 0
        q, L, belt, end = self.q, self.length, self.belt, self.end
        upper = q.get("upper", self.base)

        def rect(x, y, w, h, c):
            g.rect(x + 2, y + dip, w, h, c)

        # the greenhouse: pillars in the paint round the glass, the roof lit
        (a0, a1), (b0, b1) = self.span(ROOF), self.span(belt)

        def quad(pts, c):
            pts = [(x + 2, y + dip) for x, y in pts]
            g.tri(pts[0], pts[1], pts[2], c)
            g.tri(pts[0], pts[2], pts[3], c)

        quad(((a0, ROOF), (a1 + 1, ROOF), (b1 + 1, belt), (b0, belt)), upper)
        quad(((a0 + 2, ROOF + 1), (a1 - 1, ROOF + 1), (b1 - 1, belt), (b0 + 2, belt)), "cyan")
        rect(a0, ROOF, a1 - a0 + 1, 1, self.light)
        for x in q.get("pillars", ()):
            rect(x, ROOF + 1, 2, belt - ROOF - 1, upper)
        gx = self.span(ROOF + 1)[1] - 3
        for i in range(3):
            rect(gx - i, ROOF + 2 + i, 1, 1, "white")
        if "rack" in q:
            x0, x1 = q["rack"]
            rect(x0, ROOF - 1, x1 - x0 + 1, 1, "dslate")
            for x in (x0 + 1, x1 - 1):
                rect(x, ROOF - 1, 1, 1, "grey")
        # the body: lit along the belt, a step darker along the sill and down the nose
        rect(1, belt, L - 2, self.body, self.base)
        rect(1, belt, L - 2, 1, self.light)
        rect(1, end - 1, L - 2, 2, self.shade)
        rect(L - 3, belt + 1, 2, self.body - 2, self.shade)
        for x0, x1, y0, y1, c in q.get("bands", ()):
            rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, c)
        for x in q.get("doors", ()):
            rect(x, belt + 1, 1, self.body - 3, self.shade)
            rect(x + 2, belt + 2, 2, 1, "lgrey")
        mx = self.span(belt - 1)[1] - 2
        rect(mx, belt - 2, 3, 2, self.shade)
        # lamps and bumpers
        rect(L - 3, belt + 1, 2, 2, "yellow")
        rect(L - 3, belt + 1, 1, 1, "white")
        rect(1, belt + 1, 2, 3, "red")
        rect(0, end - 3, 3, 3, "lgrey")
        rect(L - 3, end - 3, 3, 3, "lgrey")
        rect(0, end - 1, 3, 1, "grey")
        rect(L - 3, end - 1, 3, 1, "grey")
        # wheel arches, dark inside the body, cut off below it, then the tyres in front of them
        for cx in self.wheels:
            rect(cx - TYRE - 1.5, self.cy - TYRE - 1.5 - dip, (TYRE + 1.5) * 2, 1, None)
            g.ell(cx + 2, self.cy + dip, TYRE + 1.5, TYRE + 1.5, "navy")
        g.rect(0, end + 1 + dip, self.w, self.h, None)
        rimmed(g, dict(navy=("slate", None)))
        for cx in self.wheels:
            cx += 2
            g.ell(cx, self.cy, TYRE, TYRE, "ink")
            g.ell(cx, self.cy, 2.6, 2.6, "grey")
            for dx, dy in SPOKES[roll]:
                g.rect(cx - 0.5 + dx, self.cy - 0.5 + dy, 1, 1, "dslate")
            g.rect(cx - 0.5, self.cy - 0.5, 1, 1, "lgrey")
        road.rim(g.g, dict(ink=("grey", None)))
        return g.outlined()


# ambient-car is the sedan; the other bodies are extra keys the game may take in turn.
CARS = {
    "ambient-car": Car(44, 11, (16, 26), 0.9, 1.5, (10, 34), ("orange", "rust", "amber"), pillars=(21,),
                       doors=(12, 22)),
    "ambient-car-hatchback": Car(38, 11, (8, 23), 0.6, 1.4, (9, 29), ("red", "dred", "pink"), pillars=(16,),
                                 doors=(15,)),
    "ambient-car-van": Car(42, 13, (3, 30), 0, 1, (9, 33), ("green", "dgreen", "yellow"), upper="white",
                           pillars=(10, 20), doors=(20,), bands=((1, 40, 13, 13, "white"),)),
    "ambient-car-wagon": Car(46, 11, (6, 32), 0, 1.4, (10, 36), ("cream", "tan", "white"), pillars=(13, 23),
                             doors=(14, 24), rack=(8, 30),
                             bands=((3, 41, 14, 17, "brown"), (3, 41, 14, 14, "ochre"), (3, 41, 17, 17, "dbrown"))),
}


def cars(suffix, step):
    """Yield (key, tags) for every car at a depth step."""
    s = road.SCALE * step
    for key, car in CARS.items():
        yield f"{key}{suffix}", [("drive", [car.draw(s, r) for r in range(4)], DRIVE_MS)]


# ---------- the cyclist: side on, laid out on 42x48 and drawn at road.SCALE ----------

# The bike in design units: hubs, the bottom bracket, the seat cluster, the head tube's top and bottom.
REAR, FRONT, BB, SEAT, HEAD, FORK = (9, 38.5), (33, 38.5), (20, 39), (16, 26), (30, 25), (31, 29)
WHEEL = 8           # a wheel's radius: an ink tyre 1.2 thick round an lgrey rim 0.8 thick, clear inside
CRANK = 4
HIP = (16.5, 22)
THIGH, SHIN = 10, 11
# The near pedal a frame, a quarter turn clockwise each, as the wheels turn: top, front, bottom, back.
PEDAL = ((0, -1), (1, 0), (0, 1), (-1, 0))


def bar(g, a, b, w, c):
    """A straight bar w thick from a to b, as a quadrilateral."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = max(1e-6, math.hypot(dx, dy))
    px, py = -dy / n * w / 2, dx / n * w / 2
    p = ((a[0] + px, a[1] + py), (b[0] + px, b[1] + py), (b[0] - px, b[1] - py), (a[0] - px, a[1] - py))
    g.tri(p[0], p[1], p[2], c)
    g.tri(p[0], p[2], p[3], c)


def knee(hip, foot):
    """Where the knee bends between hip and foot, forward of the line between them."""
    dx, dy = foot[0] - hip[0], foot[1] - hip[1]
    d = max(1e-6, math.hypot(dx, dy))
    r = min(d, THIGH + SHIN - 1e-6)
    a = (THIGH ** 2 - SHIN ** 2 + r ** 2) / (2 * r)
    h = math.sqrt(max(0.0, THIGH ** 2 - a ** 2))
    nx, ny = dy / d, -dx / d
    if nx < 0:
        nx, ny = -nx, -ny
    return hip[0] + dx * a / d + nx * h, hip[1] + dy * a / d + ny * h


class Shift:
    """A Mini seen through a column offset: every shape lands dx design units to the right."""

    def __init__(self, g, dx):
        self.g, self.dx = g, dx

    def rect(self, x, y, w, h, c):
        self.g.rect(x + self.dx, y, w, h, c)

    def ell(self, cx, cy, rx, ry, c, sh=None, li=None):
        self.g.ell(cx + self.dx, cy, rx, ry, c, sh, li)

    def cel(self, cx, cy, rx, ry, c, sh=None, li=None):
        self.g.cel(cx + self.dx, cy, rx, ry, c, sh, li)

    def tri(self, a, b, c, col):
        self.g.tri(*((x + self.dx, y) for x, y in (a, b, c)), col)


def cyclist(s, f):
    """Ride frame f (0 to 3) at scale s: a rider in an amber helmet, a mauve jersey and navy shorts on a red
    bike, side on, riding right. The cranks turn a quarter a frame with the feet on the pedals, the spokes an
    eighth (a cross of them, so the loop is seamless), and the rider's back and head sit 1px lower on frames
    1 and 3. The spokes go on after the outline, so the road shows between them."""
    w, h = 44, 48
    g = Shift(edged(Mini(s, w, h)), 1)
    b = 1 / s if f in (1, 3) else 0
    px, py = PEDAL[f]
    near = (BB[0] + CRANK * px, BB[1] + CRANK * py)
    far = (BB[0] - CRANK * px, BB[1] - CRANK * py)
    for cx, cy in (REAR, FRONT):
        g.ell(cx, cy, WHEEL, WHEEL, "ink")
        g.ell(cx, cy, WHEEL - 1.2, WHEEL - 1.2, "lgrey")
        g.ell(cx, cy, WHEEL - 2, WHEEL - 2, None)

    def leg(foot, skin, shoe):
        k = knee(HIP, foot)
        bar(g, HIP, k, 4, skin)
        bar(g, k, foot, 3.5, skin)
        g.ell(k[0], k[1], 2, 2, skin)
        g.rect(foot[0] - 2.5, foot[1] - 1.5, 6, 2.5, shoe)

    leg(far, "skin2", "lgrey")
    bar(g, BB, far, 1.5, "grey")
    for a, c in ((REAR, BB), (REAR, SEAT), (BB, SEAT), (SEAT, HEAD), (BB, FORK), (HEAD, FRONT)):
        bar(g, a, c, 2, "red")
    bar(g, SEAT, (15.5, 23), 1.5, "grey")
    g.rect(12, 22, 7, 2, "ink")
    bar(g, HEAD, (29.5, 21), 1.5, "grey")
    g.rect(27, 20, 4, 2, "ink")
    # the rider: shorts on the saddle, the back bent toward the bars, the arm to the grip
    g.ell(16.5, 21 + b, 4, 3, "navy")
    bar(g, (16.5, 19 + b), (23, 13 + b), 7.5, "mauve")
    bar(g, (19, 21 + b), (25, 15.5 + b), 2, "purple")
    bar(g, (23.5, 14 + b), (28, 19), 3, "mauve")
    bar(g, (27, 18), (29, 21), 2.5, "skin1")
    # the head side on: face, nose and eye, hair at the nape, the helmet over it all
    g.ell(26, 9 + b, 6.5, 6.5, "skin1")
    g.rect(31.5, 9 + b, 1.5, 2, "skin1")
    g.rect(20.5, 9 + b, 4, 5, "dbrown")
    g.rect(28, 8 + b, 2, 2, "ink")
    g.rect(28, 8 + b, 1, 1, "white")
    g.rect(29, 13 + b, 2, 1, "dbrown")
    g.rect(24, 9 + b, 2, 3, "skin2")
    g.cel(25, 5.5 + b, 7, 4, "amber", "orange", "yellow")
    g.rect(19.5, 7 + b, 12, 1.5, "orange")
    g.rect(30, 6.5 + b, 3, 1, "orange")
    for x in (23, 26):
        g.rect(x, 3 + b, 1.5, 1, "orange")
    bar(g, BB, near, 1.5, "lgrey")
    g.ell(BB[0], BB[1], 1.5, 1.5, "grey")
    leg(near, "skin1", "white")
    out = rimmed(g.g, dict(navy=("grey", "slate"), purple=("mauve", None))).outlined()
    # the spokes: a cross through each hub, an eighth of a turn on per frame
    for cx, cy in (REAR, FRONT):
        cx, cy = (cx + 1) * s, cy * s
        r = (WHEEL - 2) * s
        for k in range(2):
            a = math.radians(f * 22.5 + k * 90)
            for t in range(-int(r), int(r) + 1):
                x, y = math.floor(cx + t * math.cos(a)), math.floor(cy + t * math.sin(a))
                if math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r - 0.3 and not out[y][x]:
                    out[y][x] = K["grey"]
        out[math.floor(cy)][math.floor(cx)] = K["dslate"]
    return out


def bikes(suffix, step):
    """Yield (key, tags) for the cyclist at a depth step."""
    s = road.SCALE * step
    yield f"ambient-bike{suffix}", [("ride", [cyclist(s, f) for f in range(4)], RIDE_MS)]


# ---------- lawn animals: side on, facing right, laid out on 32x32 ----------
# Each stands on row 30; frame 0 of its idle is the rest pose the game measures its feet from.

def ginger_cat(pose):
    """A ginger tabby side on. pose is (body dy, back arch, near and far front feet, near and far back feet,
    tail tip) for a run frame, or "sit" and "sit-tail" for the idle: sat up, its tail curled round, the
    tail's tip flicking on the second frame."""
    def draw(g):
        if isinstance(pose, str):
            g.cel(17, 30, 4, 1.5, "rust")
            tip = (5, 22) if pose == "sit" else (4, 19)
            bar(g, (11, 28), (7, 27), 2.5, "orange")
            bar(g, (7, 27), tip, 2.5, "orange")
            g.ell(tip[0], tip[1], 1.5, 1.5, "rust")
            g.cel(14, 23, 6, 7, "orange", "rust", "amber")
            for x in (11, 14):
                g.rect(x, 17, 1, 4, "rust")
            g.rect(18, 22, 3, 8, "orange")
            g.rect(20, 22, 1, 8, "rust")
            g.rect(17, 28, 5, 2, "cream")
            g.cel(19, 15, 5, 4.5, "orange", "rust", "amber")
            g.tri((15, 12), (18, 11), (16, 6.5), "orange")
            g.tri((19, 11), (22, 12), (21, 6.5), "orange")
            g.tri((20, 11), (21.5, 11.5), (21, 8.5), "pink")
            g.rect(20, 16, 4.5, 3, "cream")
            g.rect(21, 14, 2, 2, "green")
            g.rect(22, 14, 1, 2, "ink")
            g.rect(24, 16, 1, 1, "pink")
            return
        dy, arch, nf, ff, nb, fb, tail = pose
        for (x0, y0), foot, c in (((22, 22), ff, "rust"), ((9, 22), fb, "rust")):
            bar(g, (x0, y0 + dy), foot, 2.5, c)
            g.rect(foot[0] - 1, foot[1] - 1, 3, 2, c)
        bar(g, (8, 19 + dy), (4, 15 + dy), 2.5, "orange")
        bar(g, (4, 15 + dy), tail, 2.5, "orange")
        g.ell(tail[0], tail[1], 1.5, 1.5, "rust")
        g.cel(15, 20 + dy - arch, 9, 4.5 + arch, "orange", "rust", "amber")
        for x in (11, 14, 17):
            g.rect(x, 16 + dy - arch * 2, 1, 3, "rust")
        g.rect(12, 23 + dy, 8, 1.5, "cream")
        for (x0, y0), foot in (((22, 22), nf), ((9, 22), nb)):
            bar(g, (x0, y0 + dy), foot, 3, "orange")
            g.rect(foot[0] - 1, foot[1] - 1, 3, 2, "cream")
        g.cel(25, 16 + dy, 4.5, 4, "orange", "rust", "amber")
        g.tri((21.5, 14 + dy), (24.5, 13 + dy), (22.5, 8.5 + dy), "orange")
        g.tri((24.5, 13 + dy), (27.5, 13.5 + dy), (26.5, 9 + dy), "orange")
        g.rect(26, 17 + dy, 4, 2.5, "cream")
        g.rect(26, 15 + dy, 2, 1.5, "ink")
        g.rect(29.5, 17 + dy, 1, 1, "pink")
    return draw


# The cat's gallop: stretched out, landing on its front feet, gathered with its back arched, pushing off.
CAT_RUN = ((0, 0, (28, 28.5), (26.5, 29.5), (3.5, 27.5), (5, 28.5), (3.5, 9)),
           (1, 0, (23, 29.5), (25, 29.5), (6, 28), (8, 29), (3.5, 12)),
           (-1, 2, (17, 29.5), (19, 29), (14, 29.5), (12, 29), (4, 8)),
           (0, 1, (27, 25), (25, 26), (6, 29.5), (8, 29.5), (3.5, 10)))
CAT_IDLE = ("sit", "sit-tail")


def cottontail(pose):
    """A brown cottontail rabbit side on. pose is (body dy, stretch, ear tilt, hind foot dx, front paw (dx,
    dy)); a nose twitch shows on the idle's second frame (stretch -1)."""
    dy, stretch, tilt, hind, paw = pose

    def draw(g):
        bx = 14 + stretch
        g.rect(9 + hind, 29 + dy, 9, 1.5, "dbrown")
        g.cel(bx, 22 + dy, 7.5 + stretch, 6.5 - stretch * 0.5, "brown", "dbrown", "tan")
        g.cel(bx - 2, 24 + dy, 4.5, 4.5, "brown", "dbrown")
        g.rect(9 + hind, 28.5 + dy, 8, 1.5, "tan")
        g.ell(bx - 8, 20 + dy, 2.5, 2.5, "white")
        g.rect(bx + 4 + paw[0], 25 + dy + paw[1], 2, 5 - paw[1], "brown")
        g.rect(bx + 4 + paw[0], 29 + dy, 3, 1, "tan")
        hx, hy = bx + 9, 16 + dy
        top = hy - 12 + tilt * 1.5
        bar(g, (hx - 2, hy - 2), (hx - 5 - tilt, top), 3, "brown")
        bar(g, (hx, hy - 2), (hx - 2 - tilt, top), 3, "brown")
        bar(g, (hx, hy - 3), (hx - 2 - tilt, top + 2), 1, "pink")
        g.cel(hx, hy, 4.5, 4, "brown", "dbrown", "tan")
        g.rect(hx + 1, hy - 1, 2, 2, "ink")
        g.rect(hx + 1, hy - 1, 1, 1, "white")
        g.rect(hx + 3.5, hy + 1 - (0.5 if stretch < 0 else 0), 1, 1, "pink")
        g.rect(hx - 1, hy + 2, 4, 1.5, "cream")
    return draw


# Idle: sat still, then the nose twitches and the ears tip back. Hop: crouched, launching stretched out,
# airborne at the top, landing on the front paws.
RABBIT_IDLE = ((0, 0, 0, 0, (0, 0)), (0, -1, 1, 0, (0, 0)))
RABBIT_HOP = ((0, -1, 2, 1, (0, 0)), (-3, 2, 3, -3, (3, -1)), (-5, 2, 4, -1, (3, -2)), (-1, 1, 0, 2, (2, 0)))


def robin(peck=False, wing=None):
    """A robin side on, facing right. wing None stands it on the lawn (peck tips its head to the ground); in
    flight, wing is up, level or down, the legs tucked and the body a little higher."""
    def draw(g):
        lift = -2 if wing else 0
        if wing is None:
            for x in (13, 17):
                g.rect(x, 25, 1, 5, "ochre")
                g.rect(x, 29, 3, 1, "ochre")
        cx, cy = 15, 20 + lift
        hx, hy = (23, 22) if peck else (21, 13)
        g.tri((8, cy - 2), (9, cy + 2), (2, cy - 5 + (3 if peck else 0)), "dbrown")
        g.cel(cx, cy, 8, 5.5, "brown", "dbrown", "tan")
        g.cel(cx + 3, cy + 1.5, 5, 4, "orange", "rust", "amber")
        g.cel(hx, hy + lift, 4.5, 4.5, "brown", "dbrown", "tan")
        g.cel(hx + 1.5, hy + lift + 2, 2.5, 2.5, "orange", "rust")
        g.rect(hx + 1, hy + lift - 1.5, 2, 2, "ink")
        g.rect(hx + 1, hy + lift - 1.5, 1, 1, "white")
        g.tri((hx + 4, hy + lift - 1), (hx + 4, hy + lift + 1), (hx + 7, hy + lift), "amber")
        if wing is None:
            g.cel(cx - 2, cy - 1, 5.5, 3.5, "dbrown", "plum", "brown")
        elif wing == "up":
            g.tri((10, cy - 3), (18, cy - 3), (7, cy - 15), "dbrown")
            g.tri((11, cy - 3), (16, cy - 3), (9, cy - 11), "brown")
        elif wing == "level":
            g.tri((10, cy - 3), (18, cy - 2), (1, cy - 6), "dbrown")
            g.tri((11, cy - 3), (17, cy - 2), (5, cy - 5), "brown")
        else:
            g.tri((10, cy), (18, cy), (8, cy + 10), "dbrown")
            g.tri((11, cy), (16, cy), (10, cy + 7), "brown")
    return draw


BIRD_IDLE = (robin(), robin(peck=True))
BIRD_FLY = (robin(wing="up"), robin(wing="level"), robin(wing="down"), robin(wing="level"))


def animal(s, draw):
    """One frame of a lawn animal at scale s, outlined and rimmed."""
    g = edged(Mini(s, 32, 32))
    draw(g)
    return rimmed(g).outlined()


def animals(suffix, step):
    """Yield (key, tags) for the lawn animals at a depth step; idle first, so frame 0 is the rest pose."""
    s = ANIMAL_SCALE * step
    yield f"ambient-cat{suffix}", [("idle", [animal(s, ginger_cat(p)) for p in CAT_IDLE], IDLE_MS),
                                   ("run", [animal(s, ginger_cat(p)) for p in CAT_RUN], RUN_MS)]
    yield f"ambient-rabbit{suffix}", [("idle", [animal(s, cottontail(p)) for p in RABBIT_IDLE], IDLE_MS),
                                      ("hop", [animal(s, cottontail(p)) for p in RABBIT_HOP], HOP_MS)]
    yield f"ambient-bird{suffix}", [("idle", [animal(s, d) for d in BIRD_IDLE], IDLE_MS),
                                    ("fly", [animal(s, d) for d in BIRD_FLY], FLY_MS)]


def plane(light):
    """The jet side on, facing right, its wingtip light in light."""
    g = Grid(24, 10)
    for y, x0 in ((1, 3), (2, 3), (3, 3)):
        g.rect(x0, y, y, 1, "navy")
    g.rect(3, 4, 16, 1, "navy")
    g.rect(1, 5, 20, 1, "navy")
    g.rect(4, 6, 16, 1, "grey")
    g.rect(9, 7, 5, 1, "navy")
    g.rect(12, 7, 2, 1, "dslate")
    g.rect(8, 8, 3, 1, "grey")
    for x in range(7, 17, 2):
        g.p(x, 5, "amber")
    g.p(19, 5, "dslate")
    g.p(3, 1, "white")
    g.p(8, 8, light)
    return g.outlined()


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every ambient sprite at full size, then at every
    depth step."""
    for suffix, step in (("", 1),) + tuple((f"@{x}", q) for x, q in STEPS):
        yield from pedestrians(suffix, step)
        yield from cars(suffix, step)
        yield from bikes(suffix, step)
        yield from animals(suffix, step)
    yield "ambient-plane", [("fly", [plane("red"), plane("white")], PLANE_MS)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/ambient", __doc__, grounds=GROUNDS)
