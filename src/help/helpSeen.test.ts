import { describe, expect, it } from "vitest";

import { closeHelp, type HelpSeenSave, startWalkOpensHelp } from "./helpSeen";

type StartAction = "help" | "startWalk";

// How often Help shows over a sequence of start-screen actions: ? opens it, and Start walk
// opens it while it is unread. Each opening closes before the next action.
function helpShown(actions: readonly StartAction[]): number {
  let save: HelpSeenSave = { helpSeen: false };
  let shown = 0;
  for (const action of actions) {
    if (action === "help" || startWalkOpensHelp(save)) {
      shown += 1;
      save = closeHelp(save);
    }
  }
  return shown;
}

describe("helpSeen", () => {
  it("shows Help on ? and on the first Start walk while it is unread", () => {
    const cases: readonly [readonly StartAction[], number][] = [
      [["startWalk"], 1],
      [["startWalk", "startWalk"], 1],
      [["help", "startWalk"], 1],
      [["help", "help", "startWalk"], 2],
      [["startWalk", "help"], 2],
    ];
    for (const [actions, shown] of cases) {
      expect(helpShown(actions)).toBe(shown);
    }
  });
});
