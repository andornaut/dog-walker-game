import { type GameObjects, type Input, Scene, type Time } from "phaser";

import { itemAt } from "../arrays";
import { animationKey } from "../assets/asepriteAnimations";
import { SKIP_CARD_ART } from "../assets/cardArt";
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
import { currentSettings } from "./profileStore";
import { SCENE_KEYS } from "./sceneKeys";
import { addStandingSprite, playTag } from "./sprites";

export interface CardSceneData {
  // Called with the option's data index, or "skip"; the run decides what happens next.
  onChoose: (choice: Choice) => void;
  view: CardView;
}

const CARD = { height: 140, width: 83 };
const CARD_ROW: CardRowSpec = {
  cardHeight: CARD.height,
  cardWidth: CARD.width,
  gap: 8,
  maxCount: MAX_CARD_OPTIONS,
};
// Card-pixel positions of the frame's parts.
const BAND = { height: 11, y: 2 };
const ART: Rect = { height: 56, width: 75, x: 5, y: 16 };
const EFFECT: Rect = { height: 42, width: 71, x: 6, y: 76 };
const BADGE: Rect = { height: 13, width: 71, x: 6, y: 121 };
const DIM_ALPHA = 0.6;
const SELECTED_OUTLINE = 2;
const COST_KEY = "card-cost";
// A refused pick shakes its card and flashes its cost.
const REFUSE = { flashMs: 80, flashes: 4, shake: 3, shakeMs: 40 };
// Holding a card this long enlarges it, with the changes behind its numbers.
const HOLD_MS = 400;
const LARGE = {
  art: { x: 10, y: 32 },
  badge: { height: 26, width: 142, x: 12, y: 242 },
  band: { height: 18, y: 4 },
  body: { height: 82, width: 142, x: 12, y: 152 },
  height: 280,
  key: "card-frame-large",
  width: 166,
};

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

// The option's illustration, or the Skip card's.
function illustrationKey(option: OptionView | undefined): string {
  return option === undefined ? SKIP_CARD_ART : option.art;
}

// Up to three cards over the dimmed road. The top bar and dog column stay in view, and
// the HUD marks the dogs the card affects. A disabled option is drawn in greys.
export class CardScene extends Scene {
  private cardRects: Rect[] = [];
  private entries: Entry[] = [];
  private onChoose: (choice: Choice) => void = () => undefined;
  private badges: (GameObjects.BitmapText | undefined)[] = [];
  private enlarged: GameObjects.GameObject[] = [];
  private holdTimer: Time.TimerEvent | undefined;
  private outline: GameObjects.Graphics | undefined;
  private parts: GameObjects.GameObject[][] = [];
  private pressed: number | undefined;
  private refusing = false;
  private view: CardView | undefined;

  constructor() {
    super(SCENE_KEYS.card);
  }

  create({ onChoose, view }: CardSceneData): void {
    this.onChoose = onChoose;
    this.pressed = undefined;
    this.view = view;
    this.badges = [];
    this.enlarged = [];
    this.holdTimer = undefined;
    this.parts = [];
    this.refusing = false;
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
    this.cardRects = cardRowRects(CARD_ROW, this.entries.length, road);
    const top = itemAt(this.cardRects, 0).y;
    const centerX = road.x + road.width / 2;
    const title = { font: "title", scale: 2 } as const;
    this.centered(centerX + 1, top - 37, view.title, PALETTE.ink, title);
    this.centered(centerX, top - 38, view.title, PALETTE.white, title);
    this.centered(centerX, top - 18, this.subtitle(view), PALETTE.white);

    const tag = cardFrameTag(gameData, view.source);
    this.entries.forEach((entry, i) => {
      const before = this.children.list.length;
      this.drawCard(view, tag, entry, itemAt(this.cardRects, i));
      this.parts[i] = this.children.list.slice(before);
    });
    this.outline = this.add.graphics();

    // A tap picks a card; holding one enlarges it until the finger lifts, and picks nothing.
    this.input.on("pointerdown", (pointer: Input.Pointer) => {
      const index = rectIndexAt(this.cardRects, pointer.x, pointer.y);
      this.pressed = index;
      this.drawOutline();
      if (index !== undefined) {
        this.holdTimer = this.time.delayedCall(HOLD_MS, () => this.enlarge(index));
      }
    });
    this.input.on("pointerup", (pointer: Input.Pointer) => {
      const index = rectIndexAt(this.cardRects, pointer.x, pointer.y);
      const pressed = this.pressed;
      this.pressed = undefined;
      this.holdTimer?.remove();
      this.holdTimer = undefined;
      this.drawOutline();
      if (this.enlarged.length > 0) {
        this.enlarged.forEach((part) => part.destroy());
        this.enlarged = [];
        return;
      }
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
  }

  private subtitle(view: CardView): string {
    switch (view.source.kind) {
      case "encounter": {
        const names = view.affected.map((dog) => gameData.dogs[dog].name);
        return names.length === 0 ? "Pick one" : `${names.join(", ")}`;
      }
      case "forcedStop": {
        const names = view.affected.map((dog) => gameData.dogs[dog].name);
        return names.length === 0 ? "A stop on the way" : names.join(", ");
      }
      default:
        return "Pick one for the rest of the walk";
    }
  }

  private choose(index: number): void {
    const entry = this.entries[index];
    if (entry?.enabled) {
      this.onChoose(entry.choice);
    } else if (entry !== undefined) {
      this.refuse(index);
    }
  }

  // An option the player cannot afford shakes its card, unless motion is reduced, and
  // flashes its cost, so the player knows to pick another.
  private refuse(index: number): void {
    if (this.refusing) {
      return;
    }
    this.refusing = true;
    const parts = this.parts[index] ?? [];
    if (!currentSettings(this).reducedMotion) {
      this.tweens.add({
        duration: REFUSE.shakeMs,
        repeat: 3,
        targets: parts,
        x: `+=${REFUSE.shake}`,
        yoyo: true,
      });
    }
    const badge = this.badges[index];
    let flashes = 0;
    this.time.addEvent({
      callback: () => {
        flashes += 1;
        badge?.setTint(flashes % 2 === 1 ? PALETTE.red : PALETTE.lightGrey);
        if (flashes >= REFUSE.flashes) {
          this.refusing = false;
        }
      },
      delay: REFUSE.flashMs,
      repeat: REFUSE.flashes - 1,
    });
  }

  // The card at twice the size over the road, its illustration at 2x and, in its body, every
  // change it would make, cause by cause.
  private enlarge(index: number): void {
    const entry = this.entries[index];
    const view = this.view;
    if (entry === undefined || view === undefined || this.enlarged.length > 0) {
      return;
    }
    this.pressed = undefined;
    this.drawOutline();
    const { road } = screenLayout(SCREEN_CONFIG);
    const x = road.x + Math.floor((road.width - LARGE.width) / 2);
    const y = road.y + Math.floor((road.height - LARGE.height) / 2);
    const before = this.children.list.length;
    const tag = cardFrameTag(gameData, view.source);
    const g = this.add.graphics();
    if (this.textures.exists(LARGE.key)) {
      const frameName = this.anims.get(animationKey(LARGE.key, tag))?.frames[0]?.textureFrame;
      this.add.sprite(x, y, LARGE.key, frameName).setOrigin(0);
    } else {
      fillRect(g, PALETTE.plum, { height: LARGE.height, width: LARGE.width, x, y });
      fillRect(g, PALETTE.cream, {
        height: LARGE.height - 8,
        width: LARGE.width - 8,
        x: x + 4,
        y: y + 4,
      });
    }
    const option = entry.option;
    const label = option?.label ?? "Skip";
    this.centered(x + LARGE.width / 2, y + LARGE.band.y + 5, label, this.bandColor(tag), {
      font: "title",
    });
    const art = illustrationKey(option);
    if (this.textures.exists(art)) {
      this.add
        .image(x + LARGE.art.x, y + LARGE.art.y, art)
        .setOrigin(0)
        .setScale(2)
        .setCrop(0, 0, ART.width, ART.height);
    }
    const lines =
      option === undefined
        ? ["Walk on: nothing happens."]
        : option.breakdown.length === 0
          ? [option.text]
          : option.breakdown.map(({ dog, name, text }) =>
              dog === null ? `${text} ${name}` : `${gameData.dogs[dog].name}: ${text} ${name}`,
            );
    const body = addPixelText(this, x + LARGE.body.x, y + LARGE.body.y, lines.join("\n"), {
      color: PALETTE.plum,
      maxWidth: LARGE.body.width / 2,
      scale: 2,
    });
    if (body.height > LARGE.body.height) {
      body.setScale(1).setMaxWidth(LARGE.body.width);
    }
    const badge = LARGE.badge;
    if (this.textures.exists(COST_KEY)) {
      this.add
        .image(x + badge.x, y + badge.y, COST_KEY)
        .setOrigin(0)
        .setScale(2);
    } else {
      fillRect(g, PALETTE.plum, { ...badge, x: x + badge.x, y: y + badge.y });
    }
    this.centered(
      x + badge.x + badge.width / 2,
      y + badge.y + 9,
      this.costText(entry),
      PALETTE.cream,
      {
        font: "title",
      },
    );
    this.enlarged = this.children.list.slice(before);
  }

  private costText(entry: Entry): string {
    const option = entry.option;
    if (option === undefined || option.cost === 0) {
      return "Free";
    }
    return option.availability.enabled
      ? `−${formatDollars(option.cost)}`
      : `Need ${formatDollars(option.cost)}`;
  }

  // The forced-stop band is amber, so its label is plum; every other band's is white.
  private bandColor(tag: string): number {
    return tag === "stop" ? PALETTE.plum : PALETTE.white;
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
    const bandColor = this.bandColor(tag);
    const bandLabel = this.centered(bandX, y + BAND.y + 3, label, bandColor, { font: "title" });
    if (bandLabel.width > CARD.width - 6) {
      bandLabel.destroy();
      this.centered(bandX, y + BAND.y + 3, label, bandColor);
    }

    const art = { ...ART, x: x + ART.x, y: y + ART.y };
    const illustration = illustrationKey(entry.option);
    if (this.textures.exists(illustration)) {
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

    // The effect at 2x where it fits the card, else at 1x; holding the card shows it larger.
    const text = entry.option?.text ?? "Poop bags: walk on, nothing happens.";
    const effect = this.centered(
      x + EFFECT.x + EFFECT.width / 2,
      y + EFFECT.y,
      text,
      grey ? PALETTE.slate : PALETTE.plum,
      { maxWidth: EFFECT.width / 2, scale: 2 },
    );
    if (effect.height > EFFECT.height) {
      effect.setScale(1).setMaxWidth(EFFECT.width);
    }

    const badge = { ...BADGE, x: x + BADGE.x, y: y + BADGE.y };
    if (this.textures.exists(COST_KEY)) {
      const key = grey ? greyTextureKey(this, COST_KEY) : COST_KEY;
      this.add.image(badge.x, badge.y, key).setOrigin(0);
    } else {
      fillRect(g, grey ? PALETTE.navy : PALETTE.plum, badge);
    }
    this.badges.push(
      this.centered(
        badge.x + badge.width / 2,
        badge.y + 4,
        this.costText(entry),
        grey ? PALETTE.lightGrey : PALETTE.cream,
        { font: "title" },
      ),
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
