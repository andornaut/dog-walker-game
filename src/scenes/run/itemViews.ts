import { itemAt } from "@andornaut/game-kit/arrays";
import { getOrInsertComputed } from "@andornaut/game-kit/maps";
import { keysOf } from "@andornaut/game-kit/records";
import type { GameObjects, Scene } from "phaser";

import {
  encounterSpriteKey,
  gearDropSpriteKey,
  minorObstacleSpriteKey,
  ROAD_SPRITE_SIZE,
  SKUNK_CLOUD_KEY,
  STANDING_TAGS,
  WARNING_ARROW_KEY,
  WARNING_KEY,
  WARNING_WANDER_KEY,
} from "../../assets/spriteKeys";
import { gameData } from "../../data";
import { LANE_COUNT } from "../../data/screen";
import type { EncounterId, GearId, HintTrigger, MinorObstacleId } from "../../data/types";
import { moverHintTriggers } from "../../hud/hintTriggers";
import { obstacleParts } from "../../layout/obstacleArt";
import { herringNow } from "../../road/herrings";
import { type KeptScenery, struckBy, struckNow } from "../../road/struckScenery";
import { goesToVerge, vergeNow } from "../../road/vergeScenery";
import { moverTell } from "../../runner/movers";
import { minorLooks } from "../../runner/obstacleLooks";
import { screenRoadGeometry } from "../../runner/screenGeometry";
import type { SpawnEvent } from "../../runner/spawning";
import { type RoadGeometry, type Walk, type WalkStep } from "../../runner/walk";
import { walkGeometry } from "../../runner/walkGeometry";
import { itemCategory, type WalkItem, type WalkItemKind } from "../../runner/walkItems";
import { PALETTE } from "../../ui/palette";
import { addStandingSprite, ensurePlaceholder } from "../sprites";
import { applyItemCue } from "./itemCueViews";
import { drawMover, MOVER_CUE_PARTS, moverBodyKey } from "./moverView";
import { DEPTH, LANE_XS, LAYOUT, PROJECTION, ROW_DEPTH, type Shadow } from "./stage";
import { type StandFrame, standPart } from "./standPart";

// Road art that may be missing is drawn as a box this tall, as wide as its art: its lanes
// less the lane's spare width beside a 1-lane sprite.
const PLACEHOLDER_HEIGHT = ROAD_SPRITE_SIZE;

// One sprite of an item. dx is across the road from the item's centre and footY the flat
// road row it stands on, both in road pixels. feet "bottom" stands it on its frame's bottom
// rather than its anchor. A flat sprite lies on the road, under everything else with no
// shadow. A lifted sprite floats that many pixels, at its scale, over where it stands, with
// no shadow.
export interface ItemPart {
  dx: number;
  feet: "anchor" | "bottom";
  flat: boolean;
  footY: (item: Pick<WalkItem, "height" | "y">) => number;
  key: string;
  lift: number;
  sprite: GameObjects.Sprite;
}

export interface ItemView {
  parts: ItemPart[];
}

// A struck obstacle's body sprite and the screen offset added where the road draws it, for its
// jolt or shake.
export interface StruckBody {
  readonly offset: { dx: number; dy: number };
  readonly sprite: GameObjects.Sprite;
}

interface StruckView {
  readonly offset: { dx: number; dy: number };
  readonly struck: KeptScenery;
  readonly view: ItemView;
}

interface VergeView {
  readonly kept: KeptScenery;
  readonly view: ItemView;
}

// A box for each minor obstacle look, gear drop and the skunk's cloud whose art is missing, from
// its shape in the data, a drop one lane wide.
export function ensureRoadPlaceholders(scene: Scene): void {
  const pack = { dogs: [], walker: gameData.defaultWalker };
  const { cell } = walkGeometry(LANE_COUNT, pack, PROJECTION, LAYOUT.road);
  const add = (key: string, lanes: number) =>
    ensurePlaceholder(scene, key, {
      colour: PALETTE.slate,
      height: PLACEHOLDER_HEIGHT,
      width: lanes * cell.length - (cell.length - ROAD_SPRITE_SIZE),
    });
  for (const id of keysOf(gameData.minorObstacles)) {
    for (const look of minorLooks(gameData, id)) {
      add(minorObstacleSpriteKey(look), gameData.minorObstacles[id].shape.lanes);
    }
  }
  for (const gear of keysOf(gameData.shopGear)) {
    add(gearDropSpriteKey(gear), 1);
  }
  const skunk = gameData.encounters.skunk;
  add(SKUNK_CLOUD_KEY, skunk.kind === "obstacle" ? skunk.shape.lanes : 1);
}

// The flat road row an item stands on: its bottom.
function itemBottom(shown: Pick<WalkItem, "height" | "y">): number {
  return shown.y + shown.height;
}

// Where a mover's arrow sits among its parts: body, sign, arrow, wander mark, then any that go
// with its body.
const MOVER_ARROW_PART = 2;

// The sprites of everything spawned on the road, by item id.
export class ItemViews {
  // The red herring crossers on the road, by their planned spawn.
  private readonly herrings = new Map<SpawnEvent<WalkItemKind>, ItemView>();
  private readonly hint: (event: HintTrigger) => void;
  private readonly scene: Scene;
  // Obstacles out of play, kept as scenery until they scroll off, by item id.
  private readonly struck = new Map<number, StruckView>();
  // Darts that stop on the verge, kept as scenery once the walk drops them off the road, by item
  // id; and each such dart still on the road as the walk last had it.
  private readonly verge = new Map<number, VergeView>();
  private readonly vergeBound = new Map<number, KeptScenery>();
  private readonly views = new Map<number, ItemView>();

  constructor(scene: Scene, hint: (event: HintTrigger) => void) {
    this.scene = scene;
    this.hint = hint;
  }

  // Each item's sprites stand on the road through the projection, sized for where they stand
  // by showAtDepth.
  draw(walk: Walk, halted: boolean, still: boolean, shadow: Shadow): void {
    const seen = new Set<number>();
    const frame = { shadow, still, tags: halted ? STANDING_TAGS.halted : STANDING_TAGS.walking };
    const geometry = screenRoadGeometry(walk.run);
    const { roadTop } = geometry;
    for (const item of walk.road.items) {
      seen.add(item.id);
      const view = this.views.get(item.id) ?? this.addView(item);
      if (goesToVerge(LANE_COUNT, item)) {
        const { zoneDistance, zoneIndex } = walk.run;
        this.vergeBound.set(item.id, { item, zoneDistance, zoneIndex });
      }
      if (item.mover !== undefined) {
        drawMover({ ...item, mover: item.mover }, view, roadTop, halted, frame);
        // A moving lucky find bobs as it does standing.
        applyItemCue(item, view.parts, still, this.scene.time.now);
        // The cue's arrow shows only once it is wholly on the road below the juncture.
        if (view.parts[MOVER_ARROW_PART]?.sprite.visible === true) {
          for (const trigger of moverHintTriggers(moverTell(item.mover.path, item.mover.since))) {
            this.hint(trigger);
          }
        }
        continue;
      }
      this.stand(item, view, frame);
      applyItemCue(item, view.parts, still, this.scene.time.now);
    }
    for (const [id, view] of this.views) {
      if (!seen.has(id)) {
        const kept = this.vergeBound.get(id);
        if (kept === undefined) {
          view.parts.forEach(({ sprite }) => sprite.destroy());
        } else {
          this.verge.set(id, { kept, view });
        }
        this.views.delete(id);
      }
    }
    for (const id of this.vergeBound.keys()) {
      if (!seen.has(id)) {
        this.vergeBound.delete(id);
      }
    }
    this.drawStruck(walk, geometry, frame);
    this.drawVerge(walk, geometry, halted, frame);
    this.drawHerrings(walk, geometry, halted, frame);
  }

  // Each red herring crosser on the road now (herringNow), drawn as its mover is, with no cue; none
  // with reduced motion, as no distraction is.
  private drawHerrings(
    walk: Walk,
    geometry: RoadGeometry,
    halted: boolean,
    frame: StandFrame,
  ): void {
    const shown = new Set<SpawnEvent<WalkItemKind>>();
    for (const herring of frame.still ? [] : walk.road.herrings) {
      const item = herringNow(gameData, geometry, walk.run.zoneDistance, herring);
      if (item === null) {
        continue;
      }
      shown.add(herring);
      const view = getOrInsertComputed(
        herring,
        () => ({ parts: this.moverParts(herring.kind) }),
        this.herrings,
      );
      drawMover(item, view, geometry.roadTop, halted, frame);
    }
    for (const [herring, view] of this.herrings) {
      if (!shown.has(herring)) {
        view.parts.forEach(({ sprite }) => sprite.destroy());
        this.herrings.delete(herring);
      }
    }
  }

  // Each dart kept on the verge where its path and the road's scroll put it, drawn as a live
  // road sprite is, beside the road; dropped once off the road's bottom.
  private drawVerge(walk: Walk, geometry: RoadGeometry, halted: boolean, frame: StandFrame): void {
    for (const [id, { kept, view }] of this.verge) {
      const item = vergeNow(geometry, walk.run, kept);
      if (item?.mover === undefined) {
        view.parts.forEach(({ sprite }) => sprite.destroy());
        this.verge.delete(id);
        continue;
      }
      drawMover({ ...item, mover: item.mover }, view, geometry.roadTop, halted, frame);
    }
  }

  // Each dart kept on the verge as it stands now.
  vergeItems(walk: Walk): WalkItem[] {
    const geometry = screenRoadGeometry(walk.run);
    return [...this.verge.values()]
      .map(({ kept }) => vergeNow(geometry, walk.run, kept))
      .filter((item) => item !== null);
  }

  // Takes the obstacles a step's hits took out of play off the live views and keeps them as
  // scenery.
  strike(step: WalkStep): void {
    for (const struck of struckBy(step)) {
      const view = this.views.get(struck.item.id);
      this.vergeBound.delete(struck.item.id);
      if (view !== undefined) {
        this.views.delete(struck.item.id);
        this.struck.set(struck.item.id, { offset: { dx: 0, dy: 0 }, struck, view });
      }
    }
  }

  // A struck obstacle's body sprite, and the offset its draw adds, while it is kept.
  struckBody(id: number): StruckBody | undefined {
    const kept = this.struck.get(id);
    const sprite = kept?.view.parts[0]?.sprite;
    return kept === undefined || sprite === undefined ? undefined : { offset: kept.offset, sprite };
  }

  // Each struck obstacle where the road has scrolled it, a mover stopped and its cue hidden,
  // moved by its offset, under every live road sprite and the pack; dropped once off the road.
  private drawStruck(walk: Walk, geometry: RoadGeometry, frame: StandFrame): void {
    const { roadBottom, roadTop } = geometry;
    for (const [id, kept] of this.struck) {
      const item = struckNow(roadBottom, walk.run, kept.struck);
      const { parts } = kept.view;
      if (item === null) {
        parts.forEach(({ sprite }) => sprite.destroy());
        this.struck.delete(id);
        continue;
      }
      if (item.mover === undefined) {
        this.stand(item, kept.view, frame);
      } else {
        drawMover({ ...item, mover: item.mover }, kept.view, roadTop, true, frame);
        parts.slice(1, MOVER_CUE_PARTS + 1).forEach(({ sprite }) => sprite.setVisible(false));
      }
      const { dx, dy } = kept.offset;
      for (const { flat, sprite } of parts.filter((part) => part.sprite.visible)) {
        sprite.setPosition(sprite.x + Math.round(dx), sprite.y + Math.round(dy));
        if (!flat) {
          sprite.setDepth(DEPTH.struck + sprite.y * ROW_DEPTH);
        }
      }
    }
  }

  // A standing item's sprites across the middle of its lanes.
  private stand(item: WalkItem, view: ItemView, frame: StandFrame): void {
    const first = itemAt(LANE_XS, item.lane);
    const laneX = (first + itemAt(LANE_XS, item.lane + item.laneSpan - 1)) / 2;
    for (const part of view.parts) {
      standPart(item, part, laneX, frame);
    }
  }

  // The middle of an item's sprite on screen: a mover's body once it moves, else its cue.
  point(id: number): { x: number; y: number } | null {
    const parts = this.views.get(id)?.parts ?? [];
    const sprite = parts.map(({ sprite: shown }) => shown).find((shown) => shown.visible);
    return sprite === undefined
      ? null
      : { x: sprite.x, y: Math.round(sprite.y - sprite.displayHeight / 2) };
  }

  // Each item stands once at the near edge of its hit box, however many rows it covers, and a
  // lucky find or a gear drop on its frame's bottom. An obstacle draws obstacleParts, which it
  // collides as.
  private addView(item: WalkItem): ItemView {
    const has = (key: string) => this.scene.textures.exists(key);
    const category = itemCategory(gameData, item.kind);
    const lucky = category === "lucky";
    const part = this.partMaker(item.kind);
    let parts: ItemPart[];
    if (item.mover !== undefined) {
      parts = this.moverParts(item.kind);
    } else if (item.kind === "tip" || item.kind === "treat") {
      parts = [part(item.kind)];
    } else if (lucky) {
      parts = [part(encounterSpriteKey(item.kind as EncounterId))];
    } else if (category === "gear") {
      parts = [part(gearDropSpriteKey(item.kind as GearId))];
    } else {
      const kind = item.kind as EncounterId | MinorObstacleId;
      parts = obstacleParts(gameData, has, kind, false, item.skin).map(
        ({ behind, dx, flat, key }) =>
          part(key, { dx, flat, footY: (shown) => itemBottom(shown) - behind }),
      );
    }
    const view = { parts };
    this.views.set(item.id, view);
    return view;
  }

  // Makes the sprites of an item of a kind, standing on its feet: a lucky find's and a gear drop's
  // on its frame's bottom, anything else's on its anchor.
  private partMaker(
    kind: WalkItemKind,
  ): (key: string, overrides?: Partial<Omit<ItemPart, "key" | "sprite">>) => ItemPart {
    const { scene } = this;
    const category = itemCategory(gameData, kind);
    return (key, overrides = {}) => {
      const made: ItemPart = {
        dx: 0,
        feet: category === "lucky" || category === "gear" ? "bottom" : "anchor",
        flat: false,
        footY: itemBottom,
        key,
        lift: 0,
        sprite: addStandingSprite(scene, key, 0, 0),
        ...overrides,
      };
      if (made.feet === "bottom") {
        made.sprite.setOrigin(0.5, 1);
      }
      return made;
    };
  }

  // A mover's sprites: its body, its cue's sign, arrow and wander mark, then its other parts.
  private moverParts(item: WalkItemKind): ItemPart[] {
    const { scene } = this;
    const has = (key: string) => scene.textures.exists(key);
    const part = this.partMaker(item);
    const kind = item as EncounterId | MinorObstacleId;
    const body = moverBodyKey(scene, kind);
    const drawn = obstacleParts(gameData, has, kind, true);
    const behind = drawn.find(({ key }) => key === body)?.behind ?? 0;
    return [
      part(body, { footY: (shown) => itemBottom(shown) - behind }),
      part(WARNING_KEY),
      part(WARNING_ARROW_KEY),
      part(WARNING_WANDER_KEY),
      ...drawn
        .filter(({ key }) => key !== body)
        .map(({ behind: back, dx, flat, key }) =>
          part(key, { dx, flat, footY: (shown) => itemBottom(shown) - back }),
        ),
    ];
  }
}
