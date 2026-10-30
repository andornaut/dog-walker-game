import { keysOf } from "@andornaut/game-kit/records";
import { inkRowsOfLines } from "@andornaut/game-kit/text/bitmapFont";
import { fitsRoom, type TextFitStyle } from "@andornaut/game-kit/text/textFit";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { ZoneId } from "../data/types";
import { CARD_LAYOUT, cardEffectArea, plaqueRoom } from "../layout/cardLayout";
import { cardFor, hasPlaque, type OptionView } from "../rules/choices";
import { defined } from "../testing/defined";
import { everyCardOption } from "../testing/everyCardOption";
import { fontFileMetrics, inkWidth } from "../testing/fontInk";
import { testState } from "../testing/runState";
import { plainMarks } from "../ui/pixelFont";
import { plaqueTexts, smallCardText } from "./cardText";
import { withNamePills } from "./effectNames";

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
    const area = cardEffectArea(BODY, true);
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
        const narrowest = Math.min(
          ...plaqueTexts(gameData, option).map((text) => inkWidth("font-title", ONE, title(text))),
        );
        return narrowest <= small && narrowest <= enlarged;
      }),
    ).toEqual([]);
  });
});

// Any fork may offer any upgrade not yet picked, so each one's path card says what it does
// (each fits its box: ui/textRoles.test.ts).
describe("a path card", () => {
  const zone = defined(gameData.world.zones[0]).id as ZoneId;
  it.each(keysOf(gameData.upgrades))(
    "carrying %s shows the upgrade's name in its pill over its cardEffect on the small card",
    (upgrade) => {
      const { cardEffect: line, name } = gameData.upgrades[upgrade];
      expect(line.trim()).not.toBe("");
      const option = defined(
        cardFor(gameData, testState({ kilo: 5 }), {
          kind: "fork",
          paths: [zone],
          upgrades: [upgrade],
        }).options[0],
      );
      const { effect } = smallCardText(gameData, BODY, bodyWidth, option);
      expect(effect.lines.join(" ")).toBe(withNamePills(gameData, `${name}: ${line}`));
      expect(fitsRoom(bodyWidth, CARD_LAYOUT.effect.width, effect)).toBe(true);
    },
  );
});
