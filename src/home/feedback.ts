// The home screen's tap feedback, from the art style guide and the start-screen mock: offsets
// in pixels and animation frames, each a function of how long ago its effect started. With
// reduced motion every movement is 0 and the pulse holds its first frame; the press dip,
// the picked lift and the tap sparkle stay, as in the mock, since they show the tap landed.

export const FEEDBACK = {
  // A picked tile's or the badge's rise, and the badge's pop on pick.
  badgePopMs: 200,
  badgePopPx: 3,
  // Ready Start walk rises 1px on every other beat.
  bobBeatMs: 600,
  // The Start walk face sinks this far into its lip while pressed.
  buttonPressPx: 4,
  // fx-dust frames at the gate when a dog joins the pack.
  dustFrameMs: 80,
  dustFrames: 4,
  hopMs: 480,
  hopPx: 4,
  liftPx: 2,
  pressDipMs: 140,
  pressDipPx: 2,
  pulseFrameMs: 450,
  shakeMs: 320,
  shakePx: 3,
  // fx-tap frames where the finger lands.
  tapFrameMs: 60,
  tapFrames: 4,
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

// The ui-select frame to show: 0 or 1, alternating.
export function pulseFrame(reducedMotion: boolean, nowMs: number): number {
  return reducedMotion ? 0 : Math.floor(nowMs / FEEDBACK.pulseFrameMs) % 2;
}

// The ready Start walk button's rise: -1 on alternate beats, 0 while pressed or not ready.
export function bobOffset(reducedMotion: boolean, nowMs: number, ready: boolean): number {
  if (reducedMotion || !ready) {
    return 0;
  }
  return Math.floor(nowMs / FEEDBACK.bobBeatMs) % 2 === 1 ? -1 : 0;
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
