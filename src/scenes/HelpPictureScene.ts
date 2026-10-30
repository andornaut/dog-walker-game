import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { Rect } from "@andornaut/game-kit/rect";
import { Events, type GameObjects, Scene, Scenes } from "phaser";

import { gameData } from "../data";
import { SCREEN_LAYOUT } from "../data/screen";
import type { HelpPictureId } from "../data/types";
import {
  type DragLoop,
  type DragMoment,
  dragMomentAt,
  type HelpPicture,
  helpPicture,
  stillDragMoment,
  TOUCH_DRAG,
} from "../help/helpPictures";
import { changeLabels } from "../hud/hudView";
import { NOTHING_PAUSED } from "../hud/topBar";
import { DOG_REACTIONS } from "../layout/hitEffects";
import { currentZone } from "../rules/route";
import { read } from "../rules/units";
import { laneControlIn } from "../runner/laneControl";
import { laneMotionX } from "../runner/laneMotion";
import type { Walk } from "../runner/walk";
import { colourFromHex } from "../ui/palette";
import type { CardSceneData } from "./CardScene";
import type { HudSceneData } from "./HudScene";
import type { HudWalk } from "./hudWalk";
import { onceSceneEvent } from "./overlay";
import { currentSettings, walkerSpriteKey } from "./profileStore";
import { ensureRoadPlaceholders, ItemViews } from "./run/itemViews";
import { PackView } from "./run/packView";
import { RoadArt, RoadView } from "./run/roadView";
import { CHANGE_LABELS_EVENT } from "./run/runMoments";
import { ShadowPool } from "./run/shadowPool";
import { DEPTH, LANE_XS, overPack, packPoint } from "./run/stage";
import { SCENE_KEYS } from "./sceneKeys";
import { freezeScene, type ScenePicture, showAsPicture } from "./scenePicture";
import { tagFrame } from "./uiKit";

// The picture's pack, and a redraw of it for a walk with the pack elsewhere.
interface PackDraw {
  readonly draw: (walk: Walk) => void;
  readonly pack: PackView;
}

// A drag in motion: the loop, its swipe tags' frame times, the seconds played, and what draws
// it.
interface DragPlay {
  readonly frameMs: readonly number[];
  readonly loop: DragLoop;
  readonly pack: PackDraw;
  readonly picture: HelpPicture;
  seconds: number;
  readonly touch: GameObjects.Image | null;
}

const LAYOUT = SCREEN_LAYOUT;
const ROAD_TEXTURE = "help-road";
// The frame a still picture shows of an animation, where not its first: the heart a bump
// knocks off is at its fullest.
const STILL_FRAMES: Readonly<Record<string, number>> = {
  [animationKey("fx-heart-loss", "pop")]: 1,
};

export interface HelpPictureData {
  // Where the picture shows on the help screen.
  frame: Rect;
  page: HelpPictureId;
}

// A help page's picture: a moment of the walk screen, held still but for a drag that moves the
// pack, which plays in a loop unless motion is reduced. It is drawn by the walk's own road, item
// and pack views here, and the HUD and card scenes as pictures over it, each through cameras on
// the page's strips of the screen. Restarted for each page; stopping it stops the HUD and card
// pictures with it.
export class HelpPictureScene extends Scene {
  // The road art's pixels, read once and kept across pages, as the walk keeps its own.
  private readonly roadArt = new RoadArt(this);
  // The drag playing, unless the picture is still.
  private drag: DragPlay | undefined;

  constructor() {
    super(SCENE_KEYS.helpPicture);
  }

  create({ frame, page }: HelpPictureData): void {
    const picture = helpPicture(gameData, page);
    const view: ScenePicture = { frame, strips: picture.strips };
    showAsPicture(this, view);
    this.drag = undefined;
    this.events.once(Scenes.Events.SHUTDOWN, () => {
      this.scene.stop(SCENE_KEYS.helpHud);
      this.scene.stop(SCENE_KEYS.helpCard);
    });
    const packDraw = this.drawWalk(picture);
    const { pack } = packDraw;
    const { drag } = picture;
    if (drag !== null) {
      const touch = this.textures.exists(TOUCH_DRAG.key)
        ? this.add.image(0, 0, TOUCH_DRAG.key).setOrigin(0).setDepth(DEPTH.fx)
        : null;
      const swipe = this.anims.get(animationKey(TOUCH_DRAG.key, TOUCH_DRAG.tags.right));
      const frameMs = swipe?.frames.map((shown) => shown.duration) ?? [];
      const play: DragPlay = {
        frameMs,
        loop: drag,
        pack: packDraw,
        picture,
        seconds: 0,
        touch,
      };
      // Played in motion, the road and its items standing as they are while the pack walks;
      // held on its still frame with reduced motion or without the swipe's frames.
      const still = currentSettings(this).reducedMotion || frameMs.length === 0;
      this.drag = still ? undefined : play;
      this.drawDrag(play, still ? stillDragMoment(drag) : this.dragMoment(play));
    }
    if (this.drag === undefined) {
      this.events.once(Scenes.Events.POST_UPDATE, () => freezeScene(this));
    }
    if (picture.hud) {
      this.showHud(picture, view, pack);
    }
    if (picture.card !== null) {
      const data: CardSceneData = {
        onChoose: () => undefined,
        // Left out: the fork picture's frame ends partway down the End walk button.
        onHeadHome: null,
        picture: view,
        view: picture.card,
      };
      this.scene.launch(SCENE_KEYS.helpCard, data);
      this.whenCreated(SCENE_KEYS.helpCard, (card) =>
        card.events.once(Scenes.Events.POST_UPDATE, () => freezeScene(card, STILL_FRAMES)),
      );
    }
  }

  // The road, its items and the pack, as the run draws them for this walk, held still. The
  // pack can be drawn again, as in another lane, through the returned PackDraw.
  private drawWalk(picture: HelpPicture): PackDraw {
    const { walk } = picture;
    const zone = currentZone(gameData, walk.run);
    const colour = colourFromHex(zone.roadShadowColour);
    ensureRoadPlaceholders(this);
    new RoadView(this, this.roadArt, LAYOUT.rasterView, ROAD_TEXTURE).draw(walk, zone, 0);
    const itemShadows = new ShadowPool(this);
    const items = new ItemViews(this, () => undefined);
    items.draw(walk, picture.halted, true, itemShadows.frame(colour));
    itemShadows.hideUnused();
    const dogs = walk.run.pack.map(({ dog }) => dog);
    const pack = new PackView(this, dogs, walkerSpriteKey(this, walk.run.walker));
    const packShadows = new ShadowPool(this);
    const draw = (shown: Walk) => {
      pack.draw(shown, {
        halted: picture.halted,
        itemPoint: (id) => items.point(id),
        pulls: picture.pulls,
        shadow: packShadows.frame(colour),
        still: true,
      });
      packShadows.hideUnused();
    };
    draw(walk);
    if (picture.stumble) {
      pack.stumble(false, DOG_REACTIONS.hit);
    }
    return { draw, pack };
  }

  override update(_time: number, delta: number): void {
    const play = this.drag;
    if (play !== undefined) {
      play.seconds += delta / 1000;
      this.drawDrag(play, this.dragMoment(play));
    }
  }

  private dragMoment(play: DragPlay): DragMoment {
    const swipeStart = read(gameData.tuning, "pixels", "swipeStartDistance");
    return dragMomentAt(play.frameMs, swipeStart, play.loop, play.seconds);
  }

  // The drag at its moment: the pack in its lane or gliding, and the touch hint.
  private drawDrag(play: DragPlay, moment: DragMoment): void {
    const { walk } = play.picture;
    play.pack.draw({ ...walk, road: { ...walk.road, control: laneControlIn(moment.motion) } });
    const touch = play.touch;
    const frame = tagFrame(
      this,
      TOUCH_DRAG.key,
      TOUCH_DRAG.tags[moment.touch.tag],
      moment.touch.index,
    );
    if (touch !== null && frame !== undefined) {
      const { anchor } = TOUCH_DRAG;
      const start = play.loop.touchStart;
      touch.setFrame(frame).setPosition(start.x - anchor.x, start.y - anchor.y);
    }
  }

  // The HUD as a picture of this walk: once it is up, the walk raises the picture's changes,
  // and after its first update it is held still.
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
      }),
      reducedMotion: () => true,
      runPause: () => NOTHING_PAUSED,
    };
    const data: HudSceneData = { picture: { source, view } };
    this.scene.launch(SCENE_KEYS.helpHud, data);
    this.whenCreated(SCENE_KEYS.helpHud, (hud) => {
      if (picture.changes.length > 0) {
        const labels = changeLabels(overPack(packPoint(walk)), picture.changes);
        events.emit(CHANGE_LABELS_EVENT, labels);
      }
      hud.events.once(Scenes.Events.POST_UPDATE, () => freezeScene(hud, STILL_FRAMES));
    });
  }

  // Runs then once the scene of key is created, unless this picture has gone first.
  private whenCreated(key: string, then: (scene: Scene) => void): void {
    const scene = this.scene.get(key);
    onceSceneEvent(this, scene.events, Scenes.Events.CREATE, () => then(scene));
  }
}
