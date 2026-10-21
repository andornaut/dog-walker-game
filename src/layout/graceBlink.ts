// The pack blinks while the grace window after a hit lets obstacles pass through it, so a pass
// reads as meant: shown for blinkSeconds, then hidden for blinkSeconds, from the window's start,
// which the hit stop holds, so the pack shows through the stop and blinks once the walk goes on.
// With reduced motion it stays dimmed to dimAlpha for the whole window instead.
export interface GraceBlink {
  readonly blinkSeconds: number;
  readonly dimAlpha: number;
}

export const GRACE_BLINK: GraceBlink = { blinkSeconds: 0.07, dimAlpha: 0.5 };

// The pack's alpha with windowSeconds of grace a hit opens and remainingSeconds of it left.
export function graceAlpha(
  blink: GraceBlink,
  still: boolean,
  windowSeconds: number,
  remainingSeconds: number,
): number {
  if (remainingSeconds <= 0) {
    return 1;
  }
  if (still) {
    return blink.dimAlpha;
  }
  const elapsed = Math.max(0, windowSeconds - remainingSeconds);
  return Math.floor(elapsed / blink.blinkSeconds + 1e-9) % 2 === 0 ? 1 : 0;
}
