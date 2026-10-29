import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { ROAD_CAMERA, SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import type { HelpPictureId } from "../data/types";
import { cardRowIn } from "../layout/cardLayout";
import { screenYAt } from "../layout/projection";
import { itemAt } from "../lib/arrays";
import { currentZoneId, forkPaths } from "../rules/route";
import { walkProjection } from "../runner/walkGeometry";
import { cardHeader } from "../ui/cardRow";
import { HELP_LAYOUT } from "./helpLayout";
import {
  dragGlide,
  type DragLoop,
  dragMomentAt,
  HELP_SCENES,
  helpPicture,
  type PictureStrip,
  stillDragMoment,
  TOUCH_DRAG,
} from "./helpPictures";

const SCREEN = SCREEN_LAYOUT;
const PROJECTION = walkProjection(ROAD_CAMERA, SCREEN.road);
const IDS = gameData.help.map((page) => page.art);
const shows = (strips: readonly PictureStrip[], row: number) =>
  strips.some((strip) => row >= strip.screenY && row < strip.screenY + strip.height);

describe("helpPicture", () => {
  // Every picture fills its frame with strips of the screen that show the walker's feet, every
  // road item's feet, and a card's title and cards whole.
  it("frames every picture from strips of the screen showing what it is about", () => {
    for (const id of IDS) {
      const { strips } = helpPicture(gameData, id);
      expect(
        strips.reduce((sum, strip) => sum + strip.height, 0),
        id,
      ).toBe(HELP_LAYOUT.illustration.height);
      for (const strip of strips) {
        expect(strip.screenY).toBeGreaterThanOrEqual(0);
        expect(strip.screenY + strip.height).toBeLessThanOrEqual(SCREEN_CONFIG.height);
      }
    }
    const roads: HelpPictureId[] = ["lanes", "owners", "pickups", "pulls"];
    const unseen = roads.flatMap((id) => {
      const { strips, walk } = helpPicture(gameData, id);
      const rows = walk.road.items.map((item) =>
        Math.round(screenYAt(PROJECTION, PROJECTION.footY - (item.y + item.height))),
      );
      return [PROJECTION.footY, ...rows]
        .filter((row) => !shows(strips, row))
        .map((row) => `${id} ${row}`);
    });
    const cards: HelpPictureId[] = ["cards", "zones"];
    const uncut = cards.flatMap((id) => {
      const { card, strips } = helpPicture(gameData, id);
      const count = card?.options.length ?? 0;
      const rects = cardRowIn(SCREEN.walkView, count, count);
      const { titleTop } = cardHeader(false, rects);
      const bottoms = rects.map((rect) => rect.y + rect.height - 1);
      return [titleTop, ...bottoms]
        .filter((row) => !shows(strips, row))
        .map((row) => `${id} ${row}`);
    });
    expect([...unseen, ...uncut]).toEqual([]);
  });

  it("shows every option of the encounter's card as one the walk can afford", () => {
    const { encounter } = HELP_SCENES.cards;
    const { card } = helpPicture(gameData, "cards");
    const { resolution } = gameData.encounters[encounter];
    const names = "options" in resolution ? resolution.options.map(({ name }) => name) : [];
    expect(card?.options.map((option) => option.label)).toEqual(names);
    expect(card?.options.every((option) => option.availability.enabled)).toBe(true);
  });

  it("shows each owner's hearts by their dog's size, the bumped dog's less what the bump took", () => {
    const { bumped, fired } = HELP_SCENES.owners;
    const { changes, walk } = helpPicture(gameData, "owners");
    const hearts = walk.run.pack.map((slot) => (slot.status === "walking" ? slot.hearts : null));
    const expected = walk.run.pack.map(({ dog }) => {
      if (dog === fired) {
        return null;
      }
      const max = gameData.tuning.hearts.maxBySize[gameData.dogs[dog].size];
      return dog === bumped.dog ? max - bumped.lost : max;
    });
    expect(hearts).toEqual(expected);
    expect(changes).toEqual([expect.objectContaining({ dog: bumped.dog, kind: "hearts" })]);
  });

  it.each([["pickups"]] satisfies [HelpPictureId][])(
    "walks %s in a zone that is neither the walk's first nor its last",
    (id) => {
      const { firstZone, lastZone } = gameData.world;
      const zone = currentZoneId(gameData, helpPicture(gameData, id).walk.run);
      expect([firstZone, lastZone]).not.toContain(zone);
    },
  );

  // A minor obstacle or card obstacle on a picture's road, or its card's encounter, is one its
  // neighbourhood brings.
  it.each(IDS)("shows on %s only obstacles its neighbourhood brings", (id) => {
    const { card, walk } = helpPicture(gameData, id);
    const zoneId = currentZoneId(gameData, walk.run);
    const zone = gameData.world.zones.find((candidate) => candidate.id === zoneId);
    const weights: Readonly<Record<string, number>> = {
      ...zone?.weights.minorObstacles,
      ...zone?.weights.obstacles,
    };
    const encounter = card?.source.kind === "encounter" ? [card.source.encounter] : [];
    const kinds = [...walk.road.items.map((item) => item.kind), ...encounter];
    expect(kinds.filter((kind) => weights[kind] === 0)).toEqual([]);
  });

  it("shows the fork after the first neighbourhood, its paths easiest first", () => {
    const { card, walk } = helpPicture(gameData, "zones");
    const paths = forkPaths(gameData, () => 0, walk.run.route);
    expect(card?.options.map((option) => option.path?.zone)).toEqual(paths);
  });
});

describe("dragMomentAt", () => {
  const loop = helpPicture(gameData, "lanes").drag as DragLoop;
  const { fromLane, toLane } = loop;
  const { dragPx } = TOUCH_DRAG;
  // A swipe of even frames, frame ms apart, its drag frames followed by two more.
  const frame = 100;
  const frameMs = Array.from({ length: dragPx.from + dragPx.px.length + 2 }, () => frame);
  const swipe = frameMs.length * frame;
  const swipeStart = itemAt(dragPx.px, 2);
  const glide = dragGlide(frameMs, swipeStart);
  const at = (ms: number) => dragMomentAt(frameMs, swipeStart, loop, ms / 1000);
  const nudge = 1;

  it("glides the pack from the frame whose drag reaches the first lane step", () => {
    expect(glide.start).toBe((dragPx.from + 2) * frame);
    expect(glide.end - glide.start).toBe(HELP_SCENES.lanes.glideFrames * frame);
  });

  // Each moment: ms into the loop, then the swipe's tag and frame, and the pack's lane (or
  // "moving").
  it.each([
    ["the swipe right's first frame", nudge, "right", 0, fromLane],
    ["the swipe right before its glide", glide.start - nudge, "right", dragPx.from + 1, fromLane],
    ["the swipe right's glide", glide.start + nudge, "right", dragPx.from + 2, "moving"],
    ["the swipe right after its glide", glide.end + nudge, "right", dragPx.from + 5, toLane],
    ["the swipe right's last frame", swipe - nudge, "right", frameMs.length - 1, toLane],
    ["the swipe left's first frame", swipe + nudge, "left", 0, toLane],
    ["the swipe left's glide", swipe + glide.start + nudge, "left", dragPx.from + 2, "moving"],
    ["the swipe left's last frame", 2 * swipe - nudge, "left", frameMs.length - 1, fromLane],
    ["the swipe right again", 2 * swipe + nudge, "right", 0, fromLane],
  ] as const)("shows %s", (_name, ms, tag, index, lane) => {
    const moment = at(ms);
    expect(moment.touch).toEqual({ index, tag });
    expect(moment.motion.kind === "still" ? moment.motion.lane : "moving").toBe(lane);
    expect(moment.packMove).toBeNull();
  });

  it("holds the still swipe with the pack in its new lane and the move's marks", () => {
    const still = stillDragMoment(loop);
    expect(still.touch).toEqual({ index: 0, tag: "still" });
    expect(still.motion).toEqual({ kind: "still", lane: toLane });
    expect(still.packMove).toEqual(loop.packMove);
  });
});
