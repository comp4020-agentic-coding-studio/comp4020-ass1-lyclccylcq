// Unit tests for the area-scoring algorithm itself, on small hand-built
// boards — separate from any lesson's presentation. The final test in this
// file is the one guard that matters most: it pins every number the Lesson 6
// demo text depends on, so the board and the copy can't silently drift apart.

import { describe, expect, it } from "vitest";
import { createBoard, type Board } from "./go-rules";
import { scoreBoard, territoryOwnerAt } from "./go-scoring";
import { createScoringBoard, KOMI } from "./lesson-scoring";

describe("scoreBoard: empty-region detection", () => {
  it("treats an irregular empty area around a single stone as one connected region", () => {
    const board = createBoard(5);
    board.cells[0][0] = "black";
    const result = scoreBoard(board, 0);

    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].points).toHaveLength(24);
  });

  it("splits the board into separate regions either side of a dividing wall", () => {
    const board = createBoard(5);
    for (let row = 0; row < 5; row++) board.cells[row][2] = "black";
    const result = scoreBoard(board, 0);

    // Both sides of an all-black wall border only black, so this wall alone
    // produces two black-owned regions, not one region split by colour.
    expect(result.regions).toHaveLength(2);
    for (const region of result.regions) expect(region.owner).toBe("black");
  });
});

describe("scoreBoard: region ownership", () => {
  it("a region bordered only by Black is owned by Black", () => {
    const board = createBoard(3);
    board.cells[0][1] = "black";
    board.cells[1][0] = "black";
    board.cells[1][1] = "black";
    // (0,0) is empty; its only neighbours are (0,1) and (1,0), both Black.
    const result = scoreBoard(board, 0);

    expect(territoryOwnerAt(result, { row: 0, col: 0 })).toBe("black");
    expect(result.blackTerritory).toContainEqual({ row: 0, col: 0 });
  });

  it("a region bordered only by White is owned by White", () => {
    const board = createBoard(3);
    board.cells[0][1] = "white";
    board.cells[1][0] = "white";
    board.cells[1][1] = "white";
    const result = scoreBoard(board, 0);

    expect(territoryOwnerAt(result, { row: 0, col: 0 })).toBe("white");
    expect(result.whiteTerritory).toContainEqual({ row: 0, col: 0 });
  });

  it("a region bordered by both colours is neutral, never assigned to either", () => {
    const board = createBoard(3);
    board.cells[0][1] = "black";
    board.cells[1][0] = "white";
    // (0,0) borders one Black stone and one White stone.
    const result = scoreBoard(board, 0);

    expect(territoryOwnerAt(result, { row: 0, col: 0 })).toBe("neutral");
    expect(result.neutralPoints).toContainEqual({ row: 0, col: 0 });
    expect(result.blackTerritory).toHaveLength(0);
    expect(result.whiteTerritory).toHaveLength(0);
  });

  it("a stone's own point has no territory owner", () => {
    const board = createBoard(3);
    board.cells[0][0] = "black";
    const result = scoreBoard(board, 0);
    expect(territoryOwnerAt(result, { row: 0, col: 0 })).toBeNull();
  });
});

describe("scoreBoard: counts and totals", () => {
  it("counts Black and White stones separately", () => {
    const board = createBoard(5);
    board.cells[0][0] = "black";
    board.cells[0][1] = "black";
    board.cells[4][4] = "white";
    const result = scoreBoard(board, 0);

    expect(result.blackStones).toBe(2);
    expect(result.whiteStones).toBe(1);
  });

  it("Black's score is stones plus territory, with no komi", () => {
    const board = createBoard(3);
    board.cells[0][1] = "black";
    board.cells[1][0] = "black";
    board.cells[1][1] = "black";
    const result = scoreBoard(board, 6.5);
    // Stones: 3. With no White stone anywhere on the board, every one of the
    // remaining 6 empty points ends up bordering only Black (split across a
    // 1-point region at the corner and a 5-point region wrapping the rest).
    expect(result.blackStones).toBe(3);
    expect(result.blackTerritory).toHaveLength(6);
    expect(result.blackScore).toBe(9);
  });

  it("komi is added to White's score only", () => {
    const board = createBoard(3);
    board.cells[2][1] = "white";
    board.cells[1][2] = "white";
    board.cells[1][1] = "white";
    const result = scoreBoard(board, 6.5);

    expect(result.whiteBoardScore).toBe(9); // 3 stones + 6 territory
    expect(result.whiteScore).toBe(15.5);
    expect(result.blackScore).not.toBe(result.blackScore + 6.5);
  });

  it("reports the winner and the margin between final scores", () => {
    const board = createBoard(3);
    board.cells[0][1] = "black";
    board.cells[1][0] = "black";
    board.cells[1][1] = "black";
    const result = scoreBoard(board, 0);

    expect(result.winner).toBe("black");
    expect(result.margin).toBe(result.blackScore - result.whiteScore);
  });

  it("declares a tie when both final scores are equal", () => {
    const board = createBoard(2);
    board.cells[0][0] = "black";
    board.cells[1][1] = "white";
    const result = scoreBoard(board, 0);
    expect(result.blackScore).toBe(result.whiteScore);
    expect(result.winner).toBe("tie");
    expect(result.margin).toBe(0);
  });
});

describe("Lesson 6's predefined board: exact scoring regression", () => {
  // This pins every figure the lesson's demo text depends on. If the board
  // fixture ever changes, this test's expectations must be re-derived by
  // hand and updated deliberately — that's the point.
  it("scores the fixed 9x9 endgame position exactly as hand-calculated", () => {
    const board: Board = createScoringBoard();
    const result = scoreBoard(board, KOMI);

    expect(result.blackStones).toBe(9);
    expect(result.blackTerritory).toHaveLength(36);
    expect(result.blackScore).toBe(45);

    expect(result.whiteStones).toBe(9);
    expect(result.whiteTerritory).toHaveLength(27);
    expect(result.komi).toBe(7.5);
    expect(result.whiteScore).toBe(43.5);

    expect(result.neutralPoints).toHaveLength(0);

    expect(result.winner).toBe("black");
    expect(result.margin).toBe(1.5);
  });
});
