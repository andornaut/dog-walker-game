import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { CARD_LAYOUT, plaqueRoom } from "../layout/cardLayout";
import { hasPlaque, type OptionView } from "../rules/choices";
import { everyCardOption } from "../testing/everyCardOption";
import { fontFileMetrics, inkWidth } from "../testing/fontInk";
import { inkRowsOfLines } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import type { TextFitStyle } from "../ui/textFit";
import { type PlaqueSize, plaqueTexts, smallCardText } from "./cardText";

const BODY = fontFileMetrics("font-body");
const ONE: TextFitStyle = { scale: 1 };
const body = (text: string) => plainMarks(text);
const title = (text: string) => plainMarks(text).toUpperCase();

const CASES = everyCardOption();
const firesOf = (option: OptionView | undefined) =>
  option === undefined || option.fires.length === 0 ? null : option.fires;
const bodyWidth = (style: TextFitStyle, line: string) => inkWidth("font-body", style, body(line));

// The names of the cards that fitsOn rejects.
const misfits = (fitsOn: (option: OptionView | undefined) => boolean) =>
  CASES.filter(([, option]) => !fitsOn(option)).map(([name]) => name);

describe("every card the data can deal", () => {
  it("fits its band label in the body font at 1x, small and enlarged", () => {
    const room = Math.min(CARD_LAYOUT.band.room, CARD_LAYOUT.large.band.room);
    expect(
      misfits((option) => {
        const label = option?.label ?? gameData.runText.card.skip;
        return inkWidth("font-body", ONE, body(label)) <= room;
      }),
    ).toEqual([]);
  });

  // The warning ends on the effect box's foot, where it shows (every effect and warning fits its
  // box: ui/textRoles.test.ts).
  it("sets its firing warning's lowest ink on the effect box's foot", () => {
    const { effect: area } = CARD_LAYOUT;
    expect(
      misfits((option) => {
        const { box, warning } = smallCardText(gameData, BODY, bodyWidth, option);
        return (
          warning === null ||
          box.warningY + inkRowsOfLines(BODY, warning.lines.length) === area.y + area.height
        );
      }),
    ).toEqual([]);
  });

  it("fits a plaque text in the plaque beside any fires marker, small and enlarged", () => {
    const { badge, fires: marker, large } = CARD_LAYOUT;
    expect(
      misfits((option) => {
        if (!hasPlaque(option)) {
          return true;
        }
        const fired = firesOf(option) !== null;
        const small = plaqueRoom(badge.x, badge.width, fired ? marker.x + marker.size : undefined);
        const enlarged = plaqueRoom(
          large.badge.x,
          large.badge.width,
          fired ? large.fires.x + 2 * marker.size : undefined,
        );
        const narrowest = (size: PlaqueSize) =>
          Math.min(
            ...plaqueTexts(gameData, size, option).map((text) =>
              inkWidth("font-title", ONE, title(text)),
            ),
          );
        return narrowest("small") <= small && narrowest("enlarged") <= enlarged;
      }),
    ).toEqual([]);
  });
});
