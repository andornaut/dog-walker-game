import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_LAYOUT } from "../data/screen";
import type { WalkerId } from "../data/types";
import { keysOf } from "../lib/records";
import { bodyRunWidth } from "../testing/bodyFont";
import { fontFileMetrics, inkWidth } from "../testing/fontInk";
import { decodePng } from "../testing/png";
import { inside } from "../testing/rects";
import { plainMarks } from "../ui/pixelFont";
import { fitsRoom, fittingText, TEXT_SCALE, type TextFitStyle } from "../ui/textFit";
import {
  CELEBRATION_LAYOUT as LAYOUT,
  GREETING_FIT,
  greetingLineTops,
  infoItems,
  laidInfoLine,
  newWalkerRows,
} from "./celebrationLayout";
import { celebrationText } from "./zoneCelebration";

// Each version's big line, in font-display at its scale (every title fits the title room:
// ui/textRoles.test.ts).
describe("the celebration's title", () => {
  // The display font's capitals carry their outline and shadow in their rows.
  it.each(["newWalker", "zoneDone"] as const)(
    "keeps the %s title's outline 6 rows clear of the subtitle's",
    (version) => {
      const { capHeight, capTop } = fontFileMetrics("font-display");
      const { subtitleY, titleY } = LAYOUT[version];
      const titleBottom = titleY + (capTop + capHeight) * LAYOUT.titleScale;
      expect(subtitleY + capTop - titleBottom).toBeGreaterThanOrEqual(6);
    },
  );
});

// Each walker's bubble, laid out from their greeting and info lines as the scene lays it out.
describe("a new walker's bubble", () => {
  const body = fontFileMetrics("font-body");
  const width = (style: TextFitStyle, line: string) => inkWidth("font-body", style, line);
  const { newWalker } = LAYOUT;
  const iconSize = (key: string) => decodePng(readFileSync(`public/art/images/${key}.png`));
  const bubbleOf = (walker: WalkerId) => {
    const shown = celebrationText(gameData, { kind: "newWalker", walker });
    if (shown.kind !== "newWalker") {
      throw new Error("a new walker's text");
    }
    const greeting = plainMarks(shown.greeting);
    const fitted = fittingText(GREETING_FIT.style, width, GREETING_FIT.room, greeting);
    return {
      fitted,
      greeting,
      info: shown.info,
      rows: newWalkerRows(body, shown.info.length, fitted),
    };
  };
  const walkers = keysOf(gameData.walkers);

  // The greeting fits the bubble's lines, none left out, its last line's lowest ink over the
  // dotted rule, and the rule over the first info line's capitals.
  it.each(walkers)("holds %s's greeting between the bubble's top and the rule", (walker) => {
    const { fitted, greeting, rows } = bubbleOf(walker);
    const { lines, style } = fitted;
    const last = greetingLineTops(body, style.scale, lines.length).at(-1) ?? 0;
    expect(fitsRoom(width, GREETING_FIT.room, fitted)).toBe(true);
    expect(lines.join(" ")).toBe(greeting.split(/\s+/).join(" "));
    expect(last + body.inkBottom * style.scale).toBeLessThan(rows.rule.y);
    expect(rows.info[0]?.y ?? 0).toBeGreaterThan(rows.rule.y);
  });

  // Each info line, as Phaser measures its words and the icon's width, inside the room within
  // the bubble's rim, and its lowest ink 4 rows over the bubble's bottom.
  it.each(walkers)("sets each of %s's info lines inside the bubble", (walker) => {
    const { info, rows } = bubbleOf(walker);
    const bottom = rows.bubble.y + rows.bubble.height - 4;
    expect(rows.info).toHaveLength(info.length);
    info.forEach((parts, i) => {
      const items = infoItems(parts);
      const { width: lineWidth } = laidInfoLine(
        (item) =>
          item.kind === "icon"
            ? iconSize(item.icon).width
            : bodyRunWidth({ scale: TEXT_SCALE }, item.text),
        items,
      );
      const row = rows.info[i] ?? { iconY: 0, y: 0 };
      const lowest = Math.max(
        row.y + body.inkBottom * TEXT_SCALE,
        ...items.map((item) => (item.kind === "icon" ? row.iconY + iconSize(item.icon).height : 0)),
      );
      expect(lineWidth).toBeLessThanOrEqual(newWalker.info.maxWidth);
      expect(LAYOUT.centreX - lineWidth / 2).toBeGreaterThanOrEqual(rows.bubble.x);
      expect(lowest).toBeLessThanOrEqual(bottom);
    });
  });

  // The button under the bubble, inside the dimmed area, so clear of the dog row under it.
  it.each(walkers)("puts %s's button under the bubble, over the dog row", (walker) => {
    const { rows } = bubbleOf(walker);
    expect(rows.button.y).toBeGreaterThan(rows.bubble.y + rows.bubble.height);
    expect(inside(rows.button, LAYOUT.dim)).toBe(true);
    expect(rows.button.y + rows.button.height).toBeLessThanOrEqual(SCREEN_LAYOUT.dogRow.y);
  });
});
