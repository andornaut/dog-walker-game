import type { Rect } from "../layout/rect";

// The walker's speech bubble: centred on x at the given top, moved left when it is tall enough
// to reach the Pet shop's board so it ends clear of it by clearance, and kept margin from the
// screen's left edge.
export function bubbleRect(
  keepClear: Rect,
  sizes: { clearance: number; margin: number },
  at: { x: number; y: number },
  size: { height: number; width: number },
): Rect {
  const centred = Math.round(at.x - size.width / 2);
  const reaches = at.y + size.height >= keepClear.y;
  const left = reaches ? Math.min(centred, keepClear.x - sizes.clearance - size.width) : centred;
  return { ...size, x: Math.max(sizes.margin, left), y: at.y };
}
