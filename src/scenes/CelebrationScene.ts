import { Display, type Input, Scene } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import type { AchievementId, DogId } from "../data/types";
import { isConfirmKey, isPauseKey } from "../input/keyBindings";
import { containsPoint, type Rect } from "../layout/rect";
import { PHONE_EVENTS } from "../pwa";
import { addBadgeCelebration, addCheeringFace } from "./badges";
import { PALETTE } from "./palette";
import { currentSettings } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import { soundboardOf } from "./soundboard";
import { addMenuButton } from "./uiKit";

export interface CelebrationSceneData {
  achievements: readonly AchievementId[];
  // The owners who cheer, at most three.
  owners: readonly DogId[];
  resume: SceneKey;
}

const DIM_ALPHA = 0.6;
// The badges' panel, as tall as the end screen's, then a row of faces when owners cheer.
const PANEL = { badgesHeight: 118, facesHeight: 44, width: 344, x: 8 };
const FACES = { pitch: 44, size: 32, top: 4 };
// 44 game pixels tall: 48 CSS pixels on a 390px-wide phone, 12 under the panel.
const BUTTON = { gap: 12, height: 44, width: 264, x: 48 };

// Badges earned away from a run's end, on launch or by a purchase, over the dimmed home screen:
// the badges burst in and the owners cheer. Nice! returns to the screen below.
export class CelebrationScene extends Scene {
  constructor() {
    super(SCENE_KEYS.celebration);
  }

  create({ achievements, owners, resume }: CelebrationSceneData): void {
    const reduced = currentSettings(this).reducedMotion;
    const { b, g, r } = Display.Color.IntegerToRGB(PALETTE.ink);
    this.cameras.main.setBackgroundColor({ a: Math.round(DIM_ALPHA * 255), b, g, r });
    const cheering = owners.slice(0, 3);
    const height = PANEL.badgesHeight + (cheering.length > 0 ? PANEL.facesHeight : 0);
    const top = Math.round((SCREEN_CONFIG.height - height - BUTTON.gap - BUTTON.height) / 2);
    const panel: Rect = { height, width: PANEL.width, x: PANEL.x, y: top };
    addBadgeCelebration(this, reduced, 2, panel, achievements);
    soundboardOf(this).play("badge");
    const left = SCREEN_CONFIG.width / 2 - ((cheering.length - 1) * FACES.pitch + FACES.size) / 2;
    const facesY = top + PANEL.badgesHeight + FACES.top;
    cheering.forEach((dog, i) => {
      addCheeringFace(this, reduced, dog, Math.round(left + i * FACES.pitch), facesY);
    });

    const buttonRect: Rect = {
      height: BUTTON.height,
      width: BUTTON.width,
      x: BUTTON.x,
      y: top + height + BUTTON.gap,
    };
    const button = addMenuButton(this, buttonRect, "Nice!");
    const close = () => {
      this.scene.resume(resume);
      this.scene.stop();
    };
    let pressed = false;
    this.input.on("pointerdown", (pointer: Input.Pointer) => {
      pressed = containsPoint(buttonRect, pointer.x, pointer.y);
      button.setState(pressed ? "pressed" : "normal");
    });
    this.input.on("pointerup", (pointer: Input.Pointer) => {
      button.setState("normal");
      if (pressed && containsPoint(buttonRect, pointer.x, pointer.y)) {
        close();
      }
      pressed = false;
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (isConfirmKey(event.key) || isPauseKey(event.key)) {
        close();
      }
    });
    window.addEventListener(PHONE_EVENTS.backPressed, close);
    this.events.once("shutdown", () => window.removeEventListener(PHONE_EVENTS.backPressed, close));
  }
}
