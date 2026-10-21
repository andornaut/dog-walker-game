import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { changeHearts } from "../rules/effects";
import { firstZoneId } from "../rules/route";
import { newPlayerSave, veteranSave } from "../save/fixtures";
import { saveContextFrom } from "../save/load";
import { heartsOf } from "../state/pack";
import { testState } from "../testing/runState";
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
  openPanel,
  type PanelAction,
  type PanelState,
  RESET_SAVE,
  SAVE_CHEATS,
  type SaveEdit,
  setCheat,
  SLOW_MOTION_SCALE,
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
const every = CHEAT_TOGGLES.reduce((cheats, { id }) => setCheat(id, true, cheats), ON);

// A label of a few words, with no helper text.
const SHORT_LABEL = /^[+$\w,]+( \w+){0,2}$/;

describe("the cheat list", () => {
  it("has one toggle for each cheat, each labelled in a few words", () => {
    const ids = CHEAT_TOGGLES.map(({ id }) => id);
    const cheats = Object.keys(CHEATS_OFF).filter((key) => key !== "on");
    expect([...ids].sort()).toEqual(cheats.sort());
    const labels = [...CHEAT_TOGGLES, ...SAVE_CHEATS].map(({ label }) => label);
    expect(labels.filter((label) => !SHORT_LABEL.test(label))).toEqual([]);
  });
});

describe("setCheat", () => {
  it("turns a cheat on only with cheats on, and slow motion and fast forward off each other", () => {
    expect(setCheat("invincible", true, ON)).toEqual({ ...ON, invincible: true });
    expect(setCheat("invincible", true, CHEATS_OFF)).toBe(CHEATS_OFF);
    const cheats = setCheat("fastForward", true, setCheat("slowMotion", true, ON));
    expect([cheats.fastForward, cheats.slowMotion]).toEqual([true, false]);
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

  it("runs time at the cheat's scale only with cheats on", () => {
    expect(timeScaleOf(setCheat("slowMotion", true, ON))).toBe(SLOW_MOTION_SCALE);
    expect(timeScaleOf({ ...CHEATS_OFF, slowMotion: true })).toBe(1);
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
  const edited = (edit: SaveEdit) => applySaveEdit(gameData, context.defaults, edit, veteranSave());

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
    const cancelled: PanelAction[] = [
      { kind: "switch", on: false },
      { kind: "start", start: "park" },
      { kind: "cancel" },
    ];
    expect(stageAll(cancelled)).toEqual(opened);
  });
});

describe("Apply", () => {
  const limits = runSetupLimitsFor(gameData);
  const href = "https://example.test/play/?dev=1&seed=5&zone=3&lang=fr";
  const staged = setCheat("slowMotion", true, ON);
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
