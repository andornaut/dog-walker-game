import { Events, Scene, Scenes } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { HelpPictureId } from "../data/types";
import { type HelpPicture, helpPicture, TOUCH_DRAG } from "../help/helpPictures";
import { changeLabels } from "../hud/hudView";
import type { RunPause } from "../hud/topBar";
import { DOG_REACTIONS } from "../layout/hitEffects";
import { screenLayout } from "../layout/screenLayout";
import type { Rect } from "../lib/rect";
import { currentZone } from "../rules/route";
import { laneMotionX } from "../runner/laneMotion";
import { colorFromHex, PALETTE } from "../ui/phaser/palette";
import type { CardSceneData } from "./CardScene";
import type { HudSceneData } from "./HudScene";
import type { HudWalk } from "./hudWalk";
import { walkerSpriteKey } from "./profileStore";
import { ensureRoadPlaceholders, ItemViews } from "./run/itemViews";
import { PackView } from "./run/packView";
import { RoadArt, RoadView } from "./run/roadView";
import { CHANGE_LABELS_EVENT, QUIPS_EVENT } from "./run/runMoments";
import { ShadowPool } from "./run/shadowPool";
import { DEPTH, LANE_XS } from "./run/stage";
import { SCENE_KEYS } from "./sceneKeys";
import { freezeScene, type ScenePicture, showAsPicture } from "./scenePicture";
import { tagFrame } from "./uiKit";

const LAYOUT = screenLayout(SCREEN_CONFIG);
const ROAD_TEXTURE = "help-road";
// The help's pictures show the walk going on, none of it paused.
const WALKING: RunPause = {
  card: false,
  hitStop: false,
  hold: false,
  menu: "closed",
  page: "shown",
};
// The frame a still picture shows of an animation, where not its first: the heart a bump
// knocks off is at its fullest.
const STILL_FRAMES: Readonly<Record<string, number>> = {
  [animationKey("fx-heart-loss", "pop")]: 1,
};
// The pack's move after a drag: 2x2 dots every 4px, then a chevron of two 8-row strokes 3px
// thick meeting at its tip.
const MOVE = { chevron: 8, dot: 2, pitch: 4, stroke: 3 };

export interface HelpPictureData {
  // Where the picture shows on the help screen.
  frame: Rect;
  page: HelpPictureId;
}

// A help page's picture: a still moment of the walk screen, drawn by the walk's own road, item
// and pack views here, and the HUD and card scenes as pictures over it, each through cameras on
// the page's strips of the screen. Restarted for each page; stopping it stops the HUD and card
// pictures with it.
export class HelpPictureScene extends Scene {
  constructor() {
    super(SCENE_KEYS.helpPicture);
  }

  create({ frame, page }: HelpPictureData): void {
    const picture = helpPicture(gameData, page);
    const view: ScenePicture = { frame, strips: picture.strips };
    showAsPicture(this, view);
    this.events.once(Scenes.Events.SHUTDOWN, () => {
      this.scene.stop(SCENE_KEYS.helpHud);
      this.scene.stop(SCENE_KEYS.helpCard);
    });
    const pack = this.drawWalk(picture);
    this.drawTouch(picture);
    this.drawPackMove(picture);
    this.events.once(Scenes.Events.POST_UPDATE, () => freezeScene(this));
    if (picture.hud) {
      this.showHud(picture, view, pack);
    }
    if (picture.card !== null) {
      const data: CardSceneData = {
        onChoose: () => undefined,
        onHeadHome: () => undefined,
        picture: view,
        view: picture.card,
      };
      this.scene.launch(SCENE_KEYS.helpCard, data);
      this.whenCreated(SCENE_KEYS.helpCard, (card) =>
        card.events.once(Scenes.Events.POST_UPDATE, () => freezeScene(card, STILL_FRAMES)),
      );
    }
  }

  // The road, its items and the pack, as the run draws them for this walk, held still.
  private drawWalk(picture: HelpPicture): PackView {
    const { walk } = picture;
    const zone = currentZone(gameData, walk.run);
    ensureRoadPlaceholders(this);
    new RoadView(this, new RoadArt(this), LAYOUT.rasterView, ROAD_TEXTURE).draw(walk, zone, 0);
    const shadows = new ShadowPool(this);
    const shadow = shadows.frame(colorFromHex(zone.roadShadowColor));
    const items = new ItemViews(this, () => undefined);
    items.draw(walk, picture.halted, true, shadow);
    const dogs = walk.run.pack.map(({ dog }) => dog);
    const pack = new PackView(this, dogs, walkerSpriteKey(this, walk.run.walker));
    pack.draw(walk, {
      halted: picture.halted,
      itemPoint: (id) => items.point(id),
      pulls: picture.pulls,
      shadow,
      still: true,
    });
    if (picture.stumble) {
      pack.stumble(false, DOG_REACTIONS.hit);
    }
    shadows.hideUnused();
    return pack;
  }

  // The touch hint's drag, its anchor on the drag's start.
  private drawTouch(picture: HelpPicture): void {
    const { touch } = picture;
    if (touch === null || !this.textures.exists(TOUCH_DRAG.key)) {
      return;
    }
    const frame = tagFrame(this, TOUCH_DRAG.key, TOUCH_DRAG.tag, touch.frame);
    const { anchor } = TOUCH_DRAG;
    this.add
      .image(touch.start.x - anchor.x, touch.start.y - anchor.y, TOUCH_DRAG.key, frame)
      .setOrigin(0)
      .setDepth(DEPTH.fx);
  }

  // Amber dots from the lane the pack left toward the one it moved to, and a chevron.
  private drawPackMove(picture: HelpPicture): void {
    const move = picture.packMove;
    if (move === null) {
      return;
    }
    const g = this.add.graphics().setDepth(DEPTH.fx).fillStyle(PALETTE.amber);
    for (let x = move.fromX; x < move.toX; x += MOVE.pitch) {
      g.fillRect(x, move.y, MOVE.dot, MOVE.dot);
    }
    for (let i = 0; i < MOVE.chevron; i++) {
      const x = move.chevronX + i - MOVE.chevron / 2;
      g.fillRect(x, move.y + 1 - MOVE.chevron + i, MOVE.stroke, 1);
      g.fillRect(x, move.y + 1 + MOVE.chevron - i, MOVE.stroke, 1);
    }
  }

  // The HUD as a picture of this walk: once it is up, the walk raises the picture's changes and
  // quips, and after its first update it is held still.
  private showHud(picture: HelpPicture, view: ScenePicture, pack: PackView): void {
    const events = new Events.EventEmitter();
    const { walk } = picture;
    const source: HudWalk = {
      dogPoint: (dog) => pack.dogPoint(dog),
      events,
      hudView: () => ({
        affected: [],
        explaining: undefined,
        packX: laneMotionX(LANE_XS, walk.road.control.motion),
        run: walk.run,
        zoneFraction: picture.zoneFraction,
      }),
      reducedMotion: () => true,
      runPause: () => WALKING,
    };
    const data: HudSceneData = { picture: { source, view } };
    this.scene.launch(SCENE_KEYS.helpHud, data);
    this.whenCreated(SCENE_KEYS.helpHud, (hud) => {
      if (picture.changes.length > 0) {
        events.emit(CHANGE_LABELS_EVENT, changeLabels(gameData, picture.changes));
      }
      if (picture.quips.length > 0) {
        events.emit(QUIPS_EVENT, picture.quips);
      }
      hud.events.once(Scenes.Events.POST_UPDATE, () => freezeScene(hud, STILL_FRAMES));
    });
  }

  // Runs then once the scene of key is created, unless this picture has gone first.
  private whenCreated(key: string, then: (scene: Scene) => void): void {
    const scene = this.scene.get(key);
    const created = () => then(scene);
    scene.events.once(Scenes.Events.CREATE, created);
    this.events.once(Scenes.Events.SHUTDOWN, () => scene.events.off(Scenes.Events.CREATE, created));
  }
}
