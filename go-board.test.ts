// The renderer has always been written against board.size rather than a
// hard-coded 9, but nothing proved it until free play needed a 19x19 board.
// These tests prove it, and pin the star-point conventions for both sizes so
// adding one can't quietly change the other.

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderGoBoard, starPoints } from "./go-board";
import { createBoard, placeStone, type Board } from "./go-rules";

function setUp(): { doc: Document; container: HTMLElement } {
  const dom = new JSDOM(`<!doctype html><body><div id="board"></div></body>`);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("window", dom.window);
  return { doc: dom.window.document, container: dom.window.document.querySelector("#board")! };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("star points", () => {
  it("marks a 9x9 board's four 3-3 points and its centre", () => {
    expect(starPoints(9)).toEqual([
      [2, 2],
      [2, 6],
      [6, 2],
      [6, 6],
      [4, 4],
    ]);
  });

  it("marks a 19x19 board's nine standard handicap points", () => {
    expect(starPoints(19)).toEqual([
      [3, 3],
      [3, 9],
      [3, 15],
      [9, 3],
      [9, 9],
      [9, 15],
      [15, 3],
      [15, 9],
      [15, 15],
    ]);
  });

  it("leaves any other size unmarked rather than inventing a convention", () => {
    expect(starPoints(13)).toEqual([]);
    expect(starPoints(5)).toEqual([]);
  });
});

describe("rendering at 19x19", () => {
  it("draws every one of the 361 intersections", () => {
    const { doc, container } = setUp();
    renderGoBoard(container, { board: createBoard(19) });
    expect(doc.querySelectorAll("circle.go-board-point")).toHaveLength(361);
  });

  it("sizes its own viewBox and label from the board, not from a fixed 9", () => {
    const { doc, container } = setUp();
    renderGoBoard(container, { board: createBoard(19) });

    const svg = doc.querySelector("svg.go-board-grid");
    expect(svg?.getAttribute("viewBox")).toBe("-0.5 -0.5 19 19");
    expect(svg?.getAttribute("aria-label")).toBe("19 by 19 Go board");
    expect(doc.querySelectorAll("circle.go-board-star")).toHaveLength(9);
  });

  it("makes only the points the caller named interactive", () => {
    const { doc, container } = setUp();
    const activated: Array<[number, number]> = [];
    renderGoBoard(container, {
      board: createBoard(19),
      interactive: [{ row: 18, col: 18 }],
      onPointActivate: ({ row, col }) => activated.push([row, col]),
    });

    expect(doc.querySelectorAll("circle.go-board-point-active")).toHaveLength(1);
    doc
      .querySelector('circle.go-board-point[cx="18"][cy="18"]')
      ?.dispatchEvent(new (doc.defaultView as Window & typeof globalThis).Event("click", { bubbles: true }));
    expect(activated).toEqual([[18, 18]]);
  });
});

describe("the rules engine at 19x19", () => {
  it("creates a genuinely empty 361-point board", () => {
    const board = createBoard(19);
    expect(board.size).toBe(19);
    expect(board.cells.flat()).toHaveLength(361);
    expect(board.cells.flat().every((cell) => cell === null)).toBe(true);
  });

  it("rejects a move off the far edge, which a 9x9 board would have allowed", () => {
    expect(placeStone(createBoard(9), { row: 12, col: 12 }, "black")).toEqual({
      ok: false,
      reason: "off-board",
    });
    expect(placeStone(createBoard(19), { row: 12, col: 12 }, "black").ok).toBe(true);
  });

  it("captures, forbids suicide, and enforces ko exactly as it does on a small board", () => {
    // The same ko shape as Lesson 5, played in the middle of a full board.
    let board: Board = createBoard(19);
    for (const [row, col] of [
      [9, 9],
      [11, 9],
      [10, 8],
      [10, 10],
    ]) {
      board.cells[row][col] = "white";
    }
    for (const [row, col] of [
      [8, 9],
      [9, 8],
      [9, 10],
    ]) {
      board.cells[row][col] = "black";
    }

    const capture = placeStone(board, { row: 10, col: 9 }, "black");
    expect(capture.ok).toBe(true);
    if (!capture.ok) return;
    expect(capture.captured).toEqual([{ row: 9, col: 9 }]);

    const before = board;
    board = capture.board;
    expect(placeStone(board, { row: 9, col: 9 }, "white", before)).toEqual({ ok: false, reason: "ko" });

    // A point enclosed by one's own opponent is still suicide out here.
    const enclosed = createBoard(19);
    for (const [row, col] of [
      [0, 1],
      [1, 0],
    ]) {
      enclosed.cells[row][col] = "white";
    }
    expect(placeStone(enclosed, { row: 0, col: 0 }, "black")).toEqual({ ok: false, reason: "suicide" });
  });
});
