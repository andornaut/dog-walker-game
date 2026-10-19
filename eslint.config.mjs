import js from "@eslint/js";
import globals from "globals";
import ts from "typescript-eslint";

import { plugins, sourceRules, toolingRules } from "./eslint.config.base.mjs";

export default ts.config(
  {
    ignores: [".wrangler/", "dist/", "node_modules/"],
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
  // Config files: they produce what ships rather than being it.
  {
    files: ["*.ts", "*.js", "*.mjs"],
    plugins,
    rules: toolingRules,
  },
);
