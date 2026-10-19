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
- **Between zones:** pick 1 of 3 upgrade cards (some lose-lose).
- **After a run:** bank your earnings and spend them on permanent unlocks.

Reference points: Bowling Ballers (lane runner, but calmer), Hades (zones, run structure, loadout, meta progression), Vampire Survivors (choices along the way), Slay the Spire (choices as cards).

## Player & world

- You are the dog walker.
- A run is a walk through **4 zones**. v1: one neighbourhood, fixed route.

## Dogs

- Walk **1–3 dogs** per run; they move as one unit in a single lane.
- Each dog has its own traits, fee and look. Encounters affect dogs according to their traits.
- Each dog has an **owner**. One meter per dog: **owner happiness**, shown with the dog's and owner's faces.
- Events raise or lower owner happiness.
- At zero, the owner fires you with a funny quip (e.g. "You're fired!") and the dog leaves the run.
- v1: a roster of 3 dogs (small, medium, big), picked freely.

## Mechanics

- **Movement:** 5 lanes; the walker and pack move left/right at the bottom of the screen.
- **Pickups:** things you want to hit: treats (raise owner happiness) and tips (money).
- **Encounters:** collisions pause the run and offer a choice, usually trading money against owner happiness or a debuff. Some problems can be fixed with money, e.g. skunk: pay a lot for grooming, or less and take the lingering **Stinky** debuff. Choices only in v1.
- **Forced stops:** one per zone; always triggers a choice.
- **Money:** the only currency. Earned in-run (tips, and each dog's fee per zone survived), spent on encounter choices, banked between runs.
- **Run end:** finishing zone 4, or no dogs left. Failure is gentle: you keep what you've earned.

## Progression & goals

- Banked money buys permanent unlocks: loadout gear now; later, more dog slots, better leashes and more.

## Controls

Designed touch-first. v1 supports keyboard (web) and touch (mobile). Mouse is not planned.

## Scope: v1 (web prototype)

See `v1-plan.md`. One neighbourhood, fixed 4-zone route, 3-dog roster picked freely, choices only, minimal shop.

## Out of scope for v1

See "Explicitly out of v1" in `v1-plan.md`.
