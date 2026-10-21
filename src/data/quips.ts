import type { DogId, Quips } from "./types";

// What each dog's owner says, in their own voice: two lines per moment.
// "happier" and "upset" follow a choice that raised or lowered their hearts; "fired" is at 0;
// "parting" is when the player picks their dog on the home screen.
export const QUIPS = {
  archie: {
    fired: ["Oh, sweetheart. I have to let you go.", "No hard feelings, dear. You're fired."],
    happier: ["Look at him go! Lovely.", "You're a natural, pet."],
    parting: ["He'll want to say hello to everyone. Let him.", "There's a cookie for you after."],
    upset: ["Oh well, dear. Have a cookie.", "Never mind, dear. Tea fixes most things."],
  },
  biscuit: {
    fired: ["Last call, friend. I'm cutting you off.", "That's the last drop. You're fired."],
    happier: ["That walk was a latte fun, friend!", "Now that's a perfect pour."],
    parting: [
      "He sniffs every hedge like a coffee taster.",
      "He likes his walks like his espresso: strong.",
    ],
    upset: ["Oof. Bit of a bitter blend.", "Not my favorite roast, friend."],
  },
  duchess: {
    fired: ["My poor petal! You're fired!", "A catastrophe in full bloom! Fired!"],
    happier: ["Divine! She's simply blossoming!", "Oh, I could weep with joy!"],
    parting: ["She's as delicate as an orchid. Guard her!", "Her bow! Her bow must stay straight!"],
    upset: ["She's wilting! I can't bear it!", "My heart! My prize rose, trampled!"],
  },
  koda: {
    fired: ["Time to cool down. You're fired.", "This is where we split. You're fired."],
    happier: ["Good form! Keep it up!", "That's a personal best!"],
    parting: ["He already did 10K. He's fine.", "Warm-up's done. Keep that form tight!"],
    upset: ["Eh, bad split. Next lap's yours.", "Just a cramp. Shake it off."],
  },
  nugget: {
    fired: ["You're unfollowed. And fired!", "Worst day of Nugget's career. Fired!"],
    happier: ["That's going on the feed!", "Nugget is trending!"],
    parting: ["Get his good side. The followers are waiting!", "Tag me in everything."],
    upset: ["Not the content I wanted!", "I can't post this!"],
  },
  penny: {
    fired: ["Oh no, oh no. Sorry, but you're fired.", "So sorry! Here's a tissue. You're fired."],
    happier: ["Phew! Good, good.", "Oh, what a relief. Thank you!"],
    parting: [
      "I inspected the leash. Twice. Maybe check it?",
      "She gets lonely. Talk to her, please.",
    ],
    upset: ["Wait, wait. Let me check her again.", "Was that safe? Was she scared?"],
  },
  pierre: {
    fired: ["Disqualified. You are fired.", "Pepe withdraws from your care."],
    happier: ["Acceptable. Barely.", "Seven out of ten. Très bien."],
    parting: ["No puddles. I will check his paws.", "Posture, please. I deduct for slouching."],
    upset: ["Points deducted.", "That would never place at a show."],
  },
  snowball: {
    fired: ["You've ruined everything! You're fired!", "The day is canceled. So are you!"],
    happier: ["Picture perfect!", "Everything is going to plan!"],
    parting: ["Not a speck of mud. The whole day depends on it!", "She's the flower dog at two!"],
    upset: ["This is a disaster!", "Not today of all days!"],
  },
  zippy: {
    fired: ["The numbers don't add up. You're fired.", "Your account is closed. Fired."],
    happier: ["That balances nicely.", "A sound investment."],
    parting: ["Every bump goes in the ledger.", "Receipts for everything, please."],
    upset: ["That goes in the loss column.", "Noted. In red ink."],
  },
} as const satisfies Record<DogId, Quips>;
