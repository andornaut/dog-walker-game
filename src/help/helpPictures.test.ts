import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
import { gameData } from "../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { HelpPictureId } from "../data/types";
import { cardRowSpec } from "../layout/cardLayout";
import { cardHeader, cardRowRects } from "../layout/cardRow";
import { laneCenterXs } from "../layout/lanes";
import { screenYAt } from "../layout/projection";
import { screenLayout } from "../layout/screenLayout";
import { forkPaths } from "../rules/route";
import { walkProjection } from "../runner/walkGeometry";
import { packDogs } from "../state/pack";
import { HELP_LAYOUT } from "./helpLayout";
import { HELP_SCENES, helpPicture, type PictureStrip } from "./helpPictures";

const SCREEN = screenLayout(SCREEN_CONFIG);
const PROJECTION = walkProjection(ROAD_CAMERA, SCREEN.road);
const LANES = laneCenterXs(LANE_COUNT, SCREEN.road);
const IDS = gameData.help.map((page) => page.art);
const shows = (strips: readonly PictureStrip[], row: number) =>
  strips.some((strip) => row >= strip.screenY && row < strip.screenY + strip.height);

describe("helpPicture", () => {
  it.each(IDS)("fills the %s picture with strips of the screen", (id) => {
    const { strips } = helpPicture(gameData, id);
    expect(strips.reduce((sum, strip) => sum + strip.height, 0)).toBe(
      HELP_LAYOUT.illustration.height,
    );
    for (const strip of strips) {
      expect(strip.screenY).toBeGreaterThanOrEqual(0);
      expect(strip.screenY + strip.height).toBeLessThanOrEqual(SCREEN_CONFIG.height);
    }
  });

  it.each<HelpPictureId>(["lanes", "owners", "pickups", "pulls"])(
    "shows the walker's feet and every road item's feet in the %s picture",
    (id) => {
      const { strips, walk } = helpPicture(gameData, id);
      const rows = walk.road.items.map((item) =>
        Math.round(screenYAt(PROJECTION, PROJECTION.footY - (item.y + item.height))),
      );
      expect([PROJECTION.footY, ...rows].filter((row) => !shows(strips, row))).toEqual([]);
    },
  );

  it.each<HelpPictureId>(["cards", "zones"])(
    "shows the %s card's title and its cards whole",
    (id) => {
      const { card, strips } = helpPicture(gameData, id);
      const count = card?.options.length ?? 0;
      const rects = cardRowRects(cardRowSpec(count), count, SCREEN.roadView);
      const { titleTop } = cardHeader(false, rects);
      const bottoms = rects.map((rect) => rect.y + rect.height - 1);
      expect([titleTop, ...bottoms].filter((row) => !shows(strips, row))).toEqual([]);
    },
  );

  it("shows the bank, the tips grabbed on top of the starting purse, and the pip partway", () => {
    const { tips, zoneFraction } = HELP_SCENES.pickups;
    const { walk, zoneFraction: shown } = helpPicture(gameData, "pickups");
    const { startPurse, tip } = gameData.tuning.money;
    expect(walk.run.money).toBe((startPurse + tips * tip) * 100);
    expect(walk.run.zoneIndex).toBe(1);
    expect(shown).toBe(zoneFraction);
  });

  it("shows every option of the encounter's card as one the walk can afford", () => {
    const { encounter } = HELP_SCENES.cards;
    const { card } = helpPicture(gameData, "cards");
    const { resolution } = gameData.encounters[encounter];
    const names = "options" in resolution ? resolution.options.map(({ name }) => name) : [];
    expect(card?.options.map((option) => option.label)).toEqual(names);
    expect(card?.options.every((option) => option.availability.enabled)).toBe(true);
  });

  it("shows each owner's hearts by their dog's size, the speaker's less what the bump took", () => {
    const { fired, speaker } = HELP_SCENES.owners;
    const { changes, quips, walk } = helpPicture(gameData, "owners");
    const hearts = walk.run.pack.map((slot) => (slot.status === "walking" ? slot.hearts : null));
    const expected = walk.run.pack.map(({ dog }) => {
      if (dog === fired) {
        return null;
      }
      const max = gameData.tuning.hearts.maxBySize[gameData.dogs[dog].size];
      return dog === speaker.dog ? max - speaker.lost : max;
    });
    expect(hearts).toEqual(expected);
    expect(changes).toEqual([expect.objectContaining({ dog: speaker.dog, kind: "hearts" })]);
    expect(quips).toEqual([
      { dog: speaker.dog, text: itemAt(gameData.quips[speaker.dog][speaker.mood], speaker.quip) },
    ]);
  });

  it("shows the fork after the first neighborhood, its paths easiest first, each with its pay", () => {
    const { card, walk } = helpPicture(gameData, "zones");
    const paths = forkPaths(gameData, () => 0, walk.run.route);
    expect(card?.options.map((option) => option.path?.zone)).toEqual(paths);
    expect(card?.options.map((option) => option.path?.fees)).toEqual(
      paths.map((path) => gameData.world.zones.find((zone) => zone.id === path)?.fees),
    );
  });

  it("strains the dog nearer the squirrel toward it", () => {
    const { pulls, walk } = helpPicture(gameData, "pulls");
    const { squirrel, strainer } = HELP_SCENES.pulls;
    expect(packDogs(walk.run)).toContain(strainer);
    expect(pulls.strain).toEqual(expect.objectContaining({ direction: 1, dog: strainer }));
    expect(walk.road.items.map((item) => item.lane)).toEqual([squirrel.lane]);
  });

  it("drags from a lane's centre and moves the pack one lane right, toward its lane", () => {
    const { packMove, touch, walk } = helpPicture(gameData, "lanes");
    const { lane, touch: drag } = HELP_SCENES.lanes;
    expect(touch?.start.x).toBe(itemAt(LANES, drag.fromLane));
    expect(walk.road.control.motion).toEqual({ kind: "still", lane });
    expect(packMove?.fromX).toBeGreaterThan(itemAt(LANES, lane - 1));
    expect(packMove?.chevronX).toBeLessThan(itemAt(LANES, lane));
  });
});
