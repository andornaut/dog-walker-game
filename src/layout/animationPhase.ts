// A looping animation's frame at simulation time. Query order never advances an animation.
export function animationPhaseAt(durations: readonly number[], milliseconds: number): number {
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  if (!(total > 0)) {
    return 0;
  }
  let remaining = ((milliseconds % total) + total) % total;
  for (const [index, duration] of durations.entries()) {
    if (remaining < duration) {
      return index;
    }
    remaining -= duration;
  }
  return 0;
}
