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
  cheatsOn,
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
const ON = cheatsOn(CHEATS_OFF);
const every = CHEAT_TOGGLES.reduce(
  (cheats, { id }) => setCheat(id, true, cheats),
  setSpeed("fast", ON),
);

// A label of a few words, with no helper text.
const SHORT_LABEL = /^[+$\w,]+( \w+){0,2}$/;

describe("the cheat list", () => {
  it("has one toggle for each switch cheat and one speed choice, each labelled in a few words", () => {
    const ids = CHEAT_TOGGLES.map(({ id }) => id);
    const switches = Object.keys(CHEATS_OFF).filter((key) => key !== "on" && key !== "speed");
    expect([...ids].sort()).toEqual(switches.sort());
    expect(SPEEDS.map(({ id }) => id)).toContain(CHEATS_OFF.speed);
    const labels = [...CHEAT_TOGGLES, ...SAVE_CHEATS, ...SPEEDS].map(({ label }) => label);
    expect([...labels, SPEED_LABEL].filter((label) => !SHORT_LABEL.test(label))).toEqual([]);
  });
});

describe("setCheat and setSpeed", () => {
  it("change a cheat only with cheats on, and hold one speed at a time", () => {
    expect(setCheat("invincible", true, ON)).toEqual({ ...ON, invincible: true });
    expect(setCheat("invincible", true, CHEATS_OFF)).toBe(CHEATS_OFF);
    expect(setSpeed("slow", CHEATS_OFF)).toBe(CHEATS_OFF);
    expect(setSpeed("fast", setSpeed("slow", ON)).speed).toBe("fast");
  });
});

describe("cheats off", () => {
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
    ["an unknown speed", { ...every, speed: "warp" }],
    ["the two speed toggles", { fastForward: true, hitBoxes: true, invincible: true, on: true }],
  ])("decodes %s as normal speed, keeping the other cheats", (_, stored) => {
    expect(decodeCheats(JSON.stringify(stored))).toEqual({ ...every, speed: "normal" });
  });

  it.each(SPEEDS)("runs time at the $id speed's scale only with cheats on", ({ id, scale }) => {
    expect(timeScaleOf(setSpeed(id, ON))).toBe(scale);
    expect(timeScaleOf({ ...CHEATS_OFF, speed: id })).toBe(1);
  });
});

describe("withCheats", () => {
  const run = testState({ biscuit: 2 });
  const loss = [{ amount: -1, kind: "bump" }] as const;
  const gain = [{ amount: 1, kind: "treat" }] as const;

  it("keeps an invincible owner's hearts from falling, only with cheats on", () => {
    const hearts = (cheats: Cheats, causes: typeof loss | typeof gain) =>
      heartsOf(changeHearts(gameData, causes, "biscuit", withCheats(cheats, run)).state, "biscuit");
    const invincible = setCheat("invincible", true, ON);
    expect(hearts(invincible, loss)).toBe(2);
    expect(hearts(invincible, gain)).toBe(3);
    expect(hearts({ ...CHEATS_OFF, invincible: true }, loss)).toBe(1);
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
  const applied = setCheat("hitBoxes", true, ON);
  const opened = openPanel(applied);
  const stageAll = (actions: readonly PanelAction[]) =>
    actions.reduce((state, action) => stagePanel(action, state), opened);

  it("stages changes without applying them, and Cancel drops them", () => {
    expect(opened).toEqual({ applied, staged: applied, start: START_SCREEN });
    expect(stageAll([{ kind: "start", start: "park" }])).toEqual({
      applied,
      staged: applied,
      start: "park",
    });
    expect(stageAll([{ kind: "speed", speed: "slow" }]).staged).toEqual(setSpeed("slow", applied));
    const cancelled: PanelAction[] = [
      { kind: "speed", speed: "fast" },
      { kind: "switch", on: false },
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
    { actions: [], applied: CHEATS_OFF, enabled: false, name: "cheats off, untouched" },
    {
      actions: [{ kind: "switch", on: false }],
      applied: CHEATS_OFF,
      enabled: false,
      name: "cheats off, Cheats off pressed",
    },
    {
      actions: [{ kind: "switch", on: true }],
      applied: CHEATS_OFF,
      enabled: true,
      name: "cheats off, Cheats on pressed",
    },
    {
      actions: [{ kind: "switch", on: true }, { kind: "cancel" }],
      applied: CHEATS_OFF,
      enabled: false,
      name: "cheats off, Cheats on pressed then cancelled",
    },
    {
      actions: [
        { kind: "switch", on: true },
        { kind: "switch", on: false },
      ],
      applied: CHEATS_OFF,
      enabled: false,
      name: "cheats off, Cheats on then off pressed",
    },
    { actions: [], applied: ON, enabled: false, name: "cheats on, untouched" },
    {
      actions: [{ id: "invincible", kind: "toggle", on: true }],
      applied: ON,
      enabled: true,
      name: "cheats on, a toggle staged",
    },
    {
      actions: [
        { id: "invincible", kind: "toggle", on: true },
        { id: "invincible", kind: "toggle", on: false },
      ],
      applied: ON,
      enabled: false,
      name: "cheats on, a toggle staged then unstaged",
    },
    {
      actions: [{ kind: "speed", speed: "slow" }],
      applied: ON,
      enabled: true,
      name: "cheats on, a speed staged",
    },
    {
      actions: [{ kind: "speed", speed: "normal" }],
      applied: ON,
      enabled: false,
      name: "cheats on, the applied speed staged",
    },
    {
      actions: [{ kind: "start", start: "park" }],
      applied: ON,
      enabled: true,
      name: "cheats on, a walk chosen as the start",
    },
    {
      actions: [{ kind: "switch", on: false }],
      applied: ON,
      enabled: true,
      name: "cheats on, Cheats off pressed",
    },
    {
      actions: [
        { kind: "start", start: "park" },
        { kind: "switch", on: false },
      ],
      applied: every,
      enabled: true,
      name: "cheats on, a walk chosen then Cheats off pressed",
    },
  ])("enables Apply and Cancel with $name: $enabled", ({ actions, applied, enabled }) => {
    expect(hasStagedChanges(stageFrom(applied, actions))).toBe(enabled);
  });
});

describe("Apply", () => {
  const limits = runSetupLimitsFor(gameData);
  const href = "https://example.test/play/?dev=1&seed=5&zone=3&lang=fr";
  const staged = setSpeed("slow", ON);
  const applyFrom = (cheats: Cheats, start: PanelState["start"]) =>
    applyPanel(gameData, href, 7, { applied: CHEATS_OFF, staged: cheats, start });

  it("with cheats off loads the start screen, keeping only other parameters", () => {
    expect(applyFrom(CHEATS_OFF, "park")).toEqual({
      cheats: CHEATS_OFF,
      url: "https://example.test/play/?lang=fr",
    });
  });

  it("with cheats on starts a walk the URL reads back at every neighborhood", () => {
    const starts = startChoices(gameData).map(({ start }) => start);
    expect(starts.slice(0, 2)).toEqual([START_SCREEN, firstZoneId(gameData)]);
    for (const start of starts.slice(1)) {
      const { cheats, url } = applyFrom(staged, start);
      const parsed = parseRunSetup(limits, () => 0, new URL(url).search);
      expect(cheats).toEqual(staged);
      expect(parsed.warnings).toEqual([]);
      expect(parsed.setup).toMatchObject({ dev: true, seed: 7 });
      expect(parsed.setup.route?.at(-1) ?? firstZoneId(gameData)).toBe(start);
    }
  });
});
