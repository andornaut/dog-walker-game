# Art Style Guide

The rules for drawing and placing the art. Exact sizes, tags, timings and coordinates are in each tool's docstring in `art/tools/`.

## Direction

- Pixel art: simple, cute, a little retro, refined. Mood: casual, cozy, low-stress.
- Chibi: heads about as big as bodies, so a breed reads from head shape, ears and markings on its road sprite and 32×32 face. Dogs come in three sizes: large dogs (54×54) are drawn narrower than their frame's scale, about 30px wide (Penny 28), medium dogs (48×48) at their frame's scale, and small dogs (38×38) larger inside theirs, about 20px wide and 31 to 32 tall, so the widths step about 30, 24 and 20. Faces and portraits keep one frame for every dog, the dog drawn by size but less than on the road, sat on the bottom edge. Each dog is drawn at the size that brings its inked area to its class's target (about 17, 21.3 and 25.5px square on faces, 35, 40 and 46px on portraits), so the classes step evenly whatever a breed's ears, ruff or topknot fill. The large dogs fill the frame, their faces zoomed past it as far as Kilo's ears fit, so they fill their tiles. A dog's coat and accessory read on both its road sprite and its face.
- Everything, UI included, is pixel art at the 360×560 base resolution, scaled up with no smoothing.

## Quality bar

Every piece is very readable, clean and not busy, judged at the size it's shown: the `@50` depth step for road sprites, 1× for cards and UI.

- **Silhouette first:** filled solid black, the piece still says what it is. Fix the shape before the detail.
- **Value contrast:** the subject separates from the ground it appears on (see Contrast), and its main parts (head and body, rider and vehicle, figure and background) separate by lightness, not only by hue. Check in greyscale.
- **Colour budget:** about 6 to 8 fill colours plus the outline and rim, with one accent that draws the eye. Merge near-duplicate shades.
- **Detail budget:** pixel clusters of 2px or more. No mark under 2px at the smallest size, no single-pixel noise, speckle or dithering on small sprites, and no texture that turns to noise at `@50` or shimmers as the road scrolls.
- **One focal point:** each card picture, sprite and screen has one thing the eye goes to first. Scene filler (flecks, bunting, extra props, extra dogs) stays sparse, and backgrounds sit lower in contrast and saturation than the subject.
- **Clean lines:** a closed 1px outline, no doubled or broken edges, no orphan pixels, curves without jaggies, and the top-left light everywhere.
- **Consistency:** within a set, and across sets seen together, the same proportions, outline weight, palette, rim, facing and detail density.
- **Look-alikes:** an obstacle's colours and shapes never read as a pickup (a round gold or orange blob reads as a tip coin), and obstacles in one neighbourhood have distinct silhouettes.

## Layout and sizes

| Band     | Screen rows | Contents                                                              |
| -------- | ----------- | --------------------------------------------------------------------- |
| Backdrop | 48 to 205   | `backdrop-<zone>`, 360×158                                            |
| Road     | 206 to 481  | 5 lanes of 64px; at the pack the road spans x 20 to 340, centre x 180 |

| Sprite                                                                                                              | Frame                                            |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Dog and owner faces                                                                                                 | 32×32                                            |
| Dog and walker portraits                                                                                            | 64×64                                            |
| Large and small dogs on the road                                                                                    | 54×54, 38×38                                     |
| Minor obstacle one lane wide                                                                                        | 48×48, 48×72 standing tall                       |
| Minor obstacle n lanes wide                                                                                         | (64n−16)×36                                      |
| Owners                                                                                                              | 32×48                                            |
| Pickups                                                                                                             | 24×24                                            |
| Road animals (the other dog, skunk, squirrel, goose, `coyote`, `hen`, `loose-dog`, `squirrel-dash`) and medium dogs | 48×48                                            |
| Road people (walkers, the lucky and forced-stop people, the thief, the other dog's owner and the human movers)      | 48×72 (kids drawn shorter; `stilt-walker` 48×96) |
| Small effects, icons                                                                                                | 16×16                                            |

- Road sprites are 1.2× the game's 40px hit box. Dogs, people, animals, pickups, movers and encounters are drawn on a 32-unit design grid and rasterized at 1.5× (depth variants at 1.5× the step): every shape scales, 1px lines and single pixels stay 1px, and feet keep to the frame's bottom rows. Minor obstacles are laid out in their own pixels (40 for one lane, 30 rows for a lane-spanning one) and drawn at 1.2×; vehicles keep their columns to their lanes and draw their rows at 1.2×. A 48px sprite leaves 8px of margin each side of its 64px lane. Sizes are in `inventory.md`.
- Obstacles follow the OutRun rule: billboards (a front or rear elevation, never their length along the road), squat, scaled uniformly by 1/Z normalized to 1× at the pack, the base on the scanline of the footprint's near edge, drawn back to front. A footprint longer than one row lives in data, not in the sprite.
- Ground decals (the puddle, the pothole, the skunk cloud) stay low so they read as lying on the road.
- A gear drop (`drop-<gear>`) shows its gear in the shop art's colours and silhouette with a yellow sparkle at a top corner, always there, a plus that twinkles to a four-point star (below 1.2×, a 3×3 plus that flashes white, never a lone pixel). It reads apart from the tip's coin, the treat's bone and the lost wallet, whose white glint comes and goes.
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

- A sprite in the Toronto colours carries them after Endesga 32 (and the neutral greys, when it uses them) in its Aseprite palette. A zone pip's rim (`pip_rim` in `art/tools/ui.py`) steps its well's colour down its ramp (`DARKER`) until it holds 3:1 on the end screen's cream panel. `python3 art/tools/pixel.py palette` writes `shared/palette.json`, which the game's dark ramp reads.
- The neutral greys (`NEUTRAL` in `pixel.py`: nlgrey d8d8d8, ngrey a4a4a4, nslate 727272, ndslate 4a4a4a, ink as their darkest step) are for disabled and locked UI only: Endesga's greys are cool, and disabled UI reads as neutral grey.
- `deepAmber` (fc9124), outside the house palette and drawn only in code, is the box behind a picked tile's picture only: Endesga's amber sits too close to the tan box of an unpicked one.
- Darkening (shadows, the dimmed road) maps each colour one step down its ramp (`DARKER`), never a blend with black.
- Outlines are coloured: two ramp steps darker than the fill they border.
- Road sprites use `road_edge`: the outline continues down the ramp until it holds 3:1 against the roads in `ROADS` (`pixel.py`: tan, pink and skin2, and Kensington Market's mid-grey stone, after the dslate road), and the fill carries the dslate road (the Distillery District's). On stone that takes most outlines to their ramp's darkest steps, ink at the bottom of every ramp. A dark area takes a light rim on its edges facing the top-left light (grey on navy and black, skin2 on dark skin, cyan on sky; `rim` and `LIT` in `art/tools/road.py`) so it holds 3:1 on dslate and Yonge Street's shale. A sprite dark all over, such as Pepe's black coat, takes a grey outline instead. Cabbagetown's grey and The Beaches' cream are lighter than skin2, so `road_edge` holds on them unchanged. A white coat on the road is white, not light grey, its lower-right silhouette one ramp step darker.
- Faces (`face-`) and portraits (`portrait-`) take one ink outer line round every fill, white coats included, closed along the bottom row where the frame cuts a bust or a seated dog. Lines inside them stay two ramp steps darker.
- Character shading is cel: per material a light, a base and a shade, the shade a crescent along the lower-right rim that follows the form (`Grid.cel`), never a diagonal plane or per-pixel texture. Markings are a few flat patches. A face seen from the front stays clean: flat skin with a 1px shadow down its near (right) edge beside the eyes, never across the jaw or mouth (`face_disc`).
- Effects (`fx-`) take a fixed 1px rim: plum, navy for water (`fx-splash`). `fx-heart-gain` and `fx-heart-loss` take `ui-fires`' 1px ink line inside a 1px white rim; `fx-dust` and `fx-tap` have no rim. Hazard warnings are outlined in ink.
- Ground decals have no outline and no shadow.
- Icons come in two kinds. Chrome glyphs on `ui-icon-button` (`icon-close`, `icon-help`, `icon-home`, `icon-logbook`, `icon-pause`, `icon-play`, `icon-settings`, `icon-sound`) are two flat tones with no outline. Content icons (`icon-gear-*`, `icon-trait-*`, `icon-zone-*`, `item-*`, the badges' rings and the like) take `icon_edge`: two ramp steps darker, then on down the ramp until the outline holds 3:1 on cream and tan. A picture that fills its frame keeps a 1px clear ring for the outline.
- A gear item drawn at several sizes (`item-<gear>` at 32, `icon-gear-<gear>` at 16, `icon-gear-<gear>-20` at 20) keeps the same colours at each.
- Sprites carry no shadow; the game draws one in the road's darker ramp colour. The bouncing ball carries its own.

## Contrast

- Text holds 4.5:1 against what it sits on (3:1 at 2× and larger); essential icons and marks hold 3:1. Inactive controls are exempt.
- A state never relies on colour alone: it also changes shape (a tick, a hollow heart, a filled pip).
- The leash is a 1px line the game draws from the walker's hand to each collar: pink on the Distillery District, Kensington Market and Yonge Street; dred on High Park and The Beaches; plum on Cabbagetown. It is drawn over the dogs and their shadows and under the walker, here and in every composite (help pages, cards, the og-image).

### UI colour pairs

An effect's name beside its description sits on a pale pill in the effect's family, its name dark on it, so it reads the same on cream and on ink: 11px tall, the name inset 3px each side, the corners cut by 1px.

Names are `PALETTE` names in `src/ui/phaser/palette.ts`, or `K` names for the neutral greys and any colour it leaves out; ratios are WCAG.

| Pair                           | Ratio | Use                                                                                                                         |
| ------------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| amber on darkBrown             | 4.57  | Warnings, "You're fired!"                                                                                                   |
| amber on navy                  | 7.49  | `icon-pause`, `icon-play` on `ui-icon-button`                                                                               |
| cream on darkBrown             | 5.85  | Text on the wood                                                                                                            |
| darkBrown on cream             | 5.85  | Secondary text, empty heart outline                                                                                         |
| darkRed on cream               | 5.07  | Money lost, an unaffordable price or unlock line, full heart                                                                |
| darkRed on nlgrey              | 5.15  | Price on the short plate                                                                                                    |
| dlake on foam                  | 5.54  | A buff's name (gear, perk, upgrade) on its pill, beside its effect                                                          |
| forest on cream                | 5.39  | Money gained, an affordable price line, `ui-payout-label`, an earned badge's name                                           |
| forest on lime                 | 4.80  | Zoomies' name on its pill                                                                                                   |
| ink on deepAmber               | 7.91  | A picked picture's outline on its box                                                                                       |
| ink on green                   | 8.41  | `ui-button` `go` label, `ui-pet-shop` board, price on the buy plate                                                         |
| ink on ngrey                   | 7.23  | The emblem's silhouette on a `locked` badge                                                                                 |
| ink on nlgrey                  | 12.64 | The goal plate: a walker's name, a blocked slot's price, a disabled card's cost; an affordable picture's outline on its box |
| ink on nslate                  | 3.75  | A disabled picture's outline on its art box                                                                                 |
| navy on cream                  | 9.59  | `ui-scroll-track` on the shop card (its ink edge 12.44:1)                                                                   |
| navy on yellow                 | 11.13 | Spotlight's name on its pill                                                                                                |
| ndslate on cream               | 6.12  | A locked badge's name in the logbook                                                                                        |
| ndslate on ngrey               | 3.56  | Labels on `disabled` tiles and buttons (inactive, exempt), a `locked` badge's emblem                                        |
| ngrey on darkBrown             | 3.40  | `disabled` tile face on the wood                                                                                            |
| nslate on cream                | 3.32  | A locked badge's goal and progress in the logbook (inactive, exempt)                                                        |
| plum on amber                  | 7.35  | Text on amber: step number                                                                                                  |
| plum on cream                  | 9.42  | Body text on cream: panels, quips, hints, the zone banner, `normal` tiles and buttons                                       |
| plum on pink                   | 5.03  | Stinky's name on its pill, Stinky's "+$0" tip label                                                                         |
| plum on tan                    | 6.49  | Body text on tan                                                                                                            |
| plum on yellow                 | 10.92 | Text on a selected face (`ui-tile` `selected`)                                                                              |
| tan on darkBrown               | 4.04  | Empty slot dashed border, hollow page dots                                                                                  |
| tan on the dimmed road         | 3.0+  | 1px rim around the pause panel                                                                                              |
| `ui-difficulty` on cream       | 3.2+  | Filled paws plum-outlined (9.42); hollow paws a clay rim (3.2)                                                              |
| `ui-zone-pips` on cream        | 3.0+  | `todo` dashed; `<zone>` and `<zone>-done` rimmed darker than their well; `-done` ticked                                     |
| walnut on tan                  | 7.48  | Muddy's name on its pill                                                                                                    |
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

- Art inside a disabled tile draws from its grey copy in the neutral ramp, each colour at the step nearest its brightness, on an nslate box; a normal tile's box is tan, a selected one's deepAmber. The padlock and the bill keep their colours, and an affordable item's picture keeps its colours on an nlgrey box, lighter than the tile, where a short one's grey copy sits on the darker nslate (see below). A normal tile's lip is brown, not the chrome's tan, so the tan box sits apart from it.
- An item for sale is owned (no badge, no plate), affordable (`icon-bill` and the green buy plate) or short (`icon-lock` and the nlgrey short plate), told apart by badge shape and plate, never by colour alone. An item not owned draws on a `disabled` tile or row, with its name, on the start screen and in the Pet shop: its portrait or icon in full colour while the bank covers it, from its grey copy while short. A walker not owned and a slot that needs the one before it are short whatever the bank holds, with the goal plate.
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

- The walk bar is plum wood with an ink cash well, a neighbourhood well (the zone's name in cream `font-body`, "n of N" right-aligned in grey) and six `ui-effect-well`s holding the effects' `-20` icons: the perk, the Pocket, the found item (a gear drop), then three upgrades. The 16×16 icon keys stay for the message strip, the shop and the cards.
- A `ui-debuff-bar` (360×16) per active debuff sits under the walk bar, its face, shade and fill in the debuff's colours: muddy brown, dbrown and tan with an ink name (4.66:1); stinky mauve, purple and pink with a white name (4.70:1); zoomies green, forest and yellow with an ink name (8.41:1); spotlight blue, navy and yellow with a white name (8.48:1).
- `ui-dog-card` (120×70) is a file card in the neutral `ui-section` look so the eye stays on the road: a navy face, the dog's photo and the owner's photo (`face-owner-<dog>-20`) with the owner's name in tan and hearts as `ui-heart` `full-dark` and `empty-dark`. The `empty` card (a fired dog's) is the same frame in dslate with the FIRED plate across the photo. `ui-dog-card-warn` pulses at 1 ♥ (`static` with reduced motion); `heart-loss` fills only the hearts area, never the card's edge, so `ui-dog-card-warn` stays the card's only border.
- `ui-owner-tab` pops in centred on a card's top edge when its dog's hearts change or the dog is fired. An owner's quip on the walk is a message strip line led by their face (`face-owner-<dog>-20`, framed in ink over tan) with their name under it in rust.

### Choice cards

- Band colour by what opened the card: dred for an obstacle's encounter, purple for a fork's route.
- Illustrations are road sprites at 1× on a scrap of the zone's ground, with no walker: a leash runs off the bottom edge. The ground keeps only its paving and joints, with no lane marks or flecks, and a path card's ground has no lone pixels. Each picture has one subject, usually Archie and the one thing he meets, with at most two small accents (hearts, a !, an arrow).
- An encounter in more than one neighbourhood takes a setting that fits each of them: `card-cheese-crates-<option>` sets its crate at a brick shopfront's wooden door over stone paving.
- The thief carries the walker's tip pouch he snatches, a green cloth drawstring pouch with a yellow coin on it, on his road sprite, his cards and `fx-hit-thief`, never the snatchers' grey-brown loot bundle. On the road it dangles by its drawstring from his fist inside his outline, so it never reads as a pickup, and is never smaller than 7×9, so it reads at `@50`.
- A lucky find's popup art (`card-lost-wallet-keep`) shows the one thing found, close up and larger than its road sprite, with no person. `card-petting-neighbour-take` is the exception: the find is the neighbour. Both pop up over the road with no background, cut out on transparency with no ground or shadow, their sparkles yellow so they read on every road.
- The art window is centred on the card's face: `card-frame` 17,15 77×58 with the illustration at 18,16; `card-frame-large` 6,30 154×116 with the illustration at 8,32.
- A path card (`card-zone-<zone>`) samples its road strip to a cross street and repeats its backdrop's sky and scenery in miniature.

### Hits and moments

| Event         | Shows                                                                                                                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 ♥           | Owner's `worried` face and `ui-dog-card-warn`                                                                                                                                                                                                                   |
| Encounter hit | `fx-hit-<encounter>` over the pack; `ui-hit-flash-<colour>` at the edges (other dog pink, puddle sky, skunk mauve, squirrel orange, thief amber); the label at 2× on `ui-hit-label`                                                                             |
| Fee payout    | `fx-coin-fly` to the bank under `ui-payout-label`                                                                                                                                                                                                               |
| Firing        | Owner's `fired` face at 2× on `fx-fired-pop` at 2×; the fired line in `ui-quip`; `ui-fired-plate`                                                                                                                                                               |
| Heart change  | `fx-heart-loss` or `fx-heart-gain` `pop` over the dog, then `fly` into its card; on a loss the card plays `heart-loss`                                                                                                                                          |
| Mover hit     | `fx-bump-big` centred 6px above the struck dog's top opaque row; the dog plays `react` and flashes white twice                                                                                                                                                  |
| Moving hazard | `ui-warning` and `ui-warning-arrow` at the lane edge about 1s ahead: `pulse` for a crosser, `down-pulse` for a mover coming at the pack, `up-pulse` for one moving off ahead; `ui-warning-wander` over a wanderer                                               |
| Pickup        | `fx-sparkle`                                                                                                                                                                                                                                                    |
| Plain hit     | `fx-bump` 6px above the struck dog's top opaque row, the obstacle's debris over it (`fx-debris-leaves` for a hedge, `fx-debris-litter` for a trash can); a dog that dodges (small dogs always; medium and large ones with the Whistle) plays `fx-dodge` instead |
| Puddle        | `fx-splash` on the touching dog's feet; `ui-hit-flash-sky`; walker `stumble`; dogs `react`, then `shake`                                                                                                                                                        |
| Treat given   | `fx-treat-pop` and the owner's `happy` face                                                                                                                                                                                                                     |

- Hit effects draw over every road sprite and the pack. The pack is always drawn at full size, so they have no depth variants.
- Each `ui-hit-flash-<colour>` pairs a light ink, holding 3:1 or more on the dark roads, with a dark fringe on its inward edge for the light roads. Mauve, under 3:1 on dslate, takes a pink rim (one step up its ramp) on its inward edge.
- With reduced motion a bump or splash holds its peak frame (`fx-bump` and `fx-bump-big` frame 1, `fx-splash` frame 2); debris, shakes and `react` are skipped, and the white flash is one 120ms blink.
- Each message strip line leads with a 16×16 content icon (`icon-bump`, `icon-treat`, `icon-last-heart`, `icon-fired`, the debuff's icon, `icon-lucky`, `icon-trait-chaser`, `icon-hint`).

#### Comic words

One word per moment, 2 to 7 letters, readable at 1×, built like the sign logo: flat yellow letters 7 rows tall with 2px stems, a 1px ink ring that also fills the counters and the gaps between letters, and a solid dred shadow 2px down and right. No sprite carries a word: the game sets it in `font-comic` over the effect (WOOF! for `fx-bark`, DODGE! for `fx-dodge`, SNIFF!, PHEW! and YOINK! over the `fx-hit-*` bursts). Every `fx-hit-*` opens on an impact frame: an eight-point star in the encounter's colour with a white core. With reduced motion no word shows.

### Road movers

- Crossers are side views facing right, mirrored for left. Anything coming down a lane at the pack faces the player (`cargo-bike`, `cyclist`, `jogger`, `kid-on-bike`, `minor-scooter`'s `ride`, `pedicab`, `rollerblader`); anything going up a lane ahead of the pack, or slower than the road, is seen from behind (`ice-cream-truck`, `streetcar`, `stroller`, `ttc-bus`). `coyote` steps toward the pack in any direction, so it is three-quarter front, angled right and mirrored for left. `snatch-raccoon`'s `stalk` and `step` are the coyote's creep and lunge on all fours, face on, so a step either way needs no mirroring.
- `cargo-bike`, `cyclist`, `delivery-cyclist`, `kid-on-bike`, `minor-scooter`'s `ride` and `pedicab` carry a lit headlamp on the front of the bike or vehicle (`headlamp` in `art/tools/road.py`): a white core 2 design pixels across, 3px from `@75` up and never under 2px, in a 1px cream ring with its corners clear, drawn only over the sprite's own pixels so the silhouette stays as it is. It is white, never gold, so it never reads as a pickup, and the game's light layer starts each headlight cone from it. A tag seen from behind has none.
- Each neighbourhood has its own road objects, drawn in `art/tools/hood_parks.py` (Cabbagetown, High Park), `hood_markets.py` (Distillery District, Kensington Market) and `hood_city.py` (The Beaches, Yonge Street), and its own road people in `hood_people.py`. Each reads apart from the object it could be taken for:
  - `barrel-stack` is three barrels in a pyramid on a pallet, their ochre heads to the camera in silver hoops, unlike the lone upright `curb-barrel` on the verge and the single dark brown head of `rolling-barrel`.
  - `cargo-bike`'s flower box hides the rider's legs, unlike `cyclist` and `kid-on-bike`.
  - `dropped-cone`'s cone lies on its side, unlike `cone`.
  - `fallen-log` is dark ridged bark with a pale ringed sawn end and no legs, unlike the tan slatted `bench` and the green `hedge`.
  - `green-bin` lies knocked over on its front, its lid propped open and a wheel up, scraps and a banana peel spilling out, unlike the upright `trash-can`.
  - `iron-fence-2` and `iron-fence-3` are black iron pickets between ball-capped posts on a pale stone curb, unlike the brick and white newel posts of `porch-steps` and the green `hedge`.
  - `little-free-library` is a house-shaped cabinet under a pitched roof with book spines behind its glass door, unlike the flat-topped, painted `curb-utility-box`.
  - `newspaper-box` is three chained boxes in bold colours on a concrete pad, a lane wide, unlike `curb-mailbox`, a single red box under a dome with no window.
  - `porch-cat` is a white calico, unlike the tuxedo `chase-cat` and the ginger `ambient-cat`.
  - `produce-crates` has no awning or posts, unlike `roadside-fruit-stand`.
  - `ttc-bus` has a white upper body, a roof pod and tires and no pantograph, unlike `streetcar`.
  - `volleyball-net-2` and `volleyball-net-3` are open coal mesh under a white top band between white posts, red and white antennas over the ends and sand underneath.
- `tourist` and `couple` step facing the player like `mail-carrier`; `delivery-cyclist` faces the player like `cyclist`, told apart from it and `kid-on-bike` by its turquoise box; its `merge` leans the bike and box right about the handlebar, the tire swinging out left and the head upright. `segway-rider` faces the player like `cyclist` but stands upright between two tires, told apart from `minor-scooter`'s white helmet by its hi-vis yellow vest and the orange pennant on a whip pole over its shoulder. A busker's case holds sheet music and a sign, never coins, which read as pickups.
- `sign-spinner` and `hopscotch-kid` hop a lane at a time facing the player, drawn hopping right and mirrored for left. `hopscotch-kid` is drawn shorter than the adults, as `dropped-cone`'s kid is, and told apart from that kid and `kid-on-bike` by its pink striped top, azure skirt and auburn ponytail.
- `stilt-walker` steps facing the player like `couple`, drawn 48×96 so it stands a head and a half over every adult mover; its striped trousers run down over the stilts to the shoes, so no stilt shows.
- `capybara` and `porch-cat` are side views facing right, never mirrored while they stand.
- `granny-cart-shopper` wanders facing the player like `mail-carrier`, never mirrored, her cart beside her on the screen right. Its red and green tartan cart and long camel coat tell it apart from `strolling-busker`, `food-cart-vendor`'s churro cart and `couple`'s red sweater.
- `rollerblader`, `pedicab` and `cargo-bike` come down their lane facing the player; `ttc-bus` is slower than the road, so it is seen from behind; `porch-cat` and `capybara` are side views facing right, never mirrored while they stand.
- `granny-cart-shopper` wanders like `mail-carrier`: drawn facing the player with her cart beside her on the screen right, and mirrored for a step left, as every stepper is. Its red and green tartan cart and long camel coat tell it apart from `strolling-busker`, `food-cart-vendor`'s churro cart and `couple`'s red sweater.
- `squirrel`, `squirrel-dash`, `icon-trait-chaser` and `badge-squirrel` are Toronto's black squirrel (`SQUIRREL_FUR` in `art/tools/road.py`), lit by `LIT`'s rim. On the road it is small in its 48×48 frame: its body, without the tail, stands about 20px, under the smallest dog's and no bigger than the rabbit's, and its bushy tail, its tip flicked over, carries the silhouette.
- `hen` is a Riverdale Farm hen got loose, a Rhode Island Red (`HEN` in `art/tools/hood_parks.py`): a crosser drawn and timed like `squirrel-dash`, a little taller, its rust body, plum tail, red comb and wattle and yellow legs reading apart from the black squirrel. It runs flapping, its neck stretched forward, and its raised wing and comb carry the silhouette.
- `ferrets` is a sable and a champagne ferret bounding nose to tail across 2 lanes (`SABLE` and `CHAMPAGNE` in `art/tools/hood_parks.py`): a crosser timed like `chase-cat`, long and low with masked faces, its arched back carrying the silhouette, unlike the upright ears of `chase-rabbit` and the black squirrel's bushy tail.
- `pull-out` and every `drive` are 4 frames at 100ms and every `ride` 4 frames at 90 to 120ms, tread lines rolling 1px a frame; `pull-out` is drawn pulling right with the right indicator blinking, mirrored for left.
- The warning cues are yellow, ink outlined, 16×16, 2 frames at 250ms.

### Zone celebration

After zones 1 to 3, over the road view dimmed as under a card: the walker cheers at 2× in front of `ui-celebrate-burst` while about 60 `fx-confetti-bit` fall, under a big line in `font-display` at 2× and a small one in `font-display-cream`. Text on the bubble and the plate is plum on cream, money forest. The layout is in `src/hud/celebrationLayout.ts`. With reduced motion there is no confetti and the walker shows `cheer` frame 0 in place.

## Badges

`badge-<achievement>` medals are 32×32: a ring in the tier colour around a cream face with the goal's emblem (`art/tools/badges.py`). No two badges share a motif, so all 40 read apart at 1× on the badge wall's cream panel. Each emblem is one object, with no scene or filler round it, and shows only what is in the game.

- Tiers: firsts bronze, mastery silver, collection gold, legend purple with gold studs, silly pink. Legend is the one hardest badge, Legend of the Leash. Silly is the joke tier, earned by mishaps and running gags; pink marks a joke, never a rank.
- Every ring is a base, a shade on its lower right, a light on its upper left and twelve rivets in the shade. The face is flat cream with a 1px tan crescent along its lower right, so the emblem stands on one quiet colour.
- `locked` is in the neutral greys: an ndslate ring (ink shade, nslate light), an ngrey face and the emblem a two-tone ink and ndslate silhouette under a small amber padlock, so a locked badge never reads as silver.

## Animation

- Animation names are Aseprite tag names. New tags go after existing ones so frame indices hold. Motion is in whole pixels.
- Walkers are seen from behind: `walk` 4, `react` 2, `stumble` 4 and `idle` 2 frames, no gear variants. `wave` and `cheer` face the camera.
- Road people and walking animals take the walkers' stride in `walk`: 4 frames (100ms; `capybara`, `couple`, `stroller` and `tour-group` 160ms like the walkers, `stilt-walker` 150ms, `coyote` 120ms), a foot lifted, both feet 1px up as the body passes 1px higher, the other foot lifted, passing again.
- Dogs are seen from above and behind. `walk` is a trot: diagonal leg pairs swap (all four paws show, a long coat's front paws peeking out beside the chest), the body bobs on the passing frames with the ears lagging 1px, the tail wags. `pull` leans right and is mirrored for left. `shake` runs at 60ms.
- Every road sprite that stands or waits, depth variants included, loops an `idle` with frame 0 the rest pose. Reduced motion shows frame 0.

| Idle      | Frames | Timing       | Motion                                                                                                                |
| --------- | ------ | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Dogs      | 4      | 300ms        | Tail at −1, 0, +1, 0; the body 1px higher on frames 1 and 2, feet planted; the right ear 1px higher on the last frame |
| Obstacles | 2 to 4 | 350 to 500ms | A small event (glint, lid, drip, leaves, hazard lights); rest pose most of the loop                                   |
| People    | 2      | 400ms        | Breathing: the body 1px higher on frame 2, feet planted, arms at rest                                                 |

- A performer's idle is its act, at the act's own frames and pace: the buskers strum, `sign-spinner` twirls its sign, `stilt-walker` waves.
- `cheese-crates` is the one obstacle with no rest in its `idle`: its stink wisps rise a quarter wave every frame, since the smell is what the card is about.

## Depth scaling

Road sprites have redrawn depth variants at the steps in `shared/depth-steps.json`, every 1/16 from 15/16 down to 1/2: `<key>@94`, `@88`, `@81`, `@75`, `@69`, `@62`, `@56` and `@50`, each floor(size × scale + 0.5) with the original's tags, frames and durations, a full 1px outline, and 1px motion kept at 1px. The game draws a sprite smoothly from the smallest of its steps at least its true size, scaled down by at most 1, so it never swaps to a smaller step as it approaches.

`art/tools/pixel.py` settles every variant as it builds, larger steps first, so no variant is bigger than its ideal (the full size at its scale, rounded half up) or than a larger step, a fill pixel that a row or column it takes out leaves touching transparency takes the outline colour beside it (unless that would take out a 1px feature, such as a sparkle's centre), and its feet line moves less than 1px at a switch (the rules are in `depth_settled`). A set whose variants depend on another set's (`hazards.py` and `depths.py`) settles on that set's exports, so after changing either, build both again until neither changes.

## Road strips

- 320×64 (`art/tools/roads.py`), tiling vertically with no seam: patterns repeat every 64 rows or a divisor of it.
- The base is the zone's road colour (`src/data/world.ts`), so the game's shadow, one ramp step down, matches. Base (shadow): Cabbagetown grey (slate), High Park tan (brown), Distillery District dslate (navy), Kensington Market stone (dstone), The Beaches cream (tan), Yonge Street shale (coal). Every road sprite's light rim holds on shale at least as well as on dslate.
- The four lane dividers sit at x = 64k−1, 2px wide, one look per zone. Kensington Market paints each divider its own dark colour (`LANE_PAINT` in `roads.py`: dbrick, navy, fir, plum), each holding 3:1 on its stone, none of them gold, amber or orange, which read as coins.
- Curbs and verges stay inside the outer 5 to 8px of the strip, clear of the 8px each side of a 48px sprite in its lane.
- Every zone has a start strip: a neutral cross street (near curb, asphalt with a zebra, far curb) on rows 20 to 63 and the zone's strip on rows 0 to 19, so it follows any zone at a fork.
- The rows from the road's far edge down to about y 214 sample the strip shrunk 4×, so lane dashes and texture along the road repeat every 8 rows or more, lines across the road are at least 2 rows tall and low in contrast, fine detail runs along the road, and small texture is spaced irregularly.
- Texture on the road is sparse grit of 2px or more, with no single-pixel specks and no grit lighter than a pale road (Cabbagetown's grey): either shimmers as the road scrolls and competes with the road objects.
- Leaves on the road are never gold, amber or orange, which read as the tip coin: Cabbagetown's are green (moss, olive, dolive).
- Joints and seams across the road repeat every 32 rows (`SEAM_PERIOD` in `roads.py`) or not at all: the road scrolls up to 11 px a frame at 30 fps, and a shorter period strobes, its motion seeming to stall or reverse. Paving with short joints lays them along the road, each column's joints at its own row.

### Verges

The game draws the verge beside each road: the curb, any strips, the sidewalk or paving with a seam across it every `seamEvery` road px, then the lawn. `seamEvery` is 32 on every verge, as the road's joints: a shorter period strobes as the road scrolls, and far rows, which each cover up to 16 road px, draw a seam on nearly every row, a dark band. They are `VERGES` in `art/tools/backdrops.py`, keyed by art id with colours by `K` name; `backdrops.py build` and `verges --write` write them to `shared/verges.json`, which the game reads, and each backdrop's approach rows paint the same verge.

Each neighbourhood's verge has its own colour family: Cabbagetown stone sidewalks and olive lawns, High Park pine woods with bark patches, the Distillery District brown pavers in dbrown courses, Kensington Market near-black walnut paving in coal joints behind a driftwood curb and a dstone gutter, The Beaches driftwood sand and Yonge Street dslate pavement. Dots on the paving are single pixels that shimmer as the road scrolls, so they cover 6% or less of it. A verge's base is a mid tone or among the darkest. An ambient person or lawn animal holds 3:1 on 87% or more of its edge pixels (opaque pixels beside a clear one) on the mid tones (stone, olive, brown) and on all of them on driftwood and grey. On the darkest (pine, bark, dslate, walnut) its outline does not hold and the light rim or fill just inside it holds on 59% or more. A tone between them (brick, dbrown, dolive, dstone, ash, mauve, slate, violet) holds neither, so it is kept to curbs, strips, seams, flecks and Cabbagetown's mown stripes.

Lights are additive glows the game draws over the road, the backdrop's approach and the shadows, under every sprite (`shared/lights.json`, which art writes). Each def is an `ellipse`, `band` or `cone` `width` by `height` px at full size in a palette `colour`, with 1 to 3 hard `rings`, outermost first, each inside the last and brighter; each pixel adds its innermost ring's `strength` of the colour, so the ground's seams and dots show through and a light never reads as a mat or a puddle. A sprite carries its lights in `attach`, set out as for a prop on the road's right (a prop on the left mirrors them), each limited to its `zones` and pulsing with the sprite's idle where it lists a `pulse`. Light reads only on dark ground (Yonge Street's dslate and shale, Kensington Market's walnut, the Distillery District's dslate road); on mid and pale ground it reads as a stain, so Cabbagetown's lamps take a softer pair and the day neighbourhoods take none. Glows are amber, never cream or gold, which read as grey or khaki wedges on dark ground; tail lights are red. Each street and gas lamp throws a pool under its bulb and a beam from the bulb across the road; Kensington Market's shopfronts spill window light onto the paving; in Yonge Street and Kensington Market, taxis, buses, streetcars, trucks and the parked car throw a red wash behind them. A cone shines from a lit pixel of its sprite, its bulb. Verges carry no lights.

## Roadside

The verges stay clean: bare lawn or paving beyond the sidewalks with the odd prop. `art/tools/roadside.py` draws the props and holds the per-zone placement table (`PLACEMENT`), which `roadside.py table --write` (and `build`) writes to `shared/roadside.json` for the game.

- Sprites are `roadside-<name>`, with `@94` to `@50` variants, laid out on a design grid and drawn at 1.5×. They are front elevations, never flipped, outlined with `road_edge` and no light rim.
- Each prop has one `idle` tag: a still frame, unless it has a light or a flag (a street lamp's lenses fade off and on, a gas lamp's flame dips, a shop sign or a pay station's screen dims, the Leuty's flag ripples). That loop runs 2 to 5 s with frame 0, the rest pose, holding most of it, and steps away and back in 3 or 4 drawings over 2 s or less: colour steps in 2px clusters, never a hard blink, never brighter than the rest pose, and nothing that reads as a coin or a pickup's sparkle, so the verges never pull the eye from the road. The game starts each placed prop at its own point in the loop, and reduced motion holds frame 0.
- The Beaches' umbrellas and chairs come in three colourways, apart from the yellow and white umbrella on `lifeguard-chair` and the red and white one on `beach-umbrella`: blue (azure and white), coral (turquoise and pink) and green (green and yellow). Each colourway is its own key, `roadside-beach-umbrella-<colourway>` and `roadside-beach-chair-<colourway>`. A roadside umbrella stands alone, or with a chair, and leans left; `beach-umbrella`, the road object, leans right, and is set up as someone's spot with a mound of sand, a striped towel and a cooler, and takes the road objects' lit rim.
- A prop never reads as something on the road: no person, no animal on the ground, no coin or bone, and each differs from the road object it could be taken for (the fruit stand has no wheels, unlike the hot dog cart; the ice cream stand has no wheels, unlike the ice cream bike and truck; the transit stop has no shelter; the Garden Car is heaped with flowers, its wheels sunk in plants, unlike the parked car; the mural wall's dog is a flat painting framed by brick piers; the street lamp lights both ways, since a prop is never flipped; the café patio is a table between two chairs on no wheels, unlike the hot dog cart under its umbrella; the beach chair is a low folding chair, unlike the lifeguard chair's tower; the shopfronts' clothes hang behind their window glass, unlike the clothing rack out on the road; the mailbox is one domed box with no window, unlike the row of newspaper boxes; the utility box is a flat-topped painted cabinet on a footing, unlike the round green trash can).
- Each side has a slot every 140 road px, slot n at z = 140n. With m = n − offset (left 0, right 1), an even m is a lot and an odd m a gap, and k = floor(m / 2); a side takes gap (gapStart + k) mod 6, left gaps starting at 0 and right at 2. Every lot is empty; gap 0 holds the neighbourhood's tree or street furniture and gap 3 its own prop, so each side has a prop every 6 slots and over both sides one stands every 420 px. Kensington Market, The Beaches and Yonge Street run 12 gaps (gap (gapStart + k) mod 12), so over both sides one prop stands every 210 px. Kensington Market: `shopfront-violet` in gaps 0 and 9 and `shopfront-ochre` in gap 6, `fruit-stand` in gap 3, `cafe-patio` in gaps 1 and 7 and `mural-wall` in gaps 4 and 10. The Beaches: `leuty` in gaps 0 and 6, `dune-grass` in gap 3 and `ice-cream-stand` in gap 9, and its beach props in the rest but one between each pair (gap 1 a blue umbrella with a blue chair, gap 4 a coral umbrella, gap 7 a green umbrella with a green chair, gap 10 a coral chair). A chair beside an umbrella stands 12 px nearer, on its road side, under the canopy. Yonge Street: `street-lamp` in gaps 0, 1, 4, 6, 7 and 10, a row of lamps, and `transit-stop` in gaps 3 and 9.
- Every frame's inner edge is at across 212 or more, past the sidewalk's outer edge at 208. No prop stands within a zone's start strip.
- Curb props are `curb-<name>`, drawn the same way: small street furniture on the sidewalk or paving, each frame wholly inside the zone's curb band (from 2 road px past the curb or its strip to 2 px inside the sidewalk's outer edge; paving out to the screen's edge counts as a 44 px sidewalk). Each stands at the band's middle, half a slot (70 px) further than the lawn props, and on each side every other slot holds one, the zone's own in turn (Kensington Market's three, every other zone's two), the sides alternating, so over both sides one stands every 140 px. High Park's lawn starts at the curb, so it has none. None reads as a road obstacle: no trash can, cone, bench or fence.
- Free-standing props take the road objects' ground shadow in the zone's `shadowColour`, a darker tone of its lawn or paving.

| Neighbourhood       | Gap 0              | Gap 3           | Curb                                  | Shadow |
| ------------------- | ------------------ | --------------- | ------------------------------------- | ------ |
| Cabbagetown         | `tree-maple`       | `gas-lamp`      | `hydrant`, `urn`                      | dolive |
| Distillery District | `gas-lamp`         | `love-lock`     | `barrel`, `bollard`                   | dbrown |
| High Park           | `tree-oak`         | `hot-dog-stand` |                                       | fir    |
| Kensington Market   | `shopfront-violet` | `fruit-stand`   | `bike-ring`, `utility-box`, `mailbox` | ink    |
| The Beaches         | `leuty`            | `dune-grass`    | `rope-posts`, `life-ring`             | stone  |
| Yonge Street        | `street-lamp`      | `transit-stop`  | `pay-station`, `bike-ring`            | navy   |

## Ambient

People, traffic, lawn animals and sky movers that pass by with no collisions and no card (`art/tools/ambient.py`), outlined with `road_edge` and lit with the rim on their dark parts. Side views face right; the game flips them to go left. The sky movers fly far back across a neighbourhood's sky, outlined in ink, with no depth variants. A sprite that rests has its `idle` first. Each differs from the road sprite it could be taken for: the cyclist's colours from `cyclist`'s, the bus (side on, on tires, with no pantograph) from `streetcar`, the lawn animals from the chase animals, and the pedestrian carries nothing and walks no dog, so it never reads as an owner, a walker or a hazard.

## Backdrops

Backdrops are 360×158 on screen rows 48 to 205 (`art/tools/backdrops.py`); band row y is screen row 48 + y. The band, its approach rows and the camera come from `shared/export/layout.json`. The street ends at a T-junction: the approach rows continue the road's projection (in play the road surface scrolls over them), and above them runs a flat cross street, beyond which the far side faces the camera. The tool's docstring lists the rows.

- The debuff bars and the message strip lie over the band's top rows (the strip on rows 6 to 57, while a message shows), so the sky above row 45 is one flat colour and each neighbourhood's main read stays below the strip. Any neighbourhood's skyline may rise above row 45, under the bars' and the strip's opaque plates, where scenery that rises into the strip still reads half covered: Cabbagetown's old trees, the Necropolis chapel's spire and the far downtown towers, the CN Tower among them, with its first stars above them; and Yonge Street's skyline, moon and stars.
- Darkness varies: The Beaches bright and open, the Distillery District at golden hour, High Park under a clear blue sky, Cabbagetown at dusk, Yonge Street an evening downtown and Kensington Market darkest, a Pedestrian Sunday at twilight.
- The CN Tower is huge and close on Yonge Street's skyline, the tallest structure in the city: its antenna runs off the band's top over the SkyPod and its window ring, the main pod, 43 wide with its lit window rings in 2px clusters, sits near the top, and the shaft flares from 9 columns under the pod to 29 at the street, widening faster toward its foot as the real tower's three legs do. The other towers step up toward the top third below the pod, and those either side of its shaft stay low. The message strip covers band rows 6 to 57 while a message shows, so the screens and signs sit below row 57.
- Yonge Street's night is lit in big, clean shapes, never speckle: windows in 2×2 blocks lit in runs along each floor, the 2× LIVE! screen and its ad screens, a WOOF! screen on the glass tower at the left, 2px marquee bulbs (the EATON CENTRE sign, the ELGIN blade, the SHOW marquee), the street's glow a ramp step up the towers' feet, and each lit podium's light on the far sidewalk. It is seen from far off: building masses, lit window runs, screens and signs, with no doors, shopfronts, awnings or people; the Eaton Centre is one huge glass mall under its galleria vault, with no entrance.
- Houses on the far side are slim, about as tall as they are wide, under a gable that rises about a row for each column it narrows, past 2px eaves. Light comes from the top left: the roof's left edge a ramp step lighter, the wall's right 3 columns a step darker. Trees, hedges and side yards fill the gaps, and the end houses run off the band's edges so the street carries on. Houses further back are smaller and show between the near roofs.
- Kensington Market's far side is a worn row of two-storey Victorians turned shops: paint a step darker and greyer than the brights (`WORN_WALL`, `WORN_ROOF`), no green wall or roof, sun-faded awnings, 2px soot streaks and a dirty band along each wall's foot, hydro poles with 2px wires, and throw-ups drawn in 2px strokes. Empty crates and vintage rails stand out front; no plants.
- Kensington Market's laneway murals at the band's edges are painted a ramp step darker than `MURAL`, so they sit behind the shopfronts.
- The approach rows carry no static scenery. The near corners and the stub's verges show only their ground (lawn, paving, sidewalk and curb, as the verge paints them): the game's road begins there and its items spawn over them, so no perch, ornament, tree, lamp, bench, sign or other prop stands there. Everything static stands at or beyond the cross street, and no static vehicle stands on it: the ambient traffic drives there, so a jam (Yonge Street's side street) stays beyond the far sidewalk.

## Skies

- Each neighbourhood has its own sky, flat above `CALM` (70 rows over the far side's ground row) but for what rises into it: Cabbagetown's trees, spire and downtown towers; and Yonge Street's towers. Ink edges hold 3:1 or more on every sky but Kensington Market's violet and purple (2.8:1 and 2.0:1), where a sky mover reads by its fills.

| Sky                                   | Bands or colours                                                     | Where                                          |
| ------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| Cabbagetown (dusk)                    | lilac, pink, peach, gold bands; a crescent moon and the first stars  | `backdrop-cabbagetown`, `screen-end` (no moon) |
| Distillery District (golden hour)     | peach, orange, amber bands; a sun low over Trinity Square, gulls     | `backdrop-distillery-district`                 |
| High Park (deep clear blue)           | azure over sky, white clouds                                         | `backdrop-high-park`                           |
| Kensington Market (twilight sunburst) | flat purple rays over violet from the end of the street (`sunburst`) | `backdrop-kensington-market`                   |
| The Beaches (late afternoon)          | gold over yellow, small clouds and gulls                             | `backdrop-the-beaches`                         |
| Toronto at night                      | navy, purple, mauve bands; a crescent moon, stars in the navy band   | `screen-loading`                               |
| Toronto autumn day                    | foam over haze                                                       | `screen-home`                                  |
| Yonge Street (evening)                | slate, dslate, purple, mauve bands; a full moon and stars            | `backdrop-yonge-street`                        |

- A zone card repeats its backdrop's sky, bands and sun included.
- Banded skies are hard-edged horizontal bands of flat colour (`bands`), each 0.7 times the height of the band above it. Above each seam the lower band's colour runs a 1-row line 2 rows up, and another 5 rows up on a band 12 rows or taller. No gradients, no dither.
- The sun is a flat yellow disc (`sun`) whose lower half is cut by horizontal gaps that widen toward the horizon; it sits over the orange band, so the gaps hold against the yellow.
- Scenery against a band never shares its colour, and bands belong to skies only: never on sprites, UI or the road.

## Sound

- Soft chiptune: square, triangle and pulse waves and filtered noise through gentle low-pass filters, short envelopes, nothing harsh. A bright voice takes a second low-pass, so little energy reaches above 4 kHz.
- Hits and pickups under about 0.6s; `sfx-fired`, `sfx-badge` and `sfx-new-best` up to 2s.
- Clear on phone speakers: nothing shrill above 4 kHz, short tails. Each effect says what happened and differs from the others.
- Effects carry their energy above 300 Hz, where a phone speaker plays, and sit in one phone loudness band (`EFFECT_LUFS` in `sounds.py`), with `sfx-fired`, `sfx-badge` and `sfx-new-best` 2 LU louder.
- Each neighbourhood has its own walk loop (`music-<zone>`), 24 to 36s of whole bars and whole 1024-sample AAC frames, seamless, at an RMS of about −16.2 dB and within 0.5 dB RMS of the others so switching neighbourhoods doesn't jump. A loop has a clear melody over at most 3 or 4 pitched voices at once, percussion no denser than eighths for long stretches, and no fatiguing hi-hat, so it stays pleasant over an 8-minute walk.
- Files: effects under 50kB, music under 1MB, peaks below −1 dBFS after encoding, silence at both ends.
