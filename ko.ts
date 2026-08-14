// Bootstraps Lesson 5: one predefined ko, played out as a full ko fight.
// The learner takes Black for the opening capture and White from then on;
// the computer plays Black and every one of its moves is scripted here, so
// the sequence is the same every time.
//
// go-rules.ts alone decides what is legal at each step. This file adds only
// what the engine deliberately doesn't know: which board preceded the
// opponent's last move (the one snapshot ko needs), and the strategic
// meaning of a move — which threat is urgent, how the opponent answers it,
// and what each branch of the decision costs. None of that belongs in a
// rules engine, and none of these coordinates appear in one.
//
// A rejected recapture never touches the board, so there is nothing to undo
// and nothing to mark: the ko point stays a plain empty intersection.

import { notifyMoveResult } from "./audio";
import { renderGoBoard } from "./go-board";
import { placeStone, type Board, type Point } from "./go-rules";
import {
  BOT_ANSWER,
  BOT_THREAT,
  CAPTURE_POINT,
  DEFEND_POINT,
  IDLE_POINTS,
  KO_POINT,
  PLAYER_THREAT,
  RESOLVE_POINT,
  createKoBoard,
  koLesson,
} from "./lesson-ko";
import { markComplete } from "./lesson-progress";

export interface LessonElements {
  boardEl: HTMLElement | null;
  instructionEl: HTMLElement | null;
  feedbackEl: HTMLElement | null;
  replayButton: HTMLButtonElement | null;
  resetButton: HTMLButtonElement | null;
}

// capture       learner (Black) takes the ko
// blocked       learner (White) tries to take it straight back, and can't
// threat        learner finds a threat Black must answer; Black answers it
// retake        learner returns to the ko; Black then threatens in its turn
// decision      learner chooses: save the threatened group, or settle the ko
// answered      the group lived, and Black had time to retake the ko
// ignored       the ko is settled, and Black carried out its threat
type Stage = "capture" | "blocked" | "threat" | "retake" | "decision" | "answered" | "ignored";

/** Everything needed to put the learner back in front of the choice. */
interface DecisionPoint {
  board: Board;
  koBoard: Board | null;
  lastMove: Point | null;
}

function pointsEqual(a: Point, b: Point): boolean {
  return a.row === b.row && a.col === b.col;
}

/** Wires up Lesson 5 against the given elements. Exported (rather than run
 * only as a side effect of import) so it can be tested against a detached
 * document, without touching the real page's DOM. */
export function mount(elements: LessonElements): void {
  const { boardEl, instructionEl, feedbackEl, replayButton, resetButton } = elements;

  let board: Board = createKoBoard();
  let stage: Stage = "capture";
  // The board as it was immediately before the opponent's last move — the
  // one snapshot the ko rule needs. Null while there's no "last move" yet.
  let koBoard: Board | null = null;
  let lastMove: Point | null = null;
  // What the last move actually did, in the learner's words. Held as state
  // rather than derived from the stage, because the same stage can be
  // arrived at either by making a move or by getting one wrong.
  let feedback = "";
  let decisionPoint: DecisionPoint | null = null;

  function interactivePoints(): Point[] {
    switch (stage) {
      case "capture":
        return [CAPTURE_POINT];
      case "blocked":
        return [KO_POINT];
      case "threat":
        return [PLAYER_THREAT, ...IDLE_POINTS];
      case "retake":
        return [KO_POINT];
      case "decision":
        return [DEFEND_POINT, RESOLVE_POINT];
      case "answered":
      case "ignored":
        return [];
    }
  }

  function instructionText(): string {
    switch (stage) {
      case "capture":
        return "White's lone stone here has just one liberty left. Play Black to capture it.";
      case "blocked":
        return "White was just captured. Take White's side now, and try playing White straight back at that same point.";
      case "threat":
        return (
          "劫材 · Ko threat — White cannot retake the ko yet, but the ban lasts only one move. Play a " +
          "threat elsewhere that Black has to answer. Find the White move Black cannot afford to ignore."
        );
      case "retake":
        return "Black answered your threat, so the position has moved on. Take the ko back.";
      case "decision":
        return (
          "Now Black is the one who cannot retake immediately — so Black has threatened your two stones " +
          "in the bottom-left corner, which are down to their last liberty. Save them, or ignore the " +
          "threat and fill the ko so Black can never take it back. Both are real choices."
        );
      case "answered":
      case "ignored":
        return (
          "Ko is a battle of priorities: each threat asks whether what it attacks is worth more than the " +
          "ko itself. Here the ko was one stone and the corner was two — but in a real game either can " +
          "be the bigger prize, so neither answer is always right."
        );
    }
  }

  function render(): void {
    if (!boardEl) return;
    if (stage === "answered" || stage === "ignored") markComplete(koLesson.id);

    setText(instructionEl, instructionText());
    if (replayButton) replayButton.hidden = stage !== "answered" && stage !== "ignored";

    renderGoBoard(boardEl, {
      board,
      interactive: interactivePoints(),
      lastMove,
      onPointActivate: (point) => handleActivate(point),
    });

    setText(feedbackEl, feedback);
  }

  /** Applies a move the engine has already accepted, keeping the ko snapshot
   * and the last-move marker in step with the board. */
  function commit(nextBoard: Board, point: Point): void {
    koBoard = board;
    board = nextBoard;
    lastMove = point;
  }

  /** Plays one of the computer's scripted replies. */
  function scriptedReply(point: Point): boolean {
    const result = placeStone(board, point, "black", koBoard ?? undefined);
    notifyMoveResult(result);
    if (!result.ok) return false;
    commit(result.board, point);
    return true;
  }

  function handleActivate(point: Point): void {
    if (stage === "capture") {
      if (!pointsEqual(point, CAPTURE_POINT)) return;
      const result = placeStone(board, point, "black");
      notifyMoveResult(result);
      if (!result.ok) return;
      commit(result.board, point);
      stage = "blocked";
      render();
      return;
    }

    if (stage === "blocked") {
      if (!pointsEqual(point, KO_POINT)) return;
      const result = placeStone(board, KO_POINT, "white", koBoard ?? undefined);
      notifyMoveResult(result);
      if (result.ok) {
        // Unreachable with this fixture — the ko rule always refuses here —
        // but if it ever were legal, playing it honestly beats pretending.
        commit(result.board, KO_POINT);
        stage = "decision";
        render();
        return;
      }
      feedback = "You cannot immediately recreate the previous board position. This is called Ko.";
      stage = "threat";
      render();
      return;
    }

    if (stage === "threat") {
      if (!pointsEqual(point, PLAYER_THREAT)) {
        feedback =
          "That move is legal, but it threatens nothing — Black would ignore it and settle the ko " +
          "instead. Look for a move Black has to answer.";
        render();
        return;
      }
      const threat = placeStone(board, PLAYER_THREAT, "white");
      notifyMoveResult(threat);
      if (!threat.ok) return;
      commit(threat.board, PLAYER_THREAT);
      if (!scriptedReply(BOT_ANSWER)) return;
      stage = "retake";
      feedback = "That put Black's corner group in atari, so Black had to answer it. Your opponent answers the threat.";
      render();
      return;
    }

    if (stage === "retake") {
      if (!pointsEqual(point, KO_POINT)) return;
      const result = placeStone(board, KO_POINT, "white", koBoard ?? undefined);
      notifyMoveResult(result);
      if (!result.ok) return;
      commit(result.board, KO_POINT);
      // Black cannot take it straight back either, so Black threatens instead.
      if (!scriptedReply(BOT_THREAT)) return;
      stage = "decision";
      decisionPoint = { board, koBoard, lastMove };
      feedback =
        "Ko retaken — the threat and the answer changed the board, so this was no repetition. " +
        "Black has now played a ko threat of its own in the bottom-left.";
      render();
      return;
    }

    if (stage === "decision") {
      if (pointsEqual(point, DEFEND_POINT)) {
        const defence = placeStone(board, DEFEND_POINT, "white", koBoard ?? undefined);
        notifyMoveResult(defence);
        if (!defence.ok) return;
        commit(defence.board, DEFEND_POINT);
        if (!scriptedReply(CAPTURE_POINT)) return;
        stage = "answered";
        feedback =
          "You answered the threat and saved those stones. But answering cost you a move, so Black " +
          "had the time it needed: your opponent retakes the ko.";
        render();
        return;
      }

      if (pointsEqual(point, RESOLVE_POINT)) {
        const resolve = placeStone(board, RESOLVE_POINT, "white", koBoard ?? undefined);
        notifyMoveResult(resolve);
        if (!resolve.ok) return;
        commit(resolve.board, RESOLVE_POINT);
        if (!scriptedReply(DEFEND_POINT)) return;
        stage = "ignored";
        feedback =
          "You filled the ko instead, and it is settled for good — Black can never take it back. " +
          "You ignored the ko threat, so your opponent carried it out and captured those two stones.";
        render();
      }
    }
  }

  replayButton?.addEventListener("click", () => {
    if (!decisionPoint) return;
    board = decisionPoint.board;
    koBoard = decisionPoint.koBoard;
    lastMove = decisionPoint.lastMove;
    stage = "decision";
    feedback = "Back to the same choice. This time, try the other move.";
    render();
  });

  resetButton?.addEventListener("click", () => {
    board = createKoBoard();
    stage = "capture";
    koBoard = null;
    lastMove = null;
    feedback = "";
    decisionPoint = null;
    render();
  });

  render();
}

function setText(element: HTMLElement | null, text: string): void {
  if (element) element.textContent = text;
}

if (typeof document !== "undefined") {
  mount({
    boardEl: document.querySelector<HTMLDivElement>("#board"),
    instructionEl: document.querySelector<HTMLParagraphElement>("#stage-instruction"),
    feedbackEl: document.querySelector<HTMLParagraphElement>("#lesson-feedback"),
    replayButton: document.querySelector<HTMLButtonElement>("#lesson-replay"),
    resetButton: document.querySelector<HTMLButtonElement>("#lesson-reset"),
  });
}
