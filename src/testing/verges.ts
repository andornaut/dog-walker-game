// A paved verge as art writes it in shared/verges.json, with colours by palette name and pools
// of light staggered between the sides: an ellipse with a stone edge round a cream core.
export const PAVED_VERGE = {
  curbColour: "stone",
  curbTo: 164,
  lawn: "none",
  lawnColours: null,
  leaves: false,
  pools: [
    {
      coreColour: "cream",
      edgeColour: "dstone",
      edgeWidth: 4,
      every: 128,
      from: 168,
      length: 48,
      offset: { left: 0, right: 64 },
      shape: "ellipse",
      to: 200,
    },
  ],
  seamColour: "grey",
  seamEvery: 32,
  strips: [],
  walkColour: "lgrey",
  walkDots: [{ colours: ["grey"], share: 0.1 }],
  walkTo: null,
};
