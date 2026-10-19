# Session Log

One short entry per session, newest at the bottom.

Format:

```text
## YYYY-MM-DD · Design|Art|Tech|Process · topic

- Covered:
- Decided: (also logged in decisions.md)
- Open threads / next time:
```

---

## 2026-10-18 · Process · Project setup

- Covered: project structure, how design vs tech sessions work
- Decided: dog walker theme; pixel art (simple, retro, cute); web first then iOS/Android; mostly vibe coded
- Open threads / next time: first design session (pitch, pillars, core loop); first tech session (engine choice)

## 2026-10-18 · Design · v1 core design

- Covered: Bowling Ballers as the reference runner; roguelite structure (Hades, Vampire Survivors); money; dogs and owners; zones, biomes, time of day, weather; card-style choices (Slay the Spire); mood and pacing; v1 scope
- Decided: 5-lane runner, calmer than Bowling Ballers; collisions open choice cards (choices only in v1); runs of 4 zones; money as the only currency, banked between runs; 1–3 dogs in one lane with a per-dog owner-happiness meter; encounters hit by trait; pay per zone survived; 1-of-3 upgrade cards between zones; one forced stop per zone; gentle failure; pillars; refined pixel art, ¾ top-down, portrait; three-across art-led cards; v1 = one neighbourhood, fixed route, 3-dog roster picked freely. Full v1 rules in v1-plan.md
- Open threads / next time: tech session on engine and hosting; content round (dog traits, encounter list, forced-stop pool, card pool, starting numbers); polish the pitch

## 2026-10-18 · Design · Open questions from the v1 plan

- Covered: zone length, slower options, touch input, encounter edge cases, traits, card outcomes, trade-off cards, starting numbers, loadout, name collisions, poop bags, authorship
- Decided: ~3-minute distance-based zones (~12-minute run); slower options cost money; tap and swipe; no-Chaser squirrels are scenery; unaffordable options disabled; per-dog encounter costs; max 8 ♥; mud dropped; Food-driven drifts toward treats; fixed, shown outcomes; trade-off cards; placeholder numbers; pick up to 1 item; Belly rubs and Lucky collar renames; poop bags as a once-per-run Skip; authorship no longer recorded and the both-agree rule removed
- Open threads / next time: forced-stop pool and ~8 upgrade cards before Milestone 4; check in playtests whether walking 3 dogs is always best

## 2026-10-18 · Design · Pillars

- Covered: the three pillars: tension and pack size (Cozy, not frantic); forced stops, upgrades, quips, end screen (Every bump is a story); dogs, owners, neighbourhood, walker (Charming chaos)
- Decided: gentle speed ramp; dogs pull the pack (trait targets and wander, more with more dogs); per-dog area-effect rolls; head home any time, forfeiting the current zone's fees; 6 forced stops drawn without repeats; 9 upgrade cards; a quip after every card choice; earnings-only end screen; fixed named dogs and owners; scenery gags; one fixed walker
- Open threads / next time: dog names, breeds and owner personalities; which encounters are area effects; speed ramp amount

## 2026-10-18 · Design · Rule details

- Covered: speed ramp, lane input, collisions after a hit and mid-move, treats, pay for fired dogs, Stinky stacking, upgrade repeats, Good leash, Sweet talker, permanent vs run-only upgrades, forced-stop art
- Decided: +10% speed per zone; hold to keep moving, both lanes count mid-move; ~1s grace after a hit; carried treats given by tapping a dog; fired dogs unpaid for that zone; Stinky refreshes; no upgrade repeats; Good leash stops pulls too; Sweet talker covers missed tips; permanent gameplay gear, cosmetics later; forced-stop card art in Milestone 6
- Open threads / next time: which encounters are area effects and how cards show who was caught; dog names, breeds and owner personalities
