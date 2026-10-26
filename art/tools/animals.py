#!/usr/bin/env python3
"""Draw the animal minor obstacles, the Chase, Snatch and Social animals: moving
minor obstacles (src/assets/spriteKeys.ts). Every sprite
also has its depth variants at every step in minis.STEPS (@88, @75, @62, @50),
redrawn at the step with the same tags, frames and durations. Everything faces the player except the side views
(hops and the Social dogs' run, facing right, the game mirroring them for
left) and the flees, which go off up the road, seen from behind. Road outline
(road_edge) and road.LIT's rim on dark fills, cel shading as the dogs have it
(Grid.cel), as road.py has them.

Each animal is laid out on 32x32 (the Snatch animals on 32x48) and drawn on a
minis.Mini at its frame side / 32, sized against the pack (dogs.py: big 54,
medium 48, small 38).

Chase, 38x38 (the small dogs' frame): idle (2 frames, 300ms: frame 1 a small
motion), run (4 frames, 80ms: down the road at the player).
  chase-cat          a tuxedo cat sitting, smaller than a medium dog; idle swishes its tail,
                     run bounds as the squirrel does: lands stretched, pushes off, flies
                     gathered, reaches down
  chase-pigeons      three pigeons; idle pecks, run flutters and hops; flee (4 frames, 80ms):
                     the flock flying off up the road from behind, wings beating up, out, down, out
  chase-ducklings    three ducklings; idle peeps, run waddles; hop (4 frames, 100ms): the brood
                     in a line in side view, crouch, take-off, airborne, landing, each a frame
                     behind the one ahead
  chase-rabbit       a white rabbit; idle twitches, run bounds; hop (4 frames, 100ms): side view,
                     crouched with its ears back, leaping stretched, airborne 8 units up, landing
                     on its front paws

Snatch, the thief's tags: walk (4 frames, 100ms, road.PERSON_WALK: a foot lifted,
passing 1px higher, the other foot), flee (4 frames, 90ms: from behind, see FLEE
and SEAGULL_FLEE), idle (2 frames, 400ms: breathing). Each carries a tan loot
sack, as the thief does.
  snatch-raccoon     38x57, standing about as tall as a medium dog, the sack at its chest; flee
                     runs, the ringed tail swinging against the stride
  snatch-seagull     32x48, a head shorter, the sack in its beak; flee flies, the wings beating
                     up, level, down, level

Social, medium dogs (48x48, drawn SOCIAL_ZOOM narrower in it, about 26px wide
face on): walk (4 frames, 100ms) and idle (4 frames,
300ms: tail at -1, 0, +1, 0, the body 1px higher on frames 1 and 2, the
right ear 1px higher on the last), as other-dog has them, and run (4 frames, 100ms): side view facing right
in loose-dog's gallop (hazards.CORGI_RUN), without the broken leash.
  social-frisbee-dog  a border collie with a red frisbee

Usage:
  animals.py preview OUT.png   every frame of every sprite and variant on the
                               zone roads
  animals.py build             write art/animals/*.aseprite and export to
                               public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import hazards  # noqa: E402
import minis  # noqa: E402
import road  # noqa: E402
from minis import STEPS, snap  # noqa: E402
from pixel import Grid, edged, main, raster, scale_of  # noqa: E402
from road import BREATH, BREATH_MS, lit  # noqa: E402


def eyes(g, xs, y, c="ink"):
    """2x2 eyes at each x on row y, a white glint at the top-left."""
    for x in xs:
        g.rect(x, y, 2, 2, c)
        g.p(x, y, "white")


# ---------- Chase ----------

def paw(g, x, y, h, c, sh, leg=None):
    """A 3-unit paw from row y, h rows tall, its lower-right pixel shaded; leg, if given, the 2 rows of leg
    above it."""
    if leg:
        g.rect(x, y - 2, 3, 2, leg)
    g.rect(x, y, 3, h, c)
    g.p(x + 2, y + h - 1, sh)


def cat(tail=0):
    """A tuxedo cat sitting facing the player, its paws on rows 28 and 29: black coat, white bib, muzzle and
    paws, green eyes, its tail curling up its right side with a white tip. tail swishes the tail 1px
    right."""
    g = edged(Grid())
    g.cel(23 + tail, 22, 2, 6, "navy", "ink", "dslate")
    g.cel(22.5 + tail, 15.5, 2, 2, "white", "lgrey")
    g.cel(15, 23, 6, 6.5, "navy", "ink", "dslate")
    g.cel(15, 25, 3, 3.5, "white", "lgrey")
    for x in (11, 16):
        paw(g, x, 28, 2, "white", "lgrey")
    cat_head(g, 15, 14)
    return lit(g)


# The cat's bound at the player, landing first, as road.SQUIRREL_BOUND: body (x, y, rx, ry), head y, front paws
# (left x, right x, top row, rows), tail (x, y, ry). It lands stretched low and wide, pushes off, flies
# gathered 4 units higher with its paws tucked and its tail flung up, then reaches down for the next landing.
CAT_BOUND = (
    ((16, 23, 7.5, 4.5), 18, (8, 21, 27, 3), (23, 14, 6)),
    ((16, 22, 7, 4.8), 17, (9, 20, 26.5, 3), (22.5, 12, 6)),
    ((15.5, 19.5, 5.5, 5), 14, (11, 17, 24, 2), (21, 9.5, 5)),
    ((16, 21, 6.5, 4.8), 15.5, (9.5, 19.5, 25.5, 3), (22, 11.5, 5.5)),
)


def cat_run(phase):
    """The cat bounding down the road at the player, a front elevation, at phase 0 to 3 of CAT_BOUND."""
    g = edged(Grid())
    (bx, by, brx, bry), hy, (lx, rx, py, ph), (tx, ty, tr) = CAT_BOUND[phase]
    g.cel(tx, ty, 2, tr, "navy", "ink", "dslate")
    g.cel(tx - 0.5, ty - tr + 1.5, 2, 2, "white", "lgrey")
    g.cel(bx, by, brx, bry, "navy", "ink", "dslate")
    g.cel(bx, by + 1.5, brx / 2, bry / 2 + 0.5, "white", "lgrey")
    for x in (lx, rx):
        paw(g, x, py, ph, "white", "lgrey", "navy")
    cat_head(g, bx - 0.5 if phase == 2 else bx, hy)
    return lit(g)


def cat_head(g, x, y):
    """The cat's head facing the player, centred on (x, y): pointed ears with pink insides, a white muzzle,
    green eyes and a pink nose."""
    g.tri((x - 6, y), (x - 5, y - 6.5), (x - 1.5, y - 3.5), "navy")
    g.tri((x + 6, y), (x + 5, y - 6.5), (x + 1.5, y - 3.5), "dslate")
    g.p(x - 4.5, y - 3.5, "pink")
    g.p(x + 3.5, y - 3.5, "pink")
    g.cel(x, y, 6, 4.8, "navy", "ink", "dslate")
    g.cel(x, y + 2.5, 2.5, 1.6, "white", "lgrey")
    # the eyes and nose in drawn pixels, so they keep one shape however the head's row falls through the
    # bound: each eye 3 units wide and 2 tall, green either side of a slit pupil (green outside an inner
    # pupil once it is only 2px wide), and a 1px pink nose
    px, s = raster(g), scale_of(g)
    w, h = max(2, math.floor(3 * s + 0.25)), max(1, math.floor(2 * s + 0.25))
    top = math.floor((y - 0.5) * s + 0.5 - h / 2)
    for side in (-1, 1):
        left = math.floor((x + side * 3) * s + 0.5 - w / 2)
        px.rect(left, top, w, h, "green")
        pupil = left + w // 2 if w > 2 else left + (1 if side < 0 else 0)
        px.rect(pupil, top, 1, h, "ink")
    px.p(math.floor(x * s), math.floor((y + 2) * s), "pink")


def pigeon(g, cx, by, peck=False, wings=None):
    """A pigeon facing the player with its feet on row by - 1: a round grey body, the green and mauve neck
    sheen, a small head. peck lowers the head to the ground; wings, from -1 (out and down) to 1 (raised),
    spreads both wings, None keeps them folded."""
    if wings is not None:
        for side in (-1, 1):
            tip = (cx + side * 8, by - 8.5 - 4.5 * wings)
            g.tri((cx + side * 2, by - 7), (cx + side * 2, by - 3), tip, "lgrey")
            g.tri((cx + side * 5, by - 6 - wings), (cx + side * 5, by - 4), tip, "grey")
            g.p(tip[0] - side, tip[1] + (1 if wings > 0 else -1 if wings < 0 else 0), "dslate")
    for x in (cx - 2, cx + 1):
        g.p(x, by - 1, "pink")
    g.cel(cx, by - 4, 5, 3.5, "grey", "slate", "lgrey")
    for side in (-1, 1):
        g.rect(cx + (3 if side > 0 else -4), by - 5, 1, 1, "dslate")
        g.rect(cx + (3 if side > 0 else -4), by - 3, 1, 1, "dslate")
    hy = by - 3 if peck else by - 9
    g.rect(cx - 2, by - 7, 4, 1, "green")
    g.p(cx - 2, by - 7, "mauve")
    g.p(cx + 1, by - 7, "mauve")
    g.cel(cx, hy, 2.2, 2.2, "grey", "slate", "lgrey")
    g.p(cx - 2, hy - 0.5, "orange")
    g.p(cx + 1, hy - 0.5, "orange")
    g.p(cx - 0.5, hy + 1.5, "dslate")
    g.p(cx - 0.5, hy + 0.5, "white")


# The flock's spots: (x, feet row), the two behind, then the one in front.
FLOCK = ((8, 21), (24, 22), (16, 29))


def pigeons(peck=False, wings=None, lift=(0, 0, 0)):
    """Three pigeons, two behind and one in front; peck has the front one peck, wings (see pigeon) spreads
    the back right one's against the others', and lift raises each by its pixels."""
    g = edged(Grid())
    u = 1 / scale_of(g)
    for (x, y), flip, up in zip(FLOCK, (1, -1, 1), lift):
        pigeon(g, x, y - up * u, peck=peck and x == 16, wings=None if wings is None else wings * flip)
    return lit(g)


# The flock's flutter down the road, each frame (wings, lift per pigeon): wings beat down as the flock hops,
# the front pigeon a beat behind the two at the back.
PIGEONS_RUN = ((-1, (0, 0, 1)), (0, (2, 2, 0)), (1, (3, 3, 2)), (0, (1, 1, 3)))


def pigeon_back(g, cx, cy, wings):
    """A pigeon flying away up the road, seen from behind, its body centred on (cx, cy): a grey back with
    the dark tail fan under it, the head over it and both wings spread, their tips at wings (-1 raised to
    1 swept down) with dark bars."""
    for side in (-1, 1):
        tip = (cx + side * 8, cy - 1 + 5 * wings)
        g.tri((cx + side * 1.5, cy - 2), (cx + side * 1.5, cy + 1.5), tip, "lgrey")
        g.tri((cx + side * 4, cy - 1.5 + wings), (cx + side * 4, cy + 1 + wings), tip, "grey")
        g.p(tip[0] - side, tip[1], "dslate")
    g.tri((cx - 2.5, cy + 2), (cx + 2.5, cy + 2), (cx, cy + 5.5), "dslate")
    g.rect(cx - 2, cy + 4, 4, 1, "ink")
    g.cel(cx, cy, 3, 3.5, "grey", "slate", "lgrey")
    g.rect(cx - 1, cy - 2.5, 2, 1, "green")
    g.cel(cx, cy - 4, 2, 2, "grey", "slate", "lgrey")


# The flock taking off up the road, seen from behind: each frame (wings, rise per pigeon), the wings beating
# up, out, down and out while the three climb and fall a pixel or two against each other.
PIGEONS_FLEE = ((-1, (0, 1, 0)), (0, (1, 2, 1)), (1, (2, 2, 3)), (0, (1, 1, 2)))
# Where each pigeon flies: its body's centre, the two ahead higher up.
FLYERS = ((9, 13), (23, 11), (16, 22))


def pigeons_fleeing(wings, rise):
    """The flock flying off up the road, seen from behind: wings for all three, the middle one's against
    the others', and rise lifting each by its pixels."""
    g = edged(Grid())
    u = 1 / scale_of(g)
    for (x, y), flip, up in zip(FLYERS, (1, -1, 1), rise):
        pigeon_back(g, x, y - up * u, wings * flip)
    return lit(g)


def duckling(g, cx, by, peep=False, wing=0, step=0):
    """A duckling facing the player with its feet on row by - 1: a yellow puff with a tuft, an orange bill
    (open on peep) and little wings; wing 1 holds the wings up and out, step lifts one foot (-1 left, 1
    right)."""
    for x, side in ((cx - 2, -1), (cx + 1, 1)):
        g.rect(x, by - 1 - (1 if step == side else 0), 2, 1, "orange")
    g.cel(cx, by - 4, 4, 3.3, "yellow", "amber")
    for side in (-1, 1):
        if wing:
            g.tri((cx + side * 3, by - 6), (cx + side * 3, by - 3), (cx + side * 6, by - 8), "yellow")
        else:
            g.rect(cx + (3 if side > 0 else -4), by - 5, 1, 2, "amber")
    g.cel(cx, by - 9, 3, 2.8, "yellow", "amber")
    g.p(cx, by - 12.5, "yellow")
    g.p(cx - 2, by - 10, "ink")
    g.p(cx + 1, by - 10, "ink")
    g.rect(cx - 1, by - 9, 2, 1, "orange")
    if peep:
        g.rect(cx - 1, by - 8, 2, 1, "rust")


# The ducklings' spots, as FLOCK.
BROOD = ((8, 22), (24, 23), (16, 29))


def ducklings(peep=False, wing=0, step=0, lift=(0, 0, 0)):
    """Three ducklings, one in front; peep opens the front one's bill, wing and step (the back right one's
    the other foot) make the waddle, and lift raises each by its pixels."""
    g = edged(Grid())
    u = 1 / scale_of(g)
    for (x, y), flip, up in zip(BROOD, (1, -1, 1), lift):
        duckling(g, x, y - up * u, peep=peep and x == 16, wing=wing, step=step * flip)
    return lit(g)


# The waddle-run down the road: a foot lifted with the wings out, both feet down as the brood bobs up a pixel,
# the other foot lifted, down again.
DUCKLINGS_RUN = (dict(step=-1, wing=1), dict(lift=(1, 1, 1)), dict(step=1, wing=1), dict(lift=(1, 1, 1)))


def duckling_side(g, cx, by, phase):
    """A duckling in side view facing right, its feet on row by - 1, at phase 0 to 3 of a hop: crouched, taking
    off stretched up with its wing out, in the air 3 units up with its feet tucked, landing with its wing
    out."""
    up, wing = ((0, 0), (1, 1), (3, 0), (1, 1))[phase]
    y = by - up
    crouch = phase == 0
    if phase != 2:
        g.rect(cx - 1, by - 1, 3, 1, "orange")
        g.rect(cx, by - 2, 1, 1 + (1 if up else 0) - (1 if crouch else 0), "orange")
    else:
        g.rect(cx - 1, y - 2, 3, 1, "orange")
    g.tri((cx - 4.5, y - 7), (cx - 2.5, y - 4), (cx - 5.5, y - 5), "yellow")
    g.cel(cx, y - 4 + (0.5 if crouch else 0), 4.5, 3.3 - (0.5 if crouch else 0), "yellow", "amber")
    if wing:
        g.tri((cx - 2, y - 6), (cx + 1, y - 5), (cx - 4, y - 9), "yellow")
        g.p(cx - 2, y - 6, "amber")
    else:
        g.rect(cx - 2, y - 5, 3, 1, "amber")
    hy = y - 9 + (1 if crouch else 0)
    g.cel(cx + 2, hy, 3, 2.8, "yellow", "amber")
    g.p(cx + 1.5, hy - 3.5, "yellow")
    g.p(cx + 3, hy - 1, "ink")
    g.rect(cx + 5, hy, 2, 1, "orange")


def ducklings_hop(phase):
    """The brood hopping across the road in side view, facing right, in a line: the leader at phase, each
    behind it a frame later."""
    g = edged(Grid())
    for k, (x, y) in enumerate(((5.5, 26), (14.5, 27), (24, 28))):
        duckling_side(g, x, y, (phase - (2 - k)) % 4)
    return lit(g)


def rabbit(twitch=0, bound=None):
    """A white rabbit facing the player: long ears with pink insides, a round head with a pink nose. Sitting
    (bound None), its big hind feet either side on rows 28 and 29, twitch raising the right ear 1px and
    the nose; bound is a frame of RABBIT_BOUND, the run at the player."""
    g = edged(Grid())
    if bound is None:
        hx, hy, ear = 16, 15.5, 3
        g.cel(16, 23, 6.5, 6, "white", "lgrey")
        for x in (8, 19):
            g.rect(x, 28, 5, 2, "white")
            g.rect(x, 29, 5, 1, "lgrey")
        for x in (12.5, 17.5):
            g.cel(x, 27, 2.2, 2.6, "white", "lgrey")
    else:
        (bx, by, brx, bry), hy, ear, (lx, rx, py, ph) = RABBIT_BOUND[bound]
        hx = 16
        g.cel(bx, by, brx, bry, "white", "lgrey")
        for x in (lx, rx):
            paw(g, x, py, ph, "white", "lgrey")
    t = twitch
    for x, up in ((hx - 3.5, 0), (hx + 3.5, t)):
        g.cel(x, hy - 3 - ear - up, 2, 5.5, "white", "lgrey")
        g.rect(x - 0.5, hy - 5 - ear - up, 1, 6, "pink")
    g.cel(hx, hy + 4.5, 4.5, 1.6, "lgrey")
    g.cel(hx, hy, 5.5, 4.5, "white", "lgrey")
    # the eyes in drawn pixels, about 2 units square however the head's row falls, so they keep one size
    # through the bound (3px at full size), each with a pink blush under its outer edge; on white fur a
    # glint would only notch the eye, so they stay solid
    px, s = raster(g), scale_of(g)
    n = max(1, math.ceil(2 * s - 0.25))
    top = math.floor(hy * s + 0.5 - n / 2)
    for x in (hx - 4, hx + 2):
        left = math.floor((x + 1) * s + 0.5 - n / 2)
        px.rect(left, top, n, n, "ink")
        px.p(left if x < hx else left + n - 1, top + n, "pink")
    g.p(hx - 0.5, hy + 1.5 - t, "pink")
    g.p(hx - 1.5, hy + 2.5, "lgrey")
    g.p(hx + 0.5, hy + 2.5, "lgrey")
    return lit(g)


# The rabbit's bound at the player, as CAT_BOUND: body (x, y, rx, ry), head y, ears (units above the head),
# front paws (left x, right x, top row, rows). It lands low and long with its ears laid back, pushes off,
# flies gathered with its ears up, then reaches down.
RABBIT_BOUND = (
    ((16, 24, 8, 4.5), 19.5, 2, (8, 21, 27, 3)),
    ((16, 23, 7.5, 4.8), 18.5, 3, (9, 20, 26.5, 3)),
    ((16, 20, 6, 5), 14, 5, (11, 18, 24, 2)),
    ((16, 22, 7, 4.8), 16.5, 4, (9.5, 19.5, 25.5, 3)),
)


def ear(g, base, tip, c, inner=None):
    """A long ear from the middle of its base to its tip: a quad 3 units wide at the base and 2 at the tip,
    a 1-unit inner stripe down its middle."""
    (bx, by), (tx, ty) = base, tip
    dx, dy = tx - bx, ty - by
    n = (dx * dx + dy * dy) ** 0.5 or 1
    nx, ny = -dy / n, dx / n
    a, b = (bx + nx * 1.5, by + ny * 1.5), (bx - nx * 1.5, by - ny * 1.5)
    c2, d = (tx - nx, ty - ny), (tx + nx, ty + ny)
    g.tri(a, b, c2, c)
    g.tri(a, c2, d, c)
    if inner:
        g.tri((bx + nx * 0.5, by + ny * 0.5), (bx - nx * 0.5, by - ny * 0.5), (tx - dx * 0.2, ty - dy * 0.2), inner)


# The hop across the lanes, side view facing right, 4 frames: body (x, y, rx, ry), haunch (x, y, r), head
# (x, y), ear tip (x, y), hind foot (x, top row, length) and front paws (x, top row, rows). It crouches with
# its ears back, leaps stretched forward and up with the hind legs pushing off, flies 8 units up gathered with
# its ears raised, then lands on its front paws with the hind feet swinging up behind.
RABBIT_HOP = (
    ((14, 24.5, 7, 4.5), (10, 25, 4.5), (21, 20.5), (12, 14), (5, 28, 7), (19.5, 27, 3)),
    ((16, 19, 8, 4), (11, 20, 4), (24, 13.5), (15, 6), (1, 25, 6), (24.5, 19, 2)),
    ((15, 15, 7.5, 4.5), (10.5, 16, 4.5), (22.5, 10), (18, 1.5), (7, 19.5, 6), (19.5, 18, 2)),
    ((16, 21, 7.5, 4.5), (10.5, 19, 4.5), (23, 18), (16, 10), (3, 18, 6), (21.5, 23, 6)),
)


def rabbit_hop(phase):
    """The white rabbit hopping across the road in side view, facing right, at phase 0 to 3 of RABBIT_HOP: the
    far ear, front paw and hind foot a shade darker behind the near ones, a white puff of tail and a pink
    nose. The game mirrors it for a hop to the left."""
    g = edged(Grid())
    body, (hx, hy, hr), (dx, dy), (tx, ty), (fx, fy, fl), (px, py, ph) = RABBIT_HOP[phase]
    ear(g, (dx - 3, dy - 2.5), (tx - 2, ty + 1), "lgrey")
    g.rect(px - 1.5, py, 3, ph, "lgrey")
    g.rect(fx - 1, fy - 0.5, fl, 2, "lgrey")
    g.cel(hx - hr + 0.5, hy - 1.5, 2.2, 2.2, "white", "lgrey")
    g.cel(*body, "white", "lgrey")
    # the hind leg from the haunch down to the foot
    g.tri((hx - 2.5, hy), (hx + 1.5, hy + 2), (fx + fl / 2, fy + 1), "white")
    g.cel(hx, hy, hr, hr, "white", "lgrey")
    g.rect(fx, fy, fl, 2, "white")
    g.rect(fx, fy + 1, fl, 1, "lgrey")
    paw(g, px, py, ph, "white", "lgrey")
    g.cel(dx, dy, 4.5, 3.8, "white", "lgrey")
    g.cel(dx + 2.5, dy + 1.5, 2.2, 1.6, "white", "lgrey")
    ear(g, (dx - 1.5, dy - 2.5), (tx, ty), "white", "pink")
    g.rect(dx + 0.5, dy - 1.5, 2, 2, "ink")
    g.p(dx + 0.5, dy - 1.5, "white")
    g.p(dx + 4.5, dy + 0.5, "pink")
    return lit(g)


# ---------- Snatch ----------

def sack(g, x, y):
    """The tan loot sack centred on (x, y), its neck gathered at the top, as the thief's."""
    g.cel(x, y, 4, 4, "tan", "brown", "cream")
    g.tri((x - 2.5, y - 2.5), (x + 2.5, y - 2.5), (x, y - 6), "tan")
    g.rect(x - 1, y - 5, 2, 1, "brown")
    g.rect(x - 2, y - 4, 4, 1, "dbrown")
    g.rect(x - 1, y - 1, 2, 1, "dbrown")
    g.p(x - 1, y, "dbrown")
    g.rect(x - 1, y + 1, 2, 1, "dbrown")


def raccoon(lf=0, rf=0, bob=0):
    """A raccoon standing up facing the player, its feet on row 44: grey coat, pale belly, the black mask
    under white brows, a ringed tail curling up its right side and the loot sack clutched at its chest. lf and
    rf lift a foot; bob raises everything above the legs."""
    g = edged(Grid(32, 48))
    b = bob
    # the ringed tail, from behind the right hip up its side
    for i, (x, y) in enumerate(((24, 39), (26, 35), (27, 31), (26.5, 27))):
        g.cel(x, y + b, 2.6, 2.4, "dslate" if i % 2 else "lgrey", "ink" if i % 2 else "grey")
    g.cel(26, 24 + b, 2, 1.8, "ink")
    for x, f in ((11, lf), (17, rf)):
        g.rect(x, 37 + b, 4, 6 + f - b, "dslate")
        g.rect(x - 1, 43 + f, 5, 2, "ink")
    g.cel(16, 32 + b, 8, 7.5, "slate", "dslate", "grey")
    g.cel(16, 33.5 + b, 4.5, 5, "lgrey", "grey")
    sack(g, 16, 31 + b)
    for x in (10, 19):
        g.rect(x, 30 + b, 3, 2, "ink")
    # head: wide, the ears pale-tipped
    for x, tip in ((9, 10), (23, 22)):
        g.tri((x, 17 + b), (tip, 9.5 + b), (16 + (-3 if x < 16 else 3), 13 + b), "slate")
        g.p(tip, 11 + b, "lgrey")
    g.cel(16, 18.5 + b, 8.5, 6.5, "slate", "dslate", "grey")
    g.rect(9, 15 + b, 5, 1, "white")
    g.rect(18, 15 + b, 5, 1, "white")
    g.rect(8, 17 + b, 16, 3, "ink")
    g.rect(15, 15 + b, 2, 4, "grey")
    g.rect(11, 18 + b, 2, 1, "white")
    g.rect(19, 18 + b, 2, 1, "white")
    g.cel(16, 21.5 + b, 3.5, 2.5, "white", "lgrey")
    g.rect(15, 20 + b, 2, 1, "ink")
    g.rect(15, 23 + b, 3, 1, "dbrown")
    g.p(18, 22 + b, "dbrown")
    return lit(g)


# A run up the road, seen from behind, 4 frames: the stride (-1 the left knee up, 1 the right, 0 passing with
# both feet down) and the body's lift, highest off the pushing foot.
FLEE = [dict(stride=-1, bob=-2), dict(stride=0, bob=-1), dict(stride=1, bob=-2), dict(stride=0, bob=-1)]
FLEE_MS = 90


def raccoon_fleeing(stride, bob=-1):
    """The raccoon running off up the road, seen from behind: the lifted leg short, the other planted, the
    ringed tail swinging down its back against the stride and the loot sack bouncing over its right
    shoulder. stride 0 is the passing frame, both feet down and the arms at its sides; bob lifts it."""
    g = edged(Grid(32, 48))
    s, b = stride, bob
    for x, lift in ((11, s < 0), (17, s > 0)):
        if lift:
            g.rect(x, 36 + b, 4, 4, "dslate")
            g.rect(x - 1, 40 + b, 5, 2, "ink")
        else:
            g.rect(x, 36 + b, 4, 7 - b, "dslate")
            g.rect(x - 1, 43, 5, 2, "ink")
    for x, back in ((7, s < 0), (25, s > 0)):
        y = 28 if s == 0 else 31 if back else 25
        g.rect(x - 1, y + b, 3, 4, "dslate")
        g.rect(x - 1, y + 4 + b, 3, 2, "ink")
    g.cel(16, 31 + b, 8, 7.5, "slate", "dslate", "grey")
    k = b + (1 if s > 0 else 0)
    sack(g, 22, 27 + k)
    # the tail down the back, swinging against the stride
    for i, y in enumerate((30, 34, 38)):
        g.cel(16 - s * (1 + i), y + b, 2.6, 2.4, "dslate" if i % 2 else "lgrey", "ink" if i % 2 else "grey")
    g.cel(16 - s * 4, 41.5 + b, 2, 1.8, "ink")
    for x, tip in ((9, 10), (23, 22)):
        g.tri((x, 17 + b), (tip, 9.5 + b), (16 + (-3 if x < 16 else 3), 13 + b), "slate")
    g.cel(16, 18.5 + b, 8.5, 6.5, "slate", "dslate", "grey")
    g.rect(8, 18 + b, 2, 2, "ink")
    g.rect(22, 18 + b, 2, 2, "ink")
    return lit(g)


def seagull(lf=0, rf=0, bob=0):
    """A seagull standing facing the player, its feet on row 44: white head and chest, grey wings folded at its
    sides with black tips, pink legs, a yellow bill with the red spot, and the loot sack hanging from it. lf
    and rf lift a foot; bob raises everything above the legs."""
    g = edged(Grid(32, 48))
    b = bob
    for x, f in ((13, lf), (18, rf)):
        g.rect(x, 37 + b, 1, 7 + f - b, "pink")
        g.rect(x - 1, 43 + f, 3, 1, "pink")
        g.rect(x - 1, 44 + f, 3, 1, "mauve")
    for side in (-1, 1):
        x = 16 + side * 7
        g.cel(x, 30 + b, 3, 7, "grey", "slate", "lgrey")
        g.tri((x - 2, 34 + b), (x + 2, 34 + b), (x + side * 1, 40 + b), "ink")
        g.p(x, 35 + b, "white")
    g.cel(16, 30 + b, 6.5, 7.5, "white", "lgrey")
    g.cel(16, 17 + b, 6, 5.5, "white", "lgrey")
    # a fierce brow over each yellow eye
    for x, side in ((12, -1), (19, 1)):
        g.rect(x, 16 + b, 2, 2, "yellow")
        g.p(x + (1 if side < 0 else 0), 17 + b, "ink")
        g.rect(x, 15 + b, 2, 1, "grey")
        g.p(x + (0 if side < 0 else 1), 14 + b, "grey")
    g.rect(15, 19 + b, 2, 3, "yellow")
    g.p(16, 21 + b, "red")
    sack(g, 16, 27 + b)
    # the pupils again in drawn pixels, at least 1px, so the eyes keep them at every depth step
    px, s = raster(g), scale_of(g)
    for x in (13, 19):
        px.p(math.floor((x + 0.5) * s), math.floor((17 + b + 0.5) * s), "ink")
    return lit(g)


# The seagull's wingbeat flying off: wings -1 raised, 0 level, 1 swept down; it climbs a pixel
# on the downstroke.
SEAGULL_FLEE = [dict(wings=-1), dict(wings=0), dict(wings=1, bob=-1), dict(wings=0, bob=-1)]


def seagull_fleeing(wings, bob=0):
    """The seagull flying off up the road, seen from behind: grey back, white head and tail, wings spread with
    black tips at wings (-1 raised, 0 level, 1 swept down), the sack dangling under it and its feet
    tucked."""
    g = edged(Grid(32, 48))
    a = wings
    y0 = 20 + bob
    for side in (-1, 1):
        root_hi, root_lo = (16 + side * 4, y0 + 4), (16 + side * 4, y0 + 9)
        tip = (16 + side * 15, y0 + 3 + 11 * a)
        g.tri(root_hi, root_lo, tip, "grey")
        g.tri(root_hi, (16 + side * 9, y0 + 4 + 4 * a), tip, "lgrey")
        g.tri((16 + side * 12, y0 + 3 + 7 * a), (16 + side * 13, y0 + 5.5 + 7.5 * a), tip, "ink")
    sack(g, 16, y0 + 18)
    g.rect(14, y0 + 13, 1, 2, "pink")
    g.rect(17, y0 + 13, 1, 2, "pink")
    g.cel(16, y0 + 7, 5, 6, "grey", "slate", "lgrey")
    g.tri((13, y0 + 11), (19, y0 + 11), (16, y0 + 15), "white")
    g.cel(16, y0 - 1, 4.5, 4, "white", "lgrey")
    return lit(g)


# ---------- Social ----------


def collie(fl=0, fr=0, bl=0, br=0, bob=0, tail=0, twitch=0):
    """A border collie trotting at the player with a red frisbee gripped at the side of its mouth: black coat,
    white blaze, ruff and socks, half-pricked ears with folded tips, the plume of its tail over its right
    shoulder. Leg offsets, bob, tail and twitch as road.corgi has them."""
    g = edged(Grid())
    b = bob

    def lift(k):
        return -2 if k > 0 else 0

    g.cel(24.5 + tail, 15.5 + b, 2.5, 3, "navy", "ink", "dslate")
    g.p(25 + tail, 13 + b, "white")
    for x, k in ((13, bl), (17, br)):
        g.rect(x, 24 + b, 2, 5 + lift(k) - b, "navy")
        g.rect(x, 28 + lift(k), 2, 1, "lgrey")
    g.cel(16, 22 + b, 8, 4.5, "navy", "ink", "dslate")
    g.cel(16, 22 + b, 4.5, 4, "white", "lgrey")
    for x, k in ((9, fl), (20, fr)):
        g.rect(x, 23 + b, 3, 4 + lift(k) - b, "navy")
        g.rect(x, 26 + lift(k), 3, 3, "white")
        g.p(x + 2, 28 + lift(k), "lgrey")
    t = twitch
    g.tri((8, 13 + b), (9, 5.5 + b), (13.5, 9.5 + b), "navy")
    g.tri((24, 13 + b + t), (23, 5.5 + b + t), (18.5, 9.5 + b + t), "navy")
    g.tri((8, 7 + b), (9, 5.5 + b), (11, 6.5 + b), "white")
    g.tri((24, 7 + b + t), (23, 5.5 + b + t), (21, 6.5 + b + t), "white")
    g.cel(16, 13.5 + b, 7, 5.5, "navy", "ink", "dslate")
    g.rect(15, 8 + b, 2, 7, "white")
    g.cel(16, 16.5 + b, 4.5, 2.5, "white", "lgrey")
    eyes(g, (11, 19), 12 + b, "amber")
    g.p(12, 13 + b, "ink")
    g.p(20, 13 + b, "ink")
    g.rect(15, 15 + b, 2, 1, "ink")
    # the frisbee, gripped by its rim at the side of the mouth: a red disc with a dark inner ring
    g.cel(11, 20 + b, 4.5, 4, "red", "dred", "pink")
    g.cel(11, 20 + b, 2.6, 2.2, "dred")
    g.cel(10.6, 19.6 + b, 1.6, 1.3, "red")
    g.p(14, 18 + b, "dbrown")
    return lit(g)


# ---------- Social run: the loose dog's crossing ----------

def side_dog(spec, bob=0, front=(14, 27), hind=(11, 27)):
    """A Social dog galloping across the road in side view, facing right, on hazards.corgi_side's skeleton:
    the same body, hips, shoulders and paw positions per frame (hazards.CORGI_RUN), so it runs in the loose
    dog's pose, without the broken leash. spec is one of SIDE: the coat (fill, shade, light) and its far
    legs, the white underside, the leg and sock colours, the muzzle, the eye and the frisbee in its mouth."""
    g = edged(Grid())
    b = bob + 1
    coat, under, leg, sock = spec["coat"], spec["under"], spec["leg"], spec["sock"]
    for (x, y), (px, py) in (((10, 21 + b), hind), ((20, 21 + b), front)):
        hazards.limb(g, x, y, px + 3, py - 1, 2, spec["far"])
        g.rect(px + 3, py, 2, 2, "lgrey")
    # the plumed tail, white tipped
    g.cel(4, 19 + b, 4, 2.2, *coat)
    g.cel(1.5, 19.5 + b, 1.5, 1.4, "white")
    g.cel(14, 19 + b, 9.5, 5, *coat)
    g.cel(15, 22 + b, 7, 2, under, "lgrey")
    g.cel(21, 19 + b, 3, 3.5, under, "lgrey")
    for (x, y), (px, py) in (((7, 21 + b), hind), ((18, 21 + b), front)):
        hazards.limb(g, x, y, px, py - 1, 3, leg)
        g.rect(px, py, 3, 2, sock)
        g.p(px + 2, py + 1, "lgrey")
    # pricked ears
    g.tri((19.5, 9 + b), (20.5, 2 + b), (24, 7.5 + b), coat[0])
    g.tri((21, 8 + b), (21, 4.5 + b), (23, 7.5 + b), "pink")
    g.cel(23.5, 12.5 + b, 5, 4.5, *coat)
    g.cel(27, 14.5 + b, 3, 2, spec["muzzle"], "lgrey")
    g.rect(29, 13 + b, 1, 2, "ink")
    g.p(28, 13 + b, "ink")
    g.rect(24, 11 + b, 2, 2, spec["eye"])
    g.p(24, 11 + b, "white")
    g.p(25, 12 + b, "ink")
    g.p(27, 16 + b, "dbrown")
    # the frisbee in its mouth
    g.cel(29.5, 17.5 + b, 2.2, 3.5, "red", "dred", "pink")
    g.rect(29, 16 + b, 1, 3, "dred")
    return lit(g)


# Each Social dog's side view, for side_dog.
SIDE = {
    "social-frisbee-dog": dict(coat=("navy", "ink", "dslate"), far="ink", under="white", leg="navy", sock="white",
                               muzzle="white", eye="amber"),
}


DOGS = {
    "social-frisbee-dog": collie,
}
# Each Chase animal's frame side: the 32-unit design drawn at side / 32. The cat and the rabbit sit at the
# small dogs' 38, smaller than a medium dog (48); the pigeons and the ducklings are a flock of three birds a
# third of a dog's width each, in the same frame.
CHASE_SIDE = 38
# Each Snatch animal's frame: its 32x48 design drawn at side / 32, so a 38x57 raccoon standing about as tall
# as a medium dog, and a 32x48 seagull a head shorter.
SNATCH_SIDE = {"snatch-raccoon": 38, "snatch-seagull": 32}
# The Social dogs are medium dogs, 48x48 like the pack's, drawn SOCIAL_ZOOM narrower in that frame (as
# dogs.DOG_ZOOM draws the big dogs), so the collie is about 26px wide face on.
SOCIAL_SIDE = 48
SOCIAL_ZOOM = 0.82

# The Chase animals: (draw, idle poses, run (draw, poses), extra tags [(tag, draw, poses, ms)]), each pose a dict
# of keyword arguments.
CHASE = {
    "chase-cat": (cat, [dict(), dict(tail=1)], (cat_run, [dict(phase=k) for k in range(4)]), []),
    "chase-pigeons": (pigeons, [dict(), dict(peck=True)],
                      (pigeons, [dict(wings=w, lift=up) for w, up in PIGEONS_RUN]),
                      [("flee", pigeons_fleeing, [dict(wings=w, rise=up) for w, up in PIGEONS_FLEE], 80)]),
    "chase-ducklings": (ducklings, [dict(), dict(peep=True)], (ducklings, list(DUCKLINGS_RUN)),
                        [("hop", ducklings_hop, [dict(phase=k) for k in range(4)], 100)]),
    "chase-rabbit": (rabbit, [dict(), dict(twitch=1)], (rabbit, [dict(bound=k) for k in range(4)]),
                     [("hop", rabbit_hop, [dict(phase=k) for k in range(4)], 100)]),
}
CHASE_IDLE_MS, CHASE_RUN_MS = 300, 80
SNATCH = {
    "snatch-raccoon": (raccoon, raccoon_fleeing, FLEE),
    "snatch-seagull": (seagull, seagull_fleeing, SEAGULL_FLEE),
}
# The pose arguments that move a part by pixels, snapped to whole pixels at each scale.
POSE = ("lf", "rf", "bob", "fl", "fr", "bl", "br", "tail", "twitch")


def drawn(s, draw, *args, **q):
    """draw(*args, **q) on a minis.Mini at scale s, or (sx, sy), its pixel offsets snapped to whole pixels
    there."""
    pose = snap({k: v for k, v in q.items() if k in POSE}, s[1] if isinstance(s, tuple) else s)
    rest = {k: v for k, v in q.items() if k not in POSE}
    return minis.small(sys.modules[__name__], s, draw, *args, **rest, **pose).outlined()


def zoomed(s, draw, *args, **q):
    """A Social dog's frame: draw at s, SOCIAL_ZOOM narrower, set in the side(32, s) frame about its centre."""
    return minis.zoomed(drawn((s * SOCIAL_ZOOM, s), draw, *args, **q), s, (SOCIAL_ZOOM, 1), 0)


def animals(step):
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every animal at depth step step (1 at full
    size), at its frame side / 32 x step."""
    c = CHASE_SIDE / 32 * step
    for key, (draw, idle, (run, runs), extra) in CHASE.items():
        yield key, [("idle", [drawn(c, draw, **q) for q in idle], CHASE_IDLE_MS),
                    ("run", [drawn(c, run, **q) for q in runs], CHASE_RUN_MS),
                    *((tag, [drawn(c, d, **q) for q in qs], ms) for tag, d, qs, ms in extra)]
    for key, (draw, flee, flees) in SNATCH.items():
        t = SNATCH_SIDE[key] / 32 * step
        yield key, [("walk", [drawn(t, draw, **q) for q in road.PERSON_WALK], road.PERSON_WALK_MS),
                    ("flee", [drawn(t, flee, **q) for q in flees], FLEE_MS),
                    ("idle", [drawn(t, draw, bob=bb) for bb in BREATH], BREATH_MS)]
    d = SOCIAL_SIDE / 32 * step
    run = [dict(bob=q["bob"], front=q["front"], hind=q["hind"]) for q in hazards.CORGI_RUN]
    for key, draw in DOGS.items():
        yield key, [("walk", [zoomed(d, draw, **q) for q in road.CORGI_WALK], 100),
                    ("idle", [zoomed(d, draw, **q) for q in road.CORGI_IDLE], 300),
                    ("run", [zoomed(d, side_dog, SIDE[key], **q) for q in run], 100)]


def sprites():
    """Every animal at full size, then at each depth step."""
    return list(animals(1)) + [(f"{key}@{suffix}", tags) for suffix, step in STEPS for key, tags in animals(step)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/animals", __doc__)
