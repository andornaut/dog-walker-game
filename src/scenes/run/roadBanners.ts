import type { GameObjects, Scene } from "phaser";

import { gameData } from "../../data";
import type { EncounterId } from "../../data/types";
import { zoneBannerHeading } from "../../hud/zoneCelebration";
import { currentZone } from "../../rules/route";
import type { RunState } from "../../state/runState";
import { addDisplayText } from "../../ui/phaser/displayText";
import { fillRect } from "../../ui/phaser/draw";
import { PALETTE } from "../../ui/phaser/palette";
import { addPixelText } from "../../ui/phaser/pixelText";
import { fadeAway } from "../uiKit";
import { DEPTH, LAYOUT } from "./stage";

// An instant lucky find's art pops up over the road, then floats up and fades.
const POPUP = { artY: 120, fadeMs: 1800, rise: 16 };
const BANNER = { holdMs: 1800, key: "ui-zone-banner", slideMs: 300, width: 248, y: 70 };

// How long the zone banner shows, from sliding in to leaving.
export function zoneBannerMs(still: boolean): number {
  return (still ? 0 : BANNER.slideMs) + BANNER.holdMs + BANNER.slideMs;
}

// An instant lucky find opens no card: its art pops up over the road, then floats up and
// fades while the walk goes on. With reduced motion it fades in place.
export function showInstantPopup(scene: Scene, encounter: EncounterId, still: boolean): void {
  const { resolution } = gameData.encounters[encounter];
  if (resolution.kind !== "instant" || !scene.textures.exists(resolution.art)) {
    return;
  }
  const { road } = LAYOUT;
  const art = scene.add
    .image(road.x + road.width / 2, road.y + POPUP.artY, resolution.art)
    .setOrigin(0.5, 0)
    .setDepth(DEPTH.popup);
  fadeAway(scene, [art], { ms: POPUP.fadeMs, rise: still ? 0 : POPUP.rise });
}

// The zone banner's heading ("Toronto, neighborhood 2") and the zone's name, slid in over
// the road at each zone's start.
export class ZoneBanner {
  private banner: GameObjects.Container | undefined;
  private readonly scene: Scene;
  private shown = -1;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  show(run: RunState, still: boolean): void {
    if (run.zoneIndex === this.shown) {
      return;
    }
    const { scene } = this;
    this.shown = run.zoneIndex;
    this.banner?.destroy();
    const zone = currentZone(gameData, run);
    const { road } = LAYOUT;
    const x = road.x + Math.floor((road.width - BANNER.width) / 2);
    const banner = scene.add.container(x, road.y + BANNER.y).setDepth(DEPTH.banner);
    if (scene.textures.exists(BANNER.key)) {
      banner.add(scene.add.image(0, 0, BANNER.key).setOrigin(0));
    } else {
      const g = scene.add.graphics();
      fillRect(g, PALETTE.cream, { height: 48, width: BANNER.width, x: 0, y: 0 });
      banner.add(g);
    }
    const heading = zoneBannerHeading(gameData, run);
    banner.add(
      addPixelText(scene, BANNER.width / 2, 11, heading, {
        color: PALETTE.plum,
        font: "title",
        originX: 0.5,
      }),
    );
    banner.add(
      addDisplayText(scene, BANNER.width / 2, 27, zone.name, {
        color: PALETTE.plum,
        font: "title",
        originX: 0.5,
        scale: 2,
      }),
    );
    this.banner = banner;
    if (!still) {
      banner.x = x - road.width;
    }
    scene.tweens.chain({
      onComplete: () => banner.destroy(),
      targets: banner,
      tweens: [
        { duration: still ? 0 : BANNER.slideMs, ease: "Sine.easeOut", x },
        {
          delay: BANNER.holdMs,
          duration: BANNER.slideMs,
          ...(still ? { alpha: 0 } : { x: x + road.width }),
        },
      ],
    });
  }
}
