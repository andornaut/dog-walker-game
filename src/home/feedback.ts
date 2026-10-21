// The home screen's tap feedback, from the art style guide and the start-screen mock: offsets
// in pixels and animation frames, each a function of how long ago its effect started. With
// reduced motion every movement is 0 and the pulse holds its first frame; the press dip,
// the picked lift and the tap sparkle stay, as in the mock, since they show the tap landed.
// A tap shows in order: the dip and the sparkle at once, then the result once the dip is over.

export const FEEDBACK = {
  // A picked tile's or the badge's rise, and the badge's pop on pick.
  badgePopMs: 200,
  badgePopPx: 3,
  // Ready Start walk rises 1px on every other beat.
  bobBeatMs: 600,
  // The Start walk face sinks this far into its lip while pressed.
  buttonPressPx: 4,
  // fx-dust plays at the gate when a dog joins the pack, if the screen is drawn within this
  // long of it joining.
  dustFrameMs: 80,
  hopMs: 480,
  hopPx: 4,
  liftPx: 2,
  pressDipMs: 140,
  pressDipPx: 2,
  shakeMs: 320,
  shakePx: 3,
  // The Pet shop's glint plays once every shopGlintEveryMs, and its building rises 1px then 2px
  // and back, a step each shopBobBeatMs.
  shopBobBeatMs: 500,
  shopBobSteps: [0, -1, -2, -1],
  shopGlintEveryMs: 4000,
  shopGlintFrameMs: 60,
  shopGlintFrames: 7,
} as const;

// How long ago an effect started, or Infinity for one that never did.
function age(nowMs: number, startedMs: number | undefined): number {
  return startedMs === undefined ? Number.POSITIVE_INFINITY : nowMs - startedMs;
}

// A refused tap: the tile swings side to side.
export function shakeOffset(
  reducedMotion: boolean,
  nowMs: number,
  startedMs: number | undefined,
): number {
  const elapsed = age(nowMs, startedMs);
  if (reducedMotion || elapsed >= FEEDBACK.shakeMs) {
    return 0;
  }
  return Math.round(Math.sin(elapsed / 25) * FEEDBACK.shakePx) || 0;
}

// A picked face, or a dog at the gate, hops twice: negative is up.
export function hopOffset(
  reducedMotion: boolean,
  nowMs: number,
  startedMs: number | undefined,
): number {
  const elapsed = age(nowMs, startedMs);
  if (reducedMotion || elapsed >= FEEDBACK.hopMs) {
    return 0;
  }
  const phase = (elapsed / FEEDBACK.hopMs) * Math.PI * 2;
  return -Math.round(Math.abs(Math.sin(phase)) * FEEDBACK.hopPx) || 0;
}

// The pick badge drops in from a little higher.
export function badgePopOffset(
  reducedMotion: boolean,
  nowMs: number,
  startedMs: number | undefined,
): number {
  return !reducedMotion && age(nowMs, startedMs) < FEEDBACK.badgePopMs ? -FEEDBACK.badgePopPx : 0;
}

// A press dips its tile for a moment, and for as long as the finger stays down.
export function pressDip(held: boolean, nowMs: number, startedMs: number | undefined): number {
  return held || age(nowMs, startedMs) < FEEDBACK.pressDipMs ? FEEDBACK.pressDipPx : 0;
}

// How long after nowMs a press's result waits so its dip shows first: the rest of the dip
// that started at startedMs, or 0 once it is over.
export function settleDelay(nowMs: number, startedMs: number): number {
  return Math.max(0, startedMs + FEEDBACK.pressDipMs - nowMs);
}

// The frame a looping tag, such as ui-select's pulse, shows at nowMs given each frame's
// duration; the first frame with reduced motion.
export function loopFrame(
  reducedMotion: boolean,
  durationsMs: readonly number[],
  nowMs: number,
): number {
  const total = durationsMs.reduce((sum, ms) => sum + ms, 0);
  if (reducedMotion || total <= 0) {
    return 0;
  }
  let into = nowMs % total;
  for (const [i, ms] of durationsMs.entries()) {
    if (into < ms) {
      return i;
    }
    into -= ms;
  }
  return 0;
}

// The ready Start walk button's rise: -1 on alternate beats, 0 while pressed or not ready.
export function bobOffset(reducedMotion: boolean, nowMs: number, ready: boolean): number {
  if (reducedMotion || !ready) {
    return 0;
  }
  return Math.floor(nowMs / FEEDBACK.bobBeatMs) % 2 === 1 ? -1 : 0;
}

// The Pet shop's glint frame at nowMs, or undefined between glints and with reduced motion.
export function shopGlintFrame(reducedMotion: boolean, nowMs: number): number | undefined {
  if (reducedMotion) {
    return undefined;
  }
  return effectFrame(
    FEEDBACK.shopGlintFrameMs,
    FEEDBACK.shopGlintFrames,
    nowMs % FEEDBACK.shopGlintEveryMs,
    0,
  );
}

// The Pet shop's rise at nowMs: a gentle bob upward, none with reduced motion.
export function shopBobOffset(reducedMotion: boolean, nowMs: number): number {
  if (reducedMotion) {
    return 0;
  }
  const steps = FEEDBACK.shopBobSteps;
  return steps[Math.floor(nowMs / FEEDBACK.shopBobBeatMs) % steps.length] ?? 0;
}

// The frame of a one-shot effect, or undefined once it has played out.
export function effectFrame(
  frameMs: number,
  frames: number,
  nowMs: number,
  startedMs: number,
): number | undefined {
  const frame = Math.floor(age(nowMs, startedMs) / frameMs);
  return frame >= 0 && frame < frames ? frame : undefined;
}
