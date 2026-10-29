import { Scene } from "phaser";

import { gameData } from "../data";
import { overlayRegion, regionOutside } from "../home/homeBar";
import { homeQuestionLayout, QUIT_QUESTION_ANSWERS } from "../hud/pauseMenu";
import { isPauseKey, menuKeyActs } from "../input/keyBindings";
import { exitShown } from "../pwa";
import { addRampDim } from "../ui/phaser/rampDim";
import { exitGame, listenHomeBar } from "./homeBarPress";
import { closeOverlay, listenDismiss, type OverlayData } from "./overlay";
import { addQuestionPanel } from "./questionPanel";
import { SCENE_KEYS } from "./sceneKeys";

// Quit? over the dimmed home screen, which back asks with nothing open, laid out as the Home
// question: Keep playing closes it, as back, Escape, P and a tap outside do; Quit leaves the game
// as the top bar's Exit does (exitGame). The top bar keeps its buttons.
export class QuitScene extends Scene {
  constructor() {
    super(SCENE_KEYS.quit);
  }

  create({ resume }: OverlayData): void {
    const area = overlayRegion("home");
    addRampDim(this, area);
    const words = gameData.homeText.quit;
    const keepPlaying = () => closeOverlay(resume, this);
    // Closed first, so a page kept for back-forward caching comes back to the bare home screen.
    const quit = () => {
      keepPlaying();
      exitGame();
    };
    const covered = addQuestionPanel(this, area, {
      entries: QUIT_QUESTION_ANSWERS.map((answer) => ({
        label: words[answer],
        press: answer === "quit" ? quit : keepPlaying,
      })),
      layout: homeQuestionLayout,
      note: [],
      sentenceLines: false,
      title: words.title,
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (menuKeyActs(event.repeat, event.key) && isPauseKey(event.key)) {
        keepPlaying();
      }
    });
    const exit = exitShown();
    listenDismiss(this, regionOutside(exit, "home", covered), keepPlaying);
    listenHomeBar(this, exit, keepPlaying);
  }
}
