import { describe, expect, it } from "vitest";

import { devRunLoadout, namesRunSetup } from "./devStart";

const setup = { dev: false, seed: 1, speed: 1, zone: 1 };

describe("namesRunSetup", () => {
  it("is true for a URL with any run parameter", () => {
    expect(namesRunSetup("?seed=123&pack=koda,duchess&zone=1&dev=1")).toBe(true);
    expect(namesRunSetup("?speed=2")).toBe(true);
    expect(namesRunSetup("?gear=none")).toBe(true);
  });

  it("is false without one, even with the overlay on", () => {
    expect(namesRunSetup("")).toBe(false);
    expect(namesRunSetup("?dev=1")).toBe(false);
  });
});

describe("devRunLoadout", () => {
  it("takes the link's pack and gear over the saved loadout", () => {
    const saved = { dogs: ["biscuit" as const], gear: null };
    expect(
      devRunLoadout(saved, "koda", { ...setup, gear: "whistle", pack: ["koda", "duchess"] }),
    ).toEqual({
      dogs: ["koda", "duchess"],
      gear: "whistle",
    });
  });

  it("keeps the saved loadout for what the link leaves out", () => {
    const saved = { dogs: ["biscuit" as const], gear: "fannyPack" as const };
    expect(devRunLoadout(saved, "koda", setup)).toEqual({ dogs: ["biscuit"], gear: "fannyPack" });
  });

  it("walks the first owned dog when nothing was picked yet", () => {
    expect(devRunLoadout({ dogs: [], gear: null }, "koda", setup)).toEqual({
      dogs: ["koda"],
      gear: null,
    });
  });
});
