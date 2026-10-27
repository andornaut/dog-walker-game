# Game Design

The rulebook for the first complete game, set in one world, Toronto. What's left to build and tune is in [`README.md`](README.md), what comes later is in [`next.md`](next.md), and undecided ideas are in [`ideas.md`](ideas.md).

[`src/data/`](../src/data/) holds every number and all content (names, text, prices, shapes, weights), and the [data page](https://dogwalker.tristamittermayer.com/data/) shows them with the generated card text. This doc states the rules, with numbers where they define one. `$` and `♥` give the direction and rough size of a change (`$$$` and `♥♥` are bigger).

## Pitch

A cozy pixel-art lane runner: you are a dog walker walking a pack of dogs through the neighbourhood to make money.

## Pillars

1. **Cozy, not frantic:** calm speed, forgiving failure, "one more walk" appeal; playable for long stretches without stress
2. **Bumps add up:** a bump costs a heart and a card obstacle brings a choice; a walk ends when you finish, head home, or the last owner fires you
3. **Charming chaos:** cute dogs, dramatic owners, silly neighbourhood

## Core loop

- **Before a walk:** pick a walker, your dogs (one per owned dog slot) and up to one owned gear item for your Pocket.
- **During a walk:** walk 4 of the 6 neighbourhoods, starting in High Park and ending on Yonge Street. The street scrolls toward you; switch lanes to dodge obstacles and grab pickups. A plain obstacle costs a heart; a card obstacle opens a choice card.
- **Between neighbourhoods:** a neighbourhood celebration that banks the pay, then a fork: each path leads to a neighbourhood and carries one upgrade card, so one pick sets both.
- **After a walk:** bank your cash and spend your earnings at the Pet shop: dogs, dog slots and gear.

Reference points: Bowling Ballers (lane runner, but calmer), Hades (areas, run structure, loadout, meta progression), Vampire Survivors (choices along the way), Slay the Spire (choices as cards).

## Voice

- **Tone:** cozy, gentle and kid-friendly; the chaos is charming, the owners are dramatic, and no line mocks the player. Canadian spelling (colour, favourite, grey, neighbour), one name per thing (the walk's money is "cash"), spelled one way everywhere, so a name too long for its space is renamed everywhere rather than shortened in one place, ♥ right after its number ("+1♥", "{hearts}♥"), and no em dashes. Plain ASCII only, apart from ♥, · and the characters `src/ui/pixelFont.ts` maps (−, × and curly quotes): the pixel font has no other glyphs
- **Lengths:** message strip lines at most about 46 characters (26 always fit), and first-time hints at most 312 px at 2× (about 36 characters), so they stay full size on the one row left under a debuff bar; the walker's bubble up to 4 lines of about 30 characters, with walker's lines and owner parting lines at 2; card option names 2 or 3 words; hit labels one or two uppercase words with "!"
- **Walkers:** Ada calm and precise, Casey warm and encouraging, Mr. B easygoing, Trista sporty and quick
- **Owners** (each with 2 lines for each of happier, upset, fired and parting):
  - **Eve** (Duchess): retired florist, theatrical, flower metaphors and exclamation marks
  - **Gadget** (Penny): nervous but kind, double-checks everything, apologizes even when firing you
  - **Jason** (Kilo): laid-back runner, fitness talk (form, personal bests, shake it off)
  - **Aunt Judy** (Sequoia): wedding planner, everything rides on today, picture perfect or disaster
  - **Kiwi** (Archie): unflappable grandmother, "dear" and "pet", offers cookies and tea
  - **Ryan** (Reggie): influencer, everything is content (feed, trending, followers)
  - **Sam** (Biscuit): easygoing barista, coffee puns, calls you "friend"
  - **Sheba** (Buddy): retired accountant, dry, ledgers, receipts and red ink
  - **Ms. Tara** (Pepe): dog-show judge, curt and formal, scores and deductions, a little French

## Rules

### Screen and controls

- Web, phone browser first. Touch and keyboard; mouse is not planned
- Portrait 360×560, ¾ top-down view, 5 lanes of 64px (the road spans x 20 to 340 at the pack). The road is drawn in pseudo-3D: lanes converge toward the backdrop band and things shrink with distance, with about 3.6 seconds of road visible ahead. The road keeps a hard edge where it meets the backdrop band. Lanes, distances and collisions are unchanged by it
- **Layout,** from the top: the top bar, one row 48 tall (big cash; the neighbourhood's name with its place in the walk in grey beside it ("2 of 4") and the effect icons under it; then Home, Help, Sound, Settings and Pause, left to right; mute is also in Settings and on the M key); the debuff bars, when any is active; a backdrop band showing the current neighbourhood, with the message strip over its clouds; the road across the full width, scrolling all the way to the top of its area; and a row of doghouse cards along the bottom, one per dog slot. Cards and the pause menu dim the walk view (the backdrop band and the road); the top bar and doghouse cards stay lit
- **Doghouse cards:** slim cards (120×58) in pack order (the front dog, then the left and right dogs): a name header, the dog's face, the owner's face (see Owner faces) and name with their hearts, and a LEAD tag on the front dog. A fired dog's card keeps the owner's face, looking fired. The owner pops in as a photo tab when something happens to them (a heart change, the firing moment); the firing moment carries its own quip, and every other quip shows in the message strip. A still hold on a card shows its dog's size, hearts and owner
- **Pausing:** the pause menu offers Resume, Help, Settings and Head home. The walk pauses whenever something takes the player's attention: the pause menu, Settings and Help, the Home question, a card, the neighbourhood celebration, anything held for its explanation, and the tab being hidden or the window losing focus. Coming back to a hidden tab shows the pause menu, so the walk resumes only on Resume. While the walk is paused, everything in it holds: the road, the pack, the heart pops and other change labels, and the message strip's lines, which age only while walking. Hints and achievement toasts don't pause: they show in the message strip
- **Hold to explain:** during a walk, holding anything that explains itself (an effect icon, a debuff bar, a dog card) opens its explanation in a detail card, the same one the home screen's Details show, never in the message strip, and pauses the walk. The card stays up after the finger lifts; a tap anywhere closes it and resumes the walk, and does nothing else
- **Head home:** the top bar's Home button, the pause menu's Head home and the fork card's Head home ask "Head home?", showing only what heading home gives up, in red: the current neighbourhood's pay, plus the number of neighbourhoods left after this one when any are. Keep walking is the default (key 1); Head home is key 2. Head home ends the walk (see A walk); the current neighbourhood pays nothing
- **Drag** (the main touch control): put a thumb down anywhere and drag. The first lane step comes after a short drag (about a third of a lane-width), and each further lane-width of travel adds one more, all relative to where the drag started, so the thumb never covers the walker. Dragging back turns the drag around. The pack moves lane by lane toward the target at the walker's lane-change speed
- **Tap:** moves one lane toward the tapped half of the road, as soon as the finger lands; on the doghouse row, when it lifts, so holding a card only explains it. A drag shorter than the first lane step counts as a tap, and a drag whose first step goes against the tap takes the tap back, so the pack ends where the drag alone puts it
- **Keyboard:** ←/→, A/D or H/L; one lane per press; holding a key doesn't repeat
- While moving between lanes, the pack can hit things in either lane. A reverse press turns the pack around at once; each other press queues one more lane
- Taps on the top bar never move the pack; taps and drags on the doghouse row steer like anywhere on the road

### The pack and hits

- **Formation:** the walker is at the bottom, the dogs close ahead in the same lane on visible leashes, every dog readable. The game sets the formation by size, never the player: the biggest dog leads in front (drawn behind the side dogs) and is the front dog, the next biggest walks on the left and the smallest on the right; ties go by roster order (alphabetical by name). Two dogs walk side by side out front, a little less far forward than a 3-dog lead, the bigger on the left as the front dog. One dog walks centred in the lead spot. No dog's hit box reaches into the next lane, so a pack fully in a lane never touches an obstacle in the lane beside it
- **Hit boxes:** one rectangle per dog and one for the walker, each a few pixels inside its sprite; leashes can't be hit. Road sprites are drawn at 48px, and each obstacle hits as drawn: 2 px inside its opaque outline, at its depth, within its own lanes. Touching any part of an obstacle counts as one hit. Once an obstacle is below the walker's feet it can no longer hit, however many rows it spans
- **Who a hit lands on:** a bump lands on the dog whose rectangle touched: if only the walker's did, on the front dog; if several dogs' did, on the one nearest the contact. Card obstacles hit the whole pack. Pickups (tips, treats and lucky finds) collect anywhere in the pack's whole outline, leashes included. Lane changes sweep the pack, so a fast move across several lanes can't skip a hazard or a pickup
- **Bumps:** running into an obstacle that opens no card is a bump. A bump costs 1♥ from the owner of the dog it lands on. A collision costs hearts, makes the pack Muddy (a puddle) or opens a card. In the Spotlight a bump also costs money (see Encounters and debuffs); otherwise money is lost only through a card option you pick
- **After a hit:** the obstacle is out of play at once but stays on the road as scenery (a cone tipped over, a trash can rocking, a mover stopped) and scrolls off with it, touching nothing. Obstacles are ignored for a short grace window (about 0.7 seconds), during which the pack blinks; pickups still count
- **Hit stop:** a hit freezes the road and the pack briefly while it plays (about 1 second for a card obstacle, before its card; about 0.3 seconds for a plain obstacle or a puddle). Input is ignored during the stop, and it doesn't count as walk time. Lucky finds don't stop the walk

### Spawning

- Spawning always leaves a reachable path, accounting for every mover's moves, so every hit is avoidable. Each neighbourhood draws its path first: it holds each lane for at least 2 rows, its lane stays open in every row, and every lane it crosses to change lanes stays clear in the row before the change. It carries on from the last neighbourhood's lane, and a walk starts it in the pack's lane
- Scroll speed and obstacle density rise gently each neighbourhood
- Obstacles span lanes and rows (shapes in the data). None is wider than 3 lanes, every row leaves at least 2 lanes open, and obstacle rows leave room for the pack's full length. Wherever the path changes lanes between two obstacles, the road between their hit boxes, as drawn, is at least the tallest pack's height plus the one or two lane changes it makes there at a Muddy pack's speed, half the slowest pack's, plus about half a second to react. Off the path, obstacles may stand closer. Two obstacles 3 lanes wide never sit in neighbouring rows: at least one empty row separates them. Narrower ones may, wherever the gap rule and the 2 open lanes per row still hold
- A fixed obstacle that fits nowhere is swapped for one of the neighbourhood's narrower fixed obstacles, 2 lanes and then 1, drawn by their weights, so the road keeps its count. Card obstacles and the puddle are never swapped
- Obstacles, fixed and moving, go toward the lanes left clear longest, so no lane, the sides included, stays clear for long
- The first neighbourhood's first obstacle reaches the pack about two seconds in at the soonest, so a walk never opens with a hit

### Pulls

Every dog pulls toward squirrels. A squirrel is no hit and opens no card: touching one does nothing, it darts across as an animal mover, and the pull is its only cost. Since nothing has to steer around it, a squirrel blocks no lane: the road keeps no room clear for it, it may dart across where obstacles stand, and no tip, treat or lucky find lies on its path. A dog pulls the pack one lane only toward a squirrel whose cue has started (one waiting at the road's edge draws no pull yet) and that is still ahead of the pack, and one dog strains at a time, the one nearest the squirrel side to side. If the straining dog's owner fires you, the strain ends and that squirrel draws no more. The dog strains for about 1 second, with a bubble over it, an arrow and a line to the squirrel, and a taut leash; then the pack lurches one lane toward the squirrel, unless you steer away during the strain, which cancels the pull; in an edge lane, pressing toward the edge counts as steering away. The message strip announces the strain as its cue; a cancel is quiet. A pull never moves the pack into an obstacle it can't react to: if the target lane has an obstacle too close, the dog strains but doesn't pull.

### Resources

- **Money ($):** the only currency, in whole dollars. A multiplied amount rounds to the nearest dollar
  - **Cash:** what you carry during the walk. It starts at $0 and grows with tips and lucky finds; card options are paid from it. It never goes below $0, and what's left is banked at the end
  - **Tips:** a tip is $1. Tips add to the pay, whatever the pack size, and they trade off against obstacles across a walk: the first neighbourhood spawns the most tips and the fewest obstacles, and each later one has fewer tips and more obstacles (about 31 tips and 83 plain obstacles down to 22 and 89, where a late, fast road is about full). Plain obstacles are fixed ones (barriers, benches, carts, cones, hedges, parked cars, trash cans and each neighbourhood's own) and movers, in the shares each neighbourhood's weights set. No stretch of more than 3 rows of road comes into view without a visible obstacle in it (a mover counts only once its body is on the road, not from its cue, and a squirrel never, as it blocks no lane), so the road never looks quiet for long, while busy bursts and calmer stretches still come at random. A quiet stretch at a neighbourhood's first or last row runs half as long at most, so two neighbourhoods' quiet ends never add up, and a longer quiet stretch gets one of the neighbourhood's own fixed obstacles moved into it, except where no fixed obstacle can fit (a mover's path, the drawn path, or the open lanes and reaction gaps the rules keep)
  - **Pay:** the steady part. After each neighbourhood, each walking dog earns $20, the same in every neighbourhood. Pay is banked at the end of each neighbourhood: at its celebration, or on the end screen after neighbourhood 4. A firing loses that dog's pay for the current neighbourhood and the Walk bonus; its earlier pay stays banked
- **Owner happiness (♥):** one meter per dog, shown on its doghouse card; it never relies on colour alone. The dog's size sets its max (see Dogs); a smaller pack adds to its lead: walking 1 dog, its owner gets +2♥; walking 2, the front dog's owner gets +1♥; walking 3, nobody does. No owner's max goes above 6♥, whatever adds to it. While the pack chosen earns it, the start screen's Dogs band says so. Every heart looks the same, whatever adds it: the extra hearts a bonus adds (the small-pack bonus, Lucky collar, Belly rubs) are drawn like the rest, and holding the card names each source. Every owner starts full, and treats restore hearts up to the max. At 0 the owner fires you with a quip and the dog leaves
- **Every change shows its cause:** each ♥ or $ change shows a short floating label at the dog or the bank (e.g. "−1♥ bump", "+$1 tip"); a card's enlarged view lists the modifiers behind its numbers

### A walk

- A walk is 4 neighbourhoods of Toronto. Each neighbourhood is the same distance and takes about 2 minutes; a full walk takes about 8 minutes
- After neighbourhoods 1 to 3, the neighbourhood celebration, then a fork. Neighbourhood 4 has no fork
- **Forks:** the road meets a cross street; after neighbourhoods 1 and 2 a fork card offers three paths (left, straight, right), each leading to a neighbourhood you haven't walked this walk other than Yonge Street, sorted easiest on the left to hardest on the right. The fork after neighbourhood 3 leads only to Yonge Street, so it shows one path. Each path card shows the neighbourhood's name and difficulty, and the one upgrade card it carries. Picking a path picks the next neighbourhood and its upgrade at once. A Head home button under the paths ends the walk there (see Head home)
- **Neighbourhoods** (6, each walk visits 4 with no repeats):

Each neighbourhood also has its own card obstacle (see Encounters and debuffs) and a few obstacles and movers found nowhere else; a few people (the busker, the delivery cyclist and the tourist) appear in two.

| Neighbourhood       | Difficulty | Encounter mix                                                                                                                                                                                                                          |
| ------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cabbagetown         | Easiest    | Quiet Victorian streets: few obstacles, cats, raccoons, the mail carrier, a few cars; its own: leaf piles, porch steps                                                                                                                 |
| High Park           | Easy       | Other dogs, black squirrels, bunnies, Canada geese, ducklings, joggers, strollers, more lucky finds; no cars; its own: picnic blankets. Always the first                                                                               |
| Distillery District | Normal     | Cobbled pedestrian lanes: crowds of strollers, puddles, cones, a few cyclists, a hot dog cart; no cars; its own: velvet ropes, patio rails, rolling whisky barrels, tourists, couples                                                  |
| Kensington Market   | Hard       | Crowds on foot and bikes: thieves, cyclists, strollers, the mail carrier; the streetcar, delivery trucks, hot dog carts, benches, more tips; no cars; its own: produce crates, clothing racks, cargo bikes, buskers, delivery cyclists |
| The Beaches         | Hard       | The lakeshore boardwalk: joggers, cyclists, strollers, puddles, geese, ducklings, more lucky finds; its own: sandcastles, lifeguard chairs, rollerbladers                                                                              |
| Yonge Street        | Hardest    | Everything, the fastest, with gridlocked car and truck traffic and the streetcar; its own: TTC buses, sandwich boards, pedicabs, buskers, delivery cyclists, tourists. Always the last                                                 |

- The walk ends after neighbourhood 4, on Head home, or when no dogs are left. Your cash is banked
- **Walk bonus:** when every dog you set out with gets home at the end of neighbourhood 4, the walk pays a Walk bonus of $$ per dog into the bank, shown on the end screen. Heading home early or a firing loses it
- **End screen:** the walk's total with a breakdown (pay, tips, lucky finds, Walk bonus, card costs) and the neighbourhoods walked, with no bank; a new-best ribbon when it beats the best walk with the same number of dogs; one closing line from each owner (a happier line from owners still walking, the fired line from owners who fired you)

### Choice cards

- Used for encounters and forks. Up to three across, art-led: an illustration plus a one-line effect; hold to enlarge for details
- Every card hits the whole pack. No card opens without a collision, except the fork card. A hit that opens a card costs nothing until you choose
- Each option's outcome is fixed and shown on the card, with hearts per dog ("−1♥ Duchess, −1♥ Kilo", not "−1♥ each"). A perk, gear item or upgrade that changes an option shows its charm centred just under that option's card, the enlarged card included, never on the card, so the card keeps its full text box. The card row (title, cards and charms) rises to the 2/3 line of the walk view. Choices only, no minigames
- A money option shows its price on its plate, greyed out when you can't afford it, so cash never goes below $0; every card keeps at least one option that costs no money, and its plate is blank. Money options are charged once per card, whatever the pack size; heart options cost each owner, so a bigger pack has more owners who can fire you. Slower options cost money (missed tips) instead of time
- An option says what it would do before you pick: a debuff option states its stake ("Quick rinse → Stinky: tips pay nothing for 30s"), an option that would fire an owner says so ("Fires Jason"), and a heart Second chance would forgive reads as safe
- A fork's path card shows its upgrade's duration (Now, Next neighbourhood, Rest of walk) where other cards show a price
- A card shows at most 3 options. Hall pass offers "Skip (Hall pass)" (a free option that skips the card) on every card until it's used in that neighbourhood; the skip replaces the option that costs the most hearts when a card already has 3 (the most expensive of those if they tie). Sweet talker and Hall pass can both apply to the same card: its money options are free and the skip is offered, and the player chooses; Sweet talker is used up by that card whichever option is picked
- After a card choice, each owner whose hearts changed reacts with a quip in the message strip

### Teaching, sound and settings

- **First-time hints:** a one-line hint in the message strip the first time each thing appears (first puddle, first pull, first treat, the first moving obstacle's cue and so on); the help screen covers the rest. The firing hint jumps ahead of any waiting hint, so it shows before the first firing. Nothing teaches by overlaying the road: no tutorial overlays or swipe tips on the play area
- **Panels:** every page and overlay has one close control at the top right. Tapping the dimmed background outside a panel closes it (Help, the Pet shop, Settings, Stats, the badge celebration, the home screen's detail cards and the Neighbourhood done celebration), and outside the pause menu resumes the walk; only taps count, not drags. Choice cards and the New walker celebration wait for a button. A tap on the page beside the game (left or right of it on a wide screen) counts as outside too; the nav bar and the dev panel don't
- **Settings** (from pause and the home screen): sound on or off, music volume, effects volume, reduced motion
- **Sound:** short effects (tip, treat, bump, bark, card open, fired), a sound for each card obstacle's hit (spray hiss, coin scatter, friendly woof), a splash on a puddle, a chitter when a dog strains toward a squirrel, a badge-earned jingle and a new-best fanfare, and one music loop for the walk. While the walk is paused by the player (the pause menu, Settings, Help or the Home question), the music drops to 30% volume and comes back on resume; it stays full under cards and the celebration, and goes silent while the tab is hidden

### Pickups

- **Tip:** +$1
- **Treat:** a grab item, not carried. It goes to the dog nearest where it touched (the front dog if only the walker touched it), whose owner gets +♥ up to the max; if that owner is already at max, the treat goes to the owner with the fewest hearts (ties to the dog nearer the front)

### Dogs

A roster of 9, three in each size, each a fixed, named character with its own art and one fixed owner. You start with 1 dog slot and Archie, and buy up to 2 more slots and the other 8 dogs at the Pet shop. Dog prices mix sizes: each price band ($150 to $300, $450 to $600, $800 to $1,000) has dogs of at least two sizes, so a cheap dog can be large and a pricey one small; the dog slots are the big purchases. Walking more dogs is the main progression: more pay and a longer-lasting walk, but more owners who can fire you.

Dogs differ in play by size only:

| Size   | ♥   | Effects                                                                                                                                             |
| ------ | --- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Small  | 2   | Dodges 1 in 4 of the bumps that would land on it, with a "Dodge!" label; the hit costs nothing and doesn't count as a bump; its detail card says so |
| Medium | 3   | The baseline                                                                                                                                        |
| Large  | 4   | Each large dog makes lane changes 10% slower, never below 10% slower than base; its detail card says so                                             |

Size shows at a glance: on the road, medium dogs are drawn 48 px, large dogs 54 px and small dogs about 38 px, in every animation, with small dogs drawn chunky so they still read; portraits and doghouse faces differ less, about 1.1× and 0.9×. Hit boxes don't change.

### Encounters and debuffs

Nine card obstacles open a choice card: the other dog, the skunk and the thief, in several neighbourhoods, and one of each neighbourhood's own, which appears only there. Each option costs one thing: money, hearts or a debuff. The one trade is the other dog's Let them sniff, money (missed tips) for hearts. Every money option costs $20 ($10 with the Fanny pack). Most hearts options cost each walking dog's owner 1♥; the porch cat's Stand your ground costs only the lead dog's owner.

| Neighbourhood       | Card                | Options                                                                  |
| ------------------- | ------------------- | ------------------------------------------------------------------------ |
| Cabbagetown         | Porch cat           | Stand your ground (−1♥ lead dog), Treat bribe ($20), Bolt past (Zoomies) |
| High Park           | Escaped capybara    | Help the keeper (Muddy), Call the zoo ($20), Drag them away (−1♥ each)   |
| Distillery District | Wedding photo shoot | Pose (Spotlight), Walk around (−1♥ each), Pay for a reshoot ($20)        |
| Kensington Market   | Fish crate spill    | Sniff the fish (Stinky), Pay for the fish ($20), Hurry past (−1♥ each)   |
| The Beaches         | Dropped ice cream   | Let them lick it (Zoomies), Buy a new cone ($20), Walk on by (−1♥ each)  |
| Yonge Street        | Big screen promo    | Wave hello (Spotlight), Buy the merch ($20), Push through (−1♥ each)     |

The escaped capybara is a mover: it steps once or twice, like any stepper. The wedding photo shoot is 2 lanes wide; the other neighbourhood cards are 1.

A puddle opens no card: hitting one costs no heart and makes the pack _Muddy_, with a plain obstacle's hit stop.

Debuffs come from puddles and card options: Muddy from a puddle or the capybara's Help the keeper; Stinky from the skunk's Quick rinse or the fish crates' Sniff the fish; Zoomies from the other dog's Pull away, the porch cat's Bolt past or the dropped ice cream's Let them lick it; Spotlight from the wedding shoot's Pose or the promo's Wave hello. Debuffs are mild. Each lasts 30 seconds of walking, or until the neighbourhood ends, whichever comes first. Nothing on the road cures one; it runs out. Applying one the pack already has restarts its time; none stacks. Each is announced in the message strip when it starts and when it ends. While it lasts, a bar in the debuff's own colour runs the full width of the game just below the top bar, over the clouds, with the debuff's icon and name, and drains over its time; two active debuffs show as two bars. Hold a bar to see what the debuff does.

- **Muddy:** the pack's lane changes take twice as long (50% slower). Bumps cost what they always do
- **Spotlight:** a bump costs $10 of cash on top of its hearts; with less on hand it takes what's left, and at $0 nothing. Second chance may forgive the heart, never the cash. A Spotlight bump keeps a bump's hit stop and grace window and counts toward bumps, bump-free neighbourhoods and bump badges
- **Stinky:** tips still appear, but a grabbed tip pays $0 and shows a grey "+$0 Stinky" label
- **Zoomies:** about once a second, the pack drifts one lane in the direction it last moved; at the road's edge it turns and drifts the other way. Steering still works, so you counter the drift. A drift never moves the pack into an obstacle it can't react to, the same as a pull

### Lucky finds

Good things to bump into on purpose. None opens a card: each bobs on the road and pays out on contact, with a short popup and a quip from the owners who gained. The friendly neighbour walks about, one or two quick steps in any direction and with no cue, since a cue marks a hazard about to move, so the pack has to go and meet her; the lost wallet lies still.

- **Friendly neighbour:** pats for the pack, the hearts jackpot: 3♥ shared by the walking dogs, front dog first (a lone dog's owner +3♥; a pair's front dog +2♥ and the other +1♥; a trio +1♥ each), each owner capped at their max, so a smaller pack gains more per dog
- **Lost wallet:** +$$ found money, the money jackpot

### Moving hazards

Each obstacle has one look everywhere. Some kinds can move (each kind's movement is in the data), and every one that can always moves. A mover moves only while it is still ahead of the pack: once it reaches the pack's rows it makes no more moves, and nothing ever moves back up the road toward a pack that has passed it. Every movement has plenty of randomness, since the less a mover can be predicted, the harder it is to dodge: each mover's speed varies by up to about 25% either way (a dart's by up to 40%, and where it sets off is drawn apart from its speed, so a slow or a fast one can come from high up or close), each step or hop takes a little more or less time than the last, and the pause before each step, hop or dart varies widely too, so no two movers of a kind move alike. A mover warns once: its first move is telegraphed about 0.6 seconds ahead, and its later moves come with no cue of their own, a stepper's and a hopper's each after a short random pause once the move before ends. A darting animal shows as soon as its stretch of road comes into view (at the road's top edge, if it sets off farther up), waiting at its edge until its cue. An in-lane mover's cue shows as soon as its stretch of road comes into view, so it can last longer than 0.6 seconds. At most ten movers are on screen at once (at most six darting and four in-lane movers slower than the road); squirrels and the friendly neighbour block no lane and count only among themselves, against the same limits. Every kind starts in any lane, more often in the lanes left clear longest, so the sides are never safe. A mover that doesn't fit where it was planned comes on at the nearest later spot that fits. A dart may set off from a spot something else already holds, crossing over or past it, and one that fits no row from where it was drawn to set off tries again from farther up the road, as far as its cue still shows, and then at another angle and then another speed from its kind's range, the nearest to its own first, so a dart is skipped only when none of those fits. A mover with no room on screen waits to come on; a card obstacle with no room stands still in its place instead, and one that doesn't fit its row goes to the nearest row that does, so no card is ever skipped. A fixed obstacle may stand, and an in-lane mover may pass, where only a dart will cross, as a dart may set off over a held spot. A dart that blocks a lane (any dart but a squirrel) never blocks the path while it meets the pack, and obstacles may stand on the row before its crossing like any other. Each neighbourhood's obstacle, tip and card counts are set to about what its road can hold, and the planner keeps each kind near its weight's share of what appears, wide ones included, so the road matches the numbers it is tuned by. A mover may pass over a tip or a treat, which stays where it is, and may end a move on a tip, but never on a treat or a lucky find, so those can always be grabbed without a hit. A mover's hit is its standing obstacle's hit.

- **Darts:** cross the whole road (animals, such as the cat, the other dog and the squirrel). The cat, the frisbee dog and the seagull always cross diagonally, coming down the road toward the pack, each at an angle it draws when it comes on, from a slight tilt to about 60 degrees, a steeper one starting farther up the road so it still leaves the pack time to react; in the third and fourth neighbourhoods of a walk, where the road goes by too fast for that, the steepest is about 50 and 40 degrees; the pigeons cross on a slight tilt up the road. About a third of cats, other dogs and seagulls turn back: somewhere from halfway to all the way across, drawn per dart, it turns with no cue of its own and crosses the whole road again the other way, keeping its tilt. Some darting animals stop short instead, more or less often by how far the animal would really run: about half of cats (they freeze), a third of other dogs, a fifth of frisbee dogs, and never a bird (pigeons, seagulls), a squirrel (so pulls stay simple) or the ball. One that stops does so after 2, 3 or 4 lanes, drawn per dart, with no cue, and stands in that lane for the rest of its time on the road. A dart that stops never turns back. Each dart draws where it starts its crossing, from partway up the road to close to the pack, never so close that the pack has no time to react, so most crossings have to be dodged
- **Hops:** quick hops at random to a lane on either side, a row up the road, or diagonally up, never down toward the pack, 1 or 2 spots at a time; some hop only sideways (the ducklings). The ducklings hop two or three times, and the bunny and the raccoon two to five. Shy hoppers (the bunny and the ducklings) sometimes shy away instead: about half of them, when the pack draws near, hop away from its side of the road (a lane farther from the pack, or up), so they clear the pack's lane rather than block it
- **In-lane:** keep their lane and move down the road at their own speed, faster than it scrolls (bikes, cars, the jogger, the charging goose) or slower (the stroller, the garbage and ice cream trucks, the streetcar)
- **Stalkers:** step toward the pack while still ahead of it: a lane to either side, a row down, or diagonally down, whichever brings it closest. The thief steps two or three times and the skunk two to five, the first a little after coming on screen; the coyote three or four times, once a little after it comes on and then right after (in the faster neighbourhoods it often reaches the pack first, so steps fewer times)
- **Steps:** three or four quick steps, each in any direction (a lane to either side, or a row up or down), with a short random pause and no cue between them (the mail carrier)

Each mover draws how many times it moves when it comes on, within its kind's range, so two of a kind can move different numbers of times. Every person and animal on the road moves, except the busker, who stands still. Vehicles (bikes, cars, scooters, the streetcar and trucks) only ever move up or down their own lane, never sideways or diagonally. Barriers, benches, cones, hedges, parked cars, puddles and trash cans never move.

### Feedback

- **Effect icons:** upgrades in effect, the walker's perk and the Pocket item show as small icons under the neighbourhood's name. Hold one to see what it does
- **Firing moment:** when an owner fires you, their face pops up large just above the dog's doghouse card, never over it, with their fired line, a "FIRED!" plate shows, and the dog trots off the road edge. It plays right after the hit or card choice that fired you, and the walk holds still for about 3 seconds while it plays: the road, the pack and every mover stand still, and the face, plate, fired line and trot-off all end with the hold
- **Forgiven heart:** whenever Second chance forgives a heart, from a bump or a card choice, a label floats over the dog (like "Dodge!"), the heart on its doghouse card flashes back with a sparkle, and the message strip says so
- **Heart changes:** a lost heart pops over the dog on the road as a big broken heart with "−1", then arcs down into its doghouse card. A gained heart pops in pink and flies up from the dog the same way. Every heart change plays this, whatever its cause
- **Hit moments:** every card obstacle's hit plays a big moment before its card: a burst over the pack, a brief flash at the screen edges, a large hit label and the pack shaking off
- **Message strip:** a strip over the clouds at the top of the backdrop band tells what just happened, newest line big with its icon, older lines fading. It has a line for: a badge earned, a debuff starting and ending, a dodge, an effect starting (the effect line of an upgrade, the walker's perk or the Pocket item), a firing, first-time hints (see Teaching), a forgiven heart, the Walk bonus, an owner's last heart, a lucky find, an owner's quip (after a card choice or a lucky find), a bump, a pull's strain and a treat. An owner's quip is styled like the other lines, led by the owner's face with their name under it in place of the icon, and its text has no name prefix
- **Owner faces:** an owner at full hearts looks happy, whatever their max. Below full, an owner looks upset at 1♥, neutral at 2♥ or when more than one heart below their max, and happy otherwise (one below for an owner with more than 3♥)
- **Return home:** the end screen shows the walker and pack coming back up the front path while the owners wave; fired dogs are absent
- **Road markers:** things worth grabbing (tips, treats and lucky finds) bob gently; obstacles carry no marker. With reduced motion nothing bobs
- **Treat grabbed:** the owner smiles and a "+1♥" label shows over the dog

### Neighbourhood celebration

After each of neighbourhoods 1 to 3, before the fork, a short celebration plays over the paused road. After neighbourhood 4 the end screen takes its place, preceded by a New walker celebration when finishing it unlocks a walker.

- **Neighbourhood banner:** each neighbourhood opens with a banner over the road naming the world, the neighbourhood's number and its name; the player never sees the word "zone"
- **Neighbourhood done:** the walker you're walking with cheers, under a big title and the neighbourhood's name, with the pay it banks and its tips. It moves on by itself after 2 seconds, or at a tap
- **New walker:** the first time you finish the neighbourhood that unlocks a walker, that walker runs in to join, with their greeting, agility and perk, and waits for a tap on its button (key 1). This replaces Neighbourhood done for that neighbourhood
- Confetti plays in both; with reduced motion it doesn't

### Upgrade cards

Walk-only boosts, one on each fork path, from a pool of 6. Each fork draws one per path at random from the remaining pool. Picking a path takes its upgrade, which leaves the pool for the rest of the walk; "next neighbourhood" is the one that path leads to. Effects without "now" or "next neighbourhood" last the rest of the walk.

- Belly rubs: +♥ to every owner now
- Big tipper: every tip is worth $1 more in the next neighbourhood
- Good leash: no dog pulls toward squirrels
- Raincoats: puddles don't muddy: no Muddy and no hit stop. A card's Muddy still applies
- Rush hour (trade-off): twice the tips and treats and more obstacles in the next neighbourhood
- Sweet talker: the first card in each neighbourhood has free money options (hearts and debuffs still cost; see Choice cards)

### Walkers

Four walkers. You start with Casey; each other walker unlocks the first time you finish their neighbourhood (see New walker). Every walker walks the same road at the same speed, and a walker's effects stack with the Pocket item and upgrade cards.

**Agility** sets how fast the pack changes lanes, as a multiple of the base lane-change speed. Walkers spread from 1.0 to 1.3, Running shoes add 0.4 and each large dog in the pack takes 0.1 off, never below 0.9. Players never see the word agility, and see it only as a percentage against the base: walker cards say "+30% lane change speed" (Ada) or "+10% lane change speed" (Casey), and a walker at the default speed (Mr. B) shows no lane-change line at all, Running shoes "+40% lane change speed" and a large dog "−10% lane change speed", in the same words, amount first. The slowest pack's lane move (the 0.9 floor) sets the row spacing.

Each walker has one **perk**:

- **Keen eye** (Mr. B): 50% more tips and treats appear
- **Long reach** (Trista): the front dog grabs tips and treats one lane to either side
- **Quick recovery** (Ada): debuffs last half as long
- **Second chance** (Casey): the first ♥ lost in each neighbourhood is forgiven (one heart; never Spotlight's cash)

### Home screen and progression

Everything bought at the Pet shop is permanent; upgrade cards are the walk-only boosts. Progress (bank, owned items, stats, achievements) is saved between sessions; storage is in [`src/README.md`](../src/README.md). A save from a newer version of the game is left untouched for the session, and the walker's bubble on the home screen says to reload.

- **Layout, top to bottom:** the top bar (the bank centred, with Logbook, Help, Sound and Settings on the right); the gate scene; then three framed sections in order: Walker, Dogs, Pocket (optional); then the Start walk button at the bottom. A section's frame lights up once it's complete; until then its band prompts, and the Dogs band shows the pack count with no label ("1/2"). The Dogs section holds all 9 dogs in one row per size, small, then medium, then large, each row cheapest first, as in the shop, except that the starting dog (Archie) sits in the middle of its row, at the centre of the grid. Nothing else sits between the sections
- **Gate scene:** the chosen walker and the picked pack on the front path, heading out under a "Toronto" street sign, beside a "Dog Walker" yard sign and the Pet shop. The Pocket item shows as a badge beside the walker. On a brand-new save, the starter's owner waits at the gate until the first walk, and Casey and Archie start picked, so the first walk is one tap on Start walk
- **Pet shop:** a building in the gate scene, its sign the same green as Start walk (tappable entry points share one colour); tap it to open the shop, which sells everything you buy: gear, dogs and dog slots. It has two tabs, Dogs on the left and open by default, then Gear. Dogs lists all 9 dogs, cheapest first, each row showing its size and hearts and marking owned ones as Gear does, and all 3 dog slots in order, the starting one included, owned ones marked as for dogs and gear (each one holds 1 dog; slots can be bought in any order and all cost the same, and the pack holds one dog per slot owned; one for sale looks like a dog or gear item for sale). Gear lists the 5 items, each with a short effect line, marking owned ones. The Gear, Dogs and Dog slots headings each show how many you own of all there are ("1 of 9 owned"). Tap an item to buy it, at any time you can pay, then confirm in a box that names it and shows the bank left after (Buy or Cancel). Rows for sale follow the For sale tile state. On the home screen the Pet shop building gets a gold outline while anything in it is affordable. Tapping a dog or dog slot for sale on the home screen opens the shop at that item
- **Dog slot sign:** a small sign hanging from the Pet shop's awning, across its front, reading "Walk more dogs!" over a dog slot's price. It shows while a dog slot is for sale, gets the Pet shop's gold outline while the bank covers that slot, and a tap opens the shop at the lowest-numbered slot for sale
- **Tile states** (walkers, dogs and Pocket gear alike, each state plainly distinct from the others at a glance, and the same in all three rows): every tile shows its real picture, never a silhouette. For sale (not owned, on the start screen and in the Pet shop alike): a grey tile or row; when the bank covers it, its picture shows in full colour with a green dollar bill and a green buy plate with the price, and when it doesn't, the picture is greyed with a closed padlock and a grey plate with the price in red; Locked walker: the picture greyed, with a closed padlock and its goal plate; Available (owned, not picked): full colour on a cream tile in a plain frame; Picked: full colour in a gold frame with a check; Pack full (owned, not picked, while every slot is filled): greyed in colour, and a tap says the pack is full
- **Details:** hold any dog or gear item, on the home screen or in the shop, for a detail card: a dog's breed, size and hearts, and owner (its walk stats are on the Stats page's Dogs tab); a gear item's name and effect
- **Start button:** the only button below the sections, reading "Start walk" in every state, and not ready until a walker and a dog are picked (the Pocket is optional). Each dog tile shows its pay
- **Walker picker:** choose from the walkers you've unlocked. Walkers, dogs and the Pocket item share one pick toggle: tap to pick, tap the picked one again to unpick it. The walker choice is saved and comes back picked, unless it was unpicked. Every walker tile, owned or locked, carries the walker's name on a grey plate; locked walkers use the Locked walker tile state; tapping one shakes it and the bubble gives the goal
- **Walker's bubble:** every home screen message shows in the walker's speech bubble (lengths in Voice). It reacts to state: the first visit (how to pick and hold), after each of the first 3 walks (how to pick and hold), after later walks, after a firing, when something new in the shop is affordable, with no walker picked, a picked walker's agility and perk, and a newly unlocked walker, which comes ahead of the firing line. It also shows buying a dog (with the owner's parting line), what more you need to save for something you can't afford, and notices such as unsaved progress
- **Owner parting line:** picking a dog shows a line from its owner in the walker's bubble, with the owner's face on the right and their name under it
- **Gear and Pocket** (5 items, bought once at the Pet shop, priced by how much each helps: Fanny pack, then Hall pass, then Running shoes, then Whistle, then Lucky collar): Fanny pack (card cash options cost half, rounded to the nearest dollar, a half rounding up); Hall pass (once per neighbourhood, skip one encounter card for free; see Choice cards); Lucky collar (every owner has +1 max ♥); Running shoes (lane changes +40%); Whistle (medium and large dogs also dodge 1 in 4 of the bumps that would land on them, as small dogs do). Put 1 owned item in your Pocket before each walk, or none. The Pocket section is a strip of all 5 items: tap an owned item to pocket it (gold frame), tap it again to empty the Pocket; an unowned item is For sale with its price, and tapping it opens the shop on it. The section's band names the pocketed item, or says one per walk when the Pocket is empty; hold an item for its effect. The item is kept, never used up, and switches freely between walks; its effects refresh each walk
- **Stats page** (the top bar's Logbook button opens it directly, with no card in between, and the Badges tab is one tap away; the screens say "walk", never "run"): walks started; walks finished, headed home or out of dogs; dogs walked, across all walks; the most earned from 1 walk, with that walk's neighbourhoods and dogs; lifetime earnings; total firings and the owner who fired you most; most neighbourhoods finished in a walk (heading home mid-neighbourhood doesn't count it). Every tab is one column on the same cream panel in the same text size, and scrolls when it runs long. The Dogs tab lists one block per dog: its face and name, then its walks, neighbourhoods finished and times fired, one per row
- **Achievements** (the badges are in [`src/data/achievements.ts`](../src/data/achievements.ts), in four groups: firsts, mastery, collection, silly): the Badges tab of the Stats page, one badge per row with its name, goal and progress, earned badges in colour on a gold band with a tick, and locked ones greyed; a locked badge that counts across walks also shows its progress ("7/75"). Badges come in about equal thirds for a typical player: easy ones within a few walks, medium ones within 10 to 30, and hard ones taking 40 or more, so the full set is still the last thing a player completes, after buying out the Pet shop. A badge that counts bumps counts every bump that lands, forgiven ones included, never a dodged one, the same as the bump-free badges. Each badge shows its name, goal and one line. Earning one plays a short celebration (owners cheer) wherever it happens; there is no other reward. A money goal counts the walk's total on the end screen, checked when it's banked. A dodge, by any dog, doesn't count as a bump for the bump-free badges. A streak badge counts walks in a row; a firing ends the streak, and heading home early neither ends it nor adds to it. A badge for a card option counts each time that option is picked, across walks
