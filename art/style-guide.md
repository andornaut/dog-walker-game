# Art Style Guide

The rules for drawing and placing the art. Exact sizes, tags, timings and coordinates are in each tool's docstring in `art/tools/`.

## Direction

- Pixel art: simple, cute, a little retro, refined. Mood: casual, cozy, low-stress.
- Chibi: heads about as big as bodies, so a breed reads from head shape, ears and markings on its road sprite and 32×32 face. Dogs come in three sizes: large dogs (54×54) are drawn narrower than their frame's scale, about 30px wide (Penny 28), medium dogs (48×48) at their frame's scale, and small dogs (38×38) larger inside theirs, about 20px wide and 31 to 32 tall, so the widths step about 30, 24 and 20. Faces and portraits keep one frame for every dog, the dog drawn by size but less than on the road, sat on the bottom edge. Each dog is drawn at the size that brings its inked area to its class's target (about 17, 21.3 and 25.5px square on faces, 35, 40 and 46px on portraits), so the classes step evenly whatever a breed's ears, ruff or topknot fill. The large dogs fill the frame, their faces zoomed past it as far as Kilo's ears fit, so they fill their tiles. A dog's coat and accessory read on both its road sprite and its face.
- Everything, UI included, is pixel art at the 360×560 base resolution, scaled up with no smoothing.

## Layout and sizes

| Band     | Screen rows | Contents                                                              |
| -------- | ----------- | --------------------------------------------------------------------- |
| Backdrop | 48 to 205   | `backdrop-<zone>`, 360×158                                            |
| Road     | 206 to 481  | 5 lanes of 64px; at the pack the road spans x 20 to 340, centre x 180 |

| Sprite                                                                                                         | Frame                      |
| -------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Large and small dogs on the road                                                                               | 54×54, 38×38               |
| Dog and owner faces                                                                                            | 32×32                      |
| Dog and walker portraits                                                                                       | 64×64                      |
| Obstacle n lanes wide                                                                                          | (64n−16)×36                |
| Owners                                                                                                         | 32×48                      |
| Pickups                                                                                                        | 24×24                      |
| Road animals (the other dog, skunk, squirrel, goose, `coyote`, `loose-dog`, `squirrel-dash`) and medium dogs   | 48×48                      |
| Road people (walkers, the lucky and forced-stop people, the thief, the other dog's owner and the human movers) | 48×72 (kids drawn shorter) |
| Small effects, icons                                                                                           | 16×16                      |

- Road sprites are 1.2× the game's 40px hit box. Dogs, people, animals, pickups, movers and encounters are drawn on a 32-unit design grid and rasterized at 1.5× (depth variants at 1.5× the step): every shape scales, 1px lines and single pixels stay 1px, and feet keep to the frame's bottom rows. Minor obstacles are laid out in their own pixels (40 for one lane, 30 rows for a lane-spanning one) and drawn at 1.2×; vehicles keep their columns to their lanes and draw their rows at 1.2×. A 48px sprite leaves 8px of margin each side of its 64px lane. Sizes are in `inventory.md`.
- Obstacles follow the OutRun rule: billboards (a front or rear elevation, never their length along the road), squat, scaled uniformly by 1/Z normalised to 1× at the pack, the base on the scanline of the footprint's near edge, drawn back to front. A footprint longer than one row lives in data, not in the sprite.
- Ground decals (the puddle, the skunk cloud) stay low so they read as lying on the road.
- A lucky person reads as good before the pack reaches it: the neighbour wears a red heart and has another floating at her frame's top right (`road.HEARTS`, picked per depth step so it stays a clean bitmap). No hazard carries a heart.

## Palette and outlines

- A 64-colour house palette, each pixel opaque or fully transparent: [Endesga 32](https://lospec.com/palette-list/endesga-32) and the 32 Toronto colours (`TORONTO` in `art/tools/pixel.py`; `PALETTE64` is both). Colour names are the `K` names in `pixel.py`. Each Toronto ramp ends on an Endesga colour (`DARKER`):

| Group               | Colours, light to dark down each ramp                                                  |
| ------------------- | -------------------------------------------------------------------------------------- |
| Brick, warm browns  | brick 8e3b2b, dbrick 5e2620; clay 9a6a4a, bark 523a2c, walnut 2e2019; driftwood a99c86 |
| Greens              | moss 9cb04a, olive 6b8a35, dolive 445a26; canopy 357a2f, pine 1e4d2b, fir 11301c       |
| Kensington brights  | lilac a77bd9, violet 6d4bb0; lime b2d94a; turquoise 35c2a6, dturq 1f8a7a               |
| Lake blues          | foam a8e0e6, shallow 58b8c9, lake 2f7fa6, dlake 1d5576                                 |
| Skies               | azure 3d86e0, cobalt 2654b0; gold f9c74f; haze cfe3ea; peach ff9e6b                    |
| Stones, dark slates | stone 8a857c, dstone 625e58; ash 57606a, shale 353b45, coal 26292f                     |
| TTC red             | ttc da291c                                                                             |

- A sprite in the Toronto colours carries them after Endesga 32 (and the neutral greys, when it uses them) in its Aseprite palette. UI rims that lighten (`LIGHTER` in `art/tools/ui.py`) step up the Endesga ramps; a Toronto road colour steps up its own ramp, then onto Endesga. `python3 art/tools/pixel.py palette` writes `shared/palette.json`, which the game's dark ramp reads.
- The neutral greys (`NEUTRAL` in `pixel.py`: nlgrey d8d8d8, ngrey a4a4a4, nslate 727272, ndslate 4a4a4a, ink as their darkest step) are for disabled and locked UI only: Endesga's greys are cool, and disabled UI reads as neutral grey.
- `deepAmber` (fc9124), outside the house palette and drawn only in code, is the box behind a picked tile's picture only: Endesga's amber sits too close to the tan box of an unpicked one.
- Darkening (shadows, the dimmed road) maps each colour one step down its ramp (`DARKER`), never a blend with black.
- Outlines are coloured: two ramp steps darker than the fill they border.
- Road sprites use `road_edge`: the outline continues down the ramp until it holds 3:1 against the light roads in `ROADS` (`pixel.py`: tan, pink and skin2, after the dslate road), and the fill carries the dslate road (the Distillery District's). A dark area takes a light rim on its edges facing the top-left light (grey on navy and black, skin2 on dark skin, cyan on sky; `rim` and `LIT` in `art/tools/road.py`) so it holds 3:1 on dslate, Kensington Market's dbrick and Yonge Street's shale. A sprite dark all over, such as Pepe's black coat, takes a grey outline instead. Cabbagetown's grey and The Beaches' cream are lighter than skin2, so `road_edge` holds on them unchanged. A white coat on the road is white, not light grey, its lower-right silhouette one ramp step darker.
- Faces (`face-`) and portraits (`portrait-`) take one ink outer line round every fill, white coats included, closed along the bottom row where the frame cuts a bust or a seated dog. Lines inside them stay two ramp steps darker.
- Character shading is cel: per material a light, a base and a shade, the shade a crescent along the lower-right rim that follows the form (`Grid.cel`), never a diagonal plane or per-pixel texture. Markings are a few flat patches. A face seen from the front stays clean: flat skin with a 1px shadow down its near (right) edge beside the eyes, never across the jaw or mouth (`face_disc`).
- Effects (`fx-`) take a fixed 1px rim: plum, navy for water (`fx-splash`). `fx-heart-gain` and `fx-heart-loss` take `ui-fires`' 1px ink line inside a 1px white rim; `fx-dust` and `fx-tap` have no rim. Hazard warnings are outlined in ink.
- Ground decals have no outline and no shadow.
- Icons come in two kinds. Chrome glyphs on `ui-icon-button` (`icon-close`, `icon-help`, `icon-home`, `icon-logbook`, `icon-pause`, `icon-play`, `icon-settings`, `icon-sound`) are two flat tones with no outline. Content icons (`icon-gear-*`, `icon-trait-*`, `icon-zone-*` and the like) take `icon_edge`: two ramp steps darker, then on down the ramp until the outline holds 3:1 on cream and tan. A picture that fills its frame keeps a 1px clear ring for the outline.
- A gear item drawn at several sizes (`item-<gear>` at 32, `icon-gear-<gear>` at 16, `icon-gear-<gear>-20` at 20) keeps the same colours at each.
- Sprites carry no shadow; the game draws one in the road's darker ramp colour. The bouncing ball carries its own.

## Contrast

- Text holds 4.5:1 against what it sits on (3:1 at 2× and larger); essential icons and marks hold 3:1. Inactive controls are exempt.
- A state never relies on colour alone: it also changes shape (a tick, a hollow heart, a filled pip).
- The leash is a 1px line the game draws from the walker's hand to each collar: pink on the Distillery District, Kensington Market and Yonge Street; dred on High Park and The Beaches; plum on Cabbagetown. It is drawn over the dogs and their shadows and under the walker, here and in every composite (help pages, cards, the og-image).

### UI colour pairs

Names are `PALETTE` names in `src/ui/phaser/palette.ts`, or `K` names for the neutral greys and any colour it leaves out; ratios are WCAG.

| Pair                           | Ratio | Use                                                                                                                         |
| ------------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| amber on darkBrown             | 4.57  | Warnings, "You're fired!"                                                                                                   |
| amber on navy                  | 7.49  | `icon-pause`, `icon-play` on `ui-icon-button`                                                                               |
| cream on darkBrown             | 5.85  | Text on the wood                                                                                                            |
| darkBrown on cream             | 5.85  | Secondary text, empty heart outline                                                                                         |
| darkRed on cream               | 5.07  | Money lost, an unaffordable price or unlock line, full heart                                                                |
| darkRed on nlgrey              | 5.15  | Price on the short plate                                                                                                    |
| forest on cream                | 5.39  | Money gained, an affordable price line, `ui-payout-label`, an earned badge's name                                           |
| ink on deepAmber               | 7.91  | A picked picture's outline on its box                                                                                       |
| ink on green                   | 8.41  | `ui-button` `go` label, `ui-pet-shop` board, price on the buy plate                                                         |
| ink on ngrey                   | 7.23  | The emblem's silhouette on a `locked` badge                                                                                 |
| ink on nlgrey                  | 12.64 | The goal plate: a walker's name, a blocked slot's price, a disabled card's cost; an affordable picture's outline on its box |
| ink on nslate                  | 3.75  | A disabled picture's outline on its art box                                                                                 |
| navy on cream                  | 9.59  | `ui-scroll-track` on the shop card (its ink edge 12.44:1)                                                                   |
| ndslate on cream               | 6.12  | A locked badge's name in the logbook                                                                                        |
| ndslate on ngrey               | 3.56  | Labels on `disabled` tiles and buttons (inactive, exempt), a `locked` badge's emblem                                        |
| ngrey on darkBrown             | 3.40  | `disabled` tile face on the wood                                                                                            |
| nslate on cream                | 3.32  | A locked badge's goal and progress in the logbook (inactive, exempt)                                                        |
| plum on amber                  | 7.35  | Text on amber: step number                                                                                                  |
| plum on cream                  | 9.42  | Body text on cream: panels, quips, hints, the zone banner, `normal` tiles and buttons                                       |
| plum on tan                    | 6.49  | Body text on tan                                                                                                            |
| plum on yellow                 | 10.92 | Text on a selected face (`ui-tile` `selected`)                                                                              |
| tan on darkBrown               | 4.04  | Empty slot dashed border, hollow page dots                                                                                  |
| tan on the dimmed road         | 3.0+  | 1px rim around the pause panel                                                                                              |
| `ui-difficulty` on cream       | 3.2+  | Filled paws plum-outlined (9.42); hollow paws a clay rim (3.2)                                                              |
| `ui-zone-pips` on cream        | 3.0+  | `todo` dashed; `<zone>` and `<zone>-done` rimmed darker than their well; `-done` ticked                                     |
| white on darkBrown             | 8.48  | Filled page dot                                                                                                             |
| white on darkRed, blue, purple | 7.34+ | Card bands, `ui-hit-label`, `ui-fired-plate`                                                                                |
| white on forest                | 7.80  | The purchase confirmation's title                                                                                           |
| white on navy                  | 13.89 | `ui-detail-band` title                                                                                                      |
| white over the dimmed road     | 4.5+  | Card subtitle                                                                                                               |
| yellow on navy                 | 11.13 | `ui-scroll-thumb` in `ui-scroll-track`                                                                                      |

## UI

- One chrome for every panel, bubble, plate, tile and card frame: a cream face in a 1px ink outer line and a 1px plum inner line, with a tan lip along its bottom and right (`chrome` in `art/tools/ui.py`); `ui-dog-card` takes a navy face with an ink inner line and lip instead. Corners are cut 1px (panels, cards), 2px (hints, detail cards) or 3px (quips). A coloured plate (`ui-hit-label`, `ui-fired-plate`) puts its face 4px in, inside a 2px cream band. Tails are cream in an ink line, laid over their bubble's ink row. No plain white boxes.
- Wood is background only: full-screen backgrounds (dbrown with plum seams), `ui-walk-bar` and `ui-dog-card-band`. Navy bands (`ui-section`, `ui-detail-band`) head sections and cards; the zone banner's ribbon ends are navy.
- No overlay tips over the play area: no tutorial hands, arrows or hint panels drawn over the road. Teaching lives on the help pages and in the message strip.
- A list longer than its view scrolls beside `ui-scroll-track` (8px wide, the list area's height): a navy groove in an ink edge, with `ui-scroll-thumb` (6px wide, yellow, amber lip) drawn 1px inside it. The rows and the track sit as one group with equal margins: the track's right edge is as far from the paper's edge as the rows' left edge is, and the rows narrow to leave the track 6px clear of them.
- The close control is `ui-icon-button` with `icon-close` (the X centred on the navy face both ways, 4px of navy each side and 3px above and below). On a card or panel it sits 8px in from the frame's top and right edges, so it fills the right end of `ui-detail-band`, drawn 24 rows tall, with 2px clear above, right and below. On a full-screen page it takes the rightmost top-bar button's spot, 333,9 under the home bar and 333,14 under the walk bar.
- `ui-section` frames each start screen section: `neutral` (ink frame, navy band, cream heading) while nothing in it is chosen, `complete` (amber border and band, ink text) once something is. Each section has its own seamless fill under its tiles, repeated with TileSprite: `ui-cork` (walker), `ui-plaid` (dogs) and `ui-denim` ringed by `ui-stitch-h` and `ui-stitch-v` (the Pocket).
- Fonts: `font-body` (Tiny5 a row taller, mixed case) for body text, quips and floating labels; `font-title` (Silkscreen, capitals) for titles, numbers and buttons. Floating numbers use the font, not sprites.
- Display lettering, the yard sign logo's letters (yellow fill, 1px ink outline, solid dred shadow), is for big words only, never body text: zone names on `ui-zone-banner`, "WHICH WAY?", "FIRED!", "NEW BEST!", the end screen title and hit labels, in `font-display` (yellow) or `font-display-cream`, colours baked in, drawn untinted. In-art signs use the same letters at 1× with a 1px shadow. `ui-pet-shop`'s PET SHOP board is a button, not a sign: the letter shapes at 2× filled ink with no outline or shadow.
- `font-comic` holds the comic words' letters, colours baked in, drawn untinted; each glyph's advance is its width plus 1, so the next ring lands on the 1px gap and merges.
- The gate scene's street sign (300,72 54×11) holds `homeText.gateSign` in `font-body` at 1×, white, centred at 327,75, inside the 52px face. `ui-pet-shop`'s glint bob stays at 2px or less so the board stays clear of it.

### Interaction states

Every tile, button, card, tab and switch row is in one of four states, drawn the same way everywhere. `ui-tile` (insets 4) draws the first three; `ui-button` (insets 3, 3, 3, 5) draws all four.

| State    | When                                                                          | Look                                                                        | Label                    |
| -------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------ |
| normal   | Available, not chosen                                                         | Cream face, ink and plum lines, tan lip (brown on a tile)                   | plum (9.42:1)            |
| selected | Picked, equipped, toggled on, the open tab or page                            | Gold: ink line, amber band, orange line, yellow face                        | plum (10.92:1)           |
| disabled | Cannot be chosen now: not owned and short, the pack full, not available       | Flat ngrey face, ink and nslate lines, no lip                               | ndslate (3.56:1, exempt) |
| primary  | The call to action: Start walk, Resume, Got it, Nice!, and the Pet shop board | Raised green face on a forest lip (`ui-button` `go`; `ui-pet-shop`'s board) | ink (8.41:1)             |

- Art inside a disabled tile draws from its grey copy in the neutral ramp, each color at the step nearest its brightness, on an nslate box; a normal tile's box is tan, a selected one's deepAmber. The padlock and the bill keep their colors, and an affordable item's picture keeps its colors on an nlgrey box, lighter than the tile, where a short one's grey copy sits on the darker nslate (see below). A normal tile's lip is brown, not the chrome's tan, so the tan box sits apart from it.
- An item for sale is owned (no badge, no plate), affordable (`icon-bill` and the green buy plate) or short (`icon-lock` and the nlgrey short plate), told apart by badge shape and plate, never by color alone. An item not owned draws on a `disabled` tile or row, with its name, on the start screen and in the Pet shop: its portrait or icon in full color while the bank covers it, from its grey copy while short. A walker not owned and a slot that needs the one before it are short whatever the bank holds, with the goal plate.
- The primary green marks a screen's call to action; on the start screen Start walk is the only full-width primary button. `go-disabled` matches `disabled`; `secondary` and `secondary-pressed` match `normal` and `pressed`.
- Cards follow the same states: a disabled card is redrawn in the grey ramp, the selected one is outlined in amber.

### Feedback and selected state

- A press shows at once: the item dips 2px (a button into its lip) and `fx-tap` bursts under the finger.
- Anything picked, equipped, toggled on or active shows three cues: the selected state's gold frame and yellow face (or a yellow face inside `ui-select`), a 2px lift onto a plum shadow, and a `ui-check` badge at its top-left. A picked tab (the Pet shop's and the logbook's) shows only the first two.
- `ui-afford` goes 2px outside the Pet shop building while something in the shop is affordable; no tile or shop row takes it.
- With reduced motion, highlights stay and movement is skipped.

### Icon buttons and top bars

- Each `ui-icon-button` face holds its 16×16 icon at +2,+1 (+2,+3 pressed), centred in a hit of at least 34×44. Positions are `walkBar.buttons` and `scenes.home` in `shared/export/layout.json`.
- `icon-sound`: `on` is a speaker with two waves, `off` the same speaker with a pink X. Settings rows lead with their `-panel` icon (`off` adds a dred X).
- The start screen's top bar (plum rows 0 to 37, a dbrown rule on 38 and 39) and the walk bar (`ui-walk-bar`, 360×48) show the bank in an ink well with no coin: an amber "$" (9.71:1 on ink) then the amount in cream (12.44:1). Their icon buttons line up: the start screen's Logbook, Help, Sound and Settings sit over the walk bar's Help, Sound, Settings and Pause.

## Run screen

The walk HUD's layout is in `src/hud/walkHud.ts` and `topBar.ts`, and each piece's drawing in `art/tools/ui.py`.

- The walk bar is plum wood with an ink cash well, a neighborhood well (the zone's name in cream `font-body`, "n of N" right-aligned in grey) and five `ui-effect-well`s holding the effects' `-20` icons. The 16×16 icon keys stay for the message strip, the shop and the cards.
- A `ui-debuff-bar` (360×16) per active debuff sits under the walk bar, its face, shade and fill in the debuff's colours: muddy brown, dbrown and tan with an ink name (4.66:1); stinky mauve, purple and pink with a white name (4.70:1); zoomies green, forest and yellow with an ink name (8.41:1); spotlight blue, navy and yellow with a white name (8.48:1).
- `ui-dog-card` (120×74) is a file card in the neutral `ui-section` look so the eye stays on the road: a navy face, the dog's photo and the owner's photo (`face-owner-<dog>-20`) with the owner's name in tan and hearts as `ui-heart` `full-dark` and `empty-dark`. The `empty` card (a fired dog's) is the same frame in dslate with the FIRED plate across the photo. `ui-dog-card-warn` pulses at 1 ♥ (`static` with reduced motion); `heart-loss` fills only the hearts area, never the card's edge, so `ui-dog-card-warn` stays the card's only border.
- `ui-owner-tab` pops in centred on a card's top edge when its dog's hearts change or the dog is fired. An owner's quip on the walk is a message strip line led by their face (`face-owner-<dog>-20`, framed in ink over tan) with their name under it in rust.

### Choice cards

- Band colour by what opened the card: dred for an obstacle's encounter, purple for a fork's route.
- Illustrations are road sprites at 1× on a scrap of the zone's ground, with no walker: a leash runs off the bottom edge.
- A lucky find's popup art (`card-lost-wallet-keep`) shows the one thing found, close up and larger than its road sprite, with no person. `card-petting-neighbor-take` is the exception: the find is the neighbor. Both pop up over the road with no background, cut out on transparency with no ground or shadow, their sparkles yellow so they read on every road.
- The art window is centred on the card's face: `card-frame` 3,15 77×58 with the illustration at 4,16; `card-frame-large` 6,30 154×116 with the illustration at 8,32.
- A path card (`card-zone-<zone>`) samples its road strip to a cross street and repeats its backdrop's sky and scenery in miniature.

### Hits and moments

| Event         | Shows                                                                                                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 ♥           | Owner's `worried` face and `ui-dog-card-warn`                                                                                                                                                                     |
| Encounter hit | `fx-hit-<encounter>` over the pack; `ui-hit-flash-<colour>` at the edges (other dog pink, puddle sky, skunk mauve, squirrel orange, thief amber); the label at 2× on `ui-hit-label`                               |
| Fee payout    | `fx-coin-fly` to the bank under `ui-payout-label`                                                                                                                                                                 |
| Firing        | Owner's `fired` face at 2× on `fx-fired-pop` at 2×; the fired line in `ui-quip`; `ui-fired-plate`                                                                                                                 |
| Heart change  | `fx-heart-loss` or `fx-heart-gain` `pop` over the dog, then `fly` into its card; on a loss the card plays `heart-loss`                                                                                            |
| Mover hit     | `fx-bump-big` centred 6px above the struck dog's top opaque row; the dog plays `react` and flashes white twice                                                                                                    |
| Moving hazard | `ui-warning` and `ui-warning-arrow` at the lane edge about 1s ahead: `pulse` for a crosser, `down-pulse` for a mover coming at the pack, `up-pulse` for one moving off ahead; `ui-warning-wander` over a wanderer |
| Pickup        | `fx-sparkle`                                                                                                                                                                                                      |
| Plain hit     | `fx-bump` 6px above the struck dog's top opaque row, the obstacle's debris over it (`fx-debris-leaves` for a hedge, `fx-debris-litter` for a trash can); a small dog that dodges plays `fx-dodge` instead         |
| Puddle        | `fx-splash` on the touching dog's feet; `ui-hit-flash-sky`; walker `stumble`; dogs `react`, then `shake`                                                                                                          |
| Treat given   | `fx-treat-pop` and the owner's `happy` face                                                                                                                                                                       |

- Hit effects draw over every road sprite and the pack. The pack is always drawn at full size, so they have no depth variants.
- Each `ui-hit-flash-<colour>` pairs a light ink, holding 3:1 or more on the dark roads, with a dark fringe on its inward edge for the light roads. Mauve, under 3:1 on dslate, takes a pink rim (one step up its ramp) on its inward edge.
- With reduced motion a bump or splash holds its peak frame (`fx-bump` and `fx-bump-big` frame 1, `fx-splash` frame 2); debris, shakes and `react` are skipped, and the white flash is one 120ms blink.
- Each message strip line leads with a 16×16 content icon (`icon-bump`, `icon-treat`, `icon-last-heart`, `icon-fired`, the debuff's icon, `icon-lucky`, `icon-trait-chaser`, `icon-hint`).

#### Comic words

One word per moment, 2 to 7 letters, readable at 1×, built like the sign logo: flat yellow letters 7 rows tall with 2px stems, a 1px ink ring that also fills the counters and the gaps between letters, and a solid dred shadow 2px down and right. No sprite carries a word: the game sets it in `font-comic` over the effect (WOOF! for `fx-bark`, DODGE! for `fx-dodge`, SNIFF!, PHEW! and YOINK! over the `fx-hit-*` bursts). Every `fx-hit-*` opens on an impact frame: an eight-point star in the encounter's colour with a white core. With reduced motion no word shows.

### Road movers

- Crossers are side views facing right, mirrored for left. Anything coming down a lane at the pack faces the player (`cyclist`, `jogger`, `kid-on-bike`, `minor-scooter`'s `ride`); anything going up a lane ahead of the pack, or slower than the road, is seen from behind (`stroller`, `ice-cream-truck`, `streetcar`). `coyote` steps toward the pack in any direction, so it is three-quarter front, angled right and mirrored for left.
- Each neighbourhood has its own road objects, drawn in `art/tools/hood_parks.py` (Cabbagetown, High Park), `hood_markets.py` (Distillery District, Kensington Market) and `hood_city.py` (The Beaches, Yonge Street). Each reads apart from the object it could be taken for: `porch-cat` is a white calico, unlike the tuxedo `chase-cat` and the ginger `ambient-cat`; `produce-crates` has no awning or posts, unlike `roadside-fruit-stand`; `cargo-bike`'s flower box hides the rider's legs, unlike `cyclist` and `kid-on-bike`; `ttc-bus` has a white upper body, a roof pod and tyres and no pantograph, unlike `streetcar`; `dropped-cone`'s cone lies on its side, unlike `cone`.
- `tourist` steps facing the player like `mail-carrier`; `couple` goes up its lanes from behind like `stroller`; `delivery-cyclist` faces the player like `cyclist`, told apart from it and `kid-on-bike` by its turquoise box. A busker's case holds sheet music and a sign, never coins, which read as pickups.
- `rollerblader`, `pedicab` and `cargo-bike` come down their lane facing the player; `ttc-bus` is slower than the road, so it is seen from behind; `porch-cat` and `capybara` are side views facing right, never mirrored while they stand.
- `squirrel`, `squirrel-dash`, `icon-trait-chaser` and `badge-squirrel` are Toronto's black squirrel (`SQUIRREL_FUR` in `art/tools/road.py`), lit by `LIT`'s rim.
- `pull-out` and every `drive` are 4 frames at 100ms and every `ride` 4 frames at 90 to 120ms, tread lines rolling 1px a frame; `pull-out` is drawn pulling right with the right indicator blinking, mirrored for left.
- The warning cues are yellow, ink outlined, 16×16, 2 frames at 250ms.

### Zone celebration

After zones 1 to 3, over the road view dimmed as under a card: the walker cheers at 2× in front of `ui-celebrate-burst` while about 60 `fx-confetti-bit` fall, under a big line in `font-display` at 2× and a small one in `font-display-cream`. Text on the bubble and the plate is plum on cream, money forest. The layout is in `src/hud/celebrationLayout.ts`. With reduced motion there is no confetti and the walker shows `cheer` frame 0 in place.

## Badges

`badge-<achievement>` medals are 32×32: a ring in the tier colour around a cream face with the goal's emblem (`art/tools/badges.py`). No two badges share a motif, so all 37 read apart at 1× on the badge wall's cream panel. An emblem shows only what is in the game.

- Tiers: firsts bronze, mastery silver, collection gold, silly pink. Silly is the joke tier, earned by mishaps and running gags; pink marks a joke, never a rank.
- Every ring is a base, a shade on its lower right, a light on its upper left and twelve rivets in the shade.
- `locked` is in the neutral greys: an ndslate ring (ink shade, nslate light), an ngrey face and the emblem a two-tone ink and ndslate silhouette under a small amber padlock, so a locked badge never reads as silver.

## Animation

- Animation names are Aseprite tag names. New tags go after existing ones so frame indices hold. Motion is in whole pixels.
- Walkers are seen from behind: `walk` 4, `react` 2, `stumble` 4 and `idle` 2 frames, no gear variants. `wave` and `cheer` face the camera.
- Road people and walking animals take the walkers' stride in `walk`: 4 frames (100ms; `stroller` 160ms like the walkers, `coyote` 120ms), a foot lifted, both feet 1px up as the body passes 1px higher, the other foot lifted, passing again.
- Dogs are seen from above and behind. `walk` is a trot: diagonal leg pairs swap (all four paws show, a long coat's front paws peeking out beside the chest), the body bobs on the passing frames with the ears lagging 1px, the tail wags. `pull` leans right and is mirrored for left. `shake` runs at 60ms.
- Every road sprite that stands or waits, depth variants included, loops an `idle` with frame 0 the rest pose. Reduced motion shows frame 0.

| Idle      | Frames | Timing       | Motion                                                                                                                |
| --------- | ------ | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Dogs      | 4      | 300ms        | Tail at −1, 0, +1, 0; the body 1px higher on frames 1 and 2, feet planted; the right ear 1px higher on the last frame |
| Obstacles | 2 to 4 | 350 to 500ms | A small event (glint, lid, drip, leaves, hazard lights); rest pose most of the loop                                   |
| People    | 2      | 400ms        | Breathing: the body 1px higher on frame 2, feet planted, arms at rest                                                 |

## Depth scaling

Road sprites have redrawn depth variants at the steps in `shared/depth-steps.json`: `<key>@88`, `@75`, `@62` and `@50`, each floor(size × scale + 0.5) with the original's tags, frames and durations, a full 1px outline, and 1px motion kept at 1px. The game draws a sprite smoothly from the smallest of its steps at least its true size, scaled down by at most 1, so it never swaps to a smaller step as it approaches.

`art/tools/pixel.py` settles every variant as it builds, larger steps first, so a variant never looks bigger than the next larger step drawn at its size and its feet line moves less than 1px at a switch (the rules are in `depth_settled`). A set whose variants depend on another set's (`hazards.py` and `depths.py`) settles on that set's exports, so after changing either, build both again until neither changes.

## Road strips

- 320×64 (`art/tools/roads.py`), tiling vertically with no seam: patterns repeat every 64 rows or a divisor of it.
- The base is the zone's road colour (`src/data/world.ts`), so the game's shadow, one ramp step down, matches. Base (shadow): Cabbagetown grey (slate), High Park tan (brown), Distillery District dslate (navy), Kensington Market dbrick (walnut), The Beaches cream (tan), Yonge Street shale (coal). Every road sprite's light rim holds on dbrick and shale at least as well as on dslate.
- The four lane dividers sit at x = 64k−1, 2px wide, one look per zone. Kensington Market paints each divider its own color (`LANE_PAINT` in `roads.py`), none of them gold, amber or orange, which read as coins.
- Curbs and verges stay inside the outer 5 to 8px of the strip, clear of the 8px each side of a 48px sprite in its lane.
- Every zone has a start strip: a neutral cross street (near curb, asphalt with a zebra, far curb) on rows 20 to 63 and the zone's strip on rows 0 to 19, so it follows any zone at a fork.
- The rows from the road's far edge down to about y 214 sample the strip shrunk 4×, so lane dashes and texture along the road repeat every 8 rows or more, lines across the road are at least 2 rows tall and low in contrast, fine detail runs along the road, and small texture is spaced irregularly.
- Joints and seams across the road repeat every 32 rows (`SEAM_PERIOD` in `roads.py`) or not at all: the road scrolls up to 11 px a frame at 30 fps, and a shorter period strobes, its motion seeming to stall or reverse. Paving with short joints lays them along the road, each column's joints at its own row.

### Verges

The game draws the verge beside each road: the curb, any strips, the sidewalk or paving with a seam across it every `seamEvery` road px, then the lawn. They are `VERGES` in `art/tools/backdrops.py`, keyed by art id with colours by `K` name; `backdrops.py build` and `verges --write` write them to `shared/verges.json`, which the game reads, and each backdrop's approach rows paint the same verge.

An ambient person or lawn animal holds 3:1 on its edge pixels (within 1%) on the light verges, the Distillery District's brick, Cabbagetown's lawn and Kensington Market's skin2, and on 74% or more on High Park's pine, where the light rim carries it.

## Roadside

The verges stay clean: bare lawn or paving beyond the sidewalks with the odd prop. `art/tools/roadside.py` draws the props and holds the per-zone placement table (`PLACEMENT`), which `roadside.py table --write` (and `build`) writes to `shared/roadside.json` for the game.

- Sprites are `roadside-<name>`, with `@88` to `@50` variants, laid out on a design grid and drawn at 1.5×. They are front elevations, never flipped, outlined with `road_edge` and no light rim, with one static `idle` frame, so the verges never pull the eye from the road.
- A prop never reads as something on the road: no person, no animal on the ground, no coin or bone, and each differs from the road object it could be taken for (the fruit stand has no wheels, unlike the hot dog cart; the transit stop has no shelter; the street lamp lights both ways, since a prop is never flipped).
- Each side has a slot every 140 road px, slot n at z = 140n. With m = n − offset (left 0, right 1), an even m is a lot and an odd m a gap, and k = floor(m / 2); a side takes gap (gapStart + k) mod 6, left gaps starting at 0 and right at 2. Every lot is empty; gap 0 holds the neighborhood's tree or street furniture and gap 3 its own prop, so each side has a prop every 6 slots and over both sides one stands every 420 px.
- Every frame's inner edge is at across 212 or more, past the sidewalk's outer edge at 208. No prop stands within a zone's start strip.
- Curb props are `curb-<name>`, drawn the same way: small street furniture on the sidewalk or paving, each frame wholly inside the zone's curb band (from 2 road px past the curb or its strip to 2 px inside the sidewalk's outer edge; paving out to the screen's edge counts as a 44 px sidewalk). Each stands at the band's middle, half a slot (70 px) further than the lawn props, and on each side every other slot holds one, the zone's two in turn, the sides alternating, so over both sides one stands every 140 px. High Park's lawn starts at the curb, so it has none. None reads as a road obstacle: no trash can, cone, bench or barrier.
- Free-standing props take the road objects' ground shadow in the zone's `shadowColour`, a darker tone of its lawn or paving.

| Neighborhood        | Gap 0         | Gap 3           | Curb                       | Shadow |
| ------------------- | ------------- | --------------- | -------------------------- | ------ |
| Cabbagetown         | `tree-maple`  | `gas-lamp`      | `hydrant`, `urn`           | canopy |
| Distillery District | `gas-lamp`    | `love-lock`     | `barrel`, `bollard`        | dbrown |
| High Park           | `tree-oak`    | `hot-dog-stand` |                            | fir    |
| Kensington Market   | `tree-maple`  | `fruit-stand`   | `bike-ring`, `news-box`    | brown  |
| The Beaches         | `leuty`       | `dune-grass`    | `rope-posts`, `life-ring`  | skin2  |
| Yonge Street        | `street-lamp` | `transit-stop`  | `pay-station`, `bike-ring` | coal   |

## Ambient

People, traffic, lawn animals and sky movers that pass by with no collisions and no card (`art/tools/ambient.py`), outlined with `road_edge` and lit with the rim on their dark parts. Side views face right; the game flips them to go left. The sky movers fly far back across a neighborhood's sky, outlined in ink, with no depth variants. A sprite that rests has its `idle` first. Each differs from the road sprite it could be taken for: the cyclist's colours from `cyclist`'s, the bus (side on, on tyres, with no pantograph) from `streetcar`, the lawn animals from the chase animals, and the pedestrian carries nothing and walks no dog, so it never reads as an owner, a walker or a hazard.

## Backdrops

Backdrops are 360×158 on screen rows 48 to 205 (`art/tools/backdrops.py`); band row y is screen row 48 + y. The band, its approach rows and the camera come from `shared/export/layout.json`. The street ends at a T-junction: the approach rows continue the road's projection (in play the road surface scrolls over them), and above them runs a flat cross street, beyond which the far side faces the camera. The tool's docstring lists the rows.

- Above the far side's front row the scenery goes back in depth, not taller. The debuff bars and the message strip lie over the band's top rows, so the sky above row 45 is one flat colour with no clouds, stars or scenery. Yonge Street is the exception: its skyline rises above row 45, under the bars' and the strip's opaque plates.
- Darkness varies: The Beaches bright and open, Kensington Market a bright Pedestrian Sunday afternoon, Cabbagetown and the Distillery District in between, Yonge Street an evening downtown and High Park darkest, under its canopy.
- Houses on the far side are slim, about as tall as they are wide, under a gable that rises about a row for each column it narrows, past 2px eaves. Light comes from the top left: the roof's left edge a ramp step lighter, the wall's right 3 columns a step darker. Trees, hedges and side yards fill the gaps, and the end houses run off the band's edges so the street carries on. Houses further back are smaller and show between the near roofs.
- The approach rows carry no static scenery. The near corners and the stub's verges show only their ground (lawn, paving, sidewalk and curb, as the verge paints them): the game's road begins there and its items spawn over them, so no perch, ornament, tree, lamp, bench, sign or other prop stands there. Everything static stands at or beyond the cross street, and no static vehicle stands on it: the ambient traffic drives there, so a jam (Yonge Street's side street) stays beyond the far sidewalk.

## Skies

- Each neighborhood has its own sky, flat above `CALM` (70 rows over the far side's ground row) but for Yonge Street's towers. Ink edges hold 3:1 or more on every sky.

| Sky                               | Bands or colours                                                    | Where                                          |
| --------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------- |
| Cabbagetown (dusk)                | lilac, pink, peach, gold bands; a crescent moon and the first stars | `backdrop-cabbagetown`, `screen-end` (no moon) |
| Distillery District (golden hour) | peach, orange, amber bands; a sun low over Trinity Square, gulls    | `backdrop-distillery-district`                 |
| High Park (deep clear blue)       | azure over sky, white clouds                                        | `backdrop-high-park`                           |
| Kensington Market (rosy sunburst) | flat peach rays over pink from the end of the street (`sunburst`)   | `backdrop-kensington-market`                   |
| The Beaches (late afternoon)      | gold over yellow, small clouds and gulls                            | `backdrop-the-beaches`                         |
| Toronto at night                  | navy, purple, mauve bands; a crescent moon, stars in the navy band  | `screen-loading`                               |
| Toronto autumn day                | foam over haze                                                      | `screen-home`                                  |
| Yonge Street (evening)            | slate, dslate, purple, mauve bands; a full moon and stars           | `backdrop-yonge-street`                        |

- A zone card repeats its backdrop's sky, bands and sun included.
- Banded skies are hard-edged horizontal bands of flat colour (`bands`), each 0.7 times the height of the band above it. Above each seam the lower band's colour runs a 1-row line 2 rows up, and another 5 rows up on a band 12 rows or taller. No gradients, no dither.
- The sun is a flat yellow disc (`sun`) whose lower half is cut by horizontal gaps that widen toward the horizon; it sits over the orange band, so the gaps hold against the yellow.
- Scenery against a band never shares its colour, and bands belong to skies only: never on sprites, UI or the road.

## Sound

- Soft chiptune: square and triangle waves through gentle low-pass filters, short envelopes, nothing harsh.
- Hits and pickups under about 0.6s; `sfx-fired`, `sfx-badge` and `sfx-new-best` up to 2s; the walk loop at about 100 BPM.
- Files: effects under 50kB, music under 1MB, peaks below −1 dBFS after encoding, silence at both ends.
