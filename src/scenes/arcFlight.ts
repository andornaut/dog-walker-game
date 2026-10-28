import type { Types } from "phaser";

import { curvePoint } from "../hud/moments";
import type { Point } from "../lib/rect";

// A tween's config that moves along the quadratic curve from path.from to path.to, pulled toward
// path.control, over tween.duration: place gets each update's point, rounded to whole pixels.
export function arcFlight(
  path: { readonly control: Point; readonly from: Point; readonly to: Point },
  tween: { duration: number; ease?: string; onComplete: () => void },
  place: (point: Point) => void,
): Types.Tweens.TweenBuilderConfig {
  const progress = { t: 0 };
  return {
    ...tween,
    onUpdate: () => {
      const point = curvePoint(path.from, path.control, path.to, progress.t);
      place({ x: Math.round(point.x), y: Math.round(point.y) });
    },
    t: 1,
    targets: progress,
  };
}
