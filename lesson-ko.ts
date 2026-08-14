// The predefined position for Lesson 5. At its centre is the smallest shape
// that demonstrates ko: a lone White stone (KO_POINT) with one liberty
// (CAPTURE_POINT), backed up by three more White stones so that once Black
// captures it, White retaking KO_POINT would legally capture that same Black
// stone right back — except doing so recreates the exact position from
// before Black's capture, which go-rules.ts's ko check forbids.
//
// A ko fight is both players finding threats, so the board carries two more
// tactical corners, one for each side to use. Both are far enough from the
// ko, and from each other, that no group's liberties overlap:
//
//   top-left      Black's group, two liberties. The learner (playing White
//                 from the recapture onwards) ataris it with PLAYER_THREAT;
//                 the scripted Black answer BOT_ANSWER extends it to safety.
//   bottom-left   White's group — the learner's own, two liberties. The
//                 computer ataris it with BOT_THREAT. DEFEND_POINT is its
//                 last liberty, which is why it settles the corner for
//                 whoever takes it: the learner saves the group by playing
//                 there, and Black captures the group by playing there.
//
// Every liberty count above is asserted in lesson-ko.test.ts rather than
// trusted from this comment.

import { createBoard, type Board, type Point } from "./go-rules";
import type { LessonDefinition } from "./lesson";

export const KO_POINT: Point = { row: 4, col: 4 };
export const CAPTURE_POINT: Point = { row: 5, col: 4 };

const KO_WHITE: Point[] = [KO_POINT, { row: 6, col: 4 }, { row: 5, col: 3 }, { row: 5, col: 5 }];
const KO_BLACK: Point[] = [
  { row: 3, col: 4 },
  { row: 4, col: 3 },
  { row: 4, col: 5 },
];

/** Top-left: the computer's group, held to two liberties by WHITE_WALL. */
const BOT_GROUP: Point[] = [
  { row: 0, col: 0 },
  { row: 0, col: 1 },
];
const WHITE_WALL: Point = { row: 1, col: 0 };

/** Bottom-left: the learner's own group, held to two liberties by BLACK_WALL. */
const PLAYER_GROUP: Point[] = [
  { row: 7, col: 0 },
  { row: 8, col: 0 },
];
const BLACK_WALL: Point = { row: 8, col: 1 };

/** The learner's ko threat: puts BOT_GROUP in atari. */
export const PLAYER_THREAT: Point = { row: 1, col: 1 };
/** The computer's scripted answer: extends BOT_GROUP back to two liberties. */
export const BOT_ANSWER: Point = { row: 0, col: 2 };

/** The computer's ko threat: puts PLAYER_GROUP in atari. */
export const BOT_THREAT: Point = { row: 7, col: 1 };
/** PLAYER_GROUP's last liberty. White here saves the group; Black here takes it. */
export const DEFEND_POINT: Point = { row: 6, col: 0 };

/** Filling the ko itself: ends the ko for good, at the cost of the corner. */
export const RESOLVE_POINT: Point = CAPTURE_POINT;

/** Legal moves that threaten nothing, so the opponent would never answer them. */
export const IDLE_POINTS: Point[] = [
  { row: 0, col: 7 },
  { row: 8, col: 8 },
];

export function createKoBoard(): Board {
  const board = createBoard(9);
  for (const point of [...KO_WHITE, ...PLAYER_GROUP, WHITE_WALL]) {
    board.cells[point.row][point.col] = "white";
  }
  for (const point of [...KO_BLACK, ...BOT_GROUP, BLACK_WALL]) {
    board.cells[point.row][point.col] = "black";
  }
  return board;
}

export const koLesson: LessonDefinition = {
  id: "ko",
  title: "Ko",
  createInitialBoard: createKoBoard,
};
