// Bootstraps Lesson 4: two short examples that both centre on one empty
// point that looks fully surrounded. Example 1 plays into it and is
// rejected as suicide; example 2 looks the same but the move captures an
// adjacent White group first, so it's legal. go-rules.ts alone decides
// which is which — this file just renders whatever it says and reports the
// outcome in text. An illegal attempt never touches the board: no stone is
// placed, so there is nothing to undo and nothing to visually mark.

import { renderGoBoard } from "./go-board";
import { getGroup, getLiberties, getStone, placeStone, type Board, type Point } from "./go-rules";
import {
  CAPTURE_TARGET,
  SUICIDE_TARGET,
  createCaptureExampleBoard,
  createSuicideExampleBoard,
} from "./lesson-illegal-moves";

interface Example {
  createBoard: () => Board;
  target: Point;
  label: string;
}

const EXAMPLES: Example[] = [
  { createBoard: createSuicideExampleBoard, target: SUICIDE_TARGET, label: "Example 1 of 2 — fully surrounded" },
  { createBoard: createCaptureExampleBoard, target: CAPTURE_TARGET, label: "Example 2 of 2 — capturing on arrival" },
];

export interface LessonElements {
  boardEl: HTMLElement | null;
  instructionEl: HTMLElement | null;
  feedbackEl: HTMLElement | null;
  nextButton: HTMLButtonElement | null;
  resetButton: HTMLButtonElement | null;
}

function occupiedPoints(board: Board): Point[] {
  const points: Point[] = [];
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      if (board.cells[row][col] !== null) points.push({ row, col });
    }
  }
  return points;
}

function describeLiberties(count: number): string {
  return count === 1 ? "1 liberty" : `${count} liberties`;
}

/** Wires up one Lesson 4 run against the given elements. Exported (rather
 * than run only as a side effect of import) so it can be tested against a
 * detached document, without touching the real page's DOM. */
export function mount(elements: LessonElements): void {
  const { boardEl, instructionEl, feedbackEl, nextButton, resetButton } = elements;

  let exampleIndex = 0;
  let board: Board = EXAMPLES[exampleIndex].createBoard();
  let selected: Point | null = null;
  // Example 1 never changes the board (a rejected move leaves it untouched),
  // so "has the learner tried it" has to live outside the board state.
  let attempted = false;
  let solved = false;

  function render(): void {
    if (!boardEl) return;

    // A selection only ever means something while it still points at a
    // stone on the current board — once that stone is gone (captured,
    // in example 2) the selection is stale and must be dropped.
    if (selected && getStone(board, selected) === null) {
      selected = null;
    }

    const example = EXAMPLES[exampleIndex];
    const isSuicideExample = exampleIndex === 0;
    const isLastExample = exampleIndex === EXAMPLES.length - 1;
    const done = isSuicideExample ? attempted : solved;

    const group = selected ? getGroup(board, selected) : [];
    const liberties = group.length > 0 ? getLiberties(board, group) : [];

    setInstruction(
      `${example.label}. ${
        isSuicideExample
          ? attempted
            ? "That's illegal: no liberties. Try again, or move on when you're ready."
            : "White already fills every liberty around the marked centre. Try placing a Black stone there."
          : solved
            ? "White's last liberty was that very point, so Black captured on arrival. Both examples done."
            : "This corner looks just as surrounded. Try placing Black there anyway."
      }`,
    );

    renderGoBoard(boardEl, {
      board,
      highlights: [...group, ...liberties],
      interactive: solved ? [] : [...occupiedPoints(board), example.target],
      onPointActivate: (point) => handleActivate(point),
    });

    if (isSuicideExample) {
      if (attempted) {
        setFeedback("That move would leave your stone with no liberties.");
      } else if (selected) {
        setFeedback(`${describeLiberties(liberties.length)} remaining.`);
      } else {
        setFeedback("Nothing has been played there yet.");
      }
    } else if (solved) {
      setFeedback(
        "Normally this point would have no liberties, but the move captures White first, so it is legal.",
      );
    } else if (selected) {
      setFeedback(`${describeLiberties(liberties.length)} remaining.`);
    } else {
      setFeedback("White's two stones share this point as their only liberty.");
    }

    setNext(done && !isLastExample, "Next example", () => {
      exampleIndex += 1;
      selected = null;
      attempted = false;
      solved = false;
      board = EXAMPLES[exampleIndex].createBoard();
      render();
    });
  }

  // A click is either an inspection (any stone) or a move attempt (the
  // example's one designated empty point — the only empty point that's
  // ever interactive), never both.
  function handleActivate(point: Point): void {
    const stone = getStone(board, point);
    if (stone) {
      selected = point;
      render();
      return;
    }

    const result = placeStone(board, point, "black");
    if (!result.ok) {
      if (exampleIndex === 0) attempted = true;
      render();
      return;
    }
    board = result.board;
    solved = true;
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
    attempted = false;
    solved = false;
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
