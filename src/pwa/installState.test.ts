import { describe, expect, it } from "vitest";

import {
  type InstallFacts,
  type InstallState,
  installState,
  isIosDevice,
  offersInstall,
} from "./installState";

const NONE: InstallFacts = {
  appInstalled: false,
  displayModeInstalled: false,
  hasPrompt: false,
  ios: false,
  iosStandalone: false,
};

describe("installState", () => {
  it.each<[string, Partial<InstallFacts>, InstallState]>([
    [
      "is installed in a fullscreen or standalone window",
      { displayModeInstalled: true, hasPrompt: true },
      "installed",
    ],
    [
      "is installed when opened from the iOS Home Screen",
      { ios: true, iosStandalone: true },
      "installed",
    ],
    [
      "is installed once installed during the visit",
      { appInstalled: true, hasPrompt: true },
      "installed",
    ],
    ["offers the browser's prompt while one is held", { hasPrompt: true }, "prompt"],
    ["offers the iOS steps on iOS", { ios: true }, "iosSteps"],
    ["offers nothing elsewhere", {}, "unsupported"],
  ])("%s", (_, facts, expected) => {
    expect(installState({ ...NONE, ...facts })).toBe(expected);
  });
});

describe("offersInstall", () => {
  it.each<[InstallState, boolean]>([
    ["installed", false],
    ["iosSteps", true],
    ["prompt", true],
    ["unsupported", false],
  ])("for %s is %s", (state, expected) => {
    expect(offersInstall(state)).toBe(expected);
  });
});

describe("isIosDevice", () => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
  const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
  const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0";

  it.each<[string, string, number, boolean]>([
    ["an iPhone", IPHONE, 5, true],
    ["an iPad asking for the desktop site", MAC, 5, true],
    ["a Mac", MAC, 0, false],
    ["an Android phone", ANDROID, 5, false],
  ])("finds %s", (_, userAgent, touchPoints, expected) => {
    expect(isIosDevice(userAgent, touchPoints)).toBe(expected);
  });
});
