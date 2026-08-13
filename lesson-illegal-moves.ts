// Two predefined positions for Lesson 4, both built around one empty point
// that *looks* fully surrounded. go-rules.ts alone decides what actually
// happens when Black plays there — this file only sets the stones up.

import { createBoard, type Board, type Point } from "./go-rules";
import type { LessonDefinition } from "./lesson";

// Example 1 (pure suicide): four White stones already occupy every liberty
// around the centre point, and each White stone keeps a liberty of its own
// elsewhere, so playing Black there captures nothing and leaves Black with
// zero liberties of its own.
export const SUICIDE_TARGET: Point = { row: 4, col: 4 };
export const SUICIDE_WHITE: Point[] = [
  { row: 3, col: 4 },
  { row: 5, col: 4 },
  { row: 4, col: 3 },
  { row: 4, col: 5 },
];

export function createSuicideExampleBoard(): Board {
  const board = createBoard(9);
  for (const point of SUICIDE_WHITE) board.cells[point.row][point.col] = "white";
  return board;
}

// Example 2 (the capture exception): the corner point (0,0) looks just as
// surrounded, but its two White neighbours are each down to (0,0) as their
// *only* liberty, so Black playing there removes them first and ends up
// with liberties of its own.
export const CAPTURE_TARGET: Point = { row: 0, col: 0 };
export const CAPTURE_WHITE: Point[] = [
  { row: 1, col: 0 },
  { row: 0, col: 1 },
];
export const CAPTURE_BLACK: Point[] = [
  { row: 2, col: 0 },
  { row: 1, col: 1 },
  { row: 0, col: 2 },
];

export function createCaptureExampleBoard(): Board {
  const board = createBoard(9);
  for (const point of CAPTURE_WHITE) board.cells[point.row][point.col] = "white";
  for (const point of CAPTURE_BLACK) board.cells[point.row][point.col] = "black";
  return board;
}

export const illegalMovesLesson: LessonDefinition = {
  id: "illegal-moves",
  title: "Illegal Moves",
  createInitialBoard: createSuicideExampleBoard,
  isComplete: (board) => board.cells[CAPTURE_TARGET.row][CAPTURE_TARGET.col] === "black",
};
