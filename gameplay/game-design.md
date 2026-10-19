# Game Design

The rulebook for the first complete game, set in one world, Maple Street. What's left to build and tune is in [`README.md`](README.md), what comes later is in [`next.md`](next.md), and undecided ideas are in [`ideas.md`](ideas.md).

[`src/data/`](../src/data/) holds every number and all content, and the [data page](https://dog-walker-game.andornaut.workers.dev/data/) shows them with the generated card text. This doc states the rules and gives numbers only where the data has none. In the rules below, `$` and `♥` give the direction and rough size of a change (`$$$` and `♥♥` are bigger); the amounts are in the data.

## Pitch

A cozy pixel-art lane runner where you walk a pack of dogs through the neighbourhood, and every bump in the road turns into a choice. You are a dog walker trying to make money.

## Pillars

1. **Cozy, not frantic:** calm speed, forgiving failure, "one more walk" appeal; playable for long stretches without stress
2. **Every bump is a story:** collisions lead to choices, not game over
3. **Charming chaos:** cute dogs, dramatic owners, silly neighbourhood

## Core loop

- **Before a run:** pick your dogs (one per owned dog slot) and up to one piece of gear.
- **During a run:** walk 4 of the 6 zones, starting on Woof Way. The street scrolls toward you; switch lanes to dodge obstacles and grab pickups. Hitting an obstacle opens a choice card. Each zone has one forced stop.
- **Between zones:** pick 1 of 3 upgrade cards, then pick the next zone at a fork.
- **After a run:** bank your earnings and spend them on the home screen: dogs, dog slots and gear.

Reference points: Bowling Ballers (lane runner, but calmer), Hades (zones, run structure, loadout, meta progression), Vampire Survivors (choices along the way), Slay the Spire (choices as cards).

## Rules

### Screen and controls

- Web, phone browser first. Touch and keyboard; mouse is not planned
- Portrait, ¾ top-down view, 5 lanes
- Layout: a shorter screen (360×560). From the top: the status bar (money, treat count, zone progress, a Home button and pause; mute is in Settings and on the M key); a backdrop band showing the current zone, where scenery gags play; the road across the full width, scrolling all the way to the top of its area; and a row of doghouses along the bottom, one per dog slot. Cards cover the paused, dimmed road; the status bar and doghouses stay visible
- **Home button:** a house icon in the top bar pauses the walk and asks "Head home? You keep tips and earlier zones' fees." with Head home and Keep walking. Head home (here or in the pause menu) keeps tips and earlier zones' fees; the current zone pays nothing
- The road is drawn in pseudo-3D: lanes converge toward the backdrop band and things shrink with distance. About 5 to 5.5 seconds of road are visible ahead. Lanes, distances and collisions are unchanged by it
- **Drag** (the main touch control): put a thumb down anywhere and drag. Each lane-width of horizontal travel moves the target lane one lane, relative to where the drag started, so the thumb never covers the walker. The pack moves lane by lane toward the target at the normal lane-change speed
- **Tap:** moves one lane toward the tapped half of the road. A tap on a doghouse gives that dog's owner a treat instead
- **Keyboard:** ←/→, A/D or H/L; one lane per press, and holding repeats
- While moving between lanes, the pack can hit things in either lane. A reverse press turns the pack around at once; each other press queues one more lane, and a pull waits for the current move to finish
- Taps on the top bar never move the pack. Pause offers Resume, Help, Settings and Head home
- The walker is at the bottom, the dogs just ahead in the same lane; the pack collides as one unit
- Spawning always leaves a reachable path, so every hit is avoidable
- A hit obstacle is removed at once, and obstacles are ignored for a short grace window; pickups still count. A hit that opens no card (a squirrel with no Chaser, a thief that flees, a skunk or puddle that catches nobody) is scenery: no bump and no grace window
- Scroll speed and obstacle density rise gently each zone
- **Pulls:** a dog pulls the pack one lane only toward something it wants that you can see: a treat (Food-driven), a squirrel (Chaser), or a spot for its urgent need. There are no random pulls. About 1 second before, a need or target bubble pops over the dog with an arrow and a line to the target, the leash goes taut and the dog strains; then the pack lurches one lane. Bigger dogs lock lane input longer after the move, and during a drag the pull re-anchors the drag at the new lane. A pull never moves the pack into an obstacle it can't react to: if the target lane has an obstacle too close, the dog strains but doesn't pull
- **Area effects** (skunk, puddle) roll once per dog on contact, so a bigger pack is more likely to have a dog caught; small dogs are caught less often. The card shows which dogs were caught, so its outcomes are fixed. If no dog is caught, no card opens

### Resources

- **Money ($):** the only currency. Earned during the run (tips, per-zone fees), spent in encounters, banked at the end. Tracked in cents, shown in whole dollars. Never goes below $0
- **Owner happiness (♥):** one meter per dog, shown as the dog's and owner's faces plus the meter, which never relies on colour alone. It starts at a value set by the owner's temperament, and its max is set by the dog's size. At 0 the owner fires you with a quip and the dog leaves
- **Every change shows its cause:** each ♥ or $ change shows a short floating label at the dog's slot or the bank (e.g. "−2 ♥, dramatic", "+$0.60 tip, solo"); a card's enlarged view lists the modifiers behind its numbers

### A run

- A walk is 4 zones of Maple Street, starting on Woof Way. Each zone is the same distance and takes about 2 minutes; a full walk takes about 8 minutes
- One forced stop per zone. After zones 1 to 3: pick 1 of 3 upgrade cards, then choose the next zone at a fork
- **Forks:** the road meets a cross street and a fork card offers three paths (left, straight, right), each leading to a zone you haven't walked this run, sorted easiest on the left to hardest on the right. Each path card shows the zone's name, difficulty and fee multiplier
- **Zones** (6, each walk visits 4 with no repeats):

| Zone               | Difficulty  | Fees  | Encounter mix                                                             |
| ------------------ | ----------- | ----- | ------------------------------------------------------------------------- |
| Snooze Crescent    | Easiest     | ×0.7  | A sleepy cul-de-sac: few obstacles, no movers, mail carrier and kid stops |
| Bark Park          | Easy        | ×0.8  | Other dogs, squirrels, more lucky finds; no thieves, no cyclists          |
| Woof Way           | Normal      | ×1    | Puddles, the mail carrier, cones; movers rare. Always the first zone      |
| Sniff Street Shops | Busy        | ×1.25 | Thieves, the ice cream truck, benches, more tips, more movers             |
| Paws Promenade     | Medium-hard | ×1.25 | A riverside path: wide puddles, cyclists, other dogs, more lucky finds    |
| The Long Way Home  | Hard        | ×1.5  | Everything, densest and fastest, the most movers                          |

- After each zone, every remaining dog pays its fee. A dog fired mid-zone is not paid for that zone
- An owner who fires you takes back every fee their dog earned this run; tips stay
- The run ends after zone 4 or when no dogs are left. You keep everything earned except fees taken back
- **End screen:** the run's total with a breakdown (fees, tips, card costs, fees taken back), zones walked and the bank; a new-best ribbon when it beats the best walk; one closing line from each owner (a happier line from owners still walking, the fired line from owners who fired you)

### Choice cards

- Used for encounters, forced stops and upgrades. Up to three across, art-led: an illustration plus a one-line effect; hold to enlarge for details
- Each option's outcome is fixed and shown on the card. Choices only, no minigames
- An option you can't afford is disabled; every encounter keeps at least one free option
- Slower options cost money (missed tips) instead of time
- Money costs are per affected dog, except losses to the pack as a whole (a squirrel chase, a thief), which are charged once
- An immunity (Raincoats, Good leash, Whistle) means no card opens
- A card shows at most 3 options. Poop bags' Skip replaces the most expensive option when a card already has 3
- After every card choice, each affected owner reacts with a quip. Each owner has 2 lines for each of: happier, upset, fired, and parting

### Teaching, sound and settings

- **First-time hints:** a one-line hint the first time each thing appears (first puddle, first pull, first treat, first forced stop and so on); the help screen covers the rest
- **Sound:** short effects (tip, treat, bump, bark, card open, fired), a sound for each encounter hit (spray hiss, splash, coin scatter, squirrel chitter, friendly woof), a badge-earned jingle and a new-best fanfare, and one music loop for the walk
- **Settings** (from pause and the home screen): sound on or off, music volume, effects volume, reduced motion

### Pickups

- **Tip:** +$. Smaller packs earn bigger tips: passers-by tip more for a calm walk
- **Treat:** carried, up to a limit; tap a dog's doghouse to give its owner +♥

### Dogs

A roster of 9. You start with 1 dog slot and 3 dogs, and buy up to 2 more slots and the other 6 dogs on the home screen. Walking more dogs is the main progression: more fees and a longer-lasting run, but smaller tips, more owners to keep happy, more pulls and more area-effect rolls.

Every dog is a fixed, named character with its own art, one value of each attribute, and one fixed owner, so players can have favourites.

| Attribute         | Values                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Size              | Small · medium · big. No size is a straight upgrade. Bigger dogs lock lane input longer after a pull (small: not at all) and have a higher max ♥. Each small dog attracts more Other dog encounters and each big dog fewer; any big dog scares thieves away. Small dogs are caught by area effects less often                                                                                                                                                                                                                                                                                                                                                               |
| Trait             | **Fancy:** puddles upset its owner more · **Food-driven:** pulls the pack toward nearby treats · **Chaser:** squirrels upset its owner; pulls toward them                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Energy            | Calm · steady · hyper. Sets how quickly the dog's need becomes urgent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Owner temperament | **Laid-back:** the easy-going baseline · **Fussy:** starts with fewer ♥, pays a higher fee · **Dramatic:** every ♥ gained or lost during a run counts double (starting bonuses don't), still within 0 and the max; also sets the quip tone                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Quirk             | Some dogs have one, from their personality. **Acrobatic** (Archie): no lane-input lock after a pull, whatever his size · **Nervous** (Penny): wary of other dogs, she lunges at them rather than shying away. While another dog is in view (a loose dog, an Other dog encounter, a playmate spot) she strains toward it with a growl bubble and pulls the pack one lane toward it, under the same fairness rule as every pull. The Other dog encounter's Let them sniff costs her owner −♥ instead of +♥, and playmates don't settle her. She is also clingy: when she's the only dog on the leash (walked alone, or the others fired), her need turns urgent twice as fast |

| Dog      | Breed               | Need     | Owner                          | Look                                    |
| -------- | ------------------- | -------- | ------------------------------ | --------------------------------------- |
| Duchess  | Maltese             | Friendly | Rosa, retired florist          | White coat, pink bow                    |
| Nugget   | Pug                 | Thirsty  | Kevin, pet influencer          | Fawn, black mask, tiny bandana          |
| Zippy    | Jack Russell        | Playful  | Mr. Pruitt, retired accountant | White with tan patches, red collar      |
| Pierre   | Standard poodle     | Nosy     | Madame Lefevre, dog-show judge | Apricot, show-clip pom-poms             |
| Biscuit  | Beagle              | Regular  | Sam, barista                   | Tricolour, floppy ears, green collar    |
| Archie   | Australian Shepherd | Playful  | Ophelia, stage actor           | Red merle, one blue eye, red bandana    |
| Snowball | Samoyed             | Friendly | Tiffany, wedding planner       | Fluffy white, collar with a bell        |
| Penny    | Golden retriever    | Friendly | Dr. Hughes, dentist            | Golden coat, feathery tail, blue collar |
| Koda     | Husky               | Nosy     | Jesse, trail runner            | Grey and white, blue eyes, harness      |

Each size and trait pairs once, and each energy and temperament appears three times. The three starters (Duchess, Biscuit, Koda) cover every size and trait and have laid-back owners, for an easier first run. Each dog's attributes are in [`src/data/dogs.ts`](../src/data/dogs.ts).

### Needs

Every dog has one need, shown as a word on its card:

| Need     | Word     | Fulfilled by        |
| -------- | -------- | ------------------- |
| Friendly | Friendly | A stranger waving   |
| Playful  | Playful  | Another dog         |
| Potty    | Regular  | A hydrant or a tree |
| Sniffy   | Nosy     | A lamp post         |
| Thirsty  | Thirsty  | A water bowl        |

- **Need spots** appear on the road like pickups, drawn only for needs in the pack (Playful's spot is a friendly playmate dog, not the Other dog encounter). Steering the pack into one resets the matching dogs' needs; dogs whose need was urgent also get +♥ for their owners, a big need bubble and a happy owner. About 1 in 4 fulfilments opens a small card instead, e.g. "A stranger loves Duchess" (Let them fuss: +♥ and a tip · Keep walking) or "Play date!" (Let them play: +♥ each, −$ per dog in missed tips · Just a sniff: +♥ to the playful dog's owner)
- **Urgency:** a need fills up during a zone, faster for higher energy, and resets at each zone end. When it's urgent, a bubble with the need's icon shows over the dog, and it pulls toward the nearest matching spot. One dog strains at a time, and each spot draws one pull
- **Gone wrong:** an urgent need left too long goes wrong, then resets. A Regular dog has an accident and opens a card (Clean up with a bag: −$ · Walk on: −♥♥, labelled "grumpy neighbour"); any other need costs its owner −♥
- The Other dog encounter's Let them sniff fulfils Playful, and the Can I pet them? stop's Of course! fulfils Friendly

### Encounters

Obstacles hit by accident open a choice card.

| Encounter | Who's affected                                         | Options                                                                    |
| --------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Other dog | All dogs                                               | Let them sniff → +♥ each, −$ per dog (missed tips) · Pull away → −♥ each   |
| Puddle    | Area effect: dogs caught by the roll; Fancy dogs worse | Splash through → −♥ (more for Fancy) · Towel off → −$                      |
| Skunk     | Area effect: dogs caught by the roll                   | Full groom → −$$$ · Quick rinse → −$, _Stinky_ · Hold your nose → −♥♥ each |
| Squirrel  | Chasers (none: harmless scenery, no card)              | Hold tight → −♥ · Let them chase → −$ (dropped tips)                       |
| Thief     | All dogs (none if any big dog: it flees, no card)      | Chase them off → −♥ each (dogs worked up) · Let it go → −$ (stolen tips)   |

**Stinky** (debuff): cuts tip value for the rest of the zone. A second skunk refreshes it; it never stacks.

### Zone encounters

Each appears only in its zones:

| Encounter      | Zones                         | Size                  | Who's affected                            | Options                                                                                                                                                         | Hit label         |
| -------------- | ----------------------------- | --------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Angry goose    | Paws Promenade, Long Way Home | 1 × 1, waddles across | All dogs; a big dog doesn't scare it      | Back off slowly → −$ per dog (missed tips) · Honk back → −♥ each (−♥♥ Chasers)                                                                                  | "HONK!"           |
| Café patio     | Sniff Street Shops            | 2 × 1                 | All dogs                                  | Charm the crowd → fulfils Friendly, −$ per dog (missed tips) · Buy new lattes → −$ per dog, +♥ to fussy owners · Slink away → −♥ each                           | "SPILLED LATTE!"  |
| Picnic raid    | Bark Park, Paws Promenade     | 2 × 1                 | Food-driven dogs (none: scenery, no card) | Buy a new lunch → −$ per affected dog · Drop it! → −♥ to affected owners                                                                                        | "SNACK ATTACK!"   |
| Prize petunias | Snooze Crescent, Woof Way     | 2 × 1                 | All dogs                                  | Replant them → −$ per dog · Nature calls → fulfils Regular, −♥ each                                                                                             | "OOPS, PETUNIAS!" |
| Trash day      | Woof Way, Long Way Home       | 2 × 1                 | All dogs                                  | Sniff it all → fulfils Nosy, −♥ to Fancy owners, −$ per dog (missed tips) · Tidy up → −$ per dog, +♥ to fussy owners · Drag them on → −♥ each (−♥♥ Food-driven) | "TRASH DAY!"      |

### Lucky encounters

Good things to bump into on purpose.

- **Lemonade stand** (card; Snooze Crescent, Woof Way): Water, please → fulfils Thirsty, −$ per dog · Say hi → fulfils Friendly, −$ per dog (missed tips) · Maybe later → nothing
- **Lost wallet** (card): Hand it in → +♥ each (owners are proud) · Finders keepers → +$, −♥ each
- **Generous neighbour** (no card): a treat for each dog, up to the carry limit
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

### Moving hazards

Some things cross the road or come down it. Each gives about 1 second of warning (a cue at the lane edge) before it moves, at most one mover is on screen at a time, and the reachable-path rule accounts for its movement.

- **Loose dog** crosses lanes: contact opens the Other dog encounter
- **Squirrel** darts across lanes: contact opens the squirrel encounter, and Chasers pull toward it while it's on screen
- **Ball** bounces across lanes: a minor obstacle
- **Cyclist** rides down one lane toward you, faster than the road: a minor obstacle

### Feedback

- **Dog statuses:** shown on the dog and as an icon on its doghouse slot. Stinky lasts until the zone ends (tips halved). Soaked (after Splash through) and Spooked (after a thief) are visual only and fade after 10 seconds
- **Fee payout:** at each zone end, every remaining dog's fee flies as coins from its doghouse to the bank with its amount
- **Firing moment:** when an owner fires you, their face pops up large over the dog's doghouse with their fired line, a "FIRED!" plate shows, and the dog trots off the road edge; it plays right after the card choice that fired you
- **First visit:** on a brand-new save, the three starter owners wait at the gate in the gate scene until the first walk
- **Hit moments:** every encounter hit plays a big moment before its card: a burst over the pack, a brief flash at the screen edges, a large label (other dog "NEW FRIEND!", puddle "SOAKED!", skunk "SPRAYED!", squirrel "SQUIRREL!", thief "PICKPOCKETED!") and the caught dogs shaking off
- **Hit stop:** hitting an obstacle freezes the road and the pack briefly while its hit plays (about 1 second for an encounter, before its card; about 0.6 seconds for a minor obstacle). Input is ignored during the stop, and it doesn't count as walk time. Lucky finds don't stop the walk
- **Low hearts:** an owner at 1 ♥ looks worried and their doghouse pulses gently (a static warning rim with reduced motion)
- **Return home:** the end screen shows the walker and pack coming back up the front path while the owners wave; fired dogs are absent
- **State strip:** icons in the top bar for every active effect (Stinky, upgrades in effect, equipped gear); tap one for its description
- **Treat given:** the treat arcs from the treat counter to the dog, the owner smiles, and a "+1 ♥" label shows

Scenery gags (a cat on a fence, a sprinkler, a ball rolling past) play in the backdrop band; they open no card and have no effect.

### Forced stops

One per zone, drawn at random with no repeats in a run.

- Can I pet them? (a kid): Of course! → +♥ each, −$ per dog (missed tips) · Sorry, not now → −♥ to one random owner
- Chatty neighbour: Have a chat → +$ tip, −$ per dog (missed tips) · Wave and go → nothing
- Construction detour: Take the long way → −$ per dog (missed tips) · Squeeze past → −♥ to Fancy owners (dust)
- Ice cream truck: Pup cups! → −$ per dog, +♥ each · Not today → −♥ to Food-driven owners
- Mail carrier: Hold them back → −♥ each (barking) · Wait it out → −$ per dog (missed tips)
- Stop sign: Wait your turn → −$ per dog (missed tips) · Dart across → −♥ each

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

Everything bought on the home screen is permanent; upgrade cards are the run-only boosts (the Hades split between keepsakes and boons). Progress (bank, owned items, stats, achievements) is saved between sessions; storage is in [`src/README.md`](../src/README.md).

- **Layout, top to bottom:** the top bar (bank, best walk and walk count, the Logbook button, settings); the gate scene; then three framed sections in order: Walker, Dogs, Gear (optional); then the Start walk button at the bottom. A section's frame lights up once it's complete; until then its band prompts ("Tap a face", "Add a dog"). Nothing else sits between the sections, so the screen reads as choose this, choose that, start your walk
- **Shop:** the home screen is the shop. Tap a locked dog, dog slot or gear item to buy it, at any time you can pay. Anything you can afford has a gold outline. The slot sign reads "Slot 2 · $800" with "Save $650 more" or "Tap to buy"
- **Details:** hold any dog or gear item for a detail card: a dog's breed, traits in words, owner and temperament, fee and per-dog stats; a gear item's name and effect
- **Start button:** the only button below the sections, reading "Start walk" in every state, and not ready until a dog is picked. The Dogs band shows the pack count, "Pack 1/1"; each dog tile shows its fee
- **Walker's lines:** the walker's speech bubble reacts to state: first visit "Morning! Who are we walking today?"; after each of the first 3 walks "Tap to pick or buy. Hold for details."; after later walks "Back already? Who's next?"; after a firing "Rough walk. They'll come around."; when something new is affordable "We could take on another client."; picking a dog shows that owner's parting line
- **Messages:** every message shows in the walker's bubble, up to 4 lines of about 30 characters: buying a dog shows "Nugget joins your clients!" with the owner's parting line; tapping something you can't afford shows "Save $450 more for Nugget."; notices such as "Progress won't be saved." Walker's lines and parting lines keep to 2 lines
- **Gear** (5 items, bought once): fanny pack (start the run with +$); Lucky collar (every owner starts with +♥ and has a higher max); poop bags (once per run, an obstacle encounter card offers a free Skip option); running shoes (no lane-input lock after a pull); whistle (thieves flee even without a big dog). Equip up to 1 owned item before each run, or none
- **Walker picker:** choose Ada, Ben, Casey or Trista. All are free; the choice is cosmetic and saved
- **Gate scene:** the chosen walker and the picked pack on the front path, heading out to Maple Street, beside a "Dog Walker" yard sign. Equipped gear shows as a badge beside the walker
- **Owner parting line:** picking a dog shows a line from its owner in their temperament (e.g. Jesse: "He already did 10K. He's fine.")
- **Logbook** (a button in the top bar that opens a panel; nothing shows on the home screen until it's opened): best walk (amount, zones, dogs), totals (walks, dogs walked, times fired) and the last walk as one line ("Kevin fired you in the park"). Best walk and walk count also sit in the top bar next to the bank
- **Stats page** (behind the logbook): runs played; runs finished, headed home or out of dogs; best run earnings; lifetime earnings; total firings and the owner who fired you most; best zone completed (heading home mid-zone doesn't count that zone). Each dog's roster card shows its walks, zones finished and times fired
- **Achievements:** a badge wall on the Stats page, earned badges in colour and locked ones greyed with their goal. Earning one plays a short celebration (owners cheer) wherever it happens; there is no other reward. Each badge shows its name, goal and one line:

| Group      | Badge                   | Goal                                | Line                          |
| ---------- | ----------------------- | ----------------------------------- | ----------------------------- |
| Firsts     | First Steps             | Finish your first zone              | Every walk starts somewhere.  |
| Firsts     | Round Trip              | Finish all 4 zones of a walk        | Home before the streetlights. |
| Firsts     | Double Leash            | Walk 2 dogs at once                 | Twice the tails.              |
| Firsts     | Pack Leader             | Walk 3 dogs at once                 | Twelve paws, one plan.        |
| Mastery    | Clean Paws              | Finish a zone without a bump        | Not a speck on them.          |
| Mastery    | Not a Scratch           | Finish a walk without a bump        | Spotless, start to finish.    |
| Mastery    | Five-Star Service       | Finish 10 walks without being fired | The reviews are in.           |
| Mastery    | Big Payday              | Earn $500 in one walk               | Treats are on you.            |
| Collection | Full Kennel             | Own all 9 dogs                      | Every leash is spoken for.    |
| Collection | Kitted Out              | Own all 5 gear items                | A pocket for everything.      |
| Collection | Neighbourhood Favourite | Finish a walk with every dog        | Everyone's met you now.       |
| Collection | Top Walker              | Own every dog and all 3 dog slots   | Maple Street's finest.        |
| Silly      | You're Fired!           | Get fired 10 times                  | They always come back.        |
| Silly      | Eau de Skunk            | Be Stinky in 3 zones of one walk    | You can smell this badge.     |
| Silly      | Squirrel!               | Let a chaser chase 5 squirrels      | So close. Every time.         |
