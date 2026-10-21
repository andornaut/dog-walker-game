import { type GameObjects, Scene } from "phaser";

import { itemAt } from "../arrays";
import { SKIP_CARD_ART } from "../assets/cardArt";
import {
  CARD_FRAME_KEY,
  cardFrameTag,
  DIFFICULTY_KEY,
  encounterSpriteKey,
  type HasArt,
} from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { PLAIN_ITEM, tileState } from "../home/interaction";
import { DISABLED_COLORS, GREYED } from "../home/selection";
import { largeBodyText, plaqueTexts, smallCardText } from "../hud/cardText";
import { type HoldPress, type HoldRule, startHold, tickHold } from "../input/hold";
import { cardNumberForKey, menuKeyActs } from "../input/keyBindings";
import { keyNumbersShown } from "../input/keyNumbers";
import {
  boxStyles,
  CARD_LAYOUT,
  cardRowSpec,
  FIRES_FIT,
  largeBodyBox,
  largeCardHeight,
  largeCardRect,
  plaqueRoom,
} from "../layout/cardLayout";
import { cardHeader, cardRowRects } from "../layout/cardRow";
import { rectIndexAt } from "../layout/grid";
import { insetRect, type Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import {
  type CardView,
  type Choice,
  firesText,
  hasPlaque,
  MAX_CARD_OPTIONS,
  type OptionView,
} from "../rules/choices";
import type { CardSource } from "../state/runState";
import { inkRowsOfLines } from "../ui/fontMetrics";
import { addDisplayText, hasDisplayFont } from "./displayText";
import { drawRing, fillRect } from "./draw";
import { greyTextureKey } from "./greyTextures";
import { PALETTE } from "./palette";
import {
  addPixelText,
  fitPixelText,
  fontHasGlyphs,
  type FontRole,
  inkSpan,
  labelInkWidth,
  pixelFontMetrics,
  setFittedText,
  setPixelText,
} from "./pixelText";
import { currentSettings } from "./profileStore";
import { addRampDim } from "./rampDim";
import { SCENE_KEYS } from "./sceneKeys";
import { type ScenePicture, showAsPicture } from "./scenePicture";
import { addStandingSprite, playTag } from "./sprites";
import { listenTargetPress, type TargetPressListener } from "./targetPress";
import { addMenuButton, addNineSlice, listenButtonTap, tagFrame } from "./uiKit";

export interface CardSceneData {
  // Called with the option's data index, or "skip"; the run decides what happens next.
  onChoose: (choice: Choice) => void;
  // A fork card's Head home button, under the paths.
  onHeadHome: () => void;
  // Set to draw the card as a still picture, such as the help's, which takes no input.
  picture?: ScenePicture;
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
// Holding a card this long enlarges it, with the changes behind its numbers, however far
// the finger moves.
const CARD_HOLD: HoldRule = { holdMs: 400, slopPx: Number.POSITIVE_INFINITY };
const LARGE = { ...CARD_LAYOUT.large, key: "card-frame-large" };
// The enlarged card's body keeps this many rows clear under its text.
const LARGE_BODY_GAP = 4;
// Marks an option that would fire an owner, over the plaque's left rivet: card-frame
// pixels, and card-frame-large pixels where it is drawn at 2x.
const FIRES_KEY = "ui-fires";
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

// The road sprite of whatever opened the card, standing in for an option's illustration: an
// encounter's.
function sourceSpriteKey(has: HasArt, source: CardSource): string | undefined {
  return source.kind === "encounter" ? encounterSpriteKey(source.encounter) : undefined;
}

// The option's illustration, or the Skip card's. A path card's is its zone's preview.
function illustrationKey(option: OptionView | undefined): string {
  return option?.art ?? SKIP_CARD_ART;
}

// Up to three cards over the dimmed band and road. The walk bar and dog cards stay in view, and
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
  private readonly hasArt: HasArt = (key) => this.textures.exists(key);

  // key names a second card scene, such as the help's picture of one.
  constructor(key: string = SCENE_KEYS.card) {
    super(key);
  }

  create({ onChoose, onHeadHome, picture, view }: CardSceneData): void {
    if (picture !== undefined) {
      showAsPicture(this, picture);
    }
    this.onChoose = onChoose;
    this.chosen = false;
    this.pressed = undefined;
    this.view = view;
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
    const keys = picture === undefined && keyNumbersShown();
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
      if (picture === undefined) {
        listenButtonTap(this, button, onHeadHome);
      }
    }
    if (picture !== undefined) {
      return;
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
      if (number !== undefined && menuKeyActs(event.repeat, event.key)) {
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
  // flashes its cost red, ending in the grey plate's text it was drawn in, so the player knows
  // to pick another.
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
        badge?.setTint(flashes % 2 === 1 ? PALETTE.red : PALETTE[GREYED.plateText]);
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
      font: this.bandLabelFits("title", label, LARGE.band.room) ? "title" : "body",
    });
    const art = illustrationKey(option);
    if (this.textures.exists(art)) {
      this.add
        .image(x + LARGE.art.x, y + LARGE.art.y, art)
        .setOrigin(0)
        .setScale(2)
        .setCrop(0, 0, ART.width, ART.height);
    }
    this.addLargeBody(option, x + LARGE.body.x, y + LARGE.body.y);
    const badge = { ...LARGE.badge, x: x + LARGE.badge.x, y: y + LARGE.badge.y + shift };
    const plaque = hasPlaque(option);
    if (!plaque) {
      // A free option's foot stays plain.
    } else if (this.textures.exists(COST_KEY)) {
      this.add.image(badge.x, badge.y, COST_KEY).setOrigin(0).setScale(2);
    } else {
      fillRect(g, PALETTE.cream, badge);
    }
    const marker =
      option !== undefined && option.fires.length > 0
        ? this.addFiresMarker(x + LARGE.fires.x, y + LARGE.fires.y + shift, 2, false)
        : undefined;
    if (plaque) {
      this.addPlaqueText(badge, marker, 9, PALETTE.plum, option);
    }
    this.enlarged = this.children.list.slice(before);
  }

  // The enlarged card's body from (x, top): an option that would fire an owner says so first,
  // in dark red, then each change it makes, at 2x where it fits the frame's body and else at
  // 1x, measured on the font. Returns its parts and the height their ink takes.
  private addLargeBody(
    option: OptionView | undefined,
    x: number,
    top: number,
  ): { height: number; parts: GameObjects.BitmapText[] } {
    const parts: GameObjects.BitmapText[] = [];
    let fireLines = 0;
    if (option !== undefined && option.fires.length > 0) {
      const warning = addPixelText(this, x, top, firesText(gameData, option.fires), {
        color: PALETTE.darkRed,
        font: "title",
      });
      fireLines = fitPixelText(warning, FIRES_FIT.large, x, top).lines.length;
      parts.push(warning);
    }
    const box = largeBodyBox(pixelFontMetrics(this, "title"), fireLines);
    const body = addPixelText(this, x, top + box.top, largeBodyText(gameData, option), {
      color: PALETTE.plum,
      scale: 2,
    });
    const metrics = pixelFontMetrics(this, "body");
    const fit = { room: LARGE.body.width, styles: boxStyles(metrics, box.height) };
    const { lines, style } = fitPixelText(body, fit, x, top + box.top);
    parts.push(body);
    return { height: box.top + inkRowsOfLines(metrics, lines.length) * style.scale, parts };
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

  // The plaque's text in the title font, centred in the plaque or its part right of the fires
  // marker, capsY under its top: the first of plaqueTexts that fits there.
  private addPlaqueText(
    badge: Rect,
    marker: number | undefined,
    capsY: number,
    color: number,
    option: OptionView,
  ): GameObjects.BitmapText {
    const center =
      marker === undefined ? badge.x + badge.width / 2 : (marker + badge.x + badge.width) / 2;
    const room = plaqueRoom(badge.x, badge.width, marker);
    const texts = plaqueTexts(gameData, option);
    const label = this.centered(center, badge.y + capsY, texts[0] ?? "", color, { font: "title" });
    for (const text of texts) {
      setPixelText(label, text);
      const ink = inkSpan(label);
      if (ink.right - ink.left <= room) {
        break;
      }
    }
    return snapCentre(label, center);
  }

  // Whether label inks no wider than room in role's font at 1x, which has its every glyph.
  private bandLabelFits(role: FontRole, label: string, room: number): boolean {
    if (!fontHasGlyphs(this, role, label)) {
      return false;
    }
    const probe = addPixelText(this, 0, 0, label, { color: PALETTE.white, font: role });
    const ink = inkSpan(probe);
    probe.destroy();
    return ink.right - ink.left <= room;
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
  // label and each fits its band, else the narrower body font, which every label fits.
  private bandFont(): FontRole {
    const labels = this.entries.map(bandLabel);
    return labels.every((label) => this.bandLabelFits("title", label, BAND.room))
      ? "title"
      : "body";
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
      fillRect(g, grey ? PALETTE[GREYED.edge] : PALETTE.red, {
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
    const illustration = illustrationKey(entry.option);
    if (this.textures.exists(illustration)) {
      const key = grey ? greyTextureKey(this, illustration) : illustration;
      this.add.image(art.x, art.y, key).setOrigin(0).setCrop(0, 0, art.width, art.height);
    } else {
      const spriteKey =
        entry.option === undefined ? undefined : sourceSpriteKey(this.hasArt, view.source);
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
          grey ? PALETTE.neutralGrey : PALETTE.cream,
          { font: "title", scale: 2 },
        );
      }
    }

    // A path card shows its zone's difficulty as paws, then in words.
    const path = entry.option?.path;
    const centreX = x + EFFECT.x + EFFECT.width / 2;
    if (path !== undefined) {
      const paws = tagFrame(this, DIFFICULTY_KEY, String(path.difficulty));
      if (paws !== undefined) {
        this.add.image(x + CARD.width / 2, y + EFFECT.y, DIFFICULTY_KEY, paws).setOrigin(0.5, 0);
      }
    }

    // An option that would fire an owner says so at the foot of its effect, in dark red, where
    // the effect still fits over it; the effect at 2x where it fits the card, else at 1x. Holding
    // the card shows both larger.
    const fires = entry.option?.fires ?? [];
    const probe = addPixelText(this, 0, 0, "", { color: PALETTE.plum });
    const shown = smallCardText(
      gameData,
      pixelFontMetrics(this, "body"),
      labelInkWidth(probe),
      entry.option,
    );
    probe.destroy();
    if (shown.warning !== null) {
      const warning = this.centered(centreX, 0, "", grey ? PALETTE[GREYED.text] : PALETTE.darkRed);
      setFittedText(warning, shown.warning, centreX, y + shown.box.warningY);
      snapCentre(warning, centreX);
    }
    const effectColor = grey ? PALETTE[DISABLED_COLORS.text] : PALETTE.plum;
    const effect = this.centered(centreX, 0, "", effectColor);
    setFittedText(effect, shown.effect, centreX, y + shown.box.y);
    snapCentre(effect, centreX);

    const badge = { ...BADGE, x: x + BADGE.x, y: y + BADGE.y };
    const option = entry.option;
    const plaque = hasPlaque(option);
    if (!plaque) {
      // A free option's foot stays plain.
    } else if (this.textures.exists(COST_KEY)) {
      const key = grey ? greyTextureKey(this, COST_KEY) : COST_KEY;
      this.add.image(badge.x, badge.y, key).setOrigin(0);
    } else {
      fillRect(g, grey ? PALETTE[GREYED.plateFace] : PALETTE.cream, badge);
    }
    const marker =
      fires.length > 0
        ? this.addFiresMarker(x + CARD.fires.x, y + CARD.fires.y, 1, grey)
        : undefined;
    this.badges.push(
      plaque
        ? this.addPlaqueText(
            badge,
            marker,
            4,
            grey ? PALETTE[GREYED.plateText] : PALETTE.plum,
            option,
          )
        : undefined,
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
