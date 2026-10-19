import { type GameObjects, type Input, Scene } from "phaser";

import { itemAt } from "../arrays";
import { animationKey } from "../assets/asepriteAnimations";
import { cardArtCandidates, SKIP_CARD_ART } from "../assets/cardArt";
import {
  CARD_FRAME_KEY,
  cardFrameTag,
  encounterSpriteKey,
  forcedStopSpriteKey,
} from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { cardNumberForKey } from "../input/keyBindings";
import { cardRowRects, type CardRowSpec } from "../layout/cardRow";
import { rectIndexAt } from "../layout/grid";
import type { Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { type CardView, type Choice, MAX_CARD_OPTIONS, type OptionView } from "../rules/choices";
import { formatDollars } from "../rules/effectText";
import type { CardSource } from "../state/runState";
import { fillRect } from "./draw";
import { greyTextureKey } from "./greyTextures";
import { PALETTE } from "./palette";
import { addPixelText, type FontRole } from "./pixelText";
import { SCENE_KEYS } from "./sceneKeys";
import { addStandingSprite, playTag } from "./sprites";

export interface CardSceneData {
  // Called with the option's data index, or "skip"; the run decides what happens next.
  onChoose: (choice: Choice) => void;
  view: CardView;
}

const CARD = { height: 140, width: 83 };
const CARD_ROW: CardRowSpec = { cardHeight: CARD.height, gap: 8, maxCount: MAX_CARD_OPTIONS };
// Card-pixel positions of the frame's parts.
const BAND = { height: 11, y: 2 };
const ART: Rect = { height: 56, width: 75, x: 5, y: 16 };
const EFFECT: Rect = { height: 42, width: 71, x: 6, y: 76 };
const BADGE: Rect = { height: 13, width: 71, x: 6, y: 121 };
const DIM_ALPHA = 0.6;
const SELECTED_OUTLINE = 2;

interface Entry {
  choice: Choice;
  enabled: boolean;
  option?: OptionView;
}

// The road sprite of whatever opened the card, standing in for an option's illustration.
function sourceSpriteKey(source: CardSource): string | undefined {
  switch (source.kind) {
    case "encounter":
      return encounterSpriteKey(source.encounter);
    case "forcedStop":
      return forcedStopSpriteKey(source.stop);
    default:
      return undefined;
  }
}

// The option's illustration: the key it names, or for now one found by its label.
function illustrationKey(
  scene: Scene,
  source: CardSource,
  option: OptionView | undefined,
): string | undefined {
  if (option === undefined) {
    return SKIP_CARD_ART;
  }
  const art = (option as { art?: unknown }).art;
  if (typeof art === "string") {
    return art;
  }
  return cardArtCandidates(source, option.label, option.index).find((key) =>
    scene.textures.exists(key),
  );
}

// Up to three cards over the dimmed road. The top bar and dog column stay in view, and
// the HUD marks the dogs the card affects. A disabled option is drawn in greys.
export class CardScene extends Scene {
  private cardRects: Rect[] = [];
  private entries: Entry[] = [];
  private onChoose: (choice: Choice) => void = () => undefined;
  private outline: GameObjects.Graphics | undefined;
  private pressed: number | undefined;

  constructor() {
    super(SCENE_KEYS.card);
  }

  create({ onChoose, view }: CardSceneData): void {
    this.onChoose = onChoose;
    this.pressed = undefined;
    const { road } = screenLayout(SCREEN_CONFIG);
    this.add
      .rectangle(road.x, road.y, road.width, road.height, PALETTE.ink, DIM_ALPHA)
      .setOrigin(0);

    this.entries = [
      ...view.options.map((option) => ({
        choice: option.index,
        enabled: option.availability.enabled,
        option,
      })),
      ...(view.skip ? [{ choice: "skip" as const, enabled: true }] : []),
    ];
    this.cardRects = cardRowRects(CARD_ROW, this.entries.length, road).map((rect) => ({
      ...rect,
      height: CARD.height,
      width: CARD.width,
      x: Math.round(rect.x),
      y: Math.round(rect.y),
    }));
    const top = itemAt(this.cardRects, 0).y;
    const centerX = road.x + road.width / 2;
    const title = { font: "title", scale: 2 } as const;
    this.centered(centerX + 1, top - 37, view.title, PALETTE.ink, title);
    this.centered(centerX, top - 38, view.title, PALETTE.white, title);
    this.centered(centerX, top - 18, this.subtitle(view), PALETTE.cream);

    const tag = cardFrameTag(gameData, view.source);
    this.entries.forEach((entry, i) => this.drawCard(view, tag, entry, itemAt(this.cardRects, i)));
    this.outline = this.add.graphics();

    this.input.on("pointerdown", (pointer: Input.Pointer) => {
      const index = rectIndexAt(this.cardRects, pointer.x, pointer.y);
      this.pressed = index !== undefined && this.entries[index]?.enabled ? index : undefined;
      this.drawOutline();
    });
    this.input.on("pointerup", (pointer: Input.Pointer) => {
      const index = rectIndexAt(this.cardRects, pointer.x, pointer.y);
      const pressed = this.pressed;
      this.pressed = undefined;
      this.drawOutline();
      if (index !== undefined && index === pressed) {
        this.choose(index);
      }
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const number = cardNumberForKey(this.entries.length, event.key);
      if (number !== undefined) {
        this.choose(number - 1);
      }
    });
    // Tapping and holding a card to enlarge it, with the modifiers behind its numbers, is
    // still to come; a tap chooses.
  }

  private subtitle(view: CardView): string {
    switch (view.source.kind) {
      case "encounter": {
        const names = view.affected.map((dog) => gameData.dogs[dog].name);
        return names.length === 0 ? "Pick one" : `${names.join(", ")}`;
      }
      case "forcedStop":
        return "A stop on the way";
      default:
        return "Pick one for the rest of the walk";
    }
  }

  private choose(index: number): void {
    const entry = this.entries[index];
    if (entry?.enabled) {
      this.onChoose(entry.choice);
    }
  }

  private centered(
    x: number,
    y: number,
    text: string,
    color: number,
    style: { font?: FontRole; maxWidth?: number; scale?: number } = {},
  ): GameObjects.BitmapText {
    return addPixelText(this, x, y, text, { align: "center", color, originX: 0.5, ...style });
  }

  private drawCard(view: CardView, tag: string, entry: Entry, rect: Rect): void {
    const { x, y } = rect;
    const grey = !entry.enabled;
    const g = this.add.graphics();
    if (this.textures.exists(CARD_FRAME_KEY)) {
      const frameName = this.anims.get(animationKey(CARD_FRAME_KEY, tag))?.frames[0]?.textureFrame;
      const key = grey ? greyTextureKey(this, CARD_FRAME_KEY) : CARD_FRAME_KEY;
      this.add.sprite(x, y, key, frameName).setOrigin(0);
    } else {
      fillRect(g, PALETTE.plum, rect);
      fillRect(g, PALETTE.cream, {
        height: rect.height - 4,
        width: rect.width - 4,
        x: x + 2,
        y: y + 2,
      });
      fillRect(g, grey ? PALETTE.slate : PALETTE.red, {
        height: BAND.height,
        width: rect.width - 4,
        x: x + 2,
        y: y + BAND.y,
      });
    }

    // The band's label is in the title font, or the narrower body font if it would not fit.
    const label = entry.option?.label ?? "Skip";
    const bandX = x + CARD.width / 2;
    const bandLabel = this.centered(bandX, y + BAND.y + 3, label, PALETTE.white, { font: "title" });
    if (bandLabel.width > CARD.width - 6) {
      bandLabel.destroy();
      this.centered(bandX, y + BAND.y + 3, label, PALETTE.white);
    }

    const art = { ...ART, x: x + ART.x, y: y + ART.y };
    const illustration = illustrationKey(this, view.source, entry.option);
    if (illustration !== undefined && this.textures.exists(illustration)) {
      const key = grey ? greyTextureKey(this, illustration) : illustration;
      this.add.image(art.x, art.y, key).setOrigin(0).setCrop(0, 0, art.width, art.height);
    } else {
      const spriteKey = entry.option === undefined ? undefined : sourceSpriteKey(view.source);
      if (spriteKey !== undefined && this.textures.exists(spriteKey)) {
        const key = grey ? greyTextureKey(this, spriteKey) : spriteKey;
        const sprite = addStandingSprite(
          this,
          spriteKey,
          art.x + art.width / 2,
          art.y + art.height - 6,
        );
        if (grey) {
          sprite.setTexture(key);
        } else {
          ["idle", "walk", "wave"].forEach((idleTag) => playTag(sprite, spriteKey, idleTag));
        }
      } else {
        this.centered(
          art.x + art.width / 2,
          art.y + art.height / 2 - 5,
          "?",
          grey ? PALETTE.grey : PALETTE.cream,
          { font: "title", scale: 2 },
        );
      }
    }

    const text = entry.option?.text ?? "Poop bags: walk on, nothing happens.";
    this.centered(
      x + EFFECT.x + EFFECT.width / 2,
      y + EFFECT.y,
      text,
      grey ? PALETTE.slate : PALETTE.plum,
      {
        maxWidth: EFFECT.width,
      },
    );

    fillRect(g, grey ? PALETTE.navy : PALETTE.plum, { ...BADGE, x: x + BADGE.x, y: y + BADGE.y });
    const option = entry.option;
    const badge =
      option === undefined || option.cost === 0
        ? "Free"
        : option.availability.enabled
          ? `−${formatDollars(option.cost)}`
          : `Need ${formatDollars(option.cost)}`;
    this.centered(
      x + BADGE.x + BADGE.width / 2,
      y + BADGE.y + 4,
      badge,
      grey ? PALETTE.lightGrey : PALETTE.cream,
      { font: "title" },
    );
  }

  private drawOutline(): void {
    const outline = this.outline;
    if (outline === undefined) {
      return;
    }
    outline.clear();
    const rect = this.pressed === undefined ? undefined : this.cardRects[this.pressed];
    if (rect === undefined) {
      return;
    }
    const w = SELECTED_OUTLINE;
    fillRect(outline, PALETTE.amber, {
      height: w,
      width: rect.width + 2 * w,
      x: rect.x - w,
      y: rect.y - w,
    });
    fillRect(outline, PALETTE.amber, {
      height: w,
      width: rect.width + 2 * w,
      x: rect.x - w,
      y: rect.y + rect.height,
    });
    fillRect(outline, PALETTE.amber, { height: rect.height, width: w, x: rect.x - w, y: rect.y });
    fillRect(outline, PALETTE.amber, {
      height: rect.height,
      width: w,
      x: rect.x + rect.width,
      y: rect.y,
    });
  }
}
