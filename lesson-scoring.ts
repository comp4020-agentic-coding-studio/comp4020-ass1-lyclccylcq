// The predefined position for Lesson 6: one complete, already-finished 9x9
// game, not something the learner plays into. Black's wall steps one column
// right every three rows, giving Black the larger upper-left area and White
// the smaller lower-right one; every empty point on the board borders
// exactly one colour, so there are no neutral points to explain away. Hand
// verified (see go-scoring.test.ts's exact-value regression test):
//   Black: 9 stones + 36 territory = 45
//   White: 9 stones + 27 territory + 7.5 komi = 43.5
//   Black wins by 1.5.
// Dead stones are assumed already removed before this position starts —
// nothing here is in atari or needs a life/death judgement.

import { createBoard, type Board } from "./go-rules";
import type { LessonDefinition } from "./lesson";

export const KOMI = 7.5;

/** The column of the Black wall stone on `row` — steps right every 3 rows. */
function blackWallColumn(row: number): number {
  if (row <= 2) return 3;
  if (row <= 5) return 4;
  return 5;
}

export function createScoringBoard(): Board {
  const board = createBoard(9);
  for (let row = 0; row < board.size; row++) {
    const blackCol = blackWallColumn(row);
    board.cells[row][blackCol] = "black";
    board.cells[row][blackCol + 1] = "white";
  }
  return board;
}

export const scoringLesson: LessonDefinition = {
  id: "scoring",
  title: "Winning the Game",
  createInitialBoard: createScoringBoard,
};
