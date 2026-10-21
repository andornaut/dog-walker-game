import type { MenuText } from "./types";

// The menus' and pages' text. A {name} is filled in by the game, and src/home/menuText.ts
// lists the names each line may use.
export const MENU_TEXT = {
  celebration: {
    button: "Nice!",
    titleMany: "{count} badges earned!",
    titleOne: "Badge earned!",
  },
  end: {
    backHome: "Back home",
    bank: "Bank",
    earnings: {
      cardCosts: "Card costs",
      fees: "Pay",
      fullPack: "Full pack bonus",
      luckyFinds: "Lucky finds",
      start: "Starting cash",
      tips: "Tips",
    },
    firedYou: "{owner} fired you",
    newBest: "New best!",
    titles: {
      finished: "What a walk!",
      noDogs: "Out of dogs for today",
      wentHome: "Home sweet home",
    },
    total: "Total",
    zonesWalked: "Neighborhoods",
  },
  help: {
    gotIt: "Got it",
    heading: "How to walk",
    next: "Next",
    previous: "Previous",
  },
  pause: {
    headHome: "Head home",
    help: "Help",
    note: "Ends the walk. Cash and banked pay are kept.",
    resume: "Resume",
    settings: "Settings",
    title: "Paused",
  },
  settings: {
    effects: "Effects",
    motion: "Reduced motion",
    motionNote: "Skips shakes, bobs, confetti, scenery",
    music: "Music",
    muted: "Muted",
    sound: "Sound",
    soundNote: "Mutes music and effects",
    title: "Settings",
    volume: "{percent}%",
  },
  stats: {
    badgeEarned: "Earned",
    badgeLine: '"{line}"',
    badgeLocked: "Locked",
    badgeProgress: "{have}/{need}",
    badges: "Badges",
    dogColumns: {
      dog: "Dog",
      fired: "Fired",
      walks: "Walks",
      zones: "Neighborhoods",
    },
    earnedCount: "{earned}/{total} earned",
    outcomes: {
      finished: "Finished",
      noDogs: "Out of dogs",
      wentHome: "Headed home",
    },
    overall: {
      bestRun: "Best walk",
      bestZone: "Most neighborhoods in a walk",
      lifetime: "Lifetime earnings",
      runsPlayed: "Walks played",
      timesFired: "Times fired",
    },
    sections: {
      overall: "Overall",
      runs: "Walks",
    },
    tabs: {
      badges: "Badges",
      dogs: "Dogs",
      runs: "Walks",
    },
    timesFiredBy: "{count} (most: {owner})",
    title: "Stats",
  },
} as const satisfies MenuText;
