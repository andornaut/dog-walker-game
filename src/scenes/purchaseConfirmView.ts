import type { Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene } from "phaser";

import type { DetailPicture } from "../home/detail";
import type { ConfirmChoice, ConfirmLines } from "../home/purchaseConfirm";
import { confirmLeftCapTop, PURCHASE_CONFIRM_LAYOUT } from "../home/purchaseConfirmLayout";
import { PALETTE } from "../ui/palette";
import { addDim } from "../ui/phaser/draw";
import { addPixelText, pixelFontMetrics } from "../ui/phaser/pixelText";
import { TEXT_SCALE } from "../ui/textFit";
import { addDetailWell, addModalCard } from "./homePanels";
import { addMenuButton } from "./uiKit";

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

// The confirm over everything the scene drew before it: the shop dimmed, the modal card titled
// "Buy {name}?" with no close control (Cancel closes it), the picture in its well, the price and the bank it would
// leave, then Cancel and Buy. Returns where it is tapped.
export function drawPurchaseConfirm(
  scene: Scene,
  layer: GameObjects.Container,
  input: PurchaseConfirmViewInput,
): PurchaseConfirmHits {
  const { lines, picture, pressed } = input;
  layer.add(addDim(scene, LAYOUT.dim));
  addModalCard(scene, layer, LAYOUT.card, lines.title, undefined);
  const centred = (
    at: { capTop: number; centreX: number; font: "body" | "title" },
    value: string,
    colour: number,
  ) => {
    const label = addPixelText(scene, at.centreX, at.capTop, value, {
      colour,
      font: at.font,
      originX: 0.5,
      scale: TEXT_SCALE,
    });
    layer.add(label);
  };
  addDetailWell(scene, layer, LAYOUT.well);
  if (scene.textures.exists(picture.key)) {
    const at = LAYOUT.picture;
    layer.add(scene.add.image(at.x, at.y, picture.key).setOrigin(0).setScale(picture.scale));
  }
  centred(LAYOUT.price, lines.price, PALETTE.plum);
  const leftTop = confirmLeftCapTop(pixelFontMetrics(scene, "title"));
  centred({ ...LAYOUT.left, capTop: leftTop }, lines.left, PALETTE.darkBrown);
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
