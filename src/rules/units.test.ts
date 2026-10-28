import { describe, expect, it } from "vitest";

import { TEST_TUNING } from "../testing/tuning";
import { readTable } from "./units";

describe("tuning units", () => {
  it("names a missing table row", () => {
    expect(() =>
      readTable(
        TEST_TUNING,
        "hearts",
        "maxBySize",
        "huge" as keyof typeof TEST_TUNING.hearts.maxBySize,
      ),
    ).toThrow("hearts.maxBySize.huge");
  });
});
