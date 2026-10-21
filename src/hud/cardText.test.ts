import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, EncounterId, UpgradeId, ZoneId } from "../data/types";
import { boxStyles, CARD_LAYOUT, FIRES_FIT, largeBodyBox, plaqueRoom } from "../layout/cardLayout";
import type { TextFitStyle } from "../layout/textFit";
import { cardFor, firesText, hasPlaque, type OptionView } from "../rules/choices";
import { cents } from "../rules/units";
import { fitInFont, fontFileMetrics, inkWidth } from "../testing/fontInk";
import { testState } from "../testing/runState";
import { inkRowsOfLines } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import { largeBodyText, plaqueTexts, smallCardText } from "./cardText";

const BODY = fontFileMetrics("font-body");
const TITLE = fontFileMetrics("font-title");
const ONE: TextFitStyle = { letterSpacing: 0, scale: 1 };
const body = (text: string) => plainMarks(text);
const title = (text: string) => plainMarks(text).toUpperCase();

// Every card option the data can deal: each encounter's card for each dog alone and for the
// three longest-named dogs together, on their last heart (so options fire them) and on five,
// with the bank full and empty; and each zone's path card with each upgrade.
function everyOption(): OptionView[] {
  const dogs = Object.keys(gameData.dogs) as DogId[];
  const longest = [...dogs]
    .sort((a, b) => gameData.dogs[b].name.length - gameData.dogs[a].name.length)
    .slice(0, 3);
  const packs = [...dogs.map((dog) => [dog]), longest];
  const states = packs.flatMap((pack) =>
    [1, 5].flatMap((hearts) =>
      [0, 10_000].map((money) =>
        testState(Object.fromEntries(pack.map((dog) => [dog, hearts])), { money: cents(money) }),
      ),
    ),
  );
  const encounters = (Object.keys(gameData.encounters) as EncounterId[]).filter(
    (id) => gameData.encounters[id].resolution.kind === "card",
  );
  const zones = gameData.world.zones.map(({ id }) => id as ZoneId);
  const upgrades = Object.keys(gameData.upgrades) as UpgradeId[];
  const first = states[0] ?? testState({ koda: 5 });
  return [
    ...states.flatMap((state) =>
      encounters.flatMap(
        (encounter) =>
          cardFor(gameData, state, {
            affected: state.pack.map(({ dog }) => dog),
            encounter,
            kind: "encounter",
          }).options,
      ),
    ),
    ...zones.flatMap((zone) =>
      upgrades.flatMap(
        (upgrade) =>
          cardFor(gameData, first, { kind: "fork", paths: [zone], upgrades: [upgrade] }).options,
      ),
    ),
  ];
}

// Each option once, by what its card shows, and Skip.
const OPTIONS = [
  ...new Map(
    everyOption().map((option) => [
      JSON.stringify([option.label, option.text, option.fires, largeBodyText(gameData, option)]),
      option,
    ]),
  ).values(),
];
const CASES: [string, OptionView | undefined][] = [
  ["Skip", undefined],
  ...OPTIONS.map((option): [string, OptionView] => [`${option.label}: ${option.text}`, option]),
];
const firesOf = (option: OptionView | undefined) =>
  option === undefined || option.fires.length === 0 ? null : option.fires;
const bodyWidth = (style: TextFitStyle, line: string) => inkWidth("font-body", style, body(line));

// Whether a text set in a font in the first of styles that fits room keeps within its lines
// and its room.
function fits(font: string, styles: readonly TextFitStyle[], room: number, text: string) {
  const fitted = fitInFont(font, styles, room, text);
  return (
    styles.length > 0 && fitted.lines.length <= (fitted.style.lines ?? 1) && fitted.widest <= room
  );
}

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

  // The effect fits its box, under a path card's paws and over the warning where it shows; the
  // warning shows where the effect still fits over it. Every option's whole effect shows, a path
  // card's upgrade line included.
  it("fits its firing warning and its whole effect in the effect box", () => {
    const { effect: area, warningGap } = CARD_LAYOUT;
    expect(
      misfits((option) => {
        const { box, effect, warning } = smallCardText(gameData, BODY, bodyWidth, option);
        const full = option?.text ?? gameData.runText.card.skipEffect;
        const fitted = warning === null ? [effect] : [effect, warning];
        const effectBottom = box.y + inkRowsOfLines(BODY, effect.lines.length) * effect.style.scale;
        const foot = warning === null ? area.y + area.height : box.warningY - warningGap;
        return (
          effect.lines.join(" ") === full.split(/\s+/).join(" ") &&
          fitted.every(
            ({ lines, style }) =>
              lines.length <= (style.lines ?? 1) &&
              lines.every((line) => bodyWidth(style, line) <= area.width),
          ) &&
          effectBottom <= foot &&
          (warning === null ||
            box.warningY + inkRowsOfLines(BODY, warning.lines.length) === area.y + area.height)
        );
      }),
    ).toEqual([]);
  });

  it("fits its firing warning and its changes in the enlarged card's body", () => {
    const { large } = CARD_LAYOUT;
    const { room, styles } = FIRES_FIT.large;
    expect(
      misfits((option) => {
        const fires = firesOf(option);
        const warning = fires === null ? null : title(firesText(gameData, fires));
        const lines = warning === null ? 0 : fitInFont("font-title", styles, room, warning).lines;
        const box = largeBodyBox(TITLE, typeof lines === "number" ? lines : lines.length);
        const text = body(largeBodyText(gameData, option));
        return (
          (warning === null || fits("font-title", styles, room, warning)) &&
          fits("font-body", boxStyles(BODY, box.height), large.body.width, text)
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
        return narrowest <= Math.min(small, enlarged);
      }),
    ).toEqual([]);
  });
});
