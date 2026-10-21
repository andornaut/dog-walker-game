import { type GameObjects, type Input, Scene } from "phaser";

import { dogFaceKey, dogPortraitKey, gearIconKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { dogDetail, gearDetail } from "../home/detail";
import { FEEDBACK, shakeOffset } from "../home/feedback";
import { focusDirectionForKey } from "../home/focus";
import { buy, dollarText, type Purchase } from "../home/home";
import { type HomeAction, messageLine } from "../home/homeLines";
import { HOME_TEXT_FIELDS } from "../home/homeText";
import { type ArtLook, PLAIN_ITEM, tileState } from "../home/interaction";
import { GREYED, type PlateKind } from "../home/selection";
import {
  dogRows,
  gearRows,
  SHOP_ROW_VIEWS,
  SHOP_TABS,
  type ShopRow,
  shopRowId,
  shopRowLook,
  type ShopTab,
  shopTabOf,
  slotRows,
} from "../home/shop";
import {
  rowRects,
  SHOP_LAYOUT,
  shopRowTextRoom,
  shopTabFace,
  shopTabRects,
} from "../home/shopLayout";
import { HOLD, type HoldPress, moveHold, startHold, tickHold } from "../input/hold";
import { isConfirmKey, isPauseKey } from "../input/keyBindings";
import { containsPoint, type Rect } from "../layout/rect";
import { TEXT_FIT_STYLES, type TextFitStyle } from "../layout/textFit";
import { cents } from "../rules/units";
import type { SaveDocument } from "../save/schema";
import { fillLine } from "../text/lines";
import type { CelebrationSceneData } from "./CelebrationScene";
import { drawFramedRect, fillRect } from "./draw";
import { addAffordFrame, type DetailPicture, drawDetailCard } from "./homePanels";
import {
  addLock,
  addPlate,
  artTextureKey,
  drawDogSlotFallback,
  plateColors,
  SHOP_ART,
} from "./itemArt";
import { closeOverlay, listenDismiss, openOverlay, type OverlayData } from "./overlay";
import { PALETTE } from "./palette";
import { addPixelText, fitPixelText, type FontRole } from "./pixelText";
import { currentSettings, profileSave, purchaseInProfile, takeCelebrations } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import { listenTargetPress, type TargetPressListener } from "./targetPress";
import {
  addCloseButton,
  addNineSlice,
  addSelectFrame,
  addSelectTile,
  addTagImage,
  addTapBurst,
  clearScene,
  tagFrame,
  TEXT_SCALE,
} from "./uiKit";

// The caller pauses itself and launches the shop on a tab, framing the row of focus when
// given; the shop resumes it on close.
export interface ShopSceneData extends OverlayData {
  focus?: Purchase;
  tab?: ShopTab;
}

// Emitted on game.events after each purchase, so the screen under the shop redraws its bank.
export const SHOP_CHANGED_EVENT = "shop-changed";
// Emitted on game.events when the shop closes, with the last purchase or refusal, so the
// home screen's walker can say it.
export const SHOP_CLOSED_EVENT = "shop-closed";

export interface ShopClosed {
  readonly action: HomeAction;
}

// While a detail card is open, a press anywhere on the shop's panel is dismiss: its tap
// closes the card.
type Target =
  | { kind: "close" }
  | { kind: "dismiss" }
  | { id: string; kind: "row" }
  | { kind: "tab"; tab: ShopTab };

const LAYOUT = SHOP_LAYOUT;
const PANEL: Rect = LAYOUT.panel;
const TAB_RECTS: readonly Rect[] = shopTabRects();
const ROW = LAYOUT.row;
const OWNED_DX = ROW.ownedDx;

function sameTarget(a: Target, b: Target | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// A row as laid out on the open tab.
interface PlacedRow {
  readonly rect: Rect;
  readonly row: ShopRow;
}

// The Pet shop under the home screen's top bar: a Gear tab of gear for sale, and a Dogs tab
// of dog slots and dogs. Tapping a row the bank covers buys it; one it cannot pays a shake and
// says why. Anything affordable wears the gold outline, and the row the shop opened on, or
// the last one tapped, is framed. Holding a dog or gear row opens its detail card. Left and
// right switch tabs, up and down move the frame, Enter or Space taps the framed row, and
// Escape closes the card or the shop.
export class ShopScene extends Scene {
  private action: HomeAction = { kind: "none" };
  private containers = new Map<string, GameObjects.Container>();
  private detail: Purchase | undefined;
  private focusId: string | null = null;
  private hold: HoldPress | undefined;
  // The last tap's message: a purchase in green, a refusal in dark red.
  private message: { readonly refused: boolean; readonly text: string } | null = null;
  private placed: PlacedRow[] = [];
  private pressed: Target | undefined;
  private presses: TargetPressListener | undefined;
  private resumeKey: SceneKey | undefined;
  private shakes = new Map<string, number>();
  private tab: ShopTab = "gear";

  constructor() {
    super(SCENE_KEYS.shop);
  }

  create(data: ShopSceneData): void {
    this.resumeKey = data.resume;
    this.action = { kind: "none" };
    this.detail = undefined;
    this.hold = undefined;
    this.message = null;
    this.pressed = undefined;
    this.shakes = new Map();
    this.tab = data.focus === undefined ? (data.tab ?? "gear") : shopTabOf(data.focus);
    this.focusId = data.focus === undefined ? null : shopRowId(this.save().owned, data.focus);
    this.render();

    // A tap acts once its dip ends; holding a dog or gear row opens its detail card, and the
    // hold takes the press. With a card open, a tap anywhere closes it, as on Stats.
    this.presses = listenTargetPress<Target>(this, {
      dipMs: (target) => (target.kind === "dismiss" ? 0 : FEEDBACK.pressDipMs),
      onDown: (pointer, target) => {
        addTapBurst(this, pointer.x, pointer.y);
        if (this.detail !== undefined) {
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
        if (this.detail === undefined) {
          return this.targetAt(x, y);
        }
        return containsPoint(PANEL, x, y) ? { kind: "dismiss" } : undefined;
      },
    });
    this.input.on("pointermove", (pointer: Input.Pointer) => {
      if (this.hold !== undefined && pointer.isDown) {
        this.hold = moveHold(this.hold, { x: pointer.x, y: pointer.y });
      }
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => this.onKey(event.key));
    // The top bar and the margins around the card close the shop, card and all; back closes an
    // open card first, as Escape does.
    listenDismiss(
      this,
      [PANEL],
      () => this.close(),
      () => this.back(),
    );
  }

  private save(): SaveDocument {
    return profileSave(this);
  }

  // An open card closes, else the shop.
  private back(): void {
    if (this.detail === undefined) {
      this.close();
      return;
    }
    this.detail = undefined;
    this.render();
  }

  private onKey(key: string): void {
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
      const tab = SHOP_TABS[Math.min(SHOP_TABS.length - 1, Math.max(0, index))];
      if (tab !== undefined && tab !== this.tab) {
        this.actAfterDip({ kind: "tab", tab });
      }
      return;
    }
    if (direction === "up" || direction === "down") {
      const ids = this.rows().map(({ id }) => id);
      const at = this.focusId === null ? -1 : ids.indexOf(this.focusId);
      const next = Math.min(ids.length - 1, Math.max(0, at + (direction === "up" ? -1 : 1)));
      this.focusId = ids[next] ?? this.focusId;
      this.message = null;
      this.render();
      return;
    }
    if (isConfirmKey(key) && this.focusId !== null) {
      this.actAfterDip({ id: this.focusId, kind: "row" });
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
    const hit = this.placed.find(({ rect }) => containsPoint(rect, x, y));
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

  override update(): void {
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
      case "dismiss":
        this.back();
        return;
      case "tab":
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
  // shakes and says why; one the bank covers is bought.
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
    } else if (look === "short" && row.price !== null) {
      this.shakes.set(id, this.time.now);
      this.action = {
        amount: cents(row.price - save.bankCents),
        kind: "cantAfford",
        name: row.name,
      };
      this.message = { refused: true, text: messageLine(text, this.action) ?? "" };
    } else {
      this.purchase(row);
      return;
    }
    this.render();
  }

  private purchase(row: ShopRow): void {
    const result = buy(gameData, row.purchase, this.save());
    if (result.kind === "refused") {
      return;
    }
    void purchaseInProfile(this, () => result.save);
    this.action = { kind: "bought", name: row.name, purchase: row.purchase };
    this.message = { refused: false, text: messageLine(gameData.homeText, this.action) ?? "" };
    this.game.events.emit(SHOP_CHANGED_EVENT);
    this.render();
    this.celebrate(row.purchase);
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
    style: { color?: number; font?: FontRole; maxWidth?: number; originX?: number } = {},
  ): GameObjects.BitmapText {
    const { maxWidth, ...rest } = style;
    const label = addPixelText(this, at.x, at.y, value, {
      color: PALETTE.plum,
      scale: TEXT_SCALE,
      ...rest,
      ...(maxWidth === undefined ? {} : { maxWidth }),
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
    if (this.tab === "gear") {
      this.drawGear(root, save);
    } else {
      this.drawDogs(root, save);
    }
    if (this.message !== null) {
      const { refused, text } = this.message;
      this.text(root, { x: LAYOUT.headingX, y: LAYOUT.message.y }, text, {
        color: refused ? PALETTE.darkRed : PALETTE.forest,
        maxWidth: ROW.width,
      });
    }
    if (this.detail !== undefined) {
      this.drawDetail(save, this.detail);
    }
  }

  private graphics(parent: GameObjects.Container): GameObjects.Graphics {
    const g = this.add.graphics();
    parent.add(g);
    return g;
  }

  // The card, its title band and its close control.
  private drawCard(root: GameObjects.Container): void {
    const card = addNineSlice(this, "ui-detail-card", PANEL);
    if (card === undefined) {
      drawFramedRect(
        this.graphics(root),
        { border: PALETTE.darkBrown, fill: PALETTE.cream },
        PANEL,
      );
    } else {
      root.add(card);
    }
    const { height, inset, titleX, titleY } = LAYOUT.band;
    const band = { height, width: PANEL.width - inset * 2, x: PANEL.x + inset, y: PANEL.y + inset };
    const slice = addNineSlice(this, "ui-detail-band", band);
    if (slice === undefined) {
      fillRect(this.graphics(root), PALETTE.forest, band);
    } else {
      root.add(slice);
    }
    this.text(root, { x: PANEL.x + titleX, y: band.y + titleY }, gameData.homeText.shop.title, {
      color: PALETTE.white,
      font: "title",
    });
    addCloseButton(this, root, PANEL, this.pressed?.kind === "close");
  }

  // The open tab is selected and the other normal.
  private drawTabs(root: GameObjects.Container): void {
    const { reducedMotion } = currentSettings(this);
    SHOP_TABS.forEach((tab, i) => {
      const hit = TAB_RECTS[i];
      if (hit === undefined) {
        return;
      }
      const rect = shopTabFace(hit);
      const tile = addSelectTile(this, root, rect, {
        edge: true,
        reducedMotion,
        state: tileState({ ...PLAIN_ITEM, picked: tab === this.tab }),
        tile: false,
      });
      if (sameTarget({ kind: "tab", tab }, this.pressed)) {
        tile.container.y += FEEDBACK.pressDipPx;
      }
      tile.content.add(
        addPixelText(
          this,
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          gameData.homeText.shop.tabs[tab],
          {
            color: PALETTE[tile.look.text],
            font: "title",
            originX: 0.5,
            originY: 0.5,
            scale: TEXT_SCALE,
          },
        ),
      );
    });
  }

  private heading(root: GameObjects.Container, y: number, title: string, note?: string): void {
    this.text(root, { x: LAYOUT.headingX, y }, title, { font: "title" });
    if (note !== undefined) {
      this.text(root, { x: LAYOUT.headingRight, y }, note, {
        color: PALETTE.darkBrown,
        originX: 1,
      });
    }
  }

  // Every gear item with its effect in a few words and its price or Owned.
  private drawGear(root: GameObjects.Container, save: SaveDocument): void {
    const text = gameData.homeText;
    const { headingY, rows: spec } = LAYOUT.gear;
    this.heading(root, headingY, text.shop.tabs.gear, text.shop.gearNote);
    const rows = gearRows(gameData, save.owned);
    const rects = rowRects(spec, rows.length);
    rows.forEach((row, i) => {
      const rect = rects[i];
      if (rect !== undefined && row.purchase.kind === "gear") {
        this.drawRow(root, save, { rect, row }, gearIconKey(row.purchase.gear));
      }
    });
  }

  // The dog slots past the first with how many are owned, then the dogs still for sale, or a
  // line saying every dog is owned.
  private drawDogs(root: GameObjects.Container, save: SaveDocument): void {
    const text = gameData.homeText;
    const { dogHeadingY, dogRows: dogSpec, slotHeadingY, slotRows: slotSpec } = LAYOUT.dogs;
    const owned = fillLine(HOME_TEXT_FIELDS.shop, text.shop, "slotsOwned", {
      max: String(gameData.dogSlots.length),
      owned: String(save.owned.dogSlots),
    });
    this.heading(root, slotHeadingY, text.shop.slots, owned);
    const slots = slotRows(gameData, save.owned);
    rowRects(slotSpec, slots.length).forEach((rect, i) => {
      const row = slots[i];
      if (row !== undefined) {
        this.drawRow(root, save, { rect, row }, SHOP_ART.dogSlot);
      }
    });
    this.heading(root, dogHeadingY, text.shop.dogs);
    const dogs = dogRows(gameData, save.owned);
    if (dogs.length === 0) {
      this.text(root, { x: LAYOUT.headingX, y: dogSpec.y + 4 }, text.shop.dogsAllOwned, {
        color: PALETTE.darkBrown,
      });
    }
    rowRects(dogSpec, dogs.length).forEach((rect, i) => {
      const row = dogs[i];
      if (row?.purchase.kind === "dog") {
        this.drawRow(root, save, { rect, row }, dogFaceKey(gameData, row.purchase.dog));
      }
    });
  }

  // A row: its art in a box, its name and line, and its price plate or Owned at the right,
  // each as SHOP_ROW_VIEWS sets for its look. An affordable row wears the gold outline; the
  // framed one ui-select.
  private drawRow(
    root: GameObjects.Container,
    save: SaveDocument,
    placed: PlacedRow,
    art: string,
  ): void {
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
    this.addArt(content, art, view.art, { x: boxRect.x + ROW.art, y: boxRect.y + ROW.art });
    if (view.padlock !== null) {
      addLock(this, content, view.padlock, { x: rect.x + lock.dx, y: rect.y + lock.dy });
    }
    const ink = PALETTE[tile.look.text];
    const mid = rect.y + Math.floor(rect.height / 2);
    const textX = rect.x + ROW.textDx;
    const right = rect.x + rect.width - ROW.plateInset;
    const rightLeft = this.drawRowRight(content, view.plate, row, { mid, right });
    // The name and line fit the room the price plate or Owned leaves them.
    const fit = { room: shopRowTextRoom(right - rightLeft), styles: TEXT_FIT_STYLES };
    // A row with no second line centres its name.
    const nameY = row.line === "" ? mid - 5 : mid - 15;
    const name = this.text(content, { x: textX, y: nameY }, row.name, { color: ink });
    fitPixelText(name, fit, textX, nameY);
    this.drawRowLine(content, row, { fit, greyed: view.state === "disabled", mid, x: textX });
    if (this.focusId === row.id) {
      addSelectFrame(this, holder, rect, reducedMotion);
    } else if (look === "affordable") {
      addAffordFrame(this, holder, rect, reducedMotion);
    }
  }

  private addArt(
    parent: GameObjects.Container,
    key: string,
    look: ArtLook,
    at: { x: number; y: number },
  ): void {
    if (!this.textures.exists(key)) {
      if (key === SHOP_ART.dogSlot) {
        drawDogSlotFallback(this, parent, at);
      }
      return;
    }
    // A dog's face shows its happy frame; an icon has one frame.
    const shown = artTextureKey(this, look, key);
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
    const picture: DetailPicture =
      purchase.kind === "dog"
        ? { key: dogPortraitKey(gameData, purchase.dog), scale: 1 }
        : { key: gearIconKey(purchase.gear), scale: 2 };
    drawDetailCard(this, layer, false, card, picture, purchase.kind);
  }
}
