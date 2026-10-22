import { describe, expect, it } from "vitest";

import { artFileUrl } from "./artUrl";
import { hashedArtFileName } from "./atlas/hashedArt";

describe("artFileUrl", () => {
  const hashed = "atlas/run-0.png";
  const artFiles = new Map([[hashed, hashedArtFileName(hashed, "Bq3x_9-Z")]]);

  it.each([
    ["/", hashed, `/${artFiles.get(hashed)}`],
    ["/game/", hashed, `/game/${artFiles.get(hashed)}`],
    ["/", "sprites/dog-koda.png", "/art/sprites/dog-koda.png"],
    ["/game/", "sprites/dog-koda.png", "/game/art/sprites/dog-koda.png"],
    ["/", "constructor", "/art/constructor"],
  ])("under %s, loads %s from %s", (baseUrl, path, url) => {
    expect(artFileUrl(baseUrl, artFiles, path)).toBe(url);
  });
});
