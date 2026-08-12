import { createBoard, getGroup, type Board, type Point } from "./go-rules";
import type { LessonDefinition } from "./lesson";

// Stage 1: a small connected black group, for the learner to select and see
// light up as a whole.
export const DISCOVER_GROUP: Point[] = [
  { row: 3, col: 3 },
  { row: 3, col: 4 },
  { row: 4, col: 4 },
];

export function createDiscoverBoard(): Board {
  const board = createBoard(9);
  for (const point of DISCOVER_GROUP) board.cells[point.row][point.col] = "black";
  return board;
}

// Stage 2: two black stones that touch only at a corner, to contrast with
// stage 1 — selecting one must never select the other.
export const DIAGONAL_A: Point = { row: 3, col: 3 };
export const DIAGONAL_B: Point = { row: 4, col: 4 };

export function createDiagonalBoard(): Board {
  const board = createBoard(9);
  board.cells[DIAGONAL_A.row][DIAGONAL_A.col] = "black";
  board.cells[DIAGONAL_B.row][DIAGONAL_B.col] = "black";
  return board;
}

// Stage 3: a small connected black group the learner surrounds with white,
// to see the whole group captured together once its shared liberties run out.
export const CAPTURE_GROUP: Point[] = [
  { row: 4, col: 4 },
  { row: 4, col: 5 },
];

export function createCaptureBoard(): Board {
  const board = createBoard(9);
  for (const point of CAPTURE_GROUP) board.cells[point.row][point.col] = "black";
  return board;
}

export const connectedGroupsLesson: LessonDefinition = {
  id: "connected-groups",
  title: "Connected Groups",
  createInitialBoard: createDiscoverBoard,
  isComplete: (board) => getGroup(board, CAPTURE_GROUP[0]).length === 0,
};
