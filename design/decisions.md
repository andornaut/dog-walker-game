# Decision Log

Newest at the bottom. One line per decision. If we reverse or refine something, add a new line that references the old one; don't delete history.

Format: `YYYY-MM-DD · [Design|Art|Tech|Process] · Decision[: why] (who)`. The why is optional; record it when one was given.

---

- 2026-10-18 · Process · Project set up with separate design and tech sessions; ideas stay in ideas.md until both agree: keeps brainstorming free without muddying the plan (Andornaut & Trista)
- 2026-10-18 · Design · Theme: the player is a dog walker (Andornaut & Trista)
- 2026-10-18 · Art · Pixel art style: simple, retro, cute (Andornaut & Trista)
- 2026-10-18 · Tech · Web first, then port to iOS and Android (Andornaut & Trista)
- 2026-10-18 · Process · Code and art will be mostly vibe coded / AI-assisted (Andornaut & Trista)
- 2026-10-18 · Design · Core: lane runner with 5 lanes; the street scrolls toward you at a calmer pace than Bowling Ballers: cozy, not frantic (Andornaut & Trista)
- 2026-10-18 · Design · Collisions open choice cards instead of ending the run; choices only (no minigames) in v1: every bump is a story, not a game over (Andornaut & Trista)
- 2026-10-18 · Design · Roguelite structure: a run is 4 zones; pre-run loadout comes from permanent unlocks: Hades-style replayability (Andornaut & Trista)
- 2026-10-18 · Design · Money is the only currency: earned and spent in-run, banked between runs, buys permanent unlocks (Andornaut & Trista)
- 2026-10-18 · Design · Walk 1–3 dogs as one unit in a single lane; each dog has an owner-happiness meter; at zero the owner fires you and the dog leaves; the run ends when no dogs are left (Andornaut & Trista)
- 2026-10-18 · Design · Encounters affect dogs according to their traits (Andornaut & Trista)
- 2026-10-18 · Design · Each dog pays a share of its fee per zone survived (Andornaut & Trista)
- 2026-10-18 · Design · After zones 1–3, pick 1 of 3 upgrade cards; the pool includes lose-lose cards (Andornaut & Trista)
- 2026-10-18 · Design · One forced-choice stop per zone (e.g. stop sign, chatty neighbour): guaranteed breather and decision (Andornaut & Trista)
- 2026-10-18 · Design · Gentle failure: a fired dog leaves with a funny quip; you keep what you've earned: forgiving failure keeps it cozy (Andornaut & Trista)
- 2026-10-18 · Design · Pillars: Cozy, not frantic · Every bump is a story · Charming chaos (Andornaut & Trista)
- 2026-10-18 · Art · Refined pixel art, ¾ top-down view, portrait orientation; refines the 2026-10-18 Art entry "Pixel art style: simple, retro, cute" (Andornaut & Trista)
- 2026-10-18 · Art · Choices shown as Slay the Spire–style cards, three across and art-led: picture + one-line effect, tap to enlarge (Andornaut & Trista)
- 2026-10-18 · Design · v1 scope: one neighbourhood, fixed 4-zone route, roster of 3 dogs picked freely (slot unlocks and branching paths come later): the smallest build that proves the core loop is fun (Andornaut & Trista)
- 2026-10-18 · Design · Pay to fix problems: encounter choices can trade money for a smaller penalty, e.g. skunk: pay a lot for grooming, or less and take a debuff (Andornaut & Trista)
- 2026-10-18 · Design · Controls are designed touch-first; v1 supports keyboard (web) and touch (mobile); mouse is not planned (unattributed)
- 2026-10-18 · Design · Pickups: treats and tips are things you want to hit (Andornaut)
- 2026-10-18 · Design · Stinky debuff: the cheap skunk fix leaves a lingering penalty (v1: tips halved for the rest of the zone) (Andornaut)
- 2026-10-18 · Tech · Engine: Phaser 4 + TypeScript + Vite: web-native, builds to static files, mobile later by wrapping the web build (Andornaut)
- 2026-10-18 · Tech · Hosting: Cloudflare Workers static assets, deployed on push to main by Cloudflare Workers Builds (Andornaut)
- 2026-10-18 · Tech · Code in a private GitHub repository, andornaut/dog-walker-game; milestones stay in v1-plan.md rather than a Projects board (Andornaut)
- 2026-10-18 · Tech · Tooling copied from andornaut/cloudflare-starter (Andornaut)
