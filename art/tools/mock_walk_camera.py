#!/usr/bin/env python3
"""Mock: the walk screen's camera, road start and object sizes, against the current build.

Draws 360x560 frames in Endesga 32 from the exported art, through help.py's Scene grown to the
full screen: the top bar, Elm Avenue's backdrop, its road in the game's projection, the walker
with a pack of 3, the same obstacles and pickups at the same road distances, and the doghouse
row. Every frame shows one fixed scene, so each proposal compares with current.png directly.

- current: the build. The road surface scrolls under the backdrop's approach rows (126 to 149),
  its top 12 rows dithered into the backdrop's bottom row, beside the backdrop's painted verges.
  Spawns come into view on row 150, 900 road px ahead.
- juncture: the road, verges and markings scroll from row 126, the cross street's near
  sidewalk, and spawns come into view there, 1046 road px ahead. Only the band above it stays
  still. A cone stands at the juncture.
- tilt-20, tilt-25: the road's 320 rows shrunk 20% and 25%, with the far edge kept at scale 0.5
  and the look-ahead shrunk in step (3.6 s and 3.4 s). The freed rows go to the doghouse row,
  stretched to fit, so the walk view moves up by them.
- size-48, size-56, size-64: dogs, the walker and the 40px obstacles drawn as if 48, 56 and 64px
  (the walker 1.5x as tall), upscaled nearest-neighbour from the 40px art, with the pack's
  formation, hands and collars scaled to match. size-56 outlines a 40px hit box on each.

Usage:
  mock_walk_camera.py build    write public/art/mocks/walk-camera/*.png

Run from the repository root. Mock tooling only: nothing here is game art.
"""

import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import help as hp  # noqa: E402

OUT = "public/art/mocks/walk-camera"
W, H = 360, 560
ZONE = "street"
BAND = hp.LAYOUT["regions"]["backdrop"]                 # rows 40 to 149
APPROACH = hp.LAYOUT["regions"]["approach"]["y"]        # 126: the cross street's near sidewalk ends
FAR_Y = hp.LAYOUT["regions"]["road"]["y"]               # 150
ROAD_BOTTOM = FAR_Y + hp.LAYOUT["regions"]["road"]["height"]  # 470, the doghouse slots' top row
FOOT_Y = hp.CAMERA["footY"]                             # 464
DOG_BAND_Y = 466                                         # ui-dog-band's top row
FADE_ROWS = 12
BAYER_4 = (0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5)
SPEED = hp.tuning("pixels", "roadScrollSpeed")
LOOK_AHEAD = hp.tuning("seconds", "lookAheadSeconds")
DOGS = ("koda", "biscuit", "duchess")
# The scene: (key, tag, lane, distance ahead of the feet in road px), far ones drawn first.
OBJECTS = [("tip", "idle", 3, 880), ("hydrant", "idle", 1, 760), ("tip", "idle", 2, 640),
           ("bin", "idle", 4, 520), ("treat", "idle", 0, 420), ("cone", "idle", 3, 300),
           ("tip", "idle", 1, 180)]
OBSTACLES = {"bin", "cone", "hydrant"}
BIG = {f"dog-{d}" for d in DOGS} | {"walker-casey"} | OBSTACLES

FRAME = hp.frame
FORMATIONS, HANDS, COLLAR = dict(hp.FORMATIONS), hp.HANDS, hp.COLLAR


def image(key):
    return Image.open(f"public/art/images/{key}.png").convert("RGBA")


def camera(shrink):
    """The game's camera with the road's 320 rows shrunk by shrink: feet on row 464, the far edge
    at scale 0.5 on row farY, the look-ahead shrunk in step. Returns horizonY, focal, ratio, farY
    and the visible distance in road px."""
    far_y = ROAD_BOTTOM - round((ROAD_BOTTOM - FAR_Y) * (1 - shrink))
    k = 2 * (FOOT_Y - far_y)
    visible = SPEED * LOOK_AHEAD * (1 - shrink)
    return dict(horizonY=FOOT_Y - k, focal=visible, ratio=k / visible, farY=far_y, visible=visible)


def use(horizon_y, focal, shift=0):
    """Point help.py's projection at a camera, drawn shift rows higher than its own rows."""
    hp.W, hp.H, hp.OX, hp.TOP = W, H, 0, 0
    hp.YH, hp.F, hp.KS = horizon_y - shift, focal, FOOT_Y - horizon_y


def upscaled(k):
    """help.frame with the BIG keys' art grown k times, nearest-neighbour; None restores it."""
    def frame(key, tag, i=0):
        art = FRAME(key, tag, i)
        if k is None or key not in BIG:
            return art
        return art.resize((round(art.width * k), round(art.height * k)), Image.NEAREST)
    hp.frame = frame
    q = 1 if k is None else k
    hp.FORMATIONS = {n: [(dx * q, d * q) for dx, d in f] for n, f in FORMATIONS.items()}
    hp.HANDS = tuple(v * q for v in HANDS)
    hp.COLLAR = COLLAR * q


def fade_covers(x, row):
    """roadRaster.ts's fadeCovers: the approach's top rows dissolve into the backdrop's bottom row."""
    return (BAYER_4[(row & 3) * 4 + (x & 3)] + 0.5) / 16 < (FADE_ROWS - row - 0.5) / FADE_ROWS


def bottom_panel():
    """ui-dog-band with the three doghouse slots, as rows 466 to 559."""
    panel = hp.Scene(W, H - DOG_BAND_Y)
    panel.img.paste(image("ui-dog-band"), (0, 0), image("ui-dog-band"))
    for i, d in enumerate(DOGS):
        panel.doghouse(i * 120, 470 - DOG_BAND_Y, d, hp.dog(d)[3])
    return panel.img


def label(sc, lines):
    w = max(hp.text_w(ln) for ln in lines) + 12
    sc.bubble((W - w) // 2, 44, w, lines)


def scene(road_from=FAR_Y, extra=(), panel_rows=0, hit_boxes=False, lines=()):
    """One frame of the fixed scene in the camera help.py points at. The road scrolls from row
    road_from; above it the backdrop. With road_from on 150 the approach rows draw the road
    surface only, faded as the build does. panel_rows grows the doghouse row upward."""
    sc = hp.Scene(W, H)
    sc.road(ZONE)
    ground = sc.img.copy()
    backdrop = image(f"backdrop-{hp.ZONES[ZONE]['art']}")
    sc.img.paste(backdrop.crop((0, 0, W, road_from - BAND["y"])), (0, BAND["y"]))
    if road_from == FAR_Y:
        band_row = backdrop.crop((0, BAND["height"] - 1, W, BAND["height"]))
        for y in range(APPROACH, FAR_Y):
            _, s = hp.distance_at(y)
            for x in range(W):
                if hp.STRIP_X <= hp.CX + (x + 0.5 - hp.CX) / s < hp.STRIP_X + hp.STRIP_W:
                    row = y - APPROACH
                    src = band_row.getpixel((x, 0)) if row < FADE_ROWS and fade_covers(x, row) else ground.getpixel((x, y))
                    sc.img.putpixel((x, y), src[:3])
    seen = hp.distance_at(road_from)[0]
    boxes = []
    for key, tag, ln, d in list(extra) + OBJECTS:
        if d <= seen:
            placed = sc.stand(key, tag, hp.lane(ln), d)
            if key in OBSTACLES:
                boxes.append(placed)
    placed = sc.pack(hp.lane(2), tuple(f"dog-{d}" for d in DOGS))
    boxes += placed.values()
    if hit_boxes:
        for x, y, s in boxes:
            outline(sc, round(x), round(y), round(40 * s))
    sc.top_bar([ZONE], 0, 1, 0.3)
    b = hp.TOP_BAR["buttons"]["sound"]
    sc.paste(hp.frame("ui-icon-button", "normal"), b["face"]["x"], b["face"]["y"])
    sc.paste(hp.frame("icon-sound", "on"), b["icon"]["x"], b["icon"]["y"])
    panel = bottom_panel()
    top = DOG_BAND_Y - panel_rows
    if panel_rows:
        panel = panel.resize((W, H - top), Image.NEAREST)
    sc.img.paste(panel, (0, top))
    if panel_rows:
        for x in (*range(0, 6), *range(W - 6, W)):
            sc.fill(x, top, 1, 1, "amber")
    if lines:
        label(sc, lines)
    return sc.img


def outline(sc, cx, foot, size):
    """A faint 1px hit box, size square, standing on the feet row: half way to white."""
    px = sc.img.load()
    x0, y0 = cx - size // 2, foot - size
    for x in range(x0, x0 + size):
        for y in (y0, foot - 1):
            px[x, y] = tuple((c + 255) // 2 for c in px[x, y])
    for y in range(y0 + 1, foot - 1):
        for x in (x0, x0 + size - 1):
            px[x, y] = tuple((c + 255) // 2 for c in px[x, y])


def build():
    os.makedirs(OUT, exist_ok=True)
    base = hp.CAMERA
    frames = {}
    use(base["horizonY"], base["focal"])
    frames["current"] = scene()
    frames["juncture"] = scene(APPROACH, extra=[("cone", "idle", 2, math.floor(hp.distance_at(APPROACH)[0]))],
                               lines=["ROAD AND SPAWNS FROM ROW 126"])
    for pct in (20, 25):
        cam = camera(pct / 100)
        shift = cam["farY"] - FAR_Y
        use(cam["horizonY"], cam["focal"], shift)
        frames[f"tilt-{pct}"] = scene(panel_rows=shift, lines=[
            f"TILT {pct}%: DOGHOUSE ROW {H - ROAD_BOTTOM + shift} ROWS, WAS {H - ROAD_BOTTOM}"])
        print(f"tilt {pct}%:", {k: round(v, 4) for k, v in cam.items()}, "shift", shift)
    use(base["horizonY"], base["focal"])
    for size in (48, 56, 64):
        upscaled(size / 40)
        frames[f"size-{size}"] = scene(hit_boxes=size == 56, lines=[
            f"{size}PX, UPSCALED" + (", 40PX HIT BOX" if size == 56 else "")])
    upscaled(None)
    for name, img in frames.items():
        img.save(f"{OUT}/{name}.png")
    print("built", ", ".join(frames))


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
