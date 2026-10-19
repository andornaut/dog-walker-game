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
      clawbacks: "Fees taken back",
      fees: "Fees",
      luckyFinds: "Lucky finds",
      start: "Starting money",
      tips: "Tips",
    },
    firedYou: "{owner} fired you",
    newBest: "New best!",
    titles: {
      finished: "Walk done!",
      noDogs: "Out of dogs",
      wentHome: "Headed home",
    },
    total: "Total",
    zonesWalked: "Zones walked",
  },
  help: {
    back: "BACK",
    gotIt: "GOT IT",
    heading: "How to walk",
    next: "NEXT",
  },
  pause: {
    headHome: "Head home",
    help: "Help",
    note: "Keeps tips and earlier zones' fees",
    resume: "Resume",
    settings: "Settings",
    title: "Paused",
  },
  settings: {
    back: "Back",
    effects: "Effects",
    motion: "Reduced motion",
    motionNote: "Skips shakes, hops and bobs",
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
    badges: "Badges",
    dogColumns: {
      dog: "Dog",
      fired: "Fired",
      walks: "Walks",
      zones: "Zones",
    },
    earnedCount: "{earned}/{total} earned",
    logBest: "Best {best}, {note}.",
    logEmpty: "No walks yet.",
    logLast: "Last {last}",
    outcomes: {
      finished: "Finished",
      noDogs: "Out of dogs",
      wentHome: "Headed home",
    },
    overall: {
      bestRun: "Best run",
      bestZone: "Best zone completed",
      lifetime: "Lifetime earnings",
      runsPlayed: "Runs played",
      timesFired: "Times fired",
    },
    sections: {
      logbook: "Logbook",
      overall: "Overall",
      runs: "Runs",
    },
    tabs: {
      badges: "Badges",
      dogs: "Dogs",
      runs: "Runs",
    },
    timesFiredBy: "{count} (most: {owner})",
    title: "Stats",
  },
} as const satisfies MenuText;
