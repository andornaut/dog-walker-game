import type { GameObjects, Scene } from "phaser";

import type { ConfirmChoice, ConfirmLines } from "../home/purchaseConfirm";
import { PURCHASE_CONFIRM_LAYOUT } from "../home/purchaseConfirmLayout";
import type { Rect } from "../lib/rect";
import { addDim, drawFramedRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import { addPixelText, fitPixelText } from "../ui/phaser/pixelText";
import { TEXT_FIT_STYLES } from "../ui/textFit";
import { DETAIL_WELL_KEYS, type DetailPicture } from "./homePanels";
import { addMenuButton, addNineSlice, type SliceKey, TEXT_SCALE } from "./uiKit";

// Everything the purchase confirm draws from. The scene that opens it routes its taps and keys
// through the model in home/purchaseConfirm; the view only draws.
interface PurchaseConfirmViewInput {
  readonly lines: ConfirmLines;
  // The item's picture in the well, as a detail card's.
  readonly picture: DetailPicture;
  // The answer under a finger or a key's dip, drawn pressed.
  readonly pressed: ConfirmChoice | undefined;
}

// Where the confirm's card lies, and where each answer is tapped. A tap off the card cancels;
// one on the card off its answers does nothing.
export interface PurchaseConfirmHits {
  readonly buttons: Readonly<Record<ConfirmChoice, Rect>>;
  readonly card: Rect;
}

const LAYOUT = PURCHASE_CONFIRM_LAYOUT;

// A nine-slice in parent, or the rect filled and framed in code while its art is missing.
function addSlice(
  scene: Scene,
  parent: GameObjects.Container,
  key: SliceKey,
  rect: Rect,
  colors: { border: number; fill: number },
): void {
  const slice = addNineSlice(scene, key, rect);
  if (slice !== undefined) {
    parent.add(slice);
    return;
  }
  const g = scene.add.graphics();
  drawFramedRect(g, colors, rect);
  parent.add(g);
}

// The confirm over everything the scene drew before it: the screen dimmed, the ui-detail-card
// with its band and "Buy {name}?", the picture in its well, the price and the bank it would
// leave, then Cancel and Buy. Returns where it is tapped.
export function drawPurchaseConfirm(
  scene: Scene,
  layer: GameObjects.Container,
  input: PurchaseConfirmViewInput,
): PurchaseConfirmHits {
  const { lines, picture, pressed } = input;
  layer.add(addDim(scene, LAYOUT.screen));
  addSlice(scene, layer, "ui-detail-card", LAYOUT.card, {
    border: PALETTE.darkBrown,
    fill: PALETTE.cream,
  });
  addSlice(scene, layer, "ui-detail-band", LAYOUT.band, {
    border: PALETTE.forest,
    fill: PALETTE.forest,
  });
  const centred = (
    at: { capTop: number; centerX: number; font: "body" | "title"; room: number },
    value: string,
    color: number,
  ) => {
    const label = addPixelText(scene, at.centerX, at.capTop, value, {
      color,
      font: at.font,
      originX: 0.5,
      scale: TEXT_SCALE,
    });
    fitPixelText(label, { room: at.room, styles: TEXT_FIT_STYLES }, at.centerX, at.capTop);
    layer.add(label);
  };
  centred(LAYOUT.title, lines.title, PALETTE.white);
  const { well } = LAYOUT;
  if (scene.textures.exists(DETAIL_WELL_KEYS.shown)) {
    layer.add(scene.add.image(well.x, well.y, DETAIL_WELL_KEYS.shown).setOrigin(0));
  } else {
    const g = scene.add.graphics();
    drawFramedRect(g, { border: PALETTE.plum, fill: PALETTE.grey }, well);
    layer.add(g);
  }
  if (scene.textures.exists(picture.key)) {
    const at = LAYOUT.picture;
    layer.add(scene.add.image(at.x, at.y, picture.key).setOrigin(0).setScale(picture.scale));
  }
  centred(LAYOUT.price, lines.price, PALETTE.plum);
  centred(LAYOUT.left, lines.left, PALETTE.darkBrown);
  const labels: Readonly<Record<ConfirmChoice, string>> = { buy: lines.buy, cancel: lines.cancel };
  for (const choice of ["cancel", "buy"] as const) {
    const primary = choice === "buy";
    addMenuButton(
      scene,
      LAYOUT.buttons[choice],
      labels[choice],
      { available: true, primary, secondary: !primary },
      layer,
    ).setPressed(pressed === choice);
  }
  return { buttons: LAYOUT.buttons, card: LAYOUT.card };
}
