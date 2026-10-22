// The pack blinks while the grace window after a hit lets obstacles pass through it, so a pass
// reads as meant: shown for blinkSeconds, then hidden for blinkSeconds, from the window's start,
// which the hit stop holds, so the pack shows through the stop and blinks once the walk goes on.
// With reduced motion it stays dimmed to dimAlpha for the whole window instead.
export const GRACE_BLINK = { blinkSeconds: 0.07, dimAlpha: 0.5 } as const;

// The pack's alpha with windowSeconds of grace a hit opens and remainingSeconds of it left.
export function graceAlpha(
  still: boolean,
  windowSeconds: number,
  remainingSeconds: number,
): number {
  if (remainingSeconds <= 0) {
    return 1;
  }
  if (still) {
    return GRACE_BLINK.dimAlpha;
  }
  const elapsed = Math.max(0, windowSeconds - remainingSeconds);
  return Math.floor(elapsed / GRACE_BLINK.blinkSeconds + 1e-9) % 2 === 0 ? 1 : 0;
}
