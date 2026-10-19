import { Scene } from "phaser";

import { SCREEN } from "../config";
import { cardRects, screenLayout } from "../layout";
import { addBox, addLabel } from "./shapes";

const CARD_COLOR = 0xf2e8cf;
const CARD_GAP = 8;
const CARD_HEIGHT = 140;
const DIM_ALPHA = 0.6;
const DIM_COLOR = 0x000000;
export const MAX_CARDS = 3;

export interface CardSceneData {
  count: number;
}

// One card per option (up to MAX_CARDS), centred over the dimmed road. Picking
// one resumes the run. The top bar and dog column are outside the road, so they
// stay undimmed.
export class CardScene extends Scene {
  constructor() {
    super("card");
  }

  create({ count }: CardSceneData): void {
    const { road } = screenLayout(SCREEN);
    addBox(this, DIM_COLOR, road).setAlpha(DIM_ALPHA);

    cardRects(MAX_CARDS, CARD_GAP, CARD_HEIGHT, count, road).forEach((rect, i) => {
      addBox(this, CARD_COLOR, rect)
        .setInteractive()
        .on("pointerdown", () => this.choose());
      addLabel(this, `Card ${i + 1}`, rect);
    });

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const choice = Number(event.key);
      if (choice >= 1 && choice <= count) {
        this.choose();
      }
    });
  }

  private choose(): void {
    this.scene.resume("run");
    this.scene.stop();
  }
}
