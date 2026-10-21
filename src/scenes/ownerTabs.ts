import type { GameObjects, Scene } from "phaser";

import { ownerFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";
import { OWNER_TAB, ownerTabRect, quipPlace } from "../hud/walkHud";
import type { Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { drawFramedRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText, placePixelText } from "./pixelText";
import { firstTag, playTag } from "./sprites";
import { addPanel, BUBBLE_FADE_MS, fadeAway } from "./uiKit";

const LAYOUT = screenLayout(SCREEN_CONFIG);
// Over the cards and their heart-loss flash, under the HUD's moments (depth 50 on), its
// parts stacked from here.
const DEPTH = 30;
const POP_MS = 120;
const TAB_KEY = "ui-owner-tab";
const TAIL_KEY = "ui-quip-tail";

type Depthed = GameObjects.GameObject & GameObjects.Components.Depth;

// One card's owner as shown, and what runs once they have gone.
interface Shown {
  done: () => void;
  parts: GameObjects.GameObject[];
}

// packX: the pack's centre across the screen, which a quip leans away from. still: reduced
// motion, which shows a tab without popping it in.
export interface OwnerTabHooks {
  packX: () => number;
  still: () => boolean;
}

// The owners' photo tabs on the dog cards (walkHud.ts OWNER_TAB): when something happens to
// their dog, an owner pops in on its card's top-right corner, in the mood it calls for, with
// their quip beside them when they have one, then fades. A card shows one owner at a time, the
// newest.
export class OwnerTabs {
  private readonly hooks: OwnerTabHooks;
  private readonly scene: Scene;
  private readonly shown = new Map<number, Shown>();

  constructor(scene: Scene, hooks: OwnerTabHooks) {
    this.scene = scene;
    this.hooks = hooks;
  }

  // The owner of the dog on the card at slot, for holdMs, then fading; done runs once they have
  // gone, or a newer pop on the card has taken their place. False, showing nothing, for a slot
  // with no card.
  pop(
    at: { dog: DogId; mood: string; slot: number },
    holdMs: number,
    quip?: string,
    done: () => void = () => undefined,
  ): boolean {
    const card = LAYOUT.dogSlots[at.slot];
    if (card === undefined) {
      return false;
    }
    this.clear(at.slot);
    const tab = ownerTabRect(card);
    const parts = [this.addTab(tab), this.addFace(at.dog, at.mood, tab)];
    if (quip !== undefined) {
      parts.push(...this.addQuip(tab, quip));
    }
    // Each part over the one before: the tab, the face, then the bubble, its tail and its text.
    parts.forEach((part, i) => (part as Depthed).setDepth(DEPTH + i));
    const shown = { done, parts };
    this.shown.set(at.slot, shown);
    if (!this.hooks.still()) {
      this.scene.tweens.add({ alpha: { from: 0, to: 1 }, duration: POP_MS, targets: parts });
    }
    fadeAway(this.scene, parts, { delayMs: holdMs, ms: BUBBLE_FADE_MS, rise: 0 }, () => {
      if (this.shown.get(at.slot) === shown) {
        this.shown.delete(at.slot);
        done();
      }
    });
    return true;
  }

  private clear(slot: number): void {
    const shown = this.shown.get(slot);
    if (shown === undefined) {
      return;
    }
    this.shown.delete(slot);
    this.scene.tweens.killTweensOf(shown.parts);
    shown.parts.forEach((part) => part.destroy());
    // After the pop that replaced it, which its done may follow with another.
    this.scene.time.delayedCall(0, shown.done);
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
      const tag = firstTag(this.scene, key, [mood, "neutral"]);
      if (tag !== undefined) {
        playTag(face, key, tag);
      }
      return face;
    }
    return addPixelText(this.scene, x, y, gameData.dogs[dog].owner.name.slice(0, 1), {
      color: PALETTE.ink,
    });
  }

  // The quip in its bubble beside the tab, leaning away from the pack, its tail toward the tab.
  private addQuip(tab: Rect, quip: string): GameObjects.GameObject[] {
    const text = addPixelText(this.scene, 0, 0, quip, { color: PALETTE.plum });
    const place = quipPlace(LAYOUT.walkView, this.hooks.packX(), tab, Math.ceil(text.width));
    placePixelText(text, place.textX, place.textY);
    const parts: GameObjects.GameObject[] = [addPanel(this.scene, place.bubble, "ui-quip")];
    if (this.scene.textures.exists(TAIL_KEY)) {
      const tail = this.scene.add.image(place.tail.x, place.tail.y, TAIL_KEY).setOrigin(0);
      parts.push(tail.setFlipX(place.side === "left"));
    }
    parts.push(text);
    return parts;
  }
}
