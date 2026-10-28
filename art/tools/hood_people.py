#!/usr/bin/env python3
"""Draw the neighbourhood road people: the movers and the busker that only some
neighbourhoods have, drawn like road.py's road people (laid out on a 32x48
design grid, the couple on 112/1.5 x 48, and drawn road.SCALE (1.5) times
bigger on a minis.Mini), with the road outline (pixel.road_edge) and road.LIT's
lit rim, cel shaded.

tourist             48x72   Distillery District and Yonge Street; a stepper facing the player, as the
                            mail carrier is: a straw sun hat with a red band, a turquoise holiday shirt
                            with a few pink and yellow flowers, a silver-topped camera on a strap round
                            the neck, a rust backpack (its straps and its top showing over the
                            shoulders), driftwood shorts and sandals, an open map in the right hand
                            (screen left); walk (4 frames, 100ms): road.PERSON_WALK, the free arm
                            swinging; idle (2 frames, 400ms): road.BREATH
couple              112x72  Distillery District, 2 lanes; two people strolling arm in arm, a stepper
                            facing the player as the tourist is: on the left a man in a red sweater
                            and grey trousers carrying a kraft shopping bag, on the right a woman with
                            long copper hair and a fringe in a lilac dress with a mauve shoulder bag,
                            their inner arms hooked together between them; walk (4 frames, 160ms, the
                            stroller's pace): road.PERSON_WALK, in step, the outer arms swinging; idle
                            (2 frames, 400ms): road.BREATH
busker              48x72   Kensington Market and Yonge Street; a fixed busker facing the player,
                            playing an acoustic guitar behind its open case: curly brown hair and a
                            beard, an olive plaid shirt, the case lying open at his feet, lined in red
                            plush, holding a page of sheet music and a cardboard sign
                            with a note on it (no coins: coins read as pickups); idle (4 frames,
                            150ms): the strumming hand down and up over the sound hole, his head
                            nodding 1px on the beat
strolling-busker    48x72   Kensington Market; a guitarist walking, a stepper facing the player as the
                            tourist is: a violet felt hat with a pink band and a red feather, shaggy
                            dark brown hair to the jaw, a lime shirt with violet paisley drops, brown
                            trousers, a cherry-red guitar with a cream rosette slung on a leather
                            strap, played as he walks (no case, unlike the busker); walk (4 frames,
                            100ms): road.PERSON_WALK, the strumming hand down on each lifted foot and
                            up as he passes over it; idle (4 frames, 150ms): a bar between steps, the
                            hand down and up, his head nodding 1px on the second beat; cue (4 frames,
                            120ms): a strum flourish, the hand thrown up, swept down past the sound
                            hole and flung out low, a note rising beside the hat
delivery-cyclist    48x72   Kensington Market and Yonge Street; a fast rider coming down a lane at the
                            player, facing it as cyclist does: a big turquoise insulated delivery box
                            on the back, wider than the shoulders and over the head, with a reflective
                            band; a black helmet, a violet jacket, jeans, a black bike with a
                            white headlamp and a phone on the bars; ride (4 frames, 90ms):
                            hazards.CYCLIST_RIDE's pedalling and 1px sway
gardener            48x72   Cabbagetown; a slow rider coming down a lane at the player, walking behind
                            a green wheelbarrow heaped with autumn leaves (reds, oranges and browns, no
                            gold or amber): an olive canvas sun hat with a wide brim, white hair, a
                            chambray shirt with rolled sleeves, a tan canvas apron, lime gardening gloves
                            on the grips, jeans and brown work boots; the barrow's black tire edge-on in
                            a grey fork in front, its stands under the tray's back corners; push (4
                            frames, 160ms, the stroller's pace): road.PERSON_WALK, the barrow rolling
                            steadily, the tire's tread rolling 1px a frame; idle (2 frames, 400ms):
                            road.BREATH with the barrow tipped forward onto its nose, the handles up at
                            the chest and a leaf or two over the lip; cue (4 frames, 200ms): righting
                            the barrow before a restart, tipped, halfway, level, then braced to push
ranger-cart         48x72   High Park, 1 lane; a park ranger's small utility cart, a stop-and-go mover
                            riding its lane at the player, facing it as pedicab does: a white roof on
                            two posts with an amber light on top, a fan rake's head over the roof from
                            the bed, a kraft paper bag of leaves behind the passenger seat, the ranger
                            at the wheel in an olive uniform with a gold badge and a tan flat-brimmed
                            campaign hat, a green cowl with two headlights and a white plate, a black
                            bumper and the front tires under green fenders; push (4 frames, 100ms):
                            the tread falling down the tires 1px a frame, the body dipping 1px onto
                            them on frames 1 and 2; idle (4 frames, 400ms): stopped, the amber light
                            flashing on frames 1 and 3 while the ranger looks left, then right; cue
                            (4 frames, 120ms): restarting, the ranger's free hand raised pointing
                            ahead, jabbing 1px higher on frames 1 and 3, the light flashing on 0 and 2
ice-cream-bike      48x72   The Beaches; an ice cream vendor's front-loading tricycle riding its lane at
                            the player and stopping for a beat, facing it as cyclist does: a red and
                            white striped umbrella over the rider, a white freezer box in front with a
                            foam lid, a shallow band and an orange popsicle sign with a bite out of it,
                            a wheel under each corner; the rider in a sky shirt with short brown hair,
                            the hands on the bar along the box, a gold bell at its left end; push (4
                            frames, 120ms): the sneakers going round under the box, the tread falling
                            down the tires, the rider swaying 1px; idle (2 frames, 400ms): stopped, a
                            strawberry cone held out in the screen-right hand, lifted 1px as the rider
                            breathes; cue (2 frames, 150ms): ringing the bell, the bell rocking and
                            amber ring marks flashing out over it

Each has depth variants at every step in minis.STEPS (@94 to @50), redrawn at the
step on a Mini at road.SCALE x the step, with the original's tags, frame counts
and durations, pose offsets snapped to whole pixels at the small size.

Usage:
  hood_people.py preview OUT.png   every frame of every sprite and variant on the zone roads
  hood_people.py build             write art/hood-people/*.aseprite and export to public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import Grid, edged, main, raster, scale_of  # noqa: E402
import minis  # noqa: E402
import road  # noqa: E402
from hazards import CYCLIST_RIDE, sway_rows  # noqa: E402
from minis import STEPS, scaled, snap  # noqa: E402
from obstacles import treads, unit  # noqa: E402
from obstacles import treads  # noqa: E402
from pixel import K  # noqa: E402
from road import LIT, SCALE, face_disc, lean, rim, stair, swung  # noqa: E402

# ---------- tourist: facing the player, a stepper like the mail carrier ----------

def tourist_top(g, b, arms=0):
    """The tourist's top for road.person: shorts over the bare legs, the holiday shirt, the backpack, the
    camera, the map and the sun hat. The map hand (screen left) stays; the free arm (screen right) swings."""
    # shorts over the bare legs, each leg its own short leg
    g.rect(10, 33 + b, 12, 3, "driftwood")
    for x in (10, 17):
        g.rect(x, 36 + b, 5, 2, "driftwood")
        g.rect(x + 4, 33 + b, 1, 5, "stone")
    # the free arm (screen right): a short sleeve, then the bare forearm swinging
    n = swung(arms, 1)
    g.rect(23, 22 + b, 4, 4, "turquoise")
    g.rect(26, 22 + b, 1, 4, "dturq")
    g.rect(23, 26 + b, 4, 7 - n, "skin1")
    g.rect(26, 26 + b, 1, 7 - n, "skin2")
    # the map arm (screen left), hanging to the hip
    g.rect(5, 22 + b, 4, 4, "turquoise")
    g.rect(8, 22 + b, 1, 4, "dturq")
    g.rect(5, 26 + b, 4, 4, "skin1")
    g.rect(8, 26 + b, 1, 4, "skin2")
    # the shirt, lit down its left side, a few flat hibiscus flowers, the open collar
    g.rect(9, 21 + b, 14, 12, "turquoise")
    g.rect(20, 21 + b, 3, 12, "dturq")
    g.rect(9, 22 + b, 1, 10, "foam")
    for x, y in ((11, 30), (19, 30), (6, 23)):
        g.rect(x, y + b, 2, 2, "pink")
        g.p(x, y + b, "white")
    g.rect(14, 21 + b, 4, 1, "white")
    g.rect(15, 22 + b, 2, 1, "white")
    # the backpack's straps down the chest, over the shoulders from the pack behind
    for x in (10, 20):
        g.rect(x, 21 + b, 2, 9, "rust")
        g.rect(x, 28 + b, 2, 1, "dbrown")
    # the camera on its strap: a black body with a silver top plate and a lens
    g.rect(13, 21 + b, 1, 4, "ink")
    g.rect(18, 21 + b, 1, 4, "ink")
    g.rect(12, 25 + b, 8, 5, "ink")
    g.rect(12, 25 + b, 8, 1, "lgrey")
    g.rect(13, 24 + b, 2, 1, "lgrey")
    g.rect(15, 26 + b, 3, 3, "grey")
    g.p(16, 27 + b, "ink")
    g.p(15, 26 + b, "white")
    # the open map held at the hip, the hand on its top corner: cream paper folded in four, a blue river,
    # a green park and a red pin
    g.rect(0.5, 30 + b, 8, 7, "cream")
    g.rect(4.5, 30 + b, 1, 7, "tan")
    g.rect(0.5, 33 + b, 8, 1, "tan")
    g.rect(1.5, 31 + b, 2, 2, "green")
    for k in range(4):
        g.p(6 + (k > 1), 33 + b + k - (k > 2), "sky")
    g.p(2, 35 + b, "red")
    g.rect(5, 29 + b, 4, 3, "skin1")
    g.rect(8, 29 + b, 1, 3, "skin2")
    # head: the face, brown hair at the sides, the straw sun hat with a red band and a wide brim
    face_disc(g, 16, 12.5 + b, 8, 8, "skin1", "skin2")
    g.rect(8, 10 + b, 2, 5, "brown")
    g.rect(22, 10 + b, 2, 5, "brown")
    g.cel(16, 6.5 + b, 6.5, 4.5, "cream", "tan", "white")
    g.rect(9.5, 8 + b, 13, 1.5, "red")
    g.rect(4, 9.5 + b, 24, 2, "cream")
    g.rect(4, 11 + b, 24, 1, "tan")
    road.face_front(g, 16, 14 + b)
    g.p(10, 17 + b, "pink")
    g.p(22, 17 + b, "pink")


TOURIST = dict(legs="skin1", shoes="brown")
TOURIST_RIM = {**LIT, "dturq": ("turquoise", None)}


def tourist(**q):
    """The tourist facing the player, with the road outline and the lit rim."""
    return rim(edged(road.person(tourist_top, **TOURIST, **q)), TOURIST_RIM)


# ---------- couple: arm in arm, facing the player, two lanes ----------

# The couple's design grid: 112 px wide at road.SCALE, 48 rows.
COUPLE_W = 112 / SCALE
# The left edge of each person's 32-column cell: the man's, then the woman's, their bodies 10 columns apart.
MAN, WOMAN = COUPLE_W / 2 - 27, COUPLE_W / 2 - 3
COUPLE_WALK = road.PERSON_WALK
COUPLE_WALK_MS = 160


def front_legs(g, x0, b, lf, rf, legs, shoes, top=33):
    """A person's legs and shoes facing the player, as road.person draws them, in the cell at x0: legs (fill,
    shade) from the hem at row top down."""
    for x, f in ((x0 + 11, lf), (x0 + 17, rf)):
        g.rect(x, top + b, 4, 43 - top + f - b, legs[0])
        g.rect(x + 3, top + b, 1, 43 - top + f - b, legs[1])
        g.rect(x, 43 + f, 4, 2, shoes)


def couple(lf=0, rf=0, bob=0, arms=0):
    """The couple facing the player, strolling arm in arm, in step."""
    g = edged(Grid(COUPLE_W, 48))
    b = bob
    m, w = MAN, WOMAN
    # legs: his grey trousers and brown shoes, her bare legs under the dress and pink flats
    front_legs(g, m, b, lf, rf, ("grey", "slate"), "brown")
    front_legs(g, w, b, lf, rf, ("skin1", "skin2"), "pink", top=38)
    # her long copper hair, falling behind her shoulders
    g.rect(w + 8, 10 + b, 16, 13, "ochre")
    g.rect(w + 20, 10 + b, 4, 13, "rust")
    # his outer arm (screen left) swings, carrying the kraft shopping bag
    n = swung(arms, -1)
    road.back_arm(g, m + 5, 4, 22 + b, ((9, "red", "dred"), (3, "skin1", None)), lift=n)
    g.rect(m + 3, 33 + b - n, 7, 7, "tan")
    g.rect(m + 8, 33 + b - n, 2, 7, "brown")
    g.rect(m + 3, 33 + b - n, 7, 1, "cream")
    g.rect(m + 5, 31 + b - n, 1, 2, "dbrown")
    g.rect(m + 7, 31 + b - n, 1, 2, "dbrown")
    # her outer arm (screen right) swings against his
    n = swung(arms, 1)
    road.back_arm(g, w + 23, 3, 22 + b, ((3, "lilac", "violet"), (9, "skin1", "skin2")), lift=n)
    # the red sweater, lit down its left side, a crew neck and a ribbed hem
    g.rect(m + 9, 21 + b, 14, 13, "red")
    g.rect(m + 20, 21 + b, 3, 13, "dred")
    g.rect(m + 9, 21 + b, 1, 12, "pink")
    g.rect(m + 13, 21 + b, 6, 1, "dred")
    g.rect(m + 9, 32 + b, 14, 2, "dred")
    g.p(m + 9, 21 + b, None)
    g.p(m + 22, 21 + b, None)
    # her lilac dress: the bodice, then a skirt flaring to the knee
    g.rect(w + 10, 21 + b, 12, 9, "lilac")
    g.rect(w + 19, 21 + b, 3, 9, "violet")
    g.tri((w + 10, 29 + b), (w + 22, 29 + b), (w + 16, 21 + b), "lilac")
    g.rect(w + 8, 29 + b, 16, 9, "lilac")
    g.rect(w + 7, 33 + b, 18, 5, "lilac")
    g.rect(w + 20, 29 + b, 4, 9, "violet")
    g.rect(w + 21, 33 + b, 4, 5, "violet")
    g.rect(w + 8, 30 + b, 1, 3, "white")
    g.rect(w + 14, 21 + b, 4, 1, "skin1")
    # the mauve shoulder bag, its strap across her from her right shoulder (screen left) to her left hip
    stair(g, w + 11, 21 + b, w + 21, 30 + b, "purple")
    g.rect(w + 20, 29 + b, 5, 4, "mauve")
    g.rect(w + 20, 29 + b, 5, 1, "pink")
    g.rect(w + 24, 30 + b, 1, 3, "purple")
    # the inner arms hooked together between them: his sleeve bends down and in, hers tucks through his
    for k in range(4):
        g.rect(m + 22 + k, 22 + b + k * 1.5, 3, 3, "red")
    g.rect(m + 24, 27 + b, 2, 3, "dred")
    for k in range(4):
        g.rect(w + 7 - k, 22 + b + k * 1.5, 3, 3, "lilac")
    g.rect(w + 4, 26 + b, 2, 1, "violet")
    g.rect(m + 26, 27 + b, 5, 3, "skin1")
    g.rect(m + 26, 29 + b, 5, 1, "skin2")
    g.rect(m + 25, 27 + b, 2, 2, "red")
    # his face under short dark brown hair
    face_disc(g, m + 16, 12.5 + b, 8, 8, "skin1", "skin2")
    g.cel(m + 16, 7.5 + b, 8.5, 4, "dbrown", "plum", "brown")
    g.rect(m + 8, 8 + b, 2, 4, "dbrown")
    g.rect(m + 22, 8 + b, 2, 4, "dbrown")
    road.face_front(g, m + 16, 13 + b)
    # her face framed by the copper hair, a fringe over the brow
    face_disc(g, w + 16, 13 + b, 7.5, 7.5, "skin1", "skin2")
    g.cel(w + 16, 8 + b, 8.5, 4.5, "ochre", "rust", "tan")
    g.rect(w + 8, 9 + b, 2, 13, "ochre")
    g.rect(w + 22, 9 + b, 2, 13, "rust")
    road.face_front(g, w + 16, 13.5 + b, lips="dred")
    g.p(w + 10, 16.5 + b, "pink")
    g.p(w + 22, 16.5 + b, "pink")
    return rim(g, {**LIT, "violet": ("lilac", None), "slate": ("grey", None)})


# ---------- busker: facing the player, behind the open guitar case ----------

# Strumming: the hand down over the sound hole, back up, down, up, the head nodding 1px on the second beat.
# 4 frames at 150ms.
BUSKER_IDLE = (dict(strum=0), dict(strum=1), dict(strum=0, nod=1), dict(strum=1, nod=1))
BUSKER_IDLE_MS = 150
BUSKER = dict(legs="blue", shoes="dbrown")
BUSKER_RIM = {**LIT, "olive": ("moss", None), "dolive": ("olive", None), "blue": ("sky", None)}

# A note, ♪, drawn in the grid's own pixels so it keeps its strokes at any scale.
NOTE = ("..##", "..#.", "..#.", "###.", "##..")


def note(g, x, y, c):
    """NOTE with its top-left at design (x, y), one drawn pixel per character; a single pixel below 1x."""
    s, px = scale_of(g), raster(g)
    x0, y0 = scaled(x, s), scaled(y, getattr(g, "sy", s))
    if s < 1:
        px.rect(x0, y0, 1, 2, c)
        return
    for j, row in enumerate(NOTE):
        for i, ch in enumerate(row):
            if ch == "#":
                px.p(x0 + i, y0 + j, c)


def busker_top(strum=0, nod=0):
    """The busker's top for road.person: the plaid shirt, the guitar across him, the fretting hand on its
    neck (screen right), the strumming hand over the sound hole (strum 1 lower), the bearded head (nod lowers
    it a row) and the open case in front of his legs."""
    def top(g, b):
        h = b + nod
        # the plaid shirt, lit down its left side, checked in dolive
        g.rect(9, 21 + b, 14, 12, "olive")
        g.rect(20, 21 + b, 3, 12, "dolive")
        g.rect(9, 22 + b, 1, 10, "moss")
        for x in (12, 17):
            g.rect(x, 21 + b, 1, 12, "dolive")
        g.rect(9, 24 + b, 14, 1, "dolive")
        # the fretting arm (screen right): the sleeve out to the elbow, the hand up on the neck
        g.rect(23, 22 + b, 4, 5, "olive")
        g.rect(26, 22 + b, 1, 5, "dolive")
        g.rect(24, 26 + b, 4, 3, "olive")
        g.rect(27, 26 + b, 1, 3, "dolive")
        # the guitar: the lower bout at his hip, the upper bout, the sound hole and bridge, the neck up to
        # screen right
        g.cel(13, 30.5 + b, 6.5, 4.5, "ochre", "rust", "tan")
        g.cel(18.5, 26.5 + b, 4.5, 3.5, "ochre", "rust", "tan")
        g.cel(17.5, 27.5 + b, 1.6, 1.6, "ink")
        g.rect(9, 31.5 + b, 4, 1, "ink")
        for k in range(6):
            g.rect(21 + k * 1.5, 25 - k + b, 2, 2, "plum")
        g.rect(29, 18 + b, 2, 3, "plum")
        g.p(28, 18 + b, "lgrey")
        g.p(28, 20 + b, "lgrey")
        g.rect(25, 22 + b, 3, 3, "skin1")
        g.rect(27, 22 + b, 1, 3, "skin2")
        # the strumming arm (screen left): the sleeve to the elbow, the forearm across the guitar, the hand
        # over the sound hole, down a row on strum 1
        g.rect(5, 22 + b, 4, 6, "olive")
        g.rect(8, 22 + b, 1, 6, "dolive")
        g.rect(6, 28 + b, 5, 3, "olive")
        g.rect(9, 27 + b + strum, 4, 3, "olive")
        g.rect(9, 29 + b + strum, 4, 1, "dolive")
        g.rect(12, 26 + b + 2 * strum, 3, 3, "skin1")
        g.rect(12, 28 + b + 2 * strum, 3, 1, "skin2")
        # head: the face, a mop of curly brown hair, a short beard under the smile
        face_disc(g, 16, 12.5 + h, 8, 8, "skin1", "skin2")
        g.cel(16, 8 + h, 9, 5.5, "dbrown", "plum", "brown")
        for x, y in ((9, 6), (16, 4), (23, 6), (8, 12), (24, 12)):
            g.cel(x, y + h, 2.6, 2.6, "dbrown", "plum", "brown")
        g.rect(7, 9 + h, 3, 6, "dbrown")
        g.rect(22, 9 + h, 3, 6, "dbrown")
        road.face_front(g, 16, 13 + h, lips="plum")
        g.cel(16, 19.5 + h, 4.5, 1.8, "dbrown", "plum")
        # the open case lying at his feet, its red plush showing over the near side of the shell, a page of
        # sheet music and a cardboard sign with a note propped up in it
        g.rect(2, 39, 28, 2, "red")
        g.rect(2, 40, 28, 1, "dred")
        g.rect(4, 36, 6, 5, "white")
        g.rect(9, 36, 1, 5, "lgrey")
        # the page's staff and a note on it; a smaller page, too narrow for the note, keeps two staff lines
        if scale_of(g) >= 1.3:
            for y in (37, 38.5, 40):
                g.rect(4, y, 5, 0.67, "grey")
            note(g, 5, 36.4, "ink")
        else:
            for y in (37, 39):
                g.rect(5, y, 3, 1, "grey")
        g.rect(18, 34.5, 10, 6.5, "cream")
        g.rect(27, 34.5, 1, 6.5, "tan")
        note(g, 21, 35.5, "dbrown")
        g.rect(1, 41, 30, 4, "brown")
        g.rect(1, 41, 30, 1, "ochre")
        g.rect(1, 44, 30, 1, "dbrown")
        g.rect(28, 41, 2, 4, "dbrown")
        for x in (8, 23):
            g.rect(x, 42, 2, 1, "lgrey")
    return top


def busker(strum=0, nod=0, bob=0):
    """The busker facing the player, with the road outline and the lit rim."""
    return rim(edged(road.person(busker_top(strum, nod), bob=bob, **BUSKER)), BUSKER_RIM)


# ---------- strolling-busker: facing the player, playing as he walks ----------

# Walking: road.PERSON_WALK at road.PERSON_WALK_MS, both hands on the guitar, the strumming hand down on each
# lifted foot and up as he passes over it. Idle: a bar between steps, the hand down and up with his head
# nodding 1px on the second beat, 4 frames at 150ms as the busker's. Cue: a strum flourish, the hand thrown
# up, swept down past the sound hole and flung out low, a note rising beside his hat, 4 frames at 120ms.
STROLLING_WALK = road.PERSON_WALK
STROLLING_IDLE = (dict(strum=0), dict(strum=1), dict(strum=0, nod=1), dict(strum=1, nod=1))
STROLLING_IDLE_MS = 150
STROLLING_CUE = (dict(flourish="up"), dict(flourish="down", strum=2), dict(flourish="out", note=(3, 13)),
                 dict(flourish="out", note=(2, 9)))
STROLLING_CUE_MS = 120
STROLLING = dict(legs="brown", shoes="dbrown")
STROLLING_RIM = {**LIT, "violet": ("lilac", None), "green": ("lime", None)}


def strolling_top(strum=0, nod=0, flourish=None, note_at=None):
    """The strolling busker's top for road.person: shaggy dark brown hair to the jaw under a violet felt hat with a pink band and
    a red feather, a lime shirt with violet paisley drops, a cherry-red guitar slung on a leather strap, the
    fretting hand on its neck (screen right) and the strumming hand over the sound hole (strum lowers it),
    or thrown up, down or out in the flourish. In a walk frame the swing of the free arms becomes the strum."""
    def top(g, b, arms=0):
        h = b + nod
        down = strum + abs(arms)
        # shaggy dark brown hair falling to the jaw behind the face, the neck under it
        g.rect(7, 10 + h, 4, 9, "dbrown")
        g.rect(21, 10 + h, 4, 9, "dbrown")
        g.rect(8, 19 + h, 2, 1, "dbrown")
        g.rect(22, 19 + h, 2, 1, "dbrown")
        g.rect(12, 18 + h, 8, 4, "skin1")
        # the lime shirt, lit down its left side, a few violet paisley drops, an open neck
        g.rect(9, 21 + b, 14, 12, "lime")
        g.rect(20, 21 + b, 3, 12, "green")
        g.rect(9, 22 + b, 1, 10, "yellow")
        for x, y in ((11, 22), (19, 23), (10, 31), (21, 31)):
            g.rect(x, y + b, 2, 2, "violet")
            g.p(x + 1, y + 1 + b, "lilac")
        g.rect(14, 21 + b, 4, 1, "skin1")
        g.rect(15, 22 + b, 2, 1, "skin1")
        # the fretting arm (screen right): the sleeve out to the elbow, the hand up on the neck
        g.rect(23, 22 + b, 4, 5, "lime")
        g.rect(26, 22 + b, 1, 5, "green")
        g.rect(24, 26 + b, 4, 3, "lime")
        g.rect(27, 26 + b, 1, 3, "green")
        # the leather strap from his left shoulder (screen right) down across his chest behind the guitar
        for k in range(7):
            g.rect(21 - k * 1.5, 21 + k + b, 2, 1, "dbrown")
        # the guitar: the cherry lower bout at his hip, the upper bout, the cream rosette round the sound hole,
        # then the dark neck up to screen right and its headstock
        g.cel(12.5, 31 + b, 6.5, 4.5, "red", "dred", "pink")
        g.cel(18, 27 + b, 4.5, 3.5, "red", "dred", "pink")
        g.cel(16.5, 28.5 + b, 2.2, 2.2, "cream")
        g.cel(16.5, 28.5 + b, 1.5, 1.5, "ink")
        for k in range(6):
            g.rect(21 + k * 1.5, 25 - k + b, 2, 2, "dbrown")
        g.rect(29, 17 + b, 2, 4, "dbrown")
        g.p(28, 17 + b, "lgrey")
        g.p(28, 19 + b, "lgrey")
        g.rect(25, 22 + b, 3, 3, "skin1")
        g.rect(27, 22 + b, 1, 3, "skin2")
        # the strumming arm (screen left), the sleeve from the shoulder
        if flourish == "up":
            # thrown up: the arm raised beside the hat, the open hand high
            road.raised_arm(g, 4, 4, 13 + b, 23 + b, -1, ((3, "skin1", "skin2"), (8, "lime", "green")))
        elif flourish == "out":
            # flung out low after the chord, the open hand past his hip
            g.rect(5, 22 + b, 4, 6, "lime")
            g.rect(8, 22 + b, 1, 6, "green")
            g.rect(3, 27 + b, 4, 4, "lime")
            g.rect(6, 27 + b, 1, 4, "green")
            g.rect(1, 31 + b, 4, 3, "skin1")
            g.rect(1, 33 + b, 4, 1, "skin2")
        else:
            g.rect(5, 22 + b, 4, 6, "lime")
            g.rect(8, 22 + b, 1, 6, "green")
            g.rect(6, 28 + b, 5, 3, "lime")
            g.rect(9, 27 + b + down, 4, 3, "lime")
            g.rect(9, 29 + b + down, 4, 1, "green")
            g.rect(12, 26 + b + 2 * down, 3, 3, "skin1")
            g.rect(12, 28 + b + 2 * down, 3, 1, "skin2")
        if note_at:
            note(g, note_at[0], note_at[1] + b, "white")
        # head: the face framed by the hair, then the violet felt hat, its crown pinched, a pink band, a red
        # feather tucked in it and a brim turned up at the edges
        face_disc(g, 16, 13 + h, 7.5, 7.5, "skin1", "skin2")
        g.rect(8, 9 + h, 3, 6, "dbrown")
        g.rect(21, 9 + h, 3, 6, "dbrown")
        road.face_front(g, 16, 13.5 + h, lips="plum")
        g.cel(16, 6 + h, 6.5, 4, "violet", "purple", "lilac", power=3)
        g.rect(14, 2 + h, 4, 1, "purple")
        g.rect(9.5, 7.5 + h, 13, 1.5, "pink")
        g.rect(5, 9 + h, 22, 1.5, "violet")
        g.rect(5, 10.5 + h, 22, 1, "purple")
        g.rect(4, 8 + h, 2, 2, "violet")
        g.rect(26, 8 + h, 2, 2, "purple")
        for k in range(4):
            g.p(21 + k * 0.75, 7 - k * 1.25 + h, "red")
    return top


def strolling_busker(strum=0, nod=0, flourish=None, note=None, **q):
    """The strolling busker facing the player, with the road outline and the lit rim."""
    return rim(edged(road.person(strolling_top(strum, nod, flourish, note), **STROLLING, **q)), STROLLING_RIM)


# ---------- delivery-cyclist: facing the player, riding down a lane at it ----------

DELIVERY_RIDE = CYCLIST_RIDE
DELIVERY_RIDE_MS = 90
DELIVERY_RIM = {**LIT, "violet": ("lilac", None), "dturq": ("turquoise", None), "blue": ("sky", None)}


def delivery_cyclist(lf=36, rf=41):
    """The delivery rider facing the player, laid out on 32x48 as hazards.cyclist is; delivery_at draws it at
    size and adds the sway."""
    g = edged(Grid(32, 48))
    # the insulated box on the back: turquoise, lit along its top, a reflective band across, wider than the
    # shoulders and standing over the head
    g.rect(5, 1, 22, 22, "turquoise")
    g.rect(23, 1, 4, 22, "dturq")
    g.rect(5, 1, 22, 2, "foam")
    g.rect(5, 3, 22, 1, "dturq")
    g.rect(5, 1, 1, 22, "foam")
    g.rect(5, 13, 22, 2, "lgrey")
    g.rect(23, 13, 4, 2, "grey")
    g.p(5, 1, None)
    g.p(26, 1, None)
    # front wheel: a fat black tire edge-on, the fork, a black mudguard and the white headlamp
    g.blob(16, 39.5, 3, 7, "ink")
    g.rect(15, 34, 2, 9, "dslate")
    g.rect(13.5, 32, 5, 2, "ink")
    g.rect(14.5, 30, 3, 2, "lgrey")
    g.rect(15, 30.5, 2, 1, "white")
    # legs either side of the wheel: jeans to the ankle, black trainers with white soles
    for x, foot in ((10, lf), (19, rf)):
        g.rect(x, 29, 3, foot - 29, "blue")
        g.rect(x + 2, 29, 1, foot - 29, "navy")
        g.rect(x - 1 if x < 16 else x, foot, 4, 2, "ink")
        g.rect(x - 1 if x < 16 else x, foot + 1, 4, 1, "white")
    # the violet jacket, a zip down the front, the box's shoulder straps
    g.rect(9, 20, 14, 10, "violet")
    g.rect(20, 20, 3, 10, "purple")
    g.rect(9, 20, 1, 9, "lilac")
    g.rect(15.5, 20, 1, 10, "purple")
    for x in (10.5, 20):
        g.rect(x, 20, 1.5, 6, "ink")
    g.p(9, 20, None)
    g.p(22, 20, None)
    # arms down to the grips, black gloves
    for x in (5, 24):
        g.rect(x, 21, 3, 4, "violet")
        g.rect(x + 2, 21, 1, 4, "purple")
    # handlebar across, the phone on its mount at the middle, gloved hands on the grips
    g.rect(6, 27, 20, 2, "slate")
    g.rect(6, 27, 20, 1, "grey")
    g.rect(14, 25, 4, 3, "ink")
    g.rect(15, 25.5, 2, 1.5, "cyan")
    for x in (4, 25):
        g.rect(x, 25, 3, 4, "ink")
    # head: the face, then a black helmet with a grey vent stripe
    face_disc(g, 16, 14, 7.5, 6.5, "skin2", "brown")
    road.face_front(g, 16, 13.5)
    g.cel(16, 9, 8, 4, "navy", "ink", "dslate")
    g.rect(8, 10, 16, 2, "navy")
    g.rect(21, 10, 3, 2, "ink")
    g.rect(8.5, 12, 15, 1, "ink")
    g.rect(15.5, 5.5, 1, 4, "grey")
    return rim(g, DELIVERY_RIM)


def delivery_at(s, lf=36, rf=41, sway=0):
    """delivery_cyclist on a Mini at road.SCALE x step s. At full size the rider leans (road.lean shears about
    the feet); smaller, the rows above the handlebar shift sideways, which keeps the bars and wheel put."""
    g = raster(minis.small(sys.modules[__name__], SCALE * s, delivery_cyclist, lf=lf, rf=rf))
    if s == 1:
        return edged(lean(g, sway)) if sway else g
    sway_rows(g, sway, scaled(26, SCALE * s))
    return g


# ---------- gardener: facing the player, pushing a wheelbarrow of leaves at it ----------

# Pushing: road.PERSON_WALK's stride at the stroller's pace, the barrow rolling steadily in front, its tire's
# tread marks rolling 1 drawn pixel down a frame. 4 frames at 160ms.
GARDENER_PUSH = tuple(dict({k: v for k, v in q.items() if k != "arms"}, roll=str(n))
                      for n, q in enumerate(road.PERSON_WALK))
GARDENER_PUSH_MS = 160
# Stopped: the barrow tipped forward onto its nose, the handles up at the chest, breathing.
GARDENER_IDLE = tuple(dict(tilt="2", bob=b) for b in road.BREATH)
# Righting the barrow before a restart: tipped, halfway, level, then braced to push.
GARDENER_CUE = (dict(tilt="2"), dict(tilt="1"), dict(tilt="0"), dict(tilt="0", bob=-1))
GARDENER_CUE_MS = 200
# The leaves heaped in the tray, autumn reds, oranges and browns with no gold or amber, which read as coins:
# laid in rows LEAF_STEP apart, each leaf the next colour round, so no two neighbours match, nudged up or down
# a little and one in seven left out so the heap's own rust shows between them and the rows never read as
# brickwork.
GARDENER_LEAVES = ("red", "orange", "brown", "ochre", "dred", "rust", "orange", "red", "ochre")
LEAF_STEP = 1.6
GARDENER_RIM = {**LIT, "olive": ("moss", None), "dolive": ("olive", None), "dgreen": ("green", None),
                "lime": ("lime", None)}


def limb(g, x0, y0, x1, y1, w, parts):
    """An arm reaching from (x0, y0) to (x1, y1), w square at each step: parts are (share, colour) along it
    from the shoulder."""
    n = max(1, round(max(abs(x1 - x0), abs(y1 - y0)) * 2))
    for i in range(n + 1):
        f = i / n
        c = next(c for share, c in parts if f <= share + 1e-9)
        g.rect(x0 + (x1 - x0) * f - w / 2, y0 + (y1 - y0) * f - w / 2, w, w, c)


def gardener(lf=0, rf=0, bob=0, roll="0", tilt="0"):
    """The gardener facing the player, walking behind the wheelbarrow as it rolls at the player. tilt 1 and
    2 tip the barrow forward onto its nose, the handles rising; roll moves the tire's tread down a pixel."""
    g = edged(Grid(32, 48))
    b, t, r = bob, int(tilt), int(roll)
    # legs walking behind the barrow: jeans and brown work boots
    for x, f in ((11, lf), (17, rf)):
        g.rect(x, 33 + b, 4, 10 + f - b, "blue")
        g.rect(x + 3, 33 + b, 1, 10 + f - b, "navy")
        g.rect(x, 43 + f, 4, 2, "brown")
        g.rect(x, 44 + f, 4, 1, "dbrown")
    # the canvas apron to the knee, its straps over the shoulders, a pocket on the bib
    g.rect(9, 21 + b, 14, 17 - b, "tan")
    g.rect(20, 21 + b, 3, 17 - b, "brown")
    g.rect(9, 21 + b, 1, 16, "cream")
    g.rect(13, 23 + b, 6, 3, "brown")
    for x in (10, 20):
        g.rect(x, 20 + b, 2, 2, "brown")
    # the chambray shirt at the shoulders, the sleeves rolled, the forearms out to the handles, green
    # gardening gloves on the grips
    grip = 29.5 - 2.5 * t
    g.rect(8, 20 + b, 16, 2, "sky")
    g.rect(14, 20 + b, 4, 1, "skin1")
    for x0, x1 in ((7.5, 3), (24.5, 29)):
        limb(g, x0, 22.5 + b, x1, grip, 3, ((0.45, "sky"), (0.8, "skin1"), (1, "lime")))
    # the leaves heaped above the tray, more of the heap showing as it tips forward
    hy, hr = 29 - 1.2 * t, 4.5 + 0.8 * t
    g.cel(16, hy, 11.5, hr, "rust", "dbrick", "ochre")
    for j in range(math.ceil((2 * hr - 1) / LEAF_STEP)):
        y = hy - hr - 0.4 + j * LEAF_STEP
        half = 11.5 * math.sqrt(max(0, 1 - ((y + 0.75 - hy) / hr) ** 2))
        for i in range(int((2 * half - 1) // 3.2) + 1):
            x = 16 - half + 0.3 + (j % 2) * 1.6 + i * 3.2
            if x + 2.5 <= 16 + half + 0.5 and (i * 3 + j * 5) % 7:
                g.rect(x, y + (i * 5 + j * 7) % 3 * 0.4, 2.5, 1.5,
                       GARDENER_LEAVES[(i * 4 + j * 3) % len(GARDENER_LEAVES)])
    # the tray's front face, a green steel trapezoid lit along its lip; tipped, it shows less of itself and a
    # leaf or two slides over the lip
    lip = 29 + t
    g.tri((4, lip), (28, lip), (24, 37), "dgreen")
    g.tri((4, lip), (8, 37), (24, 37), "dgreen")
    g.tri((25, lip), (28, lip), (24, 37), "forest")
    g.rect(4, lip, 24, 1.5, "green")
    for k in range(t):
        g.rect(11 + 8 * k, lip + 1.5 + k, 2.5, 1.5, ("orange", "red")[k])
    # the handles' grips at the tray's back corners, the gloved hands on them
    for x in (1, 28.5):
        g.rect(x, grip + 0.5, 2.5, 1.5, "brown")
        g.rect(x + 0.5, grip - 0.5, 2, 2.5, "lime")
    # the stands under the tray's back corners, off the road as it tips
    for x in (8.5, 22):
        g.rect(x, 36.5, 1.5, 4.5 - t, "slate")
    # the wheel in front: a black tire edge-on in a grey fork, its tread rolling
    g.rect(13, 36.5, 1, 4.5, "lgrey")
    g.rect(18, 36.5, 1, 4.5, "lgrey")
    g.blob(16, 40.5, 2.5, 4.5, "ink")
    g.rect(13, 40, 1, 1, "grey")
    g.rect(18, 40, 1, 1, "grey")
    px, s = raster(g), scale_of(g)
    top, bottom = math.floor(36 * s + 0.5), math.floor(45 * s + 0.5)
    mid = math.floor(16 * s + 0.5)
    for y in range(top + 2, bottom - 1):
        if (y - top - r) % 4 == 0 and px.px[y][mid]:
            px.rect(mid - 1, y, 2, 1, "slate")
    # head: the face, white hair at the sides, an olive canvas sun hat with a wide brim
    face_disc(g, 16, 12.5 + b, 8, 8, "skin1", "skin2")
    g.rect(8.5, 11 + b, 1.5, 4, "white")
    g.rect(22, 11 + b, 1.5, 4, "lgrey")
    g.cel(16, 7 + b, 6.5, 4.5, "olive", "dolive", "moss")
    g.rect(9.5, 9 + b, 13, 1, "dolive")
    g.rect(4, 10 + b, 24, 2, "olive")
    g.rect(4, 11 + b, 24, 1, "dolive")
    g.rect(4, 10 + b, 6, 1, "moss")
    road.face_front(g, 16, 14 + b)
    g.p(10, 17 + b, "pink")
    g.p(22, 17 + b, "pink")
    return rim(g, GARDENER_RIM)
# ---------- ranger-cart: a park ranger's utility cart, facing the player, stop and go ----------

# Driving: the front tires' tread falls 1px a frame and the body dips 1px onto them on frames 1 and 2; 4 frames
# at 100ms, as every drive. Stopped: the amber light blinks while the ranger looks left, then right; 4 frames at
# 400ms. Restarting: the ranger jabs a finger ahead, the light flashing; 4 frames at 120ms.
RANGER_PUSH = [dict(roll=r) for r in range(4)]
RANGER_PUSH_MS = 100
RANGER_IDLE = (dict(), dict(light=1, look=-1), dict(), dict(light=1, look=1))
RANGER_IDLE_MS = 400
RANGER_CUE = (dict(point=1, light=1), dict(point=2), dict(point=1, light=1), dict(point=2))
RANGER_CUE_MS = 120
RANGER_RIM = {**LIT, "olive": ("moss", None), "dolive": ("olive", None)}


def ranger_cart(roll=None, light=0, look=0, point=0):
    """A park ranger's small utility cart coming down its lane at the pack, facing the player, laid out on
    32x48 and drawn at road.SCALE as the pedicab is: a white roof on two posts with an amber light on top, the
    ranger at the wheel on the cart's left (screen right) in an olive uniform and a tan flat-brimmed campaign
    hat, a kraft paper bag of leaves standing in the bed behind the passenger seat and a fan rake's head over
    the roof, the green cowl with two headlights and a white plate with a red maple leaf, a black bumper and
    the front tires under their fenders. roll (0 to 3) is a drive frame: the tread falls down the tires (still
    at rest) and the body dips 1px onto them on frames 1 and 2. light lights the amber beacon, look turns the
    ranger's eyes (-1 screen left, 1 right) and point raises his free hand pointing ahead (2 a pixel higher)."""
    g = edged(Grid(32, 48))
    px = raster(g)
    u = unit(g)[1]
    # the front tires, front on under the fenders, their tread falling as they roll at the player
    for x in (4.5, 27.5):
        g.blob(x, 41.5, 3, 5.5, "ink")
        g.rect(x - 2.5, 38, 1, 7, "dslate")
        treads(g, x - 1, 37, 3, 9, roll or 0, u, back=True)
    wheels = [row[:] for row in px.px]
    px.px = [[None] * px.w for _ in range(px.h)]
    dip = 1 if roll in (1, 2) else 0
    # the rake standing in the bed, its fan head over the roof's left end: grey tines spreading from the
    # handle's top, a clay handle down into the roof
    g.tri((5, 4.5), (0.5, 0), (9.5, 0), "grey")
    for k in range(4):
        g.rect(2 + 2 * k, 0, 1, 1.5 + k % 2, None)
    g.rect(4.5, 3, 1, 2, "clay")
    # the amber light on the roof: a dome on a black base, lit yellow with a white core and two rays
    g.rect(13.5, 4, 5, 1, "ink")
    if light:
        g.cel(16, 3, 2.5, 2, "yellow", "amber", "white")
        g.p(12, 2, "yellow")
        g.p(19, 2, "yellow")
        g.p(15.5, 0, "yellow")
    else:
        g.cel(16, 3, 2.5, 2, "amber", "orange", "yellow")
    # the roof: white, lit along its top, shaded down its right and along its underside
    g.rect(1, 5, 30, 3, "white")
    g.rect(27, 5, 4, 3, "lgrey")
    g.rect(1, 7, 30, 1, "lgrey")
    # the cab: the shade under the roof, the posts either side, the seat back across
    g.rect(4, 8, 24, 18, "navy")
    for x in (2.5, 27.5):
        g.rect(x, 8, 2, 19, "dslate")
        g.rect(x, 8, 1, 19, "slate")
    # the kraft paper leaf bag in the bed behind the passenger seat (screen left), leaves over its rolled top
    g.rect(5, 14, 7, 6, "tan")
    g.rect(10, 14, 2, 6, "brown")
    g.rect(5, 14, 1, 6, "cream")
    g.rect(5, 14, 7, 1, "brown")
    for x, y, c in ((5.5, 12.5, "orange"), (7.5, 12, "red"), (9.5, 12.5, "amber"), (6.5, 13, "rust"),
                    (10, 13, "ochre")):
        g.rect(x, y, 2, 1.5, c)
    g.rect(4, 19, 24, 7, "dslate")
    g.rect(4, 19, 24, 1, "slate")
    # the ranger at the wheel (screen right): olive shoulders, a collar and a gold badge
    g.cel(20, 23.5, 6.5, 4.5, "olive", "dolive", "moss", power=3)
    g.rect(18, 19.5, 4, 1.5, "skin2")
    g.rect(18.5, 20, 1, 1.5, "dolive")
    g.rect(20.5, 20, 1, 1.5, "dolive")
    g.rect(16, 22, 1.5, 1.5, "gold")
    # his free hand (screen left): on the wheel, or raised over the leaf bag pointing ahead, a pixel higher
    # on point 2
    if point:
        n = point - 1
        for k in range(5):
            g.rect(13.5 - 0.8 * k, 19.5 - 1.6 * k - n, 2.5, 2.5, "olive")
        g.rect(13.5, 19.5 - n, 1, 2.5, "dolive")
        g.rect(9.5, 10 - n, 3, 3, "skin1")
        g.rect(11.5, 10 - n, 1, 3, "skin2")
        g.rect(10, 8.5 - n, 1.5, 1.5, "skin1")
    # the steering wheel edge on in front of his chest, his hands on its rim, the column down into the dash
    g.rect(14.5, 24.5, 11, 1.5, "ink")
    g.rect(19.5, 26, 1, 1, "ink")
    for x in (14, 23.5):
        if x == 14 and point:
            continue
        g.rect(x, 23.5, 2.5, 2.5, "skin1")
        g.rect(x + 1.5, 23.5, 1, 2.5, "skin2")
    # his face under the campaign hat: a tan crown pinched to a peak, a brown band, the flat brim
    face_disc(g, 20, 15.5, 4.5, 4.5, "skin1", "skin2")
    road.face_front(g, 20 + look, 15, spread=2.5, mouth=3)
    g.rect(17, 9, 6, 3, "tan")
    g.rect(18, 8, 4, 1, "tan")
    g.rect(17, 9, 1, 2, "cream")
    g.rect(22, 9, 1, 2, "brown")
    g.rect(16.5, 11, 7, 1, "dbrown")
    g.rect(13.5, 12, 13, 1.5, "tan")
    g.rect(23.5, 12, 3, 1.5, "brown")
    g.rect(13.5, 13, 13, 0.75, "brown")
    # the cowl: green, lit along its top, shaded down its right, over the dash
    g.rect(3, 26, 26, 2, "dgreen")
    g.rect(3, 26, 26, 1, "green")
    g.rect(3.5, 28, 25, 7, "green")
    g.rect(3.5, 28, 25, 1, "lime")
    g.rect(25, 28, 3.5, 7, "dgreen")
    g.rect(5, 34, 22, 1, "dgreen")
    for x in (3.5, 27.5):
        g.p(x, 28, None)
    # the fenders over the tires
    for x in (1, 24.5):
        g.rect(x, 35, 6.5, 2.5, "green")
        g.rect(x, 37, 6.5, 0.75, "dgreen")
    g.rect(29, 35, 2.5, 2.5, "dgreen")
    # the headlights and the white Ontario plate, its number in blue
    for x in (8.5, 23.5):
        g.cel(x, 31, 2.2, 2.2, "white", "lgrey")
    g.rect(13, 30.5, 6, 3.5, "white")
    g.rect(13, 33, 6, 1, "lgrey")
    g.rect(14, 31.5, 4, 1, "blue")
    # the black bumper between the fenders
    g.rect(8, 35, 16, 2, "ink")
    g.rect(8, 35, 16, 1, "dslate")
    body = px.px
    px.px = [[(body[y - dip][x] if y >= dip else None) or wheels[y][x] for x in range(px.w)] for y in range(px.h)]
    return rim(g, RANGER_RIM)
# ---------- ice-cream-bike: facing the player, pedalling a freezer box down a lane ----------

# Pedalling: each foot's row under the box (the pedals go round), the wheels' tread roll and the rider's
# 1px sway toward the foot pushing down; 4 frames at 120ms.
ICE_PUSH = [dict(lf=41, rf=44, roll=0, sway=-2 / 3), dict(lf=42.5, rf=42.5, roll=1),
            dict(lf=44, rf=41, roll=2, sway=2 / 3), dict(lf=42.5, rf=42.5, roll=3)]
ICE_PUSH_MS = 120
# Stopped: the feet down, a cone held out in the screen-right hand, lifted 1px on frame 1 as the rider
# breathes; 2 frames at 400ms.
ICE_IDLE = [dict(offer=True), dict(offer=True, lift=2 / 3, bob=-2 / 3)]
ICE_IDLE_MS = 400
# Restarting: the thumb on the bell, the bell rocking and its ring marks flashing out; 2 frames at 150ms.
ICE_CUE = [dict(ring=1), dict(ring=2)]
ICE_CUE_MS = 150
ICE_RIM = {**LIT, "blue": ("sky", None)}
# The ring marks over the bell, in drawn pixels so they keep their strokes at any scale: three strokes
# fanning out: up and up-left on ring 1, all three further out on ring 2.
RING = (("......#...", "......#...", "...#......", "....#.....", "..........", "..........",
         ".........."),
        ("......#...", "......#...", ".#........", "..#.......", "..........", "##........",
         ".........."))

def recolour(g, x0, x1, y1, inside, swap):
    """In design columns x0 to x1 and rows above y1, where inside(x, y) holds, swap each drawn pixel's colour
    by swap (K names)."""
    s, sy = scale_of(g), getattr(g, "sy", scale_of(g))
    px = raster(g)
    swap = {K[a]: K[b] for a, b in swap.items()}
    for y in range(min(px.h, scaled(y1, sy))):
        for x in range(max(0, scaled(x0, s)), min(px.w, scaled(x1, s))):
            if px.px[y][x] in swap and inside((x + 0.5) / s, (y + 0.5) / sy):
                px.px[y][x] = swap[px.px[y][x]]


def bitmap_at(g, rows, x, y, c):
    """A character map with its top-left at design (x, y), one drawn pixel per character."""
    s, sy = scale_of(g), getattr(g, "sy", scale_of(g))
    px = raster(g)
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == "#":
                px.p(scaled(x, s) + i, scaled(y, sy) + j, c)


def ice_cream_bike(lf=42.5, rf=42.5, roll=None, sway=0, offer=False, lift=0, bob=0, ring=0):
    """The ice cream vendor's front-loading tricycle coming down a lane at the player, laid out on 32x48: a
    red and white striped umbrella over the rider, a white freezer box in front facing the player, its lid
    lit foam, an orange popsicle sign with a bite out of it on its face, a shallow band along its foot,
    the two wheels under its corners and the rider's shins and white sneakers on the pedals between them.
    The rider wears a white paper cap with a red band and a sky shirt, the hands on the bar along the box's
    back, a gold bell at its left end. sway moves the rider (not the umbrella or box) sideways; roll (0 to
    3) falls the tread down the tires; offer holds a strawberry cone out in the screen-right hand, lift
    raising it; ring rocks the bell and draws its ring marks."""
    g = edged(Grid(32, 48))
    u = 1 / scale_of(g)
    d = sway
    h = bob
    # the umbrella: a dome lit on its upper left, in six panels, red and white, that taper to the top
    g.cel(16, 7.5, 15, 7, "red", "dred", "pink")
    g.rect(0, 7.5, 32, 8, None)

    def panel(x, y):
        hw = 15 * max(0.05, (1 - ((y - 7.5) / 7) ** 2)) ** 0.5
        return math.floor(((x - 16) / hw + 1) * 3) % 2 == 1

    recolour(g, 0, 32, 7.5, panel, dict(red="white", pink="white", dred="lgrey"))
    g.rect(15.5, 0, 1, 1, "dred")
    # its valance, a scallop under each panel
    for k in range(6):
        red = k % 2 == 0
        g.cel(3.5 + k * 5, 7.5, 2.5, 1.7, "red" if red else "white", "dred" if red else "lgrey")
    # the wheels under the box's corners, edge-on, their tread falling as they roll at the player
    for x in (5, 27):
        g.blob(x, 43.5, 1.8, 4, "ink")
        if roll is not None:
            treads(g, x - 0.5, 40, 1, 7, roll, u, back=True)
        g.rect(x - 1.5, 39.5, 3, 1.5, "lgrey")
    # the rider's shins and white sneakers on the pedals, behind the axle
    for x, foot in ((11.5, lf), (17.5, rf)):
        g.rect(x + d, 39, 3, foot - 39, "skin1")
        g.rect(x + 2 + d, 39, 1, foot - 39, "skin2")
        g.rect(x - 0.5 + d, foot, 4, 2, "white")
        g.rect(x - 0.5 + d, foot + 1.5, 4, 0.75, "lgrey")
    g.rect(4, 40.5, 24, 1, "dslate")
    # the rider: the sky shirt, its white collar, the shoulders over the box
    g.cel(16 + d, 25 + h, 8, 5.5, "sky", "blue", "cyan", power=3)
    g.rect(14 + d, 19.5 + h, 4, 1.5, "white")
    # the arms down to the bar, unless the screen-right hand holds a cone out
    for x in (6, 23) if not offer else (6,):
        g.rect(x + d, 21 + h, 3, 3, "sky")
        g.rect(x + 2 + d, 21 + h, 1, 3, "blue")
        g.rect(x + d, 24 + h, 3, 2, "skin1")
        g.rect(x + 2 + d, 24 + h, 1, 2, "skin2")
    # the head: the face under short brown hair, a fringe over the brow
    face_disc(g, 16 + d, 14.5 + h, 6.5, 5.5, "skin1", "skin2")
    g.cel(16 + d, 10.5 + h, 7, 3, "brown", "dbrown", "tan")
    g.rect(9.5 + d, 10.5 + h, 2, 4, "brown")
    g.rect(20.5 + d, 10.5 + h, 2, 4, "dbrown")
    road.face_front(g, 16 + d, 14 + h)
    g.p(11 + d, 17 + h, "pink")
    g.p(21 + d, 17 + h, "pink")
    if offer:
        # the cone held out to screen right: the sleeve up from the shoulder, the hand under a waffle cone
        # with a strawberry scoop
        c = -lift
        g.rect(23, 20 + h, 4, 3, "sky")
        g.rect(26, 20 + h, 1, 3, "blue")
        g.rect(25.5, 17 + c, 3, 4, "skin1")
        g.rect(27.5, 17 + c, 1, 4, "skin2")
        g.tri((24.5, 13.5 + c), (30.5, 13.5 + c), (27.5, 19 + c), "tan")
        g.tri((27.5, 13.5 + c), (30.5, 13.5 + c), (27.5, 19 + c), "ochre")
        g.cel(27.5, 12 + c, 3, 2.5, "pink", "mauve", "white")
    # the bar along the box's back, the bell at its left end
    g.rect(4, 26, 24, 1.5, "slate")
    g.rect(4, 26, 24, 0.75, "grey")
    rock = (-1, 1)[ring - 1] * u if ring else 0
    g.cel(4 + rock, 24.5, 2, 1.8, "gold", "amber", "yellow")
    g.rect(3.5 + rock, 24, 1, 0.75, "white")
    if ring:
        g.rect(5.5, 24.5, 1.5, 1.5, "skin1")
    # the freezer box: lit foam along its lid, white down its face, shaded lgrey down the right
    g.rect(3, 27, 26, 13.5, "white")
    g.rect(26, 27, 3, 13.5, "lgrey")
    g.rect(2.5, 27, 27, 2, "foam")
    g.rect(2.5, 28.5, 27, 0.75, "shallow")
    g.rect(3, 37.5, 26, 2, "shallow")
    g.rect(26, 37.5, 3, 2, "lake")
    # the popsicle sign on its face: a creamsicle with a bite out of its top right, on a tan stick
    g.rect(15, 35, 2, 3, "tan")
    g.rect(16.5, 35, 0.75, 3, "brown")
    g.cel(16, 32, 3, 4, "orange", "rust", "amber", power=4)
    g.cel(18.5, 28.5, 1.5, 1.5, "white")
    g.rect(14, 30, 1, 3, "white")
    if ring:
        # the ring marks: three short strokes out from the bell, up, up-left and left, further out on ring 2
        bitmap_at(g, RING[ring - 1], 0, 19.5, K["amber"])
    return rim(g, ICE_RIM)


# ---------- every sprite at a depth step ----------

def posed(q, p):
    """A pose q with its numeric offsets snapped to whole pixels at p."""
    return {**q, **snap({k: v for k, v in q.items() if isinstance(v, (int, float))}, p)}


def steps(suffix, s):
    """Yield (key + suffix, tags) for every sprite at depth step s (1 for the full size)."""
    p = SCALE * s
    here = sys.modules[__name__]

    def person(draw, q):
        return minis.small(road, p, draw, **posed(q, p)).outlined()

    def own(draw, q):
        return minis.small(here, p, draw, **posed(q, p)).outlined()

    breath = [dict(bob=b) for b in road.BREATH]
    yield f"tourist{suffix}", [("walk", [person(tourist, q) for q in road.PERSON_WALK], road.PERSON_WALK_MS),
                               ("idle", [person(tourist, q) for q in breath], road.BREATH_MS)]
    yield f"couple{suffix}", [("walk", [own(couple, q) for q in COUPLE_WALK], COUPLE_WALK_MS),
                              ("idle", [own(couple, q) for q in breath], road.BREATH_MS)]
    yield f"busker{suffix}", [("idle", [person(busker, q) for q in BUSKER_IDLE], BUSKER_IDLE_MS)]
    yield f"strolling-busker{suffix}", [
        ("walk", [person(strolling_busker, q) for q in STROLLING_WALK], road.PERSON_WALK_MS),
        ("idle", [person(strolling_busker, q) for q in STROLLING_IDLE], STROLLING_IDLE_MS),
        ("cue", [person(strolling_busker, q) for q in STROLLING_CUE], STROLLING_CUE_MS)]
    yield f"delivery-cyclist{suffix}", [("ride", [delivery_at(s, **q).outlined() for q in DELIVERY_RIDE],
                                         DELIVERY_RIDE_MS)]
    yield f"gardener{suffix}", [("push", [own(gardener, q) for q in GARDENER_PUSH], GARDENER_PUSH_MS),
                                ("idle", [own(gardener, q) for q in GARDENER_IDLE], road.BREATH_MS),
                                ("cue", [own(gardener, q) for q in GARDENER_CUE], GARDENER_CUE_MS)]
    yield f"ranger-cart{suffix}", [("push", [own(ranger_cart, q) for q in RANGER_PUSH], RANGER_PUSH_MS),
                                   ("idle", [own(ranger_cart, q) for q in RANGER_IDLE], RANGER_IDLE_MS),
                                   ("cue", [own(ranger_cart, q) for q in RANGER_CUE], RANGER_CUE_MS)]

    def bike(q):
        # the tread frame, the offered cone and the ring are choices, not offsets, so they skip the snap
        keep = {k: q[k] for k in ("roll", "offer", "ring") if k in q}
        rest = {k: v for k, v in q.items() if k not in keep}
        return minis.small(here, p, ice_cream_bike, **posed(rest, p), **keep).outlined()

    yield f"ice-cream-bike{suffix}", [("push", [bike(q) for q in ICE_PUSH], ICE_PUSH_MS),
                                      ("idle", [bike(q) for q in ICE_IDLE], ICE_IDLE_MS),
                                      ("cue", [bike(q) for q in ICE_CUE], ICE_CUE_MS)]


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite and its depth variants."""
    yield from steps("", 1)
    for suffix, s in STEPS:
        yield from steps(f"@{suffix}", s)


if __name__ == "__main__":
    # minis swaps the grid of the module named hood_people, so the build runs that module's functions
    import hood_people
    main(sys.argv, hood_people.sprites, "art/hood-people", __doc__)
