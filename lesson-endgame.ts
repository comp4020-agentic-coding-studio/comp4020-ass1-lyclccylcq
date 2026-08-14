// The predefined position for Lesson 6: a 9x9 game that is nearly, but not
// quite, over. Both players' groups are settled — nothing is in atari, no ko
// is running, and no stone on the board needs a life-or-death judgement — so
// the only moves left are the small boundary moves that decide the last few
// points.
//
// Three of those moves matter, in this order:
//   SEAL_POINT    Black's wall has one gap at the top edge. Until it closes,
//                 Black's whole left side borders White too, so by the area
//                 rules it is nobody's territory at all.
//   REDUCE_POINT  A single point bitten out of White's wall. It touches both
//                 colours, so it belongs to neither — and every such point
//                 Black takes is one White does not get.
//   FINAL_POINT   The last point of that kind. After it, every empty point
//                 on the board belongs to somebody, which is exactly when
//                 there is nothing left to play.
//
// Scores along the way are computed by go-scoring.ts, never hard-coded here;
// lesson-endgame.test.ts pins them.

import { createBoard, type Board, type Point } from "./go-rules";
import type { LessonDefinition } from "./lesson";

/** Black's wall, one stone short of reaching the top edge. */
const BLACK_WALL: Point[] = [1, 2, 3, 4, 5, 6, 7, 8].map((row) => ({ row, col: 4 }));

/** White's wall, bitten into at rows 3 and 6 and detouring a column right. */
const WHITE_WALL: Point[] = [
  ...[0, 1, 2, 4, 5, 7, 8].map((row) => ({ row, col: 5 })),
  { row: 3, col: 6 },
  { row: 6, col: 6 },
];

/** Two White stones enclosing the top-right corner as a one-point eye. */
const WHITE_EYE_WALL: Point[] = [
  { row: 0, col: 7 },
  { row: 1, col: 8 },
];

/** Closes the gap in Black's own wall, turning the left side into territory. */
export const SEAL_POINT: Point = { row: 0, col: 4 };
/** Claims the first point cut out of White's wall. */
export const REDUCE_POINT: Point = { row: 3, col: 5 };
/** Claims the last point that belongs to neither player. */
export const FINAL_POINT: Point = { row: 6, col: 5 };

/** Legal, safe, and worth nothing: points well inside Black's own side. */
export const IDLE_POINTS: Point[] = [
  { row: 4, col: 1 },
  { row: 7, col: 2 },
];

/** White's one-point eye in the corner. Black playing here is plain suicide,
 * and the rules engine rejects it without any help from the lesson. */
export const SUICIDE_POINT: Point = { row: 0, col: 8 };

export function createEndgameBoard(): Board {
  const board = createBoard(9);
  for (const point of BLACK_WALL) board.cells[point.row][point.col] = "black";
  for (const point of [...WHITE_WALL, ...WHITE_EYE_WALL]) board.cells[point.row][point.col] = "white";
  return board;
}

export const endgameLesson: LessonDefinition = {
  id: "endgame",
  title: "Endgame",
  createInitialBoard: createEndgameBoard,
};
