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
extra keys. The bus is a TTC bus: a white greenhouse and roof pod over a red body with two white stripes,
six windows, glass front and middle doors split down the middle, a tall windshield under an amber-lit
destination sign, and its lamps low at the bumpers; side on it shows no pantograph and rides on tyres, so it
never reads as the streetcar. The cyclist rides an amber helmet, a mauve jersey and navy shorts on a red bike; ride
(4 frames at RIDE_MS): the cranks turn a quarter a frame with the feet on the pedals, a cross of spokes
turns a sixteenth, and the back and head sit 1px lower on frames 1 and 3. Its wheels are clear inside, so
the road shows between the spokes.

The lawn animals are laid out on 32x32 and drawn at ANIMAL_SCALE (1.25), 40x40, each
idle first so frame 0 is its rest pose on the ground.

ambient-pedestrian        48x72  front view, walking toward the walker; walk 4 x 100ms
ambient-pedestrian-back   48x72  back view, walking away; walk 4 x 100ms
ambient-car               72x42  an orange sedan; drive 4 x 100ms
ambient-car-hatchback     63x42  a red hatchback
ambient-car-van           69x45  a two-tone van, white over green
ambient-car-wagon         75x42  a cream station wagon with a wood side panel and a roof rack
ambient-bus               126x54 a TTC bus, red and white; drive 4 x 100ms
ambient-bike              66x72  the cyclist side on; ride 4 x 120ms
ambient-cat               40x40  a ginger tabby; idle 2 x 400ms (sat, its tail flicking), run 4 x 90ms (a gallop)
ambient-rabbit            40x40  a brown cottontail; idle 2 x 400ms (a nose twitch), hop 4 x 110ms
ambient-bird              40x40  a robin; idle 2 x 400ms (a peck), fly 4 x 90ms (wings up, level, down, level)
ambient-plane             26x10  a jet over Yonge Street; fly 2 x 250ms (its lights blink)
ambient-balloon           18x26  a hot air balloon over High Park; fly 4 x 300ms (a 1px bob, the burner flickers)
ambient-pigeons           36x15  five pigeons over Kensington Market; fly 4 x 90ms (wingbeats out of phase)
ambient-helicopter        26x12  a helicopter over Kensington Market; fly 4 x 80ms (rotor blur, a tail beacon)
ambient-geese             36x18  a V of five Canada geese over Cabbagetown; fly 4 x 140ms (wingbeats)
ambient-turboprop         32x12  a Porter turboprop over The Beaches; fly 4 x 90ms (propeller blur, a beacon)
ambient-banner-plane      39x10  a small plane towing a banner; fly 4 x 120ms (propeller, the banner ripples)
ambient-gulls             36x12  three gulls; fly 4 x 120ms (wingbeats out of phase)
ambient-hawk              24x10  a red-tailed hawk soaring; fly 4 x 250ms (banking left and right)
ambient-party-balloons    17x27  three party balloons on gathered strings; fly 4 x 250ms (each bobs 1px)
ambient-blimp             31x12  a blimp with a lit sign; fly 4 x 200ms (the sign's lights chase)
ambient-airliner          36x7   an airliner far overhead with its contrail; fly 4 x 200ms (the trail breaks up)
ambient-bats              29x11  three bats at dusk; fly 4 x 80ms (wingbeats and a flutter out of phase)
ambient-kite              17x28  a diamond kite on its string; fly 4 x 200ms (the ribbon tail sways)

The sky movers fly far back, so each is at full size only with no depth variants, faces right, and has
one fly tag. Each is a few large shapes that read at 1x on its sky (Yonge Street's slate, then azure,
pink, lilac, peach and gold), with one ink line round every fill except the geese's and the bats'. A line
one pixel thin, a rope, a string, a contrail, a skid or a rotor blur, is drawn past the outline so the ink
does not thicken it.
- The plane is a white fuselage over a grey belly with one row of windows, a rounded nose with cockpit
  glass, a swept red fin, and the swept slate wing below with its engine. The wingtip light and the belly
  beacon are red on frame 0 and flash white on frame 1. It stays smaller than the CN Tower's pod.
- The balloon is a teardrop envelope of seven curved gores, red and amber, the rightmost a step darker,
  glinting at its upper left, on two ink ropes to a wicker basket. It sits 1px lower on frames 2 and 3,
  and the burner flares on frames 0 and 2.
- The pigeons are grey chevrons with slate bodies in a loose straggle, each a different step through its
  wingbeat (up, level, down, level) so the flock shimmers.
- The helicopter is red with a foam glass bubble at the nose, a tapered tail boom and fin, thin ink skids
  and a thin rotor blur. The main rotor alternates a long blur and a broken one each frame; the fin's
  beacon is red on frames 0 and 1.
- The geese are dark brown bodies with darker wings, black tails, black neck lines and white chinstraps,
  with no outline, as birds far off read against the dusk. The leader is at the V's point on the right
  and each goose is a step behind the one ahead in its wingbeat.
- The turboprop is a white fuselage with a navy belly, one row of windows and a navy cockpit glass, a navy
  T-tail, the high wing along the roof with its engine hung forward, and the gear down for the island
  airport. The propeller is a tall slate disc crossing the fuselage with a blade bright at its top, then
  its bottom; the belly beacon is red on frames 0 and 1.
- The banner plane is a small white high-wing plane with a red fin and wing and fixed gear, towing a
  white banner of red lettering on a thin rope; the banner's tail ripples, the wave travelling back.
- The gulls are white, larger than the pigeons and bent at the wrist, with grey tails and amber beaks.
- The hawk is seen from below as it soars: cream wing linings with dark leading edges and fingertips, a
  dark belly band and a fanned rust tail. It banks a pixel at the wingtips one way, then the other.
- The party balloons are red, sky and yellow, each glinting and bobbing out of step, on ink strings that
  gather to one knot; the loose end swings. They have no basket, so they never read as the hot air balloon.
- The blimp is a white envelope shaded lgrey, red fins at its tail, a navy sign whose amber lights chase
  toward the nose, and a gondola with cyan windows.
- The airliner is small and high: a white fuselage, a blue fin, a slate wing and engine, and a thin white
  contrail whose far end breaks into dashes.
- The bats are ink silhouettes with no outline, as the geese, so they hold on Yonge Street's slate: ears,
  a body and wings raised, spread with a scalloped trailing edge, or down, each fluttering a pixel up and
  down out of step.
- The kite is a diamond quartered red and white with a red and white ribbon tail swaying under it and its
  string running down to the lower left.

Usage:
  ambient.py preview OUT.png   every frame on the zone roads
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
from pixel import DARKER, K, Grid, bitmap, edged, main  # noqa: E402

DRIVE_MS = 100
RIDE_MS = 120
# The lawn animals are laid out on 32x32 and drawn ANIMAL_SCALE times larger, 40x40.
ANIMAL_SCALE = 1.25
IDLE_MS = 400
RUN_MS = 90
HOP_MS = 110
FLY_MS = 90
PLANE_MS = 250
BALLOON_MS = 300
PIGEON_MS = 90
HELICOPTER_MS = 80
GEESE_MS = 140
TURBOPROP_MS = 90
BANNER_PLANE_MS = 120
GULLS_MS = 120
HAWK_MS = 250
PARTY_BALLOONS_MS = 250
BLIMP_MS = 200
AIRLINER_MS = 200
BATS_MS = 80
KITE_MS = 200


# ---------- the pedestrian, laid out on 32x48 as road.person's tops are ----------

def student_front(g, b, arms=0):
    """The student facing the walker: a red jacket with its zip, the backpack's straps over the shoulders,
    its free arms swinging as it walks, and headphones over dark brown hair."""
    g.rect(9, 21 + b, 14, 13, "red")
    g.rect(20, 21 + b, 3, 13, "dred")
    g.rect(15, 21 + b, 2, 13, "dred")
    g.rect(9, 32 + b, 14, 2, "dred")
    left, right = road.swung(arms, -1), road.swung(arms, 1)
    g.rect(5, 22 + b, 4, 9 - left, "red")
    g.rect(5, 31 + b - left, 4, 3, "skin1")
    g.rect(23, 22 + b, 4, 9 - right, "red")
    g.rect(26, 22 + b, 1, 9 - right, "dred")
    g.rect(23, 31 + b - right, 4, 3, "skin1")
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


def student_back(g, b, arms=0):
    """The student walking away: the green backpack over the red jacket, its pocket and zip, the ponytail
    over the backpack's top, tied in red, the headphones' band over it and a cup over each ear; its arms swing
    as it walks."""
    g.rect(9, 21 + b, 14, 13, "red")
    g.rect(20, 21 + b, 3, 13, "dred")
    g.rect(9, 32 + b, 14, 2, "dred")
    left, right = road.swung(arms, -1), road.swung(arms, 1)
    g.rect(5, 22 + b, 4, 9 - left, "red")
    g.rect(5, 31 + b - left, 4, 3, "skin1")
    g.rect(23, 22 + b, 4, 9 - right, "red")
    g.rect(26, 22 + b, 1, 9 - right, "dred")
    g.rect(23, 31 + b - right, 4, 3, "skin2")
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
    frame's. The extras in q: upper, the greenhouse's paint; pillars and doors, their columns; bands, (x0, x1,
    y0, y1, colour) blocks over the body; rack and pod, a roof rack's or a roof pod's columns; sign, the
    columns of an amber-lit destination sign along the greenhouse's top; lamp, the lamps' top row."""

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
        if "pod" in q:
            x0, x1 = q["pod"]
            rect(x0, ROOF - 2, x1 - x0 + 1, 2, "lgrey")
            rect(x0, ROOF - 2, x1 - x0 + 1, 1, "white")
        if "sign" in q:
            x0, x1 = q["sign"]
            rect(x0, ROOF + 1, x1 - x0 + 1, 2, "ink")
            for x in range(x0 + 1, x1, 2):
                rect(x, ROOF + 1.5, 1, 1, "amber")
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
        lamp = q.get("lamp", belt + 1)
        rect(L - 3, lamp, 2, 2, "yellow")
        rect(L - 3, lamp, 1, 1, "white")
        rect(1, lamp, 2, 3, "red")
        rect(0, end - 3, 3, 3, "lgrey")
        rect(L - 3, end - 3, 3, 3, "lgrey")
        rect(0, end - 1, 3, 1, "grey")
        rect(L - 3, end - 1, 3, 1, "grey")
        # wheel arches, dark inside the body, cut off below it, then the tyres in front of them
        for cx in self.wheels:
            rect(cx - TYRE - 1.5, self.cy - TYRE - 1.5 - dip, (TYRE + 1.5) * 2, 1, None)
            g.ell(cx + 2, self.cy + dip, TYRE + 1.5, TYRE + 1.5, "navy")
        g.rect(0, end + 1 + dip, self.w, self.h, None)
        road.lit(g, dict(navy=("slate", None)))
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
    "ambient-bus": Car(80, 15, (2, 76), 0, 0.2, (14, 58), ("ttc", "dred", "red"), body=13, upper="white",
                       pillars=(12, 23, 34, 45, 54, 64), lamp=23, sign=(66, 78), pod=(8, 24),
                       bands=((3, 63, 4, 5, "white"), (1, 77, 15, 15, "white"), (1, 77, 22, 22, "white"),
                              (34, 41, 15, 24, "cyan"), (37, 38, 15, 24, "white"), (66, 73, 15, 24, "cyan"),
                              (69, 70, 15, 24, "white"), (75, 77, 15, 20, "cyan"))),
}


def cars(suffix, step):
    """Yield (key, tags) for every car at a depth step."""
    s = road.SCALE * step
    for key, car in CARS.items():
        yield f"{key}{suffix}", [("drive", [car.draw(s, r) for r in range(4)], DRIVE_MS)]


# ---------- the cyclist: side on, laid out on 44x48 and drawn at road.SCALE ----------

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
    bike, side on, riding right. The cranks turn a quarter a frame with the feet on the pedals, the spokes a
    sixteenth (a cross of them, so the loop is seamless), and the rider's back and head sit 1px lower on frames
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
    out = road.lit(g.g, dict(navy=("grey", "slate"), purple=("mauve", None))).outlined()
    # the spokes: a cross through each hub, a sixteenth of a turn on per frame
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
# Each stands on row 30 (the sitting cat on 31); frame 0 of its idle is the rest pose the game measures its feet from.

def ginger_cat(pose):
    """A ginger tabby side on. pose is (body dy, arch lift, near and far front feet, near and far back feet,
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
        # the arch lifts the whole body as the legs gather under it, so it keeps its bulk instead of swelling
        g.cel(15, 20 + dy - arch, 9, 4.5, "orange", "rust", "amber")
        for x in (11, 14, 17):
            g.rect(x, 16 + dy - arch, 1, 3, "rust")
        g.rect(12, 23 + dy - arch, 8, 1.5, "cream")
        for (x0, y0), foot in (((22, 22), nf), ((9, 22), nb)):
            bar(g, (x0, y0 + dy), foot, 3, "orange")
            g.rect(foot[0] - 1, foot[1] - 1, 3, 2, "cream")
        g.cel(25, 16 + dy, 4.5, 4, "orange", "rust", "amber")
        g.tri((21.5, 14 + dy), (24.5, 13 + dy), (22.5, 8.5 + dy), "orange")
        g.tri((24.5, 13 + dy), (27.5, 13.5 + dy), (26.5, 9 + dy), "orange")
        g.rect(26, 17 + dy, 4, 2.5, "cream")
        # the same eye as when it sits: green, its pupil towards the front
        g.rect(26, 15 + dy, 2, 2, "green")
        g.rect(27, 15 + dy, 1, 2, "ink")
        g.rect(29.5, 17 + dy, 1, 1, "pink")
    return draw


# The cat's gallop: stretched out, landing on its front feet, gathered with its body lifted over its feet,
# pushing off. arch lifts the body by that many units.
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
    return road.lit(g).outlined()


def animals(suffix, step):
    """Yield (key, tags) for the lawn animals at a depth step; idle first, so frame 0 is the rest pose."""
    s = ANIMAL_SCALE * step
    yield f"ambient-cat{suffix}", [("idle", [animal(s, ginger_cat(p)) for p in CAT_IDLE], IDLE_MS),
                                   ("run", [animal(s, ginger_cat(p)) for p in CAT_RUN], RUN_MS)]
    yield f"ambient-rabbit{suffix}", [("idle", [animal(s, cottontail(p)) for p in RABBIT_IDLE], IDLE_MS),
                                      ("hop", [animal(s, cottontail(p)) for p in RABBIT_HOP], HOP_MS)]
    yield f"ambient-bird{suffix}", [("idle", [animal(s, d) for d in BIRD_IDLE], IDLE_MS),
                                    ("fly", [animal(s, d) for d in BIRD_FLY], FLY_MS)]


# ---------- the sky movers: full size only, facing right ----------

def sky_grid(w, h):
    """A sky mover's grid, with one ink line round every fill."""
    return edged(Grid(w, h), "ink")


def over(frame, c, *points):
    """frame with c on each (x, y) of points, drawn past the outline: a line one pixel thin, such as a
    rope, a skid or a rotor blur, that an ink line round it would thicken."""
    for x, y in points:
        frame[y][x] = K.get(c, c)
    return frame


def plane(light):
    """The jet side on, facing right: a white fuselage over a grey belly with one row of windows, a rounded
    nose and cockpit glass, a swept red fin, the swept wing below with its engine, and the wingtip light and
    the belly beacon red (light) or flashing white."""
    g = sky_grid(26, 10)
    g.rect(2, 1, 2, 1, "red")
    g.rect(2, 2, 3, 1, "red")
    g.rect(3, 3, 3, 1, "red")
    g.rect(2, 4, 20, 1, "white")
    g.rect(3, 5, 20, 1, "white")
    g.rect(5, 6, 17, 1, "lgrey")
    g.p(22, 4, "lgrey")
    g.p(23, 5, "lgrey")
    g.rect(21, 4, 2, 1, "navy")
    for x in range(7, 20, 2):
        g.p(x, 5, "dslate")
    g.rect(9, 7, 5, 1, "slate")
    g.rect(7, 8, 4, 1, "slate")
    g.rect(14, 7, 3, 1, "grey")
    g.p(7, 8, light)
    g.p(16, 6, "hot" if light == "red" else "white")
    return g.outlined()


BALLOON_GORES = ("red", "amber")


def balloon(bob, flame):
    """The hot air balloon: a teardrop envelope of seven curved gores, red and amber, shaded down its right
    side and glinting at its upper left, two ink ropes to a wicker basket, and the burner flaring (flame)
    or low, bobbed bob rows down."""
    g = sky_grid(18, 26)
    cx, cy, r = 9.0, 8.5, 7.5
    for y in range(1, 18):
        for x in range(18):
            px, py = x + 0.5, y + 0.5
            # A circle down to two rows below its centre, then a straight taper to the skirt.
            if py <= cy + 2:
                half = math.sqrt(max(0.0, r * r - (py - cy) ** 2))
            else:
                half = math.sqrt(r * r - 4) * (18.5 - py) / (16.5 - cy)
            if half <= 0 or abs(px - cx) > half:
                continue
            u = (px - cx) / half
            gore = min(6, int((math.asin(max(-1.0, min(1.0, u))) / math.pi + 0.5) * 7))
            c = K[BALLOON_GORES[gore % 2]]
            g.p(x, y + bob, DARKER[c] if gore == 6 else c)
    g.rect(5, 3 + bob, 1, 2, "yellow")
    g.rect(7, 21 + bob, 4, 2, "brown")
    g.rect(7, 22 + bob, 4, 1, "dbrown")
    out = g.outlined()
    over(out, "ink", (7, 19 + bob), (10, 19 + bob))
    return over(out, "yellow", (8, 19 + bob), (9, 19 + bob)) if flame else over(out, "orange", (9, 19 + bob))


def pigeon(g, cx, cy, wing):
    """One pigeon seen as a chevron centred on (cx, cy): a slate body over a grey tail, its pale wings
    raised in a V (up), spread in a shallow one (level) or swept down."""
    rows = dict(up=(-2, -1, 0), level=(-1, 0, 0), down=(1, 1, 0))[wing]
    for i, dy in enumerate(rows):
        g.p(cx - 3 + i, cy + dy, "lgrey")
        g.p(cx + 3 - i, cy + dy, "lgrey")
    g.p(cx, cy, "slate")
    g.p(cx, cy + 1, "grey")


PIGEON_FLOCK = ((5, 9, 1), (13, 4, 3), (17, 11, 2), (24, 6, 0), (30, 10, 2))
WINGBEAT = ("up", "level", "down", "level")


def pigeons(i):
    """Frame i of the pigeon flock: five grey chevrons in a loose straggle, each a different step through
    its wingbeat (up, level, down, level), so the flock shimmers."""
    g = sky_grid(36, 15)
    for cx, cy, phase in PIGEON_FLOCK:
        pigeon(g, cx, cy, WINGBEAT[(i + phase) % 4])
    return g.outlined()


def helicopter(rotor, light):
    """The helicopter side on, facing right: a red cabin with a glass bubble at the nose, a tapered tail
    boom to a fin, the main rotor a long blur (rotor 0) or a broken one (rotor 1) and the tail rotor a
    short blur, one pixel thin past the outline, skids under it, and the fin's beacon red when light."""
    g = sky_grid(26, 12)
    g.cel(15.5, 5.5, 6, 3, "red", "dred", "pink")
    g.rect(3, 4, 8, 1, "red")
    g.rect(5, 5, 6, 1, "dred")
    g.rect(2, 2, 2, 3, "red")
    g.p(2, 2, "hot" if light else "dred")
    g.tri((16, 3), (21.5, 6), (16, 6), "foam")
    g.p(17, 4, "white")
    out = g.outlined()
    over(out, "ink", (13, 1), (12, 10), (18, 10), *((x, 11) for x in range(10, 22)), (22, 10))
    if rotor == 0:
        over(out, "lgrey", *((x, 0) for x in range(4, 23)))
        over(out, "white", *((x, 0) for x in range(10, 17)))
        over(out, "lgrey", *((0, y) for y in range(2, 6)))
    else:
        over(out, "lgrey", *((x, 0) for x in (*range(6, 11), *range(15, 20))))
        over(out, "white", *((x, 0) for x in range(11, 15)))
        over(out, "white", (0, 3), (0, 4))
    return out


def goose(g, ox, oy, wing):
    """One Canada goose side on with its body's back row at (ox + 1, oy), facing right: a dark brown body and
    darker wing, a black tail, its neck a straight black line out to a black head with a white chinstrap, and
    its wing up, level or down."""
    g.p(ox, oy, "ink")
    g.rect(ox + 1, oy, 5, 1, "dbrown")
    g.rect(ox + 2, oy + 1, 4, 1, "dbrown")
    g.rect(ox + 6, oy, 4, 1, "ink")
    g.p(ox + 8, oy + 1, "white")
    if wing == "up":
        g.p(ox + 3, oy - 1, "plum")
        g.p(ox + 2, oy - 2, "plum")
    elif wing == "down":
        g.p(ox + 3, oy + 2, "plum")
        g.p(ox + 2, oy + 3, "plum")
    else:
        g.rect(ox + 2, oy - 1, 3, 1, "plum")


GEESE_V = ((25, 8, 0), (14, 5, 1), (3, 2, 2), (14, 11, 1), (3, 14, 2))


def geese(i):
    """Frame i of the geese: five in a V, the leader at the point on the right and two down each arm,
    each a step behind the one ahead in its wingbeat. They are drawn dark with no outline, as birds far
    off read against the dusk."""
    g = Grid(36, 18)
    for ox, oy, phase in GEESE_V:
        goose(g, ox, oy, WINGBEAT[(i + phase) % 4])
    return g.outlined(False)


def turboprop(blade, light):
    """The turboprop side on, facing right, on approach with its gear down: a white fuselage with a navy
    belly and one row of windows, a navy T-tail, the high wing along the roof with its engine hung forward,
    the propeller a tall slate disc with a blade bright at the top (blade 0) or the bottom (blade 1), and
    the belly beacon red when light."""
    g = sky_grid(32, 12)
    g.rect(1, 1, 8, 1, "navy")
    g.rect(4, 2, 2, 3, "navy")
    g.p(6, 4, "navy")
    g.rect(3, 5, 25, 1, "white")
    g.rect(4, 6, 25, 1, "white")
    g.rect(6, 7, 23, 1, "navy")
    g.rect(26, 5, 2, 1, "navy")
    for x in range(8, 25, 2):
        g.p(x, 6, "dslate")
    g.rect(12, 4, 9, 1, "grey")
    g.rect(18, 3, 6, 1, "white")
    g.rect(18, 4, 6, 1, "lgrey")
    g.rect(24, 1, 1, 8, "slate")
    g.rect(24, 1 + 5 * blade, 1, 3, "lgrey")
    g.p(12, 7, "hot" if light else "navy")
    for x in (20, 27):
        g.p(x, 8, "dslate")
        g.p(x, 9, "navy")
    return g.outlined()


def banner_plane(f):
    """Frame f of the banner plane, side on, facing right: a small white high-wing plane with a red fin and
    wing, cyan cockpit glass and fixed gear, its propeller a slate disc with a blade bright at the top, then
    the bottom, towing a white banner of red lettering on a rope one pixel thin. The banner's tail ripples a
    pixel up and down, the wave travelling back along it."""
    g = sky_grid(39, 10)
    for x in range(1, 17):
        k = 16 - x
        dy = round(math.sin(k * 0.5 - f * math.pi / 2) * 0.6) if k > 7 else 0
        g.rect(x, 2 + dy, 1, 6, "white")
        if 3 <= x <= 14 and x not in (7, 11):
            g.rect(x, 4 + dy, 1, 2, "red")
    g.rect(25, 1, 2, 3, "red")
    g.rect(25, 4, 11, 2, "white")
    g.rect(27, 6, 8, 1, "lgrey")
    g.rect(29, 3, 7, 1, "red")
    g.rect(32, 4, 2, 1, "cyan")
    g.p(36, 5, "grey")
    g.rect(37, 2, 1, 6, "slate")
    g.rect(37, 2 + 3 * (f % 2), 1, 3, "lgrey")
    out = g.outlined()
    over(out, "ink", *((x, 5) for x in range(18, 24)))
    return over(out, "ink", (30, 8), (33, 8))


# A gull seen head on, its wings bent at the wrist: raised in a V (up), in an M (level) or swept down.
GULL = dict(
    up=("w.........w", ".w.......w.", "..ww...ww..", "....www....", ".....w....."),
    level=("", ".ww.....ww.", "w..ww.ww..w", "....www....", ".....w....."),
    down=("", "", "..wwwwwww..", ".w..www..w.", "w....w....w"),
)
GULL_FLOCK = ((6, 8, 0), (18, 4, 2), (29, 9, 1))


def gulls(i):
    """Frame i of the gulls: three white gulls, larger than the pigeons and bent at the wrist, a grey tail
    and an amber beak each, each a different step through its wingbeat."""
    g = sky_grid(36, 12)
    for cx, cy, phase in GULL_FLOCK:
        bitmap(g, cx - 5, cy - 3, GULL[WINGBEAT[(i + phase) % 4]], dict(w="white"))
        g.p(cx, cy + 1, "lgrey")
        g.p(cx + 1, cy, "amber")
    return g.outlined()


# A red-tailed hawk soaring, seen from below: brown head, dark leading edges and fingertips, cream wing
# linings, a dark belly band and the fanned rust tail.
HAWK = (
    "..........bb..........",
    "..dddddddcbbcddddddd..",
    "kkcccccccccccccccccckk",
    ".k..ccccccddcccccc..k.",
    ".........cddc.........",
    "..........rr..........",
    ".........rrrr.........",
    "........rrrrrr........",
)
HAWK_COLOURS = dict(b="brown", d="dbrown", c="cream", k="plum", r="rust")


def hawk(tilt):
    """The hawk banking: tilt lifts its left wing (1) or its right (-1) a pixel at the tip, or holds it
    level (0)."""
    g = sky_grid(24, 10)
    for y, row in enumerate(HAWK):
        for x, ch in enumerate(row):
            if ch in HAWK_COLOURS:
                dy = round(tilt * (x - 10.5) / 11) if y < 5 else 0
                g.p(x + 1, y + 1 + dy, HAWK_COLOURS[ch])
    return g.outlined()


# Party balloons as (centre x, centre y, colour, phase): each rises and falls a pixel out of step.
PARTY_BALLOONS = ((4, 6.5, "red", 0), (8.5, 4.5, "sky", 2), (13, 6.5, "yellow", 1))


def party_balloons(f):
    """Frame f of the party balloons: red, sky and yellow, each glinting at its upper left and bobbing a
    pixel out of step with the others, on ink strings that gather to one knot, its loose end swinging."""
    g = sky_grid(17, 27)
    knots = []
    for x, y, c, phase in PARTY_BALLOONS:
        dy = (0, 0, 1, 1)[(f + phase) % 4]
        g.ell(x, y + dy, 2.8, 3.5, c)
        g.p(x - 1.5, y - 1.5 + dy, "white")
        knots.append((int(x), int(y + dy + 4.5)))
    out = g.outlined()
    tx, ty = 8, 23
    for kx, ky in knots:
        n = max(abs(tx - kx), abs(ty - ky))
        for t in range(n + 1):
            x, y = round(kx + (tx - kx) * t / n), round(ky + (ty - ky) * t / n)
            if out[y][x] is None:
                out[y][x] = K["ink"]
    return over(out, "ink", (8, 24), (8 + f % 2, 25), (8, 26))


def blimp(f):
    """Frame f of the blimp, side on, facing right: a white envelope shaded lgrey down its lower right, red
    fins above and below its tail and a red one between them, a navy sign along its side whose amber lights
    chase toward the nose, and a gondola with cyan windows under it."""
    g = sky_grid(31, 12)
    g.tri((0, 1), (5, 1), (8, 5), "red")
    g.tri((0, 10), (5, 10), (8, 6), "red")
    g.ell(16, 5.5, 14, 4.5, "white", "lgrey")
    g.tri((0, 5), (6, 5), (6, 6), "red")
    g.rect(8, 4, 15, 3, "navy")
    for x in range(9, 22):
        if (x - f) % 3 == 0:
            g.p(x, 5, "amber")
    g.rect(13, 10, 6, 1, "lgrey")
    g.rect(14, 10, 4, 1, "cyan")
    return g.outlined()


def airliner(f):
    """Frame f of the airliner far overhead, side on, facing right: a white fuselage with a blue fin, a slate
    wing and engine, and a white contrail one pixel thin behind it whose far end breaks into dashes that
    drift back."""
    g = sky_grid(36, 7)
    g.rect(25, 1, 2, 3, "blue")
    g.rect(25, 3, 10, 2, "white")
    g.p(35, 4, "white")
    g.rect(29, 5, 3, 1, "slate")
    g.p(32, 3, "dslate")
    out = g.outlined()
    return over(out, "white", *((x, 4) for x in range(23) if x >= 8 or (x + f) % 3))


# A bat seen head on, an ink silhouette: ears and body between its wings, raised, spread with a scalloped
# trailing edge, or down.
BAT = dict(
    up=("b.......b", "bb.b.b.bb", ".bbbbbbb.", "..bbbbb..", "....b...."),
    level=("", "", "...b.b...", "bb.bbb.bb", ".bbbbbbb.", ".b..b..b."),
    down=("", "", "...b.b...", "..bbbbb..", ".b.bbb.b.", "b...b...b"),
)
BAT_FLOCK = ((4, 7, 0), (15, 4, 1), (24, 8, 3))


def bats(i):
    """Frame i of the bats: three at dusk, each a step out of time with the next, fluttering a pixel up and
    down as it beats. Like the geese they are dark with no outline, in ink so they hold on every sky."""
    g = Grid(29, 11)
    for cx, cy, phase in BAT_FLOCK:
        k = (i + phase) % 4
        bitmap(g, cx - 4, cy - 4 + (0, -1, 0, 1)[k], BAT[WINGBEAT[k]], dict(b="ink"))
    return g.outlined(False)


def kite(f):
    """Frame f of the kite: a diamond quartered red and white, a red and white ribbon tail swaying down from
    it, the wave travelling down the tail, and its string one pixel thin down to the lower left."""
    g = sky_grid(17, 28)
    top, right, bottom, left, mid = (10, 1), (15, 6), (10, 13), (5, 6), (10, 6)
    g.tri(top, mid, left, "red")
    g.tri(top, right, mid, "white")
    g.tri(left, mid, bottom, "white")
    g.tri(mid, right, bottom, "red")
    for k in range(12):
        x = 10 + round(math.sin(k * 0.55 - f * math.pi / 2) * min(1.5, k / 3))
        g.p(x, 14 + k, "red" if k // 3 % 2 == 0 else "white")
    out = g.outlined()
    return over(out, "ink", *((6 - math.floor((y - 9) * 0.35), y) for y in range(9, 28)))


def sky_movers():
    """Yield (key, tags) for the sky movers, each at full size only."""
    yield "ambient-plane", [("fly", [plane("red"), plane("white")], PLANE_MS)]
    yield "ambient-balloon", [("fly", [balloon(b, f) for b, f in ((0, 1), (0, 0), (1, 1), (1, 0))], BALLOON_MS)]
    yield "ambient-pigeons", [("fly", [pigeons(i) for i in range(4)], PIGEON_MS)]
    yield "ambient-helicopter", [("fly", [helicopter(r, l) for r, l in ((0, 1), (1, 1), (0, 0), (1, 0))],
                                  HELICOPTER_MS)]
    yield "ambient-geese", [("fly", [geese(i) for i in range(4)], GEESE_MS)]
    yield "ambient-turboprop", [("fly", [turboprop(b, l) for b, l in ((0, 1), (1, 1), (0, 0), (1, 0))],
                                 TURBOPROP_MS)]
    yield "ambient-banner-plane", [("fly", [banner_plane(f) for f in range(4)], BANNER_PLANE_MS)]
    yield "ambient-gulls", [("fly", [gulls(i) for i in range(4)], GULLS_MS)]
    yield "ambient-hawk", [("fly", [hawk(t) for t in (0, 1, 0, -1)], HAWK_MS)]
    yield "ambient-party-balloons", [("fly", [party_balloons(f) for f in range(4)], PARTY_BALLOONS_MS)]
    yield "ambient-blimp", [("fly", [blimp(f) for f in range(4)], BLIMP_MS)]
    yield "ambient-airliner", [("fly", [airliner(f) for f in range(4)], AIRLINER_MS)]
    yield "ambient-bats", [("fly", [bats(i) for i in range(4)], BATS_MS)]
    yield "ambient-kite", [("fly", [kite(f) for f in range(4)], KITE_MS)]


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every ambient sprite at full size, then at every
    depth step."""
    for suffix, step in (("", 1),) + tuple((f"@{x}", q) for x, q in STEPS):
        yield from pedestrians(suffix, step)
        yield from cars(suffix, step)
        yield from bikes(suffix, step)
        yield from animals(suffix, step)
    yield from sky_movers()


if __name__ == "__main__":
    main(sys.argv, sprites, "art/ambient", __doc__)
