import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import type { Rect } from "../lib/rect";
import { type FontMetrics, helpCapDy } from "../ui/fontMetrics";
import { cardBand, HOME_LAYOUT } from "./homeLayout";
import type { ConfirmChoice } from "./purchaseConfirm";

// The purchase confirm: the screen dimmed, and a card centred on it with its title band, the
// item's picture in a well, the price and the bank it would leave centred under it, the bank's
// capitals LABEL_HELP_GAP clear rows under the title font's lowest ink (confirmLeftCapTop), and
// Cancel then Buy along its bottom, each 44 tall and 132 wide, with 12 between them and at the
// card's sides.
const CARD = HOME_LAYOUT.card;
const WIDTH = CARD.width;
const HEIGHT = 220;
const BUTTON = { gap: 12, height: 44, width: 132 } as const;
const card: Rect = {
  height: HEIGHT,
  width: WIDTH,
  x: (SCREEN_CONFIG.width - WIDTH) / 2,
  y: (SCREEN_CONFIG.height - HEIGHT) / 2,
};
const centreX = card.x + WIDTH / 2;
const band = cardBand(card);
const well: Rect = {
  height: CARD.well.size,
  width: CARD.well.size,
  x: centreX - CARD.well.size / 2,
  y: card.y + 40,
};
const buttonsY = card.y + HEIGHT - BUTTON.gap - BUTTON.height;
const button = (i: number): Rect => ({
  height: BUTTON.height,
  width: BUTTON.width,
  x: card.x + BUTTON.gap + i * (BUTTON.width + BUTTON.gap),
  y: buttonsY,
});

export const PURCHASE_CONFIRM_LAYOUT = {
  band,
  buttons: { buy: button(1), cancel: button(0) } satisfies Readonly<Record<ConfirmChoice, Rect>>,
  card,
  // Each line is centred on centreX with its capitals' top at capTop, in its font at 2x; the
  // bank's at confirmLeftCapTop.
  left: { centreX, font: "body", room: WIDTH - 2 * CARD.pad },
  // The picture sits in the well picture pixels in from its corner.
  picture: { x: well.x + CARD.well.picture, y: well.y + CARD.well.picture },
  price: { capTop: well.y + well.height + 10, centreX, font: "title", room: WIDTH - 2 * CARD.pad },
  screen: SCREEN_LAYOUT.screen,
  title: { capTop: band.y + CARD.band.titleY, centreX, font: "title", room: band.width - 16 },
  well,
} as const;

// The capitals' top of the bank it would leave, under the price in the title font.
export function confirmLeftCapTop(title: FontMetrics): number {
  return PURCHASE_CONFIRM_LAYOUT.price.capTop + helpCapDy(title, 2);
}
