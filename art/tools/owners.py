#!/usr/bin/env python3
"""Draw the owners' faces for the dog column and build their Aseprite sources and exports.

face-owner-<dog>: 32x32, chibi, front view, in Endesga 32 with coloured
outlines. Tags: happy, neutral, upset and fired (angry, shown as the owner
fires you). Each owner's job shows in their hair and accessories, and their
temperament in how far the expressions go.

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
from pixel import Grid, main  # noqa: E402

MOODS = ["happy", "neutral", "upset", "fired"]


def base(g, skin, shade, shirt, shirt_sh):
    g.rect(8, 27, 16, 1, shirt)
    g.rect(6, 28, 20, 3, shirt)
    g.rect(21, 28, 5, 3, shirt_sh)
    g.rect(13, 24, 6, 4, shade)
    g.ell(7.5, 17, 1.5, 2, skin, shade)
    g.ell(24.5, 17, 1.5, 2, skin, shade)
    g.ell(16, 16, 8.5, 9, skin, shade)


def expression(g, mood, feat="dbrown", blush="pink", lashes=False, wide=False):
    """Eyes, brows and mouth. wide marks the dramatic owners, whose faces go further."""
    for x in (12, 19):
        g.rect(x, 17, 1, 2, "ink")
        if lashes:
            g.p(x - 1 if x == 12 else x + 1, 16, "ink")
    if mood == "happy":
        g.p(10, 21, blush)
        g.p(11, 21, blush)
        g.p(20, 21, blush)
        g.p(21, 21, blush)
        g.p(14, 22, feat)
        g.p(17, 22, feat)
        g.rect(15, 23, 2, 1, feat)
        if wide:
            g.rect(15, 23, 2, 1, "white")
            g.rect(14, 22, 4, 1, feat)
            g.rect(15, 24, 2, 1, feat)
    elif mood == "neutral":
        g.rect(14, 23, 4, 1, feat)
    elif mood == "upset":
        g.p(11, 15, feat)
        g.p(12, 14, feat)
        g.p(19, 14, feat)
        g.p(20, 15, feat)
        g.rect(15, 22, 2, 1, feat)
        g.p(14, 23, feat)
        g.p(17, 23, feat)
        if wide:
            g.p(10, 19, "cyan")
            g.p(10, 20, "sky")
    else:
        # fired: brows down at the middle, mouth open mid-shout, red cheeks
        g.p(11, 14, feat)
        g.p(12, 15, feat)
        g.p(19, 15, feat)
        g.p(20, 14, feat)
        g.rect(14, 21, 4, 3, feat)
        g.rect(15, 22, 2, 2, "dred")
        g.rect(10, 20, 2, 1, "red")
        g.rect(20, 20, 2, 1, "red")


def rosa(mood):
    """Retired florist, laid-back: grey bun with a flower, green cardigan."""
    g = Grid()
    g.ell(16, 13, 9.5, 8, "lgrey", "grey")
    base(g, "skin1", "skin2", "green", "dgreen")
    g.rect(15, 27, 2, 4, "cream")
    g.ell(16, 10, 9, 4.5, "lgrey", "grey", "white")
    g.ell(16, 4, 4, 3, "lgrey", "grey", "white")
    for dx, dy in ((0, -2), (-2, 0), (2, 0), (0, 2)):
        g.ell(22.5 + dx, 6 + dy, 1.3, 1.3, "pink")
    g.p(22, 5, "yellow")
    g.p(22, 6, "amber")
    expression(g, mood)
    return g


def kevin(mood):
    """Pet influencer, dramatic: tall blond quiff, sunglasses pushed up, pink tee."""
    g = Grid()
    base(g, "skin2", "brown", "pink", "mauve")
    g.ell(16, 9.5, 9, 4.5, "amber", "orange", "yellow")
    g.ell(18, 5, 6, 4, "amber", "orange", "yellow")
    g.ell(21, 3.5, 3, 2, "yellow", "amber")
    g.rect(9, 9, 6, 2, "ink")
    g.rect(17, 9, 6, 2, "ink")
    g.rect(15, 9, 2, 1, "ink")
    g.p(10, 9, "slate")
    g.p(18, 9, "slate")
    expression(g, mood, wide=True)
    return g


def pruitt(mood):
    """Retired accountant, fussy: bald with grey sides, round glasses, bow tie."""
    g = Grid()
    base(g, "skin1", "skin2", "brown", "dbrown")
    g.rect(13, 26, 6, 3, "white")
    g.tri((12, 26), (16, 28), (12, 30), "red")
    g.tri((20, 26), (16, 28), (20, 30), "red")
    g.p(16, 28, "dred")
    g.ell(8.5, 15, 2, 4, "lgrey", "grey")
    g.ell(23.5, 15, 2, 4, "lgrey", "grey")
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
    g = Grid()
    base(g, "skin1", "skin2", "purple", "plum")
    g.tri((13, 27), (19, 27), (16, 31), "white")
    for x in range(11, 22, 2):
        g.p(x, 27, "white")
    g.ell(16, 10, 9, 5, "navy", "ink", "dslate")
    g.ell(16, 3.5, 5, 3.5, "navy", "ink", "dslate")
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
    g = Grid()
    base(g, "dbrown", "plum", "cream", "tan")
    g.rect(10, 27, 2, 4, "brown")
    g.rect(20, 27, 2, 4, "brown")
    g.rect(12, 29, 8, 2, "brown")
    g.ell(16, 23.5, 6.5, 2.5, "ink")
    g.rect(9, 18, 2, 5, "ink")
    g.rect(21, 18, 2, 5, "ink")
    g.ell(16, 8.5, 9, 5, "dgreen", "forest", "green")
    g.rect(7, 11, 18, 2, "forest")
    g.ell(16, 3, 2, 1.5, "green")
    g.rect(14, 21, 4, 1, "ink")
    expression(g, mood, feat="cream", blush="rust")
    return g


def ophelia(mood):
    """Stage actor, dramatic: big curly copper hair, lashes, a flowing mauve scarf."""
    g = Grid()
    for cx, cy in ((7, 12), (25, 12), (6, 18), (26, 18), (8, 23), (24, 23), (11, 6), (21, 6), (16, 5)):
        g.ell(cx, cy, 3.5, 3.5, "rust", "dbrown", "orange")
    base(g, "skin1", "skin2", "mauve", "purple")
    g.ell(23, 29, 3, 2, "pink", "mauve")
    g.ell(16, 9.5, 8.5, 4, "rust", "dbrown", "orange")
    g.ell(12, 11, 3, 2, "orange")
    expression(g, mood, lashes=True, wide=True)
    return g


def tiffany(mood):
    """Wedding planner, dramatic: blond high ponytail, headset mic, white blouse."""
    g = Grid()
    g.ell(25, 8, 3, 6, "yellow", "amber")
    base(g, "skin1", "skin2", "white", "lgrey")
    g.rect(15, 27, 2, 4, "pink")
    g.ell(16, 10, 9, 4.5, "yellow", "amber", "white")
    g.ell(22, 5, 2.5, 2, "pink")
    g.rect(7, 13, 2, 7, "ink")
    g.rect(8, 20, 1, 1, "ink")
    g.rect(9, 21, 4, 1, "slate")
    g.p(13, 21, "ink")
    expression(g, mood, lashes=True, wide=True)
    return g


def hughes(mood):
    """Dentist, fussy: short dark hair, head mirror, white coat over blue scrubs."""
    g = Grid()
    base(g, "brown", "dbrown", "white", "lgrey")
    g.tri((13, 27), (19, 27), (16, 31), "sky")
    g.ell(16, 9.5, 8.5, 4, "ink", "ink", "navy")
    g.rect(8, 10, 16, 1, "slate")
    g.ell(16, 10, 3, 3, "lgrey", "grey", "white")
    g.ell(16, 10, 1.2, 1.2, "slate")
    expression(g, mood, feat="ink", blush="rust")
    return g


def jesse(mood):
    """Trail runner, laid-back: short hair, sky-blue headband, orange running top."""
    g = Grid()
    base(g, "skin2", "brown", "orange", "rust")
    g.rect(14, 27, 4, 1, "rust")
    g.ell(16, 9.5, 9, 5, "dbrown", "plum", "brown")
    g.rect(8, 11, 16, 2, "sky")
    g.rect(8, 12, 16, 1, "blue")
    g.p(23, 10, "cyan")
    expression(g, mood)
    return g


OWNERS = {
    "duchess": rosa,
    "nugget": kevin,
    "zippy": pruitt,
    "pierre": lefevre,
    "biscuit": sam,
    "dash": ophelia,
    "snowball": tiffany,
    "waffles": hughes,
    "koda": jesse,
}


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    for dog, draw in OWNERS.items():
        yield f"face-owner-{dog}", [(m, [draw(m).outlined()], 1000) for m in MOODS]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/owners", __doc__, grounds=("e4a672",))
