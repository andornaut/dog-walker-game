# Game Design

The rulebook for the first complete game, set in one world, Toronto. What's left to build and tune is in [`README.md`](README.md), what comes later is in [`next.md`](next.md), and undecided ideas are in [`ideas.md`](ideas.md).

[`src/data/`](../src/data/) holds every number and all content (names, text, prices, shapes, weights), and the [data page](https://dogwalker.tristamittermayer.com/data/) shows them with the generated card text. This doc states the rules, with numbers where they define one. `$` and `♥` give the direction and rough size of a change (`$$$` and `♥♥` are bigger).

## Pitch

A cozy pixel-art lane runner: you are a dog walker walking a pack of dogs through the neighborhood to make money.

## Pillars

1. **Cozy, not frantic:** calm speed, forgiving failure, "one more walk" appeal; playable for long stretches without stress
2. **Bumps add up:** a plain bump costs a heart and a card obstacle brings a choice; a walk ends when you finish, head home, or the last owner fires you
3. **Charming chaos:** cute dogs, dramatic owners, silly neighborhood

## Core loop

- **Before a walk:** pick a walker, your dogs (one per owned dog slot) and up to one owned gear item for your Pocket.
- **During a walk:** walk 4 of the 6 neighborhoods, starting in High Park and ending on Yonge Street. The street scrolls toward you; switch lanes to dodge obstacles and grab pickups. A plain obstacle costs a heart; a card obstacle opens a choice card.
- **Between neighborhoods:** a neighborhood celebration that banks the pay, then a fork: each path leads to a neighborhood and carries one upgrade card, so one pick sets both.
- **After a walk:** bank your cash and spend your earnings at the Pet shop: dogs, dog slots and gear.

Reference points: Bowling Ballers (lane runner, but calmer), Hades (areas, run structure, loadout, meta progression), Vampire Survivors (choices along the way), Slay the Spire (choices as cards).

## Voice

- **Tone:** cozy, gentle and kid-friendly; the chaos is charming, the owners are dramatic, and no line mocks the player. American spelling (color, favorite, gray, neighbor), one name per thing (the walk's money is "cash"), spelled one way everywhere, so a name too long for its space is renamed everywhere rather than shortened in one place, ♥ right after its number ("+1♥", "{hearts}♥"), and no em dashes. Plain ASCII only, apart from ♥, · and the characters `src/ui/pixelFont.ts` maps (−, × and curly quotes): the pixel font has no other glyphs
- **Lengths:** message strip lines at most about 46 characters (26 always fit), and first-time hints at most 312 px at 2× (about 36 characters), so they stay full size on the one row left under a debuff bar; the walker's bubble up to 4 lines of about 30 characters, with walker's lines and owner parting lines at 2; card option names 2 or 3 words; hit labels one or two uppercase words with "!"
- **Walkers:** Ada calm and precise, Ben easygoing, Casey warm and encouraging, Trista sporty and quick
- **Owners** (each with 2 lines for each of happier, upset, fired and parting):
  - **Gadget** (Penny): nervous but kind, double-checks everything, apologizes even when firing you
  - **Jesse** (Koda): laid-back runner, fitness talk (form, personal bests, shake it off)
  - **Kevin** (Nugget): influencer, everything is content (feed, trending, followers)
  - **Kiwi** (Archie): unflappable grandmother, "dear" and "pet", offers cookies and tea
  - **Ms. Lefevre** (Pepe): dog-show judge, curt and formal, scores and deductions, a little French
  - **Mr. Pruitt** (Zippy): retired accountant, dry, ledgers, receipts and red ink
  - **Rosa** (Duchess): retired florist, theatrical, flower metaphors and exclamation marks
  - **Sam** (Biscuit): easygoing barista, coffee puns, calls you "friend"
  - **Tiffany** (Snowy): wedding planner, everything rides on today, picture perfect or disaster

## Rules

### Screen and controls

- Web, phone browser first. Touch and keyboard; mouse is not planned
- Portrait 360×560, ¾ top-down view, 5 lanes of 64px (the road spans x 20 to 340 at the pack). The road is drawn in pseudo-3D: lanes converge toward the backdrop band and things shrink with distance, with about 3.6 seconds of road visible ahead. The road keeps a hard edge where it meets the backdrop band. Lanes, distances and collisions are unchanged by it
- **Layout,** from the top: the top bar, one row 48 tall (big cash; the neighborhood's name with its place in the walk in gray beside it ("2 of 4") and the effect icons under it; then Home, Help, Sound, Settings and Pause, left to right; mute is also in Settings and on the M key); the debuff bars, when any is active; a backdrop band showing the current neighborhood, with the message strip over its clouds; the road across the full width, scrolling all the way to the top of its area; and a row of doghouse cards along the bottom, one per dog slot. Cards and the pause menu dim the walk view (the backdrop band and the road); the top bar and doghouse cards stay lit
- **Doghouse cards:** slim cards (120×58) in pack order (the front dog, then the left and right dogs): a name header, the dog's face, the owner's face (see Owner faces) and name with their hearts, and a LEAD tag on the front dog. A fired dog's card keeps the owner's face, looking fired. The owner pops in as a photo tab when something happens to them (a heart change, the firing moment); the firing moment carries its own quip, and every other quip shows in the message strip. A still hold on a card shows its dog's size, hearts and owner
- **Pausing:** the pause menu offers Resume, Help, Settings and Head home. The walk pauses whenever something takes the player's attention: the pause menu, Settings and Help, the Home question, a card, the neighborhood celebration, anything held for its explanation, and the tab being hidden or the window losing focus. Coming back to a hidden tab shows the pause menu, so the walk resumes only on Resume. While the walk is paused, everything in it holds: the road, the pack, the heart pops and other change labels, and the message strip's lines, which age only while walking. Hints and achievement toasts don't pause: they show in the message strip
- **Hold to explain:** during a walk, holding anything that explains itself (an effect icon, a debuff bar, a dog card) opens its explanation in a detail card, the same one the home screen's Details show, never in the message strip, and pauses the walk. The card stays up after the finger lifts; a tap anywhere closes it and resumes the walk, and does nothing else
- **Head home:** the top bar's Home button, the pause menu's Head home and the fork card's Head home ask "Head home?", showing only what heading home gives up, in red: the current neighborhood's pay and the Pack bonus, whichever apply, plus the number of neighborhoods left after this one when any are. Keep walking is the default (key 1); Head home is key 2. Head home ends the walk (see A walk); the current neighborhood pays nothing
- **Drag** (the main touch control): put a thumb down anywhere and drag. The first lane step comes after a short drag (about a third of a lane-width), and each further lane-width of travel adds one more, all relative to where the drag started, so the thumb never covers the walker. Dragging back turns the drag around. The pack moves lane by lane toward the target at the walker's lane-change speed
- **Tap:** moves one lane toward the tapped half of the road, as soon as the finger lands; on the doghouse row, when it lifts, so holding a card only explains it. A drag shorter than the first lane step counts as a tap, and a drag whose first step goes against the tap takes the tap back, so the pack ends where the drag alone puts it
- **Keyboard:** ←/→, A/D or H/L; one lane per press; holding a key doesn't repeat
- While moving between lanes, the pack can hit things in either lane. A reverse press turns the pack around at once; each other press queues one more lane
- Taps on the top bar never move the pack; taps and drags on the doghouse row steer like anywhere on the road

### The pack and hits

- **Formation:** the walker is at the bottom, the dogs close ahead in the same lane on visible leashes, every dog readable. The game sets the formation by size, never the player: the biggest dog leads in front (drawn behind the side dogs) and is the front dog, the next biggest walks on the left and the smallest on the right; ties go by roster order (alphabetical by name). Two dogs walk side by side out front, a little less far forward than a 3-dog lead, the bigger on the left as the front dog. One dog walks centered in the lead spot. No dog's hit box reaches into the next lane, so a pack fully in a lane never touches an obstacle in the lane beside it
- **Hit boxes:** one rectangle per dog and one for the walker, each a few pixels inside its sprite; leashes can't be hit. Road sprites are drawn at 48px, and each obstacle hits as drawn: 2 px inside its opaque outline, at its depth, within its own lanes. Touching any part of an obstacle counts as one hit. Once an obstacle is below the walker's feet it can no longer hit, however many rows it spans
- **Who a hit lands on:** a plain hit lands on the dog whose rectangle touched: if only the walker's did, on the front dog; if several dogs' did, on the one nearest the contact. Card obstacles hit the whole pack. Pickups (tips, treats and lucky finds) collect anywhere in the pack's whole outline, leashes included. Lane changes sweep the pack, so a fast move across several lanes can't skip a hazard or a pickup
- **Plain hits** cost 1♥ from the owner of the dog the hit lands on and open no card. No collision ever costs money: a collision costs hearts, makes the pack Muddy (a puddle) or opens a card, and money is lost only through a card option you pick
- **After a hit:** the obstacle is out of play at once but stays on the road as scenery (a cone tipped over, a bin rocking, a mover stopped) and scrolls off with it, touching nothing. Obstacles are ignored for a short grace window (about 0.7 seconds), during which the pack blinks; pickups still count
- **Hit stop:** a hit freezes the road and the pack briefly while it plays (about 1 second for a card obstacle, before its card; about 0.3 seconds for a plain obstacle or a puddle). Input is ignored during the stop, and it doesn't count as walk time. Lucky finds don't stop the walk

### Spawning

- Spawning always leaves a reachable path, accounting for every mover's moves, so every hit is avoidable
- Scroll speed and obstacle density rise gently each neighborhood
- Obstacles span lanes and rows (shapes in the data). None is wider than 3 lanes, every row leaves at least 2 lanes open, and obstacle rows leave room for the pack's full length. Wherever the path has to change lanes between two obstacles, the gap between them is at least the whole pack's height plus every lane change the path needs there (crossing a 3-lane obstacle's width takes up to three) plus about half a second to react. Two obstacles 2 or more lanes wide never sit in neighboring rows: at least one empty row separates them

### Pulls

Every dog pulls toward squirrels. A squirrel is no hit and opens no card: touching one does nothing, it darts across as an animal mover, and the pull is its only cost. A dog pulls the pack one lane only toward a squirrel you can see that is still ahead of the pack, and one dog strains at a time, the one nearest the squirrel side to side. If the straining dog's owner fires you, the strain ends and that squirrel draws no more. The dog strains for about 1 second, with a bubble over it, an arrow and a line to the squirrel, and a taut leash; then the pack lurches one lane toward the squirrel, unless you steer away during the strain, which cancels the pull; in an edge lane, pressing toward the edge counts as steering away. The message strip announces the strain as its cue; a cancel is quiet. A pull never moves the pack into an obstacle it can't react to: if the target lane has an obstacle too close, the dog strains but doesn't pull.

### Resources

- **Money ($):** the only currency, in whole dollars. A multiplied amount rounds to the nearest dollar
  - **Cash:** what you carry during the walk. It starts at a small purse (more with the Fanny pack) and grows with tips and lucky finds; card options are paid from it. It never goes below $0, and what's left is banked at the end
  - **Tips:** a tip is $1. Tips add to the pay, whatever the pack size, and they trade off against obstacles across a walk: the first neighborhood spawns the most tips and the fewest obstacles, and each later one has fewer tips and more obstacles (about 28 tips and 83 plain obstacles down to 19 and 86, where a late, fast road is about full). About half of plain obstacles are fixed ones (barriers, benches, bins, carts, cones, hedges, parked cars) and the rest move. No stretch of more than 3 rows of road comes into view without a visible obstacle in it (a mover counts only once it's on screen), so the road never looks quiet for long, while busy bursts and calmer stretches still come at random; a longer quiet stretch gets one of the neighborhood's own fixed obstacles moved into it, except where no fixed obstacle can fit (a mover's path, a dart's lead-in, or the open lanes and reaction gaps the rules keep)
  - **Pay:** the steady part. After each neighborhood, each walking dog earns $20, times the neighborhood's pay multiplier. Pay is banked at the end of each neighborhood: at its celebration, or on the end screen after neighborhood 4. A firing loses that dog's pay for the current neighborhood and the Pack bonus; its earlier pay stays banked
- **Owner happiness (♥):** one meter per dog, shown on its doghouse card; it never relies on color alone. The dog's size sets its max (see Dogs); a smaller pack adds to its lead: walking 1 dog, its owner gets +2♥; walking 2, the front dog's owner gets +1♥; walking 3, nobody does. No owner's max goes above 6♥, whatever adds to it. While the pack chosen earns it, the start screen's Dogs band says so. Every heart looks the same, whatever adds it: the extra hearts a bonus adds (the small-pack bonus, Lucky collar, Belly rubs) are drawn like the rest, and holding the card names each source. Every owner starts full, and treats restore hearts up to the max. At 0 the owner fires you with a quip and the dog leaves
- **Every change shows its cause:** each ♥ or $ change shows a short floating label at the dog or the bank (e.g. "−1♥ bump", "+$1 tip"); a card's enlarged view lists the modifiers behind its numbers

### A walk

- A walk is 4 neighborhoods of Toronto. Each neighborhood is the same distance and takes about 2 minutes; a full walk takes about 8 minutes
- After neighborhoods 1 to 3, the neighborhood celebration, then a fork. Neighborhood 4 has no fork
- **Forks:** the road meets a cross street; after neighborhoods 1 and 2 a fork card offers three paths (left, straight, right), each leading to a neighborhood you haven't walked this walk other than Yonge Street, sorted easiest on the left to hardest on the right. The fork after neighborhood 3 leads only to Yonge Street, so it shows one path. Each path card shows the neighborhood's name, difficulty and pay multiplier, and the one upgrade card it carries. Picking a path picks the next neighborhood and its upgrade at once. A Head home button under the paths ends the walk there (see Head home)
- **Neighborhoods** (6, each walk visits 4 with no repeats; the pay multiplier rises with difficulty, from ×0.7 to ×1.5):

| Neighborhood        | Difficulty | Encounter mix                                                                                                                  |
| ------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Cabbagetown         | Easiest    | Quiet Victorian streets: few obstacles, cats, raccoons, the mail carrier                                                       |
| High Park           | Easy       | Other dogs, black squirrels, bunnies, Canada geese, ducklings, joggers, strollers, more lucky finds; no cars. Always the first |
| Distillery District | Normal     | Brick lanes: puddles, cones, the streetcar, a hot dog cart, cars                                                               |
| Kensington Market   | Hard       | Crowds: thieves, joggers, strollers, the mail carrier; the streetcar, hot dog carts, benches, few cars, more tips              |
| The Beaches         | Hard       | The lakeshore boardwalk: puddles, geese, ducklings, cyclists, more lucky finds                                                 |
| Yonge Street        | Hardest    | Everything, the fastest, with heavy car and truck traffic and the streetcar. Always the last                                   |

- The walk ends after neighborhood 4, on Head home, or when no dogs are left. Your cash is banked
- **Full pack home:** when every dog you set out with gets home at the end of neighborhood 4, the walk pays a Pack bonus of $$ per dog into the bank, shown on the end screen. Heading home early or a firing loses it
- **End screen:** the walk's total with a breakdown (pay, tips, lucky finds, Pack bonus, card costs, starting cash) and the neighborhoods walked, with no bank; a new-best ribbon when it beats the best walk with the same number of dogs; one closing line from each owner (a happier line from owners still walking, the fired line from owners who fired you)

### Choice cards

- Used for encounters and forks. Up to three across, art-led: an illustration plus a one-line effect; hold to enlarge for details
- Every card hits the whole pack. No card opens without a collision, except the fork card. A hit that opens a card costs nothing until you choose
- Each option's outcome is fixed and shown on the card, with hearts per dog ("−1♥ Duchess, −1♥ Koda", not "−1♥ each"). A perk, gear item or upgrade that changes an option shows its charm centered just under that option's card, the enlarged card included, never on the card, so the card keeps its full text box. The card row (title, cards and charms) rises to the 2/3 line of the walk view. Choices only, no minigames
- A money option shows its price on its plate, grayed out when you can't afford it, so cash never goes below $0; every card keeps at least one option that costs no money, and its plate is blank. Money options are charged once per card, whatever the pack size; heart options cost each owner, so a bigger pack has more owners who can fire you. Slower options cost money (missed tips) instead of time
- An option says what it would do before you pick: a debuff option states its stake ("Quick rinse → Stinky: tips pay nothing for 30s"), an option that would fire an owner says so ("Fires Jesse"), and a heart Second chance would forgive reads as safe
- A fork's path card shows its pay multiplier and its upgrade's duration (Now, Next neighborhood, Rest of walk) where other cards show a price
- A card shows at most 3 options. Hall pass offers "Skip (Hall pass)" (a free option that skips the card) on every card until it's used in that neighborhood; the skip replaces the option that costs the most hearts when a card already has 3 (the most expensive of those if they tie). Sweet talker and Hall pass can both apply to the same card: its money options are free and the skip is offered, and the player chooses; Sweet talker is used up by that card whichever option is picked
- After a card choice, each owner whose hearts changed reacts with a quip in the message strip

### Teaching, sound and settings

- **First-time hints:** a one-line hint in the message strip the first time each thing appears (first puddle, first pull, first treat, the first moving obstacle's cue and so on); the help screen covers the rest. The firing hint jumps ahead of any waiting hint, so it shows before the first firing. Nothing teaches by overlaying the road: no tutorial overlays or swipe tips on the play area
- **Panels:** every page and overlay has one close control at the top right. Tapping the dimmed background outside a panel closes it (Help, the Pet shop, Settings, Stats, the badge celebration, the home screen's detail cards and the Neighborhood done celebration), and outside the pause menu resumes the walk; only taps count, not drags. Choice cards and the New walker celebration wait for a button. A tap on the page beside the game (left or right of it on a wide screen) counts as outside too; the nav bar and the dev panel don't
- **Settings** (from pause and the home screen): sound on or off, music volume, effects volume, reduced motion
- **Sound:** short effects (tip, treat, bump, bark, card open, fired), a sound for each card obstacle's hit (spray hiss, coin scatter, friendly woof), a splash on a puddle, a chitter when a dog strains toward a squirrel, a badge-earned jingle and a new-best fanfare, and one music loop for the walk. While the walk is paused by the player (the pause menu, Settings, Help or the Home question), the music drops to 30% volume and comes back on resume; it stays full under cards and the celebration, and goes silent while the tab is hidden

### Pickups

- **Tip:** +$1
- **Treat:** a grab item, not carried. It goes to the dog nearest where it touched (the front dog if only the walker touched it), whose owner gets +♥ up to the max; if that owner is already at max, the treat goes to the owner with the fewest hearts (ties to the dog nearer the front)

### Dogs

A roster of 9, three in each size, each a fixed, named character with its own art and one fixed owner. You start with 1 dog slot and Biscuit, and buy up to 2 more slots and the other 8 dogs at the Pet shop. Dog prices mix sizes: each price band ($150 to $300, $450 to $600, $800 to $1,000) has dogs of at least two sizes, so a cheap dog can be big and a pricey one small; the dog slots are the big purchases. Walking more dogs is the main progression: more pay and a longer-lasting walk, but more owners who can fire you.

Dogs differ in play by size only:

| Size   | ♥   | Effects                                                                                                                         |
| ------ | --- | ------------------------------------------------------------------------------------------------------------------------------- |
| Small  | 2   | Dodges 1 in 4 of the plain hits that would land on it, with a "Dodge!" label; the hit costs nothing and doesn't count as a bump |
| Medium | 3   | The baseline                                                                                                                    |
| Big    | 4   | Heavy: each big dog slows lane changes (−0.1 agility, never below Relaxed); its detail card says so                             |

Size shows at a glance: on the road, medium dogs are drawn 48 px, big dogs 54 px and small dogs about 38 px, in every animation, with small dogs drawn chunky so they still read; portraits and doghouse faces differ less, about 1.1× and 0.9×. Hit boxes don't change.

### Encounters and debuffs

Three card obstacles open a choice card: the other dog, the skunk and the thief. Each option costs one thing: money, hearts or a debuff. The one trade is the other dog's Let them sniff, money (missed tips) for hearts.

A puddle opens no card: hitting one costs no heart and makes the pack _Muddy_, with a plain obstacle's hit stop.

Each debuff has one source: Muddy from a puddle, Stinky from the skunk's Quick rinse, Zoomies from the other dog's Pull away. Debuffs are mild. Muddy and Zoomies last 20 seconds of walking and Stinky 30, or until the neighborhood ends, whichever comes first. Nothing on the road cures one; it runs out. Applying one the pack already has restarts its time; none stacks. Each is announced in the message strip when it starts and when it ends. While it lasts, a bar in the debuff's own color runs the full width of the game just below the top bar, over the clouds, with the debuff's icon and name, and drains over its time; two active debuffs show as two bars. Hold a bar to see what the debuff does.

- **Muddy:** every plain bump costs 2♥ instead of 1
- **Stinky:** tips still appear, but a grabbed tip pays $0 and shows a gray "+$0 Stinky" label
- **Zoomies:** about once a second, the pack drifts one lane in the direction it last moved; at the road's edge it turns and drifts the other way. Steering still works, so you counter the drift. A drift never moves the pack into an obstacle it can't react to, the same as a pull

### Lucky finds

Good things to bump into on purpose. None opens a card: each bobs on the road and pays out on contact, with a short popup and a quip from the owners who gained. The friendly neighbor walks about, one or two quick steps in any direction and with no cue, since a cue marks a hazard about to move, so the pack has to go and meet her; the lost wallet lies still.

- **Friendly neighbor:** a pat for each dog: +♥ to every owner, the hearts jackpot
- **Lost wallet:** +$$ found money, the money jackpot

### Moving hazards

Each obstacle has one look everywhere. Some kinds can move (each kind's movement is in the data), and every one that can always moves. A mover moves only while it is still ahead of the pack: once it reaches the pack's rows it makes no more moves, and nothing ever moves back up the road toward a pack that has passed it. Every movement has plenty of randomness, since the less a mover can be predicted, the harder it is to dodge: each mover's speed varies by up to about 25% either way (a dart's by up to 40%, and where it sets off is drawn apart from its speed, so a slow or a fast one can come from high up or close), each step or hop takes a little more or less time than the last, and the pause before each step, hop or dart varies widely too, so no two movers of a kind move alike. A mover warns once: its first move is telegraphed about 0.6 seconds ahead, and its later moves come with no cue of their own, a stepper's and a hopper's each after a short random pause once the move before ends. At most ten movers are on screen at once (at most six darting and four in-lane movers slower than the road). Every kind starts in any lane, the side lanes about as often as the middle ones, so the sides are never safe. A mover that doesn't fit where it was planned comes on at the nearest later spot that fits. A dart may set off from a spot something else already holds, crossing over or past it, and one that fits no row from where it was drawn to set off tries again from farther up the road, as far as its cue still shows. A mover with no room on screen waits to come on; a card obstacle with no room stands still in its place instead, and one that doesn't fit its row goes to the nearest row that does, so no card is ever skipped. A fixed obstacle may stand where only a dart will pass, as a dart may set off over a held spot. Each neighborhood's obstacle, tip and card counts are set to about what its road can hold, and the planner keeps each kind near its weight's share of what appears, wide ones included, so the road matches the numbers it is tuned by. A mover's hit is its standing obstacle's hit.

- **Darts:** cross the whole road (animals, such as the cat, the other dog and the squirrel). The cat, the frisbee dog and the seagull always cross diagonally, coming down the road toward the pack, each at an angle it draws when it comes on, from a slight tilt to about 60 degrees, a steeper one starting farther up the road so it still leaves the pack time to react; in the third and fourth neighborhoods of a walk, where the road goes by too fast for that, the steepest is about 50 and 40 degrees; the pigeons cross on a slight tilt up the road. About a third of cats, other dogs and seagulls turn back: somewhere from halfway to all the way across, drawn per dart, it turns with no cue of its own and crosses the whole road again the other way, keeping its tilt. Some darting animals stop short instead, more or less often by how far the animal would really run: about half of cats (they freeze), a third of other dogs, a fifth of frisbee dogs, and never a bird (pigeons, seagulls), a squirrel (so pulls stay simple) or the ball. One that stops does so after 2, 3 or 4 lanes, drawn per dart, with no cue, and stands in that lane for the rest of its time on the road. A dart that stops never turns back. Each dart draws where it starts its crossing, from partway up the road to close to the pack, never so close that the pack has no time to react, so most crossings have to be dodged
- **Hops:** quick hops at random to a lane on either side, a row up the road, or diagonally up, never down toward the pack, 1 or 2 spots at a time; some hop only sideways (the ducklings). The bunny, the ducklings and the raccoon each hop two or three times. Shy hoppers (the bunny and the ducklings) sometimes shy away instead: about half of them, when the pack draws near, hop away from its side of the road (a lane farther from the pack, or up), so they clear the pack's lane rather than block it
- **In-lane:** keep their lane and move down the road at their own speed, faster than it scrolls (bikes, cars, the jogger, the charging goose) or slower (the stroller, the garbage and ice cream trucks, the streetcar)
- **Stalkers:** step toward the pack while still ahead of it: a lane to either side, a row down, or diagonally down, whichever brings it closest. The thief and the skunk each step two or three times, the first a little after coming on screen; the coyote three or four times, once a little after it comes on and then right after (in the faster neighborhoods it often reaches the pack first, so steps fewer times)
- **Steps:** three or four quick steps, each in any direction (a lane to either side, or a row up or down), with a short random pause and no cue between them (the mail carrier)

Each mover draws how many times it moves when it comes on, within its kind's range, so two of a kind can move different numbers of times. Every person and animal on the road moves. Vehicles (bikes, cars, scooters, the streetcar and trucks) only ever move up or down their own lane, never sideways or diagonally. Barriers, benches, bins, cones, hedges, parked cars and puddles never move.

### Feedback

- **Effect icons:** upgrades in effect, the walker's perk and the Pocket item show as small icons under the neighborhood's name. Hold one to see what it does
- **Firing moment:** when an owner fires you, their face pops up large just above the dog's doghouse card, never over it, with their fired line, a "FIRED!" plate shows, and the dog trots off the road edge. It plays right after the hit or card choice that fired you, and the walk holds still for about 3 seconds while it plays: the road, the pack and every mover stand still, and the face, plate, fired line and trot-off all end with the hold
- **Forgiven heart:** whenever Second chance forgives a heart, from a bump or a card choice, a label floats over the dog (like "Dodge!"), the heart on its doghouse card flashes back with a sparkle, and the message strip says so
- **Heart changes:** a lost heart pops over the dog on the road as a big broken heart with "−1", then arcs down into its doghouse card. A gained heart pops in pink and flies up from the dog the same way. Every heart change plays this, whatever its cause
- **Hit moments:** every card obstacle's hit plays a big moment before its card: a burst over the pack, a brief flash at the screen edges, a large hit label and the pack shaking off
- **Message strip:** a strip over the clouds at the top of the backdrop band tells what just happened, newest line big with its icon, older lines fading. It has a line for: a badge earned, a debuff starting and ending, a dodge, an effect starting (the effect line of an upgrade, the walker's perk or the Pocket item), a firing, first-time hints (see Teaching), a forgiven heart, Full pack home, an owner's last heart (and, while Muddy, at 2♥, since a Muddy bump costs 2♥), a lucky find, an owner's quip (after a card choice or a lucky find), a plain hit, a pull's strain and a treat. An owner's quip is styled like the other lines, led by the owner's face with their name under it in place of the icon, and its text has no name prefix
- **Owner faces:** an owner at full hearts looks happy, whatever their max. Below full, an owner looks upset at 1♥, neutral at 2♥ or when more than one heart below their max, and happy otherwise (one below for an owner with more than 3♥)
- **Return home:** the end screen shows the walker and pack coming back up the front path while the owners wave; fired dogs are absent
- **Road markers:** things worth grabbing (tips, treats and lucky finds) bob gently; obstacles carry no marker. With reduced motion nothing bobs
- **Treat grabbed:** the owner smiles and a "+1♥" label shows over the dog

### Neighborhood celebration

After each of neighborhoods 1 to 3, before the fork, a short celebration plays over the paused road. After neighborhood 4 the end screen takes its place, preceded by a New walker celebration when finishing it unlocks a walker.

- **Neighborhood banner:** each neighborhood opens with a banner over the road naming the world, the neighborhood's number and its name; the player never sees the word "zone"
- **Neighborhood done:** the walker you're walking with cheers, under a big title and the neighborhood's name, with the pay it banks and its tips. It moves on by itself after 2 seconds, or at a tap
- **New walker:** the first time you finish the neighborhood that unlocks a walker, that walker runs in to join, with their greeting, agility and perk, and waits for a tap on its button (key 1). This replaces Neighborhood done for that neighborhood
- Confetti plays in both; with reduced motion it doesn't

### Upgrade cards

Walk-only boosts, one on each fork path, from a pool of 6. Each fork draws one per path at random from the remaining pool. Picking a path takes its upgrade, which leaves the pool for the rest of the walk; "next neighborhood" is the one that path leads to. Effects without "now" or "next neighborhood" last the rest of the walk.

- Belly rubs: +♥ to every owner now
- Big tipper: every tip is worth $1 more in the next neighborhood
- Good leash: no dog pulls toward squirrels
- Raincoats: puddles don't muddy: no Muddy and no hit stop
- Rush hour (trade-off): twice the tips and treats and more obstacles in the next neighborhood
- Sweet talker: the first card in each neighborhood has free money options (hearts and debuffs still cost; see Choice cards)

### Walkers

Four walkers. You start with Casey; each other walker unlocks the first time you finish their neighborhood (see New walker). Every walker walks the same road at the same speed, and a walker's effects stack with the Pocket item and upgrade cards.

**Agility** sets how fast the pack changes lanes, as a multiple of the base lane-change speed. Walkers spread from 0.9 to 1.2, Running shoes add 0.3 and each big dog in the pack takes 0.1 off, never below Relaxed. Players see it as a word: Relaxed (0.9), Steady (1.0), Quick (1.1), Nimble (1.2), Lightning (1.3 and up, reached only with Running shoes). The slowest walker's lane move sets the row spacing, so the low end stays near 1.

Each walker has one **perk**:

- **Calm voice** (Ada): debuffs last half as long
- **Long reach** (Trista): the front dog grabs tips and treats one lane to either side
- **Second chance** (Casey): the first ♥ lost in each neighborhood is forgiven (one heart, including one of a Muddy bump's two)
- **Treat finder** (Ben): twice as many treats appear

### Home screen and progression

Everything bought at the Pet shop is permanent; upgrade cards are the walk-only boosts. Progress (bank, owned items, stats, achievements) is saved between sessions; storage is in [`src/README.md`](../src/README.md). A save from a newer version of the game is left untouched for the session, and the walker's bubble on the home screen says to reload.

- **Layout, top to bottom:** the top bar (the bank centered, with Logbook, Help, Sound and Settings on the right); the gate scene; then three framed sections in order: Walker, Dogs, Pocket (optional); then the Start walk button at the bottom. A section's frame lights up once it's complete; until then its band prompts, and the Dogs band shows the pack count with no label ("1/2"). Nothing else sits between the sections
- **Gate scene:** the chosen walker and the picked pack on the front path, heading out to High Park under its sign, beside a "Dog Walker" yard sign and the Pet shop. The Pocket item shows as a badge beside the walker. On a brand-new save, the starter's owner waits at the gate until the first walk, and Casey and Biscuit start picked, so the first walk is one tap on Start walk
- **Pet shop:** a building in the gate scene, its sign the same green as Start walk (tappable entry points share one color); tap it to open the shop, which sells everything you buy: gear, dogs and dog slots. It has two tabs, Dogs on the left and open by default, then Gear. Dogs lists the dogs you don't own yet, each row showing its size and hearts, and the dog slots (what the next one gives, and a later slot asks for the earlier one first). Gear lists the 5 items, each with a short effect line, marking owned ones. The Gear, Dogs and Dog slots headings each show how many you own of all there are ("1 of 9 owned"). Tap an item to buy it, at any time you can pay, then confirm in a box that names it and shows the bank left after (Buy or Cancel). Rows for sale follow the For sale tile state. On the home screen the Pet shop building gets a gold outline while anything in it is affordable. Tapping a dog or dog slot for sale on the home screen opens the shop at that item
- **Dog slot sign:** a small sign hanging from the Pet shop's awning, across its front, reading "Walk more dogs!" over the next dog slot's price. It shows while a dog slot is for sale, gets the Pet shop's gold outline while the bank covers that slot, and a tap opens the shop at the first slot you can buy
- **Tile states** (walkers, dogs and Pocket gear alike, each state plainly distinct from the others at a glance, and the same in all three rows): every tile shows its real picture, never a silhouette. For sale (not owned, on the start screen and in the Pet shop alike): a gray tile or row with the picture grayed, whether or not you can afford it; its plate is the only affordability cue: an open padlock and a green buy plate with the price when the bank covers it, a closed padlock and a gray plate with the price in red when it doesn't; Locked walker: the picture grayed, with its goal plate; Available (owned, not picked): full color on a cream tile in a plain frame; Picked: full color in a gold frame with a check; Pack full (owned, not picked, while every slot is filled): grayed in color, and a tap says the pack is full
- **Details:** hold any dog or gear item, on the home screen or in the shop, for a detail card: a dog's breed, size and hearts, owner, pay and per-dog stats; a gear item's name and effect
- **Start button:** the only button below the sections, reading "Start walk" in every state, and not ready until a walker and a dog are picked (the Pocket is optional). Each dog tile shows its pay
- **Walker picker:** choose from the walkers you've unlocked. Walkers, dogs and the Pocket item share one pick toggle: tap to pick, tap the picked one again to unpick it. The walker choice is saved and comes back picked, unless it was unpicked. Every walker tile, owned or locked, carries the walker's name on a gray plate; locked walkers use the Locked walker tile state; tapping one shakes it and the bubble gives the goal
- **Walker's bubble:** every home screen message shows in the walker's speech bubble (lengths in Voice). It reacts to state: the first visit (how to pick and hold), after each of the first 3 walks (how to pick and hold), after later walks, after a firing, when something new in the shop is affordable, with no walker picked, a picked walker's agility and perk, and a newly unlocked walker, which comes ahead of the firing line. It also shows buying a dog (with the owner's parting line), what more you need to save for something you can't afford, and notices such as unsaved progress
- **Owner parting line:** picking a dog shows a line from its owner in the walker's bubble, with the owner's face on the right and their name under it
- **Gear and Pocket** (5 items, bought once at the Pet shop): Dog whistle (medium and big dogs also dodge 1 in 8 of the plain hits that would land on them, as small dogs do); Fanny pack (start every walk with +$$ cash); Hall pass (once per neighborhood, skip one encounter card for free; see Choice cards); Lucky collar (every owner has +1 max ♥); Running shoes (+0.3 agility, three agility words up). Put 1 owned item in your Pocket before each walk, or none. The Pocket section is a strip of all 5 items: tap an owned item to pocket it (gold frame), tap it again to empty the Pocket; an unowned item is For sale with its price, and tapping it opens the shop on it. The section's band names the pocketed item, or says one per walk when the Pocket is empty; hold an item for its effect. The item is kept, never used up, and switches freely between walks; its effects refresh each walk
- **Stats page** (the top bar's Logbook button opens it directly, with no card in between, and the Badges tab is one tap away; the screens say "walk", never "run"): walks played; walks finished, headed home or out of dogs; dogs walked, across all walks; the best walk's earnings, neighborhoods and dogs; lifetime earnings; total firings and the owner who fired you most; most neighborhoods finished in a walk (heading home mid-neighborhood doesn't count it). Every tab is one column on the same cream panel in the same text size, and scrolls when it runs long. The Dogs tab lists one block per dog: its face and name, then its walks, neighborhoods finished and times fired, one per row
- **Achievements** (the badges are in [`src/data/achievements.ts`](../src/data/achievements.ts), in four groups: firsts, mastery, collection, silly): the Badges tab of the Stats page, one badge per row with its name, goal and progress, earned badges in color on a gold band with a tick, and locked ones grayed; a locked badge that counts across walks also shows its progress ("7/75"). Badges are the last thing a player completes: the ones that count across walks take longer than buying everything in the Pet shop, and a few long chases (lifetime earnings, tips, walks played) outlast even that. A badge that counts bumps counts every plain hit that lands, forgiven ones included, never a dodged one, the same as the bump-free badges. Each badge shows its name, goal and one line. Earning one plays a short celebration (owners cheer) wherever it happens; there is no other reward. A money goal counts the walk's total on the end screen (net of starting cash), checked when it's banked. A small dog's dodge doesn't count as a plain bump for the bump-free badges
