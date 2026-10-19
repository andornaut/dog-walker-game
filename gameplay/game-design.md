# Game Design

The game as currently planned: rules, content, starting numbers and milestones. It is the first complete game, set in one world, Maple Street. What comes later lives in [`next.md`](next.md), and undecided ideas in [`ideas.md`](ideas.md). Numbers and content lists are starting values to tune by playing.

## Pitch

_Draft, not yet polished:_ a cozy pixel-art lane runner where you walk a pack of dogs through the neighbourhood, and every bump in the road turns into a choice.

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

Pick as many of your unlocked dogs as you have dog slots (1 slot and 3 dogs to start; up to 3 slots and 9 dogs) and up to one piece of gear, then walk a fixed route of 4 zones through Maple Street, the first world. The street scrolls toward you at a relaxed pace; switch between 5 lanes to dodge trouble, grab treats and tips, and bump into the occasional lucky find. Hitting an obstacle opens a choice card, and which owners it upsets depends on the dogs' traits. Each zone has one forced stop. After zones 1–3, pick 1 of 3 upgrade cards. Each dog pays a share of its fee for every zone it survives; if an owner's happiness hits zero, they fire you and the dog leaves. The run ends when you finish zone 4 or run out of dogs, and you keep what you've earned, minus the fees of any owner who fired you. Banked money buys new dogs, gear, training, walker kit and cosmetics.

## Rules

### Screen & controls

- Designed touch-first: keyboard (web) and touch (mobile); mouse is not planned
- Layout: a top status bar (money, zone progress), a fixed-width dog column on the left with one slot per dog, and the road filling the rest. Encounter cards cover the paused, dimmed road; the status bar and dog column stay visible. Layout details live in [`art/style-guide.md`](../art/style-guide.md)
- Portrait orientation, ¾ top-down view
- 5 lanes. Keyboard: ←/→, A/D or H/L. Touch: tap the left/right half of the road, or swipe left/right (both work). Each press, tap or swipe moves one lane; holding a key or finger keeps moving lane to lane. Taps on the dog column give a treat instead of moving
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
- **Owner happiness (♥):** one meter per dog, starts at 4 or 5 depending on the owner's temperament; max 6, 8 or 10 depending on the dog's size. Shown as the dog's and owner's faces plus the meter. At 0 the owner fires you (with a quip) and the dog leaves

### A run

- 4 zones in a fixed order: Woof Way, Bark Park, Sniff Street Shops and The Long Way Home, each a fixed distance. Zone 1 takes ~3.8 minutes at base speed, and the speed ramp shortens later zones to ~3.2, ~2.7 and ~2.4 minutes (a full run is ~12 minutes)
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
- Money costs are per affected dog, except losses that happen to the pack as a whole (a squirrel chase, a thief), which are charged once
- Money never goes below $0, even after a fee clawback
- An immunity (Raincoats, Good leash, Whistle) means no card opens at all
- A card shows at most 3 options. Poop bags' Skip takes the slot of the most expensive option when a card already has 3
- Choices only: no minigames

### Pickups (things you _want_ to hit)

- Treat: carried (up to 3); tap a dog's slot in the dog column to give its owner +1 ♥
- Tip: +$. Smaller packs earn bigger tips: passers-by tip more for a calm walk

### Dogs (roster of 9, one per dog slot)

You start with 1 dog slot and buy slots 2 and 3 on the home screen, at any time you can pay. Walking more dogs is the main progression.

Every dog is a fixed, named character with its own art, one value of each attribute, and one fixed owner, so players can have favourites.

| Attribute         | Values                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Size              | Small · medium · big. No size is a straight upgrade. Pull strength: after a pull, lane input locks for none (small), a moment (medium) or ~0.5s (big). Max happiness: 6 small, 8 medium, 10 big. Who you meet: each small dog attracts more Other dog encounters, each big dog fewer, and any big dog scares thieves away. Small dogs are nimble: they roll half as often for area effects |
| Trait             | **Fancy:** puddles upset its owner more · **Food-driven:** pulls the pack toward nearby treats · **Chaser:** squirrels upset its owner; pulls toward them                                                                                                                                                                                                                                  |
| Energy            | Calm · steady · hyper. Sets how often the dog pulls the pack                                                                                                                                                                                                                                                                                                                               |
| Owner temperament | **Laid-back:** starts at 5 ♥ · **Fussy:** starts at 4 ♥, pays $30 instead of $20 · **Dramatic:** starts at 5 ♥, every ♥ gained or lost during a run counts double (starting bonuses don't), still within 0 and the dog's max; also sets the quip tone                                                                                                                                      |

| Dog      | Breed           | Owner                          | Look                                  |
| -------- | --------------- | ------------------------------ | ------------------------------------- |
| Duchess  | Maltese         | Rosa, retired florist          | White coat, pink bow                  |
| Nugget   | Pug             | Kevin, pet influencer          | Fawn, black mask, tiny bandana        |
| Zippy    | Jack Russell    | Mr. Pruitt, retired accountant | White with tan patches, red collar    |
| Pierre   | Standard poodle | Madame Lefevre, dog-show judge | Apricot, show-clip pom-poms           |
| Biscuit  | Beagle          | Sam, barista                   | Tricolour, floppy ears, green collar  |
| Dash     | Whippet         | Ophelia, stage actor           | Grey brindle, knit sweater            |
| Snowball | Samoyed         | Tiffany, wedding planner       | Fluffy white, collar with a bell      |
| Waffles  | Saint Bernard   | Dr. Hughes, dentist            | Brown and white, little barrel collar |
| Koda     | Husky           | Jesse, trail runner            | Grey and white, blue eyes, harness    |

Each size and trait pairs once, and each energy and temperament appears three times. The three starters (Duchess, Biscuit, Koda) cover every size and trait, with laid-back owners for an easier first run. Each dog's size, trait, energy, owner temperament and unlock live in [`src/data/dogs.ts`](../src/data/dogs.ts).

More dogs means more fees and a longer-lasting run, but smaller tips, more owners to keep happy, more pulls and more area-effect rolls. After every card choice, the affected owner reacts with a quip. The walker is one fixed character.

### Encounters (things you hit by accident → choice card)

| Encounter | Who's affected                                         | Options                                                                        |
| --------- | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Skunk     | Area effect: dogs caught by the roll                   | Pay $$$ for grooming · Pay $ for a quick rinse → _Stinky_ · Ignore → −2 ♥ each |
| Squirrel  | Chasers (none: harmless scenery, no card)              | Hold tight → −1 ♥ · Let them chase → lose $ (dropped tips)                     |
| Puddle    | Area effect: dogs caught by the roll; Fancy dogs worse | Go through → −1 ♥ (−2 Fancy) · Pay $ for a towel                               |
| Other dog | All dogs                                               | Let them sniff → +1 ♥ each, −$ per dog (missed tips) · Pull away → −1 ♥ each   |
| Thief     | All dogs (none if any big dog: it flees, no card)      | Chase them off → −1 ♥ each (dogs worked up) · Let it go → −$ (stolen tips)     |

### Lucky encounters (good things to bump into)

| Encounter   | Options                                                            |
| ----------- | ------------------------------------------------------------------ |
| Lost wallet | Return it → +1 ♥ each (owners are proud) · Keep it → +$, −1 ♥ each |

Two lucky finds open no card: bumping into them pays out at once, with a short popup and a quip from the owners who gained:

- Biscuit neighbour: +1 treat per dog, up to the carry limit
- Photo op: +$ tip, +1 ♥ to dramatic owners

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
- Sweet talker: every per-dog $ cost on a card, missed tips included, is $4 less per dog for the rest of the run

### Home screen and progression

- Money earned in a run is banked
- The home screen is also the shop: tap a locked dog, dog slot or gear item to buy it; there is no separate shop screen
- **Gear** (5 items, permanent, bought once): fanny pack (start with +$); whistle (thieves flee even without a big dog); poop bags (once per run, an encounter card offers a free Skip option); running shoes (no lane-input lock after a pull); Lucky collar (every owner starts with +1 ♥ and has +1 max ♥). Pick up to 1 owned item before each run (none is allowed, e.g. on a first run). Equipped gear shows as a badge beside the walker
- **Dog training:** two courses per dog you own: Heel (the dog pulls half as often) and Good manners (its owner starts with +1 ♥ and has +1 max ♥)
- **Walker kit** (permanent, always on): Quick feet (lane changes 20% faster); Treat belt (carry 4 treats instead of 3); Business cards (+$3 fee per dog per zone); Good eye (the pull tell starts 0.5s earlier)
- **Cosmetic unlocks** (looks only): 2 extra accessories per dog (collar, bow, bandana and so on); 6 leash colours; 6 home screen decor pieces (e.g. yard sign, house paint, flower bed, bird bath, bench, porch light)
- **Walker customization:** pick from 3 to 4 preset walkers; one is free and the rest are cosmetic purchases. Gear still shows as a badge
- **Gate scene:** the home screen shows the walker and the picked pack on the front path, heading out to Maple Street, beside a "Dog Walker" yard sign; equipped gear and home screen decor show here
- **Owner parting line:** picking a dog shows a line from its owner in their temperament (e.g. Jesse: "He already did 10K. He's fine.")
- Upgrade cards are the run-only boosts; everything bought on the home screen is permanent (the Hades split between boons and keepsakes)
- **Logbook** (a home screen panel): best walk (amount, zones, dogs), totals (walks, dogs walked, times fired) and the last walk as one line ("Kevin fired you in the park"). Best walk and walk count also sit in the top bar next to the bank
- **Stats page** (behind the logbook): runs played; runs finished, headed home or out of dogs; best run earnings; lifetime earnings; total firings and the owner who fired you most; best zone reached and times each world was finished. Per-dog stats (walks, zones finished, times fired) show on each dog's roster card. The end screen flags a new best
- Progress (bank, owned items, stats) is saved between sessions; see [`tech-plan.md`](../tech-plan.md)

## Numbers

[`src/data/`](../src/data/) holds every number and roster stat, and the [data page](https://dog-walker-game.andornaut.workers.dev/data/) shows them all with the generated card text. Numbers in the rules above are examples; the data files win. Edit values in `tuning.ts`, `dogs.ts`, `encounters.ts`, `forcedStops.ts`, `upgrades.ts`, `shop.ts`, `debuffs.ts`, `quips.ts`, `walkers.ts` and `world.ts`.

Prices not yet in the data:

| What       | Price                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| Dog slots  | Slot 2 $400 · slot 3 $900                                                                              |
| Training   | Heel $100 · Good manners $150, per dog                                                                 |
| Walker kit | Quick feet $300 · Treat belt $300 · Business cards $400 · Good eye $400                                |
| Cosmetics  | Extra walkers $200 each · dog accessories $80 each · leash colours $40 each · decor pieces $60 to $160 |

A simulated full run with the starters, hitting about 1 obstacle in 10 and paying money only when an owner is close to firing you, nets about $185 with 1 dog, $220 with 2 and $250 with 3; a careless player (1 in 7) nets about $155 to $195. A pack of the riskier dogs (fussy and dramatic owners) earns about $210 but is fired about once a run. Buying every slot, dog, gear item, training course and kit item costs about $8,500 (about 40 runs); cosmetics add about $2,900.

## Milestones

The milestones build the core loop first; placeholder art is fine until Milestone 6.

1. **Setup:** engine chosen, repo, auto-deploy of the web build, coloured-box placeholders
2. **Runner core:** 5 lanes, scrolling, spawning, collisions, keyboard + touch
3. **Encounters:** choice cards, money, per-dog owner happiness, trait targeting, lucky encounters, Stinky, owner quips, dogs leave at 0 ♥
4. **Run structure:** 4 zones, forced stops, upgrade cards, per-zone pay, end screen with earnings
5. **Dogs & home screen:** 9-dog roster (3 unlocked, 6 bought), dog slots (1 to start, 2 bought), pack picks, bank, shop in place, gear and loadout, dog training, walker kit, cosmetic unlocks, walker customization, logbook and stats, save
6. **Pixel pass & phone playtest:** sprites for walker, 9 dogs, 9 owner faces, 5 encounters, 3 lucky encounters, 2 pickups, card frames, card illustrations for the 5 encounters, 3 lucky encounters and 6 forced stops; test on real phones

**Done when:** a run lasts about 12 minutes, we want to play "one more", and it works by touch on a phone browser.

## Tech

Stack, hosting and save storage: see [`tech-plan.md`](../tech-plan.md).

## Next

See [`next.md`](next.md).
