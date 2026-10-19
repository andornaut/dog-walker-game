# Dog Walker Game: Start Here

A pixel-art game (simple, retro, cute) about being a dog walker. Mostly vibe coded, both code and art. Web first, then ported to iOS and Android.

## How this project is organized

| Doc              | What it holds                                                                           | Changes when                     |
| ---------------- | --------------------------------------------------------------------------------------- | -------------------------------- |
| `README.md`      | This file: how we work                                                                  | Rarely                           |
| `game-design.md` | The game as currently planned: rules, content, starting numbers, milestones (canonical) | A design decision lands          |
| `next.md`        | Everything set aside for later, unscheduled                                             | Something is set aside for later |
| `ideas.md`       | Undecided and cut ideas, and open questions                                             | Every design session             |

Owned by other roles:

- [`art/style-guide.md`](../art/style-guide.md) (art): visual rules: resolution, palette, sprites, mood
- [`tech-plan.md`](../tech-plan.md) (tech): stack, architecture, porting plan, open tech questions

**Promotion rule:** ideas stay in `ideas.md` until agreed in a session. Then they move into `game-design.md` (the current plan) or `next.md` (later), `art/style-guide.md` or `tech-plan.md`, and leave `ideas.md`. Docs state the current rule only; git keeps the history.

## Two kinds of sessions

**Design sessions:** mechanics, story, characters, dogs, progression, feel. Loose and messy is fine. Claude's job: capture everything, separate "floated" from "agreed", and ask the question that unblocks a decision when we're circling.

**Tech sessions:** engine, code structure, tooling, builds, porting. Claude's job: propose options with trade-offs, flag choices that would make the mobile port harder, and keep the plan current.

Art can come up in either; it lands in `art/style-guide.md`.

## Session ritual

1. **Start:** say "design session" or "tech session" (plus a topic if there is one). Claude reads the relevant docs.
2. **During:** talk freely. Several people may be talking at once (voice). Authorship is not recorded.
3. **End:** say "wrap up". Claude proposes the changes to `ideas.md` and the other docs, and only writes them after we confirm.

## Idea statuses (used in ideas.md)

- **[floated]:** said out loud, not discussed
- **[exploring]:** we're actively kicking it around
- **[cut]:** decided against (kept so we don't re-argue it; note why)
