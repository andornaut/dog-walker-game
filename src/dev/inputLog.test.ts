import { describe, expect, it } from "vitest";

import { defined } from "../testing/defined";
import {
  decodeInputLog,
  encodeInputLog,
  INPUT_LOG_VERSION,
  type InputEvent,
  type InputLog,
  recordInput,
  replayInputs,
  startInputLog,
  takeDueInputs,
} from "./inputLog";
import type { RunSetup, RunSetupLimits } from "./runSetup";

const limits: RunSetupLimits<"bo" | "koda", "collar"> = {
  dogIds: ["bo", "koda"],
  gearIds: ["collar"],
  maxPackSize: 3,
  speed: { max: 10, min: 0.1 },
  zoneCount: 4,
};
const setup: RunSetup<"bo" | "koda", "collar"> = {
  dev: false,
  gear: "collar",
  pack: ["koda", "bo"],
  seed: 31337,
  speed: 1,
  zone: 2,
};
const events: InputEvent[] = [
  { direction: -1, kind: "lane", timeMs: 1000 / 60 },
  { direction: 1, kind: "lane", timeMs: 2500.5 },
  { choice: 2, kind: "card", timeMs: 4000 },
  { choice: "skip", kind: "card", timeMs: 9000 },
  { kind: "treat", slot: 2, timeMs: 9500 },
  { kind: "home", timeMs: 10_000 },
];
const logOf = (logEvents: readonly InputEvent[]): InputLog =>
  logEvents.reduce((log, event) => recordInput(event, log), startInputLog<string, string>(setup));

const decodeOk = (json: string) => {
  const decoded = decodeInputLog(limits, json);
  if (!decoded.ok) {
    throw new Error(decoded.errors.join("; "));
  }
  return decoded.log;
};
const decodeErrors = (json: string) => {
  const decoded = decodeInputLog(limits, json);
  return decoded.ok ? [] : decoded.errors;
};
const encoded = (body: object) => JSON.stringify({ setup: "seed=1", version: 1, ...body });

describe("recording", () => {
  it("starts empty with the setup", () => {
    expect(startInputLog(setup)).toEqual({ events: [], setup });
  });

  it("appends each event without changing the log it was given", () => {
    const empty = startInputLog<string, string>(setup);
    const one = recordInput(defined(events[0]), empty);
    expect(empty.events).toEqual([]);
    expect(one.events).toEqual([events[0]]);
  });
});

describe("encodeInputLog and decodeInputLog", () => {
  it("round-trip the setup and every event, including fractional times", () => {
    const log = logOf(events);
    expect(decodeOk(encodeInputLog(log))).toEqual(log);
  });

  it("round-trip an empty log", () => {
    const log = startInputLog<string, string>({ dev: false, seed: 0, speed: 1, zone: 1 });
    expect(decodeOk(encodeInputLog(log))).toEqual(log);
  });

  it("write the format version, the setup as a query and each event as a tuple", () => {
    expect(JSON.parse(encodeInputLog(logOf(events.slice(1, 3))))).toEqual({
      events: [
        [2500.5, "l", 1],
        [4000, "c", 2],
      ],
      setup: "seed=31337&pack=koda,bo&gear=collar&zone=2",
      version: INPUT_LOG_VERSION,
    });
  });

  it("write a treat as its slot", () => {
    expect(JSON.parse(encodeInputLog(logOf(events.slice(4, 5)))).events).toEqual([[9500, "t", 2]]);
  });

  it("write heading home as its time alone", () => {
    expect(JSON.parse(encodeInputLog(logOf(events.slice(5)))).events).toEqual([[10_000, "h"]]);
  });

  it("still decode a version 1 log, from before treats were logged", () => {
    const json = encoded({
      events: [
        [100, "l", -1],
        [200, "c", "skip"],
      ],
    });
    expect(decodeOk(json).events).toEqual([
      { direction: -1, kind: "lane", timeMs: 100 },
      { choice: "skip", kind: "card", timeMs: 200 },
    ]);
  });

  it("still decode a version 2 log, from before heading home was logged", () => {
    const json = encoded({ events: [[100, "t", 1]], version: 2 });
    expect(decodeOk(json).events).toEqual([{ kind: "treat", slot: 1, timeMs: 100 }]);
  });

  it.each([
    ["not JSON", "{"],
    ["another version", encoded({ events: [], version: 4 })],
    ["a treat in a version 1 log", encoded({ events: [[0, "t", 1]] })],
    ["a fractional treat slot", encoded({ events: [[0, "t", 0.5]], version: 2 })],
    ["heading home in a version 2 log", encoded({ events: [[0, "h"]], version: 2 })],
    ["no events", encoded({ events: undefined })],
    ["an unknown event kind", encoded({ events: [[0, "x", 1]] })],
    ["a lane move of 2", encoded({ events: [[0, "l", 2]] })],
    ["a negative time", encoded({ events: [[-1, "l", 1]] })],
    ["a fractional choice", encoded({ events: [[0, "c", 1.5]] })],
    ["a setup with no seed", encoded({ events: [], setup: "zone=2" })],
    ["a setup with an unknown dog", encoded({ events: [], setup: "seed=1&pack=ghost" })],
  ])("reject %s", (_, json) => {
    expect(decodeErrors(json).length).toBeGreaterThan(0);
  });
});

describe("takeDueInputs", () => {
  const replayed: InputEvent[] = [
    { direction: 1, kind: "lane", timeMs: 100 },
    { kind: "treat", slot: 0, timeMs: 100 },
    { kind: "treat", slot: 1, timeMs: 200 },
    { choice: 0, kind: "card", timeMs: 200 },
    { direction: -1, kind: "lane", timeMs: 250 },
    { kind: "home", timeMs: 300 },
  ];

  it("takes the lane moves and treats due by the step's time, in order", () => {
    expect(takeDueInputs(replayed, 0, 150)).toEqual({ due: replayed.slice(0, 2), next: 2 });
  });

  it("applies a treat at the step it was given in, not before", () => {
    expect(takeDueInputs(replayed, 2, 199)).toEqual({ due: [], next: 2 });
    expect(takeDueInputs(replayed, 2, 200).due).toEqual([replayed[2]]);
  });

  it("stops at a card choice, which its card takes", () => {
    expect(takeDueInputs(replayed, 3, 1000)).toEqual({ due: [], next: 3 });
    expect(takeDueInputs(replayed, 4, 260)).toEqual({ due: [replayed[4]], next: 5 });
  });

  it("takes heading home at the step it came before", () => {
    expect(takeDueInputs(replayed, 5, 299)).toEqual({ due: [], next: 5 });
    expect(takeDueInputs(replayed, 5, 300)).toEqual({ due: [replayed[5]], next: 6 });
  });
});

describe("replayInputs", () => {
  it("yields the events in time order", () => {
    const shuffled = [events[2], events[5], events[4], events[0], events[3], events[1]].map(
      defined,
    );
    expect([...replayInputs(logOf(shuffled))]).toEqual(events);
  });

  it("keeps the recorded order of events at the same time", () => {
    const sameTime: InputEvent[] = [
      { direction: 1, kind: "lane", timeMs: 500 },
      { choice: 0, kind: "card", timeMs: 500 },
      { direction: -1, kind: "lane", timeMs: 500 },
    ];
    expect([...replayInputs(logOf(sameTime))]).toEqual(sameTime);
  });

  it("yields a decoded log's events like the original's", () => {
    const log = logOf(events);
    expect([...replayInputs(decodeOk(encodeInputLog(log)))]).toEqual([...replayInputs(log)]);
  });
});
