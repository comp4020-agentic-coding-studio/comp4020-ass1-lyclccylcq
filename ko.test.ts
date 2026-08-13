// Behaviour tests for Lesson 5's DOM wiring: mount() takes plain element
// references, so a detached jsdom document stands in for the real page.
// These assert on rendered state (text, classes, which points exist) rather
// than snapshotting markup, so they survive incidental styling changes.

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type LessonElements } from "./ko";

function setUp(): { doc: Document; window: JSDOM["window"] } {
  const dom = new JSDOM(
    `<!doctype html><body>
      <div id="board"></div>
      <p id="stage-instruction"></p>
      <p id="lesson-feedback"></p>
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

function stoneClass(doc: Document, row: number, col: number, colour: "black" | "white"): boolean {
  return (
    doc.querySelector(`circle.go-board-point[cx="${col}"][cy="${row}"]`)?.classList.contains(
      `go-board-point-${colour}`,
    ) ?? false
  );
}

const KO_POINT: [number, number] = [4, 4];
const CAPTURE_POINT: [number, number] = [5, 4];
const ELSEWHERE_POINT: [number, number] = [0, 8];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Lesson 5 starts unsolved", () => {
  it("shows White's stone with one liberty, and the ko point looks like an ordinary empty intersection", () => {
    const { doc } = setUp();
    expect(instruction(doc)).toContain("Play Black to capture it");
    expect(stoneClass(doc, ...KO_POINT, "white")).toBe(true);
    expect(stoneClass(doc, ...CAPTURE_POINT, "black")).toBe(false);
    expect(stoneClass(doc, ...CAPTURE_POINT, "white")).toBe(false);
    expect(doc.querySelectorAll(".go-board-highlight")).toHaveLength(0);
  });

  it("does not reveal the ko rule before the learner attempts anything", () => {
    const { doc } = setUp();
    expect(feedback(doc)).toBe("");
    expect(instruction(doc)).not.toContain("Ko");
  });
});

describe("the capturing move", () => {
  it("captures White normally, leaving the ko point a plain empty intersection", () => {
    const { doc, window } = setUp();
    click(doc, window, ...CAPTURE_POINT);

    expect(stoneClass(doc, ...KO_POINT, "white")).toBe(false);
    expect(stoneClass(doc, ...KO_POINT, "black")).toBe(false);
    expect(stoneClass(doc, ...CAPTURE_POINT, "black")).toBe(true);
    expect(instruction(doc)).toContain("Try immediately playing White back at that same point");
  });
});

describe("the blocked recapture", () => {
  function advanceToBlocked(doc: Document, window: JSDOM["window"]): void {
    click(doc, window, ...CAPTURE_POINT);
  }

  it("rejects the immediate recapture and leaves the board exactly as it was", () => {
    const { doc, window } = setUp();
    advanceToBlocked(doc, window);

    click(doc, window, ...KO_POINT);

    expect(feedback(doc)).toBe("You cannot immediately recreate the previous board position. This is called Ko.");
    expect(stoneClass(doc, ...KO_POINT, "white")).toBe(false);
    expect(stoneClass(doc, ...KO_POINT, "black")).toBe(false);
    expect(stoneClass(doc, ...CAPTURE_POINT, "black")).toBe(true);
  });

  it("never renders a blocker, overlay, or disabled marker on the rejected point", () => {
    const { doc, window } = setUp();
    advanceToBlocked(doc, window);
    click(doc, window, ...KO_POINT);

    const board = doc.querySelector("#board");
    const suspicious = board?.querySelectorAll(
      '[class*="block" i], [class*="illegal" i], [class*="warning" i], [class*="overlay" i], [class*="disabled" i], [class*="cross" i]',
    );
    expect(suspicious?.length ?? 0).toBe(0);
  });

  it("does not offer the elsewhere point until the learner has attempted the recapture", () => {
    const { doc, window } = setUp();
    advanceToBlocked(doc, window);

    // Before the attempt, clicking the elsewhere point does nothing —
    // there's no listener on it yet.
    const before = doc.querySelector(
      `circle.go-board-point[cx="${ELSEWHERE_POINT[1]}"][cy="${ELSEWHERE_POINT[0]}"]`,
    );
    expect(before?.classList.contains("go-board-point-active")).toBe(false);

    click(doc, window, ...KO_POINT);

    const after = doc.querySelector(`circle.go-board-point[cx="${ELSEWHERE_POINT[1]}"][cy="${ELSEWHERE_POINT[0]}"]`);
    expect(after?.classList.contains("go-board-point-active")).toBe(true);
  });
});

describe("playing elsewhere lifts the ko restriction", () => {
  function advanceToRetakable(doc: Document, window: JSDOM["window"]): void {
    click(doc, window, ...CAPTURE_POINT);
    click(doc, window, ...KO_POINT);
    click(doc, window, ...ELSEWHERE_POINT);
  }

  it("plays the elsewhere move and makes the ko point interactive again", () => {
    const { doc, window } = setUp();
    advanceToRetakable(doc, window);

    expect(stoneClass(doc, ...ELSEWHERE_POINT, "white")).toBe(true);
    expect(instruction(doc)).toContain("Try retaking it");
    const koCircle = doc.querySelector(`circle.go-board-point[cx="${KO_POINT[1]}"][cy="${KO_POINT[0]}"]`);
    expect(koCircle?.classList.contains("go-board-point-active")).toBe(true);
  });

  it("lets the learner retake the ko point, capturing the same black stone back", () => {
    const { doc, window } = setUp();
    advanceToRetakable(doc, window);

    click(doc, window, ...KO_POINT);

    expect(stoneClass(doc, ...KO_POINT, "white")).toBe(true);
    expect(stoneClass(doc, ...CAPTURE_POINT, "black")).toBe(false);
    expect(feedback(doc)).toContain("isn't recreating that old position anymore");
  });
});

describe("Lesson 5 is registered separately from the other lessons", () => {
  it("mounts its own board independent of any other lesson module", () => {
    const { doc } = setUp();
    expect(doc.querySelectorAll("circle.go-board-point-white")).toHaveLength(4);
    expect(doc.querySelectorAll("circle.go-board-point-black")).toHaveLength(3);
  });
});
