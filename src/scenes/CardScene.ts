import { type GameObjects, Scene, type Time } from "phaser";

import { itemAt } from "../arrays";
import { SKIP_CARD_ART } from "../assets/cardArt";
import {
  CARD_FRAME_KEY,
  cardFrameTag,
  DIFFICULTY_KEY,
  encounterSpriteKey,
  forcedStopSpriteKey,
} from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { PLAIN_ITEM, tileState } from "../home/interaction";
import { DISABLED_COLORS } from "../home/selection";
import { RUN_TEXT_FIELDS } from "../hud/runText";
import { cardNumberForKey } from "../input/keyBindings";
import { keyNumbersShown } from "../input/keyNumbers";
import { CARD_LAYOUT, cardRowSpec, largeCardRect } from "../layout/cardLayout";
import { cardRowRects } from "../layout/cardRow";
import { rectIndexAt } from "../layout/grid";
import { insetRect, type Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import {
  type CardView,
  type Choice,
  firesText,
  MAX_CARD_OPTIONS,
  type OptionView,
} from "../rules/choices";
import { formatDollars } from "../rules/effectText";
import type { CardSource } from "../state/runState";
import { fillLine } from "../text/lines";
import { addDisplayText, hasDisplayFont } from "./displayText";
import { addDim, drawRing, fillRect } from "./draw";
import { greyTextureKey } from "./greyTextures";
import { listenOnePress } from "./onePress";
import { PALETTE } from "./palette";
import { addPixelText, type FontRole, scalePixelText } from "./pixelText";
import { currentSettings } from "./profileStore";
import { SCENE_KEYS } from "./sceneKeys";
import { addStandingSprite, playTag } from "./sprites";
import { tagFrame } from "./uiKit";

export interface CardSceneData {
  // Called with the option's data index, or "skip"; the run decides what happens next.
  onChoose: (choice: Choice) => void;
  view: CardView;
}

const CARD = CARD_LAYOUT;
const CARD_ROW = cardRowSpec(MAX_CARD_OPTIONS);
// Card-pixel positions of the frame's parts.
const BAND = CARD_LAYOUT.band;
const ART: Rect = CARD_LAYOUT.art;
const EFFECT: Rect = CARD_LAYOUT.effect;
const BADGE: Rect = CARD_LAYOUT.badge;
const SELECTED_OUTLINE = 2;
const COST_KEY = "card-cost";
// A refused pick shakes its card and flashes its cost.
const REFUSE = { flashMs: 80, flashes: 4, shake: 3, shakeMs: 40 };
// Holding a card this long enlarges it, with the changes behind its numbers.
const HOLD_MS = 400;
// A card's key number sits this far above its top, under the subtitle.
const KEY_NUMBER_RISE = 8;
const LARGE = { ...CARD_LAYOUT.large, key: "card-frame-large" };
// Marks an option that would fire an owner, over the plaque's left rivet: card-frame
// pixels, and card-frame-large pixels where it is drawn at 2x.
const FIRES_KEY = "ui-fires";
const FIRES_AT = { large: { x: 8, y: 238 }, small: { x: 4, y: 119 } };

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

// The option's illustration, or the Skip card's. A path card's is its zone's preview.
function illustrationKey(option: OptionView | undefined): string {
  return option === undefined ? SKIP_CARD_ART : option.art;
}

// Up to three cards over the dimmed road. The top bar and doghouses stay in view, and
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
    const { roadView: road } = screenLayout(SCREEN_CONFIG);
    addDim(this, road);

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
    if (view.source.kind === "fork" && hasDisplayFont(this, view.title)) {
      addDisplayText(this, centerX, top - 38, view.title, { color: PALETTE.white, originX: 0.5 });
    } else {
      this.centered(centerX + 1, top - 37, view.title, PALETTE.ink, title);
      this.centered(centerX, top - 38, view.title, PALETTE.white, title);
    }
    this.centered(centerX, top - 18, this.subtitle(view), PALETTE.white);

    const tag = cardFrameTag(gameData, view.source);
    this.entries.forEach((entry, i) => {
      const before = this.children.list.length;
      const rect = itemAt(this.cardRects, i);
      this.drawCard(view, tag, entry, rect);
      // Once a key has been pressed, each card shows the number key that picks it, above it.
      if (keyNumbersShown()) {
        this.centered(
          rect.x + rect.width / 2,
          rect.y - KEY_NUMBER_RISE,
          String(i + 1),
          PALETTE.amber,
          {
            font: "title",
          },
        );
      }
      this.parts[i] = this.children.list.slice(before);
    });
    this.outline = this.add.graphics();

    // A tap picks a card; holding one enlarges it until the finger lifts, and picks nothing.
    listenOnePress(this, {
      down: (pointer) => {
        const index = rectIndexAt(this.cardRects, pointer.x, pointer.y);
        this.pressed = index;
        this.drawOutline();
        if (index !== undefined) {
          this.holdTimer = this.time.delayedCall(HOLD_MS, () => this.enlarge(index));
        }
      },
      up: (pointer, cancelled) => {
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
        if (!cancelled && index !== undefined && index === pressed) {
          this.choose(index);
        }
      },
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
      case "encounter":
      case "need": {
        const names = view.affected.map((dog) => gameData.dogs[dog].name);
        return names.length === 0 ? gameData.runText.card.pickOne : `${names.join(", ")}`;
      }
      case "forcedStop": {
        const names = view.affected.map((dog) => gameData.dogs[dog].name);
        return names.length === 0 ? gameData.runText.card.stopSubtitle : names.join(", ");
      }
      case "fork":
        return gameData.runText.card.forkSubtitle;
      default:
        return "";
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
        badge?.setTint(flashes % 2 === 1 ? PALETTE.red : PALETTE.navy);
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
    const { roadView: road } = screenLayout(SCREEN_CONFIG);
    const { x, y } = largeCardRect(road);
    const before = this.children.list.length;
    const tag = cardFrameTag(gameData, view.source);
    const g = this.add.graphics();
    if (this.textures.exists(LARGE.key)) {
      const frameName = tagFrame(this, LARGE.key, tag);
      this.add.sprite(x, y, LARGE.key, frameName).setOrigin(0);
    } else {
      const card = { height: LARGE.height, width: LARGE.width, x, y };
      fillRect(g, PALETTE.plum, card);
      fillRect(g, PALETTE.cream, insetRect(4, card));
    }
    const option = entry.option;
    const label = option?.label ?? gameData.runText.card.skip;
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
        ? [gameData.runText.card.skipHeld]
        : option.breakdown.length === 0
          ? [option.text]
          : option.breakdown.map(({ dog, name, text }) =>
              [dog === null ? "" : `${gameData.dogs[dog].name}:`, text, name]
                .filter((part) => part !== "")
                .join(" "),
            );
    // An option that would fire an owner says so first, in dark red.
    let bodyY = y + LARGE.body.y;
    let bodyHeight: number = LARGE.body.height;
    if (option !== undefined && option.fires.length > 0) {
      const warning = addPixelText(
        this,
        x + LARGE.body.x,
        bodyY,
        firesText(gameData, option.fires),
        {
          color: PALETTE.darkRed,
          font: "title",
          maxWidth: LARGE.body.width,
        },
      );
      const used = Math.ceil(warning.height) + 4;
      bodyY += used;
      bodyHeight -= used;
    }
    const body = addPixelText(this, x + LARGE.body.x, bodyY, lines.join("\n"), {
      color: PALETTE.plum,
      maxWidth: LARGE.body.width,
      scale: 2,
    });
    if (body.height > bodyHeight) {
      scalePixelText(body, 1, x + LARGE.body.x, bodyY);
    }
    const badge = LARGE.badge;
    if (this.textures.exists(COST_KEY)) {
      this.add
        .image(x + badge.x, y + badge.y, COST_KEY)
        .setOrigin(0)
        .setScale(2);
    } else {
      fillRect(g, PALETTE.cream, { ...badge, x: x + badge.x, y: y + badge.y });
    }
    const marker =
      option !== undefined && option.fires.length > 0
        ? this.addFiresMarker(x + FIRES_AT.large.x, y + FIRES_AT.large.y, 2, false)
        : undefined;
    this.centered(
      this.plaqueCenter(x + badge.x, badge.width, marker),
      y + badge.y + 9,
      this.costText(entry),
      PALETTE.plum,
      {
        font: "title",
      },
    );
    this.enlarged = this.children.list.slice(before);
  }

  // ui-fires over the plaque's left rivet, pulsing unless motion is reduced. Returns its
  // right edge, or undefined while the art is missing, when the text flag stands alone.
  private addFiresMarker(x: number, y: number, scale: number, grey: boolean): number | undefined {
    if (!this.textures.exists(FIRES_KEY)) {
      return undefined;
    }
    const still = grey || currentSettings(this).reducedMotion;
    const frame = tagFrame(this, FIRES_KEY, "static");
    const key = grey ? greyTextureKey(this, FIRES_KEY) : FIRES_KEY;
    const marker = this.add.sprite(x, y, key, frame).setOrigin(0).setScale(scale);
    if (!still) {
      playTag(marker, FIRES_KEY, "pulse");
    }
    return x + marker.displayWidth;
  }

  // The plaque text's centre: the plaque's, or the part right of the fires marker.
  private plaqueCenter(left: number, width: number, marker: number | undefined): number {
    return marker === undefined ? left + width / 2 : (marker + left + width) / 2;
  }

  // A path card's plaque shows its zone's fee multiplier instead of a cost, and an upgrade
  // card's how long it lasts.
  private costText(entry: Entry): string {
    const option = entry.option;
    const text = gameData.runText.card;
    if (option?.path !== undefined) {
      return fillLine(RUN_TEXT_FIELDS.card, text, "forkFees", { fees: String(option.path.fees) });
    }
    if (option?.duration !== undefined) {
      return text.upgradeDuration[option.duration];
    }
    if (option === undefined || option.cost === 0) {
      return gameData.runText.card.free;
    }
    return option.availability.enabled
      ? `−${formatDollars(option.cost)}`
      : fillLine(RUN_TEXT_FIELDS.card, gameData.runText.card, "need", {
          amount: formatDollars(option.cost),
        });
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
    const grey = tileState({ ...PLAIN_ITEM, available: entry.enabled }) === "disabled";
    const g = this.add.graphics();
    if (this.textures.exists(CARD_FRAME_KEY)) {
      const frameName = tagFrame(this, CARD_FRAME_KEY, tag);
      const key = grey ? greyTextureKey(this, CARD_FRAME_KEY) : CARD_FRAME_KEY;
      this.add.sprite(x, y, key, frameName).setOrigin(0);
    } else {
      fillRect(g, PALETTE.plum, rect);
      fillRect(g, PALETTE.cream, insetRect(2, rect));
      fillRect(g, grey ? PALETTE.slate : PALETTE.red, {
        height: BAND.height,
        width: rect.width - 4,
        x: x + 2,
        y: y + BAND.y,
      });
    }

    // The band's label is in the title font, or the narrower body font if it would not fit.
    const label = entry.option?.label ?? gameData.runText.card.skip;
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

    // A path card shows its zone's difficulty as paws, then in words.
    const path = entry.option?.path;
    let effectY = y + EFFECT.y;
    if (path !== undefined) {
      const paws = tagFrame(this, DIFFICULTY_KEY, String(path.difficulty));
      if (paws !== undefined) {
        const image = this.add.image(x + CARD.width / 2, effectY, DIFFICULTY_KEY, paws);
        image.setOrigin(0.5, 0);
        effectY += image.height + 4;
      }
    }

    // An option that would fire an owner says so at the foot of its effect, in dark red.
    const fires = entry.option?.fires ?? [];
    let effectHeight: number = EFFECT.height;
    if (fires.length > 0) {
      const warning = this.centered(
        x + EFFECT.x + EFFECT.width / 2,
        y + EFFECT.y + EFFECT.height,
        firesText(gameData, fires),
        grey ? PALETTE.slate : PALETTE.darkRed,
        { maxWidth: EFFECT.width },
      ).setOrigin(0.5, 1);
      effectHeight -= Math.ceil(warning.height) + 2;
    }

    // The effect at 2x where it fits the card, else at 1x; holding the card shows it larger.
    const text = path?.difficultyName ?? entry.option?.text ?? gameData.runText.card.skipEffect;
    const effect = this.centered(
      x + EFFECT.x + EFFECT.width / 2,
      effectY,
      text,
      grey ? PALETTE[DISABLED_COLORS.text] : PALETTE.plum,
      { maxWidth: EFFECT.width, scale: 2 },
    );
    // A word too long to wrap, such as a difficulty, is wider than its wrap width.
    if (effect.height > effectHeight || effect.width > EFFECT.width) {
      scalePixelText(effect, 1, x + EFFECT.x + EFFECT.width / 2, effectY);
    }

    const badge = { ...BADGE, x: x + BADGE.x, y: y + BADGE.y };
    if (this.textures.exists(COST_KEY)) {
      const key = grey ? greyTextureKey(this, COST_KEY) : COST_KEY;
      this.add.image(badge.x, badge.y, key).setOrigin(0);
    } else {
      fillRect(g, grey ? PALETTE.lightGrey : PALETTE.cream, badge);
    }
    const marker =
      fires.length > 0
        ? this.addFiresMarker(x + FIRES_AT.small.x, y + FIRES_AT.small.y, 1, grey)
        : undefined;
    this.badges.push(
      this.centered(
        this.plaqueCenter(badge.x, badge.width, marker),
        badge.y + 4,
        this.costText(entry),
        grey ? PALETTE.navy : PALETTE.plum,
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
    drawRing(outline, PALETTE.amber, insetRect(-SELECTED_OUTLINE, rect), SELECTED_OUTLINE);
  }
}
