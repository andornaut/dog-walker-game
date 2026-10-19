# Game Design

The game as currently planned: rules, content, starting numbers and milestones. It is the first complete game, set in one world, Maple Street. What comes later lives in [`next.md`](next.md), and undecided ideas in [`ideas.md`](ideas.md). Numbers and content lists are starting values to tune by playing.

## Pitch

_Draft from the 2026-10-18 session, not yet polished:_ a cozy pixel-art lane runner where you walk a pack of dogs through the neighbourhood, and every bump in the road turns into a choice.

Theme: you're a dog walker trying to make money.

## Pillars

1. **Cozy, not frantic:** calm speed, forgiving failure, "one more walk" appeal; playable for long stretches without stress
2. **Every bump is a story:** collisions lead to choices, not game over
3. **Charming chaos:** cute dogs, dramatic owners, silly neighbourhood

## Core loop

- **Before a run:** pick your dogs and your loadout (gear from permanent unlocks).
- **During a run:** the street scrolls toward you; switch lanes to dodge obstacles and grab pickups. Hitting an obstacle opens a choice card. Each zone has one forced stop that always opens a choice.
- **Between zones:** pick 1 of 3 upgrade cards (some are trade-offs).
- **After a run:** bank your earnings and spend them on the home screen: new dogs, gear, training, walker kit and cosmetics.

Reference points: Bowling Ballers (lane runner, but calmer), Hades (zones, run structure, loadout, meta progression), Vampire Survivors (choices along the way), Slay the Spire (choices as cards).

## The game in one paragraph

Pick 1–3 of your unlocked dogs (3 to start, 9 in all) and one piece of gear, then walk a fixed route of 4 zones through Maple Street, the first world. The street scrolls toward you at a relaxed pace; switch between 5 lanes to dodge trouble and grab treats and tips. Hitting an obstacle opens a choice card, and which owners it upsets depends on the dogs' traits. Each zone has one forced stop. After zones 1–3, pick 1 of 3 upgrade cards. Each dog pays a share of its fee for every zone it survives; if an owner's happiness hits zero, they fire you and the dog leaves. The run ends when you finish zone 4 or run out of dogs, and you keep what you've earned. Banked money buys gear and new dogs for future walks.

## Rules

### Screen & controls

- Designed touch-first: keyboard (web) and touch (mobile); mouse is not planned
- Layout: a top status bar (money, zone progress), a fixed-width dog column on the left with one slot per dog, and the road filling the rest. Encounter cards cover the paused, dimmed road; the status bar and dog column stay visible. Layout details live in [`art/style-guide.md`](../art/style-guide.md)
- Portrait orientation, ¾ top-down view
- 5 lanes. Keyboard: ←/→, A/D or H/L. Touch: tap the left/right half of the screen, or swipe left/right (both work). Each press, tap or swipe moves one lane; holding a key or finger keeps moving lane to lane. Taps on the dog column give a treat instead of moving
- While moving between lanes, the pack can hit things in either lane. A reverse press turns the pack around at once; any other press, and any pull, waits for the current move to finish (latest wins)
- The top bar holds the pause button (head home lives in pause); taps on it never move the pack
- Spawning always leaves a path you can reach in time, so every hit is avoidable
- A hit obstacle is removed after its card, then ~1s in which obstacles are ignored; pickups still count
- Walker at the bottom, dogs just ahead in the same lane; the pack collides as one unit
- Calm speed: scroll speed and density both rise gently per zone, never frantic
- Pulling: now and then a dog pulls the pack one lane, toward its trait's target (Food-driven: a nearby treat; Chaser: a squirrel) or at random. Each extra dog adds another chance of a pull; you can always steer back. The size-based input lock starts when the pull's lane move finishes. About 1s before a pull, the dog leans toward that side and barks
- Area effects (skunk, puddle) roll once per dog on contact, so a bigger pack is more likely to have someone caught; small dogs are nimble and roll half as often. The card then shows which dogs were caught, so its outcomes stay fixed; if nobody is caught, there is no card

### Resources

- **Money ($):** the only currency; earned during the run (tips, per-zone fees); spent in encounters (costs are per affected dog); banked at the end. Money is tracked in cents and shown in whole dollars
- **Owner happiness (♥):** one meter per dog, starts at 4–6 depending on the owner's temperament; max 6, 8 or 10 depending on the dog's size. Shown as the dog's and owner's faces plus the meter. At 0 the owner fires you (with a quip) and the dog leaves

### A run

- 4 zones in a fixed order (e.g. street, park, shops, home stretch), each a fixed distance. Zone 1 takes ~3.8 minutes at base speed, and the speed ramp shortens later zones to ~3.2, ~2.7 and ~2.4 minutes (a full run is ~12 minutes)
- One forced stop per zone
- After zones 1, 2 and 3: choose 1 of 3 upgrade cards
- After each zone: every remaining dog pays a share of its fee; a dog fired mid-zone isn't paid for that zone
- When an owner fires you, they take back every fee their dog earned this run (tips stay)
- Ends after zone 4 or when no dogs are left; everything earned is kept, except fees taken back by owners who fired you
- Head home: available any time from the pause menu; keeps tips and earlier zones' fees, but the current zone pays nothing

### Choice cards

- Three across, art-led: illustration plus a one-line effect; tap to enlarge for details
- Used for encounters, forced stops and upgrades
- Each option's outcome is fixed and shown on the card
- An option you can't afford is disabled; every encounter keeps at least one free option
- Slower options cost money (missed tips) instead of time
- Choices only: no minigames

### Pickups (things you _want_ to hit)

- Treat: carried (up to 3); tap a dog's slot in the dog column to give its owner +1 ♥
- Tip: +$. Smaller packs earn bigger tips: passers-by tip more for a calm walk

### Dogs (roster of 9, pick 1–3)

Every dog is a fixed, named character with its own art, one value of each attribute, and one fixed owner, so players can have favourites.

| Attribute         | Values                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Size              | Small · medium · big. No size is a straight upgrade. Pull strength: after a pull, lane input locks for none (small), a moment (medium) or ~0.5s (big). Max happiness: 6 small, 8 medium, 10 big. Who you meet: each small dog attracts more Other dog encounters, each big dog fewer, and any big dog scares thieves away. Small dogs are nimble: they roll half as often for area effects |
| Trait             | **Fancy:** puddles upset its owner more · **Food-driven:** pulls the pack toward nearby treats · **Chaser:** squirrels upset its owner; pulls toward them                                                                                                                                                                                                                                  |
| Energy            | Calm · steady · hyper. Sets how often the dog pulls the pack                                                                                                                                                                                                                                                                                                                               |
| Owner temperament | **Laid-back:** starts at 6 ♥ · **Fussy:** starts at 4 ♥, pays $13 instead of $10 · **Dramatic:** starts at 5 ♥, every ♥ gained or lost counts double, still within 0 and the dog's max; also sets the quip tone                                                                                                                                                                            |

| Dog      | Breed           | Size   | Trait       | Energy | Owner                                  | Look                                  | Start    |
| -------- | --------------- | ------ | ----------- | ------ | -------------------------------------- | ------------------------------------- | -------- |
| Duchess  | Maltese         | Small  | Fancy       | Calm   | Rosa, retired florist (laid-back)      | White coat, pink bow                  | Unlocked |
| Nugget   | Pug             | Small  | Food-driven | Steady | Kevin, pet influencer (dramatic)       | Fawn, black mask, tiny bandana        | Shop     |
| Zippy    | Jack Russell    | Small  | Chaser      | Hyper  | Mr. Pruitt, retired accountant (fussy) | White with tan patches, red collar    | Shop     |
| Pierre   | Standard poodle | Medium | Fancy       | Steady | Madame Lefevre, dog-show judge (fussy) | Apricot, show-clip pom-poms           | Shop     |
| Biscuit  | Beagle          | Medium | Food-driven | Hyper  | Sam, barista (laid-back)               | Tricolour, floppy ears, green collar  | Unlocked |
| Dash     | Whippet         | Medium | Chaser      | Calm   | Ophelia, stage actor (dramatic)        | Grey brindle, knit sweater            | Shop     |
| Snowball | Samoyed         | Big    | Fancy       | Hyper  | Tiffany, wedding planner (dramatic)    | Fluffy white, collar with a bell      | Shop     |
| Waffles  | Saint Bernard   | Big    | Food-driven | Calm   | Dr. Hughes, dentist (fussy)            | Brown and white, little barrel collar | Shop     |
| Koda     | Husky           | Big    | Chaser      | Steady | Jesse, trail runner (laid-back)        | Grey and white, blue eyes, harness    | Unlocked |

Each size and trait pairs once, and each energy and temperament appears three times. The three starters cover every size and trait, with laid-back owners for an easier first run.

More dogs means more fees and a longer-lasting run, but smaller tips, more owners to keep happy, more pulls and more area-effect rolls. After every card choice, the affected owner reacts with a quip. The walker is one fixed character.

### Encounters (things you hit by accident → choice card)

| Encounter | Who's affected                                         | Options                                                                        |
| --------- | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Skunk     | Area effect: dogs caught by the roll                   | Pay $$$ for grooming · Pay $ for a quick rinse → _Stinky_ · Ignore → −2 ♥ each |
| Squirrel  | Chasers (none: harmless scenery, no card)              | Hold tight → −1 ♥ · Let them chase → lose $ (dropped tips)                     |
| Puddle    | Area effect: dogs caught by the roll; Fancy dogs worse | Go through → −1 ♥ (−2 Fancy) · Pay $ for a towel                               |
| Other dog | All dogs                                               | Let them sniff → +1 ♥ each, −$ per dog (missed tips) · Pull away → −1 ♥ each   |
| Thief     | All dogs (none if any big dog: it flees, no card)      | Chase them off → −1 ♥ each (dogs worked up) · Let it go → −$ (stolen tips)     |

### Lucky encounters (good things to bump into → choice card)

| Encounter         | Options                                                                           |
| ----------------- | --------------------------------------------------------------------------------- |
| Lost wallet       | Return it → +1 ♥ each (owners are proud) · Keep it → +$, −1 ♥ each                |
| Biscuit neighbour | Take biscuits → +1 treat per dog, up to the carry limit · Politely pass → nothing |
| Photo op          | Pose → +$ tip, +1 ♥ to dramatic owners · Wave and walk on → nothing               |

Scenery gags (a cat on a fence, a sprinkler, a ball rolling past) open no card and have no effect.

### Forced stops (one per zone, drawn at random with no repeats in a run)

- Stop sign: wait patiently → −$ per dog (missed tips) · dart across → −1 ♥ each
- Chatty neighbour: chat → +$ tip, −$ per dog (missed tips) · politely move on → nothing
- Kid wants to pet them: let them pet → +1 ♥ each, −$ per dog (missed tips) · politely decline → −1 ♥ to one random owner
- Ice cream truck: buy pup cups → −$ per dog, +1 ♥ each · walk past → −1 ♥ to Food-driven owners
- Construction detour: take the long way → −$ per dog (missed tips) · squeeze past → −1 ♥ to Fancy owners (dust)
- Mail carrier: hold them back → −1 ♥ each (barking) · wait it out → −$ per dog (missed tips)

### Debuff

- **Stinky:** tips are halved for the rest of the zone. A second skunk refreshes it (no stacking); Ignore doesn't apply it

### Upgrade cards (between zones; pool of 9)

Run-only boosts, plus two trade-off cards. A picked card leaves the pool for the rest of the run:

- Belly rubs: +1 ♥ to every owner now
- Good leash: squirrels can't upset your chasers, and chasers don't pull toward them
- Big tipper: tips worth +50%
- Shortcut: next zone is shorter, but its fees −25% (trade-off)
- Rush hour: more tips _and_ more obstacles for the next zone (trade-off)
- Raincoats: puddles can't upset anyone for the rest of the run
- Treat magnet: treats count from one lane away
- Steady hands: dogs pull the pack half as often
- Sweet talker: every $ cost on a card, missed tips included, is $2 less per dog for the rest of the run

### Home screen and progression

- Money earned in a run is banked
- The home screen is also the shop: tap a locked dog or gear item to buy it; there is no separate shop screen
- **Gear** (5 items, permanent, bought once): fanny pack (start with +$); whistle (thieves flee even without a big dog); poop bags (once per run, an encounter card offers a free Skip option); running shoes (no lane-input lock after a pull); Lucky collar (every owner starts with +1 ♥ and has +1 max ♥). Pick up to 1 owned item before each run (none is allowed, e.g. on a first run). Equipped gear shows as a badge beside the walker
- **Dog training:** level up a dog you own, e.g. calmer energy or a smaller pull lock. Options and prices to design
- **Walker kit:** permanent, always-on walker upgrades, e.g. a bigger treat pouch or faster lane changes. Items and prices to design
- **Cosmetic unlocks:** looks-only purchases. Items and prices to design
- **Walker customization:** pick from a few preset walkers (3 to 4 sprites); gear still shows as a badge. Looks to design
- Upgrade cards are the run-only boosts; everything bought on the home screen is permanent (the Hades split between boons and keepsakes)
- **Logbook** (a home screen panel): best walk (amount, zones, dogs), totals (walks, dogs walked, times fired) and the last walk as one line ("Kevin fired you in the park"). Best walk and walk count also sit in the top bar next to the bank
- **Stats page** (behind the logbook): runs played; runs finished, headed home or out of dogs; best run earnings; lifetime earnings; total firings and the owner who fired you most; best zone reached and times each world was finished. Per-dog stats (walks, zones finished, times fired) show on each dog's roster card. The end screen flags a new best
- Progress (bank, owned items, stats) is saved between sessions; see [`tech-plan.md`](../tech-plan.md)

## Starting numbers

Placeholders sized for a ~12-minute run (zone 1 ~3.8 minutes at base speed). Once the tech session has these as typed data in `src/data/`, that becomes the source of truth for numbers and roster stats, and this table is replaced by a link to it. A full run is estimated at ~$110 with 1 dog, ~$95 with 2 and ~$75 with 3, before clawbacks and lucky encounters; buying every dog and gear item ($1,775) takes ~18 runs, before training, walker kit and cosmetics.

| What                         | Value                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Scroll speed                 | +20% per zone (zone 4 at 1.6× base)                                                                                          |
| Obstacles per zone           | 23 in zone 1, +4 per later zone                                                                                              |
| Tips per zone                | 30 in zone 1, +4 per later zone                                                                                              |
| Treats per zone              | 5 (carry up to 3)                                                                                                            |
| Lucky encounters per zone    | 2                                                                                                                            |
| Owner happiness              | Start 6 laid-back · 4 fussy · 5 dramatic; max 6 small · 8 medium · 10 big; treat +1; Lucky collar +1 start and +1 max        |
| Fee per zone survived        | $10; fussy owners $13                                                                                                        |
| Other dog spawns             | +25% per small dog, −25% per big dog                                                                                         |
| Thief: let it go             | −$10                                                                                                                         |
| Area-effect roll             | 50% per dog; small dogs 25%                                                                                                  |
| Pull interval (energy)       | About every 60s calm · 30s steady · 15s hyper                                                                                |
| Input lock after a pull      | Small 0s · medium 0.25s · big 0.5s                                                                                           |
| Pull tell                    | ~1s lean and bark before a pull                                                                                              |
| Tip                          | $1 (Big tipper $1.50, Stinky $0.50); ×1.5 with 1 dog, ×1.25 with 2, ×1 with 3                                                |
| Encounter costs              | $ = $5, $$$ = $15, per affected dog                                                                                          |
| Squirrel: let them chase     | −$10                                                                                                                         |
| Missed tips (slower options) | $5 per dog                                                                                                                   |
| Chatty neighbour tip         | +$15                                                                                                                         |
| Lucky encounters             | Lost wallet kept +$15 · photo op +$10                                                                                        |
| Shortcut                     | Next zone 25% shorter, its fees −25%                                                                                         |
| Rush hour                    | Next zone tips ×2, obstacles ×1.5                                                                                            |
| Shop                         | Each locked dog $150 · fanny pack $100 (start +$15) · whistle $150 · poop bags $175 · running shoes $200 · Lucky collar $250 |

## Milestones

The milestones build the core loop first; placeholder art is fine until Milestone 6.

1. **Setup:** engine chosen, repo, auto-deploy of the web build, coloured-box placeholders
2. **Runner core:** 5 lanes, scrolling, spawning, collisions, keyboard + touch
3. **Encounters:** choice cards, money, per-dog owner happiness, trait targeting, lucky encounters, Stinky, owner quips, dogs leave at 0 ♥
4. **Run structure:** 4 zones, forced stops, upgrade cards, per-zone pay, end screen with earnings
5. **Dogs & home screen:** 9-dog roster (3 unlocked, 6 bought) with 1–3 picks, bank, shop in place, gear and loadout, dog training, walker kit, cosmetic unlocks, walker customization, logbook and stats, save
6. **Pixel pass & phone playtest:** sprites for walker, 9 dogs, 9 owner faces, 5 encounters, 3 lucky encounters, 2 pickups, card frames, card illustrations for the 5 encounters, 3 lucky encounters and 6 forced stops; test on real phones

**Done when:** a run lasts about 12 minutes, we want to play "one more", and it works by touch on a phone browser.

## Tech

Stack, hosting and save storage: see [`tech-plan.md`](../tech-plan.md).

## Next

See [`next.md`](next.md).
