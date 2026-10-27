import { type GameObjects, Scene } from "phaser";

import { ownerFaceKey, ZONE_PIPS_KEY } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import {
  breakdownLabelRoom,
  END_LAYOUT,
  END_TEXT_SCALE,
  endPanelLayout,
  grantedQuipLines,
  QUIP_TEXT_ROOM,
  quipNameX,
  quipTextY,
  SIDE_LABEL_ROOM,
  sideTotalAmountY,
  sideTotalLabelRoom,
} from "../home/endLayout";
import { closingLines, earningsBreakdown, zonePips } from "../home/endView";
import { signedDollarText } from "../home/home";
import { MENU_TEXT_FIELDS } from "../home/menuText";
import {
  homecomers,
  type ReturnPhase,
  returnPhase,
  walkUpOffset,
  waveOffset,
} from "../home/returnHome";
import { pipTag } from "../hud/hudView";
import { isConfirmKey } from "../input/keyBindings";
import { itemAt } from "../lib/arrays";
import { fillLine } from "../lib/lines";
import type { Rect } from "../lib/rect";
import { PackFigures, YARD_LEASH_COLOUR } from "../pack/phaser/packFigures";
import { stopWakeLock } from "../pwa";
import { walkLength } from "../rules/route";
import type { LastWalk } from "../save/schema";
import { addDisplayText } from "../ui/phaser/displayText";
import { drawShadow, fillRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import {
  addPixelText,
  fitPixelText,
  fitPixelTextsAlike,
  inkSpan,
  type LabelToFit,
  pixelFontMetrics,
} from "../ui/phaser/pixelText";
import { TEXT_FIT_STYLES, WRAPPING_TEXT_FIT_STYLES } from "../ui/textFit";
import { addBadgeCelebration, addBurst, addCheeringFace, NEW_BEST_BURST } from "./badges";
import { onBackPressed } from "./overlay";
import { addOwnerFigure, ownerSpriteKey } from "./ownerFigure";
import {
  currentSettings,
  lastRunEnd,
  profileSave,
  walkerInUse,
  walkerSpriteKey,
} from "./profileStore";
import { SCENE_KEYS } from "./sceneKeys";
import { soundboardOf } from "./soundboard";
import { firstTag, playTag, spriteMetrics } from "./sprites";
import {
  addMenuButton,
  addPanel,
  addScreenBackdrop,
  addTagImage,
  listenButtonTap,
  TEXT_SCALE,
} from "./uiKit";

const END_SCREEN_KEY = "screen-end";
const LOGO = { ...END_LAYOUT.logo, key: "logo" };
const RIBBON = { ...END_LAYOUT.ribbon, dropMs: 360, key: "ui-new-best", riseFrom: 12 };
const RIBBON_BURST = END_LAYOUT.ribbonBurst;
const TITLE_Y = END_LAYOUT.titleY;
const BREAKDOWN = END_LAYOUT.breakdown;
const SIDE = END_LAYOUT.side;
const QUIPS = END_LAYOUT.quips;
const BADGES: Rect = END_LAYOUT.badges;
const BADGE_SOUND_AFTER_BEST_MS = 1200;
const RETURN_HOME_SCENE = END_LAYOUT.returnHome;
const BUTTON: Rect = END_LAYOUT.button;

// Money gained in forest and lost in darkRed, each with its sign, on the cream panel.
function amountColour(amount: number): number {
  if (amount === 0) {
    return PALETTE.plum;
  }
  return amount > 0 ? PALETTE.forest : PALETTE.darkRed;
}

// The walk's result, already banked: what made up the total, zones walked, the bank, a ribbon
// for a new best walk, and a closing line from each owner. Badges the run earned burst in
// under the panel while the owners still walking cheer. Back home returns to the start screen.
export class EndScene extends Scene {
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
    if (walk === null) {
      goHome();
      return;
    }
    const ended = lastRunEnd(this);
    const earned = ended?.achievements ?? [];
    const reduced = currentSettings(this).reducedMotion;
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
      ended === null ? [] : earningsBreakdown(gameData, ended.changes, walk.earnedCents);
    const closing = closingLines(gameData, Math.random, walk);
    const text = (x: number, y: number, value: string, colour: number, originX = 0) =>
      addPixelText(this, x, y, value, { colour, originX, scale: END_TEXT_SCALE });
    const title = (x: number, y: number, value: string, colour: number, originX = 0) =>
      addPixelText(this, x, y, value, { colour, font: "title", originX, scale: END_TEXT_SCALE });
    // A label set in the first of TEXT_FIT_STYLES that fits room.
    const fitted = (label: GameObjects.BitmapText, room: number, x: number, y: number) =>
      fitPixelText(label, { room, styles: TEXT_FIT_STYLES }, x, y);
    const body = pixelFontMetrics(this, "body");
    // A closing line wraps onto a second line at 2x while the panel has room for it.
    const quipFit = { room: QUIP_TEXT_ROOM, styles: WRAPPING_TEXT_FIT_STYLES };
    const wanted = closing.map((line) => {
      const probe = text(0, 0, line.text, PALETTE.plum);
      const { lines: shown } = fitPixelText(probe, quipFit, 0, 0);
      probe.destroy();
      return { fired: line.fired, lines: shown.length };
    });
    const quipLines = grantedQuipLines(body, lines.length, wanted);
    const quipRows = closing.map(({ fired }, i) => ({ fired, lines: itemAt(quipLines, i) }));
    const { panel, rows } = endPanelLayout(body, lines.length, quipRows);
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

    // Each label fits the room its amount leaves it, every label at the largest size that fits
    // them all.
    const room = (amount: GameObjects.BitmapText) => {
      const ink = inkSpan(amount);
      return breakdownLabelRoom(ink.right - ink.left);
    };
    let y = BREAKDOWN.top;
    const labels: LabelToFit[] = [];
    for (const line of lines) {
      const amount = signedDollarText(line.amount);
      const shown = text(BREAKDOWN.amountRight, y, amount, amountColour(line.amount), 1);
      const label = text(BREAKDOWN.label, y, line.label, PALETTE.plum);
      labels.push({ label, room: room(shown), x: BREAKDOWN.label, y });
      y += BREAKDOWN.pitch;
    }
    fitPixelTextsAlike(TEXT_FIT_STYLES, labels);

    const zonesLabel = text(SIDE.x, BREAKDOWN.top, words.zonesWalked, PALETTE.plum);
    fitted(zonesLabel, SIDE_LABEL_ROOM, SIDE.x, BREAKDOWN.top);
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
    // TOTAL's row, its title-font label fitting the room the amount leaves it.
    const totalText = signedDollarText(walk.earnedCents);
    const totalY = sideTotalAmountY(body, pixelFontMetrics(this, "title"));
    const total = text(SIDE.right, totalY, totalText, PALETTE.forest, 1);
    const totalInk = inkSpan(total);
    const totalLabel = title(SIDE.x, SIDE.totalY, words.total, PALETTE.plum);
    fitted(totalLabel, sideTotalLabelRoom(totalInk.right - totalInk.left), SIDE.x, SIDE.totalY);

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
        const fired = title(textX, row + headerY, header, PALETTE.darkRed);
        fitted(fired, QUIP_TEXT_ROOM, textX, row + headerY);
      }
      const quipRow = itemAt(quipRows, i);
      const textY = row + quipTextY(body, quipRow, height);
      const quip = text(textX, textY, line.text, PALETTE.plum);
      fitPixelText(
        quip,
        quipRow.lines > 1 ? quipFit : { ...quipFit, styles: TEXT_FIT_STYLES },
        textX,
        textY,
      );
    });

    if (celebrating) {
      addBadgeCelebration(this, reduced, BADGES, earned);
      // After a new best's fanfare, so the two do not play over each other.
      this.time.delayedCall(newBest ? BADGE_SOUND_AFTER_BEST_MS : 0, () =>
        soundboardOf(this).play("badge"),
      );
    }

    const button = addMenuButton(this, BUTTON, words.backHome, { available: true, primary: true });
    listenButtonTap(this, button, goHome);
    // Back home is the page's way out, so Escape and back take it too. P does not: a player
    // pausing as the walk ends would skip the page. A key's auto-repeat does nothing.
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!event.repeat && (isConfirmKey(event.key) || event.key === "Escape")) {
        goHome();
      }
    });
    onBackPressed(this, goHome);
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
    const onPath = (x: number) => x >= scene.path.x && x < scene.path.x + scene.path.width;
    const figures = new PackFigures(this, { still: reduced, tag: "walk" }, walkerKey, dogs);
    const standing = dogs.map((dog, rank) => {
      const { x, y } = itemAt(scene.dogs, rank);
      const placement = { dx: x - walkerAt.x, footDy: y - walkerAt.y };
      return { dog, feet: { footY: y, x }, placement, rank };
    });
    const shadow = (key: string, depth: number, x: number, footY: number) =>
      drawShadow(
        shadows,
        onPath(x) ? PALETTE.brown : PALETTE.darkGreen,
        x,
        footY,
        spriteMetrics(key).opaqueWidth * depth,
      );
    const look = { colour: YARD_LEASH_COLOUR, taut: null };
    figures.stand(0, shadow, look, {
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
