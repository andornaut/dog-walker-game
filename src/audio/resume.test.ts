import { describe, expect, it } from "vitest";

import { settingsAllowSound, shouldResumeAudio } from "./resume";
import { INITIAL_MIX, type Mix } from "./sound";

const mix = (overrides: Partial<Mix>): Mix => ({ ...INITIAL_MIX, ...overrides });

describe("settingsAllowSound", () => {
  it("allows sound unless muted or both channels are at zero", () => {
    expect(settingsAllowSound(mix({}))).toBe(true);
    expect(settingsAllowSound(mix({ volumes: { music: 0, sfx: 0.2 } }))).toBe(true);
    expect(settingsAllowSound(mix({ volumes: { music: 0.2, sfx: 0 } }))).toBe(true);
    expect(settingsAllowSound(mix({ muted: true }))).toBe(false);
    expect(settingsAllowSound(mix({ volumes: { music: 0, sfx: 0 } }))).toBe(false);
  });

  it("ignores pause, hiding and cards, which pass on their own", () => {
    expect(settingsAllowSound(mix({ cardOpen: true, hidden: true, paused: true }))).toBe(true);
  });
});

describe("shouldResumeAudio", () => {
  it("resumes an interrupted or suspended context", () => {
    expect(shouldResumeAudio(mix({}), "interrupted")).toBe(true);
    expect(shouldResumeAudio(mix({}), "suspended")).toBe(true);
  });

  it("leaves a running or closed context alone", () => {
    expect(shouldResumeAudio(mix({}), "running")).toBe(false);
    expect(shouldResumeAudio(mix({}), "closed")).toBe(false);
  });

  it("leaves the context stopped while the settings silence the game", () => {
    expect(shouldResumeAudio(mix({ muted: true }), "interrupted")).toBe(false);
    expect(shouldResumeAudio(mix({ volumes: { music: 0, sfx: 0 } }), "suspended")).toBe(false);
  });
});
