import { readFile } from "node:fs/promises";

import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import palette from "../../shared/palette.json";
import { gameData } from "../data";
import { helpBodyValues } from "../help/helpBody";
import { rosterRows } from "../home/home";

const HOME_PAGE = new URL("../../pages/index.html", import.meta.url);
const SKY_BACKDROP = new URL("../../public/art/images/backdrop-yonge-street.png", import.meta.url);

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six"];

function capitalized(text: string): string {
  return text.replace(/^./u, (letter) => letter.toUpperCase());
}

function listed(items: readonly string[]): string {
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

// The page's sentences that restate a number or a name from the data, rebuilt from the data.
function pageFacts(): [string, string][] {
  const { debuffs, defaultWalker, dogs, tuning, walkers, world } = gameData;
  const zoneIndex = (zoneId: string) => world.zones.findIndex(({ id }) => id === zoneId);
  const zoneName = (zoneId: string) => world.zones[zoneIndex(zoneId)]?.name ?? zoneId;
  const count = (n: number) => NUMBER_WORDS[n] ?? String(n);
  const sizes = ["small", "medium", "large"] as const;
  const perSize = sizes.map(
    (size) => `${count(Object.values(dogs).filter((dog) => dog.size === size).length)} ${size}`,
  );
  const { large, medium, small } = tuning.hearts.maxBySize;
  const unlocks = Object.values(walkers)
    .flatMap((walker) => (walker.unlock === "finishZone" ? [walker] : []))
    .sort((a, b) => zoneIndex(a.zone) - zoneIndex(b.zone))
    .map(
      ({ name, zone }, i) => `${name} ${i ? "" : "joins when you first finish "}${zoneName(zone)}`,
    );
  return [
    ["the world", `Walk a pack of dogs through ${world.name}.`],
    ["the walk length", `${capitalized(count(world.walkLength))} neighbourhoods a walk`],
    [
      "the first and last zones",
      `Every walk starts in ${zoneName(world.firstZone)}, ends on ${zoneName(world.lastZone)} and ` +
        `covers ${count(world.walkLength)} of ${world.name}'s ${count(world.zones.length)} neighbourhoods.`,
    ],
    ["the dogs per size", `${capitalized(listed(perSize))}.`],
    [
      "the hearts per size",
      `${small} for a small dog, ${medium} for a medium one and ${large} for a large one.`,
    ],
    [
      "the small dog's dodge",
      `A small dog dodges 1 in ${1 / tuning.probability.smallDodgeChance} bumps`,
    ],
    [
      "the debuffs and their durations, as Help gives them",
      `leaves the pack ${debuffs.muddy.name}, and a cheap way out can leave it ${debuffs.stinky.name} ` +
        `or with the ${debuffs.zoomies.name}, each for ${helpBodyValues(gameData).debuffSeconds} seconds.`,
    ],
    ["the walkers' unlocks", `${walkers[defaultWalker].name} walks first; ${listed(unlocks)}.`],
  ];
}

// The home page is static HTML, so its roster is checked against the data here.
describe("the home page's roster", () => {
  it("shows every dog's portrait in the start screen's order and names them in it", async () => {
    const html = await readFile(HOME_PAGE, "utf8");
    const roster =
      /<div\s+class="dogs"[^>]*aria-label="The nine dogs: ([^"]*)"[^>]*>([\s\S]*?)<\/div>/u.exec(
        html,
      );
    expect(roster).not.toBeNull();
    const [, label = "", images = ""] = roster ?? [];
    const arts = [...images.matchAll(/portrait-dog-([a-z]+)\.png/gu)].map(([, art]) => art);
    const dogs = rosterRows(gameData)
      .flat()
      .map((id) => gameData.dogs[id]);
    expect({ arts, label }).toEqual({
      arts: dogs.map((dog) => dog.art),
      label: listed(dogs.map((dog) => dog.name)),
    });
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

  it.each(pageFacts())("states %s as the data has it", async (_fact, sentence) => {
    const html = (await readFile(HOME_PAGE, "utf8")).replaceAll(/\s+/gu, " ");
    expect(html).toContain(sentence);
  });
});

describe("the home page's sky band", () => {
  it("runs the backdrop's top row on above it, in the palette colour of that name", async () => {
    const html = await readFile(HOME_PAGE, "utf8");
    const name = /\.sky\s*\{[^}]*background:\s*var\(--([a-z]+)\)/u.exec(html)?.[1] ?? "";
    const hex = new RegExp(`--${name}:\\s*#([0-9a-f]{6});`, "u").exec(html)?.[1];
    const { data } = PNG.sync.read(await readFile(SKY_BACKDROP));
    const topLeft = [...data.subarray(0, 3)].map((byte) => byte.toString(16).padStart(2, "0"));
    expect({ hex, name }).toEqual({
      hex: topLeft.join(""),
      name: Object.entries(palette).find(([, colour]) => colour.hex === hex)?.[0],
    });
  });
});

// On a phone, each screenshot shows at 1x inside the highlight's chrome, and is sized to its PNG.
describe("the home page's screenshots", () => {
  it("are their PNGs' size, and a phone's highlight is one wide plus its chrome", async () => {
    const html = await readFile(HOME_PAGE, "utf8");
    const highlight = /\.hl\s*\{([^}]*)\}/u.exec(html)?.[1] ?? "";
    const px = (pattern: RegExp) => (pattern.exec(highlight)?.slice(1) ?? []).map(Number);
    const [cardWidth] = px(/--w:\s*min\((\d+)px,\s*100vw\)/u);
    const [border = Number.NaN] = px(/border:\s*(\d+)px/u);
    const [, right = Number.NaN, , left = Number.NaN] = px(
      /padding:\s*(\d+)px\s+(\d+)px\s+(\d+)px\s+(\d+)px/u,
    );
    const shots = [
      ...html.matchAll(/class="shot"\s+src="([^"]+)"\s+width="(\d+)"\s+height="(\d+)"/gu),
    ];
    const count = html.split('class="shot"').length - 1;
    expect(count).toBeGreaterThan(0);
    expect(shots).toHaveLength(count);
    const pngs = await Promise.all(
      shots.map(async ([, src = ""]) => {
        const png = PNG.sync.read(await readFile(new URL(`../../public${src}`, import.meta.url)));
        return { height: png.height, src, width: png.width };
      }),
    );
    expect(
      shots.map(([, src, width, height]) => ({
        height: Number(height),
        src,
        width: Number(width),
      })),
    ).toEqual(pngs);
    expect(pngs.map(({ width }) => width + 2 * border + left + right)).toEqual(
      pngs.map(() => cardWidth),
    );
  });
});
