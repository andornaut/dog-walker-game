import { type GameObjects, type Input, Scene } from "phaser";

import { dogFaceKey, dogPortraitKey, gearIconKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { type DetailPicture, dogDetail, gearDetail } from "../home/detail";
import { FEEDBACK, shakeOffset } from "../home/feedback";
import { focusDirectionForKey } from "../home/focus";
import { dollarText, type Purchase } from "../home/home";
import { cardBand } from "../home/homeLayout";
import { type HomeAction, messageLine } from "../home/homeLines";
import {
  answerPurchase,
  type ConfirmChoice,
  confirmLines,
  keyAnswer,
  type PendingPurchase,
  requestPurchase,
} from "../home/purchaseConfirm";
import {
  dogRows,
  gearRows,
  ownedCountNote,
  SHOP_ROW_VIEWS,
  SHOP_TABS,
  shopOpenTab,
  type ShopRow,
  shopRowId,
  shopRowLook,
  type ShopTab,
  slotRows,
} from "../home/shop";
import {
  rowRects,
  SHOP_LAYOUT,
  SHOP_MESSAGE_FIT,
  shopListBottom,
  shopListFrame,
  shopMessageCapTop,
  shopRowTextRoom,
  shopScrollbar,
  shopTabFace,
  shopTabRects,
} from "../home/shopLayout";
import { HOLD, type HoldPress, moveHold, startHold, tickHold } from "../input/hold";
import { isConfirmKey, isPauseKey, menuKeyActs } from "../input/keyBindings";
import {
  LIST_FLING,
  type ListScroll,
  listScroll,
  pageKeyScroll,
  resizeScroll,
  scrollMax,
  type ScrollRule,
  scrollToShow,
  stepScroll,
} from "../input/listScroll";
import { clampIndex } from "../lib/arrays";
import { containsPoint, type Rect } from "../lib/rect";
import { cents, read } from "../rules/units";
import type { SaveDocument } from "../save/schema";
import type { TileState } from "../ui/interaction";
import { fillRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import {
  addPixelText,
  fitPixelText,
  type FontRole,
  pixelFontMetrics,
  placePixelText,
} from "../ui/phaser/pixelText";
import { GREYED, type PlateKind } from "../ui/selection";
import { TEXT_FIT_STYLES, type TextFitStyle } from "../ui/textFit";
import type { CelebrationSceneData } from "./CelebrationScene";
import { addDetailCard, drawDetailCard } from "./homePanels";
import { addLock, addPlate, drawDogSlotFallback, plateColors, SHOP_ART } from "./itemArt";
import { closeOverlay, listenDismiss, openOverlay, type OverlayData } from "./overlay";
import { currentSettings, profileSave, purchaseInProfile, takeCelebrations } from "./profileStore";
import { drawPurchaseConfirm, type PurchaseConfirmHits } from "./purchaseConfirmView";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import {
  addScrollbar,
  listenListScroll,
  maskToRect,
  placeScrollbar,
  type ScrollbarView,
} from "./scrollView";
import { listenTargetPress, type TargetPressListener } from "./targetPress";
import {
  addCloseButton,
  addPanel,
  addSelectFrame,
  addSelectTile,
  addTab,
  addTagImage,
  addTapBurst,
  clearScene,
  selectOuter,
  tagFrame,
  TEXT_SCALE,
  tileTextureKey,
} from "./uiKit";

// The caller pauses itself and launches the shop, on the tab of focus and framing its row
// when given, else on the Dogs tab; the shop resumes it on close.
export interface ShopSceneData extends OverlayData {
  focus?: Purchase;
}

// Emitted on game.events after each purchase, so the screen under the shop redraws its bank.
export const SHOP_CHANGED_EVENT = "shop-changed";
// Emitted on game.events when the shop closes, with the last purchase or refusal, so the
// home screen's walker can say it.
export const SHOP_CLOSED_EVENT = "shop-closed";

export interface ShopClosed {
  readonly action: HomeAction;
}

// While a detail card is open, a press anywhere on the shop's panel is dismiss: its tap closes
// the card. While the purchase confirm is open, so is a press on the panel off the confirm's
// card: its tap cancels.
type Target =
  | { choice: ConfirmChoice; kind: "confirm" }
  | { kind: "close" }
  | { kind: "dismiss" }
  | { id: string; kind: "row" }
  | { kind: "tab"; tab: ShopTab };

const LAYOUT = SHOP_LAYOUT;
const PANEL: Rect = LAYOUT.panel;
const TAB_RECTS: readonly Rect[] = shopTabRects();
const ROW = LAYOUT.row;
const OWNED_DX = ROW.ownedDx;
const LIST: Rect = LAYOUT.list.rect;
const PLATE: Rect = LAYOUT.message.plate;
// A press that travels past the tap distance drags the list.
const SCROLL_RULE: ScrollRule = {
  ...LIST_FLING,
  dragSlopPx: read(gameData.tuning, "pixels", "tapMaxDistance"),
};
// A screen-sized texture, white over the list area: the mask that clips the list to it.
const LIST_MASK_KEY = "shop-list-mask";

function sameTarget(a: Target, b: Target | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// A purchase's art on its row: a dog's face, a gear item's icon, the slot's art.
function purchaseArt(purchase: Purchase): string {
  switch (purchase.kind) {
    case "dog":
      return dogFaceKey(gameData, purchase.dog);
    case "dogSlot":
      return SHOP_ART.dogSlot;
    case "gear":
      return gearIconKey(purchase.gear);
    default:
      return purchase satisfies never;
  }
}

// A purchase's picture on its detail card and its confirm: a dog's portrait, a gear item's
// icon or the slot's art at 2x.
export function purchasePicture(purchase: Purchase): DetailPicture {
  switch (purchase.kind) {
    case "dog":
      return { key: dogPortraitKey(gameData, purchase.dog), scale: 1 };
    case "dogSlot":
      return { key: SHOP_ART.dogSlot, scale: 2 };
    case "gear":
      return { key: gearIconKey(purchase.gear), scale: 2 };
    default:
      return purchase satisfies never;
  }
}

// A row as laid out on the open tab.
interface PlacedRow {
  readonly rect: Rect;
  readonly row: ShopRow;
}

// The Pet shop under the home screen's top bar: a Dogs tab of dog slots and dogs, and a Gear
// tab of gear for sale. Tapping a row the bank covers asks to confirm the purchase, and only
// the confirm's Buy buys it; a row it cannot pays a shake and says why. The row the shop
// opened on, or the last one tapped, is framed.
// Holding a dog or gear row opens its detail card. A tab's headings and rows scroll in the list
// area under the tabs, by a drag, the wheel or the page keys, with a scrollbar beside a list
// longer than the view; a drag taps nothing. Left and right switch tabs, up and down move the
// frame and bring its row into view, Enter or Space taps the framed row, and Escape cancels the
// confirm, or closes the card or the shop. On the confirm, Enter or Space buys, and a tap on
// the dim around its card cancels.
export class ShopScene extends Scene {
  private action: HomeAction = { kind: "none" };
  // The purchase asked for and not yet answered, and where its answers were drawn.
  private confirm: PendingPurchase | undefined;
  private confirmHits: PurchaseConfirmHits | undefined;
  private containers = new Map<string, GameObjects.Container>();
  private detail: Purchase | undefined;
  private focusId: string | null = null;
  // The open list's area, rows' width and heading note's right edge, by whether it scrolls.
  private frame = shopListFrame(false);
  private hold: HoldPress | undefined;
  // The scrolled headings and rows, and the scrollbar beside them.
  private list: GameObjects.Container | undefined;
  // The last tap's message, on its plate over the list's top: a purchase in green, a refusal
  // in dark red.
  private message: { readonly refused: boolean; readonly text: string } | null = null;
  private placed: PlacedRow[] = [];
  private pressed: Target | undefined;
  private presses: TargetPressListener | undefined;
  private resumeKey: SceneKey | undefined;
  private scroll: ListScroll = listScroll(0);
  private scrollbar: ScrollbarView | undefined;
  private shakes = new Map<string, number>();
  private tab: ShopTab = shopOpenTab(undefined);

  constructor() {
    super(SCENE_KEYS.shop);
  }

  create(data: ShopSceneData): void {
    this.resumeKey = data.resume;
    this.action = { kind: "none" };
    this.confirm = undefined;
    this.confirmHits = undefined;
    this.detail = undefined;
    this.hold = undefined;
    this.message = null;
    this.pressed = undefined;
    this.scroll = listScroll(0);
    this.shakes = new Map();
    this.tab = shopOpenTab(data.focus);
    this.focusId = data.focus === undefined ? null : shopRowId(this.save().owned, data.focus);
    this.render();
    this.showFocus();

    // A tap acts once its dip ends; holding a dog or gear row opens its detail card, and the
    // hold takes the press. With a card open, a tap anywhere closes it, as on Stats.
    this.presses = listenTargetPress<Target>(this, {
      dipMs: (target) => (target.kind === "dismiss" ? 0 : FEEDBACK.pressDipMs),
      onDown: (pointer, target) => {
        addTapBurst(this, pointer.x, pointer.y);
        if (this.detail !== undefined || this.confirm !== undefined) {
          return;
        }
        const purchase = target?.kind === "row" ? this.rowById(target.id)?.purchase : undefined;
        this.hold =
          purchase !== undefined && purchase.kind !== "dogSlot"
            ? startHold(HOLD, { x: pointer.x, y: pointer.y }, this.time.now)
            : undefined;
      },
      onPressed: (target) => {
        this.pressed = target?.kind === "dismiss" ? undefined : target;
        if (target === undefined) {
          this.hold = undefined;
        }
        this.render();
      },
      onTap: (target) => this.act(target),
      same: sameTarget,
      targetAt: (x, y) => {
        const choice = this.confirmChoiceAt(x, y);
        if (choice !== undefined) {
          return { choice, kind: "confirm" };
        }
        if (this.detail === undefined && this.confirm === undefined) {
          return this.targetAt(x, y);
        }
        const card = this.confirm === undefined ? undefined : this.confirmHits?.card;
        if (card !== undefined && containsPoint(card, x, y)) {
          return undefined;
        }
        return containsPoint(PANEL, x, y) ? { kind: "dismiss" } : undefined;
      },
    });
    this.input.on("pointermove", (pointer: Input.Pointer) => {
      if (this.hold !== undefined && pointer.isDown) {
        this.hold = moveHold(this.hold, { x: pointer.x, y: pointer.y });
      }
    });
    this.listenScroll();
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (menuKeyActs(event.repeat, event.key)) {
        this.onKey(event.key);
      }
    });
    // The top bar and the margins around the card close the shop, card and all, or cancel an
    // open confirm; back cancels the confirm or closes an open card first, as Escape does.
    listenDismiss(
      this,
      [PANEL],
      () => (this.confirm === undefined ? this.close() : this.back()),
      () => this.back(),
    );
  }

  // The confirm's answer at a point, or undefined off its answers or with no confirm open.
  private confirmChoiceAt(x: number, y: number): ConfirmChoice | undefined {
    const hits = this.confirm === undefined ? undefined : this.confirmHits;
    if (hits === undefined) {
      return undefined;
    }
    return (["buy", "cancel"] as const).find((choice) => containsPoint(hits.buttons[choice], x, y));
  }

  private save(): SaveDocument {
    return profileSave(this);
  }

  // A finger or mouse that lands on the list drags it once it passes the tap distance: the
  // press under way taps nothing and holds nothing. The wheel moves the list too.
  private listenScroll(): void {
    listenListScroll(this, {
      active: () => this.isListOpen(),
      onDragStart: () => {
        this.presses?.cancel();
        this.hold = undefined;
        this.pressed = undefined;
        this.render();
      },
      place: () => this.placeList(),
      rule: SCROLL_RULE,
      scroll: () => this.scroll,
      setScroll: (scroll) => {
        this.scroll = scroll;
      },
      view: LIST,
    });
  }

  // Nothing covers the list: no detail card or confirm is open.
  private isListOpen(): boolean {
    return this.detail === undefined && this.confirm === undefined;
  }

  private moveList(scroll: ListScroll): void {
    this.scroll = scroll;
    this.placeList();
  }

  // The list at its scroll, and the scrollbar's thumb beside it.
  private placeList(): void {
    this.list?.setY(-this.scroll.y);
    placeScrollbar(shopScrollbar(this.scroll.max, this.scroll.y), this.scrollbar);
  }

  // The framed row, with its frame, brought into view.
  private showFocus(): void {
    const focused = this.placed.find(({ row }) => row.id === this.focusId);
    if (focused !== undefined) {
      this.moveList(scrollToShow(LIST, selectOuter(focused.rect), this.scroll));
    }
  }

  // The bottom of the open tab's list as laid out.
  private listBottom(save: SaveDocument): number {
    if (this.tab === "gear") {
      return shopListBottom(LAYOUT.gear.rows, gearRows(gameData, save.owned).length);
    }
    return shopListBottom(LAYOUT.dogs.dogRows, dogRows(gameData, save.owned).length);
  }

  // An open confirm cancels, else an open card closes, else the shop.
  private back(): void {
    if (this.confirm !== undefined) {
      this.answer("cancel");
      return;
    }
    if (this.detail === undefined) {
      this.close();
      return;
    }
    this.detail = undefined;
    this.render();
  }

  private onKey(key: string): void {
    if (this.confirm !== undefined) {
      this.onKeyAnswer(key);
      return;
    }
    if (isPauseKey(key) || (this.detail !== undefined && isConfirmKey(key))) {
      this.back();
      return;
    }
    if (this.detail !== undefined) {
      return;
    }
    const direction = focusDirectionForKey(key);
    if (direction === "left" || direction === "right") {
      const index = SHOP_TABS.indexOf(this.tab) + (direction === "left" ? -1 : 1);
      const tab = SHOP_TABS[clampIndex(SHOP_TABS.length, index)];
      if (tab !== undefined && tab !== this.tab) {
        this.actAfterDip({ kind: "tab", tab });
      }
      return;
    }
    if (direction === "up" || direction === "down") {
      const ids = this.rows().map(({ id }) => id);
      const at = this.focusId === null ? -1 : ids.indexOf(this.focusId);
      const next = clampIndex(ids.length, at + (direction === "up" ? -1 : 1));
      this.focusId = ids[next] ?? this.focusId;
      this.message = null;
      this.render();
      this.showFocus();
      return;
    }
    const paged = pageKeyScroll(LIST.height - LAYOUT.list.pageOverlap, key, this.scroll);
    if (paged !== undefined) {
      this.moveList(paged);
      return;
    }
    if (isConfirmKey(key) && this.focusId !== null) {
      this.actAfterDip({ id: this.focusId, kind: "row" });
    }
  }

  // Escape or P cancels at once; Enter or Space presses Buy, which dips, then buys.
  private onKeyAnswer(key: string): void {
    const choice = keyAnswer(key);
    if (choice === "cancel") {
      this.answer(choice);
    } else if (choice === "buy") {
      this.actAfterDip({ choice, kind: "confirm" });
    }
  }

  // A key presses the tab or row: it dips, then acts, as a tap does.
  private actAfterDip(target: Target): void {
    this.pressed = target;
    this.render();
    this.time.delayedCall(FEEDBACK.pressDipMs, () => {
      this.pressed = undefined;
      this.render();
      this.act(target);
    });
  }

  private close(): void {
    const closed: ShopClosed = { action: this.action };
    this.game.events.emit(SHOP_CLOSED_EVENT, closed);
    closeOverlay(this.resumeKey, this);
  }

  // The rows of the open tab, top to bottom.
  private rows(): ShopRow[] {
    const { owned } = this.save();
    return this.tab === "gear"
      ? gearRows(gameData, owned)
      : [...slotRows(gameData, owned), ...dogRows(gameData, owned)];
  }

  private targetAt(x: number, y: number): Target | undefined {
    const close = LAYOUT.close.hit;
    if (containsPoint(close, x, y)) {
      return { kind: "close" };
    }
    const tab = TAB_RECTS.findIndex((rect) => containsPoint(rect, x, y));
    const tabId = SHOP_TABS[tab];
    if (tabId !== undefined) {
      return { kind: "tab", tab: tabId };
    }
    // The message's plate lies over the rows; only the list area's part of a row is pressed.
    if (this.message !== null && containsPoint(PLATE, x, y)) {
      return undefined;
    }
    if (!containsPoint(this.frame.rect, x, y)) {
      return undefined;
    }
    const listY = y + this.scroll.y;
    const hit = this.placed.find(({ rect }) => containsPoint(rect, x, listY));
    return hit === undefined ? undefined : { id: hit.row.id, kind: "row" };
  }

  private rowById(id: string): ShopRow | undefined {
    return this.rows().find((row) => row.id === id);
  }

  private pressedPurchase(): Purchase | undefined {
    const pressed = this.pressed;
    return pressed?.kind === "row" ? this.rowById(pressed.id)?.purchase : undefined;
  }

  private openDetail(): void {
    const purchase = this.pressedPurchase();
    this.pressed = undefined;
    if (purchase !== undefined && purchase.kind !== "dogSlot") {
      this.detail = purchase;
    }
    this.render();
  }

  override update(_time: number, deltaMs: number): void {
    const flung = stepScroll(SCROLL_RULE, deltaMs, this.scroll);
    if (flung !== this.scroll) {
      this.moveList(flung);
    }
    if (this.hold !== undefined) {
      const { fire, press } = tickHold(this.hold, this.time.now);
      this.hold = press;
      if (fire) {
        this.presses?.cancel();
        this.openDetail();
      }
    }
    const reduced = currentSettings(this).reducedMotion;
    for (const [id, container] of this.containers) {
      container.setX(shakeOffset(reduced, this.time.now, this.shakes.get(id)));
    }
  }

  private act(target: Target): void {
    switch (target.kind) {
      case "close":
        this.close();
        return;
      case "confirm":
        this.answer(target.choice);
        return;
      case "dismiss":
        this.back();
        return;
      case "tab":
        if (target.tab !== this.tab) {
          this.scroll = listScroll(0);
        }
        this.tab = target.tab;
        this.message = null;
        this.render();
        return;
      case "row":
        this.tapRow(target.id);
        return;
      default:
        target satisfies never;
    }
  }

  // An owned row is only framed. One that needs another first, or costs more than the bank,
  // shakes and says why; one the bank covers asks to confirm its purchase.
  private tapRow(id: string): void {
    const row = this.rowById(id);
    if (row === undefined) {
      return;
    }
    this.focusId = id;
    const save = this.save();
    const look = shopRowLook(save.bankCents, row);
    const text = gameData.homeText;
    if (look === "owned") {
      this.message = null;
    } else if (look === "blocked") {
      this.shakes.set(id, this.time.now);
      this.message = row.blocked === null ? null : { refused: true, text: row.blocked };
    } else {
      const request = requestPurchase(gameData, save, row.name, row.purchase);
      if (request.kind === "confirm") {
        this.confirm = request.pending;
        this.message = null;
      } else if (request.reason === "cantAfford" && row.price !== null) {
        this.shakes.set(id, this.time.now);
        this.action = {
          amount: cents(row.price - save.bankCents),
          kind: "cantAfford",
          name: row.name,
        };
        this.message = { refused: true, text: messageLine(text, this.action) ?? "" };
      }
    }
    this.render();
  }

  // The confirm closes; its Buy buys the pending purchase, if the bank still covers it.
  private answer(choice: ConfirmChoice): void {
    const confirm = this.confirm;
    if (confirm === undefined) {
      return;
    }
    this.confirm = undefined;
    this.confirmHits = undefined;
    const result = answerPurchase(gameData, this.save(), confirm, choice);
    if (result.kind === "bought") {
      this.bought(confirm, result.save);
      return;
    }
    this.render();
  }

  private bought(pending: PendingPurchase, save: SaveDocument): void {
    void purchaseInProfile(this, () => save);
    this.action = { kind: "bought", name: pending.name, purchase: pending.purchase };
    this.message = { refused: false, text: messageLine(gameData.homeText, this.action) ?? "" };
    this.game.events.emit(SHOP_CHANGED_EVENT);
    this.render();
    this.celebrate(pending.purchase);
  }

  // Badges a purchase earned burst in over the shop, the bought dog's owner cheering.
  private celebrate(purchase: Purchase): void {
    const achievements = takeCelebrations(this);
    if (achievements.length === 0) {
      return;
    }
    const data: CelebrationSceneData = {
      achievements,
      owners: purchase.kind === "dog" ? [purchase.dog] : [],
      resume: SCENE_KEYS.shop,
    };
    openOverlay(this, SCENE_KEYS.celebration, data);
  }

  private text(
    parent: GameObjects.Container,
    at: { x: number; y: number },
    value: string,
    style: { color?: number; font?: FontRole; originX?: number } = {},
  ): GameObjects.BitmapText {
    const label = addPixelText(this, at.x, at.y, value, {
      color: PALETTE.plum,
      scale: TEXT_SCALE,
      ...style,
    });
    parent.add(label);
    return label;
  }

  private render(): void {
    clearScene(this);
    this.containers = new Map();
    this.placed = [];
    const save = this.save();
    const root = this.add.container(0, 0);
    // The wood under the card, from the top bar down; the home screen's bar shows above it.
    fillRect(this.graphics(root), PALETTE.darkBrown, {
      height: SCREEN_CONFIG.height - PANEL.y + 4,
      width: SCREEN_CONFIG.width,
      x: 0,
      y: PANEL.y - 4,
    });
    this.drawCard(root);
    this.drawTabs(root);
    // A bought dog leaves its list, so the list may now be shorter.
    this.scroll = resizeScroll(scrollMax(LIST, this.listBottom(save)), this.scroll);
    this.frame = shopListFrame(this.scroll.max > 0);
    // The headings and rows, clipped to the list area and moved up by the scroll.
    const list = this.add.container(0, 0);
    root.add(list);
    this.list = list;
    maskToRect(this, LIST_MASK_KEY, this.frame.rect, list);
    if (this.tab === "gear") {
      this.drawGear(list, save);
    } else {
      this.drawDogs(list, save);
    }
    this.scrollbar = addScrollbar(this, root, shopScrollbar(this.scroll.max, this.scroll.y));
    this.placeList();
    if (this.message !== null) {
      this.drawMessage(root, this.message);
    }
    if (this.detail !== undefined) {
      this.drawDetail(save, this.detail);
    }
    if (this.confirm !== undefined) {
      this.drawConfirm(this.confirm);
    }
  }

  // The purchase confirm over the shop: its card, and the dim around it that cancels.
  private drawConfirm(pending: PendingPurchase): void {
    const pressed = this.pressed?.kind === "confirm" ? this.pressed.choice : undefined;
    this.confirmHits = drawPurchaseConfirm(this, this.add.container(0, 0), {
      lines: confirmLines(gameData, pending),
      picture: purchasePicture(pending.purchase),
      pressed,
    });
  }

  private graphics(parent: GameObjects.Container): GameObjects.Graphics {
    const g = this.add.graphics();
    parent.add(g);
    return g;
  }

  // The message on the ui-hint plate across the list's top, in one line fitted to the plate.
  private drawMessage(
    root: GameObjects.Container,
    message: { readonly refused: boolean; readonly text: string },
  ): void {
    root.add(addPanel(this, PLATE, "ui-hint"));
    const x = PLATE.x + LAYOUT.message.textDx;
    const label = this.text(root, { x, y: PLATE.y }, message.text, {
      color: message.refused ? PALETTE.darkRed : PALETTE.forest,
    });
    const { style } = fitPixelText(label, SHOP_MESSAGE_FIT, x, PLATE.y);
    placePixelText(label, x, shopMessageCapTop(pixelFontMetrics(this, "body"), style.scale));
  }

  // The card, its title band and its close control.
  private drawCard(root: GameObjects.Container): void {
    const { titleX, titleY } = LAYOUT.band;
    const band = cardBand(PANEL);
    addDetailCard(this, root, PANEL, band);
    this.text(root, { x: PANEL.x + titleX, y: band.y + titleY }, gameData.homeText.shop.title, {
      color: PALETTE.white,
      font: "title",
    });
    addCloseButton(this, root, LAYOUT.close, this.pressed?.kind === "close");
  }

  // The open tab is selected and the other normal.
  private drawTabs(root: GameObjects.Container): void {
    const { reducedMotion } = currentSettings(this);
    SHOP_TABS.forEach((tab, i) => {
      const hit = TAB_RECTS[i];
      if (hit === undefined) {
        return;
      }
      addTab(this, root, shopTabFace(hit), gameData.homeText.shop.tabs[tab], {
        open: tab === this.tab,
        pressed: sameTarget({ kind: "tab", tab }, this.pressed),
        reducedMotion,
      });
    });
  }

  private heading(root: GameObjects.Container, y: number, title: string, note?: string): void {
    this.text(root, { x: LAYOUT.headingX, y }, title, { font: "title" });
    if (note !== undefined) {
      this.text(root, { x: this.frame.headingRight, y }, note, {
        color: PALETTE.darkBrown,
        originX: 1,
      });
    }
  }

  // How many gear items are owned, then every gear item with its effect in a few words and its
  // price or Owned.
  private drawGear(root: GameObjects.Container, save: SaveDocument): void {
    const text = gameData.homeText;
    const { headingY, rows: spec } = LAYOUT.gear;
    const note = ownedCountNote(gameData, save.owned, "gear");
    this.heading(root, headingY, text.shop.tabs.gear, note);
    this.drawRows(root, save, spec, gearRows(gameData, save.owned));
  }

  // The dog slots past the first with how many are owned, then how many dogs are owned and the
  // dogs still for sale, or a line saying every dog is owned.
  private drawDogs(root: GameObjects.Container, save: SaveDocument): void {
    const text = gameData.homeText;
    const { dogHeadingY, dogRows: dogSpec, slotHeadingY, slotRows: slotSpec } = LAYOUT.dogs;
    this.heading(
      root,
      slotHeadingY,
      text.shop.slots,
      ownedCountNote(gameData, save.owned, "slots"),
    );
    this.drawRows(root, save, slotSpec, slotRows(gameData, save.owned));
    this.heading(root, dogHeadingY, text.shop.dogs, ownedCountNote(gameData, save.owned, "dogs"));
    const dogs = dogRows(gameData, save.owned);
    if (dogs.length === 0) {
      this.text(root, { x: LAYOUT.headingX, y: dogSpec.y + 4 }, text.shop.dogsAllOwned, {
        color: PALETTE.darkBrown,
      });
    }
    this.drawRows(root, save, dogSpec, dogs);
  }

  // The rows laid out from spec across the list's width.
  private drawRows(
    root: GameObjects.Container,
    save: SaveDocument,
    spec: Parameters<typeof rowRects>[1],
    rows: readonly ShopRow[],
  ): void {
    rowRects(this.frame.rowWidth, spec, rows.length).forEach((rect, i) => {
      const row = rows[i];
      if (row !== undefined) {
        this.drawRow(root, save, { rect, row });
      }
    });
  }

  // A row: its art in a box, its name and line, and its price plate or Owned at the right,
  // each as SHOP_ROW_VIEWS sets for its look. The framed one wears ui-select.
  private drawRow(root: GameObjects.Container, save: SaveDocument, placed: PlacedRow): void {
    const { rect, row } = placed;
    this.placed.push(placed);
    const look = shopRowLook(save.bankCents, row);
    const view = SHOP_ROW_VIEWS[look];
    const { reducedMotion } = currentSettings(this);
    const holder = this.add.container(0, 0);
    root.add(holder);
    this.containers.set(row.id, holder);
    const tile = addSelectTile(this, holder, rect, {
      edge: true,
      reducedMotion,
      state: view.state,
      tile: true,
    });
    if (sameTarget({ id: row.id, kind: "row" }, this.pressed)) {
      tile.container.y += FEEDBACK.pressDipPx;
    }
    const content = tile.content;
    const { box, lock } = ROW;
    const boxRect = {
      height: box.size,
      width: box.size,
      x: rect.x + box.dx,
      y: rect.y + Math.floor((rect.height - box.size) / 2),
    };
    fillRect(this.graphics(content), PALETTE[tile.look.box], boxRect);
    this.addArt(content, purchaseArt(row.purchase), view.state, {
      x: boxRect.x + ROW.art,
      y: boxRect.y + ROW.art,
    });
    if (view.padlock !== null) {
      addLock(this, content, view.padlock, { x: rect.x + lock.dx, y: rect.y + lock.dy });
    }
    const ink = PALETTE[tile.look.text];
    const mid = rect.y + Math.floor(rect.height / 2);
    const textX = rect.x + ROW.textDx;
    const right = rect.x + rect.width - ROW.plateInset;
    const rightLeft = this.drawRowRight(content, view.plate, row, { mid, right });
    // The name and line fit the room the price plate or Owned leaves them.
    const fit = {
      room: shopRowTextRoom(rect.width, right - rightLeft),
      styles: TEXT_FIT_STYLES,
    };
    // A row with no second line centres its name.
    const nameY = row.line === "" ? mid - 5 : mid - 15;
    const name = this.text(content, { x: textX, y: nameY }, row.name, { color: ink });
    fitPixelText(name, fit, textX, nameY);
    this.drawRowLine(content, row, { fit, greyed: view.state === "disabled", mid, x: textX });
    if (this.focusId === row.id) {
      addSelectFrame(this, holder, rect, reducedMotion);
    }
  }

  private addArt(
    parent: GameObjects.Container,
    key: string,
    state: TileState,
    at: { x: number; y: number },
  ): void {
    if (!this.textures.exists(key)) {
      if (key === SHOP_ART.dogSlot) {
        drawDogSlotFallback(this, parent, at);
      }
      return;
    }
    // A dog's face shows its happy frame; an icon has one frame.
    const shown = tileTextureKey(this, state, key);
    parent.add(this.add.image(at.x, at.y, shown, tagFrame(this, key, "happy")).setOrigin(0));
  }

  // A row's line in words under its name: a dog's fee, a gear item's effect, a slot's note.
  private drawRowLine(
    parent: GameObjects.Container,
    row: ShopRow,
    at: {
      fit: { room: number; styles: readonly TextFitStyle[] };
      greyed: boolean;
      mid: number;
      x: number;
    },
  ): void {
    const color = at.greyed ? PALETTE[GREYED.text] : PALETTE.darkBrown;
    if (row.line !== "") {
      const line = this.text(parent, { x: at.x, y: at.mid + 3 }, row.line, { color });
      fitPixelText(line, at.fit, at.x, at.mid + 3);
    }
  }

  // Owned with a tick, or the price on its plate. Returns the left edge of what it drew.
  private drawRowRight(
    parent: GameObjects.Container,
    plate: PlateKind | null,
    row: ShopRow,
    at: { mid: number; right: number },
  ): number {
    if (row.price === null || plate === null) {
      const tick = addTagImage(this, "ui-check", "tick", at.right - 16, at.mid - 8);
      if (tick !== undefined) {
        parent.add(tick);
      }
      const owned = gameData.homeText.shop.owned;
      const label = this.text(parent, { x: at.right - OWNED_DX, y: at.mid - 4 }, owned, {
        color: PALETTE.forest,
        font: "title",
        originX: 1,
      });
      return at.right - OWNED_DX - Math.ceil(label.width);
    }
    return addPlate(
      this,
      parent,
      { capY: at.mid - 5, originX: 1, x: at.right },
      dollarText(row.price),
      plateColors(plate),
    ).x;
  }

  // A held dog's or gear item's detail card over the shop; any tap closes it.
  private drawDetail(save: SaveDocument, purchase: Purchase): void {
    if (purchase.kind === "dogSlot") {
      return;
    }
    const layer = this.add.container(0, 0);
    const card =
      purchase.kind === "dog"
        ? dogDetail(gameData, save.owned, save.bankCents, save.stats, purchase.dog)
        : gearDetail(gameData, save.owned, save.bankCents, save.lastLoadout, purchase.gear);
    drawDetailCard(this, layer, false, card, purchasePicture(purchase), purchase.kind);
  }
}
