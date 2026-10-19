import type { Walker } from "./types";

// The preset walkers the player picks from. Placeholder names and sprite keys until the
// looks are designed.
export const WALKERS = {
  casey: { name: "Casey", spriteKey: "walker-casey", unlock: "start" },
  jordan: { name: "Jordan", spriteKey: "walker-jordan", unlock: "start" },
  morgan: { name: "Morgan", spriteKey: "walker-morgan", unlock: "start" },
  robin: { name: "Robin", spriteKey: "walker-robin", unlock: "start" },
} as const satisfies Record<string, Walker>;
