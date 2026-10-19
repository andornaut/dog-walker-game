# Art Style Guide

## Direction

- Pixel art: simple, cute, a little retro, refined. Mood: casual, cozy, low-stress.
- Chibi: heads about as big as bodies, so a breed reads from head shape, ears and markings at 32×32. Small dogs sit well inside the frame; big dogs fill it. A dog's coat and accessory read on both its road sprite and its face.
- Everything, UI included, is pixel art at the 360×640 base resolution, scaled up with no smoothing.

## Layout and sizes

Top to bottom: status bar 360×40, backdrop band 360×150, then the dog column 80×450 (3 doghouse slots, fixed width) left of the road 280×450 (5 lanes of 56px).

| Sprite                                                    | Frame                      |
| --------------------------------------------------------- | -------------------------- |
| Road tiles, dogs, animals, dog and owner faces            | 32×32                      |
| People: walkers, owners, forced-stop and lucky characters | 32×48 (kids drawn shorter) |
| Pickups, small effects, icons                             | 16×16                      |
| Dog portraits                                             | 64×64                      |
| Obstacle n lanes wide, m rows (56px each) long            | (56n−24)×(56m−24)          |

A 32px sprite leaves 12px of margin each side of its lane. The drawn obstacle box is its hit box. Exceptions that stand up in perspective: the parked car (40×128, anchored bottom-centre at its footprint's near edge), the two-lane ice cream truck (64×48) and construction (56×32 per lane).

## Palette and outlines

- [Endesga 32](https://lospec.com/palette-list/endesga-32) only, each pixel opaque or fully transparent. Colour names are the `K` names in `art/tools/pixel.py`.
- Darkening (shadows, the dimmed road) maps each colour one step down its ramp (`DARKER`), never a blend with black.
- Outlines are coloured: two ramp steps darker than the fill they border.
- Road sprites use `road_edge`: the outline continues down the ramp until it holds 3:1 against the three light roads (Bark Park, Sniff Street Shops, The Long Way Home), and the fill carries Woof Way. A dark area takes a light rim on its edges facing the top-left light (grey on navy and black, skin2 on dark skin, cyan on sky) so it holds 3:1 on Woof Way.
- Effects (`fx-`) take a fixed 1px rim instead: plum, navy for water, teal for green. `fx-bark` and `fx-heart` keep a ramp outline. Hazard warnings are outlined in ink.
- Ground decals (puddles) have no outline and no shadow.
- Sprites carry no shadow; the game draws one in the road's darker ramp colour. The bouncing ball carries its own.

## Contrast

- Text holds 4.5:1 against what it sits on (3:1 at 2× and larger); essential icons and marks hold 3:1. Inactive controls are exempt.
- A state never relies on colour alone: it also changes shape (a tick, a hollow heart, a filled pip).
- The leash is a 1px line the game draws from the walker's hand to each collar: pink on Woof Way, dred on Bark Park and Sniff Street Shops, plum on The Long Way Home.

### UI colour pairs

Names are `PALETTE` names in `src/scenes/palette.ts`; ratios are WCAG.

| Pair                       | Ratio | Use                                                        |
| -------------------------- | ----- | ---------------------------------------------------------- |
| plum on cream              | 9.42  | Body text on cream, quips                                  |
| plum on tan                | 6.49  | Body text on tan                                           |
| plum on amber              | 7.35  | Text on amber: forced-stop band, step number               |
| plum on yellow             | 10.92 | Text on a selected face                                    |
| darkBrown on cream         | 5.85  | Secondary text, empty heart outline                        |
| forest on cream            | 5.39  | Money gained, affordable prices, Stinky status             |
| darkRed on cream           | 5.07  | Money lost, unaffordable prices, full heart                |
| ink on brown               | 4.65  | Text on a darkened tile                                    |
| cream on darkBrown         | 5.85  | Text on the column or wood                                 |
| amber on darkBrown         | 4.57  | Warnings, "You're fired!", logo letters                    |
| yellow on darkBrown        | 6.79  | Floating gain on the column                                |
| white on darkBrown         | 8.48  | Floating loss on the column, filled page dot               |
| tan on darkBrown           | 4.04  | Empty slot dashed border, hollow page dots                 |
| white on forest            | 7.80  | Labels on chips and buttons                                |
| white on rust              | 4.99  | Trait chip "Food"                                          |
| white on darkRed, blue     | 7.34+ | Card bands, `ui-hit-label`, `ui-fired-plate`               |
| slate on ink               | 3.27  | Unpicked tile frame                                        |
| amber on navy              | 7.49  | `icon-pause`, `icon-play` on `ui-icon-button`              |
| `ui-zone-pips` on ink      | 6.37  | `done` ticked, `todo` empty; `current` filled amber (7.35) |
| white over the dimmed road | 4.5+  | Card subtitle                                              |
| tan on the dimmed road     | 3.0+  | 1px rim around the pause panel                             |

## UI

- Wood: a plum and dbrown frame, cream paper slots and tan face panels.
- Full-screen backgrounds put low-contrast dark wood (dbrown with plum seams) under UI and scenery elsewhere.
- `ui-button`: `normal` (amber) for the primary action, `secondary` (tan) for the others, `go` (green face, ink label) for Start walk only. Pause, help and sound sit on `ui-icon-button`.
- Fonts: `font-body` (Tiny5, mixed case) for body text, quips and floating labels; `font-title` (Silkscreen, capitals) for titles, numbers and buttons. Floating numbers use the font, not sprites.

### Feedback and selected state

- A press shows at once, before any selected state: the item dips 2px (a button into its lip) and `fx-tap` bursts under the finger.
- Anything picked, equipped, toggled on or active (tile, walker, switch row, tab, current page) shows all four cues: `ui-select` 3px outside it; a yellow face where unselected faces stay cream or tan; a 2px lift onto a shadow; a `ui-check` badge (pick order or tick) at its top-left.
- When a choice is full (pack full, gear equipped), unselected items darken one ramp step.
- A picked item's face hops; a picked dog hops onto the gate path in `fx-dust`.
- An affordable item takes `ui-afford` 2px outside it, unless selected.
- An unaffordable locked item shakes when tapped. The ready Start walk button bobs.
- With reduced motion, highlights stay and movement is skipped.

### Sound toggle and settings

| Control      | Scene                | Button | Hit area     |
| ------------ | -------------------- | ------ | ------------ |
| Sound toggle | Run top bar          | 146,10 | 124,0 44×44  |
| Pause        | Run top bar          | 170,10 | 168,0 44×44  |
| Sound toggle | Home gate, top right | 332,46 | 316,40 44×44 |
| Help         | Home gate, top left  | 8,46   | 0,40 44×44   |

- `icon-sound`: `on` is a speaker with two waves, `off` the same speaker with a pink X.
- Settings: a "Sound" row with a right-aligned `ui-switch` above the Music and Effects sliders. Each row is one tap target at least 44 tall, led by its `-panel` icon (`off` adds a dred X).
- Sliders: for a track of width w at x and value v, draw `empty` across w, `filled` from x to the knob's right edge, and `ui-slider-knob` at x + round((w − 10) × v / 100), 3px above the track. Muted, both switch to their `-disabled` tags.

## Run screen

### Doghouse slots

`ui-doghouse` (72×146) has a roof in the dog's signature colour and an 8×8 emblem of its accessory in the gable, so houses differ by shape as well as colour. The game draws, in slot pixels:

| Element           | Position                                                        |
| ----------------- | --------------------------------------------------------------- |
| Dog's name        | Centred at (36,16) on the roof plate (x 8 to 63, rows 14 to 25) |
| Dog's face        | (20,36), in the door                                            |
| "n/max" count     | Centred at (36,70), dred on the cream doormat, 31px wide        |
| Owner's face      | (8,78), in the window                                           |
| Status icons      | 16×16 at (46,78) and (46,96)                                    |
| Owner's name      | (9,118)                                                         |
| Hearts            | From (9,127), rows of six, 9px across and 8px down              |
| FIRED (fired dog) | Centred at (36,128) on the grey, empty `empty` house            |

At 1 ♥, `ui-doghouse-warn` pulses over the house (`static` with reduced motion).

### Choice cards

- Band colour by card type: dred encounter, blue lucky, amber forced stop, forest upgrade.
- Illustrations are road sprites at 1× on a scrap of the zone's ground, with no walker: a leash runs off the bottom edge.
- A disabled card is greyed with the grey ramp; the selected one is outlined in amber.

### Hits, moments and statuses

| Event              | Shows                                                                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any hit            | `fx-bump` at the contact point; walker `stumble`, dogs `react`                                                                                                                                           |
| Minor bump         | `fx-coins` under the cause label; `fx-dizzy` over the walker while lane input is locked                                                                                                                  |
| Puddle, pickup     | `fx-splash`, `fx-sparkle`                                                                                                                                                                                |
| ♥ change at a slot | `fx-heart` `up` or `down` beside the floating label                                                                                                                                                      |
| Encounter hit      | `fx-hit-<encounter>` over the pack; `ui-hit-flash-<colour>` at the edges (skunk green, puddle sky, thief amber, squirrel orange, other dog pink); the label at 2× on `ui-hit-label`; caught dogs `shake` |
| Firing             | Owner's `fired` face at 2× over the doghouse on `fx-fired-pop` at 2×; the fired line in `ui-quip`; `ui-fired-plate` (blue laid-back, purple fussy, dred dramatic)                                        |
| 1 ♥                | Owner's `worried` face and `ui-doghouse-warn`                                                                                                                                                            |
| Fee payout         | `fx-coin-fly` to the bank under `ui-payout-label`                                                                                                                                                        |
| Treat given        | `fx-treat-pop` and the owner's `happy` face                                                                                                                                                              |
| Moving hazard      | `ui-warning` and `ui-warning-arrow` at the lane edge about 1s ahead                                                                                                                                      |

- `fx-status-<status>` loops over the dog's head, 6px below its top opaque row. Stinky shows per dog, never with the pack-wide `fx-stinky`. Two statuses alternate every second, most recent first.
- With reduced motion, bursts and stars play and the stumble is skipped.
- Crossers are side views facing right, mirrored for left. Anything coming down a lane faces the player.

## Animation

- Animation names are Aseprite tag names. New tags go after existing ones so frame indices hold. Motion is in whole pixels.
- Walkers are seen from behind: `walk` 4, `react` 2, `stumble` 4 and `idle` 2 frames. No gear variants.
- Dogs are seen from above and behind. `walk` is a trot: diagonal leg pairs swap, the body bobs on the passing frames, the tail wags. `pull` leans right and is mirrored for left. `shake` runs at 60ms.
- Every road sprite that stands or waits, depth variants included, loops an `idle` with frame 0 the rest pose. Reduced motion shows frame 0.

| Idle      | Frames | Timing       | Motion                                                                              |
| --------- | ------ | ------------ | ----------------------------------------------------------------------------------- |
| People    | 2      | 400ms        | Breathing: the body 1px higher on frame 2, feet planted, arms at rest               |
| Dogs      | 4      | 300ms        | Tail at −1, 0, +1, 0; the right ear 1px higher on the last frame                    |
| Obstacles | 2 to 4 | 350 to 500ms | A small event (glint, lid, drip, leaves, hazard lights); rest pose most of the loop |

## Depth scaling

Sprites scale by depth in steps of 1×, 0.75× and 0.5×, nearest-neighbour. A sprite whose 1px outline, legs or motion breaks at a step gets a redrawn `<key>@75` or `<key>@50`: round(size × scale), the original's tags, frames and durations, a full 1px outline, and 1px motion kept at 1px. Sprites whose features are all 2px or wider scale at runtime.

## Road strips

- 280×64, tiling vertically with no seam: patterns repeat every 64 rows or a divisor of it.
- The base is the zone's road colour, so the game's shadow matches.
- The four lane dividers sit at x = 56k−1, 2px wide, one look per zone. Lane marks are dbrown on Bark Park and white outlined in plum on The Long Way Home.
- Curbs and verges stay inside the outer 3 to 7px, clear of the 12px sprite margin.
- A transition strip joins the previous zone (bottom rows) to the new one (top rows) with a crossing.
- The projection samples strip rows up to 4 apart near the backdrop and the road moves 2 rows per frame, so: patterns along the road repeat every 8 rows or more; lines across the road are at least 2 rows tall and low in contrast; fine detail runs along the road; small texture is spaced irregularly.

## Backdrops

The street ends at a T-junction. The band's bottom 27 rows continue the road's projection at its slope, up to a flat cross street on rows 96 to 122 (far sidewalk, far curb, road with centre line, near curb, near sidewalk). The far side faces the camera on ground row 90.

Where row 149 meets the road:

| Zone               | Edge                | Curb     | Road from  |
| ------------------ | ------------------- | -------- | ---------- |
| Woof Way           | Sidewalk 125 to 147 | 148..150 | 151        |
| Bark Park          | Grass to 150        | none     | 151 (path) |
| Sniff Street Shops | Paving to 147       | 148..151 | 152        |
| The Long Way Home  | Sidewalk 125 to 147 | 148..149 | 150        |

Gag spots, kept clear: the near-left perch's top rail (rows 132 to 133, x 0 to 121), the near-right lawn (x 322 to 354, rows 123 to 146), and both sidewalks.

## Sound

- Soft chiptune: square and triangle waves through gentle low-pass filters, short envelopes, nothing harsh.
- Hits and pickups under about 0.6s; `sfx-fired`, `sfx-badge` and `sfx-new-best` up to 2s; the walk loop at about 100 BPM.
- Files: effects under 50kB, music under 1MB, peaks below −1 dBFS after encoding, silence at both ends.

## Pipeline

- `art/tools/<set>.py` draws every asset except the hand-drawn favicons: it writes the sources in `art/<set>/`, exports them and lists them in `public/art/manifest.json`. Run `python3 art/tools/<set>.py build` (or `preview OUT.png`) from the repository root.
- A build overwrites the `.aseprite` files: change the script, not the sources.
- Each script's docstring holds its assets' sizes, tags, timings and placement coordinates.

### Naming

- The kebab-case manifest key is the file name: `art/<set>/<key>.aseprite` exports to `public/art/sprites/<key>.png` and `.json`, `public/art/images/<key>.png` or `public/art/fonts/<key>.png` and `.fnt`.
- A key starts with its kind's prefix, as in `inventory.md` (`dog-`, `fx-`, `ui-`); road objects, moving hazards and `logo` use a plain name.
- A depth variant appends `@75` or `@50` (`dog-koda@50`).

### Consistency checks

Before an asset goes in the game, check its export against the palette and opacity rule, the frame size in `inventory.md`, and the proportion and outline rules, in the `/art/` gallery on each zone's ground colour.
