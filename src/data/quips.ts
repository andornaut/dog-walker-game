import type { DogId, Quips } from "./types";

// What each dog's owner says, in their temperament: two lines per moment. Placeholder lines.
// "happier" and "upset" follow a choice that raised or lowered their hearts; "fired" is at 0;
// "parting" is when the player picks their dog on the home screen.
export const QUIPS = {
  biscuit: {
    fired: ["No hard feelings, but Biscuit's taking a break.", "Let's call it here. You're fired."],
    happier: ["Nice one!", "Biscuit's tail says it all."],
    parting: ["He'll sniff every hedge. Let him.", "Snacks are in the left pocket."],
    upset: ["Eh, that's not great.", "Bit of a bummer, man."],
  },
  dash: {
    fired: ["This is a tragedy in one act. You're fired!", "Exit, pursued by my disapproval!"],
    happier: ["Bravo! Bravo!", "A standing ovation for you."],
    parting: ["Bring her back to me in one piece, I beg you!", "Mind her sweater. It's vintage."],
    upset: ["How could you?!", "I need to lie down on a chaise."],
  },
  duchess: {
    fired: ["I think we'll take a break, dear. You're fired.", "Duchess deserves calmer days."],
    happier: ["Lovely, just lovely.", "She's blooming."],
    parting: ["She likes to stop and smell the roses.", "Keep her bow straight, would you?"],
    upset: ["Oh dear, that's not ideal.", "Poor thing."],
  },
  koda: {
    fired: ["Hey, no worries, but you're fired.", "We'll find another pace. Fired."],
    happier: ["Good vibes!", "He loves a bit of action."],
    parting: ["He already did 10K. He's fine.", "He'll pull. Just let him run it off."],
    upset: ["Eh, not his favourite.", "Bit of a bummer."],
  },
  nugget: {
    fired: ["You are unfollowed and fired!", "This is the worst day of Nugget's career. Fired!"],
    happier: ["That's going on the feed!", "Iconic. Truly iconic."],
    parting: ["Get his good side. The followers are waiting!", "Tag me in everything."],
    upset: ["Not the content I wanted!", "I can't post this."],
  },
  pierre: {
    fired: ["That is quite enough. You are fired.", "Pierre will not be judged by you again."],
    happier: ["Acceptable.", "That will do."],
    parting: ["No puddles. I will check his paws.", "Pierre walks on the left. Always."],
    upset: ["That was not in the agreement.", "Points deducted."],
  },
  snowball: {
    fired: ["You've ruined everything! You're fired!", "The day is cancelled. So are you!"],
    happier: ["Picture perfect!", "Everything is going to plan!"],
    parting: ["Not a speck of mud. The whole day depends on it!", "She's the flower dog later!"],
    upset: ["This is a disaster!", "Not today of all days!"],
  },
  waffles: {
    fired: ["I'm afraid that's the end of the appointment. Fired.", "Fired. Please floss."],
    happier: ["Very good.", "A clean result."],
    parting: ["No sweets, please. Doctor's orders.", "He's due back by noon."],
    upset: ["That was careless.", "I'll make a note in his file."],
  },
  zippy: {
    fired: ["The numbers don't add up. You're fired.", "Your account is closed. Fired."],
    happier: ["That balances nicely.", "A sound decision."],
    parting: ["Back by four. I'll be timing you.", "Receipts for everything, please."],
    upset: ["That's a loss.", "I'm noting this down."],
  },
} as const satisfies Record<DogId, Quips>;
