# Art Style Guide

## Direction (agreed)

- **Pixel art: simple, cute, a little retro, but refined.** Art will be largely AI-assisted, so consistency rules matter more than usual: write down every choice that keeps generated assets looking like one game.
- **Mood:** casual, cozy, low-stress.
- **Camera:** ¾ top-down.
- **Orientation:** portrait.
- **Choice cards:** Slay the Spire–style cards, up to three across on screen (an encounter with two options shows two centred cards), art-led: an illustration plus a one-line effect; tap a card to enlarge it for full details.
- **Owner happiness UI:** each dog shown with its owner's face and a happiness meter.
- **Base render resolution:** 360×640, scaled up crisply with no smoothing.
- **Run screen layout:** a top status bar (money, zone progress), not overlaid on the road; a fixed-width dog column on the left with 3 slots (a fired dog's slot empties and the road never changes width); the road fills the rest. On an encounter the road pauses and dims, and the three cards cover the road while the top bar and dog column stay visible.
- **Tile size:** 32×32 for road tiles, dogs and obstacles; lanes are 56px wide, leaving ~12px of margin.
- **Palette:** [Endesga 32](https://lospec.com/palette-list/endesga-32), and no other colours. Every pixel of every asset is one of its 32 colours. Darkening (shadows, the dimmed road behind cards) maps each colour to the next darker colour in its ramp rather than blending with black, so the screen stays on the palette.
- **Outlines:** coloured. A sprite's outline is two ramp steps darker than the fill it borders, so dark sprites (the skunk) keep their silhouette. Ground decals such as puddles have no outline.
- **UI colours (provisional):** wood. A dark brown frame (`#3e2731`, `#733e39`) with cream paper slots (`#ead4aa`) and tan face panels (`#e4a672`), as in the run screen mock. The mock's other defaults (zone road colours, card colours) stand until the style is refined.
- **Proportions:** chibi. Heads are about as big as bodies, so a breed reads from its head shape, ears and markings at 32×32.
- **Dog animation:** road sprites are seen from above and behind. `walk` is a 4-frame trot (diagonal leg pairs swap, the body bobs on the passing frames, the tail wags), `react` is a 2-frame hop, and `pull` is 2 frames leaning right, which the game mirrors for a pull to the left. Sprites carry no shadow; the game draws one in the road's darker ramp colour.
- **UI art:** all UI (card frames, panels, status bar) is pixel art at the base resolution, with a pixel font.

## Open decisions

- **Animation budget beyond the walk:** idle animations, and frame counts for people and obstacles
- **Card art size and frame:** illustration dimensions, border style
- **Pixel font:** which font

## Asset rules

The art-side rules for every asset live here. The tooling that generates, cleans up and packs sprites lives in `../tech-plan.md`.

- **Formats:** Aseprite source files go in `art/`; exported PNG sheets plus Aseprite JSON go in `public/art/` (manifest: `public/art/manifest.json`). The pixel font is a BMFont (`.fnt` plus `.png`). The export pipeline lives in `../tech-plan.md`.
- **Sprites in code:** `art/tools/dogs.py` draws the dogs and `art/tools/road.py` everything else on the road (walker, pickups, encounters, lucky encounters, the bark pop). Each builds its sources (`art/dogs/`, `art/road/`) and exports in `public/art/sprites/`, then adds them to the manifest: `python3 art/tools/<script>.py build`, or `preview OUT.png` for a contact sheet. Shared drawing and build code is in `art/tools/pixel.py`. A build overwrites the `.aseprite` files, so change the script, not the sources.
- **Inventory:** every asset v1 needs, with its manifest key, size and priority, is listed in `inventory.md`.
- **Naming:** TBD (file and sprite naming scheme)
- **Consistency checks:** every generated asset must match the agreed palette, resolution, proportions and outline style before it goes in the game. TBD once the open decisions above are settled

## Reference board

- **Bowling Ballers:** lane-runner layout (but calmer)
- **Slay the Spire:** choice cards
- **Hades:** zones, hub feel (for later)
