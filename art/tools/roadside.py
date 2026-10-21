#!/usr/bin/env python3
"""Draw the roadside props: the trees, lamps and landmarks on the verges beyond the
sidewalks, and hold the per-zone table that places them.

They are road sprites in the OutRun manner: front elevations, anchored bottom centre on their road
row, scaled with the road camera and drawn back to front with the road objects. Every prop's inner
edge lies beyond the sidewalk, so none stands on a lane or a sidewalk, and none is a person, a live
animal on the ground, a coin or a bone, so none reads as an obstacle, an encounter or a pickup.

Each is laid out on a design grid and drawn SCALE (1.5) times larger, as the road objects are:
every rect, ellipse and triangle scales, 1px lines stay 1px. Design sizes are multiples of 4, so
every frame and depth variant is a whole size. Full size, then @88, @75, @62 and @50:

roadside-dune-grass      60x48    a tuft of dune grass, moss and olive blades with gold tips
roadside-fruit-stand     108x84   a tiered fruit stand under a little striped awning
roadside-gas-lamp        36x150   a heritage street lamp, its lantern lit gold
roadside-hot-dog-stand   90x126   a red park kiosk under a flat white roof, a hot dog on its sign
roadside-leuty           96x156   the Leuty Lifeguard Station on driftwood stilts
roadside-love-lock       78x90    the Distillery's red steel heart of padlocks on a post
roadside-street-lamp     60x180   a downtown street light, an arm each way, lit gold beneath
roadside-transit-stop    42x150   a TTC stop pole with its sign and a timetable box
roadside-tree-maple      114x156  a street maple in lobes over a trunk
roadside-tree-oak        144x174  a big park oak

Every prop has one tag, `idle`: one frame of 1000ms, no motion. The ground row is the last opaque
row; the frame keeps a clear ring for the outline. Outlines are road_edge; there is no light rim
(road.LIT), since the props stand on the verge, never on the road.

PLACEMENT holds the per-zone placement tables (see the style guide's Roadside section); `table`
prints them as JSON with every prop's across offset resolved and each zone's shadow colour.

Usage:
  roadside.py preview OUT.png   every frame on green, dgreen and dslate
  roadside.py build             write art/roadside/*.aseprite and export to public/art/sprites/
  roadside.py table             print the placement table as JSON
  roadside.py table --write     write it to shared/roadside.json, which the game reads; build writes it too

Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
belong in this file instead. Shared tooling is in pixel.py.
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from minis import STEPS, Mini, scaled  # noqa: E402
from pixel import DARKER, K, edged, main  # noqa: E402

SCALE = 1.5
GROUNDS = (K["green"], K["dgreen"], K["dslate"])
STILL_MS = 1000


def dk(c):
    return DARKER[K.get(c, c)]


# ---------- the props: front elevations, in design units ----------
# Each draw(g, f) paints on a grid of the prop's design size, frame f of its idle; base = h - 2 is the
# ground row, so the outline closes under it, and the outer ring of the frame stays clear.


def walls(g, x0, ww, top, base, wall):
    """A wall from column x0, ww wide, rows top to base, its right 3px a step darker."""
    g.rect(x0, top, ww, base - top, wall)
    g.rect(x0 + ww - 2, top, 2, base - top, dk(wall))


def bar(g, a, b, c, wide=2):
    """A straight bar wide design units across from point a to point b, as two triangles."""
    (x0, y0), (x1, y1) = a, b
    g.tri((x0, y0), (x0 + wide, y0), (x1 + wide, y1), c)
    g.tri((x0, y0), (x1, y1), (x1 + wide, y1), c)


def gas_lamp():
    """A heritage street lamp: a coal post on a fluted base, a four-sided lantern lit gold."""
    w, h = 24, 100

    def draw(g, f=0):
        base = h - 2
        g.rect(10, 26, 4, base - 25, "coal")
        g.rect(10, 26, 1, base - 25, "ash")
        g.rect(7, base - 9, 10, 10, "coal")
        g.rect(7, base - 9, 1, 10, "ash")
        g.rect(8, 22, 8, 4, "coal")
        g.rect(5, 8, 14, 14, "coal")
        g.rect(7, 10, 10, 10, "gold")
        g.rect(7, 10, 3, 3, "cream")
        g.rect(11, 10, 1, 10, "coal")
        g.tri((4, 8), (20, 8), (12, 2), "coal")
    return w, h, draw


def street_lamp():
    """A downtown street light: an ash pole, an arm each way, a flat lgrey head on each lit gold beneath."""
    w, h = 40, 120

    def draw(g, f=0):
        base = h - 2
        g.rect(18, 10, 4, base - 9, "ash")
        g.rect(18, 10, 1, base - 9, "stone")
        g.rect(15, base - 6, 10, 7, "shale")
        g.rect(8, 10, 24, 3, "ash")
        for x in (3, 27):
            g.rect(x, 9, 10, 4, "lgrey")
            g.rect(x + 1, 13, 8, 2, "gold")
    return w, h, draw


def lobed_tree(leaf, shade, light, trunk="dbrown", big=False):
    """A street or park tree: lobes over a trunk, shaded lower right, lit upper left; big is the park's
    spreading oak, wider and with more lobes."""
    w, h = (96, 116) if big else (76, 104)

    def draw(g, f=0):
        base = h - 2
        cx = w // 2
        g.rect(cx - 5, h - 44, 10, 43, trunk)
        g.rect(cx + 1, h - 44, 4, 43, dk(trunk))
        g.rect(cx - 9, base - 3, 18, 4, trunk)
        lobes = (((cx, 34, 40, 30), (cx - 26, 52, 18, 15), (cx + 26, 52, 18, 15), (cx - 18, 26, 16, 14),
                  (cx + 20, 28, 16, 14)) if big else
                 ((cx, 33, 32, 30), (cx - 17, 53, 17, 14), (cx + 17, 53, 17, 14)))
        for x, y, rx, ry in lobes:
            g.ell(x, y, rx, ry, shade)
        for x, y, rx, ry in lobes:
            g.ell(x - 2, y - 3, rx - 3, ry - 3, light)
        for x, y, rx, ry in lobes:
            g.ell(x - 1, y - 2, rx - 4, ry - 4, leaf)
        for x, y, r in ((cx + 9, 25, 4), (cx - 11, 41, 3), (cx + 13, 49, 3), (cx - 7, 15, 3)):
            g.ell(x, y, r, r, shade)
    return w, h, draw


def fruit_stand():
    """A tiered fruit stand under a little striped awning: three rows of crates heaped with fruit."""
    w, h = 72, 56

    def draw(g, f=0):
        base = h - 2
        for x in (6, 62):
            g.rect(x, 8, 3, base - 7, "bark")
        for i in range(8):
            g.rect(4 + i * 8, 4, 8, 6, "ttc" if i % 2 == 0 else "white")
        g.rect(4, 10, 64, 1, "dred")
        for row, (y, fruits) in enumerate(((base - 30, ("lime", "moss")), (base - 19, ("red", "ttc")),
                                           (base - 8, ("orange", "amber")))):
            x0 = 10 - row * 2
            g.rect(x0, y, 52 + row * 4, 9, "clay")
            g.rect(x0, y + 4, 52 + row * 4, 1, "bark")
            g.rect(x0 + 50 + row * 4 - 3, y, 3, 9, "bark")
            for k in range((52 + row * 4) // 5):
                g.ell(x0 + 3 + k * 5, y - 1, 2.4, 2.2, fruits[k % 2])
    return w, h, draw


def dune_grass():
    """A tuft of dune grass, blades of moss and olive with gold tips."""
    w, h = 40, 32

    def draw(g, f=0):
        base = h - 2
        for x, top, c in ((6, 14, "olive"), (11, 6, "moss"), (16, 10, "olive"), (21, 4, "moss"), (26, 9, "olive"),
                          (31, 12, "moss"), (34, 18, "olive")):
            g.tri((x - 2, base + 1), (x + 2, base + 1), (x + (2 if x > 20 else -2), top), c)
            g.rect(x + (2 if x > 20 else -2), top, 1, 2, "gold")
    return w, h, draw


def transit_stop():
    """A TTC stop pole: a coal pole, a red and white stop sign at the top, a timetable box."""
    w, h = 28, 100

    def draw(g, f=0):
        base = h - 2
        g.rect(12, 6, 4, base - 5, "coal")
        g.rect(12, 6, 1, base - 5, "ash")
        g.rect(4, 6, 20, 24, "ttc")
        g.rect(6, 8, 16, 10, "white")
        g.rect(8, 11, 12, 4, "ttc")
        g.rect(6, 21, 16, 6, "white")
        g.rect(9, 40, 10, 16, "coal")
        g.rect(10, 41, 8, 14, "lgrey")
        for y in range(43, 54, 3):
            g.rect(11, y, 6, 1, "stone")
    return w, h, draw


def hot_dog_stand():
    """A park hot dog stand: a red kiosk under a flat white roof, a hot dog on its sign, a yellow and white
    striped awning over the serving hatch, ketchup and mustard on the counter."""
    w, h = 60, 84

    def draw(g, f=0):
        base = h - 2
        for x in (18, 40):
            g.rect(x, 18, 2, 11, "coal")
        g.ell(30, 11, 27, 4, "dred")
        g.ell(28, 10, 23, 2, "red")
        g.ell(30, 15, 20, 5, "amber")
        g.ell(31, 17, 18, 3, "ochre")
        g.rect(11, 12, 38, 1, "tan")
        for i in range(11):
            g.rect(12 + i * 3.5, 7 + 2 * (i % 2), 2, 2, "yellow")
        g.rect(2, 28, 56, 5, "white")
        g.rect(2, 32, 56, 1, "lgrey")
        walls(g, 6, 48, 33, base, "ttc")
        for i in range(0, 48, 6):
            g.rect(6 + i, 33, 3, 7, "yellow")
            g.rect(9 + i, 33, 3, 7, "white")
        g.rect(6, 40, 48, 1, "amber")
        g.rect(10, 41, 40, 16, "coal")
        g.rect(12, 43, 12, 8, "cream")
        for y in (45, 48):
            g.rect(14, y, 8, 1, "dbrown")
        g.rect(30, 46, 16, 3, "lgrey")
        g.rect(8, 57, 44, 3, "lgrey")
        g.rect(8, 59, 44, 1, "grey")
        for x, col in ((32, "ttc"), (37, "yellow")):
            g.rect(x, 50, 3, 7, col)
            g.rect(x + 1, 48, 1, 2, col)
        g.rect(42, 53, 6, 4, "white")
        g.rect(6, 68, 48, 3, "white")
    return w, h, draw


def love_lock():
    """The Distillery's love lock heart: a red steel heart on a post, its middle a coal mesh hung with
    padlocks, on a stone plinth."""
    w, h = 52, 60

    def heart(g, r, tip, col):
        g.ell(17, 18, r, r, col)
        g.ell(35, 18, r, r, col)
        g.tri((26 - r - 9, 21), (26 + r + 9, 21), (26, tip), col)

    def span(y, r, tip):
        """The columns the inner heart covers on row y, as (x0, x1), or None."""
        xs = [x for x in range(4, 48)
              if (x + 0.5 - 17) ** 2 + (y + 0.5 - 18) ** 2 <= r * r or (x + 0.5 - 35) ** 2 + (y + 0.5 - 18) ** 2 <= r * r
              or (y + 0.5 >= 21 and abs(x + 0.5 - 26) <= (tip - y - 0.5) * (r + 9) / (tip - 21))]
        return (xs[0], xs[-1] + 1) if xs else None

    def draw(g, f=0):
        base = h - 2
        g.rect(12, base - 8, 28, 9, "stone")
        g.rect(36, base - 8, 4, 9, dk("stone"))
        g.rect(12, base - 8, 28, 1, "lgrey")
        g.rect(23, 40, 6, base - 47, "coal")
        heart(g, 12, 47, "ttc")
        g.ell(13, 13, 4, 3, "red")
        heart(g, 7, 39, "coal")
        for y in range(12, 38, 4):
            sp = span(y, 6, 38)
            if sp:
                g.rect(sp[0], y, sp[1] - sp[0], 1, "shale")
        for x in range(12, 42, 4):
            ys = [y for y in range(8, 40) if (sp := span(y, 6, 38)) and sp[0] <= x < sp[1]]
            if ys:
                g.rect(x, ys[0], 1, ys[-1] + 1 - ys[0], "shale")
        for x, y, col in ((14, 15, "gold"), (21, 20, "lgrey"), (32, 14, "turquoise"), (36, 21, "gold"),
                          (25, 27, "pink"), (18, 26, "amber"), (30, 31, "lgrey"), (25, 15, "amber")):
            g.rect(x, y + 1, 3, 3, col)
            g.rect(x + 1, y, 1, 1, "grey")
    return w, h, draw


def leuty():
    """The Leuty Lifeguard Station: a white clapboard house on driftwood stilts under a red hipped roof,
    a windowed lookout on top under its own red cap, the flag up."""
    w, h = 64, 104

    def draw(g, f=0):
        base = h - 2
        for x in (12, 30, 49):
            g.rect(x, 84, 3, base - 83, "driftwood")
        bar(g, (14, 86), (49, base - 2), "driftwood")
        g.rect(6, 82, 52, 3, "driftwood")
        g.rect(10, 50, 44, 32, "white")
        g.rect(50, 50, 4, 32, "lgrey")
        for y in range(53, 82, 4):
            g.rect(10, y, 40, 1, "lgrey")
        g.rect(24, 58, 16, 14, "dlake")
        g.rect(26, 60, 12, 10, "lake")
        g.rect(27, 61, 3, 3, "foam")
        g.rect(31, 58, 2, 14, "white")
        g.tri((4, 50), (60, 50), (48, 38), "ttc")
        g.tri((4, 50), (48, 38), (16, 38), "ttc")
        g.tri((4, 50), (16, 38), (9, 50), "red")
        g.rect(4, 48, 56, 2, "dred")
        g.rect(22, 24, 20, 14, "white")
        g.rect(38, 24, 4, 14, "lgrey")
        g.rect(25, 27, 14, 7, "dlake")
        g.rect(31, 27, 2, 7, "white")
        g.rect(26, 28, 2, 2, "foam")
        g.tri((19, 25), (45, 25), (32, 14), "ttc")
        g.tri((19, 25), (32, 14), (24, 25), "red")
        g.rect(19, 24, 26, 2, "dred")
        g.rect(31, 4, 2, 11, "coal")
        g.rect(33, 4, 9, 5, "ttc")
    return w, h, draw


# key: (design w, h, draw), idle frame arguments, ms per frame, whether it stands free and casts the
# game's ground shadow.
PROPS = {
    "roadside-gas-lamp": (gas_lamp(), (0,), STILL_MS, True),
    "roadside-street-lamp": (street_lamp(), (0,), STILL_MS, True),
    "roadside-tree-maple": (lobed_tree("canopy", "pine", "moss"), (0,), STILL_MS, True),
    "roadside-tree-oak": (lobed_tree("pine", "fir", "canopy", "bark", big=True), (0,), STILL_MS, True),
    "roadside-fruit-stand": (fruit_stand(), (0,), STILL_MS, True),
    "roadside-dune-grass": (dune_grass(), (0,), STILL_MS, True),
    "roadside-transit-stop": (transit_stop(), (0,), STILL_MS, True),
    "roadside-hot-dog-stand": (hot_dog_stand(), (0,), STILL_MS, True),
    "roadside-love-lock": (love_lock(), (0,), STILL_MS, True),
    "roadside-leuty": (leuty(), (0,), STILL_MS, True),
}


def size(key, step=1):
    """A prop's frame at a depth step, in pixels."""
    w, h, _ = PROPS[key][0]
    return scaled(w, SCALE * step), scaled(h, SCALE * step)


def draw_frame(key, step, f):
    """One idle frame of a prop at a depth step, outlined, as rows of hex colours or None."""
    w, h, draw = PROPS[key][0]
    g = edged(Mini(SCALE * step, w, h))
    draw(g, f)
    fill = g.g.px
    rows = len(fill)
    if any(fill[0]) or any(fill[-1]) or any(r[0] or r[-1] for r in fill) or rows != size(key, step)[1]:
        sys.exit(f"{key} at {step}: the fill touches the frame's edge")
    return g.outlined()


def sprites():
    """Yield (key, [(tag, [frame pixels], duration_ms)]) for every prop at full size, then at every depth
    step."""
    for suffix, step in (("", 1),) + tuple((f"@{s}", q) for s, q in STEPS):
        for key, (_, frames, ms, _) in PROPS.items():
            yield f"{key}{suffix}", [("idle", [draw_frame(key, step, f) for f in frames], ms)]


# ---------- placement ----------
# Road px: across from the road's centre line, z along the road. The sidewalk ends at across 208
# (the street verge's walkTo, backdrops.WALK). Each prop's across is its frame's centre, set from its inner edge.

def at_inner(key, inner):
    """The across of a prop's centre, in whole road px, whose frame's inner edge is at inner or beyond."""
    return math.ceil(inner + size(key)[0] / 2)


def gap(*props):
    """(key, inner edge, dz) props, each placed with its frame's inner edge there."""
    return tuple((f"roadside-{k}", at_inner(f"roadside-{k}", inner), dz) for k, inner, dz in props)


# Per zone, by art id. slot: road px along z between one side's slots. Slot n on a side stands at
# z = n * slot; with m = n - offset, an even m is a lot and an odd m a gap, k = m // 2 counts them, and
# the side takes lots[(lotStart + k * lotStride) % len(lots)] and gaps[(gapStart + k * gapStride) %
# len(gaps)]. gap() takes each prop as (key, inner edge, dz) and resolves its across from its frame's width;
# dz is road px from the slot's z, nearer negative.
# Each table is sparse: an empty lot and six gaps, a prop in
# gaps 0 and 3, so each side has a prop every 6 slots (840 px), the neighborhood's tree then its own
# prop (High Park's hot dog stand, the Distillery's love lock heart, Kensington's fruit stand,
# The Beaches' Leuty). The right side's gapStart of 2 puts its props 3 slots after the left's, so they alternate
# sides, one every 420 px. Each neighborhood's character comes from its backdrop, verges and road,
# not from its roadside.
SIDES = dict(
    left=dict(offset=0, lotStart=0, lotStride=1, gapStart=0, gapStride=1),
    right=dict(offset=1, lotStart=0, lotStride=1, gapStart=2, gapStride=1),
)


def sparse(tree, own):
    """A sparse table: tree alone in gap 0 and own alone in gap 3, each a (key, inner edge, dz)."""
    return dict(slot=140, lots=((),), gaps=(gap(tree), (), (), gap(own), (), ()), sides=SIDES)


PLACEMENT = {
    "cabbagetown": sparse(("tree-maple", 220, 0), ("gas-lamp", 213, 0)),
    "high-park": sparse(("tree-oak", 220, 0), ("hot-dog-stand", 216, 0)),
    "distillery-district": sparse(("gas-lamp", 213, 0), ("love-lock", 216, 0)),
    "kensington-market": sparse(("tree-maple", 220, 0), ("fruit-stand", 216, 0)),
    "the-beaches": sparse(("leuty", 220, 0), ("dune-grass", 213, 0)),
    "yonge-street": sparse(("street-lamp", 213, 0), ("transit-stop", 213, 0)),
}
# Each zone's ground shadow under a free-standing prop: its lawn or paving one ramp step darker.
SHADOWS = {"cabbagetown": "canopy", "high-park": "fir", "distillery-district": "dbrown",
           "kensington-market": "coal", "the-beaches": "skin2", "yonge-street": "coal"}
# Props that stand free and take the game's ground shadow.
SHADOWED = tuple(k for k, v in PROPS.items() if v[3])
TABLE_JSON = "shared/roadside.json"


def placements(zone, side, z0, z1):
    """Every prop on one side ("left" or "right") of a zone with its z in z0..z1-1, as (z, across, key),
    from PLACEMENT as the game reads it."""
    p = PLACEMENT[zone]
    sd, slot = p["sides"][side], p["slot"]
    lo = math.floor(z0 / slot) - 2
    out = []
    for n in range(lo, math.ceil(z1 / slot) + 2):
        m = n - sd["offset"]
        k = m // 2
        props = (p["lots"][(sd["lotStart"] + k * sd["lotStride"]) % len(p["lots"])] if m % 2 == 0
                 else p["gaps"][(sd["gapStart"] + k * sd["gapStride"]) % len(p["gaps"])])
        out += [(n * slot + dz, across, key) for key, across, dz in props]
    return sorted(q for q in out if z0 <= q[0] < z1)


def check_placement():
    """Every prop's frame clears the sidewalk by at least 4 road px, and at no k do the two sides take the
    same lot or gap that holds props."""
    walk = 208
    for zone, p in PLACEMENT.items():
        for group in p["lots"] + p["gaps"]:
            for key, across, _ in group:
                inner = across - size(key)[0] / 2
                if inner < walk + 4:
                    sys.exit(f"{zone}: {key} at across {across} has its inner edge at {inner}")
        left, right = p["sides"]["left"], p["sides"]["right"]
        for kind in ("lot", "gap"):
            groups = p[f"{kind}s"]
            n = len(groups)
            for k in range(n):
                a, b = ((sd[f"{kind}Start"] + k * sd[f"{kind}Stride"]) % n for sd in (left, right))
                if a == b and groups[a]:
                    sys.exit(f"{zone}: the sides take the same {kind} in step")


def table():
    """The placement table as JSON, with the shadowed keys."""
    check_placement()
    out = {}
    for zone, p in PLACEMENT.items():
        def props(group):
            return [{"key": k, "across": a, "dz": dz} for k, a, dz in group]
        out[zone] = {"slot": p["slot"], "lots": [props(g) for g in p["lots"]], "gaps": [props(g) for g in p["gaps"]],
                     "sides": p["sides"], "shadowColour": K[SHADOWS[zone]]}
    return {"shadowed": list(SHADOWED), "zones": out}


def write_table():
    """Write the placement table to TABLE_JSON, as table prints it, for the game to read."""
    with open(TABLE_JSON, "w") as f:
        f.write(json.dumps(table(), indent=2) + "\n")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "table":
        print(json.dumps(table(), indent=2))
    elif sys.argv[1:] == ["table", "--write"]:
        write_table()
    else:
        check_placement()
        main(sys.argv, sprites, "art/roadside", __doc__, grounds=GROUNDS)
        if sys.argv[1:] == ["build"]:
            write_table()
