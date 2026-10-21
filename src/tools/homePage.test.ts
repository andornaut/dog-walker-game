import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { gameData } from "../data";

const HOME_PAGE = new URL("../../pages/index.html", import.meta.url);

// The home page is static HTML, so its roster is checked against the data here.
describe("the home page's roster", () => {
  it("shows every dog's portrait once and names them in the same order", async () => {
    const html = await readFile(HOME_PAGE, "utf8");
    const roster =
      /<div\s+class="dogs"[^>]*aria-label="The nine dogs: ([^"]*)"[^>]*>([\s\S]*?)<\/div>/u.exec(
        html,
      );
    expect(roster).not.toBeNull();
    const [, label = "", images = ""] = roster ?? [];
    const arts = [...images.matchAll(/portrait-dog-([a-z]+)\.png/gu)].map(([, art]) => art);
    const dogs = Object.values(gameData.dogs);
    expect([...arts].sort()).toEqual(dogs.map((dog) => dog.art).sort());
    const names = arts.map((art) => dogs.find((dog) => dog.art === art)?.name ?? art);
    expect(label).toBe(`${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
  });

  it("lists every zone in the world's order with its name, difficulty and icon", async () => {
    const html = await readFile(HOME_PAGE, "utf8");
    const list = /<ol\s+class="zones"[^>]*>([\s\S]*?)<\/ol>/u.exec(html)?.[1] ?? "";
    const shown = [
      ...list.matchAll(/icon-zone-([a-z-]+)\.png[\s\S]*?<b>([^<]*)<\/b>([^<]*)<\/span>/gu),
    ].map(([, art, name, difficultyName]) => ({ art, difficultyName, name }));
    expect(shown).toEqual(
      gameData.world.zones.map(({ art, difficultyName, name }) => ({ art, difficultyName, name })),
    );
  });

  it("names the world and the zone every walk starts in", async () => {
    const html = await readFile(HOME_PAGE, "utf8");
    const { firstZone, name, zones } = gameData.world;
    const first = zones.find(({ id }) => id === firstZone)?.name ?? firstZone;
    expect(html).toContain(`Every walk starts in ${first} and covers`);
    expect(html).toContain(`Walk a pack of dogs through ${name}.`);
  });
});
