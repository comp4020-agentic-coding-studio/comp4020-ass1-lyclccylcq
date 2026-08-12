// Controller for the liberties-and-capture lesson: owns a predefined board
// position (one black stone, centre) and lets the learner place white stones
// on nothing but its current liberties. go-rules.ts decides what's legal and
// what gets captured; go-board.ts only draws whatever state it's given.

import { renderGoBoard } from "./go-board";
import { createBoard, getGroup, getLiberties, placeStone, type Board, type Point } from "./go-rules";

const TARGET: Point = { row: 4, col: 4 };

const boardEl = document.querySelector<HTMLDivElement>("#board");
const feedbackEl = document.querySelector<HTMLParagraphElement>("#lesson-feedback");
const retryButton = document.querySelector<HTMLButtonElement>("#lesson-retry");

function startingPosition(): Board {
  const board = createBoard(9);
  board.cells[TARGET.row][TARGET.col] = "black";
  return board;
}

let board = startingPosition();

function render(): void {
  if (!boardEl) return;

  const group = getGroup(board, TARGET);
  const captured = group.length === 0;
  const liberties = captured ? [] : getLiberties(board, group);

  renderGoBoard(boardEl, {
    board,
    highlights: liberties,
    interactive: liberties,
    onPointActivate: handleActivate,
  });

  if (feedbackEl) {
    feedbackEl.textContent = captured
      ? "Captured! A group with zero liberties is removed from the board."
      : `Liberties remaining: ${liberties.length}. Click a highlighted point to place white and take one away.`;
  }
}

function handleActivate(point: Point): void {
  const result = placeStone(board, point, "white");
  if (!result.ok) return;
  board = result.board;
  render();
}

retryButton?.addEventListener("click", () => {
  board = startingPosition();
  render();
});

render();
