"""The walk screen in the game's projection, for the Toronto mocks (mock_toronto_*.py): the
projected road and its verges, road sprites at their depth steps, the walker and the pack on
their leashes, the top bar and the dog slots. Shared drawing tools are in scene.py.

A W x H image shows the run screen's bottom H rows, centred on the road. Each mock points it at
its own screen and camera by setting W, H, OX, TOP, YH, F and KS (and FOOT) here before drawing.
Run from the repository root. Mock tooling only: nothing here is game art. It has no commands.
"""

import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import scene as sn  # noqa: E402
from pixel import K  # noqa: E402
from scene import LAYOUT, TILES, ZONES, frame, image, rgb, text, text_c, text_w  # noqa: E402
from ui import ZONE_COLOURS  # noqa: E402

W, H = 344, 236
GAME = sn.GAME
DOGS = {d["id"]: d for d in GAME["dogs"]}
WALK_LENGTH = GAME["world"]["walkLength"]


def tuning(*path):
    v = GAME["tuning"]
    for key in path:
        v = v[key]
    return v


def dog(key):
    """A dog: (name, owner name, max hearts, starting hearts)."""
    d = DOGS[key]
    return d["name"].upper(), d["owner"]["name"].upper(), d["figures"]["maxHearts"], d["figures"]["startHearts"]


def mood(hearts):
    """The owner's face at this many hearts, as the game's faceMood."""
    if hearts >= tuning("hearts", "faceHappyFrom"):
        return "happy"
    return "neutral" if hearts >= tuning("hearts", "faceNeutralFrom") else "upset"


# ---------- the projected road, as src/layout/projection.ts draws it ----------
# A point d road pixels ahead of the walker's feet draws at scale s = F / (F + d), on screen
# row YH + KS s. Image column x is screen column x + OX, image row y screen row y + TOP, so the
# feet (screen row FOOT) land on row H - 8.

CAMERA = LAYOUT["camera"]
YH, FOOT, F = CAMERA["horizonY"], CAMERA["footY"], CAMERA["focal"]
KS = FOOT - YH
CX = CAMERA["centerX"]          # the road's centre on screen, verges either side out to the screen's edges
OX, TOP = CX - W // 2, FOOT - (H - 8)
STRIP_X, STRIP_W = LAYOUT["regions"]["road"]["x"], LAYOUT["regions"]["road"]["width"]
# The verge beside the road, as src/layout/roadside.ts: across is the distance from the road's
# centre line in road pixels; the curb to curbTo, the strips (bands out to each one's to), the
# sidewalk or paving to walkTo (on out where walkTo is null), then lawn. Colours are hex strings
# here. A plain grey sidewalk stands in where the export has no strips, walk or seam fields.
SIDEWALK = dict(strips=[], walkColor=K["lgrey"], walkDots=[], seamColor=K["grey"], seamEvery=32)


def hexed(c):
    return "%06x" % c if isinstance(c, int) else c


VERGES = {z: {**SIDEWALK, **v, "curbColor": hexed(v["curbColor"]),
              "walkColor": hexed(v.get("walkColor", SIDEWALK["walkColor"])),
              "seamColor": hexed(v.get("seamColor", SIDEWALK["seamColor"])),
              "walkTo": 10 ** 6 if v["walkTo"] is None else v["walkTo"]}
          for z, v in LAYOUT["verges"].items()}
MOWN = (44, 62, 36, 70, 50, 58, 40, 66)   # stripe widths out from the sidewalk, light then dark
SEAM_MAX_SPAN = 16
STEPS = {step["scale"]: step["suffix"] for step in LAYOUT["depthSteps"]}
# The pack's formations, as src/layout/packFormation.ts: each dog's (side, distance ahead of the
# feet) by pack size, the first dog leading, a side dog standing sideDx(its opaque width) off the
# lane centre.
FORMATIONS = {n + 1: [(p["side"], -p["footDy"]) for p in f] for n, f in enumerate(sn.PACK["formations"])}
TOP_BAR = LAYOUT["topBar"]
DOGHOUSE = LAYOUT["doghouse"]["parts"]


def noise(x, y):
    """A fixed pseudo-random value in [0, 1) per pair of integers, as roadside.ts's noise."""
    h = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65536


def distance_at(y):
    """The road distance drawn on screen row y's centre, and the row's ground scale."""
    s = (y + 0.5 - YH) / KS
    return F / s - F, s


def dot(dots, value):
    """The dot colour a noise value in [0, 1) picks, or None: each dot takes its share of the range in
    turn, its colours equal parts of that share, as roadside.ts's dotColor."""
    for d in dots:
        if value < d["share"]:
            return hexed(d["colors"][math.floor(value / d["share"] * len(d["colors"]))])
        value -= d["share"]
    return None


def verge(zone, across, s, z, span, rx=0):
    """The colour beside the road at across (rx signed, negative on the left), on a row of scale s
    covering span road pixels from z: the curb, the strips, the sidewalk or paving with a seam every
    seamEvery, the strips and the paving with their dots, then the lawn, mown in stripes (none
    narrower than 4px on screen) or rough, with sparse tufts."""
    v = VERGES[zone]
    walk_to, lawn = v["walkTo"], v["lawn"]
    if across < v["curbTo"]:
        return v["curbColor"]
    for strip in v["strips"]:
        if across < strip["to"]:
            return dot(strip["dots"], noise(math.floor(rx), math.floor(z))) or hexed(strip["color"])
    if across < walk_to:
        if span < SEAM_MAX_SPAN and z // v["seamEvery"] != (z - max(span, 1)) // v["seamEvery"]:
            return v["seamColor"]
        return dot(v["walkDots"], noise(math.floor(rx), math.floor(z))) or v["walkColor"]
    col, rest, i = "green", across - walk_to, 0
    while lawn == "mown" and rest < 300 and rest >= MOWN[i % len(MOWN)]:
        rest -= MOWN[i % len(MOWN)]
        i += 1
    if lawn == "mown" and rest < 300 and i % 2 and MOWN[i % len(MOWN)] * s >= 4:
        col = "dgreen"
    if noise(int(across), int(z) // 2) < 0.03:
        col = "forest" if col == "dgreen" else "dgreen"
    return col


def depth_frame(key, tag, s, i=0):
    """A frame at scale s as src/layout/depthScale.ts draws it: its larger side floor(side x s + 0.5),
    s capped at 1, from the smallest of its art steps (1x and the redrawn key@88 to key@50 it has) at
    least that size, scaled down nearest-neighbour."""
    art = frame(key, tag, i)
    size = max(1, math.floor(max(art.size) * min(1, s) + 0.5))
    for step, suffix in STEPS.items():
        if step < 1 and os.path.exists(f"public/art/sprites/{key}{suffix}.json"):
            f = frame(f"{key}{suffix}", tag, i)
            if size <= max(f.size) < max(art.size):
                art = f
    if max(art.size) == size:
        return art
    k = size / max(art.size)
    return art.resize((max(1, math.floor(art.width * k + 0.5)), max(1, math.floor(art.height * k + 0.5))),
                      Image.NEAREST)


class Scene(sn.Scene):
    def road(self, zone):
        """The zone's road in projection: each image row samples one row of the road-<zone>
        strip at its distance, counting strip rows down the road as the game does, and the
        verge beside it."""
        self.shade, self.leash_col = ZONES[zone]["shadow"], ZONES[zone]["leash"]
        tile, px = TILES[zone].load(), self.img.load()
        for y in range(H):
            z, s = distance_at(y + TOP)
            span = z - distance_at(y + TOP + 1)[0]
            row = (63 - math.floor(z)) % 64
            for x in range(W):
                rx = CX + (x + OX + 0.5 - CX) / s
                if STRIP_X <= rx < STRIP_X + STRIP_W:
                    px[x, y] = tile[math.floor(rx - STRIP_X), row]
                else:
                    px[x, y] = rgb(verge(zone, abs(rx - CX), s, z, span, rx - CX))

    def at(self, x, d):
        """Where the road point at image column x (on the flat road at the feet) d road pixels
        ahead draws: its image column, row and scale."""
        s = F / (F + d)
        return W / 2 + (x - W / 2) * s, YH + KS * s - TOP, s

    def stand(self, key, tag, x, d, i=0, flip=False, shadow=True):
        """A road sprite standing at road point x, d at its depth step, on its shadow."""
        sx, sy, s = self.at(x, d)
        sprite = depth_frame(key, tag, s, i)
        if shadow:
            self.shadow(round(sx), round(sy), sprite.width)
        self.paste(sprite, sx - sprite.width / 2, round(sy) - sprite.height, flip)
        return sx, sy, s

    def pack(self, cx, dogs=("dog-koda", "dog-biscuit", "dog-duchess"), lead_tag="walk"):
        """The walker at the feet in lane centre cx and the dogs ahead of her in the game's
        formation, far ones first, with a leash from her hand to each collar (collar(key) over a dog's
        feet, its last opaque row; the hands HANDS[2] over the walker's). The leashes run under
        the walker, who hides the part behind her, and over the dogs and their shadows. Returns
        where each stands: image column, row and scale."""
        def feet(key, tag, sy, s):
            f = depth_frame(key, tag, s)
            return round(sy) - f.height + f.getbbox()[3] - 1

        items = [(k, sn.side_dx(k, side), d, lead_tag if i == 0 else "walk")
                 for i, (k, (side, d)) in enumerate(zip(dogs, FORMATIONS[len(dogs)]))]
        placed = {k: self.stand(k, tag, cx + dx, d) for k, dx, d, tag in sorted(items, key=lambda it: -it[2])}
        sx, sy, _ = self.at(cx, 0)
        walker = frame("walker-casey", "walk")
        self.shadow(round(sx), round(sy), walker.width)
        hands = feet("walker-casey", "walk", sy, 1) - sn.HANDS[2]
        for k, dx, _, tag in items:
            x, y, s = placed[k]
            hand = sn.HANDS[0] if dx < 0 else sn.HANDS[1]
            self.line(cx + hand, hands, round(x), round(feet(k, tag, y, s) - sn.collar(k) * s), self.leash_col)
        placed["walker-casey"] = self.stand("walker-casey", "walk", cx, 0, shadow=False)
        return placed

    def top_bar(self, route, money, treats, fill=None):
        """ui-top-bar as HudScene fills it, in screen pixels less 16 columns cut from the empty
        left end of the zone well, so it fits the image's width: the money, the treat count, the
        Home and pause buttons, and the zone with a pip per zone of the walk: the zones walked
        (route, the last of them current) done, the current one filled fill of the way in its
        colour (done where fill is None), the ones ahead not yet chosen."""
        bar, cut = image("ui-top-bar"), 200
        self.paste(bar.crop((0, 0, cut, 40)), 0, 0)
        self.paste(bar.crop((cut + bar.width - W, 0, bar.width, 40)), cut, 0)
        r = TOP_BAR["wells"]["zone"]["nameRight"] - (LAYOUT["screen"]["width"] - W)  # the zone well's right edge
        self.paste(image("icon-money"), 8, 13)
        text(self, "$", 26, 15, "amber", 2); text(self, f"{money:g}", 26 + text_w("$", 2) + 2, 15, "cream", 2)
        self.paste(image("icon-treat"), 100, 13)
        text(self, f"{treats}/{tuning('counts', 'treatCarryMax'):g}", 118, 18, "cream")
        for name in ("home", "pause"):
            b = TOP_BAR["buttons"][name]
            self.paste(frame("ui-icon-button", "normal"), b["face"]["x"], b["face"]["y"])
            self.paste(image(f"icon-{name}"), b["icon"]["x"], b["icon"]["y"])
        zone = ZONES[route[-1]]
        name = zone["name"].upper()
        text(self, name, r - text_w(name), 10, "cream")
        self.paste(image(f"icon-zone-{zone['art']}"), r - text_w(name) - 19, 4)
        for i in range(WALK_LENGTH):
            x = r - 81 + i * 21
            art = ZONES[route[i]]["art"] if i < len(route) else None
            current = i == len(route) - 1 and fill is not None
            self.paste(frame("ui-zone-pips", "todo" if art is None else art if current else f"{art}-done"), x, 22)
            if current:
                self.fill(x + 1, 23, round(fill * 16), 6, ZONE_COLOURS[art])

    def doghouse(self, x, y, key, hearts):
        """A 120x90 dog slot as ui-doghouse lays it out, in slot pixels: the dog's file card, the
        name centred at 60 with its caps from row 6 on the header's name plate (at 2x where it fits
        name.width), the dog in its photo at (6, 24), the owner in theirs at (42, 24), the hearts
        from (78, 26) in rows of five 8px apart in the hearts box with the n/max count centred at
        (98, 46) under them, the status boxes at (78, 62) and (98, 62) left empty, and the owner's
        name at x 6 on the ID line (rows 60 to 70). At 0 hearts the owner has fired you: the card
        is the grey empty one with FIRED in white centred on its plate (caps from row 74)."""
        name, owner, max_h, _ = dog(key)
        self.paste(frame("ui-doghouse", key if hearts else "empty"), x, y)
        plate = DOGHOUSE["name"]
        text_c(self, name, x + plate["x"], y + plate["y"], "plum", 2 if text_w(name, 2) <= plate["width"] else 1)
        if not hearts:
            fired = DOGHOUSE["fired"]
            text_c(self, "FIRED", x + fired["x"], y + fired["y"], "white")
            return
        m, dog_face, owner_face, row = mood(hearts), DOGHOUSE["dogFace"], DOGHOUSE["ownerFace"], DOGHOUSE["hearts"]
        self.paste(frame(f"face-dog-{key}", m), x + dog_face["x"], y + dog_face["y"])
        self.paste(frame(f"face-owner-{key}", m), x + owner_face["x"], y + owner_face["y"])
        for j in range(max_h):
            self.paste(frame("ui-heart", "full" if j < hearts else "empty"),
                       x + row["x"] + j % row["perRow"] * row["pitchX"], y + row["y"] + j // row["perRow"] * row["pitchY"])
        count = DOGHOUSE["heartCount"]
        text_c(self, f"{hearts}/{max_h}", x + count["x"], y + count["y"], "dred")
        text(self, owner, x + 6, y + 63, "plum")


def lane(n):
    """Lane n's centre, in image columns."""
    return LAYOUT["lanes"]["centers"][n] - OX
