#!/usr/bin/env python3
"""Draw the dogs in code and build their Aseprite sources and exports.

Each dog gets two sprites, both 32x32 and in Endesga 32 with coloured outlines:

- dog-<name>: the road sprite, seen from above and behind. Tags: walk (4
  frames), react (2), pull (2, leaning right; the game mirrors it for left),
  tell (2, the lean before a pull; the game adds the fx-bark pop), idle (4,
  standing while the walk pauses: a slow tail wag and a twitch of the right ear)
  and shake (4, a quick shake-off after an encounter hit, throwing droplets).
  A dog with a quirk has its quirk's tags after these (QUIRK_TAGS):
  dog-archie flourish (5 frames, 90ms; Acrobatic: a hop with a twist in the air,
  played when he pulls or meets a playmate); dog-penny lunge (4, 140ms; Nervous: a
  stiff-legged strain toward another dog with her hackles up, leaning right like
  pull, mirrored for left) and worried (2, 500ms; clingy: ears down, glancing back
  over her shoulder, while she is the only dog on the leash); dog-biscuit sniff (3,
  180ms; Scent hound: nose down, tail flagged up and wagging, a puff of scent beside
  the nose); dog-nugget pose (3, 220ms; Camera ready: sits square, cocks his head and
  a sparkle glints over it); dog-zippy pounce (4, 90ms; Ratter: a crouch, a spring, a
  stretched leap over motion streaks and a landing on the front paws).
- face-dog-<name>: the dog column face. Tags: happy, neutral, upset, then the
  quirk's faces (QUIRK_FACES): face-dog-penny worried (ears back, whale eyes,
  a wobbly mouth and a sweat bead), while she is the only dog on the leash.

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
from pixel import Grid, edged, main  # noqa: E402

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
# Standing still: the tail swings across and back, and the right ear lifts 1px as it comes home.
IDLE = [
    dict(tail=-1),
    dict(tail=0),
    dict(tail=1),
    dict(tail=0, twitch=-1),
]
# Shaking off after an encounter hit: the head whips 2px and the body 1px left and right (lean, with the
# hind legs planted), the ears and tail flick against it, and droplets fly off on the middle two beats,
# spray pixels out from the flanks.
SHAKE = [
    dict(lean=-2, tail=1, ears=-1),
    dict(lean=2, tail=-2, ears=1, twitch=-1, spray=2),
    dict(lean=-2, tail=2, ears=-1, spray=4),
    dict(lean=2, tail=-1, ears=1),
]
# Idle and shake go last so the frame indices of the other tags stay put.
ROAD_TAGS = [("walk", WALK, 150), ("react", REACT, 120), ("pull", PULL, 160), ("tell", TELL, 250), ("idle", IDLE, 300),
             ("shake", SHAKE, 60)]
FACE_TAGS = ["happy", "neutral", "upset"]

# Archie's flourish: he crouches, springs up (hop lifts the whole dog, back legs too), twists left then
# right in the air with his legs tucked and a swoosh trailing the turn (whirl: the side it trails on), and
# lands.
FLOURISH = [
    dict(bob=1, fl=-1, fr=-1, bl=-1, br=-1, ears=1),
    dict(hop=-2, fl=1, fr=1, bl=1, br=1, tail=1, ears=-1),
    dict(hop=-4, fl=-2, fr=-2, bl=-2, br=-2, lean=-3, tail=2, whirl=1),
    dict(hop=-4, fl=-2, fr=-2, bl=-2, br=-2, lean=3, tail=-2, whirl=-1),
    dict(hop=-1, fl=1, fr=1, ears=1),
]
# Penny's lunge: hackles up, she sets her hind legs and stretches forward and right on stiff front legs, her
# head reaching out ahead of her body, the tail held still; the last frame eases back 1px, so the loop strains.
LUNGE = [
    dict(bob=-1, fl=-1, fr=-1, bl=1, br=1, lean=1, ears=1, hackles=1),
    dict(bob=-1, fl=-2, fr=-2, bl=1, br=1, lean=2, ears=1, hackles=1, reach=-1),
    dict(bob=-2, fl=-3, fr=-2, bl=1, br=1, lean=3, ears=1, hackles=1, reach=-2),
    dict(bob=-1, fl=-2, fr=-2, bl=1, br=1, lean=2, ears=1, hackles=1, reach=-1),
]
# Penny alone: ears dropped and the tail tucked still, then a glance back over her left shoulder.
WORRIED = [
    dict(ears=-1, tuck=1),
    dict(ears=-1, tuck=1, lean=-1, glance=-1),
]
# Biscuit's sniff: nose down to the road and the tail flagged up, wagging, as a puff of scent rises on
# one side of the nose, then the other.
SNIFF = [
    dict(nose=2, perk=1, tail=-2),
    dict(nose=2, perk=1, tail=1, scent=-1),
    dict(nose=2, perk=1, tail=2, scent=1),
]
# Nugget's pose: he sits square for the camera, cocks his head, and a sparkle glints over it.
POSE = [
    dict(sit=1),
    dict(sit=1, tilt=-1, glint=1),
    dict(sit=1, tilt=-1, glint=2),
]
# Zippy's pounce: a crouch with the tail going, a spring off the hind legs, a stretched leap with the
# front paws reaching and motion streaks under him, and a landing on the front paws.
POUNCE = [
    dict(bob=1, fl=-1, fr=-1, tail=1, ears=1),
    dict(hop=-2, reach=-1, fl=-2, fr=-2, bl=1, br=1, tail=-1, ears=1),
    dict(hop=-4, reach=-2, fl=-3, fr=-3, bl=1, br=1, ears=1, streak=1),
    dict(hop=-1, reach=-1, fl=-2, fr=-2, bob=1),
]
# A quirk's tags go after ROAD_TAGS and its faces after FACE_TAGS, on the dogs that have it.
QUIRK_TAGS = {"archie": [("flourish", FLOURISH, 90)], "penny": [("lunge", LUNGE, 140), ("worried", WORRIED, 500)],
              "biscuit": [("sniff", SNIFF, 180)], "nugget": [("pose", POSE, 220)], "zippy": [("pounce", POUNCE, 90)]}
QUIRK_FACES = {"penny": ["worried"]}


def road_tags(name):
    """dog-<name>'s tags: ROAD_TAGS, then its quirk's."""
    return ROAD_TAGS + QUIRK_TAGS.get(name, [])


def face_tags(name):
    """face-dog-<name>'s tags: FACE_TAGS, then its quirk's."""
    return FACE_TAGS + QUIRK_FACES.get(name, [])


def pose(q):
    """Every pose key with its default. twitch moves the right ear alone (negative is up); spray is how far
    the shake-off's droplets have flown from the flanks, 0 for none. The quirk keys: hop lifts the whole
    dog (negative is up); whirl draws a swoosh on the right (positive) or left (negative) flank; hackles
    raises a ridge of fur along the back; reach moves the head alone (negative is forward); tuck holds the
    tail in; glance turns the head back over the left (negative) or right shoulder; nose lowers the nose
    to the road (the head dips forward and shortens); perk flags the tail up; scent puffs scent beside the
    nose, left (negative) or right; sit sets the hindquarters down; tilt cocks the head left (negative) or
    right; glint is a sparkle's size over the head; streak draws motion lines under a leap. The small
    versions round them to whole pixels, so draws read whirl, glance, scent, sit, tilt and streak by their
    sign."""
    return dict(dict(fl=0, fr=0, bl=0, br=0, bob=0, tail=0, ears=0, lean=0, twitch=0, spray=0, hop=0, whirl=0,
                     hackles=0, reach=0, tuck=0, glance=0, nose=0, perk=0, scent=0, sit=0, tilt=0, glint=0,
                     streak=0), **q)


# ---------- Koda: husky, big, grey and white, blue eyes, orange harness ----------

def koda_road(q):
    g, q = edged(Grid()), pose(q)
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
    t = q["twitch"]
    g.tri((hx - 7, 7 + o + b), (hx - 6, tip), (hx - 2, 4.5 + o + b), "slate")
    g.tri((hx + 7, 7 + o + b + t), (hx + 6, tip + t), (hx + 2, 4.5 + o + b + t), "slate")
    g.ell(hx, 9.5 + o + b, 8, 6, "slate", "dslate", "grey")
    g.ell(hx - 6.5, 12 + o + b, 2, 2.2, "lgrey")
    g.ell(hx + 6.5, 12 + o + b, 2, 2.2, "lgrey", "grey")
    spray(g, q["spray"])
    return g


def koda_face(mood):
    g = Grid()
    d = droop(mood)
    g.tri((7, 11), (8 - d, 1 + d), (13.5, 6 + d / 2), "slate")
    g.tri((25, 11), (24 + d, 1 + d), (18.5, 6 + d / 2), "slate")
    g.tri((8.5, 8.5), (9 - d, 4 + d), (12, 6.5 + d / 2), "pink")
    g.tri((23.5, 8.5), (23 + d, 4 + d), (20, 6.5 + d / 2), "pink")
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
    g, q = edged(Grid()), pose(q)
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
    # tail held up, white tip; flagged, it stands 1px longer
    tx, pk = 16 + q["tail"], 1 if q["perk"] else 0
    g.rect(tx - 1, 26 + b, 2, 3 + pk, "navy")
    g.rect(tx - 1, 29 + b + pk, 2, 1, "white")
    g.ell(bx, 16 + b, 4.5, 1.5, "ink")
    g.rect(bx - 5, 16 + b, 10, 2, "green")
    g.rect(bx - 5, 17 + b, 10, 1, "dgreen")
    # a round head no wider than the body, the long ears hanging from its sides past the collar; nose down,
    # the head dips below the shoulders and foreshortens, the ears left hanging long beside it
    hx, n = 16 + ln, q["nose"]
    if n:
        g.ell(hx, 14 + b, 4, 2.5, "ochre")
    g.ell(hx, 11 + b - n / 2, 5.5 - n / 4, 5 - n * 0.75, "ochre", None, "tan")
    g.ell(hx - 5, 13 + b - q["ears"], 2, 4.5, "rust", "dbrown")
    g.ell(hx + 5, 13 + b - q["ears"] + q["twitch"], 2, 4.5, "rust", "dbrown")
    scent(g, hx, 5 + b - n, q["scent"])
    spray(g, q["spray"])
    return g


def biscuit_face(mood):
    g = Grid()
    g.ell(16, 28.5, 6.5, 3, "white", "lgrey")
    g.ell(16, 15.5, 9, 8, "ochre", "rust", "tan")
    g.rect(15, 7, 2, 9, "white")
    g.ell(16, 20.5, 6, 4.5, "white", "lgrey")
    d = droop(mood)
    g.ell(6.5 - d / 2, 18 + d, 3, 7.5, "rust", "dbrown")
    g.ell(25.5 + d / 2, 18 + d, 3, 7.5, "rust", "dbrown")
    g.rect(9, 26, 14, 2, "green")
    g.rect(9, 27, 14, 1, "dgreen")
    eyes(g, 11, 19, 14, mood=mood)
    g.rect(14, 17, 4, 2, "ink")
    g.p(14, 17, "dslate")
    mouth(g, 20, mood)
    return g


# ---------- Duchess: Maltese, small, white, pink bow ----------

def duchess_road(q):
    g, q = edged(Grid()), pose(q)
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
    g.ell(hx + 4.5, 18 + b - q["ears"] + q["twitch"], 2.2, 4, "lgrey")
    g.ell(hx, 15.5 + b, 5.5, 4.5, "white", "lgrey")
    bow(g, hx, 10 + b)
    spray(g, q["spray"])
    return g


def duchess_face(mood):
    g = Grid()
    g.ell(16, 26.5, 6, 3.5, "white", "lgrey")
    d = droop(mood)
    g.ell(7.5 - d / 2, 19 + d, 3.5, 7.5, "white", "lgrey")
    g.ell(24.5 + d / 2, 19 + d, 3.5, 7.5, "lgrey", "grey")
    g.ell(16, 16, 8.5, 8, "white", "lgrey")
    g.ell(16, 20.5, 4.5, 3.5, "white", "lgrey")
    bow(g, 16, 6, big=True)
    eyes(g, 11, 19, 15, mood=mood)
    g.rect(15, 18, 2, 2, "ink")
    mouth(g, 21, mood)
    return g


# ---------- Nugget: pug, small, fawn, black mask, red bandana ----------

def nugget_road(q):
    g, q = edged(Grid()), pose(q)
    b, ln = q["bob"], q["lean"]
    g.rect(10 + ln // 2, 21 + q["fl"] + b, 2, 2, "skin2")
    g.rect(20 + ln // 2, 21 + q["fr"] + b, 2, 2, "skin2")
    bx = 16 + ln // 2
    if q["sit"]:
        # sitting square: the rump settles into a rounder, wider seat, the hind feet set out at its sides
        g.rect(bx - 7, 27, 2, 2, "skin2")
        g.rect(bx + 5, 27, 2, 2, "skin2")
        g.ell(bx, 24 + b, 6, 4.5, "skin1", "skin2", "cream")
    else:
        g.rect(12, 27 + q["bl"], 2, 2, "skin2")
        g.rect(18, 27 + q["br"], 2, 2, "skin2")
        g.ell(bx, 23.5 + b, 5.5, 4.5, "skin1", "skin2", "cream")
    tx = 16 + q["tail"]
    g.ell(tx, 26 + b, 2, 1.6, "skin1", "skin2")
    g.p(tx, 26 + b, "skin2")
    g.rect(bx - 4, 19 + b, 8, 1, "red")
    g.rect(bx - 1, 19 + b, 2, 2, "dred")
    # the head; cocked, it shifts 1px to that side, the ear on that side dropping and the other lifting
    tl = (q["tilt"] > 0) - (q["tilt"] < 0)
    hx = 16 + ln + tl
    g.ell(hx, 15 + b, 5.5, 4.5, "skin1", "skin2", "cream")
    g.ell(hx - 4.5, 12 + b - q["ears"] - tl, 1.8, 1.5, "navy")
    g.ell(hx + 4.5, 12 + b - q["ears"] + q["twitch"] + tl, 1.8, 1.5, "navy")
    g.rect(hx - 2, 13 + b, 4, 1, "skin2")
    sparkle(g, hx + 9, 6 + b, q["glint"])
    spray(g, q["spray"])
    return g


def nugget_face(mood):
    g = Grid()
    g.tri((8, 26), (24, 26), (16, 31), "red")
    g.p(13, 27, "white")
    g.p(18, 27, "white")
    g.p(16, 29, "white")
    g.ell(16, 16, 9.5, 8.5, "skin1", "skin2", "cream")
    d = droop(mood)
    g.tri((6 - d / 2, 13 + d), (8 - d, 7 + d), (12, 10), "navy")
    g.tri((26 + d / 2, 13 + d), (24 + d, 7 + d), (20, 10), "navy")
    g.rect(13, 9, 6, 1, "skin2")
    g.ell(16, 20.5, 5.5, 4, "navy", "ink", "dslate")
    eyes(g, 10, 20, 14, mood=mood)
    g.rect(15, 18, 2, 1, "ink")
    mouth(g, 20, mood)
    return g


# ---------- Zippy: Jack Russell, small, white with tan patches, red collar ----------

def zippy_road(q):
    g, q = edged(Grid()), pose(q)
    hop = q["hop"]
    b, ln = q["bob"] + hop, q["lean"]
    g.rect(10 + ln // 2, 21 + q["fl"] + b, 2, 3, "white")
    g.rect(20 + ln // 2, 21 + q["fr"] + b, 2, 3, "white")
    g.rect(12, 26 + q["bl"] + hop, 2, 3, "white")
    g.rect(18, 26 + q["br"] + hop, 2, 3, "white")
    bx = 16 + ln // 2
    g.ell(bx, 23.5 + b, 5, 4.5, "white", "lgrey")
    g.ell(bx + 1.5, 22.5 + b, 2.5, 2, "ochre", "rust")
    tx = 16 + q["tail"]
    g.rect(tx - 1, 27 + b, 2, 2, "white")
    g.p(tx, 28 + b, "ochre")
    # reaching, the head stretches forward of the collar on a white neck
    hx, hb = 16 + ln, b + q["reach"]
    if q["reach"]:
        g.ell(hx, 18 + b + q["reach"] / 2, 3.5, 2 - q["reach"] / 2, "white", "lgrey")
    g.rect(bx - 4, 19 + b, 8, 1, "red")
    g.ell(hx, 15 + hb, 5, 4.5, "white", "lgrey")
    g.ell(hx + 2, 14 + hb, 2.5, 2, "ochre")
    e = q["ears"]
    g.tri((hx - 5, 14 + hb), (hx - 4, 10 + hb + e), (hx - 1.5, 12.5 + hb), "ochre")
    t = q["twitch"]
    g.tri((hx + 5, 14 + hb + t), (hx + 4, 10 + hb + e + t), (hx + 1.5, 12.5 + hb + t), "ochre")
    if q["streak"]:
        for x in (8, 23):
            g.rect(x, 25 + hop, 1, 4, "white")
    spray(g, q["spray"])
    return g


def zippy_face(mood):
    g = Grid()
    g.ell(16, 16, 9, 8, "white", "lgrey")
    g.ell(10.5, 12.5, 4, 4, "ochre", "rust", "tan")
    g.ell(21.5, 12.5, 4, 4, "ochre", "rust", "tan")
    d = droop(mood)
    g.tri((6, 12 + d), (9 - d, 5 + d), (13, 9), "ochre")
    g.tri((26, 12 + d), (23 + d, 5 + d), (19, 9), "ochre")
    g.tri((7.5, 11 + d), (9 - d, 7 + d), (11, 9), "rust")
    g.tri((24.5, 11 + d), (23 + d, 7 + d), (21, 9), "rust")
    g.ell(16, 21, 5, 3.5, "white", "lgrey")
    g.rect(9, 26, 14, 2, "red")
    g.rect(9, 27, 14, 1, "dred")
    eyes(g, 11, 19, 14, mood=mood)
    g.rect(15, 18, 2, 2, "ink")
    mouth(g, 20, mood)
    return g


# ---------- Pierre: standard poodle, medium, apricot, show-clip pom-poms ----------

def pierre_road(q):
    g, q = edged(Grid()), pose(q)
    b, ln = q["bob"], q["lean"]
    # shaved legs in skin2, each with a pom-pom bracelet at the paw
    for x, d in ((10 + ln // 2, q["fl"]), (22 + ln // 2, q["fr"])):
        g.rect(x - 1, 19 + d + b, 2, 2, "skin2")
        puff(g, x, 22 + d + b, 1.8, 1.6)
    for x, d in ((12, q["bl"]), (20, q["br"])):
        g.rect(x - 1, 25 + d, 2, 3, "skin2")
        puff(g, x, 28.5 + d, 2, 1.6)
    # shaved hindquarters behind a curly mane over the shoulders
    bx = 16 + ln // 2
    g.ell(bx, 23.5 + b, 3.5, 4, "skin2", "brown", "skin1")
    puff(g, bx, 18.5 + b, 5, 3.2)
    # a thin tail held up with a pom-pom on the end
    tx = 16 + q["tail"]
    g.rect(tx, 25 + b, 1, 2, "brown")
    puff(g, tx + 0.5, 28 + b, 2, 1.8)
    # ear puffs hanging behind a round topknot, and a small purple show bow pinned to its top right
    hx = 16 + ln
    puff(g, hx - 5, 14.5 + b - q["ears"], 2, 3.5, ring=True)
    puff(g, hx + 5, 14.5 + b - q["ears"] + q["twitch"], 2, 3.5, ring=True)
    puff(g, hx, 10 + b, 4, 3.8, ring=True)
    g.rect(hx, 5 + b, 2, 3, "purple")
    g.rect(hx + 3, 5 + b, 2, 3, "purple")
    g.p(hx + 2, 6 + b, "mauve")
    g.p(hx, 5 + b, "mauve")
    spray(g, q["spray"])
    return g


def pierre_face(mood):
    g = Grid()
    d = droop(mood)
    g.ell(16, 28.5, 6.5, 3, "skin1", "brown", "cream")
    g.ell(7 - d / 2, 19 + d, 3.5, 7, "skin1", "brown", "cream")
    g.ell(25 + d / 2, 19 + d, 3.5, 7, "skin1", "brown")
    g.ell(16, 17, 7, 7, "skin1", "brown", "cream")
    g.ell(16, 8, 8, 5, "skin1", "brown", "cream")
    for x, y in ((11, 6), (15, 4), (19, 6), (13, 9), (21, 9), (9, 15), (23, 16)):
        g.p(x, y, "cream")
    g.ell(16, 22, 4, 3.5, "cream", "skin1")
    bow(g, 16, 4, big=True, colours=("mauve", "purple"))
    eyes(g, 12, 19, 15, mood=mood)
    g.rect(15, 19, 2, 2, "ink")
    mouth(g, 22, mood)
    return g


# ---------- Archie: Australian Shepherd, medium, red merle, one blue eye, red bandana ----------

# The coat (fill, shade, light), the merle blotches (patch, ragged edge) and the ears (ear, folded tip).
COAT = ("skin2", "brown", "skin1")
BLOT = ("dbrown", "brown")
EAR = ("dbrown", "plum")

def archie_road(q):
    g, q = edged(Grid()), pose(q)
    hop = q["hop"]
    b, ln = q["bob"] + hop, q["lean"]
    # white legs with copper points where they meet the coat
    for x, y, d in ((9 + ln // 2, 17, q["fl"] + b), (21 + ln // 2, 17, q["fr"] + b), (10, 25, q["bl"] + hop),
                    (19, 25, q["br"] + hop)):
        g.rect(x, y + d, 3 if y > 20 else 2, 4, "white")
        g.rect(x, y + d, 3 if y > 20 else 2, 1, "ochre")
    # a cinnamon coat torn by liver merle blotches, a fluffy white ruff at the nape. As wide as Biscuit,
    # longer in the coat
    bx = 16 + ln // 2
    g.ell(bx, 21.5 + b, 7, 6, *COAT)
    merle(g, bx, b, ((-5, 20, 2, 2), (1, 19, 3, 2), (3, 23, 2, 2), (-2, 24, 3, 1), (-4, 23, 1, 1), (5, 20, 1, 2)))
    g.ell(bx, 16.5 + b, 6, 2, "white", "lgrey")
    # the red bandana's knot at the nape, its two ends flaring down the back
    g.rect(bx - 5, 17 + b, 10, 1, "red")
    g.rect(bx - 1, 16 + b, 2, 2, "dred")
    for side in (-1, 1):
        g.p(bx + (side - 1) // 2 + side, 18 + b, "red")
        g.p(bx + (side - 1) // 2 + 2 * side, 19 + b, "dred")
    # a short bobtail
    tx = 16 + q["tail"]
    g.ell(tx, 27.5 + b, 2, 1.6, *COAT)
    g.p(tx - 1, 27 + b, BLOT[0])
    # ears set high and tipped forward, the folded tips darker
    hx = 16 + ln
    e, t = q["ears"], q["twitch"]
    g.tri((hx - 5.5, 10 + b), (hx - 5, 5 + b + e), (hx - 1.5, 7 + b), EAR[0])
    g.tri((hx + 5.5, 10 + b + t), (hx + 5, 5 + b + e + t), (hx + 1.5, 7 + b + t), EAR[0])
    g.rect(hx - 6, 5 + b + e, 2, 1, EAR[1])
    g.rect(hx + 4, 5 + b + e + t, 2, 1, EAR[1])
    g.ell(hx, 11.5 + b, 5.5, 5, *COAT)
    merle(g, hx, b, ((-4, 9, 2, 2), (2, 8, 2, 1), (1, 12, 2, 2), (-2, 13, 1, 1)))
    spray(g, q["spray"])
    whirl(g, q["whirl"], bx, b)
    return g


def archie_face(mood):
    g = Grid()
    d = droop(mood)
    # ears set high, the tips folding forward and out
    g.tri((7, 12), (8 - d, 3 + d), (13.5, 7 + d / 2), EAR[0])
    g.tri((25, 12), (24 + d, 3 + d), (18.5, 7 + d / 2), EAR[0])
    g.tri((8 - d, 3 + d), (4 - d, 6 + d), (9 - d, 6 + d), EAR[1])
    g.tri((24 + d, 3 + d), (28 + d, 6 + d), (23 + d, 6 + d), EAR[1])
    # a white ruff, the red bandana tied over it
    g.ell(16, 27, 9, 3.5, "white", "lgrey")
    g.tri((8, 25), (24, 25), (16, 31.5), "red")
    g.tri((16, 25), (24, 25), (16, 31.5), "dred")
    g.rect(8, 25, 16, 1, "dred")
    g.ell(16, 16, 9.5, 8.5, *COAT)
    # merle: a liver patch over the blue eye, blotches across the skull and cheek
    g.ell(11, 14, 4, 3.5, *BLOT)
    for x, y, w, h in ((19, 9, 3, 2), (22, 12, 2, 2), (23, 18, 2, 2), (8, 19, 1, 2), (12, 8, 2, 1)):
        g.rect(x, y, w, h, BLOT[0])
        g.p(x + w, y + h - 1, BLOT[1])
    g.rect(15, 7, 2, 9, "white")
    # copper brows and cheeks
    g.p(10, 11, "ochre")
    g.p(21, 11, "ochre")
    g.rect(9, 18, 2, 2, "ochre")
    g.rect(22, 18, 2, 2, "ochre")
    g.ell(16, 20.5, 5, 3.5, "white", "lgrey")
    eyes(g, 10, 19, 14, iris="sky", mood=mood)
    # the other eye amber
    g.rect(19, 14, 3, 3, "amber")
    g.p(20, 15, "ink")
    g.p(21, 16, "orange")
    g.p(19, 14, "white")
    # a liver nose
    g.rect(14, 18, 4, 2, "plum")
    g.p(14, 18, "dbrown")
    mouth(g, 20, mood)
    return g


# ---------- Snowball: Samoyed, big, fluffy white, collar with a bell ----------

def snowball_road(q):
    g, q = edged(Grid()), pose(q)
    b, ln, o = q["bob"], q["lean"], 2
    g.rect(7 + ln // 2, 15 + o + q["fl"] + b, 3, 4, "white")
    g.rect(22 + ln // 2, 15 + o + q["fr"] + b, 3, 4, "white")
    g.rect(9, 26 + q["bl"], 3, 4, "lgrey")
    g.rect(20, 26 + q["br"], 3, 4, "lgrey")
    bx = 16 + ln // 2
    g.ell(bx, 20.5 + o + b, 8, 6, "white", "lgrey")
    for dx, dy in ((-7, 0), (7, 0), (-5, 4), (5, 4)):
        g.ell(bx + dx, 20.5 + o + b + dy, 2, 2, "white", "lgrey")
    g.rect(bx - 6, 16 + o + b, 12, 1, "sky")
    g.p(bx + 6, 17 + o + b, "amber")
    tx = 16 + q["tail"]
    g.ell(tx, 23.5 + o + b, 4.5, 3.5, "white", "lgrey")
    g.ell(tx - 1, 23 + o + b, 2.5, 1.5, "lgrey")
    hx = 16 + ln
    e = q["ears"]
    tip = max(1, 1 + o + b + e)
    t = q["twitch"]
    g.tri((hx - 7, 7 + o + b), (hx - 6, tip), (hx - 2, 4.5 + o + b), "white")
    g.tri((hx + 7, 7 + o + b + t), (hx + 6, tip + t), (hx + 2, 4.5 + o + b + t), "lgrey")
    g.ell(hx, 9.5 + o + b, 8, 6, "white", "lgrey")
    g.ell(hx - 7, 12 + o + b, 2, 2.2, "white")
    g.ell(hx + 7, 12 + o + b, 2, 2.2, "lgrey")
    spray(g, q["spray"])
    return g


def snowball_face(mood):
    g = Grid()
    d = droop(mood)
    g.tri((7, 11), (8 - d, 1 + d), (13.5, 6 + d / 2), "white")
    g.tri((25, 11), (24 + d, 1 + d), (18.5, 6 + d / 2), "lgrey")
    g.tri((8.5, 8.5), (9 - d, 4 + d), (12, 6.5 + d / 2), "pink")
    g.tri((23.5, 8.5), (23 + d, 4 + d), (20, 6.5 + d / 2), "pink")
    g.ell(16, 28, 8, 3.5, "white", "lgrey")
    g.ell(16, 16, 10, 8.5, "white", "lgrey")
    for x in (5.5, 26.5):
        g.ell(x, 20, 2.5, 3, "white", "lgrey")
    g.rect(9, 26, 14, 1, "sky")
    g.ell(16, 28, 2, 2, "amber", "orange", "yellow")
    g.p(16, 29, "orange")
    eyes(g, 11, 19, 14, mood=mood)
    g.rect(15, 18, 2, 2, "ink")
    mouth(g, 20, mood)
    return g


# ---------- Penny: golden retriever, big, golden coat, feathery tail, blue collar ----------

def penny_road(q):
    g, q = edged(Grid()), pose(q)
    b, ln, o = q["bob"], q["lean"], 2
    # legs shaded down the outside, cream feathering trailing from the backs of the front pair
    for x, y, d in ((7 + ln // 2, 15 + o, q["fl"] + b), (22 + ln // 2, 15 + o, q["fr"] + b), (9, 26, q["bl"]),
                    (20, 26, q["br"])):
        g.rect(x, y + d, 3, 4, "amber")
        g.rect(x + (2 if x > 16 else 0), y + d, 1, 4, "orange")
    for x, d in ((6 + ln // 2, q["fl"] + b + o), (25 + ln // 2, q["fr"] + b + o)):
        g.rect(x, 17 + d, 1, 2, "cream")
    bx = 16 + ln // 2
    g.ell(bx, 20.5 + o + b, 7.5, 6, "amber", "orange", "yellow")
    # the wavy coat down the back
    for dx, dy in ((-4, 20), (2, 20), (-2, 23), (3, 24), (-5, 24)):
        g.rect(bx + dx, dy + o + b, 2, 1, "orange")
    g.rect(bx - 6, 16 + o + b, 12, 2, "blue")
    g.rect(bx - 6, 16 + o + b, 12, 1, "sky")
    if q["hackles"]:
        hackles(g, bx, 18 + o + b)
    # a long plumed tail swinging low behind, cream feathering fringing its tip; tucked, it is held in short
    tx = 16 + q["tail"] * 2
    if q["tuck"]:
        g.ell(tx, 26 + b, 2.5, 2.5, "orange")
        g.ell(tx, 25.5 + b, 1.5, 2, "amber", None, "yellow")
        for dx in (-1, 0, 1):
            g.p(tx + dx, 28 + b, "cream")
    else:
        g.ell(tx, 27 + b, 3, 3.8, "orange")
        g.ell(tx, 26.5 + b, 2, 3, "amber", None, "yellow")
        for dx, dy in ((-2, 29), (-1, 30), (0, 31), (1, 30), (2, 29)):
            g.p(tx + dx, dy + b, "cream")
    # a broad head with drop ears hanging over its sides, darker than the coat
    hx, hb = 16 + ln, b + q["reach"]
    if q["reach"]:
        # the neck stretched out between the collar and the head
        g.ell((hx + bx) / 2, 13.5 + o + b + q["reach"] / 2, 5.5, 3 - q["reach"] / 2, "amber", "orange", "yellow")
    g.ell(hx, 8.5 + o + hb, 6.5, 6, "amber", "orange", "yellow")
    g.ell(hx - 6, 11.5 + o + hb - q["ears"], 2.2, 4.5, "orange", "ochre")
    g.ell(hx + 6, 11.5 + o + hb - q["ears"] + q["twitch"], 2.2, 4.5, "orange", "ochre")
    if q["glance"]:
        glance(g, hx, 8.5 + o + hb, -1 if q["glance"] < 0 else 1)
    spray(g, q["spray"])
    return g


def penny_face(mood):
    g = Grid()
    d = droop(mood)
    g.ell(16, 28.5, 7.5, 3, "amber", "orange", "yellow")
    # long feathered ears hanging low, set apart from the head by a darker fold, wavy at the tips
    for x, s in ((5, -1), (27, 1)):
        g.ell(x + s * d / 2, 20 + d, 3.5, 7, "orange")
        g.ell(x + s * d / 2, 20 + d, 2.5, 6, "amber", "orange", "yellow")
        g.p(x + s * d / 2 - 2, 27 + d, "amber")
        g.p(x + s * d / 2 + 1, 27 + d, "amber")
    g.ell(16, 16, 9.5, 8.5, "amber", "orange", "yellow")
    g.ell(16, 21, 5.5, 4, "cream", "tan")
    g.rect(13, 9, 6, 1, "yellow")
    # the blue collar and a round tag
    g.rect(9, 26, 14, 2, "blue")
    g.rect(9, 26, 14, 1, "sky")
    g.ell(16, 29, 1.6, 1.6, "lgrey", "grey", "white")
    eyes(g, 11, 19, 14, mood=mood)
    g.rect(14, 18, 4, 2, "ink")
    g.p(14, 18, "dslate")
    mouth(g, 20, mood)
    return g


# ---------- shared features ----------

def droop(mood):
    """How far the ears sag, in pixels: perked when happy, relaxed when neutral, back when worried, flat when
    upset."""
    return {"happy": 0, "neutral": 1, "worried": 2, "upset": 3}[mood]


def puff(g, cx, cy, rx, ry, ring=False):
    """A clipped poodle pom-pom: apricot with a cream highlight and a cream curl on the shade. ring
    sets it apart from the puffs it is drawn over with a 1px skin2 ring."""
    if ring:
        g.ell(cx, cy, rx + 1, ry + 1, "skin2")
    g.ell(cx, cy, rx, ry, "skin1", "skin2", "cream")
    if rx >= 2 and ry >= 2:
        g.p(cx + rx * 0.4, cy + ry * 0.3, "cream")



def merle(g, cx, b, blots):
    """Red merle blotches on Archie's coat: each (dx, y, w, h) a BLOT[0] patch at x cx + dx, row y + b, with
    a BLOT[1] pixel ragging its lower-right corner."""
    for dx, y, w, h in blots:
        g.rect(cx + dx, y + b, w, h, BLOT[0])
        g.p(cx + dx + w, y + b + h - 1, BLOT[1])


def whirl(g, side, bx, b):
    """Archie's flourish: a white swoosh curving down his right (side > 0) or left flank from shoulder to hip,
    1px clear of the body at bx, trailing the twist; the road outline rings it."""
    if not side:
        return
    for dx, y in ((7, 14), (8, 15), (9, 16), (9, 17), (9, 18), (9, 19), (8, 20)):
        g.p(bx + (dx if side > 0 else -1 - dx), y + b, "white")


# Penny's hackles from the collar down: r rust spine, o ochre fur, y yellow tips lit from the top left.
HACKLES = ["yoroy", ".ory.", "yoroo", ".oro.", ".yro.", "..r.."]


def hackles(g, cx, y):
    """Penny's raised hackles: a ridge of fur standing up along her spine from the collar, bristling out to
    a jagged edge, and a tuft standing up past each shoulder."""
    for j, row in enumerate(HACKLES):
        for i, c in enumerate(row):
            if c != ".":
                g.p(cx - 3 + i, y + j, {"r": "rust", "o": "ochre", "y": "yellow"}[c])
    for x, side in ((cx - 8, -1), (cx + 7, 1)):
        g.p(x, y - 1, "ochre")
        g.p(x + side, y - 2, "ochre")


def glance(g, hx, hy, side):
    """Penny looking back over her left (side < 0) or right shoulder: the side of her muzzle and one eye show
    past the head's edge."""
    x = hx + side * 5
    g.ell(x + side, hy + 3, 2, 1.8, "cream", "tan")
    g.p(x + side * 2, hy + 2, "ink")
    g.p(x, hy, "ink")
    g.p(x - side, hy, "white")


def scent(g, hx, y, side):
    """A sniff of scent: a white puff curling up beside the nose on the left (side < 0) or right, held
    clear of the head; the road outline rings it."""
    if not side:
        return
    x = hx + (-5 if side < 0 else 2)
    for dx, dy in ((1, 1), (0, 0), (1, -1), (2, -2), (0, -4)):
        g.p(x + dx, y + dy, "white")


def sparkle(g, cx, cy, size):
    """Nugget's camera-ready glint: a yellow plus with a white core, arms 1px long at size 1 and 2px at
    size 2, drawn as lines so the small versions keep its shape."""
    if not size:
        return
    r = 1 if size < 1.5 else 2
    g.rect(cx - r, cy, 2 * r + 1, 1, "yellow")
    g.rect(cx, cy - r, 1, 2 * r + 1, "yellow")
    g.p(cx, cy, "white")


def spray(g, d):
    """The shake-off's water: droplets thrown d pixels out from both flanks, rising as they fly. Each is
    1px of cyan, with a white one on each side, so the road outline rings it and it holds on every road."""
    if not d:
        return
    for x, y, c in ((7, 14, "cyan"), (6, 20, "white"), (25, 12, "cyan"), (25, 18, "white"), (24, 23, "cyan")):
        side = -1 if x < 16 else 1
        g.p(x + side * d, y - d / 2, c)


def bow(g, cx, y, big=False, colours=("pink", "mauve")):
    """A bow: Duchess's is pink, Pierre's show ribbon mauve tied in purple. The knot and folds take the
    second colour."""
    c, knot = colours
    w = 4 if big else 3
    g.tri((cx - 1, y + 1), (cx - 1 - w, y - 1), (cx - 1 - w, y + 3), c)
    g.tri((cx + 1, y + 1), (cx + 1 + w, y - 1), (cx + 1 + w, y + 3), c)
    g.p(cx - 1 - w + 1, y + 2, knot)
    g.p(cx + w, y + 2, knot)
    g.rect(cx - 1, y, 2, 2, knot)


def eyes(g, lx, rx, y, iris=None, mood="happy"):
    wide = 3 if iris else 2
    for x in (lx, rx):
        if iris:
            g.rect(x, y, 3, 3, iris)
            g.p(x + 1, y + 1, "ink")
            g.p(x + 2, y + 2, "blue")
            g.p(x, y, "white")
        else:
            g.rect(x, y, 2, 2, "ink")
            g.p(x, y, "white")
    if mood == "happy":
        # pink cheeks under the eyes
        for x in (lx - 1, rx + wide - 1):
            g.rect(x, y + wide + 1, 2, 1, "pink")
    elif mood == "upset":
        # brows slant up toward the middle, and a tear runs from the left eye
        g.rect(lx - 2, y - 1, 2, 1, "ink")
        g.rect(lx, y - 2, wide, 1, "ink")
        g.rect(rx, y - 2, wide, 1, "ink")
        g.rect(rx + wide, y - 1, 2, 1, "ink")
        g.p(lx, y + wide, "cyan")
        g.p(lx, y + wide + 1, "sky")
    elif mood == "worried":
        # whale eyes: the pupils cut to the left with white beside them, short brows lifted at their inner
        # ends, and a bead of sweat on the left temple
        for x in (lx, rx):
            g.rect(x + wide, y, 1, 2, "white")
        g.p(lx, y - 2, "ink")
        g.p(lx + 1, y - 3, "ink")
        g.p(rx + wide - 1, y - 3, "ink")
        g.p(rx + wide, y - 2, "ink")
        g.p(lx - 2, y - 4, "white")
        g.rect(lx - 3, y - 3, 2, 1, "cyan")
        g.p(lx - 3, y - 2, "white")
        g.p(lx - 2, y - 2, "cyan")
        g.rect(lx - 3, y - 1, 2, 1, "sky")


def mouth(g, y, mood):
    """happy: a wide open grin with the tongue out; neutral: a closed line; worried: a small wobbly line;
    upset: a deep frown."""
    if mood == "happy":
        g.p(13, y, "ink")
        g.p(18, y, "ink")
        g.p(14, y + 1, "ink")
        g.p(17, y + 1, "ink")
        g.rect(15, y + 1, 2, 1, "dred")
        g.rect(15, y + 2, 2, 2, "pink")
        g.p(16, y + 3, "mauve")
    elif mood == "neutral":
        g.rect(14, y + 1, 4, 1, "ink")
    elif mood == "worried":
        for x, dy in ((14, 1), (15, 0), (16, 1), (17, 0)):
            g.p(x, y + dy, "ink")
    else:
        g.rect(15, y, 2, 1, "ink")
        g.p(14, y + 1, "ink")
        g.p(17, y + 1, "ink")
        g.p(13, y + 2, "ink")
        g.p(18, y + 2, "ink")


DOGS = {
    "duchess": (duchess_road, duchess_face),
    "nugget": (nugget_road, nugget_face),
    "zippy": (zippy_road, zippy_face),
    "pierre": (pierre_road, pierre_face),
    "biscuit": (biscuit_road, biscuit_face),
    "archie": (archie_road, archie_face),
    "snowball": (snowball_road, snowball_face),
    "penny": (penny_road, penny_face),
    "koda": (koda_road, koda_face),
}


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    for name, (road, face) in DOGS.items():
        yield f"dog-{name}", [(tag, [road(q).outlined() for q in poses], ms) for tag, poses, ms in road_tags(name)]
        yield f"face-dog-{name}", [(m, [face(m).outlined()], 1000) for m in face_tags(name)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/dogs", __doc__)
