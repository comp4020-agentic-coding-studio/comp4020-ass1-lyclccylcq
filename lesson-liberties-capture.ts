import { createBoard, getGroup, type Point } from "./go-rules";
import type { LessonDefinition } from "./lesson";

export const TARGET: Point = { row: 4, col: 4 };

export const libertiesAndCaptureLesson: LessonDefinition = {
  id: "liberties-and-capture",
  title: "Liberties and Capture",
  createInitialBoard: () => {
    const board = createBoard(9);
    board.cells[TARGET.row][TARGET.col] = "black";
    return board;
  },
  isComplete: (board) => getGroup(board, TARGET).length === 0,
};
