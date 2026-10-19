# v1 Plan

Goal: the smallest web game that proves the core loop is fun. Placeholder art is fine until Milestone 6. Design calls here were agreed 2026-10-18 (see `decisions.md`). Numbers (fees, ♥ values, durations, prices) and content lists are **starting values to tune by playing**, not decisions. Tech choices live in `tech-plan.md`.

## The v1 game in one paragraph

Pick 1–3 dogs from a roster of 3 and one piece of gear, then walk a fixed route of 4 zones through one neighbourhood. The street scrolls toward you at a relaxed pace; switch between 5 lanes to dodge trouble and grab treats and tips. Hitting an obstacle opens a choice card, and which owners it upsets depends on the dogs' traits. Each zone has one forced stop. After zones 1–3, pick 1 of 3 upgrade cards. Each dog pays a share of its fee for every zone it survives; if an owner's happiness hits zero, they fire you and the dog leaves. The run ends when you finish zone 4 or run out of dogs, and you keep what you've earned. Banked money buys gear for future walks.

## Core rules

### Screen & controls

- Portrait orientation, ¾ top-down view
- 5 lanes. Keyboard: ←/→ or A/D. Touch: tap the left/right half of the screen (or swipe)
- Walker at the bottom, dogs just ahead in the same lane; the pack collides as one unit
- Calm speed: gets slightly busier per zone, never frantic

### Resources

- **Money ($):** earned during the run (tips, per-zone fees); spent in encounters; banked at the end
- **Owner happiness (♥):** one meter per dog, starts at 5. Shown as the dog's and owner's faces plus the meter. At 0 the owner fires you (with a quip) and the dog leaves

### A run

- 4 zones in a fixed order (e.g. street, park, shops, home stretch), ~60s each
- One forced stop per zone
- After zones 1, 2 and 3: choose 1 of 3 upgrade cards
- After each zone: every remaining dog pays a share of its fee
- Ends after zone 4 or when no dogs are left; everything earned is kept

### Choice cards

- Three across, art-led: illustration plus a one-line effect; tap to enlarge for details
- Used for encounters, forced stops and upgrades

### Pickups (things you _want_ to hit)

- Treat: +1 ♥ to the unhappiest owner
- Tip: +$

### Dogs (roster of 3, pick 1–3)

| Dog                    | Fee    | Trait                                             |
| ---------------------- | ------ | ------------------------------------------------- |
| Small (e.g. chihuahua) | Low    | **Fancy:** puddles and mud upset its owner more   |
| Medium (e.g. lab)      | Medium | **Food-driven:** treats pull the pack toward them |
| Big (e.g. husky)       | High   | **Chaser:** squirrels upset its owner             |

More dogs means more pay and a longer-lasting run, but more owners to keep happy.

### Encounters (things you hit by accident → choice card)

| Encounter | Who's affected        | Options                                                                        |
| --------- | --------------------- | ------------------------------------------------------------------------------ |
| Skunk     | All dogs              | Pay $$$ for grooming · Pay $ for a quick rinse → _Stinky_ · Ignore → −2 ♥ each |
| Squirrel  | Chasers               | Hold tight → −1 ♥ · Let them chase → lose $ (dropped tips)                     |
| Puddle    | All; Fancy dogs worse | Go through → −1 ♥ (−2 Fancy) · Pay $ for a towel                               |
| Other dog | All dogs              | Let them sniff → +1 ♥ each, slower for 5s · Pull away → −1 ♥ each              |

### Forced stops (one per zone, pool TBD)

- Stop sign: wait patiently, or dart across (risk −♥)
- Chatty neighbour: chat (slower, maybe a tip), or politely move on

### Debuff (one for v1)

- **Stinky:** tips are halved for the rest of the zone

### Upgrade cards (between zones; pool of ~8)

Mostly run-only boosts, plus a couple of lose-lose cards. Examples:

- Treat pouch: +1 ♥ to every owner now
- Good leash: squirrels can't upset your chasers
- Big tipper: tips worth +50%
- Shortcut: next zone is shorter, but its fees −25% (lose-lose)
- Rush hour: more tips _and_ more obstacles (lose-lose)

### Meta progression (minimal)

- Money earned in a run is banked
- Home screen has a simple shop with 3 loadout items (e.g. fanny pack: start with +$20; poop bags: one free encounter skip; treat bag: every owner starts at 6 ♥)
- Pick 1 owned item before each run
- Progress (bank, owned items) is saved between sessions. Where it is stored (e.g. browser storage) is a tech proposal; see `tech-plan.md`

## Explicitly out of v1

Minigames · branching paths between zones · unlockable dog slots · special dogs found mid-walk · more biomes · time of day · weather · off-leash park · permanent unlocks as in-run choices · house hub and decoration (Ada's idea) · your own dog · art polish beyond a basic pixel pass · sound beyond a few effects · accounts / cloud saves

## Milestones

1. **Setup:** engine chosen, repo, auto-deploy of the web build, coloured-box placeholders
2. **Runner core:** 5 lanes, scrolling, spawning, collisions, keyboard + touch
3. **Encounters:** choice cards, money, per-dog owner happiness, trait targeting, Stinky, owner quips, dogs leave at 0 ♥
4. **Run structure:** 4 zones, forced stops, upgrade cards, per-zone pay, end screen with earnings
5. **Dogs & meta:** 3-dog roster with 1–3 picks, bank, shop, loadout, save
6. **Pixel pass & phone playtest:** sprites for walker, 3 dogs, owner faces, 4 encounters, 2 pickups, card frames; test on real phones

**Done when:** a run lasts about 5 minutes, both of us want to play "one more", and it works by touch on a phone browser.

## Tech

Stack, hosting and save storage: see `tech-plan.md`.
