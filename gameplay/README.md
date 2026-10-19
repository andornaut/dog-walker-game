# Dog Walker Game: Start Here

A pixel-art game (simple, retro, cute) about being a dog walker. Web first, then iOS and Android.

## Docs

| Doc                                           | What it holds                                     | Changes when                     |
| --------------------------------------------- | ------------------------------------------------- | -------------------------------- |
| [`game-design.md`](game-design.md)            | The rulebook, and what's left for the first build | A design decision lands          |
| [`next.md`](next.md)                          | Everything set aside for later, unscheduled       | Something is set aside for later |
| [`ideas.md`](ideas.md)                        | Undecided and cut ideas, and open questions       | Every design session             |
| [`art/style-guide.md`](../art/style-guide.md) | Visual rules: resolution, palette, sprites, mood  | An art decision lands            |
| [`tech-plan.md`](../tech-plan.md)             | Stack, architecture, save data, porting           | A tech decision lands            |

Ideas stay in `ideas.md` until agreed in a session, then move to the doc they belong in and leave `ideas.md`. Docs state the current rule only; git keeps the history.

## Idea statuses

- **[floated]:** said out loud, not discussed
- **[exploring]:** being discussed
- **[cut]:** decided against; kept, with the reason, so it isn't argued again

## Sessions

Start a session by saying "design session" or "tech session", plus a topic if there is one; Claude reads the relevant docs. End by saying "wrap up": Claude proposes the doc changes and writes them only after we confirm.

- **Design sessions** (mechanics, story, characters, dogs, progression, feel): Claude captures everything, keeps "floated" separate from "agreed", and asks the question that unblocks a decision.
- **Tech sessions** (engine, code structure, tooling, builds, porting): Claude proposes options with trade-offs and flags choices that would make the mobile port harder.

Art can come up in either.
