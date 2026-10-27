import { Scene } from "phaser";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { HomeNoteLine } from "../hud/homeQuestion";
import {
  HOME_QUESTION_ANSWERS,
  homeQuestionLayout,
  NOTE_PLATE,
  notePartTops,
  PAUSE_MENU_ITEMS,
  PAUSE_NOTE_WIDTH,
  type PauseMenuItem,
  pauseMenuLayout,
} from "../hud/pauseMenu";
import { cardNumberForKey, menuKeyActs } from "../input/keyBindings";
import { withKeyNumber } from "../input/keyNumbers";
import { screenLayout } from "../layout/screenLayout";
import { itemAt } from "../lib/arrays";
import { sentences } from "../lib/lines";
import { insetRect } from "../lib/rect";
import { rectIndexAt } from "../ui/grid";
import { fillRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import { addPixelText, pixelFontMetrics, wrapPixelText } from "../ui/phaser/pixelText";
import { addRampDim } from "../ui/phaser/rampDim";
import { HELP_CLOSED_EVENT } from "./HelpScene";
import { openHelp } from "./helpScreen";
import { listenOutsideTap, openOverlay } from "./overlay";
import { SCENE_KEYS } from "./sceneKeys";
import { SETTINGS_CLOSED_EVENT } from "./SettingsScene";
import { soundboardOf } from "./soundboard";
import { listenTargetPress } from "./targetPress";
import { addMenuButton, addRimmedPanel, addTapBurst, type MenuButton, TEXT_SCALE } from "./uiKit";

// Help or the settings, opened at once over the menu from the walk bar: alone, closing it
// resumes the walk; opened over the menu or the question, closing it shows the menu again.
export interface PauseOverlay {
  readonly alone: boolean;
  readonly open: "help" | "settings";
}

// menu is the pause menu; homeQuestion asks whether to head home, for the walk bar's Home
// button, its note saying what going home keeps and gives up.
export type PauseSceneData = {
  onHeadHome: () => void;
  onResume: () => void;
} & (
  { mode: "homeQuestion"; note: readonly HomeNoteLine[] } | { mode: "menu"; overlay?: PauseOverlay }
);

// The Home question's note lines' colours, by what they say.
const NOTE_COLOURS: Readonly<Record<HomeNoteLine["kind"], number>> = {
  lose: PALETTE.darkRed,
  zonesLeft: PALETTE.plum,
};

interface MenuEntry {
  label: string;
  press: () => void;
}

// The pause menu over the dimmed band and road: resume, help, settings or head home; or the Home
// button's question, keep walking or head home. The HUD keeps running under it, so the top
// bar's buttons and their keys (P, Escape and M) stay with it.
export class PauseScene extends Scene {
  private buttons: MenuButton[] = [];
  private entries: MenuEntry[] = [];
  private pressed: number | undefined;

  constructor() {
    super(SCENE_KEYS.pause);
  }

  create(data: PauseSceneData): void {
    const { onHeadHome, onResume } = data;
    this.pressed = undefined;
    const { walkView } = screenLayout(SCREEN_CONFIG);
    addRampDim(this, walkView);
    const headHome = () => {
      soundboardOf(this).stopMusic();
      onHeadHome();
    };
    const presses: Readonly<Record<PauseMenuItem, () => void>> = {
      headHome,
      help: () => openHelp(this, SCENE_KEYS.pause),
      resume: onResume,
      settings: () => this.openSettings(),
    };
    const question = gameData.runText.homeQuestion;
    const menu = gameData.menuText.pause;
    const asking = data.mode === "homeQuestion";
    this.entries = asking
      ? HOME_QUESTION_ANSWERS.map((answer) => ({
          label: question[answer],
          press: answer === "headHome" ? headHome : onResume,
        }))
      : PAUSE_MENU_ITEMS.map((item) => ({ label: menu[item], press: presses[item] }));
    const note =
      data.mode === "homeQuestion"
        ? data.note.map((line) => ({ colour: NOTE_COLOURS[line.kind], text: line.text }))
        : [{ colour: PALETTE.plum, text: menu.note }];
    const noteWidth = PAUSE_NOTE_WIDTH - 2 * NOTE_PLATE.padX;
    // The note wraps at 2x; the menu's own starts each sentence on a line of its own.
    const noteParts = note.map(({ colour, text }) => {
      const style = { colour, scale: NOTE_PLATE.scale };
      const said = asking ? [text] : sentences(text);
      return { lines: said.flatMap((part) => wrapPixelText(this, style, noteWidth, part)), style };
    });
    const noteLines = noteParts.reduce((sum, part) => sum + part.lines.length, 0);
    const parts = { buttonCount: this.entries.length, noteLines };
    const body = pixelFontMetrics(this, "body");
    const layout = (asking ? homeQuestionLayout : pauseMenuLayout)(body, walkView, parts);
    const { panel } = layout;

    addRimmedPanel(this, panel);
    const centre = panel.x + panel.width / 2;
    addPixelText(this, centre, layout.titleY, asking ? question.title : menu.title, {
      colour: PALETTE.plum,
      font: "title",
      originX: 0.5,
      scale: TEXT_SCALE,
    });
    // The first entry, Resume or Keep walking, is the call to action.
    this.buttons = this.entries.map((entry, i) =>
      addMenuButton(this, itemAt(layout.buttons, i), withKeyNumber(i + 1, entry.label), {
        available: true,
        primary: i === 0,
      }),
    );
    fillRect(this.add.graphics(), PALETTE.tan, layout.notePlate);
    const tops = notePartTops(
      body,
      layout.notePlate,
      noteParts.map((part) => part.lines.length),
    );
    noteParts.forEach((part, i) => {
      addPixelText(this, centre, itemAt(tops, i), part.lines.join("\n"), {
        ...part.style,
        align: "centre",
        originX: 0.5,
      });
    });

    // A press counts where it began and ended on the same target, so the release that resumes
    // the walk is never the road's.
    listenTargetPress<number>(this, {
      onDown: (pointer) => addTapBurst(this, pointer.x, pointer.y),
      onPressed: (target) => {
        this.pressed = target;
        this.showPressed();
      },
      onTap: (target) => this.entries[target]?.press(),
      targetAt: (x, y) => rectIndexAt(layout.hits, x, y),
    });
    // The dimmed band and road around the panel resume, as Resume and Keep walking do. The top
    // bar and dog cards are not dimmed and keep their own taps.
    const covered = [insetRect(-1, panel), ...layout.hits];
    listenOutsideTap(this, () => ({ covered, dim: walkView }), onResume);
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const number = cardNumberForKey(this.entries.length, event.key);
      if (number !== undefined && menuKeyActs(event.repeat, event.key)) {
        this.entries[number - 1]?.press();
      }
    });
    const overlay = data.mode === "menu" ? data.overlay : undefined;
    if (overlay !== undefined) {
      const closed = overlay.open === "help" ? HELP_CLOSED_EVENT : SETTINGS_CLOSED_EVENT;
      if (overlay.alone) {
        this.game.events.once(closed, onResume);
        this.events.once("shutdown", () => this.game.events.off(closed, onResume));
      }
      presses[overlay.open]();
    }
  }

  private showPressed(): void {
    this.buttons.forEach((button, i) => button.setPressed(i === this.pressed));
  }

  private openSettings(): void {
    openOverlay(this, SCENE_KEYS.settings, { resume: SCENE_KEYS.pause });
  }
}
