# Dog Walker Game: Start Here

A pixel-art game (simple, retro, cute) about being a dog walker. Mostly vibe coded, both code and art. Web first, then ported to iOS and Android.

## How this project is organized

| Doc                  | What it holds                                                     | Changes when                   |
| -------------------- | ----------------------------------------------------------------- | ------------------------------ |
| `README.md`          | This file: how we work                                            | Rarely                         |
| `decisions.md`       | Dated log of every decision, both tracks                          | A decision is made or reversed |
| `game-design.md`     | The game as currently decided (canonical)                         | A design decision lands        |
| `v1-plan.md`         | Scope, rules, starting numbers and milestones for the first build | v1 scope or tuning changes     |
| `ideas.md`           | Brainstorm parking lot: everything floated, kept or not           | Every design session           |
| `art-style-guide.md` | Visual rules: resolution, palette, sprites, mood                  | Art decisions land             |
| `tech-plan.md`       | Stack, architecture, porting plan, open tech questions            | A tech decision lands          |
| `session-log.md`     | One short entry per session                                       | End of every session           |

**Promotion rule:** ideas stay in `ideas.md` until agreed in a session. Only then do they move into `game-design.md` / `v1-plan.md` / `art-style-guide.md` / `tech-plan.md` and get a line in `decisions.md`.

## Two kinds of sessions

**Design sessions:** mechanics, story, characters, dogs, progression, feel. Loose and messy is fine. Claude's job: capture everything, separate "floated" from "agreed", and ask the question that unblocks a decision when we're circling.

**Tech sessions:** engine, code structure, tooling, builds, porting. Claude's job: propose options with trade-offs, flag choices that would make the mobile port harder, and keep the plan current.

Art can come up in either; it lands in `art-style-guide.md`.

## Session ritual

1. **Start:** say "design session" or "tech session" (plus a topic if there is one). Claude reads the relevant docs.
2. **During:** talk freely. Several people may be talking at once (voice). Authorship is not recorded.
3. **End:** say "wrap up". Claude proposes (a) new/changed entries for `ideas.md`, (b) any decisions to promote, (c) a `session-log.md` entry, and only writes them after we confirm.

## Idea statuses (used in ideas.md)

- **[floated]:** said out loud, not discussed
- **[exploring]:** we're actively kicking it around
- **[agreed]:** promoted to the design doc
- **[parked]:** good, but not for v1
- **[cut]:** decided against (kept so we don't re-argue it; note why)
