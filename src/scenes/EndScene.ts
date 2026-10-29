import { type GameObjects, Scene } from "phaser";

import { ownerFaceKey, ZONE_PIPS_KEY } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import { badgeStripHits, type BadgeView } from "../home/badgesView";
import {
  END_LAYOUT,
  endBadgeRows,
  endBadgeStrip,
  endPanelLayout,
  grantedQuipLines,
  QUIP_LINES,
  QUIP_TEXT_ROOM,
  quipNameX,
  quipTextY,
  sideTotalAmountY,
} from "../home/endLayout";
import {
  closingLines,
  earningsBreakdown,
  type EndTarget,
  endTargetAt,
  zonePips,
} from "../home/endView";
import { signedShortDollarText } from "../home/home";
import { MENU_TEXT_FIELDS } from "../home/menuText";
import {
  homecomers,
  type ReturnPhase,
  returnPhase,
  walkUpOffset,
  waveOffset,
} from "../home/returnHome";
import { pipTag } from "../hud/hudView";
import {
  type HoldPress,
  holdRule,
  moveHold,
  startHold,
  tickHold,
  TILE_SLOP_PX,
} from "../input/hold";
import { isConfirmKey } from "../input/keyBindings";
import { screenArea } from "../input/outsideTap";
import { itemAt } from "../lib/arrays";
import { fillLine } from "../lib/lines";
import type { Rect } from "../lib/rect";
import { PackFigures } from "../pack/phaser/packFigures";
import { stopWakeLock } from "../pwa";
import { walkLength } from "../rules/route";
import type { LastWalk } from "../save/schema";
import { addDisplayText } from "../ui/phaser/displayText";
import { fillRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import {
  addPixelText,
  fitPixelText,
  inkSpan,
  pixelFontMetrics,
  setPixelText,
  withProbe,
} from "../ui/phaser/pixelText";
import { onceBeforeRender } from "../ui/phaser/rampDim";
import { TEXT_SCALE, textOnLines } from "../ui/textFit";
import {
  addBadgeCelebration,
  addBadgeDetail,
  addBurst,
  addCheeringFace,
  NEW_BEST_BURST,
} from "./badges";
import { listenOutsideTap, onBackPressed } from "./overlay";
import { addOwnerFigure, ownerSpriteKey } from "./ownerFigure";
import {
  currentSettings,
  lastRunEnd,
  profileSave,
  walkerInUse,
  walkerSpriteKey,
} from "./profileStore";
import { SCENE_KEYS } from "./sceneKeys";
import { guardScreenInput } from "./screenGuard";
import { soundboardOf } from "./soundboard";
import { firstTag, playTag } from "./sprites";
import { listenTargetPress, sameByValue, type TargetPressListener } from "./targetPress";
import {
  addBodyText,
  addMenuButton,
  addPanel,
  addScreenBackdrop,
  addTagImage,
  addTapBurst,
  BODY_TEXT,
} from "./uiKit";

const END_SCREEN_KEY = "screen-end";
const LOGO = { ...END_LAYOUT.logo, key: "logo" };
const RIBBON = { ...END_LAYOUT.ribbon, dropMs: 360, key: "ui-new-best", riseFrom: 12 };
const RIBBON_BURST = END_LAYOUT.ribbonBurst;
const TITLE_Y = END_LAYOUT.titleY;
const BREAKDOWN = END_LAYOUT.breakdown;
const SIDE = END_LAYOUT.side;
const QUIPS = END_LAYOUT.quips;
const BADGE_SOUND_AFTER_BEST_MS = 1200;
const RETURN_HOME_SCENE = END_LAYOUT.returnHome;
const BUTTON: Rect = END_LAYOUT.button;
// An open badge's card, over the badges just earned.
const CARD_DEPTH = 2;

// Money gained in forest and lost in darkRed, each with its sign, on the cream panel.
function amountColour(amount: number): number {
  if (amount === 0) {
    return PALETTE.plum;
  }
  return amount > 0 ? PALETTE.forest : PALETTE.darkRed;
}

// The walk's result, already banked: what made up the total, zones walked, the bank, a ribbon
// for a new best walk, and a closing line from each owner. Badges the run earned burst in
// under the panel while the owners still walking cheer, and a tap or a hold on one opens its
// card, as on the Stats page. Back home returns to the start screen. The screen takes no input
// until seconds.screenTapGuard after its first frame, so a steering tap never answers it.
export class EndScene extends Scene {
  // The badges just earned, in their slots' order.
  private badges: BadgeView[] = [];
  // The open badge's card.
  private card: GameObjects.Container | undefined;
  // A press on a badge, until its hold opens the card.
  private hold: { readonly badge: number; readonly press: HoldPress } | undefined;
  private presses: TargetPressListener | undefined;
  private reduced = false;
  private returnHomeStep: (() => void) | undefined;

  constructor() {
    super(SCENE_KEYS.end);
  }

  create(): void {
    soundboardOf(this).stopMusic();
    stopWakeLock();
    const save = profileSave(this);
    const walk = save.stats.lastWalk;
    const goHome = () => this.scene.start(SCENE_KEYS.start);
    this.returnHomeStep = undefined;
    this.badges = [];
    this.card = undefined;
    this.hold = undefined;
    if (walk === null) {
      goHome();
      return;
    }
    onceBeforeRender(this, guardScreenInput(this).drawn);
    const ended = lastRunEnd(this);
    const earned = ended?.achievements ?? [];
    const reduced = currentSettings(this).reducedMotion;
    this.reduced = reduced;
    addScreenBackdrop(this, END_SCREEN_KEY);
    this.addReturnHome(reduced, walk);
    // Over the house's roof, clear of the walker's head.
    if (this.textures.exists(LOGO.key)) {
      this.add.image(LOGO.x, LOGO.y, LOGO.key).setOrigin(0);
    }
    // A walk that earned nothing is no best, even the first.
    const newBest = ended?.newBestWalk === true && walk.earnedCents > 0;
    if (newBest && this.textures.exists(RIBBON.key)) {
      // Behind the panel, so the sparkles rise from behind the ribbon and never cover the title.
      // With reduced motion the burst holds one still frame.
      const { height, width, x, y } = RIBBON_BURST;
      addBurst(this, reduced, NEW_BEST_BURST, 1, x + width / 2, y + height / 2);
    }
    const lines =
      ended === null
        ? []
        : earningsBreakdown(gameData, ended.changes, {
            earned: walk.earnedCents,
            lost: ended.lostCents,
          });
    const closing = closingLines(gameData, Math.random, walk);
    const text = (x: number, y: number, value: string, colour: number, originX = 0) =>
      addBodyText(this, undefined, { x, y }, value, { colour, originX });
    const title = (x: number, y: number, value: string, colour: number, originX = 0) =>
      addBodyText(this, undefined, { x, y }, value, { colour, font: "title", originX });
    const body = pixelFontMetrics(this, "body");
    const fonts = { body, title: pixelFontMetrics(this, "title") };
    // The badges wrap onto a second row past BADGE_STRIP.perRow while the panel, every closing
    // line on one line, has room above it. A closing line wraps onto a second line at 2x while
    // the panel has room for it, the panel growing into the badge strip's area when no badge
    // shows.
    const badgeRows = endBadgeRows(fonts, lines.length, closing, earned.length);
    const strip = endBadgeStrip(badgeRows);
    const quipFit = (lines: number) => ({ room: QUIP_TEXT_ROOM, style: textOnLines(lines) });
    const wanted = closing.map((line) => {
      const { lines: shown } = withProbe(this, BODY_TEXT, (probe) => {
        setPixelText(probe, line.text);
        return fitPixelText(probe, quipFit(QUIP_LINES), 0, 0);
      });
      return { fired: line.fired, lines: Math.min(QUIP_LINES, shown.length) };
    });
    const quipLines = grantedQuipLines(fonts, badgeRows, lines.length, wanted);
    const quipRows = closing.map(({ fired }, i) => ({ fired, lines: itemAt(quipLines, i) }));
    const { panel, rows } = endPanelLayout(fonts, lines.length, quipRows);
    addPanel(this, panel);
    const g = this.add.graphics();

    const words = gameData.menuText.end;
    addDisplayText(this, SCREEN_CONFIG.width / 2, TITLE_Y, words.titles[walk.outcome], {
      colour: PALETTE.plum,
      font: "title",
      originX: 0.5,
      scale: TEXT_SCALE,
    });
    if (newBest) {
      this.showRibbon(reduced);
      soundboardOf(this).play("newBest");
    }

    // Each amount in the short form from a thousand dollars, the labels clear of it.
    let y = BREAKDOWN.top;
    for (const line of lines) {
      const amount = signedShortDollarText(line.amount);
      text(BREAKDOWN.amountRight, y, amount, amountColour(line.amount), 1);
      text(BREAKDOWN.label, y, line.label, PALETTE.plum);
      y += BREAKDOWN.pitch;
    }

    text(SIDE.x, BREAKDOWN.top, words.zonesWalked, PALETTE.plum);
    zonePips(walkLength(gameData), walk).forEach((pip, i) => {
      const x = SIDE.x + i * SIDE.pipPitch;
      const tag = pipTag(gameData, { state: pip, zone: walk.route[i] ?? null });
      if (addTagImage(this, ZONE_PIPS_KEY, tag, x, SIDE.pipsY) === undefined) {
        fillRect(g, pip === "todo" ? PALETTE.grey : PALETTE.forest, {
          height: 8,
          width: 18,
          x,
          y: SIDE.pipsY,
        });
      }
    });
    const zones = `${walk.zonesFinished}/${walkLength(gameData)}`;
    text(SIDE.right, SIDE.pipsY, zones, PALETTE.plum, 1);
    // The walk's total under the pips in the body font, as the breakdown's amounts are, on
    // TOTAL's row, clear of its title-font label.
    const totalText = signedShortDollarText(walk.earnedCents);
    const totalY = sideTotalAmountY(body, fonts.title);
    text(SIDE.right, totalY, totalText, PALETTE.forest, 1);
    title(SIDE.x, SIDE.totalY, words.total, PALETTE.plum);

    const quipsTop = rows[0]?.top ?? 0;
    const { rule } = QUIPS;
    fillRect(g, PALETTE.tan, { height: 1, width: rule.width, x: rule.x, y: quipsTop - rule.above });
    const celebrating = earned.length > 0;
    closing.forEach((line, i) => {
      const { height, top: row } = itemAt(rows, i);
      const { well } = QUIPS;
      fillRect(g, PALETTE.tan, { height: well.size, width: well.size, x: well.x, y: row + well.y });
      const faceX = QUIPS.face.x;
      const faceY = row + QUIPS.face.y;
      if (celebrating && !line.fired) {
        addCheeringFace(this, reduced, line.dog, faceX, faceY);
      } else {
        const key = ownerFaceKey(gameData, line.dog);
        const face = this.add.sprite(faceX, faceY, key).setOrigin(0);
        playTag(face, key, line.fired ? "fired" : "happy", reduced);
      }
      const { bubble, headerY, nameY, textX } = QUIPS;
      this.addBubble({ height, width: bubble.width, x: bubble.x, y: row });
      // The owner's name under the well, at 1x.
      const owner = gameData.dogs[line.dog].owner.name;
      const name = addPixelText(this, 0, row + nameY, owner, { colour: PALETTE.rust, scale: 1 });
      const nameInk = inkSpan(name);
      name.setX(quipNameX(nameInk.right - nameInk.left) - nameInk.left);
      if (line.fired) {
        const header = fillLine(MENU_TEXT_FIELDS.end, words, "firedYou", { owner });
        title(textX, row + headerY, header, PALETTE.darkRed);
      }
      const quipRow = itemAt(quipRows, i);
      const textY = row + quipTextY(fonts, quipRow, height);
      const quip = text(textX, textY, line.text, PALETTE.plum);
      fitPixelText(quip, quipFit(quipRow.lines), textX, textY);
    });

    if (celebrating) {
      this.badges = addBadgeCelebration(this, reduced, strip, badgeRows, earned);
      // After a new best's fanfare, so the two do not play over each other.
      this.time.delayedCall(newBest ? BADGE_SOUND_AFTER_BEST_MS : 0, () =>
        soundboardOf(this).play("badge"),
      );
    }

    const button = addMenuButton(this, BUTTON, words.backHome, { available: true, primary: true });
    const badgeHits = badgeStripHits(strip, badgeRows, this.badges.length);
    // Badges have no tap action of their own, so a tap opens a badge's card as a hold does.
    // With a card open, a tap anywhere closes it.
    this.presses = listenTargetPress<EndTarget>(this, {
      onDown: (pointer, target) => {
        addTapBurst(this, pointer.x, pointer.y);
        const at = { x: pointer.x, y: pointer.y };
        const rule = holdRule(gameData.tuning, TILE_SLOP_PX);
        this.hold =
          typeof target === "object"
            ? { badge: target.badge, press: startHold(rule, at, this.time.now) }
            : undefined;
      },
      onMove: (pointer) => {
        if (this.hold !== undefined && pointer.isDown) {
          const press = moveHold({ x: pointer.x, y: pointer.y }, this.hold.press);
          this.hold = { ...this.hold, press };
        }
      },
      onPressed: (target) => {
        button.setPressed(target === "home");
        if (target === undefined) {
          this.hold = undefined;
        }
      },
      onTap: (target) => {
        if (target === "dismiss") {
          this.closeCard();
        } else if (target === "home") {
          goHome();
        } else {
          this.openCard(target.badge);
        }
      },
      same: sameByValue,
      targetAt: (x, y) =>
        endTargetAt({ badgeHits, button: BUTTON, cardOpen: this.card !== undefined }, x, y),
    });
    // A tap on the page beside the game closes an open card too.
    listenOutsideTap(
      this,
      () => (this.card === undefined ? undefined : screenArea([SCREEN_LAYOUT.screen])),
      () => this.closeCard(),
    );
    // Back home is the page's way out, so Escape and back take it too, once any open card has
    // closed. P does not: a player pausing as the walk ends would skip the page. A key's
    // auto-repeat does nothing.
    const back = () => (this.card === undefined ? goHome() : this.closeCard());
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!event.repeat && (isConfirmKey(event.key) || event.key === "Escape")) {
        back();
      }
    });
    onBackPressed(this, back);
  }

  // The badge's card over the screen, bursting with confetti as it opens (addBadgeDetail).
  private openCard(index: number): void {
    const badge = this.badges[index];
    if (badge === undefined) {
      return;
    }
    this.closeCard();
    this.card = this.add.container(0, 0).setDepth(CARD_DEPTH);
    addBadgeDetail(this, this.card, this.reduced, true, badge);
  }

  private closeCard(): void {
    this.card?.destroy();
    this.card = undefined;
  }

  // The walker and the dogs still walking come up the front path from RETURN_HOME.risePx
  // under their spots (walkUpOffset), then their owners wave. Drawn before the panel, so the
  // pack rises from behind its top edge.
  private addReturnHome(reduced: boolean, walk: Pick<LastWalk, "dogs" | "firings">): void {
    const scene = RETURN_HOME_SCENE;
    if (!this.textures.exists(END_SCREEN_KEY)) {
      const ground = this.add.graphics();
      fillRect(ground, PALETTE.green, scene.lawn);
      fillRect(ground, PALETTE.darkGreen, { ...scene.lawn, height: 2 });
      fillRect(ground, PALETTE.tan, scene.path);
      fillRect(ground, PALETTE.brown, scene.step);
    }
    const dogs = homecomers(walk);
    const owners = dogs.map((dog, i) => {
      const at = itemAt(scene.owners, i);
      const sprite = addOwnerFigure(this, gameData, reduced, dog, { footY: at.y, x: at.x }, [
        "idle",
      ]);
      return { at, dog, sprite };
    });

    const pack = this.add.container(0, 0);
    const shadows = this.add.graphics();
    pack.add(shadows);
    const walkerKey = walkerSpriteKey(this, walkerInUse(profileSave(this)));
    const { walker: walkerAt } = scene;
    const figures = new PackFigures(this, { still: reduced, tag: "walk" }, walkerKey, dogs);
    const standing = dogs.map((dog, rank) => {
      const { x, y } = itemAt(scene.dogs, rank);
      const placement = { dx: x - walkerAt.x, footDy: y - walkerAt.y };
      return { dog, feet: { footY: y, x }, placement, rank };
    });
    figures.standInYard(shadows, scene.path, {
      dogs: standing,
      walker: { footY: walkerAt.y, x: walkerAt.x },
    });
    pack.add(figures.layers());

    // The game loop's time: in create, the scene clock still reads the time the scene booted
    // or last ran, until its first frame.
    const startedMs = this.game.loop.time;
    let shown: ReturnPhase | undefined;
    const step = () => {
      const elapsed = this.game.loop.time - startedMs;
      pack.setY(walkUpOffset(reduced, elapsed));
      const phase = returnPhase(reduced, elapsed);
      if (phase !== shown) {
        shown = phase;
        figures.play(reduced, phase === "walking" ? "walk" : "idle");
        for (const { dog, sprite } of owners) {
          const body = ownerSpriteKey(gameData, dog);
          const tag = firstTag(this, body, phase === "waving" ? ["wave", "idle"] : ["idle"]);
          if (sprite.texture.key === body && tag !== undefined) {
            playTag(sprite, body, tag, reduced);
          }
        }
      }
      for (const { at, dog, sprite } of owners) {
        const faceOnly = sprite.texture.key !== ownerSpriteKey(gameData, dog);
        sprite.setX(at.x + (faceOnly ? waveOffset(reduced, elapsed) : 0));
      }
    };
    step();
    this.returnHomeStep = step;
  }

  override update(): void {
    this.returnHomeStep?.();
    if (this.hold !== undefined) {
      const { fire, press } = tickHold(this.time.now, this.hold.press);
      this.hold = { ...this.hold, press };
      // A hold opens the card while the finger is still down; its release then taps nothing.
      if (fire) {
        this.presses?.cancel();
        this.openCard(this.hold.badge);
      }
    }
  }

  // A ui-quip speech bubble with its tail flipped to point right at the face, or a framed box
  // while it is missing.
  private addBubble(rect: Rect): void {
    addPanel(this, rect, "ui-quip");
    if (this.textures.exists("ui-quip-tail")) {
      const tail = this.add.image(QUIPS.tail.x, rect.y + QUIPS.tail.y, "ui-quip-tail");
      tail.setOrigin(0).setFlipX(true);
    }
  }

  // The new-best ribbon drops into place; with reduced motion it is simply there.
  private showRibbon(reduced: boolean): void {
    if (!this.textures.exists(RIBBON.key)) {
      addDisplayText(this, SCREEN_CONFIG.width / 2, RIBBON.y + 4, gameData.menuText.end.newBest, {
        colour: PALETTE.darkRed,
        font: "title",
        originX: 0.5,
        scale: TEXT_SCALE,
      });
      return;
    }
    const ribbon = this.add.image(RIBBON.x, RIBBON.y, RIBBON.key).setOrigin(0);
    if (reduced) {
      return;
    }
    ribbon.setY(RIBBON.y - RIBBON.riseFrom).setAlpha(0);
    this.tweens.add({
      alpha: 1,
      duration: RIBBON.dropMs,
      ease: "Back.easeOut",
      targets: ribbon,
      y: RIBBON.y,
    });
  }
}
