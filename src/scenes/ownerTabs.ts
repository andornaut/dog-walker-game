import type { GameObjects, Scene } from "phaser";

import { ownerFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";
import {
  OWNER_TAB,
  ownerTabRect,
  QUIP_STYLES,
  quipOverLaneBlocked,
  type QuipPlace,
  quipPlace,
  quipRoom,
  quipSide,
} from "../hud/walkHud";
import { type Rect, rectsOverlap } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { drawFramedRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText, fitPixelText, pixelFontMetrics, placePixelText } from "./pixelText";
import { firstTag, playTag } from "./sprites";
import { addNineSlice, addPanel, BUBBLE_FADE_MS, fadeAway } from "./uiKit";

const LAYOUT = screenLayout(SCREEN_CONFIG);
// Over the cards and their heart-loss flash, under the HUD's moments (depth 50 on), its
// parts stacked from here.
const DEPTH = 30;
const POP_MS = 120;
const TAB_KEY = "ui-owner-tab";
const TAIL_KEY = "ui-quip-tail";
const TAIL_DOWN_KEY = "ui-quip-tail-down";
const PLATE_KEY = "ui-quip-name";

type Depthed = GameObjects.GameObject & GameObjects.Components.Depth;

// One card's owner as shown, and what runs once they have gone.
// overLane: what a quip reaching above the owners' lane covers, else nothing.
interface Shown {
  overLane: Rect[];
  done: () => void;
  parts: GameObjects.GameObject[];
}

// A quip's text and speaker's name, measured, and where they go.
interface LaidQuip {
  name: GameObjects.BitmapText;
  place: QuipPlace;
  text: GameObjects.BitmapText;
}

// clearOf: what the HUD's moments cover over the owners' lane, which a quip reaching above
// the lane must not lie under. packX: the pack's centre across the screen, which a quip
// leans away from. still: reduced motion, which shows a tab without popping it in.
interface OwnerTabHooks {
  clearOf: () => readonly Rect[];
  packX: () => number;
  still: () => boolean;
}

// The owners' photo tabs on the dog cards (walkHud.ts OWNER_TAB): when something happens to
// their dog, an owner pops in centred on its card's top edge, in the mood it calls for, with
// their quip and name by them when they have one, then fades. A card shows one owner at a time,
// the newest.
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
  // with no card, or a quip that would reach above the owners' lane under what hooks.clearOf
  // covers.
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
    const tab = ownerTabRect(card);
    const laid = quip === undefined ? undefined : this.layQuip(at.slot, at.dog, tab, quip);
    if (laid !== undefined && quipOverLaneBlocked(this.hooks.clearOf(), laid.place)) {
      laid.text.destroy();
      laid.name.destroy();
      return false;
    }
    this.clear(at.slot);
    const parts = [this.addTab(tab), this.addFace(at.dog, at.mood, tab)];
    if (laid !== undefined) {
      parts.push(...this.addQuip(laid));
    }
    // Each part over the one before: the tab, the face, then the bubble, its tail, its text,
    // the name plate and the name.
    parts.forEach((part, i) => (part as Depthed).setDepth(DEPTH + i));
    const overLane = laid?.place.overLane === true ? laid.place.covers : [];
    const shown = { done, overLane, parts };
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

  // What the quips reaching above the owners' lane cover, which the HUD's other layers keep
  // clear of.
  overLaneCovers(): Rect[] {
    return [...this.shown.values()].flatMap((shown) => shown.overLane);
  }

  // Takes away every owner whose quip above the owners' lane lies under any of covers, such as a
  // moment that has just opened over it.
  clearUnder(covers: readonly Rect[]): void {
    for (const [slot, shown] of [...this.shown]) {
      if (shown.overLane.some((part) => covers.some((cover) => rectsOverlap(part, cover)))) {
        this.clear(slot);
      }
    }
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

  // The quip's text and the speaker's name, placed by the tab (quipPlace). A quip too wide for
  // one line anywhere wraps onto a second.
  private layQuip(slot: number, dog: DogId, tab: Rect, quip: string): LaidQuip {
    const text = addPixelText(this.scene, 0, 0, quip, { color: PALETTE.plum });
    const name = addPixelText(this.scene, 0, 0, gameData.dogs[dog].owner.name, {
      color: PALETTE.cream,
    });
    // The bubble holds the label's width, which counts the last glyph's trailing pixel.
    const room = quipRoom(LAYOUT.walkView) - 1;
    const { lines } = fitPixelText(text, { room, styles: QUIP_STYLES }, 0, 0);
    const { lineHeight } = pixelFontMetrics(this.scene, "body");
    const prefers = quipSide(LAYOUT.walkView, LAYOUT.dogSlots.length, this.hooks.packX(), slot);
    const place = quipPlace(LAYOUT.walkView, prefers, tab, {
      lineHeight,
      lines: lines.length,
      name: Math.ceil(name.width),
      width: Math.ceil(text.width),
    });
    placePixelText(text, place.text.x, place.text.y);
    placePixelText(name, place.name.x, place.name.y);
    return { name, place, text };
  }

  // The quip in its bubble, its tail toward the tab, and the speaker's name on a plate over the
  // bubble's corner nearest the tab.
  private addQuip({ name, place, text }: LaidQuip): GameObjects.GameObject[] {
    const parts: GameObjects.GameObject[] = [addPanel(this.scene, place.bubble, "ui-quip")];
    const tailKey = place.side === "above" ? TAIL_DOWN_KEY : TAIL_KEY;
    if (this.scene.textures.exists(tailKey)) {
      const tail = this.scene.add.image(place.tail.x, place.tail.y, tailKey).setOrigin(0);
      parts.push(tail.setFlipX(place.side === "left"));
    }
    parts.push(text, this.addPlate(place.plate), name);
    return parts;
  }

  // ui-quip-name, or a framed plum box while the art is missing.
  private addPlate(rect: Rect): GameObjects.GameObject {
    const plate = addNineSlice(this.scene, PLATE_KEY, rect);
    if (plate !== undefined) {
      return plate;
    }
    const g = this.scene.add.graphics();
    drawFramedRect(g, { border: PALETTE.ink, fill: PALETTE.plum }, rect);
    return g;
  }
}
