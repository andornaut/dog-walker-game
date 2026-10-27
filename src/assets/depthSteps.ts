import table from "../../shared/depth-steps.json";

// A road sprite's depth steps, from shared/depth-steps.json, which art's tools read too. Each
// step's art is the sprite's key plus the step's suffix: dog-kilo@88 is dog-kilo at 0.875.
// Full size, with no suffix, comes first, then each smaller step in turn.
interface DepthStep {
  readonly scale: number;
  readonly suffix: string;
}

export const DEPTH_STEPS: readonly DepthStep[] = table.steps;

// A frame side at a step, by the table's size rule: the nearest pixel, with halves rounding up.
export function stepSize(full: number, scale: number): number {
  return Math.floor(full * scale + 0.5);
}

export function depthStepOfScale(scale: number): DepthStep {
  const step = DEPTH_STEPS.find((entry) => entry.scale === scale);
  if (step === undefined) {
    throw new RangeError(`${scale} is not a depth step`);
  }
  return step;
}

// A key's base sprite and the step it is drawn for: dog-kilo@88 is dog-kilo at 0.875, and a
// key without a step's suffix is its own base at full size.
export function splitDepthKey(key: string): { base: string; step: DepthStep } {
  for (const step of DEPTH_STEPS) {
    if (step.suffix !== "" && key.endsWith(step.suffix)) {
      return { base: key.slice(0, -step.suffix.length), step };
    }
  }
  return { base: key, step: depthStepOfScale(1) };
}
