# Decision Log

Newest at the bottom. One line per decision. If we reverse or refine something, add a new line that references the old one; don't delete history.

Format: `YYYY-MM-DD · [Design|Art|Tech|Process] · Decision[: why]`. The why is optional; record it when one was given.

---

- 2026-10-18 · Process · Project set up with separate design and tech sessions; ideas stay in ideas.md until both agree: keeps brainstorming free without muddying the plan
- 2026-10-18 · Design · Theme: the player is a dog walker
- 2026-10-18 · Art · Pixel art style: simple, retro, cute
- 2026-10-18 · Tech · Web first, then port to iOS and Android
- 2026-10-18 · Process · Code and art will be mostly vibe coded / AI-assisted
- 2026-10-18 · Design · Core: lane runner with 5 lanes; the street scrolls toward you at a calmer pace than Bowling Ballers: cozy, not frantic
- 2026-10-18 · Design · Collisions open choice cards instead of ending the run; choices only (no minigames) in v1: every bump is a story, not a game over
- 2026-10-18 · Design · Roguelite structure: a run is 4 zones; pre-run loadout comes from permanent unlocks: Hades-style replayability
- 2026-10-18 · Design · Money is the only currency: earned and spent in-run, banked between runs, buys permanent unlocks
- 2026-10-18 · Design · Walk 1–3 dogs as one unit in a single lane; each dog has an owner-happiness meter; at zero the owner fires you and the dog leaves; the run ends when no dogs are left
- 2026-10-18 · Design · Encounters affect dogs according to their traits
- 2026-10-18 · Design · Each dog pays a share of its fee per zone survived
- 2026-10-18 · Design · After zones 1–3, pick 1 of 3 upgrade cards; the pool includes lose-lose cards
- 2026-10-18 · Design · One forced-choice stop per zone (e.g. stop sign, chatty neighbour): guaranteed breather and decision
- 2026-10-18 · Design · Gentle failure: a fired dog leaves with a funny quip; you keep what you've earned: forgiving failure keeps it cozy
- 2026-10-18 · Design · Pillars: Cozy, not frantic · Every bump is a story · Charming chaos
- 2026-10-18 · Art · Refined pixel art, ¾ top-down view, portrait orientation; refines the 2026-10-18 Art entry "Pixel art style: simple, retro, cute"
- 2026-10-18 · Art · Choices shown as Slay the Spire–style cards, three across and art-led: picture + one-line effect, tap to enlarge
- 2026-10-18 · Design · v1 scope: one neighbourhood, fixed 4-zone route, roster of 3 dogs picked freely (slot unlocks and branching paths come later): the smallest build that proves the core loop is fun
- 2026-10-18 · Design · Pay to fix problems: encounter choices can trade money for a smaller penalty, e.g. skunk: pay a lot for grooming, or less and take a debuff
- 2026-10-18 · Design · Controls are designed touch-first; v1 supports keyboard (web) and touch (mobile); mouse is not planned
- 2026-10-18 · Design · Pickups: treats and tips are things you want to hit
- 2026-10-18 · Design · Stinky debuff: the cheap skunk fix leaves a lingering penalty (v1: tips halved for the rest of the zone)
- 2026-10-18 · Tech · Engine: Phaser 4 + TypeScript + Vite: web-native, builds to static files, mobile later by wrapping the web build
- 2026-10-18 · Tech · Hosting: Cloudflare Workers static assets, deployed on push to main by Cloudflare Workers Builds
- 2026-10-18 · Tech · Code in a private GitHub repository, andornaut/dog-walker-game; milestones stay in v1-plan.md rather than a Projects board
- 2026-10-18 · Tech · Tooling copied from andornaut/cloudflare-starter
- 2026-10-18 · Process · Authorship is not recorded, and ideas move out of ideas.md once agreed in a session; replaces the 2026-10-18 Process entry "ideas stay in ideas.md until both agree"
- 2026-10-18 · Design · Zones are a fixed distance, each taking ~3 minutes at base speed; a 4-zone run lasts ~12 minutes
- 2026-10-18 · Design · Slower choice options cost money (missed tips) instead of time
- 2026-10-18 · Design · Touch input: tap the left/right half of the screen, or swipe
- 2026-10-18 · Design · A squirrel with no Chaser in the pack is harmless scenery and opens no card
- 2026-10-18 · Design · An option you can't afford is disabled; every encounter keeps at least one free option
- 2026-10-18 · Design · Encounter money costs are per affected dog
- 2026-10-18 · Design · Owner happiness is capped at 8
- 2026-10-18 · Design · Fancy covers puddles only; no mud encounter in v1
- 2026-10-18 · Design · Food-driven: the pack drifts one lane toward a nearby treat
- 2026-10-18 · Design · Choice-card outcomes are fixed and shown on the card
- 2026-10-18 · Design · Upgrade cards with a gain and a cost (Shortcut, Rush hour) are trade-off cards; refines the 2026-10-18 entry "the pool includes lose-lose cards"
- 2026-10-18 · Design · Loadout: pick up to 1 owned item before a run; none is allowed
- 2026-10-18 · Design · Poop bags add a Skip option to an encounter card, once per run
- 2026-10-18 · Design · Renames to avoid clashing with the Treat pickup: Treat pouch upgrade is now Belly rubs; treat bag gear is now Lucky collar
- 2026-10-18 · Design · Milestone 4 waits for a forced-stop pool and ~8 upgrade cards
- 2026-10-18 · Art · Base render resolution is 360×640, scaled up crisply with no smoothing; tile size is still open
- 2026-10-18 · Art · Run screen layout: top status bar, fixed-width 3-slot dog column on the left, road fills the rest; encounter cards cover the paused, dimmed road while the bar and column stay visible
- 2026-10-18 · Art · All UI is pixel art at the base resolution with a pixel font
- 2026-10-18 · Tech · All run UI (road, top bar, dog column, choice cards) is drawn in the Phaser canvas; HTML is only the page shell: one pixel scale and one input system
- 2026-10-18 · Tech · Run screen as three Phaser scenes (RunScene, HudScene, CardScene); game state is plain TypeScript with no Phaser dependency, so rules are unit-testable
- 2026-10-18 · Art · Tile size is 32×32 for road tiles, dogs and obstacles; lanes are 56px wide
- 2026-10-18 · Art · Aseprite sources go in art/; exported PNG sheets plus Aseprite JSON go in public/assets/; the pixel font is a BMFont (.fnt plus .png)
