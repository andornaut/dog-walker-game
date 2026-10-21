import { type GameObjects, Scene, type Time } from "phaser";

import { itemAt } from "../arrays";
import { animationKey } from "../assets/asepriteAnimations";
import { MONEY_ICON_KEY, quirkIconKey, temperamentIconKey, traitIconKey } from "../assets/iconKeys";
import {
  dogFaceKey,
  dogPortraitKey,
  dogSpriteKey,
  gearIconKey,
  walkerPortraitKey,
} from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DogId, GearId, Size, TraitId, WalkerId } from "../data/types";
import { clearRunOverrides } from "../dev/pageRunSetup";
import { startWalkOpensHelp } from "../help/helpSeen";
import { bankAtLastVisit, newlyAffordable } from "../home/afford";
import { bubbleRect } from "../home/bubbleRect";
import { type DetailCard, dogDetail, gearDetail, walkerDetail } from "../home/detail";
import {
  badgePopOffset,
  bobOffset,
  effectFrame,
  FEEDBACK,
  hopOffset,
  pressDip,
  settleDelay,
  shakeOffset,
  shopBobOffset,
  shopGlintFrame,
} from "../home/feedback";
import { type Focus, focusDirectionForKey, moveFocus } from "../home/focus";
import {
  dogFeeText,
  dogInfo,
  dollarAmountText,
  dollarText,
  gearInfo,
  type HomeLoadout,
  logbookOf,
  packCapacity,
  packOf,
  partingSpeech,
  type Purchase,
  purchasePrice,
  tapDog,
  tapGear,
} from "../home/home";
import { HOME_LAYOUT, sectionFill } from "../home/homeLayout";
import { bubbleSpeech, type HomeAction, type WalkerLine, walkerLineKey } from "../home/homeLines";
import { HOME_TEXT_FIELDS as FIELDS, homeLine } from "../home/homeText";
import {
  buttonState,
  type ItemTile,
  itemTile,
  itemTileState,
  type TileState,
} from "../home/interaction";
import { porchOwners } from "../home/porch";
import {
  homeSections,
  type Section,
  type SectionId,
  type Sections,
  type SectionState,
  startReady,
} from "../home/sections";
import { DISABLED_COLORS, type SelectLook } from "../home/selection";
import { shopAffordable, type ShopTab } from "../home/shop";
import type { StatsTab } from "../home/statsLayout";
import { homeSticker, sameItem, type Sticker, type TileItem } from "../home/sticker";
import { tapWalker, walkerOrder, walkerTile } from "../home/walkers";
import { downTail } from "../hud/moments";
import { STRIP, stripIconFallback, stripIconKey, walkerStripItems } from "../hud/stateStrip";
import { HOLD, type HoldPress, moveHold, releaseHold, startHold, tickHold } from "../input/hold";
import { isConfirmKey, isMuteKey, isPauseKey } from "../input/keyBindings";
import { screenArea } from "../input/outsideTap";
import { closeControl } from "../layout/closeControl";
import { gridRects, rectIndexAt } from "../layout/grid";
import { COLLAR_HEIGHT, leashHand, type PackPlacement } from "../layout/packFormation";
import { containsPoint, insetRect, type Rect } from "../layout/rect";
import { startWakeLock, stopWakeLock } from "../pwa";
import { type Cents, cents } from "../rules/units";
import type { SaveDocument } from "../save/schema";
import { walksPlayed } from "../save/stats";
import { fillLine, wrapWords } from "../text/lines";
import type { CelebrationSceneData } from "./CelebrationScene";
import {
  drawFocusRing,
  drawFramedRect,
  drawPixelLine,
  drawRing,
  drawShadow,
  fillRect,
} from "./draw";
import { HELP_CLOSED_EVENT } from "./HelpScene";
import { openHelp } from "./helpScreen";
import {
  addAffordFrame,
  type DetailPicture,
  drawDetailCard,
  drawLogbookPanel,
  type LogbookPress,
} from "./homePanels";
import {
  addLock,
  addPlate,
  drawPetShopFallback,
  itemArtKey,
  lockedPlateColors,
  SHOP_ART,
} from "./itemArt";
import { listenOnePress } from "./onePress";
import { listenOutsideTap, onBackPressed, openOverlay } from "./overlay";
import { addOwnerFigure } from "./ownerFigure";
import { PALETTE } from "./palette";
import { addPixelText, type FontRole } from "./pixelText";
import {
  currentSettings,
  isMuted,
  profileSave,
  setRunOverride,
  storageState,
  takeCelebrations,
  toggleMuted,
  updateProfile,
  walkerSpriteKey,
} from "./profileStore";
import type { RunSceneData } from "./RunScene";
import { SCENE_KEYS } from "./sceneKeys";
import { SETTINGS_CLOSED_EVENT, type SettingsSceneData } from "./SettingsScene";
import {
  SHOP_CHANGED_EVENT,
  SHOP_CLOSED_EVENT,
  type ShopClosed,
  type ShopSceneData,
} from "./ShopScene";
import { addStandingSprite, spriteMetrics } from "./sprites";
import type { StatsSceneData } from "./StatsScene";
import {
  addIconButton,
  addNineSlice,
  addSelectTile,
  addTagImage,
  addTileSprite,
  cogIcon,
  drawDisabledButton,
  fitText,
  type IconButton,
  imageIcon,
  type SelectTile,
  type SelectTileOptions,
  showTag,
  soundIcon,
  tagFrame,
  TEXT_SCALE,
  tileTextureKey,
} from "./uiKit";

const SCREEN = SCREEN_CONFIG;
const GATE = HOME_LAYOUT.gate;
const PATH = HOME_LAYOUT.path;
const WALKER_AT_GATE = HOME_LAYOUT.walkerAtGate;
const GATE_SPOTS: readonly PackPlacement[] = HOME_LAYOUT.gateSpots;
const PORCH_SPOTS: Readonly<Partial<Record<DogId, { footY: number; x: number }>>> =
  HOME_LAYOUT.porchSpots;
const PORCH_DOG_OFFSET = HOME_LAYOUT.porchDogOffset;
const GAP = HOME_LAYOUT.gap;
const TOP_BAR = HOME_LAYOUT.topBar;
const HELP_BUTTON: Rect = HOME_LAYOUT.help.hit;
const HELP_ICON = HOME_LAYOUT.help.icon;
const MUTE_BUTTON: Rect = HOME_LAYOUT.mute.hit;
const MUTE_ICON = HOME_LAYOUT.mute.icon;
const SETTINGS_BUTTON: Rect = HOME_LAYOUT.settings.hit;
const SETTINGS_ICON = HOME_LAYOUT.settings.icon;
const LOGBOOK_BUTTON: Rect = HOME_LAYOUT.logbook.hit;
const LOGBOOK_ICON = HOME_LAYOUT.logbook.icon;
const PET_SHOP: Rect = HOME_LAYOUT.petShop;
const PET_SHOP_BOARD: Rect = HOME_LAYOUT.petShop.board;
const POCKET_LINING = HOME_LAYOUT.pocketLining;
const SECTION_FILL_KEYS = HOME_LAYOUT.sectionFillKeys;
const POCKET = HOME_LAYOUT.pocket;
const LOGO = { ...HOME_LAYOUT.logo, key: "logo" };
const SECTION_RECTS: Readonly<Record<SectionId, Rect>> = HOME_LAYOUT.sections;
const SECTION_FRAME = HOME_LAYOUT.sectionFrame;
const BAND_TEXT = HOME_LAYOUT.bandText;
const WALKER_TILES = HOME_LAYOUT.walkerTiles;
const WALKER_ORIGIN = HOME_LAYOUT.walkerOrigin;
const WALKER_TILE = HOME_LAYOUT.walkerTile;
const DOG_TILES = HOME_LAYOUT.dogTiles;
const DOG_ORIGIN = HOME_LAYOUT.dogOrigin;
const DOG_TILE_INSET = HOME_LAYOUT.dogTileInset;
const TILE_SELECT_OUTSET = HOME_LAYOUT.tileSelectOutset;
const START_BUTTON: Rect = HOME_LAYOUT.startButton;
const START_LABEL = HOME_LAYOUT.startLabel;
const GEAR_BADGE: Rect = HOME_LAYOUT.gearBadge;
// The keyboard ring sits outside the ui-select frame.
const FOCUS_OUTSET = 5;
const SIZE_ORDER: readonly Size[] = ["small", "medium", "big"];
const TRAIT_ORDER: readonly TraitId[] = ["fancy", "foodDriven", "chaser"];

// The widest line the speech bubble holds, in characters, and how many lines it shows.
const SPEECH_CHARS = 30;
const SPEECH_LINES = 4;
const SPEECH_LINE_HEIGHT = 15;
// ui-sticker: its word is centred on x 28 with its capitals from row 12, at most 36px wide.
const STICKER = {
  height: 28,
  key: "ui-sticker",
  maxWordWidth: 36,
  width: 56,
  wordX: 28,
  wordY: 12,
};

function walkerIds(): WalkerId[] {
  return walkerOrder(gameData);
}

const SECTION_IDS: readonly SectionId[] = ["walker", "dogs", "pocket"];

function gearIds(): GearId[] {
  return Object.keys(gameData.shopGear) as GearId[];
}

type DetailTarget =
  | { dog: DogId; kind: "dog" }
  | { gear: GearId; kind: "gear" }
  | { kind: "walker"; walker: WalkerId };

type Target =
  | { dog: DogId; kind: "dog" }
  | { gear: GearId; kind: "gear" }
  | { kind: "help" }
  | { kind: "logbook" }
  | { kind: "mute" }
  | { kind: "petShop" }
  | { kind: "settings" }
  | { kind: "start" }
  | { kind: "stats"; tab?: StatsTab }
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

// A dog tile as drawn, inside its hit area.
function dogFace(hit: Rect): Rect {
  return { ...hit, height: hit.height - DOG_TILE_INSET * 2, y: hit.y + DOG_TILE_INSET };
}

// The Pocket section's cells, in shop order; each draws its tile inset inside.
function gearSlots(): Rect[] {
  return gridRects(POCKET.cells, gearIds().length, POCKET.origin);
}

function pocketTile(cell: Rect): Rect {
  return insetRect(POCKET.tileInset, cell);
}

function walkerTiles(): Rect[] {
  return gridRects(WALKER_TILES, walkerIds().length, WALKER_ORIGIN);
}

interface Focusable {
  rect: Rect;
  target: Target;
}

// The keyboard's rows, top to bottom as the screen shows them: the Pet shop, the walkers,
// the dog rows, the Pocket and Start walk.
function focusRows(): Focusable[][] {
  const walkers = walkerTiles();
  const rows: Focusable[][] = [
    [{ rect: PET_SHOP, target: { kind: "petShop" } }],
    walkerIds().map((walker, i): Focusable => ({
      rect: itemAt(walkers, i),
      target: { kind: "walker", walker },
    })),
  ];
  const tiles = dogTiles();
  const dogs = rosterOrder().map((dog, i): Focusable => ({
    rect: dogFace(itemAt(tiles, i)),
    target: { dog, kind: "dog" },
  }));
  for (let i = 0; i < dogs.length; i += DOG_TILES.columns) {
    rows.push(dogs.slice(i, i + DOG_TILES.columns));
  }
  const slots = gearSlots();
  rows.push(
    gearIds().map((gear, i): Focusable => ({
      rect: pocketTile(itemAt(slots, i)),
      target: { gear, kind: "gear" },
    })),
  );
  rows.push([{ rect: START_BUTTON, target: { kind: "start" } }]);
  return rows;
}

// What is open over the screen: a held tile's detail card, or the logbook. rect is the
// panel, so a tap outside it or on its close control closes it.
type Overlay =
  | {
      kind: "detail";
      rect: Rect | undefined;
      target: DetailTarget;
    }
  | {
      badges: Rect | undefined;
      kind: "logbook";
      rect: Rect | undefined;
      stats: Rect | undefined;
    };

// A tile that reacts to taps: its container moves for the dip, lift and shake, its face hops,
// and its badge pops.
interface TileView {
  badge?: { image: GameObjects.Image; y: number };
  container: GameObjects.Container;
  face?: { object: GameObjects.Image | GameObjects.Sprite; y: number };
  // The Pet shop's glint frames, shown in place of its normal face while one plays.
  glint?: { frames: readonly (string | number)[]; image: GameObjects.Image };
  // An icon button shows its pressed face rather than dipping.
  iconButton?: IconButton;
  lift: number;
  // The pop timer that raises the whole tile for a moment, for the gear badge at the gate.
  rise?: string;
  // The Pet shop's normal face, which the glint covers.
  shopNormal?: GameObjects.Image;
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

// The screen before a walk: the bank, the Logbook and best walk at the top bar's left and
// help, sound and settings at its right; the walker and pack at the gate beside the Pet
// shop; the Walker, Dogs and Pocket sections and Start walk. Buying happens only in
// the shop: tapping the building opens it, and tapping a locked dog, gear item or the Dogs
// band's padlock opens it on that item. Holding a dog or gear tile opens its detail card.
// The arrow keys move a focus ring, Enter or Space picks, Escape, P or back closes a card, ?
// opens help, S settings, L the logbook and M mutes.
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
  // Whether the new sticker has popped this visit, so a redraw shows it without popping again.
  private stickerPopped = false;
  private startButton:
    | {
        container: GameObjects.Container;
        down: GameObjects.Container;
        ready: boolean;
        up: GameObjects.Container;
      }
    | undefined;
  private views = new Map<string, TileView>();
  // The bank at the last visit, against which a tile the bank now covers is new.
  private visitBank: Cents = cents(0);
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
    this.stickerPopped = false;
    this.views = new Map();
    const { bankCents, lastLoadout, owned, stats } = profileSave(this);
    this.loadout = { dogs: [...lastLoadout.dogs], gear: lastLoadout.gear };
    const remembered = this.registry.get(LAST_VISIT_BANK_KEY) as Cents | undefined;
    const before = bankAtLastVisit(remembered, bankCents, stats.lastWalk);
    this.visitBank = before;
    this.walkerLine = walkerLineKey(
      stats.lastWalk,
      newlyAffordable(gameData, owned, before, bankCents),
      walksPlayed(stats),
    );
    stopWakeLock();
    setRunOverride(this, null);
    clearRunOverrides();

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
          if (this.overlayPressed() !== undefined) {
            this.render();
          }
          return;
        }
        this.pressedTarget = this.targetAt(pointer.x, pointer.y);
        const kind = this.pressedTarget?.kind;
        this.hold =
          kind === "dog" || kind === "gear" || kind === "walker"
            ? startHold(HOLD, { x: pointer.x, y: pointer.y }, this.time.now)
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
        const controlDown = this.overlayPressed() !== undefined;
        this.overlayPress = undefined;
        if (down !== undefined) {
          if (!cancelled) {
            this.releaseOnOverlay(down, pointer.x, pointer.y);
          }
          // A press on a control that ended elsewhere lifts it again.
          if (controlDown && this.overlay !== undefined) {
            this.render();
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
    // A tap outside an open panel, on the screen or the page beside the game, closes it.
    listenOutsideTap(
      this,
      () => {
        const rect = this.overlay?.rect;
        return rect === undefined ? undefined : screenArea(SCREEN, [rect]);
      },
      () => this.closeOverlay(),
    );
    // Back closes an open panel, as Escape does.
    onBackPressed(this, () => {
      if (this.overlay !== undefined) {
        this.closeOverlay();
      }
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => this.onKey(event.key));
    // Badges earned on launch: a scene can pause itself only once it is running.
    this.time.delayedCall(0, () => this.celebrate([]));
    // Settings can change reduced motion or mute, so the screen is drawn again.
    const onSettingsClosed = () => this.render();
    this.game.events.on(SETTINGS_CLOSED_EVENT, onSettingsClosed);
    // The shop draws under the top bar, so the bank there follows each purchase; on close
    // the walker says the shop's last purchase or refusal.
    const onShopChanged = () => this.render();
    const onShopClosed = (closed: ShopClosed) => this.shopClosed(closed);
    this.game.events.on(SHOP_CHANGED_EVENT, onShopChanged);
    this.game.events.on(SHOP_CLOSED_EVENT, onShopClosed);
    // A tap made while another tap's act opened help, settings or stats over this screen is
    // dropped, so it cannot act once the screen resumes.
    const dropPending = () => {
      this.pending.forEach((timer) => timer.remove());
      this.pending.clear();
    };
    this.events.on("pause", dropPending);
    this.events.once("shutdown", () => {
      this.game.events.off(SETTINGS_CLOSED_EVENT, onSettingsClosed);
      this.game.events.off(SHOP_CHANGED_EVENT, onShopChanged);
      this.game.events.off(SHOP_CLOSED_EVENT, onShopClosed);
      this.events.off("pause", dropPending);
    });
  }

  private onKey(key: string): void {
    if (this.overlay !== undefined) {
      if (isPauseKey(key)) {
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

  // A focused dog or gear item in words, so a keyboard player has what a hold shows, and a
  // walker's pace and style or goal, as a tap says them.
  private focusAction(target: Target | undefined): HomeAction {
    const { bankCents, owned } = this.save();
    if (target?.kind === "dog") {
      return { kind: "focus", text: dogInfo(gameData, owned, bankCents, target.dog) };
    }
    if (target?.kind === "gear") {
      return { kind: "focus", text: gearInfo(gameData, owned, bankCents, target.gear) };
    }
    if (target?.kind === "walker") {
      // With none picked, a tap never drops, so the focus always has words.
      const tap = tapWalker(gameData, owned, null, target.walker);
      return tap.kind === "drop" ? { kind: "none" } : { kind: "focus", text: tap.text };
    }
    return { kind: "none" };
  }

  private openDetail(target: Target): void {
    if (target.kind !== "dog" && target.kind !== "gear" && target.kind !== "walker") {
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

  // The control on an open panel the press under way started on: its close control, or the
  // logbook's Stats or Badges button.
  private overlayPressed(): LogbookPress | undefined {
    const overlay = this.overlay;
    const down = this.overlayPress;
    if (overlay?.rect === undefined || down === undefined) {
      return undefined;
    }
    const on = (rect: Rect | undefined) =>
      rect !== undefined && containsPoint(rect, down.x, down.y);
    if (on(closeControl(overlay.rect).hit)) {
      return "close";
    }
    if (overlay.kind !== "logbook") {
      return undefined;
    }
    return on(overlay.stats) ? "stats" : on(overlay.badges) ? "badges" : undefined;
  }

  // A tap while a panel is open: on its close control it closes the panel, as does one anywhere
  // on a detail card, which has no other controls, as on the shop and Stats; on the logbook's
  // Stats button it opens Stats. A tap outside it is listenOutsideTap's.
  private releaseOnOverlay(down: { x: number; y: number }, x: number, y: number): void {
    const overlay = this.overlay;
    if (overlay === undefined) {
      return;
    }
    const within = (rect: Rect | undefined) =>
      rect !== undefined && containsPoint(rect, down.x, down.y) && containsPoint(rect, x, y);
    const { rect } = overlay;
    if (rect !== undefined && within(overlay.kind === "detail" ? rect : closeControl(rect).hit)) {
      this.closeOverlay();
      return;
    }
    if (overlay.kind === "logbook" && within(overlay.stats)) {
      this.closeOverlay();
      this.act({ kind: "stats" });
      return;
    }
    if (overlay.kind === "logbook" && within(overlay.badges)) {
      this.closeOverlay();
      this.act({ kind: "stats", tab: "badges" });
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
      [PET_SHOP, { kind: "petShop" }],
    ];
    const hit = fixed.find(([rect]) => containsPoint(rect, x, y));
    if (hit !== undefined) {
      return hit[1];
    }
    return undefined;
  }

  // The shop over everything below the top bar, on a tab or framing the item tapped.
  private openShop(open: { focus?: Purchase; tab?: ShopTab }): void {
    const data: ShopSceneData = { ...open, resume: SCENE_KEYS.start };
    openOverlay(this, SCENE_KEYS.shop, data);
  }

  // The shop's last purchase or refusal goes in the walker's bubble, a bought dog's owner
  // saying a parting line.
  private shopClosed(closed: ShopClosed): void {
    const { action } = closed;
    if (action.kind === "bought" && action.purchase.kind === "dog") {
      this.pops.set(`dog:${action.purchase.dog}`, this.time.now);
      this.drawQuip(action.purchase.dog);
    }
    this.action = action;
    this.render();
  }

  // A dog's owner says a parting line when it is picked or bought; it is drawn once a visit.
  private drawQuip(dog: DogId): void {
    this.quips.set(dog, partingSpeech(gameData, Math.random, dog));
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
        if (tap.kind === "shop") {
          this.openShop({ focus: tap.purchase });
        } else if (tap.kind === "full") {
          this.shakes.set(id, now);
          this.action = {
            kind: "notice",
            text: gameData.homeText.noticePackFull,
          };
          this.render();
        } else {
          this.setLoadout(tap.loadout);
        }
        return;
      }
      case "petShop":
        this.openShop({});
        return;
      case "walker": {
        // A locked walker shakes and says its goal; nothing else changes. An owned one is
        // picked and says its pace and style.
        const save = this.save();
        const tap = tapWalker(gameData, save.owned, save.walker, target.walker);
        if (tap.kind === "locked") {
          this.shakes.set(id, now);
          this.action = { kind: "notice", text: tap.text };
          this.render();
          return;
        }
        const walker = tap.kind === "pick" ? tap.walker : null;
        if (tap.kind === "pick") {
          this.pops.set(id, now);
        }
        this.action = tap.kind === "pick" ? { kind: "notice", text: tap.text } : { kind: "none" };
        void updateProfile(this, (current) => ({ ...current, walker }));
        this.render();
        return;
      }
      case "mute": {
        const muted = toggleMuted(this);
        const { noticeSoundOff, noticeSoundOn } = gameData.homeText;
        this.action = { kind: "notice", text: muted ? noticeSoundOff : noticeSoundOn };
        this.render();
        return;
      }
      case "help":
        openHelp(this, SCENE_KEYS.start);
        return;
      case "logbook":
        this.overlay = { badges: undefined, kind: "logbook", rect: undefined, stats: undefined };
        this.render();
        return;
      case "settings": {
        const data: SettingsSceneData = { resume: SCENE_KEYS.start };
        openOverlay(this, SCENE_KEYS.settings, data);
        return;
      }
      case "stats": {
        const data: StatsSceneData = {
          resume: SCENE_KEYS.start,
          ...(target.tab === undefined ? {} : { tab: target.tab }),
        };
        openOverlay(this, SCENE_KEYS.stats, data);
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
    this.action = { kind: "none" };
    const lastLoadout = { dogs: [...next.dogs], gear: next.gear };
    void updateProfile(this, (save) => ({ ...save, lastLoadout }));
    this.render();
  }

  // Badges earned on launch burst in over the home screen, with the owners of the dogs
  // picked cheering.
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
    openOverlay(this, SCENE_KEYS.celebration, data);
  }

  // A new player's first walk opens help unless it was read from ?, then sets off when it
  // closes. Before then, a tap shakes the button: the neutral sections' bands say what is
  // missing.
  private startWalk(): void {
    const save = this.save();
    const dogs = packOf(this.loadout);
    const { walker } = save;
    if (dogs === undefined || walker === null || !startReady(this.sections(save))) {
      this.shakes.set("start", this.time.now);
      return;
    }
    const data: RunSceneData = {
      loadout: { dogs, gear: this.loadout.gear, walker },
      walkerSprite: walkerSpriteKey(this, walker),
    };
    const go = () => {
      startWakeLock();
      this.scene.start(SCENE_KEYS.run, data);
    };
    if (!startWalkOpensHelp(save)) {
      go();
      return;
    }
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
      const down = dip(id) > 0;
      view.iconButton?.setPressed(down);
      const glint = view.glint;
      if (glint !== undefined) {
        const frame = down ? undefined : shopGlintFrame(reduced, now);
        const textureFrame = frame === undefined ? undefined : glint.frames[frame];
        glint.image.setVisible(textureFrame !== undefined);
        if (textureFrame !== undefined) {
          glint.image.setFrame(textureFrame);
          view.shopNormal?.setVisible(false);
        }
      }
      view.container.setPosition(
        shakeOffset(reduced, now, this.shakes.get(id)),
        view.lift +
          (view.iconButton === undefined ? dip(id) : 0) +
          (glint === undefined || down ? 0 : shopBobOffset(reduced, now)) +
          rise,
      );
      view.face?.object.setY(view.face.y + hopOffset(reduced, now, this.pops.get(id)));
      view.badge?.image.setY(view.badge.y + badgePopOffset(reduced, now, this.pops.get(id)));
    }
    if (this.startButton !== undefined) {
      const { container, ready } = this.startButton;
      const down = dip("start") > 0 && ready;
      container.setPosition(
        shakeOffset(reduced, now, this.shakes.get("start")),
        down ? 0 : bobOffset(reduced, now, ready),
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
    options: { font?: FontRole; originX?: number; originY?: number; scale?: number } = {},
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
    const sign = HOME_LAYOUT.streetSign;
    addPixelText(this, sign.x, sign.y, gameData.homeText.gateSign, {
      color: PALETTE.white,
      originX: 0.5,
    });
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
    this.drawPetShop(root, save);
    this.drawPackAtGate(root, g, save);
    const sections = this.sections(save);
    for (const id of SECTION_IDS) {
      this.drawSection(root, SECTION_RECTS[id], sections[id]);
    }
    this.drawSectionFills(root);
    this.drawWalkerPicker(root, save);
    // The sticker covers its tile's price line, which the tile then leaves out.
    const sticker = this.textures.exists(STICKER.key)
      ? homeSticker(gameData, save.owned, this.visitBank, save.bankCents)
      : null;
    const stickered = (item: TileItem) => sticker !== null && sameItem(sticker.item, item);
    this.drawDogTiles(root, stickered, save);
    this.drawPocket(root, stickered, save);
    this.drawSticker(root, sticker);
    this.drawStartButton(root, startReady(sections));
    this.drawFocus(root);
    this.drawOverlay(save);
  }

  // Each section's state and band text. The saved walker counts as picked, so a first visit
  // needs only a dog.
  private sections(save: SaveDocument): Sections {
    return homeSections(gameData, save.owned, { loadout: this.loadout, walker: save.walker });
  }

  // Each section's fill over its tile area, then the Pocket's tan stitch, under the tiles. Each
  // piece is a TileSprite with its tile origin at its own top-left; a missing texture leaves
  // the frame bare.
  private drawSectionFills(root: GameObjects.Container): void {
    const { stitchBottom, stitchLeft, stitchRight, stitchTop } = POCKET_LINING;
    const fills = SECTION_IDS.map((id): [string, Rect] => [
      SECTION_FILL_KEYS[id],
      sectionFill(SECTION_RECTS[id]),
    ]);
    const pieces: readonly [string, Rect][] = [
      ...fills,
      ["ui-stitch-v", stitchLeft],
      ["ui-stitch-v", stitchRight],
      ["ui-stitch-h", stitchTop],
      ["ui-stitch-h", stitchBottom],
    ];
    for (const [key, rect] of pieces) {
      if (this.textures.exists(key)) {
        root.add(
          this.add
            .tileSprite(rect.x, rect.y, rect.width, rect.height, key)
            .setOrigin(0)
            .setTilePosition(0, 0),
        );
      }
    }
  }

  // A section's ui-section frame and band by its state, with the heading on the band's left
  // and its note on the right: ink on the lit (complete) band, cream and amber on the dark
  // (neutral) one.
  private drawSection(root: GameObjects.Container, rect: Rect, section: Section): void {
    const frame = addNineSlice(this, "ui-section", rect, section.state);
    if (frame === undefined) {
      this.drawSectionFrame(root, rect, section.state);
    } else {
      root.add(frame);
    }
    const lit = section.state === "complete";
    const y = rect.y + BAND_TEXT.y;
    this.text(
      root,
      rect.x + BAND_TEXT.inset,
      y,
      section.heading,
      lit ? PALETTE.ink : PALETTE.cream,
      {
        font: "title",
      },
    );
    const right = rect.x + rect.width - BAND_TEXT.inset;
    if (section.note !== "") {
      this.text(root, right, y, section.note, lit ? PALETTE.ink : PALETTE.amber, {
        font: "title",
        originX: 1,
      });
    }
  }

  // The ui-section art drawn in code while it is missing: complete is an ink outline round a
  // gold frame and a lit amber band over an orange rule; neutral is an ink frame and rule
  // round a navy band. The tiles' area is left open.
  private drawSectionFrame(root: GameObjects.Container, rect: Rect, state: SectionState): void {
    const g = this.graphics(root);
    const lit = state === "complete";
    const { band, edge } = SECTION_FRAME;
    drawRing(g, PALETTE.ink, rect, 1);
    drawRing(g, lit ? PALETTE.amber : PALETTE.ink, insetRect(1, rect), edge - 1);
    const width = rect.width - edge * 2;
    fillRect(g, lit ? PALETTE.amber : PALETTE.navy, {
      height: band,
      width,
      x: rect.x + edge,
      y: rect.y + edge,
    });
    fillRect(g, lit ? PALETTE.orange : PALETTE.ink, {
      height: 1,
      width,
      x: rect.x + edge,
      y: rect.y + edge + band,
    });
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
      const log = logbookOf(gameData, save.stats);
      const panel = drawLogbookPanel(this, layer, this.overlayPressed(), log);
      this.overlay = { ...overlay, badges: panel.badges, rect: panel.panel, stats: panel.stats };
      return;
    }
    const { target } = overlay;
    const card = this.detailCard(save, target);
    const picture = this.detailPicture(target);
    const closePressed = this.overlayPressed() === "close";
    const rect = drawDetailCard(this, layer, closePressed, card, picture, target.kind);
    this.overlay = { ...overlay, rect };
  }

  private detailCard(save: SaveDocument, target: DetailTarget): DetailCard {
    if (target.kind === "dog") {
      return dogDetail(gameData, save.owned, save.bankCents, save.stats, target.dog);
    }
    if (target.kind === "gear") {
      return gearDetail(gameData, save.owned, save.bankCents, this.loadout, target.gear);
    }
    return walkerDetail(gameData, save.owned, target.walker);
  }

  private detailPicture(target: DetailTarget): DetailPicture {
    if (target.kind === "dog") {
      return {
        badge: quirkIconKey(gameData, target.dog),
        key: dogPortraitKey(gameData, target.dog),
        scale: 1,
      };
    }
    if (target.kind === "gear") {
      return { key: gearIconKey(target.gear), scale: 2 };
    }
    return {
      fallback: gameData.walkers[target.walker].portraitKey,
      key: walkerPortraitKey(target.walker),
      scale: 1,
    };
  }

  // A container for one tappable tile, registered for its feedback.
  private tileView(root: GameObjects.Container, id: string): TileView {
    const container = this.add.container(0, 0);
    root.add(container);
    const view: TileView = { container, lift: 0 };
    this.views.set(id, view);
    return view;
  }

  // A tile in its interaction state, registered for its feedback.
  private selectTile(
    root: GameObjects.Container,
    id: string,
    rect: Rect,
    options: Omit<SelectTileOptions, "outset" | "reducedMotion">,
  ): { content: GameObjects.Container; look: SelectLook; view: TileView } {
    const reducedMotion = currentSettings(this).reducedMotion;
    const tile: SelectTile = addSelectTile(this, root, rect, {
      ...options,
      outset: TILE_SELECT_OUTSET,
      reducedMotion,
    });
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
    const view = this.tileView(root, id);
    view.iconButton = addIconButton(this, view.container, at.x, at.y, icon);
  }

  private drawTopBar(
    root: GameObjects.Container,
    g: GameObjects.Graphics,
    save: SaveDocument,
  ): void {
    fillRect(g, PALETTE.plum, { height: TOP_BAR.height, width: SCREEN.width, x: 0, y: 0 });
    fillRect(g, PALETTE.darkBrown, {
      height: TOP_BAR.rule,
      width: SCREEN.width,
      x: 0,
      y: TOP_BAR.height - TOP_BAR.rule,
    });
    const { coin, textY } = TOP_BAR;
    root.add(
      this.textures.exists(MONEY_ICON_KEY)
        ? this.add.image(coin.x, coin.y, MONEY_ICON_KEY).setOrigin(0)
        : this.add.sprite(coin.x, coin.y, "tip").setOrigin(0),
    );
    const dollar = this.text(root, 24, textY.bank, "$", PALETTE.amber, { font: "title" });
    this.text(
      root,
      24 + dollar.width + 2,
      textY.bank,
      dollarAmountText(save.bankCents),
      PALETTE.cream,
      {
        font: "title",
      },
    );
    // The best walk and walk count after the Logbook button, inside its hit area.
    const { bestWalk } = save.stats;
    const walks = walksPlayed(save.stats);
    const left = HOME_LAYOUT.logbook.textX;
    const words = gameData.homeText.topBar;
    if (bestWalk === null) {
      this.text(root, left, textY.noWalks, words.noWalks, PALETTE.cream);
    } else {
      const best = fillLine(FIELDS.topBar, words, "best", {
        amount: dollarText(bestWalk.earnedCents),
      });
      this.text(root, left, textY.best, best, PALETTE.cream);
      const count = fillLine(FIELDS.topBar, words, walks === 1 ? "walkOne" : "walkMany", {
        count: String(walks),
      });
      this.text(root, left, textY.walks, count, PALETTE.cream);
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
    const walkerKey = save.walker === null ? undefined : walkerSpriteKey(this, save.walker);
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
    if (walkerKey !== undefined) {
      drawShadow(g, groundColor(x), x, footY, spriteMetrics(walkerKey).opaqueWidth);
    }
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
    if (walkerKey !== undefined) {
      const walker = addStandingSprite(this, walkerKey, x, footY);
      showTag(reduced, walker, walkerKey, "walk");
      root.add(walker);
    }

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
    const speech = bubbleSpeech(
      gameData.homeText,
      save.walker === null ? "noWalker" : this.walkerLine,
      state,
      this.quips,
    );
    const unsaved = storageState(this) === "unavailable" ? [gameData.homeText.unsaved] : [];
    const lines = [...unsaved, ...speech]
      .flatMap((part) => wrapWords((line) => line.length, SPEECH_CHARS, part))
      .slice(0, SPEECH_LINES);
    const top = GATE.y + 6;
    // The bubble goes under the words, which set its size.
    const bubble = this.add.container(0, 0);
    root.add(bubble);
    const labels = lines.map((line, i) =>
      this.text(root, x, top + 4 + i * SPEECH_LINE_HEIGHT, line, PALETTE.plum, { originX: 0.5 }),
    );
    const width = Math.ceil(Math.max(...labels.map((label) => label.width))) + 10;
    const height = lines.length * SPEECH_LINE_HEIGHT + 6;
    // A bubble tall enough to reach the Pet shop's board moves left to keep clear of it.
    const board = PET_SHOP_BOARD;
    const centred = Math.round(x - width / 2);
    const rect = bubbleRect(
      board,
      { clearance: 2, margin: GAP / 2 },
      { x, y: top },
      { height, width },
    );
    labels.forEach((label) => label.setX(label.x + rect.x - centred));
    const quip = addNineSlice(this, "ui-quip", rect);
    if (quip === undefined) {
      drawFramedRect(this.graphics(bubble), { border: PALETTE.plum, fill: PALETTE.cream }, rect);
    } else {
      bubble.add(quip);
    }
    // The tail's top row lies over the bubble's bottom rim, its tip over the walker.
    const tail = downTail((key) => this.textures.exists(key));
    if (tail !== undefined) {
      bubble.add(this.add.image(x - tail.tipX, top + height - 1, tail.key).setOrigin(0));
    }

    // Equipped gear shows as a badge beside the walker.
    if (this.loadout.gear !== null) {
      const badge = this.tileView(root, "gateBadge");
      badge.rise = `gear:${this.loadout.gear}`;
      fillRect(this.graphics(badge.container), PALETTE.plum, GEAR_BADGE);
      const at = { x: GEAR_BADGE.x + 1, y: GEAR_BADGE.y + 1 };
      this.addGearIcon(badge.container, "normal", this.loadout.gear, at, 0.5);
    }
  }

  // The Pet shop on the yard's right lot: ui-pet-shop, its front sinking while pressed, with
  // the gold outline while anything inside is affordable. Drawn in code while the art is
  // missing, when the whole building dips instead.
  private drawPetShop(root: GameObjects.Container, save: SaveDocument): void {
    const view = this.tileView(root, "petShop");
    const faces = (["normal", "pressed"] as const).flatMap((tag) => {
      const image = addTagImage(this, SHOP_ART.petShop, tag, PET_SHOP.x, PET_SHOP.y);
      return image === undefined ? [] : [image];
    });
    const [normal, pressed] = faces;
    if (normal !== undefined && pressed !== undefined) {
      view.container.add(faces);
      view.iconButton = {
        setPressed: (down) => {
          normal.setVisible(!down);
          pressed.setVisible(down);
        },
      };
      view.iconButton.setPressed(false);
      this.addShopGlint(view, normal);
    } else {
      drawPetShopFallback(this, view.container, PET_SHOP, gameData.homeText.shop.title);
    }
    if (shopAffordable(gameData, save.owned, save.bankCents)) {
      addAffordFrame(this, view.container, PET_SHOP, currentSettings(this).reducedMotion);
    }
  }

  // The glint frames of the Pet shop's art, an image over the normal face, hidden between
  // glints. update plays them from the clock, so there is no timer to stop.
  private addShopGlint(view: TileView, normal: GameObjects.Image): void {
    const frames = Array.from({ length: FEEDBACK.shopGlintFrames }, (_, i) =>
      tagFrame(this, SHOP_ART.petShop, "glint", i),
    ).filter((frame) => frame !== undefined);
    const first = frames[0];
    if (first === undefined) {
      return;
    }
    const image = this.add.image(PET_SHOP.x, PET_SHOP.y, SHOP_ART.petShop, first).setOrigin(0);
    image.setVisible(false);
    view.container.add(image);
    view.glint = { frames, image };
    view.shopNormal = normal;
  }

  // A locked item's price (or goal) plate: green while the bank covers it, dark red when not.
  // originX places it by its left (0) or centre (0.5).
  private lockedPlate(
    parent: GameObjects.Container,
    tile: ItemTile,
    at: { capY: number; originX: number; x: number },
  ): void {
    const text =
      tile.kind === "locked" ? dollarText(tile.price) : tile.kind === "goal" ? tile.goal : null;
    if (text !== null) {
      addPlate(this, parent, at, text, lockedPlateColors(tile));
    }
  }

  private drawDogTiles(
    root: GameObjects.Container,
    stickered: (item: TileItem) => boolean,
    save: SaveDocument,
  ): void {
    const { owned } = save;
    const reduced = currentSettings(this).reducedMotion;
    const capacity = packCapacity(gameData, owned);
    const tiles = dogTiles();
    rosterOrder().forEach((id, i) => {
      const rect = dogFace(itemAt(tiles, i));
      const { x, y } = rect;
      const dog = gameData.dogs[id];
      const tile = itemTile({
        bank: save.bankCents,
        capacity,
        goal: null,
        picked: this.loadout.dogs.includes(id),
        pickedCount: this.loadout.dogs.length,
        price: purchasePrice(gameData, owned, { dog: id, kind: "dog" }),
      });
      const state = itemTileState(tile);
      const { content, look, view } = this.selectTile(root, `dog:${id}`, rect, {
        // A picked dog's badge is its place in the pick order.
        badge: String(this.loadout.dogs.indexOf(id) + 1),
        edge: true,
        state,
        tile: true,
      });
      const ink = PALETTE[look.text];
      fillRect(this.graphics(content), PALETTE[look.box], {
        height: 34,
        width: 34,
        x: x + 3,
        y: y + 4,
      });
      const faceKey = dogFaceKey(gameData, id);
      const locked = tile.kind === "locked" || tile.kind === "goal";
      const faceTag = locked ? "neutral" : "happy";
      const faceAt = { x: x + 4, y: y + 5 };
      const face = locked
        ? this.add
            .sprite(
              faceAt.x,
              faceAt.y,
              itemArtKey(this, tile, faceKey),
              tagFrame(this, faceKey, faceTag),
            )
            .setOrigin(0)
        : addTileSprite(this, state, reduced, faceKey, faceTag, faceAt);
      content.add(face);
      view.face = { object: face, y: y + 5 };

      this.text(content, x + 39, y + 4, dog.name, ink);
      if (locked) {
        // A locked dog shows its padlock and its price or goal plate in place of its icons
        // and fee.
        addLock(this, content, x - 2, y - 3);
        if (!stickered({ dog: id, kind: "dog" })) {
          this.lockedPlate(content, tile, { capY: y + 28, originX: 0, x: x + 39 });
        }
        return;
      }
      // The trait and the owner's temperament as icons; the info line says them in words.
      [traitIconKey(dog.trait), temperamentIconKey(dog.owner.temperament)].forEach((key, n) => {
        if (this.textures.exists(key)) {
          const iconKey = tileTextureKey(this, state, key);
          content.add(this.add.image(x + 38 + n * 18, y + 13, iconKey).setOrigin(0));
        }
      });
      const fee = homeLine(gameData.homeText, "zoneFee", { fee: dogFeeText(gameData, id) });
      this.text(content, x + 39, y + 29, fee, ink);
    });
  }

  // The Pocket section's tiles, one per gear item in shop order; a hold shows an item's
  // effect. Pocketing an item replaces any other, so the Pocket is never full.
  private drawPocket(
    root: GameObjects.Container,
    stickered: (item: TileItem) => boolean,
    save: SaveDocument,
  ): void {
    const { owned } = save;
    const pocketed = this.loadout.gear;
    const slots = gearSlots();
    gearIds().forEach((id, i) => {
      const rect = pocketTile(itemAt(slots, i));
      const { width, x, y } = rect;
      const tile = itemTile({
        bank: save.bankCents,
        capacity: 1,
        goal: null,
        picked: pocketed === id,
        pickedCount: pocketed === null ? 0 : 1,
        price: purchasePrice(gameData, owned, { gear: id, kind: "gear" }),
      });
      const state = itemTileState(tile);
      const { content, look, view } = this.selectTile(root, `gear:${id}`, rect, {
        badge: "tick",
        edge: true,
        state,
        tile: true,
      });
      const { box, icon: iconAt, lock } = POCKET;
      fillRect(this.graphics(content), PALETTE[look.box], {
        height: box.size,
        width: box.size,
        x: x + box.dx,
        y: y + box.dy,
      });
      const at = { x: x + iconAt.dx, y: y + iconAt.dy };
      const icon = this.addGearIcon(content, tile, id, at, 1);
      if (icon !== undefined) {
        view.face = { object: icon, y: at.y };
      }
      if (tile.kind === "locked" || tile.kind === "goal") {
        addLock(this, content, x + lock.dx, y + lock.dy);
        if (!stickered({ gear: id, kind: "gear" })) {
          const plateAt = { capY: y + POCKET.priceY, originX: 0.5, x: x + width / 2 };
          this.lockedPlate(content, tile, plateAt);
        }
      }
    });
  }

  // The item's 32x32 icon, as a locked item's silhouette or a disabled tile's grey copy, or
  // its initials until the icon is in the manifest.
  private addGearIcon(
    parent: GameObjects.Container,
    tile: ItemTile | TileState,
    gear: GearId,
    at: { x: number; y: number },
    scale: number,
  ): GameObjects.Image | undefined {
    const { x, y } = at;
    const key = gearIconKey(gear);
    if (this.textures.exists(key)) {
      const shown =
        typeof tile === "string" ? tileTextureKey(this, tile, key) : itemArtKey(this, tile, key);
      const icon = this.add.image(x, y, shown).setOrigin(0).setScale(scale);
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

  // One tile per walker, in the shared tile states: the saved one is picked, and picking
  // another replaces it, so the walker choice is never full. An owned walker shows its
  // portrait with its pace icon over its style icon; a locked one its silhouette, the
  // padlock and its name plate.
  private drawWalkerPicker(root: GameObjects.Container, save: SaveDocument): void {
    const reduced = currentSettings(this).reducedMotion;
    const tiles = walkerTiles();
    walkerIds().forEach((id, i) => {
      const rect = itemAt(tiles, i);
      const { x, y } = rect;
      const tile = walkerTile(gameData, save, id);
      const state = itemTileState(tile);
      const { content, look, view } = this.selectTile(root, `walker:${id}`, rect, {
        badge: "tick",
        edge: true,
        state,
        tile: true,
      });
      const { box, face: faceAt, icons, lock, plateY } = WALKER_TILE;
      fillRect(this.graphics(content), PALETTE[look.box], {
        height: box.size,
        width: box.size,
        x: x + box.dx,
        y: y + box.dy,
      });
      const walker = gameData.walkers[id];
      const at = { x: x + faceAt.dx, y: y + faceAt.dy };
      const locked = tile.kind === "goal";
      if (this.textures.exists(walker.portraitKey)) {
        const tag = tile.kind === "picked" ? "happy" : "neutral";
        const face = locked
          ? this.add
              .sprite(
                at.x,
                at.y,
                itemArtKey(this, tile, walker.portraitKey),
                tagFrame(this, walker.portraitKey, tag),
              )
              .setOrigin(0)
          : addTileSprite(this, state, reduced, walker.portraitKey, tag, at);
        content.add(face);
        view.face = { object: face, y: at.y };
      } else {
        const centre = { x: x + box.dx + box.size / 2, y: y + box.dy + box.size / 2 };
        this.text(content, centre.x, centre.y, walker.name.charAt(0), PALETTE[look.text], {
          font: "title",
          originX: 0.5,
          originY: 0.5,
        });
      }
      if (locked) {
        addLock(this, content, x + lock.dx, y + lock.dy);
        const plateAt = { capY: y + plateY, originX: 0.5, x: x + rect.width / 2 };
        this.lockedPlate(content, tile, plateAt);
        return;
      }
      walkerStripItems(gameData, id).forEach((item, n) => {
        const iconAt = { x: x + icons.dx, y: y + itemAt(icons.dy, n) };
        const key = stripIconKey(item);
        if (this.textures.exists(key)) {
          const shown = tileTextureKey(this, state, key);
          content.add(this.add.image(iconAt.x, iconAt.y, shown).setOrigin(0));
          return;
        }
        const half = STRIP.icon / 2;
        const letter = stripIconFallback(gameData, item);
        this.text(content, iconAt.x + half, iconAt.y + half, letter, PALETTE[look.text], {
          originX: 0.5,
          originY: 0.5,
        });
      });
    });
  }

  // The screen's one sticker over its tile's bottom-right corner: its right edge 2px past
  // the tile's, kept 2px inside the screen, and its bottom 4px below. new pops in on the
  // first draw of a visit, and its word is written once the pop ends; with reduced motion it
  // shows the pop's last frame, the new look, at once.
  private drawSticker(root: GameObjects.Container, sticker: Sticker | null): void {
    if (sticker === null) {
      return;
    }
    const { item } = sticker;
    const rect =
      item.kind === "dog"
        ? dogFace(itemAt(dogTiles(), rosterOrder().indexOf(item.dog)))
        : pocketTile(itemAt(gearSlots(), gearIds().indexOf(item.gear)));
    const right = Math.min(rect.x + rect.width + 2, SCREEN.width - 2);
    const x = right - STICKER.width;
    const y = rect.y + rect.height + 4 - STICKER.height;
    const image = this.add
      .sprite(x, y, STICKER.key, tagFrame(this, STICKER.key, sticker.kind))
      .setOrigin(0);
    root.add(image);
    const writeWord = () => {
      if (!image.active) {
        return;
      }
      const word = sticker.kind === "new" ? "NEW!" : dollarText(sticker.price);
      const label = this.text(root, x + STICKER.wordX, y + STICKER.wordY, word, PALETTE.ink, {
        font: "title",
        originX: 0.5,
        scale: 1,
      });
      fitText(label, STICKER.maxWordWidth, [word, word.replace(/^\$/, "")]);
    };
    const pop = this.anims.get(animationKey(STICKER.key, "pop"));
    const popping =
      sticker.kind === "new" &&
      !this.stickerPopped &&
      !currentSettings(this).reducedMotion &&
      pop !== undefined;
    this.stickerPopped = this.stickerPopped || sticker.kind === "new";
    if (!popping) {
      writeWord();
      return;
    }
    image.play({ key: pop.key, repeat: 0 });
    image.once("animationcomplete", () => {
      const settled = tagFrame(this, STICKER.key, "new");
      if (image.active && settled !== undefined) {
        image.setFrame(settled);
      }
      writeWord();
    });
  }

  // Start walk keeps its words and place in every state. Ready, it is primary: the raised
  // green go button, sinking into its lip when pressed, drawn twice, raised and pressed, and
  // the frame shows one. Not ready, it is disabled: a flat sunk face that never moves.
  private drawStartButton(root: GameObjects.Container, ready: boolean): void {
    const { height, width, x, y } = START_BUTTON;
    const container = this.add.container(0, 0);
    root.add(container);
    const label = gameData.homeText.startWalk;
    const state = buttonState({ available: ready, primary: true });
    const disabled = state === "disabled";
    const variant = (down: boolean) => {
      const group = this.add.container(0, 0);
      container.add(group);
      const drop = down ? FEEDBACK.buttonPressPx : 0;
      const tag = disabled ? "go-disabled" : down ? "go-pressed" : "go";
      const slice = addNineSlice(this, "ui-button", START_BUTTON, tag);
      if (slice !== undefined) {
        group.add(slice);
      } else if (disabled) {
        drawDisabledButton(this.graphics(group), 4, FEEDBACK.buttonPressPx, START_BUTTON);
      } else {
        const g = this.graphics(group);
        if (!down) {
          fillRect(g, PALETTE.forest, { height: height - 4, width, x, y: y + 4 });
        }
        fillRect(g, PALETTE.green, { height: height - 4, width, x, y: y + drop });
      }
      const top = disabled ? START_LABEL.notReadyY : START_LABEL.readyY + drop;
      const color = disabled ? PALETTE[DISABLED_COLORS.text] : PALETTE.ink;
      this.text(group, x + width / 2, y + top, label, color, {
        font: "title",
        originX: 0.5,
        scale: START_LABEL.scale,
      });
      return group;
    };
    const up = variant(false);
    const down = variant(true);
    down.setVisible(false);
    this.startButton = { container, down, ready, up };
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
