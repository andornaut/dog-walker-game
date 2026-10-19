import { describe, expect, it } from "vitest";

import { itemsOnRoad, scrollRoadItems } from "./roadItems";

const tip = { height: 32, id: 1, kind: "tip", lane: 2, laneSpan: 1, y: 100 };

describe("scrollRoadItems", () => {
  it("moves every item down by the distance scrolled, keeping its lane", () => {
    expect(scrollRoadItems(12.5, [tip, { ...tip, id: 2, y: 300 }])).toEqual([
      { ...tip, y: 112.5 },
      { ...tip, id: 2, y: 312.5 },
    ]);
  });
});

describe("itemsOnRoad", () => {
  it("keeps items until their top edge passes the bottom of the road", () => {
    const partly = { ...tip, y: 639 };
    const gone = { ...tip, id: 2, y: 640 };
    expect(itemsOnRoad(640, [partly, gone])).toEqual([partly]);
  });
});
