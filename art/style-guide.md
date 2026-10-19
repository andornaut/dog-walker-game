# Art Style Guide

## Direction

- Pixel art: simple, cute, a little retro, refined. Mood: casual, cozy, low-stress.
- Chibi: heads about as big as bodies, so a breed reads from head shape, ears and markings at 32×32. Small dogs sit well inside the frame; big dogs fill it. A dog's coat and accessory read on both its road sprite and its face.
- Everything, UI included, is pixel art at the 360×560 base resolution, scaled up with no smoothing.

## Layout and sizes

| Band         | Screen rows | Contents                                                                                                                                                                              |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top bar      | 0 to 39     | `ui-top-bar` wells: money 4,8 88×26, treats 96,8 32×26, zone 212,5 144×29; `ui-icon-button` Home 130,10 and pause 174,10; `ui-strip-well` under the zone well, right aligned at x 356 |
| Backdrop     | 40 to 149   | `backdrop-<zone>`, 360×110                                                                                                                                                            |
| Road         | 150 to 469  | 5 lanes of 56px; at the pack the road spans x 40 to 320, centre x 180                                                                                                                 |
| Doghouse row | 470 to 559  | Three 120×90 `ui-doghouse` slots at x 0, 120 and 240                                                                                                                                  |

| Sprite                                                    | Frame                      |
| --------------------------------------------------------- | -------------------------- |
| Road tiles, dogs, animals, dog and owner faces            | 32×32                      |
| People: walkers, owners, forced-stop and lucky characters | 32×48 (kids drawn shorter) |
| Pickups, small effects, icons                             | 16×16                      |
| Dog portraits                                             | 64×64                      |
| Obstacle n lanes wide                                     | (56n−24)×24                |

A 32px sprite leaves 12px of margin each side of its lane. Obstacles follow the OutRun rule: billboards (a front or rear elevation, never their length along the road), squat, scaled uniformly by 1/Z normalised to 1× at the pack, the base on the scanline of the footprint's near edge, drawn back to front. A footprint longer than one row lives in data, not in the sprite. Sizes: bench and `barrier-2` 88×24, hedge and `barrier-3` 144×24, the parked car 44×28 (1 lane by 3 rows of footprint), the two-lane ice cream truck 88×44 (a rear-view van) and construction 56×32 per lane. Ground decals (puddle 88×32, the skunk cloud 88×40) stay low so they read as lying on the road.

## Palette and outlines

- [Endesga 32](https://lospec.com/palette-list/endesga-32) only, each pixel opaque or fully transparent. Colour names are the `K` names in `art/tools/pixel.py`.
- Darkening (shadows, the dimmed road) maps each colour one step down its ramp (`DARKER`), never a blend with black.
- Outlines are coloured: two ramp steps darker than the fill they border.
- Road sprites use `road_edge`: the outline continues down the ramp until it holds 3:1 against the three light roads (Bark Park, Sniff Street Shops, The Long Way Home), and the fill carries Woof Way. A dark area takes a light rim on its edges facing the top-left light (grey on navy and black, skin2 on dark skin, cyan on sky) so it holds 3:1 on Woof Way. Snooze Crescent (grey) and Paws Promenade (cream) are lighter than The Long Way Home, so `road_edge` outlines hold 3:1 on them unchanged. A white coat on the road is white, not light grey, and its lower-right silhouette steps one ramp colour darker (white to lgrey, lgrey to grey), so it keeps its mass on Sniff Street Shops' light grey.
- Faces (`face-`) and portraits (`portrait-`) take one ink outer line round every fill, white coats included, closed along the bottom row where the frame cuts a bust or a seated dog. Lines inside them (a head over its body) stay two ramp steps darker.
- Character shading is cel: per material a light, a base and a shade, the shade a crescent along the lower-right rim that follows the form (`Grid.cel`), never a diagonal plane or per-pixel texture. Markings such as merle are a few flat patches.
- Effects (`fx-`) take a fixed 1px rim instead: plum, navy for water, teal for green. `fx-bark` keeps a ramp outline, `fx-heart-gain` and `fx-heart-loss` take `ui-fires`' 1px ink line inside a 1px white rim (ink for the light roads, white for Woof Way and the dimmed road), and `fx-dust` (light grey dust) has no rim. Comic words take the sign logo's ink ring and dred shadow. Hazard warnings are outlined in ink.
- Ground decals (puddles) have no outline and no shadow.
- Icons come in two kinds. Chrome glyphs on `ui-icon-button` (`icon-close`, `icon-help`, `icon-home`, `icon-logbook`, `icon-music`, `icon-pause`, `icon-play`, `icon-settings`, `icon-sound`) are two flat tones with no outline. Content icons, such as `icon-gear-*`, `icon-need-*`, `icon-trait-*` and `icon-zone-*`, are outlined with `icon_edge`: two ramp steps darker, then on down the ramp until the outline holds 3:1 on cream and tan. A picture that fills its frame keeps a 1px clear ring for the outline.
- Sprites carry no shadow; the game draws one in the road's darker ramp colour. The bouncing ball carries its own.

## Contrast

- Text holds 4.5:1 against what it sits on (3:1 at 2× and larger); essential icons and marks hold 3:1. Inactive controls are exempt.
- A state never relies on colour alone: it also changes shape (a tick, a hollow heart, a filled pip).
- The leash is a 1px line the game draws from the walker's hand to each collar: pink on Woof Way, dred on Bark Park, Sniff Street Shops and Paws Promenade (5.07:1), plum on Snooze Crescent and The Long Way Home (4.84:1).

### UI colour pairs

Names are `PALETTE` names in `src/scenes/palette.ts`; ratios are WCAG.

| Pair                           | Ratio | Use                                                                                                                      |
| ------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| plum on cream                  | 9.42  | Body text on cream: panels, quips, hints, callouts, the zone banner, `normal` tiles and buttons, the cost on `card-cost` |
| plum on tan                    | 6.49  | Body text on tan                                                                                                         |
| plum on amber                  | 7.35  | Text on amber: forced-stop band, step number                                                                             |
| plum on yellow                 | 10.92 | Text on a selected face (`ui-tile` `selected`)                                                                           |
| darkBrown on cream             | 5.85  | Secondary text, empty heart outline                                                                                      |
| forest on cream                | 5.39  | Money gained, affordable prices, `ui-payout-label`                                                                       |
| darkRed on cream               | 5.07  | Money lost, unaffordable prices, full heart, ♥ in help callouts                                                          |
| cream on darkBrown             | 5.85  | Text on the column or wood                                                                                               |
| amber on darkBrown             | 4.57  | Warnings, "You're fired!"                                                                                                |
| yellow on darkBrown            | 6.79  | Floating gain on the column                                                                                              |
| white on darkBrown             | 8.48  | Floating loss on the column, filled page dot                                                                             |
| tan on darkBrown               | 4.04  | Empty slot dashed border, hollow page dots                                                                               |
| white on forest                | 7.80  | Labels on chips                                                                                                          |
| ink on green                   | 8.41  | `ui-button` `go` label                                                                                                   |
| white on rust                  | 4.99  | Trait chip "Food"                                                                                                        |
| white on darkRed, blue, purple | 7.34+ | Card bands, `ui-hit-label`, `ui-fired-plate`, the FIRED plate on the empty `ui-doghouse`                                 |
| white on navy                  | 13.89 | `ui-detail-band` title                                                                                                   |
| ink on yellow                  | 14.43 | `ui-sticker` `new`                                                                                                       |
| ink on cyan                    | 11.98 | `ui-sticker` `price`                                                                                                     |
| navy on grey                   | 4.93  | Price on a `disabled` tile                                                                                               |
| navy on lightGrey              | 8.48  | The cost on a disabled card's `card-cost`                                                                                |
| darkSlate on grey              | 3.39  | Labels on `disabled` tiles and buttons (inactive, exempt)                                                                |
| grey on darkBrown              | 3.01  | `disabled` tile face on the wood                                                                                         |
| amber on navy                  | 7.49  | `icon-pause`, `icon-play` on `ui-icon-button`                                                                            |
| `ui-zone-pips` on ink          | 3.0+  | `todo` dashed; `<zone>` rimmed; `<zone>-done` ticked                                                                     |
| `ui-difficulty` on cream       | 9.42  | Filled paws plum-outlined; hollow paws a faint tan rim                                                                   |
| white over the dimmed road     | 4.5+  | Card subtitle                                                                                                            |
| tan on the dimmed road         | 3.0+  | 1px rim around the pause panel                                                                                           |

## UI

- One chrome for every panel, bubble, plate, tile and card frame: a cream face in a 1px ink outer line and a 1px plum inner line, with a tan lip along its bottom and right (`chrome` in `art/tools/ui.py`). Corners are cut 1px (panels, cards), 2px (hints, detail cards) or 3px (quips). A coloured plate (`ui-hit-label`, `ui-fired-plate`) puts its face 4px in, inside a 2px cream band. Tails are cream in an ink line, laid over their bubble's ink row. No plain white boxes.
- Wood is background only: full-screen backgrounds (dbrown with plum seams), the top bar and the doghouses. Navy bands (`ui-section`, `ui-detail-band`) head sections and cards; the zone banner's ribbon ends are navy.
- `ui-section` frames each start screen section: `incomplete` (ink frame, navy band, cream heading, amber prompt), `complete` (amber border and band, ink text), `neutral` (as incomplete, no prompt) for optional gear with nothing equipped. The yard sign logo is flat yellow letters with an ink outline and a solid dred shadow (yellow on darkBrown 6.79:1). Home, pause, help and sound sit on `ui-icon-button`.
- `ui-sticker` (56×28) is a starburst in an ink outline: `new` (yellow body, amber spikes) on a dog or gear tile that just became affordable, `price` (cyan body, sky spikes) for the next locked item's price, `pop` (4 frames, 70ms, ending on the `new` look) for a badge-earned moment. At most one sticker per screen (`new` wins over `price`), never on the run screen's road or over a choice card. On a tile, its right edge sits 2px right of the tile's (kept 2px inside the screen) and its bottom 4px below the tile's, over the price line, which the tile then leaves out. The word is in `font-title` at 1×, ink, centred on x 28 with its caps in rows 12 to 16, up to 36px wide: "NEW!" or the price as the game formats it. Write the word after `pop` ends; with reduced motion show the last frame.
- Fonts: `font-body` (Tiny5, mixed case) for body text, quips and floating labels; `font-title` (Silkscreen, capitals) for titles, numbers and buttons. Floating numbers use the font, not sprites.
- Display lettering: the yard sign logo's letters (yellow fill, 1px ink outline, solid dred shadow) for big words only, never body text: zone names on `ui-zone-banner`, "WHICH WAY?", "FIRED!", "NEW BEST!", the end screen title and hit labels, in `font-display` (yellow) or `font-display-cream` (cream), 10px capitals with the colours baked in, drawn untinted. In-art signs (shop boards, `ui-pet-shop`'s PET SHOP board, the park gate, the lemonade stand) use the same letters and outline at 1x with a 1px shadow.
- `ui-pet-shop` (120×104) stands on the gate scene's right lot at 234,90, its step on the yard's bottom row (193); its hit area is its frame. `pressed` dips as `ui-button` does: the front sinks 2px onto a step 1px shallower. When something in the shop is affordable, `ui-afford` goes 2px outside it (232,88 124×108), as on a tile. The street sign's plate (300,72 54×11) holds the street name in `font-body` at 1×, white, centred at 327,75: "Woof Way" is 32px wide, "WOOF WAY" 39px, inside the 52px face.

### Interaction states

Every tile, button, card, tab and switch row is in one of four states, drawn the same way everywhere. `ui-tile` (insets 4) draws the first three for walker, dog and gear tiles; `ui-button` (insets 3, 3, 3, 5) draws all four.

| State    | When                                                                                  | Look                                                                                       | Label                                                |
| -------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| normal   | Available, not chosen; a locked item the bank covers, with `ui-afford` 2px outside it | Cream face, ink and plum lines, tan lip (`ui-tile` `normal`, `ui-button` `normal`)         | plum (9.42:1)                                        |
| selected | Picked, equipped, toggled on, the open tab or page                                    | Gold: ink line, amber band, orange line, yellow face (`ui-tile` `selected`)                | plum (10.92:1)                                       |
| disabled | Cannot be chosen: locked and not affordable, the pack full, not available             | Flat grey face, ink and slate lines, no lip (`ui-tile` `disabled`, `ui-button` `disabled`) | darkSlate (3.39:1, exempt); a price in navy (4.93:1) |
| primary  | The one call to action on a screen: Start walk, Resume, Got it, Nice!                 | Raised green face on a forest lip (`ui-button` `go`)                                       | ink (8.41:1)                                         |

- Art inside a disabled tile (faces, icons, the padlock) draws from its grey copy (`greyTextureKey`, as a disabled card) one ramp step darker (`remapDarker`), on a slate box; a normal tile's box is tan, a selected one's amber.
- A disabled primary (Start walk before a walker and a dog are picked) is `go-disabled`, which matches `disabled`.
- `secondary` and `secondary-pressed` match `normal` and `pressed`: every button that is not the screen's primary is `normal`.
- Cards follow the same states: a disabled card is redrawn in the grey ramp, the selected one is outlined in amber. A switch row's state is its switch; the row itself is normal or disabled.

### Feedback and selected state

- A press shows at once, before any selected state: the item dips 2px (a button into its lip) and `fx-tap` bursts under the finger.
- Anything picked, equipped, toggled on or active shows three cues: the selected state's gold frame and yellow face (`ui-tile` `selected` on tiles; on other controls a yellow face inside `ui-select`), a 2px lift onto a plum shadow, and a `ui-check` badge (pick order or tick) at its top-left.
- When a multi-pick choice is full (the pack), the unselected items are disabled. A single-pick choice (gear) keeps the others normal, since tapping one swaps it in.
- A picked item's face hops; a picked dog hops onto the gate path in `fx-dust`.
- An affordable item takes `ui-afford` 2px outside it, unless selected.
- An unaffordable locked item shakes when tapped. The ready Start walk button bobs.
- With reduced motion, highlights stay and movement is skipped.

### Icon buttons and settings

| Control      | Scene                | Button | Hit area     |
| ------------ | -------------------- | ------ | ------------ |
| Help         | Home gate, top left  | 8,46   | 0,40 44×44   |
| Home         | Run top bar          | 130,10 | 118,0 44×44  |
| Pause        | Run top bar          | 174,10 | 162,0 44×44  |
| Sound toggle | Home gate, top right | 332,46 | 316,40 44×44 |

- The run top bar has no sound button: mute is the Settings "Sound" row and the M key.

- `icon-sound`: `on` is a speaker with two waves, `off` the same speaker with a pink X.
- Settings: a "Sound" row with a right-aligned `ui-switch` above the Music and Effects sliders. Each row is one tap target at least 44 tall, led by its `-panel` icon (`off` adds a dred X).
- Sliders: for a track of width w at x and value v, draw `empty` across w, `filled` from x to the knob's right edge, and `ui-slider-knob` at x + round((w − 10) × v / 100), 3px above the track. Muted, both switch to their `-disabled` tags.

## Run screen

### Doghouse slots

`ui-doghouse` (120×90, a 1px gap down each side) has a roof (rows 0 to 20) in the dog's signature colour and an 8×8 emblem of its accessory in a 12×12 vent at the left gable, so houses differ by shape as well as colour. The game draws, in slot pixels:

| Element           | Position                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| Dog's name        | Centred at (60,6) in `font-title` on the cream name plate (x 20 to 99, rows 4 to 15)                  |
| Dog's face        | (6,24), in the door                                                                                   |
| Owner's face      | (42,24), in the window                                                                                |
| Hearts            | From (78,26), rows of five, 8px across and 8px down, on the hearts board (x 77 to 117, rows 23 to 53) |
| "n/max" count     | Centred at (98,46) in `font-title` on the hearts board                                                |
| Status icons      | 16×16 at (78,62) and (98,62), under pegs                                                              |
| Owner's name      | (6,62) in `font-body` on the cream name strip (x 4 to 75, rows 60 to 70)                              |
| FIRED (fired dog) | Centred at (60,74) on the white plate of the grey `empty` house                                       |

At 1 ♥, `ui-doghouse-warn` pulses over the house (`static` with reduced motion).

On a heart loss the game draws `ui-doghouse` `heart-loss` (4 frames: 60, 60, 80 and 80ms) over the house and under its faces, hearts and text: two red flashes of the walls and roof that leave the panels clear, then a 2px and a 1px red rim. It shakes the whole slot 1px right, left, right, then back, one offset per frame. With reduced motion it plays the flash without the shake.

### Choice cards

- Band colour by card type: dred encounter, amber forced stop, blue lucky, forest upgrade.
- Illustrations are road sprites at 1× on a scrap of the zone's ground, with no walker: a leash runs off the bottom edge.
- A disabled card is greyed with the grey ramp; the selected one is outlined in amber.

### Hits, moments and statuses

| Event                      | Shows                                                                                                                                                                                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 ♥                        | Owner's `worried` face and `ui-doghouse-warn`                                                                                                                                                                                                                                           |
| Any hit                    | `fx-bump` at the contact point; walker `stumble`, dogs `react`                                                                                                                                                                                                                          |
| Area effect, nobody caught | `fx-close-one` `splash-word` (puddle) or `puff-word` (skunk) at the pack under the "Close one!" label                                                                                                                                                                                   |
| Encounter hit              | `fx-hit-<encounter>` over the pack; `ui-hit-flash-<colour>` at the edges (café patio amber, goose white, other dog pink, petunias pink, picnic orange, puddle sky, skunk mauve, squirrel orange, thief amber, trash bins green); the label at 2× on `ui-hit-label`; caught dogs `shake` |
| Fee payout                 | `fx-coin-fly` to the bank under `ui-payout-label`                                                                                                                                                                                                                                       |
| Firing                     | Owner's `fired` face at 2× over the doghouse on `fx-fired-pop` at 2× (an amber starburst behind a cream POOF cloud, and a front door slamming shut beside the face); the fired line in `ui-quip`; `ui-fired-plate` (blue laid-back, purple fussy, dred dramatic)                        |
| Heart change               | `fx-heart-loss` or `fx-heart-gain` `pop` over the dog beside the "−1" or "+1" label, then `fly` tweened into its doghouse's heart labels band; on a loss the house plays `ui-doghouse` `heart-loss` while the slot shakes                                                               |
| Minor bump                 | `fx-coin-burst` at the pack under the "−$2" label; `fx-dizzy` over the walker while lane input is locked                                                                                                                                                                                |
| Moving hazard              | `ui-warning` and `ui-warning-arrow` at the lane edge about 1s ahead                                                                                                                                                                                                                     |
| Puddle, pickup             | `fx-splash`, `fx-sparkle`                                                                                                                                                                                                                                                               |
| Treat given                | `fx-treat-pop` and the owner's `happy` face                                                                                                                                                                                                                                             |

- `fx-status-<status>` loops over the dog's head, 6px below its top opaque row. Stinky shows per dog. Two statuses alternate every second, most recent first.
- With reduced motion, bursts and stars play and the stumble is skipped.

#### Comic words

One word per moment, built like the sign logo: flat yellow letters 7 rows tall with 2px stems, a 1px ink ring that also fills the counters and the gaps between letters, and a solid dred shadow 2px down and right. Display words only, 2 to 7 letters, readable at 1×.

| Effect             | Word     | Where it is                                                |
| ------------------ | -------- | ---------------------------------------------------------- |
| `fx-bark-word`     | WOOF!    | Its own 32×16 key, `pop` (4 frames, 60, 60, 140 and 140ms) |
| `fx-close-one`     | PHEW!    | `splash-word` and `puff-word`, over frames 0 to 3          |
| `fx-hit-cafe`      | SPLAT!   | `play-word`                                                |
| `fx-hit-goose`     | HONK!    | `play-word`                                                |
| `fx-hit-other-dog` | SNIFF!   | `play-word`                                                |
| `fx-hit-petunias`  | SQUISH!  | `play-word`                                                |
| `fx-hit-picnic`    | CHOMP!   | `play-word`                                                |
| `fx-hit-puddle`    | SPLOSH!  | `play-word`                                                |
| `fx-hit-skunk`     | PEE-YEW! | `play-word`                                                |
| `fx-hit-squirrel`  | CHITTER! | `play-word`                                                |
| `fx-hit-thief`     | YOINK!   | `play-word`                                                |
| `fx-hit-trash`     | CLANG!   | `play-word`                                                |

- `play-word` follows `play` on every `fx-hit-*`: the same frames and timing, with the word centred on the impact star on frames 0 to 5 (420ms).
- The game plays `play-word`, `fx-bark-word`, `splash-word` and `puff-word`. With reduced motion it shows `play` (held on frame 0), `fx-bark`, `splash` and `puff`, so no word shows.
- `fx-bark-word` plays at `fx-bark`'s point in place of it, over the dog's head as the tell starts.

- Crossers are side views facing right, mirrored for left. Anything coming down a lane faces the player.

## Badges

`badge-<achievement>` medals are 32×32: a ring in the badge's tier colour around a cream face with the goal's icon. `locked` turns the whole badge grey, the icon a two-tone slate silhouette under a small padlock. The tiers, from first to hardest, then the joke tier:

| Tier       | Ring   | Badges                                                               |
| ---------- | ------ | -------------------------------------------------------------------- |
| Firsts     | Bronze | `double-leash`, `first-steps`, `pack-leader`, `round-trip`           |
| Mastery    | Silver | `big-payday`, `clean-paws`, `five-star-service`, `not-a-scratch`     |
| Collection | Gold   | `full-kennel`, `kitted-out`, `neighbourhood-favourite`, `top-walker` |
| Silly      | Pink   | `eau-de-skunk`, `squirrel`, `youre-fired`                            |

- Silly is the joke tier: badges earned by mishaps (firings, skunk spray, squirrel chases). Pink marks a joke, never a rank, so it never joins the metal tiers.
- Every ring is built the same way: a base, a shade on its lower right, a light on its upper left and twelve rivets in the shade. Pink's are pink, mauve and white.

## Animation

- Animation names are Aseprite tag names. New tags go after existing ones so frame indices hold. Motion is in whole pixels.
- Walkers are seen from behind: `walk` 4, `react` 2, `stumble` 4 and `idle` 2 frames. No gear variants.
- Dogs are seen from above and behind. `walk` is a trot: diagonal leg pairs swap, the body bobs on the passing frames, the tail wags. `pull` leans right and is mirrored for left. `shake` runs at 60ms.
- Every road sprite that stands or waits, depth variants included, loops an `idle` with frame 0 the rest pose. Reduced motion shows frame 0.

| Idle      | Frames | Timing       | Motion                                                                              |
| --------- | ------ | ------------ | ----------------------------------------------------------------------------------- |
| Dogs      | 4      | 300ms        | Tail at −1, 0, +1, 0; the right ear 1px higher on the last frame                    |
| Obstacles | 2 to 4 | 350 to 500ms | A small event (glint, lid, drip, leaves, hazard lights); rest pose most of the loop |
| People    | 2      | 400ms        | Breathing: the body 1px higher on frame 2, feet planted, arms at rest               |

## Depth scaling

Sprites scale by depth in steps of 1×, 0.75× and 0.5×, nearest-neighbour. A sprite whose 1px outline, legs or motion breaks at a step gets a redrawn `<key>@75` or `<key>@50`: round(size × scale), the original's tags, frames and durations, a full 1px outline, and 1px motion kept at 1px. Sprites whose features are all 2px or wider scale at runtime.

## Road strips

- 280×64, tiling vertically with no seam: patterns repeat every 64 rows or a divisor of it.
- The base is the zone's road colour (`src/data/world.ts`), so the game's shadow, one ramp step down, matches. Base (shadow): Snooze Crescent grey (slate), Bark Park tan (brown), Woof Way dslate (navy), Sniff Street Shops lgrey (grey), Paws Promenade cream (tan), The Long Way Home skin2 (brown).
- The four lane dividers sit at x = 56k−1, 2px wide, one look per zone. Lane marks are faded white with a slate edge on Snooze Crescent; dbrown on Bark Park; dbrown dashes 20 rows long in 32 on Paws Promenade; white outlined in plum on The Long Way Home.
- Curbs and verges stay inside the outer 3 to 7px, clear of the 12px sprite margin.
- Every zone has a start strip: a neutral cross street (near kerb, asphalt with a zebra, far kerb) on rows 20 to 63 and the zone's strip on rows 0 to 19, so it follows any zone at a fork.
- The camera has its horizon at y −164 and the walker's feet at y 464; the road's far edge meets the backdrop at y 150 at scale 0.5. Its ratio r derives from speed (the visible distance is 5.25 s × `roadScrollSpeed`, so r is 0.797 at 150 px/s). The rows from the far edge down to about y 180 sample the strip shrunk 4×, so: lane dashes and texture along the road repeat every 8 rows or more; lines across the road are at least 2 rows tall and low in contrast; fine detail runs along the road; small texture is spaced irregularly.

## Backdrops

Backdrops are 360×110 on screen rows 40 to 149; band row y is screen row 40 + y. The street ends at a T-junction. Rows 86 to 109 continue the road's projection at its slope (at row 109 the road spans columns 110 to 249, lane dividers on 138, 166, 193 and 221). Above them a flat cross street: far sidewalk 66 to 69, far curb 70 to 71, road 72 to 80 with its centre line on 76, near sidewalk 81 to 85. The far side faces the camera on ground row 62.

Where row 149 meets the road, left side (the right mirrors it):

| Zone               | Edge               | Curb     | Road from  |
| ------------------ | ------------------ | -------- | ---------- |
| Snooze Crescent    | Sidewalk 86 to 107 | 108..109 | 110        |
| Bark Park          | Grass to 109       | none     | 110 (path) |
| Woof Way           | Sidewalk 86 to 107 | 108..111 | 112        |
| Sniff Street Shops | Paving to 107      | 108..111 | 112        |
| Paws Promenade     | Paving 86 to 109   | none     | 110        |
| The Long Way Home  | Sidewalk 86 to 107 | 108..109 | 110        |

Gag spots, kept clear (`python3 art/tools/backdrops.py gags` prints them): the near-left perch's top rail (rows 93 to 95, x 0 to 82), the near-right lawn (x 274 to 359, rows 86 to 109), and both sidewalks.

## Skies

- Daytime skies (Bark Park, Paws Promenade, Sniff Street Shops, Woof Way) stay cyan over sky with clouds.
- Sunset and night skies are hard-edged horizontal bands of flat colour (`bands` in `art/tools/backdrops.py`), each 0.7 times the height of the band above it, so they shrink toward the horizon. Above each seam the lower band's colour runs a 1-row line 2 rows up, and another 5 rows up on a band 12 rows or taller. No gradients, no dither.
- The sun is a flat yellow disc (`sun`) whose visible lower half is cut by horizontal gaps that widen toward the horizon as the bars between them thin; the bands show through the gaps. It sits over the orange band, so the gaps hold against the yellow.
- Bands, top to horizon:

| Sky                    | Bands                       | Extras                 | Where                                                                     |
| ---------------------- | --------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| The Long Way Home      | pink, orange, amber, yellow | Striped sun            | `backdrop-the-long-way-home`, `card-zone-the-long-way-home`, `screen-end` |
| Snooze Crescent (dusk) | purple, mauve, pink, skin1  | Crescent moon, stars   | `backdrop-snooze-crescent`, `card-zone-snooze-crescent`                   |
| Woof Way at night      | navy, purple, mauve         | Stars in the navy band | `screen-loading`, the window of `screen-stats`                            |

- A zone card's sky repeats its backdrop's bands and sun. Scenery standing against a band never shares its colour: The Long Way Home's backdrop trees are rust and dbrown against the orange band.
- Bands belong to skies only: never on sprites, UI or the road.

## Sound

- Soft chiptune: square and triangle waves through gentle low-pass filters, short envelopes, nothing harsh.
- Hits and pickups under about 0.6s; `sfx-fired`, `sfx-badge` and `sfx-new-best` up to 2s; the walk loop at about 100 BPM.
- Files: effects under 50kB, music under 1MB, peaks below −1 dBFS after encoding, silence at both ends.
