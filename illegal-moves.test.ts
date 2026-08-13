// Behaviour tests for Lesson 4's DOM wiring: mount() takes plain element
// references, so a detached jsdom document stands in for the real page.
// These assert on rendered state (text, classes, which points exist) rather
// than snapshotting markup, so they survive incidental styling changes.

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type LessonElements } from "./illegal-moves";

function setUp(): { doc: Document; window: JSDOM["window"] } {
  const dom = new JSDOM(
    `<!doctype html><body>
      <div id="board"></div>
      <p id="stage-instruction"></p>
      <p id="lesson-feedback"></p>
      <button id="lesson-next"></button>
      <button id="lesson-reset"></button>
    </body>`,
  );
  const doc = dom.window.document;
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", dom.window);

  const elements: LessonElements = {
    boardEl: doc.querySelector("#board"),
    instructionEl: doc.querySelector("#stage-instruction"),
    feedbackEl: doc.querySelector("#lesson-feedback"),
    nextButton: doc.querySelector<HTMLButtonElement>("#lesson-next"),
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

function feedback(doc: Document): string {
  return doc.querySelector("#lesson-feedback")?.textContent ?? "";
}

function instruction(doc: Document): string {
  return doc.querySelector("#stage-instruction")?.textContent ?? "";
}

function nextButton(doc: Document): HTMLButtonElement {
  return doc.querySelector("#lesson-next") as HTMLButtonElement;
}

function stoneClass(doc: Document, row: number, col: number, colour: "black" | "white"): boolean {
  return (
    doc.querySelector(`circle.go-board-point[cx="${col}"][cy="${row}"]`)?.classList.contains(
      `go-board-point-${colour}`,
    ) ?? false
  );
}

const SUICIDE_TARGET: [number, number] = [4, 4];
const SUICIDE_WHITE: Array<[number, number]> = [
  [3, 4],
  [5, 4],
  [4, 3],
  [4, 5],
];
const CAPTURE_TARGET: [number, number] = [0, 0];
const CAPTURE_WHITE: Array<[number, number]> = [
  [1, 0],
  [0, 1],
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Lesson 4, example 1: pure suicide", () => {
  it("starts unsolved, with the surrounded point looking like an ordinary empty intersection", () => {
    const { doc } = setUp();
    expect(feedback(doc)).toBe("Nothing has been played there yet.");
    expect(instruction(doc)).toContain("Example 1 of 2");
    expect(doc.querySelectorAll(".go-board-highlight")).toHaveLength(0);
    expect(stoneClass(doc, ...SUICIDE_TARGET, "black")).toBe(false);
    expect(stoneClass(doc, ...SUICIDE_TARGET, "white")).toBe(false);
  });

  it("does not reveal the answer before the learner attempts it: no highlight, no Next button", () => {
    const { doc } = setUp();
    expect(doc.querySelectorAll(".go-board-highlight")).toHaveLength(0);
    expect(nextButton(doc).hidden).toBe(true);
  });

  it("clicking a surrounding White stone inspects its group instead of attempting a move", () => {
    const { doc, window } = setUp();
    click(doc, window, ...SUICIDE_WHITE[0]);
    expect(feedback(doc)).toBe("4 liberties remaining.");
    // Still untouched: inspecting a stone is not a move attempt.
    expect(stoneClass(doc, ...SUICIDE_TARGET, "black")).toBe(false);
  });

  it("rejects the suicide attempt, leaves the board unchanged, and gives concise text feedback", () => {
    const { doc, window } = setUp();
    click(doc, window, ...SUICIDE_TARGET);

    expect(feedback(doc)).toBe("That move would leave your stone with no liberties.");
    expect(stoneClass(doc, ...SUICIDE_TARGET, "black")).toBe(false);
    for (const [row, col] of SUICIDE_WHITE) {
      expect(stoneClass(doc, row, col, "white")).toBe(true);
    }
  });

  it("never renders a blocker, overlay, or disabled marker on the rejected point", () => {
    const { doc, window } = setUp();
    click(doc, window, ...SUICIDE_TARGET);

    const board = doc.querySelector("#board");
    const suspicious = board?.querySelectorAll(
      '[class*="block" i], [class*="illegal" i], [class*="warning" i], [class*="overlay" i], [class*="disabled" i], [class*="cross" i]',
    );
    expect(suspicious?.length ?? 0).toBe(0);
  });

  it("reveals Next only after the learner has actually attempted the move", () => {
    const { doc, window } = setUp();
    expect(nextButton(doc).hidden).toBe(true);

    click(doc, window, ...SUICIDE_TARGET);
    expect(nextButton(doc).hidden).toBe(false);
    expect(nextButton(doc).textContent).toBe("Next example");
  });
});

describe("Lesson 4, example 2: the capture exception", () => {
  function advanceToExample2(doc: Document, window: JSDOM["window"]): void {
    click(doc, window, ...SUICIDE_TARGET);
    nextButton(doc).click();
  }

  it("starts unsolved, with White, Black, and the target point as they were left by example 1", () => {
    const { doc, window } = setUp();
    advanceToExample2(doc, window);

    expect(instruction(doc)).toContain("Example 2 of 2");
    expect(stoneClass(doc, ...CAPTURE_TARGET, "black")).toBe(false);
    for (const [row, col] of CAPTURE_WHITE) {
      expect(stoneClass(doc, row, col, "white")).toBe(true);
    }
    expect(doc.querySelectorAll(".go-board-highlight")).toHaveLength(0);
  });

  it("plays the capturing move: White is removed, Black lands and stays", () => {
    const { doc, window } = setUp();
    advanceToExample2(doc, window);

    click(doc, window, ...CAPTURE_TARGET);

    expect(feedback(doc)).toBe(
      "Normally this point would have no liberties, but the move captures White first, so it is legal.",
    );
    expect(stoneClass(doc, ...CAPTURE_TARGET, "black")).toBe(true);
    for (const [row, col] of CAPTURE_WHITE) {
      expect(stoneClass(doc, row, col, "white")).toBe(false);
      expect(stoneClass(doc, row, col, "black")).toBe(false);
    }
  });

  it("offers no Next button after the last example", () => {
    const { doc, window } = setUp();
    advanceToExample2(doc, window);
    click(doc, window, ...CAPTURE_TARGET);

    expect(nextButton(doc).hidden).toBe(true);
  });
});

describe("Lesson 4 is registered separately from Lessons 1-3", () => {
  it("mounts its own board independent of any other lesson module", () => {
    const { doc } = setUp();
    // Sanity check this is Lesson 4's own suicide board, not another
    // lesson's leftover state: exactly the four White stones, nothing else.
    const whiteCount = doc.querySelectorAll("circle.go-board-point-white").length;
    const blackCount = doc.querySelectorAll("circle.go-board-point-black").length;
    expect(whiteCount).toBe(4);
    expect(blackCount).toBe(0);
  });
});
