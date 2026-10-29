import type { Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene } from "phaser";

import { ownerFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_LAYOUT } from "../data/screen";
import type { DogId } from "../data/types";
import { OWNER_TAB, ownerTabRect } from "../hud/walkHud";
import { drawFramedRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import { addPixelText } from "../ui/phaser/pixelText";
import { HUD_DEPTH } from "./hudDepth";
import { playFirstTag } from "./sprites";
import type { TimedGroup } from "./timedGroup";
import { fadeAway } from "./uiKit";

const LAYOUT = SCREEN_LAYOUT;
const POP_MS = 120;
const FADE_MS = 400;
const TAB_KEY = "ui-owner-tab";

type Depthed = GameObjects.GameObject & GameObjects.Components.Depth;

// group: the HUD's timed group the pop and fade join, so they hold while the player has paused.
// still: reduced motion, which shows a tab without popping it in.
interface OwnerTabHooks {
  group: TimedGroup;
  still: () => boolean;
}

// The owners' photo tabs on the dog cards (walkHud.ts OWNER_TAB): when something happens to
// their dog, an owner pops in centred on its card's top edge, in the mood it calls for, then
// fades. A card shows one owner at a time, the newest.
export class OwnerTabs {
  private readonly hooks: OwnerTabHooks;
  private readonly scene: Scene;
  // Each card's owner as shown, by slot.
  private readonly shown = new Map<number, GameObjects.GameObject[]>();

  constructor(scene: Scene, hooks: OwnerTabHooks) {
    this.scene = scene;
    this.hooks = hooks;
  }

  // The owner of the dog on the card at slot, for holdMs, then fading. Nothing shows for a slot
  // with no card.
  pop(at: { dog: DogId; mood: string; slot: number }, holdMs: number): void {
    const card = LAYOUT.dogSlots[at.slot];
    if (card === undefined) {
      return;
    }
    const tab = ownerTabRect(card);
    this.clear(at.slot);
    const parts = [this.addTab(tab), this.addFace(at.dog, at.mood, tab)];
    // The face over the tab.
    parts.forEach((part, i) => (part as Depthed).setDepth(HUD_DEPTH.ownerTab + i));
    this.shown.set(at.slot, parts);
    if (!this.hooks.still()) {
      this.hooks.group.tween(this.scene, {
        alpha: { from: 0, to: 1 },
        duration: POP_MS,
        targets: parts,
      });
    }
    this.hooks.group.join(
      fadeAway(this.scene, parts, { delayMs: holdMs, ms: FADE_MS, rise: 0 }, () => {
        if (this.shown.get(at.slot) === parts) {
          this.shown.delete(at.slot);
        }
      }),
    );
  }

  private clear(slot: number): void {
    const parts = this.shown.get(slot);
    if (parts === undefined) {
      return;
    }
    this.shown.delete(slot);
    this.scene.tweens.killTweensOf(parts);
    parts.forEach((part) => part.destroy());
  }

  private addTab(tab: Rect): GameObjects.GameObject {
    if (this.scene.textures.exists(TAB_KEY)) {
      return this.scene.add.image(tab.x, tab.y, TAB_KEY).setOrigin(0);
    }
    const g = this.scene.add.graphics();
    drawFramedRect(g, { border: PALETTE.ink, fill: PALETTE.cyan }, tab);
    return g;
  }

  // The owner's face in mood, else neutral, else their name's first letter.
  private addFace(dog: DogId, mood: string, tab: Rect): GameObjects.GameObject {
    const x = tab.x + OWNER_TAB.face;
    const y = tab.y + OWNER_TAB.face;
    const key = ownerFaceKey(gameData, dog);
    if (this.scene.textures.exists(key)) {
      const face = this.scene.add.sprite(x, y, key).setOrigin(0);
      playFirstTag(face, key, [mood, "neutral"]);
      return face;
    }
    return addPixelText(this.scene, x, y, gameData.dogs[dog].owner.name.slice(0, 1), {
      colour: PALETTE.ink,
    });
  }
}
