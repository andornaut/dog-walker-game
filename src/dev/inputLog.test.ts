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

const limits: RunSetupLimits<"bo" | "kilo", "collar"> = {
  dogIds: ["bo", "kilo"],
  gearIds: ["collar"],
  maxPackSize: 3,
  speed: { max: 10, min: 0.1 },
  walkerIds: ["ada", "casey"],
  zoneCount: 4,
  zoneIds: ["distilleryDistrict", "highPark", "kensingtonMarket", "yongeStreet", "theBeaches"],
};
const setup: RunSetup<"bo" | "kilo", "collar"> = {
  dev: false,
  gear: "collar",
  pack: ["kilo", "bo"],
  seed: 31337,
  speed: 1,
  zone: 2,
};
const events: InputEvent[] = [
  { direction: -1, kind: "lane", timeMs: 1000 / 60 },
  { direction: 1, kind: "lane", timeMs: 2500.5 },
  { choice: 2, kind: "card", timeMs: 4000 },
  { choice: "skip", kind: "card", timeMs: 9000 },
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
const encoded = (body: object) =>
  JSON.stringify({ setup: "seed=1", version: INPUT_LOG_VERSION, ...body });

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
    const empty = startInputLog<string, string>({ dev: false, seed: 0, speed: 1, zone: 1 });
    expect(decodeOk(encodeInputLog(empty))).toEqual(empty);
  });

  it("write the format version, the setup as a query and each event as a tuple", () => {
    expect(JSON.parse(encodeInputLog(logOf(events.slice(1))))).toEqual({
      events: [
        [2500.5, "l", 1],
        [4000, "c", 2],
        [9000, "c", "skip"],
        [10_000, "h"],
      ],
      setup: "seed=31337&pack=kilo,bo&gear=collar&zone=2",
      version: INPUT_LOG_VERSION,
    });
  });

  const invalid: [string, string][] = [
    ["not JSON", "{"],
    ["an older version", encoded({ events: [], version: INPUT_LOG_VERSION - 1 })],
    ["a newer version", encoded({ events: [], version: INPUT_LOG_VERSION + 1 })],
    ["no events", encoded({ events: undefined })],
    ["an unknown event kind", encoded({ events: [[0, "x", 1]] })],
    ["a lane move of 2", encoded({ events: [[0, "l", 2]] })],
    ["a negative time", encoded({ events: [[-1, "l", 1]] })],
    ["a fractional choice", encoded({ events: [[0, "c", 1.5]] })],
    ["a setup with no seed", encoded({ events: [], setup: "zone=2" })],
    ["a setup with an unknown dog", encoded({ events: [], setup: "seed=1&pack=ghost" })],
    ["a setup with unknown gear", encoded({ events: [], setup: "seed=1&gear=bags" })],
  ];

  it("reject a log of another version or with an event or setup they cannot read", () => {
    const accepted = invalid.filter(([, json]) => decodeErrors(json).length === 0);
    expect(accepted.map(([name]) => name)).toEqual([]);
  });
});

describe("takeDueInputs", () => {
  const replayed: InputEvent[] = [
    { direction: 1, kind: "lane", timeMs: 100 },
    { direction: -1, kind: "lane", timeMs: 150 },
    { choice: 0, kind: "card", timeMs: 200 },
    { direction: -1, kind: "lane", timeMs: 250 },
    { kind: "home", timeMs: 300 },
  ];

  const steps: [string, number, number, number[], number][] = [
    ["takes the lane moves due by the step's time, in order", 0, 150, [0, 1], 2],
    ["holds a lane move until its step", 1, 149, [], 1],
    ["stops at a card choice, which its card takes", 2, 1000, [], 2],
    ["takes a lane move after the card choice", 3, 260, [3], 4],
    ["holds heading home until its step", 4, 299, [], 4],
    ["takes heading home at the step it came before", 4, 300, [4], 5],
  ];

  it("takes the inputs due by each step, stopping at a card choice", () => {
    for (const [name, from, nowMs, due, next] of steps) {
      expect(takeDueInputs(replayed, from, nowMs), name).toEqual({
        due: due.map((index) => replayed[index]),
        next,
      });
    }
  });
});

describe("takeCardChoice", () => {
  it("takes the card choice next in line, whatever its time, and nothing else", () => {
    expect(takeCardChoice(events, 3)).toEqual({ choice: "skip", next: 4 });
    expect(takeCardChoice(events, 0)).toEqual({ choice: undefined, next: 0 });
    expect(takeCardChoice(events, events.length)).toEqual({
      choice: undefined,
      next: events.length,
    });
  });
});

describe("replayInputs", () => {
  it("yields the events in time order, keeping the recorded order of events at the same time", () => {
    const shuffled = [events[2], events[4], events[0], events[3], events[1]].map(defined);
    expect([...replayInputs(logOf(shuffled))]).toEqual(events);
    const sameTime: InputEvent[] = [
      { direction: 1, kind: "lane", timeMs: 500 },
      { choice: 0, kind: "card", timeMs: 500 },
      { direction: -1, kind: "lane", timeMs: 500 },
    ];
    expect([...replayInputs(logOf(sameTime))]).toEqual(sameTime);
  });
});
