import js from "@eslint/js";
import globals from "globals";
import ts from "typescript-eslint";

import { plugins, sourceRules, toolingRules } from "./eslint.config.base.mjs";

export default ts.config(
  {
    // .claude/ holds agent worktrees: full copies of the repo that CI never checks out.
    ignores: [".claude/", ".wrangler/", "dist/", "node_modules/"],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  // The house rules, over what this ships. max-len is inert here: prettier
  // wraps at 100 in this repository, inside the 120 the rule allows.
  {
    files: ["src/**/*.ts"],
    plugins,
    rules: sourceRules,
  },
  // Logic, layout and data stay free of Phaser and the scenes, so they run in unit
  // tests without a renderer. Only the scenes and the entry point may import them.
  {
    files: ["src/**/*.ts"],
    ignores: ["src/main.ts", "src/scenes/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["phaser", "phaser/*", "**/scenes", "**/scenes/*"],
              message: "Only src/scenes/ and src/main.ts may import Phaser or a scene.",
            },
          ],
        },
      ],
    },
  },
  // Config files: they produce what ships rather than being it.
  {
    files: ["*.ts", "*.js", "*.mjs"],
    plugins,
    rules: toolingRules,
  },
);
