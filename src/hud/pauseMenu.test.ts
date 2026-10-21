import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { dollarText } from "../home/home";
import { screenLayout } from "../layout/screenLayout";
import { walkLength } from "../rules/route";
import { cents } from "../rules/units";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontFileMetrics } from "../testing/fontInk";
import { fillNames, wrapWords } from "../text/lines";
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

const { walkView } = screenLayout(SCREEN_CONFIG);
const BODY = fontFileMetrics("font-body");
// A line of the note: a line of the body font at the note's scale.
const PITCH = BODY.lineHeight * NOTE_PLATE.scale;

// A panel height tall, centred in the dimmed band and road.
const centred = (height: number) => ({
  height,
  width: 232,
  x: Math.round(walkView.x + (walkView.width - 232) / 2),
  y: Math.round(walkView.y + (walkView.height - height) / 2),
});

describe("pauseMenuLayout", () => {
  it("places the panel, title, buttons and a two-line note plate", () => {
    const layout = pauseMenuLayout(BODY, walkView, { buttonCount: 4, noteLines: 2 });
    const panel = centred(289);
    expect(layout.panel).toEqual(panel);
    expect(layout.titleY).toBe(panel.y + 16);
    expect(layout.buttons.map((button) => button.y - panel.y)).toEqual([40, 88, 136, 184]);
    for (const button of layout.buttons) {
      expect(button).toMatchObject({ height: 40, width: 200, x: panel.x + 16 });
    }
    expect(layout.notePlate).toEqual({ height: 44, width: 200, x: panel.x + 16, y: panel.y + 228 });
  });

  it("puts the Home question's three-line note under its title, over its two answers", () => {
    const layout = homeQuestionLayout(BODY, walkView, { buttonCount: 2, noteLines: 3 });
    const panel = centred(213);
    expect(layout.panel).toEqual(panel);
    expect(layout.titleY).toBe(panel.y + 16);
    expect(layout.notePlate).toEqual({ height: 64, width: 200, x: panel.x + 16, y: panel.y + 36 });
    expect(layout.buttons.map((button) => button.y - panel.y)).toEqual([108, 156]);
  });

  it("reaches each hit area 2px above and below its button without overlapping the next", () => {
    const { buttons, hits } = pauseMenuLayout(BODY, walkView, { buttonCount: 4, noteLines: 2 });
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
  const plate = homeQuestionLayout(BODY, walkView, { buttonCount: 2, noteLines: 4 }).notePlate;
  const first = plate.y + NOTE_PLATE.padTop;

  it.each<[string, number[], number[]]>([
    ["starts a lone part at the plate's padding", [3], [first]],
    [
      "starts each part on the line after the one above ends",
      [2, 1, 1],
      [first, first + 2 * PITCH, first + 3 * PITCH],
    ],
  ])("%s", (_name, counts, tops) => {
    expect(notePartTops(BODY, plate, counts)).toEqual(tops);
  });
});

// A line's width at the note's scale.
const bodyWidth = (line: string) => bodyTextWidth(NOTE_PLATE.scale, line);

describe("the Home question's panel", () => {
  it("fits its longest note in the band and road, with no zone done and the most money", () => {
    const words = gameData.runText.homeQuestion;
    const money = dollarText(cents(9_999_900));
    const zone = gameData.world.zones.map((candidate) => candidate.name).reduce(longer);
    const note = [
      fillNames(words.loseWithBonus, { fees: money, zone }),
      fillNames(words.zonesLeft, { count: String(walkLength(gameData) - 1) }),
    ];
    const room = PAUSE_NOTE_WIDTH - 2 * NOTE_PLATE.padX;
    const lines = note.flatMap((text) => wrapWords(bodyWidth, room, text));
    expect(lines.every((line) => bodyWidth(line) <= room)).toBe(true);
    const { panel } = homeQuestionLayout(BODY, walkView, {
      buttonCount: 2,
      noteLines: lines.length,
    });
    expect(panel.y).toBeGreaterThanOrEqual(walkView.y);
    expect(panel.y + panel.height).toBeLessThanOrEqual(walkView.y + walkView.height);
  });
});

// The pause menu's own note wraps at 2x onto the lines its plate is laid out for, in a panel
// inside the band and road, the last line's lowest ink padBottom over the plate's bottom.
describe("the pause menu's note", () => {
  it("wraps onto its plate's lines", () => {
    const room = PAUSE_NOTE_WIDTH - 2 * NOTE_PLATE.padX;
    const lines = wrapWords(bodyWidth, room, gameData.menuText.pause.note);
    expect(lines.every((line) => bodyWidth(line) <= room)).toBe(true);
    expect(lines.length).toBeLessThanOrEqual(PAUSE_NOTE_LINES);
    const parts = { buttonCount: PAUSE_MENU_ITEMS.length, noteLines: PAUSE_NOTE_LINES };
    const { notePlate, panel } = pauseMenuLayout(BODY, walkView, parts);
    expect(panel.y + panel.height).toBeLessThanOrEqual(walkView.y + walkView.height);
    const [top = 0] = notePartTops(BODY, notePlate, [PAUSE_NOTE_LINES]);
    const inkBottom = top + inkRowsOfLines(BODY, PAUSE_NOTE_LINES) * NOTE_PLATE.scale;
    expect(notePlate.y + notePlate.height - inkBottom).toBe(NOTE_PLATE.padBottom);
  });
});

function longer(a: string, b: string): string {
  return bodyWidth(b) > bodyWidth(a) ? b : a;
}

describe("pauseMenuLayout hits", () => {
  const hits = [
    ...pauseMenuLayout(BODY, walkView, { buttonCount: 4, noteLines: 2 }).hits,
    ...homeQuestionLayout(BODY, walkView, { buttonCount: 2, noteLines: 3 }).hits,
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
