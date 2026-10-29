import type { GameObjects, Scene } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import { cardBand } from "../home/homeLayout";
import { SHOP_LAYOUT, shopTabFace, shopTabRects } from "../home/shopLayout";
import { fillRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import { addCardTitle, addDetailCard } from "./homePanels";
import { addCloseButton, addGraphicsIn, addTab } from "./uiKit";

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
  addDetailCard(scene, parent, PANEL, cardBand(PANEL));
  parent.add(addCardTitle(scene, PANEL, title));
  addCloseButton(scene, parent, SHOP_LAYOUT.close, closePressed);
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
