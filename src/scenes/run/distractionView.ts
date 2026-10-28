import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../../assets/asepriteAnimations";
import { IDLE_TAG } from "../../assets/spriteKeys";
import { gameData } from "../../data";
import { LANE_COUNT } from "../../data/screen";
import { project } from "../../layout/projection";
import { itemAt } from "../../lib/arrays";
import { getOrInsert } from "../../lib/maps";
import type { Random } from "../../lib/random";
import { ROADSIDE } from "../../road/roadsideProps";
import { currentZone, previousZone } from "../../rules/route";
import { screenRoadGeometry } from "../../runner/screenGeometry";
import type { Walk, WalkItem } from "../../runner/walk";
import { firstTag, playTag, showAtDepth, spriteMetrics } from "../sprites";
import {
  type Distraction,
  type DistractionDeps,
  newDistractionPlace,
  placeDistraction,
  startDistractions,
  stepDistractions,
} from "./distractions";
import { DEPTH, LANE_XS, LAYOUT, PROJECTION, ROW_DEPTH, showOnRoad } from "./stage";

// The tags a distraction moves in, the first its art has: it walks, or hops.
const MOVING_TAGS = ["walk", "hop", "run"] as const;

// The distraction movers' sprites, one per distraction shown, made as it first shows and
// destroyed once it is gone. With reduced motion none is shown. Each stands on the road through
// the projection like the road's sprites, cut off at the juncture, under every road sprite.
export class DistractionView {
  private readonly deps: DistractionDeps;
  private readonly place = newDistractionPlace();
  private readonly scene: Scene;
  private readonly sprites = new Map<Distraction, GameObjects.Sprite>();
  private readonly state = startDistractions();

  constructor(scene: Scene, random: Random) {
    this.scene = scene;
    this.deps = {
      data: gameData,
      drawable: (key) => this.movingTag(key) !== undefined,
      random,
      stage: {
        centreX: PROJECTION.centreX,
        firstLaneX: itemAt(LANE_XS, 0),
        roadside: ROADSIDE,
        width: (key) => spriteMetrics(key).opaqueWidth,
      },
    };
  }

  // kept is the verge scenery as it stands now, which a distraction keeps clear of too.
  draw(walk: Walk, kept: readonly WalkItem[], frame: { halted: boolean; still: boolean }): void {
    const { run } = walk;
    const geometry = screenRoadGeometry(run);
    stepDistractions(
      this.deps,
      {
        geometry,
        items: [...walk.road.items, ...kept],
        pending: walk.road.pending,
        previousArt: previousZone(gameData, run)?.art ?? null,
        zone: currentZone(gameData, run),
        zoneDistance: run.zoneDistance,
        zoneIndex: run.zoneIndex,
      },
      this.state,
    );
    const shown = new Set<Distraction>();
    if (!frame.still) {
      for (const distraction of this.state.distractions) {
        if (placeDistraction(gameData, geometry, run.zoneDistance, distraction, this.place)) {
          shown.add(distraction);
          this.show(distraction, frame.halted);
        }
      }
    }
    for (const [distraction, sprite] of this.sprites) {
      if (!shown.has(distraction)) {
        sprite.destroy();
        this.sprites.delete(distraction);
      }
    }
  }

  private show(distraction: Distraction, halted: boolean): void {
    const { scene } = this;
    const { key } = distraction;
    const sprite = getOrInsert(this.sprites, distraction, () => scene.add.sprite(0, 0, key));
    const { place } = this;
    const { road } = LAYOUT;
    const x = itemAt(LANE_XS, 0) + (place.lanePosition * road.width) / LANE_COUNT;
    const placed = project(PROJECTION, { distance: PROJECTION.footY - place.y, x });
    const drawn = showAtDepth(sprite, key, placed.scale);
    // Half a row's depth step more than a roadside prop stands it in front of a prop on its row.
    sprite
      .setPosition(Math.round(placed.x), Math.round(placed.y))
      .setFlipX(place.flip)
      .setDepth(DEPTH.roadside + (Math.round(placed.y) + 0.5) * ROW_DEPTH);
    showOnRoad(Math.round(placed.y), place.alpha, sprite);
    this.animate(sprite, drawn.key, place.moving, halted);
  }

  // Its moving tag while it moves; else its idle tag, or its moving tag held on its first frame.
  // A held walk holds it on its frame.
  private animate(sprite: GameObjects.Sprite, key: string, moving: boolean, halted: boolean): void {
    const moveTag = this.movingTag(key);
    const idle = firstTag(this.scene, key, [IDLE_TAG]);
    const tag = moving ? moveTag : (idle ?? moveTag);
    if (tag === undefined) {
      return;
    }
    if (!halted && (moving || idle !== undefined)) {
      playTag(sprite, key, tag);
      return;
    }
    if (sprite.anims.currentAnim?.key !== animationKey(key, tag)) {
      playTag(sprite, key, tag);
    }
    sprite.anims.pause();
  }

  private movingTag(key: string): string | undefined {
    return firstTag(this.scene, key, MOVING_TAGS);
  }
}
