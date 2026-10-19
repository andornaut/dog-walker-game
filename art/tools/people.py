#!/usr/bin/env python3
"""Draw the owners standing, full body, and build their Aseprite sources and exports.

owner-<dog>: 32x48, chibi, front view, in Endesga 32 with the road outline and
the lit rim, like the forced-stop people in road.py. Each owner's hair, skin,
glasses and clothes match their face-owner-<dog> portrait in owners.py, and
their job shows in a prop held in the left hand. They stand at the gate on the
home screen before the first walk and wave the pack home on the end screen.
Tags: idle (2 frames at 400ms: they breathe, the body 1px higher on the second
with the feet planted) and wave (2 frames at 300ms: the right arm raised, the
hand swinging out and back).

Usage:
  people.py preview OUT.png   contact sheet of every frame, scaled up
  people.py build             write art/people/*.aseprite, then export
                              public/art/sprites/*.png and *.json with Aseprite

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py;
the standing figure, face and rim come from road.py.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import edged, main, road_sprite  # noqa: E402
from road import BREATH, BREATH_MS, LIT, face_front, person, rim  # noqa: E402

WAVES = ("up", "out")
WAVE_MS = 300


def arms(g, b, wave, sleeve, shade, hand, short=False):
    """Both arms. The left hangs at rest, holding the owner's prop; the right hangs too, or waves: up is the
    arm raised straight with the hand open above the shoulder, out swings the forearm and hand 3px outward.
    short sleeves end at the elbow, leaving the forearm bare."""
    g.rect(5, 22 + b, 4, 12, hand if short else sleeve)
    g.rect(5, 22 + b, 4, 4 if short else 9, sleeve)
    g.rect(8, 22 + b, 1, 4 if short else 9, shade)
    g.rect(5, 31 + b, 4, 3, hand)
    if wave is None:
        g.rect(23, 22 + b, 4, 12, hand if short else sleeve)
        g.rect(23, 22 + b, 4, 4 if short else 9, sleeve)
        g.rect(26, 22 + b, 1, 4 if short else 9, shade)
        g.rect(23, 31 + b, 4, 3, hand)
    elif wave == "up":
        g.rect(23, 12 + b, 4, 10, hand if short else sleeve)
        g.rect(23, 18 + b if short else 12 + b, 4, 4 if short else 10, sleeve)
        g.rect(26, 18 + b if short else 12 + b, 1, 4 if short else 10, shade)
        g.rect(23, 9 + b, 4, 3, hand)
        g.p(22, 10 + b, hand)
    else:
        g.rect(23, 17 + b, 4, 5, sleeve)
        g.rect(26, 17 + b, 1, 5, shade)
        g.rect(25, 12 + b, 4, 5, hand if short else sleeve)
        g.rect(26, 9 + b, 4, 3, hand)
        g.p(25, 10 + b, hand)


def torso(g, b, shirt, shade, h=13):
    g.rect(9, 21 + b, 14, h, shirt)
    g.rect(20, 21 + b, 3, h, shade)


def head(g, b, skin, shade, lit=None):
    g.ell(16, 12.5 + b, 8, 8, skin, shade, lit)


def cheeks(g, b, c="pink"):
    g.p(10, 16 + b, c)
    g.p(22, 16 + b, c)


def specs(g, b, c):
    """Round glasses: a ring round each eye and a bridge between them."""
    for x in (10, 18):
        g.rect(x + 1, 11 + b, 2, 1, c)
        g.rect(x + 1, 16 + b, 2, 1, c)
        g.rect(x, 12 + b, 1, 4, c)
        g.rect(x + 3, 12 + b, 1, 4, c)
    g.rect(14, 13 + b, 4, 1, c)


def rosa_top(wave):
    """Rosa, retired florist, laid-back: grey bun with a pink flower, green cardigan open over a cream blouse,
    a brown skirt, and a posy of flowers in her left hand."""
    def top(g, b):
        g.rect(10, 33 + b, 12, 5, "brown")
        g.rect(19, 33 + b, 3, 5, "dbrown")
        torso(g, b, "green", "dgreen")
        g.rect(14, 21 + b, 4, 12, "cream")
        g.rect(15, 24 + b, 1, 1, "tan")
        g.rect(15, 28 + b, 1, 1, "tan")
        arms(g, b, wave, "green", "dgreen", "skin1")
        # the posy: green stems from the fist, three blooms on top
        g.rect(6, 27 + b, 1, 4, "dgreen")
        g.rect(7, 26 + b, 1, 5, "dgreen")
        for x, y, c in ((4, 24, "pink"), (7, 23, "red"), (5, 21, "yellow")):
            g.rect(x, y + b, 3, 3, c)
            g.p(x + 1, y + 1 + b, "amber" if c != "yellow" else "orange")
        head(g, b, "skin1", "skin2")
        g.ell(16, 7.5 + b, 9, 4.5, "lgrey", "grey", "white")
        g.ell(16, 2.5 + b, 4, 2.5, "lgrey", "grey", "white")
        g.rect(8, 9 + b, 2, 6, "lgrey")
        g.rect(22, 9 + b, 2, 6, "grey")
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            g.p(22 + dx, 3 + dy + b, "pink")
        g.p(22, 3 + b, "yellow")
        face_front(g, 16, 13 + b)
        cheeks(g, b)
    return top


def kevin_top(wave):
    """Kevin, pet influencer, dramatic: tall blond quiff, sunglasses pushed up, pink tee, ripped jeans and his
    phone held up in the left hand."""
    def top(g, b):
        torso(g, b, "pink", "mauve")
        # a white "like" heart on the chest
        for x, y in ((13, 24), (15, 24), (12, 25), (13, 25), (14, 25), (15, 25), (16, 25), (13, 26), (14, 26),
                     (15, 26), (14, 27)):
            g.p(x, y + b, "white")
        arms(g, b, wave, "pink", "mauve", "skin2", short=True)
        # the phone, screen out, in the left fist
        g.rect(4, 26 + b, 5, 7, "ink")
        g.rect(5, 27 + b, 3, 4, "sky")
        g.p(5, 27 + b, "cyan")
        g.rect(5, 31 + b, 4, 2, "skin2")
        head(g, b, "skin2", "brown")
        g.ell(16, 7.5 + b, 9, 4.5, "amber", "orange", "yellow")
        g.ell(18, 3.5 + b, 6, 3.5, "amber", "orange", "yellow")
        g.ell(21, 1.5 + b, 3, 1.5, "yellow", "amber")
        g.rect(9, 9 + b, 6, 2, "ink")
        g.rect(17, 9 + b, 6, 2, "ink")
        g.rect(15, 9 + b, 2, 1, "ink")
        g.p(10, 9 + b, "slate")
        g.p(18, 9 + b, "slate")
        face_front(g, 16, 13 + b)
        cheeks(g, b, "mauve")
    return top


def kevin_legs(g, b):
    """Rips across the knees of Kevin's jeans."""
    g.rect(12, 38 + b, 2, 1, "skin2")
    g.rect(18, 39 + b, 2, 1, "skin2")


def pruitt_top(wave):
    """Mr. Pruitt, retired accountant, fussy: bald with grey sides, round glasses, a brown jacket over a white
    shirt and red bow tie, grey trousers and his briefcase."""
    def top(g, b):
        torso(g, b, "brown", "dbrown")
        g.tri((13, 21 + b), (19, 21 + b), (16, 28 + b), "white")
        g.tri((13, 21 + b), (15, 22 + b), (13, 24 + b), "red")
        g.tri((19, 21 + b), (17, 22 + b), (19, 24 + b), "red")
        g.rect(15, 22 + b, 2, 1, "dred")
        g.rect(15, 29 + b, 2, 1, "amber")
        g.rect(15, 31 + b, 2, 1, "amber")
        arms(g, b, wave, "brown", "dbrown", "skin1")
        # the briefcase, hanging from the left fist
        g.rect(2, 33 + b, 9, 7, "dbrown")
        g.rect(2, 33 + b, 9, 1, "brown")
        g.rect(2, 36 + b, 9, 1, "plum")
        g.rect(6, 35 + b, 2, 2, "amber")
        g.rect(5, 31 + b, 4, 3, "skin1")
        head(g, b, "skin1", "skin2")
        g.p(13, 6 + b, "cream")
        g.p(14, 6 + b, "cream")
        g.p(12, 7 + b, "cream")
        g.ell(8.5, 12 + b, 2, 4, "lgrey", "grey")
        g.ell(23.5, 12 + b, 2, 4, "lgrey", "grey")
        face_front(g, 16, 13 + b)
        specs(g, b, "slate")
    return top


def lefevre_top(wave):
    """Madame Lefevre, dog-show judge, fussy: tall dark updo, amber earrings, red lips, a purple blazer over
    a white blouse and pearls, a pencil skirt, and a blue first-prize rosette in her left hand."""
    def top(g, b):
        g.rect(10, 33 + b, 12, 6, "purple")
        g.rect(19, 33 + b, 3, 6, "plum")
        torso(g, b, "purple", "plum")
        g.tri((13, 21 + b), (19, 21 + b), (16, 27 + b), "white")
        for x in range(12, 21, 2):
            g.p(x, 21 + b, "white")
        g.rect(15, 29 + b, 2, 1, "amber")
        arms(g, b, wave, "purple", "plum", "skin1")
        # the rosette: blue petals round an amber button, two ribbon tails below the fist
        g.ell(6.5, 27 + b, 3, 3, "blue", "navy", "sky")
        g.rect(6, 26 + b, 2, 2, "amber")
        g.rect(4, 31 + b, 2, 5, "blue")
        g.rect(8, 31 + b, 2, 4, "sky")
        g.rect(5, 31 + b, 4, 3, "skin1")
        head(g, b, "skin1", "skin2")
        g.ell(16, 7.5 + b, 9, 4.5, "navy", "ink", "dslate")
        g.ell(16, 2.5 + b, 5, 2.5, "navy", "ink", "dslate")
        g.rect(8, 9 + b, 2, 8, "navy")
        g.rect(22, 9 + b, 2, 8, "navy")
        g.p(7, 17 + b, "amber")
        g.p(24, 17 + b, "amber")
        face_front(g, 16, 13 + b, lips="red")
        g.p(10, 12 + b, "ink")
        g.p(22, 12 + b, "ink")
    return top


def sam_top(wave):
    """Sam, barista, laid-back: green beanie, black beard, a cream shirt under a brown apron, and a coffee
    cup in his left hand."""
    def top(g, b):
        torso(g, b, "cream", "tan")
        g.rect(11, 24 + b, 10, 13, "brown")
        g.rect(19, 24 + b, 2, 13, "dbrown")
        g.rect(11, 21 + b, 1, 3, "brown")
        g.rect(20, 21 + b, 1, 3, "brown")
        g.rect(13, 29 + b, 5, 3, "dbrown")
        arms(g, b, wave, "cream", "tan", "dbrown", short=True)
        # the takeaway cup: white with a brown sleeve and a lid
        g.rect(4, 26 + b, 5, 7, "white")
        g.rect(4, 25 + b, 5, 1, "lgrey")
        g.rect(4, 28 + b, 5, 2, "brown")
        g.rect(8, 26 + b, 1, 7, "lgrey")
        g.rect(5, 31 + b, 4, 2, "dbrown")
        head(g, b, "dbrown", "plum")
        g.ell(16, 18.5 + b, 6, 2.5, "ink")
        g.rect(8, 13 + b, 2, 5, "ink")
        g.rect(22, 13 + b, 2, 5, "ink")
        g.ell(16, 7 + b, 9, 4.5, "dgreen", "forest", "green")
        g.rect(7, 9 + b, 18, 2, "forest")
        g.ell(16, 1.5 + b, 2, 1.5, "green")
        face_front(g, 16, 13 + b, lips="cream")
        g.rect(13, 16 + b, 6, 1, "ink")
    return top


def ophelia_top(wave):
    """Ophelia, stage actor, dramatic: big copper curls, lashes, a long mauve gown with a pink scarf, and a
    prop skull held out in her left hand."""
    def top(g, b):
        for cx, cy in ((7, 10), (25, 10), (6, 16), (26, 16), (7, 21), (25, 21), (11, 4), (21, 4), (16, 3)):
            g.ell(cx, cy + b, 3.5, 3.5, "rust", "dbrown", "orange")
        # the gown flares to the ankles, over the legs
        g.rect(9, 33 + b, 14, 8 - b, "mauve")
        g.rect(8, 37, 16, 4, "mauve")
        g.rect(20, 33 + b, 4, 8 - b, "purple")
        torso(g, b, "mauve", "purple")
        g.ell(16, 21.5 + b, 6, 2, "pink", "mauve")
        g.rect(18, 22 + b, 3, 8, "pink")
        g.rect(20, 23 + b, 1, 7, "mauve")
        arms(g, b, wave, "mauve", "purple", "skin1")
        # the skull, on her palm
        g.ell(6.5, 28 + b, 3, 3, "white", "lgrey")
        g.rect(5, 28 + b, 1, 1, "ink")
        g.rect(7, 28 + b, 1, 1, "ink")
        g.rect(5, 30 + b, 4, 1, "lgrey")
        head(g, b, "skin1", "skin2")
        g.ell(16, 7.5 + b, 8.5, 4, "rust", "dbrown", "orange")
        g.ell(12, 9 + b, 3, 2, "orange")
        face_front(g, 16, 13 + b)
        g.p(10, 12 + b, "ink")
        g.p(22, 12 + b, "ink")
        cheeks(g, b)
    return top


def tiffany_top(wave):
    """Tiffany, wedding planner, dramatic: blond high ponytail with a pink bow, headset mic, a white blouse
    with a pink placket, a pink skirt, and her clipboard with a heart on it."""
    def top(g, b):
        g.ell(25, 6 + b, 3, 6, "yellow", "amber")
        g.rect(10, 33 + b, 12, 5, "pink")
        g.rect(19, 33 + b, 3, 5, "mauve")
        torso(g, b, "white", "lgrey")
        g.rect(15, 21 + b, 2, 12, "pink")
        arms(g, b, wave, "white", "lgrey", "skin1")
        # the clipboard: a brown board, a cream sheet with a red heart, a slate clip
        g.rect(2, 24 + b, 7, 10, "brown")
        g.rect(3, 26 + b, 5, 7, "cream")
        g.rect(4, 23 + b, 3, 2, "slate")
        g.rect(4, 28 + b, 3, 2, "red")
        g.p(5, 30 + b, "red")
        g.rect(5, 31 + b, 4, 3, "skin1")
        head(g, b, "skin1", "skin2")
        g.ell(16, 7.5 + b, 9, 4.5, "yellow", "amber", "white")
        g.ell(22, 3 + b, 2.5, 2, "pink", "mauve")
        g.rect(7, 10 + b, 2, 7, "ink")
        g.rect(8, 17 + b, 1, 1, "ink")
        g.rect(9, 18 + b, 4, 1, "slate")
        g.p(13, 18 + b, "ink")
        face_front(g, 16, 13 + b)
        g.p(10, 12 + b, "ink")
        g.p(22, 12 + b, "ink")
        cheeks(g, b)
    return top


def hughes_top(wave):
    """Dr. Hughes, dentist, fussy: short dark hair, a head mirror, a white coat open over sky-blue scrubs,
    and a giant toothbrush in his left hand."""
    def top(g, b):
        torso(g, b, "white", "lgrey")
        g.rect(14, 21 + b, 4, 12, "sky")
        g.rect(13, 21 + b, 1, 12, "lgrey")
        g.rect(18, 21 + b, 1, 12, "lgrey")
        g.rect(19, 26 + b, 3, 1, "lgrey")
        arms(g, b, wave, "white", "lgrey", "dbrown")
        # the toothbrush: a long sky-blue handle from the fist up to white bristles
        g.rect(6, 21 + b, 2, 13, "sky")
        g.rect(7, 21 + b, 1, 13, "blue")
        g.rect(3, 17 + b, 4, 4, "white")
        g.rect(3, 20 + b, 4, 1, "lgrey")
        g.rect(4, 17 + b, 1, 3, "lgrey")
        g.rect(5, 31 + b, 4, 2, "dbrown")
        head(g, b, "dbrown", "plum")
        g.ell(16, 7.5 + b, 8.5, 4, "ink", "ink", "navy")
        g.rect(8, 9 + b, 16, 1, "slate")
        g.ell(16, 8 + b, 3, 3, "lgrey", "grey", "white")
        g.ell(16, 8 + b, 1.2, 1.2, "slate")
        face_front(g, 16, 13 + b, lips="ink")
    return top


def jesse_top(wave):
    """Jesse, trail runner, laid-back: short brown hair, a sky-blue headband, an orange running top with a
    race bib, navy shorts, and a water bottle in the left hand."""
    def top(g, b):
        g.rect(10, 33 + b, 12, 4, "navy")
        g.rect(16, 35 + b, 1, 2, "ink")
        torso(g, b, "orange", "rust")
        g.rect(12, 24 + b, 7, 5, "white")
        g.rect(15, 25 + b, 1, 3, "ink")
        g.p(14, 26 + b, "ink")
        arms(g, b, wave, "orange", "rust", "skin2", short=True)
        # the water bottle, cap up, in the left fist
        g.rect(5, 25 + b, 4, 8, "sky")
        g.rect(5, 25 + b, 1, 8, "cyan")
        g.rect(6, 23 + b, 2, 2, "white")
        g.rect(5, 31 + b, 4, 2, "skin2")
        head(g, b, "skin2", "brown")
        g.ell(16, 7.5 + b, 9, 4.5, "dbrown", "plum", "brown")
        g.rect(8, 9 + b, 16, 2, "sky")
        g.rect(8, 10 + b, 16, 1, "blue")
        g.p(23, 8 + b, "cyan")
        face_front(g, 16, 13 + b)
        cheeks(g, b, "brown")
    return top


# dog: (top, legs, shoes, extra), in owners.OWNERS order; extra draws over the legs after them
OWNERS = {
    "duchess": (rosa_top, "skin1", "dbrown", None),
    "nugget": (kevin_top, "blue", "white", kevin_legs),
    "zippy": (pruitt_top, "slate", "ink", None),
    "pierre": (lefevre_top, "skin1", "ink", None),
    "biscuit": (sam_top, "navy", "dbrown", None),
    "dash": (ophelia_top, "skin1", "plum", None),
    "snowball": (tiffany_top, "skin1", "pink", None),
    "waffles": (hughes_top, "sky", "white", None),
    "koda": (jesse_top, "skin2", "sky", None),
}


def owner(dog, wave=None, bob=0):
    """One owner standing, with the road outline and the lit rim."""
    top, legs, shoes, extra = OWNERS[dog]
    g = edged(person(top(wave), legs=legs, shoes=shoes, bob=bob))
    if extra:
        extra(g, bob)
    return rim(g, LIT)


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    for dog in OWNERS:
        yield f"owner-{dog}", [("idle", [owner(dog, bob=bb).outlined() for bb in BREATH], BREATH_MS),
                               ("wave", [owner(dog, w).outlined() for w in WAVES], WAVE_MS)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/people", __doc__, anchored=road_sprite)
