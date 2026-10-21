import { describe, expect, it } from "vitest";

import { settingsAllowSound, shouldResumeAudio } from "./resume";
import { INITIAL_MIX, type Mix } from "./sound";

const STATES = ["interrupted", "suspended", "running", "closed"];
// A running or closed context is never resumed.
const RESUMED = ["interrupted", "suspended"];

describe("settingsAllowSound and shouldResumeAudio", () => {
  // Whether the settings allow sound, and which audio context states the game resumes from.
  it("resumes an interrupted or suspended context unless muted or at zero volume", () => {
    const cases: [string, Partial<Mix>, boolean, string[]][] = [
      ["resumes an interrupted or suspended context", {}, true, RESUMED],
      [
        "allows sound with only the music at zero",
        { volumes: { music: 0, sfx: 0.2 } },
        true,
        RESUMED,
      ],
      [
        "allows sound with only the effects at zero",
        { volumes: { music: 0.2, sfx: 0 } },
        true,
        RESUMED,
      ],
      ["ignores pause and hiding", { hidden: true, paused: true }, true, RESUMED],
      ["leaves the context stopped while muted", { muted: true }, false, []],
      ["leaves the context stopped at zero volume", { volumes: { music: 0, sfx: 0 } }, false, []],
    ];
    for (const [name, overrides, allow, resumes] of cases) {
      const mix = { ...INITIAL_MIX, ...overrides };
      expect(
        {
          allow: settingsAllowSound(mix),
          resumes: STATES.filter((state) => shouldResumeAudio(mix, state)),
        },
        name,
      ).toEqual({ allow, resumes });
    }
  });
});
