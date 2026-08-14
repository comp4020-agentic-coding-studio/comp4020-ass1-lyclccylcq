// Behaviour tests for Lesson 5's DOM wiring: mount() takes plain element
// references, so a detached jsdom document stands in for the real page.
// These assert on rendered state (text, classes, which points exist) rather
// than snapshotting markup, so they survive incidental styling changes.
//
// The lesson is a full ko fight, so most of these walk it move by move. The
// helpers below name each phase once; the tests then say what should be true
// at that phase rather than repeating the click sequence.

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type LessonElements } from "./ko";
import { isChapterComplete } from "./lesson-progress";

function setUp(): { doc: Document; window: JSDOM["window"] } {
  const dom = new JSDOM(
    `<!doctype html><body>
      <div id="board"></div>
      <p id="stage-instruction"></p>
      <p id="lesson-feedback"></p>
      <button id="lesson-replay" hidden></button>
      <button id="lesson-reset"></button>
    </body>`,
    // A real origin, so lesson-progress.ts's localStorage guard sees working
    // storage instead of the SecurityError an opaque origin raises.
    { url: "https://example.test/lessons/ko.html" },
  );
  const doc = dom.window.document;
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", dom.window);

  const elements: LessonElements = {
    boardEl: doc.querySelector("#board"),
    instructionEl: doc.querySelector("#stage-instruction"),
    feedbackEl: doc.querySelector("#lesson-feedback"),
    replayButton: doc.querySelector<HTMLButtonElement>("#lesson-replay"),
    resetButton: doc.querySelector<HTMLButtonElement>("#lesson-reset"),
  };

  mount(elements);
  return { doc, window: dom.window };
}

function click(doc: Document, window: JSDOM["window"], row: number, col: number): void {
  const circle = doc.querySelector(`circle.go-board-point[cx="${col}"][cy="${row}"]`);
  if (!circle) throw new Error(`no clickable point at row ${row}, col ${col}`);
  circle.dispatchEvent(new window.Event("click", { bubbles: true }));
}

function press(doc: Document, window: JSDOM["window"], id: string): void {
  doc.querySelector<HTMLButtonElement>(`#${id}`)?.dispatchEvent(new window.Event("click", { bubbles: true }));
}

function feedback(doc: Document): string {
  return doc.querySelector("#lesson-feedback")?.textContent ?? "";
}

function instruction(doc: Document): string {
  return doc.querySelector("#stage-instruction")?.textContent ?? "";
}

function stoneClass(doc: Document, row: number, col: number, colour: "black" | "white"): boolean {
  return (
    doc.querySelector(`circle.go-board-point[cx="${col}"][cy="${row}"]`)?.classList.contains(
      `go-board-point-${colour}`,
    ) ?? false
  );
}

function isEmpty(doc: Document, row: number, col: number): boolean {
  return !stoneClass(doc, row, col, "black") && !stoneClass(doc, row, col, "white");
}

function lastMoveAt(doc: Document): string | null {
  const dot = doc.querySelector("circle.go-board-last-move");
  return dot ? `${dot.getAttribute("cy")},${dot.getAttribute("cx")}` : null;
}

function isActive(doc: Document, row: number, col: number): boolean {
  return (
    doc.querySelector(`circle.go-board-point[cx="${col}"][cy="${row}"]`)?.classList.contains(
      "go-board-point-active",
    ) ?? false
  );
}

const KO_POINT: [number, number] = [4, 4];
const CAPTURE_POINT: [number, number] = [5, 4];
const PLAYER_THREAT: [number, number] = [1, 1];
const BOT_ANSWER: [number, number] = [0, 2];
const BOT_THREAT: [number, number] = [7, 1];
const DEFEND_POINT: [number, number] = [6, 0];
const IDLE_POINT: [number, number] = [0, 7];
const PLAYER_GROUP: Array<[number, number]> = [
  [7, 0],
  [8, 0],
];

/** Phase 1: the learner takes the ko with Black. */
function takeKo(doc: Document, window: JSDOM["window"]): void {
  click(doc, window, ...CAPTURE_POINT);
}

/** Phase 2: the learner tries to take it straight back, and is refused. */
function tryImmediateRecapture(doc: Document, window: JSDOM["window"]): void {
  takeKo(doc, window);
  click(doc, window, ...KO_POINT);
}

/** Phases 3-4: the learner threatens, the computer answers. */
function playThreat(doc: Document, window: JSDOM["window"]): void {
  tryImmediateRecapture(doc, window);
  click(doc, window, ...PLAYER_THREAT);
}

/** Phases 5-6: the learner retakes, the computer threatens back. */
function reachDecision(doc: Document, window: JSDOM["window"]): void {
  playThreat(doc, window);
  click(doc, window, ...KO_POINT);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Lesson 5 starts unsolved", () => {
  it("shows White's stone with one liberty, and the ko point looks like an ordinary empty intersection", () => {
    const { doc } = setUp();
    expect(instruction(doc)).toContain("Play Black to capture it");
    expect(stoneClass(doc, ...KO_POINT, "white")).toBe(true);
    expect(isEmpty(doc, ...CAPTURE_POINT)).toBe(true);
    expect(doc.querySelectorAll(".go-board-highlight")).toHaveLength(0);
  });

  it("opens with no last-move marker, because no move has been played yet", () => {
    const { doc } = setUp();
    expect(lastMoveAt(doc)).toBeNull();
  });

  it("does not reveal the ko rule before the learner attempts anything", () => {
    const { doc } = setUp();
    expect(feedback(doc)).toBe("");
    expect(instruction(doc)).not.toContain("Ko");
  });

  it("sets up both tactical corners without either being in danger yet", () => {
    const { doc } = setUp();
    for (const [row, col] of PLAYER_GROUP) expect(stoneClass(doc, row, col, "white")).toBe(true);
    expect(isEmpty(doc, ...PLAYER_THREAT)).toBe(true);
    expect(isEmpty(doc, ...BOT_THREAT)).toBe(true);
    expect(isEmpty(doc, ...DEFEND_POINT)).toBe(true);
  });
});

describe("phase 1: taking the ko", () => {
  it("captures White normally, leaving the ko point a plain empty intersection", () => {
    const { doc, window } = setUp();
    takeKo(doc, window);

    expect(isEmpty(doc, ...KO_POINT)).toBe(true);
    expect(stoneClass(doc, ...CAPTURE_POINT, "black")).toBe(true);
    expect(instruction(doc)).toContain("try playing White straight back at that same point");
  });

  it("marks the capturing stone as the last move", () => {
    const { doc, window } = setUp();
    takeKo(doc, window);
    expect(lastMoveAt(doc)).toBe("5,4");
  });
});

describe("phase 2: the immediate recapture is refused", () => {
  it("rejects it and leaves the board exactly as it was", () => {
    const { doc, window } = setUp();
    tryImmediateRecapture(doc, window);

    expect(feedback(doc)).toBe("You cannot immediately recreate the previous board position. This is called Ko.");
    expect(isEmpty(doc, ...KO_POINT)).toBe(true);
    expect(stoneClass(doc, ...CAPTURE_POINT, "black")).toBe(true);
  });

  it("does not move the last-move marker, because no stone was played", () => {
    const { doc, window } = setUp();
    tryImmediateRecapture(doc, window);
    expect(lastMoveAt(doc)).toBe("5,4");
  });

  it("never renders a blocker, overlay, or disabled marker on the rejected point", () => {
    const { doc, window } = setUp();
    tryImmediateRecapture(doc, window);

    const board = doc.querySelector("#board");
    const suspicious = board?.querySelectorAll(
      '[class*="block" i], [class*="illegal" i], [class*="warning" i], [class*="overlay" i], [class*="disabled" i], [class*="cross" i]',
    );
    expect(suspicious?.length ?? 0).toBe(0);
  });

  it("then asks for a ko threat, without pointing at the answer", () => {
    const { doc, window } = setUp();
    tryImmediateRecapture(doc, window);

    expect(instruction(doc)).toContain("劫材 · Ko threat");
    expect(doc.querySelectorAll(".go-board-highlight")).toHaveLength(0);
    expect([...doc.querySelectorAll("circle.go-board-point-active")].length).toBeGreaterThan(1);
  });
});

describe("phase 3-4: the learner's threat and the computer's answer", () => {
  it("treats a legal but idle move as a retry, not as progress", () => {
    const { doc, window } = setUp();
    tryImmediateRecapture(doc, window);

    click(doc, window, ...IDLE_POINT);

    expect(isEmpty(doc, ...IDLE_POINT)).toBe(true);
    expect(feedback(doc)).toContain("threatens nothing");
    expect(lastMoveAt(doc)).toBe("5,4");
    expect(isActive(doc, ...PLAYER_THREAT)).toBe(true);
  });

  it("plays the threat and the computer's answer together, in one click", () => {
    const { doc, window } = setUp();
    playThreat(doc, window);

    expect(stoneClass(doc, ...PLAYER_THREAT, "white")).toBe(true);
    expect(stoneClass(doc, ...BOT_ANSWER, "black")).toBe(true);
    expect(feedback(doc)).toContain("Your opponent answers the threat");
  });

  it("leaves the marker on the computer's answer, the latest stone played", () => {
    const { doc, window } = setUp();
    playThreat(doc, window);
    expect(lastMoveAt(doc)).toBe("0,2");
  });
});

describe("phase 5-6: the retake, and the computer's own threat", () => {
  it("lets the learner retake the ko now that moves have intervened", () => {
    const { doc, window } = setUp();
    reachDecision(doc, window);

    expect(stoneClass(doc, ...KO_POINT, "white")).toBe(true);
    expect(isEmpty(doc, ...CAPTURE_POINT)).toBe(true);
    expect(feedback(doc)).toContain("Ko retaken");
  });

  it("answers the retake with a ko threat of its own against the learner's group", () => {
    const { doc, window } = setUp();
    reachDecision(doc, window);

    expect(stoneClass(doc, ...BOT_THREAT, "black")).toBe(true);
    expect(lastMoveAt(doc)).toBe("7,1");
    // The threatened stones are still on the board — the threat is a threat,
    // not yet a capture.
    for (const [row, col] of PLAYER_GROUP) expect(stoneClass(doc, row, col, "white")).toBe(true);
  });

  it("offers exactly the two strategic replies, and names neither as correct", () => {
    const { doc, window } = setUp();
    reachDecision(doc, window);

    expect(isActive(doc, ...DEFEND_POINT)).toBe(true);
    expect(isActive(doc, ...CAPTURE_POINT)).toBe(true);
    expect(doc.querySelectorAll("circle.go-board-point-active")).toHaveLength(2);
    expect(instruction(doc)).toContain("Both are real choices");
  });
});

describe("branch A: the learner answers the threat", () => {
  function answerThreat(doc: Document, window: JSDOM["window"]): void {
    reachDecision(doc, window);
    click(doc, window, ...DEFEND_POINT);
  }

  it("saves the threatened stones", () => {
    const { doc, window } = setUp();
    answerThreat(doc, window);

    expect(stoneClass(doc, ...DEFEND_POINT, "white")).toBe(true);
    for (const [row, col] of PLAYER_GROUP) expect(stoneClass(doc, row, col, "white")).toBe(true);
  });

  it("costs the learner the ko: the computer retakes it", () => {
    const { doc, window } = setUp();
    answerThreat(doc, window);

    expect(stoneClass(doc, ...CAPTURE_POINT, "black")).toBe(true);
    expect(isEmpty(doc, ...KO_POINT)).toBe(true);
    expect(lastMoveAt(doc)).toBe("5,4");
    expect(feedback(doc)).toContain("saved those stones");
    expect(feedback(doc)).toContain("retakes the ko");
  });

  it("ends with the trade-off explained rather than a verdict", () => {
    const { doc, window } = setUp();
    answerThreat(doc, window);

    expect(instruction(doc)).toContain("battle of priorities");
    expect(instruction(doc)).toContain("neither answer is always right");
    expect(doc.querySelectorAll("circle.go-board-point-active")).toHaveLength(0);
    expect(isChapterComplete("ko")).toBe(true);
  });
});

describe("branch B: the learner ignores the threat", () => {
  function ignoreThreat(doc: Document, window: JSDOM["window"]): void {
    reachDecision(doc, window);
    click(doc, window, ...CAPTURE_POINT);
  }

  it("settles the ko for good by filling it", () => {
    const { doc, window } = setUp();
    ignoreThreat(doc, window);

    expect(stoneClass(doc, ...CAPTURE_POINT, "white")).toBe(true);
    expect(stoneClass(doc, ...KO_POINT, "white")).toBe(true);
  });

  it("costs the threatened stones: the computer carries the threat out and captures them", () => {
    const { doc, window } = setUp();
    ignoreThreat(doc, window);

    for (const [row, col] of PLAYER_GROUP) expect(isEmpty(doc, row, col)).toBe(true);
    expect(stoneClass(doc, ...DEFEND_POINT, "black")).toBe(true);
    expect(lastMoveAt(doc)).toBe("6,0");
    expect(feedback(doc)).toContain("captured those two stones");
  });

  it("also reaches completion — ignoring a threat is a choice, not a mistake", () => {
    const { doc, window } = setUp();
    ignoreThreat(doc, window);

    expect(instruction(doc)).toContain("battle of priorities");
    expect(isChapterComplete("ko")).toBe(true);
  });
});

describe("exploring the other choice", () => {
  it("keeps the replay control hidden until a branch has been played", () => {
    const { doc, window } = setUp();
    expect(doc.querySelector<HTMLButtonElement>("#lesson-replay")?.hidden).toBe(true);

    reachDecision(doc, window);
    expect(doc.querySelector<HTMLButtonElement>("#lesson-replay")?.hidden).toBe(true);

    click(doc, window, ...DEFEND_POINT);
    expect(doc.querySelector<HTMLButtonElement>("#lesson-replay")?.hidden).toBe(false);
  });

  it("rewinds to the choice itself, not to the start of the lesson", () => {
    const { doc, window } = setUp();
    reachDecision(doc, window);
    click(doc, window, ...DEFEND_POINT);

    press(doc, window, "lesson-replay");

    // Back to the position right after the computer's threat.
    expect(stoneClass(doc, ...KO_POINT, "white")).toBe(true);
    expect(stoneClass(doc, ...BOT_THREAT, "black")).toBe(true);
    expect(isEmpty(doc, ...DEFEND_POINT)).toBe(true);
    expect(lastMoveAt(doc)).toBe("7,1");
    expect(doc.querySelectorAll("circle.go-board-point-active")).toHaveLength(2);
  });

  it("lets the learner play the branch they didn't take, reaching the opposite outcome", () => {
    const { doc, window } = setUp();
    reachDecision(doc, window);
    click(doc, window, ...DEFEND_POINT);
    press(doc, window, "lesson-replay");

    click(doc, window, ...CAPTURE_POINT);

    for (const [row, col] of PLAYER_GROUP) expect(isEmpty(doc, row, col)).toBe(true);
    expect(feedback(doc)).toContain("captured those two stones");
  });
});

describe("resetting the whole lesson", () => {
  it("returns to the opening position with no marker and nothing played", () => {
    const { doc, window } = setUp();
    reachDecision(doc, window);
    click(doc, window, ...CAPTURE_POINT);

    press(doc, window, "lesson-reset");

    expect(stoneClass(doc, ...KO_POINT, "white")).toBe(true);
    expect(isEmpty(doc, ...CAPTURE_POINT)).toBe(true);
    expect(isEmpty(doc, ...PLAYER_THREAT)).toBe(true);
    expect(isEmpty(doc, ...BOT_THREAT)).toBe(true);
    for (const [row, col] of PLAYER_GROUP) expect(stoneClass(doc, row, col, "white")).toBe(true);
    expect(lastMoveAt(doc)).toBeNull();
    expect(feedback(doc)).toBe("");
    expect(instruction(doc)).toContain("Play Black to capture it");
  });
});

describe("Lesson 5 is registered separately from the other lessons", () => {
  it("mounts its own board independent of any other lesson module", () => {
    const { doc } = setUp();
    // Four stones make the ko, one holds the computer's corner group down,
    // and two more are the learner's own group in the opposite corner.
    expect(doc.querySelectorAll("circle.go-board-point-white")).toHaveLength(7);
    expect(doc.querySelectorAll("circle.go-board-point-black")).toHaveLength(6);
  });
});
