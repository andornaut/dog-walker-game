import { type GameObjects, Scene } from "phaser";

import { SKIP_CARD_ART } from "../assets/cardArt";
import {
  CARD_FRAME_KEY,
  cardFrameTag,
  DIFFICULTY_KEY,
  encounterSpriteKey,
} from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_LAYOUT } from "../data/screen";
import type { CardSource } from "../data/types";
import { type OptionMarks, optionMarks } from "../hud/buffMarks";
import { largeBodyText, type PlaqueSize, plaqueTexts, smallCardText } from "../hud/cardText";
import { type HoldPress, holdRule, startHold, tickHold } from "../input/hold";
import { cardNumberForKey, menuKeyActs } from "../input/keyBindings";
import { keyNumbersShown } from "../input/keyNumbers";
import { cardCharmsAt } from "../layout/buffLayout";
import {
  boxStyles,
  CARD_LAYOUT,
  cardRowIn,
  FIRES_FIT,
  forkHomeRect,
  largeBodyBox,
  largeCardHeight,
  largeCardRect,
  plaqueRoom,
} from "../layout/cardLayout";
import { itemAt } from "../lib/arrays";
import { insetRect, type Rect } from "../lib/rect";
import {
  type CardView,
  type Choice,
  firesText,
  hasPlaque,
  MAX_CARD_OPTIONS,
  type OptionView,
} from "../rules/choices";
import { cardHeader } from "../ui/cardRow";
import { inkRowsOfLines } from "../ui/fontMetrics";
import { rectIndexAt } from "../ui/grid";
import { PLAIN_ITEM, tileState } from "../ui/interaction";
import { addDisplayText, hasDisplayFont } from "../ui/phaser/displayText";
import { drawRing, fillRect } from "../ui/phaser/draw";
import { greyTextureKey } from "../ui/phaser/greyTextures";
import { PALETTE } from "../ui/phaser/palette";
import {
  addPixelText,
  fitPixelText,
  type FontRole,
  inkSpan,
  labelInkWidth,
  pixelFontMetrics,
  setFittedText,
  setPixelText,
  withProbe,
} from "../ui/phaser/pixelText";
import { addRampDim } from "../ui/phaser/rampDim";
import { GREYED } from "../ui/selection";
import { addCharm } from "./buffCharm";
import { addNamePills } from "./effectNameColours";
import { onSceneEvent } from "./overlay";
import { currentSettings } from "./profileStore";
import { SCENE_KEYS } from "./sceneKeys";
import { type ScenePicture, showAsPicture } from "./scenePicture";
import { guardScreenInput } from "./screenGuard";
import { addStandingSprite, playFirstTag, playTag } from "./sprites";
import { listenTargetPress, type TargetPressListener } from "./targetPress";
import { addMenuButton, addNineSlice, listenButtonTap, tagFrame } from "./uiKit";

export interface CardSceneData {
  // Called with the option's data index, or "skip"; the run decides what happens next.
  onChoose: (choice: Choice) => void;
  // A fork card's Head home button, under the paths; null leaves the button out.
  onHeadHome: (() => void) | null;
  // Set to draw the card as a still picture, such as the help's, which takes no input.
  picture?: ScenePicture;
  view: CardView;
}

const CARD = CARD_LAYOUT;
// Card-pixel positions of the frame's parts.
const BAND = CARD_LAYOUT.band;
const ART: Rect = CARD_LAYOUT.art;
const EFFECT: Rect = CARD_LAYOUT.effect;
const BADGE: Rect = CARD_LAYOUT.badge;
const SELECTED_OUTLINE = 2;
const COST_KEY = "card-cost";
// A refused pick shakes its card and flashes its cost.
const REFUSE = { flashMs: 80, flashes: 4, shake: 3, shakeMs: 40 };
// Holding a card enlarges it, with the changes behind its numbers, however far the finger moves.
const CARD_SLOP_PX = Number.POSITIVE_INFINITY;
const LARGE = { ...CARD_LAYOUT.large, key: "card-frame-large" };
// The enlarged card's body keeps this many rows clear under its text.
const LARGE_BODY_GAP = 4;
// Marks an option that would fire an owner, over the plaque's left rivet: card-frame
// pixels, and card-frame-large pixels where it is drawn at 2x.
const FIRES_KEY = "ui-fires";

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

// The centre of a plaque's text: the plaque's, or that of its part right of the fires marker.
function plaqueCentre(badge: Rect, marker: number | undefined): number {
  return marker === undefined ? badge.x + badge.width / 2 : (marker + badge.x + badge.width) / 2;
}

// The road sprite of whatever opened the card, standing in for an option's illustration: an
// encounter's.
function sourceSpriteKey(source: CardSource): string | undefined {
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
  // Each option's plaque text, which a refused pick flashes; none for a plaque value.
  private plaqueLabels: (GameObjects.BitmapText | undefined)[] = [];
  private enlarged: GameObjects.GameObject[] = [];
  // The title, subtitle and their band, hidden with the row while a card is enlarged.
  private headerParts: GameObjects.GameObject[] = [];
  private hold: HoldPress | undefined;
  // A fork card's Head home button, hidden with the row while a card is enlarged.
  private homeParts: GameObjects.GameObject[] = [];
  private outline: GameObjects.Graphics | undefined;
  private parts: GameObjects.GameObject[][] = [];
  private pressed: number | undefined;
  private presses: TargetPressListener | undefined;
  private refusing = false;
  private view: CardView | undefined;

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
    this.plaqueLabels = [];
    this.enlarged = [];
    this.hold = undefined;
    this.parts = [];
    this.headerParts = [];
    this.homeParts = [];
    this.refusing = false;
    const { walkView } = SCREEN_LAYOUT;
    // A card the help draws as a picture takes no input; a played card takes none for
    // seconds.screenTapGuard from its first drawn frame.
    addRampDim(this, walkView, picture === undefined ? guardScreenInput(this).drawn : undefined);

    this.entries = [
      ...view.options.map((option) => ({
        choice: option.index,
        enabled: option.availability.enabled,
        option,
      })),
      ...(view.skip ? [{ choice: "skip" as const, enabled: true }] : []),
    ];
    this.cardRects = cardRowIn(walkView, MAX_CARD_OPTIONS, this.entries.length);
    const keys = picture === undefined && keyNumbersShown();
    const header = cardHeader(keys, this.cardRects);
    const centreX = walkView.x + walkView.width / 2;
    const title = { font: "title", scale: 2 } as const;
    const headerStart = this.children.list.length;
    // The title, subtitle and key numbers sit on a dark band over the dimmed road.
    addNineSlice(this, "ui-strip-well", header.band);
    if (view.source.kind === "fork" && hasDisplayFont(this, view.title)) {
      snapCentre(
        addDisplayText(this, centreX, header.titleTop, view.title, { colour: PALETTE.white }),
        centreX,
      );
    } else {
      this.centred(centreX + 1, header.titleTop + 1, view.title, PALETTE.ink, title);
      this.centred(centreX, header.titleTop, view.title, PALETTE.white, title);
    }
    this.centred(centreX, header.subtitleTop, this.subtitle(view), PALETTE.white);
    this.headerParts = this.children.list.slice(headerStart);

    const tag = cardFrameTag(view.source);
    this.entries.forEach((entry, i) => {
      const before = this.children.list.length;
      const rect = itemAt(this.cardRects, i);
      this.drawCard(view, tag, entry, rect);
      // Once a key has been pressed, each card shows the number key that picks it, above it.
      if (keys) {
        this.centred(rect.x + rect.width / 2, header.keyTop, String(i + 1), PALETTE.amber, {
          font: "title",
        });
      }
      this.parts[i] = this.children.list.slice(before);
    });
    this.outline = this.add.graphics();
    if (view.source.kind === "fork" && onHeadHome !== null) {
      const rect = forkHomeRect(itemAt(this.cardRects, 0), centreX);
      const label = gameData.runText.homeQuestion.headHome;
      const before = this.children.list.length;
      const button = addMenuButton(this, rect, label, { available: true, primary: false });
      this.homeParts = this.children.list.slice(before);
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
            : startHold(
                holdRule(gameData.tuning, CARD_SLOP_PX),
                { x: pointer.x, y: pointer.y },
                this.time.now,
              );
      },
      onPressed: (index) => {
        this.pressed = index;
        this.drawOutline();
        if (index === undefined) {
          this.shrink();
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
    // The pause menu pauses the cards under it and takes the release of a press under way, so
    // the press is dropped: it picks nothing and enlarges nothing once the cards resume.
    onSceneEvent(this, this.events, "pause", () => {
      this.presses?.cancel();
      this.pressed = undefined;
      this.drawOutline();
      this.shrink();
    });
  }

  // Ends a hold: the enlarged card goes and the row shows again.
  private shrink(): void {
    this.hold = undefined;
    this.enlarged.forEach((part) => part.destroy());
    this.enlarged = [];
    this.showRow(true);
  }

  override update(): void {
    if (this.hold === undefined) {
      return;
    }
    const { fire, press } = tickHold(this.time.now, this.hold);
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
        return names.length === 0 ? gameData.runText.card.pickOne : names.join(", ");
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
    const label = this.plaqueLabels[index];
    let flashes = 0;
    this.time.addEvent({
      callback: () => {
        flashes += 1;
        label?.setTint(flashes % 2 === 1 ? PALETTE.red : PALETTE[GREYED.plateText]);
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
    // The row's edges, its title, subtitle and band, and Head home would show beside the enlarged
    // card and its charms, so they hide until the release.
    this.showRow(false);
    const option = entry.option;
    const measured = this.addLargeBody(option, 0, 0);
    measured.parts.forEach((part) => part.destroy());
    const height = largeCardHeight(measured.height + LARGE_BODY_GAP);
    // The rows under the body move up by what it gave up.
    const shift = height - LARGE.height;
    const { walkView } = SCREEN_LAYOUT;
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
    this.centred(x + LARGE.width / 2, y + LARGE.band.y + 5, bandLabel(entry), PALETTE.white);
    const art = illustrationKey(option);
    if (this.textures.exists(art)) {
      this.add
        .image(x + LARGE.art.x, y + LARGE.art.y, art)
        .setOrigin(0)
        .setScale(2)
        .setCrop(0, 0, ART.width, ART.height);
    }
    const marks = optionMarks(gameData, view, option);
    this.addCharms(marks, { height, width: LARGE.width, x, y }, 2);
    this.addLargeBody(option, x + LARGE.body.x, y + LARGE.body.y);
    const badge = { ...LARGE.badge, x: x + LARGE.badge.x, y: y + LARGE.badge.y + shift };
    // A free option's foot stays plain.
    if (hasPlaque(option) || marks.plaque !== null) {
      this.addPlaque(g, badge, 2, false);
    }
    const marker =
      option !== undefined && option.fires.length > 0
        ? this.addFiresMarker(x + LARGE.fires.x, y + LARGE.fires.y + shift, 2, false)
        : undefined;
    if (marks.plaque !== null) {
      this.addPlaqueValue(badge, marker, 9, marks.plaque);
    } else if (hasPlaque(option)) {
      this.addPlaqueText("enlarged", badge, marker, 9, PALETTE.plum, option);
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
  ): { height: number; parts: GameObjects.GameObject[] } {
    const parts: GameObjects.GameObject[] = [];
    let fireLines = 0;
    if (option !== undefined && option.fires.length > 0) {
      const warning = addPixelText(this, x, top, firesText(gameData, option.fires), {
        colour: PALETTE.darkRed,
        font: "title",
      });
      fireLines = fitPixelText(warning, FIRES_FIT.large, x, top).lines.length;
      parts.push(warning);
    }
    const box = largeBodyBox(pixelFontMetrics(this, "title"), fireLines);
    const forgiven =
      this.view === undefined ? null : optionMarks(gameData, this.view, option).forgiven;
    if (forgiven !== null) {
      return this.addForgiven(forgiven, { align: "left", x }, top + box.top, 2);
    }
    const text = largeBodyText(gameData, option);
    const body = addPixelText(this, x, top + box.top, text, { colour: PALETTE.plum, scale: 2 });
    const metrics = pixelFontMetrics(this, "body");
    const fit = { room: LARGE.body.width, styles: boxStyles(metrics, box.height) };
    const { lines, style } = fitPixelText(body, fit, x, top + box.top);
    addNamePills([body]);
    parts.push(body);
    return { height: box.top + inkRowsOfLines(metrics, lines.length) * style.scale, parts };
  }

  private showRow(visible: boolean): void {
    [...this.headerParts, ...this.parts.flat(), ...this.homeParts].forEach((part) => {
      (part as GameObjects.GameObject & { visible: boolean }).visible = visible;
    });
  }

  // The cost plaque at badge, its art at scale or a cream stand-in while the art is missing,
  // greyed on a greyed card.
  private addPlaque(g: GameObjects.Graphics, badge: Rect, scale: number, grey: boolean): void {
    if (this.textures.exists(COST_KEY)) {
      this.add.image(badge.x, badge.y, this.shownKey(grey, COST_KEY)).setOrigin(0).setScale(scale);
    } else {
      fillRect(g, grey ? PALETTE[GREYED.plateFace] : PALETTE.cream, badge);
    }
  }

  // A texture key as a card shows it: its greyed copy on a greyed card.
  private shownKey(grey: boolean, key: string): string {
    return grey ? greyTextureKey(this, key) : key;
  }

  // ui-fires over the plaque's left rivet, pulsing unless motion is reduced. Returns its
  // right edge, or undefined while the art is missing, when the text flag stands alone.
  private addFiresMarker(x: number, y: number, scale: number, grey: boolean): number | undefined {
    if (!this.textures.exists(FIRES_KEY)) {
      return undefined;
    }
    const still = grey || currentSettings(this).reducedMotion;
    const frame = tagFrame(this, FIRES_KEY, "static");
    const key = this.shownKey(grey, FIRES_KEY);
    const marker = this.add.sprite(x, y, key, frame).setOrigin(0).setScale(scale);
    if (!still) {
      playTag(marker, FIRES_KEY, "pulse");
    }
    return x + marker.displayWidth;
  }

  // The plaque's text in the title font, centred in the plaque or its part right of the fires
  // marker, capsY under its top: the first of plaqueTexts for the card's size that fits there.
  private addPlaqueText(
    size: PlaqueSize,
    badge: Rect,
    marker: number | undefined,
    capsY: number,
    colour: number,
    option: OptionView,
  ): GameObjects.BitmapText {
    const centre = plaqueCentre(badge, marker);
    const room = plaqueRoom(badge.x, badge.width, marker);
    const texts = plaqueTexts(gameData, size, option);
    const label = this.centred(centre, badge.y + capsY, texts[0] ?? "", colour, { font: "title" });
    for (const text of texts) {
      setPixelText(label, text);
      const ink = inkSpan(label);
      if (ink.right - ink.left <= room) {
        break;
      }
    }
    return snapCentre(label, centre);
  }

  // The lit charm of each buff on the option, in a row centred under its card, at scale.
  private addCharms(marks: OptionMarks, card: Rect, scale: number): void {
    const wells = cardCharmsAt(card, scale, marks.charms.length);
    marks.charms.forEach((item, i) => {
      addCharm(this, item, itemAt(wells, i), { lit: true, scale });
    });
  }

  // The price a buff made of a plaque's, in forest in the title font, centred as addPlaqueText
  // centres its text, capsY under the plaque's top.
  private addPlaqueValue(
    badge: Rect,
    marker: number | undefined,
    capsY: number,
    text: string,
  ): void {
    this.centred(plaqueCentre(badge, marker), badge.y + capsY, text, PALETTE.forest, {
      font: "title",
    });
  }

  // A forgiven loss in place of the effect text: the hearts it leaves each owner's dog, a row
  // each in forest in the body font at scale, and the forgiving perk's name under them, centred
  // on x or from it. Returns its parts and the height their ink takes.
  private addForgiven(
    forgiven: NonNullable<OptionMarks["forgiven"]>,
    at: { align: "centre" | "left"; x: number },
    top: number,
    scale: number,
  ): { height: number; parts: GameObjects.GameObject[] } {
    const metrics = pixelFontMetrics(this, "body");
    const row = metrics.lineHeight * scale;
    const parts = forgiven.rows.map((text, i) =>
      at.align === "centre"
        ? this.centred(at.x, top + i * row, text, PALETTE.forest, { scale })
        : addPixelText(this, at.x, top + i * row, text, { colour: PALETTE.forest, scale }),
    );
    const nameTop = top + forgiven.rows.length * row;
    const name =
      at.align === "centre"
        ? this.centred(at.x, nameTop, forgiven.name, PALETTE.plum, { scale })
        : addPixelText(this, at.x, nameTop, forgiven.name, { colour: PALETTE.plum, scale });
    const lines = forgiven.rows.length + 1;
    return { height: inkRowsOfLines(metrics, lines) * scale, parts: [...parts, name] };
  }

  private centred(
    x: number,
    y: number,
    text: string,
    colour: number,
    style: { font?: FontRole; maxWidth?: number; scale?: number } = {},
  ): GameObjects.BitmapText {
    return snapCentre(addPixelText(this, x, y, text, { align: "centre", colour, ...style }), x);
  }

  private drawCard(view: CardView, tag: string, entry: Entry, rect: Rect): void {
    const { x, y } = rect;
    const grey = tileState({ ...PLAIN_ITEM, available: entry.enabled }) === "disabled";
    const g = this.add.graphics();
    if (this.textures.exists(CARD_FRAME_KEY)) {
      const frameName = tagFrame(this, CARD_FRAME_KEY, tag);
      const key = this.shownKey(grey, CARD_FRAME_KEY);
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

    this.centred(x + CARD.width / 2, y + BAND.y + 3, bandLabel(entry), PALETTE.white);

    const art = { ...ART, x: x + ART.x, y: y + ART.y };
    const illustration = illustrationKey(entry.option);
    if (this.textures.exists(illustration)) {
      const key = this.shownKey(grey, illustration);
      this.add.image(art.x, art.y, key).setOrigin(0).setCrop(0, 0, art.width, art.height);
    } else {
      const spriteKey = entry.option === undefined ? undefined : sourceSpriteKey(view.source);
      if (spriteKey !== undefined && this.textures.exists(spriteKey)) {
        const key = this.shownKey(grey, spriteKey);
        const sprite = addStandingSprite(
          this,
          spriteKey,
          art.x + art.width / 2,
          art.y + art.height - 6,
        );
        if (grey) {
          sprite.setTexture(key);
        } else {
          const still = currentSettings(this).reducedMotion;
          playFirstTag(sprite, spriteKey, ["idle", "walk", "wave"], still);
        }
      } else {
        this.centred(
          art.x + art.width / 2,
          art.y + art.height / 2 - 5,
          "?",
          grey ? PALETTE.neutralGrey : PALETTE.cream,
          { font: "title", scale: 2 },
        );
      }
    }

    const marks = optionMarks(gameData, view, entry.option);
    this.addCharms(marks, rect, 1);

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
    const shown = withProbe(this, { colour: PALETTE.plum }, (probe) =>
      smallCardText(gameData, pixelFontMetrics(this, "body"), labelInkWidth(probe), entry.option),
    );
    if (shown.warning !== null) {
      const warning = this.centred(centreX, 0, "", grey ? PALETTE[GREYED.text] : PALETTE.darkRed);
      setFittedText(warning, shown.warning, centreX, y + shown.box.warningY);
      snapCentre(warning, centreX);
    }
    if (marks.forgiven === null) {
      const effectColour = grey ? PALETTE[GREYED.text] : PALETTE.plum;
      const effect = this.centred(centreX, 0, "", effectColour);
      setFittedText(effect, shown.effect, centreX, y + shown.box.y);
      snapCentre(effect, centreX);
      addNamePills([effect], grey);
    } else {
      this.addForgiven(marks.forgiven, { align: "centre", x: centreX }, y + shown.box.y, 1);
    }

    const badge = { ...BADGE, x: x + BADGE.x, y: y + BADGE.y };
    const option = entry.option;
    // A free option's foot stays plain.
    if (hasPlaque(option) || marks.plaque !== null) {
      this.addPlaque(g, badge, 1, grey);
    }
    const marker =
      fires.length > 0
        ? this.addFiresMarker(x + CARD.fires.x, y + CARD.fires.y, 1, grey)
        : undefined;
    if (marks.plaque !== null) {
      this.addPlaqueValue(badge, marker, 4, marks.plaque);
      this.plaqueLabels.push(undefined);
      return;
    }
    this.plaqueLabels.push(
      hasPlaque(option)
        ? this.addPlaqueText(
            "small",
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
