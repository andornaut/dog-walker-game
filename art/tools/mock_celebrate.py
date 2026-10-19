#!/usr/bin/env python3
"""Mock: the zone celebration, in its two versions, over the paused and dimmed run screen.

Draws 360x560 frames in Endesga 32 from the exported art: the top bar, the zone's backdrop, its
road in the game's projection with the pack on it, the doghouse row, then the road view dimmed two
ramp steps (rows 150 to 465), with the celebration over it:

- new-walker: the first finish of zone 1 (Elm Avenue). "NEW WALKER!" in font-display at 2x over
  "BEN JOINS YOU!" in font-display-cream, Ben cheering at 2x on a starburst, his line in a speech
  bubble whose tail points up at him, his pace and style with their icons, and the green
  "Welcome!" button.
- zone-done: a later zone (Willow Crescent, the walk's second). "ZONE DONE!" at 2x over
  "WILLOW CRESCENT", Casey cheering at 2x on the starburst, and the zone's fees and tips on a
  cream plate. It moves on by itself, so it has no button.
- cheer-strip: each walker's cheer, every frame at 2x, beside the walker's face at 2x.
- new-art: the pieces drawn only here, at 1x and 3x: the starburst, the confetti bits and the
  tail that points up.

Drawn only here: the cheer pose (both arms raised from the shoulders in a V, a crouch, then a hop
of up to 3px), the starburst (ui.sticker's yellow body and amber spikes, as a round burst), the
falling confetti bits (fx- pieces in a plum rim) and the upward quip tail.

Usage:
  mock_celebrate.py build    write public/art/mocks/celebrate/*.png

Run from the repository root. Mock tooling only: nothing here is game art.
"""

import math
import os
import sys
import xml.etree.ElementTree as ET

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import fonts  # noqa: E402
import help as hp  # noqa: E402
import road  # noqa: E402
from pixel import DARKER, K, Grid, edged  # noqa: E402
from ui import chrome, chrome_shape, to_image  # noqa: E402

OUT = "public/art/mocks/celebrate"
ART = "public/art"
W, H = 360, 560
ROAD_VIEW = (150, 466)  # the dimmed rows: the road view down to ui-dog-band's top row
WALKERS = ("casey", "ben", "ada", "trista")
WALKER = {w["id"]: w for w in hp.GAME["walkers"]}
STYLE_NAME = {"charm": "Charmer", "hustle": "Hustler"}

# The full-screen run is help.py's scene with the page grown to the screen: column x is screen
# column x, row y screen row y.
hp.W, hp.H, hp.OX, hp.TOP = W, ROAD_VIEW[1] + 4, 0, 0


def rgb(c):
    c = K.get(c, c)
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


# ---------- BMFonts ----------

class Font:
    def __init__(self, key, tint=True):
        root = ET.parse(f"{ART}/fonts/{key}.fnt").getroot()
        self.page = Image.open(f"{ART}/fonts/{key}.png").convert("RGBA")
        self.tint = tint
        self.chars = {int(c.get("id")): {k: int(c.get(k)) for k in
                                         ("x", "y", "width", "height", "xoffset", "yoffset", "xadvance")}
                      for c in root.iter("char")}
        self.kern = {(int(k.get("first")), int(k.get("second"))): int(k.get("amount")) for k in root.iter("kerning")}

    def glyph(self, ch, col):
        c = self.chars[ord(ch)]
        g = self.page.crop((c["x"], c["y"], c["x"] + c["width"], c["y"] + c["height"]))
        if self.tint and c["width"]:
            px, colour = g.load(), rgb(col)
            for y in range(g.height):
                for x in range(g.width):
                    if px[x, y][3]:
                        px[x, y] = colour
        return g

    def width(self, s, sc=1):
        w, prev = 0, None
        for ch in s:
            if prev is not None:
                w += self.kern.get((ord(prev), ord(ch)), 0)
            w += self.chars[ord(ch)]["xadvance"]
            prev = ch
        last = self.chars[ord(s[-1])]
        return (w - (last["xadvance"] - (last["xoffset"] + last["width"]))) * sc

    def draw(self, cv, s, x, y, col="plum", sc=1, align="left"):
        """s with its line's top at y; align left, centre or right of x. Returns the pen's end."""
        if align == "centre":
            x -= self.width(s, sc) // 2
        elif align == "right":
            x -= self.width(s, sc)
        pen, prev = 0, None
        for ch in s:
            if prev is not None:
                pen += self.kern.get((ord(prev), ord(ch)), 0)
            c = self.chars[ord(ch)]
            if c["width"]:
                g = self.glyph(ch, col)
                if sc != 1:
                    g = g.resize((g.width * sc, g.height * sc), Image.NEAREST)
                cv.alpha_composite(g, (x + (pen + c["xoffset"]) * sc, y + c["yoffset"] * sc))
            pen += c["xadvance"]
            prev = ch
        return x + pen * sc


BODY, TITLE = Font("font-body"), Font("font-title")
DISPLAY, DISPLAY_CREAM = Font("font-display", tint=False), Font("font-display-cream", tint=False)
# Rows from a line's top to its capitals' top, at 1x.
BODY_CAP, TITLE_CAP, DISPLAY_CAP = 2, 4, 2


def body(cv, s, x, cap_y, col="plum", align="left", sc=2):
    return BODY.draw(cv, s, x, cap_y - BODY_CAP * sc, col, sc, align)


def title(cv, s, x, cap_y, col="plum", align="left", sc=2):
    return TITLE.draw(cv, s, x, cap_y - TITLE_CAP * sc, col, sc, align)


def display(cv, font, s, cx, cap_y, sc=1):
    """Sign lettering centred on cx, its capitals' outline from cap_y."""
    font.draw(cv, s, cx, cap_y - DISPLAY_CAP * sc, sc=sc, align="centre")


# ---------- exported art ----------

def image(key):
    return Image.open(f"{ART}/images/{key}.png").convert("RGBA")


def frame(key, tag, i=0):
    return hp.frame(key, tag, i).convert("RGBA")


def fill(cv, x, y, w, h, c):
    cv.paste(Image.new("RGBA", (w, h), rgb(c)), (x, y))


def scaled(im, sc):
    return im.resize((im.width * sc, im.height * sc), Image.NEAREST)


def nine(src, w, h, left, right, top, bottom):
    """src stretched to w x h as a nine-slice, edges and middle stretched nearest-neighbour."""
    sw, sh = src.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    xs = [(0, left, 0, left), (left, sw - right, left, w - right), (sw - right, sw, w - right, w)]
    ys = [(0, top, 0, top), (top, sh - bottom, top, h - bottom), (sh - bottom, sh, h - bottom, h)]
    for sx0, sx1, dx0, dx1 in xs:
        for sy0, sy1, dy0, dy1 in ys:
            if sx1 > sx0 and sy1 > sy0 and dx1 > dx0 and dy1 > dy0:
                out.paste(src.crop((sx0, sy0, sx1, sy1)).resize((dx1 - dx0, dy1 - dy0), Image.NEAREST), (dx0, dy0))
    return out


# ---------- the cheer: both arms raised in a V, a crouch, then a hop ----------
# Each walker's front view (road.py's wave drawing) with the hanging arm taken off and both arms
# raised from the shoulders: the right one as the wave raises it, the left its mirror. ARMS gives
# the hanging arm on the 32x48 design grid (columns x0 to x1 - 1, rows y0 to y1 - 1 before the
# crouch) and its colours; only those colours are cleared, so Trista's tote stays on her shoulder.
ARMS = {
    "casey": (5, 9, 22, 35, ("sky", "cyan", "blue", "skin1")),
    "ben": (5, 9, 22, 35, ("green", "dgreen", "dbrown", "plum")),
    "ada": (7, 10, 30, 37, ("brown", "dbrown", "pink", "mauve")),
    "trista": (5, 9, 22, 35, ("dgreen", "forest", "green", "skin1")),
}
# The cheer's frames: (crouch, hands' swing out from the shoulders, hop in px at 1x).
CHEER = ((2, 1, 0), (0, 3, 2), (0, 4, 3), (1, 3, 0))
CHEER_MS = 120


def cheer_draw(name, swing):
    """road.py's front view of name with both arms raised swing design pixels out from the shoulders."""
    front, (x0, x1, y0, y1, cols) = road.WAVES[f"walker-{name}"], ARMS[name]
    hexes = {K[c] for c in cols}

    def draw(bob=0):
        lift = road.raised_arm

        def both(g, x, w, top, bottom, _dx, parts):
            inner, s = getattr(g, "g", g), getattr(g, "s", 1)
            for yy in range(math.floor((y0 + bob) * s), math.ceil((y1 + bob) * s)):
                for xx in range(math.floor(x0 * s), math.floor(x1 * s)):
                    if 0 <= yy < inner.h and inner.px[yy][xx] in hexes:
                        inner.px[yy][xx] = None
            lift(g, x, w, top, bottom, swing, parts)
            lift(g, 32 - x - w, w, top, bottom, -swing, parts)

        road.raised_arm = both
        try:
            g = front(wave=0, bob=bob)
            if name == "trista":
                g.p(5, 27 + bob, "dgreen")  # the apple's stem, which shares the sleeve's green
            return g
        finally:
            road.raised_arm = lift

    return draw


def cheer(name, i):
    """Frame i of name's cheer, 40x60 as the walker sprites."""
    crouch, swing, hop = CHEER[i]
    px = edged(road.big(cheer_draw(name, swing), bob=crouch)).outlined()
    px = px[hop:] + [[None] * len(px[0]) for _ in range(hop)]
    return to_image(px)


# ---------- new pieces ----------

def burst(w=148, h=132, points=18):
    """The starburst behind the cheering walker: ui-sticker's yellow body ringed by amber spikes, in an
    ink outline, round instead of a flat oval."""
    g = Grid(w, h)
    cx, cy = w / 2, h / 2
    rx, ry, spike = w / 2 - 12, h / 2 - 12, 10
    for y in range(h):
        for x in range(w):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            r = math.hypot(dx, dy)
            if r <= 1:
                g.p(x, y, "yellow")
                continue
            t = (math.atan2(dy, dx) / (2 * math.pi) * points + 0.5) % 1
            if (r - 1) * min(rx, ry) <= spike * (1 - abs(2 * t - 1)):
                g.p(x, y, "amber")
    out = [row[:] for row in g.px]
    for y in range(h):
        for x in range(w):
            if not out[y][x] and any(0 <= x + dx < w and 0 <= y + dy < h and out[y + dy][x + dx]
                                     for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0))):
                g.p(x, y, "ink")
    # a lit band inside the top-left of the body, as the sticker's flat body would catch the light
    for y in range(h):
        for x in range(w):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if 0.86 <= math.hypot(dx, dy) <= 0.92 and dx + dy < -0.6 and g.px[y][x] == K["yellow"]:
                g.p(x, y, "white")
    return to_image(g.px)


# The confetti bits: a piece in a 1px plum rim (the fx- rim), tumbling through four shapes.
BIT_SHAPES = (((0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)), ((0, 0), (1, 0), (2, 0), (3, 0)),
              ((0, 0), (1, 0), (1, 1), (2, 1), (2, 2)), ((0, 0), (0, 1), (0, 2), (0, 3)))
BIT_COLOURS = ("yellow", "cyan", "pink", "green", "white", "amber")


def bit(shape, colour):
    g = Grid(6, 6)
    for x, y in BIT_SHAPES[shape]:
        g.p(1 + x, 1 + y, colour)
    out = [row[:] for row in g.px]
    for y in range(6):
        for x in range(6):
            if not out[y][x] and any(0 <= x + dx < 6 and 0 <= y + dy < 6 and out[y + dy][x + dx]
                                     for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0))):
                g.p(x, y, "plum")
    return to_image(g.px).crop(to_image(g.px).getbbox())


def up_tail():
    """8x6, ui-quip-tail-down turned to point up from a bubble's top rim at the speaker."""
    rows = ["...#....", "..###...", "..####..", ".######.", ".######.", "########"]
    return to_image(chrome_shape(Grid(8, 6), lambda x, y: rows[y][x] == "#",
                                 lambda x, y: y > 5 and 1 <= x < 7, line=None).px)


def noise(i, k):
    return hp.noise(i * 7 + 3, k * 13 + 1)


def confetti(cv, seed, top=ROAD_VIEW[0] + 2, bottom=ROAD_VIEW[1] - 8, n=60):
    """Bits scattered down the road view as they fall, more near the top, each a colour and a tumble
    shape picked by noise."""
    for i in range(n):
        x = int(6 + noise(i, seed) * (W - 18))
        y = int(top + (noise(i, seed + 1) ** 1.4) * (bottom - top))
        cv.alpha_composite(bit(int(noise(i, seed + 2) * 4), BIT_COLOURS[int(noise(i, seed + 3) * 6)]), (x, y))


# ---------- the run screen under the celebration ----------

def top_bar(cv, route, money, treats):
    """ui-top-bar as HudScene fills it: the money, the treats, Home and pause, and the zone with its
    pips, the zones walked done."""
    cv.alpha_composite(image("ui-top-bar"), (0, 0))
    wells = hp.TOP_BAR["wells"]
    money_well, treat_well = wells["money"], wells["treats"]
    cv.alpha_composite(frame("tip", "idle"), (money_well["x"] + 4, money_well["y"] + 5))
    x = TITLE.draw(cv, "$", money_well["x"] + 22, money_well["y"] + 7, "amber", 2)
    TITLE.draw(cv, f"{money}", x + 2, money_well["y"] + 7, "cream", 2)
    cv.alpha_composite(frame("treat", "idle"), (treat_well["x"] - 1, treat_well["y"] + 5))
    TITLE.draw(cv, f"{treats}/{hp.tuning('counts', 'treatCarryMax'):g}", treat_well["x"] + treat_well["width"] - 2,
               treat_well["y"] + 10, "cream", 1, "right")
    for name, b in hp.TOP_BAR["buttons"].items():
        cv.alpha_composite(frame("ui-icon-button", "normal"), (b["face"]["x"], b["face"]["y"]))
        cv.alpha_composite(image(f"icon-{name}"), (b["icon"]["x"], b["icon"]["y"]))
    r = hp.TOP_BAR["wells"]["zone"]["nameRight"]
    zone = hp.ZONES[route[-1]]
    left = title(cv, zone["name"].upper(), r, 10, "cream", "right", sc=1) - TITLE.width(zone["name"].upper())
    cv.alpha_composite(image(f"icon-zone-{zone['art']}"), (left - 19, 4))
    for i in range(hp.WALK_LENGTH):
        art = hp.ZONES[route[i]]["art"] if i < len(route) else None
        cv.alpha_composite(frame("ui-zone-pips", "todo" if art is None else f"{art}-done"), (r - 81 + i * 21, 22))


def doghouse(cv, x, y, key, hearts):
    """One dog slot as ui-doghouse lays it out (help.py's Scene.doghouse) in the game's fonts."""
    d = hp.DOGS[key]
    parts = hp.DOGHOUSE
    cv.alpha_composite(frame("ui-doghouse", key), (x, y))
    name = d["name"].upper()
    sc = 2 if TITLE.width(name, 2) <= parts["name"]["width"] else 1
    title(cv, name, x + parts["name"]["x"], y + parts["name"]["y"] + 1, "plum", "centre", sc)
    mood = hp.mood(hearts)
    cv.alpha_composite(frame(f"face-dog-{key}", mood), (x + parts["dogFace"]["x"], y + parts["dogFace"]["y"]))
    cv.alpha_composite(frame(f"face-owner-{key}", mood), (x + parts["ownerFace"]["x"], y + parts["ownerFace"]["y"]))
    row, max_h = parts["hearts"], d["figures"]["maxHearts"]
    for j in range(max_h):
        cv.alpha_composite(frame("ui-heart", "full" if j < hearts else "empty"),
                           (x + row["x"] + j % row["perRow"] * row["pitchX"], y + row["y"] + j // row["perRow"] * row["pitchY"]))
    title(cv, f"{hearts}/{max_h}", x + parts["heartCount"]["x"], y + parts["heartCount"]["y"] + 1, "dred", "centre", 1)
    body(cv, d["owner"]["name"], x + 6, y + 63, "plum", sc=1)


def dim(cv, top, bottom):
    """The road view dimmed two ramp steps, staying on the palette."""
    px = cv.load()
    for y in range(top, bottom):
        for x in range(W):
            r, g, b, _ = px[x, y]
            key = "%02x%02x%02x" % (r, g, b)
            if key in DARKER:
                px[x, y] = rgb(DARKER[DARKER[key]])


def run_screen(route, money, treats, dogs):
    """The paused run screen after the zone's fees have landed, its road view dimmed. The road
    surface runs up over the backdrop's approach rows (126 to 149), beside the backdrop's verges."""
    zone = route[-1]
    scene = hp.Scene(W, hp.H)
    scene.road(zone)
    scene.pack(hp.LAYOUT["lanes"]["centers"][2], tuple(f"dog-{k}" for k, _ in dogs))
    ground = scene.img.convert("RGBA")
    cv = Image.new("RGBA", (W, H), rgb("ink"))
    cv.paste(ground.crop((0, ROAD_VIEW[0], W, hp.H)), (0, ROAD_VIEW[0]))
    cv.alpha_composite(image(f"backdrop-{hp.ZONES[zone]['art']}"), (0, 40))
    for y in range(126, ROAD_VIEW[0]):
        _, s = hp.distance_at(y)
        for x in range(W):
            if hp.STRIP_X <= hp.CX + (x + 0.5 - hp.CX) / s < hp.STRIP_X + hp.STRIP_W:
                cv.putpixel((x, y), ground.getpixel((x, y)))
    top_bar(cv, route, money, treats)
    cv.alpha_composite(image("ui-dog-band"), (0, 466))
    for i, (key, hearts) in enumerate(dogs):
        doghouse(cv, i * 120, 470, key, hearts)
    dim(cv, *ROAD_VIEW)
    return cv


# ---------- the celebration ----------

CX = W // 2
BURST = burst()


def headline(cv, kicker, line, top):
    """kicker in font-display at 2x, then line in font-display-cream at 1x under it. Returns the
    row under them."""
    display(cv, DISPLAY, kicker, CX, top, 2)
    display(cv, DISPLAY_CREAM, line, CX, top + 30, 1)
    return top + 46


def hero(cv, name, feet, i=2):
    """The starburst with name cheering at 2x in front of it, feet on row feet."""
    walker = scaled(cheer(name, i), 2)
    cy = feet - 58
    cv.alpha_composite(BURST, (CX - BURST.width // 2, cy - BURST.height // 2))
    cv.alpha_composite(walker, (CX - walker.width // 2, feet - walker.height + 2 * CHEER[i][2]))


def plate(cv, x, y, w, h, r=1):
    cv.alpha_composite(to_image(chrome(Grid(w, h), 0, 0, w, h, r).px), (x, y))


def button(cv, label, y):
    cv.alpha_composite(nine(frame("ui-button", "go"), 264, 44, 3, 3, 3, 5), (48, y))
    title(cv, label, CX, y + 15, "ink", "centre")


def pace_style(cv, walker, y):
    """The walker's pace and style, each icon then its word, a dot between: "Slow · Hustler"."""
    pace, style = walker["pace"].capitalize(), STYLE_NAME[walker["style"]]
    widths = [16 + 4 + BODY.width(pace, 2), BODY.width("·", 2), 16 + 4 + BODY.width(style, 2)]
    x = CX - (sum(widths) + 2 * 10) // 2
    cv.alpha_composite(image(f"icon-pace-{walker['pace']}"), (x, y))
    body(cv, pace, x + 20, y + 3)
    x += widths[0] + 10
    body(cv, "·", x, y + 3)
    x += widths[1] + 10
    cv.alpha_composite(image(f"icon-style-{walker['style']}"), (x, y))
    body(cv, style, x + 20, y + 3)


def new_walker():
    """Ben joins after Elm Avenue, the walk's first zone."""
    cv = run_screen(["street"], 96, 2, [("koda", 5), ("biscuit", 4), ("duchess", 3)])
    confetti(cv, 1)
    y = headline(cv, "NEW WALKER!", "BEN JOINS YOU!", 156)
    feet = y + 124
    hero(cv, "ben", feet)
    # his line in a speech bubble with its tail up at him, then his pace and style under a rule
    top = feet + 6
    plate(cv, 24, top, 312, 76, 3)
    cv.alpha_composite(up_tail(), (CX - 4, top - 5))
    for k, ln in enumerate(("Nice pack! Mind if I walk", "with you sometime?")):
        body(cv, ln, CX, top + 8 + k * 18, align="centre")
    for x in range(36, 324, 3):
        fill(cv, x, top + 43, 1, 1, "tan")
    pace_style(cv, WALKER["ben"], top + 51)
    button(cv, "WELCOME!", ROAD_VIEW[1] - 50)
    return cv


def zone_done():
    """Casey, the walker, finishes Willow Crescent, the walk's second zone."""
    cv = run_screen(["street", "snoozeCrescent"], 412, 1, [("koda", 4), ("biscuit", 4), ("duchess", 2)])
    confetti(cv, 5)
    y = headline(cv, "ZONE DONE!", "WILLOW CRESCENT", 196)
    feet = y + 128
    hero(cv, "casey", feet)
    top = feet + 10
    plate(cv, 40, top, 280, 32)
    parts = [("+$240", "forest"), (" fees", "plum"), ("  ·  ", "plum"), ("+$38", "forest"), (" tips", "plum")]
    x = CX - BODY.width("".join(s for s, _ in parts), 2) // 2
    for s, col in parts:
        x = body(cv, s, x, top + 11, col)
    return cv


def cheer_strip():
    """Each walker's cheer at 2x, frame by frame, then the walker's happy face at 2x."""
    gap, sc = 8, 2
    cv = Image.new("RGBA", (gap + 5 * (40 * sc + gap), len(WALKERS) * (60 * sc + gap) + gap), rgb("dslate"))
    for r, name in enumerate(WALKERS):
        y = gap + r * (60 * sc + gap)
        for i in range(len(CHEER)):
            cv.alpha_composite(scaled(cheer(name, i), sc), (gap + i * (40 * sc + gap), y))
        cv.alpha_composite(scaled(frame(f"face-walker-{name}", "happy"), sc),
                           (gap + 4 * (40 * sc + gap) + 8, y + 60 * sc - 64))
    return cv


def new_art():
    """The new pieces at 1x on the dimmed road's navy, then at 3x."""
    bits = [bit(s, c) for c in BIT_COLOURS for s in range(4)]
    one = Image.new("RGBA", (BURST.width + 16 + 4 * 8 + 16 + 8, BURST.height), rgb("navy"))
    one.alpha_composite(BURST, (0, 0))
    for k, b in enumerate(bits):
        one.alpha_composite(b, (BURST.width + 8 + (k % 4) * 8, 4 + (k // 4) * 8))
    one.alpha_composite(up_tail(), (BURST.width + 8 + 36, 4))
    return scaled(one, 3)


def build():
    os.makedirs(OUT, exist_ok=True)
    for name, im in (("new-walker", new_walker()), ("zone-done", zone_done()), ("cheer-strip", cheer_strip()),
                     ("new-art", new_art())):
        im.convert("RGB").save(f"{OUT}/{name}.png", optimize=True)
        print(f"{OUT}/{name}.png", im.size)


if __name__ == "__main__":
    if sys.argv[1:] != ["build"]:
        sys.exit(__doc__)
    build()
