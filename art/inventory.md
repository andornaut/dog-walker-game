# Art Inventory

Every art asset the game needs, derived from the rulebook in `../gameplay/game-design.md` and the run screen layout in `../tech-plan.md`. What is already exported is listed in `../public/art/manifest.json` and shown in the gallery at `/art/`. The rules every asset must follow live in `style-guide.md`. Keys are the `public/art/manifest.json` keys (kebab-case). Type is the manifest list: `sprite` (PNG + Aseprite JSON, animations from frameTags), `image` (plain PNG) or `font` (BMFont).

Priority:

- **M6:** in the Milestone 6 pixel pass (walker, 9 dogs, 9 owner faces, 5 encounters, 3 lucky encounters, 2 pickups, card frames, card illustrations for the 5 encounters, 3 lucky encounters and 6 forced stops)
- **core:** needed before the game ships, outside the Milestone 6 list
- **later:** nice to have; placeholders are acceptable

Sizes marked TBD depend on an open decision in the style guide.

## Screen budget

| Region      | Size (px)         | Notes                                      |
| ----------- | ----------------- | ------------------------------------------ |
| Canvas      | 360×640           | Portrait, nearest-neighbour scaling        |
| Top bar     | 360×40            | Money, zone progress                       |
| Backdrop    | 360×150 at y=40   | The zone's neighbourhood; scenery gags     |
| Dog column  | 80×450 at y=190   | 3 slots of ~72×146, 4px padding            |
| Road        | 280×450 at 80,190 | 5 lanes of 56px                            |
| Choice card | ~83×140           | Up to 3 across the road, 8px gaps, centred |
| Tile        | 32×32             | Road tiles, dogs, obstacles; ~12px margins |

## Characters (road)

Dogs are listed in their own section below. Each of the 9 dogs is a named character with its own road sprite, face and owner face.

| Asset             | Key                  | Type   | Size  | Animations                 | Priority | Notes                                                                                                                                                                    |
| ----------------- | -------------------- | ------ | ----- | -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Walkers           | `walker-<name>`      | sprite | 32×48 | `walk`, `react`, `stumble` | M6       | Seen from behind, all free: Casey (cap and hoodie), Ada (11, mixed race, long black curls), Ben (45, bald, chin beard, in black), Trista (50, teacher, dirty blonde bob) |
| Walker portraits  | `face-walker-<name>` | sprite | 32×32 | `happy`, `neutral`         | core     | Front view for the walker picker                                                                                                                                         |
| Other dog         | `other-dog`          | sprite | 32×32 | `walk`                     | M6       | Encounter obstacle (a corgi), led by `other-dog-owner`                                                                                                                   |
| Other dog's owner | `other-dog-owner`    | sprite | 32×48 | `walk`                     | M6       | Walks behind the other dog; the game draws the leash                                                                                                                     |
| Stinky effect     | `fx-stinky`          | sprite | 32×32 | `loop`                     | core     | Green stink lines over the pack while Stinky lasts                                                                                                                       |

## Dogs

Road sprites are seen from above and behind, like the walker. Small dogs sit well inside the 32×32 tile and big dogs fill it. Every road sprite has the animations `walk`, `react`, `pull` and `tell` (the lean and bark about 1s before a pull). Each dog's look (coat and accessory) must read on both its 32×32 road sprite and its face. Owner faces show the owner's job and temperament (laid-back, fussy or dramatic).

| Dog               | Breed           | Size   | Look                                  | Owner                                  | Road sprite    | Face                | Owner face            | Priority |
| ----------------- | --------------- | ------ | ------------------------------------- | -------------------------------------- | -------------- | ------------------- | --------------------- | -------- |
| Duchess (starter) | Maltese         | Small  | White coat, pink bow                  | Rosa, retired florist (laid-back)      | `dog-duchess`  | `face-dog-duchess`  | `face-owner-duchess`  | M6       |
| Biscuit (starter) | Beagle          | Medium | Tricolour, floppy ears, green collar  | Sam, barista (laid-back)               | `dog-biscuit`  | `face-dog-biscuit`  | `face-owner-biscuit`  | M6       |
| Koda (starter)    | Husky           | Big    | Grey and white, blue eyes, harness    | Jesse, trail runner (laid-back)        | `dog-koda`     | `face-dog-koda`     | `face-owner-koda`     | M6       |
| Nugget            | Pug             | Small  | Fawn, black mask, tiny bandana        | Kevin, pet influencer (dramatic)       | `dog-nugget`   | `face-dog-nugget`   | `face-owner-nugget`   | M6       |
| Zippy             | Jack Russell    | Small  | White with tan patches, red collar    | Mr. Pruitt, retired accountant (fussy) | `dog-zippy`    | `face-dog-zippy`    | `face-owner-zippy`    | M6       |
| Pierre            | Standard poodle | Medium | Apricot, show-clip pom-poms           | Madame Lefevre, dog-show judge (fussy) | `dog-pierre`   | `face-dog-pierre`   | `face-owner-pierre`   | M6       |
| Dash              | Whippet         | Medium | Grey brindle, knit sweater            | Ophelia, stage actor (dramatic)        | `dog-dash`     | `face-dog-dash`     | `face-owner-dash`     | M6       |
| Snowball          | Samoyed         | Big    | Fluffy white, collar with a bell      | Tiffany, wedding planner (dramatic)    | `dog-snowball` | `face-dog-snowball` | `face-owner-snowball` | M6       |
| Waffles           | Saint Bernard   | Big    | Brown and white, little barrel collar | Dr. Hughes, dentist (fussy)            | `dog-waffles`  | `face-dog-waffles`  | `face-owner-waffles`  | M6       |

Starters come first: they are the dogs every new player sees.

## Obstacles and forced stops (road)

| Asset             | Key                | Type   | Size  | Animations           | Priority | Notes                                                                                                   |
| ----------------- | ------------------ | ------ | ----- | -------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| Skunk             | `skunk`            | sprite | 32×32 | `idle`               | M6       | Centred on its spray cloud                                                                              |
| Skunk spray cloud | `skunk-cloud`      | sprite | 88×88 | `loop`               | M6       | 2×2 lanes and rows; dithered haze drawn under the skunk; the hit box                                    |
| Squirrel          | `squirrel`         | sprite | 32×32 | `idle`, `run`        | M6       | Harmless scenery when no chaser is in the pack                                                          |
| Puddle            | `puddle`           | sprite | 88×32 | `idle` (shimmer)     | M6       | 2 lanes. Ground decal: no outline, no shadow, drawn under everything; cards draw their own 32×16 puddle |
| Thief             | `thief`            | sprite | 32×48 | `walk`, `flee`       | M6       | Pickpocket; flees from a pack with a big dog, with no card                                              |
| Stop sign         | `stop-sign`        | sprite | 32×48 | `idle`               | M6       | Forced stop                                                                                             |
| Chatty neighbour  | `chatty-neighbour` | sprite | 32×48 | `wave`               | M6       | Forced stop; holds a coffee mug                                                                         |
| Kid               | `kid`              | sprite | 32×48 | `wave`, `sad`        | M6       | Forced stop: wants to pet the dogs; shorter than the adults                                             |
| Ice cream truck   | `ice-cream-truck`  | sprite | 64×48 | `idle`               | M6       | Forced stop; two lanes wide                                                                             |
| Construction      | `construction`     | sprite | 56×32 | `idle` (lamps blink) | M6       | Forced stop: one lane of barrier; the game repeats it across the road                                   |
| Mail carrier      | `mail-carrier`     | sprite | 32×48 | `walk`               | M6       | Forced stop                                                                                             |

## Minor obstacles (road)

Bumped with no card. An obstacle n lanes wide and m rows long is drawn 56n−24 by 56m−24 px (one row is 56px of road); the drawn box is the hit box.

| Asset                | Key                      | Type   | Size          | Animations           | Priority | Notes                                         |
| -------------------- | ------------------------ | ------ | ------------- | -------------------- | -------- | --------------------------------------------- |
| Cone                 | `cone`                   | sprite | 32×32         | `idle`               | core     | 1 lane                                        |
| Bin                  | `bin`                    | sprite | 32×32         | `idle`               | core     | 1 lane; green wheelie bin                     |
| Hydrant              | `hydrant`                | sprite | 32×32         | `idle`               | core     | 1 lane                                        |
| Bench                | `bench`                  | sprite | 88×32         | `idle`               | core     | 2 lanes                                       |
| Hedge                | `hedge`                  | sprite | 144×32        | `idle`               | core     | 3 lanes                                       |
| Construction barrier | `barrier-2`, `barrier-3` | sprite | 88×32, 144×32 | `idle` (lamps blink) | core     | 2 or 3 lanes; Woof Way and Sniff Street Shops |
| Parked car           | `parked-car`             | sprite | 40×144        | `idle`               | core     | 1 lane by 3 rows, top-down, nose up the road  |

## Lucky encounters (road)

Good things to bump into; each opens a choice card.

| Asset             | Key                 | Type   | Size  | Animations      | Priority | Notes                   |
| ----------------- | ------------------- | ------ | ----- | --------------- | -------- | ----------------------- |
| Lost wallet       | `lost-wallet`       | sprite | 16×16 | `idle` (glint)  | M6       | Lying on the road       |
| Biscuit neighbour | `biscuit-neighbour` | sprite | 32×48 | `wave`          | M6       | Holds out a biscuit jar |
| Photo op          | `photo-op`          | sprite | 32×48 | `idle`, `flash` | M6       | Tourist with a camera   |

## Pickups (road)

| Asset | Key     | Type   | Size  | Animations    | Priority | Notes               |
| ----- | ------- | ------ | ----- | ------------- | -------- | ------------------- |
| Treat | `treat` | sprite | 16×16 | `idle` (bob)  | M6       | Bone or biscuit     |
| Tip   | `tip`   | sprite | 16×16 | `idle` (spin) | M6       | Coin or folded bill |

## Effects

| Asset           | Key          | Type   | Size  | Animations   | Priority | Notes                                                                                                                 |
| --------------- | ------------ | ------ | ----- | ------------ | -------- | --------------------------------------------------------------------------------------------------------------------- |
| Collision burst | `fx-bump`    | sprite | 32×32 | `play`       | core     | Impact star where the pack hits anything; plays as the card opens                                                     |
| Dizzy stars     | `fx-dizzy`   | sprite | 32×16 | `loop`       | core     | Circle over the walker while a minor bump locks lane input                                                            |
| Dropped tips    | `fx-coins`   | sprite | 32×32 | `play`       | core     | Two coins knocked loose on a minor bump, with the cause label                                                         |
| Puddle splash   | `fx-splash`  | sprite | 32×32 | `play`       | core     | Water thrown up when the pack runs through a puddle                                                                   |
| Pickup sparkle  | `fx-sparkle` | sprite | 16×16 | `play`       | core     | Treat and tip collected                                                                                               |
| Bark pop        | `fx-bark`    | sprite | 16×16 | `pop`        | core     | Over a dog during the pull tell, with the dog's `tell` lean                                                           |
| Heart up/down   | `fx-heart`   | sprite | 16×16 | `up`, `down` | later    | Floats from a dog slot. `up` pops in and rises; `down` cracks and the halves fall. Outlined, unlike the other effects |

Floating numbers (`+$2`, `-1 ♥`) use the pixel font, not sprites.

## Road and scenery (per zone)

| Asset          | Key                                    | Type   | Size                | Priority | Notes                                                                                                                                                                           |
| -------------- | -------------------------------------- | ------ | ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zone backdrops | `backdrop-<zone>`                      | image  | 360×150             | core     | woof-way, bark-park, sniff-street-shops, the-long-way-home; the bottom rows are the curb that meets the road                                                                    |
| Scenery gags   | `gag-cat`, `gag-sprinkler`, `gag-ball` | sprite | 24×24, 32×24, 14×14 | core     | In the backdrop band, no card, no collision: a cat on a fence (`idle` tail swish and blink, `react` ears up), a sprinkler (`spray`), a ball rolling along the sidewalk (`roll`) |

Four zones in a fixed order: Woof Way, Bark Park, Sniff Street Shops and The Long Way Home. Each zone needs a road that tiles vertically across the 280px road width, plus a few non-colliding scenery props at the road edges.

| Asset           | Key pattern          | Type  | Size   | Priority | Notes                                                                                                                                                |
| --------------- | -------------------- | ----- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Road strip      | `road-<zone>`        | image | 280×64 | core     | Seamless vertically; base is the zone's road colour; 2px lane dividers at x = 56k−1; drawn by `art/tools/roads.py`                                   |
| Zone transition | `road-<zone>-start`  | image | 280×64 | later    | Bottom rows are the previous zone's strip, top rows this zone's, joined by a crossing (kerb and zebra, stone sill, bricks on end); Woof Way has none |
| Scenery props   | `prop-<zone>-<name>` | image | 32×32  | later    | e.g. tree, hydrant, bench, shop awning, mailbox                                                                                                      |

Four zones give 4 road strips (core) plus 3 transitions and roughly 12 props (later). Milestone 6 can ship a single `road-street` and reuse it.

## Dog column

| Asset            | Key                 | Type   | Size             | Priority | Notes                                                                                                                                                                                                              |
| ---------------- | ------------------- | ------ | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Doghouse slot    | `ui-doghouse`       | sprite | 72×146           | core     | One per dog slot: a doghouse with the dog's colour roof (a tag per dog, plus `empty` for a fired dog); the dog peeks from the door, the owner sits in the window, hearts on the board. Layout in `art/tools/ui.py` |
| Dog faces        | `face-dog-<name>`   | sprite | 32×32            | M6       | 9 dogs; frames `happy`, `neutral`, `upset`                                                                                                                                                                         |
| Owner faces      | `face-owner-<name>` | sprite | 32×32            | M6       | 9 owners; frames `happy`, `neutral`, `upset`, `fired`                                                                                                                                                              |
| Happiness hearts | `ui-heart`          | sprite | 8×8 (TBD)        | M6       | Frames `full`, `empty`; up to 11 per slot (big dogs reach 10, +1 with the Lucky collar), so two rows; a number beside the hearts so the meter doesn't rely on colour                                               |
| Quip bubble      | `ui-quip`           | image  | 24×24 nine-slice | core     | Cream bubble with a round plum rim, 8px corners; `ui-quip-tail` (6×8) points left at the owner                                                                                                                     |
| Quip tail        | `ui-quip-tail`      | image  | 6×8              | core     | Points left at the owner's window; its right column covers the bubble's left rim                                                                                                                                   |
| Stinky badge     | `icon-stinky`       | image  | 16×16            | core     | Shown while the debuff lasts                                                                                                                                                                                       |

## Top bar

| Asset          | Key                | Type   | Size   | Priority | Notes                                                                                      |
| -------------- | ------------------ | ------ | ------ | -------- | ------------------------------------------------------------------------------------------ |
| Bar background | `ui-top-bar`       | image  | 360×40 | core     | Plum wood with ink wells for money, treats and zone; layout in `art/tools/ui.py`           |
| Money icon     | `icon-money`       | image  | 16×16  | core     | Reused in cards, shop and end screen                                                       |
| Zone progress  | `ui-zone-pips`     | sprite | 18×8   | core     | 4 pips 3px apart; frames `done` (ticked), `current` (the game fills it amber), `todo`      |
| Zone icons     | `icon-zone-<zone>` | image  | 16×16  | later    | Woof Way, Bark Park, Sniff Street Shops, The Long Way Home; drawn by `art/tools/glyphs.py` |

## Choice cards

Each card is a frame plus an illustration plus text drawn in the pixel font. The illustration is 75×56 at (5, 16) inside the 83×140 frame; `art/tools/cards.py` documents the rest of the layout.

| Asset          | Key                | Type   | Size    | Priority | Notes                                                                                                                                                             |
| -------------- | ------------------ | ------ | ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card frame     | `card-frame`       | sprite | 83×140  | M6       | Tags `encounter`, `lucky`, `stop`, `upgrade` (band colour); the game greys out disabled cards with the palette's grey ramp and outlines the selected one in amber |
| Enlarged frame | `card-frame-large` | sprite | 166×280 | core     | Tap-to-enlarge view: the `card-frame` layout at 2× with 1px detail, illustration at 2×; same tags                                                                 |
| Cost badge     | `card-cost`        | image  | 71×13   | core     | Plaque over the frame's badge (at 2× on the large frame); the game writes the cost between the rivets                                                             |

Illustrations, one per option, keyed `card-<encounter>-<option>` (type `image`, e.g. `card-skunk-grooming`, `card-other-dog-pull-away`). An encounter with two options shows two centred cards. All 39 are drawn. Forced-stop keys use the stop's data key (`card-kid-wants-to-pet-pet`), upgrades their id (`card-second-wind`), and Poop bags' Skip option is `card-skip`. Biscuit neighbour and photo op pay out at once without a card, so `card-biscuit-neighbour-take` and `card-photo-op-pose` serve as their popup art.

| Encounter         | Options                                                                                                     | Count | Priority |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | ----- | -------- |
| Skunk             | grooming, quick rinse, ignore                                                                               | 3     | M6       |
| Squirrel          | hold tight, let them chase                                                                                  | 2     | M6       |
| Puddle            | go through, towel                                                                                           | 2     | M6       |
| Other dog         | let them sniff, pull away                                                                                   | 2     | M6       |
| Thief             | chase them off, let it go                                                                                   | 2     | M6       |
| Lost wallet       | return it, keep it                                                                                          | 2     | M6       |
| Biscuit neighbour | take biscuits (popup art), politely pass                                                                    | 2     | M6       |
| Photo op          | pose (popup art), wave and walk on                                                                          | 2     | M6       |
| Stop sign         | wait, dart across                                                                                           | 2     | M6       |
| Kid               | let them pet, decline                                                                                       | 2     | M6       |
| Ice cream truck   | buy pup cups, walk past                                                                                     | 2     | M6       |
| Construction      | long way, squeeze past                                                                                      | 2     | M6       |
| Mail carrier      | hold them back, wait it out                                                                                 | 2     | M6       |
| Chatty neighbour  | chat, move on                                                                                               | 2     | M6       |
| Poop bags         | skip (`card-skip`)                                                                                          | 1     | core     |
| Upgrades          | belly rubs, good leash, big tipper, shortcut, rush hour, raincoats, treat magnet, second wind, sweet talker | 9     | core     |

Total: 39 card illustrations, 29 of them in Milestone 6.

## Help screen

One illustration per page of the in-game "How to walk" screen, composed from the exported sprites by `art/tools/help.py`. The help screen mock animates the same scenes.

| Asset              | Key           | Type  | Size    | Priority | Notes                                       |
| ------------------ | ------------- | ----- | ------- | -------- | ------------------------------------------- |
| Help illustrations | `help-<page>` | image | 344×236 | core     | lanes, pickups, cards, owners, pulls, zones |

## Screens outside the run

| Asset                | Key                        | Type   | Size             | Priority | Notes                                                                                                                                  |
| -------------------- | -------------------------- | ------ | ---------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Title / home         | `screen-home`              | image  | 360×640          | core     | Background; bank total and buttons on top                                                                                              |
| Logo                 | `logo`                     | image  | TBD              | later    |                                                                                                                                        |
| Dog portraits        | `portrait-dog-<name>`      | image  | 64×64            | core     | 9 dogs; larger art for dog pick and the shop. Three-quarter front view, sitting, head and shoulders; drawn by `art/tools/portraits.py` |
| Trait icons          | `icon-trait-<trait>`       | image  | 16×16            | core     | fancy, food-driven, chaser; drawn by `art/tools/glyphs.py`                                                                             |
| Energy icons         | `icon-energy-<energy>`     | image  | 16×16            | core     | calm, steady, hyper; drawn by `art/tools/glyphs.py`                                                                                    |
| Temperament icons    | `icon-owner-<temperament>` | image  | 16×16            | core     | laid-back, fussy, dramatic; drawn by `art/tools/glyphs.py`                                                                             |
| Gear icons           | `item-<gear>`              | image  | 32×32            | core     | Fanny pack, whistle, poop bags, running shoes, lucky collar; drawn by `art/tools/icons.py`                                             |
| Locked dog slot      | `ui-slot-locked`           | image  | TBD              | core     | Pack picker slots 2 and 3 until bought ($800 / $1,800): a padlock and the price                                                        |
| Stats page           | `screen-stats`             | image  | 360×640          | core     | Behind the logbook; panel background for the full stats                                                                                |
| Achievement badges   | `badge-<achievement>`      | sprite | 32×32            | core     | 15 medals, rim by category (firsts bronze, mastery silver, collection gold, silly pink); tags `earned`, `locked` (grey with a padlock) |
| Badge celebration    | `fx-confetti`              | sprite | 64×64            | core     | Burst behind a badge as it is earned (tag `play`); the owners cheer with their `happy` faces                                           |
| Hint bubble          | `ui-hint`                  | image  | 9-slice          | core     | First-time hints: a one-line bubble the first time each thing appears                                                                  |
| Selection frame      | `ui-select`                | sprite | 24×24 nine-slice | core     | Thick amber frame around a picked tile; tag `pulse` (2 frames)                                                                         |
| Pick badge           | `ui-check`                 | sprite | 16×16            | core     | Green badge on a picked tile: tags `1`, `2`, `3` (pack order) and `tick`                                                               |
| Tap and dust effects | `fx-tap`, `fx-dust`        | sprite | 16×16            | core     | A sparkle where a tap lands; a puff when the walker or a dog hops                                                                      |
| Zone banner          | `ui-zone-banner`           | image  | 248×48           | core     | Board and ribbon ends with no text; the game writes both lines in font-title                                                           |
| End screen           | `screen-end`               | image  | 360×640          | core     | Earnings summary background, with a new-best ribbon (`ui-new-best`)                                                                    |

## UI kit

| Asset       | Key                       | Type   | Size      | Priority | Notes                                                                                                    |
| ----------- | ------------------------- | ------ | --------- | -------- | -------------------------------------------------------------------------------------------------------- |
| Pixel fonts | `font-body`, `font-title` | font   | 8px       | M6       | Tiny5 (body, labels) and Silkscreen (titles, numbers); XML BMFont plus PNG; includes `$` and a drawn `♥` |
| Button      | `ui-button`               | sprite | 9-slice   | core     | Frames `normal`, `pressed`, `disabled`                                                                   |
| Panel       | `ui-panel`                | image  | 9-slice   | core     | Shop, end screen, pause menu with Head home                                                              |
| Pause icon  | `icon-pause`              | image  | 16×16     | core     | Top bar; opens the pause menu                                                                            |
| Touch hint  | `ui-touch-hint`           | image  | 96×36     | later    | A fingertip on a two-way track with fading touch marks; the game writes "drag to switch lanes" under it  |
| App icon    | (not in manifest)         | PNG    | 16 to 512 | later    | Favicon done (`public/art/favicon.png`, 32 and 16); home-screen sizes later                              |

## Counts

| Priority | Sprites | Images           | Fonts |
| -------- | ------- | ---------------- | ----- |
| M6       | ~41     | 29 (card illus.) | 1     |
| core     | ~13     | ~45              | 0     |
| later    | ~1      | ~23              | 0     |

## Open questions

- **Pack arrangement:** 1 to 3 dogs share one 56px lane ahead of the walker. Side by side does not fit 3×32px, so they need a staggered formation; the art needs to know the offsets.
