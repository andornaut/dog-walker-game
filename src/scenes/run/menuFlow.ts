import type { Scene } from "phaser";

import type { HomeNoteLine } from "../../hud/homeQuestion";
import { playerPaused, type RunPause } from "../../hud/topBar";
import type { CardView, Choice } from "../../rules/choices";
import type { CardSceneData } from "../CardScene";
import { openOverlay } from "../overlay";
import type { PauseOverlay, PauseSceneData } from "../PauseScene";
import { SCENE_KEYS } from "../sceneKeys";
import { soundboardOf } from "../soundboard";
import type { ZoneCelebrationSceneData } from "../ZoneCelebrationScene";

// What the menus need of the run.
interface MenuFlowHost {
  dropPress: () => void;
  // Heads home from the pause menu, once it has closed.
  headHome: () => void;
  // What the Home question says going home now keeps and gives up.
  homeNote: () => readonly HomeNoteLine[];
  // Whether the walk is over or not yet started, when the menu stays shut.
  over: () => boolean;
}

// Everything that pauses the walk but the hit stop, which the session holds, and an
// explanation's detail card, which the input holds.
type MenuPause = Omit<RunPause, "hitStop" | "hold">;

// What pauses the walk over the run scene: a card, the zone celebration, the pause menu or the
// Home question, and the page out of view or focus. pause()
// reports all of them, and walkPaused decides from it, so each new one pauses the walk.
export class MenuFlow {
  private blurred = false;
  private cardView: CardView | undefined;
  private celebrating = false;
  // Whether an explanation's detail card covers the pause menu, which is paused under it.
  private covered = false;
  // Whether the player's pause holds the run scene's tweens and timers and ducks the music.
  private held = false;
  private hidden = false;
  private readonly host: MenuFlowHost;
  private pauseMode: PauseSceneData["mode"] = "menu";
  private pauseOpen = false;
  // Help or the settings, which the walk bar's button opens with the menu, once.
  private pauseOverlay: PauseOverlay | undefined;
  private readonly scene: Scene;

  // A walk starts unheld, as held does. The scene's clock keeps its paused flag across a
  // restart, where its tweens reset theirs, so the flag is reset here.
  constructor(scene: Scene, host: MenuFlowHost) {
    this.scene = scene;
    this.host = host;
    scene.time.paused = false;
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
    };
  }

  // The zone celebration holds the walk from the zone's end, while its fee coins fly, until it
  // closes.
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

  // A fork card's Head home button asks the Home question over it.
  showCard(view: CardView, onChoose: (choice: Choice) => void): void {
    soundboardOf(this.scene).play("cardOpen");
    const data: CardSceneData = {
      onChoose,
      onHeadHome: () => this.openPause("homeQuestion"),
      view,
    };
    this.scene.scene.launch(SCENE_KEYS.card, data);
  }

  closeCard(): void {
    this.cardView = undefined;
    this.scene.scene.stop(SCENE_KEYS.card);
  }

  // The tab hid or showed again.
  setPageHidden(hidden: boolean): void {
    this.hidden = hidden;
  }

  // The window lost focus or got it back.
  setPageBlurred(blurred: boolean): void {
    this.blurred = blurred;
  }

  private menuState(): RunPause["menu"] {
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

  // The pause menu, or the Home question, over the walk or over the card that holds
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
        this.restartPause();
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

  // The walk bar's Help and Settings buttons: help or the settings over the pause menu, the walk
  // paused under them. Opened from the walk, closing them resumes it; opened over the menu or
  // the question, closing them shows the menu.
  openFromBar(open: PauseOverlay["open"]): void {
    if (this.host.over()) {
      return;
    }
    if (this.pauseOpen) {
      this.pauseMode = "menu";
      this.pauseOverlay = { alone: false, open };
      this.restartPause();
      return;
    }
    this.pauseOverlay = { alone: true, open };
    this.openPause("menu");
  }

  // An explanation's detail card opened over the pause menu or the Home question takes every
  // press until a tap closes it, so the menu pauses under it and shows again, the walk still
  // paused, once it closes. Called each frame with whether one is open.
  coverMenu(explaining: boolean): void {
    const { scene } = this.scene;
    if (explaining && !this.covered && scene.isActive(SCENE_KEYS.pause)) {
      this.covered = true;
      scene.pause(SCENE_KEYS.pause);
    } else if (!explaining && this.covered) {
      this.covered = false;
      scene.resume(SCENE_KEYS.pause);
    }
  }

  closePause(): void {
    if (!this.pauseOpen) {
      return;
    }
    const { scene } = this;
    scene.scene.stop(SCENE_KEYS.pause);
    this.covered = false;
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

  // The menu shown afresh, running: coverMenu pauses it again while an explanation is open.
  private restartPause(): void {
    this.covered = false;
    this.scene.scene.get(SCENE_KEYS.pause).scene.restart(this.pauseData());
  }

  private pauseData(): PauseSceneData {
    const answers = {
      onHeadHome: () => {
        this.closePause();
        this.host.headHome();
      },
      onResume: () => this.closePause(),
    };
    const overlay = this.pauseOverlay;
    this.pauseOverlay = undefined;
    if (this.pauseMode === "homeQuestion") {
      return { ...answers, mode: "homeQuestion", note: this.host.homeNote() };
    }
    return overlay === undefined
      ? { ...answers, mode: "menu" }
      : { ...answers, mode: "menu", overlay };
  }
}
