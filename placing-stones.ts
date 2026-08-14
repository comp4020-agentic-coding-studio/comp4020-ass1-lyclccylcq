// Bootstraps Lesson 1: click any empty point to place a stone, alternating
// colours starting with black. Deliberately simple — no liberties, no
// capture, no restriction on where a stone can go.

import { notifyMoveResult } from "./audio";
import { renderGoBoard } from "./go-board";
import { placeStone, type Board, type Point, type Stone } from "./go-rules";
import { placingStonesLesson } from "./lesson-placing-stones";

const boardEl = document.querySelector<HTMLDivElement>("#board");
const feedbackEl = document.querySelector<HTMLParagraphElement>("#lesson-feedback");
const resetButton = document.querySelector<HTMLButtonElement>("#lesson-reset");

let board: Board = placingStonesLesson.createInitialBoard();
let toPlay: Stone = "black";

function opponent(stone: Stone): Stone {
  return stone === "black" ? "white" : "black";
}

function capitalise(stone: Stone): string {
  return stone.charAt(0).toUpperCase() + stone.slice(1);
}

function emptyPoints(current: Board): Point[] {
  const points: Point[] = [];
  for (let row = 0; row < current.size; row++) {
    for (let col = 0; col < current.size; col++) {
      if (current.cells[row][col] === null) points.push({ row, col });
    }
  }
  return points;
}

function render(): void {
  if (!boardEl) return;
  renderGoBoard(boardEl, {
    board,
    interactive: emptyPoints(board),
    onPointActivate: handleActivate,
  });
}

function handleActivate(point: Point): void {
  const result = placeStone(board, point, toPlay);
  notifyMoveResult(result);
  if (!result.ok) return;

  board = result.board;
  if (feedbackEl) {
    const played = toPlay;
    toPlay = opponent(toPlay);
    feedbackEl.textContent = `${capitalise(played)} placed a stone at row ${point.row + 1}, column ${point.col + 1}. ${capitalise(toPlay)}'s turn.`;
  } else {
    toPlay = opponent(toPlay);
  }
  render();
}

resetButton?.addEventListener("click", () => {
  board = placingStonesLesson.createInitialBoard();
  toPlay = "black";
  if (feedbackEl) feedbackEl.textContent = "";
  render();
});

render();
