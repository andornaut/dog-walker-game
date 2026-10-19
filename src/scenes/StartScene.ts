import { type GameObjects, type Input, Scene } from "phaser";

import { itemAt } from "../arrays";
import { dogFaceKey, dogSpriteKey, gearIconKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import type { DogId, GearId, Size, Temperament, TraitId } from "../data/types";
import {
  dogSlotPrice,
  type HomeLoadout,
  type HomeProfile,
  nextDogSlot,
  packCapacity,
  packFeePerZone,
  packOf,
  type Purchase,
  tapDog,
  tapGear,
} from "../home/home";
import { wholeDollars } from "../hud/hudView";
import { isConfirmKey } from "../input/keyBindings";
import { gridRects, rectIndexAt } from "../layout/grid";
import { COLLAR_HEIGHT, leashHand, type PackPlacement } from "../layout/packFormation";
import { containsPoint, type Rect } from "../layout/rect";
import { effectText, formatDollars } from "../rules/effectText";
import { cents, dollarsToCents, read } from "../rules/units";
import { drawPixelLine, drawShadow, fillRect } from "./draw";
import { openHelp } from "./helpScreen";
import { PALETTE } from "./palette";
import { addPixelText, type FontRole } from "./pixelText";
import { homeProfile, lastLoadout, setLastLoadout } from "./profileStore";
import type { RunSceneData } from "./RunScene";
import { SCENE_KEYS } from "./sceneKeys";
import { addStandingSprite, playTag, spriteMetrics } from "./sprites";

const SCREEN = { height: 640, width: 360 };
const GATE = { height: 156, y: 40 };
const PATH = { width: 32, x: 164 };
const WALKER_AT_GATE = { footY: 196, x: 180 };
// At the gate the pack spreads out around the walker, the first dog through the gate.
const GATE_SPOTS: readonly PackPlacement[] = [
  { dx: 0, footDy: -46 },
  { dx: -26, footDy: -14 },
  { dx: 26, footDy: -12 },
];
const DOG_TILES = { cellHeight: 50, cellWidth: 112, columns: 3, gapX: 4, gapY: 4 };
const GEAR_SLOTS = { cellHeight: 58, cellWidth: 64, columns: 5, gapX: 6, gapY: 0 };
const START_BUTTON: Rect = { height: 40, width: 344, x: 8, y: 540 };
const HELP_BUTTON: Rect = { height: 14, width: 14, x: 8, y: 46 };
const SLOT_BUTTON: Rect = { height: 11, width: 112, x: 124, y: 199 };
const GEAR_BADGE: Rect = { height: 18, width: 18, x: 194, y: 166 };
const SIZE_ORDER: readonly Size[] = ["small", "medium", "big"];
const TRAIT_ORDER: readonly TraitId[] = ["fancy", "foodDriven", "chaser"];
const TRAIT_LABELS: Readonly<Record<TraitId, { color: number; label: string }>> = {
  chaser: { color: PALETTE.blue, label: "CHASER" },
  fancy: { color: PALETTE.mauve, label: "FANCY" },
  foodDriven: { color: PALETTE.orange, label: "FOOD" },
};
const TEMPERAMENT_LABELS: Readonly<Record<Temperament, string>> = {
  dramatic: "DRAMATIC",
  fussy: "FUSSY",
  laidBack: "LAID-BACK",
};

type Target =
  | { dog: DogId; kind: "dog" }
  | { gear: GearId; kind: "gear" }
  | { kind: "help" }
  | { kind: "slot"; slot: number }
  | { kind: "start" };

// The roster in rows by size, each row in trait order, as the mock lays it out.
function rosterOrder(): DogId[] {
  const rank = (dog: DogId) => {
    const { size, trait } = gameData.dogs[dog];
    return SIZE_ORDER.indexOf(size) * TRAIT_ORDER.length + TRAIT_ORDER.indexOf(trait);
  };
  return (Object.keys(gameData.dogs) as DogId[]).sort((a, b) => rank(a) - rank(b));
}

// The screen before a walk: bank and best walk, the walker and pack at the gate, the dog
// picker, gear, logbook and Start walk. Tapping a locked dog or gear item asks to buy it;
// buying waits for saves, so the screen says so.
export class StartScene extends Scene {
  private drawn: GameObjects.GameObject[] = [];
  private loadout: HomeLoadout = { dogs: [], gear: null };
  private notice = "";
  private pressed: Target | undefined;

  constructor() {
    super(SCENE_KEYS.start);
  }

  create(): void {
    this.drawn = [];
    this.notice = "";
    const profile = homeProfile(this);
    const remembered = lastLoadout(this);
    this.loadout = {
      dogs: remembered.dogs
        .filter((dog) => profile.ownedDogs.includes(dog))
        .slice(0, packCapacity(gameData, profile)),
      gear:
        remembered.gear !== null && profile.ownedGear.includes(remembered.gear)
          ? remembered.gear
          : null,
    };
    this.drawGate();
    this.render();

    this.input.on("pointerdown", (pointer: Input.Pointer) => {
      this.pressed = this.targetAt(pointer.x, pointer.y);
    });
    this.input.on("pointerup", (pointer: Input.Pointer) => {
      const target = this.targetAt(pointer.x, pointer.y);
      if (target !== undefined && JSON.stringify(target) === JSON.stringify(this.pressed)) {
        this.act(target);
      }
      this.pressed = undefined;
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (isConfirmKey(event.key)) {
        this.act({ kind: "start" });
      }
    });
    // A new player's first walk will open help here once, when saves can tell a first walk.
  }

  private dogTiles(): Rect[] {
    return gridRects(DOG_TILES, rosterOrder().length, { x: 8, y: 212 });
  }

  private gearSlots(): Rect[] {
    return gridRects(GEAR_SLOTS, Object.keys(gameData.shopGear).length, { x: 8, y: 388 });
  }

  private targetAt(x: number, y: number): Target | undefined {
    const tile = rectIndexAt(this.dogTiles(), x, y);
    if (tile !== undefined) {
      return { dog: itemAt(rosterOrder(), tile), kind: "dog" };
    }
    const slot = rectIndexAt(this.gearSlots(), x, y);
    if (slot !== undefined) {
      return { gear: itemAt(Object.keys(gameData.shopGear) as GearId[], slot), kind: "gear" };
    }
    if (containsPoint(START_BUTTON, x, y)) {
      return { kind: "start" };
    }
    const nextSlot = nextDogSlot(gameData, homeProfile(this));
    if (nextSlot !== undefined && containsPoint(SLOT_BUTTON, x, y)) {
      return { kind: "slot", slot: nextSlot };
    }
    return containsPoint(HELP_BUTTON, x, y) ? { kind: "help" } : undefined;
  }

  private act(target: Target): void {
    const profile = homeProfile(this);
    switch (target.kind) {
      case "dog":
      case "gear": {
        const tap =
          target.kind === "dog"
            ? tapDog(gameData, profile, target.dog, this.loadout)
            : tapGear(profile, target.gear, this.loadout);
        if (tap.kind === "buy") {
          this.notice = this.purchaseNotice(tap.purchase);
        } else {
          this.loadout = tap.loadout;
          this.notice = "";
        }
        this.render();
        return;
      }
      case "help":
        openHelp(this, SCENE_KEYS.start);
        return;
      case "slot":
        this.notice = this.purchaseNotice({ kind: "dogSlot", slot: target.slot });
        this.render();
        return;
      case "start": {
        const dogs = packOf(this.loadout);
        if (dogs === undefined) {
          return;
        }
        setLastLoadout(this, this.loadout);
        const data: RunSceneData = { loadout: { dogs, gear: this.loadout.gear } };
        this.scene.start(SCENE_KEYS.run, data);
        return;
      }
      default:
        target satisfies never;
    }
  }

  // Buying needs saves to keep what was bought, so until then the tap names the price.
  private purchaseNotice(purchase: Purchase): string {
    const { prices } = gameData.tuning.money;
    switch (purchase.kind) {
      case "dog": {
        const price = formatDollars(dollarsToCents(prices.lockedDog));
        return `${gameData.dogs[purchase.dog].name} costs ${price}. The shop opens soon.`;
      }
      case "dogSlot": {
        const price = dogSlotPrice(gameData, purchase.slot) ?? cents(0);
        return `Dog slot ${purchase.slot} costs ${formatDollars(price)}. The shop opens soon.`;
      }
      default: {
        const gear = gameData.shopGear[purchase.gear];
        const price = formatDollars(dollarsToCents(prices[gear.price]));
        return `${gear.name} costs ${price}. The shop opens soon.`;
      }
    }
  }

  private text(
    x: number,
    y: number,
    value: string,
    color: number,
    options: { font?: FontRole; originX?: number; scale?: number } = {},
  ): GameObjects.BitmapText {
    const label = addPixelText(this, x, y, value, { color, ...options });
    this.drawn.push(label);
    return label;
  }

  private textCentered(
    x: number,
    y: number,
    value: string,
    color: number,
    options: { font?: FontRole; scale?: number } = {},
  ): GameObjects.BitmapText {
    return this.text(x, y, value, color, { ...options, originX: 0.5 });
  }

  // The street, fence and yard at the gate never change, so they are drawn once.
  private drawGate(): void {
    const g = this.add.graphics();
    const fill = (x: number, y: number, width: number, height: number, color: number) =>
      fillRect(g, color, { height, width, x, y });
    fill(0, GATE.y, SCREEN.width, 52, PALETTE.darkSlate);
    for (const x of [55, 111, 167, 223, 335]) {
      fill(x, 48, 2, 12, PALETTE.lightGrey);
      fill(x, 80, 2, 12, PALETTE.lightGrey);
    }
    fill(0, 92, SCREEN.width, 4, PALETTE.grey);
    fill(0, 92, SCREEN.width, 1, PALETTE.lightGrey);
    fill(0, 96, SCREEN.width, 30, PALETTE.lightGrey);
    for (let x = 0; x < SCREEN.width; x += 24) {
      fill(x, 96, 1, 30, PALETTE.grey);
    }
    fill(326, 62, 2, 54, PALETTE.slate);
    fill(300, 56, 54, 11, PALETTE.darkGreen);
    fill(301, 57, 52, 9, PALETTE.green);
    fill(0, 126, SCREEN.width, 70, PALETTE.green);
    for (let i = 0; i < 40; i++) {
      fill((i * 53) % SCREEN.width, 132 + ((i * 29) % 60), 1, 2, PALETTE.darkGreen);
    }
    fill(PATH.x, 126, PATH.width, 70, PALETTE.tan);
    for (let y = 130; y < GATE.y + GATE.height; y += 8) {
      fill(PATH.x, y, PATH.width, 1, PALETTE.brown);
      fill(PATH.x + 16, y + 4, 1, 4, PALETTE.brown);
    }
    for (let x = 2; x < SCREEN.width; x += 6) {
      if (x > 158 && x < 200) {
        continue;
      }
      fill(x, 124, 4, 14, PALETTE.white);
      fill(x + 3, 125, 1, 13, PALETTE.lightGrey);
      fill(x + 1, 123, 2, 1, PALETTE.white);
    }
    fill(0, 128, 160, 2, PALETTE.lightGrey);
    fill(200, 128, 160, 2, PALETTE.lightGrey);
    fill(156, 120, 4, 20, PALETTE.lightGrey);
    fill(200, 120, 4, 20, PALETTE.lightGrey);
    fill(16, 172, 3, 22, PALETTE.darkBrown);
    fill(120, 172, 3, 22, PALETTE.darkBrown);
    fill(6, 146, 128, 30, PALETTE.plum);
    fill(8, 148, 124, 26, PALETTE.tan);
    fill(8, 172, 124, 2, PALETTE.brown);
    fill(296, 158, 3, 34, PALETTE.darkBrown);
    fill(286, 148, 24, 12, PALETTE.red);
    fill(286, 158, 24, 2, PALETTE.darkRed);
    fill(308, 142, 2, 8, PALETTE.amber);
    addPixelText(this, 327, 59, "Maple St", { color: PALETTE.white, originX: 0.5 });
    addPixelText(this, 70, 152, "Dog walker", {
      color: PALETTE.plum,
      font: "title",
      originX: 0.5,
      scale: 2,
    });
    addPixelText(this, 70, 165, "Walks daily", { color: PALETTE.darkBrown, originX: 0.5 });
  }

  private render(): void {
    for (const object of this.drawn) {
      object.destroy();
    }
    this.drawn = [];
    const profile = homeProfile(this);
    const g = this.add.graphics();
    this.drawn.push(g);
    this.drawTopBar(g, profile);
    this.drawPackAtGate(g);
    this.drawDogTiles(g, profile);
    this.drawGear(g, profile);
    this.drawLogbook(g, profile);
    this.drawStartButton(g);
  }

  private drawTopBar(g: GameObjects.Graphics, profile: HomeProfile): void {
    fillRect(g, PALETTE.plum, { height: 40, width: SCREEN.width, x: 0, y: 0 });
    fillRect(g, PALETTE.darkBrown, { height: 2, width: SCREEN.width, x: 0, y: 38 });
    this.drawn.push(this.add.sprite(8, 13, "tip").setOrigin(0));
    const dollar = this.text(26, 15, "$", PALETTE.amber, { font: "title", scale: 2 });
    this.text(26 + dollar.width + 2, 15, wholeDollars(profile.bank).slice(1), PALETTE.cream, {
      font: "title",
      scale: 2,
    });
    const log = profile.logbook;
    const best = log === null ? "No walks yet" : `Best walk ${wholeDollars(log.bestWalk)}`;
    this.text(352, 11, best, PALETTE.cream, { originX: 1 });
    if (log !== null) {
      this.text(352, 22, `${log.walks} ${log.walks === 1 ? "walk" : "walks"}`, PALETTE.tan, {
        originX: 1,
      });
    }
  }

  private drawPackAtGate(g: GameObjects.Graphics): void {
    const { footY, x } = WALKER_AT_GATE;
    const placements = GATE_SPOTS.slice(0, this.loadout.dogs.length);
    const groundColor = (atX: number) =>
      atX >= PATH.x && atX < PATH.x + PATH.width ? PALETTE.brown : PALETTE.darkGreen;
    const dogs = this.loadout.dogs.map((dog, i) => {
      const { dx, footDy } = itemAt(placements, i);
      return { dog, dx, footY: footY + footDy, key: dogSpriteKey(dog) };
    });
    for (const { dx, footY: dogFoot, key } of dogs) {
      drawShadow(g, groundColor(x + dx), x + dx, dogFoot, spriteMetrics(key).opaqueWidth);
    }
    drawShadow(g, groundColor(x), x, footY, spriteMetrics("walker").opaqueWidth);
    for (const { dx, footY: dogFoot, key } of dogs) {
      const sprite = addStandingSprite(this, key, x + dx, dogFoot);
      playTag(sprite, key, "walk");
      this.drawn.push(sprite);
    }
    const walker = addStandingSprite(this, "walker", x, footY);
    playTag(walker, "walker", "walk");
    this.drawn.push(walker);

    const leash = this.add.graphics();
    this.drawn.push(leash);
    dogs.forEach(({ dx, footY: dogFoot }, i) => {
      const hand = leashHand(itemAt(placements, i));
      drawPixelLine(
        leash,
        PALETTE.darkRed,
        { x: x + hand.dx, y: footY + hand.dy },
        { x: x + dx, y: dogFoot - COLLAR_HEIGHT },
      );
    });

    const lines =
      this.loadout.dogs.length === 0
        ? ["Morning! Who are we", "walking today?"]
        : ["Ready when you are."];
    const top = 46;
    const labels = lines.map((line, i) =>
      this.textCentered(x, top + 4 + i * 8, line, PALETTE.plum),
    );
    const width = Math.ceil(Math.max(...labels.map((label) => label.width))) + 10;
    const height = lines.length * 8 + 6;
    const left = Math.round(x - width / 2);
    fillRect(g, PALETTE.white, { height, width: width - 2, x: left + 1, y: top });
    fillRect(g, PALETTE.white, { height: height - 2, width, x: left, y: top + 1 });
    fillRect(g, PALETTE.lightGrey, { height: 1, width: width - 2, x: left + 1, y: top + height });
    fillRect(g, PALETTE.white, { height: 2, width: 6, x: x - 4, y: top + height });

    // Equipped gear shows as a badge beside the walker.
    if (this.loadout.gear !== null) {
      fillRect(g, PALETTE.plum, GEAR_BADGE);
      this.addGearIcon(this.loadout.gear, GEAR_BADGE.x + 1, GEAR_BADGE.y + 1, 0.5);
    }

    fillRect(g, PALETTE.plum, HELP_BUTTON);
    this.textCentered(HELP_BUTTON.x + 7, HELP_BUTTON.y + 5, "?", PALETTE.cream, { font: "title" });
  }

  private drawDogTiles(g: GameObjects.Graphics, profile: HomeProfile): void {
    const capacity = packCapacity(gameData, profile);
    this.text(8, 202, "Your pack", PALETTE.cream, { font: "title" });
    this.text(352, 202, `${this.loadout.dogs.length}/${capacity} dogs`, PALETTE.tan, {
      originX: 1,
    });
    const nextSlot = nextDogSlot(gameData, profile);
    const slotPrice = nextSlot === undefined ? undefined : dogSlotPrice(gameData, nextSlot);
    if (nextSlot !== undefined && slotPrice !== undefined) {
      const affordable = profile.bank >= slotPrice;
      fillRect(g, affordable ? PALETTE.darkGreen : PALETTE.darkRed, SLOT_BUTTON);
      this.textCentered(
        SLOT_BUTTON.x + SLOT_BUTTON.width / 2,
        SLOT_BUTTON.y + 3,
        `+ Slot ${nextSlot}: ${wholeDollars(slotPrice)}`,
        PALETTE.white,
      );
    }
    const price = dollarsToCents(gameData.tuning.money.prices.lockedDog);
    const tiles = this.dogTiles();
    rosterOrder().forEach((id, i) => {
      const { height, width, x, y } = itemAt(tiles, i);
      const dog = gameData.dogs[id];
      const owned = profile.ownedDogs.includes(id);
      const picked = this.loadout.dogs.indexOf(id);
      fillRect(g, picked >= 0 ? PALETTE.amber : PALETTE.plum, { height, width, x, y });
      fillRect(g, owned ? PALETTE.cream : PALETTE.tan, {
        height: height - 2,
        width: width - 2,
        x: x + 1,
        y: y + 1,
      });
      fillRect(g, owned ? PALETTE.tan : PALETTE.brown, {
        height: 34,
        width: 34,
        x: x + 3,
        y: y + 8,
      });
      const face = this.add.sprite(x + 4, y + 9, dogFaceKey(id)).setOrigin(0);
      playTag(face, dogFaceKey(id), owned ? "happy" : "neutral");
      this.drawn.push(face);

      this.text(x + 41, y + 5, dog.name, PALETTE.plum);
      if (owned) {
        const fee = wholeDollars(packFeePerZone(gameData, { dogs: [id], gear: null }));
        this.text(x + width - 4, y + 5, fee, PALETTE.darkBrown, { font: "title", originX: 1 });
      } else {
        const color = profile.bank >= price ? PALETTE.darkGreen : PALETTE.darkRed;
        this.text(x + width - 4, y + 5, wholeDollars(price), color, {
          font: "title",
          originX: 1,
        });
      }
      const size = this.text(x + 43, y + 15, dog.size, PALETTE.cream);
      const sizeWidth = Math.ceil(size.width) + 4;
      fillRect(g, PALETTE.darkBrown, { height: 9, width: sizeWidth, x: x + 41, y: y + 13 });
      const trait = TRAIT_LABELS[dog.trait];
      const traitLabel = this.text(x + 45 + sizeWidth, y + 15, trait.label, PALETTE.white);
      fillRect(g, trait.color, {
        height: 9,
        width: Math.ceil(traitLabel.width) + 4,
        x: x + 43 + sizeWidth,
        y: y + 13,
      });
      this.text(x + 41, y + 27, dog.owner.name, PALETTE.darkBrown);
      const status = owned ? TEMPERAMENT_LABELS[dog.owner.temperament] : "Tap to buy";
      this.text(x + 41, y + 36, status, owned ? PALETTE.brown : PALETTE.darkBrown);
      if (picked >= 0) {
        fillRect(g, PALETTE.amber, {
          height: 10,
          width: 10,
          x: x + width - 12,
          y: y + height - 12,
        });
        this.textCentered(x + width - 7, y + height - 10, String(picked + 1), PALETTE.plum, {
          font: "title",
        });
      }
    });
  }

  private drawGear(g: GameObjects.Graphics, profile: HomeProfile): void {
    const max = read(gameData.tuning, "counts", "loadoutMax");
    this.text(8, 378, "Gear", PALETTE.cream, { font: "title" });
    this.text(352, 378, `Equip up to ${max}`, PALETTE.tan, { originX: 1 });
    const slots = this.gearSlots();
    (Object.keys(gameData.shopGear) as GearId[]).forEach((id, i) => {
      const { height, width, x, y } = itemAt(slots, i);
      const gear = gameData.shopGear[id];
      const owned = profile.ownedGear.includes(id);
      const equipped = this.loadout.gear === id;
      fillRect(g, equipped ? PALETTE.amber : PALETTE.plum, { height, width, x, y });
      fillRect(g, owned ? PALETTE.cream : PALETTE.tan, {
        height: height - 2,
        width: width - 2,
        x: x + 1,
        y: y + 1,
      });
      fillRect(g, owned ? PALETTE.tan : PALETTE.brown, {
        height: 34,
        width: 34,
        x: x + 15,
        y: y + 4,
      });
      this.addGearIcon(id, x + 16, y + 5, 1);
      gear.name.split(" ").forEach((word, line) => {
        this.textCentered(x + width / 2, y + 40 + line * 7, word, PALETTE.plum);
      });
      if (!owned) {
        const price = dollarsToCents(gameData.tuning.money.prices[gear.price]);
        const color = profile.bank >= price ? PALETTE.darkGreen : PALETTE.darkRed;
        const label = this.text(x + 4, y + 4, wholeDollars(price), PALETTE.white);
        fillRect(g, color, { height: 9, width: Math.ceil(label.width) + 4, x: x + 2, y: y + 2 });
      }
    });
    const equipped = this.loadout.gear;
    const line =
      equipped === null
        ? "No gear equipped"
        : `${gameData.shopGear[equipped].name}: ${effectText(gameData, gameData.shopGear[equipped].effects)}`;
    this.textCentered(180, 451, line, equipped === null ? PALETTE.tan : PALETTE.amber);
  }

  // The item's 32x32 icon, or its initials until the icon is in the manifest.
  private addGearIcon(gear: GearId, x: number, y: number, scale: number): void {
    const key = gearIconKey(gear);
    if (this.textures.exists(key)) {
      this.drawn.push(this.add.image(x, y, key).setOrigin(0).setScale(scale));
      return;
    }
    const initials = gameData.shopGear[gear].name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("");
    this.textCentered(x + 16 * scale, y + 11 * scale, initials, PALETTE.cream, { font: "title" });
  }

  private drawLogbook(g: GameObjects.Graphics, profile: HomeProfile): void {
    const top = 462;
    fillRect(g, PALETTE.plum, { height: 70, width: 344, x: 8, y: top });
    fillRect(g, PALETTE.cream, { height: 68, width: 342, x: 9, y: top + 1 });
    fillRect(g, PALETTE.tan, { height: 11, width: 342, x: 9, y: top + 1 });
    this.text(14, top + 4, "Logbook", PALETTE.plum, { font: "title" });
    this.text(346, top + 4, "Stats", PALETTE.brown, { originX: 1 });
    for (let lineY = top + 22; lineY < top + 68; lineY += 11) {
      fillRect(g, PALETTE.tan, { height: 1, width: 336, x: 12, y: lineY + 7 });
    }
    const log = profile.logbook;
    if (log === null) {
      this.text(14, top + 19, "No walks yet.", PALETTE.plum);
      this.text(14, top + 30, "Three clients are waiting on the porch.", PALETTE.darkBrown);
      return;
    }
    const dogs = log.bestWalkDogs.map((dog) => gameData.dogs[dog].name).join(" and ");
    this.text(14, top + 19, "Best walk", PALETTE.plum);
    const best = this.text(64, top + 19, wholeDollars(log.bestWalk), PALETTE.darkGreen, {
      font: "title",
    });
    this.text(
      Math.max(90, 64 + Math.ceil(best.width) + 6),
      top + 19,
      `${log.bestWalkZones} zones with ${dogs}`,
      PALETTE.darkBrown,
    );
    this.text(
      14,
      top + 30,
      `Walks ${log.walks}    Dogs walked ${log.dogsWalked}    Times fired ${log.timesFired}`,
      PALETTE.plum,
    );
    this.text(14, top + 41, log.lastWalk, PALETTE.darkBrown);
  }

  private drawStartButton(g: GameObjects.Graphics): void {
    const { height, width, x, y } = START_BUTTON;
    const ready = this.loadout.dogs.length > 0;
    fillRect(g, ready ? PALETTE.orange : PALETTE.darkSlate, {
      height: height - 4,
      width,
      x,
      y: y + 4,
    });
    fillRect(g, ready ? PALETTE.amber : PALETTE.slate, { height: height - 4, width, x, y });
    this.textCentered(
      180,
      y + 11,
      ready ? "Start walk" : "Pick a dog",
      ready ? PALETTE.plum : PALETTE.lightGrey,
      { font: "title", scale: 3 },
    );
    const zones = gameData.world.zones.length;
    const fee = formatDollars(packFeePerZone(gameData, this.loadout));
    this.textCentered(
      180,
      588,
      ready
        ? `Pack fee ${fee} per zone. ${zones} zones on ${gameData.world.name}`
        : `Pick 1 to ${packCapacity(gameData, homeProfile(this))} dogs`,
      PALETTE.cream,
    );
    this.textCentered(
      180,
      600,
      this.notice === "" ? "Tap a locked dog or gear to buy it" : this.notice,
      this.notice === "" ? PALETTE.tan : PALETTE.amber,
    );
  }
}
