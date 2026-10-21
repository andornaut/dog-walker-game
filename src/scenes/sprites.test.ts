import type { GameObjects } from "phaser";
import { describe, expect, it } from "vitest";

import { animationKey } from "../assets/asepriteAnimations";
import { playTag, playTagOnce } from "./sprites";

const KEY = "dog-koda";

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
