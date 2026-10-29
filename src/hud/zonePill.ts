import type { Rect } from "@andornaut/game-kit/rect";

import { debuffBarRects } from "./walkHud";

// The neighbourhood pill (ui-zone-pill, a three-slice with 4px ends): the zone's name and its
// place in the walk ("n of N"), in the body font at 1x, centred across the screen gap rows under
// the walk bar, or under the last debuff bar while any is up, height rows tall. The name inks
// in cream from pad columns in, the count in light grey ends its ink pad columns before the
// pill's right edge, textGap columns between their inks, and both put their capitals on row
// capsY. It takes no presses, and the message strip draws over it.
export const ZONE_PILL = {
  capsY: 4,
  gap: 4,
  height: 13,
  key: "ui-zone-pill",
  pad: 6,
  textGap: 8,
} as const;

// Where the pill and its texts go: the pill, the left edge of the name's ink, the column past
// the count's ink, and the row their capitals start on.
export interface ZonePillLayout {
  readonly capsY: number;
  readonly countRight: number;
  readonly nameLeft: number;
  readonly pill: Rect;
}

// The pill for a name nameInk columns wide and a count countInk wide, under bar and debuffs
// debuff bars, centred across screen (a half column rounded left).
export function zonePillLayout(
  bar: Rect,
  screen: Rect,
  debuffs: number,
  ink: { readonly count: number; readonly name: number },
): ZonePillLayout {
  const { capsY, gap, height, pad, textGap } = ZONE_PILL;
  const above = debuffBarRects(bar, debuffs).at(-1) ?? bar;
  const width = pad + ink.name + textGap + ink.count + pad;
  const pill = {
    height,
    width,
    x: screen.x + Math.floor((screen.width - width) / 2),
    y: above.y + above.height + gap,
  };
  return {
    capsY: pill.y + capsY,
    countRight: pill.x + width - pad,
    nameLeft: pill.x + pad,
    pill,
  };
}

// The widest a name's ink can be beside a count countInk wide, the pill inside screen.
export function zonePillNameRoom(screen: Rect, countInk: number): number {
  const { pad, textGap } = ZONE_PILL;
  return screen.width - 2 * pad - textGap - countInk;
}
