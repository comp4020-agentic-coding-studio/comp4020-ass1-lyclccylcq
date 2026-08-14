// Bootstraps Lesson 3: three sequential capture examples that all run the
// same interaction. Click any black stone to select its connected group and
// see its shared liberties, then click any empty point to place white —
// go-rules.ts alone decides whether that's legal and whether it captures.
// There is no separate "allowed points" list: every empty point stays
// clickable, and an illegal click just leaves the board exactly as it was.

import { notifyMoveResult } from "./audio";
import { renderGoBoard } from "./go-board";
import { getGroup, getLiberties, getStone, placeStone, type Board, type Point } from "./go-rules";
import {
  connectedGroupsLesson,
  createExample1Board,
  createExample2Board,
  createExample3Board,
  EXAMPLE_1_GROUP,
  EXAMPLE_2_GROUP,
  EXAMPLE_3_GROUP,
  isGroupCaptured,
} from "./lesson-connected-groups";
import { markComplete } from "./lesson-progress";

interface Example {
  createBoard: () => Board;
  group: Point[];
  label: string;
}

const EXAMPLES: Example[] = [
  { createBoard: createExample1Board, group: EXAMPLE_1_GROUP, label: "Example 1 of 3 — two connected stones" },
  { createBoard: createExample2Board, group: EXAMPLE_2_GROUP, label: "Example 2 of 3 — a larger group" },
  { createBoard: createExample3Board, group: EXAMPLE_3_GROUP, label: "Example 3 of 3 — a trickier shape" },
];

export interface LessonElements {
  boardEl: HTMLElement | null;
  instructionEl: HTMLElement | null;
  feedbackEl: HTMLElement | null;
  nextButton: HTMLButtonElement | null;
  resetButton: HTMLButtonElement | null;
}

function emptyPoints(board: Board): Point[] {
  const points: Point[] = [];
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      if (board.cells[row][col] === null) points.push({ row, col });
    }
  }
  return points;
}

function blackStones(board: Board): Point[] {
  const points: Point[] = [];
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      if (board.cells[row][col] === "black") points.push({ row, col });
    }
  }
  return points;
}

function describeLiberties(count: number): string {
  return count === 1 ? "1 liberty" : `${count} liberties`;
}

function illegalMoveFeedback(reason: "occupied" | "off-board" | "suicide" | "ko"): string {
  if (reason === "suicide") return "That move has no liberties.";
  if (reason === "occupied") return "That point already has a stone on it.";
  if (reason === "ko") return "That move would repeat the previous position.";
  return "That point isn't on the board.";
}

/** Wires up one Lesson 3 run against the given elements. Exported (rather
 * than run only as a side effect of import) so it can be tested against a
 * detached document, without touching the real page's DOM. */
export function mount(elements: LessonElements): void {
  const { boardEl, instructionEl, feedbackEl, nextButton, resetButton } = elements;

  let exampleIndex = 0;
  let board: Board = EXAMPLES[exampleIndex].createBoard();
  let selected: Point | null = null;

  function render(): void {
    if (!boardEl) return;

    // A selection only ever means something while it still points at a black
    // stone on the current board. Once that stone is gone — captured, most
    // likely alongside its whole group — the selection is stale and must be
    // dropped before anything below reads it, not just skipped over.
    if (selected && getStone(board, selected) !== "black") {
      selected = null;
    }

    const example = EXAMPLES[exampleIndex];
    const captured = isGroupCaptured(board, example.group);
    const isLastExample = exampleIndex === EXAMPLES.length - 1;
    if (captured && isLastExample) markComplete(connectedGroupsLesson.id);

    const group = selected ? getGroup(board, selected) : [];
    const liberties = group.length > 0 ? getLiberties(board, group) : [];

    setInstruction(
      `${example.label}. ${
        captured
          ? "Captured! Every stone in the group disappeared together."
          : selected
            ? "Now click empty points to place white and take away its liberties, one at a time."
            : "Click any black stone below to select its connected group."
      }`,
    );

    renderGoBoard(boardEl, {
      board,
      highlights: [...group, ...liberties],
      interactive: captured ? [] : [...blackStones(board), ...emptyPoints(board)],
      onPointActivate: (point) => handleActivate(point),
    });

    if (captured) {
      setFeedback(
        isLastExample
          ? "No liberties left — the whole connected group is captured. That's all three examples done."
          : "No liberties left — the whole connected group is captured.",
      );
    } else if (selected) {
      setFeedback(`${describeLiberties(liberties.length)} remaining.`);
    } else {
      setFeedback("Select the group to see its liberties.");
    }

    setNext(captured && !isLastExample, "Next example", () => {
      exampleIndex += 1;
      selected = null;
      board = EXAMPLES[exampleIndex].createBoard();
      render();
    });
  }

  // A click is either a group inspection or a move attempt, never both: a
  // black stone selects (and returns before touching placeStone), anything
  // else — empty or white — is a move attempt that either lands or is
  // rejected without altering board or selected.
  function handleActivate(point: Point): void {
    const stone = getStone(board, point);
    if (stone === "black") {
      selected = point;
      render();
      return;
    }

    const result = placeStone(board, point, "white");
    notifyMoveResult(result);
    if (!result.ok) {
      setFeedback(illegalMoveFeedback(result.reason));
      return;
    }
    board = result.board;
    render();
  }

  function setInstruction(text: string): void {
    if (instructionEl) instructionEl.textContent = text;
  }

  function setFeedback(text: string): void {
    if (feedbackEl) feedbackEl.textContent = text;
  }

  function setNext(visible: boolean, label: string, onClick: () => void): void {
    if (!nextButton) return;
    nextButton.hidden = !visible;
    nextButton.textContent = label;
    nextButton.onclick = visible ? onClick : null;
  }

  resetButton?.addEventListener("click", () => {
    selected = null;
    board = EXAMPLES[exampleIndex].createBoard();
    render();
  });

  render();
}

if (typeof document !== "undefined") {
  mount({
    boardEl: document.querySelector<HTMLDivElement>("#board"),
    instructionEl: document.querySelector<HTMLParagraphElement>("#stage-instruction"),
    feedbackEl: document.querySelector<HTMLParagraphElement>("#lesson-feedback"),
    nextButton: document.querySelector<HTMLButtonElement>("#lesson-next"),
    resetButton: document.querySelector<HTMLButtonElement>("#lesson-reset"),
  });
}
