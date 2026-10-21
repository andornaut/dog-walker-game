import { type GameObjects, Scene } from "phaser";

import { itemAt } from "../arrays";
import { SKIP_CARD_ART } from "../assets/cardArt";
import { CARD_FRAME_KEY, cardFrameTag, DIFFICULTY_KEY } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { ZoneId } from "../data/types";
import { PLAIN_ITEM, tileState } from "../home/interaction";
import { DISABLED_COLORS } from "../home/selection";
import { RUN_TEXT_FIELDS } from "../hud/runText";
import { type HoldPress, type HoldRule, startHold, tickHold } from "../input/hold";
import { cardNumberForKey } from "../input/keyBindings";
import { keyNumbersShown } from "../input/keyNumbers";
import { CARD_LAYOUT, cardRowSpec, largeCardHeight, largeCardRect } from "../layout/cardLayout";
import { cardHeader, cardRowRects } from "../layout/cardRow";
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
import { encounterLook, type HasArt, type Look, skinnedArt, skinnedCardArt } from "../rules/skins";
import type { CardSource } from "../state/runState";
import { fillLine } from "../text/lines";
import { addDisplayText, hasDisplayFont } from "./displayText";
import { drawRing, fillRect } from "./draw";
import { greyTextureKey } from "./greyTextures";
import { PALETTE } from "./palette";
import { addPixelText, fontHasGlyphs, type FontRole, scalePixelText } from "./pixelText";
import { currentSettings } from "./profileStore";
import { addRampDim } from "./rampDim";
import { SCENE_KEYS } from "./sceneKeys";
import { addStandingSprite, playTag } from "./sprites";
import { listenTargetPress, type TargetPressListener } from "./targetPress";
import { addMenuButton, addNineSlice, listenButtonTap, tagFrame } from "./uiKit";

export interface CardSceneData {
  // Called with the option's data index, or "skip"; the run decides what happens next.
  onChoose: (choice: Choice) => void;
  // A fork card's Head home button, under the paths.
  onHeadHome: () => void;
  view: CardView;
  // The zone the card opened in, which picks an encounter's look.
  zone: ZoneId;
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
// Holding a card this long enlarges it, with the changes behind its numbers, however far
// the finger moves.
const CARD_HOLD: HoldRule = { holdMs: 400, slopPx: Number.POSITIVE_INFINITY };
const LARGE = { ...CARD_LAYOUT.large, key: "card-frame-large" };
// The enlarged card's body keeps this many rows clear under its text.
const LARGE_BODY_GAP = 4;
// Marks an option that would fire an owner, over the plaque's left rivet: card-frame
// pixels, and card-frame-large pixels where it is drawn at 2x.
const FIRES_KEY = "ui-fires";
const FIRES_AT = { large: { x: 8, y: 238 }, small: { x: 4, y: 119 } };
// A fork card's Head home button, centred under the paths, gap rows below them.
const FORK_HOME = { gap: 6, height: 44, width: 160 };

interface Entry {
  choice: Choice;
  enabled: boolean;
  option?: OptionView;
}

// The label on a card's band: its option's, or Skip.
function bandLabel(entry: Entry): string {
  return entry.option?.label ?? gameData.runText.card.skip;
}

// Centres a label drawn from its left edge (origin x 0) on x, its left edge on a whole pixel:
// a centre origin on an odd width puts it half a pixel off, which breaks thin glyphs such as ×.
function snapCentre(label: GameObjects.BitmapText, x: number): GameObjects.BitmapText {
  return label.setX(Math.round(x - label.width / 2));
}

// The look of the encounter that opened the card in the zone, or null for any other card.
function sourceLook(zone: ZoneId | undefined, source: CardSource): Look | null {
  return source.kind === "encounter" && zone !== undefined
    ? encounterLook(gameData, zone, source.encounter)
    : null;
}

// The road sprite of whatever opened the card, standing in for an option's illustration: an
// encounter's in its look.
function sourceSpriteKey(
  has: HasArt,
  zone: ZoneId | undefined,
  source: CardSource,
): string | undefined {
  const look = sourceLook(zone, source);
  return look === null ? undefined : skinnedArt(has, look);
}

// The option's illustration, an encounter's in its look, or the Skip card's. A path card's is
// its zone's preview.
function illustrationKey(
  has: HasArt,
  zone: ZoneId | undefined,
  source: CardSource,
  option: OptionView | undefined,
): string {
  if (option === undefined) {
    return SKIP_CARD_ART;
  }
  const look = sourceLook(zone, source);
  return look === null ? option.art : skinnedCardArt(has, look, option.art);
}

// Up to three cards over the dimmed band and road. The top bar and doghouses stay in view, and
// the HUD marks the dogs the card affects. A disabled option is drawn in greys.
export class CardScene extends Scene {
  private cardRects: Rect[] = [];
  // Set by the card's choice: its scene stops a frame later, and a press before then picks
  // nothing.
  private chosen = false;
  private entries: Entry[] = [];
  private onChoose: (choice: Choice) => void = () => undefined;
  private badges: (GameObjects.BitmapText | undefined)[] = [];
  private enlarged: GameObjects.GameObject[] = [];
  private hold: HoldPress | undefined;
  private outline: GameObjects.Graphics | undefined;
  private parts: GameObjects.GameObject[][] = [];
  private pressed: number | undefined;
  private presses: TargetPressListener | undefined;
  private refusing = false;
  private view: CardView | undefined;
  private zone: ZoneId | undefined;
  private readonly hasArt: HasArt = (key) => this.textures.exists(key);

  constructor() {
    super(SCENE_KEYS.card);
  }

  create({ onChoose, onHeadHome, view, zone }: CardSceneData): void {
    this.onChoose = onChoose;
    this.chosen = false;
    this.pressed = undefined;
    this.view = view;
    this.zone = zone;
    this.badges = [];
    this.enlarged = [];
    this.hold = undefined;
    this.parts = [];
    this.refusing = false;
    const { roadView: road, walkView } = screenLayout(SCREEN_CONFIG);
    addRampDim(this, walkView);

    this.entries = [
      ...view.options.map((option) => ({
        choice: option.index,
        enabled: option.availability.enabled,
        option,
      })),
      ...(view.skip ? [{ choice: "skip" as const, enabled: true }] : []),
    ];
    this.cardRects = cardRowRects(CARD_ROW, this.entries.length, road);
    const keys = keyNumbersShown();
    const header = cardHeader(keys, this.cardRects);
    const centerX = road.x + road.width / 2;
    const title = { font: "title", scale: 2 } as const;
    if (view.source.kind === "fork" && hasDisplayFont(this, view.title)) {
      snapCentre(
        addDisplayText(this, centerX, header.titleTop, view.title, { color: PALETTE.white }),
        centerX,
      );
    } else {
      this.centered(centerX + 1, header.titleTop + 1, view.title, PALETTE.ink, title);
      this.centered(centerX, header.titleTop, view.title, PALETTE.white, title);
    }
    // The subtitle and key numbers sit on a dark band over the dimmed road.
    addNineSlice(this, "ui-strip-well", header.band);
    this.centered(centerX, header.subtitleTop, this.subtitle(view), PALETTE.white);

    const tag = cardFrameTag(view.source);
    const bandFont = this.bandFont();
    this.entries.forEach((entry, i) => {
      const before = this.children.list.length;
      const rect = itemAt(this.cardRects, i);
      this.drawCard(view, tag, bandFont, entry, rect);
      // Once a key has been pressed, each card shows the number key that picks it, above it.
      if (keys) {
        this.centered(rect.x + rect.width / 2, header.keyTop, String(i + 1), PALETTE.amber, {
          font: "title",
        });
      }
      this.parts[i] = this.children.list.slice(before);
    });
    this.outline = this.add.graphics();
    if (view.source.kind === "fork") {
      const row = itemAt(this.cardRects, 0);
      const rect = {
        height: FORK_HOME.height,
        width: FORK_HOME.width,
        x: Math.round(centerX - FORK_HOME.width / 2),
        y: row.y + row.height + FORK_HOME.gap,
      };
      const label = gameData.runText.homeQuestion.headHome;
      const button = addMenuButton(this, rect, label, { available: true, primary: false });
      listenButtonTap(this, button, onHeadHome);
    }

    // A tap picks a card; holding one enlarges it until the finger lifts, and picks nothing.
    this.presses = listenTargetPress<number>(this, {
      onDown: (pointer, index) => {
        this.hold =
          index === undefined
            ? undefined
            : startHold(CARD_HOLD, { x: pointer.x, y: pointer.y }, this.time.now);
      },
      onPressed: (index) => {
        this.pressed = index;
        this.drawOutline();
        if (index === undefined) {
          this.hold = undefined;
          this.enlarged.forEach((part) => part.destroy());
          this.enlarged = [];
          this.showRow(true);
        }
      },
      onTap: (index) => this.choose(index),
      targetAt: (x, y) => rectIndexAt(this.cardRects, x, y),
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const number = cardNumberForKey(this.entries.length, event.key);
      if (number !== undefined) {
        this.choose(number - 1);
      }
    });
  }

  override update(): void {
    if (this.hold === undefined) {
      return;
    }
    const { fire, press } = tickHold(this.hold, this.time.now);
    this.hold = press;
    if (fire && this.pressed !== undefined) {
      // The hold takes the press, so its release picks nothing.
      this.presses?.cancel();
      this.enlarge(this.pressed);
    }
  }

  private subtitle(view: CardView): string {
    switch (view.source.kind) {
      case "encounter": {
        const names = view.affected.map((dog) => gameData.dogs[dog].name);
        return names.length === 0 ? gameData.runText.card.pickOne : `${names.join(", ")}`;
      }
      case "fork":
        return gameData.runText.card.forkSubtitle;
      default:
        return "";
    }
  }

  private choose(index: number): void {
    if (this.chosen) {
      return;
    }
    const entry = this.entries[index];
    if (entry?.enabled) {
      this.chosen = true;
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
  // change it would make, cause by cause. The body's rows shrink to what it says.
  private enlarge(index: number): void {
    const entry = this.entries[index];
    const view = this.view;
    if (entry === undefined || view === undefined || this.enlarged.length > 0) {
      return;
    }
    this.pressed = undefined;
    this.drawOutline();
    // The row's edges would show beside the enlarged card, so it hides until the release.
    this.showRow(false);
    const option = entry.option;
    const measured = this.addLargeBody(option, 0, 0);
    measured.parts.forEach((part) => part.destroy());
    const height = largeCardHeight(measured.height + LARGE_BODY_GAP);
    // The rows under the body move up by what it gave up.
    const shift = height - LARGE.height;
    const { walkView } = screenLayout(SCREEN_CONFIG);
    const { x, y } = largeCardRect(walkView, height);
    const before = this.children.list.length;
    const tag = cardFrameTag(view.source);
    const g = this.add.graphics();
    if (this.textures.exists(LARGE.key)) {
      // The frame's top down to the body's end, then its foot, over the body's last rows.
      const frameName = tagFrame(this, LARGE.key, tag);
      const foot = LARGE.height - (LARGE.body.y + LARGE.body.height);
      this.add
        .sprite(x, y, LARGE.key, frameName)
        .setOrigin(0)
        .setCrop(0, 0, LARGE.width, height - foot);
      this.add
        .sprite(x, y + shift, LARGE.key, frameName)
        .setOrigin(0)
        .setCrop(0, LARGE.height - foot, LARGE.width, foot);
    } else {
      const card = { height, width: LARGE.width, x, y };
      fillRect(g, PALETTE.plum, card);
      fillRect(g, PALETTE.cream, insetRect(4, card));
    }
    const label = bandLabel(entry);
    this.centered(x + LARGE.width / 2, y + LARGE.band.y + 5, label, this.bandColor(tag), {
      font: fontHasGlyphs(this, "title", label) ? "title" : "body",
    });
    const art = illustrationKey(this.hasArt, this.zone, view.source, option);
    if (this.textures.exists(art)) {
      this.add
        .image(x + LARGE.art.x, y + LARGE.art.y, art)
        .setOrigin(0)
        .setScale(2)
        .setCrop(0, 0, ART.width, ART.height);
    }
    this.addLargeBody(option, x + LARGE.body.x, y + LARGE.body.y);
    const badge = { ...LARGE.badge, x: x + LARGE.badge.x, y: y + LARGE.badge.y + shift };
    if (this.textures.exists(COST_KEY)) {
      this.add.image(badge.x, badge.y, COST_KEY).setOrigin(0).setScale(2);
    } else {
      fillRect(g, PALETTE.cream, badge);
    }
    const marker =
      option !== undefined && option.fires.length > 0
        ? this.addFiresMarker(x + FIRES_AT.large.x, y + FIRES_AT.large.y + shift, 2, false)
        : undefined;
    this.centered(
      this.plaqueCenter(badge.x, badge.width, marker),
      badge.y + 9,
      this.costText(entry),
      PALETTE.plum,
      {
        font: "title",
      },
    );
    this.enlarged = this.children.list.slice(before);
  }

  // The enlarged card's body from (x, top): an option that would fire an owner says so first,
  // in dark red, then each change it makes, at 2x where it fits the frame's body and else at
  // 1x. Returns its parts and the height they take.
  private addLargeBody(
    option: OptionView | undefined,
    x: number,
    top: number,
  ): { height: number; parts: GameObjects.BitmapText[] } {
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
    const parts: GameObjects.BitmapText[] = [];
    let used = 0;
    if (option !== undefined && option.fires.length > 0) {
      const warning = addPixelText(this, x, top, firesText(gameData, option.fires), {
        color: PALETTE.darkRed,
        font: "title",
        maxWidth: LARGE.body.width,
      });
      parts.push(warning);
      used = Math.ceil(warning.height) + 4;
    }
    const body = addPixelText(this, x, top + used, lines.join("\n"), {
      color: PALETTE.plum,
      maxWidth: LARGE.body.width,
      scale: 2,
    });
    if (body.height > LARGE.body.height - used) {
      scalePixelText(body, 1, x, top + used);
    }
    parts.push(body);
    return { height: used + Math.ceil(body.height), parts };
  }

  private showRow(visible: boolean): void {
    this.parts.flat().forEach((part) => {
      (part as GameObjects.GameObject & { visible: boolean }).visible = visible;
    });
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

  // A path card's plaque shows its zone's pay multiplier instead of a cost, and how long its
  // upgrade lasts.
  private costText(entry: Entry): string {
    const option = entry.option;
    const text = gameData.runText.card;
    if (option?.path !== undefined) {
      const pay = fillLine(RUN_TEXT_FIELDS.card, text, "forkFees", {
        fees: String(option.path.fees),
      });
      return option.duration === undefined
        ? pay
        : `${pay} · ${text.upgradeDuration[option.duration]}`;
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
    return snapCentre(addPixelText(this, x, y, text, { align: "center", color, ...style }), x);
  }

  // The row's band labels share one font: the title font where it has every glyph of every
  // label and each fits its band, else the narrower body font.
  private bandFont(): FontRole {
    const fits = (label: string) => {
      if (!fontHasGlyphs(this, "title", label)) {
        return false;
      }
      const probe = addPixelText(this, 0, 0, label, { color: PALETTE.white, font: "title" });
      const width = probe.width;
      probe.destroy();
      return width <= CARD.width - 6;
    };
    return this.entries.map(bandLabel).every(fits) ? "title" : "body";
  }

  private drawCard(
    view: CardView,
    tag: string,
    bandFont: FontRole,
    entry: Entry,
    rect: Rect,
  ): void {
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

    this.centered(x + CARD.width / 2, y + BAND.y + 3, bandLabel(entry), this.bandColor(tag), {
      font: bandFont,
    });

    const art = { ...ART, x: x + ART.x, y: y + ART.y };
    const illustration = illustrationKey(this.hasArt, this.zone, view.source, entry.option);
    if (this.textures.exists(illustration)) {
      const key = grey ? greyTextureKey(this, illustration) : illustration;
      this.add.image(art.x, art.y, key).setOrigin(0).setCrop(0, 0, art.width, art.height);
    } else {
      const spriteKey =
        entry.option === undefined
          ? undefined
          : sourceSpriteKey(this.hasArt, this.zone, view.source);
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
      ).setOrigin(0, 1);
      effectHeight -= Math.ceil(warning.height) + 2;
    }

    // The effect at 2x where it fits the card, else at 1x; holding the card shows it larger.
    const text = entry.option?.text ?? gameData.runText.card.skipEffect;
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
      snapCentre(effect, x + EFFECT.x + EFFECT.width / 2);
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
