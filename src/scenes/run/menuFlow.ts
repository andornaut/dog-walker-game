import type { Scene } from "phaser";

import type { ZoneId } from "../../data/types";
import type { HomeNoteLine } from "../../hud/homeQuestion";
import { playerPaused, type RunPause } from "../../hud/topBar";
import type { CardView, Choice } from "../../rules/choices";
import type { CardSceneData } from "../CardScene";
import { openOverlay } from "../overlay";
import type { PauseSceneData } from "../PauseScene";
import { SCENE_KEYS } from "../sceneKeys";
import { soundboardOf } from "../soundboard";
import type { ZoneCelebrationSceneData } from "../ZoneCelebrationScene";

// What the menus need of the run.
export interface MenuFlowHost {
  dropPress: () => void;
  // Heads home from the pause menu, once it has closed.
  headHome: () => void;
  // What the Home question says going home now keeps and gives up.
  homeNote: () => readonly HomeNoteLine[];
  // Whether the walk is over or not yet started, when the menu stays shut.
  over: () => boolean;
}

// Everything that pauses the walk but the hit stop, which the session holds.
export type MenuPause = Omit<RunPause, "hitStop">;

// What pauses the walk over the run scene: a card, the zone celebration, the pause menu or the
// Home button's question, the state strip's bubble, and the page out of view or focus. pause()
// reports all of them, and walkPaused decides from it, so each new one pauses the walk.
export class MenuFlow {
  private blurred = false;
  private cardView: CardView | undefined;
  private celebrating = false;
  // Whether the player's pause holds the run scene's tweens and timers and ducks the music.
  private held = false;
  private hidden = false;
  private readonly host: MenuFlowHost;
  private pauseMode: PauseSceneData["mode"] = "menu";
  private pauseOpen = false;
  private readonly scene: Scene;
  private stripBubble = false;

  constructor(scene: Scene, host: MenuFlowHost) {
    this.scene = scene;
    this.host = host;
  }

  // The card open over the walk, if any.
  card(): CardView | undefined {
    return this.cardView;
  }

  pause(): MenuPause {
    return {
      card: this.cardView !== undefined || this.celebrating,
      menu: this.menuState(),
      page: this.hidden ? "hidden" : this.blurred ? "blurred" : "shown",
      stripBubble: this.stripBubble,
    };
  }

  // Whether the zone celebration holds the walk: from the zone's end, while its fee coins fly,
  // until it closes.
  celebration(): boolean {
    return this.celebrating;
  }

  holdForCelebration(): void {
    this.celebrating = true;
  }

  // The celebration over the paused run scene; onDone runs once it has closed.
  showCelebration(data: ZoneCelebrationSceneData): void {
    const launched: ZoneCelebrationSceneData = {
      ...data,
      onDone: () => {
        this.celebrating = false;
        data.onDone();
      },
    };
    openOverlay(this.scene, SCENE_KEYS.zoneCelebration, launched);
  }

  // The card holds the walk from now; a replayed choice closes it before it shows.
  holdForCard(view: CardView): void {
    this.cardView = view;
  }

  showCard(zone: ZoneId, view: CardView, onChoose: (choice: Choice) => void): void {
    soundboardOf(this.scene).play("cardOpen");
    const data: CardSceneData = { onChoose, view, zone };
    this.scene.scene.launch(SCENE_KEYS.card, data);
  }

  closeCard(): void {
    this.cardView = undefined;
    this.scene.scene.stop(SCENE_KEYS.card);
  }

  // The state strip's bubble opened or closed; it pauses the walk while open.
  setStripBubble(open: boolean): void {
    this.stripBubble = open;
    this.hold();
  }

  // The tab hid or showed again.
  setPageHidden(hidden: boolean): void {
    this.hidden = hidden;
  }

  // The window lost focus or got it back.
  setPageBlurred(blurred: boolean): void {
    this.blurred = blurred;
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
  // step with its hit stop. The card under the menu pauses and hides, so no card shows beside
  // the menu's panel; a zone celebration under it pauses. The HUD keeps running, so the top
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
    this.hold();
    if (this.cardView !== undefined) {
      scene.scene.pause(SCENE_KEYS.card);
      scene.scene.setVisible(false, SCENE_KEYS.card);
    }
    if (scene.scene.isActive(SCENE_KEYS.zoneCelebration)) {
      scene.scene.pause(SCENE_KEYS.zoneCelebration);
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
    this.hold();
    if (this.cardView !== undefined) {
      scene.scene.setVisible(true, SCENE_KEYS.card);
      scene.scene.resume(SCENE_KEYS.card);
    }
    if (scene.scene.isPaused(SCENE_KEYS.zoneCelebration)) {
      scene.scene.resume(SCENE_KEYS.zoneCelebration);
    }
  }

  // Stops or restarts the run scene's tweens and timers, and ducks or restores the music, as
  // the player's pause starts or ends.
  private hold(): void {
    const held = playerPaused(this.pause());
    if (held === this.held) {
      return;
    }
    this.held = held;
    const { scene } = this;
    soundboardOf(scene).setPaused(held);
    if (held) {
      scene.tweens.pauseAll();
    } else {
      scene.tweens.resumeAll();
    }
    scene.time.paused = held;
  }

  private pauseData(): PauseSceneData {
    const answers = {
      onHeadHome: () => {
        this.closePause();
        this.host.headHome();
      },
      onResume: () => this.closePause(),
    };
    return this.pauseMode === "homeQuestion"
      ? { ...answers, mode: "homeQuestion", note: this.host.homeNote() }
      : { ...answers, mode: "menu" };
  }
}
