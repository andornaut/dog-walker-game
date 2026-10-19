// The end screen's geometry: the menus mock's end screen with every text at 2x.
const PANEL = { height: 300, width: 312, x: 24, y: 112 };
const RIBBON = { x: 144, y: 102 };

export const END_LAYOUT = {
  // Room for each badge's name on one line under it.
  badges: { height: 92, width: 344, x: 8, y: 416 },
  breakdown: { amountRight: 196, label: 40, pitch: 16, top: PANEL.y + 42 },
  // 44 game pixels tall: 48 CSS pixels on a 390px-wide phone.
  button: { height: 44, width: 264, x: 48, y: 512 },
  logo: { x: 116, y: 8 },
  panel: PANEL,
  quips: {
    bubble: { height: 38, width: 244, x: 80 },
    face: { x: 37, y: 1 },
    pitch: 40,
    tail: { x: 75, y: 15 },
    textX: 86,
    top: PANEL.y + 174,
    well: { size: 34, x: 36, y: 0 },
  },
  // The return home, under the logo and above the panel: the walker and pack walk up the
  // front path from behind the panel's top edge to the house's step while the owners wave
  // either side. The house, lawn, path and step are part of screen-end; without it a tan path
  // and step cross a strip of lawn. Spots are where feet end up, in pack order, 34 apart so
  // every 40px dog and 40x60 person shows.
  returnHome: {
    dogs: [
      { x: 146, y: 106 },
      { x: 214, y: 105 },
      { x: 248, y: 108 },
    ],
    lawn: { height: 16, width: 360, x: 0, y: 96 },
    owners: [
      { x: 112, y: 110 },
      { x: 282, y: 110 },
      { x: 78, y: 110 },
    ],
    path: { height: 12, width: 24, x: 168, y: 100 },
    step: { height: 4, width: 32, x: 164, y: 96 },
    walker: { x: 180, y: 110 },
  },
  ribbon: RIBBON,
  // fx-new-best's 96x48 frame sits 12 left of and 14 above the ribbon.
  ribbonBurst: { height: 48, width: 96, x: RIBBON.x - 12, y: RIBBON.y - 14 },
  side: {
    bankY: PANEL.y + 82,
    iconY: PANEL.y + 100,
    pipPitch: 21,
    pipsY: PANEL.y + 60,
    right: 320,
    x: 212,
  },
  titleY: PANEL.y + 18,
} as const;
