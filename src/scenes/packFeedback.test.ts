import type { GameObjects, Scene } from "phaser";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { floatValue } from "./buffCharm";
import { playDodge, playForgiven } from "./packFeedback";

// A drawn part: a label with its text, a box, or a container of parts in its own order.
interface Part {
  children: Part[];
  depth: number;
  kind: "box" | "container" | "label";
  text: string;
}

// A scene with no fonts loaded that records what it draws: each part it adds, at its depth, and
// each container's parts, which leave the scene's list as Phaser moves them into the container.
function fakeScene(): { drawn: () => Part[]; scene: Scene } {
  const list: Part[] = [];
  const add = (part: Part) => {
    list.push(part);
    const object = {
      destroy: () => object,
      fillRect: () => object,
      fillStyle: () => object,
      getData: () => undefined,
      getTextBounds: () => ({ characters: [] }),
      part,
      scaleX: 1,
      setData: () => object,
      setDepth: (depth: number) => {
        part.depth = depth;
        return object;
      },
      setOrigin: () => object,
      setPosition: () => object,
      setScale: () => object,
      setTint: () => object,
    };
    return object;
  };
  const scene = {
    add: {
      bitmapText: (_x: number, _y: number, _font: string, text: string) =>
        add({ children: [], depth: 0, kind: "label", text }),
      container: (_x: number, _y: number, children: { part: Part }[]) => {
        const parts = children.map(({ part }) => part);
        parts.forEach((part) => list.splice(list.indexOf(part), 1));
        return add({ children: parts, depth: 0, kind: "container", text: "" });
      },
      graphics: () => add({ children: [], depth: 0, kind: "box", text: "" }),
    },
    cache: { bitmapFont: { exists: () => false } },
    tweens: { add: () => ({}) },
  };
  return { drawn: () => list, scene: scene as unknown as Scene };
}

// The parts in the order they paint: the scene's list sorted by depth, stably, as Phaser sorts
// it, each container's parts in its own order.
function paintOrder(list: readonly Part[]): Part[] {
  const painted = (part: Part): Part[] =>
    part.kind === "container" ? part.children.flatMap(painted) : [part];
  return [...list].sort((a, b) => a.depth - b.depth).flatMap(painted);
}

const STILL = { depth: 2500, still: true };
const TOP = { x: 100, y: 300 };
const dog = { getTopCenter: () => TOP } as unknown as GameObjects.Sprite;

describe("a floating label over the road", () => {
  it.each([
    {
      name: "the dodge label",
      play: (scene: Scene) => playDodge(scene, STILL, dog),
      text: gameData.runText.dodge,
    },
    {
      name: "the forgiven label",
      play: (scene: Scene) => playForgiven(scene, STILL, { pop: null, top: TOP }),
      text: gameData.runText.forgiven,
    },
    {
      name: "a buff's value",
      play: (scene: Scene) =>
        floatValue(
          scene,
          { ...STILL, shownAtMs: 0 },
          { centreX: TOP.x, lineBottom: TOP.y },
          gameData.runText.waivedCost,
        ),
      text: gameData.runText.waivedCost,
    },
  ])("paints $name's text over its chip", ({ play, text }) => {
    const { drawn, scene } = fakeScene();
    play(scene);
    const order = paintOrder(drawn());
    const box = order.findIndex((part) => part.kind === "box");
    const label = order.findIndex((part) => part.kind === "label");
    expect(box).toBeGreaterThanOrEqual(0);
    expect(label).toBeGreaterThan(box);
    expect(order[label]?.text.toLowerCase()).toBe(text.toLowerCase());
  });
});
