// Bootstraps Lesson 3 across three short stages: select a connected group and
// watch it (and its shared liberties) light up as a whole; contrast that with
// two stones that only touch diagonally; then surround a group and watch it
// get captured all at once. go-rules.ts already treats a connected group as
// one unit for liberties and capture — this only wires that up to clicks.

import { renderGoBoard } from "./go-board";
import { getGroup, getLiberties, placeStone, type Board, type Point } from "./go-rules";
import {
  CAPTURE_GROUP,
  DIAGONAL_A,
  DIAGONAL_B,
  DISCOVER_GROUP,
  connectedGroupsLesson,
  createCaptureBoard,
  createDiagonalBoard,
  createDiscoverBoard,
} from "./lesson-connected-groups";

type Stage = 1 | 2 | 3;

const boardEl = document.querySelector<HTMLDivElement>("#board");
const instructionEl = document.querySelector<HTMLParagraphElement>("#stage-instruction");
const feedbackEl = document.querySelector<HTMLParagraphElement>("#lesson-feedback");
const nextButton = document.querySelector<HTMLButtonElement>("#lesson-next");
const resetButton = document.querySelector<HTMLButtonElement>("#lesson-reset");

let stage: Stage = 1;
let board: Board = createDiscoverBoard();

function render(): void {
  if (stage === 1) renderDiscover();
  else if (stage === 2) renderDiagonal();
  else renderCapture();
}

/** Draws `board` with `selectable` points clickable; clicking one highlights
 * its whole group plus their shared liberties and reports on it. */
function renderSelectable(
  selectable: Point[],
  idleInstruction: string,
  describe: (group: Point[], liberties: Point[]) => string,
): void {
  let selected: Point | null = null;

  const draw = (): void => {
    if (!boardEl) return;
    const group = selected ? getGroup(board, selected) : [];
    const liberties = selected ? getLiberties(board, group) : [];

    renderGoBoard(boardEl, {
      board,
      highlights: [...group, ...liberties],
      interactive: selectable,
      onPointActivate: (point) => {
        selected = point;
        draw();
      },
    });

    setFeedback(selected ? describe(group, liberties) : idleInstruction);
  };

  draw();
}

function renderDiscover(): void {
  setInstruction(
    "Click any stone below — the whole connected group it belongs to lights up, along with the liberties they share.",
  );
  renderSelectable(
    DISCOVER_GROUP,
    "Click a stone to select its group.",
    (group, liberties) =>
      `These ${group.length} stones are connected and share ${liberties.length} liberties. Selecting any one of them selects the whole group.`,
  );
  setNext("Next: diagonal contact", () => {
    stage = 2;
    board = createDiagonalBoard();
    render();
  });
}

function renderDiagonal(): void {
  setInstruction(
    "These two stones only touch at a corner. Click each one and notice they light up alone — diagonal contact doesn't connect them.",
  );
  renderSelectable(
    [DIAGONAL_A, DIAGONAL_B],
    "Click either stone to see its group on its own.",
    (group, liberties) =>
      `That stone's group is just itself, with ${liberties.length} liberties — its diagonal neighbour is a separate group.`,
  );
  setNext("Next: capture a group", () => {
    stage = 3;
    board = createCaptureBoard();
    render();
  });
}

function renderCapture(): void {
  if (!boardEl) return;

  const captured = connectedGroupsLesson.isComplete?.(board) ?? false;
  const group = captured ? [] : getGroup(board, CAPTURE_GROUP[0]);
  const liberties = captured ? [] : getLiberties(board, group);

  setInstruction(
    "This group shares its liberties. Place white on each highlighted point — when the last shared liberty is gone, the whole group is captured together.",
  );
  renderGoBoard(boardEl, {
    board,
    highlights: [...group, ...liberties],
    interactive: liberties,
    onPointActivate: (point) => {
      const result = placeStone(board, point, "white");
      if (!result.ok) return;
      board = result.board;
      render();
    },
  });

  setFeedback(
    captured
      ? "Captured! Both connected stones were removed together, because the whole group ran out of shared liberties at once."
      : `Shared liberties remaining: ${liberties.length}. Click a highlighted point to place white and take one away.`,
  );
  setNext(null);
}

function setInstruction(text: string): void {
  if (instructionEl) instructionEl.textContent = text;
}

function setFeedback(text: string): void {
  if (feedbackEl) feedbackEl.textContent = text;
}

function setNext(label: string | null, onClick?: () => void): void {
  if (!nextButton) return;
  if (label === null) {
    nextButton.hidden = true;
    return;
  }
  nextButton.hidden = false;
  nextButton.textContent = label;
  nextButton.onclick = onClick ?? null;
}

resetButton?.addEventListener("click", () => {
  stage = 1;
  board = createDiscoverBoard();
  render();
});

render();
