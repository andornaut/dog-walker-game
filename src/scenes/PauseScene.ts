import { type Input, Scene } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import { wrapWords } from "../home/home";
import { cardNumberForKey, isPauseKey } from "../input/keyBindings";
import { rectIndexAt } from "../layout/grid";
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

// Buttons are 44 game pixels tall (48 CSS pixels on a phone) with 8 between them.
const PANEL = { height: 300, width: 264 };
const BUTTON = { gap: 8, height: 44, width: 216 };
const NOTE = { chars: 30, lineHeight: 16 };
const DIM_ALPHA = 0.6;

interface MenuEntry {
  label: string;
  press: () => void;
}

// The pause menu over the dimmed road: resume, head home, help or settings.
export class PauseScene extends Scene {
  private buttons: MenuButton[] = [];
  private entries: MenuEntry[] = [];
  private pressed: number | undefined;

  constructor() {
    super(SCENE_KEYS.pause);
  }

  create({ onHeadHome, onResume }: PauseSceneData): void {
    this.pressed = undefined;
    const { road } = screenLayout(SCREEN_CONFIG);
    this.add
      .rectangle(road.x, road.y, road.width, road.height, PALETTE.ink, DIM_ALPHA)
      .setOrigin(0);
    this.entries = [
      { label: "Resume", press: onResume },
      {
        label: "Head home",
        press: () => {
          soundboardOf(this).stopMusic();
          onHeadHome();
        },
      },
      { label: "Help", press: () => openHelp(this, SCENE_KEYS.pause) },
      { label: "Settings", press: () => this.openSettings() },
    ];

    const panel: Rect = {
      ...PANEL,
      x: Math.round(road.x + (road.width - PANEL.width) / 2),
      y: Math.round(road.y + (road.height - PANEL.height) / 2),
    };
    // A 1px tan rim keeps the panel's edge clear of the dimmed road.
    fillRect(this.add.graphics(), PALETTE.tan, {
      height: panel.height + 2,
      width: panel.width + 2,
      x: panel.x - 1,
      y: panel.y - 1,
    });
    addPanel(this, panel);
    const center = panel.x + panel.width / 2;
    addPixelText(this, center, panel.y + 12, "Paused", {
      color: PALETTE.plum,
      font: "title",
      originX: 0.5,
      scale: TEXT_SCALE,
    });

    const top = panel.y + 34;
    this.buttons = this.entries.map((entry, i) =>
      addMenuButton(
        this,
        {
          height: BUTTON.height,
          width: BUTTON.width,
          x: Math.round(center - BUTTON.width / 2),
          y: top + i * (BUTTON.height + BUTTON.gap),
        },
        entry.label,
      ),
    );
    const noteTop = top + this.entries.length * (BUTTON.height + BUTTON.gap) + 2;
    wrapWords(NOTE.chars, "Head home keeps tips and earlier zones' fees.").forEach((line, i) => {
      addPixelText(this, center, noteTop + i * NOTE.lineHeight, line, {
        color: PALETTE.plum,
        originX: 0.5,
        scale: TEXT_SCALE,
      });
    });

    const rects = () => this.buttons.map((button) => button.rect);
    this.input.on("pointerdown", (pointer: Input.Pointer) => {
      this.pressed = rectIndexAt(rects(), pointer.x, pointer.y);
      this.showPressed();
    });
    this.input.on("pointerup", (pointer: Input.Pointer) => {
      const index = rectIndexAt(rects(), pointer.x, pointer.y);
      const pressed = this.pressed;
      this.pressed = undefined;
      this.showPressed();
      if (index !== undefined && index === pressed) {
        this.entries[index]?.press();
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

  private openSettings(): void {
    const data: SettingsSceneData = { resume: SCENE_KEYS.pause };
    this.scene.pause();
    this.scene.launch(SCENE_KEYS.settings, data);
  }
}
