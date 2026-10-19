#!/usr/bin/env python3
"""Mock: Elm Avenue's roadside props as the game would draw them, beside today's plain lawn.

Draws full 360x560 Elm Avenue run screens in Endesga 32 from the exported art (ui-top-bar, the road
strip, walker, dogs, road objects, the roadside-* props, backdrop-woof-way, ui-doghouse), as horizon.py
does: today's frame, the roadside frames at three scroll positions, one of them under the dimmed road
a card or the pause menu draws, and a sheet of every prop at every depth step.

The camera and verges are the game's (shared/export/layout.json): a point d road px ahead of the feet
draws at scale s = focal / (focal + d) on row horizonY + (footY - horizonY) s, at x 180 -/+ across s.
Props are placed by art/tools/roadside.py's PLACEMENT table, drawn from the smallest of their exported
steps at least their projected size (help.depth_frame, as the game does), back to front with the road
objects, the free-standing ones over the game's ground shadow in dgreen, all under the backdrop band and
the doghouses.

Usage:
  roadside.py build    write public/art/mocks/roadside/*.png

Run from the repository root after art/tools/roadside.py build. Mock tooling only: nothing here is
game art.
"""

import importlib.util
import os
import sys

from PIL import Image

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
sys.path.insert(0, HERE)
import help as hp  # noqa: E402
import horizon as hz  # noqa: E402

# art/tools/roadside.py, loaded under its own name since this file shares it
_spec = importlib.util.spec_from_file_location("roadside_props", os.path.join(HERE, "..", "tools", "roadside.py"))
rs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rs)

OUT = "public/art/mocks/roadside"
ZONE = "street"
ART = hp.ZONES[ZONE]["art"]
F, YH, KS, CX = hz.F, hz.YH, hz.KS, hz.CX
STEPS = {1: "", 0.875: "@88", 0.75: "@75", 0.625: "@62", 0.5: "@50"}
# The props stay clear of a road object's feet by this much, as the game draws road objects only ahead
# of the pack.
NEAREST = 90


def opaque_width(key):
    box = hp.frame(key, "idle").getbbox()
    return box[2] - box[0]


def shadow(cv, cx, foot, width, s):
    """The game's ground shadow (src/scenes/draw.ts shadowTexture): an ellipse of radii
    max(3, width s / 2 - 2) and max(1, 2.5 s), centred a pixel above the feet, in dgreen."""
    rx = round(max(3, width * s / 2 - 2) * 2) / 2
    ry = max(1, round(2.5 * s * 2) / 2)
    for dy in range(-int(ry) - 1, int(ry) + 2):
        for dx in range(-int(rx) - 1, int(rx) + 2):
            nx, ny = (dx + 0.5) / rx, (dy + 0.5) / ry
            if nx * nx + ny * ny <= 1:
                cv.fill(cx + dx, foot - 1 + dy, 1, 1, rs.SHADOW_COLOUR)


def frame(scroll, props=True):
    """Elm Avenue after scroll road px of walking: the road, the props and road objects back to front, the
    pack, the backdrop band over them, the band's road rows, the HUD."""
    z = hz.ZONES[ZONE]
    cv = hz.Screen(ZONE)
    hz.ground_rows(cv, ZONE, hz.FAR_Y, hz.SH, hz.true_scale, scroll=scroll)
    far = hz.LAYOUT["camera"]["visibleDistance"]
    items = [(d - scroll, "road", it) for it in z["objects"] for d in [it[3]] if d - scroll >= NEAREST]
    if props:
        for side, sign in (("left", -1), ("right", 1)):
            for wz, across, key in rs.placements(ART, side, scroll, scroll + far + 1):
                items.append((wz - scroll, "prop", (sign, across, key)))
    for d, kind, it in sorted(items, key=lambda i: -i[0]):
        if kind == "road":
            key, tag, lane, _ = it
            cv.stand(key, tag, hz.lane_x(lane), d)
            continue
        sign, across, key = it
        s = F / (F + d)
        img, feet = hz.sprite(key, "idle", s, scroll // 30)
        x, y = CX + sign * across * s, round(YH + KS * s)
        if key in rs.SHADOWED:
            shadow(cv, round(x), y, opaque_width(key), s)
        cv.paste(img, round(x - img.width / 2), y - feet)
    cv.pack(hz.LANES[2], [f"dog-{k}" for k, _ in z["dogs"]])
    cv.paste(hp.image(f"backdrop-{ART}"), 0, hz.BAND_Y)
    approach = hz.LAYOUT["regions"]["approach"]
    hz.ground_rows(cv, ZONE, approach["y"], approach["y"] + approach["height"], hz.true_scale,
                   scroll=scroll, road_only=True)
    hz.hud(cv, hz.ROUTES[ZONE], z["money"], z["treats"], 0.35, z["dogs"])
    return cv


def dimmed(cv):
    """The road view two ramp steps darker, as the pause menu dims it under its panel."""
    road = hz.LAYOUT["regions"]["roadView"]
    cv.dim(road["x"], road["y"], road["width"], road["height"])
    return cv


def sheet():
    """Every exported prop at each depth step, bottoms aligned, on Elm Avenue's lawn; the sprinkler's two
    frames side by side."""
    cells = [(k, 0) for k in rs.PROPS] + [("roadside-sprinkler", 1)]

    def art(key, i, s):
        return hp.frame(f"{key}{STEPS[s]}", "idle", i)

    gap, pad = 6, 8
    cols = [max(art(k, i, s).width for s in STEPS) for k, i in cells]
    rows = [max(art(k, i, s).height for k, i in cells) for s in STEPS]
    img = Image.new("RGB", (sum(cols) + gap * (len(cells) - 1) + 2 * pad, sum(rows) + gap * 4 + 2 * pad),
                    hp.rgb("green"))
    y = pad
    for s, rh in zip(STEPS, rows):
        x = pad
        for (k, i), cw in zip(cells, cols):
            spr = art(k, i, s)
            img.paste(spr, (x + (cw - spr.width) // 2, y + rh - spr.height), spr)
            x += cw + gap
        y += rh + gap
    return img


SCROLLS = (0, 150, 300)


def build(out=OUT, scrolls=SCROLLS):
    os.makedirs(out, exist_ok=True)
    imgs = {f"{ART}-today": frame(0, props=False).img}
    for i, scroll in enumerate(scrolls):
        imgs[f"{ART}-roadside-{i + 1}"] = frame(scroll).img
    imgs[f"{ART}-roadside-dimmed"] = dimmed(frame(scrolls[0])).img
    imgs["props"] = sheet()
    for name, img in imgs.items():
        hz.check(img)
        img.save(f"{out}/{name}.png")
        print(f"{out}/{name}.png {img.width}x{img.height}")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
