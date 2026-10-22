import { Scene } from "phaser";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { AchievementId, DogId } from "../data/types";
import { CELEBRATION_PANEL } from "../home/badgesView";
import { isConfirmKey, isPauseKey, menuKeyActs } from "../input/keyBindings";
import { screenLayout } from "../layout/screenLayout";
import type { Rect } from "../lib/rect";
import { addRampDim } from "../ui/phaser/rampDim";
import { addBadgeCelebration, addCheeringFace } from "./badges";
import { closeOverlay, listenDismiss } from "./overlay";
import { currentSettings } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import { soundboardOf } from "./soundboard";
import { addMenuButton, listenButtonTap } from "./uiKit";

export interface CelebrationSceneData {
  achievements: readonly AchievementId[];
  // The owners who cheer, at most three.
  owners: readonly DogId[];
  resume: SceneKey;
}

const SCREEN = screenLayout(SCREEN_CONFIG).screen;
const PANEL = CELEBRATION_PANEL;
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
    // Dimmed down the colour ramps, as under the pause menu and the cards.
    addRampDim(this, SCREEN);
    const cheering = owners.slice(0, 3);
    const height = PANEL.badgesHeight + (cheering.length > 0 ? PANEL.facesHeight : 0);
    const top = Math.round((SCREEN.height - height - BUTTON.gap - BUTTON.height) / 2);
    const panel: Rect = { height, width: PANEL.width, x: PANEL.x, y: top };
    addBadgeCelebration(this, reduced, panel, achievements);
    soundboardOf(this).play("badge");
    const left = SCREEN.width / 2 - ((cheering.length - 1) * FACES.pitch + FACES.size) / 2;
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
    const button = addMenuButton(this, buttonRect, gameData.menuText.celebration.button, {
      available: true,
      primary: true,
    });
    const close = () => closeOverlay(resume, this);
    listenButtonTap(this, button, close);
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (
        menuKeyActs(event.repeat, event.key) &&
        (isConfirmKey(event.key) || isPauseKey(event.key))
      ) {
        close();
      }
    });
    // The dim around the panel and Nice! closes, as Nice! does.
    listenDismiss(this, [panel, buttonRect], close);
  }
}
