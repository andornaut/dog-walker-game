#!/usr/bin/env python3
"""Draw the owners' and walkers' faces and build their Aseprite sources and exports.

face-owner-<dog>: 32x32, chibi, front view, in Endesga 32 with an ink outer line closed under the
bust, cel shaded, the face flat with a 1px shadow down its near edge. Tags: happy, neutral, upset,
fired (angry, shown as the owner fires you) and worried (at 1 heart, while their dog's card pulses).
Each owner's job shows in their hair and accessories, and their temperament in how far the
expressions go.

face-owner-<dog>-20: 20x20, the same owner and tags for the walk's dog card. The hair, clothes and props
are the 32x32 drawing rasterized at 20x20 by minis.Mini, with its own ink line; the expression is drawn
natively at 20x20, one pixel per feature, and Tara's bun, Aunt Judy's ponytail, Gadget's collar points and
Clare's fringe shade are redrawn by hand.

face-walker-<name>: 32x32 portraits for the walker picker. Tags: happy, neutral.

Usage:
  owners.py preview OUT.png   contact sheet of every frame, scaled up
  owners.py build             write art/owners/*.aseprite, then export
                              public/art/sprites/*.png and *.json with Aseprite

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import minis  # noqa: E402
from pixel import Grid, edged, hairline, main  # noqa: E402
from road import face_disc  # noqa: E402

MOODS = ["happy", "neutral", "upset", "fired", "worried"]


def face():
    """A 32x32 face: one ink line round every fill, closed under the bust where the frame cuts it."""
    return edged(Grid(), "ink", close=True)


def base(g, skin, shade, shirt, shirt_sh):
    g.rect(8, 27, 16, 1, shirt)
    g.rect(6, 28, 20, 3, shirt)
    g.rect(21, 28, 5, 3, shirt_sh)
    g.rect(13, 24, 6, 4, shade)
    g.cel(7.5, 17, 1.5, 2, skin, shade)
    g.cel(24.5, 17, 1.5, 2, skin, shade)
    # the face stays clean: flat skin, a 1px shadow down its near (right) edge beside the eyes
    face_disc(g, 16, 16, 8.5, 9, skin, shade, to=0.25)


def expression(g, mood, feat="dbrown", blush="pink", lashes=False, wide=False, brow=None, whites=False, glasses=None,
               lips=None, nose=None):
    """Eyes, brows and mouth. wide marks the dramatic owners, whose faces go further. brow is the brows'
    colour (feat unless given). whites sets a white beside each pupil, so the eyes read on dark skin.
    Happy closes the eyes into smiling arcs under raised flat brows; neutral is open eyes under flat brows;
    upset slants the brows down to the middle over a frown, angry and sad; fired narrows the eyes under brows
    pinched down hard; worried lifts the brows' inner ends over eyes gone wide, white either side of the
    pupil, with a small wobbly mouth and a big sweat bead. glasses frames each eye in that colour, lips
    paints the closed mouth's middle (not while firing) and nose, a skin shade, puts a nose pixel between
    the eyes, as the walkers' sprites and portraits have."""
    brow = brow or feat
    for x in (12, 19):
        if mood == "happy":
            arc = feat if whites else "ink"
            g.p(x - 1, 18, arc)
            g.p(x, 17, arc)
            g.p(x + 1, 18, arc)
        elif mood == "fired":
            if whites:
                g.rect(x - 1, 18, 1, 1, "white")
            g.rect(x, 18, 1, 1, "ink")
        elif mood == "worried":
            # wide eyes: a 3x3 white with the pupil low in its middle
            g.rect(x - 1, 16, 3, 3, "white")
            g.rect(x, 17, 1, 2, "ink")
        else:
            if whites:
                g.rect(x - 1, 17, 1, 2, "white")
            g.rect(x, 17, 1, 2, "ink")
        if lashes:
            g.p(x - 1 if x == 12 else x + 1, 16, "ink")
    brows = {
        # raised and flat, so they never echo the eyes' smiling arcs
        "happy": ((11, 13), (12, 13), (13, 13), (18, 13), (19, 13), (20, 13)),
        "neutral": ((11, 15), (12, 15), (13, 15), (18, 15), (19, 15), (20, 15)),
        "upset": ((11, 14), (12, 14), (13, 15), (18, 15), (19, 14), (20, 14)),
        "fired": ((11, 13), (12, 14), (13, 15), (18, 15), (19, 14), (20, 13)),
        # the inner ends lifted, so the brows tilt up to the middle
        "worried": ((10, 15), (11, 15), (12, 14), (13, 13), (18, 13), (19, 14), (20, 15), (21, 15)),
    }[mood]
    for x, y in brows:
        g.p(x, y, brow)
    if mood == "happy":
        # a wide grin showing teeth, under rosy cheeks
        for x in (10, 11, 20, 21):
            g.p(x, 21, blush)
        g.p(13, 21, feat)
        g.p(18, 21, feat)
        g.p(14, 22, feat)
        g.rect(15, 22, 2, 1, "white")
        g.p(17, 22, feat)
        g.rect(15, 23, 2, 1, feat)
        if wide:
            g.rect(14, 22, 4, 1, "white")
            g.p(13, 22, feat)
            g.p(18, 22, feat)
            g.rect(14, 23, 4, 1, feat)
    elif mood == "neutral":
        g.rect(14, 22, 4, 1, feat)
    elif mood == "upset":
        # a frown turned down at both corners
        g.rect(14, 22, 4, 1, feat)
        g.p(13, 23, feat)
        g.p(18, 23, feat)
        # a tear on the dramatic owners
        if wide:
            g.p(10, 19, "cyan")
            g.p(10, 20, "sky")
    elif mood == "worried":
        # a small wobbly mouth, and a big bead of sweat on the left temple
        for x, y in ((14, 23), (15, 22), (16, 23), (17, 22)):
            g.p(x, y, feat)
        g.p(9, 12, "white")
        g.rect(8, 13, 2, 1, "cyan")
        g.p(8, 14, "white")
        g.p(9, 14, "cyan")
        g.rect(8, 15, 2, 1, "sky")
        if wide:
            g.p(22, 13, "cyan")
            g.p(22, 14, "sky")
    else:
        # fired: mouth open mid-shout, red cheeks
        g.rect(14, 21, 4, 3, feat)
        g.rect(15, 22, 2, 2, "dred")
        g.rect(10, 20, 2, 1, "red")
        g.rect(20, 20, 2, 1, "red")
    if nose:
        g.p(16, 20, nose)
    if glasses:
        # clear frames: a box with its corners cut round each eye, skin showing through, and a bridge
        for cx in (12, 19):
            g.rect(cx - 1, 16, 3, 1, glasses)
            g.rect(cx - 1, 20, 3, 1, glasses)
            g.rect(cx - 2, 17, 1, 3, glasses)
            g.rect(cx + 2, 17, 1, 3, glasses)
        g.rect(15, 18, 2, 1, glasses)
    if lips and mood != "fired":
        g.rect(15, 23, 2, 1, lips)


def eve(mood):
    """Social media influencer, dramatic: long blonde hair past the shoulders with a swept fringe, gold hoop
    earrings, a bright pink puffer jacket over a white top."""
    g = face()
    # the hair behind the face, down past the jaw
    g.cel(16, 14, 10, 9, "yellow", "amber")
    g.rect(6, 14, 20, 12, "yellow")
    g.rect(22, 14, 4, 12, "amber")
    base(g, "skin1", "skin2", "pink", "mauve")
    # the puffer's quilting, and the white top at the open front
    g.rect(6, 29, 20, 1, "mauve")
    g.rect(21, 29, 5, 1, "purple")
    g.rect(15, 27, 2, 4, "white")
    # the ends falling over the shoulders onto the puffer
    g.rect(6, 20, 3, 10, "yellow")
    g.rect(23, 20, 3, 10, "amber")
    g.p(8, 29, None)
    g.p(23, 29, None)
    # the fringe swept across the forehead, its lit edge on the left
    g.cel(16, 10, 9, 4.5, "yellow", "amber", "white")
    g.cel(11.5, 11, 3.5, 2, "yellow", "amber", "white")
    g.rect(7, 19, 1, 2, "orange")
    g.rect(24, 19, 1, 2, "orange")
    expression(g, mood, lashes=True, wide=True)
    return g


def ryan(mood):
    """Site engineer, dramatic: a blond forelock under a white hard hat, a yellow hi-vis vest with silver
    stripes over a blue work shirt."""
    g = face()
    base(g, "skin2", "brown", "blue", "navy")
    # the work shirt's collar, then the vest's two panels either side of the open front
    g.tri((12, 26), (16, 27), (13, 29), "sky")
    g.tri((20, 26), (16, 27), (19, 29), "sky")
    g.rect(6, 28, 7, 3, "yellow")
    g.rect(19, 28, 7, 3, "amber")
    g.rect(8, 27, 4, 1, "yellow")
    g.rect(20, 27, 4, 1, "amber")
    g.rect(6, 30, 7, 1, "lgrey")
    g.rect(19, 30, 7, 1, "grey")
    # blond hair at the temples, under the brim
    g.rect(8, 11, 2, 6, "amber")
    g.rect(22, 11, 2, 6, "orange")
    # the hard hat: a white dome with a ridge down the middle over a full brim
    g.cel(16, 7, 8.5, 5.5, "white", "lgrey")
    g.rect(15, 2, 2, 7, "lgrey")
    g.rect(5, 10, 22, 2, "white")
    g.rect(17, 11, 10, 1, "lgrey")
    # the forelock, swept out from under the brim above the left brow
    g.rect(9, 12, 6, 1, "amber")
    g.rect(10, 12, 2, 1, "yellow")
    expression(g, mood, wide=True)
    return g


def ralph(mood):
    """Retired pilot, fussy: big and gruff, broad shoulders and a strong stubbled jaw, greying sandy-blonde hair
    pulled back tight into a low ponytail behind his right shoulder, heavy brown brows, a dark leather flight
    jacket with a cream fleece collar over a white shirt, and gold wings pinned on the chest."""
    g = face()
    # the ponytail behind the head, hanging from the nape down behind the right shoulder, with a dbrown tie
    for x, y, r, c in ((8, 20.5, 1.8, "tan"), (6.8, 23, 1.7, "tan"), (5.6, 25.5, 1.4, "tan"),
                       (4.8, 27.5, 1, "brown")):
        g.ell(x, y, r, r + 0.3, c)
    if not isinstance(g, minis.Mini):
        # grey strands through the tail, left out at 20px, where they break it into specks
        g.p(6, 23, "lgrey")
        g.p(5, 25, "lgrey")
    g.rect(7, 20, 3, 1, "dbrown")
    base(g, "skin1", "skin2", "dbrown", "plum")
    # the strong jaw, squared off under the face, and the neck thick under it
    g.rect(12, 24, 8, 3, "skin2")
    g.blob(16, 21, 7, 4.5, "skin1", power=3)
    # stubble shading the jaw and chin
    g.rect(12, 25, 8, 1, "skin2")
    g.p(10, 24, "skin2")
    g.p(21, 24, "skin2")
    # the broad shoulders of the big build, out past the other owners' busts
    g.rect(6, 27, 20, 1, "dbrown")
    g.rect(4, 28, 24, 3, "dbrown")
    g.rect(21, 27, 7, 4, "plum")
    # the white shirt, open at the neck between the fleece collar's points, cream in the light, tan in the shade
    g.tri((13, 26), (19, 26), (16, 31), "white")
    g.tri((7, 26), (13, 26), (12, 30), "cream")
    g.tri((25, 26), (19, 26), (20, 30), "tan")
    # gold wings pinned on the right of the chest
    g.rect(21, 29, 5, 1, "amber")
    g.p(23, 29, "yellow")
    g.p(23, 30, "amber")
    # the hair pulled back tight over the crown and temples: sandy tan lit cream and shaded brown, off a
    # receding hairline, gone grey at the temples, with a lgrey streak combed back through it
    g.cel(16, 10.5, 9, 5, "tan", "brown", "cream")
    g.rect(11, 7, 1, 2, "cream")
    g.rect(18, 6, 2, 1, "cream")
    g.ell(16, 14.5, 6.5, 3.5, "skin1")
    g.rect(8, 11, 2, 4, "lgrey")
    g.rect(22, 11, 2, 4, "grey")
    g.rect(13, 7, 1, 3, "lgrey")
    g.rect(14, 6, 2, 1, "lgrey")
    # the hairline a shade darker, so the sandy hair stands apart from the fair forehead
    hairline(g, "tan", "skin1", "brown")
    # the brows a step darker at 20px, where they are one pixel deep
    expression(g, mood, brow="dbrown" if isinstance(g, minis.Mini) else "brown")
    if not isinstance(g, minis.Mini):
        # heavy brows: each brow pixel doubled upward
        brows = [(x, y) for y in range(12, 17) for x in range(9, 23) if g.px[y][x] == minis.K["brown"]]
        for x, y in brows:
            g.p(x, y - 1, "brown")
    # a big nose and a cleft chin
    g.rect(15, 19, 2, 1, "skin2")
    g.p(16, 24, "skin2")
    return g


def tara(mood):
    """Dog-show judge, fussy: tall dark updo, pearls, red lips, purple blazer."""
    g = face()
    base(g, "skin1", "skin2", "purple", "plum")
    g.tri((13, 27), (19, 27), (16, 31), "white")
    for x in range(11, 22, 2):
        g.p(x, 27, "white")
    g.cel(16, 10, 9, 5, "navy", "ink", "dslate")
    g.cel(16, 3.5, 5, 3.5, "navy", "ink", "dslate")
    g.rect(8, 10, 2, 8, "navy")
    g.rect(22, 10, 2, 8, "navy")
    # amber drop earrings, two pixels long so they show, as on her figure
    g.rect(7, 19, 1, 2, "amber")
    g.rect(24, 19, 1, 2, "amber")
    expression(g, mood, feat="dred", lashes=True, lips="red", brow="ink")
    return g


def clare(mood):
    """Psychology student, laid-back: brown hair to the shoulders with a side-swept fringe and a pink clip, a
    cosy green knit sweater with a white collar."""
    g = face()
    # the hair falling behind the face to the shoulders
    g.cel(16, 14, 10, 10, "dbrown", "plum", "brown")
    g.rect(6, 14, 20, 10, "dbrown")
    g.rect(22, 14, 4, 10, "plum")
    base(g, "brown", "dbrown", "green", "dgreen")
    # the knit: a ribbed crew neck and two cables down the front, either side of a white collar
    g.rect(11, 27, 10, 1, "dgreen")
    for x in (11, 20):
        for y in (28, 30):
            g.p(x, y, "dgreen")
        g.p(x + 1, 29, "dgreen")
    g.tri((13, 26), (16, 26), (15, 28), "white")
    g.tri((16, 26), (19, 26), (17, 28), "white")
    # the crown, and the fringe swept across the forehead to the left
    g.cel(16, 10, 9, 4.5, "dbrown", "plum", "brown")
    g.cel(12, 11, 4, 2.2, "dbrown", "plum", "brown")
    # the locks either side of the face, a shade darker, so the face stands out from the hair
    g.rect(8, 11, 2, 8, "plum")
    g.rect(22, 11, 2, 8, "plum")
    for x, y, h in ((11, 7, 2), (15, 6, 2)):
        g.rect(x, y, 1, h, "brown")
    # the pink clip above her right temple
    g.rect(20, 9, 3, 1, "pink")
    g.p(21, 10, "mauve")
    expression(g, mood, feat="ink", blush="rust", lashes=True, whites=True)
    return g


def kiwi(mood):
    """Grandmother, laid-back: a cloud of short white curls, a blue cardigan lit sky on its left, over a white
    collar, a kiwi-slice brooch."""
    g = face()
    # the perm: round curls from ear to ear over the crown, each lit white and shaded lgrey
    for cx, cy in ((7.5, 15.5), (24.5, 15.5), (7.5, 11), (24.5, 11), (9.5, 7), (22.5, 7), (13, 4.5), (19, 4.5),
                   (16, 4)):
        g.cel(cx, cy, 2.6, 2.6, "white", "lgrey")
    base(g, "brown", "dbrown", "blue", "navy")
    g.rect(6, 28, 2, 3, "sky")
    g.p(8, 27, "sky")
    g.tri((12, 26), (16, 26), (14, 29), "white")
    g.tri((16, 26), (20, 26), (18, 29), "white")
    g.rect(16, 29, 1, 2, "navy")
    g.rect(10, 28, 3, 2, "green")
    g.p(11, 28, "yellow")
    # the fringe: a row of tight curls across the forehead
    g.cel(16, 8.5, 7.5, 3, "white", "lgrey")
    for cx in (10, 13.5, 17, 20.5, 23):
        g.cel(cx, 10.5, 2, 1.8, "white", "lgrey")
    expression(g, mood, feat="ink", blush="rust", whites=True)
    return g


def aunt_judy(mood):
    """Tennis star, dramatic: older and fit, a silver high ponytail, a cyan visor, a sleeveless white tennis
    dress with a cyan V neck."""
    g = face()
    # the high ponytail behind the head, swinging out to the right
    g.cel(25, 9, 3, 6, "lgrey", "grey", "white")
    base(g, "skin1", "skin2", "white", "lgrey")
    # bare shoulders either side of the sleeveless dress, and its cyan V neck
    g.rect(6, 28, 2, 3, "skin1")
    g.rect(24, 28, 2, 3, "skin2")
    g.rect(8, 28, 1, 3, "cyan")
    g.rect(23, 28, 1, 3, "cyan")
    for x, y in ((11, 27), (12, 28), (13, 29), (14, 30), (17, 30), (18, 29), (19, 28), (20, 27)):
        g.p(x, y, "cyan")
    g.rect(13, 27, 6, 2, "skin1")
    g.rect(14, 29, 4, 1, "skin1")
    g.rect(15, 30, 2, 1, "skin1")
    g.cel(16, 10, 9, 4.5, "lgrey", "grey", "white")
    g.rect(8, 11, 2, 5, "lgrey")
    g.rect(22, 11, 2, 5, "grey")
    # the visor: a band over the hair and the bill jutting out past it, shaded underneath
    g.rect(7, 9, 18, 1, "cyan")
    g.rect(6, 10, 20, 1, "cyan")
    g.rect(10, 10, 6, 1, "white")
    g.rect(8, 11, 16, 1, "sky")
    expression(g, mood, lashes=True, wide=True)
    return g


def gadget(mood):
    """Inspector, fussy: black hair under a brown brimmed hat, a tan trench coat with its collar turned up
    over a white shirt and a red tie."""
    g = face()
    base(g, "skin1", "skin2", "tan", "brown")
    g.tri((13, 27), (19, 27), (16, 31), "white")
    g.rect(15, 28, 2, 3, "dred")
    # the trench coat's collar, turned up either side of the neck
    g.tri((8, 23), (13, 28), (10, 31), "cream")
    g.tri((24, 23), (19, 28), (22, 31), "tan")
    # short black hair at the temples, under the brim
    g.rect(8, 11, 2, 6, "navy")
    g.rect(22, 11, 2, 6, "ink")
    g.rect(9, 11, 14, 1, "navy")
    # the hat: a pinched crown with a dred band over a wide brim
    g.cel(16, 5.5, 6.5, 4.5, "brown", "dbrown", "tan")
    g.rect(14, 1, 4, 1, "dbrown")
    g.p(16, 2, "dbrown")
    g.rect(10, 8, 12, 1, "dred")
    g.rect(5, 9, 22, 2, "brown")
    g.rect(4, 10, 2, 1, "brown")
    g.rect(26, 10, 2, 1, "dbrown")
    g.rect(16, 10, 10, 1, "dbrown")
    g.rect(6, 9, 4, 1, "tan")
    expression(g, mood)
    return g


def jason(mood):
    """Lawn care pro, laid-back: short brown hair under an orange baseball cap with a moss leaf on its front, an
    olive work polo with a moss collar, its placket open at the neck, and an orange logo on the chest."""
    g = face()
    base(g, "skin2", "brown", "olive", "dolive")
    # the polo's collar points either side of the placket, and the logo on the left of the chest
    g.tri((11, 26), (16, 27), (13, 29), "moss")
    g.tri((21, 26), (16, 27), (19, 29), "moss")
    g.rect(16, 28, 1, 3, "dolive")
    g.rect(20, 29, 3, 1, "orange")
    # short hair at the temples and over the ears, under the cap; at 20px one pixel each side, clear of the brows
    if isinstance(g, minis.Mini):
        g.rect(6, 12, 2, 5, "dbrown")
        g.rect(24, 12, 2, 5, "plum")
    else:
        g.rect(7, 12, 3, 5, "dbrown")
        g.rect(22, 12, 3, 5, "plum")
        g.rect(7, 12, 1, 3, "brown")
    # the cap: a low crown hugging the head, a button on top, a seam either side and a moss leaf on its front
    # panel, over a flat bill, a darker band across the brow that juts out past the head to his right
    g.cel(16, 10.5, 8.5, 4.5, "orange", "rust", "amber")
    g.rect(15, 6, 2, 1, "rust")
    g.p(11, 8, "rust")
    g.p(21, 8, "rust")
    g.rect(15, 8, 2, 2, "moss")
    g.p(16, 8, "olive")
    g.rect(4, 11, 20, 1, "ochre")
    g.rect(2, 12, 22, 1, "rust")
    expression(g, mood)
    return g


# ---------- the owners' small faces, for the walk's dog cards ----------

SMALL = 20


def small_expression(g, mood, feat="dbrown", blush="pink", lashes=False, wide=False, brow=None, whites=False,
                     glasses=None, lips=None):
    """expression drawn at 20x20 on a Mini's own pixels, one feature per pixel: eyes at x 7 and 12 on rows 10
    and 11, brows on row 9 (raised to 8), the mouth on rows 13 and 14. Lashes are left out at this size."""
    p = g.g.p
    brow = brow or feat
    for x, out in ((7, -1), (12, 1)):
        if mood == "happy":
            arc = feat if whites else "ink"
            p(x - 1, 11, arc)
            p(x, 10, arc)
            p(x + 1, 11, arc)
        elif mood == "fired":
            if whites:
                p(x + out, 11, "white")
            p(x, 11, "ink")
        elif mood == "worried":
            p(x - out, 10, "white")
            p(x - out, 11, "white")
            p(x, 10, "white")
            p(x, 11, "ink")
        else:
            if whites:
                p(x + out, 10, "white")
                p(x + out, 11, "white")
            p(x, 10, "ink")
            p(x, 11, "ink")
    brows = {
        "happy": ((6, 8), (7, 8), (12, 8), (13, 8)),
        "neutral": ((6, 9), (7, 9), (12, 9), (13, 9)),
        "upset": ((6, 8), (7, 9), (12, 9), (13, 8)),
        "fired": ((6, 8), (7, 9), (8, 9), (11, 9), (12, 9), (13, 8)),
        "worried": ((6, 9), (7, 8), (12, 8), (13, 9)),
    }[mood]
    for x, y in brows:
        p(x, y, brow)
    if glasses:
        # the frames a step lighter than on the large face, so the 1px eyes show inside them
        glasses = {"walnut": "dbrown"}.get(glasses, glasses)
        for x in (7, 12):
            for dx, dy in ((-1, 10), (-1, 11), (1, 10), (1, 11), (0, 12)):
                p(x + dx, dy, glasses)
        p(9, 10, glasses)
        p(10, 10, glasses)
    if mood == "happy":
        p(5, 12, blush)
        p(14, 12, blush)
        p(8, 13, feat)
        p(11, 13, feat)
        p(9, 14, feat)
        p(10, 14, feat)
        if wide:
            p(9, 13, "white")
            p(10, 13, "white")
    elif mood == "neutral":
        p(9, 14, lips or feat)
        p(10, 14, lips or feat)
    elif mood == "upset":
        p(9, 13, lips or feat)
        p(10, 13, lips or feat)
        p(8, 14, feat)
        p(11, 14, feat)
        if wide:
            p(5, 12, "cyan")
    elif mood == "worried":
        p(8, 14, feat)
        p(9, 13, lips or feat)
        p(10, 14, lips or feat)
        p(11, 13, feat)
        p(4, 9, "cyan")
        p(4, 10, "sky")
    else:
        p(9, 13, feat)
        p(10, 13, feat)
        p(9, 14, "dred")
        p(10, 14, "dred")
        p(5, 12, "red")
        p(14, 12, "red")


TARA_SMALL_HAIR = (
    "....................",
    "........dnni........",
    ".......dnnnni.......",
    "........nnni........",
    ".....ddnnnnnnni.....",
    "....dnnnnnnnnnni....",
    "....nnnnnnnnnnni....",
)


def tara_small_bun(g):
    """Her updo's top rows drawn again at 20px: a round bun pinched in above a domed crown, lit dslate on the
    left and shaded ink on the right, where the scaled bun and crown square off into a top hat."""
    colours = {"d": "dslate", "n": "navy", "i": "ink"}
    for y, row in enumerate(TARA_SMALL_HAIR):
        for x, c in enumerate(row):
            g.g.px[y][x] = None
            if c in colours:
                g.g.p(x, y, colours[c])


def clare_small_fringe(g):
    """Her fringe's shade lightened to dbrown at 20px, where the scaled plum crescent becomes a dark band across
    the forehead over the brows; the locks either side of the face keep their plum."""
    px = g.g.px
    for y in range(5, 9):
        for x in range(6, 14):
            if px[y][x] == minis.K["plum"]:
                g.g.p(x, y, "dbrown")


def judy_small_ponytail(g):
    """Her high ponytail redrawn wider at 20px, where it scales to a 1px column: three pixels across from the
    crown down past the visor, lit white on the left and shaded grey on the right."""
    for x, y, c in ((15, 1, "white"), (16, 1, "lgrey"), (14, 2, "white"), (15, 2, "white"), (16, 2, "lgrey"),
                    (17, 2, "grey"), (15, 3, "white"), (16, 3, "lgrey"), (17, 3, "grey")):
        g.g.p(x, y, c)
    for y in range(4, 9):
        g.g.p(16, y, "lgrey")
        g.g.p(17, y, "grey")


def gadget_small_collar(g):
    """His collar's points filled in against the neck at 20px, where the scaled points stop a pixel short and
    leave a gap ringed in ink beside the jaw."""
    g.g.p(6, 15, "cream")
    g.g.p(13, 15, "tan")


# Fixes drawn after the scaled owner, for shapes that do not survive the scale.
SMALL_FIXES = {"biscuit": clare_small_fringe, "penny": gadget_small_collar, "pierre": tara_small_bun,
               "snowball": judy_small_ponytail}


def small(dog, mood):
    """The owner's face at SMALL x SMALL: their drawing's hair, clothes and props scaled by minis.Mini (each
    shape rasterized at the small size, then the small face's own ink line), the expression drawn natively by
    small_expression."""
    global face, expression
    big_face, big_expression = face, expression
    face = lambda: edged(minis.Mini(SMALL / 32), "ink", close=True)  # noqa: E731
    expression = small_expression
    try:
        g = OWNERS[dog](mood)
    finally:
        face, expression = big_face, big_expression
    if dog in SMALL_FIXES:
        SMALL_FIXES[dog](g)
    return g.g


# ---------- the walkers' portraits, for the walker picker ----------

def casey(mood):
    """Casey, the cap-and-hoodie walker."""
    g = face()
    base(g, "skin1", "skin2", "sky", "blue")
    g.ell(16, 28, 4, 2, "blue")
    g.cel(16, 11, 9, 5, "dbrown", "plum", "brown")
    g.cel(16, 7.5, 9, 4.5, "amber", "orange", "yellow")
    g.rect(7, 10, 18, 2, "orange")
    g.rect(15, 5, 2, 2, "orange")
    expression(g, mood, nose="skin2")
    return g


def ada(mood):
    """Ada, 11, mixed race, caramel skin, long black curls falling straight down; yellow tee."""
    g = face()
    # black hair falling in ringlets past the shoulders, their ends bunched into bumps along the edges
    g.cel(16, 13, 10, 9, "navy", "ink", "dslate")
    g.rect(6, 13, 20, 16, "navy")
    g.rect(23, 13, 3, 16, "ink")
    for y in (15, 19, 23, 27):
        g.ell(5.8, y, 1.4, 1.8, "navy")
        g.ell(26.2, y, 1.4, 1.8, "ink")
    # the ringlets in clumps: dslate where the light catches them on the left, navy in the shade on the right
    for y in (17.5, 24):
        g.cel(7.5, y, 1.5, 2.5, "dslate")
        g.cel(24.5, y, 1.5, 2.5, "navy")
    base(g, "brown", "brown", "yellow", "amber")
    g.rect(13, 24, 6, 1, "dbrown")
    g.cel(16, 10, 8.5, 4, "navy", "ink", "dslate")
    g.cel(11.5, 8.5, 2.5, 1.5, "dslate")
    g.cel(22, 7, 2, 1.5, "pink", "mauve")
    expression(g, mood, blush="pink", wide=True, nose="dbrown")
    # big, bright eyes with two highlights
    for x in (11, 18):
        g.rect(x, 15, 3, 4, "ink")
        g.p(x, 15, "white")
        g.p(x + 2, 17, "white")
    return g


def mr_b(mood):
    """Mr. B, 45, Black, bald, an oval face, a beard along the jaw and under the chin, no moustache; lilac tee."""
    g = face()
    # the lilac tee, shaded violet on the right, with a violet collar, as on his road sprite
    g.rect(8, 27, 16, 1, "lilac")
    g.rect(6, 28, 20, 3, "lilac")
    g.rect(21, 28, 5, 3, "violet")
    g.rect(13, 24, 6, 4, "plum")
    g.cel(8.5, 16, 1.2, 1.8, "dbrown", "plum")
    g.cel(23.5, 16, 1.2, 1.8, "dbrown", "plum")
    g.cel(16, 14.5, 7.8, 9.3, "dbrown", "plum", power=2.3)
    g.rect(12, 8, 2, 1, "brown")
    # the chin-strap beard follows the jaw, leaving the upper lip bare
    g.rect(9, 17, 1, 5, "ink")
    g.rect(22, 17, 1, 5, "ink")
    g.ell(16, 22.5, 6, 2.5, "ink")
    g.rect(13, 20, 6, 2, "dbrown")
    g.rect(12, 26, 8, 1, "violet")
    g.rect(11, 27, 1, 1, "violet")
    g.rect(20, 27, 1, 1, "violet")
    expression(g, mood, feat="cream", blush="rust", brow="ink", whites=True, nose="plum")
    return g


def trista(mood):
    """Trista, 50, dirty blonde bob to the shoulders, cute: round glasses, green cardigan, white collar."""
    g = face()
    # light brown hair, darker than her skin, with golden amber streaks
    g.cel(16, 14, 10, 10, "brown", "dbrown", "tan")
    g.rect(6, 14, 20, 9, "brown")
    g.rect(22, 14, 4, 9, "dbrown")
    g.rect(7, 15, 1, 6, "amber")
    base(g, "skin1", "skin2", "dgreen", "forest")
    g.tri((12, 26), (16, 26), (14, 29), "white")
    g.tri((16, 26), (20, 26), (18, 29), "white")
    g.cel(16, 10, 9, 4.5, "brown", "dbrown", "tan")
    g.cel(11, 11, 3, 2, "brown", "dbrown", "tan")
    for x, y, h in ((10, 8, 2), (14, 6, 3), (18, 7, 2)):
        g.rect(x, y, 1, h, "amber")
    expression(g, mood, glasses="dbrown", nose="skin2")
    return g


WALKERS = {
    "walker-casey": casey,
    "walker-ada": ada,
    "walker-mr-b": mr_b,
    "walker-trista": trista,
}


OWNERS = {
    "duchess": eve,
    "reggie": ryan,
    "buddy": jason,
    "pierre": tara,
    "biscuit": clare,
    "archie": kiwi,
    "snowball": aunt_judy,
    "penny": gadget,
    "kilo": ralph,
}


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    for dog, draw in OWNERS.items():
        yield f"face-owner-{dog}", [(m, [draw(m).outlined()], 1000) for m in MOODS]
        yield f"face-owner-{dog}-{SMALL}", [(m, [small(dog, m).outlined()], 1000) for m in MOODS]
    for key, draw in WALKERS.items():
        yield f"face-{key}", [(m, [draw(m).outlined()], 1000) for m in ("happy", "neutral")]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/owners", __doc__, grounds=("e4a672",))
