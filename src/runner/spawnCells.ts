import { laneMask } from "../layout/lanes";
import { itemAt, partitionPoint, removeItem } from "../lib/arrays";
import type { LaneSpan, MoverPath } from "./movers";
import {
  addLanes,
  type BlockingPlace,
  blockingSpan,
  type Cell,
  type Footprint,
  laneTotal,
  moverMayTake,
  openStretches,
  packFitsOnPath,
  packGap,
  PATH_MOST_LANES,
  type PathChange,
  type SpawnPlan,
  type SpawnQuota,
} from "./spawning";

// Every block kept: its first row, the last row whose window and the last whose gap it
// overlaps, and its lanes.
export interface Block {
  covered: number;
  lastGap: number;
  lastRow: number;
  row: number;
}

// The lanes the lane-blocking spawns block in each row's window and in the gap after it, the
// blocks kept, and the rows wide ones' hit boxes are on. pathHeld is the lanes the path keeps
// clear in each row's window and gap, a row for each of the zone's rows.
export class LaneBlocks {
  private readonly blocks: Block[] = [];
  private readonly blocked: Int32Array;
  private readonly gapBlocked: Int32Array;
  // The lanes darts block in each row's window, and the lanes every other lane-blocking spawn does.
  private readonly dartBlocked: Int32Array;
  private readonly wallBlocked: Int32Array;
  // What a trial block overwrote, by row, to undo it.
  private readonly blockedBefore: Int32Array;
  private readonly gapBefore: Int32Array;
  private readonly dartBefore: Int32Array;
  private readonly wallBefore: Int32Array;
  private readonly pathHeld: Int32Array;
  private readonly plan: SpawnPlan<string>;
  private readonly spacing: number;
  // Rows a wide lane-blocking spawn's hit box is on.
  private readonly wideRows: Uint8Array;

  constructor(plan: SpawnPlan<string>, spacing: number, pathHeld: Int32Array) {
    const rowCount = pathHeld.length;
    this.blocked = new Int32Array(rowCount);
    this.gapBlocked = new Int32Array(rowCount);
    this.dartBlocked = new Int32Array(rowCount);
    this.wallBlocked = new Int32Array(rowCount);
    this.blockedBefore = new Int32Array(rowCount);
    this.gapBefore = new Int32Array(rowCount);
    this.dartBefore = new Int32Array(rowCount);
    this.wallBefore = new Int32Array(rowCount);
    this.pathHeld = pathHeld;
    this.plan = plan;
    this.spacing = spacing;
    this.wideRows = new Uint8Array(rowCount);
  }

  // Blocks the footprint's lanes where they keep clear of the path, leave minOpenLanes open in
  // every window and gap they block and leave each stretch of road open in every window they
  // block (openStretches), counting them as a dart's sweep where dart is set and as a wall
  // otherwise, and undoes the block unless keep is set and they do.
  tryBlock(cell: Cell, footprint: Footprint, keep: boolean, dart = false): boolean {
    const { blocked, gapBlocked, pathHeld, plan } = this;
    const { laneCount, minOpenLanes } = plan;
    const rowCount = pathHeld.length;
    const { lastGap, lastRow } = blockingSpan(plan, this.spacing, cell.row, footprint.rows);
    if (lastRow >= rowCount || lastGap >= rowCount - 1) {
      return false;
    }
    const covered = laneMask(cell.lane, footprint.lanes);
    for (let row = cell.row; row <= Math.max(lastRow, lastGap); row++) {
      if (((pathHeld[row] ?? 0) & covered) !== 0) {
        return false;
      }
    }
    const swept = dart ? this.dartBlocked : this.wallBlocked;
    const sweptBefore = dart ? this.dartBefore : this.wallBefore;
    for (let row = cell.row; row <= lastRow; row++) {
      this.blockedBefore[row] = blocked[row] ?? 0;
      addLanes(row, covered, blocked);
      sweptBefore[row] = swept[row] ?? 0;
      addLanes(row, covered, swept);
    }
    for (let row = cell.row; row <= lastGap; row++) {
      this.gapBefore[row] = gapBlocked[row] ?? 0;
      addLanes(row, covered, gapBlocked);
    }
    let ok = true;
    for (let row = cell.row; ok && row <= lastRow; row++) {
      ok =
        laneCount - laneTotal(blocked[row] ?? 0) >= minOpenLanes &&
        openStretches(laneCount, this.wallBlocked[row] ?? 0, this.dartBlocked[row] ?? 0);
    }
    for (let row = cell.row; ok && row <= lastGap; row++) {
      ok = laneCount - laneTotal(gapBlocked[row] ?? 0) >= minOpenLanes;
    }
    if (ok && keep) {
      this.blocks.push({ covered, lastGap, lastRow, row: cell.row });
    }
    if (!ok || !keep) {
      for (let row = cell.row; row <= lastRow; row++) {
        blocked[row] = this.blockedBefore[row] ?? 0;
        swept[row] = sweptBefore[row] ?? 0;
      }
      for (let row = cell.row; row <= lastGap; row++) {
        gapBlocked[row] = this.gapBefore[row] ?? 0;
      }
    }
    return ok;
  }

  // The block kept last.
  latest(): Block {
    return itemAt(this.blocks, this.blocks.length - 1);
  }

  // Drops a block kept, and recomputes the lanes blocked in the windows and gaps it overlapped
  // from the blocks still kept. The lanes darts and walls sweep stay as they are.
  remove(block: Block): void {
    removeItem(block, this.blocks);
    const first = block.row;
    const last = Math.max(block.lastRow, block.lastGap);
    this.blocked.fill(0, first, last + 1);
    this.gapBlocked.fill(0, first, last + 1);
    for (const kept of this.blocks) {
      for (let row = Math.max(first, kept.row); row <= Math.min(last, kept.lastRow); row++) {
        addLanes(row, kept.covered, this.blocked);
      }
      for (let row = Math.max(first, kept.row); row <= Math.min(last, kept.lastGap); row++) {
        addLanes(row, kept.covered, this.gapBlocked);
      }
    }
  }

  // The longest run of rows through row whose windows leave any one of span's lanes unblocked.
  clearRun(span: LaneSpan, row: number): number {
    const { blocked } = this;
    let best = 0;
    for (let lane = span.first; lane < span.first + span.count; lane++) {
      const bit = 1 << lane;
      let run = 1;
      for (let r = row - 1; r >= 0 && ((blocked[r] ?? 0) & bit) === 0; r--) {
        run += 1;
      }
      for (let r = row + 1; r < blocked.length && ((blocked[r] ?? 0) & bit) === 0; r++) {
        run += 1;
      }
      best = Math.max(best, run);
    }
    return best;
  }

  // Whether no wide spawn's hit box is on rows first to last or a row either side of them.
  clearOfWide(first: number, last: number): boolean {
    return !this.wideRows.subarray(Math.max(0, first - 1), last + 2).includes(1);
  }

  // Marks rows first to last as a wide spawn's (1) or as no longer one's (0).
  markWide(value: 0 | 1, first: number, last: number): void {
    this.wideRows.fill(value, first, last + 1);
  }

  // Saves the blocks kept, the lanes they block and the wide rows, and returns what puts them
  // back. The lanes darts and walls sweep are not saved.
  save(): () => void {
    const blocks = [...this.blocks];
    const arrays = [this.blocked, this.gapBlocked, this.wideRows];
    const copies = arrays.map((array) => array.slice());
    return () => {
      arrays.forEach((array, i) => {
        array.set(itemAt(copies, i));
      });
      this.blocks.splice(0, this.blocks.length, ...blocks);
    };
  }
}

// The lane-blocking spawns placed so far, and every place each mover stands, by distance, which
// the pack must fit between along the path (packFitsOnPath). Two places with more road between
// them than the widest pack gap always fit the pack, so a place is checked only against those
// within longest, the longest length placed, and that gap.
export class PlacedPlaces {
  private readonly changes: readonly PathChange[];
  private longest = 0;
  private readonly places: BlockingPlace[] = [];
  private readonly plan: SpawnPlan<string>;
  private readonly widestGap: number;

  constructor(plan: SpawnPlan<string>, changes: readonly PathChange[]) {
    this.changes = changes;
    this.plan = plan;
    this.widestGap = packGap(plan, PATH_MOST_LANES);
  }

  add(place: BlockingPlace): void {
    const { places } = this;
    places.splice(
      partitionPoint((other) => other.distance < place.distance, places),
      0,
      place,
    );
    this.longest = Math.max(this.longest, place.length);
  }

  // True when the pack fits between a place and every place placed.
  fits(place: BlockingPlace): boolean {
    const { places } = this;
    const from = place.distance - this.longest - this.widestGap;
    const to = place.distance + Math.max(0, place.length) + this.widestGap;
    for (let i = partitionPoint((other) => other.distance < from, places); i < places.length; i++) {
      const other = itemAt(places, i);
      if (other.distance > to) {
        return true;
      }
      if (!packFitsOnPath(this.plan, this.changes, place, other)) {
        return false;
      }
    }
    return true;
  }

  // True when the pack fits between each of stands and every place placed, and between each two
  // of stands.
  fitsAll(stands: readonly BlockingPlace[]): boolean {
    return stands.every(
      (stand, i) =>
        this.fits(stand) &&
        stands.slice(i + 1).every((other) => packFitsOnPath(this.plan, this.changes, stand, other)),
    );
  }

  remove(place: BlockingPlace): void {
    removeItem(place, this.places);
  }

  // Saves the places, and returns what puts them back. longest is kept: it only bounds the
  // places checked.
  save(): () => void {
    const places = [...this.places];
    return () => {
      this.places.splice(0, this.places.length, ...places);
    };
  }
}

// Which lanes of each row the zone's spawns take or hold, as lane masks, and how many free cells
// are left. reserved is how many of them are kept for the one-cell spawns and moving prizes still
// to place, which are never skipped.
export class SpawnCells {
  reserved: number;
  // Lanes a dart holds.
  private readonly dartHeld: Int32Array;
  // Lanes taken by a standing spawn: a lane-blocking standing spawn may take a cell a mover
  // holds where no mover's body comes (ZonePlanner's clearOfMovers), and a dart then sets off
  // over or past it.
  private readonly heldByStanding: Int32Array;
  private left: number;
  // Lanes a mover holds, a dart or any other: lifting a standing spawn never frees them.
  private readonly moverHeld: Int32Array;
  // Lanes a mover other than a dart holds, which no rider takes.
  private readonly otherMoverHeld: Int32Array;
  // Lanes a moving prize holds, which a spawn a mover may pass over still keeps off.
  private readonly prizeHeld: Int32Array;
  // Lanes where a mover may end a move and stand, which no spawn that blocks no lane takes but
  // one marked moversRestOn.
  private readonly restHeld: Int32Array;
  // Lanes taken by any spawn.
  private readonly taken: Int32Array;

  constructor(rowCount: number, laneCount: number, reserved: number) {
    this.reserved = reserved;
    this.dartHeld = new Int32Array(rowCount);
    this.heldByStanding = new Int32Array(rowCount);
    this.left = rowCount * laneCount;
    this.moverHeld = new Int32Array(rowCount);
    this.otherMoverHeld = new Int32Array(rowCount);
    this.prizeHeld = new Int32Array(rowCount);
    this.restHeld = new Int32Array(rowCount);
    this.taken = new Int32Array(rowCount);
  }

  // Whether taking cells more free cells still leaves those reserved.
  leavesRoom(cells: number): boolean {
    return this.left - cells >= this.reserved;
  }

  // How many of cells are on the zone's rows and not yet taken.
  untaken(cells: readonly Cell[]): number {
    const { taken } = this;
    return cells.filter(
      ({ lane, row }) =>
        row >= 0 && row < taken.length && ((taken[row] ?? 0) & laneMask(lane, 1)) === 0,
    ).length;
  }

  // The lanes of a row a standing spawn of a quota may not take: a lane-blocking one, those
  // another standing spawn holds; one a mover may pass over, those and a moving prize's; any
  // other, every lane taken. One that blocks no lane also may not take a mover's resting spots,
  // unless a mover may rest on it.
  heldFor(row: number, quota: SpawnQuota<string>): number {
    if (quota.blocksLane) {
      return this.heldByStanding[row] ?? 0;
    }
    const held =
      quota.moversPassOver === true
        ? (this.heldByStanding[row] ?? 0) | (this.prizeHeld[row] ?? 0)
        : (this.taken[row] ?? 0);
    return quota.moversRestOn === true ? held : held | (this.restHeld[row] ?? 0);
  }

  // Whether a mover of a motion may take the cell (moverMayTake).
  isFree(motion: MoverPath["motion"], lane: number, row: number): boolean {
    const cell = laneMask(lane, 1);
    return moverMayTake(
      motion,
      ((this.dartHeld[row] ?? 0) & cell) !== 0,
      (((this.heldByStanding[row] ?? 0) | (this.otherMoverHeld[row] ?? 0)) & cell) !== 0,
    );
  }

  // A mover, a dart or any other, takes the cell, when it is on the zone's rows.
  takeMover(dart: boolean, lane: number, row: number): void {
    if (row >= 0 && row < this.taken.length) {
      const cell = laneMask(lane, 1);
      this.take(row, cell);
      addLanes(row, cell, this.moverHeld);
      addLanes(row, cell, dart ? this.dartHeld : this.otherMoverHeld);
    }
  }

  // A moving prize takes the cell as a mover does, and holds it as a prize.
  takePrize(dart: boolean, lane: number, row: number): void {
    this.takeMover(dart, lane, row);
    if (row >= 0 && row < this.taken.length) {
      addLanes(row, laneMask(lane, 1), this.prizeHeld);
    }
  }

  // A standing spawn takes the lanes of mask in row.
  standOn(row: number, mask: number): void {
    this.take(row, mask);
    addLanes(row, mask, this.heldByStanding);
  }

  // A standing spawn leaves the lanes of mask in row, freeing those no mover holds.
  lift(row: number, mask: number): void {
    const { heldByStanding, moverHeld, taken } = this;
    heldByStanding[row] = (heldByStanding[row] ?? 0) & ~mask;
    const freed = mask & (taken[row] ?? 0) & ~(moverHeld[row] ?? 0);
    taken[row] = (taken[row] ?? 0) & ~freed;
    this.left += laneTotal(freed);
  }

  // Holds the lanes of mask in row as a spot where a mover may end a move and stand.
  holdRest(row: number, mask: number): void {
    addLanes(row, mask, this.restHeld);
  }

  // Saves the lanes taken, those standing spawns hold and the count of free and reserved cells,
  // and returns what puts them back.
  save(): () => void {
    const arrays = [this.taken, this.heldByStanding];
    const copies = arrays.map((array) => array.slice());
    const { left, reserved } = this;
    return () => {
      arrays.forEach((array, i) => {
        array.set(itemAt(copies, i));
      });
      this.left = left;
      this.reserved = reserved;
    };
  }

  private take(row: number, mask: number): void {
    this.left -= laneTotal(mask & ~(this.taken[row] ?? 0));
    addLanes(row, mask, this.taken);
  }
}
