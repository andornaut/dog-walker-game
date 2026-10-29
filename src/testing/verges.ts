import { itemAt } from "@andornaut/game-kit/arrays";

import { LIGHTS } from "../road/lights";

// A light art sets out, whichever it is, so the fixture follows renames.
export const SOME_LIGHT = itemAt([...LIGHTS.keys()], 0);

// A paved verge as art writes it in shared/verges.json, with colours by palette name and a light
// every 128 along its paving, staggered between the sides.
export const PAVED_VERGE = {
  curbColour: "stone",
  curbTo: 164,
  lawn: "none",
  lawnColours: null,
  leaves: false,
  pools: [{ across: 170, every: 128, light: SOME_LIGHT, offset: { left: 0, right: 64 } }],
  seamColour: "grey",
  seamEvery: 32,
  strips: [],
  walkColour: "lgrey",
  walkDots: [{ colours: ["grey"], share: 0.1 }],
  walkTo: null,
};
