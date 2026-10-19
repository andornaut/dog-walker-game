import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { cents } from "../rules/units";
import { newPlayerSave, veteranSave } from "../save/fixtures";
import { saveContextFrom } from "../save/load";
import { memoryStorage, saveStore } from "../save/storage";
import {
  addMoney,
  centsToDollarsText,
  checkRunForm,
  describeLastLog,
  type DevRunForm,
  dollarsTextToCents,
  formFromSetup,
  planReplay,
  SAVED_LOADOUT,
  saveReadoutLines,
  unlockAll,
} from "./devPanelModel";
import { encodeInputLog, type InputLog } from "./inputLog";
import { runSetupLimitsFor } from "./pageRunSetup";
import { type RunSetup, runSetupToQuery } from "./runSetup";

const limits = runSetupLimitsFor(gameData);
const blankForm: DevRunForm = {
  dev: false,
  gear: SAVED_LOADOUT,
  moneyDollars: "",
  pack: [],
  seed: "123",
  speed: "",
  zone: "1",
};
const PLAY_URL = "https://example.test/play/";
const log: InputLog = {
  events: [
    { direction: -1, kind: "lane", timeMs: 1200 },
    { choice: "skip", kind: "card", timeMs: 3000 },
  ],
  setup: { dev: false, pack: ["koda"], seed: 99, speed: 1, zone: 2 },
};

describe("dollarsTextToCents", () => {
  it.each([
    ["0", 0],
    ["12", 1200],
    ["12.5", 1250],
    ["0.29", 29],
    [" 1000.05 ", 100_005],
  ])("reads %j as %d cents", (text, expected) => {
    expect(dollarsTextToCents(text)).toBe(expected);
  });

  it.each(["", "-1", "1.234", "1e3", "$5", ".5"])("rejects %j", (text) => {
    expect(dollarsTextToCents(text)).toBeUndefined();
  });

  it("is the inverse of centsToDollarsText", () => {
    for (const amount of [0, 5, 29, 1250, 100_005]) {
      expect(dollarsTextToCents(centsToDollarsText(amount))).toBe(amount);
    }
  });
});

describe("checkRunForm", () => {
  it("leaves the saved loadout and defaults out of a blank form's setup", () => {
    expect(checkRunForm(limits, blankForm)).toEqual({
      setup: { dev: false, seed: 123, speed: 1, zone: 1 },
      warnings: [],
    });
  });

  it("reads every field, converting dollars to cents", () => {
    const form: DevRunForm = {
      dev: true,
      gear: "whistle",
      moneyDollars: "12.50",
      pack: ["koda", "duchess"],
      seed: "123",
      speed: "1.5",
      zone: "3",
    };
    const { setup, warnings } = checkRunForm(limits, form);
    expect(warnings).toEqual([]);
    expect(runSetupToQuery(setup)).toBe(
      "seed=123&pack=koda,duchess&gear=whistle&zone=3&money=1250&speed=1.5&dev=1",
    );
  });

  it("reads gear none as no gear", () => {
    expect(checkRunForm(limits, { ...blankForm, gear: "none" }).setup.gear).toBeNull();
  });

  it("warns with the parser's limits", () => {
    const { warnings } = checkRunForm(limits, {
      ...blankForm,
      pack: ["koda", "duchess", "biscuit", "archie"],
      seed: "4294967296",
      speed: "11",
      zone: "5",
    });
    expect(warnings).toHaveLength(4);
    expect(warnings.join("\n")).toMatch(/seed.*pack.*zone.*speed/s);
  });

  it("warns about a missing seed and money it cannot read", () => {
    const { warnings } = checkRunForm(limits, { ...blankForm, moneyDollars: "1.234", seed: " " });
    expect(warnings).toEqual([
      "Enter a seed or press random",
      'Invalid money "1.234": expected dollars with at most 2 decimals',
    ]);
  });

  it("round-trips a setup through formFromSetup", () => {
    const setups: RunSetup[] = [
      { dev: false, seed: 7, speed: 1, zone: 1 },
      { dev: true, gear: null, money: 5, pack: ["zippy"], seed: 0, speed: 0.1, zone: 4 },
      { dev: false, gear: "fannyPack", money: 123_456, seed: 4_294_967_295, speed: 10, zone: 2 },
    ];
    for (const setup of setups) {
      expect(checkRunForm(limits, formFromSetup(setup))).toEqual({ setup, warnings: [] });
    }
  });
});

describe("save edits", () => {
  const context = saveContextFrom(gameData);

  it("addMoney adds to the bank and changes nothing else", () => {
    const save = veteranSave();
    expect(addMoney(cents(100_000), save)).toEqual({ ...save, bankCents: 112_345 });
    expect(save.bankCents).toBe(12_345);
  });

  it("unlockAll owns every dog, gear item and slot, and survives a save and load", async () => {
    const store = saveStore(memoryStorage());
    const unlocked = unlockAll(gameData, newPlayerSave);
    expect(unlocked.owned.dogSlots).toBe(3);
    expect(new Set(unlocked.owned.dogs)).toEqual(new Set(Object.keys(gameData.dogs)));
    expect(new Set(unlocked.owned.gear)).toEqual(new Set(Object.keys(gameData.shopGear)));
    expect(unlocked.owned.dogs.slice(0, 3)).toEqual(newPlayerSave.owned.dogs);
    expect(await store.save(unlocked)).toEqual({ status: "saved" });
    const loaded = await store.load(context);
    expect(loaded.status).toBe("loaded");
    expect(loaded.save).toEqual(unlocked);
  });

  it("saveReadoutLines summarizes the bank and what is owned", () => {
    expect(saveReadoutLines(gameData, addMoney(cents(100_000), veteranSave()))).toEqual([
      "bank $1,123.45",
      "slots 2 of 3",
      "dogs 4 of 9: biscuit, duchess, koda, penny",
      "gear 2 of 5: fannyPack, whistle",
    ]);
    expect(
      saveReadoutLines(gameData, { ...newPlayerSave, owned: { ...newPlayerSave.owned, gear: [] } }),
    ).toContain("gear 0 of 5");
  });
});

describe("planReplay", () => {
  it("stores the log and loads the game with its setup", () => {
    const plan = planReplay(limits, PLAY_URL, ` ${encodeInputLog(log)}\n`);
    expect(plan).toEqual({
      eventCount: 2,
      ok: true,
      seed: 99,
      stored: encodeInputLog(log),
      url: `${PLAY_URL}?seed=99&pack=koda&zone=2`,
    });
  });

  it("replays a log that names Dash and Waffles with Archie and Penny", () => {
    const old = '{"version":3,"setup":"seed=5&pack=dash,waffles","events":[]}';
    const plan = planReplay(limits, PLAY_URL, old);
    expect(plan.ok && plan.url).toBe(`${PLAY_URL}?seed=5&pack=archie,penny`);
    expect(plan.ok && plan.stored).toContain('"setup":"seed=5&pack=archie,penny"');
  });

  it("reports why a log does not decode", () => {
    expect(planReplay(limits, PLAY_URL, "")).toEqual({
      errors: ["Paste an encoded input log"],
      ok: false,
    });
    const plan = planReplay(limits, PLAY_URL, '{"version":1,"setup":"pack=rex","events":[]}');
    expect(plan.ok).toBe(false);
    expect(plan.ok ? [] : plan.errors).toEqual([
      'Invalid pack "rex": expected known dog ids, not rex; ignored',
      "The setup has no seed",
    ]);
  });
});

describe("describeLastLog", () => {
  it("reports no run when nothing is stored", () => {
    expect(describeLastLog(limits, null)).toEqual({ status: "none" });
    expect(describeLastLog(limits, "")).toEqual({ status: "none" });
  });

  it("names the file after the run's seed", () => {
    expect(describeLastLog(limits, encodeInputLog(log))).toEqual({
      fileName: "dog-walker-run-seed-99.json",
      status: "recorded",
      summary: "seed 99, 2 inputs",
    });
  });

  it("still offers a log that does not decode", () => {
    const last = describeLastLog(limits, "not json");
    expect(last.status).toBe("recorded");
    expect(last.status === "recorded" ? last.summary : "").toMatch(/^does not decode: Not JSON/);
  });
});
