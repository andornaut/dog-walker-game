// The art the heart change, clean miss and minor bump moments play. A moment whose art is
// missing plays without it.
export const FEEDBACK_ART = {
  // Over the pack: a splash for a puddle, a puff for a skunk's cloud, each with a "PHEW!" in
  // its -word tag; reduced motion plays the plain tags.
  closeOne: { key: "fx-close-one", tags: { puddle: "splash", skunk: "puff" }, word: "-word" },
  // Coins bursting out at the pack.
  coinBurst: { key: "fx-coin-burst", tag: "play" },
  // The doghouse's flash as a lost heart lands, played on a second house over the slot's.
  doghouseLoss: { key: "ui-doghouse", tag: "heart-loss" },
  // The pop over the dog, then the small heart flying into the doghouse.
  heartGain: { fly: "fly", key: "fx-heart-gain", pop: "pop" },
  heartLoss: { fly: "fly", key: "fx-heart-loss", pop: "pop" },
} as const;
