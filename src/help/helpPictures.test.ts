import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { HelpPictureId } from "../data/types";
import { cardRowSpec } from "../layout/cardLayout";
import { screenYAt } from "../layout/projection";
import { screenLayout } from "../layout/screenLayout";
import { currentZoneId, forkPaths } from "../rules/route";
import { walkProjection } from "../runner/walkGeometry";
import { cardHeader, cardRowRects } from "../ui/cardRow";
import { HELP_LAYOUT } from "./helpLayout";
import { HELP_SCENES, helpPicture, type PictureStrip } from "./helpPictures";

const SCREEN = screenLayout(SCREEN_CONFIG);
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
      const rects = cardRowRects(cardRowSpec(count), count, SCREEN.roadView);
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

  it("shows the fork after the first neighborhood, its paths easiest first, each with its pay", () => {
    const { card, walk } = helpPicture(gameData, "zones");
    const paths = forkPaths(gameData, () => 0, walk.run.route);
    expect(card?.options.map((option) => option.path?.zone)).toEqual(paths);
    expect(card?.options.map((option) => option.path?.fees)).toEqual(
      paths.map((path) => gameData.world.zones.find((zone) => zone.id === path)?.fees),
    );
  });
});
