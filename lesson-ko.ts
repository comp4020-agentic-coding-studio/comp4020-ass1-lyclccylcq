// The predefined position for Lesson 5. It's the smallest shape that
// demonstrates ko: a lone White stone (KO_POINT) with one liberty
// (CAPTURE_POINT), backed up by three more White stones so that once Black
// captures it, White retaking KO_POINT would legally capture that same
// Black stone right back — except doing so recreates the exact position
// from before Black's capture, which go-rules.ts's ko check forbids.

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

export function createKoBoard(): Board {
  const board = createBoard(9);
  for (const point of KO_WHITE) board.cells[point.row][point.col] = "white";
  for (const point of KO_BLACK) board.cells[point.row][point.col] = "black";
  return board;
}

export const koLesson: LessonDefinition = {
  id: "ko",
  title: "Ko",
  createInitialBoard: createKoBoard,
};
