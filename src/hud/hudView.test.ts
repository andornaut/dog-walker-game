import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { cents, clampHearts } from "../rules/units";
import { changeLabels, heartRows, outcomeLabels, pipLook, wholeDollars, zonePips } from "./hudView";

describe("changeLabels", () => {
  const skunkIgnore = { encounter: "skunk", kind: "encounter", option: 2 } as const;

  it("labels each heart change at its dog and money at the bank, with their causes", () => {
    const labels = outcomeLabels(gameData, {
      heartChanges: [
        {
          after: clampHearts(10, 3),
          before: clampHearts(10, 5),
          causes: [
            { amount: -1, kind: "effect", source: skunkIgnore },
            { amount: -1, kind: "temperament", temperament: "dramatic" },
          ],
          dog: "nugget",
          kind: "hearts",
        },
        {
          after: clampHearts(10, 6),
          before: clampHearts(10, 5),
          causes: [{ amount: 1, kind: "treat" }],
          dog: "koda",
          kind: "hearts",
        },
      ],
      moneyChanges: [
        {
          amount: cents(150),
          causes: [
            { amount: 100, kind: "tip" },
            { amount: 50, kind: "packSize", packSize: 1 },
          ],
          dog: null,
          kind: "money",
        },
      ],
    });
    expect(labels).toEqual([
      { gain: false, target: { dog: "nugget", kind: "dog" }, text: "−2 ♥, dramatic" },
      { gain: true, target: { dog: "koda", kind: "dog" }, text: "+1 ♥ treat" },
      { gain: true, target: { kind: "bank" }, text: "+$1.50 tip, solo" },
    ]);
  });

  it("has no labels without changes, and marks a loss at the bank as no gain", () => {
    expect(changeLabels(gameData, [])).toEqual([]);
    const clawback = {
      amount: cents(-1000),
      causes: [{ amount: -1000, kind: "clawback" }],
      dog: "pierre",
      kind: "money",
    } as const;
    expect(changeLabels(gameData, [clawback])).toEqual([
      { gain: false, target: { kind: "bank" }, text: "−$10 fees taken back" },
    ]);
  });
});

describe("wholeDollars", () => {
  it("drops the cents", () => {
    expect(wholeDollars(cents(4_299))).toBe("$42");
    expect(wholeDollars(cents(0))).toBe("$0");
  });
});

describe("heartRows", () => {
  it("fills the first hearts and leaves the rest of the meter empty", () => {
    expect(heartRows(8, 2, 4)).toEqual([[true, true, false, false]]);
  });

  it("wraps onto a second row past perRow, so 11 hearts take two rows", () => {
    const rows = heartRows(8, 9, 11);
    expect(rows.map((row) => row.length)).toEqual([8, 3]);
    expect(rows[1]).toEqual([true, false, false]);
  });

  it("has no rows for a meter of 0", () => {
    expect(heartRows(8, 0, 0)).toEqual([]);
  });
});

describe("zonePips", () => {
  it("shows the route walked, the current zone part filled, and unknown forks ahead", () => {
    expect(zonePips(4, ["street", "pawsPromenade"], 1, 0.25)).toEqual([
      { fill: 1, state: "done", zone: "street" },
      { fill: 0.25, state: "current", zone: "pawsPromenade" },
      { fill: 0, state: "todo", zone: null },
      { fill: 0, state: "todo", zone: null },
    ]);
  });

  it("shows the position after a zone as unknown until its fork is taken", () => {
    expect(zonePips(4, ["street"], 1, 0)).toEqual([
      { fill: 1, state: "done", zone: "street" },
      { fill: 0, state: "todo", zone: null },
      { fill: 0, state: "todo", zone: null },
      { fill: 0, state: "todo", zone: null },
    ]);
  });

  it("keeps the fill between 0 and 1", () => {
    expect(zonePips(1, ["street"], 0, 1.4)[0]?.fill).toBe(1);
    expect(zonePips(1, ["street"], 0, -1)[0]?.fill).toBe(0);
  });
});

describe("pipLook", () => {
  it("tags each pip by its zone, and fills the current one in the zone's road colour", () => {
    const pips = zonePips(3, ["street", "park"], 1, 0.5).map((pip) => pipLook(gameData, pip));
    expect(pips).toEqual([
      { tag: "woof-way-done", wellColor: "#3a4466" },
      { tag: "bark-park", wellColor: "#e4a672" },
      { tag: "todo", wellColor: null },
    ]);
  });
});
