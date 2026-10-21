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

Some walks should fail: the road stays calm, so losing comes from bumps and choices, not from speed. A failed walk is one that ends before zone 4 because every owner fired you. The simulator measures each target per skill preset and card policy.

| Player  | Walks finished | Walks with a firing |
| ------- | -------------- | ------------------- |
| Novice  | 50 to 70%      | 50 to 80%           |
| Typical | 75 to 90%      | 20 to 40%           |
| Expert  | 90 to 98%      | 5 to 15%            |

- **Play-style window:** for a given player, every pack, gear item and card policy lands within 10 points of the median finish rate and 15% of the median earnings. Picking the "wrong" dogs or gear makes a walk a little harder or easier, never a lot
- **Walker spread:** walkers are the difficulty slider, so they sit outside the play-style window: the easiest finishes about 10 points more often than the hardest, and the hardest earns about 20% more. The skill targets are for the median walker; the window applies within each walker
- **Mild bonuses:** a gear item or upgrade card shifts earnings or the finish rate by about 10% at most
- **Trade-offs:** a strong downside always comes with a matching upside (a riskier dog pays a higher fee), and the net stays in the window
- **Cards:** about 8 cards a walk, one a minute; trim minor cards (such as a puddle that catches one dog) if walks run over
- **Length:** a zone takes about 2 minutes and a walk about 8
- **Progression:** each extra dog raises a walk's earnings; about 50 walks (about $44,000) buy every dog, slot and gear item; every gear item pays for itself over a reasonable number of walks

## Remaining for the first build

**Done when:** a walk lasts about 8 minutes, we want to play "one more", and it works by touch on a phone browser.

Rules in the rulebook that the game doesn't have yet:

1. **Big Payday:** counted net of starting money (Achievements)
2. **Debuffs:** Spooked, Tangled and Tuckered out on the cheap options, and a treat that clears them (Debuffs, Forced stops)
3. **Obstacle skins:** the per-zone road sprites and card illustrations (Obstacle skins)
4. **Panels:** a tap beside the game counts as outside the panel (Teaching, sound and settings)
5. **Pocket section:** a third framed section whose band names the pocketed item, with no effect line (Home screen and progression)
6. **Scale:** 5 lanes of 64px with 40px sprites, and pack bands that grow with lane width
7. **Walkers:** locked walkers' name plates and the "New walker!" line (Home screen and progression)
8. **Zone celebration:** Zone done and New walker, between a zone's fees and its upgrade card (Zone celebration)
9. **Zone length:** zones run about 2 minutes on a phone, timed with the dev overlay's zone clock

Tuning against the targets, after one re-baseline on the shared step loop with every item above in:

- Area effects: three-dog packs against skunks; puddle weights to hold about 8 cards a walk
- Big Payday's threshold, now rarely earned
- Firing: walks with a firing run too rare (typical 12%, expert 2%) and card policies differ too much; measure with the mixed policy
- Gear: each item within the window; running shoes and the whistle on a pack with no big dog
- Quirks: Nugget with Pepe below the two-dog window
- Walkers: the walker spread at typical and novice skill

Decided at the phone playtest, after the tuning pass:

- Fewer minor cards (in [`ideas.md`](ideas.md))
- The game's name
- Whether the far end of the road fades into the backdrop band
