import { type GameObjects, Scene, type Time } from "phaser";

import { itemAt } from "../arrays";
import { temperamentIconKey, traitIconKey } from "../assets/iconKeys";
import { dogFaceKey, dogPortraitKey, dogSpriteKey, gearIconKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DogId, GearId, Size, TraitId, WalkerId } from "../data/types";
import { bankAtLastVisit, isAffordable, newlyAffordable } from "../home/afford";
import { dogDetail, gearDetail } from "../home/detail";
import {
  badgePopOffset,
  bobOffset,
  effectFrame,
  FEEDBACK,
  hopOffset,
  pressDip,
  settleDelay,
  shakeOffset,
} from "../home/feedback";
import { type Focus, focusDirectionForKey, moveFocus } from "../home/focus";
import { type HoldPress, moveHold, releaseHold, startHold, tickHold } from "../home/hold";
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
import {
  bubbleLine,
  type HomeAction,
  messageLine,
  packCountLine,
  slotSignLines,
  startWalkLine,
  stepHeading,
  type WalkerLine,
  walkerLineKey,
} from "../home/homeLines";
import { porchOwners } from "../home/porch";
import { choiceFull, type SelectLook } from "../home/selection";
import { isConfirmKey, isMuteKey } from "../input/keyBindings";
import { gridRects, rectIndexAt } from "../layout/grid";
import { COLLAR_HEIGHT, leashHand, type PackPlacement } from "../layout/packFormation";
import { containsPoint, type Rect } from "../layout/rect";
import { startWakeLock, stopWakeLock } from "../pwa";
import { nextDogSlot } from "../rules/shop";
import { type Cents, cents } from "../rules/units";
import type { SaveDocument } from "../save/schema";
import type { CelebrationSceneData } from "./CelebrationScene";
import { drawFocusRing, drawPixelLine, drawShadow, fillRect } from "./draw";
import { HELP_CLOSED_EVENT } from "./HelpScene";
import { openHelp } from "./helpScreen";
import {
  addAffordFrame,
  type DetailPicture,
  drawDetailCard,
  drawLogbookPanel,
  drawSlotSign,
  drawStepPlate,
} from "./homePanels";
import { listenOnePress } from "./onePress";
import { addOwnerFigure } from "./ownerFigure";
import { PALETTE } from "./palette";
import { addPixelText, type FontRole } from "./pixelText";
import {
  currentSettings,
  isMuted,
  profileSave,
  purchaseInProfile,
  setMuted,
  setRunOverride,
  storageState,
  takeCelebrations,
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
  addSelectTile,
  cogIcon,
  fitText,
  type IconButton,
  imageIcon,
  type SelectTile,
  type SelectTileOptions,
  showTag,
  soundIcon,
  tagFrame,
  TEXT_SCALE,
} from "./uiKit";

const SCREEN = SCREEN_CONFIG;
// The gate scene in the screen-home art: the street, the yard and the path to the gate.
const GATE = { height: 156, y: 40 };
const PATH = { width: 32, x: 164 };
const WALKER_AT_GATE = { footY: GATE.y + GATE.height, x: 180 };
// At the gate the pack spreads out around the walker, the first dog through the gate.
const GATE_SPOTS: readonly PackPlacement[] = [
  { dx: 0, footDy: -46 },
  { dx: -26, footDy: -14 },
  { dx: 26, footDy: -12 },
];
// Before the first walk the starter owners wait in the yard left of the path, behind the
// yard sign, each with their dog at their feet. Feet positions, by dog; a starter dog with no
// spot is not drawn.
const PORCH_SPOTS: Readonly<Partial<Record<DogId, { footY: number; x: number }>>> = {
  biscuit: { footY: 145, x: 120 },
  duchess: { footY: 148, x: 150 },
  koda: { footY: 145, x: 92 },
};
const PORCH_DOG_OFFSET = { dx: -12, footDy: 3 };
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
const LOGBOOK_BUTTON: Rect = { height: 44, width: 44, x: 204, y: 0 };
const LOGBOOK_ICON = { x: 216, y: 10 };
const SLOT_SIGN: Rect = { height: 46, width: 160, x: 196, y: 140 };
const LOGO = { key: "logo", x: 6, y: 146 };
// Under the gate, three steps top to bottom: the walker's plate beside its tiles, then the
// dogs' and the gear's plates each over their tiles; then the message line and Start walk.
const STEP_PLATE_HEIGHT = 24;
const WALKER_TILES = { cellHeight: 44, cellWidth: 44, columns: 4, gapX: GAP, gapY: 0 };
const WALKER_ORIGIN = { x: 156, y: 200 };
const DOGS_STEP_Y = 248;
const DOG_TILES = { cellHeight: 44, cellWidth: 112, columns: 3, gapX: GAP, gapY: GAP };
const DOG_ORIGIN = { x: 4, y: 276 };
const GEAR_STEP_Y = 428;
// A gear tile holds its icon with its price tag over the icon's foot while locked; its name
// is on its detail card.
const GEAR_SLOTS = { cellHeight: 44, cellWidth: 64, columns: 5, gapX: GAP, gapY: 0 };
const GEAR_ORIGIN = { x: 4, y: 456 };
// One line of the message, between the gear and Start walk.
const INFO = { maxWidth: 352, y: 502 };
const START_BUTTON: Rect = { height: 44, width: 352, x: 4, y: 514 };
const GEAR_BADGE: Rect = { height: 18, width: 18, x: 194, y: 166 };
// The keyboard ring sits outside the ui-select frame.
const FOCUS_OUTSET = 5;
const SIZE_ORDER: readonly Size[] = ["small", "medium", "big"];
const TRAIT_ORDER: readonly TraitId[] = ["fancy", "foodDriven", "chaser"];

// The widest line the speech bubble holds, in characters, and how many lines it shows.
const SPEECH_CHARS = 30;
const SPEECH_LINES = 3;
const INFO_CHARS = 48;
const SPEECH_LINE_HEIGHT = 15;

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
  | { kind: "logbook" }
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

// The keyboard's rows, top to bottom as the screen shows them: the walkers, the dog rows,
// gear and Start walk.
function focusRows(): Focusable[][] {
  const walkers = walkerTiles();
  const rows: Focusable[][] = [
    walkerIds().map((walker, i): Focusable => ({
      rect: itemAt(walkers, i),
      target: { kind: "walker", walker },
    })),
  ];
  const tiles = dogTiles();
  const dogs = rosterOrder().map((dog, i): Focusable => ({
    rect: itemAt(tiles, i),
    target: { dog, kind: "dog" },
  }));
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
  return rows;
}

// What is open over the screen: a held tile's detail card, or the logbook. rect is the
// panel, so a tap outside it closes it.
type Overlay =
  | {
      kind: "detail";
      rect: Rect | undefined;
      target: { dog: DogId; kind: "dog" } | { gear: GearId; kind: "gear" };
    }
  | { kind: "logbook"; rect: Rect | undefined; stats: Rect | undefined };

// A tile that reacts to taps: its container moves for the dip, lift and shake, its face hops,
// and its badge pops.
interface TileView {
  badge?: { image: GameObjects.Image; y: number };
  container: GameObjects.Container;
  face?: { object: GameObjects.Image | GameObjects.Sprite; y: number };
  // An icon button shows its pressed face rather than dipping.
  iconButton?: IconButton;
  lift: number;
  // The pop timer that raises the whole tile for a moment, for the gear badge at the gate.
  rise?: string;
}

// A one-shot effect sprite (fx-tap or fx-dust) and when it started.
interface Burst {
  image: GameObjects.Image;
  key: string;
  startedMs: number;
}

// The bank the last time the home screen was shown this session, so the walker can say
// when something new became affordable.
const LAST_VISIT_BANK_KEY = "homeLastVisitBank";

// The screen before a walk: bank, best walk and the Logbook in the top bar, the walker and
// pack at the gate, then three steps (walker, dogs, gear) and Start walk. It is also the
// shop: tapping a locked dog, gear item or dog slot buys it when the bank covers it, and
// shakes it when not; holding a dog or gear tile opens its detail card. The arrow keys move
// a focus ring, Enter or Space picks, Escape closes a card, ? opens help, S settings, L the
// logbook and M mutes.
export class StartScene extends Scene {
  // The last action, for the message line and the bubble.
  private action: HomeAction = { kind: "none" };
  private bursts: Burst[] = [];
  private focus: Focus | null = null;
  private fxLayer: GameObjects.Container | undefined;
  private gateDogs: { dog: DogId; footY: number; sprite: GameObjects.Sprite }[] = [];
  // A press on a dog or gear tile that may become a hold.
  private hold: HoldPress | undefined;
  private loadout: HomeLoadout = { dogs: [], gear: null };
  private overlay: Overlay | undefined;
  private overlayLayer: GameObjects.Container | undefined;
  // A press that began while a panel was open: it never reaches the tiles under it.
  private overlayPress: { x: number; y: number } | undefined;
  // Taps waiting for their dip to finish before they act.
  private pending = new Set<Time.TimerEvent>();
  private pops = new Map<string, number>();
  private press: { held: boolean; id: string; startedMs: number } | undefined;
  private pressedTarget: Target | undefined;
  // The parting lines drawn this visit, one per dog picked or bought.
  private quips = new Map<DogId, string>();
  private root: GameObjects.Container | undefined;
  private shakes = new Map<string, number>();
  private startButton:
    | { container: GameObjects.Container; down: GameObjects.Container; up: GameObjects.Container }
    | undefined;
  private views = new Map<string, TileView>();
  private walkerLine: WalkerLine = "firstVisit";

  constructor() {
    super(SCENE_KEYS.start);
  }

  create(): void {
    this.action = { kind: "none" };
    this.bursts = [];
    this.focus = null;
    this.hold = undefined;
    this.overlay = undefined;
    this.overlayPress = undefined;
    this.pending = new Set();
    this.pops = new Map();
    this.press = undefined;
    this.pressedTarget = undefined;
    this.quips = new Map();
    this.shakes = new Map();
    this.views = new Map();
    const { bankCents, lastLoadout, owned, stats } = profileSave(this);
    this.loadout = { dogs: [...lastLoadout.dogs], gear: lastLoadout.gear };
    const remembered = this.registry.get(LAST_VISIT_BANK_KEY) as Cents | undefined;
    const before = bankAtLastVisit(remembered, bankCents, stats.lastWalk);
    this.walkerLine = walkerLineKey(
      stats.lastWalk,
      newlyAffordable(gameData, owned, before, bankCents),
    );
    stopWakeLock();
    setRunOverride(this, null);

    this.drawGate();
    this.root = this.add.container(0, 0);
    this.overlayLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    this.render();

    listenOnePress(this, {
      down: (pointer) => {
        this.addBurst("fx-tap", pointer.x, pointer.y);
        if (this.overlay !== undefined) {
          this.overlayPress = { x: pointer.x, y: pointer.y };
          return;
        }
        this.pressedTarget = this.targetAt(pointer.x, pointer.y);
        const kind = this.pressedTarget?.kind;
        this.hold =
          kind === "dog" || kind === "gear"
            ? startHold({ x: pointer.x, y: pointer.y }, this.time.now)
            : undefined;
        this.press =
          this.pressedTarget === undefined
            ? undefined
            : { held: true, id: targetId(this.pressedTarget), startedMs: this.time.now };
      },
      move: (pointer) => {
        if (this.hold !== undefined && pointer.isDown) {
          this.hold = moveHold(this.hold, { x: pointer.x, y: pointer.y });
        }
      },
      up: (pointer, cancelled) => {
        const down = this.overlayPress;
        this.overlayPress = undefined;
        if (down !== undefined) {
          if (!cancelled) {
            this.releaseOnOverlay(down, pointer.x, pointer.y);
          }
          return;
        }
        const target = cancelled ? undefined : this.targetAt(pointer.x, pointer.y);
        const pressed = this.pressedTarget;
        const release = this.hold === undefined ? "tap" : releaseHold(this.hold, this.time.now);
        this.hold = undefined;
        this.pressedTarget = undefined;
        if (this.press !== undefined) {
          this.press.held = false;
        }
        if (
          target === undefined ||
          pressed === undefined ||
          targetId(target) !== targetId(pressed)
        ) {
          return;
        }
        if (release === "hold") {
          this.openDetail(pressed);
        } else if (release === "tap") {
          this.actAfterDip(target);
        }
      },
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => this.onKey(event.key));
    // Badges earned on launch: a scene can pause itself only once it is running.
    this.time.delayedCall(0, () => this.celebrate([]));
    // Settings can change reduced motion or mute, so the screen is drawn again.
    const onSettingsClosed = () => this.render();
    this.game.events.on(SETTINGS_CLOSED_EVENT, onSettingsClosed);
    // A tap made while another tap's act opened help, settings or stats over this screen is
    // dropped, so it cannot act once the screen resumes.
    const dropPending = () => {
      this.pending.forEach((timer) => timer.remove());
      this.pending.clear();
    };
    this.events.on("pause", dropPending);
    this.events.once("shutdown", () => {
      this.game.events.off(SETTINGS_CLOSED_EVENT, onSettingsClosed);
      this.events.off("pause", dropPending);
    });
  }

  private onKey(key: string): void {
    if (this.overlay !== undefined) {
      if (key === "Escape") {
        this.closeOverlay();
      } else if (isConfirmKey(key)) {
        const stats = this.overlay.kind === "logbook";
        this.closeOverlay();
        if (stats) {
          this.act({ kind: "stats" });
        }
      }
      return;
    }
    const direction = focusDirectionForKey(key);
    if (direction !== undefined) {
      const rows = focusRows();
      this.focus = moveFocus(
        rows.map((row) => row.length),
        direction,
        this.focus,
      );
      this.action = this.focusAction(rows[this.focus.row]?.[this.focus.column]?.target);
      this.render();
      return;
    }
    if (isConfirmKey(key)) {
      const focused =
        this.focus === null ? undefined : focusRows()[this.focus.row]?.[this.focus.column];
      const target = focused?.target ?? { kind: "start" };
      this.press = { held: false, id: targetId(target), startedMs: this.time.now };
      this.actAfterDip(target);
      return;
    }
    if (key === "?") {
      this.act({ kind: "help" });
    } else if (key === "s" || key === "S") {
      this.act({ kind: "settings" });
    } else if (key === "l" || key === "L") {
      this.act({ kind: "logbook" });
    } else if (isMuteKey(key)) {
      this.act({ kind: "mute" });
    }
  }

  private save(): SaveDocument {
    return profileSave(this);
  }

  // A focused dog or gear item in words, so a keyboard player has what a hold shows.
  private focusAction(target: Target | undefined): HomeAction {
    const { bankCents, owned } = this.save();
    if (target?.kind === "dog") {
      return { kind: "focus", text: dogInfo(gameData, owned, bankCents, target.dog) };
    }
    if (target?.kind === "gear") {
      return { kind: "focus", text: gearInfo(gameData, owned, bankCents, target.gear) };
    }
    return { kind: "none" };
  }

  private openDetail(target: Target): void {
    if (target.kind !== "dog" && target.kind !== "gear") {
      return;
    }
    this.press = undefined;
    this.overlay = { kind: "detail", rect: undefined, target };
    this.render();
  }

  private closeOverlay(): void {
    this.overlay = undefined;
    this.render();
  }

  // A tap while a panel is open: on the logbook's Stats button it opens Stats, outside the
  // panel it closes it, and inside it does nothing.
  private releaseOnOverlay(down: { x: number; y: number }, x: number, y: number): void {
    const overlay = this.overlay;
    if (overlay === undefined) {
      return;
    }
    const within = (rect: Rect | undefined) =>
      rect !== undefined && containsPoint(rect, down.x, down.y) && containsPoint(rect, x, y);
    if (overlay.kind === "logbook" && within(overlay.stats)) {
      this.closeOverlay();
      this.act({ kind: "stats" });
      return;
    }
    const outside = (px: number, py: number) =>
      overlay.rect === undefined || !containsPoint(overlay.rect, px, py);
    if (outside(down.x, down.y) && outside(x, y)) {
      this.closeOverlay();
    }
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
      [LOGBOOK_BUTTON, { kind: "logbook" }],
    ];
    const hit = fixed.find(([rect]) => containsPoint(rect, x, y));
    if (hit !== undefined) {
      return hit[1];
    }
    const forSale = nextDogSlot(gameData, this.save().owned.dogSlots) !== null;
    return forSale && containsPoint(SLOT_SIGN, x, y) ? { kind: "slot" } : undefined;
  }

  // A dog's owner says a parting line when it is picked or bought; it is drawn once a visit.
  private drawQuip(dog: DogId): void {
    this.quips.set(dog, partingSpeech(gameData, Math.random, Infinity, dog).join(" "));
  }

  // A tap's result, such as the selected state, shows once its press has dipped.
  private actAfterDip(target: Target): void {
    const press = this.press;
    const delay = press === undefined ? 0 : settleDelay(this.time.now, press.startedMs);
    if (delay === 0) {
      this.act(target);
      return;
    }
    const timer = this.time.delayedCall(delay, () => {
      this.pending.delete(timer);
      this.act(target);
    });
    this.pending.add(timer);
  }

  private act(target: Target): void {
    const id = targetId(target);
    const now = this.time.now;
    switch (target.kind) {
      case "dog":
      case "gear": {
        const { owned } = this.save();
        const tap =
          target.kind === "dog"
            ? tapDog(gameData, owned, target.dog, this.loadout)
            : tapGear(owned, target.gear, this.loadout);
        if (tap.kind === "buy") {
          this.purchase(id, tap.purchase);
        } else if (tap.kind === "full") {
          this.shakes.set(id, now);
          this.action = {
            kind: "notice",
            text: "The pack is full. Tap a picked dog to take it out.",
          };
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
        this.action = {
          kind: "notice",
          text: `Walking as ${gameData.walkers[target.walker].name}.`,
        };
        void updateProfile(this, (save) => ({ ...save, walker: target.walker }));
        this.render();
        return;
      case "mute": {
        const muted = !isMuted(this);
        setMuted(this, muted);
        this.action = { kind: "notice", text: muted ? "Sound off." : "Sound on." };
        this.render();
        return;
      }
      case "help":
        openHelp(this, SCENE_KEYS.start);
        return;
      case "logbook":
        this.overlay = { kind: "logbook", rect: undefined, stats: undefined };
        this.render();
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
      this.drawQuip(dog);
    }
    if (next.gear !== null && next.gear !== this.loadout.gear) {
      this.pops.set(`gear:${next.gear}`, now);
    }
    this.loadout = next;
    this.action = { kind: "loadout" };
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
      this.action =
        cost === null
          ? { kind: "none" }
          : { amount: cents(cost - save.bankCents), kind: "cantAfford", name };
      this.render();
      return;
    }
    this.pops.set(id, now);
    void purchaseInProfile(this, () => result.save);
    if (purchase.kind === "gear") {
      this.setLoadout({ ...this.loadout, gear: purchase.gear });
    }
    if (purchase.kind === "dog") {
      this.drawQuip(purchase.dog);
    }
    this.action = { kind: "bought", name, purchase };
    this.render();
    this.celebrate(purchase.kind === "dog" ? [purchase.dog] : []);
  }

  // Badges earned on launch or by a purchase burst in over the home screen, with the owners
  // of the dogs just bought or picked cheering.
  private celebrate(owners: readonly DogId[]): void {
    const achievements = takeCelebrations(this);
    if (achievements.length === 0) {
      return;
    }
    const data: CelebrationSceneData = {
      achievements,
      owners: [...new Set([...owners, ...this.loadout.dogs])],
      resume: SCENE_KEYS.start,
    };
    this.scene.pause();
    this.scene.launch(SCENE_KEYS.celebration, data);
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
      this.action = { kind: "notice", text: "Pick a dog to walk first." };
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
    if (this.hold !== undefined) {
      const { fire, press } = tickHold(this.hold, now);
      this.hold = press;
      if (fire && this.pressedTarget !== undefined) {
        this.openDetail(this.pressedTarget);
      }
    }
    const reduced = currentSettings(this).reducedMotion;
    const pressed = this.press;
    const dip = (id: string) =>
      pressed?.id === id ? pressDip(pressed.held, now, pressed.startedMs) : 0;
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
    this.registry.set(LAST_VISIT_BANK_KEY, save.bankCents);
    const g = this.graphics(root);
    this.drawTopBar(root, g, save);
    this.drawPackAtGate(root, g, save);
    this.drawSlotSign(root, save);
    this.drawWalkerPicker(root, save);
    this.drawDogTiles(root, save);
    this.drawGear(root, save);
    this.drawInfo(root);
    this.drawStartButton(root);
    this.drawFocus(root);
    this.drawOverlay(save);
  }

  // Whether the bank covers a locked item: it then wears the gold outline.
  private affordable(save: SaveDocument, purchase: Purchase): boolean {
    return isAffordable(gameData, save.owned, save.bankCents, purchase);
  }

  // The detail card or logbook over everything else, recording its rect for taps.
  private drawOverlay(save: SaveDocument): void {
    const layer = this.overlayLayer;
    if (layer === undefined) {
      return;
    }
    layer.removeAll(true);
    const overlay = this.overlay;
    if (overlay === undefined) {
      return;
    }
    if (overlay.kind === "logbook") {
      const panel = drawLogbookPanel(this, layer, logbookOf(gameData, save.stats));
      this.overlay = { ...overlay, rect: panel.panel, stats: panel.stats };
      return;
    }
    const { target } = overlay;
    const card =
      target.kind === "dog"
        ? dogDetail(gameData, save.owned, save.bankCents, save.stats, target.dog)
        : gearDetail(gameData, save.owned, save.bankCents, this.loadout, target.gear);
    const picture: DetailPicture =
      target.kind === "dog"
        ? { key: dogPortraitKey(gameData, target.dog), scale: 1 }
        : { key: gearIconKey(target.gear), scale: 2 };
    const rect = drawDetailCard(this, layer, card, picture, target.kind);
    this.overlay = { ...overlay, rect };
  }

  // A container for one tappable tile, registered for its feedback.
  private tileView(root: GameObjects.Container, id: string, lift: number): TileView {
    const container = this.add.container(0, 0);
    root.add(container);
    const view: TileView = { container, lift };
    this.views.set(id, view);
    return view;
  }

  // A tile in the selected-state style, registered for its feedback.
  private selectTile(
    root: GameObjects.Container,
    id: string,
    rect: Rect,
    options: Omit<SelectTileOptions, "reducedMotion">,
  ): { content: GameObjects.Container; look: SelectLook; view: TileView } {
    const reducedMotion = currentSettings(this).reducedMotion;
    const tile: SelectTile = addSelectTile(this, root, rect, { ...options, reducedMotion });
    const view: TileView = { container: tile.container, lift: tile.lift };
    if (tile.badge !== undefined) {
      view.badge = { image: tile.badge, y: tile.badge.y };
    }
    this.views.set(id, view);
    return { content: tile.content, look: tile.look, view };
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
    const right = LOGBOOK_BUTTON.x - GAP;
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
    this.iconButton(root, "logbook", LOGBOOK_ICON, (x, y) => {
      const icon = imageIcon(this, "icon-logbook", x, y);
      return icon.length > 0
        ? icon
        : [addPixelText(this, x + 8, y + 4, "L", { color: PALETTE.plum, originX: 0.5 })];
    });
    this.iconButton(root, "settings", SETTINGS_ICON, (x, y) => {
      const icon = imageIcon(this, "icon-settings", x, y);
      return icon.length > 0 ? icon : cogIcon(this, x, y);
    });
    // Help and sound sit in the gate scene's top corners, where the art places them.
    this.iconButton(root, "help", HELP_ICON, (x, y) => imageIcon(this, "icon-help", x, y));
    this.iconButton(root, "mute", MUTE_ICON, (x, y) => soundIcon(this, !isMuted(this), x, y));
  }

  // The starter owners waiting at the gate until the first walk; a picked dog has gone to the
  // walker and leaves its owner standing alone.
  private drawPorch(
    root: GameObjects.Container,
    g: GameObjects.Graphics,
    save: SaveDocument,
    reduced: boolean,
  ): void {
    const waiting = porchOwners(gameData, save.stats, this.loadout.dogs).flatMap((owner) => {
      const at = PORCH_SPOTS[owner.dog];
      return at === undefined ? [] : [{ ...owner, at }];
    });
    // Owners first, then the dogs in front of them.
    for (const { at, dog } of waiting) {
      drawShadow(g, PALETTE.darkGreen, at.x, at.footY, 20);
      root.add(addOwnerFigure(this, gameData, reduced, dog, at, ["idle"]));
    }
    for (const { at, dog } of waiting.filter(({ withDog }) => withDog)) {
      const key = dogSpriteKey(gameData, dog);
      const x = at.x + PORCH_DOG_OFFSET.dx;
      const footY = at.footY + PORCH_DOG_OFFSET.footDy;
      drawShadow(g, PALETTE.darkGreen, x, footY, spriteMetrics(key).opaqueWidth);
      const sprite = addStandingSprite(this, key, x, footY);
      showTag(reduced, sprite, key, "idle");
      root.add(sprite);
    }
  }

  private drawPackAtGate(
    root: GameObjects.Container,
    g: GameObjects.Graphics,
    save: SaveDocument,
  ): void {
    const { footY, x } = WALKER_AT_GATE;
    const reduced = currentSettings(this).reducedMotion;
    this.drawPorch(root, g, save, reduced);
    const walkerKey = walkerSpriteKey(this, save.walker);
    const placements = GATE_SPOTS.slice(0, this.loadout.dogs.length);
    const groundColor = (atX: number) =>
      atX >= PATH.x && atX < PATH.x + PATH.width ? PALETTE.brown : PALETTE.darkGreen;
    const dogs = this.loadout.dogs.map((dog, i) => {
      const { dx, footDy } = itemAt(placements, i);
      return { dog, dx, footY: footY + footDy, key: dogSpriteKey(gameData, dog) };
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

    const state = { action: this.action, loadout: this.loadout };
    const said = bubbleLine(gameData.homeText, this.walkerLine, state, this.quips);
    const lines = wrapWords(SPEECH_CHARS, said).slice(0, SPEECH_LINES);
    const top = GATE.y + 6;
    const bubble = this.graphics(root);
    const labels = lines.map((line, i) =>
      this.text(root, x, top + 4 + i * SPEECH_LINE_HEIGHT, line, PALETTE.plum, { originX: 0.5 }),
    );
    const width = Math.ceil(Math.max(...labels.map((label) => label.width))) + 10;
    const height = lines.length * SPEECH_LINE_HEIGHT + 4;
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
    const lines = slotSignLines(gameData, save.owned, save.bankCents);
    if (lines === null) {
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
    drawSlotSign(this, view.container, SLOT_SIGN, lines);
    if (this.affordable(save, { kind: "dogSlot" })) {
      addAffordFrame(this, view.container, SLOT_SIGN, currentSettings(this).reducedMotion);
    }
  }

  private addLock(parent: GameObjects.Container, x: number, y: number): void {
    if (this.textures.exists("icon-lock")) {
      parent.add(this.add.image(x, y, "icon-lock").setOrigin(0));
    }
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

  private drawDogTiles(root: GameObjects.Container, save: SaveDocument): void {
    const { owned } = save;
    const reduced = currentSettings(this).reducedMotion;
    const capacity = packCapacity(gameData, owned);
    const picked = this.loadout.dogs.length;
    this.stepPlate(root, { x: 4, y: DOGS_STEP_Y }, "stepDogs", picked > 0 ? "tick" : "2");
    const count = packCountLine(gameData, owned, this.loadout);
    this.text(root, 356, DOGS_STEP_Y + 7, count, PALETTE.cream, { originX: 1 });
    const full = choiceFull(picked, capacity);
    const tiles = dogTiles();
    rosterOrder().forEach((id, i) => {
      const rect = itemAt(tiles, i);
      const { width, x, y } = rect;
      const dog = gameData.dogs[id];
      const isOwned = owned.dogs.includes(id);
      const order = this.loadout.dogs.indexOf(id);
      const { content, look, view } = this.selectTile(root, `dog:${id}`, rect, {
        badge: String(order + 1),
        edge: true,
        full,
        rest: isOwned ? "cream" : "tan",
        selected: order >= 0,
      });
      const ink = PALETTE[look.text];
      fillRect(this.graphics(content), PALETTE[look.box], {
        height: 34,
        width: 34,
        x: x + 3,
        y: y + 5,
      });
      const face = this.add.sprite(x + 4, y + 6, dogFaceKey(gameData, id)).setOrigin(0);
      showTag(reduced, face, dogFaceKey(gameData, id), isOwned ? "happy" : "neutral");
      content.add(face);
      view.face = { object: face, y: y + 6 };

      this.text(content, x + 41, y + 2, dog.name, ink);
      // The trait and the owner's temperament as icons; the info line says them in words.
      [traitIconKey(dog.trait), temperamentIconKey(dog.owner.temperament)].forEach((key, n) => {
        if (this.textures.exists(key)) {
          content.add(this.add.image(x + 40 + n * 18, y + 13, key).setOrigin(0));
        }
      });
      const price = purchasePrice(gameData, owned, { dog: id, kind: "dog" });
      if (price === null) {
        const zoneFee = dollarText(packFeePerZone(gameData, { dogs: [id], gear: null }));
        this.text(content, x + 41, y + 31, `${zoneFee}/zone`, ink);
      } else {
        this.priceBadge(content, x + 44, y + 31, price, 0);
        if (price > save.bankCents) {
          this.addLock(content, x + width - 19, y + 25);
        }
      }
      this.affordFrame(view, rect, look, save, { dog: id, kind: "dog" });
    });
  }

  // The gold outline on an unselected item the bank covers; ui-select wins over it.
  private affordFrame(
    view: TileView,
    rect: Rect,
    look: SelectLook,
    save: SaveDocument,
    purchase: Purchase,
  ): void {
    if (!look.selected && this.affordable(save, purchase)) {
      addAffordFrame(this, view.container, rect, currentSettings(this).reducedMotion);
    }
  }

  // A step's heading plate, its number turning to a tick once the step is done.
  private stepPlate(
    root: GameObjects.Container,
    at: { x: number; y: number },
    key: "stepDogs" | "stepGear" | "stepWalker",
    badge: string,
  ): number {
    return drawStepPlate(this, root, at, { badge, ...stepHeading(gameData.homeText[key]) });
  }

  private drawGear(root: GameObjects.Container, save: SaveDocument): void {
    const { owned } = save;
    const equipped = this.loadout.gear;
    this.stepPlate(root, { x: 4, y: GEAR_STEP_Y }, "stepGear", equipped === null ? "3" : "tick");
    const slots = gearSlots();
    const full = choiceFull(equipped === null ? 0 : 1, 1);
    gearIds().forEach((id, i) => {
      const rect = itemAt(slots, i);
      const { width, x, y } = rect;
      const isOwned = owned.gear.includes(id);
      const { content, look, view } = this.selectTile(root, `gear:${id}`, rect, {
        badge: "tick",
        edge: true,
        full,
        rest: isOwned ? "cream" : "tan",
        selected: equipped === id,
      });
      fillRect(this.graphics(content), PALETTE[look.box], {
        height: 34,
        width: 34,
        x: x + 15,
        y: y + 2,
      });
      const icon = this.addGearIcon(content, id, x + 16, y + 3, 1);
      if (icon !== undefined) {
        view.face = { object: icon, y: y + 3 };
      }
      // A locked item's price tag hangs over the foot of its icon.
      const price = purchasePrice(gameData, owned, { gear: id, kind: "gear" });
      if (price !== null) {
        this.priceBadge(content, x + width / 2, y + 28, price, 0.5);
        if (price > save.bankCents) {
          this.addLock(content, x + width - 18, y + 2);
        }
      }
      this.affordFrame(view, rect, look, save, { gear: id, kind: "gear" });
    });
  }

  // Under the steps: the last action's message, else the hint.
  private infoText(): string {
    const message = messageLine(gameData.homeText, this.action);
    return storageState(this) === "unavailable" ? `Progress won't be saved. ${message}` : message;
  }

  // One line: a message longer than it is cut short.
  private drawInfo(root: GameObjects.Container): void {
    const [first = "", ...rest] = wrapWords(INFO_CHARS, this.infoText());
    const cut = `${first.slice(0, INFO_CHARS - 3)}...`;
    const label = this.text(root, 180, INFO.y, rest.length > 0 ? cut : first, PALETTE.cream, {
      originX: 0.5,
    });
    fitText(label, INFO.maxWidth, [label.text, cut]);
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

  // One portrait per preset walker; the chosen one is selected, so the others are always
  // a full choice's darker step.
  private drawWalkerPicker(root: GameObjects.Container, save: SaveDocument): void {
    const chosen = save.walker;
    const reduced = currentSettings(this).reducedMotion;
    const tiles = walkerTiles();
    const plateY = WALKER_ORIGIN.y + (WALKER_TILES.cellHeight - STEP_PLATE_HEIGHT) / 2;
    // A walker is always chosen, so this step is always done.
    this.stepPlate(root, { x: 4, y: plateY }, "stepWalker", "tick");
    walkerIds().forEach((id, i) => {
      const rect = itemAt(tiles, i);
      const { content, look, view } = this.selectTile(root, `walker:${id}`, rect, {
        badge: "tick",
        edge: true,
        full: choiceFull(1, 1),
        rest: "tan",
        selected: id === chosen,
      });
      const portrait = gameData.walkers[id].portraitKey;
      const faceX = rect.x + (rect.width - 32) / 2;
      const faceY = rect.y + (rect.height - 32) / 2;
      if (this.textures.exists(portrait)) {
        const face = this.add.sprite(faceX, faceY, portrait).setOrigin(0);
        showTag(reduced, face, portrait, id === chosen ? "happy" : "neutral");
        content.add(face);
        view.face = { object: face, y: faceY };
      } else {
        const initial = gameData.walkers[id].name.charAt(0);
        this.text(content, rect.x + 22, rect.y + 16, initial, PALETTE[look.text], {
          font: "title",
          originX: 0.5,
        });
      }
    });
  }

  // Start walk sinks into its lip when pressed: drawn twice, raised and pressed, and the
  // frame shows one. Ready, it is the green go button and sums up the pack.
  private drawStartButton(root: GameObjects.Container): void {
    const { height, width, x, y } = START_BUTTON;
    const ready = this.loadout.dogs.length > 0;
    const container = this.add.container(0, 0);
    root.add(container);
    const variant = (down: boolean) => {
      const group = this.add.container(0, 0);
      container.add(group);
      const drop = down ? FEEDBACK.buttonPressPx : 0;
      const tag = ready ? (down ? "go-pressed" : "go") : "disabled";
      const slice = addNineSlice(this, "ui-button", START_BUTTON, tag);
      if (slice !== undefined) {
        group.add(slice);
      } else {
        const g = this.graphics(group);
        if (!down) {
          const lip = ready ? PALETTE.forest : PALETTE.darkSlate;
          fillRect(g, lip, { height: height - 4, width, x, y: y + 4 });
        }
        fillRect(g, ready ? PALETTE.green : PALETTE.slate, {
          height: height - 4,
          width,
          x,
          y: y + drop,
        });
      }
      const label = ready ? startWalkLine(gameData, this.loadout) : "Pick a dog";
      this.text(
        group,
        180,
        y + (ready ? 15 : 12) + drop,
        label,
        ready ? PALETTE.ink : PALETTE.white,
        {
          font: "title",
          originX: 0.5,
          scale: ready ? TEXT_SCALE : 3,
        },
      );
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
    drawFocusRing(this.graphics(root), FOCUS_OUTSET, rect);
  }
}
