#!/usr/bin/env python3
"""Draw the dogs in code and build their Aseprite sources and exports.

Each dog gets two sprites, both 32x32 and in Endesga 32 with coloured outlines:

- dog-<name>: the road sprite, seen from above and behind. Tags: walk (4
  frames), react (2), pull (2, leaning right; the game mirrors it for left)
  and tell (2, the lean before a pull; the game adds the fx-bark pop).
- face-dog-<name>: the dog column face. Tags: happy, neutral, upset.

Usage:
  dogs.py preview OUT.png   contact sheet of every frame, scaled up
  dogs.py build             write art/dogs/*.aseprite, then export
                            public/art/sprites/*.png and *.json with Aseprite

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import Grid, main  # noqa: E402

# Road poses. Walk is a 4-beat trot: diagonal leg pairs swap on beats 0 and 2,
# and the body bobs up on the passing beats 1 and 3.
WALK = [
    dict(fl=-1, fr=1, bl=1, br=-1, bob=0, tail=-1),
    dict(fl=0, fr=0, bl=0, br=0, bob=-1, tail=0),
    dict(fl=1, fr=-1, bl=-1, br=1, bob=0, tail=1),
    dict(fl=0, fr=0, bl=0, br=0, bob=-1, tail=0),
]
REACT = [
    dict(fl=-4, fr=-4, bl=-3, br=-3, bob=-3, tail=0, ears=-1),
    dict(fl=-1, fr=-1, bl=-1, br=-1, bob=-1, tail=0, ears=-1),
]
PULL = [
    dict(fl=-1, fr=-1, bl=1, br=1, bob=0, tail=-2, lean=2),
    dict(fl=-2, fr=-1, bl=1, br=1, bob=0, tail=-2, lean=3),
]
TELL = [
    dict(bob=0, tail=1, lean=1, ears=-1),
    dict(bob=-1, tail=1, lean=2, ears=-1),
]
ROAD_TAGS = [("walk", WALK, 150), ("react", REACT, 120), ("pull", PULL, 160), ("tell", TELL, 250)]
FACE_TAGS = ["happy", "neutral", "upset"]


def pose(q):
    return dict(dict(fl=0, fr=0, bl=0, br=0, bob=0, tail=0, ears=0, lean=0), **q)


# ---------- Koda: husky, big, grey and white, blue eyes, orange harness ----------

def koda_road(q):
    g, q = Grid(), pose(q)
    # o shifts the body down so the big head has headroom to hop and lean
    b, ln, o = q["bob"], q["lean"], 2
    # legs: white, front pair beside the shoulders, back pair under the hips
    g.rect(7 + ln // 2, 15 + o + q["fl"] + b, 3, 4, "lgrey")
    g.rect(22 + ln // 2, 15 + o + q["fr"] + b, 3, 4, "lgrey")
    g.rect(9, 26 + q["bl"], 3, 4, "lgrey")
    g.rect(20, 26 + q["br"], 3, 4, "lgrey")
    # body: white flanks, grey saddle, harness
    bx = 16 + ln // 2
    g.ell(bx, 20.5 + o + b, 7.5, 6, "lgrey", "grey", "white")
    g.ell(bx, 19.5 + o + b, 5, 5, "slate", "dslate", "grey")
    g.rect(bx - 6, 16 + o + b, 12, 2, "orange")
    g.rect(bx - 6, 17 + o + b, 12, 1, "rust")
    g.rect(bx - 2, 20 + o + b, 4, 2, "orange")
    g.rect(bx - 1, 21 + o + b, 2, 1, "slate")
    g.ell(bx, 15 + o + b, 5, 1.5, "dslate")
    # curled tail over the hips
    tx = 16 + q["tail"]
    g.ell(tx, 28 + b, 3.5, 2, "lgrey", "grey", "white")
    g.p(tx, 28 + b, "grey")
    # big head with white cheeks and upright ears
    hx = 16 + ln
    e = q["ears"]
    tip = max(1, 1 + o + b + e)
    g.tri((hx - 7, 7 + o + b), (hx - 6, tip), (hx - 2, 4.5 + o + b), "slate")
    g.tri((hx + 7, 7 + o + b), (hx + 6, tip), (hx + 2, 4.5 + o + b), "slate")
    g.ell(hx, 9.5 + o + b, 8, 6, "slate", "dslate", "grey")
    g.ell(hx - 6.5, 12 + o + b, 2, 2.2, "lgrey")
    g.ell(hx + 6.5, 12 + o + b, 2, 2.2, "lgrey", "grey")
    return g


def koda_face(mood):
    g = Grid()
    g.tri((7, 11), (8, 1), (13.5, 6), "slate")
    g.tri((25, 11), (24, 1), (18.5, 6), "slate")
    g.tri((8.5, 8.5), (9, 4), (12, 6.5), "pink")
    g.tri((23.5, 8.5), (23, 4), (20, 6.5), "pink")
    g.ell(16, 28, 7, 3.5, "lgrey", "grey", "white")
    g.ell(16, 16, 10, 8.5, "slate", "dslate", "grey")
    # white mask: brows, cheeks and muzzle
    g.ell(16, 20.5, 8, 5, "lgrey", "grey", "white")
    g.rect(15, 8, 2, 7, "lgrey")
    g.rect(10, 12, 3, 1, "white")
    g.rect(19, 12, 3, 1, "white")
    # harness
    g.rect(9, 27, 14, 2, "orange")
    g.rect(9, 28, 14, 1, "rust")
    g.rect(15, 26, 2, 3, "orange")
    eyes(g, 10, 19, 14, iris="sky", mood=mood)
    g.rect(14, 18, 4, 2, "ink")
    g.p(14, 18, "slate")
    mouth(g, 20, mood)
    return g


# ---------- Biscuit: beagle, medium, tricolour, long ears, green collar ----------

def biscuit_road(q):
    g, q = Grid(), pose(q)
    b, ln = q["bob"], q["lean"]
    g.rect(9 + ln // 2, 18 + q["fl"] + b, 2, 3, "white")
    g.rect(21 + ln // 2, 18 + q["fr"] + b, 2, 3, "white")
    g.rect(10, 25 + q["bl"], 3, 3, "white")
    g.rect(19, 25 + q["br"], 3, 3, "white")
    bx = 16 + ln // 2
    g.ell(bx, 22 + b, 6.5, 5.5, "white", "lgrey")
    g.ell(bx, 21.5 + b, 5, 4.5, "navy", "ink", "dslate")
    g.ell(bx - 5, 23.5 + b, 1.8, 2.5, "ochre")
    g.ell(bx + 5, 23.5 + b, 1.8, 2.5, "ochre", "rust")
    # tail held up, white tip
    tx = 16 + q["tail"]
    g.rect(tx - 1, 26 + b, 2, 3, "navy")
    g.rect(tx - 1, 29 + b, 2, 1, "white")
    g.ell(bx, 16 + b, 4.5, 1.5, "ink")
    g.rect(bx - 5, 16 + b, 10, 2, "green")
    g.rect(bx - 5, 17 + b, 10, 1, "dgreen")
    hx = 16 + ln
    g.ell(hx, 11.5 + b, 7, 5.5, "ochre", "rust", "tan")
    g.ell(hx - 6.5, 14 + b - q["ears"], 2.3, 4.5, "rust", "dbrown")
    g.ell(hx + 6.5, 14 + b - q["ears"], 2.3, 4.5, "rust", "dbrown")
    return g


def biscuit_face(mood):
    g = Grid()
    g.ell(16, 28.5, 6.5, 3, "white", "lgrey")
    g.ell(16, 15.5, 9, 8, "ochre", "rust", "tan")
    g.rect(15, 7, 2, 9, "white")
    g.ell(16, 20.5, 6, 4.5, "white", "lgrey")
    g.ell(6.5, 18, 3, 7.5, "rust", "dbrown")
    g.ell(25.5, 18, 3, 7.5, "rust", "dbrown")
    g.rect(9, 26, 14, 2, "green")
    g.rect(9, 27, 14, 1, "dgreen")
    eyes(g, 11, 19, 14, mood=mood)
    g.rect(14, 17, 4, 2, "ink")
    g.p(14, 17, "dslate")
    mouth(g, 20, mood)
    return g


# ---------- Duchess: Maltese, small, white, pink bow ----------

def duchess_road(q):
    g, q = Grid(), pose(q)
    b, ln = q["bob"], q["lean"]
    g.rect(12, 27 + q["bl"], 2, 2, "lgrey")
    g.rect(18, 27 + q["br"], 2, 2, "lgrey")
    bx = 16 + ln // 2
    g.ell(bx, 23.5 + b, 5.5, 4.5, "white", "lgrey")
    g.ell(bx - 4.5, 25 + b, 1.6, 2, "white", "lgrey")
    g.ell(bx + 4.5, 25 + b, 1.6, 2, "lgrey")
    g.ell(bx, 20 + b, 4, 1.2, "lgrey")
    tx = 16 + q["tail"]
    g.ell(tx, 26.5 + b, 3, 2, "white", "lgrey", "white")
    g.p(tx + 1, 27 + b, "lgrey")
    hx = 16 + ln
    g.ell(hx - 4.5, 18 + b - q["ears"], 2.2, 4, "white", "lgrey")
    g.ell(hx + 4.5, 18 + b - q["ears"], 2.2, 4, "lgrey")
    g.ell(hx, 15.5 + b, 5.5, 4.5, "white", "lgrey")
    bow(g, hx, 10 + b)
    return g


def duchess_face(mood):
    g = Grid()
    g.ell(16, 26.5, 6, 3.5, "white", "lgrey")
    g.ell(7.5, 19, 3.5, 7.5, "white", "lgrey")
    g.ell(24.5, 19, 3.5, 7.5, "lgrey", "grey")
    g.ell(16, 16, 8.5, 8, "white", "lgrey")
    g.ell(16, 20.5, 4.5, 3.5, "white", "lgrey")
    bow(g, 16, 6, big=True)
    eyes(g, 11, 19, 15, mood=mood)
    g.rect(15, 18, 2, 2, "ink")
    mouth(g, 21, mood)
    return g


# ---------- shared features ----------

def bow(g, cx, y, big=False):
    w = 4 if big else 3
    g.tri((cx - 1, y + 1), (cx - 1 - w, y - 1), (cx - 1 - w, y + 3), "pink")
    g.tri((cx + 1, y + 1), (cx + 1 + w, y - 1), (cx + 1 + w, y + 3), "pink")
    g.p(cx - 1 - w + 1, y + 2, "mauve")
    g.p(cx + w, y + 2, "mauve")
    g.rect(cx - 1, y, 2, 2, "mauve")


def eyes(g, lx, rx, y, iris=None, mood="happy"):
    for x in (lx, rx):
        if iris:
            g.rect(x, y, 3, 3, iris)
            g.p(x + 1, y + 1, "ink")
            g.p(x + 2, y + 2, "blue")
            g.p(x, y, "white")
        else:
            g.rect(x, y, 2, 2, "ink")
            g.p(x, y, "white")
    if mood == "upset":
        wide = 3 if iris else 2
        # brows tilt up toward the middle
        g.p(lx - 1, y - 1, "ink")
        g.rect(lx, y - 2, wide - 1, 1, "ink")
        g.rect(rx + 1, y - 2, wide - 1, 1, "ink")
        g.p(rx + wide, y - 1, "ink")


def mouth(g, y, mood):
    if mood == "happy":
        g.p(14, y, "ink")
        g.p(17, y, "ink")
        g.rect(15, y + 1, 2, 1, "ink")
        g.rect(15, y + 2, 2, 2, "pink")
        g.p(16, y + 3, "mauve")
    elif mood == "neutral":
        g.rect(15, y + 1, 2, 1, "ink")
    else:
        g.rect(15, y, 2, 1, "ink")
        g.p(14, y + 1, "ink")
        g.p(17, y + 1, "ink")


DOGS = {
    "duchess": (duchess_road, duchess_face),
    "biscuit": (biscuit_road, biscuit_face),
    "koda": (koda_road, koda_face),
}


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    for name, (road, face) in DOGS.items():
        yield f"dog-{name}", [(tag, [road(q).outlined() for q in poses], ms) for tag, poses, ms in ROAD_TAGS]
        yield f"face-dog-{name}", [(m, [face(m).outlined()], 1000) for m in FACE_TAGS]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/dogs", __doc__)
