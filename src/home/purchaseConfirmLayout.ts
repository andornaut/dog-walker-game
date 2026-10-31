import { type FontMetrics, inkRowsFromCapTop } from "@andornaut/game-kit/text/bitmapFont";

import { SCREEN_CONFIG } from "../data/screen";
import { barTitleRoom } from "../ui/barTitle";
import { BUTTON_SIZE } from "../ui/buttonGeometry";
import { closeControl } from "../ui/closeControl";
import { helpCapDy } from "../ui/labelHelpGap";
import { overlayRegion } from "./homeBar";
import { cardTitleRow, HOME_LAYOUT } from "./homeLayout";
import {
  MODAL,
  modalActionWidth,
  modalPanelWidth,
  modalRect,
  modalTitleWidth,
} from "./modalLayout";

const CARD = HOME_LAYOUT.card;
const BUTTON_HEIGHT = BUTTON_SIZE.compact.height;
const MAX_WIDTH = SCREEN_CONFIG.width - 2 * MODAL.margin;
const LIMITS = { height: 0, width: MAX_WIDTH, x: 0, y: 0 };

// Fixed-font text budgets at the viewport width limit; runtime uses each purchase's actual ink.
export const PURCHASE_CONFIRM_ROOMS = {
  left: { font: "body", room: MAX_WIDTH - 2 * MODAL.pad },
  price: { font: "title", room: MAX_WIDTH - 2 * MODAL.pad },
  title: { font: "title", room: barTitleRoom(cardTitleRow(LIMITS), closeControl(LIMITS)) },
} as const;

export function confirmLeftCapTop(title: FontMetrics, priceTop: number): number {
  return priceTop + helpCapDy(title, 2);
}

// Runtime geometry follows the actual fixed-size ink and the paired controls.
export function purchaseConfirmLayout(
  fonts: { body: FontMetrics; title: FontMetrics },
  ink: { buy: number; cancel: number; left: number; price: number; title: number },
) {
  const actions = { buy: modalActionWidth(ink.buy), cancel: modalActionWidth(ink.cancel) };
  const actionsWidth = actions.buy + actions.cancel + MODAL.gap;
  const width = modalPanelWidth(
    SCREEN_CONFIG.width - 2 * MODAL.margin,
    Math.max(
      actionsWidth + 2 * MODAL.pad,
      modalTitleWidth(ink.title),
      Math.max(ink.price, ink.left) + 2 * MODAL.pad,
    ),
  );
  const priceTop = MODAL.header + CARD.well.size + MODAL.gap;
  const leftTop = confirmLeftCapTop(fonts.title, priceTop);
  const buttonsTop = leftTop + inkRowsFromCapTop(fonts.body) * 2 + MODAL.gap;
  const height = buttonsTop + BUTTON_HEIGHT + MODAL.pad;
  const placed = modalRect(overlayRegion("home"), undefined, { height, width });
  const middle = placed.x + width / 2;
  const row = cardTitleRow(placed);
  const placedWell = {
    height: CARD.well.size,
    width: CARD.well.size,
    x: middle - CARD.well.size / 2,
    y: placed.y + MODAL.header,
  };
  const action = (choice: "buy" | "cancel") => ({
    height: BUTTON_HEIGHT,
    width: actions[choice],
    x: middle - actionsWidth / 2 + (choice === "buy" ? actions.cancel + MODAL.gap : 0),
    y: placed.y + buttonsTop,
  });
  return {
    buttons: { buy: action("buy"), cancel: action("cancel") },
    card: placed,
    dim: overlayRegion("home"),
    left: {
      ...PURCHASE_CONFIRM_ROOMS.left,
      capTop: placed.y + leftTop,
      centreX: middle,
      room: width - 2 * MODAL.pad,
    },
    picture: { x: placedWell.x + CARD.well.picture, y: placedWell.y + CARD.well.picture },
    price: {
      ...PURCHASE_CONFIRM_ROOMS.price,
      capTop: placed.y + priceTop,
      centreX: middle,
      room: width - 2 * MODAL.pad,
    },
    title: {
      ...PURCHASE_CONFIRM_ROOMS.title,
      capTop: row.y + CARD.titleRow.titleY,
      room: barTitleRoom(row, closeControl(placed)),
    },
    titleRow: row,
    well: placedWell,
  };
}
