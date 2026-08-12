import { createGoBoard } from "./go-board";

const board = document.querySelector<HTMLDivElement>("#board");
if (board) {
  createGoBoard(board);
}
