import "./main.css";

import { badgeKey } from "../assets/spriteKeys";
import { gameData, onGameDataChange } from "../data";
import type {
  CardOption,
  DogId,
  GameData,
  HintTrigger,
  Modifier,
  QuipMoment,
  Unlock,
  WalkerId,
  Zone,
} from "../data/types";
import { achievementConditionText } from "../rules/achievements";
import {
  catchChance,
  inputLockSeconds,
  maxHearts,
  needUrgentSeconds,
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
import { firstZoneId, walkLength, zoneById } from "../rules/route";
import { price, unlockPrice } from "../rules/shop";
import { zoneStats } from "../rules/zones";
import { POLICY_NAMES } from "../sim/policies";
import {
  DEFAULT_MATRIX,
  type Matrix,
  MATRIX_HEADERS,
  matrixCells,
  type MatrixRow,
  rowCells,
  simulateMatrixInBatches,
} from "../sim/report";
import { SKILL_PRESETS } from "../sim/skills";

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
    option.art,
  ]);
}

function priceText(data: GameData, item: Unlock): string {
  return item.unlock === "start" ? "Start" : formatDollars(unlockPrice(data.tuning, item));
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
      "Need urgent after",
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
      `${needUrgentSeconds(tuning, dog)}s`,
      `${inputLockSeconds(tuning, [], dog)}s`,
      `${Math.round(catchChance(tuning, dog) * 100)}%`,
      priceText(data, dog),
    ]),
    title: "Dogs",
  };
}

const QUIP_MOMENTS: readonly QuipMoment[] = ["happier", "upset", "fired", "parting"];

function quipsSection(data: GameData): Section {
  return {
    headers: ["Dog", "Owner", "Temperament", "Moment", "Lines"],
    note: "Parting lines show when the player picks the dog on the home screen.",
    rows: (Object.keys(data.dogs) as DogId[]).flatMap((id) => {
      const dog = data.dogs[id];
      return QUIP_MOMENTS.map((moment, i) => [
        i === 0 ? dog.name : "",
        i === 0 ? dog.owner.name : "",
        i === 0 ? TEMPERAMENT_NAMES[dog.owner.temperament] : "",
        moment,
        data.quips[id][moment].join(" / "),
      ]);
    }),
    title: "Owner quips",
  };
}

function hintsSection(data: GameData): Section {
  const triggerText = (trigger: HintTrigger): string => {
    if (trigger.kind === "encounter") {
      return `first ${data.encounters[trigger.encounter].name}`;
    }
    if (trigger.kind === "debuff") {
      return `first ${data.debuffs[trigger.debuff].name}`;
    }
    return `first ${trigger.kind}`;
  };
  return {
    headers: ["Hint", "Trigger", "Text"],
    note: "Each shows once, the first time its trigger happens.",
    rows: Object.entries(data.hints).map(([id, hint]) => [
      id,
      triggerText(hint.trigger),
      hint.text,
    ]),
    title: "First-time hints",
  };
}

function encountersSection(data: GameData): Section {
  const rows = Object.values(data.encounters).flatMap((encounter): Cell[][] => {
    const head = [
      encounter.name,
      encounter.kind,
      affectText(data.tuning, encounter.affects),
      encounter.noCardWhen === undefined ? "" : conditionText(encounter.noCardWhen),
    ];
    const { resolution } = encounter;
    if (resolution.kind === "instant") {
      return [[...head, "Instant", effectText(data, resolution.effects), resolution.art]];
    }
    return resolution.options.map((option, i) => [
      ...(i === 0 ? head : head.map(() => "")),
      option.name,
      effectText(data, option.effects),
      option.art,
    ]);
  });
  return {
    headers: ["Encounter", "Kind", "Affects", "No card when", "Option", "Effect", "Art"],
    note: "An instant encounter opens no card: it applies on contact, with a popup.",
    rows,
    title: "Encounters",
  };
}

function forcedStopsSection(data: GameData): Section {
  return {
    headers: ["Forced stop", "Option", "Effect", "Art"],
    rows: Object.values(data.forcedStops).flatMap((stop) =>
      optionRows(data, stop.name, stop.options),
    ),
    title: "Forced stops",
  };
}

function upgradesSection(data: GameData): Section {
  return {
    headers: ["Upgrade", "Kind", "Effect", "Art"],
    rows: Object.values(data.upgrades).map((upgrade) => [
      upgrade.name,
      upgrade.kind === "tradeOff" ? "trade-off" : "boost",
      effectText(data, upgrade.effects),
      upgrade.art,
    ]),
    title: "Upgrades",
  };
}

function shopSection(data: GameData): Section {
  const gearRows = Object.values(data.shopGear).map((gear) => [
    gear.name,
    formatDollars(price(data.tuning, gear.price)),
    effectText(data, gear.effects),
  ]);
  const dogRows = Object.values(data.dogs)
    .filter((dog) => dog.unlock === "shop")
    .map((dog) => [dog.name, priceText(data, dog), "Unlocks the dog"]);
  return { headers: ["Item", "Price", "Effect"], rows: [...gearRows, ...dogRows], title: "Shop" };
}

function dogSlotsSection(data: GameData): Section {
  return {
    headers: ["Slot", "Price"],
    note: "A run takes at most one dog per owned slot. Slots can be bought at any time.",
    rows: data.dogSlots.map((slot, i) => [i + 1, priceText(data, slot)]),
    title: "Dog slots",
  };
}

function walkersSection(data: GameData): Section {
  return {
    headers: ["Walker", "Sprite", "Portrait", "Price"],
    note: "A new player starts with the default walker.",
    rows: (Object.keys(data.walkers) as WalkerId[]).map((id) => {
      const walker = data.walkers[id];
      const name = id === data.defaultWalker ? `${walker.name} (default)` : walker.name;
      return [name, walker.spriteKey, walker.portraitKey, priceText(data, walker)];
    }),
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

// The kinds a zone's weights keep out of it.
function neverIn(zone: Zone): string {
  const groups = Object.values(zone.weights) as Readonly<Record<string, number>>[];
  const never = groups.flatMap((weights) => Object.keys(weights).filter((id) => weights[id] === 0));
  return never.length === 0 ? "-" : never.join(", ");
}

function zonesSection(data: GameData): Section {
  return {
    headers: [
      "Zone",
      "Difficulty",
      "Fees",
      "Speed",
      "Movers",
      "Minutes",
      "Speed (px/s)",
      "Obstacles",
      "Tips",
      "Treats",
      "Lucky",
      "Never here",
    ],
    note:
      `World: ${data.world.name}. A walk is ${walkLength(data)} zones, starting in ` +
      `${zoneById(data, firstZoneId(data)).name}; the rest are picked at forks, easiest ` +
      "first in this table. Minutes, speed and counts are for the zone walked second, at " +
      "base speed and before upgrades.",
    rows: data.world.zones.map((zone) => {
      const stats = zoneStats(data.tuning, zone, 1);
      return [
        zone.name,
        `${zone.difficultyName} (${zone.difficulty})`,
        `×${zone.fees}`,
        `×${zone.speed}`,
        `${Math.round(zone.moverShare * 100)}%`,
        Math.round((stats.duration / 60) * 10) / 10,
        Math.round(stats.scrollSpeed),
        stats.obstacles,
        stats.tips,
        stats.treats,
        stats.luckyEncounters,
        neverIn(zone),
      ];
    }),
    title: "Zones",
  };
}

function achievementsSection(data: GameData): Section {
  return {
    headers: ["Badge", "Goal", "Line", "Earned when", "Art"],
    note: "In badge wall order. Every condition must hold; celebration only, no reward.",
    rows: data.achievements.map((achievement) => [
      achievement.name,
      achievement.goal,
      achievement.badgeLine,
      achievement.conditions
        .map((condition) => achievementConditionText(data, condition))
        .join(" and "),
      badgeKey(achievement.id),
    ]),
    title: "Achievements",
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

// Fewer runs per row than npm run simulate, so the table fills in seconds.
const SIMULATED_RUNS = 100;

// The typical player only, so the page stays quick; npm run simulate plays every preset.
const SIMULATED_MATRIX: Matrix = {
  ...DEFAULT_MATRIX,
  players: [{ kind: "skill", preset: "typical" }],
};

function simulatedSection(rows: readonly MatrixRow[]): Section {
  const { policies } = SIMULATED_MATRIX;
  const { errorRate, reactionSeconds } = SKILL_PRESETS.typical;
  const total = matrixCells(SIMULATED_MATRIX).length;
  return {
    headers: MATRIX_HEADERS,
    note: [
      `Bots playing whole runs on the live rules and data, ${SIMULATED_RUNS} runs per row`,
      "(npm run simulate runs 1,000). A typical player steers the real walk, pulls included:",
      `it reacts in ${reactionSeconds}s and fumbles ${Math.round(errorRate * 100)}% of its lane`,
      "changes. Hit, Bump and Lucky are the measured shares of obstacles, minor obstacles and",
      "lucky finds hit or collected; Tips is tips collected per run. Fired, Zones and Cards are",
      "per run; Paid is the share of card choices that cost money; Badges is the achievements",
      "a run earns on its own, per run.",
      `${policies.map((id) => `${id}: ${POLICY_NAMES[id]}`).join(". ")}.`,
      "Route is the path the bot takes at each fork: straight is the middle one.",
      ...(rows.length < total ? [`Simulating: ${rows.length} of ${total} rows.`] : []),
    ].join(" "),
    rows: rows.map(rowCells),
    title: "Simulated runs",
  };
}

let stopSimulation = () => {};

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
    dogSlotsSection,
    walkersSection,
    quipsSection,
    hintsSection,
    debuffsSection,
    zonesSection,
    achievementsSection,
    helpSection,
    tuningSection,
  ].map((section) => renderSection(section(data)));
  let simulated = renderSection(simulatedSection([]));
  root.replaceChildren(
    element("h1", "Game data"),
    element("p", "Every table the game reads, with card text generated from the live values."),
    ...sections,
    simulated,
  );
  stopSimulation();
  stopSimulation = simulateMatrixInBatches(
    data,
    1,
    SIMULATED_RUNS,
    10,
    (step) => setTimeout(step, 0),
    (rows) => {
      const next = renderSection(simulatedSection(rows));
      simulated.replaceWith(next);
      simulated = next;
    },
    SIMULATED_MATRIX,
  );
}

render();
onGameDataChange(render);
