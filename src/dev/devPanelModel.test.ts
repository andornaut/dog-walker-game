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
  RESET_SAVE,
  SAVE_CHEATS,
  type SaveEdit,
  setCheat,
  SLOW_MOTION_SCALE,
  startAtSetup,
  startChoices,
  timeScaleOf,
  withCheats,
} from "./devPanelModel";
import { runSetupLimitsFor } from "./pageRunSetup";
import { parseRunSetup, type RunSetup, runSetupLink } from "./runSetup";

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
  const limits = runSetupLimitsFor(gameData);

  it("offers every neighborhood, the first first", () => {
    const choices = startChoices(gameData);
    expect(choices[0]?.zone).toBe(first);
    expect(new Set(choices.map(({ zone }) => zone))).toEqual(
      new Set(gameData.world.zones.map(({ id }) => id)),
    );
  });

  it.each(startChoices(gameData))("starts a walk the URL reads back at $label", ({ zone }) => {
    const setup = startAtSetup(gameData, false, 7, zone);
    const search = new URL(runSetupLink("https://example.test/play/", setup)).search;
    const parsed = parseRunSetup(limits, () => 0, search);
    expect(parsed).toEqual({ notices: [], setup, warnings: [] });
    expect(setup.route?.at(-1) ?? first).toBe(zone);
  });
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
