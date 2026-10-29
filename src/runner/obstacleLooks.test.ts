import { seededRandom } from "@andornaut/game-kit/random";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { defined } from "../testing/defined";
import { minorLook, minorObstacleName, pickSkin, zoneSkins } from "./obstacleLooks";

const ZONES = gameData.world.zones.map(({ id, name }) => ({
  id,
  name,
  skins: zoneSkins(gameData, id, "streetCart"),
}));
const PICKS = 6000;

describe("street cart skins", () => {
  it.each(ZONES)("gives $name at least one", ({ skins }) => {
    expect(skins.length).toBeGreaterThan(0);
  });

  // Each skin's share of the picks is within a tenth of an even share.
  it.each(ZONES.filter(({ skins }) => skins.length > 1))(
    "picks $name's skins evenly",
    ({ id, skins }) => {
      const random = seededRandom(7);
      const counts = new Map(skins.map((skin) => [skin, 0]));
      for (let i = 0; i < PICKS; i++) {
        const skin = defined(pickSkin(gameData, random, id, "streetCart"));
        counts.set(skin, (counts.get(skin) ?? 0) + 1);
      }
      const even = PICKS / skins.length;
      expect([...counts.keys()]).toEqual(skins);
      for (const count of counts.values()) {
        expect(Math.abs(count - even)).toBeLessThan(even / 10);
      }
    },
  );

  it.each(ZONES.filter(({ skins }) => skins.length === 1))(
    "picks $name's one skin without drawing from random",
    ({ id, skins }) => {
      const random = () => {
        throw new Error("drew from random");
      };
      expect(pickSkin(gameData, random, id, "streetCart")).toBe(skins[0]);
    },
  );

  it("picks no skin for an obstacle with one look, which looks and is named as itself", () => {
    expect(pickSkin(gameData, seededRandom(1), "highPark", "bench")).toBeUndefined();
    expect(minorLook(gameData, "bench")).toBe("bench");
    expect(minorObstacleName(gameData, "bench")).toBe("Bench");
  });

  it.each([
    ["flowerCart", "Flower cart"],
    ["fruitCart", "Fruit cart"],
    ["hotDogCart", "Hot dog cart"],
    ["iceCreamCart", "Ice cream cart"],
    ["newspaperCart", "Newspaper cart"],
  ] as const)("names a street cart in its %s skin %s", (skin, name) => {
    expect(minorLook(gameData, "streetCart", skin)).toBe(skin);
    expect(minorObstacleName(gameData, "streetCart", skin)).toBe(name);
  });
});
