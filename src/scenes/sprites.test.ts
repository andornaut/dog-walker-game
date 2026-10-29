import type { GameObjects } from "phaser";
import { describe, expect, it } from "vitest";

import { animationKey } from "../assets/asepriteAnimations";
import { playTag, playTagOnce, showAtDepth } from "./sprites";

const KEY = "dog-kilo";

// A sprite that has every tag and keeps its one-off listeners as Phaser's emitter does:
// complete(tag) ends that tag's play and stop() stops whatever plays.
function fakeSprite() {
  let listeners: { event: string; listener: () => void }[] = [];
  let playing: string | undefined;
  const emit = (event: string) => {
    const heard = listeners.filter((entry) => entry.event === event);
    listeners = listeners.filter((entry) => entry.event !== event);
    heard.forEach(({ listener }) => listener());
  };
  const sprite = {
    anims: {
      get currentAnim() {
        return playing === undefined ? null : { key: playing };
      },
      isPaused: false,
      isPlaying: true,
    },
    off(event: string, listener: () => void) {
      listeners = listeners.filter((entry) => entry.event !== event || entry.listener !== listener);
      return sprite;
    },
    once(event: string, listener: () => void) {
      listeners.push({ event, listener });
      return sprite;
    },
    play(config: string | { key: string }) {
      playing = typeof config === "string" ? config : config.key;
      return sprite;
    },
    scene: { anims: { exists: () => true } },
  };
  return {
    complete: (tag: string) => emit(`animationcomplete-${animationKey(KEY, tag)}`),
    sprite: sprite as unknown as GameObjects.Sprite,
    stop: () => emit("animationstop"),
  };
}

// Two ambient movers' art, each with a fly tag.
const FLYING_FROM = "ambient-geese";
const FLYING_TO = "ambient-bats";

// A pooled sprite playing FLYING_FROM's fly, on frame `on` of its eight, as handed to
// FLYING_TO's art, whose fly has newFrames frames. Records the start frame each play asks for.
function pooledSprite(on: number, newFrames: number) {
  const frames = Array.from({ length: 8 }, (_, index) => ({ index }));
  const startFrames: number[] = [];
  const sprite = {
    anims: {
      currentAnim: { frames, key: animationKey(FLYING_FROM, "fly") },
      currentFrame: frames[on],
      isPaused: false,
    },
    play(config: { startFrame: number }) {
      startFrames.push(config.startFrame);
      return sprite;
    },
    scene: {
      anims: { exists: () => true, get: () => ({ frames: Array.from({ length: newFrames }) }) },
      textures: { exists: () => false },
    },
    setOrigin: () => sprite,
    setScale: () => sprite,
    setTexture(key: string) {
      sprite.texture.key = key;
      return sprite;
    },
    setVertexRoundMode: () => sprite,
    texture: { key: FLYING_FROM },
  };
  return { sprite: sprite as unknown as GameObjects.Sprite, startFrames };
}

describe("showAtDepth", () => {
  it.each([
    [2, 4, 2],
    [3, 4, 3],
    [4, 4, 0],
    [7, 3, 0],
  ])(
    "carries a pooled sprite on frame %i into new art whose tag has %i frames from frame %i",
    (on, newFrames, startFrame) => {
      const { sprite, startFrames } = pooledSprite(on, newFrames);
      showAtDepth(sprite, FLYING_TO, 1);
      expect(startFrames).toEqual([startFrame]);
    },
  );
});

type Between = "again" | "nothing" | "otherTag" | "stop";

describe("playTagOnce", () => {
  it.each([
    ["completes", "nothing", ["first"]],
    ["is interrupted by another tag, then the tag plays again", "otherTag", []],
    ["is stopped", "stop", []],
    ["is replaced by another playTagOnce of the tag", "again", ["second"]],
  ] satisfies readonly [string, Between, string[]][])(
    "calls done only for the play that completes when it %s",
    (_, between, calls) => {
      const { complete, sprite, stop } = fakeSprite();
      const called: string[] = [];
      playTagOnce(sprite, KEY, "bark", () => called.push("first"));
      if (between === "otherTag") {
        playTag(sprite, KEY, "wag");
        playTag(sprite, KEY, "bark");
      } else if (between === "stop") {
        stop();
      } else if (between === "again") {
        playTagOnce(sprite, KEY, "bark", () => called.push("second"));
      }
      complete("bark");
      complete("bark");
      expect(called).toEqual(calls);
    },
  );
});
