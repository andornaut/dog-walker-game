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
  it.each<[readonly StartAction[], number]>([
    [["startWalk"], 1],
    [["startWalk", "startWalk"], 1],
    [["help", "startWalk"], 1],
    [["help", "help", "startWalk"], 2],
    [["startWalk", "help"], 2],
  ])("%j shows Help %i times", (actions, shown) => {
    expect(helpShown(actions)).toBe(shown);
  });

  it("keeps a save already marked", () => {
    const save = { helpSeen: true, other: 1 };
    expect(closeHelp(save)).toBe(save);
  });
});
