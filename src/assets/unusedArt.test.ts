import { describe, expect, it } from "vitest";

import { keyNames, unusedKeys } from "./unusedArt";

const sprite = (key: string) => ({ json: `sprites/${key}.json`, key, png: `sprites/${key}.png` });

const SOURCES = [
  `const BUMP = "fx-bump";`,
  `export const dogKey = (art: string) => \`dog-\${art}\`;`,
  `export const variant = (key: string, suffix: string) => \`\${key}\${suffix}\`;`,
];
const DATA = { dogs: { koda: { art: "koda" } }, zones: [{ name: "The Long Way Home" }] };

describe("unusedKeys", () => {
  const names = keyNames(SOURCES, DATA);

  it("reports keys no literal, template or data string names, variants under their base", () => {
    const manifest = {
      fonts: [],
      images: [
        { key: "icon-zone-the-long-way-home", png: "a.png" },
        { key: "the-long-way-home", png: "b.png" },
      ],
      sounds: [],
      sprites: ["fx-bump", "fx-stinky", "dog-koda", "dog-koda@88", "dog-rex", "dog-rex@62"].map(
        sprite,
      ),
    };
    expect(unusedKeys(names, manifest)).toEqual({
      fonts: [],
      images: ["icon-zone-the-long-way-home"],
      sounds: [],
      sprites: ["fx-stinky", "dog-rex"],
    });
  });

  it("ignores a template with no fixed part, which would name anything", () => {
    expect(names.patterns.map(String)).toEqual(["/^dog-(.+)$/"]);
  });
});
