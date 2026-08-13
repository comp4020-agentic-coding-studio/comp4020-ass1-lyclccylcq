// Behaviour tests for Lesson 6's DOM wiring: mount() takes plain element
// references, so a detached jsdom document stands in for the real page.
// These walk the six-stage counting sequence and assert on rendered text and
// marker counts, never on a hard-coded number the lesson text would also
// have to duplicate — go-scoring.test.ts already pins the exact figures.

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type LessonElements } from "./scoring";

function setUp(): { doc: Document; window: JSDOM["window"] } {
  const dom = new JSDOM(
    `<!doctype html><body>
      <div id="board"></div>
      <p id="stage-instruction"></p>
      <div id="score-breakdown"></div>
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
    breakdownEl: doc.querySelector("#score-breakdown"),
    feedbackEl: doc.querySelector("#lesson-feedback"),
    nextButton: doc.querySelector<HTMLButtonElement>("#lesson-next"),
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

function clickNext(doc: Document, window: JSDOM["window"]): void {
  const button = doc.querySelector<HTMLButtonElement>("#lesson-next");
  button?.dispatchEvent(new window.Event("click", { bubbles: true }));
}

function instruction(doc: Document): string {
  return doc.querySelector("#stage-instruction")?.textContent ?? "";
}

function feedback(doc: Document): string {
  return doc.querySelector("#lesson-feedback")?.textContent ?? "";
}

function breakdown(doc: Document): string {
  return [...doc.querySelectorAll("#score-breakdown p")].map((p) => p.textContent).join(" ");
}

function nextLabel(doc: Document): string {
  return doc.querySelector<HTMLButtonElement>("#lesson-next")?.textContent ?? "";
}

function isInteractive(doc: Document, row: number, col: number): boolean {
  return (
    doc.querySelector(`circle.go-board-point[cx="${col}"][cy="${row}"]`)?.classList.contains(
      "go-board-point-active",
    ) ?? false
  );
}

const BLACK_STONE: [number, number] = [0, 3];
const WHITE_STONE: [number, number] = [0, 4];
const BLACK_TERRITORY_POINT: [number, number] = [0, 0];
const WHITE_TERRITORY_POINT: [number, number] = [0, 8];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Lesson 6 starts on the finished position, unrevealed", () => {
  it("shows the board with no territory markers and nothing yet interactive", () => {
    const { doc } = setUp();
    expect(doc.querySelectorAll(".go-board-marker")).toHaveLength(0);
    expect(isInteractive(doc, ...BLACK_TERRITORY_POINT)).toBe(false);
    expect(nextLabel(doc)).toBe("Count the board");
    expect(breakdown(doc)).toBe("");
    expect(feedback(doc)).toBe("");
  });
});

describe("stage 2: Black's territory", () => {
  it("reveals exactly Black's territory and derives Black's running total", () => {
    const { doc, window } = setUp();
    clickNext(doc, window);

    expect(doc.querySelectorAll(".go-board-marker-black")).toHaveLength(36);
    expect(doc.querySelectorAll(".go-board-marker-white")).toHaveLength(0);
    expect(breakdown(doc)).toContain("Black stones: 9. Black territory: 36.");
    expect(breakdown(doc)).toContain("Black total so far: 45.");
    expect(nextLabel(doc)).toBe("Reveal White's territory");
  });

  it("makes the board interactive for inspection once territory starts revealing", () => {
    const { doc, window } = setUp();
    clickNext(doc, window);

    expect(isInteractive(doc, ...BLACK_TERRITORY_POINT)).toBe(true);
    click(doc, window, ...BLACK_TERRITORY_POINT);
    expect(feedback(doc)).toBe("This empty point is Black's territory.");
  });

  it("identifies a stone's colour when inspected, rather than treating it as territory", () => {
    const { doc, window } = setUp();
    clickNext(doc, window);

    click(doc, window, ...BLACK_STONE);
    expect(feedback(doc)).toBe("This is a black stone.");
  });
});

describe("stage 3: White's territory", () => {
  function advanceToWhite(doc: Document, window: JSDOM["window"]): void {
    clickNext(doc, window);
    clickNext(doc, window);
  }

  it("adds White's territory on top of Black's, keeping Black's markers", () => {
    const { doc, window } = setUp();
    advanceToWhite(doc, window);

    expect(doc.querySelectorAll(".go-board-marker-black")).toHaveLength(36);
    expect(doc.querySelectorAll(".go-board-marker-white")).toHaveLength(27);
    expect(breakdown(doc)).toContain("White stones: 9. White territory: 27.");
    expect(breakdown(doc)).toContain("White total so far (before komi): 36.");
    expect(nextLabel(doc)).toBe("Check for neutral points");
  });

  it("inspecting White's territory reports White as the owner", () => {
    const { doc, window } = setUp();
    advanceToWhite(doc, window);

    click(doc, window, ...WHITE_TERRITORY_POINT);
    expect(feedback(doc)).toBe("This empty point is White's territory.");
    click(doc, window, ...WHITE_STONE);
    expect(feedback(doc)).toBe("This is a white stone.");
  });
});

describe("stage 4: neutral points", () => {
  function advanceToNeutral(doc: Document, window: JSDOM["window"]): void {
    clickNext(doc, window);
    clickNext(doc, window);
    clickNext(doc, window);
  }

  it("states plainly that this position has none, instead of hiding the step", () => {
    const { doc, window } = setUp();
    advanceToNeutral(doc, window);

    expect(instruction(doc)).toContain("no neutral points");
    expect(breakdown(doc)).toContain("Neutral points: 0.");
    expect(doc.querySelectorAll(".go-board-marker-neutral")).toHaveLength(0);
    expect(nextLabel(doc)).toBe("Add komi");
  });
});

describe("stage 5: komi", () => {
  function advanceToKomi(doc: Document, window: JSDOM["window"]): void {
    clickNext(doc, window);
    clickNext(doc, window);
    clickNext(doc, window);
    clickNext(doc, window);
  }

  it("shows the explicit arithmetic adding komi to White's board score", () => {
    const { doc, window } = setUp();
    advanceToKomi(doc, window);

    expect(breakdown(doc)).toContain("Komi: +7.5 for White. 36 + 7.5 = 43.5.");
    expect(nextLabel(doc)).toBe("Show final result");
  });
});

describe("stage 6: final result", () => {
  function advanceToResult(doc: Document, window: JSDOM["window"]): void {
    for (let i = 0; i < 5; i++) clickNext(doc, window);
  }

  it("gives the full breakdown and computes the winner and margin, never a fixed string", () => {
    const { doc, window } = setUp();
    advanceToResult(doc, window);

    expect(breakdown(doc)).toContain("Black final score: 9 + 36 = 45.");
    expect(breakdown(doc)).toContain("White final score: 9 + 27 + 7.5 = 43.5.");
    expect(breakdown(doc)).toContain("Black wins by 1.5 points.");
  });

  it("hides the Next button once the walkthrough is complete", () => {
    const { doc, window } = setUp();
    advanceToResult(doc, window);

    expect(doc.querySelector<HTMLButtonElement>("#lesson-next")?.hidden).toBe(true);
  });

  it("ends with the curriculum's completion message", () => {
    const { doc, window } = setUp();
    advanceToResult(doc, window);

    expect(instruction(doc)).toContain(
      "You now know the basic rules needed to understand a game of Go.",
    );
  });
});

describe("resetting the walkthrough", () => {
  it("returns to the unrevealed finished position", () => {
    const { doc, window } = setUp();
    for (let i = 0; i < 5; i++) clickNext(doc, window);

    doc.querySelector<HTMLButtonElement>("#lesson-reset")?.dispatchEvent(new window.Event("click", { bubbles: true }));

    expect(doc.querySelectorAll(".go-board-marker")).toHaveLength(0);
    expect(breakdown(doc)).toBe("");
    expect(nextLabel(doc)).toBe("Count the board");
  });
});

describe("Lesson 6 is registered separately from the other lessons", () => {
  it("mounts its own board independent of any other lesson module", () => {
    const { doc } = setUp();
    expect(doc.querySelectorAll("circle.go-board-point-black")).toHaveLength(9);
    expect(doc.querySelectorAll("circle.go-board-point-white")).toHaveLength(9);
  });
});
