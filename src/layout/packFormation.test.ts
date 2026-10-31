import { readFileSync } from "node:fs";

import { itemAt } from "@andornaut/game-kit/arrays";
import { decodePng } from "@andornaut/game-kit/art/png";
import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { dogSpriteKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_LAYOUT } from "../data/screen";
import type { DogId, Size, WalkerId } from "../data/types";
import { walkProjection } from "../runner/walkGeometry";
import { spriteSource } from "../tools/atlas/atlasLayout";
import { laneCentreXs } from "./lanes";
import {
  COLLAR_HEIGHTS,
  DOG_SILHOUETTES,
  everyPack,
  formationOrder,
  LANE_HALF_WIDTH,
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
  tallestPackLength,
  tautLeashLine,
  unionBox,
  WALKER_SILHOUETTES,
} from "./packFormation";
import { distanceAtY, project, scaleAt, screenYAt } from "./projection";

const ROAD = SCREEN_LAYOUT.road;
// The game's projection, its feet on the walker's feet line.
const PROJECTION = walkProjection(ROAD_CAMERA, ROAD);
const LANE_XS = laneCentreXs(LANE_COUNT, ROAD);
const WALKERS = keysOf(WALKER_SILHOUETTES);
const DOGS = keysOf(DOG_SILHOUETTES);
const PACKS = everyPack();

const walkerKey = (walker: WalkerId) => gameData.walkers[walker].spriteKey;
const dogKey = (dog: DogId) => dogSpriteKey(gameData, dog);

// The road's scale on the row footDy up the screen from the walker's feet.
const rowScale = (footDy: number) =>
  scaleAt(PROJECTION, distanceAtY(PROJECTION, PROJECTION.footY + footDy));

const ANCHORS = new Map(
  (
    JSON.parse(readFileSync("public/art/manifest.json", "utf8")) as {
      sprites: { anchor?: { feetY: number; opaqueWidth: number }; key: string }[];
    }
  ).sprites.map(({ anchor, key }) => [key, anchor]),
);

// A sprite from its art: the opaque pixels of its first frame, as columns and rows of the frame;
// the opaque bounds over its walk loop (right excluded); its frame width; and the feet row the
// art manifest stands it on.
interface Art {
  feetY: number;
  left: number;
  opaque: (readonly [number, number])[];
  opaqueWidth: number;
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
  const anchor = ANCHORS.get(key);
  if (anchor === undefined) {
    throw new Error(`${key} has no feet line`);
  }
  const art: Art = { ...anchor, left: Infinity, opaque: [], right: 0, top: Infinity, width: 0 };
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

describe("rendering anchors", () => {
  it("places each sprite on its first frame's actual feet and width", () => {
    for (const key of [...WALKERS.map(walkerKey), ...DOGS.map(dogKey)]) {
      const art = artOf(key);
      const columns = art.opaque.map(([column]) => column);
      const rows = art.opaque.map(([, row]) => row);
      expect(art.feetY, key).toBe(Math.max(...rows));
      expect(art.opaqueWidth, key).toBe(Math.max(...columns) + 1 - Math.min(...columns));
    }
  });
});

describe("formationOrder", () => {
  // The biggest first, ties in roster order, whatever order the dogs were picked in.
  it("orders the biggest first, ties in roster order", () => {
    const roster = keysOf(gameData.dogs);
    const small = roster.filter((dog) => gameData.dogs[dog].size === "small");
    const large = roster.find((dog) => gameData.dogs[dog].size === "large") as DogId;
    const picked: DogId[] = [...small].reverse().concat(large);
    expect(formationOrder(picked)).toEqual([large, ...small]);
    expect(formationOrder([...picked].reverse())).toEqual([large, ...small]);
  });
});

describe("packPlacements", () => {
  const SIDES = { lead: 0, left: -1, right: 1 } as const;

  // Each dog on its slot's side, in front of the walker; a trio's lead furthest ahead.
  it("walks every pack in its formation", () => {
    for (const dogs of PACKS) {
      const slots = itemAt(PACK_SLOTS, dogs.length - 1);
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
  });

  // Each dog drawn on a lane's row stays inside that lane's edges as drawn there, in every lane,
  // the road's edges included.
  it("draws every pack inside its lane, in every lane", () => {
    const outside: string[] = [];
    LANE_XS.forEach((walkerX, lane) => {
      for (const dogs of PACKS) {
        for (const { foot, key, x } of drawnPack(lane, "casey", dogs).slice(0, -1)) {
          const distance = distanceAtY(PROJECTION, foot);
          const edge = (side: number) =>
            project(PROJECTION, { distance, x: walkerX + side * LANE_HALF_WIDTH }).x;
          const art = artOf(key);
          if (
            x - art.width / 2 + art.left < Math.floor(edge(-1)) ||
            x - art.width / 2 + art.right > Math.ceil(edge(1))
          ) {
            outside.push(`${key} of ${dogs.join(",")} in lane ${lane}`);
          }
        }
      }
    });
    expect(outside).toEqual([]);
  });

  it("draws no dogs for an empty pack, and a larger pack in the largest formation", () => {
    const dogs = DOGS.map(packDogOf);
    expect(packPlacements(PROJECTION, [])).toEqual([]);
    expect(packPlacements(PROJECTION, dogs.slice(0, 5)).length).toBe(PACK_SLOTS.at(-1)?.length);
  });
});

// Project the fixed logical masks through the independently drawn actor positions. Decorative
// animation bounds and contact masks are separate, so pixel changes cannot resize this outline.
function logicalUnion(lane: number, walker: WalkerId, dogs: readonly DogId[]): PartBox {
  const walkerX = itemAt(LANE_XS, lane);
  const roadY = (row: number) => -distanceAtY(PROJECTION, row);
  const sprites = drawnPack(lane, walker, dogs);
  return unionBox(
    sprites.map(({ dog, foot, x }, i) => {
      const silhouette = dog === undefined ? WALKER_SILHOUETTES[walker] : DOG_SILHOUETTES[dog];
      const scale = scaleAt(PROJECTION, distanceAtY(PROJECTION, foot));
      const mirrors = i < sprites.length - 1;
      const left = mirrors ? Math.min(silhouette.left, -silhouette.right) : silhouette.left;
      const right = mirrors ? Math.max(silhouette.right, -silhouette.left) : silhouette.right;
      const centre = project(PROJECTION, { distance: distanceAtY(PROJECTION, foot), x: walkerX }).x;
      const roadX = (column: number) => (x + column - centre) / scale;
      return {
        bottom: roadY(foot),
        left: roadX(left),
        right: roadX(right),
        top: roadY(foot - silhouette.above),
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
        PACK_FEET.sideOfThreeLarge,
        ...Object.values(PACK_FEET.trioLead),
      ].map(rowScale),
    );
  // And so a pack settled in a lane never touches anything in the lane beside it.
  it("is the projected union of logical masks, inside the lane, for every walker and pack", () => {
    for (const walker of WALKERS) {
      for (const dogs of PACKS) {
        const box = packOutline(packOnRoad(PROJECTION, 0, { dogs, walker }));
        const drawn = logicalUnion(2, walker, dogs);
        const name = `${walker} with ${dogs.join(",")}`;
        expect(box.top, name).toBeCloseTo(drawn.top, 9);
        expect(box.bottom, name).toBeCloseTo(drawn.bottom, 9);
        expect(Math.abs(box.left - drawn.left), name).toBeLessThanOrEqual(rounding);
        expect(Math.abs(box.right - drawn.right), name).toBeLessThanOrEqual(rounding);
        expect(box.left, name).toBeGreaterThanOrEqual(-LANE_HALF_WIDTH);
        expect(box.right, name).toBeLessThanOrEqual(LANE_HALF_WIDTH);
      }
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
    large: "sequoia",
    medium: "pepe",
    small: "ginger",
  };
  const CASES = PACK_SLOTS.flatMap((slots) =>
    keysOf(SIZE_DOGS).flatMap((size) =>
      slots.map((slot, i) => [slots.length, slot, size, i] as const),
    ),
  );
  it("lies inside every slot's dog of every size, and every walker", () => {
    for (const [count, slot, size, i] of CASES) {
      const pack = {
        dogs: Array.from({ length: count }, () => SIZE_DOGS[size]),
        walker: "casey",
      } as const;
      const hit = itemAt(packOnRoad(PROJECTION, PART_INSET, pack).dogs, i);
      const drawn = itemAt(packOnRoad(PROJECTION, 0, pack).dogs, i);
      for (const inset of insets(hit, drawn)) {
        expect(inset, `${count} ${slot} ${size}`).toBeCloseTo(PART_INSET, 9);
      }
    }
    for (const walker of WALKERS) {
      const pack = { dogs: [], walker };
      const hit = packOnRoad(PROJECTION, PART_INSET, pack).walker;
      const drawn = packOnRoad(PROJECTION, 0, pack).walker;
      for (const inset of insets(hit, drawn)) {
        expect(inset, walker).toBeCloseTo(PART_INSET, 9);
      }
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

  it("floors every slot of every formation, and shows each at least its floor", () => {
    const slots = PACK_SLOTS.flatMap((formation) =>
      formation.map((slot) => `${formation.length} ${slot}`),
    );
    expect(new Set(SHOWN.map(([count, slot]) => `${count} ${slot}`))).toEqual(new Set(slots));
    const under = SHOWN.filter(
      ([count, slot, part, least]) => (WORST.get(`${count} ${slot} ${part}`) ?? 0) < least,
    );
    expect(under).toEqual([]);
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

describe("tautLeashLine", () => {
  it("shifts a steep leash a pixel left and a shallow one a pixel up", () => {
    expect(tautLeashLine({ x: 10, y: 50 }, { x: 14, y: 20 })).toEqual({
      from: { x: 9, y: 50 },
      to: { x: 13, y: 20 },
    });
    expect(tautLeashLine({ x: 10, y: 50 }, { x: 40, y: 44 })).toEqual({
      from: { x: 10, y: 49 },
      to: { x: 40, y: 43 },
    });
  });
});
