# v1 Plan

Goal: the smallest web game that proves the core loop is fun. Placeholder art is fine until Milestone 6. Design calls here were agreed 2026-10-18 (see `decisions.md`). Numbers (fees, ♥ values, durations, prices) and content lists are **starting values to tune by playing**, not decisions. Tech choices live in [`tech-plan.md`](../tech-plan.md).

## The v1 game in one paragraph

Pick 1–3 dogs from a roster of 3 and one piece of gear, then walk a fixed route of 4 zones through one neighbourhood. The street scrolls toward you at a relaxed pace; switch between 5 lanes to dodge trouble and grab treats and tips. Hitting an obstacle opens a choice card, and which owners it upsets depends on the dogs' traits. Each zone has one forced stop. After zones 1–3, pick 1 of 3 upgrade cards. Each dog pays a share of its fee for every zone it survives; if an owner's happiness hits zero, they fire you and the dog leaves. The run ends when you finish zone 4 or run out of dogs, and you keep what you've earned. Banked money buys gear for future walks.

## Core rules

### Screen & controls

- Portrait orientation, ¾ top-down view
- 5 lanes. Keyboard: ←/→ or A/D. Touch: tap the left/right half of the screen, or swipe left/right (both work)
- Walker at the bottom, dogs just ahead in the same lane; the pack collides as one unit
- Calm speed: gets slightly busier per zone, never frantic

### Resources

- **Money ($):** earned during the run (tips, per-zone fees); spent in encounters (costs are per affected dog); banked at the end
- **Owner happiness (♥):** one meter per dog, starts at 5, max 8. Shown as the dog's and owner's faces plus the meter. At 0 the owner fires you (with a quip) and the dog leaves

### A run

- 4 zones in a fixed order (e.g. street, park, shops, home stretch), each a fixed distance that takes ~3 minutes at base speed (a full run is ~12 minutes)
- One forced stop per zone
- After zones 1, 2 and 3: choose 1 of 3 upgrade cards
- After each zone: every remaining dog pays a share of its fee
- Ends after zone 4 or when no dogs are left; everything earned is kept

### Choice cards

- Three across, art-led: illustration plus a one-line effect; tap to enlarge for details
- Used for encounters, forced stops and upgrades
- Each option's outcome is fixed and shown on the card
- An option you can't afford is disabled; every encounter keeps at least one free option
- Slower options cost money (missed tips) instead of time

### Pickups (things you _want_ to hit)

- Treat: +1 ♥ to the unhappiest owner
- Tip: +$

### Dogs (roster of 3, pick 1–3)

| Dog                    | Fee    | Trait                                                           |
| ---------------------- | ------ | --------------------------------------------------------------- |
| Small (e.g. chihuahua) | Low    | **Fancy:** puddles upset its owner more                         |
| Medium (e.g. lab)      | Medium | **Food-driven:** the pack drifts one lane toward a nearby treat |
| Big (e.g. husky)       | High   | **Chaser:** squirrels upset its owner                           |

More dogs means more pay and a longer-lasting run, but more owners to keep happy.

### Encounters (things you hit by accident → choice card)

| Encounter | Who's affected                            | Options                                                                        |
| --------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| Skunk     | All dogs                                  | Pay $$$ for grooming · Pay $ for a quick rinse → _Stinky_ · Ignore → −2 ♥ each |
| Squirrel  | Chasers (none: harmless scenery, no card) | Hold tight → −1 ♥ · Let them chase → lose $ (dropped tips)                     |
| Puddle    | All; Fancy dogs worse                     | Go through → −1 ♥ (−2 Fancy) · Pay $ for a towel                               |
| Other dog | All dogs                                  | Let them sniff → +1 ♥ each, −$ per dog (missed tips) · Pull away → −1 ♥ each   |

### Forced stops (one per zone; pool to design before Milestone 4)

- Stop sign: wait patiently → −$ per dog (missed tips) · dart across → −1 ♥ each
- Chatty neighbour: chat → +$ tip, −$ per dog (missed tips) · politely move on → nothing

### Debuff (one for v1)

- **Stinky:** tips are halved for the rest of the zone

### Upgrade cards (between zones; pool of ~8)

Mostly run-only boosts, plus a couple of trade-off cards. Pool to fill out to ~8 before Milestone 4. Examples:

- Belly rubs: +1 ♥ to every owner now
- Good leash: squirrels can't upset your chasers
- Big tipper: tips worth +50%
- Shortcut: next zone is shorter, but its fees −25% (trade-off)
- Rush hour: more tips _and_ more obstacles for the next zone (trade-off)

### Meta progression (minimal)

- Money earned in a run is banked
- Home screen has a simple shop with 3 loadout items (e.g. fanny pack: start with +$30; poop bags: once per run, an encounter card offers a free Skip option; Lucky collar: every owner starts at 6 ♥)
- Pick up to 1 owned item before each run (none is allowed, e.g. on a first run)
- Progress (bank, owned items) is saved between sessions. Where it is stored (e.g. browser storage) is a tech proposal; see [`tech-plan.md`](../tech-plan.md)

## Starting numbers

Placeholders sized for ~3-minute zones. A full run is estimated at ~$175 with 2 dogs and ~$260 with 3.

| What                         | Value                                                |
| ---------------------------- | ---------------------------------------------------- |
| Obstacles per zone           | 18 in zone 1, +3 per later zone                      |
| Tips per zone                | 24 in zone 1, +3 per later zone                      |
| Treats per zone              | 4                                                    |
| Owner happiness              | Start 5, max 8; treat +1                             |
| Fee per zone survived        | Small $10 · medium $20 · big $30                     |
| Tip                          | $2 (Big tipper $3, Stinky $1)                        |
| Encounter costs              | $ = $5, $$$ = $15, per affected dog                  |
| Squirrel: let them chase     | −$10                                                 |
| Missed tips (slower options) | $5 per dog                                           |
| Chatty neighbour tip         | +$15                                                 |
| Shortcut                     | Next zone 25% shorter, its fees −25%                 |
| Rush hour                    | Next zone tips ×2, obstacles ×1.5                    |
| Shop                         | Fanny pack $100 · poop bags $175 · Lucky collar $250 |

## Explicitly out of v1

Minigames · branching paths between zones · unlockable dog slots · special dogs found mid-walk · more biomes · time of day · weather · off-leash park · permanent unlocks as in-run choices · house hub and decoration · your own dog · art polish beyond a basic pixel pass · sound beyond a few effects · accounts / cloud saves

## Milestones

1. **Setup:** engine chosen, repo, auto-deploy of the web build, coloured-box placeholders
2. **Runner core:** 5 lanes, scrolling, spawning, collisions, keyboard + touch
3. **Encounters:** choice cards, money, per-dog owner happiness, trait targeting, Stinky, owner quips, dogs leave at 0 ♥
4. **Run structure:** design the forced-stop pool and ~8 upgrade cards first; then 4 zones, forced stops, upgrade cards, per-zone pay, end screen with earnings
5. **Dogs & meta:** 3-dog roster with 1–3 picks, bank, shop, loadout, save
6. **Pixel pass & phone playtest:** sprites for walker, 3 dogs, owner faces, 4 encounters, 2 pickups, card frames; test on real phones

**Done when:** a run lasts about 12 minutes, we want to play "one more", and it works by touch on a phone browser.

## Tech

Stack, hosting and save storage: see [`tech-plan.md`](../tech-plan.md).
