// Bootstraps Lesson 7: one already-finished 9x9 position, counted in six
// stages. Every number shown comes straight out of scoreBoard() — nothing
// here hard-codes a stone count, a territory count, or a winner, so the
// demo text can never drift out of sync with the board it's describing.
// After territory starts being revealed, every point on the board becomes
// clickable purely for inspection (§5) — clicking never changes the stage.

import { renderGoBoard, type PointMarker } from "./go-board";
import { getStone, type Board, type Point } from "./go-rules";
import { scoreBoard, territoryOwnerAt, type ScoreResult } from "./go-scoring";
import { KOMI, createScoringBoard, scoringLesson } from "./lesson-scoring";
import { markComplete } from "./lesson-progress";

const STAGES = ["position", "black", "white", "neutral", "komi", "result"] as const;
type Stage = (typeof STAGES)[number];

const NEXT_LABEL: Record<Stage, string | null> = {
  position: "Count the board",
  black: "Reveal White's territory",
  white: "Check for neutral points",
  neutral: "Add komi",
  komi: "Show final result",
  result: null,
};

export interface LessonElements {
  boardEl: HTMLElement | null;
  instructionEl: HTMLElement | null;
  breakdownEl: HTMLElement | null;
  feedbackEl: HTMLElement | null;
  nextButton: HTMLButtonElement | null;
  resetButton: HTMLButtonElement | null;
}

function allPoints(board: Board): Point[] {
  const points: Point[] = [];
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) points.push({ row, col });
  }
  return points;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function instructionFor(stage: Stage, result: ScoreResult): string {
  if (stage === "position")
    return "Both players have passed, so this board is final. Now we count who controls more of it.";
  if (stage === "black") return "Every empty point that only Black's stones surround becomes Black's territory.";
  if (stage === "white") return "Everything that only White's stones surround becomes White's territory, the same way.";
  if (stage === "neutral") {
    return result.neutralPoints.length === 0
      ? "This position has no neutral points — every empty intersection already belongs to Black or White."
      : `${plural(result.neutralPoints.length, "point")} touch both colours, so they belong to neither player.`;
  }
  if (stage === "komi") {
    return "White receives komi because Black plays the game's first move. Board score plus komi gives White's final total.";
  }
  return "Both totals are in. Click any point on the board to see whose it is. You now know the basic rules needed to understand a game of Go.";
}

function breakdownFor(stage: Stage, result: ScoreResult): string[] {
  const lines: string[] = [];
  if (stage === "position") return lines;

  lines.push(`Black stones: ${result.blackStones}. Black territory: ${result.blackTerritory.length}.`);
  if (stage === "black") {
    lines.push(`Black total so far: ${result.blackScore}.`);
    return lines;
  }

  lines.push(`White stones: ${result.whiteStones}. White territory: ${result.whiteTerritory.length}.`);
  if (stage === "white") {
    lines.push(`White total so far (before komi): ${result.whiteBoardScore}.`);
    return lines;
  }

  lines.push(`Neutral points: ${result.neutralPoints.length}.`);
  if (stage === "neutral") return lines;

  lines.push(`Komi: +${result.komi} for White. ${result.whiteBoardScore} + ${result.komi} = ${result.whiteScore}.`);
  if (stage === "komi") return lines;

  lines.push(`Black final score: ${result.blackStones} + ${result.blackTerritory.length} = ${result.blackScore}.`);
  lines.push(
    `White final score: ${result.whiteStones} + ${result.whiteTerritory.length} + ${result.komi} = ${result.whiteScore}.`,
  );
  lines.push(
    result.winner === "tie"
      ? "The game is a tie."
      : `${result.winner === "black" ? "Black" : "White"} wins by ${plural(result.margin, "point")}.`,
  );
  return lines;
}

function buildMarkers(stageIndex: number, result: ScoreResult): PointMarker[] {
  const markers: PointMarker[] = [];
  if (stageIndex >= 1) {
    for (const point of result.blackTerritory) {
      markers.push({ point, shape: "square", className: "go-board-marker-black", label: "Black territory" });
    }
  }
  if (stageIndex >= 2) {
    for (const point of result.whiteTerritory) {
      markers.push({ point, shape: "ring", className: "go-board-marker-white", label: "White territory" });
    }
  }
  if (stageIndex >= 3) {
    for (const point of result.neutralPoints) {
      markers.push({ point, shape: "cross", className: "go-board-marker-neutral", label: "Neutral point" });
    }
  }
  return markers;
}

/** Wires up Lesson 7 against the given elements. Exported (rather than run
 * only as a side effect of import) so it can be tested against a detached
 * document, without touching the real page's DOM. */
export function mount(elements: LessonElements): void {
  const { boardEl, instructionEl, breakdownEl, feedbackEl, nextButton, resetButton } = elements;

  const board: Board = createScoringBoard();
  const result: ScoreResult = scoreBoard(board, KOMI);
  let stageIndex = 0;

  function render(): void {
    if (!boardEl) return;
    const stage = STAGES[stageIndex];
    if (stage === "result") markComplete(scoringLesson.id);

    setInstruction(instructionFor(stage, result));
    setBreakdown(breakdownFor(stage, result));
    setFeedback(stageIndex >= 1 ? "Click any point on the board to see whose it is." : "");

    const interactive = stageIndex >= 1 ? allPoints(board) : [];
    renderGoBoard(boardEl, {
      board,
      markers: buildMarkers(stageIndex, result),
      interactive,
      onPointActivate: (point) => inspect(point),
    });

    const label = NEXT_LABEL[stage];
    setNext(label !== null, label ?? "", () => {
      stageIndex += 1;
      render();
    });
  }

  function inspect(point: Point): void {
    const stone = getStone(board, point);
    if (stone) {
      setFeedback(`This is a ${stone} stone.`);
      return;
    }
    const owner = territoryOwnerAt(result, point);
    if (owner === "black") setFeedback("This empty point is Black's territory.");
    else if (owner === "white") setFeedback("This empty point is White's territory.");
    else setFeedback("This empty point is neutral — it belongs to neither player.");
  }

  function setInstruction(text: string): void {
    if (instructionEl) instructionEl.textContent = text;
  }

  function setBreakdown(lines: string[]): void {
    if (!breakdownEl) return;
    breakdownEl.replaceChildren(
      ...lines.map((line) => {
        const p = document.createElement("p");
        p.textContent = line;
        return p;
      }),
    );
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
    stageIndex = 0;
    render();
  });

  render();
}

if (typeof document !== "undefined") {
  mount({
    boardEl: document.querySelector<HTMLDivElement>("#board"),
    instructionEl: document.querySelector<HTMLParagraphElement>("#stage-instruction"),
    breakdownEl: document.querySelector<HTMLDivElement>("#score-breakdown"),
    feedbackEl: document.querySelector<HTMLParagraphElement>("#lesson-feedback"),
    nextButton: document.querySelector<HTMLButtonElement>("#lesson-next"),
    resetButton: document.querySelector<HTMLButtonElement>("#lesson-reset"),
  });
}
