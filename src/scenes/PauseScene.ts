import { type Input, Scene } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import { cardNumberForKey, isPauseKey } from "../input/keyBindings";
import { rectIndexAt } from "../layout/grid";
import type { Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { drawFramedRect, fillRect } from "./draw";
import { openHelp } from "./helpScreen";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import { SCENE_KEYS } from "./sceneKeys";

export interface PauseSceneData {
  onHeadHome: () => void;
  onResume: () => void;
}

const PANEL = { height: 176, width: 220 };
const BUTTON = { gap: 8, height: 32, width: 188 };
const DIM_ALPHA = 0.6;

interface MenuButton {
  label: string;
  note?: string;
  press: () => void;
  primary: boolean;
}

// The pause menu over the dimmed road: keep walking, how to walk, or head home.
export class PauseScene extends Scene {
  private buttons: MenuButton[] = [];
  private pressed: number | undefined;
  private rects: Rect[] = [];

  constructor() {
    super(SCENE_KEYS.pause);
  }

  create({ onHeadHome, onResume }: PauseSceneData): void {
    const { road } = screenLayout(SCREEN_CONFIG);
    this.add
      .rectangle(road.x, road.y, road.width, road.height, PALETTE.ink, DIM_ALPHA)
      .setOrigin(0);
    this.buttons = [
      { label: "Keep walking", press: onResume, primary: true },
      { label: "How to walk", press: () => openHelp(this, SCENE_KEYS.pause), primary: false },
      {
        label: "Head home",
        note: "Keeps tips and earlier zones' fees",
        press: onHeadHome,
        primary: false,
      },
    ];

    const panel: Rect = {
      ...PANEL,
      x: Math.round(road.x + (road.width - PANEL.width) / 2),
      y: Math.round(road.y + (road.height - PANEL.height) / 2),
    };
    const g = this.add.graphics();
    drawFramedRect(g, { border: PALETTE.plum, fill: PALETTE.darkBrown }, panel);
    const center = panel.x + panel.width / 2;
    const title = "Paused";
    addPixelText(this, center, panel.y + 12, title, {
      color: PALETTE.cream,
      font: "title",
      originX: 0.5,
      scale: 2,
    });

    this.rects = this.buttons.map((_, i) => ({
      height: BUTTON.height,
      width: BUTTON.width,
      x: Math.round(center - BUTTON.width / 2),
      y: panel.y + 36 + i * (BUTTON.height + BUTTON.gap),
    }));
    this.buttons.forEach((button, i) => {
      const rect = this.rects[i];
      if (rect === undefined) {
        return;
      }
      const lip = button.primary ? PALETTE.orange : PALETTE.brown;
      const face = button.primary ? PALETTE.amber : PALETTE.tan;
      fillRect(g, lip, { ...rect, height: rect.height, y: rect.y });
      fillRect(g, face, { ...rect, height: rect.height - 3 });
      const labelY = button.note === undefined ? rect.y + 11 : rect.y + 6;
      addPixelText(this, center, labelY, button.label, {
        color: PALETTE.plum,
        font: "title",
        originX: 0.5,
      });
      if (button.note !== undefined) {
        addPixelText(this, center, rect.y + 17, button.note, {
          color: PALETTE.darkBrown,
          originX: 0.5,
        });
      }
    });

    this.input.on("pointerdown", (pointer: Input.Pointer) => {
      this.pressed = rectIndexAt(this.rects, pointer.x, pointer.y);
    });
    this.input.on("pointerup", (pointer: Input.Pointer) => {
      const index = rectIndexAt(this.rects, pointer.x, pointer.y);
      if (index !== undefined && index === this.pressed) {
        this.buttons[index]?.press();
      }
      this.pressed = undefined;
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (isPauseKey(event.key)) {
        onResume();
        return;
      }
      const number = cardNumberForKey(this.buttons.length, event.key);
      if (number !== undefined) {
        this.buttons[number - 1]?.press();
      }
    });
  }
}
