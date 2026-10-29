import type { Scene } from "phaser";

import { NOTE_PLATE, notePartTops, PAUSE_NOTE_WIDTH, type pauseMenuLayout } from "../hud/pauseMenu";
import { cardNumberForKey, menuKeyActs } from "../input/keyBindings";
import { withKeyNumber } from "../input/keyNumbers";
import { itemAt } from "../lib/arrays";
import { sentences } from "../lib/lines";
import { insetRect, type Rect } from "../lib/rect";
import { rectIndexAt } from "../ui/grid";
import { fillRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import { addPixelText, pixelFontMetrics, wrapPixelText } from "../ui/phaser/pixelText";
import { TEXT_SCALE } from "../ui/textFit";
import { listenTargetPress } from "./targetPress";
import { addMenuButton, addRimmedPanel, addTapBurst, type MenuButton } from "./uiKit";

// A button on the panel: its label and what a press, a tap or its number key, does.
export interface PanelEntry {
  readonly label: string;
  readonly press: () => void;
}

// A part of the panel's note, in its own colour, starting a line of its own.
export interface PanelNotePart {
  readonly colour: number;
  readonly text: string;
}

export interface QuestionPanel {
  // Top to bottom, the first the call to action and key 1.
  readonly entries: readonly PanelEntry[];
  // pauseMenuLayout, the buttons then the note, or homeQuestionLayout, the note first.
  readonly layout: typeof pauseMenuLayout;
  // No parts draws no note plate.
  readonly note: readonly PanelNotePart[];
  // Whether each sentence of a part starts a line of its own.
  readonly sentenceLines: boolean;
  readonly title: string;
}

// The pause menu's panel, and each question laid out as it is (the Home question, Quit?), centred
// in area: its title, the buttons, and the note plate. A press counts where it began and ended on
// the same button, so the release that closes the panel is never what is under it. Returns what
// a tap outside the panel must miss: the panel and the buttons' hit areas.
export function addQuestionPanel(scene: Scene, area: Rect, question: QuestionPanel): Rect[] {
  const { entries } = question;
  const noteWidth = PAUSE_NOTE_WIDTH - 2 * NOTE_PLATE.padX;
  // The note wraps at 2x.
  const noteParts = question.note.map(({ colour, text }) => {
    const style = { colour, scale: NOTE_PLATE.scale };
    const said = question.sentenceLines ? sentences(text) : [text];
    return { lines: said.flatMap((part) => wrapPixelText(scene, style, noteWidth, part)), style };
  });
  const noteLines = noteParts.reduce((sum, part) => sum + part.lines.length, 0);
  const body = pixelFontMetrics(scene, "body");
  const layout = question.layout(body, area, { buttonCount: entries.length, noteLines });
  const { panel } = layout;

  addRimmedPanel(scene, panel);
  const centre = panel.x + panel.width / 2;
  addPixelText(scene, centre, layout.titleY, question.title, {
    colour: PALETTE.plum,
    font: "title",
    originX: 0.5,
    scale: TEXT_SCALE,
  });
  const buttons: MenuButton[] = entries.map((entry, i) =>
    addMenuButton(scene, itemAt(layout.buttons, i), withKeyNumber(i + 1, entry.label), {
      available: true,
      primary: i === 0,
    }),
  );
  if (noteParts.length > 0) {
    fillRect(scene.add.graphics(), PALETTE.tan, layout.notePlate);
    const tops = notePartTops(
      body,
      layout.notePlate,
      noteParts.map((part) => part.lines.length),
    );
    noteParts.forEach((part, i) => {
      addPixelText(scene, centre, itemAt(tops, i), part.lines.join("\n"), {
        ...part.style,
        align: "centre",
        originX: 0.5,
      });
    });
  }

  listenTargetPress<number>(scene, {
    onDown: (pointer) => addTapBurst(scene, pointer.x, pointer.y),
    onPressed: (pressed) => {
      buttons.forEach((button, i) => button.setPressed(i === pressed));
    },
    onTap: (target) => entries[target]?.press(),
    targetAt: (x, y) => rectIndexAt(layout.hits, x, y),
  });
  scene.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
    const number = cardNumberForKey(entries.length, event.key);
    if (number !== undefined && menuKeyActs(event.repeat, event.key)) {
      entries[number - 1]?.press();
    }
  });
  return [insetRect(-1, panel), ...layout.hits];
}
