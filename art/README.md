# Art

The game's pixel art, effects and sound, drawn by script, and what is left to draw for the first build.

| Doc                                | What it holds                                                       |
| ---------------------------------- | ------------------------------------------------------------------- |
| [`style-guide.md`](style-guide.md) | The rules: layout, palette, contrast, proportions, animation, sound |
| [`inventory.md`](inventory.md)     | Every asset: key, kind, size, tags, priority                        |

## Scope

- `art/`: the generator scripts in `art/tools/`, the Aseprite sources they write and these docs.
- `public/art/`: the exported sprites, images, fonts and sounds, `manifest.json`, the `/art/` gallery and the mock pages in `mocks/`.
- Also drawn here: the site's icons, `public/og-image.png` and the art on the home page.

## Method

- `art/tools/<set>.py` draws every asset except the hand-drawn favicons: it writes the sources in `art/<set>/`, exports them and lists them in `public/art/manifest.json`. Run `python3 art/tools/<set>.py build` (or `preview OUT.png`) from the repository root. Shared drawing tools are in `pixel.py`.
- A build overwrites the `.aseprite` files: change the script, not the sources.
- Each script's docstring holds its assets' sizes, tags, timings and placement coordinates.
- Road sprites get a manifest anchor (`feetY`, `opaqueWidth`) from their last opaque row. Depth variants are redrawn at each scale step, not downscaled, and keep the full size's tags, frame counts and durations.
- Sizes scale as `floor(size × scale + 0.5)`, the same rounding as the game.

### Naming

- The kebab-case manifest key is the file name: `art/<set>/<key>.aseprite` exports to `public/art/sprites/<key>.png` and `.json`, `public/art/images/<key>.png` or `public/art/fonts/<key>.png` and `.fnt`.
- A key starts with its kind's prefix, as in `inventory.md` (`dog-`, `fx-`, `ui-`); road objects, moving hazards and `logo` use a plain name.
- A depth variant appends its step (`dog-koda@50`).
- Zone keys use the zone's art id: `woof-way`, `bark-park`, `sniff-street-shops`, `the-long-way-home`, `snooze-crescent`, `paws-promenade`.

### Consistency checks

- Every export uses only Endesga 32, with alpha 0 or 255, at the frame size in `inventory.md`.
- Check proportion, outline and contrast on every zone's road colour in the script's `preview` and the `/art/` gallery, and road objects in a projected 360×560 view.
- The game's tests check that every key and tag the code uses is in the manifest and that each depth variant matches its full size; run them before committing.

## Remaining for the first build

- **Six new encounters:** picnic, goose, petunias, trash bins, café patio and lemonade stand. Road sprites with depth variants, hit effects, label and flash colours, the lemonade popup and hit sounds, then a card illustration per option.
- **Need cards:** the good spot, grumpy neighbour, pee-mail and water stop cards (two options each). The stranger, play date and accident cards are drawn.
- **Fork path cards:** the route frame and a preview for each zone are drawn; they ship once forks are in the game.
- **Depth variants:** variants for the thief, the people and the other road sprites that have none; the low skunk cloud, the front-view skunk, squirrel and corgi, and the wider ice cream truck at each step; the 0.875 and 0.625 steps once the game reads them.
- **360×560 screens:** `screen-home`, `screen-stats`, `screen-end` and `screen-loading` are drawn and wait for the game's 560 layout.
- **Start screen restyle:** the painted sign logo and the flat step bands from the start screen mock.
- **Help:** rebuild `help-zones` for forks once they are in the game.
- **Cleanup:** retire the `dash` and `waffles` keys and tags, the zone-free `ui-zone-pips` tags once the top bar uses the per-zone ones, and `fx-stinky`, which nothing uses.
