import { describe, expect, it } from "vitest";

import { keyNumbersShown, noteKeyPress, withKeyNumber } from "./keyNumbers";

describe("key numbers", () => {
  it("stay hidden until a key is pressed, then show for the rest of the session", () => {
    expect(keyNumbersShown()).toBe(false);
    expect(withKeyNumber(1, "Resume")).toBe("Resume");
    noteKeyPress();
    expect(keyNumbersShown()).toBe(true);
    expect(withKeyNumber(2, "Help")).toBe("2 Help");
  });
});
