import { type GameObjects, Scene } from "phaser";

import { dogFaceKey, ownerFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DogId, TraitId } from "../data/types";
import { type ChangeLabel, heartRows, wholeDollars, zonePips } from "../hud/hudView";
import type { Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { maxHearts, zoneFee } from "../rules/dogs";
import { faceMood } from "../rules/treats";
import { read } from "../rules/units";
import type { PackSlot, RunState } from "../state/runState";
import { drawDashedRect, drawFramedRect, drawHeart, fillRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText, placePixelText, setPixelText } from "./pixelText";
import { CHANGE_LABELS_EVENT, type RunHudView, type RunScene } from "./RunScene";
import { SCENE_KEYS } from "./sceneKeys";
import { playTag } from "./sprites";

const HEARTS_PER_ROW = 8;
const HEART_PITCH = 8;
const PIP = { gap: 3, height: 6, width: 18, x: 271, y: 22 };
const PAUSE_BUTTON: Rect = { height: 20, width: 20, x: 170, y: 10 };
const LABEL_RISE = 18;
const LABEL_MS = 1100;
const TRAIT_LABELS: Readonly<Record<TraitId, string>> = {
  chaser: "Chaser",
  fancy: "Fancy",
  foodDriven: "Food",
};
const TRAIT_COLORS: Readonly<Record<TraitId, number>> = {
  chaser: PALETTE.blue,
  fancy: PALETTE.mauve,
  foodDriven: PALETTE.orange,
};

interface SlotView {
  dogFace: GameObjects.Sprite;
  fee: GameObjects.BitmapText;
  name: GameObjects.BitmapText;
  ownerFace: GameObjects.Sprite;
  status: GameObjects.BitmapText;
  trait: GameObjects.BitmapText;
}

// The top bar and dog column, drawn over the road for the whole walk and kept in view while
// cards are up. It reads the run from RunScene every frame and redraws what changed.
export class HudScene extends Scene {
  private dynamic: GameObjects.Graphics | undefined;
  private drawnState = "";
  private money: GameObjects.BitmapText | undefined;
  private slots: SlotView[] = [];
  private treats: GameObjects.BitmapText | undefined;
  private zoneLabel: GameObjects.BitmapText | undefined;

  constructor() {
    super(SCENE_KEYS.hud);
  }

  create(): void {
    const { dogColumn, dogSlots, topBar } = screenLayout(SCREEN_CONFIG);
    this.drawnState = "";
    const g = this.add.graphics();
    fillRect(g, PALETTE.plum, topBar);
    fillRect(g, PALETTE.darkBrown, { ...topBar, height: 2, y: topBar.y + topBar.height - 2 });
    fillRect(g, PALETTE.darkBrown, dogColumn);
    drawFramedRect(g, { border: PALETTE.darkBrown, fill: PALETTE.navy }, PAUSE_BUTTON);
    fillRect(g, PALETTE.cream, {
      height: 10,
      width: 3,
      x: PAUSE_BUTTON.x + 6,
      y: PAUSE_BUTTON.y + 5,
    });
    fillRect(g, PALETTE.cream, {
      height: 10,
      width: 3,
      x: PAUSE_BUTTON.x + 11,
      y: PAUSE_BUTTON.y + 5,
    });

    this.add.sprite(8, 13, "tip").setOrigin(0);
    const money = { font: "title", scale: 2 } as const;
    const dollar = addPixelText(this, 26, 15, "$", { color: PALETTE.amber, ...money });
    this.money = addPixelText(this, 26 + dollar.width + 2, 15, "0", {
      color: PALETTE.cream,
      ...money,
    });
    this.add.sprite(104, 13, "treat").setOrigin(0);
    this.treats = addPixelText(this, 122, 18, "0", { color: PALETTE.cream, font: "title" });
    this.zoneLabel = addPixelText(this, 352, 10, "", {
      color: PALETTE.cream,
      font: "title",
      originX: 1,
    });
    this.dynamic = this.add.graphics();

    this.slots = dogSlots.map(({ x, y }) => ({
      dogFace: this.add
        .sprite(x + 36, y + 4, "treat")
        .setOrigin(0)
        .setVisible(false),
      fee: addPixelText(this, x + 68, y + 42, "", {
        color: PALETTE.plum,
        font: "title",
        originX: 1,
      }),
      name: addPixelText(this, x + 4, y + 42, "", { color: PALETTE.plum }),
      ownerFace: this.add
        .sprite(x + 4, y + 4, "treat")
        .setOrigin(0)
        .setVisible(false),
      status: addPixelText(this, x + 36, y + 92, "", { color: PALETTE.plum }),
      trait: addPixelText(this, x + 6, y + 53, "", { color: PALETTE.white }),
    }));

    const run = this.scene.get(SCENE_KEYS.run) as RunScene;
    const onLabels = (labels: ChangeLabel[]) => this.floatLabels(labels);
    run.events.on(CHANGE_LABELS_EVENT, onLabels);
    this.events.once("shutdown", () => run.events.off(CHANGE_LABELS_EVENT, onLabels));
  }

  override update(): void {
    const view = (this.scene.get(SCENE_KEYS.run) as RunScene).hudView();
    if (view === undefined) {
      return;
    }
    const pips = zonePips(gameData.world.zones.length, view.run.zoneIndex, view.zoneFraction);
    const state = JSON.stringify({
      affected: view.affected,
      debuffs: view.run.debuffs,
      fills: pips.map(({ fill }) => Math.round(fill * PIP.width)),
      money: view.run.money,
      pack: view.run.pack,
      treats: view.run.treats,
    });
    if (state !== this.drawnState) {
      this.drawnState = state;
      this.redraw(view);
    }
  }

  private redraw(view: RunHudView): void {
    const g = this.dynamic;
    if (g === undefined) {
      return;
    }
    const { run } = view;
    g.clear();
    if (this.money !== undefined) {
      setPixelText(this.money, wholeDollars(run.money).slice(1));
    }
    if (this.treats !== undefined) {
      setPixelText(
        this.treats,
        `${run.treats}/${read(gameData.tuning, "counts", "treatCarryMax")}`,
      );
    }
    const zones = gameData.world.zones;
    const zone = zones[Math.min(run.zoneIndex, zones.length - 1)];
    if (this.zoneLabel !== undefined && zone !== undefined) {
      setPixelText(this.zoneLabel, `Zone ${run.zoneIndex + 1}: ${zone.name}`);
    }
    zonePips(zones.length, run.zoneIndex, view.zoneFraction).forEach(({ fill, state }, i) => {
      const x = PIP.x + i * (PIP.width + PIP.gap);
      fillRect(g, state === "done" ? PALETTE.green : PALETTE.brown, { ...PIP, x });
      if (state === "current") {
        fillRect(g, PALETTE.amber, { ...PIP, width: Math.round(fill * PIP.width), x });
      }
    });

    const { dogSlots } = screenLayout(SCREEN_CONFIG);
    dogSlots.forEach((rect, i) => {
      const slot = this.slots[i];
      if (slot !== undefined) {
        this.drawSlot(g, rect, slot, run, view.affected, run.pack[i]);
      }
    });
  }

  private drawSlot(
    g: GameObjects.Graphics,
    rect: Rect,
    view: SlotView,
    run: RunState,
    affected: readonly DogId[],
    slot: PackSlot | undefined,
  ): void {
    const { x, y } = rect;
    if (slot === undefined) {
      drawDashedRect(g, PALETTE.plum, rect);
      view.dogFace.setVisible(false);
      view.ownerFace.setVisible(false);
      [view.name, view.fee, view.trait].forEach((label) => setPixelText(label, ""));
      setPixelText(view.status.setTint(PALETTE.plum), "Empty");
      placePixelText(view.status, x + rect.width / 2 - view.status.width / 2, y + 92);
      return;
    }
    const dog = gameData.dogs[slot.dog];
    const ownerKey = ownerFaceKey(slot.dog);
    const dogKey = dogFaceKey(slot.dog);
    if (slot.status === "fired") {
      drawDashedRect(g, PALETTE.plum, rect);
      fillRect(g, PALETTE.tan, { height: 34, width: 34, x: x + 19, y: y + 3 });
      view.ownerFace.setPosition(x + 20, y + 4).setVisible(true);
      playTag(view.ownerFace.setTexture(ownerKey), ownerKey, "fired");
      view.dogFace.setVisible(false);
      setPixelText(view.name, dog.owner.name);
      setPixelText(view.fee, "");
      setPixelText(view.trait, "");
      setPixelText(view.status, "You're fired!");
      placePixelText(view.status.setTint(PALETTE.red), x + 4, y + 53);
      return;
    }

    const highlighted = affected.includes(slot.dog);
    fillRect(g, highlighted ? PALETTE.amber : PALETTE.plum, rect);
    const inset = highlighted ? 2 : 1;
    fillRect(g, PALETTE.cream, {
      height: rect.height - 2 * inset,
      width: rect.width - 2 * inset,
      x: x + inset,
      y: y + inset,
    });
    fillRect(g, PALETTE.tan, { height: 34, width: 66, x: x + 3, y: y + 3 });
    const mood = faceMood(gameData, slot.hearts);
    view.ownerFace.setPosition(x + 4, y + 4).setVisible(true);
    playTag(view.ownerFace.setTexture(ownerKey), ownerKey, mood);
    view.dogFace.setVisible(true);
    playTag(view.dogFace.setTexture(dogKey), dogKey, mood);

    setPixelText(view.name, dog.name);
    setPixelText(view.fee, wholeDollars(zoneFee(gameData.tuning, run.modifiers, dog)));
    setPixelText(view.trait, TRAIT_LABELS[dog.trait]);
    const traitWidth = Math.ceil(view.trait.width) + 4;
    fillRect(g, TRAIT_COLORS[dog.trait], { height: 9, width: traitWidth, x: x + 4, y: y + 51 });
    setPixelText(view.status, run.debuffs.includes("stinky") ? "Stinky" : "");
    placePixelText(view.status.setTint(PALETTE.darkGreen), x + 8 + traitWidth, y + 53);

    const max = maxHearts(gameData.tuning, run.modifiers, dog);
    heartRows(HEARTS_PER_ROW, slot.hearts, max).forEach((row, rowIndex) => {
      row.forEach((full, column) => {
        const heartX = x + 4 + column * HEART_PITCH;
        const heartY = y + 65 + rowIndex * HEART_PITCH;
        if (full) {
          drawHeart(g, heartX, heartY, PALETTE.red, PALETTE.pink);
        } else {
          drawHeart(g, heartX, heartY, PALETTE.tan);
        }
      });
    });
  }

  // Each change floats up from where it happened and fades out.
  private floatLabels(labels: ChangeLabel[]): void {
    const { dogSlots } = screenLayout(SCREEN_CONFIG);
    const view = (this.scene.get(SCENE_KEYS.run) as RunScene).hudView();
    labels.forEach((label, i) => {
      let x = 36;
      let y = 44;
      if (label.target.kind === "dog") {
        const dog = label.target.dog;
        const index = view?.run.pack.findIndex((slot) => slot.dog === dog) ?? -1;
        const rect = dogSlots[index];
        if (rect === undefined) {
          return;
        }
        x = rect.x + rect.width / 2;
        y = rect.y + 84;
      }
      const text = addPixelText(this, x, y + i * 10, label.text, {
        color: label.gain ? PALETTE.green : PALETTE.red,
        originX: 0.5,
      });
      this.tweens.add({
        alpha: 0,
        duration: LABEL_MS,
        ease: "Sine.easeIn",
        onComplete: () => text.destroy(),
        targets: text,
        y: text.y - LABEL_RISE,
      });
    });
  }
}
