// How a tile, tab or row shows its interaction state, as ui-tile draws it: normal is cream,
// selected gold, disabled flat grey. Colours are the scenes' PALETTE names.
import type { ButtonState, TileState } from "./interaction";

export interface SelectLook {
  // The box behind a portrait or icon.
  box: "amber" | "slate" | "tan";
  face: "cream" | "grey" | "yellow";
  // A locked item's price.
  price: "forest" | "navy";
  state: TileState;
  text: "darkSlate" | "plum";
}

// Text on each face: plum on cream (9.42:1) and yellow (10.92); on grey, a disabled label is
// darkSlate (3.39, exempt as disabled) and a price navy (4.93), which says why it is
// disabled.
const LOOKS: Readonly<Record<TileState, Omit<SelectLook, "state">>> = {
  disabled: { box: "slate", face: "grey", price: "navy", text: "darkSlate" },
  normal: { box: "tan", face: "cream", price: "forest", text: "plum" },
  selected: { box: "amber", face: "yellow", price: "forest", text: "plum" },
};

// The disabled look drawn in code where the art has none: the flat grey face in a slate
// line, and its label.
export const DISABLED_COLORS = { edge: "slate", face: "grey", text: "darkSlate" } as const;

// A button's look: its interaction state, or secondary, the tan button a card's own
// controls wear in place of normal.
export type ButtonLook = ButtonState | "secondary";

// How ui-button colours each look: its face, the lip under a raised one, and the label.
// Primary is the green go button; disabled is flat, with no lip.
export const BUTTON_COLORS = {
  disabled: { face: DISABLED_COLORS.face, label: DISABLED_COLORS.text, lip: null },
  normal: { face: "cream", label: "plum", lip: "tan" },
  primary: { face: "green", label: "ink", lip: "forest" },
  secondary: { face: "tan", label: "plum", lip: "brown" },
} as const satisfies Record<ButtonLook, { face: string; label: string; lip: string | null }>;

// A choice is full when nothing more can be picked: the pack holds its capacity.
export function choiceFull(picked: number, capacity: number): boolean {
  return picked >= capacity;
}

export function selectLook(state: TileState): SelectLook {
  return { ...LOOKS[state], state };
}
