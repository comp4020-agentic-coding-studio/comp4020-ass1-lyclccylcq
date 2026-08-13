// Bootstraps Lesson 5: one predefined ko position, played through in three
// stages. go-rules.ts alone decides what's legal at each step — this file
// only tracks which board existed immediately before the opponent's last
// move (the one extra bit of state ko needs) and renders whatever the
// engine says. A rejected recapture never touches the board, so there is
// nothing to undo and nothing to visually mark: the ko point stays a plain
// empty intersection throughout.

import { renderGoBoard } from "./go-board";
import { placeStone, type Board, type Point } from "./go-rules";
import { CAPTURE_POINT, ELSEWHERE_POINT, KO_POINT, createKoBoard, koLesson } from "./lesson-ko";
import { markComplete } from "./lesson-progress";

export interface LessonElements {
  boardEl: HTMLElement | null;
  instructionEl: HTMLElement | null;
  feedbackEl: HTMLElement | null;
  resetButton: HTMLButtonElement | null;
}

// capture: only CAPTURE_POINT is playable. blocked: only KO_POINT is
// playable until the learner has tried it once; ELSEWHERE_POINT then joins
// it. retake: only KO_POINT is playable, and this time it succeeds.
type Stage = "capture" | "blocked" | "retake";

function pointsEqual(a: Point, b: Point): boolean {
  return a.row === b.row && a.col === b.col;
}

/** Wires up Lesson 5 against the given elements. Exported (rather than run
 * only as a side effect of import) so it can be tested against a detached
 * document, without touching the real page's DOM. */
export function mount(elements: LessonElements): void {
  const { boardEl, instructionEl, feedbackEl, resetButton } = elements;

  let board: Board = createKoBoard();
  let stage: Stage = "capture";
  // The board as it was immediately before the opponent's last move — the
  // one snapshot the ko rule needs. Null while there's no "last move" yet.
  let koBoard: Board | null = null;
  let attemptedRecapture = false;
  let solved = false;

  function render(): void {
    if (!boardEl) return;
    if (solved) markComplete(koLesson.id);

    const interactive: Point[] =
      stage === "capture"
        ? [CAPTURE_POINT]
        : stage === "blocked"
          ? attemptedRecapture
            ? [KO_POINT, ELSEWHERE_POINT]
            : [KO_POINT]
          : [KO_POINT];

    setInstruction(
      stage === "capture"
        ? "White's lone stone here has just one liberty left. Play Black to capture it."
        : stage === "blocked"
          ? attemptedRecapture
            ? "Ko blocks that immediate recapture. Try playing White somewhere else instead."
            : "White was just captured. Try immediately playing White back at that same point."
          : "White played elsewhere, so the ko point is playable again. Try retaking it.",
    );

    renderGoBoard(boardEl, {
      board,
      interactive,
      onPointActivate: (point) => handleActivate(point),
    });

    if (solved) {
      setFeedback(
        "Captured again — the position has moved on, so retaking it isn't recreating that old position anymore.",
      );
    } else if (stage === "retake") {
      setFeedback("One move elsewhere was enough to lift the restriction.");
    } else if (stage === "blocked" && attemptedRecapture) {
      setFeedback("You cannot immediately recreate the previous board position. This is called Ko.");
    } else {
      setFeedback("");
    }
  }

  function handleActivate(point: Point): void {
    if (stage === "capture") {
      if (!pointsEqual(point, CAPTURE_POINT)) return;
      const result = placeStone(board, point, "black");
      if (!result.ok) return;
      koBoard = board;
      board = result.board;
      stage = "blocked";
      render();
      return;
    }

    if (stage === "blocked") {
      if (pointsEqual(point, KO_POINT)) {
        const result = placeStone(board, KO_POINT, "white", koBoard ?? undefined);
        if (!result.ok) {
          attemptedRecapture = true;
          render();
          return;
        }
        koBoard = board;
        board = result.board;
        solved = true;
        render();
        return;
      }
      if (attemptedRecapture && pointsEqual(point, ELSEWHERE_POINT)) {
        const result = placeStone(board, point, "white", koBoard ?? undefined);
        if (!result.ok) return;
        koBoard = board;
        board = result.board;
        stage = "retake";
        render();
        return;
      }
      return;
    }

    if (stage === "retake") {
      if (!pointsEqual(point, KO_POINT)) return;
      const result = placeStone(board, KO_POINT, "white", koBoard ?? undefined);
      if (!result.ok) return;
      board = result.board;
      solved = true;
      render();
    }
  }

  function setInstruction(text: string): void {
    if (instructionEl) instructionEl.textContent = text;
  }

  function setFeedback(text: string): void {
    if (feedbackEl) feedbackEl.textContent = text;
  }

  resetButton?.addEventListener("click", () => {
    board = createKoBoard();
    stage = "capture";
    koBoard = null;
    attemptedRecapture = false;
    solved = false;
    render();
  });

  render();
}

if (typeof document !== "undefined") {
  mount({
    boardEl: document.querySelector<HTMLDivElement>("#board"),
    instructionEl: document.querySelector<HTMLParagraphElement>("#stage-instruction"),
    feedbackEl: document.querySelector<HTMLParagraphElement>("#lesson-feedback"),
    resetButton: document.querySelector<HTMLButtonElement>("#lesson-reset"),
  });
}
