import { type Input, Scene } from "phaser";

import { itemAt } from "../arrays";
import { remapDarker } from "../assets/darkRamp";
import { SCREEN_CONFIG } from "../data/screen";
import { pauseMenuLayout, type PauseMenuTarget, pauseMenuTargetAt } from "../hud/pauseMenu";
import { cardNumberForKey, isPauseKey } from "../input/keyBindings";
import type { Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { fillRect } from "./draw";
import { openHelp } from "./helpScreen";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import { SCENE_KEYS } from "./sceneKeys";
import type { SettingsSceneData } from "./SettingsScene";
import { soundboardOf } from "./soundboard";
import { addMenuButton, addPanel, type MenuButton, TEXT_SCALE } from "./uiKit";

export interface PauseSceneData {
  onHeadHome: () => void;
  onResume: () => void;
}

// The road under the menu is redrawn this many steps down each colour's ramp.
const DIM_STEPS = 2;
const DIM_TEXTURE = "pause-dim";
// Stands in for the darkened road when the renderer gives no snapshot to remap.
const DIM_ALPHA = 0.6;

interface MenuEntry {
  label: string;
  press: () => void;
}

// The pause menu over the dimmed road: resume, help, settings or head home. The top bar's
// pause button shows play while it is up, and a press there resumes too.
export class PauseScene extends Scene {
  private buttons: MenuButton[] = [];
  private entries: MenuEntry[] = [];
  private pressed: PauseMenuTarget | undefined;

  constructor() {
    super(SCENE_KEYS.pause);
  }

  create({ onHeadHome, onResume }: PauseSceneData): void {
    this.pressed = undefined;
    const { road } = screenLayout(SCREEN_CONFIG);
    this.dimRoad(road);
    this.entries = [
      { label: "Resume", press: onResume },
      { label: "Help", press: () => openHelp(this, SCENE_KEYS.pause) },
      { label: "Settings", press: () => this.openSettings() },
      {
        label: "Head home",
        press: () => {
          soundboardOf(this).stopMusic();
          onHeadHome();
        },
      },
    ];
    const layout = pauseMenuLayout(road, this.entries.length);
    const { panel } = layout;

    // A 1px tan rim keeps the panel's edge clear of the dimmed road.
    const rim = this.add.graphics();
    fillRect(rim, PALETTE.tan, { ...panel, height: panel.height + 2, y: panel.y - 1 });
    fillRect(rim, PALETTE.tan, { ...panel, width: panel.width + 2, x: panel.x - 1 });
    addPanel(this, panel);
    const center = panel.x + panel.width / 2;
    addPixelText(this, center, layout.titleY, "Paused", {
      color: PALETTE.plum,
      font: "title",
      originX: 0.5,
      scale: TEXT_SCALE,
    });
    this.buttons = this.entries.map((entry, i) =>
      addMenuButton(this, itemAt(layout.buttons, i), entry.label),
    );
    fillRect(this.add.graphics(), PALETTE.tan, layout.notePlate);
    addPixelText(this, center, layout.notePlate.y + 6, "Keeps tips and earlier zones' fees", {
      color: PALETTE.plum,
      originX: 0.5,
    });

    // A press counts where it began and ended on the same target, so the release that resumes
    // the walk is never the road's.
    this.input.on("pointerdown", (pointer: Input.Pointer) => {
      this.pressed = pauseMenuTargetAt(layout.hits, pointer.x, pointer.y);
      this.showPressed();
    });
    this.input.on("pointerup", (pointer: Input.Pointer) => {
      const target = pauseMenuTargetAt(layout.hits, pointer.x, pointer.y);
      const pressed = this.pressed;
      this.pressed = undefined;
      this.showPressed();
      if (target === undefined || target !== pressed) {
        return;
      }
      if (target === "resume") {
        onResume();
      } else {
        this.entries[target]?.press();
      }
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (isPauseKey(event.key)) {
        onResume();
        return;
      }
      const number = cardNumberForKey(this.entries.length, event.key);
      if (number !== undefined) {
        this.entries[number - 1]?.press();
      }
    });
  }

  private showPressed(): void {
    this.buttons.forEach((button, i) => button.setState(i === this.pressed ? "pressed" : "normal"));
  }

  // The frozen road read back from the next frame and redrawn darker. The panel drawn over
  // it in that frame is darkened too, but this image sits under the panel.
  private dimRoad(road: Rect): void {
    const shade = this.add
      .rectangle(road.x, road.y, road.width, road.height, PALETTE.ink, DIM_ALPHA)
      .setOrigin(0)
      .setVisible(false);
    const dim = this.add.image(road.x, road.y, "__DEFAULT").setOrigin(0).setVisible(false);
    const fallback = () => shade.setVisible(true);
    this.game.renderer.snapshotArea(road.x, road.y, road.width, road.height, (snapshot) => {
      if (!dim.active) {
        return;
      }
      if (!(snapshot instanceof HTMLImageElement)) {
        fallback();
        return;
      }
      if (this.textures.exists(DIM_TEXTURE)) {
        this.textures.remove(DIM_TEXTURE);
      }
      const texture = this.textures.createCanvas(DIM_TEXTURE, road.width, road.height);
      const context = texture?.getContext();
      if (texture === null || context === undefined) {
        fallback();
        return;
      }
      context.drawImage(snapshot, 0, 0);
      const pixels = context.getImageData(0, 0, road.width, road.height);
      remapDarker(DIM_STEPS, pixels.data);
      context.putImageData(pixels, 0, 0);
      texture.refresh();
      dim.setTexture(DIM_TEXTURE).setVisible(true);
    });
  }

  private openSettings(): void {
    const data: SettingsSceneData = { resume: SCENE_KEYS.pause };
    this.scene.pause();
    this.scene.launch(SCENE_KEYS.settings, data);
  }
}
