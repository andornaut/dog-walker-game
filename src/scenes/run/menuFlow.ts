import type { Scene } from "phaser";

import type { RunPause } from "../../hud/topBar";
import type { CardView, Choice } from "../../rules/choices";
import type { CardSceneData } from "../CardScene";
import type { PauseSceneData } from "../PauseScene";
import { SCENE_KEYS } from "../sceneKeys";
import { soundboardOf } from "../soundboard";

// What the menus need of the run.
export interface MenuFlowHost {
  dropPress: () => void;
  // Heads home from the pause menu, once it has closed.
  headHome: () => void;
  // Whether the walk is over or not yet started, when the menu stays shut.
  over: () => boolean;
}

// The scenes that hold the walk over the run scene: a card, and the pause menu or the Home
// button's question.
export class MenuFlow {
  private cardView: CardView | undefined;
  private readonly host: MenuFlowHost;
  private pauseMode: PauseSceneData["mode"] = "menu";
  private pauseOpen = false;
  private readonly scene: Scene;

  constructor(scene: Scene, host: MenuFlowHost) {
    this.scene = scene;
    this.host = host;
  }

  // The card open over the walk, if any.
  card(): CardView | undefined {
    return this.cardView;
  }

  paused(): boolean {
    return this.pauseOpen;
  }

  // The card holds the walk from now; a replayed choice closes it before it shows.
  holdForCard(view: CardView): void {
    this.cardView = view;
  }

  showCard(view: CardView, onChoose: (choice: Choice) => void): void {
    const sound = soundboardOf(this.scene);
    sound.play("cardOpen");
    sound.setCardOpen(true);
    const data: CardSceneData = { onChoose, view };
    this.scene.scene.launch(SCENE_KEYS.card, data);
  }

  closeCard(): void {
    this.cardView = undefined;
    this.scene.scene.stop(SCENE_KEYS.card);
    soundboardOf(this.scene).setCardOpen(false);
  }

  menuState(): RunPause["menu"] {
    if (!this.pauseOpen) {
      return "closed";
    }
    if (this.scene.scene.isActive(SCENE_KEYS.help)) {
      return "help";
    }
    if (this.scene.scene.isActive(SCENE_KEYS.settings)) {
      return "settings";
    }
    return this.pauseMode === "homeQuestion" ? "confirmHome" : "open";
  }

  // The pause menu, or the Home button's question, over the walk or over the card that holds
  // it. The walk steps only while walking, so the menu stops it without pausing the run
  // scene: sprite animations loop on, while tweens and timers stop, keeping a hit moment in
  // step with its hit stop. The card under the menu pauses. The HUD keeps running, so the top
  // bar's buttons work and redraw. Asked while the menu is up, the question replaces it.
  openPause(mode: PauseSceneData["mode"]): void {
    if (this.host.over()) {
      return;
    }
    const { scene } = this;
    if (this.pauseOpen) {
      if (mode !== this.pauseMode) {
        this.pauseMode = mode;
        scene.scene.get(SCENE_KEYS.pause).scene.restart(this.pauseData());
      }
      return;
    }
    this.pauseOpen = true;
    this.pauseMode = mode;
    this.host.dropPress();
    soundboardOf(scene).setPaused(true);
    scene.tweens.pauseAll();
    scene.time.paused = true;
    if (this.cardView !== undefined) {
      scene.scene.pause(SCENE_KEYS.card);
    }
    scene.scene.launch(SCENE_KEYS.pause, this.pauseData());
  }

  closePause(): void {
    if (!this.pauseOpen) {
      return;
    }
    const { scene } = this;
    scene.scene.stop(SCENE_KEYS.pause);
    this.pauseOpen = false;
    soundboardOf(scene).setPaused(false);
    scene.tweens.resumeAll();
    scene.time.paused = false;
    if (this.cardView !== undefined) {
      scene.scene.resume(SCENE_KEYS.card);
    }
  }

  private pauseData(): PauseSceneData {
    return {
      mode: this.pauseMode,
      onHeadHome: () => {
        this.closePause();
        this.host.headHome();
      },
      onResume: () => this.closePause(),
    };
  }
}
