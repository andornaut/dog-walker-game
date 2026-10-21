// A road sprite draws over the backdrop band wherever it stands on the road below the
// juncture, the row where the road's approach meets the band's cross street, and nothing of it
// shows above that row. So an item is seen from the moment any of it stands below the
// juncture: as it comes into view at the far edge, rather than once it clears the band.

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
