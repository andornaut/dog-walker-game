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

Movers, laid out and drawn as the card obstacles are, side views facing right; the game mirrors
them for a crossing to the left, as it does hazards.py's squirrel-dash. The hen keeps
squirrel-dash's tags, frame counts and durations, and the ferrets keep animals.py's chase-cat's,
the cat's dart:
ferrets             96x48, 2 lanes: two ferrets bounding across together nose to tail, a cream
                    champagne behind and a little up the road, a sable ahead and nearer: long low
                    bodies arched along the spine, short dark legs, tapering dark tails, a mask
                    band across each face round a dark eye patch and a pink nose. idle (2 frames,
                    300ms): standing at the road's edge on all four paws under a gentle arch, then
                    the sable's head lifting to sniff the air and the champagne's tail flicking up.
                    run (4 frames, 80ms): the bound, the back arched high with the paws gathered,
                    the hind paws pushing off, stretched long in flight, the front paws landing,
                    the champagne a frame behind the sable
hen                a Riverdale Farm hen got loose, a Rhode Island Red: a plump rust body lit
                    ochre, a short plum tail cocked up, dbrown wings with a brick band, a red
                    comb and wattle, an amber beak and yellow legs, a little taller than
                    squirrel-dash. idle (2 frames, 400ms): standing at the road's edge, neck up,
                    then the head jerking forward. run (4 frames, 80ms): a flapping scramble, the
                    neck stretched forward and the body bobbing, the near wing beating up, back,
                    down and back while the legs run

Minor obstacles, laid out in obstacles.py's pixels (40 for one lane, 30 rows for a
lane-spanning one) and drawn at obstacles.SCALE (1.2) on a minis.Mini:
fallen-log          112x36  2 lanes, a fallen oak trunk lying across the path: five long bark ridges, a
                            sawn end at the right showing growth rings, a splintered broken end at the
                            left, a branch stub, two moss patches and two tan-capped mushrooms on its
                            back and four fallen leaves along its foot;
                            idle (4 frames, 450ms): a leaf on its back stirs 1px on frame 2
leaf-pile           48x48   1 lane, a raked dome of autumn leaves cel shaded orange, lit amber and
                            shaded rust, its rim ragged with gold, amber and rust leaves and a few more
                            over its face, a red maple leaf on top; idle (4 frames,
                            400ms): the maple leaf lifts 1px and turns over on frame 2
little-free-library 48x48   1 lane, a little free library: a turquoise cabinet shaped like a tiny
                            house under a brick-shingled gable with a cream bargeboard and finial,
                            its cream-framed glass door showing two shelves of bright book spines,
                            on a cream post set in a wooden planter of leaves; idle (4 frames,
                            400ms): a glint crosses the glass, its left half on frame 2 and its
                            right half on frame 3
picnic-blanket      112x36  2 lanes, a red and white checked blanket on the road with a plain ochre basket
                            on it, a baguette leaning out of the basket, a lemonade jug and two
                            apples; idle (4 frames, 450ms): the blanket's near right corner lifts
                            1px in a breeze on frame 2
porch-steps         48x48   1 lane, three brick steps with stone treads in a front elevation,
                            tall white newel posts under ball caps either side,
                            a jack-o'-lantern with a dark carved face on the top step;
                            idle (4 frames, 400ms): its candle dims on frame 2 and flares on frame 3

Each road sprite also has <key>@<step> for each depth step in minis.STEPS (from
shared/depth-steps.json), redrawn at the step with the original's tags, frames and
durations and a full outline. Road outline (pixel.road_edge) and road.LIT's rim on dark
fills, so every one holds 3:1 on every road.

Hit moments, 77x77, laid out on hits.py's 64x64 design and drawn at hits.BURST_SCALE, each
opening on hits.impact's eight-point star in the encounter's colour:
fx-hit-porch-cat    play (8 frames, 70ms)  a hiss puff with three red claw scratches across it,
                                           calico fur tufts flying out
fx-hit-capybara     play (8 frames, 70ms)  a soft dust poof with grass blades and brown fur
                                           tufts thrown up, then a calm heart rising

Sounds, in sounds.py's format and rendered by its render_effects:
sfx-hit-porch-cat   0.49s  a hiss of pink noise stepping down two bands, then a square "mrr" rising
                           into a falling "ow"
sfx-hit-capybara    0.44s  a low square "huff", then three soft rising triangle chirps

Card illustrations, 75x56, composed from the exported sprites as cards.py composes its own:
card-porch-cat-stand        Archie standing firm on his leash while the cat swipes up at his
                            nose, plum-rimmed white claw slashes and a red scratch on his cheek
card-porch-cat-treat        the cat lounging over a treat under rising hearts, Archie sitting
                            calm beside it
card-porch-cat-bolt         Archie pulling hard past the lounging cat, speed lines behind it
card-capybara-help          the zookeeper in an olive shirt and a bush hat leading the capybara
                            off on a rope, a heart over the capybara
card-capybara-call-zoo      a phone ringing in a callout over the capybara, chewing on the
                            trail, Archie waiting on his leash
card-capybara-drag          the capybara chewing up the trail, Archie and Biscuit leaning hard
                            toward it, hauled away on leashes taut off the bottom right, skid
                            marks and dust at their paws

Usage:
  hood_parks.py preview OUT_DIR   OUT_DIR/road.png (every road sprite and depth step on the
                                  zone roads), OUT_DIR/hits.png, OUT_DIR/cards.png (every
                                  illustration in a card frame) and the sounds
  hood_parks.py sounds OUT_DIR    write the two sounds into OUT_DIR only
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
from pixel import K, raster, road_edge, scale_of  # noqa: E402
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


def porch_cat(tail=0, blink=False, near=0, far=0, bob=0, sway=0, swipe=False):
    """A calico lounging on its side, facing right, its head raised and turned to the player. tail moves the
    curled tip up or down (negative is up), blink shuts the eyes to lids, near and far push the front paws
    ahead, bob lifts the body (negative is up), sway swings the tail sideways. swipe, for the cards only,
    raises the near front paw up and out ahead, claws out, and narrows the eyes. Its coat is white, so it
    reads apart from the tuxedo chase-cat and the ginger ambient-cat; the road outline holds it on the light
    roads.
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
    if swipe:
        # near front paw raised up and out ahead of the chest, its claws out
        bar(g, (20, 25 + b), (28, 19 + b), 2.2, c["coat"])
        g.cel(28.5, 18.5 + b, 1.6, 1.6, c["coat"], c["coat_sh"])
        for dy in (-1.5, 0, 1.5):
            g.p(30.5, 18.5 + b + dy, "ink")
    else:
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
        if swipe:
            g.rect(ex, hy, 2, 1, "amber")
            g.rect(ex + 1, hy - 1, 1, 2, "ink")
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


# ---------- hen ----------

# A Rhode Island Red: rust feathers shaded dbrown and lit ochre, a plum tail shaded walnut, dbrown wings with a
# brick covert band, a red comb and wattle shaded dred, an amber beak and yellow legs shaded amber. The tail's
# shade is walnut, not ink, so road.LIT gives it no cool rim and its tips stay solid at the small steps.
HEN = dict(feather="rust", shade="dbrown", lit="ochre", tail="plum", tail_sh="walnut", wing="dbrown", wing_sh="plum",
           band="brick", comb="red", comb_sh="dred", beak="amber", leg="yellow", leg_sh="amber")
# Its scramble across the road, one dict per frame, read like hazards.SQUIRREL_RUN: body lift, the wing's
# stroke, and the near and far feet (x, y of the foot's top-left). A design unit is 1.5px at full size, so
# thirds land on whole pixels.
HEN_RUN = (
    dict(bob=0, wing="up", near=(16, 27 + 1 / 3), far=(13 + 1 / 3, 27 + 1 / 3)),                # gathered
    dict(bob=-2 / 3, wing="mid", near=(11 + 1 / 3, 26 + 2 / 3), far=(18 + 2 / 3, 26)),           # push off
    dict(bob=-4 / 3, wing="down", near=(18, 25 + 1 / 3), far=(12, 26)),                          # flight
    dict(bob=-2 / 3, wing="mid", near=(18 + 2 / 3, 27 + 1 / 3), far=(12 + 2 / 3, 26 + 2 / 3)),   # lands
)
# Waiting at the road's edge: standing on both feet, the neck up, then the head jerking forward into the run's
# stretch, a whole design unit or more apart so the two frames differ at every depth step.
HEN_IDLE = (dict(bob=0, wing="fold", near=(16, 27 + 1 / 3), far=(13 + 1 / 3, 27 + 1 / 3), reach=-2),
            dict(bob=0, wing="fold", near=(16, 27 + 1 / 3), far=(13 + 1 / 3, 27 + 1 / 3), reach=0))


def hen(bob=0, wing="fold", near=(16, 27 + 1 / 3), far=(13 + 1 / 3, 27 + 1 / 3), reach=0):
    """A Riverdale Farm hen got loose, side view facing right, small beside the pack as the squirrel is: a
    plump rust body, a short plum tail cocked up behind, the neck stretched forward to a small head under a
    red comb, a red wattle under an amber beak, on thin yellow legs. bob lifts the body (negative is up),
    wing is the near wing's stroke (fold, up, mid or down), near and far are the feet, and reach pulls the
    head back and up from its running stretch (negative is back)."""
    c = HEN
    g = edged(Grid())
    u = 2 / 3
    b = bob

    def leg(foot, col, sh):
        fx, fy = foot
        # the shank from the hip down to the foot, then three toes forward and one back
        bar(g, (14.8, 24 + b), (fx + u, fy), 2 * u, col)
        g.rect(fx - u, fy, 3, u, col)
        g.rect(fx + 2 * u, fy + u / 2, u, u, sh)

    leg(far, c["leg_sh"], c["leg_sh"])
    # the tail: a short fan of plum feathers cocked up and back from the rump, rounded at the tips
    g.tri((11.5, 21 + b), (7, 11 + b), (13.5, 17 + b), c["tail"])
    g.tri((11, 21.5 + b), (5, 13 + b), (9, 13 + b), c["tail"])
    g.cel(7.2, 12.4 + b, 1.8, 1.6, c["tail"], c["tail_sh"])
    g.cel(6, 14.2 + b, 1.3, 1.4, c["tail"], c["tail_sh"])
    # the body: a plump egg, its breast full and round at the front
    g.cel(14.5, 21 + b, 5.4, 4.6, c["feather"], c["shade"], c["lit"])
    g.cel(18.2, 20.6 + b, 3.4, 3.9, c["feather"], c["shade"], c["lit"])
    # the neck, stretched forward and up to the head
    hx, hy = 24.5 + reach / 2, 14.5 + b + reach
    bar(g, (18.5, 19 + b), (hx - 0.6, hy + 0.6), 3.6, c["feather"])
    leg(near, c["leg"], c["leg_sh"])
    # the near wing: folded along the side, or beating up and down in its panic, a brick band over its
    # dbrown flight feathers
    if wing == "fold":
        g.cel(14, 20.8 + b, 4.2, 2.6, c["wing"], c["wing_sh"])
        g.cel(15, 19.6 + b, 3.2, 1.2, c["band"])
    else:
        tip, back = {"up": ((13.5, 8 + b), (9, 10.5 + b)), "mid": ((5, 18 + b), (7, 21.5 + b)),
                     "down": ((12, 28 + b), (8, 25.5 + b))}[wing]
        g.tri((11.5, 20.5 + b), (17.5, 19 + b), tip, c["wing"])
        g.tri((11.5, 20.5 + b), tip, back, c["wing_sh"])
        # the leading edge lit brick from the shoulder to the tip
        bar(g, (17, 19 + b), tip, 1, c["band"])
        g.cel(15, 19.6 + b, 3, 1.4, c["band"])
    # the head: a red comb of three points on top, the beak, the wattle hanging under it, a bright eye
    g.cel(hx - 1.4, hy - 2.2, 0.9, 1, c["comb"])
    g.cel(hx - 0.1, hy - 2.6, 0.9, 1.1, c["comb"])
    g.cel(hx + 1.1, hy - 2.1, 0.8, 0.9, c["comb"])
    g.cel(hx, hy, 2.2, 2, c["feather"], c["shade"], c["lit"])
    g.tri((hx + 1.6, hy - 0.8), (hx + 4, hy + 0.2), (hx + 1.6, hy + 1), c["beak"])
    g.cel(hx + 1.6, hy + 2.2, 0.8, 1.1, c["comb"], c["comb_sh"])
    g.rect(hx + 0.2, hy - 0.8, 2 * u, 2 * u, "ink")
    g.p(hx + 0.2, hy - 0.8, "white")
    return lit(g)


# ---------- ferrets ----------

# The pair's coats: a sable, dbrown shaded plum with plum legs and tail and a cream mask band, and a champagne,
# cream shaded tan with clay legs and tail and a white mask band. Each mask's eye patch is its legs' colour.
SABLE = dict(coat="dbrown", shade="plum", leg="plum", far="walnut", band="cream", patch="plum")
CHAMPAGNE = dict(coat="cream", shade="tan", leg="clay", far="tan", band="white", patch="clay")
# The frame, in design units: two ferrets nose to tail across 2 lanes, 96x48 at full size.
FERRETS_W = 64
# Each ferret's bound, one tuple per frame, in design units from its rump column and its ground row: hip and
# shoulder (x, y), the back's arch above the line between them, the front and hind paws (x, y of the paw's
# bottom) and the tail's lift. A design unit is 1.5px at full size, so thirds land on whole pixels.
FERRET_BOUND = (
    ((7, -6), (16, -6), 6, (17, 0), (13, 0), 0),                                 # gathered, the back arched
    ((6, -6 - 1 / 3), (19, -7), 3 + 1 / 3, (23, -1 / 3), (6, 0), -1 / 3),          # hind push off
    ((5, -7 - 2 / 3), (20, -8), 1 + 1 / 3, (25, -2), (1, -2), 2 / 3),               # flight, stretched long
    ((6, -7), (18, -6 - 2 / 3), 3 + 1 / 3, (21, 0), (10, -1 - 1 / 3), 0),          # front lands
)
# Waiting at the road's edge: standing on all four paws under a gentle arch, the near ferret's head lifting to
# sniff the air and the far one's tail flicking up.
FERRET_STAND = ((7, -6), (17, -6 - 1 / 3), 3 + 1 / 3, (18, 0), (7, 0), 0)
# The pair: (rump column, ground row) of the far ferret, behind and a little up the road, then the near one.
FERRET_SPOTS = ((4, 28), (33, 29 + 1 / 3))


def ferret(g, x0, gy, c, bound, sniff=0, flick=0):
    """One ferret bounding right, side on, its rump at column x0 and its paws on row gy: a long low body arched
    along its spine, short legs, a tapering tail and a small wedge head with round ears, a mask band across the
    face and a pink nose. bound is a FERRET_BOUND tuple, sniff lifts the head (in design units) and flick the
    tail."""
    (hx, hy), (sx, sy), arch, (fx, fy), (bx, by), tail = bound
    hx, sx, fx, bx = x0 + hx, x0 + sx, x0 + fx, x0 + bx
    hy, sy, fy, by = gy + hy, gy + sy, gy + fy, gy + by
    r = 2 + 1 / 3
    mx, my = (hx + sx) / 2, (hy + sy) / 2 - 2 * arch

    def spine(t):
        return ((1 - t) ** 2 * hx + 2 * t * (1 - t) * mx + t * t * sx,
                (1 - t) ** 2 * hy + 2 * t * (1 - t) * my + t * t * sy)

    def leg(top, paw, col):
        bar(g, top, (paw[0], paw[1] - 1), 2, col)
        g.rect(paw[0] - 1, paw[1] - 4 / 3, 2 + 2 / 3, 4 / 3, col)

    # far legs, a step behind the near ones
    leg((sx - 1, sy + 1), (fx - 2, fy), c["far"])
    leg((hx + 1, hy + 1), (bx + 2, by), c["far"])
    # the tail, tapering back from the rump
    tx, ty = hx - 8, hy + 1 + tail + flick
    bar(g, (hx - 1, hy - 0.5), (tx + 4, ty - 0.5), 3, c["leg"])
    bar(g, (tx + 4, ty - 0.5), (tx, ty), 2, c["leg"])
    # the body along the spine: shade, then the coat a little up and left, so the shade is a crescent below
    steps = [k / 12 for k in range(13)]
    for t in steps:
        x, y = spine(t)
        g.ell(x, y, r, r, c["shade"])
    for t in steps:
        x, y = spine(t)
        g.ell(x - 1 / 3, y - 2 / 3, r - 2 / 3, r - 2 / 3, c["coat"])
    # near legs
    leg((sx + 1 / 3, sy + 1), (fx, fy), c["leg"])
    leg((hx + 1, hy + 1), (bx, by), c["leg"])
    # the head: a wedge reaching forward from the shoulder, a round ear behind the eye, the mask band over
    # the brow and muzzle and the dark patch round the eye, the pink nose at the tip
    ex, ey = sx + 4 + 1 / 3, sy - 1 - sniff
    g.ell(ex - 2 - 1 / 3, ey - 1 - 2 / 3, 1 + 2 / 3, 1 + 2 / 3, c["shade"])
    g.ell(ex, ey, 3, 2 + 1 / 3, c["coat"])
    g.tri((ex + 1, ey - 2), (ex + 5 + 1 / 3, ey + 1), (ex + 1, ey + 2 + 1 / 3), c["coat"])
    g.tri((ex - 2, ey - 2), (ex + 5 + 1 / 3, ey + 1), (ex - 2, ey + 2), c["band"])
    g.rect(ex - 1 / 3, ey - 1, 2 + 2 / 3, 2, c["patch"])
    g.rect(ex + 1 / 3, ey - 1, 4 / 3, 4 / 3, "walnut")
    g.rect(ex + 4, ey + 1 / 3, 4 / 3, 4 / 3, "pink")


def ferrets(near=FERRET_STAND, far=FERRET_STAND, sniff=0):
    """A pair of ferrets bounding across the road together, side view facing right: a champagne behind and
    up the road, a sable ahead and nearer, nose to tail, so the pair reads as one. near and far are each
    one's FERRET_BOUND pose; sniff lifts the sable's head and flicks the champagne's tail."""
    g = edged(Grid(FERRETS_W, 32), lambda c: road_edge(K["cream"] if c == K["white"] else c))
    (fx, fy), (nx, ny) = FERRET_SPOTS
    ferret(g, fx, fy, CHAMPAGNE, far, flick=-sniff)
    ferret(g, nx, ny, SABLE, near, sniff=sniff)
    return lit(g)


# The run, 4 frames, the far ferret a frame behind the near one; and the stand at the road's edge, 2 frames.
FERRETS_RUN = tuple(dict(near=FERRET_BOUND[k], far=FERRET_BOUND[k - 1]) for k in range(4))
FERRETS_IDLE = (dict(), dict(sniff=1 + 1 / 3))


# ---------- minor obstacles ----------

SIZE, ROW = obstacles.SIZE, obstacles.ROW

# Autumn leaves, each a fill and the shade of its lower half, from the lightest (the heap's top left, facing
# the light) to the darkest (its lower right).
LEAF_COLOURS = (("gold", "amber"), ("amber", "ochre"), ("orange", "rust"), ("ochre", "brown"), ("rust", "dbrick"),
                ("brown", "dbrown"))
# The heap's leaves: (fill, shade) on its lit upper left, its orange middle and its rust lower right.
PILE_COLOURS = (("gold", "amber"), ("amber", "ochre"), ("rust", "dbrick"))
# The rows of leaves along the heap's rim, RIM_STEP apart, and the ones over its face: (left column, top row,
# tone).
RIM_STEP = 3
FACE_LEAVES = ((11, 29, 0), (17, 34, 1), (21, 28, 1), (27, 33, 2))
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


def pile_leaves():
    """(x, y, colour index into PILE_COLOURS) for every leaf drawn on the heap, back rows first: the two at each
    row's ends, their tips on the dome's rim so it is ragged all round, then a few over its face, each in the
    tone of the band it lies on."""
    out = []
    rx, ry = PILE_R
    for y in range(PILE_Y - ry + 1, PILE_Y - 3, RIM_STEP):
        half = rx * math.sqrt(max(0, 1 - ((y + 2 - PILE_Y) / ry) ** 2))
        if 2 * half < 2 * LEAF:
            out.append((PILE_X - LEAF / 2, y, 0))
            continue
        out += [(PILE_X - half, y, 0), (PILE_X + half - LEAF, y, 2 if y > PILE_Y - ry / 2 else 1)]
    return out + list(FACE_LEAVES)


def leaf_pile(lift=0):
    """A raked heap of autumn leaves: a low dome cel shaded orange, lit amber on its upper left and shaded rust
    on its lower right, a few big leaves along its rim standing proud so its edge is ragged with their tips and
    a few more over its face, each lit on its upper half; a red maple leaf lies on top, its edge lit red rather
    than pink so it never reads as a heart. lift raises the maple leaf 1 drawn pixel and turns it over."""
    g = edged(Grid(SIZE, SIZE))
    rx, ry = PILE_R
    g.cel(PILE_X, PILE_Y, rx - 2, ry - 2, "orange", "rust", "amber")
    for x, y, k in pile_leaves():
        lens(g, x, y, *PILE_COLOURS[k])
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
    a tiered cake: each a lit stone tread with a dstone nosing over a red brick riser laid in dbrick courses
    (below obstacles.TEXTURE_MIN, one course line and no joints);
    tall white newel posts under ball caps either side. A jack-o'-lantern sits on the top step, its eyes and
    grin cut dark with a candle glowing amber inside; flicker 1 dims the glow to orange, 2 flares it
    yellow."""
    g = edged(Grid(SIZE, SIZE))
    fine = scale_of(g) >= obstacles.TEXTURE_MIN
    for top, x0, x1 in STEPS_ROWS:
        bottom = top + (8 if top == STEPS_ROWS[0][0] else 7)
        g.rect(x0, top + 3, x1 - x0, bottom - top - 3, "brick")
        for y in range(top + 3 + COURSE, bottom, COURSE + 1) if fine else (top + 5,):
            g.rect(x0, y, x1 - x0, 1, "dbrick")
        for y in range(top + 3, bottom, COURSE + 1) if fine else ():
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


# The library's idle: rest, rest, a glint crossing the glass door's left half, then its right half.
LIBRARY_IDLE = (0, 0, 1, 2), 400
# The book spines on each shelf, left to right: (colour, top row). Each is 2 layout pixels wide.
# Four colours in turn; below obstacles.TEXTURE_MIN each pair of spines is drawn as one, so no spine is 1px.
UPPER_BOOKS = (("ttc", 15), ("gold", 16), ("sky", 15), ("green", 16), ("ttc", 15), ("gold", 16),
               ("sky", 15), ("green", 16), ("ttc", 15))
LOWER_BOOKS = (("sky", 21), ("green", 20), ("ttc", 21), ("gold", 20), ("sky", 21), ("green", 20),
               ("ttc", 21), ("gold", 20), ("sky", 21))


def little_free_library(glint=0):
    """A little free library: a turquoise cabinet shaped like a tiny house, a front elevation, its pitched
    roof's gable edged in brick shingles over a cream bargeboard, an open book painted in the gable, a finial
    at the peak. Its cream-framed glass door shows two shelves of book spines in four bright colours on a dark teal
    back, a gold knob at its right. It stands on a cream post with brackets under its sill, the post set in a
    small wooden planter of leaves.
    glint 1 and 2 run a white glint across the glass, left then right, 2px wide down to obstacles.TEXTURE_MIN;
    at rest a short glint sits in its top left corner."""
    g = edged(Grid(SIZE, SIZE))
    # the planter: a wooden box lit tan along its cap, shaded down its right, leaves heaped round the post
    g.rect(12, 32, 16, 6, "brown")
    g.rect(12, 31, 16, 2, "tan")
    g.rect(26, 33, 2, 5, "dbrown")
    g.rect(13, 35, 13, 1, "dbrown")
    for x, y in ((14.5, 30.5), (25, 30.5), (17, 29.8), (23, 29.8)):
        g.cel(x, y, 2.4, 1.8, "green", "dgreen")
    # the post, cream shaded tan at its right, and the brackets under the sill
    g.rect(18, 25, 4, 7, "cream")
    g.rect(21, 25, 1, 7, "tan")
    g.tri((15, 25), (18, 25), (18, 28), "cream")
    g.tri((22, 25), (25, 25), (22, 28), "tan")
    # the cabinet: turquoise, its right side in shade, on a cream sill
    g.rect(8, 12, 24, 13, "turquoise")
    g.rect(29, 12, 3, 13, "dturq")
    g.rect(7, 24, 26, 2, "cream")
    g.rect(7, 25, 26, 1, "tan")
    # the door: a cream frame round the glass, the books on two shelves inside on a dark teal back
    g.rect(10, 13, 19, 11, "cream")
    g.rect(11, 14, 17, 9, "teal")
    fine = scale_of(g) >= obstacles.TEXTURE_MIN
    for books in (UPPER_BOOKS, LOWER_BOOKS):
        for i, (c, top) in enumerate(books):
            x = 11 + i * 2
            bottom = 19 if books is UPPER_BOOKS else 23
            c, top = books[i if fine else i // 2 * 2]
            g.rect(x, top, min(2, 28 - x), bottom - top, c)
    g.rect(11, 19, 17, 1, "brown")
    g.rect(27, 17, 1, 2, "gold")
    # the glint on the glass: a short diagonal at rest in the top left corner, crossing the door when it runs
    u = obstacles.unit(g)[0]
    x0 = (12, 15, 21)[glint]
    for k in range(4 if glint else 2):
        for w in ((0, u) if glint and scale_of(g) >= obstacles.TEXTURE_MIN else (0,)):
            g.rect(x0 + k * u + w, 18 - k * u - (1 if glint else 2), u, u, "white")
    # the roof: a gable edged in brick shingles over a cream bargeboard, lit along its left slope
    g.tri((4, 13), (20, 2), (36, 13), "brick")
    g.tri((20, 2), (36, 13), (20, 13), "dbrick")
    g.tri((9, 12.5), (20, 5), (31, 12.5), "cream")
    g.tri((11, 12.5), (20, 6.5), (29, 12.5), "turquoise")
    g.tri((20, 6.5), (29, 12.5), (20, 12.5), "dturq")
    for k in range(4):
        t = (k + 0.5) / 4
        g.rect(4 + 16 * t - 0.5, 13 - 11 * t + 1, 1, 1, "dbrick")
        g.rect(36 - 16 * t, 13 - 11 * t + 1, 1, 1, "walnut")
    g.rect(4, 12, 32, 1, "dbrick")
    # an open book painted cream in the gable, and the finial at the peak
    g.tri((16.5, 9.5), (20, 10.5), (20, 12), "cream")
    g.tri((23.5, 9.5), (20, 10.5), (20, 12), "cream")
    g.rect(19.5, 10.5, 1, 1.5, "tan")
    g.rect(19, 1, 2, 2, "cream")
    return lit(g, dict(brick=("clay", None), dbrick=("brick", None), dturq=("turquoise", None)))


# The blanket's idle: rest, rest, the near right corner lifted, rest.
PICNIC_IDLE = (0, 0, 1, 0), 450
# Checks along the blanket, in layout pixels at full size.
CHECK = 6


def picnic_blanket(lift=0, w=obstacles.span(2)):
    """A checked picnic blanket spread on the road, seen from a low camera: a band of red and white checks
    narrowing to its far edge, with an ochre basket standing on it under its arched handle, a baguette
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
    # the baguette, leaning out from under the lid at the right
    bx, bw = w / 2 - 9, 18
    bar(g, (bx + 11, 15), (bx + 20, 6), 3, "tan")
    bar(g, (bx + 12, 15.5), (bx + 21, 6.5), 1, "brown")
    # the handle, an arch over the lid
    for k in range(13):
        t = math.pi * k / 12
        g.rect(w / 2 - 0.75 - math.cos(t) * 7, 13 - math.sin(t) * 8, 1.5, 1.5, "dbrown")
    # the basket: ochre, shaded at its right, its lid a brown band lit along its top
    g.rect(bx, 16, bw, 9, "ochre")
    g.rect(bx + bw - 3, 16, 3, 9, "rust")
    g.rect(bx - 1, 13, bw + 2, 3, "brown")
    g.rect(bx - 1, 13, bw + 2, 1, "tan")
    g.rect(bx + bw - 2, 14, 3, 2, "dbrown")
    g.rect(bx, 24, bw, 1, "dbrown")
    return lit(g)


# The log's idle: rest, rest, the leaf on its back stirred 1px right and up, rest.
FALLEN_LOG_IDLE = ((0, 0), (0, 0), (1, -1), (0, 0)), 450
# The trunk, in layout pixels at full size: its top and bottom rows and its broken end's column.
LOG_TOP, LOG_BOTTOM, LOG_LEFT = 11, 27, 9
# The bark's ridges along the trunk: (row, from, to) as fractions of the trunk's length, lit brown on its upper
# half and dbrown below.
RIDGES = ((14, 0.08, 0.45), (14, 0.6, 0.92), (18, 0.25, 0.7), (22, 0.05, 0.35), (22, 0.55, 0.9))
# The fallen leaves drifted in pairs against its foot: (column as a fraction of the frame's width less 1.5px
# margin each side, row, colour index).
LOG_LEAVES = ((0.05, 26, 0), (0.36, 26, 1), (0.66, 26, 0), (0.94, 26, 1))


def fallen_log(leaf=(0, 0), w=obstacles.span(2)):
    """A fallen oak trunk lying across the road, side on: rough bark with ridges running along it, lit brown
    above and dbrown below, shaded walnut along its underside; a sawn end at the right showing cream wood in
    tan growth rings round a brown heart, and a broken end at the left, pale splinters jutting out of the
    bark. A broken branch stub rises from its back at the left, its snapped end pale; moss grows over its
    back and down its side, two tan-capped mushrooms stand on it and fallen leaves lie along its foot. leaf
    offsets the amber leaf on its back."""
    g = edged(Grid(w, ROW))
    ux, uy = obstacles.unit(g)
    cut = w - 8
    rx, ry = 5.5, (LOG_BOTTOM - LOG_TOP) / 2
    cy = (LOG_TOP + LOG_BOTTOM) / 2
    # the branch stub, behind the trunk: a short limb rising up and left, its snapped end pale
    bar(g, (30, LOG_TOP + 2), (24, 3), 5, "bark")
    bar(g, (31.5, LOG_TOP + 2), (25.5, 3), 1.5, "walnut")
    g.cel(24.2, 3.4, 2.4, 1.4, "tan", None, "cream")
    # the trunk: bark, lit along its back and shaded walnut along its underside
    length = cut - LOG_LEFT
    g.rect(LOG_LEFT, LOG_TOP, length, LOG_BOTTOM - LOG_TOP, "bark")
    g.rect(LOG_LEFT, LOG_TOP, length, 1.5, "dbrown")
    g.rect(LOG_LEFT, LOG_BOTTOM - 4, length, 4, "walnut")
    for y, a, b in RIDGES:
        x0, x1 = LOG_LEFT + a * length, LOG_LEFT + b * length
        g.rect(x0, y, x1 - x0, 1, "brown" if y < cy else "dbrown")
        g.rect(x0 + 1, y + 1, x1 - x0 - 1, 1, "walnut")
    # the broken end at the left: pale splinters jutting out of the bark, shaded tan below
    for a, b, tip in (((LOG_LEFT + 1, LOG_TOP + 1), (LOG_LEFT + 1, LOG_TOP + 7), (2, LOG_TOP + 3)),
                      ((LOG_LEFT + 1, LOG_TOP + 5), (LOG_LEFT + 1, LOG_TOP + 12), (4, LOG_TOP + 9)),
                      ((LOG_LEFT + 1, LOG_TOP + 10), (LOG_LEFT + 1, LOG_BOTTOM - 1), (1, LOG_BOTTOM - 3))):
        g.tri(a, b, tip, "cream")
        g.tri((a[0], (a[1] + b[1]) / 2), b, tip, "tan")
    g.rect(LOG_LEFT, LOG_TOP, 1.5, LOG_BOTTOM - LOG_TOP, "dbrown")
    # the sawn end at the right: the bark's rim round cream sapwood, tan growth rings and a brown heart
    g.ell(cut, cy, rx, ry, "bark")
    g.ell(cut, cy, rx - 1, ry - 1, "cream")
    for k in (0.72, 0.45):
        g.ell(cut, cy, (rx - 1) * k, (ry - 1) * k, "tan")
        g.ell(cut, cy, (rx - 1) * k - 0.8, (ry - 1) * k - 0.8, "cream")
    g.ell(cut, cy, 1.2, 1.6, "brown")
    # moss over its back and down its side, lit lime on top
    for x, y, mx, my in ((40, LOG_TOP + 0.5, 7, 2), (66, LOG_TOP + 0.5, 5, 1.8)):
        g.cel(x, y, mx, my, "moss", "olive", "lime")
    # two mushrooms on its back: cream stems under tan caps, lit cream and shaded ochre
    for x, h, cx, cyy in ((51, 3, 3.2, 1.8), (56.5, 2, 2.4, 1.4)):
        g.rect(x - 0.75, LOG_TOP - h, 1.5, h + 1, "cream")
        g.cel(x, LOG_TOP - h, cx, cyy, "tan", "ochre", "cream")
    # the leaf on its back, stirred by leaf
    x, y = round(w * 0.8) + leaf[0] * ux, LOG_TOP - 1 + leaf[1] * uy
    g.rect(x, y, 4, 1, "amber")
    g.rect(x + 1, y + 1, 4, 1, "orange")
    g.p(x + 5, y + 1, "rust")
    # the fallen leaves along its foot
    for f, y, k in LOG_LEAVES:
        lens(g, 1.5 + f * (w - LEAF - 3), y, *PILE_COLOURS[k])
    return lit(g, dict(bark=("clay", None), walnut=("bark", None)))


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
    """A grass blade 4px tall, 2px thick at its foot and 1px at its tip, leaning lean pixels a row."""
    hits.dots(g, x, y, [(round(k * lean) + i, -k, col) for k in range(4) for i in range(2 if k < 3 else 1)])


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
        ("pinknoise", 0.12, None, 0, dict(vol=1.0, low=4500, high=2400, attack=0.006, release=0.5, shape="h",
                                          fx=("lowpass", "4000"))),
        ("pinknoise", 0.14, None, 0.08, dict(vol=0.9, low=3500, high=1500, attack=0.02, release=0.7, shape="h",
                                             fx=sounds.DARK)),
        ("square", 0.1, (430, 760), 0.24, dict(vol=0.3, duty=35, low=2200, attack=0.015, release=0.3)),
        ("square", 0.16, (760, 520), 0.33, dict(vol=0.3, duty=35, low=2200, attack=0.005, release=0.8, shape="h")),
        ("triangle", 0.1, (215, 380), 0.24, dict(vol=0.45, attack=0.015, release=0.3)),
        ("triangle", 0.16, (380, 260), 0.33, dict(vol=0.45, attack=0.005, release=0.8, shape="h")),
    ],
    # A low "huff" through the nose, then three soft chirps rising, each quieter.
    "sfx-hit-capybara": [
        ("pinknoise", 0.12, None, 0.01, dict(vol=0.3, low=1200, high=250, attack=0.025, release=0.7, shape="h")),
        ("triangle", 0.14, (300, 170), 0.01, dict(vol=0.3, attack=0.025, release=0.7, shape="h")),
        ("square", 0.14, (300, 170), 0.01, dict(vol=0.9, low=900, attack=0.025, release=0.7, shape="h")),
        ("triangle", 0.08, (880, 1250), 0.18, dict(vol=0.9, attack=0.012, release=0.6)),
        ("triangle", 0.08, (940, 1330), 0.26, dict(vol=0.77, attack=0.012, release=0.6)),
        ("triangle", 0.1, (990, 1450), 0.34, dict(vol=0.65, attack=0.012, release=0.7)),
        ("square", 0.08, (880, 1250), 0.18, dict(vol=0.12, duty=25, low=2500, attack=0.012, release=0.6)),
    ],
}


def render_sounds(out_dir):
    """Write every sound into out_dir as .ogg and .m4a, as sounds.render does; return the keys."""
    return sounds.render_effects(out_dir, EFFECTS)


# ---------- card illustrations ----------

# The zones the cards stand on, by game id: Cabbagetown's street and High Park's trail.
CABBAGETOWN, HIGH_PARK = "snoozeCrescent", "park"


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


def swipe_marks(a, x, y):
    """Three white claw slashes in a plum rim, as the effects are rimmed, each falling 9 rows to the right from
    x, y, 5px apart so 2px of ground shows between their rims: the cat's swipe."""
    pts = [(x + k * 5 + j // 3, y + j - k) for k in range(3) for j in range(9)]
    for px, py in pts:
        a.fill(px - 1, py - 1, 3, 3, "plum")
    for px, py in pts:
        a.fill(px, py, 1, 1, "white")


def porch_cat_stand():
    """Stand your ground: Archie stands firm on his leash while the cat swipes up at his nose, three white
    claw slashes beside his head."""
    a = cards.Art()
    a.ground(CABBAGETOWN)
    cat = picture(drawn(ANIMAL, porch_cat, swipe=True))
    a.shadow(18, 46, 36)
    a.paste(cat, 18 - cat.width / 2, 46 - cat.height)
    c = a.dog("archie", "walk", 56, 56)
    a.lead(56, c, 64)
    swipe_marks(a, 34, 11)
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


def puff(a, x, y):
    """A 5x3 puff of trail dust kicked up at a paw, cream lit white."""
    a.fill(x + 1, y, 3, 1, "white")
    a.fill(x, y + 1, 5, 2, "cream")


def capybara_drag():
    """Drag them away: the capybara chewing up the trail at the left, Archie leaning hard toward it with his
    paws dug in, hauled away by his leash taut off the bottom right, dust kicking up at his paws."""
    a = cards.Art()
    a.ground(HIGH_PARK)
    a.put("capybara@75", "idle", 16, 34)
    c = a.dog("archie", "pull", 48, 58, flip=True)
    a.lead(48, c, 68, 2)
    puff(a, 36, 53)
    return a


ILLUSTRATIONS = {
    "card-porch-cat-stand": porch_cat_stand,
    "card-porch-cat-treat": porch_cat_treat,
    "card-porch-cat-bolt": porch_cat_bolt,
    "card-capybara-help": capybara_help,
    "card-capybara-call-zoo": capybara_call_zoo,
    "card-capybara-drag": capybara_drag,
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
    yield f"hen{suffix}", [("idle", frames(a, hen, HEN_IDLE), 400), ("run", frames(a, hen, HEN_RUN), 80)]
    yield f"ferrets{suffix}", [("idle", frames(a, ferrets, FERRETS_IDLE), 300),
                               ("run", frames(a, ferrets, FERRETS_RUN), 80)]
    for key, draw, (args, ms) in (("fallen-log", fallen_log, FALLEN_LOG_IDLE),
                                  ("leaf-pile", leaf_pile, LEAF_PILE_IDLE),
                                  ("little-free-library", little_free_library, LIBRARY_IDLE),
                                  ("picnic-blanket", picnic_blanket, PICNIC_IDLE),
                                  ("porch-steps", porch_steps, PORCH_STEPS_IDLE)):
        yield f"{key}{suffix}", [("idle", [minis.small(sys.modules[__name__], o, draw, f).outlined() for f in args],
                                  ms)]


# Where each road sprite's .aseprite source goes: the card obstacles with the encounters, the rest with the
# obstacles.
SOURCES = {"capybara": "art/encounters", "porch-cat": "art/encounters", "fallen-log": "art/obstacles",
           "ferrets": "art/obstacles", "hen": "art/obstacles", "leaf-pile": "art/obstacles", "little-free-library": "art/obstacles",
           "picnic-blanket": "art/obstacles", "porch-steps": "art/obstacles"}


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
    elif len(sys.argv) == 3 and sys.argv[1] == "sounds":
        print("wrote", ", ".join(render_sounds(sys.argv[2])))
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
