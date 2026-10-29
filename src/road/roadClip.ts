// A road sprite stands on the road, which runs up to the juncture, the row where the road's
// junction meets the band's cross street. One whose ground row lies on the road below the
// juncture draws whole, its top over the band (a tree's canopy, a lamp's head), so it is seen
// from the moment it stands on the road. One whose ground row lies past the juncture shows
// nothing above that row. Roadside scenery, placed up to the juncture, fades in as it stands
// nearer, from the juncture to the road's far edge, so a tall prop does not blink in whole
// over the cross street.

import { clamp01 } from "@andornaut/game-kit/numbers";

// A drawn sprite: its frame's top row on screen, its frame height in its own pixels and its
// scale.
interface DrawnRows {
  readonly height: number;
  readonly scale: number;
  readonly top: number;
}

// How many of the frame's rows, from its top, lie above the juncture: 0 to height.
export function rowsAboveJuncture(juncture: number, drawn: DrawnRows): number {
  const hidden = Math.ceil((juncture - drawn.top) / drawn.scale - 1e-9);
  return Math.min(drawn.height, Math.max(0, hidden));
}

// How many of the frame's rows, from its top, to hide for a sprite whose ground is on screen
// row groundY: none once it stands on the road, else those above the juncture.
export function rowsHidden(juncture: number, groundY: number, drawn: DrawnRows): number {
  return groundY >= juncture ? 0 : rowsAboveJuncture(juncture, drawn);
}

// The opacity of a sprite whose ground is on screen row groundY: rising from 0 on the juncture
// to 1 on the road's far edge, farY, and 1 nearer.
export function fadeIn(juncture: number, farY: number, groundY: number): number {
  return clamp01((groundY - juncture) / (farY - juncture));
}
