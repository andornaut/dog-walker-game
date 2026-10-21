import { SCREEN_CONFIG } from "../data/screen";
import type { Rect } from "../layout/rect";
import { HOME_LAYOUT } from "./homeLayout";
import type { ConfirmChoice } from "./purchaseConfirm";

// The purchase confirm: the screen dimmed, and a card centred on it with its title band, the
// item's picture in a well, the price and the bank it would leave centred under it, and Cancel
// then Buy along its bottom, 44 tall, as wide as the logbook's buttons with 12 between them
// and at the card's sides.
const CARD = HOME_LAYOUT.card;
const WIDTH = CARD.width;
const HEIGHT = 216;
const BUTTON = HOME_LAYOUT.logbookButton;
const card: Rect = {
  height: HEIGHT,
  width: WIDTH,
  x: (SCREEN_CONFIG.width - WIDTH) / 2,
  y: (SCREEN_CONFIG.height - HEIGHT) / 2,
};
const centerX = card.x + WIDTH / 2;
const band: Rect = {
  height: CARD.band.height,
  width: WIDTH - 2 * CARD.band.inset,
  x: card.x + CARD.band.inset,
  y: card.y + CARD.band.inset,
};
const well: Rect = {
  height: CARD.well.size,
  width: CARD.well.size,
  x: centerX - CARD.well.size / 2,
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
  // Each line is centred on centerX with its capitals' top at capTop, in its font at 2x.
  left: { capTop: well.y + well.height + 28, centerX, font: "body", room: WIDTH - 2 * CARD.pad },
  // The picture sits in the well picture pixels in from its corner.
  picture: { x: well.x + CARD.well.picture, y: well.y + CARD.well.picture },
  price: { capTop: well.y + well.height + 10, centerX, font: "title", room: WIDTH - 2 * CARD.pad },
  screen: { height: SCREEN_CONFIG.height, width: SCREEN_CONFIG.width, x: 0, y: 0 } as Rect,
  title: { capTop: band.y + CARD.band.titleY, centerX, font: "title", room: band.width - 16 },
  well,
} as const;
