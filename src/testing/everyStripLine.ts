import { gameData } from "../data";
import { effectLine } from "../hud/effectIcons";
import { type FaceText, fillFaceText, ownerFaceText } from "../hud/faceText";
import type { MessageLine } from "../hud/messageStrip";
import { STRIP_LINE_FIELDS } from "../hud/runText";
import { debuffLines } from "../hud/stripLines";
import { fillNames } from "../lib/lines";
import { keysOf } from "../lib/records";

// Every line the strip can say: each hint and badge, and each of the walk's lines for every dog,
// owner and obstacle as each neighbourhood names it, with two-digit counts and the largest
// amounts.
export function everyStripLine(): (FaceText & Pick<MessageLine, "names">)[] {
  const { strip } = gameData.runText;
  const line = (key: keyof typeof STRIP_LINE_FIELDS, fields: Record<string, FaceText | string>) =>
    fillFaceText(strip[key], fields);
  const dogs = keysOf(gameData.dogs).map((id) => ({
    dog: gameData.dogs[id].name,
    owner: ownerFaceText(gameData, "neutral", id),
  }));
  const obstacles = [
    ...new Set(Object.values(gameData.minorObstacles).map(({ name }) => name.toLowerCase())),
  ];
  const amount = "$9,999";
  return [
    ...Object.values(gameData.hints).map(({ text }) => ({ text })),
    ...gameData.achievements.map(({ name }) => line("achievement", { name })),
    // Each debuff's start line at the largest amounts, its lead in its pill as debuffLines marks it.
    ...keysOf(gameData.debuffs).map((debuff) => {
      const started = [{ debuff, secondsLeft: 99, untilZone: 0 }];
      const [said] = debuffLines(gameData, { ended: [], started });
      const fields = { cash: amount, seconds: "99" };
      return { names: said?.names ?? [], text: fillNames(strip.debuffStart[debuff], fields) };
    }),
    ...keysOf(gameData.shopGear).map((gear) =>
      line("effectStart", {
        effect: effectLine(gameData, { gear, kind: "gear" }),
        name: gameData.shopGear[gear].name,
      }),
    ),
    ...Object.values(strip.debuffEnd).map((text) => ({ text })),
    line("luckyNeighbour", { hearts: "10" }),
    line("fullPackHome", { amount }),
    line("luckyWallet", {}),
    line("spareTreatSaved", {}),
    ...dogs.flatMap(({ dog, owner }) => [
      line("fired", { dog, owner }),
      line("secondChance", { owner }),
      line("spareTreatUsed", { owner }),
      line("pull", { dog }),
      line("treat", { dog, hearts: "10", owner }),
      ...obstacles.flatMap((obstacle) => [
        line("dodge", { dog, obstacle }),
        line("plainHit", { dog, hearts: "10", obstacle, owner }),
      ]),
    ]),
  ];
}
