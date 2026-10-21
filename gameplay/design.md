# Game Design

The rulebook for the first complete game, set in one world, Maplewood. What's left to build and tune is in [`README.md`](README.md), what comes later is in [`next.md`](next.md), and undecided ideas are in [`ideas.md`](ideas.md).

[`src/data/`](../src/data/) holds every number and all content, and the [data page](https://dogwalker.tristamittermayer.com/data/) shows them with the generated card text. This doc states the rules, with numbers where they define one; the data holds the exact values. In the rules below, `$` and `♥` give the direction and rough size of a change (`$$$` and `♥♥` are bigger); the amounts are in the data.

## Pitch

A cozy pixel-art lane runner: you are a dog walker walking a pack of dogs through the neighborhood to make money.

## Pillars

1. **Cozy, not frantic:** calm speed, forgiving failure, "one more walk" appeal; playable for long stretches without stress
2. **Bumps add up:** a plain bump costs a heart and a card obstacle brings a choice; a walk ends when you finish, head home, or the last owner fires you
3. **Charming chaos:** cute dogs, dramatic owners, silly neighborhood

## Core loop

- **Before a walk:** pick a walker, your dogs (one per owned dog slot) and up to one owned gear item for your Pocket.
- **During a walk:** walk 4 of the 6 neighborhoods, starting on Elm Avenue and ending on The Long Way Home. The street scrolls toward you; switch lanes to dodge obstacles and grab pickups. A plain obstacle costs a heart; a card obstacle opens a choice card.
- **Between neighborhoods:** a neighborhood celebration that banks the pay, then a fork: each path leads to a neighborhood and carries one upgrade card, so one pick sets both.
- **After a walk:** bank your cash and spend your earnings at the Pet shop: dogs, dog slots and gear.

Reference points: Bowling Ballers (lane runner, but calmer), Hades (areas, run structure, loadout, meta progression), Vampire Survivors (choices along the way), Slay the Spire (choices as cards).

## Voice

- **Tone:** cozy, gentle and kid-friendly; the chaos is charming, the owners are dramatic, and no line mocks the player. American spelling (color, favorite, gray, neighbor), one name per thing (the walk's money is "cash"), ♥ right after its number ("+1♥", "{hearts}♥"), and no em dashes. Plain ASCII only, apart from ♥, · and the characters `src/text/pixelFont.ts` maps (−, × and curly quotes): the pixel font has no other glyphs. Walkers: Ada calm and precise, Ben easygoing, Casey warm and encouraging, Trista sporty and quick
- **Lengths:** message strip lines and first-time hints at most about 46 characters (26 always fit); the walker's bubble up to 4 lines of about 30, with walker and parting lines at 2; card option names 2 or 3 words; hit labels one or two uppercase words with "!"
- **Gadget** (Penny): nervous but kind, double-checks everything, apologizes even when firing you
- **Jesse** (Koda): laid-back runner, fitness talk (form, personal bests, shake it off)
- **Kevin** (Nugget): influencer, everything is content (feed, trending, followers)
- **Kiwi** (Archie): unflappable grandmother, "dear" and "pet", offers cookies and tea
- **Madame Lefevre** (Pepe): dog-show judge, curt and formal, scores and deductions, a little French
- **Mr. Pruitt** (Zippy): retired accountant, dry, ledgers, receipts and red ink
- **Rosa** (Duchess): retired florist, theatrical, flower metaphors and exclamation marks
- **Sam** (Biscuit): easygoing barista, coffee puns, calls you "friend"
- **Tiffany** (Snowball): wedding planner, everything rides on today, picture perfect or disaster

## Rules

### Screen and controls

- Web, phone browser first. Touch and keyboard; mouse is not planned
- Portrait, ¾ top-down view, 5 lanes of 64px (the road spans x 20 to 340 at the pack); road sprites are drawn at 48px with 40px hit boxes
- Layout: 360×560. From the top: the top bar, one row 48 tall (big cash; the neighborhood's name and progress pips, with the effect icons under the pips; then Home, Sound, Settings and Pause, left to right; mute is also in Settings and on the M key); the debuff bar, when one is active; a backdrop band showing the current neighborhood, with the message strip over its clouds; the road across the full width, scrolling all the way to the top of its area; and a row of doghouse cards along the bottom, one per dog slot. Cards and the pause menu dim the walk view (the backdrop band and the road) while the walk is paused; the top bar and doghouse cards stay lit
- **Doghouse cards:** slim cards (120×58) in pack order (the front dog, then the left and right dogs): a name header, the dog's face and its hearts, and a LEAD tag on the front dog. The owner pops in as a photo tab when something happens to them (a heart change, the firing moment), with a quip after a card choice, a lucky find or the firing. Tapping or dragging on them steers like anywhere on the road; a still hold on one shows its dog's size, hearts and owner
- **Hold to explain:** during a walk, holding anything that explains itself (an effect icon, a debuff bar, a dog card) shows its explanation and pauses the walk; releasing resumes it
- **Auto-pause:** the walk pauses whenever something takes the player's attention: the pause menu, Settings and Help, the Home question, a card, the neighborhood celebration, anything held for its explanation, and the tab being hidden or the window losing focus. Coming back to a hidden tab shows the pause menu, so the walk resumes only on Resume. Hints and achievement toasts don't pause: they show in the message strip
- **Head home:** the top bar's Home button, the pause menu's Head home and the fork card's Head home ask "Head home?", showing only what heading home gives up: "You give up $10 in pay for Elm Avenue and the Full pack bonus." (in red), plus "Neighborhoods left: 2" when any are left after this one. Keep walking is the default (key 1); Head home is key 2. Head home ends the walk (see A walk); the current neighborhood pays nothing
- The road is drawn in pseudo-3D: lanes converge toward the backdrop band and things shrink with distance. About 3.6 seconds of road are visible ahead. Lanes, distances and collisions are unchanged by it
- **Drag** (the main touch control): put a thumb down anywhere and drag. The first lane step comes after a short drag (about a third of a lane-width), and each further lane-width of travel adds one more, all relative to where the drag started, so the thumb never covers the walker. Dragging back turns the drag around. The pack moves lane by lane toward the target at the walker's lane-change speed
- **Tap:** moves one lane toward the tapped half of the road. A drag shorter than the first lane step counts as a tap
- **Keyboard:** ←/→, A/D or H/L; one lane per press; holding a key doesn't repeat
- While moving between lanes, the pack can hit things in either lane. A reverse press turns the pack around at once; each other press queues one more lane
- Taps on the top bar never move the pack; taps and drags on the doghouse row steer. Pause offers Resume, Help, Settings and Head home
- The walker is at the bottom, the dogs close ahead in the same lane on visible leashes, every dog readable. Hazards hit through one rectangle per dog and one for the walker, each a few pixels inside its sprite; leashes can't be hit. A plain hit lands on the dog whose rectangle touched: if only the walker's did, on the front dog; if several dogs' did, on the one nearest the contact. Card obstacles hit the whole pack. Pickups (tips, treats and lucky finds) collect anywhere in the pack's whole outline, leashes included. Lane changes sweep the pack, so a fast move across several lanes can't skip a hazard or a pickup. Obstacle rows leave room for the pack's full length. The game sets the pack's formation by size, never the player: the biggest dog leads in front (drawn behind the side dogs) and is the front dog for head-on hits, tips and treats, the next biggest walks on the left and the smallest on the right; ties go by roster order (Archie, Biscuit, Duchess, Koda, Nugget, Penny, Pepe, Snowball, Zippy). Two dogs walk side by side out front, a little less far forward than a 3-dog lead, the bigger on the left as the front dog. One dog walks centred in the lead spot. The pack stays inside its lane: no dog's hit box reaches into the next lane, so a pack fully in a lane never touches an obstacle in the lane beside it. A treat goes to the dog nearest where it touched, or the front dog if only the walker or a leash touched it. A small dog dodges 1 in 4 of the plain hits that would land on it, with a "Dodge!" label over it; the hit then costs nothing and doesn't count as a bump (Clean Paws, Not a Scratch)
- Spawning always leaves a reachable path, so every hit is avoidable
- A hit obstacle is removed at once, and obstacles are ignored for a short grace window; pickups still count.
- Scroll speed and obstacle density rise gently each neighborhood
- **Pulls:** every dog pulls toward squirrels, and the pull is a squirrel's only cost: touching one does nothing. A dog pulls the pack one lane only toward a squirrel you can see, and one dog strains at a time, the one nearest the squirrel side to side. The dog strains for about 1 second, with a bubble over it, an arrow and a line to the squirrel, and a taut leash; then the pack lurches one lane toward the squirrel, unless you steer away during the strain, which cancels the pull; in an edge lane, pressing toward the edge counts as steering away. The strip announces the strain ("Koda spotted a squirrel!") as its cue; a cancel is quiet. A pull never moves the pack into an obstacle it can't react to: if the target lane has an obstacle too close, the dog strains but doesn't pull

### Resources

- **Money ($):** the only currency, in whole dollars. A multiplied amount rounds to the nearest dollar
  - **Cash:** what you carry during the walk. It starts at a $5 purse (more with the Fanny pack) and grows with tips and lucky finds; card options are paid from it. It never goes below $0, and what's left is banked at the end
  - **Tips:** a tip is $1. Tips are the main income: each neighborhood spawns 40 or more, whatever the pack size
  - **Pay:** the steady part. After each neighborhood, each walking dog earns $10, times the neighborhood's pay multiplier. Pay is banked at the end of each neighborhood: at its celebration, or on the end screen after neighborhood 4. A firing loses that dog's pay for the current neighborhood and the Full pack bonus; its earlier pay stays banked
- **Owner happiness (♥):** one meter per dog, shown on its doghouse card as the dog's face and its hearts, with the owner popping in on events (see Doghouse cards); it never relies on color alone. The dog's size sets its max (see Dogs). Every owner starts full, and treats restore hearts up to the max. At 0 the owner fires you with a quip and the dog leaves
- **Every change shows its cause:** each ♥ or $ change shows a short floating label at the dog or the bank (e.g. "−1♥, bump", "+$1 tip"); a card's enlarged view lists the modifiers behind its numbers

### A walk

- A walk is 4 neighborhoods of Maplewood. Each neighborhood is the same distance and takes about 2 minutes; a full walk takes about 8 minutes
- After neighborhoods 1 to 3, the neighborhood celebration, then a fork. Neighborhood 4 has no fork
- **Forks:** the road meets a cross street; after neighborhoods 1 and 2 a fork card offers three paths (left, straight, right), each leading to a neighborhood you haven't walked this walk other than The Long Way Home, sorted easiest on the left to hardest on the right. The fork after neighborhood 3 leads only to The Long Way Home, so it shows one path (with its upgrade) plus Head home. Each path card shows the neighborhood's name, difficulty and pay multiplier, and the one upgrade card it carries. Picking a path picks the next neighborhood and its upgrade at once. A Head home button under the paths ends the walk there, with the same give-up line as the Home question
- **Neighborhoods** (6, each walk visits 4 with no repeats):

| Neighborhood      | Difficulty | Pay   | Encounter mix                                                           |
| ----------------- | ---------- | ----- | ----------------------------------------------------------------------- |
| Willow Crescent   | Easiest    | ×0.7  | A sleepy cul-de-sac: few obstacles, cats, the mail carrier              |
| Fairview Park     | Easy       | ×0.8  | Other dogs, squirrels, bunnies, more lucky finds; no thieves, no cars   |
| Elm Avenue        | Normal     | ×1    | Puddles, the mail carrier, cones, cars. Always the first                |
| Main Street       | Hard       | ×1.25 | Thieves, the ice cream truck, benches, trucks, more tips                |
| Riverside Path    | Hard       | ×1.25 | A riverside path: puddles, geese, ducklings, cyclists, more lucky finds |
| The Long Way Home | Hardest    | ×1.5  | Everything, densest and fastest. Always the last                        |

- The walk ends after neighborhood 4, on Head home, or when no dogs are left. Your cash is banked
- **Full pack home:** when every dog you set out with gets home at the end of neighborhood 4, the walk pays a Full pack bonus of $$ per dog into the bank, shown on the end screen. Heading home early or a firing loses it
- **End screen:** the walk's total with a breakdown (pay, tips, lucky finds, Full pack bonus, card costs, starting cash), neighborhoods walked and the bank; a new-best ribbon when it beats the best walk; one closing line from each owner (a happier line from owners still walking, the fired line from owners who fired you)

### Choice cards

- Used for encounters and forks. Up to three across, art-led: an illustration plus a one-line effect; hold to enlarge for details
- Each option's outcome is fixed and shown on the card, with hearts per dog ("−1♥ Duchess, −1♥ Koda", not "−1♥ each"). Choices only, no minigames
- Every card hits the whole pack. No card opens without a collision, except the fork card
- A hit that opens a card costs nothing until you choose
- A money option shows its price on its plate ("$10"), grayed out when you can't afford it, so cash never goes below $0; every card keeps at least one option that costs no money, and its plate is blank
- An option whose heart Kind words would forgive says so on the card before you pick ("−1♥ Koda, forgiven")
- An option that would fire an owner says so ("Fires Jesse")
- A debuff option states its stake on the card ("Pull away → Zoomies: the pack drifts on its own for 20s", "Quick rinse → Stinky: tips pay nothing for 20s")
- A fork's path card shows its pay multiplier ("Pay ×1.25") and its upgrade's duration (Now, Next neighborhood, Rest of walk) where other cards show a price
- Slower options cost money (missed tips) instead of time
- Money options are charged once per card, whatever the pack size; heart options cost each owner, so a bigger pack has more owners who can fire you
- A card shows at most 3 options. Hall pass offers Walk on by (a free option that skips the card) on every card until it's used in that neighborhood; Walk on by replaces the most expensive option when a card already has 3. Sweet talker and Hall pass can both apply to the same card: its money options are free and Walk on by is offered, and the player chooses; Sweet talker is used up by that card whichever option is picked
- After a card choice, each owner whose hearts changed reacts with a quip in the message strip. Each owner has 2 lines for each of: happier, upset, fired, and parting

### Teaching, sound and settings

- **First-time hints:** a one-line hint in the message strip the first time each thing appears (first puddle, first pull, first treat and so on); the help screen covers the rest. The low-hearts hint ("At 0♥ an owner fires you") jumps ahead of any waiting hint, so it shows before the first firing. Nothing teaches by overlaying the road: no tutorial overlays or swipe tips on the play area
- **Sound:** short effects (tip, treat, bump, bark, card open, fired), a sound for each card obstacle's hit (spray hiss, coin scatter, friendly woof), a splash on a puddle, a chitter when a dog strains toward a squirrel, a badge-earned jingle and a new-best fanfare, and one music loop for the walk. While the walk is paused by the player (the pause menu, Settings, Help or the Home question), the music drops to 30% volume and comes back on resume; it stays full under cards and the celebration, and goes silent while the tab is hidden
- **Settings** (from pause and the home screen): sound on or off, music volume, effects volume, reduced motion
- **Panels:** every page and overlay has one close control at the top right. Tapping the dimmed background outside a panel closes it (Help, the logbook, the Pet shop, Settings, Stats, the Nice! badge, the home screen's detail cards and the Neighborhood done celebration), and outside the pause menu resumes the walk; only taps count, not drags. Choice cards and the New walker celebration wait for a button. A tap on the page beside the game (left or right of it on a wide screen) counts as outside too; the nav bar and the dev panel don't

### Pickups

- **Tip:** +$1
- **Treat:** a grab item. The dog that touches it gives its owner +♥, up to the max; if that owner is already at max, the treat goes to the owner with the fewest hearts (ties to the dog nearer the front). Treats aren't carried

### Dogs

A roster of 9. You start with 1 dog slot and 1 dog, Biscuit, and buy up to 2 more slots and the other 8 dogs at the Pet shop. Each dog has its own price, from about $100 for a small dog to $300 for the biggest; the dog slots are the big purchases. Walking more dogs is the main progression: more pay and a longer-lasting walk, but more owners who can fire you.

Every dog is a fixed, named character with its own art, a size and one fixed owner. Dogs differ in play by size only:

| Size   | ♥   | Effects                                                                                                                       |
| ------ | --- | ----------------------------------------------------------------------------------------------------------------------------- |
| Small  | 3   | Dodges 1 in 4 plain hits (see Screen and controls)                                                                            |
| Medium | 4   | The baseline                                                                                                                  |
| Big    | 5   | Heavy: each big dog slows lane changes (−0.1 agility, never below Relaxed); its detail card says "Heavy: slower lane changes" |

| Dog      | Size   | Breed                | Owner                          | Look                                                                 |
| -------- | ------ | -------------------- | ------------------------------ | -------------------------------------------------------------------- |
| Archie   | Medium | Australian Shepherd  | Kiwi, grandmother              | Red merle, one blue eye, red bandana                                 |
| Biscuit  | Medium | Beagle               | Sam, barista                   | Tricolor, floppy ears, green collar                                  |
| Duchess  | Small  | Maltese              | Rosa, retired florist          | White coat, pink bow                                                 |
| Koda     | Big    | Alaskan Malamute     | Jesse, trail runner            | Big and heavy, gray and white, blue eyes, harness                    |
| Nugget   | Small  | Pug                  | Kevin, pet influencer          | Fawn, black mask, tiny bandana                                       |
| Penny    | Big    | Golden Retriever mix | Gadget, inspector              | Smooth golden coat, blocky head, otter tail, blue collar             |
| Pepe     | Medium | Miniature Poodle     | Madame Lefevre, dog-show judge | Black coat, a white stripe from head to tail tip, show-clip pom-poms |
| Snowball | Big    | Great Pyrenees       | Tiffany, wedding planner       | Giant white fluff, collar with a bell                                |
| Zippy    | Small  | Jack Russell         | Mr. Pruitt, retired accountant | White with tan patches, red collar                                   |

Three dogs come in each size. Size shows at a glance: on the road, medium dogs are drawn 48 px, big dogs 54 px and small dogs about 38 px, in every animation, with small dogs drawn chunky so they still read; portraits and doghouse faces differ less, about 1.1× and 0.9×. Hit boxes don't change. Each owner has a name and quips in their own voice. Each dog's data is in [`src/data/dogs.ts`](../src/data/dogs.ts).

### Encounters

Three card obstacles open a choice card: the other dog, the skunk and the thief. Card obstacles carry no special marking on the road.

| Encounter | Options                                                                     |
| --------- | --------------------------------------------------------------------------- |
| Other dog | Let them sniff → −$ (missed tips), +♥ each · Pull away → _Zoomies_          |
| Skunk     | Full groom → −$$ · Quick rinse → _Stinky_ · Hold your nose → −♥ each        |
| Thief     | Let them go → −$$ (stolen tips) · Chase them off → −♥ each (dogs worked up) |

Each option costs one thing: money, hearts or a debuff. Let them sniff is the one trade, money for hearts.

- **Puddle:** no card. Hitting one costs no heart and makes the pack _Muddy_, with a plain obstacle's short hit stop
- **Squirrel:** no card and no hit: touching one does nothing. It darts across as an animal mover, and its cost is the pull toward it (see Pulls)

Each debuff has one source: Muddy from a puddle, Stinky from the skunk's Quick rinse, Zoomies from the other dog's Pull away.

**Debuffs** are mild, and each lasts 20 seconds of walking. Nothing on the road cures one; it runs out. Applying one the pack already has restarts its 20 seconds; none stacks. Each is announced in the message strip when it starts and when it ends. While it lasts, a bar in the debuff's color runs the full width of the game just below the top bar, over the clouds, with the debuff's icon and name, and drains over the 20 seconds; two active debuffs stack as two bars. Each debuff has its own color. Hold a bar to see what the debuff does.

- **Muddy:** every plain bump costs 2♥ instead of 1
- **Stinky:** tips still appear, but a grabbed tip pays $0 and shows a gray "+$0 Stinky" label
- **Zoomies:** about once a second, the pack drifts one lane in the direction it last moved; at the road's edge it turns and drifts the other way. Steering still works, so you counter the drift. A drift never moves the pack into an obstacle it can't react to, the same as a pull

### Lucky finds

Good things to bump into on purpose. None opens a card: each bobs on the road and pays out on contact, with a short popup and a quip from the owners who gained.

- **Generous neighbor:** a treat for each dog: +♥ to every owner, the hearts jackpot
- **Lost wallet:** +$$ found money, the money jackpot

### Plain obstacles

Plain obstacles open no card. A plain hit costs 1♥ from the owner of the dog it lands on (see Screen and controls). No collision ever costs money: a collision costs hearts, makes the pack Muddy (a puddle) or opens a card, and money is lost only through a card option you pick.

### Obstacle sizes

Obstacles span lanes and rows. None is wider than 3 lanes, every row leaves at least 2 lanes open, and the reachable-path rule still holds. Touching any part of it on screen counts as one hit; the whole obstacle is removed and the grace window starts. Once an obstacle is below the walker's feet it can no longer hit, however many rows it spans. Wherever the path has to change lanes between two obstacles, the gap between them is at least the whole pack's height plus every lane change the path needs there (crossing a 3-lane obstacle's width takes up to three) plus about half a second to react, so the pack visibly fits and has time to cross. Two obstacles 2 or more lanes wide never sit in neighboring rows: at least one empty row separates them.

| Obstacle                                                                                                                                               | Kind  | Size (lanes × rows) |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ------------------- |
| Skunk (with its spray cloud)                                                                                                                           | Card  | 2 × 2               |
| Puddle                                                                                                                                                 | Muddy | 2 × 1               |
| Other dog, thief                                                                                                                                       | Card  | 1 × 1               |
| Squirrel                                                                                                                                               | Pull  | 1 × 1               |
| Ball, bin, bunny, cat, cone, cyclist, ducklings, frisbee dog, goose, jogger, kid on a bike, mail carrier, pigeons, raccoon, scooter, seagull, stroller | Plain | 1 × 1               |
| Car, delivery truck, garbage truck, ice cream truck, parked car                                                                                        | Plain | 1 × 3               |
| Bench                                                                                                                                                  | Plain | 2 × 1               |
| Hedge                                                                                                                                                  | Plain | 3 × 1               |
| Barrier (Willow Crescent, Elm Avenue, Main Street, Riverside Path)                                                                                     | Plain | 2 or 3 × 1          |

### Moving hazards

Each obstacle has one look everywhere. Some kinds can move, and every one that can always moves: none stands still. Each move is telegraphed about 1 second ahead, at most six movers are on screen at once (at most three darting animals and three vehicles slower than the road), a mover with no room on screen waits to come on rather than standing still, and the reachable-path rule accounts for every move. A mover's hit is its standing obstacle's hit. The street neighborhoods are Elm Avenue, Main Street and The Long Way Home.

| Group      | How it moves                                                                                                                                   | Who                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Animals    | Dart across the whole road, some on a slight tilt up or down the road                                                                          | Ball, Cat, Frisbee dog, Other dog, Pigeons, Seagull, Squirrel         |
| Bikes      | In their lane, down the road faster than it scrolls                                                                                            | Cyclist, Kid on a bike, Scooter                                       |
| Cars       | A driving car keeps its lane, down the road faster than it scrolls; a parked car pulls out one lane to either side (street neighborhoods)      | Car, Parked car                                                       |
| Chargers   | In their lane, straight at the pack, fast                                                                                                      | Goose                                                                 |
| Hoppers    | Jump in quick hops: the bunny 1 or 2 spots (a lane to either side, or a row up or down), the ducklings 1 or 2 lanes across, the raccoon 1 spot | Bunny, Ducklings, Raccoon                                             |
| People     | Take 1 or 2 slow steps in any direction: a lane to either side, or a row up or down                                                            | Mail carrier                                                          |
| Thieves    | Take one step toward the pack in any of the 8 directions: a lane to either side, a row up or down, or diagonally, whichever brings it closest  | Thief                                                                 |
| Runners    | In their lane, a jogger toward the pack and a stroller ahead of it, slower than the road                                                       | Jogger, Stroller                                                      |
| Trucks     | Like cars, in their lane, but slower; the garbage and ice cream trucks slower than the road                                                    | Delivery truck, Garbage truck, Ice cream truck (street neighborhoods) |
| Stationary | Never move                                                                                                                                     | Barriers, benches, bins, cones, hedges, puddles and skunks            |

### Feedback

- **Forgiven heart:** whenever Kind words forgives a heart, from a bump or a card choice, a "Forgiven!" label floats over the dog (like "Dodge!") and the heart on its doghouse card flashes back with a sparkle, alongside the strip line "Kind words! Jesse lets it go."
- **Message strip:** a strip over the clouds at the top of the backdrop band tells what just happened, newest line big with its icon, older lines fading. Lines (in the text data):
  - Debuff ends: "All clean again." · "The pack smells fine again." · "The zoomies wore off."
  - Debuff starts: "Muddy paws! Bumps cost 2♥ for 20s." · "Stinky pack! Tips pay nothing for 20s." · "Zoomies! The pack won't sit still for 20s."
  - Effect starts: the effect line of an upgrade, the walker's perk or the Pocket item
  - Fired: "Jesse fired you! Koda heads home."
  - First-time hints (see Teaching)
  - Last heart: "Jesse has 1♥ left!"
  - Lucky find: "A neighbor shares treats! Everyone +1♥"
  - Plain hit: "Koda bumped the cone! Jesse −1♥"
  - Pull: "Koda spotted a squirrel!"
  - Treat: "Biscuit got a treat! Sam +1♥"
- **Road markers:** things worth grabbing (tips, treats and lucky finds) bob gently; obstacles carry no marker. With reduced motion nothing bobs
- **Effect icons:** upgrades in effect, the walker's perk and the Pocket item show as small icons under the neighborhood's progress pips. Hold one to see what it does
- **Firing moment:** when an owner fires you, their face pops up large over the dog's doghouse card with their fired line, a "FIRED!" plate shows, and the dog trots off the road edge; it plays right after the hit or card choice that fired you
- **First visit:** on a brand-new save, the starter's owner waits at the gate in the gate scene until the first walk. A new save starts with Casey and Biscuit picked, so the first walk is one tap on Start walk
- **Heart changes:** a lost heart pops over the dog on the road as a big broken heart with "−1", then arcs down into its doghouse card. A gained heart pops in pink and flies up from the dog the same way. Every heart change plays this, whatever its cause
- **Hit moments:** every card obstacle's hit plays a big moment before its card: a burst over the pack, a brief flash at the screen edges, a large label (other dog "NEW FRIEND!", skunk "SPRAYED!", thief "YOINK!") and the pack shaking off
- **Hit stop:** hitting an obstacle freezes the road and the pack briefly while its hit plays (about 1 second for an encounter, before its card; about 0.3 seconds for a plain obstacle). Input is ignored during the stop, and it doesn't count as walk time. Lucky finds don't stop the walk
- **Low hearts:** an owner at 1♥ looks upset, and their doghouse card shows it
- **Pay banked:** at each neighborhood's end, the celebration shows the pay banked for it
- **Return home:** the end screen shows the walker and pack coming back up the front path while the owners wave; fired dogs are absent
- **Treat grabbed:** the owner smiles and a "+1♥" label shows over the dog

Scenery gags (a cat on a fence, a sprinkler, a kite caught in a tree) play in the backdrop band; they open no card and have no effect.

### Neighborhood celebration

After each of neighborhoods 1 to 3, before the fork, a short celebration plays over the paused road. After neighborhood 4 the end screen takes its place, after a New walker celebration when finishing it unlocks a walker.

- **Neighborhood banner:** each neighborhood opens with a banner over the road, "Maplewood, neighborhood 2" above its name; the player never sees the word "zone"
- **Neighborhood done:** the walker you're walking with cheers, under a big "Neighborhood done!" and the neighborhood's name below it, with the pay it banks and its tips ("+$20 pay · +$26 tips"). It moves on by itself after 2 seconds, or at a tap
- **New walker:** the first time you finish the neighborhood that unlocks a walker, that walker runs in to join, under a big "New walker!" and "Ben joins you!" below it, with their line ("Nice pack! Mind if I tag along?") and their agility and perk ("Relaxed · Treat finder"). It waits for a tap on "Welcome!" (key 1). This replaces the Neighborhood done version for that neighborhood
- Confetti plays in both; with reduced motion it doesn't

### Upgrade cards

Walk-only boosts, one on each fork path, from a pool of 6. Each fork draws one per path at random from the remaining pool. Picking a path takes its upgrade, which leaves the pool for the rest of the walk; "next neighborhood" is the one that path leads to.

- Belly rubs: +♥ to every owner now
- Big tipper: every tip is worth $1 more in the next neighborhood
- Good leash: no dog pulls toward squirrels
- Raincoats: puddles don't muddy: no Muddy and no hit stop
- Rush hour (trade-off): twice the tips and treats and more obstacles in the next neighborhood
- Sweet talker: the first card in each neighborhood has free money options (hearts and debuffs still cost), and that card uses it up whichever option you pick

Effects without "now" or "next neighborhood" last the rest of the walk.

### Walkers

Four walkers. Each has an agility, which sets how fast the pack changes lanes, and one perk. Walkers' agility spreads from 0.9× to 1.2× the base lane-change speed, and Running shoes add 0.1, so Trista wearing them reaches 1.3 (each big dog in the pack takes 0.1 off, never below Relaxed). Players see it as a word: Relaxed (0.9), Steady (1.0), Quick (1.1), Nimble (1.2), Lightning (1.3, reached only with Running shoes); the slowest walker's lane move sets the row spacing, so the low end stays near 1. Every walker walks the same road at the same speed. You start with Casey; each other walker unlocks the first time you finish a named neighborhood.

| Walker | Agility | Perk         | Effect                                                                                             | Unlock                   |
| ------ | ------- | ------------ | -------------------------------------------------------------------------------------------------- | ------------------------ |
| Casey  | Steady  | Kind words   | The first ♥ lost in each neighborhood is forgiven (one heart, including one of a Muddy bump's two) | Start                    |
| Ben    | Relaxed | Treat finder | Twice as many treats appear                                                                        | Finish Fairview Park     |
| Ada    | Quick   | Calm voice   | Debuffs last half as long (10 seconds)                                                             | Finish Riverside Path    |
| Trista | Nimble  | Long reach   | Grabs tips and treats one lane to either side (front dog)                                          | Finish The Long Way Home |

- A newly unlocked walker joins you in the Neighborhood celebration
- A walker's effects stack with the Pocket item and upgrade cards
- The numbers are first guesses; tuning sets them against the walker spread in [`README.md`](README.md)

### Home screen and progression

Everything bought at the Pet shop is permanent; upgrade cards are the walk-only boosts. Progress (bank, owned items, stats, achievements) is saved between sessions; storage is in [`src/README.md`](../src/README.md).

- **Layout, top to bottom:** the top bar (bank, best walk, walk count and the Logbook button on the left; every control at the top right: help, sound, settings); the gate scene; then three framed sections in order: Walker, Dogs, Pocket (optional); then the Start walk button at the bottom. A section's frame lights up once it's complete; until then its band prompts ("Tap a face"), and the Dogs band shows the pack count with no label ("0/1" or "1/2"). Nothing else sits between the sections
- **Pet shop:** a building in the gate scene, its sign the same green as Start walk (tappable entry points share one color); tap it to open the shop, which sells everything you buy: gear, dogs and dog slots. It has two tabs. Gear lists the 4 items under "Yours to keep", each with a short effect line, marking owned ones "Owned". Dogs lists the dogs you don't own yet, each row showing its size and hearts ("Big, 5♥"), and the dog slots ("1 of 3 owned", "Walk 2 dogs at once"; a later slot shows "Buy slot 2 first"). Tap an item to buy it, at any time you can pay; anything you can afford in the shop has a gold outline. On the home screen only the Pet shop building gets the gold outline, while anything in it is affordable. Tapping a locked dog or dog slot on the home screen opens the shop at that item
- **Tile states** (walkers, dogs and Pocket gear alike): Locked (not owned): a gray silhouette with a padlock and a price or goal plate, and no word; Available (owned, not picked): full color in a plain frame; Picked: full color in a gold frame with a check; Pack full (owned, not picked, while every slot is filled): grayed in color, and a tap shows "The pack is full. Tap a picked dog to take it out."
- **Details:** hold any dog or gear item, on the home screen or in the shop, for a detail card: a dog's breed, size and hearts, owner, pay and per-dog stats; a gear item's name and effect
- **Start button:** the only button below the sections, reading "Start walk" in every state, and not ready until a walker and a dog are picked (the Pocket is optional). Each dog tile shows its pay
- **Walker's lines:** the walker's speech bubble reacts to state: first visit "Morning! Who's walking today? Tap to pick, hold for details."; after each of the first 3 walks "Tap to pick, hold for details."; after later walks "Nice walk! Who's next?"; after a firing "Rough walk. They'll come around."; when something new in the shop is affordable "Something new at the Pet shop!"
- **Messages:** every message shows in the walker's bubble, up to 4 lines of about 30 characters: buying a dog shows "Nugget joins your clients!" with the owner's parting line; tapping something you can't afford shows "Save $45 more for Nugget."; notices such as "Progress won't be saved." Walker's lines and parting lines keep to 2 lines
- **Gear and Pocket** (4 items, bought once at the Pet shop): Fanny pack (start every walk with +$20); Hall pass (once per neighborhood, skip one encounter card for free); Lucky collar (every owner has +1 max ♥); Running shoes (+0.1 agility, one agility word up). The Pocket section is a strip of all 4 items: tap an owned item to pocket it (gold frame), tap it again to empty the Pocket; an unowned item is locked with its price, and tapping it opens the shop on it. The section's band names the pocketed item, or reads "One per walk" when the Pocket is empty; hold an item for its effect. Put 1 owned item in your Pocket before each walk, or none. The item is kept, never used up, and switches freely between walks; its effects refresh each walk
- **Walker picker:** choose from the walkers you've unlocked (see Walkers). Walkers, dogs and the Pocket item share one pick toggle: tap to pick, tap the picked one again to unpick it. The walker choice is saved and comes back picked, unless it was unpicked; with no walker picked, the bubble asks "Who's walking? Tap a face." Locked walkers use the Locked tile state with a name plate ("Ben"); tapping one shakes it and the bubble gives the goal, "Finish Fairview Park to unlock Ben."; a picked walker's bubble gives their agility and perk ("Ben: relaxed, Treat finder."); a newly unlocked walker shows the walker's line "New walker!", which comes ahead of the firing line
- **Gate scene:** the chosen walker and the picked pack on the front path, heading out to Elm Avenue under its street sign, beside a "Dog Walker" yard sign and the Pet shop. The Pocket item shows as a badge beside the walker
- **Owner parting line:** picking a dog shows a line from its owner (e.g. Jesse: "He already did 10K. He's fine.")
- **Logbook** (a button in the top bar that opens a panel; nothing shows on the home screen until it's opened): best walk (amount, neighborhoods, dogs), totals (walks, dogs walked, times fired) and the last walk as one line ("Kevin fired you on Fairview Park.")
- **Stats page** (behind the logbook, which also opens the badge wall directly; the screens say "walk", never "run"): walks played; walks finished, headed home or out of dogs; best walk earnings; lifetime earnings; total firings and the owner who fired you most; most neighborhoods finished in a walk (heading home mid-neighborhood doesn't count it). Each dog's roster card shows its walks, neighborhoods finished and times fired
- **Achievements:** a badge wall on the Stats page, earned badges in color and locked ones grayed with their goal. Earning one plays a short celebration (owners cheer) wherever it happens; a money goal counts the walk's total on the end screen (net of starting cash), checked when it's banked; there is no other reward. Each badge shows its name, goal and one line:

| Group      | Badge                 | Goal                                             | Line                                      |
| ---------- | --------------------- | ------------------------------------------------ | ----------------------------------------- |
| Firsts     | First Steps           | Finish your first neighborhood                   | Every walk starts somewhere.              |
| Firsts     | Round Trip            | Finish all 4 neighborhoods of a walk             | Home before the streetlights.             |
| Firsts     | Double Trouble        | Walk 2 dogs at once                              | Twice the tails, twice the tangles.       |
| Firsts     | Pack Leader           | Walk 3 dogs at once                              | Twelve paws, one plan.                    |
| Firsts     | Dream Team            | Unlock all four walkers                          | The whole crew's here.                    |
| Mastery    | Clean Paws            | Finish a neighborhood without a plain bump       | Not a speck on them.                      |
| Mastery    | Not a Scratch         | Finish a walk without a plain bump               | Spotless, start to finish.                |
| Mastery    | Everybody Home        | Earn the Full pack bonus with 3 dogs             | Nobody left behind.                       |
| Mastery    | Dodge Ball            | Small dogs dodge 10 bumps, across all walks      | Small but mighty.                         |
| Mastery    | Five-Star Service     | Finish 10 walks with nobody fired                | The reviews are in.                       |
| Mastery    | Big Payday            | Earn $300 in one walk                            | Treats are on you.                        |
| Collection | Full Kennel           | Own all 9 dogs                                   | Every leash is spoken for.                |
| Collection | Kitted Out            | Own every gear item                              | A pocket for everything. Well, one thing. |
| Collection | Neighborhood Favorite | Finish a walk with each of the 9 dogs            | Everyone's met you now.                   |
| Collection | Top Walker            | Own every dog and all 3 dog slots                | Maplewood's finest. Ask any dog.          |
| Silly      | You're Fired!         | Get fired 10 times                               | They always come back.                    |
| Silly      | Close Shave           | Finish a walk with an owner on 1♥                | Phew. Nobody saw that.                    |
| Silly      | Eau de Skunk          | Get Stinky 3 times in one walk                   | You can smell this badge.                 |
| Silly      | Mud Season            | Get Muddy 3 times in one walk                    | Wipe your paws, please.                   |
| Silly      | Zoomies!              | Get the zoomies 3 times in one walk              | Zero to sixty, every time.                |
| Silly      | Squirrel!             | Get pulled toward 15 squirrels, across all walks | So close. Every time.                     |
| Silly      | Yoink!                | Let 10 thieves get away, across all walks        | They had a getaway scooter.               |
| Silly      | Sniff Test            | Let the pack sniff 20 dogs, across all walks     | Hello. Hello. Hello.                      |
| Silly      | Snack Attack          | Grab 50 treats, across all walks                 | Crumbs everywhere.                        |
