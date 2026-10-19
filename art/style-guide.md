# Art Style Guide

## Direction

- **Pixel art: simple, cute, a little retro, but refined.** Write down every choice that keeps assets looking like one game.
- **Mood:** casual, cozy, low-stress.
- **Camera:** ¾ top-down.
- **Orientation:** portrait.
- **Choice cards:** art-led, an illustration plus a one-line effect. A card is 83×140: a coloured title band (dred for encounters, blue for lucky encounters, amber for forced stops, forest for upgrades), a 75×56 illustration in a recessed window, the effect text below it, and a dark cost badge at the bottom. The enlarged card is 166×280, the same layout at 2× with 1px detail. Illustrations are composed from the road sprites at 1× on a scrap of the zone's ground.
- **Dog slots:** each slot in the dog column is a doghouse roofed in the dog's signature colour (its bow, bandana, collar, sweater or harness). The dog peeks out of the door, its owner sits in the window, and the hearts hang on a board below with a count beside them ("4/8"), so happiness never relies on colour alone. A fired dog's house turns grey and empty.
- **Base render resolution:** 360×640, scaled up crisply with no smoothing.
- **Run screen layout:** top to bottom, a 360×40 status bar (money, zone progress); a 360×150 neighbourhood backdrop for the current zone, where the scenery gags live; then a fixed-width 80×450 dog column on the left with 3 slots (a fired dog's slot empties and the road never changes width) beside the 280×450 road. On an encounter the road pauses and dims, and the cards cover the road while the bar, backdrop and dog column stay visible.
- **Sizes:** 32×32 for road tiles, dogs and obstacles; lanes are 56px wide, leaving ~12px of margin. An obstacle n lanes wide and m rows long is 56n−24 by 56m−24. People (walkers, owners, forced-stop and lucky-encounter characters) are 32×48, so they stand taller than the dogs. Pickups and small effects are 16×16. Dog and owner faces in the dog column are 32×32.
- **Palette:** [Endesga 32](https://lospec.com/palette-list/endesga-32), and no other colours. Every pixel of every asset is one of its 32 colours. Darkening (shadows, the dimmed road behind cards) maps each colour to the next darker colour in its ramp rather than blending with black, so the screen stays on the palette.
- **Outlines:** coloured. A sprite's outline is two ramp steps darker than the fill it borders, so dark sprites (the skunk) keep their silhouette. Ground decals such as puddles have no outline.
- **UI colours:** wood. A dark brown frame (`#3e2731`, `#733e39`) with cream paper slots (`#ead4aa`) and tan face panels (`#e4a672`). Text and icon colours on them follow the UI colour pairs below.
- **Proportions:** chibi. Heads are about as big as bodies, so a breed reads from its head shape, ears and markings at 32×32.
- **Walkers:** each seen from behind with a 4-frame `walk`, a 2-frame `react` and a 4-frame `stumble`, plus a front-view portrait for the picker. Kids are drawn shorter than adults inside the same 32×48 frame. Walker sprites have no gear variants.
- **Leash:** a 1px line drawn in code from the walker's hand to each collar; there is no leash sprite. Its colour is set per zone to hold 3:1 against the road: `#f6757a` (pink) on Woof Way, `#a22633` (dred) on Bark Park and Sniff Street Shops, `#3e2731` (plum) on The Long Way Home.
- **Dog animation:** road sprites are seen from above and behind. `walk` is a 4-frame trot (diagonal leg pairs swap, the body bobs on the passing frames, the tail wags), `react` is a 2-frame hop, `pull` is 2 frames leaning right, which the game mirrors for a pull to the left, and `tell` is the 2-frame lean shown, with the `fx-bark` pop, before a pull. Sprites carry no shadow; the game draws one in the road's darker ramp colour.
- **UI art:** all UI (card frames, panels, status bar) is pixel art at the base resolution, with a pixel font.
- **Feedback:** every tap is visible. A pressed tile or button dips 2px (a button sinks into its lip) and a sparkle (`fx-tap`) bursts where the finger lands. A picked dog or gear item lifts 2px onto a shadow, turns white, takes a pulsing amber frame (`ui-select`) and a green badge with its pick order (`ui-check`), and its face hops; the dog also hops onto the gate path in a puff of dust (`fx-dust`). A locked item the player can't afford shakes. The ready Start walk button bobs. With reduced motion, the highlights stay and the movement is skipped.
- **Sound toggle:** a mute-all control in the run top bar beside pause (button at 146,10, hit area 124,0 44×44; pause's hit area 168,0 44×44) and in the home gate scene's top right opposite help (button at 332,46, hit area 316,40 44×44; help at 8,46, hit area 0,40 44×44). It is a `ui-icon-button` carrying `icon-sound`: a speaker with two waves when sound is on, the same speaker with a pink X when muted, so the state reads by shape. In Settings, a "Sound" row above the music and effects sliders carries `ui-switch`, right-aligned; the whole row is the tap target, at least 44 tall. Pause and help use the same `ui-icon-button`.
- **Dog portraits:** 64×64 for the dog pick and the shop. The dog sits in a three-quarter front view turned toward the top-left light, head and shoulders with its front paws at the bottom edge, in the same coat and accessory as its face.
- **Screen backgrounds:** full-screen backgrounds keep the areas where UI sits in low-contrast dark wood (dbrown with plum seams), so cream and tan UI text reads on them; scenery goes where no panel sits.
- **Contrast:** text holds 4.5:1 against what it sits on (3:1 at 2× and larger) and essential icons and marks 3:1. A state never relies on colour alone: it also changes shape (a tick, a hollow heart, a filled pip). Inactive controls are exempt. Lane marks are dbrown on Bark Park and white outlined in plum on The Long Way Home.
- **Sound:** soft chiptune to match the pixel art: square and triangle waves through gentle low-pass filters, short envelopes, nothing harsh. Effects stay under half a second except `sfx-fired`; one music loop for the walk at about 100 BPM.
- **Road strips:** 280×64 images that tile vertically with no seam (patterns repeat every 64 rows or a divisor of it). The base is the zone's road colour, so the game's shadow (one ramp step darker) still matches. The four lane dividers sit at x = 56k−1, 2px wide, one look per zone. Curbs and verges stay inside the outer 3 to 7px so they clear the 12px sprite margin. A transition strip has the previous zone in its bottom rows and the new zone in its top rows, joined by a crossing. Under the pseudo-3D projection each screen row shows one strip row, up to 4 rows apart near the backdrop, and the road moves 2 rows per frame, so patterns that repeat along the road have a period of at least 8 rows, lines across the road are at least 2 rows tall and low in contrast, fine detail runs along the road, and small texture is spaced irregularly.
- **Collisions:** every hit shows an impact burst (`fx-bump`) where the pack meets the obstacle and the walker plays `stumble` while the dogs play `react`. A minor bump also knocks two coins loose (`fx-coins`) under the cause label, and dizzy stars (`fx-dizzy`) circle over the walker for as long as lane input is locked. A puddle throws up a splash (`fx-splash`); a skunk leaves stink lines (`fx-stinky`) over the pack while Stinky lasts. A pickup twinkles (`fx-sparkle`). A ♥ change at a dog slot floats a heart up (`fx-heart` `up`) or cracks one and drops the halves (`fx-heart` `down`) beside the floating label. With reduced motion, the bursts and stars play but the stumble is skipped.
- **Fonts:** two 8px pixel fonts, both under the SIL Open Font License (files and licenses in `art/fonts/`). `font-body` is Tiny5, mixed case, for body text, quips and floating labels. `font-title` is Silkscreen, capitals, for titles, numbers and buttons. Glyphs are white so the game tints them; ♥ is a drawn 7×6 heart.

## UI colour pairs

The colours scene code uses for text and marks on the wood UI. Names are the code's `PALETTE` names; forest (`#265c42`), rust (`#be4a2f`) and yellow (`#fee761`) are Endesga 32 colours the code palette does not list yet. Ratios are WCAG contrast.

### General rules

| Usage                                      | Colour on background   | Ratio       |
| ------------------------------------------ | ---------------------- | ----------- |
| Body text on cream                         | plum on cream          | 9.42        |
| Body text on tan                           | plum on tan            | 6.49        |
| Secondary text on cream                    | darkBrown on cream     | 5.85        |
| Text on the dark brown column or wood      | cream on darkBrown     | 5.85        |
| Warning text on the dark brown column      | amber on darkBrown     | 4.57        |
| Money gained or affordable price, on cream | forest on cream        | 5.39        |
| Money lost or unaffordable price, on cream | darkRed on cream       | 5.07        |
| White labels on a coloured chip or button  | white on forest / rust | 7.80 / 4.99 |

### HudScene

| Usage                             | Was                | Use                                                         | Ratio |
| --------------------------------- | ------------------ | ----------------------------------------------------------- | ----- |
| Pause button on the bar           | navy on plum       | `icon-pause` (amber) on `ui-top-bar`                        | 7.35  |
| Zone pips, done vs to do          | green vs brown     | `ui-zone-pips`: `done` is ticked, `todo` an empty dark well | 6.37  |
| Current pip                       | amber vs brown     | amber fill in the `current` pip's ink well                  | 7.35  |
| Full heart on cream               | red on cream       | darkRed on cream                                            | 5.07  |
| Empty heart on cream              | tan on cream       | a hollow heart outlined in darkBrown                        | 5.85  |
| Full vs empty heart               | red vs tan         | told apart by fill (full vs hollow), not colour             | n/a   |
| Floating gain on a cream slot     | green on cream     | forest on cream                                             | 5.39  |
| Floating loss on a cream slot     | red on cream       | darkRed on cream                                            | 5.07  |
| Floating gain on the column       | green on darkBrown | yellow on darkBrown                                         | 6.79  |
| Floating loss on the column       | red on darkBrown   | white on darkBrown (the − sign and ♥ carry the meaning)     | 8.48  |
| "You're fired!"                   | red on darkBrown   | amber on darkBrown                                          | 4.57  |
| "Empty" label, fired owner name   | plum on darkBrown  | cream on darkBrown                                          | 5.85  |
| Empty or fired slot dashed border | plum on darkBrown  | tan on darkBrown                                            | 4.04  |
| Trait chip "Food"                 | white on orange    | white on rust                                               | 4.99  |
| Stinky status                     | darkGreen on cream | forest on cream                                             | 5.39  |

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

## Open decisions

- **Animation budget beyond the walk:** idle animations, and frame counts for people and obstacles

## Asset rules

- **Formats:** Aseprite source files go in `art/`; exported PNG sheets plus Aseprite JSON go in `public/art/` (manifest: `public/art/manifest.json`). The pixel font is a BMFont (XML `.fnt` plus `.png`).
- **Sprites in code:** every asset is drawn by a script: `art/tools/<set>.py` builds the Aseprite sources in `art/<set>/`, exports to `public/art/sprites/` or `public/art/images/`, and adds the keys to the manifest. Run `python3 art/tools/<set>.py build`, or `preview OUT.png` for a contact sheet, from the repository root. Shared drawing and build code is in `art/tools/pixel.py`. A build overwrites the `.aseprite` files, so change the script, not the sources.
- **Sounds:** `art/tools/sounds.py` synthesizes every sound with sox and encodes it with ffmpeg; there are no sample files. Each ships as `public/art/sounds/<key>.ogg` plus `.m4a`, mono 44.1kHz, effects under 50kB and music under 1MB, listed under `sounds` in the manifest: `python3 art/tools/sounds.py build`, or `preview OUT_DIR` for the files alone. Every sound peaks below −1 dBFS after encoding and starts and ends on silence.
- **Inventory:** every asset the game needs, with its manifest key, size and priority, is listed in `inventory.md`.
- **Naming:** an asset's kebab-case manifest key is also its file name: `art/<set>/<key>.aseprite` exports to `public/art/sprites/<key>.png` and `.json` (sprites), `public/art/images/<key>.png` (images) or `public/art/fonts/<key>.png` and `.fnt` (fonts). Keys use the prefixes `dog-`, `walker-`, `face-dog-`, `face-owner-`, `face-walker-`, `portrait-dog-`, `badge-`, `fx-`, `sfx-`, `music-`, `card-`, `help-`, `item-`, `icon-`, `font-`, `backdrop-`, `road-`, `screen-` and `ui-`; road objects use their plain name (`skunk`, `tip`). Animation names are the Aseprite tag names.
- **Consistency checks:** before an asset goes in the game, every pixel of its export is an Endesga 32 colour at full opacity or fully transparent, its frames are the size listed in `inventory.md`, and it follows the proportions and outline rules above. Check it in the gallery at `/art/` on each zone's ground colour.
