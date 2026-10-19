// npm run simulate -- --help
// Runs a matrix, prints its tables and, with --out, writes the rows as JSON.
import { itemAt } from "../arrays";
import { gameData } from "../data";
import { POLICY_IDS, type PolicyId } from "./policies";
import {
  DEFAULT_MATRIX,
  formatKindTable,
  formatTable,
  type Matrix,
  matrixCells,
  type MatrixPlayer,
  type MatrixRow,
  simulateCell,
} from "./report";
import { SKILL_PRESET_IDS, SKILL_PRESETS } from "./skills";

// The parts of Node this script uses. The project's types are the browser's, so Node is
// reached through globalThis rather than @types/node.
interface WorkerThread {
  once(event: "error", listener: (error: Error) => void): void;
  once(event: "message", listener: (message: unknown) => void): void;
}

interface NodeModules {
  "node:fs": { writeFileSync(path: string, data: string): void };
  "node:os": { availableParallelism(): number };
  "node:worker_threads": {
    readonly isMainThread: boolean;
    readonly parentPort: { postMessage(message: unknown): void } | null;
    readonly Worker: new (url: URL, options: { readonly workerData: unknown }) => WorkerThread;
    readonly workerData: unknown;
  };
}

interface NodeProcess {
  readonly argv: readonly string[];
  exitCode?: number;
  getBuiltinModule<Id extends keyof NodeModules>(id: Id): NodeModules[Id];
  readonly stderr: { write(text: string): boolean };
  readonly stdout: { write(text: string): boolean };
}

const nodeProcess = (globalThis as unknown as { readonly process: NodeProcess }).process;
const threads = nodeProcess.getBuiltinModule("node:worker_threads");

const DEFAULT_RUNS = 1000;
const DEFAULT_SEED = 1;

const presetLines = SKILL_PRESET_IDS.map((id) => {
  const skill = SKILL_PRESETS[id];
  return (
    `  ${id.padEnd(8)} reaction ${skill.reactionSeconds}s, look-ahead ${skill.lookAheadSeconds}s, ` +
    `errors ${skill.errorRate * 100}%, cooldown ${skill.laneChangeCooldown}s`
  );
});

const USAGE = [
  "npm run simulate -- [--skill preset,...] [--hit percent,...] [--policy id,...]",
  "                    [--runs N] [--seed N] [--out file]",
  "",
  "Plays whole runs on the real rules and data, one row per policy, player and pack.",
  "",
  "  --skill   steering bots of these skill presets play the real walk loop, with pulls, chases",
  "            and movers, and their hit rates are measured (default: every preset)",
  "  --hit     instead or as well, players that hit each obstacle at these fixed rates and",
  "            collect tips, treats and lucky finds at 70%",
  `  --policy  card choice policies (default: ${POLICY_IDS.join(",")})`,
  `  --runs    runs per row (default: ${DEFAULT_RUNS})`,
  `  --seed    the seed; the same seed gives the same rows (default: ${DEFAULT_SEED})`,
  "  --out     also write the matrix and rows as JSON to this file",
  "",
  "Skill presets:",
  ...presetLines,
  "",
  "Hit, Bump and Lucky are the measured shares of obstacles, minor obstacles (both moving or",
  "not) and lucky encounters that reached the pack and were hit or collected. Tips is tips",
  "collected per run, Zones zones finished per run. A second table gives the hit rate of each",
  "obstacle kind that stands still, then of each mover.",
].join("\n");

interface Options {
  readonly help: boolean;
  readonly matrix: Matrix;
  readonly out: string | undefined;
  readonly runs: number;
  readonly seed: number;
}

// The cells one worker simulates, by index into matrixCells(matrix).
interface Job {
  readonly cells: readonly number[];
  readonly matrix: Matrix;
  readonly runs: number;
  readonly seed: number;
}

function parseWhole(flag: string, min: number, text: string): number {
  const value = Number(text);
  if (text === "" || !Number.isInteger(value) || value < min) {
    throw new Error(`${flag} takes a whole number from ${min}, not ${text}`);
  }
  return value;
}

function parsePolicies(text: string): PolicyId[] {
  return text.split(",").map((id) => {
    const policy = POLICY_IDS.find((candidate) => candidate === id);
    if (policy === undefined) {
      throw new Error(`--policy takes ${POLICY_IDS.join(", ")}, not ${id}`);
    }
    return policy;
  });
}

function parseHitRates(text: string): MatrixPlayer[] {
  return text.split(",").map((part) => {
    const value = Number(part.replace(/%$/, ""));
    if (part === "" || !(value >= 0 && value <= 100)) {
      throw new Error(`--hit takes percentages from 0 to 100, not ${part}`);
    }
    return { hitRate: value / 100, kind: "rates" };
  });
}

function parseSkills(text: string): MatrixPlayer[] {
  return text.split(",").map((id) => {
    const preset = SKILL_PRESET_IDS.find((candidate) => candidate === id);
    if (preset === undefined) {
      throw new Error(`--skill takes ${SKILL_PRESET_IDS.join(", ")}, not ${id}`);
    }
    return { kind: "skill", preset };
  });
}

function parseArgs(args: readonly string[]): Options {
  let matrix = DEFAULT_MATRIX;
  let out: string | undefined;
  let runs = DEFAULT_RUNS;
  let seed = DEFAULT_SEED;
  let skills: MatrixPlayer[] = [];
  let hits: MatrixPlayer[] = [];
  if (args.includes("--help") || args.includes("-h")) {
    return { help: true, matrix, out, runs, seed };
  }
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (value === undefined) {
      throw new Error(`${flag} needs a value`);
    }
    switch (flag) {
      case "--hit":
        hits = parseHitRates(value);
        break;
      case "--skill":
        skills = parseSkills(value);
        break;
      case "--out":
        out = value;
        break;
      case "--policy":
        matrix = { ...matrix, policies: parsePolicies(value) };
        break;
      case "--runs":
        runs = parseWhole(flag, 1, value);
        break;
      case "--seed":
        seed = parseWhole(flag, 0, value);
        break;
      default:
        throw new Error(`Unknown option ${flag}\n\n${USAGE}`);
    }
  }
  const players = [...skills, ...hits];
  if (players.length > 0) {
    matrix = { ...matrix, players };
  }
  return { help: false, matrix, out, runs, seed };
}

function runJob({ cells, matrix, runs, seed }: Job): MatrixRow[] {
  const all = matrixCells(matrix);
  return cells.map((index) => simulateCell(gameData, seed, runs, matrix, itemAt(all, index)));
}

function runInWorker(job: Job): Promise<MatrixRow[]> {
  return new Promise((resolve, reject) => {
    const worker = new threads.Worker(new URL(import.meta.url), { workerData: job });
    worker.once("message", (rows) => resolve(rows as MatrixRow[]));
    worker.once("error", reject);
  });
}

// Cells are dealt out in turn to one worker per CPU. Each cell's runs are seeded by the
// cell alone, so the rows are the same however the cells are dealt.
async function simulateInWorkers(options: Options): Promise<MatrixRow[]> {
  const count = matrixCells(options.matrix).length;
  const workers = Math.min(count, nodeProcess.getBuiltinModule("node:os").availableParallelism());
  const jobs = Array.from({ length: workers }, (_, worker) => ({
    cells: Array.from({ length: count }, (_, cell) => cell).filter(
      (cell) => cell % workers === worker,
    ),
    matrix: options.matrix,
    runs: options.runs,
    seed: options.seed,
  }));
  const results = await Promise.all(jobs.map(runInWorker));
  return Array.from({ length: count }, (_, cell) =>
    itemAt(itemAt(results, cell % workers), Math.floor(cell / workers)),
  );
}

async function main(): Promise<void> {
  const options = parseArgs(nodeProcess.argv.slice(2));
  if (options.help) {
    nodeProcess.stdout.write(`${USAGE}\n`);
    return;
  }
  const started = performance.now();
  const rows = await simulateInWorkers(options);
  const seconds = (performance.now() - started) / 1000;
  const { matrix, out, runs, seed } = options;
  nodeProcess.stdout.write(`${formatTable(rows)}\n\nHit rate by obstacle kind\n`);
  nodeProcess.stdout.write(`${formatKindTable(gameData, rows)}\n`);
  nodeProcess.stdout.write(
    `${rows.length} cells x ${runs} runs, seed ${seed}, in ${seconds.toFixed(1)}s\n`,
  );
  if (out !== undefined) {
    const json = { matrix, rows, runsPerCell: runs, seed };
    nodeProcess
      .getBuiltinModule("node:fs")
      .writeFileSync(out, `${JSON.stringify(json, null, 2)}\n`);
    nodeProcess.stdout.write(`Wrote ${out}\n`);
  }
}

if (threads.isMainThread) {
  main().catch((error: unknown) => {
    nodeProcess.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    nodeProcess.exitCode = 1;
  });
} else {
  threads.parentPort?.postMessage(runJob(threads.workerData as Job));
}
