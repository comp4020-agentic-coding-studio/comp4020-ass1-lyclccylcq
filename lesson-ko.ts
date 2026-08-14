// The predefined position for Lesson 5. It's the smallest shape that
// demonstrates ko: a lone White stone (KO_POINT) with one liberty
// (CAPTURE_POINT), backed up by three more White stones so that once Black
// captures it, White retaking KO_POINT would legally capture that same
// Black stone right back — except doing so recreates the exact position
// from before Black's capture, which go-rules.ts's ko check forbids.
//
// The bottom-left corner carries a second, unrelated shape used only by the
// ko-threat half of the lesson: a two-stone White group down to two
// liberties. It sits far enough from the ko that neither shape's liberties
// touch the other, so stages 1-3 play out exactly as they always did.

import { createBoard, type Board, type Point } from "./go-rules";
import type { LessonDefinition } from "./lesson";

export const KO_POINT: Point = { row: 4, col: 4 };
export const CAPTURE_POINT: Point = { row: 5, col: 4 };
export const ELSEWHERE_POINT: Point = { row: 0, col: 8 };

const KO_WHITE: Point[] = [KO_POINT, { row: 6, col: 4 }, { row: 5, col: 3 }, { row: 5, col: 5 }];
const KO_BLACK: Point[] = [
  { row: 3, col: 4 },
  { row: 4, col: 3 },
  { row: 4, col: 5 },
];

/** The weak White group the ko threat attacks: two stones on the left edge,
 * already pressed down to two liberties, (6,0) and (7,1), by BLOCKING_BLACK. */
export const WEAK_WHITE_GROUP: Point[] = [
  { row: 7, col: 0 },
  { row: 8, col: 0 },
];
const BLOCKING_BLACK: Point = { row: 8, col: 1 };

/** Black's ko threat: takes WEAK_WHITE_GROUP from two liberties to one. */
export const THREAT_POINT: Point = { row: 7, col: 1 };
/** White's scripted answer: extends the group back out to two liberties. */
export const DEFENSE_POINT: Point = { row: 6, col: 0 };
/** Legal Black moves that threaten nothing, so White would never answer them. */
export const THREAT_DECOYS: Point[] = [
  { row: 0, col: 0 },
  { row: 8, col: 8 },
];

export function createKoBoard(): Board {
  const board = createBoard(9);
  for (const point of KO_WHITE) board.cells[point.row][point.col] = "white";
  for (const point of WEAK_WHITE_GROUP) board.cells[point.row][point.col] = "white";
  for (const point of KO_BLACK) board.cells[point.row][point.col] = "black";
  board.cells[BLOCKING_BLACK.row][BLOCKING_BLACK.col] = "black";
  return board;
}

export const koLesson: LessonDefinition = {
  id: "ko",
  title: "Ko",
  createInitialBoard: createKoBoard,
};
