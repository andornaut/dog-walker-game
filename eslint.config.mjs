import { readdirSync } from "node:fs";

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import ts from "typescript-eslint";

import { plugins, sourceRules, toolingRules } from "./eslint.config.base.mjs";

const SOURCE_FILES = ["src/**/*.ts"];
const PHASER_FILES = ["src/main.ts", "src/scenes/**", "src/**/phaser/**"];
const TEST_FILES = ["src/**/*.test.ts"];

// The import boundaries, one row each: the files outside `except` may not import what `forbid`
// names. Logic, layout and data stay free of Phaser and the scenes, so they run in unit tests
// without a renderer.
const BOUNDARIES = [
  {
    except: PHASER_FILES,
    forbid: {
      group: ["**/phaser", "**/phaser/*", "**/scenes", "**/scenes/*"],
      message:
        "Only src/main.ts, src/scenes/ and phaser/ folders may import Phaser, a scene or a phaser/ folder.",
    },
  },
  {
    except: TEST_FILES,
    forbid: {
      group: ["**/testing", "**/testing/*"],
      message: "Only tests may import src/testing/.",
    },
  },
];

// The bounded contexts: the folders of src/ each context's files may import, besides its own.
// "folder/module" allows one module of a folder: each is an import that a later move removes,
// by moving the module into a context or the importer out of one. The boundaries above govern
// src/testing/.
const CONTEXTS = {
  assets: [
    "data",
    "layout/loadingScreen",
    "layout/pixelShapes",
    "lib",
    "rules/assertNever",
    "runner/statuses",
    "state/runState",
    "tools/artManifest",
    "tools/files",
    "ui/phaser/palette",
  ],
  lib: [],
  road: [
    "assets",
    "data",
    "layout/projection",
    "layout/roadRaster",
    "layout/crossStreet",
    "layout/screenLayout",
    "lib",
    "runner/walk",
    "runner/walkGeometry",
    "scenes/run/stage",
    "scenes/sprites",
  ],
  ui: ["assets", "lib", "rules/units"],
};

const SRC_FOLDERS = folders("src").filter((folder) => folder !== "testing");

function folders(path) {
  return readdirSync(new URL(path, import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

// An import names a folder only by its path, so `./atlas/x` inside src/assets/ reads the same as
// `../atlas/x` from elsewhere: a context's own subfolders are never forbidden to it.
function contextBoundary(context) {
  const allowed = CONTEXTS[context];
  const own = [context, ...folders(`src/${context}`)];
  const modules = allowed.filter((entry) => entry.includes("/"));
  const group = SRC_FOLDERS.filter(
    (folder) => !own.includes(folder) && !allowed.includes(folder),
  ).flatMap((folder) => {
    const exceptions = modules.filter((entry) => entry.startsWith(`${folder}/`));
    if (exceptions.length === 0) {
      return [`**/${folder}`, `**/${folder}/*`];
    }
    // A pattern that matches a folder ignores everything in it past any negation, so a folder
    // with allowed modules is forbidden one level at a time: each subfolder on the way to an
    // allowed module is let through and its own children forbidden, parents first.
    const subfolders = [
      ...new Set(
        exceptions.flatMap((entry) =>
          entry
            .split("/")
            .slice(1, -1)
            .map((_, index, parts) => [folder, ...parts.slice(0, index + 1)].join("/")),
        ),
      ),
    ].sort((a, b) => a.split("/").length - b.split("/").length);
    return [
      `**/${folder}/*`,
      ...subfolders.flatMap((subfolder) => [`!**/${subfolder}`, `**/${subfolder}/*`]),
      ...exceptions.map((entry) => `!**/${entry}`),
    ];
  });
  return {
    files: [`src/${context}/**/*.ts`],
    forbid: {
      group,
      message:
        allowed.length === 0
          ? `src/${context}/ may import nothing from src/.`
          : `src/${context}/ may import only ${allowed.join(", ")} from src/.`,
    },
  };
}

// Every way to pick some of the items, the empty pick included.
function subsets(items) {
  return items.reduce((picks, item) => [...picks, ...picks.map((pick) => [...pick, item])], [[]]);
}

// A files entry that matches only what matches one glob from each list: within a list the globs
// are alternatives, and a nested files array requires all of its globs.
function allOf(globLists) {
  return globLists
    .reduce(
      (combos, globs) => combos.flatMap((combo) => globs.map((glob) => [...combo, glob])),
      [[]],
    )
    .map((combo) => (combo.length === 1 ? combo[0] : combo));
}

// A later no-restricted-imports replaces an earlier one rather than adding to it, so the configs
// partition the files: one config per context (or none) and set of boundaries that binds a file,
// listing the patterns of the context and of every boundary in the set.
function boundaryConfigs() {
  const contexts = Object.keys(CONTEXTS).map(contextBoundary);
  return [undefined, ...contexts].flatMap((context) =>
    subsets(BOUNDARIES)
      .filter((binding) => context !== undefined || binding.length > 0)
      .map((binding) => {
        const exempt = BOUNDARIES.filter((boundary) => !binding.includes(boundary));
        return {
          files: allOf([context?.files ?? SOURCE_FILES, ...exempt.map(({ except }) => except)]),
          ignores: [
            ...binding.flatMap(({ except }) => except),
            ...(context === undefined ? contexts.flatMap(({ files }) => files) : []),
          ],
          rules: {
            "no-restricted-imports": [
              "error",
              { patterns: [...binding, ...(context ? [context] : [])].map(({ forbid }) => forbid) },
            ],
          },
        };
      }),
  );
}

export default defineConfig(
  {
    // .claude/ holds agent worktrees: full copies of the repo that CI never checks out.
    ignores: [".claude/", ".wrangler/", "dist/", "node_modules/"],
  },
  js.configs.recommended,
  ts.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  // The house rules, over what this ships. max-len is inert here: prettier
  // wraps at 100 in this repository, inside the 120 the rule allows.
  {
    files: SOURCE_FILES,
    plugins,
    rules: sourceRules,
  },
  ...boundaryConfigs(),
  // Config files: they produce what ships rather than being it.
  {
    files: ["*.ts", "*.js", "*.mjs"],
    plugins,
    rules: toolingRules,
  },
);
