#!/usr/bin/env python3
"""Draw the per-zone looks of the Chase, Snatch and Social encounters: the same
mechanics as squirrel, thief and other-dog (with its owner), a different
animal or person per zone. Each skin has its base kind's frame size, tags,
frame counts, durations and anchor (the feet on the frame's bottom rows), and
the same depth variants at every step in minis.STEPS (@88, @75, @62, @50).

This script does not build: it imports road.PERSON_SCALE, which road.py no
longer has. Zone skins are not drawn in play (the game draws only the base
looks), so its exports stay as they are, unmaintained.

Like road.py's encounters, every skin is laid out on 32x32 (animals) or 32x48
(people and the Snatch animals) and drawn bigger on a minis.Mini: the animals
road.SCALE (1.25) times, exporting at 40x40 (35/30/25/20 at the steps), the
people and the Snatch animals road.PERSON_SCALE (1.75) times, exporting at
56x84 (49x74, 42x63, 35x53, 28x42). Everything faces the player
except flee, which runs off up the road, seen from behind. Road outline
(road_edge) and road.LIT's rim on dark fills, as road.py has them.

Chase (reskins squirrel, 40x40): idle (2 frames, 300ms: frame 1 a small
motion), run (2 frames, 120ms: stretched, then gathered and 2 to 3px higher).
  chase-cat          Willow Crescent    a tuxedo cat sitting on a grass tuft
  chase-pigeons      Main Street        three pigeons; idle pecks, run flutters
  chase-ducklings    Riverside Path     three ducklings; idle peeps, run waddles
  chase-rabbit       The Long Way Home  a white rabbit; idle twitches, run hops

Snatch (reskins thief, 56x84): walk (2 frames, 200ms: a foot lifted 2px),
flee (2 frames, 110ms: from behind), idle (2 frames, 400ms: breathing). Each
carries a tan loot sack, as the thief does.
  snatch-raccoon     Willow Crescent, The Long Way Home  standing, sack held at the chest
  snatch-seagull     Fairview Park, Riverside Path       the sack in its beak; flees flying

Social (reskins other-dog, 40x40, and other-dog-owner, 56x84): the dog's walk
(4 frames, 100ms) and idle (4 frames, 300ms: tail at -1, 0, +1, 0, the right
ear 1px higher on the last frame), the owner's walk (2 frames, 200ms) and idle
(2 frames, 400ms), as the other dog and its walker have them. The game draws
the dog left of its owner. The dog also runs as the zone's loose dog: run (4
frames, 100ms), side view facing right in loose-dog's gallop (hazards.CORGI_RUN),
without the broken leash, drawn in the dog's own 40x40 frame.
  social-gate-dog           Willow Crescent  a beagle with its paws on a picket gate
  social-gate-dog-owner                      a gardener: straw hat, green apron, gloves
  social-frisbee-dog        Fairview Park    a border collie with a red frisbee
  social-frisbee-dog-owner                   backwards cap, green tee, shorts
  social-handbag-dog        Main Street      a chihuahua in a purple handbag
  social-handbag-dog-owner                   a shopper: sunglasses, sky coat, shopping bag
  social-jogger-dog         Riverside Path   a husky in a running harness
  social-jogger-dog-owner                    a jogger: headband, tank top, shorts

Usage:
  skins_animals.py preview OUT.png   every frame of every skin and variant on
                                     the road colours
  skins_animals.py build             write art/skins-animals/*.aseprite and export
                                     to public/art/sprites/

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import hazards  # noqa: E402
import minis  # noqa: E402
import road  # noqa: E402
from minis import STEPS, snap  # noqa: E402
from pixel import Grid, build, edged, preview  # noqa: E402
from road import BREATH, BREATH_MS, LIT, PERSON_SCALE, SCALE  # noqa: E402

# The zone road colours: Willow Crescent, Fairview Park, Elm Avenue, Main Street, Riverside Path and The Long
# Way Home.
GROUNDS = ("8b9bb4", "e4a672", "3a4466", "f6757a", "ead4aa", "c28569")


def lit(g):
    """road.rim with road.LIT, looked up when called so minis.small's swap applies."""
    return road.rim(g, LIT)


def eyes(g, xs, y, c="ink"):
    """2x2 eyes at each x on row y, a white glint at the top-left."""
    for x in xs:
        g.rect(x, y, 2, 2, c)
        g.p(x, y, "white")


# ---------- Chase (reskins squirrel) ----------

def cat(tail=0, run=None):
    """A tuxedo cat facing the player: black coat, white bib, muzzle and paws, green eyes, its tail curling up
    its right side with a white tip. Sitting (run None) on a grass tuft, tail swishing 1px right at 1; run
    False is the bound's stretch, low and wide with the front paws apart, True the gather, airborne 3px
    higher with the paws tucked and the tail flung up."""
    g = edged(Grid())
    if run is None:
        # the lawn: a patch of grass under the cat, blades standing up along its back edge
        g.ell(16, 27.5, 12, 2, "green", "dgreen")
        for x in (5, 8, 23, 26):
            g.rect(x, 25, 1, 2, "green")
        g.ell(23 + tail, 21, 2, 6, "navy", "ink", "dslate")
        g.ell(22 + tail, 14.5, 2, 2, "white", "lgrey")
        g.ell(15, 21.5, 6, 6.5, "navy", "ink", "dslate")
        g.ell(15, 24, 3, 3.5, "white", "lgrey")
        for x in (11, 16):
            g.rect(x, 27, 3, 2, "white")
            g.p(x + 2, 28, "lgrey")
        head = 13
    elif not run:
        g.ell(23, 13, 2, 6, "navy", "ink", "dslate")
        g.ell(23, 7.5, 2, 2, "white", "lgrey")
        g.ell(16, 22, 7.5, 4.5, "navy", "ink", "dslate")
        g.ell(16, 23.5, 3.5, 2.5, "white", "lgrey")
        for x in (8, 21):
            g.rect(x, 23, 3, 3, "navy")
            g.rect(x, 26, 3, 3, "white")
            g.p(x + 2, 28, "lgrey")
        head = 17
    else:
        g.ell(21, 9, 2, 5, "navy", "ink", "dslate")
        g.ell(20, 4.5, 2, 2, "white", "lgrey")
        g.ell(15, 19, 5.5, 5, "navy", "ink", "dslate")
        g.ell(15, 20, 3, 3, "white", "lgrey")
        for x in (11, 17):
            g.rect(x, 24, 3, 2, "white")
        head = 13.5
    cx = 15 if run is None or run else 16
    cat_head(g, cx, head)
    return lit(g)


def cat_head(g, x, y):
    """The cat's head facing the player, centred on (x, y): pointed ears with pink insides, a white muzzle,
    green eyes and a pink nose."""
    g.tri((x - 6, y), (x - 5, y - 6.5), (x - 1.5, y - 3.5), "navy")
    g.tri((x + 6, y), (x + 5, y - 6.5), (x + 1.5, y - 3.5), "navy")
    g.p(x - 4.5, y - 3.5, "pink")
    g.p(x + 3.5, y - 3.5, "pink")
    g.ell(x, y, 6, 4.8, "navy", "ink", "dslate")
    g.ell(x, y + 2.5, 2.5, 1.6, "white", "lgrey")
    for ex in (x - 4.5, x + 1.5):
        g.rect(ex, y - 1.5, 3, 2, "green")
        g.rect(ex + 1, y - 1.5, 1, 2, "ink")
    g.p(x - 0.5, y + 1.5, "pink")


def pigeon(g, cx, by, peck=False, wings=0):
    """A pigeon facing the player with its feet on row by - 1: a round grey body, the green and mauve neck
    sheen, a small head. peck lowers the head to the ground; wings 1 raises both wings, -1 holds them out and
    down."""
    if wings:
        for side in (-1, 1):
            tip = (cx + side * 8, by - 13 if wings > 0 else by - 4)
            g.tri((cx + side * 2, by - 7), (cx + side * 2, by - 3), tip, "lgrey")
            g.tri((cx + side * 5, by - 7 if wings > 0 else by - 5), (cx + side * 5, by - 4), tip, "grey")
            g.p(tip[0] - side, tip[1] + (1 if wings > 0 else -1), "dslate")
    for x in (cx - 2, cx + 1):
        g.p(x, by - 1, "pink")
    g.ell(cx, by - 4, 5, 3.5, "grey", "slate", "lgrey")
    for side in (-1, 1):
        g.rect(cx + (3 if side > 0 else -4), by - 5, 1, 1, "dslate")
        g.rect(cx + (3 if side > 0 else -4), by - 3, 1, 1, "dslate")
    hy = by - 3 if peck else by - 9
    g.rect(cx - 2, by - 7, 4, 1, "green")
    g.p(cx - 2, by - 7, "mauve")
    g.p(cx + 1, by - 7, "mauve")
    g.ell(cx, hy, 2.2, 2.2, "grey", "slate", "lgrey")
    g.p(cx - 2, hy - 0.5, "orange")
    g.p(cx + 1, hy - 0.5, "orange")
    g.p(cx - 0.5, hy + 1.5, "dslate")
    g.p(cx - 0.5, hy + 0.5, "white")


def pigeons(peck=False, wings=0, lift=0):
    """Three pigeons, two behind and one in front; peck has the front one peck, wings and lift (pixels up)
    take the flock into a flutter."""
    g = edged(Grid())
    pigeon(g, 8, 21 - lift, wings=wings)
    pigeon(g, 24, 22 - lift, wings=-wings)
    pigeon(g, 16, 29 - lift, peck=peck, wings=wings)
    return lit(g)


def duckling(g, cx, by, peep=False, wing=0, step=0):
    """A duckling facing the player with its feet on row by - 1: a yellow puff with a tuft, an orange bill
    (open on peep) and little wings; wing 1 holds the wings up and out, step lifts one foot (-1 left, 1
    right)."""
    for x, side in ((cx - 2, -1), (cx + 1, 1)):
        g.rect(x, by - 1 - (1 if step == side else 0), 2, 1, "orange")
    g.ell(cx, by - 4, 4, 3.3, "yellow", "amber")
    for side in (-1, 1):
        if wing:
            g.tri((cx + side * 3, by - 6), (cx + side * 3, by - 3), (cx + side * 6, by - 8), "yellow")
        else:
            g.rect(cx + (3 if side > 0 else -4), by - 5, 1, 2, "amber")
    g.ell(cx, by - 9, 3, 2.8, "yellow", "amber")
    g.p(cx, by - 12.5, "yellow")
    g.p(cx - 2, by - 10, "ink")
    g.p(cx + 1, by - 10, "ink")
    g.rect(cx - 1, by - 9, 2, 1, "orange")
    if peep:
        g.rect(cx - 1, by - 8, 2, 1, "rust")


def ducklings(peep=False, wing=0, step=0, lift=0):
    """Three ducklings in a line, one in front; peep opens the front one's bill, wing, step and lift (pixels up)
    make the waddle-run."""
    g = edged(Grid())
    duckling(g, 8, 22 - lift, wing=wing, step=step)
    duckling(g, 24, 23 - lift, wing=wing, step=-step)
    duckling(g, 16, 29 - lift, peep=peep, wing=wing, step=step)
    return lit(g)


def rabbit(twitch=0, run=None):
    """A white rabbit facing the player: long ears with pink insides, a round head with pink nose, sitting
    with its big hind feet either side. twitch raises the right ear 1px and the nose; run False is
    the hop's stretch, low and long with the ears laid back, True the gather, 3px up with the ears raised."""
    g = edged(Grid())
    if run is None:
        hx, hy, ear = 16, 14.5, 3
        g.ell(16, 22, 6.5, 6, "white", "lgrey")
        for x in (8, 20):
            g.rect(x, 27, 5, 2, "white")
            g.rect(x, 28, 5, 1, "lgrey")
        for x in (12.5, 17.5):
            g.ell(x, 26, 2.2, 2.6, "lgrey")
            g.ell(x - 0.3, 25.8, 1.5, 2, "white")
    elif not run:
        hx, hy, ear = 16, 18.5, 6
        g.ell(16, 23, 8, 4.5, "white", "lgrey")
        for x in (8, 21):
            g.rect(x, 26, 3, 3, "white")
            g.p(x + 2, 28, "lgrey")
    else:
        hx, hy, ear = 16, 12.5, 2
        g.ell(16, 19, 6, 5, "white", "lgrey")
        for x in (11, 18):
            g.rect(x, 23, 3, 2, "white")
            g.p(x + 2, 24, "lgrey")
    t = twitch
    for x, up in ((hx - 3.5, 0), (hx + 3.5, t)):
        g.ell(x, hy - 3 - ear - up, 2, 5.5, "white", "lgrey")
        g.rect(x - 0.5, hy - 5 - ear - up, 1, 6, "pink")
    g.ell(hx, hy + 4.5, 4.5, 1.6, "lgrey")
    g.ell(hx, hy, 5.5, 4.5, "white", "lgrey")
    for x in (hx - 4, hx + 2):
        g.rect(x, hy - 1, 2, 2, "ink")
        g.p(x + (0 if x < hx else 1), hy + 1.5, "pink")
    g.p(hx - 0.5, hy + 1.5 - t, "pink")
    g.p(hx - 1.5, hy + 2.5, "lgrey")
    g.p(hx + 0.5, hy + 2.5, "lgrey")
    return lit(g)


# ---------- Snatch (reskins thief) ----------

def sack(g, x, y):
    """The tan loot sack centred on (x, y), its neck gathered at the top, as the thief's."""
    g.ell(x, y, 4, 4, "tan", "brown", "cream")
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
        g.ell(x, y + b, 2.6, 2.4, "dslate" if i % 2 else "lgrey", None)
    g.ell(26, 24 + b, 2, 1.8, "ink")
    for x, f in ((11, lf), (17, rf)):
        g.rect(x, 37 + b, 4, 6 + f - b, "dslate")
        g.rect(x - 1, 43 + f, 5, 2, "ink")
    g.ell(16, 32 + b, 8, 7.5, "slate", "dslate", "grey")
    g.ell(16, 33.5 + b, 4.5, 5, "lgrey", "grey")
    sack(g, 16, 31 + b)
    for x in (10, 19):
        g.rect(x, 30 + b, 3, 2, "ink")
    # head: wide, the ears pale-tipped
    for x, tip in ((9, 10), (23, 22)):
        g.tri((x, 17 + b), (tip, 9.5 + b), (16 + (-3 if x < 16 else 3), 13 + b), "slate")
        g.p(tip, 11 + b, "lgrey")
    g.ell(16, 18.5 + b, 8.5, 6.5, "slate", "dslate", "grey")
    g.rect(9, 15 + b, 5, 1, "white")
    g.rect(18, 15 + b, 5, 1, "white")
    g.rect(8, 17 + b, 16, 3, "ink")
    g.rect(15, 15 + b, 2, 4, "grey")
    g.rect(11, 18 + b, 2, 1, "white")
    g.rect(19, 18 + b, 2, 1, "white")
    g.ell(16, 21.5 + b, 3.5, 2.5, "white", "lgrey")
    g.rect(15, 20 + b, 2, 1, "ink")
    g.rect(15, 23 + b, 3, 1, "dbrown")
    g.p(18, 22 + b, "dbrown")
    return lit(g)


def raccoon_fleeing(stride):
    """The raccoon running off up the road, seen from behind: the lifted leg short, the other planted, the
    ringed tail swinging down its back against the stride and the loot sack bouncing over its right
    shoulder."""
    g = edged(Grid(32, 48))
    s = stride
    b = -1
    for x, lift in ((11, s < 0), (17, s > 0)):
        if lift:
            g.rect(x, 36 + b, 4, 4, "dslate")
            g.rect(x - 1, 40 + b, 5, 2, "ink")
        else:
            g.rect(x, 36 + b, 4, 7 - b, "dslate")
            g.rect(x - 1, 43, 5, 2, "ink")
    for x, back in ((7, s < 0), (25, s > 0)):
        g.rect(x - 1, (31 if back else 25) + b, 3, 4, "dslate")
        g.rect(x - 1, (35 if back else 29) + b, 3, 2, "ink")
    g.ell(16, 31 + b, 8, 7.5, "slate", "dslate", "grey")
    k = b + (1 if s > 0 else 0)
    sack(g, 22, 27 + k)
    # the tail down the back, swinging against the stride
    for i, y in enumerate((30, 34, 38)):
        g.ell(16 - s * (1 + i), y + b, 2.6, 2.4, "dslate" if i % 2 else "lgrey", None)
    g.ell(16 - s * 4, 41.5 + b, 2, 1.8, "ink")
    for x, tip in ((9, 10), (23, 22)):
        g.tri((x, 17 + b), (tip, 9.5 + b), (16 + (-3 if x < 16 else 3), 13 + b), "slate")
    g.ell(16, 18.5 + b, 8.5, 6.5, "slate", "dslate", "grey")
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
        g.ell(x, 30 + b, 3, 7, "grey", "slate", "lgrey")
        g.tri((x - 2, 34 + b), (x + 2, 34 + b), (x + side * 1, 40 + b), "ink")
        g.p(x, 35 + b, "white")
    g.ell(16, 30 + b, 6.5, 7.5, "white", "lgrey")
    g.ell(16, 17 + b, 6, 5.5, "white", "lgrey")
    # a fierce brow over each yellow eye
    for x, side in ((12, -1), (19, 1)):
        g.rect(x, 16 + b, 2, 2, "yellow")
        g.p(x + (1 if side < 0 else 0), 17 + b, "ink")
        g.rect(x, 15 + b, 2, 1, "grey")
        g.p(x + (0 if side < 0 else 1), 14 + b, "grey")
    g.rect(15, 19 + b, 2, 3, "yellow")
    g.p(16, 21 + b, "red")
    sack(g, 16, 27 + b)
    return lit(g)


def seagull_fleeing(stride):
    """The seagull flying off up the road, seen from behind: grey back, white head and tail, wings spread with
    black tips, raised (stride -1) or swept down (1), the sack dangling under it and its feet tucked."""
    g = edged(Grid(32, 48))
    up = stride < 0
    y0 = 20
    for side in (-1, 1):
        root_hi, root_lo = (16 + side * 4, y0 + 4), (16 + side * 4, y0 + 9)
        tip = (16 + side * 15, y0 - 8 if up else y0 + 14)
        g.tri(root_hi, root_lo, tip, "grey")
        g.tri(root_hi, (16 + side * 9, y0 + (0 if up else 8)), tip, "lgrey")
        g.tri((16 + side * 12, y0 + (-4 if up else 10)), (16 + side * 13, y0 + (-2 if up else 13)), tip, "ink")
    sack(g, 16, y0 + 18)
    g.rect(14, y0 + 13, 1, 2, "pink")
    g.rect(17, y0 + 13, 1, 2, "pink")
    g.ell(16, y0 + 7, 5, 6, "grey", "slate", "lgrey")
    g.tri((13, y0 + 11), (19, y0 + 11), (16, y0 + 15), "white")
    g.ell(16, y0 - 1, 4.5, 4, "white", "lgrey")
    return lit(g)


# ---------- Social (reskins other-dog and other-dog-owner) ----------

def gate_dog(fl=0, fr=0, bl=0, br=0, bob=0, tail=0, twitch=0):
    """A beagle behind a white picket gate, facing the player: its tan head with a white blaze and long brown
    ears over the top rail, its white front paws on the picket tips and its tail wagging behind. A reaching
    paw (fl, fr) lifts 1px; bob raises the dog; tail moves the tail sideways and twitch the right ear."""
    g = edged(Grid())
    b = bob
    g.ell(24.5 + tail, 12 + b, 1.8, 3.5, "tan", "brown", "cream")
    g.p(24 + tail, 9 + b, "white")
    g.ell(16, 19 + b, 8, 4.5, "tan", "brown", "cream")
    g.ell(16, 18 + b, 3.5, 3, "white", "lgrey")
    # the gate: two rails behind five pointed pickets
    for y in (21, 26):
        g.rect(3, y, 26, 2, "lgrey")
        g.rect(3, y + 1, 26, 1, "grey")
    for x in (4, 9, 14, 19, 24):
        g.rect(x, 19, 4, 11, "white")
        g.rect(x + 3, 19, 1, 11, "lgrey")
        g.tri((x, 19), (x + 4, 19), (x + 2, 16.5), "white")
    g.p(26, 24, "amber")
    for x, k in ((9, fl), (20, fr)):
        g.rect(x, 16 + b - (1 if k > 0 else 0), 3, 2, "tan")
        g.rect(x, 17 + b - (1 if k > 0 else 0), 3, 1, "white")
        g.p(x + 2, 16 + b - (1 if k > 0 else 0), "brown")
    t = twitch
    g.ell(8.5, 12.5 + b, 2.3, 4.5, "dbrown", "plum", "brown")
    g.ell(23.5, 12.5 + b + t, 2.3, 4.5, "dbrown", "plum", "brown")
    g.ell(16, 10.5 + b, 6.5, 5, "tan", "brown", "cream")
    g.rect(15, 5 + b, 2, 6, "white")
    g.ell(16, 13.5 + b, 3.5, 2.2, "white", "lgrey")
    eyes(g, (11, 19), 9 + b)
    g.rect(15, 12 + b, 2, 1, "ink")
    g.rect(15, 14 + b, 2, 1, "pink")
    return lit(g)


def collie(fl=0, fr=0, bl=0, br=0, bob=0, tail=0, twitch=0):
    """A border collie trotting at the player with a red frisbee gripped at the side of its mouth: black coat,
    white blaze, ruff and socks, half-pricked ears with folded tips, the plume of its tail over its right
    shoulder. Leg offsets, bob, tail and twitch as road.corgi has them."""
    g = edged(Grid())
    b = bob

    def lift(k):
        return -2 if k > 0 else 0

    g.ell(24.5 + tail, 15.5 + b, 2.5, 3, "navy", "ink", "dslate")
    g.p(25 + tail, 13 + b, "white")
    for x, k in ((13, bl), (17, br)):
        g.rect(x, 24 + b, 2, 5 + lift(k) - b, "navy")
        g.rect(x, 28 + lift(k), 2, 1, "lgrey")
    g.ell(16, 22 + b, 8, 4.5, "navy", "ink", "dslate")
    g.ell(16, 22 + b, 4.5, 4, "white", "lgrey")
    for x, k in ((9, fl), (20, fr)):
        g.rect(x, 23 + b, 3, 4 + lift(k) - b, "navy")
        g.rect(x, 26 + lift(k), 3, 3, "white")
        g.p(x + 2, 28 + lift(k), "lgrey")
    t = twitch
    g.tri((8, 13 + b), (9, 5.5 + b), (13.5, 9.5 + b), "navy")
    g.tri((24, 13 + b + t), (23, 5.5 + b + t), (18.5, 9.5 + b + t), "navy")
    g.tri((8, 7 + b), (9, 5.5 + b), (11, 6.5 + b), "white")
    g.tri((24, 7 + b + t), (23, 5.5 + b + t), (21, 6.5 + b + t), "white")
    g.ell(16, 13.5 + b, 7, 5.5, "navy", "ink", "dslate")
    g.rect(15, 8 + b, 2, 7, "white")
    g.ell(16, 16.5 + b, 4.5, 2.5, "white", "lgrey")
    eyes(g, (11, 19), 12 + b, "amber")
    g.p(12, 13 + b, "ink")
    g.p(20, 13 + b, "ink")
    g.rect(15, 15 + b, 2, 1, "ink")
    # the frisbee, gripped by its rim at the side of the mouth: a red disc with a dark inner ring
    g.ell(11, 20 + b, 4.5, 4, "red", "dred", "pink")
    g.ell(11, 20 + b, 2.6, 2.2, "dred")
    g.ell(10.6, 19.6 + b, 1.6, 1.3, "red")
    g.p(14, 18 + b, "dbrown")
    return lit(g)


def handbag_dog(fl=0, fr=0, bl=0, br=0, bob=0, tail=0, twitch=0):
    """A chihuahua peeking out of a purple handbag set down on the road: the bag's gold handle arching behind
    it, its fawn apple head, huge pink-lined ears, big eyes, front paws over the bag's rim and its tail out of
    the bag's right side. A reaching paw (fl, fr) lifts 1px; bob raises the dog 1px; tail moves the tail
    sideways and twitch the right ear."""
    g = edged(Grid())
    b = bob
    g.ell(16, 18, 8.5, 11, "amber")
    g.ell(16, 18, 7.5, 10, None)
    g.ell(25.5 + tail, 15 + b, 1.5, 2.5, "tan", "brown", "cream")
    g.ell(16, 18 + b, 5, 3.5, "tan", "brown", "cream")
    # the bag: quilted purple, a mauve top edge, a gold clasp
    g.rect(6, 19, 20, 10, "purple")
    g.rect(6, 19, 20, 1, "mauve")
    g.rect(6, 19, 1, 9, "mauve")
    g.rect(6, 28, 20, 1, "plum")
    g.rect(25, 20, 1, 8, "plum")
    for x in (11, 16, 21):
        g.rect(x, 21, 1, 6, "plum")
    g.rect(15, 21, 3, 2, "amber")
    g.p(16, 23, "yellow")
    for x, k in ((10, fl), (19, fr)):
        g.rect(x, 18 + b - (1 if k > 0 else 0), 3, 2, "cream")
    t = twitch
    g.tri((10, 12 + b), (4, 3 + b), (14, 7 + b), "tan")
    g.tri((22, 12 + b + t), (28, 3 + b + t), (18, 7 + b + t), "tan")
    g.tri((9.5, 10 + b), (6, 5 + b), (12.5, 8 + b), "pink")
    g.tri((22.5, 10 + b + t), (26, 5 + b + t), (19.5, 8 + b + t), "pink")
    g.ell(16, 12 + b, 6, 5, "tan", "brown", "cream")
    g.ell(16, 15 + b, 3, 2, "cream")
    eyes(g, (11, 19), 10 + b)
    g.p(12, 11 + b, "ink")
    g.p(20, 11 + b, "ink")
    g.rect(15, 14 + b, 2, 1, "ink")
    g.rect(13, 17 + b, 6, 1, "sky")
    g.p(16, 18 + b, "amber")
    return lit(g)


def husky(fl=0, fr=0, bl=0, br=0, bob=0, tail=0, twitch=0):
    """A husky trotting at the player in a sky running harness: grey cap and saddle, a white mask with dark
    brows, pricked ears, blue eyes, white chest and legs, the curled tail over its back. Leg offsets, bob, tail
    and twitch as road.corgi has them."""
    g = edged(Grid())
    b = bob

    def lift(k):
        return -2 if k > 0 else 0

    g.ell(24.5 + tail, 14.5 + b, 3, 3, "grey", "slate", "lgrey")
    g.ell(24.5 + tail, 14.5 + b, 1.5, 1.5, "white")
    for x, k in ((13, bl), (17, br)):
        g.rect(x, 24 + b, 2, 5 + lift(k) - b, "lgrey")
        g.rect(x, 28 + lift(k), 2, 1, "grey")
    g.ell(16, 22 + b, 8.5, 4.5, "grey", "slate", "lgrey")
    g.ell(16, 22.5 + b, 4.5, 4, "white", "lgrey")
    # the harness: a chest strap and a band round the shoulders
    g.rect(8, 20 + b, 16, 2, "sky")
    g.rect(8, 20 + b, 16, 1, "cyan")
    g.rect(15, 22 + b, 2, 3, "sky")
    for x, k in ((9, fl), (20, fr)):
        g.rect(x, 23 + b, 3, 4 + lift(k) - b, "white")
        g.rect(x + 2, 23 + b, 1, 4 + lift(k) - b, "lgrey")
        g.rect(x, 27 + lift(k), 3, 2, "white")
        g.p(x + 2, 28 + lift(k), "lgrey")
    t = twitch
    g.tri((8, 13 + b), (9, 4 + b), (14, 9 + b), "slate")
    g.tri((24, 13 + b + t), (23, 4 + b + t), (18, 9 + b + t), "slate")
    g.tri((10, 11 + b), (10, 7 + b), (12.5, 9.5 + b), "pink")
    g.tri((22, 11 + b + t), (22, 7 + b + t), (19.5, 9.5 + b + t), "pink")
    g.ell(16, 13.5 + b, 7.5, 5.5, "slate", "dslate", "grey")
    g.ell(16, 15.5 + b, 6, 3.5, "white", "lgrey")
    g.rect(15, 9 + b, 2, 4, "white")
    g.rect(11, 11 + b, 2, 1, "white")
    g.rect(19, 11 + b, 2, 1, "white")
    eyes(g, (11, 19), 13 + b, "sky")
    g.rect(15, 16 + b, 2, 1, "ink")
    g.rect(15, 18 + b, 2, 1, "pink")
    return lit(g)


def gardener_top(g, b):
    """The gate dog's owner: a straw sun hat, a green apron over a white tee, amber gardening gloves."""
    g.rect(9, 21 + b, 14, 13, "white")
    g.rect(20, 21 + b, 3, 13, "lgrey")
    g.rect(11, 23 + b, 10, 11, "green")
    g.rect(18, 23 + b, 3, 11, "dgreen")
    g.rect(12, 28 + b, 5, 3, "dgreen")
    g.rect(11, 21 + b, 1, 2, "dgreen")
    g.rect(20, 21 + b, 1, 2, "dgreen")
    for x in (5, 23):
        g.rect(x, 22 + b, 4, 8, "white")
        g.rect(x + 3, 22 + b, 1, 8, "lgrey")
        g.rect(x, 30 + b, 4, 3, "amber")
        g.rect(x + 3, 30 + b, 1, 3, "orange")
    g.ell(16, 12.5 + b, 8, 8, "skin1", "skin2")
    g.rect(8, 9 + b, 2, 7, "ochre")
    g.rect(22, 9 + b, 2, 7, "ochre")
    road.face_front(g, 16, 13 + b)
    g.p(10, 16 + b, "pink")
    g.p(22, 16 + b, "pink")
    g.ell(16, 8 + b, 13, 2.5, "cream", "tan")
    g.ell(16, 5.5 + b, 6.5, 3.5, "cream", "tan")
    g.rect(10, 7 + b, 12, 1, "red")


def frisbee_top(g, b):
    """The frisbee dog's owner: a red cap on backwards, a green tee and sky shorts."""
    g.rect(11, 33 + b, 10, 4, "sky")
    g.rect(19, 33 + b, 2, 4, "blue")
    g.rect(9, 21 + b, 14, 12, "green")
    g.rect(20, 21 + b, 3, 12, "dgreen")
    g.rect(14, 21 + b, 4, 1, "dgreen")
    g.rect(5, 22 + b, 4, 5, "green")
    g.rect(5, 27 + b, 4, 6, "skin2")
    g.rect(5, 31 + b, 4, 2, "skin1")
    g.rect(23, 22 + b, 4, 5, "green")
    g.rect(23, 27 + b, 4, 6, "skin2")
    g.rect(23, 31 + b, 4, 2, "skin1")
    g.ell(16, 12.5 + b, 8, 8, "skin2", "brown", "skin1")
    g.rect(8, 9 + b, 2, 5, "dbrown")
    g.rect(22, 9 + b, 2, 5, "dbrown")
    g.ell(16, 7.5 + b, 8.5, 4.5, "red", "dred", "pink")
    g.rect(8, 9 + b, 17, 1, "dred")
    # the cap on backwards: the strap's gap and its button over the forehead
    g.rect(14, 8 + b, 4, 2, "dbrown")
    g.p(16, 3 + b, "dred")
    road.face_front(g, 16, 13 + b)


def shopper_top(g, b):
    """The handbag dog's owner: a sky coat with a white collar and buttons, a blonde bob under sunglasses, red
    lips and a shopping bag in the right hand."""
    g.rect(9, 21 + b, 14, 15, "sky")
    g.rect(20, 21 + b, 3, 15, "blue")
    g.rect(9, 21 + b, 1, 14, "cyan")
    g.tri((11, 21 + b), (21, 21 + b), (16, 25 + b), "white")
    for y in (27, 31):
        g.p(15, y + b, "white")
    g.rect(5, 22 + b, 4, 9, "sky")
    g.rect(5, 31 + b, 4, 2, "skin1")
    g.rect(23, 22 + b, 4, 9, "sky")
    g.rect(26, 22 + b, 1, 9, "blue")
    g.rect(23, 31 + b, 4, 2, "skin1")
    g.rect(22, 33 + b, 7, 7, "orange")
    g.rect(22, 33 + b, 7, 1, "amber")
    g.rect(27, 34 + b, 2, 6, "rust")
    g.rect(24, 31 + b, 1, 2, "white")
    g.rect(26, 31 + b, 1, 2, "white")
    g.ell(16, 12.5 + b, 8, 8, "skin1", "skin2")
    g.ell(16, 8.5 + b, 9, 5, "amber", "orange", "yellow")
    g.rect(7, 9 + b, 3, 9, "amber")
    g.rect(22, 9 + b, 3, 9, "orange")
    g.rect(10, 9 + b, 12, 2, "amber")
    road.face_front(g, 16, 13 + b, lips="red")
    g.rect(10, 12 + b, 5, 3, "ink")
    g.rect(17, 12 + b, 5, 3, "ink")
    g.rect(15, 12 + b, 2, 1, "ink")
    g.p(11, 12 + b, "slate")
    g.p(18, 12 + b, "slate")


def jogger_top(g, b):
    """The jogger: a red headband and wristbands, a sky tank top, navy shorts, dark hair in a high bun."""
    g.rect(11, 33 + b, 10, 4, "navy")
    g.rect(19, 33 + b, 2, 4, "ink")
    g.rect(10, 21 + b, 12, 12, "sky")
    g.rect(19, 21 + b, 3, 12, "blue")
    g.rect(10, 21 + b, 1, 11, "cyan")
    g.rect(13, 21 + b, 6, 2, "skin1")
    for x in (5, 23):
        g.rect(x + 1, 21 + b, 4, 10, "skin1")
        g.rect(x + (4 if x > 16 else 1), 21 + b, 1, 10, "skin2")
        g.rect(x + 1, 28 + b, 4, 2, "red")
        g.rect(x + 1, 30 + b, 4, 2, "skin1")
    g.ell(16, 12.5 + b, 8, 8, "skin1", "skin2")
    g.ell(16, 8 + b, 8.5, 4.5, "dbrown", "plum", "brown")
    g.ell(16, 2.5 + b, 3, 2.5, "dbrown", "plum", "brown")
    g.rect(7, 9 + b, 2, 6, "dbrown")
    g.rect(23, 9 + b, 2, 6, "dbrown")
    g.rect(8, 9 + b, 16, 2, "red")
    g.rect(8, 10 + b, 16, 1, "dred")
    road.face_front(g, 16, 13 + b)
    g.p(10, 16 + b, "pink")
    g.p(22, 16 + b, "pink")


# ---------- Social run: the loose dog's crossing, as the zone's Social dog ----------

def side_dog(spec, bob=0, front=(14, 27), hind=(11, 27)):
    """A Social dog galloping across the road in side view, facing right, on hazards.corgi_side's skeleton:
    the same body, hips, shoulders and paw positions per frame (hazards.CORGI_RUN), so it runs in the loose
    dog's pose, without the broken leash. spec is one of SIDE: the coat (fill, shade, light), the white or
    cream underside, the leg and sock colours, the ears, the tail and an extra (the frisbee, the harness or
    the collar)."""
    g = edged(Grid())
    b = bob + 1
    coat, under, leg, sock = spec["coat"], spec["under"], spec["leg"], spec["sock"]
    far = spec.get("far", coat[1])
    for (x, y), (px, py) in (((10, 21 + b), hind), ((20, 21 + b), front)):
        hazards.limb(g, x, y, px + 3, py - 1, 2, far)
        g.rect(px + 3, py, 2, 2, "lgrey")
    tail = spec["tail"]
    if tail == "up":
        g.ell(4, 12 + b, 1.5, 4.5, *coat)
        g.ell(4, 8.5 + b, 1.3, 1.5, "white")
    elif tail == "plume":
        g.ell(4, 19 + b, 4, 2.2, *coat)
        g.ell(1.5, 19.5 + b, 1.5, 1.4, "white")
    elif tail == "curl":
        g.ell(7, 14 + b, 3.5, 3.2, *coat)
        g.ell(7, 14 + b, 1.5, 1.4, under)
    else:
        g.ell(4.5, 14 + b, 1.3, 3.5, *coat)
    g.ell(14, 19 + b, 9.5, 5, *coat)
    if spec.get("saddle"):
        g.ell(12, 16.5 + b, 6, 2.5, spec["saddle"], None)
    g.ell(15, 22 + b, 7, 2, under, "lgrey" if under == "white" else "tan")
    g.ell(21, 19 + b, 3, 3.5, under, "lgrey" if under == "white" else "tan")
    if spec.get("harness"):
        g.rect(17, 14 + b, 2, 10, "sky")
        g.rect(17, 14 + b, 1, 10, "cyan")
        g.rect(9, 14 + b, 8, 1, "sky")
    for (x, y), (px, py) in (((7, 21 + b), hind), ((18, 21 + b), front)):
        hazards.limb(g, x, y, px, py - 1, 3, leg)
        g.rect(px, py, 3, 2, sock)
        g.p(px + 2, py + 1, "lgrey" if sock == "white" else "tan")
    ears = spec["ears"]
    if ears in ("prick", "big"):
        big = ears == "big"
        g.tri((19.5, 9 + b), (19 if big else 20.5, (0 if big else 2) + b), (24, 7.5 + b), coat[0])
        g.tri((21, 8 + b), (20.5 if big else 21, (2.5 if big else 4.5) + b), (23, 7.5 + b), "pink")
    g.ell(23.5, 12.5 + b, 5, 4.5, *coat)
    if ears == "flop":
        g.ell(21, 13.5 + b, 2.2, 4, "dbrown", "plum", "brown")
    if spec.get("mask"):
        g.ell(25, 13.5 + b, 3.5, 2.5, "white", "lgrey")
        g.rect(23, 10 + b, 2, 1, "white")
    g.ell(27, 14.5 + b, 3, 2, spec["muzzle"], "lgrey" if spec["muzzle"] == "white" else "tan")
    g.rect(29, 13 + b, 1, 2, "ink")
    g.p(28, 13 + b, "ink")
    eye = spec.get("eye", "ink")
    g.rect(24, 11 + b, 2, 2, eye)
    g.p(24, 11 + b, "white")
    if eye != "ink":
        g.p(25, 12 + b, "ink")
    g.p(27, 16 + b, "dbrown")
    if spec.get("frisbee"):
        g.ell(29.5, 17.5 + b, 2.2, 3.5, "red", "dred", "pink")
        g.rect(29, 16 + b, 1, 3, "dred")
    if spec.get("collar"):
        g.rect(19, 13 + b, 2, 5, spec["collar"])
    return lit(g)


# Each Social dog's side view, for side_dog.
SIDE = {
    "social-gate-dog": dict(coat=("tan", "brown", "cream"), saddle="dbrown", under="white", leg="tan", sock="white",
                            ears="flop", tail="up", muzzle="white", collar="red"),
    "social-frisbee-dog": dict(coat=("navy", "ink", "dslate"), far="ink", under="white", leg="navy", sock="white",
                               ears="prick", tail="plume", muzzle="white", eye="amber", frisbee=True),
    "social-handbag-dog": dict(coat=("tan", "brown", "cream"), under="cream", leg="tan", sock="cream",
                               ears="big", tail="thin", muzzle="cream", collar="sky"),
    "social-jogger-dog": dict(coat=("grey", "slate", "lgrey"), under="white", leg="white", sock="white",
                              ears="prick", tail="curl", muzzle="white", mask=True, eye="sky", harness=True),
}


# Each owner: (top, legs, shoes).
OWNERS = {
    "social-gate-dog": (gardener_top, "blue", "dgreen"),
    "social-frisbee-dog": (frisbee_top, "skin2", "white"),
    "social-handbag-dog": (shopper_top, "ink", "red"),
    "social-jogger-dog": (jogger_top, "skin1", "white"),
}
DOGS = {
    "social-gate-dog": gate_dog,
    "social-frisbee-dog": collie,
    "social-handbag-dog": handbag_dog,
    "social-jogger-dog": husky,
}
# The Chase skins: (draw, idle poses, run poses), each a dict of keyword arguments.
CHASE = {
    "chase-cat": (cat, [dict(), dict(tail=1)], [dict(run=False), dict(run=True)]),
    "chase-pigeons": (pigeons, [dict(), dict(peck=True)], [dict(wings=-1), dict(wings=1, lift=3)]),
    "chase-ducklings": (ducklings, [dict(), dict(peep=True)], [dict(step=-1, wing=1), dict(step=1, lift=2)]),
    "chase-rabbit": (rabbit, [dict(), dict(twitch=1)], [dict(run=False), dict(run=True)]),
}
SNATCH = {
    "snatch-raccoon": (raccoon, raccoon_fleeing),
    "snatch-seagull": (seagull, seagull_fleeing),
}
# The pose arguments that move a part by pixels, snapped to whole pixels at each scale.
POSE = ("lf", "rf", "bob", "fl", "fr", "bl", "br", "tail", "twitch", "lift")


def drawn(s, draw, *args, **q):
    """draw(*args, **q) on a minis.Mini at scale s, its pixel offsets snapped to whole pixels there."""
    pose = snap({k: v for k, v in q.items() if k in POSE}, s)
    rest = {k: v for k, v in q.items() if k not in POSE}
    return minis.small(sys.modules[__name__], s, draw, *args, **rest, **pose).outlined()


def dressed(s, top, legs, shoes, **q):
    """road.dressed(top) on a minis.Mini at scale s: legs and shoes, the caller's top, the road outline and
    the lit rim, the pose snapped to whole pixels."""
    pose = snap({k: v for k, v in q.items() if k in POSE}, s)
    return minis.small(road, s, road.dressed, top, legs=legs, shoes=shoes, **pose).outlined()


def skins(step):
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every skin at depth step step (1 at full size),
    laid out at 32 units: the animals drawn at road.SCALE x step, the people and the Snatch animals at
    road.PERSON_SCALE x step."""
    s, t = SCALE * step, PERSON_SCALE * step
    for key, (draw, idle, run) in CHASE.items():
        yield key, [("idle", [drawn(s, draw, **q) for q in idle], 300),
                    ("run", [drawn(s, draw, **q) for q in run], 120)]
    for key, (draw, flee) in SNATCH.items():
        yield key, [("walk", [drawn(t, draw, lf=-2), drawn(t, draw, rf=-2)], 200),
                    ("flee", [drawn(t, flee, k) for k in (-1, 1)], 110),
                    ("idle", [drawn(t, draw, bob=bb) for bb in BREATH], BREATH_MS)]
    for key, draw in DOGS.items():
        run = [dict(bob=q["bob"], front=q["front"], hind=q["hind"]) for q in hazards.CORGI_RUN]
        yield key, [("walk", [drawn(s, draw, **q) for q in road.CORGI_WALK], 100),
                    ("idle", [drawn(s, draw, **q) for q in road.CORGI_IDLE], 300),
                    ("run", [drawn(s, side_dog, SIDE[key], **q) for q in run], 100)]
        top, legs, shoes = OWNERS[key]
        yield f"{key}-owner", [("walk", [dressed(t, top, legs, shoes, **q) for q in (dict(lf=-2), dict(rf=-2))], 200),
                               ("idle", [dressed(t, top, legs, shoes, bob=bb) for bb in BREATH], BREATH_MS)]


def base(key):
    """The road.py kind a skin reskins."""
    if key.startswith("chase-"):
        return "squirrel"
    if key.startswith("snatch-"):
        return "thief"
    return "other-dog-owner" if key.endswith("-owner") else "other-dog"


def sprites():
    """Every skin at full size, then at each depth step, after checking each keeps its base kind's frame size,
    tags, frame counts and durations; a Social dog has loose-dog's run after other-dog's tags."""
    kinds = dict(road.sprites())
    kinds["other-dog"] = kinds["other-dog"] + dict(hazards.sprites())["loose-dog"]
    out = list(skins(1)) + [(f"{key}@{suffix}", tags) for suffix, step in STEPS for key, tags in skins(step)]
    full = dict(out)
    for key, tags in out:
        name, _, suffix = key.partition("@")
        want = kinds[base(name)]
        got = [(tag, len(fs), ms) for tag, fs, ms in tags]
        if got != [(tag, len(fs), ms) for tag, fs, ms in want]:
            sys.exit(f"{key}: tags {got} differ from {base(name)}'s")
        size = (len(tags[0][1][0][0]), len(tags[0][1][0]))
        ref = full[name][0][1][0] if suffix else want[0][1][0]
        step = dict(STEPS)[suffix] if suffix else 1
        expect = (minis.scaled(len(ref[0]), step), minis.scaled(len(ref), step))
        if size != expect:
            sys.exit(f"{key}: {size[0]}x{size[1]}, not {expect[0]}x{expect[1]}")
    return out


if __name__ == "__main__":
    # minis swaps the Grid of the module named skins_animals, so the build runs that module's functions
    import skins_animals

    argv = sys.argv
    if len(argv) == 3 and argv[1] == "preview":
        preview(skins_animals.sprites(), argv[2], GROUNDS)
    elif len(argv) == 2 and argv[1] == "build":
        build(skins_animals.sprites(), "art/skins-animals")
    else:
        sys.exit(__doc__)
