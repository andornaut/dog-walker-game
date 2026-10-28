import { describe, expect, it } from "vitest";

import { artFileUrl } from "./artUrl";

describe("artFileUrl", () => {
  const hashed = "atlas/run-0.png";
  const artFiles = new Map([[hashed, "assets/art/atlas/run-0-Bq3x_9-Z.png"]]);

  it.each([
    ["/", hashed, `/${artFiles.get(hashed)}`],
    ["/game/", hashed, `/game/${artFiles.get(hashed)}`],
    ["/", "sprites/dog-kilo.png", "/art/sprites/dog-kilo.png"],
    ["/game/", "sprites/dog-kilo.png", "/game/art/sprites/dog-kilo.png"],
    ["/", "constructor", "/art/constructor"],
  ])("under %s, loads %s from %s", (baseUrl, path, url) => {
    expect(artFileUrl(baseUrl, artFiles, path)).toBe(url);
  });
});
