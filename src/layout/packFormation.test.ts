import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
import { decodePng } from "../assets/atlas/atlasBuild";
import { spriteSource } from "../assets/atlas/atlasLayout";
import { dogSpriteKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { DogId, Size, WalkerId } from "../data/types";
import { laneCenterXs } from "./lanes";
import {
  COLLAR_HEIGHTS,
  DOG_SILHOUETTES,
  everyPack,
  formationOrder,
  laneHalfWidth,
  leashHand,
  PACK_FEET,
  PACK_SLOTS,
  packDogOf,
  packOnRoad,
  packOutline,
  packPlacements,
  type PackSlot,
  PART_INSET,
  type PartBox,
  sideDx,
  tallestPackLength,
  tautLeashLine,
  unionBox,
  WALKER_HANDS,
  WALKER_SILHOUETTES,
} from "./packFormation";
import { distanceAtY, project, scaleAt, screenYAt } from "./projection";
import { screenLayout } from "./screenLayout";

const ROAD = screenLayout(SCREEN_CONFIG).road;
// The game's projection, its feet on the walker's feet line.
const PROJECTION = (() => {
  const footY = ROAD.y + ROAD.height - 6;
  const focal = (footY - ROAD_CAMERA.horizonY) / ROAD_CAMERA.ratio;
  return { centerX: ROAD.x + ROAD.width / 2, focal, footY, horizonY: ROAD_CAMERA.horizonY };
})();
const LANE_XS = laneCenterXs(LANE_COUNT, ROAD);
const WALKERS = Object.keys(WALKER_SILHOUETTES) as WalkerId[];
const DOGS = Object.keys(DOG_SILHOUETTES) as DogId[];
const PACKS = everyPack();

const walkerKey = (walker: WalkerId) => gameData.walkers[walker].spriteKey;
const dogKey = (dog: DogId) => dogSpriteKey(gameData, dog);

// The road's scale on the row footDy up the screen from the walker's feet.
const rowScale = (footDy: number) =>
  scaleAt(PROJECTION, distanceAtY(PROJECTION, PROJECTION.footY + footDy));

const FEET = new Map(
  (
    JSON.parse(readFileSync("public/art/manifest.json", "utf8")) as {
      sprites: { anchor?: { feetY: number }; key: string }[];
    }
  ).sprites.map(({ anchor, key }) => [key, anchor?.feetY]),
);

// A sprite from its art: the opaque pixels of its first frame, as columns and rows of the frame;
// the opaque bounds over its walk loop (right excluded); its frame width; and the feet row the
// art manifest stands it on.
interface Art {
  feetY: number;
  left: number;
  opaque: (readonly [number, number])[];
  right: number;
  top: number;
  width: number;
}

const ARTS = new Map<string, Art>();
function artOf(key: string): Art {
  const known = ARTS.get(key);
  if (known !== undefined) {
    return known;
  }
  const image = decodePng(readFileSync(`public/art/sprites/${key}.png`));
  const sheet: unknown = JSON.parse(readFileSync(`public/art/sprites/${key}.json`, "utf8"));
  const source = spriteSource(key, "", sheet);
  const walk = (source.tags as { from: number; name: string; to: number }[]).find(
    ({ name }) => name === "walk",
  );
  const loop = walk === undefined ? [0, 0] : [walk.from, walk.to];
  const feetY = FEET.get(key);
  if (feetY === undefined) {
    throw new Error(`${key} has no feet line`);
  }
  const art: Art = { feetY, left: Infinity, opaque: [], right: 0, top: Infinity, width: 0 };
  source.frames.forEach(({ from }, frame) => {
    if (frame < (loop[0] ?? 0) || frame > (loop[1] ?? 0)) {
      return;
    }
    art.width = from.width;
    for (let y = 0; y < from.height; y++) {
      for (let x = 0; x < from.width; x++) {
        if ((image.data[((from.y + y) * image.width + from.x + x) * 4 + 3] ?? 0) > 0) {
          art.left = Math.min(art.left, x);
          art.right = Math.max(art.right, x + 1);
          art.top = Math.min(art.top, y);
          if (frame === 0) {
            art.opaque.push([x, y]);
          }
        }
      }
    }
  });
  ARTS.set(key, art);
  return art;
}

// The pack drawn as packView draws it in lane: the walker on its feet at its lane's centre, and
// each dog, in formation order, on its feet row across from where the projection puts the
// walker's lane on that row.
interface Drawn {
  dog?: DogId;
  foot: number;
  key: string;
  x: number;
}

function drawnPack(lane: number, walker: WalkerId, dogs: readonly DogId[]): Drawn[] {
  const walkerX = itemAt(LANE_XS, lane);
  const ordered = formationOrder(dogs);
  const placements = packPlacements(PROJECTION, ordered.map(packDogOf));
  return [
    ...placements.map(({ dx, footDy }, i) => {
      const foot = PROJECTION.footY + footDy;
      const distance = distanceAtY(PROJECTION, foot);
      const x = Math.round(project(PROJECTION, { distance, x: walkerX }).x + dx);
      const dog = itemAt(ordered, i);
      return { dog, foot, key: dogKey(dog), x };
    }),
    { foot: PROJECTION.footY, key: walkerKey(walker), x: walkerX },
  ];
}

describe("silhouettes", () => {
  // Each sprite stands with its feet row on its feet line, centred on its frame.
  it.each([
    ...WALKERS.map((walker) => [walkerKey(walker), WALKER_SILHOUETTES[walker]] as const),
    ...DOGS.map((dog) => [dogKey(dog), DOG_SILHOUETTES[dog]] as const),
  ])("measures %s on its art", (key, silhouette) => {
    const art = artOf(key);
    expect(silhouette).toEqual({
      above: art.feetY - art.top,
      left: art.left - art.width / 2,
      right: art.right - art.width / 2,
    });
  });
});

describe("formationOrder", () => {
  // The biggest first, ties in roster order, whatever order the dogs were picked in.
  it.each<[DogId[], DogId[]]>([
    [
      ["zippy", "koda", "biscuit"],
      ["koda", "biscuit", "zippy"],
    ],
    [
      ["pierre", "archie"],
      ["archie", "pierre"],
    ],
    [
      ["zippy", "nugget", "duchess"],
      ["duchess", "nugget", "zippy"],
    ],
    [
      ["snowball", "koda"],
      ["koda", "snowball"],
    ],
    [["nugget"], ["nugget"]],
  ])("orders %j as %j", (picked, ordered) => {
    expect(formationOrder(picked)).toEqual(ordered);
    expect(formationOrder([...picked].reverse())).toEqual(ordered);
  });
});

describe("sideDx", () => {
  // Art's values: the lane's half width on the feet row less half the opaque width, rounded in,
  // on a side dog's row for its size, and for a big dog on the row of three bigs.
  it.each<[DogId, number, number | null]>([
    ["archie", 17, null],
    ["biscuit", 17, null],
    ["duchess", 19, null],
    ["koda", 14, 14],
    ["nugget", 19, null],
    ["penny", 15, 15],
    ["pierre", 16, null],
    ["snowball", 14, 14],
    ["zippy", 19, null],
  ])("stands %s %d across as a side dog, and %s among three bigs", (dog, side, threeBigs) => {
    const silhouette = DOG_SILHOUETTES[dog];
    expect(sideDx(PROJECTION, PACK_FEET.side[gameData.dogs[dog].size], silhouette)).toBe(side);
    if (threeBigs !== null) {
      expect(sideDx(PROJECTION, PACK_FEET.sideOfThreeBigs, silhouette)).toBe(threeBigs);
    }
  });
});

describe("packPlacements", () => {
  const SIDES = { lead: 0, left: -1, right: 1 } as const;

  // Each dog on its slot's side, in front of the walker; a trio's lead furthest ahead.
  it.each(PACK_SLOTS.map((slots) => [slots.length, slots] as const))(
    "walks every pack of %d in its formation",
    (count, slots) => {
      for (const dogs of PACKS.filter((pack) => pack.length === count)) {
        const placements = packPlacements(PROJECTION, formationOrder(dogs).map(packDogOf));
        expect(placements.map(({ dx }) => Math.sign(dx))).toEqual(slots.map((slot) => SIDES[slot]));
        const [first, ...rest] = placements.map(({ footDy }) => footDy);
        for (const footDy of [first ?? 0, ...rest]) {
          expect(footDy).toBeLessThan(0);
        }
        if (slots[0] === "lead") {
          for (const footDy of rest) {
            expect(first).toBeLessThan(footDy);
          }
        }
      }
    },
  );

  // Art's table: the feet rows of the dogs of a pack, in formation order.
  it.each<[DogId[], number[]]>([
    [["koda"], [-49]],
    [["pierre"], [-50]],
    [["zippy"], [-54]],
    [
      ["koda", "zippy"],
      [-45, -48],
    ],
    [
      ["koda", "penny", "snowball"],
      [-53, -37, -37],
    ],
    [
      ["koda", "penny", "pierre"],
      [-60, -45, -45],
    ],
    [
      ["koda", "penny", "zippy"],
      [-60, -45, -48],
    ],
    [
      ["koda", "pierre", "biscuit"],
      [-52, -45, -45],
    ],
    [
      ["koda", "pierre", "zippy"],
      [-52, -45, -48],
    ],
    [
      ["koda", "nugget", "zippy"],
      [-50, -48, -48],
    ],
    [
      ["archie", "biscuit", "pierre"],
      [-50, -45, -45],
    ],
    [
      ["archie", "biscuit", "zippy"],
      [-56, -45, -48],
    ],
    [
      ["archie", "nugget", "zippy"],
      [-50, -48, -48],
    ],
    [
      ["duchess", "nugget", "zippy"],
      [-54, -48, -48],
    ],
  ])("walks %j on feet rows %j", (dogs, rows) => {
    const placements = packPlacements(PROJECTION, formationOrder(dogs).map(packDogOf));
    expect(placements.map(({ footDy }) => footDy)).toEqual(rows);
  });

  // Each dog drawn on a lane's row stays inside that lane's edges as drawn there, in every lane,
  // the road's edges included.
  it.each(LANE_XS.map((_, lane) => lane))("draws every pack inside lane %d", (lane) => {
    const walkerX = itemAt(LANE_XS, lane);
    for (const dogs of PACKS) {
      for (const { foot, key, x } of drawnPack(lane, "casey", dogs).slice(0, -1)) {
        const distance = distanceAtY(PROJECTION, foot);
        const edge = (side: number) =>
          project(PROJECTION, { distance, x: walkerX + side * laneHalfWidth() }).x;
        const art = artOf(key);
        expect(x - art.width / 2 + art.left).toBeGreaterThanOrEqual(Math.floor(edge(-1)));
        expect(x - art.width / 2 + art.right).toBeLessThanOrEqual(Math.ceil(edge(1)));
      }
    }
  });

  it("draws no dogs for an empty pack, and a larger pack in the largest formation", () => {
    const dogs = DOGS.map(packDogOf);
    expect(packPlacements(PROJECTION, [])).toEqual([]);
    expect(packPlacements(PROJECTION, dogs.slice(0, 5)).length).toBe(PACK_SLOTS.at(-1)?.length);
  });
});

// The road the drawn pack covers: each sprite's opaque bounds, its columns at the road's scale
// on its feet row, mirrored too for a dog, as a pull draws it, and its rows as the road drawn
// there, across from the walker's lane and down the road from the walker's feet.
function drawnUnion(lane: number, walker: WalkerId, dogs: readonly DogId[]): PartBox {
  const walkerX = itemAt(LANE_XS, lane);
  const roadY = (row: number) => -distanceAtY(PROJECTION, row);
  const sprites = drawnPack(lane, walker, dogs);
  return unionBox(
    sprites.map(({ foot, key, x }, i) => {
      const art = artOf(key);
      const scale = scaleAt(PROJECTION, distanceAtY(PROJECTION, foot));
      const mirrors = i < sprites.length - 1;
      const left = mirrors ? Math.min(art.left, art.width - art.right) : art.left;
      const right = mirrors ? Math.max(art.right, art.width - art.left) : art.right;
      const centre = project(PROJECTION, { distance: distanceAtY(PROJECTION, foot), x: walkerX }).x;
      const roadX = (column: number) => (x - art.width / 2 + column - centre) / scale;
      return {
        bottom: roadY(foot),
        left: roadX(left),
        right: roadX(right),
        top: roadY(foot - (art.feetY - art.top)),
      };
    }),
  );
}

describe("the pack's outline", () => {
  // Rows exactly; columns within the half pixel packView rounds a dog's place by, on the
  // farthest row a dog stands on.
  const rounding =
    0.5 /
    Math.min(
      ...[
        ...Object.values(PACK_FEET.lead),
        ...Object.values(PACK_FEET.side),
        PACK_FEET.sideOfThreeBigs,
        ...Object.values(PACK_FEET.trioLead),
      ].map(rowScale),
    );
  it.each(WALKERS)("is the union of what is drawn for %s and any pack", (walker) => {
    for (const dogs of PACKS) {
      const box = packOutline(packOnRoad(PROJECTION, 0, { dogs, walker }));
      const drawn = drawnUnion(2, walker, dogs);
      expect(box.top).toBeCloseTo(drawn.top, 9);
      expect(box.bottom).toBeCloseTo(drawn.bottom, 9);
      expect(Math.abs(box.left - drawn.left)).toBeLessThanOrEqual(rounding);
      expect(Math.abs(box.right - drawn.right)).toBeLessThanOrEqual(rounding);
    }
  });

  // So a pack settled in a lane never touches anything in the lane beside it.
  it.each(WALKERS)("stays inside the lane for %s and any pack", (walker) => {
    for (const dogs of PACKS) {
      const box = packOutline(packOnRoad(PROJECTION, 0, { dogs, walker }));
      expect(box.left).toBeGreaterThanOrEqual(-laneHalfWidth());
      expect(box.right).toBeLessThanOrEqual(laneHalfWidth());
    }
  });

  it("is no longer than the longest any pack's runs", () => {
    const lengths = WALKERS.flatMap((walker) =>
      PACKS.map((dogs) => {
        const box = packOutline(packOnRoad(PROJECTION, 0, { dogs, walker }));
        return box.bottom - box.top;
      }),
    );
    expect(tallestPackLength(PROJECTION)).toBeCloseTo(Math.max(...lengths), 9);
  });
});

describe("the parts' hit rectangles", () => {
  // Each edge PART_INSET screen pixels inside the drawn part: a row of the projection's rows,
  // and a column at the road's scale on the part's feet row.
  const insets = (hit: PartBox, drawn: PartBox) => {
    const row = (y: number) => screenYAt(PROJECTION, -y);
    const scale = scaleAt(PROJECTION, -drawn.bottom);
    return [
      row(hit.top) - row(drawn.top),
      row(drawn.bottom) - row(hit.bottom),
      (hit.left - drawn.left) * scale,
      (drawn.right - hit.right) * scale,
    ];
  };

  // Every slot of every formation, filled with the largest dog of each size.
  const SIZE_DOGS: Readonly<Record<Size, DogId>> = {
    big: "snowball",
    medium: "pierre",
    small: "duchess",
  };
  const CASES = PACK_SLOTS.flatMap((slots) =>
    (Object.keys(SIZE_DOGS) as Size[]).flatMap((size) =>
      slots.map((slot, i) => [slots.length, slot, size, i] as const),
    ),
  );
  it.each(CASES)("lies inside a pack of %d's %s dog, %s", (count, _slot, size, i) => {
    const pack = {
      dogs: Array.from({ length: count }, () => SIZE_DOGS[size]),
      walker: "casey",
    } as const;
    const hit = itemAt(packOnRoad(PROJECTION, PART_INSET, pack).dogs, i);
    const drawn = itemAt(packOnRoad(PROJECTION, 0, pack).dogs, i);
    for (const inset of insets(hit, drawn)) {
      expect(inset).toBeCloseTo(PART_INSET, 9);
    }
  });

  it.each(WALKERS)("lies inside %s", (walker) => {
    const pack = { dogs: [], walker };
    const hit = packOnRoad(PROJECTION, PART_INSET, pack).walker;
    const drawn = packOnRoad(PROJECTION, 0, pack).walker;
    for (const inset of insets(hit, drawn)) {
      expect(inset).toBeCloseTo(PART_INSET, 9);
    }
  });
});

describe("readability", () => {
  // A dog's head is its rows down to its collar, its body the rows below; the shortest leash is
  // in screen pixels.
  // A lone dog shows its whole head.
  const LONE_HEAD = 1;
  // A side dog's head shows most of its face.
  const SIDE_HEAD = 0.8;
  // A side dog of two shows over half its body beside the walker.
  const PAIR_BODY = 0.58;
  // A trio's lead shows its face and ears over the side dogs' heads.
  const TRIO_LEAD_HEAD = 0.8;
  // A trio's side dog shows about half its body, three bigs walking closest.
  const TRIO_SIDE_BODY = 0.49;
  // Every leash runs visibly from the hand to the collar.
  const LEASH = 7;

  // Each dog's head and body shown, drawn back to front by their feet, a later dog in formation
  // order in front on a tie, the walker in front of them all.
  function shown(walker: WalkerId, dogs: readonly DogId[]) {
    const sprites = drawnPack(2, walker, dogs);
    const pixels = sprites.map(({ dog, foot, key, x }) => {
      const { feetY, opaque, width } = artOf(key);
      const collar = dog === undefined ? 0 : COLLAR_HEIGHTS[dog];
      return opaque.map(([col, row]) => ({
        head: row <= feetY - collar,
        id: `${x - width / 2 + col},${foot - feetY + row}`,
      }));
    });
    const ids = pixels.map((own) => new Set(own.map(({ id }) => id)));
    const inFront = (j: number, i: number) => {
      const [a, b] = [itemAt(sprites, j).foot, itemAt(sprites, i).foot];
      return a > b || (a === b && j > i);
    };
    return sprites.slice(0, -1).map((_sprite, i) => {
      const over = ids.filter((_, j) => inFront(j, i));
      const share = (head: boolean) => {
        const part = itemAt(pixels, i).filter((pixel) => pixel.head === head);
        return part.filter(({ id }) => !over.some((cover) => cover.has(id))).length / part.length;
      };
      return { body: share(false), head: share(true) };
    });
  }

  // The worst share of each slot's head and body shown, over every walker and pack.
  const WORST = (() => {
    const worst = new Map<string, number>();
    for (const walker of WALKERS) {
      for (const dogs of PACKS) {
        const formation = itemAt(PACK_SLOTS, dogs.length - 1);
        shown(walker, dogs).forEach((shares, i) => {
          for (const part of ["body", "head"] as const) {
            const key = `${dogs.length} ${itemAt(formation, i)} ${part}`;
            worst.set(key, Math.min(worst.get(key) ?? 1, shares[part]));
          }
        });
      }
    }
    return worst;
  })();

  // Each slot's floors: a pack size, a slot, the part and the least share of it shown.
  type Shown = readonly [number, PackSlot, "body" | "head", number];
  const SHOWN: readonly Shown[] = [
    [1, "lead", "head", LONE_HEAD],
    [2, "left", "head", SIDE_HEAD],
    [2, "left", "body", PAIR_BODY],
    [2, "right", "head", SIDE_HEAD],
    [2, "right", "body", PAIR_BODY],
    [3, "lead", "head", TRIO_LEAD_HEAD],
    [3, "left", "head", SIDE_HEAD],
    [3, "left", "body", TRIO_SIDE_BODY],
    [3, "right", "head", SIDE_HEAD],
    [3, "right", "body", TRIO_SIDE_BODY],
  ];

  it("floors every slot of every formation", () => {
    const slots = PACK_SLOTS.flatMap((formation) =>
      formation.map((slot) => `${formation.length} ${slot}`),
    );
    expect(new Set(SHOWN.map(([count, slot]) => `${count} ${slot}`))).toEqual(new Set(slots));
  });

  it.each(SHOWN)("shows a pack of %d's %s dog's %s at least %d", (count, slot, part, least) => {
    expect(WORST.get(`${count} ${slot} ${part}`)).toBeGreaterThanOrEqual(least);
  });

  it("runs every leash at least LEASH long", () => {
    for (const dogs of PACKS) {
      const ordered = formationOrder(dogs);
      packPlacements(PROJECTION, ordered.map(packDogOf)).forEach((placement, i) => {
        const hand = leashHand(placement);
        const collar = placement.footDy - COLLAR_HEIGHTS[itemAt(ordered, i)];
        expect(Math.hypot(placement.dx - hand.dx, collar - hand.dy)).toBeGreaterThanOrEqual(LEASH);
      });
    }
  });
});

describe("leashHand", () => {
  it("holds a dog on the left in the left hand, and the rest in the right", () => {
    expect(leashHand({ dx: -12, footDy: -9 }).dx).toBe(WALKER_HANDS.leftDx);
    expect(leashHand({ dx: 0, footDy: -9 }).dx).toBe(WALKER_HANDS.rightDx);
    expect(leashHand({ dx: 12, footDy: -9 }).dy).toBe(-WALKER_HANDS.heightAboveFeet);
  });
});

describe("tautLeashLine", () => {
  it.each([
    ["a steep leash a pixel left", { x: 10, y: 50 }, { x: 14, y: 20 }, { x: -1, y: 0 }],
    ["a shallow leash a pixel up", { x: 10, y: 50 }, { x: 40, y: 44 }, { x: 0, y: -1 }],
    [
      "a leash at 45 degrees left, as a steep one",
      { x: 0, y: 10 },
      { x: 10, y: 0 },
      { x: -1, y: 0 },
    ],
  ])("shifts %s", (_name, from, to, shift) => {
    const moved = (point: { x: number; y: number }) => ({
      x: point.x + shift.x,
      y: point.y + shift.y,
    });
    expect(tautLeashLine(from, to)).toEqual({ from: moved(from), to: moved(to) });
  });
});
