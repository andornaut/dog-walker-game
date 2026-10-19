import { Scene } from "phaser";

import { itemAt } from "../arrays";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import {
  HOME_QUESTION_ANSWERS,
  homeQuestionLayout,
  PAUSE_MENU_ITEMS,
  type PauseMenuItem,
  pauseMenuLayout,
} from "../hud/pauseMenu";
import { cardNumberForKey } from "../input/keyBindings";
import { withKeyNumber } from "../input/keyNumbers";
import { rectIndexAt } from "../layout/grid";
import { insetRect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { fillRect } from "./draw";
import { openHelp } from "./helpScreen";
import { listenOutsideTap, openOverlay } from "./overlay";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import { addRampDim } from "./rampDim";
import { SCENE_KEYS } from "./sceneKeys";
import type { SettingsSceneData } from "./SettingsScene";
import { soundboardOf } from "./soundboard";
import { listenTargetPress } from "./targetPress";
import { addMenuButton, addPanel, type MenuButton, TEXT_SCALE } from "./uiKit";

// menu is the pause menu; homeQuestion asks whether to head home, for the top bar's Home
// button.
export interface PauseSceneData {
  mode: "homeQuestion" | "menu";
  onHeadHome: () => void;
  onResume: () => void;
}

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

  create({ mode, onHeadHome, onResume }: PauseSceneData): void {
    this.pressed = undefined;
    const { roadView, walkView } = screenLayout(SCREEN_CONFIG);
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
    const asking = mode === "homeQuestion";
    this.entries = asking
      ? HOME_QUESTION_ANSWERS.map((answer) => ({
          label: question[answer],
          press: answer === "headHome" ? headHome : onResume,
        }))
      : PAUSE_MENU_ITEMS.map((item) => ({ label: menu[item], press: presses[item] }));
    const layout = (asking ? homeQuestionLayout : pauseMenuLayout)(roadView, this.entries.length);
    const { panel } = layout;

    // A 1px tan rim keeps the panel's edge clear of the dimmed road.
    const rim = this.add.graphics();
    fillRect(rim, PALETTE.tan, { ...panel, height: panel.height + 2, y: panel.y - 1 });
    fillRect(rim, PALETTE.tan, { ...panel, width: panel.width + 2, x: panel.x - 1 });
    addPanel(this, panel);
    const center = panel.x + panel.width / 2;
    addPixelText(this, center, layout.titleY, asking ? question.title : menu.title, {
      color: PALETTE.plum,
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
    const note = asking ? question.body : menu.note;
    addPixelText(this, center, layout.notePlate.y + 6, note, {
      color: PALETTE.plum,
      originX: 0.5,
    });

    // A press counts where it began and ended on the same target, so the release that resumes
    // the walk is never the road's.
    listenTargetPress<number>(this, {
      onPressed: (target) => {
        this.pressed = target;
        this.showPressed();
      },
      onTap: (target) => this.entries[target]?.press(),
      targetAt: (x, y) => rectIndexAt(layout.hits, x, y),
    });
    // The dimmed band and road around the panel resume, as Resume and Keep walking do. The top
    // bar and doghouses are not dimmed and keep their own taps.
    const covered = [insetRect(-1, panel), ...layout.hits];
    listenOutsideTap(this, () => ({ covered, dim: walkView }), onResume);
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const number = cardNumberForKey(this.entries.length, event.key);
      if (number !== undefined) {
        this.entries[number - 1]?.press();
      }
    });
  }

  private showPressed(): void {
    this.buttons.forEach((button, i) => button.setPressed(i === this.pressed));
  }

  private openSettings(): void {
    const data: SettingsSceneData = { resume: SCENE_KEYS.pause };
    openOverlay(this, SCENE_KEYS.settings, data);
  }
}
