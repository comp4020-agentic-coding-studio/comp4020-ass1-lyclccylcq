// Shared shape for a lesson's configuration, kept separate from any single
// lesson's DOM wiring so it can be unit-tested without a browser, and so a
// new lesson only needs to add one of these plus a bootstrap script — never
// touch an existing lesson's files.

import type { Board } from "./go-rules";

export interface LessonDefinition {
  id: string;
  title: string;
  createInitialBoard: () => Board;
  /** Whether the board is in the lesson's "done" state, if it has one. */
  isComplete?: (board: Board) => boolean;
}
