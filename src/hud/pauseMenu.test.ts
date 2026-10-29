import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_LAYOUT } from "../data/screen";
import { dollarText } from "../home/home";
import { itemAt } from "../lib/arrays";
import { fillNames, sentences, wrapWords } from "../lib/lines";
import { cents } from "../lib/units";
import { walkLength } from "../rules/route";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontFileMetrics } from "../testing/fontInk";
import { inkRowsOfLines } from "../ui/fontMetrics";
import {
  homeQuestionLayout,
  NOTE_PLATE,
  notePartTops,
  PAUSE_MENU_ITEMS,
  PAUSE_NOTE_LINES,
  PAUSE_NOTE_WIDTH,
  pauseMenuLayout,
} from "./pauseMenu";
import { TOP_BAR_BUTTONS } from "./topBar";

const { walkView } = SCREEN_LAYOUT;
const BODY = fontFileMetrics("font-body");
// A line's width at the note's scale.
const bodyWidth = (line: string) => bodyTextWidth(NOTE_PLATE.scale, line);
const longer = (a: string, b: string): string => (bodyWidth(b) > bodyWidth(a) ? b : a);

describe("the menus' hit areas", () => {
  // The top bar's buttons stay live while the menu is up, so no menu button may reach them.
  it("keep each clear of the next and of the top bar's buttons", () => {
    for (const { hits } of [
      pauseMenuLayout(BODY, walkView, { buttonCount: 4, noteLines: 2 }),
      homeQuestionLayout(BODY, walkView, { buttonCount: 2, noteLines: 3 }),
    ]) {
      for (let i = 1; i < hits.length; i += 1) {
        const above = itemAt(hits, i - 1);
        expect(above.y + above.height).toBeLessThanOrEqual(itemAt(hits, i).y);
      }
      for (const hit of hits) {
        for (const button of Object.values(TOP_BAR_BUTTONS)) {
          expect(hit.y).toBeGreaterThanOrEqual(button.hit.y + button.hit.height);
        }
      }
    }
  });
});

describe("notePartTops", () => {
  it("starts the first part at the plate's padding and each next on the line after", () => {
    const plate = homeQuestionLayout(BODY, walkView, { buttonCount: 2, noteLines: 4 }).notePlate;
    const first = plate.y + NOTE_PLATE.padTop;
    const pitch = BODY.lineHeight * NOTE_PLATE.scale;
    expect(notePartTops(BODY, plate, [2, 1, 1])).toEqual([
      first,
      first + 2 * pitch,
      first + 3 * pitch,
    ]);
  });
});

describe("the Home question's panel", () => {
  it("fits its longest note in the band and road, with no zone done and the most money", () => {
    const words = gameData.runText.homeQuestion;
    const money = dollarText(cents(9_999_900));
    const zone = gameData.world.zones.map((candidate) => candidate.name).reduce(longer);
    const note = [
      fillNames(words.lose, { lost: money, zone }),
      fillNames(words.zonesLeft, { count: String(walkLength(gameData) - 1) }),
    ];
    const room = PAUSE_NOTE_WIDTH - 2 * NOTE_PLATE.padX;
    const lines = note.flatMap((text) => wrapWords(bodyWidth, room, text));
    expect(lines.filter((line) => bodyWidth(line) > room)).toEqual([]);
    const { panel } = homeQuestionLayout(BODY, walkView, {
      buttonCount: 2,
      noteLines: lines.length,
    });
    expect(panel.y).toBeGreaterThanOrEqual(walkView.y);
    expect(panel.y + panel.height).toBeLessThanOrEqual(walkView.y + walkView.height);
  });
});

// The pause menu's own note, each sentence starting a line, wraps at 2x onto the lines its
// plate is laid out for, in a panel inside the band and road, the last line's lowest ink inside
// the plate. The walk's cash stays under $1,000.
describe("the pause menu's note", () => {
  const words = gameData.menuText.pause;
  const cash = dollarText(cents(99_900));

  it.each([
    ["keeping some of the cash", fillNames(words.note, { cash, kept: cash })],
    ["keeping all the cash", fillNames(words.noteAll, { cash })],
  ])("sets its note %s on the lines of its plate", (_name, note) => {
    const room = PAUSE_NOTE_WIDTH - 2 * NOTE_PLATE.padX;
    const lines = sentences(note).flatMap((sentence) => wrapWords(bodyWidth, room, sentence));
    expect(lines.filter((line) => bodyWidth(line) > room)).toEqual([]);
    expect(lines.length).toBeLessThanOrEqual(PAUSE_NOTE_LINES);
    const parts = { buttonCount: PAUSE_MENU_ITEMS.length, noteLines: PAUSE_NOTE_LINES };
    const { notePlate, panel } = pauseMenuLayout(BODY, walkView, parts);
    expect(panel.y + panel.height).toBeLessThanOrEqual(walkView.y + walkView.height);
    const [top = 0] = notePartTops(BODY, notePlate, [PAUSE_NOTE_LINES]);
    const inkBottom = top + inkRowsOfLines(BODY, PAUSE_NOTE_LINES) * NOTE_PLATE.scale;
    expect(inkBottom).toBeLessThanOrEqual(notePlate.y + notePlate.height);
  });
});
