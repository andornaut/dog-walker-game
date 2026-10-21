#!/usr/bin/env python3
"""Mock: three replacements for the "!" over obstacles that open a card.

Draws 360x560 walk screens in Endesga 32 from the exported art, through help.py's Scene grown to
the full screen in the current camera: the top bar, the first zone's backdrop and road, the pack,
and the doghouse row. Each frame shows the same scene: card obstacles near (about 150 road px
ahead), mid (about 450) and far (near the far edge, 720), each at its depth step, with a plain
obstacle beside each.

- ring: a pulsing ground ring under each card obstacle, wider than its sprite, flattened like
  its shadow and drawn with it under the sprite. Pink between two purple lines.
- outline: a 2px outline round the card obstacle's sprite, pink inside purple, at every depth.
- bubble: a speech bubble with two fanned playing cards over the obstacle, drawn at the
  obstacle's scale, bobbing 1 then 2px.

Pink (f6757a) and purple (68386c) are on no pickup (amber, orange, yellow, cream) and on no
hazard warning (yellow on ink). Pink carries Elm Avenue (3.6:1) and purple the light roads.

Under each frame: the cue's animation frames (or, for the static outline, its three depths) at
2x, then the near squirrel with its cue on every zone's road at 1x. reduced-motion.png shows each
cue's still form; contact.png the three frames side by side.

Usage:
  mock_card_cue.py build    write public/art/mocks/card-cue/*.png

Run from the repository root. Mock tooling only: nothing here is game art.
"""

import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import help as hp  # noqa: E402
from pixel import contrast  # noqa: E402

OUT = "public/art/mocks/card-cue"
W, H = 360, 560
ZONE = hp.FIRST_ZONE
BAND = hp.LAYOUT["regions"]["backdrop"]
APPROACH = hp.LAYOUT["regions"]["approach"]["y"]
FAR_Y = hp.LAYOUT["regions"]["road"]["y"]
DOG_BAND_Y = 466
FADE_ROWS = 12
BAYER_4 = (0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5)
DOGS = ("koda", "biscuit", "duchess")
CUE, EDGE, DIM = "pink", "purple", "mauve"

# The scene: (key, tag, lane centre in screen columns, road px ahead, opens a card).
LANES = hp.LAYOUT["lanes"]["centers"]
OBJECTS = [
    ("skunk", "idle", LANES[3], 680, True), ("cone", "idle", LANES[4], 690, False),
    ("puddle", "idle", (LANES[3] + LANES[4]) / 2, 430, True), ("parked-car", "idle", LANES[2], 470, False),
    ("other-dog", "idle", LANES[1], 450, True), ("bin", "idle", LANES[0], 455, False),
    ("thief", "idle", LANES[3], 165, True), ("mail-carrier", "idle", LANES[4], 150, False),
    ("squirrel", "idle", LANES[1], 150, True), ("cone", "idle", LANES[0], 160, False),
]
FLAT = {"puddle"}
NEAR = ("squirrel", "idle", LANES[1], 150, True)


def use():
    """Point help.py's projection at the full screen in the current camera."""
    hp.W, hp.H, hp.OX, hp.TOP = W, H, 0, 0


# ---------- the cues ----------

def ellipse_ring(sc, cx, cy, rx, ry, layers):
    """Concentric flattened ellipses round (cx, cy), outermost first, one colour per 1px layer; the
    hole inside the last is left alone."""
    px = sc.img.load()
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            if not (0 <= x < sc.img.width and 0 <= y < sc.img.height):
                continue
            col = None
            for i, c in enumerate([*layers, None]):
                a, b = rx - i, ry - i
                if a <= 0 or b <= 0:
                    break
                dx, dy = (x + 0.5 - cx) / a, (y + 0.5 - cy) / b
                if dx * dx + dy * dy > 1:
                    break
                col = c
            if col is not None:
                px[x, y] = hp.rgb(col)


def ring(sc, cx, foot, w, s, phase):
    """The ground ring under a sprite w opaque px wide at scale s: 6 road px wider each side,
    a third as tall as wide like a flattened shadow, its band 2px from the 0.75 step up and 1px
    below. The pulse grows it 1 then 2 screen px, the last frame in the dimmer mauve."""
    grow = (0, 1, 2)[phase]
    rx = w / 2 + 6 * s + grow
    ry = max(4, rx * 0.3)
    band = 2 if s >= 0.75 else 1
    ellipse_ring(sc, cx, foot - 1, rx, ry, [EDGE] + [DIM if phase == 2 else CUE] * band + [EDGE])


def outlined(sprite):
    """The sprite on a canvas 2px larger each side, ringed 1px pink inside 1px purple."""
    w, h = sprite.width + 4, sprite.height + 4
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    a = Image.new("L", (w, h), 0)
    a.paste(sprite.getchannel("A").point(lambda v: 255 if v else 0), (2, 2))
    m = a.load()

    def grown(src):
        g = Image.new("L", (w, h), 0)
        q, p = src.load(), g.load()
        for y in range(h):
            for x in range(w):
                if q[x, y] or any(q[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                                  if 0 <= x + dx < w and 0 <= y + dy < h):
                    p[x, y] = 255
        return g

    one = grown(a)
    two = grown(one)
    o, p1, p2 = out.load(), one.load(), two.load()
    for y in range(h):
        for x in range(w):
            if m[x, y]:
                continue
            if p1[x, y]:
                o[x, y] = (*hp.rgb(CUE), 255)
            elif p2[x, y]:
                o[x, y] = (*hp.rgb(EDGE), 255)
    out.paste(sprite, (2, 2), sprite)
    return out


def bubble(s):
    """A speech bubble at scale s: white, a 1px purple line, a tail down the middle, and two fanned
    playing cards inside (a mauve one behind, a pink one with a white diamond in front). 21x14 with
    a 4-row tail at 1x; shapes scale, 1px lines stay 1px."""
    bw, bh, tail = max(11, round(21 * s)), max(9, round(14 * s)), max(2, round(4 * s))
    img = Image.new("RGBA", (bw, bh + tail), (0, 0, 0, 0))
    px = img.load()
    edge, white = (*hp.rgb(EDGE), 255), (*hp.rgb("white"), 255)
    for y in range(bh):
        for x in range(bw):
            corner = (x in (0, bw - 1)) and (y in (0, bh - 1))
            if corner:
                continue
            border = x in (0, bw - 1) or y in (0, bh - 1) or (x in (1, bw - 2) and y in (1, bh - 2))
            px[x, y] = edge if border else white
    mid = bw // 2
    for i in range(tail):
        half = tail - 1 - i
        for x in range(mid - half - 1, mid + half + 2):
            if 0 <= x < bw:
                px[x, bh - 1 + i] = edge if x in (mid - half - 1, mid + half + 1) or i == tail - 1 else white
    for x in range(mid - tail + 1, mid + tail):
        if 0 < x < bw - 1:
            px[x, bh - 1] = white
    # the cards: about 7x9 at 1x, the back one 3px left and 1px up
    cw, ch = max(4, round(7 * s)), max(5, round(9 * s))
    off = max(2, round(3 * s))
    fx, fy = mid - cw // 2 + off // 2, (bh - ch) // 2 + 1
    for (x0, y0, fill) in ((fx - off, fy - 1, DIM), (fx, fy, CUE)):
        for y in range(y0, y0 + ch):
            for x in range(x0, x0 + cw):
                if 0 <= x < bw and 0 <= y < bh:
                    line = x in (x0, x0 + cw - 1) or y in (y0, y0 + ch - 1)
                    px[x, y] = edge if line else (*hp.rgb(fill), 255)
    cx, cy = fx + cw // 2, fy + ch // 2
    r = 1 if ch < 9 else 2
    for dy in range(-r, r + 1):
        for dx in range(-(r - abs(dy)), r - abs(dy) + 1):
            if abs(dx) <= max(0, (cw - 3) // 2):
                px[cx + dx, cy + dy] = white
    return img


# ---------- the scene ----------

def place(sc, obj, option, phase):
    """One road object at its depth step, with its shadow and, if it opens a card, the option's cue
    in the given animation phase."""
    key, tag, x, d, card = obj
    sx, sy, s = sc.at(x, d)
    sprite = hp.depth_frame(key, tag, s)
    foot = round(sy)
    w = sprite.getbbox()[2] - sprite.getbbox()[0]
    if key not in FLAT:
        sc.shadow(round(sx), foot, sprite.width)
    if card and option == "ring":
        ring(sc, round(sx), foot, w, s, phase)
    left, top = sx - sprite.width / 2, foot - sprite.height
    if card and option == "outline":
        sc.paste(outlined(sprite), left - 2, top - 2)
    else:
        sc.paste(sprite, left, top)
    if card and option == "bubble":
        b = bubble(s)
        lift = (0, -1, -2)[phase]
        sc.paste(b, round(sx) - b.width // 2, top + sprite.getbbox()[1] - b.height - max(1, round(2 * s)) + lift)


def fade_covers(x, row):
    return (BAYER_4[(row & 3) * 4 + (x & 3)] + 0.5) / 16 < (FADE_ROWS - row - 0.5) / FADE_ROWS


ROADS = {}


def ground(zone):
    """The zone's projected road and verges, the backdrop over rows 40 to 125 and the approach
    rows faded into it, as the build draws them. Cached per zone."""
    if zone not in ROADS:
        sc = hp.Scene(W, H)
        sc.road(zone)
        road = sc.img.copy()
        backdrop = hp.image(f"backdrop-{hp.ZONES[zone]['art']}")
        sc.img.paste(backdrop.crop((0, 0, W, FAR_Y - BAND["y"])), (0, BAND["y"]))
        band_row = backdrop.crop((0, BAND["height"] - 1, W, BAND["height"]))
        for y in range(APPROACH, FAR_Y):
            _, s = hp.distance_at(y)
            for x in range(W):
                if hp.STRIP_X <= hp.CX + (x + 0.5 - hp.CX) / s < hp.STRIP_X + hp.STRIP_W:
                    row = y - APPROACH
                    src = band_row.getpixel((x, 0)) if row < FADE_ROWS and fade_covers(x, row) else road.getpixel((x, y))
                    sc.img.putpixel((x, y), src[:3])
        ROADS[zone] = sc.img
    return ROADS[zone]


def bottom_panel():
    panel = hp.Scene(W, H - DOG_BAND_Y)
    band = hp.image("ui-dog-band")
    panel.img.paste(band, (0, 0), band)
    for i, d in enumerate(DOGS):
        panel.doghouse(i * 120, 470 - DOG_BAND_Y, d, hp.dog(d)[3])
    return panel.img


def scene(option, phase=0, zone=ZONE, objects=OBJECTS, chrome=True, title=None):
    sc = hp.Scene(W, H)
    sc.img = ground(zone).copy()
    sc.shade, sc.leash_col = hp.ZONES[zone]["shadow"], hp.ZONES[zone]["leash"]
    for obj in sorted(objects, key=lambda o: -o[3]):
        place(sc, obj, option, phase)
    if chrome:
        sc.pack(LANES[2], tuple(f"dog-{d}" for d in DOGS))
        sc.top_bar([zone], 0, 1, 0.3)
        b = hp.TOP_BAR["buttons"]["sound"]
        sc.paste(hp.frame("ui-icon-button", "normal"), b["face"]["x"], b["face"]["y"])
        sc.paste(hp.frame("icon-sound", "on"), b["icon"]["x"], b["icon"]["y"])
        sc.img.paste(bottom_panel(), (0, DOG_BAND_Y))
    if title:
        w = hp.text_w(title) + 12
        sc.bubble((W - w) // 2, 44, w, [title])
    return sc.img


def crop_near(img, w=58, h=76):
    sx, sy, _ = hp.Scene(W, H).at(NEAR[2], NEAR[3])
    x0, y0 = round(sx) - w // 2, round(sy) - h + 14
    return img.crop((x0, y0, x0 + w, y0 + h))


def crop_at(img, obj, w=58, h=76):
    sx, sy, s = hp.Scene(W, H).at(obj[2], obj[3])
    x0, y0 = round(sx) - w // 2, round(sy) - h + 14
    return img.crop((x0, y0, x0 + w, y0 + h))


ANIM_LABEL = {"ring": "PULSE, 3 FRAMES AT 2X", "outline": "STATIC: NEAR, MID, FAR AT 2X", "bubble": "BOB, 3 FRAMES AT 2X"}


def option_sheet(option, title):
    """The frame with its strips under it: the animation (or depths) at 2x, then every zone."""
    frame = scene(option, 0, title=title)
    tiles = []
    if option == "outline":
        near_mid_far = [o for o in OBJECTS if o[4] and o[0] in ("squirrel", "other-dog", "skunk")]
        tiles = [crop_at(frame, o) for o in sorted(near_mid_far, key=lambda o: o[3])]
    else:
        tiles = [crop_near(scene(option, p, chrome=False)) for p in range(3)]
    zones = []
    for z in hp.ZONES:
        zones.append((z, crop_near(scene(option, 0, zone=z, objects=[NEAR], chrome=False), 116, 76)))
    sheet = hp.Scene(W, H + 10 + 152 + 14 + 2 * (76 + 12) + 4)
    sheet.img.paste(frame, (0, 0))
    y = H + 4
    hp.text(sheet, ANIM_LABEL[option], 2, y, "lgrey")
    y += 8
    for i, t in enumerate(tiles):
        sheet.img.paste(t.resize((t.width * 2, t.height * 2), Image.NEAREST), (i * 122, y))
    y += 152 + 6
    hp.text(sheet, "EVERY ZONE ROAD, 1X", 2, y, "lgrey")
    y += 8
    for i, (z, t) in enumerate(zones):
        x, yy = (i % 3) * 122, y + (i // 3) * 88
        sheet.img.paste(t, (x, yy))
        name = hp.ZONES[z]["name"].upper().replace("THE ", "")
        hp.text(sheet, name, x + 2, yy + 78, "grey")
    return sheet.img


def reduced_motion():
    """Each cue's still form on the near squirrel, at 2x: the ring at rest size, the outline as
    is, the bubble at rest."""
    labels = (("ring", "RING: STEADY"), ("outline", "OUTLINE: AS IS"), ("bubble", "BUBBLE: STILL"))
    sheet = hp.Scene(W, 10 + 152 + 2)
    for i, (option, label) in enumerate(labels):
        t = crop_near(scene(option, 0, chrome=False))
        hp.text(sheet, label, i * 122 + 2, 2, "lgrey")
        sheet.img.paste(t.resize((t.width * 2, t.height * 2), Image.NEAREST), (i * 122, 10))
    return sheet.img


def build():
    use()
    os.makedirs(OUT, exist_ok=True)
    roads = {z: hp.ZONES[z]["name"] for z in hp.ZONES}
    for z in hp.ZONES:
        road = "%02x%02x%02x" % max(hp.TILES[z].getcolors(1 << 16))[1][:3]
        print(f"{roads[z]:18} road {road}  pink {contrast(CUE, road):.2f}  purple {contrast(EDGE, road):.2f}")
    sheets = {}
    for option, title in (("ring", "1. GROUND RING"), ("outline", "2. OUTLINE"), ("bubble", "3. CARD BUBBLE")):
        sheets[option] = option_sheet(option, title)
        sheets[option].save(f"{OUT}/{option}.png")
    reduced_motion().save(f"{OUT}/reduced-motion.png")
    w, h = sheets["ring"].size
    contact = Image.new("RGB", (w * 3 + 16 * 2, h), hp.rgb("ink"))
    for i, option in enumerate(sheets):
        contact.paste(sheets[option], (i * (w + 16), 0))
    contact.save(f"{OUT}/contact.png")
    print("built", ", ".join([*sheets, "reduced-motion", "contact"]))


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
