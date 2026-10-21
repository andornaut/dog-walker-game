import { type GameObjects, Scene, type Time } from "phaser";

import { itemAt } from "../arrays";
import {
  dogFaceKey,
  dogPortraitKey,
  dogSpriteKey,
  gearIconKey,
  walkerPortraitKey,
} from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DogId, GearId, Size, WalkerId } from "../data/types";
import { clearRunOverrides } from "../dev/pageRunSetup";
import { startWalkOpensHelp } from "../help/helpSeen";
import { bankAtLastVisit, newlyAffordable } from "../home/afford";
import { bubbleRect, speechLines } from "../home/bubbleRect";
import {
  type DetailCard,
  dogDetail,
  gearDetail,
  lockedDogDetail,
  lockedWalkerDetail,
  walkerDetail,
} from "../home/detail";
import {
  badgePopOffset,
  bobOffset,
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
  dogInfo,
  dollarAmountText,
  dollarText,
  gearInfo,
  type HomeLoadout,
  logbookOf,
  packCapacity,
  partingSpeech,
  type Purchase,
  purchasePrice,
  shortDollarAmountText,
  tapDog,
  tapGear,
} from "../home/home";
import {
  bankFit,
  bankLeft,
  DOG_TILE_TEXT_ROOM,
  dogTileNameY,
  dogTilePlateY,
  HOME_LAYOUT,
  sectionFill,
  SPEECH_ROOM,
  speechBubbleHeight,
} from "../home/homeLayout";
import {
  bubbleSpeech,
  type HomeAction,
  type WalkerLine,
  walkerLineKey,
  walkerUnlockedSince,
} from "../home/homeLines";
import {
  buttonState,
  type ItemTile,
  itemTile,
  itemTileLook,
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
import { tapWalker, walkerOrder, walkerTile } from "../home/walkers";
import {
  EFFECT_ICON_SIZE,
  effectIconFallback,
  effectIconKey,
  walkerEffectItems,
} from "../hud/effectIcons";
import { downTail } from "../hud/moments";
import { HOLD, type HoldPress, moveHold, releaseHold, startHold, tickHold } from "../input/hold";
import { isConfirmKey, isMuteKey, isPauseKey, menuKeyActs } from "../input/keyBindings";
import { screenArea } from "../input/outsideTap";
import { closeControl } from "../layout/closeControl";
import { gridRects, rectIndexAt } from "../layout/grid";
import type { PackPlacement } from "../layout/packFormation";
import { containsPoint, insetRect, type Rect } from "../layout/rect";
import { TEXT_FIT_STYLES, type TextFitStyle } from "../layout/textFit";
import { addFigure, PackFigures, YARD_LEASH_COLOR } from "../pack/phaser/packFigures";
import { startWakeLock, stopWakeLock } from "../pwa";
import type { Cents } from "../rules/units";
import type { SaveDocument } from "../save/schema";
import { walksPlayed } from "../save/stats";
import { packDogsOf } from "../state/pack";
import { artReady, whenArtReady } from "./artReady";
import type { CelebrationSceneData } from "./CelebrationScene";
import { drawFocusRing, drawFramedRect, drawRing, drawShadow, fillRect } from "./draw";
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
  artTextureKey,
  drawPetShopFallback,
  plateColors,
  SHOP_ART,
} from "./itemArt";
import { listenOnePress } from "./onePress";
import { listenOutsideTap, onBackPressed, onSceneEvent, openOverlay } from "./overlay";
import { addOwnerFigure } from "./ownerFigure";
import { PALETTE } from "./palette";
import {
  addPixelText,
  fitPixelText,
  type FontRole,
  inkSpan,
  pixelFontMetrics,
  placePixelText,
  scalePixelText,
  setPixelText,
} from "./pixelText";
import {
  currentSettings,
  isMuted,
  profileSave,
  storageState,
  takeCelebrations,
  toggleMuted,
  updateProfile,
  walkerSpriteKey,
} from "./profileStore";
import { nextRunStart } from "./run/runRecorder";
import { type RunPick, runSceneData } from "./run/runStart";
import { SCENE_KEYS } from "./sceneKeys";
import { SETTINGS_CLOSED_EVENT, type SettingsSceneData } from "./SettingsScene";
import {
  SHOP_CHANGED_EVENT,
  SHOP_CLOSED_EVENT,
  type ShopClosed,
  type ShopSceneData,
} from "./ShopScene";
import { playEffect, spriteMetrics } from "./sprites";
import type { StatsSceneData } from "./StatsScene";
import {
  addIconButton,
  addNineSlice,
  addSelectTile,
  addTagImage,
  addTapBurst,
  addTileSprite,
  cogIcon,
  drawDisabledButton,
  type IconButton,
  imageIcon,
  type SelectTile,
  type SelectTileOptions,
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
const TOP_BAR = HOME_LAYOUT.topBar;
const HELP_BUTTON: Rect = HOME_LAYOUT.help.hit;
const HELP_FACE = HOME_LAYOUT.help.face;
const MUTE_BUTTON: Rect = HOME_LAYOUT.mute.hit;
const MUTE_FACE = HOME_LAYOUT.mute.face;
const SETTINGS_BUTTON: Rect = HOME_LAYOUT.settings.hit;
const SETTINGS_FACE = HOME_LAYOUT.settings.face;
const LOGBOOK_BUTTON: Rect = HOME_LAYOUT.logbook.hit;
const LOGBOOK_FACE = HOME_LAYOUT.logbook.face;
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
const DOG_TILE = HOME_LAYOUT.dogTile;
const DOG_TILE_INSET = HOME_LAYOUT.dogTileInset;
const TILE_SELECT_OUTSET = HOME_LAYOUT.tileSelectOutset;
const START_BUTTON: Rect = HOME_LAYOUT.startButton;
// Start walk's opacity while it waits for the rest of the art to load.
const WAITING_ALPHA = 0.6;
const START_LABEL = HOME_LAYOUT.startLabel;
const START_LOADING = HOME_LAYOUT.startLoading;
const GEAR_BADGE: Rect = HOME_LAYOUT.gearBadge;
// The keyboard ring sits outside the ui-select frame.
const FOCUS_OUTSET = 5;
const SIZE_ORDER: readonly Size[] = ["small", "medium", "big"];

// The widest line the speech bubble holds, in characters, and how many lines it shows.
const SPEECH = HOME_LAYOUT.speech;

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

// The roster in rows by size, each row in data order, as the mock lays it out.
function rosterOrder(): DogId[] {
  const rank = (dog: DogId) => SIZE_ORDER.indexOf(gameData.dogs[dog].size);
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

// The bank the last time the home screen was shown this session, so the walker can say
// when something new became affordable.
const LAST_VISIT_BANK_KEY = "homeLastVisitBank";
// The walkers owned the last time the home screen was shown this session, so the walker can
// say when one has just been unlocked. A session's first visit has none to compare with.
const LAST_VISIT_WALKERS_KEY = "homeLastVisitWalkers";

// The screen before a walk: the bank at the top bar's left and Logbook, Help, Sound and
// Settings at its right; the walker and pack at the gate beside the Pet shop; the Walker, Dogs
// and Pocket sections and Start walk. Buying happens only in the shop: tapping the building
// opens it, and tapping a locked dog, gear item or the Dogs band's padlock opens it on that
// item. Holding a dog or gear tile opens its detail card.
// The arrow keys move a focus ring, Enter or Space picks, Escape, P or back closes a card, ?
// opens help, S settings, L the logbook and M mutes. Start walk and help wait for boot to load
// the rest of the art, which it does behind this screen.
export class StartScene extends Scene {
  // The last action, for the message line and the bubble.
  private action: HomeAction = { kind: "none" };
  // A press of Start walk or help made before boot has loaded the rest of the art: the latest
  // runs once it has, and Start walk shows held down and dimmed while it waits.
  private artWait: { action: () => void; kind: "help" | "start" } | undefined;
  private focus: Focus | null = null;
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
    | {
        container: GameObjects.Container;
        down: GameObjects.Container;
        ready: boolean;
        up: GameObjects.Container;
      }
    | undefined;
  private views = new Map<string, TileView>();
  private walkerLine: WalkerLine = "firstVisit";

  constructor() {
    super(SCENE_KEYS.start);
  }

  create(): void {
    this.action = { kind: "none" };
    this.artWait = undefined;
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
    const walkersBefore = this.registry.get(LAST_VISIT_WALKERS_KEY) as WalkerId[] | undefined;
    const news = {
      affordable: newlyAffordable(gameData, owned, before, bankCents),
      walker: walkerUnlockedSince(walkersBefore, owned.walkers),
    };
    this.walkerLine = walkerLineKey(stats.lastWalk, news, walksPlayed(stats));
    stopWakeLock();
    clearRunOverrides();

    this.drawGate();
    this.root = this.add.container(0, 0);
    this.overlayLayer = this.add.container(0, 0);
    this.render();

    listenOnePress(this, {
      down: (pointer) => {
        addTapBurst(this, pointer.x, pointer.y);
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
    // A held key acts once, so an Enter held from the end screen cannot start a walk.
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (menuKeyActs(event.repeat, event.key)) {
        this.onKey(event.key);
      }
    });
    // Badges earned on launch: a scene can pause itself only once it is running.
    this.time.delayedCall(0, () => this.celebrate());
    // Settings can change reduced motion or mute, so the screen is drawn again.
    onSceneEvent(this, this.game.events, SETTINGS_CLOSED_EVENT, () => this.render());
    // The shop draws under the top bar, so the bank there follows each purchase; on close
    // the walker says the shop's last purchase or refusal.
    onSceneEvent(this, this.game.events, SHOP_CHANGED_EVENT, () => this.render());
    onSceneEvent(this, this.game.events, SHOP_CLOSED_EVENT, (closed: ShopClosed) =>
      this.shopClosed(closed),
    );
    // A tap made while another tap's act opened help, settings or stats over this screen is
    // dropped, so it cannot act once the screen resumes, as is a press waiting for the art.
    onSceneEvent(this, this.events, "pause", () => {
      this.pending.forEach((timer) => timer.remove());
      this.pending.clear();
      this.artWait = undefined;
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
  // walker's agility and perk or goal, as a tap says them.
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
        // picked and says its agility and perk, or unpicked when it was the picked one.
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
        this.afterArt("help", () => openHelp(this, SCENE_KEYS.start));
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
  private celebrate(): void {
    const achievements = takeCelebrations(this);
    if (achievements.length === 0) {
      return;
    }
    const data: CelebrationSceneData = {
      achievements,
      owners: [...this.loadout.dogs],
      resume: SCENE_KEYS.start,
    };
    openOverlay(this, SCENE_KEYS.celebration, data);
  }

  // A new player's first walk opens help unless it was read from ?, then sets off when it
  // closes. Before then, a tap shakes the button: the neutral sections' bands say what is
  // missing.
  private startWalk(): void {
    const save = this.save();
    const dogs = packDogsOf(this.loadout.dogs);
    const { walker } = save;
    if (dogs === undefined || walker === null || !startReady(this.sections(save))) {
      this.shakes.set("start", this.time.now);
      return;
    }
    if (!artReady(this)) {
      this.afterArt("start", () => this.startWalk());
      return;
    }
    const pick: RunPick = {
      dogSlots: save.owned.dogSlots,
      loadout: { dogs, gear: this.loadout.gear, walker },
    };
    const go = () => {
      startWakeLock();
      this.scene.start(SCENE_KEYS.run, runSceneData(nextRunStart(), pick));
    };
    if (!startWalkOpensHelp(save)) {
      go();
      return;
    }
    this.game.events.once(HELP_CLOSED_EVENT, go);
    openHelp(this, SCENE_KEYS.start);
  }

  // Runs action now if every asset has loaded, else once it has, in place of any press already
  // waiting.
  private afterArt(kind: "help" | "start", action: () => void): void {
    if (artReady(this)) {
      action();
      return;
    }
    const waiting = this.artWait !== undefined;
    this.artWait = { action, kind };
    this.render();
    if (!waiting) {
      whenArtReady(this, () => {
        const wait = this.artWait;
        this.artWait = undefined;
        this.render();
        wait?.action();
      });
    }
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
      const waiting = this.artWait?.kind === "start";
      const down = (dip("start") > 0 && ready) || waiting;
      container.setAlpha(waiting ? WAITING_ALPHA : 1);
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

  // Fits a body label at TEXT_SCALE in the first of fit's styles, its capitals' top at (x, y);
  // a label set smaller is centred on the row its capitals take at TEXT_SCALE.
  private fitOnRow(
    label: GameObjects.BitmapText,
    fit: { room: number; styles: readonly TextFitStyle[] },
    x: number,
    y: number,
  ): void {
    const { style } = fitPixelText(label, fit, x, y);
    const { capHeight } = pixelFontMetrics(this, "body");
    placePixelText(label, x, y + Math.floor((capHeight * (TEXT_SCALE - style.scale)) / 2));
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
    this.registry.set(LAST_VISIT_WALKERS_KEY, [...save.owned.walkers]);
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
    this.drawDogTiles(root, save);
    this.drawPocket(root, save);
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

  // A dog or walker not owned shows its locked card, which names and describes nothing.
  private detailCard(save: SaveDocument, target: DetailTarget): DetailCard {
    const { bankCents, owned } = save;
    if (target.kind === "dog") {
      return (
        lockedDogDetail(gameData, owned, bankCents, target.dog) ??
        dogDetail(gameData, owned, bankCents, save.stats, target.dog)
      );
    }
    if (target.kind === "gear") {
      return gearDetail(gameData, owned, bankCents, this.loadout, target.gear);
    }
    return (
      lockedWalkerDetail(gameData, owned, target.walker) ??
      walkerDetail(gameData, owned, target.walker)
    );
  }

  private detailPicture(target: DetailTarget): DetailPicture {
    if (target.kind === "dog") {
      return {
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
    // The bank in its well: the "$" and the amount at the largest scale that fits, one font
    // advance apart and centred across the well, or in its short form past every scale.
    const { bank, well, wellKey } = TOP_BAR;
    if (this.textures.exists(wellKey)) {
      root.add(this.add.image(well.x, well.y, wellKey).setOrigin(0));
    } else {
      const { height, lip, width, x, y } = well;
      fillRect(g, PALETTE.ink, { height: height - lip, width: width - lip, x, y });
    }
    const dollar = this.text(root, 0, 0, "$", PALETTE.amber, { font: "title", scale: 1 });
    const amount = this.text(root, 0, 0, "", PALETTE.cream, { font: "title", scale: 1 });
    const inkAt1x = (text: string) => {
      setPixelText(amount, text);
      const ink = inkSpan(amount);
      return ink.right - ink.left;
    };
    const { scale, text } = bankFit(inkAt1x, [
      `$${dollarAmountText(save.bankCents)}`,
      `$${shortDollarAmountText(save.bankCents)}`,
    ]);
    setPixelText(amount, text);
    const whole = inkSpan(amount);
    const wholeAdvance = amount.width;
    setPixelText(amount, text.slice(1));
    const x = bankLeft((whole.right - whole.left) * scale) - whole.left * scale;
    const top = bank.capsY[scale];
    scalePixelText(dollar, scale, x, top);
    scalePixelText(amount, scale, x + (wholeAdvance - amount.width) * scale, top);
    this.iconButton(root, "logbook", LOGBOOK_FACE, (x, y) => {
      const icon = imageIcon(this, "icon-logbook", x, y);
      return icon.length > 0
        ? icon
        : [addPixelText(this, x + 8, y + 4, "L", { color: PALETTE.plum, originX: 0.5 })];
    });
    this.iconButton(root, "settings", SETTINGS_FACE, (x, y) => {
      const icon = imageIcon(this, "icon-settings", x, y);
      return icon.length > 0 ? icon : cogIcon(this, x, y);
    });
    this.iconButton(root, "help", HELP_FACE, (x, y) => imageIcon(this, "icon-help", x, y));
    this.iconButton(root, "mute", MUTE_FACE, (x, y) => soundIcon(this, !isMuted(this), x, y));
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
      root.add(addFigure(this, reduced, "idle", key).sprite.setPosition(x, footY));
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
    const groundColor = (atX: number) =>
      atX >= PATH.x && atX < PATH.x + PATH.width ? PALETTE.brown : PALETTE.darkGreen;
    const dogs = this.loadout.dogs.map((dog, rank) => {
      const placement = itemAt(GATE_SPOTS, rank);
      return {
        dog,
        feet: { footY: footY + placement.footDy, x: x + placement.dx },
        placement,
        rank,
      };
    });
    // With no walker picked, the dogs stand without leashes.
    const figures = new PackFigures(
      this,
      { still: reduced, tag: "walk" },
      walkerKey,
      this.loadout.dogs,
    );
    const shadow = (key: string, depth: number, atX: number, atFootY: number) =>
      drawShadow(g, groundColor(atX), atX, atFootY, spriteMetrics(key).opaqueWidth * depth);
    const look = { color: YARD_LEASH_COLOR, taut: null };
    figures.stand(0, shadow, look, { dogs, walker: { footY, x } });
    root.add(figures.layers());
    const now = this.time.now;
    for (const { dog, feet } of dogs) {
      const sprite = figures.dogs.get(dog);
      if (sprite !== undefined) {
        this.gateDogs.push({ dog, footY: feet.footY, sprite });
      }
      // A dog that just joined hops onto the path in a puff of dust.
      const popped = this.pops.get(`dog:${dog}`);
      if (!reduced && popped !== undefined && now - popped < FEEDBACK.dustFrameMs) {
        playEffect(this, "fx-dust", "play", { x: feet.x, y: feet.footY - 6 }, 0);
      }
    }

    const state = { action: this.action, loadout: this.loadout };
    const speech = bubbleSpeech(
      gameData.homeText,
      save.walker === null ? "noWalker" : this.walkerLine,
      state,
      this.quips,
    );
    const unsaved = storageState(this) === "unavailable" ? [gameData.homeText.unsaved] : [];
    const probe = this.text(root, 0, 0, "", PALETTE.plum).setVisible(false);
    const measure = (line: string) => {
      setPixelText(probe, line);
      return probe.width;
    };
    const lines = speechLines(measure, SPEECH_ROOM, SPEECH.lines, [...unsaved, ...speech]);
    probe.destroy();
    const top = GATE.y + SPEECH.top;
    // The bubble goes under the words, which set its size.
    const bubble = this.add.container(0, 0);
    root.add(bubble);
    const body = pixelFontMetrics(this, "body");
    const pitch = body.lineHeight * TEXT_SCALE;
    const labels = lines.map((line, i) =>
      this.text(root, x, top + SPEECH.padTop + i * pitch, line, PALETTE.plum, { originX: 0.5 }),
    );
    const width = Math.ceil(Math.max(...labels.map((label) => label.width))) + 2 * SPEECH.padX;
    const height = speechBubbleHeight(body, lines.length);
    // A bubble tall enough to reach the Pet shop's board moves left to keep clear of it.
    const board = PET_SHOP_BOARD;
    const centred = Math.round(x - width / 2);
    const rect = bubbleRect(board, SPEECH, { x, y: top }, { height, width });
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

    // Equipped gear shows as a badge beside the walker, moved right of any dog whose feet
    // are below its top, and kept clear of the Pet shop.
    if (this.loadout.gear !== null) {
      const clear = Math.max(
        GEAR_BADGE.x,
        ...dogs
          .filter(({ feet }) => feet.footY > GEAR_BADGE.y)
          .map(
            ({ dog, feet }) =>
              feet.x + Math.ceil(spriteMetrics(dogSpriteKey(gameData, dog)).opaqueWidth / 2) + 1,
          ),
      );
      const rect = { ...GEAR_BADGE, x: Math.min(clear, PET_SHOP.x - GEAR_BADGE.width) };
      const badge = this.tileView(root, "gateBadge");
      badge.rise = `gear:${this.loadout.gear}`;
      fillRect(this.graphics(badge.container), PALETTE.plum, rect);
      const at = { x: rect.x + 1, y: rect.y + 1 };
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

  // A locked item's price (or goal) on the plate its look sets. originX places it by its left
  // (0) or centre (0.5).
  private lockedPlate(
    parent: GameObjects.Container,
    tile: ItemTile,
    at: { capY: number; originX: number; x: number },
  ): void {
    const { plate } = itemTileLook(tile);
    const text =
      tile.kind === "locked" ? dollarText(tile.price) : tile.kind === "goal" ? tile.goal : null;
    if (text !== null && plate !== null) {
      addPlate(this, parent, at, text, plateColors(plate));
    }
  }

  private drawDogTiles(root: GameObjects.Container, save: SaveDocument): void {
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
      const { art, padlock, state } = itemTileLook(tile);
      const { content, look, view } = this.selectTile(root, `dog:${id}`, rect, {
        // A picked dog wears a tick: the game sets the pack's order by the dogs' sizes.
        badge: "tick",
        edge: true,
        state,
        tile: true,
      });
      const ink = PALETTE[look.text];
      const { face: faceBox, lock: dogLock, lockedNameY, textX } = DOG_TILE;
      fillRect(this.graphics(content), PALETTE[look.box], {
        height: faceBox.size + 2,
        width: faceBox.size + 2,
        x: x + faceBox.dx - 1,
        y: y + faceBox.dy - 1,
      });
      const faceKey = dogFaceKey(gameData, id);
      const faceTag = padlock === null ? "happy" : "neutral";
      const faceAt = { x: x + faceBox.dx, y: y + faceBox.dy };
      const face =
        art === "silhouette"
          ? this.add
              .sprite(
                faceAt.x,
                faceAt.y,
                artTextureKey(this, art, faceKey),
                tagFrame(this, faceKey, faceTag),
              )
              .setOrigin(0)
          : addTileSprite(this, state, reduced, faceKey, faceTag, faceAt);
      content.add(face);
      view.face = { object: face, y: faceAt.y };

      const body = pixelFontMetrics(this, "body");
      const fitText = (value: string, top: number) => {
        const label = this.text(content, x + textX, top, value, ink);
        this.fitOnRow(label, { room: DOG_TILE_TEXT_ROOM, styles: TEXT_FIT_STYLES }, x + textX, top);
      };
      if (padlock === null) {
        // Every dog earns the same pay, so an owned tile names the dog alone; its card says the pay.
        fitText(dog.name, y + dogTileNameY(body));
        return;
      }
      // A locked dog shows "???", its padlock and its price plate.
      fitText(gameData.homeText.lockedName, y + lockedNameY);
      addLock(this, content, padlock, { x: x + dogLock.dx, y: y + dogLock.dy });
      const plateY = dogTilePlateY(body);
      this.lockedPlate(content, tile, { capY: y + plateY - 1, originX: 0, x: x + textX });
    });
  }

  // The Pocket section's tiles, one per gear item in shop order; a hold shows an item's
  // effect. Pocketing an item replaces any other, so the Pocket is never full.
  private drawPocket(root: GameObjects.Container, save: SaveDocument): void {
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
      const { padlock, state } = itemTileLook(tile);
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
      if (padlock !== null) {
        addLock(this, content, padlock, { x: x + lock.dx, y: y + lock.dy });
        const plateAt = { capY: y + POCKET.priceY, originX: 0.5, x: x + width / 2 };
        this.lockedPlate(content, tile, plateAt);
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
        typeof tile === "string"
          ? tileTextureKey(this, tile, key)
          : artTextureKey(this, itemTileLook(tile).art, key);
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
  // portrait with its perk icon and its name beside it; a locked one its silhouette, the
  // padlock and its name plate.
  private drawWalkerPicker(root: GameObjects.Container, save: SaveDocument): void {
    const reduced = currentSettings(this).reducedMotion;
    const tiles = walkerTiles();
    walkerIds().forEach((id, i) => {
      const rect = itemAt(tiles, i);
      const { x, y } = rect;
      const tile = walkerTile(gameData, save, id);
      const { art, padlock, state } = itemTileLook(tile);
      const { content, look, view } = this.selectTile(root, `walker:${id}`, rect, {
        badge: "tick",
        edge: true,
        state,
        tile: true,
      });
      const { box, face: faceAt, icons, lock, name, plateY } = WALKER_TILE;
      fillRect(this.graphics(content), PALETTE[look.box], {
        height: box.size,
        width: box.size,
        x: x + box.dx,
        y: y + box.dy,
      });
      const walker = gameData.walkers[id];
      const at = { x: x + faceAt.dx, y: y + faceAt.dy };
      const locked = padlock !== null;
      if (this.textures.exists(walker.portraitKey)) {
        const tag = tile.kind === "picked" ? "happy" : "neutral";
        const face = locked
          ? this.add
              .sprite(
                at.x,
                at.y,
                artTextureKey(this, art, walker.portraitKey),
                tagFrame(this, walker.portraitKey, tag),
              )
              .setOrigin(0)
          : addTileSprite(this, state, reduced, walker.portraitKey, tag, at);
        content.add(face);
        view.face = { object: face, y: at.y };
      } else {
        const centre = { x: x + box.dx + box.size / 2, y: y + box.dy + box.size / 2 };
        const initial = (locked ? gameData.homeText.lockedName : walker.name).charAt(0);
        this.text(content, centre.x, centre.y, initial, PALETTE[look.text], {
          font: "title",
          originX: 0.5,
          originY: 0.5,
        });
      }
      if (padlock !== null) {
        addLock(this, content, padlock, { x: x + lock.dx, y: y + lock.dy });
        const plateAt = { capY: y + plateY, originX: 0.5, x: x + rect.width / 2 };
        this.lockedPlate(content, tile, plateAt);
        return;
      }
      this.text(content, x + name.x, y + name.capY, walker.name, PALETTE.ink, {
        originX: 0.5,
        scale: 1,
      });
      walkerEffectItems(gameData, id).forEach((item, n) => {
        const iconAt = { x: x + icons.dx, y: y + itemAt(icons.dy, n) };
        const key = effectIconKey(item);
        if (this.textures.exists(key)) {
          const shown = tileTextureKey(this, state, key);
          content.add(this.add.image(iconAt.x, iconAt.y, shown).setOrigin(0));
          return;
        }
        const half = EFFECT_ICON_SIZE / 2;
        const letter = effectIconFallback(gameData, item);
        this.text(content, iconAt.x + half, iconAt.y + half, letter, PALETTE[look.text], {
          originX: 0.5,
          originY: 0.5,
        });
      });
    });
  }

  // Start walk keeps its words and place in every state but one. Ready, it is primary: the
  // raised green go button, sinking into its lip when pressed, drawn twice, raised and pressed,
  // and the frame shows one. Not ready, it is disabled: a flat sunk face that never moves.
  // Pressed while the walk's art loads, its pressed face says so, in words that keep still.
  private drawStartButton(root: GameObjects.Container, ready: boolean): void {
    const { height, width, x, y } = START_BUTTON;
    const container = this.add.container(0, 0);
    root.add(container);
    const { startLoading: loadingLabel, startWalk: label } = gameData.homeText;
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
      const loading = down && this.artWait?.kind === "start";
      const text = this.text(group, x + width / 2, y + top, loading ? loadingLabel : label, color, {
        font: "title",
        originX: 0.5,
        scale: START_LABEL.scale,
      });
      if (loading) {
        // Centred on the ready label's caps, at whichever size fits.
        const { scale } = fitPixelText(text, START_LOADING, x + width / 2, y + top).style;
        const { capHeight } = pixelFontMetrics(this, "title");
        const lower = Math.round(((START_LABEL.scale - scale) * capHeight) / 2);
        scalePixelText(text, scale, x + width / 2, y + top + lower);
      }
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
