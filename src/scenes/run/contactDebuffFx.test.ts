import { EventEmitter } from "node:events";

import type { Point } from "@andornaut/game-kit/rect";
import type { Scene } from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SCREEN_LAYOUT } from "../../data/screen";
import { DEBUFF_BADGE, type DebuffHitEffect, HIT_ART } from "../../layout/hitEffects";
import { playTagOnce } from "../sprites";
import { addPanel, tagFrame } from "../uiKit";
import { playContactDebuff } from "./contactDebuffFx";

vi.mock("../sprites", () => ({ playTagOnce: vi.fn() }));
vi.mock("../uiKit", () => ({ addPanel: vi.fn(), tagFrame: vi.fn() }));

class Display extends EventEmitter {
  active = true;
  children: Display[] = [];
  displayHeight = 128;
  displayWidth = 128;
  x = 0;
  y = 0;

  add(children: Display[]) {
    this.children.push(...children);
    return this;
  }

  destroy = vi.fn(() => {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.emit("destroy");
    this.children.forEach((child) => child.destroy());
    this.removeAllListeners();
  });

  setDepth() {
    return this;
  }

  setDisplaySize(width: number, height: number) {
    this.displayWidth = width;
    this.displayHeight = height;
    return this;
  }

  setOrigin() {
    return this;
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
}

function fixture(duration = 1200) {
  const burst = new Display();
  const group = new Display();
  const icon = new Display();
  const panel = new Display();
  const events = new EventEmitter();
  const remove = vi.fn();
  const timers: { callback: () => void; ms: number }[] = [];
  const scene = {
    add: {
      container: vi.fn((_x: number, _y: number, children: Display[]) => group.add(children)),
      image: vi.fn((_x: number, _y: number, key: string) => (key.startsWith("fx-") ? burst : icon)),
      sprite: vi.fn(() => burst),
    },
    anims: { get: vi.fn(() => ({ duration })) },
    events,
    textures: { exists: vi.fn(() => true) },
    time: {
      delayedCall: vi.fn((ms: number, callback: () => void) => {
        timers.push({ callback, ms });
        return { remove };
      }),
    },
  };
  vi.mocked(addPanel).mockReturnValue(panel as unknown as ReturnType<typeof addPanel>);
  vi.mocked(tagFrame).mockReturnValue("peak");
  return { burst, events, group, icon, panel, remove, scene, timers };
}

const view = SCREEN_LAYOUT.roadView;
const cue: DebuffHitEffect = {
  above: 2,
  at: { x: 180, y: 380 },
  debuff: "stinky",
  frame: null,
  key: HIT_ART.debuffs.stinky.key,
};

beforeEach(() => vi.resetAllMocks());

describe("contact debuff cue tracking", () => {
  it("moves the burst and badge with the dog and keeps both inside the road", () => {
    const { events, group, icon, panel, scene } = fixture();
    let top: Point = { x: 180, y: 380 };
    playContactDebuff(scene as unknown as Scene, { depth: 10, dogTop: () => top, view }, cue);
    const first = { x: group.x, y: group.y };
    top = { x: 360, y: 560 };
    events.emit("postupdate");
    expect({ x: group.x, y: group.y }).not.toEqual(first);
    expect(group.x + 64).toBeLessThanOrEqual(view.x + view.width - DEBUFF_BADGE.viewInset);
    expect(group.y + 64).toBeLessThanOrEqual(view.y + view.height - DEBUFF_BADGE.viewInset);
    expect(group.x + panel.x + DEBUFF_BADGE.size).toBeLessThan(group.x - 64);
    expect(icon.x - panel.x).toBe(DEBUFF_BADGE.iconInset);
    expect(icon.y - panel.y).toBe(DEBUFF_BADGE.iconInset);
  });

  it.each(["completion", "shutdown", "destroy"] as const)(
    "removes the full cue and tracking listeners on %s",
    (endedBy) => {
      const { events, group, icon, panel, scene } = fixture();
      playContactDebuff(
        scene as unknown as Scene,
        { depth: 10, dogTop: () => undefined, view },
        cue,
      );
      expect(icon.active).toBe(true);
      expect(scene.time.delayedCall).not.toHaveBeenCalled();
      if (endedBy === "completion") {
        vi.mocked(playTagOnce).mock.calls[0]?.[3]();
      } else if (endedBy === "shutdown") {
        events.emit("shutdown");
      } else {
        group.destroy();
      }
      expect(group.destroy).toHaveBeenCalledTimes(1);
      expect(icon.active).toBe(false);
      expect(panel.active).toBe(false);
      expect(events.listenerCount("postupdate")).toBe(0);
      expect(events.listenerCount("shutdown")).toBe(0);
    },
  );

  it("holds the peak and badge for the loaded duration with reduced motion", () => {
    const duration = 1375;
    const { group, icon, scene, timers } = fixture(duration);
    playContactDebuff(
      scene as unknown as Scene,
      { depth: 10, dogTop: () => undefined, view },
      {
        ...cue,
        frame: HIT_ART.debuffs.stinky.peak,
      },
    );
    expect(scene.add.sprite).not.toHaveBeenCalled();
    expect(playTagOnce).not.toHaveBeenCalled();
    expect(timers.map(({ ms }) => ms)).toEqual([duration]);
    expect(icon.active).toBe(true);
    timers[0]?.callback();
    expect(group.active).toBe(false);
    expect(icon.active).toBe(false);
  });

  it("skips missing burst art without registering tracking or cleanup timers", () => {
    const { events, scene } = fixture();
    scene.textures.exists.mockReturnValue(false);
    playContactDebuff(scene as unknown as Scene, { depth: 10, dogTop: () => undefined, view }, cue);
    expect(scene.add.container).not.toHaveBeenCalled();
    expect(scene.time.delayedCall).not.toHaveBeenCalled();
    expect(events.listenerCount("postupdate")).toBe(0);
  });
});
