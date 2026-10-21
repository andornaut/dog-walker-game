# Gameplay

The design of the game, how it's tuned and tested, and what's left for the first build. A pixel-art game (simple, retro, cute) about being a dog walker. Web first, then iOS and Android.

## Docs

| Doc                      | What it holds                               | Changes when                     |
| ------------------------ | ------------------------------------------- | -------------------------------- |
| [`design.md`](design.md) | The rulebook: rules and content             | A design decision lands          |
| [`next.md`](next.md)     | Everything set aside for later, unscheduled | Something is set aside for later |
| [`ideas.md`](ideas.md)   | Undecided and cut ideas                     | Every design session             |

Docs state the current rule only; git keeps the history. An idea stays in `ideas.md` until agreed, then moves to the doc it belongs in.

## Scope

Gameplay owns the rulebook and the values and content in the data value files (every `src/data/*.ts` except `types.ts`, `index.ts`, `screen.ts` and the tests). A new field or effect kind goes through tech.

## Method

- **Design sessions:** start with "design session" and a topic. Claude keeps floated ideas apart from agreed ones, asks the question that unblocks a decision, and on "wrap up" proposes doc changes, writing them once confirmed.
- **Simulate before tuning:** every economy or difficulty change is compared before and after at the same seed, with `npm run simulate -- --runs 1000 --seed 1 --skill novice,typical,expert`.
- **Playtest each build:** after each deploy, play `/play/` headless on a phone viewport, with `?seed=N&pack=...&dev=1` for a reproducible run, and report what broke to tech or art.
- **Card text:** generated from the effects, so a value-only edit regenerates the card-text snapshot.

## Targets

Some walks should fail: the road stays calm, so losing comes from bumps and choices, not from speed. A failed walk is one that ends before neighborhood 4 because every owner fired you. The simulator measures each target per skill preset and card policy.

| Player  | Walks finished | Walks with a firing |
| ------- | -------------- | ------------------- |
| Novice  | 50 to 70%      | 50 to 80%           |
| Typical | 75 to 90%      | 20 to 40%           |
| Expert  | 90 to 98%      | 5 to 15%            |

- **Cards:** about 8 cards a walk at typical skill, one a minute; trim minor cards if walks run over
- **Length:** a neighborhood takes about 2 minutes and a walk about 8
- **Mild bonuses:** a gear item or upgrade card shifts earnings or the finish rate by about 10% at most. The Lucky collar is the exception: the premium gear item, priced highest, it may shift the finish rate more
- **Play-style window:** for a given player, every pack of a given size, gear item and card policy lands within 10 points of the median finish rate and 15% of the median earnings. Picking the "wrong" dogs or gear makes a walk a little harder or easier, never a lot
- **Progression:** each extra dog raises a walk's earnings; about 50 walks (about $8,000) buy every dog, slot and gear item; every gear item pays for itself over a reasonable number of walks
- **Trade-offs:** a strong downside always comes with a matching upside (Rush hour's extra tips come with more obstacles), and the net stays in the window
- **Walker spread:** every walker lands within the play-style window: agility and perk make a walker feel different, never a lot easier or harder. The skill targets are for the median walker

## Remaining for the first build

**Done when:** a walk lasts about 8 minutes, we want to play "one more", and it works by touch on a phone browser.

Rules in the rulebook that the game doesn't have yet:

1. **Card obstacles:** three only (other dog, skunk, thief), each hitting the whole pack, with each option costing one thing and two options on the thief; a puddle opens no card, costs no heart and makes the pack Muddy; a squirrel opens no card and does nothing on contact; the mail carrier is a person and the ice cream truck a slow vehicle, both plain (Encounters, Moving hazards)
2. **Debuffs:** Muddy, Stinky and Zoomies, each shown as a full-width colored bar under the top bar; Stinky tips pay $0 with a gray "+$0 Stinky" label; Zoomies drifts the pack one lane about once a second in the direction it last moved, never into an obstacle it can't react to (Encounters)
3. **Difficulty names:** one scale, Easiest, Easy, Normal, Hard, Hardest (A walk)
4. **Doghouse cards and top bar:** layout A: slim cards in pack order with a LEAD tag and the owner's photo tab on events; a one-row top bar with cash, progress, effect icons, and Home, Sound, Settings and Pause (Screen and controls)
5. **Dogs by size only:** size sets hearts (3, 4, 5, starting full), small dogs dodge 1 in 4 plain hits, each big dog slows lane changes by 0.1 agility (never below Relaxed), and a plain hit lands on the dog that touched the obstacle, the front dog on a head-on hit; each dog has its own price (Dogs, Screen and controls)
6. **Effect icons:** upgrades, the perk and the Pocket item as icons under the neighborhood's progress pips, with no taps; holding them shows every active effect's line, which pauses the walk (Feedback)
7. **Forks:** each path carries one upgrade card, and picking the path picks it; a Head home button under the paths; The Long Way Home always neighborhood 4, the only path from the third fork (A walk, Upgrade cards)
8. **Full pack home:** a bonus per dog when every dog you set out with gets home (A walk)
9. **Gear:** Fanny pack, Hall pass (one skip per neighborhood), Lucky collar and Running shoes (+0.1 agility) (Home screen and progression)
10. **Lucky finds:** only the generous neighbor and the lost wallet, with no cards: each bobs and pays on contact (Lucky finds)
11. **Moving hazards:** bikes, cars and trucks in their lanes, a parked car pulling out, people stepping, hoppers hopping and animals darting, at most four movers on screen (two darting, two slower than the road) (Moving hazards)
12. **Pay:** a flat $10 per dog per neighborhood times the pay multiplier, banked at each neighborhood's end, with a firing losing only the current neighborhood's pay for that dog; card money options charged once per card; the same tips for any pack size; a $5 starting purse (Resources, Choice cards)
13. **Plain hits:** a plain obstacle costs only 1♥ from the touched dog's owner, with a hit stop of about 0.3 seconds (Plain obstacles, Feedback)
14. **Pulls:** every dog pulls toward squirrels, and only squirrels; a strain of about 1 second, then a one-lane lurch, with no input lock; steering away during the strain cancels the pull; the Squirrel! badge counts pulls that land (Screen and controls, Home screen and progression)
15. **Road markers:** grab-worthy things bob; no marker on obstacles (Feedback)
16. **Small dogs dodge:** 1 in 4 plain hits that would land on a small dog miss, with a "Dodge!" label, and a dodge doesn't count as a bump for Clean Paws or Not a Scratch (Screen and controls)
17. **Treats:** a grab item, +♥ to the dog that touches it, not carried (Pickups)
18. **Upgrade pool:** six cards: Belly rubs, Big tipper, Good leash, Raincoats, Rush hour and Sweet talker; Big tipper lasts one neighborhood; Good leash stops pulls; Raincoats means puddles don't muddy; Sweet talker makes the first card each neighborhood's money options free and that card uses it up, whichever option is picked (Upgrade cards)
19. **Walkers:** agility and one perk each; Ben, Ada and Trista unlocked by finishing Fairview Park, Riverside Path and The Long Way Home (Walkers)

Tuning against the targets, after one re-baseline on the shared step loop with every item above in:

- Area effects: three-dog packs against skunks; other dog, skunk and thief weights to hold about 8 cards a walk
- Big Payday's threshold: rarely earned
- Economy: pay, card costs, lucky finds and shop prices are first guesses against the targets above
- Firing: walks with a firing run too rare (typical 12%, expert 2%) and card policies differ too much; measure with the mixed policy
- Gear: each item within the window
- Sizes: hearts against the small-dog dodge chance
- Walkers: agility and each perk within the window

Decided at the phone playtest, after the tuning pass:

- The game's name
- Whether the far end of the road fades into the backdrop band
