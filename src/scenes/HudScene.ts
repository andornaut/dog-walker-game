import { type GameObjects, type Input, Scene } from "phaser";

import { itemAt } from "../arrays";
import { statusIconKey } from "../assets/iconKeys";
import { dogFaceKey, doghouseTag, ownerFaceKey, zoneIconKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { HintId } from "../data/types";
import { DOGHOUSE, doghouseHearts, fittingScale, heartCount } from "../hud/doghouse";
import { type ChangeLabel, wholeDollars, zonePips } from "../hud/hudView";
import { stripItems, stripTapAllowed } from "../hud/stateStrip";
import {
  buttonIcon,
  PAUSE_BUTTON,
  pauseButtonIcon,
  type RunPause,
  SOUND_BUTTON,
  topBarAction,
  type TopBarButton,
  topBarButtonAt,
  topBarButtonForKey,
  type TopBarPress,
} from "../hud/topBar";
import type { Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { maxHearts } from "../rules/dogs";
import { faceMood } from "../rules/treats";
import { read } from "../rules/units";
import { statusesKey, statusesOf, type StatusMark } from "../runner/statuses";
import type { PackSlot, RunState } from "../state/runState";
import { drawDashedRect, drawFramedRect, drawHeart, fillRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText, placePixelText, scalePixelText, setPixelText } from "./pixelText";
import { isMuted, setMuted } from "./profileStore";
import {
  CHANGE_LABELS_EVENT,
  HINT_EVENT,
  type QuipBubble,
  QUIPS_EVENT,
  type RunHudView,
  type RunScene,
} from "./RunScene";
import { SCENE_KEYS } from "./sceneKeys";
import { playEffect, playTag } from "./sprites";
import { StateStripView } from "./stateStripView";

const PIP = { gap: 3, height: 8, width: 18, x: 271, y: 22 };
// The zone's name is right-aligned in its well, its icon just left of it.
const ZONE_WELL = { right: 352, y: 9 };
const LAYOUT = screenLayout(SCREEN_CONFIG);
const LABEL = { ms: 1100, rise: 18 };
// First-time hints sit at the foot of the backdrop band, just above the road.
const HINT = { bottom: 186, holdMs: 4500, margin: 8, padding: 6 };
// An owner's quip floats beside their doghouse, its tail at the owner's window.
const QUIP = { holdMs: 2600, maxWidth: 200, padding: 6, x: 82, y: 70 };
const NINE_SLICE_CORNER = 8;

interface SlotView {
  anchors: { name: { x: number; y: number }; ownerName: { x: number; y: number } };
  count: GameObjects.BitmapText;
  dogFace: GameObjects.Sprite;
  fired: GameObjects.BitmapText;
  hearts: GameObjects.Sprite[];
  house: GameObjects.Sprite;
  name: GameObjects.BitmapText;
  ownerFace: GameObjects.Sprite;
  ownerName: GameObjects.BitmapText;
  statuses: GameObjects.Image[];
}

// The top bar and dog column, drawn over the road for the whole walk and kept in view while
// cards are up. It reads the run from RunScene every frame and redraws what changed, and
// shows the run's change labels, first-time hints and owners' quips. It keeps running while
// the walk is paused, so the top bar's buttons and their keys work in every state; its
// animations run on too, being the bar's and not the walk's.
export class HudScene extends Scene {
  private drawn: Record<string, unknown> = {};
  private dynamic: GameObjects.Graphics | undefined;
  private hintQueue: { id: HintId; text: string }[] = [];
  private hintShowing = false;
  private money: GameObjects.BitmapText | undefined;
  private mute: GameObjects.Sprite | undefined;
  private pauseGlyph: GameObjects.Graphics | undefined;
  private pauseIcon: GameObjects.Image | undefined;
  private pips: GameObjects.Sprite[] = [];
  private slots: SlotView[] = [];
  private strip: StateStripView | undefined;
  private treats: GameObjects.BitmapText | undefined;
  private zoneIcon: GameObjects.Image | undefined;
  private zoneLabel: GameObjects.BitmapText | undefined;

  constructor() {
    super(SCENE_KEYS.hud);
  }

  create(): void {
    const { dogColumn, dogSlots, topBar } = LAYOUT;
    this.drawn = {};
    this.hintQueue = [];
    this.hintShowing = false;
    const g = this.add.graphics();
    fillRect(g, PALETTE.darkBrown, dogColumn);
    if (this.textures.exists("ui-top-bar")) {
      this.add.image(topBar.x, topBar.y, "ui-top-bar").setOrigin(0);
    } else {
      fillRect(g, PALETTE.plum, topBar);
      fillRect(g, PALETTE.darkBrown, { ...topBar, height: 2, y: topBar.y + topBar.height - 2 });
    }
    this.addButton(PAUSE_BUTTON);
    const pauseIcon = buttonIcon(PAUSE_BUTTON, false);
    this.pauseIcon = this.add.image(pauseIcon.x, pauseIcon.y, "__DEFAULT").setOrigin(0);
    this.pauseGlyph = this.add.graphics();
    this.addButton(SOUND_BUTTON);
    const soundIcon = buttonIcon(SOUND_BUTTON, false);
    this.mute = this.add.sprite(soundIcon.x, soundIcon.y, "icon-sound").setOrigin(0);

    this.add.sprite(8, 13, "tip").setOrigin(0);
    const money = { font: "title", scale: 2 } as const;
    const dollar = addPixelText(this, 26, 15, "$", { color: PALETTE.amber, ...money });
    this.money = addPixelText(this, 26 + dollar.width + 2, 15, "0", {
      color: PALETTE.cream,
      ...money,
    });
    this.add.sprite(104, 13, "treat").setOrigin(0);
    this.treats = addPixelText(this, 122, 18, "0", { color: PALETTE.cream, font: "title" });
    this.zoneIcon = this.add.image(0, 4, "__DEFAULT").setOrigin(1, 0);
    this.zoneLabel = addPixelText(this, ZONE_WELL.right, ZONE_WELL.y, "", {
      color: PALETTE.cream,
      font: "title",
      originX: 1,
    });
    this.pips = gameData.world.zones.map((_, i) =>
      this.add.sprite(PIP.x + i * (PIP.width + PIP.gap), PIP.y, "ui-zone-pips").setOrigin(0),
    );
    this.dynamic = this.add.graphics();
    this.slots = dogSlots.map((rect) => this.createSlot(rect));
    this.strip = new StateStripView(this, () => stripTapAllowed((this.scene.get(SCENE_KEYS.run) as RunScene).runPause()));

    const run = this.scene.get(SCENE_KEYS.run) as RunScene;
    const onLabels = (labels: ChangeLabel[]) => this.floatLabels(labels);
    const onHint = (hint: { id: HintId; text: string }) => this.queueHint(hint);
    const onQuips = (quips: QuipBubble[]) => quips.forEach((quip) => this.sayQuip(quip));
    run.events.on(CHANGE_LABELS_EVENT, onLabels);
    run.events.on(HINT_EVENT, onHint);
    run.events.on(QUIPS_EVENT, onQuips);
    this.events.once("shutdown", () => {
      run.events.off(CHANGE_LABELS_EVENT, onLabels);
      run.events.off(HINT_EVENT, onHint);
      run.events.off(QUIPS_EVENT, onQuips);
    });

    // A button acts on the press, as the walk's gestures never see it.
    this.input.on("pointerdown", (pointer: Input.Pointer) => {
      const button = topBarButtonAt(pointer.x, pointer.y);
      if (button !== undefined) {
        this.press("tap", button);
      }
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const button = topBarButtonForKey(event.repeat, event.key);
      if (button !== undefined) {
        this.press("key", button);
      }
    });
  }

  private press(via: "key" | "tap", button: TopBarPress): void {
    const run = this.scene.get(SCENE_KEYS.run) as RunScene;
    switch (topBarAction(run.runPause(), via, button)) {
      case "mute":
        setMuted(this, !isMuted(this));
        break;
      case "openMenu":
        run.openPause();
        break;
      case "resume":
        run.closePause();
        break;
      default:
    }
  }

  // A 20x20 button face on the bar, drawn when the art is missing.
  private addButton(button: TopBarButton): void {
    const { x, y } = button.face;
    if (this.textures.exists("ui-icon-button")) {
      const face = this.add.sprite(x, y, "ui-icon-button").setOrigin(0);
      playTag(face, "ui-icon-button", "normal");
      return;
    }
    const g = this.add.graphics();
    drawFramedRect(
      g,
      { border: PALETTE.darkBrown, fill: PALETTE.navy },
      { height: 20, width: 20, x, y },
    );
  }

  // The icon art when it is loaded, else cream pause bars or play triangle drawn on the face.
  private showPauseIcon(pause: RunPause): void {
    const key = pauseButtonIcon(pause);
    const art = this.textures.exists(key);
    this.pauseIcon?.setTexture(art ? key : "__DEFAULT").setVisible(art);
    const g = this.pauseGlyph;
    if (g === undefined) {
      return;
    }
    g.clear();
    if (art) {
      return;
    }
    if (key === "icon-play") {
      this.drawPlayTriangle(g);
    } else {
      this.drawPauseBars(g);
    }
  }

  private drawPauseBars(g: GameObjects.Graphics): void {
    const { x, y } = PAUSE_BUTTON.face;
    for (const dx of [6, 11]) {
      fillRect(g, PALETTE.cream, { height: 10, width: 3, x: x + dx, y: y + 5 });
    }
  }

  // Columns narrowing to a point, over the same 8x10 the pause bars cover.
  private drawPlayTriangle(g: GameObjects.Graphics): void {
    const { x, y } = PAUSE_BUTTON.face;
    [10, 8, 8, 6, 6, 4, 2, 2].forEach((height, i) => {
      fillRect(g, PALETTE.cream, { height, width: 1, x: x + 6 + i, y: y + 10 - height / 2 });
    });
  }

  private createSlot({ x, y }: Rect): SlotView {
    const at = (point: { x: number; y: number }) => ({ x: x + point.x, y: y + point.y });
    const sprite = (key: string, point: { x: number; y: number }) =>
      this.add.sprite(at(point).x, at(point).y, key).setOrigin(0).setVisible(false);
    const name = at(DOGHOUSE.name);
    const count = at(DOGHOUSE.heartCount);
    const fired = at(DOGHOUSE.fired);
    const owner = at(DOGHOUSE.ownerName);
    // The house first, so the faces, hearts and labels draw over it.
    const house = sprite("ui-doghouse", { x: 0, y: 0 });
    return {
      anchors: { name, ownerName: owner },
      count: addPixelText(this, count.x, count.y, "", {
        color: PALETTE.darkRed,
        font: "title",
        originX: 0.5,
      }),
      dogFace: sprite("treat", DOGHOUSE.dogFace),
      fired: addPixelText(this, fired.x, fired.y, "", {
        color: PALETTE.darkRed,
        font: "title",
        originX: 0.5,
      }),
      hearts: doghouseHearts(0, 11).map((cell) => sprite("ui-heart", cell)),
      house,
      name: addPixelText(this, name.x, name.y, "", {
        color: PALETTE.plum,
        font: "title",
        originX: 0.5,
      }),
      ownerFace: sprite("treat", DOGHOUSE.ownerFace),
      ownerName: addPixelText(this, owner.x, owner.y, "", { color: PALETTE.plum }),
      statuses: DOGHOUSE.statuses.map((cell) =>
        this.add.image(at(cell).x, at(cell).y, "__DEFAULT").setOrigin(0).setVisible(false),
      ),
    };
  }

  override update(): void {
    const run = this.scene.get(SCENE_KEYS.run) as RunScene;
    const view = run.hudView();
    if (view === undefined) {
      return;
    }
    const pause = run.runPause();
    this.strip?.show(stripItems(gameData, view.run));
    // The run state is immutable, so a changed pack or modifier list is a new array.
    const state: Record<string, unknown> = {
      affected: view.affected.join(),
      fill: Math.round(view.zoneFraction * PIP.width),
      modifiers: view.run.modifiers,
      money: view.run.money,
      muted: isMuted(this),
      pack: view.run.pack,
      pauseIcon: pauseButtonIcon(pause),
      statuses: statusesKey(view.statuses),
      treats: view.run.treats,
      zone: view.run.zoneIndex,
    };
    if (Object.keys(state).some((key) => state[key] !== this.drawn[key])) {
      this.drawn = state;
      this.showPauseIcon(pause);
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
    if (this.mute !== undefined) {
      playTag(this.mute, "icon-sound", isMuted(this) ? "off" : "on");
    }
    if (this.treats !== undefined) {
      setPixelText(
        this.treats,
        `${run.treats}/${read(gameData.tuning, "counts", "treatCarryMax")}`,
      );
    }
    const zones = gameData.world.zones;
    const zone = itemAt(zones, Math.min(run.zoneIndex, zones.length - 1));
    if (this.zoneLabel !== undefined) {
      setPixelText(this.zoneLabel, zone.name);
      const icon = zoneIconKey(zone);
      this.zoneIcon?.setTexture(this.textures.exists(icon) ? icon : "__DEFAULT");
      this.zoneIcon?.setVisible(this.textures.exists(icon));
      this.zoneIcon?.setX(ZONE_WELL.right - Math.ceil(this.zoneLabel.width) - 3);
    }
    zonePips(zones.length, run.zoneIndex, view.zoneFraction).forEach(({ fill, state }, i) => {
      const x = PIP.x + i * (PIP.width + PIP.gap);
      const pip = this.pips[i];
      if (pip !== undefined && this.textures.exists("ui-zone-pips")) {
        playTag(pip, "ui-zone-pips", state);
      } else {
        fillRect(g, state === "done" ? PALETTE.green : PALETTE.brown, { ...PIP, x });
      }
      // The current pip's ink well fills with amber as the zone goes by.
      if (state === "current") {
        const width = Math.round(fill * (PIP.width - 4));
        fillRect(g, PALETTE.amber, { height: PIP.height - 4, width, x: x + 2, y: PIP.y + 2 });
      }
    });

    const { dogSlots } = LAYOUT;
    dogSlots.forEach((rect, i) => {
      const slot = this.slots[i];
      if (slot !== undefined) {
        const packSlot = run.pack[i];
        const highlighted = packSlot !== undefined && view.affected.includes(packSlot.dog);
        this.drawSlot(g, rect, slot, run, highlighted, packSlot);
        this.showStatuses(slot, packSlot, view.statuses);
      }
    });
  }

  // A doghouse roofed in the dog's colour: the dog in the door, the owner in the window, the
  // hearts and their count on the board. A fired dog's house is grey and empty.
  private drawSlot(
    g: GameObjects.Graphics,
    rect: Rect,
    view: SlotView,
    run: RunState,
    highlighted: boolean,
    slot: PackSlot | undefined,
  ): void {
    const { x, y } = rect;
    const parts = [view.house, view.dogFace, view.ownerFace, ...view.hearts];
    if (slot === undefined) {
      parts.forEach((part) => part.setVisible(false));
      [view.name, view.count, view.ownerName].forEach((label) => setPixelText(label, ""));
      drawDashedRect(g, PALETTE.tan, rect);
      setPixelText(view.fired.setTint(PALETTE.cream), "Empty");
      return;
    }
    const dog = gameData.dogs[slot.dog];
    const fired = slot.status === "fired";
    view.house.setVisible(true);
    playTag(view.house, "ui-doghouse", doghouseTag(fired ? null : slot.dog));
    if (!this.textures.exists("ui-doghouse")) {
      fillRect(g, fired ? PALETTE.lightGrey : PALETTE.tan, rect);
    }
    this.fitName(view.name, dog.name, DOGHOUSE.name, view.anchors.name);
    setPixelText(view.fired.setTint(PALETTE.darkRed), fired ? "Fired" : "");
    if (fired) {
      [view.dogFace, view.ownerFace, ...view.hearts].forEach((part) => part.setVisible(false));
      setPixelText(view.count, "");
      setPixelText(view.ownerName, "");
      return;
    }
    if (highlighted) {
      const frame = { height: rect.height + 4, width: rect.width + 4, x: x - 2, y: y - 2 };
      fillRect(g, PALETTE.amber, { ...frame, height: 2 });
      fillRect(g, PALETTE.amber, { ...frame, height: 2, y: frame.y + frame.height - 2 });
      fillRect(g, PALETTE.amber, { ...frame, width: 2 });
      fillRect(g, PALETTE.amber, { ...frame, width: 2, x: frame.x + frame.width - 2 });
    }
    const hearts = slot.hearts;
    const mood = faceMood(gameData, hearts);
    const ownerKey = ownerFaceKey(slot.dog);
    const dogKey = dogFaceKey(slot.dog);
    playTag(view.ownerFace.setTexture(ownerKey).setVisible(true), ownerKey, mood);
    playTag(view.dogFace.setTexture(dogKey).setVisible(true), dogKey, mood);
    this.fitName(view.ownerName, dog.owner.name, DOGHOUSE.ownerName, view.anchors.ownerName);

    const max = maxHearts(gameData.tuning, run.modifiers, dog);
    setPixelText(view.count, heartCount(hearts, max));
    const cells = doghouseHearts(hearts, max);
    const art = this.textures.exists("ui-heart");
    view.hearts.forEach((sprite, i) => {
      const cell = cells[i];
      sprite.setVisible(art && cell !== undefined);
      if (cell === undefined) {
        return;
      }
      if (art) {
        playTag(sprite, "ui-heart", cell.full ? "full" : "empty");
      } else {
        drawHeart(g, x + cell.x, y + cell.y, cell.full ? PALETTE.darkRed : PALETTE.tan);
      }
    });
  }

  // The dog's newest statuses on its slot; a fired dog has none.
  private showStatuses(
    view: SlotView,
    slot: PackSlot | undefined,
    statuses: readonly StatusMark[],
  ): void {
    const shown = slot === undefined ? [] : statusesOf(statuses, slot.dog);
    view.statuses.forEach((image, i) => {
      const status = shown[i];
      const key = status === undefined ? undefined : statusIconKey(status);
      const art = key !== undefined && this.textures.exists(key);
      image.setTexture(art ? key : "__DEFAULT").setVisible(art);
    });
  }

  // Names are drawn at the largest of their scales that fits.
  private fitName(
    label: GameObjects.BitmapText,
    text: string,
    fit: { scales: readonly number[]; width: number },
    at: { x: number; y: number },
  ): void {
    setPixelText(label, text);
    const scale = fittingScale(fit.width, fit.scales, label.width / label.scaleX);
    scalePixelText(label, scale, at.x, at.y);
  }

  // Each change floats up from where it happened and fades out; with reduced motion it fades
  // in place. A heart change also shows a heart rising or breaking beside its label.
  private floatLabels(labels: ChangeLabel[]): void {
    const { dogSlots, topBar } = LAYOUT;
    const run = this.scene.get(SCENE_KEYS.run) as RunScene;
    const view = run.hudView();
    const still = run.reducedMotion();
    labels.forEach((label, i) => {
      let x = 6;
      let y = topBar.y + topBar.height + 2;
      if (label.target.kind === "dog") {
        const dog = label.target.dog;
        const index = view?.run.pack.findIndex((slot) => slot.dog === dog) ?? -1;
        const rect = dogSlots[index];
        if (rect === undefined) {
          return;
        }
        x = rect.x + 2;
        y = rect.y + DOGHOUSE.ownerFace.y + 4;
        playEffect(
          this,
          "fx-heart",
          label.gain ? "up" : "down",
          { x: rect.x + rect.width - 8, y: y + 8 },
          10,
        );
      }
      // On a cream chip, so gains in forest and losses in dark red read over any road.
      const text = addPixelText(this, x + 2, y + i * 22 + 2, label.text, {
        color: label.gain ? PALETTE.forest : PALETTE.darkRed,
        scale: 2,
      });
      const chip = this.add.graphics();
      drawFramedRect(
        chip,
        { border: PALETTE.plum, fill: PALETTE.cream },
        { height: 20, width: Math.ceil(text.width) + 4, x, y: y + i * 22 - 2 },
      );
      text.setDepth(1);
      const parts = [chip, text];
      this.tweens.add({
        alpha: 0,
        duration: LABEL.ms,
        ease: "Sine.easeIn",
        onComplete: () => parts.forEach((part) => part.destroy()),
        targets: parts,
        y: still ? "+=0" : `-=${LABEL.rise}`,
      });
    });
  }

  private queueHint(hint: { id: HintId; text: string }): void {
    this.hintQueue.push(hint);
    if (!this.hintShowing) {
      this.showNextHint();
    }
  }

  // One hint at a time, in a bubble at the foot of the backdrop with its tail pointing at the
  // road. The drag hint also shows the touch picture over the road.
  private showNextHint(): void {
    const hint = this.hintQueue.shift();
    if (hint === undefined) {
      this.hintShowing = false;
      return;
    }
    this.hintShowing = true;
    const { road } = LAYOUT;
    const room = SCREEN_CONFIG.width - 2 * HINT.margin - 2 * HINT.padding;
    const text = addPixelText(this, 0, 0, hint.text, {
      color: PALETTE.plum,
      maxWidth: room / 2,
      scale: 2,
    });
    const width = Math.ceil(text.width) + 2 * HINT.padding;
    const height = Math.ceil(text.height) + 2 * HINT.padding;
    const x = Math.round((SCREEN_CONFIG.width - width) / 2);
    const y = HINT.bottom - height;
    placePixelText(text, x + HINT.padding, y + HINT.padding);
    const parts: (GameObjects.BitmapText | GameObjects.Image | GameObjects.NineSlice)[] = [];
    if (this.textures.exists("ui-hint")) {
      const corner = NINE_SLICE_CORNER;
      parts.push(
        this.add
          .nineslice(x, y, "ui-hint", undefined, width, height, corner, corner, corner, corner)
          .setOrigin(0),
      );
    } else {
      const box = this.add.graphics();
      drawFramedRect(box, { border: PALETTE.plum, fill: PALETTE.cream }, { height, width, x, y });
      parts.push(text);
      box.setDepth(-1);
    }
    if (this.textures.exists("ui-hint-tail")) {
      parts.push(
        this.add.image(road.x + road.width / 2, y + height - 1, "ui-hint-tail").setOrigin(0.5, 0),
      );
    }
    if (hint.id === "drag" && this.textures.exists("ui-touch-hint")) {
      parts.push(this.add.image(road.x + road.width / 2, road.y + 220, "ui-touch-hint"));
    }
    text.setDepth(1);
    parts.push(text);
    this.tweens.add({
      alpha: 0,
      delay: HINT.holdMs,
      duration: 400,
      onComplete: () => {
        parts.forEach((part) => part.destroy());
        this.showNextHint();
      },
      targets: parts,
    });
  }

  // An owner's line in a bubble beside their doghouse, the tail pointing at their window.
  private sayQuip(quip: QuipBubble): void {
    const run = this.scene.get(SCENE_KEYS.run) as RunScene;
    const index = run.hudView()?.run.pack.findIndex((slot) => slot.dog === quip.dog) ?? -1;
    const rect = LAYOUT.dogSlots[index];
    if (rect === undefined) {
      return;
    }
    const text = addPixelText(this, 0, 0, quip.text, {
      color: PALETTE.plum,
      maxWidth: (QUIP.maxWidth - 2 * QUIP.padding) / 2,
      scale: 2,
    });
    const width = Math.ceil(text.width) + 2 * QUIP.padding;
    const height = Math.ceil(text.height) + 2 * QUIP.padding;
    const x = QUIP.x;
    const y = Math.min(rect.y + QUIP.y, SCREEN_CONFIG.height - height - 2);
    placePixelText(text, x + QUIP.padding, y + QUIP.padding);
    const parts: (
      GameObjects.BitmapText | GameObjects.Graphics | GameObjects.Image | GameObjects.NineSlice
    )[] = [];
    if (this.textures.exists("ui-quip")) {
      const corner = NINE_SLICE_CORNER;
      parts.push(
        this.add
          .nineslice(x, y, "ui-quip", undefined, width, height, corner, corner, corner, corner)
          .setOrigin(0),
      );
    } else {
      const box = this.add.graphics();
      drawFramedRect(box, { border: PALETTE.plum, fill: PALETTE.cream }, { height, width, x, y });
      parts.push(box);
    }
    if (this.textures.exists("ui-quip-tail")) {
      parts.push(
        this.add.image(x - 5, rect.y + DOGHOUSE.ownerFace.y + 12, "ui-quip-tail").setOrigin(0),
      );
    }
    text.setDepth(1);
    parts.push(text);
    this.tweens.add({
      alpha: 0,
      delay: QUIP.holdMs,
      duration: 400,
      onComplete: () => parts.forEach((part) => part.destroy()),
      targets: parts,
    });
  }
}
