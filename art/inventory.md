# Art Inventory

Every art asset v1 needs, derived from `../gameplay/v1-plan.md` and the run screen layout in `../tech-plan.md`. The rules every asset must follow live in `style-guide.md`. Keys are the `public/art/manifest.json` keys (kebab-case). Type is the manifest list: `sprite` (PNG + Aseprite JSON, animations from frameTags), `image` (plain PNG) or `font` (BMFont).

Priority:

- **M6:** in the Milestone 6 pixel pass (walker, 9 dogs, 9 owner faces, 5 encounters, 2 pickups, card frames, card illustrations for the 5 encounters and 6 forced stops)
- **v1:** needed before v1 ships, outside the Milestone 6 list
- **later:** nice to have; placeholders are acceptable for v1

Sizes marked TBD depend on an open decision in the style guide.

## Screen budget

| Region      | Size (px)       | Notes                                      |
| ----------- | --------------- | ------------------------------------------ |
| Canvas      | 360×640         | Portrait, nearest-neighbour scaling        |
| Top bar     | 360×40          | Money, zone progress                       |
| Dog column  | 80×600          | 3 slots of ~72×192, 4px padding            |
| Road        | 280×600 at x=80 | 5 lanes of 56px                            |
| Choice card | ~85×140         | 3 across the road, 8px gaps, centred       |
| Tile        | 32×32           | Road tiles, dogs, obstacles; ~12px margins |

## Characters (road)

Dogs are listed in their own section below. Each of the 9 dogs is a named character with its own road sprite, face and owner face.

| Asset             | Key         | Type   | Size  | Animations                        | Priority | Notes                                              |
| ----------------- | ----------- | ------ | ----- | --------------------------------- | -------- | -------------------------------------------------- |
| Walker            | `walker`    | sprite | 32×48 | `walk`, `lane-left`, `lane-right` | M6       | Seen from behind (¾ top-down), at the bottom       |
| Other dog + owner | `other-dog` | sprite | 32×32 | `walk`                            | M6       | Encounter obstacle; with a 32×48 owner alongside   |
| Stinky effect     | `fx-stinky` | sprite | 32×32 | `loop`                            | v1       | Green stink lines over the pack while Stinky lasts |

## Dogs

Road sprites are seen from above and behind, like the walker. Small dogs sit well inside the 32×32 tile and big dogs fill it. Every road sprite has the animations `walk`, `react` and `pull`. Each dog's look (coat and accessory) must read on both its 32×32 road sprite and its face. Owner faces show the owner's job and temperament (laid-back, fussy or dramatic).

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

| Asset            | Key                | Type   | Size  | Animations       | Priority | Notes                                                      |
| ---------------- | ------------------ | ------ | ----- | ---------------- | -------- | ---------------------------------------------------------- |
| Skunk            | `skunk`            | sprite | 32×32 | `idle`           | M6       |                                                            |
| Squirrel         | `squirrel`         | sprite | 32×32 | `idle`, `run`    | M6       | Harmless scenery when no chaser is in the pack             |
| Puddle           | `puddle`           | sprite | 32×32 | `idle` (shimmer) | M6       | Flat on the road; no shadow                                |
| Thief            | `thief`            | sprite | 32×48 | `walk`, `flee`   | M6       | Pickpocket; flees from a pack with a big dog, with no card |
| Stop sign        | `stop-sign`        | sprite | 32×48 | none             | v1       | Forced stop; may span the full road                        |
| Chatty neighbour | `chatty-neighbour` | sprite | 32×48 | `wave`           | v1       | Forced stop                                                |
| Kid              | `kid`              | sprite | 32×48 | `wave`           | v1       | Forced stop: wants to pet the dogs                         |
| Ice cream truck  | `ice-cream-truck`  | sprite | TBD   | `idle`           | v1       | Forced stop; wider than a lane                             |
| Construction     | `construction`     | sprite | TBD   | none             | v1       | Forced stop: detour barrier across the road                |
| Mail carrier     | `mail-carrier`     | sprite | 32×48 | `walk`           | v1       | Forced stop                                                |

## Pickups (road)

| Asset | Key     | Type   | Size        | Animations    | Priority | Notes               |
| ----- | ------- | ------ | ----------- | ------------- | -------- | ------------------- |
| Treat | `treat` | sprite | 16×16 (TBD) | `idle` (bob)  | M6       | Bone or biscuit     |
| Tip   | `tip`   | sprite | 16×16 (TBD) | `idle` (spin) | M6       | Coin or folded bill |

## Effects

| Asset          | Key          | Type   | Size  | Animations   | Priority | Notes                   |
| -------------- | ------------ | ------ | ----- | ------------ | -------- | ----------------------- |
| Collision puff | `fx-bump`    | sprite | 32×32 | `play`       | v1       | Plays as the card opens |
| Pickup sparkle | `fx-sparkle` | sprite | 16×16 | `play`       | v1       | Treat and tip collected |
| Heart up/down  | `fx-heart`   | sprite | 16×16 | `up`, `down` | later    | Floats from a dog slot  |

Floating numbers (`+$2`, `-1 ♥`) use the pixel font, not sprites.

## Road and scenery (per zone)

Four zones in a fixed order: street, park, shops, home stretch. Each zone needs a road that tiles vertically across the 280px road width, plus a few non-colliding scenery props at the road edges.

| Asset           | Key pattern          | Type  | Size   | Priority | Notes                                             |
| --------------- | -------------------- | ----- | ------ | -------- | ------------------------------------------------- |
| Road strip      | `road-<zone>`        | image | 280×64 | v1       | Seamless vertically; lane edges readable at speed |
| Zone transition | `road-<zone>-start`  | image | 280×64 | later    | Blends from the previous zone                     |
| Scenery props   | `prop-<zone>-<name>` | image | 32×32  | later    | e.g. tree, hydrant, bench, shop awning, mailbox   |

Four zones give 4 road strips (v1) plus 3 transitions and roughly 12 props (later). Milestone 6 can ship a single `road-street` and reuse it.

## Dog column

| Asset            | Key                 | Type   | Size      | Priority | Notes                                                 |
| ---------------- | ------------------- | ------ | --------- | -------- | ----------------------------------------------------- |
| Slot frame       | `ui-dog-slot`       | image  | 72×192    | v1       | 9-slice or fixed; includes an empty state             |
| Dog faces        | `face-dog-<name>`   | sprite | 32×32     | M6       | 9 dogs; frames `happy`, `neutral`, `upset`            |
| Owner faces      | `face-owner-<name>` | sprite | 32×32     | M6       | 9 owners; frames `happy`, `neutral`, `upset`, `fired` |
| Happiness hearts | `ui-heart`          | sprite | 8×8 (TBD) | M6       | Frames `full`, `empty`; up to 8 per slot              |
| Quip bubble      | `ui-quip`           | image  | TBD       | v1       | Owner quip after every card choice and on firing      |
| Stinky badge     | `icon-stinky`       | image  | 16×16     | v1       | Shown while the debuff lasts                          |

## Top bar

| Asset          | Key                | Type   | Size   | Priority | Notes                                        |
| -------------- | ------------------ | ------ | ------ | -------- | -------------------------------------------- |
| Bar background | `ui-top-bar`       | image  | 360×40 | v1       |                                              |
| Money icon     | `icon-money`       | image  | 16×16  | v1       | Reused in cards, shop and end screen         |
| Zone progress  | `ui-zone-pips`     | sprite | TBD    | v1       | 4 segments; frames `done`, `current`, `todo` |
| Zone icons     | `icon-zone-<zone>` | image  | 16×16  | later    | Street, park, shops, home stretch            |

## Choice cards

Each card is a frame plus an illustration plus text drawn in the pixel font. Card art size is an open decision; the illustration sits in roughly the top 85×70 of the ~85×140 card.

| Asset          | Key                | Type   | Size    | Priority | Notes                                                         |
| -------------- | ------------------ | ------ | ------- | -------- | ------------------------------------------------------------- |
| Card frame     | `card-frame`       | sprite | ~85×140 | M6       | Frames `encounter`, `stop`, `upgrade`, `disabled`, `selected` |
| Enlarged frame | `card-frame-large` | sprite | TBD     | v1       | Tap-to-enlarge view; same frames                              |
| Cost badge     | `card-cost`        | image  | TBD     | v1       | Holds `$`, `$$$` or the ♥ change                              |

Illustrations, one per option (`card-<encounter>-<option>`, type `image`). An encounter with two options shows two centred cards:

| Encounter        | Options                                                                                                      | Count | Priority |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | ----- | -------- |
| Skunk            | grooming, quick rinse, ignore                                                                                | 3     | M6       |
| Squirrel         | hold tight, let them chase                                                                                   | 2     | M6       |
| Puddle           | go through, towel                                                                                            | 2     | M6       |
| Other dog        | let them sniff, pull away                                                                                    | 2     | M6       |
| Thief            | chase them off, let it go                                                                                    | 2     | M6       |
| Stop sign        | wait, dart across                                                                                            | 2     | M6       |
| Kid              | let them pet, decline                                                                                        | 2     | M6       |
| Ice cream truck  | buy pup cups, walk past                                                                                      | 2     | M6       |
| Construction     | long way, squeeze past                                                                                       | 2     | M6       |
| Mail carrier     | hold them back, wait it out                                                                                  | 2     | M6       |
| Chatty neighbour | chat, move on                                                                                                | 2     | M6       |
| Poop bags        | skip                                                                                                         | 1     | v1       |
| Upgrades         | belly rubs, good leash, big tipper, shortcut, rush hour, raincoats, treat magnet, steady hands, sweet talker | 9     | v1       |

Total: 33 card illustrations, 23 of them in Milestone 6.

## Screens outside the run

| Asset             | Key                        | Type  | Size    | Priority | Notes                                        |
| ----------------- | -------------------------- | ----- | ------- | -------- | -------------------------------------------- |
| Title / home      | `screen-home`              | image | 360×640 | v1       | Background; bank total and buttons on top    |
| Logo              | `logo`                     | image | TBD     | later    |                                              |
| Dog portraits     | `portrait-dog-<name>`      | image | TBD     | v1       | 9 dogs; larger art for dog pick and the shop |
| Trait icons       | `icon-trait-<trait>`       | image | 16×16   | v1       | fancy, food-driven, chaser                   |
| Energy icons      | `icon-energy-<energy>`     | image | 16×16   | v1       | calm, steady, hyper                          |
| Temperament icons | `icon-owner-<temperament>` | image | 16×16   | v1       | laid-back, fussy, dramatic                   |
| Shop items        | `item-<item>`              | image | 32×32   | v1       | fanny pack, poop bags, lucky collar          |
| Zone banner       | `ui-zone-banner`           | image | TBD     | v1       | "Zone 2: Park" between zones                 |
| End screen        | `screen-end`               | image | 360×640 | later    | Earnings summary background                  |

## UI kit

| Asset      | Key               | Type   | Size      | Priority | Notes                                                                       |
| ---------- | ----------------- | ------ | --------- | -------- | --------------------------------------------------------------------------- |
| Pixel font | `font-pixel`      | font   | TBD       | M6       | Needs `$`, `♥`, `+`, `-`, digits, punctuation                               |
| Button     | `ui-button`       | sprite | 9-slice   | v1       | Frames `normal`, `pressed`, `disabled`                                      |
| Panel      | `ui-panel`        | image  | 9-slice   | v1       | Shop, end screen, pause menu with Head home                                 |
| Pause icon | `icon-pause`      | image  | 16×16     | v1       | Top bar; opens the pause menu                                               |
| Touch hint | `ui-touch-hint`   | image  | TBD       | later    | First-run "tap left / right"                                                |
| App icon   | (not in manifest) | PNG    | 16 to 512 | later    | Favicon done (`public/art/favicon.png`, 32 and 16); home-screen sizes later |

## Counts

| Priority | Sprites | Images           | Fonts |
| -------- | ------- | ---------------- | ----- |
| M6       | ~37     | 23 (card illus.) | 1     |
| v1       | ~13     | ~45              | 0     |
| later    | ~1      | ~23              | 0     |

## Settled

- **People are 32×48:** the walker, the other dog's owner and the forced-stop characters stand over a tile and a half, so they read taller than the dogs.
- **The leash is drawn in code:** a 1px line from hand to collar in a palette colour, so it follows the dogs without art.
- **Faces are 32×32 for now:** the run screen mock's default. They fill only the top ~75px of each 192px slot, so 48×48 faces or a full-body dog stay an option when the style is refined.
- **One illustration per option:** each card shows its own outcome. Encounters with two options show two centred cards.

## Open questions

- **Pack arrangement:** 1 to 3 dogs share one 56px lane ahead of the walker. Side by side does not fit 3×32px, so they need a staggered formation; the art needs to know the offsets.
