import { type GameObjects, Scene } from "phaser";

import { debuffIconKey } from "../assets/iconKeys";
import { dogCardTag, dogFaceKey, ownerCardFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { AchievementId, DebuffId, DogId, HintTrigger } from "../data/types";
import { dollarAmountText } from "../home/home";
import {
  effectIconFallback,
  effectIconKey,
  type EffectItem,
  effectItems,
  effectItemsKey,
  perkIconKey,
  walkBarIconKey,
} from "../hud/effectIcons";
import { explainDetail } from "../hud/explain";
import { runHintTriggers } from "../hud/hintTriggers";
import {
  CHANGE_LABEL_STYLES,
  changeChipPlace,
  changeLabelRoom,
  type HudLanes,
  hudLanes,
} from "../hud/hudLanes";
import type { ChangeLabel } from "../hud/hudView";
import type { MessageLine } from "../hud/messageStrip";
import { cardOwnerMood, FORGIVEN_EVENT, type ForgivenCue } from "../hud/moments";
import { STRIP_LINE_FIELDS } from "../hud/runText";
import {
  buttonIcon,
  pauseButtonIcon,
  playerPaused,
  type RunPause,
  TOP_BAR_BUTTONS,
  topBarAction,
  type TopBarButton,
  topBarButtonAt,
  topBarButtonForKey,
  type TopBarPress,
} from "../hud/topBar";
import {
  cardHearts,
  cardNameFit,
  cashLeft,
  cashScale,
  cashTop,
  DEBUFF_BAR,
  debuffBarRects,
  debuffFillWidth,
  DOG_CARD,
  type ExplainTarget,
  leadSlot,
  ownerNameLines,
  slotShown,
  WALK_BAR,
  WALK_BAR_BUTTONS,
  walkBarLayout,
  zoneProgressText,
} from "../hud/walkHud";
import { screenLayout } from "../layout/screenLayout";
import { fillLine } from "../lib/lines";
import type { Rect } from "../lib/rect";
import { maxHearts } from "../rules/dogs";
import { debuffLasting } from "../rules/durations";
import { hintFor, hintJumpsQueue } from "../rules/hints";
import { currentZone } from "../rules/route";
import { faceMood } from "../rules/treats";
import { type Cents, read } from "../rules/units";
import { placeInPack } from "../state/pack";
import type { PackSlot, RunState } from "../state/runState";
import { drawDashedRect, drawFramedRect, drawHeart, fillRect } from "../ui/phaser/draw";
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
import { glintWell } from "./buffCharm";
import { DEBUFF_COLORS, DEBUFF_FALLBACK } from "./debuffColors";
import { HudFeedback } from "./feedbackMoments";
import { HeartFeedback, heartPops } from "./heartFeedback";
import { drawDetailCard } from "./homePanels";
import type { HudRun, HudWalk, RunHudView } from "./hudWalk";
import { MESSAGE_EVENT, MessageStrip } from "./messageStripView";
import { listenOnePress } from "./onePress";
import { onSceneEvent } from "./overlay";
import { OwnerTabs } from "./ownerTabs";
import { isMuted, markHintShown, profileSave, shownHints, toggleMuted } from "./profileStore";
import {
  ACHIEVEMENTS_EVENT,
  BUFF_GLINT_EVENT,
  CHANGE_LABELS_EVENT,
  HINT_EVENT,
  type OwnerQuip,
  QUIPS_EVENT,
  type RaisedHint,
} from "./run/runMoments";
import { SCENE_KEYS } from "./sceneKeys";
import { type ScenePicture, showAsPicture } from "./scenePicture";
import { soundboardOf } from "./soundboard";
import { playTag } from "./sprites";
import { TimedGroup } from "./timedGroup";
import { addTagImage, artFits, cogIcon, fadeAway, imageIcon, soundIcon } from "./uiKit";

const LAYOUT = screenLayout(SCREEN_CONFIG);
const BAR = walkBarLayout(LAYOUT.topBar);

const LABEL = { ms: 1100 };
// The message strip draws under the HUD's other parts, and over a card's or the pause menu's
// parts when it draws there.
const MESSAGE_DEPTH = { hud: -1, overlay: 1000 };
// An explanation's detail card draws over every other part of the HUD.
const DETAIL_DEPTH = 2000;
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

// The walk bar, the debuff bars and the dog cards, drawn over the road for the whole walk and
// kept in view while cards are up. It reads the run every frame and redraws what changed, and
// shows the run's change labels, first-time hints, owners' pop-ins and what a held press
// explains. It keeps running while the walk is paused, so the bar's buttons and their
// keys work in every state; its animations run on too, being the bar's and not the walk's,
// except the walk's moments: while the player has paused, heart pops, change labels and the
// message strip's ageing hold.
export class HudScene extends Scene {
  private bankLabels: ChangeLabel[] = [];
  private bankShowing = false;
  private cards: CardView[] = [];
  private debuffBars: DebuffBarView[] = [];
  private debuffFills: GameObjects.Graphics | undefined;
  private detailLayer: GameObjects.Container | undefined;
  private dollar: GameObjects.BitmapText | undefined;
  private drawn: Record<string, unknown> = {};
  private dynamic: GameObjects.Graphics | undefined;
  private effectParts: GameObjects.GameObject[] = [];
  private explained = "";
  private feedback: HudFeedback | undefined;
  private hearts: HeartFeedback | undefined;
  // The change labels on screen.
  private labels = new TimedGroup();
  private messages = new MessageStrip();
  private money: GameObjects.BitmapText | undefined;
  private owners: OwnerTabs | undefined;
  private pauseGlyph: GameObjects.Graphics | undefined;
  private pauseIcon: GameObjects.Image | undefined;
  private soundHolder: GameObjects.Container | undefined;
  private picture: HudWalk | undefined;
  private run: HudRun | undefined;
  private zoneLabel: GameObjects.BitmapText | undefined;
  private zoneProgress: GameObjects.BitmapText | undefined;

  // key names a second HUD, such as the help's picture of one.
  constructor(key: string = SCENE_KEYS.hud) {
    super(key);
  }

  // The HUD's lanes, under the message strip as tall as the body font draws it.
  private lanes(): HudLanes {
    return hudLanes(pixelFontMetrics(this, "body"), LAYOUT);
  }

  create(data: HudSceneData): void {
    const { dogRow, dogSlots, topBar } = LAYOUT;
    const picture = "picture" in data ? data.picture : undefined;
    this.picture = picture?.source;
    this.run = "run" in data ? data.run : undefined;
    if (picture !== undefined) {
      showAsPicture(this, picture.view);
    }
    this.drawn = {};
    this.debuffBars = [];
    this.effectParts = [];
    this.explained = "";
    this.messages = new MessageStrip();
    this.bankLabels = [];
    this.bankShowing = false;
    this.labels = new TimedGroup();
    const g = this.add.graphics();
    // The card band ends on the screen's bottom row, its top rows (the shadow and the trim)
    // over the road's last rows.
    if (this.textures.exists("ui-dog-card-band")) {
      this.add.image(dogRow.x, dogRow.y + dogRow.height, "ui-dog-card-band").setOrigin(0, 1);
    } else {
      fillRect(g, PALETTE.darkBrown, dogRow);
    }
    if (this.textures.exists("ui-walk-bar")) {
      this.add.image(topBar.x, topBar.y, "ui-walk-bar").setOrigin(0);
    } else {
      fillRect(g, PALETTE.plum, topBar);
      [WALK_BAR.cash.well, BAR.zoneWell].forEach((well) => fillRect(g, PALETTE.ink, well));
    }
    WALK_BAR_BUTTONS.forEach((id) => this.addButton(TOP_BAR_BUTTONS[id]));
    this.addHomeIcon();
    // A container holds the icon's place in the draw order while it is swapped.
    this.soundHolder = this.add.container(0, 0);
    this.showSoundIcon(isMuted(this));
    const help = buttonIcon(TOP_BAR_BUTTONS.help, false);
    if (imageIcon(this, "icon-help", help.x, help.y).length === 0) {
      addPixelText(this, help.x + 8, help.y + 4, "?", { color: PALETTE.cream, originX: 0.5 });
    }
    const settings = buttonIcon(TOP_BAR_BUTTONS.settings, false);
    if (imageIcon(this, "icon-settings", settings.x, settings.y).length === 0) {
      cogIcon(this, settings.x, settings.y);
    }
    const pauseIcon = buttonIcon(TOP_BAR_BUTTONS.pause, false);
    this.pauseIcon = this.add.image(pauseIcon.x, pauseIcon.y, "__DEFAULT").setOrigin(0);
    this.pauseGlyph = this.add.graphics();

    const { zone } = WALK_BAR;
    const title = { font: "title" } as const;
    this.dollar = addPixelText(this, 0, 0, "$", { color: PALETTE.amber, ...title });
    this.money = addPixelText(this, 0, 0, "", { color: PALETTE.cream, ...title });
    this.zoneLabel = addPixelText(this, topBar.x + zone.name.x, topBar.y + zone.name.y, "", {
      color: PALETTE.cream,
    });
    const progressRight = topBar.x + zone.progress.right + 1;
    this.zoneProgress = addPixelText(this, progressRight, topBar.y + zone.progress.y, "", {
      color: PALETTE.grey,
      originX: 1,
    });
    this.dynamic = this.add.graphics();
    this.debuffFills = this.add.graphics().setDepth(1);
    this.cards = dogSlots.map((rect) => this.createCard(rect));
    this.detailLayer = this.add.container(0, 0).setDepth(DETAIL_DEPTH);

    const run = this.walk();
    const firingRects = () => this.feedback?.firingRects() ?? [];
    this.owners = new OwnerTabs(this, { still: () => run.reducedMotion() });
    this.feedback = new HudFeedback(this, run, {
      firingShown: () => this.hearts?.clearWay(),
      floatLabels: (ownerMs, labels) => this.floatLabels(ownerMs, labels),
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

  // The topmost overlay over the walk, the pause menu or the card, else the HUD itself. A
  // picture of the HUD has none.
  private overlayScene(): Scene {
    const key = [SCENE_KEYS.pause, SCENE_KEYS.card].find((overlay) => this.scene.isActive(overlay));
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

  private press(via: "key" | "tap", button: TopBarPress): void {
    const run = this.run;
    if (run === undefined) {
      return;
    }
    switch (topBarAction(run.runPause(), via, button)) {
      case "confirmHome":
        run.openPause("homeQuestion");
        break;
      case "mute":
        toggleMuted(this);
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

  // icon-home on Home's face, else a cream house drawn on it.
  private addHomeIcon(): void {
    const { x, y } = buttonIcon(TOP_BAR_BUTTONS.home, false);
    if (this.textures.exists("icon-home")) {
      this.add.image(x, y, "icon-home").setOrigin(0);
      return;
    }
    const g = this.add.graphics();
    // The roof's rows widening down from its peak, then the walls with a door in the middle.
    [2, 4, 6, 8, 10, 12].forEach((width, row) => {
      fillRect(g, PALETTE.cream, { height: 1, width, x: x + 8 - width / 2, y: y + 2 + row });
    });
    fillRect(g, PALETTE.cream, { height: 6, width: 10, x: x + 3, y: y + 8 });
    fillRect(g, PALETTE.navy, { height: 4, width: 2, x: x + 7, y: y + 10 });
  }

  // icon-sound's on or off frame on the sound button's face, for M and Settings too.
  private showSoundIcon(muted: boolean): void {
    const holder = this.soundHolder;
    if (holder === undefined) {
      return;
    }
    holder.removeAll(true);
    const { x, y } = buttonIcon(TOP_BAR_BUTTONS.sound, false);
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
      : addPixelText(this, x + lead.x + 2, y + lead.y + 3, "Lead", {
          color: PALETTE.amber,
          font: "title",
        });
    return {
      card,
      dogFace: sprite("treat", DOG_CARD.dogFace),
      empty: addPixelText(this, x + empty.x, y + empty.y, "", {
        color: PALETTE.cream,
        font: "title",
        originX: 0.5,
      }),
      fired: addPixelText(this, x + fired.x, y + fired.y, "", {
        color: PALETTE.white,
        font: "title",
        originX: 0.5,
      }),
      hearts: Array.from({ length: MAX_CARD_HEARTS }, () => sprite(HEART_KEY, { x: 0, y: 0 })),
      lead: leadTag.setVisible(false),
      name: addPixelText(this, x + name.x, y, "", {
        color: PALETTE.cream,
        font: "title",
        originX: 0.5,
      }),
      owner: owner.tops.twoLines.map((top) =>
        addPixelText(this, x + owner.x, y + top, "", { color: PALETTE.tan }),
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
    this.showExplanation(view);
    this.showDebuffBars(view.run);
    const overlay = this.overlayScene();
    const depth = overlay === this ? MESSAGE_DEPTH.hud : MESSAGE_DEPTH.overlay;
    // The strip's lines wait under an explanation's detail card.
    const aged = held || pause.hold ? 0 : delta;
    this.messages.update(aged, overlay, depth, this.debuffBars.length);
    const effects = effectItems(gameData, view.run);
    // The run state is immutable, so a changed pack or modifier list is a new array.
    const state: Record<string, unknown> = {
      effects: effectItemsKey(effects),
      modifiers: view.run.modifiers,
      money: this.shownMoney(view.run.money),
      muted: isMuted(this),
      pack: view.run.pack,
      pauseIcon: pauseButtonIcon(pause),
      route: view.run.route,
      zone: view.run.zoneIndex,
    };
    if (Object.keys(state).some((key) => state[key] !== this.drawn[key])) {
      if (state.muted !== this.drawn.muted) {
        this.showSoundIcon(isMuted(this));
      }
      if (state.effects !== this.drawn.effects) {
        this.showEffects(effects);
      }
      this.drawn = state;
      this.showPauseIcon(pause);
      this.redraw(view);
    }
  }

  // The counter leaves out fees still flying to it.
  private shownMoney(money: Cents): Cents {
    return this.feedback?.shownMoney(money) ?? money;
  }

  // The "$" and the amount from the cash's x at the largest scale that fits, one font advance
  // apart, their capitals' bottom on the same row at every scale.
  private showMoney(amount: string): void {
    const { dollar, money } = this;
    if (dollar === undefined || money === undefined || money.text === amount) {
      return;
    }
    setPixelText(money, `$${amount}`);
    scalePixelText(money, 1, 0, 0);
    const whole = inkSpan(money);
    const wholeAdvance = money.width;
    setPixelText(money, amount);
    scalePixelText(money, 1, 0, 0);
    const scale = cashScale(whole.right - whole.left);
    const advance = (wholeAdvance - money.width) * scale;
    const left = LAYOUT.topBar.x + cashLeft((whole.right - whole.left) * scale);
    const x = left - whole.left * scale;
    const top = LAYOUT.topBar.y + cashTop(scale);
    scalePixelText(dollar, scale, x, top);
    scalePixelText(money, scale, x + advance, top);
  }

  // The effect wells: each effect's 20x20 icon in its well, in the walk's order.
  private showEffects(effects: readonly EffectItem[]): void {
    this.effectParts.forEach((part) => part.destroy());
    const { icon, iconSize } = WALK_BAR.effects;
    this.effectParts = BAR.effectWells.flatMap((well, i) => {
      const item = effects[i];
      if (item === undefined) {
        return [];
      }
      const key = walkBarIconKey(item);
      const x = well.x + icon;
      const y = well.y + icon;
      const half = iconSize / 2;
      return [
        this.textures.exists("ui-effect-well")
          ? this.add.image(well.x, well.y, "ui-effect-well").setOrigin(0)
          : this.add.rectangle(well.x, well.y, well.width, well.height, PALETTE.ink).setOrigin(0),
        this.textures.exists(key)
          ? this.add.image(x, y, key).setOrigin(0)
          : addPixelText(this, x + half, y + half - 2, effectIconFallback(gameData, item), {
              color: PALETTE.cream,
              originX: 0.5,
            }),
      ];
    });
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
      // A debuff a buff shortened, such as by Calm voice, starts part way down its bar.
      const { seconds } = gameData.debuffs[bar.debuff];
      const full = Math.max(
        read(gameData.tuning, "seconds", seconds),
        debuffLasting(gameData.tuning, seconds, run).secondsLeft,
      );
      const width = debuffFillWidth(active.secondsLeft, full);
      const colors = DEBUFF_COLORS[bar.debuff] ?? DEBUFF_FALLBACK;
      if (width > 0) {
        fillRect(g, colors.fill, {
          ...fill,
          width,
          x: bar.rect.x + fill.x,
          y: bar.rect.y + fill.y,
        });
      }
    }
  }

  private addDebuffBar(debuff: DebuffId, rect: Rect): DebuffBarView {
    const colors = DEBUFF_COLORS[debuff] ?? DEBUFF_FALLBACK;
    const parts: GameObjects.GameObject[] = [];
    const art = addTagImage(this, "ui-debuff-bar", debuff, rect.x, rect.y);
    if (art === undefined) {
      parts.push(
        this.add.rectangle(rect.x, rect.y, rect.width, rect.height, colors.face).setOrigin(0),
      );
    } else {
      parts.push(art);
    }
    const { icon, name } = DEBUFF_BAR;
    const iconKey = debuffIconKey(debuff);
    if (this.textures.exists(iconKey)) {
      parts.push(this.add.image(rect.x + icon.x, rect.y + icon.y, iconKey).setOrigin(0));
    }
    parts.push(
      addPixelText(this, rect.x + name.x, rect.y + name.y, gameData.debuffs[debuff].name, {
        color: colors.name,
        font: "title",
      }),
    );
    return { debuff, parts, rect };
  }

  // The detail card of what a held press explains, the home screen's, over the HUD while it is
  // open. The walk is paused under it, so it is drawn once as it opens.
  private showExplanation(view: RunHudView): void {
    const target: ExplainTarget | undefined = view.explaining;
    const key = target === undefined ? "" : JSON.stringify(target);
    const layer = this.detailLayer;
    if (key === this.explained || layer === undefined) {
      return;
    }
    this.explained = key;
    layer.removeAll(true);
    const detail =
      target === undefined
        ? undefined
        : explainDetail(gameData, profileSave(this), view.run, target);
    if (detail !== undefined) {
      drawDetailCard(this, layer, false, detail.card, detail.picture, detail.kind);
    }
  }

  private redraw(view: RunHudView): void {
    const g = this.dynamic;
    if (g === undefined) {
      return;
    }
    const { run } = view;
    g.clear();
    this.showMoney(dollarAmountText(this.shownMoney(run.money)));
    const zone = currentZone(gameData, run);
    if (this.zoneLabel !== undefined) {
      setPixelText(this.zoneLabel, zone.name);
    }
    if (this.zoneProgress !== undefined) {
      setPixelText(this.zoneProgress, zoneProgressText(gameData, run.zoneIndex));
    }
    const ownedSlots = profileSave(this).owned.dogSlots;
    const lead = leadSlot(run.pack.map((slot) => slot.status === "walking"));
    LAYOUT.dogSlots.forEach((rect, i) => {
      const card = this.cards[i];
      if (card !== undefined) {
        const packSlot = run.pack[i];
        const shown = slotShown(ownedSlots, i, packSlot !== undefined);
        this.drawCard(g, rect, card, run, shown === "hidden" ? null : packSlot);
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
    rect: Rect,
    view: CardView,
    run: RunState,
    slot: PackSlot | null | undefined,
  ): void {
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
      setPixelText(view.empty, "Empty");
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
    this.fitName(view.name, dog.name, rect);
    this.showOwnerName(view.owner, dog.owner.name, rect);
    setPixelText(view.fired, fired ? gameData.runText.fired : "");
    const max = maxHearts(gameData.tuning, run.modifiers, placeInPack(run, slot.dog), dog);
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

  // The name at 2x when it fits the card, else 1x.
  private fitName(label: GameObjects.BitmapText, text: string, rect: Rect): void {
    setPixelText(label, text);
    const fit = cardNameFit(label.width / label.scaleX);
    scalePixelText(label, fit.scale, rect.x + DOG_CARD.name.x, rect.y + fit.top);
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

  private slotOf(dog: DogId): number | undefined {
    const index =
      this.walk()
        .hudView()
        ?.run.pack.findIndex((slot) => slot.dog === dog) ?? -1;
    return index < 0 ? undefined : index;
  }

  // Each change shows in its lane and fades out: a money change in the bank lane (one at a
  // time); a heart change pops over its dog and flies into its card (heartFeedback.ts), its
  // label then fading in place on the card's bottom rows, while its owner pops in on the card
  // for ownerMs.
  private floatLabels(ownerMs: number, labels: ChangeLabel[]): void {
    const run = this.walk();
    this.bankLabels.push(...labels.filter((label) => label.target.kind === "bank"));
    if (!this.bankShowing) {
      this.showNextBankLabel();
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
    const run = this.walk().hudView()?.run;
    if (rect === undefined || run === undefined) {
      return;
    }
    const max = maxHearts(
      gameData.tuning,
      run.modifiers,
      placeInPack(run, cue.dog),
      gameData.dogs[cue.dog],
    );
    const cell = cardHearts(cue.hearts, max)[cue.hearts - 1];
    if (cell !== undefined) {
      const perk = perkIconKey(gameData.walkers[run.walker].perk);
      this.hearts?.forgive({ x: rect.x + cell.x, y: rect.y + cell.y }, perk);
    }
  }

  // The well of a buff that just changed the walk glints, as its charm pops.
  private glint(item: EffectItem): void {
    const run = this.walk().hudView()?.run;
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

  // The next money change in the bank lane, under the cash well: it rises from the lane's
  // bottom to its top, or fades in place with reduced motion, then the next follows.
  private showNextBankLabel(): void {
    const label = this.bankLabels.shift();
    this.bankShowing = label !== undefined;
    if (label === undefined) {
      return;
    }
    const rise = !this.walk().reducedMotion();
    this.showLabel(label, { anchor: "bottom", lane: this.lanes().bank, rise }, () =>
      this.showNextBankLabel(),
    );
  }

  // A heart change's label on its card's bottom rows, once its heart has landed.
  private showHeartLabel(label: ChangeLabel, lane: Rect): void {
    this.showLabel(label, { anchor: "middle", lane, rise: false });
  }

  // A change on a cream chip, so gains in forest and losses in dark red read over anything,
  // fitted to its lane by CHANGE_LABEL_STYLES. A rising chip rises to the lane's top.
  private showLabel(
    label: ChangeLabel,
    at: { anchor: "bottom" | "middle"; lane: Rect; rise: boolean },
    done: () => void = () => undefined,
  ): void {
    const text = addPixelText(this, 0, 0, label.text, {
      color: label.amount === 0 ? PALETTE.grey : label.gain ? PALETTE.forest : PALETTE.darkRed,
      scale: 2,
    });
    const room = changeLabelRoom(at.lane.width);
    const { lines, style } = fitPixelText(text, { room, styles: CHANGE_LABEL_STYLES }, 0, 0);
    const ink = inkSpan(text);
    const shown = { lines: lines.length, scale: style.scale, width: ink.right - ink.left };
    const place = changeChipPlace(pixelFontMetrics(this, "body"), at.lane, at.anchor, shown);
    placePixelText(text, place.text.x - ink.left, place.text.y);
    const chip = this.add.graphics();
    drawFramedRect(chip, { border: PALETTE.plum, fill: PALETTE.cream }, place.chip);
    text.setDepth(1);
    const rise = at.rise ? place.chip.y - at.lane.y : 0;
    this.labels.join(fadeAway(this, [chip, text], { ms: LABEL.ms, rise }, done));
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

  // A first-time hint on the message strip, marked shown as it is said. The low-hearts hint
  // jumps the hints waiting their turn.
  private sayHint(hint: RaisedHint): void {
    markHintShown(this, hint.id);
    this.messages.say({ icon: "hint", text: hint.text }, hintJumpsQueue(gameData, hint.id));
  }

  // Each badge earned on the way, on the message strip.
  private sayAchievements(ids: readonly AchievementId[]): void {
    for (const id of ids) {
      const achievement = gameData.achievements.find((candidate) => candidate.id === id);
      const text = fillLine(STRIP_LINE_FIELDS, gameData.runText.strip, "achievement", {
        name: achievement?.name ?? id,
      });
      soundboardOf(this).play("badge");
      this.messages.say({ icon: "achievement", text });
    }
  }

  // Each owner's quip on the message strip, led by their face, in the mood their hearts give,
  // and their name.
  private sayQuips(quips: readonly OwnerQuip[]): void {
    const run = this.walk().hudView()?.run;
    if (run === undefined) {
      return;
    }
    for (const { dog, text } of quips) {
      const slot = run.pack.find((candidate) => candidate.dog === dog);
      const hearts = slot?.status === "walking" ? slot.hearts : 0;
      const max = maxHearts(
        gameData.tuning,
        run.modifiers,
        placeInPack(run, dog),
        gameData.dogs[dog],
      );
      const icon = { dog, kind: "owner", mood: faceMood(gameData, max, hearts) } as const;
      this.messages.say({ icon, text });
    }
  }
}
