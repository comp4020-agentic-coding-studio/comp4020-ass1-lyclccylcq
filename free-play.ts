// Free play: a full 19x19 board against the local practice bot. Nothing here
// is a lesson — there is no right answer, no stage, and no completion.
//
// The board, the rules, the sounds, and the scoring are all the same modules
// the chapters use; the only thing this file adds is whose turn it is, a
// short pause so the opponent doesn't reply instantly, and enough history to
// take a move back.

import { notifyMoveResult } from "./audio";
import { renderGoBoard } from "./go-board";
import { createBoard, placeStone, type Board, type Point, type Stone } from "./go-rules";
import { scoreBoard } from "./go-scoring";
import { KOMI } from "./lesson-scoring";
import { chooseBotMove } from "./practice-bot";

export const BOARD_SIZE = 19;

export interface FreePlayElements {
  boardEl: HTMLElement | null;
  statusEl: HTMLElement | null;
  resultEl: HTMLElement | null;
  passButton: HTMLButtonElement | null;
  undoButton: HTMLButtonElement | null;
  newGameButton: HTMLButtonElement | null;
  colourInputs: HTMLInputElement[];
}

export interface FreePlayOptions {
  rng?: () => number;
  /** How the opponent's pause is arranged. Replaced in tests to run at once. */
  scheduleReply?: (run: () => void, delayMs: number) => void;
}

interface Snapshot {
  board: Board;
  koBoard: Board | null;
  toMove: Stone;
  consecutivePasses: number;
}

const THINKING_MIN_MS = 300;
const THINKING_RANGE_MS = 400;

function other(colour: Stone): Stone {
  return colour === "black" ? "white" : "black";
}

/** Wires up free play against the given elements. Exported (rather than run
 * only as a side effect of import) so it can be driven from a detached
 * document in tests. */
export function mount(elements: FreePlayElements, options: FreePlayOptions = {}): void {
  const { boardEl, statusEl, resultEl, passButton, undoButton, newGameButton, colourInputs } = elements;
  const { rng = Math.random, scheduleReply = (run, delayMs) => setTimeout(run, delayMs) } = options;

  let board: Board = createBoard(BOARD_SIZE);
  let humanColour: Stone = "black";
  let toMove: Stone = "black";
  // Simple ko, exactly as the lessons use it: the position as it stood before
  // the opponent's last move, handed straight to placeStone.
  let koBoard: Board | null = null;
  let consecutivePasses = 0;
  let history: Snapshot[] = [];
  let thinking = false;
  let finished = false;
  // Bumped on every new game so a pending reply from the previous one, which
  // has already been scheduled and can't be recalled, lands harmlessly.
  let generation = 0;

  function snapshot(): Snapshot {
    return { board, koBoard, toMove, consecutivePasses };
  }

  function restore(state: Snapshot): void {
    board = state.board;
    koBoard = state.koBoard;
    toMove = state.toMove;
    consecutivePasses = state.consecutivePasses;
    finished = false;
  }

  function emptyPoints(): Point[] {
    const points: Point[] = [];
    for (let row = 0; row < board.size; row++) {
      for (let col = 0; col < board.size; col++) {
        if (board.cells[row][col] === null) points.push({ row, col });
      }
    }
    return points;
  }

  function humanCanMove(): boolean {
    return !finished && !thinking && toMove === humanColour;
  }

  function statusText(): string {
    if (finished) return "The game is over.";
    if (thinking) return "Opponent is thinking…";
    return `Your move — you are ${humanColour === "black" ? "Black" : "White"}.`;
  }

  function resultText(): string {
    if (!finished) return "";
    const score = scoreBoard(board, KOMI);
    const winner =
      score.winner === "tie"
        ? "The score is level."
        : `${score.winner === "black" ? "Black" : "White"} leads by ${score.margin}.`;
    return (
      `Both players passed, so the practice game is complete. Counting the board as it stands: ` +
      `Black ${score.blackScore}, White ${score.whiteScore} (komi ${KOMI} included). ${winner} ` +
      `This is a raw count only — it assumes every stone on the board is alive, which a real result ` +
      `would settle between the players first.`
    );
  }

  function render(): void {
    if (!boardEl) return;

    renderGoBoard(boardEl, {
      board,
      interactive: humanCanMove() ? emptyPoints() : [],
      onPointActivate: (point) => handleHumanMove(point),
    });

    setText(statusEl, statusText());
    setText(resultEl, resultText());
    if (passButton) passButton.disabled = !humanCanMove();
    if (undoButton) undoButton.disabled = thinking || history.length === 0;
    for (const input of colourInputs) input.disabled = thinking;
  }

  function handleHumanMove(point: Point): void {
    if (!humanCanMove()) return;
    const result = placeStone(board, point, humanColour, koBoard ?? undefined);
    notifyMoveResult(result);
    if (!result.ok) return;

    history.push(snapshot());
    koBoard = board;
    board = result.board;
    consecutivePasses = 0;
    toMove = other(humanColour);
    startReply();
  }

  function handleHumanPass(): void {
    if (!humanCanMove()) return;
    history.push(snapshot());
    consecutivePasses += 1;
    toMove = other(humanColour);
    if (consecutivePasses >= 2) {
      finished = true;
      render();
      return;
    }
    startReply();
  }

  /** Hands the turn over, shows that the opponent is thinking, and arranges
   * for its move to land after a beat rather than instantly. */
  function startReply(): void {
    thinking = true;
    render();

    const current = ++generation;
    const delay = THINKING_MIN_MS + Math.floor(rng() * THINKING_RANGE_MS);
    scheduleReply(() => {
      if (current !== generation) return;
      playBotMove();
    }, delay);
  }

  function playBotMove(): void {
    const botColour = other(humanColour);
    const chosen = chooseBotMove({
      board,
      colour: botColour,
      koBoard,
      opponentPassed: consecutivePasses > 0,
      rng,
    });

    if (chosen === "pass") {
      consecutivePasses += 1;
    } else {
      const result = placeStone(board, chosen, botColour, koBoard ?? undefined);
      notifyMoveResult(result);
      if (result.ok) {
        history.push({ board, koBoard, toMove: botColour, consecutivePasses });
        koBoard = board;
        board = result.board;
        consecutivePasses = 0;
      } else {
        // The bot only ever offers moves it has already validated, so a
        // refusal here means the position moved under it: treat it as a pass
        // rather than losing the turn entirely.
        consecutivePasses += 1;
      }
    }

    thinking = false;
    toMove = humanColour;
    if (consecutivePasses >= 2) finished = true;
    render();
  }

  function undo(): void {
    if (thinking || history.length === 0) return;
    // One click should hand the board back to the player, so wind back past
    // the opponent's reply as well as the move that prompted it.
    do {
      restore(history.pop() as Snapshot);
    } while (history.length > 0 && toMove !== humanColour);
    generation++;
    render();
  }

  function newGame(colour: Stone): void {
    generation++;
    humanColour = colour;
    board = createBoard(BOARD_SIZE);
    toMove = "black";
    koBoard = null;
    consecutivePasses = 0;
    history = [];
    thinking = false;
    finished = false;
    if (humanColour === "white") startReply();
    else render();
  }

  passButton?.addEventListener("click", () => handleHumanPass());
  undoButton?.addEventListener("click", () => undo());
  newGameButton?.addEventListener("click", () => newGame(humanColour));
  for (const input of colourInputs) {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      newGame(input.value === "white" ? "white" : "black");
    });
  }

  render();
}

function setText(element: HTMLElement | null, text: string): void {
  if (element) element.textContent = text;
}

if (typeof document !== "undefined") {
  mount({
    boardEl: document.querySelector<HTMLDivElement>("#board"),
    statusEl: document.querySelector<HTMLParagraphElement>("#free-play-status"),
    resultEl: document.querySelector<HTMLParagraphElement>("#free-play-result"),
    passButton: document.querySelector<HTMLButtonElement>("#free-play-pass"),
    undoButton: document.querySelector<HTMLButtonElement>("#free-play-undo"),
    newGameButton: document.querySelector<HTMLButtonElement>("#free-play-new"),
    colourInputs: [...document.querySelectorAll<HTMLInputElement>('input[name="free-play-colour"]')],
  });
}
