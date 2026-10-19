// The number keys pick cards and menu items, but their numbers show only once the player has
// pressed a key this session: a touch player never needs them.
let keyPressed = false;

export function noteKeyPress(): void {
  keyPressed = true;
}

export function keyNumbersShown(): boolean {
  return keyPressed;
}

// "1 Resume": a menu item's label with the number key that picks it, once numbers show.
export function withKeyNumber(number: number, label: string): string {
  return keyPressed ? `${number} ${label}` : label;
}
