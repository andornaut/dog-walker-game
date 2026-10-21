#!/usr/bin/env python3
"""Draw the owners' and walkers' faces and build their Aseprite sources and exports.

face-owner-<dog>: 32x32, chibi, front view, in Endesga 32 with an ink
outer line closed under the bust, cel shaded, the face flat with a 1px shadow down its near edge. Tags: happy, neutral, upset, fired (angry, shown as the owner
fires you) and worried (at 1 heart, while their doghouse pulses). Each
owner's job shows in their hair and accessories, and their temperament in
how far the expressions go.

face-walker-<name>: 32x32 portraits for the walker picker. Tags:
happy, neutral.

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
from pixel import Grid, edged, main  # noqa: E402
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


def expression(g, mood, feat="dbrown", blush="pink", lashes=False, wide=False, brow=None, whites=False):
    """Eyes, brows and mouth. wide marks the dramatic owners, whose faces go further. brow is the brows'
    colour (feat unless given). whites sets a white beside each pupil, so the eyes read on dark skin.
    Happy closes the eyes into smiling arcs under arched brows; neutral is open eyes under flat brows;
    upset slants the brows down to the middle over a frown, angry and sad; fired narrows the eyes under brows
    pinched down hard; worried lifts the brows' inner ends over eyes gone wide, white either side of the
    pupil, with a small wobbly mouth and a big sweat bead."""
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
        "happy": ((11, 14), (12, 13), (13, 14), (18, 14), (19, 13), (20, 14)),
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


def rosa(mood):
    """Retired florist, dramatic: grey bun with a flower, green cardigan."""
    g = face()
    g.cel(16, 13, 9.5, 8, "lgrey", "grey")
    base(g, "skin1", "skin2", "green", "dgreen")
    g.rect(15, 27, 2, 4, "cream")
    g.cel(16, 10, 9, 4.5, "lgrey", "grey", "white")
    g.cel(16, 4, 4, 3, "lgrey", "grey", "white")
    for dx, dy in ((0, -2), (-2, 0), (2, 0), (0, 2)):
        g.ell(22.5 + dx, 6 + dy, 1.3, 1.3, "pink")
    g.p(22, 5, "yellow")
    g.p(22, 6, "amber")
    expression(g, mood, lashes=True, wide=True)
    return g


def kevin(mood):
    """Pet influencer, dramatic: tall blond quiff, sunglasses pushed up, pink tee."""
    g = face()
    base(g, "skin2", "brown", "pink", "mauve")
    g.cel(16, 9.5, 9, 4.5, "amber", "orange", "yellow")
    g.cel(18, 5, 6, 4, "amber", "orange", "yellow")
    g.cel(21, 3.5, 3, 2, "yellow", "amber")
    g.rect(9, 9, 6, 2, "ink")
    g.rect(17, 9, 6, 2, "ink")
    g.rect(15, 9, 2, 1, "ink")
    g.p(10, 9, "slate")
    g.p(18, 9, "slate")
    expression(g, mood, wide=True)
    return g


def pruitt(mood):
    """Retired accountant, fussy: bald with grey sides, round glasses, bow tie."""
    g = face()
    base(g, "skin1", "skin2", "brown", "dbrown")
    g.rect(13, 26, 6, 3, "white")
    g.tri((12, 26), (16, 28), (12, 30), "red")
    g.tri((20, 26), (16, 28), (20, 30), "red")
    g.p(16, 28, "dred")
    g.cel(8.5, 15, 2, 4, "lgrey", "grey")
    g.cel(23.5, 15, 2, 4, "lgrey", "grey")
    g.p(14, 9, "cream")
    g.p(15, 9, "cream")
    expression(g, mood)
    for cx in (12, 19):
        for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2), (-1, -1), (1, -1), (-1, 1), (1, 1)):
            g.p(cx + dx, 18 + dy, "slate")
    g.rect(14, 18, 3, 1, "slate")
    return g


def lefevre(mood):
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
    g.p(7, 19, "amber")
    g.p(24, 19, "amber")
    expression(g, mood, feat="dred", lashes=True)
    if mood != "fired":
        g.rect(15, 23, 2, 1, "red")
    return g


def sam(mood):
    """Barista, laid-back: green beanie, beard, cream shirt with an apron."""
    g = face()
    base(g, "dbrown", "plum", "cream", "tan")
    g.rect(10, 27, 2, 4, "brown")
    g.rect(20, 27, 2, 4, "brown")
    g.rect(12, 29, 8, 2, "brown")
    g.ell(16, 23.5, 6.5, 2.5, "ink")
    g.rect(9, 18, 2, 5, "ink")
    g.rect(21, 18, 2, 5, "ink")
    g.cel(16, 8.5, 9, 5, "dgreen", "forest", "green")
    g.rect(7, 11, 18, 2, "forest")
    g.ell(16, 3, 2, 1.5, "green")
    g.rect(14, 21, 4, 1, "ink")
    expression(g, mood, feat="cream", blush="rust", brow="ink", whites=True)
    return g


def kiwi(mood):
    """Grandmother, laid-back: a cloud of short white curls, a sky-blue cardigan over a white collar, a
    kiwi-slice brooch."""
    g = face()
    # the perm: round curls from ear to ear over the crown, each lit white and shaded lgrey
    for cx, cy in ((7.5, 15.5), (24.5, 15.5), (7.5, 11), (24.5, 11), (9.5, 7), (22.5, 7), (13, 4.5), (19, 4.5),
                   (16, 4)):
        g.cel(cx, cy, 2.6, 2.6, "white", "lgrey")
    base(g, "brown", "dbrown", "sky", "blue")
    g.tri((12, 26), (16, 26), (14, 29), "white")
    g.tri((16, 26), (20, 26), (18, 29), "white")
    g.rect(16, 29, 1, 2, "blue")
    g.rect(10, 28, 3, 2, "green")
    g.p(11, 28, "yellow")
    # the fringe: a row of tight curls across the forehead
    g.cel(16, 8.5, 7.5, 3, "white", "lgrey")
    for cx in (10, 13.5, 17, 20.5, 23):
        g.cel(cx, 10.5, 2, 1.8, "white", "lgrey")
    expression(g, mood, feat="ink", blush="rust", whites=True)
    return g


def tiffany(mood):
    """Wedding planner, dramatic: blond high ponytail, headset mic, white blouse."""
    g = face()
    g.cel(25, 8, 3, 6, "yellow", "amber")
    base(g, "skin1", "skin2", "white", "lgrey")
    g.rect(15, 27, 2, 4, "pink")
    g.cel(16, 10, 9, 4.5, "yellow", "amber", "white")
    g.ell(22, 5, 2.5, 2, "pink")
    g.rect(7, 13, 2, 7, "ink")
    g.rect(8, 20, 1, 1, "ink")
    g.rect(9, 21, 4, 1, "slate")
    g.p(13, 21, "ink")
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


def jesse(mood):
    """Trail runner, laid-back: short hair, sky-blue headband, orange running top."""
    g = face()
    base(g, "skin2", "brown", "orange", "rust")
    g.rect(14, 27, 4, 1, "rust")
    g.cel(16, 9.5, 9, 5, "dbrown", "plum", "brown")
    g.rect(8, 11, 16, 2, "sky")
    g.rect(8, 12, 16, 1, "blue")
    g.p(23, 10, "cyan")
    expression(g, mood)
    return g


# ---------- the walkers' portraits, for the walker picker ----------

def walker_cap(mood):
    """The cap-and-hoodie walker."""
    g = face()
    base(g, "skin1", "skin2", "sky", "blue")
    g.ell(16, 28, 4, 2, "blue")
    g.cel(16, 11, 9, 5, "dbrown", "plum", "brown")
    g.cel(16, 7.5, 9, 4.5, "amber", "orange", "yellow")
    g.rect(7, 10, 18, 2, "orange")
    g.rect(15, 5, 2, 2, "orange")
    expression(g, mood)
    return g


def walker_girl(mood):
    """Ada, 11, mixed race, caramel skin, long black curls falling straight down; pink tee."""
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
    base(g, "brown", "brown", "pink", "mauve")
    g.rect(13, 24, 6, 1, "dbrown")
    g.cel(16, 10, 8.5, 4, "navy", "ink", "dslate")
    g.cel(11.5, 8.5, 2.5, 1.5, "dslate")
    g.cel(22, 7, 2, 1.5, "pink", "mauve")
    expression(g, mood, blush="pink", wide=True)
    # big, bright eyes with two highlights
    for x in (11, 18):
        g.rect(x, 15, 3, 4, "ink")
        g.p(x, 15, "white")
        g.p(x + 2, 17, "white")
    return g


def walker_man(mood):
    """Ben, 45, Black, bald, an oval face, a beard along the jaw and under the chin, no moustache; green tee."""
    g = face()
    # the green tee, shaded dgreen on the right, with a dgreen collar, as on his road sprite
    g.rect(8, 27, 16, 1, "green")
    g.rect(6, 28, 20, 3, "green")
    g.rect(21, 28, 5, 3, "dgreen")
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
    g.rect(12, 26, 8, 1, "dgreen")
    g.rect(11, 27, 1, 1, "dgreen")
    g.rect(20, 27, 1, 1, "dgreen")
    expression(g, mood, feat="cream", blush="rust", brow="ink", whites=True)
    return g


def walker_teacher(mood):
    """50, dirty blonde bob to the shoulders, cute: round glasses, green cardigan, white collar."""
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
    expression(g, mood)
    for cx in (12, 19):
        for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2), (-1, -1), (1, -1), (-1, 1), (1, 1)):
            g.p(cx + dx, 18 + dy, "dbrown")
    g.rect(14, 18, 3, 1, "dbrown")
    return g


WALKERS = {
    "walker-casey": walker_cap,
    "walker-ada": walker_girl,
    "walker-ben": walker_man,
    "walker-trista": walker_teacher,
}


OWNERS = {
    "duchess": rosa,
    "nugget": kevin,
    "zippy": pruitt,
    "pierre": lefevre,
    "biscuit": sam,
    "archie": kiwi,
    "snowball": tiffany,
    "penny": gadget,
    "koda": jesse,
}


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    for dog, draw in OWNERS.items():
        yield f"face-owner-{dog}", [(m, [draw(m).outlined()], 1000) for m in MOODS]
    for key, draw in WALKERS.items():
        yield f"face-{key}", [(m, [draw(m).outlined()], 1000) for m in ("happy", "neutral")]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/owners", __doc__, grounds=("e4a672",))
