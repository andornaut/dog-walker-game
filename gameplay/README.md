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
- **Playtest what needs eyes:** play the deployed `/play/` headless on a phone viewport, with `?seed=N&pack=...&dev=1` for a reproducible run, and report what broke to tech or art.
- **Card text:** generated from the effects, so a value-only edit changes it with no text edit. Check the result in `shared/export/game-data.json` or on the data page.

## Targets

Some walks should fail: the road stays calm, so losing comes from bumps and choices, not from speed. A failed walk is one that ends before neighborhood 4 because every owner fired you. The simulator measures each target per skill preset and card policy.

| Player  | Walks finished | Walks with a firing |
| ------- | -------------- | ------------------- |
| Novice  | 50 to 70%      | 50 to 80%           |
| Typical | 90 to 100%     | 5 to 15%            |
| Expert  | 95 to 100%     | 0 to 10%            |

- **Cards:** about 10 cards a walk at novice skill, more than one a minute; good dodgers meet fewer
- **Mild bonuses:** a gear item or upgrade card shifts earnings or the finish rate by about 10% at most. The Lucky collar, the premium gear item and the highest priced, is the exception: it may shift the finish rate more
- **Play-style window:** for a given player, every pack of a given size, gear item and card policy lands within 10 points of the median finish rate and 15% of the median earnings. Picking the "wrong" dogs or gear makes a walk a little harder or easier, never a lot
- **Progression:** each extra dog raises a walk's earnings; about 50 walks buy every dog, slot and gear item; every gear item pays for itself over a reasonable number of walks
- **Trade-offs:** a strong downside always comes with a matching upside (Rush hour's extra tips come with more obstacles), and the net stays in the window
- **Walker spread:** every walker lands within the play-style window: agility and perk make a walker feel different, never a lot easier or harder. The skill targets are for the median walker

## Remaining for the first build

**Done when:** a walk lasts about 8 minutes, we want to play "one more", and it works by touch on a phone browser.

The tuning pass is done: a buyout of the Pet shop takes about 50 walks, Good Day and Big Payday sit within reach of a good and a great walk, and the cozy curve stays. What's left is a phone playtest of the tuned build, which calls version 1. The game is called Dog Walker.
