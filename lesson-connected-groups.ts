// Three predefined black groups, each progressively less obvious, for Lesson
// 3's capture examples. Every example runs the same sequence: the learner
// selects the group (any stone in it), watches its shared liberties, then
// plays white stones — checked by the shared rules engine — until the whole
// group is captured together.

import { createBoard, type Board, type Point } from "./go-rules";
import type { LessonDefinition } from "./lesson";

// Example 1: two connected stones. A minimal group, so surrounding it takes
// only a handful of white moves — enough to show that connected stones share
// liberties and fall together.
export const EXAMPLE_1_GROUP: Point[] = [
  { row: 4, col: 4 },
  { row: 4, col: 5 },
];

export function createExample1Board(): Board {
  const board = createBoard(9);
  for (const point of EXAMPLE_1_GROUP) board.cells[point.row][point.col] = "black";
  return board;
}

// Example 2: a four-stone block. A different shape changes the liberty count
// (eight, not six), reinforcing that shape — not just stone count — matters.
export const EXAMPLE_2_GROUP: Point[] = [
  { row: 1, col: 1 },
  { row: 1, col: 2 },
  { row: 2, col: 1 },
  { row: 2, col: 2 },
];

export function createExample2Board(): Board {
  const board = createBoard(9);
  for (const point of EXAMPLE_2_GROUP) board.cells[point.row][point.col] = "black";
  return board;
}

// Example 3: an L-shape against the board's edge. Being on the edge already
// cuts its liberties down (five, for three stones), so the learner has to
// actually look rather than assume every stone offers four escape routes.
export const EXAMPLE_3_GROUP: Point[] = [
  { row: 2, col: 8 },
  { row: 3, col: 8 },
  { row: 3, col: 7 },
];

export function createExample3Board(): Board {
  const board = createBoard(9);
  for (const point of EXAMPLE_3_GROUP) board.cells[point.row][point.col] = "black";
  return board;
}

/** True once every point that used to hold `group` is empty again. */
export function isGroupCaptured(board: Board, group: Point[]): boolean {
  return group.every((point) => board.cells[point.row][point.col] === null);
}

export const connectedGroupsLesson: LessonDefinition = {
  id: "connected-groups",
  title: "Connected Groups",
  createInitialBoard: createExample1Board,
  isComplete: (board) => isGroupCaptured(board, EXAMPLE_1_GROUP),
};
