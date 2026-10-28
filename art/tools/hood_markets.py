#!/usr/bin/env python3
"""Draw the Distillery District's and Kensington Market's own road art: their card obstacles with
the hit bursts, hit sounds and card illustrations that go with them, and their minor obstacles.

Distillery District:

cheese-crates       48x48   card obstacle, 1 lane, in Kensington Market too: a cheesemonger's slatted
                            crate set out at the shop door, two golden wheels stacked at the back left,
                            a cut wheel stood on its edge at the right showing its pale paste, a blue
                            cheese wedge in front and a chalk price tag hung on the crate. idle (4
                            frames, 350ms): three stink wisps rise a quarter wave a frame
wedding-shoot       112x72  card obstacle, 2 lanes: a bride posing in a white gown and veil with a
                            bouquet in the left lane; in the right lane a photographer in black
                            kneels facing her, a camera with a flash on top raised to his eye, a
                            silver reflector on a stand behind him. idle (4 frames, 400ms): the
                            bride breathes on frames 1 and 3, the flash fires on frame 2
velvet-rope         112x36  minor, 2 lanes: three brass stanchions on round bases, a red velvet rope
                            swagged between them. idle (4 frames, 400ms): a glint runs down the left
                            post's highlight on frames 2 and 3
patio-rail          176x36  minor, 3 lanes: a restaurant patio's low black iron rail between planter
                            boxes of red geraniums, a chalkboard menu on an A-frame at its middle,
                            two green bistro chairs showing over it. idle (4 frames, 400ms): a
                            geranium clump nods 1px at three spots in turn
rolling-barrel      48x48   minor dart, 1 lane: a whisky barrel on its side rolling across the lanes,
                            seen end-on, its dark oak head's staves and bung turning inside an iron hoop;
                            rolls right, the game mirrors it for left. idle (2 frames, 400ms):
                            resting, rocking 15 degrees; run (8 frames, 60ms): a full turn, 45
                            degrees a frame, a puff of dust kicked up behind it

Kensington Market:

fish-crates         48x48   card obstacle, 1 lane: a fishmonger's wooden crate tipped onto its side,
                            its open face to the camera, ice and fish spilling out across the road
                            in front of it: a silver fish left, a red snapper right. idle (4 frames,
                            350ms): the snapper flops, its tail flipping up on frame 2 and its head
                            on frame 3
produce-crates      48x48   minor, 1 lane: a pyramid of three wooden produce crates set down in the
                            road, tomatoes on top over bok choy and eggplants, with no awning, posts
                            or wheels. idle (4 frames, 400ms): a bok choy leaf lifts 1px on frame 2
clothing-rack       48x48   minor, 1 lane: a rolling rack of vintage clothes on chrome uprights and
                            casters: a mustard corduroy jacket, a lilac floral dress, a denim jacket
                            and a striped tee. idle (4 frames, 450ms): the dress sways 1px on frame 2
cargo-bike          48x72   minor mover, 1 lane by 2 rows: a cargo bike riding down a lane at the pack,
                            facing it: a wooden box of sunflowers, tulips and lilac out front over a
                            small front wheel, its rider behind in a rust beanie and a turquoise
                            jacket; the box hides the legs. ride (4 frames, 100ms): the rider sways
                            1px over the bars, the flowers jiggle and a tread line rolls down the tire

fx-hit-cheese-crates 77x77  play (8 frames, 70ms): a gold impact star, then a puff of lime stink
                            swelling up and shrinking away as the cut wheel bounces up out of it and
                            rolls off right, a quarter turn a frame, crumbs flying and wisps rising
fx-hit-wedding-shoot 77x77  play (8 frames, 70ms): a lilac impact star, then a camera flash flaring
                            and fading while the bouquet flies up out of it, tumbling, and petals
                            scatter and drift down
fx-hit-fish-crates  77x77   play (8 frames, 70ms): a shallow impact star, then a fish leaping up out
                            of a splash, flipping as it arcs over and falls, ice chips and drops
                            thrown out either side
sfx-hit-cheese-crates 0.39s a soft wooden thunk, a squish, then a rising plop that sags as it settles
sfx-hit-wedding-shoot 0.58s a flash charging up, the shutter's double click, then a triangle
                            "ding dong" of wedding bells
sfx-hit-fish-crates 0.46s   a wooden thunk, ice chips clattering, then two wet flops

Cards (75x56), one per option, composed from the sprites above and the pack's exports:
card-cheese-crates-sniff, -buy and -hurry-on at a brick shopfront's wooden door, which fits both the
neighbourhoods it stands in; card-wedding-shoot-pose, -walk-around and -reshoot on the Distillery
District's road; card-fish-crates-sniff, -pay and -hurry-past on Kensington Market's. The paid options
show a bill (icon-bill) changing hands: the photographer reaching out to take it, the fishmonger in a
white apron and the cheesemonger in an ochre shirt and white apron holding it up.

The road sprites take the road outline rule (pixel.road_edge) and road.LIT's rim on their dark
colours, so their silhouettes hold 3:1 on every road. People, movers and the card obstacles are laid
out on the 32-unit design grid (the wedding shoot on 224/3 x 48 units, two lanes) and drawn
road.SCALE (1.5) times bigger on a minis.Mini; the minor obstacles are laid out in obstacles.py's
layout pixels (40 for one lane, 30 rows for a lane-spanning one) and drawn obstacles.SCALE (1.2)
times bigger. Each has <key>@<step> for every depth step in minis.STEPS, redrawn the same way at
its scale times the step, with the original's tags, frames and durations and a full outline. 1px
motions are in drawn pixels, so they stay 1px at every step. The hit bursts follow hits.py: a
64-unit design drawn 77/64 times bigger, a plum rim round each part.

Usage:
  hood_markets.py preview OUT.png   every frame of every sprite on the zone roads
  hood_markets.py cards OUT.png     every card illustration inside its card frame, 3x
  hood_markets.py sounds OUT_DIR    write the sounds' .ogg and .m4a files into OUT_DIR only
  hood_markets.py build             write art/hood-markets/*.aseprite and export the sprites to
                                    public/art/sprites/, then the cards to public/art/images/
                                    (sources in art/cards/), then the sounds to
                                    public/art/sounds/

Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(__file__))
import hits  # noqa: E402
import minis  # noqa: E402
import obstacles as ob  # noqa: E402
import road  # noqa: E402
from minis import STEPS  # noqa: E402
from pixel import Grid, K, ZONE_ROADS, build as build_sprites, depth_settled, edged, preview  # noqa: E402
from pixel import raster, scale_of, to_image  # noqa: E402
from road import face_disc, face_front, lit  # noqa: E402

SRC = "art/hood-markets"
# People, movers and card obstacles are drawn PERSON times their design grid, minor obstacles OBSTACLE times
# their layout pixels.
PERSON = road.SCALE
OBSTACLE = ob.SCALE
# The cheese crate's key, which its hit burst's and option pictures' keys extend.
CHEESE = "cheese-crates"
# The wedding shoot's design width: two lanes, 112px at PERSON.
SHOOT_W = 224 / 3


def drawn(s, draw, *args, **q):
    """draw(*args, **q) on a minis.Mini at scale s."""
    return minis.small(sys.modules[__name__], s, draw, *args, **q)


def unit(g):
    """One drawn pixel in g's design units."""
    return 1 / scale_of(g)


def line(g, pts, w, c):
    """A stroke w design units square through the joints pts."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(1, round(max(abs(x1 - x0), abs(y1 - y0)) * 2))
        for k in range(n + 1):
            g.rect(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, w, w, c)


# ---------- the wedding shoot ----------

def bride(g, b):
    """The bride, centred on design column 16 of the left lane, facing the pack: a haze veil falling behind
    her to the waist, a white A-line gown shaded lgrey down its right to the hem, her arms in to a bouquet of
    pink, red and cream roses at the waist, her dbrown hair up in a bun under a white tiara. b lifts her
    body (negative is up); the hem stays on the ground."""
    g.tri((16, 4 + b), (4, 33 + b), (28, 33 + b), "haze")
    g.tri((16, 20 + b), (3, 45), (29, 45), "white")
    g.tri((16, 20 + b), (22, 45), (29, 45), "lgrey")
    g.rect(4, 44, 25, 1, "lgrey")
    g.rect(10, 20 + b, 12, 10, "white")
    g.rect(19, 20 + b, 3, 10, "lgrey")
    g.rect(11, 29 + b, 10, 1, "haze")
    # bare shoulders and arms, bent in to the bouquet
    line(g, [(8, 21 + b), (8, 26 + b), (11, 29 + b)], 2.5, "skin1")
    line(g, [(21.5, 21 + b), (21.5, 26 + b), (18.5, 29 + b)], 2.5, "skin1")
    g.rect(22.5, 21 + b, 1, 5, "skin2")
    for x, y, c, sh in ((13, 30, "pink", "mauve"), (16, 29, "red", "dred"), (19, 30, "pink", "mauve"),
                        (14.5, 32.5, "cream", "tan"), (17.5, 32.5, "red", "dred")):
        g.cel(x, y + b, 2, 2, c, sh)
    g.rect(15, 34 + b, 2, 3, "canopy")
    # the head: the neck, the face, hair over the crown, the bun and the tiara
    g.rect(14, 19 + b, 4, 2, "skin1")
    face_disc(g, 16, 12.5 + b, 7.5, 7.5, "skin1", "skin2")
    g.cel(16, 7.5 + b, 8.5, 4, "dbrown", "plum", "brown")
    g.rect(8, 8 + b, 2, 6, "dbrown")
    g.rect(22, 8 + b, 2, 6, "dbrown")
    g.cel(16, 3 + b, 3, 2.5, "dbrown", "plum", "brown")
    for x in (12, 14, 16, 18, 20):
        g.p(x, 5 + b - (1 if x == 16 else 0), "white")
    face_front(g, 16, 13 + b, lips="red")
    g.p(10, 16 + b, "pink")
    g.p(22, 16 + b, "pink")


def photographer(g, pay=False):
    """The photographer, kneeling on his right knee in the right lane and facing left at the bride: black
    shirt and slate trousers, lighter than the dslate road so his legs never sink into it, rust hair, a
    black camera raised to his eye, its grey lens pointing left with a sky glint, a white flash on the hot
    shoe on top. pay, for the reshoot card, lowers his near arm from the camera and reaches it out low in
    front of him, the hand open."""
    # the knee on the ground, the shin back along it, the shoe's toes tucked under
    line(g, [(60, 35), (64, 41)], 4, "slate")
    g.rect(63, 42, 7, 3, "slate")
    g.rect(63, 44, 7, 1, "dslate")
    g.rect(69, 41, 3, 4, "ink")
    # the raised knee: the thigh forward, the shin down to the shoe, toes pointing at the bride
    g.rect(48, 33, 12, 4, "slate")
    g.rect(48, 33, 4, 10, "slate")
    g.rect(51, 37, 1, 6, "dslate")
    g.rect(45, 43, 7, 2, "ink")
    # the torso, upright, leaning a little forward
    g.rect(53, 23, 10, 12, "ink")
    g.tri((52, 25), (53, 23), (53, 35), "ink")
    g.rect(53, 34, 10, 1, "navy")
    # the far arm up to the camera's grip
    line(g, [(55, 25), (53, 28), (52, 22)], 3, "ink")
    # the head in profile: the neck, the face, hair over the crown and the back, an ear
    g.rect(56, 20, 4, 4, "skin2")
    g.cel(57.5, 15.5, 6.5, 6.5, "skin2", "brown")
    g.cel(59.5, 11.5, 6.5, 3.5, "rust", "dbrown", "ochre")
    g.rect(61.5, 11.5, 3.5, 8, "rust")
    g.rect(64, 12.5, 1, 6, "dbrown")
    g.rect(59.5, 14.5, 1.5, 3, "brown")
    g.rect(55, 10.5, 4, 1, "rust")
    # the camera: body, lens and its glass, the flash on top
    g.rect(47, 14, 9, 7, "ink")
    g.rect(47, 14, 9, 1, "slate")
    g.rect(41, 15, 6, 5, "grey")
    g.rect(41, 15, 6, 1, "lgrey")
    g.rect(41, 19, 6, 1, "slate")
    g.rect(40, 15.5, 1, 4, "ink")
    g.rect(39, 16, 1, 3, "sky")
    g.rect(49, 13, 3, 1, "ink")
    g.rect(48, 9, 5, 4, "white")
    g.rect(52, 9, 1, 4, "lgrey")
    g.rect(48, 12, 5, 1, "lgrey")
    g.rect(55, 16, 2, 4, "skin2")
    if pay:
        # the near arm lowered from the camera and reached out low in front of him, the hand taking the fee
        line(g, [(58, 24), (53, 31), (41, 32)], 3, "ink")
        g.rect(38, 31, 3, 3, "skin2")
        return
    # the near arm: the sleeve from the shoulder to the elbow, the forearm up to the hand under the lens
    line(g, [(58, 24), (54, 29), (48, 23)], 3, "ink")
    g.rect(45, 20, 4, 2.5, "skin2")


def reflector(g):
    """A silver reflector on a light stand behind the photographer, tilted at the bride: an oval disc, white
    lit lgrey down its right with a grey rim, on a slate pole and three legs."""
    g.rect(69, 19, 1, 23, "slate")
    line(g, [(69, 41), (66, 45)], 1, "slate")
    line(g, [(69, 41), (73, 45)], 1, "slate")
    g.cel(69.5, 11, 4, 8, "lgrey", "grey")
    g.cel(68.8, 10.5, 2.6, 6.5, "white", "lgrey")


SHOOT_PARTS = ("bride", "photographer", "reflector")


def wedding_shoot(bob=0, flash=False, parts=SHOOT_PARTS, pay=False):
    """The shoot across two lanes, laid out on SHOOT_W x 48 and drawn at PERSON to 112x72. bob is the
    bride's breath in drawn pixels; flash fires the flash: a white star, its arms tipped yellow, with
    yellow diagonals, flaring off the flash head. parts picks which figures to draw (the cards use them one at
    a time), and pay draws the photographer's pay pose."""
    g = edged(Grid(SHOOT_W, 48))
    u = unit(g)
    if "reflector" in parts:
        reflector(g)
    if "photographer" in parts:
        photographer(g, pay)
    if "bride" in parts:
        bride(g, bob * u)
    lit(g, dict(slate=("lgrey", None)))
    if flash and "photographer" in parts:
        px, s = raster(g), scale_of(g)
        cx, cy = math.floor(47.5 * s), math.floor(9.5 * s)
        r = max(3, round(6 * s))
        for k in range(-r, r + 1):
            for x, y in ((cx + k, cy), (cx, cy + k)):
                px.p(x, y, "yellow" if abs(k) > r // 2 else "white")
        for k in range(1, max(2, r // 2) + 1):
            for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
                px.p(cx + dx * k, cy + dy * k, "yellow")
        px.rect(cx - 1, cy - 1, 3, 3, "white")
    return g


# The breath and the flash: rest, the bride 1px up, the flash, the bride 1px up again.
SHOOT_IDLE = (dict(), dict(bob=-1), dict(flash=True), dict(bob=-1)), 400


# ---------- the velvet rope ----------

def velvet_rope(glint=None, w=ob.span(2)):
    """Front elevation, 2 lanes: three brass stanchions, gold lit yellow down their left and shaded ochre
    down their right, each on a round base under a ball knob, and a red velvet rope swagged between each pair,
    shaded dred along its lower edge and lit pink along its top, hooked on under the knobs. glint is the
    layout row on the left post's highlight that flashes white, or None."""
    g = edged(Grid(w, ob.ROW))
    posts = (6, w / 2 - 2, w - 10)
    px, s = raster(g), scale_of(g)
    thick = max(2, round(3 * s))
    # the rope, drawn column by column on the drawn grid so it keeps an even thickness along its swag
    for a, b in zip(posts, posts[1:]):
        x0, x1 = math.floor((a + 3) * s), math.ceil((b + 1) * s)
        for x in range(x0, x1):
            t = (x + 0.5 - x0) / (x1 - x0)
            y = math.floor((8.5 + 9 * 4 * t * (1 - t)) * s)
            for k in range(thick):
                px.p(x, y + k, "pink" if k == 0 and 0.12 < t < 0.88 else "dred" if k == thick - 1 else "red")
    for x in posts:
        g.cel(x + 2, 27.5, 6, 2, "ochre", "brown", "gold")
        g.rect(x, 6, 4, 21, "gold")
        g.rect(x + 3, 6, 1, 21, "ochre")
        g.rect(x, 6, 1, 21, "yellow")
        g.rect(x - 1, 8, 6, 2, "ochre")
        g.cel(x + 2, 4.5, 3, 2.5, "gold", "ochre", "yellow")
    if glint is not None:
        px.rect(math.floor(6 * s), math.floor(glint * s), 1, max(1, round(2 * s)), "white")
    return lit(g)


VELVET_IDLE = (None, None, 12, 19), 400


# ---------- the patio rail ----------

def patio_rail(nod=(), w=ob.span(3)):
    """Front elevation, 3 lanes: a low wrought-iron rail in coal, lit grey along its top and down each
    2px picket's left, between planter boxes of geraniums at each end; a chalkboard menu on a bark A-frame at
    the middle with chalk lines on it, and the backs of two green bistro chairs over the rail. nod lists the
    geranium clumps, by index, that dip 1px."""
    g = edged(Grid(w, ob.ROW))
    u = unit(g)
    # the chairs' backs, behind the rail: two uprights and two hoops each
    for x in (w * 0.3, w * 0.7):
        g.cel(x, 6, 6, 4, "forest")
        g.cel(x, 6.5, 4, 2.5, None)
        g.rect(x - 6, 6, 2, 7, "forest")
        g.rect(x + 4, 6, 2, 7, "forest")
        g.rect(x - 4, 8, 8, 1, "forest")
    # the rail: a top bar and a bottom bar with pickets between
    g.rect(2, 12, w - 4, 2, "coal")
    g.rect(2, 12, w - 4, 1, "ash")
    for x in range(28, round(w) - 28, 5):
        g.rect(x, 14, 2, 11, "coal")
    g.rect(2, 25, w - 4, 2, "coal")
    g.rect(2, 25, w - 4, 1, "ash")
    # the planters, lit clay along the top and left, the geraniums heaped over them
    k = 0
    for x in (2, w - 26):
        g.rect(x, 14, 24, 14, "clay")
        g.rect(x + 20, 14, 4, 14, "bark")
        g.rect(x, 14, 24, 1, "driftwood")
        g.rect(x, 27, 24, 1, "bark")
        g.rect(x + 3, 18, 15, 1, "bark")
        for i in range(5):
            dy = u if k in nod else 0
            g.cel(x + 3 + i * 4.5, 11.5 + (i % 2) * 0.5 + dy, 3, 3, "canopy", "pine", "green")
            k += 1
        for i in range(5):
            dy = u if i + (0 if x == 2 else 5) in nod else 0
            c = "red" if i % 2 == 0 else "pink"
            g.rect(x + 2 + i * 4.5, 8.5 + (i % 2) + dy, 2, 2, c)
            g.p(x + 3 + i * 4.5, 10.5 + (i % 2) + dy, "dred")
    # the chalkboard menu on its A-frame
    c = w / 2
    g.tri((c - 9, 28), (c - 6, 28), (c - 1, 3), "bark")
    g.tri((c + 6, 28), (c + 9, 28), (c + 1, 3), "bark")
    g.rect(c - 1, 2, 2, 3, "bark")
    g.rect(c - 7, 7, 14, 16, "clay")
    g.rect(c - 6, 8, 12, 14, "coal")
    for y, ln in ((10, 8), (13, 6), (16, 9), (19, 5)):
        g.rect(c - 4, y, ln, 1, "lgrey")
    g.rect(c + 3, 13, 2, 1, "pink")
    g.rect(c + 2, 19, 2, 1, "gold")
    return lit(g, dict(coal=("grey", None), bark=("clay", None), clay=("driftwood", None),
                       canopy=("green", None), pine=("green", None)))


PATIO_IDLE = ((), (), (1, 6), (3, 8)), 400


# ---------- the rolling barrel ----------

def rolling_barrel(turn=0.0, dust=None, rock=0.0):
    """A whisky barrel on its side, seen end-on: an ash iron hoop lit grey on its upper left and shaded
    slate on its lower right, the chime's dbrown ring inside it, and the brown head with its dbrown stave
    seams and a walnut bung, dark oak with no gold or orange so it never reads as a coin, turned turn
    degrees clockwise. dust (0 or 1) kicks up a puff of driftwood dust behind it on the left, low on the
    ground, in one of two shapes. rock turns the bung alone that many degrees, the seams held still. Laid out
    on the 32-unit grid; the head is drawn pixel for pixel at the grid's scale so its seams stay 1px at any
    angle."""
    g = edged(Grid(32, 32))
    px, s = raster(g), scale_of(g)
    cx, cy, r = 16 * s, 16.5 * s, 12 * s
    a = math.radians(turn)
    gap = max(3, round(3.3 * s))
    b = a + math.radians(rock)
    bung = (cx + math.cos(b - math.pi / 2) * 0.55 * r, cy + math.sin(b - math.pi / 2) * 0.55 * r)
    for y in range(px.h):
        for x in range(px.w):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            if d > r:
                continue
            light = (dx + dy) / max(d, 1e-9)
            if d > r - max(2, 2.2 * s):
                c = "grey" if light < -0.6 else "slate" if light > 0.5 else "ash"
            elif d > r - max(3, 3.6 * s):
                c = "bark" if light > 0.5 else "dbrown"
            else:
                along = dx * math.cos(a) + dy * math.sin(a)
                c = "dbrown" if math.floor(along) % gap == 0 else "brown"
                if math.hypot(x + 0.5 - bung[0], y + 0.5 - bung[1]) < max(1.2, 1.4 * s):
                    c = "walnut"
            px.p(x, y, c)
    if dust is not None:
        for x, y, rx, ry in (((6, 28, 2.6, 2), (4.5, 25, 1.4, 1.3)),
                             ((5.5, 27.5, 2.2, 2.2), (7, 24.5, 1.3, 1.1)))[dust]:
            g.cel(x, y, rx, ry, "driftwood", "stone", "cream")
    return g


# Resting, then the bung rocked 15 degrees; the roll, a full turn clockwise, 45 degrees a frame, the dust in two shapes.
BARREL_IDLE = ((0,), (15,)), 400
BARREL_RUN = tuple((k * 45, k % 2) for k in range(8)), 60


# ---------- the fish crate spill ----------

def fish(g, x, y, length, back, belly, flip=False, tail=0.0, head=0.0, eye="ink"):
    """A fish lying on its side, x to x + length along row y: back over belly, a forked tail at the left
    (right when flip) and an eye at the head end. tail and head lift those ends that many design units."""
    d = -1 if flip else 1
    mid = x + length / 2
    g.cel(mid, y, length / 2 - 1, 1.8, back)
    g.rect(mid - length / 2 + 2, y + 0.5, length - 4, 1.2, belly)
    tx = x if not flip else x + length
    g.tri((tx + d * 2, y - tail), (tx - d * 1, y - 2.2 - tail), (tx - d * 1, y + 1.5 - tail), back)
    hx = x + length - 2 if not flip else x + 2
    g.cel(hx, y - head * 0.5, 1.6, 1.6, back)
    g.p(hx + d * 0.5, y - 0.8 - head, eye)


def fish_crates(flop=0):
    """A fishmonger's crate tipped onto its side, its open face to the camera, on the 32-unit grid: the
    tan rim lit cream on its upper left and shaded brown, the bark inside with walnut slat gaps, ice and a
    silver fish still in it; in front, ice chips (white, shaded foam) spilt across the road with a silver
    fish lying at the left and a red snapper at the right. flop 1 flips the snapper's tail up 1px, 2 its
    head."""
    g = edged(Grid(32, 32))
    u = unit(g)
    # the crate, open face toward us, wider than it is deep
    g.rect(4, 9, 24, 17, "tan")
    g.rect(4, 9, 24, 1, "cream")
    g.rect(4, 9, 1, 17, "cream")
    g.rect(26, 10, 2, 16, "brown")
    g.rect(6, 11, 20, 13, "bark")
    for y in (15, 19):
        g.rect(6, y, 20, 1, "walnut")
    g.rect(6, 11, 20, 1, "walnut")
    for x in (4, 15, 26):
        g.rect(x + (1 if x == 4 else 0), 10, 1, 1, "brown")
    # the ice heaped in it, a mound of crushed ice shaded foam with a few chunks' edges in it, and a fish
    # still lying on top
    g.cel(16, 22, 10, 3.5, "white", "foam")
    g.rect(6, 22, 20, 2, "white")
    for x, y in ((9, 20), (14, 19.5), (20, 20), (11, 22.5), (17, 22.5), (23, 22.5)):
        g.rect(x, y, 2, 1, "foam")
        g.rect(x + 2, y - 1, 1, 1, "foam")
    fish(g, 9, 17.5, 12, "grey", "lgrey", flip=True)
    # the spill across the road in front: ice chips under the fish
    g.cel(16, 27.5, 13, 2.6, "white", "lgrey")
    for x, y, w, h in ((1, 27, 2, 2), (29, 26.5, 2, 2), (6, 24.5, 2.5, 2), (22, 24.5, 3, 2)):
        g.rect(x, y, w, h, "white")
        g.rect(x + w - 1, y + 1, 1, h - 1, "lgrey")
    fish(g, 2, 25, 12, "slate", "lgrey", eye="ink")
    t = (0, u, 0)[flop]
    h = (0, 0, u)[flop]
    fish(g, 17, 24, 13, "red", "pink", flip=True, tail=t, head=h)
    return lit(g, dict(bark=("clay", None), walnut=("bark", None)))


FISH_IDLE = (0, 0, 1, 2), 350


# ---------- the cheese crate ----------

def cheese_wheel(g, cx, cy, r, turn=0.0, cut=True):
    """A cheese wheel stood on its edge, seen face on round design point cx, cy, r design units across the
    middle: a gold rind ring shaded amber on its lower right and lit yellow on its upper left round pale cream
    paste with three tan holes, and with cut a wedge cut out of it to the centre, turned turn degrees
    clockwise from straight up. Drawn pixel for pixel at the grid's scale, so it keeps its shape at any
    angle."""
    px, s = raster(g), scale_of(g)
    ox, oy, rr = cx * s, cy * s, r * s
    a0 = math.radians(turn - 90)
    rind = max(1, round(1.3 * s))
    holes = [(ox + math.cos(a0 + math.radians(d)) * rr * k, oy + math.sin(a0 + math.radians(d)) * rr * k)
             for d, k in ((130, 0.5), (215, 0.45), (290, 0.55))]
    for y in range(px.h):
        for x in range(px.w):
            dx, dy = x + 0.5 - ox, y + 0.5 - oy
            d = math.hypot(dx, dy)
            if d > rr:
                continue
            ang = (math.degrees(math.atan2(dy, dx)) - turn + 90) % 360
            if cut and d > 0.5 and ang < 50:
                continue
            light = (dx + dy) / max(d, 1e-9)
            if d > rr - rind:
                c = "yellow" if light < -0.7 else "amber" if light > 0.5 else "gold"
            else:
                c = "cream"
                for hx, hy in holes:
                    if math.hypot(x + 0.5 - hx, y + 0.5 - hy) < max(0.8, 0.12 * rr):
                        c = "tan"
            px.p(x, y, c)


def blue_wedge(g, x, y, w, h):
    """A wedge of blue cheese lying on its side, x, y to x + w, y + h in design units: its white paste shaded
    lgrey along the bottom, blue veins speckled through it, its rind a cream strip down the tall back end on
    the left, the point at the right."""
    g.tri((x, y), (x, y + h), (x + w, y + h), "white")
    g.rect(x, y + h - 1, w, 1, "lgrey")
    g.rect(x, y, 1.5, h, "cream")
    for vx, vy in ((0.2, 0.35), (0.35, 0.7), (0.15, 0.75), (0.55, 0.8), (0.28, 0.5), (0.75, 0.88)):
        g.p(x + w * vx, y + h * vy, "blue")
    for vx, vy in ((0.4, 0.62), (0.2, 0.58), (0.62, 0.72)):
        g.p(x + w * vx, y + h * vy, "sky")


def stink_wisps(g, phase, xs=(9, 17, 25), top=1, bottom=9):
    """Wavy stink lines in drawn pixels, 1px wide, lime with every third pixel moss, rising from design row
    bottom to row top at each design column in xs; phase (0 to 3) moves the wave up a quarter period, so the
    frames in turn make the lines rise."""
    px, s = raster(g), scale_of(g)
    period = max(4, round(4 * s))
    for i, cx in enumerate(xs):
        y0, y1 = math.floor((top + (i % 2)) * s), math.floor(bottom * s)
        for y in range(y0, y1):
            k = (y + phase * period // 4 + i * period // 2) % period
            dx = (0, 1, 1, 0, 0, -1, -1, 0)[k * 8 // period]
            px.p(math.floor(cx * s) + dx, y, "moss" if (y - y0) % 3 == 2 else "lime")


def cheese_crates(phase=0):
    """A cheesemonger's slatted wooden crate set out at the shop door, on the 32-unit grid: a stack of two
    whole golden wheels (gold tops lit yellow, amber rinds) at the back left, a cut wheel stood on its edge at
    the right showing its pale paste, and a wedge of blue cheese lying in front; a small chalk price tag hung on
    the crate's front, and stink wisps rising off the cheese. phase (0 to 3) moves the wisps up."""
    g = edged(Grid(32, 32))
    stink_wisps(g, phase)
    # the whole wheels, stacked flat: each a side band of rind, a dark seam under it, under a lit top
    for top in (10, 14.5):
        g.rect(3.5, top, 11, 4, "amber")
        g.rect(3.5, top + 3.5, 11, 1, "orange")
        g.rect(12.5, top, 2, 4, "orange")
        g.cel(9, top, 5.5, 2, "gold", None, "yellow")
    cheese_wheel(g, 22, 12, 6.5, turn=35)
    blue_wedge(g, 8.5, 12.5, 13, 7)
    crate(g, 3, 19, 26, 12)
    # the chalk price tag on its string, hung from the crate's rim, two lines of chalk writing on it
    g.rect(20.5, 19, 1, 2, "cream")
    g.rect(17, 21, 8, 5, "coal")
    g.rect(18.5, 22.3, 5, 0.7, "white")
    g.rect(18.5, 24, 3, 0.7, "lgrey")
    return lit(g, dict(coal=("grey", None)))


# The wisps rise a quarter wave a frame.
CHEESE_IDLE = (0, 1, 2, 3), 350


# ---------- the produce crates ----------

def crate(g, x, y, w, h):
    """A slatted wooden crate's front, x, y to x + w, y + h in layout pixels: tan lit cream on its top and
    left, shaded brown down its right, a brown seam between its two slats."""
    g.rect(x, y, w, h, "tan")
    g.rect(x, y, w, 1, "cream")
    g.rect(x, y, 1, h, "cream")
    g.rect(x + w - 2, y + 1, 2, h - 1, "brown")
    g.rect(x + 1, y + h // 2, w - 3, 1, "brown")
    g.rect(x, y + h - 1, w, 1, "brown")


def produce_crates(leaf=0):
    """A pyramid of three produce crates set down in a lane, laid out on 40x40: two crates side by side on
    the road, bok choy heaped in the left (lime leaves, moss stems) and glossy eggplants in the right
    (violet, lit lilac), and a third crate on top heaped with tomatoes (red, lit pink, green tops). leaf 1
    lifts a bok choy leaf 1px."""
    g = edged(Grid(ob.SIZE, ob.SIZE))
    u = unit(g)
    # bok choy over the left crate, eggplants over the right
    for i, x in enumerate((6, 10, 14)):
        dy = -u if leaf and i == 0 else 0
        g.cel(x, 22 + dy, 3, 3.5, "lime", "green", "white")
        g.rect(x - 0.5, 23, 1, 4, "moss")
    for x, y in ((24, 23), (28.5, 22.5), (33, 23)):
        g.cel(x, y, 2.6, 3.2, "violet", "purple", "lilac")
        g.rect(x - 1, y - 3.5, 2, 1, "dgreen")
    crate(g, 3, 25, 16, 12)
    crate(g, 21, 25, 16, 12)
    # the tomatoes over the top crate
    for x, y in ((15, 13), (19, 12), (23, 13), (17, 15), (21, 15), (25, 15), (14, 15.5)):
        g.cel(x, y, 2.2, 2.2, "red", "dred", "pink")
        g.p(x, y - 2, "dgreen")
    crate(g, 12, 16, 16, 10)
    return lit(g)


PRODUCE_IDLE = (0, 0, 1, 0), 400


# ---------- the clothing rack ----------

def clothing_rack(sway=0):
    """A rolling rack of vintage clothes, laid out on 40x40: chrome uprights (lgrey lit white, grey on
    the right) on splayed feet over ink casters, a bar across the top with the hangers' hooks over it, and
    four garments hung overlapping: a mustard corduroy jacket (ochre, amber wales), a lilac floral dress
    (pink and white dots), a denim jacket (sky, shaded blue, white stitching) and a turquoise and cream
    striped tee. sway 1 swings the dress's hem 1px right."""
    g = edged(Grid(ob.SIZE, ob.SIZE))
    u = unit(g)
    # uprights, feet and casters
    for x in (3, 35):
        g.rect(x, 3, 2, 31, "lgrey")
        g.rect(x + 1, 3, 1, 31, "grey")
        g.rect(x - 2, 33, 6, 2, "grey")
        g.rect(x - 2, 33, 6, 1, "lgrey")
        for cx in (x - 2, x + 3):
            g.rect(cx, 35, 2, 2, "ink")
    g.rect(3, 3, 34, 2, "lgrey")
    g.rect(3, 4, 34, 1, "grey")
    for x in (9, 16, 24, 31):
        g.rect(x, 1, 1, 2, "grey")
        g.p(x + 1, 1, "grey")
    # the corduroy jacket
    g.tri((5, 5), (13, 5), (9, 3), "ochre")
    g.rect(5, 5, 9, 21, "ochre")
    for x in (6, 8, 10, 12):
        g.rect(x, 9, 1, 16, "amber")
    g.tri((7, 5), (9, 5), (9, 12), "brown")
    g.tri((11, 5), (9, 5), (9, 12), "rust")
    # the floral dress, its skirt flaring to the hem
    s = sway * u
    g.rect(13, 5, 7, 9, "lilac")
    g.tri((13, 14), (20, 14), (11 + s, 30), "lilac")
    g.tri((20, 14), (11 + s, 30), (22 + s, 30), "lilac")
    g.tri((18, 14), (20, 14), (22 + s, 30), "violet")
    for x, y, c in ((14, 7, "pink"), (17, 10, "white"), (15, 17, "pink"), (18, 21, "white"), (14 + s, 25, "white"),
                    (19 + s, 27, "pink"), (16, 13, "pink")):
        g.p(x, y, c)
    g.rect(13, 13, 7, 1, "violet")
    # the denim jacket
    g.rect(20, 5, 9, 18, "sky")
    g.rect(27, 6, 2, 17, "blue")
    g.tri((22, 5), (24.5, 5), (24.5, 11), "blue")
    g.rect(24.5, 11, 1, 12, "blue")
    g.rect(21, 15, 7, 1, "cyan")
    g.rect(21, 22, 8, 1, "blue")
    # the striped tee
    g.rect(28, 5, 7, 14, "cream")
    for y in range(6, 19, 3):
        g.rect(28, y, 7, 1, "dturq")
    g.rect(28, 5, 7, 1, "turquoise")
    return lit(g, dict(lilac=("pink", None), violet=("lilac", None), dturq=("turquoise", None)))


RACK_IDLE = (0, 0, 1, 0), 450


# ---------- the cargo bike ----------

FLOWERS = ((7.5, 25, "yellow", "amber", "dbrown"), (12, 23, "pink", "mauve", "red"),
           (16.5, 24, "lilac", "violet", "violet"), (21, 23, "yellow", "amber", "dbrown"),
           (25, 25, "pink", "mauve", "red"), (10, 26.5, "red", "dred", "dred"), (19, 26.5, "lilac", "violet", "violet"))


def cargo_bike(sway=0, jiggle=0, roll=0):
    """A cargo bike riding down a lane at the pack, facing it, laid out on 32x48: the small front wheel
    edge-on under a wide wooden box (tan slats lit cream, shaded brown) full of flowers, sunflowers, tulips
    and lilac over green leaves; behind it the rider in a turquoise jacket with a rust beanie and an ochre
    pompom, dark curls showing under it, hands on the wide handlebar. sway shifts the rider 1 drawn pixel
    over the bars; jiggle lifts alternate flowers 1px; roll (0 to 3) rolls a grey tread line down the tire."""
    g = edged(Grid(32, 48))
    u = unit(g)
    w = sway * u
    # the front wheel under the box, its fork and a tread line rolling down it
    g.blob(16, 42, 2.5, 4.5, "ink")
    g.rect(15.5, 37.5, 1, 4, "lgrey")
    px, s = raster(g), scale_of(g)
    top, bottom = math.floor(39 * s), math.floor(46 * s)
    period = max(3, round(4 * s))
    for y in range(top, bottom):
        if (y - top - roll) % period == 0:
            for x in range(math.floor(15 * s), math.ceil(17 * s)):
                if px.px[y][x] == K["ink"]:
                    px.p(x, y, "slate")
    # the rider: jacket, arms out to the grips, head under the beanie
    g.rect(10 + w, 15, 12, 10, "turquoise")
    g.rect(19 + w, 15, 3, 10, "dturq")
    g.rect(15.5 + w, 16, 1, 8, "dturq")
    line(g, [(9 + w, 16), (6, 20)], 3, "turquoise")
    line(g, [(21 + w, 16), (24, 20)], 3, "dturq")
    g.rect(4, 21, 24, 1.5, "grey")
    g.rect(4, 21, 24, 0.5, "lgrey")
    for x in (2, 27):
        g.rect(x, 20.5, 3, 2.5, "ink")
    g.rect(4, 19.5, 3, 2, "skin2")
    g.rect(25, 19.5, 3, 2, "skin2")
    g.rect(14 + w, 13, 4, 2, "skin2")
    g.rect(8.5 + w, 7, 3, 6, "dbrown")
    g.rect(20.5 + w, 7, 3, 6, "dbrown")
    face_disc(g, 16 + w, 9.5, 6.5, 5.5, "skin2", "brown")
    g.cel(16 + w, 6, 7.5, 4.5, "rust", "dbrown", "ochre")
    g.rect(8.5 + w, 6.5, 15, 1.5, "rust")
    g.rect(8.5 + w, 7.5, 15, 1, "dbrown")
    g.cel(16 + w, 1.6, 2, 1.6, "ochre", "brown", "tan")
    face_front(g, 16 + w, 9.5, eyes="ink", lips="plum")
    # the leaves and flowers heaped in the box
    for x in range(6, 27, 3):
        g.cel(x, 27, 2.2, 2, "canopy", "pine", "green")
    for i, (x, y, c, sh, mid) in enumerate(FLOWERS):
        dy = -u if jiggle and i % 2 == jiggle - 1 else 0
        g.cel(x, y + dy, 2.2, 2, c, sh)
        g.p(x, y + dy, mid)
    # the box: its slatted front, lit along the top and left, shaded down the right
    g.rect(4, 28, 24, 10, "tan")
    g.rect(4, 28, 24, 1, "cream")
    g.rect(4, 28, 1, 10, "cream")
    g.rect(26, 29, 2, 9, "brown")
    g.rect(5, 32, 21, 1, "brown")
    g.rect(4, 37, 24, 1, "brown")
    return lit(g, dict(dturq=("turquoise", None)))


CARGO_RIDE = (dict(sway=-1, jiggle=1, roll=0), dict(roll=1), dict(sway=1, jiggle=2, roll=2), dict(roll=3)), 100


# ---------- sprites ----------

def frames(s, draw, poses):
    """draw(**pose) on a Mini at s for each pose, outlined."""
    return [drawn(s, draw, **q).outlined() for q in poses]


def road_sprites(s=1):
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every road sprite at depth step s: people,
    movers and the card obstacles drawn at PERSON x s, the minor obstacles at OBSTACLE x s."""
    p, o = PERSON * s, OBSTACLE * s
    poses, ms = SHOOT_IDLE
    yield "wedding-shoot", [("idle", frames(p, wedding_shoot, poses), ms)]
    args, ms = VELVET_IDLE
    yield "velvet-rope", [("idle", frames(o, velvet_rope, [dict(glint=a) for a in args]), ms)]
    args, ms = PATIO_IDLE
    yield "patio-rail", [("idle", frames(o, patio_rail, [dict(nod=a) for a in args]), ms)]
    idle, idle_ms = BARREL_IDLE
    run, run_ms = BARREL_RUN
    yield "rolling-barrel", [("idle", frames(p, rolling_barrel, [dict(rock=a) for a, in idle]), idle_ms),
                             ("run", frames(p, rolling_barrel, [dict(turn=a, dust=d) for a, d in run]), run_ms)]
    args, ms = FISH_IDLE
    yield "fish-crates", [("idle", frames(p, fish_crates, [dict(flop=a) for a in args]), ms)]
    args, ms = CHEESE_IDLE
    yield CHEESE, [("idle", frames(p, cheese_crates, [dict(phase=a) for a in args]), ms)]
    args, ms = PRODUCE_IDLE
    yield "produce-crates", [("idle", frames(o, produce_crates, [dict(leaf=a) for a in args]), ms)]
    args, ms = RACK_IDLE
    yield "clothing-rack", [("idle", frames(o, clothing_rack, [dict(sway=a) for a in args]), ms)]
    poses, ms = CARGO_RIDE
    yield "cargo-bike", [("ride", frames(p, cargo_bike, poses), ms)]


# ---------- hit bursts ----------

PETALS = ((-1.0, -0.9, "pink"), (1.0, -1.0, "white"), (-1.3, -0.2, "red"), (1.3, -0.3, "pink"),
          (-0.6, -1.3, "white"), (0.7, -1.4, "red"), (-1.2, 0.5, "pink"), (1.2, 0.4, "white"))


def bouquet(g, cx, cy, tilt):
    """The bride's bouquet, 9x10 design units round cx, cy: five roses over green stems, tilted tilt (-1, 0,
    1) as it tumbles."""
    for x, y, c, sh in ((-3, 0, "pink", "mauve"), (0, -1.5, "red", "dred"), (3, 0, "pink", "mauve"),
                        (-1.5, 2, "cream", "tan"), (1.5, 2, "red", "dred")):
        g.cel(cx + 1.3 * (x + tilt * y * 0.4), cy + 1.3 * (y - tilt * x * 0.3), 2.6, 2.6, c, sh)
    for k in range(5):
        g.rect(cx - 1 + tilt * (k + 3) * 0.6, cy + 5 + k, 2, 1, "canopy")
    g.rect(cx - 2 + tilt * 3, cy + 6, 4, 1, "white")


def hit_wedding_shoot(step):
    """A lilac impact star, then the camera flash flares white and yellow and fades, the bouquet flies up
    out of it tumbling, and eight petals scatter and drift down."""
    g = hits.Grid(64, 64)
    cx, cy = 32, 36
    if step == 0:
        hits.impact(g, "lilac", cx, cy)
        return hits.rim(g)
    r = (0, 20, 15, 10, 6, 3, 0, 0)[step]
    if r:
        def flash(p):
            for k in range(4):
                a = math.radians(k * 90 + 45)
                p.tri((cx, cy), (cx + math.cos(a) * r * 0.45, cy + math.sin(a) * r * 0.45),
                      (cx + math.cos(a + 0.8) * r * 0.25, cy + math.sin(a + 0.8) * r * 0.25), "yellow")
            p.tri((cx - r, cy), (cx, cy - r * 0.18), (cx, cy + r * 0.18), "white")
            p.tri((cx + r, cy), (cx, cy - r * 0.18), (cx, cy + r * 0.18), "white")
            p.tri((cx, cy - r), (cx - r * 0.18, cy), (cx + r * 0.18, cy), "white")
            p.tri((cx, cy + r), (cx - r * 0.18, cy), (cx + r * 0.18, cy), "white")
            p.ell(cx, cy, max(1.5, r * 0.3), max(1.5, r * 0.3), "white")
        hits.piece(g, flash)
    t = step - 0.5
    for i, (vx, vy, c) in enumerate(PETALS):
        x, y = cx + vx * 9 * t, cy + vy * 9 * t + 0.9 * t * t
        if 3 <= x < 60 and 3 <= y < 60 and step >= 2:
            hits.piece(g, lambda p: p.rect(x, y, 2, 2, c) if (step + i) % 2 else p.rect(x, y, 2.5, 1.5, c))
    by = (0, 30, 20, 14, 12, 13, 16, 20)[step]
    tilt = (0, 0, 1, 0, -1, 0, 1, 0)[step]
    hits.piece(g, lambda p: bouquet(p, cx, by, tilt))
    return g


def leaping_fish(g, cx, cy, angle):
    """The red snapper in the air round design point cx, cy, 20 design units nose to tail, facing right and
    turned angle degrees clockwise (negative is nose up): a red back over a pink belly, a dred dorsal fin, a
    forked tail and an ink eye. Drawn pixel for pixel at the grid's scale, so it keeps its shape at any
    angle."""
    px, s = raster(g), scale_of(g)
    a = math.radians(angle)
    ox, oy, ln, th = cx * s, cy * s, 7.5 * s, 2.8 * s
    ex, ey = 0.62 * ln, -0.3 * th
    for y in range(px.h):
        for x in range(px.w):
            dx, dy = x + 0.5 - ox, y + 0.5 - oy
            u = dx * math.cos(a) + dy * math.sin(a)
            v = -dx * math.sin(a) + dy * math.cos(a)
            c = None
            if (u / ln) ** 2 + (v / th) ** 2 <= 1:
                c = "pink" if v > th * 0.3 else "red"
                if abs(u - ex) < 1 and abs(v - ey) < 1:
                    c = "ink"
            elif -0.25 * ln < u < 0.3 * ln and -1.55 * th < v < 0 and v > -th - (0.3 * ln - u) * 0.35:
                c = "dred"
            elif -1.35 * ln < u < -0.8 * ln and abs(v) < (-u - 0.8 * ln) * 1.1 + 1:
                c = "red" if abs(v) > 0.35 * th or u > -1.1 * ln else None
            if c:
                px.p(x, y, c)


def hit_fish_crates(step):
    """A shallow impact star, then a splash of white water thrown up either side, the snapper leaping up
    out of it, flipping as it arcs over and falls, ice chips and drops flying out and falling."""
    g = hits.Grid(64, 64)
    cx, cy = 32, 42
    if step == 0:
        hits.impact(g, "shallow", cx, cy - 4)
        return hits.rim(g)
    h = (0, 0.6, 1, 0.8, 0.5, 0.25, 0, 0)[step]
    if h:
        def splash(p):
            for dx, top in ((-9, 14), (-4, 20), (0, 16), (4, 20), (9, 14)):
                n = round(top * h)
                if n:
                    p.tri((cx + dx - 2.5, cy + 2), (cx + dx + 2.5, cy + 2), (cx + dx * 1.3, cy + 2 - n), "foam")
                    p.tri((cx + dx - 1, cy + 2), (cx + dx + 1, cy + 2), (cx + dx * 1.3, cy + 2 - n * 0.8), "white")
            p.ell(cx, cy + 2, 12 * h + 2, 2.5, "shallow", "lake")
        hits.piece(g, splash)
    t = step - 0.5
    for i, (vx, vy) in enumerate(((-9, -8), (9, -7), (-12, -3), (12, -4), (-5, -10), (6, -10))):
        x, y = cx + vx * t * 0.8, cy - 4 + vy * t * 0.8 + 1.3 * t * t
        if 3 <= x < 60 and 3 <= y < 60 and step >= 1:
            if i % 2:
                hits.piece(g, lambda p: p.rect(x, y, 1, 2, "cyan"))
            else:
                hits.piece(g, lambda p: (p.rect(x, y, 3, 3, "white"), p.rect(x + 2, y + 1, 1, 2, "foam")))
    fy = (0, 31, 20, 14, 12, 14, 19, 26)[step]
    fx_ = (0, 28, 29, 31, 33, 35, 37, 39)[step]
    angle = (0, -60, -35, -10, 15, 40, 60, 75)[step]
    hits.piece(g, lambda p: leaping_fish(p, fx_, fy, angle))
    return g


def hit_cheese_crates(step):
    """A gold impact star, then a puff of lime stink swelling up and shrinking away as the cut cheese wheel
    bounces up out of it and rolls away to the right, turning a quarter turn a frame, crumbs thrown out
    either side and stink wisps rising off the puff."""
    g = hits.Grid(64, 64)
    cx, cy = 32, 42
    if step == 0:
        hits.impact(g, "gold", cx, cy - 4)
        return hits.rim(g)
    r = (0, 7, 11, 14, 15, 13, 10, 6)[step]

    def puff(p):
        for dx, dy, k in ((-9, 1, 0.7), (9, 1, 0.7), (0, -3, 1), (-5, -8, 0.6), (5, -9, 0.55)):
            p.cel(cx + dx * r / 14, cy + dy * r / 14, r * k * 0.6 + 1, r * k * 0.45 + 1, "lime", None, "yellow")
        p.rect(cx - r * 0.9, cy + r * 0.3, r * 1.8, 1, "moss")

    hits.piece(g, puff)
    if step >= 3:
        hits.piece(g, lambda p: stink_wisps(p, step % 4, xs=(cx - 9, cx, cx + 9), top=cy - 24 + step,
                                            bottom=cy - 6 - r * 0.5))
    t = step - 0.5
    for i, (vx, vy) in enumerate(((-9, -8), (9, -7), (-12, -3), (12, -4), (-5, -10), (6, -10))):
        x, y = cx + vx * t * 0.8, cy - 4 + vy * t * 0.8 + 1.3 * t * t
        if 3 <= x < 60 and 3 <= y < 60:
            hits.piece(g, lambda p: p.rect(x, y, 2, 2, "cream" if i % 2 else "gold"))
    wx = (0, 30, 33, 37, 41, 45, 48, 51)[step]
    wy = (0, 32, 22, 17, 18, 24, 32, 28)[step]
    hits.piece(g, lambda p: cheese_wheel(p, wx, wy, 8, turn=step * 90))
    return g


HIT_BURSTS = {"fx-hit-wedding-shoot": (hit_wedding_shoot, 8), "fx-hit-fish-crates": (hit_fish_crates, 8),
              f"fx-hit-{CHEESE}": (hit_cheese_crates, 8)}


def burst_sprites():
    """Yield (key, tags) for the hit bursts, as hits.sprites draws its own."""
    for key, (draw, n) in HIT_BURSTS.items():
        yield key, [("play", [minis.small(hits, hits.BURST_SCALE, draw, i).outlined(False)
                              for i in range(n)], 70)]


def sprites():
    """Every sprite: the road sprites, their depth variants, then the hit bursts."""
    yield from road_sprites()
    for suffix, s in STEPS:
        for key, tags in road_sprites(s):
            yield f"{key}@{suffix}", tags
    yield from burst_sprites()


# ---------- cards ----------

def figure(*parts, flash=False, pay=False):
    """Some of the wedding shoot's figures at 1x, as an image the size of its frame."""
    return to_image(drawn(PERSON, wedding_shoot, flash=flash, parts=parts, pay=pay).outlined())


def card_wedding_pose():
    """Pose: the bride smiling at the left with Archie sitting at her side, the photographer's camera at
    the right edge firing its flash at them, hearts rising."""
    import cards
    a = cards.Art()
    a.ground("street")
    a.shadow(18, 62, 30)
    a.paste(figure("bride"), -6, -11)
    a.paste(figure("photographer", flash=True), -10, -12)
    c = a.dog("archie", "idle", 36, 62)
    a.lead(36, c, 42)
    a.hearts([(26, 2), (38, 12)])
    return a


def arc(a, pts, col, dash=2, gap=2):
    """A dashed trail through the joints pts, dash pixels on and gap off along it."""
    run = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(1, round(math.hypot(x1 - x0, y1 - y0)))
        run += [(round(x0 + (x1 - x0) * k / n), round(y0 + (y1 - y0) * k / n)) for k in range(n)]
    for k, (x, y) in enumerate(dict.fromkeys(run)):
        if k % (dash + gap) < dash:
            a.fill(x, y, 1, 1, col)


def bezier(p0, p1, p2, n=24):
    """n + 1 points along the quadratic Bezier curve p0, p1, p2."""
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in (k / n for k in range(n + 1))]


def card_wedding_walk_around():
    """Walk around: the shoot posing up the road, drawn small, the flash firing, while the pack swings wide round
    it in an arc: Archie leading at the bottom, pulling out to the right, and Kilo far up the road at its widest,
    a dashed white trail along it from the bottom edge curving back in over the top of the shoot."""
    import cards
    a = cards.Art()
    a.ground("street")
    shoot = to_image(drawn(PERSON * 0.4, wedding_shoot, flash=True).outlined())
    a.shadow(9, 30, 18)
    a.shadow(29, 30, 18)
    a.paste(shoot, 1, 30 - shoot.height)
    pack = (("kilo", 50, 65, 30, "walk", 2), ("archie", 75, 35, 59, "pull", 0))
    for dog, step, x, foot, tag, i in pack:
        a.shadow(x, foot, cards.sn.frame(f"dog-{dog}@{step}", tag).width)
    arc(a, bezier((30, 62), (104, 30), (26, -6)), "white")
    for dog, step, x, foot, tag, i in pack:
        c = a.dog(dog, tag, x, foot, i, step, shadow=False)
        a.lead(x, c, 42)
    return a


def card_wedding_reshoot():
    """Pay for a reshoot: the bride posing again at the left, the photographer's camera at the right edge lined
    up on her, its flash not yet fired, while his free hand reaches out to take a bill, Archie sitting aside at
    his feet, out of the shot."""
    import cards
    a = cards.Art()
    a.ground("street")
    a.shadow(18, 62, 30)
    a.paste(figure("bride"), -6, -11)
    a.paste(cards.sn.image("icon-bill"), 33, 31)
    a.paste(figure("photographer", pay=True), -10, -12)
    c = a.dog("archie", "idle", 62, 62)
    a.lead(62, c, 66)
    return a


def crate_image(draw):
    return to_image(drawn(PERSON, draw).outlined())


def card_fish_sniff():
    """Let them sniff: the spilt crate up the road and Archie nose down at the fish, wavy moss smell lines
    rising off them and a heart."""
    import cards
    a = cards.Art()
    a.ground("shops")
    a.put("fish-crates", "idle", 40, 38)
    c = a.dog("archie", "walk", 30, 60, 2)
    a.lead(30, c, 36)
    a.stink(10, 16, 2, "lime", "moss")
    a.stink(62, 14, 2, "lime", "moss")
    a.hearts([(46, 2)])
    return a


def fishmonger_top(g, b):
    """The fishmonger facing the player: a blue shirt under a long white apron, a navy flat cap, the near
    hand (screen left) raised beside the face to hold up the fee, the other arm at the side."""
    g.rect(9, 21 + b, 14, 13, "blue")
    g.rect(20, 21 + b, 3, 13, "navy")
    g.rect(11, 23 + b, 10, 12, "white")
    g.rect(19, 23 + b, 2, 12, "lgrey")
    g.rect(11, 21 + b, 1, 2, "white")
    g.rect(20, 21 + b, 1, 2, "lgrey")
    g.rect(5, 22 + b, 4, 4, "blue")
    g.rect(4, 15 + b, 4, 8, "blue")
    g.rect(4, 13 + b, 4, 3, "skin1")
    road.back_arm(g, 23, 4, 22 + b, ((8, "blue", "navy"), (3, "skin1", None)))
    face_disc(g, 16, 13.5 + b, 7.5, 7.5, "skin1", "skin2")
    face_front(g, 16, 14 + b)
    g.cel(16, 8 + b, 7.5, 3, "navy", "ink", "blue")
    g.rect(10, 9 + b, 14, 1.5, "navy")


def card_fish_pay():
    """Pay for the fish: the spilt crate at the left with Archie sitting by it, and the fishmonger at the
    right holding up the bill he has been paid."""
    import cards
    a = cards.Art()
    a.ground("shops")
    a.put("fish-crates", "idle", 22, 40)
    monger = to_image(road.drawn(PERSON, road.dressed, fishmonger_top, legs="slate", shoes="white").outlined())
    a.paste(monger, 38, -4)
    a.paste(cards.sn.image("icon-bill"), 38, 4)
    c = a.dog("archie", "idle", 30, 58)
    a.lead(30, c, 36)
    return a


def card_fish_hurry_past():
    """Hurry past: the spilt crate at the right and Archie pulled away to the left, the leash taut off the
    bottom, a red ! by the fish."""
    import cards
    a = cards.Art()
    a.ground("shops")
    a.put("fish-crates", "idle", 54, 38)
    c = a.dog("archie", "pull", 22, 56, flip=True)
    a.lead(22, c, 6)
    a.fill(66, 4, 2, 5, "red")
    a.fill(66, 10, 2, 2, "red")
    return a


def shop_door(a):
    """The cheese crate's setting, the same in both neighbourhoods it stands in: a red brick shopfront in a
    running bond of dbrick mortar across the top, a bark wooden door in a dbrown frame with a gold knob over a
    stone step, and stone paving below in dstone courses; shadows dstone, the leash pink."""
    from cards import AH, AW
    a.fill(0, 0, AW, WALL, "brick")
    for y in range(3, WALL, 4):
        a.fill(0, y, AW, 1, "dbrick")
        for x in range(-4 + 4 * (y // 4 % 2), AW, 8):
            a.fill(x, y - 3, 1, 3, "dbrick")
    a.fill(0, WALL - 2, AW, 2, "dbrick")
    a.fill(DOOR - 3, 0, 30, WALL - 1, "dbrown")
    a.fill(DOOR, 0, 24, WALL - 1, "bark")
    for x in range(DOOR + 5, DOOR + 24, 6):
        a.fill(x, 0, 1, WALL - 1, "walnut")
    a.fill(DOOR + 2, 3, 20, 8, "dbrown")
    a.fill(DOOR + 3, 4, 18, 6, "haze")
    a.fill(DOOR + 3, 4, 18, 1, "white")
    a.fill(DOOR + 20, 16, 2, 2, "gold")
    a.fill(DOOR - 5, WALL - 2, 34, 3, "stone")
    a.fill(DOOR - 5, WALL - 2, 34, 1, "driftwood")
    a.fill(0, WALL + 1, AW, AH - WALL - 1, "stone")
    for y in range(WALL + 7, AH, 8):
        a.fill(0, y, AW, 1, "dstone")
    a.shade, a.leash_col = "dstone", "pink"


# The shop door's layout: the wall's bottom row and the door's left column.
WALL, DOOR = 28, 26


def card_cheese_sniff():
    """Have a sniff: the cheese crate at the shop door and Archie and Buddy nose in at it from either side,
    stink wisps rising round them all and a heart."""
    import cards
    a = cards.Art()
    shop_door(a)
    a.put(CHEESE, "idle", 38, 40)
    for dog, x, foot, i in (("buddy", 54, 58, 1), ("archie", 22, 60, 2)):
        c = a.dog(dog, "walk", x, foot, i)
        a.lead(x, c, x + 6)
    a.stink(3, 16, 2, "lime", "moss")
    a.stink(63, 18, 2, "lime", "moss")
    a.stink(37, 33, 1, "lime", "moss")
    a.hearts([(66, 6)])
    return a


def cheesemonger_top(g, b):
    """The cheesemonger facing the player: an ochre shirt under a long white apron, dbrown hair and a short
    moustache, the near hand (screen left) raised beside the face to hold up the fee, the other hand low at the
    side holding a wedge of gold cheese across the apron."""
    g.rect(9, 21 + b, 14, 13, "ochre")
    g.rect(20, 21 + b, 3, 13, "rust")
    g.rect(11, 23 + b, 10, 12, "white")
    g.rect(19, 23 + b, 2, 12, "lgrey")
    g.rect(11, 21 + b, 1, 2, "white")
    g.rect(20, 21 + b, 1, 2, "lgrey")
    g.rect(5, 22 + b, 4, 4, "ochre")
    g.rect(4, 15 + b, 4, 8, "ochre")
    g.rect(4, 13 + b, 4, 3, "skin1")
    road.back_arm(g, 23, 4, 22 + b, ((8, "ochre", "rust"), (3, "skin1", None)))
    g.tri((24, 29 + b), (24, 34 + b), (17, 34 + b), "gold")
    g.rect(17, 33 + b, 7, 1, "amber")
    g.rect(23, 29 + b, 1, 5, "yellow")
    g.rect(22, 32 + b, 3, 2, "skin1")
    face_disc(g, 16, 13.5 + b, 7.5, 7.5, "skin1", "skin2")
    face_front(g, 16, 14 + b)
    g.rect(13.5, 16.5 + b, 5, 1, "dbrown")
    g.cel(16, 8 + b, 7.5, 3, "dbrown", "plum", "brown")
    g.rect(8.5, 8 + b, 2, 5, "dbrown")
    g.rect(21.5, 8 + b, 2, 5, "dbrown")


def card_cheese_buy():
    """Buy the cheese: the cheese crate at the shop door with Archie sitting by it, and the cheesemonger in
    the doorway holding up the bill he has been paid and holding out a wedge of cheese."""
    import cards
    a = cards.Art()
    shop_door(a)
    a.put(CHEESE, "idle", 22, 42)
    monger = to_image(road.drawn(PERSON, road.dressed, cheesemonger_top, legs="bark", shoes="ink").outlined())
    a.paste(monger, 38, -4)
    a.paste(cards.sn.image("icon-bill"), 38, 4)
    c = a.dog("archie", "idle", 30, 58)
    a.lead(30, c, 36)
    return a


def card_cheese_hurry_on():
    """Hurry on: the cheese crate at the shop door on the right and Archie pulled away to the left, the leash
    taut off the bottom, a red ! by the cheese."""
    import cards
    a = cards.Art()
    shop_door(a)
    a.put(CHEESE, "idle", 54, 42)
    c = a.dog("archie", "pull", 22, 56, flip=True)
    a.lead(22, c, 6)
    a.fill(72, 2, 2, 5, "red")
    a.fill(72, 8, 2, 2, "red")
    return a


CARDS = {
    "card-wedding-shoot-pose": card_wedding_pose,
    "card-wedding-shoot-walk-around": card_wedding_walk_around,
    "card-wedding-shoot-reshoot": card_wedding_reshoot,
    "card-fish-crates-sniff": card_fish_sniff,
    "card-fish-crates-pay": card_fish_pay,
    "card-fish-crates-hurry-past": card_fish_hurry_past,
    f"card-{CHEESE}-sniff": card_cheese_sniff,
    f"card-{CHEESE}-buy": card_cheese_buy,
    f"card-{CHEESE}-hurry-on": card_cheese_hurry_on,
}


def card_preview(out, scale=3):
    """Every card illustration inside an encounter card frame, cost plaque included."""
    import cards
    from PIL import Image

    cards.ILLUSTRATIONS.update(CARDS)
    sheet = Image.new("RGB", ((cards.CW + 6) * len(CARDS) * scale, (cards.CH + 6) * scale))
    for i, key in enumerate(CARDS):
        card = cards.mock_card("encounter", key).resize((cards.CW * scale, cards.CH * scale), Image.NEAREST)
        sheet.paste(card, (i * (cards.CW + 6) * scale, 0))
    sheet.save(out)


def build_cards():
    os.makedirs("public/art/images", exist_ok=True)
    for key, draw in CARDS.items():
        png = f"public/art/images/{key}.png"
        draw().img.save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/cards/{key}.aseprite"], check=True)
    print("built", ", ".join(CARDS))


# ---------- sounds ----------

# Each is a list of sounds.tone() calls, (wave, seconds, freq, start seconds, options), as sounds.EFFECTS.
SOUNDS = {
    # a soft wooden thunk, a squish, then the cheese's rising plop and a sag as it settles
    f"sfx-hit-{CHEESE}": [
        ("triangle", 0.14, (150, 65), 0, dict(vol=0.8, attack=0.003, release=0.85)),
        ("pinknoise", 0.05, None, 0, dict(vol=0.3, low=700, attack=0.002, release=0.9)),
        ("pinknoise", 0.12, None, 0.14, dict(vol=0.6, low=1100, high=180, attack=0.02, release=0.7)),
        ("sine", 0.08, (180, 520), 0.16, dict(vol=0.8, attack=0.004, release=0.6)),
        ("triangle", 0.12, (300, 120), 0.27, dict(vol=0.5, attack=0.01, release=0.8)),
    ],
    # the flash whining up, the shutter's two clicks, then two bells
    "sfx-hit-wedding-shoot": [
        ("square", 0.12, (1800, 4200), 0, dict(vol=0.15, duty=25, low=5000, attack=0.02, release=0.3)),
        ("pinknoise", 0.02, None, 0.12, dict(vol=0.7, high=2500, low=8000, attack=0.001, release=0.6)),
        ("pinknoise", 0.025, None, 0.16, dict(vol=0.6, high=1800, low=6000, attack=0.001, release=0.6)),
        ("triangle", 0.2, "E6", 0.2, dict(vol=0.9, release=0.85)),
        ("square", 0.2, "E5", 0.2, dict(vol=0.15, duty=25, low=2500, release=0.85)),
        ("triangle", 0.28, "C6", 0.3, dict(vol=0.9, release=0.9)),
        ("square", 0.28, "C5", 0.3, dict(vol=0.15, duty=25, low=2500, release=0.9)),
    ],
    # the crate's thunk, ice chips clattering, then two wet flops
    "sfx-hit-fish-crates": [
        ("triangle", 0.16, (180, 70), 0, dict(attack=0.003, release=0.85)),
        ("pinknoise", 0.06, None, 0, dict(vol=0.4, low=900, attack=0.002, release=0.9)),
        ("triangle", 0.04, "C#7", 0.05, dict(vol=0.5, attack=0.002, release=0.7)),
        ("triangle", 0.04, "G#6", 0.09, dict(vol=0.45, attack=0.002, release=0.7)),
        ("triangle", 0.04, "E7", 0.13, dict(vol=0.4, attack=0.002, release=0.7)),
        ("triangle", 0.04, "A6", 0.18, dict(vol=0.3, attack=0.002, release=0.7)),
        ("pinknoise", 0.07, None, 0.25, dict(vol=0.8, low=1600, high=250, attack=0.003, release=0.8)),
        ("triangle", 0.08, (320, 140), 0.25, dict(vol=0.6, attack=0.003, release=0.8)),
        ("pinknoise", 0.07, None, 0.38, dict(vol=0.6, low=1400, high=250, attack=0.003, release=0.8)),
        ("triangle", 0.08, (280, 120), 0.38, dict(vol=0.45, attack=0.003, release=0.8)),
    ],
}


def render_sounds(out_dir):
    """Write each sound into out_dir as .ogg and .m4a, as sounds.py renders its own."""
    import sounds

    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for key, parts in SOUNDS.items():
            layers = []
            for i, (wave, seconds, freq, start, opts) in enumerate(parts):
                path = f"{tmp}/{key}-{i}.wav"
                sounds.tone(path, sounds.n(seconds), wave, freq, start=sounds.n(start), **opts)
                layers.append(path)
            wav = f"{tmp}/{key}.wav"
            sounds.mix([(path, 1 / len(layers)) for path in layers], wav)
            sounds.encode(wav, out_dir, key)
    print("built", ", ".join(SOUNDS))


if __name__ == "__main__":
    argv = sys.argv
    if len(argv) == 3 and argv[1] == "preview":
        preview(depth_settled(sprites()), argv[2], ZONE_ROADS)
    elif len(argv) == 3 and argv[1] == "cards":
        card_preview(argv[2])
    elif len(argv) == 3 and argv[1] == "sounds":
        render_sounds(argv[2])
    elif len(argv) == 2 and argv[1] == "build":
        build_sprites(list(sprites()), SRC)
        build_cards()
        render_sounds("public/art/sounds")
    else:
        sys.exit(__doc__)
