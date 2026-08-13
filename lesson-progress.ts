// Tiny localStorage wrapper so a chapter can mark itself done without any
// new completion logic: each lesson already knows the moment it's solved,
// this just persists that fact across page turns. Guarded so it's a safe
// no-op wherever `window` isn't the real browser global — in particular the
// existing Node-environment tests for Lessons 1-4, which don't stub `window`.

const STORAGE_KEY = "learn-go:completed-chapters";

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    // Accessing localStorage throws SecurityError under an opaque origin
    // (e.g. jsdom's default about:blank) even though `window` exists.
    return false;
  }
}

function readCompleted(): Set<string> {
  if (!hasStorage()) return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function markComplete(id: string): void {
  if (!hasStorage()) return;
  const completed = readCompleted();
  completed.add(id);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
  } catch {
    // Storage full or disabled (private browsing): completion state is a
    // nice-to-have checkmark, not worth surfacing an error for.
  }
}

export function isChapterComplete(id: string): boolean {
  return readCompleted().has(id);
}
