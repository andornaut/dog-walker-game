import { clamp01 } from "../lib/numbers";
import type { Rect } from "../lib/rect";

// Beside a list longer than its view: a trackWidth-wide track at x, as tall as the view, and in
// it a thumbWidth-wide thumb thumbInset inside the track's edges, at least thumbMin tall.
export interface ScrollbarSpec {
  readonly thumbInset: number;
  readonly thumbMin: number;
  readonly thumbWidth: number;
  readonly trackWidth: number;
  readonly x: number;
}

// A scrollbar's track and the thumb in it.
export interface ScrollbarRects {
  readonly thumb: Rect;
  readonly track: Rect;
}

// The scrollbar's track and thumb for a list max pixels taller than view, scrolled y, or null
// for a list that fits. The thumb is as tall a share of the track's inside as the view is of
// the list.
export function scrollbarRects(
  spec: ScrollbarSpec,
  view: { readonly height: number; readonly y: number },
  max: number,
  y: number,
): ScrollbarRects | null {
  if (max <= 0) {
    return null;
  }
  const { thumbInset, thumbMin, thumbWidth, trackWidth, x } = spec;
  const inner = view.height - 2 * thumbInset;
  const height = Math.max(thumbMin, Math.round((inner * view.height) / (view.height + max)));
  const share = clamp01(y / max);
  return {
    thumb: {
      height,
      width: thumbWidth,
      x: x + thumbInset,
      y: view.y + thumbInset + Math.round((inner - height) * share),
    },
    track: { height: view.height, width: trackWidth, x, y: view.y },
  };
}
