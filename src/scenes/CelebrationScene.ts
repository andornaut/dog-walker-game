import { containsPoint, type Rect } from "@andornaut/game-kit/rect";
import { inkRowsFromCapTop } from "@andornaut/game-kit/text/bitmapFont";
import { Scene } from "phaser";

import { gameData } from "../data";
import { SCREEN_LAYOUT } from "../data/screen";
import type { AchievementId, DogId } from "../data/types";
import {
  BADGE_STRIP,
  badgeRowNames,
  badgeStripRows,
  celebrationTitle,
  earnedBadges,
  stripUnderClose,
} from "../home/badgesView";
import { overlayRegion, regionOutside } from "../home/homeBar";
import { MODAL, modalActionWidth, modalRect, modalTitleWidth } from "../home/modalLayout";
import { isConfirmKey, isPauseKey, menuKeyActs } from "../input/keyBindings";
import { exitShown } from "../pwa";
import { BUTTON_SIZE } from "../ui/buttonGeometry";
import { closeControl } from "../ui/closeControl";
import { labelInkWidth, pixelFontMetrics, withProbe } from "../ui/phaser/pixelText";
import { addRampDim } from "../ui/phaser/rampDim";
import { addBadgeCelebration, addCheeringFace } from "./badges";
import { listenHomeBar } from "./homeBarPress";
import { addCardClose } from "./homePanels";
import { modalTextWidth } from "./modalMeasure";
import { closeOverlay, listenDismiss } from "./overlay";
import { currentSettings } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import { soundboardOf } from "./soundboard";
import { listenTargetPress } from "./targetPress";
import { addMenuButton, addTapBurst, BODY_TEXT } from "./uiKit";

export interface CelebrationSceneData {
  achievements: readonly AchievementId[];
  // The owners who cheer, at most three.
  owners: readonly DogId[];
  resume: SceneKey;
}

const SCREEN = SCREEN_LAYOUT.screen;
const FACES = { pitch: 44, size: 32 };
// The action follows the panel at the section gap.
const BUTTON = { gap: MODAL.gap, height: BUTTON_SIZE.compact.height };

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
    const rows = badgeStripRows(achievements.length);
    const names = earnedBadges(gameData, achievements).map(({ name }) => name);
    const buttonWidth = modalActionWidth(
      modalTextWidth(this, "title", [gameData.menuText.celebration.button]),
    );
    const width = Math.min(
      SCREEN.width - 2 * MODAL.margin,
      Math.max(
        buttonWidth + 2 * MODAL.pad,
        modalTitleWidth(
          modalTextWidth(this, "title", [celebrationTitle(gameData, achievements.length)]),
        ),
        modalTextWidth(this, "body", names) * Math.min(names.length, BADGE_STRIP.maxNamed) +
          2 * MODAL.pad,
        BADGE_STRIP.badgeSize * Math.min(names.length, BADGE_STRIP.perRow) + 2 * MODAL.pad,
        (cheering.length - 1) * FACES.pitch + FACES.size + 2 * MODAL.pad,
      ),
    );
    const slotWidth =
      (width - 2 * BADGE_STRIP.inset) / Math.min(achievements.length, BADGE_STRIP.perRow);
    const lineCounts = withProbe(this, BODY_TEXT, (probe) =>
      badgeRowNames(labelInkWidth(probe), slotWidth, names).lines.map((lines) => lines.length),
    );
    const namedLines = achievements.length <= BADGE_STRIP.maxNamed ? Math.max(0, ...lineCounts) : 0;
    const shift = stripUnderClose({ height: 0, width, x: 0, y: 0 }).y;
    const badgeBottom =
      shift + BADGE_STRIP.badgeTop + (rows - 1) * BADGE_STRIP.rowPitch + BADGE_STRIP.badgeSize;
    const nameHeight =
      namedLines === 0
        ? 0
        : BADGE_STRIP.nameGap +
          (namedLines - 1) * BADGE_STRIP.namePitch +
          inkRowsFromCapTop(pixelFontMetrics(this, "body")) * 2;
    const badgesHeight = badgeBottom + nameHeight + MODAL.pad;
    const height = badgesHeight + (cheering.length > 0 ? MODAL.gap + FACES.size + MODAL.pad : 0);
    const group = modalRect(dim, undefined, { height: height + BUTTON.gap + BUTTON.height, width });
    const top = group.y;
    const panel: Rect = { height, width, x: group.x, y: top };
    addBadgeCelebration(this, reduced, panel, rows, achievements, true);
    const closeButton = addCardClose(this, this.add.container(0, 0), panel, false);
    soundboardOf(this).play("badge");
    const left = SCREEN.width / 2 - ((cheering.length - 1) * FACES.pitch + FACES.size) / 2;
    const facesY = top + badgesHeight + MODAL.gap;
    cheering.forEach((dog, i) => {
      addCheeringFace(this, reduced, dog, Math.round(left + i * FACES.pitch), facesY);
    });

    const buttonRect: Rect = {
      height: BUTTON.height,
      width: buttonWidth,
      x: (SCREEN.width - buttonWidth) / 2,
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
