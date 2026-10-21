# Art Style Guide

## Direction

- Pixel art: simple, cute, a little retro, refined. Mood: casual, cozy, low-stress.
- Chibi: heads about as big as bodies, so a breed reads from head shape, ears and markings on its road sprite and 32×32 face. Dogs come in three sizes: big dogs (58×58, about 36px wide) and medium dogs (48×48) are drawn at their frame's scale, and small dogs (38×38) are drawn larger inside theirs, about 24px wide, chunky and clear. Faces and portraits keep one frame for every dog, the dog drawn by size but less than on the road (faces 32, 29 and 26px, portraits 64, 58 and 52px), sat on the bottom edge. A dog's coat and accessory read on both its road sprite and its face.
- Everything, UI included, is pixel art at the 360×560 base resolution, scaled up with no smoothing.

## Layout and sizes

| Band         | Screen rows | Contents                                                                                                                                                                                            |
| ------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top bar      | 0 to 39     | `ui-top-bar` wells: money 4,8 88×26, treats 96,8 32×26, zone 212,5 144×29; `ui-icon-button` Home 130,10, sound 152,10 and pause 174,10; `ui-strip-well` under the zone well, right aligned at x 356 |
| Backdrop     | 40 to 213   | `backdrop-<zone>`, 360×174                                                                                                                                                                          |
| Road         | 214 to 469  | 5 lanes of 64px; at the pack the road spans x 20 to 340, centre x 180                                                                                                                               |
| Doghouse row | 466 to 559  | `ui-dog-band` (360×94) at 0,466; three 120×90 `ui-doghouse` slots at x 0, 120 and 240, rows 470 to 559                                                                                              |

| Sprite                                                                                                   | Frame                      |
| -------------------------------------------------------------------------------------------------------- | -------------------------- |
| Dog and owner faces                                                                                      | 32×32                      |
| Big and small dogs on the road                                                                           | 58×58, 38×38               |
| Road animals: the other dog, skunk, squirrel, goose, `loose-dog` and `squirrel-dash`; medium dogs        | 48×48                      |
| Road people: walkers, the forced-stop and lucky people, the thief, the other dog's owner and the cyclist | 48×72 (kids drawn shorter) |
| Owners                                                                                                   | 32×48                      |
| Pickups                                                                                                  | 24×24                      |
| Small effects, icons                                                                                     | 16×16                      |
| Status overlays (`fx-status-<status>`)                                                                   | 19×19                      |
| Dog and walker portraits                                                                                 | 64×64                      |
| Obstacle n lanes wide                                                                                    | (64n−16)×36                |

Road sprites are 1.2× the game's 40px hit box. Dogs, people, animals, pickups, movers and encounters are drawn on a 32-unit design grid and rasterized at 1.5× (their depth variants at 1.5× the step): every shape scales, while 1px lines and single pixels stay 1px, and feet keep to the frame's bottom rows. The minor obstacles are laid out in their own pixels (40 for one lane, 30 rows for a lane-spanning one) and drawn at 1.2×; the parked car, the delivery truck, the ice cream truck and the construction barrier are laid out in their own pixels and drawn with their rows 1.2× and their columns sized to their lanes. A 48px sprite leaves 8px of margin each side of its 64px lane. Obstacles follow the OutRun rule: billboards (a front or rear elevation, never their length along the road), squat, scaled uniformly by 1/Z normalised to 1× at the pack, the base on the scanline of the footprint's near edge, drawn back to front. A footprint longer than one row lives in data, not in the sprite. Sizes: bench and `barrier-2` 112×36, hedge and `barrier-3` 176×36, the parked car 56×42 and the delivery truck 56×54 (1 lane by 3 rows of footprint, centred with 4px to spare each side of its 64px lane), the two-lane encounters 112 wide (picnic, petunias and trash bins 112×48, the café patio 112×60), the goose, cone, bin, hydrant and water bowl 48×48, the stop sign, the lemonade stand and the need spots' tree, lamp post and stranger 48×72, the cyclist 48×72 and the bouncing ball 24×36, the two-lane ice cream truck 112×66 (a rear-view van) and construction 64×48, one whole lane, repeated across the road. Ground decals (puddle 112×48, the skunk cloud 112×60) stay low so they read as lying on the road.

Zone skins are not drawn in play: the game draws only the base looks. Their files stay as they are, unmaintained, and `skins_animals.py` and `skins_minor.py` no longer build. The Chase and Social animal skins (`chase-`, `social-` keys), the minor obstacle skins (`minor-*`) and the area skins (`splash-`, `stink-` keys) are at the 40 px scale, smaller than their base kinds; the Snatch skins (`snatch-`) and the Social owners (`social-<skin>-owner`) are at the old 56×84 people size.

## Palette and outlines

- [Endesga 32](https://lospec.com/palette-list/endesga-32) only, each pixel opaque or fully transparent. Colour names are the `K` names in `art/tools/pixel.py`.
- Darkening (shadows, the dimmed road) maps each colour one step down its ramp (`DARKER`), never a blend with black.
- Outlines are coloured: two ramp steps darker than the fill they border.
- Road sprites use `road_edge`: the outline continues down the ramp until it holds 3:1 against the light roads in `ROADS` (`art/tools/pixel.py`: Fairview Park tan, Main Street pink, The Long Way Home skin2), and the fill carries Elm Avenue (dslate, the first entry). A dark area takes a light rim on its edges facing the top-left light (grey on navy and black, skin2 on dark skin, cyan on sky) so it holds 3:1 on Elm Avenue. A sprite that is dark all over, such as Pepe's black coat, takes a grey outline (3.39:1 on Elm Avenue) instead of the rim. Willow Crescent (grey) and Riverside Path (cream) are lighter than The Long Way Home, so `road_edge` outlines hold 3:1 on them unchanged. A white coat on the road is white, not light grey, and its lower-right silhouette steps one ramp colour darker (white to lgrey, lgrey to grey), so it keeps its mass on the light roads.
- Faces (`face-`) and portraits (`portrait-`) take one ink outer line round every fill, white coats included, closed along the bottom row where the frame cuts a bust or a seated dog. Lines inside them (a head over its body) stay two ramp steps darker.
- Character shading is cel: per material a light, a base and a shade, the shade a crescent along the lower-right rim that follows the form (`Grid.cel`), never a diagonal plane or per-pixel texture. Markings such as merle are a few flat patches. A person's face seen from the front, on the road, standing or in a `face-`, stays clean: flat skin with a 1px shadow down its near (right) edge beside the eyes, never across the jaw or mouth (`face_disc` in `art/tools/road.py`).
- Effects (`fx-`) take a fixed 1px rim instead: plum, navy for water, teal for green. `fx-bark` keeps a ramp outline, `fx-heart-gain` and `fx-heart-loss` take `ui-fires`' 1px ink line inside a 1px white rim (ink for the light roads, white for Elm Avenue and the dimmed road), and `fx-dust` (light grey dust) has no rim. Comic words take the sign logo's ink ring and dred shadow. Hazard warnings are outlined in ink.
- Ground decals (puddles) have no outline and no shadow.
- Icons come in two kinds. Chrome glyphs on `ui-icon-button` (`icon-close`, `icon-help`, `icon-home`, `icon-logbook`, `icon-music`, `icon-pause`, `icon-play`, `icon-settings`, `icon-sound`) are two flat tones with no outline. Content icons, such as `icon-gear-*`, `icon-need-*`, `icon-pace-*`, `icon-style-*`, `icon-trait-*` and `icon-zone-*`, are outlined with `icon_edge`: two ramp steps darker, then on down the ramp until the outline holds 3:1 on cream and tan. A picture that fills its frame keeps a 1px clear ring for the outline. A walker's pace and style icons are animals and objects (a snail, a hare, a rose, a money bag), never a bow, bone, squirrel, moon, paw or bolt, so they never read as a dog's trait or energy.
- Sprites carry no shadow; the game draws one in the road's darker ramp colour. The bouncing ball carries its own.

## Contrast

- Text holds 4.5:1 against what it sits on (3:1 at 2× and larger); essential icons and marks hold 3:1. Inactive controls are exempt.
- A state never relies on colour alone: it also changes shape (a tick, a hollow heart, a filled pip).
- The leash is a 1px line the game draws from the walker's hand to each collar: pink on Elm Avenue; dred on Fairview Park (3.49:1) and Riverside Path (5.07:1); plum on Willow Crescent (4.84:1), Main Street (5.03:1) and The Long Way Home (4.45:1). It is drawn over the dogs and their shadows and under the walker, who hides the part behind her, here and in every composite (help pages, cards, the og-image).

### UI colour pairs

Names are `PALETTE` names in `src/scenes/palette.ts`, and `K` names in `art/tools/pixel.py` for a colour it leaves out (purple); ratios are WCAG.

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
- No overlay tips over the play area: no tutorial hands, arrows or hint panels drawn over the road. Teaching lives on the help pages and in the message strip.
- `ui-section` frames each start screen section: `neutral` (ink frame, navy band, cream heading) while nothing in it is chosen, and `complete` (amber border and band, ink text) once something is. Walker, dogs and Pocket follow the same rule. The yard sign logo is flat yellow letters with an ink outline and a solid dred shadow (yellow on darkBrown 6.79:1). Help, Home, Logbook, pause, Settings and sound sit on `ui-icon-button`.
- `ui-sticker` (56×28) is a starburst in an ink outline: `new` (yellow body, amber spikes) on a dog or gear tile that just became affordable, `price` (cyan body, sky spikes) for the next locked item's price, `pop` (4 frames, 70ms, ending on the `new` look) for a badge-earned moment. At most one sticker per screen (`new` wins over `price`), never on the run screen's road or over a choice card. On a tile, its right edge sits 2px right of the tile's (kept 2px inside the screen) and its bottom 4px below the tile's, over the price line, which the tile then leaves out. The word is in `font-title` at 1×, ink, centred on x 28 with its caps in rows 12 to 16, up to 36px wide: "NEW!" or the price as the game formats it. Write the word after `pop` ends; with reduced motion show the last frame.
- Fonts: `font-body` (Tiny5, mixed case) for body text, quips and floating labels; `font-title` (Silkscreen, capitals) for titles, numbers and buttons. Floating numbers use the font, not sprites.
- Display lettering: the yard sign logo's letters (yellow fill, 1px ink outline, solid dred shadow) for big words only, never body text: zone names on `ui-zone-banner`, "WHICH WAY?", "FIRED!", "NEW BEST!", the end screen title and hit labels, in `font-display` (yellow) or `font-display-cream` (cream), 10px capitals with the colours baked in, drawn untinted. In-art signs (shop boards, the park gate, the lemonade stand) use the same letters and outline at 1x with a 1px shadow. `ui-pet-shop`'s PET SHOP board is a button, not a sign: the same letter shapes at 2x, filled ink with no outline or shadow.
- `ui-pet-shop` (120×108) stands on the gate scene's right lot at 234,86, its step on the yard's bottom row (193); its hit area is its frame. Its PET SHOP board (237,86 114×22, the full width of the parapet) is built and coloured as `ui-button` `go` (green face, yellow highlight, forest lip, ink line), with the sign letters' shapes at 2× filled ink (8.41:1). `pressed` dips as `ui-button` does: the front sinks 2px onto a step 1px shallower, and the board's lip and highlight give way to face, as `go-pressed`. `glint` sweeps a 6px light band (white, yellow edges) up and across the raised board in 6 frames, then ends on a clean frame; the game plays it every few seconds while idle, with a bob of at most 2px so the board stays clear of the street sign's plate. When something in the shop is affordable, `ui-afford` goes 2px outside it (232,84 124×112), as on a tile. The street sign's plate (300,72 54×11) holds the street name in `font-body` at 1×, white, centred at 327,75: "Elm Avenue" is 32px wide, "ELM AVENUE" 39px, inside the 52px face.
- Each start screen section has its own fill over the same tile area (section x+3, y+24, width-6, height-27), repeated with TileSprite under the tiles: the walker section is a corkboard (`ui-cork`: brown with dbrown and ochre granules), the dogs section a dog blanket (`ui-plaid`: a dred and plum tartan with tan threads) and the Pocket denim.
- The loading screen is the gate scene's street at night, seen from the road: the logo at 2× in the navy band, Elm Avenue's backdrop across the street two ramp steps darker with its windows lit, the yard one step darker (the picket fence with the open gate, `ui-pet-shop`'s building with its board and window lit), and the sidewalk where `ui-loading` walks Casey and Biscuit at the road sprites' size over `ui-loading-track`'s paw prints from the Pet shop to the gate. The night sidewalk is grey, so the leash is plum (4.84:1) and the prints dslate (3.39:1). The street below stays plain from the curb to row 500.
- The Pocket section is a jeans pocket: inside its `ui-section` frame and under the band, the tile area (section x+3, y+24, width-6, height-27) is `ui-denim` (blue twill, dslate diagonals and slate flecks, apart from the navy band and the other sections' fills), ringed by a tan stitch line on a navy shadow: `ui-stitch-h` along the top (section x+5, y+25) and bottom (x+5, y+height-6), width-10 long, and `ui-stitch-v` down the left (x+5) and right (x+width-7) from y+25, height-29 long. Fill first, then the side stitches, then the top and bottom ones, then the tiles. Each piece repeats with TileSprite from its own top-left, so every run starts on a dash.

### Interaction states

Every tile, button, card, tab and switch row is in one of four states, drawn the same way everywhere. `ui-tile` (insets 4) draws the first three for walker, dog and gear tiles; `ui-button` (insets 3, 3, 3, 5) draws all four.

| State    | When                                                                          | Look                                                                                       | Label                      |
| -------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------- |
| normal   | Available, not chosen                                                         | Cream face, ink and plum lines, tan lip (`ui-tile` `normal`, `ui-button` `normal`)         | plum (9.42:1)              |
| selected | Picked, equipped, toggled on, the open tab or page                            | Gold: ink line, amber band, orange line, yellow face (`ui-tile` `selected`)                | plum (10.92:1)             |
| disabled | Cannot be chosen now: locked (not owned), the pack full, not available        | Flat grey face, ink and slate lines, no lip (`ui-tile` `disabled`, `ui-button` `disabled`) | darkSlate (3.39:1, exempt) |
| primary  | The call to action: Start walk, Resume, Got it, Nice!, and the Pet shop board | Raised green face on a forest lip (`ui-button` `go`; `ui-pet-shop`'s board)                | ink (8.41:1)               |

- Art inside a disabled tile (faces, icons, the padlock) draws from its grey copy (`greyTextureKey`, as a disabled card) one ramp step darker (`remapDarker`), on a slate box; a normal tile's box is tan, a selected one's amber.
- A locked tile (not owned) is disabled whether or not the bank covers it: its art is a flat navy silhouette (`silhouetteTextureKey`) under `icon-lock`, with a cream price plate in an ink line, its price forest (5.39:1) while the bank covers it and darkRed (5.07:1) while not, or a goal plate in plum.
- The primary green marks a screen's call to action. On the start screen it marks Start walk and the Pet shop board, the one other tappable entry point there, so both read as tappable; Start walk stays the only full-width primary button.
- A disabled primary (Start walk before a walker and a dog are picked) is `go-disabled`, which matches `disabled`.
- `secondary` and `secondary-pressed` match `normal` and `pressed`: every button that is not the screen's primary is `normal`.
- Cards follow the same states: a disabled card is redrawn in the grey ramp, the selected one is outlined in amber. A switch row's state is its switch; the row itself is normal or disabled.

### Feedback and selected state

- A press shows at once, before any selected state: the item dips 2px (a button into its lip) and `fx-tap` bursts under the finger.
- Anything picked, equipped, toggled on or active shows three cues: the selected state's gold frame and yellow face (`ui-tile` `selected` on tiles; on other controls a yellow face inside `ui-select`), a 2px lift onto a plum shadow, and a `ui-check` badge (pick order or tick) at its top-left.
- When a multi-pick choice is full (the pack), the unselected items are disabled. A single-pick choice (gear) keeps the others normal, since tapping one swaps it in.
- A picked item's face hops; a picked dog hops onto the gate path in `fx-dust`.
- `ui-afford` goes 2px outside the Pet shop building while something in the shop is affordable, and outside each affordable row in the shop; no start screen tile takes it.
- A tap on a locked dog or gear tile opens the shop on that item. A locked walker, an unpicked dog while the pack is full, and Start walk before it is ready shake when tapped. The ready Start walk button bobs.
- With reduced motion, highlights stay and movement is skipped.

### Icon buttons and settings

| Control  | Scene                                | Button                                  | Hit area                                       |
| -------- | ------------------------------------ | --------------------------------------- | ---------------------------------------------- |
| Close    | Every full-screen page and overlay   | 28px in from the frame's right, 10 down | 44×44 in the frame's top-right corner          |
| Help     | Start screen top bar                 | 240,10                                  | 228,0 44×44                                    |
| Home     | Run top bar                          | 130,10                                  | 118,0 44×44                                    |
| Logbook  | Start screen top bar, after the bank | 104,10                                  | 92,0 134×44, over the best walk and walk count |
| Pause    | Run top bar                          | 174,10                                  | 162,0 44×44                                    |
| Settings | Start screen top bar                 | 328,10                                  | 316,0 44×44                                    |
| Sound    | Run top bar                          | 152,10                                  | 140,0 44×44                                    |
| Sound    | Start screen top bar                 | 284,10                                  | 272,0 44×44                                    |

- Positions are the `ui-icon-button` face's top-left; the 16×16 icon sits at +2,+1 (+2,+3 pressed). The game's values are in `shared/export/layout.json` (`topBar.buttons`, `scenes.home`).
- Sound toggles mute, as the M key and the Settings "Sound" switch do.
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

While a debuff (muddy, stinky or tangled) lasts, every pack dog's card shows it, and the message strip carries its line. The game draws `ui-doghouse-debuff` (120×21, tag = the debuff) at the slot's origin over the card and under the warn and heart-loss overlays, the name, faces and text. It repaints the header band, its shade and the name plate's face, and is clear everywhere else, so the card's lines and the plate's shadow show through; every dog's card shares those rows. Over the status spots the game draws the timer, in slot pixels:

| Debuff  | Band   | Shade  | Plate | Name | Bar fill |
| ------- | ------ | ------ | ----- | ---- | -------- |
| Muddy   | brown  | dbrown | tan   | ink  | brown    |
| Stinky  | mauve  | purple | pink  | plum | pink     |
| Tangled | dgreen | teal   | green | ink  | green    |

| Element      | Position                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Box          | Amber rect at (96,60) 20×20, over the second status spot                                        |
| Icon         | `icon-<debuff>` (16×16) at (78,62), in the first status spot                                    |
| Bar frame    | Ink rect at (96,63) 20×7                                                                        |
| Bar          | Tan rect at (97,64) 18×5, then the bar fill from its left, `round(18 × seconds left / 20)` wide |
| Seconds left | "12s", plum, `font-body` 1×, centred on x 106, line top 70 (digits on rows 72 to 76)            |

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
| Moving hazard            | `ui-warning` and `ui-warning-arrow` at the lane edge about 1s ahead: the arrow's `pulse` (right, mirrored for left) for a crosser, `down-pulse` for a mover about to come at the pack, `up-pulse` for one about to move off ahead; `ui-warning-wander` over a wanderer before each step |
| Plain hit                | `fx-bump` at the contact point and the heart change over the dog that touched it; a small dog that dodges plays `fx-dodge` on its frame instead                                                                                                                                         |
| Puddle, pickup           | `fx-splash`, `fx-sparkle`                                                                                                                                                                                                                                                               |
| Treat given              | `fx-treat-pop` and the owner's `happy` face                                                                                                                                                                                                                                             |

- `fx-status-<status>` loops over the dog's head, 6px below its top opaque row. Stinky shows per dog. Two statuses alternate every second, most recent first.
- Each status has its own colour family and shape, apart from the leash's pink, dred and plum: soaked cyan drops, spooked white lines and a cyan drop, stinky pink lines, tangled green rope (teal rim) in two interlocked loops, tuckered-out yellow z's (plum rim). `icon-tangled` and `icon-tuckered-out` keep their overlay's colours and rim, which hold on cream, amber and the top bar's ink.
- With reduced motion, bursts and stars play and the stumble is skipped.
- Each message strip line leads with a 16×16 content icon: `icon-bump` (an amber impact burst) for a plain hit, `icon-treat` for a treat, `icon-last-heart` (a red heart cracked from its notch) for an owner's last heart, `icon-fired` (a pink slip under a dred stamp) for a firing, the status's own icon (`icon-muddy`, a muddy paw print; `icon-stinky`; `icon-tangled`) for a debuff's start and end, `icon-lucky` (a four-leaf clover with a twinkle) for a lucky neighbour, `icon-trait-chaser` (the squirrel) for a squirrel pull, and `icon-hint` (a white i on a sky disc) for a first-time hint.

#### Comic words

One word per moment, built like the sign logo: flat yellow letters 7 rows tall with 2px stems, a 1px ink ring that also fills the counters and the gaps between letters, and a solid dred shadow 2px down and right. Display words only, 2 to 7 letters, readable at 1×.

| Effect             | Word     | Where it is                                                |
| ------------------ | -------- | ---------------------------------------------------------- |
| `fx-bark-word`     | WOOF!    | Its own 32×16 key, `pop` (4 frames, 60, 60, 140 and 140ms) |
| `fx-dodge`         | DODGE!   | `play`, over frames 0 to 3                                 |
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
- `pull-out` (`parked-car` and its 1×3 skins) and every `drive` (`parked-car`, `delivery-truck` and the garbage truck) are 4 frames at 100ms. `parked-car`'s `drive` is `pull-out`'s tread roll with no indicator; `delivery-truck`'s rolls tread lines up its tyres 1px a frame, its body dipping 1px onto them on frames 1 and 2. `pull-out` is drawn pulling right and mirrored for left: the car and scooter roll tread lines up their tyres 1px a frame with the right indicator blinking amber, the tricycles' hub pips and the log's face crack turn clockwise, and the canoe rack lurches 1px right on frames 1 and 2. The truck reverses down its lane at the pack, seen from behind: tread lines fall down its tyres and its body dips 1px onto them on frames 1 and 2.
- The warning cues are yellow, ink outlined, 16×16, 2 frames at 250ms; frame 2 grows the sign 1px all round or nudges the arrow or the "?" 1px its way.

### Zone celebration

After zones 1 to 3, over the road view (rows 214 to 465) dimmed as under a card, so the top bar, the backdrop and the doghouse row stay in view. The walker cheers at 2× in front of `ui-celebrate-burst` while `fx-confetti-bit` falls. Two lines head it: the big one in `font-display` drawn at 2× ("NEW WALKER!" or "NEIGHBORHOOD DONE!"), the small one under it in `font-display-cream` at 1× ("BEN JOINS YOU!" or the zone's name), both centred on x 180. Text on the bubble and the plate is plum on cream, money forest. Screen pixels; text y is the font line's top.

| Element         | New walker                                                                                                                                                    | Zone done                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Big line        | Line top 140                                                                                                                                                  | Line top 180                                                                                     |
| Small line      | Line top 172                                                                                                                                                  | Line top 212                                                                                     |
| Burst           | 106,188                                                                                                                                                       | 106,232                                                                                          |
| Walker          | `cheer` at 2× (96×144) from 132,182, feet line 326, its head 2 rows clear of the small line; hops in from x 400 (its centre, past the screen's edge) to x 180 | `cheer` at 2× from 132,226, feet line 370                                                        |
| Bubble or plate | `ui-quip` 24,332 312×76; `ui-quip-tail-up` at 176,327, its bottom row over the bubble's top rim                                                               | `ui-panel` 40,380 280×32                                                                         |
| Text            | The walker's line in `font-body` 2×, centred, wrapped to 296, line tops 336 and 354                                                                           | "+$21 pay · +$26 tips" in `font-body` 2×, centred, line top 387, two spaces each side of the dot |
| Rule            | Tan dots every 3px on row 375, x 36 to 323                                                                                                                    |                                                                                                  |
| Pace and style  | Icons at y 383, words in `font-body` 2× at line top 382: pace icon, 4px, word, 10px, "·", 10px, style icon, 4px, word, centred on x 180                       |                                                                                                  |
| Button          | `ui-button` `go` 48,416 264×44, "WELCOME!" in `font-title` 2×, ink, centred, line top 423                                                                     | None: it moves on after 2 s or at a tap                                                          |

- Confetti: about 60 `fx-confetti-bit`, each a random colour tag starting on a random frame, falling with a sideways sway from x 6 to 348 down the road view to row 458 over 2 s, under the lines, the burst, the walker and the panels. `fx-confetti` bursts at the walker's middle as the new walker lands. With reduced motion there is no confetti, the walker shows `cheer` frame 0 in place, and nothing hops in.

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
- Road people who walk (`thief`, `mail-carrier`, `other-dog-owner`) take the walkers' stride in their `walk`: 4 frames at 100ms, a foot lifted, both feet 1px up as the body passes 1px higher, the other foot lifted, passing again.
- A walker's `wave` faces the camera: 4 frames at 150ms, looping, feet on the back view's rows, the left arm (screen right) raised and swinging from the shoulder.
- A walker's `cheer` is the zone celebration's, drawn at 2×: the front view with both arms raised from the shoulders in a V, the thumbs inside, 4 frames at 120ms, looping: a crouch, take-off 2px up, the top of the hop 3px up, then the landing. Trista keeps her tote on her shoulder.
- Dogs are seen from above and behind. `walk` is a trot: diagonal leg pairs swap, the body bobs on the passing frames with the ears lagging 1px behind it, the tail wags. `pull` leans right and is mirrored for left. `shake` runs at 60ms.
- Every road sprite that stands or waits, depth variants included, loops an `idle` with frame 0 the rest pose. Reduced motion shows frame 0.

| Idle      | Frames | Timing       | Motion                                                                                                                |
| --------- | ------ | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Dogs      | 4      | 300ms        | Tail at −1, 0, +1, 0; the body 1px higher on frames 1 and 2, feet planted; the right ear 1px higher on the last frame |
| Obstacles | 2 to 4 | 350 to 500ms | A small event (glint, lid, drip, leaves, hazard lights); rest pose most of the loop                                   |
| People    | 2      | 400ms        | Breathing: the body 1px higher on frame 2, feet planted, arms at rest                                                 |

## Depth scaling

Road sprites have redrawn depth variants at the steps in `shared/depth-steps.json`: `<key>@88`, `@75`, `@62` and `@50`, each floor(size × scale + 0.5) with the original's tags, frames and durations, a full 1px outline, and 1px motion kept at 1px. The game draws a sprite at its true size, smoothly, from the smallest of its steps at least that size, scaled down by a factor of at most 1, so it never swaps to a smaller step as it approaches.

`art/tools/pixel.py` settles every variant as it builds, larger steps first. Its art fits the next larger step drawn at the variant's larger side plus 1px, rounded down, from the frame sizes: the frame keeps the size rule and the art drops the rows or columns that change it least. A ground sprite's variant is then held to the next larger step L, the one the game scales down to the variant's size just past the switch: frame 0's opaque width and height are at most L's frame 0 opaque width and height × the variant's scale / L's, rounded half up (and its rows at most L's × (side + 1) / L's side), so it never shrinks when the drawing switches steps. Where cutting rows or columns to fit would take a feature with it (the lemonade stand's sign letters), the drawing fits instead (`LEMONADE_FIT` in `art/tools/encounters.py`); the cut spares rows and columns crossing thin features, most of all in a colour rare in the frame. It stands with frame 0's last opaque row on L's feet row × side / L's side, rounded up, or the frame's bottom row when that is past it, so the feet line moves less than 1px at a switch, or under 1.5px when the feet are on the frame's bottom row; art too tall for the rows above that feet row drops the rows that change it least, and art reaching further below frame 0's feet than the rows under that feet row (a tail in a quirk tag) drops the rows below the feet that change it least. Status overlays are drawn at their own step and keep only the first rule. A set's variants that depend on another set's (`hazards.py` builds the movers' `@75` and `@50`, `depths.py` their `@88` and `@62`) settle on that set's exported art, so after changing either, build both again until neither changes.

## Road strips

- 320×64, tiling vertically with no seam: patterns repeat every 64 rows or a divisor of it.
- The base is the zone's road colour (`src/data/world.ts`), so the game's shadow, one ramp step down, matches. Base (shadow): Willow Crescent grey (slate), Fairview Park tan (brown), Elm Avenue dslate (navy), Main Street pink (mauve), Riverside Path cream (tan), The Long Way Home skin2 (brown).
- The four lane dividers sit at x = 64k−1, 2px wide, one look per zone. Lane marks are faded white with a slate edge on Willow Crescent; dbrown on Fairview Park; white dashes 12 rows long in 32 with a mauve edge on Main Street; dbrown dashes 20 rows long in 32 on Riverside Path; white outlined in plum on The Long Way Home.
- Curbs and verges stay inside the outer 3 to 7px of the strip, clear of the 8px each side of a 48px sprite in its 64px lane.
- Every zone has a start strip: a neutral cross street (near kerb, asphalt with a zebra, far kerb) on rows 20 to 63 and the zone's strip on rows 0 to 19, so it follows any zone at a fork.
- The camera has its horizon at y −36 and the walker's feet at y 464; the road's far edge meets the backdrop at y 214 at scale 0.5. Its ratio r derives from speed (the visible distance is 3.6 s × `roadScrollSpeed`, 720 road px at 200 px/s, so r is 0.694). The rows from the far edge down to about y 222 sample the strip shrunk 4×, so: lane dashes and texture along the road repeat every 8 rows or more; lines across the road are at least 2 rows tall and low in contrast; fine detail runs along the road; small texture is spaced irregularly.

## Roadside

Houses, fences, trees and yard props stand on the lawns beyond the sidewalks. `art/tools/roadside.py` draws them and holds the per-zone placement table (`PLACEMENT`, keyed by zone art id; `python3 art/tools/roadside.py table` prints it as JSON). Only Elm Avenue (`woof-way`) has a table.

- Sprites are `roadside-<name>`, with `@88` to `@50` variants, laid out on a design grid and drawn at 1.5× as the road sprites are. They are front elevations (the bike side on), never flipped, outlined with `road_edge` and no light rim, since they stand on the lawn. One `idle` tag: one frame of 1000ms, or the sprinkler's two of 200ms.
- Houses follow the backdrops' slim houses: about as tall as they are wide (the two-storey house a little taller), under a steep gable that rises a row for each column it narrows, past 2px eaves in a 2px band a step darker than the roof. Light comes from the top left: the roof's left edge is a ramp step lighter and the wall's right 3 columns a step darker. Each has a chimney; the porch houses have a dormer, its cap's right edge a step darker so it stands out of the roof.
- They never read as something on the road: no person, no animal on the ground, no coin or bone, and each differs from the road object it could be taken for. The lamp post is a white globe on a forest post with a flower basket (`spot-lamp-post` is a navy lantern), the street tree three round lobes (`spot-tree` is blocky), the hedge bumped and in flower (the obstacle `hedge` is a flat block), the flower border has no box (`petunias` has one), the gnome a blue hat and red coat (`minor-gnome` has a red hat and blue coat; a zone with `minor-gnome` does not take `roadside-gnome`), the mailbox blue with a yellow flag (the hydrant is red).

### Placement

Road px: across is the distance from the road's centre line to the prop frame's centre, z the distance along the road from the zone's start.

- Each side has a slot every 140 px along z, slot n at z = 140n. With m = n − offset (left 0, right 1), an even m is a lot and an odd m a gap, and k = floor(m / 2). A side takes lot (lotStart + k × lotStride) mod 6 and gap (gapStart + k × gapStride) mod 5: left lots 0, 1 and gaps 0, 2; right lots 3, 5 and gaps 1, 3 (start, stride). The right side runs one slot behind the left, so every lot faces a gap across the road; the two sides never take the same lot at the same k; each side repeats only after 30 lot and gap pairs (60 slots, 8400 px).
- Each prop stands at its slot's z plus dz (nearer negative). A lot is a house at dz 0 (frame's inner edge at across 220), its fence or hedge at dz −32 (inner edge 224), a mailbox at the gate and yard props; a gap holds trees, lamp posts or the washing line.
- Every frame's inner edge is at across 212 or more, past the sidewalk's outer edge at 208, so on screen a prop stays outside the sidewalk on its own row and every row above it.

| Lot | Props: key `roadside-…`, across, dz                                                     |
| --- | --------------------------------------------------------------------------------------- |
| 0   | `house-cottage` 280, 0; `fence` 299, −32; `mailbox` 231, −38; `flowers` 295, −42        |
| 1   | `house-tall` 277, 0; `hedge` 290, −32; `mailbox` 231, −38; `gnome` 265, −15             |
| 2   | `house-porch` 283, 0; `fence-cat` 299, −32; `bike` 267, −45                             |
| 3   | `house-cottage-pink` 280, 0; `fence` 299, −32; `mailbox` 231, −38; `sprinkler` 314, −15 |
| 4   | `house-tall-grey` 277, 0; `fence` 299, −32; `gnome` 275, −15                            |
| 5   | `house-porch-tan` 283, 0; `hedge` 290, −32; `mailbox` 231, −38; `flowers` 300, −42      |

| Gap | Props: key `roadside-…`, across, dz          |
| --- | -------------------------------------------- |
| 0   | `tree` 270, 0                                |
| 1   | `lamp-post` 231, −12; `tree-blossom` 302, 12 |
| 2   | `laundry` 313, 0                             |
| 3   | `tree` 277, 0; `lamp-post` 231, −38          |
| 4   | `tree-blossom` 272, 0                        |

### Drawing

- A prop d road px ahead of the feet draws at the road camera's scale s, at x = 180 − across × s on the left and 180 + across × s on the right, its feet on the row of d, from the smallest of its steps at least its projected size, as the road objects.
- Draw order: depth `DEPTH.sprite` + feet row, so back to front with the road objects; over the backdrop, cropped at the juncture (row 126), so a far prop shows in full from the cross street; and under the doghouses.
- Free-standing props (mailbox, both trees, lamp post, gnome, bike) take the road objects' ground shadow (sized from the prop's `opaqueWidth`) in dgreen, the lawn one ramp step darker. Houses, fences, the hedge, the flower border, the sprinkler and the washing line take none.
- With 20px of verge at the pack, a prop leaves the screen's side once its inner edge does, at about s 0.85; houses never show whole. No prop stands within the 64 rows of a zone's start strip, so the cross street stays clear.

## Backdrops

Backdrops are 360×174 on screen rows 40 to 213; band row y is screen row 40 + y. The band, its approach rows and the camera come from `shared/export/layout.json`. The street ends at a T-junction. Rows 155 to 173, the approach, continue the road's projection at its slope (at row 173 the road spans columns 100 to 259, 160 wide, lane dividers on 132, 164, 195 and 227); in play the road surface scrolls over them from the juncture, and only the cross street and the scenery above it stay still. Above them a flat cross street: far sidewalk 135 to 138, far curb 139 to 140, road 141 to 149 with its centre line on 145, near sidewalk 150 to 154. The far side faces the camera on ground row 131.

Above the far side's front row the scenery goes back in depth, not taller: hills, a second row of houses, the town, the park's meadow or the river's far bank, then the sky. The message strip lies over band rows 4 to 60 (screen rows 44 to 100), so the sky above row 61 is one flat colour with no clouds, stars, rays or scenery, and clouds, the moon, birds and the tallest scenery stay below it.

| Zone              | Depth behind the front row                                                           |
| ----------------- | ------------------------------------------------------------------------------------ |
| Willow Crescent   | Dark far houses up a slate hill, a few windows lit, and a church spire               |
| Fairview Park     | Wooded hills, a far tree line and a meadow with a bandstand; a kite in the sky       |
| Elm Avenue        | A green hill with a second row of houses up its slope and a water tower on its crest |
| Main Street       | The town's blocks and a clock tower over the toy shop                                |
| Riverside Path    | A wider river with a dinghy; on the far bank hills, a village and a spire            |
| The Long Way Home | Dbrown hills the sun sets behind; birds in the pink band                             |

Houses on the far side are slim, about as tall as they are wide: Elm Avenue's are 44 to 48 wide and 46 rows from the step to the ridge, a 22- to 24-row wall under a 22- to 24-row roof. The gable rises about a row for each column it narrows, past 2px eaves. Light comes from the top left: the roof's left edge is a ramp step lighter, the wall's right 3 columns a step darker. Each has a chimney, and some a dormer. Trees, hedges and side yards fill the gaps, and the end houses run off the band's edges so the street carries on. Houses further back are smaller (18 to 20 wide, a 12-row wall, two small windows, no door or chimney) and show between the near roofs. Willow Crescent's houses rise with its far side toward the middle.

Where row 213 meets the road, left side (the right mirrors it):

| Zone              | Edge                           | Curb    | Road from  |
| ----------------- | ------------------------------ | ------- | ---------- |
| Willow Crescent   | Sidewalk 76 to 97              | 98..99  | 100        |
| Fairview Park     | Grass to 99                    | none    | 100 (path) |
| Elm Avenue        | Sidewalk 76 to 97              | 98..101 | 102        |
| Main Street       | Paving to 89, planter 90 to 97 | 98..101 | 102        |
| Riverside Path    | Paving 76 to 99                | none    | 100        |
| The Long Way Home | Sidewalk 76 to 97              | 98..99  | 100        |

Gag spots, kept clear (`python3 art/tools/backdrops.py gags` prints them): the near-left perch's top rail (rows 158 to 159, x 0 to 72), the near-right lawn (x 284 to 359, rows 155 to 173), and both sidewalks.

Scenery gags are sprites the game places on those spots, drawn front view at the band's own scale, in `art/tools/road.py`. They loop, open no card and have no effect.

| Key             | Spot            | Top-left (band px) | Note                                                                                                                                                                                                 |
| --------------- | --------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gag-cat`       | Near-left perch | x 0 to 48, row 135 | Paws on the top rail, row 158                                                                                                                                                                        |
| `gag-kite`      | Near-right lawn | 284, 133           | A street tree with a diamond kite snagged in its crown. Its crown rises over the cross street, rows 133 to 149; its foot's outline is on row 171. Every zone takes it, Main Street's paving included |
| `gag-sprinkler` | Near-right lawn | 322, 150           | Not on Main Street, which is paved                                                                                                                                                                   |

- One sprite for every zone: the kite's tree is drawn into it, since Main Street has no tree and Riverside Path's stand across the river. Its crown is green with a forest outline, and the kite red and yellow with a plum outline, so both hold on every zone's ground and far side.

## Skies

- Daytime skies (Fairview Park, Riverside Path, Elm Avenue) stay cyan over sky with clouds: flat cyan down to row 61, then sky. Main Street's sky is a sunburst: flat rays of sky and cyan, seven of each, from the end of the street (`sunburst` in `art/tools/backdrops.py`), ending on an arc below row 61 with flat cyan beyond it, and a cloud either side; its zone card repeats it with five of each.
- Sunset and night skies are hard-edged horizontal bands of flat colour (`bands` in `art/tools/backdrops.py`), each 0.7 times the height of the band above it, so they shrink toward the horizon. On a backdrop the bands run from row 61 to the far side's ground row and the top band also fills the rows above (`sunset`); stars sit in the top band below row 61. Above each seam the lower band's colour runs a 1-row line 2 rows up, and another 5 rows up on a band 12 rows or taller. No gradients, no dither.
- The sun is a flat yellow disc (`sun`) whose visible lower half is cut by horizontal gaps that widen toward the horizon as the bars between them thin; the bands show through the gaps. It sits over the orange band, so the gaps hold against the yellow.
- Bands, top to horizon:

| Sky                    | Bands                       | Extras                 | Where                                                                     |
| ---------------------- | --------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| The Long Way Home      | pink, orange, amber, yellow | Striped sun            | `backdrop-the-long-way-home`, `card-zone-the-long-way-home`, `screen-end` |
| Willow Crescent (dusk) | purple, mauve, pink, skin1  | Crescent moon, stars   | `backdrop-snooze-crescent`, `card-zone-snooze-crescent`                   |
| Elm Avenue at night    | navy, purple, mauve         | Stars in the navy band | `screen-loading`                                                          |

- A zone card's sky repeats its backdrop's bands and sun. Scenery standing against a band never shares its colour: The Long Way Home's backdrop trees are rust and dbrown against the orange band.
- Bands belong to skies only: never on sprites, UI or the road.

## Sound

- Soft chiptune: square and triangle waves through gentle low-pass filters, short envelopes, nothing harsh.
- Hits and pickups under about 0.6s; `sfx-fired`, `sfx-badge` and `sfx-new-best` up to 2s; the walk loop at about 100 BPM.
- Files: effects under 50kB, music under 1MB, peaks below −1 dBFS after encoding, silence at both ends.
