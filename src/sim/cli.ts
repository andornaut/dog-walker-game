// npm run simulate -- [--runs N] [--seed N] [--policy id,id] [--hit percent,percent] [--out file]
// Runs the default matrix, prints a table and, with --out, writes the rows as JSON.
import { itemAt } from "../arrays";
import { gameData } from "../data";
import { POLICY_IDS, type PolicyId } from "./policies";
import {
  DEFAULT_MATRIX,
  formatTable,
  type Matrix,
  matrixCells,
  type MatrixRow,
  simulateCell,
} from "./report";

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

interface Options {
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

function parseHitRates(text: string): number[] {
  return text.split(",").map((part) => {
    const value = Number(part.replace(/%$/, ""));
    if (part === "" || !(value >= 0 && value <= 100)) {
      throw new Error(`--hit takes percentages from 0 to 100, not ${part}`);
    }
    return value / 100;
  });
}

function parseArgs(args: readonly string[]): Options {
  let matrix = DEFAULT_MATRIX;
  let out: string | undefined;
  let runs = DEFAULT_RUNS;
  let seed = DEFAULT_SEED;
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (value === undefined) {
      throw new Error(`${flag} needs a value`);
    }
    switch (flag) {
      case "--hit":
        matrix = { ...matrix, hitRates: parseHitRates(value) };
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
        throw new Error(`Unknown option ${flag}`);
    }
  }
  return { matrix, out, runs, seed };
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
  const started = performance.now();
  const rows = await simulateInWorkers(options);
  const seconds = (performance.now() - started) / 1000;
  const { matrix, out, runs, seed } = options;
  nodeProcess.stdout.write(`${formatTable(rows)}\n`);
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
