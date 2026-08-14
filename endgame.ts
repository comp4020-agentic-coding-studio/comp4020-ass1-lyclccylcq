// Bootstraps Lesson 6: one nearly-finished position, three boundary moves,
// then the pass that ends the game. Every figure the feedback quotes is read
// back out of go-scoring.ts before and after the move the learner just made,
// so the lesson can never claim a gain the board doesn't actually show.
//
// Which move is the right one at each stage is lesson knowledge and lives in
// lesson-endgame.ts's fixture. A wrong-but-legal move is never played: it
// would quietly change the position the next stage depends on, and the point
// of the exercise is to find the move, not to be told after the fact.

import { notifyMoveResult } from "./audio";
import { renderGoBoard } from "./go-board";
import { placeStone, type Board, type Point } from "./go-rules";
import { scoreBoard } from "./go-scoring";
import {
  FINAL_POINT,
  IDLE_POINTS,
  REDUCE_POINT,
  SEAL_POINT,
  SUICIDE_POINT,
  createEndgameBoard,
  endgameLesson,
} from "./lesson-endgame";
import { markComplete } from "./lesson-progress";
import { KOMI } from "./lesson-scoring";

export interface LessonElements {
  boardEl: HTMLElement | null;
  instructionEl: HTMLElement | null;
  feedbackEl: HTMLElement | null;
  passButton: HTMLButtonElement | null;
  resetButton: HTMLButtonElement | null;
}

type Stage = "seal" | "reduce" | "final" | "pass" | "done";

/** The two points cut out of White's wall. They are worth exactly the same,
 * so the lesson accepts either one first and asks for the other second —
 * marking one of them "wrong" would be teaching a distinction Go doesn't
 * make. */
const CONTESTED: Point[] = [REDUCE_POINT, FINAL_POINT];

function pointsEqual(a: Point, b: Point): boolean {
  return a.row === b.row && a.col === b.col;
}

/** Wires up Lesson 6 against the given elements. Exported (rather than run
 * only as a side effect of import) so it can be tested against a detached
 * document, without touching the real page's DOM. */
export function mount(elements: LessonElements): void {
  const { boardEl, instructionEl, feedbackEl, passButton, resetButton } = elements;

  let board: Board = createEndgameBoard();
  let stage: Stage = "seal";
  let contested: Point[] = [...CONTESTED];
  let lastMove: Point | null = null;
  let feedback = "";

  function answers(): Point[] {
    return stage === "seal" ? [SEAL_POINT] : contested;
  }

  function interactivePoints(): Point[] {
    if (stage === "pass" || stage === "done") return [];
    return [...answers(), SUICIDE_POINT, ...IDLE_POINTS];
  }

  function instructionText(): string {
    switch (stage) {
      case "seal":
        return "Black's wall stops one point short of the top edge. Find the move that closes it.";
      case "reduce":
        return "White's wall has two points bitten out of it. Find one that belongs to neither player yet.";
      case "final":
        return "One point still belongs to neither player. Take it.";
      case "pass":
        return "Nothing left on this board is worth a stone. Pass.";
      case "done":
        return "Two passes in a row, so the game is over. All that remains is to count it.";
    }
  }

  function render(): void {
    if (!boardEl) return;
    if (stage === "done") markComplete(endgameLesson.id);

    setText(instructionEl, instructionText());
    if (passButton) passButton.hidden = stage !== "pass";

    renderGoBoard(boardEl, {
      board,
      interactive: interactivePoints(),
      lastMove,
      onPointActivate: (point) => handleActivate(point),
    });

    setText(feedbackEl, feedback);
  }

  function handleActivate(point: Point): void {
    if (stage === "pass" || stage === "done") return;

    if (!answers().some((answer) => pointsEqual(point, answer))) {
      // The engine, not the lesson, decides that White's eye is unplayable —
      // so ask it, and report whatever it says.
      const attempt = placeStone(board, point, "black");
      notifyMoveResult(attempt);
      feedback = attempt.ok
        ? "That move is legal, but it sits deep inside Black's own side, far from anything still being decided. " +
          "The moves that are still worth something are along the boundary between the two walls."
        : "White surrounds that point completely, so a black stone there would have no liberties at all. " +
          "Settled territory cannot simply be walked into.";
      render();
      return;
    }

    const before = scoreBoard(board, KOMI);
    const result = placeStone(board, point, "black");
    notifyMoveResult(result);
    if (!result.ok) return;
    board = result.board;
    lastMove = point;
    contested = contested.filter((candidate) => !pointsEqual(candidate, point));
    const after = scoreBoard(board, KOMI);

    if (stage === "seal") {
      feedback =
        `Black's boundary is closed. Black's territory goes from ${before.blackTerritory.length} points to ` +
        `${after.blackTerritory.length}: while the wall had a gap in it, that whole side bordered White too, ` +
        `so none of it counted for anybody.`;
      stage = "reduce";
    } else if (stage === "reduce") {
      feedback =
        `That point belonged to neither player, and now it is Black's. Points still in dispute: ` +
        `${before.neutralPoints.length} to ${after.neutralPoints.length}. Black's score: ${before.blackScore} ` +
        `to ${after.blackScore} — and it is a point White will not be getting either.`;
      stage = "final";
    } else {
      feedback =
        `Every empty point on the board now borders one colour only: ${after.neutralPoints.length} points are ` +
        `left in dispute. Black ${after.blackScore}, White ${after.whiteScore} — but neither player can improve ` +
        `on that with another stone.`;
      stage = "pass";
    }
    render();
  }

  passButton?.addEventListener("click", () => {
    if (stage !== "pass") return;
    // Passing isn't a move, so there is nothing here for go-rules.ts to
    // decide: two passes in a row is a fact about the players, not the board.
    stage = "done";
    feedback =
      "Black passed. With nothing left to gain, White passed too — and two passes in a row end the game. " +
      "The stones stay exactly where they are; the next chapter counts them.";
    render();
  });

  resetButton?.addEventListener("click", () => {
    board = createEndgameBoard();
    stage = "seal";
    contested = [...CONTESTED];
    lastMove = null;
    feedback = "";
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
    passButton: document.querySelector<HTMLButtonElement>("#lesson-pass"),
    resetButton: document.querySelector<HTMLButtonElement>("#lesson-reset"),
  });
}
