import type { DogId, Quips } from "./types";

// What each dog's owner says, in their temperament: two lines per moment.
// "happier" and "upset" follow a choice that raised or lowered their hearts; "fired" is at 0;
// "parting" is when the player picks their dog on the home screen.
export const QUIPS = {
  archie: {
    fired: ["Oh, sweetheart. I have to let you go.", "No hard feelings, dear. You're fired."],
    happier: ["Look at him go! Lovely.", "You're a natural, pet."],
    parting: ["He'll want to play with everyone. Let him.", "There's a cookie for you after."],
    upset: ["Oh well, these things happen.", "Never mind, dear. Next time."],
  },
  biscuit: {
    fired: ["No hard feelings, but you're fired.", "Last call, friend. You're fired."],
    happier: ["Nice! Biscuit's tail says it all.", "That's brewing nicely."],
    parting: ["He'll sniff every hedge. Let him.", "Snacks are in the left pocket."],
    upset: ["Eh, bit of a bitter one.", "Not my favourite blend, man."],
  },
  duchess: {
    fired: ["My poor petal! You're fired!", "A catastrophe in full bloom! Fired!"],
    happier: ["Divine! She's simply blossoming!", "Oh, I could weep with joy!"],
    parting: ["She's as delicate as an orchid. Guard her!", "Her bow! Her bow must stay straight!"],
    upset: ["She's wilting! I can't bear it!", "My heart! My poor petal!"],
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
  penny: {
    fired: ["Oh no, oh no. Sorry, but you're fired.", "I'm so sorry. You're fired."],
    happier: ["Phew! Good, good.", "Oh, what a relief. Thank you!"],
    parting: [
      "Is the leash tight? Check it twice, please.",
      "She gets lonely. Don't leave her alone.",
    ],
    upset: ["Oh dear, oh dear.", "Was that safe? Was she scared?"],
  },
  pierre: {
    fired: ["Disqualified. You are fired.", "Pepe withdraws from your care."],
    happier: ["Acceptable. Barely.", "Seven out of ten."],
    parting: ["No puddles. I will check his paws.", "Pepe walks on the left. Always."],
    upset: ["Points deducted.", "That would never pass inspection."],
  },
  snowball: {
    fired: ["You've ruined everything! You're fired!", "The day is cancelled. So are you!"],
    happier: ["Picture perfect!", "Everything is going to plan!"],
    parting: ["Not a speck of mud. The whole day depends on it!", "She's the flower dog at two!"],
    upset: ["This is a disaster!", "Not today of all days!"],
  },
  zippy: {
    fired: ["The numbers don't add up. You're fired.", "Your account is closed. Fired."],
    happier: ["That balances nicely.", "A sound investment."],
    parting: ["Back by four. I'll be timing you.", "Receipts for everything, please."],
    upset: ["That's a loss.", "Noted. In red ink."],
  },
} as const satisfies Record<DogId, Quips>;
