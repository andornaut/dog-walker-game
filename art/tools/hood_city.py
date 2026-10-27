#!/usr/bin/env python3
"""Draw The Beaches' and Yonge Street's own road objects, their card obstacles' cards, hits and sounds.

The Beaches:
dropped-cone        48x72   card obstacle (Dropped ice cream): a kid in a peach sundress with brown
                            pigtails looking down, sad, at her ice cream cone tipped on its side on the
                            ground beside her, its strawberry scoop squashed into a pink puddle. She stands
                            still. idle (2 frames, 400ms): a breath, a tear on her cheek on frame 1
sandcastle          48x48   minor, 1 lane: a sandcastle of three bucket towers over a crenellated wall
                            and an arched door on a mound of sand, a red pennant on the middle tower,
                            shells pressed into the wall. idle (4 frames, 400ms): the pennant flutters
                            on frame 2
lifeguard-chair     48x72   minor, 1 lane: a tall wooden lifeguard chair, its legs splayed and laddered,
                            a red seat back with a white cross, a yellow and white umbrella over it and
                            an orange life ring hung on its leg; no box, roof or flag, unlike the Leuty
                            station. idle (4 frames, 450ms): the umbrella's valance lifts on frame 2
rollerblader        48x72   minor rider, 1 lane, coming down its lane at the pack, facing the player: a
                            skater in a lime tank top, blue shorts, white knee pads, sunglasses and gold
                            hair, on white inline skates with yellow wheels. ride (4 frames, 100ms): a
                            skating stride, each foot pushing out to its side in turn, lifted 1px, the
                            body swaying 1px toward the gliding foot, the wheels' tread rolling 1px a frame

Yonge Street:
promo-team          48x72   card obstacle (Big screen promo): a street team promoter in a turquoise
                            branded tee with a yellow star, an amber cap and white sneakers, a TV camera
                            on her right shoulder (screen left) with a red tally light, a mic with a hot
                            pink flag held out in her other hand. walk (4 frames, 100ms):
                            road.PERSON_WALK; idle (2 frames, 400ms): a breath, the tally light dimmed
                            on frame 1
ttc-bus             56x66   minor, 1 lane by 3 rows of footprint, slower than the road: a TTC bus from
                            straight behind, laid out on 56x55 and drawn at obstacles.CAR_SCALE as the
                            streetcar is: a roof pod over a white upper body, a wide dark rear window
                            under an amber route sign "97", a ttc red lower body with two white stripes,
                            "TTC" in white, the engine grille, tail lights and blinkers at the outer
                            corners, the bumper and both rear tyres. idle (2 frames, 400ms): the left
                            blinker flashes, pulling out from a stop; drive (4 frames, 100ms): tread
                            lines climb the tyres and the body dips 1px onto them on frames 1 and 2
sandwich-board      48x48   minor, 1 lane: a café's A-frame sign, a forest chalkboard in a brown
                            wooden frame with a chalk coffee cup and two lines of chalk writing, on
                            splayed legs. idle (4 frames, 450ms): the chalk steam over the cup wavers
                            on frame 2
pedicab             48x72   minor rider, 1 lane, coming down its lane at the pack, facing the player: a
                            bike taxi, its cobalt canopy edged in a white scalloped valance with yellow
                            string lights over a gold cab on two wheels behind the rider, who wears a
                            purple tee and a white headband. ride (4 frames, 120ms): the pedals going
                            round, the front tyre's tread falling 1px a frame

Every key above also has <key>@<step> for each depth step in minis.STEPS, floor(size x scale + 0.5),
with the original's tags, frames and durations, drawn on a minis.Mini with its own outline. The people
and the riders are laid out on 32x48 and drawn at road.SCALE (1.5) as road.py's are, the minor
obstacles in layout pixels at obstacles.SCALE (1.2) as obstacles.py's, the bus at obstacles.CAR_SCALE
(56 columns, rows 1.2x) as the streetcar. All take the road outline (pixel.road_edge) and road.LIT's
rim on their dark colours.

Hits (77x77, play: 8 frames, 70ms, laid out on 64x64 as hits.py's), each opening on hits.impact:
fx-hit-dropped-cone the impact star in pink, then the strawberry scoop shoots up off a pink splat,
                    drops and sprinkles flying out, the empty cone tumbling away
fx-hit-promo-team   the impact star in amber, then camera flashes popping round a white flash that
                    shrinks away, confetti in cyan, pink and yellow falling

Cards (75x56 images, composed from the sprites above as cards.py composes its own):
card-dropped-cone-lick        a pack dog licking the pink puddle round the dropped cone, the kid by it
card-dropped-cone-buy         the kid holding a new cone up under hearts, a callout of -$
card-dropped-cone-pull-away   a pack dog pulled away from the dropped cone on its leash
card-promo-team-wave          a pack dog under a spotlight beam, the promoter filming, flashes round it
card-promo-team-merch         the promoter's turquoise star tee held up as merch, a callout of -$
card-promo-team-push-through  a pack dog pulling past the promoter, speed lines behind it

Sounds (sounds.py's format, under 0.6s):
sfx-hit-dropped-cone  0.54s  splat: a pink noise plop over a low falling triangle, then a sad
                             triangle "aww" sliding down a fifth
sfx-hit-promo-team    0.54s  camera: two shutter clicks of filtered noise, a rising flash whine and
                             a bright square "ta-da" up a fourth

Usage:
  hood_city.py preview OUT.png   every frame of every sprite on the zone roads
  hood_city.py cards OUT.png     every card illustration in its card frame, scaled up
  hood_city.py sounds OUT_DIR    write the two sounds into OUT_DIR only
  hood_city.py build             write art/hood-city/*.aseprite, export the sprites to
                                 public/art/sprites/, the cards to public/art/images/ and the
                                 sounds to public/art/sounds/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(__file__))
import depths  # noqa: E402
import hits  # noqa: E402
import obstacles  # noqa: E402
import road  # noqa: E402
import sounds  # noqa: E402
from minis import STEPS, small, snap  # noqa: E402
from obstacles import treads, unit  # noqa: E402
from pixel import Grid, build as build_sprites, depth_settled, edged, preview, raster, scale_of, to_image  # noqa: E402
from road import BREATH, BREATH_MS, LIT, PERSON_WALK, PERSON_WALK_MS, face_disc, lit, rim  # noqa: E402

SRC = "art/hood-city"
# The people and riders are laid out on 32x48 and drawn at road.SCALE; the minor obstacles in layout pixels
# at obstacles.SCALE; the bus at obstacles.CAR_SCALE.
P, O, CAR = road.SCALE, obstacles.SCALE, obstacles.CAR_SCALE


def this():
    return sys.modules[__name__]


def px_at(g, x, y):
    """The drawn pixel of design point (x, y) on g."""
    s, sy = scale_of(g), getattr(g, "sy", scale_of(g))
    return math.floor(x * s + 0.5), math.floor(y * sy + 0.5)


def stamp(g, rows, cx, cy, cols):
    """A character map centred on design point (cx, cy), pixel for pixel on the drawn grid, so it keeps
    its pixels at any scale."""
    x0, y0 = px_at(g, cx, cy)
    x0 -= len(rows[0]) // 2
    y0 -= len(rows) // 2
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in cols:
                raster(g).p(x0 + i, y0 + j, cols[ch])


# ---------- dropped-cone: the kid and her dropped cone ----------

def waffle(g, x0, x1, y0, apex):
    """A waffle cone held point down: a triangle from its rim (x0 to x1 on row y0) to its point on row apex,
    tan lit on the left and ochre on the right, hatched in brown."""
    mid = (x0 + x1) / 2
    g.tri((x0, y0), (x1, y0), (mid, apex), "tan")
    g.tri((mid, y0), (x1, y0), (mid, apex), "ochre")
    n = 3
    for k in range(1, n):
        t = k / n
        y = y0 + (apex - y0) * t
        hw = (x1 - x0) / 2 * (1 - t)
        g.rect(mid - hw + 0.5, y, max(1, 2 * hw - 1), 1, "brown")


def kid_top(tear=False):
    """The kid with the dropped cone, for kid(): a peach sundress, brown pigtails tied with red bobbles,
    looking down at the cone, her brows up and her mouth turned down; tear puts a cyan tear on her
    cheek."""
    def top(g, b, arms=0):
        # the arms hang by her sides, the hands open, the free one swinging with the walk
        for x, side in ((7, -1), (19, 1)):
            n = road.swung(arms, side)
            g.rect(x, 25 + b, 3, 7 - n, "skin1")
            g.rect(x + 2, 25 + b, 1, 7 - n, "skin2")
        # the sundress: straps over the shoulders, a bodice and a flared skirt with a white hem
        g.rect(10, 24 + b, 9, 6, "peach")
        g.tri((10, 29.5 + b), (18.5, 29.5 + b), (6, 36 + b), "peach")
        g.tri((10, 29.5 + b), (18.5, 29.5 + b), (23, 36 + b), "peach")
        g.rect(8, 29.5 + b, 13, 6.5, "peach")
        g.tri((16, 29.5 + b), (18.5, 29.5 + b), (23, 36 + b), "orange")
        g.rect(17, 24 + b, 2, 6, "orange")
        g.rect(6, 35 + b, 17, 1, "white")
        g.rect(12, 23 + b, 1, 1, "peach")
        g.rect(16, 23 + b, 1, 1, "peach")
        # the head: the face, a brown fringe and crown, the pigtails tied at the sides
        g.rect(12.5, 21.5 + b, 4, 2.5, "skin1")
        face_disc(g, 14.5, 16.5 + b, 6.5, 6, "skin1", "skin2")
        g.cel(14.5, 12.5 + b, 7, 4, "brown", "dbrown", "clay")
        g.rect(8, 12.5 + b, 13, 2, "brown")
        g.rect(19, 12.5 + b, 2, 2, "dbrown")
        for cx, sh in ((5.5, "brown"), (23.5, "dbrown")):
            g.cel(cx, 17.5 + b, 2, 3, "brown", sh)
            g.rect(cx - 1 + (1 if cx > 14 else 0), 13.5 + b, 1, 1, "red")
        # eyes looking down at the cone, brows raised in the middle, the mouth turned down
        for x in (11, 17):
            g.rect(x, 17.5 + b, 2, 1.5, "ink")
        g.rect(10, 16 + b, 2, 1, "dbrown")
        g.p(12, 15 + b, "dbrown")
        g.rect(18, 16 + b, 2, 1, "dbrown")
        g.p(17, 15 + b, "dbrown")
        g.rect(13.5, 20 + b, 2, 1, "dbrown")
        g.p(12.5, 21 + b, "dbrown")
        g.p(15.5, 21 + b, "dbrown")
        g.p(9.5, 19 + b, "pink")
        g.p(19.5, 19 + b, "pink")
        if tear:
            g.rect(10, 19.5 + b, 1, 2, "cyan")
    return top


def kid(top, lf=0, rf=0, bob=0, arms=0):
    """A kid facing the player, drawn shorter than road.person's adults: legs, sandals and the caller's
    top(g, bob, arms) over them, then the dropped cone upside down beside her right foot in its pink
    puddle. The road outline and the lit rim."""
    g = edged(Grid(32, 48))
    for x, f in ((10, lf), (15, rf)):
        g.rect(x, 35 + bob, 3, 8 + f - bob, "skin1")
        g.rect(x + 2, 35 + bob, 1, 8 + f - bob, "skin2")
        g.rect(x - 0.5, 43 + f, 4, 2, "red")
        g.rect(x - 0.5, 44 + f, 4, 1, "dred")
    top(g, bob, arms)
    # the dropped cone, tipped on its side on the ground right of her: the pink puddle, the squashed
    # scoop at its open end and the waffle cone pointing off to the right
    g.cel(25, 44, 6, 1.2, "pink", "mauve")
    g.tri((24, 39.5), (24, 44.5), (31.5, 42.5), "tan")
    g.tri((24, 42.5), (24, 44.5), (31.5, 42.5), "ochre")
    for x, y in ((26, 41), (28, 42), (26, 43), (29, 43)):
        g.p(x, y, "brown")
    g.cel(22.5, 42, 3, 2.6, "pink", "mauve", "white")
    g.p(22, 40, "red")
    g.p(20, 44, "pink")
    return lit(g)


def dropped_cone(**q):
    """kid() with kid_top, the tear on its own key."""
    tear = q.pop("tear", False)
    return kid(kid_top(tear), **q)


# ---------- promo-team: the street team promoter ----------

STAR = ("..#..", ".###.", "#####", ".###.", ".#.#.")


def promo_top(tally=True):
    """The promoter, for road.person (legs="navy" and shoes="white": black jeans and white sneakers): a
    turquoise tee with a yellow star, an amber cap, a TV camera on her right shoulder (screen left) with its
    lens to the player and a red tally light (dred when tally is off), and a mic with a hot pink flag held
    out at shoulder height in her other hand."""
    def top(g, b, arms=0):
        # the mic arm (screen right): the sleeve and forearm up to the hand, the mic in it
        g.rect(23, 22 + b, 4, 3, "turquoise")
        g.rect(25, 22 + b, 3, 5, "skin2")
        g.rect(27, 22 + b, 1, 5, "brown")
        g.rect(25.5, 15 + b, 2, 7, "ink")
        g.rect(24.5, 17 + b, 4, 3, "hot")
        g.rect(24.5, 17 + b, 4, 1, "pink")
        g.cel(26.5, 14 + b, 2.3, 2.3, "dslate", "navy", "slate")
        # the tee, lit on the left and shaded on the right, the star logo on its front
        g.rect(9, 21 + b, 14, 13, "turquoise")
        g.rect(20, 21 + b, 3, 13, "dturq")
        g.rect(9, 21 + b, 1, 12, "foam")
        if scale_of(g) >= 0.9:
            stamp(g, STAR, 15.5, 27 + b, {"#": "yellow"})
        else:
            g.rect(14.5, 26 + b, 3, 2, "yellow")
        # the camera arm (screen left) up to the camera's grip
        g.rect(5, 22 + b, 4, 4, "turquoise")
        g.rect(5, 25 + b, 3, 3, "skin2")
        # head: the neck, the face, black hair under an amber cap with a brim
        g.rect(14, 19 + b, 4, 3, "skin2")
        face_disc(g, 16, 12.5 + b, 8, 8, "skin2", "brown")
        g.rect(8, 9 + b, 2, 6, "ink")
        g.rect(22, 9 + b, 2, 6, "ink")
        g.cel(16, 7 + b, 8.5, 4.5, "amber", "orange", "yellow")
        g.rect(7.5, 9 + b, 17, 2, "orange")
        g.rect(15, 5 + b, 2, 2, "white")
        road.face_front(g, 16, 13 + b, eyes="ink", lips="dbrown")
        # the camera on her shoulder: a dark body, a handle over it, the lens facing us and the tally light
        g.rect(1, 13 + b, 9, 9, "dslate")
        g.rect(1, 13 + b, 9, 1, "slate")
        g.rect(8, 14 + b, 2, 8, "navy")
        g.rect(3, 11 + b, 5, 2, "ink")
        g.cel(5, 17.5 + b, 3, 3, "ink", None, "slate")
        g.rect(4, 16.5 + b, 1, 1, "white")
        g.rect(7.5, 14.5 + b, 1.5, 1.5, "red" if tally else "dred")
    return top


# ---------- rollerblader ----------

# The skating stride: the foot pushing out to its side (None while both glide), the sway toward the gliding
# foot and the tread's roll. 4 frames at 100ms.
ROLLER_RIDE = [dict(push="left", sway=1, roll=0), dict(roll=1), dict(push="right", sway=-1, roll=2),
               dict(roll=3)]
ROLLER_RIDE_MS = 100


def rollerblader(push=None, sway=0, roll=0):
    """A skater coming down the road at the pack, facing the player: gold hair, sunglasses, a lime tank top,
    blue shorts, bare legs with white knee pads, white inline skates with a violet cuff and a yellow wheel
    edge-on under each, its tread rolling. push is the side ("left" or "right", screen left and right)
    whose leg pushes out, its foot 4 design pixels out and 1 up; the other glides under the body, and the
    body sways sway drawn pixels toward it, the hips and legs put."""
    g = edged(Grid(32, 48))
    px = raster(g)
    u = unit(g)[1]
    for x, side in ((10.5, "left"), (17.5, "right")):
        out = (-4 if side == "left" else 4) if push == side else 0
        lift = 1 if push == side else 0
        # the leg from the hip, slanting out to the pushed foot one row at a time
        for r in range(31, 39 - lift):
            dx = out * (r - 31) / (8 - lift)
            g.rect(x + dx, r, 4, 1, "skin1")
            g.rect(x + dx + 3, r, 1, 1, "skin2")
        kx = x + out * 4 / 8
        g.rect(kx, 34, 4, 2, "white")
        g.rect(kx + 3, 34, 1, 2, "lgrey")
        fx, fy = x + out, 39 - lift
        g.rect(fx, fy - 1, 4, 1, "violet")
        g.rect(fx, fy, 4, 3, "white")
        g.rect(fx + 3, fy, 1, 3, "lgrey")
        g.rect(fx + 1, fy + 3, 2, 1, "grey")
        g.rect(fx + 1, fy + 4, 2, 2, "yellow")
        treads(g, fx + 1, fy + 4, 2, 2, roll, u, back=True)
    # shorts over the hips
    g.rect(10, 29, 12, 4, "blue")
    g.rect(19, 29, 3, 4, "navy")
    g.rect(10, 29, 12, 1, "navy")
    body = [row[:] for row in px.px]
    px.px = [[None] * px.w for _ in range(px.h)]
    # the arms held out from the shoulders for balance, bare, each row overlapping the last so the arm stays
    # whole, the hands open
    for x, side in ((7, -1), (22, 1)):
        for k in range(7):
            g.rect(x + side * k * 0.5, 20 + k, 3, 2, "skin1")
        g.rect(x + side * 3.5, 26, 3, 3, "skin1")
    # the tank top, its straps over bare shoulders
    g.rect(10, 19, 12, 10, "lime")
    g.rect(19, 19, 3, 10, "green")
    g.rect(10, 19, 2, 2, "skin1")
    g.rect(20, 19, 2, 2, "skin2")
    g.rect(12, 19, 1, 1, "lime")
    # the head: gold hair blowing out at the sides, the face, sunglasses
    g.rect(14, 17, 4, 3, "skin1")
    g.cel(16, 9.5, 8.5, 6, "gold", "amber", "yellow")
    g.rect(7, 9, 3, 8, "gold")
    g.rect(22, 9, 3, 8, "amber")
    face_disc(g, 16, 12.5, 6.5, 6, "skin1", "skin2")
    g.rect(10, 8, 12, 2, "gold")
    g.rect(9.5, 11, 13, 2, "ink")
    g.rect(15, 11, 2, 1, "slate")
    g.p(10.5, 11, "white")
    g.p(17.5, 11, "white")
    g.rect(14.5, 15.5, 3, 1, "dbrown")
    g.p(13.5, 14.5, "dbrown")
    g.p(17.5, 14.5, "dbrown")
    top = [row[:] for row in px.px]
    # the body above the hips sways over the legs
    k = round(sway)
    out = [[None] * px.w for _ in range(px.h)]
    hip = math.floor(29 * getattr(g, "sy", scale_of(g)) + 0.5)
    for y in range(px.h):
        for x in range(px.w):
            sx = x - k if y < hip else x
            c = top[y][sx] if 0 <= sx < px.w else None
            out[y][x] = c or body[y][x]
    px.px = out
    return lit(g)


# ---------- pedicab ----------

# Pedalling: each foot's row (the pedals go round) and the tread's roll; 4 frames at 120ms.
PEDICAB_RIDE = [dict(lf=37, rf=42, roll=0), dict(lf=39, rf=40, roll=1), dict(lf=42, rf=37, roll=2),
                dict(lf=40, rf=39, roll=3)]
PEDICAB_RIDE_MS = 120


def pedicab(lf=37, rf=42, roll=0):
    """A bike taxi coming down the road at the pack, facing the player: behind the rider its gold cab on two
    wheels, set further up the road so they stand higher, under a cobalt canopy lit azure, edged by a
    white scalloped valance strung with yellow lights on grey posts. In front, the rider in a purple tee
    and a white headband, the hands on the handlebar, the legs either side of the front tyre, edge-on
    under its mudguard, the tread falling down it 1px a frame."""
    g = edged(Grid(32, 48))
    u = unit(g)[1]
    # the cab's wheels, behind and to the sides
    for x in (3.5, 28.5):
        g.blob(x, 40, 1.8, 4.5, "ink")
        g.rect(x - 0.5, 37, 1, 6, "dslate")
    # the canopy posts and the cab: its front panel behind the rider, the seat's edge over it
    for x in (2, 29):
        g.rect(x, 12, 1, 22, "grey")
    g.rect(2, 23, 28, 12, "gold")
    g.rect(2, 23, 28, 1, "yellow")
    g.rect(26, 24, 4, 11, "amber")
    g.rect(2, 33, 28, 1, "ochre")
    # the canopy: a dome over the cab, lit on its upper left, the valance scalloped under it with lights
    g.cel(16, 9, 15, 8, "cobalt", "blue", "azure", power=2.4)
    g.rect(0, 9, 32, 9, None)
    g.rect(1, 9, 30, 3, "cobalt")
    g.rect(27, 9, 4, 3, "blue")
    for k in range(6):
        g.cel(3.5 + k * 5, 12, 2.5, 1.8, "white", "lgrey")
    for k in range(6):
        g.p(3 + k * 5, 11, "yellow")
    # the rider's legs either side of the front wheel, bare shins, shoes on the pedals
    g.blob(16, 41, 2, 5.5, "ink")
    treads(g, 15.5, 38, 1, 8, roll, u, back=True)
    g.rect(15.5, 33, 1, 4, "lgrey")
    g.rect(13.5, 35, 5, 2, "dslate")
    g.rect(13.5, 35, 5, 1, "slate")
    for x, foot in ((10, lf), (19, rf)):
        g.rect(x, 29, 3, 4, "shale")
        g.rect(x + 2, 29, 1, 4, "coal")
        g.rect(x, 33, 3, foot - 33, "dbrown")
        g.rect(x + 2, 33, 1, foot - 33, "plum")
        g.rect(x - 1 if x < 16 else x, foot, 4, 2, "ink")
    # the tee and the arms down to the grips, the handlebar across
    g.rect(9, 20, 14, 10, "purple")
    g.rect(20, 20, 3, 10, "plum")
    g.rect(9, 20, 1, 9, "mauve")
    for x in (5, 24):
        g.rect(x, 21, 3, 3, "purple")
        g.rect(x, 24, 3, 3, "dbrown")
    g.rect(6, 27, 20, 2, "grey")
    g.rect(6, 27, 20, 1, "lgrey")
    for x in (4, 25):
        g.rect(x, 26, 3, 3, "ink")
    # the head: the face, short black hair, a white headband
    g.rect(14, 18, 4, 3, "dbrown")
    face_disc(g, 16, 14.5, 6.5, 6, "dbrown", "plum")
    g.cel(16, 10.5, 7, 3.5, "ink", None, "shale")
    g.rect(9.5, 11, 13, 2, "white")
    g.rect(19.5, 11, 3, 2, "lgrey")
    road.face_front(g, 16, 14, lips="ink")
    g.p(11, 14, "white")
    g.p(19, 14, "white")
    return rim(g, dict(LIT, dbrown=("skin2", "brown"), plum=("skin2", "brown"), coal=("ash", None),
                       shale=("ash", None)))


# ---------- sandcastle ----------

SANDCASTLE_IDLE = (0, 0, 1, 0), 400


def sandcastle(flutter=0):
    """A sandcastle, front on, laid out on obstacles.SIZE: a mound of sand, a crenellated wall with an
    arched door between two bucket towers ribbed where the bucket left its rings, a taller middle tower
    behind with a red pennant on a stick. Tan, lit cream on the left, shaded brown on the right, with pink
    and white shells pressed in. flutter 1 swings the pennant's tail up a pixel and in one."""
    g = edged(Grid(obstacles.SIZE, obstacles.SIZE))
    uy = unit(g)[1]
    # the pennant on its stick
    g.rect(20, 2, 1, 8, "brown")
    if flutter:
        g.tri((21, 2), (21, 6), (25, 3 - uy), "red")
    else:
        g.tri((21, 2), (21, 6), (26, 4), "red")
    g.p(21, 2, "pink")
    # the middle tower, behind
    g.rect(15, 9, 11, 14, "tan")
    g.rect(23, 9, 3, 14, "brown")
    g.rect(15, 9, 1, 14, "cream")
    for x in (15, 19, 23):
        g.rect(x, 7, 3, 2, "tan")
    g.rect(23, 7, 3, 2, "brown")
    g.rect(15, 13, 11, 1, "clay")
    # the wall with its battlements and the arched door
    g.rect(9, 20, 22, 11, "tan")
    g.rect(27, 20, 4, 11, "brown")
    for x in (9, 13, 17, 21, 25, 29):
        g.rect(x, 18, 2, 2, "brown" if x >= 27 else "tan")
    g.cel(20, 27, 3, 3.5, "bark")
    g.rect(17, 27, 6, 4, "bark")
    # the bucket towers, wider at the base, their rings
    for x0, sh in ((4, False), (29, True)):
        g.tri((x0, 31), (x0 + 7, 31), (x0 + 1, 14), "tan")
        g.tri((x0 + 1, 14), (x0 + 6, 14), (x0 + 7, 31), "tan")
        g.rect(x0 + 4.5, 15, 2, 16, "brown")
        if not sh:
            g.rect(x0 + 1, 15, 1, 14, "cream")
        else:
            g.rect(x0 + 2, 15, 4.5, 16, "brown")
        g.rect(x0 + 1, 14, 6, 1, "skin1")
        for y in (19, 24):
            g.rect(x0 + 1, y, 6, 1, "clay")
    # the mound of sand under it all
    g.cel(20, 33, 18, 3.5, "tan", "brown", "skin1")
    g.rect(2, 33, 36, 1.5, "tan")
    g.rect(32, 33, 6, 1.5, "brown")
    # shells
    g.p(12, 23, "pink")
    g.p(25, 16, "white")
    g.p(33, 22, "white")
    return lit(g)


# ---------- lifeguard chair ----------

LIFEGUARD_IDLE = (0, 0, 1, 0), 450
LIFEGUARD_H = 60


def lifeguard_chair(lift=0):
    """A tall lifeguard chair, front on, laid out on obstacles.SIZE by LIFEGUARD_H: two driftwood legs
    splayed to the sand with ladder rungs between, a footrest, the seat with a red back panel and a white
    cross on it, a yellow and white umbrella over the seat on a grey pole and an orange life ring hung on
    the left leg. lift 1 lifts the umbrella's valance a pixel, as a breeze catches it."""
    g = edged(Grid(obstacles.SIZE, LIFEGUARD_H))
    uy = unit(g)[1]
    # the legs, splayed from the seat to the sand, lit on their left
    for top, bottom, sh in ((14, 6, False), (26, 32, True)):
        for y in range(26, 59):
            t = (y - 26) / 33
            x = top + (bottom - top) * t
            g.rect(x, y, 3, 1, "stone" if sh else "driftwood")
            if not sh:
                g.p(x, y, "white")
    # the ladder's rungs and a footrest
    for y in (34, 42, 50):
        t = (y - 26) / 33
        x0, x1 = 14 + (6 - 14) * t + 3, 26 + (32 - 26) * t
        g.rect(x0, y, x1 - x0, 2, "driftwood")
        g.rect(x0, y + 1, x1 - x0, 1, "stone")
    # the seat and its red back panel with a white cross
    g.rect(11, 24, 19, 3, "driftwood")
    g.rect(11, 26, 19, 1, "stone")
    g.rect(13, 13, 15, 11, "red")
    g.rect(25, 13, 3, 11, "dred")
    g.rect(13, 13, 15, 1, "pink")
    g.rect(19, 15, 3, 7, "white")
    g.rect(17, 17, 7, 3, "white")
    # the umbrella: its pole, the canopy in yellow and white wedges, the valance under it
    g.rect(20, 8, 1, 5, "grey")
    left, right, base = 3, 37, 9
    for i in range(6):
        x0, x1 = left + (right - left) * i / 6, left + (right - left) * (i + 1) / 6
        col = ("yellow" if i < 3 else "amber") if i % 2 == 0 else ("white" if i < 3 else "lgrey")
        g.tri((x0, base), (x1, base), (20.5, 2), col)
    for i in range(6):
        x0 = left + (right - left) * i / 6
        col = ("yellow" if i < 3 else "amber") if i % 2 == 0 else ("white" if i < 3 else "lgrey")
        g.cel(x0 + (right - left) / 12, base - lift * uy, (right - left) / 12, 1.8, col)
    # the life ring hung on the left leg
    g.cel(9, 38, 4, 4, "orange", "rust", "amber")
    g.cel(9, 38, 1.6, 1.6, None)
    for (x, y) in ((5, 38), (13, 38)):
        g.rect(x, y - 0.5, 1, 1, "white")
    return lit(g)


# ---------- sandwich board ----------

BOARD_IDLE = (0, 0, 1, 0), 450


def sandwich_board(steam=0):
    """A café's A-frame sign, front on, laid out on obstacles.SIZE: a forest chalkboard in a brown wooden
    frame lit tan along its top and left, narrowing to a hinge at the top, on legs splayed to the ground.
    On it in chalk: a coffee cup with steam over it and two lines of writing under it. steam 1 waves the
    steam a pixel."""
    g = edged(Grid(obstacles.SIZE, obstacles.SIZE))
    ux = unit(g)[0]
    # the back legs behind, then the frame and the board
    g.tri((7, 30), (12, 30), (5, 37), "dbrown")
    g.tri((28, 30), (33, 30), (35, 37), "dbrown")
    g.tri((12, 3), (28, 3), (6, 32), "brown")
    g.tri((28, 3), (34, 32), (6, 32), "brown")
    g.tri((12, 3), (14, 3), (6, 32), "tan")
    g.rect(12, 3, 16, 1, "tan")
    g.tri((26, 3), (28, 3), (34, 32), "dbrown")
    g.tri((14, 6), (26, 6), (10, 29), "forest")
    g.tri((26, 6), (30, 29), (10, 29), "forest")
    g.rect(17, 2, 6, 1.5, "grey")
    g.rect(17, 2, 6, 1, "lgrey")
    # the legs' feet
    g.rect(5, 32, 4, 5, "brown")
    g.rect(31, 32, 4, 5, "dbrown")
    # chalk: the cup, its handle and saucer, the steam, the writing
    g.rect(16, 15, 7, 5, "white")
    g.rect(16, 15, 7, 1, "lgrey")
    g.rect(23, 16, 2, 1, "white")
    g.rect(24, 16, 1, 3, "white")
    g.rect(23, 18, 2, 1, "white")
    g.rect(14, 20, 11, 1, "white")
    for k, (x, y) in enumerate(((18, 13), (18, 12), (19, 11), (19, 10), (21, 13), (21, 12), (22, 11), (22, 10))):
        g.rect(x + (ux if steam and k % 4 >= 2 else 0), y, 1, 1, "lgrey")
    g.rect(13, 23, 14, 1, "lgrey")
    g.rect(14, 26, 11, 1, "lgrey")
    return lit(g, dict(forest=("green", None)))


# ---------- ttc-bus ----------

# 3x5 letters for the bus's route sign and wordmark: obstacles.LETTERS and the route's digits.
LETTERS = {**obstacles.LETTERS, "7": ("111", "001", "010", "010", "010"), "9": ("111", "101", "111", "001", "111")}
BUS_IDLE = (0, 1), 400


def lettering(g, cx, y, text, c, bar=None):
    """obstacles.lettering with LETTERS, so it spells the route too."""
    full = obstacles.LETTERS
    obstacles.LETTERS = LETTERS
    try:
        obstacles.lettering(g, cx, y, text, c, bar)
    finally:
        obstacles.LETTERS = full


def ttc_bus(blink=0, roll=None):
    """A TTC bus from straight behind, a lane wide, laid out on 56x55 and drawn at CAR_SCALE to 56x66: the
    roof pod over a white upper body lit along its top and left; the wide rear window, dark with a glint,
    under the amber route sign "97" on black; the ttc red lower body with two white stripes, "TTC" in
    white, the engine grille's slats, the tail lights and blinkers at the outer corners; the bumper and
    both rear tyres, black, no bogie. blink 1 lights the left blinker. roll (0 to 3) is a drive frame:
    tread lines climb the tyres and the body dips 1px onto them on frames 1 and 2."""
    g = edged(Grid(56, 55))
    px = raster(g)
    uy = unit(g)[1]
    for x in (5, 42):
        g.rect(x, 45, 9, 10, "ink")
        g.rect(x, 45, 2, 9, "dslate")
        if roll is not None:
            treads(g, x + 2, 47, 7, 7, roll, uy)
    wheels = [row[:] for row in px.px]
    px.px = [[None] * px.w for _ in range(px.h)]
    # the roof pod and the white upper body
    g.rect(14, 2, 28, 2, "lgrey")
    g.rect(14, 2, 28, 1, "white")
    g.rect(40, 2, 2, 2, "grey")
    g.cel(28, 7, 26, 3.5, "white", "lgrey", power=4)
    g.rect(2, 6, 52, 21, "white")
    g.rect(50, 6, 4, 21, "lgrey")
    # the route sign and the rear window, a glint across the glass
    g.rect(21, 4, 14, 6, "ink")
    lettering(g, 28, 4.5, "97", "amber", "amber")
    g.rect(5, 11, 46, 14, "ink")
    g.rect(6, 12, 44, 12, "navy")
    g.rect(6, 12, 44, 1, "dslate")
    g.tri((11, 24), (19, 12.5), (24, 12.5), "dslate")
    g.tri((18, 24), (26, 12.5), (28, 12.5), "dslate")
    # the red lower body, its two white stripes, the wordmark and the grille
    g.rect(2, 27, 52, 17, "ttc")
    g.rect(50, 27, 4, 17, "dred")
    g.rect(2, 27, 52, 1, "red")
    g.rect(2, 29, 52, 1, "white")
    g.rect(2, 31, 52, 1, "white")
    lettering(g, 28, 33, "TTC", "white")
    g.rect(18, 39, 20, 4, "dred")
    for x in range(19, 37, 3):
        g.rect(x, 39, 2, 4, "ink")
    # tail lights over blinkers at the outer corners
    for x, side in ((4, 0), (47, 1)):
        g.rect(x, 33, 5, 5, "red")
        g.rect(x, 33, 5, 1, "pink")
        g.rect(x + 4, 34, 1, 4, "dred")
        lit_ = blink and side == 0
        g.rect(x, 38, 5, 3, "yellow" if lit_ else "amber")
        if lit_:
            g.rect(x, 38, 5, 1, "white")
    # the bumper across the full width
    g.rect(2, 43, 52, 3, "dslate")
    g.rect(2, 43, 52, 1, "slate")
    g.rect(2, 43, 1, 3, "grey")
    dip = 1 if roll in (1, 2) else 0
    body = px.px
    px.px = [[(body[y - dip][x] if y >= dip else None) or wheels[y][x] for x in range(px.w)] for y in range(px.h)]
    return lit(g, dict(ttc=("red", None)))


# ---------- hit bursts (hits.py's layout: 64x64, drawn hits.BURST_SCALE times bigger) ----------

SPRINKLES = ("yellow", "cyan", "white", "lime")


def hit_dropped_cone(step):
    """The impact star in pink, then the strawberry scoop shoots up off a pink splat, peaks and drops back
    as drops and sprinkles fly out of the splat and the empty cone tumbles away to the right."""
    g = hits.Grid(64, 64)
    cx, cy = 32, 40
    if step == 0:
        hits.impact(g, "pink", cx, cy)
        return hits.rim(g)
    # the splat: a flat pink blot spreading, shaded mauve, that shrinks back to drips
    sr = (0, 10, 14, 16, 16, 14, 11, 8)[step]
    hits.piece(g, lambda p: [p.ell(cx, cy + 6, sr, sr * 0.38, "pink", "mauve", "white"),
                             p.ell(cx - sr * 0.6, cy + 7, sr * 0.3, sr * 0.22, "pink", "mauve")])
    # drops thrown out of it and falling
    t = step - 0.5
    for i, (vx, vy) in enumerate(((-8, -6), (8, -7), (-4, -9), (5, -10), (-11, -3), (11, -4))):
        x, y = cx + vx * t * 0.8, cy + 4 + vy * t * 0.8 + 1.1 * t * t
        if 3 <= x < 61 and 3 <= y < 60:
            col = SPRINKLES[i % 4] if i % 2 else "pink"
            hits.piece(g, lambda p: p.ell(x, y, 1.5, 1.5, col))
    # the empty cone tumbling off to the right, a quarter turn a frame, its rim lit and its point ochre
    ccx, ccy = cx + 5 + step * 3, cy - 4 - step * 3 + step * step * 0.6
    if ccx < 55 and ccy < 55:
        a = math.radians(step * 90 + 30)
        tip = (ccx + math.cos(a) * 7, ccy + math.sin(a) * 7)
        rim_ = [(ccx - math.cos(a) * 3 + math.cos(a + d) * 4, ccy - math.sin(a) * 3 + math.sin(a + d) * 4)
                for d in (math.pi / 2, -math.pi / 2)]
        mid = ((rim_[0][0] + tip[0]) / 2, (rim_[0][1] + tip[1]) / 2)
        hits.piece(g, lambda p: [p.tri(rim_[0], rim_[1], tip, "tan"), p.tri(rim_[1], tip, mid, "ochre")])
    # the scoop: up, peaking, dropping back
    sy = (0, 28, 18, 13, 12, 15, 21, 29)[step]
    hits.piece(g, lambda p: [p.ell(cx - 2, sy, 5.5, 5, "pink", "mauve", "white"),
                             p.rect(cx - 6, sy + 3, 9, 2, "pink"),
                             p.p(cx - 3, sy - 4, "red")])
    return g


def hit_promo_team(step):
    """The impact star in amber, then a white camera flash with yellow rays that shrinks away while
    four-point flashes pop round it in turn and confetti in cyan, pink and yellow falls."""
    g = hits.Grid(64, 64)
    cx, cy = 32, 36
    if step == 0:
        hits.impact(g, "amber", cx, cy)
        return hits.rim(g)
    fr = (0, 15, 12, 9, 6, 4, 0, 0)[step]
    if fr:
        hits.piece(g, lambda p: [hits.burst(p, cx, cy, fr, fr * 0.45, 8, "yellow", 22.5),
                                 p.ell(cx, cy, fr * 0.45, fr * 0.45, "white")])
    for i, (x, y) in enumerate(((14, 18), (50, 22), (18, 50), (48, 48), (32, 12))):
        age = step - 1 - i
        if 0 <= age < 3:
            r = (3, 5, 2)[age]
            hits.piece(g, lambda p: hits.star4(p, x, y, r, "yellow"))
    if step >= 2:
        t = step - 2
        for i, (x0, col) in enumerate(((12, "cyan"), (22, "pink"), (30, "yellow"), (41, "cyan"), (52, "pink"))):
            x = x0 + (1 if (t + i) % 2 else -1)
            y = 8 + i * 3 % 7 + t * 7
            if y < 58:
                hits.piece(g, lambda p: p.rect(x, y, 2 + (t + i) % 2, 3 - (t + i) % 2, col))
    return g


HITS = {"fx-hit-dropped-cone": hit_dropped_cone, "fx-hit-promo-team": hit_promo_team}


# ---------- build: the road sprites at full size and every depth step ----------

def posed(q, s):
    """A pose q with its numeric offsets snapped to whole pixels at s, its named choices as given."""
    return {**q, **snap({k: v for k, v in q.items() if isinstance(v, (int, float)) and not isinstance(v, bool)}, s)}


def person(s, draw, **q):
    """draw(**q), a drawing of this file's, on a minis.Mini at scale s, its pose snapped."""
    return small(this(), s, draw, **posed(q, s))


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every road sprite at full size, then at every
    depth step, then the hit bursts."""
    me = this()
    drive = range(4)
    for suffix, step in (("", 1), *(("@" + k, v) for k, v in STEPS)):
        p, o, car = P * step, O * step, tuple(v * step for v in CAR)
        yield f"dropped-cone{suffix}", [
            ("idle", [person(p, dropped_cone, bob=b, tear=k == 1).outlined() for k, b in enumerate(BREATH)],
             BREATH_MS)]
        yield f"promo-team{suffix}", [
            ("walk", [depths.dressed(p, promo_top(), legs="navy", shoes="white", **w).outlined()
                      for w in PERSON_WALK], PERSON_WALK_MS),
            ("idle", [depths.dressed(p, promo_top(k == 0), legs="navy", shoes="white", bob=b).outlined()
                      for k, b in enumerate(BREATH)], BREATH_MS)]
        yield f"rollerblader{suffix}", [("ride", [small(me, p, rollerblader, **posed(q, p)).outlined()
                                                  for q in ROLLER_RIDE], ROLLER_RIDE_MS)]
        yield f"pedicab{suffix}", [("ride", [small(me, p, pedicab, **posed(q, p)).outlined()
                                             for q in PEDICAB_RIDE], PEDICAB_RIDE_MS)]
        for key, draw, (args, ms) in (("sandcastle", sandcastle, SANDCASTLE_IDLE),
                                      ("lifeguard-chair", lifeguard_chair, LIFEGUARD_IDLE),
                                      ("sandwich-board", sandwich_board, BOARD_IDLE)):
            yield f"{key}{suffix}", [("idle", [small(me, o, draw, a).outlined() for a in args], ms)]
        args, ms = BUS_IDLE
        yield f"ttc-bus{suffix}", [("idle", [small(me, car, ttc_bus, a).outlined() for a in args], ms),
                                   ("drive", [small(me, car, ttc_bus, roll=r).outlined() for r in drive], 100)]


def bursts():
    for key, draw in HITS.items():
        yield key, [("play", [hits.burst_frame(draw, i).outlined(False) for i in range(8)], 70)]


# ---------- cards ----------

def kid_with_cone(lift=0):
    """The kid holding a new cone up in her right hand (screen right), smiling, for the buy card: drawn at
    road.SCALE with no dropped cone."""
    def top(g, b, arms=0):
        kid_top()(g, b)
        # the happy face over the sad one: eyes, cheeks and a smile
        g.rect(10.5, 15 + b, 2, 1, "skin1")
        g.rect(16.5, 15 + b, 2, 1, "skin1")
        g.rect(10.5, 17 + b, 2, 2, "skin1")
        g.rect(16.5, 17 + b, 2, 2, "skin1")
        g.rect(10.5, 16 + b, 2, 2, "ink")
        g.rect(16.5, 16 + b, 2, 2, "ink")
        g.rect(12.5, 20 + b, 4, 2, "skin1")
        g.p(12.5, 19 + b, "dbrown")
        g.p(15.5, 19 + b, "dbrown")
        g.rect(13.5, 20 + b, 2, 1, "dbrown")
        # the forearm raised to her chest and the new cone in her hand, beside her face
        g.rect(19, 25 + b, 3, 7, None)
        g.rect(20, 22 + b, 3, 6, "skin1")
        g.rect(22, 22 + b, 1, 6, "skin2")
        waffle(g, 19, 25, 16 + b - lift, 23.5 + b - lift)
        g.cel(22, 14.5 + b - lift, 3.6, 2.8, "pink", "mauve", "white")
        g.p(22, 11.5 + b - lift, "red")

    g = edged(Grid(32, 48))
    for x in (10, 15):
        g.rect(x, 35, 3, 8, "skin1")
        g.rect(x + 2, 35, 1, 8, "skin2")
        g.rect(x - 0.5, 43, 4, 2, "red")
        g.rect(x - 0.5, 44, 4, 1, "dred")
    top(g, 0)
    return lit(g)


def merch_tee():
    """The promoter's tee held up as merch, 30x24: turquoise lit foam, shaded dturq, the star on its front."""
    g = edged(Grid(30, 24))
    g.rect(7, 3, 16, 19, "turquoise")
    g.rect(20, 3, 3, 19, "dturq")
    g.tri((7, 3), (1, 9), (7, 11), "turquoise")
    g.tri((23, 3), (29, 9), (23, 11), "dturq")
    g.rect(12, 3, 6, 2, "dturq")
    g.rect(7, 3, 1, 18, "foam")
    stamp(g, STAR, 15, 12, {"#": "yellow"})
    return lit(g)


def card_lick():
    """A pack dog leaning in to lick the pink puddle round the dropped cone, the kid looking on."""
    import cards
    a = cards.Art()
    a.ground("pawsPromenade")
    a.put("dropped-cone", "idle", 20, 60, 1)
    c = a.put("dog-biscuit", "pull", 50, 57, flip=True)
    a.lead(50, c, 62)
    a.hearts([(52, 8)])
    return a


def card_buy():
    """The kid holding up a new cone under hearts, a callout of -$."""
    import cards
    a = cards.Art()
    a.ground("pawsPromenade")
    img = to_image(small(this(), P, kid_with_cone).outlined())
    a.shadow(40, 56, 30)
    a.paste(img, 40 - img.width // 2, 60 - img.height)
    a.hearts([(56, 10), (62, 22)])
    a.bubble(3, 6, 24, ["-$"], "dred")
    return a


def card_pull_away():
    """A pack dog pulled away from the dropped cone on its leash."""
    import cards
    a = cards.Art()
    a.ground("pawsPromenade")
    a.put("dropped-cone", "idle", 52, 60)
    c = a.put("dog-biscuit", "pull", 18, 56, flip=True)
    a.lead(18, c, 6)
    a.fill(31, 6, 2, 5, "red")
    a.fill(31, 12, 2, 2, "red")
    return a


def beam(a, x0, x1, cx, cy, rx):
    """A spotlight's beam from the art's top edge (x0 to x1) down to a pool round (cx, cy), rx wide, dithered
    in gold and yellow so the road shows through it."""
    for y in range(0, cy + 4):
        t = y / cy
        left, right = x0 + (cx - rx - x0) * t, x1 + (cx + rx - x1) * t
        for x in range(int(left), int(right) + 1):
            if (x + y) % 2 == 0:
                a.fill(x, y, 1, 1, "yellow" if (x + 2 * y) % 6 == 0 else "gold")
    for y in range(cy - 3, cy + 4):
        for x in range(cx - rx, cx + rx + 1):
            if ((x - cx) / rx) ** 2 + ((y - cy) / 3.5) ** 2 <= 1:
                a.fill(x, y, 1, 1, "yellow" if (x + y) % 2 else "gold")


def card_wave():
    """A pack dog in a spotlight's pool, the promoter filming it, flashes popping."""
    import cards
    a = cards.Art()
    a.ground("homeStretch")
    beam(a, 0, 26, 24, 50, 19)
    a.put("promo-team", "idle", 60, 68)
    c = a.put("dog-biscuit", "idle", 24, 56, shadow=False)
    a.lead(24, c, 18)
    a.sparkle(6, 40, "white")
    a.sparkle(40, 30, "white")
    a.sparkle(38, 8, "white")
    return a


def card_merch():
    """The promoter's star tee held up as merch, a callout of -$."""
    import cards
    a = cards.Art()
    a.ground("homeStretch")
    a.put("promo-team", "idle", 22, 68)
    tee = to_image(merch_tee().outlined())
    a.paste(tee, 42, 26)
    a.bubble(46, 5, 24, ["-$"], "dred")
    return a


def card_push_through():
    """A pack dog pulling past the promoter, speed lines behind it."""
    import cards
    a = cards.Art()
    a.ground("homeStretch")
    a.put("promo-team", "walk", 56, 68, 1)
    c = a.put("dog-kilo", "pull", 24, 58)
    a.lead(24, c, 12)
    for y, x, w in ((32, 3, 8), (39, 1, 10), (46, 4, 7)):
        a.fill(x, y, w, 1, "white")
    return a


ILLUSTRATIONS = {
    "card-dropped-cone-lick": card_lick,
    "card-dropped-cone-buy": card_buy,
    "card-dropped-cone-pull-away": card_pull_away,
    "card-promo-team-wave": card_wave,
    "card-promo-team-merch": card_merch,
    "card-promo-team-push-through": card_push_through,
}


def cards_preview(out, scale=4):
    import cards
    from PIL import Image

    sheet = Image.new("RGB", ((cards.CW + 6) * len(ILLUSTRATIONS) * scale, (cards.CH + 6) * scale),
                      (24, 20, 37))
    saved = cards.ILLUSTRATIONS
    cards.ILLUSTRATIONS = {**saved, **ILLUSTRATIONS}
    try:
        for i, key in enumerate(ILLUSTRATIONS):
            card = cards.mock_card("encounter", key).resize((cards.CW * scale, cards.CH * scale), Image.NEAREST)
            sheet.paste(card, (i * (cards.CW + 6) * scale, 0))
    finally:
        cards.ILLUSTRATIONS = saved
    sheet.save(out)


# ---------- sounds ----------

EFFECTS = {
    # a wet splat, then a sad "aww"
    "sfx-hit-dropped-cone": [
        ("pinknoise", 0.16, None, 0, dict(vol=0.9, low=1800, high=150, attack=0.003, release=0.85)),
        ("triangle", 0.18, (220, 70), 0, dict(vol=0.7, attack=0.003, release=0.8)),
        ("triangle", 0.34, ("E5", "A4"), 0.2, dict(vol=0.6, attack=0.04, release=0.6, shape="h")),
        ("square", 0.34, ("E5", "A4"), 0.2, dict(vol=0.15, duty=25, low=1500, attack=0.04, release=0.6, shape="h")),
    ],
    # two shutter clicks, a flash whine rising, a bright "ta-da"
    "sfx-hit-promo-team": [
        ("pinknoise", 0.025, None, 0, dict(vol=0.8, low=7000, high=2500, attack=0.001, release=0.9)),
        ("pinknoise", 0.025, None, 0.07, dict(vol=0.7, low=7000, high=2500, attack=0.001, release=0.9)),
        ("triangle", 0.18, (1800, 4200), 0.04, dict(vol=0.25, attack=0.02, release=0.5)),
        ("square", 0.08, "G5", 0.24, dict(vol=0.5, duty=25, low=4000, release=0.5)),
        ("square", 0.22, "C6", 0.32, dict(vol=0.5, duty=25, low=4000, release=0.9)),
        ("triangle", 0.22, "C5", 0.32, dict(vol=0.6, release=0.9)),
    ],
}


def render_sounds(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    saved = dict(sounds.EFFECTS)
    sounds.EFFECTS.update(EFFECTS)
    try:
        with tempfile.TemporaryDirectory() as tmp:
            for key in EFFECTS:
                wav = f"{tmp}/{key}.wav"
                sounds.effect(tmp, key, wav)
                sounds.encode(wav, out_dir, key)
    finally:
        sounds.EFFECTS.clear()
        sounds.EFFECTS.update(saved)
    return list(EFFECTS)


# ---------- commands ----------

def build():
    build_sprites([*sprites(), *bursts()], SRC)
    os.makedirs("public/art/images", exist_ok=True)
    for key, draw in ILLUSTRATIONS.items():
        png = f"public/art/images/{key}.png"
        draw().img.save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"{SRC}/{key}.aseprite"], check=True)
    print("built", ", ".join([*ILLUSTRATIONS, *render_sounds("public/art/sounds")]))


if __name__ == "__main__":
    argv = sys.argv
    if len(argv) == 3 and argv[1] == "preview":
        preview(depth_settled([*sprites(), *bursts()]), argv[2])
    elif len(argv) == 3 and argv[1] == "cards":
        cards_preview(argv[2])
    elif len(argv) == 3 and argv[1] == "sounds":
        print("wrote", ", ".join(render_sounds(argv[2])))
    elif len(argv) == 2 and argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
