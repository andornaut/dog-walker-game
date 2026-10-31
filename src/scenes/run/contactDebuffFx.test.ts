import { EventEmitter } from "node:events";

import type { Point } from "@andornaut/game-kit/rect";
import type { Scene } from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SCREEN_LAYOUT } from "../../data/screen";
import { DEBUFF_GROUND, type DebuffHitEffect, HIT_ART } from "../../layout/hitEffects";
import { playTagOnce } from "../sprites";
import { tagFrame } from "../uiKit";
import { playContactDebuff } from "./contactDebuffFx";

vi.mock("../sprites", () => ({ playTagOnce: vi.fn() }));
vi.mock("../uiKit", () => ({ tagFrame: vi.fn() }));

class Display extends EventEmitter {
  active = true;
  children: Display[] = [];
  depth = 0;
  displayHeight = 36;
  displayWidth = 60;
  mask: unknown;
  origin = [0, 0];
  visible = true;
  x = 0;
  y = 0;

  destroy = vi.fn(() => {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.emit("destroy");
    this.children.forEach((child) => child.destroy());
    this.removeAllListeners();
  });

  setDepth(depth: number) {
    this.depth = depth;
    return this;
  }
  setDisplaySize(width: number, height: number) {
    this.displayWidth = width;
    this.displayHeight = height;
    return this;
  }
  setMask(mask: unknown) {
    this.mask = mask;
    return this;
  }
  setOrigin(x: number, y = x) {
    this.origin = [x, y];
    return this;
  }
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
  setVisible(visible: boolean) {
    this.visible = visible;
    return this;
  }
}

function fixture(duration = 1200) {
  const bursts: Display[] = [];
  const groups: Display[] = [];
  const events = new EventEmitter();
  const remove = vi.fn();
  const mask = { destroy: vi.fn() };
  const graphics = {
    createGeometryMask: vi.fn(() => mask),
    destroy: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: vi.fn(),
  };
  graphics.fillStyle.mockReturnValue(graphics);
  const timers: { callback: () => void; ms: number }[] = [];
  const burst = () => {
    const image = new Display();
    bursts.push(image);
    return image;
  };
  const scene = {
    add: {
      container: vi.fn((_x: number, _y: number, children: Display[]) => {
        const group = new Display();
        group.children = children;
        groups.push(group);
        return group;
      }),
      image: vi.fn((x: number, y: number) => burst().setPosition(x, y)),
      sprite: vi.fn(burst),
    },
    anims: { get: vi.fn(() => ({ duration })) },
    events,
    make: { graphics: vi.fn(() => graphics) },
    textures: { exists: vi.fn(() => true) },
    time: {
      delayedCall: vi.fn((ms: number, callback: () => void) => {
        timers.push({ callback, ms });
        return { remove };
      }),
    },
  };
  vi.mocked(tagFrame).mockReturnValue("peak");
  return { bursts, events, graphics, groups, mask, remove, scene, timers };
}

const view = SCREEN_LAYOUT.roadView;
const cue: DebuffHitEffect = { debuff: "stinky", frame: null, key: HIT_ART.debuffs.stinky.key };
const walker = { x: 180, y: 440 };
const context = (feet: () => readonly Point[] = () => [walker]) => ({
  depth: 9.5,
  feet,
  view,
});

beforeEach(() => vi.resetAllMocks());

describe("contact debuff ground cues", () => {
  it("follows every visible actor at native size, under actors, without frame clamping", () => {
    const { bursts, events, graphics, groups, mask, scene } = fixture();
    let feet = [walker, { x: 130, y: 420 }, { x: 230, y: 420 }];
    playContactDebuff(
      scene as unknown as Scene,
      context(() => feet),
      cue,
    );
    expect(bursts).toHaveLength(feet.length);
    expect(bursts.map(({ x, y }) => ({ x, y }))).toEqual(feet.map(({ x, y }) => ({ x, y: y - 1 })));
    expect(bursts.every(({ origin }) => origin[0] === 0.5 && origin[1] === 5 / 6)).toBe(true);
    expect(groups.map(({ depth }) => depth)).toEqual([9.5]);
    expect(groups.every((group) => group.mask === mask)).toBe(true);
    expect(graphics.fillRect).toHaveBeenCalledWith(view.x, view.y, view.width, view.height);
    feet = [
      { x: view.x + view.width + 20, y: 440 },
      { x: 160, y: 450 },
    ];
    events.emit("postupdate");
    expect(bursts[0]?.x).toBe(feet[0]?.x);
    expect(bursts[1]?.y).toBe(450 + DEBUFF_GROUND.yOffset);
    expect(bursts[2]?.visible).toBe(false);
    expect(playTagOnce).toHaveBeenCalledTimes(3);
    expect(scene.time.delayedCall).not.toHaveBeenCalled();
  });

  it.each(["completion", "shutdown", "destroy"] as const)(
    "cleans all ground copies, mask and listeners on %s",
    (endedBy) => {
      const { events, graphics, groups, mask, scene } = fixture();
      playContactDebuff(scene as unknown as Scene, context(), cue);
      if (endedBy === "completion") {
        vi.mocked(playTagOnce).mock.calls[0]?.[3]();
      } else if (endedBy === "shutdown") {
        events.emit("shutdown");
      } else {
        groups[0]?.destroy();
      }
      expect(groups.every(({ active }) => !active)).toBe(true);
      expect(mask.destroy).toHaveBeenCalledTimes(1);
      expect(graphics.destroy).toHaveBeenCalledTimes(1);
      expect(events.listenerCount("postupdate")).toBe(0);
      expect(events.listenerCount("shutdown")).toBe(0);
    },
  );

  it("holds the readable ground pose for the loaded duration", () => {
    const { bursts, groups, scene, timers } = fixture(1200);
    playContactDebuff(scene as unknown as Scene, context(), {
      ...cue,
      frame: HIT_ART.debuffs.stinky.peak,
    });
    expect(scene.add.sprite).not.toHaveBeenCalled();
    expect(playTagOnce).not.toHaveBeenCalled();
    expect(tagFrame).toHaveBeenCalledWith(scene, cue.key, HIT_ART.tag, 4);
    expect(timers.map(({ ms }) => ms)).toEqual([1200]);
    expect(bursts[0]?.active).toBe(true);
    timers[0]?.callback();
    expect(groups.every(({ active }) => !active)).toBe(true);
  });

  it("skips unavailable art without graphics, listeners or timers", () => {
    const { events, scene } = fixture();
    scene.textures.exists.mockReturnValue(false);
    playContactDebuff(scene as unknown as Scene, context(), cue);
    expect(scene.add.container).not.toHaveBeenCalled();
    expect(scene.make.graphics).not.toHaveBeenCalled();
    expect(scene.time.delayedCall).not.toHaveBeenCalled();
    expect(events.listenerCount("postupdate")).toBe(0);
  });
});
