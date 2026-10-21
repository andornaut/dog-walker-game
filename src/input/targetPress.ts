// A press on a target acts on its release over the same target. A target that dips shows
// pressed for at least its dip, counted from the press, so a quick tap's act waits for the
// dip to end.
export interface TargetPressRule<T> {
  // How long a tapped target dips before it acts: 0 acts at once.
  readonly dipMs: (target: T) => number;
  readonly same: (a: T, b: T) => boolean;
}

export interface TargetPress<T> {
  readonly startedMs: number;
  readonly target: T;
}

type TargetRelease<T> =
  | { readonly kind: "none" }
  | { readonly delayMs: number; readonly kind: "tap"; readonly target: T };

const NONE = { kind: "none" } as const;

// A press that lands on no target presses nothing.
export function pressDown<T>(nowMs: number, target: T | undefined): TargetPress<T> | undefined {
  return target === undefined ? undefined : { startedMs: nowMs, target };
}

// released is the target under the release. cancelled: the browser called the press off,
// so it taps nothing.
export function pressUp<T>(
  rule: TargetPressRule<T>,
  nowMs: number,
  cancelled: boolean,
  press: TargetPress<T> | undefined,
  released: T | undefined,
): TargetRelease<T> {
  if (cancelled || press === undefined || released === undefined) {
    return NONE;
  }
  if (!rule.same(press.target, released)) {
    return NONE;
  }
  const delayMs = Math.max(0, press.startedMs + rule.dipMs(press.target) - nowMs);
  return { delayMs, kind: "tap", target: press.target };
}
