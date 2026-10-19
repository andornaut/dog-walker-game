import { type Input, Scene } from "phaser";

import { ownerFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { closingLines, earningsBreakdown } from "../home/endView";
import { dollarText, wrapWords } from "../home/home";
import { isConfirmKey } from "../input/keyBindings";
import { containsPoint, type Rect } from "../layout/rect";
import { stopWakeLock } from "../pwa";
import { cents } from "../rules/units";
import type { EndReason } from "../state/runState";
import { fillRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import { currentSettings, lastRunEnd, profileSave } from "./profileStore";
import { SCENE_KEYS } from "./sceneKeys";
import { soundboardOf } from "./soundboard";
import { addMenuButton, addPanel, fitText, showTag, TEXT_SCALE } from "./uiKit";

const TITLES: Readonly<Record<EndReason, string>> = {
  finished: "Walk done!",
  noDogs: "Everyone went home",
  wentHome: "Headed home",
};
const PANEL: Rect = { height: 420, width: 336, x: 12, y: 24 };
// 44 game pixels tall: 48 CSS pixels on a 390px-wide phone.
const BUTTON: Rect = { height: 44, width: 264, x: 48, y: 584 };
const RIBBON = { dropMs: 360, key: "ui-new-best", riseFrom: 12, y: 30 };
const LINE_PITCH = 17;
const QUIP = { chars: 38, lineHeight: 16, lines: 2, pitch: 50 };
const AMOUNT_RIGHT = 332;
const LABEL_LEFT = 28;

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

// The walk's result, already banked: the total and what made it up, zones walked, the bank,
// a ribbon for a new best walk, and a closing line from each owner. Back home returns to the
// start screen.
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
    addPanel(this, PANEL);
    const g = this.add.graphics();
    const center = SCREEN_CONFIG.width / 2;
    const text = (x: number, y: number, value: string, color: number, originX = 0) =>
      addPixelText(this, x, y, value, { color, originX, scale: TEXT_SCALE });

    addPixelText(this, center, PANEL.y + 10, TITLES[walk.outcome], {
      color: PALETTE.plum,
      font: "title",
      originX: 0.5,
      scale: TEXT_SCALE,
    });
    // A walk that earned nothing is no best, even the first.
    if (ended?.newBestWalk === true && walk.earnedCents > 0) {
      this.showRibbon(center, reduced);
    }
    addPixelText(this, center, PANEL.y + 56, `+${dollarText(walk.earnedCents)}`, {
      color: PALETTE.forest,
      font: "title",
      originX: 0.5,
      scale: 3,
    });

    let y = PANEL.y + 84;
    if (ended !== null) {
      for (const line of earningsBreakdown(ended.changes, walk.earnedCents)) {
        text(LABEL_LEFT, y, line.label, PALETTE.darkBrown);
        text(AMOUNT_RIGHT, y, signed(line.amount), amountColor(line.amount), 1);
        y += LINE_PITCH;
      }
      fillRect(g, PALETTE.tan, { height: 1, width: AMOUNT_RIGHT - LABEL_LEFT, x: LABEL_LEFT, y });
      y += 6;
    }
    const zones = gameData.world.zones.length;
    text(LABEL_LEFT, y, "Zones walked", PALETTE.darkBrown);
    text(AMOUNT_RIGHT, y, `${walk.zonesFinished}/${zones}`, PALETTE.plum, 1);
    y += LINE_PITCH;
    text(LABEL_LEFT, y, "Bank", PALETTE.darkBrown);
    text(AMOUNT_RIGHT, y, dollarText(save.bankCents), PALETTE.plum, 1);
    y += LINE_PITCH + 8;

    for (const line of closingLines(gameData, Math.random, walk)) {
      const key = ownerFaceKey(line.dog);
      const face = this.add.sprite(PANEL.x + 12, y, key).setOrigin(0);
      showTag(reduced, face, key, line.fired ? "fired" : "happy");
      const owner = gameData.dogs[line.dog].owner.name;
      const name = addPixelText(this, PANEL.x + 50, y + 1, owner, {
        color: line.fired ? PALETTE.darkRed : PALETTE.plum,
        font: "title",
        scale: TEXT_SCALE,
      });
      if (line.fired) {
        fitText(name, PANEL.x + PANEL.width - 8 - name.x, [
          `${owner} fired you`,
          `${owner}: fired`,
          owner,
        ]);
      }
      wrapWords(QUIP.chars, line.text)
        .slice(0, QUIP.lines)
        .forEach((quip, i) => {
          text(PANEL.x + 50, y + 18 + i * QUIP.lineHeight, quip, PALETTE.darkBrown);
        });
      y += QUIP.pitch;
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

  // The new-best ribbon drops into place; with reduced motion it is simply there.
  private showRibbon(center: number, reduced: boolean): void {
    const y = PANEL.y + RIBBON.y;
    if (!this.textures.exists(RIBBON.key)) {
      addPixelText(this, center, y + 4, "New best!", {
        color: PALETTE.darkRed,
        font: "title",
        originX: 0.5,
        scale: TEXT_SCALE,
      });
      return;
    }
    const ribbon = this.add.image(center, y, RIBBON.key).setOrigin(0.5, 0);
    if (reduced) {
      return;
    }
    ribbon.setY(y - RIBBON.riseFrom).setAlpha(0);
    this.tweens.add({
      alpha: 1,
      duration: RIBBON.dropMs,
      ease: "Back.easeOut",
      targets: ribbon,
      y,
    });
  }
}
