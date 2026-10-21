#!/usr/bin/env python3
"""Draw the zone encounters on the road: the picnic, the goose, the prize
petunias, trash day, the café patio and the lemonade stand. Each is a billboard
like the minor obstacles (obstacles.py): a front elevation (the goose a side
view), squat, its base on the last opaque row, 64n-8 px wide for n lanes.

picnic              120x56  2 lanes, a gingham blanket, a basket, sandwiches on a plate and a
                            picnicker sitting cross-legged mid-bite; idle (4 frames, 400ms): a bite
                            (the sandwich 1px lower), then a chew (the cheeks puff out 1px)
goose               56x56   1 lane, a mover: a white goose, wings up, neck stretched, beak open
                            mid-honk; side view facing right, the game mirrors it for left.
                            run (4 frames, 110ms): a waddle, the feet swap and the body bobs 1px on
                            the passing frames, the wings flap 1px; idle (4 frames, 300ms): the honk,
                            the neck thrust 1px forward with the beak wide, then the beak shut
petunias            120x56  2 lanes, a raised flower bed of petunias with a blue "1st prize" rosette
                            on a stake, a hedge behind and a scandalised gardener peeking over it;
                            idle (4 frames, 450ms): the flowers sway 1px right, back, left
trash-bins          120x56  2 lanes, two metal bins on their sides spilling a banana peel, a can,
                            paper and a pizza box, their lid on the ground with a ginger cat sitting on
                            it; idle (4 frames, 300ms): the cat's tail sways, as road.cat's
cafe-patio          120x70  2 lanes, a striped awning on two poles over two bistro tables and two
                            cooing patrons, a toppled cup with a foam heart in its spill on the left
                            table and a cup on a saucer on the right; idle (4 frames, 350ms): a steam
                            curl rises off the cup 1px a frame
lemonade-stand      56x84   1 lane, lucky: a cardboard stand, road.kid behind it, a sign over the kid
                            ("LEMON ADE") and on the front ("50c" with a lemon, a drop beside a coin), a pitcher and
                            cups on the counter; idle (4 frames, 400ms): the kid breathes, and the
                            pitcher glints on the third frame

The drawings are in the 32px units of a 32x32 road sprite: the sprites draw them on a minis.Mini
at BIG (1.75x), a 2-lane one TWO_LANES units wide, so 32 units are 56px and a 2-lane encounter
is 120px wide. A 1px line stays 1px and motion moves whole pixels. Every encounter also has
<key>@<step> for each depth step in minis.STEPS (from shared/depth-steps.json), redrawn the same
way at BIG x the step, floor(size x scale + 0.5), with the original's tags, frames and durations
and a full outline. Sign letters are 3x5 pixels at 1x or more; smaller, they are scribbles.

All take the road outline rule (pixel.road_edge) and road.LIT's rim on their dark colours,
so the silhouette holds 3:1 on every road. The drawing functions take new, the grid maker
(Grid for the 32-unit size, or mini(s)), so cards can draw them at any size.

Usage:
  encounters.py preview OUT.png   every frame on the road colours
  encounters.py build             write art/encounters/*.aseprite and export to
                                  public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import road  # noqa: E402
from minis import STEPS, Mini, small  # noqa: E402
from pixel import ROADS, Grid, edged, main  # noqa: E402
from road import LIT  # noqa: E402

# The drawings are in the 32px units of the old road sprites; the sprites draw them BIG times larger (56px
# for a 32px unit frame), and a 2-lane one TWO_LANES units wide, so it is 120px (64n-8 for n lanes).
BIG = 1.75
TWO_LANES = (64 * 2 - 8) / BIG

# Every road the encounters stand on, for the preview: the four in pixel.ROADS, then Willow Crescent
# and Riverside Path.
GROUNDS = (*ROADS, "8b9bb4", "ead4aa")


def mini(s):
    """A grid maker for a depth variant at scale s."""
    return lambda w=32, h=32: Mini(s, w, h)


def scale_of(g):
    return getattr(g, "s", 1)


def whole(g, v):
    """An offset in full-size pixels that moves whole pixels on g, at least one if it moves at all."""
    s = scale_of(g)
    return math.copysign(max(1, math.floor(abs(v) * s)), v) / s if v else 0


def lit(g):
    """road.rim with road.LIT on the grid that holds the pixels, so a Mini gets the rim at its own size."""
    road.rim(getattr(g, "g", g), LIT)
    return g


def borrow(g, draw, x, y, *args, **q):
    """Draw road's draw(*args, **q) at g's scale (with minis.small, so its face is minis.face_front at that
    scale) and copy its pixels onto g with the top-left corner at (x, y), in full-size pixels."""
    s = scale_of(g)
    src = small(road, s, draw, *args, **q) if s != 1 else draw(*args, **q)
    dst = getattr(g, "g", g)
    ox, oy = round(x * s), round(y * s)
    for j, row in enumerate(getattr(src, "g", src).px):
        for i, c in enumerate(row):
            if c:
                dst.p(ox + i, oy + j, c)


# A 3x5 alphabet for the signs: the logo's blocky capitals, narrowed to fit a 32px sprite.
GLYPHS = {
    "A": "010101111101101", "D": "110101101101110", "E": "111100110100111", "F": "111100110100100",
    "L": "100100100100111", "M": "101111111101101", "N": "110101101101101", "O": "010101101101010",
    "R": "110101110101101", "0": "111101101101111", "2": "111001111100111", "5": "111100110001110", "c": "000000011100011",
}


def letter(g, col, lines, clip=None):
    """lines, each (text, x, y), in GLYPHS 4px a letter, lettered as the logo is: col letters in a 1px
    ink outline on a 1px dred shadow down and right, the lines outlined together. clip (x0, y0, x1, y1)
    keeps the outline and shadow on the board. The letters are 3x5 pixels at any scale of 1 or more, each
    line centred where it is in drawing units. Below 1 they are too small to read, so each line is a
    scribble: a row of ink with a gap between words."""
    s = scale_of(g)
    if s < 1:
        for text, x, y in lines:
            for i, ch in enumerate(text):
                if ch != " ":
                    g.rect(x + 4 * i, y + 1, 4 if i + 1 < len(text) and text[i + 1] != " " else 3, 3, "ink")
        return
    dst = getattr(g, "g", g)

    def at(v, n):
        """The pixel where a run of n pixels starts, centred where it is centred in drawing units."""
        return round((v + n / 2) * s - n / 2)

    fill = {(at(x, 4 * len(text) - 1) + 4 * i + k % 3, at(y, 5) + k // 3) for text, x, y in lines
            for i, ch in enumerate(text) for k, bit in enumerate(GLYPHS.get(ch, "")) if bit == "1"}
    ring = {(px + dx, py + dy) for px, py in fill for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - fill
    shadow = {(px + 1, py + 1) for px, py in ring} - ring - fill
    x0, y0, x1, y1 = clip or (0, 0, g.w - 1, g.h - 1)
    x0, y0, x1, y1 = (math.floor(x0 * s + 0.5), math.floor(y0 * s + 0.5), math.floor((x1 + 1) * s + 0.5) - 1,
                      math.floor((y1 + 1) * s + 0.5) - 1)
    for pts, c in ((shadow, "dred"), (ring, "ink"), (fill, col)):
        for px, py in pts:
            if x0 <= px <= x1 and y0 <= py <= y1:
                dst.p(px, py, c)


def heart(g, x, y, col, shade):
    """A 5x4 heart from (x, y)."""
    g.rect(x, y, 2, 2, col)
    g.rect(x + 3, y, 2, 2, col)
    g.rect(x, y + 1, 5, 1, col)
    g.rect(x + 1, y + 2, 3, 1, col)
    g.p(x + 2, y + 3, col)
    g.p(x + 4, y + 1, shade)
    g.p(x + 3, y + 2, shade)


# ---------- picnic ----------

def gingham(g, x0, y0, w, h, inset):
    """A red and white check, 4px cells across and 2 rows down; inset(y) trims each row at both ends."""
    for y in range(y0, y0 + h, 2):
        cut = inset(y)
        for x in range(x0 + cut, math.ceil(x0 + w - cut), 4):
            a, b = (x - x0) // 4 % 2 == 0, (y - y0) // 2 % 2 == 0
            col = "red" if a and b else "pink" if a or b else "white"
            g.rect(x, y, min(4, x0 + w - cut - x), 2, col)


def picnic(chew=0, new=Grid, w=88, crown=0):
    """The picnicker sits cross-legged on the right of the blanket, a sandwich at the mouth with a bite out
    of it. chew 1 is the bite (the sandwich 1px lower), 2 the chew (the cheeks puffed 1px wider). w is the
    width in drawing units: the picnicker sits centred 18 units in from the right edge and the plate moves
    left by half of what w is short of 88; the apple shows only where the picnicker's legs leave it room. crown lowers the top of the head and hair by that many units, their
    bottoms kept (see PICNIC_CROWN)."""
    d = w - 88
    g = edged(new(w, 32))
    # the blanket: a sliver of its top, wider at the front, then its hem
    gingham(g, 2, 23, 84 + d, 6, lambda y: (28 - y) // 2 * 2)
    g.rect(4, 29, 80 + d, 1, "dred")
    # the basket on the left: handle, a napkin and a baguette peeking out, the wicker body
    g.ell(15, 16, 8, 8, "brown")
    g.ell(15, 16, 6, 6, None)
    for k in range(7):
        g.rect(18 + k, 15 - k, 3, 2, "tan")
        g.p(19 + k, 16 - k, "ochre")
    g.rect(9, 13, 6, 3, "red")
    g.rect(11, 13, 2, 3, "white")
    g.rect(5, 16, 21, 10, "ochre")
    g.rect(5, 16, 21, 2, "brown")
    for y in (19, 22):
        for x in range(6, 25, 4):
            g.rect(x + (y // 3 % 2) * 2, y, 2, 2, "tan")
    g.rect(22, 18, 4, 8, "rust")
    # sandwiches cut in triangles on a plate
    m = d / 2
    g.ell(38 + m, 25.5, 9, 1.5, "white", "lgrey")
    for x0, x1, apex in ((30 + m, 38 + m, 34 + m), (37 + m, 46 + m, 41.5 + m)):
        g.tri((x0, 25), (x1, 25), (apex, 18), "tan")
        g.tri((x0 + 1.5, 25), (x1 - 1.5, 25), (apex, 19.5), "cream")
        g.rect(x0 + 2, 22, round(x1 - x0 - 4), 1, "green")
        g.rect(x0 + 2, 23, round(x1 - x0 - 4), 1, "red")
    # the picnicker: crossed legs, body, arms up to the sandwich, head
    cx = w - 18
    # an apple, where it clears the picnicker's legs
    if 50 + m + 2.5 < cx - 13:
        g.ell(50 + m, 24, 2.5, 2.5, "red", "dred", "pink")
        g.p(50 + m, 21, "dbrown")
    g.ell(cx, 25.5, 13, 3.5, "blue", "navy", "sky")
    g.rect(cx - 2, 23, 4, 2, "navy")
    g.rect(cx - 15, 25, 4, 3, "white")
    g.rect(cx + 11, 25, 4, 3, "lgrey")
    g.rect(cx - 7, 16, 14, 8, "mauve")
    g.rect(cx + 4, 16, 3, 8, "purple")
    g.rect(cx - 7, 16, 1, 7, "pink")
    puff = 1 if chew == 2 else 0
    road.face_disc(g, cx, 9 + crown / 2, 8, 8 - crown / 2, "skin1", "skin2")
    if puff:
        g.rect(cx - 9, 10, 1, 3, "skin1")
        g.rect(cx + 8, 10, 1, 3, "skin2")
    g.ell(cx, 5.5 + crown / 2, 8.5, 4.5 - crown / 2, "dbrown", "plum", "brown")
    g.rect(cx - 8, 5, 2, 6, "dbrown")
    g.rect(cx + 7, 5, 2, 6, "plum")
    g.rect(cx - 5, 8, 2, 2, "ink")
    g.rect(cx + 3, 8, 2, 2, "ink")
    g.p(cx - 5, 8, "white")
    g.p(cx + 3, 8, "white")
    g.p(cx - 6, 12, "pink")
    g.p(cx + 5, 12, "pink")
    # the sandwich held in both hands, a bite out of its top right corner
    d = whole(g, 1) if chew == 1 else 0
    # the forearms raised from the elbows to the hands under the sandwich
    g.rect(cx - 7, 17, 4, 4, "pink")
    g.rect(cx + 3, 17, 4, 4, "mauve")
    g.rect(cx - 5, 12 + d, 10, 1, "tan")
    g.rect(cx - 5, 13 + d, 10, 1, "cream")
    g.rect(cx - 5, 14 + d, 10, 1, "green")
    g.rect(cx - 5, 15 + d, 10, 1, "red")
    g.rect(cx - 5, 16 + d, 10, 1, "tan")
    g.rect(cx + 1, 12 + d, 3, 1, None)
    g.p(cx + 2, 13 + d, None)
    for x in (cx - 6, cx + 3):
        g.rect(x, 16 + d, 3, 2, "skin1")
        g.p(x + 2, 17 + d, "skin2")
    return lit(g)


PICNIC_IDLE = (0, 0, 1, 2), 400
# The head's crown, lowered in units at the steps where the hem rounds a row below the feet row
# (floor(full feet x scale + 0.5)) while the head already touches the frame's top, so the variant can rise
# onto its feet row without clipping.
PICNIC_CROWN = {"@88": 1, "@62": 1}


# ---------- goose ----------

def goose(fa=0, fb=0, bob=0, flap=0, beak=1, thrust=0, new=Grid):
    """Side view facing right. fa and fb move the near and far feet along the ground, bob lifts the body
    (negative is up), flap lifts the wing tips, beak opens it (0 shut, 1 open, 2 wide) and thrust pushes
    the head forward. The white takes the road outline; the orange beak and feet carry it on every road."""
    g = edged(new())
    b, f, t = bob, flap, thrust
    # legs and webbed feet, the far one a shade darker
    for x, step, leg, foot in ((11, fb, "ochre", "rust"), (16, fa, "orange", "ochre")):
        g.rect(x + step / 2, 24 + b, 2, 4 - b, leg)
        g.rect(x + step - 1, 28, 3, 1, leg)
        g.rect(x + step - 1, 29, 4, 1, foot)
    # the far wing, raised behind the body and clear of the neck, so the neck shows against the road
    g.tri((10, 15 + b), (19, 14 + b), (16, 2 + b + f), "lgrey")
    g.tri((13, 14 + b), (18, 14 + b), (16, 5 + b + f), "grey")
    # tail and body
    g.tri((2, 12 + b), (6, 20 + b), (9, 15 + b), "white")
    g.cel(14, 19.5 + b, 9.5, 5.5, "white", "lgrey")
    g.rect(8, 23 + b, 12, 1, "lgrey")
    # the near wing, spread up and back, its feather tips stepped in grey
    g.tri((7, 17 + b), (18, 16 + b), (5, 3 + b + f), "white")
    g.tri((10, 17 + b), (18, 16 + b), (14, 6 + b + f), "white")
    for k in range(4):
        g.rect(5 + k * 2, 5 + k * 3 + b + f, 2, 1, "lgrey")
    g.rect(9, 16 + b, 9, 1, "lgrey")
    # the neck stretched forward and up to the head
    for k in range(6):
        g.rect(18 + k + t * k / 5, 15 - k * 1.2 + b, 4, 3, "white")
    g.cel(24.5 + t, 7.5 + b, 3.5, 3, "white", "lgrey")
    # the beak: an orange knob, upper mandible and, opened, the lower one with the mouth between
    hx = 26 + min(t, 1)
    g.rect(hx, 5 + b, 2, 1, "orange")
    g.rect(hx, 6 + b, 3, 2, "orange")
    g.p(hx + 2, 7 + b, "ochre")
    if beak:
        g.rect(hx + 1, 8 + b, 2, beak, "dred")
        g.rect(hx, 8 + beak + b, 3, 1, "ochre")
    else:
        g.rect(hx, 8 + b, 3, 1, "ochre")
    # an angry eye under a scowling brow
    g.p(hx - 2, 7 + b, "ink")
    g.rect(hx - 3, 6 + b, 2, 1, "slate")
    return lit(g)


# The waddle: the near foot back, passing, forward, passing; the body bobs and the wings dip on the
# passing frames.
GOOSE_RUN = [dict(fa=-2, fb=2), dict(bob=-1, flap=1), dict(fa=2, fb=-2), dict(bob=-1, flap=1)]
# The honk: open, a thrust with the beak wide, open, shut.
GOOSE_IDLE = [dict(), dict(beak=2, thrust=1), dict(), dict(beak=0)]
GOOSE_OFFSETS = ("fa", "fb", "bob", "flap", "thrust")


# ---------- prize petunias ----------

PETUNIA_COLS = (("pink", "mauve"), ("mauve", "purple"), ("white", "lgrey"), ("hot", "dred"), ("pink", "mauve"),
                ("purple", "plum"), ("white", "lgrey"), ("mauve", "purple"))


def petunias(sway=0, new=Grid, w=88):
    """The gardener peeks over the hedge, wide-eyed under a sun hat, gripping its top; the bed sits in front
    of it, the rosette on its stake on the left. sway moves the flower heads sideways. w is the width in
    drawing units: the gardener moves left by what it is short of 88, and the hedge and bed end there."""
    d = w - 88
    g = edged(new(w, 32))
    # the gardener, behind the hedge
    cx = 66 + d
    road.face_disc(g, cx, 10.5, 7, 6.5, "skin1", "skin2")
    g.ell(cx, 3, 10, 1.6, "tan", "brown", "cream")
    g.ell(cx, 3, 4.5, 1.5, "tan", "brown", "cream")
    g.rect(cx - 5, 2, 10, 1, "green")
    g.rect(cx - 5, 6, 3, 1, "dbrown")
    g.rect(cx + 3, 6, 3, 1, "dbrown")
    g.p(cx - 6, 5, "dbrown")
    g.p(cx + 6, 5, "dbrown")
    for x in (cx - 5, cx + 3):
        g.rect(x, 7, 3, 3, "white")
        g.p(x + 1, 8, "ink")
    g.rect(cx - 1, 12, 3, 1, "dbrown")
    g.rect(cx - 1, 13, 1, 1, "dbrown")
    g.rect(cx + 1, 13, 1, 1, "dbrown")
    # the hedge, its top a row of clumps, lit green on the upper left
    g.rect(3, 17, 82 + d, 6, "forest")
    for i, x in enumerate(range(7, round(82 + d), 7)):
        g.ell(x, 17.5 - i % 2, 4.5, 3.5, "dgreen", "forest", "green")
    for x in (cx - 10, cx + 7):
        g.rect(x, 13, 4, 3, "skin1")
        g.rect(x, 13, 4, 1, "skin2")
        g.p(x + 1, 14, "skin2")
    # the bed: the soil, then the front planks
    g.rect(3, 22, 82 + d, 1, "dbrown")
    g.rect(2, 23, 84 + d, 7, "brown")
    g.rect(2, 23, 84 + d, 1, "tan")
    g.rect(2, 26, 84 + d, 1, "dbrown")
    for x in (2, 43 + d / 2, 84 + d):
        g.rect(x, 23, 2, 7, "dbrown")
        g.rect(x, 23, 1, 7, "ochre")
    # leaves along the soil, then the flowers on them
    for i, x in enumerate(range(5, round(84 + d), 5)):
        g.ell(x + 2, 21 - i % 2, 3, 2, "dgreen", "forest", "green")
    s = whole(g, sway)
    for i, x in enumerate(range(7, round(83 + d), 6)):
        if 12 <= x <= 22:
            continue
        petal, shade = PETUNIA_COLS[i % len(PETUNIA_COLS)]
        y = 17 + (i * 3) % 4
        g.ell(x + s, y, 2.2, 2, petal, shade)
        g.p(x + s, y, "yellow")
    # the blue ribbon on its stake: a rosette with a gold centre and two tails
    g.rect(17, 9, 1, 13, "dbrown")
    g.rect(16, 9, 1, 13, "brown")
    g.tri((14, 8), (17, 8), (13, 14), "blue")
    g.tri((17, 8), (20, 8), (21, 14), "blue")
    g.ell(17, 6, 4, 4, "sky", "blue", "cyan")
    g.ell(17, 6, 1.6, 1.6, "yellow")
    g.p(16, 5, "white")
    return lit(g)


PETUNIAS_IDLE = (0, 1, 0, -1), 450


# ---------- trash day ----------

def can(g, x, y, w, mouth):
    """A metal bin on its side, w long, 13 rows across, its open mouth at the left (mouth -1) or right (1)."""
    g.rect(x, y, w, 13, "lgrey")
    g.rect(x, y, w, 1, "white")
    g.rect(x, y + 10, w, 3, "grey")
    for k in range(4, w - 2, 6):
        g.rect(x + k, y + 1, 1, 11, "grey")
    end = x + w if mouth < 0 else x
    g.ell(end, y + 6.5, 2.5, 6.5, "grey", "slate")
    rim_x = x if mouth < 0 else x + w
    g.ell(rim_x, y + 6.5, 3, 7, "lgrey", "grey", "white")
    g.ell(rim_x - mouth * 0.5, y + 6.5, 1.8, 5.5, "ink")


def trash_bins(tail=0, new=Grid, w=88):
    """Two metal bins on their sides spilling between them; the lid lies in front with road.cat on it.
    tail is road.cat's tail step, 0 to 3. w is the width in drawing units: the right bin and its pizza box
    move left by what it is short of 88, the lid and the cat by half of it."""
    d = w - 88
    m = d / 2
    g = edged(new(w, 32))
    can(g, 5, 16, 19, 1)
    can(g, 67 + d, 16, 16, -1)
    # spilled out of the left bin: crumpled paper, a can, a banana peel
    g.ell(28, 26.5, 3, 2.5, "white", "lgrey")
    g.p(27, 26, "lgrey")
    g.rect(24, 25, 4, 4, "red")
    g.rect(24, 25, 4, 1, "pink")
    g.rect(26, 25, 2, 4, "dred")
    g.tri((29, 29), (33, 29), (30, 24), "yellow")
    g.tri((32, 29), (36, 29), (36, 25), "amber")
    g.rect(31, 28, 3, 1, "yellow")
    g.p(30, 29, "brown")
    # out of the right bin: a pizza box, its lid open behind a slice left in it
    g.rect(54 + d, 19, 12, 8, "tan")
    g.rect(54 + d, 19, 12, 1, "cream")
    g.rect(54 + d, 19, 1, 8, "cream")
    g.ell(60 + d, 23, 2, 1.5, "ochre")
    g.rect(53 + d, 27, 14, 2, "tan")
    g.rect(53 + d, 27, 14, 1, "cream")
    g.rect(53 + d, 28, 14, 1, "brown")
    g.tri((55 + d, 27), (64 + d, 27), (59 + d, 24.5), "amber")
    g.rect(55 + d, 26, 9, 1, "ochre")
    g.p(58 + d, 26, "red")
    g.p(61 + d, 25, "red")
    # the lid, then the cat sitting on it
    g.ell(43 + m, 27.5, 8.5, 2, "grey", "slate", "lgrey")
    g.rect(41 + m, 25, 4, 1, "slate")
    borrow(g, road.cat, 31 + m, 5, tail)
    return lit(g)


# road.cat's tail swing, a loop
TRASH_IDLE = (0, 1, 2, 1), 300


# ---------- café patio ----------

def patron(g, cx, hair, shirt, shade, skin, skin_shade):
    """A seated patron facing the player, cooing: eyes shut in happy arcs, an "o" mouth, blushing, hands
    clasped under the chin."""
    g.rect(cx - 7, 25, 14, 8, shirt)
    g.rect(cx + 4, 25, 3, 8, shade)
    road.face_disc(g, cx, 18, 7.5, 7.5, skin, skin_shade)
    g.ell(cx, 13.5, 8, 4, *hair)
    g.rect(cx - 8, 14, 2, 6, hair[0])
    g.rect(cx + 6, 14, 2, 6, hair[1])
    for ex in (cx - 5, cx + 2):
        g.p(ex, 19, "ink")
        g.p(ex + 1, 18, "ink")
        g.p(ex + 2, 19, "ink")
    g.rect(cx - 6, 21, 2, 1, "pink")
    g.rect(cx + 4, 21, 2, 1, "pink")
    g.rect(cx - 1, 22, 2, 2, "dbrown")
    g.rect(cx - 3, 26, 6, 3, skin)
    g.rect(cx, 26, 1, 3, skin_shade)


def cafe_patio(steam=0, new=Grid, w=88):
    """The awning hangs from a pole at each end over the two tables; the left patron's cup lies toppled in
    its spill with a foam heart floating in it, the right one's stands on a saucer. steam is the curl's
    step: it rises 1px a frame over a 4-row wave. w is the width in drawing units: the right pole, patron
    and table move left by what it is short of 88, the awning's ten stripes narrow to fit and the tables
    narrow so a gap stays between them."""
    d = w - 88
    g = edged(new(w, 40))
    for x in (3, 83 + d):
        g.rect(x, 3, 2, 35, "slate")
        g.rect(x, 3, 1, 35, "grey")
    patron(g, 24, ("amber", "orange", "yellow"), "pink", "mauve", "skin1", "skin2")
    patron(g, 64 + d, ("dbrown", "plum", "brown"), "sky", "blue", "skin2", "brown")
    # the awning: green and cream stripes over a scalloped edge
    sw = (80 + d) / 10
    for i in range(10):
        x = 4 + i * sw
        col, shade = ("green", "dgreen") if i % 2 == 0 else ("cream", "tan")
        g.rect(x, 3, sw, 4, col)
        g.rect(x, 5, sw, 2, shade)
        g.ell(x + sw / 2, 7, sw / 2, 2.5, col, shade)
    g.rect(2, 1, 84 + d, 2, "dgreen")
    g.rect(2, 3, 2, 4, "dgreen")
    g.rect(84 + d, 3, 2, 4, "dgreen")
    # the tables: a white top edge, a grey rim, a slate pedestal on a dslate foot
    half = min(11, round((40 + d) / 2) - 1)
    for cx in (24, 64 + d):
        g.rect(cx - half, 30, 2 * half, 1, "white")
        g.rect(cx - half, 31, 2 * half, 1, "lgrey")
        g.rect(cx - half + 1, 32, 2 * half - 2, 1, "grey")
        g.rect(cx - 1, 33, 3, 4, "slate")
        g.rect(cx - 5, 36, 11, 2, "dslate")
        g.rect(cx - 5, 36, 11, 1, "slate")
    # left: the cup on its side, latte spilled across the top and dripping off the edge, the foam heart in it
    g.rect(15, 29, 13, 1, "tan")
    g.rect(16, 31, 2, 3, "tan")
    g.p(16, 34, "brown")
    g.rect(28, 26, 6, 4, "white")
    g.rect(28, 29, 6, 1, "lgrey")
    g.rect(34, 27, 1, 2, "lgrey")
    g.rect(27, 27, 1, 2, "brown")
    g.ell(21.5, 27.5, 6.5, 2.5, "tan", "brown")
    heart(g, 19, 25, "white", "lgrey")
    # right: a cup on its saucer, and its steam curl
    g.rect(67 + d, 29, 9, 1, "lgrey")
    g.rect(69 + d, 25, 5, 4, "white")
    g.rect(73 + d, 25, 1, 4, "lgrey")
    g.rect(74 + d, 26, 2, 2, "lgrey")
    g.rect(69 + d, 25, 4, 1, "brown")
    k = int(steam)
    for j in range(5):
        y = 23 - j
        x = 72 + d + (0, 1, 0, -1)[(j + k) % 4]
        if (j + k) % 5 != 4:
            g.p(x, y, "white")
    return lit(g)


CAFE_IDLE = (0, 1, 2, 3), 350


# ---------- lemonade stand ----------

def lemonade_stand(bob=0, glint=False, new=Grid):
    """road.kid behind a cardboard stand, 3px lower than in kid.png so the sign over its head fits; bob is
    the kid's breath and glint the pitcher's."""
    g = edged(new(32, 48))
    # posts at the back corners and the sign nailed across them
    for x in (2, 28):
        g.rect(x, 1, 2, 32, "brown")
        g.rect(x, 1, 1, 32, "tan")
    borrow(g, road.kid, 0, 3, bob=bob)
    g.rect(3, 1, 26, 13, "cream")
    g.rect(3, 13, 26, 1, "tan")
    g.rect(3, 2, 26, 1, "white")
    letter(g, "yellow", (("LEMON", 6, 2), ("ADE", 9, 8)), clip=(3, 1, 28, 13))
    g.ell(25, 10.5, 2, 1.6, "yellow", "amber")
    # the counter, a pitcher and two paper cups on it
    g.rect(2, 31, 28, 2, "tan")
    g.rect(2, 32, 28, 1, "brown")
    g.rect(2, 23, 6, 8, "lgrey")
    g.rect(3, 25, 4, 6, "yellow")
    g.rect(3, 25, 4, 1, "white")
    g.rect(8, 25, 1, 4, "lgrey")
    g.p(5, 27, "amber")
    g.p(6, 29, "cream")
    g.rect(2, 22, 6, 1, "grey")
    if glint:
        g.p(3, 27, "white")
        g.p(3, 28, "white")
    for x in (22, 26):
        g.rect(x, 27, 4, 4, "white")
        g.rect(x, 27, 4, 1, "red")
        g.rect(x + 3, 28, 1, 3, "lgrey")
    # the box: cardboard, its flaps, "50c" with a lemon, and a drop beside a coin for the dogs' water (no
    # number, so the sign never disagrees with the tuned price)
    g.rect(0, 46, 32, 2, None)
    g.rect(2, 33, 28, 13, "tan")
    g.rect(2, 33, 28, 1, "cream")
    g.rect(27, 34, 3, 12, "brown")
    g.rect(2, 45, 28, 1, "brown")
    g.ell(6, 37.5, 2.5, 2, "yellow", "amber")
    g.p(8, 36, "green")
    letter(g, "yellow", (("50c", 11, 34),))
    g.tri((6, 40.4), (4.4, 43.2), (7.6, 43.2), "cyan")
    g.ell(6, 43.4, 1.6, 1.8, "cyan", "sky")
    g.ell(14, 43, 2, 2, "amber", "orange", "yellow")
    g.p(14, 43, "orange")
    return lit(g)


LEMONADE_IDLE = [dict(), dict(bob=-1), dict(glint=True), dict(bob=-1)], 400


# ---------- build ----------

def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite, then its depth variants. Each is
    drawn at BIG times its step, the 2-lane ones TWO_LANES wide in drawing units."""
    for suffix, step in (("", 1), *(("@" + k, v) for k, v in STEPS)):
        s = BIG * step
        new = mini(s)

        def snapped(q, keys):
            return {k: (v / s if k in keys and v else v) for k, v in q.items()}

        def idle(draw, spec, keys=(), **wide):
            args, ms = spec
            frames = [draw(**snapped(a, keys), new=new, **wide) if isinstance(a, dict) else draw(a, new=new, **wide)
                      for a in args]
            return [("idle", [f.outlined() for f in frames], ms)]

        yield f"picnic{suffix}", idle(picnic, PICNIC_IDLE, w=TWO_LANES, crown=PICNIC_CROWN.get(suffix, 0))
        yield f"goose{suffix}", [
            ("run", [goose(**snapped(q, GOOSE_OFFSETS), new=new).outlined() for q in GOOSE_RUN], 110),
            ("idle", [goose(**snapped(q, GOOSE_OFFSETS), new=new).outlined() for q in GOOSE_IDLE], 300)]
        yield f"petunias{suffix}", idle(petunias, PETUNIAS_IDLE, w=TWO_LANES)
        yield f"trash-bins{suffix}", idle(trash_bins, TRASH_IDLE, w=TWO_LANES)
        yield f"cafe-patio{suffix}", idle(cafe_patio, CAFE_IDLE, w=TWO_LANES)
        yield f"lemonade-stand{suffix}", idle(lemonade_stand, LEMONADE_IDLE, ("bob",))


if __name__ == "__main__":
    main(sys.argv, sprites, "art/encounters", __doc__, grounds=GROUNDS)
