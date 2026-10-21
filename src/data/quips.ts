import type { DogId, Quips } from "./types";

// What each dog's owner says, in their own voice: two lines per moment.
// "happier" and "upset" follow a choice that raised or lowered their hearts; "fired" is at 0;
// "parting" is when the player picks their dog on the home screen.
export const QUIPS = {
  archie: {
    fired: ["Oh, sweetheart. We're done.", "No hard feelings. Cookie?"],
    happier: ["Look at him go! Lovely.", "You're a natural, pet."],
    parting: ["He'll want to say hello to everyone. Let him.", "There's a cookie for you after."],
    upset: ["Oh well, pet. Chin up.", "Never mind, dear. Tea fixes most things."],
  },
  biscuit: {
    fired: ["You've been decaffeinated.", "Last drop. We're closed."],
    happier: ["This walk is a latte fun, friend!", "Now that's a perfect pour."],
    parting: [
      "He sniffs every hedge like a coffee taster.",
      "He likes his walks like his espresso: strong.",
    ],
    upset: ["Oof. Bit of a bitter blend.", "Not my favorite roast, friend."],
  },
  duchess: {
    fired: ["Consider yourself pruned!", "A catastrophe in full bloom!"],
    happier: ["Divine! She's simply blossoming!", "Oh, I could weep with joy!"],
    parting: ["She's delicate. Guard her!", "Keep her bow straight!"],
    upset: ["She's wilting! I can't bear it!", "My heart! My prize rose, trampled!"],
  },
  koda: {
    fired: ["I'll run him home. Bye.", "This is where we split."],
    happier: ["Good form! Keep it up!", "That's a personal best!"],
    parting: ["He already did 10K. He's fine.", "Warm-up's done. Keep that form tight!"],
    upset: ["Eh, bad lap. Shake it off.", "Just a cramp. Back to your pace."],
  },
  nugget: {
    fired: ["You're unfollowed. And fired!", "Blocked! Worst day ever."],
    happier: ["That's going on the feed!", "Nugget is trending!"],
    parting: ["Get his good side. The followers are waiting!", "Tag me in everything."],
    upset: ["Not the content I wanted!", "I can't post this!"],
  },
  penny: {
    fired: ["Oh no, oh no. You're fired.", "So sorry! Here's a tissue."],
    happier: ["Phew! Good, good.", "Oh, what a relief. Thank you!"],
    parting: [
      "I inspected the leash. Twice. Maybe check it?",
      "She gets lonely. Talk to her, please.",
    ],
    upset: ["Wait, wait. Let me check her again.", "Was that safe? Was she scared?"],
  },
  pierre: {
    fired: ["Disqualified. You are fired.", "Pepe withdraws. Adieu."],
    happier: ["Acceptable. Barely.", "Seven out of ten. C'est bien."],
    parting: ["No puddles. I will check his paws.", "Posture! I deduct for slouching."],
    upset: ["Non. Points deducted.", "That would never place at a show."],
  },
  snowball: {
    fired: ["Off the guest list! Now!", "Ugh! The day is canceled!"],
    happier: ["Picture perfect!", "Everything is going to plan!"],
    parting: ["No mud, no fuss. Big day!", "Flower dog at two!"],
    upset: ["This is a disaster!", "Not today of all days!"],
  },
  zippy: {
    fired: ["The numbers don't add up.", "Account closed. Balance: $0."],
    happier: ["That balances nicely.", "A sound investment."],
    parting: ["Every bump goes in the ledger.", "Receipts for everything, please."],
    upset: ["That goes in the loss column.", "Noted. In red ink."],
  },
} as const satisfies Record<DogId, Quips>;
