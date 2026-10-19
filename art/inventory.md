# Art Inventory

Every art asset the game needs, derived from the rulebook in `../gameplay/game-design.md` and the run screen layout in `../tech-plan.md`. What is already exported is listed in `../public/art/manifest.json` and shown in the gallery at `/art/`. The rules every asset must follow live in `style-guide.md`. Keys are the `public/art/manifest.json` keys (kebab-case). Type is the manifest list: `sprite` (PNG + Aseprite JSON, animations from frameTags), `image` (plain PNG) or `font` (BMFont).

Priority:

- **M6:** in the Milestone 6 pixel pass (see Milestones in `../gameplay/game-design.md`)
- **core:** needed before the game ships, outside the Milestone 6 list
- **later:** nice to have; placeholders are acceptable

## Characters (road)

Dogs are listed in their own section below. Each of the 9 dogs is a named character with its own road sprite, face and owner face.

| Asset             | Key                  | Type   | Size  | Animations                         | Priority | Notes                                                                                                                                                                    |
| ----------------- | -------------------- | ------ | ----- | ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Walkers           | `walker-<name>`      | sprite | 32×48 | `walk`, `react`, `stumble`, `idle` | M6       | Seen from behind, all free: Casey (cap and hoodie), Ada (11, mixed race, long black curls), Ben (45, bald, chin beard, in black), Trista (50, teacher, dirty blonde bob) |
| Walker portraits  | `face-walker-<name>` | sprite | 32×32 | `happy`, `neutral`                 | core     | Front view for the walker picker                                                                                                                                         |
| Other dog         | `other-dog`          | sprite | 32×32 | `walk`                             | M6       | Encounter obstacle (a corgi), led by `other-dog-owner`                                                                                                                   |
| Other dog's owner | `other-dog-owner`    | sprite | 32×48 | `walk`, `idle`                     | M6       | Walks behind the other dog; the game draws the leash                                                                                                                     |
| Stinky effect     | `fx-stinky`          | sprite | 32×32 | `loop`                             | core     | Green stink lines over the pack while Stinky lasts                                                                                                                       |

## Dogs

Road sprites are seen from above and behind, like the walker. Small dogs sit well inside the 32×32 tile and big dogs fill it. Every road sprite has the animations `walk`, `react`, `pull`, `tell` (the lean and bark about 1s before a pull) `idle` (standing, for pauses) and `shake` (a shake-off after a hit). Each dog's look (coat and accessory) must read on both its 32×32 road sprite and its face. Owner faces show the owner's job and temperament (laid-back, fussy or dramatic).

| Dog               | Road sprite    | Face                | Owner face            | Priority |
| ----------------- | -------------- | ------------------- | --------------------- | -------- |
| Duchess (starter) | `dog-duchess`  | `face-dog-duchess`  | `face-owner-duchess`  | M6       |
| Biscuit (starter) | `dog-biscuit`  | `face-dog-biscuit`  | `face-owner-biscuit`  | M6       |
| Koda (starter)    | `dog-koda`     | `face-dog-koda`     | `face-owner-koda`     | M6       |
| Nugget            | `dog-nugget`   | `face-dog-nugget`   | `face-owner-nugget`   | M6       |
| Zippy             | `dog-zippy`    | `face-dog-zippy`    | `face-owner-zippy`    | M6       |
| Pierre            | `dog-pierre`   | `face-dog-pierre`   | `face-owner-pierre`   | M6       |
| Dash              | `dog-dash`     | `face-dog-dash`     | `face-owner-dash`     | M6       |
| Snowball          | `dog-snowball` | `face-dog-snowball` | `face-owner-snowball` | M6       |
| Waffles           | `dog-waffles`  | `face-dog-waffles`  | `face-owner-waffles`  | M6       |

Starters come first: they are the dogs every new player sees.

## Obstacles and forced stops (road)

| Asset             | Key                | Type   | Size  | Animations             | Priority | Notes                                                                                                   |
| ----------------- | ------------------ | ------ | ----- | ---------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| Skunk             | `skunk`            | sprite | 32×32 | `idle`                 | M6       | Centred on its spray cloud                                                                              |
| Skunk spray cloud | `skunk-cloud`      | sprite | 88×88 | `loop`                 | M6       | 2×2 lanes and rows; dithered haze drawn under the skunk; the hit box                                    |
| Squirrel          | `squirrel`         | sprite | 32×32 | `idle`, `run`          | M6       | Harmless scenery when no chaser is in the pack                                                          |
| Puddle            | `puddle`           | sprite | 88×32 | `idle` (shimmer)       | M6       | 2 lanes. Ground decal: no outline, no shadow, drawn under everything; cards draw their own 32×16 puddle |
| Thief             | `thief`            | sprite | 32×48 | `walk`, `flee`, `idle` | M6       | Pickpocket; flees from a pack with a big dog, with no card                                              |
| Stop sign         | `stop-sign`        | sprite | 32×48 | `idle`                 | M6       | Forced stop                                                                                             |
| Chatty neighbour  | `chatty-neighbour` | sprite | 32×48 | `wave`, `idle`         | M6       | Forced stop; holds a coffee mug                                                                         |
| Kid               | `kid`              | sprite | 32×48 | `wave`, `sad`, `idle`  | M6       | Forced stop: wants to pet the dogs; shorter than the adults                                             |
| Ice cream truck   | `ice-cream-truck`  | sprite | 64×48 | `idle`                 | M6       | Forced stop; two lanes wide                                                                             |
| Construction      | `construction`     | sprite | 56×32 | `idle` (lamps blink)   | M6       | Forced stop: one lane of barrier; the game repeats it across the road                                   |
| Mail carrier      | `mail-carrier`     | sprite | 32×48 | `walk`, `idle`         | M6       | Forced stop                                                                                             |

## Minor obstacles (road)

Bumped with no card. An obstacle n lanes wide and m rows long is drawn 56n−24 by 56m−24 px (one row is 56px of road); the drawn box is the hit box.

| Asset                | Key                      | Type   | Size          | Animations           | Priority | Notes                                                                                                          |
| -------------------- | ------------------------ | ------ | ------------- | -------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| Cone                 | `cone`                   | sprite | 32×32         | `idle`               | core     | 1 lane                                                                                                         |
| Bin                  | `bin`                    | sprite | 32×32         | `idle`               | core     | 1 lane; green wheelie bin                                                                                      |
| Hydrant              | `hydrant`                | sprite | 32×32         | `idle`               | core     | 1 lane                                                                                                         |
| Bench                | `bench`                  | sprite | 88×32         | `idle`               | core     | 2 lanes                                                                                                        |
| Hedge                | `hedge`                  | sprite | 144×32        | `idle`               | core     | 3 lanes                                                                                                        |
| Construction barrier | `barrier-2`, `barrier-3` | sprite | 88×32, 144×32 | `idle` (lamps blink) | core     | 2 or 3 lanes; Woof Way and Sniff Street Shops                                                                  |
| Parked car           | `parked-car`             | sprite | 40×128        | `idle`               | core     | 1 lane by 3 rows, from behind and above, nose up the road; anchored bottom-centre at the footprint's near edge |

## Moving hazards (road)

| Asset                | Key                                                                       | Type   | Size                           | Animations                           | Priority | Notes                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------- | ------ | ------------------------------ | ------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Squirrel dash        | `squirrel-dash`                                                           | sprite | 32×32                          | `run`                                | core     | Darts across lanes, side view facing right (mirrored for left); same colours as `squirrel`                                                                      |
| Loose dog            | `loose-dog`                                                               | sprite | 32×32                          | `run`                                | core     | The `other-dog` corgi crossing with a broken leash, side view facing right (mirrored)                                                                           |
| Bouncing ball        | `ball-bounce`                                                             | sprite | 16×24                          | `bounce`                             | core     | White with red stripes so it reads on every road (unlike the red `gag-ball`); minor obstacle crossing lanes; squashes on contact; carries its own ground shadow |
| Cyclist              | `cyclist`                                                                 | sprite | 32×48                          | `ride`                               | core     | Minor obstacle riding down a lane at the player, front view; scales at runtime                                                                                  |
| Hazard warning       | `ui-warning`, `ui-warning-arrow`                                          | sprite | 16×16                          | `pulse`; the arrow also `down-pulse` | core     | The ~1s cue at the lane edge; the arrow points right (mirrored); drawn at 1×                                                                                    |
| Small moving hazards | `squirrel-dash@75`, `@50`, `loose-dog@75`, `@50`, `ball-bounce@75`, `@50` | sprite | 24×24, 16×16; ball 12×18, 8×12 | as the original                      | core     | Redrawn for depth                                                                                                                                               |

## Lucky encounters (road)

Good things to bump into. The lost wallet opens a choice card; the generous neighbour and the photo op pay out at once with a popup.

| Asset              | Key                 | Type   | Size  | Animations      | Priority | Notes                   |
| ------------------ | ------------------- | ------ | ----- | --------------- | -------- | ----------------------- |
| Lost wallet        | `lost-wallet`       | sprite | 16×16 | `idle` (glint)  | M6       | Lying on the road       |
| Generous neighbour | `biscuit-neighbour` | sprite | 32×48 | `wave`, `idle`  | M6       | Holds out a biscuit jar |
| Photo op           | `photo-op`          | sprite | 32×48 | `idle`, `flash` | M6       | Tourist with a camera   |

## Depth variants (road)

Redrawn for the pseudo-3D road at 0.75× and 0.5×, drawn by `art/tools/minis.py`; same tags, frames and durations as the original.

| Asset                                   | Key                                                                     | Type   | Size         | Priority | Notes                                           |
| --------------------------------------- | ----------------------------------------------------------------------- | ------ | ------------ | -------- | ----------------------------------------------- |
| Small tip, treat                        | `tip@75`, `treat@75`, `tip@50`, `treat@50`                              | sprite | 12×12, 8×8   | core     |                                                 |
| Small cone, bin, hydrant                | `<key>@75`, `<key>@50`                                                  | sprite | 24×24, 16×16 | core     |                                                 |
| Small dogs                              | `dog-<name>@75`, `dog-<name>@50`                                        | sprite | 24×24, 16×16 | core     | All nine dogs                                   |
| Small skunk, cloud, other dog, squirrel | `skunk@75`, `skunk@50`, `skunk-cloud@50`, `other-dog@50`, `squirrel@50` | sprite |              | core     | Lose eyes, head or dither fill at runtime scale |

## Pickups (road)

| Asset | Key     | Type   | Size  | Animations    | Priority | Notes               |
| ----- | ------- | ------ | ----- | ------------- | -------- | ------------------- |
| Treat | `treat` | sprite | 16×16 | `idle` (bob)  | M6       | Bone or biscuit     |
| Tip   | `tip`   | sprite | 16×16 | `idle` (spin) | M6       | Coin or folded bill |

## Effects

| Asset           | Key                                                                         | Type   | Size             | Animations   | Priority | Notes                                                                                                                      |
| --------------- | --------------------------------------------------------------------------- | ------ | ---------------- | ------------ | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| Collision burst | `fx-bump`                                                                   | sprite | 32×32            | `play`       | core     | Impact star where the pack hits anything; plays as the card opens                                                          |
| Dizzy stars     | `fx-dizzy`                                                                  | sprite | 32×16            | `loop`       | core     | Circle over the walker while a minor bump locks lane input                                                                 |
| Dropped tips    | `fx-coins`                                                                  | sprite | 32×32            | `play`       | core     | Two coins knocked loose on a minor bump, with the cause label                                                              |
| Puddle splash   | `fx-splash`                                                                 | sprite | 32×32            | `play`       | core     | Water thrown up when the pack runs through a puddle                                                                        |
| Pickup sparkle  | `fx-sparkle`                                                                | sprite | 16×16            | `play`       | core     | Treat and tip collected                                                                                                    |
| Skunk hit       | `fx-hit-skunk`                                                              | sprite | 64×64            | `play`       | core     | Over the pack as a skunk hit lands: a green cloud swells and breaks into puffs; 8 frames at 70ms                           |
| Puddle hit      | `fx-hit-puddle`                                                             | sprite | 64×64            | `play`       | core     | Splash crown rises and falls to a ripple; 7 frames at 70ms                                                                 |
| Thief hit       | `fx-hit-thief`                                                              | sprite | 64×64            | `play`       | core     | Dust poof; the wallet shoots up while coins fan out and fall; 8 frames at 70ms                                             |
| Squirrel hit    | `fx-hit-squirrel`                                                           | sprite | 64×64            | `play`       | core     | A tail flick with motion lines, leaves spray out; 7 frames at 70ms                                                         |
| Other dog hit   | `fx-hit-other-dog`                                                          | sprite | 64×64            | `play`       | core     | Tangle cloud with leash loops, fur tufts and hearts; 8 frames at 70ms                                                      |
| Hit edge flash  | `ui-hit-flash-green`, `-sky`, `-amber`, `-orange`, `-pink`                  | sprite | 16×64            | `play`       | core     | Left screen-edge strip, solid at x=0 and dithered to clear; tiles vertically, mirrored for the right edge; 4 frames recede |
| Hit label plate | `ui-hit-label`                                                              | sprite | 24×24 nine-slice | `normal`     | core     | Stretched to 176×32; white font-title 2× label on dred (7.34:1)                                                            |
| Dog status      | `fx-status-stinky`, `fx-status-soaked`, `fx-status-spooked` (+`@75`, `@50`) | sprite | 16×16            | `loop`       | core     | Over a dog's head: stink lines (180ms), drips, a sweat drop (150ms)                                                        |
| Bark pop        | `fx-bark`                                                                   | sprite | 16×16            | `pop`        | core     | Over a dog during the pull tell, with the dog's `tell` lean                                                                |
| Heart up/down   | `fx-heart`                                                                  | sprite | 16×16            | `up`, `down` | later    | Floats from a dog slot. `up` pops in and rises; `down` cracks and the halves fall. Outlined, unlike the other effects      |

Floating numbers (`+$2`, `-1 ♥`) use the pixel font, not sprites.

## Road and scenery (per zone)

| Asset          | Key                                    | Type   | Size                | Priority | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------- | -------------------------------------- | ------ | ------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zone backdrops | `backdrop-<zone>`                      | image  | 360×150             | core     | woof-way, bark-park, sniff-street-shops, the-long-way-home. The street ends at a T-junction with a cross street (rows 96 to 122) and the far side facing the camera. Row 149 continues the road: Woof Way sidewalk 125..147, curb 148..150, road from 151; Bark Park grass to 150, path from 151; Sniff Street Shops paving to 147, curb 148..151, road from 152; The Long Way Home sidewalk 125..147, curb 148..149, road from 150. Gags sit on the near lawns |
| Scenery gags   | `gag-cat`, `gag-sprinkler`, `gag-ball` | sprite | 24×24, 32×24, 14×14 | core     | In the backdrop band, no card, no collision: a cat on a fence (`idle` tail swish and blink, `react` ears up), a sprinkler (`spray`), a ball rolling along the sidewalk (`roll`)                                                                                                                                                                                                                                                                                 |

Four zones in a fixed order: Woof Way, Bark Park, Sniff Street Shops and The Long Way Home. Each zone needs a road that tiles vertically across the 280px road width, plus a few non-colliding scenery props at the road edges.

| Asset           | Key pattern         | Type  | Size   | Priority | Notes                                                                                                                                                |
| --------------- | ------------------- | ----- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Road strip      | `road-<zone>`       | image | 280×64 | core     | Seamless vertically; base is the zone's road colour; 2px lane dividers at x = 56k−1; drawn by `art/tools/roads.py`                                   |
| Zone transition | `road-<zone>-start` | image | 280×64 | later    | Bottom rows are the previous zone's strip, top rows this zone's, joined by a crossing (kerb and zebra, stone sill, bricks on end); Woof Way has none |

Four zones give 4 road strips (core) plus 3 transitions (later); Woof Way has no transition strip.

## Dog column

| Asset               | Key                           | Type   | Size             | Priority | Notes                                                                                                                                                                                                              |
| ------------------- | ----------------------------- | ------ | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Doghouse slot       | `ui-doghouse`                 | sprite | 72×146           | core     | One per dog slot: a doghouse with the dog's colour roof (a tag per dog, plus `empty` for a fired dog); the dog peeks from the door, the owner sits in the window, hearts on the board. Layout in `art/tools/ui.py` |
| Low-hearts rim      | `ui-doghouse-warn`            | sprite | 72×146           | core     | Overlay on a doghouse at 1 heart; tags `pulse` (4 at 400ms) and `static` (reduced motion)                                                                                                                          |
| Dog faces           | `face-dog-<name>`             | sprite | 32×32            | M6       | 9 dogs; frames `happy`, `neutral`, `upset`                                                                                                                                                                         |
| Owner faces         | `face-owner-<name>`           | sprite | 32×32            | M6       | 9 owners; frames `happy`, `neutral`, `upset`, `fired`                                                                                                                                                              |
| Happiness hearts    | `ui-heart`                    | sprite | 8×7              | M6       | Frames `full` (dark red) and `empty` (hollow dark brown outline), so they differ by fill; with the "n/max" count beside them                                                                                       |
| Quip bubble         | `ui-quip`                     | image  | 24×24 nine-slice | core     | Cream bubble with a round plum rim, 8px corners; `ui-quip-tail` (6×8) points left at the owner                                                                                                                     |
| Quip tail           | `ui-quip-tail`                | image  | 6×8              | core     | Points left at the owner's window; its right column covers the bubble's left rim                                                                                                                                   |
| Stinky badge        | `icon-stinky`                 | image  | 16×16            | core     | Shown while the debuff lasts                                                                                                                                                                                       |
| Dog status icons    | `icon-soaked`, `icon-spooked` | image  | 16×16            | core     | On the doghouse heart board beside `icon-stinky`: drops; a scared dog face with a sweat drop. Drawn by `art/tools/glyphs.py`                                                                                       |
| Upgrade state icons | `icon-upgrade-<upgrade>`      | image  | 16×16            | core     | State strip in the top bar's ink well, one per upgrade id in kebab case (9). Drawn by `art/tools/glyphs.py`                                                                                                        |
| Gear state icons    | `icon-gear-<gear>`            | image  | 16×16            | core     | State strip in the top bar's ink well, one per gear id in kebab case (5), after `item-<gear>`. Drawn by `art/tools/glyphs.py`                                                                                      |

## Top bar

| Asset          | Key                | Type   | Size   | Priority | Notes                                                                                                                                         |
| -------------- | ------------------ | ------ | ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Bar background | `ui-top-bar`       | image  | 360×40 | core     | Plum wood with ink wells: money 4,8 94×26; treats 100,8 42×26; zone 194,5 162×29. Sound toggle at 146,10 and pause at 170,10 sit between them |
| Money icon     | `icon-money`       | image  | 16×16  | core     | Reused in cards, shop and end screen                                                                                                          |
| Zone progress  | `ui-zone-pips`     | sprite | 18×8   | core     | 4 pips 3px apart; frames `done` (ticked), `current` (the game fills it amber), `todo`                                                         |
| Zone icons     | `icon-zone-<zone>` | image  | 16×16  | later    | Woof Way, Bark Park, Sniff Street Shops, The Long Way Home; drawn by `art/tools/glyphs.py`                                                    |

## Choice cards

Each card is a frame plus an illustration plus text drawn in the pixel font. The illustration is 75×56 at (5, 16) inside the 83×140 frame; `art/tools/cards.py` documents the rest of the layout.

| Asset          | Key                | Type   | Size    | Priority | Notes                                                                                                                                                             |
| -------------- | ------------------ | ------ | ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card frame     | `card-frame`       | sprite | 83×140  | M6       | Tags `encounter`, `lucky`, `stop`, `upgrade` (band colour); the game greys out disabled cards with the palette's grey ramp and outlines the selected one in amber |
| Enlarged frame | `card-frame-large` | sprite | 166×280 | core     | Tap-to-enlarge view: the `card-frame` layout at 2× with 1px detail, illustration at 2×; same tags                                                                 |
| Cost badge     | `card-cost`        | image  | 71×13   | core     | Plaque over the frame's badge (at 2× on the large frame); the game writes the cost between the rivets                                                             |

Illustrations, one per option, keyed `card-<encounter>-<option>` (type `image`, e.g. `card-skunk-grooming`, `card-other-dog-pull-away`). An encounter with two options shows two centred cards. All are drawn. Forced-stop keys use the stop's data key (`card-kid-wants-to-pet-pet`), upgrades their id (`card-second-wind`), and Poop bags' Skip option is `card-skip`. The generous neighbour and the photo op pay out at once without a card, so `card-biscuit-neighbour-take` and `card-photo-op-pose` serve as their popup art.

| Encounter          | Options                                                                                                     | Count | Priority |
| ------------------ | ----------------------------------------------------------------------------------------------------------- | ----- | -------- |
| Skunk              | grooming, quick rinse, ignore                                                                               | 3     | M6       |
| Squirrel           | hold tight, let them chase                                                                                  | 2     | M6       |
| Puddle             | go through, towel                                                                                           | 2     | M6       |
| Other dog          | let them sniff, pull away                                                                                   | 2     | M6       |
| Thief              | chase them off, let it go                                                                                   | 2     | M6       |
| Lost wallet        | return it, keep it                                                                                          | 2     | M6       |
| Generous neighbour | take biscuits (popup art)                                                                                   | 1     | M6       |
| Photo op           | pose (popup art)                                                                                            | 1     | M6       |
| Stop sign          | wait, dart across                                                                                           | 2     | M6       |
| Kid                | let them pet, decline                                                                                       | 2     | M6       |
| Ice cream truck    | buy pup cups, walk past                                                                                     | 2     | M6       |
| Construction       | long way, squeeze past                                                                                      | 2     | M6       |
| Mail carrier       | hold them back, wait it out                                                                                 | 2     | M6       |
| Chatty neighbour   | chat, move on                                                                                               | 2     | M6       |
| Poop bags          | skip (`card-skip`)                                                                                          | 1     | core     |
| Upgrades           | belly rubs, good leash, big tipper, shortcut, rush hour, raincoats, treat magnet, second wind, sweet talker | 9     | core     |

Total: 37 card illustrations, 27 of them in Milestone 6.

## Help screen

One illustration per page of the in-game "How to walk" screen, composed from the exported sprites by `art/tools/help.py`. The help screen mock animates the same scenes.

| Asset              | Key           | Type  | Size    | Priority | Notes                                       |
| ------------------ | ------------- | ----- | ------- | -------- | ------------------------------------------- |
| Help illustrations | `help-<page>` | image | 344×236 | core     | lanes, pickups, cards, owners, pulls, zones |

## Screens outside the run

| Asset                      | Key                                                  | Type          | Size                                       | Priority | Notes                                                                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------- | ------------- | ------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title / home               | `screen-home`                                        | image         | 360×640                                    | core     | Morning on Maple Street: the gate scene in the start screen's layout (y 40 to 196), then a dark porch deck under the panels; the game prints the street name on the blank sign                                          |
| Logo                       | `logo`                                               | image         | 128×30                                     | later    | The yard sign's board on the home screen, at 6,146 left of the gate path: dark wood with amber letters (4.57:1), the leash and a paw print; also baked into `screen-loading`                                            |
| Dog portraits              | `portrait-dog-<name>`                                | image         | 64×64                                      | core     | 9 dogs; larger art for dog pick and the shop. Three-quarter front view, sitting, head and shoulders; drawn by `art/tools/portraits.py`                                                                                  |
| Trait icons                | `icon-trait-<trait>`                                 | image         | 16×16                                      | core     | fancy, food-driven, chaser; drawn by `art/tools/glyphs.py`                                                                                                                                                              |
| Energy icons               | `icon-energy-<energy>`                               | image         | 16×16                                      | core     | calm, steady, hyper; drawn by `art/tools/glyphs.py`                                                                                                                                                                     |
| Temperament icons          | `icon-owner-<temperament>`                           | image         | 16×16                                      | core     | laid-back, fussy, dramatic; drawn by `art/tools/glyphs.py`                                                                                                                                                              |
| Gear icons                 | `item-<gear>`                                        | image         | 32×32                                      | core     | Fanny pack, whistle, poop bags, running shoes, lucky collar; drawn by `art/tools/icons.py`                                                                                                                              |
| Locked dog slot            | `ui-slot-locked`                                     | image         | 160×46                                     | core     | Two-line yard sign with a padlock: "Slot 2 · $800" (font-title 2×, plum on tan) over "Save $X more" (darkRed) or "Tap to buy" (forest) in font-body 2× on cream                                                         |
| Stats page                 | `screen-stats`                                       | image         | 360×640                                    | core     | Evening den: a window onto Woof Way at night, a dog photo and leash hooks above y 130, dark panelling below for the stats and the badge wall                                                                            |
| Achievement badges         | `badge-<achievement>`                                | sprite        | 32×32                                      | core     | 15 medals, rim by category (firsts bronze, mastery silver, collection gold, silly pink); tags `earned`, `locked` (grey with a padlock). `<achievement>` is the badge name in kebab case (`first-steps`, `eau-de-skunk`) |
| Badge celebration          | `fx-confetti`                                        | sprite        | 64×64                                      | core     | Confetti burst behind a badge as it is earned (tag `play`, 10 frames at 80ms): pieces fly out unevenly, tumble and fall; the owners cheer with their `happy` faces                                                      |
| Hint bubble                | `ui-hint`                                            | image         | 24×24 nine-slice                           | core     | First-time hints: a one-line bubble the first time each thing appears                                                                                                                                                   |
| Hint tail                  | `ui-hint-tail`                                       | image         | 8×6                                        | core     | Points from the hint bubble at what it explains                                                                                                                                                                         |
| Selection frame            | `ui-select`                                          | sprite        | 24×24 nine-slice                           | core     | Ink edge either side of a 2px band pulsing amber and orange, drawn 3px outside a selected tile or active control; tag `pulse` (2 frames)                                                                                |
| Affordable frame           | `ui-afford`                                          | sprite        | 24×24 nine-slice                           | core     | Amber line with a plum keyline and gold coin studs, 2px outside an affordable tile; tag `glint` (4 at 400ms); a selected tile shows only `ui-select`                                                                    |
| Detail card                | `ui-detail-card`, `ui-detail-band`, `ui-detail-well` | image         | 24×24 nine-slice, 24×22 three-slice, 68×68 | core     | Hold-to-open card for a dog or gear item: body, title band and a recessed portrait well                                                                                                                                 |
| Step plate                 | `ui-step`, `ui-step-number`                          | image, sprite | 24×24 nine-slice, 16×16                    | core     | Home screen steps "1 Walker", "2 Dogs", "3 Gear (optional)"; the badge has tags `1`, `2`, `3`, `tick`                                                                                                                   |
| Logbook and settings icons | `icon-logbook`, `icon-settings`                      | image         | 16×16                                      | core     | Glyphs for the navy `ui-icon-button` face in the home top bar                                                                                                                                                           |
| Pick badge                 | `ui-check`                                           | sprite        | 16×16                                      | core     | Green badge on a picked tile: tags `1`, `2`, `3` (pack order) and `tick`                                                                                                                                                |
| Tap and dust effects       | `fx-tap`, `fx-dust`                                  | sprite        | 16×16                                      | core     | A sparkle where a tap lands; a puff when the walker or a dog hops                                                                                                                                                       |
| Zone banner                | `ui-zone-banner`                                     | image         | 248×48                                     | core     | Board and ribbon ends with no text; the game writes both lines in font-title                                                                                                                                            |
| End screen                 | `screen-end`                                         | image         | 360×640                                    | core     | Sunset on The Long Way Home: a flat sky behind the summary panel (24,140 to 336,440), the zone's houses, yards, sidewalk and brick road below y 440; new-best ribbon is `ui-new-best`                                   |
| Loading screen             | `screen-loading`                                     | image         | 360×640                                    | core     | Woof Way at night with the logo at 116,92 and a sidewalk for the progress track                                                                                                                                         |
| Loading track              | `ui-loading-track`                                   | image         | 200×8                                      | core     | Dotted path ending at a doghouse; top-left at 80,437                                                                                                                                                                    |
| Loading walker             | `ui-loading`                                         | sprite        | 48×32                                      | core     | Casey and Biscuit side-on, tag `walk` (4 at 160ms); top-left at 76 + round(148 × progress), 412                                                                                                                         |
| New-best ribbon            | `ui-new-best`                                        | image         | 72×20                                      | core     | On the end screen when a walk beats the best                                                                                                                                                                            |
| New-best burst             | `fx-new-best`                                        | sprite        | 96×48                                      | core     | Sparkles and stars bursting from behind `ui-new-best` (tag `play`, 8 frames at 70ms); the ribbon sits at 12,14 in the frame                                                                                             |

## UI kit

| Asset          | Key                                                                               | Type   | Size                        | Priority | Notes                                                                                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------- | ------ | --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pixel fonts    | `font-body`, `font-title`                                                         | font   | 8px                         | M6       | Tiny5 (body, labels) and Silkscreen (titles, numbers); XML BMFont plus PNG; includes `$` and a drawn `♥`                                                                                    |
| Button         | `ui-button`                                                                       | sprite | 9-slice                     | core     | Tags `normal`, `pressed`, `disabled` (amber primary) and `secondary`, `secondary-pressed` (tan face, brown lip) for other actions                                                           |
| Slider         | `ui-slider`                                                                       | sprite | 24×10 three-slice, 4px caps | core     | Settings volume track; tags `filled` (solid forest bar), `empty` (hollow plum groove), `filled-disabled`, `empty-disabled`                                                                  |
| Slider knob    | `ui-slider-knob`                                                                  | sprite | 10×16                       | core     | Tags `normal`, `pressed`, `disabled`                                                                                                                                                        |
| Settings icons | `icon-sound-panel`, `icon-music-panel`, `icon-effects-panel`, `icon-motion-panel` | sprite | 16×16                       | core     | For the Settings rows on cream; tags `on`, `off` (a dred X, or for motion a ball at rest)                                                                                                   |
| Icon button    | `ui-icon-button`                                                                  | sprite | 20×20                       | core     | Navy face, tan rim, brown lip; tags `normal`, `pressed` (face sinks 2px). Carries a 16×16 icon at +2,+1 (+2,+3 pressed): sound, pause, help                                                 |
| Sound icon     | `icon-sound`                                                                      | sprite | 16×16                       | core     | Tags `on` (speaker with two waves) and `off` (speaker with a pink X); no outline, for the navy button face                                                                                  |
| Switch         | `ui-switch`                                                                       | sprite | 32×16                       | core     | Settings on/off: `on` knob right, white tick on forest; `off` knob left, white cross on slate                                                                                               |
| Panel          | `ui-panel`                                                                        | image  | 24×24 nine-slice            | core     | Shop, end screen, pause menu with Head home                                                                                                                                                 |
| Pause icon     | `icon-pause`                                                                      | image  | 16×16                       | core     | Top bar; opens the pause menu                                                                                                                                                               |
| Play icon      | `icon-play`                                                                       | image  | 16×16                       | core     | Replaces `icon-pause` in the top bar while paused; amber triangle for the navy `ui-icon-button` face                                                                                        |
| Help icon      | `icon-help`                                                                       | image  | 16×16                       | core     | Opens the help screen, on `ui-icon-button`                                                                                                                                                  |
| Close icon     | `icon-close`                                                                      | image  | 16×16                       | core     | Closes panels and the enlarged card                                                                                                                                                         |
| Lock icon      | `icon-lock`                                                                       | image  | 16×16                       | core     | Locked dogs, gear and slots                                                                                                                                                                 |
| Music icon     | `icon-music`                                                                      | sprite | 16×16                       | core     | Tags `on`, `off`; the music volume row                                                                                                                                                      |
| Touch hint     | `ui-touch-hint`                                                                   | image  | 96×36                       | later    | A fingertip on a two-way track with fading touch marks; the game writes "drag to switch lanes" under it                                                                                     |
| App icon       | (not in manifest)                                                                 | PNG    | 16 to 512                   | core     | `public/art/favicon.png` at 32 and 16; `public/icons/` apple-touch-icon 180, icon-192, icon-512 and icon-maskable-512, drawn by `art/tools/appicons.py` from a 36×36 master at whole scales |

## Sounds

Ogg Vorbis plus AAC `.m4a`, mono 44.1kHz, listed under `sounds` in the manifest; `loop` marks the music.

| Asset         | Key                 | Type  | Length | Loop | Priority | Notes                                       |
| ------------- | ------------------- | ----- | ------ | ---- | -------- | ------------------------------------------- |
| Tip           | `sfx-tip`           | sound | 0.35s  | no   | M6       | Coin chime when a tip is collected          |
| Treat         | `sfx-treat`         | sound | 0.40s  | no   | M6       | Rising arpeggio when a treat is collected   |
| Bump          | `sfx-bump`          | sound | 0.30s  | no   | M6       | Soft thud on any collision                  |
| Bark          | `sfx-bark`          | sound | 0.18s  | no   | M6       | One "wuf" with the pull tell and `fx-bark`  |
| Card open     | `sfx-card`          | sound | 0.44s  | no   | M6       | Swish and chime as choice cards open        |
| Fired         | `sfx-fired`         | sound | 1.80s  | no   | M6       | Sad descending phrase when a dog is fired   |
| Skunk hit     | `sfx-hit-skunk`     | sound | 0.50s  | no   | core     | Spray hiss with the skunk hit moment        |
| Puddle hit    | `sfx-hit-puddle`    | sound | 0.50s  | no   | core     | Splash with the puddle hit moment           |
| Thief hit     | `sfx-hit-thief`     | sound | 0.60s  | no   | core     | Coin scatter with the thief hit moment      |
| Squirrel hit  | `sfx-hit-squirrel`  | sound | 0.40s  | no   | core     | Chitter with the squirrel hit moment        |
| Other dog hit | `sfx-hit-other-dog` | sound | 0.40s  | no   | core     | Friendly woof with the other dog hit moment |
| Badge         | `sfx-badge`         | sound | 1.00s  | no   | core     | Jingle when an achievement badge is earned  |
| New best      | `sfx-new-best`      | sound | 1.50s  | no   | core     | Fanfare when a walk sets a new best         |
| Walk music    | `music-walk`        | sound | 28.77s | yes  | M6       | 12 bars at about 100 BPM, loops seamlessly  |
