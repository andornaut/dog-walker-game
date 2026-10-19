# Art

The game's pixel art, effects and sound, drawn by script, and what is left to draw for the first build.

| Doc                                | What it holds                                                       |
| ---------------------------------- | ------------------------------------------------------------------- |
| [`inventory.md`](inventory.md)     | Every asset: key, kind, size, tags, priority                        |
| [`style-guide.md`](style-guide.md) | The rules: layout, palette, contrast, proportions, animation, sound |

## Scope

- `art/`: the generator scripts in `art/tools/`, the Aseprite sources they write and these docs.
- `public/art/`: the exported sprites, images, fonts and sounds, `manifest.extra.json`, the `/art/` gallery and the mock pages in `mocks/`. The game build generates `manifest.json` beside them.
- Also drawn here: the site's icons, `public/og-image.png` and the art on the home page.

## Method

- `art/tools/<set>.py` draws every asset except the hand-drawn favicons: it writes the sources in `art/<set>/` and exports them to `public/art/` (`sprites/<key>.png` and `.json`, `images/<key>.png`, `fonts/<key>.png` and `.fnt`, `sounds/<key>.ogg` and `.m4a`). Run `python3 art/tools/<set>.py build` (or `preview OUT.png`) from the repository root. Shared drawing tools are in `pixel.py`.
- A build overwrites the `.aseprite` files: change the script, not the sources.
- Each script's docstring holds its assets' sizes, tags, timings and placement coordinates.
- The game generates `public/art/manifest.json` from the files on disk: the dev server rewrites it as exports land, `npm run build` writes it, and `npm run art:manifest` writes it on demand. It measures each road sprite's anchor (`feetY`, `opaqueWidth`) from frame 0. What a file cannot say is in `public/art/manifest.extra.json`: a sound's loop flag, as `{"sounds": {"<key>": {"loop": true}}}`, which `sounds.py` writes. Regenerate the manifest before committing new or renamed exports.
- The tools read game data and layout from the game's export, `shared/export/game-data.json` (names, tuning, dogs, zones, encounters, card faces and their frames) and `shared/export/layout.json` (the camera, regions, lanes, verges, pack formation, top bar, doghouse and card layouts), never from `src/`. The game build and the dev server regenerate them; `npm run export:data` writes them on demand.
- The depth steps are in `shared/depth-steps.json`. Depth variants are redrawn at each scale step, not downscaled, and keep the full size's tags, frame counts and durations. `npm run art:depth-preview -- <key> [zone]` draws a road sprite as the game draws it across a sweep of distances, to `out/depth-preview/<key>/`.
- Sizes scale as `floor(size × scale + 0.5)`, the same rounding as the game.

### Naming

- The kebab-case manifest key is the file name: `art/<set>/<key>.aseprite` exports to `public/art/sprites/<key>.png` and `.json`, `public/art/images/<key>.png` or `public/art/fonts/<key>.png` and `.fnt`.
- A key starts with its kind's prefix, as in `inventory.md` (`dog-`, `fx-`, `ui-`); road objects, moving hazards and `logo` use a plain name.
- A depth variant appends its step (`dog-koda@50`).
- Zone keys use the zone's art id: `snooze-crescent`, `bark-park`, `woof-way`, `sniff-street-shops`, `paws-promenade`, `the-long-way-home` (easiest to hardest).

### Consistency checks

- Every export uses only Endesga 32, with alpha 0 or 255, at the frame size in `inventory.md`.
- Check proportion, outline and contrast on every zone's road colour in the script's `preview` and the `/art/` gallery, and road objects in a projected 360×560 view.
- `npm run check:art` runs the game's art tests: every key and tag the code uses is in the manifest, each depth variant matches its full size, and the manifest matches the files. `npm run art:manifest -- --check` fails if the committed manifest differs from what the files give. Run both before committing.

## Remaining for the first build

Nothing is outstanding. New art follows the rulebook as it changes.
