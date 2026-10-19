#!/usr/bin/env python3
"""Mock: the start screen with a pet shop and a one-item pocket.

Draws 360x560 frames in Endesga 32 from the exported art: the approved uniform start screen
(start-uniform-partial.png and start-uniform-ready.png, deleted with the decided mocks and read
from a directory given on the command line) supplies the gate scene and the walker section;
everything else is composited here from screen-home, the UI kit nine-slices, faces, icons and the
BMFonts. The controls (help, sound, settings) move to the top bar's right end, the Gear section
becomes an inline Pocket strip (every gear item as a small tile, one brought per walk), and
everything for sale is in a Pet shop building in the gate scene's right yard, which opens the
shop page (Gear tab: gear with prices or OWNED; Dogs tab: pack slots and dogs). Also a strip of
the tile states for dogs and pocket gear.

New pieces drawn only here: the locked silhouettes, the price and goal plates and the slot icon.
The pet shop building is the shipped ui-pet-shop sprite.

Usage:
  start_shop.py build DIR    write public/art/mocks/start-shop/*.png, with the uniform frames in DIR

Extract the uniform frames first, for each of partial and ready:
  git show 5115f45:public/art/mocks/start-80s/start-uniform-partial.png > DIR/start-uniform-partial.png

Run from the repository root. Mock tooling only: nothing here is game art.
"""

import json
import os
import sys
import xml.etree.ElementTree as ET

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
import fonts  # noqa: E402
from pixel import DARKER, K  # noqa: E402

OUT = "public/art/mocks/start-shop"
ART = "public/art"
UNIFORM = None  # the directory holding the uniform frames, from the command line
GAME = json.load(open("shared/export/game-data.json"))
DOGS = {d["id"]: d for d in GAME["dogs"]}
PRICES = GAME["tuning"]["money"]["prices"]
FEES = GAME["tuning"]["money"]["feeByTemperament"]
W, H = 360, 560
# The roster in the start screen's order: rows by size, each row in trait order.
ROSTER = ["duchess", "nugget", "zippy", "pierre", "biscuit", "archie", "snowball", "penny", "koda"]
GEAR = ["fannyPack", "luckyCollar", "poopBags", "runningShoes", "whistle"]
GEAR_NAME = {g["id"]: g["name"] for g in GAME["gear"]}
GEAR_ART = {g["id"]: g["iconKey"] for g in GAME["gear"]}
GEAR_LINE = {
    "fannyPack": "Start with +$15",
    "luckyCollar": "Owners start happier",
    "poopBags": "One free Skip a walk",
    "runningShoes": "No stumble after a pull",
    "whistle": "Thieves flee",
}
GEAR_ABOUT = {
    "fannyPack": "start the walk with +$15.",
    "luckyCollar": "every owner starts with +1 heart.",
    "poopBags": "once a walk, a card offers a free Skip.",
    "runningShoes": "no stumble after a pull.",
    "whistle": "thieves flee even without a big dog.",
}
GREYS = ["ffffff", "c0cbdc", "8b9bb4", "5a6988", "3a4466", "262b44", "181425"]


def rgb(c):
    c = K.get(c, c)
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


# ---------- exported art ----------

def image(key):
    return Image.open(f"{ART}/images/{key}.png").convert("RGBA")


SHEETS = {}


def frame(key, tag=None):
    if key not in SHEETS:
        meta = json.load(open(f"{ART}/sprites/{key}.json"))
        frames = meta["frames"]
        frames = frames if isinstance(frames, list) else list(frames.values())
        SHEETS[key] = (Image.open(f"{ART}/sprites/{key}.png").convert("RGBA"), [f["frame"] for f in frames],
                       {t["name"]: t["from"] for t in meta["meta"]["frameTags"]})
    img, frames, tags = SHEETS[key]
    f = frames[tags[tag] if tag else 0]
    return img.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))


def nine(src, w, h, left, right, top, bottom):
    """src stretched to w x h as a nine-slice, edges and middle stretched nearest-neighbour."""
    sw, sh = src.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    xs = [(0, left, 0, left), (left, sw - right, left, w - right), (sw - right, sw, w - right, w)]
    ys = [(0, top, 0, top), (top, sh - bottom, top, h - bottom), (sh - bottom, sh, h - bottom, h)]
    for sx0, sx1, dx0, dx1 in xs:
        for sy0, sy1, dy0, dy1 in ys:
            if sx1 > sx0 and sy1 > sy0 and dx1 > dx0 and dy1 > dy0:
                part = src.crop((sx0, sy0, sx1, sy1)).resize((dx1 - dx0, dy1 - dy0), Image.NEAREST)
                out.paste(part, (dx0, dy0))
    return out


SLICES = {
    "ui-afford": (8, 8, 8, 8), "ui-button": (3, 3, 3, 5), "ui-detail-band": (8, 8, 0, 0),
    "ui-detail-card": (8, 8, 8, 8), "ui-quip": (8, 8, 8, 8), "ui-section": (3, 3, 24, 3),
    "ui-select": (8, 8, 8, 8), "ui-tile": (4, 4, 4, 4),
}


def kit(key, w, h, tag=None):
    src = frame(key, tag) if os.path.exists(f"{ART}/sprites/{key}.json") else image(key)
    return nine(src, w, h, *SLICES[key])


def greyed(im, darker=True):
    """im on the grey ramp, one step darker, as a disabled tile's art (greyTextureKey, remapDarker)."""
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a:
                c = min(GREYS, key=lambda h: abs(lum(rgb(h)) - lum((r, g, b))))
                if darker:
                    c = DARKER[c]
                px[x, y] = rgb(c)
    return out


def silhouette(im, fill="navy"):
    """im as one flat colour: a locked item shows its shape and nothing else."""
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    src, px = im.load(), out.load()
    for y in range(im.height):
        for x in range(im.width):
            if src[x, y][3]:
                px[x, y] = rgb(fill)
    return out


# ---------- BMFonts ----------

class Font:
    def __init__(self, key, tint=True):
        root = ET.parse(f"{ART}/fonts/{key}.fnt").getroot()
        self.page = Image.open(f"{ART}/fonts/{key}.png").convert("RGBA")
        self.tint = tint
        self.chars = {int(c.get("id")): {k: int(c.get(k)) for k in ("x", "y", "width", "height", "xoffset", "yoffset", "xadvance")}
                      for c in root.iter("char")}
        self.kern = {(int(k.get("first")), int(k.get("second"))): int(k.get("amount")) for k in root.iter("kerning")}
        self.cache = {}

    def glyph(self, ch, col):
        key = (ch, col)
        if key not in self.cache:
            c = self.chars[ord(ch)]
            g = self.page.crop((c["x"], c["y"], c["x"] + c["width"], c["y"] + c["height"]))
            if self.tint and c["width"]:
                colour = rgb(col)
                px = g.load()
                for y in range(g.height):
                    for x in range(g.width):
                        if px[x, y][3]:
                            px[x, y] = colour
            self.cache[key] = g
        return self.cache[key]

    def width(self, s, sc=1):
        w, prev = 0, None
        for ch in s:
            if prev is not None:
                w += self.kern.get((ord(prev), ord(ch)), 0)
            w += self.chars[ord(ch)]["xadvance"]
            prev = ch
        last = self.chars[ord(s[-1])] if s else None
        if last:
            w -= last["xadvance"] - (last["xoffset"] + last["width"])
        return w * sc

    def draw(self, cv, s, x, y, col="plum", sc=1, align="left"):
        """s with its line's top at y; align left, centre or right of x."""
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


BODY, TITLE, DISPLAY = Font("font-body"), Font("font-title"), Font("font-display", tint=False)
# Caps tops at 2x: body caps sit 2 rows into the line, title caps 4.
BODY_CAP, TITLE_CAP = 4, 8


def body(cv, s, x, cap_y, col="plum", align="left", sc=2):
    return BODY.draw(cv, s, x, cap_y - BODY_CAP // 2 * sc, col, sc, align)


def title(cv, s, x, cap_y, col="plum", align="left", sc=2):
    return TITLE.draw(cv, s, x, cap_y - TITLE_CAP // 2 * sc, col, sc, align)


def dollars(v):
    return f"${v:,}"


# ---------- drawing helpers ----------

def fill(cv, x, y, w, h, c):
    cv.paste(Image.new("RGBA", (w, h), rgb(c)), (x, y))


def put(cv, im, x, y):
    cv.alpha_composite(im, (x, y))


def chip(cv, text, x, cap_y, col, align="left", face="cream", edge="ink"):
    """A price or goal on a small plate: a 1px edge round a face, the text in font-body 2x, as the
    live price badge."""
    w = BODY.width(text, 2) + 6
    if align == "right":
        x -= w
    fill(cv, x + 1, cap_y - 3, w - 2, 16, edge)
    fill(cv, x, cap_y - 2, w, 14, edge)
    fill(cv, x + 1, cap_y - 2, w - 2, 14, face)
    body(cv, text, x + 3, cap_y, col)
    return x, w


def lock(cv, x, y):
    put(cv, image("icon-lock"), x, y)


def icon_button(cv, x, y, icon, tag=None):
    put(cv, frame("ui-icon-button", "normal"), x, y)
    put(cv, frame(icon, tag) if tag else image(icon), x + 2, y + 1)


def afford(cv, x, y, w, h):
    """ui-afford 2px outside the rect."""
    put(cv, kit("ui-afford", w + 4, h + 4, "glint"), x - 2, y - 2)


def check(cv, x, y, label="tick"):
    put(cv, frame("ui-check", label), x, y)


# ---------- new art ----------

def slot_icon():
    """32x32: a doghouse with a plus, for a pack slot for sale (new art)."""
    cv = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = cv.load()
    for y in range(4, 16):  # roof
        half = (y - 4) + 2
        for x in range(16 - half, 16 + half):
            px[x, y] = rgb("ink" if x in (16 - half, 15 + half) or y == 4 else "red" if y < 13 else "dred")
    fill(cv, 4, 15, 24, 1, "ink")
    fill(cv, 5, 16, 22, 13, "ink")
    fill(cv, 6, 16, 20, 12, "tan")
    fill(cv, 24, 16, 2, 12, "brown")
    fill(cv, 12, 19, 8, 9, "ink")
    fill(cv, 13, 20, 6, 8, "plum")
    fill(cv, 4, 28, 24, 2, "ink")
    # the plus
    fill(cv, 22, 1, 9, 9, "ink")
    fill(cv, 23, 2, 7, 7, "green")
    fill(cv, 26, 3, 1, 5, "white")
    fill(cv, 24, 5, 5, 1, "white")
    return cv


# ---------- the start screen ----------

GATE_Y, GATE_H = 40, 156
BUTTONS = {"help": (240, 10), "sound": (284, 10), "settings": (328, 10)}
# The dog section as live (cells 112x44, no row gap, tiles inset 1), ending at row 431.
DOG_SECTION = (0, 270, 360, 161)
DOG_CELL = (112, 44)
# The pocket strip, rows 433 to 512: the label line's caps at 434, five 64x44 cells 8 apart from
# x 4 on row 450 (tiles inset 1, so 62x42 at 451), the effect line's caps at 499.
POCKET_LABEL_Y = 434
POCKET_CELLS = (4, 450, 64, 44, 8)
POCKET_LINE_Y = 499
START = (4, 514, 352, 44)
SHOP = (234, 90, 120, 104)


def top_bar(cv, bank, best):
    cv.paste(image("screen-home").crop((0, 0, W, 40)), (0, 0))
    put(cv, image("icon-money"), 8, 12)
    title(cv, dollars(bank), 28, 15, "cream")
    icon_button(cv, 104, 10, "icon-logbook")
    body(cv, best, 130, 15, "cream")
    icon_button(cv, *BUTTONS["help"], "icon-help")
    icon_button(cv, *BUTTONS["sound"], "icon-sound", "on")
    icon_button(cv, *BUTTONS["settings"], "icon-settings")


def bubble(cv, lines, cx=180, top=46):
    w = max(BODY.width(s, 2) for s in lines) + 20
    h = 20 * len(lines) + 8
    x = cx - w // 2
    put(cv, kit("ui-quip", w, h), x, top)
    tail = image("ui-quip-tail-down")
    put(cv, tail, cx - tail.width // 2, top + h - 1)
    for i, s in enumerate(lines):
        body(cv, s, cx, top + 7 + 20 * i, "plum", "centre")


def gate(cv, base, line, shop_new, pocket):
    home = image("screen-home")
    cv.paste(base.crop((0, GATE_Y, W, 270)), (0, GATE_Y))
    # clear the old help and sound buttons, the bubble and the slot sign back to screen-home
    for x, y, w, h in ((0, 40, 48, 36), (240, 40, 120, 86), (60, 42, 240, 52), (197, 126, 163, 70)):
        cv.paste(home.crop((x, y, x + w, y + h)), (x, y))
    # the tree and owners the bubble area cut are in screen-home or below it; redraw the porch row
    cv.paste(base.crop((60, 94, 240, 126)), (60, 94))
    body(cv, "Elm Avenue", 327, 75, "white", "centre", sc=1)
    x, y, w, h = SHOP
    put(cv, frame("ui-pet-shop", "normal"), x, y)
    if shop_new:
        afford(cv, x, y, w, h)
    if pocket:
        # the pocket item as a badge beside the walker (gearBadge, 194,166 18x18)
        fill(cv, 194, 166, 18, 18, "ink")
        fill(cv, 195, 167, 16, 16, "cream")
        put(cv, image(f"icon-gear-{kebab(pocket)}"), 195, 167)
    bubble(cv, line)


def kebab(s):
    return "".join("-" + c.lower() if c.isupper() else c for c in s)


def dog_tile(cv, x, y, dog, state, bank=0, goal=None, pick=None):
    """A 110x42 dog tile: available, picked, full (the pack is full), locked."""
    w, h = 110, 42
    d = DOGS[dog]
    face = frame(f"face-dog-{dog}", "happy" if state in ("available", "picked") else "neutral")
    if state == "picked":
        fill(cv, x, y + 2, w, h, "plum")
        y -= 2
        put(cv, kit("ui-tile", w, h, "selected"), x, y)
        box, ink = "amber", "plum"
    elif state == "available":
        put(cv, kit("ui-tile", w, h, "normal"), x, y)
        box, ink = "tan", "plum"
    else:
        put(cv, kit("ui-tile", w, h, "disabled"), x, y)
        box, ink = "slate", "dslate"
    fill(cv, x + 3, y + 4, 34, 34, box)
    if state == "locked":
        put(cv, silhouette(face), x + 4, y + 5)
    elif state == "full":
        put(cv, greyed(face), x + 4, y + 5)
    else:
        put(cv, face, x + 4, y + 5)
    body(cv, d["name"], x + 41, y + 4, ink)
    fee = FEES[d["owner"]["temperament"]]
    if state == "locked":
        lock(cv, x - 2, y - 3)
        if goal:
            chip(cv, goal, x + 41, y + 25, "plum")
        else:
            price = PRICES["lockedDog"]
            chip(cv, dollars(price), x + 41, y + 25, "forest" if price <= bank else "dred")
        return
    icons = [f"icon-trait-{kebab(d['trait'])}", f"icon-owner-{kebab(d['owner']['temperament'])}"]
    for n, key in enumerate(icons):
        im = image(key)
        put(cv, greyed(im) if state == "full" else im, x + 40 + n * 18, y + 19)
    body(cv, f"${fee}", x + 77, y + 21, "navy" if state == "full" else "forest")
    body(cv, "/zone", x + 78, y + 34, "navy" if state == "full" else "dbrown", sc=1)
    if state == "picked":
        check(cv, x - 4, y - 4, pick or "1")


def dog_section(cv, picked, owned, bank, capacity=1, more_slots=True):
    x, y, w, h = DOG_SECTION
    done = len(picked) > 0
    put(cv, kit("ui-section", w, h, "complete" if done else "incomplete"), x, y)
    title(cv, "PICK YOUR DOGS", x + 9, y + 8, "ink" if done else "cream")
    right = x + w - 9
    if more_slots:
        lock(cv, right - 16, y + 4)
        right -= 20
    # the count alone beside the padlock: picked over owned slots
    title(cv, f"{len(picked)}/{capacity}", right, y + 8, "ink" if done else "amber", "right")
    full = len(picked) >= capacity
    cw, ch = DOG_CELL
    for i, dog in enumerate(ROSTER):
        tx = 4 + (i % 3) * (cw + 8) + 1
        ty = y + 26 + (i // 3) * ch + 1
        if dog in picked:
            state = "picked"
        elif dog not in owned:
            state = "locked"
        elif full:
            state = "full"
        else:
            state = "available"
        dog_tile(cv, tx, ty, dog, state, bank, pick=str(picked.index(dog) + 1) if dog in picked else None)


def pocket_line(item):
    if item is None:
        return "Empty. Tap a gear item to pocket it."
    line = f"{GEAR_NAME[item]}: {GEAR_ABOUT[item]}"
    return line if BODY.width(line, 2) <= 352 else f"{GEAR_NAME[item]}: {GEAR_LINE[item].lower()}"


def pocket_strip(cv, owned, item, bank):
    """The label line, every gear item as a tile in shop order, and the pocketed item's effect."""
    title(cv, "POCKET", 4, POCKET_LABEL_Y, "cream")
    body(cv, "One per walk", 356, POCKET_LABEL_Y, "cream", "right")
    x0, y0, cw, ch, gap = POCKET_CELLS
    for i, gear in enumerate(GEAR):
        state = "picked" if gear == item else "available" if gear in owned else "locked"
        gear_tile(cv, x0 + i * (cw + gap) + 1, y0 + 1, gear, state, bank)
    body(cv, pocket_line(item), 4, POCKET_LINE_Y, "cream")


def start_button(cv, ready):
    x, y, w, h = START
    put(cv, kit("ui-button", w, h, "go" if ready else "go-disabled"), x, y)
    title(cv, "START WALK", x + w // 2, y + (12 if ready else 15), "ink" if ready else "dslate", "centre", sc=3)


def start_screen(state):
    cv = image("screen-home").copy()
    if state == "empty":
        base = Image.open(f"{UNIFORM}/start-uniform-partial.png").convert("RGBA")
        bank, best, owned_gear, pocket, picked = 640, "No walks yet", [], None, []
    else:
        base = Image.open(f"{UNIFORM}/start-uniform-ready.png").convert("RGBA")
        bank, best, owned_gear, pocket, picked = 560, "Best $340", ["fannyPack", "whistle"], "whistle", ["duchess"]
    affordable = any(PRICES[g] <= bank for g in GEAR if g not in owned_gear) or PRICES["lockedDog"] <= bank
    line = "Something new at the pet shop." if affordable or state == "empty" else "Back already? Who's next?"
    gate(cv, base, [line], affordable, pocket)
    top_bar(cv, bank, best)
    dog_section(cv, picked, ["duchess", "biscuit", "koda"], bank)
    pocket_strip(cv, owned_gear, pocket, bank)
    start_button(cv, bool(picked))
    return cv


# ---------- the shop page ----------

PANEL = (4, 44, 352, 512)


def shop_frame(cv, bank, tab):
    """The page under the top bar: the wood, the card, its PET SHOP band and close, and the tabs."""
    home = image("screen-home")
    wood = home.crop((0, 200, W, 560))
    cv.paste(wood, (0, 40))
    cv.paste(wood.crop((0, 0, W, 200)), (0, 400))
    top_bar(cv, bank, "Best $340")
    x, y, w, h = PANEL
    put(cv, kit("ui-detail-card", w, h), x, y)
    put(cv, kit("ui-detail-band", w - 12, 22), x + 6, y + 6)
    title(cv, "PET SHOP", x + 16, y + 12, "white")
    icon_button(cv, x + w - 30, y + 7, "icon-close")
    tx, ty, tw, th = x + 10, y + 36, 162, 28
    for i, name in enumerate(("GEAR", "DOGS")):
        bx = tx + i * (tw + 8)
        if name.lower() == tab:
            put(cv, kit("ui-tile", tw, th, "selected"), bx, ty)
        else:
            put(cv, kit("ui-button", tw, th, "normal"), bx, ty)
        title(cv, name, bx + tw // 2, ty + 9, "plum", "centre")


def heading(cv, text, y, right=None):
    x, _, w, _ = PANEL
    title(cv, text, x + 12, y, "plum")
    if right:
        body(cv, right, x + w - 12, y, "dbrown", "right")


def gear_tile(cv, x, y, item, state, bank=0):
    """A 62x42 pocket tile: the item's art in its box, under its price plate while locked."""
    w, h = 62, 42
    art = image(GEAR_ART[item])
    if state == "picked":
        fill(cv, x, y + 2, w, h, "plum")
        y -= 2
        put(cv, kit("ui-tile", w, h, "selected"), x, y)
        box = "amber"
    elif state == "available":
        put(cv, kit("ui-tile", w, h, "normal"), x, y)
        box = "tan"
    else:
        put(cv, kit("ui-tile", w, h, "disabled"), x, y)
        box = "slate"
    fill(cv, x + 14, y + 3, 34, 34, box)
    if state == "locked":
        put(cv, silhouette(art), x + 15, y + 4)
        lock(cv, x - 2, y - 3)
        price = PRICES[item]
        text = dollars(price)
        cw = BODY.width(text, 2) + 6
        chip(cv, text, x + (w - cw) // 2, y + 28, "forest" if price <= bank else "dred")
    else:
        put(cv, greyed(art) if state == "full" else art, x + 15, y + 4)
        if state == "picked":
            check(cv, x - 3, y - 3, "tick")


def row(cv, y, art, name, line, price=None, bank=0, owned=False, locked=None, icons=None, h=44, focus=False):
    """A 328 wide buy row: art in a box, the name and a line, and the price plate or Owned."""
    x, w = PANEL[0] + 12, 328
    top = (h - 36) // 2
    if locked:
        put(cv, kit("ui-tile", w, h, "disabled"), x, y)
        fill(cv, x + 4, y + top, 36, 36, "slate")
        put(cv, silhouette(art), x + 6, y + top + 2)
        lock(cv, x - 2, y - 3)
        body(cv, name, x + 46, y + 7, "dslate")
        body(cv, locked, x + 46, y + 25, "dslate")
        chip(cv, dollars(price), x + w - 6, y + h // 2 - 7, "navy", "right", face="lgrey", edge="slate")
        return
    put(cv, kit("ui-tile", w, h, "normal"), x, y)
    fill(cv, x + 4, y + top, 36, 36, "tan")
    put(cv, art, x + 6, y + top + 2)
    mid = y + h // 2
    body(cv, name, x + 46, mid - 15, "plum")
    if icons:
        for n, key in enumerate(icons):
            put(cv, image(key), x + 45 + n * 18, mid + 1)
        body(cv, line, x + 83, mid + 4, "dbrown")
    else:
        body(cv, line, x + 46, mid + 3, "dbrown")
    if owned:
        check(cv, x + w - 22, mid - 8, "tick")
        title(cv, "OWNED", x + w - 26, mid - 4, "forest", "right")
    else:
        chip(cv, dollars(price), x + w - 6, mid - 7, "forest" if price <= bank else "dred", "right")
        if focus:
            # the locked item tapped on the start screen: the shop opens on its row, framed by ui-select
            put(cv, kit("ui-select", w + 6, h + 6, "pulse"), x - 3, y - 3)
        elif price <= bank:
            afford(cv, x, y, w, h)


def shop_gear(bank=760, owned=("fannyPack", "whistle"), tapped="luckyCollar"):
    cv = Image.new("RGBA", (W, H), rgb("ink"))
    shop_frame(cv, bank, "gear")
    heading(cv, "GEAR", 118, "Yours to keep")
    y = 134
    for item in GEAR:
        row(cv, y, image(GEAR_ART[item]), GEAR_NAME[item], GEAR_LINE[item], PRICES[item], bank, owned=item in owned,
            focus=item == tapped)
        y += 52
    return cv


def shop_dogs(bank=760, owned=("duchess", "biscuit", "koda")):
    cv = Image.new("RGBA", (W, H), rgb("ink"))
    shop_frame(cv, bank, "dogs")
    heading(cv, "PACK SLOTS", 118, "1 of 3 owned")
    row(cv, 134, slot_icon(), "Slot 2", "Walk 2 dogs at once", PRICES["dogSlot2"], bank, h=42)
    row(cv, 182, slot_icon(), "Slot 3", "Buy slot 2 first", PRICES["dogSlot3"], bank, locked="Buy slot 2 first", h=42)
    heading(cv, "DOGS", 236, "$600 each")
    y = 252
    order = ["nugget"] + [d for d in ROSTER if d not in owned and d != "nugget"]
    for dog in order:
        d = DOGS[dog]
        fee = FEES[d["owner"]["temperament"]]
        icons = [f"icon-trait-{kebab(d['trait'])}", f"icon-owner-{kebab(d['owner']['temperament'])}"]
        row(cv, y, frame(f"face-dog-{dog}", "happy"), d["name"], f"${fee}/zone", PRICES["lockedDog"], bank,
            icons=icons, h=42, focus=dog == "nugget")
        y += 48
    return cv


# ---------- the tile-state strip ----------

STRIP = [
    ("available", "Available", None),
    ("picked", "Picked", None),
    ("full", "Pack full", None),
    ("locked", "Locked", 560),
    ("locked", "Locked, can", 760),
    ("goal", "Locked by", None),
]
STRIP_SUB = {"Locked, can": "afford", "Locked by": "a goal", "Pack full": "(can't now)",
             "Locked": "(can't afford)"}


def strip():
    rows = len(STRIP)
    wood = image("screen-home").crop((0, 200, W, 560))
    cv = Image.new("RGBA", (W, 22 + rows * 60))
    for y in range(0, cv.height, wood.height):
        cv.paste(wood, (0, y))
    title(cv, "STATE", 8, 8, "cream")
    title(cv, "DOG", 124, 8, "cream")
    title(cv, "POCKET", 254, 8, "cream")
    for i, (state, label, bank) in enumerate(STRIP):
        y = 30 + i * 60
        body(cv, label, 8, y + 10, "cream")
        if label in STRIP_SUB:
            body(cv, STRIP_SUB[label], 8, y + 28, "tan")
        dstate = "locked" if state == "goal" else state
        dog_tile(cv, 124, y + 4, "nugget" if dstate == "locked" else "biscuit", dstate, bank or 0,
                 goal="10 walks" if state == "goal" else None)
        if state == "full":
            body(cv, "Swaps:", 256, y + 10, "tan")
            body(cv, "never full", 256, y + 28, "tan")
        elif state == "goal":
            body(cv, "Dogs only", 256, y + 10, "tan")
        else:
            gear_tile(cv, 260, y + 4, "poopBags" if dstate == "locked" else "whistle", dstate, bank or 0)
    return cv


def build():
    os.makedirs(OUT, exist_ok=True)
    out = {
        "start-empty": start_screen("empty"),
        "start-item": start_screen("item"),
        "shop-gear": shop_gear(),
        "shop-dogs": shop_dogs(),
        "states": strip(),
    }
    for name, im in out.items():
        im.convert("RGB").save(f"{OUT}/{name}.png", optimize=True)
        print(f"{OUT}/{name}.png", im.size)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "build":
        UNIFORM = sys.argv[2]
        build()
    else:
        sys.exit(__doc__)
