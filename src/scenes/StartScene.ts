import { clampIndex, itemAt } from "@andornaut/game-kit/arrays";
import { containsPoint, insetRect, type Rect } from "@andornaut/game-kit/rect";
import { type GameObjects, Scene, type Time } from "phaser";

import {
  dogFaceKey,
  dogSpriteKey,
  gearIconKey,
  ownerFaceKey,
  walkerPortraitKey,
} from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_LAYOUT } from "../data/screen";
import type { DogId, GearId, WalkerId } from "../data/types";
import { clearRunOverrides } from "../dev/pageRunSetup";
import { startWalkOpensHelp } from "../help/helpSeen";
import { bankAtLastVisit, newlyAffordable } from "../home/afford";
import { bubbleLines, bubbleRect, bubbleSize, ownerColumn, ownerPlace } from "../home/bubbleRect";
import {
  type DetailCard,
  type DetailPicture,
  dogDetail,
  gearDetail,
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
  gearByPrice,
  gearInfo,
  type HomeLoadout,
  isAffordable,
  packCapacity,
  partingSpeech,
  type Purchase,
  purchasePrice,
  rosterRows,
  shortDollarAmountText,
  tapDog,
  tapGear,
} from "../home/home";
import { homeBackAction, homeBarButtonAt, overlayRegion, regionOutside } from "../home/homeBar";
import {
  bankAmountText,
  bankWell,
  dogTileNameY,
  dogTilePlateY,
  HOME_LAYOUT,
  type HomeBarButton,
  homeBarButtons,
  sectionFill,
  slotSignText,
  updateModalLayout,
} from "../home/homeLayout";
import {
  bubbleSpeech,
  bubbleTurnLine,
  gateTop,
  type HomeAction,
  packBonusLine,
  type PlateMode,
  storageNotice,
  tappedBubbleTurn,
  type WalkerLine,
  walkerLineKey,
  walkerSays,
  walkersUnlockedSince,
} from "../home/homeLines";
import { porchOwners } from "../home/porch";
import {
  homeSections,
  type Section,
  type SectionId,
  type Sections,
  type SectionState,
  startReady,
} from "../home/sections";
import { shopAffordable } from "../home/shop";
import { slotSign, slotSignPurchase } from "../home/slotSign";
import { tapWalker, walkerTile } from "../home/walkers";
import {
  EFFECT_ICON_SIZE,
  effectIconFallback,
  effectIconKey,
  walkerEffectItems,
} from "../hud/effectIcons";
import { withNamePills } from "../hud/effectNames";
import { downTail } from "../hud/moments";
import {
  type HoldPress,
  holdRule,
  moveHold,
  releaseHold,
  startHold,
  tickHold,
  TILE_SLOP_PX,
} from "../input/hold";
import { isConfirmKey, isExitKey, isMuteKey, isPauseKey, menuKeyActs } from "../input/keyBindings";
import type { PackPlacement } from "../layout/packFormation";
import { addFigure, PackFigures } from "../pack/phaser/packFigures";
import {
  acceptUpdate,
  exitShown,
  installNudgeDue,
  noteInstallNudged,
  PHONE_EVENTS,
  startWakeLock,
  stopWakeLock,
  updatePlateShown,
} from "../pwa";
import { walkerOrder } from "../rules/walkers";
import type { SaveDocument } from "../save/schema";
import { walksFinished, walksPlayed } from "../save/stats";
import { packDogsOf } from "../state/pack";
import { closeControl } from "../ui/closeControl";
import { gridRects, rectIndexAt } from "../ui/grid";
import {
  type ArtLook,
  buttonState,
  type ItemTile,
  itemTile,
  itemTileLook,
} from "../ui/interaction";
import { PALETTE } from "../ui/palette";
import {
  addDim,
  drawFocusRing,
  drawFramedRect,
  drawRing,
  drawShadow,
  fillRect,
} from "../ui/phaser/draw";
import {
  addPixelText,
  type FontRole,
  inkSpan,
  pixelFontMetrics,
  placePixelText,
  setPixelText,
  withProbe,
} from "../ui/phaser/pixelText";
import { BUTTON_COLOURS, GREYED, pictureBox, type SelectLook } from "../ui/selection";
import { TEXT_SCALE } from "../ui/textFit";
import { topBarRects } from "../ui/topBarTrim";
import type { Cents } from "../units";
import { artReady, whenArtReady } from "./artReady";
import type { CelebrationSceneData } from "./CelebrationScene";
import { addNamePills } from "./effectNameColours";
import { HELP_CLOSED_EVENT } from "./HelpScene";
import { openHelp } from "./helpScreen";
import { exitGame, HOME_PAGE_OPENING_EVENT, openHomePage } from "./homeBarPress";
import { addAffordFrame, addModalCard, drawDetailCard } from "./homePanels";
import {
  addPlate,
  addTileBadge,
  drawPetShopFallback,
  plateColours,
  purchasePicture,
  SHOP_ART,
} from "./itemArt";
import { modalTextWidth } from "./modalMeasure";
import { listenOnePress } from "./onePress";
import {
  BAR_MUTED_EVENT,
  listenOutsideTap,
  onBackPressed,
  onceSceneEvent,
  onSceneEvent,
  onWindowEvent,
  openOverlay,
  type OverlayData,
} from "./overlay";
import { afterMsUnderOverlay } from "./overlayClock";
import { addOwnerFigure } from "./ownerFigure";
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
import { SETTINGS_CLOSED_EVENT } from "./SettingsScene";
import {
  SHOP_CHANGED_EVENT,
  SHOP_CLOSED_EVENT,
  type ShopClosed,
  type ShopSceneData,
} from "./ShopScene";
import { playEffect, playTag, spriteMetrics } from "./sprites";
import {
  addBodyText,
  addGraphicsIn,
  addIconButton,
  addMenuButton,
  addNineSlice,
  addPanel,
  addSelectTile,
  addTagImage,
  addTapBurst,
  addTileSprite,
  BODY_TEXT,
  BUTTON_PRESS_PX,
  buttonFaces,
  exitIcon,
  type IconButton,
  imageIcon,
  imageIconOr,
  type SelectTile,
  type SelectTileOptions,
  setDollarAmount,
  settingsIcon,
  soundIcon,
  tagFrame,
  tileTextureKey,
} from "./uiKit";

const SCREEN = SCREEN_LAYOUT.screen;
const HOME_REGION = overlayRegion("home");
const GATE = HOME_LAYOUT.gate;
const PATH = HOME_LAYOUT.path;
const WALKER_AT_GATE = HOME_LAYOUT.walkerAtGate;
const GATE_SPOTS: readonly PackPlacement[] = HOME_LAYOUT.gateSpots;
const PORCH_SPOTS: Readonly<Partial<Record<DogId, { footY: number; x: number }>>> =
  HOME_LAYOUT.porchSpots;
const PORCH_DOG_OFFSET = HOME_LAYOUT.porchDogOffset;
const TOP_BAR = HOME_LAYOUT.topBar;
const PET_SHOP: Rect = HOME_LAYOUT.petShop;
const PET_SHOP_BOARD: Rect = HOME_LAYOUT.petShop.board;
const SLOT_SIGN = HOME_LAYOUT.slotSign;
const SECTION_FILL_KEYS = HOME_LAYOUT.sectionFillKeys;
const POCKET = HOME_LAYOUT.pocket;
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
const GEAR_BADGE: Rect = HOME_LAYOUT.gearBadge;
// The keyboard ring sits outside the ui-select frame.
const FOCUS_OUTSET = 5;

// The walker's speech bubble: its place, padding and most lines.
const SPEECH = HOME_LAYOUT.speech;

function walkerIds(): WalkerId[] {
  return walkerOrder(gameData);
}

const SECTION_IDS: readonly SectionId[] = ["walker", "dogs", "pocket"];

function gearIds(): GearId[] {
  return gearByPrice(gameData);
}

type DetailTarget =
  | { dog: DogId; kind: "dog" }
  | { gear: GearId; kind: "gear" }
  | { kind: "walker"; walker: WalkerId };

type Target =
  | { dog: DogId; kind: "dog" }
  | { gear: GearId; kind: "gear" }
  | { kind: "bubble" }
  | { kind: "exit" }
  | { kind: "help" }
  | { kind: "logbook" }
  | { kind: "mute" }
  | { kind: "petShop" }
  | { kind: "settings" }
  | { kind: "slotSign" }
  | { kind: "start" }
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

// The roster as the grid lays it out, row by row (rosterRows): tiles, taps and keyboard focus
// all read this one order.
function rosterOrder(): DogId[] {
  return rosterRows(gameData).flat();
}

function dogTiles(): Rect[] {
  return gridRects(DOG_TILES, rosterOrder().length, DOG_ORIGIN);
}

// A dog tile as drawn, inside its hit area.
function dogFace(hit: Rect): Rect {
  return { ...hit, height: hit.height - DOG_TILE_INSET * 2, y: hit.y + DOG_TILE_INSET };
}

// The Pocket section's cells, cheapest first (gearByPrice); each draws its tile inset inside.
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

// The keyboard's rows, top to bottom as the screen shows them: the dog slot sign while it
// shows and the Pet shop, the walkers, the dog rows,
// the Pocket and Start walk.
function focusRows(shown: { sign: boolean }): Focusable[][] {
  const walkers = walkerTiles();
  const sign: Focusable = { rect: SLOT_SIGN.board, target: { kind: "slotSign" } };
  const rows: Focusable[][] = [
    [...(shown.sign ? [sign] : []), { rect: PET_SHOP, target: { kind: "petShop" } }],
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

// A held item's detail card or the dismissible update notice, above the home screen.
type Overlay = { rect: Rect | undefined } & ({ mode: PlateMode } | { target: DetailTarget });

// A tile that reacts to taps: its container moves for the dip, lift and shake, its face hops,
// and its mark pops.
interface TileView {
  // The dog slot sign hangs from the Pet shop, so it rises and falls with the shop's bob.
  bobsWithShop?: boolean;
  container: GameObjects.Container;
  face?: { object: GameObjects.Image | GameObjects.Sprite; y: number };
  // The Pet shop's glint frames, shown in place of its normal face while one plays.
  glint?: { frames: readonly (string | number)[]; image: GameObjects.Image };
  // A button with a pressed face shows it rather than dipping.
  iconButton?: IconButton;
  lift: number;
  mark?: { image: GameObjects.Image; y: number };
  // The pop timer that raises the whole tile for a moment, for the gear badge at the gate.
  rise?: string;
  // The Pet shop's normal face, which the glint covers.
  shopNormal?: GameObjects.Image;
}

// The heart after the Dogs band's pack-size bonus.
const HEART_KEY = "ui-heart";

// The bank the last time the home screen was shown this session, so the walker can say
// when something new became affordable.
const LAST_VISIT_BANK_KEY = "homeLastVisitBank";
// The walkers owned the last time the home screen was shown this session, so the walker can
// say when one has just been unlocked. A session's first visit has none to compare with.
const LAST_VISIT_WALKERS_KEY = "homeLastVisitWalkers";

// The screen before a walk: the bank at the top bar's left and Logbook, Help, Sound, Settings
// and Exit at its right (Exit where exitShown); the walker and pack at the gate beside the Pet
// shop; the Walker, Dogs and Pocket sections and Start walk. A waiting game update opens a
// dismissible modal. Buying happens only in the
// shop: tapping the building opens it, and tapping a locked dog, gear item or the dog slot sign
// opens it on that item. Holding a dog or gear tile opens its detail card.
// The arrow keys move a focus ring, Enter or Space picks, Escape, P or back closes a card, ?
// opens help, S settings, L the logbook, M mutes and Q leaves the game as Exit does, where the
// top bar shows Exit. Start walk and help wait for boot to load the rest of the art, which it
// does behind this screen.
export class StartScene extends Scene {
  // The last action, for the message line and the bubble.
  private action: HomeAction = { kind: "none" };
  // A press of Start walk or help made before boot has loaded the rest of the art: the latest
  // runs once it has, and Start walk shows held down and dimmed while it waits.
  private artWait: { action: () => void; kind: "help" | "start" } | undefined;
  // Whether the top bar shows Exit (exitShown).
  private exit = true;
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
  private shownUpdate: PlateMode | undefined;
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
  // The walkers unlocked since the last visit, in unlock order, whom the walker's newWalker line
  // names one at a time; bubbleTurn counts the taps on the bubble or the walker at the gate
  // that move it on (bubbleTurnLine), and usualLine is the walker's line without the news.
  private joined: WalkerId[] = [];
  private bubbleTurn = 0;
  private usualLine: WalkerLine = "afterWalk";
  // Where a tap moves the bubble on: the bubble and the walker at the gate, as last drawn.
  private bubbleHits: Rect[] = [];

  constructor() {
    super(SCENE_KEYS.start);
  }

  create(): void {
    this.action = { kind: "none" };
    this.artWait = undefined;
    this.exit = exitShown();
    this.focus = null;
    this.hold = undefined;
    this.overlay = undefined;
    this.overlayPress = undefined;
    this.shownUpdate = undefined;
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
    this.joined = walkersUnlockedSince(gameData, walkersBefore, owned.walkers);
    this.bubbleTurn = 0;
    const news = {
      affordable: newlyAffordable(gameData, owned, before, bankCents),
      walker: this.joined.length > 0,
    };
    // Once per device, after the first finished walk, in place of the how-to or welcome back.
    const suggestInstall = walksFinished(stats) > 0 && installNudgeDue();
    this.walkerLine = walkerLineKey(stats.lastWalk, news, suggestInstall, walksPlayed(stats));
    // The install suggestion waits for a visit it leads.
    const quiet = { ...news, walker: false };
    this.usualLine = walkerLineKey(stats.lastWalk, quiet, false, walksPlayed(stats));
    if (this.walkerLine === "install") {
      noteInstallNudged();
    }
    stopWakeLock();
    clearRunOverrides();

    this.drawGate();
    this.root = this.add.container(0, 0);
    this.overlayLayer = this.add.container(0, 0);
    this.render();

    listenOnePress(this, {
      down: (pointer) => {
        addTapBurst(this, pointer.x, pointer.y);
        // The top bar stays lit over an open card, and its buttons take their presses.
        if (
          this.overlay !== undefined &&
          homeBarButtonAt(this.exit, pointer.x, pointer.y) === undefined
        ) {
          this.overlayPress = { x: pointer.x, y: pointer.y };
          if (this.closePressed() || this.updatePressed()) {
            this.render();
          }
          return;
        }
        this.pressedTarget = this.targetAt(pointer.x, pointer.y);
        const kind = this.pressedTarget?.kind;
        this.hold =
          kind === "dog" || kind === "gear" || kind === "walker"
            ? startHold(
                holdRule(gameData.tuning, TILE_SLOP_PX),
                { x: pointer.x, y: pointer.y },
                this.time.now,
              )
            : undefined;
        this.press =
          this.pressedTarget === undefined
            ? undefined
            : { held: true, id: targetId(this.pressedTarget), startedMs: this.time.now };
      },
      move: (pointer) => {
        if (this.hold !== undefined && pointer.isDown) {
          this.hold = moveHold({ x: pointer.x, y: pointer.y }, this.hold);
        }
      },
      up: (pointer, cancelled) => {
        const down = this.overlayPress;
        const controlDown = this.closePressed() || this.updatePressed();
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
        const release = this.hold === undefined ? "tap" : releaseHold(this.time.now, this.hold);
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
        return rect === undefined ? undefined : regionOutside(this.exit, "home", [rect]);
      },
      () => this.closeOverlay(),
    );
    // Back closes an open detail card, as Escape does, and with none asks Quit?.
    onBackPressed(this, () => {
      const action = homeBackAction(this.overlay !== undefined);
      if (action === "closeDetail") {
        this.closeOverlay();
      } else {
        const data: OverlayData = { resume: SCENE_KEYS.start };
        openOverlay(this, SCENE_KEYS.quit, data);
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
    // Sound on the top bar, tapped over an overlay, which takes the press.
    onSceneEvent(this, this.game.events, BAR_MUTED_EVENT, (muted: boolean) =>
      this.showMuted(muted),
    );
    // A page the top bar opens closes the detail card first.
    onSceneEvent(this, this.game.events, HOME_PAGE_OPENING_EVENT, () => {
      if (this.overlay !== undefined) {
        this.closeOverlay();
      }
    });
    // The shop draws under the top bar, so the bank there follows each purchase; on close
    // the walker says the shop's last purchase or refusal.
    onSceneEvent(this, this.game.events, SHOP_CHANGED_EVENT, () => this.render());
    onSceneEvent(this, this.game.events, SHOP_CLOSED_EVENT, (closed: ShopClosed) =>
      this.shopClosed(closed),
    );
    // A newer version can open the home update modal.
    onWindowEvent(this, PHONE_EVENTS.updatePlate, () => this.render());
    // A tap made while another tap's act opened help, settings or stats over this screen is
    // dropped, so it cannot act once the screen resumes, as is a press waiting for the art and
    // a press still down, whose release lands on the overlay. The dip of the tap that opened
    // the page plays on under it, on a clock that runs while this screen is paused.
    onSceneEvent(this, this.events, "pause", () => {
      this.pending.forEach((timer) => timer.remove());
      this.pending.clear();
      this.artWait = undefined;
      const lifted = this.closePressed();
      const dipping = this.press?.held === false ? this.press : undefined;
      this.hold = undefined;
      this.overlayPress = undefined;
      this.press = dipping;
      this.pressedTarget = undefined;
      if (lifted) {
        this.render();
      }
      if (dipping !== undefined) {
        // Drawn now, for a tap too quick for a frame to have shown it.
        this.place(this.time.now);
        afterMsUnderOverlay(this, settleDelay(this.time.now, dipping.startedMs), () => {
          if (this.press === dipping) {
            this.press = undefined;
            this.place(this.time.now);
          }
        });
      }
    });
  }

  private onKey(key: string): void {
    if (this.overlay !== undefined) {
      if (isConfirmKey(key) && "mode" in this.overlay) {
        acceptUpdate();
      } else if (isPauseKey(key) || isConfirmKey(key)) {
        this.closeOverlay();
      }
      return;
    }
    const direction = focusDirectionForKey(key);
    if (direction !== undefined) {
      const rows = focusRows(this.shownControls());
      this.focus = moveFocus(
        rows.map((row) => row.length),
        direction,
        this.focus,
      );
      this.action = this.focusAction(this.focused()?.target);
      this.render();
      return;
    }
    if (isConfirmKey(key)) {
      const target = this.focused()?.target ?? { kind: "start" };
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
    } else if (isExitKey(key) && this.exit) {
      this.act({ kind: "exit" });
    }
  }

  private save(): SaveDocument {
    return profileSave(this);
  }

  // The focused item, its column kept inside its row: the top row loses the dog slot sign once
  // the last slot is bought.
  private focused(): Focusable | undefined {
    if (this.focus === null) {
      return undefined;
    }
    const row = focusRows(this.shownControls())[this.focus.row] ?? [];
    return row[clampIndex(row.length, this.focus.column)];
  }

  // Whether the dog slot sign shows: while a dog slot is for sale.
  private signShown(): boolean {
    const { bankCents, owned } = this.save();
    return slotSign(gameData, owned, bankCents) !== null;
  }

  // Which update notice is eligible, or the normal home screen.
  private gateTop(): ReturnType<typeof gateTop> {
    return gateTop(updatePlateShown(), storageState(this));
  }

  // The dog slot sign comes and goes while a slot is for sale.
  private shownControls(): { sign: boolean } {
    return { sign: this.signShown() };
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
    this.overlay = { rect: undefined, target };
    this.render();
  }

  private closeOverlay(): void {
    this.overlay = undefined;
    this.render();
  }

  // Whether the press under way started on the open card's close control.
  private closePressed(): boolean {
    const rect = this.overlay?.rect;
    const down = this.overlayPress;
    return (
      rect !== undefined &&
      down !== undefined &&
      containsPoint(closeControl(rect).hit, down.x, down.y)
    );
  }

  private updateLayout(mode: PlateMode) {
    const title = modalTextWidth(this, "title", [gameData.homeText[mode].title]);
    return updateModalLayout(HOME_REGION, {
      action: modalTextWidth(this, "title", [gameData.homeText[mode].button]),
      title,
    });
  }

  private updatePressed(): boolean {
    const down = this.overlayPress;
    return (
      this.overlay !== undefined &&
      "mode" in this.overlay &&
      down !== undefined &&
      containsPoint(this.updateLayout(this.overlay.mode).hit, down.x, down.y)
    );
  }

  // Detail cards close on their body. The update notice acts only on its own controls.
  private releaseOnOverlay(down: { x: number; y: number }, x: number, y: number): void {
    const overlay = this.overlay;
    const rect = overlay?.rect;
    if (overlay === undefined || rect === undefined) {
      return;
    }
    if ("mode" in overlay) {
      const hit = this.updateLayout(overlay.mode).hit;
      const close = closeControl(rect).hit;
      if (containsPoint(close, down.x, down.y) && containsPoint(close, x, y)) {
        this.closeOverlay();
      } else if (containsPoint(hit, down.x, down.y) && containsPoint(hit, x, y)) {
        acceptUpdate();
      }
    } else if (containsPoint(rect, down.x, down.y) && containsPoint(rect, x, y)) {
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
    const bar = homeBarButtons(this.exit).map(([kind, { hit }]): [Rect, Target] => [hit, { kind }]);
    const fixed: readonly [Rect, Target][] = [
      [START_BUTTON, { kind: "start" }],
      ...bar,
      [PET_SHOP, { kind: "petShop" }],
    ];
    if (this.signShown() && containsPoint(SLOT_SIGN.hit, x, y)) {
      return { kind: "slotSign" };
    }
    const control = fixed.find(([rect]) => containsPoint(rect, x, y))?.[1];
    if (control !== undefined) {
      return control;
    }
    // Under the controls, the bubble and the walker at the gate take taps only on a visit with
    // walkers to name, with a walker picked to name them.
    const naming = this.joined.length > 0 && this.save().walker !== null;
    const onBubble = this.bubbleHits.some((hit) => containsPoint(hit, x, y));
    return naming && onBubble ? { kind: "bubble" } : undefined;
  }

  // The shop over everything below the top bar, framing the item tapped.
  private openShop(open: { focus?: Purchase }): void {
    const data: ShopSceneData = { ...open, resume: SCENE_KEYS.start };
    openOverlay(this, SCENE_KEYS.shop, data);
  }

  // The shop's last purchase or refusal, which its plate has said: a bought dog hops in and its
  // owner says a parting line in the walker's bubble.
  private shopClosed(closed: ShopClosed): void {
    const { action } = closed;
    if (action.kind === "bought" && action.purchase.kind === "dog") {
      this.pops.set(targetId({ dog: action.purchase.dog, kind: "dog" }), this.time.now);
      this.drawQuip(action.purchase.dog);
    }
    this.action = action;
    this.render();
  }

  // The speaking owner beside their parting line in the walker's bubble: their happy face over
  // tan in a 1px ink frame, and their name, already set in name, centred under it.
  private addSpeakingOwner(
    root: GameObjects.Container,
    reduced: boolean,
    dog: DogId,
    place: ReturnType<typeof ownerPlace>,
    name: GameObjects.BitmapText | undefined,
  ): void {
    const { face } = place;
    const g = addGraphicsIn(this, root);
    fillRect(g, PALETTE.tan, face);
    const key = ownerFaceKey(gameData, dog);
    if (this.textures.exists(key)) {
      const sprite = this.add.sprite(face.x, face.y, key).setOrigin(0);
      playTag(sprite, key, "happy", reduced);
      root.add(sprite);
    }
    drawRing(addGraphicsIn(this, root), PALETTE.ink, face, 1);
    if (name !== undefined) {
      const ink = inkSpan(name);
      placePixelText(name, place.name.x - (ink.left + ink.right) / 2, place.name.capY);
      root.bringToTop(name);
    }
  }

  // A dog's owner says a parting line when it is picked or bought; it is drawn once a visit.
  private drawQuip(dog: DogId): void {
    this.quips.set(dog, partingSpeech(gameData, Math.random, dog));
  }

  // A tap's result, such as the selected state, shows once its press has dipped. A tap that
  // opens a page opens it at once, its dip playing on under the page.
  private actAfterDip(target: Target): void {
    const press = this.press;
    const delay = press === undefined ? 0 : settleDelay(this.time.now, press.startedMs);
    if (delay === 0 || this.opensPage(target)) {
      this.act(target);
      return;
    }
    const timer = this.time.delayedCall(delay, () => {
      this.pending.delete(timer);
      this.act(target);
    });
    this.pending.add(timer);
  }

  // Whether act opens a page for target, or leaves the game: help, the Logbook, the settings or
  // the Pet shop, which a dog or gear not yet bought opens too, and Exit.
  private opensPage(target: Target): boolean {
    switch (target.kind) {
      case "dog":
      case "gear": {
        const { owned } = this.save();
        const tap =
          target.kind === "dog"
            ? tapDog(gameData, owned, target.dog, this.loadout)
            : tapGear(owned, target.gear, this.loadout);
        return tap.kind === "shop";
      }
      case "exit":
      case "help":
      case "logbook":
      case "petShop":
      case "settings":
      case "slotSign":
        return true;
      case "bubble":
      case "mute":
      case "start":
      case "walker":
        return false;
      default:
        target satisfies never;
        return false;
    }
  }

  private act(target: Target): void {
    const id = targetId(target);
    const now = this.time.now;
    switch (target.kind) {
      case "bubble":
        this.tapBubble();
        return;
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
      case "slotSign": {
        const focus = slotSignPurchase(gameData, this.save().owned);
        this.openShop(focus === null ? {} : { focus });
        return;
      }
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
      case "exit":
        exitGame();
        return;
      case "mute":
        this.showMuted(toggleMuted(this));
        return;
      case "help":
        this.afterArt("help", () => openHomePage(this, "help"));
        return;
      case "logbook":
        // The Logbook opens on its first tab, Badges.
        openHomePage(this, "logbook");
        return;
      case "settings":
        openHomePage(this, "settings");
        return;
      case "start":
        this.startWalk();
        return;
      default:
        target satisfies never;
    }
  }

  // The walker says sound went off or on, and the top bar's Sound button follows.
  private showMuted(muted: boolean): void {
    const { noticeSoundOff, noticeSoundOn } = gameData.homeText;
    this.action = { kind: "notice", text: muted ? noticeSoundOff : noticeSoundOn };
    this.render();
  }

  // Picks or drops a dog or gear item, and keeps the result as the last loadout.
  private setLoadout(next: HomeLoadout): void {
    const now = this.time.now;
    for (const dog of next.dogs.filter((picked) => !this.loadout.dogs.includes(picked))) {
      this.pops.set(targetId({ dog, kind: "dog" }), now);
      this.drawQuip(dog);
    }
    if (next.gear !== null && next.gear !== this.loadout.gear) {
      this.pops.set(targetId({ gear: next.gear, kind: "gear" }), now);
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
      dogSlots: save.owned.dogSlots.length,
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
    // The listener is added only if help opens, so a dropped open leaves none behind.
    if (openHelp(this, SCENE_KEYS.start)) {
      onceSceneEvent(this, this.game.events, HELP_CLOSED_EVENT, go);
    }
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
      const { fire, press } = tickHold(now, this.hold);
      this.hold = press;
      if (fire && this.pressedTarget !== undefined) {
        this.openDetail(this.pressedTarget);
      }
    }
    this.place(now);
  }

  // Moves what dips, bobs, shakes, hops and pops to where it is at now.
  private place(now: number): void {
    const reduced = currentSettings(this).reducedMotion;
    const pressed = this.press;
    const dip = (id: string) =>
      pressed?.id === id ? pressDip(pressed.held, now, pressed.startedMs) : 0;
    // The Pet shop's art bobs while it is not pressed, and the slot sign with it.
    const shopRise =
      this.views.get("petShop")?.glint === undefined || dip("petShop") > 0
        ? 0
        : shopBobOffset(reduced, now);
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
          (glint !== undefined || view.bobsWithShop === true ? shopRise : 0) +
          rise,
      );
      view.face?.object.setY(view.face.y + hopOffset(reduced, now, this.pops.get(id)));
      view.mark?.image.setY(view.mark.y + badgePopOffset(reduced, now, this.pops.get(id)));
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
      sprite.setY(footY + hopOffset(reduced, now, this.pops.get(targetId({ dog, kind: "dog" }))));
    }
  }

  // Text at the 2x body size unless told otherwise.
  private text(
    parent: GameObjects.Container,
    x: number,
    y: number,
    value: string,
    colour: number,
    options: { font?: FontRole; originX?: number; originY?: number; scale?: number } = {},
  ): GameObjects.BitmapText {
    return addBodyText(this, parent, { x, y }, value, { colour, ...options });
  }

  // The street, yard and porch come from the screen-home art, drawn once; a plain yard
  // stands in while the art is missing.
  private drawGate(): void {
    fillRect(this.add.graphics(), PALETTE.darkBrown, SCREEN);
    if (this.textures.exists("screen-home")) {
      this.add.image(0, 0, "screen-home").setOrigin(0);
    } else {
      const g = this.add.graphics();
      fillRect(g, PALETTE.darkSlate, {
        height: 52,
        width: SCREEN.width,
        x: 0,
        y: 40 + HOME_LAYOUT.heroOffsetY,
      });
      fillRect(g, PALETTE.lightGrey, {
        height: 34,
        width: SCREEN.width,
        x: 0,
        y: 92 + HOME_LAYOUT.heroOffsetY,
      });
      fillRect(g, PALETTE.green, {
        height: 70,
        width: SCREEN.width,
        x: 0,
        y: 126 + HOME_LAYOUT.heroOffsetY,
      });
      fillRect(g, PALETTE.tan, {
        height: 70,
        width: PATH.width,
        x: PATH.x,
        y: 126 + HOME_LAYOUT.heroOffsetY,
      });
      fillRect(g, PALETTE.brown, {
        height: HOME_LAYOUT.gateBar.height - 1,
        width: SCREEN.width,
        x: 0,
        y: HOME_LAYOUT.gateBar.y,
      });
    }
    const sign = HOME_LAYOUT.streetSign;
    addPixelText(this, sign.x, sign.y, gameData.homeText.gateSign, {
      colour: PALETTE.white,
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
    const g = addGraphicsIn(this, root);
    this.drawTopBar(root, g, save);
    this.drawPetShop(root, save);
    this.drawSlotSign(root, save);
    const top = this.gateTop();
    if (this.overlay !== undefined && "mode" in this.overlay && this.overlay.mode !== top) {
      this.overlay = undefined;
    }
    if (top === "bubble") {
      this.shownUpdate = undefined;
    } else if (this.overlay === undefined && this.shownUpdate !== top) {
      this.overlay = { mode: top, rect: this.updateLayout(top).panel };
      this.shownUpdate = top;
    }
    this.drawPackAtGate(root, g, save, true);
    fillRect(addGraphicsIn(this, root), PALETTE.plum, {
      height: 1,
      width: SCREEN.width,
      x: 0,
      y: HOME_LAYOUT.gateBar.y + HOME_LAYOUT.gateBar.height - 1,
    });
    const sections = this.sections(save);
    for (const id of SECTION_IDS) {
      const note = this.drawSection(root, id, SECTION_RECTS[id], sections[id]);
      if (id === "dogs") {
        this.drawPackBonus(root, SECTION_RECTS[id], note);
      }
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

  // Flat solid backings fill each section below its header, under the unchanged cards.
  private drawSectionFills(root: GameObjects.Container): void {
    for (const id of SECTION_IDS) {
      const key = SECTION_FILL_KEYS[id];
      const rect = sectionFill(SECTION_RECTS[id]);
      if (this.textures.exists(key)) {
        root.add(this.add.tileSprite(rect.x, rect.y, rect.width, rect.height, key).setOrigin(0));
      } else {
        fillRect(addGraphicsIn(this, root), PALETTE[HOME_LAYOUT.sectionLooks[id].fill], rect);
      }
    }
  }

  // The Dogs band's pack-size bonus (packBonusLine), when the pack's size raises its lead dog's
  // owner's max: its line in ink and then a full heart, ending HOME_LAYOUT.bonus.countGap left of
  // the pack count's left edge, or of the band's text inset with no count.
  private drawPackBonus(
    root: GameObjects.Container,
    rect: Rect,
    note: GameObjects.BitmapText | null,
  ): void {
    const line = packBonusLine(gameData, this.loadout);
    if (line === null) {
      return;
    }
    const { countGap, gap, heartInk, rise, scale } = HOME_LAYOUT.bonus;
    const y = rect.y + BAND_TEXT.y;
    const countLeft = note === null ? rect.x + rect.width - BAND_TEXT.inset : note.x - note.width;
    const heartLeft = countLeft - countGap - heartInk * scale;
    if (this.textures.exists(HEART_KEY)) {
      const heart = this.add
        .sprite(heartLeft, y - rise, HEART_KEY)
        .setOrigin(0)
        .setScale(scale);
      playTag(heart, HEART_KEY, "full");
      root.add(heart);
    }
    this.text(root, heartLeft - gap, y, line, PALETTE.ink, { font: "title", originX: 1 });
  }

  // A one-pixel section frame with its heading and note: amber when selected, or its
  // lighter section colour while neutral. Returns the note label, or null with none.
  private drawSection(
    root: GameObjects.Container,
    id: SectionId,
    rect: Rect,
    section: Section,
  ): GameObjects.BitmapText | null {
    const tag = section.state === "complete" ? "complete" : HOME_LAYOUT.sectionLooks[id].neutralTag;
    const frame = addNineSlice(this, "ui-section", rect, tag);
    if (frame === undefined) {
      this.drawSectionFrame(root, id, rect, section.state);
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
      lit ? PALETTE.ink : PALETTE[HOME_LAYOUT.sectionLooks[id].heading],
      {
        font: "title",
      },
    );
    const right = rect.x + rect.width - BAND_TEXT.inset;
    if (section.note === "") {
      return null;
    }
    return this.text(
      root,
      right,
      y,
      section.note,
      lit ? PALETTE.ink : PALETTE[HOME_LAYOUT.sectionLooks[id].note],
      {
        font: "title",
        originX: 1,
      },
    );
  }

  // The same thin rim and section-specific header while ui-section is missing.
  private drawSectionFrame(
    root: GameObjects.Container,
    id: SectionId,
    rect: Rect,
    state: SectionState,
  ): void {
    const g = addGraphicsIn(this, root);
    const lit = state === "complete";
    const { band, edge } = SECTION_FRAME;
    drawRing(g, PALETTE.plum, rect, 1);
    const width = rect.width - edge * 2;
    fillRect(g, lit ? PALETTE.amber : PALETTE[HOME_LAYOUT.sectionLooks[id].neutral], {
      height: band,
      width,
      x: rect.x + edge,
      y: rect.y + edge,
    });
    fillRect(g, PALETTE.plum, {
      height: 1,
      width,
      x: rect.x + edge,
      y: rect.y + edge + band,
    });
  }

  // The detail card over everything else, recording its rect for taps.
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
    if ("mode" in overlay) {
      this.drawUpdateModal(layer, overlay.mode);
      return;
    }
    const { target } = overlay;
    const card = this.detailCard(save, target);
    const picture = this.detailPicture(target);
    const rect = drawDetailCard(
      this,
      layer,
      HOME_REGION,
      this.closePressed(),
      card,
      picture,
      target.kind,
    );
    this.overlay = { ...overlay, rect };
  }

  // A dog, gear item or walker's full card, owned or not.
  private detailCard(save: SaveDocument, target: DetailTarget): DetailCard {
    const { bankCents, owned } = save;
    if (target.kind === "dog") {
      return dogDetail(gameData, owned, bankCents, target.dog);
    }
    if (target.kind === "gear") {
      return gearDetail(gameData, owned, bankCents, this.loadout, target.gear);
    }
    return walkerDetail(gameData, owned, target.walker);
  }

  private detailPicture(target: DetailTarget): DetailPicture {
    if (target.kind !== "walker") {
      return purchasePicture(target);
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
    if (tile.mark !== undefined) {
      view.mark = { image: tile.mark, y: tile.mark.y };
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
    icon: (x: number, y: number) => ReturnType<typeof imageIcon>,
  ): void {
    const view = this.tileView(root, id);
    view.iconButton = addIconButton(this, view.container, at.x, at.y, icon);
  }

  private drawTopBar(
    root: GameObjects.Container,
    g: GameObjects.Graphics,
    save: SaveDocument,
  ): void {
    const bar = { height: TOP_BAR.height, width: SCREEN.width, x: 0, y: 0 };
    topBarRects(bar).forEach(({ colour, rect }) => fillRect(g, PALETTE[colour], rect));
    // The bank in its well: the "$" and the amount at the bank's scale, one font advance apart,
    // in full where it fits and else in its short form, the well as wide as they need.
    const { bank, well, wellKeys } = TOP_BAR;
    const dollar = this.text(root, 0, 0, "$", PALETTE.amber, { font: "title", scale: 1 });
    const amount = this.text(root, 0, 0, "", PALETTE.cream, { font: "title", scale: 1 });
    const { capsY, pad, scale } = bank;
    const inkAt1x = (text: string) => {
      setPixelText(amount, text);
      const ink = inkSpan(amount);
      return ink.right - ink.left;
    };
    const shown = bankAmountText(inkAt1x, {
      full: dollarAmountText(save.bankCents),
      short: shortDollarAmountText(save.bankCents),
    });
    const rect = bankWell(inkAt1x(`$${shown}`) * scale);
    const pieces = Object.values(wellKeys);
    if (pieces.every((key) => this.textures.exists(key))) {
      const middle = rect.width - 2;
      root.add([
        this.add.image(rect.x, rect.y, wellKeys.left).setOrigin(0),
        this.add
          .image(rect.x + 1, rect.y, wellKeys.mid)
          .setOrigin(0)
          .setScale(middle, 1),
        this.add.image(rect.x + rect.width - 1, rect.y, wellKeys.right).setOrigin(0),
      ]);
    } else {
      const { lip } = well;
      fillRect(g, PALETTE.ink, { ...rect, height: rect.height - lip, width: rect.width - lip });
    }
    root.bringToTop(dollar);
    root.bringToTop(amount);
    setDollarAmount(dollar, amount, shown, () => ({ left: rect.x + pad, scale, top: capsY }));
    for (const [id, { face }] of homeBarButtons(this.exit)) {
      this.iconButton(root, id, face, (x, y) => this.barIcon(id, x, y));
    }
  }

  // A top bar button's icon on its face at (x, y).
  private barIcon(id: HomeBarButton, x: number, y: number): ReturnType<typeof imageIcon> {
    switch (id) {
      case "exit":
        return exitIcon(this, x, y);
      case "help":
        return imageIconOr(this, "icon-help", x, y, "?");
      case "logbook":
        return imageIconOr(this, "icon-logbook", x, y, "L");
      case "mute":
        return soundIcon(this, !isMuted(this), x, y);
      case "settings":
        return settingsIcon(this, x, y);
      default:
        return id satisfies never;
    }
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

  // The walker and pack at the gate, the walker's bubble over them when bubble is true, and the
  // gear badge.
  private drawPackAtGate(
    root: GameObjects.Container,
    g: GameObjects.Graphics,
    save: SaveDocument,
    bubble: boolean,
  ): void {
    const { footY, x } = WALKER_AT_GATE;
    const reduced = currentSettings(this).reducedMotion;
    this.drawPorch(root, g, save, reduced);
    const walkerKey = save.walker === null ? undefined : walkerSpriteKey(this, save.walker);
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
    figures.standInYard(g, { path: PATH, shadows: false }, { dogs, walker: { footY, x } });
    root.add(figures.layers());
    const walkerSprite = figures.walker?.sprite;
    this.bubbleHits = bubble && walkerSprite !== undefined ? [walkerSprite.getBounds()] : [];
    const now = this.time.now;
    for (const { dog, feet } of dogs) {
      const sprite = figures.dogs.get(dog);
      if (sprite !== undefined) {
        this.gateDogs.push({ dog, footY: feet.footY, sprite });
      }
      // A dog that just joined hops onto the path in a puff of dust.
      const popped = this.pops.get(targetId({ dog, kind: "dog" }));
      if (!reduced && popped !== undefined && now - popped < FEEDBACK.dustFrameMs) {
        playEffect(this, "fx-dust", "play", { x: feet.x, y: feet.footY - 6 }, 0);
      }
    }

    if (bubble) {
      this.drawBubble(root, save, reduced);
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
      badge.rise = targetId({ gear: this.loadout.gear, kind: "gear" });
      fillRect(addGraphicsIn(this, badge.container), PALETTE.plum, rect);
      const at = { x: rect.x + 1, y: rect.y + 1 };
      this.addGearIcon(badge.container, "colour", this.loadout.gear, at, 0.5);
    }
  }

  // The walker's own line (walkerSays): with walkers unlocked since the last visit, the one
  // bubbleTurn has reached.
  private walkerSaid(save: SaveDocument): string {
    if (save.walker === null) {
      return walkerSays(gameData, "noWalker", null);
    }
    if (this.joined.length === 0) {
      return walkerSays(gameData, this.walkerLine, null);
    }
    const { joined, line } = bubbleTurnLine(this.joined, this.usualLine, this.bubbleTurn);
    return walkerSays(gameData, line, joined);
  }

  // What the walker's bubble says (bubbleSpeech).
  private speech(save: SaveDocument): ReturnType<typeof bubbleSpeech> {
    const state = { action: this.action, loadout: this.loadout };
    return bubbleSpeech(gameData.homeText, this.walkerSaid(save), state, this.quips);
  }

  // A tap on the bubble or the walker at the gate: while the walker's own line shows, the next
  // turn (tappedBubbleTurn); else the message or owner's line clears and the walker's line
  // comes back.
  private tapBubble(): void {
    const save = this.save();
    const speech = this.speech(save);
    const own = speech.owner === null && speech.paragraphs.join("") === this.walkerSaid(save);
    this.bubbleTurn = tappedBubbleTurn(this.bubbleTurn, own);
    this.action = { kind: "none" };
    this.quips.clear();
    this.render();
  }

  // The walker's speech bubble over the gate, its tail's tip over the walker.
  private drawBubble(root: GameObjects.Container, save: SaveDocument, reduced: boolean): void {
    const { x } = WALKER_AT_GATE;
    const speech = this.speech(save);
    const notice = storageNotice(gameData.homeText, storageState(this));
    // The speaking owner's name, at 1x, sets their column's width.
    const ownerName = speech.owner === null ? undefined : gameData.dogs[speech.owner].owner.name;
    const nameLabel =
      ownerName === undefined
        ? undefined
        : this.text(root, 0, 0, ownerName, PALETTE.rust, { scale: 1 });
    const nameInk = nameLabel === undefined ? undefined : inkSpan(nameLabel);
    const column = nameInk === undefined ? null : ownerColumn(nameInk.right - nameInk.left);
    // A gear's focus line, "Running shoes: …", sets the gear's name in its pill.
    const paragraphs = [...notice, ...speech.paragraphs].map((paragraph) =>
      withNamePills(gameData, paragraph),
    );
    const { faced, lines } = withProbe(this, BODY_TEXT, (probe) => {
      const measure = (line: string) => {
        setPixelText(probe, line);
        return probe.width;
      };
      return bubbleLines(measure, column, paragraphs);
    });
    const top = GATE.y + SPEECH.top;
    // The bubble goes under the words, which set its size.
    const bubble = this.add.container(0, 0);
    root.add(bubble);
    const body = pixelFontMetrics(this, "body");
    const pitch = body.lineHeight * TEXT_SCALE;
    const labels = lines.map((line) => this.text(root, 0, 0, line, PALETTE.plum, { originX: 0.5 }));
    const widest = Math.ceil(Math.max(...labels.map((label) => label.width)));
    const size = bubbleSize(body, lines, widest, faced ? column : null);
    // A bubble tall enough to reach the Pet shop's board moves left to keep clear of it.
    const board = PET_SHOP_BOARD;
    const rect = bubbleRect(board, SPEECH, { x, y: top }, size);
    // Each line centred across the text's columns, its capitals textTop and a line apart down.
    labels.forEach((label, i) => {
      placePixelText(label, 0, rect.y + size.textTop + i * pitch);
      label.setX(rect.x + SPEECH.padX + widest / 2);
    });
    addNamePills(labels);
    bubble.add(addPanel(this, rect, "ui-quip"));
    this.bubbleHits.push(rect);
    if (!faced || speech.owner === null || column === null) {
      nameLabel?.destroy();
    } else {
      this.addSpeakingOwner(root, reduced, speech.owner, ownerPlace(rect, column), nameLabel);
    }
    // The tail's top row lies over the bubble's bottom rim, its tip over the walker.
    const tail = downTail((key) => this.textures.exists(key));
    if (tail !== undefined) {
      bubble.add(this.add.image(x - tail.tipX, top + size.height - 1, tail.key).setOrigin(0));
    }
  }

  // A waiting version or a newer save opens once per home visit or change of notice mode.
  // Closing leaves the home screen usable; Update now keeps the existing acceptUpdate action.
  private drawUpdateModal(root: GameObjects.Container, mode: PlateMode): void {
    const { button, panel } = this.updateLayout(mode);
    const text = gameData.homeText[mode];
    root.add(addDim(this, HOME_REGION));
    addModalCard(this, root, panel, text.title, { pressed: this.closePressed() });
    const control = addMenuButton(
      this,
      button,
      text.button,
      { available: true, primary: true },
      root,
    );
    control.setPressed(this.updatePressed());
  }

  // The Pet shop on the yard's right lot: ui-pet-shop, its front sinking while pressed, with
  // the gold outline while anything inside is affordable. Drawn in code while the art is
  // missing, when the whole building dips instead.
  private drawPetShop(root: GameObjects.Container, save: SaveDocument): void {
    const view = this.tileView(root, "petShop");
    const faces = this.addPressFaces(SHOP_ART.petShop, PET_SHOP);
    if (faces !== undefined) {
      const [normal, pressed] = faces;
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

  // The dog slot sign hung across the Pet shop's front while a dog slot is for sale: ui-slot-sign,
  // its board and text dropping while pressed, with its call to buy over the cheapest slot's price,
  // and the gold outline while the bank covers that slot. It bobs with the shop. A cream board in
  // an ink frame stands in while the art is missing, when the whole sign dips instead.
  private drawSlotSign(root: GameObjects.Container, save: SaveDocument): void {
    const sign = slotSign(gameData, save.owned, save.bankCents);
    if (sign === null) {
      return;
    }
    const { art, board, key, pressDrop, scale } = SLOT_SIGN;
    const view = this.tileView(root, "slotSign");
    view.bobsWithShop = true;
    const faces = this.addPressFaces(key, art);
    if (faces === undefined) {
      const colours = { border: PALETTE.ink, fill: PALETTE.cream };
      drawFramedRect(addGraphicsIn(this, view.container), colours, board);
    } else {
      view.container.add(faces);
    }
    // Each line's ink centred on the cream; the price in red while the bank is short, as a
    // tile's unaffordable price is.
    const { headCapY, priceCapY, x } = slotSignText(pixelFontMetrics(this, "body"));
    const priceColour = sign.affordable ? SLOT_SIGN.priceColour : GREYED.shortPrice;
    const rows = [
      { capY: headCapY, colour: SLOT_SIGN.headColour },
      { capY: priceCapY, colour: priceColour },
    ] as const;
    const labels = sign.lines.map((line, i) => {
      const row = rows[i] ?? rows[0];
      const label = this.text(view.container, 0, 0, line, PALETTE[row.colour], { scale });
      const ink = inkSpan(label);
      placePixelText(label, x - (ink.left + ink.right) / 2, row.capY);
      return { label, y: label.y };
    });
    if (faces !== undefined) {
      const [normal, pressed] = faces;
      view.iconButton = {
        setPressed: (down) => {
          normal.setVisible(!down);
          pressed.setVisible(down);
          labels.forEach(({ label, y }) => label.setY(y + (down ? pressDrop : 0)));
        },
      };
      view.iconButton.setPressed(false);
    }
    if (sign.affordable) {
      addAffordFrame(this, view.container, board, currentSettings(this).reducedMotion);
    }
  }

  // key's normal and pressed faces with their top-left corner at at, or none, with nothing left
  // drawn, while either is missing.
  private addPressFaces(
    key: string,
    at: { x: number; y: number },
  ): [GameObjects.Image, GameObjects.Image] | undefined {
    const normal = addTagImage(this, key, "normal", at.x, at.y);
    const pressed = addTagImage(this, key, "pressed", at.x, at.y);
    if (normal === undefined || pressed === undefined) {
      normal?.destroy();
      pressed?.destroy();
      return undefined;
    }
    return [normal, pressed];
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
      addPlate(this, parent, at, text, plateColours(plate));
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
      const purchase: Purchase = { dog: id, kind: "dog" };
      const tile = itemTile({
        affordable: isAffordable(gameData, owned, save.bankCents, purchase),
        capacity,
        goal: null,
        picked: this.loadout.dogs.includes(id),
        pickedCount: this.loadout.dogs.length,
        price: purchasePrice(gameData, owned, purchase),
      });
      const { art, badge, state } = itemTileLook(tile);
      const { content, look, view } = this.selectTile(
        root,
        targetId({ dog: id, kind: "dog" }),
        rect,
        {
          edge: true,
          // A picked dog wears a tick: the game sets the pack's order by the dogs' sizes.
          mark: "tick",
          state,
          tile: true,
        },
      );
      const ink = PALETTE[look.text];
      const { badge: badgeAt, face: faceBox, lockedNameY, textX } = DOG_TILE;
      fillRect(addGraphicsIn(this, content), PALETTE[pictureBox({ art, state })], {
        height: faceBox.size + 2,
        width: faceBox.size + 2,
        x: x + faceBox.dx - 1,
        y: y + faceBox.dy - 1,
      });
      const faceKey = dogFaceKey(gameData, id);
      const faceTag = badge === null ? "happy" : "neutral";
      const faceAt = { x: x + faceBox.dx, y: y + faceBox.dy };
      // A dog not owned holds its first frame, in colour while the player can buy it.
      const still = reduced || badge !== null;
      const face = addTileSprite(this, art, still, faceKey, faceTag, faceAt);
      content.add(face);
      view.face = { object: face, y: faceAt.y };

      const body = pixelFontMetrics(this, "body");
      const nameText = (value: string, top: number) => {
        this.text(content, x + textX, top, value, ink);
      };
      if (badge === null) {
        // Every dog earns the same pay, so an owned tile names the dog alone; its card says the
        // pay.
        nameText(dog.name, y + dogTileNameY(body));
        return;
      }
      // A locked dog shows its name over its price plate, and its badge.
      nameText(dog.name, y + lockedNameY);
      addTileBadge(this, content, badge, { x: x + badgeAt.dx, y: y + badgeAt.dy });
      const plateY = dogTilePlateY(body);
      this.lockedPlate(content, tile, { capY: y + plateY - 1, originX: 0, x: x + textX });
    });
  }

  // The Pocket section's tiles, one per gear item cheapest first; a hold shows an item's
  // effect. Pocketing an item replaces any other, so the Pocket is never full.
  private drawPocket(root: GameObjects.Container, save: SaveDocument): void {
    const { owned } = save;
    const pocketed = this.loadout.gear;
    const slots = gearSlots();
    gearIds().forEach((id, i) => {
      const rect = pocketTile(itemAt(slots, i));
      const { width, x, y } = rect;
      const purchase: Purchase = { gear: id, kind: "gear" };
      const tile = itemTile({
        affordable: isAffordable(gameData, owned, save.bankCents, purchase),
        capacity: 1,
        goal: null,
        picked: pocketed === id,
        pickedCount: pocketed === null ? 0 : 1,
        price: purchasePrice(gameData, owned, purchase),
      });
      const { art, badge, state } = itemTileLook(tile);
      const { content, view } = this.selectTile(root, targetId({ gear: id, kind: "gear" }), rect, {
        edge: true,
        mark: "tick",
        state,
        tile: true,
      });
      const { badge: badgeAt, box, icon: iconAt } = POCKET;
      fillRect(addGraphicsIn(this, content), PALETTE[pictureBox({ art, state })], {
        height: box.size,
        width: box.size,
        x: x + box.dx,
        y: y + box.dy,
      });
      const at = { x: x + iconAt.dx, y: y + iconAt.dy };
      const icon = this.addGearIcon(content, art, id, at, 1);
      if (icon !== undefined) {
        view.face = { object: icon, y: at.y };
      }
      if (badge !== null) {
        addTileBadge(this, content, badge, { x: x + badgeAt.dx, y: y + badgeAt.dy });
        const plateAt = { capY: y + POCKET.priceY, originX: 0.5, x: x + width / 2 };
        this.lockedPlate(content, tile, plateAt);
      }
    });
  }

  // The item's 32x32 icon in its art look, or its initials until the icon is in the manifest.
  private addGearIcon(
    parent: GameObjects.Container,
    art: ArtLook,
    gear: GearId,
    at: { x: number; y: number },
    scale: number,
  ): GameObjects.Image | undefined {
    const { x, y } = at;
    const key = gearIconKey(gear);
    if (this.textures.exists(key)) {
      const icon = this.add
        .image(x, y, tileTextureKey(this, art, key))
        .setOrigin(0)
        .setScale(scale);
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
  // another replaces it, so the walker choice is never full. Each shows its portrait with its
  // perk icon beside it and its name on the grey goal plate at the tile's foot; a locked one's
  // portrait and icon are greyed, under the padlock.
  private drawWalkerPicker(root: GameObjects.Container, save: SaveDocument): void {
    const reduced = currentSettings(this).reducedMotion;
    const tiles = walkerTiles();
    walkerIds().forEach((id, i) => {
      const rect = itemAt(tiles, i);
      const { x, y } = rect;
      const tile = walkerTile(gameData, save, id);
      const { art, badge, state } = itemTileLook(tile);
      const { content, look, view } = this.selectTile(
        root,
        targetId({ kind: "walker", walker: id }),
        rect,
        {
          edge: true,
          mark: "tick",
          state,
          tile: true,
        },
      );
      const { badge: badgeAt, box, face: faceAt, icons, plateY } = WALKER_TILE;
      fillRect(addGraphicsIn(this, content), PALETTE[pictureBox({ art, state })], {
        height: box.size,
        width: box.size,
        x: x + box.dx,
        y: y + box.dy,
      });
      const walker = gameData.walkers[id];
      const at = { x: x + faceAt.dx, y: y + faceAt.dy };
      if (this.textures.exists(walker.portraitKey)) {
        const tag = tile.kind === "picked" ? "happy" : "neutral";
        const face = addTileSprite(this, art, reduced, walker.portraitKey, tag, at);
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
      if (badge !== null) {
        addTileBadge(this, content, badge, { x: x + badgeAt.dx, y: y + badgeAt.dy });
      }
      // Every walker's name on the goal plate, owned or locked.
      const plateAt = { capY: y + plateY, originX: 0.5, x: x + rect.width / 2 };
      addPlate(this, content, plateAt, walker.name, plateColours("goal"));
      walkerEffectItems(gameData, id).forEach((item, n) => {
        const iconAt = { x: x + icons.dx, y: y + itemAt(icons.dy, n) };
        const key = effectIconKey(item);
        if (this.textures.exists(key)) {
          const shown = tileTextureKey(this, art, key);
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
  // and the frame shows one. Not ready, it is disabled: a flat sunk face that never moves, under
  // both labels. The faces are the ui-button's, and the label sinks with the face.
  // Pressed while the walk's art loads, its pressed face says so, in words that keep still.
  private drawStartButton(root: GameObjects.Container, ready: boolean): void {
    const { width, x, y } = START_BUTTON;
    const container = this.add.container(0, 0);
    root.add(container);
    const { startLoading: loadingLabel, startWalk: label } = gameData.homeText;
    const state = buttonState({ available: ready, primary: true });
    const disabled = state === "disabled";
    const faces = buttonFaces(this, true, START_BUTTON, state);
    if (faces.length === 1) {
      container.add(faces);
    }
    const variant = (down: boolean) => {
      const group = this.add.container(0, 0);
      container.add(group);
      const face = faces.length > 1 ? faces[down ? 1 : 0] : undefined;
      if (face !== undefined) {
        group.add(face);
      }
      const top = START_LABEL.readyY + (disabled || down ? BUTTON_PRESS_PX : 0);
      const colour = PALETTE[BUTTON_COLOURS[state].label];
      const loading = down && this.artWait?.kind === "start";
      this.text(group, x + width / 2, y + top, loading ? loadingLabel : label, colour, {
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
    const rect = this.focused()?.rect;
    if (rect === undefined) {
      return;
    }
    drawFocusRing(addGraphicsIn(this, root), FOCUS_OUTSET, rect);
  }
}
