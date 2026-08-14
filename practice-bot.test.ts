// The bot is judged on intentions, not on strength: given a position where
// one move is obviously the point of the position, does it find that move?
// Every test seeds the random tie-break so a pass or failure is reproducible.

import { describe, expect, it } from "vitest";
import { createBoard, getLiberties, getGroup, placeStone, type Board, type Point, type Stone } from "./go-rules";
import { chooseBotMove } from "./practice-bot";

/** A tiny deterministic generator, so tie-breaks are reproducible. */
function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function boardFrom(size: number, black: Array<[number, number]>, white: Array<[number, number]>): Board {
  const board = createBoard(size);
  for (const [row, col] of black) board.cells[row][col] = "black";
  for (const [row, col] of white) board.cells[row][col] = "white";
  return board;
}

function move(board: Board, colour: Stone, seed = 1, extra: { koBoard?: Board } = {}): Point | "pass" {
  return chooseBotMove({ board, colour, rng: seededRng(seed), ...extra });
}

function asPoint(result: Point | "pass"): Point {
  expect(result).not.toBe("pass");
  return result as Point;
}

describe("the bot only ever offers moves the shared rules engine accepts", () => {
  it("returns a legal move on a busy mid-game board, for many different seeds", () => {
    const board = boardFrom(
      19,
      [
        [3, 3],
        [3, 4],
        [4, 3],
        [9, 9],
        [15, 15],
      ],
      [
        [3, 5],
        [4, 4],
        [5, 3],
        [9, 10],
        [15, 3],
      ],
    );

    for (let seed = 1; seed <= 25; seed++) {
      const chosen = move(board, "white", seed);
      if (chosen === "pass") continue;
      expect(placeStone(board, chosen, "white").ok, `seed ${seed} chose an illegal point`).toBe(true);
    }
  });

  it("never plays into a point the ko rule forbids", () => {
    // Lesson 5's ko shape, with White having just been captured.
    const board = boardFrom(
      9,
      [
        [3, 4],
        [4, 3],
        [4, 5],
        [5, 4],
      ],
      [
        [6, 4],
        [5, 3],
        [5, 5],
      ],
    );
    const koBoard = boardFrom(
      9,
      [
        [3, 4],
        [4, 3],
        [4, 5],
      ],
      [
        [4, 4],
        [6, 4],
        [5, 3],
        [5, 5],
      ],
    );

    for (let seed = 1; seed <= 30; seed++) {
      const chosen = move(board, "white", seed, { koBoard });
      if (chosen === "pass") continue;
      expect(chosen).not.toEqual({ row: 4, col: 4 });
      expect(placeStone(board, chosen, "white", koBoard).ok).toBe(true);
    }
  });
});

describe("what the bot prefers", () => {
  it("takes a capture when one is available", () => {
    // A white stone on the edge with its last liberty at (0,2).
    const board = boardFrom(
      9,
      [
        [0, 0],
        [1, 1],
        [5, 5],
      ],
      [[0, 1]],
    );
    // (0,1) is white with liberties (0,2) only — (0,0) black, (1,1) black.
    expect(getLiberties(board, getGroup(board, { row: 0, col: 1 }))).toEqual([{ row: 0, col: 2 }]);

    for (let seed = 1; seed <= 10; seed++) {
      expect(move(board, "black", seed)).toEqual({ row: 0, col: 2 });
    }
  });

  it("saves its own group from atari when there is no capture on offer", () => {
    // White's two stones have one liberty left at (4,6).
    const board = boardFrom(
      9,
      [
        [3, 4],
        [3, 5],
        [5, 4],
        [5, 5],
        [4, 3],
      ],
      [
        [4, 4],
        [4, 5],
      ],
    );
    expect(getLiberties(board, getGroup(board, { row: 4, col: 4 }))).toEqual([{ row: 4, col: 6 }]);

    for (let seed = 1; seed <= 10; seed++) {
      expect(move(board, "white", seed)).toEqual({ row: 4, col: 6 });
    }
  });

  it("puts an opponent group in atari when nothing more urgent is going on", () => {
    // Black's pair at (4,4)-(4,5) has two liberties: (4,3) and (4,6).
    const board = boardFrom(
      9,
      [
        [4, 4],
        [4, 5],
      ],
      [
        [3, 4],
        [3, 5],
        [5, 4],
        [5, 5],
      ],
    );
    expect(getLiberties(board, getGroup(board, { row: 4, col: 4 }))).toHaveLength(2);

    for (let seed = 1; seed <= 10; seed++) {
      const chosen = asPoint(move(board, "white", seed));
      expect([
        { row: 4, col: 3 },
        { row: 4, col: 6 },
      ]).toContainEqual(chosen);
    }
  });

  it("prefers any sane move over putting its own new stone in atari", () => {
    const board = boardFrom(
      9,
      [
        [0, 1],
        [1, 0],
        [1, 2],
      ],
      [[8, 8]],
    );
    // (1,1) would leave a lone white stone with a single liberty.
    for (let seed = 1; seed <= 20; seed++) {
      const chosen = asPoint(move(board, "white", seed));
      const result = placeStone(board, chosen, "white");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      if (result.captured.length > 0) continue;
      expect(getLiberties(result.board, getGroup(result.board, chosen)).length).toBeGreaterThan(1);
    }
  });
});

describe("opening and stopping", () => {
  it("opens on a star point rather than at random on an empty board", () => {
    const board = createBoard(19);
    const openings = [
      { row: 3, col: 3 },
      { row: 3, col: 15 },
      { row: 15, col: 3 },
      { row: 15, col: 15 },
      { row: 9, col: 9 },
    ];
    for (let seed = 1; seed <= 15; seed++) {
      expect(openings).toContainEqual(asPoint(move(board, "black", seed)));
    }
  });

  it("agrees to stop once the human passes and only quiet moves are left", () => {
    // A settled 9x9: one solid wall, nothing capturable on either side.
    const board = createBoard(9);
    for (let row = 0; row < 9; row++) {
      board.cells[row][4] = "black";
      board.cells[row][5] = "white";
    }

    for (let seed = 1; seed <= 10; seed++) {
      expect(chooseBotMove({ board, colour: "white", opponentPassed: true, rng: seededRng(seed) })).toBe("pass");
    }
  });

  it("keeps playing when the human passes but something is still at stake", () => {
    // White can capture, so passing here would simply be a mistake.
    const board = boardFrom(
      9,
      [[0, 1]],
      [
        [0, 0],
        [1, 1],
      ],
    );
    expect(chooseBotMove({ board, colour: "white", opponentPassed: true, rng: seededRng(3) })).toEqual({
      row: 0,
      col: 2,
    });
  });

  it("passes when the board is completely full", () => {
    const board = createBoard(5);
    // Alternating stones with no empty point anywhere, so nothing is legal.
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        board.cells[row][col] = (row + col) % 2 === 0 ? "black" : "white";
      }
    }
    expect(chooseBotMove({ board, colour: "white", rng: seededRng(1) })).toBe("pass");
  });
});

describe("reproducibility", () => {
  it("makes the same choice twice from the same seed, and can differ across seeds", () => {
    const board = boardFrom(
      19,
      [
        [3, 3],
        [15, 15],
      ],
      [[3, 15]],
    );
    expect(move(board, "white", 7)).toEqual(move(board, "white", 7));

    const across = new Set(
      Array.from({ length: 40 }, (_, seed) => JSON.stringify(move(board, "white", seed + 1))),
    );
    expect(across.size).toBeGreaterThan(1);
  });
});
