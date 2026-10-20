import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { dollarText } from "../home/home";
import { screenLayout } from "../layout/screenLayout";
import { walkLength } from "../rules/route";
import { cents } from "../rules/units";
import { fillNames, wrapWords } from "../text/lines";
import {
  homeQuestionLayout,
  NOTE_PLATE,
  notePartTops,
  PAUSE_NOTE_WIDTH,
  pauseMenuLayout,
} from "./pauseMenu";
import { TOP_BAR_BUTTONS } from "./topBar";

const { road, roadView } = screenLayout(SCREEN_CONFIG);

describe("pauseMenuLayout", () => {
  it("places the panel, title, buttons and a two-line note plate", () => {
    const layout = pauseMenuLayout(road, { buttonCount: 4, noteLines: 2 });
    expect(layout.panel).toEqual({ height: 284, width: 232, x: 64, y: 168 });
    expect(layout.titleY).toBe(184);
    expect(layout.buttons.map((button) => button.y)).toEqual([208, 256, 304, 352]);
    for (const button of layout.buttons) {
      expect(button).toMatchObject({ height: 40, width: 200, x: 80 });
    }
    expect(layout.notePlate).toEqual({ height: 42, width: 200, x: 80, y: 396 });
  });

  it("puts the Home question's three-line note under its title, over its two answers", () => {
    const layout = homeQuestionLayout(road, { buttonCount: 2, noteLines: 3 });
    expect(layout.panel).toEqual({ height: 208, width: 232, x: 64, y: 206 });
    expect(layout.titleY).toBe(222);
    expect(layout.notePlate).toEqual({ height: 62, width: 200, x: 80, y: 242 });
    expect(layout.buttons.map((button) => button.y)).toEqual([312, 360]);
  });

  it("reaches each hit area 2px above and below its button without overlapping the next", () => {
    const { buttons, hits } = pauseMenuLayout(road, { buttonCount: 4, noteLines: 2 });
    hits.forEach((hit, i) => {
      const button = itemAt(buttons, i);
      expect(hit).toEqual({ ...button, height: 44, y: button.y - 2 });
    });
    for (let i = 1; i < hits.length; i += 1) {
      const above = itemAt(hits, i - 1);
      expect(above.y + above.height).toBeLessThanOrEqual(itemAt(hits, i).y);
    }
  });
});

describe("notePartTops", () => {
  const plate = homeQuestionLayout(road, { buttonCount: 2, noteLines: 4 }).notePlate;
  const first = plate.y + NOTE_PLATE.pad;

  it.each<[string, number[], number[]]>([
    ["starts a lone part at the plate's padding", [3], [first]],
    [
      "starts each part on the line after the one above ends",
      [2, 1, 1],
      [first, first + 2 * NOTE_PLATE.linePitch, first + 3 * NOTE_PLATE.linePitch],
    ],
  ])("%s", (_name, counts, tops) => {
    expect(notePartTops(plate, counts)).toEqual(tops);
  });
});

// The body font's advances, from its .fnt, measure a line at the note's scale.
const BODY_FNT = new URL("../../public/art/fonts/font-body.fnt", import.meta.url);
const BODY_ADVANCES = new Map(
  [...readFileSync(BODY_FNT, "utf8").matchAll(/<char id="(\d+)"[^>]*\bxadvance="(\d+)"/g)].map(
    ([, id, advance]) => [String.fromCodePoint(Number(id)), Number(advance)],
  ),
);
const bodyWidth = (line: string) =>
  NOTE_PLATE.scale * [...line].reduce((sum, char) => sum + (BODY_ADVANCES.get(char) ?? 0), 0);

describe("the Home question's panel", () => {
  it("fits its longest note on the road, with no zone done and the most money", () => {
    const words = gameData.runText.homeQuestion;
    const money = dollarText(cents(9_999_900));
    const zone = gameData.world.zones.map((candidate) => candidate.name).reduce(longer);
    const note = [
      fillNames(words.keep, { money }),
      fillNames(words.lose, { fees: money, zone }),
      fillNames(words.zonesLeft, { count: String(walkLength(gameData) - 1) }),
    ];
    const room = PAUSE_NOTE_WIDTH - 2 * NOTE_PLATE.padX;
    const lines = note.flatMap((text) => wrapWords(bodyWidth, room, text));
    expect(lines.every((line) => bodyWidth(line) <= room)).toBe(true);
    const { panel } = homeQuestionLayout(roadView, { buttonCount: 2, noteLines: lines.length });
    expect(panel.y).toBeGreaterThanOrEqual(roadView.y);
    expect(panel.y + panel.height).toBeLessThanOrEqual(roadView.y + roadView.height);
  });
});

function longer(a: string, b: string): string {
  return bodyWidth(b) > bodyWidth(a) ? b : a;
}

describe("pauseMenuLayout hits", () => {
  const hits = [
    ...pauseMenuLayout(road, { buttonCount: 4, noteLines: 2 }).hits,
    ...homeQuestionLayout(road, { buttonCount: 2, noteLines: 3 }).hits,
  ];

  // The top bar's buttons stay live while the menu is up, so no menu button may reach them.
  it("keeps every menu button's hit area clear of the top bar's buttons", () => {
    for (const hit of hits) {
      for (const button of Object.values(TOP_BAR_BUTTONS)) {
        expect(hit.y).toBeGreaterThanOrEqual(button.hit.y + button.hit.height);
      }
    }
  });
});
