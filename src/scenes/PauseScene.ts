import { Core, Scene, Scenes } from "phaser";

import { gameData } from "../data";
import { overlayRegion, regionOutside } from "../home/homeBar";
import type { HomeNoteLine } from "../hud/homeQuestion";
import {
  HOME_QUESTION_ANSWERS,
  homeQuestionLayout,
  PAUSE_MENU_ITEMS,
  type PauseMenuItem,
  pauseMenuLayout,
} from "../hud/pauseMenu";
import { PALETTE } from "../ui/phaser/palette";
import { addRampDim } from "../ui/phaser/rampDim";
import { HELP_CLOSED_EVENT } from "./HelpScene";
import { openHelp } from "./helpScreen";
import { listenOutsideTap, onceSceneEvent, openOverlay } from "./overlay";
import { addQuestionPanel, type PanelEntry } from "./questionPanel";
import { SCENE_KEYS } from "./sceneKeys";
import { SETTINGS_CLOSED_EVENT, type SettingsData } from "./SettingsScene";
import { soundboardOf } from "./soundboard";

// Help or the settings, opened at once over the menu from the walk bar: alone, closing it
// resumes the walk; opened over the menu or the question, closing it shows the menu again.
export interface PauseOverlay {
  readonly alone: boolean;
  readonly open: "help" | "settings";
}

// menu is the pause menu, its note saying what Head home keeps; homeQuestion asks whether to
// head home, for the pause menu's and a fork card's Head home, its note saying what going home
// gives up.
export type PauseSceneData = {
  onHeadHome: () => void;
  onResume: () => void;
} & (
  | { mode: "homeQuestion"; note: readonly HomeNoteLine[] }
  | { mode: "menu"; note: string; overlay?: PauseOverlay }
);

// The Home question's note lines' colours, by what they say.
const NOTE_COLOURS: Readonly<Record<HomeNoteLine["kind"], number>> = {
  lose: PALETTE.darkRed,
  zonesLeft: PALETTE.plum,
};

// The pause menu over the dimmed band and road: resume, help, settings or head home; or the Home
// button's question, keep walking or head home. The HUD keeps running under it, so the top
// bar's buttons and their keys (P, Escape and M) stay with it, and a hold on a walk-bar well or
// a dog card opens its explanation over the panel, with this scene paused until it closes
// (MenuFlow.coverOverlay).
export class PauseScene extends Scene {
  constructor() {
    super(SCENE_KEYS.pause);
  }

  create(data: PauseSceneData): void {
    const { onHeadHome, onResume } = data;
    const walkView = overlayRegion("walk");
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
    // The first entry, Resume or Keep walking, is the call to action.
    const entries: PanelEntry[] =
      data.mode === "homeQuestion"
        ? HOME_QUESTION_ANSWERS.map((answer) => ({
            label: question[answer],
            press: answer === "headHome" ? headHome : onResume,
          }))
        : PAUSE_MENU_ITEMS.map((item) => ({ label: menu[item], press: presses[item] }));
    // The menu's own note starts each sentence on a line of its own.
    const covered = addQuestionPanel(
      this,
      walkView,
      data.mode === "homeQuestion"
        ? {
            entries,
            layout: homeQuestionLayout,
            note: data.note.map((line) => ({ colour: NOTE_COLOURS[line.kind], text: line.text })),
            sentenceLines: false,
            title: question.title,
          }
        : {
            entries,
            layout: pauseMenuLayout,
            note: [{ colour: PALETTE.plum, text: data.note }],
            sentenceLines: true,
            title: menu.title,
          },
    );
    // The dimmed band and road around the panel resume, as Resume and Keep walking do. The top
    // bar and dog cards are not dimmed and keep their own taps.
    const outside = regionOutside("walk", covered);
    listenOutsideTap(this, () => outside, onResume);
    const overlay = data.mode === "menu" ? data.overlay : undefined;
    if (overlay !== undefined) {
      const closed = overlay.open === "help" ? HELP_CLOSED_EVENT : SETTINGS_CLOSED_EVENT;
      if (overlay.alone) {
        onceSceneEvent(this, this.game.events, closed, onResume);
      }
      // Opened once the dim has read back its first frame, so the dim holds the walk, never
      // the page, when the page closes back to the menu.
      const open = () => presses[overlay.open]();
      onceSceneEvent(this, this.game.events, Core.Events.POST_RENDER, open);
    }
  }

  // The settings over the walk, dimmed as the menu dims it. The menu hides under them, dim and
  // all, so they dim the walk alone, and shows again as they resume it.
  private openSettings(): void {
    this.scene.setVisible(false);
    onceSceneEvent(this, this.events, Scenes.Events.RESUME, () => this.scene.setVisible(true));
    const data: SettingsData = { region: "walk", resume: SCENE_KEYS.pause };
    openOverlay(this, SCENE_KEYS.settings, data);
  }
}
