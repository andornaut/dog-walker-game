import type { GameObjects, Scene } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import { SHOP_LAYOUT, shopTabFace, shopTabRects } from "../home/shopLayout";
import { PALETTE } from "../ui/palette";
import { fillRect } from "../ui/phaser/draw";
import { inkSpan, placePixelText } from "../ui/phaser/pixelText";
import { addFramedPageCard } from "./homePanels";
import { addBodyText, addGraphicsIn, addTab } from "./uiKit";

// The page the Pet shop and the Logbook share, under the home screen's top bar.

const PANEL = SHOP_LAYOUT.panel;

// A tab on the page: its label, and whether it is the open one or pressed.
export interface ShopPageTab {
  readonly label: string;
  readonly open: boolean;
  readonly pressed: boolean;
}

// The wood under the card, from the top bar down, so the home screen's bar shows above it;
// then the card, its title band reading title, and its close control.
export function addShopPage(
  scene: Scene,
  parent: GameObjects.Container,
  closePressed: boolean,
  title: string,
): void {
  fillRect(addGraphicsIn(scene, parent), PALETTE.darkBrown, {
    height: SCREEN_CONFIG.height - PANEL.y + 4,
    width: SCREEN_CONFIG.width,
    x: 0,
    y: PANEL.y - 4,
  });
  addFramedPageCard(
    scene,
    parent,
    { ...SHOP_LAYOUT.title, close: SHOP_LAYOUT.close },
    PANEL,
    title,
    closePressed,
  );
}

// Moves a label so its ink ends at right, its capitals' top at y.
export function placeInkRight(label: GameObjects.BitmapText, right: number, y: number): void {
  placePixelText(label, right - inkSpan(label).right, y);
}

// A list's count, such as the shop's owned counts and the Logbook's earned count: body text in
// dark brown, its ink ending at the list's right text edge, right, and its capitals' top at y,
// level with a heading's when one sits beside it.
export function addCountNote(
  scene: Scene,
  parent: GameObjects.Container | undefined,
  right: number,
  y: number,
  text: string,
): GameObjects.BitmapText {
  const label = addBodyText(scene, parent, { x: 0, y }, text, { colour: PALETTE.darkBrown });
  placeInkRight(label, right, y);
  return label;
}

// The page's tabs, left to right across the tab span (shopTabRects), each drawn on its face:
// the open one selected, the others normal.
export function addShopTabs(
  scene: Scene,
  parent: GameObjects.Container,
  tabs: readonly ShopPageTab[],
): void {
  shopTabRects(tabs.length).forEach((hit, i) => {
    const tab = tabs[i];
    if (tab !== undefined) {
      const { label, open, pressed } = tab;
      addTab(scene, parent, shopTabFace(hit), label, { open, pressed });
    }
  });
}
