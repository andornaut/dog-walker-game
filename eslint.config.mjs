import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import ts from "typescript-eslint";

import { plugins, sourceRules, toolingRules } from "./eslint.config.base.mjs";

const SOURCE_FILES = ["src/**/*.ts"];
const PHASER_FILES = ["src/main.ts", "src/scenes/**"];
const TEST_FILES = ["src/**/*.test.ts"];

// The import boundaries, one row each: the files outside `except` may not import what `forbid`
// names. Logic, layout and data stay free of Phaser and the scenes, so they run in unit tests
// without a renderer.
const BOUNDARIES = [
  {
    except: PHASER_FILES,
    forbid: {
      group: ["phaser", "phaser/*", "**/scenes", "**/scenes/*"],
      message: "Only src/scenes/ and src/main.ts may import Phaser or a scene.",
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
// partition the files: one config per set of boundaries that binds a file, listing the patterns
// of every boundary in the set.
function boundaryConfigs() {
  return subsets(BOUNDARIES)
    .filter((binding) => binding.length > 0)
    .map((binding) => {
      const exempt = BOUNDARIES.filter((boundary) => !binding.includes(boundary));
      return {
        files: allOf([SOURCE_FILES, ...exempt.map(({ except }) => except)]),
        ignores: binding.flatMap(({ except }) => except),
        rules: {
          "no-restricted-imports": ["error", { patterns: binding.map(({ forbid }) => forbid) }],
        },
      };
    });
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
