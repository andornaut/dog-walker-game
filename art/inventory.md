# Art Inventory

Every art asset the game needs. Keys are the `public/art/manifest.json` keys. Type is the manifest list: `sprite` (PNG plus Aseprite JSON, tags from frameTags), `image` (PNG), `font` (BMFont) or `sound`.

Priority: **M6** is in the Milestone 6 pixel pass, **core** is needed before the game ships, **later** accepts a placeholder.

## People and dogs

| Key                   | Type   | Size  | Tags                                             | Pri  | Note                                                                              |
| --------------------- | ------ | ----- | ------------------------------------------------ | ---- | --------------------------------------------------------------------------------- |
| `walker-<name>`       | sprite | 32×48 | `walk`, `react`, `stumble`, `idle`               | M6   | casey, ada, ben, trista                                                           |
| `face-walker-<name>`  | sprite | 32×32 | `happy`, `neutral`                               | core | Walker picker                                                                     |
| `dog-<name>`          | sprite | 32×32 | `walk`, `react`, `pull`, `tell`, `idle`, `shake` | M6   | duchess, biscuit, koda (starters), nugget, zippy, pierre, dash, snowball, waffles |
| `face-dog-<name>`     | sprite | 32×32 | `happy`, `neutral`, `upset`                      | M6   | Dog column                                                                        |
| `face-owner-<name>`   | sprite | 32×32 | `happy`, `neutral`, `upset`, `fired`, `worried`  | M6   | Keyed by dog                                                                      |
| `owner-<name>`        | sprite | 32×48 | `idle`, `wave`                                   | core | Keyed by dog; gate on first visit, waving on the end screen                       |
| `portrait-dog-<name>` | image  | 64×64 |                                                  | core | Dog pick and shop                                                                 |

## Road objects

| Key                              | Type   | Size          | Tags                                 | Pri  | Note                                                           |
| -------------------------------- | ------ | ------------- | ------------------------------------ | ---- | -------------------------------------------------------------- |
| `skunk`                          | sprite | 32×32         | `idle`                               | M6   | Centred on `skunk-cloud`                                       |
| `skunk-cloud`                    | sprite | 88×88         | `loop`                               | M6   | 2×2 lanes and rows; dithered haze under the skunk; the hit box |
| `squirrel`                       | sprite | 32×32         | `idle`, `run`                        | M6   |                                                                |
| `puddle`                         | sprite | 88×32         | `idle`                               | M6   | 2 lanes; ground decal drawn under everything                   |
| `thief`                          | sprite | 32×48         | `walk`, `flee`, `idle`               | M6   |                                                                |
| `other-dog`                      | sprite | 32×32         | `walk`                               | M6   | A corgi                                                        |
| `other-dog-owner`                | sprite | 32×48         | `walk`, `idle`                       | M6   | Walks behind `other-dog`                                       |
| `stop-sign`                      | sprite | 32×48         | `idle`                               | M6   | Forced stop                                                    |
| `chatty-neighbour`               | sprite | 32×48         | `wave`, `idle`                       | M6   | Forced stop; coffee mug                                        |
| `kid`                            | sprite | 32×48         | `wave`, `sad`, `idle`                | M6   | Forced stop                                                    |
| `ice-cream-truck`                | sprite | 64×48         | `idle`                               | M6   | Forced stop; 2 lanes                                           |
| `construction`                   | sprite | 56×32         | `idle`                               | M6   | Forced stop; one lane, repeated across the road                |
| `mail-carrier`                   | sprite | 32×48         | `walk`, `idle`                       | M6   | Forced stop                                                    |
| `lost-wallet`                    | sprite | 16×16         | `idle`                               | M6   | Lucky                                                          |
| `biscuit-neighbour`              | sprite | 32×48         | `wave`, `idle`                       | M6   | Lucky; holds a biscuit jar                                     |
| `photo-op`                       | sprite | 32×48         | `idle`, `flash`                      | M6   | Lucky; tourist with a camera                                   |
| `treat`, `tip`                   | sprite | 16×16         | `idle`                               | M6   | Pickups                                                        |
| `cone`, `bin`, `hydrant`         | sprite | 32×32         | `idle`                               | core | Minor, 1 lane                                                  |
| `bench`                          | sprite | 88×32         | `idle`                               | core | Minor, 2 lanes                                                 |
| `hedge`                          | sprite | 144×32        | `idle`                               | core | Minor, 3 lanes                                                 |
| `barrier-2`, `barrier-3`         | sprite | 88×32, 144×32 | `idle`                               | core | Minor; Woof Way and Sniff Street Shops                         |
| `parked-car`                     | sprite | 40×128        | `idle`                               | core | Minor, 1 lane by 3 rows                                        |
| `squirrel-dash`                  | sprite | 32×32         | `run`                                | core | Crosser                                                        |
| `loose-dog`                      | sprite | 32×32         | `run`                                | core | Crosser; the `other-dog` corgi with a broken leash             |
| `ball-bounce`                    | sprite | 16×24         | `bounce`                             | core | Minor crosser; white with red stripes, unlike `gag-ball`       |
| `cyclist`                        | sprite | 32×48         | `ride`                               | core | Minor; rides down a lane                                       |
| `ui-warning`, `ui-warning-arrow` | sprite | 16×16         | `pulse`; the arrow also `down-pulse` | core | Hazard cue at the lane edge                                    |

### Depth variants

Same tags, frames and durations as the original.

| Key                                                                           | Size `@75`, `@50` | Pri  |
| ----------------------------------------------------------------------------- | ----------------- | ---- |
| `tip`, `treat`                                                                | 12×12, 8×8        | core |
| `cone`, `bin`, `hydrant`, `dog-<name>`, `skunk`, `squirrel-dash`, `loose-dog` | 24×24, 16×16      | core |
| `squirrel`, `other-dog` (`@50` only)                                          | 16×16             | core |
| `skunk-cloud` (`@50` only)                                                    | 44×44             | core |
| `ball-bounce`                                                                 | 12×18, 8×12       | core |
| `fx-status-<status>`                                                          | 12×12, 8×8        | core |

## Effects

| Key                     | Type   | Size             | Tags         | Pri   | Note                                                                                 |
| ----------------------- | ------ | ---------------- | ------------ | ----- | ------------------------------------------------------------------------------------ |
| `fx-bump`               | sprite | 32×32            | `play`       | core  | Impact star on any hit                                                               |
| `fx-dizzy`              | sprite | 32×16            | `loop`       | core  | Over the walker while a minor bump locks lane input                                  |
| `fx-coins`              | sprite | 32×32            | `play`       | core  | Coins knocked loose on a minor bump                                                  |
| `fx-splash`             | sprite | 32×32            | `play`       | core  | Puddle                                                                               |
| `fx-sparkle`            | sprite | 16×16            | `play`       | core  | Pickup collected                                                                     |
| `fx-stinky`             | sprite | 32×32            | `loop`       | core  | Pack-wide stink lines; not shown in the run (per-dog `fx-status-stinky` replaces it) |
| `fx-bark`               | sprite | 16×16            | `pop`        | core  | Pull tell                                                                            |
| `fx-heart`              | sprite | 16×16            | `up`, `down` | later | ♥ change at a slot                                                                   |
| `fx-hit-<encounter>`    | sprite | 64×64            | `play`       | core  | skunk, puddle, thief, squirrel, other-dog                                            |
| `ui-hit-flash-<colour>` | sprite | 16×64            | `play`       | core  | green, sky, amber, orange, pink; left edge strip, mirrored for right                 |
| `ui-hit-label`          | sprite | 24×24 nine-slice | `normal`     | core  | Stretched to 176×32                                                                  |
| `fx-status-<status>`    | sprite | 16×16            | `loop`       | core  | stinky, soaked, spooked; over a dog's head                                           |

## Road and backdrop

| Key                 | Type   | Size    | Tags            | Pri   | Note                                                       |
| ------------------- | ------ | ------- | --------------- | ----- | ---------------------------------------------------------- |
| `road-<zone>`       | image  | 280×64  |                 | core  | woof-way, bark-park, sniff-street-shops, the-long-way-home |
| `road-<zone>-start` | image  | 280×64  |                 | later | Transition; every zone but woof-way                        |
| `backdrop-<zone>`   | image  | 360×150 |                 | core  | Every zone                                                 |
| `gag-cat`           | sprite | 24×24   | `idle`, `react` | core  | On a fence                                                 |
| `gag-sprinkler`     | sprite | 32×24   | `spray`         | core  |                                                            |
| `gag-ball`          | sprite | 14×14   | `roll`          | core  | Rolls along the sidewalk                                   |

## Dog column and top bar

| Key                                          | Type   | Size              | Tags                             | Pri   | Note                                                        |
| -------------------------------------------- | ------ | ----------------- | -------------------------------- | ----- | ----------------------------------------------------------- |
| `ui-doghouse`                                | sprite | 72×146            | one per dog key, `empty`         | core  | One per slot                                                |
| `ui-doghouse-warn`                           | sprite | 72×146            | `pulse`, `static`                | core  | Overlay at 1 ♥                                              |
| `ui-heart`                                   | sprite | 8×7               | `full`, `empty`                  | M6    | Full is darkRed, empty a hollow darkBrown outline           |
| `ui-fired-plate`                             | sprite | 24×24 nine-slice  | `laid-back`, `fussy`, `dramatic` | core  | Stretched to 72×28                                          |
| `fx-fired-pop`                               | sprite | 64×64             | `play`                           | core  | Drawn at 2× behind the fired face                           |
| `fx-coin-fly`                                | sprite | 12×12             | `spin`                           | core  | Fee payout                                                  |
| `ui-payout-label`                            | sprite | 24×16 three-slice | `normal`                         | core  | Stretched to 60×16                                          |
| `fx-treat-pop`                               | sprite | 24×24             | `play`                           | core  | Where a given treat lands                                   |
| `ui-quip`                                    | image  | 24×24 nine-slice  |                                  | core  |                                                             |
| `ui-quip-tail`                               | image  | 6×8               |                                  | core  | Points left at the owner; covers the bubble's left rim      |
| `icon-stinky`, `icon-soaked`, `icon-spooked` | image  | 16×16             |                                  | core  | Doghouse status icons                                       |
| `ui-top-bar`                                 | image  | 360×40            |                                  | core  |                                                             |
| `ui-strip-well`                              | image  | 24×24 nine-slice  |                                  | core  | State strip tab under the zone well, right-aligned at x 356 |
| `icon-upgrade-<upgrade>`                     | image  | 16×16             |                                  | core  | State strip; one per upgrade id (9)                         |
| `icon-gear-<gear>`                           | image  | 16×16             |                                  | core  | State strip; one per gear id (5)                            |
| `icon-money`                                 | image  | 16×16             |                                  | core  | Also cards, shop and end screen                             |
| `ui-zone-pips`                               | sprite | 18×8              | `done`, `current`, `todo`        | core  | 4 pips 3px apart                                            |
| `icon-zone-<zone>`                           | image  | 16×16             |                                  | later |                                                             |

## Choice cards and help

| Key                           | Type   | Size    | Tags                                    | Pri  | Note                                                                     |
| ----------------------------- | ------ | ------- | --------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `card-frame`                  | sprite | 83×140  | `encounter`, `lucky`, `stop`, `upgrade` | M6   |                                                                          |
| `card-frame-large`            | sprite | 166×280 | as `card-frame`                         | core | Tap-to-enlarge view                                                      |
| `card-cost`                   | image  | 71×13   |                                         | core | Cost plaque, at 2× on the large frame                                    |
| `card-<encounter>-<option>`   | image  | 75×56   |                                         | M6   | One per option of the encounters, lucky encounters and forced stops (27) |
| `card-<upgrade>`, `card-skip` | image  | 75×56   |                                         | core | One per upgrade (9), and Poop bags' Skip                                 |
| `help-<page>`                 | image  | 344×236 |                                         | core | lanes, pickups, cards, owners, pulls, zones                              |

Card keys use the data keys (`card-kid-wants-to-pet-pet`, `card-second-wind`). The generous neighbour and photo op open no card: `card-biscuit-neighbour-take` and `card-photo-op-pose` are their popup art.

## Screens and home

| Key                                                           | Type   | Size                                       | Tags                  | Pri   | Note                                                       |
| ------------------------------------------------------------- | ------ | ------------------------------------------ | --------------------- | ----- | ---------------------------------------------------------- |
| `screen-home`, `screen-stats`, `screen-end`, `screen-loading` | image  | 360×640                                    |                       | core  |                                                            |
| `logo`                                                        | image  | 128×30                                     |                       | later | Yard sign board; also baked into `screen-loading`          |
| `ui-loading-track`                                            | image  | 200×8                                      |                       | core  |                                                            |
| `ui-loading`                                                  | sprite | 48×32                                      | `walk`                | core  | Casey and Biscuit                                          |
| `ui-new-best`                                                 | image  | 72×20                                      |                       | core  | End screen ribbon                                          |
| `fx-new-best`                                                 | sprite | 96×48                                      | `play`                | core  | Burst behind `ui-new-best`                                 |
| `badge-<achievement>`                                         | sprite | 32×32                                      | `earned`, `locked`    | core  | 15; achievement name in kebab case                         |
| `fx-confetti`                                                 | sprite | 64×64                                      | `play`                | core  | Behind a badge as it is earned                             |
| `icon-trait-<trait>`                                          | image  | 16×16                                      |                       | core  | fancy, food-driven, chaser                                 |
| `icon-energy-<energy>`                                        | image  | 16×16                                      |                       | core  | calm, steady, hyper                                        |
| `icon-owner-<temperament>`                                    | image  | 16×16                                      |                       | core  | laid-back, fussy, dramatic                                 |
| `item-<gear>`                                                 | image  | 32×32                                      |                       | core  | One per gear id (5)                                        |
| `ui-slot-locked`                                              | image  | 160×46                                     |                       | core  | Yard sign for the next dog slot; the game writes two lines |
| `ui-detail-card`, `ui-detail-band`, `ui-detail-well`          | image  | 24×24 nine-slice, 24×22 three-slice, 68×68 |                       | core  | Hold-to-open detail card                                   |
| `ui-step`                                                     | image  | 24×24 nine-slice                           |                       | core  | Home screen step plate                                     |
| `ui-step-number`, `ui-check`                                  | sprite | 16×16                                      | `1`, `2`, `3`, `tick` | core  | Step badge; pick badge                                     |
| `ui-select`                                                   | sprite | 24×24 nine-slice                           | `pulse`               | core  | Selected frame                                             |
| `ui-afford`                                                   | sprite | 24×24 nine-slice                           | `glint`               | core  | Affordable frame                                           |
| `ui-hint`                                                     | image  | 24×24 nine-slice                           |                       | core  | First-time hint bubble                                     |
| `ui-hint-tail`                                                | image  | 8×6                                        |                       | core  |                                                            |
| `ui-zone-banner`                                              | image  | 248×48                                     |                       | core  | The game writes both lines                                 |
| `fx-tap`, `fx-dust`                                           | sprite | 16×16                                      | `play`                | core  |                                                            |

## UI kit

| Key                                                                                                | Type   | Size              | Tags                                                                                  | Pri   | Note                                         |
| -------------------------------------------------------------------------------------------------- | ------ | ----------------- | ------------------------------------------------------------------------------------- | ----- | -------------------------------------------- |
| `font-body`, `font-title`                                                                          | font   | 8px               |                                                                                       | M6    | Includes `$` and a drawn `♥`                 |
| `ui-button`                                                                                        | sprite | 24×24 nine-slice  | `normal`, `pressed`, `disabled`, `secondary`, `secondary-pressed`, `go`, `go-pressed` | core  |                                              |
| `ui-icon-button`                                                                                   | sprite | 20×20             | `normal`, `pressed`                                                                   | core  | Icon at +2,+1 (+2,+3 pressed)                |
| `ui-panel`                                                                                         | image  | 24×24 nine-slice  |                                                                                       | core  |                                              |
| `ui-switch`                                                                                        | sprite | 32×16             | `on`, `off`                                                                           | core  |                                              |
| `ui-slider`                                                                                        | sprite | 24×10 three-slice | `filled`, `empty`, `filled-disabled`, `empty-disabled`                                | core  |                                              |
| `ui-slider-knob`                                                                                   | sprite | 10×16             | `normal`, `pressed`, `disabled`                                                       | core  |                                              |
| `icon-sound`, `icon-music`                                                                         | sprite | 16×16             | `on`, `off`                                                                           | core  |                                              |
| `icon-<setting>-panel`                                                                             | sprite | 16×16             | `on`, `off`                                                                           | core  | sound, music, effects, motion; Settings rows |
| `icon-pause`, `icon-play`, `icon-help`, `icon-close`, `icon-lock`, `icon-logbook`, `icon-settings` | image  | 16×16             |                                                                                       | core  |                                              |
| `ui-touch-hint`                                                                                    | image  | 96×36             |                                                                                       | later | The game writes "drag to switch lanes"       |
| App icons (not in manifest)                                                                        | PNG    | 16 to 512         |                                                                                       | core  | `art/tools/appicons.py`                      |

## Sounds

| Key                                                                                   | Pri  |
| ------------------------------------------------------------------------------------- | ---- |
| `sfx-tip`, `sfx-treat`, `sfx-bump`, `sfx-bark`, `sfx-card`, `sfx-fired`, `music-walk` | M6   |
| `sfx-hit-<encounter>`, `sfx-badge`, `sfx-new-best`                                    | core |
