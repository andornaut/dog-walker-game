import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { debuffIconKey } from "../../assets/iconKeys";
import { SCREEN_CONFIG } from "../../data/screen";
import { fadeAway } from "../uiKit";
import { popUpArt, showDebuffPopup } from "./roadBanners";
import { DEPTH } from "./stage";

vi.mock("../uiKit", () => ({ fadeAway: vi.fn() }));

class Image extends EventEmitter {
  active = true;
  depth = 0;
  displayHeight = 16;
  displayWidth = 16;
  x = 0;
  y = 0;
  destroy() {
    this.active = false;
    this.emit("destroy");
  }
  setDepth(depth: number) {
    this.depth = depth;
    return this;
  }
  setOrigin() {
    return this;
  }
  setScale(scale: number) {
    this.displayHeight *= scale;
    this.displayWidth *= scale;
    return this;
  }
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
}

function fixture() {
  const images: Image[] = [];
  const image = vi.fn(() => {
    const added = new Image();
    images.push(added);
    return added;
  });
  const scene = { add: { image }, textures: { exists: () => true } };
  return { image, images, scene: scene as unknown as Scene };
}

describe("received effect popups", () => {
  it("uses the shared bare-icon popup at a fixed lead-top snapshot with a one-second stationary fade", () => {
    const { image, images, scene } = fixture();
    const lead = { x: 180, y: 400 };
    showDebuffPopup(scene, lead, "muddy");
    expect(image).toHaveBeenCalledWith(0, 0, debuffIconKey("muddy"));
    const popup = images[0];
    expect(popup).toMatchObject({
      depth: DEPTH.popup,
      displayHeight: 32,
      displayWidth: 32,
      x: 164,
      y: 364,
    });
    expect(fadeAway).toHaveBeenLastCalledWith(scene, [popup], { ms: 1000, rise: 0 });
    lead.x = 300;
    lead.y = 450;
    expect(popup).toMatchObject({ x: 164, y: 364 });
  });

  it("separates distinct kinds within the viewport and replaces an older popup of the same kind", () => {
    const { images, scene } = fixture();
    const lead = { x: SCREEN_CONFIG.width - 2, y: 400 };
    for (const kind of ["muddy", "stinky", "spotlight", "zoomies"] as const) {
      showDebuffPopup(scene, lead, kind);
    }
    expect(images.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 328, y: 364 },
      { x: 328, y: 328 },
      { x: 328, y: 292 },
      { x: 328, y: 256 },
    ]);
    showDebuffPopup(scene, lead, "muddy");
    expect(images[0]?.active).toBe(false);
    expect(images[4]).toMatchObject({ x: 328, y: 364 });
  });

  it("preserves the existing pickup defaults", () => {
    const { images, scene } = fixture();
    popUpArt(scene, { at: { x: 180, y: 400 }, key: "gear", scale: 2 }, false);
    expect(fadeAway).toHaveBeenLastCalledWith(scene, images, { ms: 1800, rise: 16 });
  });
});
