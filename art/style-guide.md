# Art Style Guide

## Direction

- **Pixel art: simple, cute, a little retro, but refined.** Art will be largely AI-assisted, so consistency rules matter more than usual: write down every choice that keeps generated assets looking like one game.
- **Mood:** casual, cozy, low-stress.
- **Camera:** ¾ top-down.
- **Orientation:** portrait.
- **Choice cards:** Slay the Spire–style cards, up to three across on screen (an encounter with two options shows two centred cards), art-led: an illustration plus a one-line effect; tap a card to enlarge it for full details. Every option has its own illustration showing its outcome. A card is 83×140: a coloured title band (red for encounters, sky blue for lucky encounters, amber for forced stops, green for upgrades), a 75×56 illustration in a recessed window, the effect text below it, and a dark cost badge at the bottom. Illustrations are composed from the road sprites at 1× on a scrap of the zone's ground.
- **Owner happiness UI:** each dog shown with its owner's face and a happiness meter.
- **Base render resolution:** 360×640, scaled up crisply with no smoothing.
- **Run screen layout:** a top status bar (money, zone progress), not overlaid on the road; a fixed-width dog column on the left with 3 slots (a fired dog's slot empties and the road never changes width); the road fills the rest. On an encounter the road pauses and dims, and the cards cover the road while the top bar and dog column stay visible.
- **Sizes:** 32×32 for road tiles, dogs and obstacles; lanes are 56px wide, leaving ~12px of margin. People (walkers, owners, forced-stop and lucky-encounter characters) are 32×48, so they stand taller than the dogs. Pickups and small effects are 16×16. Dog and owner faces in the dog column are 32×32.
- **Palette:** [Endesga 32](https://lospec.com/palette-list/endesga-32), and no other colours. Every pixel of every asset is one of its 32 colours. Darkening (shadows, the dimmed road behind cards) maps each colour to the next darker colour in its ramp rather than blending with black, so the screen stays on the palette.
- **Outlines:** coloured. A sprite's outline is two ramp steps darker than the fill it borders, so dark sprites (the skunk) keep their silhouette. Ground decals such as puddles have no outline.
- **UI colours (provisional):** wood. A dark brown frame (`#3e2731`, `#733e39`) with cream paper slots (`#ead4aa`) and tan face panels (`#e4a672`), as in the run screen mock. The mock's other defaults (zone road colours, card colours) stand until the style is refined.
- **Proportions:** chibi. Heads are about as big as bodies, so a breed reads from its head shape, ears and markings at 32×32.
- **Walker:** one fixed walker, seen from behind with a 4-frame `walk` and a 2-frame `react`. Equipped gear shows as a badge beside the walker and in the gear row; the walker sprite has no gear variants.
- **Leash:** a 1px line drawn in code from the walker's hand to each collar, in `#a22633`; there is no leash sprite.
- **Dog animation:** road sprites are seen from above and behind. `walk` is a 4-frame trot (diagonal leg pairs swap, the body bobs on the passing frames, the tail wags), `react` is a 2-frame hop, `pull` is 2 frames leaning right, which the game mirrors for a pull to the left, and `tell` is the 2-frame lean shown, with the `fx-bark` pop, before a pull. Sprites carry no shadow; the game draws one in the road's darker ramp colour.
- **UI art:** all UI (card frames, panels, status bar) is pixel art at the base resolution, with a pixel font.
- **Fonts:** two 8px pixel fonts, both under the SIL Open Font License (files and licenses in `art/fonts/`). `font-body` is Tiny5, mixed case, for body text, quips and floating labels. `font-title` is Silkscreen, capitals, for titles, numbers and buttons. Glyphs are white so the game tints them; ♥ is a drawn 7×6 heart.

## Open decisions

- **Animation budget beyond the walk:** idle animations, and frame counts for people and obstacles

## Asset rules

The art-side rules for every asset live here. The tooling that draws, builds and exports sprites is the set of scripts in `art/tools/`.

- **Formats:** Aseprite source files go in `art/`; exported PNG sheets plus Aseprite JSON go in `public/art/` (manifest: `public/art/manifest.json`). The pixel font is a BMFont (XML `.fnt` plus `.png`).
- **Sprites in code:** `art/tools/dogs.py` draws the dogs, `art/tools/owners.py` the owners' faces, `art/tools/road.py` everything else on the road (walker, pickups, encounters, lucky encounters, the bark pop), `art/tools/help.py` composes the help screen's illustrations, `art/tools/cards.py` the card frame and card illustrations from those exports, `art/tools/fonts.py` rasterizes the fonts into BMFonts, and `art/tools/icons.py` draws the gear icons. Each builds its sources (`art/dogs/`, `art/owners/`, `art/road/`, `art/help/`, `art/cards/`, `art/icons/`) and exports in `public/art/sprites/` (or `public/art/images/`), then adds them to the manifest: `python3 art/tools/<script>.py build`, or `preview OUT.png` for a contact sheet. Shared drawing and build code is in `art/tools/pixel.py`. A build overwrites the `.aseprite` files, so change the script, not the sources.
- **Inventory:** every asset the game needs, with its manifest key, size and priority, is listed in `inventory.md`.
- **Naming:** an asset's kebab-case manifest key is also its file name: `art/<set>/<key>.aseprite` exports to `public/art/sprites/<key>.png` and `.json` (sprites), `public/art/images/<key>.png` (images) or `public/art/fonts/<key>.png` and `.fnt` (fonts). Keys use the prefixes `dog-`, `face-dog-`, `face-owner-`, `fx-`, `card-`, `help-`, `item-`, `icon-`, `font-`, `screen-` and `ui-`; road objects use their plain name (`skunk`, `tip`). Animation names are the Aseprite tag names.
- **Consistency checks:** before an asset goes in the game, every pixel of its export is an Endesga 32 colour at full opacity or fully transparent, its frames are the size listed in `inventory.md`, and it follows the proportions and outline rules above. Check it in the gallery at `/art/` on each zone's ground colour.

## Reference board

- **Bowling Ballers:** lane-runner layout (but calmer)
- **Slay the Spire:** choice cards
- **Hades:** zones, hub feel (for later)
