// The art the heart change, hop splash and minor bump moments play. A moment whose art is
// missing plays without it.
export const FEEDBACK_ART = {
  // Coins bursting out at the pack.
  coinBurst: { key: "fx-coin-burst", tag: "play" },
  // The doghouse's flash as a lost heart lands, played on a second house over the slot's.
  doghouseLoss: { key: "ui-doghouse", tag: "heart-loss" },
  // The pop over the dog, then the small heart flying into the doghouse.
  heartGain: { fly: "fly", key: "fx-heart-gain", pop: "pop" },
  heartLoss: { fly: "fly", key: "fx-heart-loss", pop: "pop" },
  // At the pack's feet when an area effect catches no dog, with a comic HOP! in the tag's
  // -word version; reduced motion plays the plain tag.
  hopSplash: { key: "fx-hop-splash", tag: "splash", word: "-word" },
} as const;
