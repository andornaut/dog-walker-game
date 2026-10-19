# Art Inventory

Every art asset the game needs. Keys are the `public/art/manifest.json` keys. Type is the manifest list: `sprite` (PNG plus Aseprite JSON, tags from frameTags), `image` (PNG), `font` (BMFont) or `sound`.

Priority: **core** is needed for the first build, **later** accepts a placeholder.

`<zone>` is a zone id: snooze-crescent, bark-park, woof-way, sniff-street-shops, paws-promenade or the-long-way-home.

## People and dogs

| Key                   | Type   | Size  | Tags                                             | Pri  | Note                                                                                                                                                                                                  |
| --------------------- | ------ | ----- | ------------------------------------------------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `walker-<name>`       | sprite | 32×48 | `walk`, `react`, `stumble`, `idle`               | core | ada, ben, casey, trista                                                                                                                                                                               |
| `face-walker-<name>`  | sprite | 32×32 | `happy`, `neutral`                               | core | Walker picker                                                                                                                                                                                         |
| `dog-<name>`          | sprite | 32×32 | `walk`, `react`, `pull`, `tell`, `idle`, `shake` | core | duchess, biscuit, koda (starters), nugget, zippy, pierre, archie, snowball, penny; then the quirk's tags: archie `flourish`, biscuit `sniff`, nugget `pose`, penny `lunge`, `worried`, zippy `pounce` |
| `face-dog-<name>`     | sprite | 32×32 | `happy`, `neutral`, `upset`                      | core | Doghouse                                                                                                                                                                                              |
| `face-owner-<name>`   | sprite | 32×32 | `happy`, `neutral`, `upset`, `fired`, `worried`  | core | Keyed by dog                                                                                                                                                                                          |
| `owner-<name>`        | sprite | 32×48 | `idle`, `wave`                                   | core | Keyed by dog; gate on first visit, waving on the end screen                                                                                                                                           |
| `portrait-dog-<name>` | image  | 64×64 |                                                  | core | Dog pick and shop                                                                                                                                                                                     |

## Road objects

| Key                              | Type   | Size          | Tags                                 | Pri  | Note                                                          |
| -------------------------------- | ------ | ------------- | ------------------------------------ | ---- | ------------------------------------------------------------- |
| `cafe-patio`                     | sprite | 88×40         | `idle`                               | core | Encounter, 2 lanes                                            |
| `goose`                          | sprite | 32×32         | `run`, `idle`                        | core | Encounter, a mover; side view facing right, mirrored for left |
| `other-dog`                      | sprite | 32×32         | `walk`, `idle`                       | core | Encounter; a corgi                                            |
| `other-dog-owner`                | sprite | 32×48         | `walk`, `idle`                       | core | Walks behind `other-dog`                                      |
| `petunias`                       | sprite | 88×32         | `idle`                               | core | Encounter, 2 lanes                                            |
| `picnic`                         | sprite | 88×32         | `idle`                               | core | Encounter, 2 lanes                                            |
| `puddle`                         | sprite | 88×32         | `idle`                               | core | Encounter, 2 lanes; ground decal drawn under everything       |
| `skunk`                          | sprite | 32×32         | `idle`                               | core | Encounter; centred on `skunk-cloud`                           |
| `skunk-cloud`                    | sprite | 88×40         | `loop`                               | core | 2×2 lanes and rows; a low dithered haze under the skunk       |
| `squirrel`                       | sprite | 32×32         | `idle`, `run`                        | core | Encounter                                                     |
| `thief`                          | sprite | 32×48         | `walk`, `flee`, `idle`               | core | Encounter                                                     |
| `trash-bins`                     | sprite | 88×32         | `idle`                               | core | Encounter, 2 lanes                                            |
| `chatty-neighbour`               | sprite | 32×48         | `wave`, `idle`                       | core | Forced stop; coffee mug                                       |
| `construction`                   | sprite | 56×32         | `idle`                               | core | Forced stop; one lane, repeated across the road               |
| `ice-cream-truck`                | sprite | 88×44         | `idle`                               | core | Forced stop; 2 lanes; a rear-view van                         |
| `kid`                            | sprite | 32×48         | `wave`, `sad`, `idle`                | core | Forced stop                                                   |
| `mail-carrier`                   | sprite | 32×48         | `walk`, `idle`                       | core | Forced stop                                                   |
| `stop-sign`                      | sprite | 32×48         | `idle`                               | core | Forced stop                                                   |
| `biscuit-neighbour`              | sprite | 32×48         | `wave`, `idle`                       | core | Lucky; holds a biscuit jar                                    |
| `lemonade-stand`                 | sprite | 32×48         | `idle`                               | core | Lucky; the kid behind a stand                                 |
| `lost-wallet`                    | sprite | 16×16         | `idle`                               | core | Lucky                                                         |
| `photo-op`                       | sprite | 32×48         | `idle`, `flash`                      | core | Lucky; tourist with a camera                                  |
| `tip`, `treat`                   | sprite | 16×16         | `idle`                               | core | Pickups                                                       |
| `barrier-2`, `barrier-3`         | sprite | 88×24, 144×24 | `idle`                               | core | Minor; Woof Way and Sniff Street Shops                        |
| `bench`                          | sprite | 88×24         | `idle`                               | core | Minor, 2 lanes                                                |
| `bin`, `cone`, `hydrant`         | sprite | 32×32         | `idle`                               | core | Minor, 1 lane                                                 |
| `hedge`                          | sprite | 144×24        | `idle`                               | core | Minor, 3 lanes                                                |
| `parked-car`                     | sprite | 44×28         | `idle`                               | core | Minor, 1 lane by 3 rows; drawn at the footprint's near edge   |
| `ball-bounce`                    | sprite | 16×24         | `bounce`                             | core | Minor crosser; white with red stripes, unlike `gag-ball`      |
| `cyclist`                        | sprite | 32×48         | `ride`                               | core | Minor; rides down a lane                                      |
| `loose-dog`                      | sprite | 32×32         | `run`                                | core | Crosser; the `other-dog` corgi with a broken leash            |
| `squirrel-dash`                  | sprite | 32×32         | `run`                                | core | Crosser                                                       |
| `ui-warning`, `ui-warning-arrow` | sprite | 16×16         | `pulse`; the arrow also `down-pulse` | core | Hazard cue at the lane edge                                   |

### Depth variants

Same tags, frames and durations as the original.

| Key                                                                                                       | Size `@75`, `@50` | Pri  |
| --------------------------------------------------------------------------------------------------------- | ----------------- | ---- |
| `ball-bounce`                                                                                             | 12×18, 8×12       | core |
| `bench`                                                                                                   | 66×18, 44×12      | core |
| `bin`, `cone`, `dog-<name>`, `goose`, `hydrant`, `loose-dog`, `skunk`, `spot-water-bowl`, `squirrel-dash` | 24×24, 16×16      | core |
| `cafe-patio`, `skunk-cloud`                                                                               | 66×30, 44×20      | core |
| `cyclist`, `lemonade-stand`, `spot-lamp-post`, `spot-stranger`, `spot-tree`                               | 24×36, 16×24      | core |
| `fx-status-<status>`, `lost-wallet`, `tip`, `treat`                                                       | 12×12, 8×8        | core |
| `other-dog`, `squirrel` (`@50` only)                                                                      | 16×16             | core |
| `petunias`, `picnic`, `trash-bins`                                                                        | 66×24, 44×16      | core |

## Effects

| Key                     | Type   | Size             | Tags              | Pri   | Note                                                                                                            |
| ----------------------- | ------ | ---------------- | ----------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| `fx-bark`               | sprite | 16×16            | `pop`             | core  | Pull tell                                                                                                       |
| `fx-bump`               | sprite | 32×32            | `play`            | core  | Impact star on any hit                                                                                          |
| `fx-coins`              | sprite | 32×32            | `play`            | core  | Coins knocked loose on a minor bump                                                                             |
| `fx-dizzy`              | sprite | 32×16            | `loop`            | core  | Over the walker while a minor bump locks lane input                                                             |
| `fx-heart`              | sprite | 16×16            | `up`, `down`      | later | ♥ change at a slot                                                                                              |
| `fx-hit-<encounter>`    | sprite | 64×64            | `play`            | core  | cafe, goose, other-dog, petunias, picnic, puddle, skunk, squirrel, thief, trash                                 |
| `fx-lemonade`           | sprite | 64×64            | `play`            | core  | Lucky hit at the lemonade stand                                                                                 |
| `fx-sparkle`            | sprite | 16×16            | `play`            | core  | Pickup collected                                                                                                |
| `fx-splash`             | sprite | 32×32            | `play`            | core  | Puddle                                                                                                          |
| `fx-status-<status>`    | sprite | 16×16            | `loop`            | core  | soaked, spooked, stinky; over a dog's head                                                                      |
| `ui-hit-flash-<colour>` | sprite | 16×64            | `play`            | core  | amber, green, orange, pink, sky, white (per encounter in `style-guide.md`); left edge strip, mirrored for right |
| `ui-hit-label`          | sprite | 24×24 nine-slice | `normal`, `lucky` | core  | Stretched to 176×32; `lucky` for lucky encounters                                                               |

## Dog needs

| Key                | Type   | Size  | Tags                     | Pri  | Note                                                               |
| ------------------ | ------ | ----- | ------------------------ | ---- | ------------------------------------------------------------------ |
| `accident-spot`    | sprite | 16×16 | `idle`                   | core | Ground decal left by `fx-accident`, drawn under everything         |
| `fx-accident`      | sprite | 32×32 | `play`                   | core | A Regular dog's accident, laid on the dog's frame                  |
| `fx-need-met`      | sprite | 48×48 | `<need>`                 | core | Need fulfilled; bottom-centre on the dog's feet                    |
| `fx-pull-fail`     | sprite | 16×16 | `play`                   | core | A blocked pull, over the dog's head                                |
| `icon-need-<need>` | sprite | 16×16 | `normal`                 | core | friendly, nosy, playful, regular, thirsty                          |
| `spot-lamp-post`   | sprite | 32×48 | `idle`                   | core | Nosy spot                                                          |
| `spot-stranger`    | sprite | 32×48 | `idle`, `wave`           | core | Friendly spot                                                      |
| `spot-tree`        | sprite | 32×48 | `idle`                   | core | Regular spot                                                       |
| `spot-water-bowl`  | sprite | 32×32 | `idle`                   | core | Thirsty spot                                                       |
| `ui-pull-blocked`  | sprite | 10×10 | `normal`                 | core | Over the bubble's top-right corner when a pull is blocked          |
| `ui-pull-bubble`   | sprite | 32×28 | `idle`, `show`, `urgent` | core | Over a dog with an urgent need; the game draws the need icon in it |

## Road and backdrop

| Key                 | Type   | Size    | Tags            | Pri  | Note                                                                                        |
| ------------------- | ------ | ------- | --------------- | ---- | ------------------------------------------------------------------------------------------- |
| `road-<zone>`       | image  | 280×64  |                 | core | snooze-crescent, bark-park, woof-way, sniff-street-shops, paws-promenade, the-long-way-home |
| `road-<zone>-start` | image  | 280×64  |                 | core | Every zone: a neutral cross street on rows 20 to 63, the zone on rows 0 to 19               |
| `backdrop-<zone>`   | image  | 360×110 |                 | core | Every zone; screen rows 40 to 149                                                           |
| `gag-cat`           | sprite | 24×24   | `idle`, `react` | core | On a fence                                                                                  |
| `gag-sprinkler`     | sprite | 32×24   | `spray`         | core |                                                                                             |
| `gag-ball`          | sprite | 14×14   | `roll`          | core | Rolls along the sidewalk                                                                    |

## Doghouse row and top bar

| Key                                          | Type   | Size              | Tags                             | Pri  | Note                                                        |
| -------------------------------------------- | ------ | ----------------- | -------------------------------- | ---- | ----------------------------------------------------------- |
| `ui-doghouse`                                | sprite | 120×90            | one per dog key, `empty`         | core | One per slot, three in a row                                |
| `ui-doghouse-warn`                           | sprite | 120×90            | `pulse`, `static`                | core | Overlay at 1 ♥                                              |
| `ui-heart`                                   | sprite | 8×7               | `full`, `empty`                  | core | Full is darkRed, empty a hollow darkBrown outline           |
| `ui-fired-plate`                             | sprite | 24×24 nine-slice  | `laid-back`, `fussy`, `dramatic` | core | Stretched to 72×28                                          |
| `fx-fired-pop`                               | sprite | 64×64             | `play`                           | core | Drawn at 2× behind the fired face                           |
| `fx-coin-fly`                                | sprite | 12×12             | `spin`                           | core | Fee payout                                                  |
| `ui-payout-label`                            | sprite | 24×16 three-slice | `normal`                         | core | Stretched to 60×16                                          |
| `fx-treat-pop`                               | sprite | 24×24             | `play`                           | core | Where a given treat lands                                   |
| `ui-quip`                                    | image  | 24×24 nine-slice  |                                  | core |                                                             |
| `ui-quip-tail`                               | image  | 6×8               |                                  | core | Points left at the owner; covers the bubble's left rim      |
| `ui-quip-tail-down`                          | image  | 8×6               |                                  | core | Points down, for a bubble above the doghouse row            |
| `icon-soaked`, `icon-spooked`, `icon-stinky` | image  | 16×16             |                                  | core | Doghouse status icons                                       |
| `ui-top-bar`                                 | image  | 360×40            |                                  | core |                                                             |
| `ui-strip-well`                              | image  | 24×24 nine-slice  |                                  | core | State strip tab under the zone well, right-aligned at x 356 |
| `icon-upgrade-<upgrade>`                     | image  | 16×16             |                                  | core | State strip; one per upgrade id (9)                         |
| `icon-gear-<gear>`                           | image  | 16×16             |                                  | core | State strip; one per gear id (5)                            |
| `icon-money`                                 | image  | 16×16             |                                  | core | Also cards, shop and end screen                             |
| `ui-zone-pips`                               | sprite | 18×8              | `todo`, `<zone>`, `<zone>-done`  | core | One pip per zone of the route, 3px apart                    |
| `icon-zone-<zone>`                           | image  | 16×16             |                                  | core | Every zone                                                  |

## Choice cards and help

| Key                           | Type   | Size    | Tags                                             | Pri  | Note                                                                                   |
| ----------------------------- | ------ | ------- | ------------------------------------------------ | ---- | -------------------------------------------------------------------------------------- |
| `card-frame`                  | sprite | 83×140  | `encounter`, `lucky`, `stop`, `upgrade`, `route` | core | `route` for a fork's path cards                                                        |
| `card-frame-large`            | sprite | 166×280 | as `card-frame`                                  | core | Tap-to-enlarge view                                                                    |
| `card-cost`                   | image  | 71×13   |                                                  | core | Cost plaque, at 2× on the large frame                                                  |
| `card-<encounter>-<option>`   | image  | 75×56   |                                                  | core | One per option of the encounters, lucky encounters and forced stops                    |
| `card-<upgrade>`, `card-skip` | image  | 75×56   |                                                  | core | One per upgrade (9), and Poop bags' Skip                                               |
| `card-<need card>-<option>`   | image  | 75×56   |                                                  | core | accident, good-spot, pee-mail, play-date, stranger-loves, water-stop; two options each |
| `card-zone-<zone>`            | image  | 75×56   |                                                  | core | A fork's path card: the zone's road to a cross street, its backdrop scenery beyond     |
| `help-<page>`                 | image  | 344×236 |                                                  | core | lanes, pickups, cards, owners, pulls, zones                                            |

Card keys use the data keys (`card-kid-wants-to-pet-pet`, `card-second-wind`). The generous neighbour and photo op open no card: `card-biscuit-neighbour-take` and `card-photo-op-pose` are their popup art. `card-accident-walk-on` shows the grumpy neighbour.

## Screens and home

| Key                                                           | Type   | Size                                       | Tags                  | Pri   | Note                                                                                     |
| ------------------------------------------------------------- | ------ | ------------------------------------------ | --------------------- | ----- | ---------------------------------------------------------------------------------------- |
| `screen-end`, `screen-home`, `screen-loading`, `screen-stats` | image  | 360×560                                    |                       | core  |                                                                                          |
| `logo`                                                        | image  | 128×30                                     |                       | later | Yard sign board; also baked into `screen-loading`                                        |
| `ui-loading-track`                                            | image  | 200×8                                      |                       | core  |                                                                                          |
| `ui-loading`                                                  | sprite | 48×32                                      | `walk`                | core  | Casey and Biscuit                                                                        |
| `ui-new-best`                                                 | image  | 72×20                                      |                       | core  | End screen ribbon                                                                        |
| `fx-new-best`                                                 | sprite | 96×48                                      | `play`                | core  | Burst behind `ui-new-best`                                                               |
| `badge-<achievement>`                                         | sprite | 32×32                                      | `earned`, `locked`    | core  | 15; achievement name in kebab case                                                       |
| `fx-confetti`                                                 | sprite | 64×64                                      | `play`                | core  | Behind a badge as it is earned                                                           |
| `icon-trait-<trait>`                                          | image  | 16×16                                      |                       | core  | chaser, fancy, food-driven                                                               |
| `icon-quirk-<dog>`                                            | image  | 16×16                                      |                       | core  | One per dog, by dog id (9)                                                               |
| `icon-energy-<energy>`                                        | image  | 16×16                                      |                       | core  | calm, steady, hyper                                                                      |
| `icon-owner-<temperament>`                                    | image  | 16×16                                      |                       | core  | laid-back, fussy, dramatic                                                               |
| `item-<gear>`                                                 | image  | 32×32                                      |                       | core  | One per gear id (5)                                                                      |
| `ui-slot-locked`                                              | image  | 160×46                                     |                       | core  | Yard sign for the next dog slot; the game writes two lines                               |
| `ui-detail-card`, `ui-detail-band`, `ui-detail-well`          | image  | 24×24 nine-slice, 24×22 three-slice, 68×68 |                       | core  | Hold-to-open detail card                                                                 |
| `ui-check`                                                    | sprite | 16×16                                      | `1`, `2`, `3`, `tick` | core  | Pick badge                                                                               |
| `ui-select`                                                   | sprite | 24×24 nine-slice                           | `pulse`               | core  | Selected frame                                                                           |
| `ui-afford`                                                   | sprite | 24×24 nine-slice                           | `glint`               | core  | Affordable frame                                                                         |
| `ui-hint`                                                     | image  | 24×24 nine-slice                           |                       | core  | First-time hint bubble                                                                   |
| `ui-hint-tail`                                                | image  | 8×6                                        |                       | core  |                                                                                          |
| `ui-zone-banner`                                              | image  | 248×48                                     |                       | core  | The game writes both lines                                                               |
| `ui-difficulty`                                               | sprite | 55×10                                      | `1` to `5`            | core  | Under a zone's name on a fork's path card: that many filled paws out of five, 11px apart |
| `fx-dust`, `fx-tap`                                           | sprite | 16×16                                      | `play`                | core  |                                                                                          |

## UI kit

| Key                                                                                                             | Type   | Size              | Tags                                                                                                 | Pri   | Note                                                                |
| --------------------------------------------------------------------------------------------------------------- | ------ | ----------------- | ---------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------- |
| `font-body`, `font-title`                                                                                       | font   | 8px               |                                                                                                      | core  | Includes `$` and a drawn `♥`                                        |
| `ui-button`                                                                                                     | sprite | 24×24 nine-slice  | `normal`, `pressed`, `disabled`, `secondary`, `secondary-pressed`, `go`, `go-pressed`, `go-disabled` | core  |                                                                     |
| `ui-icon-button`                                                                                                | sprite | 20×20             | `normal`, `pressed`                                                                                  | core  | Icon at +2,+1 (+2,+3 pressed)                                       |
| `ui-panel`                                                                                                      | image  | 24×24 nine-slice  |                                                                                                      | core  |                                                                     |
| `ui-section`                                                                                                    | sprite | 24×32 nine-slice  | `incomplete`, `complete`, `neutral`                                                                  | core  | Start screen section: insets 3, 3, 24, 3; the band is the top slice |
| `ui-switch`                                                                                                     | sprite | 32×16             | `on`, `off`                                                                                          | core  |                                                                     |
| `ui-slider`                                                                                                     | sprite | 24×10 three-slice | `filled`, `empty`, `filled-disabled`, `empty-disabled`                                               | core  |                                                                     |
| `ui-slider-knob`                                                                                                | sprite | 10×16             | `normal`, `pressed`, `disabled`                                                                      | core  |                                                                     |
| `icon-sound`, `icon-music`                                                                                      | sprite | 16×16             | `on`, `off`                                                                                          | core  |                                                                     |
| `icon-<setting>-panel`                                                                                          | sprite | 16×16             | `on`, `off`                                                                                          | core  | sound, music, effects, motion; Settings rows                        |
| `icon-close`, `icon-help`, `icon-home`, `icon-lock`, `icon-logbook`, `icon-pause`, `icon-play`, `icon-settings` | image  | 16×16             |                                                                                                      | core  |                                                                     |
| `ui-touch-hint`                                                                                                 | image  | 96×36             |                                                                                                      | later | The game writes "drag to switch lanes"                              |
| App icons (not in manifest)                                                                                     | PNG    | 16 to 512         |                                                                                                      | core  | `art/tools/appicons.py`                                             |

## Sounds

| Key                                                                                                                                                       | Pri  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `music-walk`, `sfx-badge`, `sfx-bark`, `sfx-bump`, `sfx-card`, `sfx-fired`, `sfx-hit-<encounter>`, `sfx-lemonade`, `sfx-new-best`, `sfx-tip`, `sfx-treat` | core |
