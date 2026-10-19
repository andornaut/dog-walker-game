# Game Design Doc (canonical)

Only things we've **agreed on** live here. Brainstorming lives in `ideas.md`. Starting numbers and content lists for the first build live in `v1-plan.md`.

## Pitch

_Draft from the 2026-10-18 session, not yet polished:_ a cozy pixel-art lane runner where you walk a pack of dogs through the neighbourhood, and every bump in the road turns into a choice.

Theme: you're a dog walker trying to make money.

## Pillars

1. **Cozy, not frantic:** calm speed, forgiving failure, "one more walk" appeal; playable for long stretches without stress
2. **Every bump is a story:** collisions lead to choices, not game over
3. **Charming chaos:** cute dogs, dramatic owners, silly neighbourhood

## Core loop

- **Before a run:** pick your dogs and your loadout (gear from permanent unlocks).
- **During a run:** the street scrolls toward you; switch lanes to dodge obstacles and grab pickups. Hitting an obstacle opens a choice card. Each zone has one forced stop that always opens a choice.
- **Between zones:** pick 1 of 3 upgrade cards (some are trade-offs).
- **After a run:** bank your earnings and spend them on permanent unlocks.

Reference points: Bowling Ballers (lane runner, but calmer), Hades (zones, run structure, loadout, meta progression), Vampire Survivors (choices along the way), Slay the Spire (choices as cards).

## Player & world

- You are the dog walker (one fixed character in v1).
- A run is a walk through **4 zones**, each a fixed distance that takes about 3 minutes. v1: one neighbourhood, fixed route.

## Dogs

- Walk **1–3 dogs** per run; they move as one unit in a single lane.
- Each dog has its own traits, fee and look. Encounters affect dogs according to their traits.
- Each dog has an **owner**. One meter per dog: **owner happiness**, shown with the dog's and owner's faces.
- Events raise or lower owner happiness.
- Each dog is a fixed, named character with one fixed owner. The owner's personality sets the tone of their quips, and they react with a quip after every card choice.
- At zero, the owner fires you with a funny quip (e.g. "You're fired!") and the dog leaves the run.
- Every dog is a fixed, named character with its own art and one value of each attribute: size (fee, pull strength), trait (what upsets its owner and what it pulls toward), energy (how often it pulls) and owner temperament (starting happiness, pay, quip tone). Players can have favourites.
- v1: a roster of 9 dogs; 3 are unlocked from the start and the other 6 are bought in the shop.

## Mechanics

- **Movement:** 5 lanes; the walker and pack move left/right at the bottom of the screen. Dogs sometimes pull the pack one lane, toward what their trait cares about or at random; more dogs, more pulls.
- **Pickups:** things you want to hit: treats (carried, then given to the dog of your choice to raise its owner's happiness) and tips (money).
- **Encounters:** collisions pause the run and offer a choice, usually trading money against owner happiness or a debuff. Some problems can be fixed with money, e.g. skunk: pay a lot for grooming, or less and take the lingering **Stinky** debuff. Choices only in v1. Each option's outcome is fixed and shown on the card. An option you can't afford is disabled; every encounter has a free option.
- **Forced stops:** one per zone, drawn from a pool with no repeats in a run; always triggers a choice.
- **Area effects:** roll once per dog, so a bigger pack is more likely to have someone affected.
- **Scenery gags:** harmless neighbourhood moments that open no card.
- **Money:** the only currency. Earned in-run (tips, and each dog's fee per zone survived), spent on encounter choices, banked between runs.
- **Run end:** finishing zone 4, no dogs left, or heading home (any time; the current zone pays nothing). Failure is gentle: you keep what you've earned.

## Progression & goals

- Banked money buys permanent unlocks: new dogs and gameplay-altering loadout gear now (cosmetics later); upgrade cards are the run-only boosts; later, more dog slots, better leashes and more.

## Controls

Designed touch-first. v1 supports keyboard (web) and touch (mobile: tap the left/right half of the screen, or swipe; holding keeps moving lane to lane). Mouse is not planned.

## Screen

A top status bar (money, zone progress), a fixed-width dog column on the left with one slot per dog, and the road filling the rest. Encounter cards cover the paused, dimmed road; the status bar and dog column stay visible. Layout details live in [`art/style-guide.md`](../art/style-guide.md).

## Scope: v1 (web prototype)

See `v1-plan.md`. One neighbourhood, fixed 4-zone route, 9-dog roster (3 to start, 6 bought), choices only, minimal shop.

## Out of scope for v1

See "Explicitly out of v1" in `v1-plan.md`.
