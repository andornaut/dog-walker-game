// The HUD's layers. Bottom to top: a bump's tint, the message strip, the parts with no depth
// (the walk bar, the dog cards and their hearts, at 0), what draws over a part, the money chips
// under the cash, the owners' tabs,
// the moments, the fired lines, the heart pops, the message strip over a card or the pause menu,
// an explanation's detail card and a bump's border. A layer of several parts stacks them from its
// depth up.
export const HUD_DEPTH = {
  // A bump's border, over everything.
  bumpBorder: 3000,
  // A bump's tint, under every part of the HUD, the message strip included.
  bumpTint: -2,
  // A money label's chip hanging under the cash, over the message strip, the debuff bars and the
  // neighbourhood pill, its text a depth over it.
  cashChip: 10,
  // An explanation's detail card, over every other part of the HUD but a bump's border, and over
  // the pause menu's panel and the message strip drawn there.
  detail: 2000,
  // A fired line's bubble: each takes its own depth pair over the moments, panel then text, so
  // two lines up at once never interleave.
  firedLine: 52,
  // A heart's pop and flight, over the cards and the HUD's own labels.
  heart: 60,
  // The message strip, under the HUD's other parts.
  message: -1,
  // The message strip when it draws over a card's or the pause menu's parts.
  messageOverlay: 1000,
  // The firing, payout and other moments, over the cards, labels and owners' tabs.
  moment: 50,
  // The debuff bars' fills, and a change label's text over its chip.
  overPart: 1,
  // An owner's tab, over the cards and their heart-loss flash.
  ownerTab: 30,
} as const;
