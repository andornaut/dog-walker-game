import type { GameObjects, Scene } from "phaser";

import { itemAt } from "../../arrays";
import {
  encounterSpriteKey,
  minorObstacleSpriteKey,
  MOVER_SPRITES,
  needSpotSpriteKey,
  ROAD_SPRITE_SIZE,
  SKUNK_CLOUD_KEY,
  WARNING_ARROW_KEY,
  WARNING_KEY,
} from "../../assets/spriteKeys";
import { gameData } from "../../data";
import { LANE_COUNT } from "../../data/screen";
import type { EncounterId, HintTrigger, MinorObstacleId, ZoneId } from "../../data/types";
import { project } from "../../layout/projection";
import { currentZoneId } from "../../rules/route";
import {
  encounterLook,
  minorObstacleLook,
  skinnedArt,
  skinnedCloudArt,
  skinnedOwnerArt,
} from "../../rules/skins";
import { isMoverObstacle } from "../../runner/movers";
import { isNeedSpot } from "../../runner/needs";
import { screenRoadGeometry } from "../../runner/screenGeometry";
import { isMinorObstacle, itemCategory, type Walk, type WalkItem } from "../../runner/walk";
import { walkGeometry } from "../../runner/walkGeometry";
import { needIcon } from "../needSignals";
import { PALETTE } from "../palette";
import { addStandingSprite, ensurePlaceholder, firstTag, playTag, showAtDepth } from "../sprites";
import { ItemCueViews } from "./itemCueViews";
import { drawMover, moverBodyKey } from "./moverView";
import { clipToRoad, DEPTH, ITEM_TAGS, LANE_XS, LAYOUT, PROJECTION, type Shadow } from "./stage";

// Road art that may be missing is drawn as a box this tall, as wide as its hit box.
const PLACEHOLDER_HEIGHT = ROAD_SPRITE_SIZE;
// The icon of a need spot that shares an obstacle's art floats this high over it, at 1x.
const SPOT_ICON_LIFT = 50;
// Road pixels the skunk stands behind its cloud's near edge, so it reads as inside the spray.
const SKUNK_IN_CLOUD = 10;

// One sprite of an item. dx is across the road from the item's centre and footY the flat
// road row it stands on, both in road pixels. feet "bottom" stands it on its frame's bottom
// rather than its anchor. A flat sprite lies on the road, under everything else with no
// shadow. A lifted sprite floats that many pixels, at its scale, over where it stands, with
// no shadow.
export interface ItemPart {
  dx: number;
  feet: "anchor" | "bottom";
  flat: boolean;
  footY: (item: WalkItem) => number;
  key: string;
  lift: number;
  sprite: GameObjects.Sprite;
}

export interface ItemView {
  parts: ItemPart[];
}

// A box for each minor obstacle, the skunk's cloud and the hydrant whose art is missing, from
// its shape in the data. The hydrant stands in for any need spot whose art is missing.
export function ensureRoadPlaceholders(scene: Scene): void {
  const { cell } = walkGeometry(LANE_COUNT, 1, PROJECTION, LAYOUT.road);
  const add = (key: string, lanes: number) =>
    ensurePlaceholder(scene, key, {
      color: PALETTE.slate,
      height: PLACEHOLDER_HEIGHT,
      width: lanes * cell.length - 2 * cell.inset,
    });
  for (const [id, obstacle] of Object.entries(gameData.minorObstacles)) {
    add(minorObstacleSpriteKey(id as MinorObstacleId), obstacle.shape.lanes);
  }
  const skunk = gameData.encounters.skunk;
  add(SKUNK_CLOUD_KEY, skunk.kind === "obstacle" ? skunk.shape.lanes : 1);
  add(needSpotSpriteKey("fireHydrant"), 1);
}

// The sprites of everything spawned on the road, by item id.
export class ItemViews {
  private readonly cues: ItemCueViews;
  private readonly hint: (event: HintTrigger) => void;
  private readonly scene: Scene;
  private readonly views = new Map<number, ItemView>();

  constructor(scene: Scene, hint: (event: HintTrigger) => void) {
    this.scene = scene;
    this.hint = hint;
    this.cues = new ItemCueViews(scene);
  }

  // Each item's sprites stand on the road through the projection, sized for where they stand
  // by showAtDepth.
  draw(walk: Walk, halted: boolean, still: boolean, shadow: Shadow): void {
    const seen = new Set<number>();
    const tags = halted ? ITEM_TAGS.halted : ITEM_TAGS.walking;
    const { roadTop } = screenRoadGeometry(walk.run);
    const zone = currentZoneId(gameData, walk.run);
    for (const item of walk.road.items) {
      seen.add(item.id);
      const view = this.views.get(item.id) ?? this.addView(zone, item);
      if (item.mover !== undefined) {
        drawMover(item.mover, view, item.y + item.height, roadTop, halted, still, shadow);
        continue;
      }
      const first = itemAt(LANE_XS, item.lane);
      const laneX = (first + itemAt(LANE_XS, item.lane + item.laneSpan - 1)) / 2;
      // A need spot, such as the waving stranger, holds its idle frame under reduced motion.
      const itemTags = still && isNeedSpot(gameData, item.kind) ? ITEM_TAGS.halted : tags;
      for (const part of view.parts) {
        const distance = PROJECTION.footY - part.footY(item);
        const placed = project(PROJECTION, { distance, x: laneX + part.dx });
        const drawn = showAtDepth(part.sprite, part.key, placed.scale, part.feet);
        const x = Math.round(placed.x);
        const y = Math.round(placed.y);
        part.sprite.setPosition(x, y - Math.round(part.lift * drawn.depth));
        clipToRoad(part.sprite);
        const tag = firstTag(this.scene, drawn.key, itemTags);
        if (tag !== undefined) {
          playTag(part.sprite, drawn.key, tag, still);
        }
        if (part.lift > 0) {
          part.sprite.setDepth(DEPTH.sprite + placed.y + 1);
        } else if (part.flat) {
          part.sprite.setDepth(DEPTH.decal);
        } else {
          part.sprite.setDepth(DEPTH.sprite + placed.y);
          shadow(part.key, drawn.depth, x, y);
        }
      }
      this.cues.apply(item, view.parts, still);
    }
    this.cues.prune(seen);
    for (const [id, view] of this.views) {
      if (!seen.has(id)) {
        view.parts.forEach(({ sprite }) => sprite.destroy());
        this.views.delete(id);
      }
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
  // lucky find on its frame's bottom. A puddle lies flat under the rest, and a skunk stands just
  // inside the front of its spray cloud, which lies flat too. An obstacle wears its skin for the
  // zone, and the other dog's owner stands beside it in the skin's owner art.
  private addView(zone: ZoneId, item: WalkItem): ItemView {
    const { scene } = this;
    const has = (key: string) => scene.textures.exists(key);
    const encounterArt = (id: EncounterId) => skinnedArt(has, encounterLook(gameData, zone, id));
    const otherDogOwner = () => skinnedOwnerArt(has, encounterLook(gameData, zone, "otherDog"));
    const bottom = (shown: WalkItem) => shown.y + shown.height;
    const lucky = itemCategory(gameData, item.kind) === "lucky";
    const part = (key: string, overrides: Partial<Omit<ItemPart, "key" | "sprite">> = {}) => {
      const made: ItemPart = {
        dx: 0,
        feet: lucky ? "bottom" : "anchor",
        flat: false,
        footY: bottom,
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
    const flat = { flat: true } as const;
    let parts: ItemPart[];
    if (item.mover !== undefined) {
      const body = moverBodyKey(scene, zone, item.mover.path.mover);
      parts = [part(body), part(WARNING_KEY), part(WARNING_ARROW_KEY)];
    } else if (isMoverObstacle(item.kind)) {
      parts = [part(MOVER_SPRITES[item.kind].key)];
    } else if (item.kind === "tip" || item.kind === "treat") {
      parts = [part(item.kind)];
    } else if (isNeedSpot(gameData, item.kind)) {
      this.hint({ kind: "needSpot" });
      // A spot whose art is missing stands in as a hydrant. The need's icon floats over a spot
      // that looks like an obstacle, the hydrant and the other dog, and any without its art.
      const art = needSpotSpriteKey(item.kind);
      const key = scene.textures.exists(art) ? art : "hydrant";
      const shared = key === "hydrant" || key === encounterSpriteKey("otherDog");
      const icon = needIcon(scene, gameData.needSpots[item.kind].need);
      parts = shared
        ? [part(key), part(icon.key, { feet: "bottom", lift: SPOT_ICON_LIFT })]
        : [part(key)];
    } else if (isMinorObstacle(gameData, item.kind)) {
      parts = [part(skinnedArt(has, minorObstacleLook(gameData, zone, item.kind)))];
    } else if (item.kind === "skunk") {
      parts = [
        part(skinnedCloudArt(has, encounterLook(gameData, zone, "skunk")), flat),
        part(encounterArt("skunk"), { footY: (shown) => bottom(shown) - SKUNK_IN_CLOUD }),
      ];
    } else if (item.kind === "otherDog" && has(otherDogOwner())) {
      parts = [part(encounterArt(item.kind), { dx: -10 }), part(otherDogOwner(), { dx: 13 })];
    } else {
      parts = [part(encounterArt(item.kind), item.kind === "puddle" ? flat : {})];
    }
    const view = { parts };
    this.views.set(item.id, view);
    return view;
  }
}
