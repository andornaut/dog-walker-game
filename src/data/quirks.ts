import type { Quirk, QuirkId } from "./types";

// What each quirk is called, and what it does in words, on a dog's detail card and in card
// text. The rules are in the rulebook's Quirks table; the numbers are tuning.ts's quirk hooks.
export const QUIRKS = {
  acrobatic: {
    description: "No lane lock after a pull.",
    name: "Acrobatic",
  },
  cameraReady: {
    description: "Photo ops pay a double tip.",
    name: "Camera ready",
  },
  crowdPleaser: {
    description: "Strangers wave more often, and a met need adds a tip.",
    name: "Crowd pleaser",
  },
  nervous: {
    description: "Lunges at other dogs. Clingy when walked alone.",
    name: "Nervous",
  },
  pampered: {
    description: "A treat gives her owner two hearts.",
    name: "Pampered",
  },
  ratter: {
    description: "A squirrel chase he joins drops no tips.",
    name: "Ratter",
  },
  scentHound: {
    description: "Picks up tips from one lane away.",
    name: "Scent hound",
  },
  showDog: {
    description: "A higher fee, but messy cards cost his owner a heart more.",
    name: "Show dog",
  },
  sledDog: {
    description: "The pack changes lanes faster.",
    name: "Sled dog",
  },
} as const satisfies Record<QuirkId, Quirk>;
