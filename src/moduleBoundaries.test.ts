import { describe, expect, it } from "vitest";

// Every non-test module except the Phaser entry point and the scenes, as source text.
const pureModules = import.meta.glob<string>(
  ["./**/*.ts", "!./**/*.test.ts", "!./main.ts", "!./scenes/**"],
  { eager: true, import: "default", query: "?raw" },
);

const IMPORT_SPECIFIER = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(IMPORT_SPECIFIER)].map(([, specifier]) => specifier);
}

describe("module boundaries", () => {
  it("finds the logic, layout and data modules", () => {
    expect(Object.keys(pureModules)).toEqual(
      expect.arrayContaining(["./data/screen.ts", "./layout/lanes.ts"]),
    );
  });

  it.each(Object.entries(pureModules))("keeps %s free of Phaser and the scenes", (_, source) => {
    for (const specifier of importSpecifiers(source)) {
      expect(specifier).not.toBe("phaser");
      expect(specifier).not.toMatch(/(^|\/)scenes(\/|$)/);
    }
  });

  it("recognises the import forms it guards against", () => {
    const source = `import { Scene } from "phaser";\nimport type { X } from "../scenes/RunScene";`;
    expect(importSpecifiers(source)).toEqual(["phaser", "../scenes/RunScene"]);
  });
});
