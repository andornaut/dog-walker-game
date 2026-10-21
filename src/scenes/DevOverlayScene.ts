import { type GameObjects, Scene, Scenes } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import {
  DEV_OVERLAY_TOGGLE_EVENT,
  DEV_OVERLAY_VISIBLE_KEY,
  DEV_STATE_EVENT,
  devOverlayLines,
  devOverlayShown,
  type DevState,
} from "../dev/devOverlay";
import { pageRunSetup } from "../dev/pageRunSetup";
import { runSetupLink } from "../dev/runSetup";
import { screenLayout } from "../layout/screenLayout";
import { onSceneEvent } from "./overlay";
import { SCENE_KEYS } from "./sceneKeys";

const DEV_OVERLAY_SCENE_KEY = "dev-overlay";

const INSET = 2;
const REDRAW_INTERVAL_MS = 250;
const STATUS_DURATION_MS = 2000;
const TEXT_STYLE = {
  backgroundColor: "#000000b3",
  color: "#ffffff",
  fontFamily: "monospace",
  fontSize: "9px",
  padding: { x: 3, y: 2 },
};

// Starts with the game and runs for the page's life, so the backquote key can show it at any
// time; dev=1 shows it from the start. It draws only while the run scene is active. Listed last in
// the game config to draw over every scene.
// It learns about the run only from DEV_STATE_EVENT on game.events, and shows or hides on
// DEV_OVERLAY_TOGGLE_EVENT, keeping DEV_OVERLAY_VISIBLE_KEY in the registry current.
export class DevOverlayScene extends Scene {
  private runActive = false;
  private sinceRedrawMs = 0;
  private state: DevState | undefined;
  private status: { readonly text: string; readonly untilMs: number } | undefined;
  private text?: GameObjects.Text;
  // Whether the player or the URL wants the overlay, apart from whether the run scene is up.
  private wanted = false;

  constructor() {
    super({ active: true, key: DEV_OVERLAY_SCENE_KEY });
  }

  create(): void {
    const { road } = screenLayout(SCREEN_CONFIG);
    this.wanted = pageRunSetup().setup.dev;
    this.runActive = this.scene.isActive(SCENE_KEYS.run);
    this.text = this.add.text(road.x + INSET, road.y + INSET, "", TEXT_STYLE);
    this.applyVisible();

    this.game.registry.set(DEV_OVERLAY_VISIBLE_KEY, this.wanted);

    onSceneEvent(this, this.game.events, DEV_STATE_EVENT, (state: DevState) => {
      this.state = state;
    });
    onSceneEvent(this, this.game.events, DEV_OVERLAY_TOGGLE_EVENT, (visible: boolean) =>
      this.setVisible(visible),
    );
    const runEvents = this.scene.get(SCENE_KEYS.run).events;
    const runListeners: readonly (readonly [string, () => void])[] = [
      [Scenes.Events.START, () => this.setRunActive(true)],
      [Scenes.Events.WAKE, () => this.setRunActive(true)],
      [Scenes.Events.SHUTDOWN, () => this.setRunActive(false)],
      [Scenes.Events.SLEEP, () => this.setRunActive(false)],
    ];
    for (const [event, listener] of runListeners) {
      onSceneEvent(this, runEvents, event, listener);
    }

    // Matched on the physical key, so the toggle sits in the same place on every layout.
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.code === "Backquote") {
        this.setVisible(!this.wanted);
      } else if (event.key.toLowerCase() === "c" && this.text?.visible === true) {
        this.copyLink();
      }
    });
  }

  override update(_time: number, delta: number): void {
    this.sinceRedrawMs += delta;
    if (this.sinceRedrawMs >= REDRAW_INTERVAL_MS) {
      this.redraw();
    }
  }

  private setVisible(wanted: boolean): void {
    this.wanted = wanted;
    this.game.registry.set(DEV_OVERLAY_VISIBLE_KEY, wanted);
    this.applyVisible();
  }

  private setRunActive(active: boolean): void {
    this.runActive = active;
    this.applyVisible();
  }

  private applyVisible(): void {
    this.text?.setVisible(devOverlayShown(this.wanted, this.runActive));
    this.redraw();
  }

  private redraw(): void {
    this.sinceRedrawMs = 0;
    if (this.text?.visible !== true) {
      return;
    }
    const now = this.time.now;
    if (this.status !== undefined && now >= this.status.untilMs) {
      this.status = undefined;
    }
    this.text.setText(
      devOverlayLines(this.game.loop.actualFps, this.status?.text, this.setup(), this.state),
    );
  }

  // The running scene's setup once it reports one, else the URL's.
  private setup() {
    return this.state?.setup ?? pageRunSetup().setup;
  }

  // The link always goes to the console too: the clipboard needs a secure context and
  // permission, and is undefined without a secure context.
  private copyLink(): void {
    const link = runSetupLink(globalThis.location.href, this.setup());
    console.info(`Run link: ${link}`);
    const clipboard: Clipboard | undefined = globalThis.navigator.clipboard;
    if (clipboard === undefined) {
      this.showStatus("no clipboard: link in console");
      return;
    }
    clipboard.writeText(link).then(
      () => this.showStatus("link copied"),
      () => this.showStatus("copy failed: link in console"),
    );
  }

  private showStatus(text: string): void {
    this.status = { text, untilMs: this.time.now + STATUS_DURATION_MS };
    this.redraw();
  }
}
