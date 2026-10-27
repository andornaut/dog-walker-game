#!/usr/bin/env python3
"""Draw Cabbagetown's and High Park's own road objects, their hit moments, sounds and card
illustrations.

Card obstacles, 48x48, laid out on the 32-unit design grid and drawn at road.SCALE (1.5)
on a minis.Mini, as road.py's animals are; side views facing right, a standing card
obstacle is never mirrored:
porch-cat           a white calico cat lounging on its side, its head raised to stare at the
                    pack: an ochre patch on its haunch and one ear, a dbrown saddle and eye patch,
                    amber eyes, front paws stretched out ahead. idle (4 frames, 300ms): the tail
                    tip flicks up, back, a slow blink, down. walk (4 frames, 100ms): a slinking
                    crawl, the front paws reaching in turn while the body lifts 1px between them
capybara            a brown capybara side on: a barrel body on short legs and no tail, the big
                    square-ended head with a dbrown nose, a small round ear and a high eye. idle (4 frames, 300ms): a
                    chew, rest, an ear flick, a blink. walk (4 frames, 160ms): a slow step, the
                    diagonal legs swapping and the body bobbing 1px on the passing frames

Minor obstacles, laid out in obstacles.py's pixels (40 for one lane, 30 rows for a
lane-spanning one) and drawn at obstacles.SCALE (1.2) on a minis.Mini:
leaf-pile           48x48   1 lane, a raked dome of overlapping autumn leaves in orange, amber,
                            ochre, red, brick and gold, a red maple leaf on top; idle (4 frames,
                            400ms): the maple leaf lifts 1px and turns over on frame 2
porch-steps         48x48   1 lane, three brick steps with stone treads in a front elevation,
                            tall white newel posts under ball caps either side,
                            a jack-o'-lantern with a dark carved face on the top step;
                            idle (4 frames, 400ms): its candle dims on frame 2 and flares on frame 3
picnic-blanket      112x36  2 lanes, a red and white checked blanket on the road with a wicker basket
                            on it, a baguette leaning out of the basket, a lemonade jug and two
                            apples; idle (4 frames, 450ms): the blanket's near right corner lifts
                            1px in a breeze on frame 2

Each of the five also has <key>@<step> for each depth step in minis.STEPS (from
shared/depth-steps.json), redrawn at the step with the original's tags, frames and
durations and a full outline. Road outline (pixel.road_edge) and road.LIT's rim on dark
fills, so every one holds 3:1 on every road.

Hit moments, 77x77, laid out on hits.py's 64x64 design and drawn at hits.BURST_SCALE, each
opening on hits.impact's eight-point star in the encounter's colour:
fx-hit-porch-cat    play (8 frames, 70ms)  a hiss puff with three red claw scratches across it,
                                           calico fur tufts flying out
fx-hit-capybara     play (8 frames, 70ms)  a soft dust poof with grass blades and brown fur
                                           tufts thrown up, then a calm heart rising

Sounds, made with sounds.py's tone and mix:
sfx-hit-porch-cat   0.49s  a hiss of pink noise stepping down two bands, then a square "mrr" rising
                           into a falling "ow"
sfx-hit-capybara    0.42s  a low triangle "huff", then three soft rising triangle chirps

Card illustrations, 75x56, composed from the exported sprites as cards.py composes its own:
card-porch-cat-shoo         the cat bolting off the left edge past speed lines, Archie
                            standing calm on his leash
card-porch-cat-treat        the cat lounging over a treat under rising hearts, Archie sitting
                            calm beside it
card-porch-cat-bolt         Archie pulling hard past the lounging cat, speed lines behind it
card-capybara-help          the zookeeper in an olive shirt and a bush hat leading the capybara
                            off on a rope, a heart over the capybara
card-capybara-call-zoo      a phone ringing in a callout over the capybara, chewing on the
                            trail, Archie waiting on his leash
card-capybara-keep-walking  Archie and Duchess trotting on up the trail past speed lines, the
                            capybara left behind chewing at the side

Usage:
  hood_parks.py preview OUT_DIR   OUT_DIR/road.png (every road sprite and depth step on the
                                  zone roads), OUT_DIR/hits.png, OUT_DIR/cards.png (every
                                  illustration in a card frame) and the sounds
  hood_parks.py build             write the .aseprite sources (art/encounters, art/obstacles,
                                  art/hits, art/cards), export the sprites to
                                  public/art/sprites/, the illustrations to public/art/images/
                                  and the sounds to public/art/sounds/

Run from the repository root. The cards compose the exported sprites, so the build exports
the sprites first. A build overwrites the .aseprite sources, so hand edits to them belong in
this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(__file__))
import cards  # noqa: E402
import fx  # noqa: E402
import hits  # noqa: E402
import minis  # noqa: E402
import obstacles  # noqa: E402
import road  # noqa: E402
import scene as sn  # noqa: E402
import sounds  # noqa: E402
from minis import STEPS  # noqa: E402
from pixel import ZONE_ROADS, Grid, build as build_sprites, depth_settled, edged, to_image  # noqa: E402
from pixel import raster, scale_of  # noqa: E402
from pixel import preview as sheet  # noqa: E402
from road import lit  # noqa: E402

# Animals are laid out on 32 design units and drawn ANIMAL times bigger (48px); minor obstacles in their own
# pixels, drawn OBSTACLE times bigger.
ANIMAL = road.SCALE
OBSTACLE = obstacles.SCALE


def drawn(s, draw, *args, **q):
    """draw(*args, **q) on a minis.Mini at scale s, its numeric keyword arguments (pose offsets) snapped to
    whole pixels at s."""
    pose = {k: v for k, v in q.items() if isinstance(v, (int, float)) and not isinstance(v, bool)}
    return minis.small(sys.modules[__name__], s, draw, *args, **{**q, **minis.snap(pose, s)})


def bar(g, a, b, w, c):
    """A straight bar w thick from a to b."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = max(1e-6, math.hypot(dx, dy))
    px, py = -dy / n * w / 2, dx / n * w / 2
    p = ((a[0] + px, a[1] + py), (b[0] + px, b[1] + py), (b[0] - px, b[1] - py), (a[0] - px, a[1] - py))
    g.tri(p[0], p[1], p[2], c)
    g.tri(p[0], p[2], p[3], c)


# ---------- porch-cat ----------

# The calico's coat: white shaded lgrey, an ochre patch shaded rust, a dbrown patch shaded plum.
CALICO = dict(coat="white", coat_sh="lgrey", orange="ochre", orange_sh="rust", dark="dbrown", dark_sh="plum")
# The cat's idle: the tail tip flicks up, rests, the eyes blink slowly, the tip flicks down.
PORCH_CAT_IDLE = (dict(), dict(tail=-1), dict(blink=True), dict(tail=1))
# Its crawl: a front paw reaches 1px ahead, the body lifts between steps, the other paw reaches.
PORCH_CAT_WALK = (dict(near=1, sway=-1), dict(bob=-1), dict(far=1, sway=1), dict(bob=-1))


def porch_cat(tail=0, blink=False, near=0, far=0, bob=0, sway=0):
    """A calico lounging on its side, facing right, its head raised and turned to the player. tail moves the
    curled tip up or down (negative is up), blink shuts the eyes to lids, near and far push the front paws
    ahead, bob lifts the body (negative is up), sway swings the tail sideways. Its coat is white, so it reads
    apart from the tuxedo chase-cat and the ginger ambient-cat; the road outline holds it on the light roads.
    """
    c = CALICO
    g = edged(Grid())
    b = bob
    # the tail, rising from the rump in a curve, its dbrown tip curling over and flicking
    bar(g, (5, 25 + b), (2.5 + sway, 20.5 + b), 2, c["coat"])
    bar(g, (2.5 + sway, 20.5 + b), (3 + sway, 16 + b), 2, c["coat"])
    bar(g, (3 + sway, 16 + b), (5.5 + sway, 13.5 + tail + b), 2, c["dark"])
    # far front paw, a shade darker, reaching ahead under the chest
    g.rect(21 + far, 27, 7, 2, c["coat_sh"])
    # the body lying long, the haunch round at the left
    g.cel(14, 24.5 + b, 10.5, 4.5, c["coat"], c["coat_sh"])
    g.cel(7.5, 23.5 + b, 5, 5, c["coat"], c["coat_sh"])
    # patches: ochre on the haunch, a dbrown saddle over the back
    g.cel(7, 21.5 + b, 3.5, 3, c["orange"], c["orange_sh"])
    g.cel(14.5, 21.5 + b, 3.8, 2.6, c["dark"], c["dark_sh"])
    # the back paw tucked along the ground
    g.rect(4, 27.5, 6, 1.5, c["coat"])
    g.p(9, 28, c["coat_sh"])
    # near front paw stretched out along the road ahead of the chest
    g.rect(19 + near, 27.5, 9, 1.5, c["coat"])
    g.p(27 + near, 28, c["coat_sh"])
    # the head, raised and turned to the player: ears, a dbrown patch over the left eye, an ochre right ear
    hx, hy = 23.5, 16.5 + b
    g.tri((hx - 5, hy - 1), (hx - 4.5, hy - 7), (hx - 1, hy - 3.5), c["dark"])
    g.tri((hx + 5, hy - 1), (hx + 4.5, hy - 7), (hx + 1, hy - 3.5), c["orange"])
    g.tri((hx - 4.2, hy - 2), (hx - 4, hy - 5.5), (hx - 2.2, hy - 3.2), "pink")
    g.tri((hx + 4.2, hy - 2), (hx + 4, hy - 5.5), (hx + 2.2, hy - 3.2), "pink")
    g.cel(hx, hy, 5.5, 4.5, c["coat"], c["coat_sh"])
    g.cel(hx - 2.8, hy - 1.6, 2.6, 2.4, c["dark"], c["dark_sh"])
    # amber eyes with slit pupils, or lids shut in a slow blink
    for ex in (hx - 3, hx + 1):
        if blink:
            g.rect(ex, hy, 2, 1, "ink")
            continue
        g.rect(ex, hy - 1, 2, 2, "amber")
        g.rect(ex + 1, hy - 1, 1, 2, "ink")
    g.rect(hx - 0.5, hy + 1.5, 1, 1, "pink")
    g.p(hx - 1.5, hy + 2.5, "lgrey")
    g.p(hx + 0.5, hy + 2.5, "lgrey")
    return lit(g)


# ---------- capybara ----------

# The capybara's coat: brown, shaded dbrown, lit tan; the far legs and the nose dbrown.
CAPY = dict(coat="brown", shade="dbrown", lit="tan", far="dbrown", nose="dbrown")
# Its idle: a chew (the jaw drops 1px), rest, the ear flicks up, a blink.
CAPYBARA_IDLE = (dict(chew=1), dict(), dict(ear=-1), dict(blink=True))
# Its slow step: the near fore and far hind leg forward, passing 1px higher, the other pair forward, passing.
CAPYBARA_WALK = (dict(a=1.5, b=-1.5), dict(bob=-1), dict(a=-1.5, b=1.5), dict(bob=-1))
CAPYBARA_WALK_MS = 160


def capybara(a=0, b=0, bob=0, chew=0, ear=0, blink=False):
    """A capybara side on, facing right: a barrel body on four short legs and the big blunt head, deep and
    square-ended, its nose dbrown. a moves the near foreleg and far hind leg along the ground (positive is
    ahead), b the other pair; a foot swinging ahead lifts 1px. bob lifts the body (negative is up), chew drops
    the jaw, ear lifts the ear (negative is up) and blink shuts the eye. No tail, so it never reads as a dog."""
    c = CAPY
    g = edged(Grid())
    o = bob

    def leg(x, step, col):
        up = 1 if step > 0 else 0
        g.rect(x + step / 2, 23 + o, 3, 6 - o - up, col)
        g.rect(x + step - 0.5, 28 - up, 3.5, 1, c["far"])

    # far legs behind the body
    leg(4.5, b, c["far"])
    leg(17.5, a, c["far"])
    # the barrel body, its back a long low curve
    g.cel(12.5, 19.5 + o, 11.5, 7, c["coat"], c["shade"], c["lit"])
    # near legs in front
    leg(7.5, a, c["coat"])
    leg(20, b, c["coat"])
    # the head: deep and long, square at the front, its jaw a straight line
    hx, hy = 24, 15 + o
    g.cel(hx, hy, 4.5, 5, c["coat"], c["shade"], c["lit"])
    g.rect(hx, hy - 4, 5.5, 8 + chew, c["coat"])
    g.rect(hx + 5.5, hy - 3, 1, 6 + chew, c["coat"])
    g.rect(hx, hy + 3 + chew, 6, 1, c["shade"])
    # the nose: the blunt front darker, a nostril and the mouth line under it
    g.rect(hx + 4.5, hy - 2.5, 2, 4, c["nose"])
    g.p(hx + 5.5, hy - 1.5, "walnut")
    g.rect(hx + 3.5, hy + 1.5 + chew, 3, 1, c["nose"])
    # a small round ear high on the back of the head, and the eye high and small
    g.cel(hx - 2, hy - 5 + ear, 1.6, 1.6, c["shade"])
    if blink:
        g.rect(hx + 1, hy - 2, 2, 1, "walnut")
    else:
        g.rect(hx + 1, hy - 2.5, 2, 2, "ink")
        g.p(hx + 1, hy - 2.5, "white")
    return lit(g)


# ---------- minor obstacles ----------

SIZE, ROW = obstacles.SIZE, obstacles.ROW

# Autumn leaves, each a fill and the shade of its lower half, from the lightest (the heap's top left, facing
# the light) to the darkest (its lower right).
LEAF_COLOURS = (("gold", "amber"), ("amber", "ochre"), ("orange", "rust"), ("ochre", "brown"), ("rust", "dbrick"),
                ("brown", "dbrown"))
# The heap: a dome, centre (PILE_X, PILE_Y), radii PILE_R, laid out in leaves LEAF wide in rows ROW_STEP apart.
PILE_X, PILE_Y, PILE_R = 20, 39, (18, 17)
LEAF = 7
ROW_STEP = 2
# The red maple leaf on top, character maps in drawn pixels (r TTC red, d its dred shade and stem): a top lobe,
# two side lobes and two small lower ones at full size and the larger steps, three points below them.
MAPLE = ("....r....", "...rrr...", ".r.rrr.r.", ".rrrrrrr.", "rrrrrrrrd", ".rrrrrdd.", "..rr.dd..", "....d....")
MAPLE_SMALL = ("..r..", "r.r.r", "rrrrd", ".rdd.", "..d..")
# The pile's idle: rest, rest, the maple leaf lifted 1px and turned over, rest.
LEAF_PILE_IDLE = (0, 0, 1, 0), 400


def lens(g, x, y, fill, shade):
    """A LEAF-wide leaf lying flat, pointed at both ends, 4 rows deep: its upper half fill, its lower shade."""
    g.tri((x, y + 2), (x + LEAF / 2, y), (x + LEAF, y + 2), fill)
    g.tri((x, y + 2), (x + LEAF / 2, y + 4), (x + LEAF, y + 2), shade)


def maple(g, cx, bottom, lift, flip):
    """The maple leaf centred on layout column cx with its stem's foot on layout row bottom, pixel for pixel
    in drawn pixels so its points stay sharp at every step, lifted lift drawn pixels and mirrored when flip."""
    px, s = raster(g), scale_of(g)
    leaf = MAPLE if s >= 0.9 else MAPLE_SMALL
    x0, y0 = round(cx * s - len(leaf[0]) / 2), round(bottom * s) - len(leaf) - lift
    for j, row in enumerate(leaf):
        for i, ch in enumerate(row[::-1] if flip else row):
            if ch != ".":
                px.p(x0 + i, y0 + j, "ttc" if ch == "r" else "dred")


def scatter(a, b):
    """A fixed pseudo-random number in 0 to 96 for the pair (a, b)."""
    return (a * 73856093 ^ b * 19349663) % 97


def pile_leaves():
    """(x, y, colour index) for every leaf in the heap, back rows first: each row's leaves spread across the
    dome's width there, the outer ones' tips on its rim so it is ragged, the inner ones nudged a pseudo-random
    pixel so no two rows line up into a weave. Each leaf takes the colour its place on the dome faces the
    light with, give or take a step."""
    out = []
    rx, ry = PILE_R
    for r, y in enumerate(range(PILE_Y - ry + 1, PILE_Y - 3, ROW_STEP)):
        half = rx * math.sqrt(max(0, 1 - ((y + 2 - PILE_Y) / ry) ** 2))
        n = max(1, round(2 * half / (LEAF - 1)))
        step = (2 * half - LEAF) / max(1, n - 1)
        for i in range(n):
            nudge = 0 if i in (0, n - 1) else scatter(r, i) % 3 - 1
            x = PILE_X - half + i * step + nudge if n > 1 else PILE_X - LEAF / 2
            light = 0.55 * (x + LEAF / 2 - PILE_X + rx) / (2 * rx) + 0.45 * (y - PILE_Y + ry) / ry
            k = round(light * (len(LEAF_COLOURS) - 1)) + scatter(r, i + 5) % 3 - 1
            out.append((x, y + (scatter(i, r) % 2) * 0.5, max(0, min(len(LEAF_COLOURS) - 1, k))))
    return out


def leaf_pile(lift=0):
    """A raked heap of autumn leaves: a low dome built of overlapping leaves in gold, amber, orange, ochre,
    rust and brick, lighter where the dome faces the light, each shaded on its lower half, so the heap reads
    as leaves and its rim is ragged with their tips; a red maple leaf lies on top, its edge lit red rather than
    pink so it never reads as a heart. lift raises the maple leaf 1 drawn pixel and turns it over."""
    g = edged(Grid(SIZE, SIZE))
    rx, ry = PILE_R
    g.cel(PILE_X, PILE_Y, rx - 2, ry - 2, "rust", "dbrick")
    for x, y, k in pile_leaves():
        lens(g, x, y, *LEAF_COLOURS[k])
    maple(g, 20, 23.7, lift, lift)
    return lit(g, dict(dred=("red", None)))


# The steps' idle: rest, rest, the candle guttering low, then flaring.
PORCH_STEPS_IDLE = (0, 0, 1, 2), 400
# The steps, bottom up: (tread row, left, right). A front elevation, so each is as wide as the next but for a
# 1px setback each side.
STEPS_ROWS = ((30, 5, 35), (23, 6, 34), (16, 7, 33))
# Brick courses: the mortar rows down a riser and the joints' spacing along a course.
COURSE, BRICK = 2, 5


def porch_steps(flicker=0):
    """A short flight of three brick steps up to a porch, a front elevation, so the flight never tapers like
    a tiered cake: each a lit stone tread with a dstone nosing over a red brick riser laid in dbrick courses;
    tall white newel posts under ball caps either side. A jack-o'-lantern sits on the top step, its eyes and
    grin cut dark with a candle glowing amber inside; flicker 1 dims the glow to orange, 2 flares it
    yellow."""
    g = edged(Grid(SIZE, SIZE))
    for top, x0, x1 in STEPS_ROWS:
        bottom = top + (8 if top == STEPS_ROWS[0][0] else 7)
        g.rect(x0, top + 3, x1 - x0, bottom - top - 3, "brick")
        for y in range(top + 3 + COURSE, bottom, COURSE + 1):
            g.rect(x0, y, x1 - x0, 1, "dbrick")
        for y in range(top + 3, bottom, COURSE + 1):
            for x in range(x0 + 2 + (y // (COURSE + 1) % 2) * 2, x1 - 2, BRICK):
                g.rect(x, y, 1, COURSE, "dbrick")
        g.rect(x1 - 2, top + 3, 2, bottom - top - 3, "dbrick")
        g.rect(x0 - 1, top, x1 - x0 + 2, 3, "stone")
        g.rect(x0 - 1, top, x1 - x0 + 2, 1, "lgrey")
        g.rect(x0 - 1, top + 2, x1 - x0 + 2, 1, "dstone")
        g.rect(x1 - 1, top, 2, 2, "dstone")
    # the newel posts either side of the flight, white with ball caps, as tall as the top step
    for x in (1, 35):
        g.rect(x, 15, 4, 22, "white")
        g.rect(x + 3, 15, 1, 22, "lgrey")
        g.rect(x - 1, 13, 6, 2, "white")
        g.rect(x - 1, 14, 6, 1, "lgrey")
        g.cel(x + 2, 10.5, 2.5, 2.5, "white", "lgrey")
    # the jack-o'-lantern on the top step: eyes and a grin cut dark, the candle's glow inside them
    g.cel(20, 12.5, 5, 3.5, "orange", "rust", "amber")
    g.rect(19.5, 7.5, 1.5, 2, "olive")
    glow = ("amber", "orange", "yellow")[flicker]
    for x in (17, 21):
        g.rect(x, 10.5, 2, 2, "plum")
        g.rect(x + 0.5, 11.5, 1, 1, glow)
    g.rect(17.5, 13.5, 5, 1.5, "plum")
    g.rect(18.5, 13.5, 3, 1, glow)
    return lit(g)


# The blanket's idle: rest, rest, the near right corner lifted, rest.
PICNIC_IDLE = (0, 0, 1, 0), 450
# Checks along the blanket, in layout pixels at full size.
CHECK = 6


def picnic_blanket(lift=0, w=obstacles.span(2)):
    """A checked picnic blanket spread on the road, seen from a low camera: a band of red and white checks
    narrowing to its far edge, with a wicker basket standing on it under its arched handle, a baguette
    leaning out from under the lid, a jug of lemonade at the left and two apples at the right. lift raises the
    near right corner 1 drawn pixel and folds it back, showing its dred underside."""
    g = edged(Grid(w, ROW))
    u = obstacles.unit(g)[1]
    # the blanket: a trapezoid, its far edge at row 22, its near edge at 28, checked in dred and white
    for y in range(22, 29):
        inset = (28 - y) * 0.9
        for x0 in range(0, int(w), CHECK):
            left, right = max(2 + inset, x0), min(w - 2 - inset, x0 + CHECK)
            if right <= left:
                continue
            on = (x0 // CHECK + (y - 22) // 2) % 2
            g.rect(left, y, right - left, 1, "dred" if on else "white")
    g.rect(2, 28, w - 4, 1, "red")
    if lift:
        g.rect(w - 9, 28 - u, 7, u, None)
        g.rect(w - 9, 27, 7, 2 * u, "dred")
        g.tri((w - 9, 28), (w - 2, 28 - 2 * u), (w - 2, 28), "plum")
    # a lemonade jug on the left of the blanket, two apples on the right
    g.rect(15, 16, 7, 9, "yellow")
    g.rect(20, 16, 2, 9, "amber")
    g.rect(15, 15, 7, 2, "white")
    g.rect(16, 13, 5, 2, "lgrey")
    g.rect(13, 18, 2, 4, "amber")
    g.rect(16, 19, 4, 1, "amber")
    for x in (w - 24, w - 18):
        g.cel(x, 22.5, 3, 2.8, "red", "dred")
        g.rect(x - 0.5, 18.5, 1, 1.5, "bark")
        g.rect(x + 0.5, 18.5, 1.5, 1, "green")
    # the baguette, leaning out from under the lid at the right, scored across its crust
    bx, bw = w / 2 - 9, 18
    bar(g, (bx + 11, 15), (bx + 20, 6), 3, "tan")
    bar(g, (bx + 12, 15.5), (bx + 21, 6.5), 1, "brown")
    for k in (0.35, 0.6, 0.85):
        g.rect(bx + 11 + 9 * k, 15 - 9 * k - 1, 1, 1, "cream")
    # the handle, an arch over the lid
    for k in range(13):
        t = math.pi * k / 12
        g.rect(w / 2 - 0.75 - math.cos(t) * 7, 13 - math.sin(t) * 8, 1.5, 1.5, "dbrown")
    # the basket: woven ochre, shaded at its right, its lid a brown band lit along its top
    g.rect(bx, 16, bw, 9, "ochre")
    g.rect(bx + bw - 3, 16, 3, 9, "rust")
    for y in range(18, 24, 2):
        for x in range(int(bx) + 1 + (y // 2 % 2), int(bx + bw) - 3, 2):
            g.rect(x, y, 1, 1, "brown")
    g.rect(bx - 1, 13, bw + 2, 3, "brown")
    g.rect(bx - 1, 13, bw + 2, 1, "tan")
    g.rect(bx + bw - 2, 14, 3, 2, "dbrown")
    g.rect(bx, 24, bw, 1, "dbrown")
    return lit(g)


# ---------- hit moments ----------

# The calico's fur tufts, thrown out of the scuffle.
CAT_TUFTS = ("white", "ochre", "dbrown", "white", "ochre", "lgrey")
# The three claw scratches: (x, y) of each slash's top end, on the 64x64 design.
SCRATCHES = ((26, 22), (33, 20), (40, 22))


def scratch(g, x, y, length):
    """A claw scratch slashing down to the left from (x, y), length design pixels long, bowed: red, lit pink on
    its left, tapering to 1px at both ends."""
    n = round(length)
    for k in range(n):
        bow = math.sin(math.pi * k / max(1, n - 1))
        w = 2 if 1 < k < n - 2 else 1
        dots = [(i, 0, "pink" if i == 0 and w > 1 else "red") for i in range(w)]
        hits.dots(g, x - k * 0.45 - bow * 1.5, y + k, dots)


def hit_porch_cat(step):
    """The cat lashes out: a hiss puff swells while three bowed claw scratches slash down across it, red lit
    pink, then the puff breaks up and calico fur tufts fly out and fall."""
    g = hits.Grid(64, 64)
    cx, cy = 32, 36
    if step == 0:
        hits.impact(g, "orange", cx, cy)
        return hits.rim(g)
    r = (0, 9, 12, 13, 12, 10, 0, 0)[step]
    if r:
        def puff(p):
            for k in range(7):
                a = math.radians(k * 360 / 7 + step * 17)
                p.ell(cx + math.cos(a) * r * 0.8, cy + math.sin(a) * r * 0.65, r * 0.5, r * 0.45, "white", "lgrey")
            p.ell(cx, cy, r * 0.8, r * 0.6, "white", "lgrey")
        hits.piece(g, puff)
    elif step == 6:
        hits.piece(g, lambda p: [p.ell(cx + math.cos(math.radians(k * 72 + 30)) * 15,
                                       cy + math.sin(math.radians(k * 72 + 30)) * 11, 3.5, 3, "white", "lgrey")
                                 for k in range(5)])
    length = (0, 10, 20, 22, 22, 18, 0, 0)[step]
    if length:
        def slashes(p):
            for x, y in SCRATCHES:
                scratch(p, x, y + (22 - length) / 2, length)
        hits.piece(g, slashes)
    if step >= 3:
        t = step - 2
        for i, col in enumerate(CAT_TUFTS):
            a = math.radians(i * 60 + 35)
            x = cx + math.cos(a) * (10 + t * 4.5)
            y = cy + math.sin(a) * (8 + t * 3.5) + t * t * 0.5
            if 2 <= x < 59 and 2 <= y < 59:
                hits.piece(g, lambda p: hits.tuft(p, x, y, col, (step + i) % 2))
    return g


# Grass blades thrown up by the capybara: (vx, vy, colour) per blade.
BLADES = ((-8, -9, "green"), (-3, -11, "dgreen"), (4, -10, "green"), (9, -8, "dgreen"), (-11, -4, "green"),
          (12, -3, "green"))


def blade(g, x, y, lean, col):
    """A 3px grass blade leaning lean pixels a row."""
    hits.dots(g, x, y, [(round(k * lean), -k, col) for k in range(3)])


def hit_capybara(step):
    """A soft bump: a cream dust poof with brown fur tufts and grass blades thrown up out of it, then the poof
    settles and a heart rises, since the capybara takes it calmly."""
    g = hits.Grid(64, 64)
    cx, cy = 32, 40
    if step == 0:
        hits.impact(g, "brown", cx, cy)
        return hits.rim(g)
    r = (0, 10, 13, 14, 12, 9, 6, 0)[step]
    if r:
        def poof(p):
            for k in range(6):
                a = math.radians(k * 60 + 15 + step * 11)
                p.ell(cx + math.cos(a) * r * 0.75, cy + math.sin(a) * r * 0.55, r * 0.55, r * 0.45, "cream", "tan")
            p.ell(cx, cy, r * 0.75, r * 0.55, "cream", "tan")
        hits.piece(g, poof)
    if step >= 2:
        t = step - 1
        for i, (vx, vy, col) in enumerate(BLADES):
            x, y = cx + vx * t * 0.7, cy - 2 + vy * t * 0.7 + 0.9 * t * t
            if 3 <= x < 60 and 5 <= y < 60:
                hits.piece(g, lambda p: blade(p, x, y, (vx > 0) - (vx < 0), col))
        for i, (vx, col) in enumerate(((-6, "brown"), (7, "dbrown"), (1, "brown"))):
            x, y = cx + vx * t, cy - 6 - t * 4 + t * t * 0.8
            if 3 <= x < 60 and 3 <= y < 60:
                hits.piece(g, lambda p: hits.tuft(p, x, y, col, (step + i) % 2))
    if step >= 4:
        y = cy - 14 - (step - 4) * 5
        hits.piece(g, lambda p: hits.stamp(p, fx.SMALL if step == 4 else fx.HEART, 30, y))
    return g


# Each burst: its drawing and its frame count, as hits.HITS has them.
HITS = {"fx-hit-porch-cat": (hit_porch_cat, 8), "fx-hit-capybara": (hit_capybara, 8)}


def hit_sprites():
    """Yield (key, tags) for every burst: play, 8 frames at 70ms, as hits.py's."""
    for key, (draw, frames) in HITS.items():
        yield key, [("play", [minis.small(hits, hits.BURST_SCALE, draw, i).outlined(False) for i in range(frames)],
                     70)]


# ---------- sounds ----------

# Each sound: tone() calls as sounds.EFFECTS has them, (wave, seconds, freq, start seconds, options).
EFFECTS = {
    # A hiss falling from a high band to a lower one, then a "mrr" rising into a falling "ow".
    "sfx-hit-porch-cat": [
        ("pinknoise", 0.12, None, 0, dict(vol=1.0, low=7000, high=3200, attack=0.006, release=0.5, shape="h")),
        ("pinknoise", 0.14, None, 0.08, dict(vol=0.9, low=4500, high=1800, attack=0.02, release=0.7, shape="h")),
        ("square", 0.1, (430, 760), 0.24, dict(vol=0.3, duty=35, low=2200, attack=0.015, release=0.3)),
        ("square", 0.16, (760, 520), 0.33, dict(vol=0.3, duty=35, low=2200, attack=0.005, release=0.8, shape="h")),
        ("triangle", 0.1, (215, 380), 0.24, dict(vol=0.45, attack=0.015, release=0.3)),
        ("triangle", 0.16, (380, 260), 0.33, dict(vol=0.45, attack=0.005, release=0.8, shape="h")),
    ],
    # A low "huff" through the nose, then three soft chirps rising, each quieter.
    "sfx-hit-capybara": [
        ("pinknoise", 0.12, None, 0.01, dict(vol=0.5, low=900, high=150, attack=0.025, release=0.7, shape="h")),
        ("triangle", 0.14, (180, 105), 0.01, dict(vol=0.8, attack=0.025, release=0.7, shape="h")),
        ("triangle", 0.06, (880, 1250), 0.18, dict(vol=0.7, attack=0.012, release=0.6)),
        ("triangle", 0.06, (940, 1330), 0.26, dict(vol=0.6, attack=0.012, release=0.6)),
        ("triangle", 0.08, (990, 1450), 0.34, dict(vol=0.5, attack=0.012, release=0.7)),
        ("square", 0.06, (880, 1250), 0.18, dict(vol=0.12, duty=25, low=2500, attack=0.012, release=0.6)),
    ],
}


# Gain after the peak normalization, in dB, for a sound dense enough to sound louder than the other hits at the
# same peak: the cat's meow holds its pitch longer than the other hits' notes.
TRIM_DB = {"sfx-hit-porch-cat": -1.5}


def render_sounds(out_dir):
    """Write every sound into out_dir as .ogg and .m4a, as sounds.render does; return the keys."""
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for key, notes in EFFECTS.items():
            layers = []
            for i, (wave, seconds, freq, start, opts) in enumerate(notes):
                path = f"{tmp}/{key}-{i}.wav"
                sounds.tone(path, sounds.n(seconds), wave, freq, start=sounds.n(start), **opts)
                layers.append(path)
            wav = f"{tmp}/{key}.wav"
            sounds.mix([(path, 1 / len(layers)) for path in layers], wav)
            if key in TRIM_DB:
                sounds.sox(wav, f"{tmp}/{key}-trim.wav", "gain", str(TRIM_DB[key]))
                wav = f"{tmp}/{key}-trim.wav"
            sounds.encode(wav, out_dir, key)
    return list(EFFECTS)


# ---------- card illustrations ----------

# The zones the cards stand on, by game id: Cabbagetown's street and High Park's trail.
CABBAGETOWN, HIGH_PARK = "snoozeCrescent", "park"


def cat_dash(reach=0):
    """The calico bolting, side on facing right: stretched long and low, forelegs flung ahead and hind legs
    kicked back, its tail streaming out behind, its head turned to the player wide-eyed. reach stretches the
    legs further."""
    c = CALICO
    g = edged(Grid())
    r = reach
    for (x0, y0), foot in (((21, 22), (28 + r, 25)), ((8, 22), (1 - r, 25))):
        bar(g, (x0, y0), foot, 2.5, c["coat_sh"])
    bar(g, (5, 19), (0, 13), 2, c["dark"])
    g.cel(14, 20, 10.5, 4, c["coat"], c["coat_sh"])
    g.cel(8, 19, 3.5, 2.8, c["orange"], c["orange_sh"])
    g.cel(15, 17.6, 3.5, 1.6, c["dark"], c["dark_sh"])
    for (x0, y0), foot in (((22, 22), (30 + r, 26)), ((9, 22), (2 - r, 26))):
        bar(g, (x0, y0), foot, 2.5, c["coat"])
    hx, hy = 25, 15
    g.tri((hx - 5, hy - 1), (hx - 4.5, hy - 7), (hx - 1, hy - 3.5), c["dark"])
    g.tri((hx + 5, hy - 1), (hx + 4.5, hy - 7), (hx + 1, hy - 3.5), c["orange"])
    g.cel(hx, hy, 5.5, 4.5, c["coat"], c["coat_sh"])
    g.cel(hx - 2.8, hy - 1.6, 2.6, 2.4, c["dark"], c["dark_sh"])
    for ex in (hx - 3, hx + 1):
        g.rect(ex, hy - 1.5, 2, 2.5, "amber")
        g.rect(ex + 0.5, hy - 1, 1, 1.5, "ink")
    g.rect(hx - 1, hy + 2, 2, 1.5, "pink")
    return lit(g)


def keeper_top(g, b):
    """The zookeeper facing the player: an olive work shirt with a pocket and a tan bush hat, one arm held out
    low with the lead (screen right; the card mirrors him)."""
    g.rect(9, 21 + b, 14, 13, "olive")
    g.rect(20, 21 + b, 3, 13, "dolive")
    g.rect(9, 21 + b, 1, 12, "moss")
    g.rect(11, 24 + b, 4, 3, "dolive")
    g.rect(15, 21 + b, 2, 3, "moss")
    g.rect(5, 22 + b, 4, 9, "olive")
    g.rect(5, 31 + b, 4, 3, "skin1")
    road.back_arm(g, 23, 4, 22 + b, ((8, "olive", None), (3, "skin1", None)), out=1)
    road.face_disc(g, 16, 13.5 + b, 7.5, 7.5, "skin1", "skin2")
    road.face_front(g, 16, 14 + b)
    g.cel(16, 8 + b, 7.5, 3.5, "tan", "brown", "cream")
    g.rect(5, 9 + b, 22, 2, "tan")
    g.rect(5, 10 + b, 22, 1, "brown")
    g.rect(9, 7 + b, 14, 1, "dbrown")


def picture(img):
    """A drawn grid's outlined frame as an image."""
    return to_image(img.outlined())


def speed_lines(a, pts, col="white", down=False):
    """Speed lines: (x, y, length) runs along a row, or down a column when down (a dog going up the road)."""
    for x, y, n in pts:
        a.fill(x, y, *((1, n) if down else (n, 1)), col)


def porch_cat_shoo():
    """Shoo: the cat bolts off the left edge past speed lines, Archie standing calm on his leash."""
    a = cards.Art()
    a.ground(CABBAGETOWN)
    cat = picture(drawn(ANIMAL, cat_dash, reach=1))
    a.paste(cat, -10, 6, flip=True)
    speed_lines(a, ((36, 14, 7), (39, 19, 9), (34, 24, 6)))
    c = a.dog("archie", "idle", 58, 56)
    a.lead(58, c, 64)
    return a


def porch_cat_treat():
    """Treat bribe: the cat lounges over a treat under rising hearts, Archie sitting calm beside it."""
    a = cards.Art()
    a.ground(CABBAGETOWN)
    a.put("porch-cat", "idle", 21, 42)
    a.paste(sn.frame("treat", "idle"), 33, 24)
    a.hearts([(14, 4), (26, 1)])
    c = a.dog("archie", "idle", 60, 56)
    a.lead(60, c, 66)
    return a


def porch_cat_bolt():
    """Bolt past: Archie pulls hard past the lounging cat, speed lines behind him, the leash taut."""
    a = cards.Art()
    a.ground(CABBAGETOWN)
    a.put("porch-cat", "idle", 22, 34)
    c = a.dog("archie", "pull", 50, 58)
    a.lead(48, c, 34, 2)
    speed_lines(a, ((24, 42, 8), (20, 47, 10), (26, 52, 6)))
    return a


def capybara_help():
    """Help the keeper: the zookeeper in khaki and a bush hat leads the capybara off on a rope, a heart over
    the capybara."""
    a = cards.Art()
    a.ground(HIGH_PARK)
    a.put("capybara", "walk", 22, 50, 1)
    keeper = picture(road.drawn(road.SCALE, road.dressed, keeper_top, legs="clay", shoes="dbrown"))
    a.paste(keeper, 40, -3, flip=True)
    a.line(33, 29, 47, 43, "bark")
    a.line(34, 29, 48, 43, "walnut")
    a.heart(16, 8, "red", "pink")
    return a


def phone(a, x, y, ring):
    """A 9x14 mobile phone at (x, y): a navy body, a cyan screen with a green call key, and ring arcs either
    side when ring."""
    a.fill(x, y, 9, 14, "ink")
    a.fill(x + 1, y + 1, 7, 12, "navy")
    a.fill(x + 2, y + 2, 5, 7, "cyan")
    a.fill(x + 2, y + 2, 5, 1, "white")
    a.fill(x + 3, y + 10, 3, 2, "green")
    if ring:
        for d in (2, 4):
            a.fill(x - d, y + 3, 1, 8, "white")
            a.fill(x + 8 + d, y + 3, 1, 8, "white")


def capybara_call_zoo():
    """Call the zoo: a phone rings in a callout over the capybara, chewing on the trail, Archie waiting on his
    leash."""
    a = cards.Art()
    a.ground(HIGH_PARK)
    a.put("capybara", "idle", 24, 44)
    a.paste(to_image(cards.chrome(Grid(21, 22), 0, 0, 21, 22).px), 4, 2)
    phone(a, 10, 6, True)
    c = a.dog("archie", "idle", 58, 58)
    a.lead(58, c, 62)
    return a


def capybara_keep_walking():
    """Keep walking: Archie and Duchess trot on up the trail past speed lines, the capybara left behind,
    chewing at the side."""
    a = cards.Art()
    a.ground(HIGH_PARK)
    a.put("capybara", "idle", 15, 34)
    c2 = a.dog("duchess", "walk", 63, 46, 2)
    c1 = a.dog("archie", "walk", 41, 57, 1)
    a.lead(41, c1, 48)
    a.lead(63, c2, 56)
    speed_lines(a, ((27, 46, 6), (58, 48, 6), (68, 48, 5)), down=True)
    return a


ILLUSTRATIONS = {
    "card-porch-cat-shoo": porch_cat_shoo,
    "card-porch-cat-treat": porch_cat_treat,
    "card-porch-cat-bolt": porch_cat_bolt,
    "card-capybara-help": capybara_help,
    "card-capybara-call-zoo": capybara_call_zoo,
    "card-capybara-keep-walking": capybara_keep_walking,
}


def card(key, scale=1):
    """The illustration in an encounter card frame, cost plaque included, as cards.mock_card shows one."""
    from PIL import Image

    im = to_image(cards.card_frame("encounter").px)
    im.paste(to_image(cards.card_cost().px), (6, 121))
    im.paste(ILLUSTRATIONS[key]().img, (4, 16))
    bg = Image.new("RGB", im.size, sn.rgb("dbrown"))
    bg.paste(im, (0, 0), im)
    return bg.resize((bg.width * scale, bg.height * scale), Image.NEAREST)


# ---------- sprites ----------

def road_sprites(suffix, step):
    """Yield (key + suffix, tags) for every road sprite at depth step step."""
    a, o = ANIMAL * step, OBSTACLE * step

    def frames(s, draw, poses):
        return [drawn(s, draw, **q).outlined() for q in poses]

    yield f"porch-cat{suffix}", [("idle", frames(a, porch_cat, PORCH_CAT_IDLE), 300),
                                 ("walk", frames(a, porch_cat, PORCH_CAT_WALK), road.PERSON_WALK_MS)]
    yield f"capybara{suffix}", [("idle", frames(a, capybara, CAPYBARA_IDLE), 300),
                                ("walk", frames(a, capybara, CAPYBARA_WALK), CAPYBARA_WALK_MS)]
    for key, draw, (args, ms) in (("leaf-pile", leaf_pile, LEAF_PILE_IDLE),
                                  ("porch-steps", porch_steps, PORCH_STEPS_IDLE),
                                  ("picnic-blanket", picnic_blanket, PICNIC_IDLE)):
        yield f"{key}{suffix}", [("idle", [minis.small(sys.modules[__name__], o, draw, f).outlined() for f in args],
                                  ms)]


# Where each road sprite's .aseprite source goes: the card obstacles with the encounters, the rest with the
# obstacles.
SOURCES = {"porch-cat": "art/encounters", "capybara": "art/encounters", "leaf-pile": "art/obstacles",
           "porch-steps": "art/obstacles", "picnic-blanket": "art/obstacles"}


def sprites():
    """Every road sprite at full size, then at each depth step."""
    yield from road_sprites("", 1)
    for suffix, s in STEPS:
        yield from road_sprites(f"@{suffix}", s)


def preview(out_dir):
    """Sheets of every road sprite and burst on the zone roads, every illustration in a card, and the sounds."""
    from PIL import Image

    os.makedirs(out_dir, exist_ok=True)
    sheet(depth_settled(list(sprites())), f"{out_dir}/road.png", ZONE_ROADS, scale=3)
    sheet(list(hit_sprites()), f"{out_dir}/hits.png", ZONE_ROADS[:3], scale=3)
    faces = [card(key, 3) for key in ILLUSTRATIONS]
    cards_sheet = Image.new("RGB", (sum(f.width + 12 for f in faces), faces[0].height), sn.rgb("ink"))
    for i, f in enumerate(faces):
        cards_sheet.paste(f, (i * (f.width + 12), 0))
    cards_sheet.save(f"{out_dir}/cards.png")
    render_sounds(out_dir)


def build():
    """Export the road sprites and bursts, then the illustrations composed from them, then the sounds."""
    road_keys = list(sprites())
    for src in dict.fromkeys(SOURCES.values()):
        build_sprites([(k, t) for k, t in road_keys if SOURCES[k.split("@")[0]] == src], src)
    build_sprites(list(hit_sprites()), "art/hits")
    os.makedirs("art/cards", exist_ok=True)
    for key, draw in ILLUSTRATIONS.items():
        png = f"public/art/images/{key}.png"
        draw().img.save(png)
        subprocess.run(["aseprite", "-b", png, "--save-as", f"art/cards/{key}.aseprite"], check=True)
    print("built", ", ".join(ILLUSTRATIONS))
    print("built", ", ".join(render_sounds("public/art/sounds")))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        preview(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
