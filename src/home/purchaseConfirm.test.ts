import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { cents } from "../rules/units";
import { newPlayerSave } from "../save/fixtures";
import type { SaveDocument } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import { fillNames } from "../text/lines";
import { dollarText, type Purchase, purchasePrice } from "./home";
import { answerPurchase, confirmLines, keyAnswer, requestPurchase } from "./purchaseConfirm";
import { dogRows, gearRows, slotRows } from "./shop";

const data = { ...gameData, tuning: TEST_TUNING };
const owned = newPlayerSave.owned;
// One of each kind of purchase, as the shop's rows sell it.
const forSale = [
  ...gearRows(data, owned).slice(0, 1),
  ...slotRows(data, owned).slice(0, 1),
  ...dogRows(data, owned).slice(0, 1),
].map(({ name, purchase }) => ({ kind: purchase.kind, name, purchase }));

const priceOf = (purchase: Purchase) => purchasePrice(data, owned, purchase) ?? cents(0);
const withBank = (bank: number): SaveDocument => ({ ...newPlayerSave, bankCents: cents(bank) });
const count = (save: SaveDocument, purchase: Purchase): number =>
  purchase.kind === "dog"
    ? save.owned.dogs.filter((dog) => dog === purchase.dog).length
    : purchase.kind === "gear"
      ? save.owned.gear.filter((gear) => gear === purchase.gear).length
      : save.owned.dogSlots;

describe("requestPurchase", () => {
  it.each(forSale)("asks to confirm a $kind the bank covers, at its price or more", (item) => {
    const price = priceOf(item.purchase);
    for (const spare of [0, 1, 10_000]) {
      const request = requestPurchase(data, withBank(price + spare), item.name, item.purchase);
      expect(request).toEqual({
        kind: "confirm",
        pending: { bankAfter: spare, name: item.name, price, purchase: item.purchase },
      });
    }
  });

  it.each(forSale)("refuses a $kind the bank is short of, with no confirm", (item) => {
    const request = requestPurchase(
      data,
      withBank(priceOf(item.purchase) - 1),
      item.name,
      item.purchase,
    );
    expect(request).toEqual({ kind: "refused", reason: "cantAfford" });
  });

  it("refuses something owned as not for sale", () => {
    const [dog] = owned.dogs;
    if (dog === undefined) {
      throw new Error("expected a starting dog");
    }
    const request = requestPurchase(data, withBank(1_000_000), "", { dog, kind: "dog" });
    expect(request).toEqual({ kind: "refused", reason: "notForSale" });
  });
});

describe("answerPurchase", () => {
  // Opens a confirm with spare cents over the price, then answers it.
  const answered = (item: (typeof forSale)[number], choice: "buy" | "cancel") => {
    const save = withBank(priceOf(item.purchase) + 7);
    const request = requestPurchase(data, save, item.name, item.purchase);
    if (request.kind !== "confirm") {
      throw new Error("expected a confirm");
    }
    return {
      pending: request.pending,
      result: answerPurchase(data, save, request.pending, choice),
      save,
    };
  };

  it.each(forSale)("buys a $kind exactly once on Buy, leaving the bank it showed", (item) => {
    const { pending, result, save } = answered(item, "buy");
    expect(result.kind).toBe("bought");
    if (result.kind === "bought") {
      expect(result.save.bankCents).toBe(pending.bankAfter);
      expect(count(result.save, item.purchase)).toBe(count(save, item.purchase) + 1);
    }
  });

  it.each(forSale)("buys no $kind on Cancel", (item) => {
    expect(answered(item, "cancel").result).toEqual({ kind: "cancelled" });
  });

  it.each(forSale)("refuses a $kind whose price the bank no longer covers", (item) => {
    const { pending } = answered(item, "buy");
    const result = answerPurchase(data, withBank(pending.price - 1), pending, "buy");
    expect(result).toEqual({ kind: "refused", reason: "cantAfford" });
  });
});

describe("keyAnswer", () => {
  it.each([
    ["Enter", "buy"],
    [" ", "buy"],
    ["Escape", "cancel"],
    ["p", "cancel"],
    ["P", "cancel"],
    ["ArrowLeft", undefined],
    ["b", undefined],
  ] as const)("answers %j with %j", (key, choice) => {
    expect(keyAnswer(key)).toBe(choice);
  });
});

describe("confirmLines", () => {
  it.each(forSale)("names the $kind, its price and the bank after it", (item) => {
    const text = data.homeText.shop;
    const pending = {
      bankAfter: cents(1_234),
      name: item.name,
      price: cents(500),
      purchase: item.purchase,
    };
    expect(confirmLines(data, pending)).toEqual({
      buy: text.confirmBuy,
      cancel: text.confirmCancel,
      left: fillNames(text.confirmLeft, { amount: dollarText(pending.bankAfter) }),
      price: dollarText(pending.price),
      title: fillNames(text.confirmTitle, { name: item.name }),
    });
  });
});

// Every source file, from src/, but tests.
const SRC = new URL("../", import.meta.url);
const sources = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((path) => path.endsWith(".ts") && !path.endsWith(".test.ts"))
  .map((path) => ({ path, source: readFileSync(new URL(path, SRC), "utf8") }));
const calling = (name: string) =>
  sources.filter(({ source }) => new RegExp(`\\b${name}\\(`).test(source)).map(({ path }) => path);

describe("every buy point", () => {
  it("buys only through the confirm's answer", () => {
    const callers = sources
      .filter(({ source }) => /(?<![\w.])buy\(/.test(source.replace(/function buy\(/g, "")))
      .map(({ path }) => path);
    expect(callers).toEqual(["home/purchaseConfirm.ts"]);
  });

  const savers = calling("purchaseInProfile").filter((path) => path !== "scenes/profileStore.ts");

  it("saves a purchase somewhere", () => {
    expect(savers.length).toBeGreaterThan(0);
  });

  it.each(savers)("%s asks to confirm and saves only what the confirm bought", (path) => {
    expect(calling("requestPurchase")).toContain(path);
    expect(calling("answerPurchase")).toContain(path);
  });
});
