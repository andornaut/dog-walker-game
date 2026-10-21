import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, EncounterId, UpgradeId, ZoneId } from "../data/types";
import { boxStyles, CARD_LAYOUT, FIRES_FIT, largeBodyBox, plaqueRoom } from "../layout/cardLayout";
import type { TextFitStyle } from "../layout/textFit";
import { cardFor, firesText, type OptionView } from "../rules/choices";
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

// A text set in a font in the first of styles that fits room, every line within its lines.
function expectFits(font: string, styles: readonly TextFitStyle[], room: number, text: string) {
  expect(styles.length).toBeGreaterThan(0);
  const fitted = fitInFont(font, styles, room, text);
  expect(fitted.lines.length).toBeLessThanOrEqual(fitted.style.lines ?? 1);
  expect(fitted.widest).toBeLessThanOrEqual(room);
  return fitted;
}

describe.each(CASES)("the card for %s", (_, option) => {
  const label = option?.label ?? gameData.runText.card.skip;
  const fires = option === undefined || option.fires.length === 0 ? null : option.fires;

  it("fits its band label in the body font at 1x, small and enlarged", () => {
    expect(inkWidth("font-body", ONE, body(label))).toBeLessThanOrEqual(CARD_LAYOUT.band.room);
    expect(inkWidth("font-body", ONE, body(label))).toBeLessThanOrEqual(
      CARD_LAYOUT.large.band.room,
    );
  });

  // The effect fits its box, under a path card's paws and over the warning where it shows; the
  // warning shows where the effect still fits over it.
  it("fits its firing warning and its effect in the effect box", () => {
    const width = (style: TextFitStyle, line: string) => inkWidth("font-body", style, body(line));
    const { box, effect, warning } = smallCardText(gameData, BODY, width, option);
    const { effect: area, warningGap } = CARD_LAYOUT;
    const room = area.width;
    for (const fitted of warning === null ? [effect] : [effect, warning]) {
      expect(fitted.lines.length).toBeLessThanOrEqual(fitted.style.lines ?? 1);
      expect(
        Math.max(...fitted.lines.map((line) => width(fitted.style, line))),
      ).toBeLessThanOrEqual(room);
    }
    const effectBottom = box.y + inkRowsOfLines(BODY, effect.lines.length) * effect.style.scale;
    const foot = warning === null ? area.y + area.height : box.warningY - warningGap;
    expect(effectBottom).toBeLessThanOrEqual(foot);
    if (warning !== null) {
      expect(box.warningY + inkRowsOfLines(BODY, warning.lines.length)).toBe(area.y + area.height);
    }
  });

  it("fits its firing warning and its changes in the enlarged card's body", () => {
    const { large } = CARD_LAYOUT;
    const warning =
      fires === null
        ? undefined
        : expectFits(
            "font-title",
            FIRES_FIT.large.styles,
            FIRES_FIT.large.room,
            title(firesText(gameData, fires)),
          );
    const box = largeBodyBox(TITLE, warning?.lines.length ?? 0);
    const text = body(largeBodyText(gameData, option));
    expectFits("font-body", boxStyles(BODY, box.height), large.body.width, text);
  });

  it("fits a plaque text in the plaque beside any fires marker, small and enlarged", () => {
    const { badge, fires: marker, large } = CARD_LAYOUT;
    const small = plaqueRoom(
      badge.x,
      badge.width,
      fires === null ? undefined : marker.x + marker.size,
    );
    const largeRight = fires === null ? undefined : large.fires.x + 2 * marker.size;
    const enlarged = plaqueRoom(large.badge.x, large.badge.width, largeRight);
    for (const room of [small, enlarged]) {
      const widths = plaqueTexts(gameData, option).map((text) =>
        inkWidth("font-title", ONE, title(text)),
      );
      expect(Math.min(...widths)).toBeLessThanOrEqual(room);
    }
  });
});
