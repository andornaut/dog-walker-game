import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { changeHearts } from "../rules/effects";
import { firstZoneId } from "../rules/route";
import { saveContextFrom } from "../save/load";
import { createDefaultSave } from "../save/schema";
import { heartsOf } from "../state/pack";
import { testState } from "../testing/runState";
import { newPlayerSave, veteranSave } from "../testing/saves";
import {
  applyPanel,
  applySaveEdit,
  CHEAT_TOGGLES,
  type Cheats,
  CHEATS_OFF,
  cheatsFrom,
  cheatsInUse,
  decodeCheats,
  decodeSaveEdits,
  encodeCheats,
  encodeSaveEdits,
  hasStagedChanges,
  openPanel,
  type PanelAction,
  type PanelState,
  RESET_SAVE,
  SAVE_CHEATS,
  type SaveEdit,
  setCheat,
  setSpeed,
  SPEED_LABEL,
  SPEEDS,
  stagePanel,
  START_SCREEN,
  startChoices,
  timeScaleOf,
  withCheats,
} from "./devPanelModel";
import { runSetupLimitsFor } from "./pageRunSetup";
import { parseRunSetup } from "./runSetup";

const context = saveContextFrom(gameData);
const every = CHEAT_TOGGLES.reduce(
  (cheats, { id }) => setCheat(id, true, cheats),
  setSpeed("fast", CHEATS_OFF),
);
const hitBoxes = setCheat("hitBoxes", true, CHEATS_OFF);

// A label of a few words, with no helper text.
const SHORT_LABEL = /^[+$\w,]+( \w+){0,2}$/;

describe("the cheat list", () => {
  it("has one toggle for each switch cheat and one speed choice, each labelled in a few words", () => {
    const ids = CHEAT_TOGGLES.map(({ id }) => id);
    const switches = Object.keys(CHEATS_OFF).filter((key) => key !== "speed");
    expect([...ids].sort()).toEqual(switches.sort());
    expect(SPEEDS.map(({ id }) => id)).toContain(CHEATS_OFF.speed);
    const labels = [...CHEAT_TOGGLES, ...SAVE_CHEATS, ...SPEEDS].map(({ label }) => label);
    expect([...labels, SPEED_LABEL].filter((label) => !SHORT_LABEL.test(label))).toEqual([]);
  });
});

describe("setCheat and setSpeed", () => {
  it("change one cheat each, and hold one speed at a time", () => {
    expect(setCheat("invincible", true, CHEATS_OFF)).toEqual({ ...CHEATS_OFF, invincible: true });
    expect(setCheat("invincible", false, every)).toEqual({ ...every, invincible: false });
    expect(setSpeed("fast", setSpeed("slow", CHEATS_OFF)).speed).toBe("fast");
  });
});

describe("cheatsInUse", () => {
  it.each<[string, Cheats, boolean]>([
    ["every cheat off", CHEATS_OFF, false],
    ["every cheat on", every, true],
    // One toggle and one speed other than normal stand for the rest, each read alike.
    ["only hit boxes", hitBoxes, true],
    ["only another speed", setSpeed("slow", CHEATS_OFF), true],
  ])("with %s: %s", (_, cheats, inUse) => {
    expect(cheatsInUse(cheats)).toBe(inUse);
  });
});

describe("stored cheats", () => {
  it("reads and decodes anything but stored cheats as every cheat off", () => {
    for (const value of [undefined, { on: true }, "on"]) {
      expect(cheatsFrom(value)).toEqual(CHEATS_OFF);
    }
    for (const text of [null, "{"]) {
      expect(decodeCheats(text)).toEqual(CHEATS_OFF);
    }
    expect(decodeCheats(encodeCheats(every))).toEqual(every);
  });

  it.each([
    ["an unknown speed", { ...every, speed: "warp" }, { ...every, speed: "normal" }],
    [
      "the two speed toggles",
      { ...every, fastForward: true, on: true, speed: undefined },
      { ...every, speed: "normal" },
    ],
    ["an on field", { ...every, on: false }, every],
    ["a missing toggle", { hitBoxes: true, speed: "slow" }, { ...hitBoxes, speed: "slow" }],
    ["a toggle not stored as true", { ...every, devStats: "yes" }, { ...every, devStats: false }],
  ])("decodes %s, keeping the cheats it names", (_, stored, expected) => {
    expect(decodeCheats(JSON.stringify(stored))).toEqual(expected);
  });

  it.each(SPEEDS)("runs time at the $id speed's scale", ({ id, scale }) => {
    expect(timeScaleOf(setSpeed(id, CHEATS_OFF))).toBe(scale);
  });
});

describe("withCheats", () => {
  const run = testState({ biscuit: 2 });
  const loss = [{ amount: -1, kind: "bump" }] as const;
  const gain = [{ amount: 1, kind: "treat" }] as const;

  it("keeps an invincible owner's hearts from falling", () => {
    const hearts = (cheats: Cheats, causes: typeof loss | typeof gain) =>
      heartsOf(changeHearts(gameData, causes, "biscuit", withCheats(cheats, run)).state, "biscuit");
    const invincible = setCheat("invincible", true, CHEATS_OFF);
    expect(hearts(invincible, loss)).toBe(2);
    expect(hearts(invincible, gain)).toBe(3);
    expect(hearts(CHEATS_OFF, loss)).toBe(1);
  });
});

describe("save edits", () => {
  const newPlayer = () => createDefaultSave(context.defaults);
  const edited = (edit: SaveEdit) => applySaveEdit(gameData, newPlayer, edit, veteranSave());

  it("adds money, unlocks everything and resets", () => {
    const addMoney = SAVE_CHEATS.flatMap(({ edit }) => (edit.kind === "addMoney" ? [edit] : []));
    for (const edit of addMoney) {
      expect(edited(edit).bankCents).toBe(veteranSave().bankCents + edit.amount);
    }
    const unlocked = edited({ kind: "unlockAll" }).owned;
    expect(new Set(unlocked.dogs)).toEqual(new Set(Object.keys(gameData.dogs)));
    expect(new Set(unlocked.walkers)).toEqual(new Set(Object.keys(gameData.walkers)));
    expect(edited(RESET_SAVE)).toEqual(newPlayerSave);
  });

  it("decodes stored edits, dropping a bad one and anything but a list", () => {
    const all = [...SAVE_CHEATS.map(({ edit }) => edit), RESET_SAVE];
    expect(decodeSaveEdits(encodeSaveEdits(all))).toEqual(all);
    expect(decodeSaveEdits('[{"kind":"addMoney","amount":-5},{"kind":"reset"}]')).toEqual([
      RESET_SAVE,
    ]);
    for (const text of [null, "[", '{"kind":"reset"}']) {
      expect(decodeSaveEdits(text)).toEqual([]);
    }
  });
});

describe("staged settings", () => {
  const opened = openPanel(hitBoxes);
  const stageAll = (actions: readonly PanelAction[]) =>
    actions.reduce((state, action) => stagePanel(action, state), opened);

  it("stages changes without applying them, and Cancel drops them", () => {
    expect(opened).toEqual({ applied: hitBoxes, staged: hitBoxes, start: START_SCREEN });
    expect(stageAll([{ kind: "start", start: "park" }])).toEqual({
      applied: hitBoxes,
      staged: hitBoxes,
      start: "park",
    });
    expect(stageAll([{ kind: "speed", speed: "slow" }]).staged).toEqual(setSpeed("slow", hitBoxes));
    const cancelled: PanelAction[] = [
      { kind: "speed", speed: "fast" },
      { id: "hitBoxes", kind: "toggle", on: false },
      { kind: "start", start: "park" },
      { kind: "cancel" },
    ];
    expect(stageAll(cancelled)).toEqual(opened);
  });
});

describe("hasStagedChanges", () => {
  const stageFrom = (applied: Cheats, actions: readonly PanelAction[]) =>
    actions.reduce((state, action) => stagePanel(action, state), openPanel(applied));

  it.each<{ actions: PanelAction[]; applied: Cheats; enabled: boolean; name: string }>([
    { actions: [], applied: CHEATS_OFF, enabled: false, name: "no cheats, untouched" },
    { actions: [], applied: every, enabled: false, name: "every cheat, untouched" },
    {
      actions: [{ id: "hitBoxes", kind: "toggle", on: true }],
      applied: CHEATS_OFF,
      enabled: true,
      name: "no cheats, a toggle staged",
    },
    {
      actions: [
        { id: "invincible", kind: "toggle", on: true },
        { id: "invincible", kind: "toggle", on: false },
      ],
      applied: CHEATS_OFF,
      enabled: false,
      name: "no cheats, a toggle staged then unstaged",
    },
    {
      actions: [{ id: "invincible", kind: "toggle", on: false }],
      applied: every,
      enabled: true,
      name: "every cheat, a toggle cleared",
    },
    {
      actions: [{ kind: "speed", speed: "slow" }],
      applied: CHEATS_OFF,
      enabled: true,
      name: "no cheats, a speed staged",
    },
    {
      actions: [{ kind: "speed", speed: "normal" }],
      applied: CHEATS_OFF,
      enabled: false,
      name: "no cheats, the applied speed staged",
    },
    {
      actions: [{ kind: "start", start: "park" }],
      applied: CHEATS_OFF,
      enabled: true,
      name: "no cheats, a walk chosen as the start",
    },
    {
      actions: [{ kind: "start", start: "park" }, { kind: "cancel" }],
      applied: CHEATS_OFF,
      enabled: false,
      name: "no cheats, a walk chosen then cancelled",
    },
  ])("enables Apply and Cancel with $name: $enabled", ({ actions, applied, enabled }) => {
    expect(hasStagedChanges(stageFrom(applied, actions))).toBe(enabled);
  });
});

describe("Apply", () => {
  const limits = runSetupLimitsFor(gameData);
  const origin = "https://example.test/play/";
  const applyFrom = (href: string, cheats: Cheats, start: PanelState["start"]) =>
    applyPanel(gameData, href, 7, { applied: CHEATS_OFF, staged: cheats, start });

  it.each<[string, string, Cheats, string]>([
    ["no cheats, in dev mode", "?dev=1&seed=5&zone=3&lang=fr", CHEATS_OFF, "?lang=fr"],
    ["no cheats, out of dev mode", "?seed=5&lang=fr", CHEATS_OFF, "?lang=fr"],
    ["a cheat, in dev mode", "?dev=1&seed=5&zone=3&lang=fr", hitBoxes, "?dev=1&lang=fr"],
    ["a cheat, out of dev mode", "?seed=5&lang=fr", hitBoxes, "?lang=fr&dev=1"],
    ["dev stats", "?lang=fr", setCheat("devStats", true, CHEATS_OFF), "?lang=fr&dev=1"],
    ["a speed, with dev off", "?dev=0&lang=fr", setSpeed("slow", CHEATS_OFF), "?dev=1&lang=fr"],
  ])(
    "at the start screen with %s drops the overrides, with dev on only for a cheat",
    (_, search, cheats, expected) => {
      expect(applyFrom(`${origin}${search}`, cheats, START_SCREEN)).toEqual({
        cheats,
        url: `${origin}${expected}`,
      });
    },
  );

  it.each([
    ["no cheats", CHEATS_OFF],
    ["every cheat", every],
  ])("with %s starts a walk in dev mode the URL reads back at every neighbourhood", (_, cheats) => {
    const starts = startChoices(gameData).map(({ start }) => start);
    expect(starts.slice(0, 2)).toEqual([START_SCREEN, firstZoneId(gameData)]);
    for (const start of starts.slice(1)) {
      const result = applyFrom(`${origin}?seed=5&lang=fr`, cheats, start);
      const parsed = parseRunSetup(limits, () => 0, new URL(result.url).search);
      expect(result.cheats).toEqual(cheats);
      expect(parsed.warnings).toEqual([]);
      expect(parsed.setup).toMatchObject({ dev: true, seed: 7 });
      expect(parsed.setup.route?.at(-1) ?? firstZoneId(gameData)).toBe(start);
    }
  });
});
