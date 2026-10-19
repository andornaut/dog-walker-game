# Art Style Guide

## Direction (agreed)

- **Pixel art: simple, cute, a little retro, but refined.** Art will be largely AI-assisted, so consistency rules matter more than usual: write down every choice that keeps generated assets looking like one game.
- **Mood:** casual, cozy, low-stress.
- **Camera:** ¾ top-down.
- **Orientation:** portrait.
- **Choice cards:** Slay the Spire–style cards, three across on screen, art-led: an illustration plus a one-line effect; tap a card to enlarge it for full details.
- **Owner happiness UI:** each dog shown with its owner's face and a happiness meter.
- **Base render resolution:** 360×640, scaled up crisply with no smoothing.
- **Run screen layout:** a top status bar (money, zone progress), not overlaid on the road; a fixed-width dog column on the left with 3 slots (a fired dog's slot empties and the road never changes width); the road fills the rest. On an encounter the road pauses and dims, and the three cards cover the road while the top bar and dog column stay visible.
- **UI art:** all UI (card frames, panels, status bar) is pixel art at the base resolution, with a pixel font.

## Open decisions

- **Tile size:** e.g. 16×16 vs 32×32 tiles
- **Palette:** pick a fixed palette (e.g. a 16–32 colour set) and stick to it
- **Character proportions:** chibi/big-head vs realistic
- **Outlines:** black, coloured, or none
- **Animation budget:** frames per walk cycle, idle animations
- **Card art size and frame:** illustration dimensions, border style
- **Pixel font:** which font

## Asset rules

The art-side rules for every asset live here. The tooling that generates, cleans up and packs sprites lives in `tech-plan.md`.

- **Naming:** TBD (file and sprite naming scheme)
- **Consistency checks:** every generated asset must match the agreed palette, resolution, proportions and outline style before it goes in the game. TBD once the open decisions above are settled

## Reference board

- **Bowling Ballers:** lane-runner layout (but calmer)
- **Slay the Spire:** choice cards
- **Hades:** zones, hub feel (for later)
