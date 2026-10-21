import { type GameObjects, Scene } from "phaser";

import { MONEY_ICON_KEY, quirkIconKey, statusIconKey, TREAT_ICON_KEY } from "../assets/iconKeys";
import {
  dogFaceKey,
  doghouseTag,
  ownerFaceKey,
  ZONE_PIPS_KEY,
  zoneIconKey,
} from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { AchievementId, HintTrigger } from "../data/types";
import { DOGHOUSE, doghouseHearts, fittingScale, heartCount, slotShown } from "../hud/doghouse";
import {
  dismissHint,
  EMPTY_HINT_QUEUE,
  hintAlpha,
  type HintQueue,
  type RaisedHint,
  stepHintQueue,
} from "../hud/hintQueue";
import { runHintTriggers } from "../hud/hintTriggers";
import { centredInLane, hudLanes, stripHintPlace, UP_TAIL } from "../hud/hudLanes";
import { type ChangeLabel, pipLook, wholeDollars, zonePips } from "../hud/hudView";
import {
  moveStripPress,
  stripItems,
  stripLayout,
  type StripPress,
  stripTapAllowed,
  stripTapped,
} from "../hud/stateStrip";
import {
  buttonIcon,
  DOLLAR_GAP,
  HOME_BUTTON,
  MONEY_WELL,
  moneyTop,
  PAUSE_BUTTON,
  pauseButtonIcon,
  type RunPause,
  SOUND_BUTTON,
  TOP_BAR,
  topBarAction,
  type TopBarButton,
  topBarButtonAt,
  topBarButtonForKey,
  type TopBarPress,
  TREAT_WELL,
  walkCovered,
  WELL_INSET,
} from "../hud/topBar";
import { insetRect, type Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { TEXT_FIT_STYLES } from "../layout/textFit";
import { maxHearts } from "../rules/dogs";
import { hintFor } from "../rules/hints";
import { currentZone, walkLength } from "../rules/route";
import { faceMood } from "../rules/treats";
import { type Cents, read } from "../rules/units";
import { isNervousAlone } from "../runner/needs";
import { statusesKey, statusesOf, type StatusMark } from "../runner/statuses";
import type { PackSlot, RunState } from "../state/runState";
import { AchievementToasts } from "./achievementToast";
import { drawDashedRect, drawFramedRect, drawHeart, drawRing, fillRect } from "./draw";
import { HudFeedback } from "./feedbackMoments";
import { HeartFeedback, heartPops } from "./heartFeedback";
import { listenOnePress } from "./onePress";
import { colorFromHex, PALETTE } from "./palette";
import {
  addPixelText,
  fitPixelText,
  inkSpan,
  placePixelText,
  scalePixelText,
  setPixelText,
  wrapPixelText,
} from "./pixelText";
import { isMuted, markHintShown, profileSave, shownHints, toggleMuted } from "./profileStore";
import {
  ACHIEVEMENTS_EVENT,
  CHANGE_LABELS_EVENT,
  HINT_EVENT,
  type QuipBubble,
  QUIPS_EVENT,
} from "./run/runMoments";
import type { RunHudView, RunScene } from "./RunScene";
import { SCENE_KEYS } from "./sceneKeys";
import { firstTag, playTag } from "./sprites";
import { StateStripView } from "./stateStripView";
import { addPanel, artFits, soundIcon } from "./uiKit";

// The zone's name is right-aligned in its well, its icon just left of it, and the pips end
// under the name's right edge.
const ZONE_WELL = { right: TOP_BAR.zone.nameRight, y: TOP_BAR.zone.y + 4 };
const PIP = {
  gap: 3,
  height: 8,
  width: 18,
  x: ZONE_WELL.right + 3 - walkLength(gameData) * 21,
  y: TOP_BAR.zone.y + 17,
};
const LAYOUT = screenLayout(SCREEN_CONFIG);
const LANES = hudLanes(LAYOUT);
const LABEL = { height: 20, ms: 1100 };
const HINT = { fadeMs: 400, holdMs: 4500, padding: 6 };
// An owner's quip fills the quip lane's height, its text at 2x on one line, else at 1x. It
// draws over the doghouses and their heart-loss flash (depth 0), under the HUD's moments.
const QUIP = { depth: 30, holdMs: 2600, padding: 4 };

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
  quirk: GameObjects.Image;
  statuses: GameObjects.Image[];
}

// A slot's parts that shake with it.
function slotParts(view: SlotView | undefined): GameObjects.Components.Transform[] {
  if (view === undefined) {
    return [];
  }
  const { count, dogFace, fired, hearts, house, name, ownerFace, ownerName, statuses } = view;
  return [house, dogFace, ownerFace, name, ownerName, count, fired, ...hearts, ...statuses];
}

// The top bar and doghouses, drawn over the road for the whole walk and kept in view while
// cards are up. It reads the run from RunScene every frame and redraws what changed, and
// shows the run's change labels, first-time hints and owners' quips. It keeps running while
// the walk is paused, so the top bar's buttons and their keys work in every state; its
// animations run on too, being the bar's and not the walk's.
export class HudScene extends Scene {
  private drawn: Record<string, unknown> = {};
  private dynamic: GameObjects.Graphics | undefined;
  private feedback: HudFeedback | undefined;
  // The affected doghouses' frames, over the house art.
  private frames: GameObjects.Graphics | undefined;
  private hints: HintQueue = EMPTY_HINT_QUEUE;
  private hintParts: GameObjects.GameObject[] = [];
  private hintRaised: RaisedHint[] = [];
  private hearts: HeartFeedback | undefined;
  private dollar: GameObjects.BitmapText | undefined;
  private money: GameObjects.BitmapText | undefined;
  private pauseGlyph: GameObjects.Graphics | undefined;
  private pauseIcon: GameObjects.Image | undefined;
  private pips: GameObjects.Sprite[] = [];
  private bankLabels: ChangeLabel[] = [];
  private bankShowing = false;
  private quips: { quip: QuipBubble; raisedMs: number }[] = [];
  private quipShowing = false;
  private slots: SlotView[] = [];
  private soundHolder: GameObjects.Container | undefined;
  private strip: StateStripView | undefined;
  private toasts: AchievementToasts | undefined;
  // Badges earned while a hint, card or menu shows, which wait for it to close.
  private toastsWaiting: AchievementId[] = [];
  private treats: GameObjects.BitmapText | undefined;
  private zoneIcon: GameObjects.Image | undefined;
  private zoneLabel: GameObjects.BitmapText | undefined;

  constructor() {
    super(SCENE_KEYS.hud);
  }

  create(): void {
    const { dogRow, dogSlots, topBar } = LAYOUT;
    this.drawn = {};
    this.hints = EMPTY_HINT_QUEUE;
    this.hintParts = [];
    this.hintRaised = [];
    this.quips = [];
    this.quipShowing = false;
    this.bankLabels = [];
    this.bankShowing = false;
    this.toastsWaiting = [];
    const g = this.add.graphics();
    // The band under the doghouses ends on the screen's bottom row, its top rows (the divider)
    // over the road's last rows.
    if (this.textures.exists("ui-dog-band")) {
      this.add.image(dogRow.x, dogRow.y + dogRow.height, "ui-dog-band").setOrigin(0, 1);
    } else {
      fillRect(g, PALETTE.darkBrown, dogRow);
    }
    if (this.textures.exists("ui-top-bar")) {
      this.add.image(topBar.x, topBar.y, "ui-top-bar").setOrigin(0);
    } else {
      fillRect(g, PALETTE.plum, topBar);
      fillRect(g, PALETTE.darkBrown, { ...topBar, height: 2, y: topBar.y + topBar.height - 2 });
      [TOP_BAR.money, TOP_BAR.treats, TOP_BAR.zone].forEach((well) =>
        fillRect(g, PALETTE.ink, well),
      );
    }
    this.addButton(HOME_BUTTON);
    this.addHomeIcon();
    this.addButton(SOUND_BUTTON);
    // A container holds the icon's place in the draw order while it is swapped.
    this.soundHolder = this.add.container(0, 0);
    this.showSoundIcon(isMuted(this));
    this.addButton(PAUSE_BUTTON);
    const pauseIcon = buttonIcon(PAUSE_BUTTON, false);
    this.pauseIcon = this.add.image(pauseIcon.x, pauseIcon.y, "__DEFAULT").setOrigin(0);
    this.pauseGlyph = this.add.graphics();

    const { money: moneyWell, zone: zoneWell } = TOP_BAR;
    this.add.image(moneyWell.x + 4, moneyWell.y + 5, MONEY_ICON_KEY).setOrigin(0);
    const money = { font: "title", scale: 2 } as const;
    this.dollar = addPixelText(this, MONEY_WELL.dollarX, MONEY_WELL.top, "$", {
      color: PALETTE.amber,
      ...money,
    });
    this.money = addPixelText(this, 0, MONEY_WELL.top, "", { color: PALETTE.cream, ...money });
    this.add.image(TREAT_WELL.icon.x, TREAT_WELL.icon.y, TREAT_ICON_KEY).setOrigin(0);
    this.treats = addPixelText(this, 0, TREAT_WELL.countTop, "", {
      color: PALETTE.cream,
      font: "title",
      scale: TREAT_WELL.countStyle.scale,
    }).setLetterSpacing(TREAT_WELL.countStyle.letterSpacing);
    this.zoneIcon = this.add.image(0, zoneWell.y - 1, "__DEFAULT").setOrigin(1, 0);
    this.zoneLabel = addPixelText(this, ZONE_WELL.right, ZONE_WELL.y, "", {
      color: PALETTE.cream,
      font: "title",
      originX: 1,
    });
    this.pips = Array.from({ length: walkLength(gameData) }, (_, i) =>
      this.add.sprite(PIP.x + i * (PIP.width + PIP.gap), PIP.y, ZONE_PIPS_KEY).setOrigin(0),
    );
    this.dynamic = this.add.graphics();
    this.slots = dogSlots.map((rect) => this.createSlot(rect));
    this.frames = this.add.graphics();
    // Opening the strip's bubble closes the hint, and a hint opening closes the bubble. The
    // walk pauses while the bubble is open.
    this.strip = new StateStripView(this, LANES.stripBubble, {
      onClose: () => this.runScene().setStripBubble(false),
      onOpen: () => {
        this.hints = dismissHint(this.hints);
        this.runScene().setStripBubble(true);
      },
      tappable: () => stripTapAllowed(this.runScene().runPause()),
    });

    const run = this.runScene();
    this.feedback = new HudFeedback(this, run, {
      firingShown: () => this.hearts?.clearWay(),
      floatLabels: (labels) => this.floatLabels(labels),
    });
    this.hearts = new HeartFeedback(this, {
      clearOf: () => this.feedback?.firingRects() ?? [],
      landed: (label, lane) => this.showHeartLabel(label, lane),
      quipTop: LANES.quip.y,
      still: () => run.reducedMotion(),
    });
    const onLabels = (labels: ChangeLabel[]) => this.floatLabels(labels);
    const onHint = (hint: RaisedHint) => this.hintRaised.push(hint);
    const onQuips = (quips: QuipBubble[]) => this.queueQuips(quips);
    this.toasts = new AchievementToasts(this, LANES.toast, () => run.reducedMotion());
    const onAchievements = (ids: AchievementId[]) => this.toastsWaiting.push(...ids);
    run.events.on(ACHIEVEMENTS_EVENT, onAchievements);
    run.events.on(CHANGE_LABELS_EVENT, onLabels);
    run.events.on(HINT_EVENT, onHint);
    run.events.on(QUIPS_EVENT, onQuips);
    this.events.once("shutdown", () => {
      run.events.off(CHANGE_LABELS_EVENT, onLabels);
      run.events.off(HINT_EVENT, onHint);
      run.events.off(QUIPS_EVENT, onQuips);
      run.events.off(ACHIEVEMENTS_EVENT, onAchievements);
    });

    // A button acts on the press, as the walk's gestures never see it. A press on the strip
    // taps it on release, and is the walk's drag if it travels. While the strip's bubble is
    // open, a press anywhere else closes it on release; the walk drops that press.
    const tapMaxDistance = read(gameData.tuning, "pixels", "tapMaxDistance");
    let stripPress: StripPress | undefined;
    let closesBubble = false;
    listenOnePress(this, {
      down: (pointer) => {
        const point = { x: pointer.x, y: pointer.y };
        const button = topBarButtonAt(point.x, point.y);
        const onStrip = this.strip?.contains(point) === true;
        stripPress = onStrip ? { start: point, tapping: true } : undefined;
        closesBubble = !onStrip && button === undefined && this.strip?.isOpen() === true;
        if (button !== undefined) {
          this.press("tap", button);
        }
      },
      move: (pointer) => {
        if (stripPress !== undefined) {
          stripPress = moveStripPress(tapMaxDistance, { x: pointer.x, y: pointer.y }, stripPress);
        }
      },
      up: (pointer, cancelled) => {
        const press = stripPress;
        stripPress = undefined;
        if (closesBubble) {
          closesBubble = false;
          this.strip?.closeBubble();
        }
        const point = { x: pointer.x, y: pointer.y };
        if (press !== undefined && !cancelled && stripTapped(tapMaxDistance, point, press)) {
          this.strip?.tap(press.start);
        }
      },
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const button = topBarButtonForKey(event.repeat, event.key);
      if (button !== undefined) {
        this.press("key", button);
      }
    });
  }

  // The topmost overlay over the walk, the pause menu or the card, else the HUD itself.
  private overlayScene(): Scene {
    const key = [SCENE_KEYS.pause, SCENE_KEYS.card].find((overlay) => this.scene.isActive(overlay));
    return key === undefined ? this : this.scene.get(key);
  }

  private runScene(): RunScene {
    return this.scene.get(SCENE_KEYS.run) as RunScene;
  }

  private press(via: "key" | "tap", button: TopBarPress): void {
    const run = this.runScene();
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
    const { x, y } = buttonIcon(HOME_BUTTON, false);
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
    const { x, y } = buttonIcon(SOUND_BUTTON, false);
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
        color: PALETTE.white,
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
      quirk: this.add
        .image(at(DOGHOUSE.quirk).x, at(DOGHOUSE.quirk).y, "__DEFAULT")
        .setOrigin(0)
        .setVisible(false),
      statuses: DOGHOUSE.statuses.map((cell) =>
        this.add.image(at(cell).x, at(cell).y, "__DEFAULT").setOrigin(0).setVisible(false),
      ),
    };
  }

  override update(_time: number, delta: number): void {
    const run = this.runScene();
    const view = run.hudView();
    if (view === undefined) {
      return;
    }
    const pause = run.runPause();
    this.feedback?.update(view.run, pause);
    const items = stripItems(gameData, view.run);
    this.strip?.show(items);
    // A card or a menu dims the band, so the strip's bubble closes under it.
    if (walkCovered(pause)) {
      this.strip?.closeBubble();
    }
    this.stepHints(delta, walkCovered(pause), runHintTriggers(gameData, view.run, items.length));
    // A tall hint rises into the toast's rows and a card or a menu dims them, so a badge's
    // toast waits for both to close.
    const toastRoom = this.hints.shown === null && !walkCovered(pause);
    if (toastRoom && this.toastsWaiting.length > 0) {
      this.toasts?.show(this.toastsWaiting);
      this.toastsWaiting = [];
    }
    // The run state is immutable, so a changed pack or modifier list is a new array.
    const state: Record<string, unknown> = {
      affected: view.affected.join(),
      fill: Math.round(view.zoneFraction * PIP.width),
      modifiers: view.run.modifiers,
      money: this.shownMoney(view.run.money),
      muted: isMuted(this),
      pack: view.run.pack,
      pauseIcon: pauseButtonIcon(pause),
      route: view.run.route,
      statuses: statusesKey(view.statuses),
      treats: view.run.treats,
      zone: view.run.zoneIndex,
    };
    if (Object.keys(state).some((key) => state[key] !== this.drawn[key])) {
      if (state.muted !== this.drawn.muted) {
        this.showSoundIcon(isMuted(this));
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

  // The amount DOLLAR_GAP after the "$" ink, in the first of TEXT_FIT_STYLES that ends
  // WELL_INSET inside the money well, the bottom row of its capitals on the "$"'s.
  private showMoney(amount: string): void {
    const { dollar, money } = this;
    if (dollar === undefined || money === undefined || money.text === amount) {
      return;
    }
    setPixelText(money, amount);
    const well = TOP_BAR.money;
    const start = dollar.x + inkSpan(dollar).right + DOLLAR_GAP;
    const room = well.x + well.width - WELL_INSET - start;
    const style = fitPixelText(money, { room, styles: TEXT_FIT_STYLES }, start, MONEY_WELL.top);
    placePixelText(money, start - inkSpan(money).left, moneyTop(style.scale));
  }

  // The treat count centred across the treat well, under the treat icon.
  private showTreats(count: string): void {
    const { treats } = this;
    if (treats === undefined || treats.text === count) {
      return;
    }
    setPixelText(treats, count);
    const ink = inkSpan(treats);
    const centre = TOP_BAR.treats.x + TOP_BAR.treats.width / 2;
    placePixelText(treats, centre - (ink.left + ink.right) / 2, TREAT_WELL.countTop);
  }

  private redraw(view: RunHudView): void {
    const g = this.dynamic;
    if (g === undefined) {
      return;
    }
    const { run } = view;
    g.clear();
    this.showMoney(wholeDollars(this.shownMoney(run.money)).slice(1));
    this.showTreats(`${run.treats}/${read(gameData.tuning, "counts", "treatCarryMax")}`);
    const zone = currentZone(gameData, run);
    if (this.zoneLabel !== undefined) {
      setPixelText(this.zoneLabel, zone.name);
      const icon = zoneIconKey(zone);
      this.zoneIcon?.setTexture(this.textures.exists(icon) ? icon : "__DEFAULT");
      this.zoneIcon?.setVisible(this.textures.exists(icon));
      this.zoneIcon?.setX(ZONE_WELL.right - Math.ceil(this.zoneLabel.width) - 3);
    }
    const pips = zonePips(walkLength(gameData), run.route, run.zoneIndex, view.zoneFraction);
    pips.forEach((zonePip, i) => {
      const x = PIP.x + i * (PIP.width + PIP.gap);
      const pip = this.pips[i];
      const { tag, wellColor } = pipLook(gameData, zonePip);
      if (pip !== undefined && this.textures.exists(ZONE_PIPS_KEY)) {
        playTag(pip, ZONE_PIPS_KEY, tag);
      } else {
        fillRect(g, zonePip.state === "done" ? PALETTE.green : PALETTE.brown, { ...PIP, x });
      }
      // The current pip's well, inside its 1px rim, fills as the zone goes by.
      if (zonePip.state === "current" && wellColor !== null) {
        const width = Math.round(zonePip.fill * (PIP.width - 2));
        fillRect(g, colorFromHex(wellColor), {
          height: PIP.height - 2,
          width,
          x: x + 1,
          y: PIP.y + 1,
        });
      }
    });

    const { dogSlots } = LAYOUT;
    this.frames?.clear();
    const ownedSlots = profileSave(this).owned.dogSlots;
    dogSlots.forEach((rect, i) => {
      const slot = this.slots[i];
      if (slot !== undefined) {
        const packSlot = run.pack[i];
        const shown = slotShown(ownedSlots, i, packSlot !== undefined);
        this.drawSlot(g, rect, slot, run, shown === "hidden" ? null : packSlot);
        this.showStatuses(slot, packSlot, view.statuses);
        if (packSlot?.status === "walking" && view.affected.includes(packSlot.dog)) {
          this.drawAffectedFrame(rect);
        }
      }
    });
  }

  // The white frame round a doghouse whose dog the open card affects, over the house art: round
  // the file card, which leaves the slot's top 2 rows to the band.
  private drawAffectedFrame(rect: Rect): void {
    const g = this.frames;
    if (g === undefined) {
      return;
    }
    drawRing(g, PALETTE.white, { ...rect, height: rect.height - 2, y: rect.y + 2 }, 2);
  }

  // The house drawn while its art is missing: a roof band over a tan front, grey when fired.
  private drawHouse(g: GameObjects.Graphics, rect: Rect, fired: boolean): void {
    fillRect(g, PALETTE.plum, rect);
    const border = 1;
    const inner = insetRect(border, rect);
    fillRect(g, fired ? PALETTE.lightGrey : PALETTE.tan, inner);
    fillRect(g, fired ? PALETTE.grey : PALETTE.brown, {
      ...inner,
      height: DOGHOUSE.roof.height - border,
    });
  }

  // A dog's file card: the dog's and owner's faces in their photos, the hearts and their count
  // in the hearts box. A fired dog's card is the empty one. An owned slot with no dog
  // is a dashed "Empty" outline on the band, and a slot not bought (null) shows the band alone.
  private drawSlot(
    g: GameObjects.Graphics,
    rect: Rect,
    view: SlotView,
    run: RunState,
    slot: PackSlot | null | undefined,
  ): void {
    const parts = [view.house, view.dogFace, view.ownerFace, view.quirk, ...view.hearts];
    if (slot === undefined || slot === null) {
      parts.forEach((part) => part.setVisible(false));
      [view.name, view.count, view.ownerName].forEach((label) => setPixelText(label, ""));
      if (slot === null) {
        setPixelText(view.fired, "");
        return;
      }
      drawDashedRect(g, PALETTE.tan, rect);
      setPixelText(view.fired.setTint(PALETTE.cream), "Empty");
      return;
    }
    const dog = gameData.dogs[slot.dog];
    const fired = slot.status === "fired";
    const art = artFits(this, "ui-doghouse", DOGHOUSE.size);
    view.house.setVisible(art);
    if (art) {
      playTag(view.house, "ui-doghouse", doghouseTag(gameData, fired ? null : slot.dog));
    } else {
      this.drawHouse(g, rect, fired);
    }
    this.fitName(view.name, dog.name, DOGHOUSE.name, view.anchors.name);
    setPixelText(view.fired.setTint(PALETTE.white), fired ? "Fired" : "");
    if (fired) {
      [view.dogFace, view.ownerFace, view.quirk, ...view.hearts].forEach((part) =>
        part.setVisible(false),
      );
      setPixelText(view.count, "");
      setPixelText(view.ownerName, "");
      return;
    }
    const hearts = slot.hearts;
    const mood = faceMood(gameData, hearts);
    const ownerKey = ownerFaceKey(gameData, slot.dog);
    const dogKey = dogFaceKey(gameData, slot.dog);
    playTag(view.ownerFace.setTexture(ownerKey).setVisible(true), ownerKey, mood);
    // A nervous dog left alone by firings looks worried, where her face has it.
    const worried = isNervousAlone(gameData, run, slot.dog)
      ? firstTag(this, dogKey, ["worried"])
      : undefined;
    playTag(view.dogFace.setTexture(dogKey).setVisible(true), dogKey, worried ?? mood);
    this.fitName(view.ownerName, dog.owner.name, DOGHOUSE.ownerName, view.anchors.ownerName);
    const quirkKey = quirkIconKey(gameData, slot.dog);
    const quirkArt = this.textures.exists(quirkKey);
    view.quirk.setTexture(quirkArt ? quirkKey : "__DEFAULT").setVisible(quirkArt);

    const max = maxHearts(gameData.tuning, run.modifiers, dog);
    setPixelText(view.count, heartCount(hearts, max));
    const cells = doghouseHearts(hearts, max);
    const heartArt = this.textures.exists("ui-heart");
    view.hearts.forEach((sprite, i) => {
      const cell = cells[i];
      sprite.setVisible(heartArt && cell !== undefined);
      if (cell === undefined) {
        return;
      }
      if (heartArt) {
        playTag(sprite, "ui-heart", cell.full ? "full" : "empty");
      } else {
        drawHeart(g, rect.x + cell.x, rect.y + cell.y, cell.full ? PALETTE.darkRed : PALETTE.tan);
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

  // Each change shows in its lane and fades out: a money change in the bank lane (one at a
  // time); a heart change pops over its dog and flies into its doghouse (heartFeedback.ts), and
  // its label then fades in place on the doghouse's bottom band.
  private floatLabels(labels: ChangeLabel[]): void {
    const run = this.runScene();
    this.bankLabels.push(...labels.filter((label) => label.target.kind === "bank"));
    if (!this.bankShowing) {
      this.showNextBankLabel();
    }
    const pops = heartPops({ lanes: LANES.heartLabels, run }, labels, (slot) => {
      const view = this.slots[slot];
      return view === undefined ? undefined : { house: view.house, parts: slotParts(view) };
    });
    pops.forEach((pop) => this.hearts?.play(pop));
  }

  // The next money change in the bank lane, under the money well: it rises from the lane's
  // bottom to its top, or fades in place with reduced motion, then the next follows.
  private showNextBankLabel(): void {
    const label = this.bankLabels.shift();
    this.bankShowing = label !== undefined;
    if (label === undefined) {
      return;
    }
    const lane = LANES.bank;
    const y = lane.y + lane.height - LABEL.height;
    const rise = this.runScene().reducedMotion() ? 0 : y - lane.y;
    this.showLabel(label, { scale: 2, x: lane.x, y }, rise, lane.width, () =>
      this.showNextBankLabel(),
    );
  }

  // A heart change's label on its doghouse's bottom band, once its heart has landed.
  private showHeartLabel(label: ChangeLabel, lane: Rect): void {
    const at = { scale: 2, x: lane.x, y: lane.y + (lane.height - LABEL.height) / 2 };
    this.showLabel(label, at, 0, lane.width);
  }

  // A change on a cream chip, so gains in forest and losses in dark red read over anything. A
  // label too wide for room at 2x is set at 1x, on two lines if one is still too wide.
  private showLabel(
    label: ChangeLabel,
    at: { scale: number; x: number; y: number },
    rise: number,
    room: number,
    done: () => void = () => undefined,
  ): void {
    const text = addPixelText(this, at.x + 2, at.y + 4, label.text, {
      color: label.gain ? PALETTE.forest : PALETTE.darkRed,
      scale: at.scale,
    });
    if (text.width + 4 > room) {
      scalePixelText(text, 1, at.x + 2, at.y + 7);
    }
    if (text.width + 4 > room) {
      text.setMaxWidth(room - 4);
      placePixelText(text, at.x + 2, at.y + 3);
    }
    const chip = this.add.graphics();
    drawFramedRect(
      chip,
      { border: PALETTE.plum, fill: PALETTE.cream },
      { height: LABEL.height, width: Math.ceil(text.width) + 4, x: at.x, y: at.y },
    );
    text.setDepth(1);
    const parts = [chip, text];
    this.tweens.add({
      alpha: 0,
      duration: LABEL.ms,
      ease: "Sine.easeIn",
      onComplete: () => {
        parts.forEach((part) => part.destroy());
        done();
      },
      targets: parts,
      y: `-=${rise}`,
    });
  }

  // Steps the hint queue (see hintQueue.ts) a frame: hints RunScene raised and those the run's
  // state raises join it, a card or the pause menu holds it, and the strip's open bubble keeps
  // a new hint from starting, as a toast does. A hint is marked shown when it starts.
  private stepHints(delta: number, held: boolean, triggers: readonly HintTrigger[]): void {
    const shown = triggers.length === 0 ? [] : [...shownHints(this)];
    for (const trigger of triggers) {
      const hint = hintFor(gameData, shown, trigger);
      if (hint !== null) {
        this.hintRaised.push(hint);
      }
    }
    const before = this.hints.shown;
    const timing = {
      fadeMs: HINT.fadeMs,
      holdMs: HINT.holdMs,
      staleMs: read(gameData.tuning, "seconds", "hintStaleSeconds") * 1000,
    };
    const tick = {
      blocked: (this.strip?.isOpen() ?? false) || (this.toasts?.isShowing() ?? false),
      dtMs: delta,
      held,
      raised: this.hintRaised,
    };
    this.hints = stepHintQueue(timing, tick, this.hints);
    this.hintRaised = [];
    const now = this.hints.shown;
    if (now?.id !== before?.id || (now !== null && this.hintParts.length === 0)) {
      this.hintParts.forEach((part) => part.destroy());
      this.hintParts = [];
      if (now !== null) {
        markHintShown(this, now.id);
        this.strip?.closeBubble();
        this.hintParts = this.drawHint(held ? this.overlayScene() : this, now);
      }
    }
    if (now === null && this.hintParts.length > 0) {
      this.hintParts.forEach((part) => part.destroy());
      this.hintParts = [];
    }
    if (now !== null) {
      const alpha = hintAlpha(timing, now);
      for (const part of this.hintParts) {
        (part as GameObjects.GameObject & { alpha: number }).alpha = alpha;
      }
    }
  }

  // A hint's bubble, centred in the hint lane with its bottom on the lane's, its tail pointing
  // at the road; the strip's hint hangs under the strip, its tail pointing up at the icons.
  // A hint raised under a card or a menu draws in that overlay, over its dim.
  private drawHint(scene: Scene, hint: RaisedHint): GameObjects.GameObject[] {
    const { road } = LAYOUT;
    const lane = LANES.hint;
    const style = { color: PALETTE.plum, scale: 2 };
    const lines = wrapPixelText(scene, style, lane.width - 2 * HINT.padding, hint.text);
    const text = addPixelText(scene, 0, 0, lines.join("\n"), style);
    const width = Math.ceil(text.width) + 2 * HINT.padding;
    const height = Math.ceil(text.height) + 2 * HINT.padding;
    const run = this.runScene().hudView()?.run;
    const strip =
      hint.id === "strip" && run !== undefined
        ? stripLayout(SCREEN_CONFIG.width, stripItems(gameData, run).length)
        : undefined;
    const under = strip === undefined ? undefined : stripHintPlace(lane, strip, { height, width });
    const x = under?.bubble.x ?? centredInLane(lane, lane.x + lane.width / 2, width);
    const y = under?.bubble.y ?? lane.y + lane.height - height;
    placePixelText(text, x + HINT.padding, y + HINT.padding);
    const parts: GameObjects.GameObject[] = [addPanel(scene, { height, width, x, y }, "ui-hint")];
    if (under !== undefined) {
      if (scene.textures.exists(UP_TAIL.key)) {
        parts.push(scene.add.image(under.tail.x, under.tail.y, UP_TAIL.key).setOrigin(0));
      }
    } else if (scene.textures.exists("ui-hint-tail")) {
      parts.push(
        scene.add.image(road.x + road.width / 2, y + height - 1, "ui-hint-tail").setOrigin(0.5, 0),
      );
    }
    text.setDepth(1);
    parts.push(text);
    return parts;
  }

  // Owners' lines share the quip lane, so they take turns; one that has waited a whole quip's
  // time is dropped.
  private queueQuips(quips: readonly QuipBubble[]): void {
    const now = this.time.now;
    this.quips.push(...quips.map((quip) => ({ quip, raisedMs: now })));
    if (!this.quipShowing) {
      this.sayNextQuip();
    }
  }

  private sayNextQuip(): void {
    const now = this.time.now;
    this.quips = this.quips.filter(({ raisedMs }) => now - raisedMs <= QUIP.holdMs);
    const next = this.quips.shift();
    this.quipShowing = next !== undefined && this.sayQuip(next.quip);
    if (next !== undefined && !this.quipShowing) {
      this.sayNextQuip();
    }
  }

  // An owner's line in a bubble over the doghouses' roofs, centred over the owner's face and
  // leaving every face uncovered: at 2x on one line, else at 1x. False when the dog has no slot.
  private sayQuip(quip: QuipBubble): boolean {
    const run = this.runScene();
    const index = run.hudView()?.run.pack.findIndex((slot) => slot.dog === quip.dog) ?? -1;
    const rect = LAYOUT.dogSlots[index];
    if (rect === undefined) {
      return false;
    }
    const lane = LANES.quip;
    const room = lane.width - 2 * QUIP.padding;
    const text = addPixelText(this, 0, 0, quip.text, { color: PALETTE.plum, scale: 2 });
    if (text.width > room) {
      text.destroy();
      const small = { color: PALETTE.plum };
      const lines = wrapPixelText(this, small, room, quip.text);
      return this.placeQuip(addPixelText(this, 0, 0, lines.join("\n"), small), rect);
    }
    return this.placeQuip(text, rect);
  }

  private placeQuip(text: GameObjects.BitmapText, rect: Rect): true {
    const lane = LANES.quip;
    const width = Math.ceil(text.width) + 2 * QUIP.padding;
    const height = lane.height;
    const faceX = rect.x + DOGHOUSE.ownerFace.x + 16;
    const x = centredInLane(lane, faceX, width);
    const y = lane.y;
    placePixelText(text, x + QUIP.padding, y + Math.round((height - text.height) / 2));
    const parts: GameObjects.GameObject[] = [
      addPanel(this, { height, width, x, y }, "ui-quip").setDepth(QUIP.depth),
    ];
    text.setDepth(QUIP.depth + 1);
    parts.push(text);
    this.tweens.add({
      alpha: 0,
      delay: QUIP.holdMs,
      duration: 400,
      onComplete: () => {
        parts.forEach((part) => part.destroy());
        this.sayNextQuip();
      },
      targets: parts,
    });
    return true;
  }
}
