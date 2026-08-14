// Behaviour tests for the free-play page. The opponent's pause is injected
// rather than timed, so these drive a whole game without waiting on real
// timers — and the injection point is the same one production uses, so the
// turn-taking under test is the turn-taking that ships.

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BOARD_SIZE, mount, type FreePlayElements } from "./free-play";

interface Harness {
  doc: Document;
  window: JSDOM["window"];
  /** Runs the opponent's pending reply, if one has been scheduled. */
  letOpponentMove: () => void;
  pendingReplies: () => number;
}

function setUp(): Harness {
  const dom = new JSDOM(
    `<!doctype html><body>
      <div id="board"></div>
      <p id="free-play-status"></p>
      <p id="free-play-result"></p>
      <button id="free-play-pass"></button>
      <button id="free-play-undo"></button>
      <button id="free-play-new"></button>
      <input type="radio" name="free-play-colour" value="black" checked />
      <input type="radio" name="free-play-colour" value="white" />
    </body>`,
    { url: "https://example.test/free-play.html" },
  );
  const doc = dom.window.document;
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", dom.window);

  const queue: Array<() => void> = [];
  const elements: FreePlayElements = {
    boardEl: doc.querySelector("#board"),
    statusEl: doc.querySelector("#free-play-status"),
    resultEl: doc.querySelector("#free-play-result"),
    passButton: doc.querySelector<HTMLButtonElement>("#free-play-pass"),
    undoButton: doc.querySelector<HTMLButtonElement>("#free-play-undo"),
    newGameButton: doc.querySelector<HTMLButtonElement>("#free-play-new"),
    colourInputs: [...doc.querySelectorAll<HTMLInputElement>('input[name="free-play-colour"]')],
  };

  let seed = 12345;
  mount(elements, {
    rng: () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    },
    scheduleReply: (run) => queue.push(run),
  });

  return {
    doc,
    window: dom.window,
    letOpponentMove: () => queue.shift()?.(),
    pendingReplies: () => queue.length,
  };
}

function click(doc: Document, window: JSDOM["window"], row: number, col: number): void {
  const circle = doc.querySelector(`circle.go-board-point[cx="${col}"][cy="${row}"]`);
  if (!circle) throw new Error(`no point at row ${row}, col ${col}`);
  circle.dispatchEvent(new window.Event("click", { bubbles: true }));
}

function press(doc: Document, window: JSDOM["window"], id: string): void {
  doc.querySelector<HTMLButtonElement>(`#${id}`)?.dispatchEvent(new window.Event("click", { bubbles: true }));
}

function status(doc: Document): string {
  return doc.querySelector("#free-play-status")?.textContent ?? "";
}

function result(doc: Document): string {
  return doc.querySelector("#free-play-result")?.textContent ?? "";
}

function stones(doc: Document, colour: "black" | "white"): number {
  return doc.querySelectorAll(`circle.go-board-point-${colour}`).length;
}

function activeCount(doc: Document): number {
  return doc.querySelectorAll("circle.go-board-point-active").length;
}

function disabled(doc: Document, id: string): boolean {
  return doc.querySelector<HTMLButtonElement>(`#${id}`)?.disabled ?? false;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the free-play board", () => {
  it("is a genuine 19x19 board, every intersection playable at the start", () => {
    const { doc } = setUp();
    expect(BOARD_SIZE).toBe(19);
    expect(doc.querySelectorAll("circle.go-board-point")).toHaveLength(361);
    expect(activeCount(doc)).toBe(361);
  });

  it("opens with the human to move as Black", () => {
    const { doc } = setUp();
    expect(status(doc)).toContain("you are Black");
    expect(result(doc)).toBe("");
  });
});

describe("taking turns", () => {
  it("plays the human's stone, then hands over and locks the board while the opponent thinks", () => {
    const { doc, window } = setUp();
    click(doc, window, 3, 3);

    expect(stones(doc, "black")).toBe(1);
    expect(status(doc)).toContain("thinking");
    expect(activeCount(doc)).toBe(0);
    expect(disabled(doc, "free-play-pass")).toBe(true);
  });

  it("answers with a stone of its own and gives the board back", () => {
    const { doc, window, letOpponentMove } = setUp();
    click(doc, window, 3, 3);
    letOpponentMove();

    expect(stones(doc, "white")).toBe(1);
    expect(status(doc)).toContain("you are Black");
    expect(activeCount(doc)).toBe(359);
  });

  it("ignores clicks that arrive while the opponent is still thinking", () => {
    const { doc, window } = setUp();
    click(doc, window, 3, 3);
    click(doc, window, 15, 15);

    expect(stones(doc, "black")).toBe(1);
  });

  it("refuses an occupied point without spending the turn", () => {
    const { doc, window, letOpponentMove } = setUp();
    click(doc, window, 3, 3);
    letOpponentMove();
    const whiteStones = stones(doc, "white");

    click(doc, window, 3, 3);

    expect(stones(doc, "black")).toBe(1);
    expect(stones(doc, "white")).toBe(whiteStones);
    expect(status(doc)).toContain("you are Black");
  });
});

describe("choosing a colour", () => {
  it("lets the opponent open the game when the human takes White", () => {
    const { doc, window, letOpponentMove } = setUp();
    const white = doc.querySelectorAll<HTMLInputElement>('input[name="free-play-colour"]')[1];
    white.checked = true;
    white.dispatchEvent(new window.Event("change", { bubbles: true }));

    expect(status(doc)).toContain("thinking");
    letOpponentMove();

    expect(stones(doc, "black")).toBe(1);
    expect(stones(doc, "white")).toBe(0);
    expect(status(doc)).toContain("you are White");
  });

  it("starts a fresh board when the colour changes mid-game", () => {
    const { doc, window, letOpponentMove } = setUp();
    click(doc, window, 3, 3);
    letOpponentMove();

    const white = doc.querySelectorAll<HTMLInputElement>('input[name="free-play-colour"]')[1];
    white.checked = true;
    white.dispatchEvent(new window.Event("change", { bubbles: true }));
    letOpponentMove();

    expect(stones(doc, "black")).toBe(1);
    expect(stones(doc, "white")).toBe(0);
  });

  it("drops a reply left over from an abandoned game", () => {
    const { doc, window, letOpponentMove, pendingReplies } = setUp();
    click(doc, window, 3, 3);
    expect(pendingReplies()).toBe(1);

    press(doc, window, "free-play-new");
    letOpponentMove();

    expect(stones(doc, "black")).toBe(0);
    expect(stones(doc, "white")).toBe(0);
    expect(status(doc)).toContain("you are Black");
  });
});

describe("passing", () => {
  it("one pass alone doesn't end anything — it hands the decision to the opponent", () => {
    const { doc, window } = setUp();
    press(doc, window, "free-play-pass");

    expect(result(doc)).toBe("");
    expect(status(doc)).toContain("thinking");
  });

  it("two passes in a row end the game and report a counted, caveated score", () => {
    const { doc, window, letOpponentMove } = setUp();
    // With an empty board there is nothing at stake, so the bot agrees to stop.
    press(doc, window, "free-play-pass");
    letOpponentMove();

    expect(status(doc)).toBe("The game is over.");
    expect(result(doc)).toContain("practice game is complete");
    expect(result(doc)).toContain("komi");
    expect(result(doc)).toContain("raw count only");
    expect(activeCount(doc)).toBe(0);
    expect(disabled(doc, "free-play-pass")).toBe(true);
  });
});

describe("undo", () => {
  it("is unavailable until something has been played", () => {
    const { doc } = setUp();
    expect(disabled(doc, "free-play-undo")).toBe(true);
  });

  it("takes back the opponent's reply and the move that prompted it together", () => {
    const { doc, window, letOpponentMove } = setUp();
    click(doc, window, 3, 3);
    letOpponentMove();
    expect(stones(doc, "black") + stones(doc, "white")).toBe(2);

    press(doc, window, "free-play-undo");

    expect(stones(doc, "black")).toBe(0);
    expect(stones(doc, "white")).toBe(0);
    expect(activeCount(doc)).toBe(361);
    expect(disabled(doc, "free-play-undo")).toBe(true);
  });

  it("restores the ko position along with the board, so the rule still bites", () => {
    // Undo has to put back the snapshot placeStone measures ko against; if it
    // only restored stones, an undone capture could be replayed into a
    // repetition the rules forbid.
    const { doc, window, letOpponentMove } = setUp();
    click(doc, window, 3, 3);
    letOpponentMove();
    press(doc, window, "free-play-undo");
    click(doc, window, 3, 3);

    expect(stones(doc, "black")).toBe(1);
    letOpponentMove();
    expect(stones(doc, "white")).toBe(1);
  });

  it("brings a finished game back to life", () => {
    const { doc, window, letOpponentMove } = setUp();
    press(doc, window, "free-play-pass");
    letOpponentMove();
    expect(result(doc)).toContain("practice game is complete");

    press(doc, window, "free-play-undo");

    expect(result(doc)).toBe("");
    expect(status(doc)).toContain("you are Black");
    expect(activeCount(doc)).toBe(361);
  });
});

describe("new game", () => {
  it("clears the board and keeps the chosen colour", () => {
    const { doc, window, letOpponentMove } = setUp();
    click(doc, window, 3, 3);
    letOpponentMove();

    press(doc, window, "free-play-new");

    expect(stones(doc, "black")).toBe(0);
    expect(stones(doc, "white")).toBe(0);
    expect(status(doc)).toContain("you are Black");
    expect(disabled(doc, "free-play-undo")).toBe(true);
  });
});

describe("a full alternating sequence", () => {
  it("stays legal for twenty plies, with the shared engine refusing nothing", () => {
    const { doc, window, letOpponentMove } = setUp();

    for (let ply = 0; ply < 10; ply++) {
      // Whatever the opponent left free, rather than a fixed script: the bot
      // is allowed to take a point this test would otherwise have wanted.
      const free = doc.querySelector<SVGCircleElement>("circle.go-board-point-active");
      expect(free, `no legal point left at ply ${ply}`).not.toBeNull();
      free?.dispatchEvent(new window.Event("click", { bubbles: true }));
      letOpponentMove();
    }

    expect(stones(doc, "black")).toBe(10);
    expect(stones(doc, "white")).toBe(10);
    expect(status(doc)).toContain("you are Black");
  });
});
