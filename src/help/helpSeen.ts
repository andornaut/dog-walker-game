// Help counts as read once it closes, whatever opened it: the ? button, the pause menu or the
// first Start walk. Start walk opens it first only while it is unread, so a player who read it
// from ? is not shown it again.
export interface HelpSeenSave {
  readonly helpSeen: boolean;
}

export function closeHelp<S extends HelpSeenSave>(save: S): S {
  return save.helpSeen ? save : { ...save, helpSeen: true };
}

export function startWalkOpensHelp(save: HelpSeenSave): boolean {
  return !save.helpSeen;
}
