import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_LAYOUT } from "../data/screen";
import { keysOf } from "../lib/records";
import { fontInk } from "../testing/fontInk";
import { inside } from "../testing/rects";
import { debuffBarRects, zoneProgressText } from "./walkHud";
import { ZONE_PILL, zonePillLayout } from "./zonePill";

const { screen, topBar } = SCREEN_LAYOUT;
const inkOf = (text: string) => {
  const ink = fontInk("font-body", { scale: 1 }, text);
  return ink.right - ink.left;
};

// Every neighbourhood's name beside each count a walk shows.
const ZONES = gameData.world.zones.flatMap((zone) =>
  gameData.world.zones.map((_, i) => {
    const count = zoneProgressText(gameData, i);
    return [zone.name, count, { count: inkOf(count), name: inkOf(zone.name) }] as const;
  }),
);

describe("zonePillLayout", () => {
  it.each(ZONES)("fits %j and %j inside the screen, centred, padded and apart", (_n, _c, ink) => {
    const { capsY, countRight, nameLeft, pill } = zonePillLayout(topBar, screen, 0, ink);
    const { pad, textGap } = ZONE_PILL;
    expect(inside(pill, screen)).toBe(true);
    const left = pill.x - screen.x;
    const right = screen.x + screen.width - (pill.x + pill.width);
    expect(right - left).toBeGreaterThanOrEqual(0);
    expect(right - left).toBeLessThanOrEqual(1);
    expect(nameLeft - pill.x).toBe(pad);
    expect(pill.x + pill.width - countRight).toBe(pad);
    expect(countRight - ink.count - (nameLeft + ink.name)).toBe(textGap);
    expect(capsY - pill.y).toBe(ZONE_PILL.capsY);
  });

  // No debuff up, and each count of debuff bars up to every debuff at once.
  const counts = Array.from({ length: keysOf(gameData.debuffs).length + 1 }, (_, i) => i);
  it.each(counts)("hangs the pill gap rows under the walk bar and %i debuff bars", (debuffs) => {
    const ink = { count: 20, name: 40 };
    const { pill } = zonePillLayout(topBar, screen, debuffs, ink);
    const above = debuffBarRects(topBar, debuffs).at(-1) ?? topBar;
    expect(pill.y).toBe(above.y + above.height + ZONE_PILL.gap);
    expect(pill.height).toBe(ZONE_PILL.height);
  });
});
