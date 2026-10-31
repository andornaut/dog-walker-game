import { fillNames, sentences, wrapWords } from "@andornaut/game-kit/lines";
import { rectsOverlap } from "@andornaut/game-kit/rect";
import { inkRowsOfLines } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_LAYOUT } from "../data/screen";
import { dollarText } from "../home/home";
import { overlayRegion } from "../home/homeBar";
import { modalActionWidth } from "../home/modalLayout";
import { walkLength } from "../rules/route";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontFileMetrics, inkWidth } from "../testing/fontInk";
import { cents } from "../units";
import {
  HOME_QUESTION_ANSWERS,
  homeQuestionLayout,
  NOTE_PLATE,
  notePartTops,
  PAUSE_MENU_ITEMS,
  PAUSE_NOTE_LINES,
  PAUSE_NOTE_WIDTH,
  pauseMenuLayout,
  QUIT_QUESTION_ANSWERS,
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
    const { pause } = gameData.menuText;
    const cases = [
      { labels: PAUSE_MENU_ITEMS.map((key) => pause[key]), layout: pauseMenuLayout, noteLines: 2 },
      {
        labels: HOME_QUESTION_ANSWERS.map((key) => gameData.runText.homeQuestion[key]),
        layout: homeQuestionLayout,
        noteLines: 3,
      },
      {
        labels: QUIT_QUESTION_ANSWERS.map((key) => gameData.homeText.quit[key]),
        layout: homeQuestionLayout,
        noteLines: 0,
      },
    ];
    for (const { labels, layout, noteLines } of cases) {
      const buttonWidths = labels.map((label, i) =>
        modalActionWidth(inkWidth("font-title", { scale: 2 }, `${i + 1} ${label}`.toUpperCase())),
      );
      const { hits, panel } = layout(BODY, walkView, {
        buttonCount: labels.length,
        buttonWidths,
        noteLines,
      });
      expect(panel.y).toBeGreaterThanOrEqual(walkView.y);
      expect(panel.y + panel.height).toBeLessThanOrEqual(walkView.y + walkView.height);
      expect(new Set(hits.map(({ width, x }) => `${x}:${width}`)).size).toBe(1);
      expect(hits[0]?.width).toBe(Math.max(...buttonWidths));
      hits
        .slice(1)
        .forEach((hit, i) =>
          expect(hit.y).toBeGreaterThan((hits[i]?.y ?? 0) + (hits[i]?.height ?? 0)),
        );
      hits.forEach((hit, i) => {
        hits.slice(i + 1).forEach((next) => expect(rectsOverlap(hit, next)).toBe(false));
      });
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

describe("the Quit question's panel", () => {
  // No note: the buttons follow the title, as the pause menu's do, in the home screen under its
  // top bar.
  it("puts its buttons where the pause menu's start, inside the home screen", () => {
    const home = overlayRegion("home");
    const parts = { buttonCount: QUIT_QUESTION_ANSWERS.length, noteLines: 0 };
    const quit = homeQuestionLayout(BODY, home, parts);
    const menu = pauseMenuLayout(BODY, home, parts);
    expect({ ...quit, notePlate: undefined }).toEqual({ ...menu, notePlate: undefined });
    expect(quit.panel.y).toBeGreaterThanOrEqual(home.y);
    expect(quit.panel.y + quit.panel.height).toBeLessThanOrEqual(home.y + home.height);
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
