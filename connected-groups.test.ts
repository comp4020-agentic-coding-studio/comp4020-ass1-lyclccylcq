// Behaviour tests for Lesson 3's DOM wiring: mount() takes plain element
// references, so a detached jsdom document stands in for the real page.
// These assert on rendered state (text, classes, which points exist) rather
// than snapshotting markup, so they survive incidental styling changes.

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type LessonElements } from "./connected-groups";

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

function nextButton(doc: Document): HTMLButtonElement {
  return doc.querySelector("#lesson-next") as HTMLButtonElement;
}

function isBlack(doc: Document, row: number, col: number): boolean {
  return doc.querySelector(`circle.go-board-point[cx="${col}"][cy="${row}"]`)?.classList.contains(
    "go-board-point-black",
  ) ?? false;
}

function isWhite(doc: Document, row: number, col: number): boolean {
  return doc.querySelector(`circle.go-board-point[cx="${col}"][cy="${row}"]`)?.classList.contains(
    "go-board-point-white",
  ) ?? false;
}

// Example 1's group sits at (4,4)-(4,5); their combined liberties.
const EXAMPLE_1_LIBERTIES: Array<[number, number]> = [
  [3, 4],
  [5, 4],
  [4, 3],
  [3, 5],
  [5, 5],
  [4, 6],
];

// Example 2's 2x2 block sits at (1,1)-(2,2); their combined liberties.
const EXAMPLE_2_LIBERTIES: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [0, 2],
  [1, 3],
  [3, 1],
  [2, 0],
  [3, 2],
  [2, 3],
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Lesson 3: inspecting a group", () => {
  it("clicking any black stone selects the whole group and shows its liberty count", () => {
    const { doc, window } = setUp();
    expect(feedback(doc)).toBe("Select the group to see its liberties.");

    click(doc, window, 4, 4);
    expect(feedback(doc)).toBe("6 liberties remaining.");
  });

  it("does not highlight anything before the group is selected", () => {
    const { doc } = setUp();
    expect(doc.querySelectorAll(".go-board-highlight")).toHaveLength(0);
  });

  it("clicking an empty point before selecting a group does not place a move", () => {
    const { doc, window } = setUp();
    const [row, col] = EXAMPLE_1_LIBERTIES[0];
    click(doc, window, row, col); // empty point, no group selected first

    expect(feedback(doc)).toBe("Select the group before placing White stones.");
    expect(doc.querySelectorAll(".go-board-highlight")).toHaveLength(0);
    expect(isWhite(doc, row, col)).toBe(false);
  });
});

describe("Lesson 3: surrounding and capturing a group", () => {
  it("allows multiple consecutive white moves, each reducing the shown liberty count", () => {
    const { doc, window } = setUp();
    click(doc, window, 4, 4); // select the group
    expect(feedback(doc)).toBe("6 liberties remaining.");

    click(doc, window, ...EXAMPLE_1_LIBERTIES[0]);
    expect(feedback(doc)).toBe("5 liberties remaining.");

    click(doc, window, ...EXAMPLE_1_LIBERTIES[1]);
    expect(feedback(doc)).toBe("4 liberties remaining.");
  });

  it("rejects unrelated legal moves that do not close the selected group's liberties", () => {
    const { doc, window } = setUp();
    click(doc, window, 4, 4); // select the group
    expect(feedback(doc)).toBe("6 liberties remaining.");

    click(doc, window, 0, 0); // legal Go move, irrelevant to this exercise

    expect(feedback(doc)).toBe("Play on one of this group's liberties.");
    expect(isWhite(doc, 0, 0)).toBe(false);
    expect(feedback(doc)).not.toContain("5 liberties");
  });

  it("captures the whole group on the final liberty and reveals Next example", () => {
    const { doc, window } = setUp();
    click(doc, window, 4, 4);
    for (const [row, col] of EXAMPLE_1_LIBERTIES) {
      click(doc, window, row, col);
    }

    expect(feedback(doc)).toBe("No liberties left — the whole connected group is captured.");
    expect(isBlack(doc, 4, 4)).toBe(false);
    expect(isBlack(doc, 4, 5)).toBe(false);
    expect(nextButton(doc).hidden).toBe(false);
    expect(nextButton(doc).textContent).toBe("Next example");
  });
});

describe("Lesson 3: progressing through the three examples", () => {
  it("advances from example 1 to a distinct example 2 board", () => {
    const { doc, window } = setUp();
    click(doc, window, 4, 4);
    for (const [row, col] of EXAMPLE_1_LIBERTIES) click(doc, window, row, col);
    nextButton(doc).click();

    expect(isBlack(doc, 1, 1)).toBe(true);
    expect(isBlack(doc, 1, 2)).toBe(true);
    expect(isBlack(doc, 2, 1)).toBe(true);
    expect(isBlack(doc, 2, 2)).toBe(true);
    expect(feedback(doc)).toBe("Select the group to see its liberties.");
  });

  it("advances from example 2 to example 3 after capturing example 2's group", () => {
    const { doc, window } = setUp();
    click(doc, window, 4, 4);
    for (const [row, col] of EXAMPLE_1_LIBERTIES) click(doc, window, row, col);
    nextButton(doc).click();

    click(doc, window, 1, 1);
    for (const [row, col] of EXAMPLE_2_LIBERTIES) click(doc, window, row, col);
    expect(nextButton(doc).hidden).toBe(false);
    nextButton(doc).click();

    expect(isBlack(doc, 2, 8)).toBe(true);
    expect(isBlack(doc, 3, 8)).toBe(true);
    expect(isBlack(doc, 3, 7)).toBe(true);
    expect(feedback(doc)).toBe("Select the group to see its liberties.");
    // The final example offers no Next button — there's nothing after it.
    click(doc, window, 2, 8);
    expect(feedback(doc)).not.toContain("captured");
  });

  it("does not reveal example 3's answer up front", () => {
    const { doc, window } = setUp();
    click(doc, window, 4, 4);
    for (const [row, col] of EXAMPLE_1_LIBERTIES) click(doc, window, row, col);
    nextButton(doc).click();
    click(doc, window, 1, 1);
    for (const [row, col] of EXAMPLE_2_LIBERTIES) click(doc, window, row, col);
    nextButton(doc).click();

    // Nothing is pre-highlighted or pre-filled before the learner selects
    // example 3's group themselves.
    expect(doc.querySelectorAll(".go-board-highlight")).toHaveLength(0);
    expect(feedback(doc)).toBe("Select the group to see its liberties.");
  });
});

describe("Lesson 3: state stays clean across a capture", () => {
  it("clears the stale selection/highlight state the instant the selected group is captured", () => {
    const { doc, window } = setUp();
    click(doc, window, 4, 4); // select the group
    for (const [row, col] of EXAMPLE_1_LIBERTIES) click(doc, window, row, col);

    expect(feedback(doc)).toBe("No liberties left — the whole connected group is captured.");
    // No leftover group/liberty highlight survives the capture that removed
    // the stones the selection pointed at.
    expect(doc.querySelectorAll(".go-board-highlight")).toHaveLength(0);
    expect(isBlack(doc, 4, 4)).toBe(false);
    expect(isBlack(doc, 4, 5)).toBe(false);
  });

  it("shows no group-selection UI, overlay, or blocker when clicking a just-vacated intersection", () => {
    const { doc, window } = setUp();
    click(doc, window, 4, 4);
    for (const [row, col] of EXAMPLE_1_LIBERTIES) click(doc, window, row, col);

    // The capture leaves the whole example frozen until "Next example", so
    // this click hits an inert point — but it must render as a plain empty
    // Go point, not resurrect any group/highlight/overlay state.
    click(doc, window, 4, 4);

    expect(doc.querySelectorAll(".go-board-highlight")).toHaveLength(0);
    expect(feedback(doc)).toBe("No liberties left — the whole connected group is captured.");
    const board = doc.querySelector("#board");
    const suspicious = board?.querySelectorAll(
      '[class*="block" i], [class*="illegal" i], [class*="warning" i], [class*="overlay" i], [class*="disabled" i], [class*="cross" i]',
    );
    expect(suspicious?.length ?? 0).toBe(0);
    // Exactly the baseline SVG furniture — grid lines, star points, hint
    // dots, and one circle per point — nothing extra rendered.
    expect(board?.querySelectorAll("circle").length).toBe(167);
  });

  it("a freshly emptied point stays visually plain but is not accepted when irrelevant to the next group", () => {
    const { doc, window } = setUp();
    click(doc, window, 4, 4);
    for (const [row, col] of EXAMPLE_1_LIBERTIES) click(doc, window, row, col);
    nextButton(doc).click(); // example 2's board is unrelated to example 1's now-empty points

    expect(isBlack(doc, 4, 4)).toBe(false);
    click(doc, window, 1, 1); // select example 2's group
    click(doc, window, 4, 4); // same coordinate example 1's group used to occupy
    expect(feedback(doc)).toBe("Play on one of this group's liberties.");
    expect(isWhite(doc, 4, 4)).toBe(false);
    expect(doc.querySelector('circle.go-board-highlight[cx="4"][cy="4"]')).toBeNull();
  });
});

describe("Lesson 3: illegal moves stay invisible", () => {
  it("clicking an already-occupied point does nothing and leaves the board unchanged", () => {
    const { doc, window } = setUp();
    click(doc, window, 4, 4);
    click(doc, window, ...EXAMPLE_1_LIBERTIES[0]);
    expect(feedback(doc)).toBe("5 liberties remaining.");

    // Re-render replaces the circle at that point; clicking the same
    // coordinate again hits a now-occupied, non-interactive point.
    click(doc, window, ...EXAMPLE_1_LIBERTIES[0]);
    expect(feedback(doc)).toBe("5 liberties remaining.");
  });

  it("never renders a blocker, overlay, or disabled marker anywhere on the board", () => {
    const { doc, window } = setUp();
    click(doc, window, 4, 4);
    click(doc, window, ...EXAMPLE_1_LIBERTIES[0]);

    const board = doc.querySelector("#board");
    const suspicious = board?.querySelectorAll(
      '[class*="block" i], [class*="illegal" i], [class*="warning" i], [class*="overlay" i], [class*="disabled" i], [class*="cross" i]',
    );
    expect(suspicious?.length ?? 0).toBe(0);
  });
});
