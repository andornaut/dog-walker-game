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
  takeCardChoice,
  takeDueInputs,
} from "./inputLog";
import type { RunSetup, RunSetupLimits } from "./runSetup";

const limits: RunSetupLimits<"bo" | "koda", "collar"> = {
  dogIds: ["bo", "koda"],
  gearIds: ["collar"],
  maxPackSize: 3,
  renamedDogIds: new Map([["dash", "koda"]]),
  speed: { max: 10, min: 0.1 },
  zoneCount: 4,
  zoneIds: ["street", "park", "shops", "homeStretch", "pawsPromenade"],
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
    expect(JSON.parse(encodeInputLog(logOf(events.slice(1))))).toEqual({
      events: [
        [2500.5, "l", 1],
        [4000, "c", 2],
        [9000, "c", "skip"],
        [9500, "t", 2],
        [10_000, "h"],
      ],
      setup: "seed=31337&pack=koda,bo&gear=collar&zone=2",
      version: INPUT_LOG_VERSION,
    });
  });

  it.each<[string, string, InputEvent[]]>([
    [
      "a version 1 log, from before treats were logged",
      encoded({
        events: [
          [100, "l", -1],
          [200, "c", "skip"],
        ],
      }),
      [
        { direction: -1, kind: "lane", timeMs: 100 },
        { choice: "skip", kind: "card", timeMs: 200 },
      ],
    ],
    [
      "a version 2 log, from before heading home was logged",
      encoded({ events: [[100, "t", 1]], version: 2 }),
      [{ kind: "treat", slot: 1, timeMs: 100 }],
    ],
  ])("still decode %s", (_name, json, expected) => {
    expect(decodeOk(json).events).toEqual(expected);
  });

  it("decode a renamed dog id in the setup as the dog it is now", () => {
    const json = encoded({ events: [], setup: "seed=1&pack=bo,dash" });
    expect(decodeOk(json).setup.pack).toEqual(["bo", "koda"]);
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

  it.each([
    ["takes the lane moves and treats due by the step's time, in order", 0, 150, [0, 1], 2],
    ["holds a treat until the step it was given in", 2, 199, [], 2],
    ["applies a treat at the step it was given in", 2, 200, [2], 3],
    ["stops at a card choice, which its card takes", 3, 1000, [], 3],
    ["takes a lane move after the card choice", 4, 260, [4], 5],
    ["holds heading home until its step", 5, 299, [], 5],
    ["takes heading home at the step it came before", 5, 300, [5], 6],
  ])("%s", (_name, from, nowMs, due, next) => {
    expect(takeDueInputs(replayed, from, nowMs)).toEqual({
      due: due.map((index) => replayed[index]),
      next,
    });
  });
});

describe("takeCardChoice", () => {
  it.each([
    ["takes the card choice next in line, whatever its time", 2, 2, 3],
    ["takes a skip", 3, "skip", 4],
    ["takes nothing when the next event is not a card choice", 0, undefined, 0],
    ["takes nothing after the last event", events.length, undefined, events.length],
  ])("%s", (_name, from, choice, next) => {
    expect(takeCardChoice(events, from)).toEqual({ choice, next });
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
