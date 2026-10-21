// The art the heart change, hop splash and minor bump moments play. A moment whose art is
// missing plays without it.
export const FEEDBACK_ART = {
  // The card's flash over its hearts as a lost heart lands, played on a second card over it.
  cardLoss: { key: "ui-dog-card", tag: "heart-loss" },
  // The pop over the dog, then the small heart flying into its card.
  heartGain: { fly: "fly", key: "fx-heart-gain", pop: "pop" },
  heartLoss: { fly: "fly", key: "fx-heart-loss", pop: "pop" },
} as const;
