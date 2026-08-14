// Bootstraps Lesson 5: one predefined ko position, played through in five
// stages. go-rules.ts alone decides what's legal at each step — this file
// only tracks which board existed immediately before the opponent's last
// move (the one extra bit of state ko needs) and renders whatever the
// engine says. A rejected recapture never touches the board, so there is
// nothing to undo and nothing to visually mark: the ko point stays a plain
// empty intersection throughout.
//
// The ko-threat half is necessarily scripted here rather than in the rules
// engine: placeStone only ever compares against the one prior board it is
// handed, so it has no way to judge whether a move elsewhere was a real
// threat. Which move counts as urgent, and how the opponent answers it, is
// lesson knowledge — it lives in lesson-ko.ts's fixture and in the handler
// below, and go-rules.ts stays free of lesson-specific coordinates.

import { notifyMoveResult } from "./audio";
import { renderGoBoard } from "./go-board";
import { placeStone, type Board, type Point } from "./go-rules";
import {
  CAPTURE_POINT,
  DEFENSE_POINT,
  ELSEWHERE_POINT,
  KO_POINT,
  THREAT_DECOYS,
  THREAT_POINT,
  createKoBoard,
  koLesson,
} from "./lesson-ko";
import { markComplete } from "./lesson-progress";

export interface LessonElements {
  boardEl: HTMLElement | null;
  instructionEl: HTMLElement | null;
  feedbackEl: HTMLElement | null;
  resetButton: HTMLButtonElement | null;
}

// capture: only CAPTURE_POINT is playable. blocked: only KO_POINT is
// playable until the learner has tried it once; ELSEWHERE_POINT then joins
// it. retake: only KO_POINT is playable, and this time it succeeds — which
// leaves Black facing the same ko from the other side. threat: the learner
// must find the one move White has to answer. threat-retake: the answer has
// moved the game on, so the ko point is Black's again.
type Stage = "capture" | "blocked" | "retake" | "threat" | "threat-retake" | "solved";

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
  // What the last move actually did, in the learner's words. Held as state
  // rather than derived from the stage, because the same stage can be
  // arrived at either by making a move or by getting one wrong.
  let feedback = "";

  function interactivePoints(): Point[] {
    switch (stage) {
      case "capture":
        return [CAPTURE_POINT];
      case "blocked":
        return attemptedRecapture ? [KO_POINT, ELSEWHERE_POINT] : [KO_POINT];
      case "retake":
        return [KO_POINT];
      case "threat":
        return [THREAT_POINT, ...THREAT_DECOYS];
      case "threat-retake":
        return [CAPTURE_POINT];
      case "solved":
        return [];
    }
  }

  function instructionText(): string {
    switch (stage) {
      case "capture":
        return "White's lone stone here has just one liberty left. Play Black to capture it.";
      case "blocked":
        return attemptedRecapture
          ? "Ko blocks that immediate recapture. Try playing White somewhere else instead."
          : "White was just captured. Try immediately playing White back at that same point.";
      case "retake":
        return "White played elsewhere, so the ko point is playable again. Try retaking it.";
      case "threat":
        return (
          "劫材 · Ko threat — Black cannot immediately retake the ko. Instead, you may play an urgent " +
          "threat elsewhere. If your opponent answers it, you can come back to the ko. Find the Black " +
          "move White cannot afford to ignore."
        );
      case "threat-retake":
        return "White answered the threat, so the position has moved on. Take the ko back.";
      case "solved":
        return "That is the full ko cycle: capture, threat, answer, retake.";
    }
  }

  function render(): void {
    if (!boardEl) return;
    if (stage === "solved") markComplete(koLesson.id);

    setInstruction(instructionText());

    renderGoBoard(boardEl, {
      board,
      interactive: interactivePoints(),
      onPointActivate: (point) => handleActivate(point),
    });

    setFeedback(feedback);
  }

  function handleActivate(point: Point): void {
    if (stage === "capture") {
      if (!pointsEqual(point, CAPTURE_POINT)) return;
      const result = placeStone(board, point, "black");
      notifyMoveResult(result);
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
        notifyMoveResult(result);
        if (!result.ok) {
          attemptedRecapture = true;
          feedback = "You cannot immediately recreate the previous board position. This is called Ko.";
          render();
          return;
        }
        koBoard = board;
        board = result.board;
        stage = "threat";
        render();
        return;
      }
      if (attemptedRecapture && pointsEqual(point, ELSEWHERE_POINT)) {
        const result = placeStone(board, point, "white", koBoard ?? undefined);
        notifyMoveResult(result);
        if (!result.ok) return;
        koBoard = board;
        board = result.board;
        stage = "retake";
        feedback = "One move elsewhere was enough to lift the restriction.";
        render();
        return;
      }
      return;
    }

    if (stage === "retake") {
      if (!pointsEqual(point, KO_POINT)) return;
      const result = placeStone(board, KO_POINT, "white", koBoard ?? undefined);
      notifyMoveResult(result);
      if (!result.ok) return;
      koBoard = board;
      board = result.board;
      stage = "threat";
      feedback =
        "Captured again — the position has moved on, so retaking it isn't recreating that old position anymore.";
      render();
      return;
    }

    if (stage === "threat") {
      if (!pointsEqual(point, THREAT_POINT)) {
        feedback =
          "That move is legal, but it threatens nothing — White would ignore it and settle the ko instead. " +
          "Look for a move White has to answer.";
        render();
        return;
      }
      const threat = placeStone(board, THREAT_POINT, "black");
      notifyMoveResult(threat);
      if (!threat.ok) return;
      const answer = placeStone(threat.board, DEFENSE_POINT, "white");
      notifyMoveResult(answer);
      if (!answer.ok) return;
      // The ko snapshot is the board just before White's answer, so Black's
      // return to the ko point no longer repeats a position anyone has seen.
      koBoard = threat.board;
      board = answer.board;
      stage = "threat-retake";
      feedback = "That put White's corner group in atari, and White had to answer it.";
      render();
      return;
    }

    if (stage === "threat-retake") {
      if (!pointsEqual(point, CAPTURE_POINT)) return;
      const result = placeStone(board, CAPTURE_POINT, "black", koBoard ?? undefined);
      notifyMoveResult(result);
      if (!result.ok) return;
      koBoard = board;
      board = result.board;
      stage = "solved";
      feedback = "Ko retaken. The threat and White's answer changed the board, so this is no longer a repetition.";
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
    feedback = "";
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
