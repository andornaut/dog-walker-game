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
delivery-cyclist    48x72   Kensington Market and Yonge Street; a fast rider coming down a lane at the
                            player, facing it as cyclist does: a big turquoise insulated delivery box
                            on the back, wider than the shoulders and over the head, with a reflective
                            band; a black helmet, a violet jacket, jeans, a black bike with a
                            white headlamp and a phone on the bars; ride (4 frames, 90ms):
                            hazards.CYCLIST_RIDE's pedalling and 1px sway

Each has depth variants at every step in minis.STEPS (@94 to @50), redrawn at the
step on a Mini at road.SCALE x the step, with the original's tags, frame counts
and durations, pose offsets snapped to whole pixels at the small size.

Usage:
  hood_people.py preview OUT.png   every frame of every sprite and variant on the zone roads
  hood_people.py build             write art/hood-people/*.aseprite and export to public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import Grid, edged, main, raster, scale_of  # noqa: E402
import minis  # noqa: E402
import road  # noqa: E402
from hazards import CYCLIST_RIDE, sway_rows  # noqa: E402
from minis import STEPS, scaled, snap  # noqa: E402
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
    yield f"delivery-cyclist{suffix}", [("ride", [delivery_at(s, **q).outlined() for q in DELIVERY_RIDE],
                                         DELIVERY_RIDE_MS)]


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite and its depth variants."""
    yield from steps("", 1)
    for suffix, s in STEPS:
        yield from steps(f"@{suffix}", s)


if __name__ == "__main__":
    # minis swaps the grid of the module named hood_people, so the build runs that module's functions
    import hood_people
    main(sys.argv, hood_people.sprites, "art/hood-people", __doc__)
