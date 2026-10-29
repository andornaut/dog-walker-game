import { type GameObjects, Scene } from "phaser";

import { debuffIconKey } from "../assets/iconKeys";
import { dogCardTag, dogFaceKey, ownerCardFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import type { AchievementId, DebuffId, DogId, HintTrigger } from "../data/types";
import { dollarAmountText } from "../home/home";
import {
  effectIconKey,
  type EffectItem,
  effectItems,
  effectItemsKey,
  perkIconKey,
  spareTreatWell,
} from "../hud/effectIcons";
import { explainDetail } from "../hud/explain";
import { FEEDBACK } from "../hud/feedback";
import { runHintTriggers } from "../hud/hintTriggers";
import {
  CHANGE_LABEL_STYLE,
  changeChipPlace,
  changeLabelRoom,
  type HudLanes,
  hudLanes,
} from "../hud/hudLanes";
import type { ChangeLabel } from "../hud/hudView";
import type { MessageLine } from "../hud/messageStrip";
import { cardOwnerMood, FORGIVEN_EVENT, type ForgivenCue } from "../hud/moments";
import {
  cashChipPlace,
  freeCashSlot,
  LABEL_FADE_MS,
  mergeTips,
  MONEY_LABEL,
  moneyChipPlace,
  moneyFlightPath,
  stackOrders,
} from "../hud/moneyLabels";
import { stripLine } from "../hud/stripLines";
import {
  buttonIcon,
  pauseButtonIcon,
  playerPaused,
  type RunPause,
  TOP_BAR_BUTTONS,
  topBarAction,
  topBarButtonAt,
  topBarButtonForKey,
} from "../hud/topBar";
import {
  type BarButton,
  cardHearts,
  cashLeft,
  DEBUFF_BAR,
  debuffBarRects,
  debuffFillWidth,
  DOG_CARD,
  type ExplainTarget,
  leadSlot,
  ownerNameLines,
  slotShown,
  spareTreatPipAt,
  WALK_BAR,
  WALK_BAR_BUTTONS,
  type WalkBarButtonId,
  walkBarLayout,
  ZONE_PROGRESS,
  zoneProgressLayout,
  zoneShare,
} from "../hud/walkHud";
import type { Point, Rect } from "../lib/rect";
import { type Cents, cents } from "../lib/units";
import { ownerMaxHearts } from "../rules/dogs";
import { debuffLasting } from "../rules/durations";
import { hintFor, hintJumpsQueue } from "../rules/hints";
import { walkEarnings } from "../rules/run";
import { faceMood } from "../rules/treats";
import { read } from "../rules/units";
import { heartsOf, slotIndexOf } from "../state/pack";
import type { PackSlot, RunState } from "../state/runState";
import {
  addFilledRect,
  CREAM_PANEL_COLOURS,
  drawDashedRect,
  drawFramedRect,
  drawHeart,
  fillRect,
} from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import {
  addPixelText,
  fitPixelText,
  inkSpan,
  pixelFontMetrics,
  placePixelText,
  scalePixelText,
  setPixelText,
} from "../ui/phaser/pixelText";
import { topBarRects } from "../ui/topBarTrim";
import { arcFlight } from "./arcFlight";
import { addCharm, glintWell } from "./buffCharm";
import { BumpBorder } from "./bumpBorder";
import { CardScene } from "./CardScene";
import { changeLabelColour } from "./changeLabelColours";
import { DEBUFF_COLOURS } from "./debuffColours";
import { HudFeedback } from "./feedbackMoments";
import { HeartFeedback, heartPops } from "./heartFeedback";
import { drawDetailCard } from "./homePanels";
import { HUD_DEPTH } from "./hudDepth";
import type { HudRun, HudWalk, RunHudView } from "./hudWalk";
import { MESSAGE_EVENT, MessageStrip } from "./messageStripView";
import { listenOnePress } from "./onePress";
import { BAR_MUTED_EVENT, onSceneEvent } from "./overlay";
import { OwnerTabs } from "./ownerTabs";
import { isMuted, markHintShown, profileSave, shownHints, toggleMuted } from "./profileStore";
import {
  ACHIEVEMENTS_EVENT,
  BUFF_GLINT_EVENT,
  BUMP_FLASH_EVENT,
  CHANGE_LABELS_EVENT,
  HINT_EVENT,
  type OwnerQuip,
  QUIPS_EVENT,
  type RaisedHint,
} from "./run/runMoments";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import { type ScenePicture, showAsPicture } from "./scenePicture";
import { soundboardOf } from "./soundboard";
import { playTag } from "./sprites";
import { TimedGroup } from "./timedGroup";
import {
  addTagImage,
  artFits,
  fadeAway,
  imageIcon,
  setDollarAmount,
  settingsIcon,
  soundIcon,
} from "./uiKit";

const LAYOUT = SCREEN_LAYOUT;
const BAR = walkBarLayout(LAYOUT.topBar);
// The spare treat pip's art, which spareTreatPipAt places: the road's smallest treat.
const SPARE_TREAT_PIP_KEY = "treat@50";

// A change label's parts on screen, and its chip's rect.
interface ChangeChip {
  parts: (GameObjects.Graphics | GameObjects.BitmapText)[];
  rect: Rect;
}

// The tip label showing by the cash before it goes in: its label, its chip, its slot in the
// cash's column, and the money it keeps off the counter until it lands.
interface ShowingTip {
  chip: ChangeChip;
  held: number;
  label: ChangeLabel;
  slot: number;
}

const NOT_EXPLAINED = { key: "", layer: undefined };
// An owner's tab shows this long on a heart change.
const HEART_TAB_MS = 1200;
// A card holds one row of hearts, as many as the most an owner can have.
const MAX_CARD_HEARTS = DOG_CARD.hearts.perRow;
const HEART_KEY = "ui-heart";
const CARD_KEY = "ui-dog-card";

interface CardView {
  card: GameObjects.Sprite;
  dogFace: GameObjects.Sprite;
  empty: GameObjects.BitmapText;
  fired: GameObjects.BitmapText;
  hearts: GameObjects.Sprite[];
  lead: GameObjects.Image | GameObjects.BitmapText;
  name: GameObjects.BitmapText;
  // The owner's name, one label per line.
  owner: GameObjects.BitmapText[];
  ownerFace: GameObjects.Sprite;
}

// A card's parts that shake with it.
function cardParts(view: CardView | undefined): GameObjects.Components.Transform[] {
  if (view === undefined) {
    return [];
  }
  const { card, dogFace, empty, fired, hearts, lead, name, owner, ownerFace } = view;
  return [card, dogFace, ownerFace, name, ...owner, empty, fired, lead, ...hearts];
}

interface DebuffBarView {
  debuff: DebuffId;
  parts: GameObjects.GameObject[];
  rect: Rect;
}

// The HUD shows run's walk and its buttons act on run; a picture of the HUD shows source's walk
// in view's strips, and takes no input or hints.
export type HudSceneData = { picture: { source: HudWalk; view: ScenePicture } } | { run: HudRun };

// The walk bar, the debuff bars, the dog cards and the neighbourhood's progress line, drawn over
// the road for the whole walk and kept in view while cards are up. It reads the run every frame and
// redraws what changed, and shows the run's change labels, first-time hints, owners' pop-ins and
// what a held press explains. It keeps running while the walk is paused, so the bar's buttons and
// their keys work in every state; its animations run on too, being the bar's and not the walk's,
// except the walk's moments: while the player has paused, heart pops, change labels, owners'
// pop-ins and the message strip's ageing hold.
export class HudScene extends Scene {
  private cards: CardView[] = [];
  private debuffBars: DebuffBarView[] = [];
  private debuffFills: GameObjects.Graphics | undefined;
  private dollar: GameObjects.BitmapText | undefined;
  private drawn: Record<string, unknown> = {};
  private dynamic: GameObjects.Graphics | undefined;
  private effectParts: GameObjects.GameObject[] = [];
  // What the open explanation explains, and its detail card as drawn, if any.
  private explained: { key: string; layer: GameObjects.Container | undefined } = NOT_EXPLAINED;
  private feedback: HudFeedback | undefined;
  private hearts: HeartFeedback | undefined;
  // The change labels, glints and owners' pop-ins on screen, which hold while the player has
  // paused.
  private labels = new TimedGroup();
  // The slots of the cash's column that money labels showing by the cash hold.
  private cashSlots = new Set<number>();
  private messages = new MessageStrip();
  private money: GameObjects.BitmapText | undefined;
  // The money changes still flying to the cash, which the counter leaves out until they land.
  private moneyInFlight = 0;
  private owners: OwnerTabs | undefined;
  private pauseGlyph: GameObjects.Graphics | undefined;
  private pauseIcon: GameObjects.Image | undefined;
  private soundHolder: GameObjects.Container | undefined;
  // The spare treat held, shown in its gear's effect well.
  private spareTreatPip: GameObjects.Sprite | undefined;
  private picture: HudWalk | undefined;
  private run: HudRun | undefined;
  private tip: ShowingTip | undefined;
  private zoneFill: GameObjects.Graphics | undefined;
  private zoneFillWidth: number | undefined;

  // key names a second HUD, such as the help's picture of one.
  constructor(key: string = SCENE_KEYS.hud) {
    super(key);
  }

  private lanes(): HudLanes {
    return hudLanes(LAYOUT);
  }

  create(data: HudSceneData): void {
    const { dogRow, dogSlots, topBar, zoneProgress } = LAYOUT;
    const picture = "picture" in data ? data.picture : undefined;
    this.picture = picture?.source;
    this.run = "run" in data ? data.run : undefined;
    if (picture !== undefined) {
      showAsPicture(this, picture.view);
    }
    this.drawn = {};
    this.debuffBars = [];
    this.effectParts = [];
    this.spareTreatPip = undefined;
    this.tip = undefined;
    this.cashSlots = new Set();
    this.explained = NOT_EXPLAINED;
    this.messages = new MessageStrip();
    this.moneyInFlight = 0;
    this.labels = new TimedGroup();
    const g = this.add.graphics();
    // The card band ends on the dog row's bottom row, its top rows (the shadow and the trim)
    // over the road's last rows. The progress line's strip is under it, on the screen's last
    // rows.
    if (this.textures.exists("ui-dog-card-band")) {
      this.add.image(dogRow.x, dogRow.y + dogRow.height, "ui-dog-card-band").setOrigin(0, 1);
    } else {
      fillRect(g, PALETTE.darkBrown, dogRow);
    }
    const { colours } = ZONE_PROGRESS;
    const line = zoneProgressLayout(zoneProgress, 0);
    fillRect(g, PALETTE[colours.border], line.frame);
    fillRect(g, PALETTE[colours.track], line.track);
    this.zoneFill = this.add.graphics();
    this.zoneFillWidth = undefined;
    if (this.textures.exists("ui-walk-bar")) {
      this.add.image(topBar.x, topBar.y, "ui-walk-bar").setOrigin(0);
    } else {
      topBarRects(topBar).forEach(({ colour, rect }) => fillRect(g, PALETTE[colour], rect));
      fillRect(g, PALETTE.ink, WALK_BAR.cash.well);
    }
    WALK_BAR_BUTTONS.forEach((id) => this.addButton(TOP_BAR_BUTTONS[id]));
    // A container holds the icon's place in the draw order while it is swapped.
    this.soundHolder = this.add.container(0, 0);
    this.showSoundIcon(isMuted(this));
    const help = buttonIcon(TOP_BAR_BUTTONS.help);
    if (imageIcon(this, "icon-help", help.x, help.y).length === 0) {
      addPixelText(this, help.x + 8, help.y + 4, "?", { colour: PALETTE.cream, originX: 0.5 });
    }
    const settings = buttonIcon(TOP_BAR_BUTTONS.settings);
    settingsIcon(this, settings.x, settings.y);
    const pauseIcon = buttonIcon(TOP_BAR_BUTTONS.pause);
    this.pauseIcon = this.add.image(pauseIcon.x, pauseIcon.y, "__DEFAULT").setOrigin(0);
    this.pauseGlyph = this.add.graphics();

    const title = { font: "title" } as const;
    this.dollar = addPixelText(this, 0, 0, "$", { colour: PALETTE.amber, ...title });
    this.money = addPixelText(this, 0, 0, "", { colour: PALETTE.cream, ...title });
    this.dynamic = this.add.graphics();
    this.debuffFills = this.add.graphics().setDepth(HUD_DEPTH.overPart);
    this.cards = dogSlots.map((rect) => this.createCard(rect));
    const border = new BumpBorder(this);

    const run = this.walk();
    const firingRects = () => this.feedback?.firingRects() ?? [];
    this.owners = new OwnerTabs(this, { group: this.labels, still: () => run.reducedMotion() });
    this.feedback = new HudFeedback(this, run, {
      effectWell: (index) => BAR.effectWells[index],
      firingShown: () => this.hearts?.clearWay(),
      floatLabels: (ownerMs, labels) => this.floatLabels(ownerMs, labels),
      payTotal: (label, timing) => this.showPayTotal(label, timing),
      popOwner: (dog, mood, ms) => this.popOwner(dog, mood, ms),
    });
    this.hearts = new HeartFeedback(this, {
      clearOf: firingRects,
      landed: (label, lane) => this.showHeartLabel(label, lane),
      still: () => run.reducedMotion(),
      tabTop: this.lanes().ownerTabs.y,
    });
    onSceneEvent(this, run.events, ACHIEVEMENTS_EVENT, (ids: AchievementId[]) =>
      this.sayAchievements(ids),
    );
    onSceneEvent(this, run.events, CHANGE_LABELS_EVENT, (labels: ChangeLabel[]) =>
      this.floatLabels(HEART_TAB_MS, labels),
    );
    onSceneEvent(this, run.events, FORGIVEN_EVENT, (cue: ForgivenCue) => this.forgive(cue));
    onSceneEvent(this, run.events, BUFF_GLINT_EVENT, (item: EffectItem) => this.glint(item));
    onSceneEvent(this, run.events, BUMP_FLASH_EVENT, (colour: number) => border.flash(colour));
    onSceneEvent(this, run.events, HINT_EVENT, (hint: RaisedHint) => this.sayHint(hint));
    onSceneEvent(this, run.events, MESSAGE_EVENT, (line: MessageLine) => this.messages.say(line));
    onSceneEvent(this, run.events, QUIPS_EVENT, (quips: OwnerQuip[]) => this.sayQuips(quips));
    if (picture !== undefined) {
      return;
    }

    // A button acts on the press, as the walk's gestures never see it.
    listenOnePress(this, {
      down: (pointer) => {
        const button = topBarButtonAt(pointer.x, pointer.y);
        if (button !== undefined) {
          this.press("tap", button);
        }
      },
      up: () => undefined,
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const button = topBarButtonForKey(event.repeat, event.key);
      if (button !== undefined) {
        this.press("key", button);
      }
    });
  }

  // The topmost overlay over the walk that leaves the walk bar in view (the settings, the pause
  // menu, the card or the zone celebration), else the HUD itself. A picture of the HUD has none.
  // Each counts while paused, under an explanation or an overlay over it.
  private overlayScene(): Scene {
    const shown = (key: SceneKey) => this.scene.isActive(key) || this.scene.isPaused(key);
    const overlays = [
      SCENE_KEYS.settings,
      SCENE_KEYS.pause,
      SCENE_KEYS.card,
      SCENE_KEYS.zoneCelebration,
    ] as const;
    const key = overlays.find(shown);
    return key === undefined || this.picture !== undefined ? this : this.scene.get(key);
  }

  // The walk the HUD shows: a picture's, or the run's.
  private walk(): HudWalk {
    const walk = this.picture ?? this.run;
    if (walk === undefined) {
      throw new Error("The HUD shows a walk only once it is created");
    }
    return walk;
  }

  private press(via: "key" | "tap", button: WalkBarButtonId): void {
    const run = this.run;
    if (run === undefined) {
      return;
    }
    switch (topBarAction(run.runPause(), via, button)) {
      case "closeSettings":
        run.closeSettings();
        break;
      case "mute":
        this.game.events.emit(BAR_MUTED_EVENT, toggleMuted(this));
        break;
      case "openMenu":
        run.openPause();
        break;
      case "openHelp":
        run.openFromBar("help");
        break;
      case "openSettings":
        run.openFromBar("settings");
        break;
      case "resume":
        run.closePause();
        break;
      default:
    }
  }

  // A 20x20 button face on the bar, drawn when the art is missing.
  private addButton(button: BarButton): void {
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

  // icon-sound's on or off frame on the sound button's face, for M and Settings too.
  private showSoundIcon(muted: boolean): void {
    const holder = this.soundHolder;
    if (holder === undefined) {
      return;
    }
    holder.removeAll(true);
    const { x, y } = buttonIcon(TOP_BAR_BUTTONS.sound);
    holder.add(soundIcon(this, !muted, x, y));
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
    const { x, y } = TOP_BAR_BUTTONS.pause.face;
    if (key === "icon-play") {
      // Columns narrowing to a point, over the same 8x10 the pause bars cover.
      [10, 8, 8, 6, 6, 4, 2, 2].forEach((height, i) => {
        fillRect(g, PALETTE.cream, { height, width: 1, x: x + 6 + i, y: y + 10 - height / 2 });
      });
      return;
    }
    for (const dx of [6, 11]) {
      fillRect(g, PALETTE.cream, { height: 10, width: 3, x: x + dx, y: y + 5 });
    }
  }

  private createCard({ x, y }: Rect): CardView {
    const sprite = (key: string, point: { x: number; y: number }) =>
      this.add
        .sprite(x + point.x, y + point.y, key)
        .setOrigin(0)
        .setVisible(false);
    // The card first, so the face, hearts and labels draw over it.
    const card = sprite(CARD_KEY, { x: 0, y: 0 });
    const { empty, fired, lead, name, owner } = DOG_CARD;
    const leadTag = this.textures.exists("ui-lead-tag")
      ? this.add.image(x + lead.x, y + lead.y, "ui-lead-tag").setOrigin(0)
      : addPixelText(this, x + lead.x + 2, y + lead.y + 3, gameData.runText.lead, {
          colour: PALETTE.amber,
          font: "title",
        });
    return {
      card,
      dogFace: sprite("treat", DOG_CARD.dogFace),
      empty: addPixelText(this, x + empty.x, y + empty.y, "", {
        colour: PALETTE.cream,
        font: "title",
        originX: 0.5,
      }),
      fired: addPixelText(this, x + fired.x, y + fired.y, "", {
        colour: PALETTE.white,
        font: "title",
        originX: 0.5,
      }),
      hearts: Array.from({ length: MAX_CARD_HEARTS }, () => sprite(HEART_KEY, { x: 0, y: 0 })),
      lead: leadTag.setVisible(false),
      name: addPixelText(this, x + name.x, y, "", {
        colour: PALETTE.cream,
        font: "title",
        originX: 0.5,
      }),
      owner: owner.tops.twoLines.map((top) =>
        addPixelText(this, x + owner.x, y + top, "", { colour: PALETTE.tan, scale: owner.scale }),
      ),
      ownerFace: sprite("treat", owner.face),
    };
  }

  override update(_time: number, delta: number): void {
    const run = this.walk();
    const view = run.hudView();
    if (view === undefined) {
      return;
    }
    const pause = run.runPause();
    const held = playerPaused(pause);
    this.feedback?.update(view.run, pause);
    this.hearts?.hold(held);
    this.labels.hold(held);
    if (this.picture === undefined) {
      this.raiseHints(runHintTriggers(view.run));
    }
    const overlay = this.overlayScene();
    this.showExplanation(view, overlay);
    this.showDebuffBars(view.run);
    this.showZoneProgress(view.run);
    const depth = overlay === this ? HUD_DEPTH.message : HUD_DEPTH.messageOverlay;
    // The strip's lines wait under an explanation's detail card, and hide, waiting, while a card
    // is held enlarged.
    const aged = held || pause.hold ? 0 : delta;
    const hidden = overlay instanceof CardScene && overlay.holding();
    this.messages.update(aged, overlay, depth, this.debuffBars.length, hidden);
    const effects = effectItems(gameData, view.run);
    // The run state is immutable, so a changed pack or modifier list is a new array.
    const state: Record<string, unknown> = {
      effects: effectItemsKey(effects),
      modifiers: view.run.modifiers,
      money: this.shownMoney(view.run),
      muted: isMuted(this),
      pack: view.run.pack,
      pauseIcon: pauseButtonIcon(pause),
      route: view.run.route,
      spareTreat: spareTreatWell(effects, view.run),
      zone: view.run.zoneIndex,
    };
    if (Object.keys(state).some((key) => state[key] !== this.drawn[key])) {
      if (state.muted !== this.drawn.muted) {
        this.showSoundIcon(isMuted(this));
      }
      if (state.effects !== this.drawn.effects) {
        this.showEffects(effects);
      }
      if (state.effects !== this.drawn.effects || state.spareTreat !== this.drawn.spareTreat) {
        this.showSpareTreat(spareTreatWell(effects, view.run));
      }
      this.drawn = state;
      this.showPauseIcon(pause);
      this.redraw(view);
    }
  }

  // The cash the walk keeps, all of it until it ends (walkEarnings), less fees and money changes
  // still flying to it, so the cash an early end loses counts down once its label lands.
  private shownMoney(run: RunState): Cents {
    const kept =
      run.phase.kind === "ended" ? walkEarnings(run.phase.reason, run).banked : run.money;
    const landed = cents(kept - this.moneyInFlight);
    return this.feedback?.shownMoney(landed) ?? landed;
  }

  // The "$" and the amount from the cash's x at the cash's scale, one font advance apart.
  private showMoney(amount: string): void {
    const { dollar, money } = this;
    if (dollar === undefined || money === undefined || money.text === amount) {
      return;
    }
    const { topBar } = LAYOUT;
    setDollarAmount(dollar, money, amount, (inkWidth) => {
      const { scale } = WALK_BAR.cash;
      const top = topBar.y + WALK_BAR.cash.capsY;
      return { left: topBar.x + cashLeft(inkWidth * scale), scale, top };
    });
  }

  // The effect wells: each effect's unlit charm in its well, in the walk's order.
  private showEffects(effects: readonly EffectItem[]): void {
    this.effectParts.forEach((part) => part.destroy());
    this.effectParts = BAR.effectWells.flatMap((well, i) => {
      const item = effects[i];
      return item === undefined ? [] : [addCharm(this, item, well, { lit: false })];
    });
  }

  // The spare treat held, as the road's smallest treat in the corner of the well at index
  // (spareTreatWell), over its charm; none at -1, as when it is given back.
  private showSpareTreat(index: number): void {
    this.spareTreatPip?.destroy();
    this.spareTreatPip = undefined;
    const well = BAR.effectWells[index];
    if (well === undefined || !this.textures.exists(SPARE_TREAT_PIP_KEY)) {
      return;
    }
    const at = spareTreatPipAt(well);
    this.spareTreatPip = this.add.sprite(at.x, at.y, SPARE_TREAT_PIP_KEY).setOrigin(0);
  }

  // A bar per debuff under the walk bar, in the order they began, rebuilt as they come and go;
  // each fill drains every frame.
  private showDebuffBars(run: RunState): void {
    const debuffs = run.debuffs.map(({ debuff }) => debuff);
    if (debuffs.join() !== this.debuffBars.map(({ debuff }) => debuff).join()) {
      this.debuffBars.forEach((bar) => bar.parts.forEach((part) => part.destroy()));
      const rects = debuffBarRects(LAYOUT.topBar, debuffs.length);
      this.debuffBars = debuffs.flatMap((debuff, i) => {
        const rect = rects[i];
        return rect === undefined ? [] : [this.addDebuffBar(debuff, rect)];
      });
    }
    const g = this.debuffFills;
    if (g === undefined) {
      return;
    }
    g.clear();
    const { fill } = DEBUFF_BAR;
    for (const bar of this.debuffBars) {
      const active = run.debuffs.find(({ debuff }) => debuff === bar.debuff);
      if (active === undefined) {
        continue;
      }
      // A debuff a buff shortened, such as by Quick recovery, starts part way down its bar.
      const { seconds } = gameData.debuffs[bar.debuff];
      const full = Math.max(
        read(gameData.tuning, "seconds", seconds),
        debuffLasting(gameData.tuning, seconds, run).secondsLeft,
      );
      const width = debuffFillWidth(active.secondsLeft, full);
      const colours = DEBUFF_COLOURS[bar.debuff];
      if (width > 0) {
        fillRect(g, colours.fill, {
          ...fill,
          width,
          x: bar.rect.x + fill.x,
          y: bar.rect.y + fill.y,
        });
      }
    }
  }

  // The progress line's fill, redrawn as it grows by a pixel or starts again.
  private showZoneProgress(run: RunState): void {
    const g = this.zoneFill;
    const { fills } = zoneProgressLayout(LAYOUT.zoneProgress, zoneShare(gameData, run));
    const width = fills[0]?.width ?? 0;
    if (g === undefined || width === this.zoneFillWidth) {
      return;
    }
    this.zoneFillWidth = width;
    g.clear();
    if (width > 0) {
      fills.forEach((fill) => fillRect(g, PALETTE[fill.colour], fill));
    }
  }

  private addDebuffBar(debuff: DebuffId, rect: Rect): DebuffBarView {
    const colours = DEBUFF_COLOURS[debuff];
    const parts: GameObjects.GameObject[] = [];
    const art = addTagImage(this, "ui-debuff-bar", debuff, rect.x, rect.y);
    parts.push(art ?? addFilledRect(this, colours.face, rect));
    const { icon, name } = DEBUFF_BAR;
    const iconKey = debuffIconKey(debuff);
    if (this.textures.exists(iconKey)) {
      parts.push(this.add.image(rect.x + icon.x, rect.y + icon.y, iconKey).setOrigin(0));
    }
    parts.push(
      addPixelText(this, rect.x + name.x, rect.y + name.y, gameData.debuffs[debuff].name, {
        colour: colours.name,
        font: "title",
      }),
    );
    return { debuff, parts, rect };
  }

  // The detail card of what a held press explains, the home screen's, while it is open: over the
  // HUD, or drawn in the pause menu, over its panel, when the hold opened it there. The walk is
  // paused under it, so it is drawn once as it opens, and again only in a new overlay or a
  // restarted one.
  private showExplanation(view: RunHudView, overlay: Scene): void {
    const target: ExplainTarget | undefined = view.explaining;
    const key = target === undefined ? "" : JSON.stringify(target);
    const shown = this.explained;
    if (shown.key === key && (shown.layer === undefined || shown.layer.scene === overlay)) {
      return;
    }
    shown.layer?.destroy();
    const detail =
      target === undefined
        ? undefined
        : explainDetail(gameData, profileSave(this), view.run, target);
    if (detail === undefined) {
      this.explained = { key, layer: undefined };
      return;
    }
    const layer = overlay.add.container(0, 0).setDepth(HUD_DEPTH.detail);
    drawDetailCard(overlay, layer, LAYOUT.screen, false, detail.card, detail.picture, detail.kind);
    this.explained = { key, layer };
  }

  private redraw(view: RunHudView): void {
    const g = this.dynamic;
    if (g === undefined) {
      return;
    }
    const { run } = view;
    g.clear();
    this.showMoney(dollarAmountText(this.shownMoney(run)));
    const ownedSlots = profileSave(this).owned.dogSlots.length;
    const lead = leadSlot(run.pack.map((slot) => slot.status === "walking"));
    LAYOUT.dogSlots.forEach((rect, i) => {
      const card = this.cards[i];
      if (card !== undefined) {
        const packSlot = run.pack[i];
        const shown = slotShown(ownedSlots, i, packSlot !== undefined);
        const slot = shown === "hidden" ? null : packSlot;
        this.drawCard(g, { rect, run, slot, view: card });
        card.lead.setVisible(i === lead);
      }
    });
  }

  // A dog's card: its name and face, its owner's face, name and hearts, and the LEAD tag on the
  // front dog's. A fired dog's card is the empty one with FIRED across the dog's photo, the
  // owner's fired face, their name and all their hearts empty. An owned slot with no dog is a
  // dashed "Empty" outline on the band, and a slot not bought (null) shows the band alone.
  private drawCard(
    g: GameObjects.Graphics,
    card: {
      rect: Rect;
      run: RunState;
      slot: PackSlot | null | undefined;
      view: CardView;
    },
  ): void {
    const { rect, run, slot, view } = card;
    const parts = [view.card, view.dogFace, view.ownerFace, ...view.hearts];
    if (slot === undefined || slot === null) {
      parts.forEach((part) => part.setVisible(false));
      setPixelText(view.name, "");
      view.owner.forEach((label) => setPixelText(label, ""));
      setPixelText(view.fired, "");
      if (slot === null) {
        setPixelText(view.empty, "");
        return;
      }
      drawDashedRect(g, PALETTE.tan, { ...rect, width: rect.width - 2, x: rect.x + 1 });
      setPixelText(view.empty, gameData.runText.empty);
      return;
    }
    setPixelText(view.empty, "");
    const dog = gameData.dogs[slot.dog];
    const fired = slot.status === "fired";
    const art = artFits(this, CARD_KEY, DOG_CARD.size);
    view.card.setVisible(art);
    if (art) {
      playTag(view.card, CARD_KEY, dogCardTag(gameData, fired ? null : slot.dog));
    } else {
      fillRect(g, fired ? PALETTE.darkSlate : PALETTE.navy, {
        ...rect,
        width: rect.width - 2,
        x: rect.x + 1,
      });
    }
    setPixelText(view.name, dog.name);
    scalePixelText(
      view.name,
      DOG_CARD.name.scale,
      rect.x + DOG_CARD.name.x,
      rect.y + DOG_CARD.name.top,
    );
    this.showOwnerName(view.owner, dog.owner.name, rect);
    setPixelText(view.fired, fired ? gameData.runText.fired : "");
    const max = ownerMaxHearts(gameData, run, slot.dog);
    const ownerKey = ownerCardFaceKey(gameData, slot.dog);
    playTag(
      view.ownerFace.setTexture(ownerKey).setVisible(true),
      ownerKey,
      cardOwnerMood(gameData, max, slot),
    );
    if (fired) {
      view.dogFace.setVisible(false);
    } else {
      const dogKey = dogFaceKey(gameData, slot.dog);
      playTag(
        view.dogFace.setTexture(dogKey).setVisible(true),
        dogKey,
        faceMood(gameData, max, slot.hearts),
      );
    }
    const cells = cardHearts(fired ? 0 : slot.hearts, max);
    const heartArt = this.textures.exists(HEART_KEY);
    view.hearts.forEach((sprite, i) => {
      const cell = cells[i];
      sprite.setVisible(heartArt && cell !== undefined);
      if (cell === undefined) {
        return;
      }
      if (heartArt) {
        sprite.setPosition(rect.x + cell.x, rect.y + cell.y);
        playTag(sprite, HEART_KEY, cell.full ? "full-dark" : "empty-dark");
      } else {
        drawHeart(g, rect.x + cell.x, rect.y + cell.y, cell.full ? PALETTE.red : PALETTE.grey);
      }
    });
  }

  // The owner's name beside their photo, on one line or two, measured on the first label.
  private showOwnerName(labels: readonly GameObjects.BitmapText[], name: string, rect: Rect): void {
    const [probe] = labels;
    if (probe === undefined) {
      return;
    }
    const rightEdge = (line: string) => {
      setPixelText(probe, line);
      return inkSpan(probe).right;
    };
    const lines = ownerNameLines(rightEdge, name);
    labels.forEach((label, i) => {
      const line = lines[i];
      setPixelText(label, line?.text ?? "");
      if (line !== undefined) {
        placePixelText(label, rect.x + DOG_CARD.owner.x, rect.y + line.top);
      }
    });
  }

  // An owner's tab on their dog's card, in mood, for ms.
  private popOwner(dog: DogId, mood: string, ms: number): void {
    const slot = this.slotOf(dog);
    if (slot !== undefined) {
      this.owners?.pop({ dog, mood, slot }, ms);
    }
  }

  // The run the HUD shows, while a walk is shown.
  private shownRun(): RunState | undefined {
    return this.walk().hudView()?.run;
  }

  private slotOf(dog: DogId): number | undefined {
    const index = slotIndexOf(this.shownRun()?.pack ?? [], dog);
    return index < 0 ? undefined : index;
  }

  // Each change shows where it happened: a money loss pops where it changed hands, a money gain
  // and the cash lost with the last firing by the cash, and each flies into the cash; a heart
  // change pops over its dog and flies into its card (heartFeedback.ts), its label then fading in
  // place on the card's bottom rows, while its owner pops in on the card for ownerMs.
  private floatLabels(ownerMs: number, labels: ChangeLabel[]): void {
    const run = this.walk();
    const body = pixelFontMetrics(this, "body");
    const money = labels.flatMap((label) =>
      label.target.kind === "bank" ? [{ from: label.target.from, label }] : [],
    );
    const orders = stackOrders(money.map(({ from }) => from));
    money.forEach(({ from, label }, i) => {
      const order = orders[i] ?? 0;
      this.showMoneyLabel(label, (shown) =>
        moneyChipPlace(body, SCREEN_CONFIG.width, from, order, shown),
      );
    });
    for (const label of labels) {
      if (label.target.kind === "cash") {
        if (label.target.tip) {
          this.showTipLabel(label);
        } else {
          this.showCashLabel(label);
        }
      }
    }
    const pops = heartPops({ lanes: this.lanes().heartLabels, run }, labels, (slot) => {
      const view = this.cards[slot];
      return view === undefined ? undefined : { card: view.card, parts: cardParts(view) };
    });
    pops.forEach((pop) => this.hearts?.play(pop));
    for (const label of labels) {
      if (label.target.kind === "dog") {
        this.popOwner(label.target.dog, label.gain ? "happy" : "upset", ownerMs);
      }
    }
  }

  // The heart a forgiven loss left on its owner's card, the last of their hearts, flashes back.
  private forgive(cue: ForgivenCue): void {
    const slot = this.slotOf(cue.dog);
    const rect = slot === undefined ? undefined : LAYOUT.dogSlots[slot];
    const run = this.shownRun();
    if (rect === undefined || run === undefined) {
      return;
    }
    const max = ownerMaxHearts(gameData, run, cue.dog);
    const cell = cardHearts(cue.hearts, max)[cue.hearts - 1];
    if (cell !== undefined) {
      const perk = perkIconKey(gameData.walkers[run.walker].perk);
      this.hearts?.forgive({ x: rect.x + cell.x, y: rect.y + cell.y }, perk);
    }
  }

  // The well of a buff that just changed the walk glints, as its charm pops.
  private glint(item: EffectItem): void {
    const run = this.shownRun();
    if (run === undefined) {
      return;
    }
    const key = effectIconKey(item);
    const well =
      BAR.effectWells[
        effectItems(gameData, run).findIndex((shown) => effectIconKey(shown) === key)
      ];
    if (well !== undefined) {
      glintWell(this, this.labels, well, 1);
    }
  }

  // A money change pops on its chip where place puts it and holds as a heart's pop does; then it
  // goes into the cash (sendMoneyLabel), calling left once it has left its place. Reduced motion
  // keeps the pop and fades it at once. depth: the chip's, as addChangeChip draws it.
  private showMoneyLabel(
    label: ChangeLabel,
    place: (shown: { lines: number; scale: number; width: number }) => { chip: Rect; text: Point },
    left: () => void = () => undefined,
    depth = 0,
  ): void {
    const chip = this.addChangeChip(label, MONEY_LABEL.room, place, depth);
    const held = this.holdOffCounter(label.amount);
    if (this.walk().reducedMotion()) {
      this.sendMoneyLabel(chip, held, left);
      return;
    }
    this.labels.after(this, MONEY_LABEL.holdMs, () => this.sendMoneyLabel(chip, held, left));
  }

  // A money gain's label that is not a tip's, or the cash lost with the last firing
  // (cashLostLabel), pops by the cash in the cash column's first free slot, which it holds until
  // it leaves, and goes in as any money label does (showMoneyLabel). It never adds up with a
  // tip's.
  private showCashLabel(label: ChangeLabel): void {
    const body = pixelFontMetrics(this, "body");
    const slot = this.takeCashSlot();
    this.showMoneyLabel(
      label,
      (shown) => cashChipPlace(body, slot, shown),
      () => this.cashSlots.delete(slot),
      HUD_DEPTH.cashChip,
    );
  }

  // A tip's label pops by the cash, in the cash column's first free slot, and holds as a heart's
  // pop does, then goes into the cash (sendMoneyLabel); with reduced motion it fades after the
  // hold. A tip grabbed while one shows adds up with it on one chip in its slot and restarts the
  // hold (mergeTips); one that cannot, as a Stinky "+$0" beside a paying tip, sends the showing
  // label in now and takes the first free slot.
  private showTipLabel(label: ChangeLabel): void {
    const showing = this.tip;
    const merged = showing === undefined ? undefined : mergeTips(showing.label, label);
    if (showing !== undefined) {
      if (merged === undefined) {
        this.sendMoneyLabel(showing.chip, showing.held, () => this.cashSlots.delete(showing.slot));
      } else {
        showing.chip.parts.forEach((part) => part.destroy());
      }
    }
    const tipLabel = merged ?? label;
    const slot = merged === undefined || showing === undefined ? this.takeCashSlot() : showing.slot;
    const body = pixelFontMetrics(this, "body");
    const chip = this.addChangeChip(
      tipLabel,
      MONEY_LABEL.room,
      (shown) => cashChipPlace(body, slot, shown),
      HUD_DEPTH.cashChip,
    );
    const before = merged === undefined ? 0 : (showing?.held ?? 0);
    const held = before + this.holdOffCounter(label.amount);
    const tip = { chip, held, label: tipLabel, slot };
    this.tip = tip;
    this.labels.after(this, MONEY_LABEL.holdMs, () => {
      if (this.tip === tip) {
        this.tip = undefined;
        this.sendMoneyLabel(chip, held, () => this.cashSlots.delete(slot));
      }
    });
  }

  // A zone's pay, its total, pops by the cash in the cash column's first free slot, which it holds
  // until it has faded: it shows while the fees' coins fly, timing's holdMs, then fades in place
  // over its fadeMs. The coins carry its money to the counter, so it never flies.
  private showPayTotal(label: ChangeLabel, timing: { fadeMs: number; holdMs: number }): void {
    const body = pixelFontMetrics(this, "body");
    const slot = this.takeCashSlot();
    const chip = this.addChangeChip(
      label,
      MONEY_LABEL.room,
      (shown) => cashChipPlace(body, slot, shown),
      HUD_DEPTH.cashChip,
    );
    this.labels.after(this, timing.holdMs, () => {
      const fade = { ms: timing.fadeMs, rise: 0 };
      this.labels.join(fadeAway(this, chip.parts, fade, () => this.cashSlots.delete(slot)));
    });
  }

  // The cash column's first free slot, now held.
  private takeCashSlot(): number {
    const slot = freeCashSlot(this.cashSlots);
    this.cashSlots.add(slot);
    return slot;
  }

  // The money a label keeps off the counter until it lands, of amount: all of it, or none with
  // reduced motion, where the counter counts it at once.
  private holdOffCounter(amount: number): number {
    const held = this.walk().reducedMotion() ? 0 : amount;
    this.moneyInFlight += held;
    return held;
  }

  // A money label's chip flies along a heart's arc into the cash, which counts held as it lands,
  // calling left as it sets off. Reduced motion fades it in place, as a heart lands without
  // flying, and calls left once it has faded.
  private sendMoneyLabel(chip: ChangeChip, held: number, left: () => void): void {
    if (this.walk().reducedMotion()) {
      this.moneyInFlight -= held;
      this.labels.join(fadeAway(this, chip.parts, { ms: LABEL_FADE_MS, rise: 0 }, left));
      return;
    }
    left();
    const land = () => {
      this.moneyInFlight -= held;
      chip.parts.forEach((part) => part.destroy());
    };
    const path = moneyFlightPath(chip.rect);
    const bases = chip.parts.map(({ x, y }) => ({ x, y }));
    const flight = { duration: FEEDBACK.heart.flyMs, ease: "Sine.easeIn", onComplete: land };
    this.labels.tween(
      this,
      arcFlight(path, flight, (point) => {
        const dx = point.x - path.from.x;
        const dy = point.y - path.from.y;
        chip.parts.forEach((part, i) => {
          const base = bases[i] ?? part;
          part.setPosition(base.x + dx, base.y + dy);
        });
      }),
    );
  }

  // A heart change's label in the middle of its card's bottom rows, once its heart has landed,
  // fading in place.
  private showHeartLabel(label: ChangeLabel, lane: Rect): void {
    const body = pixelFontMetrics(this, "body");
    const chip = this.addChangeChip(label, changeLabelRoom(lane.width), (shown) =>
      changeChipPlace(body, lane, shown),
    );
    this.labels.join(fadeAway(this, chip.parts, { ms: LABEL_FADE_MS, rise: 0 }));
  }

  // A change on a cream chip in its changeLabelColour, so it reads over anything; set within
  // room in CHANGE_LABEL_STYLE, placed by place, at depth (its text a depth over it). Its parts,
  // and its chip's rect.
  private addChangeChip(
    label: ChangeLabel,
    room: number,
    place: (shown: { lines: number; scale: number; width: number }) => { chip: Rect; text: Point },
    depth = 0,
  ): ChangeChip {
    const colour = changeLabelColour(label);
    const text = addPixelText(this, 0, 0, label.text, { colour, scale: 2 });
    const { lines, style } = fitPixelText(text, { room, style: CHANGE_LABEL_STYLE }, 0, 0);
    const ink = inkSpan(text);
    const placed = place({ lines: lines.length, scale: style.scale, width: ink.right - ink.left });
    placePixelText(text, placed.text.x - ink.left, placed.text.y);
    const chip = this.add.graphics().setDepth(depth);
    drawFramedRect(chip, CREAM_PANEL_COLOURS, placed.chip);
    text.setDepth(depth + HUD_DEPTH.overPart);
    return { parts: [chip, text], rect: placed.chip };
  }

  // The first-time hints the run's state raises, each said on the message strip once.
  private raiseHints(triggers: readonly HintTrigger[]): void {
    if (triggers.length === 0) {
      return;
    }
    const shown = [...shownHints(this)];
    for (const trigger of triggers) {
      const hint = hintFor(gameData, shown, trigger);
      if (hint !== null) {
        this.sayHint(hint);
        shown.push(hint.id);
      }
    }
  }

  // A first-time hint on the message strip, marked shown as it is said, which waits its turn
  // however long it takes. The low-hearts hint jumps the hints waiting their turn.
  private sayHint(hint: RaisedHint): void {
    markHintShown(this, hint.id);
    const line = { icon: "hint", keepsWaiting: true, text: hint.text } as const;
    this.messages.say(line, hintJumpsQueue(gameData, hint.id));
  }

  // Each badge earned on the way, on the message strip.
  private sayAchievements(ids: readonly AchievementId[]): void {
    for (const id of ids) {
      const achievement = gameData.achievements.find((candidate) => candidate.id === id);
      const text = stripLine(gameData, "achievement", { name: achievement?.name ?? id });
      soundboardOf(this).play("badge");
      this.messages.say({ icon: "achievement", text });
    }
  }

  // Each owner's quip on the message strip, led by their face, in the mood their hearts give,
  // and their name.
  private sayQuips(quips: readonly OwnerQuip[]): void {
    const run = this.shownRun();
    if (run === undefined) {
      return;
    }
    for (const { dog, text } of quips) {
      const hearts = heartsOf(run, dog) ?? 0;
      const max = ownerMaxHearts(gameData, run, dog);
      const icon = { dog, kind: "owner", mood: faceMood(gameData, max, hearts) } as const;
      this.messages.say({ icon, text });
    }
  }
}
