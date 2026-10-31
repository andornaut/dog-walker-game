# Card obstacle design

Base card choices and neighbourhood effect sources. [`design.md`](design.md#encounters-and-debuffs) describes the implemented rules; [`encounters.ts`](../src/data/encounters.ts) defines the choices and [`tuning.ts`](../src/data/tuning.ts) their cash amounts.

## Principles

- **Base choices:** every card obstacle offers exactly three base choices: one monetary choice, one heart choice and one effect choice. Each choice changes only its own category, whether it gives a benefit or imposes a cost. Never combine a direct cash change, heart change or effect in one choice.
- **Consistency:** an obstacle has the same resolution everywhere it appears: the same card and base choices, the same contact effect or a regular bump. Neighbourhoods select obstacle types and their spawn weights, never their resolution.
- **Effect mix:** every neighbourhood has several contact-effect sources and several card obstacle types offering effects, at least two of each. Within either source category, no two obstacle types give the same debuff. An effect may appear in both categories. High Park and Cabbagetown have no Spotlight.

An effect choice applies a temporary status such as Muddy, Spotlight, Stinky or Zoomies. Its later consequences, such as Stinky preventing tip earnings or Spotlight charging for subsequent bumps, belong to that status. They are distinct from an option that directly changes cash or hearts as well as applying a status. Every card keeps at least one choice available without cash.

## Current implementation

All nine card obstacles conform to the three-category principle. The table lists base choices before gear, perks or upgrades modify them.

| Card obstacle       | Monetary choice        | Heart choice                          | Effect choice            |
| ------------------- | ---------------------- | ------------------------------------- | ------------------------ |
| Big screen promo    | Buy the merch: $20     | Push through: lose 1 heart each       | Wave hello: Spotlight    |
| Cheese crates       | Buy the cheese: $20    | Hurry on: lose 1 heart each           | Have a sniff: Stinky     |
| Dropped ice cream   | Buy a new cone: $20    | Walk on by: lose 1 heart each         | Let them lick it: Muddy  |
| Green bin spill     | Pay for cleanup: $20   | Hurry past: lose 1 heart each         | Wade through: Muddy      |
| Other dog           | Let them sniff: $20    | Keep moving: lose 1 heart each        | Pull away: Zoomies       |
| Porch cat           | Treat bribe: $20       | Stand your ground: lead loses 1 heart | Splash past: Muddy       |
| Skunk               | Full groom: $20        | Hold your nose: lose 1 heart each     | Quick rinse: Stinky      |
| Thief               | Let the tips go: $20   | Grab it back: lose 1 heart each       | Dogs give chase: Zoomies |
| Wedding photo shoot | Pay for a reshoot: $20 | Walk around: lose 1 heart each        | Pose: Spotlight          |

The capybara in High Park and the busker on Yonge Street are regular bumps. Trash cans appear only in High Park and apply Stinky. Zookeeper is absent from the badge set.

### Modifiers

Hall pass replaces the costliest heart choice with a free Skip while available. Charmer can waive a monetary choice's cost, Second chance can forgive a heart loss and Quick recovery can shorten a debuff. These existing modifiers apply to the base choices above.

## Neighbourhood effect mix

The table lists available debuffs by source, not the number of encounters in a walk. Actual encounters depend on spawn weights and player choices.

| Neighbourhood       | Contact effects          | Card effects               |
| ------------------- | ------------------------ | -------------------------- |
| High Park           | Muddy, Stinky            | Stinky, Zoomies            |
| Cabbagetown         | Muddy, Zoomies           | Muddy, Stinky              |
| Kensington Market   | Muddy, Spotlight         | Muddy, Stinky, Zoomies     |
| The Beaches         | Muddy, Stinky            | Muddy, Spotlight, Zoomies  |
| Distillery District | Muddy, Spotlight, Stinky | Spotlight, Stinky, Zoomies |
| Yonge Street        | Muddy, Stinky, Zoomies   | Spotlight, Zoomies         |
