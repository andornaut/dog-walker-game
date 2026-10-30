import { containsPoint, type Rect } from "@andornaut/game-kit/rect";
import { Scene } from "phaser";

import { gameData } from "../data";
import { SCREEN_LAYOUT } from "../data/screen";
import type { AchievementId, DogId } from "../data/types";
import { badgeStripRows, CELEBRATION_PANEL } from "../home/badgesView";
import { overlayRegion, regionOutside } from "../home/homeBar";
import { isConfirmKey, isPauseKey, menuKeyActs } from "../input/keyBindings";
import { WIDE_BUTTON } from "../layout/screenLayout";
import { exitShown } from "../pwa";
import { closeControl } from "../ui/closeControl";
import { addRampDim } from "../ui/phaser/rampDim";
import { addBadgeCelebration, addCheeringFace } from "./badges";
import { listenHomeBar } from "./homeBarPress";
import { addCardClose } from "./homePanels";
import { closeOverlay, listenDismiss } from "./overlay";
import { currentSettings } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import { soundboardOf } from "./soundboard";
import { listenTargetPress } from "./targetPress";
import { addMenuButton, addTapBurst } from "./uiKit";

export interface CelebrationSceneData {
  achievements: readonly AchievementId[];
  // The owners who cheer, at most three.
  owners: readonly DogId[];
  resume: SceneKey;
}

const SCREEN = SCREEN_LAYOUT.screen;
const PANEL = CELEBRATION_PANEL;
const FACES = { pitch: 44, size: 32, top: 4 };
// 12 under the panel.
const BUTTON = { ...WIDE_BUTTON, gap: 12 };

// Badges earned away from a run's end, on launch or by a purchase, over the dimmed home screen:
// the badges burst in and the owners cheer. Nice! and the close control return to the screen
// below.
export class CelebrationScene extends Scene {
  constructor() {
    super(SCENE_KEYS.celebration);
  }

  create({ achievements, owners, resume }: CelebrationSceneData): void {
    const reduced = currentSettings(this).reducedMotion;
    // Dimmed down the colour ramps under the lit top bar, as under the pause menu and the cards.
    const dim = overlayRegion("home");
    addRampDim(this, dim);
    const cheering = owners.slice(0, 3);
    const height = PANEL.badgesHeight + (cheering.length > 0 ? PANEL.facesHeight : 0);
    const top = Math.round((SCREEN.height - height - BUTTON.gap - BUTTON.height) / 2);
    const panel: Rect = { height, width: PANEL.width, x: PANEL.x, y: top };
    const rows = badgeStripRows(achievements.length);
    addBadgeCelebration(this, reduced, panel, rows, achievements, true);
    const closeButton = addCardClose(this, this.add.container(0, 0), panel, false);
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
    // Nice! and the close control in the panel's corner each close it, shown pressed while held.
    const closeHit = closeControl(panel).hit;
    listenTargetPress<"button" | "close">(this, {
      onDown: (pointer) => addTapBurst(this, pointer.x, pointer.y),
      onPressed: (target) => {
        button.setPressed(target === "button");
        closeButton.setPressed(target === "close");
      },
      onTap: close,
      targetAt: (x, y) => {
        if (containsPoint(closeHit, x, y)) {
          return "close";
        }
        return containsPoint(buttonRect, x, y) ? "button" : undefined;
      },
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (
        menuKeyActs(event.repeat, event.key) &&
        (isConfirmKey(event.key) || isPauseKey(event.key))
      ) {
        close();
      }
    });
    // A tap anywhere around the panel and Nice!, the top bar's empty area included, closes, as
    // Nice! and the close control do; the top bar's buttons keep their own taps.
    const exit = exitShown();
    listenDismiss(this, regionOutside(exit, "home", [panel, buttonRect]), close);
    listenHomeBar(this, exit, close);
  }
}
