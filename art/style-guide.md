# Art Style Guide

## Direction

- **Pixel art: simple, cute, a little retro, but refined.** Write down every choice that keeps assets looking like one game.
- **Mood:** casual, cozy, low-stress.
- **Camera:** ¾ top-down sprites on a pseudo-3D road: the road recedes toward the backdrop band, its lanes converging, and sprites scale by depth in fixed steps of 1×, 0.75× and 0.5×, nearest-neighbour.
- **Orientation:** portrait.
- **Choice cards:** art-led, an illustration plus a one-line effect. A card is 83×140: a coloured title band (dred for encounters, blue for lucky encounters, amber for forced stops, forest for upgrades), a 75×56 illustration in a recessed window, the effect text below it, and a dark cost badge at the bottom. The enlarged card is 166×280, the same layout at 2× with 1px detail. Illustrations are composed from the road sprites at 1× on a scrap of the zone's ground, and show no walker (the player picks one of four): a leash running off the bottom edge stands for the walker.
- **Dog slots:** each slot in the dog column is a 72×146 doghouse (`ui-doghouse`) with a deep roof in the dog's signature colour and an 8×8 emblem of its accessory in the gable vent, so houses differ by shape as well as colour. The game draws on it: the dog's name centred at (36,16) on the roof plate (x 8 to 63, rows 14 to 25); the dog's face at (20,36) in the door; the "n/max" count centred at (36,70) in dred on the cream doormat (31px wide, room for "10/10"); the owner's face at (8,78) in the window; up to two status icons (16×16) at (46,78) and (46,96) on pegs beside the window; the owner's name at (9,118); and the hearts from (9,127) in rows of six, 9px across and 8px down, so happiness never relies on colour alone. A fired dog's house turns grey and empty, with FIRED at (36,128). At 1 heart, `ui-doghouse-warn` (a 2px orange and amber rim inside the house's outline) pulses over the house, or holds still with reduced motion.
- **Base render resolution:** 360×640, scaled up crisply with no smoothing.
- **Run screen layout:** top to bottom, a 360×40 status bar (money, zone progress); a 360×150 neighbourhood backdrop for the current zone, where the scenery gags live; then a fixed-width 80×450 dog column on the left with 3 slots (a fired dog's slot empties and the road never changes width) beside the 280×450 road. On an encounter the road pauses and dims, and the cards cover the road while the bar, backdrop and dog column stay visible.
- **Sizes:** 32×32 for road tiles, dogs and obstacles; lanes are 56px wide, leaving ~12px of margin. An obstacle n lanes wide and m rows long is 56n−24 by 56m−24, except where it stands up in perspective: the parked car is 40×128 from behind, anchored at its footprint's near edge, and the two-lane ice cream truck is 64×48. People (walkers, owners, forced-stop and lucky-encounter characters) are 32×48, so they stand taller than the dogs. Pickups and small effects are 16×16. Dog and owner faces in the dog column are 32×32.
- **Palette:** [Endesga 32](https://lospec.com/palette-list/endesga-32), and no other colours. Every pixel of every asset is one of its 32 colours. Darkening (shadows, the dimmed road behind cards) maps each colour to the next darker colour in its ramp rather than blending with black, so the screen stays on the palette.
- **Outlines:** coloured. A sprite's outline is two ramp steps darker than the fill it borders, so dark sprites (the skunk) keep their silhouette. A road sprite's outline continues down the ramp until it holds 3:1 against Bark Park, Sniff Street Shops and The Long Way Home (white and grey coats end at dslate; apricot, cream, tan and amber at plum; green at teal), and the fill inside it carries Woof Way (`road_edge` in `art/tools/pixel.py`). A dark area on a road sprite takes a light rim on its edges facing the top-left light (grey on navy and black, skin2 on dark skin, cyan on sky) so it holds 3:1 on Woof Way. Ground decals such as puddles have no outline. Effects (`fx-`) take a fixed 1px rim instead of a ramp outline: plum, or navy for water and teal for green, so they hold 3:1 on the light roads.
- **UI colours:** wood. A dark brown frame (`#3e2731`, `#733e39`) with cream paper slots (`#ead4aa`) and tan face panels (`#e4a672`). Text and icon colours on them follow the UI colour pairs below.
- **Proportions:** chibi. Heads are about as big as bodies, so a breed reads from its head shape, ears and markings at 32×32.
- **Walkers:** each seen from behind with a 4-frame `walk`, a 2-frame `react`, a 4-frame `stumble` and a 2-frame `idle`, plus a front-view portrait for the picker. Kids are drawn shorter than adults inside the same 32×48 frame. Walker sprites have no gear variants.
- **Leash:** a 1px line drawn in code from the walker's hand to each collar; there is no leash sprite. Its colour is set per zone to hold 3:1 against the road: `#f6757a` (pink) on Woof Way, `#a22633` (dred) on Bark Park and Sniff Street Shops, `#3e2731` (plum) on The Long Way Home.
- **Dog animation:** road sprites are seen from above and behind. `walk` is a 4-frame trot (diagonal leg pairs swap, the body bobs on the passing frames, the tail wags), `react` is a 2-frame hop, `pull` is 2 frames leaning right, which the game mirrors for a pull to the left, and `tell` is the 2-frame lean shown, with the `fx-bark` pop, before a pull. `idle` is 4 frames standing, for pauses, and `shake` is a 4-frame shake-off at 60ms (droplets fly from the flanks) after an encounter hit. Sprites carry no shadow; the game draws one in the road's darker ramp colour.
- **UI art:** all UI (card frames, panels, status bar) is pixel art at the base resolution, with a pixel font.
- **Feedback:** every tap is visible. A pressed tile or button dips 2px (a button sinks into its lip) and a sparkle (`fx-tap`) bursts where the finger lands. A picked dog or gear item follows the selected and active state below; its face also hops, and the dog hops onto the gate path in a puff of dust (`fx-dust`). A locked item the player can't afford shakes. The ready Start walk button bobs. With reduced motion, the highlights stay and the movement is skipped.
- **Sound toggle:** a mute-all control in the run top bar beside pause (button at 146,10, hit area 124,0 44×44; pause's hit area 168,0 44×44) and in the home gate scene's top right opposite help (button at 332,46, hit area 316,40 44×44; help at 8,46, hit area 0,40 44×44). It is a `ui-icon-button` carrying `icon-sound`: a speaker with two waves when sound is on, the same speaker with a pink X when muted, so the state reads by shape. In Settings, a "Sound" row above the music and effects sliders carries `ui-switch`, right-aligned; the whole row is the tap target, at least 44 tall. Pause and help use the same `ui-icon-button`. Each Settings row carries a 16×16 `-panel` icon (dbrown with plum shading; off shows a dred X in place of the waves or sparkles). The Music and Effects sliders use `ui-slider` (filled is a solid forest bar 10px tall, empty a hollow plum groove 6px tall) with `ui-slider-knob`; for a track of width w at x with value v, draw `empty` across w, `filled` from x to the knob's right edge, and the knob at x + round((w − 10) × v / 100), 3px above the track. Muted, they switch to the `-disabled` tags. The primary action is `ui-button` `normal` (amber); other actions use `secondary` (tan). Start walk alone uses `go` (green face, ink label), so the one action that starts play never blends with the amber and yellow tiles around it.
- **Selected and active state:** anything picked, equipped, toggled on or currently active (a dog or gear tile, the walker, a settings switch row, a tab, the current page) must be obvious at a glance, by more than one cue at once: (1) the `ui-select` frame, an ink edge either side of a band pulsing amber and orange, 3px outside the item; (2) the item's face turns yellow (`#fee761`, plum text on it at 10.92:1) while unselected items stay cream or tan; (3) it lifts 2px onto a shadow; and (4) a badge (`ui-check`: the pick order or a tick) at its top-left corner. When a choice is full (the pack is full, a gear item is equipped), the unselected items darken one ramp step so the selected ones stand out. Pressing shows immediately: the item dips 2px and `fx-tap` bursts, before the selected state appears. An item the player can afford takes `ui-afford`, 2px outside it: a plum-keyed 1px amber line with gold coin studs on the corners and a slow glint, no pulse. Selected wins: a selected item shows only `ui-select`.
- **Idle animations:** nothing on the road is frozen. Every road sprite that stands or waits has a looping `idle`, added after its other tags so their frame indices hold, with frame 0 the rest pose. People and walkers breathe: 2 frames at 400ms, the body 1px higher on the second with the feet planted and the arms at rest. Dogs stand and wag: 4 frames at 300ms, the tail at −1, 0, +1, 0 and the right ear 1px higher on the last frame. Obstacles play a small event: 2 to 4 frames at 350 to 500ms that hold the rest pose for most of the loop (a glint, a lid lifting, a drip, a leaf stirring, leaves rustling, hazard lights). Motion is whole pixels. Depth variants carry the same `idle`. With reduced motion, an idle shows frame 0.
- **Dog portraits:** 64×64 for the dog pick and the shop. The dog sits in a three-quarter front view turned toward the top-left light, head and shoulders with its front paws at the bottom edge, in the same coat and accessory as its face.
- **Screen backgrounds:** full-screen backgrounds keep the areas where UI sits in low-contrast dark wood (dbrown with plum seams), so cream and tan UI text reads on them; scenery goes where no panel sits.
- **Contrast:** text holds 4.5:1 against what it sits on (3:1 at 2× and larger) and essential icons and marks 3:1. A state never relies on colour alone: it also changes shape (a tick, a hollow heart, a filled pip). Inactive controls are exempt. Lane marks are dbrown on Bark Park and white outlined in plum on The Long Way Home.
- **Sound:** soft chiptune to match the pixel art: square and triangle waves through gentle low-pass filters, short envelopes, nothing harsh. Effects stay short: hits and pickups under about 0.6s, the celebrations (`sfx-fired`, `sfx-badge`, `sfx-new-best`) up to 2s; one music loop for the walk at about 100 BPM.
- **Backdrops:** the street ends at a T-junction. The band's bottom 27 rows continue the road's projection, so the road, curb and sidewalk edges keep the road's slope across the band's bottom edge, up to a cross street drawn flat across the band (rows 96 to 122: far sidewalk, far curb, road with the zone's centre line, near curb, near sidewalk). Beyond it the far side faces the camera on ground row 90 under the sky. The near corners are left clear for the gags: the near-left perch's top rail on rows 132 to 133 across x 0 to 121, open near-right lawn at x 322 to 354, rows 123 to 146, and the sidewalks either side of the street.
- **Depth scaling:** a sprite whose 1px outline, legs or motion breaks at a depth step gets a redrawn `<key>@75` or `<key>@50`: round(size × scale), the same tags, frames and durations as the original, and a full 1px coloured outline at its own size. A 1px motion still moves 1px. Larger sprites with features 2px or wider scale at runtime.
- **Moving hazards:** crossers are side views facing right, which the game mirrors for a crossing to the left; things coming down a lane face the player. A hazard is announced about 1s ahead by `ui-warning` (a yellow sign with an ink "!") at the lane edge, with `ui-warning-arrow` showing the direction; both are ink-outlined so they read on every road. The bouncing ball carries its own ground shadow.
- **Road strips:** 280×64 images that tile vertically with no seam (patterns repeat every 64 rows or a divisor of it). The base is the zone's road colour, so the game's shadow (one ramp step darker) still matches. The four lane dividers sit at x = 56k−1, 2px wide, one look per zone. Curbs and verges stay inside the outer 3 to 7px so they clear the 12px sprite margin. A transition strip has the previous zone in its bottom rows and the new zone in its top rows, joined by a crossing. Under the pseudo-3D projection each screen row shows one strip row, up to 4 rows apart near the backdrop, and the road moves 2 rows per frame, so patterns that repeat along the road have a period of at least 8 rows, lines across the road are at least 2 rows tall and low in contrast, fine detail runs along the road, and small texture is spaced irregularly.
- **Collisions:** every hit shows an impact burst (`fx-bump`) where the pack meets the obstacle and the walker plays `stumble` while the dogs play `react`. A minor bump also knocks two coins loose (`fx-coins`) under the cause label, and dizzy stars (`fx-dizzy`) circle over the walker for as long as lane input is locked. A puddle throws up a splash (`fx-splash`); a skunk leaves stink lines (`fx-stinky`) over the pack while Stinky lasts. A pickup twinkles (`fx-sparkle`). A ♥ change at a dog slot floats a heart up (`fx-heart` `up`) or cracks one and drops the halves (`fx-heart` `down`) beside the floating label. An encounter hit plays a hit moment before its card: a 64×64 burst over the pack (`fx-hit-<encounter>`), the edge flash in the encounter's colour (`ui-hit-flash-<colour>`: green skunk, sky puddle, amber thief, orange squirrel, pink other dog) and the big label (SPRAYED!, SOAKED!, PICKPOCKETED!, SQUIRREL!, NEW FRIEND!) in font-title at 2× on `ui-hit-label`. Dog statuses loop over the head (`fx-status-stinky`, `-soaked`, `-spooked`), anchored 6px below the dog's top opaque row, with `@75` and `@50` versions for depth. The per-dog `fx-status-stinky` replaces the pack-wide `fx-stinky` (never show both). A dog with two statuses alternates between them every second, most recent first. With reduced motion, the bursts and stars play but the stumble is skipped.
- **Fonts:** two 8px pixel fonts, both under the SIL Open Font License (files and licenses in `art/fonts/`). `font-body` is Tiny5, mixed case, for body text, quips and floating labels. `font-title` is Silkscreen, capitals, for titles, numbers and buttons. Glyphs are white so the game tints them; ♥ is a drawn 7×6 heart.

## UI colour pairs

The colours scene code uses for text and marks on the wood UI. Names are the code's `PALETTE` names. Ratios are WCAG contrast.

### General rules

| Usage                                      | Colour on background   | Ratio       |
| ------------------------------------------ | ---------------------- | ----------- |
| Body text on cream                         | plum on cream          | 9.42        |
| Body text on tan                           | plum on tan            | 6.49        |
| Text on a darkened (brown) tile            | ink on brown           | 4.65        |
| Secondary text on cream                    | darkBrown on cream     | 5.85        |
| Text on the dark brown column or wood      | cream on darkBrown     | 5.85        |
| Warning text on the dark brown column      | amber on darkBrown     | 4.57        |
| Money gained or affordable price, on cream | forest on cream        | 5.39        |
| Money lost or unaffordable price, on cream | darkRed on cream       | 5.07        |
| White labels on a coloured chip or button  | white on forest / rust | 7.80 / 4.99 |

### HudScene

| Usage                             | Was                | Use                                                                              | Ratio |
| --------------------------------- | ------------------ | -------------------------------------------------------------------------------- | ----- |
| Pause button on the bar           | navy on plum       | `icon-pause` (amber) on the `ui-icon-button` navy face; `icon-play` while paused | 7.49  |
| Zone pips, done vs to do          | green vs brown     | `ui-zone-pips`: `done` is ticked, `todo` an empty dark well                      | 6.37  |
| Current pip                       | amber vs brown     | amber fill in the `current` pip's ink well                                       | 7.35  |
| Full heart on cream               | red on cream       | darkRed on cream                                                                 | 5.07  |
| Empty heart on cream              | tan on cream       | a hollow heart outlined in darkBrown                                             | 5.85  |
| Full vs empty heart               | red vs tan         | told apart by fill (full vs hollow), not colour                                  | n/a   |
| Floating gain on a cream slot     | green on cream     | forest on cream                                                                  | 5.39  |
| Floating loss on a cream slot     | red on cream       | darkRed on cream                                                                 | 5.07  |
| Floating gain on the column       | green on darkBrown | yellow on darkBrown                                                              | 6.79  |
| Floating loss on the column       | red on darkBrown   | white on darkBrown (the − sign and ♥ carry the meaning)                          | 8.48  |
| "You're fired!"                   | red on darkBrown   | amber on darkBrown                                                               | 4.57  |
| "Empty" label, fired owner name   | plum on darkBrown  | cream on darkBrown                                                               | 5.85  |
| Empty or fired slot dashed border | plum on darkBrown  | tan on darkBrown                                                                 | 4.04  |
| Trait chip "Food"                 | white on orange    | white on rust                                                                    | 4.99  |
| Stinky status                     | darkGreen on cream | forest on cream                                                                  | 5.39  |

### StartScene

| Usage                               | Was                        | Use                                                  | Ratio       |
| ----------------------------------- | -------------------------- | ---------------------------------------------------- | ----------- |
| Unpicked tile frame on ink          | plum on ink                | slate on ink                                         | 3.27        |
| "Stats" link                        | brown on tan               | plum on tan                                          | 6.49        |
| Price on a locked tile              | darkGreen / darkRed on tan | on a cream chip: forest (affordable) / darkRed (not) | 5.39 / 5.07 |
| "Maple St" sign                     | white on green             | white on forest (the board in `screen-home`)         | 7.80        |
| Owner temperament, owned            | brown on cream             | darkBrown on cream                                   | 5.85        |
| Trait chip "FOOD"                   | white on orange            | white on rust                                        | 4.99        |
| Best amount                         | darkGreen on cream         | forest on cream                                      | 5.39        |
| "+ Slot" and gear price, affordable | white on darkGreen         | white on forest                                      | 7.80        |
| "Walks daily" sign                  | darkBrown on tan           | the `logo` image replaces the board and its text     | n/a         |
| Owner name and "Tap to buy", locked | darkBrown on tan           | plum on tan                                          | 6.49        |

Home screen additions:

| Usage                    | Use              | Ratio |
| ------------------------ | ---------------- | ----- |
| Detail card title        | white on forest  | 7.80  |
| Slot sign line 1         | plum on tan      | 6.49  |
| Slot sign "Save $X more" | darkRed on cream | 5.07  |
| Slot sign "Tap to buy"   | forest on cream  | 5.39  |
| Step label               | plum on tan      | 6.49  |
| Step number              | plum on amber    | 7.35  |

### HelpScene

| Usage                      | Was                        | Use                                                  | Ratio |
| -------------------------- | -------------------------- | ---------------------------------------------------- | ----- |
| Page dots                  | brown on darkBrown         | hollow tan rings                                     | 4.04  |
| Current page dot           | amber vs the other dots    | a filled white dot (filled vs hollow)                | 8.48  |
| Page counter               | tan on darkBrown           | cream on darkBrown                                   | 5.85  |
| Disabled button and "BACK" | slate face, lightGrey text | `ui-button` `disabled`; inactive controls are exempt | n/a   |

### PauseScene

| Usage                    | Was                      | Use                            | Ratio |
| ------------------------ | ------------------------ | ------------------------------ | ----- |
| Panel on the dimmed road | darkBrown on dimmed road | a 1px tan rim around the panel | 3.0+  |
| "Head home" note         | darkBrown on tan         | plum on tan                    | 6.49  |

### EndScene, CardScene, RunScene

| Usage                                    | Was                          | Use                                           | Ratio |
| ---------------------------------------- | ---------------------------- | --------------------------------------------- | ----- |
| Earned amount (EndScene)                 | darkGreen on cream           | forest on cream                               | 5.39  |
| Forced-stop band label (CardScene)       | white on amber               | plum on amber                                 | 7.35  |
| Other band labels (CardScene)            | white on red, sky, darkGreen | white on dred, blue, forest (in `card-frame`) | 7.34+ |
| Card subtitle over the dimmed road       | cream on dimmed Shops        | white                                         | 4.5+  |
| Disabled effect text (CardScene)         | slate on lightGrey           | exempt as inactive                            | n/a   |
| Lucky-find quip over the road (RunScene) | white on the road            | plum in a `ui-quip` bubble                    | 9.42  |

## Asset rules

- **Formats:** Aseprite source files go in `art/`; exported PNG sheets plus Aseprite JSON go in `public/art/` (manifest: `public/art/manifest.json`). The pixel font is a BMFont (XML `.fnt` plus `.png`).
- **Sprites in code:** every asset except the favicons (hand-drawn in `art/favicon-*.aseprite`) is drawn by a script, and the fonts are rasterized from their TTFs by `art/tools/fonts.py` with no `.aseprite`: `art/tools/<set>.py` builds the Aseprite sources in `art/<set>/`, exports to `public/art/sprites/` or `public/art/images/`, and adds the keys to the manifest. Run `python3 art/tools/<set>.py build`, or `preview OUT.png` for a contact sheet, from the repository root. Shared drawing and build code is in `art/tools/pixel.py`. A build overwrites the `.aseprite` files, so change the script, not the sources.
- **Sounds:** `art/tools/sounds.py` synthesizes every sound with sox and encodes it with ffmpeg; there are no sample files. Each ships as `public/art/sounds/<key>.ogg` plus `.m4a`, mono 44.1kHz, effects under 50kB and music under 1MB, listed under `sounds` in the manifest: `python3 art/tools/sounds.py build`, or `preview OUT_DIR` for the files alone. Every sound peaks below −1 dBFS after encoding and starts and ends on silence.
- **Inventory:** every asset the game needs, with its manifest key, size and priority, is listed in `inventory.md`.
- **Naming:** an asset's kebab-case manifest key is also its file name: `art/<set>/<key>.aseprite` exports to `public/art/sprites/<key>.png` and `.json` (sprites), `public/art/images/<key>.png` (images) or `public/art/fonts/<key>.png` and `.fnt` (fonts). Keys use the prefixes `dog-`, `walker-`, `face-dog-`, `face-owner-`, `face-walker-`, `portrait-dog-`, `badge-`, `fx-`, `sfx-`, `music-`, `card-`, `help-`, `item-`, `icon-`, `font-`, `backdrop-`, `road-`, `gag-`, `screen-` and `ui-`; road objects and moving hazards use their plain name (`skunk`, `tip`, `cyclist`), as does `logo`. A depth variant appends `@75` or `@50` (`dog-koda@50`). Animation names are the Aseprite tag names.
- **Consistency checks:** before an asset goes in the game, every pixel of its export is an Endesga 32 colour at full opacity or fully transparent, its frames are the size listed in `inventory.md`, and it follows the proportions and outline rules above. Check it in the gallery at `/art/` on each zone's ground colour.
