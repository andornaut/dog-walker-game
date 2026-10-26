// How a tile, tab or row shows its interaction state, as ui-tile draws it: normal is cream,
// selected gold, disabled flat grey. Colours are the scenes' PALETTE names.
import type { ButtonState, ItemLook, TileState } from "./interaction";

// Every colour a disabled, short or locked item draws in, the neutral greys among them:
// - box: the box behind a portrait or icon in grey art.
// - copyDarker: a disabled tile's grey copy of its art moves each colour to the colour of
//   NEUTRAL_RAMP nearest its brightness, as a disabled card's does, then this many steps
//   down the ramp. 0 keeps a dark portrait readable on its box.
// - edge: the line round a disabled face drawn in code and round a short or goal plate.
// - face: a disabled tile's face drawn in code.
// - plateFace: a short or goal plate's face.
// - plateText, shortPrice: the text on a goal plate or a disabled card's cost plaque, and a
//   short price on its plate.
// - text: a disabled tile's label.
export const GREYED = {
  box: "neutralSlate",
  copyDarker: 0,
  edge: "neutralSlate",
  face: "neutralGrey",
  plateFace: "neutralLightGrey",
  plateText: "ink",
  shortPrice: "darkRed",
  text: "neutralDarkSlate",
} as const;

export interface SelectLook {
  face: "cream" | typeof GREYED.face | "yellow";
  state: TileState;
  text: typeof GREYED.text | "plum";
}

// Text on each face: plum on cream (9.42:1) and yellow (10.92); a disabled label holds the
// 3:1 its exemption needs.
const LOOKS: Readonly<Record<TileState, Omit<SelectLook, "state">>> = {
  disabled: { face: GREYED.face, text: GREYED.text },
  normal: { face: "cream", text: "plum" },
  selected: { face: "yellow", text: "plum" },
};

// The disabled look drawn in code where the art has none: the flat grey face in its line,
// and its label.
export const DISABLED_COLORS = { edge: GREYED.edge, face: GREYED.face, text: GREYED.text } as const;

// A button's look: its interaction state, or secondary, the cream button a card's own
// controls wear in place of normal, with ui-button's secondary tags.
export type ButtonLook = ButtonState | "secondary";

// How ui-button colours each look: its face, the lip under a raised one, and the label.
// Primary is the green go button; disabled is flat, with no lip.
export const BUTTON_COLORS = {
  disabled: { face: DISABLED_COLORS.face, label: DISABLED_COLORS.text, lip: null },
  normal: { face: "cream", label: "plum", lip: "tan" },
  primary: { face: "green", label: "ink", lip: "forest" },
  secondary: { face: "cream", label: "plum", lip: "tan" },
} as const satisfies Record<ButtonLook, { face: string; label: string; lip: string | null }>;

// The plate a price or goal sits on: buy while the bank covers the price, short while it
// does not, goal for an item a goal unlocks or one that needs another bought first.
export type PlateKind = "buy" | "goal" | "short";

// A plate's 1px line, its face, the face's top (lit) and bottom (shade) rows where they
// differ from it, and its text.
export const PLATE_LOOKS = {
  buy: { edge: "ink", face: "green", lit: "yellow", shade: "forest", text: "ink" },
  goal: {
    edge: GREYED.edge,
    face: GREYED.plateFace,
    lit: null,
    shade: null,
    text: GREYED.plateText,
  },
  short: {
    edge: GREYED.edge,
    face: GREYED.plateFace,
    lit: null,
    shade: null,
    text: GREYED.shortPrice,
  },
} as const satisfies Record<
  PlateKind,
  { edge: string; face: string; lit: string | null; shade: string | null; text: string }
>;

// ui-select sits this far outside a selected item on each side by default; its inner ink
// line then lies on the item's edge.
export const SELECT_OUTSET = 3;

// ui-afford sits this far outside an affordable item on each side.
export const AFFORD_OUTSET = 2;

export function selectLook(state: TileState): SelectLook {
  return { ...LOOKS[state], state };
}

// The box behind an item's portrait or icon.
export type PictureBox = "deepAmber" | typeof GREYED.box | "tan";

// A picture's box, from its art: grey art sits on the grey box, and art in full color on the
// tan box an owned item has, or the deep amber one while picked. An item the player can buy now is
// a disabled tile with its art in color, so it sits on tan.
export function pictureBox(look: Pick<ItemLook, "art" | "state">): PictureBox {
  if (look.art === "grey") {
    return GREYED.box;
  }
  return look.state === "selected" ? "deepAmber" : "tan";
}
