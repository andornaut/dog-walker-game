# v1 Plan

Goal: the smallest web game that proves the core loop is fun. Placeholder art is fine until Milestone 6. Design calls here were agreed 2026-10-18 (see `decisions.md`). Numbers (fees, ♥ values, durations, prices) and content lists are **starting values to tune by playing**, not decisions. Tech choices live in [`tech-plan.md`](../tech-plan.md).

## The v1 game in one paragraph

Pick 1–3 of your unlocked dogs (3 to start, 9 in all) and one piece of gear, then walk a fixed route of 4 zones through one neighbourhood. The street scrolls toward you at a relaxed pace; switch between 5 lanes to dodge trouble and grab treats and tips. Hitting an obstacle opens a choice card, and which owners it upsets depends on the dogs' traits. Each zone has one forced stop. After zones 1–3, pick 1 of 3 upgrade cards. Each dog pays a share of its fee for every zone it survives; if an owner's happiness hits zero, they fire you and the dog leaves. The run ends when you finish zone 4 or run out of dogs, and you keep what you've earned. Banked money buys gear and new dogs for future walks.

## Core rules

### Screen & controls

- Portrait orientation, ¾ top-down view
- 5 lanes. Keyboard: ←/→, A/D or H/L. Touch: tap the left/right half of the screen, or swipe left/right (both work). Each press, tap or swipe moves one lane; holding a key or finger keeps moving lane to lane. Taps on the dog column give a treat instead of moving
- While moving between lanes, the pack can hit things in either lane
- A hit obstacle is removed after its card, then ~1s with no collisions
- Walker at the bottom, dogs just ahead in the same lane; the pack collides as one unit
- Calm speed: scroll speed and density both rise gently per zone, never frantic
- Pulling: now and then a dog pulls the pack one lane, toward its trait's target (Food-driven: a nearby treat; Chaser: a squirrel) or at random. Each extra dog adds another chance of a pull; you can always steer back
- Area effects roll once per dog, so a bigger pack is more likely to have someone affected. Which encounters are area effects, and how the card shows who was caught, is open

### Resources

- **Money ($):** earned during the run (tips, per-zone fees); spent in encounters (costs are per affected dog); banked at the end
- **Owner happiness (♥):** one meter per dog, starts at 4–6 depending on the owner's temperament, max 8. Shown as the dog's and owner's faces plus the meter. At 0 the owner fires you (with a quip) and the dog leaves

### A run

- 4 zones in a fixed order (e.g. street, park, shops, home stretch), each a fixed distance that takes ~3 minutes at base speed (a full run is ~12 minutes)
- One forced stop per zone
- After zones 1, 2 and 3: choose 1 of 3 upgrade cards
- After each zone: every remaining dog pays a share of its fee; a dog fired mid-zone isn't paid for that zone
- Ends after zone 4 or when no dogs are left; everything earned is kept
- Head home: available any time from the pause menu; keeps tips and earlier zones' fees, but the current zone pays nothing

### Choice cards

- Three across, art-led: illustration plus a one-line effect; tap to enlarge for details
- Used for encounters, forced stops and upgrades
- Each option's outcome is fixed and shown on the card
- An option you can't afford is disabled; every encounter keeps at least one free option
- Slower options cost money (missed tips) instead of time

### Pickups (things you _want_ to hit)

- Treat: carried (up to 3); tap a dog's slot in the dog column to give its owner +1 ♥
- Tip: +$

### Dogs (roster of 9, pick 1–3)

Every dog is a fixed, named character with its own art, one value of each attribute, and one fixed owner, so players can have favourites.

| Attribute         | Values                                                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Size              | Small · medium · big. Sets the fee and pull strength: after a pull, lane input locks for none (small), a moment (medium) or ~0.5s (big)                                          |
| Trait             | **Fancy:** puddles upset its owner more · **Food-driven:** pulls the pack toward nearby treats · **Chaser:** squirrels upset its owner; pulls toward them                        |
| Energy            | Calm · steady · hyper. Sets how often the dog pulls the pack                                                                                                                     |
| Owner temperament | **Laid-back:** starts at 6 ♥ · **Fussy:** starts at 4 ♥, fee +50% · **Dramatic:** starts at 5 ♥, every ♥ gained or lost counts double, still within 0–8; also sets the quip tone |

| Dog      | Breed           | Size   | Trait       | Energy | Owner     | Start    |
| -------- | --------------- | ------ | ----------- | ------ | --------- | -------- |
| Duchess  | Maltese         | Small  | Fancy       | Calm   | Laid-back | Unlocked |
| Nugget   | Pug             | Small  | Food-driven | Steady | Dramatic  | Shop     |
| Zippy    | Jack Russell    | Small  | Chaser      | Hyper  | Fussy     | Shop     |
| Pierre   | Standard poodle | Medium | Fancy       | Steady | Fussy     | Shop     |
| Biscuit  | Beagle          | Medium | Food-driven | Hyper  | Laid-back | Unlocked |
| Dash     | Whippet         | Medium | Chaser      | Calm   | Dramatic  | Shop     |
| Snowball | Samoyed         | Big    | Fancy       | Hyper  | Dramatic  | Shop     |
| Waffles  | Saint Bernard   | Big    | Food-driven | Calm   | Fussy     | Shop     |
| Koda     | Husky           | Big    | Chaser      | Steady | Laid-back | Unlocked |

Each size and trait pairs once, and each energy and temperament appears three times. The three starters cover every size and trait, with laid-back owners for an easier first run. Owner names are TBD.

More dogs means more pay and a longer-lasting run, but more owners to keep happy, more pulls and more area-effect rolls. After every card choice, the affected owner reacts with a quip. The walker is one fixed character.

### Encounters (things you hit by accident → choice card)

| Encounter | Who's affected                            | Options                                                                        |
| --------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| Skunk     | All dogs                                  | Pay $$$ for grooming · Pay $ for a quick rinse → _Stinky_ · Ignore → −2 ♥ each |
| Squirrel  | Chasers (none: harmless scenery, no card) | Hold tight → −1 ♥ · Let them chase → lose $ (dropped tips)                     |
| Puddle    | All; Fancy dogs worse                     | Go through → −1 ♥ (−2 Fancy) · Pay $ for a towel                               |
| Other dog | All dogs                                  | Let them sniff → +1 ♥ each, −$ per dog (missed tips) · Pull away → −1 ♥ each   |

Scenery gags (a cat on a fence, a sprinkler, a ball rolling past) open no card and have no effect.

### Forced stops (one per zone, drawn at random with no repeats in a run)

- Stop sign: wait patiently → −$ per dog (missed tips) · dart across → −1 ♥ each
- Chatty neighbour: chat → +$ tip, −$ per dog (missed tips) · politely move on → nothing
- Kid wants to pet them: let them pet → +1 ♥ each, −$ per dog (missed tips) · politely decline → −1 ♥ to one random owner
- Ice cream truck: buy pup cups → −$ per dog, +1 ♥ each · walk past → −1 ♥ to Food-driven owners
- Construction detour: take the long way → −$ per dog (missed tips) · squeeze past → −1 ♥ to Fancy owners (dust)
- Mail carrier: hold them back → −1 ♥ each (barking) · wait it out → −$ per dog (missed tips)

### Debuff (one for v1)

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

### Meta progression (minimal)

- Money earned in a run is banked
- Home screen has a simple shop that sells the 6 locked dogs and 3 loadout items (e.g. fanny pack: start with +$30; poop bags: once per run, an encounter card offers a free Skip option; Lucky collar: every owner starts with +1 ♥)
- Shop items are permanent, gameplay-altering gear: bought once and kept. Upgrade cards are the run-only boosts (the Hades split between keepsakes and boons)
- Pick up to 1 owned item before each run (none is allowed, e.g. on a first run)
- Progress (bank, owned items) is saved between sessions. Where it is stored (e.g. browser storage) is a tech proposal; see [`tech-plan.md`](../tech-plan.md)

## Starting numbers

Placeholders sized for ~3-minute zones. A full run is estimated at ~$175 with 2 dogs and ~$260 with 3.

| What                         | Value                                                                       |
| ---------------------------- | --------------------------------------------------------------------------- |
| Scroll speed                 | +10% per zone (zone 4 at 1.3× base)                                         |
| Obstacles per zone           | 18 in zone 1, +3 per later zone                                             |
| Tips per zone                | 24 in zone 1, +3 per later zone                                             |
| Treats per zone              | 4 (carry up to 3)                                                           |
| Owner happiness              | Start 6 laid-back · 4 fussy · 5 dramatic; max 8; treat +1                   |
| Fee per zone survived        | Small $10 · medium $20 · big $30; fussy owners +50%                         |
| Pull interval (energy)       | About every 60s calm · 30s steady · 15s hyper                               |
| Input lock after a pull      | Small 0s · medium 0.25s · big 0.5s                                          |
| Tip                          | $2 (Big tipper $3, Stinky $1)                                               |
| Encounter costs              | $ = $5, $$$ = $15, per affected dog                                         |
| Squirrel: let them chase     | −$10                                                                        |
| Missed tips (slower options) | $5 per dog                                                                  |
| Chatty neighbour tip         | +$15                                                                        |
| Shortcut                     | Next zone 25% shorter, its fees −25%                                        |
| Rush hour                    | Next zone tips ×2, obstacles ×1.5                                           |
| Shop                         | Fanny pack $100 · poop bags $175 · Lucky collar $250 · each locked dog $150 |

## Explicitly out of v1

Minigames · branching paths between zones · unlockable dog slots · special dogs found mid-walk · more biomes · time of day · weather · off-leash park · permanent unlocks as in-run choices · house hub and decoration · your own dog · art polish beyond a basic pixel pass · sound beyond a few effects · accounts / cloud saves

## Milestones

1. **Setup:** engine chosen, repo, auto-deploy of the web build, coloured-box placeholders
2. **Runner core:** 5 lanes, scrolling, spawning, collisions, keyboard + touch
3. **Encounters:** choice cards, money, per-dog owner happiness, trait targeting, Stinky, owner quips, dogs leave at 0 ♥
4. **Run structure:** 4 zones, forced stops, upgrade cards, per-zone pay, end screen with earnings
5. **Dogs & meta:** 9-dog roster (3 unlocked, 6 in the shop) with 1–3 picks, bank, shop, loadout, save
6. **Pixel pass & phone playtest:** sprites for walker, 9 dogs, 9 owner faces, 4 encounters, 2 pickups, card frames, card illustrations for the 4 encounters and 6 forced stops; test on real phones

**Done when:** a run lasts about 12 minutes, we want to play "one more", and it works by touch on a phone browser.

## Tech

Stack, hosting and save storage: see [`tech-plan.md`](../tech-plan.md).
