import { type GameObjects, type Input, Scene } from "phaser";

import { itemAt } from "../arrays";
import { dogSpriteKey, ownerFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { closingLines, earningsBreakdown, zonePips } from "../home/endView";
import { dollarText } from "../home/home";
import {
  homecomers,
  type ReturnPhase,
  returnPhase,
  walkUpOffset,
  waveOffset,
} from "../home/returnHome";
import { isConfirmKey } from "../input/keyBindings";
import { COLLAR_HEIGHT, leashHand } from "../layout/packFormation";
import { containsPoint, type Rect } from "../layout/rect";
import { stopWakeLock } from "../pwa";
import { cents } from "../rules/units";
import type { LastWalk } from "../save/schema";
import type { EndReason } from "../state/runState";
import { addBadgeCelebration, addBurst, addCheeringFace, NEW_BEST_BURST } from "./badges";
import { drawPixelLine, drawShadow, fillRect } from "./draw";
import { addOwnerFigure, ownerSpriteKey } from "./ownerFigure";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import { currentSettings, lastRunEnd, profileSave, walkerSpriteKey } from "./profileStore";
import { SCENE_KEYS } from "./sceneKeys";
import { soundboardOf } from "./soundboard";
import { addStandingSprite, firstTag, spriteMetrics } from "./sprites";
import { addMenuButton, addPanel, addTagImage, fitText, showTag, TEXT_SCALE } from "./uiKit";

const TITLES: Readonly<Record<EndReason, string>> = {
  finished: "Walk done!",
  noDogs: "Out of dogs",
  wentHome: "Headed home",
};
// The menus mock's end screen, with every text at 2x: the rows are taller than the mock's, so
// the quips sit lower, the panel is taller and the badges earned go in a second panel under it.
const END_SCREEN_KEY = "screen-end";
const LOGO = { key: "logo", x: 116, y: 52 };
const PANEL: Rect = { height: 312, width: 312, x: 24, y: 140 };
const RIBBON = { dropMs: 360, key: "ui-new-best", riseFrom: 12, x: 144, y: 130 };
// fx-new-best's 96x48 frame sits 12 left of and 14 above the ribbon; with reduced motion it
// holds one still frame.
const RIBBON_BURST = { height: 48, width: 96, x: RIBBON.x - 12, y: RIBBON.y - 14 };
const TITLE_Y = 158;
const BREAKDOWN = { amountRight: 196, label: 40, pitch: 16, top: 182 };
const SIDE = { bankY: 222, iconY: 240, pipPitch: 21, pipsY: 200, right: 320, x: 212 };
const QUIPS = {
  bubble: { height: 40, width: 244, x: 80 },
  face: { x: 37, y: 2 },
  pitch: 44,
  tail: { x: 75, y: 16 },
  textX: 86,
  top: 318,
  well: { size: 34, x: 36, y: 1 },
};
const BADGES: Rect = { height: 118, width: 344, x: 8, y: 458 };
const BADGE_SOUND_AFTER_BEST_MS = 1200;
// The return home, between the logo and the panel: the walker and pack walk up the front path
// from behind the panel's top edge to the house's step while the owners wave either side.
// The house, lawn, path and step are part of screen-end; without it a tan path and step
// cross a strip of lawn. Spots are where feet end up, in pack order; the pack starts
// returnHome's risePx lower.
const RETURN_HOME_SCENE = {
  dogs: [
    { x: 166, y: 124 },
    { x: 194, y: 123 },
    { x: 152, y: 126 },
  ],
  lawn: { height: 20, width: 360, x: 0, y: 120 },
  owners: [
    { x: 144, y: 128 },
    { x: 216, y: 128 },
    { x: 116, y: 128 },
  ],
  path: { height: 12, width: 24, x: 168, y: 128 },
  step: { height: 4, width: 32, x: 164, y: 124 },
  walker: { x: 180, y: 128 },
} as const;
// 44 game pixels tall: 48 CSS pixels on a 390px-wide phone.
const BUTTON: Rect = { height: 44, width: 264, x: 48, y: 584 };

function signed(amount: number): string {
  const sign = amount < 0 ? "-" : "+";
  return `${sign}${dollarText(cents(Math.abs(amount)))}`;
}

// Money gained in forest and lost in darkRed, each with its sign, on the cream panel.
function amountColor(amount: number): number {
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
    if (this.textures.exists(END_SCREEN_KEY)) {
      this.add.image(0, 0, END_SCREEN_KEY).setOrigin(0);
    } else {
      fillRect(this.add.graphics(), PALETTE.darkBrown, {
        height: SCREEN_CONFIG.height,
        width: SCREEN_CONFIG.width,
        x: 0,
        y: 0,
      });
    }
    this.addReturnHome(reduced, walk);
    // Over the pack: the walker's head reaches the logo's bottom edge.
    if (this.textures.exists(LOGO.key)) {
      this.add.image(LOGO.x, LOGO.y, LOGO.key).setOrigin(0);
    }
    // A walk that earned nothing is no best, even the first.
    const newBest = ended?.newBestWalk === true && walk.earnedCents > 0;
    if (newBest && this.textures.exists(RIBBON.key)) {
      // Behind the panel, so the sparkles rise from behind the ribbon and never cover the title.
      const { height, width, x, y } = RIBBON_BURST;
      addBurst(this, reduced, NEW_BEST_BURST, 1, x + width / 2, y + height / 2);
    }
    addPanel(this, PANEL);
    const g = this.add.graphics();
    const text = (x: number, y: number, value: string, color: number, originX = 0) =>
      addPixelText(this, x, y, value, { color, originX, scale: TEXT_SCALE });
    const title = (x: number, y: number, value: string, color: number, originX = 0) =>
      addPixelText(this, x, y, value, { color, font: "title", originX, scale: TEXT_SCALE });

    title(SCREEN_CONFIG.width / 2, TITLE_Y, TITLES[walk.outcome], PALETTE.plum, 0.5);
    if (newBest) {
      this.showRibbon(reduced);
      soundboardOf(this).play("newBest");
    }

    let y = BREAKDOWN.top;
    const lines = ended === null ? [] : earningsBreakdown(ended.changes, walk.earnedCents);
    for (const line of lines) {
      text(BREAKDOWN.label, y, line.label, PALETTE.plum);
      text(BREAKDOWN.amountRight, y, signed(line.amount), amountColor(line.amount), 1);
      y += BREAKDOWN.pitch;
    }
    const ruleWidth = BREAKDOWN.amountRight - BREAKDOWN.label;
    fillRect(g, PALETTE.tan, { height: 1, width: ruleWidth, x: BREAKDOWN.label, y: y + 2 });
    title(BREAKDOWN.label, y + 8, "Total", PALETTE.plum);
    title(BREAKDOWN.amountRight, y + 8, signed(walk.earnedCents), PALETTE.forest, 1);

    text(SIDE.x, BREAKDOWN.top, "Zones walked", PALETTE.plum);
    zonePips(gameData.world.zones.length, walk).forEach((pip, i) => {
      const x = SIDE.x + i * SIDE.pipPitch;
      if (addTagImage(this, "ui-zone-pips", pip, x, SIDE.pipsY) === undefined) {
        fillRect(g, pip === "todo" ? PALETTE.grey : PALETTE.forest, {
          height: 8,
          width: 18,
          x,
          y: SIDE.pipsY,
        });
      }
    });
    const zones = `${walk.zonesFinished}/${gameData.world.zones.length}`;
    text(SIDE.right, SIDE.pipsY, zones, PALETTE.plum, 1);
    text(SIDE.x, SIDE.bankY, "Bank", PALETTE.plum);
    if (this.textures.exists("icon-money")) {
      this.add.image(SIDE.x, SIDE.iconY, "icon-money").setOrigin(0);
    }
    title(SIDE.x + 20, SIDE.iconY + 2, dollarText(save.bankCents), PALETTE.plum);

    fillRect(g, PALETTE.tan, { height: 1, width: 288, x: 36, y: QUIPS.top - 8 });
    const celebrating = earned.length > 0;
    closingLines(gameData, Math.random, walk).forEach((line, i) => {
      const row = QUIPS.top + i * QUIPS.pitch;
      const { well } = QUIPS;
      fillRect(g, PALETTE.tan, { height: well.size, width: well.size, x: well.x, y: row + well.y });
      const faceX = QUIPS.face.x;
      const faceY = row + QUIPS.face.y;
      if (celebrating && !line.fired) {
        addCheeringFace(this, reduced, line.dog, faceX, faceY);
      } else {
        const key = ownerFaceKey(gameData, line.dog);
        const face = this.add.sprite(faceX, faceY, key).setOrigin(0);
        showTag(reduced, face, key, line.fired ? "fired" : "happy");
      }
      this.addBubble({ ...QUIPS.bubble, y: row });
      const owner = gameData.dogs[line.dog].owner.name;
      const name = title(QUIPS.textX, row + 5, owner, line.fired ? PALETTE.darkRed : PALETTE.plum);
      if (line.fired) {
        fitText(name, QUIPS.bubble.x + QUIPS.bubble.width - 6 - QUIPS.textX, [
          `${owner} fired you`,
          owner,
        ]);
      }
      text(QUIPS.textX, row + 22, line.text, PALETTE.plum);
    });

    if (celebrating) {
      addBadgeCelebration(this, reduced, BADGES, earned);
      // After a new best's fanfare, so the two do not play over each other.
      this.time.delayedCall(newBest ? BADGE_SOUND_AFTER_BEST_MS : 0, () =>
        soundboardOf(this).play("badge"),
      );
    }

    const button = addMenuButton(this, BUTTON, "Back home");
    let pressed = false;
    this.input.on("pointerdown", (pointer: Input.Pointer) => {
      pressed = containsPoint(BUTTON, pointer.x, pointer.y);
      button.setState(pressed ? "pressed" : "normal");
    });
    this.input.on("pointerup", (pointer: Input.Pointer) => {
      button.setState("normal");
      if (pressed && containsPoint(BUTTON, pointer.x, pointer.y)) {
        goHome();
      }
      pressed = false;
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (isConfirmKey(event.key)) {
        goHome();
      }
    });
  }

  // The walker and the dogs still walking come up the front path, then their owners wave.
  // Drawn before the panel, so the pack rises from behind its top edge.
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
    const leashes = this.add.graphics();
    pack.add(shadows);
    const walkerKey = walkerSpriteKey(this, profileSave(this).walker);
    const { walker: walkerAt } = scene;
    const onPath = (x: number) => x >= scene.path.x && x < scene.path.x + scene.path.width;
    const sprites: { key: string; sprite: GameObjects.Sprite }[] = dogs.map((dog, i) => {
      const at = itemAt(scene.dogs, i);
      const key = dogSpriteKey(gameData, dog);
      drawShadow(
        shadows,
        onPath(at.x) ? PALETTE.brown : PALETTE.darkGreen,
        at.x,
        at.y,
        spriteMetrics(key).opaqueWidth,
      );
      return { key, sprite: addStandingSprite(this, key, at.x, at.y) };
    });
    drawShadow(
      shadows,
      PALETTE.brown,
      walkerAt.x,
      walkerAt.y,
      spriteMetrics(walkerKey).opaqueWidth,
    );
    sprites.push({
      key: walkerKey,
      sprite: addStandingSprite(this, walkerKey, walkerAt.x, walkerAt.y),
    });
    pack.add(sprites.map(({ sprite }) => sprite));
    pack.add(leashes);
    dogs.forEach((_, i) => {
      const at = itemAt(scene.dogs, i);
      const hand = leashHand({ dx: at.x - walkerAt.x, footDy: at.y - walkerAt.y });
      drawPixelLine(
        leashes,
        PALETTE.darkRed,
        { x: walkerAt.x + hand.dx, y: walkerAt.y + hand.dy },
        { x: at.x, y: at.y - COLLAR_HEIGHT },
      );
    });

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
        for (const { key, sprite } of sprites) {
          showTag(reduced, sprite, key, phase === "walking" ? "walk" : "idle");
        }
        for (const { dog, sprite } of owners) {
          const body = ownerSpriteKey(gameData, dog);
          const tag = firstTag(this, body, phase === "waving" ? ["wave", "idle"] : ["idle"]);
          if (sprite.texture.key === body && tag !== undefined) {
            showTag(reduced, sprite, body, tag);
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

  // A ui-quip speech bubble with its tail towards the face, or a framed box while it is missing.
  private addBubble(rect: Rect): void {
    if (this.textures.exists("ui-quip")) {
      const corner = 8;
      this.add
        .nineslice(
          rect.x,
          rect.y,
          "ui-quip",
          undefined,
          rect.width,
          rect.height,
          corner,
          corner,
          corner,
          corner,
        )
        .setOrigin(0);
    } else {
      const g = this.add.graphics();
      fillRect(g, PALETTE.plum, rect);
      fillRect(g, PALETTE.cream, {
        height: rect.height - 2,
        width: rect.width - 2,
        x: rect.x + 1,
        y: rect.y + 1,
      });
    }
    if (this.textures.exists("ui-quip-tail")) {
      this.add.image(QUIPS.tail.x, rect.y + QUIPS.tail.y, "ui-quip-tail").setOrigin(0);
    }
  }

  // The new-best ribbon drops into place; with reduced motion it is simply there.
  private showRibbon(reduced: boolean): void {
    if (!this.textures.exists(RIBBON.key)) {
      addPixelText(this, SCREEN_CONFIG.width / 2, RIBBON.y + 4, "New best!", {
        color: PALETTE.darkRed,
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
