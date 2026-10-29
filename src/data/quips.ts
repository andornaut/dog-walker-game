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
    happier: ["He seems calm with you.", "A good sign. Thank you."],
    parting: ["He's a little shy at first. Give him time.", "Let him sniff. It helps him settle."],
    upset: ["Oh. That's okay. We'll work through it.", "Hm. Let's not dwell on it."],
  },
  buddy: {
    fired: ["Off my lawn. For good.", "That's it. Mowed down."],
    happier: ["Tidy, like a fresh cut.", "Now that's a clean edge!"],
    parting: ["He loves fresh grass. Let him sniff.", "Keep him off the flower beds."],
    upset: ["That's a patchy job.", "Weeds everywhere. Ugh."],
  },
  duchess: {
    fired: ["Unsubscribed. And fired!", "Thumbs down. You're fired!"],
    happier: ["That's going in the vlog!", "Ginger just went viral!"],
    parting: ["Film her good side!", "Like, subscribe, walk!"],
    upset: ["That's not making the video!", "I can't upload this!"],
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
    fired: ["Structural failure. Done.", "Walk decommissioned."],
    happier: ["Smooth operation. Well built.", "Right on spec. Nice work."],
    parting: ["Check the leash tension.", "He runs best at a steady pace."],
    upset: ["That's a design flaw.", "Back to the drawing board."],
  },
  snowball: {
    fired: ["Game, set, match. Goodbye.", "Double fault. Goodbye."],
    happier: ["Ace! Lovely footwork.", "That's match point form."],
    parting: ["Light on your feet, dear.", "Keep your eye on the ball."],
    upset: ["Out! That was out!", "Unforced error, dear."],
  },
} as const satisfies Record<DogId, Quips>;
