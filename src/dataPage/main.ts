import { gameData, onGameDataChange } from "../data";
import type { CardOption, GameData, Modifier } from "../data/types";
import {
  catchChance,
  inputLockSeconds,
  maxHearts,
  pullIntervalSeconds,
  startHearts,
  zoneFee,
} from "../rules/dogs";
import {
  affectText,
  conditionText,
  effectText,
  formatDollars,
  modifierText,
  TEMPERAMENT_NAMES,
  TRAIT_NAMES,
} from "../rules/effectText";
import { modifiersOf } from "../rules/modifiers";
import { dollarsToCents } from "../rules/units";
import { zoneStats } from "../rules/zones";

type Cell = number | string;
interface Section {
  readonly headers: readonly string[];
  readonly note?: string;
  readonly rows: readonly (readonly Cell[])[];
  readonly title: string;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function renderSection({ headers, note, rows, title }: Section): HTMLElement {
  const section = element("section");
  section.append(element("h2", title));
  if (note !== undefined) {
    section.append(element("p", note));
  }
  const table = element("table");
  const headRow = element("tr");
  headRow.append(...headers.map((header) => element("th", header)));
  table.append(element("thead"), element("tbody"));
  table.tHead?.append(headRow);
  for (const row of rows) {
    const tableRow = element("tr");
    for (const cell of row) {
      const td = element("td", String(cell));
      if (typeof cell === "number") {
        td.className = "number";
      }
      tableRow.append(td);
    }
    table.tBodies[0]?.append(tableRow);
  }
  const scroll = element("div");
  scroll.className = "scroll";
  scroll.append(table);
  section.append(scroll);
  return section;
}

function optionRows(data: GameData, name: string, options: readonly CardOption[]): Cell[][] {
  return options.map((option, i) => [
    i === 0 ? name : "",
    option.name,
    effectText(data, option.effects),
  ]);
}

function dogsSection(data: GameData): Section {
  const { tuning } = data;
  const luckyCollar: readonly Modifier[] = modifiersOf(data.shopGear.luckyCollar.effects);
  return {
    headers: [
      "Dog",
      "Breed",
      "Size",
      "Trait",
      "Energy",
      "Owner",
      "Temperament",
      "Start ♥",
      "Max ♥",
      "With Lucky collar",
      "Fee",
      "Pulls every",
      "Input lock",
      "Caught",
      "Unlock",
    ],
    rows: Object.values(data.dogs).map((dog) => [
      dog.name,
      dog.breed,
      dog.size,
      TRAIT_NAMES[dog.trait],
      dog.energy,
      `${dog.owner.name}, ${dog.owner.role}`,
      TEMPERAMENT_NAMES[dog.owner.temperament],
      startHearts(tuning, [], dog),
      maxHearts(tuning, [], dog),
      `${startHearts(tuning, luckyCollar, dog)} / ${maxHearts(tuning, luckyCollar, dog)}`,
      formatDollars(zoneFee(tuning, [], dog)),
      `${pullIntervalSeconds(tuning, [], dog)}s`,
      `${inputLockSeconds(tuning, [], dog)}s`,
      `${Math.round(catchChance(tuning, dog) * 100)}%`,
      dog.unlock === "start"
        ? "Start"
        : formatDollars(dollarsToCents(tuning.money.prices.lockedDog)),
    ]),
    title: "Dogs",
  };
}

function encountersSection(data: GameData): Section {
  return {
    headers: ["Encounter", "Kind", "Affects", "No card when", "Option", "Effect"],
    rows: Object.values(data.encounters).flatMap((encounter) =>
      encounter.options.map((option, i) =>
        i === 0
          ? [
              encounter.name,
              encounter.kind,
              affectText(data.tuning, encounter.affects),
              encounter.noCardWhen === undefined ? "" : conditionText(encounter.noCardWhen),
              option.name,
              effectText(data, option.effects),
            ]
          : ["", "", "", "", option.name, effectText(data, option.effects)],
      ),
    ),
    title: "Encounters",
  };
}

function forcedStopsSection(data: GameData): Section {
  return {
    headers: ["Forced stop", "Option", "Effect"],
    rows: Object.values(data.forcedStops).flatMap((stop) =>
      optionRows(data, stop.name, stop.options),
    ),
    title: "Forced stops",
  };
}

function upgradesSection(data: GameData): Section {
  return {
    headers: ["Upgrade", "Kind", "Effect"],
    rows: Object.values(data.upgrades).map((upgrade) => [
      upgrade.name,
      upgrade.kind === "tradeOff" ? "trade-off" : "boost",
      effectText(data, upgrade.effects),
    ]),
    title: "Upgrades",
  };
}

function shopSection(data: GameData): Section {
  const gearRows = Object.values(data.shopGear).map((gear) => [
    gear.name,
    formatDollars(dollarsToCents(data.tuning.money.prices[gear.price])),
    effectText(data, gear.effects),
  ]);
  const dogRows = Object.values(data.dogs)
    .filter((dog) => dog.unlock === "shop")
    .map((dog) => [
      dog.name,
      formatDollars(dollarsToCents(data.tuning.money.prices.lockedDog)),
      "Unlocks the dog",
    ]);
  return { headers: ["Item", "Price", "Effect"], rows: [...gearRows, ...dogRows], title: "Shop" };
}

function walkersSection(data: GameData): Section {
  return {
    headers: ["Walker", "Sprite", "Unlock"],
    rows: Object.values(data.walkers).map((walker) => [
      walker.name,
      walker.spriteKey,
      walker.unlock === "start" ? "Start" : "Shop",
    ]),
    title: "Walkers",
  };
}

function debuffsSection(data: GameData): Section {
  return {
    headers: ["Debuff", "Effect"],
    rows: Object.values(data.debuffs).map((debuff) => [
      debuff.name,
      debuff.modifiers
        .map((modifier) => modifierText(data.tuning, { ...modifier, duration: debuff.duration }))
        .join(", "),
    ]),
    title: "Debuffs",
  };
}

function zonesSection(data: GameData): Section {
  return {
    headers: ["Zone", "Road", "Minutes", "Speed (px/s)", "Obstacles", "Tips", "Treats", "Lucky"],
    note: `World: ${data.world.name}. Minutes and speed are at base speed, before upgrades.`,
    rows: data.world.zones.map((zone, i) => {
      const stats = zoneStats(data.tuning, i);
      return [
        zone.name,
        zone.roadColor,
        Math.round((stats.duration / 60) * 10) / 10,
        Math.round(stats.scrollSpeed),
        stats.obstacles,
        stats.tips,
        stats.treats,
        stats.luckyEncounters,
      ];
    }),
    title: "Zones",
  };
}

function helpSection(data: GameData): Section {
  return {
    headers: ["Page", "Title", "Body", "Art"],
    note: "The How to walk screen, in page order. Art is a manifest image key.",
    rows: data.help.map((page, i) => [i + 1, page.title, page.body, page.art]),
    title: "Help",
  };
}

// One row per number, nested tables flattened to group.table.row.
function tuningSection(data: GameData): Section {
  const rows: Cell[][] = [];
  for (const [group, values] of Object.entries(data.tuning)) {
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === "number") {
        rows.push([group, key, value]);
      } else {
        for (const [row, rowValue] of Object.entries(value as Readonly<Record<string, number>>)) {
          rows.push([group, `${key}.${row}`, rowValue]);
        }
      }
    }
  }
  return {
    headers: ["Group", "Key", "Value"],
    note: "Money is in dollars, times in seconds, speeds in pixels per second.",
    rows,
    title: "Tuning",
  };
}

function render(): void {
  const root = document.getElementById("data");
  if (root === null) {
    return;
  }
  const data = gameData;
  const sections = [
    dogsSection,
    encountersSection,
    forcedStopsSection,
    upgradesSection,
    shopSection,
    walkersSection,
    debuffsSection,
    zonesSection,
    helpSection,
    tuningSection,
  ].map((section) => renderSection(section(data)));
  root.replaceChildren(
    element("h1", "Game data"),
    element("p", "Every table the game reads, with card text generated from the live values."),
    ...sections,
  );
}

render();
onGameDataChange(render);
