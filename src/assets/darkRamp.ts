import { rampDown } from "@andornaut/game-kit/rgba";

import { ONE_STEP_DARKER } from "./housePalette";

// A colour moved steps down its ramp in the house palette, after snapping it to the palette (the
// kit's rampDown).
export function darkerRamp(steps: number): (colour: number) => number {
  return rampDown(ONE_STEP_DARKER, steps);
}
