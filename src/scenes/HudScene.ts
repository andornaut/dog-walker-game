import { Scene } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "../layout/screenLayout";
import { addCenteredLabel, addFilledRect, LABEL_TEXT_STYLE } from "./draw";
import { SCENE_KEYS } from "./sceneKeys";

// Provisional wood palette from the art style guide (Endesga 32).
const DOG_COLUMN_COLOR = 0x733e39;
const DOG_SLOT_BORDER = { color: 0x3e2731, width: 2 };
const DOG_SLOT_COLOR = 0xead4aa;
const MONEY_TEXT_COLOR = "#feae34";
const TOP_BAR_COLOR = 0x3e2731;
const TOP_BAR_EDGE = { color: 0x733e39, height: 2 };
const TOP_BAR_TEXT_COLOR = "#ead4aa";
const TOP_BAR_TEXT_INSET = 12;

// Stays running and visible while choice cards are up.
export class HudScene extends Scene {
  constructor() {
    super(SCENE_KEYS.hud);
  }

  create(): void {
    const { dogColumn, dogSlots, topBar } = screenLayout(SCREEN_CONFIG);

    addFilledRect(this, TOP_BAR_COLOR, topBar);
    addFilledRect(this, TOP_BAR_EDGE.color, {
      ...topBar,
      height: TOP_BAR_EDGE.height,
      y: topBar.y + topBar.height - TOP_BAR_EDGE.height,
    });
    const textY = topBar.y + topBar.height / 2;
    const leftX = topBar.x + TOP_BAR_TEXT_INSET;
    const rightX = topBar.x + topBar.width - TOP_BAR_TEXT_INSET;
    this.add
      .text(leftX, textY, "$0", { ...LABEL_TEXT_STYLE, color: MONEY_TEXT_COLOR })
      .setOrigin(0, 0.5);
    this.add
      .text(rightX, textY, "Zone 1/4", { ...LABEL_TEXT_STYLE, color: TOP_BAR_TEXT_COLOR })
      .setOrigin(1, 0.5);

    addFilledRect(this, DOG_COLUMN_COLOR, dogColumn);
    dogSlots.forEach((slot, i) => {
      addFilledRect(this, DOG_SLOT_COLOR, slot).setStrokeStyle(
        DOG_SLOT_BORDER.width,
        DOG_SLOT_BORDER.color,
      );
      addCenteredLabel(this, `Dog ${i + 1}`, slot);
    });
  }
}
