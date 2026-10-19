// The selected and active state from the art style guide, for anything picked, equipped,
// toggled on or open: its face turns yellow, and when its choice is full the items left
// unpicked darken one ramp step. Colours are the scenes' PALETTE names.

// What an item's face shows while unpicked and nothing forces it darker.
export type RestFace = "cream" | "tan";

export type Face = "brown" | "cream" | "tan" | "yellow";

const DARKENED: Readonly<Record<RestFace, Face>> = { cream: "tan", tan: "brown" };

// The box behind a portrait or icon on a face sits one ramp step darker than the face.
const BOX: Readonly<Record<Face, "amber" | "brown" | "darkBrown" | "tan">> = {
  brown: "darkBrown",
  cream: "tan",
  tan: "brown",
  yellow: "amber",
};

export interface SelectLook {
  box: (typeof BOX)[Face];
  face: Face;
  selected: boolean;
  // Text on the face: plum on yellow (9:1), cream (9.42) or tan (6.49), and ink on brown
  // (4.65), where plum falls to 3.5.
  text: "ink" | "plum";
}

// A choice is full when nothing more can be picked: the pack holds its capacity, a gear item
// is equipped, or a one-of choice such as the walker or a tab has its pick.
export function choiceFull(picked: number, capacity: number): boolean {
  return picked >= capacity;
}

export function selectLook(rest: RestFace, selected: boolean, full: boolean): SelectLook {
  const face = selected ? "yellow" : full ? DARKENED[rest] : rest;
  return { box: BOX[face], face, selected, text: face === "brown" ? "ink" : "plum" };
}
