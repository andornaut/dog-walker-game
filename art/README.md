# Art

The game's pixel art, effects and sound, drawn by script, and what is left to draw for the first build.

| Doc                                | What it holds                                                       |
| ---------------------------------- | ------------------------------------------------------------------- |
| [`inventory.md`](inventory.md)     | Every asset: key, kind, size, tags, priority                        |
| [`style-guide.md`](style-guide.md) | The rules: layout, palette, contrast, proportions, animation, sound |

## Scope

- `art/`: the generator scripts in `art/tools/`, the Aseprite sources they write and these docs.
- `public/art/`: the exported sprites, images, fonts and sounds, `manifest.extra.json`, the `/art/` gallery and the mock pages in `mocks/`. `/art/mocks/` lists the open mocks from `mocks/index.json`; a mock is deleted once it is decided. The game build generates `manifest.json` beside them.
- Also drawn here: the site's icons, `public/og-image.png` and the art on the home page.

## Method

- `art/tools/<set>.py` draws every asset except the hand-drawn favicons. Run `python3 art/tools/<set>.py build` (or `preview OUT.png`) from the repository root. Shared drawing tools are in `pixel.py`, and for pictures composed from exported art in `scene.py`; neither has commands.
- A build writes the set's Aseprite sources under `art/` and exports them to `public/art/` (`sprites/<key>.png` and `.json`, `images/<key>.png`, `fonts/<key>.png` and `.fnt`, `sounds/<key>.ogg` and `.m4a`). Each script's docstring names its folders. Exceptions:
  - `appicons.py` writes `art/appicon.aseprite` and `public/icons/`; `share.py` writes `art/share/share-card.aseprite` and `public/og-image.png`.
  - `fonts.py` and `sounds.py` write no sources. `sounds.py preview` takes an output folder, not a PNG, and `sounds.py build` also writes the loop flags in `public/art/manifest.extra.json`.
  - Extra commands: `backdrops.py gags`, `depths.py compare DIR`, `minis.py compare OUT.png`, `roadside.py table` and `screens.py shop-preview OUT.png`.
- A build overwrites the `.aseprite` files: change the script, not the sources.
- Each script's docstring holds its assets' sizes, tags, timings and placement coordinates.
- Game data and layout come from the game's export in `shared/export/`, never from `src/`. Only `scene.py` reads it (`game-data.json` and `layout.json`); `backdrops.py`, `cards.py`, `screens.py`, `share.py` and the skin card scripts take the zones, the layout and the pack's hands and collars from `scene.py`. `pixel.py` and `minis.py` read the depth steps from `shared/depth-steps.json`. Every other script holds its sizes and positions as constants (`ui.py`'s top bar buttons, `screens.py`'s Pet shop at 234,86, `roadside.py`'s sidewalk edge), so a layout change in the game needs the matching change in the script.
- Depth variants are redrawn at each step, not downscaled, and keep the full size's tags, frame counts and durations. Sizes scale as `floor(size × scale + 0.5)`, the game's rule.
- Regenerate the manifest (`npm run art:manifest`) before committing new or renamed exports. The manifest, the data export, the depth steps, the depth preview and the art checks are described in the Assets bullet of [`src/README.md`](../src/README.md).

### Naming

- The kebab-case manifest key is the file name: `art/<set>/<key>.aseprite` exports to `public/art/sprites/<key>.png` and `.json`, `public/art/images/<key>.png` or `public/art/fonts/<key>.png` and `.fnt`.
- A key starts with its kind's prefix, as in `inventory.md` (`dog-`, `fx-`, `ui-`); road objects, moving hazards and `logo` use a plain name.
- A depth variant appends its step (`dog-koda@50`).
- Zone keys use the zone's art id: `snooze-crescent`, `bark-park`, `woof-way`, `sniff-street-shops`, `paws-promenade`, `the-long-way-home` (easiest to hardest).

### Consistency checks

- Every export uses only Endesga 32 (plus the neutral greys in disabled and locked UI, as the style guide's palette section says), with alpha 0 or 255, at the frame size in `inventory.md`.
- Check proportion, outline and contrast on every zone's road colour in the script's `preview` and the `/art/` gallery, and road objects in a projected 360×560 view (`npm run art:depth-preview -- <key> [zone]`).
- Run `npm run check:art` and `npm run art:manifest -- --check` before committing.

## Remaining for the first build

- **Roadside props for the other zones:** a `PLACEMENT` entry in `art/tools/roadside.py` per zone, with any props the zone needs; Elm Avenue has its table and sprites

New art follows the rulebook as it changes.
