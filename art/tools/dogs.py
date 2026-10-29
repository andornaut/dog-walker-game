#!/usr/bin/env python3
"""Draw the dogs in code and build their Aseprite sources and exports.

Each dog gets two sprites in Endesga 32: a road sprite with coloured outlines and an ink-outlined face:

- dog-<name>: the road sprite, seen from above and behind, its frame by size class (DOG_CLASS,
  SIZE_CLASS): large 54x54 (Kilo the Alaskan Malamute, Sequoia the Great Pyrenees, Penny the golden
  retriever mix), medium 48x48 (Archie, Biscuit, Pepe the miniature poodle) and small 38x38 (Buddy,
  Duchess, Reggie), the large dogs drawn DOG_ZOOM narrower and the small dogs DOG_ZOOM larger (more down
  than across). Its drawing functions take 32-unit design coordinates and run on a minis.Mini at
  road_scale(name) (the side / 32), which keeps 1px lines and single pixels 1px; features drawn pixel by
  pixel take trail(), so they stay unbroken. Tags: walk (4
  frames, 150ms), react (4, 60ms: a startled hop), pull (4, 80ms, leaning right and scrabbling; the game
  mirrors it for left), tell (4, 125ms, the lean before a pull, head and shoulders pitched toward it and the
  neck stretched; the game adds the fx-bark pop), idle (4, 300ms, standing while the walk pauses: a slow
  tail wag, a 1px breath and a twitch of the right ear) and shake (4, 60ms, a quick shake-off after an
  encounter hit, throwing droplets).
- face-dog-<name>: the dog's face on its card and in the picker, a 32x32 frame, the face drawn FACE_SIDE
  big and sat on the bottom edge, the size classes one even step apart and the large dogs zoomed to fill it. Tags: happy, neutral,
  upset.

Usage:
  dogs.py preview OUT.png   every frame on the zone roads, scaled up
  dogs.py build             write art/dogs/*.aseprite, then export
                            public/art/sprites/*.png and *.json with Aseprite

Run from the repository root. A build overwrites the .aseprite sources, so
hand edits to them belong in this file instead. Shared tooling is in pixel.py.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import Grid, K, edged, main, raster, road_edge, scale_of  # noqa: E402
from road import rim  # noqa: E402

# ROAD_SIZE is the medium dogs' frame side. Each dog's 32-unit design is rasterized at road_scale(name)
# (DOG_SIZE / 32) on a minis.Mini that keeps 1px lines and single pixels 1px; its depth variants at that
# times the step. Faces are 32x32 frames, the face drawn at FACE_SIDE / 32.
ROAD_SIZE = 48

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
# dug in, the lean surging 2 and 3 units with the shoulders following (pitch) and the neck stretched forward
# (reach), as in the tell, and the tail flicking; 4 frames at 80ms.
PULL = [
    dict(fl=-1, fr=-1, bl=1, br=1, bob=0, tail=-2, lean=2, pitch=1, reach=1),
    dict(fl=-2, fr=-1, bl=1, br=1, bob=0, tail=-2, lean=3, pitch=1, reach=1),
    dict(fl=-1, fr=-2, bl=1, br=1, bob=0, tail=-1, lean=3, pitch=1, reach=1),
    dict(fl=-2, fr=-2, bl=1, br=1, bob=0, tail=-2, lean=2, pitch=1, reach=1),
]
# The tell before a pull, and the strain a still picture holds on its first frame: the dog pitches toward
# what it wants, the head 2 and 3 units across with the shoulders following (pitch) and the neck stretched
# forward (reach), rising on its toes and settling, the tail wagging high and the right ear flicking; 4
# frames at 125ms.
TELL = [
    dict(bob=0, tail=1, lean=2, pitch=1, reach=1, ears=-1),
    dict(bob=-1, tail=2, lean=3, pitch=1, reach=1, ears=-1),
    dict(bob=-1, tail=1, lean=3, pitch=1, reach=1, ears=-1, twitch=-1),
    dict(bob=0, tail=2, lean=2, pitch=1, reach=1, ears=-1),
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
# The tags that lean toward a pull. Their depth steps settle apart from the rest (pixel.depth_settled), so a
# change to a lean never moves the cuts in the other tags.
LEAN_TAGS = ("pull", "tell")
# Idle and shake follow the first four tags.
ROAD_TAGS = [("walk", WALK, 150), ("react", REACT, 60), ("pull", PULL, 80), ("tell", TELL, 125), ("idle", IDLE, 300),
             ("shake", SHAKE, 60)]
FACE_TAGS = ["happy", "neutral", "upset"]


def pose(q):
    """Every pose key with its default. flop lets both ears lag down behind the head (positive is down), as
    they do on the walk's rising beats; twitch moves the right ear alone (negative is up); spray is how far
    the shake-off's droplets have flown from the flanks, 0 for none. lean bends the head across and the
    shoulders and front legs half as far; pitch moves the head, shoulders and front legs further across
    together, over the planted hind legs; reach lifts the head up the screen, away from the walker, as a dog
    stretches its neck toward what it wants."""
    return dict(dict(fl=0, fr=0, bl=0, br=0, bob=0, tail=0, ears=0, flop=0, lean=0, twitch=0, spray=0, pitch=0,
                     reach=0), **q)


# ---------- Kilo: Alaskan Malamute, large, grey and white, blue eyes, orange harness ----------

def kilo_road(q):
    g, q = edged(Grid()), pose(q)
    # o shifts the body down so the big head has headroom to lean
    b, ln, o = q["bob"], q["lean"], 2
    # the shoulders and front legs follow the head half as far, and the pitch carries both
    sw = ln // 2 + q["pitch"]
    # legs: thick and white, the front pair tucked under the chest, peeking out at its sides, the back pair
    # under the hips
    g.rect(8 + sw, 16 + o + q["fl"] + b, 3, 4, "white")
    g.rect(21 + sw, 16 + o + q["fr"] + b, 3, 4, "white")
    g.rect(8, 26 + q["bl"], 4, 4, "white")
    g.rect(20, 26 + q["br"], 4, 4, "white")
    # a heavy barrel: white flanks, a broad grey saddle, the harness across the shoulders
    bx = 16 + sw
    g.cel(bx, 20.5 + o + b, 8.5, 6.5, "white", "lgrey")
    g.cel(bx, 19.5 + o + b, 6, 5.5, "slate", "dslate", "grey")
    g.rect(bx - 7, 16 + o + b, 14, 2, "orange")
    g.rect(bx - 7, 17 + o + b, 14, 1, "rust")
    g.ell(bx, 15 + o + b, 5.5, 1.5, "dslate")
    # the plumed tail curled over the hips: grey on top like the saddle, its white underside in the curl
    tx = 16 + q["tail"]
    g.cel(tx, 28 + b, 4, 2.2, "slate", "dslate", "grey")
    g.ell(tx + 0.5, 28.5 + b, 2, 1, "white")
    # a broad head with white cheeks at its sides, which set his ±15 outline, and small ears set wide, their tips rounded
    hx, hb = 16 + ln + q["pitch"], b - q["reach"]
    e = q["ears"] + q["flop"]
    tip = max(2, 2.5 + o + hb + e)
    t = q["twitch"]
    g.tri((hx - 8, 7.5 + o + hb), (hx - 6.5, tip), (hx - 3, 5 + o + hb), "slate")
    g.tri((hx + 8, 7.5 + o + hb + t), (hx + 6.5, tip + t), (hx + 3, 5 + o + hb + t), "slate")
    g.cel(hx, 10 + o + hb, 8.5, 6, "slate", "dslate", "grey")
    g.ell(hx - 7, 12.5 + o + hb, 2, 2.2, "white")
    g.ell(hx + 7, 12.5 + o + hb, 2, 2.2, "white", "lgrey")
    underside(g)
    spray(g, q["spray"])
    rim(g, KILO_RIM)
    return g


# Kilo's grey coat lit where its silhouette faces up or left, so the dark head and ears hold on the dslate road.
KILO_RIM = {"slate": ("grey", None), "dslate": ("grey", None)}


def kilo_face(mood):
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
    # a Y-front harness: a strap down from each shoulder to a ring on the chest, one down from it, each step
    # overlapping the last so the straps stay unbroken at the face's zoom
    for i in range(4):
        g.rect(9 + i * 1.5, 25 + i, 2.5, 1.5, "orange")
        g.rect(20.5 - i * 1.5, 25 + i, 2.5, 1.5, "orange")
    g.rect(15, 29, 2, 3, "orange")
    g.rect(15, 28, 2, 2, "grey")
    eyes(g, 10, 19, 14, iris="sky", mood=mood)
    g.rect(14, 18, 4, 2, "ink")
    g.p(14, 18, "slate")
    mouth(g, 20, mood)
    return g


# ---------- Biscuit: beagle, medium, tricolour, long ears, green collar ----------

def biscuit_road(q):
    g, q = edged(Grid()), pose(q)
    b, ln = q["bob"], q["lean"]
    # the shoulders and front legs follow the head half as far, and the pitch carries both
    sw = ln // 2 + q["pitch"]
    g.rect(9 + sw, 18 + q["fl"] + b, 2, 3, "white")
    g.rect(21 + sw, 18 + q["fr"] + b, 2, 3, "white")
    g.rect(10, 25 + q["bl"], 3, 3, "white")
    g.rect(19, 25 + q["br"], 3, 3, "white")
    bx = 16 + sw
    # tricolour: a tan coat, the black saddle across the back with tan showing round the rump and hips
    g.cel(bx, 22 + b, 6.5, 5.5, "ochre", "rust", "tan")
    g.cel(bx, 20.5 + b, 5, 3.6, "navy", "ink", "dslate")
    # tail held up, white tip
    tx = 16 + q["tail"]
    g.rect(tx - 1, 26 + b, 2, 3, "navy")
    g.rect(tx - 1, 29 + b, 2, 1, "white")
    g.ell(bx, 16 + b, 4.5, 1.5, "ink")
    g.rect(bx - 5, 16 + b, 10, 2, "green")
    g.rect(bx - 5, 17 + b, 10, 1, "dgreen")
    # a round head no wider than the body, the long ears hanging from its sides past the collar
    hx, hb = 16 + ln + q["pitch"], b - q["reach"]
    g.cel(hx, 11 + hb, 5.5, 5, "ochre", None, "tan")
    g.cel(hx - 5, 13 + hb - q["ears"] + q["flop"], 2, 4.5, "rust", "dbrown")
    g.cel(hx + 5, 13 + hb - q["ears"] + q["flop"] + q["twitch"], 2, 4.5, "rust", "dbrown")
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
    # the shoulders and front legs follow the head half as far, and the pitch carries both
    sw = ln // 2 + q["pitch"]
    # the front paws peek out under the coat beside the chest, below the ears, stepping as the others' do
    g.rect(9 + sw, 21.5 + q["fl"] + b, 2, 2, "lgrey")
    g.rect(20.5 + sw, 21.5 + q["fr"] + b, 2, 2, "lgrey")
    g.rect(12, 27 + q["bl"], 2, 2, "lgrey")
    g.rect(18, 27 + q["br"], 2, 2, "lgrey")
    bx = 16 + sw
    g.cel(bx, 23.5 + b, 5.5, 4.5, "white", "lgrey")
    g.cel(bx - 4.5, 25 + b, 1.6, 2, "white")
    g.ell(bx + 4.5, 25 + b, 1.6, 2, "lgrey")
    g.ell(bx, 20 + b, 4, 1.2, "lgrey")
    tx = 16 + q["tail"]
    g.cel(tx, 26.5 + b, 3, 2, "white")
    hx, hb = 16 + ln + q["pitch"], b - q["reach"]
    g.cel(hx - 4.5, 18 + hb - q["ears"] + q["flop"], 2.2, 4, "white", "lgrey")
    g.ell(hx + 4.5, 18 + hb - q["ears"] + q["flop"] + q["twitch"], 2.2, 4, "lgrey")
    # the head inlaid in lgrey over the ears and the back, so it holds apart from the white coat
    inlay(g, "lgrey", lambda t: t.cel(hx, 15.5 + hb, 5.5, 4.5, "white", "lgrey"))
    bow(g, hx, 10 + hb, folds=False)
    underside(g)
    spray(g, q["spray"])
    return g


def duchess_face(mood):
    g = edged(Grid(), "ink", close=True)
    g.cel(16, 26.5, 6, 3.5, "white", "lgrey")
    d = droop(mood)
    g.cel(7.5 - d / 2, 19 + d, 3.5, 7.5, "white", "lgrey")
    g.cel(24.5 + d / 2, 19 + d, 3.5, 7.5, "lgrey", "grey")
    # the head inlaid over the ears in lgrey, so the white ears hang apart from the white head
    inlay(g, "lgrey", lambda t: (t.cel(16, 16, 8.5, 8, "white", "lgrey"), t.cel(16, 20.5, 4.5, 3.5, "white", "lgrey")))
    bow(g, 16, 6, big=True)
    eyes(g, 11, 19, 15, mood=mood)
    g.rect(15, 18, 2, 2, "ink")
    mouth(g, 21, mood)
    return g


# ---------- Reggie: pug, small, fawn, black mask, red bandana ----------

def reggie_road(q):
    g, q = edged(Grid()), pose(q)
    b, ln = q["bob"], q["lean"]
    # the shoulders and front legs follow the head half as far, and the pitch carries both
    sw = ln // 2 + q["pitch"]
    g.rect(10 + sw, 21 + q["fl"] + b, 2, 2, "skin2")
    g.rect(20 + sw, 21 + q["fr"] + b, 2, 2, "skin2")
    bx = 16 + sw
    g.rect(12, 27 + q["bl"], 2, 2, "skin2")
    g.rect(18, 27 + q["br"], 2, 2, "skin2")
    g.cel(bx, 23.5 + b, 5.5, 4.5, "skin1", "skin2", "cream")
    # the curly tail, coiled on top of the rump: a skin2 ring round the coat, a skin2 dot at its heart
    tx = 16 + q["tail"]
    g.ell(tx, 24.5 + b, 2.3, 1.9, "skin2")
    g.ell(tx - 0.2, 24.3 + b, 1.4, 1.1, "skin1")
    g.p(tx, 24.5 + b, "skin2")
    g.rect(bx - 4, 19 + b, 8, 1, "red")
    g.rect(bx - 1, 19 + b, 2, 2, "dred")
    hx, hb = 16 + ln + q["pitch"], b - q["reach"]
    g.cel(hx, 15 + hb, 5.5, 4.5, "skin1", "skin2", "cream")
    g.ell(hx - 4.8, 12.3 + hb - q["ears"] + q["flop"], 2, 1.7, "navy")
    g.ell(hx + 4.8, 12.3 + hb - q["ears"] + q["flop"] + q["twitch"], 2, 1.7, "navy")
    g.rect(hx - 2, 13 + hb, 4, 1, "skin2")
    spray(g, q["spray"])
    return g


def reggie_face(mood):
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


# ---------- Buddy: Jack Russell, small, white with tan patches, red collar ----------

def buddy_road(q):
    g, q = edged(Grid()), pose(q)
    b, ln = q["bob"], q["lean"]
    # the shoulders and front legs follow the head half as far, and the pitch carries both
    sw = ln // 2 + q["pitch"]
    g.rect(10 + sw, 21 + q["fl"] + b, 2, 3, "white")
    g.rect(20 + sw, 21 + q["fr"] + b, 2, 3, "white")
    g.rect(12, 26 + q["bl"], 2, 3, "white")
    g.rect(18, 26 + q["br"], 2, 3, "white")
    bx = 16 + sw
    g.cel(bx, 23.5 + b, 5, 4.5, "white", "lgrey")
    g.cel(bx + 1.5, 22.5 + b, 2.5, 2, "ochre", "rust")
    tx = 16 + q["tail"]
    # a short upright tail, white with a tan tip, standing clear of the rump
    g.rect(tx - 1, 27 + b, 2, 2, "white")
    g.rect(tx - 1, 28 + b, 2, 1, "ochre")
    hx, hb = 16 + ln + q["pitch"], b - q["reach"]
    g.rect(bx - 4, 19 + b, 8, 1, "red")
    g.cel(hx, 15 + hb, 5, 4.5, "white", "lgrey")
    g.ell(hx + 2, 14 + hb, 2.5, 2, "ochre")
    e = q["ears"] + q["flop"]
    g.tri((hx - 5, 14 + hb), (hx - 4, 10 + hb + e), (hx - 1.5, 12.5 + hb), "ochre")
    t = q["twitch"]
    g.tri((hx + 5, 14 + hb + t), (hx + 4, 10 + hb + e + t), (hx + 1.5, 12.5 + hb + t), "ochre")
    spray(g, q["spray"])
    return g


def buddy_face(mood):
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


# ---------- Pepe (key pierre): miniature poodle, medium, black with a white stripe, show-clip pom-poms ----------

# Pepe's coat: the curls (fill, shade, light), the shaved skin and the white stripe (fill, shade).
CURL = ("navy", "ink", "dslate")
SHAVED = ("slate", "dslate", "grey")
STRIPE = ("white", "lgrey")


def pierre_edge(c):
    """Pepe's outline: grey round the black coat, which has no fill that holds against the dslate road,
    and the road outline round everything else."""
    return K["grey"] if c in {K[n] for n in CURL + SHAVED} else road_edge(c)


def pierre_road(q):
    g, q = edged(Grid(), pierre_edge), pose(q)
    b, ln = q["bob"], q["lean"]
    # the shoulders and front legs follow the head half as far, and the pitch carries both
    sw = ln // 2 + q["pitch"]
    # a miniature poodle: compact, the head and mane sat D units lower over short legs than a standard's
    D = 1
    # shaved legs, each with a pom-pom bracelet at the paw
    for x, d in ((10 + sw, q["fl"]), (22 + sw, q["fr"])):
        g.rect(x - 1, 19 + D + d + b, 2, 1, SHAVED[0])
        puff(g, x, 22 + D + d + b, 1.8, 1.6)
    for x, d in ((12, q["bl"]), (20, q["br"])):
        g.rect(x - 1, 26 + d, 2, 2, SHAVED[0])
        puff(g, x, 28.5 + d, 2, 1.6)
    # shaved hindquarters behind a curly mane over the shoulders
    bx = 16 + sw
    g.ell(bx, 24 + b, 3.8, 3.5, *SHAVED)
    puff(g, bx, 18.5 + D + b, 5, 3.2)
    # a thin tail held up with a pom-pom on the end
    tx = 16 + q["tail"]
    g.rect(tx, 25 + b, 1, 2, SHAVED[0])
    puff(g, tx + 0.5, 28 + b, 2, 1.8)
    # ear puffs hanging behind a round topknot
    hx, hb = 16 + ln + q["pitch"], b - q["reach"]
    puff(g, hx - 5, 14.5 + D + hb - q["ears"] + q["flop"], 2, 3.5, ring=True)
    puff(g, hx + 5, 14.5 + D + hb - q["ears"] + q["flop"] + q["twitch"], 2, 3.5, ring=True)
    puff(g, hx, 10.5 + D + hb, 4, 3.8, ring=True)
    # the white stripe, one width all the way, from the top of the topknot down the neck, the mane and the
    # back to the tail's tip; leaning, the head moves further than the body, so the neck carries it across on
    # a diagonal, a row at a time
    g.rect(hx - 1, 7 + D + hb, 2, 7, STRIPE[0])
    for k in range(3):
        g.rect(hx - 1 + (bx - hx) * (k + 1) / 4, 13 + D + hb + k, 2, 2, STRIPE[0])
    g.rect(bx - 1, 15 + D + b, 2, 10 - D, STRIPE[0])
    # the tail's stripe runs down its stem into the white tip, so the two read as one tail
    g.rect(tx, 25 + b, 1, 3, STRIPE[0])
    g.ell(tx + 0.5, 28.8 + b, 1.2, 1, STRIPE[0])
    # a small mauve show bow tied in purple, pinned to the topknot's top right
    g.rect(hx, 5 + D + hb, 2, 3, "mauve")
    g.rect(hx + 3, 5 + D + hb, 2, 3, "mauve")
    g.p(hx + 2, 6 + D + hb, "purple")
    g.p(hx, 5 + D + hb, "pink")
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
    g.cel(16, 8, 5, 3, *CURL)
    g.cel(16, 22, 4, 3.5, "grey", "slate", "lgrey")
    # the white stripe from the brow up over the topknot, under the show bow
    g.rect(15, 5, 2, 9, STRIPE[0])
    g.rect(16, 6, 1, 8, STRIPE[1])
    bow(g, 16, 6, big=True, colours=("mauve", "purple"))
    eyes(g, 11, 19, 14, mood=mood)
    g.rect(15, 19, 2, 2, "ink")
    mouth(g, 22, mood)
    return g


# ---------- Archie: Australian Shepherd, medium, brown and white, one blue eye, red bandana ----------

# The brown coat (fill, shade, light) and the ears (ear, folded tip).
COAT = ("brown", "dbrown", "skin2")
EAR = ("brown", "dbrown")


def archie_road(q):
    g, q = edged(Grid()), pose(q)
    b, ln = q["bob"], q["lean"]
    # the shoulders and front legs follow the head half as far, and the pitch carries both
    sw = ln // 2 + q["pitch"]
    # white legs with copper points where they meet the coat
    for x, y, d in ((9 + sw, 17, q["fl"] + b), (21 + sw, 17, q["fr"] + b), (10, 25, q["bl"]),
                    (19, 25, q["br"])):
        g.rect(x, y + d, 3 if y > 20 else 2, 4, "white")
        g.rect(x, y + d, 3 if y > 20 else 2, 1, "ochre")
    # a solid brown coat, as wide as Biscuit and longer in the coat
    bx = 16 + sw
    g.cel(bx, 21.5 + b, 7, 6, *COAT)
    # the fluffy bobtail held up over the rump: a tuft of two locks over a third, the white tip on top, set off from
    # the coat by a plum line. Drawn at under 1.2px a design unit, the notch between the upper locks and each lock's
    # shade break into lone pixels, so there the upper locks draw as one, the tuft goes unshaded and the tip is a
    # block that stays 2px wide.
    tx = 16 + q["tail"]
    big = scale_of(g) >= 1.2
    sh = COAT[1] if big else None
    upper = ((tx - 1.5, 1.4), (tx + 1.5, 1.4)) if big else ((tx, 2.6),)

    def tuft(t):
        for x, rx in upper:
            t.cel(x, 26.8 + b, rx, 1.3, COAT[0], sh)
        t.cel(tx, 28 + b, 1.6, 1.3, COAT[0], sh)
        if big:
            t.cel(tx, 25.6 + b, 1.2, 1, "white")
        else:
            t.rect(tx - 1.6, 24.6 + b, 3.2, 2, "white")

    inlay(g, "plum", tuft)
    # the fluffy white ruff round the neck, tufted out past the shoulders and down onto the back
    g.cel(bx, 18.5 + b, 6.5, 2.4, "white", "lgrey")
    # its tufts flat white, so the ruff's one shade is its own crescent along the lower right
    for x, y, rx, ry in ((bx - 5.5, 19.5, 1.5, 1.5), (bx + 5.5, 19.5, 1.5, 1.5), (bx - 2.5, 20.5, 2, 1.5),
                         (bx + 2.5, 20.5, 2, 1.5)):
        g.ell(x, y + b, rx, ry, "white")
    # the red bandana tied at the nape in one knot
    g.rect(bx - 5, 16.7 + b, 10, 1.4, "red")
    g.rect(bx - 1, 16.7 + b, 2, 2, "dred")
    # rose ears set high, each tip folding over and out in the shade
    hx, hb = 16 + ln + q["pitch"], b - q["reach"]
    e = q["ears"] + q["flop"]
    for s, t in ((-1, 0), (1, q["twitch"])):
        g.tri((hx + s * 5.5, 10 + hb + t), (hx + s * 5, 5 + hb + e + t), (hx + s * 1.5, 7 + hb + t), EAR[0])
    g.cel(hx, 11.5 + hb, 5.5, 5, *COAT)
    for s, t in ((-1, 0), (1, q["twitch"])):
        g.tri((hx + s * 5, 5 + hb + e + t), (hx + s * 6, 6.5 + hb + e + t), (hx + s * 4, 6.5 + hb + e + t), EAR[1])
    spray(g, q["spray"])
    rim(g, ARCHIE_RIM)
    return g


# Archie's brown coat lit where its silhouette faces up or left, so it holds on the dslate road.
ARCHIE_RIM = {"brown": ("tan", None), "dbrown": ("skin2", None)}
# Archie's face's eyes: each 3x3 iris's left column and its colour, far eye first, and their top row.
ARCHIE_EYES = ((10, "sky"), (19, "amber"))
ARCHIE_EYE_Y = 14


def archie_face(mood):
    g = edged(Grid(), "ink", close=True)
    d = droop(mood)
    # rose ears set high, the tips folding forward and out
    g.tri((7, 12), (8 - d, 3 + d), (13.5, 7 + d / 2), EAR[0])
    g.tri((25, 12), (24 + d, 3 + d), (18.5, 7 + d / 2), EAR[0])
    g.tri((8 - d, 3 + d), (4 - d, 6 + d), (9 - d, 6 + d), EAR[1])
    g.tri((24 + d, 3 + d), (28 + d, 6 + d), (23 + d, 6 + d), EAR[1])
    # a white ruff, the red bandana tied over it
    g.cel(16, 27, 9, 3.5, "white", "lgrey")
    g.tri((8, 25), (24, 25), (16, 31.5), "red")
    g.tri((16, 25), (24, 25), (16, 31.5), "dred")
    g.rect(8, 25, 16, 1, "dred")
    # a broad skull, squared so it fills in under the ears
    g.cel(16, 16, 9.5, 8.5, *COAT, power=2.4)
    # a white blaze up the forehead, widening down into the white muzzle
    g.rect(15, 7, 2, 9, "white")
    g.rect(14, 13, 4, 3, "white")
    # copper brows and cheeks
    g.p(10, 11, "ochre")
    g.p(21, 11, "ochre")
    g.rect(9, 18, 2, 2, "ochre")
    g.rect(22, 18, 2, 2, "ochre")
    g.cel(16, 20.5, 5, 3.5, "white", "lgrey")
    (lx, _), (rx, _) = ARCHIE_EYES
    y = ARCHIE_EYE_Y
    eyes(g, lx, rx, y, iris="sky", mood=mood)
    # odd eyes, the far one sky and the near one amber, drawn alike so they look the same way: the shine at
    # the iris's top left and the pupil at its lower right
    for x, iris in ARCHIE_EYES:
        g.rect(x, y, 3, 3, iris)
        g.rect(x + 1, y + 1, 2, 2, "ink")
        g.p(x, y, "white")
    # a liver nose
    g.rect(14, 18, 4, 2, "plum")
    g.p(14, 18, "dbrown")
    mouth(g, 20, mood)
    return g


# ---------- Sequoia: Great Pyrenees, large, giant white fluff, collar with a bell ----------

def snowball_road(q):
    g, q = edged(Grid()), pose(q)
    b, ln, o = q["bob"], q["lean"], 2
    # the shoulders and front legs follow the head half as far, and the pitch carries both
    sw = ln // 2 + q["pitch"]
    g.rect(6 + sw, 15 + o + q["fl"] + b, 4, 4, "white")
    g.rect(22 + sw, 15 + o + q["fr"] + b, 4, 4, "white")
    g.rect(8, 26 + q["bl"], 4, 4, "lgrey")
    g.rect(20, 26 + q["br"], 4, 4, "lgrey")
    # a giant fluffy body, its coat bunched into tufts round the edge
    bx = 16 + sw
    g.cel(bx, 20.5 + o + b, 9, 6.5, "white", "lgrey")
    for dx, dy in ((-8, -1), (8, -1), (-7, 3), (7, 3), (-4, 6), (4, 6)):
        g.ell(bx + dx, 20.5 + o + b + dy, 2.2, 2.2, "white")
    g.rect(bx - 7, 16 + o + b, 14, 1, "sky")
    # the plumed tail carried up over the back
    tx = 16 + q["tail"]
    g.cel(tx, 23.5 + o + b, 4.5, 3.5, "white", "lgrey")
    # a broad round head, its drop ears hanging at the sides, marked a soft badger cream
    hx, hb = 16 + ln + q["pitch"], b - q["reach"]
    e, t = -q["ears"] + q["flop"], q["twitch"]
    g.cel(hx, 9.5 + o + hb, 7.5, 6.5, "white", "lgrey", power=2.6)
    g.cel(hx - 7.5, 11.5 + o + hb + e, 2.3, 3.8, "cream", "tan")
    g.cel(hx + 7.5, 11.5 + o + hb + e + t, 2.3, 3.8, "cream", "tan")
    underside(g)
    # the droplets start past the ears and tufts, so they fly clear of his white coat
    spray(g, q["spray"], 4)
    return g


def snowball_face(mood):
    g = edged(Grid(), "ink", close=True)
    d = droop(mood)
    g.cel(16, 28, 9, 3.5, "white", "lgrey")
    # a Great Pyrenees' broad head in a thick ruff wider than the skull, small V drop ears set at its sides,
    # marked badger tan; they swing out and sag as the dog loses heart
    g.cel(16, 22, 12, 4.5, "white", "lgrey")
    g.cel(16, 15.5, 10, 8.5, "white", "lgrey")
    for sgn in (-1, 1):
        x = 16 + sgn * (8 + d / 2)
        inlay(g, "skin2", lambda t, x=x, sgn=sgn: (
            t.tri((x - 2.5 * sgn, 9 + d), (x + 2.5 * sgn, 9.5 + d), (x + 0.5 * sgn, 16 + d), "tan"),
            t.tri((x - 1.5 * sgn, 10 + d), (x + 1.5 * sgn, 10.5 + d), (x + 0.5 * sgn, 14 + d), "cream")))
    g.rect(9, 26, 14, 1, "sky")
    g.cel(16, 28, 2, 2, "amber", "orange", "yellow")
    g.p(16, 29, "orange")
    eyes(g, 11, 19, 14, mood=mood)
    g.rect(15, 18, 2, 2, "ink")
    mouth(g, 20, mood)
    return g


# ---------- Penny: golden retriever with a Labrador build, large, golden coat, otter tail, blue collar ----------

# Penny's coat, one ramp cel shaded: base, shade, light.
GOLD = ("amber", "orange", "yellow")


def penny_road(q):
    g, q = edged(Grid()), pose(q)
    b, ln, o = q["bob"], q["lean"], 2
    # the shoulders and front legs follow the head half as far, and the pitch carries both
    sw = ln // 2 + q["pitch"]
    # solid legs, each shaded down its outer side
    for x, y, d in ((7 + sw, 15 + o, q["fl"] + b), (22 + sw, 15 + o, q["fr"] + b), (9, 26, q["bl"]),
                    (20, 26, q["br"])):
        g.rect(x, y + d, 3, 4, GOLD[0])
        g.rect(x + (2 if x > 16 else 0), y + d, 1, 4, GOLD[1])
    # a deep, broad chest and barrel
    bx = 16 + sw
    gold(g, bx, 20.5 + o + b, 7.5, 6, 2.3)
    g.rect(bx - 6, 16 + o + b, 12, 2, "blue")
    g.rect(bx - 6, 16 + o + b, 12, 1, "sky")
    # a thick otter tail laid over the rump in the shade colour, tapering to a blunt tip and swinging from
    # its root, lit down its left side
    tx, ty = 16 + q["tail"] * 2, 31 + b
    for (l, r, tl, tr), c in (((13, 19, -1.5, 1.5), GOLD[1]), ((13, 14.5, -1.5, -0.5), GOLD[0])):
        g.tri((l, 22 + b), (r, 22 + b), (tx + tr, ty), c)
        g.tri((l, 22 + b), (tx + tl, ty), (tx + tr, ty), c)
    # a broad skull with short flat drop ears at its sides, in the shade colour, over a neck as wide as the
    # skull down to the collar, so no road shows between an ear and the collar
    hx, hb = 16 + ln + q["pitch"], b - q["reach"]
    left, right = min(hx, bx) - 6.5, max(hx, bx) + 6.5
    g.rect(left, 13 + o + hb, right - left, 3, GOLD[0])
    g.rect(bx - 6, 16 + o + b, 12, 2, "blue")
    g.rect(bx - 6, 16 + o + b, 12, 1, "sky")
    gold(g, hx, 9.5 + o + hb, 6.5, 4.5, 2.8)
    for x, t in ((hx - 6.5, 0), (hx + 6.5, q["twitch"])):
        g.blob(x, 10.5 + o + hb - q["ears"] + q["flop"] + t, 1.8, 2.5, GOLD[1], power=3)
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
    what g already holds, while its open edges take the grid's outline."""
    t = Grid(g.w, g.h)
    draw(t)
    gp, tp = g.px, t.px  # in drawn pixels, also on a minis.Mini
    h, w = len(gp), len(gp[0])
    shape = {(x, y) for y in range(h) for x in range(w) if tp[y][x]}
    ring = {(x + dx, y + dy) for x, y in shape for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0))} - shape
    for x, y in ring:
        if 0 <= x < w and 0 <= y < h and gp[y][x]:
            gp[y][x] = K.get(line, line)
    for x, y in shape:
        gp[y][x] = tp[y][x]


# ---------- shared features ----------

def droop(mood):
    """How far the ears sag, in pixels: perked when happy, relaxed when neutral, flat when upset."""
    return {"happy": 0, "neutral": 1, "upset": 3}[mood]


def puff(g, cx, cy, rx, ry, ring=False):
    """A clipped poodle pom-pom in Pepe's curls (CURL), shaded on its lower right, with a highlight only
    on a puff big enough to hold one as a shape, so the coat carries no single-pixel texture. ring sets it
    apart from the puffs it is drawn over with a 1px ring in the shade."""
    if ring:
        g.ell(cx, cy, rx + 1, ry + 1, CURL[1])
    g.ell(cx, cy, rx, ry, CURL[0], CURL[1], CURL[2] if min(rx, ry) >= 3 else None)


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


def spray(g, d, out=0):
    """The shake-off's water: droplets thrown d pixels out from both flanks, rising as they fly. Each is
    1px, cyan or white, so the road outline rings it and it holds on every road. out starts them that much
    further out, for a coat whose flanks or ears reach past the others'."""
    if not d:
        return
    for x, y, c in ((9, 14, "cyan"), (9, 20, "white"), (22, 12, "cyan"), (22, 18, "white"), (21, 23, "cyan")):
        side = -1 if x < 16 else 1
        g.p(x + side * (d + out), y - d / 2, c)


# A white or light grey coat's underside, one ramp step darker: white to lgrey, lgrey to grey.
UNDERSIDE = {"ffffff": "c0cbdc", "c0cbdc": "8b9bb4"}


def underside(g):
    """Darken a white or grey coat's lower-right silhouette one ramp step: every coat pixel with open road
    below it or to its right. The coat keeps its colour, and its shade sits a step darker,
    so a white dog keeps its mass on the light roads. Works on the grid a small version
    draws to as well."""
    px = raster(g).px
    h, w = len(px), len(px[0])
    edge = [(x, y) for y in range(h) for x in range(w) if px[y][x] in UNDERSIDE and (
        y + 1 >= h or x + 1 >= w or not px[y + 1][x] or not px[y][x + 1])]
    for x, y in edge:
        px[y][x] = UNDERSIDE[px[y][x]]


def despeckle(g, colours):
    """Fill every lone pixel of the given coat colours, one that none of its four opaque neighbours shares,
    with its neighbours' most common colour, so overlapping puffs leave no single-pixel texture to shimmer at
    road scale. Works on the grid a small version draws to as well."""
    px = raster(g).px
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


def bow(g, cx, y, big=False, colours=("pink", "mauve"), folds=True):
    """A bow: Duchess's is pink, Pepe's show ribbon mauve tied in purple. The knot and folds take the
    second colour; folds=False leaves the folds out, for a bow too small at road scale for them to land
    on its wings."""
    c, knot = colours
    w = 4 if big else 3
    g.tri((cx - 1, y + 1), (cx - 1 - w, y - 1), (cx - 1 - w, y + 3), c)
    g.tri((cx + 1, y + 1), (cx + 1 + w, y - 1), (cx + 1 + w, y + 3), c)
    if folds:
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


def mouth(g, y, mood):
    """happy: a wide open grin with the tongue out; neutral: a closed line; upset: a deep frown."""
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
    else:
        g.rect(15, y, 2, 1, "ink")
        g.p(14, y + 1, "ink")
        g.p(17, y + 1, "ink")
        g.p(13, y + 2, "ink")
        g.p(18, y + 2, "ink")


DOGS = {
    "duchess": (duchess_road, duchess_face),
    "reggie": (reggie_road, reggie_face),
    "buddy": (buddy_road, buddy_face),
    "pierre": (pierre_road, pierre_face),
    "biscuit": (biscuit_road, biscuit_face),
    "archie": (archie_road, archie_face),
    "snowball": (snowball_road, snowball_face),
    "penny": (penny_road, penny_face),
    "kilo": (kilo_road, kilo_face),
}


# Each dog's road sprite side, by its size class: large 54, medium ROAD_SIZE (48) and small 38, about 1.1x, 1x
# and 0.8x.
SIZE_CLASS = {"large": 54, "medium": ROAD_SIZE, "small": 38}
DOG_CLASS = {"kilo": "large", "snowball": "large", "penny": "large", "archie": "medium", "biscuit": "medium",
             "pierre": "medium", "duchess": "small", "reggie": "small", "buddy": "small"}
DOG_SIZE = {name: SIZE_CLASS[DOG_CLASS[name]] for name in DOGS}
# How much bigger a dog is drawn inside its frame, across and down. The large dogs are drawn narrower, Kilo
# and Sequoia about 30px wide and Penny 28 at full size; the small dogs fill more of theirs, about 20px wide
# (Buddy 19) and 31 to 32 tall. So the widths step about 30, 24 and 20.
DOG_ZOOM = {"kilo": (0.93, 1), "snowball": (0.82, 1), "penny": (0.85, 1), "duchess": (1.13, 1.22),
            "reggie": (1.09, 1.27), "buddy": (1.17, 1.27)}


# How big each dog's face is drawn in its 32px frame, sat on the bottom edge: the side that brings its inked
# area nearest its size class's target, so the classes step evenly (the square root of the area about 17, 21.3
# and 25.5px) however much of its design a breed's ears or topknot fill. The large dogs zoom past the
# frame as far as Kilo's ears fit under its top edge, so they fill their tiles, and medium sits halfway.
FACE_SIDE = {"archie": 30, "biscuit": 29, "buddy": 27, "duchess": 23, "kilo": 35, "penny": 37, "pierre": 27,
             "reggie": 26, "snowball": 36}


def framed(px, side):
    """Rows px set in a side x side frame, centred across and on its bottom edge, cropped where they overflow it."""
    px = px[max(0, len(px) - side):]
    w = len(px[0])
    if w >= side:
        left = (w - side) // 2
        rows = [row[left:left + side] for row in px]
    else:
        left = (side - w) // 2
        rows = [[None] * left + row + [None] * (side - w - left) for row in px]
    return [[None] * side for _ in range(side - len(rows))] + rows


def face_frame(face, mood, side):
    """face(mood)'s outlined rows, drawn at side over 32 of its 32-unit design and set on the bottom edge of a
    32x32 frame; a side over 32 zooms in past the frame, cropping the chest at the sides."""
    import minis

    here = sys.modules[__name__]
    return framed(minis.small(here, side / 32, face, mood).outlined(), 32)


def road_scale(name):
    """The scale dog-<name>'s 32-unit design is drawn at: its DOG_SIZE over 32."""
    return DOG_SIZE[name] / 32


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every sprite."""
    import minis

    here = sys.modules[__name__]
    for name, (draw_road, face) in DOGS.items():
        zoom = DOG_ZOOM.get(name, 1)
        yield f"dog-{name}", [(tag, minis.dog_frames(draw_road, poses, road_scale(name), here, zoom), ms)
                              for tag, poses, ms in ROAD_TAGS]
        yield f"face-dog-{name}", [(m, [face_frame(face, m, FACE_SIDE[name])], 1000)
                                   for m in FACE_TAGS]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/dogs", __doc__)
