import type { DogId, Quips } from "./types";

// What each dog's owner says, in their temperament: two lines per moment.
// "happier" and "upset" follow a choice that raised or lowered their hearts; "fired" is at 0;
// "parting" is when the player picks their dog on the home screen.
export const QUIPS = {
  biscuit: {
    fired: ["No hard feelings, but you're fired.", "Last call, friend. You're fired."],
    happier: ["Nice! Biscuit's tail says it all.", "That's brewing nicely."],
    parting: ["He'll sniff every hedge. Let him.", "Snacks are in the left pocket."],
    upset: ["Eh, bit of a bitter one.", "Not my favourite blend, man."],
  },
  dash: {
    fired: ["A tragedy in one act. You're fired!", "Exit, pursued by my disapproval!"],
    happier: ["Bravo! Bravo!", "A standing ovation for you!"],
    parting: ["Bring him back in one piece, I beg you!", "Mind his bandana. It's vintage."],
    upset: ["How could you?!", "I need to lie down on a chaise."],
  },
  duchess: {
    fired: ["Time to repot, dear. You're fired.", "Duchess needs a gentler gardener."],
    happier: ["She's in full bloom!", "Lovely. Just lovely, dear."],
    parting: ["She likes to stop and smell the roses.", "Keep her bow straight, would you?"],
    upset: ["Oh dear. A wilted moment.", "Poor petal."],
  },
  koda: {
    fired: ["No worries, but you're fired.", "We'll find another pace. Fired."],
    happier: ["Good vibes!", "That's a personal best!"],
    parting: ["He already did 10K. He's fine.", "He'll pull. Let him run it off."],
    upset: ["Eh, rough patch.", "Just a cramp. Shake it off."],
  },
  nugget: {
    fired: ["You're unfollowed. And fired!", "Worst day of Nugget's career. Fired!"],
    happier: ["That's going on the feed!", "Nugget is trending!"],
    parting: ["Get his good side. The followers are waiting!", "Tag me in everything."],
    upset: ["Not the content I wanted!", "I can't post this!"],
  },
  pierre: {
    fired: ["Disqualified. You are fired.", "Pierre withdraws from your care."],
    happier: ["Acceptable. Barely.", "Seven out of ten."],
    parting: ["No puddles. I will check his paws.", "Pierre walks on the left. Always."],
    upset: ["Points deducted.", "That would never pass inspection."],
  },
  snowball: {
    fired: ["You've ruined everything! You're fired!", "The day is cancelled. So are you!"],
    happier: ["Picture perfect!", "Everything is going to plan!"],
    parting: ["Not a speck of mud. The whole day depends on it!", "She's the flower dog at two!"],
    upset: ["This is a disaster!", "Not today of all days!"],
  },
  waffles: {
    fired: ["That's the end of the appointment. Fired.", "You're fired. And please floss."],
    happier: ["Very good. A clean result.", "Now that's a smile."],
    parting: ["No sweets, please. Doctor's orders.", "She's due back by noon."],
    upset: ["That was careless.", "I'll make a note in her chart."],
  },
  zippy: {
    fired: ["The numbers don't add up. You're fired.", "Your account is closed. Fired."],
    happier: ["That balances nicely.", "A sound investment."],
    parting: ["Back by four. I'll be timing you.", "Receipts for everything, please."],
    upset: ["That's a loss.", "Noted. In red ink."],
  },
} as const satisfies Record<DogId, Quips>;
