// Bootstraps Lesson 2: a predefined position (one black stone, centre) where
// the learner surrounds it with white to see a group's liberties run out.
// go-rules.ts decides what's legal and what gets captured; go-board.ts only
// draws whatever state it's given.

import { renderGoBoard } from "./go-board";
import { getGroup, getLiberties, placeStone, type Board, type Point } from "./go-rules";
import { libertiesAndCaptureLesson, TARGET } from "./lesson-liberties-capture";
import { markComplete } from "./lesson-progress";

const boardEl = document.querySelector<HTMLDivElement>("#board");
const feedbackEl = document.querySelector<HTMLParagraphElement>("#lesson-feedback");
const retryButton = document.querySelector<HTMLButtonElement>("#lesson-retry");

let board: Board = libertiesAndCaptureLesson.createInitialBoard();

function render(): void {
  if (!boardEl) return;

  const captured = libertiesAndCaptureLesson.isComplete?.(board) ?? false;
  if (captured) markComplete(libertiesAndCaptureLesson.id);
  const liberties = captured ? [] : getLiberties(board, getGroup(board, TARGET));

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
  board = libertiesAndCaptureLesson.createInitialBoard();
  render();
});

render();
