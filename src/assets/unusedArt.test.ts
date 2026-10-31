import { describe, expect, it } from "vitest";

import { keyNames, unusedKeys } from "./unusedArt";

const sprite = (key: string) => ({ json: `sprites/${key}.json`, key, png: `sprites/${key}.png` });

const SOURCES = [
  `const BUMP = "fx-bump";`,
  `const STATUS = "status";`,
  `export const dogKey = (art: string) => \`dog-\${art}\`;`,
  `export const faceKey = (art: string) => \`face-\${art}\`;`,
  `export const smallFaceKey = (art: string) => \`\${faceKey(art)}-20\`;`,
  `export const variant = (key: string, suffix: string) => \`\${key}\${suffix}\`;`,
  `export const joined = (a: string, b: string) => \`\${a}-\${b}\`;`,
];
const DATA = {
  dogs: { kilo: { art: "kilo" } },
  statuses: ["stinky"],
  zones: [{ art: "yonge-street", name: "Yonge Street" }],
};

describe("unusedKeys", () => {
  const names = keyNames(SOURCES, DATA);
  const usedSprite = (key: string) =>
    unusedKeys(names, { fonts: [], images: [], sounds: [], sprites: [sprite(key)] }).sprites
      ?.length === 0;

  it("reports keys no literal, template or data string names, variants under their base", () => {
    const manifest = {
      fonts: [],
      images: [
        { key: "icon-zone-yonge-street", png: "a.png" },
        { key: "yonge-street", png: "b.png" },
      ],
      sounds: [],
      sprites: ["fx-bump", "fx-stinky", "dog-kilo", "dog-kilo@88", "dog-rex", "dog-rex@62"].map(
        sprite,
      ),
    };
    expect(unusedKeys(names, manifest)).toEqual({
      fonts: [],
      images: ["icon-zone-yonge-street"],
      sounds: [],
      sprites: ["fx-stinky", "dog-rex"],
    });
  });

  it.each([
    ["a template filled with a data name", "face-kilo", true],
    ["a suffix on a key another template builds", "face-kilo-20", true],
    ["a suffix on a key no template builds", "face-rex-20", false],
    ["words joined only by a separator-only template", "status-stinky", false],
  ])("counts %s (%s) as used: %s", (_case, key, used) => {
    expect(usedSprite(key)).toBe(used);
  });
});
