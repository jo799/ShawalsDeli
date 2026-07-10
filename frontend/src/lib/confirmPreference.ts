// The "Confirm Before Delete" setting was saved from the Settings page but
// nothing anywhere actually read it — every delete action across the app
// called the browser's confirm() unconditionally, regardless of what this
// setting said. This is the missing wiring: a single shared helper every
// delete action can call instead of confirm() directly, so turning the
// setting off actually skips the prompt everywhere at once, and turning it
// on restores it everywhere at once.
//
// A plain module-level variable (not a store) is enough here — confirm()
// must run synchronously at the moment of the click, so the value just
// needs to be readable synchronously; it's set once after the setting
// loads (see AppLayout) and again immediately whenever it's changed and
// saved from the Settings page.
let confirmBeforeDelete = true;

export function setConfirmBeforeDelete(value: boolean): void {
  confirmBeforeDelete = value;
}

export function getConfirmBeforeDelete(): boolean {
  return confirmBeforeDelete;
}

// Drop-in replacement for `if (!confirm(message)) return;` — respects the
// setting instead of always prompting.
export function confirmDelete(message: string): boolean {
  if (!confirmBeforeDelete) return true;
  return confirm(message);
}