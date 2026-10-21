import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { changeHearts } from "../rules/effects";
import { firstZoneId } from "../rules/route";
import { newPlayerSave, veteranSave } from "../save/fixtures";
import { saveContextFrom } from "../save/load";
import { MAX_RUN_DOGS } from "../save/schema";
import { memoryStorage, saveStore } from "../save/storage";
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
  type CheatToggle,
  decodeCheats,
  decodeSaveEdits,
  encodeCheats,
  encodeSaveEdits,
  FAST_FORWARD_SCALE,
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
import { parseRunSetup, type RunSetup } from "./runSetup";

const context = saveContextFrom(gameData);
const ON = cheatsOn(CHEATS_OFF);
const every = CHEAT_TOGGLES.reduce((cheats, { id }) => setCheat(id, true, cheats), ON);

// A label of a few words, with no helper text.
const SHORT_LABEL = /^[+$\w,]+( \w+){0,2}$/;

describe("the cheat list", () => {
  it("has one toggle for each cheat", () => {
    const ids = CHEAT_TOGGLES.map(({ id }) => id);
    const cheats = Object.keys(CHEATS_OFF).filter((key) => key !== "on");
    expect([...ids].sort()).toEqual(cheats.sort());
  });

  it.each([...CHEAT_TOGGLES, ...SAVE_CHEATS])("labels $label in a few words", ({ label }) => {
    expect(label).toMatch(SHORT_LABEL);
  });
});

describe("setCheat", () => {
  it.each<[CheatToggle, Partial<Cheats>]>([
    ["fastForward", { fastForward: true }],
    ["hitBoxes", { hitBoxes: true }],
    ["invincible", { invincible: true }],
    ["slowMotion", { slowMotion: true }],
  ])("turns %s on with cheats on", (id, expected) => {
    expect(setCheat(id, true, ON)).toEqual({ ...ON, ...expected });
  });

  it.each(CHEAT_TOGGLES.map(({ id }) => id))("leaves %s off with cheats off", (id) => {
    expect(setCheat(id, true, CHEATS_OFF)).toBe(CHEATS_OFF);
  });

  it.each<[CheatToggle, CheatToggle]>([
    ["fastForward", "slowMotion"],
    ["slowMotion", "fastForward"],
  ])("turning %s on turns %s off", (id, other) => {
    const cheats = setCheat(id, true, setCheat(other, true, ON));
    expect([cheats[id], cheats[other]]).toEqual([true, false]);
  });
});

describe("cheats off", () => {
  it.each<[string, unknown]>([
    ["off", CHEATS_OFF],
    ["a missing entry", undefined],
    ["a partial object", { on: true }],
    ["a string", "on"],
  ])("reads %s as every cheat off", (_name, value) => {
    expect(cheatsFrom(value)).toEqual(CHEATS_OFF);
  });

  it.each<[string, string | null]>([
    ["nothing stored", null],
    ["text that is not JSON", "{"],
    ["CHEATS_OFF", encodeCheats(CHEATS_OFF)],
  ])("decodes %s as every cheat off", (_name, text) => {
    expect(decodeCheats(text)).toEqual(CHEATS_OFF);
  });

  it("round-trips every cheat on", () => {
    expect(decodeCheats(encodeCheats(every))).toEqual(every);
  });

  it.each<[string, Cheats, number]>([
    ["normal", ON, 1],
    ["slow motion", setCheat("slowMotion", true, ON), SLOW_MOTION_SCALE],
    ["fast forward", setCheat("fastForward", true, ON), FAST_FORWARD_SCALE],
    ["slow motion left set with cheats off", { ...CHEATS_OFF, slowMotion: true }, 1],
  ])("runs %s time at x%d", (_name, cheats, scale) => {
    expect(timeScaleOf(cheats)).toBe(scale);
  });
});

describe("withCheats", () => {
  const run = testState({ biscuit: 2 });
  const loss = [{ amount: -1, kind: "bump" }] as const;
  const gain = [{ amount: 1, kind: "treat" }] as const;

  it.each<[string, Cheats, typeof loss | typeof gain, number]>([
    ["an owner loses hearts in normal play", CHEATS_OFF, loss, 1],
    ["an invincible owner loses none", setCheat("invincible", true, ON), loss, 2],
    ["an invincible owner still gains", setCheat("invincible", true, ON), gain, 3],
    ["invincible left set with cheats off loses", { ...CHEATS_OFF, invincible: true }, loss, 1],
  ])("%s", (_name, cheats, causes, hearts) => {
    const { state } = changeHearts(gameData, causes, "biscuit", withCheats(cheats, run));
    expect(heartsOf(state, "biscuit")).toBe(hearts);
  });

  it("leaves a normal run untouched", () => {
    expect(withCheats(CHEATS_OFF, run)).toBe(run);
  });
});

describe("save edits", () => {
  const edited = (edit: SaveEdit) => applySaveEdit(gameData, context.defaults, edit, veteranSave());
  const moneyCheats = SAVE_CHEATS.flatMap(({ edit, label }) =>
    edit.kind === "addMoney" ? [{ amount: edit.amount, edit, label }] : [],
  );
  const unlock: SaveEdit = { kind: "unlockAll" };

  it.each(moneyCheats)("$label adds its amount to the bank", ({ amount, edit, label }) => {
    expect(label).toBe(`+$${(amount / 100).toLocaleString("en-US")}`);
    expect(edited(edit)).toEqual({ ...veteranSave(), bankCents: veteranSave().bankCents + amount });
  });

  it.each<[string, (save: typeof newPlayerSave) => unknown, unknown]>([
    ["dog", (save) => new Set(save.owned.dogs), new Set(Object.keys(gameData.dogs))],
    ["gear item", (save) => new Set(save.owned.gear), new Set(Object.keys(gameData.shopGear))],
    ["walker", (save) => new Set(save.owned.walkers), new Set(Object.keys(gameData.walkers))],
    ["dog slot", (save) => save.owned.dogSlots, Math.min(MAX_RUN_DOGS, gameData.dogSlots.length)],
  ])("unlock all owns every %s", (_name, field, expected) => {
    expect(SAVE_CHEATS.map(({ edit }) => edit)).toContainEqual(unlock);
    expect(field(edited(unlock))).toEqual(expected);
  });

  it("a reset is a new player's save", () => {
    expect(edited(RESET_SAVE)).toEqual(newPlayerSave);
  });

  it("writes a reset save that loads as a new player's", async () => {
    const store = saveStore(memoryStorage());
    const reset = applySaveEdit(gameData, context.defaults, RESET_SAVE, veteranSave());
    expect(await store.save(reset)).toEqual({ status: "saved" });
    expect((await store.load(context)).save).toEqual(newPlayerSave);
  });

  it.each<[string, string | null, SaveEdit[]]>([
    ["nothing stored", null, []],
    ["text that is not JSON", "[", []],
    ["a non-list", '{"kind":"reset"}', []],
    [
      "every edit",
      encodeSaveEdits([...SAVE_CHEATS.map(({ edit }) => edit), RESET_SAVE]),
      [...SAVE_CHEATS.map(({ edit }) => edit), RESET_SAVE],
    ],
    ["a bad amount, dropped", '[{"kind":"addMoney","amount":-5},{"kind":"reset"}]', [RESET_SAVE]],
  ])("decodes %s", (_name, text, expected) => {
    expect(decodeSaveEdits(text)).toEqual(expected);
  });
});

describe("start at", () => {
  const first = firstZoneId(gameData);

  it("offers the start screen, then every neighborhood, the first first", () => {
    const starts = startChoices(gameData).map(({ start }) => start);
    expect(starts.slice(0, 2)).toEqual([START_SCREEN, first]);
    expect(new Set(starts.slice(1))).toEqual(new Set(gameData.world.zones.map(({ id }) => id)));
  });
});

describe("staged settings", () => {
  const applied = setCheat("hitBoxes", true, ON);
  const opened = openPanel(applied);
  const stageAll = (actions: readonly PanelAction[]) =>
    actions.reduce((state, action) => stagePanel(action, state), opened);

  it("opens with the applied cheats staged, bound for the start screen", () => {
    expect(opened).toEqual({ applied, staged: applied, start: START_SCREEN });
  });

  it.each<[string, PanelAction[], Cheats, PanelState["start"]]>([
    ["Cheats off", [{ kind: "switch", on: false }], CHEATS_OFF, START_SCREEN],
    [
      "Cheats off, then on",
      [
        { kind: "switch", on: false },
        { kind: "switch", on: true },
      ],
      ON,
      START_SCREEN,
    ],
    [
      "a toggle",
      [{ id: "invincible", kind: "toggle", on: true }],
      setCheat("invincible", true, applied),
      START_SCREEN,
    ],
    ["a start", [{ kind: "start", start: "park" }], applied, "park"],
    [
      "Cancel after changes",
      [{ kind: "switch", on: false }, { kind: "start", start: "park" }, { kind: "cancel" }],
      applied,
      START_SCREEN,
    ],
  ])("stages %s without changing what is applied", (_name, actions, staged, start) => {
    expect(stageAll(actions)).toEqual({ applied, staged, start });
  });

  it("stages no toggle while Cheats off is staged", () => {
    const actions: PanelAction[] = [
      { kind: "switch", on: false },
      { id: "hitBoxes", kind: "toggle", on: true },
    ];
    expect(stageAll(actions).staged).toEqual(CHEATS_OFF);
  });
});

describe("Apply", () => {
  const limits = runSetupLimitsFor(gameData);
  const href = "https://example.test/play/?dev=1&seed=5&zone=3&lang=fr";
  const staged = setCheat("slowMotion", true, ON);
  const applyFrom = (cheats: Cheats, start: PanelState["start"]) =>
    applyPanel(gameData, href, 7, { applied: CHEATS_OFF, staged: cheats, start });

  it.each<[string, Cheats, PanelState["start"], Cheats, string]>([
    ["cheats on, to the start screen", staged, START_SCREEN, staged, "?dev=1&lang=fr"],
    ["cheats off, to the start screen", CHEATS_OFF, START_SCREEN, CHEATS_OFF, "?lang=fr"],
    ["cheats off, a neighborhood ignored", CHEATS_OFF, "park", CHEATS_OFF, "?lang=fr"],
  ])("with %s loads /play/%s", (_name, cheats, start, expected, search) => {
    expect(applyFrom(cheats, start)).toEqual({
      cheats: expected,
      url: `https://example.test/play/${search}`,
    });
  });

  it.each(startChoices(gameData).filter(({ start }) => start !== START_SCREEN))(
    "with cheats on starts a walk the URL reads back at $label",
    ({ start }) => {
      const { cheats, url } = applyFrom(staged, start);
      const parsed = parseRunSetup(limits, () => 0, new URL(url).search);
      expect(cheats).toEqual(staged);
      expect(parsed.warnings).toEqual([]);
      expect(parsed.setup).toMatchObject({ dev: true, seed: 7 });
      expect(parsed.setup.route?.at(-1) ?? firstZoneId(gameData)).toBe(start);
    },
  );
});

describe("the URL parameters agents use", () => {
  const limits = runSetupLimitsFor(gameData);
  const base: RunSetup = { dev: false, seed: 0, speed: 1, zone: 1 };

  it.each<[string, Partial<RunSetup>]>([
    ["seed=42", { seed: 42 }],
    ["pack=koda,biscuit", { pack: ["koda", "biscuit"] }],
    ["walker=casey", { walker: "casey" }],
    ["zone=3", { zone: 3 }],
    ["gear=none", { gear: null }],
    ["money=1250", { money: 1250 }],
    ["speed=2", { speed: 2 }],
    ["zone=2&route=street,park", { route: ["street", "park"], zone: 2 }],
    ["dev=1", { dev: true }],
  ])("reads %s", (search, expected) => {
    expect(parseRunSetup(limits, () => 0, search)).toEqual({
      notices: [],
      setup: { ...base, ...expected },
      warnings: [],
    });
  });
});
