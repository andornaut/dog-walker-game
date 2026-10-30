# Controls

The normal-form specification for in-game controls. [`gameplay/design.md`](../gameplay/design.md) is canonical for gameplay semantics and player wording. The [style guide](style-guide.md) owns the wider art direction, and the [inventory](inventory.md) owns exported asset sizes and tags.

**Implemented** means verified in the control primitives and input handlers. **Approved target** means an approved design requirement; integration and deployment must be verified separately. **Proposed pending** means a choice has not been approved. No proposed colours, sizes or control types are introduced here.

## Scope and exceptions

This guide covers the Phaser canvas game: actions, navigation icons, item selection, settings switches, sliders and their labels. The website, data browser and developer panel have separate DOM controls.

| Control                       | Reason for exception                                                   | Retained rules                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Choice cards                  | Tall illustrated choices carry art, prices and consequences            | Preserve card geometry, readable text and selection feedback; tap release chooses, a hold enlarges, and outside taps never choose |
| Hold to explain               | A still hold requests details rather than activation                   | Keep hold and tap-release distinct; pause the walk for its detail card and consume the dismissing tap                             |
| Home and walk top bars        | Buttons and cash/effect wells share a 360px-wide, 40px-tall bar        | Approved 34×44 hits; 20×20 navy faces, 16×16 glyphs, 2px press; no second row                                                     |
| Joystick                      | Not applicable: this game uses lane gestures and keys                  | No joystick asset, state or input contract is defined                                                                             |
| Lane steering                 | Road input is a movement gesture, not a button                         | Preserve immediate road taps, release-classified doghouse-row taps, lane drags and existing keys; top-bar taps never steer        |
| Pause menu                    | Controls sit inside a pause overlay with Resume and navigation actions | Apply ordinary primary/secondary roles and text-button targets; preserve pause and close behaviour                                |
| Pet shop                      | The building and its board form one bespoke control                    | Preserve its building hit area, green board and press feedback; do not force building art into a compact button                   |
| Settings switches and sliders | A small indicator is activated through its whole labelled row          | Keep the row hit area, labels, keyboard behaviour and non-colour state cues                                                       |

## Design tokens

Dimensions are base game pixels; the game renders at 360×560 with pixel scaling. Names below identify specification tokens, not additional code constants.

| Name                  | Value             | Unit | Purpose                   | Status      |
| --------------------- | ----------------- | ---- | ------------------------- | ----------- |
| action.primary.fill   | green `#63c74d`   | RGB  | Primary face              | Implemented |
| action.primary.text   | ink `#181425`     | RGB  | Primary label             | Implemented |
| action.secondary.fill | cream `#ead4aa`   | RGB  | Secondary face            | Implemented |
| action.secondary.text | plum `#3e2731`    | RGB  | Secondary label           | Implemented |
| disabled.fill         | ngrey `#a4a4a4`   | RGB  | Disabled text-button face | Implemented |
| disabled.text         | ndslate `#4a4a4a` | RGB  | Disabled label            | Implemented |
| icon.surface          | navy `#262b44`    | RGB  | Icon face                 | Implemented |
| selected.border       | amber `#feae34`   | RGB  | Picked-item frame         | Implemented |
| selected.fill         | yellow `#fee761`  | RGB  | Picked-item face          | Implemented |

Palette names and ramps come from [`shared/palette.json`](../shared/palette.json) and [`src/ui/palette.ts`](../src/ui/palette.ts). Shared geometry is centralized by [`buttonGeometry.ts`](../src/ui/buttonGeometry.ts). Caller layouts remain in [`screenLayout.ts`](../src/layout/screenLayout.ts), [`homeLayout.ts`](../src/home/homeLayout.ts), [`endLayout.ts`](../src/home/endLayout.ts) and [`closeControl.ts`](../src/ui/closeControl.ts). A shared token being implemented does not certify every caller or deployment; verify the affected caller as part of integration.

## Sizing and spacing

| Name            | Value         | Unit    | Purpose                                      | Status                                           |
| --------------- | ------------- | ------- | -------------------------------------------- | ------------------------------------------------ |
| compact.height  | 44            | px      | Text-button target height                    | Implemented; approved target                     |
| compact.width   | 128           | px      | Compact text button                          | Implemented; approved target                     |
| end.button.y    | 514           | px      | Back to title top; preserves the badge panel | Implemented; approved to retain                  |
| icon.face       | 20×20         | px      | Navy chrome face                             | Implemented                                      |
| icon.glyph      | 16×16         | px      | Chrome glyph                                 | Implemented                                      |
| icon.hit        | 44×44         | px      | Non-bar icon target                          | Implemented shared target; compact-bar exception |
| label.help.gap  | 10            | px      | Clear ink gap between label and help text    | Implemented                                      |
| menu.text.scale | 2             | scale   | Shared TEXT_SCALE menu-label role            | Implemented                                      |
| pair.gap        | 12            | px      | Gap between compact buttons                  | Implemented; approved target                     |
| press.offset    | 2             | px      | Face, glyph and label depression             | Implemented                                      |
| start.button    | 32,510,296,44 | x,y,w,h | Inset Start walk                             | Implemented; approved target                     |
| topbar.hit      | 34×44         | px      | Explicit crowded-bar exception               | Implemented; approved to retain                  |
| wide.height     | 44            | px      | Wide text-button height                      | Implemented                                      |
| wide.width      | 296           | px      | Wide text button                             | Implemented; approved target                     |

Use the wide token for a screen or modal's main text action and the compact token for secondary or paired text actions. Paired controls use `pair.gap`. Preserve the same text size; grow the available room, wrap where the role allows, or change wording in the text data when necessary.

Start walk has 32px side margins, about 4px above and 6px below. Back to title keeps its approved `end.button.y` and existing bob; the end background is unchanged. Icon artwork stays centred in its target. The visible icon face and the hit target are separate rectangles.

The start-screen section outline is one plum pixel. Keep the existing `ui-section` nine-slice caps: left/right 3px, top 24px, bottom 3px. Fill section backing to a 1px inset. Solid backing and distinct neutral headings use the approved treatment:

| Section | Backing         | Neutral heading  | Neutral title | Neutral note |
| ------- | --------------- | ---------------- | ------------- | ------------ |
| Dogs    | plum `#3e2731`  | purple `#68386c` | cream         | amber        |
| Pocket  | blue `#124e89`  | sky `#0099db`    | ink           | ink          |
| Walker  | brown `#b86f50` | dbrown `#733e39` | cream         | amber        |

A complete section has an amber heading and ink title/note. Dogs show their count even while empty. The empty Pocket uses its existing note, and is optional; Start walk requires a walker and at least one dog. Individual item cards retain their detailed borders and checkmarks. Ground outside them stays clean, without fabric, stitching or extra selected-dog lines.

## Button roles and states

Role and state are independent. Primary is a role, pressed is a transient state, and selected belongs to selection controls. The code's `normal` button look renders as the secondary cream role.

| Role/state         | Fill                                | Label/icon                            | Border and highlight              | Geometry                          | Status                                 |
| ------------------ | ----------------------------------- | ------------------------------------- | --------------------------------- | --------------------------------- | -------------------------------------- |
| Primary/Normal     | green                               | ink                                   | ink outline, forest lip           | Wide or compact                   | Implemented primitive; shared geometry |
| Primary/Pressed    | green                               | ink                                   | Same outline; face sinks into lip | Same target; `press.offset`       | Implemented primitive; shared geometry |
| Primary/Disabled   | ngrey                               | ndslate                               | ink outline; flat, no lip         | Same target; fixed pressed depth  | Implemented primitive; shared geometry |
| Secondary/Normal   | cream                               | plum                                  | ink outline, tan lip              | Wide or compact                   | Implemented primitive; shared geometry |
| Secondary/Pressed  | cream                               | plum                                  | Same outline; face sinks into lip | Same target; `press.offset`       | Implemented primitive; shared geometry |
| Secondary/Disabled | ngrey                               | ndslate                               | ink outline; flat, no lip         | Same target; fixed pressed depth  | Implemented primitive; shared geometry |
| Icon/Normal        | navy                                | cream/tan or the asset's action glyph | tan rim, brown lip                | Icon face/glyph/hit tokens        | Implemented; compact-bar exception     |
| Icon/Pressed       | navy                                | Same glyph                            | Same rim; face sinks into lip     | Same target; `press.offset`       | Implemented; compact-bar exception     |
| Icon/Disabled      | Not a generic exported chrome state | No generic contract                   | No disabled `ui-icon-button` tag  | Not implemented as a shared state | Not implemented                        |

Text-button chrome and disabled rendering are implemented in [`selection.ts`](../src/ui/selection.ts) and [`uiKit.ts`](../src/scenes/uiKit.ts). One primary action identifies the main next step. The approved update notice is modal; it does not add a second green action beside Start walk. The loading label change to the approved shorter wording belongs to the text data.

## Labels and icons

Use `font-title` for buttons, headings and numbers, and `font-body` for body/help text. [`textFit.ts`](../src/ui/textFit.ts) fixes role scales: never shrink a label to fit. Keep the label/help ink gap, centre an action label on its face, and move the label with the pressed face.

All player-facing strings, including names, labels, prices, goals, unavailable reasons and explanations, come from the text data in [`src/data/`](../src/data/). Follow the rulebook's [Voice](../gameplay/design.md#voice): Canadian spelling and one consistent name and label per thing. Reword the data consistently or grow the box; never shrink text or use a local shortened alias.

A chrome glyph sits at +2,+1 inside `ui-icon-button`, or +2,+3 while pressed. Settings, Exit and Home retain their established shapes. Content icons use their outlined art; chrome glyphs use their flat cream/tan palette. A gear item keeps its colours at every exported size.

Disabled pictures use the existing neutral-grey copy and nslate art box. An affordable, unowned item keeps its full-colour picture on nlgrey, with a bill and buy plate. A short item uses a padlock and short-price plate; a goal-locked walker uses the goal plate. Labels, badges and plate shapes supplement colour. A selected picture uses its existing deepAmber box; unselected owned pictures use tan.

Unavailable controls keep their readable price, goal or reason and the existing feedback. A full pack reports that it is full; a goal-locked walker shakes and explains its goal; an unowned item retains its shop action; an incomplete Start walk keeps its missing-choice feedback. A grey face does not erase these distinctions or make every unavailable tile inert.

## Selection controls

These are canvas controls. Checkbox-like and radio-like describe their game semantics; they are not native HTML widgets.

| Control                                    | Value semantics                                                                             | States                                                                              | Drawn size                          | Label and placement                                        | Press area                              | Keyboard                                                             | Status                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- | -------------------------- |
| Dog tile, checkbox-like                    | Multiple owned dogs up to pack capacity; tap a picked dog to remove it; one-slot packs swap | Normal, selected, disabled; bill/lock/goal availability is separate; no mixed state | `ui-tile` nine-slice, face and name | Dog name; price where unowned                              | Existing 105×44 grid cell               | Arrows move focus; Enter/Space activates                             | Implemented canvas control |
| Pocket tile, optional exclusive selection  | Zero or one owned item; selecting another replaces it; selecting it again clears it         | Normal, selected, disabled; no mixed state                                          | `ui-tile` with existing gear icon   | Section note names the chosen item or shows the empty note | Existing 60×44 grid cell                | Arrows move focus; Enter/Space activates                             | Implemented canvas control |
| Walker tile, clearable exclusive selection | Zero or one owned walker; a second activation clears it; empty prevents starting            | Normal, selected, disabled/goal-locked                                              | Existing portrait/perk tile         | Walker name and locked goal                                | Existing 77×44 grid cell                | Arrows move focus; Enter/Space activates; arrows alone do not select | Implemented canvas control |
| Settings switch                            | Sound and reduced motion change and save immediately                                        | On/off with knob side plus tick/cross; no mixed or generic disabled switch tag      | Existing 32×16 `ui-switch`          | Whole row includes title, note and matching on/off icon    | Whole measured settings row, 328px wide | Up/Down focuses row; Enter/Space toggles                             | Implemented canvas control |

Walkers, dogs and Pocket items share the same pick toggle: activating a picked item again clears it. The Pocket is optional; a walker and at least one dog are required to start. Keep picked, available, for-sale, goal-locked and pack-full states plainly distinct through the picture, readable label/plate, badge and feedback. The picked state uses both a gold frame and a checkmark, so selection never relies on colour alone.

The switch's `on` tag means sound is enabled for the sound row and reduced motion is enabled for the motion row. Volume controls are sliders, not switches: drag the row, or use Left/Right, Home and End while focused; muted sliders are disabled.

Gold frame/face and `ui-check` identify picked items. Selected tabs retain their selected frame and lift without a check badge; their `ui-select` holds its first frame and does not pulse. Generic selected controls use the existing lift/shadow feedback; the approved start-screen card treatment keeps the ground outside the individual cards clear. A pack-full tile and an unowned tile can share a grey face while retaining different actions: an unowned item can open the shop, while a full pack requires a dog to be removed first.

The active shop row uses `ui-shop-focus`: a 3px cyan band between 1px ink keylines, with cream corner marks alternating between 12px and 7px every 600ms. This focus frame does not indicate ownership or affordability. Keep the row's lock, grey appearance, price and unavailable feedback unchanged. Draw it at the existing 3px outset; reduced motion holds the longer first phase.

Source contracts: [`interaction.ts`](../src/ui/interaction.ts), [`home.ts`](../src/home/home.ts), [`walkers.ts`](../src/home/walkers.ts), [`sections.ts`](../src/home/sections.ts) and [`SettingsScene.ts`](../src/scenes/SettingsScene.ts).

## Interaction and accessibility

- Show press feedback at once: `fx-tap` bursts under the finger. A modal opened by the press opens immediately, and the burst finishes on top of it. Text and chrome move together, and a cancelled press does not activate its former target.
- Keep keyboard focus distinct from selection. Start-screen arrow keys move the visible focus ring; Enter or Space activates. Settings use the row focus described above. These are custom canvas handlers, not a native Tab sequence.
- Escape or P closes the current overlay/pause level; M toggles sound. Retain the existing context-specific shortcuts and browser-back behaviour in [`keyBindings.ts`](../src/input/keyBindings.ts).
- UI tap actions activate on release over the matching target. A recognized hold opens details or enlarges a card, and its release must not also toggle or choose. Do not require hover for information; preserve the bespoke steering exception above.
- Preserve modal tap guards. A tap that dismisses a panel is consumed: it must not select, buy, steer or activate content underneath. The top bar retains only its deliberate actions under the rulebook's panel conventions. Choice cards wait for an explicit choice; outside taps do nothing.
- Retain the existing keyboard bindings and default choices. In confirmations, key 1 keeps the walk going or keeps playing, as the rulebook defines; it must not become the destructive alternative. This does not turn choice-card key 1 into an automatic or default choice.
- Essential labels hold 4.5:1 contrast, or 3:1 at 2× and larger; essential icons hold 3:1. Inactive controls retain their existing exemption. State also uses text, glyphs, shape or position.
- Reduced motion preserves visible selection and readable static feedback while skipping movement. Sound is supplementary; it cannot be the sole action/state cue.

The game shell supplies an accessible game label and control instructions. Individual canvas buttons, tiles and switches do not currently expose native DOM roles, checked state, indeterminate state or per-control ARIA semantics. Keyboard support does not imply those capabilities are implemented.

## Asset and code contract

| Asset                   | Role/state tags                                                                                      | Contract                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `ui-afford`             | `glint`                                                                                              | Draw 2px outside the Pet shop building only; no item tile or shop row uses it |
| `ui-button`             | `go`, `go-pressed`, `go-disabled`; `secondary`, `secondary-pressed`; `normal`, `pressed`, `disabled` | 24×24 nine-slice; 3px top/sides, 5px bottom; secondary aliases normal chrome  |
| `ui-check`, `ui-select` | Existing count/tick and selection tags                                                               | Preserve item-card details; state is not inferred from colour alone           |
| `ui-icon-button`        | `normal`, `pressed`                                                                                  | Icon face token; the existing glyph is a separate image                       |
| `ui-section`            | `complete` 0, `neutral` 1, `neutral-walker` 2, `neutral-dogs` 3, `neutral-pocket` 4                  | 24×32; one still frame per tag, 1000ms; fallback `neutral` uses dog purple    |
| `ui-shop-focus`         | `pulse`: two 600ms frames; 32×32 nine-slice with 13px caps on every side                             | Active shop row only; 3px outset; reduced motion holds frame 0                |
| `ui-switch`             | `on`, `off`                                                                                          | Preserve 32×16 visual, knob position and tick/cross                           |

The `ui-section` exports and `HOME_LAYOUT.sectionLooks` use the same section tags and colours. Existing `ui-cork`, `ui-plaid` and `ui-denim` keys are retained as solid backing exports; runtime stops the fabric/stitch treatment. The start-screen backdrop preserves the hero through row 195, has quiet ground on rows 196–197, a continuous plum divider on row 198 and flat dbrown below it.

Edit generators in [`art/tools/ui.py`](tools/ui.py) and [`art/tools/screens.py`](tools/screens.py), then regenerate their owned exports. [`uiKit.ts`](../src/scenes/uiKit.ts) maps roles to art tags and supplies matching code fallbacks; [`buttonGeometry.ts`](../src/ui/buttonGeometry.ts) owns common sizing, gaps and press offsets. [`pauseMenu.ts`](../src/hud/pauseMenu.ts) and [`purchaseConfirmLayout.ts`](../src/home/purchaseConfirmLayout.ts) are button-layout callers. Layout, hit areas and input belong to their source owners; player wording lives in the text data. Do not bake new control text into art or add a special button shape for a single caller without an approved exception.

## Review checklist

- Check the control's role, semantic state and availability separately, including its readable price, goal or unavailable reason.
- Use an approved geometry token or document a concrete exception; verify non-overlapping hit areas.
- Check text at its full role size, including the longest label and the disabled state; verify canonical player wording and Canadian spelling in the text data.
- Check normal, pressed, disabled, selected and keyboard-focus feedback where each is implemented; do not invent absent states. Verify gold frame plus checkmark and the shared pick-again-to-clear behaviour.
- Check tap release, hold/detail separation, consumed modal dismissals and existing safe continuation defaults.
- Check the same control by touch/pointer, keyboard and reduced motion; test only the changed behaviour locally, with the combined gate owned by the release process.
- Show one- or two-item visual changes in context before committing; large batches may use a grouped review.
- Match generator output, code fallback, source layout and this guide before describing a target as implemented. Confirm deployment separately.

## Open decisions

No open design decision is recorded for the approved start-screen and button standard. The compact top-bar exception, retained end-button position, modal update notice and shorter loading wording are approved. Deployment verification remains separate.

Native per-control accessibility semantics and additional selection states are not implemented or authorized by this guide. New proposals require a separate decision before implementation.
