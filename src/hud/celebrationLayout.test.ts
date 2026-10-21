import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { fittingText, type TextFitStyle } from "../layout/textFit";
import { fontFileMetrics, inkWidth } from "../testing/fontInk";
import { plainMarks } from "../ui/pixelFont";
import { CELEBRATION_LAYOUT as LAYOUT, GREETING_FIT, greetingLineTops } from "./celebrationLayout";

// Each version's big line, upper-cased in font-display as addDisplayText draws it.
describe("the celebration's title", () => {
  it("sets each version's title on one line inside the title room", () => {
    const width = (style: TextFitStyle, line: string) => inkWidth("font-display", style, line);
    const { newWalker, zoneDone } = gameData.runText;
    const misfits = [newWalker.title, zoneDone.title].filter((title) => {
      const shown = plainMarks(title).toUpperCase();
      const { lines, style } = fittingText(LAYOUT.titleStyles, width, LAYOUT.titleRoom, shown);
      return lines.length !== 1 || lines[0] !== shown || width(style, shown) > LAYOUT.titleRoom;
    });
    expect(misfits).toEqual([]);
  });
});

// Every walker's greeting fits the bubble's lines, none left out, its last line's lowest ink
// over the dotted rule.
describe("a new walker's greeting", () => {
  it("holds every walker's greeting over the rule", () => {
    const body = fontFileMetrics("font-body");
    const width = (style: TextFitStyle, line: string) => inkWidth("font-body", style, line);
    const { room, styles } = GREETING_FIT;
    const misfits = Object.values(gameData.walkers)
      .map(({ greeting }) => greeting)
      .filter((text) => {
        const { lines, style } = fittingText(styles, width, room, plainMarks(text));
        const last = greetingLineTops(body, style.scale, lines.length).at(-1) ?? 0;
        return (
          lines.length > (style.lines ?? 1) ||
          lines.join(" ") !== plainMarks(text).split(/\s+/).join(" ") ||
          lines.some((line) => width(style, line) > room) ||
          last + body.inkBottom * style.scale >= LAYOUT.newWalker.rule.y
        );
      });
    expect(misfits).toEqual([]);
  });
});
