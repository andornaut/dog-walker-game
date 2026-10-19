import type { Quips, Temperament } from "./types";

// What an owner says after a card choice, by temperament. Placeholder lines.
// "happier" and "upset" follow a choice that raised or lowered their hearts; "fired" is at 0.
export const QUIPS = {
  dramatic: {
    fired: ["This is the worst day of my life. You're fired!", "I simply cannot go on. Fired!"],
    happier: ["My heart is full!", "Iconic. Truly iconic."],
    upset: ["How could you?!", "I need to lie down."],
  },
  fussy: {
    fired: ["That is quite enough. You're fired.", "I'll be writing a review. Fired."],
    happier: ["Acceptable.", "That will do."],
    upset: ["That was not in the agreement.", "I'm noting this down."],
  },
  laidBack: {
    fired: ["Hey, no hard feelings, but you're fired.", "I think we'll take a break. Fired."],
    happier: ["Nice one!", "Good vibes."],
    upset: ["Eh, that's not great.", "Bit of a bummer."],
  },
} as const satisfies Record<Temperament, Quips>;
