import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { dataExportFiles } from "./dataExport";

const ROOT = new URL("../../", import.meta.url);

describe("shared/export", () => {
  it.each([...dataExportFiles(gameData)])(
    "%s is what the code exports now: run npm run export:data and commit it",
    async (path, text) => {
      const committed = await readFile(new URL(path, ROOT), "utf8");
      // Compared parsed first, so a failure names the field that moved.
      expect(JSON.parse(committed)).toEqual(JSON.parse(text));
      expect(committed).toBe(text);
    },
  );
});
