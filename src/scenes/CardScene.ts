import { Scene } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import { cardNumberForKey } from "../input/keyBindings";
import { cardRowRects, type CardRowSpec } from "../layout/cardRow";
import { screenLayout } from "../layout/screenLayout";
import { addCenteredLabel, addFilledRect } from "./draw";
import { SCENE_KEYS } from "./sceneKeys";

const CARD_COLOR = 0xf2e8cf;
const CARD_ROW: CardRowSpec = { cardHeight: 140, gap: 8, maxCount: 3 };
const DIM_ALPHA = 0.6;
const DIM_COLOR = 0x000000;

export interface CardSceneData {
  count: number;
}

// Dims only the road, so the HUD's top bar and dog column stay undimmed.
export class CardScene extends Scene {
  constructor() {
    super(SCENE_KEYS.card);
  }

  create({ count }: CardSceneData): void {
    const { road } = screenLayout(SCREEN_CONFIG);
    addFilledRect(this, DIM_COLOR, road).setAlpha(DIM_ALPHA);

    cardRowRects(CARD_ROW, count, road).forEach((rect, i) => {
      addFilledRect(this, CARD_COLOR, rect)
        .setInteractive()
        .on("pointerdown", () => this.choose());
      addCenteredLabel(this, `Card ${i + 1}`, rect);
    });

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (cardNumberForKey(count, event.key) !== undefined) {
        this.choose();
      }
    });
  }

  private choose(): void {
    this.scene.resume(SCENE_KEYS.run);
    this.scene.stop();
  }
}
