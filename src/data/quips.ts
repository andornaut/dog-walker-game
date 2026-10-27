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
    fired: ["I think we need some space.", "Let's end the session here."],
    happier: ["He seems really calm with you.", "That's a good sign. Thank you."],
    parting: ["He's a little shy at first. Give him time.", "Let him sniff. It helps him settle."],
    upset: ["Oh. That's okay. We'll work through it.", "Hm. Let's not dwell on it."],
  },
  buddy: {
    fired: ["I'll run him home. Bye.", "This is where we split."],
    happier: ["Good form! Keep it up!", "That's a personal best!"],
    parting: ["He already did 10K. He's fine.", "Warm-up's done. Keep that form tight!"],
    upset: ["Eh, bad lap. Shake it off.", "Just a cramp. Back to your pace."],
  },
  duchess: {
    fired: ["You're unfollowed. And fired!", "Blocked! Worst day ever."],
    happier: ["That's going on the feed!", "Duchess is trending!"],
    parting: ["Get her good side!", "Tag me in everything."],
    upset: ["Not the content I wanted!", "I can't post this!"],
  },
  kilo: {
    fired: ["Flight's grounded. Go home.", "Mayday. We're done."],
    happier: ["Smooth flying. Good.", "Not bad. Carry on."],
    parting: ["He pulls hard. Hold on.", "Wheels up. Don't dawdle."],
    upset: ["Rough landing. Again.", "Hmph. Turbulence."],
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
  reggie: {
    fired: ["Structural failure. We're done.", "I'm decommissioning this walk."],
    happier: ["Smooth operation. Well built.", "Right on spec. Nice work."],
    parting: ["Check the leash tension.", "He runs best at a steady pace."],
    upset: ["That's a design flaw.", "Back to the drawing board."],
  },
  snowball: {
    fired: ["Game, set, match. You're out.", "Double fault. Goodbye."],
    happier: ["Ace! Lovely footwork.", "That's match point form."],
    parting: ["Light on your feet, dear.", "Keep your eye on the ball."],
    upset: ["Out! That was out!", "Unforced error, dear."],
  },
} as const satisfies Record<DogId, Quips>;
