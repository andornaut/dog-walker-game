import { type Input, Scene } from "phaser";

import { ownerFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { closingLines, earningsBreakdown, zonePips } from "../home/endView";
import { dollarText } from "../home/home";
import { isConfirmKey } from "../input/keyBindings";
import { containsPoint, type Rect } from "../layout/rect";
import { stopWakeLock } from "../pwa";
import { cents } from "../rules/units";
import type { EndReason } from "../state/runState";
import { addBadgeCelebration, addBurst, addCheeringFace, NEW_BEST_BURST } from "./badges";
import { fillRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import { currentSettings, lastRunEnd, profileSave } from "./profileStore";
import { SCENE_KEYS } from "./sceneKeys";
import { soundboardOf } from "./soundboard";
import { addMenuButton, addPanel, addTagImage, fitText, showTag, TEXT_SCALE } from "./uiKit";

const TITLES: Readonly<Record<EndReason, string>> = {
  finished: "Walk done!",
  noDogs: "Out of dogs",
  wentHome: "Headed home",
};
// The menus mock's end screen, with every text at 2x: the rows are taller than the mock's, so
// the quips sit lower, the panel is taller and the badges earned go in a second panel under it.
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
  constructor() {
    super(SCENE_KEYS.end);
  }

  create(): void {
    soundboardOf(this).stopMusic();
    stopWakeLock();
    const save = profileSave(this);
    const walk = save.stats.lastWalk;
    const goHome = () => this.scene.start(SCENE_KEYS.start);
    if (walk === null) {
      goHome();
      return;
    }
    const ended = lastRunEnd(this);
    const earned = ended?.achievements ?? [];
    const reduced = currentSettings(this).reducedMotion;
    if (this.textures.exists("screen-end")) {
      this.add.image(0, 0, "screen-end").setOrigin(0);
    } else {
      fillRect(this.add.graphics(), PALETTE.darkBrown, {
        height: SCREEN_CONFIG.height,
        width: SCREEN_CONFIG.width,
        x: 0,
        y: 0,
      });
    }
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
        const key = ownerFaceKey(line.dog);
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
