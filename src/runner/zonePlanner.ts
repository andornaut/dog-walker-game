import { laneMask } from "../layout/lanes";
import { itemAt, removeItem } from "../lib/arrays";
import { randomPick, weightedPick } from "../lib/random";
import { approachOutcomes } from "./approach";
import {
  laneBalanceWeight,
  type MoverBody,
  type MoverSpec,
  type MoverStand,
  type OnScreen,
  placeMovers,
  type PlannerStreams,
} from "./moverPlanning";
import { hasLeftRoad, type LaneSpan, type MoverPath, moverPlace } from "./movers";
import { type Block, LaneBlocks, PlacedPlaces, SpawnCells } from "./spawnCells";
import {
  blockingLength,
  type BlockingPlace,
  blockingPlace,
  type Cell,
  drawPath,
  type Footprint,
  hitLength,
  lastHitRow,
  lastRowTaken,
  moverRests,
  pathChanges,
  pathHeldLanes,
  type PlannedSpawns,
  quotaArea,
  quotaFootprint,
  rowSpacing,
  SINGLE_CELL,
  type SpawnEvent,
  type SpawnPlan,
  type SpawnQuota,
  WIDE_LANES,
  zoneRows,
} from "./spawning";
import { nthStretch, rowsWithin, WHOLE_ZONE } from "./stretches";

// How many road lengths of scroll after its cue a mover's contact with the pack is looked for in:
// enough for the slowest rider to reach the pack.
const SCAN_ROADS = 4;

// A mover quota as placeMovers takes it, with its kind's drawn hit length standing, which one
// stilled for want of room stands at.
interface PlacedMoverQuota<Kind extends string> {
  count: number;
  first: boolean;
  kind: Kind;
  spec: MoverSpec;
  standingLength: number | undefined;
  within?: readonly [number, number];
}

// The quotas of movers that block lanes, or of moving prizes, as placeMovers takes them.
function moverQuotas<Kind extends string>(
  blocking: boolean,
  quotas: readonly SpawnQuota<Kind>[],
): PlacedMoverQuota<Kind>[] {
  return quotas.flatMap(
    ({ blocksLane, count, first, hitLength: standingLength, kind, mover, within }) =>
      mover === undefined || blocksLane !== blocking
        ? []
        : [
            {
              count,
              first: first ?? false,
              kind,
              spec: mover,
              standingLength,
              ...(within === undefined ? {} : { within }),
            },
          ],
  );
}

// The road as placeMovers measures it.
function moverRoadOf(plan: SpawnPlan<string>, spacing: number) {
  return {
    cellLength: plan.cellLength,
    laneCount: plan.laneCount,
    laneInset: plan.laneInset,
    packHitLength: plan.packHitLength,
    packLength: plan.packLength,
    roadLength: plan.roadLength,
    rowSpacing: spacing,
    scrollSpeed: plan.scrollSpeed,
    sightLength: plan.sightLength,
    // The distance over which a one-row spawn on a row overlaps the pack.
    window: blockingLength(plan, 1),
    zoneLength: plan.zoneLength,
  };
}

// The rows that come on screen with a lane-blocking mover in view: of the rows whose windows the
// mover meets the pack in, on its path or any its stalking may take, those that come on screen
// once its body shows, at or below the road's top and not off its side: a cue, or a dart waiting
// at the road's edge, blocks nothing yet. A row comes on screen at its distance, as a standing
// spawn on it does, and a mover meets the pack at its distance from its cue less sightLength, as
// the pixel of scroll it first overlaps it.
function moverRowsInView(
  plan: SpawnPlan<string>,
  rows: readonly number[],
  cue: number,
  path: MoverPath,
  footprint: Footprint,
): number[] {
  const { laneCount } = plan;
  const rowWindow = blockingLength(plan, 1);
  const reach = blockingLength(plan, footprint.rows);
  const inset = plan.laneInset / plan.cellLength;
  const onRoad = (lanePosition: number) =>
    Math.ceil(lanePosition + footprint.lanes - inset) - 1 >= 0 &&
    Math.floor(lanePosition - 1 + inset) + 1 <= laneCount - 1;
  let shows = -1;
  let [start, end] = [Infinity, -Infinity];
  const paths = path.motion === "approach" ? approachOutcomes(path) : [path];
  for (const way of paths) {
    for (let since = 0; since < SCAN_ROADS * plan.roadLength; since++) {
      const place = moverPlace(laneCount, way, since);
      if (shows < 0 && place.solid && place.travel >= 0 && !hasLeftRoad(laneCount, place)) {
        shows = since;
      }
      const meets =
        place.solid &&
        place.travel >= plan.sightLength &&
        place.travel < plan.sightLength + reach &&
        onRoad(place.lanePosition);
      if (meets) {
        start = Math.min(start, cue + since - plan.sightLength);
        end = Math.max(end, cue + since + 1 - plan.sightLength);
      }
    }
  }
  return rows.flatMap((distance, row) =>
    shows >= 0 && distance >= cue + shows && start < distance + rowWindow && end > distance
      ? [row]
      : [],
  );
}

interface Run {
  first: number;
  last: number;
}

// The most quiet rows a run from first to last of rowCount rows may have: maxEmptyRows; half that,
// rounded down, for a run from the zone's first row or to its last, so a run across the road where
// two zones meet keeps near the cap; and none from the first row of a zone whose rows start on the
// road in view, so something meets the pack soon after it starts.
function quietAllowed(
  plan: Pick<SpawnPlan<string>, "firstContactSeconds" | "maxEmptyRows">,
  rowCount: number,
  first: number,
  last: number,
): number {
  if (first === 0 && plan.firstContactSeconds !== undefined) {
    return 0;
  }
  return first === 0 || last === rowCount - 1
    ? Math.floor(plan.maxEmptyRows / 2)
    : plan.maxEmptyRows;
}

// The runs of more quiet rows than they may have, rows that come on screen with nothing
// lane-blocking in view (0 in filled), and how many rows they run over it in all.
function quietRuns(
  plan: Pick<SpawnPlan<string>, "firstContactSeconds" | "maxEmptyRows">,
  filled: Uint8Array,
): { over: number; runs: Run[] } {
  const runs: Run[] = [];
  let over = 0;
  let first = 0;
  for (let row = 0; row <= filled.length; row++) {
    if (row < filled.length && filled[row] === 0) {
      continue;
    }
    const allowed = quietAllowed(plan, filled.length, first, row - 1);
    if (row - first > allowed) {
      runs.push({ first, last: row - 1 });
      over += row - first - allowed;
    }
    first = row + 1;
  }
  return { over, runs };
}

// The standing spawns of quotas in the order they are placed, each the ith of its quota's: the
// kinds take turns, in the order of their spawns' stretches along the zone, so a kind placed later
// still gets cells in every stretch and each keeps its share of what is placed. Within a turn the
// widest kinds go first, then the biggest. Sorting copies leaves the quotas alone; sort is stable,
// so equal kinds keep their order.
function standingTurns<Kind extends string>(
  quotas: readonly SpawnQuota<Kind>[],
): { i: number; quota: SpawnQuota<Kind> }[] {
  const across = (quota: SpawnQuota<Kind>) => quotaFootprint(quota).lanes;
  return [...quotas]
    .sort((a, b) => across(b) - across(a) || quotaArea(b) - quotaArea(a))
    .flatMap((quota, order) => {
      const [from, to] = quota.within ?? WHOLE_ZONE;
      return Array.from({ length: quota.count }, (_, i) => ({
        i,
        middle: from + ((i + 0.5) / quota.count) * (to - from),
        order,
        quota,
      }));
    })
    .sort((a, b) => a.middle - b.middle || a.order - b.order)
    .map(({ i, quota }) => ({ i, quota }));
}

// A lane-blocking standing spawn placed, with its block, cell, spawn and place for the pack-fit
// gap.
interface Standing<Kind extends string> {
  block: Block;
  cell: Cell;
  event: SpawnEvent<Kind>;
  place: BlockingPlace;
  quota: SpawnQuota<Kind>;
}

// Places a zone's spawns by planSpawns' rules, on the zone's rows and around its drawn path.
class ZonePlanner<Kind extends string> {
  private readonly cells: SpawnCells;
  private readonly events: SpawnEvent<Kind>[] = [];
  private readonly lanes: LaneBlocks;
  // The lane-blocking movers' bodies, as lane masks and distances along the zone.
  private readonly moverBodies: { from: number; lanes: number; to: number }[] = [];
  // The rows that come on screen with a lane-blocking mover in view (moverRowsInView).
  private readonly moverInView: Uint8Array;
  // What is on screen as the lane-blocking movers are placed.
  private readonly onScreen: OnScreen[] = [];
  private readonly places: PlacedPlaces;
  private readonly plan: SpawnPlan<Kind>;
  private readonly rows: readonly number[];
  private readonly spacing: number;
  private readonly standing: Standing<Kind>[] = [];
  private readonly statics: SpawnQuota<Kind>[];
  private readonly streams: PlannerStreams;
  // The plain lane-blocking standing spawns that found no room.
  private readonly unplaced: SpawnQuota<Kind>[] = [];

  constructor(
    streams: PlannerStreams,
    plan: SpawnPlan<Kind>,
    spacing: number,
    rows: readonly number[],
    path: readonly number[],
  ) {
    this.lanes = new LaneBlocks(plan, spacing, pathHeldLanes(path));
    this.moverInView = new Uint8Array(rows.length);
    this.places = new PlacedPlaces(plan, pathChanges(rows, path));
    this.plan = plan;
    this.rows = rows;
    this.spacing = spacing;
    this.statics = plan.quotas.filter((quota) => quota.mover === undefined);
    this.streams = streams;
    const prizes = plan.quotas.filter((quota) => quota.mover !== undefined && !quota.blocksLane);
    const reserved = [...this.statics, ...prizes].reduce(
      (sum, quota) => sum + (quota.mover !== undefined || quotaArea(quota) === 1 ? quota.count : 0),
      0,
    );
    this.cells = new SpawnCells(rows.length, plan.laneCount, reserved);
  }

  // Places every spawn, in the order planSpawns gives, and returns them.
  place(): SpawnEvent<Kind>[] {
    this.placeStanding((quota) => quota.first === true, this.placeMoving(true));
    this.placeMoving(false);
    this.placeStanding((quota) => quota.first !== true && quota.blocksLane, []);
    this.fillQuietRuns();
    const stilledPrizes = this.placePrizes();
    this.holdRests();
    this.placeStanding((quota) => quota.first !== true && !quota.blocksLane, stilledPrizes);
    return this.events;
  }

  // True when a lane-blocking standing spawn's hit box, from its row up the road for its hit
  // length, shares no road with a mover's body in its lanes.
  private clearOfMovers(cell: Cell, footprint: Footprint): boolean {
    const covered = laneMask(cell.lane, footprint.lanes);
    const from = itemAt(this.rows, cell.row);
    const to = from + hitLength(this.plan, footprint.rows);
    return this.moverBodies.every(
      (body) => (body.lanes & covered) === 0 || body.to <= from || to <= body.from,
    );
  }

  private fits(cell: Cell, footprint: Footprint, quota: SpawnQuota<Kind>): boolean {
    const { plan, rows, spacing } = this;
    const { blocksLane } = quota;
    if (cell.lane + footprint.lanes > plan.laneCount) {
      return false;
    }
    const last = lastRowTaken(plan, spacing, cell, footprint, blocksLane);
    if (last >= rows.length) {
      return false;
    }
    const covered = laneMask(cell.lane, footprint.lanes);
    for (let row = cell.row; row <= last; row++) {
      if ((this.cells.heldFor(row, quota) & covered) !== 0) {
        return false;
      }
    }
    const cells = footprint.lanes * (last - cell.row + 1);
    if (footprint.lanes * footprint.rows > 1 && !this.cells.leavesRoom(cells)) {
      return false;
    }
    if (!blocksLane) {
      return true;
    }
    if (!this.clearOfMovers(cell, footprint)) {
      return false;
    }
    if (
      footprint.lanes >= WIDE_LANES &&
      !this.lanes.clearOfWide(cell.row, lastHitRow(plan, spacing, cell, footprint))
    ) {
      return false;
    }
    return (
      this.places.fits(blockingPlace(plan, rows, quota, cell, footprint)) &&
      this.lanes.tryBlock(cell, footprint, false)
    );
  }

  private freeCells(
    quota: SpawnQuota<Kind>,
    footprint: Footprint,
    firstRow: number,
    endRow: number,
  ): Cell[] {
    const cells: Cell[] = [];
    for (let row = firstRow; row < endRow; row++) {
      for (let lane = 0; lane < this.plan.laneCount; lane++) {
        if (this.fits({ lane, row }, footprint, quota)) {
          cells.push({ lane, row });
        }
      }
    }
    return cells;
  }

  // The grid placeMovers places the lane-blocking movers on.
  private moverGrid() {
    const { cells, lanes, places } = this;
    return {
      block: (row: number, span: LaneSpan, rowsBlocked: number, keep: boolean, dart = false) =>
        lanes.tryBlock(
          { lane: span.first, row },
          { lanes: span.count, rows: rowsBlocked },
          keep,
          dart,
        ),
      clearRun: (span: LaneSpan, row: number) => lanes.clearRun(span, row),
      isFree: (motion: MoverPath["motion"], lane: number, row: number) =>
        cells.isFree(motion, lane, row),
      // Only the cells not yet taken use up room: a dart may set off over taken ones.
      leavesRoom: (spots: readonly Cell[]) => cells.leavesRoom(cells.untaken(spots)),
      occupy: ({ from, lanes: span, to }: MoverBody) => {
        this.moverBodies.push({ from, lanes: laneMask(span.first, span.count), to });
      },
      packFits: (stands: readonly MoverStand[]) => places.fitsAll(stands),
      stand: (stands: readonly MoverStand[]) => {
        for (const stand of stands) {
          places.add(stand);
        }
      },
      take: (dart: boolean, lane: number, row: number) => {
        cells.takeMover(dart, lane, row);
      },
    };
  }

  // The grid placeMovers places the moving prizes on. A moving prize keeps its cells clear of
  // other spawns, and nothing else: it blocks no lane, stands nowhere for the pack-fit gap, and
  // counts toward no cap on screen beside the lane-blocking movers.
  private prizeGrid() {
    return {
      ...this.moverGrid(),
      block: () => true,
      occupy: () => {},
      packFits: () => true,
      stand: () => {},
      take: (dart: boolean, lane: number, row: number) => {
        this.cells.takePrize(dart, lane, row);
      },
    };
  }

  // The movers marked first or not; a first mover with no room to move stands still instead,
  // in its footprint, among the first spawns that stand.
  private placeMoving(first: boolean): SpawnQuota<Kind>[] {
    const { plan, rows } = this;
    const quotas = moverQuotas(true, plan.quotas).filter((quota) => quota.first === first);
    const { dropped, spawns } = placeMovers(
      this.streams,
      moverRoadOf(plan, this.spacing),
      plan.moverCaps,
      this.moverGrid(),
      this.onScreen,
      rows,
      quotas,
    );
    this.events.push(...spawns);
    for (const { distance, kind, mover } of spawns) {
      const quota = quotas.find((other) => other.kind === kind);
      const footprint = quota?.spec.footprint ?? SINGLE_CELL;
      for (const row of moverRowsInView(plan, rows, distance, mover, footprint)) {
        this.moverInView[row] = 1;
      }
    }
    return first ? stilledQuotas(true, quotas, dropped) : [];
  }

  // The moving prizes, one quota at a time, sharing what is on screen, so each stilled one keeps
  // its own within. One with no room to move stands still instead, in its footprint, among the
  // other spawns that block no lane.
  private placePrizes(): SpawnQuota<Kind>[] {
    const { plan } = this;
    const road = moverRoadOf(plan, this.spacing);
    const grid = this.prizeGrid();
    const onScreen: OnScreen[] = [];
    return moverQuotas(false, plan.quotas).flatMap((quota) => {
      const { dropped, spawns } = placeMovers(
        this.streams,
        road,
        plan.moverCaps,
        grid,
        onScreen,
        this.rows,
        [quota],
      );
      this.events.push(...spawns);
      return stilledQuotas(false, [quota], dropped);
    });
  }

  // Holds every cell a placed mover may end a move on and stand in: the rows a spawn on which
  // overlaps the mover there, each spawn's hit box planned as hitLength, in the lanes it covers.
  private holdRests(): void {
    const { plan } = this;
    const oneRowHit = hitLength(plan, 1);
    const roadLanes = laneMask(0, plan.laneCount);
    for (const { distance, kind, mover } of this.events) {
      if (mover === undefined) {
        continue;
      }
      const footprint =
        plan.quotas.find((quota) => quota.kind === kind)?.mover?.footprint ?? SINGLE_CELL;
      const length = hitLength(plan, footprint.rows);
      for (const rest of moverRests(plan.laneCount, distance, mover)) {
        const covered = laneMask(rest.lane, footprint.lanes) & roadLanes;
        this.rows.forEach((rowDistance, row) => {
          if (rowDistance > rest.distance - oneRowHit && rowDistance < rest.distance + length) {
            this.cells.holdRest(row, covered);
          }
        });
      }
    }
  }

  // Places the standing spawns of the quotas keep picks, and of stilled, in turns (standingTurns).
  private placeStanding(
    keep: (quota: SpawnQuota<Kind>) => boolean,
    stilled: readonly SpawnQuota<Kind>[],
  ): void {
    for (const { i, quota } of standingTurns([...this.statics, ...stilled].filter(keep))) {
      this.placeOne(quota, i);
    }
  }

  // The cells for the ith of a quota's spawns: those in the ith of its count's equal stretches of
  // the rows it is spread over (within), or else anywhere in those rows. In a zone whose rows
  // start on the road in view, a lane-blocking one first in its stretch takes the zone's first
  // row while that row comes on screen quiet and it fits there, before a spawn placed later on
  // steers across it.
  private cellsFor(quota: SpawnQuota<Kind>, i: number): Cell[] {
    const footprint = quotaFootprint(quota);
    const within = rowsWithin(this.rows.length, quota.within ?? WHOLE_ZONE);
    const opening =
      this.plan.firstContactSeconds !== undefined &&
      quota.blocksLane &&
      i === 0 &&
      this.inView()[0] === 0
        ? this.freeCells(quota, footprint, 0, 1)
        : [];
    const stretch =
      opening.length > 0
        ? opening
        : this.freeCells(quota, footprint, ...nthStretch(quota.count, i, within));
    return stretch.length > 0 ? stretch : this.freeCells(quota, footprint, ...within);
  }

  // One of cells for a spawn: a lane-blocking one toward the lanes left unblocked longest.
  private pickCell(quota: SpawnQuota<Kind>, cells: readonly Cell[]): Cell {
    const across = quotaFootprint(quota).lanes;
    return quota.blocksLane
      ? weightedPick(
          this.streams.spawns,
          cells,
          cells.map((cell) =>
            laneBalanceWeight(this.lanes.clearRun({ count: across, first: cell.lane }, cell.row)),
          ),
        )
      : randomPick(this.streams.spawns, cells);
  }

  // The ith of a quota's spawns, on one of its cells (cellsFor). A fixed obstacle with no room
  // is swapped for a narrower one (placeNarrower); a plain lane-blocking one that still finds
  // none is kept for a quiet stretch.
  private placeOne(quota: SpawnQuota<Kind>, i: number): void {
    const cells = this.cellsFor(quota, i);
    if (cells.length > 0) {
      this.placeAt(quota, this.pickCell(quota, cells));
    } else if (!this.placeNarrower(quota, i) && quota.blocksLane && quota.first !== true) {
      this.unplaced.push(quota);
    }
  }

  // Swaps the ith spawn of a standing quota of a fixed kind, which has no room, for one of the
  // zone's narrower fixed kinds, a lane narrower at a time down to one: at each width, a kind
  // drawn by its weight among those with cells for the spawn (cellsFor), so the road keeps its
  // count of obstacles. No cell is kept for the narrower one, so it also leaves room for the
  // one-cell spawns still to place. True when one is placed.
  private placeNarrower(quota: SpawnQuota<Kind>, i: number): boolean {
    const { plan, spacing } = this;
    if (quota.mover !== undefined || !plan.fixedKinds.some(({ kind }) => kind === quota.kind)) {
      return false;
    }
    for (let across = quotaFootprint(quota).lanes - 1; across >= 1; across--) {
      const fitting = plan.fixedKinds.flatMap(({ footprint, hitLength: length, kind, weight }) => {
        if (footprint.lanes !== across) {
          return [];
        }
        const swapped: SpawnQuota<Kind> = {
          blocksLane: true,
          count: quota.count,
          footprint,
          kind,
          ...(length === undefined ? {} : { hitLength: length }),
        };
        const cells = this.cellsFor(swapped, i).filter((cell) =>
          this.cells.leavesRoom(
            across * (lastRowTaken(plan, spacing, cell, footprint, true) - cell.row + 1),
          ),
        );
        return cells.length > 0 ? [{ cells, swapped, weight }] : [];
      });
      if (fitting.length > 0) {
        const { cells, swapped } = weightedPick(
          this.streams.spawns,
          fitting,
          fitting.map(({ weight }) => weight),
        );
        this.placeAt(swapped, this.pickCell(swapped, cells));
        return true;
      }
    }
    return false;
  }

  // Places a spawn on a cell that fits it. A one-cell spawn of the plan's own takes the cell kept
  // for it.
  private placeAt(quota: SpawnQuota<Kind>, cell: Cell): void {
    const { plan, rows, spacing } = this;
    const footprint = quotaFootprint(quota);
    const lastRow = lastRowTaken(plan, spacing, cell, footprint, quota.blocksLane);
    const covered = laneMask(cell.lane, footprint.lanes);
    for (let row = cell.row; row <= lastRow; row++) {
      this.cells.standOn(row, covered);
    }
    const event = { distance: itemAt(rows, cell.row), kind: quota.kind, lane: cell.lane };
    if (quota.blocksLane) {
      if (footprint.lanes >= WIDE_LANES) {
        this.lanes.markWide(1, cell.row, lastHitRow(plan, spacing, cell, footprint));
      }
      this.lanes.tryBlock(cell, footprint, true);
      const place = blockingPlace(plan, rows, quota, cell, footprint);
      this.places.add(place);
      this.standing.push({ block: this.lanes.latest(), cell, event, place, quota });
    }
    this.events.push(event);
    if (this.statics.includes(quota) && quotaArea(quota) === 1) {
      this.cells.reserved -= 1;
    }
  }

  // A moved spawn takes a cell like any other, but its kept cell, if it had one, is already used.
  private placeMoved(quota: SpawnQuota<Kind>, cell: Cell): void {
    const kept = this.cells.reserved;
    this.placeAt(quota, cell);
    this.cells.reserved = kept;
  }

  // Whether each row comes on screen with a lane-blocking spawn in view: a mover marked in view,
  // or a standing spawn, in view from the moment its first row comes on.
  private inView(): Uint8Array {
    const filled = Uint8Array.from(this.moverInView);
    for (const { block } of this.standing) {
      filled.fill(1, block.row, block.lastRow + 1);
    }
    return filled;
  }

  // Takes a standing spawn off the road, freeing its cells but those a mover holds.
  private lift(lifted: Standing<Kind>): void {
    const { block, cell, event, place, quota } = lifted;
    const footprint = quotaFootprint(quota);
    const covered = laneMask(cell.lane, footprint.lanes);
    for (let row = cell.row; row <= block.lastRow; row++) {
      this.cells.lift(row, covered);
    }
    if (footprint.lanes >= WIDE_LANES) {
      this.lanes.markWide(0, cell.row, lastHitRow(this.plan, this.spacing, cell, footprint));
    }
    this.lanes.remove(block);
    this.places.remove(place);
    removeItem(event, this.events);
    removeItem(lifted, this.standing);
  }

  // Saves what a move changes, and returns what puts it back.
  private save(): () => void {
    const undo = [this.cells.save(), this.lanes.save(), this.places.save()];
    const events = [...this.events];
    const standing = [...this.standing];
    return () => {
      for (const restore of undo) {
        restore();
      }
      this.events.splice(0, this.events.length, ...events);
      this.standing.splice(0, this.standing.length, ...standing);
    };
  }

  // The cells of a quiet run a spawn fits, in the rows that leave no more quiet rows on either
  // side of it than they may have (quietAllowed), or else in any of its rows.
  private cellsIn(quota: SpawnQuota<Kind>, run: Run): Cell[] {
    const { plan, rows, spacing } = this;
    const footprint = quotaFootprint(quota);
    const cells = this.freeCells(quota, footprint, run.first, run.last + 1);
    const splits = cells.filter((cell) => {
      const after = lastRowTaken(plan, spacing, cell, footprint, true) + 1;
      return (
        cell.row - run.first <= quietAllowed(plan, rows.length, run.first, cell.row - 1) &&
        run.last + 1 - after <= quietAllowed(plan, rows.length, after, run.last)
      );
    });
    return splits.length > 0 ? splits : cells;
  }

  // How many rows within maxEmptyRows of a standing spawn come on screen with something else
  // lane-blocking in view.
  private busyness(from: Standing<Kind>): number {
    const { maxEmptyRows } = this.plan;
    const undo = this.save();
    this.lift(from);
    const filled = this.inView();
    undo();
    const first = Math.max(0, from.block.row - maxEmptyRows);
    const last = Math.min(this.rows.length - 1, from.block.lastRow + maxEmptyRows);
    return filled.subarray(first, last + 1).reduce((sum, row) => sum + row, 0);
  }

  // Fills a quiet run with one of the zone's plain standing spawns: one that found no room, or
  // else one moved from the busiest stretch, where the most rows near it come on screen with
  // something else in view; equally busy ones are tried in random order, each into the run as it
  // stands once that spawn is lifted. A move stands only if it leaves fewer rows quiet over the
  // cap in all, counting any it leaves where the spawn stood, which a later move may fill.
  private fillRun(run: Run, over: number): boolean {
    const { plan, streams } = this;
    for (const quota of this.unplaced) {
      const cells = this.cellsIn(quota, run);
      if (cells.length > 0) {
        removeItem(quota, this.unplaced);
        this.placeAt(quota, randomPick(streams.spawns, cells));
        return true;
      }
    }
    const ranked = this.standing
      .filter(({ quota }) => quota.first !== true)
      .map((from) => ({ busy: this.busyness(from), from }));
    while (ranked.length > 0) {
      const busiest = Math.max(...ranked.map(({ busy }) => busy));
      const pick = randomPick(
        streams.spawns,
        ranked.filter(({ busy }) => busy === busiest),
      );
      removeItem(pick, ranked);
      const undo = this.save();
      this.lift(pick.from);
      // The run as it stands with the spawn lifted, longer where the spawn stood beside it.
      const grown =
        quietRuns(plan, this.inView()).runs.find(
          ({ first, last }) => first <= run.first && run.last <= last,
        ) ?? run;
      const cells = this.cellsIn(pick.from.quota, grown);
      if (cells.length > 0) {
        this.placeMoved(pick.from.quota, randomPick(streams.spawns, cells));
        if (quietRuns(plan, this.inView()).over < over) {
          return true;
        }
      }
      undo();
    }
    return false;
  }

  // Fills the quiet runs over the cap, one spawn at a time, until none left can be filled.
  private fillQuietRuns(): void {
    for (;;) {
      const { over, runs } = quietRuns(this.plan, this.inView());
      if (!runs.some((run) => this.fillRun(run, over))) {
        return;
      }
    }
  }
}

// Every spawn takes free cells of a lane-by-row grid, its rows rowSpacing apart (zoneRows). Each
// kind's spawns are spread over equal stretches of the zone, or of the share of it a quota's within
// holds them to, one per stretch, so no kind bunches up. A lane-blocking spawn, standing or moving,
// is drawn among the places that fit toward the lanes left unblocked longest (laneBalanceWeight),
// so no lane stays clear for long. The standing kinds take turns along the zone, the widest first
// in each turn, so each keeps its share of what is placed. Before anything is placed, the zone
// draws its guaranteed path (drawPath), the lanes a pack can follow through it from pathStart.
// Lane-blocking spawns only take cells that keep that path clear: the path's lane stays open in
// every row's window and the gap after it, and on the row before the path changes lane every lane
// the change crosses does too. Each row's window and the gap after it also keep minOpenLanes open.
// In each row's window, no dart sweeps every lane of a stretch of road that the other lane-blocking
// spawns there wall off (openStretches), so a pack anywhere on the road has a lane to dodge a dart
// in without crossing another obstacle. A spawn more than one row long blocks every window and gap
// it overlaps, and must end within the zone's last row. Where the path changes lanes between two
// lane-blocking spawns, packFitsOnPath holds, for a mover wherever it stands, each spawn measured
// at its kind's drawn hit length (hitLength) and the pack at the tallest pack's hit boxes
// (packHitLength). Off the path, nothing else checks a way between spawns. Two lane-blocking spawns
// WIDE_LANES wide or wider have a row between the rows their hit boxes are on. The quotas marked
// first are placed first, their movers then the rest; then the other lane-blocking movers; then the
// other lane-blocking spawns; then the moving prizes; then the other spawns. Movers are placed by
// placeMovers. A dart may set off over cells the spawns placed before it hold, crossing over or
// past them, and a rider may pass over cells only darts hold (moverMayTake). Nothing else placed
// after a mover takes its cells, another dart included, but a lane-blocking standing spawn: one
// where a dart passes, which the dart then crosses over or past the same way, and one whose hit box
// shares no road with any other mover's body, the road that mover's hit box covers at some moment
// on screen, so the two never meet; a mover other than a dart holds every row its blocking and its
// path touch, which is more road than its body. A kind marked moversPassOver also takes a mover's
// cells, but not one where a mover may end a move and stand unless it is also marked moversRestOn.
// A mover with no room in its stretch, such as one over a cap on screen, waits for the next row
// with room; only one marked first stands still in its footprint when no row has room for it to
// move. A moving prize, such as a walking lucky find or a darting squirrel, is placed as a mover
// that blocks nothing: the cells it passes through are kept clear of other spawns placed after it,
// so it never walks into one, but no lane is blocked, it stands nowhere for the pack-fit gap and it
// counts toward no cap on screen beside the lane-blocking movers, since the pack never has to steer
// around it. A darting one may set off over the lane-blocking spawns' cells, as any dart may. It
// keeps a free cell for every moving prize, its own included, and with no room to move it stands
// still in one cell among the other spawns, so a prize is never skipped for want of room to move. A
// spawn that blocks no lane, such as a treat, also keeps off every spot where a mover placed may
// end a move and stand (moverRests), so no mover ever stops on one; a kind marked moversRestOn,
// such as a tip, may lie there. A lane-blocking mover, or an obstacle bigger than one cell, that
// the earlier draws left no room for is skipped, which uses no random draw; so is one that would
// leave fewer free cells than there are one-cell spawns. A free cell can still be one no
// lane-blocking spawn may take, where the path or the pack-fit gap along it rules it out, so a
// one-cell spawn with no room left is skipped too, the same way: a zone never fails to plan for
// want of room. A standing spawn of one of the zone's fixedKinds that finds no room in its stretch
// or anywhere else in the zone is first swapped for a narrower fixed kind, a lane narrower at a
// time, drawn by the kinds' weights among those that fit, and is skipped only when none of any
// narrower width fits. Once the lane-blocking spawns are placed, and before the moving prizes and
// the other spawns, a run of more than maxEmptyRows rows that come on screen with no lane-blocking
// spawn in view, half that, rounded down, from the zone's first row or to its last (none at all
// from the first row of a zone whose rows start on the road in view), gets one of the zone's own
// plain standing spawns: one skipped for want of room, or else one moved from the busiest stretch,
// placed under every rule above, so long as each move leaves fewer such rows in all. A run no spawn
// can take under them, such as one held clear for the path, stays.
export function planSpawns<Kind extends string>(
  streams: PlannerStreams,
  plan: SpawnPlan<Kind>,
): PlannedSpawns<Kind> {
  const spacing = rowSpacing(plan);
  const rows = zoneRows(plan, spacing);
  if (plan.pathStart < 0 || plan.pathStart >= plan.laneCount) {
    throw new Error("The path must start on the road");
  }
  const path = drawPath(streams, plan, rows.length);
  const events = new ZonePlanner(streams, plan, spacing, rows, path).place();
  return {
    events: events.sort((a, b) => a.distance - b.distance || a.lane - b.lane),
    path: path.map((lane, row) => ({ distance: itemAt(rows, row), lane })),
  };
}

// The movers placeMovers dropped, as quotas that stand still in their footprints, one per kind:
// a kind may have several quotas, such as one per stepper. Each keeps its kind's drawn hit length
// standing, which the pack-fit gap measures it by, and its within.
function stilledQuotas<Kind extends string>(
  blocksLane: boolean,
  quotas: readonly {
    readonly first: boolean;
    readonly kind: Kind;
    readonly spec: MoverSpec;
    readonly standingLength: number | undefined;
    readonly within?: readonly [number, number];
  }[],
  dropped: readonly Kind[],
): SpawnQuota<Kind>[] {
  const kinds = new Map(quotas.map((quota) => [quota.kind, quota]));
  return [...kinds.values()].flatMap(({ first, kind, spec, standingLength, within }) => {
    const count = dropped.filter((other) => other === kind).length;
    return count === 0
      ? []
      : [
          {
            blocksLane,
            count,
            first,
            footprint: spec.footprint,
            kind,
            ...(standingLength === undefined ? {} : { hitLength: standingLength }),
            ...(within === undefined ? {} : { within }),
          },
        ];
  });
}
