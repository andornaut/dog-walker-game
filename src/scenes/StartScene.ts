import { type GameObjects, type Input, Scene } from "phaser";

import { itemAt } from "../arrays";
import { temperamentIconKey, traitIconKey } from "../assets/iconKeys";
import { dogFaceKey, dogSpriteKey, gearIconKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import type { DogId, GearId, Size, TraitId, WalkerId } from "../data/types";
import {
  badgePopOffset,
  bobOffset,
  effectFrame,
  FEEDBACK,
  hopOffset,
  pressDip,
  pulseFrame,
  shakeOffset,
} from "../home/feedback";
import { type Focus, focusDirectionForKey, moveFocus } from "../home/focus";
import {
  buy,
  dogInfo,
  dollarText,
  gearInfo,
  type HomeLoadout,
  logbookOf,
  packCapacity,
  packFeePerZone,
  packOf,
  partingSpeech,
  type Purchase,
  purchasePrice,
  tapDog,
  tapGear,
  wrapWords,
} from "../home/home";
import { isConfirmKey, isMuteKey } from "../input/keyBindings";
import { gridRects, rectIndexAt } from "../layout/grid";
import { COLLAR_HEIGHT, leashHand, type PackPlacement } from "../layout/packFormation";
import { containsPoint, type Rect } from "../layout/rect";
import { startWakeLock, stopWakeLock } from "../pwa";
import { nextDogSlot } from "../rules/shop";
import { type Cents, cents } from "../rules/units";
import type { SaveDocument } from "../save/schema";
import { drawPixelLine, drawShadow, fillRect } from "./draw";
import { HELP_CLOSED_EVENT } from "./HelpScene";
import { openHelp } from "./helpScreen";
import { PALETTE } from "./palette";
import { addPixelText, type FontRole } from "./pixelText";
import {
  currentSettings,
  isMuted,
  profileSave,
  setMuted,
  setRunOverride,
  storageState,
  updateProfile,
  walkerSpriteKey,
} from "./profileStore";
import type { RunSceneData } from "./RunScene";
import { SCENE_KEYS } from "./sceneKeys";
import { SETTINGS_CLOSED_EVENT, type SettingsSceneData } from "./SettingsScene";
import { addStandingSprite, spriteMetrics } from "./sprites";
import type { StatsSceneData } from "./StatsScene";
import {
  addIconButton,
  addNineSlice,
  addTagImage,
  cogIcon,
  fitText,
  type IconButton,
  imageIcon,
  showTag,
  soundIcon,
  tagFrame,
  TEXT_SCALE,
} from "./uiKit";

const SCREEN = { height: 640, width: 360 };
// The gate scene in the screen-home art: the street, the yard and the path to the gate.
const GATE = { height: 156, y: 40 };
const PATH = { width: 32, x: 164 };
const WALKER_AT_GATE = { footY: 196, x: 180 };
// At the gate the pack spreads out around the walker, the first dog through the gate.
const GATE_SPOTS: readonly PackPlacement[] = [
  { dx: 0, footDy: -46 },
  { dx: -26, footDy: -14 },
  { dx: 26, footDy: -12 },
];
// Every tappable thing is at least 44 game pixels (48 CSS pixels on a 390px-wide phone) on
// each side, with 8 or more between them.
const GAP = 8;
const TOP_BAR = { height: 40 };
// Each icon button is drawn at its *_ICON spot and tapped anywhere in its 44x44 hit area.
const HELP_BUTTON: Rect = { height: 44, width: 44, x: 0, y: 40 };
const HELP_ICON = { x: 8, y: 46 };
const MUTE_BUTTON: Rect = { height: 44, width: 44, x: 316, y: 40 };
const MUTE_ICON = { x: 332, y: 46 };
const SETTINGS_BUTTON: Rect = { height: 44, width: 44, x: 256, y: 0 };
const SETTINGS_ICON = { x: 268, y: 10 };
const SLOT_SIGN: Rect = { height: 44, width: 132, x: 222, y: 140 };
const LOGO = { key: "logo", x: 6, y: 146 };
const HEADING_Y = 200;
const DOG_TILES = { cellHeight: 50, cellWidth: 112, columns: 3, gapX: GAP, gapY: GAP };
const DOG_ORIGIN = { x: 4, y: 214 };
const GEAR_SLOTS = { cellHeight: 54, cellWidth: 64, columns: 5, gapX: GAP, gapY: 0 };
const GEAR_ORIGIN = { x: 4, y: 388 };
const INFO = { lineHeight: 16, maxWidth: 352, y: 447 };
const LOGBOOK: Rect = { height: 54, width: 352, x: 4, y: 478 };
const START_BUTTON: Rect = { height: 44, width: 352, x: 4, y: 538 };
const WALKER_TILES = { cellHeight: 44, cellWidth: 44, columns: 4, gapX: GAP, gapY: 0 };
const WALKER_ORIGIN = { x: 84, y: 590 };
const GEAR_BADGE: Rect = { height: 18, width: 18, x: 194, y: 166 };
// ui-select overhangs a picked tile by this much on each side; the keyboard ring sits outside it.
const SELECT_OUTSET = 3;
const FOCUS_OUTSET = 5;
const SIZE_ORDER: readonly Size[] = ["small", "medium", "big"];
const TRAIT_ORDER: readonly TraitId[] = ["fancy", "foodDriven", "chaser"];

// The widest line the speech bubble holds, in characters, and how many lines it shows.
const SPEECH_CHARS = 30;
const SPEECH_LINES = 3;
const INFO_CHARS = 48;

// The walkers in data order, as the picker shows them.
function walkerIds(): WalkerId[] {
  return Object.keys(gameData.walkers) as WalkerId[];
}

function gearIds(): GearId[] {
  return Object.keys(gameData.shopGear) as GearId[];
}

type Target =
  | { dog: DogId; kind: "dog" }
  | { gear: GearId; kind: "gear" }
  | { kind: "help" }
  | { kind: "mute" }
  | { kind: "settings" }
  | { kind: "slot" }
  | { kind: "start" }
  | { kind: "stats" }
  | { kind: "walker"; walker: WalkerId };

// One key per tappable thing, for its feedback timers.
function targetId(target: Target): string {
  switch (target.kind) {
    case "dog":
      return `dog:${target.dog}`;
    case "gear":
      return `gear:${target.gear}`;
    case "walker":
      return `walker:${target.walker}`;
    default:
      return target.kind;
  }
}

// The roster in rows by size, each row in trait order, as the mock lays it out.
function rosterOrder(): DogId[] {
  const rank = (dog: DogId) => {
    const { size, trait } = gameData.dogs[dog];
    return SIZE_ORDER.indexOf(size) * TRAIT_ORDER.length + TRAIT_ORDER.indexOf(trait);
  };
  return (Object.keys(gameData.dogs) as DogId[]).sort((a, b) => rank(a) - rank(b));
}

function dogTiles(): Rect[] {
  return gridRects(DOG_TILES, rosterOrder().length, DOG_ORIGIN);
}

function gearSlots(): Rect[] {
  return gridRects(GEAR_SLOTS, gearIds().length, GEAR_ORIGIN);
}

function walkerTiles(): Rect[] {
  return gridRects(WALKER_TILES, walkerIds().length, WALKER_ORIGIN);
}

interface Focusable {
  rect: Rect;
  target: Target;
}

// The keyboard's rows, top to bottom: the dog rows, gear, Start walk and the walkers.
function focusRows(): Focusable[][] {
  const tiles = dogTiles();
  const dogs = rosterOrder().map((dog, i): Focusable => ({
    rect: itemAt(tiles, i),
    target: { dog, kind: "dog" },
  }));
  const rows: Focusable[][] = [];
  for (let i = 0; i < dogs.length; i += DOG_TILES.columns) {
    rows.push(dogs.slice(i, i + DOG_TILES.columns));
  }
  const slots = gearSlots();
  rows.push(
    gearIds().map((gear, i): Focusable => ({
      rect: itemAt(slots, i),
      target: { gear, kind: "gear" },
    })),
  );
  rows.push([{ rect: START_BUTTON, target: { kind: "start" } }]);
  const walkers = walkerTiles();
  rows.push(
    walkerIds().map((walker, i): Focusable => ({
      rect: itemAt(walkers, i),
      target: { kind: "walker", walker },
    })),
  );
  return rows;
}

// A tile that reacts to taps: its container moves for the dip, lift and shake, its face hops,
// its badge pops, and its selection frame pulses.
interface TileView {
  badge?: { image: GameObjects.Image; y: number };
  container: GameObjects.Container;
  face?: { object: GameObjects.Image | GameObjects.Sprite; y: number };
  // An icon button shows its pressed face rather than dipping.
  iconButton?: IconButton;
  lift: number;
  pulse?: readonly GameObjects.NineSlice[];
  // The pop timer that raises the whole tile for a moment, for the gear badge at the gate.
  rise?: string;
}

// A one-shot effect sprite (fx-tap or fx-dust) and when it started.
interface Burst {
  image: GameObjects.Image;
  key: string;
  startedMs: number;
}

// The screen before a walk: bank and best walk, the walker and pack at the gate, the dog
// picker, gear, logbook and Start walk. It is also the shop: tapping a locked dog, gear item
// or dog slot buys it when the bank covers it, and shakes it when not. The arrow keys move a
// focus ring, Enter or Space picks, ? opens help, S settings and M mutes.
export class StartScene extends Scene {
  private bursts: Burst[] = [];
  private focus: Focus | null = null;
  private fxLayer: GameObjects.Container | undefined;
  private gateDogs: { dog: DogId; footY: number; sprite: GameObjects.Sprite }[] = [];
  // What the info line describes: the item last tapped or focused.
  private info: Target | undefined;
  private loadout: HomeLoadout = { dogs: [], gear: null };
  private notice = "";
  private pops = new Map<string, number>();
  private press: { held: boolean; id: string; startedMs: number } | undefined;
  private pressedTarget: Target | undefined;
  private root: GameObjects.Container | undefined;
  private shakes = new Map<string, number>();
  // The speech bubble's lines while the pack has dogs: the parting line of the owner whose
  // dog was picked last, or null for the walker's own line.
  private speech: string[] | null = null;
  private startButton:
    | { container: GameObjects.Container; down: GameObjects.Container; up: GameObjects.Container }
    | undefined;
  private views = new Map<string, TileView>();

  constructor() {
    super(SCENE_KEYS.start);
  }

  create(): void {
    this.bursts = [];
    this.focus = null;
    this.info = undefined;
    this.notice = "";
    this.pops = new Map();
    this.press = undefined;
    this.pressedTarget = undefined;
    this.shakes = new Map();
    this.speech = null;
    this.views = new Map();
    const { lastLoadout } = profileSave(this);
    this.loadout = { dogs: [...lastLoadout.dogs], gear: lastLoadout.gear };
    stopWakeLock();
    setRunOverride(this, null);

    this.drawGate();
    this.root = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    this.render();

    this.input.on("pointerdown", (pointer: Input.Pointer) => {
      this.addBurst("fx-tap", pointer.x, pointer.y);
      this.pressedTarget = this.targetAt(pointer.x, pointer.y);
      this.press =
        this.pressedTarget === undefined
          ? undefined
          : { held: true, id: targetId(this.pressedTarget), startedMs: this.time.now };
    });
    this.input.on("pointerup", (pointer: Input.Pointer) => {
      const target = this.targetAt(pointer.x, pointer.y);
      const pressed = this.pressedTarget;
      this.pressedTarget = undefined;
      if (this.press !== undefined) {
        this.press.held = false;
      }
      if (target !== undefined && pressed !== undefined && targetId(target) === targetId(pressed)) {
        this.act(target);
      }
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => this.onKey(event.key));
    // Settings can change reduced motion or mute, so the screen is drawn again.
    const onSettingsClosed = () => this.render();
    this.game.events.on(SETTINGS_CLOSED_EVENT, onSettingsClosed);
    this.events.once("shutdown", () =>
      this.game.events.off(SETTINGS_CLOSED_EVENT, onSettingsClosed),
    );
  }

  private onKey(key: string): void {
    const direction = focusDirectionForKey(key);
    if (direction !== undefined) {
      const rows = focusRows();
      this.focus = moveFocus(
        rows.map((row) => row.length),
        direction,
        this.focus,
      );
      const focused = rows[this.focus.row]?.[this.focus.column]?.target;
      this.info = focused?.kind === "start" ? undefined : focused;
      this.notice = "";
      this.render();
      return;
    }
    if (isConfirmKey(key)) {
      const focused =
        this.focus === null ? undefined : focusRows()[this.focus.row]?.[this.focus.column];
      const target = focused?.target ?? { kind: "start" };
      this.press = { held: false, id: targetId(target), startedMs: this.time.now };
      this.act(target);
      return;
    }
    if (key === "?") {
      this.act({ kind: "help" });
    } else if (key === "s" || key === "S") {
      this.act({ kind: "settings" });
    } else if (isMuteKey(key)) {
      this.act({ kind: "mute" });
    }
  }

  private save(): SaveDocument {
    return profileSave(this);
  }

  private targetAt(x: number, y: number): Target | undefined {
    const tile = rectIndexAt(dogTiles(), x, y);
    if (tile !== undefined) {
      return { dog: itemAt(rosterOrder(), tile), kind: "dog" };
    }
    const slot = rectIndexAt(gearSlots(), x, y);
    if (slot !== undefined) {
      return { gear: itemAt(gearIds(), slot), kind: "gear" };
    }
    const walker = rectIndexAt(walkerTiles(), x, y);
    if (walker !== undefined) {
      return { kind: "walker", walker: itemAt(walkerIds(), walker) };
    }
    const fixed: readonly [Rect, Target][] = [
      [START_BUTTON, { kind: "start" }],
      [HELP_BUTTON, { kind: "help" }],
      [MUTE_BUTTON, { kind: "mute" }],
      [SETTINGS_BUTTON, { kind: "settings" }],
      [LOGBOOK, { kind: "stats" }],
    ];
    const hit = fixed.find(([rect]) => containsPoint(rect, x, y));
    if (hit !== undefined) {
      return hit[1];
    }
    const forSale = nextDogSlot(gameData, this.save().owned.dogSlots) !== null;
    return forSale && containsPoint(SLOT_SIGN, x, y) ? { kind: "slot" } : undefined;
  }

  // A newly picked dog's owner says a parting line; it stays until that dog leaves the pack.
  private speechAfter(next: HomeLoadout): string[] | null {
    const added = next.dogs.find((dog) => !this.loadout.dogs.includes(dog));
    if (added !== undefined) {
      return partingSpeech(gameData, Math.random, SPEECH_CHARS, added).slice(0, SPEECH_LINES);
    }
    return next.dogs.length < this.loadout.dogs.length ? null : this.speech;
  }

  private act(target: Target): void {
    const id = targetId(target);
    const now = this.time.now;
    switch (target.kind) {
      case "dog":
      case "gear": {
        this.info = target;
        const { owned } = this.save();
        const tap =
          target.kind === "dog"
            ? tapDog(gameData, owned, target.dog, this.loadout)
            : tapGear(owned, target.gear, this.loadout);
        if (tap.kind === "buy") {
          this.purchase(id, tap.purchase);
        } else if (tap.kind === "full") {
          this.shakes.set(id, now);
          this.notice = "The pack is full. Tap a picked dog to take it out.";
          this.render();
        } else {
          this.setLoadout(tap.loadout);
        }
        return;
      }
      case "slot":
        this.purchase(id, { kind: "dogSlot" });
        return;
      case "walker":
        this.pops.set(id, now);
        this.info = undefined;
        this.notice = `Walking as ${gameData.walkers[target.walker].name}.`;
        void updateProfile(this, (save) => ({ ...save, walker: target.walker }));
        this.render();
        return;
      case "mute": {
        const muted = !isMuted(this);
        setMuted(this, muted);
        this.notice = muted ? "Sound off." : "Sound on.";
        this.render();
        return;
      }
      case "help":
        openHelp(this, SCENE_KEYS.start);
        return;
      case "settings": {
        const data: SettingsSceneData = { resume: SCENE_KEYS.start };
        this.scene.pause();
        this.scene.launch(SCENE_KEYS.settings, data);
        return;
      }
      case "stats": {
        const data: StatsSceneData = { resume: SCENE_KEYS.start };
        this.scene.pause();
        this.scene.launch(SCENE_KEYS.stats, data);
        return;
      }
      case "start":
        this.startWalk();
        return;
      default:
        target satisfies never;
    }
  }

  // Picks or drops a dog or gear item, and keeps the result as the last loadout.
  private setLoadout(next: HomeLoadout): void {
    const now = this.time.now;
    for (const dog of next.dogs.filter((picked) => !this.loadout.dogs.includes(picked))) {
      this.pops.set(`dog:${dog}`, now);
    }
    if (next.gear !== null && next.gear !== this.loadout.gear) {
      this.pops.set(`gear:${next.gear}`, now);
    }
    this.speech = this.speechAfter(next);
    this.loadout = next;
    this.notice = "";
    const lastLoadout = { dogs: [...next.dogs], gear: next.gear };
    void updateProfile(this, (save) => ({ ...save, lastLoadout }));
    this.render();
  }

  // Buys the item when the bank covers it, equipping bought gear as the mock does; shakes it
  // when not.
  private purchase(id: string, purchase: Purchase): void {
    const now = this.time.now;
    const save = this.save();
    const result = buy(gameData, purchase, save);
    const name = this.purchaseName(purchase);
    if (result.kind === "refused") {
      this.shakes.set(id, now);
      const cost = purchasePrice(gameData, save.owned, purchase);
      this.notice =
        cost === null
          ? ""
          : `${name} costs ${dollarText(cost)}. Need ${dollarText(cents(cost - save.bankCents))} more.`;
      this.render();
      return;
    }
    this.pops.set(id, now);
    void updateProfile(this, () => result.save);
    if (purchase.kind === "gear") {
      this.setLoadout({ ...this.loadout, gear: purchase.gear });
    }
    this.notice = `Bought ${name}!`;
    this.render();
  }

  private purchaseName(purchase: Purchase): string {
    switch (purchase.kind) {
      case "dog":
        return gameData.dogs[purchase.dog].name;
      case "dogSlot":
        return `Dog slot ${this.save().owned.dogSlots + 1}`;
      case "gear":
        return gameData.shopGear[purchase.gear].name;
      default:
        return purchase satisfies never;
    }
  }

  // A new player's first walk opens help once, then sets off when it closes.
  private startWalk(): void {
    const dogs = packOf(this.loadout);
    if (dogs === undefined) {
      this.shakes.set("start", this.time.now);
      this.notice = "Pick a dog to walk first.";
      this.render();
      return;
    }
    const save = this.save();
    const data: RunSceneData = {
      loadout: { dogs, gear: this.loadout.gear },
      walkerSprite: walkerSpriteKey(this, save.walker),
    };
    const go = () => {
      startWakeLock();
      this.scene.start(SCENE_KEYS.run, data);
    };
    if (save.helpSeen) {
      go();
      return;
    }
    void updateProfile(this, (current) => ({ ...current, helpSeen: true }));
    this.game.events.once(HELP_CLOSED_EVENT, go);
    openHelp(this, SCENE_KEYS.start);
  }

  private addBurst(key: string, x: number, y: number): void {
    const frame = tagFrame(this, key, "play");
    if (frame === undefined || this.fxLayer === undefined) {
      return;
    }
    const image = this.add.image(Math.round(x) - 8, Math.round(y) - 8, key, frame).setOrigin(0);
    this.fxLayer.add(image);
    this.bursts.push({ image, key, startedMs: this.time.now });
  }

  override update(): void {
    const now = this.time.now;
    const reduced = currentSettings(this).reducedMotion;
    const pressed = this.press;
    const dip = (id: string) =>
      pressed?.id === id ? pressDip(pressed.held, now, pressed.startedMs) : 0;
    const pulse = pulseFrame(reduced, now);
    for (const [id, view] of this.views) {
      const rise =
        view.rise === undefined ? 0 : badgePopOffset(reduced, now, this.pops.get(view.rise));
      view.iconButton?.setPressed(dip(id) > 0);
      view.container.setPosition(
        shakeOffset(reduced, now, this.shakes.get(id)),
        view.lift + (view.iconButton === undefined ? dip(id) : 0) + rise,
      );
      view.face?.object.setY(view.face.y + hopOffset(reduced, now, this.pops.get(id)));
      view.badge?.image.setY(view.badge.y + badgePopOffset(reduced, now, this.pops.get(id)));
      view.pulse?.forEach((frame, i) => frame.setVisible(i === pulse));
    }
    if (this.startButton !== undefined) {
      const down = dip("start") > 0 && this.loadout.dogs.length > 0;
      const { container } = this.startButton;
      container.setPosition(
        shakeOffset(reduced, now, this.shakes.get("start")),
        down ? 0 : bobOffset(reduced, now, this.loadout.dogs.length > 0),
      );
      this.startButton.up.setVisible(!down);
      this.startButton.down.setVisible(down);
    }
    for (const { dog, footY, sprite } of this.gateDogs) {
      sprite.setY(footY + hopOffset(reduced, now, this.pops.get(`dog:${dog}`)));
    }
    this.bursts = this.bursts.filter((burst) => {
      const tap = burst.key === "fx-tap";
      const frame = effectFrame(
        tap ? FEEDBACK.tapFrameMs : FEEDBACK.dustFrameMs,
        tap ? FEEDBACK.tapFrames : FEEDBACK.dustFrames,
        now,
        burst.startedMs,
      );
      const textureFrame =
        frame === undefined ? undefined : tagFrame(this, burst.key, "play", frame);
      if (textureFrame === undefined) {
        burst.image.destroy();
        return false;
      }
      burst.image.setFrame(textureFrame);
      return true;
    });
  }

  // Text at the 2x body size unless told otherwise.
  private text(
    parent: GameObjects.Container,
    x: number,
    y: number,
    value: string,
    color: number,
    options: { font?: FontRole; originX?: number; scale?: number } = {},
  ): GameObjects.BitmapText {
    const label = addPixelText(this, x, y, value, { color, scale: TEXT_SCALE, ...options });
    parent.add(label);
    return label;
  }

  private graphics(parent: GameObjects.Container): GameObjects.Graphics {
    const g = this.add.graphics();
    parent.add(g);
    return g;
  }

  // The street, yard and porch come from the screen-home art, drawn once; a plain yard
  // stands in while the art is missing.
  private drawGate(): void {
    if (this.textures.exists("screen-home")) {
      this.add.image(0, 0, "screen-home").setOrigin(0);
    } else {
      const g = this.add.graphics();
      fillRect(g, PALETTE.darkBrown, { height: SCREEN.height, width: SCREEN.width, x: 0, y: 0 });
      fillRect(g, PALETTE.darkSlate, { height: 52, width: SCREEN.width, x: 0, y: GATE.y });
      fillRect(g, PALETTE.lightGrey, { height: 34, width: SCREEN.width, x: 0, y: 92 });
      fillRect(g, PALETTE.green, { height: 70, width: SCREEN.width, x: 0, y: 126 });
      fillRect(g, PALETTE.tan, { height: 70, width: PATH.width, x: PATH.x, y: 126 });
    }
    if (this.textures.exists(LOGO.key)) {
      this.add.image(LOGO.x, LOGO.y, LOGO.key).setOrigin(0);
    }
    addPixelText(this, 291, 59, "Maple St", { color: PALETTE.white, originX: 0.5 });
  }

  private render(): void {
    const root = this.root;
    if (root === undefined) {
      return;
    }
    root.removeAll(true);
    this.views = new Map();
    this.gateDogs = [];
    const save = this.save();
    const g = this.graphics(root);
    this.drawTopBar(root, g, save);
    this.drawPackAtGate(root, g, save);
    this.drawSlotSign(root, save);
    this.drawDogTiles(root, g, save);
    this.drawGear(root, g, save);
    this.drawInfo(root, save);
    this.drawLogbook(root, g, save);
    this.drawStartButton(root);
    this.drawWalkerPicker(root, save);
    this.drawFocus(root);
  }

  // A container for one tappable tile, registered for its feedback.
  private tileView(root: GameObjects.Container, id: string, lift: number): TileView {
    const container = this.add.container(0, 0);
    root.add(container);
    const view: TileView = { container, lift };
    this.views.set(id, view);
    return view;
  }

  // The pulsing ui-select frame around rect, both frames made and one shown at a time; an
  // amber border while the art is missing.
  private selectFrame(view: TileView, rect: Rect): void {
    const outer = {
      height: rect.height + SELECT_OUTSET * 2,
      width: rect.width + SELECT_OUTSET * 2,
      x: rect.x - SELECT_OUTSET,
      y: rect.y - SELECT_OUTSET,
    };
    const frames = [0, 1].flatMap((index) => {
      const slice = addNineSlice(this, "ui-select", outer, "pulse", index);
      return slice === undefined ? [] : [slice];
    });
    if (frames.length === 0) {
      const g = this.graphics(view.container);
      fillRect(g, PALETTE.amber, { ...outer, height: SELECT_OUTSET });
      fillRect(g, PALETTE.amber, { ...outer, height: SELECT_OUTSET, y: rect.y + rect.height });
      return;
    }
    view.container.add(frames);
    view.pulse = frames;
  }

  // The green pick badge: the pack order, or a tick for gear.
  private pickBadge(view: TileView, tag: string, x: number, y: number): void {
    const image = addTagImage(this, "ui-check", tag, x, y);
    if (image === undefined) {
      const g = this.graphics(view.container);
      fillRect(g, PALETTE.green, { height: 12, width: 12, x: x + 2, y: y + 2 });
      this.text(view.container, x + 8, y + 4, tag === "tick" ? "+" : tag, PALETTE.white, {
        font: "title",
        originX: 0.5,
        scale: 1,
      });
      return;
    }
    view.container.add(image);
    view.badge = { image, y };
  }

  // A ui-icon-button at the art's spot; its face sinks when pressed instead of the whole
  // button dipping.
  private iconButton(
    root: GameObjects.Container,
    id: string,
    at: { x: number; y: number },
    icon: (x: number, y: number) => ReturnType<typeof cogIcon>,
  ): void {
    const view = this.tileView(root, id, 0);
    view.iconButton = addIconButton(this, view.container, at.x, at.y, icon);
  }

  private drawTopBar(
    root: GameObjects.Container,
    g: GameObjects.Graphics,
    save: SaveDocument,
  ): void {
    fillRect(g, PALETTE.plum, { height: TOP_BAR.height, width: SCREEN.width, x: 0, y: 0 });
    fillRect(g, PALETTE.darkBrown, {
      height: 2,
      width: SCREEN.width,
      x: 0,
      y: TOP_BAR.height - 2,
    });
    root.add(this.add.sprite(6, 12, "tip").setOrigin(0));
    const dollar = this.text(root, 24, 14, "$", PALETTE.amber, { font: "title" });
    this.text(root, 24 + dollar.width + 2, 14, dollarText(save.bankCents).slice(1), PALETTE.cream, {
      font: "title",
    });
    const { bestWalk, runs } = save.stats;
    const walks = runs.finished + runs.noDogs + runs.wentHome;
    const right = SETTINGS_BUTTON.x - GAP;
    if (bestWalk === null) {
      this.text(root, right, 14, "No walks yet", PALETTE.cream, { originX: 1 });
    } else {
      this.text(root, right, 5, `Best ${dollarText(bestWalk.earnedCents)}`, PALETTE.cream, {
        originX: 1,
      });
      this.text(root, right, 22, `${walks} ${walks === 1 ? "walk" : "walks"}`, PALETTE.cream, {
        originX: 1,
      });
    }
    this.iconButton(root, "settings", SETTINGS_ICON, (x, y) => cogIcon(this, x, y));
    // Help and sound sit in the gate scene's top corners, where the art places them.
    this.iconButton(root, "help", HELP_ICON, (x, y) => imageIcon(this, "icon-help", x, y));
    this.iconButton(root, "mute", MUTE_ICON, (x, y) => soundIcon(this, !isMuted(this), x, y));
  }

  private drawPackAtGate(
    root: GameObjects.Container,
    g: GameObjects.Graphics,
    save: SaveDocument,
  ): void {
    const { footY, x } = WALKER_AT_GATE;
    const reduced = currentSettings(this).reducedMotion;
    const walkerKey = walkerSpriteKey(this, save.walker);
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
    drawShadow(g, groundColor(x), x, footY, spriteMetrics(walkerKey).opaqueWidth);
    const now = this.time.now;
    for (const { dog, dx, footY: dogFoot, key } of dogs) {
      const sprite = addStandingSprite(this, key, x + dx, dogFoot);
      showTag(reduced, sprite, key, "walk");
      root.add(sprite);
      this.gateDogs.push({ dog, footY: dogFoot, sprite });
      // A dog that just joined hops onto the path in a puff of dust.
      const popped = this.pops.get(`dog:${dog}`);
      if (!reduced && popped !== undefined && now - popped < FEEDBACK.dustFrameMs) {
        this.addBurst("fx-dust", x + dx, dogFoot - 6);
      }
    }
    const walker = addStandingSprite(this, walkerKey, x, footY);
    showTag(reduced, walker, walkerKey, "walk");
    root.add(walker);

    const leash = this.graphics(root);
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
        : (this.speech ?? ["Ready when you are."]);
    const top = GATE.y + 6;
    const bubble = this.graphics(root);
    const labels = lines.map((line, i) =>
      this.text(root, x, top + 4 + i * INFO.lineHeight, line, PALETTE.plum, { originX: 0.5 }),
    );
    const width = Math.ceil(Math.max(...labels.map((label) => label.width))) + 10;
    const height = lines.length * INFO.lineHeight + 4;
    const left = Math.round(x - width / 2);
    fillRect(bubble, PALETTE.white, { height, width: width - 2, x: left + 1, y: top });
    fillRect(bubble, PALETTE.white, { height: height - 2, width, x: left, y: top + 1 });
    fillRect(bubble, PALETTE.lightGrey, {
      height: 1,
      width: width - 2,
      x: left + 1,
      y: top + height,
    });
    fillRect(bubble, PALETTE.white, { height: 2, width: 6, x: x - 4, y: top + height });

    // Equipped gear shows as a badge beside the walker.
    if (this.loadout.gear !== null) {
      const badge = this.tileView(root, "gateBadge", 0);
      badge.rise = `gear:${this.loadout.gear}`;
      fillRect(this.graphics(badge.container), PALETTE.plum, GEAR_BADGE);
      this.addGearIcon(badge.container, this.loadout.gear, GEAR_BADGE.x + 1, GEAR_BADGE.y + 1, 0.5);
    }
  }

  // The next dog slot for sale, on a sign in the yard; gone once every slot is owned.
  private drawSlotSign(root: GameObjects.Container, save: SaveDocument): void {
    const slot = nextDogSlot(gameData, save.owned.dogSlots);
    if (slot === null) {
      return;
    }
    const { height, width, x, y } = SLOT_SIGN;
    const view = this.tileView(root, "slot", 0);
    const g = this.graphics(view.container);
    const postHeight = GATE.y + GATE.height - y - height;
    fillRect(g, PALETTE.darkBrown, { height: postHeight, width: 3, x: x + 10, y: y + height });
    fillRect(g, PALETTE.darkBrown, {
      height: postHeight,
      width: 3,
      x: x + width - 13,
      y: y + height,
    });
    fillRect(g, PALETTE.plum, SLOT_SIGN);
    fillRect(g, PALETTE.cream, { height: height - 4, width: width - 4, x: x + 2, y: y + 2 });
    const parent = view.container;
    this.text(parent, x + 7, y + 8, `Slot ${slot.slot}: ${dollarText(slot.price)}`, PALETTE.plum);
    const short = slot.price > save.bankCents;
    const status = short ? `Need ${dollarText(cents(slot.price - save.bankCents))}` : "Tap to buy";
    this.text(parent, x + 7, y + 25, status, PALETTE.plum);
    if (short) {
      this.addLock(parent, x + width - 20, y + 22);
    }
  }

  private addLock(parent: GameObjects.Container, x: number, y: number): void {
    if (this.textures.exists("icon-lock")) {
      parent.add(this.add.image(x, y, "icon-lock").setOrigin(0));
    }
  }

  // A tile that lifts onto a shadow when picked.
  private tileBase(
    root: GameObjects.Container,
    shadow: GameObjects.Graphics,
    id: string,
    rect: Rect,
    picked: boolean,
    fill: number,
  ): TileView {
    if (picked) {
      fillRect(shadow, PALETTE.plum, {
        height: 3,
        width: rect.width - 2,
        x: rect.x + 2,
        y: rect.y + rect.height - 1,
      });
    }
    const view = this.tileView(root, id, picked ? -FEEDBACK.liftPx : 0);
    const g = this.graphics(view.container);
    fillRect(g, picked ? PALETTE.plum : PALETTE.slate, rect);
    fillRect(g, fill, {
      height: rect.height - 2,
      width: rect.width - 2,
      x: rect.x + 1,
      y: rect.y + 1,
    });
    return view;
  }

  // A locked item's price on a cream chip: forest when the bank covers it, darkRed (and a
  // padlock beside it) when not. originX places it by its left (0) or centre (0.5).
  private priceBadge(
    parent: GameObjects.Container,
    x: number,
    y: number,
    price: Cents,
    originX: number,
  ): void {
    const badge = this.graphics(parent);
    const color = price > this.save().bankCents ? PALETTE.darkRed : PALETTE.forest;
    const label = this.text(parent, x, y, dollarText(price), color, { originX });
    fillRect(badge, PALETTE.cream, {
      height: 14,
      width: Math.ceil(label.width) + 6,
      x: Math.round(x - originX * label.width) - 3,
      y: y - 2,
    });
  }

  private drawDogTiles(
    root: GameObjects.Container,
    g: GameObjects.Graphics,
    save: SaveDocument,
  ): void {
    const { owned } = save;
    const reduced = currentSettings(this).reducedMotion;
    const capacity = packCapacity(gameData, owned);
    this.text(root, 4, HEADING_Y, "Your pack", PALETTE.cream, { font: "title" });
    const picked = this.loadout.dogs.length;
    const fee = dollarText(packFeePerZone(gameData, this.loadout));
    this.text(
      root,
      356,
      HEADING_Y,
      picked === 0 ? `0/${capacity} dogs` : `${picked}/${capacity} dogs, ${fee} a zone`,
      PALETTE.cream,
      { originX: 1 },
    );
    const tiles = dogTiles();
    rosterOrder().forEach((id, i) => {
      const rect = itemAt(tiles, i);
      const { width, x, y } = rect;
      const dog = gameData.dogs[id];
      const isOwned = owned.dogs.includes(id);
      const order = this.loadout.dogs.indexOf(id);
      const view = this.tileBase(
        root,
        g,
        `dog:${id}`,
        rect,
        order >= 0,
        order >= 0 ? PALETTE.white : isOwned ? PALETTE.cream : PALETTE.tan,
      );
      const parent = view.container;
      const box = order >= 0 ? PALETTE.yellow : isOwned ? PALETTE.tan : PALETTE.brown;
      fillRect(this.graphics(parent), box, { height: 34, width: 34, x: x + 3, y: y + 8 });
      const face = this.add.sprite(x + 4, y + 9, dogFaceKey(id)).setOrigin(0);
      showTag(reduced, face, dogFaceKey(id), isOwned ? "happy" : "neutral");
      parent.add(face);
      view.face = { object: face, y: y + 9 };

      this.text(parent, x + 41, y + 4, dog.name, PALETTE.plum);
      // The trait and the owner's temperament as icons; the info line says them in words.
      [traitIconKey(dog.trait), temperamentIconKey(dog.owner.temperament)].forEach((key, n) => {
        if (this.textures.exists(key)) {
          parent.add(this.add.image(x + 40 + n * 18, y + 17, key).setOrigin(0));
        }
      });
      const price = purchasePrice(gameData, owned, { dog: id, kind: "dog" });
      if (price === null) {
        const zoneFee = dollarText(packFeePerZone(gameData, { dogs: [id], gear: null }));
        this.text(parent, x + 41, y + 37, `${zoneFee}/zone`, PALETTE.plum);
      } else {
        this.priceBadge(parent, x + 44, y + 37, price, 0);
        if (price > save.bankCents) {
          this.addLock(parent, x + width - 19, y + 31);
        }
      }
      if (order >= 0) {
        this.selectFrame(view, rect);
        this.pickBadge(view, String(order + 1), x - 6, y - 7);
      }
    });
  }

  private drawGear(root: GameObjects.Container, g: GameObjects.Graphics, save: SaveDocument): void {
    const { owned } = save;
    const slots = gearSlots();
    gearIds().forEach((id, i) => {
      const rect = itemAt(slots, i);
      const { width, x, y } = rect;
      const equipped = this.loadout.gear === id;
      const isOwned = owned.gear.includes(id);
      const view = this.tileBase(
        root,
        g,
        `gear:${id}`,
        rect,
        equipped,
        equipped ? PALETTE.white : isOwned ? PALETTE.cream : PALETTE.tan,
      );
      const parent = view.container;
      const box = equipped ? PALETTE.yellow : isOwned ? PALETTE.tan : PALETTE.brown;
      fillRect(this.graphics(parent), box, { height: 34, width: 34, x: x + 15, y: y + 3 });
      const icon = this.addGearIcon(parent, id, x + 16, y + 4, 1);
      if (icon !== undefined) {
        view.face = { object: icon, y: y + 4 };
      }
      const price = purchasePrice(gameData, owned, { gear: id, kind: "gear" });
      if (price !== null) {
        this.priceBadge(parent, x + width / 2, y + 40, price, 0.5);
        if (price > save.bankCents) {
          this.addLock(parent, x + 44, y + 20);
        }
      }
      if (equipped) {
        this.selectFrame(view, rect);
        this.pickBadge(view, "tick", x + width - 14, y - 7);
      }
    });
  }

  // Under the gear: a notice after a tap, or the tapped or focused item in words, or the
  // equipped gear and what it does.
  private infoText(save: SaveDocument): string {
    const lines: string[] = [];
    if (storageState(this) === "unavailable") {
      lines.push("Progress won't be saved.");
    }
    const info = this.info;
    if (this.notice !== "") {
      lines.push(this.notice);
    } else if (info?.kind === "dog") {
      lines.push(dogInfo(gameData, save.owned, save.bankCents, info.dog));
    } else if (info?.kind === "gear") {
      lines.push(gearInfo(gameData, save.owned, save.bankCents, info.gear));
    } else if (this.loadout.gear !== null) {
      lines.push(gearInfo(gameData, save.owned, save.bankCents, this.loadout.gear));
    } else {
      lines.push("Tap a dog to walk it, or a locked one to buy it.");
    }
    return lines.join(" ");
  }

  private drawInfo(root: GameObjects.Container, save: SaveDocument): void {
    wrapWords(INFO_CHARS, this.infoText(save))
      .slice(0, 2)
      .forEach((line, i) => {
        const label = this.text(root, 180, INFO.y + i * INFO.lineHeight, line, PALETTE.cream, {
          originX: 0.5,
        });
        fitText(label, INFO.maxWidth, [line, `${line.slice(0, INFO_CHARS - 3)}...`]);
      });
  }

  // The item's 32x32 icon, or its initials until the icon is in the manifest.
  private addGearIcon(
    parent: GameObjects.Container,
    gear: GearId,
    x: number,
    y: number,
    scale: number,
  ): GameObjects.Image | undefined {
    const key = gearIconKey(gear);
    if (this.textures.exists(key)) {
      const icon = this.add.image(x, y, key).setOrigin(0).setScale(scale);
      parent.add(icon);
      return icon;
    }
    const initials = gameData.shopGear[gear].name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("");
    this.text(parent, x + 16 * scale, y + 11 * scale, initials, PALETTE.cream, {
      font: "title",
      originX: 0.5,
      scale: 1,
    });
    return undefined;
  }

  // One portrait per preset walker; the chosen one takes the pulsing selection frame.
  private drawWalkerPicker(root: GameObjects.Container, save: SaveDocument): void {
    const chosen = save.walker;
    const reduced = currentSettings(this).reducedMotion;
    const tiles = walkerTiles();
    this.text(root, 4, WALKER_ORIGIN.y + 16, "Walker", PALETTE.cream, { font: "title" });
    walkerIds().forEach((id, i) => {
      const rect = itemAt(tiles, i);
      const view = this.tileView(root, `walker:${id}`, 0);
      const g = this.graphics(view.container);
      fillRect(g, id === chosen ? PALETTE.plum : PALETTE.slate, rect);
      fillRect(g, id === chosen ? PALETTE.yellow : PALETTE.tan, {
        height: rect.height - 2,
        width: rect.width - 2,
        x: rect.x + 1,
        y: rect.y + 1,
      });
      const portrait = gameData.walkers[id].portraitKey;
      const faceX = rect.x + (rect.width - 32) / 2;
      const faceY = rect.y + (rect.height - 32) / 2;
      if (this.textures.exists(portrait)) {
        const face = this.add.sprite(faceX, faceY, portrait).setOrigin(0);
        showTag(reduced, face, portrait, id === chosen ? "happy" : "neutral");
        view.container.add(face);
        view.face = { object: face, y: faceY };
      } else {
        const initial = gameData.walkers[id].name.charAt(0);
        this.text(view.container, rect.x + 22, rect.y + 16, initial, PALETTE.plum, {
          font: "title",
          originX: 0.5,
        });
      }
      if (id === chosen) {
        this.selectFrame(view, rect);
      }
    });
    const last = itemAt(tiles, tiles.length - 1);
    const nameX = last.x + last.width + GAP;
    this.text(root, nameX, WALKER_ORIGIN.y + 16, gameData.walkers[chosen].name, PALETTE.cream);
  }

  // The best and last walk; the totals are on the Stats page behind it.
  private drawLogbook(
    root: GameObjects.Container,
    g: GameObjects.Graphics,
    save: SaveDocument,
  ): void {
    const { height, width, x, y } = LOGBOOK;
    fillRect(g, PALETTE.plum, LOGBOOK);
    fillRect(g, PALETTE.cream, { height: height - 2, width: width - 2, x: x + 1, y: y + 1 });
    fillRect(g, PALETTE.tan, { height: 15, width: width - 2, x: x + 1, y: y + 1 });
    this.text(root, x + 6, y + 3, "Logbook", PALETTE.plum, { font: "title" });
    this.text(root, x + width - 6, y + 4, "Stats >", PALETTE.plum, { originX: 1 });
    const log = logbookOf(gameData, save.stats);
    const line = (row: number, candidates: readonly string[]) => {
      const label = this.text(root, x + 6, y + 21 + row * INFO.lineHeight, "", PALETTE.plum);
      fitText(label, width - 12, candidates);
    };
    if (log === null) {
      line(0, ["No walks yet."]);
      line(1, ["Three clients are waiting on the porch."]);
      return;
    }
    line(0, [`Best ${log.best}, ${log.bestNote}`, `Best ${log.best}`]);
    line(1, [`Last ${log.last}`, log.last]);
  }

  // Start walk sinks into its lip when pressed: drawn twice, raised and pressed, and the
  // frame shows one.
  private drawStartButton(root: GameObjects.Container): void {
    const { height, width, x, y } = START_BUTTON;
    const ready = this.loadout.dogs.length > 0;
    const container = this.add.container(0, 0);
    root.add(container);
    const variant = (down: boolean) => {
      const group = this.add.container(0, 0);
      container.add(group);
      const g = this.graphics(group);
      const drop = down ? FEEDBACK.buttonPressPx : 0;
      if (!down) {
        const lip = ready ? PALETTE.orange : PALETTE.darkSlate;
        fillRect(g, lip, { height: height - 4, width, x, y: y + 4 });
      }
      const face = ready ? (down ? PALETTE.yellow : PALETTE.amber) : PALETTE.slate;
      fillRect(g, face, { height: height - 4, width, x, y: y + drop });
      const label = ready ? "Start walk" : "Pick a dog";
      this.text(group, 180, y + 12 + drop, label, ready ? PALETTE.plum : PALETTE.white, {
        font: "title",
        originX: 0.5,
        scale: 3,
      });
      return group;
    };
    const up = variant(false);
    const down = variant(true);
    down.setVisible(false);
    this.startButton = { container, down, up };
  }

  // The keyboard's focus ring, outside any selection frame.
  private drawFocus(root: GameObjects.Container): void {
    if (this.focus === null) {
      return;
    }
    const rect = focusRows()[this.focus.row]?.[this.focus.column]?.rect;
    if (rect === undefined) {
      return;
    }
    const g = this.graphics(root);
    const ring = {
      height: rect.height + FOCUS_OUTSET * 2,
      width: rect.width + FOCUS_OUTSET * 2,
      x: rect.x - FOCUS_OUTSET,
      y: rect.y - FOCUS_OUTSET,
    };
    fillRect(g, PALETTE.cyan, { ...ring, height: 2 });
    fillRect(g, PALETTE.cyan, { ...ring, height: 2, y: ring.y + ring.height - 2 });
    fillRect(g, PALETTE.cyan, { ...ring, width: 2 });
    fillRect(g, PALETTE.cyan, { ...ring, width: 2, x: ring.x + ring.width - 2 });
  }
}
