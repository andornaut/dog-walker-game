// The Skip card's illustration, which no option in the data names.
export const SKIP_CARD_ART = "card-skip";

// CLEANUP (added 2026-10-28): the drawn card art each undrawn option's art key shows until its
// own loads. Remove an entry once its key is in the manifest, and the table once it is empty.
const CARD_ART_STAND_INS: Readonly<Record<string, string>> = {
  "card-thief-give-chase": "card-thief-chase",
  "card-thief-grab-back": "card-thief-chase",
};

// The keys a card option's art may draw, in preference order.
export function cardArtKeysOf(art: string): readonly string[] {
  const standIn = CARD_ART_STAND_INS[art];
  return standIn === undefined ? [art] : [art, standIn];
}
