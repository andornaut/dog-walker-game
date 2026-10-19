# Game Design

The rulebook for the first complete game, set in one world, Maple Street. What comes later is in [`next.md`](next.md), and undecided ideas are in [`ideas.md`](ideas.md).

[`src/data/`](../src/data/) holds every number and all content, and the [data page](https://dog-walker-game.andornaut.workers.dev/data/) shows them with the generated card text. This doc states the rules and gives numbers only where the data has none. In the rules below, `$` and `♥` give the direction and rough size of a change (`$$$` and `♥♥` are bigger); the amounts are in the data.

## Pitch

A cozy pixel-art lane runner where you walk a pack of dogs through the neighbourhood, and every bump in the road turns into a choice. You are a dog walker trying to make money.

## Pillars

1. **Cozy, not frantic:** calm speed, forgiving failure, "one more walk" appeal; playable for long stretches without stress
2. **Every bump is a story:** collisions lead to choices, not game over
3. **Charming chaos:** cute dogs, dramatic owners, silly neighbourhood

## Core loop

- **Before a run:** pick your dogs (one per owned dog slot) and up to one piece of gear.
- **During a run:** walk 4 zones. The street scrolls toward you; switch lanes to dodge obstacles and grab pickups. Hitting an obstacle opens a choice card. Each zone has one forced stop.
- **Between zones:** pick 1 of 3 upgrade cards.
- **After a run:** bank your earnings and spend them on the home screen: dogs, dog slots and gear.

Reference points: Bowling Ballers (lane runner, but calmer), Hades (zones, run structure, loadout, meta progression), Vampire Survivors (choices along the way), Slay the Spire (choices as cards).

## Rules

### Screen and controls

- Web, phone browser first. Touch and keyboard; mouse is not planned
- Portrait, ¾ top-down view, 5 lanes
- Layout: a top status bar (money, zone progress, pause); a backdrop band showing the current zone, where scenery gags play; a fixed-width dog column on the left with one slot per dog; and the road filling the rest. Cards cover the paused, dimmed road; the status bar and dog column stay visible. Sizes are in [`art/style-guide.md`](../art/style-guide.md)
- **Drag** (the main touch control): put a thumb down anywhere and drag. Each lane-width of horizontal travel moves the target lane one lane, relative to where the drag started, so the thumb never covers the walker. The pack moves lane by lane toward the target at the normal lane-change speed
- **Tap:** moves one lane toward the tapped half of the road. A tap on the dog column gives a treat instead
- **Keyboard:** ←/→, A/D or H/L; one lane per press, and holding repeats
- While moving between lanes, the pack can hit things in either lane. A reverse press turns the pack around at once; any other press, and any pull, waits for the current move to finish (latest wins)
- Taps on the top bar never move the pack. Pause offers Resume, Head home, Help and Settings
- The walker is at the bottom, the dogs just ahead in the same lane; the pack collides as one unit
- Spawning always leaves a reachable path, so every hit is avoidable
- After a hit, the obstacle is removed once its card closes, and obstacles are ignored for a short grace window; pickups still count
- Scroll speed and obstacle density rise gently each zone
- **Pulls:** each dog pulls the pack one lane now and then, at an interval set by its energy: toward its trait's target (Food-driven: a nearby treat; Chaser: a squirrel), otherwise to a random side. Shortly before a pull the dog leans toward that side and barks. When the pull's lane move finishes, lane input locks for a time set by the dog's size. During a drag, a pull re-anchors the drag at the pack's new lane, so getting back takes another drag
- **Area effects** (skunk, puddle) roll once per dog on contact, so a bigger pack is more likely to have a dog caught; small dogs are caught less often. The card shows which dogs were caught, so its outcomes are fixed. If no dog is caught, no card opens

### Resources

- **Money ($):** the only currency. Earned during the run (tips, per-zone fees), spent in encounters, banked at the end. Tracked in cents, shown in whole dollars. Never goes below $0
- **Owner happiness (♥):** one meter per dog, shown as the dog's and owner's faces plus the meter, which never relies on colour alone. It starts at a value set by the owner's temperament, and its max is set by the dog's size. At 0 the owner fires you with a quip and the dog leaves
- **Every change shows its cause:** each ♥ or $ change shows a short floating label at the dog's slot or the bank (e.g. "−2 ♥, dramatic", "+$1.50 tip, solo"); a card's enlarged view lists the modifiers behind its numbers

### A run

- 4 zones in a fixed order: Woof Way, Bark Park, Sniff Street Shops and The Long Way Home. Each is the same distance, so later zones take less time as speed rises. A full run takes about 12 minutes
- One forced stop per zone, and after zones 1 to 3, a choice of 1 of 3 upgrade cards
- After each zone, every remaining dog pays a share of its fee. A dog fired mid-zone is not paid for that zone
- An owner who fires you takes back every fee their dog earned this run; tips stay
- The run ends after zone 4 or when no dogs are left. You keep everything earned except fees taken back
- **Head home:** from the pause menu at any time. Keeps tips and earlier zones' fees; the current zone pays nothing
- **End screen:** the run's total with a breakdown (fees, tips, card costs, fees taken back), zones walked and the bank; a new-best ribbon when it beats the best walk; one closing line from each owner (a happier line from owners still walking, the fired line from owners who fired you)

### Choice cards

- Used for encounters, forced stops and upgrades. Up to three across, art-led: an illustration plus a one-line effect; tap to enlarge for details
- Each option's outcome is fixed and shown on the card. Choices only, no minigames
- An option you can't afford is disabled; every encounter keeps at least one free option
- Slower options cost money (missed tips) instead of time
- Money costs are per affected dog, except losses to the pack as a whole (a squirrel chase, a thief), which are charged once
- An immunity (Raincoats, Good leash, Whistle) means no card opens
- A card shows at most 3 options. Poop bags' Skip replaces the most expensive option when a card already has 3
- After every card choice, each affected owner reacts with a quip. Each owner has 2 lines for each of: happier, upset, fired, and parting

### Teaching, sound and settings

- **First-time hints:** a one-line hint the first time each thing appears (first puddle, first pull, first treat, first forced stop and so on); the help screen covers the rest
- **Sound:** a few effects (tip, treat, bump, bark, card open, fired) and one music loop for the walk
- **Settings** (from pause and the home screen): music volume, effects volume, reduced motion

### Pickups

- **Treat:** carried, up to a limit; tap a dog's slot to give its owner +♥
- **Tip:** +$. Smaller packs earn bigger tips: passers-by tip more for a calm walk

### Dogs

A roster of 9. You start with 1 dog slot and 3 dogs, and buy up to 2 more slots and the other 6 dogs on the home screen. Walking more dogs is the main progression: more fees and a longer-lasting run, but smaller tips, more owners to keep happy, more pulls and more area-effect rolls.

Every dog is a fixed, named character with its own art, one value of each attribute, and one fixed owner, so players can have favourites.

| Attribute         | Values                                                                                                                                                                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Size              | Small · medium · big. No size is a straight upgrade. Bigger dogs lock lane input longer after a pull (small: not at all) and have a higher max ♥. Each small dog attracts more Other dog encounters and each big dog fewer; any big dog scares thieves away. Small dogs are caught by area effects less often |
| Trait             | **Fancy:** puddles upset its owner more · **Food-driven:** pulls the pack toward nearby treats · **Chaser:** squirrels upset its owner; pulls toward them                                                                                                                                                     |
| Energy            | Calm · steady · hyper. Sets how often the dog pulls                                                                                                                                                                                                                                                           |
| Owner temperament | **Laid-back:** starts with more ♥ · **Fussy:** starts with fewer ♥, pays a higher fee · **Dramatic:** every ♥ gained or lost during a run counts double (starting bonuses don't), still within 0 and the max; also sets the quip tone                                                                         |

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

Each size and trait pairs once, and each energy and temperament appears three times. The three starters (Duchess, Biscuit, Koda) cover every size and trait and have laid-back owners, for an easier first run. Each dog's attributes are in [`src/data/dogs.ts`](../src/data/dogs.ts).

### Encounters

Obstacles hit by accident open a choice card.

| Encounter | Who's affected                                         | Options                                                                       |
| --------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Skunk     | Area effect: dogs caught by the roll                   | Pay $$$ for grooming · Pay $ for a quick rinse → _Stinky_ · Ignore → −♥♥ each |
| Squirrel  | Chasers (none: harmless scenery, no card)              | Hold tight → −♥ · Let them chase → −$ (dropped tips)                          |
| Puddle    | Area effect: dogs caught by the roll; Fancy dogs worse | Go through → −♥ (more for Fancy) · Pay $ for a towel                          |
| Other dog | All dogs                                               | Let them sniff → +♥ each, −$ per dog (missed tips) · Pull away → −♥ each      |
| Thief     | All dogs (none if any big dog: it flees, no card)      | Chase them off → −♥ each (dogs worked up) · Let it go → −$ (stolen tips)      |

**Stinky** (debuff): cuts tip value for the rest of the zone. A second skunk refreshes it; it never stacks.

### Lucky encounters

Good things to bump into on purpose.

- **Lost wallet** (card): Return it → +♥ each (owners are proud) · Keep it → +$, −♥ each
- **Biscuit neighbour** (no card): a treat for each dog, up to the carry limit
- **Photo op** (no card): +$ tip, +♥ to dramatic owners

A lucky find with no card pays out on contact, with a short popup and a quip from the owners who gained.

### Minor obstacles

About half of the obstacles are minor: they open no card. Bumping one drops $2 in tips and makes the pack stumble (lane input locks briefly), shown with a cause label.

### Obstacle sizes

Obstacles span lanes and rows. None is wider than 3 lanes, every row leaves at least 2 lanes open, and the reachable-path rule still holds. Touching any part counts as one hit; the whole obstacle is removed and the grace window starts.

| Obstacle                                               | Kind      | Size (lanes × rows) |
| ------------------------------------------------------ | --------- | ------------------- |
| Skunk (with its spray cloud)                           | Encounter | 2 × 2               |
| Puddle                                                 | Encounter | 2 × 1               |
| Squirrel, other dog, thief                             | Encounter | 1 × 1               |
| Cone, bin, hydrant                                     | Minor     | 1 × 1               |
| Parked car                                             | Minor     | 1 × 3               |
| Bench                                                  | Minor     | 2 × 1               |
| Hedge                                                  | Minor     | 3 × 1               |
| Construction barrier (Woof Way and Sniff Street Shops) | Minor     | 2 or 3 × 1          |

Scenery gags (a cat on a fence, a sprinkler, a ball rolling past) play in the backdrop band; they open no card and have no effect.

### Forced stops

One per zone, drawn at random with no repeats in a run.

- Stop sign: wait patiently → −$ per dog (missed tips) · dart across → −♥ each
- Chatty neighbour: chat → +$ tip, −$ per dog (missed tips) · politely move on → nothing
- Kid wants to pet them: let them pet → +♥ each, −$ per dog (missed tips) · politely decline → −♥ to one random owner
- Ice cream truck: buy pup cups → −$ per dog, +♥ each · walk past → −♥ to Food-driven owners
- Construction detour: take the long way → −$ per dog (missed tips) · squeeze past → −♥ to Fancy owners (dust)
- Mail carrier: hold them back → −♥ each (barking) · wait it out → −$ per dog (missed tips)

### Upgrade cards

Run-only boosts offered between zones, from a pool of 9. Each offer draws 3 at random from the remaining pool, with at most one trade-off card. A picked card leaves the pool for the rest of the run.

- Belly rubs: +♥ to every owner now
- Second wind: +♥♥ to the unhappiest owner now
- Good leash: squirrels can't upset your chasers, and chasers don't pull toward them
- Raincoats: puddles can't upset anyone
- Big tipper: tips are worth more
- Treat magnet: treats count from one lane away
- Sweet talker: every per-dog $ cost on a card, missed tips included, is lower
- Shortcut (trade-off): the next zone is shorter, but its fees are lower
- Rush hour (trade-off): more tips and more obstacles in the next zone

Effects without "now" or "next zone" last the rest of the run.

### Home screen and progression

Everything bought on the home screen is permanent; upgrade cards are the run-only boosts (the Hades split between keepsakes and boons). Progress (bank, owned items, stats, achievements) is saved between sessions; storage is in [`tech-plan.md`](../tech-plan.md).

- **Shop:** the home screen is the shop. Tap a locked dog, dog slot or gear item to buy it, at any time you can pay
- **Gear** (5 items, bought once): fanny pack (start the run with +$); whistle (thieves flee even without a big dog); poop bags (once per run, an encounter card offers a free Skip option); running shoes (no lane-input lock after a pull); Lucky collar (every owner starts with +♥ and has a higher max). Equip up to 1 owned item before each run, or none
- **Walker picker:** choose Casey, Ada, Ben or Trista. All are free; the choice is cosmetic and saved
- **Gate scene:** the chosen walker and the picked pack on the front path, heading out to Maple Street, beside a "Dog Walker" yard sign. Equipped gear shows as a badge beside the walker
- **Owner parting line:** picking a dog shows a line from its owner in their temperament (e.g. Jesse: "He already did 10K. He's fine.")
- **Logbook** (a home screen panel): best walk (amount, zones, dogs), totals (walks, dogs walked, times fired) and the last walk as one line ("Kevin fired you in the park"). Best walk and walk count also sit in the top bar next to the bank
- **Stats page** (behind the logbook): runs played; runs finished, headed home or out of dogs; best run earnings; lifetime earnings; total firings and the owner who fired you most; best zone completed (heading home mid-zone doesn't count that zone); times each world was finished. Each dog's roster card shows its walks, zones finished and times fired
- **Achievements:** a badge wall on the Stats page, earned badges in colour and locked ones greyed with their goal. Earning one plays a short celebration (owners cheer) wherever it happens; there is no other reward. The 15:
  - Firsts: First Walk (finish zone 1), Full Route (finish all 4 zones), Pack of Two (walk 2 dogs), Pack of Three (walk 3 dogs)
  - Mastery: Clean Paws (finish a zone without a hit), Spotless (finish a run without a hit), No Hard Feelings (finish 10 runs with no firings), High Earner (earn $500 in one run)
  - Collection: Full Kennel (own all 9 dogs), Fully Equipped (own all 5 gear items), Every Owner Smiles (finish a run with each dog), Top Walker (own every dog and slot)
  - Silly: You're Fired! (get fired 10 times), Stinky Streak (be Stinky in 3 zones of one run), Squirrel! (let a chaser chase 5 squirrels)

## Milestones

Each milestone builds on the last; placeholder art is fine until Milestone 6.

1. **Setup:** engine chosen, repo, auto-deploy of the web build, coloured-box placeholders
2. **Runner core:** 5 lanes, scrolling, spawning, collisions, keyboard and touch
3. **Encounters:** choice cards, money, per-dog owner happiness, trait targeting, lucky encounters, Stinky, owner quips, dogs leave at 0 ♥
4. **Run structure:** 4 zones, forced stops, upgrade cards, per-zone pay, pause and head home, end screen with earnings, first-time hints
5. **Dogs and home screen:** 9-dog roster (3 unlocked, 6 bought), dog slots (1 to start, 2 bought), pack picks, bank, shop, gear and loadout, gate scene, walker picker, owner parting lines, logbook, Stats page and achievements, settings, save
6. **Pixel pass and phone playtest:** sprites for the 4 walkers, 9 dogs, 9 owner faces, 5 encounters, 3 lucky encounters, 3 scenery gags, 2 pickups, achievement badges and celebration, card frames, card illustrations for the 5 encounters, 3 lucky encounters and 6 forced stops; sound effects and one music loop; accessibility basics; test on real phones

**Done when:** a run lasts about 12 minutes, we want to play "one more", and it works by touch on a phone browser.
