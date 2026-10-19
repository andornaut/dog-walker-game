// The held touch identifiers missing from the touches now on the screen: their end was never
// delivered.
export function lostTouches(held: readonly number[], onScreen: readonly number[]): number[] {
  return held.filter((id) => !onScreen.includes(id));
}
