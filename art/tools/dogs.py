#!/usr/bin/env python3
"""Draw the dogs in code and build their Aseprite sources and exports.

Each dog gets two sprites in Endesga 32 with coloured outlines:

- dog-<name>: the road sprite, seen from above and behind, its frame by size class (DOG_CLASS,
  SIZE_CLASS): big 58x58 (Koda the Alaskan Malamute, Snowball the Great Pyrenees, Penny the golden
  retriever mix), medium 48x48 (Archie, Biscuit, Pepe the miniature poodle) and small 38x38 (Duchess,
  Nugget, Zippy), the small dogs drawn DOG_ZOOM larger so they fill more of their frame. Its drawing
  functions take 32-unit design coordinates and run on a minis.Mini at road_scale(name) (the side / 32),
  which keeps 1px lines and single pixels 1px; features drawn pixel by pixel take trail()
  or their own map at that size (HACKLES_BIG), so they stay unbroken. Tags: walk (4
  frames, 150ms), react (4, 60ms: a startled hop), pull (4, 80ms, leaning right and
  scrabbling; the game mirrors it for left), tell (4, 125ms, the lean before a pull; the
  game adds the fx-bark pop), idle (4,
  standing while the walk pauses: a slow tail wag, a 1px breath and a twitch of the right ear)
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
- face-dog-<name>: the dog column face, a 32x32 frame, the face drawn FACE_SIDE big by size class (big 32,
  medium 29, small 26) and sat on the bottom edge. Tags: happy, neutral, upset, then the
  quirk's faces (QUIRK_FACES): face-dog-penny worried (ears back, whale eyes,
  a wobbly mouth and a sweat bead), while she is the only dog on the leash.

Usage:
  dogs.py preview OUT.png   contact sheet of every frame, scaled up
  dogs.py build             write art/dogs/*.aseprite, then export
                            public/art/sprites/*.png and *.json with Aseprite

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import K, Grid, edged, main, road_edge  # noqa: E402

# The road sprites are drawn on a 32-unit design grid and rasterized at ROAD_SIZE, ROAD_SCALE times bigger, on
# a minis.Mini that keeps 1px lines and single pixels 1px; their depth variants rasterize at ROAD_SCALE x the
# step. Faces stay 32x32 at 1x.
ROAD_SIZE = 48
ROAD_SCALE = ROAD_SIZE / 32

# Road poses. Walk is a 4-beat trot: diagonal leg pairs swap on beats 0 and 2,
# and the body bobs up on the passing beats 1 and 3, the ears lagging 1px behind it.
WALK = [
    dict(fl=-1, fr=1, bl=1, br=-1, bob=0, tail=-1),
    dict(fl=0, fr=0, bl=0, br=0, bob=-1, tail=0, flop=1),
    dict(fl=1, fr=-1, bl=-1, br=1, bob=0, tail=1),
    dict(fl=0, fr=0, bl=0, br=0, bob=-1, tail=0, flop=1),
]
# Startled by a hit: a spring up, the top of the jump with the legs tucked, the fall with the ears floating
# 1px behind, and the landing; 4 frames at 60ms.
REACT = [
    dict(fl=-2, fr=-2, bl=-1, br=-1, bob=-2, tail=0, ears=-1),
    dict(fl=-4, fr=-4, bl=-3, br=-3, bob=-3, tail=0, ears=-1),
    dict(fl=-2, fr=-2, bl=-2, br=-2, bob=-2, tail=0, ears=-1, flop=-1),
    dict(fl=-1, fr=-1, bl=-1, br=-1, bob=-1, tail=0, ears=-1),
]
# Straining at the leash, leaning right: the front paws scrabble one after the other with the hind legs
# dug in, the lean surging 2px and 3px and the tail flicking; 4 frames at 80ms.
PULL = [
    dict(fl=-1, fr=-1, bl=1, br=1, bob=0, tail=-2, lean=2),
    dict(fl=-2, fr=-1, bl=1, br=1, bob=0, tail=-2, lean=3),
    dict(fl=-1, fr=-2, bl=1, br=1, bob=0, tail=-1, lean=3),
    dict(fl=-2, fr=-2, bl=1, br=1, bob=0, tail=-2, lean=2),
]
# The tell before a pull: the dog leans toward what it wants, rising on its toes and settling, the tail
# wagging high and the right ear flicking; 4 frames at 125ms.
TELL = [
    dict(bob=0, tail=1, lean=1, ears=-1),
    dict(bob=-1, tail=2, lean=2, ears=-1),
    dict(bob=-1, tail=1, lean=2, ears=-1, twitch=-1),
    dict(bob=0, tail=2, lean=1, ears=-1),
]
# Standing still: the tail swings across and back, the body breathes 1px up over the middle two beats with
# the feet planted, and the right ear lifts 1px as the tail comes home.
IDLE = [
    dict(tail=-1),
    dict(tail=0, bob=-1),
    dict(tail=1, bob=-1),
    dict(tail=0, twitch=-1),
]
# Shaking off after an encounter hit: the head whips 2px and the body 1px left and right (lean, with the
# hind legs planted), the ears and tail flick against it, and droplets fly off on the middle two beats,
# spray pixels out from the flanks.
SHAKE = [
    dict(lean=-2, tail=1, ears=-1),
    dict(lean=2, tail=-2, ears=1, twitch=-1, spray=2),
    dict(lean=-2, tail=2, ears=-1, spray=3.5),
    dict(lean=2, tail=-1, ears=1),
]
# Idle and shake go last so the frame indices of the other tags stay put.
ROAD_TAGS = [("walk", WALK, 150), ("react", REACT, 60), ("pull", PULL, 80), ("tell", TELL, 125), ("idle", IDLE, 300),
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
    dict(hop=-3, reach=-1, fl=-3, fr=-3, bl=1, br=1, ears=1, streak=1),
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
    """Every pose key with its default. flop lets both ears lag down behind the head (positive is down), as
    they do on the walk's rising beats; twitch moves the right ear alone (negative is up); spray is how far
    the shake-off's droplets have flown from the flanks, 0 for none. The quirk keys: hop lifts the whole
    dog (negative is up); whirl draws a swoosh on the right (positive) or left (negative) flank; hackles
    raises a ridge of fur along the back; reach moves the head alone (negative is forward); tuck holds the
    tail in; glance turns the head back over the left (negative) or right shoulder; nose lowers the nose
    to the road (the head dips forward and shortens); perk flags the tail up; scent puffs scent beside the
    nose, left (negative) or right; sit sets the hindquarters down; tilt cocks the head left (negative) or
    right; glint is a sparkle's size over the head; streak draws motion lines under a leap. The small
    versions round them to whole pixels, so draws read whirl, glance, scent, sit, tilt and streak by their
    sign."""
    return dict(dict(fl=0, fr=0, bl=0, br=0, bob=0, tail=0, ears=0, flop=0, lean=0, twitch=0, spray=0, hop=0,
                     whirl=0, hackles=0, reach=0, tuck=0, glance=0, nose=0, perk=0, scent=0, sit=0, tilt=0, glint=0,
                     streak=0), **q)


# ---------- Koda: Alaskan Malamute, big, heavy, grey and white, blue eyes, orange harness ----------

def koda_road(q):
    g, q = edged(Grid()), pose(q)
    # o shifts the body down so the big head has headroom to hop and lean
    b, ln, o = q["bob"], q["lean"], 2
    # legs: thick and white, front pair beside the shoulders, back pair under the hips
    g.rect(6 + ln // 2, 15 + o + q["fl"] + b, 4, 4, "white")
    g.rect(22 + ln // 2, 15 + o + q["fr"] + b, 4, 4, "white")
    g.rect(8, 26 + q["bl"], 4, 4, "white")
    g.rect(20, 26 + q["br"], 4, 4, "white")
    # a heavy barrel: white flanks, a broad grey saddle, the harness across the shoulders
    bx = 16 + ln // 2
    g.ell(bx, 20.5 + o + b, 8.5, 6.5, "white", "lgrey")
    g.ell(bx, 19.5 + o + b, 6, 5.5, "slate", "dslate", "grey")
    g.rect(bx - 7, 16 + o + b, 14, 2, "orange")
    g.rect(bx - 7, 17 + o + b, 14, 1, "rust")
    g.rect(bx - 2, 20 + o + b, 4, 2, "orange")
    g.rect(bx - 1, 21 + o + b, 2, 1, "slate")
    g.ell(bx, 15 + o + b, 5.5, 1.5, "dslate")
    # the plumed tail curled over the hips: grey on top like the saddle, its white underside in the curl
    tx = 16 + q["tail"]
    g.ell(tx, 28 + b, 4, 2.2, "slate", "dslate", "grey")
    g.ell(tx + 0.5, 28.5 + b, 2, 1, "white")
    # a broad head with white cheeks and small ears set wide, their tips rounded
    hx = 16 + ln
    e = q["ears"] + q["flop"]
    tip = max(2, 2.5 + o + b + e)
    t = q["twitch"]
    g.tri((hx - 8, 7.5 + o + b), (hx - 6.5, tip), (hx - 3, 5 + o + b), "slate")
    g.tri((hx + 8, 7.5 + o + b + t), (hx + 6.5, tip + t), (hx + 3, 5 + o + b + t), "slate")
    g.ell(hx, 10 + o + b, 8.5, 6, "slate", "dslate", "grey")
    g.ell(hx - 7, 12.5 + o + b, 2, 2.2, "white")
    g.ell(hx + 7, 12.5 + o + b, 2, 2.2, "white", "lgrey")
    underside(g)
    spray(g, q["spray"])
    return g


def koda_face(mood):
    g = edged(Grid(), "ink", close=True)
    d = droop(mood)
    # a Malamute's ears: small, set wide on the broad skull, their tips rounded
    g.tri((5.5, 11), (7 - d, 3 + d), (12.5, 7 + d / 2), "slate")
    g.tri((26.5, 11), (25 + d, 3 + d), (19.5, 7 + d / 2), "slate")
    g.tri((7.5, 9), (8 - d, 5.5 + d), (11, 7.5 + d / 2), "pink")
    g.tri((24.5, 9), (24 + d, 5.5 + d), (21, 7.5 + d / 2), "pink")
    g.cel(16, 28, 7.5, 3.5, "lgrey", "grey", "white")
    g.cel(16, 16, 11, 8.5, "slate", "dslate", "grey")
    # white mask: brows, cheeks and muzzle
    g.cel(16, 20.5, 8, 5, "lgrey", "grey", "white")
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
    # tricolour: a tan coat, the black saddle across the back with tan showing round the rump and hips
    g.ell(bx, 22 + b, 6.5, 5.5, "ochre", "rust", "tan")
    g.ell(bx, 20.5 + b, 5, 3.6, "navy", "ink", "dslate")
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
    g.ell(hx - 5, 13 + b - q["ears"] + q["flop"], 2, 4.5, "rust", "dbrown")
    g.ell(hx + 5, 13 + b - q["ears"] + q["flop"] + q["twitch"], 2, 4.5, "rust", "dbrown")
    scent(g, hx, 5 + b - n, q["scent"])
    spray(g, q["spray"])
    return g


def biscuit_face(mood):
    g = edged(Grid(), "ink", close=True)
    g.cel(16, 28.5, 6.5, 3, "white", "lgrey")
    g.cel(16, 15.5, 9, 8, "ochre", "rust", "tan")
    g.rect(15, 7, 2, 9, "white")
    g.cel(16, 20.5, 6, 4.5, "white", "lgrey")
    d = droop(mood)
    g.cel(6.5 - d / 2, 18 + d, 3, 7.5, "rust", "dbrown")
    g.cel(25.5 + d / 2, 18 + d, 3, 7.5, "rust", "dbrown")
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
    g.ell(hx - 4.5, 18 + b - q["ears"] + q["flop"], 2.2, 4, "white", "lgrey")
    g.ell(hx + 4.5, 18 + b - q["ears"] + q["flop"] + q["twitch"], 2.2, 4, "lgrey")
    g.ell(hx, 15.5 + b, 5.5, 4.5, "white", "lgrey")
    bow(g, hx, 10 + b)
    underside(g)
    spray(g, q["spray"])
    return g


def duchess_face(mood):
    g = edged(Grid(), "ink", close=True)
    g.cel(16, 26.5, 6, 3.5, "white", "lgrey")
    d = droop(mood)
    g.cel(7.5 - d / 2, 19 + d, 3.5, 7.5, "white", "lgrey")
    g.cel(24.5 + d / 2, 19 + d, 3.5, 7.5, "lgrey", "grey")
    g.cel(16, 16, 8.5, 8, "white", "lgrey")
    g.cel(16, 20.5, 4.5, 3.5, "white", "lgrey")
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
    # the curly tail, coiled on top of the rump: a skin2 ring round the coat, a skin2 dot at its heart
    tx = 16 + q["tail"]
    g.ell(tx, 24.5 + b, 2.3, 1.9, "skin2")
    g.ell(tx - 0.2, 24.3 + b, 1.4, 1.1, "skin1")
    g.p(tx, 24.5 + b, "skin2")
    g.rect(bx - 4, 19 + b, 8, 1, "red")
    g.rect(bx - 1, 19 + b, 2, 2, "dred")
    # the head; cocked, it shifts 1px to that side, the ear on that side dropping and the other lifting
    tl = (q["tilt"] > 0) - (q["tilt"] < 0)
    hx = 16 + ln + tl
    g.ell(hx, 15 + b, 5.5, 4.5, "skin1", "skin2", "cream")
    g.ell(hx - 4.8, 12.3 + b - q["ears"] + q["flop"] - tl, 2, 1.7, "navy")
    g.ell(hx + 4.8, 12.3 + b - q["ears"] + q["flop"] + q["twitch"] + tl, 2, 1.7, "navy")
    g.rect(hx - 2, 13 + b, 4, 1, "skin2")
    sparkle(g, hx + 8, 9.5 + b, q["glint"])
    spray(g, q["spray"])
    return g


def nugget_face(mood):
    g = edged(Grid(), "ink", close=True)
    g.tri((8, 26), (24, 26), (16, 31), "red")
    g.p(13, 27, "white")
    g.p(18, 27, "white")
    g.p(16, 29, "white")
    g.cel(16, 16, 9.5, 8.5, "skin1", "skin2", "cream")
    d = droop(mood)
    g.tri((6 - d / 2, 13 + d), (8 - d, 7 + d), (12, 10), "navy")
    g.tri((26 + d / 2, 13 + d), (24 + d, 7 + d), (20, 10), "navy")
    g.rect(13, 9, 6, 1, "skin2")
    g.cel(16, 20.5, 5.5, 4, "navy", "ink", "dslate")
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
    # a short upright tail, white with a tan tip, standing clear of the rump
    g.rect(tx - 1, 27 + b, 2, 2, "white")
    g.rect(tx - 1, 28 + b, 2, 1, "ochre")
    # reaching, the head stretches forward of the collar on a white neck
    hx, hb = 16 + ln, b + q["reach"]
    if q["reach"]:
        g.ell(hx, 18 + b + q["reach"] / 2, 3.5, 2 - q["reach"] / 2, "white", "lgrey")
    g.rect(bx - 4, 19 + b, 8, 1, "red")
    g.ell(hx, 15 + hb, 5, 4.5, "white", "lgrey")
    g.ell(hx + 2, 14 + hb, 2.5, 2, "ochre")
    e = q["ears"] + q["flop"]
    g.tri((hx - 5, 14 + hb), (hx - 4, 10 + hb + e), (hx - 1.5, 12.5 + hb), "ochre")
    t = q["twitch"]
    g.tri((hx + 5, 14 + hb + t), (hx + 4, 10 + hb + e + t), (hx + 1.5, 12.5 + hb + t), "ochre")
    if q["streak"]:
        for x in (8, 23):
            g.rect(x, 25 + hop, 1, 4, "white")
    spray(g, q["spray"])
    return g


def zippy_face(mood):
    g = edged(Grid(), "ink", close=True)
    g.cel(16, 16, 9, 8, "white", "lgrey")
    g.cel(10.5, 12.5, 4, 4, "ochre", "rust", "tan")
    g.cel(21.5, 12.5, 4, 4, "ochre", "rust", "tan")
    d = droop(mood)
    g.tri((6, 12 + d), (9 - d, 5 + d), (13, 9), "ochre")
    g.tri((26, 12 + d), (23 + d, 5 + d), (19, 9), "ochre")
    g.tri((7.5, 11 + d), (9 - d, 7 + d), (11, 9), "rust")
    g.tri((24.5, 11 + d), (23 + d, 7 + d), (21, 9), "rust")
    g.cel(16, 21, 5, 3.5, "white", "lgrey")
    g.rect(9, 26, 14, 2, "red")
    g.rect(9, 27, 14, 1, "dred")
    eyes(g, 11, 19, 14, mood=mood)
    g.rect(15, 18, 2, 2, "ink")
    mouth(g, 20, mood)
    return g


# ---------- Pierre (Pepe): miniature poodle, medium, black with a white stripe, show-clip pom-poms ----------

# Pierre's coat: the curls (fill, shade, light), the shaved skin and the white stripe (fill, shade).
CURL = ("navy", "ink", "dslate")
SHAVED = ("slate", "dslate", "grey")
STRIPE = ("white", "lgrey")


def pierre_edge(c):
    """Pierre's outline: grey round the black coat, which has no fill that holds against Elm Avenue's road,
    and the road outline round everything else."""
    return K["grey"] if c in {K[n] for n in CURL + SHAVED} else road_edge(c)


def pierre_road(q):
    g, q = edged(Grid(), pierre_edge), pose(q)
    b, ln = q["bob"], q["lean"]
    # a miniature poodle: compact, the head and mane sat D units lower over short legs than a standard's
    D = 1
    # shaved legs, each with a pom-pom bracelet at the paw
    for x, d in ((10 + ln // 2, q["fl"]), (22 + ln // 2, q["fr"])):
        g.rect(x - 1, 19 + D + d + b, 2, 1, SHAVED[0])
        puff(g, x, 22 + D + d + b, 1.8, 1.6)
    for x, d in ((12, q["bl"]), (20, q["br"])):
        g.rect(x - 1, 26 + d, 2, 2, SHAVED[0])
        puff(g, x, 28.5 + d, 2, 1.6)
    # shaved hindquarters behind a curly mane over the shoulders
    bx = 16 + ln // 2
    g.ell(bx, 24 + b, 3.8, 3.5, *SHAVED)
    puff(g, bx, 18.5 + D + b, 5, 3.2)
    # a thin tail held up with a pom-pom on the end
    tx = 16 + q["tail"]
    g.rect(tx, 25 + b, 1, 2, SHAVED[0])
    puff(g, tx + 0.5, 28 + b, 2, 1.8)
    # ear puffs hanging behind a round topknot
    hx = 16 + ln
    puff(g, hx - 5, 14.5 + D + b - q["ears"] + q["flop"], 2, 3.5, ring=True)
    puff(g, hx + 5, 14.5 + D + b - q["ears"] + q["flop"] + q["twitch"], 2, 3.5, ring=True)
    puff(g, hx, 10.5 + D + b, 4, 3.8, ring=True)
    # the white stripe from the top of the topknot down the neck, the mane and the back to the tail's tip;
    # leaning, the head moves further than the body, so the neck steps it across halfway
    g.rect(hx - 1, 7 + D + b, 2, 7, STRIPE[0])
    g.rect((hx + bx) // 2 - 1, 13 + D + b, 2, 2, STRIPE[0])
    g.rect(bx - 1, 15 + D + b, 2, 10 - D, STRIPE[0])
    g.rect(bx, 15 + D + b, 1, 10 - D, STRIPE[1])
    g.rect(tx, 25 + b, 1, 2, STRIPE[0])
    g.ell(tx + 0.5, 28.8 + b, 1.2, 1, STRIPE[0])
    # a small mauve show bow tied in purple, pinned to the topknot's top right
    g.rect(hx, 5 + D + b, 2, 3, "mauve")
    g.rect(hx + 3, 5 + D + b, 2, 3, "mauve")
    g.p(hx + 2, 6 + D + b, "purple")
    g.p(hx, 5 + D + b, "pink")
    despeckle(g, CURL + SHAVED)
    spray(g, q["spray"])
    return g


def pierre_face(mood):
    g = edged(Grid(), "ink", close=True)
    d = droop(mood)
    g.cel(16, 28.5, 6.5, 3, *CURL)
    # long ears and the topknot in curly clumps, each cel shaded on its own
    for x, s in ((7, -1), (25, 1)):
        for y in (15, 22):
            g.cel(x + s * d / 2, y + d, 3.5, 4, CURL[0], CURL[1], CURL[2] if s < 0 else None)
    # the shaved face, a short shaved muzzle lighter still
    g.cel(16, 17, 7, 7, *SHAVED)
    g.cel(11, 9, 4, 3.5, *CURL)
    g.cel(21, 9, 4, 3.5, *CURL)
    g.cel(16, 6.5, 5, 4, *CURL)
    g.cel(16, 22, 4, 3.5, "grey", "slate", "lgrey")
    # the white stripe from the brow up over the topknot, under the show bow
    g.rect(15, 3, 2, 11, STRIPE[0])
    g.rect(16, 4, 1, 10, STRIPE[1])
    bow(g, 16, 4, big=True, colours=("mauve", "purple"))
    eyes(g, 12, 19, 15, mood=mood)
    g.rect(15, 19, 2, 2, "ink")
    mouth(g, 22, mood)
    return g


# ---------- Archie: Australian Shepherd, medium, red merle, one blue eye, red bandana ----------

# The coat (fill, shade, light), the merle patches and the ears (ear, folded tip).
COAT = ("skin2", "brown", "skin1")
BLOT = ("dbrown",)
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
    # a cinnamon coat in a few liver merle patches, a fluffy white ruff at the nape. As wide as Biscuit,
    # longer in the coat
    bx = 16 + ln // 2
    g.ell(bx, 21.5 + b, 7, 6, *COAT)
    merle(g, bx, b, ((-3.5, 21, 2, 1.5), (3, 24, 2.2, 1.5), (2.5, 19.6, 1.3, 1)))
    g.ell(bx, 16.5 + b, 6, 2, "white", "lgrey")
    # the red bandana's knot at the nape, its two ends flaring down the back
    g.rect(bx - 5, 17 + b, 10, 1, "red")
    g.rect(bx - 1, 16 + b, 2, 2, "dred")
    for side in (-1, 1):
        x = bx + (side - 1) // 2
        trail(g, [(x + side, 18 + b), (x + 2 * side, 19 + b)], "red")
    # a short bobtail
    tx = 16 + q["tail"]
    g.ell(tx, 27.5 + b, 2, 1.6, *COAT)
    # ears set high and tipped forward, the folded tips darker
    hx = 16 + ln
    e, t = q["ears"] + q["flop"], q["twitch"]
    g.tri((hx - 5.5, 10 + b), (hx - 5, 5 + b + e), (hx - 1.5, 7 + b), EAR[0])
    g.tri((hx + 5.5, 10 + b + t), (hx + 5, 5 + b + e + t), (hx + 1.5, 7 + b + t), EAR[0])
    g.rect(hx - 6, 5 + b + e, 2, 1, EAR[1])
    g.rect(hx + 4, 5 + b + e + t, 2, 1, EAR[1])
    g.ell(hx, 11.5 + b, 5.5, 5, *COAT)
    merle(g, hx, b, ((-2.5, 9.5, 2, 1.6), (2.5, 13, 1.6, 1.3)))
    spray(g, q["spray"])
    whirl(g, q["whirl"], bx, b)
    return g


def archie_face(mood):
    g = edged(Grid(), "ink", close=True)
    d = droop(mood)
    # ears set high, the tips folding forward and out
    g.tri((7, 12), (8 - d, 3 + d), (13.5, 7 + d / 2), EAR[0])
    g.tri((25, 12), (24 + d, 3 + d), (18.5, 7 + d / 2), EAR[0])
    g.tri((8 - d, 3 + d), (4 - d, 6 + d), (9 - d, 6 + d), EAR[1])
    g.tri((24 + d, 3 + d), (28 + d, 6 + d), (23 + d, 6 + d), EAR[1])
    # a white ruff, the red bandana tied over it
    g.cel(16, 27, 9, 3.5, "white", "lgrey")
    g.tri((8, 25), (24, 25), (16, 31.5), "red")
    g.tri((16, 25), (24, 25), (16, 31.5), "dred")
    g.rect(8, 25, 16, 1, "dred")
    g.cel(16, 16, 9.5, 8.5, *COAT)
    # merle in three flat patches: over the blue eye, across the skull and on the near cheek
    g.cel(11, 14, 4, 3.5, BLOT[0])
    g.cel(21.5, 10.5, 3, 2.2, BLOT[0])
    g.cel(23.5, 20.5, 1.8, 1.5, BLOT[0])
    g.rect(15, 7, 2, 9, "white")
    # copper brows and cheeks
    g.p(10, 11, "ochre")
    g.p(21, 11, "ochre")
    g.rect(9, 18, 2, 2, "ochre")
    g.rect(22, 18, 2, 2, "ochre")
    g.cel(16, 20.5, 5, 3.5, "white", "lgrey")
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


# ---------- Snowball: Great Pyrenees, big, giant white fluff, collar with a bell ----------

def snowball_road(q):
    g, q = edged(Grid()), pose(q)
    b, ln, o = q["bob"], q["lean"], 2
    g.rect(6 + ln // 2, 15 + o + q["fl"] + b, 4, 4, "white")
    g.rect(22 + ln // 2, 15 + o + q["fr"] + b, 4, 4, "white")
    g.rect(8, 26 + q["bl"], 4, 4, "lgrey")
    g.rect(20, 26 + q["br"], 4, 4, "lgrey")
    # a giant fluffy body, its coat bunched into tufts round the edge
    bx = 16 + ln // 2
    g.ell(bx, 20.5 + o + b, 9, 6.5, "white", "lgrey")
    for dx, dy in ((-8, -1), (8, -1), (-7, 3), (7, 3), (-4, 6), (4, 6)):
        g.ell(bx + dx, 20.5 + o + b + dy, 2.2, 2.2, "white", "lgrey")
    g.rect(bx - 7, 16 + o + b, 14, 1, "sky")
    # the bell hangs from the collar's right end
    g.rect(bx + 5, 17 + o + b, 2, 2, "amber")
    g.p(bx + 6, 18 + o + b, "orange")
    # the plumed tail carried up over the back
    tx = 16 + q["tail"]
    g.ell(tx, 23.5 + o + b, 4.5, 3.5, "white", "lgrey")
    g.ell(tx - 1, 23 + o + b, 2.5, 1.5, "lgrey")
    # a broad round head, its drop ears hanging at the sides, marked a soft badger cream
    hx = 16 + ln
    e, t = -q["ears"] + q["flop"], q["twitch"]
    g.ell(hx, 9.5 + o + b, 7.5, 6.5, "white", "lgrey")
    g.ell(hx - 7.5, 11.5 + o + b + e, 2.3, 3.8, "cream", "tan")
    g.ell(hx + 7.5, 11.5 + o + b + e + t, 2.3, 3.8, "cream", "tan")
    underside(g)
    spray(g, q["spray"])
    return g


def snowball_face(mood):
    g = edged(Grid(), "ink", close=True)
    d = droop(mood)
    g.cel(16, 28, 9, 3.5, "white", "lgrey")
    # a Great Pyrenees' broad head in a thick ruff, its drop ears hanging flat at the sides, marked badger
    # cream; they swing out and sag as the dog loses heart
    for x in (5, 27):
        g.cel(x, 21, 2.8, 3.2, "white", "lgrey")
    g.cel(16, 15.5, 10, 8.5, "white", "lgrey")
    for sgn in (-1, 1):
        inlay(g, "tan", lambda t, sgn=sgn: t.cel(16 + sgn * (9 + d / 2), 14 + d, 2.6, 5, "cream", "tan"))
    g.rect(9, 26, 14, 1, "sky")
    g.cel(16, 28, 2, 2, "amber", "orange", "yellow")
    g.p(16, 29, "orange")
    eyes(g, 11, 19, 14, mood=mood)
    g.rect(15, 18, 2, 2, "ink")
    mouth(g, 20, mood)
    return g


# ---------- Penny: golden retriever with a Labrador build, big, golden coat, otter tail, blue collar ----------

# Penny's coat, one ramp cel shaded: base, shade, light.
GOLD = ("amber", "orange", "yellow")


def penny_road(q):
    g, q = edged(Grid()), pose(q)
    b, ln, o = q["bob"], q["lean"], 2
    # solid legs, each shaded down its outer side
    for x, y, d in ((7 + ln // 2, 15 + o, q["fl"] + b), (22 + ln // 2, 15 + o, q["fr"] + b), (9, 26, q["bl"]),
                    (20, 26, q["br"])):
        g.rect(x, y + d, 3, 4, GOLD[0])
        g.rect(x + (2 if x > 16 else 0), y + d, 1, 4, GOLD[1])
    # a deep, broad chest and barrel
    bx = 16 + ln // 2
    gold(g, bx, 20.5 + o + b, 7.5, 6, 2.3)
    g.rect(bx - 6, 16 + o + b, 12, 2, "blue")
    g.rect(bx - 6, 16 + o + b, 12, 1, "sky")
    if q["hackles"]:
        hackles(g, bx, 18 + o + b)
    # a thick otter tail laid over the rump in the shade colour, tapering to a blunt tip and swinging from
    # its root, lit down its left side; tucked, it is clamped short and still
    tuck = bool(q["tuck"])
    tx, ty = 16 + (0 if tuck else q["tail"] * 2), (28 if tuck else 31) + b
    for (l, r, tl, tr), c in (((13, 19, -1.5, 1.5), GOLD[1]), ((13, 14.5, -1.5, -0.5), GOLD[0])):
        g.tri((l, 22 + b), (r, 22 + b), (tx + tr, ty), c)
        g.tri((l, 22 + b), (tx + tl, ty), (tx + tr, ty), c)
    # a broad skull with short flat drop ears at its sides, in the shade colour
    hx, hb = 16 + ln, b + q["reach"]
    if q["reach"]:
        # the neck stretched out between the collar and the head
        gold(g, (hx + bx) / 2, 13.5 + o + b + q["reach"] / 2, 5.5, 3 - q["reach"] / 2)
    gold(g, hx, 9.5 + o + hb, 6.5, 4.5, 2.8)
    for x, t in ((hx - 6.5, 0), (hx + 6.5, q["twitch"])):
        g.blob(x, 10.5 + o + hb - q["ears"] + q["flop"] + t, 1.8, 2.5, GOLD[1], power=3)
    if q["glance"]:
        glance(g, hx, 8.5 + o + hb, -1 if q["glance"] < 0 else 1)
    spray(g, q["spray"])
    return g


def gold(g, cx, cy, rx, ry, power=2.6):
    """A rounded mass of Penny's coat: the base lit along its top left, over its shade cast 1px down and
    right, so the shade is a thin rim and not a diagonal plane that would swallow the ears and tail."""
    g.blob(cx + 0.8, cy + 0.8, rx, ry, GOLD[1], power=power)
    g.blob(cx, cy, rx, ry, GOLD[0], None, GOLD[2], power=power)


def penny_face(mood):
    g = edged(Grid(), "ink", close=True)
    d = droop(mood)
    g.cel(16, 28.5, 8.5, 3.5, *GOLD)
    # a broad, blocky head
    g.cel(16, 14.5, 10, 8.5, *GOLD, power=2.5)
    # short flat drop ears set at head height and hanging beside the cheeks; they sag and swing out as she
    # loses heart
    for s in (-1, 1):
        x = 16 + s * 9 + s * d / 2

        def ear(t, x=x, s=s):
            t.tri((x - s * 3.5, 8 + d), (x + s * 2, 8.5 + d), (x + s * 1, 19 + d), GOLD[1])
            t.tri((x - s * 3.5, 8 + d), (x - s * 1.5, 18 + d), (x + s * 1, 19 + d), GOLD[1])

        inlay(g, "dbrown", ear)
    # a square muzzle, a shade lighter than the coat, set off from the brow by a clear stop
    inlay(g, GOLD[1], lambda t: t.cel(16, 20.5, 5.5, 4, GOLD[2], GOLD[0], power=3.2))
    # the blue collar and a round tag
    g.rect(8, 26, 16, 2, "blue")
    g.rect(8, 26, 16, 1, "sky")
    g.cel(16, 29, 1.6, 1.6, "lgrey", "grey", "white")
    eyes(g, 11, 19, 14, mood=mood)
    g.rect(14, 18, 4, 2, "ink")
    g.p(14, 18, "dslate")
    mouth(g, 20, mood)
    return g


def inlay(g, line, draw):
    """draw on a blank grid the size of g, then lay what it drew over g, ringed in line wherever it meets
    what g already holds: an inner line two ramp steps darker where a shape crosses the figure, while its
    open edges take the grid's outline."""
    t = Grid(g.w, g.h)
    draw(t)
    shape = {(x, y) for y in range(g.h) for x in range(g.w) if t.px[y][x]}
    ring = {(x + dx, y + dy) for x, y in shape for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0))} - shape
    for x, y in ring:
        if 0 <= x < g.w and 0 <= y < g.h and g.px[y][x]:
            g.p(x, y, line)
    for x, y in shape:
        g.px[y][x] = t.px[y][x]


# ---------- shared features ----------

def droop(mood):
    """How far the ears sag, in pixels: perked when happy, relaxed when neutral, back when worried, flat when
    upset."""
    return {"happy": 0, "neutral": 1, "worried": 2, "upset": 3}[mood]


def puff(g, cx, cy, rx, ry, ring=False):
    """A clipped poodle pom-pom in Pierre's curls (CURL), shaded on its lower right, with a highlight only
    on a puff big enough to hold one as a shape, so the coat carries no single-pixel texture. ring sets it
    apart from the puffs it is drawn over with a 1px ring in the shade."""
    if ring:
        g.ell(cx, cy, rx + 1, ry + 1, CURL[1])
    g.ell(cx, cy, rx, ry, CURL[0], CURL[1], CURL[2] if min(rx, ry) >= 3 else None)



def merle(g, cx, b, blots):
    """Red merle on Archie's coat: each (dx, y, rx, ry) a flat, rounded BLOT[0] patch centred at x cx + dx,
    row y + b, with no single-pixel ragging, so the coat reads as a few patches at road scale."""
    for dx, y, rx, ry in blots:
        g.blob(cx + dx, y + b, rx, ry, BLOT[0])


def whirl(g, side, bx, b):
    """Archie's flourish: a white swoosh curving down his right (side > 0) or left flank from shoulder to hip,
    1px clear of the body at bx, trailing the twist; the road outline rings it."""
    if not side:
        return
    trail(g, [(bx + (dx if side > 0 else -1 - dx), y + b)
              for dx, y in ((7, 14), (8, 15), (9, 16), (9, 17), (9, 18), (9, 19), (8, 20))], "white")


# Penny's hackles from the collar down: r rust spine, o orange fur, y yellow tips lit from the top left.
# HACKLES is the design grid's; HACKLES_BIG gives the map drawn in the grid's own pixels from each scale up,
# its spine on the column of the last row's r.
HACKLES = ["yoroy", ".ory.", "yoroo", ".oro.", ".yro.", "..r.."]
HACKLES_BIG = (
    (1.5, ["y.yyroo.o", "yyyoroooo", ".yyoroo..", "yyyorooo.", ".yyoroooo", "..yoroo..", ".yyorooo.", "..yoro...",
           "...yro...", "...oro...", "....r...."]),
    (1, ["y.yro.o", "yyoroo.", ".yoroo.", "yyorooo", ".yoro..", "..yro..", "..oro..", "...r..."]),
)
HACKLE_INK = {"r": "rust", "o": "orange", "y": "yellow"}


def scale_of(g):
    """The scale g draws the design grid at: a minis.Mini's s, 1 for a plain Grid."""
    return getattr(g, "s", 1)


def trail(g, pts, c):
    """A 1px trail of pixels at the design points pts, in order. Drawn bigger, a step between two touching
    points can open a 1px gap; the gap is filled so the trail stays unbroken and 1px wide."""
    s = scale_of(g)
    if s <= 1:
        for x, y in pts:
            g.p(x, y, c)
        return
    last = None
    for x, y in pts:
        here = (math.floor((x + 0.5) * s), math.floor((y + 0.5) * s))
        if last and max(abs(x - last[0][0]), abs(y - last[0][1])) <= 1:
            (ax, ay), (bx, by) = last[1], here
            n = max(abs(bx - ax), abs(by - ay))
            for t in range(1, n):
                g.g.p(ax + round((bx - ax) * t / n), ay + round((by - ay) * t / n), c)
        g.g.p(*here, c)
        last = ((x, y), here)


def hackles(g, cx, y):
    """Penny's raised hackles: a ridge of fur standing up along her spine from the collar, bristling out to
    a jagged edge, and a tuft standing up past each shoulder. Drawn bigger, the ridge is HACKLES_BIG's map
    for the scale, in the grid's own pixels."""
    s = scale_of(g)
    if s > 1:
        rows = next(m for least, m in HACKLES_BIG if s >= least)
        x0, y0 = math.floor((cx - 1 + 0.5) * s) - rows[-1].index("r"), math.floor((y + 0.5) * s)
        for j, row in enumerate(rows):
            for i, c in enumerate(row):
                if c != ".":
                    g.g.p(x0 + i, y0 + j, HACKLE_INK[c])
    else:
        for j, row in enumerate(HACKLES):
            for i, c in enumerate(row):
                if c != ".":
                    g.p(cx - 3 + i, y + j, HACKLE_INK[c])
    for x, side in ((cx - 8, -1), (cx + 7, 1)):
        trail(g, ((x, y - 1), (x + side, y - 2)), "orange")


def glance(g, hx, hy, side):
    """Penny looking back over her left (side < 0) or right shoulder: the side of her muzzle and one eye show
    past the head's edge."""
    x = hx + side * 5
    g.ell(x + side, hy + 3, 2, 1.8, "yellow", "amber")
    g.p(x + side * 2, hy + 2, "ink")
    g.p(x, hy, "ink")
    g.p(x - side, hy, "white")


def scent(g, hx, y, side):
    """A sniff of scent: a white puff curling up beside the nose on the left (side < 0) or right, held
    clear of the head; the road outline rings it."""
    if not side:
        return
    x = hx + (-5 if side < 0 else 2)
    trail(g, [(x + dx, y + dy) for dx, dy in ((1, 1), (0, 0), (1, -1), (2, -2), (0, -4))], "white")


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
    for x, y, c in ((9, 14, "cyan"), (9, 20, "white"), (22, 12, "cyan"), (22, 18, "white"), (21, 23, "cyan")):
        side = -1 if x < 16 else 1
        g.p(x + side * d, y - d / 2, c)


# A white or light grey coat's underside, one ramp step darker: white to lgrey, lgrey to grey.
UNDERSIDE = {"ffffff": "c0cbdc", "c0cbdc": "8b9bb4"}


def underside(g):
    """Darken a white or grey coat's lower-right silhouette one ramp step: every coat pixel with open road
    below it or to its right. The coat keeps its colour, and its shade sits a step darker,
    so a white dog keeps its mass on the light roads. Works on the grid a small version
    draws to as well."""
    px = getattr(g, "g", g).px
    h, w = len(px), len(px[0])
    edge = [(x, y) for y in range(h) for x in range(w) if px[y][x] in UNDERSIDE and (
        y + 1 >= h or x + 1 >= w or not px[y + 1][x] or not px[y][x + 1])]
    for x, y in edge:
        px[y][x] = UNDERSIDE[px[y][x]]


def despeckle(g, colours):
    """Fill every lone pixel of the given coat colours, one that none of its four opaque neighbours shares,
    with its neighbours' most common colour, so overlapping puffs leave no single-pixel texture to shimmer at
    road scale. Works on the grid a small version draws to as well."""
    px = getattr(g, "g", g).px
    h, w = len(px), len(px[0])
    coat = {K[c] for c in colours}
    lone = []
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            nb = [px[y - 1][x], px[y + 1][x], px[y][x - 1], px[y][x + 1]]
            if px[y][x] in coat and all(nb) and px[y][x] not in nb:
                lone.append((x, y, max(nb, key=nb.count)))
    for x, y, c in lone:
        px[y][x] = c


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


# Each dog's road sprite side, by its size class: big 58, medium ROAD_SIZE (48) and small 38, about 1.2x, 1x
# and 0.8x.
SIZE_CLASS = {"big": 58, "medium": ROAD_SIZE, "small": 38}
DOG_CLASS = {"koda": "big", "snowball": "big", "penny": "big", "archie": "medium", "biscuit": "medium",
             "pierre": "medium", "duchess": "small", "nugget": "small", "zippy": "small"}
DOG_SIZE = {name: SIZE_CLASS[DOG_CLASS[name]] for name in DOGS}
# How much bigger a dog is drawn inside its frame: the small dogs fill more of theirs, about 24px wide at
# full size.
DOG_ZOOM = {"duchess": 1.3, "nugget": 1.3, "zippy": 1.3}


# How much of its 32px photo a dog's face fills, by size class, sat on the bottom edge: the size difference
# shows, less than on the road.
FACE_SIDE = {"big": 32, "medium": 29, "small": 26}


def padded(px, side):
    """Frame rows px set in a side x side frame, centred across and on its bottom edge."""
    h, w = len(px), len(px[0])
    left = (side - w) // 2
    return [[None] * side for _ in range(side - h)] + [[None] * left + row + [None] * (side - w - left) for row in px]


def face_frame(face, mood, side):
    """face(mood)'s outlined rows, drawn at side over 32 of its 32-unit design and set on the bottom edge of a
    32x32 frame."""
    import minis

    if side == 32:
        return face(mood).outlined()
    here = sys.modules[__name__]
    return padded(minis.small(here, side / 32, face, mood).outlined(), 32)


def road_scale(name):
    """The scale dog-<name>'s 32-unit design is drawn at: its DOG_SIZE over 32."""
    return DOG_SIZE.get(name, ROAD_SIZE) / 32


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    import minis

    here = sys.modules[__name__]
    for name, (road, face) in DOGS.items():
        yield f"dog-{name}", [(tag, minis.dog_frames(road, poses, road_scale(name), here, DOG_ZOOM.get(name, 1)), ms)
                              for tag, poses, ms in road_tags(name)]
        yield f"face-dog-{name}", [(m, [face_frame(face, m, FACE_SIDE[DOG_CLASS[name]])], 1000) for m in face_tags(name)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/dogs", __doc__)
