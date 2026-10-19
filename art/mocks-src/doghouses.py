#!/usr/bin/env python3
"""Mock: the doghouse row rethought as a toy box's bottom band.

Draws full 360x560 run screens in Endesga 32 (horizon.py's road, pack, backdrop and top bar)
on Woof Way and The Long Way Home, each with four doghouse rows:

- today: the shipped ui-doghouse, ui-doghouse-warn and heart-loss frames, straight on the road.
- band: today's houses on a box band: an ink band behind the row, topped by a striped divider
  on the road's last free rows (466 to 469, under the walker's feet on 464).
- clubhouse: the band, with houses redrawn in one fixed palette (red roof, navy board walls,
  cream panels, yellow trim). Each dog's colour is only its door, behind its face, and the
  gable emblem.
- file card: the band, with each slot a character file card: cream card stock in the UI
  chrome, a blue header holding a logo plate for the name, framed photos, and the dog's colour
  only as its photo backing, its emblem badge and the card's foot stripe.

Every look keeps ui-doghouse at 120x90 in the same three slots, with every part the game draws
(name, faces, hearts, count, statuses, owner name, quirk icon, FIRED) where src/hud/doghouse.ts
puts it. Woof Way shows a 1-heart dog under ui-doghouse-warn and a fired dog; The Long Way Home
shows a heart-loss flash (frame 0), an owned empty slot, and a quip in the lane over the roofs.

Usage:
  doghouses.py build    write public/art/mocks/doghouses/*.png

Run from the repository root. Mock tooling only: nothing here is game art.
"""

import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
sys.path.insert(0, os.path.dirname(__file__))
import help as hp  # noqa: E402
import horizon as hz  # noqa: E402
import ui  # noqa: E402
from pixel import PALETTE, Grid  # noqa: E402

OUT = "public/art/mocks/doghouses"
LAYOUT = hz.LAYOUT
PARTS = LAYOUT["doghouse"]["parts"]
SLOTS = LAYOUT["doghouse"]["slots"]
QUIP_LANE = LAYOUT["hudLanes"]["quip"]
W, H = 120, 90
ROW_Y = SLOTS[0]["y"]
# The quirk icon's spot, under the owner's name (src/hud/doghouse.ts on the quirk branch).
QUIRK = (6, 72)
# The divider: the road's rows under the walker's feet (footY 464) and the slot row's first two.
DIVIDER_Y, DIVIDER_H = 466, 6


# ---------- the band ----------

def band(cv):
    """An ink band from row 466 to the screen's foot, topped by a divider lettered like the yard
    sign logo: an ink line, 3 rows of yellow and amber stripes slanting 45 degrees, 4px wide, a
    solid dred shadow row, then an ink line on row 471."""
    cv.fill(0, DIVIDER_Y, hz.SW, hz.SH - DIVIDER_Y, "ink")
    for y in range(DIVIDER_Y + 1, DIVIDER_Y + 4):
        for x in range(hz.SW):
            cv.fill(x, y, 1, 1, "yellow" if (x + y) // 4 % 2 else "amber")
    cv.fill(0, DIVIDER_Y + 4, hz.SW, 1, "dred")


# ---------- clubhouse: the house in one fixed palette ----------

def accent(dog):
    """The dog's colour: base, shade and dark, from its accessory (ui.ROOFS)."""
    return ui.ROOFS[dog]


def emblem(g, dog, x, y):
    if dog in ui.EMBLEMS:
        colours, rows = ui.EMBLEMS[dog]
        for j, row in enumerate(rows):
            for i, c in enumerate(row):
                if c != ".":
                    g.p(x + i, y + j, colours[c])


def logo_plate(g, x, y, w, h, face="cream"):
    """The name's logo plate: an ink line round a cream face, with a solid dred shadow 1px right
    and below, as the yard sign's letters have."""
    g.rect(x + 1, y + 1, w, h, "dred")
    g.rect(x, y, w, h, "ink")
    g.rect(x + 1, y + 1, w - 2, h - 2, face)


def roof_half(y):
    """Half the clubhouse roof's width on slot row y: the gable from row 2 slopes out 3px a row to
    the full 118px by row 5."""
    return min(59, 50 + 3 * (y - 2))


# Panels the heart-loss flash leaves clear, as x, y, w, h, per look.
CLUB_PANELS = ((18, 2, 85, 17), (4, 3, 14, 14), (4, 22, 36, 36), (40, 22, 36, 36), (76, 22, 43, 59),
               (3, 59, 74, 30))
CARD_PANELS = ((5, 4, 111, 14), (4, 22, 36, 36), (40, 22, 36, 36), (76, 22, 42, 34), (3, 59, 74, 30),
               (77, 59, 41, 21), (24, 76, 12, 12))


def clubhouse(dog):
    """120x90: rows 0 and 1 clear for the divider. A red gable roof (rows 2 to 20) in an ink line
    with dred shingle courses and a yellow eave trim; navy board walls; cream panels in an ink
    line: the logo plate, one board for the hearts and the status icons, and the owner's ID panel
    (name and quirk). The dog's colour is only its door and its emblem's vent ring. A fired dog's
    house is the same house in slate and dslate, its ID panel and board gone, with
    ui-fired-plate's dred plate on the wall."""
    empty = dog == "empty"
    roof, shingle, trim = ("slate", "dslate", "lgrey") if empty else ("red", "dred", "yellow")
    wall, seam, lit = ("dslate", "navy", "slate") if empty else ("navy", "ink", "dslate")
    paper, paper_sh = ("lgrey", "grey") if empty else ("cream", "tan")
    g = Grid(W, H)
    # walls in an ink outline, board seams, a lit left post
    g.rect(1, 19, 118, 71, "ink")
    g.rect(2, 20, 116, 69, wall)
    for y in range(28, 88, 6):
        g.rect(2, y, 116, 1, seam)
    g.rect(2, 20, 1, 69, lit)
    # roof: shingle courses every 4 rows, joints staggered
    for y in range(2, 20):
        w = roof_half(y)
        g.rect(60 - w, y, 2 * w, 1, roof)
        if y % 4 == 3 and y > 3:
            g.rect(60 - w, y, 2 * w, 1, shingle)
        elif y % 4 in (0, 1) and y > 5:
            for x in range(4 * (y // 4 % 2), W, 8):
                g.p(x, y, shingle)
    for y in range(2, 6):
        w = roof_half(y)
        g.p(60 - w, y, "ink")
        g.p(59 + w, y, "ink")
    g.rect(10, 2, 100, 1, "ink")
    g.rect(1, 5, 1, 15, "ink")
    g.rect(118, 5, 1, 15, "ink")
    g.rect(1, 19, 118, 1, "ink")
    g.rect(2, 20, 116, 1, trim)
    # the gable vent: a ring in the dog's colour round the emblem on ink
    base, shade, _ = accent("empty" if empty else dog)
    g.rect(4, 3, 14, 14, "ink")
    g.rect(5, 4, 12, 12, base)
    g.rect(6, 5, 10, 10, "ink")
    if not empty:
        emblem(g, dog, 7, 6)
    # the logo plate for the name
    logo_plate(g, 19, 3, 82, 14, paper)
    # the door in the dog's colour, arched, in an ink line, and the window
    door = "ink" if empty else base
    g.rect(4, 23, 36, 36, "ink")
    g.rect(5, 22, 34, 1, "ink")
    g.rect(7, 21, 30, 1, "ink")
    g.rect(5, 24, 34, 34, door)
    g.rect(6, 23, 32, 1, door)
    g.rect(8, 22, 28, 1, door)
    if not empty:
        g.rect(5, 57, 34, 1, shade)
    g.rect(40, 22, 36, 36, "ink")
    g.rect(41, 23, 34, 34, paper)
    g.rect(42, 24, 32, 32, "lgrey" if empty else "sky")
    g.rect(42, 24, 32, 1, "grey" if empty else "blue")
    # the owner's ID panel: the name on its top line, the quirk icon under it
    g.rect(3, 59, 74, 30, "ink")
    g.rect(4, 60, 72, 28, paper)
    g.rect(4, 87, 72, 1, paper_sh)
    g.rect(4, 70, 72, 1, paper_sh)
    if empty:
        plate = ui.plate("dred", "red", "plum", 40, 17)
        for y, row in enumerate(plate.px):
            for x, c in enumerate(row):
                if c:
                    g.px[68 + y][40 + x] = c
        # the grey house has no ID panel: clear it back to wall round the plate
        for y in range(59, 89):
            for x in range(3, 77):
                if not (40 <= x < 80 and 68 <= y < 85):
                    g.p(x, y, seam if (y - 28) % 6 == 0 else wall)
        return g
    # the board: hearts, then the status icons under a dotted rule, its right edge on the house's
    g.rect(76, 22, 43, 59, "ink")
    g.rect(77, 23, 41, 57, paper)
    g.rect(77, 79, 41, 1, paper_sh)
    for x in range(79, 116, 2):
        g.p(x, 43, paper_sh)
        g.p(x, 57, paper_sh)
    return g


# ---------- file card: the slot as a character file card ----------

def file_card(dog):
    """120x90: rows 0 and 1 clear for the divider. A card (x 1 to 118, rows 2 to 89) in the UI
    chrome (ink and plum lines, cream face, tan lip); a blue header band (rows 3 to 20) filled by
    the name's logo plate (x 5 to 114); framed photos, the dog on its own colour and the owner on
    sky; a ruled hearts box; the owner's ID line; and the dog's emblem badge and foot stripe in its
    colour.
    A fired dog's card is the same card greyed, with ui-fired-plate's dred plate as a stamp."""
    empty = dog == "empty"
    face, lip, header, header_sh = (("lgrey", "grey", "slate", "dslate") if empty else
                                    ("cream", "tan", "blue", "navy"))
    base, shade, dark = accent(dog)
    g = Grid(W, H)
    ui.chrome(g, 1, 2, 118, 88, r=1, face=face, lip=lip)
    # the header: a blue band filled by the name's logo plate, 110 wide so a name at 2x up to
    # name.width (108) stays on it
    g.rect(3, 3, 114, 17, header)
    g.rect(3, 19, 114, 1, header_sh)
    g.rect(3, 20, 114, 1, "plum")
    logo_plate(g, 5, 4, 110, 13, "white" if empty else "cream")
    # photos: an ink frame with a white mat, the dog on its colour and the owner on sky
    for x, back in ((4, "grey" if empty else base), (40, "lgrey" if empty else "sky")):
        g.rect(x, 22, 36, 36, "ink")
        g.rect(x + 1, 23, 34, 34, "white")
        g.rect(x + 2, 24, 32, 32, "slate" if empty and x == 4 else back)
    if empty:
        g.rect(6, 24, 32, 32, "dslate")
    # the corner photo mounts
    for x, y in ((4, 22), (37, 22), (40, 22), (73, 22)):
        g.rect(x, y, 3, 1, "plum")
    if empty:
        plate = ui.plate("dred", "red", "plum", 40, 17)
        for y, row in enumerate(plate.px):
            for x, c in enumerate(row):
                if c:
                    g.px[68 + y][40 + x] = c
        return g
    # the hearts box, ruled under each row of hearts
    g.rect(76, 22, 42, 34, "plum")
    g.rect(77, 23, 40, 32, "white")
    for y in (33, 41):
        for x in range(78, 116, 2):
            g.p(x, y, "lgrey")
    g.rect(77, 43, 40, 1, "lgrey")
    # the ID lines: the owner's name and the quirk on ruled lines
    for y in (71,):
        g.rect(4, y, 72, 1, lip)
    # status spots: dashed boxes where a stamp goes
    for x, y in ((78, 62), (98, 62)):
        for i in range(0, 18, 3):
            g.p(x - 1 + i, y - 1, lip)
            g.p(x - 1 + i, y + 16, lip)
            g.p(x - 1, y - 1 + i, lip)
            g.p(x + 16, y - 1 + i, lip)
    # the emblem badge, the dog's colour round its emblem, then the foot stripe in its colour
    g.rect(24, 76, 12, 12, "ink")
    g.rect(25, 77, 10, 10, base)
    g.rect(26, 78, 8, 8, face)
    emblem(g, dog, 26, 78)
    g.rect(38, 82, 78, 4, base)
    g.rect(38, 85, 78, 1, shade)
    for x in range(40, 116, 6):
        g.rect(x, 82, 3, 3, dark if x % 12 == 4 else base)
    return g


# ---------- overlays: warn rim and heart-loss flash from a look's silhouette ----------

def solid_of(g):
    def solid(x, y):
        return 0 <= x < W and 0 <= y < H and g.px[y][x] is not None
    return solid


def warn_overlay(g):
    """ui-doghouse-warn's static frame for this silhouette: amber outside, red inside, 2px in."""
    solid = solid_of(g)
    o = Grid(W, H)
    for y in range(H):
        for x in range(W):
            if not solid(x, y):
                continue
            near = [all(solid(x + dx, y + dy) for dx in range(-r, r + 1) for dy in range(-r, r + 1)) for r in (1, 2)]
            if not near[0]:
                o.p(x, y, "amber")
            elif not near[1]:
                o.p(x, y, "red")
    return o


def loss_overlay(g, panels, seams):
    """heart-loss frame 0 for this silhouette: everything but the panels flashes red, seam colours
    dred, the edge plum."""
    solid = solid_of(g)
    seams = {hp.rgb(c) for c in seams}
    o = Grid(W, H)
    for y in range(H):
        for x in range(W):
            if not solid(x, y):
                continue
            if not all(solid(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                o.p(x, y, "plum")
            elif not any(px <= x < px + w and py <= y < py + h for px, py, w, h in panels):
                c = g.px[y][x]
                o.p(x, y, "dred" if hp.rgb(c) in seams else "red")
    return o


def img(g):
    return ui.to_image(g.px)


# ---------- the looks ----------

class Look:
    """How a look draws its row: the band or not, and the house for a dog (or "empty" for a
    fired dog), its warn and heart-loss overlays."""
    has_band = True

    def house(self, dog):
        raise NotImplementedError

    def warn(self, dog):
        return img(warn_overlay(self.grid(dog)))

    def grid(self, dog):
        raise NotImplementedError


class Today(Look):
    has_band = False

    def house(self, dog):
        return hp.frame("ui-doghouse", dog)

    def warn(self, dog):
        return hp.frame("ui-doghouse-warn", "static")

    def loss(self, dog):
        return hp.frame("ui-doghouse", "heart-loss", 0)


class Band(Today):
    has_band = True


class Clubhouse(Look):
    def grid(self, dog):
        return clubhouse(dog)

    def house(self, dog):
        return img(clubhouse(dog))

    def loss(self, dog):
        return img(loss_overlay(clubhouse(dog), CLUB_PANELS, ("ink", "dred")))


class FileCard(Look):
    def grid(self, dog):
        return file_card(dog)

    def house(self, dog):
        return img(file_card(dog))

    def loss(self, dog):
        return img(loss_overlay(file_card(dog), CARD_PANELS, ("navy", "tan", "plum")))


LOOKS = {"today": Today(), "band": Band(), "clubhouse": Clubhouse(), "file-card": FileCard()}


# ---------- the game's parts over the house, as HudScene draws them ----------

def slot(cv, look, x, y, s):
    """One slot: s has dog, hearts, state (walking, warn, loss, fired, empty) and statuses."""
    state = s["state"]
    if state == "empty":
        # an owned slot with no dog: the game's dashed tan outline and "Empty" in cream
        for i in range(0, W, 4):
            cv.fill(x + i, y, 2, 1, "tan")
            cv.fill(x + i, y + H - 1, 2, 1, "tan")
        for i in range(0, H, 4):
            cv.fill(x, y + i, 1, 2, "tan")
            cv.fill(x + W - 1, y + i, 1, 2, "tan")
        hz.text(cv, "EMPTY", x + PARTS["fired"]["x"], y + PARTS["fired"]["y"], "cream", origin=0.5)
        return
    dog = s["dog"]
    name, owner, max_h, _ = hp.dog(dog)
    fired = state == "fired"
    cv.paste(look.house("empty" if fired else dog), x, y)
    if state == "loss":
        cv.paste(look.loss(dog), x, y)
    n = PARTS["name"]
    sc = next((k for k in n["scales"] if hz.text_width(name, sc=k) <= n["width"]), 1)
    hz.text(cv, name, x + n["x"], y + n["y"], "plum", sc=sc, origin=0.5)
    if fired:
        hz.text(cv, "FIRED", x + PARTS["fired"]["x"], y + PARTS["fired"]["y"], "white", origin=0.5)
        return
    hearts = s["hearts"]
    m = hp.mood(hearts)
    cv.paste(hp.frame(f"face-dog-{dog}", m), x + PARTS["dogFace"]["x"], y + PARTS["dogFace"]["y"])
    cv.paste(hp.frame(f"face-owner-{dog}", m), x + PARTS["ownerFace"]["x"], y + PARTS["ownerFace"]["y"])
    hh = PARTS["hearts"]
    for j in range(max_h):
        cv.paste(hp.frame("ui-heart", "full" if j < hearts else "empty"),
                 x + hh["x"] + j % hh["perRow"] * hh["pitchX"], y + hh["y"] + j // hh["perRow"] * hh["pitchY"])
    hz.text(cv, f"{hearts}/{max_h}", x + PARTS["heartCount"]["x"], y + PARTS["heartCount"]["y"], "dred", origin=0.5)
    hz.text(cv, owner.title(), x + PARTS["ownerName"]["x"], y + PARTS["ownerName"]["y"], "plum", font="font-body")
    cv.paste(hp.image(f"icon-quirk-{dog}"), x + QUIRK[0], y + QUIRK[1])
    for status, spot in zip(s.get("statuses", ()), PARTS["statuses"]):
        cv.paste(hp.image(f"icon-{status}"), x + spot["x"], y + spot["y"])
    if state == "warn":
        cv.paste(look.warn(dog), x, y)


def nine(key, w, h, c=8):
    """A nine-slice of image key stretched to w x h, corners c."""
    src = hp.image(key)
    sw, sh = src.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    xs = ((0, c, 0, c), (c, sw - c, c, w - c), (sw - c, sw, w - c, w))
    ys = ((0, c, 0, c), (c, sh - c, c, h - c), (sh - c, sh, h - c, h))
    for sx0, sx1, dx0, dx1 in xs:
        for sy0, sy1, dy0, dy1 in ys:
            if dx1 > dx0 and dy1 > dy0:
                out.paste(src.crop((sx0, sy0, sx1, sy1)).resize((dx1 - dx0, dy1 - dy0), Image.NEAREST), (dx0, dy0))
    return out


def quip(cv, index, line):
    """An owner's line in ui-quip over the roofs, centred over the owner's face, at 2x, padding 4."""
    lane = QUIP_LANE
    width = hz.text_width(line, font="font-body", sc=2) + 8
    face_x = SLOTS[index]["x"] + PARTS["ownerFace"]["x"] + 16
    x = max(lane["x"], min(lane["x"] + lane["width"] - width, round(face_x - width / 2)))
    cv.paste(nine("ui-quip", width, lane["height"]), x, lane["y"])
    hz.text(cv, line, x + 4, lane["y"] + 7, "plum", font="font-body", sc=2)


# ---------- frames ----------

ZONES = {
    "street": dict(route=["street"], money=18, treats="2/3", fill=0.35,
                   objects=hz.ZONES["street"]["objects"],
                   slots=(dict(dog="koda", hearts=4, state="walking", statuses=("soaked",)),
                          dict(dog="biscuit", hearts=1, state="warn"),
                          dict(dog="duchess", hearts=0, state="fired")),
                   quip=None),
    "homeStretch": dict(route=["street", "park", "shops", "homeStretch"], money=64, treats="1/3", fill=0.6,
                        objects=(("tip", "idle", 1, 170), ("tip", "idle", 1, 230), ("cone", "idle", 3, 300),
                                 ("hydrant", "idle", 4, 420), ("tip", "idle", 3, 520), ("treat", "idle", 2, 380)),
                        slots=(dict(dog="penny", hearts=3, state="loss"),
                               dict(dog="biscuit", hearts=6, state="walking", statuses=("spooked", "stinky")),
                               dict(state="empty")),
                        quip=(0, "Gently with her!")),
}


def frame(zone, look):
    z = ZONES[zone]
    cv = hz.Screen(zone)
    hz.ground_rows(cv, zone, hz.FAR_Y, hz.SH, hz.true_scale)
    hz.objects(cv, z["objects"])
    walking = [f"dog-{s['dog']}" for s in z["slots"] if s["state"] not in ("fired", "empty")]
    cv.pack(hz.LANES[2], walking)
    cv.paste(hp.image(f"backdrop-{hp.ZONES[zone]['art']}"), 0, hz.BAND_Y)
    approach = LAYOUT["regions"]["approach"]
    hz.ground_rows(cv, zone, approach["y"], approach["y"] + approach["height"], hz.true_scale, road_only=True)
    hz.top_bar(cv, z["money"], z["treats"], z["route"], z["fill"])
    if look.has_band:
        band(cv)
    for rect, s in zip(SLOTS, z["slots"]):
        slot(cv, look, rect["x"], rect["y"], s)
    if z["quip"]:
        quip(cv, *z["quip"])
    return cv


def check(image):
    pal = {tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in PALETTE}
    bad = {c for _, c in image.convert("RGB").getcolors(1 << 16) if c not in pal}
    assert not bad, f"off-palette colours: {sorted(bad)[:5]}"


def build():
    os.makedirs(OUT, exist_ok=True)
    for zone in ZONES:
        art = hp.ZONES[zone]["art"]
        for name, look in LOOKS.items():
            image = frame(zone, look).img
            check(image)
            path = f"{OUT}/{art}-{name}.png"
            image.save(path)
            print(path)


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
