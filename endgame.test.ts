// Behaviour tests for Lesson 6's DOM wiring: mount() takes plain element
// references, so a detached jsdom document stands in for the real page.
// The numbers in the feedback are the ones go-scoring.ts derives from the
// board, so these assert the relationships between them rather than the
// sentences that carry them — lesson-endgame.test.ts pins the exact figures.

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type LessonElements } from "./endgame";
import { isChapterComplete } from "./lesson-progress";

function setUp(): { doc: Document; window: JSDOM["window"] } {
  const dom = new JSDOM(
    `<!doctype html><body>
      <div id="board"></div>
      <p id="stage-instruction"></p>
      <p id="lesson-feedback"></p>
      <button id="lesson-pass" hidden></button>
      <button id="lesson-reset"></button>
    </body>`,
    // A real origin, so lesson-progress.ts's localStorage guard sees working
    // storage instead of the SecurityError an opaque origin raises.
    { url: "https://example.test/lessons/endgame.html" },
  );
  const doc = dom.window.document;
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", dom.window);

  const elements: LessonElements = {
    boardEl: doc.querySelector("#board"),
    instructionEl: doc.querySelector("#stage-instruction"),
    feedbackEl: doc.querySelector("#lesson-feedback"),
    passButton: doc.querySelector<HTMLButtonElement>("#lesson-pass"),
    resetButton: doc.querySelector<HTMLButtonElement>("#lesson-reset"),
  };

  mount(elements);
  return { doc, window: dom.window };
}

function click(doc: Document, window: JSDOM["window"], row: number, col: number): void {
  const circle = doc.querySelector(`circle.go-board-point[cx="${col}"][cy="${row}"]`);
  if (!circle) throw new Error(`no point at row ${row}, col ${col}`);
  circle.dispatchEvent(new window.Event("click", { bubbles: true }));
}

function clickButton(doc: Document, window: JSDOM["window"], id: string): void {
  doc.querySelector<HTMLButtonElement>(`#${id}`)?.dispatchEvent(new window.Event("click", { bubbles: true }));
}

function instruction(doc: Document): string {
  return doc.querySelector("#stage-instruction")?.textContent ?? "";
}

function feedback(doc: Document): string {
  return doc.querySelector("#lesson-feedback")?.textContent ?? "";
}

function stoneClass(doc: Document, row: number, col: number, colour: "black" | "white"): boolean {
  return (
    doc.querySelector(`circle.go-board-point[cx="${col}"][cy="${row}"]`)?.classList.contains(
      `go-board-point-${colour}`,
    ) ?? false
  );
}

function passHidden(doc: Document): boolean {
  return doc.querySelector<HTMLButtonElement>("#lesson-pass")?.hidden === true;
}

const SEAL_POINT: [number, number] = [0, 4];
const REDUCE_POINT: [number, number] = [3, 5];
const FINAL_POINT: [number, number] = [6, 5];
const IDLE_POINT: [number, number] = [4, 1];
const SUICIDE_POINT: [number, number] = [0, 8];

function playAllThree(doc: Document, window: JSDOM["window"]): void {
  click(doc, window, ...SEAL_POINT);
  click(doc, window, ...REDUCE_POINT);
  click(doc, window, ...FINAL_POINT);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Lesson 6 starts on the unfinished position", () => {
  it("asks for the boundary gap without marking it, and offers no pass yet", () => {
    const { doc } = setUp();
    expect(instruction(doc)).toContain("closes it");
    expect(doc.querySelectorAll(".go-board-highlight")).toHaveLength(0);
    expect(feedback(doc)).toBe("");
    expect(passHidden(doc)).toBe(true);
  });

  it("offers more than one playable point, so the answer isn't the only thing clickable", () => {
    const { doc } = setUp();
    expect([...doc.querySelectorAll("circle.go-board-point-active")].length).toBeGreaterThan(1);
  });
});

describe("a legal move that gains nothing", () => {
  it("is refused with an explanation and a retry, not counted as progress", () => {
    const { doc, window } = setUp();
    click(doc, window, ...IDLE_POINT);

    expect(stoneClass(doc, ...IDLE_POINT, "black")).toBe(false);
    expect(feedback(doc)).toContain("still being decided");
    expect(instruction(doc)).toContain("closes it");
  });

  it("still lets the learner find the real move afterwards", () => {
    const { doc, window } = setUp();
    click(doc, window, ...IDLE_POINT);
    click(doc, window, ...SEAL_POINT);

    expect(stoneClass(doc, ...SEAL_POINT, "black")).toBe(true);
  });
});

describe("walking into settled territory", () => {
  it("is rejected by the rules engine, and the lesson says why", () => {
    const { doc, window } = setUp();
    click(doc, window, ...SUICIDE_POINT);

    expect(stoneClass(doc, ...SUICIDE_POINT, "black")).toBe(false);
    expect(feedback(doc)).toContain("no liberties");
    expect(instruction(doc)).toContain("closes it");
  });
});

describe("the last-move marker", () => {
  function lastMoveAt(doc: Document): string | null {
    const dot = doc.querySelector("circle.go-board-last-move");
    return dot ? `${dot.getAttribute("cy")},${dot.getAttribute("cx")}` : null;
  }

  it("starts absent on the given position, then follows each move played", () => {
    const { doc, window } = setUp();
    expect(lastMoveAt(doc)).toBeNull();

    click(doc, window, ...SEAL_POINT);
    expect(lastMoveAt(doc)).toBe("0,4");

    click(doc, window, ...REDUCE_POINT);
    expect(lastMoveAt(doc)).toBe("3,5");
  });

  it("ignores moves the lesson turns down and moves the rules engine rejects", () => {
    const { doc, window } = setUp();
    click(doc, window, ...SEAL_POINT);

    click(doc, window, ...IDLE_POINT);
    expect(lastMoveAt(doc)).toBe("0,4");

    click(doc, window, ...SUICIDE_POINT);
    expect(lastMoveAt(doc)).toBe("0,4");
  });

  it("clears on reset", () => {
    const { doc, window } = setUp();
    click(doc, window, ...SEAL_POINT);
    clickButton(doc, window, "lesson-reset");
    expect(lastMoveAt(doc)).toBeNull();
  });
});

describe("the three moves in sequence", () => {
  it("sealing the wall reports the territory it just created", () => {
    const { doc, window } = setUp();
    click(doc, window, ...SEAL_POINT);

    expect(stoneClass(doc, ...SEAL_POINT, "black")).toBe(true);
    expect(feedback(doc)).toContain("0 points to 36");
    expect(instruction(doc)).toContain("bitten out of it");
  });

  it("accepts either contested point first, then asks for the other", () => {
    const { doc, window } = setUp();
    click(doc, window, ...SEAL_POINT);
    click(doc, window, ...FINAL_POINT);

    expect(stoneClass(doc, ...FINAL_POINT, "black")).toBe(true);
    expect(instruction(doc)).toContain("One point still belongs to neither player");

    click(doc, window, ...REDUCE_POINT);
    expect(stoneClass(doc, ...REDUCE_POINT, "black")).toBe(true);
  });

  it("reports the disputed points draining away as they are taken", () => {
    const { doc, window } = setUp();
    click(doc, window, ...SEAL_POINT);
    click(doc, window, ...REDUCE_POINT);
    expect(feedback(doc)).toContain("2 to 1");

    click(doc, window, ...FINAL_POINT);
    expect(feedback(doc)).toContain("0 points are");
  });

  it("offers the pass only once there is genuinely nothing left to play", () => {
    const { doc, window } = setUp();
    click(doc, window, ...SEAL_POINT);
    expect(passHidden(doc)).toBe(true);

    click(doc, window, ...REDUCE_POINT);
    click(doc, window, ...FINAL_POINT);
    expect(passHidden(doc)).toBe(false);
    expect(instruction(doc)).toContain("Pass");
  });
});

describe("ending the game", () => {
  it("answers the learner's pass with White's, and calls that the end", () => {
    const { doc, window } = setUp();
    playAllThree(doc, window);
    clickButton(doc, window, "lesson-pass");

    expect(feedback(doc)).toContain("White passed too");
    expect(instruction(doc)).toContain("Two passes in a row");
    expect(doc.querySelectorAll("circle.go-board-point-active")).toHaveLength(0);
    expect(passHidden(doc)).toBe(true);
  });

  it("marks the chapter done only once both players have passed", () => {
    const { doc, window } = setUp();
    playAllThree(doc, window);
    expect(isChapterComplete("endgame")).toBe(false);

    clickButton(doc, window, "lesson-pass");
    expect(isChapterComplete("endgame")).toBe(true);
  });

  it("leaves the stones exactly where they were, ready to be counted", () => {
    const { doc, window } = setUp();
    playAllThree(doc, window);
    clickButton(doc, window, "lesson-pass");

    expect(doc.querySelectorAll("circle.go-board-point-black")).toHaveLength(11);
    expect(doc.querySelectorAll("circle.go-board-point-white")).toHaveLength(11);
  });
});

describe("resetting the example", () => {
  it("returns to the opening position with the pass hidden again", () => {
    const { doc, window } = setUp();
    playAllThree(doc, window);
    clickButton(doc, window, "lesson-reset");

    expect(stoneClass(doc, ...SEAL_POINT, "black")).toBe(false);
    expect(stoneClass(doc, ...REDUCE_POINT, "black")).toBe(false);
    expect(feedback(doc)).toBe("");
    expect(passHidden(doc)).toBe(true);
    expect(instruction(doc)).toContain("closes it");
  });
});
