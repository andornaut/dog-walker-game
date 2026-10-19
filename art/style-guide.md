# Art Style Guide

## Direction

- Pixel art: simple, cute, a little retro, refined. Mood: casual, cozy, low-stress.
- Chibi: heads about as big as bodies, so a breed reads from head shape, ears and markings on its 40×40 road sprite and 32×32 face. Small dogs sit well inside the frame; big dogs fill it. A dog's coat and accessory read on both its road sprite and its face.
- Everything, UI included, is pixel art at the 360×560 base resolution, scaled up with no smoothing.

## Layout and sizes

| Band         | Screen rows | Contents                                                                                                                                                                              |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top bar      | 0 to 39     | `ui-top-bar` wells: money 4,8 88×26, treats 96,8 32×26, zone 212,5 144×29; `ui-icon-button` Home 130,10 and pause 174,10; `ui-strip-well` under the zone well, right aligned at x 356 |
| Backdrop     | 40 to 149   | `backdrop-<zone>`, 360×110                                                                                                                                                            |
| Road         | 150 to 469  | 5 lanes of 64px; at the pack the road spans x 20 to 340, centre x 180                                                                                                                 |
| Doghouse row | 466 to 559  | `ui-dog-band` (360×94) at 0,466; three 120×90 `ui-doghouse` slots at x 0, 120 and 240, rows 470 to 559                                                                                |

| Sprite                                                                                                   | Frame                      |
| -------------------------------------------------------------------------------------------------------- | -------------------------- |
| Dog and owner faces                                                                                      | 32×32                      |
| Road animals: dogs, the other dog, skunk, squirrel, goose, `loose-dog` and `squirrel-dash`               | 40×40                      |
| Road people: walkers, forced-stop and lucky characters, the thief, the other dog's owner and the cyclist | 40×60 (kids drawn shorter) |
| Owners                                                                                                   | 32×48                      |
| Pickups                                                                                                  | 20×20                      |
| Small effects, icons                                                                                     | 16×16                      |
| Dog portraits                                                                                            | 64×64                      |
| Obstacle n lanes wide                                                                                    | (64n−24)×30                |

Dogs, people, animals, pickups, movers and encounters are drawn on a 32-unit design grid and rasterized at 1.25× (their depth variants at 1.25× the step): every shape scales, while 1px lines and single pixels stay 1px, and feet keep to the frame's bottom rows. The minor obstacles, the ice cream truck and the construction barrier are drawn in their own pixels. A 40px sprite leaves 12px of margin each side of its 64px lane. Obstacles follow the OutRun rule: billboards (a front or rear elevation, never their length along the road), squat, scaled uniformly by 1/Z normalised to 1× at the pack, the base on the scanline of the footprint's near edge, drawn back to front. A footprint longer than one row lives in data, not in the sprite. Sizes: bench and `barrier-2` 104×30, hedge and `barrier-3` 168×30, the parked car 56×35 (1 lane by 3 rows of footprint, centred with 4px to spare each side of its 64px lane), the two-lane encounters 104 wide (picnic, petunias and trash bins 104×40, the café patio 104×50), the goose, cone, bin, hydrant and water bowl 40×40, the lemonade stand and the need spots' tree, lamp post and stranger 40×60, the cyclist 40×60 and the bouncing ball 20×30, the two-lane ice cream truck 104×55 (a rear-view van) and construction 64×40, one whole lane, repeated across the road. Ground decals (puddle 104×40, the skunk cloud 104×50) stay low so they read as lying on the road.

Encounter skins (`chase-`, `snatch-`, `social-` keys) are a zone's look for the squirrel, thief and other dog: the base kind's frame, tags, timings, feet rows and depth steps, laid out on the same 32-unit grid and drawn at 1.25×. Each picks fills that hold on its own zone's road and on that road dimmed. A Social dog's `run` is the loose dog's crossing: `loose-dog`'s gallop on the same skeleton, without the broken leash. A Snatch skin carries the thief's tan loot sack, and nothing a skin holds is a coin or a bone, so it never reads as a tip or a treat.

Each zone's minor obstacle skins (`minor-*`) keep their base kind's frame, footprint, anchor line, `idle` and depth steps: 1×1 skins 40×40 as the cone, 2×1 104×30 as the bench, 3×1 168×30 as the hedge, 1×3 56×35 at the footprint's near edge as the parked car. They show objects only, never a person or a live animal, so they read as something to bump rather than an encounter or a pickup, and no large fill takes their zone's road colour (Willow Crescent grey, Fairview Park tan, Main Street pink, Riverside Path cream).

A zone skin of an area encounter keeps its base's frame, tags, timings and anchor (`art/tools/skins_areas.py`). Splash skins (`splash-<skin>`) are 104×40 ground decals like the puddle: no outline, a 1px rim inside in the decal's darkest colour, and water sky in a blue rim with cyan and white so it holds on grey and cream. Stink skins (`stink-<skin>`) stand in the haze as the skunk does, in `skunk-cloud`, except on Main Street: its road is pink and its shadow mauve, so the fish crate stands in `stink-fish-crate-cloud`, the same haze one step down the ramp (purple fill, plum dither and wisps). A fly over a stink source is a 2×1 ink body under a white and light grey wing, drawn after the outline.

## Palette and outlines

- [Endesga 32](https://lospec.com/palette-list/endesga-32) only, each pixel opaque or fully transparent. Colour names are the `K` names in `art/tools/pixel.py`.
- Darkening (shadows, the dimmed road) maps each colour one step down its ramp (`DARKER`), never a blend with black.
- Outlines are coloured: two ramp steps darker than the fill they border.
- Road sprites use `road_edge`: the outline continues down the ramp until it holds 3:1 against tan, light grey and skin2 (`ROADS` in `art/tools/pixel.py`), and the fill carries Elm Avenue. A dark area takes a light rim on its edges facing the top-left light (grey on navy and black, skin2 on dark skin, cyan on sky) so it holds 3:1 on Elm Avenue. Willow Crescent (grey), Main Street (pink) and Riverside Path (cream) are lighter than The Long Way Home, so `road_edge` outlines hold 3:1 on them unchanged. A white coat on the road is white, not light grey, and its lower-right silhouette steps one ramp colour darker (white to lgrey, lgrey to grey), so it keeps its mass on the light roads.
- Faces (`face-`) and portraits (`portrait-`) take one ink outer line round every fill, white coats included, closed along the bottom row where the frame cuts a bust or a seated dog. Lines inside them (a head over its body) stay two ramp steps darker.
- Character shading is cel: per material a light, a base and a shade, the shade a crescent along the lower-right rim that follows the form (`Grid.cel`), never a diagonal plane or per-pixel texture. Markings such as merle are a few flat patches.
- Effects (`fx-`) take a fixed 1px rim instead: plum, navy for water, teal for green. `fx-bark` keeps a ramp outline, `fx-heart-gain` and `fx-heart-loss` take `ui-fires`' 1px ink line inside a 1px white rim (ink for the light roads, white for Elm Avenue and the dimmed road), and `fx-dust` (light grey dust) has no rim. Comic words take the sign logo's ink ring and dred shadow. Hazard warnings are outlined in ink.
- Ground decals (puddles) have no outline and no shadow.
- Icons come in two kinds. Chrome glyphs on `ui-icon-button` (`icon-close`, `icon-help`, `icon-home`, `icon-logbook`, `icon-music`, `icon-pause`, `icon-play`, `icon-settings`, `icon-sound`) are two flat tones with no outline. Content icons, such as `icon-gear-*`, `icon-need-*`, `icon-pace-*`, `icon-style-*`, `icon-trait-*` and `icon-zone-*`, are outlined with `icon_edge`: two ramp steps darker, then on down the ramp until the outline holds 3:1 on cream and tan. A picture that fills its frame keeps a 1px clear ring for the outline. A walker's pace and style icons are animals and objects (a snail, a hare, a rose, a money bag), never a bow, bone, squirrel, moon, paw or bolt, so they never read as a dog's trait or energy.
- Sprites carry no shadow; the game draws one in the road's darker ramp colour. The bouncing ball carries its own.

## Contrast

- Text holds 4.5:1 against what it sits on (3:1 at 2× and larger); essential icons and marks hold 3:1. Inactive controls are exempt.
- A state never relies on colour alone: it also changes shape (a tick, a hollow heart, a filled pip).
- The leash is a 1px line the game draws from the walker's hand to each collar: pink on Elm Avenue; dred on Fairview Park (3.49:1) and Riverside Path (5.07:1); plum on Willow Crescent (4.84:1), Main Street (5.03:1) and The Long Way Home (4.45:1). It is drawn over the dogs and their shadows and under the walker, who hides the part behind her, here and in every composite (help pages, cards, the og-image).

### UI colour pairs

Names are `PALETTE` names in `src/scenes/palette.ts`; ratios are WCAG.

| Pair                           | Ratio | Use                                                                                                                      |
| ------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| plum on cream                  | 9.42  | Body text on cream: panels, quips, hints, callouts, the zone banner, `normal` tiles and buttons, the cost on `card-cost` |
| plum on tan                    | 6.49  | Body text on tan                                                                                                         |
| plum on amber                  | 7.35  | Text on amber: forced-stop band, step number, the `ui-doghouse` card stock                                               |
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
| ink on green                   | 8.41  | `ui-button` `go` label, `ui-pet-shop` board                                                                              |
| white on rust                  | 4.99  | Trait chip "Food"                                                                                                        |
| white on darkRed, blue, purple | 7.34+ | Card bands, `ui-hit-label`, `ui-fired-plate`, the FIRED plate on the `empty` `ui-doghouse` card                          |
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

- One chrome for every panel, bubble, plate, tile and card frame: a cream face in a 1px ink outer line and a 1px plum inner line, with a tan lip along its bottom and right (`chrome` in `art/tools/ui.py`); `ui-doghouse` takes an amber face and orange lip instead. Corners are cut 1px (panels, cards), 2px (hints, detail cards) or 3px (quips). A coloured plate (`ui-hit-label`, `ui-fired-plate`) puts its face 4px in, inside a 2px cream band. Tails are cream in an ink line, laid over their bubble's ink row. No plain white boxes.
- Wood is background only: full-screen backgrounds (dbrown with plum seams), the top bar and `ui-dog-band`. Navy bands (`ui-section`, `ui-detail-band`) head sections and cards; the zone banner's ribbon ends are navy.
- `ui-section` frames each start screen section: `neutral` (ink frame, navy band, cream heading) while nothing in it is chosen, and `complete` (amber border and band, ink text) once something is. Walker, dogs and Pocket follow the same rule. The yard sign logo is flat yellow letters with an ink outline and a solid dred shadow (yellow on darkBrown 6.79:1). Home, pause, help and sound sit on `ui-icon-button`.
- `ui-sticker` (56×28) is a starburst in an ink outline: `new` (yellow body, amber spikes) on a dog or gear tile that just became affordable, `price` (cyan body, sky spikes) for the next locked item's price, `pop` (4 frames, 70ms, ending on the `new` look) for a badge-earned moment. At most one sticker per screen (`new` wins over `price`), never on the run screen's road or over a choice card. On a tile, its right edge sits 2px right of the tile's (kept 2px inside the screen) and its bottom 4px below the tile's, over the price line, which the tile then leaves out. The word is in `font-title` at 1×, ink, centred on x 28 with its caps in rows 12 to 16, up to 36px wide: "NEW!" or the price as the game formats it. Write the word after `pop` ends; with reduced motion show the last frame.
- Fonts: `font-body` (Tiny5, mixed case) for body text, quips and floating labels; `font-title` (Silkscreen, capitals) for titles, numbers and buttons. Floating numbers use the font, not sprites.
- Display lettering: the yard sign logo's letters (yellow fill, 1px ink outline, solid dred shadow) for big words only, never body text: zone names on `ui-zone-banner`, "WHICH WAY?", "FIRED!", "NEW BEST!", the end screen title and hit labels, in `font-display` (yellow) or `font-display-cream` (cream), 10px capitals with the colours baked in, drawn untinted. In-art signs (shop boards, the park gate, the lemonade stand) use the same letters and outline at 1x with a 1px shadow. `ui-pet-shop`'s PET SHOP board is a button, not a sign: the same letter shapes at 1x, filled ink with no outline or shadow.
- `ui-pet-shop` (120×104) stands on the gate scene's right lot at 234,90, its step on the yard's bottom row (193); its hit area is its frame. Its PET SHOP board is built and coloured as `ui-button` `go` (green face, yellow highlight, forest lip, ink line, ink letters 8.41:1). `pressed` dips as `ui-button` does: the front sinks 2px onto a step 1px shallower, and the board's lip and highlight give way to face, as `go-pressed`. When something in the shop is affordable, `ui-afford` goes 2px outside it (232,88 124×108), as on a tile. The street sign's plate (300,72 54×11) holds the street name in `font-body` at 1×, white, centred at 327,75: "Elm Avenue" is 32px wide, "ELM AVENUE" 39px, inside the 52px face.

### Interaction states

Every tile, button, card, tab and switch row is in one of four states, drawn the same way everywhere. `ui-tile` (insets 4) draws the first three for walker, dog and gear tiles; `ui-button` (insets 3, 3, 3, 5) draws all four.

| State    | When                                                                                  | Look                                                                                       | Label                                                |
| -------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| normal   | Available, not chosen; a locked item the bank covers, with `ui-afford` 2px outside it | Cream face, ink and plum lines, tan lip (`ui-tile` `normal`, `ui-button` `normal`)         | plum (9.42:1)                                        |
| selected | Picked, equipped, toggled on, the open tab or page                                    | Gold: ink line, amber band, orange line, yellow face (`ui-tile` `selected`)                | plum (10.92:1)                                       |
| disabled | Cannot be chosen: locked and not affordable, the pack full, not available             | Flat grey face, ink and slate lines, no lip (`ui-tile` `disabled`, `ui-button` `disabled`) | darkSlate (3.39:1, exempt); a price in navy (4.93:1) |
| primary  | The call to action: Start walk, Resume, Got it, Nice!, and the Pet shop board         | Raised green face on a forest lip (`ui-button` `go`; `ui-pet-shop`'s board)                | ink (8.41:1)                                         |

- Art inside a disabled tile (faces, icons, the padlock) draws from its grey copy (`greyTextureKey`, as a disabled card) one ramp step darker (`remapDarker`), on a slate box; a normal tile's box is tan, a selected one's amber.
- The primary green marks a screen's call to action. On the start screen it marks Start walk and the Pet shop board, the one other tappable entry point there, so both read as tappable; Start walk stays the only full-width primary button.
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

The dog row sits on `ui-dog-band` (360×94), drawn at 0,466 under the slots: the top bar's plum wood with the bar's bottom trim turned over along its top (ink on row 466 against the road, then dbrown and brown), so the bar and the band frame the road alike. The wood shows on rows 469 to 471 and between the cards. An owned slot with no dog shows the band, with the game's dashed tan outline and "Empty" in cream; a slot not bought shows the band alone.

`ui-doghouse` (120×90) is a character file card on the band: the UI chrome (ink and plum lines, amber face, orange lip) from x 1 to 118 and rows 2 to 89, so rows 0 and 1 show the wood and a 1px gap runs down each side. The amber card stock is on no zone's road, curb, sidewalk or verge, so a card never reads as road. A blue header (rows 3 to 20) holds the name plate (110×14: an ink line, an amber face, a solid dred shadow). The dog's photo is backed in its own colour and the owner's in sky, each in an ink frame with a white mat. The dog's colour also rings its emblem badge (its accessory, 8×8) and runs along the foot stripe under a plum rule, ticked in its trim. Card backgrounds and the band never use zone colours; a dog's accent is its own colour. The game draws, in slot pixels:

| Element           | Position                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Dog's name        | Centred at (60,6) in `font-title` on the name plate's amber face (x 6 to 113, rows 5 to 16)               |
| Dog's face        | (6,24), in the dog's photo                                                                                |
| Owner's face      | (42,24), in the owner's photo                                                                             |
| Hearts            | From (78,26), rows of five, 8px across and 8px down, in the white hearts box (x 77 to 116, rows 23 to 54) |
| "n/max" count     | Centred at (98,46) in `font-title` in the hearts box, under its solid rule                                |
| Status icons      | 16×16 at (78,62) and (98,62), in dashed boxes                                                             |
| Owner's name      | (6,62) in `font-body` on the ID line, ruled on row 70 (x 4 to 75), one clear row above the quirk icon     |
| Quirk icon        | 16×16 at (6,72), left of the emblem badge (x 24 to 35, rows 76 to 87)                                     |
| FIRED (fired dog) | Centred at (60,74), white, on the dred plate (built as `ui-fired-plate`) of the grey `empty` card         |

The `empty` card (a fired dog's) is the same card greyed: a slate header, a white name plate, a dark dog photo and a pale owner photo, with no hearts box, ID line, badge or stripe.

At 1 ♥, `ui-doghouse-warn` pulses over the card: a 2px rim inside its outline (`static` with reduced motion).

On a heart loss the game draws `ui-doghouse` `heart-loss` (4 frames: 60, 60, 80 and 80ms) over the card and under its faces, hearts and text: two red flashes of the header, face and foot stripe inside a plum edge that leave the name plate, photos, hearts box, ID line, quirk icon, status boxes and badge clear, then a 2px and a 1px red rim. It shakes the whole slot 1px right, left, right, then back, one offset per frame. With reduced motion it plays the flash without the shake.

### Choice cards

- Band colour by card type: dred encounter, amber forced stop, blue lucky, forest upgrade.
- Illustrations are road sprites at 1× on a scrap of the zone's ground, with no walker: a leash runs off the bottom edge.
- A disabled card is greyed with the grey ramp; the selected one is outlined in amber.

### Hits, moments and statuses

| Event                    | Shows                                                                                                                                                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 ♥                      | Owner's `worried` face and `ui-doghouse-warn`                                                                                                                                                                                                                                           |
| Any hit                  | `fx-bump` at the contact point; walker `stumble`, dogs `react`                                                                                                                                                                                                                          |
| Small pack hops a puddle | `fx-hop-splash` `splash-word` at the pack; with reduced motion `splash` under the "Hop!" label                                                                                                                                                                                          |
| Encounter hit            | `fx-hit-<encounter>` over the pack; `ui-hit-flash-<colour>` at the edges (café patio amber, goose white, other dog pink, petunias pink, picnic orange, puddle sky, skunk mauve, squirrel orange, thief amber, trash bins green); the label at 2× on `ui-hit-label`; caught dogs `shake` |
| Fee payout               | `fx-coin-fly` to the bank under `ui-payout-label`                                                                                                                                                                                                                                       |
| Firing                   | Owner's `fired` face at 2× over the doghouse on `fx-fired-pop` at 2× (an amber starburst behind a cream POOF cloud, and a front door slamming shut beside the face); the fired line in `ui-quip`; `ui-fired-plate` (blue laid-back, purple fussy, dred dramatic)                        |
| Heart change             | `fx-heart-loss` or `fx-heart-gain` `pop` over the dog beside the "−1" or "+1" label, then `fly` tweened into its doghouse's heart labels band; on a loss the house plays `ui-doghouse` `heart-loss` while the slot shakes                                                               |
| Minor bump               | `fx-coin-burst` at the pack under the "−$2" label; `fx-dizzy` over the walker while lane input is locked                                                                                                                                                                                |
| Moving hazard            | `ui-warning` and `ui-warning-arrow` at the lane edge about 1s ahead                                                                                                                                                                                                                     |
| Puddle, pickup           | `fx-splash`, `fx-sparkle`                                                                                                                                                                                                                                                               |
| Treat given              | `fx-treat-pop` and the owner's `happy` face                                                                                                                                                                                                                                             |

- `fx-status-<status>` loops over the dog's head, 6px below its top opaque row. Stinky shows per dog. Two statuses alternate every second, most recent first.
- With reduced motion, bursts and stars play and the stumble is skipped.

#### Comic words

One word per moment, built like the sign logo: flat yellow letters 7 rows tall with 2px stems, a 1px ink ring that also fills the counters and the gaps between letters, and a solid dred shadow 2px down and right. Display words only, 2 to 7 letters, readable at 1×.

| Effect             | Word     | Where it is                                                |
| ------------------ | -------- | ---------------------------------------------------------- |
| `fx-bark-word`     | WOOF!    | Its own 32×16 key, `pop` (4 frames, 60, 60, 140 and 140ms) |
| `fx-hop-splash`    | HOP!     | `splash-word`, over frames 0 to 3                          |
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
- The game plays `play-word`, `fx-bark-word` and `splash-word`. With reduced motion it shows `play` (held on frame 0), `fx-bark` and `splash`, so no word shows.
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
- A walker's `wave` faces the camera, for the popup stop where an unlocked walker waves from the sidewalk: 4 frames at 150ms, looping, feet on the back view's rows, the left arm (screen right) raised and swinging from the shoulder.
- Dogs are seen from above and behind. `walk` is a trot: diagonal leg pairs swap, the body bobs on the passing frames, the tail wags. `pull` leans right and is mirrored for left. `shake` runs at 60ms.
- Every road sprite that stands or waits, depth variants included, loops an `idle` with frame 0 the rest pose. Reduced motion shows frame 0.

| Idle      | Frames | Timing       | Motion                                                                              |
| --------- | ------ | ------------ | ----------------------------------------------------------------------------------- |
| Dogs      | 4      | 300ms        | Tail at −1, 0, +1, 0; the right ear 1px higher on the last frame                    |
| Obstacles | 2 to 4 | 350 to 500ms | A small event (glint, lid, drip, leaves, hazard lights); rest pose most of the loop |
| People    | 2      | 400ms        | Breathing: the body 1px higher on frame 2, feet planted, arms at rest               |

## Depth scaling

Road sprites have redrawn depth variants at the steps in `shared/depth-steps.json`: `<key>@88`, `@75`, `@62` and `@50` (dogs `@75` and `@50` only), each floor(size × scale + 0.5) with the original's tags, frames and durations, a full 1px outline, and 1px motion kept at 1px. The game draws a sprite at its projected size from the smallest of its steps at least that size, scaled down nearest-neighbour, so it never swaps to a smaller step as it approaches.

## Road strips

- 320×64, tiling vertically with no seam: patterns repeat every 64 rows or a divisor of it.
- The base is the zone's road colour (`src/data/world.ts`), so the game's shadow, one ramp step down, matches. Base (shadow): Willow Crescent grey (slate), Fairview Park tan (brown), Elm Avenue dslate (navy), Main Street pink (mauve), Riverside Path cream (tan), The Long Way Home skin2 (brown).
- The four lane dividers sit at x = 64k−1, 2px wide, one look per zone. Lane marks are faded white with a slate edge on Willow Crescent; dbrown on Fairview Park; white dashes 12 rows long in 32 with a mauve edge on Main Street; dbrown dashes 20 rows long in 32 on Riverside Path; white outlined in plum on The Long Way Home.
- Curbs and verges stay inside the outer 3 to 7px, clear of the 12px sprite margin.
- Every zone has a start strip: a neutral cross street (near kerb, asphalt with a zebra, far kerb) on rows 20 to 63 and the zone's strip on rows 0 to 19, so it follows any zone at a fork.
- The camera has its horizon at y −164 and the walker's feet at y 464; the road's far edge meets the backdrop at y 150 at scale 0.5. Its ratio r derives from speed (the visible distance is 4.5 s × `roadScrollSpeed`, 675 road px at 150 px/s, so r is 0.930). The rows from the far edge down to about y 160 sample the strip shrunk 4×, so: lane dashes and texture along the road repeat every 8 rows or more; lines across the road are at least 2 rows tall and low in contrast; fine detail runs along the road; small texture is spaced irregularly.

## Backdrops

Backdrops are 360×110 on screen rows 40 to 149; band row y is screen row 40 + y. The street ends at a T-junction. Rows 86 to 109 continue the road's projection at its slope (at row 109 the road spans columns 100 to 259, 160 wide, lane dividers on 132, 164, 195 and 227). Above them a flat cross street: far sidewalk 66 to 69, far curb 70 to 71, road 72 to 80 with its centre line on 76, near sidewalk 81 to 85. The far side faces the camera on ground row 62.

Where row 149 meets the road, left side (the right mirrors it):

| Zone              | Edge                           | Curb    | Road from  |
| ----------------- | ------------------------------ | ------- | ---------- |
| Willow Crescent   | Sidewalk 76 to 97              | 98..99  | 100        |
| Fairview Park     | Grass to 99                    | none    | 100 (path) |
| Elm Avenue        | Sidewalk 76 to 97              | 98..101 | 102        |
| Main Street       | Paving to 89, planter 90 to 97 | 98..101 | 102        |
| Riverside Path    | Paving 76 to 99                | none    | 100        |
| The Long Way Home | Sidewalk 76 to 97              | 98..99  | 100        |

Gag spots, kept clear (`python3 art/tools/backdrops.py gags` prints them): the near-left perch's top rail (rows 93 to 95, x 0 to 72), the near-right lawn (x 284 to 359, rows 86 to 109), and both sidewalks.

## Skies

- Daytime skies (Fairview Park, Riverside Path, Elm Avenue) stay cyan over sky with clouds. Main Street's sky is a sunburst: flat rays of sky and cyan, seven of each, from the end of the street (`sunburst` in `art/tools/backdrops.py`), with a cloud either side; its zone card repeats it with five of each.
- Sunset and night skies are hard-edged horizontal bands of flat colour (`bands` in `art/tools/backdrops.py`), each 0.7 times the height of the band above it, so they shrink toward the horizon. Above each seam the lower band's colour runs a 1-row line 2 rows up, and another 5 rows up on a band 12 rows or taller. No gradients, no dither.
- The sun is a flat yellow disc (`sun`) whose visible lower half is cut by horizontal gaps that widen toward the horizon as the bars between them thin; the bands show through the gaps. It sits over the orange band, so the gaps hold against the yellow.
- Bands, top to horizon:

| Sky                    | Bands                       | Extras                 | Where                                                                     |
| ---------------------- | --------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| The Long Way Home      | pink, orange, amber, yellow | Striped sun            | `backdrop-the-long-way-home`, `card-zone-the-long-way-home`, `screen-end` |
| Willow Crescent (dusk) | purple, mauve, pink, skin1  | Crescent moon, stars   | `backdrop-snooze-crescent`, `card-zone-snooze-crescent`                   |
| Elm Avenue at night    | navy, purple, mauve         | Stars in the navy band | `screen-loading`, the window of `screen-stats`                            |

- A zone card's sky repeats its backdrop's bands and sun. Scenery standing against a band never shares its colour: The Long Way Home's backdrop trees are rust and dbrown against the orange band.
- Bands belong to skies only: never on sprites, UI or the road.

## Sound

- Soft chiptune: square and triangle waves through gentle low-pass filters, short envelopes, nothing harsh.
- Hits and pickups under about 0.6s; `sfx-fired`, `sfx-badge` and `sfx-new-best` up to 2s; the walk loop at about 100 BPM.
- Files: effects under 50kB, music under 1MB, peaks below −1 dBFS after encoding, silence at both ends.
